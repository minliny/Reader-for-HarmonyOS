import {switchSpecs} from './lib/reader-switch-control-probe.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { foundationControls } from './lib/reader-foundation-control-probe.mjs';
import { boundedMembers } from './lib/bounded-surface-sdk-probe.mjs';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { READER_FLOATING_TOP_BAR_HEIGHT, readerFloatingBarBottomInset } from './lib/reader-floating-bar-metrics-probe.mjs';
import { ReaderWindowMetricsSnapshot, ReaderRectVp, ReaderInsetsVp, readerInteractiveSafeLeft, readerInteractiveSafeRight } from '../entry/src/main/ets/features/common/ReaderWindowMetrics.ts';

const require = createRequire(import.meta.url);
const sdk = process.env.READER_ETS_LOADER_ROOT ?? '/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
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
for (const [file, bottom] of cases) {
  const source = readFileSync(new URL(`../entry/src/main/ets/features/${file}`, import.meta.url), 'utf8');
  const builders = [...source.matchAll(/@Builder\s+private (\w+)\(/g)].map(match => match[1]);
  for (const name of builders) require(`${sdk}/lib/component_map.js`).CUSTOM_BUILDER_METHOD.add(name);
  const isDetail = file === 'rss/RssEntryDetailPage.ets';
  const methods = ['build'];
  if (builders.includes('backBar')) methods.push('backBar');
  if (file.endsWith('RssSubscriptionEditorPage.ets')) methods.push('saveAction');
  if (isDetail) methods.push('bottomActions', 'actionAreaBottomOffset');
  else methods.push('bottomContentInset');
  const controls=foundationControls(),headerSource=readFileSync(new URL('../entry/src/main/ets/features/common/PageBackBar.ets',import.meta.url),'utf8'),toggleSource=readFileSync(new URL('../entry/src/main/ets/features/common/ReaderToggle.ets',import.meta.url),'utf8');
  const hooks={...controls.hooks,childSources:{...controls.hooks.childSources,PageBackBar:headerSource,ReaderToggle:toggleSource}},platform={...controls.dependencies,...switchSpecs(),AccessibilityRoleType:{SWITCH:'AccessibilityRoleType.SWITCH'},readerInteractiveSafeLeft,readerInteractiveSafeRight,ReaderWindowCoordinator:{metrics:()=>metrics}};
  const ts=require(sdk+'/node_modules/typescript'),options=require(sdk+'/lib/ets_checker.js').compilerOptions;
  const headerTree=ts.createSourceFile('PageBackBar.ets',headerSource,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,options),headerDecl=headerTree.statements.find(n=>ts.isStructDeclaration(n));
  const slots=new Set(headerDecl.members.filter(n=>ts.isPropertyDeclaration(n)&&ts.getAllDecorators(n).some(d=>d.expression.getText(headerTree)==='BuilderParam')).map(n=>n.name.text));assert.deepEqual([...slots],['trailing']);syntax.builderParamObjectCollection.set('PageBackBar',slots);
  const Header=createReaderBuilderProbe(headerSource,boundedMembers(headerSource),platform,hooks).Component,Toggle=createReaderBuilderProbe(toggleSource,boundedMembers(toggleSource),platform,hooks).Component;
  const { Component } = createReaderBuilderProbe(source, methods, {
    ...platform,PageBackBar: Header, ReaderToggle: Toggle, ReaderWindowCoordinator: { metrics: () => metrics },
    READER_FLOATING_TOP_BAR_HEIGHT, readerFloatingBarBottomInset, RSS_DETAIL_ACTION_AREA_HEIGHT: 62,
    TOK_SPACE_XS: 8, TOK_SPACE_SM: 12, TOK_SPACE_MD: 16, TOK_SPACE_LG: 24,
  },hooks);
  for (const [width, height, left, right] of [[365, 320, 19, 19], [390, 844, 32, 24], [1280, 800, 280, 280]]) {
    for (const safeBottom of [0, 24, 48]) {
      metrics = new ReaderWindowMetricsSnapshot(new ReaderRectVp(0, 0, width, height), undefined,
        new ReaderInsetsVp(0, 0, 0, safeBottom));
      const frame = { width: width - left - right, left, right };
      const owner = new Component(); const calls = [];
      for (const name of builders) if (!methods.includes(name)) owner[name] = () => {};
      Object.assign(owner, { appThemeScheme: 'day', readerWindowMetricsRevision: 1, contentFrame: () => frame,
        snapshot: { statusMessage: '状态', busy: false, canSave:true, mode: 'create', enabled: false, enabledCookieJar: false,
          batchCheck: { phase: 'idle' }, editorSourceId: '' },
        item: { link: 'https://example.com/article' }, items: [], favoriteState: 'notFavorited',
        summaryParagraphs: () => [], hasOriginalLink: () => true,
        batchControlsRenderKey: () => 'idle', batchProgressRenderKey: () => 'idle',
        onBack: () => calls.push('back'), onOpenOriginal: () => calls.push('original'),
        onSave: () => calls.push('save'), onEnabledChanged: () => calls.push('enabled'),
        onEnabledCookieJarChanged: () => calls.push('cookie') });
      owner.initialRender();
      const nodes = controls.nodes(owner);
      assert.equal(nodes[0].type, 'Stack', file);
      assert.equal(nodes[0].create.alignContent, 'Alignment.TopStart', file);
      assert.deepEqual([nodes[0].width, nodes[0].height], ['100%', '100%'], file);
      const scroll = nodes.find(node => node.type === 'Scroll');
      assert.deepEqual([scroll.width, scroll.height, scroll.layoutWeight], ['100%', '100%', undefined], file);
      assert.equal(scroll.padding?.top, undefined, `${file}: top clearance must move with content rather than shrink the viewport`);
      const content = nodes.find(node => node.type === 'Column' && node.padding?.top === 66);
      const offset = isDetail ? Math.max(0, safeBottom - 8) : 0;
      assert.equal(content.padding.bottom, isDetail ? bottom + offset : Math.max(bottom, safeBottom),
        `${file}: the last content stays above the current interactive safe bottom`);
      const header = [...owner.children.values()].find(child => child instanceof Header);
      assert.ok(header,'actual shared header is SDK mounted, not a shape-only child');
      assert.ok(header.id > scroll.id, `${file}: the shared header is mounted above the full scroll`);
      [...header.nodes.values()].find(n=>n.type==='Stack'&&n.onClick).onClick(); assert.deepEqual(calls, ['back'], `${file}: return routing remains unchanged`);
      if (isDetail) {
        const footer = nodes.find(node => node.type === 'Stack' && node.create.alignContent === 'Alignment.Bottom');
        assert.deepEqual([footer.width, footer.height], ['100%', '100%']);
        assert.deepEqual(footer.padding, { bottom: offset });
        assert.equal(footer.align, undefined, 'the parent Stack owns bottom positioning');
        assert.equal(footer.hitTestBehavior, 'HitTestMode.Transparent');
        const actions = nodes.find(node => node.type === 'Row' && node.height === 62);
        assert.equal(actions.hitTestBehavior, 'HitTestMode.Transparent');
        assert.equal(actions.backgroundColor, undefined); assert.equal(actions.linearGradient, undefined);
        nodes.find(node => node.type === 'Text' && node.create === '打开原文').onClick();
        assert.deepEqual(calls, ['back', 'original']);
      }
      if (file.endsWith('RssSubscriptionEditorPage.ets')) {
        nodes.find(node => node.type === 'Text' && node.create === '保存').onClick();
        assert.deepEqual(calls, ['back', 'save'], 'moving the viewport preserves the editor save intent');
        const toggles = [...owner.children.values()].filter(child => child instanceof Toggle);
        assert.ok(toggles.every(c=>c.nodes instanceof Map&&[...c.nodes.values()].some(n=>n.onClick)),'actual SDK Toggle native action is mounted');
        assert.equal(toggles.length, 2, 'editor text columns retain their horizontal weight beside both toggles');
        assert.equal([...owner.nodes.values()].filter(node => node.type === 'Column' && node.layoutWeight === 1).length, 2);
      }
      for (const scheme of ['night', 'day']) { owner.appThemeScheme = scheme; controls.flush(owner); }
    }
  }
}
const scope = readFileSync(new URL('../entry/src/main/ets/app/ReaderProductScope.ts', import.meta.url), 'utf8');
assert.match(scope, /function configuredReaderProductProfile\(\): ReaderProductProfile \{\s*return 'l0';/,
  'floating layout corrections must not enable deferred RSS or Sync surfaces');
console.log('PASS real SDK 8 secondary floating-header pages: narrow/short/asymmetric/wide frames, RSS footer safe offsets/transparent overlays and routing/editor callbacks; native gestures and compositor remain unverified');
