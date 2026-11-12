import type { ReaderRuntimeOwner } from '../ReaderRuntimeOwner';
import { MangaSourceSwitchPresentation } from '../../features/manga/presentation/MangaSourceSwitchPresentation';
import { readerEntryPresentation, type ReaderRetainedPresentation } from '../../features/reading/ui/LocalReadingExperience';
import type { ReadingCommit } from '../../features/reading/application/ReadingCommit';
import type { LocalReadingTocEntry } from '../../features/reading/application/LocalReadingFlowGateway';
import type { ReaderPageBookmarkToggleRequest } from '../../features/reading/presentation/ReaderDirectoryMarkerState';
import type { RemoteReadingFailureKind } from '../../features/reading/application/RemoteContentAdmission';
import type { RemoteReadingSession } from '../../features/reading/application/RemoteReadingFlowGateway';
import { ReadingCommitPresentation } from '../../features/reading/presentation/ReadingCommitPresentation';
import { readerDirectoryActions, type ReaderDirectoryActions } from '../../features/reading/presentation/ReaderDirectoryActions';
import type { ReaderDirectoryOperations } from '../../features/reading/presentation/ReaderDirectoryOperations';
import { ReadingEntryPresentation, type ReaderExitRequest, type ReadingDirectoryNavigationPorts } from '../../features/reading/presentation/ReadingEntryPresentation';
import { ReaderShell } from '../../features/reading/ui/ReaderShell';
import { SourceSwitchPresentation } from '../../features/source/presentation/SourceSwitchPresentation';
import type { ReaderSourceSwitchActions } from './ReaderSourceSwitchActions';

export interface RetainedReaderScenePorts {
  runtime: () => ReaderRuntimeOwner | undefined;
  directory: ReaderDirectoryOperations;
  directoryNavigation: ReadingDirectoryNavigationPorts;
  toggleMangaShelf: () => void;
  loginMangaSource: () => Promise<void>;
  attachExit: (request: ReaderExitRequest, identity: string, current: () => boolean,
    mangaGeneration?: number) => (() => void) | undefined;
  exit: (identity: string) => void;
  cancelExit: (identity: string) => void;
  ready: (chapter: number, sourceId: string, bookId: string, generation: number) => void;
  sessionReady: (session: RemoteReadingSession, refreshDirectoryDisplay?: boolean) => void;
  resetFeedback: () => void;
  openBookInfo: () => void;
  openDownloads: () => void;
  isDirectoryOpeningCurrent: (opening: number) => boolean;
  directoryBack: (handler: (() => boolean) | undefined, identity: string, opening: number) => void;
  openDirectory: () => void;
  closeDirectory: () => void;
  openSourceSwitch: (focusId?: string) => void;
  sourceSwitch: ReaderSourceSwitchActions;
  resolveSourceSwitchTransaction: (sourceId: string, bookId: string) => Promise<string | undefined>;
}

/** Maps the admitted reading session onto the retained reader shell. */
@Component
export struct RetainedReaderScene {
  @ObjectLink reading: ReadingEntryPresentation;
  @ObjectLink commits: ReadingCommitPresentation;
  @ObjectLink source: SourceSwitchPresentation;
  @ObjectLink manga: MangaSourceSwitchPresentation;
  @Prop visibleRoute: 'reading' | 'directory' | undefined = undefined;
  @Prop reduceMotion: boolean = false;
  @Prop expandedLayout: boolean = false;
  @Prop transitionOpacity: number = 1;
  @Prop inputAllowed: boolean = true;
  ports: RetainedReaderScenePorts | undefined = undefined;
  private readonly directoryActions: ReaderDirectoryActions = readerDirectoryActions(() => this.reading,
    () => this.ports?.directoryNavigation, () => this.ports?.directory);

  build() {
    if (this.reading.sessionActive && this.reading.book !== undefined && this.ports !== undefined) {
      ReaderShell({
        contentKind: this.reading.contentKind, inBookshelf: this.reading.inBookshelf,
        bookId: this.reading.book.bookId, bookTitle: this.reading.book.title,
        bookAuthor: this.reading.book.author, bookCoverUrl: this.reading.book.coverUrl ?? this.reading.book.displayCoverUrl ?? '',
        latestChapterTitle: this.reading.book.lastChapter ?? '', sourceId: this.reading.book.sourceId,
        sourceName: this.reading.book.sourceName, bookKind: this.reading.book.kind,
        remoteSession: this.reading.session, remoteBookSeed: this.reading.seed,
        entryPresentationProvider: (): ReaderRetainedPresentation | undefined => this.reading.book === undefined ? undefined :
          readerEntryPresentation(this.reading.book.sourceId, this.reading.book.bookId),
        sourceSwitchFailureMessage: this.source.failureMessage, sourceSwitchScopeId: this.source.scopeId,
        sourceSwitchCompletion: this.commits.completion, sourceSwitchTransactionId: this.source.currentTransaction(this.reading.book),
        onRetryFailedSourceSwitch: this.ports.sourceSwitch.retryFailure, onDismissSourceSwitchFailure: this.ports.sourceSwitch.dismissFailure,
        resolveSourceSwitchTransactionId: this.ports.resolveSourceSwitchTransaction,
        onRemoteSessionReady: this.ports.sessionReady,
        totalChapters: this.reading.toc.length, requestedChapterIndex: this.reading.requestedChapterIndex,
        mangaChapterRequestGeneration: this.reading.mangaChapterRequestGeneration,
        mangaStartAtChapterFirst: this.reading.mangaStartsAtChapterBeginning(),
        requestedMangaDirectoryTargetProof: this.reading.requestedMangaDirectoryTargetProof,
        requestedMangaOfflineChapterId: this.reading.requestedMangaOfflineChapterId,
        requestedBookmarkAnchor: this.reading.requestedBookmarkAnchor, bookmarkIdentity: this.reading.bookmarkIdentity(),
        expandedLayout: this.expandedLayout, reduceMotion: this.reduceMotion,
        visible: this.visibleRoute !== undefined, route: this.visibleRoute ?? 'reading', inputAllowed: this.inputAllowed,
        tocEntries: this.reading.toc, catalogMessage: this.reading.loadingMessage, catalogBusy: this.reading.catalogBusy,
        bookmarkLoadMessage: this.ports.directory.bookmarkMessage(this.reading.directoryOperation),
        directoryCurrentChapterIndex: this.reading.directoryCurrentChapterIndex, directoryChapterTitle: this.reading.directoryChapterTitle,
        directoryCurrentPageOrdinal: this.reading.book.mangaPosition?.chapterIndex === this.reading.directoryCurrentChapterIndex ?
          this.reading.book.mangaPosition?.pageOrdinal ?? -1 : -1,
        directoryCurrentPageTotal: this.reading.book.mangaPosition?.chapterIndex === this.reading.directoryCurrentChapterIndex ?
          this.reading.book.mangaPosition?.totalPages ?? -1 : -1,
        offlineBookOperationActive: this.reading.offlineOperationActive,
        directoryRecovery: this.ports.directory.recovery(this.reading.directoryOperation, this.reading.offlineOperation),
        onReconcileBookmarks: this.directoryActions.reconcileBookmarks,
        onContinueBookmarks: this.directoryActions.continueBookmarks,
        onReconcileOffline: this.directoryActions.reconcileOffline,
        onContinueOffline: this.directoryActions.continueOffline,
        mangaDownloadEnabled: this.reading.contentKind === 'manga' && this.ports.runtime()?.supportsCoreCapability('manga.offline.v1') === true,
        onLoadMangaDownloadActions: this.directoryActions.loadMangaActions,
        onMangaDownloadAction: this.directoryActions.performMangaAction,
        chapterStartBookmarkCreationEnabled: true,
        sourceSwitchVisible: this.source.visible, sourceSwitchPresented: this.source.isSurfacePresented(),
        sourceSwitchSurface: this.source, sourceSwitchCovered: this.manga.selectionVisible, sourceSwitchState: this.source.state,
        allowCancelSourceSwitchWhilePreparing: this.manga.canCancelPreparation() ||
          this.source.host()?.canCancelPreparation(this.source.scopeId) === true,
        onExitRequestHandler: this.ports.attachExit, onExit: this.ports.exit, onExitCancelled: this.ports.cancelExit,
        onOpenBookInfo: this.ports.openBookInfo, onOpenDownloads: this.ports.openDownloads,
        onToggleShelf: this.ports.toggleMangaShelf, onMangaLogin: this.ports.loginMangaSource,
        readingReadyGeneration: this.reading.readyGeneration, onReadingReady: this.ports.ready,
        onReadingCommitted: (commit: ReadingCommit): void => this.commits.accept(commit),
        onReadingFailure: (sourceId: string, bookId: string, message: string, kind?: RemoteReadingFailureKind): void => {
          if (this.ports?.runtime() !== undefined) this.reading.projectReaderFailure(sourceId, bookId, message, kind);
        },
        onChapterCommitted: (chapter: number, title: string): void => {
          const ports = this.ports, owner = ports?.runtime();
          if (ports !== undefined && owner !== undefined) this.reading.commitDirectoryChapter(owner, chapter, title, ports.resetFeedback);
        },
        onAdjacentChapterCommitted: (chapter: number, title: string): void => {
          const ports = this.ports, owner = ports?.runtime();
          if (ports !== undefined && owner !== undefined) this.reading.commitMangaAdjacentChapter(owner, chapter, title, ports.resetFeedback);
        },
        onSelectChapter: this.directoryActions.selectChapter,
        onSelectNavigationTarget: this.directoryActions.selectTarget,
        onSelectBookmark: this.directoryActions.selectBookmark,
        onDownloadChapter: this.directoryActions.downloadChapter,
        onDownloadBook: this.directoryActions.downloadBook,
        onClearBookOffline: this.directoryActions.clearBookOffline,
        onDeleteBookmarks: this.directoryActions.deleteBookmarks,
        onDirectoryProjectionChanged: (entries: LocalReadingTocEntry[], readerIdentity: string): void => {
          const owner = this.ports?.runtime();
          if (owner !== undefined && this.reading.sessionActive && readerIdentity === this.reading.readerPresentationIdentity()) {
            this.reading.applyDirectoryProjection(entries, owner);
          }
        },
        onLoadControlBookmarks: (sourceId: string, bookId: string, current: () => boolean): Promise<void> =>
          this.ports?.directory.loadControlBookmarks(sourceId, bookId, current) ?? Promise.reject(new Error('Bookmark projection loader unavailable')),
        onCreateChapterStartBookmark: this.directoryActions.createChapterStart,
        onTogglePageBookmark: (request: ReaderPageBookmarkToggleRequest): void => this.ports?.directory.togglePageBookmark(request),
        directoryOpening: this.reading.directoryPresentationGeneration,
        isDirectoryOpeningCurrent: this.ports.isDirectoryOpeningCurrent, onDirectoryBackBridge: this.ports.directoryBack,
        onCloseDirectory: this.ports.closeDirectory, onOpenDirectory: this.ports.openDirectory,
        onSwitchSource: this.ports.openSourceSwitch,
        onCloseSourceSwitch: this.ports.sourceSwitch.close, onRetrySourceSwitch: this.ports.sourceSwitch.retry,
        onRefreshSourceSwitch: this.ports.sourceSwitch.refresh, onStopSourceSwitch: this.ports.sourceSwitch.stop,
        onPickSource: this.ports.sourceSwitch.select, onRollbackSourceSwitch: this.ports.sourceSwitch.rollback,
      }).clip(true).opacity(this.transitionOpacity).enabled(this.inputAllowed)
        .accessibilityLevel(this.inputAllowed ? 'auto' : 'no-hide-descendants');
    }
  }
}
