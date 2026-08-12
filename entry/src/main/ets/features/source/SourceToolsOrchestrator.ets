import { hilog } from '@kit.PerformanceAnalysisKit';
import { ReaderRuntimeOwner } from '../../app/ReaderRuntimeOwner';
import {
  SourceGateway,
  type BookSource,
  type SourceCheckOutcome,
  type SourceDebugLog,
} from './SourceGateway';

const DOMAIN = 0x5244;

export interface SourceToolsSnapshot {
  sources: BookSource[];
  selectedSourceIds: string[];
  selectedSourceCount: number;
  editorSourceId: string;
  editorText: string;
  debugSourceId: string;
  debugKey: string;
  debugLogs: SourceDebugLog[];
  busy: boolean;
  statusMessage: string;
}

interface SourceToolsPatch {
  sources?: BookSource[];
  selectedSourceIds?: string[];
  selectedSourceCount?: number;
  editorSourceId?: string;
  editorText?: string;
  debugSourceId?: string;
  debugKey?: string;
  debugLogs?: SourceDebugLog[];
  busy?: boolean;
  statusMessage?: string;
}

export const EMPTY_SOURCE_TOOLS_SNAPSHOT: SourceToolsSnapshot = {
  sources: [],
  selectedSourceIds: [],
  selectedSourceCount: 0,
  editorSourceId: '',
  editorText: '',
  debugSourceId: '',
  debugKey: '我的',
  debugLogs: [],
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
                'Source disabled but cookie cleanup failed: sourceId=%{public}s err=%{public}s',
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
    const selection = this.normalizeSourceIds(sourceIds);
    if (selection.length === 0) {
      return;
    }
    const session = this.session;
    const key = this.snapshot.debugKey.trim();
    this.enqueue(async (): Promise<void> => {
      this.publishIfCurrent(session, {
        busy: true,
        debugSourceId: '',
        debugLogs: [],
        statusMessage: `正在逐个检测 ${selection.length} 个书源…`,
      });
      try {
        const logs: SourceDebugLog[] = [];
        let passed = 0;
        for (const sourceId of selection) {
          if (!this.isCurrentSession(session)) {
            return;
          }
          const outcome = await this.gateway.checkSource(
            sourceId,
            (): boolean => this.isCurrentSession(session),
            key,
          );
          logs.push(...outcome.logs);
          if (outcome.available) {
            passed += 1;
          }
        }
        if (this.isCurrentSession(session)) {
          this.publish({
            debugLogs: logs,
            busy: false,
            statusMessage: `批量检测完成：${passed}/${selection.length} 个书源通过 L1–L5`,
          });
        }
      } catch (error) {
        this.fail(session, '批量检测书源失败', error as Error);
      }
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

  private normalizeSourceIds(sourceIds: string[]): string[] {
    const available = new Set(this.snapshot.sources.map((source: BookSource): string => source.sourceId));
    const normalized: string[] = [];
    for (const sourceId of sourceIds) {
      if (available.has(sourceId) && normalized.indexOf(sourceId) < 0) {
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
        hilog.error(DOMAIN, 'Reader', 'Source tools operation failed: %{public}s', error.message);
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
    hilog.error(DOMAIN, 'Reader', '%{public}s: %{public}s', label, message);
  }

  private publishIfCurrent(session: number, patch: SourceToolsPatch): void {
    if (this.isCurrentSession(session)) {
      this.publish(patch);
    }
  }

  private publish(patch: SourceToolsPatch): void {
    this.snapshot = {
      sources: patch.sources ?? this.snapshot.sources,
      selectedSourceIds: patch.selectedSourceIds ?? this.snapshot.selectedSourceIds,
      selectedSourceCount: patch.selectedSourceCount ?? this.snapshot.selectedSourceCount,
      editorSourceId: patch.editorSourceId ?? this.snapshot.editorSourceId,
      editorText: patch.editorText ?? this.snapshot.editorText,
      debugSourceId: patch.debugSourceId ?? this.snapshot.debugSourceId,
      debugKey: patch.debugKey ?? this.snapshot.debugKey,
      debugLogs: patch.debugLogs ?? this.snapshot.debugLogs,
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
      selectedSourceIds: source.selectedSourceIds.slice(),
      selectedSourceCount: source.selectedSourceCount,
      editorSourceId: source.editorSourceId,
      editorText: source.editorText,
      debugSourceId: source.debugSourceId,
      debugKey: source.debugKey,
      debugLogs: source.debugLogs.slice(),
      busy: source.busy,
      statusMessage: source.statusMessage,
    };
  }

  private isCurrentSession(session: number): boolean {
    return this.isCurrent() && this.session === session;
  }
}
