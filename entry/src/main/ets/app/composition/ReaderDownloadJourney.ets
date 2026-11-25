import type { ShelfBook } from '../ReaderCoreGateway';
import type { ReaderRuntimeOwner } from '../ReaderRuntimeOwner';
import type { DetailReturnRoute, ReaderNavigation, ReaderNavigationSnapshot, ReaderReturnContext } from '../navigation/ReaderNavigation';
import { downloadBookFromReadingDetail, remoteReadingSeedForShelf } from '../../features/reading/presentation/ReadingBookDetail';
import { readingEntrySeedForContentKind } from '../../features/reading/presentation/ReadingEntryDto';
import { LOCAL_SOURCE_ID } from '../../features/reading/application/LocalReadingFlowGateway';
import type { RemoteReadingBookSeed } from '../../features/reading/application/RemoteReadingFlowGateway';
import type { ReadingEntryPresentation } from '../../features/reading/presentation/ReadingEntryPresentation';
import type { DownloadReadingEntry, SharedDownloadPresentation } from '../../features/downloads/presentation/SharedDownloadPresentation';
import type { SharedDownloadOpeningIntent, SharedDownloadReturnState } from '../../features/downloads/presentation/SharedDownloadUiContract';
import type { ReaderReadingEntryActions } from './ReaderReadingEntryActions';
import type { ReaderExitActions } from './ReaderExitActions';

export interface ReaderDownloadJourneyScope {
  instance: number;
  mounting: number;
  inputAllowed: boolean;
}

export interface ReaderDownloadJourneyPorts {
  scope: () => ReaderDownloadJourneyScope;
  runtime: () => ReaderRuntimeOwner | undefined;
  downloads: () => SharedDownloadPresentation;
  reading: () => ReadingEntryPresentation;
  readingActions: () => ReaderReadingEntryActions;
  exitActions: () => ReaderExitActions;
  shelfBooks: () => ShelfBook[];
  advance: () => void;
  publish: (snapshot: ReaderNavigationSnapshot) => void;
  showBookshelf: () => void;
  showSettings: () => void;
  openDetailDirectory: () => void;
  feedback: (message: string) => void;
}

/** Connects downloads to existing reading admission, exit and return owners. */
export class ReaderDownloadJourney {
  private readonly navigation: ReaderNavigation;
  private readonly ports: ReaderDownloadJourneyPorts;
  constructor(navigation: ReaderNavigation, ports: ReaderDownloadJourneyPorts) {
    this.navigation = navigation;
    this.ports = ports;
  }

  open(intent: SharedDownloadOpeningIntent = { kind: 'fresh', detailKey: '' }): void {
    const owner = this.ports.runtime();
    if (this.ports.reading().sessionActive || owner === undefined) return;
    const next = this.navigation.openDownloads(intent, (): ShelfBook | undefined => this.currentBook(), this.ports.advance,
      this.ports.reading().seed);
    if (next === undefined) return;
    const generation = next.generation, scope = this.ports.scope();
    const identity = JSON.stringify([scope.instance, scope.mounting, generation, 'downloads']);
    this.ports.publish(next);
    this.ports.downloads().open(owner, identity,
      (): boolean => this.ports.runtime() === owner && this.navigation.snapshot().route === 'downloads' &&
        this.navigation.snapshot().generation === generation,
      intent, this.currentBook(), this.ports.feedback);
  }

  currentBook(): ShelfBook | undefined {
    return downloadBookFromReadingDetail(this.ports.reading().book, this.ports.shelfBooks());
  }

  requestFromReader(detailKey: string = ''): void {
    this.ports.exitActions().requestDownloads(this.currentBook(), detailKey);
  }

  returnFromDownloads(): void {
    if (this.ports.runtime() === undefined) return;
    this.navigation.returnFromDownloads({
      showBookshelf: this.ports.showBookshelf,
      showSettings: this.ports.showSettings,
      restoreReader: (context: ReaderReturnContext | undefined): boolean => this.restoreReaderReturn(context),
      resumeReader: (book: ShelfBook): void => this.ports.readingActions().resumeShelf(book),
      showBook: (book: ShelfBook, parent: DetailReturnRoute, restoreDirectory: boolean, detailSeed?: RemoteReadingBookSeed): void => {
        this.reopenDetail(book, parent, detailSeed);
        const current = this.ports.reading().book;
        if (restoreDirectory && this.navigation.snapshot().route === 'detail' &&
          current?.sourceId === book.sourceId && current?.bookId === book.bookId) {
          this.ports.openDetailDirectory();
        }
      },
    });
  }

  private reopenDetail(book: ShelfBook, parent: DetailReturnRoute, detailSeed?: RemoteReadingBookSeed): void {
    const actions = this.ports.readingActions();
    if (book.sourceId === LOCAL_SOURCE_ID) {
      actions.openShelfEntry(book, 'info', parent);
      return;
    }
    const reading = this.ports.reading();
    const current = reading.book;
    const retained = current?.sourceId === book.sourceId && current.bookId === book.bookId;
    const session = reading.session;
    const validatedSession = retained && session?.identity.sourceId === book.sourceId &&
      session.identity.bookId === book.bookId ? session : undefined;
    const shelf = this.ports.shelfBooks().find((row: ShelfBook): boolean => row.sourceId === book.sourceId && row.bookId === book.bookId);
    const seed = detailSeed ?? remoteReadingSeedForShelf(book);
    actions.openRemoteDetail({ seed: readingEntrySeedForContentKind(seed, book.contentKind ?? seed.contentKind), sourceName: book.sourceName ?? '',
      shelfSnapshot: shelf?.contentKind === undefined ? undefined : shelf, validatedSession,
      displayCoverUrl: retained ? current?.displayCoverUrl : undefined }, parent);
  }

  openChapter(entry: DownloadReadingEntry): void {
    if (!this.ports.scope().inputAllowed) return;
    this.ports.readingActions().openDownloadChapter(entry, (intent: SharedDownloadOpeningIntent): void => this.open(intent));
  }

  captureReaderReturn(): ReaderReturnContext | undefined {
    const owner = this.ports.runtime();
    if (owner === undefined) return undefined;
    return this.navigation.returns.captureReaderReturn(owner, (): SharedDownloadReturnState =>
      this.ports.downloads().captureReturn(owner));
  }

  restoreReaderReturn(context: ReaderReturnContext | undefined): boolean {
    if (context === undefined || this.ports.runtime() !== context.owner) return false;
    this.navigation.returns.restoreReaderReturn(context, (state: SharedDownloadReturnState): void =>
      this.ports.downloads().restoreReturn(context.owner, state));
    return true;
  }
}
