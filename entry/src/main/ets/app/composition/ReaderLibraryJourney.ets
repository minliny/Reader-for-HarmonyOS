import type { ShelfBook } from '../ReaderCoreGateway';
import type { ReaderRuntimeOwner } from '../ReaderRuntimeOwner';
import type { ReaderNavigation, ReaderNavigationSnapshot } from '../navigation/ReaderNavigation';
import type { BookshelfDetailReturnFocus } from '../../features/bookshelf/presentation/BookshelfViewState';
import type { BookshelfHost } from '../../features/bookshelf/application/BookshelfHost';
import type { BookshelfDataState } from '../../features/bookshelf/application/BookshelfFlowGateway';
import type { BookshelfCatalogPresentation } from '../../features/bookshelf/presentation/BookshelfCatalogPresentation';
import type { BookshelfManagementPresentation } from '../../features/bookshelf/presentation/BookshelfManagementPresentation';
import type { BookshelfGroupPresentation } from '../../features/bookshelf/presentation/BookshelfGroupPresentation';
import type { BookshelfReadPresentation } from '../../features/bookshelf/presentation/BookshelfReadPresentation';
import type { BookshelfMutationPresentation } from '../../features/bookshelf/presentation/BookshelfMutationPresentation';
import type { LibrarySearchMode, LibrarySearchPresentation } from '../../features/search/presentation/LibrarySearchPresentation';
import type { SearchBook } from '../../features/search/application/SearchGateway';
import type { SearchHost } from '../../features/search/application/SearchHost';
import type { RemoteReadingEntryInput } from '../../features/reading/application/ReadingEntryHost';
import type { ReadingEntryPresentation } from '../../features/reading/presentation/ReadingEntryPresentation';
import type { ReaderLibraryAcquisitionBinding } from './ReaderLibraryAcquisitionBinding';
import type { ReaderReadingEntryActions } from './ReaderReadingEntryActions';

export interface ReaderLibraryScope {
  owner: ReaderRuntimeOwner | undefined;
  instance: number;
  mounting: number;
  retired: boolean;
  inputAllowed: boolean;
}

export interface ReaderLibraryJourneyPorts {
  scope: () => ReaderLibraryScope;
  runtime: () => ReaderRuntimeOwner | undefined;
  ownsRuntime: (owner: ReaderRuntimeOwner) => boolean;
  shelfHost: () => BookshelfHost;
  management: () => BookshelfManagementPresentation;
  group: () => BookshelfGroupPresentation;
  read: () => BookshelfReadPresentation;
  catalog: () => BookshelfCatalogPresentation;
  preparePersistedShelf: () => void;
  emptyShelfReady: () => void;
  mutations: () => BookshelfMutationPresentation;
  search: () => LibrarySearchPresentation;
  acquisition: () => ReaderLibraryAcquisitionBinding;
  reading: () => ReadingEntryPresentation;
  readingActions: () => ReaderReadingEntryActions;
  shelfBooks: () => ShelfBook[];
  loadLocalBook: (bookId: string) => Promise<ShelfBook | undefined>;
  sourceName: (sourceId: string) => string;
  failure: (title: string, message: string) => void;
  feedback: (message: string, current: () => boolean) => void;
  advance: () => number;
  publish: (snapshot: ReaderNavigationSnapshot) => void;
  refreshMembership: () => void;
  refreshShelf: () => void;
  readbackOnBookshelf: () => void;
  clearRssSelection: () => void;
  bookshelfInputAllowed: () => boolean;
  back: () => void;
}

export interface ReaderLibraryHeaderActions {
  onHistoryCoverageChanged: (suppressed: boolean, identity: number, generation: number, mounting: number) => void;
  onOpen: (identity: number, generation: number, mounting: number) => void;
  onBack: (identity: number, generation: number, mounting: number) => void;
  onInputRequested: (identity: number, generation: number, mounting: number) => void;
  onMore: (identity: number, generation: number, mounting: number, moreIdentity: string) => void;
  onHeaderBottom: (bottom: number, identity: number, measurement: number, generation: number, mounting: number) => void;
  onSettled: (mode: LibrarySearchMode, identity: number, generation: number, mounting: number) => void;
}

/** Connects the retained library search and detail journey to existing owners. */
export class ReaderLibraryJourney {
  private readonly navigation: ReaderNavigation;
  private readonly ports: ReaderLibraryJourneyPorts;
  constructor(navigation: ReaderNavigation, ports: ReaderLibraryJourneyPorts) {
    this.navigation = navigation;
    this.ports = ports;
  }

  acceptShelfState(state: BookshelfDataState): void {
    if (state.kind === 'populated') {
      this.ports.catalog().automatic(state.shelf.books);
      this.ports.preparePersistedShelf();
    } else this.ports.emptyShelfReady();
  }

  isCurrentSearch(generation: number, owner: ReaderRuntimeOwner | undefined, mounting: number, host: SearchHost): boolean {
    const scope = this.ports.scope(), route = this.navigation.snapshot();
    return owner !== undefined && scope.owner === owner && this.ports.ownsRuntime(owner) &&
      !scope.retired && route.route === 'search' && generation === route.generation &&
      mounting === scope.mounting && this.ports.acquisition().currentOwner() === owner && this.ports.search().host === host;
  }

  isCurrentBookshelf(generation: number, owner: ReaderRuntimeOwner | undefined, mounting: number): boolean {
    const scope = this.ports.scope(), route = this.navigation.snapshot();
    return owner !== undefined && scope.owner === owner && this.ports.ownsRuntime(owner) &&
      this.ports.acquisition().currentOwner() === owner && !scope.retired &&
      route.route === 'bookshelf' && generation === route.generation && mounting === scope.mounting;
  }

  isInteractiveBookshelf(generation: number, owner: ReaderRuntimeOwner | undefined, mounting: number): boolean {
    return this.ports.bookshelfInputAllowed() && this.isCurrentBookshelf(generation, owner, mounting);
  }

  headerActions(owner: ReaderRuntimeOwner | undefined, host: SearchHost): ReaderLibraryHeaderActions {
    return {
      onHistoryCoverageChanged: (suppressed: boolean, identity: number, generation: number, mounting: number): void => {
        if (this.isCurrentSearch(generation, owner, mounting, host)) {
          this.ports.search().setContinueCardCoverage(suppressed, identity, generation, mounting);
        }
      },
      onOpen: (identity: number, generation: number, mounting: number): void => {
        if (identity === this.ports.search().identity && this.isInteractiveBookshelf(generation, owner, mounting)) this.openSearch();
      },
      onBack: (identity: number, generation: number, mounting: number): void => {
        if (this.ports.scope().inputAllowed && identity === this.ports.search().identity &&
          this.isCurrentSearch(generation, owner, mounting, host)) this.ports.back();
      },
      onInputRequested: (identity: number, generation: number, mounting: number): void => {
        const search = this.ports.search();
        if (this.ports.scope().inputAllowed && identity === search.identity &&
          this.isCurrentSearch(generation, owner, mounting, host) && search.mode === 'results') search.edit();
      },
      onMore: (identity: number, generation: number, mounting: number, moreIdentity: string): void => {
        if (identity === this.ports.search().identity && this.isInteractiveBookshelf(generation, owner, mounting)) {
          this.ports.search().openShelfMore(moreIdentity, generation, mounting);
        }
      },
      onHeaderBottom: (bottom: number, identity: number, _measurement: number, generation: number, mounting: number): void => {
        const scope = this.ports.scope(), search = this.ports.search(), route = this.navigation.snapshot();
        if (identity !== search.identity || generation !== route.generation || owner !== scope.owner ||
          mounting !== scope.mounting || !Number.isFinite(bottom) || bottom <= 0) return;
        if (route.route === 'search' && this.isCurrentSearch(generation, owner, mounting, host)) search.headerBottom = bottom;
        else if (this.isCurrentBookshelf(generation, owner, mounting) && search.mode === 'idle') this.ports.read().headerBottom = bottom;
      },
      onSettled: (mode: LibrarySearchMode, identity: number, generation: number, mounting: number): void => {
        if (this.isCurrentSearch(generation, owner, mounting, host)) this.settled(mode, identity);
      },
    };
  }

  openShelfGroup(book: ShelfBook, focusTarget?: string): void {
    const scope = this.ports.scope(), owner = scope.owner, mounting = scope.mounting;
    const generation = this.navigation.snapshot().generation;
    if (owner === undefined) return;
    const identity = JSON.stringify([scope.instance, mounting, generation, 'bookshelfManagement', 'page']);
    this.ports.group().open(owner, book, identity,
      (): boolean => this.isCurrentBookshelf(generation, owner, mounting),
      (): void => { this.ports.read().invalidate(); this.ports.refreshShelf(); },
      this.ports.feedback, focusTarget, this.ports.bookshelfInputAllowed);
  }

  openBookshelfManagement(): void {
    this.ports.advance();
    this.ports.reading().endReading(this.ports.scope().owner);
    this.ports.publish(this.navigation.show('bookshelfManagement'));
    const bound = this.ports.scope(), owner = bound.owner;
    if (owner === undefined) return;
    const generation = this.navigation.snapshot().generation, mounting = bound.mounting, host = this.ports.shelfHost();
    const identity = JSON.stringify([bound.instance, mounting, generation, 'bookshelfManagement', 'page']);
    this.ports.management().open(owner, host, identity, (): boolean => {
      const current = this.ports.scope(), navigation = this.navigation.snapshot();
      return !current.retired && current.owner === owner && this.ports.ownsRuntime(owner) &&
        generation === navigation.generation && mounting === current.mounting &&
        navigation.route === 'bookshelfManagement' && host === this.ports.shelfHost();
    });
  }

  openBookshelfMultiSelect(initialBook?: ShelfBook): void {
    const next = this.navigation.openBookshelfMultiSelect((): void => {
      this.ports.advance();
      this.ports.reading().endReading(this.ports.scope().owner);
    });
    if (next === undefined) return;
    this.ports.publish(next);
    const read = this.ports.read();
    read.attach();
    this.ports.mutations().openSelection(initialBook, read.snapshot.books);
  }

  backFromSelection(): void {
    if (!this.ports.mutations().snapshot.batchRemovalBusy) this.returnToBookshelf();
  }

  finishSelection(): void {
    const next = this.navigation.finishBookshelfMultiSelect((): void => { this.ports.advance(); });
    if (next !== undefined) this.ports.publish(next);
  }

  openSearch(): void {
    const acquisition = this.ports.acquisition();
    if (acquisition.currentOwner() === undefined) return;
    const next = this.navigation.openLibrarySearch((): void => {
      this.ports.search().prepareEntry();
      this.ports.advance();
    }, (): boolean => {
      if (!acquisition.beginSearch()) return false;
      this.ports.reading().endReading(this.ports.scope().owner);
      return true;
    });
    if (next === undefined) return;
    this.ports.publish(next);
    this.ports.search().open(this.ports.refreshMembership);
  }

  search(keyword: string, scopeSourceIds?: string[]): void {
    const acquisition = this.ports.acquisition();
    if (this.navigation.snapshot().route !== 'search' || keyword.trim().length === 0 || acquisition.currentOwner() === undefined) return;
    this.ports.advance();
    if (acquisition.beginSearch()) this.ports.search().search(keyword, scopeSourceIds);
  }

  back(): void {
    if (this.navigation.snapshot().route === 'search' && this.ports.search().back()) this.returnToBookshelf();
  }

  settled(mode: LibrarySearchMode, identity: number): void {
    const search = this.ports.search();
    if (this.navigation.snapshot().route === 'search' && mode === 'idle' && mode === search.mode && identity === search.identity) {
      this.returnToBookshelf();
    }
  }

  selectResult(book: SearchBook, variants: SearchBook[], cover?: string, focusKey?: string): void {
    if (!this.ports.scope().inputAllowed) return;
    this.ports.search().selectResult(book, variants, this.ports.shelfBooks(), {
      beginLocalRead: (): (() => boolean) => {
        const owner = this.ports.scope().owner;
        const generation = this.ports.advance();
        const mounting = this.ports.scope().mounting, host = this.ports.search().host;
        return (): boolean => this.ports.scope().inputAllowed && this.isCurrentSearch(generation, owner, mounting, host);
      },
      loadLocal: this.ports.loadLocalBook,
      refreshMembership: this.ports.refreshMembership,
      failure: this.ports.failure,
      sourceName: this.ports.sourceName,
      local: (saved: ShelfBook): boolean =>
        this.navigation.admitDetailFrom('search', (): void => this.ports.readingActions().openLocalDetail(saved)),
      remote: (input: RemoteReadingEntryInput): boolean =>
        this.navigation.admitDetailFrom('search', (): void => this.ports.readingActions().openRemoteDetail(input)),
    }, cover, focusKey);
  }

  returnFromDetail(): void {
    this.navigation.returnFromDetail(this.ports.runtime(), {
      resumeReader: (): void => this.ports.readingActions().openReading(undefined),
      leaveForSearch: (): void => {
        this.ports.search().prepareReturnFromDetail();
        this.ports.advance();
        this.ports.reading().leaveDetail(this.ports.runtime());
      },
      restoreSearch: (snapshot: ReaderNavigationSnapshot): void => {
        this.ports.publish(snapshot);
        this.ports.search().resumeAfterDetail();
        this.ports.refreshMembership();
      },
      showBookshelf: (focus: BookshelfDetailReturnFocus | undefined): void => this.returnToBookshelf(focus),
    });
  }

  returnToBookshelf(focus?: BookshelfDetailReturnFocus): void {
    const next = this.navigation.returnToBookshelf(focus, (): void => {
      this.ports.search().close();
      this.ports.advance();
      this.ports.reading().leaveDetail(this.ports.runtime());
      this.ports.clearRssSelection();
      this.ports.acquisition().endSearch();
    });
    if (next === undefined) return;
    this.ports.publish(next);
    this.ports.refreshShelf();
    // Read again under the bookshelf lease after retiring the detail's readback.
    this.ports.readbackOnBookshelf();
  }
}
