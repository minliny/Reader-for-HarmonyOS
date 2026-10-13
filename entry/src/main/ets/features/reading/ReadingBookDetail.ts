/**
 * Source-neutral book facts consumed by Detail and ReaderShell.
 * Shelf timestamps and remote rule variables stay in their owning gateways.
 */
import type { MangaBookPosition } from '../manga/MangaBookPresentation';
import type { BookAuthorIdentityProof } from '../common/BookAuthorMetadata';

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
  intro?: string;
  lastChapter?: string;
};
