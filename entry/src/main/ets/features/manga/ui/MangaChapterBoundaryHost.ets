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
import type { MangaReadingScene } from './MangaReadingSurface';
import type { MangaConfirmedPosition } from './MangaReadingViewportHost';
import { ReaderPostLayoutFrame } from '../../../ui/layout/ReaderPostLayoutFrame';

export interface MangaRetainedPixel { key: string; uri: string; x: number; y: number; width: number; height: number; }
@Observed
export class MangaBoundaryRenderState {
  @Track boundaryDirection: PullDirection = '';
  @Track boundaryDistance: number = 0;
  @Track boundaryArmed: boolean = false;
  @Track boundaryBusy: boolean = false;
  @Track boundaryFailure: string = '';
  @Track boundaryReset: number = 0;
  @Track previousChapterPixels: MangaRetainedPixel[] = [];
  @Track rollbackPainting: boolean = false;
}

/** Held-pull input, candidate and rollback paint proofs, and chapter commit admission. */
export class MangaChapterBoundaryHost {
  private readonly transientFeedback: ReaderTransientFeedback;
  readonly scene: MangaReadingScene;
  private readonly readState: () => MangaBoundaryRenderState;

  constructor(scene: MangaReadingScene, readState: () => MangaBoundaryRenderState, transientFeedback: ReaderTransientFeedback) {
    this.scene = scene;
    this.readState = readState;
    this.transientFeedback = transientFeedback;
  }

  get state(): MangaBoundaryRenderState { return this.readState(); }

  private boundaryInputRevision: number = -1;
  boundaryDragging: boolean = false;
  boundaryOrigin: MangaConfirmedPosition | undefined;
  private boundaryGeneration: number = 0;
  private chapterTransitions: MangaChapterTransitionCoordinator | undefined;
  pendingChapterTransition: MangaChapterTransitionCandidate | undefined;
  previousChapterController: MangaSessionController | undefined;
  private nativeTransitionImageReady: boolean = false;
  private nativeTransitionResolve: (() => void) | undefined;
  nativeTransitionReject: ((error: Error) => void) | undefined;
  private nativeTransitionTimer: number = -1;
  private boundaryRetryDirection: number = 1;
  private boundaryHapticSent: boolean = false;
  private nativeTransitionImages: Set<string> = new Set();
  rollbackChapterController: MangaSessionController | undefined;
  rollbackChapterImages: Set<string> = new Set();
  boundaryPaintGeneration: number = 0;
  private boundaryTraceEvents: number = 0;
  releaseMount(): void {
    if (this.state.boundaryBusy || this.boundaryDragging || this.chapterTransitions?.pending === true)
      void this.cancelBoundaryChapter().catch((): void => {});
    this.rollbackChapterController = undefined; this.rollbackChapterImages.clear();
    this.state.rollbackPainting = false; this.state.previousChapterPixels = [];
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
    if (!this.scene.chrome().readerPanelForeground() || !this.boundaryDragging || !this.state.boundaryArmed ||
      this.boundaryInputRevision !== this.scene.chapter.pageTurnInputRevision) return '';
    if (this.adjacentChapter(1) !== undefined) return this.turnBoundaryChapter(1);
    await this.openChapterEnd(true);
    return '';
  }
  resumeFromChapterEnd(): void {
    if (!this.scene.chapter.chapterEnd || !this.scene.chrome().readerPanelForeground() || this.scene.window.panel.length > 0) return;
    this.scene.chapter.chapterEnd = false;
    this.scene.window.controlsVisible = true;
  }
  async openChapterEnd(fromVerticalBoundary: boolean = false): Promise<void> {
    const inputRevision = this.scene.chapter.pageTurnInputRevision;
    const canOpen = (): boolean => {
      const ordinal = this.scene.viewport().pageOrdinal();
      const confirmed = this.scene.viewport().confirmedPosition;
      if (!this.scene.chapter.opened || !this.scene.chrome().readerPanelForeground() || inputRevision !== this.scene.chapter.pageTurnInputRevision ||
        this.scene.viewport().state.restoringAnchor || confirmed === undefined || confirmed.controller !== this.scene.book.controller ||
        confirmed.manifest !== this.scene.book.controller?.chapter?.manifest ||
        confirmed.identity !== this.scene.viewport().positionIdentity(confirmed.anchor.ordinal)) return false;
      if (fromVerticalBoundary) return this.scene.viewport().verticalTailVisible() && this.finalBoundaryConfirmed();
      return ordinal + 1 === this.scene.viewport().state.horizontalPageCount &&
        (confirmed.anchor.ordinal === ordinal || this.scene.viewport().verticalTailVisible());
    };
    if (!canOpen()) return;
    await this.scene.chrome().performPanelAction((): void => { if (canOpen()) this.scene.chapter.chapterEnd = true; });
  }
  async selectAdjacentChapter(direction: number, fromDirectory: boolean = false): Promise<void> {
    if (this.adjacentChapter(direction) === undefined) return;
    await this.scene.chrome().performPanelAction(async (): Promise<void> => {
      if (fromDirectory && !this.scene.chrome().readerPanelForeground()) return;
      this.scene.chapter.chapterEnd = false;
      await this.turnBoundaryChapter(direction);
    });
  }
  boundaryEnabled(): boolean {
    return this.scene.chapter.mounted && this.scene.chapter.opened && !this.scene.viewport().state.horizontal && this.scene.viewport().state.zoom === 1 && !this.scene.chapter.recovering && !this.scene.chapter.exiting &&
      this.scene.window.panel.length === 0 && this.scene.chrome().state.panelPhase === 'closed' && !this.scene.chapter.chapterEnd && this.scene.window.windowChromeActive &&
      this.scene.chrome().readerPanelForeground() && !this.scene.viewport().state.restoringAnchor && !this.scene.chapter.loginRequiredForControls &&
      this.scene.chapter.error.length === 0 && !this.state.boundaryBusy && !this.state.rollbackPainting && this.pendingChapterTransition === undefined && this.rollbackChapterController === undefined;
  }
  onBoundaryPull(direction: PullDirection, distance: number, armed: boolean): void {
    if (!this.scene.chrome().readerPanelForeground() || this.boundaryInputRevision !== this.scene.chapter.pageTurnInputRevision) return;
    if (armed && !this.boundaryHapticSent && !this.scene.window.reduceMotion) {
      this.boundaryHapticSent = true;
      try { void vibrator.startVibration({ type: 'time', duration: 10 }, { usage: 'touch' }).catch((): void => {}); }
      catch (_error) { /* Unsupported motors never own navigation. */ }
    }
    this.state.boundaryDirection = direction; this.state.boundaryDistance = distance; this.state.boundaryArmed = armed;
  }
  onBoundaryActivity(active: boolean): void {
    if (active && !this.scene.chrome().readerPanelForeground()) return;
    if (active && !this.boundaryDragging) {
      this.scene.viewport().clearPageSliderPreview();
      this.boundaryInputRevision = this.scene.chapter.pageTurnInputRevision;
      this.boundaryHapticSent = false;
      this.scene.viewport().flushViewportObservation();
      this.boundaryOrigin = this.scene.viewport().confirmedPosition;
    }
    this.boundaryDragging = active;
    if (!active && !this.state.boundaryBusy) {
      this.boundaryOrigin = undefined;
      this.scene.viewport().queueViewportObservation();
    }
  }
  async turnBoundaryChapter(direction: number): Promise<string> {
    if (!this.scene.chrome().readerPanelForeground() || (this.boundaryDragging && this.boundaryInputRevision !== this.scene.chapter.pageTurnInputRevision) ||
      this.state.boundaryBusy || this.rollbackChapterController !== undefined ||
      this.scene.book.runtime === undefined || this.chapterTransitions?.pending === true) return '';
    const target = this.adjacentChapter(direction), origin = this.scene.book.controller;
    if (target === undefined || origin?.chapter === undefined || !this.scene.chapter.mounted || this.scene.chapter.exiting) return '';
    if (!this.boundaryDragging) { this.scene.viewport().flushViewportObservation(); this.boundaryOrigin = this.scene.viewport().confirmedPosition; }
    const confirmed = this.boundaryOrigin;
    if (confirmed === undefined || confirmed.controller !== origin || confirmed.manifest !== origin.chapter.manifest) return '';
    const generation = ++this.boundaryGeneration;
    this.boundaryTraceEvents = 0;
    const originManifest = origin.chapter.manifest;
    const sourceVersion = this.scene.book.remoteSession?.sourceVersion;
    const width = this.scene.viewport().state.viewportWidth, height = this.scene.viewport().state.viewportHeight;
    this.state.boundaryBusy = true; this.state.boundaryFailure = ''; this.boundaryRetryDirection = direction;
    this.state.boundaryDirection = direction > 0 ? 'next' : 'previous';
    let candidate: MangaChapterTransitionCandidate | undefined;
    let presented = false;
    const current = (): boolean => this.scene.chapter.mounted && generation === this.boundaryGeneration && !this.scene.chapter.exiting && !this.scene.window.interactionBlocked &&
      this.scene.book.isReaderIdentityCurrent?.() !== false && !this.scene.window.windowChromeOverlayActive && this.scene.window.windowChromeActive &&
      this.scene.viewport().state.viewportWidth === width && this.scene.viewport().state.viewportHeight === height &&
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
      this.state.boundaryReset++;
      this.boundaryPaintGeneration++;
      this.scene.book.controller = candidate.controller;
      candidate.controller.onChange = (): void => { if (current()) this.scene.viewport().publish(); };
      this.scene.viewport().publishedManifestVersion = ''; this.scene.chapter.chapterCommitted = false;
      this.scene.viewport().confirmedPosition = undefined; this.scene.viewport().visibleAnchor = undefined;
      this.scene.viewport().state.horizontalPage = candidate.targetOrdinal;
      this.scene.viewport().publish(); this.scene.viewport().restore(candidate.targetOrdinal, candidate.location.y, candidate.location.x);
      await painted;
      if (!current()) throw new Error('MANGA_SESSION_CANCELLED');
      candidate.confirmPresented(); presented = true;
      const admittedController = candidate.controller;
      admittedController.onChange = (): void => { if (this.scene.chapter.mounted && this.scene.book.controller === admittedController) this.scene.viewport().publish(); };
      this.pendingChapterTransition = undefined; this.state.previousChapterPixels = [];
      this.scene.chapter.chapterCommitted = true;
      const chapter = candidate.controller.chapter!;
      this.scene.actions.onAdjacentChapterCommitted(chapter.chapterIndex, this.scene.viewport().displayChapterTitle(chapter.chapterIndex, chapter.chapterTitle));
      if (this.scene.book.remoteSession !== undefined) this.scene.chapter.configureAdjacentChapter(this.scene.book.remoteSession, candidate.controller);
      await this.scene.viewport().saveVisible();
      return '';
    } catch (error) {
      const message = error instanceof Error ? error.message : 'MANGA_CHAPTER_PREPARATION_FAILED';
      if (!presented) {
        if (this.scene.book.controller === candidate?.controller && this.scene.chapter.mounted) {
          this.rollbackChapterController = origin; this.rollbackChapterImages.clear(); this.state.rollbackPainting = true;
          this.boundaryPaintGeneration++;
          this.scene.book.controller = origin; origin.onChange = (): void => this.scene.viewport().publish();
          this.pendingChapterTransition = undefined; this.scene.viewport().publishedManifestVersion = '';
          this.scene.viewport().visibleAnchor = confirmed.anchor; this.scene.viewport().confirmedPosition = confirmed;
          this.scene.viewport().publish(); this.scene.viewport().restore(confirmed.anchor.ordinal, confirmed.anchor.y, confirmed.anchor.x ?? 0);
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
        this.state.boundaryBusy = false; this.boundaryDragging = false; this.boundaryOrigin = undefined;
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
  onChapterImageError(row: MangaStripRow, uri: string,
    owner: MangaSessionController | undefined, manifest: MangaManifest | undefined): void {
    if (this.pendingChapterTransition !== undefined && owner === this.scene.book.controller && manifest === this.scene.book.controller?.chapter?.manifest &&
      this.scene.book.controller?.tile(row.ordinal, row.tileIndex)?.image?.fileUri === uri)
      this.nativeTransitionReject?.(new Error('MANGA_CHAPTER_NATIVE_IMAGE_FAILED'));
    else if (this.scene.chapter.mounted && owner === this.scene.book.controller && manifest === this.scene.book.controller?.chapter?.manifest &&
      this.scene.book.controller?.tile(row.ordinal, row.tileIndex)?.image?.fileUri === uri) {
      this.scene.viewport().nativeImageFailures.add(this.scene.viewport().nativeFailureKey(row, uri));
      this.scene.viewport().data.notify(false, this.scene.viewport().first, this.scene.viewport().requestedLast());
    }
  }
  confirmBoundaryFrame(): void {
    this.traceBoundary('paint-gate');
    const viewport = this.scene.viewport();
    const rollback = this.rollbackChapterController;
    if (rollback !== undefined) {
      if (!this.scene.chapter.mounted || this.scene.book.controller !== rollback || viewport.state.restoringAnchor ||
        viewport.confirmedPosition?.controller !== rollback || viewport.confirmedPosition.manifest !== rollback.chapter?.manifest) return;
      try {
        if (!viewport.measureVisibleWindow() || !Number.isSafeInteger(viewport.first) || !Number.isSafeInteger(viewport.last) ||
          viewport.first < 0 || viewport.last < viewport.first || viewport.last >= viewport.data.totalCount() || viewport.last - viewport.first > 7) return;
        for (let index = viewport.first; index <= viewport.last; index++) {
          const row = viewport.data.getData(index), rect = viewport.scroller.getItemRect(index);
          if (!Number.isFinite(rect.y) || !Number.isFinite(rect.height) || !Number.isFinite(rect.width) || rect.width <= 0 || rect.height <= 0) return;
          if (rect.y >= viewport.state.viewportHeight || rect.y + rect.height <= 0) continue;
          if (rollback.tile(row.ordinal, row.tileIndex)?.image === undefined || !this.rollbackChapterImages.has(viewport.rowRenderKey(row))) return;
        }
      } catch (_error) { return; }
      this.rollbackChapterController = undefined; this.rollbackChapterImages.clear(); this.state.rollbackPainting = false; this.state.previousChapterPixels = [];
    }
    const candidate = this.pendingChapterTransition;
    if (candidate === undefined || !this.nativeTransitionImageReady || viewport.state.restoringAnchor ||
      viewport.confirmedPosition?.controller !== candidate.controller || viewport.confirmedPosition.manifest !== candidate.controller.chapter?.manifest) return;
    try {
      if (!viewport.measureVisibleWindow() || !Number.isSafeInteger(viewport.first) || !Number.isSafeInteger(viewport.last) ||
        viewport.first < 0 || viewport.last < viewport.first || viewport.last >= viewport.data.totalCount()) return;
      if (viewport.last - viewport.first > 7) { this.nativeTransitionReject?.(new Error('MANGA_TILE_WINDOW_BUDGET')); return; }
      // At a chapter tail, native bottom clamping may expose earlier short
      // pages at the viewport top. Its measured anchor remains authoritative.
      if (candidate.landing === 'last' ? !viewport.scroller.isAtEnd() : viewport.confirmedPosition.anchor.ordinal !== candidate.targetOrdinal) return;
      // The controller may prepare last + 1, but that offscreen neighbour has
      // no valid native rectangle and does not participate in this paint gate.
      for (let index = viewport.first; index <= viewport.last; index++) {
        const row = viewport.data.getData(index);
        const rect = viewport.scroller.getItemRect(index);
        if (!Number.isFinite(rect.y) || !Number.isFinite(rect.height) || !Number.isFinite(rect.width) || rect.width <= 0 || rect.height <= 0) return;
        if (rect.y >= viewport.state.viewportHeight || rect.y + rect.height <= 0) continue;
        if (viewport.rowHasError(row)) { this.nativeTransitionReject?.(new Error('MANGA_CANDIDATE_IMAGE_REQUIRED')); return; }
        if (candidate.controller.tile(row.ordinal, row.tileIndex)?.image === undefined || !this.nativeTransitionImages.has(viewport.rowRenderKey(row))) return;
      }
    } catch (_error) { return; /* Wait for an actual mounted replacement frame. */ }
    this.nativeTransitionResolve?.();
  }
  traceBoundary(stage: string): void {
    if (!this.state.boundaryBusy || this.boundaryTraceEvents >= 48) return;
    this.boundaryTraceEvents++;
    let first = -1, last = -1, ordinal = -1, end = false;
    try {
      first = this.scene.viewport().scroller.getItemIndex(0.5, 0.5);
      last = this.scene.viewport().scroller.getItemIndex(0.5, this.scene.viewport().state.viewportHeight - 0.5);
      end = this.scene.viewport().scroller.isAtEnd();
      if (Number.isSafeInteger(first) && first >= 0 && first < this.scene.viewport().data.totalCount()) ordinal = this.scene.viewport().data.getData(first).ordinal;
    } catch (_error) { /* An unmounted native window is evidence, not admission. */ }
    const candidate = this.pendingChapterTransition;
    try {
      hilog.info(0x5244, 'Reader', 'Manga edge stage=%{public}s gen=%{public}d applied=%{public}d restore=%{public}d target=%{public}d selected=%{public}d first=%{public}d last=%{public}d ordinal=%{public}d end=%{public}d images=%{public}d landingImage=%{public}d',
        stage, this.scene.viewport().layoutGeneration, this.scene.viewport().appliedLayoutGeneration, this.scene.viewport().state.restoringAnchor ? 1 : 0,
        candidate?.targetOrdinal ?? -1, this.scene.book.controller?.displayedOrdinal ?? -1, first, last, ordinal, end ? 1 : 0,
        this.nativeTransitionImages.size, this.nativeTransitionImageReady ? 1 : 0);
    } catch (_error) { /* Diagnostics cannot fail a chapter transfer. */ }
  }
  private clearBoundaryFrameWait(): void {
    if (this.nativeTransitionTimer >= 0) clearTimeout(this.nativeTransitionTimer);
    this.nativeTransitionTimer = -1; this.nativeTransitionResolve = undefined; this.nativeTransitionReject = undefined;
    this.nativeTransitionImageReady = false; this.nativeTransitionImages.clear();
  }
  async cancelBoundaryChapter(): Promise<void> {
    this.boundaryGeneration++; this.state.boundaryReset++;
    this.nativeTransitionReject?.(new Error('MANGA_SESSION_CANCELLED'));
    this.clearBoundaryFrameWait();
    const old = this.previousChapterController, confirmed = this.boundaryOrigin;
    if (old !== undefined && this.scene.book.controller === this.pendingChapterTransition?.controller) {
      if (this.scene.chapter.mounted) { this.rollbackChapterController = old; this.rollbackChapterImages.clear(); this.state.rollbackPainting = true; }
      this.boundaryPaintGeneration++;
      this.scene.book.controller = old; old.onChange = this.scene.chapter.mounted ? (): void => this.scene.viewport().publish() : undefined;
      this.pendingChapterTransition = undefined; this.scene.viewport().publishedManifestVersion = '';
      this.boundaryDragging = false; this.scene.viewport().visibleAnchor = confirmed?.anchor;
      if (this.scene.chapter.mounted) {
        this.scene.viewport().publish();
        if (confirmed !== undefined) this.scene.viewport().restore(confirmed.anchor.ordinal, confirmed.anchor.y, confirmed.anchor.x ?? 0);
      }
    }
    this.pendingChapterTransition = undefined; this.previousChapterController = undefined;
    if (!this.scene.chapter.mounted) { this.rollbackChapterController = undefined; this.rollbackChapterImages.clear(); this.state.rollbackPainting = false; }
    if (this.rollbackChapterController === undefined) this.state.previousChapterPixels = [];
    this.state.boundaryBusy = false; this.boundaryDragging = false;
    this.boundaryOrigin = undefined; this.state.boundaryDirection = ''; this.state.boundaryDistance = 0; this.state.boundaryArmed = false;
    await this.chapterTransitions?.cancel();
    if (this.scene.chapter.mounted) this.state.boundaryReset++;
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
    const next = this.adjacentLabel();
    if (this.state.boundaryBusy) return next.length > 0 ? `正在进入：${next}` : '正在进入下一话…';
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
      caption: $$.host.boundaryCaption(), scheme: $$.host.scene.chrome().chromeScheme(), distance: $$.host.state.boundaryDistance,
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
    }.width('100%').height('100%').backgroundColor($$.host.scene.chrome().paperColor()).clip(true).zIndex(0)
      .hitTestBehavior(HitTestMode.None);
  }
