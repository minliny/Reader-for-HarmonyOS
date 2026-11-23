import type { ShelfBook } from '../ReaderCoreGateway';
import type { ReaderRuntimeOwner } from '../ReaderRuntimeOwner';
import type { ReaderNavigation, ReaderNavigationSnapshot, ReaderReturnContext } from '../navigation/ReaderNavigation';
import { ReaderSystemFileOpenNavigationHost, type SystemFileOpenNavigationView,
  type SystemFileOpenReaderIdentity } from '../navigation/ReaderSystemFileOpenNavigationHost';
import type { SharedDownloadOpeningIntent } from '../../features/downloads/presentation/SharedDownloadUiContract';
import type { ReadingBookDetail } from '../../features/reading/presentation/ReadingBookDetail';
import type { ReaderExitRequest, ReadingEntryPresentation } from '../../features/reading/presentation/ReadingEntryPresentation';

export interface ReaderExitActionPorts {
  entry: () => ReadingEntryPresentation;
  runtime: () => ReaderRuntimeOwner | undefined;
  mounting: () => number;
  foreground: () => boolean;
  captureReturn: () => ReaderReturnContext | undefined;
  switchBlocked: (book: ReadingBookDetail) => boolean;
  fileOpenBlocked: () => boolean;
  advance: (preserveShelfMotion?: boolean) => void;
  publish: (snapshot: ReaderNavigationSnapshot) => void;
  bindReader: () => void;
  hydrateMangaPosition: (book: ReadingBookDetail) => void;
  refreshDetail: () => void;
  refreshShelf: () => void;
  resumeReturnMotion: (coveredMotionId: number) => void;
  returnToBookshelf: () => void;
  returnFromDetail: () => void;
  returnToReadingOrigin: (animate?: boolean) => void;
  showDownloads: (intent: SharedDownloadOpeningIntent) => void;
  showRules: () => void;
  unavailableDownloads: () => void;
  prepareFileOpen: () => void;
  openShelfBook: (book: ShelfBook) => void;
  resolveFileReaderTransaction: (book: SystemFileOpenReaderIdentity) => Promise<void>;
  fileNotice: (message: string, current: () => boolean) => void;
}

interface PendingReaderBack {
  owner: ReaderRuntimeOwner;
  mounting: number;
  identity: string;
  navigation: ReaderNavigationSnapshot;
}

/** Relays the reader's saved exit to the navigation owner and the system-file queue consumer. */
export class ReaderExitActions {
  private systemFile: ReaderSystemFileOpenNavigationHost | undefined;
  private pendingBack: PendingReaderBack | undefined;

  private readonly navigation: ReaderNavigation;
  private readonly ports: ReaderExitActionPorts;
  constructor(navigation: ReaderNavigation, ports: ReaderExitActionPorts) {
    this.navigation = navigation;
    this.ports = ports;
  }

  attach(request: ReaderExitRequest, identity: string, surfaceCurrent: () => boolean,
    mangaGeneration?: number): (() => void) | undefined {
    const owner = this.ports.runtime(), mounting = this.ports.mounting();
    if (owner === undefined) return undefined;
    const release = this.ports.entry().attachSurfaceExitRequest(request, identity, (): boolean =>
      this.ports.runtime() === owner && this.ports.mounting() === mounting && surfaceCurrent(), mangaGeneration);
    if (release !== undefined) {
      // The exit callback may be registered before the reader creates its controller.
      this.navigationSettled();
      this.deliverPendingBack(request);
    }
    return release;
  }

  requestExit(): void {
    const entry = this.ports.entry(), request = entry.currentExitRequest();
    this.pendingBack = undefined;
    if (request !== undefined) { request(); return; }
    if (entry.sessionActive) {
      const owner = this.ports.runtime();
      if (owner !== undefined) {
        this.pendingBack = { owner, mounting: this.ports.mounting(), identity: entry.readerPresentationIdentity(),
          navigation: this.navigation.snapshot() };
      }
      return;
    }
    this.ports.returnToReadingOrigin();
  }

  private deliverPendingBack(request: ReaderExitRequest): void {
    const pending = this.pendingBack;
    if (pending === undefined) return;
    // The surface can register during aboutToAppear before its own setup ends.
    void Promise.resolve().then((): void => {
      if (this.pendingBack !== pending) return;
      const entry = this.ports.entry(), navigation = this.navigation.snapshot();
      if (this.ports.runtime() !== pending.owner || this.ports.mounting() !== pending.mounting ||
        navigation.generation !== pending.navigation.generation || navigation.route !== pending.navigation.route ||
        !entry.sessionActive || entry.readerPresentationIdentity() !== pending.identity) {
        this.pendingBack = undefined;
        return;
      }
      if (entry.currentExitRequest() !== request) return;
      this.pendingBack = undefined;
      if (this.systemFile?.hasPendingExit() !== true) request();
    }).catch((): void => {
      // A deferred Back cannot substitute navigation for the surface's exit.
    });
  }

  cancelShelfPreparation(): void {
    const entry = this.ports.entry();
    if (entry.book !== undefined && this.ports.switchBlocked(entry.book)) return;
    this.ports.advance();
    const exit = entry.currentExitLease();
    if (exit !== undefined) this.navigation.returns.requestParentAfterExit(exit, 'bookshelfPreparation');
    else this.ports.returnToBookshelf();
  }

  requestMangaShelfMutation(afterOpen: () => void): void {
    if (this.ports.entry().contentKind !== 'manga') return;
    this.requestBookInfo(afterOpen);
  }

  requestBookInfo(afterOpen?: () => void): void {
    const entry = this.ports.entry();
    const book = entry.book, exit = entry.currentExitLease();
    if (book === undefined || exit === undefined) return;
    const context = this.ports.captureReturn();
    if (context !== undefined)
      this.navigation.returns.requestBookInfoAfterExit(exit, `${book.sourceId}\u0000${book.bookId}`, context, afterOpen);
  }

  requestRules(): void {
    const entry = this.ports.entry();
    if (entry.book === undefined) return;
    const exit = entry.currentExitLease();
    if (exit !== undefined) this.navigation.returns.requestRulesAfterExit(exit);
  }

  requestDownloads(book: ShelfBook | undefined, detailKey: string): void {
    if (book === undefined || this.ports.runtime() === undefined) return;
    const entry = this.ports.entry();
    if (!entry.sessionActive) {
      this.ports.showDownloads({ kind: 'fresh', detailKey });
      return;
    }
    const exit = entry.currentExitLease();
    if (exit === undefined) { this.ports.unavailableDownloads(); return; }
    this.navigation.returns.requestDownloadsAfterExit(book, this.ports.captureReturn(), exit, detailKey);
  }

  cancel(identity: string): void {
    const entry = this.ports.entry();
    if (!entry.sessionActive || this.ports.runtime() === undefined || identity !== entry.readerPresentationIdentity()) return;
    if (this.pendingBack?.identity === identity) this.pendingBack = undefined;
    this.systemFile?.cancelExit(identity);
    this.navigation.returns.cancelReaderExit();
  }

  accepted(identity: string): void {
    const owner = this.ports.runtime(), entry = this.ports.entry();
    if (owner === undefined || !entry.acceptReaderExit(owner, identity)) return;
    if (this.pendingBack?.identity === identity) this.pendingBack = undefined;
    const book = entry.book;
    const bookIdentity = book === undefined ? undefined : `${book.sourceId}\u0000${book.bookId}`;
    this.navigation.returns.dispatchAcceptedReaderExit(identity, bookIdentity, owner, {
      claimSystemFileExit: (): boolean => this.systemFile?.readerExited(identity) === true,
      deliverSystemFile: (): void => { this.ports.returnToBookshelf(); this.navigationSettled(); },
      openDownloads: (intent: SharedDownloadOpeningIntent): void => {
        entry.endReading();
        this.ports.showDownloads(intent);
      },
      // Book information reuses the admitted book and catalog after the exit.
      showReaderDetail: (): void => this.ports.returnToReadingOrigin(false),
      afterReaderDetail: (contextOwner: ReaderRuntimeOwner, action: () => void): void => {
        if (this.navigation.snapshot().route === 'detail' && !entry.sessionActive && book !== undefined &&
          book.sourceId === entry.book?.sourceId && book.bookId === entry.book?.bookId &&
          this.ports.runtime() === contextOwner) action();
      },
      openRules: this.ports.showRules,
      returnFromDetail: this.ports.returnFromDetail,
      returnFromBookshelfPreparation: (): void => { this.ports.returnToBookshelf(); this.navigationSettled(); },
      returnToReadingOrigin: (): void => this.ports.returnToReadingOrigin(),
    });
  }

  completeReturn(coveredMotionId: number = -1): void {
    const entry = this.ports.entry();
    if (entry.book === undefined) {
      this.ports.returnToBookshelf();
      this.navigationSettled();
      return;
    }
    // The reader has already approved the exit. Keep the admitted book for its origin.
    this.ports.advance(coveredMotionId >= 0);
    entry.finishReading(this.ports.runtime());
    this.ports.publish(this.navigation.showReadingOrigin());
    this.ports.bindReader();
    const book = entry.book;
    if (book?.contentKind === 'manga') this.ports.hydrateMangaPosition(book);
    this.ports.refreshDetail();
    if (this.navigation.snapshot().route === 'bookshelf') this.ports.refreshShelf();
    this.ports.resumeReturnMotion(coveredMotionId);
    this.navigationSettled();
  }

  mountSystemFile(owner: ReaderRuntimeOwner): void {
    this.dispose();
    const mounting = this.ports.mounting();
    const current = (): boolean => this.systemFile === host &&
      this.ports.mounting() === mounting && this.ports.runtime() === owner;
    const host = new ReaderSystemFileOpenNavigationHost(owner, {
      isCurrent: current,
      view: (): SystemFileOpenNavigationView => this.systemFileView(),
      resolveReaderTransaction: this.ports.resolveFileReaderTransaction,
      notice: (message: string): void => this.ports.fileNotice(message, current),
      open: (book: ShelfBook): boolean => this.openSystemFile(book),
    });
    this.systemFile = host;
    host.mount();
  }

  consumeSystemFile(): void { this.systemFile?.consume(); }

  navigationSettled(): void { this.systemFile?.navigationSettled(); }

  dispose(): void {
    this.pendingBack = undefined;
    this.systemFile?.dispose();
    this.systemFile = undefined;
  }

  private systemFileView(): SystemFileOpenNavigationView {
    const entry = this.ports.entry(), book = entry.book;
    return { foreground: this.ports.foreground(), reading: entry.sessionActive,
      navigationGeneration: this.navigation.snapshot().generation, readerIdentity: entry.readerPresentationIdentity(),
      book: book === undefined ? undefined : { sourceId: book.sourceId, bookId: book.bookId },
      switchBlocked: book !== undefined && this.ports.switchBlocked(book),
      openBlocked: this.ports.fileOpenBlocked(), requestExit: entry.currentExitRequest() };
  }

  private openSystemFile(book: ShelfBook): boolean {
    const owner = this.ports.runtime();
    const entry = this.ports.entry();
    if (owner === undefined || !this.ports.foreground() || entry.sessionActive || this.ports.fileOpenBlocked()) return false;
    this.ports.prepareFileOpen();
    if (this.navigation.snapshot().route !== 'bookshelf') this.ports.returnToBookshelf();
    if (this.ports.runtime() !== owner || !this.ports.foreground() || this.navigation.snapshot().route !== 'bookshelf' ||
      entry.sessionActive || this.ports.fileOpenBlocked()) return false;
    this.ports.openShelfBook(book);
    return this.ports.runtime() === owner && this.navigation.snapshot().route === 'reading' && entry.sessionActive &&
      entry.book?.sourceId === book.sourceId && entry.book?.bookId === book.bookId;
  }
}
