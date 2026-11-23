import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, registerHooks } from 'node:module';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';
registerHooks({ resolve(specifier, context, next) {
  try { return next(specifier, context); }
  catch (error) { if (specifier.startsWith('.') && !specifier.endsWith('.ts')) return next(specifier + '.ts', context); throw error; }
} });
const { boundedSurfaceSdk } = await import('./lib/bounded-surface-sdk-probe.mjs');
const { resolveEtsLoaderRoot } = await import('./lib/tool-environment.mjs');
const syntax = createRequire(import.meta.url)(resolveEtsLoaderRoot() + '/lib/validate_ui_syntax.js');
const { actualReaderPageLayout } = await import('./lib/reader-page-shell-runtime-probe.mjs');
const { readerTypographyRoles } = await import('./lib/reader-typography-probe.mjs');
const { readerFoundationTokens } = await import('./lib/reader-tokens-probe.mjs');
const { projectOperationFacts } = await import('../entry/src/main/ets/app/ReaderOperationFacts.ts');
const { readerRecoveryView } = await import('../entry/src/main/ets/app/ReaderRecoveryProjection.ts');
const { createDefaultReaderWindowMetrics } = await import('../entry/src/main/ets/ui/foundation/ReaderWindowMetrics.ts');
const { ReaderPageGeometryInput, resolveReaderPageGeometry } = await import('../entry/src/main/ets/ui/layout/ReaderPageGeometry.ts');
const selected = selectContractCases({
  'scroll-owner': { description: 'Actual RSS and management callers delegate one virtual native List to StandardPage, retaining current inset/frame updates and natural row declarations', resources: [] },
  'default-scroll': { description: 'Actual StandardPage default Scroll and original business slot remain available after optional native-list support', resources: [] },
});
const root = new URL('../entry/src/main/ets/', import.meta.url);
const source = path => readFileSync(new URL(path, root), 'utf8');
const emptyRead = projectOperationFacts({ phase: 'succeeded', value: [] });
const metrics = createDefaultReaderWindowMetrics();
metrics.windowRect.width = 366; metrics.windowRect.height = 844;
const deps = { ...actualReaderPageLayout(), ...readerTypographyRoles, ...readerFoundationTokens, projectOperationFacts, readerRecoveryView,
  ReaderWindowCoordinator: { metrics: () => metrics }, readerWindowMetrics: () => metrics, registerReaderFonts() {} };
const geometry = (width, header) => {
  const input = new ReaderPageGeometryInput(metrics);
  input.viewportWidth = width; input.viewportHeight = 844; input.headerHeight = header;
  input.contentGap = 8; input.contentHorizontalPadding = 19;
  return resolveReaderPageGeometry(input);
};
for (const id of selected) {
  if (id === 'scroll-owner') {
    for (const [name, listMethod, rowMethod, props] of [
      ['RssSourceFeedPage', 'entryList', 'entryRow', { subscription: { subscriptionId: 's', title: '来源', enabled: true },
        items: [{ subscriptionId: 's', guid: 'a', title: '文章', author: '作者', read: false }], readFacts: emptyRead }],
      ['RssSubscriptionManagementPage', 'subscriptionList', 'subscriptionItem', {
        items: [{ subscriptionId: 's', title: '来源', meta: '订阅', enabled: true }], readFacts: emptyRead }],
    ]) {
      const sdk = boundedSurfaceSdk();
      sdk.hooks.childSources.PageBackBar = source('ui/chrome/PageBackBar.ets');
      assert.match(sdk.hooks.childSources.PageBackBar, /@BuilderParam trailing\?: \(\) => void/);
      syntax.builderParamObjectCollection.set('PageBackBar', new Set(['trailing']));
      sdk.deps.PageBackBar = class {
        constructor(_owner, params) { this.params = params; }
        updateStateVars(params) { this.params = params; }
        initialRender() {}
      };
      const text = source('features/rss/ui/' + name + '.ets');
      // An explicit native range requests one row from the full projection.
      // This port checks declaration wiring, without implementing virtual layout.
      const Repeat = data => {
        let generate;
        return { each(action) { generate = action; return this; }, key() { return this; },
          virtualScroll(options) { assert.equal(options.reusable, true); return this; },
          render() { if (data.length > 0) generate({ item: data[0], index: 0 }); } };
      };
      let itemId = 100000;
      let materializing = false;
      const ListItem = new Proxy({}, { get(_target, member) { return (...args) => {
        if (member === 'create' && typeof args[0] === 'function' && !materializing) {
          materializing = true;
          try { args[0](itemId++, true); } finally { materializing = false; }
        }
      }; } });
      const ViewStackProcessor = { StartGetAccessRecordingFor() {}, StopGetAccessRecording() {} };
      const owner = sdk.consumer(text, ['build', listMethod], { ...deps, Repeat, ListItem, ViewStackProcessor }, props);
      let prefix = 0, rows = 0;
      Object.assign(owner, props, { pageContent: () => prefix++, pageHeader() {}, backBar() {},
        [rowMethod]: () => rows++ });
      owner.initialRender(); sdk.properties.flush();
      const standard = [...owner.children.values()].find(child => child.scrollOwner === 'native-list');
      assert.ok(standard, 'the actual caller selects native-list ownership');
      const lists = [...standard.nodes.values()].filter(node => node.type === 'List');
      assert.equal(lists.length, 1); assert.equal(lists[0].height, '100%');
      assert.equal(sdk.nodes(owner).filter(node => node.type === 'Scroll').length, 0, 'there is no surrounding standard Scroll');
      assert.equal(prefix, 1); assert.equal(rows, 1);
      for (const [width, header] of [[320, 58], [366, 116]]) {
        const next = geometry(width, header);
        standard.geometry = next; sdk.properties.flush();
        assert.equal(lists[0].contentStartOffset, next.content.startInset, 'retained Builder content consumes current header clearance');
        assert.equal(lists[0].contentEndOffset, next.content.endInset);
        assert.deepEqual(lists[0].padding, { left: next.content.frame.left, right: next.content.frame.right });
        assert.equal(prefix, 1, 'geometry changes retain the prefix actor');
      }
      assert.equal([...owner.nodes.values()].filter(node => node.type === 'List').length, 0,
        'the geometry-owning StandardPage also owns the actual List observer');
      assert.equal(lists[0].create.scroller, standard.scroller);
      assert.match(text, /\.virtualScroll\(\{ reusable: true \}\)/);
      assert.doesNotMatch(text, /\.height\(Math\.min\((480|520)/, 'item count cannot estimate the List viewport');
      const row = text.slice(text.indexOf('private ' + rowMethod + '('), text.indexOf('\n  @Builder', text.indexOf('private ' + rowMethod + '(') + 1));
      assert.doesNotMatch(row, /\.height\((56|64|72|92)\)/, 'text row owns its natural2x height');
    }
  } else {
    const sdk = boundedSurfaceSdk();
    const owner = sdk.consumer(source('ui/layout/ReaderStandardPage.ets'), undefined, deps);
    let content = 0;
    Object.assign(owner, { content: () => content++ });
    owner.aboutToAppear(); owner.initialRender(); sdk.properties.flush();
    assert.equal(owner.scrollOwner, 'page');
    assert.equal(sdk.nodes(owner).filter(node => node.type === 'Scroll').length, 1);
    assert.equal(content, 1);
  }
  console.log('PASS RSS native-list ' + id + ' with actual SDK declarations; no native execution');
  recordContractCasePass(id);
}
