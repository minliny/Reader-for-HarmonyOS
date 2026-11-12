import type { ShelfBook } from '../../../app/ReaderCoreGateway';
import type { BookAcquisitionCandidate, BookAcquisitionCoordinator } from '../../reading/application/BookAcquisitionCoordinator';
import { diagnosticCodeOf } from '../../../app/LogPrivacy';
import { errorMessageOf } from '../../../app/ErrorMessage';
import { resolveBookshelfBook } from '../../bookshelf/application/BookshelfBookIdentity';
import { readerPageInitialHeaderHeight } from '../../../ui/foundation/ReaderHeaderSpecs';
import { readerSurfaceRectValid, type ReaderSurfaceRect } from '../../../ui/layout/ReaderSurfaceRect';
import type { RemoteReadingEntryInput } from '../../reading/application/ReadingEntryHost';
import { readingFailureHint } from '../../reading/presentation/ReadingFailurePresentation';
import type { RemoteReadingBookSeed } from '../../reading/application/RemoteReadingFlowGateway';
import type { RemoteReadingVariable } from '../../reading/application/RemoteReadingContract';
import { readerSourceCategoryIsText } from '../../source/application/ReaderSourceCategory';
import { ReaderLibrarySearchModel } from './ReaderLibrarySearchModel';
import { SearchHost } from '../application/SearchHost';
import { searchCandidateRank } from './SearchCandidatePolicy';
import type { SearchBook } from '../application/SearchGateway';
import type { SearchPresentation } from './SearchPresentation';

export type LibrarySearchMode = 'idle' | 'input' | 'results';

interface LibraryShelfMoreLease {
  identity: string;
  navigation: number;
  mounting: number;
  open: () => void;
}

interface LibraryContinueCardSample {
  navigation: number;
  mounting: number;
  bookKey: string;
  rect: ReaderSurfaceRect;
}

interface LibraryContinueCardCoverage {
  identity: number;
  navigation: number;
  mounting: number;
}

export interface LibrarySearchSelectionPorts {
  beginLocalRead: () => (() => boolean);
  loadLocal: (bookId: string) => Promise<ShelfBook | undefined>;
  refreshMembership: () => void;
  failure: (title: string, message: string) => void;
  sourceName: (sourceId: string) => string;
  local: (book: ShelfBook) => boolean;
  remote: (input: RemoteReadingEntryInput) => boolean;
}

/** Owns the retained library search presentation. SearchHost still owns the
 * query/publication, and BookAcquisitionCoordinator still owns preparation. */
@Observed
export class LibrarySearchPresentation {
  readonly model: ReaderLibrarySearchModel = new ReaderLibrarySearchModel();
  readonly host: SearchHost;
  mode: LibrarySearchMode = 'idle';
  identity: number = 0;
  headerBottom: number = readerPageInitialHeaderHeight('bookshelf');
  animateOnAppear: boolean = false;
  publicationRevision: number = 0;
  private shelfMore: LibraryShelfMoreLease | undefined = undefined;
  private cardSample: LibraryContinueCardSample | undefined = undefined;
  private cardCoverage: LibraryContinueCardCoverage | undefined = undefined;
  private detailCandidates: SearchBook[] = [];
  private readonly isDetailJourneyCurrent: () => boolean;
  private onPublication: () => void = (): void => {};

  constructor(isVisible: () => boolean, isDetailJourneyCurrent: () => boolean) {
    this.isDetailJourneyCurrent = isDetailJourneyCurrent;
    this.host = new SearchHost((): void => this.onPublication(), isVisible);
  }

  mount(): void {
    // Bind through the observed instance used by the mounted root.
    this.onPublication = (): void => {
      this.publicationRevision += 1;
      this.mergeDetailCandidates(this.host.presentation());
    };
  }

  dispose(): void {
    this.close();
    this.shelfMore = undefined;
    this.cardSample = undefined;
    this.host.clearShelfMembership();
    this.onPublication = (): void => {};
  }

  prepareEntry(): void {
    this.identity += 1;
    this.cardCoverage = undefined;
    this.animateOnAppear = true;
    this.host.prepareEntry();
  }

  open(refreshMembership: () => void): void {
    this.mode = 'input';
    refreshMembership();
    this.host.open();
  }

  search(keyword: string, scopeSourceIds?: string[]): void {
    const query = keyword.trim();
    if (query.length === 0) return;
    this.model.suspend();
    this.host.search(query, scopeSourceIds);
    this.mode = 'results';
  }

  sourceManagementKeyword(): string {
    const draft = this.host.viewState.keywordDraft.trim();
    if (this.mode !== 'results') return draft;
    const query = this.host.presentation();
    return query.kind === 'loading' || query.kind === 'results' || query.kind === 'empty' || query.kind === 'error' ?
      query.keyword : draft;
  }

  returnFromSourceManagement(searchAgain?: string): void {
    if (searchAgain !== undefined && searchAgain.trim().length > 0) {
      // A new search checks the current enabled sources. The retained host
      // still owns the entry and does not need to be opened again.
      this.search(searchAgain);
      return;
    }
    this.host.refreshSources();
    this.host.resume();
  }

  prepareReturnFromDetail(): void {
    this.animateOnAppear = false;
    this.host.viewState.returnFromDetail();
  }

  resumeAfterDetail(): void {
    // Keep the original query, result order and queue, including sources
    // that completed while the results were hidden.
    this.host.resume();
  }

  /** Returns whether the caller should leave the search route immediately. */
  back(): boolean {
    if (this.model.consumeInputBack()) return false;
    if (this.model.consumeTemporaryBack(this.model.currentOwner())) return false;
    if (this.mode === 'idle') return true;
    this.model.suspend();
    this.mode = 'idle';
    return false;
  }

  edit(): void {
    if (this.mode !== 'results') return;
    this.host.stop();
    this.host.refreshHistory();
    this.mode = 'input';
  }

  close(): void {
    this.mode = 'idle';
    this.animateOnAppear = false;
    this.cardCoverage = undefined;
    this.detailCandidates = [];
    this.host.close();
  }

  candidates(): SearchBook[] { return this.detailCandidates; }

  bindShelfMore(identity: string, navigation: number, mounting: number, open?: () => void): void {
    if (identity.length === 0) return;
    if (open !== undefined) {
      this.shelfMore = { identity, navigation, mounting, open };
    } else if (identity === this.shelfMoreIdentity(navigation, mounting)) {
      this.shelfMore = undefined;
    }
  }

  shelfMoreIdentity(navigation: number, mounting: number): string {
    const lease = this.shelfMore;
    return lease !== undefined && lease.navigation === navigation && lease.mounting === mounting ? lease.identity : '';
  }

  openShelfMore(identity: string, navigation: number, mounting: number): void {
    if (identity.length > 0 && identity === this.shelfMoreIdentity(navigation, mounting)) this.shelfMore?.open();
  }

  measureContinueCard(rect: ReaderSurfaceRect | undefined, navigation: number, mounting: number, bookKey: string,
    book: ShelfBook | undefined): void {
    if (bookKey !== this.continueCardBookKey(book) || (rect !== undefined && !readerSurfaceRectValid(rect))) return;
    if (rect === undefined) {
      this.cardSample = undefined;
      return;
    }
    const previous = this.continueCardRect(navigation, mounting, book);
    if (previous === undefined || Math.abs(previous.x - rect.x) > .1 || Math.abs(previous.y - rect.y) > .1 ||
      Math.abs(previous.width - rect.width) > .1 || Math.abs(previous.height - rect.height) > .1) {
      this.cardSample = { navigation, mounting, bookKey, rect };
    }
  }

  continueCardRect(navigation: number, mounting: number, book: ShelfBook | undefined): ReaderSurfaceRect | undefined {
    const sample = this.cardSample;
    return sample !== undefined && sample.navigation === navigation && sample.mounting === mounting &&
      sample.bookKey === this.continueCardBookKey(book) ? sample.rect : undefined;
  }

  setContinueCardCoverage(suppressed: boolean, identity: number, navigation: number, mounting: number): void {
    if (identity !== this.identity) return;
    this.cardCoverage = suppressed ? { identity, navigation, mounting } : undefined;
  }

  continueCardSuppressed(navigation: number, mounting: number): boolean {
    const coverage = this.cardCoverage;
    return this.mode === 'input' && coverage !== undefined && coverage.identity === this.identity &&
      coverage.navigation === navigation && coverage.mounting === mounting;
  }

  private continueCardBookKey(book: ShelfBook | undefined): string {
    return book === undefined ? '' : JSON.stringify([book.sourceId, book.bookId]);
  }

  prepareGroups(coordinator: BookAcquisitionCoordinator, groups: SearchBook[][], visible: boolean): void {
    coordinator.setPreparationVisible(visible);
    coordinator.prepareGroups(groups.slice(0, 6).map((books: SearchBook[]): BookAcquisitionCandidate[] => books
      .filter((book: SearchBook): boolean => book.sourceId !== 'local' && readerSourceCategoryIsText(book.category))
      .map((book: SearchBook): BookAcquisitionCandidate => this.acquisitionCandidate(book))));
  }

  /** Merge late search publications into the selected same-book candidate set. */
  private mergeDetailCandidates(presentation: SearchPresentation): void {
    if (presentation.kind !== 'results' || this.detailCandidates.length === 0) return;
    if (!this.isDetailJourneyCurrent()) return;
    const anchor = this.detailCandidates[0];
    if (anchor === undefined) return;
    const sameGroup = (candidate: SearchBook): boolean =>
      (anchor.groupKey !== undefined && candidate.groupKey === anchor.groupKey) ||
      (candidate.title === anchor.title && candidate.author === anchor.author);
    const latest = new Map<string, SearchBook>();
    for (const candidate of presentation.results) {
      if (sameGroup(candidate)) latest.set(`${candidate.sourceId}\u0000${candidate.bookId}`, candidate);
    }
    if (latest.size === 0) return;
    const merged: SearchBook[] = [];
    const seen = new Set<string>();
    for (const previous of this.detailCandidates) {
      const key = `${previous.sourceId}\u0000${previous.bookId}`;
      const next = latest.get(key) ?? previous;
      if (!seen.has(key)) { merged.push(next); seen.add(key); }
    }
    latest.forEach((candidate: SearchBook, key: string): void => {
      if (!seen.has(key)) { merged.push(candidate); seen.add(key); }
    });
    const changed = merged.length !== this.detailCandidates.length ||
      merged.some((candidate: SearchBook, index: number): boolean => candidate !== this.detailCandidates[index]);
    if (changed) this.detailCandidates = merged;
  }

  admissionCandidates(seed: RemoteReadingBookSeed, fallbackSeeds: RemoteReadingBookSeed[]): BookAcquisitionCandidate[] {
    const candidates: BookAcquisitionCandidate[] = [];
    for (const candidate of [seed, ...fallbackSeeds]) {
      const row = this.detailCandidates.find((book: SearchBook): boolean =>
        book.sourceId === candidate.sourceId && book.bookId === candidate.bookId);
      if (row !== undefined) candidates.push(this.acquisitionCandidate(row));
    }
    return candidates;
  }

  private acquisitionCandidate(book: SearchBook): BookAcquisitionCandidate {
    const rank = searchCandidateRank(book);
    return { seed: this.remoteSeedForSearchBook(book), catalogReady: rank < 2, failed: rank === 3 };
  }

  private remoteSeedForSearchBook(candidate: SearchBook): RemoteReadingBookSeed {
    return {
      contentKind: candidate.category === 'comic' ? 'manga' : 'text',
      sourceId: candidate.sourceId,
      sourceVersion: candidate.sourceRuleVersion,
      bookId: candidate.bookId,
      detailUrl: candidate.detailUrl,
      title: candidate.title,
      author: candidate.author,
      authorIdentity: candidate.authorIdentity,
      coverUrl: candidate.coverUrl,
      intro: candidate.intro,
      kind: candidate.kind,
      lastChapter: candidate.latestChapterTitle,
      searchVariables: candidate.variables.map((variable): RemoteReadingVariable => ({
        name: variable.name,
        value: variable.value,
      })),
    };
  }


  selectResult(book: SearchBook, variants: SearchBook[], shelf: ShelfBook[], ports: LibrarySearchSelectionPorts,
    displayCoverUrl?: string, focusKey?: string): void {
    if (this.mode !== 'results') return;
    const view = this.host.viewState;
    const revision = view.revision, category = view.category, contentType = view.contentType;
    const sameSelection = (): boolean => this.mode === 'results' && view.revision === revision &&
      view.category === category && view.contentType === contentType;
    const openDetail = (open: () => boolean): void => {
      if (sameSelection() && open() && focusKey !== undefined) view.rememberDetailResult(focusKey);
    };
    this.detailCandidates = [book, ...variants.filter((candidate: SearchBook): boolean =>
      candidate.category === book.category &&
      (candidate.sourceId !== book.sourceId || candidate.bookId !== book.bookId) &&
      (book.groupKey !== undefined && candidate.groupKey === book.groupKey ||
        candidate.title === book.title && candidate.author === book.author))];
    // A completed membership read, including an empty one, supersedes the
    // retained filtered shelf window. That window may predate a removal.
    const membership = this.host.shelfMembership() ?? shelf;
    if (book.sourceId === 'local') {
      const stillOnShelf = membership.some((item: ShelfBook): boolean => item.sourceId === 'local' && item.bookId === book.bookId);
      const visibleBook = stillOnShelf ? shelf.find((item: ShelfBook): boolean =>
        item.sourceId === 'local' && item.bookId === book.bookId) : undefined;
      if (visibleBook !== undefined) { openDetail((): boolean => ports.local(visibleBook)); return; }
      const isRouteCurrent = ports.beginLocalRead();
      const candidates = this.detailCandidates;
      const current = (): boolean => isRouteCurrent() && this.detailCandidates === candidates && sameSelection();
      void ports.loadLocal(book.bookId).then((stored: ShelfBook | undefined): void => {
        if (!current()) return;
        if (stored === undefined) {
          ports.refreshMembership();
          ports.failure('本地书籍已移除', '这本书已不在书架中，请重新搜索。');
        } else openDetail((): boolean => ports.local(stored));
      }).catch((error: Error): void => {
        if (current()) ports.failure('打开本地书籍失败', readingFailureHint(diagnosticCodeOf(errorMessageOf(error))));
      });
      return;
    }
    // The search badge describes a saved work, not just this source URL. Keep
    // its exact durable identity so changing source owns the existing row.
    const shelfMatch = resolveBookshelfBook(book.sourceId, book.bookId, book.title, book.author,
      membership.filter((saved: ShelfBook): boolean => (saved.contentKind === 'manga') === (book.category === 'comic')),
      book.authorIdentity, book.sourceRuleVersion);
    if (shelfMatch.kind === 'ambiguous') {
      ports.failure('书架中有多个版本', '请从书架选择要阅读或换源的版本，已有书籍不会自动合并。');
      return;
    }
    if (shelfMatch.kind === 'matched') {
      const saved = shelfMatch.book;
      const seed: RemoteReadingBookSeed = { sourceId: saved.sourceId, bookId: saved.bookId,
        contentKind: saved.contentKind,
        detailUrl: saved.bookId, title: saved.title, author: saved.author, coverUrl: saved.coverUrl,
        intro: saved.intro, kind: saved.kind, lastChapter: saved.lastChapter };
      openDetail((): boolean => ports.remote({ seed, sourceName: saved.sourceName ?? ports.sourceName(saved.sourceId),
        shelfSnapshot: saved, fallbackSeeds: [], fallbackSourceNames: [], displayCoverUrl }));
      return;
    }
    // Unsaved works retain every source candidate. The shared scheduler bounds concurrency.
    const ordered: SearchBook[] = [book];
    for (const candidate of this.detailCandidates) {
      if (candidate.sourceId === book.sourceId && candidate.bookId === book.bookId) {
        continue;
      }
      ordered.push(candidate);
    }
    const seeds: RemoteReadingBookSeed[] = [];
    const sourceNames: string[] = [];
    for (const candidate of ordered) {
      const duplicate = seeds.some((admitted: RemoteReadingBookSeed): boolean =>
        admitted.sourceId === candidate.sourceId && admitted.bookId === candidate.bookId);
      if (duplicate) {
        continue;
      }
      const seed = this.remoteSeedForSearchBook(candidate);
      seeds.push(seed);
      sourceNames.push(candidate.sourceName);
    }
    // A search result that is already on the shelf has a durable Core
    // snapshot. Pass it through so detail/TOC opens cache-first instead of
    // issuing a second live detail+TOC sweep for the same identity.
    const shelfSnapshot = membership.find((item: ShelfBook): boolean =>
      item.sourceId === book.sourceId && item.bookId === book.bookId);
    openDetail((): boolean => ports.remote({ seed: seeds[0], sourceName: sourceNames[0], shelfSnapshot,
      fallbackSeeds: seeds.slice(1), fallbackSourceNames: sourceNames.slice(1), displayCoverUrl }));
  }
}
