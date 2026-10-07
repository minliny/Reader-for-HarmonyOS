import type { ShelfBook } from '../../app/ReaderCoreGateway';
import type { LocalReadingDownloadState } from '../reading/LocalReadingFlowGateway';

export type DownloadContentKind = 'novel' | 'manga';
export type DownloadBookState = 'downloading' | 'downloaded' | 'none';
export type DownloadProjectionStatus = 'unloaded' | 'ready' | 'unavailable';

/** Verified storage-owner measurements; unknown is never a bookshelf estimate. */
export interface DownloadStorageSummary {
  totalBytes?: number;
  retainedBytes?: number;
  automaticBytes?: number;
  /** Executable candidates after protected reading/download content is excluded. */
  cleanableBytes?: number;
  availableBytes?: number;
}

function validDownloadStorageBytes(bytes: number | undefined): boolean {
  return bytes !== undefined && Number.isSafeInteger(bytes) && bytes >= 0;
}

export function formatDownloadStorageBytes(bytes: number | undefined): string {
  if (bytes === undefined || !validDownloadStorageBytes(bytes)) return '';
  if (bytes === 0) return '0 MB';
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  if (bytes >= 1024 * 1024) return `${Math.round(bytes / (1024 * 1024))} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

export function canCleanDownloadStorage(summary: DownloadStorageSummary): boolean {
  const cleanable = summary.cleanableBytes;
  const automatic = summary.automaticBytes;
  return cleanable !== undefined && automatic !== undefined && validDownloadStorageBytes(cleanable) &&
    validDownloadStorageBytes(automatic) && cleanable > 0 && cleanable <= automatic;
}

export interface DownloadChapterView {
  key: string;
  sourceId: string;
  bookId: string;
  index: number;
  title: string;
  /** Exact catalog chapter identity; never a display ordinal. */
  chapterId: string;
  navigable: boolean;
  level?: number;
  localComplete: boolean;
  stateLabel: string;
  queueState: LocalReadingDownloadState;
  /** Core text-body bytes. Not a manga image/disk-size measurement. */
  cachedBytes?: number;
  mangaManifestVersion?: string;
  /** Validated complete-chapter size; an entry window is not this total. */
  mangaTotalPages?: number;
  /** Proven image count only; incomplete does not mean zero saved images. */
  mangaSavedPages?: number;
}

export interface DownloadBookView {
  key: string;
  shelfBook: ShelfBook;
  sourceId: string;
  bookId: string;
  coverUrl?: string;
  title: string;
  author: string;
  sourceLabel: string;
  /** Audio remains in All with no invented novel/manga label. */
  contentKind?: DownloadContentKind;
  /** Only proven navigable entries count; volume headings never count. */
  totalChapters?: number;
  downloadedChapters?: number;
  state?: DownloadBookState;
  stateLabel: string;
  progressPercent?: number;
  /** Unknown when the existing Host cannot measure this book's image bytes. */
  bytes?: number;
  recentRead?: number;
  chapters: DownloadChapterView[];
  projectionStatus: DownloadProjectionStatus;
  projectionError?: string;
}

export interface SharedDownloadFilters {
  query: string;
  type: 'all' | DownloadContentKind;
  state: 'all' | DownloadBookState;
  sourceId: string;
  sort: 'recent' | 'title' | 'progress' | 'size';
  direction: 'asc' | 'desc';
}

export interface DownloadReadingTarget {
  sourceId: string;
  bookId: string;
  contentKind?: DownloadContentKind;
  chapterIndex?: number;
  chapterId?: string;
  chapterTitle?: string;
  route: 'novelReader' | 'mangaReader' | 'unavailable';
  label: string;
  description: string;
  /** This delivery describes a route; it does not navigate or write progress. */
  wired: false;
}

export function sharedDownloadBookKey(book: { sourceId: string; bookId: string }): string {
  return JSON.stringify([book.sourceId, book.bookId]);
}

/** Immediately show every real shelf row while availability is being read. */
export function createDownloadBookView(book: ShelfBook): DownloadBookView {
  const contentKind = book.contentKind === 'manga' ? 'manga' :
    book.contentKind === 'audio' ? undefined : 'novel';
  return {
    key: sharedDownloadBookKey(book),
    shelfBook: { ...book, readingPosition: book.readingPosition === undefined ? undefined : { ...book.readingPosition } },
    sourceId: book.sourceId, bookId: book.bookId, coverUrl: book.coverUrl,
    title: book.title, author: book.author,
    sourceLabel: book.sourceName ?? (book.sourceId === 'local' ? '本地' : ''),
    contentKind, recentRead: book.lastReadAt, chapters: [], stateLabel: '',
    projectionStatus: contentKind === undefined ? 'unavailable' : 'unloaded',
    projectionError: contentKind === undefined ? '当前下载页尚未支持音频内容' : undefined,
  };
}

export function downloadChapterStateLabel(state: LocalReadingDownloadState, complete: boolean): string {
  if (complete) return '已下载';
  if (state === 'failed') return '下载失败';
  if (state === 'inProgress' || state === 'queued') return '下载中';
  if (state === 'paused') return '已暂停';
  return state === 'unknown' ? '' : '未下载';
}

export function downloadChapterDetailLabel(kind: DownloadContentKind | undefined, chapter: DownloadChapterView): string {
  let content = '';
  if (kind === 'novel') {
    if (chapter.localComplete) content = '正文已保存';
    else if (chapter.queueState === 'inProgress') content = '正在获取正文';
  } else if (kind === 'manga' && chapter.mangaTotalPages !== undefined) {
    content = `${chapter.mangaSavedPages ?? ''} / ${chapter.mangaTotalPages} 页`;
  }
  return content.length === 0 ? chapter.stateLabel : chapter.stateLabel.length === 0 ? content : `${content} · ${chapter.stateLabel}`;
}

export function projectDownloadBookAvailability(view: DownloadBookView,
  chapters: DownloadChapterView[], totalChapters: number | undefined, bytes?: number): DownloadBookView {
  const readable = chapters.filter(chapter => chapter.navigable);
  const downloadedChapters = readable.filter(chapter => chapter.localComplete).length;
  const pendingRows = readable.filter(chapter => !chapter.localComplete);
  const active = pendingRows.some(chapter => chapter.queueState === 'queued' || chapter.queueState === 'inProgress');
  const failed = pendingRows.some(chapter => chapter.queueState === 'failed');
  const paused = pendingRows.some(chapter => chapter.queueState === 'paused');
  const pending = active || failed || paused;
  // The coarse status describes available local content, not 100% of a book.
  // The independent ratio reports how much is downloaded. Without a catalog,
  // an empty projection cannot prove that the book has no downloadable content.
  const state: DownloadBookState | undefined = pending ? 'downloading' :
    downloadedChapters > 0 ? 'downloaded' : totalChapters !== undefined ? 'none' : undefined;
  const stateLabel = failed ? '下载失败' : active ? '下载中' : paused ? '已暂停' :
    downloadedChapters > 0 ? '已下载' : state === 'none' ? '未下载' : '';
  return { ...view, chapters, totalChapters, downloadedChapters, state, stateLabel, bytes,
    progressPercent: totalChapters === undefined || totalChapters === 0 ? undefined :
      Math.min(100, Math.round(downloadedChapters / totalChapters * 100)),
    projectionStatus: 'ready', projectionError: undefined };
}

function compareKnownNumber(left: number | undefined, right: number | undefined,
  direction: 'asc' | 'desc'): number {
  if (left === undefined) return right === undefined ? 0 : 1;
  if (right === undefined) return -1;
  return direction === 'asc' ? left - right : right - left;
}

export function filterDownloadBooks(books: DownloadBookView[], filters: SharedDownloadFilters): DownloadBookView[] {
  const query = filters.query.trim().toLowerCase();
  const selected = books.filter(book =>
    (filters.type === 'all' || book.contentKind === filters.type) &&
    (filters.state === 'all' || book.state === filters.state) &&
    (filters.sourceId === 'all' || filters.sourceId.length === 0 || book.sourceId === filters.sourceId) &&
    (query.length === 0 || `${book.title}\n${book.author}\n${book.sourceLabel}`.toLowerCase().includes(query)));
  return selected.sort((left, right) => {
    let result = 0;
    if (filters.sort === 'title') result = filters.direction === 'asc' ?
      left.title.localeCompare(right.title) : right.title.localeCompare(left.title);
    else if (filters.sort === 'recent') result = compareKnownNumber(left.recentRead, right.recentRead, filters.direction);
    else if (filters.sort === 'progress') result = compareKnownNumber(left.progressPercent, right.progressPercent, filters.direction);
    else result = compareKnownNumber(left.bytes, right.bytes, filters.direction);
    return result === 0 ? left.key.localeCompare(right.key) : result;
  });
}

/** Correct target labels only. Opening a directory is not starting reading. */
export function describeDownloadReadingTarget(book: DownloadBookView,
  chapter?: DownloadChapterView): DownloadReadingTarget {
  const kindLabel = book.contentKind === 'manga' ? '漫画图片阅读页' : book.contentKind === 'novel' ? '小说正文阅读页' : '暂不支持阅读';
  const route = book.contentKind === 'manga' ? 'mangaReader' : book.contentKind === 'novel' ? 'novelReader' : 'unavailable';
  const selected = chapter === undefined ? undefined : book.chapters.find(entry =>
    book.key === sharedDownloadBookKey(chapter) &&
    chapter.key === JSON.stringify([book.sourceId, book.bookId, chapter.index]) &&
    entry.key === chapter.key && entry.index === chapter.index && entry.chapterId === chapter.chapterId &&
    entry.sourceId === book.sourceId && entry.bookId === book.bookId &&
    chapter.sourceId === book.sourceId && chapter.bookId === book.bookId && entry.navigable && chapter.navigable);
  const exact = selected !== undefined;
  const resumeIndex = book.shelfBook.currentChapterIndex ?? book.shelfBook.readingPosition?.chapterIndex;
  const resume = chapter === undefined ? book.chapters.find(entry => entry.navigable &&
    entry.sourceId === book.sourceId && entry.bookId === book.bookId && entry.index === resumeIndex) : undefined;
  const first = chapter === undefined && resumeIndex === undefined && book.projectionStatus === 'ready' &&
    book.totalChapters !== undefined ?
    book.chapters.find(entry => entry.navigable && entry.sourceId === book.sourceId && entry.bookId === book.bookId) : undefined;
  const target = selected ?? resume ?? first;
  const chapterLabel = chapter !== undefined && !exact ? '该目录条目不能作为阅读目标' :
    target !== undefined ? target.title : resumeIndex !== undefined ?
      '继续上次阅读（具体章节尚未确认）' : '起始章节尚未确认';
  return { sourceId: book.sourceId, bookId: book.bookId, contentKind: book.contentKind,
    chapterIndex: target?.index, chapterId: target === undefined || target.chapterId.length === 0 ? undefined : target.chapterId,
    chapterTitle: target?.title,
    route: chapter !== undefined && !exact ? 'unavailable' : route,
    label: '阅读', description: `${kindLabel} · 《${book.title}》 · ${chapterLabel}；阅读入口尚未接线`, wired: false };
}
