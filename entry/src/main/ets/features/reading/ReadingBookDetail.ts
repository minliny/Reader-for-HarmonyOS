/**
 * Source-neutral book facts consumed by Detail and ReaderShell.
 * Shelf timestamps and remote rule variables stay in their owning gateways.
 */
export type ReadingBookDetail = {
  sourceId: string;
  sourceName: string;
  bookId: string;
  title: string;
  author: string;
  /** Core-owned source kind; local readers use it to preserve parser semantics. */
  kind?: string;
  coverUrl?: string;
  intro?: string;
  lastChapter?: string;
};
