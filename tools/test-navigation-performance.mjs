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

const fonts = read('entry/src/main/ets/features/common/ReaderFonts.ets');
assert.match(fonts, /let readerFontsRegistered: boolean = false/);
assert.match(fonts, /if \(readerFontsRegistered\) \{\s*return;\s*\}/);
assert.ok(fonts.indexOf('if (readerFontsRegistered)') < fonts.indexOf('font.registerFont({'),
  'the process font latch must run before opening any bundled font file');
assert.ok(fonts.lastIndexOf('readerFontsRegistered = true') > fonts.lastIndexOf('font.registerFont({'),
  'the latch must be committed only after every bundled font is registered');

const index = read('entry/src/main/ets/pages/Index.ets');
const localDetail = method(index, 'private openLocalBookDetail(', 'private openRemoteBookDetail(');
assert.ok(localDetail.indexOf("this.route = 'detail'") < localDetail.indexOf('reading.loadToc(selection.bookId)'),
  'local detail must be projected before the serialized TOC request');
assert.doesNotMatch(localDetail, /loadShelfBook|new ReaderCoreGateway/,
  'a Core-derived shelf card must not be read a second time on local detail admission');
const remoteDetail = method(index, 'private openRemoteBookDetail(', 'private resolveRemoteDetailSourceName(');
assert.match(remoteDetail, /shelfSnapshot: ShelfBook \| undefined = undefined/);
assert.match(remoteDetail,
  /const reusableRemoteSession = shelfSnapshot !== undefined &&[\s\S]*?identity\.sourceId === seed\.sourceId &&[\s\S]*?identity\.bookId === seed\.bookId/,
  'only an exact shelf identity may reuse the already admitted remote session');
assert.match(remoteDetail,
  /const sessionAdmission: Promise<RemoteReadingSession> = reusableRemoteSession === undefined \?[\s\S]*?gateway\.openSession\(seed, \{ isCurrent \}\)[\s\S]*?: Promise\.resolve\(reusableRemoteSession\)/,
  'same-process shelf re-entry must reuse the exact session instead of repeating detail and TOC requests');
assert.ok(remoteDetail.indexOf("this.route = 'detail'") < remoteDetail.indexOf('gateway.openSession(seed, { isCurrent })'),
  'remote detail must project its inert shell before network/session admission');
assert.match(remoteDetail, /const suppliedShelfBook = shelfSnapshot\?\.sourceId === session\.identity\.sourceId/);
assert.doesNotMatch(remoteDetail, /new SourceGateway\(owner\)\.loadSources/,
  'optional source-name lookup must not stay on the route-admission critical path');
const returnToShelf = method(index, 'private returnToBookshelf(', 'private applyReadingCommit(');
assert.match(returnToShelf,
  /const retainedRemoteSession = this\.detailBook !== undefined &&[\s\S]*?this\.detailBook\.sourceId !== LOCAL_SOURCE_ID &&[\s\S]*?identity\.sourceId === this\.detailBook\.sourceId &&[\s\S]*?identity\.bookId === this\.detailBook\.bookId/,
  'leaving an exact remote detail may retain only its already admitted session');
assert.match(returnToShelf, /this\.remoteReadingSession = retainedRemoteSession/);
assert.doesNotMatch(returnToShelf, /this\.remoteReadingSession = undefined/,
  'the exact remote session must not be discarded on an immediate shelf round-trip');

const detail = read('entry/src/main/ets/features/bookshelf/LocalBookDetail.ets');
assert.match(detail, /private readingActionsReady\(\): boolean \{\s*return this\.toc\.length > 0;/);
assert.match(detail, /\.enabled\(this\.readingActionsReady\(\)\)/,
  'the directory action must remain inert while the TOC is loading');
assert.match(detail, /\.enabled\(this\.readingActionsReady\(\) && !this\.removing\)/,
  'continue reading must remain inert while the TOC loads or removal is active');

const reading = read('entry/src/main/ets/features/reading/LocalReadingExperience.ets');
assert.match(reading, /this\.loadInitialToc\(isCurrent\)/);
assert.match(reading, /if \(this\.directoryEntries\.length === 0\) \{\s*return this\.activeGateway\(\)\.loadToc/);
assert.match(reading, /return Promise\.resolve\(new InitialReadingToc\(this\.bookId, this\.directoryEntries\)\)/);
assert.doesNotMatch(reading, /new InitialReadingToc\(this\.bookId, this\.directoryEntries\.slice\(\)\)/,
  'detail-admitted TOC identity must not be broken by an unnecessary array copy');
assert.match(reading,
  /tocEntries: this\.controlVisible \?\s*this\.controlDirectoryEntries\(\) : EMPTY_CONTROL_DIRECTORY_ENTRIES/,
  'the hidden Reader Control shell must not project the full directory on first-page admission');
const controlDirectory = method(reading, 'private controlDirectoryEntries(', 'private initializeTtsSession(');
assert.ok(controlDirectory.indexOf('this.tocEntries === this.directoryEntries') <
  controlDirectory.indexOf('new Map<number, LocalReadingTocEntry>()'),
  'an identical parent/session TOC must return before building the marker/title projection');
assert.match(reading, /this\.requestedChapterIndex === undefined && restored !== undefined/);
assert.match(reading, /stored = await this\.activeGateway\(\)\.updateProgress/,
  'changed/explicit anchors must retain persistence-before-visibility');
const appear = method(reading, 'aboutToAppear(): void {', 'aboutToDisappear(): void {');
assert.match(appear, /this\.loadInitialReading\(lifecycleToken\)/);
assert.doesNotMatch(appear, /initializeTtsSession|loadChineseConversionMode|loadReaderSettingsSnapshot/,
  'optional TTS and control settings must not compete with first-page admission');
const initialReading = method(reading, 'private async loadInitialReading(', 'private async loadInitialChapter(');
assert.match(initialReading, /await this\.loadAppearanceSnapshot\(lifecycleToken\)/,
  'layout-affecting appearance must settle before the first chapter measurement');
const initialChapter = method(reading, 'private async loadInitialChapter(', 'private loadInitialToc(');
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
assert.match(search, /Repeat\(results\)[\s\S]*\.virtualScroll\(\{ reusable: true \}\)/);
assert.doesNotMatch(search, /countBySource/,
  'raw result cards must not repeat an O(n) source scan for every row');

for (const relative of [
  'entry/src/main/ets/features/source/SourceManagementPage.ets',
  'entry/src/main/ets/features/source/SourceSwitchWindow.ets',
]) {
  const source = read(relative);
  assert.match(source, /Repeat\([\s\S]*\.virtualScroll\(\{ reusable: true \}\)/,
    `${relative} must virtualize its variable-length list`);
}

console.log('navigation performance static contract: PASS');
