import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { READER_FLOATING_TOP_BAR_HEIGHT, readerFloatingBarBottomInset } from './lib/reader-floating-bar-metrics-probe.mjs';
import { ReaderWindowMetricsSnapshot, ReaderRectVp, ReaderInsetsVp } from '../entry/src/main/ets/features/common/ReaderWindowMetrics.ts';

const require = createRequire(import.meta.url);
const sdk = process.env.READER_ETS_LOADER_ROOT ?? '/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const syntax = require(`${sdk}/lib/validate_ui_syntax.js`);
class Child { constructor(owner, params, _storage, id) { Object.assign(this, { owner, params, id }); } }
for (const name of ['PageBackBar', 'ReaderToggle']) {
  syntax.componentCollection.customComponents.add(name);
  syntax.propCollection.set(name, new Set(['title', 'titleColor', 'onBack', 'value', 'onToggle']));
}
syntax.builderParamObjectCollection.set('PageBackBar', new Set(['trailing']));
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
  if (isDetail) methods.push('bottomActions', 'actionAreaBottomOffset');
  else methods.push('bottomContentInset');
  const { Component } = createReaderBuilderProbe(source, methods, {
    PageBackBar: Child, ReaderToggle: Child, ReaderWindowCoordinator: { metrics: () => metrics },
    READER_FLOATING_TOP_BAR_HEIGHT, readerFloatingBarBottomInset, RSS_DETAIL_ACTION_AREA_HEIGHT: 62,
    TOK_SPACE_XS: 8, TOK_SPACE_SM: 12, TOK_SPACE_MD: 16, TOK_SPACE_LG: 24,
  });
  for (const [width, height, left, right] of [[365, 320, 19, 19], [390, 844, 32, 24], [1280, 800, 280, 280]]) {
    for (const safeBottom of [0, 24, 48]) {
      metrics = new ReaderWindowMetricsSnapshot(new ReaderRectVp(0, 0, width, height), undefined,
        new ReaderInsetsVp(0, 0, 0, safeBottom));
      const frame = { width: width - left - right, left, right };
      const owner = new Component(); const calls = [];
      for (const name of builders) if (!methods.includes(name)) owner[name] = () => {};
      Object.assign(owner, { appThemeScheme: 'day', readerWindowMetricsRevision: 1, contentFrame: () => frame,
        snapshot: { statusMessage: '状态', busy: false, mode: 'create', enabled: false, enabledCookieJar: false,
          batchCheck: { phase: 'idle' }, editorSourceId: '' },
        item: { link: 'https://example.com/article' }, items: [], favoriteState: 'notFavorited',
        summaryParagraphs: () => [], hasOriginalLink: () => true,
        batchControlsRenderKey: () => 'idle', batchProgressRenderKey: () => 'idle',
        onBack: () => calls.push('back'), onOpenOriginal: () => calls.push('original'),
        onSave: () => calls.push('save'), onEnabledChanged: () => calls.push('enabled'),
        onEnabledCookieJarChanged: () => calls.push('cookie') });
      owner.initialRender();
      const nodes = [...owner.nodes.values()];
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
      const header = [...owner.children.values()].find(child => child.params.title !== undefined);
      assert.ok(header.id > scroll.id, `${file}: the shared header is mounted above the full scroll`);
      header.params.onBack(); assert.deepEqual(calls, ['back'], `${file}: return routing remains unchanged`);
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
        const toggles = [...owner.children.values()].filter(child => child.params.onToggle);
        assert.equal(toggles.length, 2, 'editor text columns retain their horizontal weight beside both toggles');
        assert.equal(nodes.filter(node => node.type === 'Column' && node.layoutWeight === 1).length, 2);
      }
      for (const scheme of ['night', 'day']) { owner.appThemeScheme = scheme; owner.replay(); }
    }
  }
}
const scope = readFileSync(new URL('../entry/src/main/ets/app/ReaderProductScope.ts', import.meta.url), 'utf8');
assert.match(scope, /function configuredReaderProductProfile\(\): ReaderProductProfile \{\s*return 'l0';/,
  'floating layout corrections must not enable deferred RSS or Sync surfaces');
console.log('PASS real SDK 8 secondary floating-header pages: narrow/short/asymmetric/wide frames, RSS footer safe offsets/transparent overlays and routing/editor callbacks; native gestures and compositor remain unverified');
