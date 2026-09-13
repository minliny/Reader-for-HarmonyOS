/** Window-scoped writer. New pointer samples replace pending work, not the
 * in-flight window lookup or native write. Reader instances share this owner. */
export interface ReaderBrightnessWindow {
  getWindowProperties(): { brightness: number };
  setWindowBrightness(value: number): Promise<void>;
}

export class ReaderBrightnessResult {
  readonly applied: boolean;
  readonly value: number;
  constructor(applied: boolean, value: number) { this.applied = applied; this.value = value; }
}

class BrightnessWrite {
  readonly owner: number;
  readonly value: number;
  readonly restore: boolean;
  readonly resolve: (result: ReaderBrightnessResult) => void;
  readonly reject: (error: Error) => void;
  constructor(owner: number, value: number, restore: boolean,
    resolve: (result: ReaderBrightnessResult) => void, reject: (error: Error) => void) {
    this.owner = owner; this.value = value; this.restore = restore;
    this.resolve = resolve; this.reject = reject;
  }
}

export class ReaderBrightnessWriter {
  private owner: number = 0;
  private pending: BrightnessWrite | undefined = undefined;
  private running: Promise<void> | undefined = undefined;
  private inFlight: Promise<void> | undefined = undefined;
  private baseline: number | undefined = undefined;
  private confirmed: number = -1;
  private windowEpoch: number = 0;

  private readonly getWindow: () => Promise<ReaderBrightnessWindow>;
  constructor(getWindow: () => Promise<ReaderBrightnessWindow>) { this.getWindow = getWindow; }

  claim(): number {
    this.owner += 1;
    this.discardPending();
    return this.owner;
  }

  isCurrent(owner: number): boolean { return owner === this.owner; }

  async read(owner: number): Promise<ReaderBrightnessResult> {
    const epoch = this.windowEpoch;
    const win = await this.getWindow();
    if (!this.isCurrent(owner) || epoch !== this.windowEpoch) {
      return new ReaderBrightnessResult(false, this.confirmed);
    }
    this.remember(win.getWindowProperties().brightness);
    return new ReaderBrightnessResult(true, this.confirmed);
  }

  request(owner: number, value: number): Promise<ReaderBrightnessResult> {
    if (!this.isCurrent(owner)) return Promise.resolve(new ReaderBrightnessResult(false, this.confirmed));
    const target = value < 0 ? -1 : Math.max(0, Math.min(1, value));
    if (!Number.isFinite(value)) return Promise.reject(new Error('INVALID_BRIGHTNESS'));
    return this.enqueue(owner, target, false);
  }

  /** Cancel only unsent values; an already-issued native call is accounted for. */
  cancelPending(owner: number): void {
    if (this.isCurrent(owner)) this.discardPending();
  }

  /** Settle the native call already issued at cancellation, including failure.
   * New intents retain their own generation at the caller; this observation
   * neither writes a rollback nor waits for subsequently queued samples. */
  async cancelAndSettle(owner: number): Promise<ReaderBrightnessResult> {
    if (!this.isCurrent(owner)) return new ReaderBrightnessResult(false, this.confirmed);
    const epoch = this.windowEpoch;
    this.discardPending();
    const issued = this.inFlight;
    if (issued !== undefined) await issued;
    return new ReaderBrightnessResult(this.isCurrent(owner) && epoch === this.windowEpoch,
      this.confirmed);
  }

  release(owner: number): Promise<ReaderBrightnessResult> {
    if (!this.isCurrent(owner)) return Promise.resolve(new ReaderBrightnessResult(false, this.confirmed));
    const restoreOwner = this.claim();
    return this.enqueue(restoreOwner, this.baseline ?? -1, true);
  }

  /** Called on actual Window replacement, never for every MOVE. */
  reset(): void {
    this.claim();
    this.windowEpoch += 1;
    this.baseline = undefined;
    this.confirmed = -1;
  }

  private remember(value: number): void {
    if (!Number.isFinite(value)) return;
    if (this.baseline === undefined) this.baseline = value;
    this.confirmed = value;
  }

  private discardPending(): void {
    this.pending?.resolve(new ReaderBrightnessResult(false, this.confirmed));
    this.pending = undefined;
  }

  private enqueue(owner: number, value: number, restore: boolean): Promise<ReaderBrightnessResult> {
    this.discardPending();
    const result = new Promise<ReaderBrightnessResult>((resolve, reject): void => {
      this.pending = new BrightnessWrite(owner, value, restore, resolve, reject);
    });
    this.startDrain();
    return result;
  }

  private startDrain(): void {
    if (this.running !== undefined) return;
    this.running = this.drain().finally((): void => {
      this.running = undefined;
      // A consumer can enqueue from a resolved write's microtask, between
      // drain completion and this finally. That last value still needs a drain.
      if (this.pending !== undefined) this.startDrain();
    });
  }

  private async drain(): Promise<void> {
    while (this.pending !== undefined) {
      const epoch = this.windowEpoch;
      const lookupOwner = this.owner;
      // Leave pending replaceable during lookup. Take the newest sample only
      // once a window is available, so continuous input cannot starve writes.
      let win: ReaderBrightnessWindow;
      try {
        win = await this.getWindow();
      } catch (error) {
        // A replaced Window or reader lease may have queued a new value while
        // this lookup was pending. Only its own owner can consume that failure.
        if (epoch !== this.windowEpoch || lookupOwner !== this.owner) continue;
        const failed = this.pending;
        this.pending = undefined;
        failed?.reject(error as Error);
        continue;
      }
      if (epoch !== this.windowEpoch) continue;
      const task = this.pending;
      this.pending = undefined;
      if (task === undefined) continue;
      if (!this.isCurrent(task.owner)) {
        task.resolve(new ReaderBrightnessResult(false, this.confirmed));
        continue;
      }
      let settle: () => void = (): void => {};
      const issued = new Promise<void>((resolve): void => { settle = resolve; });
      this.inFlight = issued;
      try {
        // A Window can be destroyed after lookup. Property reads are native
        // calls too: their synchronous failure must settle this dequeued task.
        this.remember(win.getWindowProperties().brightness);
        const target = task.restore ? (this.baseline ?? task.value) : task.value;
        await win.setWindowBrightness(target);
        if (epoch === this.windowEpoch) this.confirmed = target;
        const applied = epoch === this.windowEpoch && this.isCurrent(task.owner);
        if (applied && task.restore) this.baseline = undefined;
        task.resolve(new ReaderBrightnessResult(applied, target));
      } catch (error) {
        task.reject(error as Error);
      } finally {
        settle();
        if (this.inFlight === issued) this.inFlight = undefined;
      }
    }
  }
}
