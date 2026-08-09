import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (relative) => readFileSync(new URL(`../${relative}`, import.meta.url), 'utf8');

const index = read('entry/src/main/ets/pages/Index.ets');
const shell = read('entry/src/main/ets/features/shell/ReaderShell.ets');
const experience = read('entry/src/main/ets/features/reading/LocalReadingExperience.ets');
const sessionGateway = read('entry/src/main/ets/features/reading/ReadingSessionFlowGateway.ts');
const localGateway = read('entry/src/main/ets/features/reading/LocalReadingFlowGateway.ts');
const remoteGateway = read('entry/src/main/ets/features/reading/RemoteReadingFlowGateway.ts');

assert.match(index, /private onSearchResultSelected\(book: SearchBook\): void \{\s*this\.openRemoteBookDetail\(/,
  'a live remote search result must enter the remote open transaction');
assert.match(index, /gateway\.openSession\(seed, \{ isCurrent \}\)/,
  'remote detail and TOC must retain the route-generation cancellation guard');
assert.match(index, /await bookshelf\.loadShelfBook\(session\.identity\.sourceId, session\.identity\.bookId\)/,
  'reopening a shelf book must reuse the existing composite entry without resetting Core metadata');
assert.match(index, /if \(storedBook === undefined\) \{[\s\S]*await bookshelf\.upsertBook\(\{[\s\S]*sourceId: session\.identity\.sourceId,[\s\S]*bookId: session\.identity\.bookId/,
  'a selected remote result must reuse Core bookshelf.add before the on-shelf detail state is shown');
assert.match(index, /new SourceGateway\(owner\)\.loadSources\(\)[\s\S]*source\.sourceId === session\.identity\.sourceId/,
  'a persisted shelf book must resolve its display name from the existing Core source registry');
const remoteOpen = index.slice(index.indexOf('private openRemoteBookDetail('), index.indexOf('private openReading('));
assert.ok(remoteOpen.indexOf('await bookshelf.upsertBook(') < remoteOpen.indexOf("this.route = 'detail'"),
  'the detail terminal state must not appear before Core confirms the shelf upsert');
assert.doesNotMatch(remoteOpen, /remoteShelf|remoteBookshelf|new Map/,
  'remote books must not create a second UI-owned shelf store');
assert.match(index, /this\.remoteReadingSession = session/);
assert.match(index, /this\.detailToc = session\.entries\.map/);
assert.match(index, /this\.route = 'detail'/,
  'a validated remote session must enter the shared detail route');
assert.doesNotMatch(index, /remote search result has no admitted detail flow/);
assert.doesNotMatch(index, /remote reading not yet wired/);
assert.match(index, /private reopenSwitchedBook\(book: ShelfBook\): void \{\s*this\.openBookDetail\(book\)/,
  'source-switch success must re-enter the same local-or-remote detail dispatcher');

assert.match(shell, /remoteSession: this\.remoteSession/);
assert.match(shell, /sourceId: this\.sourceId/);
assert.match(experience, /new ReadingSessionFlowGateway\([\s\S]*this\.readingSessionSource\(\)/,
  'the renderer must depend on one source-normalizing execution boundary');
assert.doesNotMatch(experience, /new RemoteReadingFlowGateway/,
  'the renderer must not grow a second remote pagination path');

assert.match(sessionGateway, /this\.local\.loadChapter/);
assert.match(sessionGateway, /this\.remote\.loadChapter/);
assert.match(sessionGateway, /this\.remote\.resolveLocation/);
assert.match(sessionGateway, /this\.remote\.updateProgress/);
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
