import type { RemoteReadingPositionScope } from './RemoteReadingPositionMigration';
import type { LocalReadingBookmark, LocalReadingTocEntry } from './LocalReadingFlowGateway';

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

const BOOKMARK_EXCERPT_MAX_SCALARS = 48;

export function readerBookmarkExcerpt(content: string, maxScalars: number = BOOKMARK_EXCERPT_MAX_SCALARS): string {
  const scalars = Array.from(content);
  if (scalars.length <= maxScalars) {
    return content;
  }
  return scalars.slice(0, maxScalars).join('') + '…';
}

/** Deterministic local-time label `MM-DD HH:mm` for the creation timestamp. */
export function readerBookmarkTimeLabel(time: number): string {
  const date = new Date(time);
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
  return {
    ...(bookmark.positionScope === undefined ? {} : { positionScope: bookmark.positionScope }),
    bookmarkId: identity === undefined ?
      `session:${bookmark.chapterIndex}:${bookmark.chapterOffset}:${bookmark.time}` :
      readerBookmarkRecordId(
        identity.bookName, identity.bookAuthor, bookmark.chapterIndex, bookmark.chapterOffset, bookmark.time),
    identityStatus,
    chapterIndex: bookmark.chapterIndex,
    chapterOffset: bookmark.chapterOffset,
    chapterTitle: bookmark.chapterTitle,
    excerpt: readerBookmarkExcerpt(bookmark.bookText || bookmark.content || '暂无正文摘录'),
    positionLabel: readerBookmarkPositionLabel(bookmark.chapterOffset, chapterLength),
    timeLabel: readerBookmarkTimeLabel(bookmark.time),
  };
}

function readerBookmarkRowFromRecord(
  record: ReaderBookmarkRecord,
  chapterScalarLengths: ReadonlyMap<number, number> | undefined,
): ReaderBookmarkRowModel {
  const chapterLength = chapterScalarLengths?.get(record.chapterIndex);
  return {
    ...(record.positionScope === undefined ? {} : { positionScope: record.positionScope }),
    bookmarkId: record.bookmarkId,
    identityStatus: record.identityStatus,
    chapterIndex: record.chapterIndex,
    chapterOffset: record.chapterOffset,
    chapterTitle: record.chapterTitle,
    excerpt: readerBookmarkExcerpt(record.bookText || record.content || '暂无正文摘录'),
    positionLabel: readerBookmarkPositionLabel(record.chapterOffset, chapterLength),
    timeLabel: readerBookmarkTimeLabel(record.time),
  };
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
