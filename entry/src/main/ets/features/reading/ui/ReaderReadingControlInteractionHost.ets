import type { BookSourceJsonSelection } from '../../../app/ReaderHostRegistry';
import { ReaderRuntimeOwner } from '../../../app/ReaderRuntimeOwner';
import { READER_CONTROL_DISMISS_MS, READER_CONTROL_EXPAND_MS, READER_CONTROL_LAYER_SWITCH_MS,
  READER_CONTROL_MODULE_SWITCH_MS, READER_CONTROL_OPEN_MS, READER_REDUCED_FADE_MS,
  READER_SHEET_CLOSE_MS, READER_SHEET_OPEN_MS } from '../../../ui/foundation/ProductMotionTiming';
import type { ReaderNavigationMode } from '../application/ReaderSettingsState';
import type { ReadingSessionChapter } from '../application/ReadingChapterWindow';
import type { ReadingContentSearchResult } from '../application/ReadingSessionFlowGateway';
import type { ReaderControlReplacePanel } from '../presentation/ReaderControlReplacePanel';
import type { ReaderContentSearchPublication, ReaderQuickSearchState } from '../presentation/ReaderContentSearchPublication';
import type { ReaderAuxiliarySessionHost } from './ReaderAuxiliarySessionHost';
import type { ReaderBrightnessSession } from './ReaderBrightnessSession';
import type { ReaderControlDirectorySession } from './ReaderControlDirectoryHost';
import type { ReaderControlDirectoryOperationsHost } from './ReaderControlDirectoryOperationsHost';
import type { ReaderControlGeometryHost } from './ReaderControlGeometryHost';
import { readerControlHostClosing, readerControlHostInputEnabled, readerControlHostPage,
  readerControlHostVisible, setReaderControlHostPage, type ReaderControlHostTiming } from './ReaderControlHostSession';
import type { ReaderControlPresentationReceipt } from './ReaderControlMinimumMeasurement';
import { readerControlMotionMs } from './ReaderControlMotionPolicy';
import type { ReaderControlPage } from './ReaderControlRouting';
import { ReaderControlNavigation, type ReaderControlNavigationIntent,
  type ReaderControlNavigationScope } from './ReaderControlPresentationCoordinator';
import { dismissReaderControlSession, openReaderControlSession, readerControlContentLocation,
  readerControlTargetLocation, resumeReaderControlSessionTarget, type ReaderControlSessionState } from './ReaderControlSessionState';
import type { ReaderControlVerificationOrigin, ReaderControlVerificationSession } from './ReaderControlVerificationSession';
import type { ReaderPageTurnRuntimeHost } from './ReaderPageTurnRuntimeHost';
import type { ReaderReadingChapterAcquisitionHost } from './ReaderReadingChapterAcquisitionHost';
import type { ReaderReadingContentMutationHost } from './ReaderReadingContentMutationHost';
import type { ReaderReadingMountHost } from './ReaderReadingMountHost';
import type { ReaderReadingPreferencesHost } from './ReaderReadingPreferencesHost';
import type { ReaderReadingRecoveryHost } from './ReaderReadingRecoveryHost';
import type { ReaderReadingSpeechHost } from './ReaderReadingSpeechHost';
import { readerRenderStageKind } from './ReaderRenderStageSpec';
import type { ReaderSessionCapsuleType } from './ReaderSessionCapsuleModel';

const READER_CONTENT_SEARCH_PAGE_SIZE = 50;

export interface ReaderReadingControlInteractionActors {
  readonly session: ReaderControlDirectorySession;
  readonly geometry: ReaderControlGeometryHost;
  readonly directory: () => ReaderControlDirectoryOperationsHost;
  readonly mount: () => ReaderReadingMountHost;
  readonly turn: () => ReaderPageTurnRuntimeHost;
  readonly auxiliary: () => ReaderAuxiliarySessionHost;
  readonly recovery: () => ReaderReadingRecoveryHost;
  readonly speech: () => ReaderReadingSpeechHost;
  readonly preferences: () => ReaderReadingPreferencesHost;
  readonly contentMutation: () => ReaderReadingContentMutationHost;
  readonly acquisition: () => ReaderReadingChapterAcquisitionHost;
  readonly verification: ReaderControlVerificationSession;
  readonly brightness: () => ReaderBrightnessSession;
  readonly replace: ReaderControlReplacePanel;
  readonly search: ReaderContentSearchPublication;
}

export interface ReaderReadingControlInteractionScene {
  readonly scope: () => ReaderControlNavigationScope;
  readonly mounted: () => boolean;
  readonly exiting: () => boolean;
  readonly foreground: () => boolean;
  readonly windowChromeActive: () => boolean;
  readonly windowChromeOverlayActive: () => boolean;
  readonly controlObscured: () => boolean;
  readonly interactionBlocked: () => boolean;
  readonly readerIdentityCurrent: () => boolean;
  readonly externalInputCurrent: () => boolean;
  readonly reducedMotion: () => boolean;
  readonly ready: () => boolean;
  readonly sessionLaunchActive: () => boolean;
  readonly bookTitle: () => string;
  readonly currentChapter: () => ReadingSessionChapter | undefined;
  readonly viewportStart: () => number | undefined;
}

export interface ReaderReadingControlInteractionView {
  readonly session: () => ReaderControlSessionState;
  readonly openRevision: () => number;
  readonly advanceOpenRevision: () => void;
  readonly navigationIntent: () => ReaderControlNavigationIntent | undefined;
  readonly publishNavigationIntent: (intent: ReaderControlNavigationIntent | undefined) => void;
  readonly presentationReceipt: () => ReaderControlPresentationReceipt | undefined;
  readonly minimumReady: () => boolean;
  readonly replaceMutationPending: () => boolean;
  readonly searchQuery: () => string;
  readonly publishSearchQuery: (query: string) => void;
  readonly searchRevision: () => number;
  readonly advanceSearchRevision: () => void;
  readonly sessionClosing: () => boolean;
  readonly publishClosing: (closing: boolean) => void;
  readonly advancePageRenderRevision: () => void;
  readonly pageTurnSettlementActive: () => boolean;
  readonly pageTurnInputOwned: () => boolean;
  readonly hasMeasuredViewport: () => boolean;
  readonly navigationMode: () => ReaderNavigationMode;
  readonly hasContinuousContent: () => boolean;
}

export interface ReaderReadingControlInteractionEffects {
  readonly observePrefetch: () => void;
  readonly retirePendingPlaybackStarts: () => void;
  readonly pauseAutomaticForRefresh: () => void;
  readonly openSourcePicker: (focusId?: string) => void;
}

/** Coordinates the reader's mounted control interactions with the existing
 * native session, measured layout, keyboard and business operation owners. */
export class ReaderReadingControlInteractionHost {
  readonly navigation: ReaderControlNavigation;
  private readonly actors: ReaderReadingControlInteractionActors;
  private readonly scene: ReaderReadingControlInteractionScene;
  private readonly view: ReaderReadingControlInteractionView;
  private readonly effects: ReaderReadingControlInteractionEffects;

  constructor(actors: ReaderReadingControlInteractionActors, scene: ReaderReadingControlInteractionScene,
    view: ReaderReadingControlInteractionView, effects: ReaderReadingControlInteractionEffects) {
    this.actors = actors;
    this.scene = scene;
    this.view = view;
    this.effects = effects;
    this.navigation = new ReaderControlNavigation({
      scope: scene.scope,
      session: view.session,
      visualSession: (): ReaderControlSessionState => actors.session.visualSession(),
      readIntent: view.navigationIntent,
      publishIntent: view.publishNavigationIntent,
      publishSession: (session: ReaderControlSessionState): void => actors.session.request(session),
      hasCommittedReceipt: (): boolean => view.presentationReceipt() !== undefined,
      invalidateMinimumRequest: (): void => actors.geometry.minimum.invalidateRequest(),
      accept: (origin: ReaderControlVerificationOrigin, source: ReaderControlSessionState, next: ReaderControlSessionState): void =>
        actors.verification.accept(origin, source, next, view.openRevision()),
    });
  }

  openReaderControl(verificationOrigin?: ReaderControlVerificationOrigin,
    shortcutModule?: 'search' | 'directory'): void {
    this.actors.recovery().retire();
    if (this.scene.sessionLaunchActive()) {
      this.actors.auxiliary().cancel('openControl');
      return;
    }
    const turn = this.actors.turn();
    if (this.view.pageTurnSettlementActive() && turn.prepared.commitStarted && !turn.prepared.commitFinished) {
      this.actors.mount().activeGateway().handoffPendingProgress();
      turn.releaseRecoveryInput();
    }
    if (!this.isControlInputEnabled() || !this.isReaderPageInteractionEnabled() || turn.inputPhase() !== 'idle') return;
    turn.pageTurn.cancelRapid();
    // The retained directory may materialize before the opening animation.
    this.actors.directory().retainDirectory();
    this.actors.geometry.invalidateBackdrop();
    this.view.advanceOpenRevision();
    const duration = this.controlTiming().showDurationMs;
    const playbackOrigin = this.actors.auxiliary().consumeStaticCapsuleOrigin();
    const opened = openReaderControlSession(this.view.session(), duration);
    const shortcutTarget = shortcutModule === undefined ? undefined : readerControlTargetLocation(
      setReaderControlHostPage(opened, shortcutModule === 'search' ? 'quickSearch' : 'moduleDirectory', this.controlTiming()));
    const target = shortcutTarget ?? playbackOrigin;
    const nextControl = target === undefined ? opened : resumeReaderControlSessionTarget(this.view.session(), target, duration);
    if (target !== undefined && nextControl.transition !== undefined) {
      nextControl.transition.kind = 'open';
      nextControl.transition.intent = 'forward';
    }
    if (verificationOrigin !== undefined) {
      this.actors.verification.accept(verificationOrigin, this.view.session(), nextControl, this.view.openRevision());
    }
    this.actors.session.request(nextControl);
    void this.actors.acquisition().loadContentMetricsIfNeeded(this.scene.scope().lifecycleToken);
    this.actors.brightness().refresh();
  }

  hideControl(origin: ReaderControlVerificationOrigin = 'host-dismiss', capsuleType?: ReaderSessionCapsuleType): void {
    if (!this.controlVisible()) return;
    this.actors.auxiliary().rememberCapsuleOnControlDismiss(capsuleType, this.view.session);
    this.actors.geometry.invalidateBackdrop();
    // Only a live keyboard inset grants this close an IME request.
    this.actors.geometry.hideKeyboardIfVisible();
    this.actors.geometry.dismissTemporaryLayers();
    const previous = this.actors.session.visualSession() ?? this.view.session();
    const next = dismissReaderControlSession(previous, this.controlTiming().dismissDurationMs);
    this.actors.verification.accept(origin, previous, next, this.view.openRevision());
    this.actors.session.request(next);
    this.view.advancePageRenderRevision();
  }

  commitSessionLaunchControlHidden(): void {
    // The capsule launch sampler owns the exit clock.
    this.actors.session.request(dismissReaderControlSession(this.view.session(), 0));
    this.actors.session.copyVisual(this.view.session());
  }

  switchSource(focusId?: string): void {
    this.hideControl();
    this.effects.openSourcePicker(focusId);
  }

  setControlPage(page: ReaderControlPage, origin: ReaderControlVerificationOrigin = 'module-button'): void {
    if (this.scene.sessionLaunchActive()) this.actors.auxiliary().cancel('sourceChanged');
    if (!this.isControlInputEnabled()) return;
    this.actors.geometry.invalidateBackdrop();
    this.requestControlSession(setReaderControlHostPage(this.actors.session.visualSession(), page, this.controlTiming()), origin);
  }

  cancelControlNavigationIntent(): boolean { return this.navigation.cancel(); }

  onControlInputActivity(): void {
    this.cancelControlNavigationIntent();
    this.actors.geometry.invalidateBackdrop();
  }

  requestControlSession(next: ReaderControlSessionState, origin: ReaderControlVerificationOrigin): void {
    if (this.navigation.request(next, origin)) this.actors.geometry.fontOrder.reconcile();
  }

  /** Derive module work from an accepted business route rather than an animation frame. */
  prepareControlPage(page: ReaderControlPage): void {
    const lifecycle = this.scene.scope().lifecycleToken;
    if (page === 'moduleDirectory') {
      const mount = this.actors.mount();
      if (mount.entryCatalogPending) mount.hydration.scheduleCatalog();
      this.actors.directory().loadBookmarks();
    } else if (page === 'moduleTts' || page === 'fullTts') {
      void this.actors.speech().initializeTtsSession(lifecycle);
    } else if (page === 'moduleAppearance' || page === 'fullAppearance') {
      void this.actors.contentMutation().loadChineseConversionMode(lifecycle);
    } else if (page === 'moduleSettings' || page === 'fullSettings') {
      void this.actors.preferences().loadReaderSettingsSnapshot(lifecycle);
    } else if (page === 'quickReplace') {
      this.prepareControlReplacePage();
    }
  }

  prepareControlReplacePage(): void {
    if (!this.view.minimumReady() || this.controlPage() !== 'quickReplace' || !this.controlVisible() ||
      this.view.replaceMutationPending()) return;
    const geometry = this.actors.geometry;
    const identity = geometry.committedIdentity();
    const receipt = this.view.presentationReceipt();
    if (receipt !== undefined) {
      if (receipt.identity !== identity || receipt.ownerKey !== geometry.ownerKey() ||
        receipt.environmentKey !== geometry.environmentKey() || receipt.location.module !== 'replace') return;
    } else if (geometry.minimum.profileReader !== undefined) return;
    this.actors.replace.prepare(identity);
  }

  controlMotionSession(): ReaderControlSessionState { return this.actors.session.visualSession(); }
  controlVisible(): boolean { return readerControlHostVisible(this.view.session()); }
  controlShellExitArmed(): boolean { return readerControlHostClosing(this.view.session()); }
  controlPage(): ReaderControlPage { return readerControlHostPage(this.view.session()); }
  controlMotionVisible(): boolean { return readerControlHostVisible(this.controlMotionSession()); }
  controlMotionPage(): ReaderControlPage { return readerControlHostPage(this.controlMotionSession()); }

  controlTiming(): ReaderControlHostTiming {
    const reduced = this.scene.reducedMotion();
    return {
      showDurationMs: readerControlMotionMs(READER_CONTROL_OPEN_MS, reduced),
      dismissDurationMs: readerControlMotionMs(READER_CONTROL_DISMISS_MS, reduced),
      morphDurationMs: readerControlMotionMs(READER_CONTROL_EXPAND_MS, reduced),
      layerDurationMs: readerControlMotionMs(READER_CONTROL_LAYER_SWITCH_MS, reduced),
      navigateDurationMs: readerControlMotionMs(READER_CONTROL_MODULE_SWITCH_MS, reduced),
      directSheetDurationMs: reduced ? READER_REDUCED_FADE_MS : READER_SHEET_OPEN_MS,
      directSheetCloseDurationMs: reduced ? READER_REDUCED_FADE_MS : READER_SHEET_CLOSE_MS,
      fixedIsland: true,
    };
  }

  isControlInputEnabled(): boolean { return this.readerInputIsCurrent(); }

  readerInputIsCurrent(): boolean {
    return readerControlHostInputEnabled({
      mounted: this.scene.mounted(), exitRequested: this.scene.exiting(),
      appForeground: this.scene.foreground(), windowChromeActive: this.scene.windowChromeActive(),
      interactionBlocked: this.scene.interactionBlocked(), controlObscured: this.scene.controlObscured(),
    }) && this.scene.readerIdentityCurrent() && this.scene.externalInputCurrent();
  }

  isReaderPageInteractionEnabled(): boolean { return this.readerInputIsCurrent() && !this.controlVisible(); }

  onControlInputBoundaryChanged(): void {
    const geometry = this.actors.geometry;
    const preferences = this.actors.preferences();
    this.effects.observePrefetch();
    geometry.fontOrder.reconcile();
    preferences.refreshAppearanceSaveRecovery(this.scene.scope().lifecycleToken);
    if (!this.readerInputIsCurrent() || this.scene.windowChromeOverlayActive()) this.effects.retirePendingPlaybackStarts();
    if (!this.isControlInputEnabled()) this.actors.turn().input.retirePointer();
    geometry.minimum.invalidateRequest();
    geometry.schedule();
    if (!this.scene.foreground() || this.scene.interactionBlocked() || this.scene.controlObscured()) {
      this.actors.turn().cancelAutomaticPageStart();
    }
    if (this.scene.mounted() && this.scene.foreground() && this.actors.speech().isAttached() &&
      this.scene.readerIdentityCurrent() && (!this.isControlInputEnabled() || this.scene.windowChromeOverlayActive())) {
      this.actors.speech().stopReaderTtsAudition();
    }
    geometry.invalidateBackdrop();
    preferences.syncVolumeKeyPolicy();
    this.publishControlVerificationReady();
  }

  admitSessionControlClosing(closing: boolean): void {
    // Drag dismissal publishes only the ownership edge for the capsule.
    if (this.view.sessionClosing() === closing) return;
    this.view.publishClosing(closing);
    this.view.advancePageRenderRevision();
  }

  publishControlVerificationReady(): void {
    if (!this.scene.ready() || !this.view.hasMeasuredViewport() || !this.isReaderPageInteractionEnabled() ||
      this.actors.turn().inputPhase() !== 'idle' || this.scene.sessionLaunchActive() ||
      this.actors.geometry.temporaryLayer.length > 0) return;
    const mode = readerRenderStageKind(this.view.navigationMode(), this.view.hasContinuousContent());
    this.actors.verification.ready(mode === 'continuous' ? 'continuous' : 'paged', this.view.session(),
      this.view.openRevision(), this.scene.scope().sourceId === 'local', this.scene.reducedMotion(),
      this.scene.currentChapter()?.chapterIndex ?? -1);
  }

  openReplaceRecovery(generation: number): void {
    if (!this.actors.mount().isSessionActive(this.scene.scope().lifecycleToken) || !this.isControlInputEnabled() ||
      !this.actors.replace.recoveryCurrent(generation)) return;
    this.openReaderControl();
    if (this.controlVisible()) this.requestControlReplacePage();
  }

  openQuickReplace(): void {
    if (!this.scene.mounted() || !this.controlVisible() || this.controlPage() !== 'home') return;
    this.requestControlReplacePage();
  }

  importControlReplace(): Promise<void> {
    return this.actors.replace.importBundle((): Promise<BookSourceJsonSelection | undefined> =>
      ReaderRuntimeOwner.current().selectRuleBundleJson());
  }

  exportControlReplace(): Promise<void> {
    return this.actors.replace.exportBundle((json: string): Promise<string | undefined> =>
      ReaderRuntimeOwner.current().saveRuleBundleJson(json, 'reader-replace-rules.json'));
  }

  publishQuickSearchState(state: ReaderQuickSearchState): void {
    this.actors.search.publish(state);
    this.view.advanceSearchRevision();
  }

  resetQuickSearch(): void {
    this.view.publishSearchQuery('');
    this.publishQuickSearchState({ kind: 'idle' });
  }

  updateQuickSearchQuery(query: string): void {
    if (query === this.view.searchQuery()) return;
    this.actors.search.cancel();
    this.view.publishSearchQuery(query);
    this.publishQuickSearchState({ kind: 'idle' });
  }

  runQuickSearch(): void {
    const keyword = this.view.searchQuery().trim();
    if (keyword.length === 0 || !this.searchVisible()) return;
    const mount = this.actors.mount();
    if (mount.gateway === undefined) {
      this.publishQuickSearchState({ kind: 'error', message: '书籍尚未载入，请先重试正文或切换书源。' });
      return;
    }
    const active = this.captureSearchOwner();
    this.actors.search.run(mount.activeGateway(), this.scene.scope().bookId, keyword, READER_CONTENT_SEARCH_PAGE_SIZE,
      active, this.view.advanceSearchRevision);
  }

  loadMoreQuickSearch(automatic: boolean = false): void {
    const active = this.captureSearchOwner();
    const bookId = this.scene.scope().bookId;
    if (automatic) this.actors.search.needMore(bookId, READER_CONTENT_SEARCH_PAGE_SIZE, active, this.view.advanceSearchRevision);
    else this.actors.search.more(bookId, READER_CONTENT_SEARCH_PAGE_SIZE, active, this.view.advanceSearchRevision);
  }

  selectSearchResult(result: ReadingContentSearchResult, scope: number, ordinal: number): void {
    const identity = this.scene.scope();
    if (result.bookId !== identity.bookId || result.sourceId !== identity.sourceId) return;
    const visual = this.actors.session.visualSession();
    const location = readerControlContentLocation(visual);
    const epoch = visual.epoch;
    const verification = this.actors.verification;
    const search = this.actors.search;
    const state = verification.observing() && location.level === 'secondary' &&
      location.module === 'search' && location.form === 'quick' ? search.stateAt(this.view.searchRevision()) : undefined;
    const readingId = state?.kind === 'results' && state.results[ordinal] === result && scope > 0 &&
      search.resultScrollScopeFor(state) === scope ? verification.observationIdentity() : '';
    this.actors.directory().observeQuickSelection(readingId, scope, ordinal, epoch, result);
  }

  canRefreshCurrentChapter(): boolean {
    return this.isControlInputEnabled() && this.scene.ready() && this.scene.viewportStart() !== undefined &&
      this.scene.currentChapter() !== undefined && !this.view.pageTurnSettlementActive() && !this.view.pageTurnInputOwned();
  }

  refreshCurrentChapter(): void {
    if (!this.canRefreshCurrentChapter()) return;
    const offset = this.scene.viewportStart();
    const chapter = this.scene.currentChapter();
    if (offset === undefined || chapter === undefined) return;
    this.effects.pauseAutomaticForRefresh();
    this.actors.directory().selectAnchor(chapter.chapterIndex, offset, false, true, undefined, -2, false, true);
  }

  private requestControlReplacePage(): void {
    const alreadyReplace = this.controlPage() === 'quickReplace';
    this.actors.replace.open(this.scene.bookTitle);
    this.setControlPage('quickReplace');
    // A same-module recovery already owns the committed presentation.
    if (alreadyReplace) this.prepareControlReplacePage();
  }

  private searchVisible(): boolean {
    return this.controlVisible() && (this.controlPage() === 'quickSearch' || this.controlPage() === 'fullSearch');
  }

  private captureSearchOwner(): () => boolean {
    const captured = this.scene.scope();
    return (): boolean => {
      if (!this.actors.mount().isSessionActive(captured.lifecycleToken)) return false;
      const current = this.scene.scope();
      return captured.bookId === current.bookId && captured.sourceId === current.sourceId && this.searchVisible();
    };
  }
}
