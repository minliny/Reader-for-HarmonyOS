import { HarmonySmartGestureHost, ReaderSmartGestureShortcut } from '../../../platform/interaction/HarmonySmartGestureHost';
import { DEFAULT_READER_SMART_GESTURES, type ReaderSmartGesture, type ReaderSmartGestureAction, type ReaderSmartGestureSettings } from '../../reading/application/ReaderSmartGesturePolicy';
import { EMPTY_READING_DIRECTORY_RECOVERY, type ReadingDirectoryRecovery } from '../../reading/presentation/ReadingDirectoryRecovery';
import { sourceSwitchTriggerFocusId } from '../../source/presentation/SourceSwitchSurfaceLifecycle';
import type { ReaderExitRequest } from '../../reading/presentation/ReadingEntryPresentation';
import type { ReaderDirectoryTargetProof } from '../../reading/application/ReaderDirectoryTargetProof';
import type { ReaderNavigationPreferences } from '../../../app/HarmonyCapabilityPolicy';
import { defaultNavigationPreferences } from '../../../ui/surfaces/ReaderSurfaceMaterial';
import { ReaderTransientFeedback, READER_FEEDBACK_BRIEF_MS } from '../../../ui/feedback/ReaderTransientFeedback';
import { ReaderPageState } from '../../../ui/feedback/ReaderPageState';
import hilog from '@ohos.hilog';
import { ReaderWindowCoordinator, ReaderWindowChromeStyle, ReaderWindowPolicy } from '../../../app/ReaderWindowCoordinator';
import { diagnosticCodeOf } from '../../../app/LogPrivacy';
import { readerInteractiveSafeInsets, readerStableInteractiveSafeBottom, type ReaderInsetsVp } from '../../../ui/foundation/ReaderWindowMetrics';
import { mangaUserError } from '../presentation/MangaUserError';
import type { ReaderSettingsGateway } from '../../reading/application/ReaderSettingsGateway';
import type { ReadingGatewayRuntime } from '../../reading/application/ReadingGatewayRuntime';
import { RemoteReadingFlowGateway, type RemoteReadingBookSeed, type RemoteReadingSession, type RemoteReadingTocEntry } from '../../reading/application/RemoteReadingFlowGateway';
import { MangaSessionGateway } from '../application/MangaSessionGateway';
import type { MangaChapterResult } from '../application/MangaContract';
import { MangaSessionController } from '../application/MangaSessionController';
import { MangaStripRow } from './MangaStripProjection';
import type { LocalReadingTocEntry } from '../../reading/application/LocalReadingFlowGateway';
import { MangaBookPresentation } from '../presentation/MangaBookPresentation';
import type { MangaDownloadAction, MangaDownloadActionId } from '../application/MangaDownloadActionsGateway';
import { type ActionSheetSpecId } from '../../../ui/surfaces/ReaderSurfaceSpecs';
import { MangaDirectoryDrawer, MangaDirectoryRenderState, MangaTabletDirectory, MangaDirectoryFallback } from './MangaDirectoryDrawer';
import { MangaReaderChrome, MangaChromeRenderState, MangaReaderChromeContent, MangaRefreshProgress, MangaRecoveryOverlay, MangaPageBadge, MangaPanelOverlay, MangaChapterEndContent, MangaTopBarBackContent, MangaTopBarActionsContent,
  MangaActionPanelHeader, MangaActionPanelBody } from './MangaReaderChrome';
import { MangaReadingViewportHost, MangaViewportRenderState, MangaBoundaryViewport, MangaImageViewport } from './MangaReadingViewportHost';
import { MangaChapterBoundaryHost, MangaBoundaryRenderState, MangaRetainedChapterPixels, MangaBoundaryHint } from './MangaChapterBoundaryHost';

interface MangaReadingBook {
  readonly sourceId: string;
  readonly bookId: string;
  readonly bookTitle: string;
  controller: MangaSessionController | undefined;
  readonly runtime: ReadingGatewayRuntime | undefined;
  readonly remoteSession: RemoteReadingSession | undefined;
  readonly remoteBookSeed: RemoteReadingBookSeed | undefined;
  readonly offline: boolean;
  readonly directoryCurrentChapterIndex: number;
  readonly directoryProjection: LocalReadingTocEntry[];
  readonly directoryRecovery: ReadingDirectoryRecovery;
  readonly downloadEnabled: boolean;
  readonly inBookshelf: boolean;
  readonly moreMenuVariant: ActionSheetSpecId;
  readonly isReaderIdentityCurrent: () => boolean;
  readonly inputCurrent: (() => boolean) | undefined;
  readonly settingsGateway: ReaderSettingsGateway | undefined;
}

interface MangaReadingWindow {
  readonly getUIContext: () => UIContext;
  readonly appForeground: boolean;
  readonly appThemeScheme: string;
  backgroundPreference: 'paper' | 'white' | 'ink';
  controlsVisible: boolean;
  readonly interactionBlocked: boolean;
  panel: string;
  readonly reduceMotion: boolean;
  readonly stageWidth: number;
  readonly stageHeight: number;
  readonly systemScheme: string;
  readonly windowChromeActive: boolean;
  readonly windowChromeOverlayActive: boolean;
  readonly windowInteractiveInsets: (_revision: number) => ReaderInsetsVp;
  readonly interactiveInsets: (revision: number) => ReaderInsetsVp;
  readonly windowMetricsRevision: number;
  readonly navigationPreferences: ReaderNavigationPreferences;
  readonly smartGestureSettings: ReaderSmartGestureSettings;
  readonly onWindowChromeChanged: () => void;
}

interface MangaReadingChapter {
  readonly mounted: boolean;
  readonly exiting: boolean;
  chapterCommitted: boolean;
  chapterEnd: boolean;
  error: string;
  readonly loggingIn: boolean;
  readonly loginRequiredForControls: boolean;
  readonly opened: boolean;
  readonly openingRetry: boolean;
  presentationGeneration: number;
  readonly pageTurnInputRevision: number;
  recovering: boolean;
  readonly refreshing: boolean;
  title: string;
  readonly offlineProbeStatus: string;
  readonly notifyPreparationFailure: () => void;
  readonly refreshLoginRequiredForControls: () => void;
  readonly configureAdjacentChapter: (session: RemoteReadingSession, controller: MangaSessionController) => void;
}

interface MangaReadingActions {
  readonly confirmRecovery: () => Promise<void>;
  readonly handleBack: (intent?: 'navigation') => Promise<void>;
  readonly loginAndRetry: () => Promise<void>;
  readonly onAdjacentChapterCommitted: (index: number, title: string) => void;
  readonly onChapterCommitted: (index: number, title: string) => void;
  readonly onContinueOffline: (generation: number, presentationId: string) => void;
  readonly onDetail: () => void;
  readonly onDirectory: () => void;
  readonly onDownloadAction: (action: MangaDownloadActionId, chapterIndex?: number) => Promise<void>;
  readonly onDownloadBook: () => void;
  readonly onDownloadChapter: () => void;
  readonly onLoadDownloadActions: (chapterIndex?: number) => Promise<MangaDownloadAction[]>;
  readonly onOpenDownloads: () => void;
  readonly onReconcileOffline: (generation: number, presentationId: string) => void;
  readonly onRemoteSessionReady: (session: RemoteReadingSession, refreshDirectoryDisplay?: boolean) => void;
  readonly onSaveFailure: (message: string) => void;
  readonly onSelectDirectoryTarget: (chapterIndex: number, proof?: ReaderDirectoryTargetProof) => void;
  readonly onSwitchSource: (focusId?: string) => void;
  readonly onToggleShelf: () => void;
  readonly openSourceSwitch: () => Promise<void>;
  readonly refreshImages: () => Promise<void>;
}

interface MangaReadingNativeSlots {
  readonly viewportImages: () => void;
  readonly boundaryHint: () => void;
  readonly directoryFallback: (catalog: boolean, identity: string) => void;
  readonly topBarBack: () => void;
  readonly topBarActions: () => void;
  readonly actionPanelHeader: (opening: number) => void;
  readonly actionPanelBody: (opening: number) => void;
}

export interface MangaReadingScene {
  readonly book: MangaReadingBook;
  readonly window: MangaReadingWindow;
  readonly chapter: MangaReadingChapter;
  readonly actions: MangaReadingActions;
  readonly slots: MangaReadingNativeSlots;
  readonly directory: () => MangaDirectoryDrawer;
  readonly chrome: () => MangaReaderChrome;
  readonly viewport: () => MangaReadingViewportHost;
  readonly boundary: () => MangaChapterBoundaryHost;
}
/** Mounted chapter, window policy, and the native reader stage. */
@Component
export struct MangaReadingSurface {
  private readonly transientFeedback: ReaderTransientFeedback = new ReaderTransientFeedback();
  private readonly scene: MangaReadingScene = this.bindScene();
  @State private directoryState: MangaDirectoryRenderState = new MangaDirectoryRenderState();
  private readonly directory: MangaDirectoryDrawer = new MangaDirectoryDrawer(this.scene, (): MangaDirectoryRenderState => this.directoryState);
  @State private chromeState: MangaChromeRenderState = new MangaChromeRenderState();
  private readonly chrome: MangaReaderChrome = new MangaReaderChrome(this.scene, (): MangaChromeRenderState => this.chromeState, this.transientFeedback);
  @State private viewportState: MangaViewportRenderState = new MangaViewportRenderState();
  private readonly viewport: MangaReadingViewportHost = new MangaReadingViewportHost(this.scene, (): MangaViewportRenderState => this.viewportState);
  @State private boundaryState: MangaBoundaryRenderState = new MangaBoundaryRenderState();
  private readonly boundary: MangaChapterBoundaryHost = new MangaChapterBoundaryHost(this.scene, (): MangaBoundaryRenderState => this.boundaryState, this.transientFeedback);
  @StorageLink('readerWindowMetricsRevision') @Watch('onDirectoryMetricsChanged') private windowMetricsRevision: number = 0;
  @StorageLink('readerAppForeground') @Watch('onPanelForegroundChanged') private appForeground: boolean = true;
  @StorageLink('readerSmartGestureSettings') @Watch('syncSmartGestureMonitor')
  private smartGestureSettings: ReaderSmartGestureSettings = DEFAULT_READER_SMART_GESTURES;
  private readonly smartGestureHost: HarmonySmartGestureHost = new HarmonySmartGestureHost();
  settingsGateway: ReaderSettingsGateway | undefined = undefined;
  runtime: ReadingGatewayRuntime | undefined = undefined;
  sourceId: string = '';
  bookId: string = '';
  chapterIndex: number | undefined = undefined;
  expectedOfflineChapterId: string | undefined = undefined;
  startAtChapterFirst: boolean = false;
  directoryTargetProof: ReaderDirectoryTargetProof | undefined = undefined;
  @Prop remoteSession: RemoteReadingSession | undefined = undefined;
  remoteBookSeed: RemoteReadingBookSeed | undefined = undefined;
  onRemoteSessionReady: (session: RemoteReadingSession, refreshDirectoryDisplay?: boolean) => void = (): void => {};
  onChapterCommitted: (index: number, title: string) => void = (): void => {};
  onAdjacentChapterCommitted: (index: number, title: string) => void = (): void => {};
  offline: boolean = false;
  onSaveFailure: (message: string) => void = (_message: string): void => {};
  onBack: () => void = (): void => {};
  onDirectory: () => void = (): void => {};
  @Prop bookTitle: string = '';
  @Prop inBookshelf: boolean = true;
  @Prop reduceMotion: boolean = false;
  @Prop directoryRecovery: ReadingDirectoryRecovery = EMPTY_READING_DIRECTORY_RECOVERY;
  onReconcileOffline: (generation: number, presentationId: string) => void = (): void => {};
  onContinueOffline: (generation: number, presentationId: string) => void = (): void => {};
  @Prop @Watch('onReaderWindowOwnershipChanged') windowChromeActive: boolean = false;
  @Prop @Watch('onReaderWindowOwnershipChanged') windowChromeOverlayActive: boolean = false;
  @Prop @Watch('onReaderInteractionBlockedChanged') interactionBlocked: boolean = false;
  isReaderIdentityCurrent: () => boolean = (): boolean => true;
  inputCurrent: (() => boolean) | undefined = undefined;
  retainPreparationOnDisappear: () => boolean = (): boolean => false;
  private windowChromeOwned: boolean = false;
  onDetail: () => void = (): void => {};
  onToggleShelf: () => void = (): void => {};
  onDownloadChapter: () => void = (): void => {};
  onDownloadBook: () => void = (): void => {};
  onOpenDownloads: () => void = (): void => {};
  @Prop downloadEnabled: boolean = false;
  /** Default is the grouped action sheet; ReaderShell can opt into the quick
   * shortcut variant for fixed high-frequency reading actions. */
  @Prop moreMenuVariant: ActionSheetSpecId = 'grouped';
  @Prop directoryProjection: LocalReadingTocEntry[] = [];
  @Prop directoryCurrentChapterIndex: number = -1;
  onLoadDownloadActions: (chapterIndex?: number) => Promise<MangaDownloadAction[]> = async (): Promise<MangaDownloadAction[]> => [];
  onDownloadAction: (action: MangaDownloadActionId, chapterIndex?: number) => Promise<void> = async (): Promise<void> => {};
  onSelectDirectoryTarget: (chapterIndex: number, proof?: ReaderDirectoryTargetProof) => void = (_index: number, _proof?: ReaderDirectoryTargetProof): void => {};
  onSwitchSource: (focusId?: string) => void = (): void => {};
  onLoginSource: () => Promise<void> = async (): Promise<void> => {};
  onExitRequestHandler: (requestExit: ReaderExitRequest) => (() => void) | undefined = () => undefined;
  onExitCancelled: () => void = (): void => {};
  private withdrawExitRequest: (() => void) | undefined;
  onChapter: (direction: number) => void = (_direction: number): void => {};
  @State @Watch('onErrorPresentationChanged') private error: string = '';
  @State private openFailureStage: 'source' | 'chapter' = 'chapter';
  private preparationFailureNoticeKey: string = '';
  private openedErrorNoticeKey: string = '';
  @State private offlineProbeStatus: string = '';
  private detachOfflineProbe: (() => void) | undefined;
  @State private title: string = '';
  @State @Watch('onWindowChromeChanged') private recovering: boolean = false;
  @State @Watch('onErrorPresentationChanged') private opened: boolean = false;
  private controller: MangaSessionController | undefined;
  private mounted: boolean = false;
  private chapterCommitted: boolean = false;
  private readonly reportedErrorCodes: Set<string> = new Set<string>();
  @State private loggingIn: boolean = false;
  @State @Watch('onWindowChromeChanged') private loginRequiredForControls: boolean = false;
  private loginGeneration: number = 0;
  @State @Watch('onWindowChromeChanged') private openingRetry: boolean = false;
  private resumeChangedContent: boolean = false;
  @State private presentationGeneration: number = 0;
  private pageTurnInputRevision: number = 0;
  private exiting: boolean = false;
  private navigationExitRequested: boolean = false;
  @StorageProp('readerAppScheme') @Watch('synchronizePaper') private appThemeScheme: string = 'day';
  @StorageLink('readerSystemScheme') private systemScheme: string = 'day';
  @StorageProp('readerNavigationAppearancePreferences') private navigationPreferences: ReaderNavigationPreferences =
    defaultNavigationPreferences();
  @State @Watch('onWindowChromeChanged') private controlsVisible: boolean = false;
  @State @Watch('onWindowChromeChanged') private panel: string = '';
  @State private refreshing: boolean = false;
  @State @Watch('onWindowChromeChanged') private chapterEnd: boolean = false;
  @State @Watch('onWindowChromeChanged') private backgroundPreference: 'paper' | 'white' | 'ink' = 'paper';
  @State private stageWidth: number = 1;
  @State private stageHeight: number = 1;
  aboutToAppear(): void {
    this.mounted = true;
    this.synchronizePaper();
    if (this.runtime === undefined) {
      this.error = 'MANGA_RESOURCE_HOST_UNAVAILABLE';
      this.onWindowChromeChanged();
      return;
    }
    const presentationRevision = MangaBookPresentation.revision;
    MangaBookPresentation.useOwner(this.runtime);
    if (MangaBookPresentation.revision !== presentationRevision)
      AppStorage.setOrCreate('readerMangaPresentationRevision', MangaBookPresentation.revision);
    this.viewport.state.horizontal = this.settingsGateway?.current()?.mangaDirection === 'horizontal';
    this.viewport.state.fitPreference = this.settingsGateway?.current()?.mangaFit ?? 'source';
    this.chrome.state.showPageNumbers = this.settingsGateway?.current()?.mangaPageNumbers !== false;
    this.chrome.loadBrightness();
    this.withdrawExitRequest = this.onExitRequestHandler((intent?: 'navigation'): void => {
      if (this.mounted) void this.handleBack(intent);
    });
    const controller = new MangaSessionController(this.runtime);
    this.controller = controller;
    controller.onChange = (): void => this.viewport.publish();
    this.onWindowChromeChanged();
    this.open(controller);
  }
  aboutToDisappear(): void {
    this.smartGestureHost.detach();
    this.transientFeedback.reset();
    // Withdraw before resetting watched state: disposal cannot reissue reader policy.
    this.mounted = false;
    this.viewport.clearPageSliderPreview();
    this.withdrawExitRequest?.();
    this.withdrawExitRequest = undefined;
    this.boundary.releaseMount();
    this.restoreAppWindowChrome();
    this.chrome.releasePanel();
    this.refreshing = false;
    this.chrome.releaseBrightness();
    this.viewport.layoutGeneration++; this.viewport.viewportGeneration++; this.loginGeneration++; this.presentationGeneration++;
    this.loggingIn = false;
    this.viewport.releaseMountedPosition();
    const retainPreparation = this.retainPreparationOnDisappear();
    if (this.controller !== undefined) {
      this.controller.onChange = undefined;
      void this.controller.close(retainPreparation ? 'chapter' : 'exit').catch((): void => {});
    }
    // Same-book chapter remounts keep the book-wide probe; only its old view subscriber leaves.
    if (!retainPreparation) this.runtime?.finishMangaOfflineProbe?.(this.sourceId, this.bookId);
    this.detachOfflineProbe?.(); this.detachOfflineProbe = undefined;
  }
  private synchronizePaper(): void {
    this.chrome.synchronizePaper();
  }
  private onDirectoryMetricsChanged(): void {
    this.directory.onDirectoryMetricsChanged();
    this.onWindowChromeChanged();
  }
  // Access the live mount. In particular, watched flags publish through ArkUI
  // at the original assignment, even during an asynchronous chapter transfer.
  private bindScene(): MangaReadingScene {
    const surface = this;
    const book: MangaReadingBook = {
      get sourceId(): string { return surface.sourceId; },
      get bookId(): string { return surface.bookId; },
      get bookTitle(): string { return surface.bookTitle; },
      get controller(): MangaSessionController | undefined { return surface.controller; },
      set controller(value: MangaSessionController | undefined) { surface.controller = value; },
      get runtime(): ReadingGatewayRuntime | undefined { return surface.runtime; },
      get remoteSession(): RemoteReadingSession | undefined { return surface.remoteSession; },
      get remoteBookSeed(): RemoteReadingBookSeed | undefined { return surface.remoteBookSeed; },
      get offline(): boolean { return surface.offline; },
      get directoryCurrentChapterIndex(): number { return surface.directoryCurrentChapterIndex; },
      get directoryProjection(): LocalReadingTocEntry[] { return surface.directoryProjection; },
      get directoryRecovery(): ReadingDirectoryRecovery { return surface.directoryRecovery; },
      get downloadEnabled(): boolean { return surface.downloadEnabled; },
      get inBookshelf(): boolean { return surface.inBookshelf; },
      get moreMenuVariant(): ActionSheetSpecId { return surface.moreMenuVariant; },
      get isReaderIdentityCurrent(): () => boolean { return surface.isReaderIdentityCurrent; },
      get inputCurrent(): (() => boolean) | undefined { return surface.inputCurrent; },
      get settingsGateway(): ReaderSettingsGateway | undefined { return surface.settingsGateway; },
    };
    const window: MangaReadingWindow = {
      getUIContext: (): UIContext => surface.getUIContext(),
      get appForeground(): boolean { return surface.appForeground; },
      get appThemeScheme(): string { return surface.appThemeScheme; },
      get backgroundPreference(): 'paper' | 'white' | 'ink' { return surface.backgroundPreference; },
      set backgroundPreference(value: 'paper' | 'white' | 'ink') { surface.backgroundPreference = value; },
      get controlsVisible(): boolean { return surface.controlsVisible; },
      set controlsVisible(value: boolean) { surface.controlsVisible = value; },
      get interactionBlocked(): boolean { return surface.interactionBlocked; },
      get panel(): string { return surface.panel; },
      set panel(value: string) { surface.panel = value; },
      get reduceMotion(): boolean { return surface.reduceMotion; },
      get stageWidth(): number { return surface.stageWidth; },
      get stageHeight(): number { return surface.stageHeight; },
      get systemScheme(): string { return surface.systemScheme; },
      get windowChromeActive(): boolean { return surface.windowChromeActive; },
      get windowChromeOverlayActive(): boolean { return surface.windowChromeOverlayActive; },
      windowInteractiveInsets: (_revision: number): ReaderInsetsVp => surface.windowInteractiveInsets(_revision),
      interactiveInsets: (revision: number): ReaderInsetsVp => surface.interactiveInsets(revision),
      get windowMetricsRevision(): number { return surface.windowMetricsRevision; },
      get navigationPreferences(): ReaderNavigationPreferences { return surface.navigationPreferences; },
      get smartGestureSettings(): ReaderSmartGestureSettings { return surface.smartGestureSettings; },
      onWindowChromeChanged: (): void => surface.onWindowChromeChanged(),
    };
    const chapter: MangaReadingChapter = {
      get mounted(): boolean { return surface.mounted; },
      get exiting(): boolean { return surface.exiting; },
      get chapterCommitted(): boolean { return surface.chapterCommitted; },
      set chapterCommitted(value: boolean) { surface.chapterCommitted = value; },
      get chapterEnd(): boolean { return surface.chapterEnd; },
      set chapterEnd(value: boolean) { surface.chapterEnd = value; },
      get error(): string { return surface.error; },
      set error(value: string) { surface.error = value; },
      get loggingIn(): boolean { return surface.loggingIn; },
      get loginRequiredForControls(): boolean { return surface.loginRequiredForControls; },
      get opened(): boolean { return surface.opened; },
      get openingRetry(): boolean { return surface.openingRetry; },
      get presentationGeneration(): number { return surface.presentationGeneration; },
      set presentationGeneration(value: number) { surface.presentationGeneration = value; },
      get pageTurnInputRevision(): number { return surface.pageTurnInputRevision; },
      get recovering(): boolean { return surface.recovering; },
      set recovering(value: boolean) { surface.recovering = value; },
      get refreshing(): boolean { return surface.refreshing; },
      get title(): string { return surface.title; },
      set title(value: string) { surface.title = value; },
      get offlineProbeStatus(): string { return surface.offlineProbeStatus; },
      notifyPreparationFailure: (): void => surface.notifyPreparationFailure(),
      refreshLoginRequiredForControls: (): void => surface.refreshLoginRequiredForControls(),
      configureAdjacentChapter: (session: RemoteReadingSession, controller: MangaSessionController): void => surface.configureAdjacentChapter(session, controller),
    };
    const actions: MangaReadingActions = {
      confirmRecovery: (): Promise<void> => surface.confirmRecovery(),
      handleBack: (intent?: 'navigation'): Promise<void> => surface.handleBack(intent),
      loginAndRetry: (): Promise<void> => surface.loginAndRetry(),
      get onAdjacentChapterCommitted(): (index: number, title: string) => void { return surface.onAdjacentChapterCommitted; },
      get onChapterCommitted(): (index: number, title: string) => void { return surface.onChapterCommitted; },
      get onContinueOffline(): (generation: number, presentationId: string) => void { return surface.onContinueOffline; },
      get onDetail(): () => void { return surface.onDetail; },
      get onDirectory(): () => void { return surface.onDirectory; },
      get onDownloadAction(): (action: MangaDownloadActionId, chapterIndex?: number) => Promise<void> { return surface.onDownloadAction; },
      get onDownloadBook(): () => void { return surface.onDownloadBook; },
      get onDownloadChapter(): () => void { return surface.onDownloadChapter; },
      get onLoadDownloadActions(): (chapterIndex?: number) => Promise<MangaDownloadAction[]> { return surface.onLoadDownloadActions; },
      get onOpenDownloads(): () => void { return surface.onOpenDownloads; },
      get onReconcileOffline(): (generation: number, presentationId: string) => void { return surface.onReconcileOffline; },
      get onRemoteSessionReady(): (session: RemoteReadingSession, refreshDirectoryDisplay?: boolean) => void { return surface.onRemoteSessionReady; },
      get onSaveFailure(): (message: string) => void { return surface.onSaveFailure; },
      get onSelectDirectoryTarget(): (chapterIndex: number, proof?: ReaderDirectoryTargetProof) => void { return surface.onSelectDirectoryTarget; },
      get onSwitchSource(): (focusId?: string) => void { return surface.onSwitchSource; },
      get onToggleShelf(): () => void { return surface.onToggleShelf; },
      openSourceSwitch: (): Promise<void> => surface.openSourceSwitch(),
      refreshImages: (): Promise<void> => surface.refreshImages(),
    };
    const slots: MangaReadingNativeSlots = {
      viewportImages: (): void => surface.renderViewportImages(),
      boundaryHint: (): void => surface.renderBoundaryHint(),
      directoryFallback: (catalog: boolean, identity: string): void => surface.renderDirectoryFallback(catalog, identity),
      topBarBack: (): void => surface.renderTopBarBack(),
      topBarActions: (): void => surface.renderTopBarActions(),
      actionPanelHeader: (opening: number): void => surface.renderActionPanelHeader(opening),
      actionPanelBody: (opening: number): void => surface.renderActionPanelBody(opening),
    };
    const scene: MangaReadingScene = {
      book: book,
      window: window,
      chapter: chapter,
      actions: actions,
      slots: slots,
      directory: (): MangaDirectoryDrawer => surface.directory,
      chrome: (): MangaReaderChrome => surface.chrome,
      viewport: (): MangaReadingViewportHost => surface.viewport,
      boundary: (): MangaChapterBoundaryHost => surface.boundary,
    };
    return scene;
  }
  private async open(controller: MangaSessionController, resumePosition: boolean = false): Promise<void> {
    const current = (): boolean => this.mounted && this.controller === controller && this.isReaderIdentityCurrent?.() !== false;
    if (!current()) return;
    try {
      this.openFailureStage = 'chapter';
      this.detachOfflineProbe = this.offline ? this.runtime?.subscribeMangaOfflineProbe?.((state: string): void => {
        if (current()) this.offlineProbeStatus = state;
      }) : undefined;
      let index = this.chapterIndex;
      const startAtChapterFirst = !resumePosition && this.startAtChapterFirst && index !== undefined;
      let session = this.remoteSession;
      if (this.runtime !== undefined) {
        await controller.awaitPendingProgress(this.sourceId, this.bookId);
        if (!current()) return;
        let prepared = await new MangaSessionGateway(this.runtime).entry(this.sourceId, this.bookId, index, current, this.directoryTargetProof);
        if (!current()) return;
        if (prepared !== null) {
          if (this.expectedOfflineChapterId !== undefined && prepared.chapter.manifest.chapter.chapterId !== this.expectedOfflineChapterId) {
            throw new Error('MANGA_SESSION_IDENTITY_MISMATCH');
          }
          let catalogRecoveryAttempted = false;
          this.viewport.state.horizontalPage = startAtChapterFirst ? 0 : prepared.targetOrdinal;
          await controller.setPreviewMode(this.viewport.state.fitPreference === 'contain' || (this.viewport.state.fitPreference === 'source' && prepared.chapter.manifest.displayHints?.fit === 'contain'));
          if (!current()) return;
          await controller.openPrepared(prepared, this.offline, startAtChapterFirst);
          if (!current()) return;
          const preparedTargetOrdinal = startAtChapterFirst ? 0 : prepared.targetOrdinal;
          const target = prepared.chapter.manifest.pages.find(page => page.ordinal === preparedTargetOrdinal);
          const missingResource = target !== undefined && !prepared.chapter.resources.some(resource => resource.resourceRef === target.resourceRef);
          const failed = !this.offline && prepared.chapter.cached && missingResource ?
            controller.visiblePages().find(page => page.ordinal === preparedTargetOrdinal && page.status === 'failed') : undefined;
          if (failed?.error === 'REMOTE_READING_IMAGE_NOT_DOWNLOADED' || failed?.error === 'READING_IMAGE_REPROCESS_REQUIRED') {
            try {
              catalogRecoveryAttempted = true;
              // Cached pixels keep their fast/offline path. A missing old
              // resource may only renew through one fresh canonical catalog;
              // the normal controller open then preserves progress/recovery.
              const refreshed = await this.acquireCatalog(current, true);
              if (!current()) return;
              if (refreshed !== undefined && refreshed.contentKind === 'manga' &&
                refreshed.identity.sourceId === this.sourceId && refreshed.identity.bookId === this.bookId) {
                session = refreshed;
                if (refreshed.sourceVersion === prepared.chapter.manifest.sourceRuleVersion) {
                  // Restored same-version manifests may also omit expiring
                  // descriptors. Reuse the bounded refresh and exact Core
                  // anchor mapping; cacheFirst would return that same cache.
                  await controller.refreshChapter(preparedTargetOrdinal);
                  if (!current()) return;
                } else prepared = null;
              }
            } catch (_error) {
              if (!current()) return;
              // Disabled/deleted/unavailable sources cannot retire the old
              // cached entry or replace its specific image failure.
            }
          }
          if (prepared !== null) {
            const presentationRevision = MangaBookPresentation.revision;
            MangaBookPresentation.admitEntry(this.sourceId, this.bookId, prepared);
            if (MangaBookPresentation.revision !== presentationRevision)
              AppStorage.setOrCreate('readerMangaPresentationRevision', MangaBookPresentation.revision);
            this.opened = true; this.recovering = controller.recoveryRequired;
            this.viewport.publish();
            const saved = controller.savedLocation;
            const target = controller.displayedOrdinal;
            this.viewport.restore(target, !this.recovering && saved !== null && saved.pageId === controller.pageAt(target)?.pageId ? saved.y : 0,
              !this.recovering && saved !== null && saved.pageId === controller.pageAt(target)?.pageId ? saved.x : 0);
            // Catalog acquisition is optional background work after readable pixels.
            if (session !== undefined && session.identity.sourceId === this.sourceId && session.identity.bookId === this.bookId && session.contentKind === 'manga') {
              this.configureAdjacentChapter(session, controller); this.onRemoteSessionReady(session);
            }
            else if (this.remoteBookSeed !== undefined && !catalogRecoveryAttempted) {
              // Cached pixels already own their content fence. Metadata-only
              // bootstrap cannot reparse a catalog and revoke that owner.
              void this.acquirePreparedCatalog(prepared.chapter, current).then((catalog: RemoteReadingSession | undefined): void => {
                if (catalog !== undefined && current() && catalog.identity.sourceId === this.sourceId && catalog.identity.bookId === this.bookId && catalog.contentKind === 'manga') {
                  this.configureAdjacentChapter(catalog, controller); this.onRemoteSessionReady(catalog);
                }
              }).catch((): void => {});
            }
            return;
          }
        }
      }
      if (session === undefined && this.remoteBookSeed !== undefined) {
        this.openFailureStage = 'source';
        session = await this.acquireCatalog(current);
      }
      if (!current()) return;
      if (session !== undefined) {
        if (session.identity.sourceId !== this.sourceId || session.identity.bookId !== this.bookId || session.contentKind !== 'manga') throw new Error('MANGA_SESSION_IDENTITY_MISMATCH');
        this.onRemoteSessionReady(session);
      }
      if (index === undefined && this.runtime !== undefined) {
        const progress = await new MangaSessionGateway(this.runtime).progress(this.sourceId, this.bookId, current);
        index = session?.entries.find(entry => entry.url === progress.location?.chapter.chapterId &&
          (entry.navigable !== false || entry.resumeOnly === true))?.index ??
          session?.entries.find(entry => entry.navigable !== false && entry.url.trim().length > 0)?.index;
      }
      if (!current()) return;
      if (index === undefined) throw new Error('MANGA_CATALOG_REQUIRED');
      this.openFailureStage = 'chapter';
      await controller.open(this.sourceId, this.bookId, index, this.offline, this.chapterIndex === undefined,
        this.directoryTargetProof, startAtChapterFirst, this.expectedOfflineChapterId);
      if (!current()) return;
      await controller.setPreviewMode(this.viewport.effectiveFit() === 'contain', controller.displayedOrdinal);
      if (!current()) return;
      this.opened = true; this.recovering = controller.recoveryRequired;
      if (session !== undefined) this.configureAdjacentChapter(session, controller);
      this.viewport.publish();
      const saved = controller.savedLocation;
      if (!this.recovering && saved !== null && saved.chapter.chapterId === controller.chapter?.manifest.chapter.chapterId) {
        const ordinal = saved.pageOrdinalFallback;
        if (ordinal >= 0 && controller.pageAt(ordinal)?.pageId === saved.pageId) {
          if (this.viewport.state.horizontal) {
            this.viewport.state.horizontalPage = ordinal;
            this.viewport.data.projection.publish(controller.chapter!.manifest, (index: number) => controller.pageGeometry(index), ordinal, controller.totalPages, (pageOrdinal: number) => controller.pageAt(pageOrdinal));
            this.refreshLoginRequiredForControls();
            this.viewport.data.notify(true, 0, 0);
          }
          this.viewport.restore(ordinal, saved.y, saved.x);
        }
      } else this.viewport.updateViewport();
    } catch (error) {
      if (!current()) return;
      this.error = error instanceof Error ? error.message : '漫画加载失败';
      if (this.offline) {
        void controller.close().catch((): void => {});
        this.runtime?.finishMangaOfflineProbe?.(this.sourceId, this.bookId);
      }
    }
  }
  private async acquirePreparedCatalog(chapter: MangaChapterResult, current: () => boolean): Promise<RemoteReadingSession | undefined> {
    if (this.runtime === undefined || this.remoteBookSeed === undefined) return undefined;
    const manifest = chapter.manifest;
    const seed = this.remoteBookSeed;
    const cachedSeed: RemoteReadingBookSeed = { sourceId: seed.sourceId, bookId: seed.bookId, detailUrl: seed.detailUrl,
      title: seed.title, author: seed.author, authorIdentity: seed.authorIdentity, contentKind: 'manga',
      kind: seed.kind, coverUrl: seed.coverUrl, intro: seed.intro, lastChapter: seed.lastChapter,
      sourceVersion: manifest.sourceRuleVersion, searchVariables: seed.searchVariables };
    const catalog = await new RemoteReadingFlowGateway(this.runtime).openCachedCatalogSession(
      cachedSeed, current, !this.offline, true, true);
    if (!current() || catalog.identity.sourceId !== manifest.chapter.sourceId || catalog.identity.bookId !== manifest.chapter.bookId ||
      catalog.sourceVersion !== manifest.sourceRuleVersion || (!this.offline && catalog.requiresContextRefresh === true) ||
      [catalog.catalogVersion, catalog.contextVersion].some((version: string | undefined): boolean => version === undefined || version.trim().length === 0) ||
      catalog.entries.some((entry: RemoteReadingTocEntry): boolean => entry.proofState !== 'verified')) return undefined;
    const matches = catalog.entries.filter((entry: RemoteReadingTocEntry): boolean => entry.index === chapter.chapterIndex &&
      entry.url === manifest.chapter.chapterId && (entry.navigable !== false || entry.resumeOnly === true));
    return matches.length === 1 ? catalog : undefined;
  }
  private async acquireCatalog(current: () => boolean, forceRefresh: boolean = false): Promise<RemoteReadingSession | undefined> {
    if (this.runtime === undefined || this.remoteBookSeed === undefined) return undefined;
    if (this.offline) {
      // Already admitted manga identity; only read Core's durable catalog. A
      // missing/invalid cached catalog must never fall through to online acquire.
      if (this.remoteBookSeed.contentKind !== undefined && this.remoteBookSeed.contentKind !== 'manga')
        throw new Error('MANGA_SESSION_IDENTITY_MISMATCH');
      const cached = await new RemoteReadingFlowGateway(this.runtime).openCachedCatalogSession(this.remoteBookSeed, current, false, true);
      cached.contentKind = 'manga';
      return cached;
    }
    return this.runtime.bookAcquisitions?.().acquireBook(this.remoteBookSeed, { isCurrent: current, forceRefresh });
  }
  private configureAdjacentChapter(session: RemoteReadingSession, controller: MangaSessionController): void {
    const chapter = controller.chapter;
    if (chapter === undefined || this.offline || session.acquisitionMode === 'offline' || session.requiresContextRefresh === true ||
      session.contentKind !== 'manga' || session.identity.sourceId !== chapter.manifest.chapter.sourceId ||
      session.identity.bookId !== chapter.manifest.chapter.bookId ||
      (session.sourceVersion !== undefined && session.sourceVersion !== chapter.manifest.sourceRuleVersion) ||
      this.runtime?.hasCurrentCatalogProjection?.(session) === false) {
      controller.configureNextChapter(); return;
    }
    const matching = session.entries.filter(entry => entry.index === chapter.chapterIndex && entry.url === chapter.manifest.chapter.chapterId);
    if (matching.length !== 1) { controller.configureNextChapter(); return; }
    const position = session.entries.indexOf(matching[0]);
    const next = session.entries.slice(position + 1).find(entry => entry.navigable !== false && entry.url.trim().length > 0 && entry.url !== chapter.manifest.chapter.chapterId);
    controller.configureNextChapter(next?.index, next?.url);
  }
  private notifyPreparationFailure(): void {
    const failure = this.controller?.preparationError;
    if (failure === undefined) { this.preparationFailureNoticeKey = ''; return; }
    // Background whole-chapter preparation cannot replace admitted pixels
    // with a persistent global error. The original More actions remain.
    if (!this.opened || !this.chrome.readerPanelForeground()) return;
    const key = `${this.controller?.chapter?.manifest.manifestVersion ?? ''}\u0000${failure}`;
    if (key === this.preparationFailureNoticeKey) return;
    try {
      if (this.transientFeedback.show(() => this.getUIContext(),
        { message: this.displayError(failure), duration: READER_FEEDBACK_BRIEF_MS, key },
        (): boolean => this.opened && this.chrome.readerPanelForeground())) {
        this.preparationFailureNoticeKey = key;
      }
    } catch (_) { /* Feedback cannot interrupt chapter projection. */ }
  }
  private loginRequired(): boolean {
    if (this.offline) return false;
    const errors = [this.error];
    if (this.viewport.data.totalCount() > this.viewport.first) errors.push(this.viewport.imageError(this.viewport.data.getData(this.viewport.first)));
    return errors.some(code => code === 'READING_IMAGE_AUTH_REQUIRED' || code === 'READING_IMAGE_ACCESS_DENIED');
  }
  private async loginAndRetry(): Promise<void> {
    if (!this.mounted || this.exiting || this.loggingIn || !this.loginRequired() ||
      this.controller === undefined || this.viewport.data.totalCount() <= this.viewport.first) return;
    const controller = this.controller;
    const row = this.viewport.data.getData(this.viewport.first);
    const chapter = controller.chapter;
    const manifestVersion = chapter?.manifest.manifestVersion;
    const first = this.viewport.first;
    const openingError = this.error;
    const generation = ++this.loginGeneration;
    let retryDispatched = false;
    const current = (): boolean => {
      if (!this.mounted || this.exiting || this.offline || this.appForeground === false || this.windowChromeActive === false ||
        this.windowChromeOverlayActive || this.isReaderIdentityCurrent?.() === false || generation !== this.loginGeneration ||
        this.controller !== controller || controller.chapter !== chapter || controller.chapter?.manifest.manifestVersion !== manifestVersion ||
        this.viewport.first !== first || this.viewport.data.totalCount() <= first) return false;
      const visible = this.viewport.data.getData(first);
      if (visible.ordinal !== row.ordinal || visible.tileIndex !== row.tileIndex) return false;
      // A successful page retry may materialize its own placeholder geometry.
      if (retryDispatched && !row.known && visible.known) return true;
      return visible.key === row.key && visible.known === row.known;
    };
    this.loggingIn = true;
    try {
      await this.onLoginSource();
      if (!current()) return;
      retryDispatched = true;
      await (row.known ? controller.retryTile(row.ordinal, row.tileIndex) : controller.retry(row.ordinal));
      if (!current()) return;
      if (this.error === openingError) this.error = '';
      await this.viewport.updateViewport();
    } catch (error) {
      const message = error instanceof Error ? error.message : '漫画登录失败';
      if (message !== 'MANGA_SESSION_CANCELLED' && current() && this.error === openingError) this.error = message;
    }
    finally { if (this.mounted && generation === this.loginGeneration) this.loggingIn = false; }
  }
  private async refreshImages(): Promise<void> {
    const controller = this.controller;
    const chapter = controller?.chapter;
    if (controller === undefined || chapter === undefined || this.refreshing || !this.chrome.readerPanelForeground()) return;
    this.refreshing = true;
    this.viewport.pendingTurnOrdinal = undefined; this.viewport.mountedTurnRowKey = '';
    const generation = ++this.presentationGeneration;
    const current = (): boolean => this.mounted && !this.exiting && this.controller === controller && this.isReaderIdentityCurrent();
    const feedbackCurrent = (): boolean => current() && this.opened && this.chrome.readerPanelForeground();
    const preserveNewerPosition = (): boolean => {
      const manifest = controller.chapter?.manifest;
      return generation !== this.presentationGeneration && manifest !== undefined &&
        manifest.manifestVersion === chapter.manifest.manifestVersion &&
        manifest.chapter.sourceId === chapter.manifest.chapter.sourceId &&
        manifest.chapter.bookId === chapter.manifest.chapter.bookId &&
        manifest.chapter.chapterId === chapter.manifest.chapter.chapterId;
    };
    try {
      await this.viewport.saveVisible();
      if (!current() || controller.chapter !== chapter || generation !== this.presentationGeneration) return;
      await controller.refreshChapter();
      if (!current()) return;
      if (controller.replacementRecoveryRequired) {
        // The old chapter remains displayed until the existing recovery action
        // explicitly selects the complete new chapter. Keep its pixels/anchor.
        this.error = ''; this.recovering = true;
        return;
      }
      if (preserveNewerPosition()) return;
      await controller.setPreviewMode(this.viewport.effectiveFit() === 'contain', controller.displayedOrdinal);
      if (!current() || preserveNewerPosition()) return;
      this.error = ''; this.recovering = controller.recoveryRequired;
      const saved = !this.recovering ? controller.savedLocation : null;
      const ordinal = controller.displayedOrdinal;
      this.viewport.state.horizontalPage = ordinal;
      this.viewport.visibleAnchor = undefined;
      this.viewport.publish();
      this.viewport.restore(ordinal, saved?.y ?? 0, saved?.x ?? 0);
      const installed = controller.chapter;
      if (installed !== undefined && installed.manifest.manifestVersion !== chapter.manifest.manifestVersion &&
        !this.recovering && this.error.length === 0) {
        this.transientFeedback.show(() => this.getUIContext(), { message: '本章已更新' },
          (): boolean => feedbackCurrent() && controller.chapter === installed);
      }
    } catch (error) {
      if (!current() || (error instanceof Error && error.message === 'MANGA_SESSION_CANCELLED')) return;
      const displayed = controller.chapter;
      const message = displayed === chapter ? '刷新未完成，已保留当前内容。' : '刷新显示未完成，请重试。';
      this.transientFeedback.show(() => this.getUIContext(), { message },
        (): boolean => feedbackCurrent() && controller.chapter === displayed);
    } finally {
      if (this.mounted && this.controller === controller) this.refreshing = false;
    }
  }
  private displayError(code: string): string {
    if (code === 'MANGA_CHAPTER_CACHE_CAPACITY') return '整章加载已暂停，缓存空间不足，可清理缓存或下载保留。';
    if (code === 'MANGA_CHAPTER_PREPARATION_FAILED') return '整章加载暂未完成，已加载的内容仍可阅读。';
    const message = mangaUserError(code);
    if (message !== code) {
      const diagnostic = diagnosticCodeOf(code);
      if (!this.reportedErrorCodes.has(diagnostic)) {
        this.reportedErrorCodes.add(diagnostic);
        hilog.warn(0x5244, 'Reader', 'Manga image unavailable: %{public}s', diagnostic);
      }
    }
    return message;
  }
  private async handleBack(intent?: 'navigation'): Promise<void> {
    if (!this.mounted || this.isReaderIdentityCurrent?.() === false) return;
    if (intent !== 'navigation' && !this.chrome.readerPanelForeground()) return;
    if (intent === 'navigation') this.navigationExitRequested = true;
    if (this.exiting) return;
    if (intent !== 'navigation') {
      if (this.boundary.state.boundaryBusy || this.boundary.boundaryDragging) { await this.boundary.cancelBoundaryChapter(); return; }
      if (this.panel.length > 0 || this.chrome.state.panelPhase === 'preparing') { void this.chrome.closePanel(); return; }
      if (this.chapterEnd) { this.chapterEnd = false; return; }
      if (this.viewport.state.zoom > 1) { this.viewport.changeZoom(1); return; }
    }
    this.exiting = true;
    let delivered = false;
    try {
      if (this.boundary.state.boundaryBusy || this.boundary.boundaryDragging) await this.boundary.cancelBoundaryChapter();
      await this.chrome.performPanelAction(async (): Promise<void> => {
        if (!this.mounted || this.isReaderIdentityCurrent?.() === false) return;
        const controller = this.controller;
        await controller?.close();
        if (!this.mounted || this.controller !== controller || this.isReaderIdentityCurrent?.() === false) return;
        this.onBack();
        delivered = true;
      }, (): boolean => this.navigationExitRequested);
    } catch (error) {
      if (this.mounted && this.isReaderIdentityCurrent?.() !== false)
        this.error = error instanceof Error ? error.message : '漫画退出未完成';
    }
    const navigationRequested = this.navigationExitRequested;
    this.navigationExitRequested = false;
    if (delivered) return;
    this.exiting = false;
    if (navigationRequested && this.mounted && this.isReaderIdentityCurrent?.() !== false) this.onExitCancelled();
  }
  private syncSmartGestureMonitor(): void {
    if (!this.mounted || !this.appForeground || !this.windowChromeActive || !this.smartGestureSettings.enabled ||
      !this.isReaderIdentityCurrent()) {
      this.smartGestureHost.detach();
      return;
    }
    try {
      this.smartGestureHost.attach(this.getUIContext(), {
        decide: (gesture: ReaderSmartGesture): ReaderSmartGestureAction => this.viewport.smartGestureDecision(gesture),
        dispatch: (action: ReaderSmartGestureAction): void => this.viewport.dispatchSmartGesture(action),
      });
    } catch (_) { this.smartGestureHost.detach(); }
  }
  private async openSourceSwitch(): Promise<void> {
    if (!this.chrome.readerPanelForeground()) return;
    await this.chrome.performPanelAction((): void => {
      if (this.chrome.readerPanelForeground()) this.onSwitchSource(sourceSwitchTriggerFocusId(this.sourceId, this.bookId, 'manga-source'));
    });
  }
  private retry(row: MangaStripRow): void {
    if (this.viewport.imageError(row) === 'MANGA_SESSION_CONTENT_CHANGED') {
      void this.reopenChangedChapter();
      return;
    }
    const controller = this.controller;
    const chapter = controller?.chapter;
    const generation = this.presentationGeneration;
    const previousError = this.error;
    const previousRowError = this.viewport.imageError(row);
    const current = (): boolean => this.mounted && this.controller === controller &&
      controller?.chapter === chapter && generation === this.presentationGeneration;
    const task = row.known ? controller?.retryTile(row.ordinal, row.tileIndex) : controller?.retry(row.ordinal);
    task?.then(async (): Promise<void> => {
      if (!current()) return;
      await this.viewport.updateViewport();
      // A successful tile retry replaces the failed presentation. Clear only
      // the global error that belongs to this same failed tile; unrelated
      // settings/save errors remain visible to the reader.
      if (current() && this.error === previousError && !this.viewport.rowHasError(row) &&
        (previousError.length === 0 || previousError === previousRowError)) this.error = '';
    }).catch((error: Error): void => { if (current() && error.message !== 'MANGA_SESSION_CANCELLED') this.error = error.message; });
  }
  private retryLabel(row: MangaStripRow): string {
    return this.viewport.imageError(row) === 'MANGA_SESSION_CONTENT_CHANGED' ? '重新打开本章' : '重试';
  }
  private async reopenChangedChapter(): Promise<void> {
    const controller = this.controller;
    if (!this.mounted || controller === undefined || this.openingRetry) return;
    this.resumeChangedContent = true;
    this.openingRetry = true; this.opened = false; this.error = '';
    this.presentationGeneration++; this.viewport.viewportGeneration++;
    this.viewport.first = 0; this.viewport.last = 0; this.viewport.viewportRangeObserved = false;
    this.viewport.visibleAnchor = undefined; this.viewport.confirmedPosition = undefined;
    this.viewport.publishedManifestVersion = ''; this.viewport.publishedRowKeys.clear();
    this.detachOfflineProbe?.(); this.detachOfflineProbe = undefined;
    controller.close('chapter');
    try { await this.open(controller, true); }
    finally { if (this.mounted && this.controller === controller) this.openingRetry = false; }
  }
  private async retryOpen(): Promise<void> {
    const controller = this.controller;
    if (controller === undefined || !this.mounted || this.opened || this.openingRetry) return;
    this.openingRetry = true;
    this.error = '';
    this.detachOfflineProbe?.(); this.detachOfflineProbe = undefined;
    controller.close('chapter');
    try {
      if (this.mounted && this.controller === controller) await this.open(controller, this.resumeChangedContent);
    } finally {
      if (this.mounted && this.controller === controller) this.openingRetry = false;
    }
  }
  private async confirmRecovery(): Promise<void> {
    const controller = this.controller;
    if (!this.recovering || controller === undefined || this.viewport.data.totalCount() <= this.viewport.first) return;
    const ordinal = this.viewport.data.getData(this.viewport.first).ordinal;
    const generation = this.presentationGeneration;
    const current = (): boolean => this.mounted && this.controller === controller &&
      generation === this.presentationGeneration;
    try {
      if (controller.replacementRecoveryRequired) {
        await controller.confirmReplacement();
        if (!current()) return;
        this.viewport.visibleAnchor = undefined; this.viewport.publish(); this.viewport.restore(0, 0, 0);
      } else await controller.selectPage(ordinal);
      if (!current()) return;
      // A signed-image retry may replace the manifest during confirmation.
      // The controller retains recovery until that newer identity is proven.
      this.recovering = controller.recoveryRequired;
      if (!this.recovering) await this.viewport.saveVisible();
    } catch (error) {
      const message = error instanceof Error ? error.message : '漫画加载失败';
      if (current() && message !== 'MANGA_SESSION_CANCELLED') this.error = message;
    }
  }
  private onErrorPresentationChanged(): void {
    this.onWindowChromeChanged();
    this.notifyOpenedError();
  }
  private notifyOpenedError(): void {
    if (this.error.length === 0) { this.openedErrorNoticeKey = ''; return; }
    if (!this.opened || !this.chrome.readerPanelForeground() || this.error === 'MANGA_SESSION_CANCELLED') return;
    // Image failures stay with their own logical image. Preserve the error
    // fact for the existing login/recovery decisions without a global alert.
    for (let index = Math.max(0, this.viewport.first); index <= this.viewport.requestedLast(); index++) {
      const row = this.viewport.data.getData(index);
      if (this.viewport.rowHasError(row) && this.viewport.imageError(row) === this.error) return;
    }
    const key = JSON.stringify([this.sourceId, this.bookId, this.controller?.chapter?.manifest.manifestVersion,
      this.presentationGeneration, this.error]);
    if (key === this.openedErrorNoticeKey) return;
    if (this.transientFeedback.show(() => this.getUIContext(), { message: this.displayError(this.error), key },
      (): boolean => this.opened && this.chrome.readerPanelForeground())) {
      this.openedErrorNoticeKey = key;
    }
  }
  private refreshLoginRequiredForControls(): void {
    if (!this.mounted) return;
    const required = this.loginRequired();
    if (required !== this.loginRequiredForControls) this.loginRequiredForControls = required;
  }
  private onReaderWindowOwnershipChanged(): void {
    this.onPanelForegroundChanged();
    this.onWindowChromeChanged();
  }
  private onReaderInteractionBlockedChanged(): void {
    this.onPanelForegroundChanged();
    if (this.mounted && this.interactionBlocked && (this.boundary.state.boundaryBusy || this.boundary.boundaryDragging)) {
      void this.boundary.cancelBoundaryChapter().catch((): void => {});
    }
  }
  private onWindowChromeChanged(): void {
    if ((this.boundary.state.boundaryBusy || this.boundary.boundaryDragging) && (!this.windowChromeActive || this.windowChromeOverlayActive))
      void this.boundary.cancelBoundaryChapter().catch((): void => {});
    if (!this.mounted || this.isReaderIdentityCurrent?.() === false) return;
    this.refreshLoginRequiredForControls();
    this.applyWindowChrome();
    this.applyWindowPolicyForChromeOwner();
  }
  private applyWindowChrome(): void {
    if (!this.mounted || this.isReaderIdentityCurrent?.() === false) return;
    if (!this.windowChromeActive) { this.restoreAppWindowChrome(); return; }
    this.windowChromeOwned = true;
    // A phone panel authors one animated scrim across the full window. Let
    // that paint reach the system bands throughout opening, drag and closing;
    // ordinary controls and the unmasked wide panel keep their opaque paper.
    const presented = this.chrome.controlsPresentedForWindow() || this.chapterEnd || this.windowChromeOverlayActive;
    const authoredPhoneMask = !this.windowChromeOverlayActive && this.panel.length > 0 && !this.chrome.widePanel();
    const style = new ReaderWindowChromeStyle(this.chrome.paperColor(),
      this.backgroundPreference === 'ink' ? 'light' : 'dark', this.chrome.inkColor(), '', !presented || authoredPhoneMask);
    if (this.windowChromeOverlayActive) ReaderWindowCoordinator.requestOverlayChrome(style);
    else ReaderWindowCoordinator.requestReaderChrome(style);
  }
  private applyWindowPolicyForChromeOwner(): void {
    if (!this.mounted || this.isReaderIdentityCurrent?.() === false) return;
    if (!this.windowChromeActive) { this.restoreAppWindowChrome(); return; }
    this.windowChromeOwned = true;
    const presented = this.chrome.controlsPresentedForWindow() || this.chapterEnd || this.windowChromeOverlayActive;
    // Manga retains the existing default orientation/awake semantics. These
    // runtime visibility requests never write reading settings/preferences.
    void ReaderWindowCoordinator.requestReaderWindowPolicy(
      new ReaderWindowPolicy('system', false, !presented, !presented, true))
      .catch((error: Error): void => {
        hilog.warn(0x5244, 'Reader', 'Manga system bars: %{private}s', error.message);
      });
  }
  private restoreAppWindowChrome(): void {
    const owned = this.windowChromeOwned;
    this.windowChromeOwned = false;
    if (!owned || this.isReaderIdentityCurrent?.() === false) return;
    ReaderWindowCoordinator.requestAppChrome();
    void ReaderWindowCoordinator.requestAppWindowPolicy()
      .catch((error: Error): void => {
        hilog.warn(0x5244, 'Reader', 'Manga window restore: %{private}s', error.message);
      });
  }
  private onPanelForegroundChanged(): void {
    this.syncSmartGestureMonitor();
    if (!this.mounted || this.chrome.readerPanelForeground()) return;
    this.chrome.invalidatePanelFocus();
    this.pageTurnInputRevision += 1;
    this.viewport.clearPageSliderPreview();
    this.viewport.pinchAnchor = undefined;
    this.chrome.dropForegroundPanelInput();
  }
  private windowInteractiveInsets(_revision: number): ReaderInsetsVp {
    const metrics = ReaderWindowCoordinator.metrics();
    const insets = readerInteractiveSafeInsets(metrics);
    // Native visibility can resolve before avoidAreaChange. Use the same
    // geometry's measured status band for interactive overlays, never Canvas.
    if (this.chrome.controlsPresentedForWindow() || this.chapterEnd || this.windowChromeOverlayActive) {
      insets.top = Math.max(insets.top, metrics.statusBarRect.top + metrics.statusBarRect.height);
      insets.bottom = readerStableInteractiveSafeBottom(metrics);
    }
    return insets;
  }
  private interactiveInsets(revision: number): ReaderInsetsVp {
    const insets = this.windowInteractiveInsets(revision);
    // The persistent directory owns the window's left edge. Do not apply that
    // same cutout twice to the adjacent image/control column.
    if (this.directory.persistentDirectory() && this.panel !== 'directory') insets.left = Math.max(0, insets.left - this.directory.directoryColumnWidth());
    return insets;
  }
  @Builder
  private chapterLoadState() {
    Column() {
      ReaderPageState({ loading: this.error.length === 0 || this.openingRetry,
        inkColor: this.chrome.inkColor(), mutedColor: this.chrome.mutedColor(),
        title: this.error.length === 0 || this.openingRetry ? '' :
          (this.openFailureStage === 'source' ? '书源加载失败' : '章节加载失败'),
        message: this.error.length === 0 || this.openingRetry ? '正在载入章节…' : this.displayError(this.error),
        actionLabel: this.controller === undefined ? '' : '重试', onAction: (): void => {
          if (this.chrome.readerPanelForeground()) void this.retryOpen();
        },
        secondaryActionLabel: '切换书源', onSecondaryAction: (): void => { void this.openSourceSwitch(); } });
    }.width('100%').height('100%').justifyContent(FlexAlign.Center)
      .padding(this.interactiveInsets(this.windowMetricsRevision));
  }
  // Custom child slots use this mounted ViewPU as their render receiver.
  @Builder
  private renderViewportImages() {
    MangaImageViewport({ host: this.viewport });
  }
  @Builder
  private renderBoundaryHint() {
    MangaBoundaryHint({ host: this.boundary });
  }
  @Builder
  private renderDirectoryFallback(catalog: boolean, identity: string) {
    MangaDirectoryFallback(this.directory, catalog, identity);
  }
  @Builder
  private renderTopBarBack() {
    MangaTopBarBackContent({ host: this.chrome });
  }
  @Builder
  private renderTopBarActions() {
    MangaTopBarActionsContent({ host: this.chrome });
  }
  @Builder
  private renderActionPanelHeader(opening: number) {
    MangaActionPanelHeader(this.chrome, opening);
  }
  @Builder
  private renderActionPanelBody(opening: number) {
    MangaActionPanelBody(this.chrome, opening);
  }
  build() {
    Column() {
      Row() {
        if (this.directory.persistentDirectory() && this.panel !== 'directory') { MangaTabletDirectory({host: this.directory }); }
        Stack({ alignContent: Alignment.Center }) {
          Stack({ alignContent: Alignment.Center }) {
            MangaBoundaryViewport({host: this.viewport });
            if (!this.opened) { this.chapterLoadState(); }
            if (this.boundary.state.previousChapterPixels.length > 0) { MangaRetainedChapterPixels({host: this.boundary }); }
            if (this.opened && this.chrome.state.showPageNumbers && !this.chapterEnd && !this.boundary.state.boundaryBusy) MangaPageBadge({host: this.chrome });
            if (this.chrome.controlsPresentedForWindow() && !this.boundary.state.boundaryBusy) {
              MangaReaderChromeContent({ host: this.chrome });
            }
            MangaRefreshProgress({host: this.chrome });
            MangaRecoveryOverlay({host: this.chrome });
          }.width('100%').height('100%')
            .id(`reader-manga-stage:${this.sourceId}:${this.bookId}`)
            .focusable(true)
            .defaultFocus(true)
            .onKeyEvent((event: KeyEvent): boolean => this.viewport.onReaderKeyEvent(event))
            .attributeModifier(new ReaderSmartGestureShortcut(this.smartGestureSettings.enabled))
            .onAppear((): void => this.syncSmartGestureMonitor())
            .enabled(this.chrome.phonePanelBackgroundEnabled())
            .accessibilityLevel(this.chrome.phonePanelBackgroundEnabled() ? 'auto' : 'no-hide-descendants');
          // The chapter-end actions remain operable while the covered phone
          // viewport releases touch, gesture and accessibility input.
          if (this.chapterEnd) { MangaChapterEndContent({host: this.chrome }); }
          if (this.panel.length > 0) {
            ForEach([this.chrome.state.actionPanelPresentationGeneration], (opening: number): void => {
              MangaPanelOverlay(this.chrome, this.directory.directoryOuterIdentity(), opening);
            }, (opening: number): string => opening.toString());
          }
        }.layoutWeight(1).height('100%');
      }.width('100%').height('100%').onAreaChange((_old: Area, area: Area): void => {
        const width = Number(area.width), height = Number(area.height);
        if (Number.isFinite(width) && width > 0) this.stageWidth = width;
        if (Number.isFinite(height) && height > 0) this.stageHeight = height;
        this.onWindowChromeChanged();
      });
    }.width('100%').height('100%').backgroundColor(this.chrome.paperColor())
      // Both drawing and child layout fill the window. System-bar visibility
      // changes only overlay insets, never image fit, row geometry or scroll.
      .expandSafeArea([SafeAreaType.SYSTEM, SafeAreaType.CUTOUT],
        [SafeAreaEdge.TOP, SafeAreaEdge.BOTTOM, SafeAreaEdge.START, SafeAreaEdge.END])
      .ignoreLayoutSafeArea([LayoutSafeAreaType.SYSTEM], [LayoutSafeAreaEdge.ALL]);
  }
}
