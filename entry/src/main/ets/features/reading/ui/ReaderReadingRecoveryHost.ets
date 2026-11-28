import type { ReadingExitProgressCoordinator } from '../application/ReadingExitProgressCoordinator';
import type { ReaderReadingRecordHost } from '../application/ReaderReadingRecordHost';
import type { ReaderReadingMountHost } from './ReaderReadingMountHost';
import type { ReaderReadingChapterPresentationHost } from './ReaderReadingChapterPresentationHost';
import type { ReaderReadingChapterAcquisitionHost } from './ReaderReadingChapterAcquisitionHost';
import type { ReaderReadingPreferencesHost } from './ReaderReadingPreferencesHost';
import type { ReaderReadingPlaybackFlowHost } from './ReaderReadingPlaybackFlowHost';
import type { ReaderReadingViewportHost, ReadingOverlayRenderSnapshot, ReadingOverlayRenderUpdate, ReadingSessionRenderSnapshot,
  ReadingSessionRenderUpdate } from './ReaderReadingSurfaceHost';
import type { ReaderMeasuredPagePublication } from './ReaderMeasuredPagePublication';
import type { ReaderPageTurnRuntimeHost } from './ReaderPageTurnRuntimeHost';
import type { ReaderControlDirectoryOperationsHost } from './ReaderControlDirectoryOperationsHost';
import type { UIContext } from '@ohos.arkui.UIContext';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { ReaderWindowCoordinator } from '../../../app/ReaderWindowCoordinator';
import { readerReadingTopBarFontsReady, readerReadingTopBarHeight } from '../../../ui/chrome/ReaderReadingTopBar';
import type { ReaderRecoveryView } from '../../../ui/feedback/ReaderRecoveryView';
import { readerInteractiveSafeBottom } from '../../../ui/foundation/ReaderWindowMetrics';
import { remoteReadingFailureKindOf, type RemoteReadingFailureKind } from '../application/RemoteContentAdmission';
import { RemoteReadingGatewayError } from '../application/RemoteReadingContract';
import type { ReadingDirectoryRecovery } from '../presentation/ReadingDirectoryRecovery';
import { readingFailureHint } from '../presentation/ReadingFailurePresentation';
import { READER_CONTROL_TOP_BAR_HEIGHT } from './ReaderControlGeometry';
import { READER_CONTROL_SAFE_TOP_GAP, resolveReaderControlLayout, type ReaderControlLayoutSnapshot } from './ReaderLayoutGeometry';
import type { ReaderSourceSwitchRecoveryTarget } from './ReaderReadingFailureSurface';

export type ReaderReadingRecoveryKind = 'general' | 'progress' | 'presentation';
export type ReaderReadingRecoveryPhase = 'loading' | 'measuring' | 'ready' | 'failed';

export interface ReaderReadingRecoveryScope {
  readonly sourceId: string;
  readonly bookId: string;
  readonly lifecycleToken: number;
  readonly selectionToken: number;
}

export interface ReaderReadingRecoveryLifetime {
  readonly scope: () => ReaderReadingRecoveryScope;
  readonly mounted: () => boolean;
  readonly exiting: () => boolean;
  readonly active: (lifecycle: number) => boolean;
  readonly committedProgressRevision: () => string | undefined;
}

export interface ReaderReadingRecoveryView {
  readonly notice: () => ReaderRecoveryView;
  readonly publishNotice: (notice: ReaderRecoveryView) => void;
  readonly publishActionLabel: (label: string) => void;
  readonly requested: () => boolean;
  readonly publishRequested: (requested: boolean) => void;
  // Each storage or configuration owner keeps its accepted state and receipt.
  readonly otherNoticeVisible: () => boolean;
  readonly refreshAppearanceSaveRecovery: (lifecycle: number) => void;
}

export interface ReaderReadingRecoverySurface {
  readonly uiContext: () => UIContext;
  readonly viewportWidth: () => number;
  readonly viewportHeight: () => number;
  readonly expanded: () => boolean;
  readonly controlLayout: () => ReaderControlLayoutSnapshot;
  readonly controlVisible: () => boolean;
  readonly controlMotionVisible: () => boolean;
  readonly controlInputEnabled: () => boolean;
  readonly hideControl: () => void;
  readonly readerInputCurrent: () => boolean;
}

export interface ReaderReadingDirectoryRecovery {
  readonly current: () => ReadingDirectoryRecovery;
  readonly reconcileBookmarks: (generation: number, presentation: string) => void;
  readonly continueBookmarks: (generation: number, presentation: string) => void;
  readonly reconcileOffline: (generation: number, presentation: string) => void;
  readonly continueOffline: (generation: number, presentation: string) => void;
}

export interface ReaderReadingSourceRecovery {
  readonly presentationVisible: () => boolean;
  readonly rollbackInFlight: () => boolean;
  readonly scopeId: () => number;
  readonly transactionId: () => string | undefined;
  readonly rollback: (transactionId: string, scopeId: number) => void;
}

export interface ReaderReadingFailurePresentation {
  readonly phase: () => ReaderReadingRecoveryPhase;
  readonly failureCode: () => string;
  readonly publishFailureCode: (code: string) => void;
  readonly publishFailureHint: (hint: string) => void;
  readonly markFailed: () => void;
  readonly clearChapterPresentation: () => void;
}

export interface ReaderReadingFailureEffects {
  readonly recoverPreparedTurn: (error: Error, lifecycle: number) => boolean;
  readonly recoverPreviousChapter: (error: Error, lifecycle: number) => boolean;
  readonly recoverChapterSelection: (error: Error, lifecycle: number) => boolean;
  readonly finishPageTurnFailure: () => void;
  /** Stop recording elapsed reading time, then stop automatic paging. */
  readonly stopReadingActivity: () => void;
  /** Retire measurement and entry deadlines, then cancel speculative retry. */
  readonly cancelChapterWork: () => void;
  readonly advanceChapterSelection: () => void;
  readonly revokeFailedMeasurement: () => void;
  readonly retryChapterSelection: () => boolean;
  readonly resetForChapterSelection: () => void;
  readonly armReadyDeadline: (lifecycle: number, selection: number) => void;
  readonly loadInitialReading: (lifecycle: number) => Promise<void>;
  readonly reportFailure: (sourceId: string, bookId: string, code: string, kind: RemoteReadingFailureKind) => void;
}

/** Admits native recovery actions only for the input owner that presented them.
 * The original bookmark, offline and source-switch actors own their writes and receipts. */
export class ReaderReadingRecoveryHost {
  private readonly lifetime: ReaderReadingRecoveryLifetime;
  private readonly view: ReaderReadingRecoveryView;
  private readonly surface: ReaderReadingRecoverySurface;
  private readonly directory: ReaderReadingDirectoryRecovery;
  private readonly source: ReaderReadingSourceRecovery;
  private readonly presentation: ReaderReadingFailurePresentation;
  private readonly effects: ReaderReadingFailureEffects;
  private kind: ReaderReadingRecoveryKind = 'general';
  private identity: string = '';
  private progressRevision: string | undefined = undefined;
  private action: (() => void) | undefined = undefined;
  private requestIdentity: string = '';
  private topBarRevision: number = -1;
  private topBarHeight: number = READER_CONTROL_TOP_BAR_HEIGHT;

  constructor(lifetime: ReaderReadingRecoveryLifetime, view: ReaderReadingRecoveryView,
    surface: ReaderReadingRecoverySurface, directory: ReaderReadingDirectoryRecovery,
    source: ReaderReadingSourceRecovery, presentation: ReaderReadingFailurePresentation,
    effects: ReaderReadingFailureEffects) {
    this.lifetime = lifetime;
    this.view = view;
    this.surface = surface;
    this.directory = directory;
    this.source = source;
    this.presentation = presentation;
    this.effects = effects;
  }

  show(message: string, actionLabel: string = '', action?: () => void,
    kind: ReaderReadingRecoveryKind = 'general'): void {
    this.kind = kind;
    this.identity = this.noticeOwnerKey();
    this.progressRevision = this.lifetime.committedProgressRevision();
    this.action = action;
    this.view.publishActionLabel(actionLabel);
    this.view.publishNotice({ message, visible: message.length > 0, canRetry: action !== undefined,
      generation: (this.view.notice()?.generation ?? 0) + 1 });
  }

  settle(kind: 'progress' | 'presentation', progressRevision: string | undefined = undefined): void {
    if (this.kind !== kind || this.identity !== this.noticeOwnerKey() ||
      !this.lifetime.mounted() || this.lifetime.exiting() ||
      (kind === 'progress' && (progressRevision === undefined || progressRevision === this.progressRevision))) return;
    this.show('');
  }

  reconcile(generation: number): void {
    if (!this.lifetime.mounted() || this.lifetime.exiting()) return;
    const notice = this.view.notice();
    if (!notice.visible || !notice.canRetry || generation !== notice.generation ||
      this.identity !== this.noticeOwnerKey()) return;
    // Clear the old presentation before the original effect can publish a
    // replacement. Repeated taps with the old generation then fail admission.
    const action = this.action;
    this.show('');
    action?.();
  }

  open(identity: string): void {
    this.view.refreshAppearanceSaveRecovery(this.lifetime.scope().lifecycleToken);
    if (!this.lifetime.mounted() || this.lifetime.exiting() || identity !== this.overlayId() ||
      !this.hasContent() || !this.surface.controlInputEnabled()) return;
    this.surface.hideControl();
    this.requestIdentity = identity;
    this.view.publishRequested(true);
  }

  retire(): void {
    this.view.publishRequested(false);
    this.requestIdentity = '';
  }

  requestCurrent(): boolean {
    return this.view.requested() && this.requestIdentity === this.overlayId();
  }

  inputCurrent(): boolean {
    return this.lifetime.mounted() && !this.lifetime.exiting() && this.requestCurrent() &&
      !this.surface.controlVisible() && !this.surface.controlMotionVisible() &&
      this.surface.controlInputEnabled() && !this.source.presentationVisible();
  }

  hasContent(): boolean {
    return this.view.notice().visible || this.view.otherNoticeVisible() ||
      this.directory.current().bookmarks.visible || this.directory.current().originalBookmarks !== undefined ||
      this.offlineRecoveryVisible();
  }

  overlayId(): string {
    const scope = this.lifetime.scope();
    return `reader-recovery-overlay:${JSON.stringify([scope.sourceId, scope.bookId, scope.lifecycleToken])}`;
  }

  bookmarkIdentity(): string {
    const lifecycle = this.lifetime.scope().lifecycleToken;
    const recovery = this.directory.current();
    return `${lifecycle}:${recovery.presentationId}:${recovery.bookmarks.generation}:${recovery.originalBookmarks?.identity ?? ''}`;
  }

  offlineIdentity(): string {
    return `${this.lifetime.scope().lifecycleToken}:${this.directory.current().presentationId}`;
  }

  reconcileBookmarks(identity: string, continuing: boolean): void {
    const recovery = this.directory.current();
    const original = recovery.originalBookmarks;
    if (!this.lifetime.active(this.lifetime.scope().lifecycleToken) || !this.surface.controlInputEnabled() ||
      identity !== this.bookmarkIdentity()) return;
    if (original !== undefined) {
      if (!continuing && !original.busy) this.directory.reconcileBookmarks(original.generation, recovery.presentationId);
      return;
    }
    if (!recovery.bookmarks.visible || recovery.bookmarksBusy === true ||
      (continuing ? !recovery.canContinueBookmarks : !recovery.bookmarks.canRetry)) return;
    if (continuing) this.directory.continueBookmarks(recovery.bookmarks.generation, recovery.presentationId);
    else this.directory.reconcileBookmarks(recovery.bookmarks.generation, recovery.presentationId);
  }

  reconcileOffline(identity: string, generation: number, presentation: string, continuing: boolean): void {
    const recovery = this.directory.current();
    if (!this.inputCurrent() || identity !== `${this.lifetime.scope().lifecycleToken}:${recovery.presentationId}` ||
      presentation !== recovery.presentationId || !this.offlineRecoveryVisible() || recovery.offlineBusy === true ||
      generation !== recovery.offline.generation ||
      (continuing ? !recovery.canContinueOffline : !recovery.offline.canRetry)) return;
    if (continuing) this.directory.continueOffline(generation, presentation);
    else this.directory.reconcileOffline(generation, presentation);
  }

  overlayTop(): number {
    // The floating notice is anchored to the ordinary top bar independently
    // of the body and control layouts underneath it.
    const base = resolveReaderControlLayout(this.surface.viewportWidth(), this.surface.viewportHeight(),
      this.surface.expanded(), ReaderWindowCoordinator.metrics());
    const layout = this.surface.controlLayout();
    const headerHeight = layout.topBarVisible ? Math.max(this.measuredTopBarHeight(), layout.topBarHeight) : 0;
    return base.topBarTop + (this.surface.controlVisible() ? headerHeight + READER_CONTROL_SAFE_TOP_GAP : 10);
  }

  overlayMaxHeight(): number {
    const remaining = this.surface.viewportHeight() - this.overlayTop() -
      readerInteractiveSafeBottom(ReaderWindowCoordinator.metrics(), false);
    const cap = this.surface.viewportHeight() / 3;
    return Math.max(0, Math.min(cap, remaining));
  }

  retryNoticeFromFailureSurface(generation: number): void {
    if (this.surface.readerInputCurrent()) this.reconcile(generation);
  }

  retryReadingFromFailureSurface(): void {
    if (!this.source.rollbackInFlight() && this.surface.readerInputCurrent()) this.retryReading();
  }

  rollbackSourceSwitch(target: ReaderSourceSwitchRecoveryTarget): void {
    if (!this.surface.readerInputCurrent() || this.presentation.phase() !== 'failed' || this.source.rollbackInFlight() ||
      target.scopeId !== this.source.scopeId() || target.selectionToken !== this.lifetime.scope().selectionToken ||
      target.transactionId === undefined || target.transactionId !== this.source.transactionId()) return;
    this.source.rollback(target.transactionId, target.scopeId);
  }

  fail(error: Error, lifecycle: number): void {
    if (!this.lifetime.active(lifecycle)) return;
    if (this.effects.recoverPreparedTurn(error, lifecycle) || this.effects.recoverPreviousChapter(error, lifecycle) ||
      this.effects.recoverChapterSelection(error, lifecycle)) return;
    this.presentation.clearChapterPresentation();
    const failedPhase = this.presentation.phase();
    this.presentation.publishFailureCode(error.message);
    const failureKind = remoteReadingFailureKindOf(error);
    const publicationFailure = error instanceof RemoteReadingGatewayError ?
      error.diagnostic?.chapterPublicationFailure : undefined;
    this.presentation.publishFailureHint(readingFailureHint(this.presentation.failureCode(), failureKind, publicationFailure));
    this.effects.finishPageTurnFailure();
    this.effects.stopReadingActivity();
    this.effects.cancelChapterWork();
    this.presentation.markFailed();
    // A late acquisition or measurement cannot revive this still-mounted selection.
    this.effects.advanceChapterSelection();
    this.effects.revokeFailedMeasurement();
    const gatewayFacts = error instanceof RemoteReadingGatewayError ?
      ` code=${error.code} command=${error.command ?? ''} category=${error.category}` : '';
    const publicationFact = publicationFailure === undefined ? '' : ` chapterPublicationFailure=${publicationFailure}`;
    const stableCode = /^[A-Z][A-Z0-9_]{0,95}$/.test(this.presentation.failureCode()) ?
      this.presentation.failureCode() : 'UNCLASSIFIED';
    // The public log accepts bounded diagnostic codes and excludes book content.
    hilog.error(0x5244, 'Reader', '%{public}s',
      `reader-failure phase=${failedPhase} kind=${failureKind} guard=${stableCode}${gatewayFacts}${publicationFact}`);
    hilog.error(0x5244, 'Reader', '%{private}s',
      `ReadingExperience failed: kind=${failureKind}${gatewayFacts} message=${this.presentation.failureCode()}`);
    const scope = this.lifetime.scope();
    this.effects.reportFailure(scope.sourceId, scope.bookId, this.presentation.failureCode(), failureKind);
  }

  retryReading(): void {
    if (!this.lifetime.mounted() || this.lifetime.exiting() || this.presentation.phase() !== 'failed') return;
    if (this.effects.retryChapterSelection()) return;
    this.effects.advanceChapterSelection();
    this.effects.resetForChapterSelection();
    this.presentation.publishFailureCode('');
    const scope = this.lifetime.scope();
    this.effects.armReadyDeadline(scope.lifecycleToken, scope.selectionToken);
    void this.effects.loadInitialReading(this.lifetime.scope().lifecycleToken);
  }

  showSelectionFailure(error: Error, detail: string, refreshContent: boolean,
    retryAction: () => () => void): void {
    this.presentation.publishFailureCode(error.message);
    this.presentation.publishFailureHint(readingFailureHint(this.presentation.failureCode(), remoteReadingFailureKindOf(error)));
    this.effects.finishPageTurnFailure();
    const retry = retryAction();
    hilog.error(0x5244, 'Reader', '%{private}s',
      `ReadingExperience control selection failed: ${this.presentation.failureCode()}; ${detail}`);
    this.show(refreshContent ? '本章暂未刷新，原书签和记录已保留。' : '暂未跳转，原阅读位置已保留。', '重试', retry);
  }

  private noticeOwnerKey(): string {
    const scope = this.lifetime.scope();
    return JSON.stringify([scope.sourceId, scope.bookId, scope.lifecycleToken, scope.selectionToken]);
  }

  private offlineRecoveryVisible(): boolean {
    const recovery = this.directory.current();
    return recovery.offline.visible && recovery.offlineKind !== 'result';
  }

  private measuredTopBarHeight(): number {
    const revision = ReaderWindowCoordinator.metrics().revision;
    const ready = readerReadingTopBarFontsReady('reading');
    if (!ready || this.topBarRevision !== revision) {
      this.topBarHeight = readerReadingTopBarHeight(this.surface.uiContext(), 'reading', READER_CONTROL_TOP_BAR_HEIGHT);
      this.topBarRevision = ready ? revision : -1;
    }
    return this.topBarHeight;
  }
}

export interface ReaderNativeRecoveryActors {
  readonly mount: ReaderReadingMountHost;
  readonly measured: ReaderMeasuredPagePublication;
  readonly preferences: ReaderReadingPreferencesHost;
  readonly exitProgress: ReadingExitProgressCoordinator;
  readonly acquisition: ReaderReadingChapterAcquisitionHost;
  readonly playback: ReaderReadingPlaybackFlowHost;
  readonly runtime: () => ReaderPageTurnRuntimeHost;
  readonly directory: () => ReaderControlDirectoryOperationsHost;
  readonly chapterPresentation: () => ReaderReadingChapterPresentationHost;
  readonly viewport: () => ReaderReadingViewportHost;
  readonly record: () => ReaderReadingRecordHost;
}

export interface ReaderNativeRecoveryView {
  readonly scope: () => ReaderReadingRecoveryScope;
  readonly session: () => ReadingSessionRenderSnapshot;
  readonly overlay: () => ReadingOverlayRenderSnapshot;
  readonly publishOverlay: (update: ReadingOverlayRenderUpdate) => void;
  readonly publishSession: (update: ReadingSessionRenderUpdate) => void;
  readonly markFailed: () => void;
  readonly preferenceModule: () => string;
  readonly uiContext: () => UIContext;
  readonly expanded: () => boolean;
  readonly controlLayout: () => ReaderControlLayoutSnapshot;
  readonly controlVisible: () => boolean;
  readonly controlMotionVisible: () => boolean;
  readonly controlInputEnabled: () => boolean;
  readonly hideControl: () => void;
  readonly readerInputCurrent: () => boolean;
  readonly advanceSelection: () => void;
  readonly reportFailure: (sourceId: string, bookId: string, code: string, kind: RemoteReadingFailureKind) => void;
}

/** Builds recovery from live mounted presentation and the actual measurement,
 * progress, and chapter actors. Each retry still uses its original owner. */
export function readerNativeReadingRecovery(actors: ReaderNativeRecoveryActors, native: ReaderNativeRecoveryView,
  directory: ReaderReadingDirectoryRecovery, source: ReaderReadingSourceRecovery): ReaderReadingRecoveryHost {
  const recoveryLifetime: ReaderReadingRecoveryLifetime = {
    scope: (): ReaderReadingRecoveryScope => native.scope(),
    mounted: (): boolean => native.session().mounted,
    exiting: (): boolean => native.session().exitRequested,
    active: (lifecycle: number): boolean => actors.mount.isSessionActive(lifecycle),
    committedProgressRevision: (): string | undefined => actors.exitProgress.committed?.progressRevision,
  };
  const recoveryView: ReaderReadingRecoveryView = {
    notice: (): ReaderRecoveryView => native.overlay().readerRecoveryView,
    publishNotice: (notice: ReaderRecoveryView): void => native.publishOverlay({ readerRecoveryView: notice }),
    publishActionLabel: (label: string): void => native.publishOverlay({ readerRecoveryActionLabel: label }),
    requested: (): boolean => native.overlay().readerRecoveryRequested,
    publishRequested: (requested: boolean): void => native.publishOverlay({ readerRecoveryRequested: requested }),
    otherNoticeVisible: (): boolean =>
      native.overlay().readerSettingsRecovery.visible || native.overlay().appearanceSaveRecovery.visible ||
      native.overlay().ttsPreferencesRecovery.visible ||
      (native.overlay().ttsConfigurationRecovery.visible && native.preferenceModule() !== 'tts') ||
      (native.overlay().replaceRecovery.visible && native.preferenceModule() !== 'replace'),
    refreshAppearanceSaveRecovery: (lifecycle: number): void => actors.preferences.refreshAppearanceSaveRecovery(lifecycle),
  };
  const recoverySurface: ReaderReadingRecoverySurface = {
    uiContext: (): UIContext => native.uiContext(),
    viewportWidth: (): number => actors.viewport().effectiveViewportWidth(),
    viewportHeight: (): number => actors.viewport().effectiveViewportHeight(),
    expanded: (): boolean => native.expanded(),
    controlLayout: (): ReaderControlLayoutSnapshot => native.controlLayout(),
    controlVisible: (): boolean => native.controlVisible(),
    controlMotionVisible: (): boolean => native.controlMotionVisible(),
    controlInputEnabled: (): boolean => native.controlInputEnabled(),
    hideControl: (): void => native.hideControl(),
    readerInputCurrent: (): boolean => native.readerInputCurrent(),
  };
  const failurePresentation: ReaderReadingFailurePresentation = {
    phase: (): ReaderReadingRecoveryPhase => native.session().phase,
    failureCode: (): string => native.overlay().failureCode,
    publishFailureCode: (code: string): void => native.publishOverlay({ failureCode: code }),
    publishFailureHint: (hint: string): void => native.publishOverlay({ failureHint: hint }),
    markFailed: (): void => native.markFailed(),
    clearChapterPresentation: (): void => actors.chapterPresentation().clearChapterPresentation(),
  };
  const failureEffects: ReaderReadingFailureEffects = {
    recoverPreparedTurn: (error: Error, lifecycle: number): boolean => {
      if (actors.runtime().preparation.pending === undefined) return false;
      actors.runtime().preparation.recover(error, lifecycle);
      return true;
    },
    recoverPreviousChapter: (error: Error, lifecycle: number): boolean => {
      if (actors.measured.previousChapterMeasurement === undefined) return false;
      actors.measured.recoverPreviousChapterMeasurement(error, lifecycle);
      return true;
    },
    recoverChapterSelection: (error: Error, lifecycle: number): boolean => actors.directory().selection.recover(error, lifecycle),
    finishPageTurnFailure: (): void => actors.runtime().finishPerformance('failed'),
    stopReadingActivity: (): void => {
      actors.record().capture(false);
      actors.record().clearTimer();
      actors.playback.auto.stop('lifecycle');
      actors.playback.auto.clearPageTimer();
      actors.playback.auto.clearSessionTimer();
    },
    cancelChapterWork: (): void => {
      actors.measured.measurementRun.cancelDeadline();
      actors.mount.hydration.cancelReadyDeadline();
      actors.mount.hydration.cancelCompletionDeadline();
      actors.mount.hydration.resetCompletionRetries();
      actors.runtime().preparation.cancelRetry();
    },
    advanceChapterSelection: (): void => { native.advanceSelection(); },
    revokeFailedMeasurement: (): void => {
      native.publishSession({ loadingChapterIndex: { value: undefined } });
      actors.measured.measurementCompleting = false;
      actors.measured.measurementCoordinator.clearDeferredRequest();
      actors.measured.resetPaginationDraft();
      actors.measured.physicalPagination.index.invalidateMeasurement();
    },
    retryChapterSelection: (): boolean => actors.directory().selection.retryCurrent(),
    resetForChapterSelection: (): void => actors.acquisition.resetForChapterSelection(),
    armReadyDeadline: (lifecycle: number, selection: number): void => actors.mount.hydration.armReadyDeadline(lifecycle, selection),
    loadInitialReading: (lifecycle: number): Promise<void> => actors.mount.loadInitialReading(lifecycle),
    reportFailure: (sourceId: string, bookId: string, code: string, kind: RemoteReadingFailureKind): void =>
      native.reportFailure(sourceId, bookId, code, kind),
  };
  return new ReaderReadingRecoveryHost(recoveryLifetime, recoveryView, recoverySurface, directory, source,
    failurePresentation, failureEffects);
}
