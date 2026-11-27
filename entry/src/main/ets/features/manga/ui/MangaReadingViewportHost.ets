import { readerHardwareKeyboardShortcut } from '../../../platform/interaction/ReaderHardwareKeyboard';
import { ReaderNativeAlertWindow } from '../../../ui/platform/ReaderNativeAlertWindow';
import { READER_SMART_GESTURE_VIEWPORT_FRACTION, readerSmartGestureAction, type ReaderSmartGesture, type ReaderSmartGestureAction } from '../../reading/application/ReaderSmartGesturePolicy';
import { readerControlKeyboardVisible } from '../../../ui/foundation/ReaderKeyboardBack';
import { ReaderPostLayoutFrame } from '../../../ui/layout/ReaderPostLayoutFrame';
import { LengthMetrics } from '@kit.ArkUI';
import hilog from '@ohos.hilog';
import { ReaderWindowCoordinator } from '../../../app/ReaderWindowCoordinator';
import type { MangaManifest } from '../application/MangaContract';
import { MangaSessionController, MangaTileRequest } from '../application/MangaSessionController';
import { PullToRefresh, PullDirection } from '../vendor/pulltorefresh/PullToRefresh';
import { PhotoViewScaleModel } from '../vendor/photoview/PhotoViewScaleModel';
import { MangaStripProjection, MangaStripRow } from './MangaStripProjection';
import { MangaBookPresentation } from '../presentation/MangaBookPresentation';
import { readerMotionStandardCurve } from '../../../ui/foundation/MotionSpec';
import { readerMotionDurationMs } from '../../../ui/foundation/ReaderMotionPolicy';
import { readerPaperPullOffset } from '../../reading/presentation/ReaderPaperPullMotion';
import type { MangaRetainedPixel } from './MangaChapterBoundaryHost';
import type { ReaderSettingsGateway } from '../../reading/application/ReaderSettingsGateway';
import type { ReaderSmartGestureSettings } from '../../reading/application/ReaderSmartGesturePolicy';
import type { RemoteReadingTocEntry } from '../../reading/application/RemoteReadingFlowGateway';
import type { MangaDirectoryPosition } from './MangaDirectoryDrawer';
import type { MangaChromeReaderControls } from './MangaReaderChrome';
import type { MangaBoundaryViewportPort } from './MangaChapterBoundaryHost';

export type MangaBoundaryPaintResult = 'waiting' | 'painted' | 'tile-budget' | 'image-required';
export interface MangaBoundaryLayoutSample {
  readonly first: number;
  readonly last: number;
  ordinal: number;
  end: boolean;
  generation: number;
  applied: number;
  restoring: boolean;
}

export interface MangaViewportAnchor { readonly ordinal: number; readonly y: number; readonly x?: number; }
export interface MangaConfirmedPosition { readonly controller: MangaSessionController; readonly manifest: MangaManifest; readonly identity: string; readonly anchor: MangaViewportAnchor; }
interface MangaNativeImageCompletion { loadingStatus: number; }
class MangaLayoutFrame extends ReaderPostLayoutFrame {}
class MangaStripDataSource implements IDataSource {
  readonly projection: MangaStripProjection = new MangaStripProjection();
  private listeners: DataChangeListener[] = [];
  totalCount(): number { return this.projection.totalCount(); }
  getData(index: number): MangaStripRow { return this.projection.row(index); }
  registerDataChangeListener(listener: DataChangeListener): void { this.listeners.push(listener); }
  unregisterDataChangeListener(listener: DataChangeListener): void {
    this.listeners = this.listeners.filter((item: DataChangeListener): boolean => item !== listener);
  }
  notify(structure: boolean, first: number, last: number): void {
    for (const listener of this.listeners) {
      if (structure) listener.onDataReloaded();
      else for (let index = first; index <= Math.min(last, this.totalCount() - 1); index++) listener.onDataChange(index);
    }
  }
}
@Observed
export class MangaViewportRenderState {
  @Track zoom: number = 1;
  @Track horizontal: boolean = false;
  @Track horizontalPage: number = 0;
  @Track horizontalPageCount: number = 0;
  @Track viewportWidth: number = 1;
  @Track viewportHeight: number = 1;
  @Track fitPreference: 'source' | 'width' | 'contain' = 'source';
  @Track restoringAnchor: boolean = false;
  @Track displayedPage: number = 0;
  @Track pageSliderPreview: number = -1;
}

export interface MangaViewportBook {
  readonly sourceId: string;
  readonly bookId: string;
  readonly controller: MangaSessionController | undefined;
  readonly isReaderIdentityCurrent: () => boolean;
  readonly settingsGateway: ReaderSettingsGateway | undefined;
}

export interface MangaViewportWindow {
  readonly getUIContext: () => UIContext;
  readonly backgroundPreference: 'paper' | 'white' | 'ink';
  readonly controlsVisible: boolean;
  readonly panel: string;
  readonly reduceMotion: boolean;
  readonly windowChromeOverlayActive: boolean;
  readonly smartGestureSettings: ReaderSmartGestureSettings;
  readonly onWindowChromeChanged: () => void;
}

export interface MangaViewportChapter {
  readonly setTitle: (value: string) => void;
  readonly setRecovering: (value: boolean) => void;
  readonly reportError: (value: string) => void;
  readonly setChapterCommitted: (value: boolean) => void;
  readonly mounted: boolean;
  readonly exiting: boolean;
  readonly chapterCommitted: boolean;
  readonly chapterEnd: boolean;
  readonly error: string;
  readonly loginRequiredForControls: boolean;
  readonly opened: boolean;
  readonly presentationGeneration: number;
  readonly advancePresentation: () => number;
  readonly pageTurnInputRevision: number;
  readonly recovering: boolean;
  readonly refreshing: boolean;
  readonly notifyPreparationFailure: () => void;
  readonly refreshLoginRequiredForControls: () => void;
}

export interface MangaViewportActions {
  readonly handleBack: (intent?: 'navigation') => Promise<void>;
  readonly onChapterCommitted: (index: number, title: string) => void;
  readonly onSaveFailure: (message: string) => void;
}

export interface MangaViewportNativeSlots {
  readonly viewportImages: () => void;
  readonly boundaryHint: () => void;
}

export interface MangaViewportChromeInput {
  phonePanelBackgroundEnabled(): boolean;
  readerPanelForeground(): boolean;
  readonly phase: string;
  toggleControls(): void;
  lineColor(scheme?: 'day' | 'night'): string;
  mutedColor(scheme?: 'day' | 'night'): string;
}

export interface MangaViewportDirectory {
  openDirectory(focusSearch?: boolean): Promise<void>;
}

export interface MangaViewportBoundaryAdmission {
  readonly boundaryDragging: boolean;
  readonly busy: boolean;
  cancelBoundaryChapter(): Promise<void>;
  traceBoundary(stage: string): void;
  readonly settlingPaint: boolean;
  confirmBoundaryFrame(): void;
  readonly presentingCandidate: boolean;
  rejectPendingPaint(code: string): void;
  readonly tilePaintGeneration: number;
  readonly rollbackPainting: boolean;
  readonly holdingRollback: boolean;
  heldOriginOrdinal(): number | undefined;
  openChapterEnd(fromVerticalBoundary?: boolean): Promise<void>;
  boundaryEnabled(): boolean;
  adjacentChapter(direction: number): RemoteReadingTocEntry | undefined;
  finalBoundaryConfirmed(): boolean;
  readonly pullResetToken: number;
  onBoundaryPull(direction: PullDirection, distance: number, armed: boolean): void;
  onBoundaryActivity(active: boolean): void;
  turnBoundaryChapter(direction: number): Promise<string>;
  releaseNextBoundary(): Promise<string>;
  onChapterImageComplete(row: MangaStripRow, uri: string, renderKey: string, owner: MangaSessionController | undefined, manifest: MangaManifest | undefined): void;
  onChapterImageError(row: MangaStripRow, uri: string, owner: MangaSessionController | undefined, manifest: MangaManifest | undefined): void;
}

export interface MangaViewportMount {
  readonly book: MangaViewportBook;
  readonly window: MangaViewportWindow;
  readonly chapter: MangaViewportChapter;
  readonly actions: MangaViewportActions;
  readonly slots: MangaViewportNativeSlots;
  readonly input: () => MangaViewportChromeInput;
  readonly directory: () => MangaViewportDirectory;
  readonly admission: () => MangaViewportBoundaryAdmission;
}

/** Native scrollers, measured rows, restore admission and durable visible position. */
export class MangaReadingViewportHost implements MangaDirectoryPosition, MangaChromeReaderControls, MangaBoundaryViewportPort {
  readonly scene: MangaViewportMount;
  private readonly readState: () => MangaViewportRenderState;

  constructor(scene: MangaViewportMount, readState: () => MangaViewportRenderState) {
    this.scene = scene;
    this.readState = readState;
  }

  get state(): MangaViewportRenderState { return this.readState(); }

  private nativeImageFailures: Set<string> = new Set<string>();
  readonly data: MangaStripDataSource = new MangaStripDataSource();
  readonly scroller: ListScroller = new ListScroller();
  readonly horizontalScroller: Scroller = new Scroller();
  private readonly scalePolicy: PhotoViewScaleModel = new PhotoViewScaleModel();
  private pinchStartScale: number = 1;
  private pinchAnchor: MangaViewportAnchor | undefined;
  private first: number = 0;
  private last: number = 0;
  private viewportRangeObserved: boolean = false;
  private viewportObservationPending: boolean = false;
  private viewportObservationGeneration: number = 0;
  private readonly publishedRowKeys: Map<number, string> = new Map<number, string>();
  private layoutGeneration: number = 0;
  private viewportGeneration: number = 0;
  private viewportInputRevision: number = -1;
  private visibleAnchor: MangaViewportAnchor | undefined;
  private confirmedPosition: MangaConfirmedPosition | undefined;
  private appliedLayoutGeneration: number = -1;
  private publishedManifestVersion: string = '';
  pendingRestoreAnchor: MangaViewportAnchor | undefined;
  pendingTurnOrdinal: number | undefined;
  mountedTurnRowKey: string = '';
  private pageSliderGeneration: number = 0;
  pageSliderCommitted: number = -1;
  private seekingPage: number | undefined;
  private clampedSeekPage: number | undefined;
  private positionTraceEvents: number = 0;

  loadInitialPreferences(): void {
    this.state.horizontal = this.scene.book.settingsGateway?.current()?.mangaDirection === 'horizontal';
    this.state.fitPreference = this.scene.book.settingsGateway?.current()?.mangaFit ?? 'source';
  }

  invalidateLayout(): void {
    this.layoutGeneration++; this.viewportGeneration++;
  }

  prepareEntryOrientation(ordinal: number, manifest: MangaManifest): boolean {
    this.state.horizontalPage = ordinal;
    return this.state.fitPreference === 'contain' || (this.state.fitPreference === 'source' && manifest.displayHints?.fit === 'contain');
  }

  publishOpenedHorizontalPosition(controller: MangaSessionController, ordinal: number): void {
    if (!this.state.horizontal) return;
    this.state.horizontalPage = ordinal;
    this.data.projection.publish(controller.chapter!.manifest, (index: number) => controller.pageGeometry(index),
      ordinal, controller.totalPages, (pageOrdinal: number) => controller.pageAt(pageOrdinal));
    this.scene.chapter.refreshLoginRequiredForControls();
    this.data.notify(true, 0, 0);
  }

  visibleRow(): MangaStripRow | undefined {
    return this.data.totalCount() > this.first ? this.data.getData(this.first) : undefined;
  }

  visibleRowIndex(): number { return this.first; }

  matchesVisibleRow(index: number, row: MangaStripRow, retryDispatched: boolean): boolean {
    if (this.first !== index || this.data.totalCount() <= index) return false;
    const visible = this.data.getData(index);
    if (visible.ordinal !== row.ordinal || visible.tileIndex !== row.tileIndex) return false;
    // A successful page retry may materialize its own placeholder geometry.
    if (retryDispatched && !row.known && visible.known) return true;
    return visible.key === row.key && visible.known === row.known;
  }

  hasWindowImageError(error: string): boolean {
    for (let index = Math.max(0, this.first); index <= this.requestedLast(); index++) {
      const row = this.data.getData(index);
      if (this.rowHasError(row) && this.imageError(row) === error) return true;
    }
    return false;
  }

  clearMountedTurn(): void {
    this.pendingTurnOrdinal = undefined; this.mountedTurnRowKey = '';
  }

  restoreRefreshedPosition(ordinal: number, y: number, x: number): void {
    this.state.horizontalPage = ordinal;
    this.visibleAnchor = undefined;
    this.publish();
    this.restore(ordinal, y, x);
  }

  resetReopeningChapter(): void {
    this.viewportGeneration++;
    this.first = 0; this.last = 0; this.viewportRangeObserved = false;
    this.visibleAnchor = undefined; this.confirmedPosition = undefined;
    this.publishedManifestVersion = ''; this.publishedRowKeys.clear();
  }

  restoreReplacedChapter(): void {
    this.visibleAnchor = undefined; this.publish(); this.restore(0, 0, 0);
  }

  get zoomed(): boolean { return this.state.zoom > 1; }
  cancelPinchAnchor(): void { this.pinchAnchor = undefined; }

  onVisibleRange(first: number, last: number): void {
    // A reload can report the preceding viewport before native consumes
    // the jump. That range cannot select or retire the landing page.
    if (!this.state.horizontal && this.state.restoringAnchor && this.appliedLayoutGeneration !== this.layoutGeneration) { this.scene.admission().traceBoundary('range-before-jump'); return; }
    const unchanged = this.first === first && this.last === last;
    this.first = first; this.last = last;
    this.scene.chapter.refreshLoginRequiredForControls();
    if (this.state.restoringAnchor) {
      if (!unchanged) this.notifyPublishedRows(false);
      // scrollToIndex can synchronously report its range while native
      // layout is applying. Its existing finishLayout frame confirms it;
      // later native range changes share the observation frame instead.
      if (this.appliedLayoutGeneration === this.layoutGeneration) this.queueViewportObservation();
      return;
    }
    if (unchanged && this.viewportRangeObserved) return;
    this.viewportRangeObserved = true;
    this.layoutGeneration++; this.updateViewport();
  }

  beginViewportPinch(): void {
    if (!this.viewportGestureCurrent()) return;
    this.rememberVisible(); this.pinchAnchor = this.visibleAnchor; this.pinchStartScale = this.state.zoom;
  }

  updateViewportPinch(scale: number): void {
    if (this.viewportGestureCurrent()) this.changeZoom(this.pinchStartScale * scale);
  }

  finishViewportPinch(): void {
    this.cancelPinchAnchor();
    if (this.viewportGestureCurrent()) this.saveVisible();
  }

  get viewportWidth(): number { return this.state.viewportWidth; }
  get viewportHeight(): number { return this.state.viewportHeight; }
  get horizontal(): boolean { return this.state.horizontal; }
  get pageCount(): number { return this.state.horizontalPageCount; }
  get fit(): 'source' | 'width' | 'contain' { return this.state.fitPreference; }
  get manifestRevision(): string { return this.publishedManifestVersion; }
  selectorTouchCancelled(): void {
    if (this.pageSliderCommitted < 0) this.clearPageSliderPreview();
  }

  canPullBoundary(): boolean {
    return !this.state.horizontal && this.state.zoom === 1;
  }

  get anchorRestoring(): boolean { return this.state.restoringAnchor; }

  confirmedBoundaryOrigin(): MangaConfirmedPosition | undefined {
    return this.confirmedPosition;
  }

  terminalPageConfirmed(controller: MangaSessionController | undefined,
    ordinal: number, confirmed: MangaConfirmedPosition | undefined, vertical: boolean): boolean {
    if (this.state.restoringAnchor || confirmed === undefined || confirmed.controller !== controller ||
      confirmed.manifest !== controller?.chapter?.manifest ||
      confirmed.identity !== this.positionIdentity(confirmed.anchor.ordinal)) return false;
    if (vertical) return this.verticalTailVisible();
    return ordinal + 1 === this.state.horizontalPageCount &&
      (confirmed.anchor.ordinal === ordinal || this.verticalTailVisible());
  }

  invalidateBoundaryManifest(): void { this.publishedManifestVersion = ''; }

  landBoundaryPage(ordinal: number, y: number, x: number): void {
    this.confirmedPosition = undefined; this.visibleAnchor = undefined;
    this.state.horizontalPage = ordinal;
    this.publish(); this.restore(ordinal, y, x);
  }

  restoreAfterBoundaryFailure(confirmed: MangaConfirmedPosition): void {
    this.visibleAnchor = confirmed.anchor; this.confirmedPosition = confirmed;
    this.publish(); this.restore(confirmed.anchor.ordinal, confirmed.anchor.y, confirmed.anchor.x ?? 0);
  }

  restoreAfterBoundaryCancel(confirmed: MangaConfirmedPosition | undefined): void {
    this.visibleAnchor = confirmed?.anchor;
    if (!this.scene.chapter.mounted) return;
    this.publish();
    if (confirmed !== undefined) this.restore(confirmed.anchor.ordinal, confirmed.anchor.y, confirmed.anchor.x ?? 0);
  }

  reportNativeTileFailure(row: MangaStripRow, uri: string): void {
    this.nativeImageFailures.add(this.nativeFailureKey(row, uri));
    this.data.notify(false, this.first, this.requestedLast());
  }

  private measuredBoundaryRange(): boolean {
    return this.measureVisibleWindow() && Number.isSafeInteger(this.first) && Number.isSafeInteger(this.last) &&
      this.first >= 0 && this.last >= this.first && this.last < this.data.totalCount();
  }

  checkRestoredBoundaryFrame(controller: MangaSessionController, decoded: (key: string) => boolean): boolean {
    if (this.state.restoringAnchor || this.confirmedPosition?.controller !== controller ||
      this.confirmedPosition.manifest !== controller.chapter?.manifest) return false;
    try {
      if (!this.measuredBoundaryRange() || this.last - this.first > 7) return false;
      return this.checkBoundaryRows(controller, decoded, false) === 'painted';
    } catch (_error) { return false; }
  }

  checkCandidateBoundaryFrame(controller: MangaSessionController, decoded: (key: string) => boolean,
    landing: 'first' | 'last', target: number): MangaBoundaryPaintResult {
    if (this.state.restoringAnchor || this.confirmedPosition?.controller !== controller ||
      this.confirmedPosition.manifest !== controller.chapter?.manifest) return 'waiting';
    try {
      if (!this.measuredBoundaryRange()) return 'waiting';
      if (this.last - this.first > 7) return 'tile-budget';
      // Read the measured anchor after the native range updates. Tail clamping
      // can legitimately show earlier short pages above the last page.
      if (landing === 'last' ? !this.scroller.isAtEnd() : this.confirmedPosition.anchor.ordinal !== target) return 'waiting';
      return this.checkBoundaryRows(controller, decoded, true);
    } catch (_error) { return 'waiting'; /* Wait for the mounted replacement frame. */ }
  }

  private checkBoundaryRows(controller: MangaSessionController, decoded: (key: string) => boolean,
    rejectUnavailable: boolean): MangaBoundaryPaintResult {
    // The requested prefetch neighbour is not mounted and has no visible rect.
    for (let index = this.first; index <= this.last; index++) {
      const row = this.data.getData(index), rect = this.scroller.getItemRect(index);
      if (!Number.isFinite(rect.y) || !Number.isFinite(rect.height) || !Number.isFinite(rect.width) || rect.width <= 0 || rect.height <= 0) return 'waiting';
      if (rect.y >= this.state.viewportHeight || rect.y + rect.height <= 0) continue;
      if (rejectUnavailable && this.rowHasError(row)) return 'image-required';
      if (controller.tile(row.ordinal, row.tileIndex)?.image === undefined || !decoded(this.rowRenderKey(row))) return 'waiting';
    }
    return 'painted';
  }

  sampleBoundaryTrace(): MangaBoundaryLayoutSample {
    let first = -1, last = -1, ordinal = -1, end = false;
    try {
      first = this.scroller.getItemIndex(0.5, 0.5);
      last = this.scroller.getItemIndex(0.5, this.state.viewportHeight - 0.5);
      end = this.scroller.isAtEnd();
      if (Number.isSafeInteger(first) && first >= 0 && first < this.data.totalCount()) ordinal = this.data.getData(first).ordinal;
    } catch (_error) { /* An unmounted native window is evidence, not admission. */ }
    return { first, last, ordinal, end, generation: this.layoutGeneration,
      applied: this.appliedLayoutGeneration, restoring: this.state.restoringAnchor };
  }

  releaseMountedPosition(): void {
    this.viewportObservationGeneration++; this.viewportObservationPending = false;
    this.confirmedPosition = undefined;
    this.pendingRestoreAnchor = undefined;
    this.pendingTurnOrdinal = undefined; this.mountedTurnRowKey = '';
  }

  publish(): void {
    const chapter = this.scene.book.controller?.chapter;
    if (!this.scene.chapter.mounted || chapter === undefined) return;
    this.scene.chapter.setRecovering(this.scene.book.controller?.recoveryRequired === true);
    this.scene.chapter.notifyPreparationFailure();
    const manifestChanged = this.publishedManifestVersion !== chapter.manifest.manifestVersion;
    if (manifestChanged && this.scene.book.controller !== undefined) {
      this.nativeImageFailures.clear();
      this.publishedManifestVersion = chapter.manifest.manifestVersion;
      this.layoutGeneration++; this.viewportGeneration++;
      this.pendingRestoreAnchor = undefined; this.state.restoringAnchor = false;
      this.viewportRangeObserved = false;
      // Manifest layout is separate from newer user presentation intent.
      this.confirmedPosition = undefined;
      this.seekingPage = undefined;
      this.clampedSeekPage = undefined;
      this.pendingTurnOrdinal = undefined; this.mountedTurnRowKey = '';
      this.scene.chapter.setRecovering(this.scene.book.controller.recoveryRequired);
      const ordinal = this.scene.book.controller.displayedOrdinal;
      const saved = this.scene.chapter.recovering ? null : this.scene.book.controller.savedLocation;
      const exact = saved !== null && saved.manifestVersion === chapter.manifest.manifestVersion &&
        saved.pageOrdinalFallback === ordinal && saved.pageId === this.scene.book.controller.pageAt(ordinal)?.pageId;
      this.state.horizontalPage = ordinal;
      this.visibleAnchor = { ordinal, y: exact ? saved!.y : 0, x: exact ? saved!.x : 0 };
    } else this.rememberVisible();
    const anchor = this.state.restoringAnchor ? this.pendingRestoreAnchor ?? this.visibleAnchor : this.visibleAnchor;
    try {
      const changed = this.data.projection.publish(chapter.manifest, (index: number) => this.scene.book.controller?.pageGeometry(index), this.state.horizontal ? this.state.horizontalPage : undefined, this.scene.book.controller?.totalPages ?? chapter.manifest.pages.length, (ordinal: number) => this.scene.book.controller?.pageAt(ordinal));
      // Controller facts are plain fields. Publish the admitted chapter count
      // as ArkUI state even when a new chapter starts at the same ordinal 0.
      this.state.horizontalPageCount = this.scene.book.controller?.totalPages ?? 0;
      this.scene.chapter.setTitle(this.displayChapterTitle(chapter.chapterIndex, chapter.chapterTitle));
      if (manifestChanged || this.state.restoringAnchor) this.state.displayedPage = anchor?.ordinal ?? this.scene.book.controller?.displayedOrdinal ?? 0;
      this.notifyPublishedRows(changed);
      if (this.mountedTurnRowKey.length > 0 && this.data.totalCount() > 0) this.confirmMountedTurn(this.data.getData(0));
      if (changed && this.scene.chapter.opened && anchor !== undefined &&
        (this.state.restoringAnchor ? this.pendingRestoreAnchor !== undefined : this.data.projection.affectsAnchor(anchor.ordinal)))
        this.restore(anchor.ordinal, anchor.y, anchor.x ?? 0);
    } catch (error) { this.scene.chapter.reportError(error instanceof Error ? error.message : '漫画布局失败'); }
  }
  notifyPublishedRows(structure: boolean): void {
    // Image/auth facts are plain controller fields, not an observed UI property.
    this.scene.chapter.refreshLoginRequiredForControls();
    const next = new Map<number, string>();
    const changed: number[] = [];
    for (let index = this.first; index <= this.requestedLast(); index++) {
      const key = this.rowRenderKey(this.data.getData(index));
      next.set(index, key);
      if (this.publishedRowKeys.get(index) !== key) changed.push(index);
    }
    // Commit before native notifications can report the same visible range.
    // Only the bounded viewport is retained; offscreen rows read current facts
    // when ArkUI mounts them, without a chapter-wide notification scan.
    this.publishedRowKeys.clear();
    next.forEach((key: string, index: number): void => { this.publishedRowKeys.set(index, key); });
    if (structure) this.data.notify(true, this.first, this.requestedLast());
    else for (const index of changed) this.data.notify(false, index, index);
  }
  private positionIdentity(ordinal: number): string {
    const manifest = this.scene.book.controller?.chapter?.manifest;
    const page = this.scene.book.controller?.pageAt(ordinal);
    if (manifest === undefined || page === undefined) return '';
    return JSON.stringify([manifest.chapter.sourceId, manifest.chapter.bookId, manifest.chapter.chapterId,
      manifest.manifestVersion, page.pageId]);
  }
  verticalTailVisible(): boolean {
    const lastIndex = this.data.totalCount() - 1;
    if (this.state.horizontal || lastIndex < 0 || this.last !== lastIndex) return false;
    const row = this.data.getData(lastIndex);
    if (!row.known || row.ordinal !== this.state.horizontalPageCount - 1) return false;
    try {
      if (!this.scroller.isAtEnd()) return false;
      const rect = this.scroller.getItemRect(lastIndex);
      return Number.isFinite(rect.y) && Number.isFinite(rect.height) && rect.height > 0 &&
        rect.y < this.state.viewportHeight && rect.y + rect.height > 0;
    } catch (_error) { return false; }
  }
  rememberVisible(allowRestore: boolean = false): boolean {
    // A pulled drawing transform cannot become a durable image coordinate.
    if (this.scene.admission().boundaryDragging) return false;
    if (this.state.restoringAnchor && (!allowRestore || this.appliedLayoutGeneration !== this.layoutGeneration)) return false;
    if (this.data.totalCount() <= this.first) return false;
    const row = this.data.getData(this.first);
    try {
      const rect = this.scroller.getItemRect(this.first);
      // A frame callback can precede the new layout. Never combine a new scale
      // or fit with the previous native rectangle (allow only vp rounding).
      if (!Number.isFinite(rect.width) || !Number.isFinite(rect.height) ||
        Math.abs(rect.width - this.state.viewportWidth * this.state.zoom) > 1 ||
        Math.abs(rect.height - this.rowDisplayHeight(row)) > 1) return false;
      const y = this.data.projection.position(this.first, -rect.y - this.rowDisplayTop(row), this.rowDisplayWidth(row));
      const identity = this.positionIdentity(row.ordinal);
      const manifest = this.scene.book.controller?.chapter?.manifest;
      if (identity.length === 0 || this.scene.book.controller === undefined || manifest === undefined) return false;
      const atTail = this.verticalTailVisible();
      const seek = this.seekingPage;
      if (seek !== undefined && seek !== row.ordinal && (!atTail || seek < row.ordinal)) return false;
      this.visibleAnchor = { ordinal: row.ordinal, y, x: this.visibleX(row) };
      this.confirmedPosition = { controller: this.scene.book.controller, manifest, identity, anchor: this.visibleAnchor };
      // Bottom clamping can leave several page starts visible. Keep the
      // explicit selection while clamped and retain the measured top anchor.
      this.clampedSeekPage = atTail ? seek ?? this.clampedSeekPage : undefined;
      this.state.displayedPage = atTail ? Math.max(row.ordinal, this.clampedSeekPage ?? this.state.horizontalPageCount - 1) : row.ordinal;
      this.seekingPage = undefined;
      return true;
    } catch (_error) {
      // Unknown geometry must not erase an already measured intra-image anchor.
      if (this.visibleAnchor?.ordinal !== row.ordinal) this.visibleAnchor = { ordinal: row.ordinal, y: 0 };
      return false;
    }
  }
  resizeViewport(width: number, height: number = this.state.viewportHeight): void {
    if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0 || (width === this.state.viewportWidth && height === this.state.viewportHeight)) return;
    if (this.scene.admission().busy || this.scene.admission().boundaryDragging) void this.scene.admission().cancelBoundaryChapter().catch((): void => {});
    // The new layout's rectangles cannot reconstruct the old clipped position.
    // Use the logical coordinate captured while the previous width was active.
    const anchor = this.visibleAnchor;
    this.state.viewportWidth = width; this.state.viewportHeight = height;
    this.scene.window.onWindowChromeChanged();
    if (this.scene.chapter.opened && anchor !== undefined) this.restore(anchor.ordinal, anchor.y, anchor.x ?? 0);
  }
  restore(ordinal: number, y: number, x: number = 0): void {
    this.visibleAnchor = { ordinal, y, x };
    this.pendingRestoreAnchor = this.visibleAnchor;
    this.state.restoringAnchor = true;
    this.appliedLayoutGeneration = -1;
    const generation = ++this.layoutGeneration;
    this.tracePosition('restore-requested', this.visibleAnchor);
    // A data-source reload is applied by native layout, not by the next JS
    // timer. Scroll only after that frame has rendered, then measure a later
    // rendered frame. Otherwise scrollToIndex can target the previous chapter.
    this.scene.window.getUIContext().postFrameCallback(new MangaLayoutFrame(this.scene.window.getUIContext(), (): void => {
      this.scene.admission().traceBoundary('restore-rendered');
      if (!this.scene.chapter.mounted || generation !== this.layoutGeneration) return;
      const index = this.data.projection.index(ordinal, y);
      // Seed before scrolling: a synchronous onScrollIndex owns the measured
      // range, and restoring the same first row must not erase its visible tail.
      if (this.first !== index) this.last = index;
      this.first = index;
      this.scene.chapter.refreshLoginRequiredForControls();
      const row = this.data.getData(index);
      const offset = row.known ? Math.max(0, y * row.sourceHeight - row.sourceY) * this.rowDisplayWidth(row) / row.width + (y > 0 ? this.rowDisplayTop(row) : 0) : 0;
      // Native layout consumes this jump later. Keep the index and intra-row
      // offset in one platform request, rather than apply a delta to old rows.
      this.scroller.scrollToIndex(index, false, ScrollAlign.START, { extraOffset: LengthMetrics.vp(offset) });
      this.scene.admission().traceBoundary('jump-requested');
      this.horizontalScroller.scrollTo({ xOffset: x * this.rowDisplayWidth(row) + this.rowDisplayLeft(row), yOffset: 0, animation: false });
      this.updateViewport();
      this.finishLayout(generation);
    }, (): void => { if (generation === this.layoutGeneration) this.scene.admission().traceBoundary('restore-frame'); }));
  }
  private finishLayout(generation: number): void {
    this.scene.window.getUIContext().postFrameCallback(new MangaLayoutFrame(this.scene.window.getUIContext(), (): void => {
      if (!this.scene.chapter.mounted || generation !== this.layoutGeneration) return;
      this.appliedLayoutGeneration = generation;
      this.onViewportScroll();
      this.scene.admission().traceBoundary('landing-rendered');
      if (this.scene.admission().settlingPaint) this.scene.admission().confirmBoundaryFrame();
    }, (): void => { if (generation === this.layoutGeneration) this.scene.admission().traceBoundary('landing-frame'); }));
  }
  private onViewportScroll(): void {
    if (this.scene.admission().boundaryDragging) return;
    this.scene.chapter.refreshLoginRequiredForControls();
    if (!this.state.restoringAnchor) { this.rememberVisible(); if (this.scene.admission().settlingPaint) this.scene.admission().confirmBoundaryFrame(); return; }
    if (this.appliedLayoutGeneration !== this.layoutGeneration || !this.measureVisibleWindow()) return;
    // An unknown following page can temporarily shorten the native list and
    // clamp this request to its tail. Its later height must replay the original
    // logical anchor, rather than commit that temporary clipped coordinate.
    if (this.pendingRestoreAnchor !== undefined) {
      if (this.last - this.first > 7) {
        this.scene.admission().rejectPendingPaint('MANGA_TILE_WINDOW_BUDGET');
        return;
      }
      for (let index = this.first; index <= this.last; index++) {
        if (!this.data.getData(index).known) return;
      }
    }
    if (this.rememberVisible(true)) {
      this.state.restoringAnchor = false;
      this.pendingRestoreAnchor = undefined;
      if (this.visibleAnchor !== undefined) this.tracePosition('restore-confirmed', this.visibleAnchor);
    }
    if (this.scene.admission().settlingPaint) this.scene.admission().confirmBoundaryFrame();
  }
  queueViewportObservation(): void {
    if (!this.scene.chapter.mounted || this.viewportObservationPending) return;
    this.viewportObservationPending = true;
    const generation = ++this.viewportObservationGeneration;
    // Native input/scroll callbacks can arrive from both nested scrollers in
    // one frame. Observe only the latest layout after those callbacks finish.
    this.scene.window.getUIContext().postFrameCallback(new MangaLayoutFrame(this.scene.window.getUIContext(), (): void => {
      if (generation !== this.viewportObservationGeneration) return;
      this.viewportObservationPending = false;
      if (this.scene.chapter.mounted) this.onViewportScroll();
    }));
  }
  flushViewportObservation(): void {
    this.viewportObservationGeneration++; this.viewportObservationPending = false;
    this.onViewportScroll();
  }
  onViewportTouch(event?: TouchEvent): void {
    if (event !== undefined && event.type !== TouchType.Down) return;
    if (!this.scene.input().phonePanelBackgroundEnabled() || !this.scene.input().readerPanelForeground()) return;
    this.viewportInputRevision = this.scene.chapter.pageTurnInputRevision;
    this.seekingPage = undefined;
    this.clampedSeekPage = undefined;
    this.pendingRestoreAnchor = undefined;
    this.scene.chapter.advancePresentation();
    this.pendingTurnOrdinal = undefined; this.mountedTurnRowKey = '';
    const generation = ++this.layoutGeneration;
    if (this.state.restoringAnchor) {
      // Cancel the queued scroll, but do not declare the new geometry stable.
      this.appliedLayoutGeneration = -1;
      this.finishLayout(generation);
    }
  }
  private requestedLast(): number {
    return Math.min(this.data.totalCount() - 1, this.last + 1, this.first + 7);
  }
  onRowAppear(index: number): void {
    if (!this.scene.chapter.mounted || index < 0 || index >= this.data.totalCount()) return;
    if (!this.state.horizontal && this.state.restoringAnchor && this.appliedLayoutGeneration !== this.layoutGeneration) return;
    const row = this.data.getData(index);
    if (this.seekingPage !== undefined && row.ordinal !== this.seekingPage) return;
    if (this.state.horizontal && this.pendingTurnOrdinal === row.ordinal && row.tileIndex === 0) {
      this.mountedTurnRowKey = row.key;
      this.confirmMountedTurn(row);
    }
    if (!row.known || this.scene.book.controller?.tile(row.ordinal, row.tileIndex) !== undefined) return;
    // A native List item can mount before its range callback reports the new
    // layout (especially while restoring an anchor). Demand the mounted tile
    // directly so it cannot remain a spinner with no pending decode.
    if (index < this.first || index > this.first + 7) {
      this.first = index; this.last = index;
      this.scene.chapter.refreshLoginRequiredForControls();
    }
    else this.last = Math.max(this.last, index);
    void this.updateViewport();
  }
  private confirmMountedTurn(row: MangaStripRow): void {
    const controller = this.scene.book.controller;
    const manifest = controller?.chapter?.manifest;
    if (!this.scene.chapter.mounted || !this.state.horizontal || controller === undefined || manifest === undefined || !row.known ||
      row.tileIndex !== 0 || row.ordinal !== this.state.horizontalPage || row.ordinal !== this.pendingTurnOrdinal ||
      row.key !== this.mountedTurnRowKey || controller.tile(row.ordinal, 0)?.image === undefined) return;
    const identity = this.positionIdentity(row.ordinal);
    if (identity.length === 0) return;
    // The selected ListItem has mounted with its decoded image. It is safe to
    // retain the page start while native geometry is still settling; a later
    // measured rectangle may refine the x/y coordinate.
    const anchor: MangaViewportAnchor = { ordinal: row.ordinal, y: 0, x: 0 };
    this.visibleAnchor = anchor;
    this.confirmedPosition = { controller, manifest, identity, anchor };
    this.pendingTurnOrdinal = undefined; this.mountedTurnRowKey = '';
  }
  measureVisibleWindow(): boolean {
    if (this.state.viewportHeight <= 1 || this.data.totalCount() === 0) return false;
    try {
      const first = this.scroller.getItemIndex(0.5, 0.5);
      if (!Number.isSafeInteger(first) || first < 0 || first >= this.data.totalCount()) return false;
      let last = this.scroller.getItemIndex(0.5, this.state.viewportHeight - 0.5);
      if (!Number.isSafeInteger(last) || last < first || last >= this.data.totalCount()) {
        // A short chapter can end above the bottom probe. Only inspect the
        // existing bounded tile window; never scan the chapter to find an end.
        last = first;
        for (let index = first + 1; index <= Math.min(this.data.totalCount() - 1, first + 7); index++) {
          const rect = this.scroller.getItemRect(index);
          if (!Number.isFinite(rect.y) || !Number.isFinite(rect.height) || rect.height <= 0 ||
            rect.y >= this.state.viewportHeight || rect.y + rect.height <= 0) break;
          last = index;
        }
      }
      if (this.first === first && this.last === last) return true;
      this.first = first; this.last = last;
      this.scene.chapter.refreshLoginRequiredForControls();
      this.updateViewport();
      return true;
    } catch (_error) { return false; /* Unmounted geometry leaves the last observed range intact. */ }
  }
  async updateViewport(): Promise<void> {
    const controller = this.scene.book.controller;
    // The initial projection can mount rows while openPrepared() is still
    // admitting the saved page. Native callbacks must not supersede that
    // selection before the opening transaction completes.
    if (!this.scene.chapter.mounted || !this.scene.chapter.opened || controller === undefined || this.data.totalCount() === 0) return;
    // Error-card ownership follows the actual viewport even when no image
    // geometry or tile lease changes can produce a Controller publication.
    this.notifyPublishedRows(false);
    const generation = ++this.viewportGeneration;
    const row = this.data.getData(Math.min(this.first, this.data.totalCount() - 1));
    try {
      // A tall viewport may display more than the metadata prefetch window of
      // three pages. Keep its exact existing tiles until the new window commits.
      const retained: MangaTileRequest[] = [];
      for (let index = this.first; index <= this.requestedLast(); index++) {
        const item = this.data.getData(index);
        if (item.known) retained.push({ ordinal: item.ordinal, tileIndex: item.tileIndex });
      }
      await controller.setVisible(row.ordinal, retained);
      if (!this.scene.chapter.mounted || generation !== this.viewportGeneration) return;
      const visiblePages: number[] = [];
      let needsGeometry = false;
      for (let index = this.first; index <= Math.min(this.last, this.first + 7, this.data.totalCount() - 1); index++) {
        const item = this.data.getData(index);
        if (!visiblePages.includes(item.ordinal)) visiblePages.push(item.ordinal);
        if (!item.known) needsGeometry = true;
      }
      if (needsGeometry) {
        const layout = this.layoutGeneration;
        await controller.prepareViewportPages(visiblePages);
        if (!this.scene.chapter.mounted || this.scene.book.controller !== controller || generation !== this.viewportGeneration || layout !== this.layoutGeneration) return;
      }
      const requested: MangaTileRequest[] = [];
      for (let index = this.first; index <= this.requestedLast(); index++) {
        const item = this.data.getData(index);
        if (item.known) requested.push({ ordinal: item.ordinal, tileIndex: item.tileIndex });
      }
      await controller.setTileWindow(requested);
      if (this.scene.chapter.mounted && generation === this.viewportGeneration && !this.scene.chapter.chapterCommitted && !this.scene.admission().presentingCandidate &&
        controller.tile(row.ordinal, row.tileIndex)?.image !== undefined && controller.chapter !== undefined) {
        this.scene.chapter.setChapterCommitted(true);
        this.scene.actions.onChapterCommitted(controller.chapter.chapterIndex,
          this.displayChapterTitle(controller.chapter.chapterIndex, controller.chapter.chapterTitle));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '图片加载失败';
      // A newer controller selection can cancel this window before its own
      // viewport callback runs. Cancellation is not a failure of visible pixels.
      if (message !== 'MANGA_SESSION_CANCELLED' && this.scene.chapter.mounted && generation === this.viewportGeneration) {
        if (this.scene.admission().presentingCandidate) this.scene.admission().rejectPendingPaint(message);
        else this.scene.chapter.reportError(message);
      }
    }
  }
  // A skipped observation retains the previous anchor. Only a rejected
  // eligible write blocks an exit requested by navigation.
  async saveVisible(): Promise<boolean> {
    if (this.scene.admission().presentingCandidate || this.scene.admission().boundaryDragging) return true;
    if (!this.scene.chapter.opened || this.scene.chapter.recovering || this.scene.book.controller === undefined || this.data.totalCount() <= this.first) return true;
    let saved = true;
    try {
      if (!this.state.restoringAnchor && !this.rememberVisible()) return true;
      const confirmed = this.confirmedPosition;
      if (confirmed === undefined || confirmed.controller !== this.scene.book.controller ||
        confirmed.manifest !== this.scene.book.controller.chapter?.manifest ||
        confirmed.identity !== this.positionIdentity(confirmed.anchor.ordinal) ||
        (this.state.horizontal && confirmed.anchor.ordinal !== this.state.horizontalPage)) return true;
      const anchor = confirmed.anchor;
      const presentationGeneration = this.scene.chapter.presentationGeneration;
      this.tracePosition('save-requested', anchor);
      await this.scene.book.controller.savePosition(anchor.ordinal, anchor.x ?? 0, anchor.y).then((): void => {
        this.tracePosition('save-admitted', anchor);
        const controller = confirmed.controller;
        const chapter = controller.chapter;
        const location = controller.savedLocation;
        if (chapter !== undefined && chapter.manifest === confirmed.manifest && location !== undefined && location !== null) {
          const presentationRevision = MangaBookPresentation.revision;
          MangaBookPresentation.admitConfirmedLocation(this.scene.book.sourceId, this.scene.book.bookId, location, chapter, controller.totalPages, controller.pageAt(location.pageOrdinalFallback));
          if (MangaBookPresentation.revision !== presentationRevision)
            AppStorage.setOrCreate('readerMangaPresentationRevision', MangaBookPresentation.revision);
        }
      }).catch((error: Error): void => {
        if (error.message !== 'MANGA_POSITION_NOT_VISIBLE') {
          saved = false;
          // The old page's content fence may be revoked while a later image is
          // already mounted. Do not attribute that cancellation to the new page.
          if (error.message === 'MANGA_SESSION_CANCELLED' &&
            (!this.scene.chapter.mounted || this.scene.book.controller !== confirmed.controller ||
              this.scene.chapter.presentationGeneration !== presentationGeneration || this.confirmedPosition !== confirmed ||
              (this.state.horizontal && this.state.horizontalPage !== anchor.ordinal))) {
            // The CAS receipt may still be uncertain. Keep the owner's failure
            // record even though the old page cannot own the current banner.
            this.scene.actions.onSaveFailure(error.message);
            return;
          }
          // Persistence failures belong to the save owner, not the chapter or
          // image error slot. Keep its uncertain receipt without a load banner.
          this.scene.actions.onSaveFailure(error.message);
        }
      });
    } catch (_error) { /* Geometry has not been admitted; never replace the saved anchor. */ }
    return saved;
  }
  effectiveFit(): 'width' | 'contain' {
    if (this.state.fitPreference === 'width' || this.state.fitPreference === 'contain') return this.state.fitPreference;
    return this.scene.book.controller?.chapter?.manifest.displayHints?.fit === 'contain' ? 'contain' : 'width';
  }
  rowDisplayWidth(row: MangaStripRow): number {
    return this.state.zoom * (this.effectiveFit() === 'contain' && row.known && this.state.viewportHeight > 1 ?
      Math.min(this.state.viewportWidth, this.state.viewportHeight * row.width / row.sourceHeight) : this.state.viewportWidth);
  }
  rowDisplayHeight(row: MangaStripRow): number {
    if (!row.known && this.rowHasError(row)) return this.unavailableImageHeight(row) + 12;
    const height = this.rowDisplayWidth(row) * row.height / row.width;
    return this.effectiveFit() === 'contain' ? Math.max(height, this.state.viewportHeight * this.state.zoom) : height;
  }
  unavailableImageWidth(row: MangaStripRow): number {
    return row.known ? this.rowDisplayWidth(row) : Math.max(1, this.rowDisplayWidth(row) - 32);
  }
  unavailableImageHeight(row: MangaStripRow): number {
    return row.known ? this.rowDisplayWidth(row) * row.height / row.width :
      Math.max(160, Math.min(220, this.unavailableImageWidth(row) / 2));
  }
  nativeFailureKey(row: MangaStripRow, uri: string): string {
    return `${this.scene.book.controller?.chapter?.manifest.manifestVersion ?? ''}\u0000${row.key}\u0000${uri}`;
  }
  private rowDisplayTop(row: MangaStripRow): number { return (this.rowDisplayHeight(row) - this.rowDisplayWidth(row) * row.height / row.width) / 2; }
  private rowDisplayLeft(row: MangaStripRow): number { return (this.state.viewportWidth * this.state.zoom - this.rowDisplayWidth(row)) / 2; }
  private visibleX(row: MangaStripRow): number {
    return Math.max(0, Math.min(1, (this.horizontalScroller.currentOffset().xOffset - this.rowDisplayLeft(row)) / this.rowDisplayWidth(row)));
  }
  async changeFit(requestedFit?: 'source' | 'width' | 'contain', persist: boolean = true): Promise<void> {
    this.pendingTurnOrdinal = undefined; this.mountedTurnRowKey = '';
    this.rememberVisible();
    const anchor = this.visibleAnchor;
    // Freeze the accepted old tile before preview mode releases its lease.
    // The existing controller lane owns this write even if the view exits.
    void this.saveVisible();
    const generation = this.scene.chapter.advancePresentation();
    this.layoutGeneration++; this.appliedLayoutGeneration = -1; this.state.restoringAnchor = true;
    const chapter = this.scene.book.controller?.chapter;
    this.state.fitPreference = requestedFit ?? (this.state.fitPreference === 'source' ? 'width' : this.state.fitPreference === 'width' ? 'contain' : 'source');
    const controller = this.scene.book.controller;
    const current = (): boolean => this.scene.chapter.mounted && !this.scene.chapter.exiting && this.scene.book.isReaderIdentityCurrent?.() !== false &&
      this.scene.book.controller === controller && controller?.chapter === chapter && generation === this.scene.chapter.presentationGeneration;
    if (persist) {
      this.scene.book.settingsGateway?.updateMangaFit(this.state.fitPreference).catch((error: Error): void => { if (current()) this.scene.chapter.reportError(error.message); });
    }
    try { await controller?.setPreviewMode(this.effectiveFit() === 'contain', anchor?.ordinal ?? this.state.horizontalPage); }
    catch (error) { if (current()) this.scene.chapter.reportError(error instanceof Error ? error.message : '漫画布局失败'); }
    if (!current()) return;
    if (anchor !== undefined) this.restore(anchor.ordinal, anchor.y, anchor.x ?? 0);
  }
  imageError(row: MangaStripRow): string {
    return this.scene.book.controller?.tile(row.ordinal, row.tileIndex)?.error ??
      this.scene.book.controller?.visiblePages().find(page => page.ordinal === row.ordinal)?.error ?? 'MANGA_IMAGE_FAILED';
  }
  rowHasError(row: MangaStripRow): boolean {
    const tile = this.scene.book.controller?.tile(row.ordinal, row.tileIndex);
    if (tile?.image !== undefined) {
      return this.nativeImageFailures.has(this.nativeFailureKey(row, tile.image.fileUri));
    }
    return this.scene.book.controller?.tile(row.ordinal, row.tileIndex)?.error !== undefined ||
      this.scene.book.controller?.visiblePages().some(page => page.ordinal === row.ordinal && page.status === 'failed') === true;
  }
  wholeImageUnavailable(row: MangaStripRow): boolean {
    return row.known && this.scene.book.controller?.visiblePages().some(page => page.ordinal === row.ordinal && page.status === 'failed') === true;
  }
  /** A tiled long image is still one logical image. Pick one failed region
   * nearest its centre; a readable region always keeps its admitted pixels. */
  unavailableMarkerTile(row: MangaStripRow): number {
    if (!this.wholeImageUnavailable(row)) return row.tileIndex;
    const geometry = this.scene.book.controller?.pageGeometry(row.ordinal);
    const tileHeight = geometry?.tileHeight ?? row.height;
    const count = Math.max(1, Math.ceil(row.sourceHeight / tileHeight));
    const middle = Math.min(count - 1, Math.floor(row.sourceHeight / 2 / tileHeight));
    for (let distance = 0; distance < count; distance++) {
      for (const index of distance === 0 ? [middle] : [middle - distance, middle + distance]) {
        if (index < 0 || index >= count) continue;
        if (this.scene.book.controller?.tile(row.ordinal, index)?.image === undefined) return index;
      }
    }
    return -1;
  }
  unavailableMarkerTop(row: MangaStripRow): number {
    const height = this.unavailableImageHeight(row);
    const centre = this.rowDisplayWidth(row) * (row.sourceHeight / 2 - row.sourceY) / row.width;
    return this.wholeImageUnavailable(row) && centre >= 16 && centre <= height - 16 ?
      centre - 16 : Math.max(0, (height - 32) / 2);
  }
  displayChapterTitle(index: number, title: string): string {
    const normalized = typeof title === 'string' ? title.trim() : '';
    if (normalized.length > 0 && !/^第\s*话$/.test(normalized)) return normalized;
    return `第${Math.max(1, index + 1)}话`;
  }
  rowRenderKey(row: MangaStripRow): string {
    const tile = this.scene.book.controller?.tile(row.ordinal, row.tileIndex);
    const pageError = this.scene.book.controller?.visiblePages().find(page => page.ordinal === row.ordinal)?.error;
    // LazyForEach retains the old branch for an unchanged key, even after a
    // data notification. Keep logical page identity separate from presentation,
    // as ReaderContinuousReadingStage does for decoded inline images.
    return JSON.stringify([row.key, row.known, row.width, row.height, row.sourceY, row.sourceHeight,
      tile?.image?.fileUri ?? '', tile?.image?.revision ?? '', tile?.error ?? pageError ?? '',
      this.rowHasError(row), this.unavailableMarkerTile(row), this.scene.admission().tilePaintGeneration]);
  }
  changeZoom(scale: number): void {
    if (this.scene.admission().busy || this.scene.admission().boundaryDragging) void this.scene.admission().cancelBoundaryChapter().catch((): void => {});
    if (!Number.isFinite(scale) || scale <= 0) return;
    this.scene.chapter.advancePresentation();
    this.pendingTurnOrdinal = undefined; this.mountedTurnRowKey = '';
    if (this.pinchAnchor === undefined) this.rememberVisible();
    const anchor = this.pinchAnchor ?? this.visibleAnchor;
    this.scalePolicy.setScale(scale, false);
    this.state.zoom = this.scalePolicy.scale;
    if (anchor !== undefined) this.restore(anchor.ordinal, anchor.y, anchor.x ?? 0);
  }
  toggleDirection(persist: boolean = true): void {
    if (this.scene.admission().busy || this.scene.admission().boundaryDragging) void this.scene.admission().cancelBoundaryChapter().catch((): void => {});
    this.scene.chapter.advancePresentation();
    this.pendingTurnOrdinal = undefined; this.mountedTurnRowKey = '';
    this.rememberVisible();
    const anchor = this.visibleAnchor;
    this.state.horizontalPage = anchor?.ordinal ?? 0;
    this.state.horizontal = !this.state.horizontal;
    if (persist) {
      this.scene.book.settingsGateway?.updateMangaDirection(this.state.horizontal).catch((error: Error): void => { if (this.scene.chapter.mounted) this.scene.chapter.reportError(error.message); });
    }
    this.first = 0; this.last = 0;
    const chapter = this.scene.book.controller?.chapter;
    if (chapter === undefined) return;
    this.data.projection.publish(chapter.manifest, (index: number) => this.scene.book.controller?.pageGeometry(index), this.state.horizontal ? this.state.horizontalPage : undefined, this.scene.book.controller?.totalPages ?? chapter.manifest.pages.length, (ordinal: number) => this.scene.book.controller?.pageAt(ordinal));
    this.scene.chapter.refreshLoginRequiredForControls();
    this.data.notify(true, 0, 0);
    if (anchor !== undefined) this.restore(anchor.ordinal, anchor.y, anchor.x ?? 0);
  }
  async turnPage(direction: number): Promise<void> {
    const controller = this.scene.book.controller;
    const chapter = controller?.chapter;
    if (controller === undefined || chapter === undefined || !this.state.horizontal || !this.scene.input().readerPanelForeground()) return;
    const next = this.state.horizontalPage + direction;
    if (next < 0 || next >= controller.totalPages) return;
    const generation = this.scene.chapter.advancePresentation();
    const inputRevision = this.scene.chapter.pageTurnInputRevision;
    const previous = this.state.horizontalPage;
    await this.saveVisible();
    if (!this.scene.chapter.mounted || this.scene.book.controller !== controller || controller.chapter !== chapter ||
      generation !== this.scene.chapter.presentationGeneration || inputRevision !== this.scene.chapter.pageTurnInputRevision ||
      !this.scene.input().readerPanelForeground() || !this.state.horizontal || this.state.horizontalPage !== previous) return;
    this.state.horizontalPage = next;
    this.pendingTurnOrdinal = next; this.mountedTurnRowKey = '';
    this.visibleAnchor = undefined;
    this.first = 0; this.last = 0;
    this.data.projection.publish(chapter.manifest, (index: number) => controller.pageGeometry(index), next, controller.totalPages, (ordinal: number) => controller.pageAt(ordinal));
    this.scene.chapter.refreshLoginRequiredForControls();
    this.data.notify(true, 0, 0);
    this.restore(next, 0);
  }
  onReaderKeyEvent(event: KeyEvent): boolean {
    const action = readerHardwareKeyboardShortcut(event, {
      bodyOwnsInput: this.scene.input().readerPanelForeground() && this.scene.chapter.opened && !this.scene.window.controlsVisible &&
        this.scene.window.panel.length === 0 && this.scene.input().phase === 'closed' && !this.scene.chapter.chapterEnd && !this.scene.chapter.recovering &&
        !this.scene.chapter.refreshing && !this.scene.admission().busy && !this.scene.admission().boundaryDragging && !this.state.restoringAnchor &&
        !this.scene.admission().presentingCandidate && !this.scene.admission().rollbackPainting && !this.scene.admission().holdingRollback &&
        !ReaderNativeAlertWindow.isPresented() &&
        !this.scene.chapter.loginRequiredForControls && this.scene.chapter.error.length === 0 && this.state.zoom === 1,
      inputFocused: readerControlKeyboardVisible(ReaderWindowCoordinator.metrics()),
      selectionActive: false,
    });
    if (action === undefined) return false;
    if (action === 'back') void this.scene.actions.handleBack();
    else if (action === 'search' || action === 'directory') void this.scene.directory().openDirectory(action === 'search');
    else if (this.state.horizontal) void this.stepPage(action === 'next' ? 1 : -1);
    else this.scroller.scrollPage({ next: action === 'next', animation: !this.scene.window.reduceMotion });
    return true;
  }
  smartGestureDecision(gesture: ReaderSmartGesture): ReaderSmartGestureAction {
    return readerSmartGestureAction(gesture, this.scene.window.smartGestureSettings, {
      foreground: this.scene.input().readerPanelForeground(),
      controlsOpen: this.scene.window.controlsVisible || this.scene.input().phase !== 'closed' || this.scene.chapter.chapterEnd,
      directoryOpen: this.scene.window.panel === 'directory',
      sourceSwitchOpen: this.scene.window.windowChromeOverlayActive,
      settingsOpen: this.scene.window.panel === 'settings' || this.scene.window.panel === 'mode',
      dialogOpen: this.scene.window.panel.length > 0 || ReaderNativeAlertWindow.isPresented(),
      selectionActive: false,
      zoomed: this.state.zoom !== 1,
      chapterLoading: !this.scene.chapter.opened || this.scene.chapter.recovering || this.scene.chapter.refreshing || this.state.restoringAnchor ||
        this.scene.chapter.loginRequiredForControls || this.scene.chapter.error.length > 0,
      sourceSwitching: this.scene.admission().busy || this.scene.admission().boundaryDragging || this.scene.admission().rollbackPainting ||
        this.scene.admission().presentingCandidate,
      continuous: !this.state.horizontal,
    });
  }
  dispatchSmartGesture(action: ReaderSmartGestureAction): void {
    if (action === 'back') void this.scene.actions.handleBack();
    else if (action === 'toggleControls') this.scene.input().toggleControls();
    else if (action === 'pageNext') void this.stepPage(1);
    else if (action === 'scrollNext') this.scroller.scrollBy(0, this.state.viewportHeight * READER_SMART_GESTURE_VIEWPORT_FRACTION);
  }
  pageOrdinal(): number {
    const held = this.scene.admission().heldOriginOrdinal();
    return held ?? (this.state.horizontal ? this.state.horizontalPage : this.state.displayedPage);
  }
  presentedPage(): number {
    if (this.state.pageSliderPreview >= 0) return this.state.pageSliderPreview + 1;
    const pendingSeek = this.state.horizontal ? undefined : this.seekingPage;
    return (pendingSeek ?? this.pageOrdinal()) + 1;
  }
  clearPageSliderPreview(): void {
    this.pageSliderGeneration += 1;
    this.state.pageSliderPreview = -1;
    this.pageSliderCommitted = -1;
  }
  changePageSlider(value: number, mode: SliderChangeMode): void {
    if (!this.scene.input().readerPanelForeground() || !this.scene.chapter.opened || this.scene.window.panel.length > 0 || this.scene.chapter.chapterEnd ||
      !this.scene.window.controlsVisible || !Number.isFinite(value)) return;
    const ordinal = Math.round(value) - 1;
    if (ordinal < 0 || ordinal >= this.state.horizontalPageCount) return;
    if (mode === SliderChangeMode.Begin || mode === SliderChangeMode.Moving) {
      this.pageSliderGeneration += 1;
      this.pageSliderCommitted = -1;
      this.state.pageSliderPreview = ordinal;
      return;
    }
    if (mode !== SliderChangeMode.End && mode !== SliderChangeMode.Click) return;
    if (mode === SliderChangeMode.End && this.pageSliderCommitted === ordinal) return;
    const generation = ++this.pageSliderGeneration;
    this.pageSliderCommitted = ordinal;
    this.state.pageSliderPreview = ordinal;
    void this.seekPage(ordinal).finally((): void => {
      if (generation === this.pageSliderGeneration) this.state.pageSliderPreview = -1;
    });
  }
  private async seekPage(ordinal: number): Promise<void> {
    const controller = this.scene.book.controller;
    const chapter = controller?.chapter;
    if (controller === undefined || chapter === undefined || !this.scene.chapter.opened || !this.scene.input().readerPanelForeground() ||
      !Number.isSafeInteger(ordinal) || ordinal < 0 || ordinal >= controller.totalPages) return;
    if (this.state.horizontal) { await this.turnPage(ordinal - this.state.horizontalPage); return; }
    const generation = this.scene.chapter.advancePresentation();
    const inputRevision = this.scene.chapter.pageTurnInputRevision;
    await this.saveVisible();
    if (this.scene.book.controller !== controller || controller.chapter !== chapter || generation !== this.scene.chapter.presentationGeneration ||
      inputRevision !== this.scene.chapter.pageTurnInputRevision || !this.scene.input().readerPanelForeground()) return;
    // Freeze the explicit seek anchor before async geometry publication.
    // Existing publish/restore fencing must not re-adopt the old native row.
    const previousAnchor = this.visibleAnchor;
    this.seekingPage = ordinal;
    this.visibleAnchor = { ordinal, x: 0, y: 0 };
    this.state.restoringAnchor = true;
    this.appliedLayoutGeneration = -1;
    this.layoutGeneration++;
    this.first = this.data.projection.index(ordinal, 0); this.last = this.first;
    this.notifyPublishedRows(false);
    try { await controller.setVisible(ordinal); }
    catch (error) {
      const message = error instanceof Error ? error.message : '图片加载失败';
      if (this.scene.chapter.mounted && generation === this.scene.chapter.presentationGeneration) {
        this.seekingPage = undefined;
        if (previousAnchor !== undefined) this.restore(previousAnchor.ordinal, previousAnchor.y, previousAnchor.x ?? 0);
        if (message !== 'MANGA_SESSION_CANCELLED') this.scene.chapter.reportError(message);
      }
      return;
    }
    if (!this.scene.chapter.mounted || this.scene.book.controller !== controller || controller.chapter !== chapter || generation !== this.scene.chapter.presentationGeneration) return;
    this.restore(ordinal, 0, 0);
  }
  async stepPage(direction: number): Promise<void> {
    if (!this.state.horizontal && this.seekingPage !== undefined) return;
    this.clearPageSliderPreview();
    const ordinal = this.pageOrdinal() + direction;
    if (ordinal >= this.state.horizontalPageCount) { await this.scene.admission().openChapterEnd(); return; }
    await this.seekPage(ordinal);
  }
  viewportGestureCurrent(): boolean {
    return this.viewportInputRevision === this.scene.chapter.pageTurnInputRevision && this.scene.input().phonePanelBackgroundEnabled() &&
      this.scene.input().readerPanelForeground();
  }
  captureChapterPixels(): MangaRetainedPixel[] {
    const pixels: MangaRetainedPixel[] = [];
    if (!this.measureVisibleWindow() || !Number.isSafeInteger(this.first) || !Number.isSafeInteger(this.last) ||
      this.first < 0 || this.last < this.first || this.last >= this.data.totalCount() || this.last - this.first > 7) return pixels;
    // cachedCount(0) leaves the prefetch neighbour unmounted. Native rectangles
    // belong only to the measured visible range, never requestedLast().
    for (let index = this.first; index <= this.last; index++) {
      const row = this.data.getData(index), image = this.scene.book.controller?.tile(row.ordinal, row.tileIndex)?.image;
      if (image === undefined) continue;
      const rect = this.scroller.getItemRect(index);
      if (!Number.isFinite(rect.x) || !Number.isFinite(rect.y) || !Number.isFinite(rect.width) ||
        !Number.isFinite(rect.height) || rect.width <= 0 || rect.height <= 0) return [];
      if (rect.y >= this.state.viewportHeight || rect.y + rect.height <= 0) continue;
      pixels.push({ key: row.key, uri: image.fileUri,
        x: rect.x + this.rowDisplayLeft(row) - this.horizontalScroller.currentOffset().xOffset,
        y: rect.y + this.rowDisplayTop(row), width: this.rowDisplayWidth(row),
        height: this.rowDisplayWidth(row) * row.height / row.width });
    }
    return pixels;
  }
  private tracePosition(stage: string, anchor: MangaViewportAnchor): void {
    if (this.positionTraceEvents >= 48) return;
    this.positionTraceEvents++;
    try {
      hilog.info(0x5244, 'Reader', 'Manga position stage=%{public}s ordinal=%{public}d x=%{public}s y=%{public}s gen=%{public}d applied=%{public}d first=%{public}d',
        stage, anchor.ordinal, (anchor.x ?? 0).toString(), anchor.y.toString(), this.layoutGeneration,
        this.appliedLayoutGeneration, this.first);
    } catch (_error) { /* Position evidence cannot alter restore or durable save. */ }
  }
}

interface MangaBoundaryViewportInput {
  readonly host: MangaReadingViewportHost;
}

@Builder
export function MangaBoundaryViewport($$: MangaBoundaryViewportInput) {
    PullToRefresh({
      scroller: $$.host.scroller,
      customList: $$.host.scene.slots.viewportImages,
      customLoad: $$.host.scene.slots.boundaryHint,
      pullEnabled: $$.host.scene.admission().boundaryEnabled(), hasPrevious: false,
      hasNext: $$.host.scene.admission().adjacentChapter(1) !== undefined || $$.host.scene.admission().finalBoundaryConfirmed(), resetToken: $$.host.scene.admission().pullResetToken,
      animationDuration: readerMotionDurationMs('manga.pullRefresh.reset', $$.host.scene.window.reduceMotion),
      animationCurve: readerMotionStandardCurve(), visualDamping: readerPaperPullOffset, reduceMotion: $$.host.scene.window.reduceMotion,
      onPull: (direction: PullDirection, distance: number, armed: boolean): void => $$.host.scene.admission().onBoundaryPull(direction, distance, armed),
      onActivity: (active: boolean): void => $$.host.scene.admission().onBoundaryActivity(active),
      onRefresh: (): Promise<string> => $$.host.scene.admission().turnBoundaryChapter(-1),
      onLoadMore: (): Promise<string> => $$.host.scene.admission().releaseNextBoundary(),
    }).width('100%').height('100%');
  }

// A decode or error callback carries the URI, row key, controller and manifest
// captured by this native tile mount. These Builder arguments are by value.
@Builder
function MangaTileImage(host: MangaReadingViewportHost, row: MangaStripRow, uri: string, renderKey: string, owner: MangaSessionController | undefined, manifest: MangaManifest | undefined) {
    Image(uri).width(host.rowDisplayWidth(row)).height(host.rowDisplayWidth(row) * row.height / row.width)
      .objectFit(ImageFit.Fill).syncLoad(true).draggable(false)
      .onComplete((event?: MangaNativeImageCompletion): void => {
        if (event?.loadingStatus === 0) host.scene.admission().traceBoundary('image-loaded');
        if (event?.loadingStatus === 1) host.scene.admission().onChapterImageComplete(row, uri, renderKey, owner, manifest);
      })
      .onError((): void => host.scene.admission().onChapterImageError(row, uri, owner, manifest));
  }

interface MangaImageViewportInput {
  readonly host: MangaReadingViewportHost;
}

@Builder
export function MangaImageViewport($$: MangaImageViewportInput) {
    Scroll($$.host.horizontalScroller) {
      List({ scroller: $$.host.scroller, space: 0 }) {
        LazyForEach($$.host.data, (row: MangaStripRow, index: number) => {
          ListItem() {
            if ($$.host.rowHasError(row)) {
              Stack({ alignContent: Alignment.TopStart }) {
                if ($$.host.unavailableMarkerTile(row) === row.tileIndex) {
                  Image(($$.host.scene.window.backgroundPreference === 'ink' ? $r('app.media.reader_image_unavailable_theme_night') : $r('app.media.reader_image_unavailable')))
                    .width(32).height(32).accessibilityText('此图片不可用')
                    .position({ x: Math.max(0, ($$.host.unavailableImageWidth(row) - 32) / 2), y: $$.host.unavailableMarkerTop(row) });
                }
              }.width($$.host.unavailableImageWidth(row)).height($$.host.unavailableImageHeight(row))
                .backgroundColor(Color.Transparent)
                .border({ width: { left: 1, right: 1,
                  top: $$.host.wholeImageUnavailable(row) && row.sourceY > 0 ? 0 : 1,
                  bottom: $$.host.wholeImageUnavailable(row) && row.sourceY + row.height < row.sourceHeight ? 0 : 1 },
                  color: $$.host.scene.input().lineColor() })
                .borderRadius({ topLeft: $$.host.wholeImageUnavailable(row) && row.sourceY > 0 ? 0 : 4,
                  topRight: $$.host.wholeImageUnavailable(row) && row.sourceY > 0 ? 0 : 4,
                  bottomLeft: $$.host.wholeImageUnavailable(row) && row.sourceY + row.height < row.sourceHeight ? 0 : 4,
                  bottomRight: $$.host.wholeImageUnavailable(row) && row.sourceY + row.height < row.sourceHeight ? 0 : 4 })
                .margin({ bottom: row.known ? 0 : 12 });
            } else if ($$.host.scene.book.controller?.tile(row.ordinal, row.tileIndex)?.image !== undefined) {
              MangaTileImage($$.host, row, $$.host.scene.book.controller?.tile(row.ordinal, row.tileIndex)?.image?.fileUri ?? '', $$.host.rowRenderKey(row), $$.host.scene.book.controller, $$.host.scene.book.controller?.chapter?.manifest);
            } else {
              Column() {
                LoadingProgress().width(32).height(32).color($$.host.scene.input().mutedColor())
                  .enableLoading($$.host.scene.input().readerPanelForeground() && !$$.host.scene.window.reduceMotion);
              }.width($$.host.rowDisplayWidth(row)).height($$.host.rowDisplayWidth(row) * row.height / row.width).justifyContent(FlexAlign.Center);
            }
          }.width('100%').height($$.host.rowDisplayHeight(row)).align(Alignment.Center)
            .onAppear((): void => $$.host.onRowAppear(index))
        }, (row: MangaStripRow): string => $$.host.rowRenderKey(row))
      }.height('100%').width($$.host.state.viewportWidth * $$.host.state.zoom).cachedCount(0).scrollBar(BarState.Off)
        .edgeEffect(EdgeEffect.None)
        .enableScrollInteraction($$.host.scene.input().phonePanelBackgroundEnabled() && !$$.host.scene.admission().busy && !$$.host.scene.admission().rollbackPainting)
        .onDidScroll((): void => { $$.host.queueViewportObservation(); })
        .onScrollIndex((first: number, last: number): void => $$.host.onVisibleRange(first, last))
        .onTouch((event: TouchEvent): void => $$.host.onViewportTouch(event))
        .onScrollStop((): void => { $$.host.flushViewportObservation(); $$.host.saveVisible(); })
    }.height('100%').width('100%').scrollable(ScrollDirection.Horizontal).scrollBar(BarState.Off).edgeEffect(EdgeEffect.None)
      .enableScrollInteraction($$.host.scene.input().phonePanelBackgroundEnabled() && !$$.host.scene.admission().busy && !$$.host.scene.admission().rollbackPainting)
      .onAreaChange((_old: Area, area: Area): void => { $$.host.resizeViewport(Number(area.width), Number(area.height)); })
      .onDidScroll((): void => { $$.host.queueViewportObservation(); })
      .onScrollStop((): void => { $$.host.flushViewportObservation(); $$.host.saveVisible(); })
      .parallelGesture(GestureGroup(GestureMode.Exclusive, PinchGesture({ fingers: 2 })
        .onActionStart((): void => $$.host.beginViewportPinch())
        .onActionUpdate((event: GestureEvent): void => $$.host.updateViewportPinch(event.scale))
        .onActionEnd((): void => $$.host.finishViewportPinch())
        .onActionCancel((): void => $$.host.cancelPinchAnchor()),
        SwipeGesture({ direction: SwipeDirection.Horizontal }).onAction((event: GestureEvent): void => {
          if ($$.host.viewportGestureCurrent() && $$.host.state.horizontal && $$.host.state.zoom === 1) {
            if ($$.host.state.horizontalPage + 1 === $$.host.state.horizontalPageCount && Math.abs(event.angle) > 90) void $$.host.scene.admission().openChapterEnd();
            else $$.host.turnPage(Math.abs(event.angle) > 90 ? 1 : -1);
          }
        }),
        TapGesture({ count: 1, distanceThreshold: 6 }).onAction((): void => {
          if ($$.host.viewportGestureCurrent() && !$$.host.scene.admission().boundaryDragging) $$.host.scene.input().toggleControls();
        })));
  }
