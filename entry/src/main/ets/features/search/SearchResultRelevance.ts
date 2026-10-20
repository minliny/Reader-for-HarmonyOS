import { bookAuthorIdentity, type BookAuthorIdentityProof } from '../common/BookAuthorMetadata';
/** Reader presentation policy, not a fuzzy matching/search engine.
 * Rank admitted books only; this cannot manufacture coverage absent from sources. */
export class SearchResultRelevance {
  private readonly query: string;
  private readonly titles: Map<string, string> = new Map();

  /** A navigation-owned query shares its keyword and repeated source titles.
   * Keep the platform's locale/Unicode mapping, but do not initialize its
   * locale again for every admitted variant or after a Detail round trip. */
  constructor(keyword: string) {
    this.query = keyword.trim().toLocaleLowerCase();
  }

  score(title: string, author: string, proof?: BookAuthorIdentityProof, sourceVersion?: string): number {
    if (this.query.length === 0) return 0;
    const titleText = title.trim();
    let name = this.titles.get(titleText);
    if (name === undefined) {
      name = titleText.toLocaleLowerCase();
      this.titles.set(titleText, name);
    }
    const by = bookAuthorIdentity(author, proof, sourceVersion);
    if (name === this.query) return 0;
    if (by === this.query) return 1;
    if (name.startsWith(this.query)) return 2;
    if (name.includes(this.query)) return 3;
    if (by.includes(this.query)) return 4;
    return 5;
  }
}

export function searchResultRelevance(title: string, author: string, keyword: string, proof?: BookAuthorIdentityProof, sourceVersion?: string): number {
  return new SearchResultRelevance(keyword).score(title, author, proof, sourceVersion);
}
