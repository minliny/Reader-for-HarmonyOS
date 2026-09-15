import type { JsonObject, ReaderCoreResultEvent, RequestOptions } from '@reader/core-harmony';

export type BookRequestPriority = 'foreground' | 'search' | 'background';
export type BookRequestExecutor = (
  method: string, params: JsonObject, options: RequestOptions,
) => Promise<ReaderCoreResultEvent>;

export interface BookRequestOptions extends RequestOptions {
  /** Page visibility delays queued work without invalidating its query. */
  canDispatch?: () => boolean;
  /** Additional validity of this consumer, including source/session lifetime. */
  canContinue?: () => boolean;
  /** Called at the executor boundary, including a join to an already started request. */
  onDispatch?: () => void;
}

type Consumer = { cancelled?: () => boolean; canContinue?: () => boolean;
  canDispatch?: () => boolean; onDispatch?: () => void };
type RequestJob = {
  key: string;
  method: string;
  params: JsonObject;
  options: BookRequestOptions;
  priority: BookRequestPriority;
  queuedAt: number;
  started: boolean;
  cancellationRequested: boolean;
  consumers: Consumer[];
  promise: Promise<ReaderCoreResultEvent>;
  resolve: (result: ReaderCoreResultEvent) => void;
  reject: (error: Error) => void;
};

function priorityRank(priority: BookRequestPriority): number {
  return priority === 'foreground' ? 0 : priority === 'search' ? 1 : 2;
}

/** Shared source-sweep cursor from SearchOrchestrator. Each completion frees
 * its lane immediately; a slow source never blocks the next whole batch. The
 * request scheduler below still owns actual network concurrency and priority. */
export async function runBookSourceWorkers<T>(sources: T[], concurrency: number,
  visit: (source: T) => Promise<void>, beforeDispatch: () => Promise<boolean>): Promise<void> {
  let next = 0;
  let failed = false;
  const worker = async (): Promise<void> => {
    while (!failed && next < sources.length) {
      if (!await beforeDispatch() || failed) return;
      const source = sources[next++];
      if (source === undefined) return;
      try { await visit(source); }
      catch (error) { failed = true; throw error; }
    }
  };
  const workers: Promise<void>[] = [];
  for (let index = 0; index < Math.min(concurrency, sources.length); index += 1) workers.push(worker());
  await Promise.all(workers);
}

/** In-flight sharing only. Core remains the durable response/cache owner. */
export class BookRequestScheduler {
  private jobs: Map<string, RequestJob> = new Map();
  private queue: RequestJob[] = [];
  private active: number = 0;
  private backgroundActive: number = 0;
  private closed: boolean = false;

  private execute: BookRequestExecutor;

  constructor(execute: BookRequestExecutor) {
    this.execute = execute;
  }

  request(method: string, params: JsonObject, options: BookRequestOptions,
    version: string, priority: BookRequestPriority): Promise<ReaderCoreResultEvent> {
    if (this.closed) return Promise.reject(new Error('书籍任务已关闭'));
    // Preserve rule variables and all semantic parameters in the sharing key.
    // Diagnostic/replay Host overrides are intentionally not shared.
    const key = JSON.stringify([method, version, params]);
    let job = options.hostRequest === undefined ? this.jobs.get(key) : undefined;
    // Once Core has observed cancellation, a later same-key caller must start
    // a new request instead of reviving an operation already being unwound.
    if (job !== undefined && this.cancelled(job)) job = undefined;
    if (job !== undefined) {
      job.consumers.push({ cancelled: options.shouldCancel, canContinue: options.canContinue,
        canDispatch: options.canDispatch, onDispatch: options.onDispatch });
      if (job.started) options.onDispatch?.();
      if (priorityRank(priority) < priorityRank(job.priority)) job.priority = priority;
      this.drain();
      return job.promise;
    }
    let resolveResult: (result: ReaderCoreResultEvent) => void = (): void => {};
    let rejectResult: (error: Error) => void = (): void => {};
    const promise = new Promise<ReaderCoreResultEvent>((resolve, reject): void => {
      resolveResult = resolve;
      rejectResult = reject;
    });
    job = { key, method, params, options, priority, queuedAt: Date.now(), started: false, cancellationRequested: false,
      consumers: [{ cancelled: options.shouldCancel, canContinue: options.canContinue,
        canDispatch: options.canDispatch, onDispatch: options.onDispatch }],
      promise, resolve: resolveResult, reject: rejectResult };
    if (options.hostRequest === undefined) this.jobs.set(key, job);
    this.queue.push(job);
    this.drain();
    return promise;
  }

  promote(sourceId: string, bookId: string): void {
    for (const job of this.queue) {
      const book = job.params['book'] as JsonObject | undefined;
      if (job.params['sourceId'] === sourceId && (job.params['bookId'] === bookId || book?.['bookId'] === bookId)) {
        job.priority = 'foreground';
      }
    }
    this.drain();
  }

  visibilityChanged(): void { this.drain(); }

  close(): void {
    this.closed = true;
    for (const job of this.queue) {
      job.reject(new Error('书籍任务已关闭'));
      if (this.jobs.get(job.key) === job) this.jobs.delete(job.key);
    }
    this.queue = [];
  }

  private cancelled(job: RequestJob): boolean {
    if (this.closed || job.cancellationRequested) return true;
    if (job.consumers.every((consumer: Consumer): boolean =>
      consumer.cancelled?.() === true || consumer.canContinue?.() === false)) {
      job.cancellationRequested = true;
      return true;
    }
    return false;
  }

  private drain(): void {
    const now = Date.now();
    // Aging allows catalog preparation to make progress during long searches.
    this.queue.sort((a: RequestJob, b: RequestJob): number => {
      const aRank = a.priority === 'background' && now - a.queuedAt >= 5000 ? 1 : priorityRank(a.priority);
      const bRank = b.priority === 'background' && now - b.queuedAt >= 5000 ? 1 : priorityRank(b.priority);
      return aRank - bRank || a.queuedAt - b.queuedAt;
    });
    for (let index = 0; index < this.queue.length;) {
      const job = this.queue[index];
      if (this.cancelled(job)) {
        this.queue.splice(index, 1);
        if (this.jobs.get(job.key) === job) this.jobs.delete(job.key);
        job.reject(new Error('书籍请求已取消'));
        continue;
      }
      if (!job.consumers.some((consumer: Consumer): boolean =>
        consumer.cancelled?.() !== true && consumer.canContinue?.() !== false &&
          consumer.canDispatch?.() !== false)) { index += 1; continue; }
      // Six total requests; reserve one slot for reading, cap preparation at two.
      if (this.active >= 6 || (job.priority !== 'foreground' && this.active >= 5) ||
        (job.priority === 'background' && this.backgroundActive >= 2)) { index += 1; continue; }
      this.queue.splice(index, 1);
      this.active += 1;
      const background = job.priority === 'background';
      if (background) this.backgroundActive += 1;
      job.started = true;
      for (const consumer of job.consumers) {
        if (consumer.cancelled?.() !== true && consumer.canContinue?.() !== false) consumer.onDispatch?.();
      }
      const requestOptions: RequestOptions = { timeoutMs: job.options.timeoutMs,
        pollMs: job.options.pollMs, hostRequest: job.options.hostRequest,
        shouldCancel: (): boolean => this.cancelled(job) };
      // Convert a synchronous adapter throw to the same completion path so
      // occupied slots are always released.
      let execution: Promise<ReaderCoreResultEvent>;
      try { execution = this.execute(job.method, job.params, requestOptions); }
      catch (error) { execution = Promise.reject(error); }
      void execution.then(job.resolve, job.reject)
        .finally((): void => {
          this.active -= 1;
          if (background) this.backgroundActive -= 1;
          if (this.jobs.get(job.key) === job) this.jobs.delete(job.key);
          this.drain();
        });
    }
  }
}
