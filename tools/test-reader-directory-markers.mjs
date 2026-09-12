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
const directoryList = read('entry/src/main/ets/features/reading/ReaderDirectoryList.ets');
assert.match(modulePanel, /@State private activeTab: string = 'directory'/);
assert.match(modulePanel, /this\.switchTab\('bookmarks'\)/);
assert.match(modulePanel, /if \(tab === 'directory'\) \{\s*this\.projectedEntries = this\.entries;/);
assert.match(modulePanel, /projectReaderBookmarkRows\(this\.entries, '', this\.bookmarkIdentity\)/,
  'module bookmark tab must use the behavior-tested flat bookmark projection');
assert.match(directoryList, /List\(\{ space: 0, scroller: this\.scroller \}\)/);
assert.match(directoryList,
  /LazyForEach\(this\.dataSource[\s\S]*reader-directory-row-/,
  'module directory must keep lazy creation without the phone runtime row-reuse corruption');
assert.match(modulePanel, /this\.chapterRow\(repeatItem\)/);
assert.match(modulePanel, /private chapterRow\(repeatItem: RepeatItem<LocalReadingTocEntry>\)/,
  'Repeat builders must forward the complete reactive RepeatItem into a Builder');
assert.doesNotMatch(modulePanel, /Scroll\(this\.listScroller\)[\s\S]*ForEach\(/,
  'module directory must not eagerly materialize every chapter row');
assert.match(modulePanel, /private downloadMarkerHitTarget\(entry: LocalReadingTocEntry\)/);
assert.match(modulePanel, /chapterDownloadEnabled: boolean = false/);
assert.match(modulePanel, /\.enabled\(this\.chapterDownloadEnabled && this\.downloadMarkerEnabled\(entry\)\)/);
assert.match(directoryList, /reader-directory-row-\$\{entry\.index\}/,
  'module rows must use stable chapter identity');
assert.doesNotMatch(directoryList, /reader-directory-row-\$\{entry\.index\}-\$\{entry\.downloadState\}/,
  'mutable download state must not become virtual-list identity');
assert.match(modulePanel, /else if \(this\.chapterDownloadEnabled\) \{\s*this\.downloadMarkerHitTarget\(entry\);/,
  'local sessions may keep read markers but must not render download markers');
assert.match(modulePanel, /\.onClick\(\(\): void => this\.onDownloadChapter\(entry\.index\)\)/);
assert.match(modulePanel, /entry\.downloadState === 'missing' \|\| entry\.downloadState === 'cached'/);
assert.match(modulePanel, /private bookmarkMarkerHitTarget\(entry: LocalReadingTocEntry\)/);
assert.match(modulePanel, /onDeleteBookmarks: \(bookmarkTimes: number\[\]\) => void/);
assert.match(modulePanel, /onCreateChapterStartBookmark: \(request: ReaderDirectoryChapterStartBookmarkRequest\) => void/);
assert.match(modulePanel, /chapterStartBookmarkCreationEnabled: boolean = false/);
assert.match(modulePanel, /markerState\.kind === 'bookmarked'[\s\S]*this\.onDeleteBookmarks\(markerState\.bookmarkTimes\)/);
assert.match(modulePanel, /markerState\.kind === 'empty' && this\.chapterStartBookmarkCreationEnabled[\s\S]*this\.onCreateChapterStartBookmark\(markerState\.createRequest\)/);
assert.doesNotMatch(modulePanel, /添加书签尚未接线/);
assert.match(modulePanel, /\.accessibilityText\(`打开章节：\$\{repeatItem\.item\.title\}`\)\s*\.onClick\(\(\): void => this\.onSelectChapter\(repeatItem\.item\.index\)\)/);

const fullPanel = read('entry/src/main/ets/features/reading/FullDirectoryPanel.ets');
const bookmarkList = read('entry/src/main/ets/features/reading/ReaderBookmarkList.ets');
const typography = read('entry/src/main/ets/features/common/ReaderTypography.ets');
const ascendingSortIcon = read('entry/src/main/resources/base/media/reader_directory_sort_ascending.svg');
const descendingSortIcon = read('entry/src/main/resources/base/media/reader_directory_sort_descending.svg');
assert.match(fullPanel, /this\.switchTab\('bookmarks'\)/);
assert.match(fullPanel, /@State private projectedBookmarks: ReaderBookmarkRowModel\[\] = \[\]/);
assert.match(fullPanel, /projectReaderBookmarkRows\(\s*sourceEntries, query, this\.bookmarkIdentity\)/,
  'bookmark tab must use the behavior-tested projection');
assert.match(fullPanel, /projectReaderDirectoryEntries\(sourceEntries, query, ascending\)/,
  'sort and search must use the behavior-tested complete TOC projection');
assert.match(directoryList, /List\(\{ space: 0, scroller: this\.scroller \}\)/);
assert.match(directoryList,
  /LazyForEach\(this\.dataSource[\s\S]*reader-directory-row-/,
  'full directory must keep lazy creation while disabling unsafe row-node reuse');
assert.match(fullPanel, /this\.chapterList\(\);/,
  'the keyed virtual List must retain one native identity through projection changes');
assert.doesNotMatch(fullPanel, /projectionMountPrimary|this\.projectionMountPrimary/,
  'projection changes must not remount the native List during a control morph');
assert.match(fullPanel, /this\.chapterRow\(repeatItem\)/);
assert.match(fullPanel, /private chapterRow\(repeatItem: RepeatItem<LocalReadingTocEntry>\)/,
  'full directory must forward the complete reactive RepeatItem into its Builder');
assert.match(bookmarkList,
  /Repeat\(this\.rows\)[\s\S]*\.virtualScroll\(\{ totalCount: this\.rows\.length, reusable: false \}\)/,
  'bookmark rows must use the same safe virtual-list policy');
assert.doesNotMatch(fullPanel, /Scroll\(this\.listScroller\)[\s\S]*ForEach\(/,
  'full directory must not eagerly materialize every filtered chapter row');
assert.match(fullPanel, /private downloadMarkerHitTarget\(entry: LocalReadingTocEntry\)/);
assert.match(fullPanel, /private bookmarkMarkerHitTarget\(entry: LocalReadingTocEntry\)/);
assert.match(fullPanel, /onDeleteBookmarks: \(bookmarkTimes: number\[\]\) => void/);
assert.match(fullPanel, /onCreateChapterStartBookmark: \(request: ReaderDirectoryChapterStartBookmarkRequest\) => void/);
assert.match(fullPanel, /chapterStartBookmarkCreationEnabled: boolean = false/);
assert.match(fullPanel, /this\.onDeleteBookmarks\(markerState\.bookmarkTimes\)/);
assert.match(fullPanel, /this\.onCreateChapterStartBookmark\(markerState\.createRequest\)/);
assert.doesNotMatch(fullPanel, /添加书签尚未接线/);
assert.match(fullPanel, /chapterDownloadEnabled: boolean = false/);
assert.match(fullPanel, /\.enabled\(this\.chapterDownloadEnabled && this\.downloadMarkerEnabled\(entry\)\)/);
// Full-directory chapter identity now lives in the shared ReaderDirectoryList
// key (asserted above); lock out the mutable-state suffix here.
assert.doesNotMatch(directoryList, /reader-directory-row-\$\{entry\.index\}-\$\{entry\.downloadState\}/,
  'mutable download state must not become virtual-list identity');
assert.match(fullPanel, /if \(this\.chapterDownloadEnabled && repeatItem\.item\.downloadState !== 'unknown'\)/,
  'the full local directory must not render download markers');
assert.match(fullPanel, /\.onClick\(\(\): void => this\.onDownloadChapter\(entry\.index\)\)/);
assert.match(fullPanel, /\.accessibilityText\(`打开章节：\$\{repeatItem\.item\.title\}`\)\s*\.onClick\(\(\): void => this\.onSelectChapter\(repeatItem\.item\.index\)\)/);
assert.match(fullPanel,
  /if \(this\.ascending\) \{\s*Image\(\$r\('app\.media\.reader_directory_sort_ascending'\)\)[\s\S]*?\} else \{\s*Image\(\$r\('app\.media\.reader_directory_sort_descending'\)\)/,
  'ascending and descending must render two explicit icon resources');
assert.doesNotMatch(fullPanel, /reader_directory_sort[\s\S]*?\.rotate\(/,
  'sort direction must not be synthesized by rotating one icon');
assert.match(ascendingSortIcon, /M30 18L36 12L42 18/,
  'ascending icon must keep the list bars and point its arrow up');
assert.match(descendingSortIcon, /M30 30L36 36L42 30/,
  'descending icon must keep the list bars and point its arrow down');
assert.notEqual(ascendingSortIcon, descendingSortIcon,
  'sort directions must remain separate source assets');
assert.match(fullPanel,
  /const nextAscending = !this\.ascending;[\s\S]*this\.ascending = nextAscending;[\s\S]*this\.rebuildProjection\(this\.activeTab, nextAscending, this\.searchQuery\);/,
  'sort must project from the explicit next value instead of reading stale ArkUI state back');
assert.match(fullPanel, /private rebuildProjection\(tab: string, ascending: boolean, query: string\): void/);
assert.doesNotMatch(fullPanel, /rebuildProjection\(\)/,
  'every projection rebuild must receive an explicit order value');
assert.match(fullPanel, /ReaderSearchField\(\{[\s\S]*variant: 'readerDirectory'/,
  'directory and bookmark tabs must enter the same typed search-field path');
assert.match(typography,
  /TYPE_SEARCH_DIRECTORY_INPUT = new ReaderTextStyle\([\s\S]*?10, undefined, undefined, 'system', 'figmaNode'\)/,
  'directory search must retain its 10fp role while leaving line height on ArkUI AUTO');
assert.doesNotMatch(fullPanel, /DIRECTORY_SEARCH_(FONT_SIZE|LINE_HEIGHT)/,
  'directory typography must not regress to a page-local hard-coded pair');
assert.match(fullPanel,
  /private scheduleProjectionTopScroll\(\): void \{[\s\S]*const generation = this\.projectionScrollGeneration;[\s\S]*generation !== this\.projectionScrollGeneration[\s\S]*this\.listScroller\.scrollEdge\(Edge\.Top\);[\s\S]*\}, 0\);/,
  'projection scrolling must wait for the remounted List and ignore stale rapid-tap work');
assert.match(fullPanel,
  /this\.ascending = nextAscending;[\s\S]*this\.rebuildProjection\(this\.activeTab, nextAscending, this\.searchQuery\);[\s\S]*this\.scheduleProjectionTopScroll\(\);/,
  'sort must schedule its top scroll after the projection change');
assert.match(fullPanel, /reader_directory_marker_bookmark_active/);

const fullDirectory = read('entry/src/main/ets/features/reading/ReaderFullDirectory.ets');
assert.match(fullDirectory, /onDeleteBookmarks: \(bookmarkTimes: number\[\]\) => void/);
assert.match(fullDirectory, /onDeleteBookmarks: \(bookmarkTimes: number\[\]\): void => this\.onDeleteBookmarks\(bookmarkTimes\)/);
assert.match(fullDirectory, /chapterStartBookmarkCreationEnabled: boolean = false/);
assert.match(fullDirectory, /onCreateChapterStartBookmark: \(request: ReaderDirectoryChapterStartBookmarkRequest\) => void/);
assert.match(fullDirectory, /chapterStartBookmarkCreationEnabled: this\.chapterStartBookmarkCreationEnabled/);
assert.match(fullDirectory, /chapterDownloadEnabled: this\.sourceId !== 'local'/);
assert.match(fullDirectory, /onDownloadChapter: \(index: number\): void => this\.onDownloadChapter\(index\)/);
assert.match(fullDirectory, /onDownloadBook: \(\) => void/);
assert.match(fullDirectory, /onClearBookOffline: \(\) => void/);
assert.match(fullDirectory, /Text\('下载整书'\)/);
assert.match(fullDirectory, /Text\('清除本书离线'\)/);
assert.match(fullDirectory, /this\.offlineMenuVisible = !this\.offlineMenuVisible/);
assert.match(fullDirectory, /@State private containerWidth: number = 0/);
assert.match(fullDirectory, /panelWidthOverride: this\.panelWidth\(\)/);
assert.match(fullDirectory,
  /new SurfaceWidthSpec\(720, 27, 13, 'right'\)[\s\S]*new SurfaceWidthSpec\(364, 12, 12, 'center'\)[\s\S]*resolveHorizontalFrame\(/,
  'full directory must treat 364/720 as shared-geometry maxima rather than layout gates');

const gateway = read('entry/src/main/ets/features/reading/LocalReadingFlowGateway.ts');
assert.match(gateway, /async createChapterStartBookmark\(/);
assert.match(gateway,
  /createPositionBookmark\(\{[\s\S]*chapterOffset: 0,[\s\S]*chapterTitle: input\.chapterTitle/,
  'chapter markers must reuse the general exact-position Core bookmark path');
assert.match(gateway, /async loadBookmarkProjection\(/,
  'bookmark projection must be source-independent');
assert.match(gateway, /async createPositionBookmark\(/);
assert.match(gateway, /request\('bookmark\.create', \{\s*bookName: input\.bookName,\s*bookAuthor: input\.bookAuthor,\s*chapterIndex: input\.chapterIndex,\s*chapterPos: input\.chapterOffset,\s*chapterName: input\.chapterTitle,/);
assert.match(gateway, /bookmark\.create returned a mismatched position bookmark/);
assert.match(gateway, /async deleteBookmark\(\s*time: number,/);
assert.match(gateway, /request\('bookmark\.delete', \{\s*time,/);
assert.match(gateway, /bookmark\.delete returned a mismatched time/);
assert.match(gateway, /typeof deleted !== 'boolean'/);
assert.doesNotMatch(gateway, /request\('cache\.book\.prefetch'/);

const index = read('entry/src/main/ets/pages/Index.ets');
assert.match(index, /private directoryBookmarkMutationGeneration: number = 0/);
assert.match(index, /private directoryBookmarkMutationActiveKey: string = ''/);
assert.match(index, /new ReadingOfflineGateway\(ReaderRuntimeOwner\.current\(\)\)[\s\S]*\.prefetchChapter\(session, chapterIndex, isCurrent\)/);
assert.match(index, /\.prefetchBook\(session, isCurrent/);
assert.match(index, /\.clearBook\(session, isCurrent\)/);
assert.match(index, /title: '清除本书离线内容'[\s\S]*?value: '取消'[\s\S]*?value: '清除'/,
  'whole-book cache deletion must require confirmation');
assert.match(index, /private beginDirectoryBookmarkMutation\(book: ReadingBookDetail\): number/,
  'bookmark mutation identity must accept the shared detail model');
assert.match(index, /chapterStartBookmarkCreationEnabled: true/,
  'local and remote directory rows must both admit chapter-start bookmarks');
assert.doesNotMatch(index, /book\.sourceId !== LOCAL_SOURCE_ID \|\| bookmarkTimes\.length/,
  'bookmark deletion must not be local-source gated');
assert.doesNotMatch(index, /book\.sourceId !== LOCAL_SOURCE_ID \|\|\s*!Number\.isSafeInteger\(request\.chapterIndex\)/,
  'bookmark creation must not be local-source gated');
assert.match(index, /loadRemoteDirectoryProjection\([\s\S]*loadBookmarkProjection/,
  'remote offline and bookmark projections must be merged');
assert.match(index, /if \(this\.directoryBookmarkMutationActiveKey === key \|\| this\.controlBookmarkProjectionMessage\(\)\.length > 0\) \{\s*return -1;/,
  'same-book pending mutations and unverified outcomes must reject duplicate create/delete mutations');
assert.match(index, /private toggleReaderPageBookmark\(request: ReaderPageBookmarkToggleRequest\): void/);
assert.match(index, /gateway\.createPositionBookmark\(\{/,
  'the pull-down gesture must mutate the same Core bookmark truth at the physical page anchor');
assert.equal((index.match(/const mutationGeneration = this\.beginDirectoryBookmarkMutation\(book\)/g) ?? []).length, 3,
  'directory create/delete and page toggle must acquire the same mutation guard');
assert.equal((index.match(/this\.finishDirectoryBookmarkMutation\(mutationGeneration, mutationKey\)/g) ?? []).length, 3,
  'all three async mutation paths must release their exact guard in finally');
assert.match(index, /private isDirectoryBookmarkMutationCurrent\(generation: number, key: string\): boolean \{[\s\S]*generation === this\.directoryBookmarkMutationGeneration &&[\s\S]*key === this\.directoryBookmarkMutationActiveKey/,
  'an old request must not clear the guard owned by a newer book mutation');
assert.equal((index.match(/this\.isDirectoryBookmarkMutationCurrent\(mutationGeneration, mutationKey\)/g) ?? []).length, 3,
  'all Core request guards must include the bookmark mutation generation');

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
