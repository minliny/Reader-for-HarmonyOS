import { hilog } from '@kit.PerformanceAnalysisKit';
import type { ShelfBook } from '../ReaderCoreGateway';
import type { ReaderRuntimeOwner } from '../ReaderRuntimeOwner';
import type { DirectoryReturnTarget, ReaderNavigation, ReaderNavigationSnapshot } from '../navigation/ReaderNavigation';
import type { LocalReadingTocEntry } from '../../features/reading/application/LocalReadingFlowGateway';
import type { ReaderDirectoryOperation } from '../../features/reading/application/ReaderDirectoryHost';
import type { ReaderDirectoryTargetProof } from '../../features/reading/application/ReaderDirectoryTargetProof';
import type { ReadingBookDetail } from '../../features/reading/presentation/ReadingBookDetail';
import type { ReadingOfflineOperation } from '../../features/reading/application/ReadingOfflineHost';
import { ReaderDirectoryOperations, type ReaderDirectoryDiagnostic, type ReaderDirectoryScene } from '../../features/reading/presentation/ReaderDirectoryOperations';
import type { ReadingDirectoryNavigationPorts, ReadingEntryPresentation } from '../../features/reading/presentation/ReadingEntryPresentation';

const DOMAIN = 0x5244;

export interface ReaderDirectoryJourneyScope {
  owner?: ReaderRuntimeOwner;
  mount: number;
  retired: boolean;
  foreground: boolean;
  covered: boolean;
}

export interface ReaderDirectoryJourneyPorts {
  scope: () => ReaderDirectoryJourneyScope;
  ownsRuntime: (owner: ReaderRuntimeOwner | undefined) => boolean;
  runtime: () => ReaderRuntimeOwner | undefined;
  entry: () => ReadingEntryPresentation;
  shelfBooks: () => ShelfBook[];
  removalPending: () => boolean;
  publish: (snapshot: ReaderNavigationSnapshot) => void;
  advance: () => void;
  openReading: (chapter: number, proof?: ReaderDirectoryTargetProof) => void;
  bindReader: () => void;
  requestExit: () => void;
  showDownloads: (key: string) => void;
  afterReaderExitInDetail: (action: () => void) => void;
  confirmOfflineClear: (title: string, message: string, accept: () => void, current: () => boolean) => void;
  feedback: (message: string) => void;
  bookmarkFeedback: (book: ReadingBookDetail, message: string) => void;
}

/** Connects directory destinations to the same reading entry and operation owners. */
export class ReaderDirectoryJourney {
  readonly operations: ReaderDirectoryOperations;
  private readonly navigation: ReaderNavigation;
  private readonly ports: ReaderDirectoryJourneyPorts;

  constructor(navigation: ReaderNavigation, ports: ReaderDirectoryJourneyPorts) {
    this.navigation = navigation;
    this.ports = ports;
    this.operations = new ReaderDirectoryOperations({
      scene: (): ReaderDirectoryScene => this.operationScene(),
      ownsRuntime: (owner): boolean => ports.ownsRuntime(owner as ReaderRuntimeOwner),
      currentEntries: (): LocalReadingTocEntry[] => ports.entry().toc,
      replaceEntries: (entries: LocalReadingTocEntry[]): void => ports.entry().replaceOwnedDirectoryEntries(entries, () => {
        const owner = ports.runtime();
        return owner === undefined ? undefined : ports.entry().currentHost(owner);
      }),
      publishBookmarks: (operation: ReaderDirectoryOperation | undefined): void => { ports.entry().directoryOperation = operation; },
      publishOffline: (operation: ReadingOfflineOperation | undefined, busy: boolean): void =>
        ports.entry().publishOfflineOperation(operation, busy),
      refreshMangaDirectory: (detailOnly: boolean): void => {
        const owner = ports.runtime();
        if (owner !== undefined) void ports.entry().currentHost(owner).refreshMangaDirectoryDisplay(true, detailOnly);
      },
      feedback: ports.feedback,
      openDownloadProgress: ports.showDownloads,
      canExitReader: (): boolean => ports.entry().currentExitRequest() !== undefined,
      afterReaderExitInDetail: ports.afterReaderExitInDetail,
      confirmOfflineClear: ports.confirmOfflineClear,
      diagnostic: logDirectoryOperation,
    });
  }

  private operationScene(): ReaderDirectoryScene {
    const scope = this.ports.scope(), route = this.navigation.snapshot();
    return this.ports.entry().directoryScene({ owner: scope.owner, route: route.route,
      retired: scope.retired, mount: scope.mount, navigation: route.generation,
      foreground: scope.foreground && !scope.covered });
  }

  navigationPorts(): ReadingDirectoryNavigationPorts {
    const showReader = (): void => this.ports.publish(this.navigation.show('reading'));
    return {
      openReading: this.ports.openReading,
      revealReading: showReader,
      changeChapter: (keepDirectoryUntilReady: boolean, beforePresent?: () => void, afterPresent?: () => void): void => {
        this.ports.advance();
        beforePresent?.();
        this.navigation.prepareReaderDestination('reading');
        if (!keepDirectoryUntilReady) showReader();
        afterPresent?.();
        this.ports.bindReader();
      },
      unresolvedBookmark: this.ports.bookmarkFeedback,
    };
  }

  open(target: DirectoryReturnTarget): void {
    if (target === 'detail' && this.ports.removalPending()) return;
    const entry = this.ports.entry();
    const next = this.navigation.openDirectory(target, (): boolean => entry.prepareDirectory(target === 'readerControl'));
    if (next === undefined) return;
    this.ports.publish(next);
    this.operations.loadDirectory();
    if (target !== 'detail') return;
    const bound = this.ports.scope();
    const current = (): boolean => {
      const scope = this.ports.scope(), route = this.navigation.snapshot();
      return scope.owner === bound.owner && this.ports.ownsRuntime(bound.owner) && !scope.retired && scope.mount === bound.mount &&
        route.generation === next.generation && route.route === 'directory' && route.directoryReturnTarget === 'detail';
    };
    entry.projectDetailDirectoryPosition(bound.owner, this.ports.shelfBooks(), current);
  }

  close(): void {
    const next = this.navigation.closeDirectory(this.ports.entry().sessionActive, this.ports.requestExit);
    if (next !== undefined) this.ports.publish(next);
  }

  isOpeningCurrent(opening: number, target: DirectoryReturnTarget): boolean {
    const scope = this.ports.scope();
    return scope.foreground && !scope.covered && !scope.retired && this.ports.ownsRuntime(scope.owner) &&
      this.matchesOpening(opening, target);
  }

  registerBack(target: DirectoryReturnTarget, opening: number, handler: (() => boolean) | undefined, identity: string): void {
    const owner = this.ports.scope().owner;
    if (!this.matchesOpening(opening, target) || owner === undefined || this.ports.runtime() !== owner) return;
    this.navigation.setTemporaryBack('directory', this.navigation.snapshot().generation, owner, handler, identity);
  }

  retryDetailCatalog(): void {
    const owner = this.ports.runtime(), entry = this.ports.entry();
    if (owner !== undefined && this.isOpeningCurrent(entry.directoryPresentationGeneration, 'detail')) entry.retryDirectoryCatalog(owner);
  }

  private matchesOpening(opening: number, target: DirectoryReturnTarget): boolean {
    const route = this.navigation.snapshot();
    return route.route === 'directory' && route.directoryReturnTarget === target &&
      this.ports.entry().directoryPresentationGeneration === opening;
  }
}

function logDirectoryOperation(kind: ReaderDirectoryDiagnostic, error: Error): void {
  if (kind === 'bookmarkDelivery') {
    try { hilog.error(DOMAIN, 'Reader', 'Directory delivery failed: %{private}s', error.message); } catch (_) {}
  } else if (kind === 'bookmarkOperation') hilog.error(DOMAIN, 'Reader', 'Bookmark operation/projection: %{private}s', error.message);
  else if (kind === 'offlineDelivery') hilog.warn(DOMAIN, 'Reader', 'Offline presentation delivery failed: %{private}s', error.message);
  else if (kind === 'sourceCleanup') hilog.warn(DOMAIN, 'Reader', 'Old source book cache cleanup failed: %{private}s', error.message);
  else hilog.error(DOMAIN, 'Reader', 'Offline operation/projection: %{private}s', error.message);
}
