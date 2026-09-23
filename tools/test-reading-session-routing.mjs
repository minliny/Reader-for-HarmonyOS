import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (relative) => readFileSync(new URL(`../${relative}`, import.meta.url), 'utf8');

const index = read('entry/src/main/ets/pages/Index.ets');
const shell = read('entry/src/main/ets/features/shell/ReaderShell.ets');
const experience = read('entry/src/main/ets/features/reading/LocalReadingExperience.ets');
const sessionGateway = read('entry/src/main/ets/features/reading/ReadingSessionFlowGateway.ts');
const localGateway = read('entry/src/main/ets/features/reading/LocalReadingFlowGateway.ts');
const remoteGateway = read('entry/src/main/ets/features/reading/RemoteReadingFlowGateway.ts');

assert.match(index, /private onSearchResultSelected\(book: SearchBook, variants: SearchBook\[\] = \[\]\): void \{/,
  'a live remote search result enters the remote open transaction with same-book variants ordered behind it');
assert.match(index, /\.acquireBookWithBackgroundRefresh\(seed, \{ isCurrent \}\)/,
  'remote detail and TOC must retain the route-generation cancellation guard');
assert.match(index, /void bookshelf\.loadShelfBook\(session\.identity\.sourceId, session\.identity\.bookId\)/,
  'shelf reconciliation must reuse the existing composite entry without resetting Core metadata');
assert.doesNotMatch(index.slice(index.indexOf('private openRemoteBookDetail('), index.indexOf('private resolveRemoteDetailSourceName(')),
  /await bookshelf\.upsertBook\(/,
  'opening a search result is a preview and must not mutate the bookshelf');
assert.match(index, /private addDetailBook\(\): void \{[\s\S]*new ReaderCoreGateway\(owner\)\.upsertBook\(\{[\s\S]*sourceId: session\.identity\.sourceId,[\s\S]*bookId: session\.identity\.bookId/,
  'only the explicit detail action may join a remote book to the shelf');
assert.match(index, /new SourceGateway\(owner\)\.loadSources\(\)[\s\S]*source\.sourceId !== session\.identity\.sourceId/,
  'a persisted shelf book must resolve its display name from the existing Core source registry');
const remoteOpen = index.slice(index.indexOf('private openRemoteBookDetail('), index.indexOf('private openReading('));
assert.ok(remoteOpen.indexOf('this.route = entryRoute') < remoteOpen.indexOf('.acquireBookWithBackgroundRefresh(seed, { isCurrent })'),
  'remote navigation must publish the chosen shelf or detail entry before Core/network admission');
assert.match(index, /sourceSwitchEnabled: this\.detailBook\.sourceId !== LOCAL_SOURCE_ID &&\s*this\.bookshelfRemovalActiveKey\.length === 0/,
  'source browsing remains available even when the current source catalog failed');
assert.match(index, /readingEnabled: this\.remoteContentVerdict === 'readable'/,
  'the detail retains its diagnostic verdict independently from reading admission');
assert.doesNotMatch(remoteOpen, /gateway\.loadProgress\(/,
  'shelf admission must not duplicate the reader Core progress read');
assert.match(remoteOpen, /if \(resumeImmediately\) \{[\s\S]*?this\.openReading\(undefined\);\s*return;/,
  'shelf entry immediately mounts the original reader before the detail acquisition path');
assert.ok(remoteOpen.indexOf('this.openReading(undefined)') < remoteOpen.indexOf('const sessionAdmission'),
  'catalog acquisition is owned by the already visible reader');
assert.match(experience, /this\.activeGateway\(\)\.loadProgress\(this\.bookId, isCurrent\)[\s\S]*restored\?\.chapterIndex/,
  'the original reader selects from current Core progress');
assert.match(experience, /anchors: \[\{ id: 'restored', offset: restored\.chapterOffset \}\]/,
  'the body request retains the exact scoped restored offset');
assert.doesNotMatch(remoteOpen, /remoteShelf|remoteBookshelf|shelfBooks\s*=\s*new Map/,
  'remote books must not create a second UI-owned shelf store');
assert.match(remoteOpen, /this\.installRemoteReadingSession\(session\)/,
  'all detail admission uses the shared session/evidence installation boundary');
assert.match(index, /this\.detailToc = session\.entries\.map/);
assert.ok(remoteOpen.indexOf('this.detailToc = session.entries.map') <
  remoteOpen.indexOf('void bookshelf.loadShelfBook'),
  'remote detail readiness must not wait for the non-mutating shelf reconciliation');
assert.match(remoteOpen, /const entryRoute = resumeImmediately \? this\.readingOriginRoute : 'detail';[\s\S]*this\.route = entryRoute/,
  'a remote preview keeps its detail origin while resume immediately advances to reading');
assert.doesNotMatch(index, /remote search result has no admitted detail flow/);
assert.doesNotMatch(index, /remote reading not yet wired/);
assert.match(index, /private reopenSwitchedBook\(book: ShelfBook\): void \{[\s\S]*?this\.openLocalBookDetail\(book, true\)[\s\S]*?this\.openRemoteBookDetail\(\{ sourceId: book\.sourceId, bookId: book\.bookId, detailUrl: book\.bookId,/,
  'source-switch recovery must revalidate the committed local/remote identity');

assert.match(shell, /remoteSession: this\.remoteSession/);
assert.match(shell, /sourceId: this\.sourceId/);
assert.match(experience, /ReadingSessionFlowGateway\.open\([\s\S]*remoteBookSeed: this\.remoteBookSeed/,
  'the renderer must depend on one source-normalizing execution boundary');
assert.doesNotMatch(experience, /new RemoteReadingFlowGateway/,
  'the renderer must not grow a second remote pagination path');

assert.match(sessionGateway, /this\.local\.loadChapter/);
assert.match(sessionGateway, /this\.remote\.loadChapter/);
assert.match(sessionGateway, /this\.remote\.resolveLocation/);
assert.match(sessionGateway, /this\.remote\.updateProgress/);
assert.match(sessionGateway, /async resolveAndUpdateProgress\(/);
assert.match(sessionGateway, /if \(this\.source\.kind === 'remote'\) \{\s*return undefined;/,
  'remote progress display must not bulk-download unopened bodies to imitate local exact metrics');
assert.doesNotMatch(sessionGateway, /LRU|cache\.book\.prefetch|Promise\.all\([^)]*loadChapter/,
  'the adapter must not introduce another cache or whole-book prefetch framework');
for (const [name, source] of [
  ['session', sessionGateway],
  ['local', localGateway],
  ['remote', remoteGateway],
]) {
  assert.doesNotMatch(source, /ReaderRuntimeOwner|\.current\(\)/,
    `${name} reading gateway must receive the existing runtime instead of locating a global owner`);
  assert.match(source, /constructor\([\s\S]*?runtimeOwner: ReadingGatewayRuntime/,
    `${name} reading gateway must keep runtime injection as a required constructor dependency`);
}

console.log('reading session local/remote routing contract: PASS');
