import type { ShelfBook } from '../ReaderCoreGateway';
import type { ReaderRuntimeOwner } from '../ReaderRuntimeOwner';
import type { DetailReturnRoute, ReaderNavigation, ReaderReturnContext } from '../navigation/ReaderNavigation';
import type { MangaSourceSwitchPresentation, MangaSourceSwitchScene } from '../../features/manga/presentation/MangaSourceSwitchPresentation';
import type { ReaderReadingEntryActions } from './ReaderReadingEntryActions';
import type { ReadingBookDetail } from '../../features/reading/presentation/ReadingBookDetail';
import type { RemoteReadingBookSeed, RemoteReadingSession } from '../../features/reading/application/RemoteReadingFlowGateway';
import type { CommittedReadingSourceOpening, ReadingEntryPorts, ReadingEntryPresentation } from '../../features/reading/presentation/ReadingEntryPresentation';
import type { LibrarySearchPresentation } from '../../features/search/presentation/LibrarySearchPresentation';
import type { SearchBook } from '../../features/search/application/SearchGateway';
import type { SourceSwitchHost } from '../../features/source/application/SourceSwitchHost';
import type { SourceSwitchPresentation, SourceSwitchScene, SourceSwitchWorkflowPorts } from '../../features/source/presentation/SourceSwitchPresentation';

export interface ReaderSourceSwitchScope {
  owner?: ReaderRuntimeOwner;
  retired: boolean;
  mount: number;
}

export interface ReaderSourceSwitchJourneyPorts {
  scope: () => ReaderSourceSwitchScope;
  runtime: () => ReaderRuntimeOwner | undefined;
  entry: () => ReadingEntryPresentation;
  entryActions: () => ReaderReadingEntryActions;
  entryPorts: (owner: ReaderRuntimeOwner) => ReadingEntryPorts;
  source: () => SourceSwitchPresentation;
  manga: () => MangaSourceSwitchPresentation;
  search: () => LibrarySearchPresentation;
  shelfBooks: () => ShelfBook[];
  removalPending: () => boolean;
  captureReturn: () => ReaderReturnContext | undefined;
  restoreReturn: (context: ReaderReturnContext | undefined) => boolean;
  advance: () => void;
  showReading: () => void;
  leaveReader: () => void;
  bindReader: () => void;
  sourceName: (sourceId: string, persistedName?: string) => string;
  invalidateDownloads: () => void;
  refreshShelf: () => void;
  navigationSettled: () => void;
}

/** Connects text and manga switch outcomes to the same reading and return path. */
export class ReaderSourceSwitchJourney {
  private readonly navigation: ReaderNavigation;
  private readonly ports: ReaderSourceSwitchJourneyPorts;
  constructor(navigation: ReaderNavigation, ports: ReaderSourceSwitchJourneyPorts) {
    this.navigation = navigation;
    this.ports = ports;
  }

  scene(): SourceSwitchScene {
    const scope = this.ports.scope();
    const entry = this.ports.entry();
    return { owner: scope.owner, retired: scope.retired, mount: scope.mount,
      navigation: this.navigation.snapshot().generation, book: entry.book, reading: entry.sessionActive };
  }

  mangaScene(): MangaSourceSwitchScene {
    const scope = this.ports.scope();
    const route = this.navigation.snapshot();
    const entry = this.ports.entry();
    return { owner: scope.owner, retired: scope.retired, mounting: scope.mount, navigation: route.generation,
      route: route.route, book: entry.book, session: entry.session, reading: entry.sessionActive, inBookshelf: entry.inBookshelf };
  }

  host(): SourceSwitchHost | undefined { return this.ports.source().acquire(this.scene()); }

  workflow(): SourceSwitchWorkflowPorts {
    const fromSearch = (): boolean => this.navigation.returns.snapshot().detailParent === 'search';
    return {
      scene: (): SourceSwitchScene => this.scene(),
      entry: this.ports.entry,
      shelfBook: (sourceId: string, bookId: string): ShelfBook | undefined => this.ports.shelfBooks().find(
        (book: ShelfBook): boolean => book.sourceId === sourceId && book.bookId === bookId),
      searchCandidates: (): SearchBook[] => fromSearch() ? this.ports.search().candidates() : [],
      searchedSourceIds: (): string[] => fromSearch() ? this.ports.search().host.searchedSourceIds() : [],
      preview: (seed: RemoteReadingBookSeed, sourceName: string, session: RemoteReadingSession): void =>
        this.preview(seed, sourceName, session),
      target: (book: ShelfBook, session: RemoteReadingSession, chapterIndex: number): void =>
        this.commit(book, session, chapterIndex),
      reopen: (book: ShelfBook): void => this.reopenCommitted(book),
      invalidateDownloads: (book: ShelfBook): void => this.invalidateDownloadsFor(book),
      detailForShelf: (book: ShelfBook): ReadingBookDetail => this.ports.entry().detailForShelf(book,
        this.ports.sourceName(book.sourceId, book.sourceName)),
      clearSession: (): void => this.ports.entry().installSession(this.ports.runtime(), undefined, this.ports.bindReader),
      restored: (identitiesChanged: boolean): void => {
        this.ports.entry().resumeRestoredSource(this.ports.runtime(), identitiesChanged);
        this.presentReader();
      },
      failed: (): void => this.presentReaderFailure(),
      refreshShelf: this.ports.refreshShelf,
      closed: this.ports.navigationSettled,
    };
  }

  openReader(): void {
    const entry = this.ports.entry();
    const source = this.ports.source();
    if (!entry.sessionActive) {
      if (!source.canOpenEntry(entry.book)) return;
      this.ports.leaveReader();
      this.openDetail();
      return;
    }
    source.openForEntry(this.workflow(), (): void => {
      this.ports.advance();
      this.presentReader();
      this.ports.bindReader();
    });
  }

  openDetail(): void {
    const route = this.navigation.snapshot();
    const fromDirectory = route.route === 'directory' && route.directoryReturnTarget === 'detail' &&
      !this.ports.entry().sessionActive;
    if ((!fromDirectory && route.route !== this.navigation.returns.snapshot().readingOrigin) ||
      this.ports.manga().selectionVisible || this.ports.removalPending()) return;
    this.ports.source().openForEntry(this.workflow(), (): void => {
      // Keep the directory mount and its temporary Back registration under the picker.
      if (!fromDirectory) {
        this.ports.advance();
        this.ports.bindReader();
      }
    });
  }

  preview(seed: RemoteReadingBookSeed, sourceName: string, session: RemoteReadingSession): void {
    this.navigation.returns.reopenPreservingReaderReturn(this.ports.captureReturn, (parent: DetailReturnRoute): void => {
      this.ports.entryActions().openRemoteDetail({ seed, sourceName, resumeImmediately: true, validatedSession: session }, parent);
    }, this.ports.restoreReturn);
  }

  commit(book: ShelfBook, session?: RemoteReadingSession, chapterIndex?: number): void {
    const owner = this.ports.runtime();
    if (owner === undefined) return;
    if (!this.ports.entry().adoptCommittedSource(owner, book, session, chapterIndex, (): CommittedReadingSourceOpening => {
      this.invalidateDownloadsFor(book);
      this.ports.advance();
      return { sourceName: this.ports.sourceName(book.sourceId, book.sourceName), ports: this.ports.entryPorts(owner) };
    })) {
      this.retire();
      this.reopenCommitted(book);
      return;
    }
    this.presentReader();
  }

  reopenCommitted(book: ShelfBook): void {
    this.navigation.returns.reopenPreservingReaderReturn(this.ports.captureReturn, (parent: DetailReturnRoute): void => {
      this.invalidateDownloadsFor(book);
      this.ports.entryActions().openShelfEntry(book, 'committedSource', parent);
    }, this.ports.restoreReturn);
  }

  retire(): void {
    this.ports.manga().retire();
    this.ports.source().retire();
  }

  presentReaderFailure(): void {
    if (!this.ports.entry().sessionActive) this.ports.entryActions().openReading(undefined);
    this.ports.showReading();
  }

  private presentReader(): void {
    this.navigation.prepareReaderDestination('reading');
    this.ports.showReading();
  }

  private invalidateDownloadsFor(book: ShelfBook): void {
    const current = this.ports.entry().book;
    if (current?.sourceId !== book.sourceId || current?.bookId !== book.bookId) this.ports.invalidateDownloads();
  }
}
