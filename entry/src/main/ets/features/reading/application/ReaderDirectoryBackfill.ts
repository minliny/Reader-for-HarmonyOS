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

/** Search and order changes in one detail display share preparation, while a
 * reopened display keeps independent admission. Core owns the actual TOC. */
export class ReaderDirectoryLocalPreparation {
  private pending: Map<string, Promise<ReaderDirectoryBackfillResult>> = new Map();

  run(bookId: string, displayEpoch: string,
    prepare: () => Promise<ReaderDirectoryBackfillResult>): Promise<ReaderDirectoryBackfillResult> {
    const key = JSON.stringify([bookId, displayEpoch]);
    const existing = this.pending.get(key);
    if (existing !== undefined) return existing;
    const task = Promise.resolve().then(prepare).finally((): void => {
      if (this.pending.get(key) === task) this.pending.delete(key);
    });
    this.pending.set(key, task);
    return task;
  }
}

/** Binds preparation to the readable frame and shares its result across the
 * current directory surfaces. The Core still derives and stores the tree. */
export class ReaderDirectoryBackfill {
  private opening: ReaderDirectoryBackfillOpening | undefined;
  private disposeObserver: (() => void) | undefined;
  private settleFrame: ((ready: boolean) => void) | undefined;
  private attempt: BackfillAttempt | undefined;

  arm(opening: ReaderDirectoryBackfillOpening): void {
    if (this.opening?.key === opening.key) return;
    this.retire();
    this.opening = opening;
    const current = (): boolean => this.opening === opening && opening.current();
    const readableFrame = new Promise<boolean>((resolve): void => { this.settleFrame = resolve; });
    try {
      this.disposeObserver = readerDirectoryObserveMissingNavigation(opening.bookId,
        (retry: boolean): Promise<ReaderDirectoryBackfillResult> | undefined => {
          if (!current() || !readerDirectoryTakeMissingNavigation(opening.bookId)) return undefined;
          return this.prepare(opening, current, readableFrame, retry);
        });
      opening.postFrame((): void => {
        if (!current()) {
          if (this.opening === opening) this.retire();
          return;
        }
        this.settleFrame?.(true);
        this.settleFrame = undefined;
      });
    } catch (_) {
      this.retire();
    }
  }

  retire(): void {
    this.disposeObserver?.();
    this.disposeObserver = undefined;
    this.settleFrame?.(false);
    this.settleFrame = undefined;
    this.opening = undefined;
    this.attempt = undefined;
  }

  private prepare(opening: ReaderDirectoryBackfillOpening, current: () => boolean,
    readableFrame: Promise<boolean>, retry: boolean): Promise<ReaderDirectoryBackfillResult> {
    const previous = this.attempt;
    if (previous !== undefined && (!retry || previous.result === undefined ||
      previous.result.status === 'ready' || previous.result.reason === 'NoStructure')) return previous.task;
    const attempt: BackfillAttempt = {
      task: readableFrame.then((ready: boolean): Promise<ReaderDirectoryBackfillResult> => ready && current()
        ? backfillRetainedReaderDirectoryNavigation(opening.runtime, opening.bookId, current, opening.format)
        : Promise.resolve({ status: 'unavailable' }))
        .catch((): ReaderDirectoryBackfillResult => ({ status: 'unavailable' })),
    };
    this.attempt = attempt;
    void attempt.task.then((result: ReaderDirectoryBackfillResult): void => { attempt.result = result; });
    return attempt.task;
  }
}
