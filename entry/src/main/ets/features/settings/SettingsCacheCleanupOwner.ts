import { ReaderRuntimeOwner } from '../../app/ReaderRuntimeOwner';
import { ReaderWriteEvidence } from '../../app/ReaderWriteEvidence';
import { projectOperationFacts, type OperationFacts, type CommitConfirmationKind } from '../../app/ReaderOperationFacts';
import { SettingsCacheGateway, type SettingsCacheClearReport } from './SettingsCacheGateway';

export interface SettingsCacheCleanupSnapshot {
  busy: boolean;
  confirmation?: CommitConfirmationKind;
  operation: OperationFacts<SettingsCacheClearReport>;
}

let cacheCleanupGeneration: number = 0;

/** Finite subdomain owned by the existing SettingsHost. A destructive command's
 * receipt is independent of page lifetime; publication is presentation-scoped. */
export class SettingsCacheCleanupOwner {
  private readonly owner: ReaderRuntimeOwner;
  private readonly gateway: SettingsCacheGateway;
  private readonly emit: (snapshot: SettingsCacheCleanupSnapshot) => void;
  private active: Promise<SettingsCacheCleanupSnapshot> | undefined = undefined;
  private snapshot: SettingsCacheCleanupSnapshot = { busy: false, operation: projectOperationFacts({ phase: 'idle' }) };

  constructor(owner: ReaderRuntimeOwner, emit: (snapshot: SettingsCacheCleanupSnapshot) => void) {
    this.owner = owner; this.gateway = new SettingsCacheGateway(owner); this.emit = emit;
  }
  owns(owner: ReaderRuntimeOwner): boolean { return owner === this.owner; }
  current(): SettingsCacheCleanupSnapshot { return this.snapshot; }

  clear(current: () => boolean): Promise<SettingsCacheCleanupSnapshot> {
    if (this.active !== undefined) return this.active;
    if (this.snapshot.busy) return Promise.resolve(this.snapshot);
    // There is no per-clear durable receipt query in the current Core protocol.
    // Neither a cache count nor closing/reopening can confirm a lost ACK.
    if (this.snapshot.confirmation === 'unknown') return Promise.resolve(this.snapshot);
    if (!ReaderRuntimeOwner.isCurrent(this.owner) || !current()) return Promise.resolve(this.snapshot);
    const generation = ++cacheCleanupGeneration;
    this.publish({ busy: true, operation: projectOperationFacts({ phase: 'loading', generation, canRetry: false,
      message: '正在清理文字缓存' }) });
    this.active = this.perform(generation, current).finally((): void => { this.active = undefined; });
    return this.active;
  }

  private async perform(generation: number, current: () => boolean): Promise<SettingsCacheCleanupSnapshot> {
    const evidence = new ReaderWriteEvidence();
    let report: SettingsCacheClearReport | undefined;
    let issue: string | undefined;
    try { report = await this.gateway.clear(evidence, (): boolean => ReaderRuntimeOwner.isCurrent(this.owner) && current()); }
    catch (error) { issue = error instanceof Error ? error.message : '清理反馈不可用'; }
    const confirmation = evidence.confirmation();
    const message = confirmation === 'confirmed' ? '已清理' : confirmation === 'unknown' ?
      '清理请求已提交，结果尚未确认；当前接口不能核对本次清理，未再次执行' : `清理未执行，请重试${issue ? `：${issue}` : ''}`;
    const snapshot: SettingsCacheCleanupSnapshot = { busy: false, confirmation,
      operation: projectOperationFacts({ phase: confirmation === 'confirmed' ? 'succeeded' :
        confirmation === 'unknown' ? 'pendingReconciliation' : 'notDispatched', value: report,
        generation, canRetry: confirmation === 'undispatched', message }) };
    // Preserve ACK/uncertainty even if the original presentation has retired.
    this.publish(snapshot);
    return snapshot;
  }

  private publish(snapshot: SettingsCacheCleanupSnapshot): void {
    this.snapshot = snapshot;
    if (ReaderRuntimeOwner.isCurrent(this.owner)) {
      try { this.emit(snapshot); } catch (_presentation) { /* Cannot rewrite the Core command's receipt. */ }
    }
  }
}
