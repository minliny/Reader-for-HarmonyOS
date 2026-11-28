import { READER_LAYOUT_DEBUG_BUILD } from '../../../ui/foundation/ReaderLayoutInvariantSignals';
import type { LayoutInvariantTag } from '../../../ui/layout/LayoutInvariantEvaluator';
import { readerKeyboardHostBottom } from '../../../ui/layout/ReaderKeyboardGeometry';
import { ReaderEditingVisibility } from '../../../ui/layout/ReaderEditingVisibility';
import { ReaderEditingScrollBinding } from '../../../ui/layout/ReaderEditingScrollBinding';
import curves from '@ohos.curves';
import hilog from '@ohos.hilog';
import inputMethod from '@ohos.inputMethod';
import { PathShape } from '@ohos.arkui.shape';
import { FrameCallback, LengthMetrics } from '@kit.ArkUI';
import { ReaderWindowCoordinator } from '../../../app/ReaderWindowCoordinator';
import type { ReaderNavigationPreferences, ReaderSurfaceMaterialDecision } from '../../../app/HarmonyCapabilityPolicy';
import { readerVisualSafeBottom, readerInteractiveSafeLeft, readerInteractiveSafeRight } from '../../../ui/foundation/ReaderWindowMetrics';
import { ReaderFixedHeaderHost } from '../../../ui/layout/ReaderFixedHeaderHost';
import { ReaderHeaderFrameStyle } from '../../../ui/layout/ReaderFrameStyle';
import { ReaderPostLayoutFrame } from '../../../ui/layout/ReaderPostLayoutFrame';
import { readerPresentedHeaderBottom, readerPageAreaLength } from '../../../ui/layout/ReaderPageShell';
import { bookshelfHeaderSpec, searchHeaderSpec, SearchHeaderSpec } from '../../../ui/foundation/ReaderHeaderSpecs';
import { readerLibraryHeaderContentHeight } from '../../../ui/foundation/ReaderSurfaceResolvers';
import { readerSearchControlHeight, readerSearchControlVisualHeight, readerSearchActionWidth,
  SEARCH_CAPSULE_EMPTY_CHROME, SEARCH_CONTROL_MIN_TARGET } from '../../../ui/foundation/ReaderSearchControlGeometry';
import { resolveSearchHeaderField, SearchHeaderFieldGeometry } from '../../../ui/foundation/ReaderHeaderMetrics';
import { consumeReaderControlKeyboardBack } from '../../../ui/foundation/ReaderKeyboardBack';
import { readerAppColor } from '../../../ui/foundation/ReaderThemeRegistry';
import { readerSurfaceElevation, readerHeaderVeilBorder } from '../../../ui/surfaces/ReaderSurfaceSpecs';
import { defaultNavigationPreferences, ReaderImmersiveMaterialModifier, ReaderModalScrimModifier,
  readerSurfaceMaterialDecision } from '../../../ui/surfaces/ReaderSurfaceMaterial';
import { ReaderRaisedShape, resolveReaderRaisedShape } from '../../../ui/layout/ReaderRaisedShape';
import { motionSegment } from '../../../ui/foundation/MotionTimeline';
import { motionAnimateParam, motionSpecGet, readerMotionStandardCurve, MotionSpecEntry } from '../../../ui/foundation/MotionSpec';
import { readerMotionNowMs } from '../../../ui/foundation/ReaderMotionClock';
import { readerMotionReducedFadeParam } from '../../../ui/foundation/ReaderMotionPolicy';
import { readerTransitionFrameSamplingEnabled, readerTransitionsEnabled } from '../../../ui/foundation/ReaderTransitionSignals';
import { ReaderActionAccessibility } from '../../../ui/controls/ReaderActionAccessibility';
import { ReaderSearchField } from '../../../ui/controls/ReaderSearchField';
import type { ReaderSearchEditorEvent, ReaderSearchEditorObservation } from '../../../ui/controls/ReaderSearchField';
import { ReaderPressFeedback } from '../../../ui/foundation/ReaderPressFeedback';
import { readerPressAnimation, readerPressOpacity, readerPressPointer, readerPressScale } from '../../../ui/foundation/ReaderPressMotion';
import { READER_FONT_NOTO_SANS_SC_UI_BOLD } from '../../../ui/foundation/ReaderFontFamilies';
import { TYPE_SEARCH_BOOK_PANEL_INPUT } from '../../../ui/foundation/ReaderTypography';
import { ReaderSearchHistoryPanel, SearchHistoryMeasurements } from './ReaderSearchHistoryPanel';
import { projectSearchHistoryPanel, SearchHistoryGeometry, SearchHistoryPanelLayout, SearchHistoryViewport } from './SearchHistoryGeometry';
import type { ReaderSurfaceRect } from '../../../ui/layout/ReaderSurfaceRect';
import { ReaderLibrarySearchModel, READER_LIBRARY_SEARCH_BACK_FOCUS_ID } from '../presentation/ReaderLibrarySearchModel';

import type { LibrarySearchMode } from '../presentation/LibrarySearchPresentation';
import type { SearchHistoryStatus } from '../presentation/SearchPresentation';

type SearchSurfaceTransition = 'none' | 'open' | 'submit' | 'edit' | 'back';

interface SearchSurfaceEvidence {
  editorId: string;
  identity: number;
  navigation: number;
  mounting: number;
  owner: number;
  stacked: boolean;
  mode: LibrarySearchMode;
  semantic?: string;
  enabled?: boolean;
  focused?: boolean;
  length?: number;
  beforeLength?: number;
  start?: number;
  end?: number;
}

interface SearchEntryHistoryEvidence extends SearchSurfaceEvidence {
  stage: 'opening-end' | 'viewport';
  historyStatus: SearchHistoryStatus;
  feedbackEligible: boolean;
}

class LibrarySearchFrame extends FrameCallback {
  private action: () => void;
  constructor(action: () => void) { super(); this.action = action; }
  onFrame(_time: number): void { this.action(); }
  onIdle(_remaining: number): void {}
}
class LibrarySearchFocusFrame extends FrameCallback {
  private action: () => void;
  constructor(action: () => void) { super(); this.action = action; }
  onFrame(_time: number): void { this.action(); }
  onIdle(_remaining: number): void {}
}

/** Persistent library bar and its transition. SearchHost remains the owner of search facts. */
@Component
export struct ReaderLibrarySearchSurface {
  private readonly editingHost: ReaderEditingVisibility = new ReaderEditingVisibility();
  private readonly editingScroll: ReaderEditingScrollBinding = new ReaderEditingScrollBinding('reader-library-search-surface');
  private readonly editingScroller: Scroller = new Scroller();
  @StorageLink('readerAppScheme') private scheme: string = 'day';
  @StorageLink('readerSystemScheme') private systemScheme: string = 'day';
  @StorageProp('readerNavigationAppearancePreferences') private appearancePreferences: ReaderNavigationPreferences =
    defaultNavigationPreferences();
  @StorageLink('readerWindowMetricsRevision') @Watch('metricsChanged') private metricsRevision: number = 0;
  @ObjectLink @Watch('historyChanged') model: ReaderLibrarySearchModel;
  @Prop @Watch('modeChanged') mode: LibrarySearchMode = 'idle';
  /** Restoring a retained query is a stable frame, not a new shelf opening. */
  @Prop animateOnAppear: boolean = true;
  @Prop @Watch('metricsChanged') expandedLayout: boolean = false;
  @Prop @Watch('modeChanged') reduceMotion: boolean = false;
  @Prop @Watch('identityChanged') identity: number = 0;
  @Prop @Watch('presentationChanged') navigationGeneration: number = 0;
  @Prop @Watch('presentationChanged') mounting: number = 0;
  @Prop moreIdentity: string = '';
  @Prop headerScrolled: boolean = false;
  @Prop @Watch('metricsChanged') continueCardRect: ReaderSurfaceRect | undefined = undefined;
  onHistoryCoverageChanged: (suppressed: boolean, identity: number, generation: number, mounting: number) => void =
    (_suppressed: boolean, _identity: number, _generation: number, _mounting: number): void => {};
  @BuilderParam results: () => void = this.emptySlot;
  @Builder private emptySlot() {}
  onOpen: (identity: number, generation: number, mounting: number) => void = (_identity: number, _generation: number, _mounting: number): void => {};
  onBack: (identity: number, generation: number, mounting: number) => void = (_identity: number, _generation: number, _mounting: number): void => {};
  onInputRequested: (identity: number, generation: number, mounting: number) => void = (_identity: number, _generation: number, _mounting: number): void => {};
  onMore: (identity: number, generation: number, mounting: number, moreIdentity: string) => void =
    (_identity: number, _generation: number, _mounting: number, _moreIdentity: string): void => {};
  onHeaderBottom: (height: number, identity: number, measurementKey: number, generation: number, mounting: number) => void =
    (_height: number, _identity: number, _measurementKey: number, _generation: number, _mounting: number): void => {};
  onSettled: (mode: LibrarySearchMode, identity: number, generation: number, mounting: number) => void =
    (_mode: LibrarySearchMode, _identity: number, _generation: number, _mounting: number): void => {};

  private readonly spec: SearchHeaderSpec = searchHeaderSpec();
  private readonly openSpec: MotionSpecEntry = motionSpecGet('search.surface.open') as MotionSpecEntry;
  private readonly submitSpec: MotionSpecEntry = motionSpecGet('search.surface.submit') as MotionSpecEntry;
  private readonly backSpec: MotionSpecEntry = motionSpecGet('search.surface.back') as MotionSpecEntry;
  /** Beats inside the registered submit clock: retract history, then reveal. */
  private readonly submitRetractFraction: number = .3;
  /** Edit hands the results band back to history; the two tracks overlap. */
  private readonly editCollapseFraction: number = .5;
  private readonly editHistoryStartFraction: number = .28;
  private transitionKind: SearchSurfaceTransition = 'none';
  private transitionStartedMs: number = 0;
  private transitionDurationMs: number = 0;
  private currentMode: LibrarySearchMode = 'idle';
  private fromSurface: number = 0;
  private fromHistory: number = 0;
  private fromResults: number = 0;
  private fromScrim: number = 0;
  private fromShadowStrength: number = 1;
  private toSurface: number = 0;
  private toHistory: number = 0;
  private toResults: number = 0;
  private toScrim: number = 0;
  private generation: number = 0;
  private scheduledToken: number = -1;
  private mounted: boolean = false;
  private activeNavigation: number = 0;
  private activeMounting: number = 0;
  private activeIdentity: number = 0;
  @State private surfaceWindowY: number = 0;
  @State private surfaceViewportHeight: number = -1;
  @State private measuredHistoryFeedback: number = 0;
  @State private measuredHistoryFeedbackKey: string = '';
  private readonly historyMeasurements: SearchHistoryMeasurements = new SearchHistoryMeasurements();
  private historyProjectionKey: string = '';
  private lastCardSuppressed: boolean = false;
  private lastCardCoverageScope: string = '';
  private cardCoverageRevision: number = 0;
  private fieldFocused: boolean = false;
  private automaticInputFocusAllowed: boolean = true;
  private unbindInputBack: (() => void) | undefined;
  private unbindInputFocusReady: (() => void) | undefined;
  private pendingInputFocus: ((owner: number) => void) | undefined;
  @State private elapsed: number = 0;
  @State private reducedTransition: boolean = false;
  @State private nativeSearchMotion: boolean = false;
  @State private reducedSearchOpacity: number = 1;
  @State private displayedSurfaceProgress: number = 0;
  @State private displayedHistoryProgress: number = 0;
  @State private displayedResultsProgress: number = 0;
  @State private displayedScrimProgress: number = 0;
  @State private displayedShadowStrength: number = 1;
  @State private headerBottom: number = bookshelfHeaderSpec().frameHeight;
  @State private historyHeight: number = 0;
  @State private displayedHistoryViewport: number = 0;
  @State private displayedHistoryLimit: number = 0;
  @State private historyExpanded: boolean = false;
  @State private historyResizeOpacity: number = 1;
  private historyToggleRevision: number = 0;
  private historyResizeRevision: number = 0;
  private historyResizeHoldingCoverage: boolean = false;
  @State private searchMounted: boolean = false;
  @State private measurementKey: number = 0;
  @State private headerRaisedShape: ReaderRaisedShape | undefined = undefined;
  private raisedAppearanceEpoch: number = 0;
  private historyOpeningField: string = '';
  private historyObservationKey: string = '';
  @State private searchActionPointer: number = -1;

  aboutToAppear(): void {
    this.raisedAppearanceEpoch += 1;
    this.headerRaisedShape = undefined;
    this.lastCardCoverageScope = '';
    this.mounted = true;
    this.automaticInputFocusAllowed = true;
    this.unbindInputBack = this.model.bindInputBack((): boolean => this.consumeInputBack());
    this.unbindInputFocusReady = this.model.bindInputFocusReady((owner: number): void => {
      const pending = this.pendingInputFocus;
      this.pendingInputFocus = undefined;
      pending?.(owner);
    });
    this.retargetHistoryViewport(true);
    if (!this.animateOnAppear || this.mode === 'idle') {
      this.snapToMode(this.mode);
      if (this.mode === 'input') this.scheduleInputFocus(this.generation, 0);
      return;
    }
    this.currentMode = this.mode;
    this.fromSurface = 0;
    this.fromHistory = 0;
    this.fromResults = 0;
    this.fromScrim = 0;
    this.fromShadowStrength = 1;
    this.applyTargets(this.mode);
    this.transitionKind = this.mode === 'results' ? 'submit' : 'open';
    this.transitionDurationMs = this.durationFor(this.transitionKind);
    this.transitionStartedMs = readerMotionNowMs();
    this.elapsed = 0;
    this.displayedSurfaceProgress = this.sampleSurfaceProgress();
    this.searchMounted = true;
    this.measurementKey += 1;
    this.activeIdentity = this.identity;
    this.activeNavigation = this.navigationGeneration;
    this.activeMounting = this.mounting;
    const token = ++this.generation;
    if (this.reduceMotion) this.beginReducedTransition(token);
    else if (this.usesNativeTransition()) this.beginNativeTransition(token, true);
    else this.schedule(token);
  }
  aboutToDisappear(): void {
    this.mounted = false;
    this.searchActionPointer = -1;
    this.generation += 1;
    this.cardCoverageRevision += 1;
    this.historyResizeRevision += 1;
    this.unbindInputBack?.();
    this.unbindInputBack = undefined;
    this.unbindInputFocusReady?.();
    this.unbindInputFocusReady = undefined;
    this.pendingInputFocus = undefined;
  }

  private applyTargets(mode: LibrarySearchMode): void {
    this.toSurface = mode === 'idle' ? 0 : 1;
    this.toHistory = mode === 'input' ? 1 : 0;
    this.toResults = mode === 'results' ? 1 : 0;
    this.toScrim = mode === 'input' ? 1 : 0;
  }
  private snapToMode(mode: LibrarySearchMode): void {
    this.currentMode = mode;
    this.applyTargets(mode);
    this.fromSurface = this.toSurface;
    this.fromHistory = this.toHistory;
    this.fromResults = this.toResults;
    this.fromScrim = this.toScrim;
    this.transitionKind = 'none';
    this.reducedTransition = false;
    this.reducedSearchOpacity = 1;
    this.transitionDurationMs = 0;
    this.transitionStartedMs = 0;
    this.elapsed = 0;
    this.displayedSurfaceProgress = this.toSurface;
    this.searchMounted = mode !== 'idle';
    this.activeIdentity = this.identity;
    this.activeNavigation = this.navigationGeneration;
    this.activeMounting = this.mounting;
  }
  private transitionFor(previous: LibrarySearchMode, next: LibrarySearchMode): SearchSurfaceTransition {
    if (next === 'idle') return previous === 'idle' ? 'none' : 'back';
    if (next === 'input') return previous === 'results' ? 'edit' : previous === 'idle' ? 'open' : 'none';
    if (next === 'results') return previous === 'input' ? 'submit' : 'none';
    return 'none';
  }
  private durationFor(kind: SearchSurfaceTransition): number {
    if (kind === 'open') return this.openSpec.durationMs;
    if (kind === 'submit') return this.submitSpec.durationMs;
    if (kind === 'edit' || kind === 'back') return this.backSpec.durationMs;
    return 0;
  }
  private modeChanged(): void {
    if (!this.mounted) return;
    const next = this.mode;
    const newEntry = this.activeIdentity !== this.identity || this.activeMounting !== this.mounting;
    if (newEntry) {
      this.historyExpanded = false;
      this.historyResizeOpacity = 1;
      this.historyToggleRevision += 1;
    }
    if (next === this.currentMode) {
      this.activeNavigation = this.navigationGeneration;
      this.activeMounting = this.mounting;
      this.activeIdentity = this.identity;
      if (newEntry) this.retargetHistoryViewport(true);
      else this.publishContinueCardCoverage(this.resolvedHistoryViewport().suppressContinueCard);
      if (this.reduceMotion && this.transitionKind !== 'none' && !this.reducedTransition) {
        this.fromSurface = this.displayedSurfaceProgress;
        this.fromHistory = this.historyProgress();
        this.fromResults = this.resultsProgress();
        this.fromScrim = this.scrimProgress();
        this.fromShadowStrength = this.headerShadowStrength();
        this.beginReducedTransition(++this.generation);
      }
      return;
    }
    const previous = this.currentMode;
    this.historyResizeOpacity = 1;
    this.searchActionPointer = -1;
    this.fromSurface = this.displayedSurfaceProgress;
    this.fromHistory = this.historyProgress();
    this.fromResults = this.resultsProgress();
    this.fromScrim = this.scrimProgress();
    this.fromShadowStrength = this.headerShadowStrength();
    this.currentMode = next;
    this.measurementKey += 1;
    const token = ++this.generation;
    this.pendingInputFocus = undefined;
    this.activeNavigation = this.navigationGeneration;
    this.activeMounting = this.mounting;
    this.activeIdentity = this.identity;
    this.automaticInputFocusAllowed = next === 'input';
    if (next !== 'input') this.fieldFocused = false;
    this.applyTargets(next);
    this.reducedTransition = false;
    this.nativeSearchMotion = false;
    this.reducedSearchOpacity = 1;
    this.transitionKind = this.transitionFor(previous, next);
    this.transitionDurationMs = this.durationFor(this.transitionKind);
    this.transitionStartedMs = readerMotionNowMs();
    this.elapsed = 0;
    this.displayedSurfaceProgress = this.sampleSurfaceProgress();
    this.retargetHistoryViewport();
    if (next === 'results' || next === 'idle') this.getUIContext().getFocusController().clearFocus();
    if (next !== 'idle') this.searchMounted = true;
    if (this.transitionKind === 'none' || this.transitionDurationMs <= 0) this.completeTransition(true);
    else if (this.reduceMotion) this.beginReducedTransition(token);
    else if (this.usesNativeTransition()) this.beginNativeTransition(token, previous === 'idle');
    else this.schedule(token);
  }
  private usesNativeTransition(): boolean {
    return !readerTransitionFrameSamplingEnabled() && this.model.verification?.enabled() !== true;
  }
  private beginNativeTransition(token: number, deferFirstFrame: boolean): void {
    this.nativeSearchMotion = true;
    this.displayedSurfaceProgress = this.fromSurface;
    this.displayedHistoryProgress = this.fromHistory;
    this.displayedResultsProgress = this.fromResults;
    this.displayedScrimProgress = this.fromScrim;
    this.displayedShadowStrength = this.fromShadowStrength;
    const duration = Math.max(0, this.transitionDurationMs);
    const targetShadow = this.blend(1, .55, this.toResults);
    const current = (): boolean => this.mounted && token === this.generation && this.nativeSearchMotion;
    const finish = (): void => { if (current()) this.completeTransition(); };
    const run = (): void => {
      if (!current()) return;
      try {
        this.getUIContext().animateTo({ duration, curve: readerMotionStandardCurve(), onFinish: finish }, (): void => {
          this.displayedSurfaceProgress = this.toSurface;
          this.displayedHistoryProgress = this.toHistory;
          this.displayedResultsProgress = this.toResults;
          this.displayedScrimProgress = this.toScrim;
          this.displayedShadowStrength = targetShadow;
        });
        setTimeout((): void => { finish(); }, duration + 80);
      } catch (_) { finish(); }
    };
    if (deferFirstFrame) {
      try {
        const context = this.getUIContext();
        context.postFrameCallback(new ReaderPostLayoutFrame(context, run));
      } catch (_) { run(); }
    } else {
      run();
    }
  }
  private beginReducedTransition(token: number): void {
    this.reducedTransition = true;
    const closing = this.transitionKind === 'back';
    this.reducedSearchOpacity = closing ? 1 : 0;
    this.displayedSurfaceProgress = closing ? this.fromSurface : this.toSurface;
    this.retargetHistoryViewport(true);
    const current = (): boolean => this.mounted && token === this.generation && this.reducedTransition;
    const finish = (): void => { if (current()) this.completeTransition(); };
    try {
      const context = this.getUIContext();
      context.postFrameCallback(new ReaderPostLayoutFrame(context, (): void => {
        if (!current()) return;
        try {
          context.animateTo(readerMotionReducedFadeParam(finish),
            (): void => { this.reducedSearchOpacity = closing ? 0 : 1; });
        } catch (_) { finish(); }
      }));
    } catch (_) {
      void Promise.resolve().then(finish);
    }
  }
  private identityChanged(): void { this.modeChanged(); }
  private presentationChanged(): void { this.modeChanged(); }
  private metricsChanged(): void {
    if (!this.mounted) return;
    this.measurementKey += 1;
    this.retargetHistoryViewport();
  }
  private historyChanged(): void {
    if (!this.mounted) return;
    const key = JSON.stringify([this.model.historyStatus, this.model.history]);
    if (key === this.historyProjectionKey) return;
    this.historyProjectionKey = key;
    this.retargetHistoryViewport();
    this.observeEntryHistory(false);
  }
  private retargetHistoryViewport(instant: boolean = false): void {
    const viewport = this.resolvedHistoryViewport();
    const limit = this.historyLimit();
    this.historyHeight = viewport.height;
    if (this.displayedHistoryViewport === viewport.height && this.displayedHistoryLimit === limit) {
      if (instant || this.reduceMotion) this.historyResizeHoldingCoverage = false;
      this.publishContinueCardCoverage(viewport.suppressContinueCard);
      return;
    }
    const previous = this.displayedHistoryViewport;
    const revision = ++this.historyResizeRevision;
    this.historyResizeHoldingCoverage = !instant && !this.reduceMotion && this.mode === 'input' &&
      this.lastCardSuppressed && (this.historyResizeHoldingCoverage || previous > viewport.height);
    this.publishContinueCardCoverage(viewport.suppressContinueCard);
    const publish = (): void => {
      this.displayedHistoryViewport = viewport.height;
      this.displayedHistoryLimit = limit;
    };
    const finish = (): void => {
      if (!this.mounted || revision !== this.historyResizeRevision || !this.historyResizeHoldingCoverage) return;
      this.historyResizeHoldingCoverage = false;
      this.publishContinueCardCoverage(this.resolvedHistoryViewport().suppressContinueCard);
    };
    if (instant || this.reduceMotion) publish();
    else {
      try { this.getUIContext().animateTo(motionAnimateParam('search.history.resize', finish), publish); }
      catch (_) { publish(); finish(); }
    }
  }
  private publishContinueCardCoverage(inputWouldCover: boolean): void {
    const suppressed = this.mode === 'input' ? inputWouldCover || this.historyResizeHoldingCoverage :
      this.lastCardSuppressed && this.historyProgress() > .01;
    const scope = `${this.identity}:${this.navigationGeneration}:${this.mounting}`;
    // The retained surface may still cover the card after its scope changes.
    const publish = suppressed !== this.lastCardSuppressed || (suppressed && scope !== this.lastCardCoverageScope);
    this.lastCardCoverageScope = scope;
    this.lastCardSuppressed = suppressed;
    if (publish) {
      // Coverage can outlive a motion generation while history is still visible.
      const revision = ++this.cardCoverageRevision;
      const identity = this.identity, navigation = this.navigationGeneration, mounting = this.mounting;
      this.getUIContext().postFrameCallback(new LibrarySearchFrame((): void => {
        if (this.mounted && revision === this.cardCoverageRevision && identity === this.identity &&
          navigation === this.navigationGeneration && mounting === this.mounting)
          this.onHistoryCoverageChanged(suppressed, identity, navigation, mounting);
      }));
    }
  }
  private schedule(token: number): void {
    if (!this.mounted || this.scheduledToken === token) return;
    this.scheduledToken = token;
    this.getUIContext().postFrameCallback(new LibrarySearchFrame((): void => {
      if (this.scheduledToken === token) this.scheduledToken = -1;
      if (!this.mounted || token !== this.generation) return;
      const now = readerMotionNowMs();
      let running = false;
      if (this.transitionKind !== 'none' && !this.reducedTransition) {
        const next = Math.min(this.transitionDurationMs, Math.max(0, now - this.transitionStartedMs));
        if (next >= this.transitionDurationMs) this.completeTransition();
        else {
          this.elapsed = next;
          this.displayedSurfaceProgress = this.sampleSurfaceProgress();
          if (this.mode !== 'input' && this.lastCardSuppressed && this.historyProgress() <= .01) {
            this.publishContinueCardCoverage(false);
          }
          running = true;
        }
      }
      this.observeEntryHistory(false);
      if (running) this.schedule(token);
    }));
  }
  private completeTransition(deferParent: boolean = false): void {
    const token = this.generation;
    const wasOpen = this.transitionKind === 'open';
    this.transitionKind = 'none';
    this.reducedTransition = false;
    this.nativeSearchMotion = false;
    this.reducedSearchOpacity = 1;
    this.transitionDurationMs = 0;
    this.transitionStartedMs = 0;
    // Publish the exact painted endpoint independently of the animation clock reset.
    this.displayedSurfaceProgress = this.toSurface;
    this.displayedHistoryProgress = this.toHistory;
    this.displayedResultsProgress = this.toResults;
    this.displayedScrimProgress = this.toScrim;
    this.displayedShadowStrength = this.blend(1, .55, this.toResults);
    this.elapsed = 0;
    if (this.mode === 'idle') {
      this.searchMounted = false;
      this.historyExpanded = false;
    }
    if (this.mode !== 'input') {
      this.fieldFocused = false;
      this.publishContinueCardCoverage(false);
    }
    if (this.mode === 'input' && wasOpen) this.scheduleInputFocus(token, 0);
    if (this.activeIdentity === this.identity && this.activeNavigation === this.navigationGeneration &&
      this.activeMounting === this.mounting) {
      const mode = this.mode, identity = this.activeIdentity, navigation = this.activeNavigation, mounting = this.activeMounting;
      const notify = (): void => {
        if (this.mounted && token === this.generation && mode === this.mode && identity === this.identity &&
          navigation === this.navigationGeneration && mounting === this.mounting) {
          const verification = this.model.verification;
          if (mode !== 'idle' && verification !== undefined && verification.enabled()) {
            verification.emit('search-header-layout', 'probe', this.surfaceEvidence(
              this.model.currentOwner(), this.fieldIdentity()));
          }
          this.onSettled(mode, identity, navigation, mounting);
          if (wasOpen) this.observeEntryHistory(true);
        }
      };
      if (deferParent) this.getUIContext().postFrameCallback(new LibrarySearchFrame(notify));
      else notify();
    }
  }
  private scheduleInputFocus(token: number, attempt: number): void {
    const identity = this.identity;
    const navigation = this.navigationGeneration;
    const mounting = this.mounting;
    const request = (): void => {
      const owner = this.model.currentOwner();
      if (!this.mounted || token !== this.generation || this.mode !== 'input' || !this.searchMounted ||
        !this.automaticInputFocusAllowed || this.fieldFocused || this.model.panelOwnsInput || identity !== this.identity ||
        navigation !== this.navigationGeneration || mounting !== this.mounting) return;
      if (owner !== 0 && this.model.owns(owner) && this.model.interactive) {
        if (this.model.fieldKeyboardOnFocus === undefined) {
          // Hold this entry's focus request until the source read chooses whether to show the IME.
          this.pendingInputFocus = (readyOwner: number): void => {
            if (readyOwner !== owner) return;
            this.getUIContext().postFrameCallback(new LibrarySearchFocusFrame((): void => {
              if (this.model.owns(owner)) request();
            }));
          };
          return;
        }
        this.getUIContext().getFocusController().requestFocus('reader-book-search-input');
      }
      if (!this.fieldFocused && attempt < 3) this.scheduleInputFocus(token, attempt + 1);
    };
    this.getUIContext().postFrameCallback(new LibrarySearchFocusFrame(request));
  }
  private segment(startMs: number, durationMs: number, entry: MotionSpecEntry): number {
    return motionSegment(this.elapsed, startMs, durationMs, (fraction: number): number =>
      (entry.curve as curves.ICurve).interpolate(fraction));
  }
  private backFraction(): number { return this.segment(0, this.backSpec.durationMs, this.backSpec); }
  private sampleSurfaceProgress(): number {
    if (this.transitionKind === 'open') {
      return this.blend(this.fromSurface, this.toSurface, this.segment(0, this.openSpec.durationMs, this.openSpec));
    }
    if (this.transitionKind === 'back') return this.blend(this.fromSurface, this.toSurface, this.backFraction());
    return this.toSurface;
  }
  private surfaceProgress(): number { return this.displayedSurfaceProgress; }
  private resultsProgress(): number {
    if (this.nativeSearchMotion) return this.displayedResultsProgress;
    if (this.reducedTransition) return this.transitionKind === 'back' ? this.fromResults : this.toResults;
    if (this.transitionKind === 'open') {
      return this.blend(this.fromResults, this.toResults, this.segment(0, this.openSpec.durationMs, this.openSpec));
    }
    if (this.transitionKind === 'submit') {
      const start = this.submitSpec.durationMs * this.submitRetractFraction;
      return this.blend(this.fromResults, this.toResults,
        this.segment(start, this.submitSpec.durationMs - start, this.submitSpec));
    }
    if (this.transitionKind === 'edit') {
      const end = this.backSpec.durationMs * this.editCollapseFraction;
      return this.blend(this.fromResults, this.toResults, this.segment(0, end, this.backSpec));
    }
    if (this.transitionKind === 'back') return this.blend(this.fromResults, this.toResults, this.backFraction());
    return this.toResults;
  }
  private historyProgress(): number {
    if (this.nativeSearchMotion) return this.displayedHistoryProgress;
    if (this.reducedTransition) return this.transitionKind === 'back' ? this.fromHistory : this.toHistory;
    if (this.transitionKind === 'open') {
      return this.blend(this.fromHistory, this.toHistory, this.segment(0, this.openSpec.durationMs, this.openSpec));
    }
    if (this.transitionKind === 'submit') {
      const end = this.submitSpec.durationMs * this.submitRetractFraction;
      return this.blend(this.fromHistory, this.toHistory, this.segment(0, end, this.submitSpec));
    }
    if (this.transitionKind === 'edit') {
      const start = this.backSpec.durationMs * this.editHistoryStartFraction;
      return this.blend(this.fromHistory, this.toHistory,
        this.segment(start, this.backSpec.durationMs - start, this.backSpec));
    }
    if (this.transitionKind === 'back') return this.blend(this.fromHistory, this.toHistory, this.backFraction());
    return this.toHistory;
  }
  private scrimProgress(): number {
    if (this.nativeSearchMotion) return this.displayedScrimProgress;
    if (this.reducedTransition) return this.transitionKind === 'back' ? this.fromScrim : this.toScrim;
    if (this.transitionKind === 'open') {
      return this.blend(this.fromScrim, this.toScrim, this.segment(0, this.openSpec.durationMs, this.openSpec));
    }
    if (this.transitionKind === 'submit') {
      const start = this.submitSpec.durationMs * this.submitRetractFraction;
      return this.blend(this.fromScrim, this.toScrim,
        this.segment(start, this.submitSpec.durationMs - start, this.submitSpec));
    }
    if (this.transitionKind === 'edit') {
      const end = this.backSpec.durationMs * this.editCollapseFraction;
      return this.blend(this.fromScrim, this.toScrim, this.segment(0, end, this.backSpec));
    }
    if (this.transitionKind === 'back') return this.blend(this.fromScrim, this.toScrim, this.backFraction());
    return this.toScrim;
  }
  private inputInteractive(): boolean {
    if (!this.model.interactive || this.model.panelOwnsInput || this.reducedTransition || this.nativeSearchMotion) return false;
    if (this.mode === 'input') return this.surfaceProgress() >= 1 && this.historyProgress() >= 1;
    if (this.mode === 'results') return this.resultsProgress() >= 1;
    return false;
  }
  private historyInteractive(): boolean {
    return this.mode === 'input' && this.inputInteractive();
  }
  private controlHeight(): number {
    return readerSearchControlHeight(this.fontScale());
  }
  private searchActionVisualHeight(): number {
    return readerSearchControlVisualHeight(this.fontScale());
  }
  private fontScale(): number {
    const scale = this.metricsRevision < 0 ? 1 : ReaderWindowCoordinator.metrics().systemFontScale;
    return Number.isFinite(scale) && scale > 0 ? scale : 1;
  }
  private blend(a: number, b: number, fraction: number): number { return a + (b - a) * fraction; }
  private surfaceValue(): number {
    const progress = Math.max(0, Math.min(1, this.surfaceProgress()));
    if (progress === 0 || progress === 1) return progress;
    const laneWidthPx = this.searchLaneWidth() * ReaderWindowCoordinator.metrics().densityPixels;
    // A subpixel reveal can round differently in the clipping Stack and its Flex.
    return laneWidthPx > 0 && (1 - progress) * laneWidthPx < 1 ? 1 : progress;
  }
  private titleOpacity(): number { return 1 - Math.min(1, this.surfaceValue() / .45); }
  private barHeight(): number {
    const shelf = bookshelfHeaderSpec();
    const searchBarHeight = this.searchMounted ? this.spec.barHeight(this.searchLaneHeight()) : undefined;
    return readerLibraryHeaderContentHeight(shelf.barHeight, shelf.titleLineHeight, this.fontScale(), this.spec.borderWidth,
      searchBarHeight, this.searchMounted ? this.surfaceValue() : 0);
  }
  private trailingWidth(): number {
    return this.blend(bookshelfHeaderSpec().actionExtent,
      readerSearchActionWidth(this.expandedLayout, this.fontScale()), this.surfaceValue());
  }
  private horizontalInset(left: boolean): number {
    this.metricsRevision;
    const metrics = ReaderWindowCoordinator.metrics();
    const safe = left ? readerInteractiveSafeLeft(metrics) : readerInteractiveSafeRight(metrics);
    return Math.max(this.spec.outerInset(this.expandedLayout), safe);
  }
  private fieldIdentity(): string {
    return JSON.stringify([this.identity, this.navigationGeneration, this.mounting, this.model.currentOwner()]);
  }
  private surfaceEvidence(owner: number, field: string): SearchSurfaceEvidence {
    return { editorId: field, identity: this.identity, navigation: this.navigationGeneration, mounting: this.mounting,
      owner: owner, stacked: this.stackedSearch(), mode: this.mode };
  }
  private bookEditorObservation(owner: number, field: string):
    ((event: ReaderSearchEditorEvent, facts: ReaderSearchEditorObservation) => void) | undefined {
    const verification = this.model.verification;
    if (verification === undefined || !verification.enabled()) return undefined;
    const identity = this.identity, navigation = this.navigationGeneration, mounting = this.mounting;
    return (event: ReaderSearchEditorEvent, facts: ReaderSearchEditorObservation): void => {
      if (event !== 'unmounted' && (!this.acceptsField(owner, field) || this.model.panelOwnsInput)) return;
      const observation: SearchSurfaceEvidence = { editorId: field, identity: identity, navigation: navigation,
        mounting: mounting, owner: owner, stacked: this.stackedSearch(), mode: this.mode,
        focused: facts.focused, length: facts.length, beforeLength: facts.beforeLength,
        start: facts.start, end: facts.end };
      verification.emit(`search-editor-${event}`, 'input', observation);
    };
  }
  private consumeInputBack(): boolean {
    if (!this.mounted || this.mode === 'idle' || !this.searchMounted ||
      this.model.currentOwner() === 0) return false;
    const field = this.fieldIdentity();
    return consumeReaderControlKeyboardBack(ReaderWindowCoordinator.metrics(), {
      hideTextInput: (): Promise<void> => {
        // Back can take focus before the native keyboard finishes closing.
        this.automaticInputFocusAllowed = false;
        try { this.getUIContext().getFocusController().clearFocus(); } catch (_unavailableFocus) {}
        return inputMethod.getController().hideTextInput();
      },
      onFailure: (error: Error): void => {
        if (this.mounted && field === this.fieldIdentity())
          hilog.warn(0x5244, 'Reader', 'Library search keyboard dismissal: %{private}s', error.message);
      },
    });
  }
  private leadingAction(identity: number, generation: number, mounting: number): () => void {
    return (): void => {
      if (!this.mounted || this.transitionKind === 'back' || this.model.panelOwnsInput) return;
      if (this.mode === 'idle') this.onOpen(identity, generation, mounting);
      else this.onBack(identity, generation, mounting);
    };
  }
  private moreAction(identity: number, generation: number, mounting: number, moreIdentity: string): () => void {
    return (): void => this.onMore(identity, generation, mounting, moreIdentity);
  }
  private backAction(identity: number, generation: number, mounting: number): () => void {
    return (): void => this.onBack(identity, generation, mounting);
  }
  private focusAction(owner: number, field: string): (focused: boolean) => void {
    const identity = this.identity;
    const generation = this.navigationGeneration;
    const mounting = this.mounting;
    return (focused: boolean): void => {
      if (!this.acceptsField(owner, field)) return;
      this.fieldFocused = focused;
      if (!focused || this.model.panelOwnsInput) return;
      this.model.dispatchFieldFocus(owner);
      if (this.mode === 'results' && this.resultsProgress() >= 1) {
        this.onInputRequested(identity, generation, mounting);
      }
    };
  }
  private acceptsField(owner: number, field: string): boolean {
    return this.mounted && this.fieldIdentity() === field && this.model.owns(owner) &&
      this.model.interactive && this.transitionKind !== 'back';
  }
  private textAction(owner: number, field: string): (value: string) => void {
    return (value: string): void => {
      if (this.acceptsField(owner, field)) this.model.dispatchText(owner, value);
    };
  }
  private clearAction(owner: number, field: string): () => void {
    const identity = this.identity;
    const generation = this.navigationGeneration;
    const mounting = this.mounting;
    return (): void => {
      if (this.acceptsField(owner, field) && !this.model.panelOwnsInput && this.mode === 'results') {
        this.onInputRequested(identity, generation, mounting);
      }
    };
  }
  private submitAction(owner: number, field: string): () => void {
    return (): void => {
      if (!this.acceptsField(owner, field) || this.model.panelOwnsInput) return;
      const verification = this.model.verification;
      if (!this.model.sweeping && verification?.enabled() === true) {
        const facts = this.surfaceEvidence(owner, field);
        facts.semantic = 'search';
        facts.enabled = true;
        verification.emit('search-ime-intent', 'input', facts);
      }
      this.model.dispatchSubmit(owner);
    };
  }
  private searchAction(owner: number, field: string): () => void {
    return (): void => {
      if (!this.acceptsField(owner, field) || !this.actionInteractive()) return;
      const verification = this.model.verification;
      if (verification?.enabled() === true) {
        const facts = this.surfaceEvidence(owner, field);
        facts.semantic = this.model.sweeping ? 'stop' : 'search';
        facts.enabled = true;
        verification.emit(this.model.sweeping ? 'search-stop-intent' : 'search-button-intent', 'input', facts);
      }
      this.model.dispatchAction(owner);
    };
  }
  private historyAction(owner: number): (value: string) => void {
    return (value: string): void => {
      if (!this.mounted || !this.historyInteractive() || !this.model.owns(owner)) return;
      const verification = this.model.verification;
      if (verification?.enabled() === true) {
        const facts = this.surfaceEvidence(owner, this.fieldIdentity());
        facts.semantic = 'search';
        facts.enabled = true;
        facts.length = value.trim().length;
        verification.emit('search-history-intent', 'input', facts);
      }
      this.model.dispatchHistory(owner, value);
    };
  }
  private clearHistoryAction(owner: number): () => void {
    return (): void => {
      if (this.mounted && this.historyInteractive()) this.model.dispatchClearHistory(owner);
    };
  }
  private retryHistoryAction(owner: number): () => void {
    return (): void => {
      if (this.mounted && this.historyInteractive()) this.model.dispatchRetryHistory(owner);
    };
  }
  private toggleHistoryAction(owner: number): () => void {
    return (): void => {
      if (!this.mounted || !this.historyInteractive() || !this.model.owns(owner) ||
        this.model.historyStatus === 'loading') return;
      const layout = this.historyLayout();
      if (!layout.canToggle) return;
      this.historyExpanded = !layout.expanded;
      const toggleRevision = ++this.historyToggleRevision;
      if (!this.reduceMotion) {
        this.retargetHistoryViewport();
        return;
      }
      const generation = this.generation;
      const context = this.getUIContext();
      this.historyResizeOpacity = 0;
      this.retargetHistoryViewport(true);
      try {
        context.postFrameCallback(new LibrarySearchFrame((): void => {
          if (!this.mounted || generation !== this.generation || toggleRevision !== this.historyToggleRevision) return;
          try {
            context.animateTo(readerMotionReducedFadeParam(), (): void => { this.historyResizeOpacity = 1; });
          } catch (_) { this.historyResizeOpacity = 1; }
        }));
      } catch (_) { this.historyResizeOpacity = 1; }
    };
  }
  private contentHeight(): number {
    return Math.max(0, this.surfaceHeight() - this.headerBottom);
  }
  private surfaceHeight(): number {
    this.metricsRevision;
    const windowHeight = Math.max(0, ReaderWindowCoordinator.metrics().windowRect.height - this.surfaceWindowY);
    return this.surfaceViewportHeight >= 0 ? Math.min(windowHeight, this.surfaceViewportHeight) : windowHeight;
  }
  private availableBottom(): number {
    const metrics = ReaderWindowCoordinator.metrics();
    return readerKeyboardHostBottom(metrics, this.surfaceWindowY, this.surfaceHeight());
  }
  private historyBarBottom(): number {
    return readerPresentedHeaderBottom(bookshelfHeaderSpec().topInset,
      this.spec.barHeight(this.searchLaneHeight()) + 2 * this.spec.borderWidth);
  }
  private historyLimit(): number { return Math.max(0, this.availableBottom() - this.historyBarBottom()); }
  private captureHeader(height: number, key: number): void {
    if (!this.mounted || key !== this.measurementKey || !Number.isFinite(height) || height <= 0) return;
    const bottom = readerPresentedHeaderBottom(bookshelfHeaderSpec().topInset, height);
    if (Math.abs(bottom - this.headerBottom) > .1) this.headerBottom = bottom;
    this.onHeaderBottom(bottom, this.identity, key, this.navigationGeneration, this.mounting);
  }
  private cardContentWidth(): number {
    const metrics = ReaderWindowCoordinator.metrics();
    return Math.max(0, metrics.windowRect.width - this.horizontalInset(true) - this.horizontalInset(false) -
      2 * this.spec.borderWidth);
  }
  private actionWidth(): number { return readerSearchActionWidth(this.expandedLayout, this.fontScale()); }
  private searchLaneLeft(): number { return this.spec.barPaddingLeft + bookshelfHeaderSpec().actionExtent; }
  private searchLaneWidth(): number {
    return Math.max(0, this.cardContentWidth() - this.searchLaneLeft() - this.spec.barPaddingRight);
  }
  private searchHeaderField(): SearchHeaderFieldGeometry {
    return resolveSearchHeaderField(this.searchLaneWidth(), this.actionWidth(), SEARCH_CAPSULE_EMPTY_CHROME,
      TYPE_SEARCH_BOOK_PANEL_INPUT.fontSizeFp * Math.max(1, this.fontScale()));
  }
  private stackedSearch(): boolean { return this.searchHeaderField().stacked; }
  private searchLaneHeight(): number {
    return this.stackedSearch() ? this.controlHeight() * 2 + this.spec.fieldGap : this.controlHeight();
  }
  private laneTop(): number { return this.spec.barPaddingTop; }
  // The icon describes the current destination state. The closing track may
  // still retire the search content, but an idle bookshelf owns a search entry.
  private presentedSearch(): boolean { return this.mode !== 'idle'; }
  private actionInteractive(): boolean {
    return this.model.interactive && !this.model.panelOwnsInput && this.presentedSearch() && this.transitionKind !== 'back' &&
      (this.inputInteractive() || this.model.sweeping) && (this.model.sweeping || this.model.canSubmit);
  }
  private resolvedHistoryViewport(): SearchHistoryViewport {
    const height = this.historyLayout().height;
    const cardTop = this.continueCardRect === undefined ? 0 : this.continueCardRect.y - this.surfaceWindowY;
    const cardBottom = cardTop + (this.continueCardRect?.height ?? 0);
    return new SearchHistoryViewport(height, this.historyBarBottom(), this.availableBottom(), cardBottom, cardTop);
  }
  private historyGeometry(): SearchHistoryGeometry {
    return new SearchHistoryGeometry(this.cardContentWidth(), this.historyLimit(), this.fontScale(),
      this.expandedLayout, this.model.historyStatus ?? '',
      this.measuredHistoryFeedbackKey === this.historyFeedbackKey() ? this.measuredHistoryFeedback : 0,
      this.spec.panelInnerInset);
  }
  private historyLayout(): SearchHistoryPanelLayout {
    return projectSearchHistoryPanel(this.model.history, this.historyGeometry(), this.historyExpanded, (keyword: string): number =>
      this.historyMeasurements.measureControlWidth(this.getUIContext(), this.metricsRevision, keyword));
  }
  private historyFeedbackKey(): string {
    return JSON.stringify([this.metricsRevision, this.cardContentWidth(), this.model.historyStatus]);
  }
  private observeEntryHistory(openingEnd: boolean): void {
    const verification = this.model.verification;
    const status = this.model.historyStatus;
    if (verification?.enabled() !== true || status === undefined || !this.historyInteractive()) return;
    const field = this.fieldIdentity();
    if (openingEnd) this.historyOpeningField = field;
    if (this.historyOpeningField !== field) return;
    const geometry = this.historyGeometry();
    const requiredHeight = geometry.topInset + geometry.headingHeight + geometry.headingGap +
      geometry.feedbackHeight + geometry.bottomInset;
    const eligible = status === 'loading' && geometry.feedbackVisible &&
      this.historyViewportHeight() + .1 >= requiredHeight;
    const length = this.model.keyword.length;
    const key = JSON.stringify([field, status, eligible, length]);
    if (!openingEnd && this.historyObservationKey === key) return;
    this.historyObservationKey = key;
    const surface = this.surfaceEvidence(this.model.currentOwner(), field);
    const facts: SearchEntryHistoryEvidence = {
      editorId: surface.editorId, identity: surface.identity, navigation: surface.navigation,
      mounting: surface.mounting, owner: surface.owner, stacked: surface.stacked, mode: surface.mode,
      semantic: surface.semantic, enabled: surface.enabled, focused: surface.focused, length: length,
      beforeLength: surface.beforeLength, start: surface.start, end: surface.end,
      stage: openingEnd ? 'opening-end' : 'viewport', historyStatus: status, feedbackEligible: eligible,
    };
    verification.emit('search-entry-history-state', 'business', facts);
  }
  private historyFeedbackAction(owner: number): (height: number, status: string) => void {
    const key = this.historyFeedbackKey();
    return (height: number, status: string): void => {
      if (!this.mounted || !this.model.owns(owner) || status !== this.model.historyStatus ||
        key !== this.historyFeedbackKey() || !Number.isFinite(height) || height <= 0) return;
      if (this.measuredHistoryFeedbackKey === key && Math.abs(height - this.measuredHistoryFeedback) <= .1) return;
      this.measuredHistoryFeedbackKey = key;
      this.measuredHistoryFeedback = height;
      this.retargetHistoryViewport();
      this.observeEntryHistory(false);
    };
  }
  private surfaceAreaChanged(): void {
    if (!this.mounted) return;
    const node = this.getUIContext().getFrameNodeById('reader-library-search-surface');
    if (node !== null) {
      const y = node.getPositionToWindowWithTransform().y;
      if (Number.isFinite(y) && Math.abs(y - this.surfaceWindowY) > .1) this.surfaceWindowY = y;
      try {
        const info = this.getUIContext().getComponentUtils().getRectangleById('reader-library-search-surface');
        const height = this.getUIContext().px2vp(info.size.height);
        if (Number.isFinite(height) && height >= 0 && Math.abs(height - this.surfaceViewportHeight) > .1)
          this.surfaceViewportHeight = height;
      } catch (_detached) { /* A later current Area supplies the native box. */ }
    }
    this.metricsChanged();
  }
  private resultClip(): PathShape {
    const scale = this.getUIContext().vp2px(1);
    const width = ReaderWindowCoordinator.metrics().windowRect.width * scale;
    const top = this.headerBottom * scale;
    const bottom = (this.mode === 'input' && this.model.sourceRecoveryVisible ?
      this.surfaceHeight() :
      this.headerBottom + this.contentHeight() * this.resultsProgress()) * scale;
    return new PathShape().commands(`M0 ${top} H${width} V${Math.max(top, bottom)} H0 Z`);
  }
  private headerActionTop(): number {
    return (this.barHeight() - bookshelfHeaderSpec().actionExtent) / 2;
  }
  private moreInteractive(): boolean { return this.mode === 'idle' && this.transitionKind === 'none'; }

  private layoutInvariantHeaderStable(): boolean {
    // Observe the rendered endpoints. The transition kind is an ordinary field
    // and can finish without invalidating a Native custom-property observer.
    return this.mode === 'idle' ? !this.searchMounted :
      this.searchMounted && this.surfaceValue() === 1 && !this.reducedTransition;
  }
  @Styles
  private headerActionFrame() {
    .width(bookshelfHeaderSpec().actionExtent).height(bookshelfHeaderSpec().actionExtent)
    .borderRadius(bookshelfHeaderSpec().retainedActionRadius)
  }
  @Builder
  private headerActionGlyph(kind: 'leading' | 'more') {
    Image(kind === 'more'
      ? (this.scheme === 'night' ? $r('app.media.rc_dots_theme_night') : $r('app.media.rc_dots'))
      : this.presentedSearch()
        ? (this.scheme === 'night' ? $r('app.media.book_detail_back_theme_night') : $r('app.media.book_detail_back'))
        : (this.scheme === 'night' ? $r('app.media.bookshelf_search_theme_night') : $r('app.media.bookshelf_search')))
      .width(bookshelfHeaderSpec().retainedActionIconExtent).height(bookshelfHeaderSpec().retainedActionIconExtent)
      .objectFit(ImageFit.Contain).accessibilityLevel('no');
  }
  @Builder
  private bar() {
    Stack({ alignContent: Alignment.TopStart }) {
      Stack({ alignContent: Alignment.Center }) {
        Text('书架').width('100%').textAlign(TextAlign.Center)
          .fontFamily(READER_FONT_NOTO_SANS_SC_UI_BOLD).fontSize(bookshelfHeaderSpec().titleFontSize)
          .lineHeight(bookshelfHeaderSpec().titleLineHeight).fontWeight(FontWeight.Bold)
          .customProperty('readerLayoutInvariant', typeof READER_LAYOUT_DEBUG_BUILD === 'boolean' && READER_LAYOUT_DEBUG_BUILD &&
            this.mode === 'idle' && this.layoutInvariantHeaderStable()
        ? { role: 'header-content', id: 'bookshelf-title' } as LayoutInvariantTag : undefined)
          .fontColor(readerAppColor('TOK_INK', this.scheme)).opacity(this.titleOpacity())
          .accessibilityLevel(this.mode === 'idle' ? 'auto' : 'no-hide-descendants');
      }.width(Math.max(0, this.cardContentWidth() - 2 * bookshelfHeaderSpec().titleSideInset)).height(this.barHeight())
        .position({ x: bookshelfHeaderSpec().titleSideInset, y: 0 });
      Button({ type: ButtonType.Normal, stateEffect: false }) {
        this.headerActionGlyph('more');
      }.headerActionFrame().padding(0).backgroundColor(Color.Transparent)
        .position({ x: Math.max(0, this.cardContentWidth() - bookshelfHeaderSpec().actionExtent -
          bookshelfHeaderSpec().retainedTrailingInset),
          y: this.headerActionTop() })
        .opacity(1 - this.surfaceValue())
        .id(this.moreIdentity)
        .customProperty('readerLayoutInvariant', typeof READER_LAYOUT_DEBUG_BUILD === 'boolean' && READER_LAYOUT_DEBUG_BUILD &&
          this.mode === 'idle' && this.layoutInvariantHeaderStable()
        ? { role: 'key-control', id: 'bookshelf-more' } as LayoutInvariantTag : undefined)
        .hitTestBehavior(this.moreInteractive() ? HitTestMode.Default : HitTestMode.None)
        .attributeModifier(new ReaderActionAccessibility('更多', this.moreInteractive(), false, true,
          new ReaderPressFeedback(Color.Transparent, this.scheme, bookshelfHeaderSpec().retainedActionRadius,
            bookshelfHeaderSpec().retainedActionRadius, this.moreInteractive()), 'nativeButton'))
        .accessibilityLevel(this.mode === 'idle' ? 'auto' : 'no-hide-descendants')
        .onClick(this.moreAction(this.identity, this.navigationGeneration, this.mounting, this.moreIdentity));
      if (this.searchMounted && this.model.currentOwner() !== 0) {
        Stack({ alignContent: Alignment.TopStart }) {
          Flex({ wrap: FlexWrap.Wrap, justifyContent: FlexAlign.End, alignItems: ItemAlign.Center,
            space: { main: LengthMetrics.vp(this.spec.fieldGap), cross: LengthMetrics.vp(this.spec.fieldGap) } }) {
            ForEach([this.fieldIdentity()], (key: string) => {
              // The closing track keeps the field mounted after search mode ends.
              ReaderSearchField({ editingHost: this.editingHost,
                editingCurrent: (): boolean => this.acceptsField(this.model.currentOwner(), key) && !this.model.panelOwnsInput,
                variant: 'bookPanel', mode: 'submit', focusOnAppear: false,
                bookKeyboardOnFocus: this.model.fieldKeyboardOnFocus === true,
                bookPanelFrameId: 'reader-bookshelf-search-field',
                observeBookEditor: this.model.verification === undefined ? undefined :
                  this.bookEditorObservation(this.model.currentOwner(), key),
                text: this.model.keyword,
                placeholder: this.searchHeaderField().shortPlaceholder ? '书名、作者' : '搜索书名、作者…',
                accessibilityLabel: '搜索书名或作者',
                expandedLayout: this.expandedLayout, clearable: true, submitEnabled: this.model.fieldSubmitEnabled,
                bookPanelClearId: this.model.verification?.enabled() === true ? 'reader-book-search-clear' : '',
                onTextChange: this.textAction(this.model.currentOwner(), key),
                onBookClear: this.clearAction(this.model.currentOwner(), key),
                onSubmit: this.submitAction(this.model.currentOwner(), key),
                onFocusChanged: this.focusAction(this.model.currentOwner(), key) })
                .width(this.searchHeaderField().width)
                .height(this.controlHeight())
                .enabled(this.presentedSearch() && !this.model.panelOwnsInput)
                .hitTestBehavior(this.inputInteractive() ? HitTestMode.Default : HitTestMode.None)
                .accessibilityLevel(this.inputInteractive() ? 'auto' : 'no-hide-descendants');
            }, (key: string): string => `search-field:${key}`);
            Button({ type: ButtonType.Normal, stateEffect: false }) {
              Stack({ alignContent: Alignment.Center }) {
                Text(this.model.sweeping ? '停止' : '搜索')
                  .fontFamily(READER_FONT_NOTO_SANS_SC_UI_BOLD).fontSize(13).fontWeight(FontWeight.Bold)
                  .lineHeight(18).halfLeading(true)
                  .minFontScale(Math.min(1, this.fontScale())).maxFontScale(Math.max(1, this.fontScale()))
                  .fontColor(readerAppColor('TOK_ON_PRIMARY', this.scheme));
              }.width(this.actionWidth()).height(this.searchActionVisualHeight())
                .attributeModifier(new ReaderPressFeedback(readerAppColor('TOK_PRIMARY_DARK', this.scheme), this.scheme,
                  this.searchActionVisualHeight() / 2, this.searchActionVisualHeight() / 2,
                  this.actionInteractive(), this.searchActionPointer >= 0))
                .scale(readerPressScale(this.actionInteractive() && this.searchActionPointer >= 0, this.reduceMotion))
                .opacity(readerPressOpacity(this.actionInteractive() && this.searchActionPointer >= 0, this.reduceMotion))
                .animation(readerPressAnimation(this.reduceMotion))
                .accessibilityLevel('no-hide-descendants').hitTestBehavior(HitTestMode.None);
            }.width(this.actionWidth()).height(this.controlHeight()).padding(0)
              .id('reader-bookshelf-search-submit')
              .customProperty('readerLayoutInvariant', typeof READER_LAYOUT_DEBUG_BUILD === 'boolean' && READER_LAYOUT_DEBUG_BUILD &&
                this.layoutInvariantHeaderStable() && (this.mode === 'results' ? this.resultsProgress() >= 1 : this.historyProgress() >= 1)
        ? { role: 'key-control', id: 'search-submit', unavailable: !this.model.canSubmit && !this.model.sweeping } as LayoutInvariantTag : undefined)
              .backgroundColor(Color.Transparent)
              .opacity(this.model.sweeping || this.model.canSubmit ? 1 : .38)
              .enabled(this.actionInteractive())
              .hitTestBehavior(this.actionInteractive() ? HitTestMode.Default : HitTestMode.None)
              .accessibilityRole(AccessibilityRoleType.BUTTON)
              .accessibilityText(this.model.sweeping ? '停止搜索' : '搜索')
              .accessibilityLevel(this.inputInteractive() ? 'auto' : 'no-hide-descendants')
              .onTouch((event: TouchEvent): void => {
                this.searchActionPointer = readerPressPointer(event, this.searchActionPointer, this.actionInteractive());
              })
              .onClick(this.searchAction(this.model.currentOwner(), this.fieldIdentity()));
          }.width(this.searchLaneWidth()).height(this.searchLaneHeight())
            .id(this.stackedSearch() ? 'reader-bookshelf-search-lane-stacked' : 'reader-bookshelf-search-lane-row');
        }.width(this.searchLaneWidth() * this.surfaceValue()).height(this.barHeight() - this.spec.barHeightExtra)
          .position({ x: this.searchLaneLeft(), y: this.laneTop() })
          .translate({ x: -22 * (1 - this.surfaceValue()) })
          .clip(true)
          .opacity(this.surfaceValue() * this.reducedSearchOpacity)
          .hitTestBehavior(this.inputInteractive() ? HitTestMode.Default : HitTestMode.None);
      }
      Button({ type: ButtonType.Normal, stateEffect: false }) {
        this.headerActionGlyph('leading');
      }.headerActionFrame().padding(0).backgroundColor(Color.Transparent)
        .position({ x: bookshelfHeaderSpec().retainedLeadingInset, y: this.headerActionTop() })
        .id(this.mode === 'idle' ? 'reader-bookshelf-search-entry' : READER_LIBRARY_SEARCH_BACK_FOCUS_ID)
        .customProperty('readerLayoutInvariant', typeof READER_LAYOUT_DEBUG_BUILD === 'boolean' && READER_LAYOUT_DEBUG_BUILD && this.layoutInvariantHeaderStable()
        ? { role: 'key-control', id: 'search-entry-back' } as LayoutInvariantTag : undefined)
        .attributeModifier(new ReaderActionAccessibility(this.presentedSearch() ? '返回' : '搜索书籍', !this.model.panelOwnsInput,
          false, true, new ReaderPressFeedback(Color.Transparent, this.scheme, bookshelfHeaderSpec().retainedActionRadius,
            bookshelfHeaderSpec().retainedActionRadius, !this.model.panelOwnsInput), 'nativeButton'))
        .accessibilityLevel(this.model.panelOwnsInput ? 'no-hide-descendants' : 'auto')
        .onClick(this.leadingAction(this.identity, this.navigationGeneration, this.mounting));
    }.width('100%').height(this.barHeight()).id('reader-bookshelf-search-bar')
      .customProperty('readerLayoutInvariant', typeof READER_LAYOUT_DEBUG_BUILD === 'boolean' && READER_LAYOUT_DEBUG_BUILD && this.layoutInvariantHeaderStable()
        ? { role: 'floating-header', id: 'bookshelf-search-header',
          scope: this.mode === 'idle' ? 'bookshelf' : undefined, expectedHeightVp: this.mode === 'idle'
            ? bookshelfHeaderSpec().barHeight - 2 * this.spec.borderWidth : this.spec.barHeight(this.searchLaneHeight()),
          expectedTopGapVp: bookshelfHeaderSpec().topInset + this.spec.borderWidth } as LayoutInvariantTag : undefined);
  }
  private panelBorderColor(): string {
    return readerAppColor(this.scheme === 'night' || this.historyProgress() > .01 ?
      'app.search.panelBorder' : 'app.border.control', this.scheme);
  }
  private headerVeil(): boolean {
    if (!this.headerSurfaceCollapsed()) return false;
    return (this.mode === 'idle' && !this.searchMounted) ||
      (this.mode === 'results' && this.resultsProgress() > .01);
  }
  private headerMaterial(): ReaderSurfaceMaterialDecision | undefined {
    return this.headerVeil() ?
      readerSurfaceMaterialDecision('chromeBar', this.appearancePreferences, this.scheme, this.systemScheme) : undefined;
  }
  private headerSurfaceGeometryKey(): string {
    const metrics = ReaderWindowCoordinator.metrics();
    return JSON.stringify([metrics.windowRect.width, this.horizontalInset(true), this.horizontalInset(false),
      this.barHeight(), metrics.densityPixels]);
  }
  private headerSurfaceCollapsed(): boolean {
    return !this.searchMounted || this.historyViewportHeight() * this.historyProgress() === 0;
  }
  private headerRaisedShapeIdentity(): string {
    return JSON.stringify(['library-header', this.raisedAppearanceEpoch, this.identity, this.navigationGeneration,
      this.mounting, this.measurementKey, this.headerSurfaceGeometryKey()]);
  }
  private currentHeaderRaisedShape(): ReaderRaisedShape | undefined {
    // An unchanged Native box may keep its accepted measurement across keys.
    return this.mounted ? this.headerRaisedShape : undefined;
  }
  private headerMaterialRadius(): number {
    const width = this.cardContentWidth() + 2 * this.spec.borderWidth;
    const height = this.barHeight() + 2 * this.spec.borderWidth;
    const collapsed = this.currentHeaderRaisedShape();
    const capsule = collapsed !== undefined && Math.abs(collapsed.height - height) <= 1 &&
      Math.abs(collapsed.width - width) <= 1 ? collapsed.radius : Math.min(width, height) / 2;
    if (this.headerSurfaceCollapsed()) return capsule;
    const historyRadius = this.spec.historyRadius + (this.controlHeight() - SEARCH_CONTROL_MIN_TARGET) / 2;
    return Math.min(width / 2, this.blend(capsule, historyRadius, this.historyProgress()));
  }
  private headerSurfaceAreaChange(): (_old: Area, next: Area) => void {
    const key = this.measurementKey;
    const inputKey = this.headerSurfaceGeometryKey();
    const collapsed = this.headerSurfaceCollapsed();
    const identity = this.headerRaisedShapeIdentity();
    return (_old: Area, next: Area): void => {
      if (!this.mounted || key !== this.measurementKey || inputKey !== this.headerSurfaceGeometryKey() ||
        identity !== this.headerRaisedShapeIdentity() || !collapsed || !this.headerSurfaceCollapsed()) return;
      const width = readerPageAreaLength(next.width);
      const height = readerPageAreaLength(next.height);
      // Use the painted panel's native border box. At fractional density its
      // snapped border widths need not equal barHeight + two logical borders.
      // Expanded history never replaces this confirmed collapsed-box sample.
      const shape = resolveReaderRaisedShape(identity, width, height, height / 2);
      if (shape === undefined) { this.headerRaisedShape = undefined; return; }
      const previous = this.headerRaisedShape;
      if (previous?.identity === identity && Math.abs(previous.width - width) <= .01 && Math.abs(previous.height - height) <= .01) return;
      this.headerRaisedShape = shape;
    };
  }
  private historyDividerColor(): string { return readerAppColor('TOK_LINE', this.scheme); }
  private historyViewportHeight(): number {
    const limit = this.displayedHistoryLimit > 0 ? this.displayedHistoryLimit : this.historyLimit();
    return Math.min(this.displayedHistoryViewport, limit);
  }
  @Builder
  private historyPanel(owner: number) {
    ReaderSearchHistoryPanel({ history: this.model.history, status: this.model.historyStatus,
      layout: this.historyLayout(),
      observeActions: this.model.verification?.enabled() === true,
      onFeedbackHeight: this.historyFeedbackAction(owner),
      onClear: this.clearHistoryAction(owner), onRetry: this.retryHistoryAction(owner),
      onSelect: this.historyAction(owner), onToggle: this.toggleHistoryAction(owner) });
  }
  @Builder
  private header() {
    Stack({ alignContent: Alignment.TopStart }) {
      Column() {
      this.bar();
      if (this.searchMounted) {
        Stack({ alignContent: Alignment.TopStart }) {
          ForEach([this.model.currentOwner()], (owner: number) => {
            this.historyPanel(owner);
          }, (owner: number): string => `search-history:${owner}`);
          Column() {
            Column().width('100%').height(1).backgroundColor(this.historyDividerColor());
          }.width('100%').height(1).padding({ left: this.spec.panelInnerInset, right: this.spec.panelInnerInset })
            .hitTestBehavior(HitTestMode.None).accessibilityLevel('no-hide-descendants');
        }.width('100%').height(this.historyViewportHeight() * this.historyProgress()).clip(true)
          .id('reader-search-history-viewport')
          .opacity(this.historyProgress() * this.reducedSearchOpacity * this.historyResizeOpacity)
          .enabled(this.historyInteractive())
          .hitTestBehavior(this.historyInteractive() ? HitTestMode.Default : HitTestMode.None)
          .accessibilityLevel(this.historyInteractive() ? 'auto' : 'no-hide-descendants');
      }
      }.width('100%')
        .borderRadius(Math.max(0, this.headerMaterialRadius() - this.spec.borderWidth)).clip(true);
    }.width('100%').clip(false)
      .renderGroup(this.transitionKind !== 'none')
      .padding(this.headerMaterial()?.native ? this.spec.borderWidth : 0)
      .backgroundColor(this.headerMaterial()?.native ? Color.Transparent :
        readerAppColor('app.search.panelSurface', this.scheme))
      .backgroundEffect(undefined)
      .border({ width: this.headerMaterial()?.native ? 0 : this.spec.borderWidth,
        color: this.headerMaterial()?.native ? Color.Transparent :
          this.headerVeil() ? readerHeaderVeilBorder(this.scheme) : this.panelBorderColor() })
      .borderRadius(this.headerMaterialRadius()).hitTestBehavior(HitTestMode.Default)
      .shadow(this.headerMaterial()?.native ? undefined : this.headerStackShadow())
      .attributeModifier(new ReaderImmersiveMaterialModifier(this.headerMaterial()))
      .onAreaChange(this.headerSurfaceAreaChange());
  }
  private headerStackShadow(): ShadowOptions {
    this.metricsRevision;
    const sampled = this.headerShadowStrength();
    const strength = sampled <= .001 ? 0 : sampled;
    const raised = readerSurfaceElevation('raised', this.scheme);
    const color = raised.color as string;
    const alpha = Math.round(Number.parseInt(color.slice(1, 3), 16) * strength);
    const shadowColor = `#${alpha.toString(16).padStart(2, '0').toUpperCase()}${color.slice(3)}`;
    return { radius: (raised.radius as number) * strength, offsetX: raised.offsetX,
      offsetY: (raised.offsetY as number) * strength, color: shadowColor, type: raised.type, fill: raised.fill };
  }

  private headerShadowStrength(): number {
    if (this.nativeSearchMotion) return this.displayedShadowStrength;
    const target = this.blend(1, .55, this.toResults);
    if (this.transitionKind === 'none') return target;
    if (this.reducedTransition) {
      // Follow the existing opacity fade while reduced motion holds the layout fixed.
      const fade = this.transitionKind === 'back' ? 1 - this.reducedSearchOpacity : this.reducedSearchOpacity;
      return this.blend(this.fromShadowStrength, target, fade);
    }
    const spec = this.transitionKind === 'open' ? this.openSpec :
      this.transitionKind === 'submit' ? this.submitSpec : this.backSpec;
    return this.blend(this.fromShadowStrength, target, this.segment(0, spec.durationMs, spec));
  }

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      Stack({ alignContent: Alignment.TopStart }) {
        Column() { this.results(); }.width('100%').height(this.surfaceHeight());
      }.width('100%').height(this.mode === 'input' && this.model.sourceRecoveryVisible ?
        this.surfaceHeight() : this.resultsProgress() > 0 ?
          this.headerBottom + this.contentHeight() * this.resultsProgress() : 0)
        .renderGroup(this.transitionKind !== 'none')
        .clipShape(this.resultClip())
        .opacity(this.reducedSearchOpacity)
        .zIndex(2)
        .hitTestBehavior(this.mode === 'input' && this.inputInteractive() && this.model.sourceRecoveryVisible ?
          HitTestMode.Transparent : this.mode === 'results' && this.inputInteractive() ? HitTestMode.Default : HitTestMode.None)
        .accessibilityLevel((this.mode === 'results' && this.inputInteractive()) ||
          (this.mode === 'input' && this.inputInteractive() && this.model.sourceRecoveryVisible) ?
          'auto' : 'no-hide-descendants');
      // Keep backdrop clicks behind the recovery actions while dimming the recovery surface.
      Stack().width('100%').height('100%')
        .attributeModifier(new ReaderModalScrimModifier(this.appearancePreferences, this.scheme,
          this.mode === 'input' && this.model.sourceRecoveryVisible ? Color.Transparent :
            readerAppColor('app.scrim.modal', this.scheme), this.headerMaterial()?.native === true,
          this.scrimProgress() > .01 && !(this.mode === 'input' && this.model.sourceRecoveryVisible)))
        .expandSafeArea([SafeAreaType.SYSTEM], [SafeAreaEdge.TOP, SafeAreaEdge.BOTTOM])
        .opacity(this.scrimProgress() * this.reducedSearchOpacity).zIndex(1)
        .hitTestBehavior(this.mode === 'input' && this.scrimProgress() > .01 ? HitTestMode.Default : HitTestMode.None)
        .onClick(this.backAction(this.identity, this.navigationGeneration, this.mounting));
      if (this.mode === 'input' && this.model.sourceRecoveryVisible) {
        Stack().id('reader-library-search-recovery-scrim').width('100%').height('100%')
          .attributeModifier(new ReaderModalScrimModifier(this.appearancePreferences, this.scheme,
            readerAppColor('app.scrim.modal', this.scheme), this.headerMaterial()?.native === true, this.scrimProgress() > .01))
          .expandSafeArea([SafeAreaType.SYSTEM], [SafeAreaEdge.TOP, SafeAreaEdge.BOTTOM])
          .opacity(this.scrimProgress() * this.reducedSearchOpacity).zIndex(3).hitTestBehavior(HitTestMode.None);
      }
      Column() {
        ReaderFixedHeaderHost({ style: new ReaderHeaderFrameStyle(true, ''), measurementKey: this.measurementKey,
          content: (): void => { this.header(); }, onHeightChange: (height: number, key: number): void => this.captureHeader(height, key) });
      }.width('100%').padding({ left: this.horizontalInset(true), right: this.horizontalInset(false) })
        .margin({ top: bookshelfHeaderSpec().topInset }).zIndex(4).hitTestBehavior(HitTestMode.Transparent);
    }.id(this.editingScroll.id).width('100%').height('100%')
      .onAppear((): void => this.editingScroll.mount(this.getUIContext(), this.editingHost, this.editingScroller))
      .onDisAppear((): void => this.editingScroll.unmount())
      .hitTestBehavior(HitTestMode.Transparent).onAreaChange((): void => this.surfaceAreaChanged());
  }
}
