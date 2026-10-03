import {
  SourceGateway,
  type BookSource,
  type SourceCheckOutcome,
} from './SourceGateway';
import type { BookSourceJsonSelection } from '../../app/ReaderHostRegistry';
import { ReaderRuntimeOwner } from '../../app/ReaderRuntimeOwner';
import { ReaderWriteEvidence } from '../../app/ReaderWriteEvidence';
import { projectOperationFacts, type OperationFacts } from '../../app/ReaderOperationFacts';
import { projectPersistedReceipt, type PersistedReceiptProjection } from '../../app/ReaderPersistedReceiptProjection';
import type { RulesMutationSnapshot } from '../settings/RulesMutationOwner';
import { errorMessageOf } from '../../app/ErrorMessage';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { isReaderCoreTransactionPendingError } from '@reader/core-harmony';

const DOMAIN = 0x5244;
let sourceProjectionGeneration: number = 0;

export interface SourceManagementProjection {
  action: string;
  sourceId: string;
  receipt?: PersistedReceiptProjection<BookSource[]>;
  readFacts?: OperationFacts<BookSource[]>;
  confirmedParts?: number;
  original?: RulesMutationSnapshot;
}

export type SourceManagementStatusKind = 'idle' | 'loading' | 'success' | 'warning' | 'error';

export interface SourceImportCompletion {
  importedCount: number;
  refreshWarning?: string;
  failureSummary?: string;
}

/** Resolves after `millis`, used for bounded backoff in transient-Core retries. */
function delay(millis: number): Promise<void> {
  return new Promise<void>((resolve: () => void): void => {
    setTimeout(resolve, millis);
  });
}

/**
 * Core exposes persistence/Host-operation contention through a stable typed
 * `TRANSACTION_PENDING` error. Human-readable message text is not an ABI.
 */
function isPendingTransactionError(error: Error): boolean {
  return isReaderCoreTransactionPendingError(error);
}

/**
 * Owns the Source Management page's orchestration. A plain class: a serial
 * toggle chain (Core rejects `source.update` while an earlier Host operation
 * is pending), bounded Core-idle waits, and entry `session` / per-toggle `seq`
 * guards on every write-back. Emits typed `BookSource[]` snapshots; Index only
 * forwards them.
 *
 * The toggle chain deliberately outlives a single page entry: a queued toggle
 * is the user's last intent and is still submitted even if they leave before
 * it runs; re-entering awaits this chain so the fresh list reflects the
 * persisted truth.
 */
export class SourceOrchestrator {
  private static readonly owners: WeakMap<ReaderRuntimeOwner, SourceOrchestrator> = new WeakMap();
  private presentationIdentity: string | undefined = 'legacy-constructor';
  static forRuntime(owner: ReaderRuntimeOwner): SourceOrchestrator | undefined {
    if (!ReaderRuntimeOwner.isCurrent(owner)) return undefined;
    let host = SourceOrchestrator.owners.get(owner);
    if (host === undefined) {
      host = new SourceOrchestrator((): void => {}, (): boolean => false,
        (): void => {}, owner, (): void => {});
      SourceOrchestrator.owners.set(owner, host);
    }
    return host;
  }
  attachPresentation(identity: string, emit: (sources: BookSource[]) => void,
    current: () => boolean, status: (kind: SourceManagementStatusKind, message: string) => void,
    projection: (value: SourceManagementProjection) => void): boolean {
    try { if (identity.length === 0 || !ReaderRuntimeOwner.isCurrent(this.owner) || !current()) return false; }
    catch (_) { return false; }
    if (this.presentationIdentity !== identity) this.session += 1;
    this.presentationIdentity = identity;
    this.emit = emit; this.isCurrent = current; this.emitStatus = status; this.emitProjection = projection;
    if (this.hasRead) { try { emit(this.sources); } catch (_) {} }
    try { projection(this.latestProjection); } catch (_) {}
    const receipt = this.latestProjection.receipt;
    if (receipt !== undefined) this.publishStatus(receipt.receipt.fact === 'confirmedCurrent' ? 'idle' : 'warning', receipt.receipt.message);
    return true;
  }
  detachPresentation(identity: string): void {
    if (this.presentationIdentity !== identity) return;
    this.presentationIdentity = undefined; this.session += 1;
    this.isCurrent = (): boolean => false;
    this.emit = (): void => {}; this.emitStatus = (): void => {}; this.emitProjection = (): void => {};
  }
  isPresentationCurrent(identity: string): boolean {
    return this.presentationIdentity === identity && this.isCurrentSession(this.session);
  }
  private owner: ReaderRuntimeOwner;
  private gateway: SourceGateway;
  private emit: (sources: BookSource[]) => void;
  private emitStatus: (kind: SourceManagementStatusKind, message: string) => void;
  private isCurrent: () => boolean;
  /** Authoritative mirror; Index's @State is a projection of it. */
  private sources: BookSource[] = [];
  /** Bumped on every entry; stale-entry loads/write-backs are dropped. */
  private session: number = 0;
  /** Bumped per toggle; an older toggle's reload must not overwrite a newer. */
  private toggleSeq: number = 0;
  /** Serializes Core source operations across entries. */
  private operationChain: Promise<void> = Promise.resolve();
  /** Prevents repeated taps from opening multiple system pickers. */
  private importActive: boolean = false;
  /** Session-local source-check projections; Core remains authoritative. */
  private checkResults: Map<string, BookSource> = new Map<string, BookSource>();
  private checkingSourceIds: Set<string> = new Set<string>();
  private emitProjection: (projection: SourceManagementProjection) => void;
  private latestProjection: SourceManagementProjection = { action: 'load', sourceId: '' };
  private hasRead: boolean = false;

  constructor(
    emit: (sources: BookSource[]) => void,
    isCurrent: () => boolean,
    emitStatus: (kind: SourceManagementStatusKind, message: string) => void =
      (_kind: SourceManagementStatusKind, _message: string): void => {},
    owner: ReaderRuntimeOwner = ReaderRuntimeOwner.current(),
    emitProjection: (projection: SourceManagementProjection) => void =
      (_projection: SourceManagementProjection): void => {},
  ) {
    this.owner = owner;
    this.gateway = new SourceGateway(owner);
    this.emit = emit;
    this.emitStatus = emitStatus;
    this.isCurrent = isCurrent;
    this.emitProjection = emitProjection;
  }

  /** Enter Source Management: wait for in-flight toggles, then load the list. */
  open(): void {
    if (!this.isCurrentSession(this.session)) return;
    this.session += 1;
    const session = this.session;
    this.checkResults.clear();
    this.publishStatus('loading', '正在读取 Core 书源数据…');
    this.publishRead(session, 'loading');
    this.operationChain = this.operationChain.then((): Promise<void> => this.loadList(session));
  }

  owns(owner: ReaderRuntimeOwner): boolean { return this.owner === owner; }

  reconcile(generation: number): void {
    const session = this.session;
    this.operationChain = this.operationChain.then(async (): Promise<void> => {
      if (!this.isCurrentSession(session)) return;
      const original=this.latestProjection.original;
      if (original?.blocked && original.generation===generation) {
        await this.recoverOriginal(session,false);await this.loadList(session,false);return;
      }
      const receipt = this.latestProjection.receipt;
      const read = this.latestProjection.readFacts;
      if (receipt?.facts.generation === generation && receipt.facts.canRetry) {
        this.publishReceipt(session, this.latestProjection.action, this.latestProjection.sourceId,
          receipt.receipt.confirmation, 'reading');
        await this.loadList(session);
      } else if (read?.generation === generation && read.canRetry) {
        this.publishRead(session, 'loading'); await this.loadList(session);
      }
    });
  }

  continueOriginal(generation: number): void {
    const session=this.session,original=this.latestProjection.original;
    if (!this.isCurrentSession(session) || original?.generation!==generation || !original.canRetryOriginal || original.busy) return;
    this.operationChain=this.operationChain.then(async (): Promise<void> => {
      if (!this.isCurrentSession(session) || this.latestProjection.original?.generation!==generation) return;
      await this.recoverOriginal(session,true);await this.loadList(session,false);
    });
  }
  private async recoverOriginal(session: number, retry: boolean): Promise<void> {
    if (!this.isCurrentSession(session)) return;
    try { await this.gateway.recoverOriginalSource((): boolean => this.isCurrentSession(session),retry); }
    catch (_) { /* Actual owner retains its exact reason and original barrier. */ }
    if (!this.isCurrentSession(session)) return;
    const previous = this.latestProjection;
    this.latestProjection = { action: previous.action, sourceId: previous.sourceId, receipt: previous.receipt,
      readFacts: previous.readFacts, confirmedParts: previous.confirmedParts,
      original: this.gateway.originalMutationSnapshot() };
    try {this.emitProjection(this.latestProjection);} catch (_) {}
  }
  private originalBlocked(): boolean { return this.gateway.originalMutationSnapshot()?.blocked===true; }
  retryLoad(): void {
    if (this.isCurrentSession(this.session)) {
      this.open();
    }
  }

  private async loadList(session: number, recover: boolean = true): Promise<void> {
    // A toggle tapped just before leaving the page may still be awaiting Host
    // durability; Core rejects `source.list` while that persistence transaction
    // is pending. The same serial chain drains admitted toggles before this
    // read, retrying only if an unrelated transaction still holds the
    // bus so a transient rejection can never leave the page permanently blank.
    if (!this.isCurrentSession(session)) return;
    if (recover) await this.recoverOriginal(session,false);
    if (!this.isCurrentSession(session)) return;
    let sources: BookSource[];
    try {
      sources = await this.loadSourcesWithRetry(session);
    } catch (error) {
      if (this.isCurrentSession(session)) {
        this.publishRead(session, 'failed', (error as Error).message);
        const receipt = this.latestProjection.receipt;
        if (receipt !== undefined) this.publishReceipt(session, this.latestProjection.action,
          this.latestProjection.sourceId, receipt.receipt.confirmation, 'failed', (error as Error).message);
        if (receipt === undefined) this.publishStatus('error', `书源列表读取失败：${(error as Error).message}`);
        hilog.error(DOMAIN, 'Reader',
          'Source management load failed: %{private}s', (error as Error).message);
      }
      return;
    }
    if (this.isCurrentSession(session)) {
      this.presentSources(sources);
      this.hasRead = true;
      this.publishRead(session, 'succeeded');
      const receipt = this.latestProjection.receipt;
      if (receipt !== undefined) this.publishReceipt(session, this.latestProjection.action,
        this.latestProjection.sourceId, receipt.receipt.confirmation, 'succeeded');
      if (receipt?.receipt.confirmation === 'unknown') return;
      this.publishStatus('idle', '');
    }
  }

  /**
   * Enqueue a source toggle on the serial chain. The write-back is gated on
   * the entry session that enqueued it and the toggle's own seq, so a stale
   * completion never repaints a re-entry or a newer toggle.
   */
  toggleSource(id: string, enabled: boolean): void {
    if (!this.isCurrentSession(this.session) || (this.latestProjection.receipt?.receipt.confirmation === 'unknown' || this.originalBlocked())) return;
    this.toggleSeq += 1;
    const seq = this.toggleSeq;
    const session = this.session;
    this.operationChain = this.operationChain
      .then((): Promise<void> => this.applyToggle(id, enabled, seq, session))
      .catch((error: Error): void => {
        if (this.isCurrentSession(session)) {
          this.publishStatus('error', `书源启停失败：${error.message}`);
        }
        hilog.error(DOMAIN, 'Reader',
          'Source toggle failed; row unchanged: sourceId=%{private}s enabled=%{private}s err=%{private}s',
          id, enabled, error.message);
      });
  }

  /** Queue one production L1-L5 diagnostic; repeated taps never duplicate it. */
  checkSource(id: string): void {
    if (!this.isCurrentSession(this.session) || this.checkingSourceIds.has(id)) {
      return;
    }
    const session = this.session;
    this.checkingSourceIds.add(id);
    this.setCheckProjection(id, 'checking', [], '检测中');
    this.operationChain = this.operationChain
      .then((): Promise<void> => this.applySourceCheck(id, session))
      .catch((error: Error): void => {
        if (this.isCurrentSession(session)) {
          this.setCheckProjection(id, 'failed', [], error.message);
        }
        hilog.error(DOMAIN, 'Reader',
          'Source check failed: sourceId=%{private}s err=%{private}s', id, error.message);
      })
      .finally((): void => {
        this.checkingSourceIds.delete(id);
      });
  }

  /** Open the source-owned login/challenge URL on the shared Host session. */
  loginSource(id: string): void {
    const source = this.sources.find((candidate: BookSource): boolean => candidate.sourceId === id);
    if (!this.isCurrentSession(this.session) || source === undefined || source.loginUrl === undefined || this.checkingSourceIds.has(id)) {
      return;
    }
    const loginUrl = source.loginUrl;
    const session = this.session;
    this.checkingSourceIds.add(id);
    this.setCheckProjection(id, 'checking', [], '等待登录 / 验证');
    this.operationChain = this.operationChain
      .then(async (): Promise<void> => {
        if (!this.isCurrentSession(session)) return;
        await this.owner.openSourceLogin(source.sourceId, loginUrl, source.name);
        if (!this.isCurrentSession(session)) {
          return;
        }
        const outcome = await this.gateway.checkSource(
          source.sourceId,
          (): boolean => this.isCurrentSession(session),
        );
        if (this.isCurrentSession(session)) {
          this.applySourceCheckOutcome(outcome);
        }
      })
      .catch((error: Error): void => {
        if (this.isCurrentSession(session)) {
          this.setCheckProjection(id, 'unchecked', [], '登录 / 验证已取消');
        }
        hilog.warn(DOMAIN, 'Reader',
          'Source login/challenge ended without completion: sourceId=%{private}s err=%{private}s',
          id, error.message);
      })
      .finally((): void => {
        this.checkingSourceIds.delete(id);
      });
  }

  /**
   * Select and import one production Legado JSON document. The task joins the
   * same serialized mutation chain as toggles so Core never sees overlapping
   * source writes. With no admitted Figma error state, failures are logged and
   * the current page remains visible; no success state is fabricated.
   */
  importBookSources(
    onlineUrl?: string,
    onComplete: (completion: SourceImportCompletion) => void =
      (_completion: SourceImportCompletion): void => {},
    onFailure: (error: Error) => void = (_error: Error): void => {},
  ): void {
    if (!this.isCurrentSession(this.session) || this.importActive ||
      (this.latestProjection.receipt?.receipt.confirmation === 'unknown' || this.originalBlocked())) {
      return;
    }
    this.importActive = true;
    const session = this.session;
    this.publishStatus('loading', onlineUrl === undefined ? '正在导入本地书源…' : '正在导入在线书源…');
    this.operationChain = this.operationChain
      .then(async (): Promise<void> => {
        const completion = await this.applyBookSourceImport(session, onlineUrl);
        if (completion !== undefined && this.isCurrentSession(session)) {
          try { onComplete(completion); } catch (_) { /* A view cannot undo an accepted import. */ }
        }
      })
      .catch((error: Error): void => {
        if (this.isCurrentSession(session)) {
          this.publishStatus('error', `书源导入失败：${error.message}`);
          try { onFailure(error); } catch (_) {}
        }
        hilog.error(DOMAIN, 'Reader',
          'Book-source import failed; page kept unchanged: %{private}s', error.message);
      })
      .finally((): void => {
        this.importActive = false;
      });
  }

  private async applyBookSourceImport(
    session: number,
    onlineUrl?: string,
  ): Promise<SourceImportCompletion | undefined> {
    if (!this.isCurrentSession(session)) {
      return;
    }
    let selection: BookSourceJsonSelection | undefined;
    try {
      selection = onlineUrl === undefined ?
        await this.owner.selectBookSourceJson() :
        await this.owner.loadOnlineJsonDocument(onlineUrl);
    } catch (error) {
      if (!this.isCurrentSession(session)) {
        return;
      }
      throw error instanceof Error ? error : new Error(errorMessageOf(error));
    }
    if (selection === undefined || !this.isCurrentSession(session)) {
      return;
    }
    let importedCount = 0;
    const evidence = new ReaderWriteEvidence();
    this.gateway.observeWrites(evidence);
    let failureSummary: string | undefined = undefined;
    try {
      const summary = await this.gateway.importBookSourceDocument(
        selection.text,
        (): boolean => this.isCurrentSession(session),
      );
      importedCount = summary.importedCount;
      // Item failures never abort the document (non-abort admission); they are
      // logged individually and summarized so the user sees exact counts.
      for (const failure of summary.failures) {
        hilog.warn(DOMAIN, 'Reader',
          'Book-source import item %{public}d (%{private}s) failed: %{private}s',
          failure.index + 1, failure.sourceId, failure.message);
      }
      if (summary.failedCount > 0) {
        failureSummary = `失败 ${summary.failedCount} 个书源`;
      }
    } catch (error) {
      this.publishReceipt(session, 'import', '', evidence.confirmation(), 'failed', errorMessageOf(error), evidence.confirmedCount);
      const importError = error instanceof Error ? error : new Error(errorMessageOf(error));
      if (!this.isCurrentSession(session)) {
        return;
      }
      // Earlier items in a multi-source document may already be durable. A
      // best-effort authoritative reload reflects that truth without hiding
      // the original item-level Core failure.
      await this.reloadAfterImportFailure(session, selection.fileName);
      if (!this.isCurrentSession(session)) {
        return;
      }
      throw importError;
    } finally { this.gateway.observeWrites(undefined); }

    this.publishReceipt(session, 'import', '', evidence.confirmation(),
      this.isCurrentSession(session) ? 'reading' : 'failed',
      this.isCurrentSession(session) ? undefined : '列表尚未刷新', evidence.confirmedCount);
    if (!this.isCurrentSession(session)) return;
    let sources: BookSource[];
    try {
      sources = await this.gateway.loadSources(undefined, false, (): boolean => this.isCurrentSession(session));
    } catch (error) {
      if (!this.isCurrentSession(session)) {
        return;
      }
      hilog.warn(DOMAIN, 'Reader',
        'Book-source import persisted but source.list refresh failed: file=%{private}s count=%{public}d err=%{private}s',
        selection.fileName, importedCount, (error as Error).message);
      const refreshWarning = `Core 已导入 ${importedCount} 个书源，但列表刷新失败：${(error as Error).message}`;
      this.publishReceipt(session, 'import', '', evidence.confirmation(), 'failed', (error as Error).message, evidence.confirmedCount);
      this.publishStatus('warning', refreshWarning);
      return { importedCount, refreshWarning, failureSummary };
    }
    if (!this.isCurrentSession(session)) {
      return;
    }
    this.presentSources(sources);
    this.hasRead = true;
    this.publishReceipt(session, 'import', '', evidence.confirmation(), 'succeeded', undefined, evidence.confirmedCount);
    hilog.info(DOMAIN, 'Reader',
      'Book-source import completed: file=%{private}s count=%{public}d',
      selection.fileName, importedCount);
    if (failureSummary !== undefined) {
      this.publishStatus('warning', `已导入 ${importedCount} 个书源，${failureSummary}`);
    } else {
      this.publishStatus('success', `已导入 ${importedCount} 个书源`);
    }
    return { importedCount, failureSummary };
  }

  private async reloadAfterImportFailure(session: number, fileName: string): Promise<void> {
    if (!this.isCurrentSession(session)) {
      return;
    }
    try {
      const sources = await this.gateway.loadSources(undefined, false, (): boolean => this.isCurrentSession(session));
      if (this.isCurrentSession(session)) {
        this.presentSources(sources);
      }
    } catch (reloadError) {
      if (!this.isCurrentSession(session)) {
        return;
      }
      hilog.warn(DOMAIN, 'Reader',
        'Book-source import failure reload also failed: file=%{private}s err=%{private}s',
        fileName, (reloadError as Error).message);
    }
  }

  private async applyToggle(
    id: string, enabled: boolean, seq: number, session: number,
  ): Promise<void> {
    // A toggle can be rejected while an unrelated Host operation (search,
    // check, sync) is in flight, because Core refuses to start `source.update`
    // until the bus is free. Wait until Core reports idle, then retry once —
    // the serial chain means this retry only waits out the external operation,
    // never a concurrent toggle.
    if (!ReaderRuntimeOwner.isCurrent(this.owner) || (this.latestProjection.receipt?.receipt.confirmation === 'unknown' || this.originalBlocked())) return;
    const evidence = new ReaderWriteEvidence();
    this.gateway.observeWrites(evidence);
    try { await this.updateSourceWithRetry(id, enabled); }
    catch (error) { this.publishReceipt(session, 'toggle', id, evidence.confirmation(), 'failed', (error as Error).message); return; }
    finally { this.gateway.observeWrites(undefined); }
    this.publishReceipt(session, 'toggle', id, evidence.confirmation(), 'reading');
    if (!enabled && !this.gateway.handlesSourceCleanup()) {
      try {
        // Security policy: disabling a source removes both session and
        // persistent cookies. Re-enabling starts a fresh login/session.
        await this.owner.clearSourceCookieSession(id);
      } catch (error) {
        hilog.error(DOMAIN, 'Reader',
          'Source disabled but cookie-session cleanup failed: sourceId=%{private}s err=%{private}s',
          id, (error as Error).message);
      }
    }
    if (!this.isCurrentSession(session)) {
      this.publishReceipt(session, 'toggle', id, evidence.confirmation(), 'failed', '列表尚未刷新');
      return;
    }
    // `updateSource` resolved → the toggle IS persisted (Core awaits the Host
    // snapshot put). Reflect it locally even if the reload below fails, so a
    // reload failure is never reported as "nothing changed". The flip and the
    // reload share the session guard: leaving and re-entering Source
    // Management starts a fresh list load that supersedes this write-back.
    if (this.isCurrentSession(session)) {
      this.presentSources(this.sources.map((source): BookSource => {
        if (source.sourceId !== id) {
          return source;
        }
        const updated: BookSource = {
          sourceId: source.sourceId,
          name: source.name,
          baseUrl: source.baseUrl,
          enabled,
          enabledExplore: source.enabledExplore,
          group: source.group,
          category: source.category,
          loginUrl: source.loginUrl,
          checkState: source.checkState,
          checkLevels: source.checkLevels,
          checkMessage: source.checkMessage,
        };
        return updated;
      }));
    }
    let sources: BookSource[];
    try {
      sources = await this.gateway.loadSources(undefined, false, (): boolean => this.isCurrentSession(session));
    } catch (error) {
      this.publishReceipt(session, 'toggle', id, evidence.confirmation(), 'failed', (error as Error).message);
      hilog.warn(DOMAIN, 'Reader',
        'Source toggle persisted but list reload failed: sourceId=%{private}s enabled=%{private}s err=%{private}s',
        id, enabled, (error as Error).message);
      return;
    }
    if (this.isCurrentSession(session) && seq === this.toggleSeq) {
      this.presentSources(sources);
      this.hasRead = true;
      this.publishReceipt(session, 'toggle', id, evidence.confirmation(), 'succeeded');
    }
  }

  private publishRead(session: number, phase: 'loading' | 'failed' | 'succeeded', message?: string): void {
    this.latestProjection = { action: this.latestProjection.action, sourceId: this.latestProjection.sourceId,
      receipt: this.latestProjection.receipt, confirmedParts: this.latestProjection.confirmedParts,
      original: this.gateway.originalMutationSnapshot(),
      readFacts: projectOperationFacts({ phase,
      value: this.hasRead ? this.sources : undefined, canRetry: phase === 'failed',
      generation: ++sourceProjectionGeneration, message }) };
    if (this.isCurrentSession(session)) { try { this.emitProjection(this.latestProjection); } catch (_) {} }
  }

  private publishReceipt(session: number, action: string, sourceId: string,
    confirmation: 'confirmed' | 'unknown' | 'undispatched', readback: 'reading' | 'failed' | 'succeeded',
    refreshError?: string, confirmedParts?: number): void {
    const original=this.gateway.originalMutationSnapshot();
    if (original?.blocked) confirmation=original.confirmation;
    const receipt = projectPersistedReceipt<BookSource[]>({ confirmation, readback, value: this.hasRead ? this.sources : undefined,
      refreshError, canRetry: confirmation !== 'undispatched' && readback !== 'reading' && (readback === 'failed' || confirmation === 'unknown'),
      generation: ++sourceProjectionGeneration });
    this.latestProjection = { action, sourceId, receipt, readFacts: this.latestProjection.readFacts,
      confirmedParts: confirmedParts ?? this.latestProjection.confirmedParts,original };
    if (this.isCurrentSession(session)) {
      try { this.emitProjection(this.latestProjection); } catch (_) {}
      this.publishStatus(readback === 'reading' ? 'loading' : readback === 'failed' || confirmation !== 'confirmed' ? 'warning' : 'idle',
        readback === 'succeeded' && confirmation === 'confirmed' ? '' :
          receipt.receipt.message + (refreshError === undefined ? '' : `：${refreshError}`));
    }
  }

  private async applySourceCheck(id: string, session: number): Promise<void> {
    if (!this.isCurrentSession(session)) {
      return;
    }
    const outcome = await this.gateway.checkSource(
      id,
      (): boolean => this.isCurrentSession(session),
    );
    if (!this.isCurrentSession(session)) {
      return;
    }
    this.applySourceCheckOutcome(outcome);
    hilog.info(DOMAIN, 'Reader',
      'Source check completed: sourceId=%{private}s available=%{private}s levels=%{private}s durationMs=%{public}d reason=%{private}s',
      id, outcome.available, outcome.levelsPassed.join(','), outcome.durationMs,
      outcome.failureReason ?? '');
  }

  private applySourceCheckOutcome(outcome: SourceCheckOutcome): void {
    if (outcome.available) {
      this.setCheckProjection(
        outcome.sourceId,
        'passed',
        outcome.levelsPassed,
        `搜索检测通过 · ${outcome.durationMs}ms`,
      );
      return;
    }
    this.setCheckProjection(
      outcome.sourceId,
      'failed',
      outcome.levelsPassed,
      outcome.failureReason ?? '检测失败',
    );
  }

  private setCheckProjection(
    id: string,
    state: 'unchecked' | 'checking' | 'passed' | 'failed',
    levels: string[],
    message: string,
  ): void {
    const source = this.sources.find((candidate: BookSource): boolean => candidate.sourceId === id);
    if (source === undefined) {
      return;
    }
    this.checkResults.set(id, {
      sourceId: source.sourceId,
      name: source.name,
      baseUrl: source.baseUrl,
      enabled: source.enabled,
      enabledExplore: source.enabledExplore,
      group: source.group,
      category: source.category,
      loginUrl: source.loginUrl,
      checkState: state,
      checkLevels: levels,
      checkMessage: message,
    });
    this.presentSources(this.sources);
  }

  private async updateSourceWithRetry(id: string, enabled: boolean): Promise<void> {
    try {
      await this.gateway.updateSource(id, { enabled }, (): boolean => ReaderRuntimeOwner.isCurrent(this.owner));
      return;
    } catch (error) {
      const err = error as Error;
      if (!isPendingTransactionError(err)) {
        throw err;
      }
      // A pending external Host operation blocked the toggle. Wait until Core
      // reports idle, then retry once; a genuine mismatch echo is rethrown
      // above and never retried.
      await this.waitForCoreIdle(5000);
      if (!ReaderRuntimeOwner.isCurrent(this.owner)) throw new Error('Source runtime owner retired');
      await this.gateway.updateSource(id, { enabled }, (): boolean => ReaderRuntimeOwner.isCurrent(this.owner));
    }
  }

  private async loadSourcesWithRetry(session: number): Promise<BookSource[]> {
    try {
      return await this.gateway.loadSources(undefined, false, (): boolean => this.isCurrentSession(session));
    } catch (error) {
      const err = error as Error;
      if (!isPendingTransactionError(err)) {
        throw err;
      }
      // A persistence transaction (a toggle's durability, a replace mutation)
      // is holding the bus. Wait until Core reports idle, then load once more
      // instead of guessing a fixed backoff window.
      await this.waitForCoreIdle(5000);
      if (!this.isCurrentSession(session)) throw new Error('书源原页面已关闭');
      return await this.gateway.loadSources(undefined, false, (): boolean => this.isCurrentSession(session));
    }
  }

  /**
   * Polls `runtime.status` until Core reports no pending Host operations
   * (bounded). `runtime.status` is exempt from the persistence-transaction
   * gate, so it stays responsive while other commands are rejected.
   */
  private async waitForCoreIdle(maxMillis: number): Promise<void> {
    const deadline = Date.now() + maxMillis;
    while (Date.now() < deadline) {
      if (!ReaderRuntimeOwner.isCurrent(this.owner)) throw new Error('书源原 Runtime 已退役');
      try {
        const result = await this.owner.request('runtime.status', {}, {
          canDispatch: (): boolean => ReaderRuntimeOwner.isCurrent(this.owner),
        });
        const pending = result.data['pendingHostOperationCount'] as number | undefined;
        if (pending === 0) {
          return;
        }
      } catch (error) {
        // The probe itself failed transiently; keep polling until the deadline.
        hilog.warn(DOMAIN, 'Reader',
          'runtime.status probe failed during idle wait: %{private}s', (error as Error).message);
      }
      await delay(250);
    }
  }

  private isCurrentSession(session: number): boolean {
    try { return this.presentationIdentity !== undefined && ReaderRuntimeOwner.isCurrent(this.owner) &&
      this.isCurrent() && session === this.session; } catch (_) { return false; }
  }

  private presentSources(sources: BookSource[]): void {
    this.sources = sources.map((source: BookSource): BookSource => {
      const checked = this.checkResults.get(source.sourceId);
      return {
        sourceId: source.sourceId,
        name: source.name,
        baseUrl: source.baseUrl,
        enabled: source.enabled,
        enabledExplore: source.enabledExplore,
        group: source.group,
        category: source.category,
        loginUrl: source.loginUrl,
        checkState: checked?.checkState ?? source.checkState ?? 'unchecked',
        checkLevels: checked?.checkLevels ?? source.checkLevels ?? [],
        checkMessage: checked?.checkMessage ?? source.checkMessage,
      };
    });
    if (this.isCurrentSession(this.session)) { try { this.emit(this.sources); } catch (_) {} }
  }

  private publishStatus(kind: SourceManagementStatusKind, message: string): void {
    if (this.isCurrentSession(this.session)) {
      const original=this.gateway.originalMutationSnapshot();
      try { this.emitStatus(original?.blocked ? 'warning' : kind,original?.blocked ? original.message : message); } catch (_) {}
    }
  }
}
