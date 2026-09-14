import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(repo, path), 'utf8');

const modulePanel = read('entry/src/main/ets/features/reading/ReaderDirectoryModulePanel.ets');
const fullPanel = read('entry/src/main/ets/features/reading/FullDirectoryPanel.ets');
const directoryList = read('entry/src/main/ets/features/reading/ReaderDirectoryList.ets');
const bookmarkList = read('entry/src/main/ets/features/reading/ReaderBookmarkList.ets');
const bookmarkRow = read('entry/src/main/ets/features/reading/ReaderBookmarkRow.ets');
const bookmarkEmpty = read('entry/src/main/ets/features/reading/ReaderBookmarkEmptyState.ets');
const bookmarkLoading = read('entry/src/main/ets/features/reading/ReaderBookmarkLoadingState.ets');
const bookmarkError = read('entry/src/main/ets/features/reading/ReaderBookmarkErrorState.ets');

/**
 * Projection functions must receive the tab/search/sort values explicitly:
 * a @State written earlier in the same event still reads as the previous
 * value on the device runtime, which is the stale-projection bug this
 * contract locks out.
 */
const rebuildBody = (source, signature) => {
  const match = source.match(signature);
  assert.ok(match, `parameterized rebuildProjection (${signature}) must exist`);
  return match[1];
};
const moduleRebuildBody = rebuildBody(modulePanel,
  /private rebuildProjection\(tab: string\): void \{([\s\S]*?)\n  \}/);
assert.doesNotMatch(moduleRebuildBody, /this\.activeTab/,
  'module projection must never read activeTab implicitly');
const fullRebuildBody = rebuildBody(fullPanel,
  /private rebuildProjection\(tab: string, ascending: boolean, query: string\): void \{([\s\S]*?)\n  \}/);
assert.doesNotMatch(fullRebuildBody, /this\.activeTab/,
  'full projection must never read activeTab implicitly');

for (const [name, panel] of [['module', modulePanel], ['full', fullPanel]]) {
  assert.match(panel, /private switchTab\(nextTab: string\): void \{[\s\S]*?this\.activeTab = nextTab;[\s\S]*?this\.rebuildProjection\(nextTab/,
    `${name} panel must switch tabs through the explicit-value switchTab`);
  assert.match(panel, /this\.switchTab\('bookmarks'\)/, `${name} bookmark tab tap must use switchTab`);
  assert.match(panel, /this\.switchTab\('directory'\)/, `${name} directory tab tap must use switchTab`);
  assert.doesNotMatch(panel, /\.onClick\(\(\): void => \{\s*this\.activeTab = /,
    `${name} tab onClick must not write activeTab inline`);
  assert.match(panel,
    /onSelectBookmark: \(\(bookmarkId: string, chapterIndex: number, chapterOffset: number, positionScope\?: RemoteReadingPositionScope\) => void\) \| undefined/,
    `${name} panel must expose the optional exact-offset bookmark callback`);
  assert.match(panel,
    /private selectBookmark\(bookmarkId: string, chapterIndex: number, chapterOffset: number, positionScope\?: RemoteReadingPositionScope\): void \{[\s\S]*?if \(this\.onSelectBookmark !== undefined\) \{[\s\S]*?this\.onSelectBookmark\(bookmarkId, chapterIndex, chapterOffset, positionScope\);[\s\S]*?this\.onSelectChapter\(chapterIndex\);/,
    `${name} bookmark tap must pass the exact anchor, degrading to chapter-open only while unwired`);

  assert.match(panel, /if \(this\.bookmarkLoadFailed\) \{\s*ReaderBookmarkErrorState\(/,
    `${name} error state must come first`);
  assert.match(panel, /else if \(this\.bookmarkTabLoading\) \{\s*ReaderBookmarkLoadingState\(\);/,
    `${name} loading state must come before empty/content`);
  assert.match(panel,
    /else if \(this\.(bookmarkRows|projectedBookmarks)\.length === 0\) \{\s*ReaderBookmarkEmptyState\(\{\s*onReturnToDirectory: \(\): void => this\.switchTab\('directory'\)/,
    `${name} empty state must offer return-to-directory`);
  assert.match(panel, /ReaderBookmarkList\(\{/,
    `${name} content state must render the bookmark list component`);
}

assert.match(modulePanel, /readerBookmarkLoadState\(this\.entries\) === 'loading'/);
assert.match(modulePanel, /projectReaderBookmarkRows\(this\.entries, '', this\.bookmarkIdentity\)/);
assert.doesNotMatch(modulePanel, /bookmarkedEntries\.push/,
  'module bookmark tab must not reuse chapter rows as bookmarks');
assert.match(modulePanel,
  /rowBuilder: \(repeatItem: RepeatItem<LocalReadingTocEntry>\) => \{\s*this\.chapterRow\(repeatItem\);/,
  'directory rows must be injected through an inline arrow-closure builder (no method reference)');

assert.match(fullPanel, /@State private projectedBookmarks: ReaderBookmarkRowModel\[\] = \[\]/);
assert.match(fullPanel, /const nextQuery = this\.searchDraft\.trim\(\);\s*this\.searchQuery = nextQuery;\s*this\.rebuildProjection\(this\.activeTab, this\.ascending, nextQuery\);/,
  'search must forward the freshly trimmed query explicitly');
assert.match(fullPanel, /projectReaderBookmarkRows\(\s*sourceEntries, query, this\.bookmarkIdentity\)/);
assert.match(fullPanel,
  /rowBuilder: \(repeatItem: RepeatItem<LocalReadingTocEntry>\) => \{\s*this\.chapterRow\(repeatItem\);/,
  'full directory rows must use the inline arrow-closure builder');
assert.doesNotMatch(fullPanel, /private bookmarkRow\(/,
  'full panel must not keep its own bookmark row builder');
assert.doesNotMatch(fullPanel, /(?:const|let|var)\s+BOOKMARK_ROW_HEIGHT\s*=/,
  'bookmark row geometry must not be redefined in the panel');
assert.match(fullPanel, /import \{ BOOKMARK_ROW_HEIGHT \} from '\.\/ReaderBookmarkRow'/,
  'initial list positioning must consume the real row owner height, not a copied constant');

// Directory list frame: lazy creation with the no-reuse policy intact.
assert.match(directoryList, /List\(\{ space: 0, scroller: this\.scroller \}\)/);
assert.match(directoryList,
  /LazyForEach\(this\.dataSource[\s\S]*reader-directory-row-\$\{entry\.index\}/,
  'directory list must keep lazy creation and stable chapter identity');
assert.match(directoryList, /@BuilderParam rowBuilder: \(repeatItem: RepeatItem<LocalReadingTocEntry>\) => void;/);
assert.match(directoryList, /onFirstLayout/);

// Bookmark list: one row per bookmark, stable per-bookmark identity.
assert.match(bookmarkList,
  /Repeat\(this\.rows\)[\s\S]*\.key\(\(row: ReaderBookmarkRowModel\): string => `reader-bookmark-\$\{row\.bookmarkId\}`\)[\s\S]*\.virtualScroll\(\{ totalCount: this\.rows\.length, reusable: false \}\)/,
  'bookmark rows must key on the stable bookmark id with no node reuse');
assert.match(bookmarkList, /ReaderBookmarkRow\(\{\s*row: repeatItem\.item,\s*onSelectBookmark: this\.onSelectBookmark,/);

// Bookmark row: exact-anchor tap plus the full field set.
assert.match(bookmarkRow,
  /onClick\(\(\): void =>\s*this\.onSelectBookmark\(this\.row\.bookmarkId, this\.row\.chapterIndex, this\.row\.chapterOffset, this\.row\.positionScope\)\)/,
  'row tap must emit the exact bookmark anchor');
for (const field of ['chapterTitle', 'excerpt', 'positionLabel', 'timeLabel']) {
  assert.match(bookmarkRow, new RegExp(`this\\.row\\.${field}`), `row must render ${field}`);
}
assert.match(bookmarkRow, /reader_directory_marker_bookmark_active/);
assert.match(bookmarkRow, /pendingConfirmation/);

// Strict empty state: icon + title + hint + return button, nothing else.
assert.match(bookmarkEmpty, /reader_directory_marker_bookmark'/);
assert.match(bookmarkEmpty, /暂无书签/);
assert.match(bookmarkEmpty, /在阅读页面点按书签图标即可收藏当前位置/);
assert.match(bookmarkEmpty, /返回目录/);
assert.match(bookmarkEmpty, /onClick\(\(\): void => this\.onReturnToDirectory\(\)\)/);
assert.doesNotMatch(bookmarkEmpty, /List\(/, 'empty state must never render a list');

assert.match(bookmarkLoading, /LoadingProgress\(\)/);
assert.match(bookmarkLoading, /书签载入中…/);
assert.match(bookmarkError, /@Prop message: string/);
assert.match(bookmarkError, /onRetry/);
assert.match(bookmarkError, /重试/);

console.log('reader bookmark panels static contract: PASS');
