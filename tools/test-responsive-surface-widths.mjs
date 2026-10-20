import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions={"management": {"description": "实际书架管理 build→标准Scroll/content slot绑定及数字/vp测量、保留Scroller、非法Area负例", "resources": []}, "rssEditor": {"description": "实际RSS编辑 build→标准Scroll/content slot绑定及数字/vp测量、保留Scroller、非法Area负例", "resources": []}, "rules": {"description": "实际规则管理 build→标准Scroll/content slot绑定及数字/vp测量、保留Scroller、非法Area负例", "resources": []}, "tools": {"description": "实际书源工具 build→标准Scroll/content slot绑定及数字/vp测量、保留Scroller、非法Area负例", "resources": []}, "settingsHome": {"description": "实际设置首页 build→标准Scroll/content slot绑定及数字/vp测量、保留Scroller、非法Area负例", "resources": []}, "settingsGeneral": {"description": "实际通用设置 build→标准Scroll/content slot绑定及数字/vp测量、保留Scroller、非法Area负例", "resources": []}, "rssManagement": {"description": "实际RSS管理 build→标准Scroll/content slot绑定及数字/vp测量、保留Scroller、非法Area负例", "resources": []}, "rssFeed": {"description": "实际RSS feed build→标准Scroll/content slot绑定及数字/vp测量、保留Scroller、非法Area负例", "resources": []}, "rssDetail": {"description": "实际RSS详情 build→标准Scroll/content slot绑定及数字/vp测量、保留Scroller、非法Area负例", "resources": []}, "sync": {"description": "实际同步 build→标准Scroll/content slot绑定及数字/vp测量、保留Scroller、非法Area负例", "resources": []}, "empty-card": {"description": "实际空书架窄宽度动作Flex重排及导入/搜索回调", "resources": []}};
for(const id of selectContractCases(definitions)){await runSelectedCase(id);recordContractCasePass(id);}
async function runSelectedCase(selectedCase){
const { resolveEtsLoaderRoot } = await import('./lib/tool-environment.mjs');
const {default: assert} = await import('node:assert/strict');
const { readFileSync } = await import('node:fs');
const { createRequire } = await import('node:module');
const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
const { createArkUIPropertyRuntimeProbe } = await import('./lib/arkui-property-runtime-probe.mjs');
const { actualReaderPageShell } = await import('./lib/reader-page-shell-runtime-probe.mjs');
const { boundedSurfaceSdk, boundedMembers } = await import('./lib/bounded-surface-sdk-probe.mjs');
const { ReaderWindowMetricsSnapshot, ReaderRectVp, ReaderInsetsVp } = await import('../entry/src/main/ets/features/common/ReaderWindowMetrics.ts');


const read = (relative) => readFileSync(new URL(`../${relative}`, import.meta.url), 'utf8');
const sdk = resolveEtsLoaderRoot();
const require = createRequire(import.meta.url), ts = require(sdk + '/node_modules/typescript'), options = require(sdk + '/lib/ets_checker.js').compilerOptions;
const parse = source => ts.createSourceFile('ResponsivePage.ets', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
function proveStandardBinding(name, source, variant, builder) {
  const tree = parse(source); assert.deepEqual(tree.parseDiagnostics, []);
  assert.ok(tree.statements.some(node => ts.isImportDeclaration(node) && node.moduleSpecifier.text === '../common/ReaderStandardPage'), name + ': actual public owner import');
  const bindings = [];
  function visit(node) {
    if ((ts.isCallExpression(node) || ts.isEtsComponentExpression?.(node)) && node.expression.getText(tree) === 'ReaderStandardPage') {
      const props = node.arguments[0].properties, selected = props.find(property => property.name?.text === 'variant');
      if (selected?.initializer.text === variant) bindings.push(props.find(property => property.name?.text === 'content').initializer);
    }
    ts.forEachChild(node, visit);
  }
  visit(tree); assert.equal(bindings.length, 1, name + ': one finite public Scroll owner');
  assert.equal(bindings[0].body.statements.length, 1);
  assert.equal(bindings[0].body.statements[0].expression.getText(tree), `this.${builder}()`, name + ': actual public content slot retains its business builder');
}

const shelf = read('entry/src/main/ets/features/bookshelf/BookshelfPage.ets');
const emptyPage = read('entry/src/main/ets/features/bookshelf/BookshelfEmptyPage.ets');
const emptyCard = read('entry/src/main/ets/features/bookshelf/BookshelfEmptyCard.ets');
const shelfManagement = read('entry/src/main/ets/features/bookshelf/BookshelfManagementPage.ets');
const localImport = read('entry/src/main/ets/features/bookshelf/LocalImportDialog.ets');
const jsonImport = read('entry/src/main/ets/features/common/JsonImportDialog.ets');
const dialogSurface = read('entry/src/main/ets/features/common/ReaderDialogSurface.ets');
const dialogSpecs = read('entry/src/main/ets/features/common/ReaderSurfaceSpecs.ets');
const indexPage = read('entry/src/main/ets/pages/Index.ets');
const search = read('entry/src/main/ets/features/search/SearchPage.ets');
const discover = read('entry/src/main/ets/features/discover/DiscoverPage.ets');
const rss = read('entry/src/main/ets/features/rss/RssPage.ets');
const rssManagement = read('entry/src/main/ets/features/rss/RssSubscriptionManagementPage.ets');
const rssEditor = read('entry/src/main/ets/features/rss/RssSubscriptionEditorPage.ets');
const rssFeed = read('entry/src/main/ets/features/rss/RssSourceFeedPage.ets');
const rssEntry = read('entry/src/main/ets/features/rss/RssEntryDetailPage.ets');
const settingsShell = read('entry/src/main/ets/features/shell/SettingsShell.ets');
const settingsPage = read('entry/src/main/ets/features/settings/SettingsPage.ets');
const rulesManagement = read('entry/src/main/ets/features/settings/RulesManagementPage.ets');
const sourceManagement = read('entry/src/main/ets/features/source/SourceManagementPage.ets');
const sourceTools = read('entry/src/main/ets/features/source/SourceToolsPage.ets');
const sync = read('entry/src/main/ets/features/sync/SyncPage.ets');
const fullDirectory = read('entry/src/main/ets/features/reading/ReaderFullDirectory.ets');
const fullDirectoryPanel = read('entry/src/main/ets/features/reading/FullDirectoryPanel.ets');
const control = read('entry/src/main/ets/features/reading/ReaderControlPanel.ets');
const experience = read('entry/src/main/ets/features/reading/LocalReadingExperience.ets');
const appearance = read('entry/src/main/ets/features/reading/ReaderAppearanceFullPanel.ets');
const appearanceStage = read('entry/src/main/ets/features/reading/ReaderAppearanceMotionStage.ets');
const settings = read('entry/src/main/ets/features/reading/ReaderSettingsFullPanel.ets');
const tts = read('entry/src/main/ets/features/reading/ReaderTtsFullPanel.ets');
const autoPage = read('entry/src/main/ets/features/reading/ReaderAutoPageFullPanel.ets');
const readerLayout = read('entry/src/main/ets/features/reading/ReaderLayoutGeometry.ts');

const standardSource=read('entry/src/main/ets/features/common/ReaderStandardPage.ets'),policySource=read('entry/src/main/ets/features/common/ReaderPageShell.ts');
const caseNames={management:'bookshelf management',rssEditor:'RSS subscription editor',rules:'rules management',tools:'source tools',settingsHome:'settings home',settingsGeneral:'settings general',rssManagement:'RSS subscription management',rssFeed:'RSS source feed',rssDetail:'RSS entry detail',sync:'sync'};
const standardBindings = [
  ['bookshelf management', shelfManagement, 'management', 'pageContent', Number.MAX_SAFE_INTEGER],
  ['RSS subscription editor', rssEditor, 'rssEditor', 'pageContent', Number.MAX_SAFE_INTEGER],
  ['rules management', rulesManagement, 'management', 'pageContent', Number.MAX_SAFE_INTEGER],
  ['source tools', sourceTools, 'tools', 'pageContent', Number.MAX_SAFE_INTEGER],
  ['settings home', settingsShell, 'settingsHome', 'homeContent', 720],
  ['settings general', settingsShell, 'settingsGeneral', 'generalContent', 720],
  ['RSS subscription management', rssManagement, 'rssManagement', 'pageContent', 720],
  ['RSS source feed', rssFeed, 'rssFeed', 'pageContent', 720],
  ['RSS entry detail', rssEntry, 'rssDetail', 'pageContent', 720],
  ['sync', sync, 'sync', 'pageContent', 720],
];
function checkSharedWidths(sharedSource = standardSource, sharedPolicy = policySource) {
  const runtime = createArkUIPropertyRuntimeProbe(), policy = actualReaderPageShell(sharedPolicy);
  let metrics;
  class HeaderLeaf { constructor(owner, params, _storage, id) { Object.assign(this, {owner, params, id}); } }
  const headers = Object.fromEntries([['PageBackBar', 'common/PageBackBar'], ['AppTopBar', 'common/AppTopBar'], ['MainTabBar', 'shell/MainTabBar']]
    .map(([name, path]) => [name, read('entry/src/main/ets/features/' + path + '.ets')]));
  for (const [name, source] of Object.entries(headers)) {
    const tree = parse(source), owner = tree.statements.find(node => node.name?.text === name);
    const fields = owner.members.filter(member => ts.getAllDecorators(member).some(decorator => decorator.getText(tree) === '@BuilderParam')).map(member => member.name.text);
    require(sdk + '/lib/validate_ui_syntax.js').builderParamObjectCollection.set(name, new Set(fields));
  }
  let dependencies = {...runtime.sdk, ...policy, ReaderWindowCoordinator: {metrics: () => metrics}, PageBackBar: HeaderLeaf, AppTopBar: HeaderLeaf, MainTabBar: HeaderLeaf};
  const hooks = {...runtime.hooks, mountChildren: true, childSources: {...headers, ReaderStandardPage: sharedSource}};
  const Standard = createReaderBuilderProbe(sharedSource, boundedMembers(sharedSource), dependencies, hooks).Component;
  dependencies = {...dependencies, ReaderStandardPage: class extends Standard {
    constructor(owner, params, storage, id, ...rest) { super(owner, params, storage, id, ...rest); this.params = {...params}; }
  }};
  // Each real production page build creates its actual standard owner. Only
  // business/header leaf painting is opaque to this horizontal-frame proof;
  // no public frame, Scroll, policy or Area callback is substituted.
  for (const [name, source, variant, _builder] of standardBindings.filter(row=>row[0]===caseNames[selectedCase])) {
    const tree = parse(source), declaration = tree.statements.find(node => node.members?.some(member => member.name?.text === 'build') && node.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword));
    const builders = declaration.members.filter(member => ts.getAllDecorators(member).some(decorator => decorator.getText(tree) === '@Builder')).map(member => member.name.text);
    const parameters = declaration.members.filter(member => ts.getAllDecorators(member).some(decorator => decorator.getText(tree) === '@BuilderParam')).map(member => member.name.text);
    const scrollerOwners = declaration.members.filter(member => ts.isPropertyDeclaration(member) && member.name?.text.endsWith('Scroller')).map(member => member.name.text);
    const {Component} = createReaderBuilderProbe(source, ['build', ...parameters, ...scrollerOwners], dependencies, hooks);
    for (const width of [320, 360, 365.71, 390, 600, 720, 760, 840]) for (const [left, right] of [[0, 0], [48, 14]]) for (const unit of [false, true]) {
      metrics = new ReaderWindowMetricsSnapshot(new ReaderRectVp(0, 0, width, 900), undefined, new ReaderInsetsVp(left, 0, right, 0));
      const page = new Component(undefined, {});
      Object.assign(page, {activeSection: variant === 'settingsHome' ? 'home' : 'general', showOverlay: false});
      for (const builder of [...builders, ...parameters]) page[builder] = () => {};
      page.initialRender();
      const standard = [...page.children.values()].find(child => child.params?.variant === variant);
      assert.ok(standard?.nodes, name + ': actual page build mounts its finite shared Scroll owner');
      const host = [...standard.nodes.values()].find(node => typeof node.onAreaChange === 'function'); assert.ok(host);
      const scroll = [...standard.nodes.values()].find(node => node.type === 'Scroll'), scroller = standard.scroller; assert.ok(scroll);
      if (scrollerOwners.length) assert.ok(scrollerOwners.some(key => page[key] === scroller), name + ': the shared Scroll retains its existing page-owned Scroller');
      const hostWidth = Math.min(304, width);
      host.onAreaChange({}, {width: unit ? `${hostWidth}vp` : hostWidth}); runtime.flush();
      assert.equal(standard.viewportWidth, hostWidth, 'actual public Area receipt uses the narrow host rather than the larger window');
      
      for (const measuredWidth of [hostWidth, width]) {
        host.onAreaChange({}, {width: unit ? `${measuredWidth}vp` : measuredWidth}); runtime.flush();
        const frame = policy.readerStandardPageContentFrame(variant, metrics, measuredWidth);
        assert.ok(frame.width>=0&&frame.left>=0&&frame.right>=0);assert.ok(frame.left+frame.width+frame.right<=measuredWidth+1e-6,'resolved frame remains within measured host');
        const column = [...standard.nodes.values()].find(node => node.type === 'Column' && node.padding?.top !== undefined); assert.ok(column);
        assert.deepEqual([column.padding.left, column.padding.right], [frame.left, frame.right], name + ': emitted Scroll content consumes actual asymmetric shared geometry');
        assert.equal(standard.nodes.get(scroll.id), scroll); assert.equal(standard.scroller, scroller);
        assert.equal(scroll.create, scroller, 'width publication retains the original native Scroll/scroller');
      }
    }
  }
}

if(selectedCase==='empty-card'){
for (const width of [200, 280, 352, 390]) {
  const sdk=boundedSurfaceSdk();let imports=0,searches=0;
  const card=sdk.consumer(emptyCard,undefined,{}, {cardWidth:width,onImportRequested:()=>imports++,onSearchRequested:()=>searches++});
  card.initialRender();assert.ok(sdk.nodes(card).some(node=>node.width===width),'actual parent width constrains the content-state family');
  assert.ok(sdk.nodes(card).some(node=>node.type==='Flex'&&node.create.wrap==='FlexWrap.Wrap'&&node.width==='100%'),'actions reflow within the bounded card');
  const actions=sdk.walk(card).filter(actor=>actor instanceof sdk.deps.ReaderRecoveryAction);
  assert.equal(actions.length,2);for(const action of actions){const hit=sdk.nodes(action).find(node=>node.onClick);assert.equal(hit.constraintSize.maxWidth,'100%');hit.onClick();}
  assert.deepEqual([imports,searches],[1,1]);
}

}
else{
const chosen=standardBindings.find(row=>row[0]===caseNames[selectedCase]);proveStandardBinding(...chosen.slice(0,4));checkSharedWidths();const legacy=standardSource.replace('readerPageAreaLength(next.width)','Number(next.width)');assert.notEqual(legacy,standardSource);assert.throws(()=>checkSharedWidths(legacy),/actual public Area receipt/);const [name,source,variant,builder]=chosen,changed=source.replace(`content: (): void => { this.${builder}(); }`,'content: (): void => {}');assert.notEqual(changed,source);assert.throws(()=>proveStandardBinding(name,changed,variant,builder),/AssertionError/);
}

}
