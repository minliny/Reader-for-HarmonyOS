import type { ReadingSessionChapter } from './ReadingChapterWindow';
import { completeReadingEntryWindow, type ReadingEntryExpansionHost } from './ReadingChapterMeasurementPreparation';

export type ReadingEntryWindowLane = 'background' | 'foreground';

export interface ReadingEntryWindowRequest extends ReadingEntryExpansionHost {
  isCurrent: () => boolean;
  complete: (isCurrent: () => boolean) => Promise<ReadingSessionChapter>;
}

interface ReadingEntryWindowHost {
  captureSelection: (chapter: ReadingSessionChapter) => () => boolean;
  captureRequest: (chapter: ReadingSessionChapter, lane: ReadingEntryWindowLane) => ReadingEntryWindowRequest;
  postFrame: (run: () => void) => void;
  reportBackgroundFailure: (error: Error) => void;
}

interface ReadingEntryWindowOperation {
  chapter: ReadingSessionChapter;
  result: Promise<void>;
}

/** Expands a published partial body once for both scroll and foreground callers. */
export class ReadingEntryWindowExpansion {
  private queued: ReadingSessionChapter | undefined = undefined;
  private active: ReadingEntryWindowOperation | undefined = undefined;
  private readonly host: ReadingEntryWindowHost;

  constructor(host: ReadingEntryWindowHost) { this.host = host; }

  reset(): void {
    this.active = undefined;
    this.queued = undefined;
  }

  schedule(chapter: ReadingSessionChapter | undefined): void {
    if (chapter?.documentRange === undefined || this.active?.chapter === chapter || this.queued === chapter) return;
    this.queued = chapter;
    const isSelection = this.host.captureSelection(chapter);
    this.host.postFrame((): void => {
      if (this.queued === chapter) this.queued = undefined;
      if (!isSelection()) return;
      void this.expand(chapter, 'background').catch(this.host.reportBackgroundFailure);
    });
  }

  async expand(chapter: ReadingSessionChapter | undefined, lane: ReadingEntryWindowLane): Promise<void> {
    if (chapter?.documentRange === undefined) return;
    if (this.active?.chapter === chapter) return this.active.result;
    const request = this.host.captureRequest(chapter, lane);
    const result = completeReadingEntryWindow(request.complete(request.isCurrent), chapter, request.isCurrent, request);
    const operation: ReadingEntryWindowOperation = { chapter: chapter, result: result };
    this.active = operation;
    try { await result; }
    finally { if (this.active === operation) this.active = undefined; }
  }
}
