import { SyncGateway, DEFAULT_SYNC_SNAPSHOT, type SyncSnapshot, type SyncRestoreResult, type SyncHistoryEntry, type SyncBackupReceipt, type SyncRestoreConflict } from './SyncGateway';
import { SyncWriteObservation, type SyncOperationAction, type SyncOperationProjection, type SyncPresentationFacts } from './SyncOperationProjection';
import { ReaderRuntimeOwner } from '../../app/ReaderRuntimeOwner';
import { projectOperationFacts, projectCommitReadback, type OperationFacts, type CommitConfirmationKind, type CommitReadbackPhase } from '../../app/ReaderOperationFacts';
import { projectPersistedReceipt } from '../../app/ReaderPersistedReceiptProjection';

interface SyncSnapshotPatch {
  history?: SyncHistoryEntry[]; statusMessage?: string;
  restoreConflict?: SyncRestoreConflict; clearRestoreConflict?: boolean;
  facts?: SyncPresentationFacts; redactSecrets?: boolean;
}

let syncProjectionGeneration: number = 0;
/** Foreground owner. One chain retains accepted write receipts across route
 * remounts; old routes/RuntimeOwners cannot publish or dispatch new intent. */
export class SyncOrchestrator {
  private static readonly retained: WeakMap<ReaderRuntimeOwner, SyncOrchestrator> = new WeakMap();
  private presentationIdentity: string = 'legacy';

  /** Only the current Runtime is cached. Retired owners keep their accepted
   * tail, but cannot dispatch through a replacement Runtime. */
  static forRuntime(owner: ReaderRuntimeOwner): SyncOrchestrator | undefined {
    if (!ReaderRuntimeOwner.isCurrent(owner)) return undefined;
    let retained = SyncOrchestrator.retained.get(owner);
    if (retained === undefined) {
      retained = new SyncOrchestrator((): void => {},
        (): SyncSnapshot => DEFAULT_SYNC_SNAPSHOT, owner, (): boolean => false);
      retained.presentationIdentity = '';
      SyncOrchestrator.retained.set(owner, retained);
    }
    return retained;
  }

  attachPresentation(identity: string, emit: (snapshot: SyncSnapshot) => void,
    read: () => SyncSnapshot, current: () => boolean): boolean {
    if (identity.length === 0 || !this.currentOwner() || !current()) return false;
    if (identity !== this.presentationIdentity) this.session += 1;
    this.presentationIdentity = identity;
    this.emit = emit; this.read = read; this.isCurrent = current;
    this.deliver(this.session);
    return true;
  }

  /** Presentation retirement never clears accepted work or its exact receipt. */
  detachPresentation(identity: string): void {
    if (identity !== this.presentationIdentity) return;
    this.session += 1; this.presentationIdentity = '';
    this.emit = (): void => {}; this.read = (): SyncSnapshot => DEFAULT_SYNC_SNAPSHOT;
    this.isCurrent = (): boolean => false;
  }

  private readonly gateway: SyncGateway;
  private readonly owner: ReaderRuntimeOwner;
  private emit: (snapshot: SyncSnapshot) => void;
  private read: () => SyncSnapshot;
  private isCurrent: () => boolean;
  private session: number = 0;
  private operationInFlight: boolean = false;
  private operationChain: Promise<void> = Promise.resolve();
  private lastSnapshot: SyncSnapshot | undefined;
  private readFacts: OperationFacts<boolean> = projectOperationFacts<boolean>({ phase: 'idle' });
  private requestFacts: OperationFacts<boolean> | undefined;
  private latestOperation: SyncOperationProjection | undefined;

  constructor(emit: (snapshot: SyncSnapshot) => void, read: () => SyncSnapshot,
    owner: ReaderRuntimeOwner = ReaderRuntimeOwner.current(), isCurrent: () => boolean = (): boolean => true) {
    this.gateway = new SyncGateway(owner);
    this.owner = owner;
    this.emit = emit;
    this.read = read;
    this.isCurrent = isCurrent;
  }

  ownedBy(owner: ReaderRuntimeOwner): boolean { return this.owner === owner; }

  /** Index physical callbacks must carry their original attachment identity. */
  isPresentationCurrent(identity: string): boolean {
    return identity.length > 0 && identity === this.presentationIdentity && this.currentSession(this.session);
  }

  open(): void {
    if (!this.currentOwner() || !this.isCurrent()) return;
    // A replacement page observes the same accepted chain. It cannot reset
    // the mutex, start a second write, or clear an unresolved receipt.
    if (this.operationInFlight) { this.deliver(this.session); return; }
    const session = ++this.session;
    this.publishRead(session, 'loading', '正在读取安全配置…');
    this.operationChain = this.operationChain.then((): Promise<void> => this.load(session));
  }

  /** Generation-scoped recovery reads config only, or continues the already
   * journaled restore through Core's durable receipt. It never replays save,
   * backup, latest selection, or an overwrite consent. */
  reconcile(generation: number): void {
    if (!this.currentSession(this.session) || this.operationInFlight || generation !== this.generation()) return;
    const session = this.session;
    this.operationInFlight = true;
    this.operationChain = this.operationChain.then(async (): Promise<void> => {
      if (!this.currentSession(session)) return;
      const operation = this.latestOperation;
      if (operation !== undefined && (operation.action === 'restore' || operation.action === 'resolveRestore') && !operation.completed) {
        const observation = new SyncWriteObservation();
        observation.writeGeneration = operation.writeGeneration;
        observation.coreApplied = operation.coreApplied;
        observation.hostApplied = operation.hostApplied;
        try {
          const recovered = await this.gateway.recoverInterruptedRestore(observation);
          if (recovered) {
            this.lastSnapshot = this.patchedSnapshot(this.source(), { clearRestoreConflict: true });
            this.publishReceipt(session, operation.action, observation, 'reading', '已有恢复已完成，正在读取安全配置');
          }
          else if (operation.projection.receipt.confirmation === 'unknown') {
            // Missing atomic Core receipt proves no configuration apply. This
            // is stronger evidence than a matching later configuration read.
            this.lastSnapshot = this.patchedSnapshot(this.source(), { clearRestoreConflict: true });
            this.publishReceipt(session, operation.action, observation, 'succeeded', '已核对 Core 恢复记录：没有应用本机配置');
          }
        } catch (error) {
          if (observation.write.dispatchedCount > 0) this.publishReceipt(session, operation.action, observation, 'failed', this.safeError(error as Error));
          else this.publishReceiptWithConfirmation(session, operation, 'failed', this.safeError(error as Error));
          return;
        }
      }
      if (operation?.action === 'saveConfig' && !operation.completed && operation.operationId !== undefined) {
        try {
          if (await this.gateway.reconcileSavedConfig(operation.operationId)) {
            const observation = new SyncWriteObservation();
            observation.writeGeneration = operation.writeGeneration;
            observation.operationId = operation.operationId;
            observation.configReceiptQualified = true; observation.completed = true;
            this.publishReceipt(session, 'saveConfig', observation, 'reading', '已核对安全存储中的本次保存回执');
          }
        } catch (error) {
          this.publishReceiptWithConfirmation(session, operation, 'failed', this.safeError(error as Error));
          return;
        }
      }
      if (operation?.action === 'backup') {
        try {
          const receipt = await this.gateway.reconcileBackupReceipt(true);
          if (receipt !== undefined) this.publishBackupReceipt(session, receipt, operation.writeGeneration);
        } catch (error) {
          this.publishReceiptWithConfirmation(session, operation, 'failed', this.safeError(error as Error)); return;
        }
      }
      await this.load(session);
    }).catch((error: Error): void => this.publishRead(session, 'failed', this.safeError(error as Error)))
      .finally((): void => { this.operationInFlight = false; this.deliver(this.session); });
    this.deliver(session);
  }

  /** This distinct user action never treats a GET as consent to settle. */
  skipBackupRetention(generation: number): void {
    if (!this.currentSession(this.session) || this.operationInFlight || generation !== this.generation()) return;
    const operation = this.latestOperation;
    if (operation?.action !== 'backup' || !operation.uploadQualified || operation.completed ||
      operation.retentionSkipped === true || operation.operationId === undefined) return;
    const session = this.session, operationId = operation.operationId;
    this.operationInFlight = true;
    this.operationChain = this.operationChain.then(async (): Promise<void> => {
      if (!this.currentSession(session)) return;
      try {
        const receipt = await this.gateway.skipBackupRetention(operationId, (): boolean =>
          this.currentSession(session) && this.latestOperation?.operationId === operationId &&
          generation === this.generation());
        if (!this.currentSession(session)) return;
        this.publishBackupReceipt(session, receipt, operation.writeGeneration);
        await this.load(session);
      } catch (error) {
        if (this.currentSession(session)) this.publishReceiptWithConfirmation(session, operation, 'failed', this.safeError(error as Error));
      }
    }).finally((): void => { this.operationInFlight = false; this.deliver(this.session); });
    this.deliver(session);
  }

  continueConfigSave(generation: number, url?: string, user?: string, pass?: string, backupPass?: string, directory?: string): void {
    const operation = this.latestOperation;
    if (!this.currentSession(this.session) || this.operationInFlight || generation !== this.generation() ||
      operation?.action !== 'saveConfig' || !operation.canContinueOriginal || operation.operationId === undefined) return;
    const session = this.session, operationId = operation.operationId;
    this.operationInFlight = true;
    this.operationChain = this.operationChain.then(async (): Promise<void> => {
      if (!this.currentSession(session) || generation !== this.generation() || this.latestOperation?.operationId !== operationId) return;
      const observation = new SyncWriteObservation(); observation.writeGeneration = operation.writeGeneration; observation.operationId = operationId;
      try {
        await this.gateway.continueConfigSave(operationId, observation, (): boolean => this.currentSession(session) &&
          this.latestOperation?.operationId === operationId && generation === this.generation(), url, user, pass, backupPass, directory);
        this.publishReceipt(session, 'saveConfig', observation, 'reading', '原配置保存已核定');
        await this.load(session);
      } catch (error) {
        // A failure/no new dispatch cannot erase any previous unknown.
        this.publishReceiptWithConfirmation(session, operation, 'failed', this.safeError(error as Error));
        await this.load(session);
      }
    }).finally((): void => { this.operationInFlight = false; this.deliver(this.session); });
    this.deliver(session);
  }

  saveConfig(url: string, user: string, pass: string, backupPass: string, directory: string): void {
    this.enqueue('saveConfig', async (observation: SyncWriteObservation, admitted: () => boolean): Promise<string> => {
      const outcome = await this.gateway.saveConfig(url, user, pass, backupPass, directory, observation, admitted);
      if (!outcome.ok) throw new Error(outcome.error ?? '配置保存未完成');
      observation.completed = true;
      return '配置已写入系统安全存储';
    });
  }

  testConnection(url: string, user: string, pass: string, directory: string): void {
    if (!this.beginOperation()) return;
    const session = this.session;
    this.requestFacts = projectOperationFacts<boolean>({ phase: 'loading', generation: ++syncProjectionGeneration, message: '正在测试 WebDAV 连接…' });
    this.status(session, '正在测试 WebDAV 连接…');
    this.operationChain = this.operationChain.then(async (): Promise<void> => {
      if (!this.currentSession(session)) return;
      const outcome = await this.gateway.testConnection(url, user, pass, directory, (): boolean => this.currentSession(session));
      if (!this.currentSession(session)) return;
      this.requestFacts = projectOperationFacts<boolean>({ phase: outcome.ok ? 'succeeded' : 'failed', value: outcome.ok ? true : undefined, generation: ++syncProjectionGeneration, message: outcome.ok ? undefined : 'WebDAV 连接测试未完成' });
      this.status(session, outcome.ok ? outcome.note ?? 'WebDAV 连接成功' : outcome.error ?? 'WebDAV 连接失败');
    }).catch((error: Error): void => { this.requestFacts = projectOperationFacts<boolean>({ phase: 'failed', generation: ++syncProjectionGeneration, message: 'WebDAV 连接测试未完成' }); this.status(session, this.safeError(error as Error)); })
      .finally((): void => { this.operationInFlight = false; this.deliver(this.session); });
  }

  triggerBackup(): void {
    this.enqueue('backup', async (observation: SyncWriteObservation, admitted: () => boolean): Promise<string> => {
      const outcome = await this.gateway.triggerBackup(observation, admitted);
      if (!outcome.ok) throw new Error(outcome.error ?? '备份事务未确认完成');
      const current = this.source();
      const entry: SyncHistoryEntry = { timestamp: this.formatNow(), destination: 'WebDAV', size: outcome.size ?? 0, ok: true };
      this.lastSnapshot = this.patchedSnapshot(current, { history: [entry].concat(current.history) });
      return '备份已上传';
    });
  }

  restoreLatest(): void {
    this.enqueue('restore', async (observation: SyncWriteObservation, admitted: () => boolean): Promise<string> => {
      const outcome = await this.gateway.restoreLatest(observation, admitted);
      return this.restoreResult(outcome, observation);
    });
  }

  resolveRestore(overwriteLocal: boolean): void {
    this.enqueue('resolveRestore', async (observation: SyncWriteObservation, admitted: () => boolean): Promise<string> => {
      const outcome = await this.gateway.resolveRestore(overwriteLocal, observation, admitted);
      return this.restoreResult(outcome, observation);
    });
  }

  private restoreResult(outcome: SyncRestoreResult, observation: SyncWriteObservation): string {
    const current = this.source();
    if (outcome.conflict !== undefined) {
      this.lastSnapshot = this.patchedSnapshot(current, { restoreConflict: outcome.conflict });
      return '检测到本机与远端备份冲突，请确认';
    }
    if (!outcome.ok) throw new Error(outcome.error ?? '恢复尚未完成');
    this.lastSnapshot = this.patchedSnapshot(current, { clearRestoreConflict: true });
    observation.completed = true;
    if (outcome.cancelled) return '已取消恢复';
    return outcome.applied ? '恢复已完成；重新进入页面后读取新状态' : '本机数据与最新备份一致，无需重复写入';
  }

  private enqueue(action: SyncOperationAction, run: (observation: SyncWriteObservation, admitted: () => boolean) => Promise<string>): void {
    if (!this.beginOperation()) return;
    const session = this.session;
    const observation = new SyncWriteObservation();
    this.requestFacts = undefined;
    this.status(session, action === 'saveConfig' ? '正在保存安全配置…' : action === 'backup' ? '正在创建配置备份…' : '正在检查恢复事务…');
    this.operationChain = this.operationChain.then(async (): Promise<void> => {
      if (!this.currentSession(session)) return;
      // A remount cannot lend its lease to an old config head write. Once a
      // backup/restore dispatched, its accepted exact transaction can settle;
      // an interrupted config preparation retains unknown for explicit recovery.
      const admitted = (): boolean => this.currentOwner() && (this.currentSession(session) ||
        (action !== 'saveConfig' && observation.write.dispatchedCount > 0));
      let message: string;
      try { message = await run(observation, admitted); }
      catch (error) {
        this.publishReceipt(session, action, observation, 'failed', this.safeError(error as Error));
        if (action === 'saveConfig') await this.load(session);
        return;
      }
      if (observation.write.dispatchedCount === 0) {
        this.status(session, message);
        return;
      }
      this.publishReceipt(session, action, observation, 'reading', message);
      await this.load(session);
    }).catch((error: Error): void => this.publishReceipt(session, action, observation, 'failed', this.safeError(error as Error)))
      .finally((): void => { this.operationInFlight = false; this.deliver(this.session); });
  }

  private async load(session: number): Promise<void> {
    if (!this.currentOwner()) return;
    try {
      // Startup owns automatic journal recovery. A page read is read-only.
      const snapshot = await this.gateway.loadSnapshot(false);
      let current = this.source();
      // A new owner/process may see an atomic committed save even if its ACK
      // was lost. Publish only the ID actually read, never an old/matching intent.
      if (snapshot.configSaveIntent !== undefined) {
        const original = snapshot.configSaveIntent;
        const old = this.latestOperation?.action === 'saveConfig' && this.latestOperation.operationId === original.operationId ? this.latestOperation : undefined;
        this.latestOperation = { action: 'saveConfig', writeGeneration: old?.writeGeneration ?? new SyncWriteObservation().writeGeneration,
          operationId: original.operationId, coreApplied: false, hostApplied: false, completed: false, remoteConfirmedCount: 0, uploadQualified: false,
          canContinueOriginal: snapshot.canContinueConfigSave === true,
          projection: projectPersistedReceipt<boolean>({ confirmation: 'unknown', readback: 'succeeded',
            canRetry: true, generation: ++syncProjectionGeneration,
            message: snapshot.configSaveHeadMatchesOriginal ? '原配置已读到，保存或清理回执尚待核对' : snapshot.configSavePayloadAvailable ? '原配置保存尚未确认；请先核对原操作' : '原配置准备未完成；请重新填写本次配置后继续原操作' }) };
      }
      if (this.latestOperation === undefined && snapshot.backupReceipt !== undefined) {
        this.publishBackupReceipt(session, snapshot.backupReceipt);
      }
      if (snapshot.configSaveIntent === undefined && this.latestOperation === undefined && snapshot.configSaveOperationId !== undefined) {
        const observation = new SyncWriteObservation(); observation.operationId = snapshot.configSaveOperationId;
        observation.configReceiptQualified = true; observation.completed = true;
        this.publishReceipt(session, 'saveConfig', observation, 'reading');
      }
      current = this.source();
      const operation = this.latestOperation;
      const successMessage = operation?.completed === true && operation.projection.receipt.confirmation === 'confirmed' ?
        operation.action === 'saveConfig' ? '配置已写入系统安全存储' : operation.action === 'backup' ? '备份已上传' : '恢复已完成；重新进入页面后读取新状态' :
        current.statusMessage.length > 0 ? current.statusMessage : snapshot.statusMessage;
      this.lastSnapshot = this.patchedSnapshot(snapshot, { history: current.history, statusMessage: successMessage, restoreConflict: current.restoreConflict, clearRestoreConflict: current.restoreConflict === undefined });
      this.publishRead(session, 'succeeded');
      if (this.latestOperation !== undefined) this.publishReceiptWithConfirmation(session, this.latestOperation, 'succeeded');
    } catch (error) {
      this.publishRead(session, 'failed', '安全配置读取失败，保留上次已读取内容');
      if (this.latestOperation !== undefined) this.publishReceiptWithConfirmation(session, this.latestOperation, 'failed', this.safeError(error as Error));
    }
  }

  private publishRead(session: number, phase: 'loading' | 'succeeded' | 'failed', message?: string): void {
    this.readFacts = projectOperationFacts<boolean>({ phase, value: this.lastSnapshot === undefined ? undefined : true,
      canRetry: phase === 'failed', generation: ++syncProjectionGeneration, message });
    this.deliver(session);
  }

  private publishBackupReceipt(session: number, receipt: SyncBackupReceipt, writeGeneration?: number): void {
    const observation = new SyncWriteObservation();
    const previouslyQualified = this.latestOperation?.action === 'backup' && this.latestOperation.operationId === receipt.operationId && this.latestOperation.uploadQualified;
    const uploadQualified = receipt.uploadQualified || previouslyQualified;
    if (writeGeneration !== undefined) observation.writeGeneration = writeGeneration;
    observation.operationId = receipt.operationId;
    // Rehydrate a durable mayDispatch fact conservatively; this observation
    // is UI qualification only and is never reused as an HTTP IO counter.
    if (!receipt.undispatched) observation.write.dispatched();
    if (uploadQualified) observation.write.confirmed();
    observation.uploadQualified = uploadQualified;
    observation.completed = receipt.retentionCompleted;
    observation.retentionSkipped = receipt.retentionSkipped;
    this.publishReceipt(session, 'backup', observation, receipt.retentionSkipped ? 'succeeded' : receipt.retentionCompleted ? 'reading' : 'failed',
      receipt.retentionSkipped ? '备份已保留，清理已由你结束；已发出的远端请求不会撤回' : receipt.retentionCompleted ? '已核对本次备份及保留清理完成回执' : receipt.undispatched ? '本次备份尚未发出，可重新提交' :
        uploadQualified ? '本次备份上传已核实，保留清理尚未完成；不会自动重传或删除' : '本次备份远端结果待核对，不重复上传');
  }

  private publishReceipt(session: number, action: SyncOperationAction, observation: SyncWriteObservation,
    readback: CommitReadbackPhase, errorOrStatus?: string): void {
    const confirmation = action === 'saveConfig' ? observation.configReceiptQualified ? 'confirmed' :
      observation.write.dispatchedCount > 0 ? 'unknown' : 'undispatched' : observation.write.confirmation();
    const partial = observation.coreApplied && !observation.completed
      ? 'Core 配置已应用，Host 恢复尚未完成；核对已有恢复，不重复覆盖' : undefined;
    const remotePartial = observation.retentionSkipped ? '备份已保留，保留清理已由你结束；已发出的远端请求不会撤回' : !observation.completed && observation.uploadQualified ? '本次备份上传已核实，保留清理尚无完成回执；不自动重传或删除' :
      !observation.completed && observation.remoteConfirmedCount > 0 ? `已有 ${observation.remoteConfirmedCount} 个远端写入响应，备份完成回执待核对；不自动重传` : undefined;
    this.latestOperation = { action, writeGeneration: observation.writeGeneration, operationId: observation.operationId, coreApplied: observation.coreApplied, hostApplied: observation.hostApplied,
      completed: observation.completed, retentionSkipped: observation.retentionSkipped, remoteConfirmedCount: observation.remoteConfirmedCount, uploadQualified: observation.uploadQualified,
      projection: projectPersistedReceipt<boolean>({ confirmation, readback, value: this.lastSnapshot === undefined ? undefined : true,
        refreshError: readback === 'failed' ? errorOrStatus : undefined,
        message: partial !== undefined || remotePartial !== undefined ? projectCommitReadback(confirmation, readback).message + '：' + (partial ?? remotePartial) : undefined, canRetry: (readback === 'failed' || !observation.retentionSkipped) && readback !== 'reading' && (confirmation !== 'undispatched'),
        generation: ++syncProjectionGeneration }) };
    if (errorOrStatus !== undefined) this.lastSnapshot = this.patchedSnapshot(this.source(), { statusMessage: errorOrStatus });
    this.deliver(session);
  }

  private publishReceiptWithConfirmation(session: number, operation: SyncOperationProjection, readback: CommitReadbackPhase, error?: string): void {
    const confirmation: CommitConfirmationKind = operation.projection.receipt.confirmation;
    const effectiveReadback = readback === 'succeeded' && confirmation === 'confirmed' && !operation.completed && !operation.retentionSkipped ? 'failed' : readback;
    this.latestOperation = { action: operation.action, writeGeneration: operation.writeGeneration, operationId: operation.operationId,
      coreApplied: operation.coreApplied, hostApplied: operation.hostApplied, completed: operation.completed,
      remoteConfirmedCount: operation.remoteConfirmedCount, uploadQualified: operation.uploadQualified,
      retentionSkipped: operation.retentionSkipped, canContinueOriginal: operation.canContinueOriginal,
      projection: projectPersistedReceipt<boolean>({ confirmation, readback: effectiveReadback,
      value: this.lastSnapshot === undefined ? undefined : true, refreshError: error,
      message: !operation.completed ? operation.projection.facts.message : undefined,
      canRetry: (readback === 'failed' || !operation.retentionSkipped) && readback !== 'reading' && (readback === 'failed' || confirmation === 'unknown' || !operation.completed) && confirmation !== 'undispatched',
      generation: ++syncProjectionGeneration }) };
    this.deliver(session);
  }

  private beginOperation(): boolean {
    if (!this.currentSession(this.session) || this.operationInFlight || this.lastSnapshot === undefined) return false;
    const operation = this.latestOperation;
    if (operation !== undefined && ((!operation.completed && operation.action === 'saveConfig') || operation.projection.receipt.confirmation === 'unknown' ||
      (operation.coreApplied && !operation.completed) || (operation.action === 'backup' && !operation.completed && !operation.retentionSkipped && operation.projection.receipt.confirmation === 'confirmed'))) return false;
    this.operationInFlight = true;
    return true;
  }

  private generation(): number { return this.latestOperation?.projection.facts.generation ?? this.readFacts.generation; }
  private source(): SyncSnapshot { return this.lastSnapshot ?? this.read(); }
  private currentOwner(): boolean { return ReaderRuntimeOwner.isCurrent(this.owner); }
  private currentSession(session: number): boolean { return this.currentOwner() && this.isCurrent() && session === this.session; }
  private status(session: number, message: string): void { this.lastSnapshot = this.patchedSnapshot(this.source(), { statusMessage: message }); this.deliver(session); }
  private deliver(session: number): void {
    if (!this.currentSession(session)) return;
    const source = this.source();
    const operation = this.latestOperation;
    const facts: SyncPresentationFacts = { read: this.readFacts, operation, request: this.requestFacts, busy: this.operationInFlight,
      canMutate: !this.operationInFlight && this.lastSnapshot !== undefined &&
        operation?.projection.receipt.confirmation !== 'unknown' && !(operation?.action === 'saveConfig' && !operation.completed) && !(operation?.coreApplied === true && !operation.completed) &&
        !(operation?.action === 'backup' && !operation.completed && !operation.retentionSkipped && operation.projection.receipt.confirmation === 'confirmed') };
    this.emit(this.patchedSnapshot(source, { redactSecrets: true, facts }));
  }
  private patchedSnapshot(source: SyncSnapshot, patch: SyncSnapshotPatch): SyncSnapshot {
    return {
      configSaveOperationId: source.configSaveOperationId, configSaveIntent: source.configSaveIntent,
      configSaveHeadMatchesOriginal: source.configSaveHeadMatchesOriginal, canContinueConfigSave: source.canContinueConfigSave,
      configSavePayloadAvailable: source.configSavePayloadAvailable, backupReceipt: source.backupReceipt,
      webdavUrl: source.webdavUrl, webdavUser: source.webdavUser,
      webdavPass: patch.redactSecrets ? '' : source.webdavPass, backupPass: patch.redactSecrets ? '' : source.backupPass,
      webdavPath: source.webdavPath, saveLocation: source.saveLocation,
      backupFrequency: source.backupFrequency, backupScope: source.backupScope,
      history: patch.history ?? source.history, statusMessage: patch.statusMessage ?? source.statusMessage,
      restoreConflict: patch.clearRestoreConflict ? undefined : patch.restoreConflict ?? source.restoreConflict,
      facts: patch.facts ?? source.facts,
    };
  }
  private safeError(_error: Error): string { return '操作未完成，请核对当前配置或已有恢复记录'; }
  private formatNow(): string {
    const d = new Date(); const pad = (n: number): string => n < 10 ? `0${n}` : `${n}`;
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
}
