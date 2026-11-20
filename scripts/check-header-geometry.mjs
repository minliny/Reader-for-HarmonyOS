#!/usr/bin/env node
// Explicit page-geometry/motion contract check. Not referenced by builds, CI,
// contract tiers, scopes or other gates; run it only for a stated need.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const usage = 'Usage: node scripts/check-header-geometry.mjs --rationale <item-specific reason> [--checks <comma-separated IDs>] [--json]';
const args = process.argv.slice(2);
const rationaleIndex = args.indexOf('--rationale');
const checksIndex = args.indexOf('--checks');
if (rationaleIndex < 0 || !args[rationaleIndex + 1]?.trim() || args[rationaleIndex + 1].startsWith('--') ||
    (checksIndex >= 0 && (!args[checksIndex + 1]?.trim() || args[checksIndex + 1].startsWith('--'))) ||
    args.some((arg, index) => arg !== '--rationale' && arg !== '--checks' && arg !== '--json' &&
      index !== rationaleIndex + 1 && (checksIndex < 0 || index !== checksIndex + 1))) {
  console.error(usage);
  process.exit(2);
}
const rationale = args[rationaleIndex + 1].trim();
const json = args.includes('--json');
const selectedChecks = checksIndex < 0 ? undefined : new Set(args[checksIndex + 1].split(',').map((id) => id.trim()).filter(Boolean));
if (selectedChecks !== undefined && selectedChecks.size === 0) {
  console.error(usage);
  process.exit(2);
}

const file = (path) => readFileSync(resolve(root, path), 'utf8');
const count = (source, needle) => source.split(needle).length - 1;
const has = (source, needle) => source.includes(needle);
const compact = (source) => source.replace(/\s+/g, ' ').trim();
const numericField = (source, name) => {
  const match = source.match(new RegExp(`readonly\\s+${name}\\s*:\\s*number\\s*=\\s*(\\d+(?:\\.\\d+)?)\\s*;`));
  assert.ok(match, `${name}: numeric declaration is missing`);
  return Number(match[1]);
};
const block = (source, startNeedle, endNeedle) => {
  const start = source.indexOf(startNeedle);
  assert.ok(start >= 0, `missing block start: ${startNeedle}`);
  const end = source.indexOf(endNeedle, start + startNeedle.length);
  assert.ok(end > start, `missing block end: ${endNeedle}`);
  return source.slice(start, end);
};
const sourceFiles = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
  const path = resolve(dir, entry.name);
  return entry.isDirectory() ? sourceFiles(path) : [path];
});
const appSources = sourceFiles(resolve(root, 'entry/src/main/ets'))
  .filter((path) => path.endsWith('.ets') || path.endsWith('.ts'));

const metrics = file('entry/src/main/ets/features/common/ReaderHeaderMetrics.ts');
const specs = file('entry/src/main/ets/features/common/ReaderHeaderSpecs.ets');
const appTopBar = file('entry/src/main/ets/features/common/AppTopBar.ets');
const pageBackBar = file('entry/src/main/ets/features/common/PageBackBar.ets');
const pageShell = file('entry/src/main/ets/features/common/ReaderPageShell.ts');
const scaffold = file('entry/src/main/ets/features/common/ReaderPageScaffold.ets');
const standardPage = file('entry/src/main/ets/features/common/ReaderStandardPage.ets');
const motionSpec = file('entry/src/main/ets/features/common/MotionSpec.ets');
const motionPolicy = file('entry/src/main/ets/features/common/ReaderMotionPolicy.ets');
const launchTimeline = file('entry/src/main/ets/features/reading/ReaderSessionLaunchTimeline.ts');
const launchPresentation = file('entry/src/main/ets/features/reading/ReaderSessionLaunchPresentation.ts');
const ttsWaveform = file('entry/src/main/ets/features/reading/ReaderTtsWaveformModel.ts');
const productTiming = file('entry/src/main/ets/features/common/ProductMotionTiming.ts');
const pageSettlement = file('entry/src/main/ets/features/reading/ReaderPageSettlementTimeline.ts');
const widthClass = file('entry/src/main/ets/features/common/ReaderWidthClass.ts');
const surfaceResolvers = file('entry/src/main/ets/features/common/ReaderSurfaceResolvers.ts');
const surfaceSpecs = file('entry/src/main/ets/features/common/ReaderSurfaceSpecs.ets');
const index = file('entry/src/main/ets/pages/Index.ets');
const entryAbility = file('entry/src/main/ets/entryability/EntryAbility.ets');
const shelfShell = file('entry/src/main/ets/features/bookshelf/BookshelfShell.ets');
const shelfPage = file('entry/src/main/ets/features/bookshelf/BookshelfPage.ets');
const fullDirectory = file('entry/src/main/ets/features/reading/ReaderFullDirectory.ets');
const downloadPage = file('entry/src/main/ets/features/downloads/SharedDownloadPage.ets');
const sourceManagement = file('entry/src/main/ets/features/source/SourceManagementPage.ets');
const multiSelect = file('entry/src/main/ets/features/bookshelf/BookshelfMultiSelectPage.ets');
const directoryList = file('entry/src/main/ets/features/reading/ReaderDirectoryList.ets');
const directoryNavList = file('entry/src/main/ets/features/reading/ReaderDirectoryNavigationList.ets');
const frameStyle = file('entry/src/main/ets/features/common/ReaderFrameStyle.ts');
const panelMotion = file('entry/src/main/ets/features/reading/ReaderPanelMotionContract.ts');
const importMotion = file('entry/src/main/ets/features/bookshelf/LocalImportMotion.ts');
const scrollLayout = file('entry/src/main/ets/features/common/ReaderScrollLayout.ts');
const scrollHost = file('entry/src/main/ets/features/common/ReaderPageScrollHost.ets');
const mainTabShell = file('entry/src/main/ets/features/shell/MainTabShell.ets');
const readerShell = file('entry/src/main/ets/features/shell/ReaderShell.ets');
const bookDetail = file('entry/src/main/ets/features/bookshelf/LocalBookDetail.ets');
const bookDirectoryPage = file('entry/src/main/ets/features/bookshelf/BookDirectoryPage.ets');
const directoryToolbar = file('entry/src/main/ets/features/reading/ReaderDirectoryToolbar.ets');
const searchPage = file('entry/src/main/ets/features/search/SearchPage.ets');
const importDialog = file('entry/src/main/ets/features/bookshelf/LocalImportDialog.ets');
const mangaSurface = file('entry/src/main/ets/features/manga/MangaReadingSurface.ets');
const mangaEntryRow = file('entry/src/main/ets/features/manga/MangaDirectoryEntryRow.ets');
const sourceWindow = file('entry/src/main/ets/features/source/SourceSwitchWindow.ets');
const controlSearch = file('entry/src/main/ets/features/reading/ReaderControlSearchContent.ets');
const toast = file('entry/src/main/ets/features/common/ReaderTransientToast.ets');
const appearancePanel = file('entry/src/main/ets/features/reading/ReaderAppearanceFullPanel.ets');
const mangaLayout = file('entry/src/main/ets/features/manga/MangaLayoutPolicy.ts');

const results = [];
function check(id, fn) {
  if (selectedChecks !== undefined && !selectedChecks.has(id)) {
    results.push({ id, status: 'NOT_RUN' });
    return;
  }
  try {
    fn();
    results.push({ id, status: 'PASS' });
  } catch (error) {
    results.push({ id, status: 'FAIL', error: error.message });
  }
}

check('bookshelf-opening-geometry-and-clock', () => {
  const geometry = file('entry/src/main/ets/features/bookshelf/BookshelfNavigationMotion.ts');
  const transition = file('entry/src/main/ets/features/bookshelf/BookshelfNavigationTransition.ets');
  assert.ok(has(geometry, 'export function bookshelfMotionRectAt('));
  assert.ok(has(geometry, 'return request.target;'));
  assert.doesNotMatch(geometry, /bookshelfMotionCanvas|bookshelfMotionPagePose|sourceScale|magnification/);
  assert.ok(has(transition, 'ReversibleMotionTimeline'));
  assert.ok(has(transition, 'const pose = bookshelfMotionTransformAt(request, carry, this.imageAspect);'));
  assert.ok(has(transition, '.width(this.layoutWidth).height(this.layoutHeight)'));
  assert.doesNotMatch(transition, /\.width\(this\.actorWidth\)|\.height\(this\.actorHeight\)/);
  assert.ok(has(transition, 'centerX: 0'));
  assert.ok(has(transition, 'this.coverAngle = -78 * turn - 18 * handoff;'));
  assert.ok(has(transition, 'this.onReaderOpacity(request.id, carry);'));
  assert.ok(has(transition, 'this.onReaderOpacity(request.id, openProgress);'));
  const coverVisual = file('entry/src/main/ets/features/bookshelf/BookshelfCoverVisual.ts');
  assert.equal(count(coverVisual, 'BOOKSHELF_COVER_SHADOW_RADIUS: number = 26;'), 1);
  assert.equal(count(coverVisual, 'BOOKSHELF_COVER_SHADOW_OFFSET_Y: number = 8;'), 1);
  for (const consumer of [transition, shelfPage, multiSelect]) {
    assert.ok(has(consumer, 'BOOKSHELF_COVER_SHADOW_RADIUS'));
    assert.ok(has(consumer, 'BOOKSHELF_COVER_SHADOW_OFFSET_Y'));
    assert.doesNotMatch(consumer, /\.shadow\(\{\s*radius:\s*26/);
  }
  assert.doesNotMatch(transition, /animateTo\(|onPagePose/);
  assert.ok(has(transition, 'const TURN_START = CARRY.durationMs / 2;'));
  assert.ok(has(transition, 'const COVERED_TIME = CARRY.durationMs;'));
  for (const name of ['carry', 'turn', 'handoff', 'fade']) {
    assert.ok(has(motionSpec, `id: 'bookshelf.open.${name}'`));
  }
  assert.doesNotMatch(motionSpec, /bookshelf\.(?:open|close)\.(?:flight|reveal)/);
  assert.ok(has(geometry, 'export function shelfMotionWindowRect('));
  assert.equal(count(index, 'shelfMotionWindowRect(viewport)'), 2);
  assert.ok(has(index, 'reversed: true'));
  assert.ok(has(transition, 'next.reversed && !this.reversed && !this.fading'));
  assert.ok(has(transition, 'this.timeline.retarget(false, now);'));
  assert.doesNotMatch(index, /shelfMotionPageFallback|shelfMotionPageIdentity|measureShelfMotionPage|backfillShelfMotionPage/);
  assert.ok(has(index, '.opacity(this.shelfOpeningReaderOpacity)'));
  assert.ok(has(index, 'this.receiveShelfOpeningReaderOpacity(id, opacity)'));
  assert.doesNotMatch(index, /snapshot\.reduceMotion\s*===\s*true\)\s*this\.clearShelfNavigationMotion/);
  assert.doesNotMatch(index, /shelfOpeningPagePose|onPagePose/);
});

check('search-surface-mounted-owner', () => {
  const surface = file('entry/src/main/ets/features/search/ReaderLibrarySearchSurface.ets');
  const scaffoldBuild = block(scaffold, 'build() {', 'Stack({ alignContent: Alignment.Bottom })');
  const shelfBinding = block(index, 'private bookshelfShellContent(', 'private searchPageContent()');
  const searchBinding = block(index, 'private searchPageSurface(', 'private isCurrentSearchPresentation(');
  assert.equal(count(surface, 'ReaderFixedHeaderHost({'), 1);
  assert.equal(count(surface, 'private transitionKind: SearchSurfaceTransition'), 1);
  assert.equal(count(surface, 'private readonly historyTrack: SurfaceValueTrack'), 1);
  assert.equal(count(surface, 'private readonly historyLimitTrack: SurfaceValueTrack'), 1);
  assert.doesNotMatch(surface, /new ReversibleMotionTimeline/);
  assert.ok(has(shelfBinding, 'BookshelfShell({'));
  assert.ok(has(searchBinding, 'SearchPage({'));
  assert.ok(has(searchBinding, 'externalHeaderHeight: this.librarySearchHeaderBottom'));
  assert.ok(has(shelfShell, 'headerVisible: false'));
  assert.ok(has(searchPage, 'headerVisible: false'));
  assert.ok(has(scaffoldBuild, 'if (this.headerVisible)'));
  assert.ok(has(index, "this.route === 'bookshelf' || this.route === 'search' || this.retainsShelfOpeningBackground()"));
  assert.ok(has(surface, 'readerPresentedHeaderBottom(bookshelfHeaderSpec().topInset, height)'));
  assert.ok(has(surface, 'key !== this.measurementKey'));
});

check('search-surface-source-single-owner', () => {
  // The mounted-host check above is weaker than the requested migration:
  // unmounted legacy production branches and a second filter animator are
  // still owners in source, even when the main route hides those headers.
  const surface = file('entry/src/main/ets/features/search/ReaderLibrarySearchSurface.ets');
  const remaining = [];
  if (has(shelfShell, 'AppTopBar({') || has(shelfShell, 'this.onSearchRequested(')) {
    remaining.push('BookshelfShell still owns a legacy bar/search rendering branch');
  }
  if (has(searchPage, 'private searchHeader()') || has(searchPage, 'private searchBar()')) {
    remaining.push('SearchPage still owns legacy header/bar builders');
  }
  if (has(searchPage, 'private searchHeaderHeight()') || has(searchPage, 'this.searchHeaderHeight()')) {
    remaining.push('SearchPage still owns an independent header-height fallback');
  }
  if (has(searchPage, 'model.statsHeight = this.searchStatsHeight()') ||
      has(searchPage, 'model.filterMaxHeight = this.searchFilterMaxHeight()')) {
    remaining.push('SearchPage still derives the surface filter and statistics geometry');
  }
  if (!has(surface, 'readerPresentedHeaderBottom(')) remaining.push('surface does not own header-bottom conversion');
  assert.deepEqual(remaining, [], remaining.join('; '));
});

check('single-app-bar-constant-owner', () => {
  assert.equal(count(metrics, 'export const APP_FLOATING_HEADER_BAR_HEIGHT = 52;'), 1);
  assert.equal(count(metrics, 'export const APP_HEADER_BAR_HEIGHT = 58;'), 1);
  assert.equal(count(metrics, 'export const APP_FLOATING_HEADER_TOP_GAP = 8;'), 1);
  for (const [name, source] of [['specs', specs], ['appTopBar', appTopBar], ['pageBackBar', pageBackBar],
    ['pageShell', pageShell], ['searchPage', searchPage]]) {
    assert.doesNotMatch(source, /(?:const|let|var)\s+APP_(?:FLOATING_)?HEADER_BAR_HEIGHT\s*=/, `${name}: duplicate app bar constant`);
    assert.doesNotMatch(source, /(?:const|let|var)\s+APP_FLOATING_HEADER_TOP_GAP\s*=/, `${name}: duplicate header top gap constant`);
  }
  assert.ok(has(appTopBar, "from './ReaderHeaderMetrics'"));
  assert.ok(has(appTopBar, 'readerScaledBarHeight(APP_FLOATING_HEADER_BAR_HEIGHT, 28, scale, 0)'));
  assert.ok(has(appTopBar, 'readerScaledBarHeight(APP_HEADER_BAR_HEIGHT, TYPE_APP_HOME_TITLE.lineHeightFp as number, scale, 6)'));
  assert.doesNotMatch(appTopBar, /\.height\(\s*(?:52|58)\s*\)/);
  assert.ok(has(pageShell, "from './ReaderHeaderMetrics'"));
  assert.ok(has(pageShell, 'headerHeight: number = APP_HEADER_BAR_HEIGHT'));
  assert.doesNotMatch(pageShell, /headerHeight: number = 58/);
});

check('page-back-bar-consumes-app-bar-metrics', () => {
  assert.ok(has(pageBackBar, "import { APP_FLOATING_HEADER_BAR_HEIGHT, APP_HEADER_BAR_HEIGHT } from './ReaderHeaderMetrics';"));
  const source = compact(pageBackBar);
  assert.ok(source.includes(compact('readerScaledBarHeight(APP_FLOATING_HEADER_BAR_HEIGHT, 28, this.fontScale(), 0)')));
  assert.ok(source.includes(compact('readerScaledBarHeight(APP_HEADER_BAR_HEIGHT, TYPE_PAGE_TITLE.lineHeightFp as number, this.fontScale(), 0)')));
  assert.doesNotMatch(pageBackBar, /this\.floating\s*\?\s*52\s*:\s*58/);
});

check('bookshelf-header-single-measured-owner', () => {
  assert.equal(count(specs, 'new BookshelfHeaderSpec(APP_FLOATING_HEADER_BAR_HEIGHT, APP_FLOATING_HEADER_TOP_GAP, 14)'), 1);
  assert.ok(has(specs, 'this.frameHeight = barHeight + topInset;'));
  assert.ok(has(specs, 'this.contentClearance = barHeight + topInset + contentGap;'));
  const definitions = [specs, pageShell, index].reduce((total, source) =>
    total + count(source, 'export function readerPageInitialHeaderHeight'), 0);
  assert.equal(definitions, 1, 'initial header height fallback has one definition');
  assert.equal(count(index, "@State private shelfHeaderHeight: number = readerPageInitialHeaderHeight('bookshelf');"), 1);
  assert.equal(count(index, 'this.shelfHeaderHeight = height;'), 1);
  assert.equal(count(index, 'headerBottom: this.shelfHeaderHeight'), 2,
    'both shelf route consumers receive the measured header bottom');
  assert.equal(count(shelfShell, '@Prop headerBottom: number = bookshelfHeaderSpec().frameHeight;'), 1);
  assert.equal(count(shelfPage, '@Prop headerBottom: number = bookshelfHeaderSpec().frameHeight;'), 1);
  assert.ok(has(shelfShell, 'top: this.headerBottom + bookshelfHeaderSpec().contentGap'));
  assert.ok(has(shelfPage, 'input.headerHeight = this.headerBottom;'));
  assert.ok(has(shelfPage, 'input.contentGap = bookshelfHeaderSpec().contentGap;'));
  assert.doesNotMatch(shelfShell, /@State[^\n]*headerHeight/i);
  assert.doesNotMatch(shelfPage, /@State[^\n]*headerHeight/i);
  assert.ok(has(shelfShell, 'if (Number.isFinite(height) && height > 0) this.onHeaderHeightChange(height, presentedKey);'));
});

check('scaffold-geometry-only', () => {
  assert.ok(has(scaffold, '@Prop geometry: ReaderPageGeometry;'));
  assert.ok(has(file('entry/src/main/ets/features/common/ReaderPageGeometry.ts'),
    'export function readerEmptyPageGeometry(): ReaderPageGeometry'));
  for (const scalar of ['headerTop', 'headerInsetLeft', 'headerInsetRight', 'footerInsetLeft',
    'footerInsetRight', 'footerBottom', 'contentEndInset', 'frameInsetLeft', 'frameInsetRight']) {
    assert.doesNotMatch(scaffold, new RegExp(`@Prop\\s+${scalar}\\s*:`), `scaffold scalar API returned: ${scalar}`);
  }
  for (const field of ['this.geometry.content.nativeEndInset', 'this.geometry.header.top',
    'this.geometry.header.insetLeft', 'this.geometry.footer.insetLeft',
    'this.geometry.footer.bottom', 'this.geometry.frameInsetLeft']) {
    assert.ok(has(scaffold, field), `scaffold must read ${field}`);
  }
  assert.ok(has(mainTabShell, 'geometry: this.pageGeometry(), headerMeasurementKey:'));
  assert.doesNotMatch(file('entry/src/main/ets/features/common/ReaderPageGeometry.ts'), /variant:\s*ReaderPageShellKind/);
  assert.ok(has(bookDetail, 'geometry: this.pageGeometry(),'));
  assert.ok(has(bookDirectoryPage, 'geometry: this.mangaPageGeometry(),'));
});

check('scaffold-call-site-geometry', () => {
  const calls = [];
  for (const path of appSources) {
    const content = readFileSync(path, 'utf8');
    for (const match of content.matchAll(/ReaderPageScaffold\(\{/g)) {
      calls.push({ path, tail: content.slice(match.index, match.index + 500) });
    }
  }
  assert.equal(calls.length, 14, 'ReaderPageScaffold call-site registry drifted');
  for (const call of calls) {
    assert.ok(call.tail.includes('geometry:'), `${call.path}: scaffold call must name its geometry`);
  }
  const empty = calls.filter((call) => call.tail.includes('geometry: readerEmptyPageGeometry()'));
  assert.equal(empty.length, 4, 'zero-geometry exceptions must use the named factory');
  for (const suffix of [
    'pages/Index.ets',
    'features/shell/ReaderShell.ets',
    'features/bookshelf/LocalBookDetail.ets',
    'features/bookshelf/BookDirectoryPage.ets',
  ]) {
    assert.ok(empty.some((call) => call.path.endsWith(suffix)), `missing zero-geometry exception: ${suffix}`);
  }
});

check('scaffold-header-receipt-excludes-header-top', () => {
  assert.equal(count(pageShell, 'export function readerPresentedHeaderBottom('), 1);
  assert.ok(has(pageShell, 'return Math.max(0, headerTop) + Math.max(0, headerHeight);'));
  assert.equal(count(scaffold, 'onHeaderHeightChange(height, presentedKey)'), 1,
    'the scaffold must report the measured header height unchanged');
  assert.doesNotMatch(scaffold, /height \+ this\.headerTop/);
  assert.equal(count(mainTabShell, 'readerPresentedHeaderBottom(this.headerTop, height)'), 1);
  assert.doesNotMatch(mainTabShell, /height \+ this\.headerTop/);
  assert.ok(compact(downloadPage).includes(compact(
    'readerPresentedHeaderBottom(this.headerTop(), Math.max(DOWNLOAD_VISUAL.headerHeight, this.resolvedHeaderHeight())) + this.headerContentGap()')));
  assert.doesNotMatch(downloadPage, /this\.headerTop\(\) \+ Math\.max\(DOWNLOAD_VISUAL\.headerHeight/);
});

check('detail-header-spec-consumed', () => {
  assert.ok(has(specs, 'readonly topGap: number = APP_FLOATING_HEADER_TOP_GAP;'));
  assert.ok(has(specs, 'readonly barHeight: number = APP_FLOATING_HEADER_BAR_HEIGHT;'));
  assert.equal(numericField(specs, 'contentGap'), 16);
  assert.ok(has(specs, 'return Math.max(0, topInset) + this.topGap;'));
  assert.ok(has(specs, 'return this.headerTop(topInset) + Math.max(0, measuredBarHeight) + this.contentGap;'));
  assert.ok(has(bookDetail, "import { DetailHeaderSpec, detailHeaderSpec } from '../common/ReaderHeaderSpecs';"));
  assert.ok(has(bookDetail, 'private readonly headerSpec: DetailHeaderSpec = detailHeaderSpec();'));
  assert.ok(has(bookDetail, 'private readonly headerMeasurements: ReaderMeasurementStore = new ReaderMeasurementStore();'));
  assert.ok(has(bookDetail, 'input.headerTop = this.headerSpec.headerTop(this.topInset());'));
  assert.equal(count(bookDetail, 'this.headerMeasurements.read(\'detail:header\', this.headerSpec.barHeight)'), 1);
  assert.equal(count(bookDetail, 'this.headerMeasurements.record(\'detail:header\', height, presentedKey, 0.1)'), 1);
  assert.equal(count(bookDetail, 'topInset() + 76'), 0, 'standard detail content must not re-compose the header height');
});

check('book-directory-page-header-spec-consumed', () => {
  assert.equal(count(bookDirectoryPage, 'class BookDirectoryPageHeaderSpec'), 1);
  assert.ok(has(bookDirectoryPage, 'readonly barHeight: number = APP_HEADER_BAR_HEIGHT;'));
  assert.ok(has(bookDirectoryPage, 'readonly toolbarHeight: number = READER_DIRECTORY_TOOLBAR_HEIGHT;'));
  assert.ok(has(bookDirectoryPage, 'readonly dividerHeight: number = TOK_BORDER_W;'));
  assert.equal(numericField(bookDirectoryPage, 'contentGap'), 5);
  assert.ok(has(bookDirectoryPage, 'return this.barHeight + this.toolbarHeight + this.dividerHeight;'));
  assert.equal(count(bookDirectoryPage,
    'this.standardMeasurements.read(\'bookDirectory:header\', this.standardHeaderSpec.initialHeight())'), 1);
  assert.equal(count(bookDirectoryPage,
    'this.standardMeasurements.record(\'bookDirectory:header\', height, presentedKey, 0.1)'), 1);
  assert.ok(has(bookDirectoryPage, 'this.standardDirectoryScrollLayout()'));
  assert.ok(compact(bookDirectoryPage).includes(compact(
    '.padding({ left: 20, right: 20, top: this.standardGeometry().header.bottom,')));
  assert.equal(count(bookDirectoryPage, '.height(this.standardHeaderSpec.dividerHeight)'), 1);
  assert.equal(count(bookDirectoryPage, 'recoveryGap'), 0);
  assert.equal(count(bookDirectoryPage, 'recoveryTop'), 0);
  assert.doesNotMatch(bookDirectoryPage, /standardHeaderHeight \+ 5/);
  assert.ok(has(directoryToolbar, 'export const READER_DIRECTORY_TOOLBAR_HEIGHT = 50;'));
  assert.ok(has(directoryToolbar, '.height(READER_DIRECTORY_TOOLBAR_HEIGHT)'));
  assert.doesNotMatch(directoryToolbar, /\.height\(50\)/);
});

check('standard-page-content-start-single-owner', () => {
  assert.equal(count(pageShell, 'export const READER_STANDARD_PAGE_CONTENT_GAP = 8;'), 1);
  assert.ok(has(pageShell, 'return readerPageContentStartInset(headerHeight, 0, READER_STANDARD_PAGE_CONTENT_GAP);'));
  assert.ok(has(standardPage, "import { readerPageInitialHeaderHeight } from './ReaderHeaderSpecs';"));
  assert.ok(has(standardPage, 'private readonly measurements: ReaderMeasurementStore = new ReaderMeasurementStore();'));
  assert.ok(has(standardPage, "this.measurements.read('standard:header', readerPageInitialHeaderHeight('standard'))"));
  assert.ok(has(standardPage, "this.measurements.record('standard:header', height, presentedKey)"));
  assert.ok(has(standardPage, 'overlayContent: (): void => { this.overlayContent(this.pageGeometry().content.startInset); },'));
  assert.doesNotMatch(standardPage, /readerPageContentStartInset\([^)]*,\s*8\s*\)/);
});

check('directory-header-spec-consumed', () => {
  assert.equal(numericField(specs, 'barHeight'), 54);
  assert.equal(numericField(specs, 'radius'), 24);
  assert.equal(numericField(specs, 'topGap'), 18);
  assert.equal(numericField(specs, 'panelGap'), 16);
  assert.equal(numericField(specs, 'controlHeight'), 42);
  assert.equal(numericField(specs, 'menuGap'), 2);
  assert.equal(numericField(specs, 'menuRowHeight'), 42);
  assert.ok(has(specs, 'return topInset + this.barHeight + this.panelGap;'));
  assert.ok(has(specs, 'return topInset + this.barHeight + this.menuGap;'));
  assert.ok(has(fullDirectory, "import { DirectoryHeaderSpec, directoryHeaderSpec } from '../common/ReaderHeaderSpecs';"));
  assert.ok(has(fullDirectory, 'private readonly headerSpec: DirectoryHeaderSpec = directoryHeaderSpec();'));
  assert.equal(count(fullDirectory, '.height(this.headerSpec.barHeight)'), 2);
  assert.equal(count(fullDirectory, '.height(this.headerSpec.controlHeight)'), 3);
  assert.equal(count(fullDirectory, '.borderRadius(this.headerSpec.radius)'), 1);
  assert.equal(count(fullDirectory, 'this.headerSpec.topGap'), 3);
  assert.ok(has(fullDirectory, 'this.headerSpec.panelGap'));
  assert.ok(has(fullDirectory, 'input.contentGap = this.headerSpec.panelGap;'));
  assert.ok(has(fullDirectory, 'this.headerSpec.menuTop(this.topBarTop())'));
  assert.ok(has(fullDirectory, 'this.headerMeasurements.read(this.headerMeasurementKey(), this.headerSpec.barHeight)'));
  for (const duplicate of ['.height(54)', '.height(42)', '.borderRadius(24)', 'topBarTop() + 56', 'top + 70']) {
    assert.equal(count(fullDirectory, duplicate), 0, `duplicate directory header literal returned: ${duplicate}`);
  }
});

check('download-header-single-measurement-owner', () => {
  assert.equal(count(downloadPage, 'private readonly measurements: ReaderMeasurementStore = new ReaderMeasurementStore();'), 1);
  assert.equal(count(downloadPage, "this.measurements.record('download:header'"), 1);
  assert.equal(count(downloadPage, "this.measurements.read('download:header'"), 1);
  assert.equal(count(downloadPage, "this.measurements.record('download:dock'"), 1);
  assert.equal(count(downloadPage, 'onHeaderHeightChange:'), 0,
    'the relocatable download top bar must not also consume the scaffold measurement');
  assert.ok(has(downloadPage, 'mainChromeOverflow'));
});

check('search-spec-values', () => {
  // Both BookshelfHeaderSpec and SearchHeaderSpec declare panelRadius; read the
  // search contract from its own class block so the bookshelf value cannot win.
  const searchSpec = block(specs, 'export class SearchHeaderSpec {', '\nconst SEARCH_HEADER_SPEC');
  const expected = {
    outerInsetPhone: 16,
    outerInsetTablet: 20,
    panelRadius: 18,
    panelBottomGap: 6,
    barPaddingLeft: 5,
    barPaddingRight: 6,
    barPaddingTop: 8,
    barPaddingBottom: 8,
    filterMinHeight: 44,
    filterLabelLineHeight: 17,
    filterVerticalReserve: 12,
    filterGroupBottomPadding: 8,
    filterMinExpandedHeight: 88,
    filterViewportReserve: 180,
    unmeasuredViewportHeight: 300,
    summaryMinHeight: 34,
    summaryLineHeight: 21,
    summaryStackedLineHeight: 39,
    summaryPaddingTop: 4,
    summaryPaddingBottom: 4,
    summaryStackedWidth: 158,
    statsFallbackHeight: 36,
    statsPaddingTop: 4,
    statsPaddingBottom: 4,
  };
  for (const [name, value] of Object.entries(expected)) assert.equal(numericField(searchSpec, name), value, name);
  const token = file('entry/src/main/ets/features/common/ReaderTokens.ets').match(/export const TOK_BORDER_W = (\d+);/);
  assert.ok(token, 'TOK_BORDER_W: shared token declaration is missing');
  assert.equal(Number(token[1]), 1);
  assert.ok(has(specs, 'readonly borderWidth: number = TOK_BORDER_W;'));
  assert.ok(has(specs, 'this.barHeightExtra = this.barPaddingTop + this.barPaddingBottom;'));
  assert.ok(has(specs, 'this.summaryVerticalPadding = this.summaryPaddingTop + this.summaryPaddingBottom;'));
  assert.ok(has(specs, 'this.statsVerticalPadding = this.statsPaddingTop + this.statsPaddingBottom;'));
});

check('search-pure-fallback-formula', () => {
  const source = compact(specs);
  assert.ok(source.includes(compact(`const panel = barHeight + spec.panelBottomGap + 2 * spec.borderWidth;`)));
  assert.ok(source.includes(compact('if (!hasSession) return panel;')));
  assert.ok(source.includes(compact(`const filters = filtersExpanded ? Math.min(2 * filterHeight + spec.filterGroupBottomPadding, filterMaxHeight) : 0;`)));
  assert.ok(source.includes(compact('return panel + statsHeight + filters + spec.borderWidth;')));
  // The pure formula stays in ReaderHeaderSpecs; the persistent search surface
  // is now its only header owner and the only caller of readerSearchHeaderHeight.
  const surface = file('entry/src/main/ets/features/search/ReaderLibrarySearchSurface.ets');
  assert.equal(count(surface, 'readerSearchHeaderHeight('), 1, 'surface filter cap consumes the pure formula');
  assert.ok(has(surface, "import { bookshelfHeaderSpec, searchHeaderSpec, readerSearchHeaderHeight, SearchHeaderSpec } from '../common/ReaderHeaderSpecs';"));
  assert.ok(has(surface, 'private readonly spec: SearchHeaderSpec = searchHeaderSpec();'));
  const fallback = block(surface, 'private filterMaxHeight(): number {', '\n  private captureHeader(');
  assert.ok(has(fallback, 'readerSearchHeaderHeight('));
  assert.ok(has(fallback, 'this.spec.barHeight(this.controlHeight())'));
  assert.ok(has(fallback, 'this.statsHeight()'));
  assert.equal(count(searchPage, 'readerSearchHeaderHeight('), 0, 'SearchPage must not regain a second header fallback');
  assert.doesNotMatch(searchPage, /private searchHeaderHeight/);
});

check('search-builder-consumes-spec', () => {
  const surface = file('entry/src/main/ets/features/search/ReaderLibrarySearchSurface.ets');
  const filterPanel = file('entry/src/main/ets/features/search/ReaderSearchFilterPanel.ets');
  for (const fragment of [
    '.borderRadius(this.spec.panelRadius)',
    '.border({ width: this.spec.borderWidth, color: this.panelBorderColor() })',
    'this.spec.barHeight(this.controlHeight())',
    'this.spec.outerInset(this.expandedLayout)',
    '.padding({ left: this.spec.panelInnerInset, right: this.spec.panelInnerInset })',
    'this.spec.filterMinExpandedHeight',
    'this.spec.filterViewportReserve',
    'this.spec.statsFallbackHeight',
    'this.spec.unmeasuredViewportHeight',
  ]) assert.ok(has(surface, fragment), `surface missing spec consumer: ${fragment}`);
  for (const fragment of [
    '.constraintSize({ minHeight: this.spec.filterMinHeight })',
    '.lineHeight(this.spec.filterLabelLineHeight)',
    '.padding({ top: this.spec.statsPaddingTop, bottom: this.spec.statsPaddingBottom })',
    '.padding({ bottom: this.spec.filterGroupBottomPadding })',
    '.border({ width: { top: this.spec.borderWidth },',
  ]) assert.ok(has(filterPanel, fragment), `filter panel missing spec consumer: ${fragment}`);
  assert.equal(count(filterPanel, 'this.spec.filterMinHeight'), 3);
  assert.equal(count(filterPanel, 'this.spec.filterLabelLineHeight'), 1);
  assert.equal(count(filterPanel, 'this.spec.filterGroupBottomPadding'), 1);
  assert.ok(has(searchPage, 'this.headerSpec.summaryHeight('));
  assert.equal(count(searchPage, 'this.headerSpec.summaryPaddingTop'), 1);
  assert.equal(count(searchPage, 'this.headerSpec.summaryPaddingBottom'), 1);
  for (const source of [searchPage, surface, filterPanel]) {
    for (const duplicate of ['minHeight: 44', 'lineHeight(17)', 'padding({ top: 4, bottom: 4 })']) {
      assert.equal(count(source, duplicate), 0, `duplicate header literal returned: ${duplicate}`);
    }
  }
});

check('search-filter-sheet-and-history-motion', () => {
  // Geometry and dismissal behavior are exercised by the current search
  // sheet cases. Here, distinguish the native sheet from history animation.
  const filterPanel = file('entry/src/main/ets/features/search/ReaderSearchFilterPanel.ets');
  assert.match(searchPage, /\bReaderSearchFilterPanel\s*\(/);
  assert.match(filterPanel, /\.bindSheet\s*\(/);
  assert.equal(count(motionSpec, "id: 'search.history.resize'"), 1);
  const surface = file('entry/src/main/ets/features/search/ReaderLibrarySearchSurface.ets');
  assert.ok(has(surface, "motionSpecGet('search.history.resize')"));
});

check('motion-registry-single-policy', () => {
  assert.ok(has(motionPolicy, "export const READER_REDUCE_MOTION_STORAGE_KEY: string = 'readerReduceMotion';"));
  assert.ok(has(motionPolicy, 'export function readerMotionCurve(id: string): Curve | curves.ICurve'));
  assert.ok(has(motionPolicy, 'export function readerMotionDurationMs(id: string, reduceMotion: boolean): number'));
  assert.ok(has(motionPolicy, 'export function readerMotionAnimateParam(id: string, reduceMotion: boolean, onFinish?: () => void): AnimateParam'));
  for (const source of appSources) {
    if (source.endsWith('ReaderMotionPolicy.ets')) continue;
    const content = readFileSync(source, 'utf8');
    assert.doesNotMatch(content, /AppStorage\.get(?:<boolean>)?\('readerReduceMotion'\)/,
      `${source}: read reduceMotion only through ReaderMotionPolicy`);
  }
  assert.ok(has(index, 'READER_REDUCE_MOTION_STORAGE_KEY'));
  assert.ok(has(entryAbility, 'READER_REDUCE_MOTION_STORAGE_KEY'));
  assert.ok(has(toast, 'readerReduceMotionFromStorage()'));
  // Search surface exception: its header/results geometry is measured per frame,
  // so it consumes MotionSpec on an authored reversible timeline instead of
  // AnimateParam; every track is gated by the reduceMotion prop it receives.
  const surface = file('entry/src/main/ets/features/search/ReaderLibrarySearchSurface.ets');
  assert.ok(has(surface, "motionSpecGet('search.surface.open')"));
  assert.ok(has(surface, "motionSpecGet('search.surface.submit')"));
  assert.ok(has(surface, "motionSpecGet('search.surface.back')"));
  assert.ok(has(surface, "motionSpecGet('search.history.resize')"));
  assert.ok(has(surface, 'this.reduceMotion || this.transitionKind'));
  assert.ok(has(surface, 'if (this.reduceMotion) {'));
  assert.doesNotMatch(surface, /animateTo\(|readerMotionAnimateParam\(/);
  assert.ok(has(file('entry/src/main/ets/features/reading/LocalReadingExperience.ets'), 'readerMotionAnimateParam('));
});

check('control-motion-shares-reduce-motion-policy', () => {
  assert.ok(has(motionPolicy, 'export function readerMotionValueDurationMs(durationMs: number, reduceMotion: boolean): number'));
  assert.ok(has(file('entry/src/main/ets/features/reading/ReaderControlMotionPolicy.ts'),
    'return readerMotionValueDurationMs(durationMs, reduceMotion);'));
  assert.ok(has(file('entry/src/main/ets/features/reading/ReaderControlGeometry.ts'),
    'export const READER_CONTROL_TOP_BAR_HEIGHT = 54;'));
  assert.ok(has(file('entry/src/main/ets/features/reading/ReaderControlPanel.ets'),
    'this.layout.topBarTop + READER_CONTROL_TOP_BAR_HEIGHT'));
  assert.doesNotMatch(file('entry/src/main/ets/features/reading/ReaderControlPanel.ets'), /\.height\(54\)/);
});

check('control-motion-endpoint-constants-have-one-owner', () => {
  const motionGeometry = file('entry/src/main/ets/features/reading/ReaderControlMotionGeometry.ts');
  assert.ok(has(motionGeometry, 'READER_CONTROL_BRIGHTNESS_RAIL_WIDTH'));
  assert.ok(has(motionGeometry, 'READER_CONTROL_CONTENT_PADDING_RIGHT'));
  assert.ok(has(motionGeometry, 'READER_CONTROL_HOME_TOP_ROW_HEIGHT'));
  assert.doesNotMatch(motionGeometry, /const brightnessWidth = 38/);
  assert.doesNotMatch(motionGeometry, /const brightnessRight = 13\.56/);
  assert.doesNotMatch(motionGeometry, /Math\.min\(190/);
});

check('control-motion-coefficients-named', () => {
  const motionGeometry = file('entry/src/main/ets/features/reading/ReaderControlMotionGeometry.ts');
  for (const name of [
    'READER_CONTROL_MOTION_QUICK_CONTENT_VERTICAL_RESERVE',
    'READER_CONTROL_MOTION_FULL_CONTENT_VERTICAL_RESERVE',
    'READER_CONTROL_MOTION_CONTENT_INSET_MAX',
    'READER_CONTROL_MOTION_QUICK_CONTENT_HORIZONTAL_RESERVE',
    'READER_CONTROL_MOTION_HEADER_TOP',
    'READER_CONTROL_MOTION_HEADER_HEIGHT',
    'READER_CONTROL_MOTION_CONTENT_SURFACE_TOP',
    'READER_CONTROL_MOTION_CONTENT_TOP_QUICK',
    'READER_CONTROL_MOTION_CONTENT_TOP_FULL_DELTA',
    'READER_CONTROL_MOTION_NAVIGATION_LEFT',
    'READER_CONTROL_MOTION_NAVIGATION_BOTTOM',
    'READER_CONTROL_MOTION_NAVIGATION_TRANSLATE_Y',
    'READER_CONTROL_MOTION_NAVIGATION_HORIZONTAL_INSET',
    'READER_CONTROL_MOTION_NAVIGATION_HEIGHT',
    'READER_CONTROL_MOTION_GRABBER_WIDTH',
    'READER_CONTROL_MOTION_GRABBER_TOP',
    'READER_CONTROL_MOTION_GRABBER_HEIGHT',
  ]) assert.equal(count(motionGeometry, `export const ${name} =`), 1, `missing control motion coefficient: ${name}`);
  const composition = block(motionGeometry, 'export function sampleReaderControlMotionComposition',
    'function flattenedActor');
  for (const literal of ['quickHeight - 140', 'fullHeight - 70', 'Math.min(13,', 'fullContentWidth - 52',
    'shellY + 57', 'height - 93', 'shellY + 19', 'shellY + 29', '28 * p', 'bounds.width - 24']) {
    assert.equal(count(composition, literal), 0, `unnamed control motion literal returned: ${literal}`);
  }
});

check('motion-registry-consumers', () => {
  for (const entry of [
    "{ id: 'source.switch.open', durationMs: SOURCE_SWITCH_VISUAL.openDurationMs,",
    "{ id: 'source.switch.close', durationMs: SOURCE_SWITCH_VISUAL.closeDurationMs,",
    "{ id: 'source.switch.row.enter', durationMs: SOURCE_SWITCH_VISUAL.rowEnterDurationMs,",
    "{ id: 'source.switch.list.update', durationMs: 220, curve: Curve.EaseInOut },",
    "{ id: 'manga.directory.fold', durationMs: MANGA_DIRECTORY_VISUAL.foldDuration, curve: Curve.Ease },",
    "{ id: 'manga.panel.scrim', durationMs: 160, curve: Curve.EaseInOut },",
    "{ id: 'manga.pullRefresh.reset', durationMs: 180, curve: Curve.EaseOut },",
    "{ id: 'bookshelf.import.handoff.fade', durationMs: 120,",
    "{ id: 'bookshelf.import.handoff.resize', durationMs: 220,",
    "{ id: 'bookshelf.import.handoff.reveal', durationMs: 140,",
    "{ id: 'message.feedback.enter', durationMs: 220, curve: Curve.EaseOut },",
  ]) assert.ok(has(motionSpec, entry), `missing motion entry: ${entry}`);
  for (const source of [sourceWindow, index, readerShell, downloadPage]) {
    assert.ok(has(source, "motionAnimateParam('source.switch.open')"), 'source switch open must use the registry');
    assert.ok(has(source, "motionAnimateParam('source.switch.close')"), 'source switch close must use the registry');
  }
  assert.ok(has(sourceWindow, "readerMotionAnimateParam('source.switch.list.update', this.reduceMotion)"));
  assert.ok(has(importDialog, "motionAnimateParam('bookshelf.import.handoff.fade')"));
  assert.ok(has(importDialog, "motionAnimateParam('bookshelf.import.handoff.resize')"));
  assert.ok(has(importDialog, "motionAnimateParamDelayed('bookshelf.import.handoff.reveal'"));
  assert.ok(has(mangaSurface, "motionAnimateParam('manga.panel.scrim')"));
  assert.ok(has(mangaSurface, "readerMotionDurationMs('manga.pullRefresh.reset', this.reduceMotion)"));
  for (const source of [mangaEntryRow, directoryNavList]) {
    assert.ok(has(source, "motionAnimateParam('manga.directory.fold')"));
  }
  assert.ok(has(toast, "readerMotionAnimateParam('message.feedback.enter', reduceMotion)"));
});

check('motion-actors-registry-owned', () => {
  assert.ok(has(panelMotion, "'reader.panel.appearance.header.in': { fromY: -12, delayMs: 146 }"));
  assert.ok(has(motionSpec, 'readerPanelActorPose(id)'));
  assert.doesNotMatch(motionSpec, /fromY\?:|delayMs\?:/);
  assert.doesNotMatch(motionSpec, /^\s*(fromY|delayMs):/m);
  assert.ok(has(importMotion, 'READER_LOCAL_IMPORT_HANDOFF_REVEAL_DELAY_MS = 80'));
  assert.ok(has(importDialog, 'READER_LOCAL_IMPORT_HANDOFF_REVEAL_DELAY_MS'));
  assert.ok(has(motionSpec, 'return TransitionEffect.OPACITY'));
  assert.ok(has(motionSpec, '.animation(anim);'));
  assert.doesNotMatch(motionSpec, /export function fadeSlideTransition/);
  assert.doesNotMatch(motionSpec, /export function motionRemainingDistanceAnimateParam/);
  assert.equal(count(appearancePanel, 'panelActorTransition('), 6);
  assert.doesNotMatch(appearancePanel, /panelActorTransition\('[^']+',\s*-?\d/);
  assert.ok(has(shelfPage, 'this.viewMotion.contentCurve'));
  assert.ok(has(shelfPage, 'this.viewMotion.coverFadeCurve'));
  assert.ok(has(shelfPage, 'this.viewMotion.coverMoveCurve'));
  assert.ok(has(shelfPage, 'this.viewMotion.coverScaleCurve'));
  assert.doesNotMatch(shelfPage, /private readonly view(?:Fade|Content|Move|Scale)Curve/);
});

check('no-literal-motion-durations', () => {
  for (const path of appSources) {
    const content = readFileSync(path, 'utf8');
    assert.doesNotMatch(content, /animateTo\(\{\s*duration:\s*[1-9]\d*/,
      `${path}: register the animation duration in MotionSpec`);
    assert.doesNotMatch(content, /\.animation\(\{\s*duration:\s*[1-9]\d*/,
      `${path}: register the transition duration in MotionSpec`);
  }
});

check('non-arkui-motion-clocks', () => {
  for (const line of [
    'export const READER_SESSION_LAUNCH_DURATION_MS = 3500;',
    'export const READER_SESSION_LAUNCH_FLIGHT_START_MS = 200;',
    'export const READER_SESSION_LAUNCH_FLIGHT_MS = 1200;',
    'export const READER_SESSION_LAUNCH_EXPAND_START_MS = 1700;',
    'export const READER_SESSION_LAUNCH_EXPAND_MS = 600;',
    'export const READER_SESSION_LAUNCH_SETTLED_MS = 2300;',
    'export const READER_SESSION_LAUNCH_DOT_SIZE_VP = 24;',
  ]) assert.equal(count(launchTimeline, line), 1, `missing launch beat: ${line}`);
  assert.ok(has(launchPresentation, "from './ReaderSessionLaunchTimeline.ts'"));
  assert.doesNotMatch(launchPresentation, /motionSegment\(time,\s*\d/,
    'launch sampler must consume named beats');
  assert.doesNotMatch(launchPresentation, /time\s*(?:<|>|<=|>=)\s*\d+/,
    'launch phase boundaries must consume named beats');
  assert.ok(has(launchPresentation, 'READER_SESSION_LAUNCH_DOT_SIZE_VP'));
  for (const line of [
    'export const READER_TTS_WAVEFORM_HEIGHT_MS = 300;',
    'export const READER_TTS_WAVEFORM_COLOR_MS = 350;',
    'export const READER_TTS_WAVEFORM_ACTIVE_TAIL_MS = 350;',
    'export const READER_TTS_WAVEFORM_CYCLE_BASE_MS = 650;',
    'export const READER_TTS_WAVEFORM_CYCLE_STEP_MS = 110;',
    'export const READER_TTS_WAVEFORM_STAGGER_MS = 30;',
  ]) assert.equal(count(ttsWaveform, line), 1, `missing waveform beat: ${line}`);
  assert.doesNotMatch(ttsWaveform, /elapsed \/ \d+/, 'waveform timing must use named constants');
  assert.doesNotMatch(ttsWaveform, /index \* \d+/, 'waveform stagger must use named constants');
  assert.doesNotMatch(ttsWaveform, /duration = \d+/, 'waveform cycle must use named constants');
});

check('single-width-breakpoint', () => {
  assert.equal(count(widthClass, 'export const READER_EXPANDED_MIN_WIDTH: number = 600;'), 1);
  for (const path of appSources) {
    if (path.endsWith('ReaderWidthClass.ts')) continue;
    const content = readFileSync(path, 'utf8');
    assert.doesNotMatch(content, /(?:Width|width)\s*(?:>=|<=|>|<)\s*600\b/,
      `${path}: use readerIsExpandedWidth instead of a local 600 breakpoint`);
  }
  assert.ok(has(fullDirectory, 'readerIsExpandedWidth(this.liveContainerWidth())'));
  assert.ok(has(mangaSurface, 'readerIsExpandedWidth(this.viewportWidth)'));
  assert.ok(has(mangaLayout, '!readerIsExpandedWidth(width)'));
});

check('page-settlement-timing-single-owner', () => {
  for (const line of [
    'export const READER_PAGE_SETTLE_RAPID_MS = 30;',
    'export const READER_PAGE_SETTLE_MIN_MS = 80;',
    'export const READER_PAGE_SETTLE_MAX_MS = 320;',
    'export const READER_PAGE_SETTLE_WIDTH_FACTOR = 2.5;',
  ]) assert.equal(count(productTiming, line), 1, `missing settlement constant: ${line}`);
  assert.ok(has(pageSettlement, 'READER_PAGE_SETTLE_RAPID_MS'));
  assert.ok(has(pageSettlement, 'READER_PAGE_SETTLE_MIN_MS'));
  assert.ok(has(pageSettlement, 'READER_PAGE_SETTLE_MAX_MS'));
  assert.ok(has(pageSettlement, 'READER_PAGE_SETTLE_WIDTH_FACTOR'));
  assert.doesNotMatch(pageSettlement, /rapid \? 30/);
  assert.doesNotMatch(pageSettlement, /Math\.max\(80/);
});

check('message-display-durations', () => {
  const feedback = file('entry/src/main/ets/features/common/ReaderTransientFeedback.ts');
  assert.equal(count(feedback, 'export const READER_FEEDBACK_BRIEF_MS: 2000 = 2000;'), 1);
  assert.equal(count(feedback, 'export const READER_FEEDBACK_EXTENDED_MS: 2200 = 2200;'), 1);
  assert.equal(count(feedback, 'export const READER_FEEDBACK_DEDUPE_MS: 2000 = 2000;'), 1);
  assert.ok(has(feedback, 'duration: READER_FEEDBACK_BRIEF_MS,'));
  assert.ok(has(feedback, 'duration: options.duration ?? READER_FEEDBACK_BRIEF_MS,'));
  assert.ok(has(feedback, 'options.dedupeMs ?? READER_FEEDBACK_DEDUPE_MS'));
  assert.ok(has(feedback, 'duration?: 2000 | 2200;'));
  for (const path of appSources) {
    const content = readFileSync(path, 'utf8');
    assert.doesNotMatch(content, /duration: (?:2000|2200)\b/,
      `${path}: use READER_FEEDBACK_BRIEF_MS / READER_FEEDBACK_EXTENDED_MS`);
  }
  assert.ok(has(index, 'READER_FEEDBACK_EXTENDED_MS'));
  assert.ok(has(shelfPage, 'READER_FEEDBACK_BRIEF_MS'));
});

check('frame-style-split', () => {
  assert.ok(has(frameStyle, 'export class ReaderFrameStyle'));
  assert.ok(has(frameStyle, 'export function readerFrameStyle(options: ReaderFrameStyleOptions): ReaderFrameStyle'));
  assert.ok(has(scaffold, '@Prop frameStyle: ReaderFrameStyle;'));
  for (const removed of ['@Prop variant:', '@Prop headerKind:', '@Prop readingContentKind:']) {
    assert.ok(!scaffold.includes(removed), `scaffold business kind returned: ${removed}`);
  }
  assert.doesNotMatch(pageShell, /ReaderPageShellKind|ReaderHeaderKind|ReaderHeaderSurface/);
  assert.doesNotMatch(pageShell, /TOK_DOWNLOAD_PAPER|mangaDirectoryColor|readerAppColor/);
  assert.doesNotMatch(file('entry/src/main/ets/features/common/ReaderPageGeometry.ts'), /variant:\s*ReaderPageShellKind/);
  for (const source of [mainTabShell, standardPage, searchPage, downloadPage, fullDirectory,
    bookDetail, bookDirectoryPage, multiSelect, sourceManagement, readerShell, index]) {
    assert.ok(has(source, 'frameStyle:'), 'feature host must resolve its frame style');
  }
});

check('scroll-layout-contract', () => {
  assert.ok(has(scrollLayout, 'export function readerScrollLayout(geometry: ReaderPageGeometry'));
  assert.ok(has(scrollLayout, 'export function readerScrollStartOffset(layout: ReaderScrollLayout): number'));
  assert.ok(has(scrollLayout, 'export function readerScrollEndOffset(layout: ReaderScrollLayout): number'));
  assert.ok(has(scrollHost, 'export struct ReaderPageScrollHost'));
  assert.ok(has(scrollHost, 'readerScrollTopPadding(this.layout)'));
  assert.ok(has(standardPage, 'ReaderPageScrollHost({ scroller: this.scroller, layout: this.scrollLayout()'));
  for (const [name, source] of [['search', searchPage], ['bookshelf', shelfPage],
    ['download', downloadPage], ['sourceManagement', sourceManagement], ['multiSelect', multiSelect]]) {
    assert.ok(has(source, 'private scrollLayout(): ReaderScrollLayout'), `${name}: missing scroll layout owner`);
    assert.ok(has(source, 'readerScrollStartOffset(this.scrollLayout())'), `${name}: start offset bypasses contract`);
    assert.ok(has(source, 'readerScrollEndOffset(this.scrollLayout())'), `${name}: end offset bypasses contract`);
  }
  assert.doesNotMatch(searchPage, /\.contentStartOffset\(this\.searchContentStartInset\(\)\)/);
  assert.doesNotMatch(shelfPage, /\.contentStartOffset\(this\.shelfContentStartInset\(\)\)/);
  assert.doesNotMatch(downloadPage, /\.contentStartOffset\(this\.mainChromeOverflow\(\)/);
  // The reading directory keeps its native List/Grid; those components are the
  // dedicated hosts and still own their item and anchor lifecycle.
  for (const [name, source] of [['directoryList', directoryList], ['directoryNavList', directoryNavList]]) {
    assert.ok(has(source, "@Prop scrollLayout: ReaderScrollLayout = new ReaderScrollLayout(0, 0, 'contentOffset');"),
      `${name}: dedicated host must consume the scroll layout contract`);
    assert.ok(has(source, 'readerScrollStartOffset(this.scrollLayout)'), `${name}: missing start offset helper`);
    assert.ok(has(source, 'readerScrollEndOffset(this.scrollLayout)'), `${name}: missing end offset helper`);
    assert.doesNotMatch(source, /@Prop contentStartInset/, `${name}: numeric start inset returned`);
    assert.doesNotMatch(source, /@Prop contentEndInset/, `${name}: numeric end inset returned`);
  }
  const navSurface = file('entry/src/main/ets/features/reading/ReaderDirectoryNavigationSurface.ets');
  assert.ok(has(navSurface, '@Prop scrollLayout: ReaderScrollLayout'));
  assert.ok(has(navSurface, 'scrollLayout: this.scrollLayout,'));
  assert.ok(has(bookDirectoryPage, 'scrollLayout: this.standardDirectoryScrollLayout()'));
  assert.ok(has(bookDirectoryPage, 'scrollLayout: this.mangaDirectoryScrollLayout()'));
  assert.ok(has(sourceWindow, 'private scrollLayout(): ReaderScrollLayout'));
  assert.ok(has(sourceWindow, 'readerScrollStartOffset(this.scrollLayout())'));
  assert.ok(has(sourceWindow, 'readerScrollEndOffset(this.scrollLayout())'));
  assert.doesNotMatch(sourceWindow, /\.contentStartOffset\(this\.listStartInset\(\)\)/);
  assert.ok(has(controlSearch, 'Feature scroll exception: contentEndOffsetVp is a normalized native'));
  assert.doesNotMatch(controlSearch, /import[^\n]*ReaderScrollLayout/);
});

check('reading-directory-measurement-chain', () => {
  assert.ok(has(fullDirectory, 'private readonly headerMeasurements: ReaderMeasurementStore'));
  assert.ok(has(fullDirectory, 'this.headerMeasurements.record(this.headerMeasurementKey()'));
  assert.ok(has(fullDirectory, 'input.headerHeight = this.headerMeasurements.read(this.headerMeasurementKey(), this.headerSpec.barHeight);'));
  assert.ok(has(fullDirectory, 'geometry: this.pageGeometry()'));
  assert.ok(has(fullDirectory, 'return this.pageGeometry().content.startInset;'));
  assert.doesNotMatch(fullDirectory, /readerEmptyPageGeometry/);
});

function checkFixedSizeClassification(onlyPath) {
  const manifest = JSON.parse(file('docs/architecture/fixed-size-policy-20261025.json'));
  assert.equal(manifest.kind, 'reader-fixed-size-policy');
  const allowedCategories = new Set(['design-token', 'icon', 'touch', 'feature-panel']);
  const heights = (source) => {
    const text = new Map(), other = new Map();
    let inText = false;
    for (const line of source.split('\n')) {
      if (!inText && /(^|[^A-Za-z0-9_])Text\(/.test(line)) inText = true;
      for (const match of line.matchAll(/\.height\((\d+(?:\.\d+)?)\)/g)) {
        const value = Number(match[1]);
        const target = inText ? text : other;
        target.set(value, (target.get(value) ?? 0) + 1);
      }
      if (inText && /;\s*$/.test(line)) inText = false;
    }
    return { text, other };
  };
  const compare = (path, label, expectedEntries, actual) => {
    const expected = new Map();
    for (const item of expectedEntries) {
      assert.ok(allowedCategories.has(item.category), `${path}: invalid category ${item.category}`);
      assert.notEqual(item.category, 'content-text', `${path}: content text must be dynamic`);
      expected.set(item.value, (expected.get(item.value) ?? 0) + item.count);
    }
    for (const [value, count] of actual) {
      assert.equal(expected.get(value) ?? 0, count,
        `${path}: unclassified ${label} height ${value}vp (count ${count})`);
    }
    for (const [value, count] of expected) {
      assert.equal(actual.get(value) ?? 0, count,
        `${path}: stale ${label} fixed-height manifest entry ${value}vp (count ${count})`);
    }
  };
  const entries = onlyPath === undefined ? manifest.files : manifest.files.filter(entry => entry.path === onlyPath);
  if (onlyPath !== undefined) assert.equal(entries.length, 1, `${onlyPath}: one fixed-size policy entry`);
  for (const entry of entries) {
    const actual = heights(file(entry.path));
    compare(entry.path, 'Text', entry.textHeights, actual.text);
    compare(entry.path, 'other', entry.otherHeights ?? [], actual.other);
  }
}
const ttsControlPath = 'entry/src/main/ets/features/reading/ReaderControlTtsContent.ets';
function checkTtsControlMinimums() {
  const ttsControl = file(ttsControlPath);
  assert.ok(has(ttsControl, 'constraintSize({ minHeight: 17 })'));
  assert.ok(has(ttsControl, 'constraintSize({ minHeight: 14 })'));
  assert.ok(has(ttsControl, 'constraintSize({ minHeight: 87 })'));
}
check('fixed-size-classification', () => {
  checkFixedSizeClassification();
  checkTtsControlMinimums();
});
check('tts-control-fixed-size-classification', () => {
  checkFixedSizeClassification(ttsControlPath);
  checkTtsControlMinimums();
});

check('dynamic-surface-resolvers-used', () => {
  assert.ok(has(downloadPage, 'readerAvailableWindowHeight(this.currentMetrics(), this.pageHeight)'));
  assert.ok(has(downloadPage, 'readerDynamicSurfaceWidth(resolveDrawerSpec'));
  assert.ok(has(downloadPage, 'readerSurfaceMaxHeight(this.sheetMaxHeight(), this.sheetChromeHeight())'));
  assert.ok(has(downloadPage, 'readerSurfaceMaxHeight(this.availableHeight(), this.dialogOuterPaddingY() * 2)'));
  assert.ok(has(importDialog, 'readerSurfaceMaxHeight(height,'));
  assert.doesNotMatch(downloadPage, /availableHeight\(\) - this\.dialogOuterPaddingY\(\) \* 2/);
  assert.doesNotMatch(importDialog, /height - readerInteractiveSafeTop\(metrics\)/);
});

check('dynamic-control-heights', () => {
  assert.ok(has(surfaceResolvers, 'export function readerReadableFontScale'));
  assert.ok(has(surfaceResolvers, 'export function readerScaledControlHeight'));
  for (const [name, source] of [
    ['button', file('entry/src/main/ets/features/common/ReaderButton.ets')],
    ['formField', file('entry/src/main/ets/features/common/ReaderFormField.ets')],
    ['choiceRow', file('entry/src/main/ets/features/common/ReaderChoiceRow.ets')],
    ['dialog', file('entry/src/main/ets/features/common/ReaderDialogSurface.ets')],
    ['actionMenu', file('entry/src/main/ets/features/common/ReaderActionMenuSurface.ets')],
    ['boundedActions', file('entry/src/main/ets/features/common/ReaderBoundedSurfaceActions.ets')],
  ]) {
    assert.ok(has(source, 'readerScaledControlHeight'), `${name}: control height must use the shared resolver`);
  }
  assert.doesNotMatch(file('entry/src/main/ets/features/common/ReaderButton.ets'), /const growth =/);
  assert.ok(has(surfaceSpecs, 'actionHeightFor(fontScale: number): number'));
  assert.ok(has(surfaceSpecs, 'expandedHeightFor(fontScale: number): number'));
  assert.ok(has(surfaceSpecs, 'collapsedHeightFor(fontScale: number): number'));
  assert.ok(has(file('entry/src/main/ets/features/bookshelf/BookshelfMoreMenu.ets'),
    'expandedHeightFor(this.fontScale())'));
});

if (selectedChecks !== undefined) {
  for (const id of selectedChecks) {
    if (!results.some((result) => result.id === id)) results.push({ id, status: 'FAIL', error: 'unknown check ID' });
  }
}
const failures = results.filter((result) => result.status === 'FAIL');
if (json) {
  console.log(JSON.stringify({ status: failures.length === 0 ? 'PASS' : 'FAIL', rationale, checks: results }, null, 2));
} else {
  console.log(`Page geometry/motion contract (${rationale})`);
  for (const result of results) console.log(`${result.status} ${result.id}${result.error ? `: ${result.error}` : ''}`);
  console.log(`RESULT ${failures.length === 0 ? 'PASS' : 'FAIL'} (${results.length} checks)`);
}
if (failures.length > 0) process.exitCode = 1;
