import { hilog } from '@kit.PerformanceAnalysisKit';
import { ReaderRuntimeOwner } from '../../app/ReaderRuntimeOwner';
import {
  SourceGateway,
  type BookSource,
  type SourceCheckOutcome,
  type SourceDebugLog,
} from './SourceGateway';

const DOMAIN = 0x5244;

export type SourceBatchCheckPhase =
  'idle' | 'running' | 'stopping' | 'completed' | 'stopped' | 'failed';

export interface SourceBatchCheckResult {
  sourceId: string;
  sourceName: string;
  state: 'passed' | 'failed' | 'error';
  levelsPassed: string[];
  message: string;
  durationMs: number;
  traceId: string;
}

export interface SourceBatchCheckProgress {
  phase: SourceBatchCheckPhase;
  total: number;
  completed: number;
  passed: number;
  failed: number;
  errors: number;
  currentIndex: number;
  currentSourceId: string;
  currentSourceName: string;
  results: SourceBatchCheckResult[];
}

const EMPTY_BATCH_CHECK_PROGRESS: SourceBatchCheckProgress = {
  phase: 'idle',
  total: 0,
  completed: 0,
  passed: 0,
  failed: 0,
  errors: 0,
  currentIndex: 0,
  currentSourceId: '',
  currentSourceName: '',
  results: [],
};

export interface SourceToolsSnapshot {
  sources: BookSource[];
  sourceListRevision: number;
  selectionRevision: number;
  selectedSourceIds: string[];
  selectedSourceCount: number;
  editorSourceId: string;
  editorText: string;
  debugSourceId: string;
  debugKey: string;
  debugLogs: SourceDebugLog[];
  batchCheck: SourceBatchCheckProgress;
  busy: boolean;
  statusMessage: string;
}

interface SourceToolsPatch {
  sources?: BookSource[];
  sourceListRevision?: number;
  selectionRevision?: number;
  selectedSourceIds?: string[];
  selectedSourceCount?: number;
  editorSourceId?: string;
  editorText?: string;
  debugSourceId?: string;
  debugKey?: string;
  debugLogs?: SourceDebugLog[];
  batchCheck?: SourceBatchCheckProgress;
  busy?: boolean;
  statusMessage?: string;
}

export const EMPTY_SOURCE_TOOLS_SNAPSHOT: SourceToolsSnapshot = {
  sources: [],
  sourceListRevision: 0,
  selectionRevision: 0,
  selectedSourceIds: [],
  selectedSourceCount: 0,
  editorSourceId: '',
  editorText: '',
  debugSourceId: '',
  debugKey: '我的',
  debugLogs: [],
  batchCheck: EMPTY_BATCH_CHECK_PROGRESS,
  busy: false,
  statusMessage: '',
};

/**
 * UI coordinator for existing Core source tools. It owns no source rules,
 * export serialization, source checking, or persistence.
 */
export class SourceToolsOrchestrator {
  private readonly gateway: SourceGateway;
  private readonly owner: ReaderRuntimeOwner;
  private readonly emit: (snapshot: SourceToolsSnapshot) => void;
  private readonly isCurrent: () => boolean;
  private snapshot: SourceToolsSnapshot = EMPTY_SOURCE_TOOLS_SNAPSHOT;
  private session: number = 0;
  private batchCheckRun: number = 0;
  private batchCheckCancelRequested: boolean = false;
  private operationTail: Promise<void> = Promise.resolve();
  /** Counts admitted operations, including those queued behind a prior page session. */
  private pendingOperations: number = 0;

  constructor(
    emit: (snapshot: SourceToolsSnapshot) => void,
    isCurrent: () => boolean,
    owner: ReaderRuntimeOwner = ReaderRuntimeOwner.current(),
  ) {
    this.owner = owner;
    this.gateway = new SourceGateway(owner);
    this.emit = emit;
    this.isCurrent = isCurrent;
  }

  open(seedSources: BookSource[] = []): void {
    this.session += 1;
    this.batchCheckRun += 1;
    this.batchCheckCancelRequested = false;
    const session = this.session;
    this.snapshot = this.copySnapshot(EMPTY_SOURCE_TOOLS_SNAPSHOT);
    // The source-management page already holds the last Core-authoritative
    // list. Seed the first frame with it so ArkUI never renders a stale 0/0
    // header while the fresh Core read is in flight.
    this.snapshot.sources = seedSources.slice();
    this.publish({ busy: true, statusMessage: '正在读取 Core 书源工具数据…' });
    this.enqueue(async (): Promise<void> => {
      try {
        const sources = await this.gateway.loadSources();
        if (this.isCurrentSession(session)) {
          this.publish({ sources, busy: false, statusMessage: '已读取 Core 数据' });
        }
      } catch (error) {
        this.fail(session, '书源工具数据读取失败', error as Error);
      }
    }, true);
  }

  exportAll(): void {
    this.exportSources(undefined);
  }

  setSelection(sourceIds: string[]): void {
    if (this.snapshot.busy || this.pendingOperations > 0) {
      return;
    }
    const selection = this.normalizeSourceIds(sourceIds);
    this.publish({
      selectedSourceIds: selection,
      selectedSourceCount: selection.length,
      statusMessage: selection.length === 0 ? '已清空选择' : `已选择 ${selection.length} 个书源`,
    });
  }

  exportSelected(sourceIds: string[]): void {
    const selection = this.normalizeSourceIds(sourceIds);
    if (selection.length === 0) {
      return;
    }
    this.exportSources(selection);
  }

  private exportSources(sourceIds: string[] | undefined): void {
    const session = this.session;
    this.enqueue(async (): Promise<void> => {
      this.publishIfCurrent(session, { busy: true, statusMessage: '正在由 Core 导出书源…' });
      try {
        const exported = await this.gateway.exportBookSources(sourceIds);
        const fileName = await this.owner.saveBookSourceJson(
          exported.data,
          `reader-book-sources-${Date.now()}.json`,
        );
        if (!this.isCurrentSession(session)) {
          return;
        }
        this.publish({
          busy: false,
          statusMessage: fileName === undefined ? '已取消导出' : `已导出 ${exported.count} 个书源：${fileName}`,
        });
      } catch (error) {
        this.fail(session, '书源导出失败', error as Error);
      }
    });
  }

  setSelectedEnabled(sourceIds: string[], enabled: boolean): void {
    const selection = this.normalizeSourceIds(sourceIds);
    if (selection.length === 0) {
      return;
    }
    const session = this.session;
    this.enqueue(async (): Promise<void> => {
      this.publishIfCurrent(session, {
        busy: true,
        statusMessage: `正在${enabled ? '启用' : '停用'} ${selection.length} 个书源…`,
      });
      let updatedCount = 0;
      try {
        for (const sourceId of selection) {
          await this.gateway.updateSource(sourceId, { enabled });
          updatedCount += 1;
          if (!enabled) {
            try {
              await this.owner.clearSourceCookieSession(sourceId);
            } catch (error) {
              hilog.error(DOMAIN, 'Reader',
                'Source disabled but cookie cleanup failed: sourceId=%{private}s err=%{private}s',
                sourceId, (error as Error).message);
            }
          }
        }
        const sources = await this.gateway.loadSources();
        if (this.isCurrentSession(session)) {
          this.publish({
            sources,
            busy: false,
            statusMessage: `已${enabled ? '启用' : '停用'} ${selection.length} 个书源`,
          });
        }
      } catch (error) {
        const updateError = error as Error;
        // Repeated source.update calls are intentionally not presented as one
        // atomic Core command. If an item fails, reload durable truth so the
        // page never hides an already-applied prefix.
        try {
          const sources = await this.gateway.loadSources();
          if (this.isCurrentSession(session)) {
            this.publish({
              sources,
              busy: false,
              statusMessage: `批量更新中断：已完成 ${updatedCount}/${selection.length}；${updateError.message}`,
            });
          }
        } catch (_) {
          this.fail(session, `批量更新书源失败（已完成 ${updatedCount}/${selection.length}）`, updateError);
        }
      }
    });
  }

  checkSelected(sourceIds: string[]): void {
    if (this.snapshot.busy || this.pendingOperations > 0) {
      return;
    }
    const selection = this.normalizeSourceIds(sourceIds);
    if (selection.length === 0) {
      return;
    }
    const session = this.session;
    const key = this.snapshot.debugKey.trim();
    const run = this.batchCheckRun + 1;
    this.batchCheckRun = run;
    this.batchCheckCancelRequested = false;
    this.enqueue(async (): Promise<void> => {
      let progress = new SourceBatchCheckProgressState(selection.length);
      this.publishIfCurrent(session, {
        busy: true,
        debugSourceId: '',
        debugLogs: [],
        batchCheck: progress.snapshot(),
        statusMessage: `已开始逐源检测：0/${selection.length}`,
      });
      try {
        for (let index = 0; index < selection.length; index++) {
          if (!this.isCurrentSession(session) || this.batchCheckRun !== run) {
            return;
          }
          if (this.batchCheckCancelRequested) {
            break;
          }
          const sourceId = selection[index];
          const sourceName = this.sourceName(sourceId);
          progress = progress.startSource(index + 1, sourceId, sourceName);
          this.publish({
            batchCheck: progress.snapshot(),
            statusMessage: `正在检测 ${index + 1}/${selection.length}：${sourceName}`,
          });
          try {
            const outcome = await this.gateway.checkSource(
              sourceId,
              (): boolean => this.isBatchCheckCurrent(session, run),
              key,
            );
            if (!this.isCurrentSession(session) || this.batchCheckRun !== run) {
              return;
            }
            const stopping = this.batchCheckCancelRequested;
            progress = progress.finish(
              this.batchResult(sourceName, outcome),
              stopping ? 'stopping' : 'running',
            );
            this.publish({
              debugSourceId: sourceId,
              debugLogs: outcome.logs,
              batchCheck: progress.snapshot(),
              statusMessage: stopping ?
                `已完成 ${progress.completed}/${selection.length}：${sourceName}；正在停止…` :
                `已完成 ${progress.completed}/${selection.length}：${sourceName}${outcome.available ? '可用' : '不可用'}`,
            });
          } catch (error) {
            if (!this.isCurrentSession(session) || this.batchCheckRun !== run) {
              return;
            }
            if (this.batchCheckCancelRequested) {
              break;
            }
            const message = (error as Error).message;
            progress = progress.finish({
              sourceId,
              sourceName,
              state: 'error',
              levelsPassed: [],
              message,
              durationMs: 0,
              traceId: '',
            });
            this.publish({
              debugSourceId: sourceId,
              debugLogs: [{
                state: -1,
                message: `[应用] ${message}`,
                timestampMs: Date.now(),
                sourceId,
              }],
              batchCheck: progress.snapshot(),
              statusMessage: `已完成 ${progress.completed}/${selection.length}：${sourceName}检测错误`,
            });
          }
        }
        if (this.isCurrentSession(session) && this.batchCheckRun === run) {
          const stopped = this.batchCheckCancelRequested && progress.completed < selection.length;
          progress = stopped ? progress.stop() : progress.complete();
          this.publish({
            batchCheck: progress.snapshot(),
            busy: false,
            statusMessage: stopped ?
              `已停止检测：完成 ${progress.completed}/${selection.length}，可用 ${progress.passed}，不可用 ${progress.failed}，检测错误 ${progress.errors}` :
              `批量检测完成：可用 ${progress.passed}，不可用 ${progress.failed}，检测错误 ${progress.errors}`,
          });
        }
      } catch (error) {
        if (this.isCurrentSession(session) && this.batchCheckRun === run) {
          this.publish({
            batchCheck: progress.fail(),
            busy: false,
            statusMessage: `批量检测书源失败：${(error as Error).message}`,
          });
        }
        hilog.error(DOMAIN, 'Reader', '批量检测书源失败: %{private}s', (error as Error).message);
      }
    });
  }

  stopCheckSelected(): void {
    if (this.snapshot.batchCheck.phase !== 'running') {
      return;
    }
    this.batchCheckCancelRequested = true;
    const progress = this.snapshot.batchCheck;
    this.publish({
      batchCheck: {
        phase: 'stopping',
        total: progress.total,
        completed: progress.completed,
        passed: progress.passed,
        failed: progress.failed,
        errors: progress.errors,
        currentIndex: progress.currentIndex,
        currentSourceId: progress.currentSourceId,
        currentSourceName: progress.currentSourceName,
        results: progress.results.slice(),
      },
      statusMessage: `正在停止检测：已完成 ${progress.completed}/${progress.total}…`,
    });
  }

  deleteSelected(sourceIds: string[]): void {
    const selection = this.normalizeSourceIds(sourceIds);
    if (selection.length === 0) {
      return;
    }
    const session = this.session;
    this.enqueue(async (): Promise<void> => {
      this.publishIfCurrent(session, { busy: true, statusMessage: `正在删除 ${selection.length} 个书源…` });
      try {
        const deleted = await this.gateway.deleteSources(selection);
        const sources = await this.gateway.loadSources();
        if (this.isCurrentSession(session)) {
          const cleanup = deleted.cookieCleanupFailures === 0 ? '' :
            `；${deleted.cookieCleanupFailures} 个 Host 登录会话清理失败`;
          this.publish({
            sources,
            busy: false,
            statusMessage: `已删除 ${deleted.deletedCount} 个书源${cleanup}`,
          });
        }
      } catch (error) {
        this.fail(session, '书源删除失败', error as Error);
      }
    });
  }

  openEditor(sourceId: string): void {
    const session = this.session;
    this.enqueue(async (): Promise<void> => {
      this.publishIfCurrent(session, { busy: true, statusMessage: '正在读取原始 BookSource…' });
      try {
        const editorText = await this.gateway.loadEditableSource(sourceId);
        if (this.isCurrentSession(session)) {
          this.publish({ editorSourceId: sourceId, editorText, busy: false, statusMessage: '编辑原始 BookSource JSON' });
        }
      } catch (error) {
        this.fail(session, '书源读取失败', error as Error);
      }
    });
  }

  updateEditorDraft(text: string): void {
    if (this.snapshot.busy || this.pendingOperations > 0 ||
      this.snapshot.editorSourceId.length === 0 || text.length > 16 * 1024 * 1024) {
      return;
    }
    this.publish({ editorText: text });
  }

  cancelEditor(): void {
    if (this.snapshot.busy || this.pendingOperations > 0) {
      return;
    }
    this.publish({ editorSourceId: '', editorText: '', statusMessage: '已取消编辑' });
  }

  saveEditor(): void {
    const session = this.session;
    const sourceId = this.snapshot.editorSourceId;
    const text = this.snapshot.editorText;
    if (sourceId.length === 0 || text.length === 0) {
      return;
    }
    this.enqueue(async (): Promise<void> => {
      this.publishIfCurrent(session, { busy: true, statusMessage: '正在由 Core 校验并保存…' });
      try {
        await this.gateway.saveEditableSource(sourceId, text);
        const sources = await this.gateway.loadSources();
        if (this.isCurrentSession(session)) {
          this.publish({
            sources,
            editorSourceId: '',
            editorText: '',
            busy: false,
            statusMessage: '书源已由 Core 校验并保存',
          });
        }
      } catch (error) {
        this.fail(session, '书源保存失败', error as Error);
      }
    });
  }

  updateDebugKey(value: string): void {
    if (!this.snapshot.busy && this.pendingOperations === 0 && value.length <= 4096) {
      this.publish({ debugKey: value });
    }
  }

  debugSource(sourceId: string): void {
    const session = this.session;
    const key = this.snapshot.debugKey.trim();
    this.enqueue(async (): Promise<void> => {
      this.publishIfCurrent(session, {
        busy: true,
        debugSourceId: sourceId,
        debugLogs: [],
        statusMessage: '正在执行真实 L1–L5 检测与 Core 调试…',
      });
      try {
        const health = await this.gateway.checkSource(
          sourceId,
          (): boolean => this.isCurrentSession(session),
          key,
        );
        if (!this.isCurrentSession(session)) {
          return;
        }
        this.publish({
          debugLogs: health.logs,
          busy: false,
          statusMessage: this.debugSummary(health),
        });
      } catch (error) {
        this.fail(session, '书源调试失败', error as Error);
      }
    });
  }

  private debugSummary(health: SourceCheckOutcome): string {
    const levels = health.levelsPassed.length === 0 ? '无通过级别' : health.levelsPassed.join('、');
    if (!health.available) {
      const evidence = health.hostEvidenceCount === 0 ? 'Core 在发起网络前结束' :
        `${health.hostEvidenceCount} 条同次 Host 网络证据`;
      return `真实检测未通过（${levels}，${evidence}）：${health.failureReason ?? '未知错误'}`;
    }
    return `真实检测 ${levels} 通过（${health.durationMs}ms）；trace=${health.traceId}，` +
      `${health.hostEvidenceCount} 条同次 Host 网络证据`;
  }

  private sourceName(sourceId: string): string {
    for (const source of this.snapshot.sources) {
      if (source.sourceId === sourceId) {
        return source.name.trim().length > 0 ? source.name : sourceId;
      }
    }
    return sourceId;
  }

  private batchResult(sourceName: string, outcome: SourceCheckOutcome): SourceBatchCheckResult {
    const levels = outcome.levelsPassed.length === 0 ? '无通过级别' : outcome.levelsPassed.join('、');
    return {
      sourceId: outcome.sourceId,
      sourceName,
      state: outcome.available ? 'passed' : 'failed',
      levelsPassed: outcome.levelsPassed.slice(),
      message: outcome.available ? `${levels} 通过，${outcome.durationMs}ms` :
        `${levels}：${outcome.failureReason ?? '未知错误'}`,
      durationMs: outcome.durationMs,
      traceId: outcome.traceId,
    };
  }

  private isBatchCheckCurrent(session: number, run: number): boolean {
    return this.isCurrentSession(session) && this.batchCheckRun === run &&
      !this.batchCheckCancelRequested;
  }

  private normalizeSourceIds(sourceIds: string[]): string[] {
    const available = new Set(this.snapshot.sources.map((source: BookSource): string => source.sourceId));
    const seen = new Set<string>();
    const normalized: string[] = [];
    for (const sourceId of sourceIds) {
      if (available.has(sourceId) && !seen.has(sourceId)) {
        seen.add(sourceId);
        normalized.push(sourceId);
      }
    }
    return normalized;
  }

  private enqueue(operation: () => Promise<void>, allowQueued: boolean = false): void {
    if (!allowQueued && (this.snapshot.busy || this.pendingOperations > 0)) {
      return;
    }
    this.pendingOperations += 1;
    this.operationTail = this.operationTail
      .then(operation)
      .catch((error: Error): void => {
        hilog.error(DOMAIN, 'Reader', 'Source tools operation failed: %{private}s', error.message);
      })
      .finally((): void => {
        this.pendingOperations = Math.max(0, this.pendingOperations - 1);
      });
  }

  private fail(session: number, label: string, error: Error): void {
    const message = error.message;
    if (this.isCurrentSession(session)) {
      this.publish({ busy: false, statusMessage: `${label}：${message}` });
    }
    hilog.error(DOMAIN, 'Reader', '%{private}s: %{private}s', label, message);
  }

  private publishIfCurrent(session: number, patch: SourceToolsPatch): void {
    if (this.isCurrentSession(session)) {
      this.publish(patch);
    }
  }

  private publish(patch: SourceToolsPatch): void {
    const sourceListRevision = patch.sourceListRevision ??
      (patch.sources !== undefined ?
        this.snapshot.sourceListRevision + 1 : this.snapshot.sourceListRevision);
    const selectionRevision = patch.selectionRevision ??
      (patch.selectedSourceIds !== undefined ?
        this.snapshot.selectionRevision + 1 : this.snapshot.selectionRevision);
    this.snapshot = {
      sources: patch.sources ?? this.snapshot.sources,
      sourceListRevision,
      selectionRevision,
      selectedSourceIds: patch.selectedSourceIds ?? this.snapshot.selectedSourceIds,
      selectedSourceCount: patch.selectedSourceCount ?? this.snapshot.selectedSourceCount,
      editorSourceId: patch.editorSourceId ?? this.snapshot.editorSourceId,
      editorText: patch.editorText ?? this.snapshot.editorText,
      debugSourceId: patch.debugSourceId ?? this.snapshot.debugSourceId,
      debugKey: patch.debugKey ?? this.snapshot.debugKey,
      debugLogs: patch.debugLogs ?? this.snapshot.debugLogs,
      batchCheck: patch.batchCheck ?? this.snapshot.batchCheck,
      busy: patch.busy ?? this.snapshot.busy,
      statusMessage: patch.statusMessage ?? this.snapshot.statusMessage,
    };
    if (this.isCurrent()) {
      this.emit(this.copySnapshot(this.snapshot));
    }
  }

  private copySnapshot(source: SourceToolsSnapshot): SourceToolsSnapshot {
    return {
      sources: source.sources.slice(),
      sourceListRevision: source.sourceListRevision,
      selectionRevision: source.selectionRevision,
      selectedSourceIds: source.selectedSourceIds.slice(),
      selectedSourceCount: source.selectedSourceCount,
      editorSourceId: source.editorSourceId,
      editorText: source.editorText,
      debugSourceId: source.debugSourceId,
      debugKey: source.debugKey,
      debugLogs: source.debugLogs.slice(),
      batchCheck: {
        phase: source.batchCheck.phase,
        total: source.batchCheck.total,
        completed: source.batchCheck.completed,
        passed: source.batchCheck.passed,
        failed: source.batchCheck.failed,
        errors: source.batchCheck.errors,
        currentIndex: source.batchCheck.currentIndex,
        currentSourceId: source.batchCheck.currentSourceId,
        currentSourceName: source.batchCheck.currentSourceName,
        // Results are immutable after insertion; copying the array is enough
        // to give ArkUI a new observable value without recreating every prior
        // row on each of a potentially 1,700+ source sweep.
        results: source.batchCheck.results.slice(),
      },
      busy: source.busy,
      statusMessage: source.statusMessage,
    };
  }

  private isCurrentSession(session: number): boolean {
    return this.isCurrent() && this.session === session;
  }
}

/**
 * Small immutable accumulator kept outside the UI snapshot. It makes the
 * completed = passed + failed + errors invariant explicit while the page
 * receives a fresh snapshot after every source.
 */
class SourceBatchCheckProgressState {
  readonly phase: SourceBatchCheckPhase;
  readonly total: number;
  readonly completed: number;
  readonly passed: number;
  readonly failed: number;
  readonly errors: number;
  readonly currentIndex: number;
  readonly currentSourceId: string;
  readonly currentSourceName: string;
  readonly results: SourceBatchCheckResult[];

  constructor(total: number, phase: SourceBatchCheckPhase = 'running', completed: number = 0,
    passed: number = 0, failed: number = 0, errors: number = 0, currentIndex: number = 0,
    currentSourceId: string = '', currentSourceName: string = '',
    results: SourceBatchCheckResult[] = []) {
    this.phase = phase;
    this.total = total;
    this.completed = completed;
    this.passed = passed;
    this.failed = failed;
    this.errors = errors;
    this.currentIndex = currentIndex;
    this.currentSourceId = currentSourceId;
    this.currentSourceName = currentSourceName;
    this.results = results;
  }

  startSource(index: number, sourceId: string, sourceName: string): SourceBatchCheckProgressState {
    return new SourceBatchCheckProgressState(
      this.total, 'running', this.completed, this.passed, this.failed,
      this.errors, index, sourceId, sourceName, this.results,
    );
  }

  finish(result: SourceBatchCheckResult,
    phase: SourceBatchCheckPhase = 'running'): SourceBatchCheckProgressState {
    return new SourceBatchCheckProgressState(
      this.total,
      phase,
      this.completed + 1,
      this.passed + (result.state === 'passed' ? 1 : 0),
      this.failed + (result.state === 'failed' ? 1 : 0),
      this.errors + (result.state === 'error' ? 1 : 0),
      this.currentIndex,
      this.currentSourceId,
      this.currentSourceName,
      [result].concat(this.results),
    );
  }

  complete(): SourceBatchCheckProgressState {
    return this.withTerminalPhase('completed');
  }

  stop(): SourceBatchCheckProgressState {
    return this.withTerminalPhase('stopped');
  }

  fail(): SourceBatchCheckProgress {
    return this.withTerminalPhase('failed').snapshot();
  }

  snapshot(): SourceBatchCheckProgress {
    return {
      phase: this.phase,
      total: this.total,
      completed: this.completed,
      passed: this.passed,
      failed: this.failed,
      errors: this.errors,
      currentIndex: this.currentIndex,
      currentSourceId: this.currentSourceId,
      currentSourceName: this.currentSourceName,
      results: this.results.slice(),
    };
  }

  private withTerminalPhase(phase: SourceBatchCheckPhase): SourceBatchCheckProgressState {
    return new SourceBatchCheckProgressState(
      this.total, phase, this.completed, this.passed, this.failed, this.errors,
      0, '', '', this.results,
    );
  }
}
