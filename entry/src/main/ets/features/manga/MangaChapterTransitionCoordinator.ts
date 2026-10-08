import type { JsonObject } from '@reader/core-harmony';
import type { ReadingGatewayRuntime } from '../reading/ReadingGatewayRuntime';
import type { MangaChapterResult, MangaLocation, MangaPreparedEntry } from './MangaContract';
import { MangaSessionGateway } from './MangaSessionGateway';
import type { MangaMaterializationToken } from './MangaSessionGateway';
import { MangaSessionController } from './MangaSessionController';

export interface MangaChapterTransitionRequest {
  currentController: MangaSessionController;
  chapterIndex: number; chapterUrl: string; landing: 'first' | 'last';
  offline?: boolean; preview?: boolean; directoryTargetProof?: JsonObject;
  isCurrent: () => boolean;
}

export interface MangaChapterTransitionCandidate {
  controller: MangaSessionController; entry: MangaPreparedEntry;
  landing: 'first' | 'last'; targetOrdinal: number; landingTileIndex: number;
  location: MangaLocation;
  isCurrent(): boolean;
  activate(): Promise<void>;
  confirmPresented(): void;
  cancel(): Promise<void>;
}

interface MangaTransitionAttempt {
  revision: number; origin: MangaChapterResult; request: MangaChapterTransitionRequest;
  contentCurrent: () => boolean; controller: MangaSessionController;
  status: 'preparing' | 'ready' | 'activating' | 'activated' | 'presented' | 'cancelled';
  receipt?: MangaMaterializationToken; preparation?: Promise<MangaChapterTransitionCandidate>;
  activation?: Promise<void>; cleanup?: Promise<void>;
  restoreProtection?: (isCurrent: () => boolean) => Promise<boolean>;
}

/** One intentional chapter transfer. Core/Runtime retain all ownership of
 * manifests, network, bytes, pixels, cache and the durable position CAS. */
export class MangaChapterTransitionCoordinator {
  private readonly runtime: ReadingGatewayRuntime;
  private readonly gateway: MangaSessionGateway;
  private revision: number = 0;
  private attempt: MangaTransitionAttempt | undefined;

  constructor(runtime: ReadingGatewayRuntime) {
    this.runtime = runtime; this.gateway = new MangaSessionGateway(runtime);
  }

  get pending(): boolean { return this.attempt !== undefined; }

  async prepare(request: MangaChapterTransitionRequest): Promise<MangaChapterTransitionCandidate> {
    if (this.attempt !== undefined) throw new Error('MANGA_CHAPTER_TRANSITION_BUSY');
    const origin = request.currentController.chapter;
    if (origin === undefined || !Number.isSafeInteger(request.chapterIndex) || request.chapterIndex < 0 ||
      request.chapterIndex === origin.chapterIndex || request.chapterUrl.trim().length === 0 ||
      request.chapterUrl === origin.manifest.chapter.chapterId || !['first', 'last'].includes(request.landing)) throw new Error('MANGA_CHAPTER_TRANSITION_TARGET_INVALID');
    const identity = origin.manifest.chapter;
    const attempt: MangaTransitionAttempt = { revision: ++this.revision, origin, request,
      contentCurrent: this.runtime.captureReadingContentValidity?.(identity.sourceId, identity.bookId) ?? ((): boolean => true),
      controller: new MangaSessionController(this.runtime), status: 'preparing' };
    this.attempt = attempt;
    const current = (): boolean => this.current(attempt);
    const task = (async (): Promise<MangaChapterTransitionCandidate> => {
      this.assertCurrent(attempt);
      // Drain only already-admitted writes. This read never records a new
      // position or changes book/chapter presentation while acquiring facts.
      await request.currentController.awaitPendingProgress(identity.sourceId, identity.bookId);
      this.assertCurrent(attempt);
      let entry = await this.gateway.entry(identity.sourceId, identity.bookId, request.chapterIndex, current, request.directoryTargetProof);
      if (entry === null) {
        const chapter = await this.gateway.chapter(identity.sourceId, identity.bookId, request.chapterIndex,
          request.offline === true ? 'cacheOnly' : 'cacheFirst', current, undefined, undefined, undefined, request.directoryTargetProof);
        const progress = await this.gateway.progress(identity.sourceId, identity.bookId, current);
        entry = { chapter: { ...chapter, pageStart: 0, totalPages: chapter.manifest.pages.length },
          targetOrdinal: 0, progress, recoveryRequired: false };
      }
      this.assertCurrent(attempt);
      const target = entry.chapter;
      if (target.manifest.chapter.chapterId !== request.chapterUrl || target.chapterIndex !== request.chapterIndex ||
        target.manifest.sourceRuleVersion !== origin.manifest.sourceRuleVersion || target.manifest.decodeRevision !== origin.manifest.decodeRevision)
        throw new Error('MANGA_CHAPTER_TRANSITION_IDENTITY_MISMATCH');
      // Materialization gives the candidate temporary eviction protection;
      // displayed chapter history/currentKey are changed only by activate().
      const receipt = await this.gateway.prepareMaterialization(target, 'cache', current);
      // Cancellation can finish while the lease RPC is still draining. An
      // arriving token must be released directly, even after attempt cleanup.
      if (!current()) { await this.gateway.abortMaterialization(receipt); throw new Error('MANGA_SESSION_CANCELLED'); }
      attempt.receipt = receipt;
      this.assertCurrent(attempt);
      await attempt.controller.openCandidate(entry, request.landing, request.offline === true, request.preview === true, current);
      this.assertCurrent(attempt);
      const location = attempt.controller.savedLocation;
      const ordinal = attempt.controller.displayedOrdinal, geometry = attempt.controller.pageGeometry(ordinal);
      if (location === null || geometry === undefined) throw new Error('MANGA_CANDIDATE_IMAGE_REQUIRED');
      attempt.status = 'ready';
      return { controller: attempt.controller, entry, landing: request.landing, targetOrdinal: ordinal,
        landingTileIndex: request.landing === 'last' && request.preview !== true ? Math.floor((geometry.height - 1) / geometry.tileHeight) : 0,
        location, isCurrent: current,
        activate: (): Promise<void> => this.activate(attempt),
        confirmPresented: (): void => this.confirmPresented(attempt),
        cancel: (): Promise<void> => this.cancelAttempt(attempt) };
    })();
    attempt.preparation = task;
    try { return await task; }
    catch (error) {
      await this.cancelAttempt(attempt, false);
      throw error;
    }
  }

  /** Panel/mode/source/route/lifecycle owners invalidate the whole intention,
   * including requests that have not returned a candidate yet. */
  async cancel(): Promise<void> {
    const attempt = this.attempt;
    if (attempt === undefined) { this.revision++; return; }
    await this.cancelAttempt(attempt);
  }

  private current(attempt: MangaTransitionAttempt): boolean {
    return attempt.status !== 'cancelled' && this.attempt === attempt && attempt.revision === this.revision &&
      attempt.request.isCurrent() && attempt.contentCurrent() && attempt.request.currentController.chapter === attempt.origin;
  }

  private assertCurrent(attempt: MangaTransitionAttempt): void {
    if (!this.current(attempt)) throw new Error('MANGA_SESSION_CANCELLED');
  }

  private async activate(attempt: MangaTransitionAttempt): Promise<void> {
    this.assertCurrent(attempt);
    if (attempt.status === 'activated') return;
    if (attempt.activation !== undefined) return attempt.activation;
    if (attempt.status !== 'ready') throw new Error('MANGA_CHAPTER_TRANSITION_NOT_READY');
    attempt.restoreProtection = attempt.controller.captureCandidateProtectionRollback();
    attempt.status = 'activating';
    const task = (async (): Promise<void> => {
      await attempt.controller.activateCandidate((): boolean => this.current(attempt));
      this.assertCurrent(attempt);
      attempt.status = 'activated';
      // Real current-history protection now supersedes the temporary lease.
      await this.releaseReceipt(attempt);
      this.assertCurrent(attempt);
    })();
    attempt.activation = task;
    try { await task; }
    catch (error) { await this.cancelAttempt(attempt, false); throw error; }
  }

  private confirmPresented(attempt: MangaTransitionAttempt): void {
    this.assertCurrent(attempt);
    if (attempt.status !== 'activated') throw new Error('MANGA_CHAPTER_TRANSITION_NOT_ACTIVE');
    attempt.controller.confirmCandidatePresented();
    attempt.status = 'presented';
    // The new Surface now owns this controller and its eventual real exit.
    if (this.attempt === attempt) this.attempt = undefined;
  }

  private async releaseReceipt(attempt: MangaTransitionAttempt): Promise<void> {
    const receipt = attempt.receipt;
    if (receipt === undefined) return;
    attempt.receipt = undefined;
    await this.gateway.abortMaterialization(receipt);
  }

  private cancelAttempt(attempt: MangaTransitionAttempt, waitForWork: boolean = true): Promise<void> {
    if (attempt.status === 'presented') return Promise.resolve();
    if (attempt.cleanup !== undefined) return attempt.cleanup;
    const hadAdmission = attempt.status === 'activating' || attempt.status === 'activated';
    attempt.status = 'cancelled';
    // Keep the lock until all Core admission/lease cleanup has drained. A new
    // gesture must not race a preceding protection restoration.
    const task = (async (): Promise<void> => {
      await attempt.controller.close('candidate');
      if (waitForWork && attempt.preparation !== undefined) await attempt.preparation.catch((): void => {});
      if (waitForWork && attempt.activation !== undefined) await attempt.activation.catch((): void => {});
      try {
        if (hadAdmission) {
          const restore = (): boolean => attempt.contentCurrent() &&
            attempt.request.currentController.chapter === attempt.origin;
          const restored = attempt.restoreProtection === undefined || await attempt.restoreProtection(restore);
          if (restored) await attempt.request.currentController.restoreChapterProtection(restore);
        }
      } finally {
        try { await this.releaseReceipt(attempt); }
        finally { if (this.attempt === attempt) { this.attempt = undefined; this.revision++; } }
      }
    })();
    attempt.cleanup = task;
    return task;
  }
}
