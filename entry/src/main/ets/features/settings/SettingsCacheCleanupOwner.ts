import { ReaderRuntimeOwner } from '../../app/ReaderRuntimeOwner';
import { ReaderWriteEvidence } from '../../app/ReaderWriteEvidence';
import { projectOperationFacts, type OperationFacts, type CommitConfirmationKind } from '../../app/ReaderOperationFacts';
import { formatDownloadStorageBytes } from '../downloads/SharedDownloadProjection';
import type { ReadingOperationPendingError } from '../reading/ReadingOperationIntents';
import { SettingsCacheGateway, type SettingsCacheClearReport } from './SettingsCacheGateway';

export interface SettingsCacheCleanupSnapshot {
  busy: boolean;
  confirmation?: CommitConfirmationKind;
  canContinueOriginal?: boolean;
  operation: OperationFacts<SettingsCacheClearReport>;
}
type SettingsCacheIssue = ReadingOperationPendingError & { unconfirmed?: boolean; };
let cacheCleanupGeneration: number = 0;

/** The cache-clear authority is shared with Offline. This owner retains only
 * Settings presentation facts; exact receipt/sequence/IO belong to that domain. */
export class SettingsCacheCleanupOwner {
  private static retainedRuntime: ReaderRuntimeOwner | undefined;
  private static retainedOwner: SettingsCacheCleanupOwner | undefined;
  static peekForRuntime(owner: ReaderRuntimeOwner): SettingsCacheCleanupOwner | undefined {
    return ReaderRuntimeOwner.isCurrent(owner) && SettingsCacheCleanupOwner.retainedRuntime === owner ? SettingsCacheCleanupOwner.retainedOwner : undefined;
  }
  static forRuntime(owner: ReaderRuntimeOwner, emit: (snapshot: SettingsCacheCleanupSnapshot) => void): SettingsCacheCleanupOwner | undefined {
    if (!ReaderRuntimeOwner.isCurrent(owner)) return undefined;
    if (SettingsCacheCleanupOwner.retainedRuntime === owner && SettingsCacheCleanupOwner.retainedOwner !== undefined) {
      SettingsCacheCleanupOwner.retainedOwner.emit = emit;
      return SettingsCacheCleanupOwner.retainedOwner;
    }
    const current = new SettingsCacheCleanupOwner(owner, emit);
    SettingsCacheCleanupOwner.retainedRuntime = owner; SettingsCacheCleanupOwner.retainedOwner = current; return current;
  }
  private readonly owner: ReaderRuntimeOwner;
  private readonly gateway: SettingsCacheGateway;
  private emit: (snapshot: SettingsCacheCleanupSnapshot) => void;
  private active: Promise<SettingsCacheCleanupSnapshot> | undefined = undefined;
  private snapshot: SettingsCacheCleanupSnapshot = { busy: false, operation: projectOperationFacts({ phase: 'idle' }) };
  constructor(owner: ReaderRuntimeOwner, emit: (snapshot: SettingsCacheCleanupSnapshot) => void) {
    this.owner = owner; this.gateway = new SettingsCacheGateway(owner); this.emit = emit;
  }
  owns(owner: ReaderRuntimeOwner): boolean { return owner === this.owner; }
  current(): SettingsCacheCleanupSnapshot { return this.snapshot; }

  clear(current: () => boolean): Promise<SettingsCacheCleanupSnapshot> {
    if (this.active !== undefined) return this.active;
    if (this.snapshot.busy || this.snapshot.confirmation === 'unknown' || !this.admitted(current)) return Promise.resolve(this.snapshot);
    const generation = ++cacheCleanupGeneration;
    this.publish({ busy: true, operation: projectOperationFacts({ phase: 'loading', generation, canRetry: false, message: '正在清理文字缓存' }) });
    this.active = this.perform(generation, current).finally((): void => { this.active = undefined; });
    return this.active;
  }
  /** Opening/refreshing reads the exact original receipt, never resubmits clear. */
  reconcile(current: () => boolean, continueOriginal: boolean = false): Promise<SettingsCacheCleanupSnapshot> {
    if (this.active !== undefined) return this.active;
    if (this.snapshot.busy || !this.admitted(current)) return Promise.resolve(this.snapshot);
    const previous = this.snapshot;
    const generation = previous.operation.generation || ++cacheCleanupGeneration;
    this.publish({ ...previous, busy: true, canContinueOriginal: false, operation: projectOperationFacts({ phase: 'refreshing',
      value: previous.operation.value, generation, canRetry: false, message: '正在核对原清理操作' }) });
    this.active = this.recover(generation, previous, current, continueOriginal).finally((): void => { this.active = undefined; });
    return this.active;
  }
  continueOriginal(generation: number, current: () => boolean): Promise<SettingsCacheCleanupSnapshot> {
    if (this.snapshot.operation.generation !== generation || !this.snapshot.canContinueOriginal || !this.admitted(current)) return Promise.resolve(this.snapshot);
    return this.reconcile(current, true);
  }
  private async recover(generation: number, previous: SettingsCacheCleanupSnapshot, current: () => boolean,
    continueOriginal: boolean): Promise<SettingsCacheCleanupSnapshot> {
    try {
      const pending = await this.gateway.pending();
      if (pending === undefined) { this.publish({ ...previous, busy: false }); return this.snapshot; }
      const recovered = await this.gateway.reconcile((): boolean => this.admitted(current), undefined, continueOriginal);
      if (recovered === undefined) { this.publish({ ...previous, busy: false }); return this.snapshot; }
      const report = this.gateway.decode(recovered.data);
      this.publish({ busy: false, confirmation: 'confirmed', canContinueOriginal: false,
        operation: projectOperationFacts({ phase: 'succeeded', value: report, generation, message: this.resultMessage(report) }) });
    } catch (error) {
      const issue = error as SettingsCacheIssue;
      const confirmed = issue.confirmed === true || previous.confirmation === 'confirmed';
      this.publish({ busy: false, confirmation: confirmed ? 'confirmed' : 'unknown',
        canContinueOriginal: false,
        operation: projectOperationFacts({ phase: confirmed ? 'refreshFailed' : 'pendingReconciliation', value: previous.operation.value,
          generation, canRetry: true, blockedReason: issue.blocked ? issue.message : undefined, message: issue.message }) });
    }
    return this.snapshot;
  }
  private async perform(generation: number, current: () => boolean): Promise<SettingsCacheCleanupSnapshot> {
    const evidence = new ReaderWriteEvidence();
    let report: SettingsCacheClearReport | undefined;
    let issue: SettingsCacheIssue | undefined;
    try { report = await this.gateway.clear(evidence, (): boolean => this.admitted(current)); }
    catch (error) { issue = error as SettingsCacheIssue; }
    const confirmation = issue?.unconfirmed === true ? 'unknown' : issue?.confirmed === true ? 'confirmed' : evidence.confirmation();
    const pending = issue?.intent !== undefined;
    const message = confirmation === 'confirmed' ? (issue === undefined && report !== undefined ? this.resultMessage(report) : `清理已确认，收尾尚未确认：${issue?.message ?? '结果待核对'}`) :
      confirmation === 'unknown' || pending ? `清理结果尚未确认，原操作已保留，请核对${issue ? `：${issue.message}` : ''}` :
        `清理未执行，请重试${issue ? `：${issue.message}` : ''}`;
    // Failure of settlement/local clear cannot convert a qualified Core ACK
    // into unknown; a retained cold intent cannot be treated as a fresh failure.
    this.publish({ busy: false, confirmation: confirmation === 'undispatched' && pending ? 'unknown' : confirmation,
      canContinueOriginal: false, operation: projectOperationFacts({
        phase: confirmation === 'confirmed' ? (issue === undefined ? 'succeeded' : 'refreshFailed') :
          confirmation === 'unknown' || pending ? 'pendingReconciliation' : 'notDispatched', value: report,
        generation, canRetry: confirmation === 'undispatched' && !pending || confirmation === 'unknown' || issue !== undefined && (pending || confirmation === 'confirmed'),
        blockedReason: issue?.blocked ? issue.message : undefined, message }) });
    return this.snapshot;
  }
  private resultMessage(report: SettingsCacheClearReport): string {
    const bodyBytes = formatDownloadStorageBytes(report.removedContentBytes);
    if (report.scope === 'cache') return `已核实历史清理：正文 ${bodyBytes}`;
    const images = report.deletedBytes ?? 0, files = report.deletedFiles ?? 0;
    const message = report.removedContentBytes > 0 || images > 0 || files > 0 ?
      `已清理正文 ${bodyBytes}，回收正文图片 ${formatDownloadStorageBytes(images)}（${files} 个文件）` :
      '当前没有可清理的文字缓存；下载与受保护内容已保留';
    return `${message}${report.cleanupError === undefined ? '' : '；部分清理未完成，请稍后重试'}`;
  }
  private admitted(current: () => boolean): boolean { try { return ReaderRuntimeOwner.isCurrent(this.owner) && current(); } catch (_) { return false; } }
  private publish(snapshot: SettingsCacheCleanupSnapshot): void {
    this.snapshot = snapshot;
    if (ReaderRuntimeOwner.isCurrent(this.owner)) {
      try { this.emit(snapshot); } catch (_presentation) { /* UI cannot rewrite a durable receipt. */ }
    }
  }
}
