import { mangaDirectoryAdaptiveFields, mangaDirectoryAdaptiveMembers, mangaDirectoryAdaptiveDependencies } from './lib/manga-directory-adaptive-probe.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { createArkUIPropertyRuntimeProbe } from './lib/arkui-property-runtime-probe.mjs';
import { mangaSurfaceSdkDependencies } from './lib/manga-surface-sdk-probe.mjs';
import { boundedMembers } from './lib/bounded-surface-sdk-probe.mjs';
import { mangaDirectoryDisplay } from '../entry/src/main/ets/features/manga/MangaDirectoryDisplay.ts';
import * as fonts from '../entry/src/main/ets/features/common/ReaderFontFamilies.ts';

const source = readFileSync(new URL('../entry/src/main/ets/features/manga/MangaReadingSurface.ets', import.meta.url), 'utf8');
const footerSource = readFileSync(new URL('../entry/src/main/ets/features/manga/MangaDirectoryCurrentFooter.ets', import.meta.url), 'utf8');
const names = [...mangaDirectoryAdaptiveFields, ...mangaDirectoryAdaptiveMembers, 'directoryCurrentChapterIndex', 'directoryEntries', 'directoryPanel', 'directoryTools', 'directoryCurrentFooter', 'directoryCurrentTitle', 'directoryCurrentIndex', 'directoryCurrentPagePosition', 'directoryBody', 'directoryFallback', 'adjacentChapter',
  'selectAdjacentChapter', 'pageOrdinal', 'accentColor', 'mutedColor', 'inkColor', 'lineColor',
  'directoryFontScale', 'directoryToolHeight', 'directoryHeaderChrome', 'directoryInitialWidth', 'directoryQuickHeight',
  'directoryColumnWidth', 'windowInteractiveInsets', 'interactiveInsets', 'panelInsets', 'controlsPresentedForWindow', 'persistentDirectory', 'panelContentInset', 'panelWidth'];
function fixture({ current = 71, night = false, stale = false, candidate = source } = {}) {
  const properties = createArkUIPropertyRuntimeProbe();
  const dependencies = { ...mangaDirectoryAdaptiveDependencies, ...properties.sdk, ...mangaSurfaceSdkDependencies, ...fonts, mangaDirectoryDisplay };
  const hooks = { ...properties.hooks, childSources: { MangaDirectoryCurrentFooter: footerSource }, mountChildren: true };
  dependencies.MangaDirectoryCurrentFooter = createReaderBuilderProbe(footerSource, boundedMembers(footerSource), dependencies, hooks).Component;
  const probe = createReaderBuilderProbe(candidate, names, dependencies, hooks);
  const owner = probe.owner, events = [];
  const entries = [
    { index: 41, title: '卷组', navigable: false, url: '' },
    { index: 55, title: '40 下', navigable: true, url: 'chapter-55' },
    { index: 71, title: '41 上', navigable: true, url: 'chapter-71' },
    { index: 80, title: '暂不可读', navigable: false, url: 'disabled' },
    { index: 94, title: '41 下', navigable: true, url: 'chapter-94' },
  ];
  Object.assign(owner, {
    sourceId: 'source', bookId: 'book', title: 'book · chapter', backgroundPreference: night ? 'ink' : 'paper',
    remoteSession: { contentKind: 'manga', identity: { sourceId: stale ? 'other' : 'source', bookId: 'book' }, entries },
    controller: { chapter: { chapterIndex: current, manifest: { chapter: { sourceId: 'source', bookId: 'book', chapterId: `chapter-${current}` } } }, totalPages: 24 },
    horizontal: false, displayedPage: 4, panelPhase: 'open', panel: 'directory', chapterEnd: false,
    directoryQuery: '', directoryAscending: true, directoryRevision: 0, directoryOpenRevision: 2,
    publishedManifestVersion: 4, downloadEnabled: true, isReaderIdentityCurrent: () => true, stageWidth: 390, viewportWidth: 390,
    stageHeight: 844, viewportHeight: 844, error: '', openingRetry: false, recovering: false,
    loginRequiredForControls: false, controlsVisible: false, windowChromeOverlayActive: false,
    windowMetricsRevision: 0, quickHeaderMeasured: 0, quickToolsMeasured: 0, quickFooterMeasured: 0,
    directoryEntries: () => entries, widePanel: () => false, panelContentHeight: () => 610,
    performPanelAction: async action => { events.push('close-panel'); action(); },
    turnBoundaryChapter: async direction => { events.push(['chapter', direction]); return ''; },
    onDirectory: () => events.push('full-directory'),
  });
  const walk = owner => [owner, ...[...owner.children.values()].flatMap(child => child.nodes ? walk(child) : [])];
  return { owner, events, nodes: () => walk(owner).flatMap(child => [...child.nodes.values()]) };
}

for (const night of [false, true]) {
  const f = fixture({ night });
  f.owner.directoryTools();
  const actions = f.nodes().filter(node => ['上一章节', '完整目录', '下一章节'].includes(node.accessibilityText));
  assert.equal(actions.length, 3, 'SDK compiled toolbar has all three reachable actions');
  assert.ok(actions.every(node => node.constraintSize.minHeight === 38));
  assert.equal(actions[0].enabled, true);
  assert.equal(actions[2].enabled, true);
  actions[0].onClick(); actions[1].onClick(); actions[2].onClick();
  assert.deepEqual(f.events, ['close-panel', ['chapter', -1], 'close-panel', 'full-directory', 'close-panel', ['chapter', 1]],
    'adjacent targets and full directory retain the existing panel action transaction');
  const footer = fixture({ night });
  footer.owner.directoryCurrentFooter();
  assert.ok(footer.nodes().some(node => node.create === '41 上'), 'canonical current title survives sparse chapter indexes');
  assert.ok(footer.nodes().some(node => node.create === '5 / 24 页'), 'footer reads current controller page position');
  assert.equal(footer.nodes().find(node => node.accessibilityText === '当前阅读位置').constraintSize.minHeight, 48,
    'actual shared footer owns its minimum height; native natural measured height is not simulated');
}
const boundary = fixture({ current: 55 }); boundary.owner.directoryTools();
assert.equal(boundary.nodes().find(node => node.accessibilityText === '上一章节').enabled, false,
  'non-readable group cannot create a previous chapter');
const stale = fixture({ stale: true }); stale.owner.directoryTools();
assert.equal(stale.nodes().find(node => node.accessibilityText === '下一章节').enabled, false,
  'stale session never supplies adjacent targets');
assert.equal(stale.owner.directoryCurrentTitle(), 'book · chapter', 'a replaced source cannot supply the current footer title');
const body = fixture(); body.owner.directoryBody(false);
const quick = [...body.owner.children.values()][0].params;
assert.equal(quick.mangaQuickDisplay, true, 'production v2 renderer receives bounded quick display');
assert.equal(quick.mangaInitialViewportWidth, 354, 'before the first area callback the actual phone owner supplies its 390−18×2 inner width');
assert.equal(quick.mangaRowMinHeight, 58, 'named entries retain the demo row minimum');
function quickWidthClass(candidate = source) {
  for (const [stageWidth, viewportWidth, wide, paneWidth, expected] of [
    [365, 333, false, 330, false],
    [320, 300, false, 330, true],
    [0, 333, false, 330, true],
    [390, 360, false, 330, false],
    [1100, 940, true, 330, true],
    [1100, 940, true, 400, false],
  ]) {
    for (const builder of ['directoryBody', 'directoryFallback']) {
      const f = fixture({ candidate });
      f.owner.stageWidth = stageWidth; f.owner.viewportWidth = viewportWidth;
      f.owner.widePanel = () => wide; f.owner.panelWidth = () => paneWidth;
      f.owner[builder](false);
      const child = [...f.owner.children.values()][0].params;
      assert.equal(child.mangaCatalogNarrow, expected,
        `${builder}: phone whole-window365/photo333 preserves false; unknown stage uses viewport; wide uses its actual pane`);
      assert.equal(child.currentChapterIndex, 71, 'width class does not alter the canonical current index');
    }
  }
}
quickWidthClass();
const wrongPhoneWidth = source.replaceAll('(this.stageWidth > 0 ? this.stageWidth : this.viewportWidth) <= visual.narrowWidth', 'this.viewportWidth <= 340');
assert.notEqual(wrongPhoneWidth, source);
assert.throws(() => quickWidthClass(wrongPhoneWidth), /phone whole-window365\/photo333/, 'photo viewport instead of whole-window negative rejected');
const catalog = fixture(); catalog.owner.directoryBody(true);
assert.equal([...catalog.owner.children.values()][0].params.mangaQuickDisplay, false,
  'persistent full catalog stays paged');
const short = fixture(); short.owner.panelContentHeight = () => 300; short.owner.directoryBody(false);
assert.ok(short.nodes().find(node => node.type === '__Common__').height <= 85,
  'short phone leaves room for the title, three-action toolbar, current footer and bottom padding');
// The frozen CSS body has three flow children, hence two independent gaps.
function quickFlow(candidate = source) {
  const f = fixture({ candidate });
  f.owner.directoryPanel();
  const panel = f.nodes().find(node => node.type === 'Column' && node.padding?.bottom === 24);
  assert.equal(panel?.create?.space, 17, 'SDK flow separates tools/list and list/footer by17');
  // The shared footer has no additional margin: the parent gap owns spacing.
  assert.ok(!f.nodes().some(node => node.margin?.top === 17), 'no duplicate footer margin');
  f.owner.panelContentHeight = () => 300;
  assert.equal(f.owner.directoryQuickHeight(), 67, '300 minus30 handle/41 header/56 tools/48 footer/two17 gaps/24 padding leaves67vp of directory');
  return f;
}
quickFlow();
for (const [name, before, after] of [
  ['missing tools-to-list gap', 'Column({ space: visual.quickGap }) {', 'Column() {'],
  ['duplicated footer gap', "}.width('100%');\n  }\n\n  private onDirectoryMetricsChanged", "}.width('100%').margin({ top: visual.quickGap });\n  }\n\n  private onDirectoryMetricsChanged"],
  ['only one budget gap', '+ mangaDirectoryQuickFlowGaps() +', '+ visual.quickGap +'],
]) {
  assert.ok(source.includes(before), name + ' target exists');
  assert.throws(() => quickFlow(source.replace(before, after)), undefined, name + ' negative control rejected');
}

// A failed chapter may still expose the same book's Core-confirmed saved
// display position. Exercise the real admission policy, never seed its map.
const presentation = mangaSurfaceSdkDependencies.MangaBookPresentation;
const savedIdentity = { sourceId: 'source', bookId: 'book', chapterId: 'chapter-71' };
const savedPage = { pageId: 'saved-page', ordinal: 4 };
const savedChapter = { chapterIndex: 71, chapterTitle: '41 上',
  manifest: { chapter: savedIdentity, manifestVersion: 'saved-manifest', pages: [savedPage] } };
const savedLocation = { chapter: savedIdentity, manifestVersion: 'saved-manifest',
  pageId: savedPage.pageId, pageOrdinalFallback: 4, progressRevision: 1 };
presentation.clear('source', 'book');
assert.equal(presentation.admitConfirmedLocation('source', 'book', savedLocation, savedChapter, 24), true);
const failedBody = fixture(); failedBody.owner.controller = undefined; failedBody.owner.title = '';
assert.equal(failedBody.owner.directoryCurrentIndex(), 71);
assert.equal(failedBody.owner.directoryCurrentTitle(), '41 上');
assert.equal(failedBody.owner.directoryCurrentPagePosition(), '5 / 24 页');
failedBody.owner.directoryBody(false);
assert.equal([...failedBody.owner.children.values()][0].params.currentChapterIndex, 71,
  'complete Quick initially locates the confirmed saved chapter when its body fails');
const otherBook = fixture(); otherBook.owner.controller = undefined; otherBook.owner.bookId = 'other-book';
assert.equal(otherBook.owner.directoryCurrentIndex(), -1, 'display facts never cross book identity');
assert.equal(otherBook.owner.directoryCurrentPagePosition(), '');
const live = fixture({ current: 94 });
assert.equal(live.owner.directoryCurrentIndex(), 94, 'live controller takes precedence over saved chapter');
assert.equal(live.owner.directoryCurrentTitle(), '41 下');
assert.equal(presentation.admitProgress('source', 'book', { location: savedLocation }), true);
assert.equal(failedBody.owner.directoryCurrentIndex(), -1, 'bare progress does not certify a chapter index');
assert.equal(failedBody.owner.directoryCurrentPagePosition(), '', 'bare progress cannot reuse an old total');
function catalogCurrent(candidate = source) {
  const f = fixture({ candidate }); f.owner.controller = undefined; f.owner.title = '';
  f.owner.directoryCurrentChapterIndex = 71;
  delete f.owner.directoryEntries; // Execute actual canonical-session projection.
  assert.equal(f.owner.directoryCurrentIndex(), 71, 'same-book admitted readable catalog current is a display fallback');
  assert.equal(f.owner.directoryCurrentTitle(), '41 上');
  assert.equal(f.owner.directoryCurrentPagePosition(), '', 'catalog current never manufactures a page total');
  f.owner.directoryBody(false);
  assert.equal([...f.owner.children.values()][0].params.currentChapterIndex, 71,
    'actual SDK Quick child initially receives the host catalog current after body failure');
  const events = f.events.length; f.owner.directoryCurrentFooter();
  assert.ok(f.nodes().some(node => node.create === '41 上'), 'the real shared footer paints the admitted current title');
  assert.equal(f.events.length, events, 'display fallback does not dispatch a reading/save/navigation action');
  return f;
}
catalogCurrent();
for (const mutate of [
  owner => { owner.remoteSession = { ...owner.remoteSession, identity: { sourceId: 'foreign', bookId: 'book' } }; },
  owner => { owner.remoteSession = { ...owner.remoteSession, requiresContextRefresh: true }; },
  owner => { owner.directoryCurrentChapterIndex = 199; },
  owner => { owner.directoryCurrentChapterIndex = 41; },
  owner => { owner.directoryCurrentChapterIndex = 80; },
  owner => { owner.isReaderIdentityCurrent = () => false; },
]) {
  const f = fixture(); f.owner.controller = undefined; f.owner.title = ''; f.owner.directoryCurrentChapterIndex = 71;
  delete f.owner.directoryEntries; mutate(f.owner);
  assert.equal(f.owner.directoryCurrentIndex(), -1, 'foreign/missing/group/disabled/obsolete catalog cannot certify current');
  assert.equal(f.owner.directoryCurrentTitle(), ''); assert.equal(f.owner.directoryCurrentPagePosition(), '');
}
{
  const f = fixture(); f.owner.controller = undefined; f.owner.remoteSession = undefined; f.owner.title = '';
  f.owner.directoryCurrentChapterIndex = 94; f.owner.directoryProjection = [{ index: 94, title: '已准入本书目录', navigable: true }];
  assert.equal(f.owner.directoryCurrentIndex(), 94); assert.equal(f.owner.directoryCurrentTitle(), '已准入本书目录');
  assert.equal(f.owner.directoryCurrentPagePosition(), '', 'a retained projected row contributes no page facts');
  f.owner.isReaderIdentityCurrent = () => false;
  assert.equal(f.owner.directoryCurrentIndex(), -1, 'same-book projection requires the current reader identity callback');
}
const omittedCurrent = source.replace('return this.directoryCurrentCatalogEntry(this.directoryCurrentChapterIndex)?.index ?? -1;', 'return -1;');
assert.notEqual(omittedCurrent, source);
assert.throws(() => catalogCurrent(omittedCurrent), /admitted readable catalog current/, 'missing host fallback negative rejected');
presentation.clear('source', 'book');

console.log('manga directory quick panel SDK: PASS; actual flow two17 gaps, one source budget, live/rich-confirmed/catalog current display after body failure, no guessed page total, same-book/obsolete/group guards, whole-window phone narrow class and retained business callbacks; five omitted-rule negatives rejected');
