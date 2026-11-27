const READER_MEASUREMENT_SLICE_MS = 6;

interface ReaderMeasurementStep {
  current: () => boolean;
  measure: () => void;
}

/** Continue only whole measured pages. A successor is queued during layout,
 * then run after that layout unwinds and only within the current frame slice. */
export class ReaderMeasurementContinuation {
  private pending: ReaderMeasurementStep | undefined = undefined;
  private running: boolean = false;
  private scheduled: boolean = false;
  private readonly now: () => number;
  private readonly postFrame: (resume: () => void) => void;

  constructor(now: () => number, postFrame: (resume: () => void) => void) {
    this.now = now;
    this.postFrame = postFrame;
  }

  advance(current: () => boolean, measure: () => void): void {
    this.pending = { current, measure };
    if (!this.running && !this.scheduled) this.drain();
  }

  private drain(): void {
    const deadline = this.now() + READER_MEASUREMENT_SLICE_MS;
    this.running = true;
    try {
      while (this.pending !== undefined) {
        const step = this.pending;
        this.pending = undefined;
        if (step.current()) step.measure();
        if (this.now() >= deadline) break;
      }
    } finally {
      this.running = false;
    }
    if (this.pending !== undefined) {
      this.scheduled = true;
      this.postFrame((): void => {
        this.scheduled = false;
        this.drain();
      });
    }
  }
}
