import { sourceSwitchTriggerFocusId } from '../../source/presentation/SourceSwitchSurfaceLifecycle';
import type { SourceSwitchPresentation } from '../../source/presentation/SourceSwitchPresentation';
import type { ReaderExitRequest } from '../presentation/ReadingEntryPresentation';
import type { ReaderDirectoryTargetProof } from '../application/ReaderDirectoryTargetProof';
import { ReaderPageScaffold } from '../../../ui/layout/ReaderPageScaffold';
import { readerEmptyPageGeometry } from '../../../ui/layout/ReaderPageGeometry';
import type { SourceSwitchCompletionPresentation } from '../../source/presentation/SourceSwitchCompletionPresentation';
import { EMPTY_READING_DIRECTORY_RECOVERY, type ReadingDirectoryRecovery } from '../presentation/ReadingDirectoryRecovery';
import { ReaderSettingsGateway } from '../application/ReaderSettingsGateway';
import { ReaderRuntimeOwner } from '../../../app/ReaderRuntimeOwner';
import { MangaReadingSurface } from '../../manga/ui/MangaReadingSurface';
import type { ActionSheetSpecId } from '../../../ui/surfaces/ReaderSurfaceSpecs';
import type { MangaDownloadAction, MangaDownloadActionId } from '../../manga/application/MangaDownloadActionsGateway';
import type { RemoteReadingPositionScope } from '../application/RemoteReadingPositionMigration';
import { readerAppColor } from '../../../ui/foundation/ReaderThemeRegistry';
import { ReaderFrameStyle, readerFrameStyle } from '../../../ui/layout/ReaderFrameStyle';
import { ReaderWindowCoordinator } from '../../../app/ReaderWindowCoordinator';
import type { ReaderWindowMetricsSnapshot } from '../../../ui/foundation/ReaderWindowMetrics';
import { ReadingExperience, ReaderRetainedPresentation } from './LocalReadingExperience';
import type { ReadingCommit } from '../application/ReadingCommit';
import type { ReaderBookmarkAnchorRequest } from '../presentation/ReaderBookmarkAnchorRequest';
import { ReaderDirectoryDestination } from './ReaderDirectoryDestination';
import { SourceSwitchPanel } from '../../source/ui/SourceSwitchPanel';
import type { SourceSwitchPanelState } from '../../source/presentation/SourceSwitchPresentationState';
import type { SourceSwitchCandidate } from '../../source/application/SourceSwitchGateway';
import type { LocalReadingTocEntry } from '../application/LocalReadingFlowGateway';
import type {
  ReaderDirectoryChapterStartBookmarkRequest,
  ReaderPageBookmarkToggleRequest,
} from '../presentation/ReaderDirectoryMarkerState';
import type { ReaderBookIdentity } from '../presentation/ReaderBookmarkProjection';
import type { RemoteReadingBookSeed, RemoteReadingSession } from '../application/RemoteReadingFlowGateway';
import type { RemoteReadingFailureKind } from '../application/RemoteContentAdmission';
import { ReaderStatusBarPaper } from './ReaderStatusBarPaper';
import { readerWidthClassWithHint } from '../../../ui/foundation/ReaderWidthClass';


// RetainedReaderScene supplies the admitted session and navigation intents.
// The shell keeps the reading surface mounted under the directory and source
// picker and uses the same window coordinator for their edge-to-edge frame.
type PreparedReaderRoute = 'reading' | 'directory';

@Component
export struct ReaderShell {
  private readonly mangaSettingsGateway: ReaderSettingsGateway = new ReaderSettingsGateway(ReaderRuntimeOwner.current());
  @StorageLink('readerWindowChromeUnderlayColor') private chromeUnderlayColor: string =
    readerAppColor('app.window.background', 'day');
  @StorageLink('readerWindowChromeThemeId') private chromePaperThemeId: string = '';
  @StorageLink('readerWindowMetricsRevision') private windowMetricsRevision: number = 0;

  // 阅读内容。
  @Prop bookId: string = '';
  @Prop readingReadyGeneration: number = 0;
  @Prop bookTitle: string = '';
  @Prop sourceId: string = '';
  @Prop sourceName: string = '';
  @Prop bookKind: string | undefined = undefined;
  // Explicit Core content fact; never infer this from the free-form genre.
  @Prop contentKind: 'text' | 'manga' = 'text';
  @Prop inBookshelf: boolean = true;
  @Prop bookAuthor: string = '';
  @Prop bookCoverUrl: string = '';
  @Prop latestChapterTitle: string = '';
  onToggleShelf: () => void = (): void => {};
  onStopSourceSwitch: (scopeId?: number) => void = (): void => {};
  @Prop remoteSession: RemoteReadingSession | undefined = undefined;
  @Prop remoteBookSeed: RemoteReadingBookSeed | undefined = undefined;
  entryPresentationProvider: () => ReaderRetainedPresentation | undefined = (): ReaderRetainedPresentation | undefined => undefined;
  @Prop sourceSwitchFailureMessage: string = '';
  @Prop sourceSwitchScopeId: number = 0;
  @Prop sourceSwitchTransactionId: string | undefined = undefined;
  @Prop sourceSwitchCompletion: SourceSwitchCompletionPresentation | undefined = undefined;
  @Prop totalChapters: number = 0;
  @Prop requestedChapterIndex: number | undefined = undefined;
  @Prop mangaChapterRequestGeneration: number = 0;
  @Prop mangaStartAtChapterFirst: boolean = false;
  @Prop requestedMangaDirectoryTargetProof: ReaderDirectoryTargetProof | undefined = undefined;
  @Prop requestedMangaOfflineChapterId: string | undefined = undefined;
  @Prop expandedLayout: boolean = false;
  @Prop reduceMotion: boolean = false;
  // 阅读会话可见性: route 决定 ReadingExperience 是否露出版面。
  @Prop visible: boolean = false;
  @Prop route: PreparedReaderRoute = 'reading';
  @Prop inputAllowed: boolean = true;
  // 目录 overlay。
  @Prop tocEntries: LocalReadingTocEntry[] = [];
  @Prop catalogMessage: string = '';
  @Prop catalogBusy: boolean = false;
  @Prop directoryRecovery: ReadingDirectoryRecovery = EMPTY_READING_DIRECTORY_RECOVERY;
  onReconcileBookmarks: (generation: number, identity: string) => void = (): void => {};
  onContinueBookmarks: (generation: number, identity: string) => void = (): void => {};
  onReconcileOffline: (generation: number, identity: string) => void = (): void => {};
  onContinueOffline: (generation: number, identity: string) => void = (): void => {};

  @Prop bookmarkLoadMessage: string = '';
  @Prop directoryCurrentChapterIndex: number = -1;
  @Prop directoryCurrentPageOrdinal: number = -1;
  @Prop directoryCurrentPageTotal: number = -1;
  @Prop directoryChapterTitle: string = '';
  @Prop directoryOpening: number = 0;
  isDirectoryOpeningCurrent: (opening: number) => boolean = (_opening: number): boolean => true;
  @Prop offlineBookOperationActive: boolean = false;
  @Prop mangaDownloadEnabled: boolean = false;
  /** Explicit layout variant for the shared manga More action sheet. */
  @Prop mangaMoreMenuVariant: ActionSheetSpecId = 'grouped';
  onLoadMangaDownloadActions: (chapterIndex?: number) => Promise<MangaDownloadAction[]> = async (): Promise<MangaDownloadAction[]> => [];
  onMangaDownloadAction: (action: MangaDownloadActionId, chapterIndex?: number) => Promise<void> = async (): Promise<void> => {};
  @Prop chapterStartBookmarkCreationEnabled: boolean = false;
  // 书签 tab 精确锚点接线: requestedBookmarkAnchor 经 @Prop @Watch 触发阅读会话
  // 的精确 (章节, Unicode 标量偏移) 跳转; bookmarkIdentity 是会话期静态书籍身份,
  // 用于稳定书签 id。两者 undefined 时书签 tab 保留面板自身的章首降级。
  @Prop requestedBookmarkAnchor: ReaderBookmarkAnchorRequest | undefined = undefined;
  @Prop bookmarkIdentity: ReaderBookIdentity | undefined = undefined;
  // 换源 overlay。
  @Prop sourceSwitchVisible: boolean = false;
  @Prop sourceSwitchPresented: boolean = false;
  sourceSwitchSurface: SourceSwitchPresentation | undefined = undefined;
  @Prop sourceSwitchCovered: boolean = false;
  @Prop allowCancelSourceSwitchWhilePreparing: boolean = false;
  @Prop sourceSwitchState: SourceSwitchPanelState = { kind: 'discovering' };

  // Events supplied by the retained scene and forwarded to the owning feature.
  onExitRequestHandler: (requestExit: ReaderExitRequest, readerIdentity: string,
    surfaceCurrent: () => boolean, mangaGeneration?: number) => (() => void) | undefined = () => undefined;
  onExit: (readerIdentity: string) => void = (_readerIdentity: string): void => {};
  onExitCancelled: (readerIdentity: string) => void = (_readerIdentity: string): void => {};
  onReadingReady: (chapterIndex: number, sourceId: string, bookId: string, generation: number) => void =
    (_chapterIndex: number, _sourceId: string, _bookId: string, _generation: number): void => {};
  onRemoteSessionReady: (session: RemoteReadingSession, refreshDirectoryDisplay?: boolean) => void = (_session: RemoteReadingSession): void => {};
  onRetryFailedSourceSwitch: (scopeId?: number) => void = (): void => {};
  onDismissSourceSwitchFailure: (scopeId?: number) => void = (): void => {};
  resolveSourceSwitchTransactionId: (sourceId: string, bookId: string) => Promise<string | undefined> =
    (_sourceId: string, _bookId: string): Promise<string | undefined> => Promise.resolve(undefined);
  onReadingCommitted: (commit: ReadingCommit) => void = (_commit: ReadingCommit): void => {};
  onReadingFailure: (sourceId: string, bookId: string, message: string,
    failureKind?: RemoteReadingFailureKind) => void =
    (_sourceId: string, _bookId: string, _message: string,
      _failureKind?: RemoteReadingFailureKind): void => {};
  onChapterCommitted: (chapterIndex: number, chapterTitle: string) => void =
    (_chapterIndex: number, _chapterTitle: string): void => {};
  onSelectChapter: (chapterIndex: number) => void = (_chapterIndex: number): void => {};
  onAdjacentChapterCommitted: (chapterIndex: number, chapterTitle: string) => void = (): void => {};
  onSelectNavigationTarget: (chapterIndex: number, chapterOffsetScalar: number, positionScope?: RemoteReadingPositionScope, directoryTargetProof?: ReaderDirectoryTargetProof) => void =
    (_chapterIndex: number, _chapterOffsetScalar: number, _positionScope?: RemoteReadingPositionScope, _directoryTargetProof?: ReaderDirectoryTargetProof): void => {};
  // undefined = 未接线, 面板走自身的章首降级链 (selectBookmark 降级)。
  onSelectBookmark: ((bookmarkId: string, chapterIndex: number, chapterOffset: number, positionScope?: RemoteReadingPositionScope) => void) | undefined =
    undefined;
  onDownloadChapter: (chapterIndex: number) => void = (_chapterIndex: number): void => {};
  onDownloadBook: () => void = (): void => {};
  onOpenDownloads: () => void = (): void => {};
  onClearBookOffline: () => void = (): void => {};
  onDeleteBookmarks: (bookmarkTimes: number[]) => void = (_bookmarkTimes: number[]): void => {};
  onDirectoryProjectionChanged: (entries: LocalReadingTocEntry[], readerIdentity: string) => void =
    (_entries: LocalReadingTocEntry[], _readerIdentity: string): void => {};
  onLoadControlBookmarks: (sourceId: string, bookId: string, isCurrent: () => boolean) => Promise<void> =
    (_sourceId: string, _bookId: string, _isCurrent: () => boolean): Promise<void> =>
      Promise.reject(new Error('Bookmark projection loader unavailable'));
  onCreateChapterStartBookmark: (request: ReaderDirectoryChapterStartBookmarkRequest) => void =
    (_request: ReaderDirectoryChapterStartBookmarkRequest): void => {};
  onTogglePageBookmark: (request: ReaderPageBookmarkToggleRequest) => void =
    (_request: ReaderPageBookmarkToggleRequest): void => {};
  onCloseDirectory: () => void = (): void => {};
  onDirectoryBackBridge: (handler: (() => boolean) | undefined, identity: string, opening: number) => void = (): void => {};
  onOpenDirectory: () => void = (): void => {};
  onOpenBookInfo: () => void = (): void => {};
  onSwitchSource: (focusId?: string) => void = (): void => {};
  onMangaLogin: () => Promise<void> = (): Promise<void> => Promise.reject(new Error('MANGA_SOURCE_LOGIN_UNAVAILABLE'));
  onCloseSourceSwitch: (scopeId?: number) => void = (): void => {};
  onRetrySourceSwitch: (scopeId?: number) => void = (): void => {};
  onRefreshSourceSwitch: (scopeId?: number) => void = (): void => {};
  onPickSource: (candidate: SourceSwitchCandidate, scopeId?: number) => void = (_candidate: SourceSwitchCandidate): void => {};
  onRollbackSourceSwitch: (scopeId?: number) => void = (): void => {};

  private frameStyle(): ReaderFrameStyle {
    return readerFrameStyle({ backgroundColor: this.chromeUnderlayColor, clip: false,
      alignment: 'topStart', safeArea: this.contentKind === 'manga' ? 'systemCutoutAll' : 'systemVertical',
      headerBackground: this.chromeUnderlayColor, headerTransparent: true,
      footerBackground: this.chromeUnderlayColor });
  }

  build() {
    ReaderPageScaffold({ frameStyle: this.frameStyle(), pageVisible: this.visible,
      geometry: readerEmptyPageGeometry(),
      content: (): void => { this.readingContent(); },
      overlayContent: (): void => { this.readingOverlay(); },
    });
  }

  private readingContentIsForeground(): boolean {
    return this.inputAllowed && this.visible && this.route === 'reading' &&
      !this.sourceSwitchPresented && !this.sourceSwitchCovered;
  }

  private acceptsTextInput(identity: string): boolean {
    return this.contentKind === 'text' && identity === this.readingIdentityKey() && this.readingContentIsForeground();
  }

  @Builder
  private readingContent() {
      // This stable nested layer prevents the reader component from being
      // remounted when sibling overlays appear.  Opacity 0 still receives the
      // true viewport/layout pass; `Visibility` would make the TextController
      // metrics unavailable.
      Stack({ alignContent: Alignment.TopStart }) {
        // A new source/book needs fresh gateways and lifecycle tokens. Theme,
        // font, chapter and overlay changes retain this same reading owner.
        if (this.contentKind === 'manga') {
          this.mangaSurface()
        } else {
        ForEach([this.readingIdentityKey()], (_identity: string) => {
        ReadingExperience({
          sourceId: this.sourceId,
          bookId: this.bookId,
          isReaderIdentityCurrent: (): boolean => _identity === this.readingIdentityKey(),
          bookKind: this.bookKind,
          remoteSession: this.remoteSession,
          remoteBookSeed: this.remoteBookSeed,
          entryPresentationProvider: (): ReaderRetainedPresentation | undefined =>
            _identity === this.readingIdentityKey() ? this.entryPresentationProvider() : undefined,
          sourceSwitchFailureMessage: this.sourceSwitchFailureMessage,
          sourceSwitchScopeId: this.sourceSwitchScopeId,
          onRetryFailedSourceSwitch: (scopeId?: number): void => {
            if (this.acceptsTextInput(_identity)) this.onRetryFailedSourceSwitch(scopeId);
          },
          onDismissSourceSwitchFailure: (scopeId?: number): void => {
            if (this.acceptsTextInput(_identity)) this.onDismissSourceSwitchFailure(scopeId);
          },
          resolveSourceSwitchTransactionId: (sourceId: string, bookId: string): Promise<string | undefined> =>
            _identity === this.readingIdentityKey() ?
              this.resolveSourceSwitchTransactionId(sourceId, bookId) : Promise.resolve(undefined),
          onRemoteSessionReady: (session: RemoteReadingSession): void => {
            if (_identity === this.readingIdentityKey()) this.onRemoteSessionReady(session);
          },
          sourceSwitchTransactionId: this.sourceSwitchTransactionId,
          sourceSwitchCompletion: this.sourceSwitchCompletion,
          readingReadyGeneration: this.readingReadyGeneration,
          sourceSwitchCompletionVisible: this.readingContentIsForeground(),
          sourceSwitchPresentationVisible: this.sourceSwitchPresented,
          requestedChapterIndex: this.requestedChapterIndex,
          requestedBookmarkAnchor: this.requestedBookmarkAnchor,
          bookmarkIdentity: this.bookmarkIdentity,
          expandedLayout: this.expandedLayout,
          windowChromeActive: this.visible,
          windowChromeOverlayActive: this.visible &&
            (this.route === 'directory' || this.sourceSwitchPresented),
          bookTitle: this.bookTitle,
          sourceName: this.sourceName,
          totalChapters: this.totalChapters,
          directoryEntries: this.tocEntries,
          bookmarkLoadMessage: this.bookmarkLoadMessage,
          bookmarkRecovery: this.directoryRecovery,
          onReconcileBookmarks: (generation: number, presentationId: string): void => {
            if (this.acceptsTextInput(_identity)) this.onReconcileBookmarks(generation, presentationId);
          },
          onContinueBookmarks: (generation: number, presentationId: string): void => {
            if (this.acceptsTextInput(_identity)) this.onContinueBookmarks(generation, presentationId);
          },
          controlObscured: this.route === 'directory',
          interactionBlocked: !this.readingContentIsForeground(),
          reduceMotion: this.reduceMotion,
          onExitRequestHandler: (requestExit: ReaderExitRequest): (() => void) | undefined => {
            if (_identity !== this.readingIdentityKey()) return undefined;
            return this.onExitRequestHandler(requestExit, _identity, (): boolean => _identity === this.readingIdentityKey());
          },
          onExit: (): void => {
            if (_identity === this.readingIdentityKey()) this.onExit(_identity);
          },
          onExitCancelled: (): void => {
            if (_identity === this.readingIdentityKey()) this.onExitCancelled(_identity);
          },
          onReadingReady: (chapterIndex: number): void => {
            if (_identity === this.readingIdentityKey())
              this.onReadingReady(chapterIndex, this.sourceId, this.bookId, this.readingReadyGeneration);
          },
          onReadingCommitted: (commit: ReadingCommit): void => {
            if (_identity === this.readingIdentityKey()) this.onReadingCommitted(commit);
          },
          onReadingFailure: (sourceId: string, bookId: string, message: string,
            failureKind?: RemoteReadingFailureKind): void => {
            if (_identity === this.readingIdentityKey()) this.onReadingFailure(sourceId, bookId, message, failureKind);
          },
          onChapterCommitted: (chapterIndex: number, chapterTitle: string): void => {
            if (_identity === this.readingIdentityKey()) this.onChapterCommitted(chapterIndex, chapterTitle);
          },
          onOpenBookInfo: (): void => {
            if (this.acceptsTextInput(_identity)) this.onOpenBookInfo();
          },
          onSwitchSource: (focusId?: string): void => {
            if (this.acceptsTextInput(_identity)) this.onSwitchSource(focusId);
          },
          onDownloadChapter: (chapterIndex: number): void => {
            if (this.acceptsTextInput(_identity)) this.onDownloadChapter(chapterIndex);
          },
          offlineBookOperationActive: this.offlineBookOperationActive,
          onDownloadBook: (): void => {
            if (this.acceptsTextInput(_identity)) this.onDownloadBook();
          },
          onDeleteBookmarks: (bookmarkTimes: number[]): void => {
            if (this.acceptsTextInput(_identity)) this.onDeleteBookmarks(bookmarkTimes);
          },
          onDirectoryProjectionChanged: (entries: LocalReadingTocEntry[]): void => {
            if (_identity === this.readingIdentityKey()) this.onDirectoryProjectionChanged(entries, _identity);
          },
          onLoadControlBookmarks: (sourceId: string, bookId: string, isCurrent: () => boolean): Promise<void> =>
            _identity === this.readingIdentityKey() ? this.onLoadControlBookmarks(sourceId, bookId,
              (): boolean => _identity === this.readingIdentityKey() && isCurrent()) : Promise.resolve(),
          chapterStartBookmarkCreationEnabled: this.contentKind !== 'manga' && this.chapterStartBookmarkCreationEnabled,
          onCreateChapterStartBookmark: (request: ReaderDirectoryChapterStartBookmarkRequest): void => {
            if (this.acceptsTextInput(_identity)) this.onCreateChapterStartBookmark(request);
          },
          onTogglePageBookmark: (request: ReaderPageBookmarkToggleRequest): void => {
            if (this.acceptsTextInput(_identity)) this.onTogglePageBookmark(request);
          },
        })
          .width('100%')
          .height('100%')
          .opacity(this.route === 'reading' || this.route === 'directory' ? 1 : 0);
        }, (identity: string): string => identity);
        }
      }
      .width('100%')
      .height('100%')
      // Preserve layout and the reader owner while a sibling owns input.
      .id(sourceSwitchTriggerFocusId(this.sourceId, this.bookId, 'reader-body'))
      .focusable(this.readingContentIsForeground())
      .enabled(this.readingContentIsForeground())
      .accessibilityLevel(this.readingContentIsForeground() ? 'auto' : 'no-hide-descendants')
      .hitTestBehavior(this.readingContentIsForeground() ? HitTestMode.Transparent : HitTestMode.None);

  }

  @Builder
  private readingOverlay() {
      if (this.route === 'directory') {
        ReaderDirectoryDestination({
          opening: this.directoryOpening, isOpeningCurrent: this.isDirectoryOpeningCurrent,
          catalogContext: 'reader', contentKind: this.contentKind,
          sourceId: this.sourceId, bookId: this.bookId, bookKind: this.bookKind ?? '', bookTitle: this.bookTitle,
          chapterTitle: this.directoryChapterTitle, entries: this.tocEntries,
          catalogMessage: this.catalogMessage, catalogBusy: this.catalogBusy,
          currentChapterIndex: this.directoryCurrentChapterIndex,
          currentPageOrdinal: this.directoryCurrentPageOrdinal, currentPageTotal: this.directoryCurrentPageTotal,
          directoryRecovery: this.directoryRecovery,
          onReconcileBookmarks: this.onReconcileBookmarks, onContinueBookmarks: this.onContinueBookmarks,
          onReconcileOffline: this.onReconcileOffline, onContinueOffline: this.onContinueOffline,
          mangaDownloadEnabled: this.mangaDownloadEnabled,
          onLoadDownloadActions: this.onLoadMangaDownloadActions, onDownloadAction: this.onMangaDownloadAction,
          interactive: this.inputAllowed && this.visible && !this.sourceSwitchPresented && !this.sourceSwitchCovered,
          offlineBookOperationActive: this.offlineBookOperationActive,
          onSelectChapter: this.onSelectChapter, onSelectNavigationTarget: this.onSelectNavigationTarget,
          onSelectBookmark: this.onSelectBookmark, bookmarkIdentity: this.bookmarkIdentity,
          onDownloadChapter: this.onDownloadChapter, onDownloadBook: this.onDownloadBook, onClearBookOffline: this.onClearBookOffline,
          onDeleteBookmarks: this.onDeleteBookmarks, chapterStartBookmarkCreationEnabled: this.chapterStartBookmarkCreationEnabled,
          onCreateChapterStartBookmark: this.onCreateChapterStartBookmark,
          onSwitchSource: this.onSwitchSource, onBack: this.onCloseDirectory, onTemporaryBackBridge: this.onDirectoryBackBridge,
        });
      }

      if (this.sourceSwitchPresented) {
        this.sourceSwitchOverlayContent();
      }
      this.overlayStatusBarUnderlay();
  }

  @Builder
  private sourceSwitchOverlayContent() {
    SourceSwitchPanel({
      showing: this.sourceSwitchVisible, surface: this.sourceSwitchSurface,
      scopeId: this.sourceSwitchScopeId, state: this.sourceSwitchState,
      currentSourceId: this.sourceId, bookTitle: this.bookTitle, author: this.bookAuthor, coverUrl: this.bookCoverUrl,
      currentSourceName: this.sourceName, latestChapterTitle: this.latestChapterTitle,
      currentChapterTitle: this.directoryChapterTitle, reduceMotion: this.reduceMotion,
      contentKind: this.contentKind, allowCancelWhileSwitching: this.allowCancelSourceSwitchWhilePreparing,
      interactive: this.inputAllowed && this.visible && !this.sourceSwitchCovered,
      onStop: this.onStopSourceSwitch, onClose: this.onCloseSourceSwitch,
      onRetry: this.onRetrySourceSwitch, onRefresh: this.onRefreshSourceSwitch,
      onSelectCandidate: this.onPickSource, onRollback: this.onRollbackSourceSwitch,
    });
  }

  @Builder
  private mangaSurface() {
    ForEach([this.mangaIdentityKey()], (_identity: string) => {
      MangaReadingSurface({
        windowChromeActive: this.visible,
        windowChromeOverlayActive: this.visible && (this.route === 'directory' || this.sourceSwitchPresented || this.sourceSwitchCovered),
        interactionBlocked: !this.readingContentIsForeground(),
        isReaderIdentityCurrent: (): boolean => this.isMangaSurfaceCurrent(_identity),
        retainPreparationOnDisappear: (): boolean => this.keepsMangaReadingSession(_identity),
        reduceMotion: this.reduceMotion,
        offline: this.requestedMangaOfflineChapterId !== undefined ||
          ReaderRuntimeOwner.current().mangaOfflineProbeFor?.(this.sourceId, this.bookId) === true ||
          this.remoteSession?.acquisitionMode === 'offline',
        settingsGateway: this.mangaSettingsGateway,
        bookTitle: this.bookTitle, inBookshelf: this.inBookshelf,
        downloadEnabled: this.mangaDownloadEnabled,
        moreMenuVariant: this.mangaMoreMenuVariant,
        directoryProjection: this.tocEntries,
        directoryCurrentChapterIndex: this.directoryCurrentChapterIndex,
        onLoadDownloadActions: (chapterIndex?: number): Promise<MangaDownloadAction[]> =>
          this.acceptsMangaInput(_identity) ? this.onLoadMangaDownloadActions(chapterIndex) : Promise.resolve([]),
        onDownloadAction: (action: MangaDownloadActionId, chapterIndex?: number): Promise<void> =>
          this.acceptsMangaInput(_identity) ? this.onMangaDownloadAction(action, chapterIndex) : Promise.resolve(),
        onDownloadBook: (): void => { if (this.acceptsMangaInput(_identity)) this.onDownloadBook(); },
        onOpenDownloads: (): void => { if (this.acceptsMangaInput(_identity)) this.onOpenDownloads(); },
        onDetail: (): void => { if (this.acceptsMangaInput(_identity)) this.onOpenBookInfo(); },
        onToggleShelf: (): void => { if (this.acceptsMangaInput(_identity)) this.onToggleShelf(); },
        onDownloadChapter: (): void => {
          if (!this.acceptsMangaInput(_identity)) return;
          const index = this.directoryCurrentChapterIndex;
          if (index >= 0) this.onDownloadChapter(index);
        },
        onSelectDirectoryTarget: (chapterIndex: number, directoryTargetProof?: ReaderDirectoryTargetProof): void => {
          if (!this.acceptsMangaInput(_identity)) return;
          if (directoryTargetProof === undefined) this.onSelectChapter(chapterIndex);
          else this.onSelectNavigationTarget(chapterIndex, 0, undefined, directoryTargetProof);
        },
        onDirectory: (): void => { if (this.acceptsMangaInput(_identity)) this.onOpenDirectory(); },
        onSwitchSource: (focusId?: string): void => { if (this.acceptsMangaInput(_identity)) this.onSwitchSource(focusId); },
        onLoginSource: (): Promise<void> => this.acceptsMangaInput(_identity) ?
          this.onMangaLogin() : Promise.reject(new Error('MANGA_SESSION_CANCELLED')),
        onSaveFailure: (message: string): void => {
          if (this.isMangaSurfaceCurrent(_identity)) this.onReadingFailure(this.sourceId, this.bookId, message);
        },
        runtime: ReaderRuntimeOwner.current(), sourceId: this.sourceId, bookId: this.bookId,
        chapterIndex: this.requestedChapterIndex,
        startAtChapterFirst: this.mangaStartAtChapterFirst,
        directoryTargetProof: this.requestedMangaDirectoryTargetProof,
        expectedOfflineChapterId: this.requestedMangaOfflineChapterId,
        remoteSession: this.remoteSession, remoteBookSeed: this.remoteBookSeed,
        onRemoteSessionReady: (session: RemoteReadingSession, refreshDirectoryDisplay?: boolean): void => {
          if (this.isMangaSurfaceCurrent(_identity)) this.onRemoteSessionReady(session, refreshDirectoryDisplay);
        },
        onChapterCommitted: (index: number, title: string): void => this.onMangaChapterReady(_identity, index, title),
        onAdjacentChapterCommitted: (index: number, title: string): void => this.onMangaAdjacentChapterReady(_identity, index, title),
        onBack: (): void => { if (this.isMangaSurfaceCurrent(_identity)) this.onExit(this.readingIdentityKey()); },
        onExitCancelled: (): void => {
          if (this.isMangaSurfaceCurrent(_identity)) this.onExitCancelled(this.readingIdentityKey());
        },
        onExitRequestHandler: (requestExit: ReaderExitRequest): (() => void) | undefined => {
          if (!this.isMangaSurfaceCurrent(_identity)) return undefined;
          return this.onExitRequestHandler(requestExit, this.readingIdentityKey(),
            (): boolean => this.isMangaSurfaceCurrent(_identity), this.mangaChapterRequestGeneration);
        },
        onChapter: (direction: number): void => {
          if (this.acceptsMangaInput(_identity)) this.selectAdjacentMangaChapter(direction);
        },
      })
    }, (identity: string): string => identity)
  }

  private mangaIdentityKey(): string {
    return JSON.stringify([this.sourceId, this.bookId, this.readingReadyGeneration,
      this.mangaChapterRequestGeneration]);
  }

  private isMangaSurfaceCurrent(identity: string): boolean {
    return this.contentKind === 'manga' && identity === this.mangaIdentityKey();
  }

  private acceptsMangaInput(identity: string): boolean {
    return this.isMangaSurfaceCurrent(identity) && this.readingContentIsForeground();
  }

  private keepsMangaReadingSession(identity: string): boolean {
    const previous = JSON.parse(identity) as (string | number | null)[];
    return this.contentKind === 'manga' && (this.route === 'reading' || this.route === 'directory') &&
      previous[0] === this.sourceId && previous[1] === this.bookId;
  }

  private onMangaChapterReady(identity: string, chapterIndex: number, chapterTitle: string): void {
    if (this.contentKind !== 'manga' || identity !== this.mangaIdentityKey() ||
      !Number.isSafeInteger(chapterIndex) || chapterIndex < 0 ||
      (this.requestedChapterIndex !== undefined && this.requestedChapterIndex !== chapterIndex)) return;
    this.onChapterCommitted(chapterIndex, chapterTitle);
    this.onReadingReady(chapterIndex, this.sourceId, this.bookId, this.readingReadyGeneration);
  }

  private selectAdjacentMangaChapter(direction: number): void {
    if (direction !== -1 && direction !== 1) return;
    const current = this.tocEntries.findIndex(entry => entry.index === (this.requestedChapterIndex ?? this.directoryCurrentChapterIndex));
    if (current < 0) return;
    // A historical cached group can be resumed without becoming selectable.
    for (let next = current + direction; next >= 0 && next < this.tocEntries.length; next += direction) {
      if (this.tocEntries[next].navigable !== false) { this.onSelectChapter(this.tocEntries[next].index); return; }
    }
  }

  private onMangaAdjacentChapterReady(identity: string, chapterIndex: number, chapterTitle: string): void {
    if (this.contentKind !== 'manga' || identity !== this.mangaIdentityKey() ||
      !Number.isSafeInteger(chapterIndex) || !this.tocEntries.some(entry => entry.index === chapterIndex && entry.navigable !== false)) return;
    // An internal transfer retains its Surface. Explicit directory/source
    // requests still increment mangaChapterRequestGeneration and remount it.
    this.onAdjacentChapterCommitted(chapterIndex, chapterTitle);
    this.onReadingReady(chapterIndex, this.sourceId, this.bookId, this.readingReadyGeneration);
  }

  private readingIdentityKey(): string {
    return JSON.stringify([this.sourceId, this.bookId, this.readingReadyGeneration]);
  }

  private chromeMetrics(_revision: number): ReaderWindowMetricsSnapshot {
    return ReaderWindowCoordinator.metrics();
  }

  @Builder
  private overlayStatusBarUnderlay() {
    // Sibling directory and source-switch surfaces can paint over the band's
    // child in ReadingExperience. Repaint above those surfaces with the same
    // owner-requested color; do not derive an independent application tone.
    if (this.contentKind !== 'manga' && this.visible && (this.route === 'directory' || this.sourceSwitchPresented)) {
      ReaderStatusBarPaper({
        theme: this.chromePaperThemeId,
        fallbackColor: this.chromeUnderlayColor,
        viewportWidth: this.chromeMetrics(this.windowMetricsRevision).windowRect.width,
        viewportHeight: this.chromeMetrics(this.windowMetricsRevision).windowRect.height,
        statusRect: this.chromeMetrics(this.windowMetricsRevision).statusBarRect,
        expanded: readerWidthClassWithHint(this.chromeMetrics(this.windowMetricsRevision).windowRect.width,
          this.expandedLayout) === 'expanded',
      }).zIndex(10).hitTestBehavior(HitTestMode.None)
        .id('reader-overlay-status-bar-underlay');
    }
  }
}
