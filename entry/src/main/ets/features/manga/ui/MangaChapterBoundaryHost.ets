import { ReaderTransientFeedback, READER_FEEDBACK_BRIEF_MS } from '../../../ui/feedback/ReaderTransientFeedback';
import hilog from '@ohos.hilog';
import vibrator from '@ohos.vibrator';
import { diagnosticCodeOf } from '../../../app/LogPrivacy';
import { type RemoteReadingTocEntry } from '../../reading/application/RemoteReadingFlowGateway';
import type { MangaManifest } from '../application/MangaContract';
import { MangaSessionController } from '../application/MangaSessionController';
import { MangaChapterTransitionCoordinator, MangaChapterTransitionCandidate } from '../application/MangaChapterTransitionCoordinator';
import { PullDirection } from '../vendor/pulltorefresh/PullToRefresh';
import { MangaBoundaryTurnFeedback } from './MangaBoundaryTurnFeedback';
import { MangaStripRow } from './MangaStripProjection';
import { MangaBookPresentation } from '../presentation/MangaBookPresentation';
import type { MangaConfirmedPosition } from './MangaReadingViewportHost';
import { ReaderPostLayoutFrame } from '../../../ui/layout/ReaderPostLayoutFrame';
import type { ReadingGatewayRuntime } from '../../reading/application/ReadingGatewayRuntime';
import type { RemoteReadingSession } from '../../reading/application/RemoteReadingFlowGateway';
import type { MangaBoundaryLayoutSample, MangaBoundaryPaintResult, MangaViewportBoundaryAdmission } from './MangaReadingViewportHost';
import type { MangaDirectoryChapterNavigation } from './MangaDirectoryDrawer';
import type { MangaChromeChapterNavigation } from './MangaReaderChrome';

export interface MangaRetainedPixel { key: string; uri: string; x: number; y: number; width: number; height: number; }
@Observed
export class MangaBoundaryRenderState {
  @Track boundaryDirection: PullDirection = '';
  @Track boundaryDistance: number = 0;
  @Track boundaryArmed: boolean = false;
  @Track boundaryBusy: boolean = false;
  @Track boundaryViewportFixed: boolean = false;
  @Track boundaryFailure: string = '';
  @Track boundaryReset: number = 0;
  @Track previousChapterPixels: MangaRetainedPixel[] = [];
  @Track rollbackPainting: boolean = false;
}

export interface MangaBoundaryBook {
  readonly sourceId: string;
  readonly bookId: string;
  readonly controller: MangaSessionController | undefined;
  readonly runtime: ReadingGatewayRuntime | undefined;
  readonly remoteSession: RemoteReadingSession | undefined;
  readonly offline: boolean;
  readonly isReaderIdentityCurrent: () => boolean;
}

export interface MangaBoundaryWindow {
  readonly setControlsVisible: (value: boolean) => void;
  readonly getUIContext: () => UIContext;
  readonly interactionBlocked: boolean;
  readonly panel: string;
  readonly reduceMotion: boolean;
  readonly windowChromeActive: boolean;
  readonly windowChromeOverlayActive: boolean;
}

export interface MangaBoundaryChapter {
  readonly setChapterEnd: (value: boolean) => void;
  readonly setChapterCommitted: (value: boolean) => void;
  readonly replaceController: (value: MangaSessionController) => void;
  readonly mounted: boolean;
  readonly exiting: boolean;
  readonly chapterEnd: boolean;
  readonly chapterCommitted: boolean;
  readonly error: string;
  readonly loginRequiredForControls: boolean;
  readonly opened: boolean;
  readonly pageTurnInputRevision: number;
  readonly recovering: boolean;
  readonly title: string;
  readonly configureAdjacentChapter: (session: RemoteReadingSession, controller: MangaSessionController) => void;
}

export interface MangaBoundaryActions {
  readonly onAdjacentChapterCommitted: (index: number, title: string) => void;
  readonly onSaveFailure: (message: string) => void;
}

export interface MangaBoundaryChromeControls {
  readerPanelForeground(): boolean;
  performPanelAction(action: () => void | Promise<void>, requireProgressSave?: () => boolean): Promise<boolean>;
  readonly phase: string;
  chromeScheme(): 'day' | 'night';
  paperColor(): string;
}

export interface MangaBoundaryViewportPort {
  pageOrdinal(): number;
  confirmedBoundaryOrigin(): MangaConfirmedPosition | undefined;
  terminalPageConfirmed(controller: MangaSessionController | undefined, ordinal: number, confirmed: MangaConfirmedPosition | undefined, vertical: boolean): boolean;
  canPullBoundary(): boolean;
  readonly anchorRestoring: boolean;
  clearPageSliderPreview(): void;
  flushViewportObservation(): void;
  queueViewportObservation(): void;
  readonly viewportWidth: number;
  readonly viewportHeight: number;
  effectiveFit(): 'width' | 'contain';
  captureChapterPixels(): MangaRetainedPixel[];
  publish(): void;
  invalidateBoundaryManifest(): void;
  landBoundaryPage(ordinal: number, y: number, x: number): void;
  displayChapterTitle(index: number, title: string): string;
  saveVisible(): Promise<boolean>;
  resetBoundaryZoom(): number;
  restoreBoundaryZoom(zoom: number): void;
  readonly pinching: boolean;
  readonly pinchRestorePending: boolean;
  stageBoundaryOrigin(confirmed: MangaConfirmedPosition | undefined): void;
  paintBoundaryOrigin(confirmed: MangaConfirmedPosition | undefined, paintGeneration: number): void;
  clearBoundaryRestore(paintGeneration?: number): void;
  rowRenderKey(row: MangaStripRow): string;
  reportNativeTileFailure(row: MangaStripRow, uri: string): void;
  sampleBoundaryTrace(): MangaBoundaryLayoutSample;
  checkRestoredBoundaryFrame(controller: MangaSessionController, decoded: (key: string) => boolean): boolean;
  checkCandidateBoundaryFrame(controller: MangaSessionController, decoded: (key: string) => boolean, landing: 'first' | 'last', target: number, landingTileIndex: number): MangaBoundaryPaintResult;
}

export interface MangaBoundaryMount {
  readonly book: MangaBoundaryBook;
  readonly window: MangaBoundaryWindow;
  readonly chapter: MangaBoundaryChapter;
  readonly actions: MangaBoundaryActions;
  readonly controls: () => MangaBoundaryChromeControls;
  readonly viewport: () => MangaBoundaryViewportPort;
}

/** Held-pull input, candidate and rollback paint proofs, and chapter commit admission. */
export class MangaChapterBoundaryHost implements MangaDirectoryChapterNavigation, MangaChromeChapterNavigation, MangaViewportBoundaryAdmission {
  private readonly transientFeedback: ReaderTransientFeedback;
  readonly scene: MangaBoundaryMount;
  private readonly readState: () => MangaBoundaryRenderState;

  constructor(scene: MangaBoundaryMount, readState: () => MangaBoundaryRenderState, transientFeedback: ReaderTransientFeedback) {
    this.scene = scene;
    this.readState = readState;
    this.transientFeedback = transientFeedback;
  }

  get state(): MangaBoundaryRenderState { return this.readState(); }

  private boundaryInputRevision: number = -1;
  boundaryDragging: boolean = false;
  private boundaryOrigin: MangaConfirmedPosition | undefined;
  private boundaryGeneration: number = 0;
  private chapterTransitions: MangaChapterTransitionCoordinator | undefined;
  private pendingChapterTransition: MangaChapterTransitionCandidate | undefined;
  private previousChapterController: MangaSessionController | undefined;
  private previousChapterCommitted: boolean = false;
  private previousChapterZoom: number = 1;
  private boundaryTargetTitle: string = '';
  private nativeTransitionImageReady: boolean = false;
  private nativeTransitionResolve: (() => void) | undefined;
  private nativeTransitionReject: ((error: Error) => void) | undefined;
  private nativeTransitionTimer: number = -1;
  private boundaryRetryDirection: number = 1;
  private boundaryHapticSent: boolean = false;
  private nativeTransitionImages: Set<string> = new Set();
  private rollbackChapterController: MangaSessionController | undefined;
  private rollbackChapterImages: Set<string> = new Set();
  private rollbackFrameTimer: number = -1;
  private boundaryPaintGeneration: number = 0;
  private boundaryTraceEvents: number = 0;
  releaseMount(): void {
    if (this.state.boundaryBusy || this.boundaryDragging || this.chapterTransitions?.pending === true)
      void this.cancelBoundaryChapter().catch((): void => {});
    this.clearRollbackPaint();
  }

  adjacentChapter(direction: number): RemoteReadingTocEntry | undefined {
    const current = this.scene.book.controller?.chapter;
    const session = this.scene.book.remoteSession;
    if (current === undefined || session?.contentKind !== 'manga' ||
      session.identity.sourceId !== this.scene.book.sourceId || session.identity.bookId !== this.scene.book.bookId ||
      (session.requiresContextRefresh === true && session.acquisitionMode !== 'offline') ||
      current.manifest.chapter.sourceId !== this.scene.book.sourceId || current.manifest.chapter.bookId !== this.scene.book.bookId) return undefined;
    const position = session.entries.findIndex((entry: RemoteReadingTocEntry): boolean =>
      entry.index === current.chapterIndex && entry.url === current.manifest.chapter.chapterId);
    if (position < 0) return undefined;
    const entries = direction > 0 ? session.entries.slice(position + 1) : session.entries.slice(0, position).reverse();
    return entries.find((entry: RemoteReadingTocEntry): boolean => entry.navigable !== false &&
      entry.url.trim().length > 0 && entry.url !== current.manifest.chapter.chapterId);
  }
  finalBoundaryConfirmed(): boolean {
    const session = this.scene.book.remoteSession;
    const current = this.scene.book.controller?.chapter;
    if (session?.contentKind !== 'manga' || current === undefined || session.identity.sourceId !== this.scene.book.sourceId ||
      session.identity.bookId !== this.scene.book.bookId || current.manifest.chapter.sourceId !== this.scene.book.sourceId ||
      current.manifest.chapter.bookId !== this.scene.book.bookId) return false;
    const proven = session.acquisitionMode === 'online' ? !session.requiresContextRefresh :
      (session.catalogVersion?.trim().length ?? 0) > 0 && session.sourceVersion === current.manifest.sourceRuleVersion;
    return proven && session.entries.some((entry: RemoteReadingTocEntry): boolean => entry.index === current.chapterIndex &&
      entry.url === current.manifest.chapter.chapterId) && this.adjacentChapter(1) === undefined;
  }
  async releaseNextBoundary(): Promise<string> {
    if (!this.scene.controls().readerPanelForeground() || !this.boundaryDragging || !this.state.boundaryArmed ||
      this.boundaryInputRevision !== this.scene.chapter.pageTurnInputRevision) return '';
    if (this.adjacentChapter(1) !== undefined) return this.turnBoundaryChapter(1);
    await this.openChapterEnd(true);
    return '';
  }
  resumeFromChapterEnd(): void {
    if (!this.scene.chapter.chapterEnd || !this.scene.controls().readerPanelForeground() || this.scene.window.panel.length > 0) return;
    this.scene.chapter.setChapterEnd(false);
    this.scene.window.setControlsVisible(true);
  }
  async openChapterEnd(fromVerticalBoundary: boolean = false): Promise<void> {
    const inputRevision = this.scene.chapter.pageTurnInputRevision;
    const canOpen = (): boolean => {
      const ordinal = this.scene.viewport().pageOrdinal();
      const confirmed = this.scene.viewport().confirmedBoundaryOrigin();
      if (!this.scene.chapter.opened || !this.scene.controls().readerPanelForeground() || inputRevision !== this.scene.chapter.pageTurnInputRevision ||
        !this.scene.viewport().terminalPageConfirmed(this.scene.book.controller, ordinal, confirmed, fromVerticalBoundary)) return false;
      return !fromVerticalBoundary || this.finalBoundaryConfirmed();
    };
    if (!canOpen()) return;
    await this.scene.controls().performPanelAction((): void => { if (canOpen()) this.scene.chapter.setChapterEnd(true); });
  }
  async selectAdjacentChapter(direction: number, fromDirectory: boolean = false): Promise<void> {
    if (this.adjacentChapter(direction) === undefined) return;
    await this.scene.controls().performPanelAction(async (): Promise<void> => {
      if (fromDirectory && !this.scene.controls().readerPanelForeground()) return;
      this.scene.chapter.setChapterEnd(false);
      await this.turnBoundaryChapter(direction);
    });
  }
  boundaryEnabled(): boolean {
    return this.scene.chapter.mounted && this.scene.chapter.opened && this.scene.viewport().canPullBoundary() && !this.scene.chapter.recovering && !this.scene.chapter.exiting &&
      this.scene.window.panel.length === 0 && this.scene.controls().phase === 'closed' && !this.scene.chapter.chapterEnd && this.scene.window.windowChromeActive &&
      this.scene.controls().readerPanelForeground() && !this.scene.viewport().anchorRestoring && !this.scene.chapter.loginRequiredForControls &&
      this.scene.chapter.error.length === 0 && !this.scene.viewport().pinching && !this.state.boundaryBusy && !this.state.rollbackPainting && this.pendingChapterTransition === undefined && this.rollbackChapterController === undefined;
  }
  onBoundaryPull(direction: PullDirection, distance: number, armed: boolean): void {
    if (!this.scene.controls().readerPanelForeground() || this.boundaryInputRevision !== this.scene.chapter.pageTurnInputRevision) return;
    if (armed && !this.boundaryHapticSent && !this.scene.window.reduceMotion) {
      this.boundaryHapticSent = true;
      try { void vibrator.startVibration({ type: 'time', duration: 10 }, { usage: 'touch' }).catch((): void => {}); }
      catch (_error) { /* Unsupported motors never own navigation. */ }
    }
    this.state.boundaryDirection = direction; this.state.boundaryDistance = distance; this.state.boundaryArmed = armed;
  }
  onBoundaryActivity(active: boolean): void {
    if (active && !this.scene.controls().readerPanelForeground()) return;
    if (active && !this.boundaryDragging) {
      this.scene.viewport().clearPageSliderPreview();
      this.boundaryInputRevision = this.scene.chapter.pageTurnInputRevision;
      this.boundaryHapticSent = false;
      this.scene.viewport().flushViewportObservation();
      this.boundaryOrigin = this.scene.viewport().confirmedBoundaryOrigin();
    }
    this.boundaryDragging = active;
    if (!active && !this.state.boundaryBusy) {
      this.boundaryOrigin = undefined;
      this.scene.viewport().queueViewportObservation();
    }
  }
  async turnBoundaryChapter(direction: number): Promise<string> {
    if (!this.scene.controls().readerPanelForeground() || (this.boundaryDragging && this.boundaryInputRevision !== this.scene.chapter.pageTurnInputRevision) ||
      this.scene.viewport().pinching || this.scene.viewport().pinchRestorePending || this.state.boundaryBusy || this.rollbackChapterController !== undefined ||
      this.scene.book.runtime === undefined || this.chapterTransitions?.pending === true) return '';
    const target = this.adjacentChapter(direction), origin = this.scene.book.controller;
    if (target === undefined || origin?.chapter === undefined || !this.scene.chapter.mounted || this.scene.chapter.exiting) return '';
    if (!this.boundaryDragging) { this.scene.viewport().flushViewportObservation(); this.boundaryOrigin = this.scene.viewport().confirmedBoundaryOrigin(); }
    const confirmed = this.boundaryOrigin;
    if (confirmed === undefined || confirmed.controller !== origin || confirmed.manifest !== origin.chapter.manifest) return '';
    const generation = ++this.boundaryGeneration;
    this.boundaryTraceEvents = 0;
    const originManifest = origin.chapter.manifest;
    const sourceVersion = this.scene.book.remoteSession?.sourceVersion;
    const width = this.scene.viewport().viewportWidth, height = this.scene.viewport().viewportHeight;
    this.boundaryTargetTitle = target.displayTitle?.trim() || target.title.trim();
    this.state.boundaryBusy = true; this.state.boundaryFailure = ''; this.boundaryRetryDirection = direction;
    this.state.boundaryDirection = direction > 0 ? 'next' : 'previous';
    let candidate: MangaChapterTransitionCandidate | undefined;
    let presented = false;
    const current = (): boolean => this.scene.chapter.mounted && generation === this.boundaryGeneration && !this.scene.chapter.exiting && !this.scene.window.interactionBlocked &&
      this.scene.book.isReaderIdentityCurrent?.() !== false && !this.scene.window.windowChromeOverlayActive && this.scene.window.windowChromeActive &&
      this.scene.viewport().viewportWidth === width && this.scene.viewport().viewportHeight === height &&
      this.scene.book.remoteSession?.sourceVersion === sourceVersion &&
      (this.scene.book.remoteSession?.requiresContextRefresh !== true || this.scene.book.remoteSession?.acquisitionMode === 'offline') &&
      (this.scene.book.controller === origin || this.scene.book.controller === candidate?.controller) && origin.chapter?.manifest === originManifest;
    try {
      // Use the untouched pre-pull coordinate and allow save failure to abort
      // the transfer. A failed CAS never silently advances to another chapter.
      try { await origin.savePosition(confirmed.anchor.ordinal, confirmed.anchor.x ?? 0, confirmed.anchor.y); }
      catch (saveError) {
        const failure = saveError instanceof Error ? saveError : new Error('MANGA_PROGRESS_SAVE_FAILED');
        this.scene.actions.onSaveFailure(failure.message);
        throw failure;
      }
      if (!current()) throw new Error('MANGA_SESSION_CANCELLED');
      const saved = origin.savedLocation;
      if (saved !== null) MangaBookPresentation.admitConfirmedLocation(this.scene.book.sourceId, this.scene.book.bookId, saved,
        origin.chapter!, origin.totalPages, origin.pageAt(confirmed.anchor.ordinal));
      if (this.chapterTransitions === undefined) this.chapterTransitions = new MangaChapterTransitionCoordinator(this.scene.book.runtime);
      candidate = await this.chapterTransitions.prepare({ currentController: origin, chapterIndex: target.index,
        chapterUrl: target.url, landing: direction > 0 ? 'first' : 'last', offline: this.scene.book.offline,
        preview: this.scene.viewport().effectiveFit() === 'contain', isCurrent: current });
      if (!current()) throw new Error('MANGA_SESSION_CANCELLED');
      // Old display leases remain owned until the replacement receives native
      // image callbacks and a measured frame. No screenshot or full decode.
      this.state.previousChapterPixels = this.scene.viewport().captureChapterPixels();
      if (this.state.previousChapterPixels.length === 0) throw new Error('MANGA_POSITION_NOT_VISIBLE');
      await candidate.activate();
      if (!current()) throw new Error('MANGA_SESSION_CANCELLED');
      this.previousChapterController = origin;
      origin.onChange = undefined;
      this.pendingChapterTransition = candidate;
      this.traceBoundary('candidate-active');
      this.nativeTransitionImageReady = false; this.nativeTransitionImages.clear();
      const painted = new Promise<void>((resolve, reject): void => {
        this.nativeTransitionResolve = resolve; this.nativeTransitionReject = reject;
        this.nativeTransitionTimer = setTimeout((): void => reject(new Error('MANGA_CHAPTER_PRESENTATION_TIMEOUT')), 15000);
      });
      this.boundaryDragging = false;
      this.state.boundaryViewportFixed = true;
      this.boundaryPaintGeneration++;
      this.previousChapterZoom = this.scene.viewport().resetBoundaryZoom();
      this.scene.chapter.replaceController(candidate.controller);
      candidate.controller.onChange = (): void => { if (current()) this.scene.viewport().publish(); };
      this.scene.viewport().invalidateBoundaryManifest();
      this.previousChapterCommitted = this.scene.chapter.chapterCommitted;
      this.scene.chapter.setChapterCommitted(false);
      this.scene.viewport().landBoundaryPage(candidate.targetOrdinal, candidate.location.y, candidate.location.x);
      await painted;
      if (!current()) throw new Error('MANGA_SESSION_CANCELLED');
      candidate.confirmPresented(); presented = true;
      const admittedController = candidate.controller;
      admittedController.onChange = (): void => { if (this.scene.chapter.mounted && this.scene.book.controller === admittedController) this.scene.viewport().publish(); };
      this.pendingChapterTransition = undefined; this.state.previousChapterPixels = [];
      this.scene.chapter.setChapterCommitted(true);
      const chapter = candidate.controller.chapter!;
      this.scene.actions.onAdjacentChapterCommitted(chapter.chapterIndex, this.scene.viewport().displayChapterTitle(chapter.chapterIndex, chapter.chapterTitle));
      if (this.scene.book.remoteSession !== undefined) this.scene.chapter.configureAdjacentChapter(this.scene.book.remoteSession, candidate.controller);
      await this.scene.viewport().saveVisible();
      return '';
    } catch (error) {
      const message = error instanceof Error ? error.message : 'MANGA_CHAPTER_PREPARATION_FAILED';
      if (!presented) {
        if (this.scene.book.controller === candidate?.controller && this.scene.chapter.mounted) {
          this.restoreBoundaryOrigin(origin, confirmed);
        }
        // A cancelled, late save/prepare must never cancel a newer intention.
        try {
          if (candidate !== undefined) await candidate.cancel();
          else if (generation === this.boundaryGeneration) await this.chapterTransitions?.cancel();
        } catch (_) {
          hilog.warn(0x5244, 'Reader', 'Manga chapter candidate cleanup failed');
        }
      }
      if (this.scene.chapter.mounted && generation === this.boundaryGeneration && message !== 'MANGA_SESSION_CANCELLED') {
        this.state.boundaryFailure = '章节暂时打不开，请稍后再试。';
        try { this.transientFeedback.show(() => this.scene.window.getUIContext(), { message: this.state.boundaryFailure, duration: READER_FEEDBACK_BRIEF_MS }, (): boolean => this.scene.chapter.mounted && !this.scene.chapter.exiting && this.scene.window.windowChromeActive && this.scene.book.isReaderIdentityCurrent() && generation === this.boundaryGeneration); }
        catch (_error) { /* Feedback cannot interrupt rollback or resource cleanup. */ }
        hilog.warn(0x5244, 'Reader', 'Boundary chapter preparation failed: %{public}s', diagnosticCodeOf(message));
      }
      return '';
    } finally {
      // After presentation, origin leases must retire even if an external
      // chapter notification fails. Chapter close is identity-aware.
      if (presented) {
        try { await origin.close('chapter'); }
        catch (failure) {
          try { this.scene.actions.onSaveFailure(failure instanceof Error ? failure.message : 'MANGA_SESSION_CLOSE_FAILED'); }
          catch (_error) { /* A reporting callback cannot keep the gesture locked. */ }
        }
      }
      if (generation === this.boundaryGeneration) {
        this.clearBoundaryFrameWait(); this.pendingChapterTransition = undefined;
        this.previousChapterController = undefined;
        if (this.rollbackChapterController === undefined) this.state.previousChapterPixels = [];
        this.state.boundaryBusy = false; this.state.boundaryViewportFixed = false; this.boundaryDragging = false; this.boundaryOrigin = undefined;
        this.boundaryTargetTitle = '';
        this.state.boundaryReset++; this.state.boundaryDirection = ''; this.state.boundaryDistance = 0; this.state.boundaryArmed = false;
      }
    }
  }
  onChapterImageComplete(row: MangaStripRow, uri: string, renderKey: string,
    owner: MangaSessionController | undefined, manifest: MangaManifest | undefined): void {
    this.traceBoundary('image-decoded');
    if (this.rollbackChapterController !== undefined && owner === this.rollbackChapterController && owner === this.scene.book.controller &&
      manifest === owner.chapter?.manifest && this.scene.viewport().rowRenderKey(row) === renderKey && owner.tile(row.ordinal, row.tileIndex)?.image?.fileUri === uri) {
      this.rollbackChapterImages.add(renderKey);
      this.scene.window.getUIContext().postFrameCallback(new ReaderPostLayoutFrame(this.scene.window.getUIContext(), (): void => { this.scene.viewport().flushViewportObservation(); this.confirmBoundaryFrame(); }));
      return;
    }
    const candidate = this.pendingChapterTransition;
    if (candidate === undefined || this.scene.book.controller !== candidate.controller || owner !== this.scene.book.controller ||
      manifest !== this.scene.book.controller.chapter?.manifest ||
      this.scene.viewport().rowRenderKey(row) !== renderKey || this.scene.book.controller.tile(row.ordinal, row.tileIndex)?.image?.fileUri !== uri) return;
    this.nativeTransitionImages.add(renderKey);
    if (row.ordinal === candidate.targetOrdinal && row.tileIndex === candidate.landingTileIndex)
      this.nativeTransitionImageReady = true;
    this.scene.window.getUIContext().postFrameCallback(new ReaderPostLayoutFrame(this.scene.window.getUIContext(), (): void => {
      this.scene.viewport().flushViewportObservation(); this.confirmBoundaryFrame();
    }));
  }
  onChapterImageError(row: MangaStripRow, uri: string, renderKey: string,
    owner: MangaSessionController | undefined, manifest: MangaManifest | undefined): void {
    if (!this.scene.chapter.mounted || owner !== this.scene.book.controller || manifest !== this.scene.book.controller?.chapter?.manifest ||
      this.scene.viewport().rowRenderKey(row) !== renderKey || this.scene.book.controller?.tile(row.ordinal, row.tileIndex)?.image?.fileUri !== uri) return;
    const candidate = this.pendingChapterTransition;
    if (candidate !== undefined && row.ordinal === candidate.targetOrdinal && row.tileIndex === candidate.landingTileIndex) {
      this.nativeTransitionReject?.(new Error('MANGA_CHAPTER_NATIVE_IMAGE_FAILED'));
      return;
    }
    this.scene.viewport().reportNativeTileFailure(row, uri);
    if (candidate !== undefined || this.rollbackChapterController !== undefined)
      this.scene.window.getUIContext().postFrameCallback(new ReaderPostLayoutFrame(this.scene.window.getUIContext(), (): void => {
        this.scene.viewport().flushViewportObservation(); this.confirmBoundaryFrame();
      }));
  }
  confirmBoundaryFrame(): void {
    this.traceBoundary('paint-gate');
    const viewport = this.scene.viewport();
    const rollback = this.rollbackChapterController;
    if (rollback !== undefined) {
      if (!this.scene.chapter.mounted || this.scene.book.controller !== rollback ||
        !viewport.checkRestoredBoundaryFrame(rollback, (key: string): boolean => this.rollbackChapterImages.has(key))) return;
      this.clearRollbackPaint();
    }
    const candidate = this.pendingChapterTransition;
    if (candidate === undefined) return;
    const result = viewport.checkCandidateBoundaryFrame(candidate.controller, (key: string): boolean => this.nativeTransitionImages.has(key), candidate.landing, candidate.targetOrdinal, candidate.landingTileIndex);
    if (result === 'tile-budget') this.nativeTransitionReject?.(new Error('MANGA_TILE_WINDOW_BUDGET'));
    else if (result === 'image-required') this.nativeTransitionReject?.(new Error('MANGA_CANDIDATE_IMAGE_REQUIRED'));
    else if (result === 'painted' && this.nativeTransitionImageReady) this.nativeTransitionResolve?.();
  }
  traceBoundary(stage: string): void {
    if (!this.state.boundaryBusy || this.boundaryTraceEvents >= 48) return;
    this.boundaryTraceEvents++;
    try {
      const sample = this.scene.viewport().sampleBoundaryTrace();
      const candidate = this.pendingChapterTransition;
      hilog.info(0x5244, 'Reader', 'Manga edge stage=%{public}s gen=%{public}d applied=%{public}d restore=%{public}d target=%{public}d selected=%{public}d first=%{public}d last=%{public}d ordinal=%{public}d end=%{public}d images=%{public}d landingImage=%{public}d',
        stage, sample.generation, sample.applied, sample.restoring ? 1 : 0,
        candidate?.targetOrdinal ?? -1, this.scene.book.controller?.displayedOrdinal ?? -1, sample.first, sample.last, sample.ordinal, sample.end ? 1 : 0,
        this.nativeTransitionImages.size, this.nativeTransitionImageReady ? 1 : 0);
    } catch (_error) { /* Diagnostics cannot fail a chapter transfer. */ }
  }
  private clearBoundaryFrameWait(): void {
    if (this.nativeTransitionTimer >= 0) clearTimeout(this.nativeTransitionTimer);
    this.nativeTransitionTimer = -1; this.nativeTransitionResolve = undefined; this.nativeTransitionReject = undefined;
    this.nativeTransitionImageReady = false; this.nativeTransitionImages.clear();
  }
  private clearRollbackPaint(): void {
    if (this.rollbackFrameTimer >= 0) clearTimeout(this.rollbackFrameTimer);
    this.rollbackFrameTimer = -1;
    this.rollbackChapterController = undefined; this.rollbackChapterImages.clear();
    this.scene.viewport().clearBoundaryRestore();
    this.state.rollbackPainting = false; this.state.previousChapterPixels = [];
  }

  retireRollbackPaint(paintGeneration: number): void {
    if (this.rollbackChapterController === undefined || this.scene.book.controller !== this.rollbackChapterController ||
      this.boundaryPaintGeneration !== paintGeneration) return;
    this.scene.viewport().clearBoundaryRestore(paintGeneration);
    this.clearRollbackPaint();
  }

  private restoreBoundaryOrigin(origin: MangaSessionController, confirmed: MangaConfirmedPosition | undefined): void {
    const paintGeneration = ++this.boundaryPaintGeneration;
    const viewport = this.scene.viewport();
    this.scene.chapter.replaceController(origin);
    origin.onChange = this.scene.chapter.mounted ? (): void => viewport.publish() : undefined;
    this.scene.chapter.setChapterCommitted(this.previousChapterCommitted);
    viewport.restoreBoundaryZoom(this.previousChapterZoom);
    this.pendingChapterTransition = undefined; viewport.invalidateBoundaryManifest();
    this.boundaryDragging = false;
    viewport.stageBoundaryOrigin(confirmed);
    if (!this.scene.chapter.mounted) return;
    this.rollbackChapterController = origin; this.rollbackChapterImages.clear(); this.state.rollbackPainting = true;
    this.rollbackFrameTimer = setTimeout((): void => this.retireRollbackPaint(paintGeneration), 2500);
    viewport.paintBoundaryOrigin(confirmed, paintGeneration);
  }

  async cancelBoundaryChapter(): Promise<void> {
    const generation = ++this.boundaryGeneration;
    this.nativeTransitionReject?.(new Error('MANGA_SESSION_CANCELLED'));
    this.clearBoundaryFrameWait();
    const old = this.previousChapterController, confirmed = this.boundaryOrigin;
    if (old !== undefined && this.scene.book.controller === this.pendingChapterTransition?.controller)
      this.restoreBoundaryOrigin(old, confirmed);
    this.pendingChapterTransition = undefined; this.previousChapterController = undefined;
    if (!this.scene.chapter.mounted) this.clearRollbackPaint();
    if (this.rollbackChapterController === undefined) this.state.previousChapterPixels = [];
    this.state.boundaryBusy = false; this.state.boundaryViewportFixed = false; this.boundaryDragging = false;
    this.boundaryTargetTitle = '';
    this.boundaryOrigin = undefined; this.state.boundaryDirection = ''; this.state.boundaryDistance = 0; this.state.boundaryArmed = false;
    try { await this.chapterTransitions?.cancel(); }
    finally {
      if (this.scene.chapter.mounted && generation === this.boundaryGeneration) this.state.boundaryReset++;
    }
  }

  get hasRetainedPixels(): boolean { return this.state.previousChapterPixels.length > 0; }
  get fixedViewport(): boolean { return this.state.boundaryViewportFixed; }
  get busy(): boolean { return this.state.boundaryBusy; }
  get settlingPaint(): boolean { return this.pendingChapterTransition !== undefined || this.rollbackChapterController !== undefined; }
  get presentingCandidate(): boolean { return this.pendingChapterTransition !== undefined; }
  get holdingRollback(): boolean { return this.rollbackChapterController !== undefined; }
  get rollbackPainting(): boolean { return this.state.rollbackPainting; }
  get pullResetToken(): number { return this.state.boundaryReset; }
  get tilePaintGeneration(): number { return this.boundaryPaintGeneration; }

  catalogChapterIndex(active: MangaSessionController | undefined): number | undefined {
    return (this.pendingChapterTransition !== undefined ? this.previousChapterController : active)?.chapter?.chapterIndex;
  }

  heldOriginOrdinal(): number | undefined {
    return this.pendingChapterTransition !== undefined ? this.boundaryOrigin?.anchor.ordinal : undefined;
  }

  rejectPendingPaint(code: string): void {
    if (this.pendingChapterTransition !== undefined) this.nativeTransitionReject?.(new Error(code));
  }
  chapterEndLabel(): string {
    const title = this.scene.chapter.title.trim();
    const separator = title.indexOf(' · ');
    return separator > 0 ? title.slice(0, separator) : title || '本话';
  }
  adjacentLabel(): string {
    const entry = this.adjacentChapter(1);
    return entry?.displayTitle?.trim() || entry?.title.trim() || '';
  }
  boundaryCaption(): string {
    if (this.state.boundaryBusy) return this.boundaryTargetTitle.length > 0 ? `正在进入：${this.boundaryTargetTitle}` : '正在进入下一话…';
    const next = this.adjacentLabel();
    if (next.length > 0) return `${this.state.boundaryArmed ? '松手进入' : '继续上拉进入'}下一话：${next}`;
    return this.finalBoundaryConfirmed() ? '已读至最新一话 · 返回继续' : '暂无下一话';
  }
}

interface MangaBoundaryHintInput {
  readonly host: MangaChapterBoundaryHost;
}

@Builder
export function MangaBoundaryHint($$: MangaBoundaryHintInput) {
    MangaBoundaryTurnFeedback({
      caption: $$.host.boundaryCaption(), scheme: $$.host.scene.controls().chromeScheme(), distance: $$.host.state.boundaryDistance,
      busy: $$.host.state.boundaryBusy, armed: $$.host.state.boundaryArmed, reduceMotion: $$.host.scene.window.reduceMotion,
    });
  }

interface MangaRetainedChapterPixelsInput {
  readonly host: MangaChapterBoundaryHost;
}

@Builder
export function MangaRetainedChapterPixels($$: MangaRetainedChapterPixelsInput) {
    Stack({ alignContent: Alignment.TopStart }) {
      ForEach($$.host.state.previousChapterPixels, (pixel: MangaRetainedPixel) => {
        Image(pixel.uri).width(pixel.width).height(pixel.height).objectFit(ImageFit.Fill)
          .position({ x: pixel.x, y: pixel.y }).draggable(false);
      }, (pixel: MangaRetainedPixel): string => pixel.key);
    }.width('100%').height('100%').backgroundColor($$.host.scene.controls().paperColor()).clip(true).zIndex(0)
      .hitTestBehavior(HitTestMode.None);
  }
