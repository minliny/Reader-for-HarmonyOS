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
import type {
  LibrarySearchBackConsumer, LibrarySearchMode, LibrarySearchPresentation,
} from '../../features/search/presentation/LibrarySearchPresentation';
import type { SearchWriteLease } from '../../features/search/application/SearchOrchestrator';
import type { SearchBook } from '../../features/search/application/SearchGateway';
import type { SearchHost } from '../../features/search/application/SearchHost';
import type { RemoteReadingEntryInput } from '../../features/reading/application/ReadingEntryHost';
import type { ReadingEntryPresentation } from '../../features/reading/presentation/ReadingEntryPresentation';
import type { ReaderLibraryAcquisitionBinding } from './ReaderLibraryAcquisitionBinding';
import type { ReaderReadingEntryActions } from './ReaderReadingEntryActions';

interface LibrarySearchEvidence {
  identity: number;
  navigation: number;
  mounting: number;
  queryRevision: number;
  owner?: number;
  mode?: LibrarySearchMode;
  previousNavigation?: number;
  previousOwner?: number;
  previousQueryRevision?: number;
  length?: number;
  route?: string;
  consumer?: LibrarySearchBackConsumer;
  entry?: 'empty-shelf';
  beforeLease?: SearchWriteLease;
  writeLease?: SearchWriteLease;
}

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
        if (identity !== this.ports.search().identity || !this.isInteractiveBookshelf(generation, owner, mounting)) return;
        this.openSearch();
      },
      onBack: (identity: number, generation: number, mounting: number): void => {
        if (this.ports.scope().inputAllowed && identity === this.ports.search().identity &&
          this.isCurrentSearch(generation, owner, mounting, host)) this.ports.back();
      },
      onInputRequested: (identity: number, generation: number, mounting: number): void => {
        const search = this.ports.search(), verification = search.model.verification;
        if (!this.ports.scope().inputAllowed || identity !== search.identity ||
          !this.isCurrentSearch(generation, owner, mounting, host) || search.mode !== 'results') return;
        const beforeLease = verification?.enabled() === true ? host.observeWriteLease() : undefined;
        search.edit();
        if (beforeLease !== undefined && verification !== undefined) {
          const facts: LibrarySearchEvidence = { identity: identity, navigation: generation, mounting: mounting,
            owner: search.model.currentOwner(), queryRevision: host.viewState.revision, mode: search.mode,
            beforeLease: beforeLease, writeLease: host.observeWriteLease() };
          verification.emit('search-edit-accepted', 'business', facts);
        }
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
        if (!this.isCurrentSearch(generation, owner, mounting, host)) return;
        const search = this.ports.search(), verification = search.model.verification;
        if (mode !== 'idle' && verification !== undefined && verification.enabled()) {
          if (mode === search.mode && identity === search.identity) {
            const facts: LibrarySearchEvidence = { identity: identity, navigation: generation, mounting: mounting,
              owner: search.model.currentOwner(), queryRevision: host.viewState.revision, mode: mode };
            verification.emit('search-surface-settled', 'business', facts);
          }
        }
        this.settled(mode, identity);
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

  openSearch(entry: 'header' | 'empty-shelf' = 'header'): void {
    const acquisition = this.ports.acquisition();
    if (acquisition.currentOwner() === undefined) return;
    const opening = this.navigation.snapshot();
    const mounting = this.ports.scope().mounting;
    const identity = this.ports.search().identity;
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
    const search = this.ports.search(), verification = search.model.verification;
    if (verification !== undefined && verification.enabled()) {
      const route = this.navigation.snapshot();
      if (opening.route === 'bookshelf' && route.route === 'search' && route.generation > opening.generation &&
          this.ports.scope().mounting === mounting && search.mode === 'input' && search.identity !== identity) {
        const facts: LibrarySearchEvidence = { identity: search.identity, navigation: route.generation,
          mounting: mounting, queryRevision: search.host.viewState.revision };
        if (entry === 'empty-shelf') facts.entry = entry;
        verification.emit('search-open-accepted', 'business', facts);
      }
    }
  }

  search(keyword: string, scopeSourceIds?: string[]): void {
    const acquisition = this.ports.acquisition();
    const opening = this.navigation.snapshot();
    if (opening.route !== 'search' || keyword.trim().length === 0 || acquisition.currentOwner() === undefined) return;
    const searchAtBegin = this.ports.search(), verification = searchAtBegin.model.verification;
    const verify = verification?.enabled() === true;
    const previousOwner = verify ? searchAtBegin.model.currentOwner() : 0;
    const previousQuery = verify ? searchAtBegin.host.viewState.revision : 0;
    this.ports.advance();
    if (!acquisition.beginSearch()) return;
    const search = this.ports.search();
    search.search(keyword, scopeSourceIds);
    if (verify && verification !== undefined && search === searchAtBegin &&
      search.mode === 'results' && search.host.viewState.revision > previousQuery) {
      const facts: LibrarySearchEvidence = { identity: search.identity, navigation: this.navigation.snapshot().generation,
        mounting: this.ports.scope().mounting, queryRevision: search.host.viewState.revision, previousQueryRevision: previousQuery,
        previousOwner: previousOwner, previousNavigation: opening.generation, length: keyword.trim().length,
        writeLease: search.host.observeWriteLease() };
      verification.emit('search-submit-accepted', 'business', facts);
    }
  }

  back(): void {
    const opening = this.navigation.snapshot();
    if (opening.route !== 'search') return;
    const search = this.ports.search(), verification = search.model.verification;
    const observe = verification?.enabled() === true ? (consumer: LibrarySearchBackConsumer): void => {
      const facts: LibrarySearchEvidence = { identity: search.identity, navigation: opening.generation,
        mounting: this.ports.scope().mounting, queryRevision: search.host.viewState.revision, mode: search.mode,
        owner: search.model.currentOwner(), consumer: consumer, route: opening.route };
      verification.emit('search-back-consumed', 'business', facts);
    } : undefined;
    if (search.back(observe)) this.returnToBookshelf();
  }

  settled(mode: LibrarySearchMode, identity: number): void {
    const search = this.ports.search();
    if (this.navigation.snapshot().route === 'search' && mode === 'idle' && mode === search.mode && identity === search.identity) {
      this.returnToBookshelf();
    }
  }

  selectResult(book: SearchBook, variants: SearchBook[], cover?: string, focusKey?: string): void {
    if (!this.ports.scope().inputAllowed) return;
    const search = this.ports.search();
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
      local: (saved: ShelfBook): boolean => this.admitSearchDetail(search,
        (): void => this.ports.readingActions().openLocalDetail(saved)),
      remote: (input: RemoteReadingEntryInput): boolean => this.admitSearchDetail(search,
        (): void => this.ports.readingActions().openRemoteDetail(input)),
    }, cover, focusKey);
  }

  private admitSearchDetail(search: LibrarySearchPresentation, open: () => void): boolean {
    const verification = search.model.verification;
    const previousOwner = search.model.currentOwner(), route = this.navigation.snapshot();
    const accepted = this.navigation.admitDetailFrom('search', open);
    if (accepted && verification?.enabled() === true) {
      const detail = this.navigation.snapshot();
      const facts: LibrarySearchEvidence = { identity: search.identity, navigation: detail.generation,
        mounting: this.ports.scope().mounting, queryRevision: search.host.viewState.revision,
        previousOwner: previousOwner, previousNavigation: route.generation, route: detail.route };
      verification.emit('search-detail-accepted', 'business', facts);
    }
    return accepted;
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
        const search = this.ports.search(), verification = search.model.verification;
        if (verification?.enabled() === true) {
          const facts: LibrarySearchEvidence = { identity: search.identity, navigation: snapshot.generation,
            mounting: this.ports.scope().mounting, queryRevision: search.host.viewState.revision, route: snapshot.route };
          verification.emit('search-detail-returned', 'business', facts);
        }
      },
      showBookshelf: (focus: BookshelfDetailReturnFocus | undefined): void => this.returnToBookshelf(focus),
    });
  }

  returnToBookshelf(focus?: BookshelfDetailReturnFocus): void {
    const opening = this.navigation.snapshot(), search = this.ports.search(), verification = search.model.verification;
    const observe = opening.route === 'search' && verification?.enabled() === true;
    const previousOwner = observe ? search.model.currentOwner() : undefined;
    const next = this.navigation.returnToBookshelf(focus, (): void => {
      this.ports.search().close();
      this.ports.advance();
      this.ports.reading().leaveDetail(this.ports.runtime());
      this.ports.clearRssSelection();
      this.ports.acquisition().endSearch();
    });
    if (next === undefined) return;
    this.ports.publish(next);
    if (observe && verification !== undefined) {
      const facts: LibrarySearchEvidence = { identity: search.identity, navigation: next.generation,
        mounting: this.ports.scope().mounting, queryRevision: search.host.viewState.revision, mode: search.mode,
        previousOwner: previousOwner, previousNavigation: opening.generation, route: next.route,
        writeLease: search.host.observeWriteLease() };
      verification.emit('search-route-released', 'business', facts);
    }
    this.ports.refreshShelf();
    // Read again under the bookshelf lease after retiring the detail's readback.
    this.ports.readbackOnBookshelf();
  }
}
