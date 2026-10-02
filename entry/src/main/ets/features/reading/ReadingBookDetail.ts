/**
 * Source-neutral book facts consumed by Detail and ReaderShell.
 * Shelf timestamps and remote rule variables stay in their owning gateways.
 */
import type { MangaBookPosition } from '../manga/MangaBookPresentation';

export type ReadingBookDetail = {
  sourceId: string;
  sourceName: string;
  bookId: string;
  title: string;
  author: string;
  /** Core-owned source kind; local readers use it to preserve parser semantics. */
  kind?: string;
  contentKind?: 'text' | 'manga' | 'audio';
  /** Display projection of Core's manga location; never novel scalar progress. */
  mangaPosition?: MangaBookPosition;
  coverUrl?: string;
  intro?: string;
  lastChapter?: string;
};
