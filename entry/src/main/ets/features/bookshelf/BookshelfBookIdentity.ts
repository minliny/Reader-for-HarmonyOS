import type { ShelfBook } from '../../app/ReaderCoreGateway';
import { bookAuthorIdentity, bookIdentityText, bookTitleAuthorKey, type BookAuthorIdentityProof } from '../common/BookAuthorMetadata';

/** A shelf work requires a known author. Missing metadata is never a wildcard. */
export function bookshelfWorkKey(title: string, author: string,
  proof?: BookAuthorIdentityProof, sourceVersion?: string): string | undefined {
  if (bookIdentityText(title).length === 0 || bookAuthorIdentity(author, proof, sourceVersion).length === 0) return undefined;
  return bookTitleAuthorKey(title, author, proof, sourceVersion);
}

export type BookshelfBookMatch = { kind: 'missing' } | { kind: 'ambiguous' } |
  { kind: 'matched'; book: ShelfBook };

/** Reuse the search author-label policy; never merge or choose among saved copies. */
export function resolveBookshelfBook(sourceId: string, bookId: string, title: string, author: string,
  books: ShelfBook[], proof?: BookAuthorIdentityProof, sourceVersion?: string): BookshelfBookMatch {
  const exact = books.find((book: ShelfBook): boolean => book.sourceId === sourceId && book.bookId === bookId);
  if (exact !== undefined) return { kind: 'matched', book: exact };
  const key = bookshelfWorkKey(title, author, proof, sourceVersion);
  if (sourceId === 'local' || key === undefined) return { kind: 'missing' };
  const matches = new Map<string, ShelfBook>();
  for (const book of books) {
    if (book.sourceId !== 'local' && bookshelfWorkKey(book.title, book.author) === key) {
      matches.set(`${book.sourceId}\u0000${book.bookId}`, book);
    }
  }
  if (matches.size > 1) return { kind: 'ambiguous' };
  for (const book of matches.values()) return { kind: 'matched', book };
  return { kind: 'missing' };
}
