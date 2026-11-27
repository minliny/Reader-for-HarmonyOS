import type { UIContext } from '@ohos.arkui.UIContext';
import inputMethod from '@ohos.inputMethod';
import { drawing } from '@kit.ArkGraphics2D';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { ReaderWindowCoordinator } from '../../../app/ReaderWindowCoordinator';
import {
  consumeReaderControlKeyboardBack, hideReaderControlKeyboard, readerControlKeyboardVisible,
  type ReaderControlKeyboardHost,
} from '../../../ui/foundation/ReaderKeyboardBack';
import { readerMotionNowMs } from '../../../ui/foundation/ReaderMotionClock';
import { readerControlStructureKey } from '../../../ui/layout/ReaderKeyboardGeometry';
import type { ReaderAppearanceFontSlot, ReaderAppearanceSnapshot } from '../application/ReaderAppearanceState';
import type { ReaderAuxiliarySessionHost } from './ReaderAuxiliarySessionHost';
import {
  createReaderControlBackdropTouchState, reduceReaderControlBackdropTouch,
  type ReaderControlBackdropRect, type ReaderControlBackdropTouchEvent, type ReaderControlBackdropTouchState,
} from './ReaderControlBackdropTouch';
import { readerControlHostClosing, readerControlHostPage, readerControlHostVisible } from './ReaderControlHostSession';
import {
  adoptReaderControlPresentationFacts, readerControlModuleFactsMatch, readerControlPresentationGeometryMatches,
  readerControlPresentationProfileMatches, readerControlPresentationReceipt, refreshReaderControlPresentationEnvironment,
  type ReaderControlMeasuredProfile, type ReaderControlMeasuredProfileReader, type ReaderControlModuleFacts,
  type ReaderControlPresentationReceipt,
} from './ReaderControlMinimumMeasurement';
import { ReaderControlMinimumState,
  type ReaderControlMinimumWindow, type ReaderDeferredControlMinimum } from './ReaderControlMinimumState';
import { readerControlPlaybackProfileMatches, type ReaderControlPlaybackProfileReceipt } from './ReaderControlPlaybackProfile';
import {
  ReaderControlFontOrder, type ReaderControlFontOrderFacts, type ReaderControlFontOrderHost, type ReaderControlFontOrderReadback,
  type ReaderControlNavigation, type ReaderControlNavigationIntent, type ReaderControlNavigationScope,
} from './ReaderControlPresentationCoordinator';
import type { ReaderControlPage } from './ReaderControlRouting';
import { readerControlContentLocation,
  type ReaderControlLocation, type ReaderControlSessionState, type ReaderControlTemporaryInputKind } from './ReaderControlSessionState';
import type { ReaderControlCandidateMinimum, ReaderControlContentMeasurer, ReaderControlLayoutSnapshot } from './ReaderLayoutGeometry';
import type { ReaderSessionLaunchTransaction } from './ReaderSessionLaunchController';
import { ReaderUIFrameCallback } from './ReaderUIFrameCallback';

export interface ReaderControlGeometryScene {
  readonly scope: () => ReaderControlNavigationScope;
  readonly uiContext: () => UIContext;
  readonly mounted: () => boolean;
  readonly mountedToken: (lifecycle: number) => boolean;
  readonly active: (lifecycle: number) => boolean;
  readonly foreground: () => boolean;
  readonly chromeActive: () => boolean;
  readonly overlayActive: () => boolean;
  readonly interactionBlocked: () => boolean;
  readonly controlObscured: () => boolean;
  readonly width: () => number;
  readonly height: () => number;
  readonly expanded: () => boolean;
  readonly pageInputIdle: () => boolean;
  readonly controlInputEnabled: () => boolean;
  readonly session: () => ReaderControlSessionState;
  readonly motionSession: () => ReaderControlSessionState;
  readonly navigation: () => ReaderControlNavigation;
  readonly auxiliarySession: () => ReaderAuxiliarySessionHost;
  readonly launch: () => ReaderSessionLaunchTransaction | undefined;
}

/** Values crossing ArkUI Watch/Prop remain published by the mounted view. */
export interface ReaderControlGeometryPublication {
  readonly readReceipt: () => ReaderControlPresentationReceipt | undefined;
  readonly publishReceipt: (receipt: ReaderControlPresentationReceipt | undefined) => void;
  readonly readRevision: () => number;
  readonly publishRevision: (revision: number) => void;
  readonly publishReady: (ready: boolean) => void;
  readonly publishTemporaryLayer: (kind: ReaderControlTemporaryInputKind) => void;
  readonly publishTemporaryDismiss: (revision: number) => void;
  readonly publishTemporaryRetire: (revision: number) => void;
}

export interface ReaderControlGeometryEffects {
  readonly commitNavigation: (location: ReaderControlLocation, intent: ReaderControlNavigationIntent,
    source: ReaderControlSessionState, session: ReaderControlSessionState) => ReaderControlPage | undefined;
  readonly prepareControlPage: (page: ReaderControlPage) => void;
  readonly prepareReplace: () => void;
  readonly dismissFromBackdrop: () => void;
  readonly fontOrder: () => ReaderAppearanceFontSlot[];
  readonly commitFontOrder: (order: ReaderAppearanceFontSlot[]) => Promise<ReaderAppearanceSnapshot | undefined>;
  readonly fontOrderDisplayed: (facts: ReaderControlFontOrderFacts) => void;
}

export interface ReaderControlPlaybackSourceMinimum {
  readonly required: boolean;
  readonly receipt: ReaderControlPlaybackProfileReceipt | undefined;
}

/** Owns measured control geometry, the pending provider generation and the
 * window-space input lease. The view applies accepted navigation using its
 * original synchronous session writer. */
export class ReaderControlGeometryHost {
  readonly minimum: ReaderControlMinimumState<ReaderControlMeasuredProfile, ReaderControlModuleFacts>;
  readonly fontOrder: ReaderControlFontOrder;
  private readonly scene: ReaderControlGeometryScene;
  private readonly publication: ReaderControlGeometryPublication;
  private readonly effects: ReaderControlGeometryEffects;
  private revision: number = 0;
  private ready: boolean = false;
  private structure: string = '';
  private playback: ReaderControlPlaybackProfileReceipt | undefined = undefined;
  private backdropRevision: number = 0;
  private backdropGeometryReady: boolean = false;
  private backdropRegions: ReaderControlBackdropRect[] = [];
  private backdropTouch: ReaderControlBackdropTouchState = createReaderControlBackdropTouchState();
  private roundedPath: drawing.Path | undefined = undefined;
  private roundedPathWidth: number = -1;
  private roundedPathHeight: number = -1;
  private roundedPathRadius: number = -1;
  private temporary: ReaderControlTemporaryInputKind = '';
  private dismissRevision: number = 0;
  private retireRevision: number = 0;

  constructor(scene: ReaderControlGeometryScene, publication: ReaderControlGeometryPublication, effects: ReaderControlGeometryEffects) {
    this.scene = scene;
    this.publication = publication;
    this.effects = effects;
    this.minimum = new ReaderControlMinimumState<ReaderControlMeasuredProfile, ReaderControlModuleFacts>({
      sourceId: (): string => this.scene.scope().sourceId,
      bookId: (): string => this.scene.scope().bookId,
      lifecycleToken: (): number => this.scene.scope().lifecycleToken,
      openRevision: (): number => this.scene.scope().openRevision,
      visitRevision: (): number => this.scene.scope().visitRevision,
      expandedLayout: (): boolean => this.scene.expanded(),
      minimumRevision: (): number => this.publication.readRevision(),
    });
    const font: ReaderControlFontOrderHost = {
      committedIdentity: (): string => this.committedIdentity(),
      openRevision: (): number => this.scene.scope().openRevision,
      current: (identity: string): boolean => this.fontCurrent(identity),
      order: (): ReaderAppearanceFontSlot[] => this.effects.fontOrder(),
      providerReadback: (): ReaderControlFontOrderReadback | undefined => {
        const facts = this.minimum.providerFacts;
        return facts?.module === 'appearance' ? facts.appearance : undefined;
      },
      preparedReadback: (identity: string): ReaderControlFontOrderReadback | undefined => this.fontPreparedReadback(identity),
      generation: (): number => this.minimum.generation,
      environment: (): string => this.environmentKey(),
      commit: (order: ReaderAppearanceFontSlot[]): Promise<ReaderAppearanceSnapshot | undefined> => this.effects.commitFontOrder(order),
      displayed: (facts: ReaderControlFontOrderFacts): void => this.effects.fontOrderDisplayed(facts),
    };
    this.fontOrder = new ReaderControlFontOrder(font);
  }

  get temporaryLayer(): ReaderControlTemporaryInputKind { return this.temporary; }

  beginMount(): void { this.backdropGeometryReady = false; }

  retireMinimum(): void {
    this.minimum.retireProvider();
    this.publication.publishReceipt(undefined);
    this.scene.navigation().retire();
    this.playback = undefined;
    this.minimum.clearCandidates();
    this.publishReady(false);
  }

  layout(_windowMetricsRevision: number): ReaderControlLayoutSnapshot {
    const metrics = ReaderWindowCoordinator.metrics();
    const auxiliary = this.scene.auxiliarySession();
    const held = auxiliary.sourceMinimum;
    if (held?.receipt !== undefined) {
      const launch = this.scene.launch();
      if (launch !== undefined && launch.ownership !== 'released' && held.generation === launch.generation &&
        held.receipt.metricsRevision === metrics.revision && auxiliary.layoutCurrent()) return held.receipt.layout;
    }
    const width = this.scene.width();
    const height = this.scene.height();
    const committed = this.publication.readReceipt();
    if (committed !== undefined && committed.environmentKey === this.environmentKey() && this.minimum.matchesOpen()) {
      return committed.layout;
    }
    return this.minimum.layout(width, height, metrics);
  }

  identity(): string { return this.scene.navigation().active()?.identity ?? this.committedIdentity(); }
  committedIdentity(): string { return this.scene.navigation().committedIdentity(); }
  requestLocation(): ReaderControlLocation {
    return this.scene.navigation().active()?.target ?? readerControlContentLocation(this.scene.session());
  }
  ownerKey(): string { return this.scene.navigation().ownerKey(); }

  environmentKey(): string {
    const metrics = ReaderWindowCoordinator.metrics();
    return JSON.stringify([this.scene.width(), this.scene.height(), this.scene.expanded(),
      metrics.densityPixels, metrics.systemFontScale, metrics.windowRect,
      metrics.systemInsets, metrics.cutoutInsets, metrics.gestureInsets, metrics.navigationInsets,
      metrics.keyboardInsets, metrics.keyboardArea, metrics.statusBarRect, metrics.statusBarHeight, metrics.statusBarCutoutRect]);
  }

  private structureKey(): string {
    return readerControlStructureKey(ReaderWindowCoordinator.metrics(), this.scene.width(), this.scene.height(), this.scene.expanded());
  }

  refreshEditingEnvironment(): boolean {
    const previous = this.publication.readReceipt();
    const key = this.structureKey();
    const facts = this.minimum.providerFacts;
    if (previous === undefined || key !== this.structure ||
      previous.identity !== this.committedIdentity() || this.scene.navigation().active() !== undefined ||
      previous.ownerKey !== this.ownerKey() || !this.current(previous.identity) ||
      facts === undefined || !readerControlModuleFactsMatch(facts, previous.profile.module) ||
      !this.minimum.factsMatchCommitted()) return false;
    const metrics = ReaderWindowCoordinator.metrics();
    const environment = this.environmentKey();
    this.minimum.revalidateEnvironment(environment);
    this.publication.publishReceipt(refreshReaderControlPresentationEnvironment(previous, environment, metrics.revision));
    this.minimum.revalidateCandidateMetrics(metrics.revision);
    this.fontOrder.reconcile();
    return true;
  }

  current(identity: string): boolean {
    return this.scene.active(this.scene.scope().lifecycleToken) && this.scene.foreground() && this.scene.chromeActive() &&
      !this.scene.overlayActive() && !this.scene.interactionBlocked() && !this.scene.controlObscured() &&
      this.scene.width() > 0 && this.scene.height() > 0 && identity === this.identity();
  }

  bind(identity: string, measurer: ReaderControlContentMeasurer | undefined, profileReader?: ReaderControlMeasuredProfileReader,
    facts?: ReaderControlModuleFacts, factsGeometryKey?: string): void {
    if (identity !== this.identity() || !this.scene.mounted()) return;
    this.minimum.bind(identity, measurer, profileReader, (): string => this.environmentKey(), facts, factsGeometryKey ?? '');
    this.schedule();
  }

  receiptCurrent(key: string): boolean {
    const committed = this.publication.readReceipt();
    if (committed !== undefined) return committed.key === key && committed.identity === this.committedIdentity() &&
      committed.environmentKey === this.environmentKey();
    return this.minimum.unprofiledReceiptCurrent(key, (): string => this.identity());
  }

  private window(): ReaderControlMinimumWindow {
    return { width: this.scene.width(), height: this.scene.height(), expanded: this.scene.expanded(), metrics: ReaderWindowCoordinator.metrics() };
  }

  schedule(): void {
    this.minimum.schedule({
      current: (identity: string): boolean => this.current(identity),
      environment: (): string => this.environmentKey(),
      navigationGeneration: (): number | undefined => this.scene.navigation().active()?.generation,
      location: (): ReaderControlLocation => this.requestLocation(),
      window: (): ReaderControlMinimumWindow => this.window(),
      postFrame: (run: () => void): void => this.scene.uiContext().postFrameCallback(new ReaderUIFrameCallback(run)),
      onPending: (): void => {
        if (this.publication.readReceipt() === undefined) this.publishReady(false);
      },
      onUnavailable: (identity: string): void => this.fontOrder.unavailable(identity),
      canAdoptFacts: (facts: ReaderControlModuleFacts, identity: string, environment: string): boolean => {
        const previous = this.publication.readReceipt();
        return previous !== undefined && previous.identity === identity && previous.environmentKey === environment &&
          readerControlModuleFactsMatch(facts, previous.profile.module);
      },
      adoptFacts: (facts: ReaderControlModuleFacts): void => this.adoptFacts(facts),
      admit: (candidates: ReaderControlCandidateMinimum[], identity: string): void => this.admit(candidates, identity),
    });
  }

  private adoptFacts(facts: ReaderControlModuleFacts | undefined): void {
    const previous = this.publication.readReceipt();
    if (previous === undefined) return;
    const updated = adoptReaderControlPresentationFacts(previous, facts);
    if (updated !== previous) this.publication.publishReceipt(updated);
    this.fontOrder.reconcile();
    if (readerControlHostPage(this.scene.session()) === 'quickReplace') this.effects.prepareReplace();
  }

  admit(candidates: ReaderControlCandidateMinimum[], identity: string): void {
    const admission = this.minimum.prepareAdmission<ReaderControlPresentationReceipt>(candidates, identity, {
      current: (target: string): boolean => this.current(target),
      environment: (): string => this.environmentKey(),
      inputIdle: (): boolean => this.scene.pageInputIdle(),
      location: (): ReaderControlLocation => this.requestLocation(),
      window: (): ReaderControlMinimumWindow => this.window(),
      matchesProfile: readerControlPresentationProfileMatches,
      previousReceipt: (): ReaderControlPresentationReceipt | undefined => this.publication.readReceipt(),
      sameGeometry: (previous: ReaderControlPresentationReceipt, target: string, environment: string,
        layout: ReaderControlLayoutSnapshot, profile: ReaderControlMeasuredProfile): boolean =>
        previous.identity === target && previous.environmentKey === environment && readerControlPresentationGeometryMatches(previous, layout, profile),
    });
    if (admission.kind === 'ignored') return;
    if (admission.kind === 'unavailable') {
      this.fontOrder.unavailable(identity);
      return;
    }
    if (admission.kind === 'reuse') {
      this.publishReady(true);
      this.minimum.commitFacts();
      this.adoptFacts(admission.profile.moduleFacts);
      return;
    }
    let preparedPage: ReaderControlPage | undefined = undefined;
    let nextReceipt: ReaderControlPresentationReceipt | undefined = undefined;
    if (admission.kind === 'new-profile') {
      const location = admission.location;
      nextReceipt = readerControlPresentationReceipt(identity, this.ownerKey(), admission.environment,
        location, admission.layout, admission.profile);
      const navigation = this.scene.navigation().prepareCommit();
      if (navigation !== undefined) preparedPage = this.effects.commitNavigation(location, navigation.intent, navigation.source, navigation.session);
      this.minimum.commitFacts();
    }
    this.structure = this.structureKey();
    this.minimum.commitCandidates(candidates, (): number => this.scene.width(), (): number => this.scene.height(),
      (): number => ReaderWindowCoordinator.metrics().revision);
    this.revision += 1;
    this.publication.publishRevision(this.revision);
    this.publishReady(candidates.length > 0);
    if (nextReceipt !== undefined) this.publication.publishReceipt(nextReceipt);
    this.fontOrder.reconcile();
    this.invalidateBackdrop();
    if (preparedPage !== undefined) this.effects.prepareControlPage(preparedPage);
    else if (readerControlHostPage(this.scene.session()) === 'quickReplace') this.effects.prepareReplace();
  }

  private publishReady(ready: boolean): void {
    this.ready = ready;
    this.publication.publishReady(ready);
  }

  takeDeferred(): ReaderDeferredControlMinimum | undefined {
    const deferred = this.minimum.deferred;
    this.minimum.clearDeferred();
    return deferred;
  }

  private fontCurrent(identity: string): boolean {
    const page = readerControlHostPage(this.scene.session());
    return this.scene.controlInputEnabled() && !this.scene.overlayActive() && !readerControlHostClosing(this.scene.session()) &&
      (page === 'moduleAppearance' || page === 'fullAppearance') &&
      identity === this.committedIdentity() && identity === this.identity();
  }

  private fontPreparedReadback(identity: string): ReaderControlFontOrderReadback | undefined {
    const receipt = this.publication.readReceipt();
    const prepared = receipt?.prepared;
    if (receipt === undefined || receipt.ownerKey !== this.ownerKey() ||
      receipt.profile.module !== 'appearance' || !this.receiptCurrent(receipt.key) ||
      prepared === undefined || prepared.identity !== identity || prepared.key !== receipt.key) return undefined;
    return prepared.facts?.module === 'appearance' ? prepared.facts.appearance : undefined;
  }

  acceptPlaybackProfile(receipt: ReaderControlPlaybackProfileReceipt, windowMetricsRevision: number): void {
    const location = readerControlContentLocation(this.scene.session());
    const module = location.module;
    const metrics = ReaderWindowCoordinator.metrics();
    if ((module !== 'tts' && module !== 'autoPage') || location.level !== 'secondary' || !this.current(this.identity()) ||
      !this.ready || !readerControlPlaybackProfileMatches(receipt, module, this.committedIdentity(),
        this.layout(windowMetricsRevision).minimumKey, metrics.revision)) return;
    const layout = this.layout(windowMetricsRevision);
    if (receipt.layout.fullPanelWidth !== layout.fullPanelWidth || receipt.layout.fullPanelHeight !== layout.fullPanelHeight ||
      receipt.layout.quickPanelHeight !== layout.quickPanelHeight || receipt.bounds.fullHeight !== layout.fullPanelHeight ||
      (layout.quickPanelHeight !== undefined && receipt.bounds.quickHeight !== layout.quickPanelHeight) ||
      receipt.bounds.bottomGap !== layout.dockBottomGap) return;
    const previous = this.playback;
    if (previous !== undefined && previous.identity === receipt.identity && previous.key === receipt.key &&
      previous.metricsRevision === receipt.metricsRevision && previous.module === receipt.module &&
      previous.data === receipt.data && previous.layout === receipt.layout) return;
    this.playback = receipt;
  }

  playbackSourceMinimum(module: 'tts' | 'autoPage', windowMetricsRevision: number): ReaderControlPlaybackSourceMinimum {
    const required = this.scene.width() > 0 && this.scene.height() > 0 &&
      typeof this.minimum.providerIdentity === 'string' && this.minimum.providerIdentity.length > 0;
    if (!required) return { required: false, receipt: undefined };
    const receipt = this.playback;
    const layout = this.layout(windowMetricsRevision);
    if (receipt === undefined || !readerControlPlaybackProfileMatches(receipt, module,
      this.committedIdentity(), layout.minimumKey, ReaderWindowCoordinator.metrics().revision) ||
      receipt.layout.fullPanelWidth !== layout.fullPanelWidth || receipt.layout.fullPanelHeight !== layout.fullPanelHeight ||
      receipt.layout.quickPanelHeight !== layout.quickPanelHeight) return { required: true, receipt: undefined };
    return { required: true, receipt };
  }

  acceptBackdropRegions(regions: ReaderControlBackdropRect[], ready: boolean): void {
    this.backdropRegions = regions;
    this.backdropGeometryReady = ready;
  }

  invalidateBackdrop(): void {
    this.backdropRevision += 1;
    this.backdropTouch = createReaderControlBackdropTouchState();
  }

  onBackdropTouch(event: TouchEvent): void {
    if (!this.scene.controlInputEnabled() || event.type === TouchType.Cancel) {
      this.backdropTouch = createReaderControlBackdropTouchState();
      return;
    }
    const pointers = event.changedTouches.length > 0 ? event.changedTouches : event.touches;
    for (let index = 0; index < pointers.length; index += 1) {
      const pointer = pointers[index];
      const touch: ReaderControlBackdropTouchEvent = {
        kind: event.type === TouchType.Down ? 'down' : event.type === TouchType.Up ? 'up' : 'move',
        pointerId: pointer.id, windowX: pointer.windowX, windowY: pointer.windowY, timeMs: readerMotionNowMs(),
      };
      const result = reduceReaderControlBackdropTouch(this.backdropTouch, touch, {
        visible: readerControlHostVisible(this.scene.motionSession()), geometryReady: this.backdropGeometryReady,
        heldPointerId: this.scene.motionSession().heldPointerId, closeRevision: this.scene.motionSession().closeRevision,
        invalidationRevision: this.backdropRevision, excludedRects: this.backdropRegions,
        containsRoundedRect: (rect: ReaderControlBackdropRect, x: number, y: number): boolean => this.containsRoundRect(rect, x, y),
      }, { tapMaxDurationMs: 500, touchSlopVp: 8 });
      this.backdropTouch = result.state;
      if (result.shouldDismiss) {
        this.effects.dismissFromBackdrop();
        return;
      }
    }
  }

  private containsRoundRect(rect: ReaderControlBackdropRect, x: number, y: number): boolean {
    const radius = rect.borderRadius ?? 0;
    if (this.roundedPath === undefined || this.roundedPathWidth !== rect.width ||
      this.roundedPathHeight !== rect.height || this.roundedPathRadius !== radius) {
      const path = new drawing.Path();
      path.addRoundRect(new drawing.RoundRect({ left: 0, top: 0, right: rect.width, bottom: rect.height }, radius, radius));
      this.roundedPath = path;
      this.roundedPathWidth = rect.width;
      this.roundedPathHeight = rect.height;
      this.roundedPathRadius = radius;
    }
    return this.roundedPath.contains(x - rect.x, y - rect.y);
  }

  dismissTemporaryLayers(): void {
    this.retireRevision += 1;
    this.publication.publishTemporaryRetire(this.retireRevision);
    this.dismissRevision += 1;
    this.publication.publishTemporaryDismiss(this.dismissRevision);
    this.temporary = '';
    this.publication.publishTemporaryLayer('');
  }

  onTemporaryLayerChanged(active: boolean, kind: ReaderControlTemporaryInputKind = 'modal'): void {
    const next = active ? kind : '';
    if (this.temporary === next) return;
    this.temporary = next;
    const lifecycle = this.scene.scope().lifecycleToken;
    this.scene.uiContext().postFrameCallback(new ReaderUIFrameCallback((): void => {
      if (!this.scene.active(lifecycle)) return;
      this.publication.publishTemporaryLayer(this.temporary);
      this.invalidateBackdrop();
    }));
  }

  consumeTemporaryBack(report: () => void): boolean {
    if (this.temporary.length === 0 || !readerControlHostVisible(this.scene.motionSession())) return false;
    report();
    this.dismissRevision += 1;
    this.publication.publishTemporaryDismiss(this.dismissRevision);
    return true;
  }

  consumeKeyboardBack(): boolean {
    return this.scene.controlInputEnabled() &&
      consumeReaderControlKeyboardBack(ReaderWindowCoordinator.metrics(), this.keyboardHost());
  }

  hideKeyboardIfVisible(): void {
    if (readerControlKeyboardVisible(ReaderWindowCoordinator.metrics())) hideReaderControlKeyboard(this.keyboardHost());
  }

  private keyboardHost(): ReaderControlKeyboardHost {
    const lifecycle = this.scene.scope().lifecycleToken;
    return {
      hideTextInput: (): Promise<void> => inputMethod.getController().hideTextInput(),
      onFailure: (error: Error): void => {
        if (!this.scene.mountedToken(lifecycle)) return;
        hilog.warn(0x5244, 'Reader', '%{private}s', `ReadingExperience keyboard hide failed: ${error.message}`);
      },
    };
  }
}
