import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, stripTypeScriptTypes } from 'node:module';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { createArkUIPropertyRuntimeProbe } from './lib/arkui-property-runtime-probe.mjs';
import { boundedMembers } from './lib/bounded-surface-sdk-probe.mjs';
import { sameReaderDirectoryData, snapshotReaderDirectoryData } from '../entry/src/main/ets/features/reading/ReaderDirectoryDataSnapshot.ts';
import * as fonts from '../entry/src/main/ets/features/common/ReaderFontFamilies.ts';
import { MANGA_DIRECTORY_VISUAL as visual, mangaDirectoryColor } from '../entry/src/main/ets/features/manga/MangaDirectoryVisual.ts';

const read = path => readFileSync(new URL(`../entry/src/main/ets/${path}.ets`, import.meta.url), 'utf8');
const listSource = read('features/reading/ReaderDirectoryList');
const pageSource = read('features/bookshelf/BookDirectoryPage');
const require = createRequire(import.meta.url);
const sdk = process.env.READER_ETS_LOADER_ROOT ?? '/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const ts = require(`${sdk}/node_modules/typescript`);
const tree = ts.createSourceFile('/tmp/MangaEmptyList.ets', listSource, ts.ScriptTarget.Latest, true,
  ts.ScriptKind.ETS, require(`${sdk}/lib/ets_checker.js`).compilerOptions);
assert.equal(tree.parseDiagnostics.length, 0);
const dataSourceDeclaration = tree.statements.find(node => node.name?.getText(tree) === 'DirectoryListDataSource');
const DirectoryListDataSource = new Function('sameReaderDirectoryData', 'snapshotReaderDirectoryData',
  `${stripTypeScriptTypes(dataSourceDeclaration.getText(tree))}; return DirectoryListDataSource;`)
  (sameReaderDirectoryData, snapshotReaderDirectoryData);
class ChildrenMainSize { constructor(size) { this.childDefaultSize = size; } }
const names = ['mangaFlatList', 'mangaEmptyState', 'mangaFontScale', 'mangaContentTopInset', 'mangaListBottomClearance',
  'searchDraft', 'searchQuery', 'mangaToolsHeight', 'readerWindowMetricsRevision', 'onMangaMetricsChanged'];

function check(candidate = pageSource, listCandidate = listSource, exhaustive = true) {
  for (const scheme of exhaustive ? ['day', 'night'] : ['night']) for (const scale of exhaustive ? [1, 3.2] : [3.2]) {
    const properties = createArkUIPropertyRuntimeProbe();
    // Invoke the SDK-emitted lazy ListItem deep-render callback explicitly.
    // The platform owns when it is invoked; no layout/compositor is simulated.
    const deps = { ...properties.sdk, ...fonts, DirectoryListDataSource, ChildrenMainSize,
      ViewStackProcessor: { StartGetAccessRecordingFor() {}, StopGetAccessRecording() {} },
      ReaderWindowCoordinator: { metrics: () => ({ systemFontScale: scale }) } };
    const actualList = createReaderBuilderProbe(listCandidate, boundedMembers(listCandidate), deps, properties.hooks).Component;
    const { owner } = createReaderBuilderProbe(candidate, names, { ...deps, ReaderDirectoryList: actualList },
      { ...properties.hooks, childSources: { ReaderDirectoryList: listCandidate }, mountChildren: true });
    const searches = [];
    Object.assign(owner, { appThemeScheme: scheme, searchDraft: '找不到', searchQuery: '找不到',
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
    const message = [...owner.nodes.values()].find(node => node.type === 'Text' && node.create === '没有匹配章节');
    assert.ok(message, 'the native ListItem callback mounts the actual page empty builder');
    assert.equal(message.fontSize, visual.quietEmptyFontSize); assert.equal(message.lineHeight, visual.quietEmptyLineHeight);
    assert.equal(message.fontFamily, fonts.READER_FONT_NOTO_SANS_SC_UI_REGULAR);
    assert.equal(message.fontColor, mangaDirectoryColor('muted', scheme));
    assert.equal(message.maxFontScale, scale, 'fp line boxes are scaled once by ArkUI');
    const empty = [...owner.nodes.values()].find(node => node.type === 'Column');
    assert.deepEqual(empty.constraintSize, { minHeight: visual.quietEmptyMinHeight });
    assert.deepEqual(empty.padding, { left: 12, right: 12, top: 36, bottom: 36 });
    const clear = [...owner.nodes.values()].find(node => node.type === 'Text' && node.create === '清除搜索');
    assert.equal(clear.opacity, 1); assert.equal(clear.focusable, true);
    assert.deepEqual(clear.focusBox, { strokeWidth: { value: visual.focusWidth, unit: 'vp' },
      strokeColor: { color: mangaDirectoryColor('accent', scheme) }, margin: { value: visual.focusMargin, unit: 'vp' } },
    'the real shared platform modifier binds the empty clear action to the same focus/press contract');
    assert.equal(typeof clear.onClick, 'function'); clear.onClick();
    assert.deepEqual(searches, [''], 'the visible clear action publishes through the existing business callback');

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
  ['lost business clear callback', pageSource.replace(".onClick((): void => { this.searchDraft = ''; this.applySearch(); });", ".onClick((): void => { this.searchDraft = ''; });"), listSource],
  ['novel receives manga slot', pageSource, listSource.replace('this.naturalRowHeight && this.entries.length === 0', 'this.entries.length === 0')],
  ['empty clear loses visual feedback', pageSource.replaceAll('.attributeModifier(new MangaDirectoryPressFeedback(true, true, this.appThemeScheme))', ''), listSource],
]) {
  assert.ok(page !== pageSource || list !== listSource, label);
  assert.throws(() => check(page, list, false), assert.AssertionError, `reject ${label}`);
}
console.log('PASS actual SDK full fallback empty: Page → shared List → deferred ListItem → actual empty builder, scroll-content clearance, day/night quiet typography and scale1–3.2, visible business clear with shared feedback/focus, standard novel zero extra slot; four regressions rejected. Native List scheduling/layout remain target evidence.');
