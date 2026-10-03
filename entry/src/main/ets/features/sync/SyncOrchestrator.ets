import { SyncGateway, type SyncSnapshot, type SyncRestoreResult, type SyncHistoryEntry, type SyncBackupReceipt } from './SyncGateway';
import { SyncWriteObservation, type SyncOperationAction, type SyncOperationProjection, type SyncPresentationFacts } from './SyncOperationProjection';
import { ReaderRuntimeOwner } from '../../app/ReaderRuntimeOwner';
import { projectOperationFacts, projectCommitReadback, type OperationFacts, type CommitConfirmationKind, type CommitReadbackPhase } from '../../app/ReaderOperationFacts';
import { projectPersistedReceipt } from '../../app/ReaderPersistedReceiptProjection';

let syncProjectionGeneration: number = 0;
/** Foreground owner. One chain retains accepted write receipts across route
 * remounts; old routes/RuntimeOwners cannot publish or dispatch new intent. */
export class SyncOrchestrator {
  private readonly gateway: SyncGateway;
  private readonly owner: ReaderRuntimeOwner;
  private readonly emit: (snapshot: SyncSnapshot) => void;
  private readonly read: () => SyncSnapshot;
  private readonly isCurrent: () => boolean;
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

  open(): void {
    if (!this.currentOwner() || !this.isCurrent()) return;
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
            this.lastSnapshot = { ...this.source(), restoreConflict: undefined };
            this.publishReceipt(session, operation.action, observation, 'reading', '已有恢复已完成，正在读取安全配置');
          }
          else if (operation.projection.receipt.confirmation === 'unknown') {
            // Missing atomic Core receipt proves no configuration apply. This
            // is stronger evidence than a matching later configuration read.
            this.lastSnapshot = { ...this.source(), restoreConflict: undefined };
            this.publishReceipt(session, operation.action, observation, 'succeeded', '已核对 Core 恢复记录：没有应用本机配置');
          }
        } catch (error) {
          if (observation.write.dispatchedCount > 0) this.publishReceipt(session, operation.action, observation, 'failed', this.safeError(error));
          else this.publishReceiptWithConfirmation(session, operation, 'failed', this.safeError(error));
          return;
        }
      }
      if (operation?.action === 'saveConfig' && operation.projection.receipt.confirmation === 'unknown' && operation.operationId !== undefined) {
        try {
          if (await this.gateway.reconcileSavedConfig(operation.operationId)) {
            const observation = new SyncWriteObservation();
            observation.writeGeneration = operation.writeGeneration;
            observation.operationId = operation.operationId;
            observation.write.dispatched(); observation.write.confirmed(); observation.completed = true;
            this.publishReceipt(session, 'saveConfig', observation, 'reading', '已核对安全存储中的本次保存回执');
          }
        } catch (error) {
          this.publishReceiptWithConfirmation(session, operation, 'failed', this.safeError(error));
          return;
        }
      }
      if (operation?.action === 'backup') {
        try {
          const receipt = await this.gateway.reconcileBackupReceipt(true);
          if (receipt !== undefined) this.publishBackupReceipt(session, receipt, operation.writeGeneration);
        } catch (error) {
          this.publishReceiptWithConfirmation(session, operation, 'failed', this.safeError(error)); return;
        }
      }
      await this.load(session);
    }).catch((error: Error): void => this.publishRead(session, 'failed', this.safeError(error)))
      .finally((): void => { this.operationInFlight = false; this.deliver(this.session); });
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
    }).catch((error: Error): void => { this.requestFacts = projectOperationFacts<boolean>({ phase: 'failed', generation: ++syncProjectionGeneration, message: 'WebDAV 连接测试未完成' }); this.status(session, this.safeError(error)); })
      .finally((): void => { this.operationInFlight = false; this.deliver(this.session); });
  }

  triggerBackup(): void {
    this.enqueue('backup', async (observation: SyncWriteObservation, admitted: () => boolean): Promise<string> => {
      const outcome = await this.gateway.triggerBackup(observation, admitted);
      if (!outcome.ok) throw new Error(outcome.error ?? '备份事务未确认完成');
      const current = this.source();
      const entry: SyncHistoryEntry = { timestamp: this.formatNow(), destination: 'WebDAV', size: outcome.size ?? 0, ok: true };
      this.lastSnapshot = { ...current, history: [entry].concat(current.history) };
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
      this.lastSnapshot = { ...current, restoreConflict: outcome.conflict };
      return '检测到本机与远端备份冲突，请确认';
    }
    if (!outcome.ok) throw new Error(outcome.error ?? '恢复尚未完成');
    this.lastSnapshot = { ...current, restoreConflict: undefined };
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
      const admitted = (): boolean => this.currentOwner() && (this.currentSession(session) || observation.write.dispatchedCount > 0);
      let message: string;
      try { message = await run(observation, admitted); }
      catch (error) {
        this.publishReceipt(session, action, observation, 'failed', this.safeError(error));
        return;
      }
      if (observation.write.dispatchedCount === 0) {
        this.status(session, message);
        return;
      }
      this.publishReceipt(session, action, observation, 'reading', message);
      await this.load(session);
    }).catch((error: Error): void => this.publishReceipt(session, action, observation, 'failed', this.safeError(error)))
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
      if (this.latestOperation === undefined && snapshot.backupReceipt !== undefined) {
        this.publishBackupReceipt(session, snapshot.backupReceipt);
      }
      if (this.latestOperation === undefined && snapshot.configSaveOperationId !== undefined) {
        const observation = new SyncWriteObservation(); observation.operationId = snapshot.configSaveOperationId;
        observation.write.dispatched(); observation.write.confirmed(); observation.completed = true;
        this.publishReceipt(session, 'saveConfig', observation, 'reading');
      }
      current = this.source();
      const operation = this.latestOperation;
      const successMessage = operation?.completed === true && operation.projection.receipt.confirmation === 'confirmed' ?
        operation.action === 'saveConfig' ? '配置已写入系统安全存储' : operation.action === 'backup' ? '备份已上传' : '恢复已完成；重新进入页面后读取新状态' :
        current.statusMessage.length > 0 ? current.statusMessage : snapshot.statusMessage;
      this.lastSnapshot = { ...snapshot, history: current.history, statusMessage: successMessage, restoreConflict: current.restoreConflict };
      this.publishRead(session, 'succeeded');
      if (this.latestOperation !== undefined) this.publishReceiptWithConfirmation(session, this.latestOperation, 'succeeded');
    } catch (error) {
      this.publishRead(session, 'failed', '安全配置读取失败，保留上次已读取内容');
      if (this.latestOperation !== undefined) this.publishReceiptWithConfirmation(session, this.latestOperation, 'failed', this.safeError(error));
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
    this.publishReceipt(session, 'backup', observation, receipt.retentionCompleted ? 'reading' : 'failed',
      receipt.retentionCompleted ? '已核对本次备份及保留清理完成回执' : receipt.undispatched ? '本次备份尚未发出，可重新提交' :
        uploadQualified ? '本次备份上传已核实，保留清理尚未完成；不会自动重传或删除' : '本次备份远端结果待核对，不重复上传');
  }

  private publishReceipt(session: number, action: SyncOperationAction, observation: SyncWriteObservation,
    readback: CommitReadbackPhase, errorOrStatus?: string): void {
    const confirmation = observation.write.confirmation();
    const partial = observation.coreApplied && !observation.completed
      ? 'Core 配置已应用，Host 恢复尚未完成；核对已有恢复，不重复覆盖' : undefined;
    const remotePartial = !observation.completed && observation.uploadQualified ? '本次备份上传已核实，保留清理尚无完成回执；不自动重传或删除' :
      !observation.completed && observation.remoteConfirmedCount > 0 ? `已有 ${observation.remoteConfirmedCount} 个远端写入响应，备份完成回执待核对；不自动重传` : undefined;
    this.latestOperation = { action, writeGeneration: observation.writeGeneration, operationId: observation.operationId, coreApplied: observation.coreApplied, hostApplied: observation.hostApplied,
      completed: observation.completed, remoteConfirmedCount: observation.remoteConfirmedCount, uploadQualified: observation.uploadQualified,
      projection: projectPersistedReceipt<boolean>({ confirmation, readback, value: this.lastSnapshot === undefined ? undefined : true,
        refreshError: readback === 'failed' ? errorOrStatus : undefined,
        message: partial !== undefined || remotePartial !== undefined ? projectCommitReadback(confirmation, readback).message + '：' + (partial ?? remotePartial) : undefined, canRetry: readback !== 'reading' && (confirmation !== 'undispatched'),
        generation: ++syncProjectionGeneration }) };
    if (errorOrStatus !== undefined) this.lastSnapshot = { ...this.source(), statusMessage: errorOrStatus };
    this.deliver(session);
  }

  private publishReceiptWithConfirmation(session: number, operation: SyncOperationProjection, readback: CommitReadbackPhase, error?: string): void {
    const confirmation: CommitConfirmationKind = operation.projection.receipt.confirmation;
    const effectiveReadback = readback === 'succeeded' && confirmation === 'confirmed' && !operation.completed ? 'failed' : readback;
    this.latestOperation = { ...operation, projection: projectPersistedReceipt<boolean>({ confirmation, readback: effectiveReadback,
      value: this.lastSnapshot === undefined ? undefined : true, refreshError: error,
      message: !operation.completed ? operation.projection.facts.message : undefined,
      canRetry: readback !== 'reading' && (readback === 'failed' || confirmation === 'unknown' || !operation.completed) && confirmation !== 'undispatched',
      generation: ++syncProjectionGeneration }) };
    this.deliver(session);
  }

  private beginOperation(): boolean {
    if (!this.currentSession(this.session) || this.operationInFlight || this.lastSnapshot === undefined) return false;
    const operation = this.latestOperation;
    if (operation !== undefined && (operation.projection.receipt.confirmation === 'unknown' ||
      (operation.coreApplied && !operation.completed) || (operation.action === 'backup' && !operation.completed && operation.projection.receipt.confirmation === 'confirmed'))) return false;
    this.operationInFlight = true;
    return true;
  }

  private generation(): number { return this.latestOperation?.projection.facts.generation ?? this.readFacts.generation; }
  private source(): SyncSnapshot { return this.lastSnapshot ?? this.read(); }
  private currentOwner(): boolean { return ReaderRuntimeOwner.isCurrent(this.owner); }
  private currentSession(session: number): boolean { return this.currentOwner() && this.isCurrent() && session === this.session; }
  private status(session: number, message: string): void { this.lastSnapshot = { ...this.source(), statusMessage: message }; this.deliver(session); }
  private deliver(session: number): void {
    if (!this.currentSession(session)) return;
    const source = this.source();
    const operation = this.latestOperation;
    const facts: SyncPresentationFacts = { read: this.readFacts, operation, request: this.requestFacts, busy: this.operationInFlight,
      canMutate: !this.operationInFlight && this.lastSnapshot !== undefined &&
        operation?.projection.receipt.confirmation !== 'unknown' && !(operation?.coreApplied === true && !operation.completed) &&
        !(operation?.action === 'backup' && !operation.completed && operation.projection.receipt.confirmation === 'confirmed') };
    this.emit({ ...source, webdavPass: '', backupPass: '', facts });
  }
  private safeError(_error: unknown): string { return '操作未完成，请核对当前配置或已有恢复记录'; }
  private formatNow(): string {
    const d = new Date(); const pad = (n: number): string => n < 10 ? `0${n}` : `${n}`;
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
}
