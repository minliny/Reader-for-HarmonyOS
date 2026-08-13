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
assert.ok(remoteDetail.indexOf("this.route = 'detail'") < remoteDetail.indexOf('gateway.openSession(seed, { isCurrent })'),
  'remote detail must project its inert shell before network/session admission');
assert.match(remoteDetail, /const suppliedShelfBook = shelfSnapshot\?\.sourceId === session\.identity\.sourceId/);
assert.doesNotMatch(remoteDetail, /new SourceGateway\(owner\)\.loadSources/,
  'optional source-name lookup must not stay on the route-admission critical path');

const detail = read('entry/src/main/ets/features/bookshelf/LocalBookDetail.ets');
assert.match(detail, /private readingActionsReady\(\): boolean \{\s*return this\.toc\.length > 0;/);
assert.equal((detail.match(/\.enabled\(this\.readingActionsReady\(\)\)/g) ?? []).length, 2,
  'both directory and continue actions must remain inert while the TOC is loading');

const reading = read('entry/src/main/ets/features/reading/LocalReadingExperience.ets');
assert.match(reading, /this\.loadInitialToc\(isCurrent\)/);
assert.match(reading, /if \(this\.directoryEntries\.length === 0\) \{\s*return this\.activeGateway\(\)\.loadToc/);
assert.match(reading, /return Promise\.resolve\(new InitialReadingToc\(this\.bookId, this\.directoryEntries\.slice\(\)\)\)/);
assert.match(reading, /this\.requestedChapterIndex === undefined && restored !== undefined/);
assert.match(reading, /stored = await this\.activeGateway\(\)\.updateProgress/,
  'changed/explicit anchors must retain persistence-before-visibility');

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
