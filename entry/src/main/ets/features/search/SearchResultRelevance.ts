import { bookAuthorIdentity, type BookAuthorIdentityProof } from '../common/BookAuthorMetadata';
/** Reader presentation policy, not a fuzzy matching/search engine.
 * Rank admitted books only; this cannot manufacture coverage absent from sources. */
export function searchResultRelevance(title: string, author: string, keyword: string, proof?: BookAuthorIdentityProof, sourceVersion?: string): number {
  const query = keyword.trim().toLocaleLowerCase();
  if (query.length === 0) return 0;
  const name = title.trim().toLocaleLowerCase();
  const by = bookAuthorIdentity(author, proof, sourceVersion);
  if (name === query) return 0;
  if (by === query) return 1;
  if (name.startsWith(query)) return 2;
  if (name.includes(query)) return 3;
  if (by.includes(query)) return 4;
  return 5;
}
