import type { ReadingSessionChapter } from '../application/ReadingChapterWindow';
import { normalizeReadingProgressRatio } from '../application/ReadingChapterOpening';
import type { LocalReadingContentMetrics, LocalReadingTocEntry } from '../application/LocalReadingFlowGateway';
import type { ReaderAppearanceSnapshot } from '../application/ReaderAppearanceState';
import { formatReaderPageClock } from '../application/ReaderPageClock';
import type { ReadingPaginationKey, ReadingPaginationPrefix } from '../application/ReadingPaginationIndex';
import { ReaderPageChromeSnapshot, ReaderPageOrdinal, formatReaderPageProgress } from '../presentation/ReaderPageChromeModel';
import type { PreparedReaderPageTurn, ReaderMaterializedChapterContext } from '../presentation/ReaderPagePresentationModels';
import type { ReaderBookmarkInteractionHost } from './ReaderBookmarkInteractionHost';
import { READER_CONTROL_PROGRESS_MAX, READER_CONTROL_PROGRESS_MIN } from './ReaderControlGeometry';
import { ReaderFacingChapterPreview, type ReaderFacingChapter } from './ReaderFacingChapterPreview';
import type { ReaderReadingLayoutSnapshot } from './ReaderLayoutGeometry';
import type { ReaderMeasuredPagePublication } from './ReaderMeasuredPagePublication';
import type { PhysicalReadingPage } from './ReadingMeasurementModels';
import { readerPageBottomJustifyGap } from './ReaderPageBottomJustify';
import type { ReaderPageTurnDirection } from './ReaderPageGestureState';
import { readerPageSurfaceIdentity, readerPageTextureIdentity } from './ReaderPageTurnIdentities';
import type { ReaderPageTurnSettlementHost } from './ReaderPageTurnSettlementHost';
import { ReaderPageTurnRenderPage } from './ReaderPageTurnStage';
import type { ReadingChromeRenderSnapshot, ReadingPageTurnRenderSnapshot } from './ReaderReadingSurfaceHost';

export interface ReaderRetainedChapterFrame {
  readonly renderPage: ReaderPageTurnRenderPage;
  readonly page: PhysicalReadingPage;
  readonly context: ReaderMaterializedChapterContext;
  readonly continuousChrome?: ReaderPageChromeSnapshot;
}

export interface ReaderPageChromeDocument {
  readonly measured: () => ReaderMeasuredPagePublication;
  readonly preparedOrigin: () => ReaderMaterializedChapterContext | undefined;
  readonly retained: () => ReaderRetainedChapterFrame | undefined;
  readonly captureMaterialized: () => ReaderMaterializedChapterContext;
  readonly preparedIsFresh: (prepared: PreparedReaderPageTurn) => boolean;
  readonly catalogPending: () => boolean;
  readonly catalogCount: () => number | undefined;
  readonly toc: () => LocalReadingTocEntry[];
  readonly tocEntryAt: (chapterIndex: number) => LocalReadingTocEntry | undefined;
  readonly readablePosition: (chapterIndex: number) => number;
  readonly adjacentChapter: (chapterIndex: number) => number | undefined;
  readonly chapterInWindow: (chapterIndex: number) => ReadingSessionChapter | undefined;
  readonly metrics: () => LocalReadingContentMetrics | undefined;
  readonly metricsPercent: (metrics: LocalReadingContentMetrics, chapterIndex: number, scalar: number) => number;
}

export interface ReaderPageChromeView {
  readonly sourceId: () => string;
  readonly bookId: () => string;
  readonly bookTitle: () => string;
  readonly sessionActive: (lifecycle: number) => boolean;
  readonly settlement: () => ReaderPageTurnSettlementHost;
  readonly bookmark: () => ReaderBookmarkInteractionHost;
  readonly chrome: () => ReadingChromeRenderSnapshot;
  readonly projection: () => ReadingPageTurnRenderSnapshot;
  readonly layout: () => ReaderReadingLayoutSnapshot;
  readonly layoutSignature: () => string;
  readonly visibleAppearance: () => ReaderAppearanceSnapshot;
  readonly appearanceAtPage: (page: PhysicalReadingPage) => ReaderAppearanceSnapshot;
  readonly continuousChrome: () => ReaderPageChromeSnapshot | undefined;
  readonly launchInProgress: () => boolean;
  readonly capsuleVisible: () => boolean;
  readonly capsuleWidth: () => number;
  readonly capsuleHeight: () => number;
}

export interface ReaderPageChromeEffects {
  readonly publishClock: (text: string) => void;
  readonly advanceRenderRevision: () => void;
  readonly scheduleTextures: () => void;
  readonly flushReadingImagePixels: () => void;
  readonly clearCapsuleFreeze: () => void;
  readonly flushCapsuleMeasurement: () => void;
}

/** Keeps the page-owned title/footer and drawing identities on the same
 * admitted frame. A retained chapter and a frozen turn can both outlive the
 * current measurement, but neither can change the durable page position. */
export class ReaderReadingPageChromeHost {
  private readonly document: ReaderPageChromeDocument;
  private readonly view: ReaderPageChromeView;
  private readonly effects: ReaderPageChromeEffects;
  private readonly facingPreview: ReaderFacingChapterPreview = new ReaderFacingChapterPreview();
  private clockTimer: number = -1;
  private pendingClockText: string | undefined = undefined;

  constructor(document: ReaderPageChromeDocument, view: ReaderPageChromeView, effects: ReaderPageChromeEffects) {
    this.document = document;
    this.view = view;
    this.effects = effects;
  }

  captureRetained(): ReaderRetainedChapterFrame | undefined {
    const measured = this.document.measured();
    const page = measured.page;
    if (page === undefined || this.view.projection().visibleFragments.length === 0) return undefined;
    const preparedOrigin = this.document.preparedOrigin() ?? measured.previousChapterMeasurement?.origin;
    const materialized = measured.chapter !== undefined && measured.chapterLayoutMap !== undefined &&
      measured.materializedChapterSelectionToken === measured.selection;
    const context = preparedOrigin ?? (materialized ? this.document.captureMaterialized() : undefined);
    if (context === undefined) return undefined;
    const continuousChrome = this.view.continuousChrome();
    return { renderPage: this.currentPage(), page, context, continuousChrome };
  }

  currentPage(): ReaderPageTurnRenderPage {
    const retained = this.document.retained();
    if (retained !== undefined) return retained.renderPage;
    const frozen = this.view.settlement().pageTurn.frozen(this.view.projection().pageTurnRenderRevision);
    if (frozen !== undefined) return frozen.current;
    const revision = this.view.projection().pageTurnRenderRevision;
    const origin = this.document.preparedOrigin();
    const measured = this.document.measured();
    const chapterIndex = origin?.chapter.chapterIndex ?? measured.chapter?.chapterIndex ?? -1;
    const pageStart = measured.page?.startScalar ?? -1;
    const contentVersion = origin?.contentVersion ?? measured.materializedContentVersion;
    const scalarCount = origin?.layoutMap.scalarCount() ?? measured.chapterLayoutMap?.scalarCount() ?? 0;
    const key = this.paginationKey(chapterIndex, contentVersion);
    const chrome = this.snapshot(chapterIndex, pageStart, scalarCount);
    const bottomJustifyGap = measured.page === undefined ? 0 : this.bottomJustifyGap(measured.page);
    const bookmark = this.view.bookmark().snapshotCurrent(this.view.projection().pageTurnRenderRevision);
    const facingChapter = this.facingChapter(chapterIndex);
    const layoutSignature = key?.layoutSignature ?? '';
    const textureIdentity = readerPageTextureIdentity(this.view.sourceId(), this.view.bookId(),
      this.view.chrome().appearanceSnapshot.activeTheme, this.view.chrome().readerSettingsSnapshot.hideStatusBar === true,
      this.view.launchInProgress(), chapterIndex, pageStart, contentVersion, layoutSignature,
      bottomJustifyGap, chrome, bookmark.mode, facingChapter?.identity);
    return new ReaderPageTurnRenderPage(
      readerPageSurfaceIdentity(this.view.sourceId(), this.view.bookId(), this.view.chrome().appearanceSnapshot.activeTheme,
        'current', chapterIndex, pageStart, contentVersion, layoutSignature),
      textureIdentity, revision, origin?.chapter.chapterTitle ?? measured.chapter?.chapterTitle ?? this.view.chrome().chapterTitle,
      this.view.chrome().showChapterTitle, this.view.projection().visibleFragments, bottomJustifyGap, chrome,
      this.view.visibleAppearance(), bookmark, facingChapter, chapterIndex);
  }

  preparedPage(direction: ReaderPageTurnDirection): ReaderPageTurnRenderPage | undefined {
    const turn = this.view.settlement().pageTurn;
    const frozen = turn.frozen(this.view.projection().pageTurnRenderRevision);
    if (frozen !== undefined) return direction === 'previous' ? frozen.previous : frozen.next;
    const revision = this.view.projection().pageTurnRenderRevision;
    const prepared = turn.neighbour(direction);
    if (prepared === undefined || !this.document.preparedIsFresh(prepared)) return undefined;
    const ranges = prepared.context.paragraphRanges;
    const chapter = prepared.context.chapter;
    const page = prepared.page;
    const key = prepared.key;
    const showTitle = (chapter.documentRange?.startScalar ?? 0) === 0 && ranges.length > 0 && page.startScalar === ranges[0].startScalar;
    const bottomJustifyGap = this.bottomJustifyGap(page);
    const chrome = this.snapshot(key.chapterIndex, page.startScalar, prepared.context.layoutMap.scalarCount());
    const bookmark = this.view.bookmark().snapshotPrepared(key.chapterIndex, chapter.sourceId, chapter.bookId,
      chapter.bodyVersion, chapter.processingVersion, page.startScalar, page.endScalar);
    const facingChapter = this.facingChapter(key.chapterIndex);
    const textureIdentity = readerPageTextureIdentity(this.view.sourceId(), this.view.bookId(),
      this.view.chrome().appearanceSnapshot.activeTheme, this.view.chrome().readerSettingsSnapshot.hideStatusBar === true,
      this.view.launchInProgress(), key.chapterIndex, page.startScalar, key.contentVersion, key.layoutSignature,
      bottomJustifyGap, chrome, bookmark.mode, facingChapter?.identity);
    return new ReaderPageTurnRenderPage(
      readerPageSurfaceIdentity(this.view.sourceId(), this.view.bookId(), this.view.chrome().appearanceSnapshot.activeTheme,
        direction, key.chapterIndex, page.startScalar, key.contentVersion, key.layoutSignature),
      textureIdentity, revision, chapter.chapterTitle, showTitle, page.fragments, bottomJustifyGap, chrome,
      this.view.appearanceAtPage(page), bookmark, facingChapter, key.chapterIndex);
  }

  currentFacing(_renderRevision: number): ReaderFacingChapter | undefined {
    const retained = this.document.retained();
    if (retained !== undefined) return retained.renderPage.facingChapter;
    return this.facingChapter(this.document.measured().chapter?.chapterIndex ?? -1);
  }

  private facingChapter(chapterIndex: number): ReaderFacingChapter | undefined {
    if (this.view.layout().facingChapterWidth <= 0 || chapterIndex < 0) return undefined;
    const nextIndex = this.document.adjacentChapter(chapterIndex);
    if (nextIndex === undefined) return undefined;
    return this.facingPreview.current(this.view.sourceId(), this.view.bookId(), nextIndex,
      this.document.chapterInWindow(nextIndex), (): LocalReadingTocEntry | undefined => this.document.tocEntryAt(nextIndex));
  }

  private bottomJustifyGap(page: PhysicalReadingPage): number {
    const last = page.fragments[page.fragments.length - 1];
    return readerPageBottomJustifyGap(this.view.chrome().readerSettingsSnapshot.alignPageBottom, page.fragments.length,
      page.contentHeight, page.bodyCapacity, last?.layoutHeight ?? 0, (last?.imageHeight ?? 0) > 0);
  }

  /** Core supplies exact processed-scalar totals for local books. Remote
   * percentages use the admitted readable TOC and one chapter's progress. */
  controlProgress(): number {
    const metrics = this.document.metrics();
    const measured = this.document.measured();
    if (metrics !== undefined) {
      return this.document.metricsPercent(metrics, measured.chapter?.chapterIndex ?? -1, measured.desiredChapterOffset);
    }
    if (this.document.catalogPending() && this.document.catalogCount() === undefined) return 0;
    const count = this.document.catalogCount() ?? this.document.toc().length;
    if (count === 0) return 0;
    const position = this.document.readablePosition(measured.chapter?.chapterIndex ?? -1);
    if (position < 0) return 0;
    return Math.max(READER_CONTROL_PROGRESS_MIN, Math.min(READER_CONTROL_PROGRESS_MAX,
      ((position + normalizeReadingProgressRatio(measured.desiredChapterProgress)) / count) * READER_CONTROL_PROGRESS_MAX));
  }

  currentBodyChrome(): ReaderPageChromeSnapshot {
    const measured = this.document.measured();
    const chapter = measured.chapter;
    const chapterIndex = chapter?.chapterIndex ?? -1;
    // The launch refresh follows the same layout read as the page stage.
    this.paginationKey(chapterIndex, measured.materializedContentVersion);
    return this.snapshot(chapterIndex, measured.page?.startScalar ?? -1, measured.chapterLayoutMap?.scalarCount() ?? 0);
  }

  /** Keep the rendered page's actual scalar anchor independent from the
   * control slider's desired destination. */
  snapshot(chapterIndex: number, pageStartScalar: number, chapterScalarCount: number): ReaderPageChromeSnapshot {
    const sessionVisible = this.view.capsuleVisible();
    const title = this.chapterTitle(chapterIndex);
    return new ReaderPageChromeSnapshot(
      this.view.bookTitle(), this.view.chrome().pageChromeClockText, title.length > 0 ? title : '—',
      this.document.catalogPending() && this.document.catalogCount() === undefined && this.document.metrics() === undefined ?
        '—' : formatReaderPageProgress(this.progress(chapterIndex, pageStartScalar, chapterScalarCount)),
      sessionVisible, sessionVisible ? this.view.capsuleWidth() : 0, sessionVisible ? this.view.capsuleHeight() : 0);
  }

  private chapterTitle(chapterIndex: number): string {
    const measured = this.document.measured();
    const chapter = measured.chapter;
    if (chapter !== undefined && chapter.chapterIndex === chapterIndex && chapter.chapterTitle.length > 0) return chapter.chapterTitle;
    const entry = this.document.toc().find((candidate: LocalReadingTocEntry): boolean => candidate.index === chapterIndex);
    if (entry?.title !== undefined && entry.title.length > 0) return entry.title;
    return measured.chapter !== undefined && measured.chapter.chapterIndex === chapterIndex ? this.view.chrome().chapterTitle : '';
  }

  private paginationKey(chapterIndex: number, contentVersion: string): ReadingPaginationKey | undefined {
    if (!Number.isSafeInteger(chapterIndex) || chapterIndex < 0 || contentVersion.length === 0) return undefined;
    return { sourceId: this.view.sourceId(), bookId: this.view.bookId(), chapterIndex,
      layoutSignature: this.view.layoutSignature(), contentVersion };
  }

  private pageChromeOrdinal(key: ReadingPaginationKey | undefined, pageStartScalar: number,
    prefix: ReadingPaginationPrefix | undefined): ReaderPageOrdinal | undefined {
    if (key === undefined || !Number.isSafeInteger(pageStartScalar) || pageStartScalar < 0) return undefined;
    if (prefix?.matches(key) === true && prefix.observationForPageStart(pageStartScalar) !== undefined &&
      !prefix.isCanonicalPrefixForChapterStart(0)) return undefined;
    const pagination = this.document.measured().physicalPagination;
    const page = pagination.index.findContainingPage(key, pageStartScalar);
    const last = pagination.index.findLastPage(key);
    if (page !== undefined && last !== undefined) return new ReaderPageOrdinal(page.pageIndex, last.pageIndex + 1);
    if (prefix === undefined || !prefix.matches(key) || !prefix.isCanonicalPrefixForChapterStart(0)) return undefined;
    const pageIndex = prefix.pageIndexAtOrBefore(pageStartScalar);
    return pageIndex >= 0 ? new ReaderPageOrdinal(pageIndex) : undefined;
  }

  private progress(chapterIndex: number, pageStartScalar: number, chapterScalarCount: number): number {
    if (chapterIndex < 0 || pageStartScalar < 0) return 0;
    const metrics = this.document.metrics();
    if (metrics !== undefined) return this.document.metricsPercent(metrics, chapterIndex, pageStartScalar);
    if (this.document.catalogPending() && this.document.catalogCount() === undefined) return 0;
    const count = this.document.catalogCount() ?? this.document.toc().length;
    if (count === 0) return 0;
    const position = this.document.readablePosition(chapterIndex);
    if (position < 0) return 0;
    const chapterProgress = chapterScalarCount > 0 ? normalizeReadingProgressRatio(pageStartScalar / chapterScalarCount) : 0;
    return ((position + chapterProgress) / count) * READER_CONTROL_PROGRESS_MAX;
  }

  frozen(): boolean {
    const turn = this.view.settlement().pageTurn;
    return this.view.projection().pageTurnSettlementActive || turn.gesture.phase === 'tracking' ||
      turn.gesture.phase === 'dragging' || turn.gesture.phase === 'settling';
  }

  startClock(lifecycle: number): void {
    this.refreshClock(lifecycle);
    this.armClock(lifecycle);
  }

  retireClock(): void {
    this.clearClockTimer();
    this.pendingClockText = undefined;
  }

  private refreshClock(lifecycle: number): void {
    if (!this.view.sessionActive(lifecycle)) return;
    const text = formatReaderPageClock(Date.now());
    if (this.frozen()) {
      this.pendingClockText = text;
      return;
    }
    this.admitClock(text);
  }

  private armClock(lifecycle: number): void {
    this.clearClockTimer();
    const nextMinuteDelay = 60050 - (Date.now() % 60000);
    this.clockTimer = setTimeout((): void => {
      this.clockTimer = -1;
      if (!this.view.sessionActive(lifecycle)) return;
      this.refreshClock(lifecycle);
      this.armClock(lifecycle);
    }, nextMinuteDelay);
  }

  private clearClockTimer(): void {
    if (this.clockTimer < 0) return;
    clearTimeout(this.clockTimer);
    this.clockTimer = -1;
  }

  private admitClock(text: string): void {
    if (this.view.chrome().pageChromeClockText === text) return;
    this.effects.publishClock(text);
    this.effects.advanceRenderRevision();
    this.effects.scheduleTextures();
  }

  flushDeferred(): void {
    if (this.frozen()) return;
    this.effects.flushReadingImagePixels();
    this.effects.clearCapsuleFreeze();
    const text = this.pendingClockText;
    this.pendingClockText = undefined;
    if (text !== undefined) this.admitClock(text);
    this.effects.flushCapsuleMeasurement();
  }
}
