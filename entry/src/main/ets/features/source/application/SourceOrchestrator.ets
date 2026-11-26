import {
  SourceGateway,
  type BookSource,
  type SourceCheckOutcome,
  type SourceCheckHistoryEntry,
  type SourceGroupCatalogData,
  type SourceGroupMutateParams,
  type SourceDefinitionSnapshot,
} from './SourceGateway';
import { SourceInitialMembershipUnconfirmed } from './SourceInitialMembershipUnconfirmed';
import type { SourceV9ImportedReport } from './SourceV9TransferState';
import { projectSourceV9Check, retainSourceV9Check, sourceV9AuthenticationDenied, sourceV9Supports } from '../presentation/SourceManagementV9';
import type { BookSourceJsonSelection } from '../../../app/ReaderHostRegistry';
import { ReaderRuntimeOwner } from '../../../app/ReaderRuntimeOwner';
import { ReaderWriteEvidence } from '../../../app/ReaderWriteEvidence';
import { projectOperationFacts, type CommitConfirmationKind, type OperationFacts } from '../../../app/ReaderOperationFacts';
import { projectPersistedReceipt, type PersistedReceiptProjection } from '../../../app/ReaderPersistedReceiptProjection';
import type { RulesMutationSnapshot } from '../../settings/application/RulesMutationOwner';
import { errorMessageOf } from '../../../app/ErrorMessage';
import { ReaderUIVerificationProbe } from '../../../app/diagnostics/ReaderUIVerificationProbe';
import { OFFLINE_DETECT_CORE_REASON, PUBLIC_OFFLINE_DETECT_SOURCE_URL, sourceVerificationOfflineDetectIdentity,
  sourceVerificationOpening, sourceVerificationRecoveryControl, sourceVerificationRowLoginControl,
  sourceVerificationToggleAnchor, type SourceOfflineDetectAdmission, type SourceVerificationControl,
  type SourceVerificationOpening,
  type SourceToggleObservationIdentity, type SourceToggleSettledObservation } from '../ui/SourceManagementVerification';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { isReaderCoreTransactionPendingError } from '@reader/core-harmony';

const DOMAIN = 0x5244;
let sourceProjectionGeneration: number = 0;
let sourceImportReadbackIdentity: number = 0;
let offlineDetectVerificationSequence: number = 0;
let sourceControlVerificationSequence: number = 0;

export interface SourceV9CheckOptions {
  mode: 'search' | 'explore';
  levels: string[];
  keyword: string;
}

interface SourceCheckCapture {
  sourceId: string;
  sourceVersion?: string;
  signature: string;
  session: number;
  active?: () => boolean;
  definition?: SourceDefinitionSnapshot;
  offlineDetect?: SourceOfflineDetectAdmission;
}

interface SourceLoginError { code?: string }

interface SourceReadRetryObservation {
  readonly phase: 'started' | 'settled';
  readonly failedReadGeneration: number;
  readonly startedReadGeneration: number;
  readonly readGeneration: number;
  readonly readFact: string;
  readonly count: number;
}

interface PendingImportReadback {
  readonly identity: number;
  readonly sourceIds: string[];
  readonly confirmedParts: number;
}

export interface SourceManagementProjection {
  action: string;
  sourceId: string;
  receipt?: PersistedReceiptProjection<BookSource[]>;
  readFacts?: OperationFacts<BookSource[]>;
  confirmedParts?: number;
  importIdentity?: number;
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
  private presentationIdentity: string | undefined;
  static forRuntime(owner: ReaderRuntimeOwner): SourceOrchestrator | undefined {
    if (!ReaderRuntimeOwner.isCurrent(owner)) return undefined;
    let host = SourceOrchestrator.owners.get(owner);
    if (host === undefined) {
      host = new SourceOrchestrator(owner);
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
    const session = this.session;
    this.presentationIdentity = identity;
    this.emit = emit; this.isCurrent = current; this.emitStatus = status; this.emitProjection = projection;
    if (this.hasRead) { try { emit(this.sources); } catch (_) {} }
    if (!this.isCurrentSession(session)) return true;
    try { projection(this.latestProjection); } catch (_) {}
    const receipt = this.latestProjection.receipt;
    if (receipt !== undefined && this.isCurrentSession(session)) {
      this.publishStatus(receipt.receipt.fact === 'confirmedCurrent' ? 'idle' : 'warning', receipt.receipt.message);
    }
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
  private readonly owner: ReaderRuntimeOwner;
  private readonly gateway: SourceGateway;
  private emit: (sources: BookSource[]) => void = (_sources: BookSource[]): void => {};
  private emitStatus: (kind: SourceManagementStatusKind, message: string) => void =
    (_kind: SourceManagementStatusKind, _message: string): void => {};
  private isCurrent: () => boolean = (): boolean => false;
  /** Authoritative mirror, projected through the current presentation lease. */
  private sources: BookSource[] = [];
  /** Bumped on every entry; stale-entry loads/write-backs are dropped. */
  private session: number = 0;
  /** Bumped per toggle; an older toggle's reload must not overwrite a newer. */
  private toggleSeq: number = 0;
  /** Serializes Core source operations across entries. */
  private operationChain: Promise<void> = Promise.resolve();
  private exportInFlight: boolean = false;
  /** Prevents repeated taps from opening multiple system pickers. */
  private importActive: boolean = false;
  /** Session-local source-check projections; Core remains authoritative. */
  private checkResults: Map<string, BookSource> = new Map<string, BookSource>();
  private importedReports = new Map<string, SourceV9ImportedReport>();
  /** Retained across page sessions until the exact V9 import IDs read back. */
  private pendingImportReadback: PendingImportReadback | undefined;
  private readonly deniedLoginReports: Map<string, string> = new Map<string, string>();
  private readonly verifiedLoginSources: Map<string, string> = new Map<string, string>();
  private reportClearTimes = new Map<string, number>();
  private checkingSourceIds: Map<string, SourceCheckCapture> = new Map<string, SourceCheckCapture>();
  private emitProjection: (projection: SourceManagementProjection) => void = (_projection: SourceManagementProjection): void => {};
  private latestProjection: SourceManagementProjection = { action: 'load', sourceId: '' };
  private hasRead: boolean = false;

  private constructor(owner: ReaderRuntimeOwner) {
    this.owner = owner;
    this.gateway = new SourceGateway(owner);
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
    const original = this.latestProjection.original;
    this.observeRecoveryControl('reconcile', generation);
    this.operationChain = this.operationChain.then(async (): Promise<void> => {
      if (!this.isCurrentSession(session)) return;
      if (original?.blocked && original.generation === generation) {
        await this.recoverProjectedOriginal(session, original, false);
        return;
      }
      const receipt = this.latestProjection.receipt;
      const read = this.latestProjection.readFacts;
      if (receipt?.facts.generation === generation && receipt.facts.canRetry) {
        const importIdentity = this.latestProjection.importIdentity;
        this.publishReceipt(session, this.latestProjection.action, this.latestProjection.sourceId,
          receipt.receipt.confirmation, 'reading', undefined, undefined, importIdentity);
        await this.loadList(session, importIdentity === undefined);
      } else if (read?.generation === generation && read.canRetry) {
        this.publishRead(session, 'loading');
        const started = this.latestProjection.readFacts?.generation;
        if (started !== undefined) this.observeReadRetry(session, 'started', generation, started);
        await this.loadList(session, this.pendingImportReadback === undefined);
        if (started !== undefined) this.observeReadRetry(session, 'settled', generation, started);
      }
    });
  }

  private observeReadRetry(session: number, phase: 'started' | 'settled',
    failedReadGeneration: number, startedReadGeneration: number): void {
    if (!ReaderUIVerificationProbe.enabled() || !this.isCurrentSession(session)) return;
    const read = this.latestProjection.readFacts;
    if (read === undefined || (phase === 'settled' && read.generation <= startedReadGeneration)) return;
    const observation: SourceReadRetryObservation = { phase, failedReadGeneration, startedReadGeneration,
      readGeneration: read.generation, readFact: read.fact, count: this.sources.length };
    ReaderUIVerificationProbe.emit('source.read-retry', 'business', observation);
  }

  continueOriginal(generation: number): void {
    const session = this.session;
    const original = this.latestProjection.original;
    if (!this.isCurrentSession(session) || original?.generation !== generation || original.operationId === undefined ||
      !original.blocked || !original.canRetryOriginal || original.busy) return;
    this.observeRecoveryControl('continue', generation);
    this.operationChain = this.operationChain.then((): Promise<void> => this.recoverProjectedOriginal(session, original, true));
  }

  private observeRecoveryControl(control: 'reconcile' | 'continue', generation: number): void {
    try {
      if (!ReaderUIVerificationProbe.enabled() || !this.isCurrentSession(this.session)) return;
      const owner = sourceVerificationOpening(this.presentationIdentity ?? '');
      const original = this.latestProjection.original;
      const receipt = this.latestProjection.receipt;
      const admitted = sourceVerificationRecoveryControl(control, generation,
        original === undefined ? undefined : {
          blocked: original.blocked,
          generation: original.generation,
          operationId: original.operationId,
          canRetryOriginal: original.canRetryOriginal,
          busy: original.busy,
        },
        receipt === undefined ? undefined : {
          confirmation: receipt.receipt.confirmation,
          generation: receipt.facts.generation,
          canRetry: receipt.facts.canRetry,
        });
      if (owner === undefined || admitted === undefined) return;
      this.emitControlAdmission(owner, admitted);
    } catch (_) {
      // Verification never participates in the normal recovery command.
    }
  }

  private emitControlAdmission(owner: SourceVerificationOpening, admitted: SourceVerificationControl): void {
    ReaderUIVerificationProbe.emit('source.control-action', 'business', {
      phase: 'admitted', owner, branch: admitted.branch, control: admitted.control,
      generation: admitted.generation, blocked: admitted.blocked, canContinue: admitted.canContinue,
      sourceAnchor: admitted.sourceAnchor, loginEligible: admitted.loginEligible,
      sequence: ++sourceControlVerificationSequence,
    });
  }

  private async recoverProjectedOriginal(session: number, expected: RulesMutationSnapshot, retry: boolean): Promise<void> {
    if (!this.isCurrentSession(session)) return;
    const current = this.gateway.originalMutationSnapshot();
    if (current?.busy === true) return;
    if (current === undefined || current.generation !== expected.generation || current.operationId !== expected.operationId ||
      !current.blocked || (retry && !current.canRetryOriginal)) {
      this.publishOriginal(session);
      return;
    }
    await this.recoverOriginal(session, retry, expected.operationId);
    await this.loadList(session, false);
  }

  private async recoverOriginal(session: number, retry: boolean, expectedOperationId?: string): Promise<void> {
    if (!this.isCurrentSession(session)) return;
    try { await this.gateway.recoverOriginalSource((): boolean => this.isCurrentSession(session), retry, expectedOperationId); }
    catch (_) { /* Actual owner retains its exact reason and original barrier. */ }
    this.publishOriginal(session);
  }

  private publishOriginal(session: number): void {
    if (!this.isCurrentSession(session)) return;
    const previous = this.latestProjection;
    this.latestProjection = { action: previous.action, sourceId: previous.sourceId, receipt: previous.receipt,
      readFacts: previous.readFacts, confirmedParts: previous.confirmedParts, importIdentity: previous.importIdentity,
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
    const importIdentity = this.latestProjection.importIdentity;
    let sources: BookSource[];
    try {
      sources = await this.loadSourcesWithRetry(session);
    } catch (error) {
      if (!this.isCurrentSession(session) || this.latestProjection.importIdentity !== importIdentity) return;
      const message = error instanceof Error ? error.message : String(error);
      this.publishRead(session, 'failed', message);
      if (!this.isCurrentSession(session) || this.latestProjection.importIdentity !== importIdentity) return;
      const receipt = this.latestProjection.receipt;
      const pending = this.pendingImportReadback;
      if (pending !== undefined && this.latestProjection.action === 'import' && pending.identity === importIdentity) {
        this.publishReceipt(session, 'import', '', 'confirmed', 'failed', message, pending.confirmedParts, pending.identity);
      } else if (receipt !== undefined && importIdentity === undefined) {
        this.publishReceipt(session, this.latestProjection.action,
          this.latestProjection.sourceId, receipt.receipt.confirmation, 'failed', message);
      } else {
        this.publishStatus('error', `书源列表读取失败：${message}`);
      }
      hilog.error(DOMAIN, 'Reader', 'Source management load failed: %{private}s', message);
      return;
    }
    if (!this.isCurrentSession(session) || this.latestProjection.importIdentity !== importIdentity) return;
    this.presentSources(sources);
    this.hasRead = true;
    this.publishRead(session, 'succeeded');
    if (!this.isCurrentSession(session) || this.latestProjection.importIdentity !== importIdentity) return;
    const pending = this.pendingImportReadback;
    const receipt = this.latestProjection.receipt;
    if (pending !== undefined && this.latestProjection.action === 'import' && pending.identity === importIdentity) {
      if (this.originalBlocked()) {
        this.publishStatus('warning', '');
        return;
      }
      const currentIds = new Set(this.sources.map((source: BookSource): string => source.sourceId));
      if (pending.sourceIds.every((id: string): boolean => currentIds.has(id))) {
        this.pendingImportReadback = undefined;
        this.publishReceipt(session, 'import', '', 'confirmed', 'succeeded', undefined, pending.confirmedParts, pending.identity);
      } else {
        this.publishReceipt(session, 'import', '', 'confirmed', 'failed', '列表中未能核对全部已导入书源',
          pending.confirmedParts, pending.identity);
      }
      return;
    }
    if (receipt !== undefined && importIdentity === undefined) {
      this.publishReceipt(session, this.latestProjection.action,
        this.latestProjection.sourceId, receipt.receipt.confirmation, 'succeeded');
    } else if (receipt === undefined || receipt.receipt.fact === 'confirmedCurrent') {
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
    const observation = this.observeToggleAdmission(id, enabled, seq);
    this.operationChain = this.operationChain
      .then((): Promise<void> => this.applyToggle(id, enabled, seq, session, observation))
      .catch((error: Error): void => {
        if (this.isCurrentSession(session)) {
          this.publishStatus('error', `书源启停失败：${error.message}`);
        }
        hilog.error(DOMAIN, 'Reader',
          'Source toggle failed; row unchanged: sourceId=%{private}s enabled=%{private}s err=%{private}s',
          id, enabled, error.message);
      });
  }

  toggleSources(ids: string[], enabled: boolean): void {
    for (const id of this.selectedSourceIds(ids)) this.toggleSource(id, enabled);
  }

  deleteSources(ids: string[]): void {
    const selected = this.selectedSourceIds(ids);
    if (selected.length === 0 || this.originalBlocked()) return;
    const session = this.session;
    this.operationChain = this.operationChain.then(async (): Promise<void> => {
      if (!this.isCurrentSession(session) || this.originalBlocked()) return;
      const result = await this.gateway.deleteSources(selected);
      const pending = this.pendingImportReadback;
      if (pending !== undefined) {
        // A confirmed, idempotent delete leaves all selected IDs absent.
        const remaining = pending.sourceIds.filter((id: string): boolean => !selected.includes(id));
        if (remaining.length === 0) {
          this.pendingImportReadback = undefined;
          const previous = this.latestProjection;
          if (previous.importIdentity === pending.identity) {
            this.latestProjection = { action: 'load', sourceId: '', readFacts: previous.readFacts,
              original: previous.original };
          }
        } else {
          this.pendingImportReadback = { identity: pending.identity, sourceIds: remaining, confirmedParts: pending.confirmedParts };
        }
      }
      await this.loadList(session);
      if (!this.isCurrentSession(session)) return;
      if (this.pendingImportReadback !== undefined &&
        this.latestProjection.receipt?.receipt.fact === 'confirmedRefreshFailed') return;
      const message = `已删除 ${result.deletedCount} 个书源`;
      this.publishStatus(result.cookieCleanupFailures === 0 ? 'success' : 'warning',
        result.cookieCleanupFailures === 0 ? message : `${message}，${result.cookieCleanupFailures} 个登录会话清理失败`);
    }).catch((error: Error): void => {
      if (this.isCurrentSession(session)) this.publishStatus('error', `删除书源失败：${error.message}`);
    });
  }

  exportAll(): void {
    if (this.exportInFlight) return;
    this.exportInFlight = true;
    const session = this.session;
    const current = (): boolean => this.isCurrentSession(session);
    this.operationChain = this.operationChain.then(async (): Promise<void> => {
      if (!current() || AppStorage.get<boolean>('readerAppForeground') === false) return;
      const exported = await this.gateway.exportBookSources(undefined, current);
      if (!current() || AppStorage.get<boolean>('readerAppForeground') === false) return;
      const file = await this.owner.saveBookSourceJson(exported.data, `reader-book-sources-${Date.now()}.json`);
      if (current() && file !== undefined) this.publishStatus('success', `已导出 ${exported.count} 个书源：${file}`);
    }).catch((error: Error): void => {
      if (current()) this.publishStatus('error', `书源导出失败：${error.message}`);
    }).finally((): void => { this.exportInFlight = false; });
  }

  loadGroups(): Promise<SourceGroupCatalogData> {
    const session = this.session;
    return this.gateway.loadSourceGroupCatalog((): boolean => this.isCurrentSession(session));
  }

  mutateGroup(params: SourceGroupMutateParams): Promise<SourceGroupCatalogData> {
    const session = this.session;
    const current = (): boolean => this.isCurrentSession(session);
    const selected = this.selectedSourceIds(params.sourceIds ?? []);
    const run = this.operationChain.then(async (): Promise<SourceGroupCatalogData> => {
      if (!current() || this.originalBlocked()) throw new Error('书源操作暂不可用');
      const input: SourceGroupMutateParams = { action: params.action, expectedRevision: params.expectedRevision,
        groupId: params.groupId, name: params.name, targetGroupId: params.targetGroupId };
      if (selected.length !== (params.sourceIds?.length ?? 0)) {
        throw new Error('所选书源已变化，请重新选择');
      }
      if (params.action === 'assign') {
        if (selected.length === 0) {
          throw new Error('所选书源已变化，请重新选择');
        }
        input.sourceIds = selected;
      }
      try {
        const result = await this.gateway.mutateSourceGroup(input, current);
        if (params.action === 'create' && selected.length > 0) {
          try {
            await this.gateway.mutateSourceGroup({ expectedRevision: result.revision, action: 'assign',
              targetGroupId: result.groupId, sourceIds: selected }, current);
          } catch (_) {
            throw new SourceInitialMembershipUnconfirmed(result.groupId);
          }
        }
      } finally {
        if (current()) await this.loadList(session, false);
      }
      return this.gateway.loadSourceGroupCatalog(current);
    });
    this.operationChain = run.then((): void => {}, (): void => {});
    return run;
  }

  acceptTransferredReports(reports: SourceV9ImportedReport[], confirmedSourceIds: string[],
    onImportAdmitted?: (importIdentity: number) => void): Promise<boolean> {
    const session = this.session;
    const ids = confirmedSourceIds.slice();
    const readback = this.operationChain.then(async (): Promise<boolean> => {
      if (ids.length === 0 && !this.isCurrentSession(session)) return false;
      for (const item of reports) {
        if (item.sourceVersion !== undefined && item.report.sourceId === item.sourceId &&
          item.report.report?.ruleDigest === item.sourceVersion) {
          this.importedReports.set(item.sourceId, item);
        }
      }
      if (ids.length === 0) {
        await this.loadList(session);
        return false;
      }
      const sourceIds = Array.from(new Set(ids));
      const pending: PendingImportReadback = { identity: ++sourceImportReadbackIdentity, sourceIds,
        confirmedParts: sourceIds.length };
      this.pendingImportReadback = pending;
      if (this.isCurrentSession(session)) {
        try { onImportAdmitted?.(pending.identity); } catch (_) { /* Presentation cannot change a confirmed import. */ }
      }
      if (!this.isCurrentSession(session)) {
        this.publishReceipt(session, 'import', '', 'confirmed', 'failed', '列表尚未刷新', pending.confirmedParts, pending.identity);
        return false;
      }
      this.publishReceipt(session, 'import', '', 'confirmed', 'reading', undefined, pending.confirmedParts, pending.identity);
      await this.loadList(session);
      return this.isCurrentSession(session) && this.latestProjection.importIdentity === pending.identity &&
        this.latestProjection.receipt?.receipt.fact === 'confirmedCurrent';
    });
    this.operationChain = readback.then((): void => {}, (): void => {});
    return readback;
  }

  /** Uses the same exact-definition and Core receipt checks as a row diagnostic. */
  runSourceCheck(id: string, options: SourceV9CheckOptions, active: () => boolean,
    onStage: (stage: string) => void): Promise<SourceCheckOutcome | undefined> {
    if (!active()) return Promise.resolve(undefined);
    const capture = this.captureSourceCheck(id, active);
    if (capture === undefined) return Promise.resolve(undefined);
    this.observeOfflineDetectAdmission(capture);
    const current = (): boolean => this.isCurrentSourceCheck(capture);
    const run = this.operationChain.then(async (): Promise<SourceCheckOutcome | undefined> => {
      if (!current()) return undefined;
      const definition = await this.validateSourceCheck(capture);
      if (!current() || definition === undefined) return undefined;
      const observedAt = Date.now();
      const outcome = await this.gateway.checkSource(id, current, options.keyword, options.mode,
        options.levels, 180000, (stage: string): void => { if (current()) onStage(stage); });
      if (!current() || await this.validateSourceCheck(capture, definition) === undefined || !current()) return undefined;
      return this.applySourceCheckOutcome(outcome, capture, observedAt) ? outcome : undefined;
    }).finally((): void => {
      if (this.checkingSourceIds.get(id) === capture) this.checkingSourceIds.delete(id);
    });
    this.operationChain = run.then((): void => {}, (): void => {});
    return run;
  }

  private selectedSourceIds(ids: string[]): string[] {
    const supported = new Set(this.sources.filter(sourceV9Supports).map((source: BookSource): string => source.sourceId));
    return Array.from(new Set(ids)).filter((id: string): boolean => supported.has(id));
  }

  private observeToggleAdmission(id: string, requestedEnabled: boolean, toggleSeq: number): SourceToggleObservationIdentity | undefined {
    try {
      if (!ReaderUIVerificationProbe.enabled()) return undefined;
      const owner = sourceVerificationOpening(this.presentationIdentity ?? '');
      if (owner === undefined) return undefined;
      const source = this.sources.find((candidate: BookSource): boolean => candidate.sourceId === id);
      const anchor = sourceVerificationToggleAnchor(source);
      if (anchor === 0) return undefined;
      const observation: SourceToggleObservationIdentity = { owner, anchor, toggleSeq, requestedEnabled };
      ReaderUIVerificationProbe.emit('source.toggle', 'business', {
        phase: 'admitted', owner: observation.owner, anchor: observation.anchor,
        toggleSeq: observation.toggleSeq, requestedEnabled: observation.requestedEnabled,
      });
      return observation;
    } catch (_) {
      // Verification must never affect whether the normal input is admitted.
      return undefined;
    }
  }

  /** Queue the production row diagnostic without duplicating a pending check. */
  checkSource(id: string): void {
    const capture = this.captureSourceCheck(id);
    if (capture === undefined) return;
    this.observeOfflineDetectAdmission(capture);
    this.setCheckProjection(id, 'checking', [], '检测中');
    this.operationChain = this.operationChain
      .then((): Promise<void> => this.applySourceCheck(capture))
      .catch(async (error: Error): Promise<void> => {
        await this.publishSourceCheckFailure(capture, 'failed', error.message);
        hilog.error(DOMAIN, 'Reader',
          'Source check failed: sourceId=%{private}s err=%{private}s', id, error.message);
      })
      .finally((): void => {
        if (this.checkingSourceIds.get(id) === capture) this.checkingSourceIds.delete(id);
      });
  }

  private observeOfflineDetectAdmission(capture: SourceCheckCapture): void {
    try {
      if (capture.sourceId !== PUBLIC_OFFLINE_DETECT_SOURCE_URL || !ReaderUIVerificationProbe.enabled()) return;
      const read = this.latestProjection.readFacts;
      if (read?.fact !== 'current') return;
      const source = this.sources.find((candidate: BookSource): boolean => candidate.sourceId === capture.sourceId);
      const identity = sourceVerificationOfflineDetectIdentity(source,
        sourceVerificationOpening(this.presentationIdentity ?? ''), read.generation);
      if (identity === undefined) return;
      const admitted: SourceOfflineDetectAdmission = {
        owner: identity.owner, anchor: identity.anchor, readGeneration: identity.readGeneration,
        definition: identity.definition, reportVersion: identity.reportVersion,
        sequence: ++offlineDetectVerificationSequence,
      };
      capture.offlineDetect = admitted;
      ReaderUIVerificationProbe.emit('source.row-detect', 'business', {
        phase: 'admitted', owner: admitted.owner, anchor: admitted.anchor,
        readGeneration: admitted.readGeneration, definition: admitted.definition,
        reportVersion: admitted.reportVersion, sequence: admitted.sequence,
      });
    } catch (_) {
      // Verification is observational for the normal admitted command.
    }
  }

  private observeOfflineDetectResult(capture: SourceCheckCapture, outcome: SourceCheckOutcome): void {
    try {
      const admission = capture.offlineDetect;
      const report = outcome.report;
      if (admission === undefined || report === undefined || !this.isCurrentSourceCheck(capture)) return;
      const l1 = report.steps[0];
      const l2 = report.steps[1];
      ReaderUIVerificationProbe.emit('source.row-detect', 'business', {
        phase: 'settled', owner: admission.owner, anchor: admission.anchor,
        readGeneration: admission.readGeneration, definition: admission.definition,
        sequence: admission.sequence, reportVersion: report.version, mode: report.mode,
        available: outcome.available, requestedLevels: outcome.requestedLevels ?? [],
        levelsPassed: outcome.levelsPassed, l1: l1.status, l2: l2.status,
        l1Executed: l1.executed, l2Executed: l2.executed,
        reason: outcome.failureReason === OFFLINE_DETECT_CORE_REASON ? 'missing-search-url' : 'other',
        hostEvidenceCount: outcome.hostEvidenceCount,
      });
    } catch (_) {
      // The validated production report and row projection are already committed.
    }
  }

  /** Open the source-owned login/challenge URL on the shared Host session. */
  loginSource(id: string, loginUrl: string): void {
    const source = this.sources.find((candidate: BookSource): boolean => candidate.sourceId === id);
    if (source === undefined || source.loginUrl !== loginUrl || loginUrl.trim().length === 0 ||
      this.gateway.originalMutationSnapshot()?.blocked === true ||
      this.latestProjection.receipt?.receipt.confirmation === 'unknown') return;
    const capture = this.captureSourceCheck(id);
    if (capture === undefined) return;
    this.setCheckProjection(id, 'checking', [], '等待登录 / 验证');
    this.operationChain = this.operationChain
      .then(async (): Promise<void> => {
        const definition = await this.validateSourceCheck(capture);
        if (definition === undefined) return;
        this.observeRowLoginControl(source, loginUrl);
        await this.owner.openSourceLogin(source.sourceId, loginUrl, source.name,
          (): boolean => this.isCurrentSourceCheck(capture),
          (): Promise<boolean> => this.clearLoginReport(capture));
        if (await this.validateSourceCheck(capture, definition) === undefined) return;
        const outcome = await this.gateway.checkSource(
          source.sourceId,
          (): boolean => this.isCurrentSourceCheck(capture),
          undefined, 'search', ['L1', 'L2'],
        );
        if (await this.validateSourceCheck(capture, definition) !== undefined) {
          this.applySourceCheckOutcome(outcome, capture, Date.now(), true);
        }
      })
      .catch(async (error: Error): Promise<void> => {
        const code = (error as SourceLoginError | undefined)?.code;
        const detail = errorMessageOf(error);
        const message = code === 'CANCELLED' || detail === 'SOURCE_LOGIN_SESSION_RETIRED' ? '登录 / 验证已取消' :
          detail === 'SOURCE_LOGIN_COOKIE_CLEAR_FAILED' ? '未能清除登录态，请重新打开登录页后重试' : `登录 / 验证失败：${detail}`;
        await this.publishSourceCheckFailure(capture, 'unchecked', message);
        if (code !== 'CANCELLED' && detail !== 'SOURCE_LOGIN_SESSION_RETIRED' && this.isCurrentSourceCheck(capture)) {
          this.publishStatus('warning', message);
        }
        hilog.warn(DOMAIN, 'Reader',
          'Source login/challenge ended without completion: sourceId=%{private}s err=%{private}s', id, detail);
      })
      .finally((): void => {
        if (this.checkingSourceIds.get(id) === capture) this.checkingSourceIds.delete(id);
      });
  }

  private async clearLoginReport(capture: SourceCheckCapture): Promise<boolean> {
    const current = (): boolean => this.isCurrentSourceCheck(capture);
    if (!current()) throw new Error('书源登录已结束');
    this.resetLoginProjection(capture.sourceId);
    this.presentSources(this.sources);
    const cleared = await this.gateway.clearSourceCheckReports([capture.sourceId], current);
    return cleared.supported;
  }

  private resetLoginProjection(id: string): void {
    this.reportClearTimes.set(id, Date.now());
    this.verifiedLoginSources.delete(id);
    this.deniedLoginReports.delete(id);
    this.importedReports.delete(id);
    this.checkResults.delete(id);
  }

  private observeRowLoginControl(source: BookSource, loginUrl: string): void {
    try {
      if (!ReaderUIVerificationProbe.enabled() || !this.isCurrentSession(this.session)) return;
      const owner = sourceVerificationOpening(this.presentationIdentity ?? '');
      const admitted = sourceVerificationRowLoginControl(source, loginUrl,
        this.gateway.originalMutationSnapshot()?.blocked === true,
        this.latestProjection.receipt?.receipt.confirmation);
      if (owner === undefined || admitted === undefined) return;
      this.emitControlAdmission(owner, admitted);
    } catch (_) {
      // The source owner opens the same normal page regardless of observation.
    }
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
    if (!this.isCurrentSession(session)) return;
    if (selection === undefined) {
      // The native picker was cancelled before any Core operation was issued.
      this.publishStatus('idle', '');
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
      sources = await this.gateway.loadSources(undefined, true, (): boolean => this.isCurrentSession(session));
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
      const sources = await this.gateway.loadSources(undefined, true, (): boolean => this.isCurrentSession(session));
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
    id: string, enabled: boolean, seq: number, session: number, observation?: SourceToggleObservationIdentity,
  ): Promise<void> {
    // A toggle can be rejected while an unrelated Host operation (search,
    // check, sync) is in flight, because Core refuses to start `source.update`
    // until the bus is free. Wait until Core reports idle, then retry once —
    // the serial chain means this retry only waits out the external operation,
    // never a concurrent toggle.
    if (!ReaderRuntimeOwner.isCurrent(this.owner) || (this.latestProjection.receipt?.receipt.confirmation === 'unknown' || this.originalBlocked())) return;
    const enabledSource = this.sources.find((source: BookSource): boolean => source.sourceId === id);
    const clearLoginReport = !enabled && (enabledSource?.loginUrl?.trim().length ?? 0) > 0;
    const evidence = new ReaderWriteEvidence();
    this.gateway.observeWrites(evidence);
    try { await this.updateSourceWithRetry(id, enabled); }
    catch (error) {
      this.publishToggleReceipt(session, id, evidence.confirmation(), 'failed', observation, (error as Error).message);
      return;
    }
    finally { this.gateway.observeWrites(undefined); }
    this.publishReceipt(session, 'toggle', id, evidence.confirmation(), 'reading');
    if (clearLoginReport) this.resetLoginProjection(id);
    if (!enabled) this.deniedLoginReports.delete(id);
    if (this.isCurrentSession(session)) {
      // The toggle is already confirmed. Publish the cleared projection before
      // cookie/report cleanup or list readback can wait on I/O.
      this.presentSources(this.sources.map((source: BookSource): BookSource => {
        if (source.sourceId !== id) return source;
        const updated: BookSource = {
          sourceId: source.sourceId, name: source.name, baseUrl: source.baseUrl, enabled,
          enabledExplore: source.enabledExplore, group: source.group, sourceVersion: source.sourceVersion,
          category: source.category, loginUrl: source.loginUrl, loginState: source.loginState,
          checkState: source.checkState, checkLevels: source.checkLevels, checkMessage: source.checkMessage,
          checkReports: source.checkReports, lastCheckSummary: source.lastCheckSummary,
          offlineDetectReportVersion: source.offlineDetectReportVersion,
        };
        return updated;
      }));
    }
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
    let reportCleanupWarning = '';
    if (clearLoginReport && ReaderRuntimeOwner.isCurrent(this.owner)) {
      try {
        const cleared = await this.gateway.clearSourceCheckReports([id], (): boolean => ReaderRuntimeOwner.isCurrent(this.owner));
        if (!cleared.supported) reportCleanupWarning = '书源已停用，当前 Core 无法清除已保存的检测报告';
      } catch (error) {
        reportCleanupWarning = '书源已停用，未能确认旧检测报告已清除';
        hilog.warn(DOMAIN, 'Reader', 'Disabled source report cleanup failed: %{private}s', errorMessageOf(error));
      }
    }
    if (!this.isCurrentSession(session)) {
      this.publishReceipt(session, 'toggle', id, evidence.confirmation(), 'failed', '列表尚未刷新');
      return;
    }
    let sources: BookSource[];
    try {
      sources = await this.gateway.loadSources(undefined, true, (): boolean => this.isCurrentSession(session));
    } catch (error) {
      this.publishToggleReceipt(session, id, evidence.confirmation(), 'failed', observation, (error as Error).message);
      hilog.warn(DOMAIN, 'Reader',
        'Source toggle persisted but list reload failed: sourceId=%{private}s enabled=%{private}s err=%{private}s',
        id, enabled, (error as Error).message);
      return;
    }
    if (this.isCurrentSession(session) && seq === this.toggleSeq) {
      this.presentSources(sources);
      this.hasRead = true;
      this.publishToggleReceipt(session, id, evidence.confirmation(), 'succeeded', observation, undefined, sources);
      if (reportCleanupWarning.length > 0) this.publishStatus('warning', reportCleanupWarning);
    }
  }

  private publishToggleReceipt(session: number, id: string, confirmation: CommitConfirmationKind,
    readback: 'failed' | 'succeeded', observation: SourceToggleObservationIdentity | undefined,
    refreshError?: string, freshSources?: BookSource[]): void {
    const receipt = this.publishReceipt(session, 'toggle', id, confirmation, readback, refreshError).receipt;
    if (observation === undefined || !this.isCurrentSession(session) || observation.toggleSeq !== this.toggleSeq) return;
    try {
      const rows = freshSources?.filter((source: BookSource): boolean => source.sourceId === id) ?? [];
      const observed = rows.length === 1 && sourceVerificationToggleAnchor(rows[0]) === observation.anchor ? rows[0] : undefined;
      const settled: SourceToggleSettledObservation = {
        phase: 'settled', owner: observation.owner, anchor: observation.anchor,
        toggleSeq: observation.toggleSeq, requestedEnabled: observation.requestedEnabled,
        confirmation: receipt.confirmation, readback, observedEnabled: observed?.enabled,
      };
      ReaderUIVerificationProbe.emit('source.toggle', 'business', settled);
    } catch (_) {
      // An incomplete probe is independent of the original write and read-back.
    }
  }

  private publishRead(session: number, phase: 'loading' | 'failed' | 'succeeded', message?: string): void {
    if (!this.isCurrentSession(session)) return;
    this.latestProjection = { action: this.latestProjection.action, sourceId: this.latestProjection.sourceId,
      receipt: this.latestProjection.receipt, confirmedParts: this.latestProjection.confirmedParts,
      importIdentity: this.latestProjection.importIdentity,
      original: this.gateway.originalMutationSnapshot(),
      readFacts: projectOperationFacts({ phase,
      value: this.hasRead ? this.sources : undefined, canRetry: phase === 'failed',
      generation: ++sourceProjectionGeneration, message }) };
    try { this.emitProjection(this.latestProjection); } catch (_) {}
  }

  private publishReceipt(session: number, action: string, sourceId: string,
    confirmation: CommitConfirmationKind, readback: 'reading' | 'failed' | 'succeeded',
    refreshError?: string, confirmedParts?: number, importIdentity?: number): PersistedReceiptProjection<BookSource[]> {
    if (importIdentity === undefined && (action === 'import' || action === 'toggle')) this.pendingImportReadback = undefined;
    const original = this.gateway.originalMutationSnapshot();
    if (original?.blocked && importIdentity === undefined) confirmation = original.confirmation;
    const receipt = projectPersistedReceipt<BookSource[]>({ confirmation, readback, value: this.hasRead ? this.sources : undefined,
      refreshError, canRetry: confirmation !== 'undispatched' && readback !== 'reading' && (readback === 'failed' || confirmation === 'unknown'),
      generation: ++sourceProjectionGeneration });
    const previous = this.latestProjection;
    const retainedParts = previous.importIdentity === importIdentity ? previous.confirmedParts : undefined;
    this.latestProjection = { action, sourceId, receipt, readFacts: previous.readFacts,
      confirmedParts: confirmedParts ?? retainedParts, importIdentity, original };
    if (this.isCurrentSession(session)) {
      try { this.emitProjection(this.latestProjection); } catch (_) {}
    }
    if (this.isCurrentSession(session) && this.latestProjection.receipt === receipt) {
      this.publishStatus(readback === 'reading' ? 'loading' : readback === 'failed' || confirmation !== 'confirmed' ? 'warning' : 'idle',
        readback === 'succeeded' && confirmation === 'confirmed' ? '' :
          receipt.receipt.message + (refreshError === undefined ? '' : `：${refreshError}`));
    }
    return receipt;
  }

  private sourceCheckSignature(source: BookSource): string {
    return JSON.stringify([source.sourceId, source.sourceVersion ?? null, source.name, source.baseUrl,
      source.enabled, source.enabledExplore, source.category, source.loginUrl ?? null,
      source.group ?? null]);
  }

  private captureSourceCheck(id: string, active?: () => boolean): SourceCheckCapture | undefined {
    const source = this.sources.find((candidate: BookSource): boolean => candidate.sourceId === id);
    if (!this.isCurrentSession(this.session) || source === undefined) return undefined;
    const previous = this.checkingSourceIds.get(id);
    if (previous !== undefined && this.isCurrentSourceCheck(previous)) return undefined;
    const capture: SourceCheckCapture = { sourceId: id, sourceVersion: source.sourceVersion,
      signature: this.sourceCheckSignature(source), session: this.session, active };
    this.checkingSourceIds.set(id, capture);
    return capture;
  }

  private isCurrentSourceCheck(capture: SourceCheckCapture): boolean {
    const source = this.sources.find((candidate: BookSource): boolean => candidate.sourceId === capture.sourceId);
    return this.isCurrentSession(capture.session) && this.checkingSourceIds.get(capture.sourceId) === capture &&
      capture.active?.() !== false && source !== undefined && this.sourceCheckSignature(source) === capture.signature;
  }

  private async validateSourceCheck(capture: SourceCheckCapture,
    expected?: SourceDefinitionSnapshot): Promise<SourceDefinitionSnapshot | undefined> {
    if (!this.isCurrentSourceCheck(capture)) return undefined;
    const definition = await this.gateway.readSourceDefinition(capture.sourceId,
      (): boolean => this.isCurrentSourceCheck(capture));
    if (!this.isCurrentSourceCheck(capture)) return undefined;
    const baseline = expected ?? capture.definition;
    if (definition !== undefined &&
      (capture.sourceVersion === undefined || definition.sourceVersion === capture.sourceVersion) &&
      (baseline === undefined || definition.identity === baseline.identity)) {
      capture.definition = definition;
      return definition;
    }
    // Re-read authoritative row metadata only for a changed/deleted definition.
    // A stale diagnostic must not stamp the replacement with its old outcome.
    const rows = await this.gateway.loadSources(capture.sourceId, false,
      (): boolean => this.isCurrentSourceCheck(capture));
    if (!this.isCurrentSourceCheck(capture)) return undefined;
    const replacement = rows.find((source: BookSource): boolean => source.sourceId === capture.sourceId);
    const current: BookSource[] = [];
    for (const source of this.sources) {
      if (source.sourceId !== capture.sourceId) current.push(source);
      else if (replacement !== undefined) current.push(replacement);
    }
    this.checkResults.delete(capture.sourceId);
    this.checkingSourceIds.delete(capture.sourceId);
    this.presentSources(current);
    return undefined;
  }

  private async publishSourceCheckFailure(capture: SourceCheckCapture,
    state: 'unchecked' | 'failed', message: string): Promise<void> {
    if (!this.isCurrentSourceCheck(capture)) return;
    try {
      if (await this.validateSourceCheck(capture) !== undefined && this.isCurrentSourceCheck(capture))
        this.setCheckProjection(capture.sourceId, state, [], message);
    } catch (_) {
      // Without a current definition read, neither success nor failure belongs
      // to a verified rule version. Retire the busy projection as unverified.
      if (this.isCurrentSourceCheck(capture)) this.setCheckProjection(capture.sourceId, 'unchecked', [], message);
    }
  }

  private async applySourceCheck(capture: SourceCheckCapture): Promise<void> {
    const definition = await this.validateSourceCheck(capture);
    if (definition === undefined) return;
    const outcome = await this.gateway.checkSource(
      capture.sourceId,
      (): boolean => this.isCurrentSourceCheck(capture),
    );
    if (await this.validateSourceCheck(capture, definition) === undefined) return;
    this.applySourceCheckOutcome(outcome, capture);
    hilog.info(DOMAIN, 'Reader',
      'Source check completed: sourceId=%{private}s available=%{private}s levels=%{private}s durationMs=%{public}d reason=%{private}s',
      capture.sourceId, outcome.available, outcome.levelsPassed.join(','), outcome.durationMs,
      outcome.failureReason ?? '');
  }

  private applySourceCheckOutcome(outcome: SourceCheckOutcome, capture: SourceCheckCapture,
    checkedAtMs: number = Date.now(), completedLogin: boolean = false): boolean {
    if (!this.isCurrentSourceCheck(capture) || outcome.sourceId !== capture.sourceId) return false;
    if (outcome.report?.ruleDigest !== undefined && capture.definition?.sourceVersion !== undefined &&
      outcome.report.ruleDigest !== capture.definition.sourceVersion) {
      this.setCheckProjection(capture.sourceId, 'unchecked', [], '检测结果与当前书源版本不一致');
      return false;
    }
    const entry: SourceCheckHistoryEntry | undefined = outcome.report === undefined ? undefined :
      { checkedAtMs, stale: false, report: outcome.report };
    this.importedReports.delete(capture.sourceId);
    this.deniedLoginReports.delete(capture.sourceId);
    const source = this.sources.find((candidate: BookSource): boolean => candidate.sourceId === capture.sourceId);
    if (source?.enabled === true && (source.loginUrl?.trim().length ?? 0) > 0) {
      if (sourceV9AuthenticationDenied(outcome)) {
        this.verifiedLoginSources.delete(capture.sourceId);
        if (entry !== undefined) this.deniedLoginReports.set(capture.sourceId, entry.report.traceId);
      } else if (completedLogin && outcome.available && outcome.levelsPassed.includes('L1') && outcome.levelsPassed.includes('L2')) {
        this.verifiedLoginSources.set(capture.sourceId, capture.signature);
      }
    }
    this.setCheckProjection(outcome.sourceId, outcome.available ? 'passed' : 'failed', outcome.levelsPassed,
      outcome.available ? `${outcome.mode === 'explore' ? '发现' : '搜索'}检测通过 · ${outcome.durationMs}ms` :
        outcome.failureReason ?? '检测失败', entry);
    this.observeOfflineDetectResult(capture, outcome);
    return true;
  }

  private setCheckProjection(
    id: string,
    state: 'unchecked' | 'checking' | 'passed' | 'failed',
    levels: string[],
    message: string,
    entry?: SourceCheckHistoryEntry,
  ): void {
    const source = this.sources.find((candidate: BookSource): boolean => candidate.sourceId === id);
    if (source === undefined) return;
    const history = entry === undefined ? source.checkReports :
      [entry].concat((source.checkReports ?? []).filter((existing: SourceCheckHistoryEntry): boolean =>
        existing.report.traceId !== entry.report.traceId));
    this.checkResults.set(id, retainSourceV9Check(source, state, levels, message, history));
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
      return await this.gateway.loadSources(undefined, true, (): boolean => this.isCurrentSession(session));
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
      return await this.gateway.loadSources(undefined, true, (): boolean => this.isCurrentSession(session));
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
    this.verifiedLoginSources.forEach((signature: string, id: string): void => {
      if (!sources.some((source: BookSource): boolean => source.sourceId === id &&
        this.sourceCheckSignature(source) === signature)) this.verifiedLoginSources.delete(id);
    });
    this.checkingSourceIds.forEach((capture: SourceCheckCapture, id: string): void => {
      if (capture.session !== this.session || !sources.some((source: BookSource): boolean =>
        source.sourceId === id && this.sourceCheckSignature(source) === capture.signature)) this.checkingSourceIds.delete(id);
    });
    this.checkResults.forEach((checked: BookSource, id: string): void => {
      if (!sources.some((source: BookSource): boolean => source.sourceId === id &&
        this.sourceCheckSignature(source) === this.sourceCheckSignature(checked))) this.checkResults.delete(id);
    });
    this.sources = sources.map((source: BookSource): BookSource => {
      const previous = this.checkResults.get(source.sourceId);
      const clearedAt = this.reportClearTimes.get(source.sourceId) ?? 0;
      const history = (source.checkReports ?? []).filter((entry: SourceCheckHistoryEntry): boolean =>
        entry.checkedAtMs > clearedAt);
      const local = previous?.checkReports?.[0];
      if (local !== undefined && local.checkedAtMs > clearedAt && local.checkedAtMs > (history[0]?.checkedAtMs ?? 0) &&
        local.report.traceId !== history[0]?.report.traceId) history.unshift(local);
      const imported = this.importedReports.get(source.sourceId);
      if (imported !== undefined) {
        const observed = imported.observedAtMs ?? 0;
        const report = imported.report.report;
        if (source.sourceVersion !== imported.sourceVersion || observed <= clearedAt ||
          observed <= (history[0]?.checkedAtMs ?? 0)) this.importedReports.delete(source.sourceId);
        else if (report !== undefined) history.unshift({ report, stale: false, checkedAtMs: observed });
      }
      const deniedTrace = this.deniedLoginReports.get(source.sourceId);
      const deniedCurrent = deniedTrace !== undefined && deniedTrace === history[0]?.report.traceId;
      if (deniedTrace !== undefined && !deniedCurrent) this.deniedLoginReports.delete(source.sourceId);
      const projected = projectSourceV9Check(source, history, previous, clearedAt, deniedCurrent,
        this.verifiedLoginSources.has(source.sourceId));
      if (projected.loginState === 'expired') this.verifiedLoginSources.delete(source.sourceId);
      return projected;
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
