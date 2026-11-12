/**
 * Source-neutral book facts consumed by Detail and ReaderShell.
 * Shelf timestamps and remote rule variables stay in their owning gateways.
 */
import type { MangaBookPosition } from '../../manga/presentation/MangaBookPresentation';
import type { BookAuthorIdentityProof } from '../../../app/library/BookAuthorMetadata';
import type { ShelfBook } from '../../../app/ReaderCoreGateway';
import type { RemoteReadingEntryInput } from '../application/ReadingEntryHost';
import type { RemoteReadingBookSeed, RemoteReadingSession } from '../application/RemoteReadingFlowGateway';

export function remoteReadingEntryKind(seed: RemoteReadingBookSeed, shelf?: ShelfBook,
  validated?: RemoteReadingSession): 'text' | 'manga' | 'audio' | undefined {
  return shelf?.contentKind ?? validated?.contentKind ?? seed.contentKind;
}

export function remoteReadingSeedForShelf(book: ShelfBook): RemoteReadingBookSeed {
  return {
    contentKind: book.contentKind, sourceId: book.sourceId, bookId: book.bookId, detailUrl: book.bookId,
    title: book.title, author: book.author, coverUrl: book.coverUrl, intro: book.intro, lastChapter: book.lastChapter,
  };
}

export function remoteShelfDetailInput(book: ShelfBook, sourceName: string, resumeImmediately?: boolean): RemoteReadingEntryInput {
  const input: RemoteReadingEntryInput = { seed: remoteReadingSeedForShelf(book), sourceName, shelfSnapshot: book };
  if (resumeImmediately !== undefined) input.resumeImmediately = resumeImmediately;
  return input;
}

export function remoteReadingSeedForSession(session: RemoteReadingSession): RemoteReadingBookSeed {
  return {
    ...session.book, contentKind: session.contentKind, sourceId: session.identity.sourceId, bookId: session.identity.bookId,
    detailUrl: session.detailUrl, sourceVersion: session.sourceVersion, searchVariables: session.continuationVariables,
  };
}

export function downloadBookFromReadingDetail(book: ReadingBookDetail | undefined, books: ShelfBook[]): ShelfBook | undefined {
  if (book === undefined) return undefined;
  const shelf = books.find((row: ShelfBook): boolean => row.sourceId === book.sourceId && row.bookId === book.bookId);
  return { sourceId: book.sourceId, sourceName: book.sourceName, bookId: book.bookId,
    title: book.title, author: book.author, kind: book.kind, contentKind: book.contentKind,
    coverUrl: book.coverUrl, intro: book.intro, lastChapter: book.lastChapter,
    addedAt: shelf?.addedAt ?? 0, lastReadAt: shelf?.lastReadAt, group: shelf?.group,
    sortIndex: shelf?.sortIndex, unreadCount: shelf?.unreadCount, lastCheckAt: shelf?.lastCheckAt,
    currentChapterTitle: shelf?.currentChapterTitle, currentChapterIndex: shelf?.currentChapterIndex,
    chapterCount: shelf?.chapterCount, readProgress: shelf?.readProgress, readingPosition: shelf?.readingPosition };
}

export type ReadingBookDetail = {
  sourceId: string;
  sourceName: string;
  bookId: string;
  title: string;
  author: string;
  /** Exact source-version proof; presentation must not invent author aliases. */
  authorIdentity?: BookAuthorIdentityProof;
  sourceVersion?: string;
  /** Core-owned source kind; local readers use it to preserve parser semantics. */
  kind?: string;
  contentKind?: 'text' | 'manga' | 'audio';
  /** Display projection of Core's manga location; never novel scalar progress. */
  mangaPosition?: MangaBookPosition;
  coverUrl?: string;
  /** Ephemeral cover chosen from a merged result; never changes canonical Core metadata. */
  displayCoverUrl?: string;
  intro?: string;
  lastChapter?: string;
};
