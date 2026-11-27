interface PendingArkWebJob<T> {
  run: () => Promise<T>;
  resolve: (result: T) => void;
  reject: (error: unknown) => void;
}

/** One global browser owner at a time. Priority applies only to work that has not begun. */
export class ArkWebJobQueue<T> {
  private readonly interactive: PendingArkWebJob<T>[] = [];
  private readonly background: PendingArkWebJob<T>[] = [];
  private running: boolean = false;

  submit(interactive: boolean, run: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject): void => {
      (interactive ? this.interactive : this.background).push({ run, resolve, reject });
      this.startNext();
    });
  }

  private startNext(): void {
    if (this.running) return;
    const job = this.interactive.shift() ?? this.background.shift();
    if (job === undefined) return;
    this.running = true;
    void Promise.resolve().then(job.run).then(job.resolve, job.reject).finally((): void => {
      this.running = false;
      this.startNext();
    });
  }
}

export type ArkWebProxyPhase = 'configuring' | 'ready' | 'removing' | 'retired' | 'failed';
export interface ArkWebProxyAttempt {
  readonly phase: 'configuring' | 'removing';
}

/** Tracks native acknowledgements by dispatch identity on a single process-wide proxy lease. */
export class ArkWebProxyAdmission {
  private state: ArkWebProxyPhase = 'configuring';
  readonly configuration: ArkWebProxyAttempt = { phase: 'configuring' };
  private pending: ArkWebProxyAttempt | undefined = this.configuration;

  get phase(): ArkWebProxyPhase { return this.state; }

  beginRestore(): ArkWebProxyAttempt | undefined {
    if (this.state !== 'ready' && this.state !== 'failed') return undefined;
    this.state = 'removing';
    const attempt: ArkWebProxyAttempt = { phase: 'removing' };
    this.pending = attempt;
    return attempt;
  }

  acknowledge(attempt: ArkWebProxyAttempt): boolean {
    if (this.pending !== attempt) return false;
    this.pending = undefined;
    this.state = attempt.phase === 'configuring' ? 'ready' : 'retired';
    return true;
  }

  fail(attempt: ArkWebProxyAttempt): boolean {
    if (this.pending !== attempt) return false;
    this.pending = undefined;
    this.state = 'failed';
    return true;
  }

  retireWithoutRestore(): void {
    if (this.state === 'ready') this.state = 'retired';
  }
}
