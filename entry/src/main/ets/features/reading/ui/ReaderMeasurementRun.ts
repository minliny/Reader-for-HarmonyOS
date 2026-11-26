import { ReadingSurfaceLayoutMap, type ReadingSurfaceLineMetric } from '../application/ReadingSurfaceLayoutMap.ts';

import type { ReadingSessionChapter } from '../application/ReadingChapterWindow';
import type { RemoteReadingPositionContext } from '../application/RemoteReadingPositionMigration';

export const READER_MEASUREMENT_UNICODE_PROBE = 'A😀B';

const UNICODE_EMPTY_LIMIT = 5;
const TITLE_PENDING_LIMIT = 8;
const LAYOUT_TIMEOUT_MS = 6000;
const NATIVE_LAYOUT_RETRY_LIMIT = 2;

interface ReaderMeasurementTimer {
  set(delayMs: number, callback: () => void): number;
  clear(handle: number): void;
}

export interface ReaderUnicodeMeasurement {
  readonly count: number;
  readLine(): ReadingSurfaceLineMetric;
}

export interface ReaderTitleMeasurement {
  readonly count: number;
  admit(): void;
}

export interface ReaderMeasurementWindowRecovery {
  mayReload(): boolean;
  offset(): number;
  waitForContentIdle(): Promise<void>;
  reopen(offset: number, context: RemoteReadingPositionContext | undefined): Promise<void>;
  selectionActive(): boolean;
  fail(error: Error): void;
}

/** Measurement-run validation and retry state. Native observations are
 * requested lazily; the caller still owns controllers and their transfer. */
export class ReaderMeasurementRun {
  private verifiedUnicode: boolean = false;
  private emptyUnicodeAttempts: number = 0;
  private gateAttempts: number = 0;
  private titleLineCount: number = 0;
  private titleAttempts: number = 0;
  private batchParagraph: number = -1;
  private batchLineCount: number = -1;
  private nativeLayoutRetries: number = 0;
  private windowRecoveryAttempts: number = 0;
  private deadline: number = -1;

  private readonly timer: ReaderMeasurementTimer;

  constructor(timer: ReaderMeasurementTimer) {
    this.timer = timer;
  }

  requiresUnicodeProbe(): boolean {
    return !this.verifiedUnicode;
  }

  beginForwardGates(): void {
    this.gateAttempts = 0;
    this.clearTitle();
    this.batchParagraph = -1;
    this.batchLineCount = -1;
  }

  clearTitle(): void {
    this.titleLineCount = 0;
    this.titleAttempts = 0;
  }

  beginNativeLayout(): void {
    if (!this.verifiedUnicode) this.emptyUnicodeAttempts = 0;
  }

  resetSelection(): void {
    this.nativeLayoutRetries = 0;
    this.windowRecoveryAttempts = 0;
  }

  validateUnicode(read: () => ReaderUnicodeMeasurement, fail: (error: Error) => void,
    trace: (message: string) => void): boolean {
    if (this.verifiedUnicode) return true;
    let observed: ReaderUnicodeMeasurement;
    try {
      observed = read();
    } catch (_) {
      // An unrelated layout pass can arrive before the probe is bound.
      return false;
    }
    if (observed.count === 0) {
      this.emptyUnicodeAttempts += 1;
      if (this.emptyUnicodeAttempts >= UNICODE_EMPTY_LIMIT) fail(new Error('PAGINATION_UNICODE_PROBE_NO_LINES'));
      return false;
    }
    if (observed.count !== 1) {
      fail(new Error('PAGINATION_INDEX_UNIT_UNSUPPORTED'));
      return false;
    }
    try {
      const metric = observed.readLine();
      const map = new ReadingSurfaceLayoutMap(READER_MEASUREMENT_UNICODE_PROBE);
      const lines = map.linesFromArkUI([metric]);
      if (lines.length !== 1 || metric.startIndex !== 0 || metric.endIndex !== map.utf16Length() ||
        map.utf16Length() !== 4 || map.scalarCount() !== 3 || lines[0].startScalar !== 0 || lines[0].endScalar !== 3) {
        fail(new Error('PAGINATION_INDEX_UNIT_UNSUPPORTED'));
        return false;
      }
      this.verifiedUnicode = true;
      trace('ReadingExperience UTF-16 probe passed: A😀B = 4 UTF-16 / 3 Unicode scalars');
      this.emptyUnicodeAttempts = 0;
      return true;
    } catch (error) {
      // Conversion failure already has a precise reason (such as splitting a
      // surrogate). A newer layout cannot repair the accepted index units.
      fail(error instanceof Error ? error : new Error('PAGINATION_INDEX_UNIT_UNSUPPORTED'));
      return false;
    }
  }

  captureTitle(read: () => ReaderTitleMeasurement, fail: (error: Error) => void): boolean {
    let observed: ReaderTitleMeasurement;
    try { observed = read(); } catch (_) {
      return this.deferTitle(-2, fail);
    }
    if (observed.count <= 0) return this.deferTitle(-1, fail);
    try {
      observed.admit();
      this.titleLineCount = observed.count;
      this.titleAttempts = 0;
      return true;
    } catch (error) {
      fail(error instanceof Error ? error : new Error('PAGINATION_CHAPTER_TITLE_GEOMETRY_INVALID'));
      return false;
    }
  }

  private deferTitle(lineCount: number, fail: (error: Error) => void): boolean {
    this.titleLineCount = lineCount;
    this.titleAttempts += 1;
    if (this.titleAttempts >= TITLE_PENDING_LIMIT) fail(new Error('PAGINATION_CHAPTER_TITLE_METRICS_UNAVAILABLE'));
    return false;
  }

  paragraphHasLayout(paragraph: number, readLineCount: () => number): boolean {
    this.batchParagraph = paragraph;
    this.batchLineCount = -1;
    try {
      const observed = readLineCount();
      this.batchLineCount = observed;
      return observed > 0;
    } catch (_) {
      return false;
    }
  }

  pendingDiagnostic(probeOk: boolean, titleOk: boolean, batchOk: boolean): string | undefined {
    this.gateAttempts += 1;
    const attempt = this.gateAttempts;
    if (attempt !== 1 && attempt !== 3 && attempt !== 10 && attempt % 30 !== 0) return undefined;
    return `ReadingExperience measurement gate pending: attempt=${attempt} ` +
      `probe=${probeOk} title=${titleOk} titleLines=${this.titleLineCount} ` +
      `batch=${batchOk} batchPendingParagraph=${this.batchParagraph} batchPendingLines=${this.batchLineCount}`;
  }

  retryLayout(error: Error, isSessionActive: () => boolean, captureCurrent: () => (() => boolean),
    resume: () => void): boolean {
    if (error.message !== 'NATIVE_TEXT_LAYOUT_UNAVAILABLE' || this.nativeLayoutRetries >= NATIVE_LAYOUT_RETRY_LIMIT ||
      !isSessionActive()) return false;
    const current = captureCurrent();
    if (!current()) return false;
    this.nativeLayoutRetries += 1;
    // The original first-page deadline remains authoritative across this
    // 16ms scheduling retry. A retired run cannot start a new measurement.
    this.timer.set(16, (): void => { if (current()) resume(); });
    return true;
  }

  async recoverWindow(error: Error, chapter: ReadingSessionChapter, current: () => boolean,
    host: ReaderMeasurementWindowRecovery): Promise<void> {
    if (!current()) return;
    if (!host.mayReload() || this.windowRecoveryAttempts >= 2) {
      host.fail(error);
      return;
    }
    this.windowRecoveryAttempts += 1;
    const offset = host.offset();
    const context: RemoteReadingPositionContext | undefined =
      chapter.bodyVersion === undefined || chapter.processingVersion === undefined ? undefined : {
        bodyVersion: chapter.bodyVersion, processingVersion: chapter.processingVersion,
        anchors: [{ id: 'requested', offset }],
      };
    if (context === undefined && offset > 0) {
      host.fail(error);
      return;
    }
    try {
      await host.waitForContentIdle();
      if (!current()) return;
      await host.reopen(offset, context);
    } catch (recoveryError) {
      if (host.selectionActive()) host.fail(recoveryError as Error);
    }
  }

  armDeadline(current: () => boolean, fail: (error: Error) => void): void {
    this.cancelDeadline();
    this.deadline = this.timer.set(LAYOUT_TIMEOUT_MS, (): void => {
      if (current()) fail(new Error('PAGINATION_LAYOUT_METRICS_UNAVAILABLE'));
    });
  }

  cancelDeadline(): void {
    if (this.deadline < 0) return;
    this.timer.clear(this.deadline);
    this.deadline = -1;
  }
}
