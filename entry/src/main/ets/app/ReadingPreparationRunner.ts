import type { JsonObject, ReaderCoreResultEvent } from '@reader/core-harmony';
import type { BookRequestOptions, BookRequestPriority } from './BookRequestScheduler';
import { RemoteReadingGatewayError } from '../features/reading/RemoteReadingContract';

export interface ReadingPreparationIntent {
  schemaVersion: number;
  sourceId: string;
  bookId: string;
  revision: number;
  sourceVersion: string;
  reason: 'add' | 'read' | 'download' | 'suppressed';
  state: 'active' | 'paused' | 'blocked' | 'cancelled' | 'completed';
  updatedAt: number;
  pendingAdd?: JsonObject;
}

export interface ReadingPreparationAdapter {
  request(method: string, params: JsonObject, options: BookRequestOptions,
    priority: BookRequestPriority): Promise<ReaderCoreResultEvent>;
  add(intent: ReadingPreparationIntent, current: () => boolean,
    priority: BookRequestPriority): Promise<ReaderCoreResultEvent>;
  catalog(intent: ReadingPreparationIntent, book: JsonObject, current: () => boolean): Promise<void>;
}

function object(value: unknown): JsonObject | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : undefined;
}

/** Reuse the Core/feature boundary's retry decision. This does not retry or
 * schedule anything: a later existing foreground/network/progress event owns
 * the next attempt. In particular, do not reopen a Core-blocked queue. */
function retryablePreparationFailure(error: Error): boolean {
  let cause: unknown = error;
  for (let depth = 0; depth < 6; depth += 1) {
    if (cause instanceof RemoteReadingGatewayError) {
      if (cause.transientTransport || cause.code === 'networkEnvironment') return true;
      cause = cause.causeValue;
      continue;
    }
    const raw = object(cause);
    const failure = object(object(raw?.['event'])?.['error']) ?? object(raw?.['error']) ?? raw;
    if (failure?.['retryable'] === true) return true;
    // The SDK exposes its confirmed RPC timeout as an Error, not CoreError.
    return cause instanceof Error && /^Reader-Core request timed out: \d+$/.test(cause.message);
  }
  return false;
}

export function decodeReadingPreparationIntents(data: JsonObject): ReadingPreparationIntent[] {
  const rows = data['intents'];
  if (!Array.isArray(rows)) throw new Error('READING_PREPARATION_INVALID_INTENTS');
  return rows.map((value): ReadingPreparationIntent => {
    const row = object(value);
    if (row === undefined || row['schemaVersion'] !== 1 || typeof row['sourceId'] !== 'string' ||
      row['sourceId'].trim().length === 0 || typeof row['bookId'] !== 'string' || row['bookId'].trim().length === 0 ||
      typeof row['revision'] !== 'number' || !Number.isSafeInteger(row['revision']) || row['revision'] < 1 ||
      typeof row['sourceVersion'] !== 'string' || typeof row['updatedAt'] !== 'number' ||
      !['add', 'read', 'download', 'suppressed'].includes(row['reason'] as string) ||
      !['active', 'paused', 'blocked', 'cancelled', 'completed'].includes(row['state'] as string))
      throw new Error('READING_PREPARATION_INVALID_INTENT');
    const pendingAdd = object(row['pendingAdd']);
    if (pendingAdd !== undefined && (pendingAdd['sourceId'] !== row['sourceId'] || pendingAdd['bookId'] !== row['bookId']))
      throw new Error('READING_PREPARATION_ADD_IDENTITY_MISMATCH');
    return { schemaVersion: 1, sourceId: row['sourceId'], bookId: row['bookId'], revision: row['revision'],
      sourceVersion: row['sourceVersion'], updatedAt: row['updatedAt'],
      reason: row['reason'] as ReadingPreparationIntent['reason'], state: row['state'] as ReadingPreparationIntent['state'], pendingAdd };
  });
}

/** Durable intent lives in Core; this is one event-driven business traversal.
 * It owns no retry timer or chapter queue. The existing scheduler executes
 * requests and Core's download queue owns missing-body acquisition. */
export class ReadingPreparationRunner {
  private adapter: ReadingPreparationAdapter;
  private task: Promise<void> | undefined = undefined;
  private allowed: () => boolean = (): boolean => false;
  private allowCatalog: () => boolean = (): boolean => false;
  private generation: number = 0;
  private closed: boolean = false;
  private requested: boolean = false;

  constructor(adapter: ReadingPreparationAdapter) { this.adapter = adapter; }

  resume(allowed: () => boolean, allowCatalog: () => boolean = (): boolean => true): Promise<void> {
    this.allowed = allowed;
    this.allowCatalog = allowCatalog;
    if (this.closed || !allowed()) return Promise.resolve();
    this.requested = true;
    if (this.task !== undefined) return this.task;
    // Install ownership before the adapter can synchronously call back.
    const task = Promise.resolve().then(async (): Promise<void> => {
      while (!this.closed && this.requested && this.allowed()) {
        this.requested = false;
        const generation = this.generation;
        await this.run((): boolean => !this.closed && generation === this.generation && this.allowed());
      }
    });
    this.task = task.finally((): void => { this.task = undefined; });
    return this.task;
  }

  suspend(): void { this.generation += 1; this.requested = false; }
  close(): void { this.closed = true; this.suspend(); }

  private options(current: () => boolean): BookRequestOptions {
    return { shouldCancel: (): boolean => !current(), canContinue: current, canDispatch: current };
  }

  private async run(current: () => boolean): Promise<void> {
    const intents: ReadingPreparationIntent[] = [];
    const seen = new Set<string>();
    const limit = 100;
    for (let offset = 0; current(); offset += limit) {
      const result = await this.adapter.request('reading.preparation', { action: 'list', offset, limit }, this.options(current), 'background');
      if (!current()) return;
      const page = decodeReadingPreparationIntents(result.data);
      for (const intent of page) {
        const key = JSON.stringify([intent.sourceId, intent.bookId]);
        // Clear may leave a tombstone even when this book never had an intent.
        // It must decode with the page, but can never grant acquisition rights.
        if (intent.state === 'active' && intent.reason !== 'suppressed' && intent.sourceId !== 'local' && !seen.has(key)) {
          seen.add(key); intents.push(intent);
        }
      }
      if (page.length < limit) break;
    }
    const deferred = new Set<string>();
    // Every current chapter gets its turn before any optional neighbour.
    for (const neighborOffset of [0, 1, -1, 2, -2, 3, -3]) {
      for (let index = 0; index < intents.length; index += 1) {
        if (!current()) return;
        let intent = intents[index];
        const key = JSON.stringify([intent.sourceId, intent.bookId]);
        if (deferred.has(key) || intent.state !== 'active') continue;
        try {
          if (intent.reason === 'add' && intent.pendingAdd !== undefined) {
            await this.adapter.add(intent, current, 'background');
            if (!current()) return;
            const status = await this.adapter.request('reading.preparation', { action: 'status',
              sourceId: intent.sourceId, bookId: intent.bookId }, this.options(current), 'background');
            const next = decodeReadingPreparationIntents(status.data).find((row: ReadingPreparationIntent): boolean =>
              row.sourceId === intent.sourceId && row.bookId === intent.bookId);
            if (next === undefined || next.state !== 'active' || next.reason === 'add' || next.reason === 'suppressed') {
              deferred.add(key); continue;
            }
            intent = next; intents[index] = next;
          }
          const outcome = await this.prepare(intent, neighborOffset, current);
          if (outcome === 'deferred') deferred.add(key);
        } catch (error) {
          if (!current()) return;
          deferred.add(key);
          await this.block(intent, error as Error, current);
        }
      }
    }
  }

  private async prepare(intent: ReadingPreparationIntent, neighborOffset: number,
    current: () => boolean): Promise<'ready' | 'deferred'> {
    const params: JsonObject = { sourceId: intent.sourceId, bookId: intent.bookId, neighborOffset };
    const prepare = (): Promise<ReaderCoreResultEvent> => this.adapter.request('reading.entry.prepare', params, this.options(current), 'background');
    let result = await prepare();
    if (!current()) return 'deferred';
    this.assertIdentity(result.data, intent);
    if (result.data['kind'] === 'missing' && result.data['reason'] === 'catalogMissing') {
      if (neighborOffset !== 0 || !this.allowCatalog()) return 'deferred';
      const shelf = await this.adapter.request('bookshelf.get', { sourceId: intent.sourceId, bookId: intent.bookId }, this.options(current), 'background');
      if (!current()) return 'deferred';
      const book = object(shelf.data['book']);
      if (book === undefined) return 'deferred';
      this.assertIdentity(book, intent);
      await this.adapter.catalog(intent, book, current);
      if (!current()) return 'deferred';
      result = await prepare(); this.assertIdentity(result.data, intent);
    }
    if (!current()) return 'deferred';
    if (result.data['kind'] === 'ready' || result.data['reason'] === 'neighborAbsent') return 'ready';
    if (result.data['kind'] === 'missing' && result.data['reason'] === 'contentMissing') {
      const chapterIndex = result.data['chapterIndex'];
      if (typeof chapterIndex !== 'number' || !Number.isSafeInteger(chapterIndex) || chapterIndex < 0 || chapterIndex >= 0xFFFFFFFF)
        throw new Error('READING_PREPARATION_INVALID_CHAPTER');
      // Never force-refresh an existing original or read/write user progress.
      // The revision is rechecked by Core before any late network publication.
      await this.adapter.request('cache.book.prefetch', { sourceId: intent.sourceId, bookId: intent.bookId,
        preparationRevision: intent.revision, chapterRange: [chapterIndex, chapterIndex + 1] }, this.options(current), 'background');
      if (!current()) return 'deferred';
      result = await prepare(); this.assertIdentity(result.data, intent);
      if (!current()) return 'deferred';
      if (result.data['kind'] === 'ready' || result.data['reason'] === 'neighborAbsent') return 'ready';
      // Reading may advance while the old target is fetched. Its success says
      // nothing about the new target; the coalesced progress event owns it.
      if (result.data['chapterIndex'] !== chapterIndex) return 'deferred';
      if (result.data['reason'] === 'contentMissing') throw new Error('READING_PREPARATION_BODY_UNAVAILABLE');
    }
    const reason = result.data['reason'];
    if (reason === 'sourceSwitchPending' || reason === 'catalogMissing' || reason === 'contentChanged' ||
      reason === 'catalogChanged' || reason === 'preparationInterrupted') return 'deferred';
    // Capacity/unsupported documents are an explicit stop, not an idle loop.
    throw new Error(`READING_PREPARATION_${typeof reason === 'string' ? reason : 'INVALID_RESULT'}`);
  }

  private assertIdentity(data: JsonObject, intent: ReadingPreparationIntent): void {
    if (data['sourceId'] !== intent.sourceId || data['bookId'] !== intent.bookId)
      throw new Error('READING_PREPARATION_IDENTITY_MISMATCH');
  }

  async block(intent: ReadingPreparationIntent, error: Error, current: () => boolean): Promise<void> {
    if (!current() || retryablePreparationFailure(error)) return;
    try {
      await this.adapter.request('reading.preparation', { action: 'block', sourceId: intent.sourceId,
        bookId: intent.bookId, revision: intent.revision, blockReason: (error.message || 'preparationFailed').slice(0, 400) },
      this.options(current), 'background');
    } catch (failure) {
      if (!current()) return;
      // A late Core failure may already have blocked or cancelled this intent.
      // Read the fact once; an unrelated persistence failure is not success.
      const status = await this.adapter.request('reading.preparation', { action: 'status',
        sourceId: intent.sourceId, bookId: intent.bookId }, this.options(current), 'background');
      const latest = decodeReadingPreparationIntents(status.data).find((row: ReadingPreparationIntent): boolean =>
        row.sourceId === intent.sourceId && row.bookId === intent.bookId);
      if (latest !== undefined && latest.revision === intent.revision && latest.state === 'active') throw failure;
    }
  }
}
