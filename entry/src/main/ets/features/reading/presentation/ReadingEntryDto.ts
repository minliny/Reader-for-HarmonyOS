import type { ShelfBook } from '../../../app/ReaderCoreGateway';
import type { RemoteReadingEntryInput } from '../application/ReadingEntryHost';
import type { RemoteReadingBookSeed, RemoteReadingSession } from '../application/RemoteReadingFlowGateway';

/** Preserve the complete shallow session envelope while projecting the
 * committed shelf metadata. No acquisition or progress fact is reconstructed. */
export function readingSessionForCommittedSource(session: RemoteReadingSession, book: ShelfBook): RemoteReadingSession {
  return { ...session,
    book: { ...session.book, title: book.title, author: book.author,
      kind: book.kind ?? session.book.kind, coverUrl: book.coverUrl ?? session.book.coverUrl,
      intro: book.intro ?? session.book.intro, lastChapter: book.lastChapter ?? session.book.lastChapter } };
}

/** Route context overrides only this flag; optional and newer input facts
 * retain the original object-spread semantics and referenced owner DTOs. */
export function readingEntryInputForSearchContext(input: RemoteReadingEntryInput, fromSearch: boolean): RemoteReadingEntryInput {
  return { ...input, fromSearch };
}

export function readingEntrySeedForContentKind(seed: RemoteReadingBookSeed,
  contentKind: 'text' | 'manga' | 'audio' | undefined): RemoteReadingBookSeed {
  return { ...seed, contentKind };
}

/** Keep the original request envelope and referenced owner DTOs when the
 * exact canonical shelf read supplies its current media and format facts. */
export function readingEntryInputForShelfSnapshot(input: RemoteReadingEntryInput, book: ShelfBook): RemoteReadingEntryInput {
  return { ...input, shelfSnapshot: book,
    seed: { ...input.seed, kind: book.kind ?? input.seed.kind, contentKind: book.contentKind } };
}
