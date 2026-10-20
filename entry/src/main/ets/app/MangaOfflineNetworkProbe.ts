import type { JsonObject } from '@reader/core-harmony';
import type { MangaPlatformObservation, MangaBodyDiagnosticState } from './MangaPlatformObservation';

export type MangaOfflineProbeScope = { sourceId: string; bookId: string };
export type MangaProbeSelectionMode = 'offline' | 'reading';
export const MANGA_PROBE_REQUEST_LIMIT = 8192;
// Fixed RPC labels keep this diagnostic bounded and exclude arbitrary caller text.
const MANGA_PROBE_REQUEST_METHODS: Set<string> = new Set<string>([
  'book.detail', 'book.toc', 'reading.preparation', 'reading.progress.get', 'reading.progress.update',
  'manga.entry.get', 'manga.chapter.get', 'manga.pages.window', 'manga.session.runtime', 'manga.session.replace',
  'manga.session.release', 'manga.resource.prepare', 'manga.resource.inspect', 'manga.cache.classify',
  'manga.cache.recordRead', 'manga.cache.materialization.prepare', 'manga.cache.materialization.complete',
  'manga.cache.materialization.abort', 'manga.cache.eviction.claim',
]);
export type MangaOfflineProbeSnapshot = {
  revision: number; state: 'armed' | 'active' | 'released'; reason: string;
  window: string; coreHttpAttempts: number; imageHttpAttempts: number;
  beforeSelectionCoreHttpAttempts: number; beforeSelectionImageHttpAttempts: number; pendingRequests: number;
  claimedRequests: number; requestLimit: number; requestMethods: JsonObject; capacityRejections: number;
  mode: 'offline' | 'reading'; coverageIncomplete: boolean;
  binding: 'exact-cold-want' | 'first-manga-selection'; identityBound: boolean;
  bookCoverage: 'exact-cold-scope' | 'selected-only';
  beforeSelectionBookCoverage: 'exact-want-scope' | 'not-covered'; beforeSelectionProtected: boolean;
  bodyObservation: 'not-attached' | 'serial-target-manga-image-work' | 'unavailable';
  bodySourceOpens: number; bodySourceReleases: number; bodySourceReleaseErrors: number;
  bodyPixelOpens: number; bodyPixelReleases: number; bodyPixelReleaseErrors: number;
  bodyPackerOpens: number; bodyPackerReleases: number; bodyPackerReleaseErrors: number; bodyRegions: number;
  bodyStateScope: 'process-window'; bodyProcessStart?: MangaBodyDiagnosticState; bodyProcessCurrent?: MangaBodyDiagnosticState;
};

/** One debug cold-start scope. A selection scope owns no book before its first
 * manga shelf click. No credentials, URLs, configuration or disk state. */
export class MangaOfflineNetworkProbe {
  private state: 'armed' | 'active' | 'released' = 'armed';
  private reason: string = 'cold-start';
  private revision: number = 0;
  private coreHttpAttempts: number = 0;
  private imageHttpAttempts: number = 0;
  private beforeSelectionCoreHttpAttempts: number = 0;
  private beforeSelectionImageHttpAttempts: number = 0;
  private capacityRejections: number = 0;
  private coverageIncomplete: boolean = false;
  private bodyObservation: 'not-attached' | 'serial-target-manga-image-work' | 'unavailable' = 'not-attached';
  private bodySourceOpens: number = 0; private bodySourceReleases: number = 0; private bodySourceReleaseErrors: number = 0;
  private bodyPixelOpens: number = 0; private bodyPixelReleases: number = 0; private bodyPixelReleaseErrors: number = 0;
  private bodyPackerOpens: number = 0; private bodyPackerReleases: number = 0; private bodyPackerReleaseErrors: number = 0;
  private bodyRegions: number = 0;
  private bodyProcessStart?: MangaBodyDiagnosticState;
  private bodyProcessCurrent?: MangaBodyDiagnosticState;
  private readonly requests: Set<number> = new Set<number>();
  private readonly claimedRequests: Set<number> = new Set<number>();
  private readonly requestMethods: Map<string, number> = new Map<string, number>();
  private readonly listeners: Set<(state: string) => void> = new Set<(state: string) => void>();

  private scope: MangaOfflineProbeScope | undefined;
  private readonly selectionBound: boolean;
  private readonly report: (state: string) => void;
  readonly mode: 'offline' | 'reading';
  constructor(scope: MangaOfflineProbeScope | undefined, report: (state: string) => void = (): void => {},
    mode: 'offline' | 'reading' = 'offline', selectionBound: boolean = false) {
    if ((selectionBound && scope !== undefined) || (!selectionBound && scope === undefined))
      throw new Error('MANGA_PROBE_SCOPE_CONFLICT');
    this.mode = mode; this.selectionBound = selectionBound;
    this.scope = scope === undefined ? undefined : { sourceId: scope.sourceId, bookId: scope.bookId };
    this.report = report; this.publish();
  }

  select(sourceId: string, bookId: string, manga: boolean): void {
    if (this.state === 'released') return;
    if (!manga || !this.validIdentity(sourceId) || !this.validIdentity(bookId)) {
      this.release('different-selection'); return;
    }
    // The normal bookshelf passes Native's exact identity. This is the only
    // transition that may bind an unscoped cold Want; later selections cannot.
    if (this.selectionBound && this.scope === undefined && this.state === 'armed')
      this.scope = { sourceId, bookId };
    if (this.scope === undefined || sourceId !== this.scope.sourceId || bookId !== this.scope.bookId) {
      this.release('different-selection'); return;
    }
    this.state = 'active'; this.reason = 'shelf-selection'; this.publish();
  }

  matches(sourceId: string, bookId: string): boolean {
    return this.mode === 'offline' && this.state === 'active' && this.scope !== undefined && sourceId === this.scope.sourceId && bookId === this.scope.bookId;
  }

  observesReading(sourceId: string, bookId: string): boolean {
    return this.mode === 'reading' && this.state === 'active' && !this.coverageIncomplete && this.scope !== undefined &&
      sourceId === this.scope.sourceId && bookId === this.scope.bookId;
  }

  readingSamplingEnabled(): boolean { return this.mode === 'reading' && this.state !== 'released' && !this.coverageIncomplete; }

  markReadingCoverageIncomplete(reason: string): void {
    if (this.mode !== 'reading' || this.coverageIncomplete) return;
    this.coverageIncomplete = true; this.reason = reason; this.requests.clear(); this.publish();
  }

  /** Only an exact-ID Want protects before selection. An unbound selection Want
   * cannot suppress any catalog or claim prior network coverage. */
  protectsAutomaticCatalog(sourceId: string, bookId: string): boolean {
    return this.mode === 'offline' && this.state !== 'released' && this.scope !== undefined && sourceId === this.scope.sourceId && bookId === this.scope.bookId;
  }

  ownsCommand(method: string, params: JsonObject): boolean {
    if (this.scope === undefined || this.state === 'released' || (this.mode === 'reading' && this.coverageIncomplete)) return false;
    const chapter = this.object(params['chapter']);
    const location = this.object(params['location']);
    const locatedChapter = this.object(location?.['chapter']);
    const book = this.object(params['book']);
    const identity = chapter ?? locatedChapter ?? book ?? params;
    const kind = params['contentKind'] ?? book?.['contentKind'] ?? location?.['kind'];
    if (this.mode === 'reading' && (kind === 'text' ||
      (this.state === 'armed' && !method.startsWith('manga.') && kind !== 'manga'))) return false;
    const sourceId = identity['sourceId'] ?? params['sourceId'];
    const bookId = identity['bookId'] ?? params['bookId'] ?? (method === 'book.detail' ? params['bookUrl'] : undefined);
    return sourceId === this.scope.sourceId && bookId === this.scope.bookId;
  }

  assertCapacity(): boolean {
    if (this.claimedRequests.size < MANGA_PROBE_REQUEST_LIMIT && !this.coverageIncomplete) return true;
    if (this.mode === 'reading') {
      // A diagnostic limit can only reduce coverage, never reject business.
      this.markReadingCoverageIncomplete('sampling-capacity'); return false;
    }
    this.capacityRejections++; this.publish(); throw new Error('MANGA_OFFLINE_PROBE_CAPACITY');
  }
  track(requestId: number, method: string = 'other-owned'): void {
    if (this.scope === undefined) return;
    if (this.mode === 'reading' && !this.readingSamplingEnabled()) return;
    this.requests.add(requestId);
    if (!this.claimedRequests.has(requestId)) {
      this.claimedRequests.add(requestId);
      const label = MANGA_PROBE_REQUEST_METHODS.has(method) ? method : 'other-owned';
      this.requestMethods.set(label, (this.requestMethods.get(label) ?? 0) + 1);
    }
    if (this.mode === 'reading' && this.claimedRequests.size >= MANGA_PROBE_REQUEST_LIMIT) this.markReadingCoverageIncomplete('sampling-capacity');
    else this.publish();
  }
  settle(requestId: number): void { if (this.requests.delete(requestId)) this.publish(); }
  current(requestId: number): boolean { return this.mode === 'reading' || (this.state !== 'released' && this.requests.has(requestId)); }

  /** Registry invokes this immediately before either real Core HTTP adapter. */
  beforeCoreHttp(requestId: number): void {
    if (!this.claimedRequests.has(requestId)) return;
    if (this.mode === 'reading' && (this.state === 'released' || this.coverageIncomplete)) return;
    if (this.state === 'armed') this.beforeSelectionCoreHttpAttempts++;
    this.coreHttpAttempts++; this.publish();
    if (this.mode === 'offline') throw new Error('MANGA_OFFLINE_PROBE_HTTP_BLOCKED');
  }

  /** Body Host invokes this only at its actual HTTP byte-fetch boundary. */
  beforeImageHttp(requestId: number): void {
    if (!this.claimedRequests.has(requestId)) return;
    if (this.mode === 'reading' && (this.state === 'released' || this.coverageIncomplete)) return;
    if (this.state === 'armed') this.beforeSelectionImageHttpAttempts++;
    this.imageHttpAttempts++; this.publish();
    if (this.mode === 'offline') throw new Error('MANGA_OFFLINE_PROBE_IMAGE_HTTP_BLOCKED');
  }

  release(reason: string): void {
    if (this.state === 'released') return;
    this.state = 'released'; this.reason = reason;
    if (this.mode === 'reading') this.requests.clear();
    this.publish();
    // Bounded tombstones survive SDK waiter settlement: a suspended old Host
    // handler must never escape through a later fetch. New ids remain free.
  }

  bodyObserverAttached(state: MangaBodyDiagnosticState): void {
    if (this.mode !== 'reading') return;
    this.bodyObservation = 'serial-target-manga-image-work';
    this.bodyProcessStart = { ...state }; this.bodyProcessCurrent = { ...state }; this.publish();
  }

  bodyObserverUnavailable(): void {
    if (this.mode !== 'reading') return;
    this.bodyObservation = 'unavailable'; this.publish();
  }

  observeBody(event: MangaPlatformObservation): void {
    if (this.mode !== 'reading' || this.state !== 'active' || this.coverageIncomplete || event.stage !== 'body') return;
    if (event.event === 'region') this.bodyRegions++;
    if (event.resource === 'source') {
      if (event.event === 'open') this.bodySourceOpens++;
      if (event.event === 'release') this.bodySourceReleases++;
      if (event.event === 'release-error') this.bodySourceReleaseErrors++;
    } else if (event.resource === 'pixel') {
      if (event.event === 'open') this.bodyPixelOpens++;
      if (event.event === 'release') this.bodyPixelReleases++;
      if (event.event === 'release-error') this.bodyPixelReleaseErrors++;
    } else if (event.resource === 'packer') {
      if (event.event === 'open') this.bodyPackerOpens++;
      if (event.event === 'release') this.bodyPackerReleases++;
      if (event.event === 'release-error') this.bodyPackerReleaseErrors++;
    } else if (event.event !== 'region') return;
    this.publish();
  }

  observeBodyState(state: MangaBodyDiagnosticState): void {
    if (this.mode !== 'reading') return;
    this.bodyProcessCurrent = { ...state }; this.publish();
  }

  finish(sourceId: string, bookId: string): void {
    if (this.scope !== undefined && sourceId === this.scope.sourceId && bookId === this.scope.bookId) this.release('reader-left');
  }

  snapshot(): string {
    const requestMethods: JsonObject = {};
    for (const [method, count] of this.requestMethods) requestMethods[method] = count;
    let window = this.mode === 'offline' ? 'cold-want-arm' : this.state === 'armed' ? 'cold-want-before-selection' :
      this.state === 'active' ? 'selected-online-reading' : 'released-online-reading';
    if (this.selectionBound) {
      if (this.state === 'armed') window = 'cold-want-awaiting-manga-selection';
      else if (this.state === 'active') window = this.mode === 'offline' ? 'selected-offline-reading' : 'selected-online-reading';
      else window = this.mode === 'offline' ? 'released-selected-offline-reading' : 'released-online-reading';
    }
    const value: MangaOfflineProbeSnapshot = { revision: this.revision, state: this.state, reason: this.reason,
      window,
      coreHttpAttempts: this.coreHttpAttempts, imageHttpAttempts: this.imageHttpAttempts,
      beforeSelectionCoreHttpAttempts: this.beforeSelectionCoreHttpAttempts,
      beforeSelectionImageHttpAttempts: this.beforeSelectionImageHttpAttempts, pendingRequests: this.requests.size,
      claimedRequests: this.claimedRequests.size, requestLimit: MANGA_PROBE_REQUEST_LIMIT,
      requestMethods, capacityRejections: this.capacityRejections,
      mode: this.mode, coverageIncomplete: this.coverageIncomplete,
      binding: this.selectionBound ? 'first-manga-selection' : 'exact-cold-want', identityBound: this.scope !== undefined,
      bookCoverage: this.selectionBound ? 'selected-only' : 'exact-cold-scope',
      beforeSelectionBookCoverage: this.selectionBound ? 'not-covered' : 'exact-want-scope',
      beforeSelectionProtected: !this.selectionBound && this.mode === 'offline', bodyObservation: this.bodyObservation,
      bodySourceOpens: this.bodySourceOpens, bodySourceReleases: this.bodySourceReleases, bodySourceReleaseErrors: this.bodySourceReleaseErrors,
      bodyPixelOpens: this.bodyPixelOpens, bodyPixelReleases: this.bodyPixelReleases, bodyPixelReleaseErrors: this.bodyPixelReleaseErrors,
      bodyPackerOpens: this.bodyPackerOpens, bodyPackerReleases: this.bodyPackerReleases, bodyPackerReleaseErrors: this.bodyPackerReleaseErrors,
      bodyRegions: this.bodyRegions, bodyStateScope: 'process-window', bodyProcessStart: this.bodyProcessStart,
      bodyProcessCurrent: this.bodyProcessCurrent };
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

  private validIdentity(value: string): boolean {
    return typeof value === 'string' && value.length > 0 && value.length <= 8192 && value.trim() === value &&
      !/[\u0000-\u001f\u007f]/.test(value);
  }

  private object(value: unknown): JsonObject | undefined {
    return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : undefined;
  }
}
