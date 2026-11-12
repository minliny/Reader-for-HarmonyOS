import type { ShelfBook } from '../ReaderCoreGateway';
import type { ReaderRuntimeOwner } from '../ReaderRuntimeOwner';
import type { ReaderEntryStartupTrace } from '../ReaderStartupTrace';
import type { DetailReturnRoute, ReaderNavigation, ReaderReturnContext, ReaderRoute } from '../navigation/ReaderNavigation';
import type { DownloadReadingEntry } from '../../features/downloads/presentation/SharedDownloadPresentation';
import type { SharedDownloadOpeningIntent } from '../../features/downloads/presentation/SharedDownloadUiContract';
import type { LibrarySearchPresentation } from '../../features/search/presentation/LibrarySearchPresentation';
import type { SourceSwitchPresentation } from '../../features/source/presentation/SourceSwitchPresentation';
import type { ReaderDirectoryTargetProof } from '../../features/reading/application/ReaderDirectoryTargetProof';
import type { RemoteReadingEntryInput } from '../../features/reading/application/ReadingEntryHost';
import type { RemoteReadingBookSeed, RemoteReadingSession } from '../../features/reading/application/RemoteReadingFlowGateway';
import { readingEntryInputForSearchContext } from '../../features/reading/presentation/ReadingEntryDto';
import type { PreparedReaderOpening, ReadingEntryPorts, ReadingEntryPresentation, ReadingShelfEntryIntent,
  RemoteDetailOpening } from '../../features/reading/presentation/ReadingEntryPresentation';

export interface ReaderReadingEntryActionPorts {
  runtime: () => ReaderRuntimeOwner | undefined;
  mounting: () => number;
  entry: () => ReadingEntryPresentation;
  search: () => LibrarySearchPresentation;
  sourceSwitch: () => SourceSwitchPresentation;
  shelfBooks: () => ShelfBook[];
  removalPending: () => boolean;
  readerExitPending: () => boolean;
  advance: () => number;
  show: (route: ReaderRoute) => void;
  bindReader: () => void;
  restoreReaderReturn: (context: ReaderReturnContext | undefined) => boolean;
  entryPorts: (owner: ReaderRuntimeOwner) => ReadingEntryPorts;
  sourceName: (sourceId: string, persistedName?: string) => string;
  failure: (title: string, message: string) => void;
  afterOpening: (project: () => void) => void;
  postFrame: (action: () => void) => void;
  refreshNearEnd: (session: RemoteReadingSession, chapterIndex: number) => void;
}

/** Connects the reading entry owner to navigation and the retained scene. */
@Observed
export class ReaderReadingEntryActions {
  shelfPreparing: boolean = false;
  private shelfEntryNavigation: number = -1;
  private readonly navigation: ReaderNavigation;
  private readonly startup: ReaderEntryStartupTrace;
  private readonly ports: ReaderReadingEntryActionPorts;

  constructor(navigation: ReaderNavigation, startup: ReaderEntryStartupTrace, ports: ReaderReadingEntryActionPorts) {
    this.navigation = navigation;
    this.startup = startup;
    this.ports = ports;
  }

  retirePreparation(): void { this.shelfPreparing = false; }

  async refreshDetailAcquisition(): Promise<void> {
    const owner = this.ports.runtime();
    if (owner !== undefined && this.navigation.snapshot().route === 'detail' && !this.ports.sourceSwitch().visible) {
      await this.ports.entry().refreshDetailAcquisition(owner, this.ports.entryPorts(owner));
    }
  }

  readingReadyCallback(sourceId: string, bookId: string, generation: number): (chapterIndex: number) => void {
    return (chapterIndex: number): void => {
      const owner = this.ports.runtime();
      if (owner === undefined || this.ports.readerExitPending() ||
        !this.ports.entry().acceptReaderPageReady(owner, sourceId, bookId, generation, chapterIndex)) return;
      this.presentPreparedReading(chapterIndex);
      this.scheduleNavigationBackfillAfterReady(owner, sourceId, bookId, generation);
    };
  }

  private scheduleNavigationBackfillAfterReady(owner: ReaderRuntimeOwner, sourceId: string, bookId: string,
    generation: number): void {
    const route = this.navigation.snapshot();
    if (route.route !== 'reading') return;
    const navigation = route.generation, mounting = this.ports.mounting();
    this.ports.entry().armLocalDirectoryBackfill({ owner, sourceId, bookId, generation, navigation,
      current: (): boolean => this.ports.runtime() === owner && this.navigation.snapshot().generation === navigation &&
        this.ports.mounting() === mounting,
      postFrame: this.ports.postFrame,
    });
  }

  acceptReaderSession(session: RemoteReadingSession, refreshDirectoryDisplay: boolean = false): void {
    const entry = this.ports.entry();
    if (!entry.sessionActive) return;
    const owner = this.ports.runtime();
    if (owner === undefined) return;
    entry.acceptReaderSession(owner, session, refreshDirectoryDisplay, this.ports.bindReader,
      (chapterIndex: number): void => this.ports.refreshNearEnd(session, chapterIndex));
  }

  resumeShelf(book: ShelfBook): void {
    const owner = this.ports.runtime();
    if (owner === undefined) return;
    const entry = this.ports.entry();
    if (!entry.admitShelfResume(owner, book, this.ports.failure)) return;
    const route = this.navigation.snapshot();
    if (route.route === 'bookshelf') {
      entry.beginReaderPresentation();
      this.shelfEntryNavigation = route.generation;
      this.startup.beginShelf(route.generation);
      this.navigation.returns.rememberBookshelfReaderOrigin();
    }
    this.openShelfEntry(book, 'resume');
  }

  openShelfEntry(book: ShelfBook, intent: ReadingShelfEntryIntent, parent?: DetailReturnRoute): void {
    const owner = this.ports.runtime();
    if (owner === undefined) return;
    this.ports.entry().openShelfEntry(owner, book, intent, {
      sourceName: (): string => this.ports.sourceName(book.sourceId, book.sourceName),
      local: (selection: ShelfBook, resume: boolean): void => this.openLocalDetail(selection, resume, parent),
      remote: (input: RemoteReadingEntryInput): void => this.openRemoteDetail(input, parent),
    });
  }

  openDownloadChapter(download: DownloadReadingEntry, restoreDownloads: (intent: SharedDownloadOpeningIntent) => void): void {
    if (this.ports.runtime() === undefined || this.ports.removalPending()) return;
    this.navigation.openDownloadChapter({
      openBook: (parent: DetailReturnRoute): void => {
        const book = download.shelfBook;
        if (download.seed === undefined) {
          this.openLocalDetail(book, true, parent, download);
        } else {
          this.openRemoteDetail({ seed: download.seed, sourceName: download.sourceLabel, shelfSnapshot: book,
            resumeImmediately: true, validatedSession: download.session }, parent, download);
        }
      },
      readingActive: (): boolean => this.ports.entry().sessionActive,
      restoreDownloads,
    });
  }

  openLocalDetail(book: ShelfBook, resume: boolean = false, parent?: DetailReturnRoute, download?: DownloadReadingEntry): void {
    const owner = this.ports.runtime();
    if (owner === undefined) return;
    const admitted = this.ports.entry().enterLocalDetail(owner, book, resume, (): ReadingEntryPorts => {
      this.ports.show(this.prepareDetailRoute(owner, resume, parent));
      this.ports.search().host.visibilityChanged();
      return this.ports.entryPorts(owner);
    });
    if (admitted && resume) this.resumeDetail(owner, download);
  }

  openRemoteDetail(input: RemoteReadingEntryInput, parent?: DetailReturnRoute, download?: DownloadReadingEntry): void {
    const owner = this.ports.runtime();
    if (owner === undefined) return;
    const resume = input.resumeImmediately === true;
    const request = readingEntryInputForSearchContext(input, this.navigation.snapshot().route === 'search');
    const admitted = this.ports.entry().enterRemoteDetail(owner,
      request,
      (projectKind: () => void, fallbackSeeds: RemoteReadingBookSeed[]): RemoteDetailOpening => {
        const route = this.prepareDetailRoute(owner, resume, parent);
        projectKind();
        this.ports.show(route);
        const search = this.ports.search();
        search.host.visibilityChanged();
        const candidates = search.admissionCandidates(input.seed, fallbackSeeds);
        return { shelfBooks: this.ports.shelfBooks(), sourceSwitchPending: this.ports.sourceSwitch().pending !== undefined,
          candidates, ports: this.ports.entryPorts(owner) };
      }, this.ports.failure);
    if (admitted && resume) this.resumeDetail(owner, download);
  }

  private resumeDetail(owner: ReaderRuntimeOwner, download: DownloadReadingEntry | undefined): void {
    if (download === undefined) {
      this.openReading(undefined);
      return;
    }
    const book = this.ports.entry().book;
    if (this.ports.runtime() !== owner || this.ports.removalPending() || book === undefined ||
      book.sourceId !== download.shelfBook.sourceId || book.bookId !== download.shelfBook.bookId) return;
    // The download projection has already admitted this chapter. A local
    // resume mounts before its own directory is available.
    this.startReading(owner, download.chapterIndex, undefined, download.mangaOfflineChapterId);
  }

  private prepareDetailRoute(owner: ReaderRuntimeOwner, resume: boolean, parent?: DetailReturnRoute): 'bookshelf' | 'detail' {
    this.navigation.returns.beginDetailEntry(parent);
    const origin = this.navigation.snapshot().route;
    const generation = this.ports.advance();
    const route = this.navigation.returns.completeDetailEntry(origin, parent, resume);
    if (resume && route === 'bookshelf') this.shelfEntryNavigation = generation;
    this.shelfPreparing = route === 'bookshelf';
    this.ports.entry().finishReading(owner);
    this.ports.sourceSwitch().failureMessage = '';
    this.navigation.prepareReaderDestination('reading');
    return route;
  }

  openReading(chapterIndex: number | undefined, proof?: ReaderDirectoryTargetProof): void {
    const owner = this.ports.runtime();
    const entry = this.ports.entry();
    if (owner === undefined || entry.book === undefined ||
      (chapterIndex !== undefined && !entry.isKnownChapter(chapterIndex)) || this.ports.removalPending()) return;
    this.startReading(owner, chapterIndex, proof);
  }

  private startReading(owner: ReaderRuntimeOwner, chapterIndex: number | undefined, proof?: ReaderDirectoryTargetProof,
    mangaOfflineChapterId?: string): void {
    const entry = this.ports.entry();
    this.navigation.returns.restoreReaderBehindDetail(this.ports.restoreReaderReturn);
    const shelfEntry = this.shelfPreparing && this.shelfEntryNavigation === this.navigation.snapshot().generation;
    if (!shelfEntry) {
      entry.beginReaderPresentation();
      this.startup.begin();
    }
    const generation = this.ports.advance();
    if (shelfEntry) this.shelfEntryNavigation = generation;
    this.shelfPreparing = this.navigation.snapshot().route === 'bookshelf';
    this.navigation.prepareReaderDestination('reading');
    // The reader can mount while its catalog or first chapter is still loading.
    entry.beginReading(owner, chapterIndex, proof, mangaOfflineChapterId);
    this.ports.show('reading');
    this.ports.bindReader();
    this.shelfPreparing = false;
    if (shelfEntry) this.startup.shelfPhase('reader-mount-request', generation);
  }

  presentPreparedReading(chapterIndex: number): void {
    const route = this.navigation.snapshot();
    if (this.ports.readerExitPending() || (route.route !== 'reading' && route.route !== 'detail' &&
      route.route !== 'directory' && !(route.route === 'bookshelf' && this.shelfPreparing))) return;
    this.ports.entry().presentPreparedPage(chapterIndex, route.route === 'directory', (): PreparedReaderOpening => {
      this.startup.ready(this.shelfPreparing && this.shelfEntryNavigation === route.generation ? route.generation : undefined);
      this.shelfPreparing = false;
      this.ports.show(this.navigation.readerDestinationWhenReady());
      const owner = this.ports.runtime();
      return { runtime: this.ports.runtime, current: (): boolean => owner !== undefined && this.ports.runtime() === owner,
        afterOpening: this.ports.afterOpening };
    });
  }
}
