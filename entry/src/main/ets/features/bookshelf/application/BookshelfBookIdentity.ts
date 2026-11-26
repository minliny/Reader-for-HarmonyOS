import type { ShelfBook } from '../../../app/ReaderCoreGateway';
import { bookAuthorIdentity, bookIdentityText, bookTitleAuthorKey, type BookAuthorIdentityProof } from '../../../app/library/BookAuthorMetadata';
import type { SearchBook } from '../../search/application/SearchGateway';
import { readerMediaIdentity } from '../../source/application/ReaderSourceCategory';

/** Unknown media uses the legacy text alias. Only a known title and author can match across sources. */
export function bookshelfMediaWorkKey(title: string, author: string, contentKind: 'text' | 'manga' | 'audio' | undefined,
  proof?: BookAuthorIdentityProof, sourceVersion?: string): string | undefined {
  if (contentKind === 'audio' || bookIdentityText(title).length === 0 ||
    bookAuthorIdentity(author, proof, sourceVersion).length === 0) return undefined;
  return readerMediaIdentity(contentKind === 'manga', bookTitleAuthorKey(title, author, proof, sourceVersion));
}

export type BookshelfBookMatch = { kind: 'missing' } | { kind: 'ambiguous' } |
  { kind: 'matched'; book: ShelfBook };

/** An exact selection owns its saved row. Group fallback requires one durable identity across all variants. */
export function resolveBookshelfBook(selected: SearchBook, variants: SearchBook[], books: ShelfBook[]): BookshelfBookMatch {
  if (books.length === 0) return { kind: 'missing' };
  const exact = books.find((saved: ShelfBook): boolean => saved.sourceId === selected.sourceId && saved.bookId === selected.bookId);
  if (exact !== undefined) return { kind: 'matched', book: exact };
  if (selected.sourceId === 'local') return { kind: 'missing' };
  const identities = new Set<string>();
  const works = new Set<string>();
  for (const variant of [selected, ...variants]) {
    if (variant.sourceId === 'local' || variant.category !== selected.category) continue;
    identities.add(`${variant.sourceId}\u0000${variant.bookId}`);
    const key = bookshelfMediaWorkKey(variant.title, variant.author, variant.category === 'comic' ? 'manga' : 'text',
      variant.authorIdentity, variant.sourceRuleVersion);
    if (key !== undefined) works.add(key);
  }
  let match: ShelfBook | undefined = undefined;
  for (const saved of books) {
    if (saved.sourceId === 'local') continue;
    if (!identities.has(`${saved.sourceId}\u0000${saved.bookId}`)) {
      const key = bookshelfMediaWorkKey(saved.title, saved.author, saved.contentKind);
      if (key === undefined || !works.has(key)) continue;
    }
    if (match !== undefined && (match.sourceId !== saved.sourceId || match.bookId !== saved.bookId)) return { kind: 'ambiguous' };
    match = saved;
  }
  return match === undefined ? { kind: 'missing' } : { kind: 'matched', book: match };
}
