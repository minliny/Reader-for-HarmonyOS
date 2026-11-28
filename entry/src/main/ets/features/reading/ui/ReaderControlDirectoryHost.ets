import type { ReaderReadingControlInteractionHost } from './ReaderReadingControlInteractionHost';
import type { ReaderReadingPlaybackFlowHost } from './ReaderReadingPlaybackFlowHost';
import { ReaderWindowCoordinator } from '../../../app/ReaderWindowCoordinator';
import type { ReaderAutoPageState } from './ReaderAutoPageState';
import type { LocalReadingTocEntry } from '../application/LocalReadingFlowTypes';
import { formatReaderAutoPageFullTimerSummary, type ReaderAutoPageFullConfiguration } from './ReaderAutoPageFullState';
import { createReaderTtsState, type ReaderTtsState } from '../application/ReaderTtsState';
import type { ReaderReadingMountHost } from './ReaderReadingMountHost';
import type { ReaderReadingPageChromeHost } from './ReaderReadingPageChromeHost';
import type { ReadingChromeRenderSnapshot, ReadingOverlayRenderSnapshot,
  ReadingPageTurnRenderSnapshot, ReadingSessionRenderSnapshot } from './ReaderReadingSurfaceHost';
import vibrator from '@ohos.vibrator';
import type { ReaderReadingSpeechHost } from './ReaderReadingSpeechHost';
import type { ReaderReadingProgressHost } from './ReaderReadingProgressHost';
import type { ReaderPageTurnInputHost } from './ReaderPageTurnInputHost';
import type { ReaderAuxiliarySessionHost } from './ReaderAuxiliarySessionHost';
import type { ReaderBrightnessSession } from './ReaderBrightnessSession';
import type { ReaderBookmarkInteractionHost } from './ReaderBookmarkInteractionHost';
import type { ReaderReadingContentMutationHost } from './ReaderReadingContentMutationHost';
import type { ReaderControlDirectoryOperationsHost } from './ReaderControlDirectoryOperationsHost';
import type { ReaderReadingRecoveryHost } from './ReaderReadingRecoveryHost';
import { admitReaderControlVisualSnapshot } from './ReaderControlVisualHostPort';
import type { ReaderControlNavigationIntent } from './ReaderControlPresentationCoordinator';
import { readerControlHostCloseCommitted, readerControlHostClosing, readerControlHostPage, readerControlHostVisible } from './ReaderControlHostSession';
import type { ReaderControlGeometryHost } from './ReaderControlGeometryHost';
import type { ReaderReadingPreferencesHost } from './ReaderReadingPreferencesHost';
import type { ReaderPageTurnPreparationHost } from './ReaderPageTurnPreparationHost';
import type { ReaderControlReplacePanel } from '../presentation/ReaderControlReplacePanel';
import type { ReaderControlVerificationSession } from './ReaderControlVerificationSession';
import type { ReaderBookIdentity } from '../presentation/ReaderBookmarkProjection';
import type { ReadingDirectoryRecovery } from '../presentation/ReadingDirectoryRecovery';
import type { ReaderDirectoryChapterStartBookmarkRequest } from '../presentation/ReaderDirectoryMarkerState';
import type { ReaderControlPage } from './ReaderControlRouting';
import type { ReaderContentSearchPublication } from '../presentation/ReaderContentSearchPublication';
import type { ReaderControlLocation } from './ReaderControlSessionState';
import { copyReaderControlSessionState, createReaderControlSessionState, readerControlContentLocation, type ReaderControlSessionState } from './ReaderControlSessionState';
import { ReaderControlPanel } from './ReaderControlPanel';
import {
  ReaderControlPanelFrame, defaultReaderControlIntent, type ReaderControlIntent, type ReaderControlIntentHandler, type ReaderControlIntentResult,
  type ReaderControlGeometrySnapshot, type ReaderControlLaunchSnapshot, type ReaderControlDocumentSnapshot,
  type ReaderControlPreferencesSnapshot, type ReaderControlPlaybackSnapshot,
} from './ReaderControlPanelNativeContract';

/** The native two-way link becomes the authoritative writer once it mounts.
 * A route can still commit control ownership before the first native frame. */
export interface ReaderControlDirectoryLifecycle {
  readonly publish: (session: ReaderControlSessionState) => void;
  readonly preferences: () => ReaderReadingPreferencesHost;
  readonly geometry: () => ReaderControlGeometryHost;
  readonly verification: () => ReaderControlVerificationSession;
  readonly openRevision: () => number;
  readonly cancelAutomaticStart: () => void;
  readonly scheduleSpeechFollow: () => void;
  readonly publishClosing: (closing: boolean) => void;
  readonly windowOwnedByControl: () => boolean;
  readonly preparation: () => ReaderPageTurnPreparationHost;
  readonly search: () => ReaderContentSearchPublication;
  readonly bumpSearchRevision: () => void;
  readonly replace: () => ReaderControlReplacePanel;
  readonly preparePage: (page: ReaderControlPage) => void;
  readonly resetSearch: () => void;
  readonly canResumeReading: () => boolean;
  readonly resumeAutomatic: () => void;
}

/** Keeps session admission and the sparse native visual sample in the same owner.
 * The visual sample is consulted by Back and close without invalidating paper. */
export class ReaderControlDirectorySession {
  private session: ReaderControlSessionState;
  private visual: ReaderControlSessionState = createReaderControlSessionState();
  private nativeWrite: ((session: ReaderControlSessionState) => void) | undefined = undefined;
  private observedPage: ReaderControlPage = 'home';
  private observedModule: string = 'home';
  private closeRevision: number = 0;
  private visit: number = 0;
  private readonly lifecycle: ReaderControlDirectoryLifecycle;
  private controlPanelFrame: ReaderControlPanelFrame | undefined = undefined;
  private readonly hiddenTtsState: ReaderTtsState = createReaderTtsState(false);

  constructor(initial: ReaderControlSessionState, lifecycle: ReaderControlDirectoryLifecycle) {
    this.session = initial;
    this.lifecycle = lifecycle;
  }

  read(): ReaderControlSessionState { return this.session; }
  visualSession(): ReaderControlSessionState { return this.visual; }
  visitRevision(): number { return this.visit; }

  panelFrame(input: ReaderNativeControlFrameInput): ReaderControlPanelFrame {
    const frame = readerNativeControlFrame(input, this.controlPanelFrame, this.hiddenTtsState);
    this.controlPanelFrame = frame;
    return frame;
  }


  beginMount(): void {
    this.controlPanelFrame = undefined;
    this.copyVisual(this.session);
    this.closeRevision = 0;
    this.observedPage = 'home';
    this.observedModule = 'home';
  }

  copyVisual(session: ReaderControlSessionState): void { this.visual = copyReaderControlSessionState(session); }

  admitVisual(session: ReaderControlSessionState): void {
    admitReaderControlVisualSnapshot(session, {
      presentedForWindow: (): boolean => this.lifecycle.windowOwnedByControl(),
      capture: (snapshot: ReaderControlSessionState): void => { this.visual = snapshot; },
      closing: (closing: boolean): void => this.lifecycle.publishClosing(closing),
      chromeOwnerChanged: (): void => this.lifecycle.preferences().applyWindowPolicyForChromeOwner(),
    });
  }

  acceptMeasuredVisit(location: ReaderControlLocation, intent: ReaderControlNavigationIntent, source: ReaderControlSessionState,
    session: ReaderControlSessionState, clearIntent: () => void): ReaderControlPage | undefined {
    const previous = this.observedModule;
    this.visit = intent.moduleVisitRevision;
    this.observedModule = location.level === 'secondary' ? location.module : 'home';
    clearIntent();
    this.lifecycle.verification().accept(intent.verificationOrigin, source, session, this.lifecycle.openRevision());
    this.request(session);
    return previous === this.observedModule ? undefined : readerControlHostPage(this.session);
  }

  connect(write: (session: ReaderControlSessionState) => void): () => void {
    this.nativeWrite = write;
    return (): void => {
      if (this.nativeWrite === write) this.nativeWrite = undefined;
    };
  }

  request(session: ReaderControlSessionState): void {
    if (this.nativeWrite !== undefined) this.nativeWrite(session);
    else if (this.session !== session) this.admit(session);
  }

  admit(session: ReaderControlSessionState): void {
    this.session = session;
    this.lifecycle.publish(session);
    this.applySession();
  }

  private applySession(): void {
    const host = this.lifecycle;
    const geometry = host.geometry();
    geometry.fontOrder.reconcile();
    host.verification().observeHostState(this.session, host.openRevision());
    if (readerControlHostVisible(this.session)) host.cancelAutomaticStart();
    else host.scheduleSpeechFollow();
    this.copyVisual(this.session);
    host.publishClosing(readerControlHostClosing(this.session));
    host.preferences().applyWindowPolicyForChromeOwner();
    if (readerControlHostVisible(this.session)) host.preparation().suspend();
    const page = readerControlHostPage(this.session);
    const previous = this.observedPage;
    if (page !== previous) {
      this.observedPage = page;
      if ((previous === 'quickSearch' || previous === 'fullSearch') &&
        page !== 'quickSearch' && page !== 'fullSearch' && host.search().retirePresentation()) host.bumpSearchRevision();
      if (previous === 'quickReplace' && page !== 'quickReplace') host.replace().advancePanel();
    }
    const location = readerControlContentLocation(this.session);
    const module = location.level === 'secondary' ? location.module : 'home';
    if (module !== this.observedModule) {
      this.visit += 1;
      this.observedModule = module;
      host.preparePage(page);
    }
    geometry.minimum.invalidateLayout();
    if (!readerControlHostCloseCommitted(this.session, this.closeRevision)) return;
    this.closeRevision = this.session.closeRevision;
    geometry.invalidateBackdrop();
    // A native drag may land without a control-dismiss command.
    geometry.hideKeyboardIfVisible();
    geometry.dismissTemporaryLayers();
    host.search().cancel();
    host.replace().advancePanel();
    host.resetSearch();
    if (host.canResumeReading()) {
      host.preparation().drain();
      host.resumeAutomatic();
    }
  }
}

@Component
export struct ReaderControlDirectoryHost {
  owner!: ReaderControlDirectorySession;
  onIntent!: ReaderControlIntentHandler;
  @ObjectLink frame: ReaderControlPanelFrame;
  @State @Watch('onNativeControlSessionChanged') private controlSession: ReaderControlSessionState = createReaderControlSessionState();
  private detach: (() => void) | undefined = undefined;

  aboutToAppear(): void {
    this.controlSession = this.owner.read();
    this.detach = this.owner.connect((session: ReaderControlSessionState): void => { this.controlSession = session; });
  }

  aboutToDisappear(): void {
    this.detach?.();
    this.detach = undefined;
  }

  private onNativeControlSessionChanged(): void {
    if (this.detach !== undefined) this.owner.admit(this.controlSession);
  }

  build() {
    ReaderControlPanel({
      panelFrame: this.frame,
      controlSession: $controlSession,
      onIntent: this.onIntent,
    });
  }
}

export interface ReaderNativeControlActors {
  readonly interaction: ReaderReadingControlInteractionHost;
  readonly playback: ReaderReadingPlaybackFlowHost;
  readonly replace: ReaderControlReplacePanel;
  readonly session: ReaderControlDirectorySession;
  readonly geometry: ReaderControlGeometryHost;
  readonly recovery: ReaderReadingRecoveryHost;
  readonly directory: ReaderControlDirectoryOperationsHost;
  readonly progress: ReaderReadingProgressHost;
  readonly turnInput: ReaderPageTurnInputHost;
  readonly brightness: ReaderBrightnessSession;
  readonly preferences: ReaderReadingPreferencesHost;
  readonly mutation: ReaderReadingContentMutationHost;
  readonly speech: ReaderReadingSpeechHost;
  readonly bookmarks: ReaderBookmarkInteractionHost;
  readonly auxiliary: ReaderAuxiliarySessionHost;
}

export interface ReaderNativeControlActions {
  readonly bookmarkEnabled: () => boolean;
  readonly windowMetricsRevision: () => number;
  readonly openBookInfo: () => void;
  readonly deleteBookmarks: (times: number[]) => void;
  readonly createBookmark: (request: ReaderDirectoryChapterStartBookmarkRequest) => void;
  readonly reduceMotion: () => boolean;
}

export function readerNativeControlIntent(actors: ReaderNativeControlActors,
  other: ReaderNativeControlActions): ReaderControlIntentHandler {
  return (intent: ReaderControlIntent): ReaderControlIntentResult => {
    switch (intent.kind) {
      case 'launchSourceReady':
        return actors.auxiliary.onSourceReady(intent.generation);
      case 'launchSourceRetired':
        return actors.auxiliary.onOriginalSourceRetired(intent.generation, intent.actorId);
      case 'launchSource':
        return actors.auxiliary.admitControlSource(intent.source);
      case 'sessionLaunchShellMeasured': {
        const topExit = intent.topExit;
        const dockExit = intent.dockExit;
        actors.auxiliary.noteShellExitDistances(topExit, dockExit);
        return;
      }
      case 'openRecovery':
        return actors.recovery.open(intent.identity);
      case 'togglePageBookmark': {
        if (other.bookmarkEnabled()) {
          actors.bookmarks.toggle();
        }
        return;
      }
      case 'minimumReceiptCurrent':
        return actors.geometry.receiptCurrent(intent.key);
      case 'playbackProfileSelected':
        return actors.geometry.acceptPlaybackProfile(intent.receipt, other.windowMetricsRevision());
      case 'minimumMeasurerReady':
        return actors.geometry.bind(intent.identity, intent.measurer, intent.profileReader, intent.facts, intent.factsGeometryKey);
      case 'sessionRequest':
        return actors.interaction.requestControlSession(intent.next, intent.origin);
      case 'inputCurrent':
        return actors.interaction.isControlInputEnabled() && actors.auxiliary.sessionLaunchAllowsControlInput();
      case 'visualSessionChange':
        return actors.session.admitVisual(intent.state);
      case 'temporaryLayerChange':
        return actors.geometry.onTemporaryLayerChanged(intent.active, intent.layer);
      case 'ttsConfigurationOpen':
        return actors.speech.retryTtsConfigurationMetadataOnOpen();
      case 'inputActivity':
        return actors.interaction.onControlInputActivity();
      case 'backdropRegionsChange':
        return actors.geometry.acceptBackdropRegions(intent.regions, intent.ready);
      case 'requireCompleteCatalog':
        return actors.turnInput.requestCatalog();
      case 'retryBookmarkLoad':
        return actors.directory.loadBookmarks();
      case 'sessionMorphSourceMeasured':
        return actors.auxiliary.admitSessionMorphSourceMeasurement(intent.measurement);
      case 'exitReading':
        return actors.progress.beginExit();
      case 'dismiss':
        return actors.interaction.hideControl();
      case 'sourceSwitch': {
        const focusId = intent.focusId;
        actors.interaction.switchSource(focusId);
        return;
      }
      case 'refreshChapter':
        return actors.interaction.refreshCurrentChapter();
      case 'downloadBook':
        return actors.directory.requestDownload();
      case 'openBookInfo':
        return other.openBookInfo();
      case 'pageChange':
        return actors.interaction.setControlPage(intent.page, intent.origin);
      case 'selectChapter':
        return actors.directory.selectChapter(intent.chapterIndex);
      case 'selectNavigationTarget':
        return actors.directory.selectNavigationTarget(intent.chapterIndex, intent.chapterOffsetScalar, intent.positionScope, intent.directoryTargetProof);
      case 'selectBookmark':
        return actors.directory.selectBookmarkAnchor(intent.chapterIndex, intent.chapterOffset, intent.positionScope);
      case 'downloadChapter':
        return actors.directory.requestDownload(intent.chapterIndex);
      case 'deleteBookmarks':
        return other.deleteBookmarks(intent.bookmarkTimes);
      case 'createChapterStartBookmark':
        return other.createBookmark(intent.request);
      case 'previousChapter':
        return actors.directory.step(-1);
      case 'nextChapter':
        return actors.directory.step(1);
      case 'progressChange':
        return actors.directory.seek(intent.percent);
      case 'brightnessChange':
        return actors.brightness.setManual(intent.percent);
      case 'brightnessAuto':
        return actors.brightness.toggleAutomatic();
      case 'brightnessCancel':
        return actors.brightness.cancel();
      case 'searchQueryChange':
        return actors.interaction.updateQuickSearchQuery(intent.query);
      case 'search':
        return actors.interaction.runQuickSearch();
      case 'searchLoadMore':
        return actors.interaction.loadMoreQuickSearch(false);
      case 'searchNeedMore':
        return actors.interaction.loadMoreQuickSearch(true);
      case 'searchResultSelect':
        return actors.interaction.selectSearchResult(intent.result, intent.scope, intent.ordinal);
      case 'autoPageToggle':
        return actors.playback.toggleAutoPage();
      case 'autoPageStop':
        return actors.playback.stopAutoPage();
      case 'autoPageSlowDown':
        return actors.playback.changeAutoPageSpeed(2);
      case 'autoPageSpeedUp':
        return actors.playback.changeAutoPageSpeed(-2);
      case 'autoPageFullTimerChange':
        return actors.playback.auto.setSessionTimer(intent.minutes, intent.seconds);
      case 'autoPageFullSpeedChange':
        return actors.playback.setAutoPageSpeed(intent.seconds, intent.onDeclined);
      case 'autoPageFollowHighlightChange':
        return actors.playback.auto.setFollowHighlight(intent.enabled);
      case 'openReplace':
        return actors.interaction.openQuickReplace();
      case 'reloadControlReplace':
        return actors.replace.reload(true, intent.operationId);
      case 'saveControlReplace':
        return actors.replace.save(intent.draft);
      case 'toggleControlReplace':
        return actors.replace.toggle(intent.rule, intent.value);
      case 'deleteControlReplace':
        return actors.replace.delete(intent.rule);
      case 'previewControlReplace':
        return actors.replace.preview();
      case 'importControlReplace':
        return actors.interaction.importControlReplace();
      case 'exportControlReplace':
        return actors.interaction.exportControlReplace();
      case 'appearanceThemeChange':
        return actors.preferences.changeAppearanceTheme(intent.theme);
      case 'appearanceDayThemeChange':
        return actors.preferences.changeAppearanceDayTheme(intent.theme);
      case 'appearanceNightThemeChange':
        return actors.preferences.changeAppearanceNightTheme(intent.theme);
      case 'appearanceFontChange':
        return actors.preferences.changeAppearanceFont(intent.font);
      case 'appearanceFontOrderChange':
        return actors.geometry.fontOrder.request(intent.fontOrder);
      case 'appearanceFontReorderActivityChange': {
        const active = intent.active;
        if (active && !other.reduceMotion()) {
          try { void vibrator.startVibration({ type: 'time', duration: 10 }, { usage: 'touch' }).catch((): void => {}); }
          catch (_) {}
        }
        return;
      }
      case 'appearanceCustomFontImport':
        return actors.preferences.importReaderCustomFont();
      case 'appearanceIndentRequest':
        return actors.preferences.changeAppearanceIndent(intent.indent);
      case 'appearanceAlignmentRequest':
        return actors.preferences.toggleAppearanceAlignment(intent.current);
      case 'appearanceMetricStep':
        return actors.preferences.stepAppearanceMetric(intent.metric, intent.direction);
      case 'chineseConversionChange':
        return actors.mutation.dispatchChineseConversionAction(intent.mode, intent.identity);
      case 'settingsToggleChange':
        return actors.preferences.changeReaderSetting(intent.key, intent.value);
      case 'widePageLayoutChange':
        return actors.preferences.changeWidePageLayout(intent.value);
      case 'screenDirectionChange':
        return actors.preferences.changeReaderScreenDirection(intent.direction);
      case 'screenTimeoutChange':
        return actors.preferences.changeReaderScreenTimeout(intent.timeout);
      case 'pageTurnStyleChange':
        return actors.preferences.changeReaderPageTurnStyle(intent.style);
      case 'ttsToggle':
        return actors.speech.toggleTts();
      case 'ttsStop':
        return actors.speech.stopTts();
      case 'ttsPrevious':
        return actors.speech.previousTtsUtterance();
      case 'ttsNext':
        return actors.speech.nextTtsUtterance();
      case 'ttsSeek':
        return actors.speech.seekTtsUtterance(intent.sliceIndex);
      case 'ttsRateChange':
        return actors.speech.changeTtsRate(intent.rate, intent.onDeclined);
      case 'ttsTimerChange':
        return actors.speech.changeTtsTimer(intent.minutes, intent.seconds, intent.mode);
      case 'ttsFollowHighlightChange':
        return actors.speech.changeTtsFollowHighlight(intent.enabled);
      case 'ttsPauseOnInterruptionChange':
        return actors.speech.changeTtsPauseOnInterruption(intent.enabled);
      case 'ttsAllowMixingChange':
        return actors.speech.changeTtsAllowMixing(intent.enabled);
      case 'ttsBackgroundPlaybackChange':
        return actors.speech.changeTtsBackgroundPlayback(intent.enabled);
      case 'ttsKeepScreenOnChange':
        return actors.speech.changeTtsKeepScreenOn(intent.enabled);
      case 'ttsFailurePolicyChange':
        return actors.speech.changeTtsFailurePolicy(intent.policy);
      case 'ttsVoiceChange':
        return actors.speech.changeTtsVoice(intent.language, intent.person);
      case 'ttsVoiceAudition':
        return actors.speech.auditionReaderTtsVoice(intent.language, intent.person);
      case 'ttsAuditionStop':
        return actors.speech.stopReaderTtsAudition();
      case 'ttsEngineChange':
        return actors.speech.changeTtsEngine(intent.engine);
      case 'ttsHttpEnginePut':
        return actors.speech.saveHttpTtsEngine(intent.config);
      case 'ttsHttpEngineDelete':
        return actors.speech.deleteHttpTtsEngine(intent.id);
      default:
        return defaultReaderControlIntent(intent);
    }
  };
}

export interface ReaderNativeControlFrameRoute {
  readonly sourceId: string;
  readonly sourceName: string;
  readonly bookId: string;
  readonly bookTitle: string;
  readonly chapterCount: number;
}

export interface ReaderNativeControlFrameInput {
  readonly route: () => ReaderNativeControlFrameRoute;
  readonly chrome: () => ReadingChromeRenderSnapshot;
  readonly overlay: () => ReadingOverlayRenderSnapshot;
  readonly projection: () => ReadingPageTurnRenderSnapshot;
  readonly session: () => ReadingSessionRenderSnapshot;
  readonly mount: ReaderReadingMountHost;
  readonly geometry: ReaderControlGeometryHost;
  readonly pageChrome: ReaderReadingPageChromeHost;
  readonly directory: ReaderControlDirectoryOperationsHost;
  readonly bookmark: ReaderBookmarkInteractionHost;
  readonly auxiliary: ReaderAuxiliarySessionHost;
  readonly recovery: ReaderReadingRecoveryHost;
  readonly mutation: ReaderReadingContentMutationHost;
  readonly brightness: ReaderBrightnessSession;
  readonly selectionPossible: () => boolean;
  readonly systemFontScale: () => number;
  readonly appScheme: () => string;
  readonly windowMetricsRevision: () => number;
  readonly readableTocCount: () => number;
  readonly currentReadablePosition: () => number;
  readonly currentChapter: () => number;
  readonly controlInputEnabled: () => boolean;
  readonly controlObscured: () => boolean;
  readonly chapterStartBookmarkEnabled: () => boolean;
  readonly bookmarkMessage: () => string;
  readonly bookmarkRecovery: () => ReadingDirectoryRecovery;
  readonly automaticState: () => Readonly<ReaderAutoPageState>;
  readonly automaticConfiguration: () => Readonly<ReaderAutoPageFullConfiguration>;
  readonly reducedMotion: () => boolean;
  readonly offlineOperationActive: () => boolean;
  readonly refreshEnabled: () => boolean;
  readonly verification: () => ReaderControlVerificationSession;
  readonly bookmarkIdentity: () => ReaderBookIdentity | undefined;
  readonly searchPublication: ReaderContentSearchPublication;
}

const EMPTY_CONTROL_DIRECTORY: LocalReadingTocEntry[] = [];

/** Projects the admitted reading owners into five immutable native snapshots. */
function readerNativeControlFrame(input: ReaderNativeControlFrameInput,
  previous: ReaderControlPanelFrame | undefined, hiddenTtsState: ReaderTtsState): ReaderControlPanelFrame {
  // The verification scope and publication owners were assigned on native
  // construction. Retain them with the mounted bookmark identity.
  const geometry: ReaderControlGeometrySnapshot = {
    directSheet: true,
    fixedIsland: true,
    allowsTextSelection: input.selectionPossible(),
    fontScale: input.systemFontScale(),
    theme: input.geometry.panelTheme(input.appScheme()),
    layout: input.geometry.layout(input.windowMetricsRevision()),
    reduceMotion: input.reducedMotion(),
    verification: previous === undefined ? input.verification() : previous.geometry.verification,
    inputEnabled: input.controlInputEnabled() && input.auxiliary.sessionLaunchAllowsControlInput(),
    obscured: input.controlObscured(),
    openRevision: input.chrome().controlOpenRevision,
    minimum: {
      receipt: input.chrome().controlPresentationReceipt,
      preparedRequired: true,
      identity: input.geometry.identity(),
      committedIdentity: input.geometry.committedIdentity(),
      requestLocation: input.geometry.requestLocation(),
      ownerKey: input.geometry.ownerKey(),
      environmentKey: input.geometry.environmentKey(),
      key: input.geometry.layout(input.windowMetricsRevision()).minimumKey,
      ready: input.chrome().controlMinimumReady,
      metricsRevision: ReaderWindowCoordinator.metrics().revision,
    },
    temporary: {
      dismissRevision: input.chrome().dismissControlTemporaryRevision,
      retireRevision: input.chrome().retireControlTemporaryRevision,
      layer: input.chrome().controlTemporaryLayerPresented,
    },
  };
  const activeLaunch = input.overlay().sessionLaunch;
  const controlVisible = readerControlHostVisible(input.chrome().controlSession);
  const launch: ReaderControlLaunchSnapshot = {
    sample: activeLaunch === undefined ? undefined : input.auxiliary.sourceSample,
    generation: activeLaunch?.generation ?? 0,
    sourceMinimum: input.auxiliary.sourceMinimum,
    sourceKind: activeLaunch?.geometry.kind ?? 'quickAutoPage',
    ownsControls: activeLaunch?.ownership === 'stage' && activeLaunch.sourceTransfer !== 'preparingProxy',
    topBarOffsetY: activeLaunch?.sample.topBarOffsetY ?? 0,
    dockOffsetY: activeLaunch?.sample.dockOffsetY ?? 0,
    recovering: activeLaunch?.ownership === 'handoffPending',
  };
  const document: ReaderControlDocumentSnapshot = {
    bookTitle: input.route().bookTitle,
    chapterTitle: input.chrome().chapterTitle,
    source: {
      id: input.route().sourceId,
      bookId: input.route().bookId,
      name: input.route().sourceName,
    },
    progressPercent: input.pageChrome.controlProgress(),
    totalChapters: input.mount.entryCatalogNavigation?.readableChapterCount ?? input.readableTocCount(),
    readableChapterPosition: input.currentReadablePosition(),
    chapterIndex: input.currentChapter(),
    bookmarks: {
      allowChapterStart: input.chapterStartBookmarkEnabled(),
      loadFailed: input.chrome().controlBookmarkLoadFailed,
      message: input.bookmarkMessage(),
      recovery: input.bookmarkRecovery(),
      book: previous === undefined ? input.bookmarkIdentity() : previous.document.bookmarks.book,
      pageStatus: controlVisible ?
        input.bookmark.controlStatus(input.projection().bookmarkPresentationRevision + input.projection().pageTurnRenderRevision) : 'unknown',
      pageEnabled: controlVisible &&
        input.bookmark.controlEnabled(input.projection().bookmarkPresentationRevision + input.projection().pageTurnRenderRevision),
    },
    catalog: {
      publication: previous === undefined ? input.directory.publication : previous.document.catalog.publication,
      revision: input.chrome().controlDirectoryEntriesRevision,
      complete: !input.mount.entryCatalogPending,
      loading: input.session().entryCatalogLoading,
      loadFailed: input.session().entryCatalogLoadFailed,
      chapterCount: input.mount.entryCatalogNavigation?.chapterCount ?? input.chrome().tocEntries.length,
      position: input.directory.catalogPosition(),
      defaultEntries: EMPTY_CONTROL_DIRECTORY,
    },
    search: {
      query: input.chrome().quickSearchQuery,
      revision: input.chrome().quickSearchRevision,
      publication: previous === undefined ? input.searchPublication : previous.document.search.publication,
      manga: false,
    },
    replace: input.chrome().controlReplaceState,
    recovery: {
      available: input.recovery.hasContent(),
      identity: input.recovery.overlayId(),
    },
    download: {
      chapterEnabled: input.route().sourceId !== 'local',
      bookEnabled: input.route().sourceId !== 'local' && (input.mount.entryCatalogNavigation?.readableChapterCount ?? input.route().chapterCount) > 0 && !input.offlineOperationActive(),
      bookActive: input.offlineOperationActive(),
    },
    allowChapterRefresh: input.refreshEnabled(),
  };
  const preferences: ReaderControlPreferencesSnapshot = {
    brightness: {
      percent: input.chrome().brightnessPercent,
      automatic: input.brightness.automatic(),
      revision: input.chrome().brightnessRevision,
    },
    appearance: input.chrome().appearanceSnapshot,
    conversion: {
      identity: input.mutation.chineseConversionIdentity(),
      mode: input.chrome().chineseConversionMode,
    },
    settings: input.chrome().readerSettingsSnapshot,
    widePageLayout: input.chrome().readerSettingsSnapshot.widePageLayout ?? 'spread',
    pageTurnSimulationAvailable: !input.projection().bookTurnRuntimeFailed,
  };
  const playback: ReaderControlPlaybackSnapshot = {
    automatic: {
      status: input.automaticState().status,
      speedSeconds: input.automaticState().speedSeconds,
      timerMinutes: input.automaticConfiguration().timerMinutes,
      timerSeconds: input.automaticConfiguration().timerSeconds,
      timerSummary: formatReaderAutoPageFullTimerSummary(input.automaticConfiguration()),
      followHighlight: input.automaticConfiguration().followHighlight,
    },
    speech: {
      state: controlVisible ? input.session().ttsState : activeLaunch !== undefined ? input.auxiliary.sourceTtsState : hiddenTtsState,
      timerMode: input.session().ttsTimerMode,
      timerMinutes: input.session().ttsTimerMinutes,
      timerSeconds: input.session().ttsTimerSeconds,
      followHighlight: input.session().ttsFollowHighlight,
      pauseOnInterruption: input.session().ttsPauseOnInterruption,
      allowMixing: input.session().ttsAllowMixing,
      backgroundPlayback: input.session().ttsBackgroundPlayback,
      keepScreenOn: input.session().ttsKeepScreenOn,
      failurePolicy: input.session().ttsFailurePolicy,
      engine: input.session().ttsEngine,
      httpEngines: input.session().ttsHttpEngines,
      configurationRecovery: input.overlay().ttsConfigurationRecovery,
      configurationLoading: input.overlay().ttsConfigurationLoading,
      configurationLoadFailed: input.overlay().ttsConfigurationLoadFailed,
      voiceOptions: input.session().ttsVoiceOptions,
      language: input.session().ttsLanguage,
      person: input.session().ttsPerson,
    },
  };

  if (previous === undefined) return new ReaderControlPanelFrame({ geometry, launch, document, preferences, playback });
  const sameGeometryFacts = sameGeometry(previous.geometry, geometry);
  const sameLaunchFacts = sameLaunch(previous.launch, launch);
  const sameDocumentFacts = sameDocument(previous.document, document);
  const samePreferencesFacts = samePreferences(previous.preferences, preferences);
  const samePlaybackFacts = samePlayback(previous.playback, playback);
  if (sameGeometryFacts && sameLaunchFacts && sameDocumentFacts && samePreferencesFacts && samePlaybackFacts) return previous;
  return new ReaderControlPanelFrame({
    geometry: sameGeometryFacts ? previous.geometry : geometry,
    launch: sameLaunchFacts ? previous.launch : launch,
    document: sameDocumentFacts ? previous.document : document,
    preferences: samePreferencesFacts ? previous.preferences : preferences,
    playback: samePlaybackFacts ? previous.playback : playback,
  });
}

function sameGeometry(first: ReaderControlGeometrySnapshot, second: ReaderControlGeometrySnapshot): boolean {
  return first.directSheet === second.directSheet &&
    first.fixedIsland === second.fixedIsland &&
    first.allowsTextSelection === second.allowsTextSelection &&
    first.fontScale === second.fontScale &&
    first.theme.ink === second.theme.ink && first.theme.muted === second.theme.muted &&
    first.theme.primary === second.theme.primary && first.theme.panel === second.theme.panel &&
    first.theme.panelSoft === second.theme.panelSoft && first.theme.line === second.theme.line &&
    first.theme.lineStrong === second.theme.lineStrong &&
    first.layout === second.layout &&
    first.reduceMotion === second.reduceMotion &&
    first.verification === second.verification &&
    first.inputEnabled === second.inputEnabled &&
    first.obscured === second.obscured &&
    first.openRevision === second.openRevision &&
    first.minimum.receipt === second.minimum.receipt &&
    first.minimum.preparedRequired === second.minimum.preparedRequired &&
    first.minimum.identity === second.minimum.identity &&
    first.minimum.committedIdentity === second.minimum.committedIdentity &&
    first.minimum.requestLocation === second.minimum.requestLocation &&
    first.minimum.ownerKey === second.minimum.ownerKey &&
    first.minimum.environmentKey === second.minimum.environmentKey &&
    first.minimum.key === second.minimum.key &&
    first.minimum.ready === second.minimum.ready &&
    first.minimum.metricsRevision === second.minimum.metricsRevision &&
    first.temporary.dismissRevision === second.temporary.dismissRevision &&
    first.temporary.retireRevision === second.temporary.retireRevision &&
    first.temporary.layer === second.temporary.layer;
}

function sameLaunch(first: ReaderControlLaunchSnapshot, second: ReaderControlLaunchSnapshot): boolean {
  return first.sample === second.sample &&
    first.generation === second.generation &&
    first.sourceMinimum === second.sourceMinimum &&
    first.sourceKind === second.sourceKind &&
    first.ownsControls === second.ownsControls &&
    first.topBarOffsetY === second.topBarOffsetY &&
    first.dockOffsetY === second.dockOffsetY &&
    first.recovering === second.recovering;
}

function sameDocument(first: ReaderControlDocumentSnapshot, second: ReaderControlDocumentSnapshot): boolean {
  return first.bookTitle === second.bookTitle &&
    first.chapterTitle === second.chapterTitle &&
    first.source.id === second.source.id &&
    first.source.bookId === second.source.bookId &&
    first.source.name === second.source.name &&
    first.progressPercent === second.progressPercent &&
    first.totalChapters === second.totalChapters &&
    first.readableChapterPosition === second.readableChapterPosition &&
    first.chapterIndex === second.chapterIndex &&
    first.bookmarks.allowChapterStart === second.bookmarks.allowChapterStart &&
    first.bookmarks.loadFailed === second.bookmarks.loadFailed &&
    first.bookmarks.message === second.bookmarks.message &&
    first.bookmarks.recovery === second.bookmarks.recovery &&
    first.bookmarks.book === second.bookmarks.book &&
    first.bookmarks.pageStatus === second.bookmarks.pageStatus &&
    first.bookmarks.pageEnabled === second.bookmarks.pageEnabled &&
    first.catalog.publication === second.catalog.publication &&
    first.catalog.revision === second.catalog.revision &&
    first.catalog.complete === second.catalog.complete &&
    first.catalog.loading === second.catalog.loading &&
    first.catalog.loadFailed === second.catalog.loadFailed &&
    first.catalog.chapterCount === second.catalog.chapterCount &&
    first.catalog.position === second.catalog.position &&
    first.search.query === second.search.query &&
    first.search.revision === second.search.revision &&
    first.search.publication === second.search.publication &&
    first.replace === second.replace &&
    first.recovery.available === second.recovery.available &&
    first.recovery.identity === second.recovery.identity &&
    first.download.chapterEnabled === second.download.chapterEnabled &&
    first.download.bookEnabled === second.download.bookEnabled &&
    first.download.bookActive === second.download.bookActive &&
    first.allowChapterRefresh === second.allowChapterRefresh &&
    first.catalog.defaultEntries === second.catalog.defaultEntries &&
    first.search.manga === second.search.manga;
}

function samePreferences(first: ReaderControlPreferencesSnapshot, second: ReaderControlPreferencesSnapshot): boolean {
  return first.brightness.percent === second.brightness.percent &&
    first.brightness.automatic === second.brightness.automatic &&
    first.brightness.revision === second.brightness.revision &&
    first.appearance === second.appearance &&
    first.conversion.identity === second.conversion.identity &&
    first.conversion.mode === second.conversion.mode &&
    first.settings === second.settings &&
    first.widePageLayout === second.widePageLayout &&
    first.pageTurnSimulationAvailable === second.pageTurnSimulationAvailable;
}

function samePlayback(first: ReaderControlPlaybackSnapshot, second: ReaderControlPlaybackSnapshot): boolean {
  return first.automatic.status === second.automatic.status &&
    first.automatic.speedSeconds === second.automatic.speedSeconds &&
    first.automatic.timerMinutes === second.automatic.timerMinutes &&
    first.automatic.timerSeconds === second.automatic.timerSeconds &&
    first.automatic.timerSummary === second.automatic.timerSummary &&
    first.automatic.followHighlight === second.automatic.followHighlight &&
    first.speech.state === second.speech.state &&
    first.speech.timerMode === second.speech.timerMode &&
    first.speech.timerMinutes === second.speech.timerMinutes &&
    first.speech.timerSeconds === second.speech.timerSeconds &&
    first.speech.followHighlight === second.speech.followHighlight &&
    first.speech.pauseOnInterruption === second.speech.pauseOnInterruption &&
    first.speech.allowMixing === second.speech.allowMixing &&
    first.speech.backgroundPlayback === second.speech.backgroundPlayback &&
    first.speech.keepScreenOn === second.speech.keepScreenOn &&
    first.speech.failurePolicy === second.speech.failurePolicy &&
    first.speech.engine === second.speech.engine &&
    first.speech.httpEngines === second.speech.httpEngines &&
    first.speech.configurationRecovery === second.speech.configurationRecovery &&
    first.speech.configurationLoading === second.speech.configurationLoading &&
    first.speech.configurationLoadFailed === second.speech.configurationLoadFailed &&
    first.speech.voiceOptions === second.speech.voiceOptions &&
    first.speech.language === second.speech.language &&
    first.speech.person === second.speech.person;
}
