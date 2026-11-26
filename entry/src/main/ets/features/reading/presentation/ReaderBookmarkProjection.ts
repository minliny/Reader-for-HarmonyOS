import type { RemoteReadingPositionScope } from '../application/RemoteReadingPositionMigration';
import type { LocalReadingBookmark, LocalReadingTocEntry } from '../application/LocalReadingFlowGateway';

/**
 * Stable book identity for bookmark ownership. The legacy "bookName+bookAuthor"
 * pairing survives only as a migration input; every migrated record carries one
 * of these identities or is explicitly marked pendingConfirmation.
 */
export type ReaderBookIdentity = {
  libraryBookId: string;
  sourceId: string;
  bookId: string;
  bookName: string;
  bookAuthor: string;
};

export type ReaderBookmarkIdentityStatus = 'confirmed' | 'pendingConfirmation';

/** Bookmark record with stable identity, produced by legacy data migration. */
export type ReaderBookmarkRecord = {
  positionScope?: RemoteReadingPositionScope;
  bookmarkId: string;
  identityStatus: ReaderBookmarkIdentityStatus;
  libraryBookId: string;
  sourceId: string;
  bookId: string;
  bookName: string;
  bookAuthor: string;
  time: number;
  chapterIndex: number;
  chapterOffset: number;
  chapterTitle: string;
  content: string;
  bookText?: string;
};

/** Legacy storage shape: ownership carried only by bookName+bookAuthor. */
export type ReaderLegacyBookmark = {
  positionScope?: RemoteReadingPositionScope;
  bookName: string;
  bookAuthor: string;
  time: number;
  chapterIndex: number;
  chapterOffset: number;
  chapterTitle: string;
  content: string;
  bookText?: string;
};

/** Row model rendered by ReaderBookmarkRow; pure data, no UI types. */
export type ReaderBookmarkRowModel = {
  positionScope?: RemoteReadingPositionScope;
  /** Location proof is separate from the bookmark's book ownership. */
  positionStatus?: 'confirmed' | 'unverified';
  bookmarkId: string;
  identityStatus: ReaderBookmarkIdentityStatus;
  chapterIndex: number;
  chapterOffset: number;
  chapterTitle: string;
  excerpt: string;
  positionLabel: string;
  timeLabel: string;
};

export type ReaderBookmarkLoadState = 'loading' | 'ready';

export interface ReaderBookmarkEmptyCopy {
  title: string;
  message: string;
  action: string;
}

const BOOKMARK_EMPTY_COPY: ReaderBookmarkEmptyCopy = {
  title: '暂无书签', message: '在阅读页面下拉，收藏当前位置。', action: '返回目录',
};
const BOOKMARK_FILTERED_EMPTY_COPY: ReaderBookmarkEmptyCopy = {
  title: '没有匹配的书签', message: '', action: '清除搜索',
};

export function readerBookmarkEmptyCopy(filtered: boolean): ReaderBookmarkEmptyCopy {
  return filtered ? BOOKMARK_FILTERED_EMPTY_COPY : BOOKMARK_EMPTY_COPY;
}

/**
 * Deterministic bookmark identity. JSON encoding keeps the tuple unambiguous
 * even when names contain separator characters.
 */
export function readerBookmarkRecordId(
  bookName: string,
  bookAuthor: string,
  chapterIndex: number,
  chapterOffset: number,
  time: number,
): string {
  return JSON.stringify([bookName, bookAuthor, chapterIndex, chapterOffset, time]);
}

export type ReaderBookmarkIdentityResolver =
  (bookName: string, bookAuthor: string) => ReaderBookIdentity | undefined;

/** Resolver bound to one session book: only exact name+author matches resolve. */
export function readerBookmarkIdentityForBook(identity: ReaderBookIdentity): ReaderBookmarkIdentityResolver {
  return (bookName: string, bookAuthor: string): ReaderBookIdentity | undefined =>
    bookName === identity.bookName && bookAuthor === identity.bookAuthor ? identity : undefined;
}

/**
 * Legacy -> stable-identity migration. Records whose ownership cannot be
 * resolved stay pendingConfirmation with their original name+author preserved;
 * they are never auto-merged into another book.
 */
export function migrateLegacyBookmarks(
  legacy: ReaderLegacyBookmark[],
  resolveIdentity: ReaderBookmarkIdentityResolver,
): ReaderBookmarkRecord[] {
  const records: ReaderBookmarkRecord[] = [];
  for (const item of legacy) {
    const identity = resolveIdentity(item.bookName, item.bookAuthor);
    const bookmarkId = readerBookmarkRecordId(
      item.bookName, item.bookAuthor, item.chapterIndex, item.chapterOffset, item.time);
    if (identity === undefined) {
      records.push({
        bookmarkId,
        ...(item.positionScope === undefined ? {} : { positionScope: item.positionScope }),
        identityStatus: 'pendingConfirmation',
        libraryBookId: '',
        sourceId: '',
        bookId: '',
        bookName: item.bookName,
        bookAuthor: item.bookAuthor,
        time: item.time,
        chapterIndex: item.chapterIndex,
        chapterOffset: item.chapterOffset,
        chapterTitle: item.chapterTitle,
        content: item.content,
        bookText: item.bookText,
      });
      continue;
    }
    records.push({
      bookmarkId,
      ...(item.positionScope === undefined ? {} : { positionScope: item.positionScope }),
      identityStatus: 'confirmed',
      libraryBookId: identity.libraryBookId,
      sourceId: identity.sourceId,
      bookId: identity.bookId,
      bookName: identity.bookName,
      bookAuthor: identity.bookAuthor,
      time: item.time,
      chapterIndex: item.chapterIndex,
      chapterOffset: item.chapterOffset,
      chapterTitle: item.chapterTitle,
      content: item.content,
      bookText: item.bookText,
    });
  }
  return records;
}

/**
 * `loading` while any TOC entry has not been admitted by the Core bookmark
 * projection yet; `ready` once every entry carries the confirmed fact.
 */
export function readerBookmarkLoadState(entries: LocalReadingTocEntry[]): ReaderBookmarkLoadState {
  for (const entry of entries) {
    if (entry.bookmarks === undefined) {
      return 'loading';
    }
  }
  return 'ready';
}

/** Project quotes for the current chapter without changing the admitted records. */
export function projectReaderChapterBookmarkExcerpts(
  entries: LocalReadingTocEntry[],
  chapterIndex: number,
  matchesChapter: (mark: LocalReadingBookmark) => boolean,
  excerptFor: (mark: LocalReadingBookmark) => string | undefined,
): LocalReadingTocEntry[] {
  const entry = entries.find((candidate: LocalReadingTocEntry): boolean => candidate.index === chapterIndex);
  if (entry?.bookmarks === undefined) return entries;
  let changed = false;
  const bookmarks = entry.bookmarks.map((mark: LocalReadingBookmark): LocalReadingBookmark => {
    if (!matchesChapter(mark)) {
      if (mark.positionScope === undefined) return mark;
      changed = true;
      // A parent projection can still carry a proof from the previous body.
      // Keep the stored quote without reusing its offset as a current coordinate.
      return { time: mark.time, chapterIndex: mark.chapterIndex, chapterOffset: mark.chapterOffset,
        chapterTitle: mark.chapterTitle, content: mark.content, bookText: mark.bookText, positionScope: undefined };
    }
    if ((mark.bookText ?? '').length > 0) return mark;
    const excerpt = excerptFor(mark);
    if (excerpt === undefined) return mark;
    changed = true;
    return { time: mark.time, chapterIndex: mark.chapterIndex, chapterOffset: mark.chapterOffset,
      chapterTitle: mark.chapterTitle, content: mark.content, bookText: excerpt, positionScope: mark.positionScope };
  });
  if (!changed) return entries;
  const hydrated: LocalReadingTocEntry = { index: entry.index, title: entry.title, level: entry.level,
    displayTitle: entry.displayTitle, isVip: entry.isVip, isPay: entry.isPay, contextTitle: entry.contextTitle,
    downloadState: entry.downloadState, navigable: entry.navigable, bookmarks };
  return entries.map((candidate: LocalReadingTocEntry): LocalReadingTocEntry => candidate === entry ? hydrated : candidate);
}

const BOOKMARK_EXCERPT_MAX_SCALARS = 48;

export function readerBookmarkExcerpt(content: string, maxScalars: number = BOOKMARK_EXCERPT_MAX_SCALARS): string {
  const scalars = Array.from(content);
  if (scalars.length <= maxScalars) {
    return content;
  }
  return scalars.slice(0, maxScalars).join('') + '…';
}

// Current Core allocations and timestamp imports use epoch milliseconds.
// Legacy auto-increment keys (and second-based values) do not establish a
// creation date. Preserve those keys; never guess by multiplying them.
const BOOKMARK_EPOCH_MILLIS_MIN = 1_000_000_000_000;
const BOOKMARK_TIME_UNKNOWN = '时间未知';

/** Local `MM-DD HH:mm` for supported epoch milliseconds, otherwise unknown. */
export function readerBookmarkTimeLabel(time: number): string {
  if (!Number.isSafeInteger(time) || time < BOOKMARK_EPOCH_MILLIS_MIN) return BOOKMARK_TIME_UNKNOWN;
  const date = new Date(time);
  if (!Number.isFinite(date.getTime())) return BOOKMARK_TIME_UNKNOWN;
  const pad = (value: number): string => (value < 10 ? `0${value}` : `${value}`);
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * In-chapter position: a percent when the chapter scalar length is known,
 * otherwise no user-facing percentage. The exact Core anchor stays in data.
 */
export function readerBookmarkPositionLabel(
  chapterOffset: number,
  chapterScalarLength: number | undefined,
): string {
  if (chapterScalarLength !== undefined && chapterScalarLength > 0) {
    const percent = Math.min(100, Math.max(0, Math.floor((chapterOffset / chapterScalarLength) * 100)));
    return `${percent}%`;
  }
  return '';
}

function readerBookmarkRowFromBookmark(
  bookmark: LocalReadingBookmark,
  identity: ReaderBookIdentity | undefined,
  identityStatus: ReaderBookmarkIdentityStatus,
  chapterScalarLengths: ReadonlyMap<number, number> | undefined,
): ReaderBookmarkRowModel {
  const chapterLength = chapterScalarLengths?.get(bookmark.chapterIndex);
  const positionStatus = readerBookmarkPositionStatus(identity?.sourceId, identity?.bookId,
    bookmark.chapterIndex, bookmark.positionScope);
  return {
    ...(bookmark.positionScope === undefined ? {} : { positionScope: bookmark.positionScope }),
    bookmarkId: identity === undefined ?
      `session:${bookmark.chapterIndex}:${bookmark.chapterOffset}:${bookmark.time}` :
      readerBookmarkRecordId(
        identity.bookName, identity.bookAuthor, bookmark.chapterIndex, bookmark.chapterOffset, bookmark.time),
    identityStatus,
    positionStatus,
    chapterIndex: bookmark.chapterIndex,
    chapterOffset: bookmark.chapterOffset,
    chapterTitle: bookmark.chapterTitle,
    excerpt: readerBookmarkExcerpt(bookmark.bookText || bookmark.content || '暂无正文摘录'),
    positionLabel: positionStatus === 'unverified' ? '位置待恢复' :
      positionStatus === 'confirmed' ? readerBookmarkPositionLabel(bookmark.chapterOffset, chapterLength) : '',
    timeLabel: readerBookmarkTimeLabel(bookmark.time),
  };
}

function readerBookmarkRowFromRecord(
  record: ReaderBookmarkRecord,
  chapterScalarLengths: ReadonlyMap<number, number> | undefined,
): ReaderBookmarkRowModel {
  const chapterLength = chapterScalarLengths?.get(record.chapterIndex);
  const positionStatus = readerBookmarkPositionStatus(record.sourceId, record.bookId,
    record.chapterIndex, record.positionScope);
  return {
    ...(record.positionScope === undefined ? {} : { positionScope: record.positionScope }),
    bookmarkId: record.bookmarkId,
    identityStatus: record.identityStatus,
    positionStatus,
    chapterIndex: record.chapterIndex,
    chapterOffset: record.chapterOffset,
    chapterTitle: record.chapterTitle,
    excerpt: readerBookmarkExcerpt(record.bookText || record.content || '暂无正文摘录'),
    positionLabel: positionStatus === 'unverified' ? '位置待恢复' :
      positionStatus === 'confirmed' ? readerBookmarkPositionLabel(record.chapterOffset, chapterLength) : '',
    timeLabel: readerBookmarkTimeLabel(record.time),
  };
}

/** Core only exposes a remote scope when it matches the current cached body;
 * the reading host also withdraws stale current-chapter proofs during refresh.
 * Keep historical quotes visible without presenting an unproven numeric position.
 */
function readerBookmarkPositionStatus(sourceId: string | undefined, bookId: string | undefined,
  chapterIndex: number, scope: RemoteReadingPositionScope | undefined): 'confirmed' | 'unverified' | undefined {
  if (sourceId === undefined || sourceId.length === 0) return undefined;
  if (sourceId === 'local') return 'confirmed';
  return scope !== undefined && scope.sourceId === sourceId && scope.bookId === bookId &&
    scope.chapterIndex === chapterIndex ? 'confirmed' : 'unverified';
}

/**
 * Session-TOC projection: one flat row per bookmark in directory order, same
 * chapter bookmarks as separate rows, newest-last inside each chapter.
 * Session bookmarks are already book-scoped by the gateway, so they are
 * confirmed by construction. The session identity is optional: when supplied,
 * bookmark ids carry the full stable book identity.
 */
export function projectReaderBookmarkRows(
  entries: LocalReadingTocEntry[],
  query: string,
  identity?: ReaderBookIdentity,
  chapterScalarLengths?: ReadonlyMap<number, number>,
): ReaderBookmarkRowModel[] {
  const normalizedQuery = query.toLocaleLowerCase();
  const rows: ReaderBookmarkRowModel[] = [];
  for (const entry of entries) {
    if (entry.bookmarks === undefined || entry.bookmarks.length === 0) {
      continue;
    }
    const ordered = entry.bookmarks.slice().sort((a: LocalReadingBookmark, b: LocalReadingBookmark): number =>
      a.time - b.time);
    for (const bookmark of ordered) {
      if (normalizedQuery.length > 0 &&
        bookmark.chapterTitle.toLocaleLowerCase().indexOf(normalizedQuery) < 0 &&
        `${bookmark.bookText ?? ''} ${bookmark.content}`.toLocaleLowerCase().indexOf(normalizedQuery) < 0) {
        continue;
      }
      rows.push(readerBookmarkRowFromBookmark(bookmark, identity, 'confirmed', chapterScalarLengths));
    }
  }
  return rows;
}

/** Migration-records path: keeps per-row pendingConfirmation markers. */
export function readerBookmarkRowsFromRecords(
  records: ReaderBookmarkRecord[],
  chapterScalarLengths?: ReadonlyMap<number, number>,
): ReaderBookmarkRowModel[] {
  const rows: ReaderBookmarkRowModel[] = [];
  for (const record of records) {
    rows.push(readerBookmarkRowFromRecord(record, chapterScalarLengths));
  }
  return rows;
}

export interface ReaderControlBookmarkReadIntent {
  isCurrent(): boolean;
  load(isCurrent: () => boolean): Promise<void>;
  failed(error: Error): void;
}

/** Directory opens and content refreshes share one observation generation.
 * The parent reader index remains the only writer of canonical bookmark rows. */
export class ReaderControlBookmarkRead {
  private generation: number = 0;
  private pending: boolean = false;
  private noticeKey: string = '';

  isPending(): boolean { return this.pending; }

  open(capture: (ownsGeneration: () => boolean) => ReaderControlBookmarkReadIntent, clearFailure: () => void): void {
    const generation = ++this.generation;
    const intent = capture((): boolean => generation === this.generation);
    clearFailure();
    this.pending = true;
    this.queue(intent, generation);
  }

  refresh(capture: (ownsGeneration: () => boolean) => ReaderControlBookmarkReadIntent, clearFailure: () => void): void {
    const generation = ++this.generation;
    const intent = capture((): boolean => generation === this.generation);
    this.pending = true;
    clearFailure();
    this.queue(intent, generation);
  }

  clearNotice(): void { this.noticeKey = ''; }

  admitNotice(key: string): boolean {
    if (this.noticeKey === key) return false;
    this.noticeKey = key;
    return true;
  }

  private queue(intent: ReaderControlBookmarkReadIntent, generation: number): void {
    const isCurrent = (): boolean => intent.isCurrent();
    void Promise.resolve().then((): Promise<void> => {
      if (!isCurrent()) return Promise.resolve();
      return intent.load(isCurrent);
    }).catch((error: Error): void => {
      if (isCurrent()) intent.failed(error);
    }).finally((): void => {
      if (generation === this.generation) this.pending = false;
    });
  }
}

/** A newer complete projection supersedes failure of an older list observation. */
export function readerBookmarkReadFailureSuperseded(message: string, started: LocalReadingTocEntry[],
  current: LocalReadingTocEntry[]): boolean {
  return message.length === 0 && current !== started &&
    !current.some((entry: LocalReadingTocEntry): boolean => entry.bookmarks === undefined);
}
