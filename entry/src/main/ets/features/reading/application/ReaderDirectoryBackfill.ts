import type { ReadingGatewayRuntime } from './ReadingGatewayRuntime';
import {
  backfillRetainedReaderDirectoryNavigation, readerDirectoryObserveMissingNavigation,
  readerDirectoryTakeMissingNavigation, type ReaderDirectoryBackfillResult,
} from './ReaderDirectoryNavigation.ts';

export interface ReaderDirectoryBackfillOpening {
  key: string;
  bookId: string;
  format: string;
  runtime: ReadingGatewayRuntime;
  current: () => boolean;
  postFrame: (action: () => void) => void;
}

interface BackfillAttempt {
  task: Promise<ReaderDirectoryBackfillResult>;
  result?: ReaderDirectoryBackfillResult;
}

/** Binds preparation to the readable frame and shares its result across the
 * current directory surfaces. The Core still derives and stores the tree. */
export class ReaderDirectoryBackfill {
  private opening: ReaderDirectoryBackfillOpening | undefined;
  private disposeObserver: (() => void) | undefined;
  private attempt: BackfillAttempt | undefined;

  arm(opening: ReaderDirectoryBackfillOpening): void {
    if (this.opening?.key === opening.key) return;
    this.retire();
    this.opening = opening;
    const current = (): boolean => this.opening === opening && opening.current();
    try {
      opening.postFrame((): void => {
        if (!current()) {
          if (this.opening === opening) this.retire();
          return;
        }
        this.disposeObserver = readerDirectoryObserveMissingNavigation(opening.bookId,
          (retry: boolean): Promise<ReaderDirectoryBackfillResult> | undefined => {
            if (!current() || !readerDirectoryTakeMissingNavigation(opening.bookId)) return undefined;
            return this.prepare(opening, current, retry);
          });
      });
    } catch (_) {
      this.retire();
    }
  }

  retire(): void {
    this.disposeObserver?.();
    this.disposeObserver = undefined;
    this.opening = undefined;
    this.attempt = undefined;
  }

  private prepare(opening: ReaderDirectoryBackfillOpening, current: () => boolean,
    retry: boolean): Promise<ReaderDirectoryBackfillResult> {
    const previous = this.attempt;
    if (previous !== undefined && (!retry || previous.result === undefined ||
      previous.result.status === 'ready' || previous.result.reason === 'NoStructure')) return previous.task;
    const attempt: BackfillAttempt = {
      task: backfillRetainedReaderDirectoryNavigation(opening.runtime, opening.bookId, current, opening.format)
        .catch((): ReaderDirectoryBackfillResult => ({ status: 'unavailable' })),
    };
    this.attempt = attempt;
    void attempt.task.then((result: ReaderDirectoryBackfillResult): void => { attempt.result = result; });
    return attempt.task;
  }
}
