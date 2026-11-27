interface DownloadIntentWriteBatch<T> {
  value: T;
  durable: Promise<void>;
  resolve: () => void;
  reject: (failure: unknown) => void;
}

/** One active save and one coalesced successor. Acknowledgement belongs to
 * the actual persistence result for the snapshot covering the request. */
export class SharedDownloadIntentWriteQueue<T> {
  private pending: DownloadIntentWriteBatch<T> | undefined;
  private writing: boolean = false;
  private timer: number = -1;
  private readonly snapshot: () => T;
  private readonly save: (snapshot: T) => Promise<void>;
  private readonly delayMs: number;

  constructor(snapshot: () => T, save: (value: T) => Promise<void>, delayMs: number = 35) {
    this.snapshot = snapshot;
    this.save = save;
    this.delayMs = delayMs;
  }

  request(): Promise<void> {
    const value = this.snapshot();
    if (this.pending === undefined) {
      let resolve = (): void => {};
      let reject = (_failure: unknown): void => {};
      const durable = new Promise<void>((accepted, rejected): void => { resolve = accepted; reject = rejected; });
      this.pending = { value, durable, resolve, reject };
    } else {
      this.pending.value = value;
    }
    const durable = this.pending.durable;
    this.schedule();
    return durable;
  }

  private schedule(): void {
    if (this.writing || this.timer >= 0 || this.pending === undefined) return;
    this.timer = setTimeout((): void => {
      this.timer = -1;
      void this.flush();
    }, this.delayMs);
  }

  private async flush(): Promise<void> {
    const batch = this.pending;
    if (batch === undefined) return;
    this.pending = undefined;
    this.writing = true;
    try {
      await this.save(batch.value);
      batch.resolve();
    } catch (failure) { batch.reject(failure); }
    finally {
      this.writing = false;
      this.schedule();
    }
  }
}
