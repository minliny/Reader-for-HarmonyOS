import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions={"bookshelf": {"description": "实际书架管理公共浮动header/完整Scroll/测量delta/安全bottom与back回调", "resources": []}, "source": {"description": "实际书源工具公共浮动header/完整Scroll/测量delta/安全bottom与back回调", "resources": []}, "rules": {"description": "实际规则公共浮动header/完整Scroll/测量delta/安全bottom与back回调", "resources": []}, "sync": {"description": "实际同步公共浮动header/完整Scroll/测量delta/安全bottom与back回调", "resources": []}, "rssFeed": {"description": "实际RSS feed公共浮动header/完整Scroll/测量delta/安全bottom与back回调", "resources": []}, "rssManagement": {"description": "实际RSS管理公共浮动header/完整Scroll/测量delta/安全bottom与back回调", "resources": []}, "rssEditor": {"description": "实际RSS编辑公共浮动header/完整Scroll/测量delta/安全bottom与back回调", "resources": []}, "rssDetail": {"description": "实际RSS详情公共浮动header/完整Scroll/测量delta/安全bottom与back回调", "resources": []}};
for(const id of selectContractCases(definitions)){await runSelectedCase(id);recordContractCasePass(id);}
async function runSelectedCase(selectedCase){
const { resolveEtsLoaderRoot } = await import('./lib/tool-environment.mjs');
const {switchSpecs} = await import('./lib/reader-switch-control-probe.mjs');
const {default: assert} = await import('node:assert/strict');
const { readFileSync } = await import('node:fs');
const { createRequire } = await import('node:module');
const { foundationControls } = await import('./lib/reader-foundation-control-probe.mjs');
const { boundedMembers } = await import('./lib/bounded-surface-sdk-probe.mjs');
const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
const { READER_FLOATING_TOP_BAR_HEIGHT, readerFloatingBarBottomInset } = await import('./lib/reader-floating-bar-metrics-probe.mjs');
const { ReaderWindowMetricsSnapshot, ReaderRectVp, ReaderInsetsVp, readerInteractiveSafeLeft, readerInteractiveSafeRight } = await import('../entry/src/main/ets/features/common/ReaderWindowMetrics.ts');


const require = createRequire(import.meta.url);
const sdk = resolveEtsLoaderRoot();
const syntax = require(`${sdk}/lib/validate_ui_syntax.js`);
let metrics;
const cases = [
  ['bookshelf/BookshelfManagementPage.ets', 16],
  ['source/SourceToolsPage.ets', 16],
  ['settings/RulesManagementPage.ets', 16],
  ['sync/SyncPage.ets', 18],
  ['rss/RssSourceFeedPage.ets', 24],
  ['rss/RssSubscriptionManagementPage.ets', 24],
  ['rss/RssSubscriptionEditorPage.ets', 16],
  ['rss/RssEntryDetailPage.ets', 62],
];
const chosenFiles={bookshelf:'bookshelf/BookshelfManagementPage.ets',source:'source/SourceToolsPage.ets',rules:'settings/RulesManagementPage.ets',sync:'sync/SyncPage.ets',rssFeed:'rss/RssSourceFeedPage.ets',rssManagement:'rss/RssSubscriptionManagementPage.ets',rssEditor:'rss/RssSubscriptionEditorPage.ets',rssDetail:'rss/RssEntryDetailPage.ets'};
for (const [file, bottom] of cases.filter(row=>row[0]===chosenFiles[selectedCase])) {
  const source = readFileSync(new URL(`../entry/src/main/ets/features/${file}`, import.meta.url), 'utf8');
  const builders = [...source.matchAll(/@Builder\s+private (\w+)\(/g)].map(match => match[1]);
  for (const name of builders) require(`${sdk}/lib/component_map.js`).CUSTOM_BUILDER_METHOD.add(name);
  const isDetail = file === 'rss/RssEntryDetailPage.ets';
  const methods = ['build', 'pageContent',...['hasReadData','originalPending'].filter(name=>source.includes(`private ${name}(`))];
  if (builders.includes('pageHeader')) methods.push('pageHeader');
  if (source.includes('private numericAreaLength(')) methods.push('numericAreaLength');
  if (builders.includes('backBar')) methods.push('backBar');
  if (file.endsWith('RssSubscriptionEditorPage.ets')) methods.push('saveAction');
  if (isDetail) methods.push('bottomActions');
  const controls=foundationControls(),headerSource=readFileSync(new URL('../entry/src/main/ets/features/common/PageBackBar.ets',import.meta.url),'utf8'),toggleSource=readFileSync(new URL('../entry/src/main/ets/features/common/ReaderToggle.ets',import.meta.url),'utf8');
  const recoverySources=Object.fromEntries(['ReaderRecoveryAction','ReaderRecoveryNotice'].map(name=>[name,readFileSync(new URL(`../entry/src/main/ets/features/common/${name}.ets`,import.meta.url),'utf8')]));
  const hooks={...controls.hooks,childSources:{...controls.hooks.childSources,PageBackBar:headerSource,ReaderToggle:toggleSource,...recoverySources}},platform={...controls.dependencies,...switchSpecs(),AccessibilityRoleType:{SWITCH:'AccessibilityRoleType.SWITCH',BUTTON:'AccessibilityRoleType.BUTTON'},readerInteractiveSafeLeft,readerInteractiveSafeRight,ReaderWindowCoordinator:{metrics:()=>metrics}};
  const ts=require(sdk+'/node_modules/typescript'),options=require(sdk+'/lib/ets_checker.js').compilerOptions;
  const headerTree=ts.createSourceFile('PageBackBar.ets',headerSource,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,options),headerDecl=headerTree.statements.find(n=>ts.isStructDeclaration(n));
  const slots=new Set(headerDecl.members.filter(n=>ts.isPropertyDeclaration(n)&&ts.getAllDecorators(n).some(d=>d.expression.getText(headerTree)==='BuilderParam')).map(n=>n.name.text));assert.ok(slots.has('trailing'));syntax.builderParamObjectCollection.set('PageBackBar',slots);
  const Header=createReaderBuilderProbe(headerSource,boundedMembers(headerSource),platform,hooks).Component,Toggle=createReaderBuilderProbe(toggleSource,boundedMembers(toggleSource),platform,hooks).Component;
  const recoveryDependencies={};for(const [name,definition]of Object.entries(recoverySources))recoveryDependencies[name]=createReaderBuilderProbe(definition,boundedMembers(definition),{...platform,...recoveryDependencies},hooks).Component;
  const { Component } = createReaderBuilderProbe(source, methods, {
    ...platform,...recoveryDependencies,PageBackBar: Header, ReaderToggle: Toggle, ReaderWindowCoordinator: { metrics: () => metrics },
    READER_FLOATING_TOP_BAR_HEIGHT, readerFloatingBarBottomInset, RSS_DETAIL_ACTION_AREA_HEIGHT: 62,
    TOK_SPACE_XS: 8, TOK_SPACE_SM: 12, TOK_SPACE_MD: 16, TOK_SPACE_LG: 24,
  },hooks);
  for (const [width, height, left, right] of [[365, 320, 19, 19], [390, 844, 32, 24], [1280, 800, 280, 280]]) {
    for (const safeBottom of [0, 24, 48]) {
      metrics = new ReaderWindowMetricsSnapshot(new ReaderRectVp(0, 0, width, height), undefined,
        new ReaderInsetsVp(left > 19 ? left : 0, 0, right > 19 ? right : 0, safeBottom));
      const frame = { width: width - left - right, left, right };
      const owner = new Component(undefined, {}); const calls = [];
      if(file.endsWith('RssSubscriptionManagementPage.ets'))assert.equal(owner.resultMessage,'','the real omitted @Prop retains its production empty feedback default');
      for (const name of builders) if (!methods.includes(name)) owner[name] = () => {};
      Object.assign(owner, { appThemeScheme: 'day', readerWindowMetricsRevision: 1, contentFrame: () => frame,
        snapshot: { readFacts:{hasValue:true,fact:'current'}, statusMessage: '状态', busy: false, canSave:true, mode: 'create', enabled: false, enabledCookieJar: false,
          batchCheck: { phase: 'idle' }, editorSourceId: '' },
        item: { link: 'https://example.com/article' }, items: [], favoriteState: 'notFavorited',
        summaryParagraphs: () => [], hasOriginalLink: () => true,
        batchControlsRenderKey: () => 'idle', batchProgressRenderKey: () => 'idle',
        onBack: () => calls.push('back'), onOpenOriginal: () => calls.push('original'),
        onSave: () => calls.push('save'), onEnabledChanged: () => calls.push('enabled'),
        onEnabledCookieJarChanged: () => calls.push('cookie') });
      owner.initialRender();
      const nodes = controls.nodes(owner);
      const root = nodes.find(node => node.type === 'Stack' && node.backgroundColor);
      assert.ok(root, `${file}: actual public scaffold paints the root`);
      assert.equal(root.create.alignContent, 'Alignment.TopStart', file);
      assert.deepEqual([root.width, root.height], ['100%', '100%'], file);
      const scroll = nodes.find(node => node.type === 'Scroll');
      assert.deepEqual([scroll.width, scroll.height, scroll.layoutWeight], ['100%', '100%', undefined], file);
      assert.equal(scroll.padding?.top, undefined, `${file}: top clearance must move with content rather than shrink the viewport`);
      const content = nodes.find(node => node.type === 'Column' && node.padding?.top !== undefined);
      const beforeBottom=content.padding.bottom;assert.ok(Number.isFinite(beforeBottom)&&beforeBottom>=safeBottom);
      const header = [...owner.children.values()].find(child => child instanceof Header);
      assert.ok(header,'actual shared header is SDK mounted, not a shape-only child');
      const ordered = controls.orderedNodes(owner);
      const headerRow = [...header.nodes.values()].find(node => node.type === 'Row' && node.height !== undefined);
      assert.ok(ordered.indexOf(headerRow) > ordered.indexOf(scroll), `${file}: the actual header native row is emitted after the full scroll`);
      assert.ok(nodes.some(node => node.type === 'Column' && node.zIndex > 0 && node.hitTestBehavior === 'HitTestMode.Transparent'), `${file}: public fixed header host owns the layer above content`);
      const measuredHost = nodes.find(node => node.type === 'Column' && node.backgroundColor && node.onAreaChange);
      assert.ok(measuredHost, `${file}: actual public host paints and measures the fixed header`);
      const priorHeight=headerRow.height,priorTop=content.padding.top;measuredHost.onAreaChange({}, {height:`${priorHeight+38}vp`});controls.properties.flush();assert.equal(content.padding.top,priorTop+38,`${file}: header height delta reaches content once`);
      assert.ok(controls.nodes(owner).includes(scroll), `${file}: measured clearance preserves the existing Scroll node`);
      measuredHost.onAreaChange({}, {height:`${priorHeight}vp`});controls.properties.flush();assert.equal(content.padding.top,priorTop,`${file}: current header endpoint restored`);
      [...header.nodes.values()].find(n=>n.type==='Stack'&&n.onClick).onClick(); assert.deepEqual(calls, ['back'], `${file}: return routing remains unchanged`);
      for (const scheme of ['night', 'day']) { owner.appThemeScheme = scheme; controls.flush(owner); }
    }
  }
}

}
