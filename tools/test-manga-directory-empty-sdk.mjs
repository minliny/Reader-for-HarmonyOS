import {selectContractCases, recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions = {"empty-list-clear-action": {"description": "实际空目录deferred ListItem与清除搜索动作", "resources": []}};
for (const id of selectContractCases(definitions)) {
  await runSelectedCase(id);
  recordContractCasePass(id);
}
async function runSelectedCase(selectedCase) {
const { resolveEtsLoaderRoot, virtualFilePath } = await import('./lib/tool-environment.mjs');
const {default: assert} = await import('node:assert/strict');
const { readFileSync } = await import('node:fs');
const { createRequire, stripTypeScriptTypes } = await import('node:module');
const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
const { createArkUIPropertyRuntimeProbe } = await import('./lib/arkui-property-runtime-probe.mjs');
const { boundedMembers, boundedSurfaceSdk } = await import('./lib/bounded-surface-sdk-probe.mjs');
const { sameReaderDirectoryData, snapshotReaderDirectoryData } = await import('../entry/src/main/ets/features/reading/ReaderDirectoryDataSnapshot.ts');
const fonts = await import('../entry/src/main/ets/features/common/ReaderFontFamilies.ts');
const { MANGA_DIRECTORY_VISUAL: visual, mangaDirectoryColor } = await import('../entry/src/main/ets/features/manga/MangaDirectoryVisual.ts');


const read = path => readFileSync(new URL(`../entry/src/main/ets/${path}.ets`, import.meta.url), 'utf8');
const listSource = read('features/reading/ReaderDirectoryList');
const pageSource = read('features/bookshelf/BookDirectoryPage');
const stateSource = read('features/common/ReaderPageState');
const require = createRequire(import.meta.url);
const sdk = resolveEtsLoaderRoot();
const ts = require(`${sdk}/node_modules/typescript`);
const tree = ts.createSourceFile(virtualFilePath('MangaEmptyList.ets'), listSource, ts.ScriptTarget.Latest, true,
  ts.ScriptKind.ETS, require(`${sdk}/lib/ets_checker.js`).compilerOptions);
assert.equal(tree.parseDiagnostics.length, 0);
const dataSourceDeclaration = tree.statements.find(node => node.name?.getText(tree) === 'DirectoryListDataSource');
const DirectoryListDataSource = new Function('sameReaderDirectoryData', 'snapshotReaderDirectoryData',
  `${stripTypeScriptTypes(dataSourceDeclaration.getText(tree))}; return DirectoryListDataSource;`)
  (sameReaderDirectoryData, snapshotReaderDirectoryData);
class ChildrenMainSize { constructor(size) { this.childDefaultSize = size; } }
const names = ['mangaFlatList', 'mangaEmptyState', 'mangaFontScale', 'mangaContentTopInset', 'mangaListBottomClearance',
  'searchDraft', 'searchQuery', 'catalogMessage', 'catalogBusy', 'catalogLoading', 'catalogRetryVisible', 'mangaToolsHeight', 'readerWindowMetricsRevision', 'onMangaMetricsChanged'];

function check(candidate = pageSource, listCandidate = listSource, exhaustive = true) {
  for (const scheme of exhaustive ? ['day', 'night'] : ['night']) for (const scale of exhaustive ? [1, 3.2] : [3.2]) {
    const properties = createArkUIPropertyRuntimeProbe();
    // Invoke the SDK-emitted lazy ListItem deep-render callback explicitly.
    // The platform owns when it is invoked; no layout/compositor is simulated.
    const shared = boundedSurfaceSdk({ properties });
    const actualState = shared.consumer(stateSource, boundedMembers(stateSource)).constructor;
    const deps = { ...shared.deps, ...properties.sdk, ...fonts, ReaderPageState: actualState, DirectoryListDataSource, ChildrenMainSize,
      ViewStackProcessor: { StartGetAccessRecordingFor() {}, StopGetAccessRecording() {} },
      ReaderWindowCoordinator: { metrics: () => ({ systemFontScale: scale }) } };
    const actualList = createReaderBuilderProbe(listCandidate, boundedMembers(listCandidate), deps, properties.hooks).Component;
    const { owner } = createReaderBuilderProbe(candidate, names, { ...deps, ReaderDirectoryList: actualList },
      { ...properties.hooks, childSources: { ReaderDirectoryList: listCandidate, ReaderPageState: stateSource }, mountChildren: true });
    const searches = [];
    Object.assign(owner, { appThemeScheme: scheme, searchDraft: '找不到', searchQuery: '找不到', catalogMessage: '',
      mangaToolsHeight: 175, readerWindowMetricsRevision: 0, mounted: false,
      contentFrame: () => ({ left: 20, right: 20, width: 280 }), topInset: () => 24,
      mangaLayoutEntries: () => [], mangaFlowFooter: () => true, mangaBottomClearance: () => 82,
      emptyMessage: () => '没有匹配章节', applySearch() { searches.push(this.searchDraft); },
      onListFirstLayout() {}, onMangaScrollOffset() {}, onListUserScroll() {}, mangaFlatRow() {} });
    owner.mangaFlatList('source\0book');
    const list = [...owner.children.values()].find(child => child.nodes);
    assert.ok(list, 'mount the real SDK-compiled shared List rather than a child stub');
    const viewport = [...list.nodes.values()].find(node => node.type === 'List');
    assert.equal(viewport.contentStartOffset, owner.mangaContentTopInset());
    assert.equal(viewport.padding.top, 0, 'natural manga clearance stays inside scroll content');
    assert.equal(viewport.contentEndOffset, 82);
    const item = [...list.nodes.values()].find(node => node.type === 'ListItem');
    assert.ok(item, 'empty manga is an actual scroll-content item');
    assert.equal(typeof item.create[0], 'function', 'actual SDK emits the deferred native empty slot');
    item.create[0](item.id, true);
    const allOwners = current => [current, ...[...current.children.values()].filter(child => child.nodes).flatMap(allOwners)];
    const allNodes = () => allOwners(owner).flatMap(current => [...current.nodes.values()]);
    const message = allNodes().find(node => node.type === 'Text' && node.create === '没有匹配章节');
    assert.ok(message, 'the native ListItem callback mounts the actual page empty builder');
    assert.ok(Number.isFinite(message.fontSize));assert.ok(Number.isFinite(message.lineHeight));
    assert.equal(message.fontFamily, fonts.READER_FONT_NOTO_SANS_SC_UI_600);
    const empty = [...owner.nodes.values()].find(node => node.type === 'Column');
    assert.deepEqual(empty.constraintSize, { minHeight: visual.quietEmptyMinHeight });

    const action = allOwners(owner).find(child => child instanceof shared.deps.ReaderRecoveryAction && child.label === '清除搜索');
    assert.ok(action, 'the message family keeps the existing clear-search operation');
    const clear = [...action.nodes.values()].find(node => node.onClick);
    assert.equal(clear.constraintSize.minHeight, 44); assert.equal(clear.enabled, true);
    clear.onClick(); assert.deepEqual(searches, [''], 'the visible clear action publishes through the existing business callback');

    for (const [naturalRowHeight, entries, expectedSlots] of [[false, [], 0], [true, [{ index: 7, title: '第1话' }], 0]]) {
      const control = new actualList(undefined, { naturalRowHeight, entries, rowBuilder() {} });
      control.initialRender();
      assert.equal([...control.nodes.values()].filter(node => node.type === 'ListItem').length, expectedSlots,
        'standard novel empty and nonempty manga receive no additional empty ListItem');
    }
  }
}
check();
for (const [label, page, list] of [
  ['missing actual empty slot', pageSource, listSource.replace('this.naturalRowHeight && this.entries.length === 0', 'false')],
  ['lost business clear callback', pageSource.replaceAll("this.searchDraft = ''; this.applySearch();", "this.searchDraft = '';"), listSource],
  ['novel receives manga slot', pageSource, listSource.replace('this.naturalRowHeight && this.entries.length === 0', 'this.entries.length === 0')],
  ['empty loses clear operation', pageSource.replaceAll("? '清除搜索'", "? ''"), listSource],
]) {
  assert.ok(page !== pageSource || list !== listSource, label);
  assert.throws(() => check(page, list, false), assert.AssertionError, `reject ${label}`);
}
console.log('PASS actual SDK full fallback empty: Page → shared List → deferred ListItem → actual empty builder, scroll-content clearance, day/night message typography and scale1–3.2, visible business clear in shared message action, standard novel zero extra slot; four regressions rejected. Native List scheduling/layout remain target evidence.');

}
