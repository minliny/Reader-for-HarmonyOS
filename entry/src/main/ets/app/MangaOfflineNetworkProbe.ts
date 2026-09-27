import type { JsonObject } from '@reader/core-harmony';

export type MangaOfflineProbeScope = { sourceId: string; bookId: string };
export type MangaOfflineProbeSnapshot = {
  revision: number; state: 'armed' | 'active' | 'released'; reason: string;
  window: string; coreHttpAttempts: number; imageHttpAttempts: number;
  beforeSelectionCoreHttpAttempts: number; beforeSelectionImageHttpAttempts: number; pendingRequests: number;
  claimedRequests: number; capacityRejections: number;
};

/** One debug cold-start scope. No credentials, URLs, configuration or disk state. */
export class MangaOfflineNetworkProbe {
  private state: 'armed' | 'active' | 'released' = 'armed';
  private reason: string = 'cold-start';
  private revision: number = 0;
  private coreHttpAttempts: number = 0;
  private imageHttpAttempts: number = 0;
  private beforeSelectionCoreHttpAttempts: number = 0;
  private beforeSelectionImageHttpAttempts: number = 0;
  private capacityRejections: number = 0;
  private readonly requests: Set<number> = new Set<number>();
  private readonly claimedRequests: Set<number> = new Set<number>();
  private readonly listeners: Set<(state: string) => void> = new Set<(state: string) => void>();

  private readonly scope: MangaOfflineProbeScope;
  private readonly report: (state: string) => void;
  constructor(scope: MangaOfflineProbeScope, report: (state: string) => void = (): void => {}) {
    this.scope = { sourceId: scope.sourceId, bookId: scope.bookId }; this.report = report; this.publish();
  }

  select(sourceId: string, bookId: string, manga: boolean): void {
    if (this.state === 'released') return;
    if (!manga || sourceId !== this.scope.sourceId || bookId !== this.scope.bookId) {
      this.release('different-selection'); return;
    }
    this.state = 'active'; this.reason = 'shelf-selection'; this.publish();
  }

  matches(sourceId: string, bookId: string): boolean {
    return this.state === 'active' && sourceId === this.scope.sourceId && bookId === this.scope.bookId;
  }

  ownsCommand(method: string, params: JsonObject): boolean {
    if (this.state === 'released') return false;
    const chapter = this.object(params['chapter']);
    const location = this.object(params['location']);
    const locatedChapter = this.object(location?.['chapter']);
    const book = this.object(params['book']);
    const identity = chapter ?? locatedChapter ?? book ?? params;
    const sourceId = identity['sourceId'] ?? params['sourceId'];
    const bookId = identity['bookId'] ?? params['bookId'] ?? (method === 'book.detail' ? params['bookUrl'] : undefined);
    return sourceId === this.scope.sourceId && bookId === this.scope.bookId;
  }

  assertCapacity(): void {
    if (this.claimedRequests.size < 256) return;
    this.capacityRejections++; this.publish(); throw new Error('MANGA_OFFLINE_PROBE_CAPACITY');
  }
  track(requestId: number): void { this.requests.add(requestId); this.claimedRequests.add(requestId); this.publish(); }
  settle(requestId: number): void { if (this.requests.delete(requestId)) this.publish(); }
  current(requestId: number): boolean { return this.state !== 'released' && this.requests.has(requestId); }

  /** Registry invokes this immediately before either real Core HTTP adapter. */
  beforeCoreHttp(requestId: number): void {
    if (!this.claimedRequests.has(requestId)) return;
    if (this.state === 'armed') this.beforeSelectionCoreHttpAttempts++;
    this.coreHttpAttempts++; this.publish();
    throw new Error('MANGA_OFFLINE_PROBE_HTTP_BLOCKED');
  }

  /** Body Host invokes this only at its actual HTTP byte-fetch boundary. */
  beforeImageHttp(requestId: number): void {
    if (!this.claimedRequests.has(requestId)) return;
    if (this.state === 'armed') this.beforeSelectionImageHttpAttempts++;
    this.imageHttpAttempts++; this.publish();
    throw new Error('MANGA_OFFLINE_PROBE_IMAGE_HTTP_BLOCKED');
  }

  release(reason: string): void {
    if (this.state === 'released') return;
    this.state = 'released'; this.reason = reason; this.publish();
    // Bounded tombstones survive SDK waiter settlement: a suspended old Host
    // handler must never escape through a later fetch. New ids remain free.
  }

  finish(sourceId: string, bookId: string): void {
    if (sourceId === this.scope.sourceId && bookId === this.scope.bookId) this.release('reader-left');
  }

  snapshot(): string {
    const value: MangaOfflineProbeSnapshot = { revision: this.revision, state: this.state, reason: this.reason,
      window: 'cold-want-arm', coreHttpAttempts: this.coreHttpAttempts, imageHttpAttempts: this.imageHttpAttempts,
      beforeSelectionCoreHttpAttempts: this.beforeSelectionCoreHttpAttempts,
      beforeSelectionImageHttpAttempts: this.beforeSelectionImageHttpAttempts, pendingRequests: this.requests.size,
      claimedRequests: this.claimedRequests.size, capacityRejections: this.capacityRejections };
    return JSON.stringify(value);
  }

  subscribe(listener: (state: string) => void): () => void {
    this.listeners.add(listener); listener(this.snapshot());
    return (): void => { this.listeners.delete(listener); };
  }

  private publish(): void {
    this.revision++;
    const value = this.snapshot();
    try { this.report(value); } catch (_) { /* Observation never affects ownership. */ }
    for (const listener of this.listeners) { try { listener(value); } catch (_) {} }
  }

  private object(value: unknown): JsonObject | undefined {
    return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : undefined;
  }
}
