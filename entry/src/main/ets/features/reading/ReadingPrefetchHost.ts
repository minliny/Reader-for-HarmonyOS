import { ReaderRuntimeOwner } from '../../app/ReaderRuntimeOwner';
import { errorMessageOf } from '../../app/ErrorMessage';
import { ReadingOfflineGateway } from './ReadingOfflineGateway';
import { RemoteReadingFlowGateway, type RemoteReadingSession, type RemoteReadingTocEntry } from './RemoteReadingFlowGateway';
import type { LocalReadingTocEntry } from './LocalReadingFlowGateway';
import type { RemoteReadingIdentity } from './RemoteReadingContract';
import { sameRemoteSessionEvidence, canAppendRemoteReadingCatalog } from './RemoteReadingEvidence';

const READING_CACHE_BEFORE = 2;
const READING_CACHE_AFTER = 2;
const CATALOG_REFRESH_NEAR_END = 3;
const CATALOG_REFRESH_INTERVAL_MS = 10 * 60 * 1000;
const CATALOG_REFRESH_RETRY_INTERVAL_MS = 30 * 1000;

export interface ReadingPrefetchLease {
  /** Captured page navigation/session/lifecycle admission, never a fresh ID. */
  isCurrent: () => boolean;
  displayedSession: () => RemoteReadingSession | undefined;
  directory: () => LocalReadingTocEntry[];
  projected: (entries: LocalReadingTocEntry[]) => void;
  refreshed: (session: RemoteReadingSession) => void;
  diagnostic: (stage: 'window' | 'catalog', message: string) => void;
}
export type ReadingPrefetchMode = 'reader' | 'shelf' | 'opportunistic';
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
    // Active native work remains with the existing Gateway until its actual
    // leases/reports settle. A later admission shares that drain, never spawns
    // a second concurrent reader-window producer.
  }

  noteCatalogRefresh(identity: RemoteReadingIdentity, lastCheckAt: number | undefined): void {
    if (lastCheckAt === undefined || !Number.isFinite(lastCheckAt)) return;
    const key = this.key(identity);
    this.refreshAt.set(key, Math.max(this.refreshAt.get(key) ?? 0, lastCheckAt * 1000));
  }

  async prefetch(session: RemoteReadingSession, preferredChapterIndex: number | undefined,
    lease: ReadingPrefetchLease, mode: ReadingPrefetchMode = 'opportunistic'): Promise<void> {
    const readerOwned = mode === 'reader';
    const lifecycle = this.lifecycle;
    const contentCurrent = this.runtime.captureReadingContentValidity?.(session.identity.sourceId, session.identity.bookId);
    const current = (): boolean => lifecycle === this.lifecycle && ReaderRuntimeOwner.isCurrent(this.runtime) &&
      contentCurrent?.() !== false && lease.isCurrent() &&
      (!readerOwned || sameRemoteSessionEvidence(lease.displayedSession(), session));
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
    if (position === undefined || position < 0) return;
    const startInclusive = indexes[Math.max(0, position - READING_CACHE_BEFORE)];
    const endExclusive = indexes[Math.min(indexes.length - 1, position + READING_CACHE_AFTER)] + 1;
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
    if (this.task === undefined) this.task = this.drain();
    return this.task;
  }

  nearEnd(session: RemoteReadingSession, chapterIndex: number): boolean {
    const indexes = this.readableIndexes(session), position = this.positions.get(chapterIndex);
    return position !== undefined && indexes.length - position - 1 <= CATALOG_REFRESH_NEAR_END;
  }

  async refreshNearEnd(session: RemoteReadingSession, lease: ReadingPrefetchLease): Promise<void> {
    const lifecycle = this.lifecycle;
    const current = (): boolean => lifecycle === this.lifecycle && ReaderRuntimeOwner.isCurrent(this.runtime) &&
      lease.isCurrent() && sameRemoteSessionEvidence(lease.displayedSession(), session);
    if (!current()) return;
    const key = this.key(session.identity), now = Date.now();
    const last = this.refreshAt.get(key), attempt = this.attemptAt.get(key);
    if (this.refreshInFlight.get(key)?.() === true ||
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
      if (!canAppendRemoteReadingCatalog(session, refreshed)) throw new Error('READING_CATALOG_REFRESH_REQUIRES_REOPEN');
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
    } finally { this.task = undefined; }
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
      const prior = directory[position], updated: LocalReadingTocEntry = { index: prior.index, title: prior.title,
        downloadState: entry.downloadState };
      if (prior.level !== undefined) updated.level = prior.level;
      if (prior.navigable !== undefined) updated.navigable = prior.navigable;
      if (prior.bookmarks !== undefined) updated.bookmarks = prior.bookmarks;
      next[position] = updated;
    }
    if (next !== undefined && current()) { try { lease.projected(next); } catch (_) {} }
  }
  private diagnostic(lease: ReadingPrefetchLease, stage: 'window' | 'catalog', message: string): void {
    try { lease.diagnostic(stage, message); } catch (_) {}
  }
  private key(identity: RemoteReadingIdentity): string { return `${identity.sourceId}\u0000${identity.bookId}`; }
}
