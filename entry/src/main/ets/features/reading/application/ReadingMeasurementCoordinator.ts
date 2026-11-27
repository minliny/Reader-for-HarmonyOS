import { ParagraphRange } from './ReadingMeasurementFacts.ts';
import { planForwardReadingMeasurement, type ReadingMeasurementStart } from './ReadingChapterMeasurementPreparation.ts';
import { ReaderMeasurementRun, type ReaderUnicodeMeasurement } from './ReaderMeasurementRun.ts';
import type { ReadingSurfaceLayoutMap } from './ReadingSurfaceLayoutMap';
import type { ReadingPaginationKey, ReadingPaginationPrefix } from './ReadingPaginationIndex';

import type { ReaderWidthClass } from '../../../ui/foundation/ReaderWidthClass';

export interface ReadingMeasurementDocument {
  readonly content: string;
  readonly map: ReadingSurfaceLayoutMap;
  readonly ranges: ParagraphRange[];
  readonly offset: number;
}

export interface ReadingMeasurementContent {
  prepare(): void;
  hasParagraphs(): boolean;
  hasPreviousPage(): boolean;
  document(): ReadingMeasurementDocument;
  measurePrevious(): void;
  expand(direction: 'before' | 'after'): void;
  measureForward(start: ReadingMeasurementStart): void;
}

export interface ReadingMeasurementStartHost {
  isActive(): boolean;
  hasViewport(): boolean;
  isCompleting(): boolean;
  defer(): void;
  captureContent(): ReadingMeasurementContent | undefined;
  retry(error: Error): boolean;
  fail(error: Error): void;
}

export interface ReadingMeasurementLayoutHost {
  isCurrent(): boolean;
  readUnicode(): ReaderUnicodeMeasurement;
  captureTitle(): boolean;
  hasBatch(): boolean;
  consumeBatch(): void;
  trace(message: string): void;
  fail(error: Error): void;
}

interface ReadingReversePageBoundary {
  readonly endScalar: number;
  readonly targetChapterIndex: number;
  readonly originalChapterIndex: number;
  readonly originalChapterOffset: number;
}

/** Only geometry that contributes to the reader's reflow key. */
export interface ReadingWindowLayoutFields {
  readonly widthClass: ReaderWidthClass;
  readonly viewportWidth: number;
  readonly viewportHeight: number;
  readonly contentTop: number;
  readonly contentRight: number;
  readonly contentBottom: number;
  readonly contentLeft: number;
  readonly facingChapterWidth: number;
  readonly titleTrackHeightVp: number;
  readonly systemFontScale: number;
}

export interface ReadingWindowLayoutInput {
  readonly layout: ReadingWindowLayoutFields;
  readonly extendIntoCutout: boolean;
  readonly hideNavigationBar: boolean;
}

export function createReaderWindowMetricsLayoutKey(
  layout: ReadingWindowLayoutFields,
  extendIntoCutout: boolean,
  hideNavigationBar: boolean,
): string {
  return [
    layout.widthClass,
    layout.viewportWidth,
    layout.viewportHeight,
    layout.contentTop,
    layout.contentRight,
    layout.contentBottom,
    layout.contentLeft,
    layout.facingChapterWidth,
    layout.titleTrackHeightVp,
    layout.systemFontScale,
    extendIntoCutout,
    hideNavigationBar === true,
  ].join('|');
}

export interface ReadingWindowReflowHost {
  hasTurnInFlight(): boolean;
  deferForTurn(): void;
  windowLayout(): ReadingWindowLayoutInput;
  invalidateTurn(): void;
  invalidatePagination(): void;
  applyChrome(): void;
  hasMaterializedChapter(): boolean;
  isCompleting(): boolean;
  deferMeasurement(): void;
  beginMeasurement(): void;
}

export interface ReadingAppearanceRestoreHost {
  isSelectionActive(): boolean;
  layoutSignature(): string;
  isMeasurementCurrent(): boolean;
  resume(): void;
}

/** Owns measurement admission and reflow ordering. The reader still owns the
 * visible page, and its native adapter provides the measurements on demand. */
export class ReadingMeasurementCoordinator {
  private lastWindowLayoutKey: string = '';
  private deferred: boolean = false;
  private invalidateDeferredLayout: boolean = false;
  private readonly run: ReaderMeasurementRun;

  constructor(run: ReaderMeasurementRun) {
    this.run = run;
  }

  begin(host: ReadingMeasurementStartHost): void {
    if (!host.isActive() || !host.hasViewport()) return;
    if (host.isCompleting()) {
      host.defer();
      return;
    }
    const content = host.captureContent();
    if (content === undefined) return;
    try {
      content.prepare();
      if (!content.hasParagraphs()) throw new Error('READING_CONTENT_EMPTY');
      if (content.hasPreviousPage()) {
        content.measurePrevious();
        return;
      }
      const document = content.document();
      const start = planForwardReadingMeasurement(document.offset, document.content, document.map, document.ranges);
      if (start.expand !== undefined) content.expand(start.expand);
      else content.measureForward(start);
    } catch (error) {
      if (!host.retry(error as Error)) host.fail(error as Error);
    }
  }

  captureLayout(host: ReadingMeasurementLayoutHost): void {
    if (!host.isCurrent()) return;
    if (!this.run.validateUnicode((): ReaderUnicodeMeasurement => host.readUnicode(),
      (error: Error): void => host.fail(error), (message: string): void => host.trace(message))) {
      this.reportPending(host, false, true);
      return;
    }
    if (!host.captureTitle()) {
      this.reportPending(host, true, false);
      return;
    }
    if (host.hasBatch()) host.consumeBatch();
  }

  private reportPending(host: ReadingMeasurementLayoutHost, probe: boolean, title: boolean): void {
    const message = this.run.pendingDiagnostic(probe, title, true);
    if (message !== undefined) host.trace(message);
  }

  reverseEnd(boundary: ReadingReversePageBoundary, map: ReadingSurfaceLayoutMap,
    draft: ReadingPaginationPrefix | undefined, key: () => ReadingPaginationKey): number {
    if (boundary.endScalar >= 0) return boundary.endScalar;
    const known = draft?.matches(key()) === true ? draft.observationForPageStart(boundary.originalChapterOffset) : undefined;
    return boundary.targetChapterIndex === boundary.originalChapterIndex ?
      Math.min(boundary.originalChapterOffset, known?.requestScalar ?? boundary.originalChapterOffset) : map.scalarCount();
  }

  reverseExpansion(map: ReadingSurfaceLayoutMap, endScalar: number, nextRangeIndex: number): 'before' | 'after' | undefined {
    if (endScalar > map.residentEnd()) return 'after';
    return nextRangeIndex < 0 && map.residentStart() > 0 ? 'before' : undefined;
  }

  rememberWindowLayout(input: ReadingWindowLayoutInput): void {
    this.lastWindowLayoutKey = createReaderWindowMetricsLayoutKey(input.layout, input.extendIntoCutout, input.hideNavigationBar);
  }

  deferMeasurement(invalidateLayout: boolean = false): void {
    this.deferred = true;
    this.invalidateDeferredLayout ||= invalidateLayout;
  }

  hasDeferredWork(): boolean { return this.deferred || this.invalidateDeferredLayout; }

  clearDeferredRequest(): void { this.deferred = false; }

  clearDeferredLayoutInvalidation(): void { this.invalidateDeferredLayout = false; }

  resumeDeferred(active: boolean, invalidate: () => void, begin: () => void): void {
    if (!active || !this.deferred) return;
    this.deferred = false;
    if (this.invalidateDeferredLayout) {
      // Keep the committed display while measuring its anchor again. The
      // preceding appearance's page cannot seed the new layout's prefix.
      invalidate();
      this.invalidateDeferredLayout = false;
    }
    begin();
  }

  reflowWindow(host: ReadingWindowReflowHost): void {
    if (host.hasTurnInFlight()) {
      host.deferForTurn();
      return;
    }
    const input = host.windowLayout();
    const next = createReaderWindowMetricsLayoutKey(input.layout, input.extendIntoCutout, input.hideNavigationBar);
    if (next === this.lastWindowLayoutKey) {
      host.applyChrome();
      return;
    }
    host.invalidateTurn();
    this.lastWindowLayoutKey = next;
    host.invalidatePagination();
    host.applyChrome();
    if (!host.hasMaterializedChapter()) return;
    if (host.isCompleting()) host.deferMeasurement();
    else host.beginMeasurement();
  }

  restoreAfterAppearanceChange(measuredLayout: string, host: ReadingAppearanceRestoreHost): boolean {
    if (!host.isSelectionActive() || measuredLayout === host.layoutSignature()) return false;
    if (host.isMeasurementCurrent()) host.resume();
    return true;
  }
}

/** The touch exclusion band includes both platform edge gestures and the
 * navigation indicator. Unavailable native values contribute no distance. */
export function readingGestureInset(minimum: number, gesture: number, navigation: number): number {
  return Math.max(minimum, Number.isFinite(gesture) ? gesture : 0, Number.isFinite(navigation) ? navigation : 0);
}
