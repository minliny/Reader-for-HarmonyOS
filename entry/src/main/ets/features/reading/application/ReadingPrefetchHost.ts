import { ReaderRuntimeOwner } from '../../../app/ReaderRuntimeOwner';
import { errorMessageOf } from '../../../app/ErrorMessage';
import { ReadingOfflineGateway } from './ReadingOfflineGateway';
import { RemoteReadingFlowGateway, type RemoteReadingSession, type RemoteReadingTocEntry } from './RemoteReadingFlowGateway';
import type { LocalReadingTocEntry } from './LocalReadingFlowTypes';
import type { RemoteReadingIdentity } from './RemoteReadingContract';
import { sameRemoteSessionEvidence, canAppendRemoteReadingCatalog } from './RemoteReadingEvidence';
import { DEEP_PREFETCH_STEP_INTERVAL_MS, deepPrefetchAllowed, hasDeepPrefetchLowWater,
  immediateReadingPrefetchWindow, nextDeepPrefetchChapter,
  ReadingDeepPrefetchBreaker, ReadingTrialClock, type DeepPrefetchOutcome } from './ReadingDeepPrefetchPolicy';

const CATALOG_REFRESH_NEAR_END = 3;
const CATALOG_REFRESH_INTERVAL_MS = 10 * 60 * 1000;
const CATALOG_REFRESH_RETRY_INTERVAL_MS = 30 * 1000;
const DEEP_PREFETCH_CACHE_OBSERVATION_MS = 30_000;

export interface ReadingPrefetchLease {
  /** Captured page navigation/session/lifecycle admission, never a fresh ID. */
  isCurrent: () => boolean;
  displayedSession: () => RemoteReadingSession | undefined;
  directory: () => LocalReadingTocEntry[];
  projected: (entries: LocalReadingTocEntry[]) => void;
  refreshed: (session: RemoteReadingSession) => void;
  diagnostic: (stage: 'window' | 'catalog', message: string) => void;
  manualBusy?: () => boolean;
}
export type ReadingPrefetchMode = 'reader' | 'shelf' | 'opportunistic';
export interface ReadingPrefetchActivity {
  chapterIndex: number;
  chapterOffset: number;
  active: boolean;
  playing: boolean;
  interacted?: boolean;
  yieldToReading?: boolean;
}
interface DeepReadingWindow {
  session: RemoteReadingSession;
  lease: ReadingPrefetchLease;
  current: () => boolean;
  onShelf: () => boolean;
  chapterIndex: number;
  progressChapterIndex: number;
  chapterOffset: number;
  active: boolean;
  playing: boolean;
  refilling: boolean;
  attempted: Set<number>;
  settled: boolean;
  cacheObservation?: { at: number; indexes: Set<number> };
}
interface ReadingWindowIntent {
  key: string;
  session: RemoteReadingSession;
  startInclusive: number;
  endExclusive: number;
  isCurrent: () => boolean;
  lease: ReadingPrefetchLease;
  retryAfter?: number;
}

/** Existing optional reader cache/catalog producer. Owns work selection,
 * coalescing, admission, backoff and publication; never Core's lease protocol,
 * retained reader trees or navigation. Explicit shelf jobs remain per book. */
export class ReadingPrefetchHost {
  private static shared: ReadingPrefetchHost | undefined;
  private readonly runtime: ReaderRuntimeOwner;
  private lifecycle: number = 0;
  private requestedKey: string = '';
  private pending: ReadingWindowIntent | undefined;
  private active: ReadingWindowIntent | undefined;
  private completed: ReadingWindowIntent | undefined;
  private task: Promise<void> | undefined;
  private readableToc: RemoteReadingTocEntry[] | undefined;
  private indexes: number[] = [];
  private positions: Map<number, number> = new Map();
  private refreshAt: Map<string, number> = new Map();
  private attemptAt: Map<string, number> = new Map();
  private refreshInFlight: Map<string, () => boolean> = new Map();
  private trial: ReadingTrialClock = new ReadingTrialClock();
  private breaker: ReadingDeepPrefetchBreaker = new ReadingDeepPrefetchBreaker();
  private deep: DeepReadingWindow | undefined;
  private deepTask: Promise<void> | undefined;
  private deepTimer: number = -1;
  private deepWakeAt: number = 0;
  private deepRevision: number = 0;
  private deepNextStepAt: number = 0;
  private stopDeepNetwork: (() => void) | undefined;
  private stopForegroundWork: (() => void) | undefined;

  constructor(runtime: ReaderRuntimeOwner = ReaderRuntimeOwner.current()) { this.runtime = runtime; }
  static forRuntime(runtime: ReaderRuntimeOwner = ReaderRuntimeOwner.current()): ReadingPrefetchHost {
    if (!ReaderRuntimeOwner.isCurrent(runtime)) throw new Error('READING_PREFETCH_OWNER_RETIRED');
    if (ReadingPrefetchHost.shared?.owns(runtime) !== true) {
      ReadingPrefetchHost.shared?.retire(); ReadingPrefetchHost.shared = new ReadingPrefetchHost(runtime);
    }
    return ReadingPrefetchHost.shared;
  }
  owns(runtime: ReaderRuntimeOwner): boolean { return this.runtime === runtime; }
  retire(): void {
    this.lifecycle += 1; this.requestedKey = ''; this.pending = undefined; this.completed = undefined;
    this.readableToc = undefined; this.indexes = []; this.positions.clear();
    this.pruneSettledTimes(Date.now());
    this.retireDeepReading();
    // Active native work remains with the existing Gateway until its actual
    // leases/reports settle. A later admission shares that drain, never spawns
    // a second concurrent reader-window producer.
  }

  retireDeepReading(): void {
    this.trial.pause(Date.now());
    this.deep = undefined;
    this.interruptDeep();
    this.stopDeepNetwork?.(); this.stopDeepNetwork = undefined;
    this.stopForegroundWork?.(); this.stopForegroundWork = undefined;
  }

  observeReading(session: RemoteReadingSession, activity: ReadingPrefetchActivity,
    lease: ReadingPrefetchLease, onShelf: () => boolean): void {
    if (!deepPrefetchAllowed(session.contentKind, session.identity.sourceId, true, true) ||
      session.acquisitionMode !== 'online' || !lease.isCurrent()) return;
    const now = Date.now(), prior = this.deep;
    if (prior === undefined || !prior.current() || !sameRemoteSessionEvidence(prior.session, session)) {
      if (!activity.active) return;
      this.interruptDeep();
      const contentCurrent = this.runtime.captureReadingContentValidity(session.identity.sourceId, session.identity.bookId);
      this.deep = { session, lease, onShelf, chapterIndex: activity.chapterIndex, progressChapterIndex: activity.chapterIndex,
        chapterOffset: activity.chapterOffset,
        active: false, playing: false, refilling: false, settled: false, attempted: new Set<number>(),
        current: (): boolean => ReaderRuntimeOwner.isCurrent(this.runtime) && contentCurrent() &&
          lease.isCurrent() && sameRemoteSessionEvidence(lease.displayedSession(), session) };
      this.stopDeepNetwork ??= this.runtime.observeDeepReadingPrefetchNetwork((): void => {
        this.interruptDeep();
        this.wakeDeep();
      });
      this.stopForegroundWork ??= this.runtime.bookAcquisitions().observeForegroundReadingWork((): void => {
        if (this.runtime.bookAcquisitions().hasForegroundReadingWork()) this.interruptDeep();
        this.wakeDeep();
      });
    }
    const work = this.deep;
    if (work === undefined) return;
    const needsImmediateWindow = activity.active && (!work.active || activity.chapterIndex !== work.chapterIndex);
    if (!activity.active || activity.yieldToReading === true || lease.manualBusy?.() === true) this.interruptDeep();
    if (activity.active) this.moveDeepWindow(work, activity.chapterIndex);
    work.active = activity.active;
    work.playing = activity.playing;
    this.trial.observe(this.key(session.identity), now, activity.active, activity.playing, false, activity.interacted);
    if (needsImmediateWindow) void this.prefetch(session, activity.chapterIndex, lease, 'reader')
      .catch((error: Error): void => this.diagnostic(lease, 'window', errorMessageOf(error)));
    this.wakeDeep();
  }

  /** Only accepted position changes count as reading advancement. A ready or
   * repeated persistence receipt alone cannot qualify a trial. */
  noteReadingProgress(session: RemoteReadingSession, chapterIndex: number, chapterOffset: number): void {
    const work = this.deep;
    if (work === undefined || !work.active || !work.current() || !sameRemoteSessionEvidence(work.session, session)) return;
    const advanced = chapterIndex !== work.progressChapterIndex || chapterOffset !== work.chapterOffset;
    work.progressChapterIndex = chapterIndex;
    work.chapterOffset = chapterOffset;
    if (advanced) this.trial.observe(this.key(session.identity), Date.now(), true, work.playing, true);
    this.wakeDeep();
  }

  private moveDeepWindow(work: DeepReadingWindow, chapterIndex: number): void {
    if (work.chapterIndex === chapterIndex) return;
    this.interruptDeep();
    this.readableIndexes(work.session);
    const prior = this.positions.get(work.chapterIndex), next = this.positions.get(chapterIndex);
    if (work.settled || prior === undefined || next === undefined || Math.abs(prior - next) !== 1) {
      work.refilling = false;
      work.attempted.clear();
    }
    work.chapterIndex = chapterIndex;
    work.settled = false;
  }

  private interruptDeep(): void {
    this.deepRevision += 1;
    if (this.deepTimer >= 0) clearTimeout(this.deepTimer);
    this.deepTimer = -1;
    this.deepWakeAt = 0;
    this.deepNextStepAt = Date.now() + DEEP_PREFETCH_STEP_INTERVAL_MS;
  }

  private wakeDeep(): void {
    const work = this.deep;
    if (work === undefined || !work.active || !work.current()) {
      this.trial.pause(Date.now());
      return;
    }
    if (work.settled || work.lease.manualBusy?.() === true || this.task !== undefined || this.deepTask !== undefined ||
      this.runtime.bookAcquisitions().hasForegroundReadingWork() ||
      !this.runtime.deepReadingPrefetchNetworkAllowed()) return;
    this.readableIndexes(work.session);
    const position = this.positions.get(work.chapterIndex);
    if (position === undefined || position + 3 >= this.indexes.length) return;
    const now = Date.now(), key = this.key(work.session.identity);
    const observed = work.cacheObservation;
    if (!work.refilling && observed !== undefined && now >= observed.at && now - observed.at < DEEP_PREFETCH_CACHE_OBSERVATION_MS &&
      !hasDeepPrefetchLowWater(this.indexes, position, (index: number): boolean => observed.indexes.has(index))) return;
    const delay = this.trial.isUnlocked(key, now, work.onShelf(), position) ? 0 : this.trial.unlockDelay(key, now);
    if (delay === undefined) return;
    const wakeAt = Math.max(now + delay, this.deepNextStepAt, this.breaker.blockedUntil(work.session.identity.sourceId, now) ?? 0);
    if (this.deepTimer >= 0 && this.deepWakeAt <= wakeAt) return;
    if (this.deepTimer >= 0) clearTimeout(this.deepTimer);
    this.deepWakeAt = wakeAt;
    this.deepTimer = setTimeout((): void => {
      this.deepTimer = -1;
      this.deepWakeAt = 0;
      if (!work.current() || work !== this.deep || !work.active) {
        this.wakeDeep();
        return;
      }
      const at = Date.now();
      if (at < wakeAt || !this.trial.isUnlocked(key, at, work.onShelf(), position)) {
        this.wakeDeep();
        return;
      }
      const revision = this.deepRevision;
      const current = (): boolean => work === this.deep && work.active && work.current() && revision === this.deepRevision &&
        work.lease.manualBusy?.() !== true && this.task === undefined && !this.runtime.bookAcquisitions().hasForegroundReadingWork() &&
        this.runtime.deepReadingPrefetchNetworkAllowed();
      if (!current()) { this.wakeDeep(); return; }
      this.deepTask = this.runDeepStep(work, position, current).finally((): void => {
        this.deepTask = undefined;
        this.deepNextStepAt = Math.max(this.deepNextStepAt, Date.now() + DEEP_PREFETCH_STEP_INTERVAL_MS);
        this.wakeDeep();
      });
    }, Math.max(0, wakeAt - now));
  }

  private async runDeepStep(work: DeepReadingWindow, position: number, current: () => boolean): Promise<void> {
    const gateway = new ReadingOfflineGateway(this.runtime);
    let index: number | undefined;
    try {
      const availability = await gateway.loadTextPrefetchAvailability(work.session, current);
      if (!current()) return;
      work.cacheObservation = { at: Date.now(), indexes: availability.cached };
      const excluded = new Set<number>([...work.attempted, ...availability.reserved]);
      index = nextDeepPrefetchChapter(this.readableIndexes(work.session), position,
        (item: number): boolean => availability.cached.has(item), excluded, work.refilling, false);
      if (index === undefined) {
        work.refilling = false;
        work.settled = true;
        return;
      }
      const admitted = await this.runtime.canDeepReadingPrefetchWrite(current).catch((): boolean => false);
      if (!admitted) {
        this.deepNextStepAt = Date.now() + CATALOG_REFRESH_RETRY_INTERVAL_MS;
        return;
      }
      if (!current()) return;
      work.refilling = true;
      const chapter = await gateway.prefetchTextChapter(work.session, index, current);
      if (!current()) return;
      availability.cached.add(index);
      this.breaker.record(work.session.identity.sourceId, Date.now(), 'success');
      this.publish([chapter], work.session, current, work.lease);
    } catch (error) {
      if (!current()) return;
      if (index === undefined) {
        this.deepNextStepAt = Date.now() + CATALOG_REFRESH_RETRY_INTERVAL_MS;
        return;
      }
      work.attempted.add(index);
      const outcome: DeepPrefetchOutcome = gateway.deepPrefetchFailure(error as Error);
      const sourceId = work.session.identity.sourceId, now = Date.now();
      this.breaker.record(sourceId, now, outcome);
      if (this.breaker.blockedUntil(sourceId, now) !== undefined) {
        work.refilling = false;
        work.attempted.clear();
      }
    }
  }

  noteCatalogRefresh(identity: RemoteReadingIdentity, lastCheckAt: number | undefined): void {
    if (lastCheckAt === undefined || !Number.isFinite(lastCheckAt)) return;
    const key = this.key(identity);
    this.pruneSettledTimes(Date.now());
    this.refreshAt.set(key, Math.max(this.refreshAt.get(key) ?? 0, lastCheckAt * 1000));
  }

  async prefetch(session: RemoteReadingSession, preferredChapterIndex: number | undefined,
    lease: ReadingPrefetchLease, mode: ReadingPrefetchMode = 'opportunistic'): Promise<void> {
    if (session.contentKind === 'manga') return;
    const readerOwned = mode === 'reader';
    const lifecycle = this.lifecycle;
    const contentCurrent = this.runtime.captureReadingContentValidity?.(session.identity.sourceId, session.identity.bookId);
    const current = (): boolean => session.contentKind !== 'manga' && lifecycle === this.lifecycle && ReaderRuntimeOwner.isCurrent(this.runtime) &&
      contentCurrent?.() !== false && lease.isCurrent() &&
      (!readerOwned || (lease.displayedSession()?.contentKind !== 'manga' && sameRemoteSessionEvidence(lease.displayedSession(), session)));
    if (!current() || session.entries.length === 0) return;
    const indexes = readerOwned ? this.readableIndexes(session) : session.entries
      .filter((entry): boolean => entry.navigable !== false && entry.url.trim().length > 0)
      .map((entry): number => entry.index);
    let chapterIndex = preferredChapterIndex;
    if (chapterIndex === undefined) {
      const progress = await new RemoteReadingFlowGateway(this.runtime).loadProgress(session.identity, current);
      if (!current()) return;
      chapterIndex = progress.kind === 'restored' ? progress.progress.chapterIndex : indexes[0];
    }
    if (chapterIndex === undefined) return;
    const position = readerOwned ? this.positions.get(chapterIndex) : indexes.indexOf(chapterIndex);
    if (position === undefined) return;
    const window = immediateReadingPrefetchWindow(indexes, position);
    if (window === undefined) return;
    const { startInclusive, endExclusive } = window;
    if (!readerOwned) {
      const result = await new ReadingOfflineGateway(this.runtime).prefetchWindow(session, startInclusive, endExclusive, current);
      this.publish(result.entries, session, current, lease);
      if (mode === 'shelf' && current() && result.failedChapters > 0) throw new Error('部分章节预加载未完成');
      return;
    }
    const key = JSON.stringify([session.identity.sourceId, session.identity.bookId, session.sourceVersion,
      session.catalogVersion, session.contextVersion, lifecycle, startInclusive, endExclusive]);
    if (this.completed?.key === key && this.completed.isCurrent() &&
      (this.completed.retryAfter === undefined || Date.now() < this.completed.retryAfter)) return;
    if ((this.pending?.key === key && this.pending.isCurrent()) || (this.active?.key === key && this.active.isCurrent())) return this.task;
    this.requestedKey = key;
    this.pending = { key, session, startInclusive, endExclusive, lease,
      isCurrent: (): boolean => current() && this.requestedKey === key };
    if (this.task === undefined) {
      if (this.deep !== undefined) this.interruptDeep();
      this.task = this.drain();
    }
    return this.task;
  }

  nearEnd(session: RemoteReadingSession, chapterIndex: number): boolean {
    if (session.contentKind === 'manga') return false;
    const indexes = this.readableIndexes(session), position = this.positions.get(chapterIndex);
    return position !== undefined && indexes.length - position - 1 <= CATALOG_REFRESH_NEAR_END;
  }

  async refreshNearEnd(session: RemoteReadingSession, lease: ReadingPrefetchLease): Promise<void> {
    if (session.contentKind === 'manga') return;
    const lifecycle = this.lifecycle;
    const current = (): boolean => session.contentKind !== 'manga' && lifecycle === this.lifecycle && ReaderRuntimeOwner.isCurrent(this.runtime) &&
      lease.isCurrent() && lease.displayedSession()?.contentKind !== 'manga' && sameRemoteSessionEvidence(lease.displayedSession(), session);
    if (!current()) return;
    const key = this.key(session.identity), now = Date.now();
    this.pruneSettledTimes(now);
    const last = this.refreshAt.get(key), attempt = this.attemptAt.get(key);
    if (this.refreshInFlight.has(key) ||
      (last !== undefined && now - last < CATALOG_REFRESH_INTERVAL_MS) ||
      (attempt !== undefined && now - attempt < CATALOG_REFRESH_RETRY_INTERVAL_MS)) return;
    this.attemptAt.set(key, now); this.refreshInFlight.set(key, current);
    try {
      const refreshed = await new RemoteReadingFlowGateway(this.runtime).openSession({
        sourceId: session.identity.sourceId, bookId: session.identity.bookId, detailUrl: session.detailUrl,
        title: session.book.title, author: session.book.author, coverUrl: session.book.coverUrl,
        intro: session.book.intro, kind: session.book.kind, lastChapter: session.book.lastChapter,
        sourceVersion: session.sourceVersion, searchVariables: session.continuationVariables,
      }, { isCurrent: current, forceRefresh: true });
      if (!current()) return;
      if (refreshed.contentKind === 'manga' || !canAppendRemoteReadingCatalog(session, refreshed)) throw new Error('READING_CATALOG_REFRESH_REQUIRES_REOPEN');
      this.refreshAt.set(key, Date.now());
      try { lease.refreshed(refreshed); } catch (_) { /* UI delivery cannot undo actual catalog acceptance. */ }
    } catch (error) { if (current()) this.diagnostic(lease, 'catalog', errorMessageOf(error)); }
    finally { if (this.refreshInFlight.get(key) === current) this.refreshInFlight.delete(key); }
  }

  private async drain(): Promise<void> {
    await Promise.resolve();
    try {
      while (this.pending !== undefined) {
        const work = this.pending; this.pending = undefined; this.active = work;
        let incomplete = true;
        try {
          if (!work.isCurrent()) continue;
          const result = await new ReadingOfflineGateway(this.runtime).prefetchWindow(
            work.session, work.startInclusive, work.endExclusive, work.isCurrent);
          incomplete = result.failedChapters > 0 || result.entries.some((entry): boolean =>
            entry.navigable !== false && entry.downloadState !== 'completed');
          this.publish(result.entries, work.session, work.isCurrent, work.lease);
        } catch (error) { if (work.isCurrent()) this.diagnostic(work.lease, 'window', errorMessageOf(error)); }
        finally {
          if (work.isCurrent()) this.completed = { ...work,
            retryAfter: incomplete ? Date.now() + CATALOG_REFRESH_RETRY_INTERVAL_MS : undefined };
          this.active = undefined;
        }
      }
    } finally { this.task = undefined; this.wakeDeep(); }
  }

  private readableIndexes(session: RemoteReadingSession): number[] {
    if (this.readableToc === session.entries) return this.indexes;
    this.readableToc = session.entries; this.indexes = []; this.positions.clear();
    for (const entry of session.entries) {
      if (entry.navigable === false || entry.url.trim().length === 0) continue;
      this.positions.set(entry.index, this.indexes.length); this.indexes.push(entry.index);
    }
    return this.indexes;
  }

  private publish(entries: LocalReadingTocEntry[], session: RemoteReadingSession,
    current: () => boolean, lease: ReadingPrefetchLease): void {
    if (!current() || !sameRemoteSessionEvidence(lease.displayedSession(), session)) return;
    const directory = lease.directory(); let next: LocalReadingTocEntry[] | undefined;
    for (const entry of entries) {
      const position = directory.findIndex((item): boolean => item.index === entry.index);
      if (position < 0 || directory[position].downloadState === entry.downloadState) continue;
      if (next === undefined) next = directory.slice();
      const prior = directory[position], updated: LocalReadingTocEntry = { ...prior, downloadState: entry.downloadState };
      next[position] = updated;
    }
    if (next !== undefined && current()) { try { lease.projected(next); } catch (_) {} }
  }
  private diagnostic(lease: ReadingPrefetchLease, stage: 'window' | 'catalog', message: string): void {
    try { lease.diagnostic(stage, message); } catch (_) {}
  }
  /** These are existing eligibility deadlines, not a cache age/LRU budget.
   * A backwards clock or a still-settling native refresh is never expiry proof. */
  private pruneSettledTimes(now: number): void {
    for (const [key, at] of this.refreshAt) {
      if (!this.refreshInFlight.has(key) && now >= at && now - at >= CATALOG_REFRESH_INTERVAL_MS) this.refreshAt.delete(key);
    }
    for (const [key, at] of this.attemptAt) {
      if (!this.refreshInFlight.has(key) && now >= at && now - at >= CATALOG_REFRESH_RETRY_INTERVAL_MS) this.attemptAt.delete(key);
    }
  }
  private key(identity: RemoteReadingIdentity): string { return `${identity.sourceId}\u0000${identity.bookId}`; }
}
