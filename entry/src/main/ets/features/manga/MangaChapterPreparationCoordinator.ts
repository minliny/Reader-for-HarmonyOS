import type { ReadingGatewayImageCacheIdentity, ReadingGatewayImageChapterIdentity, ReadingGatewayRuntime } from '../reading/ReadingGatewayRuntime';
import type { MangaChapterResult } from './MangaContract';
import { MangaSessionGateway } from './MangaSessionGateway';
import type { MangaMaterializationToken } from './MangaSessionGateway';
import { MangaResourceGateway } from './MangaResourceGateway';
import type { MangaResourceScope } from './MangaResourceGateway';

interface MangaDownloadConsumer { current: () => boolean; }
interface MangaPreparationError extends Error { code?: string; }
type MangaPreparationListener = (failure?: string) => void;
interface MangaPreparationState {
  key: string; chapter: MangaChapterResult; totalPages: number; contentCurrent: () => boolean;
  allowNetwork: boolean; sessionRevision: number; readyRefs: Set<string>;
  complete: boolean; cacheRequested: boolean; downloads: Set<MangaDownloadConsumer>; task?: Promise<void>;
  replacementCurrent?: () => boolean;
  failure?: string;
}

/** Reader's chapter intentions only. The existing Runtime owns request lanes,
 * durable bytes, decode reuse, disk limits and offline validation. */
export class MangaChapterPreparationCoordinator {
  private static owners: WeakMap<ReadingGatewayRuntime, MangaChapterPreparationCoordinator> = new WeakMap();
  private static lastSessionEpoch: number = 0;
  private readonly runtime: ReadingGatewayRuntime;
  private readonly gateway: MangaSessionGateway;
  private readonly resources: MangaResourceGateway;
  private readonly states: Map<string, MangaPreparationState> = new Map();
  private history: string[] = [];
  private readonly pendingTasks: Map<Promise<void>, MangaPreparationState> = new Map();
  private readonly listeners: Map<string, Set<MangaPreparationListener>> = new Map();
  private readonly foregroundWaiters: Set<() => void> = new Set();
  private currentKey: string | undefined;
  private adjacentKey: string | undefined;
  lastFailure: string | undefined;
  private sessionEpoch: number = 0;
  private runtimeEpoch: number | undefined;
  private sessionRevision: number = 0;
  private admissionRevision: number = 0;
  private closed: boolean = true;
  private protectionLane: Promise<void> = Promise.resolve();

  static forRuntime(runtime: ReadingGatewayRuntime): MangaChapterPreparationCoordinator {
    let owner = this.owners.get(runtime);
    if (owner === undefined) { owner = new MangaChapterPreparationCoordinator(runtime); this.owners.set(runtime, owner); }
    return owner;
  }

  private constructor(runtime: ReadingGatewayRuntime) {
    this.runtime = runtime; this.gateway = new MangaSessionGateway(runtime); this.resources = new MangaResourceGateway(runtime);
  }

  /** Admit protection before the first display read, then re-read the exact
   * immutable Core version to close the eviction/admission race. */
  async activate(chapter: MangaChapterResult, totalPages: number, contentCurrent: () => boolean,
    allowNetwork: boolean, isCurrent: () => boolean): Promise<MangaChapterResult> {
    const revision = this.admissionRevision;
    const admitted = (): boolean => revision === this.admissionRevision && isCurrent() && contentCurrent();
    const predecessor = this.protectionLane;
    const task = predecessor.catch((): void => {}).then(async (): Promise<MangaChapterResult> => {
      this.assertCurrent(admitted);
      if (this.closed) {
        // Publish the session only after its Core epoch is admitted. A failed
        // initialization remains closed so explicit opening retry can obtain
        // a fresh epoch instead of issuing replacement with an undefined one.
        const runtimeEpoch = await this.gateway.sessionRuntime(admitted);
        this.assertCurrent(admitted);
        this.closed = false; this.sessionRevision++;
        MangaChapterPreparationCoordinator.lastSessionEpoch = Math.max(MangaChapterPreparationCoordinator.lastSessionEpoch + 1, Date.now() * 1024);
        this.sessionEpoch = MangaChapterPreparationCoordinator.lastSessionEpoch;
        this.runtimeEpoch = runtimeEpoch;
      }
      const state = this.state(chapter, totalPages, contentCurrent, allowNetwork);
      state.allowNetwork = allowNetwork; state.sessionRevision = this.sessionRevision;
      const nextHistory = [state.key, ...this.history.filter(key => key !== state.key && this.states.get(key)?.contentCurrent() === true && !this.sameIdentity(this.states.get(key)!.chapter, chapter))].slice(0, 3);
      const identities = nextHistory.map(key => this.states.get(key)!.chapter.manifest.chapter);
      await this.gateway.replaceProtection(identities, this.sessionEpoch, this.runtimeEpoch!, admitted);
      this.assertCurrent(admitted);
      const start = chapter.manifest.pages[0].ordinal;
      const window = await this.gateway.window(chapter, start, Math.min(32, totalPages - start), admitted);
      this.assertCurrent(admitted);
      if (window.totalPages !== totalPages || !contentCurrent()) throw new Error('MANGA_SESSION_CONTENT_CHANGED');
      this.history = nextHistory; this.currentKey = state.key;
      if (this.adjacentKey === state.key) this.adjacentKey = undefined;
      this.trimStates();
      return state.chapter;
    });
    this.protectionLane = task.then((): void => {}, (): void => {});
    return task;
  }

  /** A retired view can finish after its successor was admitted. It owns only
   * its own chapter, never the successor's shared preparation clock. */
  leaveCurrent(chapter?: MangaChapterResult): void {
    if (chapter === undefined || this.currentKey === this.key(chapter)) this.currentKey = undefined;
  }

  /** Admission before native paint may be rolled back. Keep the exact prior
   * three-chapter history, including the slot a failed candidate would evict.
   * Core still owns the CAS epoch; never restore across exit or another owner. */
  candidateProtectionRollback(target: MangaChapterResult): (isCurrent: () => boolean) => Promise<boolean> {
    const revision = this.sessionRevision, epoch = this.sessionEpoch, runtimeEpoch = this.runtimeEpoch;
    const currentKey = this.currentKey, targetKey = this.key(target);
    const history = this.history.map(key => this.states.get(key)).filter((state): state is MangaPreparationState => state !== undefined);
    return async (isCurrent: () => boolean): Promise<boolean> => {
      const current = (): boolean => !this.closed && revision === this.sessionRevision && epoch === this.sessionEpoch &&
        runtimeEpoch === this.runtimeEpoch && isCurrent() && (this.currentKey === targetKey || this.currentKey === currentKey);
      const predecessor = this.protectionLane;
      const task = predecessor.catch((): void => {}).then(async (): Promise<boolean> => {
        if (!current() || runtimeEpoch === undefined) return false;
        const valid = history.filter(state => state.contentCurrent());
        const oldCurrent = valid.find(state => state.key === currentKey);
        if (oldCurrent === undefined) return false;
        await this.gateway.replaceProtection(valid.map(state => state.chapter.manifest.chapter), epoch, runtimeEpoch, current);
        this.assertCurrent(current);
        const start = oldCurrent.chapter.manifest.pages[0].ordinal;
        const window = await this.gateway.window(oldCurrent.chapter, start, Math.min(32, oldCurrent.totalPages - start), current);
        this.assertCurrent(current);
        if (window.totalPages !== oldCurrent.totalPages) throw new Error('MANGA_SESSION_CONTENT_CHANGED');
        for (const state of valid) this.states.set(state.key, state);
        this.history = valid.map(state => state.key); this.currentKey = currentKey;
        this.trimStates();
        return true;
      });
      this.protectionLane = task.then((): void => {}, (): void => {});
      return task;
    };
  }

  observeChapter(chapter: MangaChapterResult, listener: MangaPreparationListener): () => void {
    const key = this.key(chapter);
    let listeners = this.listeners.get(key);
    if (listeners === undefined) { listeners = new Set(); this.listeners.set(key, listeners); }
    listeners.add(listener); listener(this.states.get(key)?.failure);
    return (): void => { listeners!.delete(listener); if (listeners!.size === 0) this.listeners.delete(key); };
  }

  private setFailure(state: MangaPreparationState, error?: Error): void {
    const classified = error as MangaPreparationError | undefined;
    const failure = classified === undefined ? undefined : classified.code === 'storage_full' ||
      classified.message === 'MANGA_CACHE_STORAGE_FULL' || classified.message.includes('NO_SPACE') ?
      'MANGA_CHAPTER_CACHE_CAPACITY' : 'MANGA_CHAPTER_PREPARATION_FAILED';
    if (state.failure === failure) return;
    state.failure = failure;
    if (error !== undefined) this.lastFailure = error.message;
    for (const listener of this.listeners.get(state.key) ?? []) listener(failure);
  }

  /** Existing system-network observer can resume eligible cache consumers.
   * Explicit download consumers remain entirely controlled by their queue. */
  networkChanged(): void {
    if (this.runtime.isMangaPreparationForeground?.() !== false) for (const wake of Array.from(this.foregroundWaiters)) wake();
    if (this.closed) return;
    for (const state of this.states.values()) {
      if (!state.cacheRequested || state.complete || !this.alive(state)) continue;
      void this.start(state).catch((): void => {});
    }
  }

  /** Called only after a real first region is ready. It never delays first paint. */
  startCurrent(chapter: MangaChapterResult): void {
    const state = this.states.get(this.key(chapter));
    if (state === undefined || this.currentKey !== state.key || this.closed) return;
    state.cacheRequested = true;
    if (state.failure === 'MANGA_CHAPTER_CACHE_CAPACITY') return;
    void this.start(state).catch((): void => {});
  }

  /** Active refresh uses ordinary cache ownership and publishes only a fully
   * verified chapter. Its cancellation does not stop another download owner. */
  async prepareReplacement(chapter: MangaChapterResult, isCurrent: () => boolean): Promise<MangaChapterResult> {
    const state = this.states.get(this.key(chapter));
    if (state === undefined || this.currentKey !== state.key || this.closed) throw new Error('MANGA_SESSION_CANCELLED');
    state.cacheRequested = true; state.replacementCurrent = isCurrent;
    let completed = false;
    try {
      await this.revalidateReady(state, isCurrent);
      await this.start(state);
      this.assertCurrent(isCurrent);
      if (!state.complete) throw new Error('MANGA_CHAPTER_PREPARATION_INCOMPLETE');
      completed = true;
      return state.chapter;
    } finally {
      if (state.replacementCurrent === isCurrent) state.replacementCurrent = undefined;
      if (!completed) state.cacheRequested = false;
    }
  }

  /** Optional neighboring chapters do not enter the displayed chapter history. */
  async prepareAdjacent(chapter: MangaChapterResult, totalPages: number, contentCurrent: () => boolean): Promise<void> {
    if (this.closed || this.runtime.allowOptionalMangaPreparation?.() !== true) return;
    const state = this.state(chapter, totalPages, contentCurrent, true);
    const previous = this.adjacentKey;
    this.adjacentKey = state.key;
    if (previous !== undefined && previous !== state.key && !this.history.includes(previous) && this.states.get(previous)?.downloads.size === 0) this.states.delete(previous);
    state.cacheRequested = true;
    try { await this.start(state); }
    finally {
      if (this.adjacentKey === state.key) this.adjacentKey = undefined;
      if (!this.history.includes(state.key) && state.downloads.size === 0) this.states.delete(state.key);
    }
  }

  /** Caller owns explicit queue pause/cancel validity. This adapter never
   * enqueues, resumes, changes retention directly, or records a reading clock. */
  async prepareDownload(chapter: MangaChapterResult, totalPages: number, isCurrent: () => boolean): Promise<void> {
    this.assertCurrent(isCurrent);
    const state = this.state(chapter, totalPages,
      this.runtime.captureReadingContentValidity?.(chapter.manifest.chapter.sourceId, chapter.manifest.chapter.bookId) ?? isCurrent, true);
    const consumer: MangaDownloadConsumer = { current: isCurrent };
    state.downloads.add(consumer);
    let receipt: MangaMaterializationToken | undefined;
    let completed = false;
    let receiptPreparedAt = Date.now();
    try {
      await this.waitForForeground(isCurrent);
      receipt = await this.gateway.prepareMaterialization(chapter, 'download', isCurrent);
      this.assertCurrent(isCurrent);
      // A joined cache attempt may have been paused or failed. Retry only its
      // missing refs under the still-live explicit download consumer.
      for (;;) {
        await this.waitForForeground(isCurrent);
        const joinedCacheAttempt = state.task !== undefined && state.cacheRequested;
        if (state.task === undefined) await this.revalidateReady(state, isCurrent);
        try { await this.waitForDownloadAttempt(state, this.start(state), isCurrent); } catch (error) {
          this.assertCurrent(isCurrent);
          if (!joinedCacheAttempt && this.runtime.isMangaPreparationForeground?.() !== false) throw error;
        }
        if (this.runtime.isMangaPreparationForeground?.() === false) continue;
        if (state.readyRefs.size !== totalPages) await this.waitForDownloadAttempt(state, this.start(state), isCurrent);
        if (this.runtime.isMangaPreparationForeground?.() !== false) break;
      }
      this.assertCurrent(isCurrent);
      if (state.readyRefs.size !== totalPages) throw new Error('MANGA_CHAPTER_PREPARATION_INCOMPLETE');
      await this.certifyHost(state, isCurrent);
      if (Date.now() - receiptPreparedAt >= 240000 || Date.now() < receiptPreparedAt) {
        receipt = await this.renewMaterialization(receipt, state.chapter, isCurrent);
        receiptPreparedAt = Date.now();
      }
      await this.gateway.completeMaterialization(receipt, state.chapter.manifest.pages.map(page => page.resourceRef), isCurrent);
      completed = true;
    } finally {
      state.downloads.delete(consumer);
      if (receipt !== undefined && !completed) await this.gateway.abortMaterialization(receipt);
      if (!this.history.includes(state.key) && !state.cacheRequested && state.downloads.size === 0) this.states.delete(state.key);
    }
  }

  async recordVisible(chapter: MangaChapterResult, isCurrent: () => boolean): Promise<void> {
    if (this.closed || this.currentKey !== this.key(chapter)) return;
    await this.gateway.recordRead(chapter, isCurrent);
  }

  /** Final reading exit invalidates pending cache consumers synchronously,
   * then drains their lease cleanup and the old session's CAS release. */
  async close(): Promise<void> {
    // Fence queued admissions even before the first session has opened.
    // Caller validity alone cannot stop a late Core window from reopening it.
    this.admissionRevision++;
    if (this.closed) { await this.protectionLane; return; }
    this.closed = true; this.sessionRevision++;
    const epoch = this.sessionEpoch, runtimeEpoch = this.runtimeEpoch;
    const cacheTasks = Array.from(this.pendingTasks).filter(([_task, state]) => state.downloads.size === 0).map(([task]) => task);
    this.currentKey = undefined; this.adjacentKey = undefined; this.history = [];
    for (const [key, state] of this.states) if (state.downloads.size === 0) this.states.delete(key);
    const predecessor = this.protectionLane;
    const release = predecessor.catch((): void => {}).then(async (): Promise<void> => {
      await Promise.all(cacheTasks.map(task => task.catch((): void => {})));
      if (runtimeEpoch !== undefined) await this.gateway.releaseProtection(epoch, runtimeEpoch);
    });
    this.protectionLane = release;
    await release;
  }

  private state(chapter: MangaChapterResult, totalPages: number, contentCurrent: () => boolean, allowNetwork: boolean): MangaPreparationState {
    if (!Number.isSafeInteger(totalPages) || totalPages < 1 || totalPages > 10000) throw new Error('MANGA_WINDOW_INVALID');
    const key = this.key(chapter);
    let state = this.states.get(key);
    if (state === undefined || !state.contentCurrent()) {
      state = { key, chapter, totalPages, contentCurrent, allowNetwork, sessionRevision: this.sessionRevision,
        readyRefs: new Set(), complete: false, cacheRequested: false, downloads: new Set() };
      this.states.set(key, state);
    } else {
      if (state.totalPages !== totalPages || state.chapter.manifest.sourceRuleVersion !== chapter.manifest.sourceRuleVersion ||
        state.chapter.manifest.decodeRevision !== chapter.manifest.decodeRevision) throw new Error('MANGA_WINDOW_IDENTITY_MISMATCH');
    }
    return state;
  }

  private start(state: MangaPreparationState): Promise<void> {
    if (state.task !== undefined) return state.task;
    if (state.complete) return Promise.resolve();
    const task = this.prepare(state);
    state.task = task; this.pendingTasks.set(task, state);
    const finish = (): void => { if (state.task === task) state.task = undefined; this.pendingTasks.delete(task); };
    void task.then(finish, finish);
    return task;
  }

  private alive(state: MangaPreparationState): boolean {
    return this.runtime.isMangaPreparationForeground?.() !== false && this.states.get(state.key) === state && state.contentCurrent() &&
      (Array.from(state.downloads).some(consumer => consumer.current()) ||
        (!this.closed && state.sessionRevision === this.sessionRevision && state.cacheRequested &&
          (state.replacementCurrent === undefined || state.replacementCurrent()) &&
          (state.key === this.currentKey || this.runtime.allowOptionalMangaPreparation?.() === true)));
  }

  private async prepare(state: MangaPreparationState): Promise<void> {
    const current = (): boolean => this.alive(state);
    if (!current()) return;
    let receipt: MangaMaterializationToken | undefined;
    let completed = false;
    let receiptPreparedAt = Date.now();
    let firstFailure: Error | undefined;
    try {
      if (state.cacheRequested) receipt = await this.gateway.prepareMaterialization(state.chapter, 'cache', current);
      state.chapter = await this.gateway.fullChapter(state.chapter, state.totalPages, current);
      const scope = this.scope(state.chapter);
      for (const page of state.chapter.manifest.pages) {
        if (!current()) return;
        if (receipt !== undefined && (Date.now() - receiptPreparedAt >= 240000 || Date.now() < receiptPreparedAt)) {
          receipt = await this.renewMaterialization(receipt, state.chapter, current);
          receiptPreparedAt = Date.now();
        }
        if (state.readyRefs.has(page.resourceRef)) continue;
        const request = state.chapter.resources.find(resource => resource.resourceRef === page.resourceRef)?.request;
        const explicit = Array.from(state.downloads).some(consumer => consumer.current());
        const allowNetwork = explicit || (request !== undefined && state.allowNetwork);
        try {
          await this.resources.prefetchPage(scope, { ...(request ?? { url: page.resourceRef }), resourceRef: page.resourceRef }, current,
            allowNetwork, state.key === this.currentKey ? 'chapter' : explicit ? 'download' : 'background');
          this.assertCurrent(current);
          state.readyRefs.add(page.resourceRef);
        } catch (error) {
          if (!current()) return;
          // Explicit-only work preserves the queue's existing fail/settle
          // boundary. A reader's independent cache consumer can fill others.
          if (!state.cacheRequested) throw error;
          const failure = error instanceof Error ? error : new Error('MANGA_CHAPTER_PREPARATION_FAILED');
          if ((failure as MangaPreparationError).code === 'storage_full' || failure.message === 'MANGA_CACHE_STORAGE_FULL' || failure.message.includes('NO_SPACE')) throw failure;
          if (firstFailure === undefined) firstFailure = failure;
        }
      }
      if (state.readyRefs.size !== state.totalPages) throw firstFailure ?? new Error('MANGA_CHAPTER_PREPARATION_INCOMPLETE');
      await this.certifyHost(state, current);
      if (receipt !== undefined) {
        if (Date.now() - receiptPreparedAt >= 240000 || Date.now() < receiptPreparedAt)
          receipt = await this.renewMaterialization(receipt, state.chapter, current);
        await this.gateway.completeMaterialization(receipt, state.chapter.manifest.pages.map(page => page.resourceRef), current);
        completed = true;
      }
      state.complete = true;
      this.setFailure(state);
    } catch (error) {
      if (current()) this.setFailure(state, error instanceof Error ? error : new Error('MANGA_CHAPTER_PREPARATION_FAILED'));
      throw error;
    } finally { if (receipt !== undefined && !completed) await this.gateway.abortMaterialization(receipt); }
  }

  private async renewMaterialization(previous: MangaMaterializationToken, chapter: MangaChapterResult,
    current: () => boolean): Promise<MangaMaterializationToken> {
    const next = await this.gateway.prepareMaterialization(chapter, previous.intent, current);
    try {
      this.assertCurrent(current);
      await this.gateway.abortMaterialization(previous);
      this.assertCurrent(current);
      return next;
    } catch (error) {
      await this.gateway.abortMaterialization(next);
      throw error;
    }
  }

  private async certifyHost(state: MangaPreparationState, current: () => boolean): Promise<void> {
    if (this.runtime.markOfflineImageChapterComplete === undefined || this.runtime.isOfflineImageChapterComplete === undefined) throw new Error('MANGA_CHAPTER_HOST_UNAVAILABLE');
    const chapter = state.chapter;
    const identity: ReadingGatewayImageChapterIdentity = { sourceId: chapter.manifest.chapter.sourceId, bookId: chapter.manifest.chapter.bookId,
      chapterId: chapter.manifest.chapter.chapterId, chapterIndex: chapter.chapterIndex, contentVersion: chapter.manifest.manifestVersion,
      mangaDecodeRevision: chapter.manifest.decodeRevision };
    const resources: ReadingGatewayImageCacheIdentity[] = chapter.manifest.pages.map(page => {
      const request = chapter.resources.find(resource => resource.resourceRef === page.resourceRef)?.request;
      return { ...identity, resourceRef: page.resourceRef, imageUrl: request?.requestRule ?? request?.url ?? page.resourceRef,
        baseUrl: chapter.manifest.chapter.chapterId };
    });
    await this.runtime.markOfflineImageChapterComplete(identity, resources, current);
    if (!await this.runtime.isOfflineImageChapterComplete(identity, true, current)) throw new Error('MANGA_CHAPTER_HOST_INCOMPLETE');
    this.assertCurrent(current);
  }

  /** A remembered success is not proof that its files still exist. Reuse the
   * Host's digest/decode validation locally before filling only invalid refs. */
  private async revalidateReady(state: MangaPreparationState, current: () => boolean): Promise<void> {
    if (state.readyRefs.size === 0) return;
    const chapter = state.chapter;
    const identity: ReadingGatewayImageChapterIdentity = { sourceId: chapter.manifest.chapter.sourceId, bookId: chapter.manifest.chapter.bookId,
      chapterId: chapter.manifest.chapter.chapterId, chapterIndex: chapter.chapterIndex, contentVersion: chapter.manifest.manifestVersion,
      mangaDecodeRevision: chapter.manifest.decodeRevision };
    if (state.complete && await this.runtime.isOfflineImageChapterComplete?.(identity, true, current) === true) return;
    this.assertCurrent(current);
    state.complete = false;
    const scope = this.scope(chapter);
    for (const page of chapter.manifest.pages) {
      if (!state.readyRefs.has(page.resourceRef)) continue;
      const request = chapter.resources.find(resource => resource.resourceRef === page.resourceRef)?.request;
      try {
        await this.resources.prefetchPage(scope, { ...(request ?? { url: page.resourceRef }), resourceRef: page.resourceRef }, current, false,
          state.key === this.currentKey ? 'chapter' : 'download');
        this.assertCurrent(current);
      } catch (error) {
        this.assertCurrent(current);
        state.readyRefs.delete(page.resourceRef);
      }
    }
  }

  /** A download consumer can detach from an independently live reader/cache
   * or another download. Exclusive work still drains its real I/O before the
   * queue settles, so its late callbacks cannot race physical deletion. */
  private async waitForDownloadAttempt(state: MangaPreparationState, task: Promise<void>, current: () => boolean): Promise<void> {
    let timer: number | undefined;
    const detached = new Promise<void>((_resolve, reject): void => {
      const check = (): void => {
        if (!current()) {
          if (this.alive(state)) reject(new Error('MANGA_SESSION_CANCELLED'));
          return;
        }
        timer = setTimeout(check, 100);
      };
      check();
    });
    try { await Promise.race([task, detached]); }
    finally { if (timer !== undefined) clearTimeout(timer); }
  }

  private async waitForForeground(current: () => boolean): Promise<void> {
    while (this.runtime.isMangaPreparationForeground?.() === false) {
      this.assertCurrent(current);
      await new Promise<void>((resolve): void => {
        const wake = (): void => { clearTimeout(timer); this.foregroundWaiters.delete(wake); resolve(); };
        const timer = setTimeout(wake, 100);
        this.foregroundWaiters.add(wake);
      });
    }
    this.assertCurrent(current);
  }

  private scope(chapter: MangaChapterResult): MangaResourceScope {
    return { sourceId: chapter.manifest.chapter.sourceId, bookId: chapter.manifest.chapter.bookId, chapterIndex: chapter.chapterIndex,
      chapterUrl: chapter.manifest.chapter.chapterId, contentVersion: chapter.manifest.manifestVersion,
      sourceRuleVersion: chapter.manifest.sourceRuleVersion, decodeRevision: chapter.manifest.decodeRevision };
  }
  private key(chapter: MangaChapterResult): string {
    const identity = chapter.manifest.chapter;
    return JSON.stringify([identity.sourceId, identity.bookId, identity.chapterId, chapter.manifest.manifestVersion]);
  }
  private sameIdentity(left: MangaChapterResult, right: MangaChapterResult): boolean {
    const a = left.manifest.chapter, b = right.manifest.chapter;
    return a.sourceId === b.sourceId && a.bookId === b.bookId && a.chapterId === b.chapterId;
  }
  private trimStates(): void {
    for (const [key, state] of this.states) if (!this.history.includes(key) && key !== this.adjacentKey && state.downloads.size === 0) this.states.delete(key);
  }
  private assertCurrent(current: () => boolean): void { if (!current()) throw new Error('MANGA_SESSION_CANCELLED'); }
}
