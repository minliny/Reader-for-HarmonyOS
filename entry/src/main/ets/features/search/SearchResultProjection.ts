import { bookTitleAuthorKey, type BookAuthorIdentityProof } from '../common/BookAuthorMetadata';
import type { SearchBook, SearchResultDelta } from './SearchGateway';
import type { ShelfBook } from '../../app/ReaderCoreGateway';
import { SearchViewState } from './SearchViewState';
import { searchResultRelevance } from './SearchResultRelevance';
import { searchCandidateRank } from './SearchCandidatePolicy';

export interface SearchGroupProjection {
  key: string;
  book: SearchBook;
  variants: SearchBook[];
  sourceIds: string[];
  inBookshelf: boolean;
  score: number;
  order: number;
}
export interface SearchProjectionUpdate {
  rows: Map<string, SearchGroupProjection>;
  orderedKeys: string[];
  changedKeys: Set<string>;
  orderChanged: boolean;
}
interface SearchProjectionFact { groupKey: string; titleKey: string; score: number; }

/** Reader's exact identity/group projection. Generic sorting remains Array.sort. */
export class SearchResultProjection {
  private books: Map<string, SearchBook> = new Map();
  private facts: Map<string, SearchProjectionFact> = new Map();
  private members: Map<string, Map<string, SearchBook>> = new Map();
  private byTitle: Map<string, Set<string>> = new Map();
  private rows: Map<string, SearchGroupProjection> = new Map();
  private ordered: string[] = [];
  private keyword: string = '';
  private input: SearchBook[] | undefined = undefined;
  private shelfInput: ShelfBook[] | undefined = undefined;
  private shelfIdentities: Set<string> = new Set();
  private shelfTitles: Set<string> = new Set();
  private revision: number = -1;

  private identity(book: SearchBook): string { return `${book.sourceId}\u0000${book.bookId}`; }
  private titleKey(title: string, author: string, proof?: BookAuthorIdentityProof, sourceVersion?: string): string {
    return bookTitleAuthorKey(title, author, proof, sourceVersion);
  }
  private unlink(key: string, affected: Set<string>): void {
    const fact = this.facts.get(key);
    if (fact === undefined) return;
    this.members.get(fact.groupKey)?.delete(key);
    this.byTitle.get(fact.titleKey)?.delete(key);
    affected.add(fact.groupKey);
    this.books.delete(key); this.facts.delete(key);
  }

  update(results: SearchBook[], shelf: ShelfBook[], keyword: string, navigation: SearchViewState,
    delta?: SearchResultDelta): SearchProjectionUpdate {
    const affected = new Set<string>();
    const reset = this.input === undefined || keyword !== this.keyword || (delta?.reset === true && delta.revision !== this.revision);
    if (reset) {
      for (const key of this.rows.keys()) affected.add(key);
      this.books.clear(); this.facts.clear(); this.members.clear(); this.byTitle.clear();
    }
    const changed: SearchBook[] = [];
    const removed: string[] = [];
    if (this.input !== results || reset) {
      if (!reset && delta !== undefined && delta.baseRevision === this.revision) {
        changed.push(...delta.upserted); removed.push(...delta.removedKeys);
      } else {
        // A remount/missed revision reconstructs only this query, never the global cache.
        const retained = new Set<string>();
        for (const book of results) {
          const key = this.identity(book); retained.add(key);
          if (this.books.get(key) !== book) changed.push(book);
        }
        for (const key of this.books.keys()) if (!retained.has(key)) removed.push(key);
      }
      for (const key of removed) this.unlink(key, affected);
      for (const book of changed) {
        const key = this.identity(book);
        const previous = this.books.get(key);
        const previousFact = this.facts.get(key);
        const titleKey = previous !== undefined && previous.title === book.title && previous.author === book.author &&
          previous.authorIdentity === book.authorIdentity && previous.sourceRuleVersion === book.sourceRuleVersion
          ? (previousFact as SearchProjectionFact).titleKey : this.titleKey(book.title, book.author, book.authorIdentity, book.sourceRuleVersion);
        const groupKey = book.sourceId === 'local' ? `local:${book.bookId}` : `online:${book.groupKey ?? titleKey}`;
        const score = previous !== undefined && previous.title === book.title && previous.author === book.author &&
          previous.authorIdentity === book.authorIdentity && previous.sourceRuleVersion === book.sourceRuleVersion
          ? (previousFact as SearchProjectionFact).score : searchResultRelevance(book.title, book.author, keyword, book.authorIdentity, book.sourceRuleVersion);
        this.unlink(key, affected);
        this.books.set(key, book); this.facts.set(key, { groupKey, titleKey, score });
        let members = this.members.get(groupKey);
        if (members === undefined) { members = new Map(); this.members.set(groupKey, members); }
        members.set(key, book);
        let titles = this.byTitle.get(titleKey);
        if (titles === undefined) { titles = new Set(); this.byTitle.set(titleKey, titles); }
        titles.add(key); affected.add(groupKey);
        navigation.rank(groupKey, book.admittedOrder);
        if (previousFact !== undefined && previousFact.groupKey !== groupKey &&
          (this.members.get(previousFact.groupKey)?.size ?? 0) === 0) {
          navigation.redirects.set(previousFact.groupKey, groupKey);
        }
      }
      this.input = results; this.keyword = keyword; this.revision = delta?.revision ?? -1;
    }
    if (this.shelfInput !== shelf || reset) {
      const identities = new Set<string>(); const titles = new Set<string>();
      for (const book of shelf) {
        identities.add(`${book.sourceId}\u0000${book.bookId}`);
        titles.add(this.titleKey(book.title, book.author));
      }
      const identityChanges = new Set<string>(); const titleChanges = new Set<string>();
      for (const key of identities) if (!this.shelfIdentities.has(key)) identityChanges.add(key);
      for (const key of this.shelfIdentities) if (!identities.has(key)) identityChanges.add(key);
      for (const key of titles) if (!this.shelfTitles.has(key)) titleChanges.add(key);
      for (const key of this.shelfTitles) if (!titles.has(key)) titleChanges.add(key);
      for (const key of identityChanges) { const fact = this.facts.get(key); if (fact !== undefined) affected.add(fact.groupKey); }
      for (const title of titleChanges) for (const key of this.byTitle.get(title) ?? []) {
        const fact = this.facts.get(key); if (fact !== undefined) affected.add(fact.groupKey);
      }
      this.shelfIdentities = identities; this.shelfTitles = titles; this.shelfInput = shelf;
    }
    let orderChanged = reset;
    const changedKeys = new Set<string>();
    for (const key of affected) {
      if ((this.members.get(key)?.size ?? 0) > 0) navigation.redirects.delete(key);
      const variants = Array.from(this.members.get(key)?.values() ?? []);
      const previous = this.rows.get(key);
      if (variants.length === 0) {
        if (this.rows.delete(key)) { changedKeys.add(key); orderChanged = true; }
        this.members.delete(key); continue;
      }
      // Arrival sequence is query-owned, independent of source completion/filter order.
      variants.sort((a: SearchBook, b: SearchBook): number => (a.admittedOrder ?? 0) - (b.admittedOrder ?? 0));
      let book = variants[0]; let score = (this.facts.get(this.identity(book)) as SearchProjectionFact).score;
      const sourceIds = new Set<string>(); let inBookshelf = false;
      for (const variant of variants) {
        const identity = this.identity(variant); const fact = this.facts.get(identity) as SearchProjectionFact;
        sourceIds.add(variant.sourceId);
        inBookshelf = inBookshelf || this.shelfIdentities.has(identity) ||
          (variant.sourceId !== 'local' && this.shelfTitles.has(fact.titleKey));
        if (fact.score < score || (fact.score === score && searchCandidateRank(variant) < searchCandidateRank(book))) {
          book = variant; score = fact.score;
        }
      }
      const order = navigation.rank(key);
      if (previous !== undefined && previous.book === book && previous.inBookshelf === inBookshelf &&
        previous.score === score && previous.order === order &&
        previous.variants.length === variants.length && previous.variants.every((v: SearchBook, i: number): boolean => v === variants[i])) continue;
      this.rows.set(key, { key, book, variants, sourceIds: Array.from(sourceIds), inBookshelf, score, order });
      changedKeys.add(key);
      if (previous === undefined || previous.score !== score || previous.order !== order) orderChanged = true;
    }
    if (orderChanged) this.ordered = Array.from(this.rows.keys()).sort((a: string, b: string): number => {
      const left = this.rows.get(a) as SearchGroupProjection; const right = this.rows.get(b) as SearchGroupProjection;
      return left.score - right.score || left.order - right.order;
    });
    return { rows: this.rows, orderedKeys: this.ordered, changedKeys, orderChanged };
  }
}
