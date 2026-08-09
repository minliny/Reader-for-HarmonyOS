import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  readerDirectoryBookmarkMarkerState,
} from '../entry/src/main/ets/features/reading/ReaderDirectoryMarkerState.ts';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(repo, path), 'utf8');

const modulePanel = read('entry/src/main/ets/features/reading/ReaderDirectoryModulePanel.ets');
assert.match(modulePanel, /@State private activeTab: string = 'directory'/);
assert.match(modulePanel, /this\.activeTab = 'bookmarks'/);
assert.match(modulePanel, /if \(this\.activeTab === 'directory'\) \{\s*return this\.entries;/);
assert.match(modulePanel, /if \(this\.hasBookmark\(entry\)\) \{\s*bookmarkedEntries\.push\(entry\);/);
assert.match(modulePanel, /private downloadMarkerHitTarget\(entry: LocalReadingTocEntry\)/);
assert.match(modulePanel, /\.enabled\(false\)\s*\.accessibilityText\(this\.downloadMarkerLabel\(entry\)\)/);
assert.match(modulePanel, /private bookmarkMarkerHitTarget\(entry: LocalReadingTocEntry\)/);
assert.match(modulePanel, /onDeleteBookmarks: \(bookmarkTimes: number\[\]\) => void/);
assert.match(modulePanel, /onCreateChapterStartBookmark: \(request: ReaderDirectoryChapterStartBookmarkRequest\) => void/);
assert.match(modulePanel, /chapterStartBookmarkCreationEnabled: boolean = false/);
assert.match(modulePanel, /markerState\.kind === 'bookmarked'[\s\S]*this\.onDeleteBookmarks\(markerState\.bookmarkTimes\)/);
assert.match(modulePanel, /markerState\.kind === 'empty' && this\.chapterStartBookmarkCreationEnabled[\s\S]*this\.onCreateChapterStartBookmark\(markerState\.createRequest\)/);
assert.match(modulePanel, /\.accessibilityText\(`打开章节：\$\{entry\.title\}`\)\s*\.onClick\(\(\): void => this\.onSelectChapter\(entry\.index\)\)/);

const fullPanel = read('entry/src/main/ets/features/reading/FullDirectoryPanel.ets');
assert.match(fullPanel, /this\.activeTab = 'bookmarks'/);
assert.match(fullPanel, /this\.activeTab === 'bookmarks' && !this\.hasBookmark\(entry\)/);
assert.match(fullPanel, /private downloadMarkerHitTarget\(entry: LocalReadingTocEntry\)/);
assert.match(fullPanel, /private bookmarkMarkerHitTarget\(entry: LocalReadingTocEntry\)/);
assert.match(fullPanel, /onDeleteBookmarks: \(bookmarkTimes: number\[\]\) => void/);
assert.match(fullPanel, /onCreateChapterStartBookmark: \(request: ReaderDirectoryChapterStartBookmarkRequest\) => void/);
assert.match(fullPanel, /chapterStartBookmarkCreationEnabled: boolean = false/);
assert.match(fullPanel, /this\.onDeleteBookmarks\(markerState\.bookmarkTimes\)/);
assert.match(fullPanel, /this\.onCreateChapterStartBookmark\(markerState\.createRequest\)/);
assert.match(fullPanel, /\.enabled\(false\)\s*\.accessibilityText\(this\.downloadMarkerLabel\(entry\)\)/);
assert.match(fullPanel, /\.accessibilityText\(`打开章节：\$\{entry\.title\}`\)\s*\.onClick\(\(\): void => this\.onSelectChapter\(entry\.index\)\)/);

const fullDirectory = read('entry/src/main/ets/features/reading/ReaderFullDirectory.ets');
assert.match(fullDirectory, /onDeleteBookmarks: \(bookmarkTimes: number\[\]\) => void/);
assert.match(fullDirectory, /onDeleteBookmarks: \(bookmarkTimes: number\[\]\): void => this\.onDeleteBookmarks\(bookmarkTimes\)/);
assert.match(fullDirectory, /chapterStartBookmarkCreationEnabled: boolean = false/);
assert.match(fullDirectory, /onCreateChapterStartBookmark: \(request: ReaderDirectoryChapterStartBookmarkRequest\) => void/);
assert.match(fullDirectory, /chapterStartBookmarkCreationEnabled: this\.chapterStartBookmarkCreationEnabled/);

const gateway = read('entry/src/main/ets/features/reading/LocalReadingFlowGateway.ts');
assert.match(gateway, /async createChapterStartBookmark\(/);
assert.match(gateway, /request\('bookmark\.create', \{\s*bookName: input\.bookName,\s*bookAuthor: input\.bookAuthor,\s*chapterIndex: input\.chapterIndex,\s*chapterPos: 0,\s*chapterName: input\.chapterTitle,/);
assert.match(gateway, /bookmark\.create returned a mismatched chapter-start bookmark/);
assert.match(gateway, /async deleteBookmark\(\s*time: number,/);
assert.match(gateway, /request\('bookmark\.delete', \{\s*time,/);
assert.match(gateway, /bookmark\.delete returned a mismatched time/);
assert.match(gateway, /typeof deleted !== 'boolean'/);
assert.doesNotMatch(gateway, /request\('cache\.book\.prefetch'/);

const index = read('entry/src/main/ets/pages/Index.ets');
assert.match(index, /private directoryBookmarkMutationGeneration: number = 0/);
assert.match(index, /private directoryBookmarkMutationActiveKey: string = ''/);
assert.match(index, /private beginDirectoryBookmarkMutation\(book: ReadingBookDetail\): number/,
  'bookmark mutation identity must accept the shared detail model while remaining local-source gated');
assert.match(index, /if \(this\.directoryBookmarkMutationActiveKey === key\) \{\s*return -1;/,
  'repeated taps on the same book must not issue duplicate create/delete mutations');
assert.equal((index.match(/const mutationGeneration = this\.beginDirectoryBookmarkMutation\(book\)/g) ?? []).length, 2,
  'both create and delete entry points must acquire the same mutation guard');
assert.equal((index.match(/this\.finishDirectoryBookmarkMutation\(mutationGeneration, mutationKey\)/g) ?? []).length, 2,
  'both async mutation paths must release their exact guard in finally');
assert.match(index, /private isDirectoryBookmarkMutationCurrent\(generation: number, key: string\): boolean \{[\s\S]*generation === this\.directoryBookmarkMutationGeneration &&[\s\S]*key === this\.directoryBookmarkMutationActiveKey/,
  'an old request must not clear the guard owned by a newer book mutation');
assert.equal((index.match(/this\.isDirectoryBookmarkMutationCurrent\(mutationGeneration, mutationKey\)/g) ?? []).length, 2,
  'both Core request guards must include the bookmark mutation generation');

const unknown = readerDirectoryBookmarkMarkerState({
  index: 7,
  title: '第 8 章',
  downloadState: 'unknown',
});
assert.deepEqual(unknown, { kind: 'unknown' });

const empty = readerDirectoryBookmarkMarkerState({
  index: 7,
  title: '第 8 章',
  downloadState: 'missing',
  bookmarks: [],
});
assert.deepEqual(empty, {
  kind: 'empty',
  createRequest: { chapterIndex: 7, chapterTitle: '第 8 章' },
});

const sourceBookmarks = [
  { time: 10, chapterIndex: 7, chapterOffset: 0, chapterTitle: '第 8 章', content: '' },
  { time: 12, chapterIndex: 7, chapterOffset: 5, chapterTitle: '第 8 章', content: '注' },
];
const bookmarked = readerDirectoryBookmarkMarkerState({
  index: 7,
  title: '第 8 章',
  downloadState: 'cached',
  bookmarks: sourceBookmarks,
});
assert.deepEqual(bookmarked, { kind: 'bookmarked', bookmarkTimes: [10, 12] });
assert.deepEqual(sourceBookmarks.map((bookmark) => bookmark.time), [10, 12],
  'marker derivation must not mutate the Core-owned projection');

console.log('reader-directory-markers static contract: PASS');
