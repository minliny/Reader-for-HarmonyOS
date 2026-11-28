import type { UIContext } from '@ohos.arkui.UIContext';
import type { AnimatorResult } from '@ohos.animator';
import vibrator from '@ohos.vibrator';
import type { ReaderTransientFeedback } from '../../../ui/feedback/ReaderTransientFeedback';
import { motionAnimateParam, readerMotionStandardCurve } from '../../../ui/foundation/MotionSpec';
import { readerMotionReducedFadeParam } from '../../../ui/foundation/ReaderMotionPolicy';
import { readerTransitionFrameSamplingEnabled } from '../../../ui/foundation/ReaderTransitionSignals';
import { readerAppColor, readerThemeDefinition, type ReaderThemeDefinition } from '../../../ui/foundation/ReaderThemeRegistry';
import type { LocalReadingBookmark, LocalReadingTocEntry } from '../application/LocalReadingFlowGateway';
import type { ReaderAppearanceTheme } from '../application/ReaderAppearanceState';
import type { ReaderSettingsSnapshot } from '../application/ReaderSettingsState';
import type { ReadingSessionChapter } from '../application/ReadingChapterWindow';
import type { ReadingSurfaceLayoutMap } from '../application/ReadingSurfaceLayoutMap';
import type { ReadingDirectoryRecovery } from '../presentation/ReadingDirectoryRecovery';
import type { ReaderPageBookmarkToggleRequest } from '../presentation/ReaderDirectoryMarkerState';
import {
  READER_BOOKMARK_RIBBON_HEIGHT, READER_BOOKMARK_RIBBON_WIDTH,
  ReaderBookmarkRibbonFrame, ReaderPageBookmarkSnapshot, readerBookmarkHintAlpha,
  readerBookmarkRibbonPull, readerBookmarkRibbonRest,
} from '../presentation/ReaderPageBookmarkModel';
import { ReaderBookmarkPullFeedback, ReaderBookmarkQuietFeedback } from './ReaderBookmarkFeedbackPaint';
import { readerAppearanceChromeTone } from './ReaderAppearanceRenderStyle';
import type { ReaderReadingLayoutSnapshot } from './ReaderLayoutGeometry';
import type { ReaderPageChromeLayoutSnapshot } from './ReaderPageChromeLayout';
import type { ReaderPageGeometryHost } from './ReaderPageGeometryHost';
import type { ReaderPageGestureState } from './ReaderPageGestureState';
import { ReaderPageBookmarkRibbon } from './ReaderPageBookmarkRibbon';

const LOCAL_READING_SOURCE_ID = 'local';

type ReaderBookmarkStatus = 'unknown' | 'empty' | 'bookmarked';
type ReaderBookmarkUnavailableReason = 'busy' | 'unavailable';
export type ReaderBookmarkGestureFinish = 'stale' | 'rebound';

export interface ReaderBookmarkViewport {
  readonly startScalar: number;
  readonly endScalar: number;
}

export interface ReaderBookmarkScope {
  readonly sourceId: string;
  readonly bookId: string;
  readonly lifecycle: number;
  readonly selection: number;
  readonly mounted: boolean;
  readonly exitRequested: boolean;
}

export interface ReaderBookmarkPointer {
  readonly epoch: number;
  readonly inputRevision: number;
}

export interface ReaderBookmarkChrome {
  readonly settings: ReaderSettingsSnapshot;
  readonly bookTitle: string;
  readonly clockText: string;
}

export interface ReaderBookmarkRenderProjection {
  readonly bookmarkPageOffsetY: number;
  readonly bookmarkRibbonFrame: ReaderBookmarkRibbonFrame | undefined;
  readonly bookmarkPullHintOpacity: number;
  readonly bookmarkPreviewChanged: boolean;
  readonly bookmarkPendingTarget: string;
  readonly bookmarkPresentationRevision: number;
}

interface ReaderBookmarkRibbonUpdate {
  readonly value: ReaderBookmarkRibbonFrame | undefined;
}

export interface ReaderBookmarkProjectionUpdate {
  readonly bookmarkPageOffsetY?: number;
  readonly bookmarkRibbonFrame?: ReaderBookmarkRibbonUpdate;
  readonly bookmarkPullHintOpacity?: number;
  readonly bookmarkPreviewChanged?: boolean;
  readonly bookmarkPendingTarget?: string;
  readonly bookmarkPresentationRevision?: number;
}

export interface ReaderBookmarkInteractionPorts {
  readonly scope: () => ReaderBookmarkScope;
  readonly pointer: () => ReaderBookmarkPointer;
  readonly viewport: () => ReaderBookmarkViewport | undefined;
  readonly chapter: () => ReadingSessionChapter | undefined;
  readonly layoutMap: () => ReadingSurfaceLayoutMap | undefined;
  readonly directory: () => LocalReadingTocEntry[];
  readonly recovery: () => ReadingDirectoryRecovery;
  readonly dispatch: (request: ReaderPageBookmarkToggleRequest) => void;
  readonly interactionEnabled: () => boolean;
  readonly canTurnPage: () => boolean;
  readonly tapOnlyInput: () => boolean;
  readonly yieldSpeculativePage: () => void;
  readonly finishGesture: (finish: ReaderBookmarkGestureFinish) => void;
  readonly pageTurnDisplaced: () => boolean;
  readonly uiContext: () => UIContext;
  readonly layout: () => ReaderReadingLayoutSnapshot;
  readonly geometry: () => ReaderPageGeometryHost;
  readonly chrome: () => ReaderBookmarkChrome;
  readonly theme: () => ReaderAppearanceTheme;
  readonly reduceMotion: () => boolean;
  readonly feedbackCurrent: () => boolean;
  readonly projection: () => ReaderBookmarkRenderProjection;
  readonly publishProjection: (update: ReaderBookmarkProjectionUpdate) => void;
  readonly unavailableMessage: () => string;
  readonly publishUnavailableMessage: (message: string) => void;
}

interface ReaderBookmarkGestureTicket {
  readonly anchor: string;
  readonly lifecycle: number;
  readonly selection: number;
  readonly pointer: ReaderBookmarkPointer;
}

/** Holds one admitted pointer segment and its native rebound. A pending write
 * keeps its original page identity through both rebound and Core readback. */
export class ReaderBookmarkInteractionHost {
  private readonly ports: ReaderBookmarkInteractionPorts;
  private readonly transientFeedback: ReaderTransientFeedback;
  private rollbackGeneration: number = 0;
  private rollbackAnimator: AnimatorResult | undefined = undefined;
  private pendingAnchor: string = '';
  private pendingOwner: string = '';
  private mutationGeneration: number = 0;
  private mutationConfirmed: boolean = false;
  private gesture: ReaderBookmarkGestureTicket | undefined = undefined;
  private previewStatus: ReaderBookmarkStatus = 'unknown';
  private previewOwner: string = '';
  private unavailableOwner: string = '';
  private unavailableGeneration: number = 0;
  private unavailableTimer: number = -1;
  private statusEntries: LocalReadingTocEntry[] | undefined = undefined;
  private statusAnchor: string = '';
  private status: ReaderBookmarkStatus = 'unknown';

  constructor(ports: ReaderBookmarkInteractionPorts, transientFeedback: ReaderTransientFeedback) {
    this.ports = ports;
    this.transientFeedback = transientFeedback;
  }

  canStartGesture(): boolean {
    if (!this.writeEnabled()) return false;
    // The reading owner may retire a speculative neighbour, but the
    // visible page and its commit still have to pass every admission gate.
    this.ports.yieldSpeculativePage();
    this.reconcile();
    const anchor = this.feedbackAnchor();
    if (!this.ports.canTurnPage() || !this.ports.interactionEnabled() || this.ports.tapOnlyInput() ||
      anchor.length === 0 || this.pendingAt(anchor)) return false;
    const status = this.currentStatus();
    if (status === 'unknown') return false;
    const scope = this.ports.scope();
    this.gesture = { anchor, lifecycle: scope.lifecycle, selection: scope.selection, pointer: this.ports.pointer() };
    this.previewStatus = status;
    this.previewOwner = this.feedbackOwner();
    this.ports.publishUnavailableMessage('');
    this.unavailableGeneration += 1;
    return true;
  }

  updateGesture(state: ReaderPageGestureState): void {
    if (state.owner !== 'bookmark') return;
    if (!this.gestureCurrent()) return;
    if (state.phase !== 'settling') this.rollbackGeneration += 1;
    const justArmed = state.bookmarkPreviewChanged && !this.ports.projection().bookmarkPreviewChanged;
    this.ports.publishProjection({ bookmarkPageOffsetY: this.ports.reduceMotion() ? 0 : state.bookmarkOffsetY });
    this.ports.publishProjection({ bookmarkRibbonFrame: { value: readerBookmarkRibbonPull(state.bookmarkOffsetY,
      this.previewStatus === 'bookmarked', this.ports.reduceMotion()) } });
    this.ports.publishProjection({ bookmarkPullHintOpacity: readerBookmarkHintAlpha(state.bookmarkOffsetY) });
    this.ports.publishProjection({ bookmarkPreviewChanged: state.bookmarkPreviewChanged });
    if (justArmed && !this.ports.reduceMotion()) {
      try { void vibrator.startVibration({ type: 'time', duration: 10 }, { usage: 'touch' }).catch((): void => {}); }
      catch (_) {}
    }
  }

  releaseGesture(changed: boolean): void {
    const gesture = this.gesture;
    if (gesture === undefined) return;
    // Revalidate the admitted target at UP. Toggling a newer canonical
    // projection would reverse the preview the user actually released.
    const current = this.gestureCurrent() && this.currentStatus() === this.previewStatus;
    const ownsPointerEpoch = this.ownsPointer(gesture);
    this.gesture = undefined;
    if (!current) {
      if (!ownsPointerEpoch) return;
      this.rollbackGeneration += 1;
      this.clearMotion();
      this.ports.finishGesture('stale');
      return;
    }
    if (changed) this.toggle();
    else this.ports.publishProjection({ bookmarkPreviewChanged: false });
    const generation = ++this.rollbackGeneration;
    const owner = this.feedbackOwner();
    const target = readerBookmarkRibbonRest(this.feedbackFilled(), this.ports.reduceMotion());
    if (this.ports.reduceMotion() && changed) {
      // Change only alpha during both reduced-motion insertion and removal.
      this.ports.publishProjection({ bookmarkRibbonFrame: { value: new ReaderBookmarkRibbonFrame(
        target.y, READER_BOOKMARK_RIBBON_HEIGHT,
        this.previewStatus === 'bookmarked' ? this.ports.projection().bookmarkRibbonFrame?.opacity ?? 1 : 0) } });
      target.fillHeight = READER_BOOKMARK_RIBBON_HEIGHT;
    }
    const finish = (): void => {
      if (owner === this.feedbackOwner()) this.finishRollback(generation);
    };
    if (this.ports.reduceMotion()) {
      this.ports.uiContext().animateTo(readerMotionReducedFadeParam(finish), (): void => {
        this.ports.publishProjection({
          bookmarkPageOffsetY: 0,
          bookmarkRibbonFrame: { value: target },
          bookmarkPullHintOpacity: 0,
        });
      });
    } else if (!readerTransitionFrameSamplingEnabled()) {
      this.ports.uiContext().animateTo(motionAnimateParam('reader.bookmark.rollback', finish), (): void => {
        this.ports.publishProjection({
          bookmarkPageOffsetY: 0,
          bookmarkRibbonFrame: { value: target },
          bookmarkPullHintOpacity: 0,
        });
      });
    } else {
      this.animateRollback(generation, finish, target);
    }
  }

  private gestureCurrent(): boolean {
    const scope = this.ports.scope();
    const gesture = this.gesture;
    return scope.mounted && !scope.exitRequested && gesture !== undefined &&
      gesture.anchor === this.feedbackAnchor() && gesture.lifecycle === scope.lifecycle &&
      gesture.selection === scope.selection && this.ownsPointer(gesture) &&
      this.ports.interactionEnabled() && !this.ports.tapOnlyInput() && this.ports.canTurnPage();
  }

  private ownsPointer(gesture: ReaderBookmarkGestureTicket): boolean {
    const pointer = this.ports.pointer();
    return gesture.pointer.epoch === pointer.epoch && gesture.pointer.inputRevision === pointer.inputRevision;
  }

  private animateRollback(generation: number, finish: () => void, target: ReaderBookmarkRibbonFrame): void {
    const projection = this.ports.projection();
    const offset = projection.bookmarkPageOffsetY;
    const ribbon = projection.bookmarkRibbonFrame ?? target;
    const curve = readerMotionStandardCurve();
    const hintOpacity = projection.bookmarkPullHintOpacity;
    // The returning paper, the clip and the ribbon sample one curve.
    try {
      const animator = this.ports.uiContext().createAnimator({
        duration: motionAnimateParam('reader.bookmark.rollback').duration ?? 0,
        easing: 'linear', delay: 0, fill: 'forwards', direction: 'normal', iterations: 1, begin: 0, end: 1,
      });
      this.rollbackAnimator = animator;
      animator.onFrame = (fraction: number): void => {
        if (!this.ports.scope().mounted || this.rollbackAnimator !== animator ||
          generation !== this.rollbackGeneration || this.ports.reduceMotion()) {
          // ArkUI cancellation can deliver a terminal frame synchronously.
          animator.onFrame = (_value: number): void => {};
          animator.cancel();
          return;
        }
        const remaining = 1 - curve.interpolate(Math.max(0, Math.min(1, fraction)));
        this.ports.publishProjection({
          bookmarkPageOffsetY: offset * remaining,
          bookmarkRibbonFrame: { value: new ReaderBookmarkRibbonFrame(
            target.y + (ribbon.y - target.y) * remaining,
            target.fillHeight + (ribbon.fillHeight - target.fillHeight) * remaining,
            target.opacity + (ribbon.opacity - target.opacity) * remaining) },
          bookmarkPullHintOpacity: hintOpacity * remaining,
        });
      };
      const complete = (): void => {
        if (this.rollbackAnimator !== animator) return;
        this.rollbackAnimator = undefined;
        finish();
      };
      animator.onFinish = complete;
      animator.onCancel = complete;
      animator.play();
    } catch (_) {
      this.rollbackAnimator = undefined;
      finish();
    }
  }

  private finishRollback(generation: number): void {
    if (generation !== this.rollbackGeneration || !this.ports.scope().mounted) return;
    this.gesture = undefined;
    this.clearMotion();
    this.reconcile();
    this.ports.finishGesture('rebound');
  }

  private clearMotion(): void {
    this.ports.publishProjection({ bookmarkPageOffsetY: 0 });
    this.ports.publishProjection({ bookmarkRibbonFrame: { value: undefined } });
    this.ports.publishProjection({ bookmarkPullHintOpacity: 0 });
    this.ports.publishProjection({ bookmarkPreviewChanged: false });
  }

  background(): void {
    this.finishRollback(this.rollbackGeneration);
    this.rollbackGeneration += 1;
  }

  invalidatePageTurn(): void {
    this.rollbackGeneration += 1;
    this.gesture = undefined;
    this.ports.publishUnavailableMessage('');
    this.unavailableGeneration += 1;
  }

  interruptPageTurnGesture(): void {
    this.rollbackGeneration += 1;
    const animator = this.rollbackAnimator;
    this.rollbackAnimator = undefined;
    if (animator !== undefined) {
      try {
        animator.onFrame = (_value: number): void => {};
        animator.cancel();
      } catch (_) {}
    }
    this.gesture = undefined;
    this.clearMotion();
  }

  clearPageTurnPreview(): void {
    this.clearMotion();
    if (this.mutationConfirmed) this.reconcile();
  }

  retire(): void {
    this.rollbackGeneration += 1;
    this.mutationGeneration += 1;
    this.gesture = undefined;
    this.unavailableGeneration += 1;
    if (this.unavailableTimer >= 0) clearTimeout(this.unavailableTimer);
    this.unavailableTimer = -1;
    this.ports.publishUnavailableMessage('');
    this.ports.publishProjection({ bookmarkPendingTarget: '' });
  }

  onDirectoryChanged(): void {
    this.reconcile();
    this.bumpPresentationRevision();
  }

  private bumpPresentationRevision(): void {
    this.ports.publishProjection({ bookmarkPresentationRevision: this.ports.projection().bookmarkPresentationRevision + 1 });
  }

  private chapterIndex(): number {
    return this.ports.chapter()?.chapterIndex ?? -1;
  }

  private writeEnabled(): boolean {
    return this.ports.recovery().bookmarkWriteEnabled === true;
  }

  matchesCurrentChapter(mark: LocalReadingBookmark): boolean {
    if (this.ports.scope().sourceId === LOCAL_READING_SOURCE_ID) return true;
    const chapter = this.ports.chapter();
    const scope = mark.positionScope;
    return chapter !== undefined && scope !== undefined &&
      scope.sourceId === chapter.sourceId && scope.bookId === chapter.bookId &&
      scope.chapterIndex === chapter.chapterIndex && mark.chapterIndex === chapter.chapterIndex &&
      scope.bodyVersion === chapter.bodyVersion && scope.processingVersion === chapter.processingVersion;
  }

  controlStatus(_revision: number): ReaderBookmarkStatus {
    return this.currentStatus();
  }

  controlEnabled(revision: number): boolean {
    const anchor = this.feedbackAnchor();
    return anchor.length > 0 && this.writeEnabled() && this.controlStatus(revision) !== 'unknown' && !this.pendingAt(anchor);
  }

  private currentStatus(): ReaderBookmarkStatus {
    const page = this.ports.viewport();
    if (page === undefined) return 'unknown';
    const entries = this.ports.directory();
    const chapter = this.ports.chapter();
    const anchor = `${this.chapterIndex()}:${chapter?.contentVersion}:${chapter?.bodyVersion}:${chapter?.processingVersion}:${page.startScalar}:${page.endScalar}`;
    if (entries === this.statusEntries && anchor === this.statusAnchor) return this.status;
    this.statusEntries = entries;
    this.statusAnchor = anchor;
    const entry = entries.find((candidate: LocalReadingTocEntry): boolean => candidate.index === this.chapterIndex());
    this.status = entry?.bookmarks === undefined ? 'unknown' : 'empty';
    if (entry?.bookmarks === undefined) return this.status;
    for (const bookmark of entry.bookmarks) {
      if (this.matchesCurrentChapter(bookmark) && this.containsOffset(page, bookmark.chapterOffset)) {
        this.status = 'bookmarked';
        break;
      }
    }
    return this.status;
  }

  private containsOffset(page: ReaderBookmarkViewport, offset: number): boolean {
    return page.endScalar > page.startScalar ? offset >= page.startScalar && offset < page.endScalar : offset === page.startScalar;
  }

  private feedbackAnchor(): string {
    const page = this.ports.viewport();
    if (page === undefined) return '';
    const scope = this.ports.scope();
    const chapter = this.ports.chapter();
    return `${scope.sourceId}:${scope.bookId}:${this.chapterIndex()}:${chapter?.contentVersion}:${chapter?.bodyVersion}:${chapter?.processingVersion}:${page.startScalar}:${page.endScalar}`;
  }

  private feedbackOwner(): string {
    const scope = this.ports.scope();
    return JSON.stringify([scope.lifecycle, scope.selection, this.feedbackAnchor()]);
  }

  private pendingAt(anchor: string): boolean {
    return this.ports.projection().bookmarkPendingTarget.length > 0 && this.pendingAnchor === anchor;
  }

  feedbackFilled(): boolean {
    const target = this.ports.projection().bookmarkPendingTarget;
    if (target.length > 0 && this.pendingAnchor === this.feedbackAnchor() && this.pendingOwner === this.feedbackOwner()) {
      return target === 'bookmarked';
    }
    if (this.gesture !== undefined && this.previewOwner === this.feedbackOwner()) {
      const bookmarked = this.previewStatus === 'bookmarked';
      return this.ports.projection().bookmarkPreviewChanged ? !bookmarked : bookmarked;
    }
    return this.currentStatus() === 'bookmarked';
  }

  feedbackMode(_renderRevision: number): 'hidden' | 'filled' | 'outline' {
    // Paged slots consume the revision of the atomically published page.
    return this.feedbackFilled() ? 'filled' : 'hidden';
  }

  feedbackOpacity(): number {
    return this.feedbackFilled() ? 1 : 0;
  }

  ribbonFrame(_renderRevision: number): ReaderBookmarkRibbonFrame | undefined {
    const projection = this.ports.projection();
    const frame = projection.bookmarkRibbonFrame;
    if (frame === undefined || this.previewOwner !== this.feedbackOwner()) return undefined;
    return this.ports.reduceMotion() && projection.bookmarkPageOffsetY > 0 ?
      readerBookmarkRibbonPull(projection.bookmarkPageOffsetY, this.previewStatus === 'bookmarked', true) : frame;
  }

  snapshotCurrent(renderRevision: number): ReaderPageBookmarkSnapshot {
    const layout = this.cornerLayout();
    return new ReaderPageBookmarkSnapshot(this.feedbackMode(renderRevision), this.feedbackOpacity(),
      this.ports.geometry().bookmarkRibbonX(layout), this.ribbonPaperTop(this.ports.layout()),
      READER_BOOKMARK_RIBBON_WIDTH, READER_BOOKMARK_RIBBON_HEIGHT);
  }

  snapshotPrepared(chapterIndex: number, sourceId: string, bookId: string, bodyVersion: string | undefined,
    processingVersion: string | undefined, startScalar: number, endScalar: number): ReaderPageBookmarkSnapshot {
    const layout = this.cornerLayout();
    const status = this.statusFor(chapterIndex, sourceId, bookId, bodyVersion, processingVersion, startScalar, endScalar);
    return new ReaderPageBookmarkSnapshot(status === 'bookmarked' ? 'filled' : 'hidden', status === 'bookmarked' ? 1 : 0,
      this.ports.geometry().bookmarkRibbonX(layout), this.ribbonPaperTop(this.ports.layout()),
      READER_BOOKMARK_RIBBON_WIDTH, READER_BOOKMARK_RIBBON_HEIGHT);
  }

  private statusFor(chapterIndex: number, sourceId: string, bookId: string, bodyVersion: string | undefined,
    processingVersion: string | undefined, startScalar: number, endScalar: number): ReaderBookmarkStatus {
    const entry = this.ports.directory().find((candidate: LocalReadingTocEntry): boolean => candidate.index === chapterIndex);
    if (entry?.bookmarks === undefined) return 'unknown';
    for (const mark of entry.bookmarks) {
      if (mark.chapterIndex !== chapterIndex) continue;
      const scope = mark.positionScope;
      if (sourceId !== LOCAL_READING_SOURCE_ID && (scope === undefined || scope.sourceId !== sourceId ||
        scope.bookId !== bookId || scope.chapterIndex !== chapterIndex ||
        scope.bodyVersion !== bodyVersion || scope.processingVersion !== processingVersion)) continue;
      const inside = endScalar > startScalar ?
        mark.chapterOffset >= startScalar && mark.chapterOffset < endScalar : mark.chapterOffset === startScalar;
      if (inside) return 'bookmarked';
    }
    return 'empty';
  }

  private reconcile(): void {
    const target = this.ports.projection().bookmarkPendingTarget;
    if (target.length === 0) return;
    if (this.pendingAnchor !== this.feedbackAnchor() || this.pendingOwner !== this.feedbackOwner()) {
      this.mutationGeneration += 1;
      this.clearPending();
      return;
    }
    if (this.mutationConfirmed && !this.ports.projection().bookmarkPreviewChanged && this.currentStatus() === target) {
      // Keep the released target through rebound. Applying the drag preview
      // again after canonical readback would invert the target twice.
      this.clearPending();
    }
  }

  private clearPending(): void {
    this.ports.publishProjection({ bookmarkPendingTarget: '' });
    this.mutationConfirmed = false;
  }

  toggle(): void {
    if (!this.writeEnabled()) { this.gestureUnavailable('unavailable'); return; }
    const page = this.ports.viewport();
    const chapterIndex = this.chapterIndex();
    if (page === undefined || chapterIndex < 0) return;
    const currentEntry = this.ports.directory().find((entry: LocalReadingTocEntry): boolean => entry.index === chapterIndex);
    // An unadmitted Core projection is not evidence the page is unbookmarked.
    if (currentEntry?.bookmarks === undefined) return;
    const bookmarkTimes: number[] = [];
    for (const bookmark of currentEntry.bookmarks) {
      if (this.matchesCurrentChapter(bookmark) && this.containsOffset(page, bookmark.chapterOffset) &&
        Number.isSafeInteger(bookmark.time)) bookmarkTimes.push(bookmark.time);
    }
    const anchor = this.feedbackAnchor();
    if (this.pendingAt(anchor)) return;
    const generation = ++this.mutationGeneration;
    const origin = this.ports.scope();
    this.pendingAnchor = anchor;
    this.pendingOwner = this.feedbackOwner();
    this.mutationConfirmed = false;
    this.ports.publishProjection({ bookmarkPendingTarget: bookmarkTimes.length > 0 ? 'empty' : 'bookmarked' });
    this.bumpPresentationRevision();
    const bookText = this.bookmarkText();
    const chapter = this.ports.chapter();
    const scope = this.ports.scope();
    this.ports.dispatch({
      chapterIndex,
      chapterOffset: page.startScalar,
      chapterTitle: currentEntry.title,
      bookmarkTimes,
      bookText,
      positionScope: chapter?.bodyVersion !== undefined && chapter.processingVersion !== undefined ?
        { sourceId: scope.sourceId, bookId: scope.bookId, chapterIndex,
          bodyVersion: chapter.bodyVersion, processingVersion: chapter.processingVersion } : undefined,
      onSettled: (success: boolean): void => {
        if (generation !== this.mutationGeneration || !this.ports.scope().mounted) return;
        const live = this.ports.scope();
        if (origin.lifecycle !== live.lifecycle || origin.selection !== live.selection || anchor !== this.feedbackAnchor()) {
          // Retire only this request so a stale ACK cannot paint a new
          // page or leave the origin locked when it is revisited.
          if (this.pendingAnchor === anchor) this.clearPending();
          return;
        }
        this.mutationConfirmed = success;
        if (!success) {
          this.ports.publishProjection({ bookmarkPendingTarget: '' });
          this.ports.publishProjection({ bookmarkPreviewChanged: false });
        }
        this.bumpPresentationRevision();
        this.reconcile();
      },
    });
  }

  private bookmarkText(): string {
    const page = this.ports.viewport();
    const chapter = this.ports.chapter();
    const map = this.ports.layoutMap();
    if (page === undefined || chapter === undefined || map === undefined) return '';
    return chapter.content.substring(map.utf16ForScalar(page.startScalar),
      map.utf16ForScalar(Math.min(page.endScalar, page.startScalar + 160)));
  }

  gestureUnavailable(reason: ReaderBookmarkUnavailableReason): void {
    if (!this.ports.interactionEnabled()) return;
    const anchor = this.feedbackAnchor();
    const message = this.unavailableText(reason, anchor);
    const generation = ++this.unavailableGeneration;
    if (this.unavailableTimer >= 0) clearTimeout(this.unavailableTimer);
    this.unavailableTimer = -1;
    const owner = this.feedbackOwner();
    this.unavailableOwner = owner;
    this.cornerLayout();
    // The arena invokes this once per physical segment. Rejected gestures
    // stay in the quiet whitespace slot when it fits.
    if (!this.ports.geometry().bookmarkUnavailableHintFits()) {
      this.ports.publishUnavailableMessage('');
      try {
        this.transientFeedback.show(this.ports.uiContext, { message }, (): boolean =>
          this.ports.feedbackCurrent() && generation === this.unavailableGeneration && owner === this.feedbackOwner());
      } catch (_) {}
      return;
    }
    this.ports.publishUnavailableMessage(message);
    this.unavailableTimer = setTimeout((): void => {
      if (generation !== this.unavailableGeneration || !this.ports.scope().mounted) return;
      this.unavailableTimer = -1;
      // Expire the old text even after navigating away from its page.
      if (owner === this.unavailableOwner) this.ports.publishUnavailableMessage('');
    }, 1600);
  }

  private unavailableText(reason: ReaderBookmarkUnavailableReason, anchor: string): string {
    if (reason === 'busy') return '页面切换中，请稍后下拉';
    if (this.pendingAt(anchor)) return '书签正在保存，请稍后再试';
    if (!this.writeEnabled()) {
      const recovery = this.ports.recovery();
      return recovery.bookmarkWriteBlockReason ?? (recovery.bookmarks.visible ?
        '原书签操作待核对，请在“更多 → 待处理事项”中核对原记录' : '书签状态尚未就绪，请稍后重试');
    }
    return this.currentStatus() === 'unknown' ? '书签尚未加载，请稍后下拉' : '页面尚未就绪，请稍后下拉';
  }

  hintLabel(): string {
    return this.ports.projection().bookmarkPreviewChanged ? (this.previewStatus === 'bookmarked' ?
      '松手移除本页书签' : '松手添加书签') :
      this.previewStatus === 'bookmarked' ? '下拉移除本页书签' : '下拉添加书签';
  }

  unavailableCurrent(_renderRevision: number): boolean {
    return this.ports.unavailableMessage().length > 0 && this.unavailableOwner === this.feedbackOwner();
  }

  hintAlpha(renderRevision: number): number {
    const alpha = this.ports.projection().bookmarkPullHintOpacity;
    if (this.unavailableCurrent(renderRevision)) return 1;
    return this.previewOwner === this.feedbackOwner() ? alpha : 0;
  }

  pullOffset(): number {
    if (this.ports.reduceMotion()) return 0;
    const offset = this.ports.projection().bookmarkPageOffsetY;
    return offset > 0.5 && !this.ports.pageTurnDisplaced() ? offset : 0;
  }

  pullPaperTop(): number {
    const layout = this.ports.layout();
    const metrics = layout.pageChromeStatusMetrics;
    const cutout = metrics?.statusBarCutoutRect;
    // Full-width paper must clear the bottom of a cutout beside the ribbon.
    return Math.max(this.ribbonPaperTop(layout), metrics?.cutoutInsets.top ?? 0,
      cutout !== undefined && cutout.height > 0 ? cutout.top + cutout.height : 0);
  }

  private ribbonPaperTop(layout: ReaderReadingLayoutSnapshot): number {
    return this.ports.geometry().bookmarkRibbonPaperTop(layout, this.ports.chrome().settings.hideStatusBar === true);
  }

  private cornerLayout(): ReaderPageChromeLayoutSnapshot {
    const layout = this.ports.layout();
    const context = this.ports.uiContext();
    const chrome = this.ports.chrome();
    return this.ports.geometry().bookmarkCornerLayout(layout, context, chrome.bookTitle, chrome.clockText, chrome.settings);
  }

  continuousMarkerX(): number {
    return this.ports.geometry().bookmarkRibbonX(this.cornerLayout());
  }

  continuousMarkerTop(): number {
    return this.ribbonPaperTop(this.ports.layout());
  }

  continuousMarkerFrame(renderRevision: number): ReaderBookmarkRibbonFrame {
    return this.ribbonFrame(renderRevision) ?? readerBookmarkRibbonRest(this.feedbackFilled());
  }

  markerNight(): boolean {
    return readerAppearanceChromeTone(this.ports.theme()) === 'light';
  }

  feedbackTheme(): ReaderThemeDefinition {
    return readerThemeDefinition(this.ports.theme());
  }

  pullHintInk(): string {
    const theme = this.feedbackTheme();
    return this.ports.projection().bookmarkPreviewChanged ?
      readerAppColor(this.previewStatus === 'bookmarked' ? 'TOK_ACCENT' : 'TOK_READ_PRIMARY', theme.scheme) : theme.chromeMeta;
  }

  quietHintText(renderRevision: number): string {
    return this.unavailableCurrent(renderRevision) ? this.ports.unavailableMessage() : this.hintLabel();
  }

  hintGeometry(): ReaderPageGeometryHost {
    return this.ports.geometry();
  }
}

export interface ReaderBookmarkCornerFeedbackInput {
  readonly paperWell: boolean;
  readonly visible: boolean;
  readonly continuous: boolean;
  readonly reducedMotion: boolean;
  readonly revision: number;
  readonly host: ReaderBookmarkInteractionHost;
}

@Builder
export function ReaderBookmarkCornerFeedback($$: ReaderBookmarkCornerFeedbackInput) {
  if (!$$.paperWell && $$.visible && $$.continuous) {
    // Paged slots own their own ribbons; the continuous List uses this marker.
    ReaderPageBookmarkRibbon({
      x: $$.host.continuousMarkerX(),
      paperTop: $$.host.continuousMarkerTop(),
      offsetY: $$.host.continuousMarkerFrame($$.revision).y,
      fillHeight: $$.host.continuousMarkerFrame($$.revision).fillHeight,
      alpha: $$.host.continuousMarkerFrame($$.revision).opacity,
      bookmarked: $$.host.feedbackFilled(),
      night: $$.host.markerNight(),
    });
  }
  if ($$.paperWell && $$.visible && !$$.host.unavailableCurrent($$.revision)) {
    ReaderBookmarkPullFeedback({
      alpha: $$.host.hintAlpha($$.revision),
      text: $$.host.hintLabel(),
      ink: $$.host.pullHintInk(),
      offset: $$.host.pullOffset(),
      paperTop: $$.host.pullPaperTop(),
      day: $$.host.feedbackTheme().scheme === 'day',
    });
  }
  // Reduced-motion alpha interpolation needs this node to remain mounted.
  if (!$$.paperWell && $$.visible && ($$.reducedMotion || $$.host.unavailableCurrent($$.revision))) {
    ReaderBookmarkQuietFeedback({
      text: $$.host.quietHintText($$.revision),
      ink: $$.host.feedbackTheme().chromeMeta,
      width: $$.host.hintGeometry().bookmarkHintWidth,
      height: $$.host.hintGeometry().bookmarkHintHeight,
      x: $$.host.hintGeometry().bookmarkHintX,
      y: $$.host.hintGeometry().bookmarkHintY,
      alpha: $$.host.hintAlpha($$.revision),
    });
  }
}
