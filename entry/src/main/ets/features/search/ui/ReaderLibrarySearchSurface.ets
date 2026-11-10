import curves from '@ohos.curves';
import hilog from '@ohos.hilog';
import inputMethod from '@ohos.inputMethod';
import { PathShape } from '@ohos.arkui.shape';
import { FrameCallback } from '@kit.ArkUI';
import { ReaderWindowCoordinator } from '../../../app/ReaderWindowCoordinator';
import { readerVisualSafeTop, readerVisualSafeBottom, readerInteractiveSafeLeft, readerInteractiveSafeRight } from '../../../ui/foundation/ReaderWindowMetrics';
import { ReaderFixedHeaderHost } from '../../../ui/layout/ReaderFixedHeaderHost';
import { ReaderHeaderFrameStyle } from '../../../ui/layout/ReaderFrameStyle';
import { readerPresentedHeaderBottom, readerPageAreaLength } from '../../../ui/layout/ReaderPageShell';
import { bookshelfHeaderSpec, searchHeaderSpec, SearchHeaderSpec } from '../../../ui/foundation/ReaderHeaderSpecs';
import { readerSearchControlHeight, readerSearchActionWidth } from '../../../ui/foundation/ReaderSearchControlGeometry';
import { consumeReaderControlKeyboardBack } from '../../../ui/foundation/ReaderKeyboardBack';
import { readerAppColor } from '../../../ui/foundation/ReaderThemeRegistry';
import { readerSurfaceElevation, readerHeaderVeilMaterial, readerHeaderVeilBorder } from '../../../ui/surfaces/ReaderSurfaceSpecs';
import { ReaderRaisedShape, resolveReaderRaisedShape } from '../../../ui/layout/ReaderRaisedShape';
import { motionSegment } from '../../../ui/foundation/MotionTimeline';
import { motionSpecGet, MotionSpecEntry } from '../../../ui/foundation/MotionSpec';
import { readerMotionNowMs } from '../../../ui/foundation/ReaderMotionClock';
import { ReaderActionAccessibility } from '../../../ui/controls/ReaderActionAccessibility';
import { ReaderSearchField } from '../../../ui/controls/ReaderSearchField';
import { READER_FONT_NOTO_SANS_SC_UI_BOLD } from '../../../ui/foundation/ReaderFontFamilies';
import { ReaderSearchHistoryPanel } from './ReaderSearchHistoryPanel';
import { SearchHistoryGeometry, SearchHistoryViewport } from './SearchHistoryGeometry';
import type { ReaderSurfaceRect } from '../../../ui/layout/ReaderSurfaceRect';
import { ReaderLibrarySearchModel, READER_LIBRARY_SEARCH_BACK_FOCUS_ID } from '../presentation/ReaderLibrarySearchModel';

import type { LibrarySearchMode } from '../presentation/LibrarySearchPresentation';

type SearchSurfaceTransition = 'none' | 'open' | 'submit' | 'edit' | 'back';

/** One measured value that follows a retarget without owning the frame clock.
 * Interrupting it starts from the currently displayed sample, never from zero. */
class SurfaceValueTrack {
  private from: number = 0;
  private to: number = 0;
  private startedMs: number = 0;
  private durationMs: number = 0;
  private curve: (fraction: number) => number = (fraction: number): number => fraction;
  set(value: number): void { this.from = value; this.to = value; this.durationMs = 0; }
  retarget(to: number, nowMs: number, durationMs: number, curve: (fraction: number) => number): void {
    const current = this.sample(nowMs);
    if (Math.abs(to - current) <= .01) { this.from = to; this.to = to; this.durationMs = 0; return; }
    this.from = current;
    this.to = to;
    this.startedMs = nowMs;
    this.durationMs = Math.max(1, durationMs);
    this.curve = curve;
  }
  sample(nowMs: number): number {
    if (this.durationMs <= 0) return this.to;
    const fraction = (nowMs - this.startedMs) / this.durationMs;
    if (!Number.isFinite(fraction) || fraction >= 1) { this.from = this.to; this.durationMs = 0; return this.to; }
    if (fraction <= 0) return this.from;
    return this.from + (this.to - this.from) * this.curve(fraction);
  }
  running(nowMs: number): boolean { return this.durationMs > 0 && nowMs - this.startedMs < this.durationMs; }
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
  onFrame(_time: number): void {}
  onIdle(_remaining: number): void { this.action(); }
}

/** Persistent library bar and its transition. SearchHost remains the owner of search facts. */
@Component
export struct ReaderLibrarySearchSurface {
  @StorageLink('readerAppScheme') private scheme: string = 'day';
  @StorageLink('readerWindowMetricsRevision') @Watch('metricsChanged') private metricsRevision: number = 0;
  @ObjectLink model: ReaderLibrarySearchModel;
  @Prop @Watch('modeChanged') mode: LibrarySearchMode = 'idle';
  /** Restoring a retained query is a stable frame, not a new shelf opening. */
  @Prop animateOnAppear: boolean = true;
  @Prop expandedLayout: boolean = false;
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
  private readonly historyResizeSpec: MotionSpecEntry = motionSpecGet('search.history.resize') as MotionSpecEntry;
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
  @State private measuredHistoryFeedback: number = 0;
  @State private measuredHistoryFeedbackKey: string = '';
  private lastCardSuppressed: boolean = false;
  private lastCardCoverageScope: string = '';
  private readonly historyTrack: SurfaceValueTrack = new SurfaceValueTrack();
  private readonly historyLimitTrack: SurfaceValueTrack = new SurfaceValueTrack();
  private fieldFocused: boolean = false;
  private automaticInputFocusAllowed: boolean = true;
  private unbindInputBack: (() => void) | undefined;
  @State private elapsed: number = 0;
  @State private headerBottom: number = bookshelfHeaderSpec().frameHeight;
  @State private historyHeight: number = 0;
  @State private displayedHistoryViewport: number = 0;
  @State private displayedHistoryLimit: number = 0;
  @State private searchMounted: boolean = false;
  @State private measurementKey: number = 0;
  @State private headerRaisedShape: ReaderRaisedShape | undefined = undefined;
  private raisedAppearanceEpoch: number = 0;

  aboutToAppear(): void {
    this.raisedAppearanceEpoch += 1;
    this.headerRaisedShape = undefined;
    this.lastCardCoverageScope = '';
    this.mounted = true;
    this.automaticInputFocusAllowed = true;
    this.unbindInputBack = this.model.bindInputBack((): boolean => this.consumeInputBack());
    this.retargetHistoryViewport();
    this.historyLimitTrack.set(this.historyLimit());
    this.displayedHistoryLimit = this.historyLimit();
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
    this.applyTargets(this.mode);
    this.transitionKind = this.mode === 'results' ? 'submit' : 'open';
    this.transitionDurationMs = this.durationFor(this.transitionKind);
    this.transitionStartedMs = readerMotionNowMs();
    this.searchMounted = true;
    this.measurementKey += 1;
    this.activeIdentity = this.identity;
    this.activeNavigation = this.navigationGeneration;
    this.activeMounting = this.mounting;
    this.schedule(++this.generation);
  }
  aboutToDisappear(): void {
    this.mounted = false;
    this.generation += 1;
    this.unbindInputBack?.();
    this.unbindInputBack = undefined;
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
    this.transitionDurationMs = 0;
    this.transitionStartedMs = 0;
    this.elapsed = 0;
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
    if (next === this.currentMode) {
      this.activeNavigation = this.navigationGeneration;
      this.activeMounting = this.mounting;
      this.activeIdentity = this.identity;
      this.publishContinueCardCoverage(next === 'input' && this.resolvedHistoryViewport().suppressContinueCard);
      if (this.reduceMotion && this.transitionKind !== 'none') this.completeTransition();
      return;
    }
    const previous = this.currentMode;
    this.fromSurface = this.surfaceProgress();
    this.fromHistory = this.historyProgress();
    this.fromResults = this.resultsProgress();
    this.fromScrim = this.scrimProgress();
    this.currentMode = next;
    this.measurementKey += 1;
    const token = ++this.generation;
    this.activeNavigation = this.navigationGeneration;
    this.activeMounting = this.mounting;
    this.activeIdentity = this.identity;
    this.automaticInputFocusAllowed = next === 'input';
    if (next !== 'input') this.fieldFocused = false;
    this.applyTargets(next);
    this.retargetHistoryViewport();
    this.transitionKind = this.transitionFor(previous, next);
    this.transitionDurationMs = this.durationFor(this.transitionKind);
    this.transitionStartedMs = readerMotionNowMs();
    this.elapsed = 0;
    if (next === 'results' || next === 'idle') this.getUIContext().getFocusController().clearFocus();
    if (next !== 'idle') this.searchMounted = true;
    if (this.reduceMotion || this.transitionKind === 'none' || this.transitionDurationMs <= 0) {
      this.completeTransition();
      return;
    }
    this.schedule(token);
  }
  private identityChanged(): void { this.modeChanged(); }
  private presentationChanged(): void { this.modeChanged(); }
  private metricsChanged(): void {
    if (!this.mounted) return;
    this.measurementKey += 1;
    const limit = this.historyLimit();
    if (this.reduceMotion) {
      this.historyLimitTrack.set(limit);
      this.displayedHistoryLimit = limit;
    } else {
      this.historyLimitTrack.retarget(limit, readerMotionNowMs(), this.historyResizeSpec.durationMs,
        (fraction: number): number => (this.historyResizeSpec.curve as curves.ICurve).interpolate(fraction));
    }
    this.retargetHistoryViewport();
    this.schedule(this.generation);
  }
  private retargetHistoryViewport(): void {
    const viewport = this.resolvedHistoryViewport();
    const target = viewport.height;
    this.historyHeight = target;
    this.publishContinueCardCoverage(this.mode === 'input' && viewport.suppressContinueCard);
    if (this.reduceMotion) {
      this.historyTrack.set(target);
      this.displayedHistoryViewport = target;
      return;
    }
    const now = readerMotionNowMs();
    this.historyTrack.retarget(target, now, this.historyResizeSpec.durationMs,
      (fraction: number): number => (this.historyResizeSpec.curve as curves.ICurve).interpolate(fraction));
  }
  private publishContinueCardCoverage(suppressed: boolean): void {
    const scope = `${this.identity}:${this.navigationGeneration}:${this.mounting}`;
    // The retained surface may still cover the card after its scope changes.
    const publish = suppressed !== this.lastCardSuppressed || (suppressed && scope !== this.lastCardCoverageScope);
    this.lastCardCoverageScope = scope;
    this.lastCardSuppressed = suppressed;
    if (publish) this.onHistoryCoverageChanged(suppressed, this.identity, this.navigationGeneration, this.mounting);
  }
  private schedule(token: number): void {
    if (!this.mounted || this.scheduledToken === token) return;
    this.scheduledToken = token;
    this.getUIContext().postFrameCallback(new LibrarySearchFrame((): void => {
      if (this.scheduledToken === token) this.scheduledToken = -1;
      if (!this.mounted || token !== this.generation) return;
      const now = readerMotionNowMs();
      let running = false;
      if (this.transitionKind !== 'none') {
        const next = Math.min(this.transitionDurationMs, Math.max(0, now - this.transitionStartedMs));
        this.elapsed = next;
        if (next >= this.transitionDurationMs) this.completeTransition();
        else running = true;
      }
      const historyViewport = this.historyTrack.sample(now);
      if (this.displayedHistoryViewport !== historyViewport) this.displayedHistoryViewport = historyViewport;
      if (this.historyTrack.running(now)) running = true;
      const historyLimit = this.historyLimitTrack.sample(now);
      if (this.displayedHistoryLimit !== historyLimit) this.displayedHistoryLimit = historyLimit;
      if (this.historyLimitTrack.running(now)) running = true;
      if (running) this.schedule(token);
    }));
  }
  private completeTransition(): void {
    const token = this.generation;
    const wasOpen = this.transitionKind === 'open';
    this.transitionKind = 'none';
    this.transitionDurationMs = 0;
    this.transitionStartedMs = 0;
    this.elapsed = 0;
    if (this.mode === 'idle') this.searchMounted = false;
    if (this.mode !== 'input') this.fieldFocused = false;
    if (this.mode === 'input' && wasOpen) this.scheduleInputFocus(token, 0);
    if (this.activeIdentity === this.identity && this.activeNavigation === this.navigationGeneration &&
      this.activeMounting === this.mounting) {
      this.onSettled(this.mode, this.activeIdentity, this.activeNavigation, this.activeMounting);
    }
  }
  private scheduleInputFocus(token: number, attempt: number): void {
    const identity = this.identity;
    const navigation = this.navigationGeneration;
    const mounting = this.mounting;
    this.getUIContext().postFrameCallback(new LibrarySearchFocusFrame((): void => {
      const owner = this.model.currentOwner();
      if (!this.mounted || token !== this.generation || this.mode !== 'input' || !this.searchMounted ||
        !this.automaticInputFocusAllowed || this.fieldFocused || this.model.panelOwnsInput || identity !== this.identity ||
        navigation !== this.navigationGeneration || mounting !== this.mounting) return;
      if (owner !== 0 && this.model.owns(owner) && this.model.interactive) {
        this.getUIContext().getFocusController().requestFocus('reader-book-search-input');
      }
      if (!this.fieldFocused && attempt < 3) this.scheduleInputFocus(token, attempt + 1);
    }));
  }
  private segment(startMs: number, durationMs: number, entry: MotionSpecEntry): number {
    return motionSegment(this.elapsed, startMs, durationMs, (fraction: number): number =>
      (entry.curve as curves.ICurve).interpolate(fraction));
  }
  private transitionFraction(): number {
    if (this.transitionDurationMs <= 0) return 1;
    return Math.max(0, Math.min(1, this.elapsed / this.transitionDurationMs));
  }
  private backFraction(): number { return this.segment(0, this.backSpec.durationMs, this.backSpec); }
  private surfaceProgress(): number {
    if (this.transitionKind === 'open') {
      return this.blend(this.fromSurface, this.toSurface, this.segment(0, this.openSpec.durationMs, this.openSpec));
    }
    if (this.transitionKind === 'back') return this.blend(this.fromSurface, this.toSurface, this.backFraction());
    return this.toSurface;
  }
  private resultsProgress(): number {
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
    if (this.transitionKind === 'back') {
      const progress = this.transitionFraction();
      const veil = this.fromResults > .99 ? 1 : Math.min(1, progress / .06);
      const release = 1 - motionSegment(progress, .55, .45, (fraction: number): number => fraction);
      return Math.max(this.fromScrim * (1 - progress), veil * release);
    }
    return this.toScrim;
  }
  private inputInteractive(): boolean {
    if (!this.model.interactive || this.model.panelOwnsInput) return false;
    if (this.mode === 'input') return this.surfaceProgress() >= 1 && this.historyProgress() >= 1;
    if (this.mode === 'results') return this.resultsProgress() >= 1;
    return false;
  }
  private historyInteractive(): boolean {
    return this.mode === 'input' && this.inputInteractive();
  }
  private controlHeight(): number {
    const scale = this.metricsRevision < 0 ? 1 : ReaderWindowCoordinator.metrics().systemFontScale;
    return readerSearchControlHeight(Number.isFinite(scale) && scale > 0 ? scale : 1);
  }
  private fontScale(): number {
    const scale = ReaderWindowCoordinator.metrics().systemFontScale;
    return Number.isFinite(scale) && scale > 0 ? scale : 1;
  }
  private blend(a: number, b: number, fraction: number): number { return a + (b - a) * fraction; }
  private surfaceValue(): number { return Math.max(0, Math.min(1, this.surfaceProgress())); }
  private titleOpacity(): number { return 1 - Math.min(1, this.surfaceValue() / .45); }
  private barHeight(): number {
    return this.spec.barHeight(this.controlHeight());
  }
  private trailingWidth(): number {
    return this.blend(bookshelfHeaderSpec().actionExtent,
      readerSearchActionWidth(this.expandedLayout, this.fontScale()), this.surfaceValue());
  }
  private horizontalInset(left: boolean): number {
    const metrics = ReaderWindowCoordinator.metrics();
    const safe = left ? readerInteractiveSafeLeft(metrics) : readerInteractiveSafeRight(metrics);
    return Math.max(this.spec.outerInset(this.expandedLayout), safe);
  }
  private historyBottomInset(): number { return 13; }
  private fieldIdentity(): string {
    return JSON.stringify([this.identity, this.navigationGeneration, this.mounting, this.model.currentOwner()]);
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
  private submitAction(owner: number, field: string): () => void {
    return (): void => { if (this.acceptsField(owner, field)) this.model.dispatchSubmit(owner); };
  }
  private searchAction(owner: number, field: string): () => void {
    return (): void => {
      if (this.acceptsField(owner, field) && this.actionInteractive()) this.model.dispatchAction(owner);
    };
  }
  private historyAction(owner: number): (value: string) => void {
    return (value: string): void => {
      if (this.mounted && this.historyInteractive()) this.model.dispatchHistory(owner, value);
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
  private contentHeight(): number {
    return Math.max(0, this.surfaceHeight() - this.headerBottom);
  }
  private surfaceHeight(): number {
    return Math.max(0, ReaderWindowCoordinator.metrics().windowRect.height - this.surfaceWindowY);
  }
  private availableBottom(): number {
    const metrics = ReaderWindowCoordinator.metrics();
    return Math.max(0, this.surfaceHeight() -
      Math.max(readerVisualSafeBottom(metrics), metrics.keyboardInsets.bottom));
  }
  private historyLimit(): number {
    const barBottom = readerPresentedHeaderBottom(bookshelfHeaderSpec().topInset,
      this.barHeight() + 2 * this.spec.borderWidth);
    return Math.max(0, this.availableBottom() - barBottom);
  }
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
  private searchLaneLeft(): number { return this.spec.barPaddingLeft + bookshelfHeaderSpec().actionExtent + 2; }
  private searchLaneWidth(): number {
    return Math.max(0, this.cardContentWidth() - this.searchLaneLeft() - this.spec.barPaddingRight);
  }
  private fieldWidth(): number { return Math.max(0, this.searchLaneWidth() - this.actionWidth() - 5); }
  private laneTop(): number { return (this.barHeight() - this.controlHeight()) / 2; }
  // The icon describes the current destination state. The closing track may
  // still retire the search content, but an idle bookshelf owns a search entry.
  private presentedSearch(): boolean { return this.mode !== 'idle'; }
  private actionInteractive(): boolean {
    return this.model.interactive && !this.model.panelOwnsInput && this.presentedSearch() && this.transitionKind !== 'back' &&
      (this.inputInteractive() || this.model.sweeping) && (this.model.sweeping || this.model.canSubmit);
  }
  private resolvedHistoryViewport(): SearchHistoryViewport {
    const barBottom = readerPresentedHeaderBottom(bookshelfHeaderSpec().topInset, this.barHeight() + 2 * this.spec.borderWidth);
    const cardBottom = this.continueCardRect === undefined ? 0 :
      this.continueCardRect.y + this.continueCardRect.height - this.surfaceWindowY;
    return new SearchHistoryViewport(this.cardContentWidth(), barBottom, this.availableBottom(), cardBottom);
  }
  private historyGeometry(): SearchHistoryGeometry {
    return new SearchHistoryGeometry(this.cardContentWidth(), this.historyHeight, this.fontScale(),
      this.expandedLayout, this.model.historyStatus ?? '',
      this.measuredHistoryFeedbackKey === this.historyFeedbackKey() ? this.measuredHistoryFeedback : 0);
  }
  private historyFeedbackKey(): string {
    return JSON.stringify([this.metricsRevision, this.cardContentWidth(), this.model.historyStatus]);
  }
  private historyFeedbackAction(owner: number): (height: number, status: string) => void {
    const key = this.historyFeedbackKey();
    return (height: number, status: string): void => {
      if (!this.mounted || !this.model.owns(owner) || status !== this.model.historyStatus ||
        key !== this.historyFeedbackKey() || !Number.isFinite(height) || height <= 0) return;
      this.measuredHistoryFeedbackKey = key;
      if (Math.abs(height - this.measuredHistoryFeedback) > .1) this.measuredHistoryFeedback = height;
    };
  }
  private surfaceAreaChanged(): void {
    if (!this.mounted) return;
    const node = this.getUIContext().getFrameNodeById('reader-library-search-surface');
    if (node !== null) {
      const y = node.getPositionToWindowWithTransform().y;
      if (Number.isFinite(y) && Math.abs(y - this.surfaceWindowY) > .1) this.surfaceWindowY = y;
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
          .fontColor(readerAppColor('TOK_INK', this.scheme)).opacity(this.titleOpacity())
          .accessibilityLevel(this.mode === 'idle' ? 'auto' : 'no-hide-descendants');
      }.width(Math.max(0, this.cardContentWidth() - 120)).height(this.barHeight())
        .position({ x: 60, y: 0 });
      Button({ type: ButtonType.Normal, stateEffect: false }) {
        this.headerActionGlyph('more');
      }.headerActionFrame().padding(0).backgroundColor(Color.Transparent)
        .position({ x: Math.max(0, this.cardContentWidth() - bookshelfHeaderSpec().actionExtent -
          bookshelfHeaderSpec().retainedTrailingInset),
          y: this.headerActionTop() })
        .opacity(1 - this.surfaceValue())
        .id(this.moreIdentity)
        .hitTestBehavior(this.moreInteractive() ? HitTestMode.Default : HitTestMode.None)
        .attributeModifier(new ReaderActionAccessibility('更多', this.moreInteractive(), false, true, undefined, 'nativeButton'))
        .accessibilityLevel(this.mode === 'idle' ? 'auto' : 'no-hide-descendants')
        .onClick(this.moreAction(this.identity, this.navigationGeneration, this.mounting, this.moreIdentity));
      if (this.searchMounted && this.model.currentOwner() !== 0) {
        Stack({ alignContent: Alignment.TopStart }) {
          Row({ space: 5 }) {
            ForEach([this.fieldIdentity()], (key: string) => {
              // The closing track keeps the field mounted after search mode ends.
              ReaderSearchField({ variant: 'bookPanel', mode: 'submit', focusOnAppear: false,
                text: this.model.keyword, placeholder: '搜索书名、作者…', accessibilityLabel: '搜索书名或作者',
                expandedLayout: this.expandedLayout, clearable: true, submitEnabled: this.model.fieldSubmitEnabled,
                onTextChange: this.textAction(this.model.currentOwner(), key),
                onSubmit: this.submitAction(this.model.currentOwner(), key),
                onFocusChanged: this.focusAction(this.model.currentOwner(), key) })
                .width(this.fieldWidth())
                .height(this.controlHeight())
                .enabled(this.presentedSearch() && !this.model.panelOwnsInput)
                .hitTestBehavior(this.inputInteractive() ? HitTestMode.Default : HitTestMode.None)
                .accessibilityLevel(this.inputInteractive() ? 'auto' : 'no-hide-descendants');
            }, (key: string): string => `search-field:${key}`);
            Button({ type: ButtonType.Normal, stateEffect: false }) {
              Text(this.model.sweeping ? '停止' : '搜索')
                .fontFamily(READER_FONT_NOTO_SANS_SC_UI_BOLD).fontSize(13).fontWeight(FontWeight.Bold)
                .fontColor(readerAppColor('TOK_ON_PRIMARY', this.scheme)).accessibilityLevel('no');
            }.width(this.actionWidth()).height(this.controlHeight()).padding(0).borderRadius(this.controlHeight() / 2)
              .backgroundColor(readerAppColor('app.action.fill', this.scheme))
              .opacity(this.model.sweeping || this.model.canSubmit ? 1 : .38)
              .enabled(this.actionInteractive())
              .hitTestBehavior(this.actionInteractive() ? HitTestMode.Default : HitTestMode.None)
              .accessibilityRole(AccessibilityRoleType.BUTTON)
              .accessibilityText(this.model.sweeping ? '停止搜索' : '搜索')
              .accessibilityLevel(this.inputInteractive() ? 'auto' : 'no-hide-descendants')
              .onClick(this.searchAction(this.model.currentOwner(), this.fieldIdentity()));
          }.width(this.searchLaneWidth()).height(this.controlHeight()).alignItems(VerticalAlign.Center);
        }.width(this.searchLaneWidth() * this.surfaceValue()).height(this.controlHeight())
          .position({ x: this.searchLaneLeft(), y: this.laneTop() })
          .translate({ x: -22 * (1 - this.surfaceValue()) })
          .clip(true)
          .opacity(this.surfaceValue())
          .hitTestBehavior(this.inputInteractive() ? HitTestMode.Default : HitTestMode.None);
      }
      Button({ type: ButtonType.Normal, stateEffect: false }) {
        this.headerActionGlyph('leading');
      }.headerActionFrame().padding(0).backgroundColor(Color.Transparent)
        .position({ x: bookshelfHeaderSpec().retainedLeadingInset, y: this.headerActionTop() })
        .id(this.mode === 'idle' ? 'reader-bookshelf-search-entry' : READER_LIBRARY_SEARCH_BACK_FOCUS_ID)
        .attributeModifier(new ReaderActionAccessibility(this.presentedSearch() ? '返回' : '搜索书籍', !this.model.panelOwnsInput, false, true, undefined, 'nativeButton'))
        .accessibilityLevel(this.model.panelOwnsInput ? 'no-hide-descendants' : 'auto')
        .onClick(this.leadingAction(this.identity, this.navigationGeneration, this.mounting));
    }.width('100%').height(this.barHeight());
  }
  private panelBorderColor(): string {
    return readerAppColor(this.scheme === 'night' || this.historyProgress() > .01 ?
      'app.search.panelBorder' : 'app.border.control', this.scheme);
  }
  private headerVeil(): boolean { return this.mode === 'idle' && this.historyProgress() <= .01; }
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
    return this.currentHeaderRaisedShape()?.radius ?? resolveReaderRaisedShape(this.headerRaisedShapeIdentity(),
      ReaderWindowCoordinator.metrics().windowRect.width - this.horizontalInset(true) - this.horizontalInset(false),
      this.barHeight(), this.spec.panelRadius)?.radius ?? 0;
  }
  private hasHeaderSurfaceMeasurement(): boolean {
    return this.headerSurfaceCollapsed() && this.currentHeaderRaisedShape() !== undefined;
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
      const shape = resolveReaderRaisedShape(identity, width, height, this.spec.panelRadius);
      if (shape === undefined) { this.headerRaisedShape = undefined; return; }
      const previous = this.headerRaisedShape;
      if (previous?.identity === identity && Math.abs(previous.width - width) <= .01 && Math.abs(previous.height - height) <= .01) return;
      this.headerRaisedShape = shape;
    };
  }
  private historyDividerColor(): string { return this.scheme === 'night' ? '#FF4A463F' : '#FFE8E2D8'; }
  private historyViewportHeight(): number {
    const limit = this.displayedHistoryLimit > 0 ? this.displayedHistoryLimit : this.historyLimit();
    return Math.min(this.displayedHistoryViewport, limit);
  }
  @Builder
  private header() {
    Stack({ alignContent: Alignment.TopStart }) {
      Column() {
      this.bar();
      if (this.searchMounted) {
        Stack({ alignContent: Alignment.TopStart }) {
          ForEach([this.model.currentOwner()], (owner: number) => {
            ReaderSearchHistoryPanel({ history: this.model.history, status: this.model.historyStatus,
              geometry: this.historyGeometry(),
              onFeedbackHeight: this.historyFeedbackAction(owner),
              onClear: this.clearHistoryAction(owner), onRetry: this.retryHistoryAction(owner),
              onSelect: this.historyAction(owner) });
          }, (owner: number): string => `search-history:${owner}`);
          Column() {
            Column().width('100%').height(1).backgroundColor(this.historyDividerColor());
          }.width('100%').height(1).padding({ left: 14, right: 14 })
            .hitTestBehavior(HitTestMode.None).accessibilityLevel('no-hide-descendants');
        }.width('100%').height(this.historyViewportHeight() * this.historyProgress()).clip(true)
          .opacity(this.historyProgress())
          .enabled(this.historyInteractive())
          .hitTestBehavior(this.historyInteractive() ? HitTestMode.Default : HitTestMode.None)
          .accessibilityLevel(this.historyInteractive() ? 'auto' : 'no-hide-descendants');
      }
      }.width('100%')
        .backgroundColor(this.headerVeil() ? Color.Transparent : readerAppColor('app.search.panelSurface', this.scheme))
        .backgroundEffect(this.headerVeil() ? readerHeaderVeilMaterial(this.headerScrolled, this.scheme) : undefined)
        .border({ width: this.spec.borderWidth, color: this.headerVeil() ? readerHeaderVeilBorder(this.scheme) : this.panelBorderColor() })
        .borderRadius(this.headerMaterialRadius()).clip(true).hitTestBehavior(HitTestMode.Default)
        .shadow(readerSurfaceElevation(this.headerVeil() ? 'raised' : 'fixed', this.scheme))
        .onAreaChange(this.headerSurfaceAreaChange());
    }.width('100%').clip(false)
      .shadow(readerSurfaceElevation(this.headerVeil() ? 'fixed' : this.historyProgress() > .01 ? 'popover' : 'fixed', this.scheme));
  }
  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      Stack({ alignContent: Alignment.TopStart }) {
        Column() { this.results(); }.width('100%').height(this.surfaceHeight());
      }.width('100%').height(this.mode === 'input' && this.model.sourceRecoveryVisible ?
        this.surfaceHeight() : this.resultsProgress() > 0 ?
          this.headerBottom + this.contentHeight() * this.resultsProgress() : 0)
        .clipShape(this.resultClip())
        .zIndex(this.mode === 'input' && this.model.sourceRecoveryVisible ? 3 : 2)
        .hitTestBehavior(this.mode === 'input' && this.inputInteractive() && this.model.sourceRecoveryVisible ?
          HitTestMode.Transparent : this.mode === 'results' && this.inputInteractive() ? HitTestMode.Default : HitTestMode.None)
        .accessibilityLevel((this.mode === 'results' && this.inputInteractive()) ||
          (this.mode === 'input' && this.inputInteractive() && this.model.sourceRecoveryVisible) ?
          'auto' : 'no-hide-descendants');
      Column().width('100%').height('100%')
        .backgroundColor(readerAppColor('app.scrim.modal', this.scheme))
        .opacity(this.scrimProgress()).zIndex(1)
        .hitTestBehavior(this.mode === 'input' && this.scrimProgress() > .01 ? HitTestMode.Default : HitTestMode.None)
        .onClick(this.backAction(this.identity, this.navigationGeneration, this.mounting));
      Column() {
        ReaderFixedHeaderHost({ style: new ReaderHeaderFrameStyle(true, ''), measurementKey: this.measurementKey,
          content: (): void => { this.header(); }, onHeightChange: (height: number, key: number): void => this.captureHeader(height, key) });
      }.width('100%').padding({ left: this.horizontalInset(true), right: this.horizontalInset(false) })
        .margin({ top: bookshelfHeaderSpec().topInset }).zIndex(4).hitTestBehavior(HitTestMode.Transparent);
    }.id('reader-library-search-surface').width('100%').height('100%')
      .hitTestBehavior(HitTestMode.Transparent).onAreaChange((): void => this.surfaceAreaChanged());
  }
}
