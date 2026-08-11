import { hilog } from '@kit.PerformanceAnalysisKit';
import { ReaderRuntimeOwner } from '../../app/ReaderRuntimeOwner';
import {
  SourceGateway,
  type BookSource,
  type RuleSubscription,
  type SourceCheckOutcome,
  type SourceDebugLog,
} from './SourceGateway';

const DOMAIN = 0x5244;

export interface SourceToolsSnapshot {
  sources: BookSource[];
  editorSourceId: string;
  editorText: string;
  debugSourceId: string;
  debugKey: string;
  debugLogs: SourceDebugLog[];
  subscriptions: RuleSubscription[];
  busy: boolean;
  statusMessage: string;
}

interface SourceToolsPatch {
  sources?: BookSource[];
  editorSourceId?: string;
  editorText?: string;
  debugSourceId?: string;
  debugKey?: string;
  debugLogs?: SourceDebugLog[];
  subscriptions?: RuleSubscription[];
  busy?: boolean;
  statusMessage?: string;
}

export const EMPTY_SOURCE_TOOLS_SNAPSHOT: SourceToolsSnapshot = {
  sources: [],
  editorSourceId: '',
  editorText: '',
  debugSourceId: '',
  debugKey: '我的',
  debugLogs: [],
  subscriptions: [],
  busy: false,
  statusMessage: '',
};

/**
 * UI coordinator for existing Core source tools. It owns no source rules,
 * export serialization, debug parsing, or subscription persistence.
 */
export class SourceToolsOrchestrator {
  private readonly gateway: SourceGateway;
  private readonly owner: ReaderRuntimeOwner;
  private readonly emit: (snapshot: SourceToolsSnapshot) => void;
  private readonly isCurrent: () => boolean;
  private snapshot: SourceToolsSnapshot = EMPTY_SOURCE_TOOLS_SNAPSHOT;
  private session: number = 0;
  private operationTail: Promise<void> = Promise.resolve();
  private idSequence: number = 0;

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

  open(): void {
    this.session += 1;
    const session = this.session;
    this.snapshot = this.copySnapshot(EMPTY_SOURCE_TOOLS_SNAPSHOT);
    this.publish({ busy: true, statusMessage: '正在读取 Core 书源工具数据…' });
    this.enqueue(async (): Promise<void> => {
      try {
        const sources = await this.gateway.loadSources();
        const subscriptions = await this.gateway.listRuleSubscriptions();
        if (this.isCurrentSession(session)) {
          this.publish({ sources, subscriptions, busy: false, statusMessage: '已读取 Core 数据' });
        }
      } catch (error) {
        this.fail(session, '书源工具数据读取失败', error as Error);
      }
    });
  }

  exportAll(): void {
    const session = this.session;
    this.enqueue(async (): Promise<void> => {
      this.publishIfCurrent(session, { busy: true, statusMessage: '正在由 Core 导出书源…' });
      try {
        const exported = await this.gateway.exportBookSources();
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
    if (this.snapshot.editorSourceId.length === 0 || text.length > 16 * 1024 * 1024) {
      return;
    }
    this.publish({ editorText: text });
  }

  cancelEditor(): void {
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
    if (value.length <= 4096) {
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
        const health = await this.gateway.checkSource(sourceId, (): boolean => this.isCurrentSession(session));
        const debug = await this.gateway.debugSource(sourceId, key);
        if (!this.isCurrentSession(session)) {
          return;
        }
        this.publish({
          debugLogs: debug.logs,
          busy: false,
          statusMessage: this.debugSummary(health, debug.finalState, debug.durationMs),
        });
      } catch (error) {
        this.fail(session, '书源调试失败', error as Error);
      }
    });
  }

  putSubscription(name: string, url: string, autoUpdate: boolean): void {
    const session = this.session;
    this.idSequence += 1;
    const id = Date.now() + this.idSequence;
    this.enqueue(async (): Promise<void> => {
      this.publishIfCurrent(session, { busy: true, statusMessage: '正在保存规则订阅…' });
      try {
        await this.gateway.putRuleSubscription({
          id,
          name: name.trim(),
          url: url.trim(),
          type: 0,
          customOrder: this.snapshot.subscriptions.length,
          autoUpdate,
          update: 0,
        });
        const subscriptions = await this.gateway.listRuleSubscriptions();
        if (this.isCurrentSession(session)) {
          this.publish({ subscriptions, busy: false, statusMessage: '规则订阅已由 Core 保存' });
        }
      } catch (error) {
        this.fail(session, '规则订阅保存失败', error as Error);
      }
    });
  }

  deleteSubscription(id: number): void {
    const session = this.session;
    this.enqueue(async (): Promise<void> => {
      this.publishIfCurrent(session, { busy: true, statusMessage: '正在删除规则订阅…' });
      try {
        await this.gateway.deleteRuleSubscription(id);
        const subscriptions = await this.gateway.listRuleSubscriptions();
        if (this.isCurrentSession(session)) {
          this.publish({ subscriptions, busy: false, statusMessage: '规则订阅已删除' });
        }
      } catch (error) {
        this.fail(session, '规则订阅删除失败', error as Error);
      }
    });
  }

  private debugSummary(health: SourceCheckOutcome, finalState: number, durationMs: number): string {
    const levels = health.levelsPassed.length === 0 ? '无通过级别' : health.levelsPassed.join('、');
    if (!health.available) {
      return `检测未通过（${levels}）：${health.failureReason ?? '未知错误'}；调试状态 ${finalState}`;
    }
    return `真实检测 ${levels} 通过（${health.durationMs}ms）；Core 调试完成（${durationMs}ms）`;
  }

  private enqueue(operation: () => Promise<void>): void {
    this.operationTail = this.operationTail.then(operation).catch((error: Error): void => {
      hilog.error(DOMAIN, 'Reader', 'Source tools operation failed: %{public}s', error.message);
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
      editorSourceId: patch.editorSourceId ?? this.snapshot.editorSourceId,
      editorText: patch.editorText ?? this.snapshot.editorText,
      debugSourceId: patch.debugSourceId ?? this.snapshot.debugSourceId,
      debugKey: patch.debugKey ?? this.snapshot.debugKey,
      debugLogs: patch.debugLogs ?? this.snapshot.debugLogs,
      subscriptions: patch.subscriptions ?? this.snapshot.subscriptions,
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
      editorSourceId: source.editorSourceId,
      editorText: source.editorText,
      debugSourceId: source.debugSourceId,
      debugKey: source.debugKey,
      debugLogs: source.debugLogs.slice(),
      subscriptions: source.subscriptions.slice(),
      busy: source.busy,
      statusMessage: source.statusMessage,
    };
  }

  private isCurrentSession(session: number): boolean {
    return this.isCurrent() && this.session === session;
  }
}
