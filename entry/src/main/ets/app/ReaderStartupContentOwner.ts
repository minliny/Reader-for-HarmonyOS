export type ReaderStartupContentPhase = 'waiting' | 'loading' | 'recovery-loading' | 'recovery' | 'ready' | 'platform-unavailable' | 'retired';
export type ReaderStartupRecoveryReason = 'admission-pending' | 'admission-failed' | 'main-load-failed' | 'recovery-load-failed' | 'exit-failed';
export interface ReaderStartupContentState {
  phase: ReaderStartupContentPhase;
  reason: ReaderStartupRecoveryReason;
  canRetry: boolean;
}
export interface ReaderStartupContentDriver {
  loadMain(done: (code: number) => void): void;
  loadRecovery(done: (code: number) => void): void;
  ready(): void;
  unavailable(): void;
  exit(): Promise<void>;
  observerFailed?(error: Error): void;
}

/** One WindowStage's pre-Index admission. A retry observes the original
 * recovery barrier; it never starts another storage recovery or native task. */
export class ReaderStartupContentOwner {
  private static installed: ReaderStartupContentOwner | undefined = undefined;
  private readonly admission: Promise<void>;
  private readonly driver: ReaderStartupContentDriver;
  private readonly deadlineMs: number;
  private timer: number = -1;
  private generation: number = 0;
  private retired: boolean = false;
  private exiting: boolean = false;
  private state: ReaderStartupContentState = { phase: 'waiting', reason: 'admission-pending', canRetry: false };
  private observers: ((state: ReaderStartupContentState) => void)[] = [];

  constructor(admission: Promise<void>, driver: ReaderStartupContentDriver, deadlineMs: number = 15000) {
    this.admission = admission;
    this.driver = driver;
    this.deadlineMs = deadlineMs;
    // Observe a rejected barrier even if the WindowStage retires before start.
    void admission.catch((): void => {});
  }
  static current(): ReaderStartupContentOwner | undefined { return ReaderStartupContentOwner.installed; }
  snapshot(): ReaderStartupContentState { return { phase: this.state.phase, reason: this.state.reason, canRetry: this.state.canRetry }; }
  subscribe(observer: (state: ReaderStartupContentState) => void): () => void {
    this.observers.push(observer); this.notify(observer);
    return (): void => { this.observers = this.observers.filter((current): boolean => current !== observer); };
  }
  start(): void {
    if (this.retired || ReaderStartupContentOwner.installed === this) return;
    ReaderStartupContentOwner.installed?.close();
    ReaderStartupContentOwner.installed = this;
    this.waitForAdmission();
  }
  retry(): void {
    if (this.retired || !this.state.canRetry || this.exiting) return;
    this.waitForAdmission();
  }
  async exit(): Promise<void> {
    if (this.retired || this.exiting || this.state.phase !== 'recovery') return;
    this.exiting = true;
    try { await this.driver.exit(); }
    catch (_) {
      if (!this.retired) this.publish('recovery', 'exit-failed', true);
    } finally { this.exiting = false; }
  }
  close(): void {
    this.retired = true; this.generation += 1; this.clearTimer();
    this.publish('retired', this.state.reason, false);
    this.observers = [];
    if (ReaderStartupContentOwner.installed === this) ReaderStartupContentOwner.installed = undefined;
  }
  private waitForAdmission(): void {
    const generation = ++this.generation;
    this.clearTimer(); this.publish('waiting', 'admission-pending', false);
    this.timer = setTimeout((): void => {
      if (this.current(generation) && this.state.phase === 'waiting') this.showRecovery(generation, 'admission-pending');
    }, this.deadlineMs);
    void this.admission.then((): void => {
      if (!this.current(generation) || this.state.phase !== 'waiting') return;
      this.clearTimer(); this.publish('loading', 'admission-pending', false);
      try {
        this.driver.loadMain((code: number): void => {
          if (!this.current(generation) || this.state.phase !== 'loading') return;
          if (code !== 0) { this.showRecovery(generation, 'main-load-failed'); return; }
          this.publish('ready', 'admission-pending', false);
          try { this.driver.ready(); } catch (error) { this.driver.observerFailed?.(error as Error); }
        });
      } catch (_) { if (this.state.phase === 'loading') this.showRecovery(generation, 'main-load-failed'); }
    }, (): void => {
      if (this.current(generation) && this.state.phase === 'waiting') this.showRecovery(generation, 'admission-failed');
    });
  }
  private showRecovery(generation: number, reason: ReaderStartupRecoveryReason): void {
    if (!this.current(generation)) return;
    this.clearTimer(); this.publish('recovery-loading', reason, false);
    try {
      this.driver.loadRecovery((code: number): void => {
        if (!this.current(generation) || this.state.phase !== 'recovery-loading') return;
        if (code !== 0) { this.failRecovery(); return; }
        this.publish('recovery', reason, true);
      });
    } catch (_) { if (this.state.phase === 'recovery-loading') this.failRecovery(); }
  }
  private failRecovery(): void {
    this.publish('platform-unavailable', 'recovery-load-failed', false);
    this.driver.unavailable();
  }
  private current(generation: number): boolean { return !this.retired && generation === this.generation; }
  private clearTimer(): void { if (this.timer >= 0) clearTimeout(this.timer); this.timer = -1; }
  private notify(observer: (state: ReaderStartupContentState) => void): void {
    try { observer(this.snapshot()); } catch (error) { this.driver.observerFailed?.(error as Error); }
  }
  private publish(phase: ReaderStartupContentPhase, reason: ReaderStartupRecoveryReason, canRetry: boolean): void {
    this.state = { phase, reason, canRetry };
    for (const observer of this.observers) this.notify(observer);
  }
}
