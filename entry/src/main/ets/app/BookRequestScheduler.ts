import type { JsonObject, ReaderCoreResultEvent, RequestOptions } from '@reader/core-harmony';

export type BookRequestPriority = 'foreground' | 'search' | 'background';
export type BookRequestExecutor = (
  method: string, params: JsonObject, options: RequestOptions,
) => Promise<ReaderCoreResultEvent>;

export interface BookRequestOptions extends RequestOptions {
  /** Page visibility delays queued work without invalidating its query. */
  canDispatch?: () => boolean;
  /** Process/source validity survives the page-owned cancellation boundary. */
  canContinue?: () => boolean;
  /** Called at the executor boundary, including a join to an already started request. */
  onDispatch?: () => void;
}

type Consumer = { cancelled?: () => boolean; canDispatch?: () => boolean; onDispatch?: () => void };
type RequestJob = {
  key: string;
  method: string;
  params: JsonObject;
  options: BookRequestOptions;
  priority: BookRequestPriority;
  queuedAt: number;
  started: boolean;
  consumers: Consumer[];
  promise: Promise<ReaderCoreResultEvent>;
  resolve: (result: ReaderCoreResultEvent) => void;
  reject: (error: Error) => void;
};

function priorityRank(priority: BookRequestPriority): number {
  return priority === 'foreground' ? 0 : priority === 'search' ? 1 : 2;
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
    if (job !== undefined) {
      job.consumers.push({ cancelled: options.shouldCancel, canDispatch: options.canDispatch, onDispatch: options.onDispatch });
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
    job = { key, method, params, options, priority, queuedAt: Date.now(), started: false,
      consumers: [{ cancelled: options.shouldCancel, canDispatch: options.canDispatch, onDispatch: options.onDispatch }],
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
    if (this.closed || job.options.canContinue?.() === false) return true;
    if (job.started && (job.method === 'book.detail' || job.method === 'book.toc' || job.method === 'chapter.content')) return false;
    return job.consumers.every((consumer: Consumer): boolean => consumer.cancelled?.() === true);
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
        consumer.cancelled?.() !== true && consumer.canDispatch?.() !== false)) { index += 1; continue; }
      // Six total requests; reserve one slot for reading, cap preparation at two.
      if (this.active >= 6 || (job.priority !== 'foreground' && this.active >= 5) ||
        (job.priority === 'background' && this.backgroundActive >= 2)) { index += 1; continue; }
      this.queue.splice(index, 1);
      this.active += 1;
      const background = job.priority === 'background';
      if (background) this.backgroundActive += 1;
      job.started = true;
      for (const consumer of job.consumers) {
        if (consumer.cancelled?.() !== true) consumer.onDispatch?.();
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
