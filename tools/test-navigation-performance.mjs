import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (relative) => readFileSync(new URL(`../${relative}`, import.meta.url), 'utf8');
const method = (source, start, end) => {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.notEqual(startIndex, -1, `missing method start: ${start}`);
  assert.notEqual(endIndex, -1, `missing method end: ${end}`);
  return source.slice(startIndex, endIndex);
};

const fonts = read('entry/src/main/ets/features/common/ReaderFonts.ets') + read('entry/src/main/ets/app/ReaderFontLoadHost.ts');
assert.match(fonts, /const fontLoads: Map<string, Promise<void>>/);
assert.ok(fonts.indexOf('if (existing !== undefined) return existing') < fonts.indexOf('.loadFontWithCheck('),
  'a completed or pending font receipt must be reused before opening a bundled font');
assert.match(fonts, /fontLoads.delete\(family\)/, 'failed load permits a real retry');
assert.doesNotMatch(fonts, /font\.registerFont/, 'an unchecked submission cannot authorize layout');

const index = read('entry/src/main/ets/pages/Index.ets');
const localDetail = method(index, 'private openLocalBookDetail(', 'private openRemoteBookDetail(');
assert.ok(localDetail.indexOf('this.route = entryRoute') < localDetail.indexOf('reading.loadToc(selection.bookId)'),
  'local detail must be projected before the serialized TOC request');
assert.doesNotMatch(localDetail, /loadShelfBook|new ReaderCoreGateway/,
  'a Core-derived shelf card must not be read a second time on local detail admission');
const remoteDetail = method(index, 'private openRemoteBookDetail(', 'private resolveRemoteDetailSourceName(');
assert.match(remoteDetail, /shelfSnapshot: ShelfBook \| undefined = undefined/);
assert.match(remoteDetail,
  /const reusableRemoteSession = shelfSnapshot !== undefined &&[\s\S]*?identity\.sourceId === seed\.sourceId &&[\s\S]*?identity\.bookId === seed\.bookId/,
  'only an exact shelf identity may reuse the already admitted remote session');
assert.match(remoteDetail, /if \(suppliedSession !== undefined\) return new RemoteDetailAdmission\(suppliedSession\)/,
  'admitted exact session remains reusable');
assert.match(remoteDetail, /acquireBookWithBackgroundRefresh\(seed, \{ isCurrent \}\)/,
  'fixed-source catalog admission retains cache-first background refresh');
assert.ok(remoteDetail.indexOf('this.route = entryRoute') < remoteDetail.indexOf('.acquireBookWithBackgroundRefresh(seed, { isCurrent })'),
  'remote detail must project its inert shell before network/session admission');
assert.match(remoteDetail, /let suppliedShelfBook = shelfSnapshot\?\.sourceId === session\.identity\.sourceId/);
assert.ok(remoteDetail.indexOf('this.route = entryRoute') < remoteDetail.indexOf('await bookshelf.loadShelfBook'),
  'exact membership protects source choice after publishing the detail surface');
assert.ok(remoteDetail.indexOf('this.detailToc = session.entries.map') <
  remoteDetail.indexOf('void bookshelf.loadShelfBook'),
  'the admitted session and TOC must publish before shelf membership reconciliation');
assert.ok(remoteDetail.indexOf('this.route = entryRoute') < remoteDetail.indexOf('.acquireBookWithBackgroundRefresh(seed, { isCurrent })'),
  'mandatory category admission must not delay the inert detail shell');
assert.ok(remoteDetail.indexOf('this.detailToc = session.entries.map') < remoteDetail.indexOf('void this.resolveRemoteDetailSourceName'),
  'optional source-name lookup remains after session publication');
const returnToShelf = method(index, 'private returnToBookshelf(', 'private applyReadingCommit(');
assert.match(returnToShelf,
  /const retainedRemoteSession = this\.detailBook !== undefined &&[\s\S]*?this\.detailBook\.sourceId !== LOCAL_SOURCE_ID &&[\s\S]*?identity\.sourceId === this\.detailBook\.sourceId &&[\s\S]*?identity\.bookId === this\.detailBook\.bookId/,
  'leaving an exact remote detail may retain only its already admitted session');
assert.match(returnToShelf, /this\.installRemoteReadingSession\(retainedRemoteSession\)/);
assert.doesNotMatch(returnToShelf, /this\.remoteReadingSession = undefined/,
  'the exact remote session must not be discarded on an immediate shelf round-trip');

const detail = read('entry/src/main/ets/features/bookshelf/LocalBookDetail.ets');
assert.doesNotMatch(detail, /readingActionsReady|\.enabled\([^\n]*readingEnabled/,
  'catalog and body errors must be recoverable inside the reader instead of disabling entry');
assert.match(detail, /\.enabled\(!this\.removing\)/,
  'active shelf mutation still owns the book during entry');

const reading = read('entry/src/main/ets/features/reading/LocalReadingExperience.ets');
assert.match(reading, /this\.loadInitialToc\(isCurrent\)/);
assert.match(reading, /if \(this\.directoryEntries\.length === 0\) \{\s*return this\.activeGateway\(\)\.loadToc/);
assert.match(reading, /return Promise\.resolve\(new InitialReadingToc\(this\.bookId, this\.directoryEntries\)\)/);
assert.doesNotMatch(reading, /new InitialReadingToc\(this\.bookId, this\.directoryEntries\.slice\(\)\)/,
  'detail-admitted TOC identity must not be broken by an unnecessary array copy');
assert.match(reading,
  /tocEntries: readerControlHostVisible\(this\.controlSession\) \|\| this\.controlDirectoryDataRetained\s*\?\s*this\.controlDirectoryEntries\(\) : EMPTY_CONTROL_DIRECTORY_ENTRIES/,
  'the hidden Reader Control shell must not project the full directory before admission, and must retain it through dismiss');
const controlDirectory = method(reading, 'private controlDirectoryEntries(', 'private initializeTtsSession(');
assert.ok(controlDirectory.indexOf('this.tocEntries === this.directoryEntries') <
  controlDirectory.indexOf('new Map<number, LocalReadingTocEntry>()'),
  'an identical parent/session TOC must return before building the marker/title projection');
assert.match(reading, /stored = await this\.activeGateway\(\)\.resolveAndUpdateProgress/,
  'first-page canonical resolution and persistence must use one Core round trip');
assert.doesNotMatch(reading, /const resolved = await this\.activeGateway\(\)\.resolveLocation/,
  'page completion must not serialize location.resolve before progress.update');
const appear = method(reading, 'aboutToAppear(): void {', 'aboutToDisappear(): void {');
assert.match(appear, /this\.loadInitialReading\(lifecycleToken\)/);
assert.doesNotMatch(appear, /initializeTtsSession|loadChineseConversionMode|loadReaderSettingsSnapshot/,
  'optional TTS and control settings must not compete with first-page admission');
const initialReading = method(reading, 'private async loadInitialReading(', 'private async loadInitialChapter(');
assert.match(initialReading,
  /const layoutReady = Promise\.all\(\[[\s\S]*?this\.loadAppearanceSnapshot\(lifecycleToken\)[\s\S]*?this\.loadReaderSettingsSnapshot\(lifecycleToken\)[\s\S]*?\]\)[\s\S]*this\.loadInitialChapter\(lifecycleToken, layoutReady\)/,
  'layout snapshots must start in parallel with initial TOC/progress acquisition');
const initialChapter = method(reading, 'private async loadInitialChapter(', 'private loadInitialToc(');
assert.doesNotMatch(initialChapter, /await layoutReady/,
  'chapter acquisition must not wait behind the independent layout barrier');
assert.match(initialChapter, /bookmarkContext, layoutReady, unreadCandidates\.slice\(1\)\)/,
  'the initial layout barrier must travel to chapter publication');
assert.doesNotMatch(initialChapter, /loadContentMetrics/,
  'whole-book metrics must not remain on the first-page critical path');
assert.match(reading, /private lastCommittedProgress: ReadingCommit \| undefined/);
assert.match(reading, /this\.lastCommittedProgress\.chapterOffset === page\.startScalar[\s\S]*?return;/,
  'exit must skip an identical durable visible-page commit');
assert.match(reading,
  /configureRestoredAnchor\([\s\S]*?this\.lastCommittedProgress = undefined;[\s\S]*?this\.chapterLayoutMap = chapterMap;/,
  'a reloaded chapter body must earn a fresh durable commit before exit deduplication');
assert.match(reading, /private unicodeProbeVerified: boolean = false/);
assert.match(reading, /if \(this\.unicodeProbeVerified\) \{\s*return true;/,
  'the UTF-16/scalar contract probe must be reused after its first proof');
assert.match(reading, /private prefetchNextChapter\(/);
assert.doesNotMatch(reading, /private prefetchAdjacentChapters\(/,
  'backward chapter acquisition must remain demand-driven');

const localGateway = read('entry/src/main/ets/features/reading/LocalReadingFlowGateway.ts');
assert.equal((localGateway.match(/new Set<number>\(\)/g) ?? []).length, 2,
  'TOC and content metrics validation must use linear-time duplicate checks');
assert.doesNotMatch(localGateway, /seenIndices\.indexOf/);
const chapterWindow = read('entry/src/main/ets/features/reading/ReadingChapterWindow.ts');
assert.match(chapterWindow, /private chapterPositions: Map<number, number>/);
assert.match(chapterWindow, /return this\.chapterPositions\.get\(chapterIndex\) \?\? -1/);
assert.doesNotMatch(chapterWindow, /this\.chapterOrder\.indexOf/);
const remoteGateway = read('entry/src/main/ets/features/reading/RemoteReadingFlowGateway.ts');
assert.match(remoteGateway, /private chapterByIndex: Map<number, RemoteReadingTocEntry>/);
assert.match(remoteGateway, /const selected = this\.chapterEntry\(session, chapterIndex\)/);

const search = read('entry/src/main/ets/features/search/SearchPage.ets');
assert.match(search, /LazyForEach\(this\.resultDataSource,/,
  'Search must lazily materialize explicitly notified result replacements');
assert.doesNotMatch(search, /countBySource/,
  'raw result cards must not repeat an O(n) source scan for every row');
const groupResults = method(search, 'private groupResults(', 'private normalizedBookKey(');
const resultProjection = read('entry/src/main/ets/features/search/SearchResultProjection.ts');
assert.match(groupResults, /this\.resultProjection\.update\(results, this\.shelfBooks/);
assert.match(resultProjection, /private shelfIdentities: Set<string>/);
assert.match(resultProjection, /private shelfTitles: Set<string>/);
assert.match(resultProjection, /this\.shelfInput !== shelf/, 'unchanged shelf snapshots must reuse the indexed membership');
assert.doesNotMatch(groupResults, /this\.shelfBooks\.some/,
  'search grouping must index the shelf once instead of scanning it for every result');

const sourceManagement = read('entry/src/main/ets/features/source/SourceManagementPage.ets');
assert.match(sourceManagement, /LazyForEach\(this\.sourceDataSource,/,
  'Source Management must lazily materialize its variable-length list');
const sourceSwitch = read('entry/src/main/ets/features/source/SourceSwitchWindow.ets');
assert.match(sourceSwitch, /Repeat\([\s\S]*\.virtualScroll\(\{ reusable: true \}\)/,
  'Source Switch must virtualize its variable-length list');

console.log('navigation performance static contract: PASS');
