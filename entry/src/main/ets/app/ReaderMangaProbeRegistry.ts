import type { JsonObject, RequestOptions } from '@reader/core-harmony';
import type { BookRequestOptions } from './BookRequestScheduler';
import { MangaOfflineNetworkProbe, type MangaOfflineProbeScope, type MangaProbeSelectionMode } from './MangaOfflineNetworkProbe';
import type { MangaPlatformObserver, MangaBodyDiagnosticState } from '../platform/reading-resources/MangaPlatformObservation';

interface MangaProbeBodyObservation {
  attachDiagnosticObserver(observer: MangaPlatformObserver, debug: boolean, buildMode: string): () => void;
  diagnosticState(debug: boolean, buildMode: string): MangaBodyDiagnosticState;
}

interface MangaProbeRequest {
  readonly requestId: number;
  waitOptions(): RequestOptions;
  settle(): void;
}

/** Owns the original diagnostic probe, exact command tickets, and body observation lease. */
export class ReaderMangaProbeRegistry {
  readonly network: MangaOfflineNetworkProbe | undefined = undefined;
  private readonly body: () => MangaProbeBodyObservation;
  private detachBodyObserver: (() => void) | undefined;
  private releaseObserver: (() => void) | undefined;
  private imageScope: MangaOfflineProbeScope | undefined;
  private foreignImages: number = 0;

  constructor(body: () => MangaProbeBodyObservation, log: (label: string, state: string) => void,
    offlineScope?: MangaOfflineProbeScope, readingScope?: MangaOfflineProbeScope, selectionMode?: MangaProbeSelectionMode) {
    this.body = body;
    const conflictingScope = offlineScope !== undefined && readingScope !== undefined;
    const conflictingSelection = selectionMode !== undefined && (offlineScope !== undefined || readingScope !== undefined);
    if (conflictingScope || conflictingSelection) return;
    if (selectionMode !== undefined) {
      const label = selectionMode === 'offline' ? 'MANGA_OFFLINE_PROBE %{public}s' : 'MANGA_READING_PROBE %{public}s';
      this.network = new MangaOfflineNetworkProbe(undefined, (state: string): void => log(label, state), selectionMode, true);
    } else if (offlineScope !== undefined) {
      this.network = new MangaOfflineNetworkProbe(offlineScope, (state: string): void => log('MANGA_OFFLINE_PROBE %{public}s', state));
    } else if (readingScope !== undefined) {
      this.network = new MangaOfflineNetworkProbe(readingScope, (state: string): void => log('MANGA_READING_PROBE %{public}s', state), 'reading');
    }
  }

  readingSamplingEnabled(): boolean { return this.network?.readingSamplingEnabled() === true; }

  beginRequest(method: string, params: JsonObject, send: () => number, options: BookRequestOptions,
    defaultTimeoutMs: number): MangaProbeRequest | undefined {
    const probe = this.network;
    if (probe?.ownsCommand(method, params) !== true || !probe.assertCapacity()) return undefined;
    // Register this exact native request id before the Host can poll its work.
    const requestId = send();
    probe.track(requestId, method);
    return {
      requestId,
      waitOptions: (): RequestOptions => {
        if (probe.mode === 'reading') {
          return options.timeoutMs !== undefined ? options : {
            timeoutMs: defaultTimeoutMs, pollMs: options.pollMs,
            hostRequest: options.hostRequest, shouldCancel: options.shouldCancel,
          };
        }
        return { ...options, timeoutMs: options.timeoutMs ?? defaultTimeoutMs,
          shouldCancel: (): boolean => options.shouldCancel?.() === true ||
            (method !== 'reading.progress.update' && !probe.current(requestId)) };
      },
      settle: (): void => probe.settle(requestId),
    };
  }

  bindReadingBody(): void {
    const probe = this.network;
    if (probe?.mode !== 'reading') return;
    const body = this.body();
    try {
      this.detachBodyObserver = body.attachDiagnosticObserver((event): void => {
        const scope = this.imageScope;
        if (scope !== undefined && this.foreignImages === 0 && probe.observesReading(scope.sourceId, scope.bookId))
          probe.observeBody(event);
      }, true, 'debug');
      probe.bodyObserverAttached(body.diagnosticState(true, 'debug'));
      this.releaseObserver = probe.subscribe((): void => {
        if (!probe.readingSamplingEnabled()) this.detachReadingBody();
      });
    } catch (_) {
      this.detachBodyObserver?.(); this.detachBodyObserver = undefined;
      probe.bodyObserverUnavailable();
    }
  }

  private detachReadingBody(): void {
    const detach = this.detachBodyObserver, unsubscribe = this.releaseObserver;
    this.detachBodyObserver = undefined; this.releaseObserver = undefined;
    detach?.(); unsubscribe?.();
    if (detach !== undefined) {
      try { this.network?.observeBodyState(this.body().diagnosticState(true, 'debug')); } catch (_) {}
    }
  }

  /** Debug-only attribution around the existing operation. It owns no image
   * work, and cannot change the lane, priority, current fence or returned value. */
  async observeReadingImageWork<T>(sourceId: string, bookId: string, manga: boolean,
    run: () => Promise<T>, readDrain?: () => Promise<void> | undefined): Promise<T> {
    const probe = this.network;
    if (probe?.mode !== 'reading' || !probe.readingSamplingEnabled()) return run();
    const target = manga && probe?.observesReading(sourceId, bookId) === true;
    if (!target) {
      this.foreignImages++;
      if (this.imageScope !== undefined) probe?.markReadingCoverageIncomplete('body-scope-overlap');
      try { return await run(); } finally { this.foreignImages--; }
    }
    if (this.foreignImages > 0) probe?.markReadingCoverageIncomplete('body-scope-overlap');
    const scope: MangaOfflineProbeScope = { sourceId, bookId };
    this.imageScope = scope;
    const finish = (): void => {
      if (this.imageScope !== scope) return;
      this.imageScope = undefined;
      try { probe?.observeBodyState(this.body().diagnosticState(true, 'debug')); } catch (_) {}
    };
    try { return await run(); }
    finally {
      // The original allocating lane already drains this promise. Observation
      // follows that lifetime without delaying early display publication.
      const drain = readDrain?.();
      if (drain === undefined) finish();
      else void drain.catch((): void => {}).finally(finish);
    }
  }
}
