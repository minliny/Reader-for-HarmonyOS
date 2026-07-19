// Source-tool route bodies.  A route in the Reader UI contract is not proof
// that Harmony has the corresponding Core + Host transaction.  These pages
// deliberately render only Core-backed results or an explicit unavailable
// state; they never keep demo source names, parsing logs, or pass counts.
import { ColorTokens } from '../../contract/generated/ColorTokens';
import { DemoAliasTokens } from '../../contract/generated/DemoAliasTokens';
import { RouteId } from '../../contract/generated/RouteTable';
import { ReaderUiStore } from '../store/ReaderUiStore';
import { CoreSourceCheckResult, CoreSourceDebugLog, CoreSourceDebugResult, CoreSourceDebugStage, CoreSourceEntry } from '../store/ReaderUiState';

@Component
struct SourceToolChip {
  @Prop label: string = '';
  @Prop tone: string = 'soft';

  build() {
    Text(this.label)
      .fontSize(11)
      .fontWeight(800)
      .fontColor(this.tone === 'filled' ? DemoAliasTokens.onPrimary :
        (this.tone === 'warn' ? ColorTokens.accent : ColorTokens.primaryDark))
      .height(26)
      .padding({ left: 10, right: 10 })
      .borderRadius(DemoAliasTokens.radiusPill)
      .backgroundColor(this.tone === 'filled' ? ColorTokens.primary : ColorTokens.metaBg)
      .border({ width: this.tone === 'filled' ? 0 : 1, color: this.tone === 'warn' ? ColorTokens.accent : ColorTokens.border })
  }
}

@Component
struct SourceToolCard {
  @Prop title: string = '';
  @Prop subtitle: string = '';
  @Prop chip: string = '';
  @Prop tone: string = 'soft';

  build() {
    Column() {
      Row() {
        Column() {
          Text(this.title)
            .fontSize(16)
            .fontWeight(850)
            .fontColor(ColorTokens.ink)
            .maxLines(2)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
          if (this.subtitle.length > 0) {
            Text(this.subtitle)
              .fontSize(12)
              .lineHeight(18)
              .fontColor(ColorTokens.muted)
              .margin({ top: 5 })
              .maxLines(4)
              .textOverflow({ overflow: TextOverflow.Ellipsis })
          }
        }
        .alignItems(HorizontalAlign.Start)
        .layoutWeight(1)
        if (this.chip.length > 0) {
          SourceToolChip({ label: this.chip, tone: this.tone })
            .margin({ left: 10 })
        }
      }
      .width('100%')
      .alignItems(VerticalAlign.Center)
    }
    .width('100%')
    .padding({ left: 14, right: 14, top: 14, bottom: 14 })
    .borderRadius(DemoAliasTokens.radiusLg)
    .backgroundColor(DemoAliasTokens.surface)
    .border({ width: 1, color: ColorTokens.border })
    .shadow({ radius: 18, color: DemoAliasTokens.shadowSoftColor, offsetX: 0, offsetY: 6 })
  }
}

@Component
struct SourceToolSectionTitle {
  @Prop title: string = '';

  build() {
    Text(this.title)
      .fontSize(13)
      .fontWeight(900)
      .fontColor(ColorTokens.ink)
      .width('100%')
  }
}

@Component
struct SourceToolRow {
  @Prop title: string = '';
  @Prop detail: string = '';
  @Prop chip: string = '';
  @Prop tone: string = 'soft';

  build() {
    Row() {
      Column() {
        Text(this.title)
          .fontSize(13)
          .fontWeight(800)
          .fontColor(ColorTokens.ink)
          .maxLines(2)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
        if (this.detail.length > 0) {
          Text(this.detail)
            .fontSize(11)
            .lineHeight(16)
            .fontColor(ColorTokens.muted)
            .margin({ top: 4 })
            .maxLines(4)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
        }
      }
      .alignItems(HorizontalAlign.Start)
      .layoutWeight(1)
      if (this.chip.length > 0) {
        SourceToolChip({ label: this.chip, tone: this.tone })
          .margin({ left: 10 })
      }
    }
    .width('100%')
    .constraintSize({ minHeight: 56 })
    .padding({ left: 12, right: 12, top: 10, bottom: 10 })
    .borderRadius(DemoAliasTokens.radiusMd)
    .backgroundColor(ColorTokens.floatingControlBg)
    .border({ width: 1, color: ColorTokens.border })
    .alignItems(VerticalAlign.Center)
  }
}

@Component
struct SourceToolActionButton {
  @Prop label: string = '';
  @Prop primary: boolean = false;
  @Prop warning: boolean = false;

  build() {
    Text(this.label)
      .fontSize(13)
      .fontWeight(850)
      .fontColor(this.primary || this.warning ? DemoAliasTokens.onPrimary : ColorTokens.primaryDark)
      .height(40)
      .layoutWeight(1)
      .textAlign(TextAlign.Center)
      .borderRadius(DemoAliasTokens.radiusPill)
      .backgroundColor(this.warning ? ColorTokens.accent : (this.primary ? ColorTokens.primary : ColorTokens.metaBg))
      .border({ width: this.primary || this.warning ? 0 : 1, color: ColorTokens.border })
  }
}

// Reused by routes whose historical demo had a screen, but whose Core command
// or Host transaction is intentionally not implemented by Harmony yet.
@Component
struct SourceCoreUnavailablePage {
  @Prop title: string = '';
  @Prop message: string = '';
  @Prop primaryLabel: string = '返回书源管理';
  @Prop primaryRoute: RouteId = 'source-management';

  build() {
    Column({ space: 10 }) {
      SourceToolCard({ title: this.title, subtitle: this.message, chip: '未接入', tone: 'warn' })
      SourceToolRow({
        title: '当前行为',
        detail: '不会展示演示书源、固定成功状态、伪造请求日志或未写入 Core 的规则。',
        chip: '真实状态',
        tone: 'soft',
      })
      SourceToolActionButton({ label: this.primaryLabel, primary: true })
        .onClick(() => ReaderUiStore.dispatch({ type: 'route-replace', id: this.primaryRoute }))
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}

// `source-switch-results` was an old static result route.  The actual live
// candidate path is SourceSwitchFlowPage; keep this route honest until its
// result DTO is made persistent in Harmony state.
@Component
export struct SourceSwitchResultsPanel {
  @Prop title: string = '换源预览';
  @Prop message: string = '换源预览';

  build() {
    SourceCoreUnavailablePage({
      title: `${this.title}未接入`,
      message: `${this.message}。该历史路由没有携带当前书籍和 Core 返回的候选 DTO。请从书籍详情重新进入实时换源流程，不显示固定候选书源。`,
      primaryLabel: '进入实时换源',
      primaryRoute: 'source-switch',
    })
  }
}

@Component
export struct SourceImportPreviewPage {
  @StorageProp('reader.sourceImportOrigin') origin: string = '';
  @StorageProp('reader.sourceImportTotal') total: number = 0;
  @StorageProp('reader.sourceImportImported') imported: number = 0;
  @StorageProp('reader.sourceImportSkipped') skipped: number = 0;
  @StorageProp('reader.sourceImportFailed') failed: number = 0;
  @StorageProp('reader.sourceImportMessage') message: string = '';
  @StorageProp('reader.sourceImportRunning') running: boolean = false;

  build() {
    Column({ space: 8 }) {
      SourceToolCard({
        title: this.running ? '书源导入中' : '书源导入结果',
        subtitle: this.origin.length > 0 ? this.origin : '尚未提交书源包',
        chip: this.running ? '处理中' : `共 ${this.total} 项`,
        tone: this.failed > 0 ? 'warn' : 'filled',
      })
      SourceToolSectionTitle({ title: 'Core 返回的逐项统计' })
        .margin({ top: 14, bottom: 8 })
      SourceToolRow({ title: '已导入', detail: 'Core 返回 imported = true 的书源数', chip: `${this.imported}`, tone: 'filled' })
      SourceToolRow({ title: '已跳过', detail: '缺少 bookSourceName 或 Core 未标记导入的对象', chip: `${this.skipped}`, tone: 'soft' })
      SourceToolRow({ title: '失败', detail: 'Core 拒绝或请求失败的书源数', chip: `${this.failed}`, tone: this.failed > 0 ? 'warn' : 'soft' })
      if (this.message.length > 0) {
        SourceToolRow({
          title: this.failed > 0 ? '处理详情' : '导入说明',
          detail: this.message,
          chip: this.failed > 0 ? '需处理' : '完成',
          tone: this.failed > 0 ? 'warn' : 'soft',
        })
      }
      Row() {
        SourceToolActionButton({ label: '继续导入' })
          .onClick(() => ReaderUiStore.dispatch({ type: 'route-replace', id: 'source-import-options' }))
        SourceToolActionButton({ label: '返回书源管理', primary: true })
          .margin({ left: 10 })
          .onClick(() => ReaderUiStore.dispatch({ type: 'route-replace', id: 'source-management' }))
      }
      .width('100%')
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}

@Component
export struct SourceGroupsPage {
  build() {
    SourceCoreUnavailablePage({
      title: '书源分组未接入',
      message: '当前 Harmony 未接入可持久化的 Core 书源分组 CRUD / 批量移动契约，因此不会显示或修改演示分组。',
    })
  }
}

@Component
export struct SourceDetectPage {
  @StorageProp('reader.sourceCheckSourceId') sourceId: string = '';
  @StorageProp('reader.sourceCheckSourceName') sourceName: string = '';
  @StorageProp('reader.sourceCheckLoading') loading: boolean = false;
  @StorageProp('reader.sourceCheckLoaded') loaded: boolean = false;
  @StorageProp('reader.sourceCheckMessage') message: string = '';
  @StorageProp('reader.sourceCheckError') errorMessage: string = '';
  @StorageProp('reader.sourceCheckResult') result: CoreSourceCheckResult | null = null;

  private sourceLabel(): string {
    if (this.sourceName.length > 0 && this.sourceId.length > 0) return `${this.sourceName} · ${this.sourceId}`;
    if (this.sourceName.length > 0) return this.sourceName;
    return this.sourceId;
  }

  private resultSummary(): string {
    if (this.result === null) return '';
    if (this.result.available) {
      return `Core 已返回 L1–L5 全部通过 verdict · ${this.result.durationMs}ms`;
    }
    const levels = this.result.levelsPassed.length > 0 ? this.result.levelsPassed.join('、') : '无';
    return `Core 返回未通过 verdict · 已通过：${levels} · ${this.result.durationMs}ms`;
  }

  private retry(): void {
    ReaderUiStore.dispatch({ type: 'source-detect-run' });
  }

  private levelIndex(level: string): number {
    if (level === 'L1') return 1;
    if (level === 'L2') return 2;
    if (level === 'L3') return 3;
    if (level === 'L4') return 4;
    if (level === 'L5') return 5;
    return 0;
  }

  private passed(level: string): boolean {
    if (this.result === null) return false;
    for (let i = 0; i < this.result.levelsPassed.length; i++) {
      if (this.result.levelsPassed[i] === level) return true;
    }
    return false;
  }

  private failedLevel(): string {
    if (this.result === null) return '';
    const reason = this.result.failureReason;
    const levels: string[] = ['L1', 'L2', 'L3', 'L4', 'L5'];
    for (let i = 0; i < levels.length; i++) {
      if (reason.indexOf(`${levels[i]}:`) === 0) return levels[i];
    }
    return '';
  }

  private stageChip(level: string): string {
    if (this.passed(level)) return '通过';
    const failed = this.failedLevel();
    if (failed === level) return '失败';
    if (failed.length > 0 && this.levelIndex(level) > this.levelIndex(failed)) return '未执行';
    return '未完成';
  }

  private stageTone(level: string): string {
    if (this.passed(level)) return 'filled';
    if (this.failedLevel() === level) return 'warn';
    return 'soft';
  }

  private stageDetail(level: string): string {
    if (this.result === null) return '';
    if (this.passed(level)) return 'Core 返回该阶段通过 verdict。';
    const failed = this.failedLevel();
    if (failed === level) return this.result.failureReason;
    if (failed.length > 0 && this.levelIndex(level) > this.levelIndex(failed)) {
      return `未执行：Core 在 ${failed} 失败后停止后续诊断链。`;
    }
    if (this.result.failureReason.length > 0) {
      return `Core 未返回该阶段通过 verdict：${this.result.failureReason}`;
    }
    return 'Core 未返回该阶段的通过 verdict。';
  }

  build() {
    Column({ space: 10 }) {
      if (this.loading) {
        SourceToolCard({
          title: '正在运行 Core 书源诊断',
          subtitle: this.message.length > 0
            ? this.message
            : 'Core 正通过 Host http.execute 依次检查 L1–L5；网络或规则失败会返回真实失败 verdict。',
          chip: '处理中',
          tone: 'soft',
        })
      } else if (this.errorMessage.length > 0) {
        SourceToolCard({ title: '书源诊断失败', subtitle: this.errorMessage, chip: '失败', tone: 'warn' })
        SourceToolActionButton({ label: '重新运行诊断', primary: true })
          .onClick(() => this.retry())
      } else if (this.result !== null) {
        SourceToolCard({
          title: this.sourceLabel().length > 0 ? this.sourceLabel() : this.result.sourceId,
          subtitle: this.resultSummary(),
          chip: this.result.available ? '通过' : '未通过',
          tone: this.result.available ? 'filled' : 'warn',
        })
        SourceToolSectionTitle({ title: 'Core L1–L5 真实诊断结果' })
          .margin({ top: 4, bottom: 0 })
        SourceToolRow({
          title: 'L1 · 书源存在性',
          detail: this.stageDetail('L1'),
          chip: this.stageChip('L1'),
          tone: this.stageTone('L1'),
        })
        SourceToolRow({
          title: 'L2 · 搜索',
          detail: this.stageDetail('L2'),
          chip: this.stageChip('L2'),
          tone: this.stageTone('L2'),
        })
        SourceToolRow({
          title: 'L3 · 详情',
          detail: this.stageDetail('L3'),
          chip: this.stageChip('L3'),
          tone: this.stageTone('L3'),
        })
        SourceToolRow({
          title: 'L4 · 目录',
          detail: this.stageDetail('L4'),
          chip: this.stageChip('L4'),
          tone: this.stageTone('L4'),
        })
        SourceToolRow({
          title: 'L5 · 正文',
          detail: this.stageDetail('L5'),
          chip: this.stageChip('L5'),
          tone: this.stageTone('L5'),
        })
        if (!this.result.available && this.result.failureReason.length > 0) {
          SourceToolRow({
            title: '失败原因',
            detail: this.result.failureReason,
            chip: 'Core verdict',
            tone: 'warn',
          })
        }
        if (this.message.length > 0) {
          SourceToolRow({ title: '说明', detail: this.message, chip: '诊断链', tone: 'soft' })
        }
        SourceToolActionButton({ label: '重新运行真实诊断', primary: true })
          .onClick(() => this.retry())
      } else if (this.loaded && this.sourceId.length > 0) {
        SourceToolCard({
          title: 'Core 未返回诊断结果',
          subtitle: this.message.length > 0
            ? this.message
            : '本次诊断没有返回当前书源的真实 verdict；请重新运行。',
          chip: '未完成',
          tone: 'warn',
        })
        Row() {
          SourceToolActionButton({ label: '重新运行诊断' })
            .onClick(() => this.retry())
          SourceToolActionButton({ label: '返回书源管理', primary: true })
            .margin({ left: 10 })
            .onClick(() => ReaderUiStore.dispatch({ type: 'route-replace', id: 'source-management' }))
        }
        .width('100%')
      } else {
        SourceToolCard({
          title: '未选择有效书源',
          subtitle: this.message.length > 0 ? this.message : '请先从由 Core source.list 返回的书源中打开详情页。',
          chip: '空状态',
          tone: 'warn',
        })
        SourceToolActionButton({ label: '前往书源管理', primary: true })
          .onClick(() => ReaderUiStore.dispatch({ type: 'route-replace', id: 'source-management' }))
      }
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}

@Component
struct SourceDebugSourceChoice {
  @Prop title: string = '';
  @Prop subtitle: string = '';
  @Prop selected: boolean = false;
  onSelect: () => void = () => {};

  build() {
    Row() {
      Column() {
        Text(this.title)
          .fontSize(13)
          .fontWeight(850)
          .fontColor(ColorTokens.ink)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
        Text(this.subtitle)
          .fontSize(11)
          .fontColor(ColorTokens.muted)
          .margin({ top: 4 })
          .maxLines(2)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
      }
      .layoutWeight(1)
      .alignItems(HorizontalAlign.Start)
      SourceToolChip({ label: this.selected ? '已选择' : '启用', tone: this.selected ? 'filled' : 'soft' })
        .margin({ left: 10 })
    }
    .width('100%')
    .padding({ left: 12, right: 12, top: 10, bottom: 10 })
    .borderRadius(DemoAliasTokens.radiusMd)
    .backgroundColor(this.selected ? ColorTokens.metaBg : DemoAliasTokens.surface)
    .border({ width: 1, color: this.selected ? ColorTokens.primary : ColorTokens.border })
    .alignItems(VerticalAlign.Center)
    .onClick(() => this.onSelect())
  }
}

@Component
export struct SourceDebugPage {
  @StorageProp('reader.availableSources') sources: CoreSourceEntry[] = [];
  @StorageProp('reader.sourcesLoaded') sourcesLoaded: boolean = false;
  @StorageProp('reader.selectedSourceId') selectedSourceId: string = '';
  @StorageProp('reader.sourceDebugMessage') message: string = '';
  @StorageProp('reader.sourceDebugError') errorMessage: string = '';

  private enabledSources(): CoreSourceEntry[] {
    const result: CoreSourceEntry[] = [];
    for (let i = 0; i < this.sources.length; i++) {
      if (this.sources[i].enabled) result.push(this.sources[i]);
    }
    return result;
  }

  private selectedEnabled(): boolean {
    const enabled = this.enabledSources();
    for (let i = 0; i < enabled.length; i++) {
      if (enabled[i].sourceId === this.selectedSourceId) return true;
    }
    return false;
  }

  private choose(sourceId: string): void {
    ReaderUiStore.dispatch({ type: 'source-debug-select', sourceId });
  }

  private run(): void {
    if (!this.selectedEnabled()) return;
    ReaderUiStore.dispatch({ type: 'source-debug-run' });
    ReaderUiStore.dispatch({ type: 'route-push', id: 'source-debug-running' });
  }

  build() {
    Column({ space: 10 }) {
      SourceToolCard({
        title: '真实书源调测',
        subtitle: '选择一个由 Core source.list 返回且处于启用状态的书源。Core source.check.run 通过 Host 执行真实请求；只有带诊断注解的响应才会在内存中短暂重放给 Core source.debug。',
        chip: 'Core + Host',
        tone: 'soft',
      })
      if (!this.sourcesLoaded) {
        SourceToolCard({
          title: '正在读取 Core 书源',
          subtitle: '尚未收到 source.list 的真实列表，不显示演示书源。',
          chip: '加载中',
          tone: 'soft',
        })
      } else if (this.enabledSources().length === 0) {
        SourceToolCard({
          title: '没有可调测的启用书源',
          subtitle: '请先导入并启用至少一个 Core 书源；停用书源不会被调测。',
          chip: '空状态',
          tone: 'warn',
        })
        SourceToolActionButton({ label: '前往书源管理', primary: true })
          .onClick(() => ReaderUiStore.dispatch({ type: 'route-replace', id: 'source-management' }))
      } else {
        SourceToolSectionTitle({ title: '选择启用书源' })
        ForEach(this.enabledSources(), (source: CoreSourceEntry, index: number) => {
          SourceDebugSourceChoice({
            title: source.name,
            subtitle: `${source.baseUrl.length > 0 ? source.baseUrl : source.sourceId} · ${source.sourceId}`,
            selected: source.sourceId === this.selectedSourceId,
            onSelect: () => this.choose(source.sourceId),
          })
            .margin({ top: index === 0 ? 0 : 2 })
        })
        if (this.selectedEnabled()) {
          SourceToolRow({
            title: '响应处理边界',
            detail: '原始正文只保留到本次 Core source.debug 回放结束；页面仅显示结构化日志、最终状态、耗时与阶段状态。L4/L5 多页会明确标为有限回放。',
            chip: '不持久化',
            tone: 'soft',
          })
          SourceToolActionButton({ label: '运行真实调测', primary: true })
            .onClick(() => this.run())
        } else {
          SourceToolRow({
            title: '尚未选择书源',
            detail: '请选择上方一个启用书源后再开始；不会自动挑选或使用固定演示源。',
            chip: '需选择',
            tone: 'warn',
          })
        }
      }
      if (this.errorMessage.length > 0) {
        SourceToolRow({ title: '上次调测错误', detail: this.errorMessage, chip: '失败', tone: 'warn' })
      } else if (this.message.length > 0) {
        SourceToolRow({ title: '调测状态', detail: this.message, chip: '状态', tone: 'soft' })
      }
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}

@Component
export struct SourceDebugRunningPage {
  @StorageProp('reader.sourceDebugSourceId') sourceId: string = '';
  @StorageProp('reader.sourceDebugSourceName') sourceName: string = '';
  @StorageProp('reader.sourceDebugLoading') loading: boolean = false;
  @StorageProp('reader.sourceDebugLoaded') loaded: boolean = false;
  @StorageProp('reader.sourceDebugMessage') message: string = '';
  @StorageProp('reader.sourceDebugError') errorMessage: string = '';
  @StorageProp('reader.sourceDebugResult') result: CoreSourceDebugResult | null = null;

  private sourceLabel(): string {
    if (this.sourceName.length > 0 && this.sourceId.length > 0) return `${this.sourceName} · ${this.sourceId}`;
    return this.sourceId.length > 0 ? this.sourceId : '尚未选择书源';
  }

  private retry(): void {
    ReaderUiStore.dispatch({ type: 'source-debug-run' });
  }

  build() {
    Column({ space: 10 }) {
      if (this.loading) {
        SourceToolCard({
          title: this.sourceLabel(),
          subtitle: this.message.length > 0
            ? this.message
            : '正在运行 Core L1–L5 真实诊断并收集带 traceId/sourceId 注解的 Host 完成结果。',
          chip: '调测中',
          tone: 'soft',
        })
        SourceToolRow({
          title: '隐私与顺序',
          detail: '阶段来自 Core diagnostic.stage，不按网络到达顺序推断。原始响应正文不写入 AppStorage、文件或日志。',
          chip: '隔离',
          tone: 'soft',
        })
      } else if (this.errorMessage.length > 0) {
        SourceToolCard({ title: '真实调测请求失败', subtitle: this.errorMessage, chip: '失败', tone: 'warn' })
        SourceToolActionButton({ label: '重新运行调测', primary: true })
          .onClick(() => this.retry())
      } else if (this.result !== null) {
        SourceToolCard({
          title: '调测已结束',
          subtitle: this.message.length > 0 ? this.message : '已收到本次真实调测的结构化投影。',
          chip: this.result.sourceCheck !== null && this.result.sourceCheck.available ? '查看结果' : '未通过',
          tone: this.result.sourceCheck !== null && this.result.sourceCheck.available ? 'filled' : 'warn',
        })
        SourceToolActionButton({ label: '查看结构化结果', primary: true })
          .onClick(() => ReaderUiStore.dispatch({ type: 'route-replace', id: 'source-debug-result' }))
      } else {
        SourceToolCard({
          title: '调测未开始',
          subtitle: this.message.length > 0 ? this.message : '没有正在运行或已完成的真实 source.debug transaction。',
          chip: this.loaded ? '未完成' : '空状态',
          tone: 'warn',
        })
        SourceToolActionButton({ label: '返回选择书源', primary: true })
          .onClick(() => ReaderUiStore.dispatch({ type: 'route-replace', id: 'source-debug' }))
      }
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}

@Component
export struct SourceDebugResultPage {
  @Prop variant: string = 'search';
  @StorageProp('reader.sourceDebugLoading') loading: boolean = false;
  @StorageProp('reader.sourceDebugMessage') message: string = '';
  @StorageProp('reader.sourceDebugError') errorMessage: string = '';
  @StorageProp('reader.sourceDebugResult') result: CoreSourceDebugResult | null = null;

  private moduleName(): string {
    if (this.variant === 'detail') return '详情';
    if (this.variant === 'catalog') return '目录';
    return '搜索';
  }

  private stepName(): string {
    if (this.variant === 'detail') return 'detail';
    if (this.variant === 'catalog') return 'toc';
    return 'search';
  }

  private visibleLogs(): CoreSourceDebugLog[] {
    const rows: CoreSourceDebugLog[] = [];
    if (this.result === null) return rows;
    const step = this.stepName();
    for (let i = 0; i < this.result.logs.length; i++) {
      const log = this.result.logs[i];
      if (log.step === step) rows.push(log);
    }
    return rows;
  }

  private stageChip(stage: CoreSourceDebugStage): string {
    if (stage.failed) return 'Host 失败';
    if (stage.requestCount === 0) return '未请求';
    if (stage.responseCount === 0) return '无响应';
    return stage.statusCode > 0 ? `HTTP ${stage.statusCode}` : '已记录';
  }

  private stageDetail(stage: CoreSourceDebugStage): string {
    if (stage.failed) return stage.failureMessage;
    if (stage.responseCount === 0 && stage.requestCount > 0) return 'Host 未完成可记录响应；请以 Core L1–L5 verdict 为准。';
    if (stage.replayLimited) return `已收集 ${stage.responseCount} 份响应；当前 DTO 只选择一份进行有限回放。`;
    if (stage.responseCount > 0) return '已记录真实 Host 完成状态；HTTP 状态本身不等同于规则解析通过。';
    return 'Core 未为该阶段发出可记录的诊断请求。';
  }

  private resultChip(): string {
    if (this.result === null || this.result.sourceCheck === null || !this.result.sourceCheck.available) return '未通过';
    if (this.result.sourceDebugError.length > 0) return '回放失败';
    if (this.result.finalState === 1000) return 'Core 完成';
    if (this.result.finalState === -1) return 'Core 错误';
    return '未确认';
  }

  private resultTone(): string {
    if (this.result === null || this.result.sourceCheck === null || !this.result.sourceCheck.available ||
      this.result.sourceDebugError.length > 0 || this.result.finalState === -1) return 'warn';
    return this.result.finalState === 1000 ? 'filled' : 'soft';
  }

  private logDetail(log: CoreSourceDebugLog): string {
    const details: string[] = [`${log.timestampMs}ms`];
    if (log.rule.length > 0) details.push(`规则：${log.rule}`);
    if (log.extractedCount >= 0) details.push(`提取：${log.extractedCount}`);
    if (log.errorKind.length > 0) details.push(`类型：${log.errorKind}`);
    return details.join(' · ');
  }

  build() {
    Column({ space: 10 }) {
      if (this.loading) {
        SourceToolCard({ title: '调测仍在运行', subtitle: this.message, chip: '处理中', tone: 'soft' })
        SourceToolActionButton({ label: '查看运行状态', primary: true })
          .onClick(() => ReaderUiStore.dispatch({ type: 'route-replace', id: 'source-debug-running' }))
      } else if (this.errorMessage.length > 0) {
        SourceToolCard({ title: '调测请求失败', subtitle: this.errorMessage, chip: '失败', tone: 'warn' })
        SourceToolActionButton({ label: '返回重新选择', primary: true })
          .onClick(() => ReaderUiStore.dispatch({ type: 'route-replace', id: 'source-debug' }))
      } else if (this.result === null) {
        SourceToolCard({
          title: `${this.moduleName()}调测结果尚不可用`,
          subtitle: this.message.length > 0 ? this.message : '没有本次 transaction 的 Core source.debug 结构化结果，不显示静态解析字段。',
          chip: '空状态',
          tone: 'warn',
        })
        SourceToolActionButton({ label: '开始真实调测', primary: true })
          .onClick(() => ReaderUiStore.dispatch({ type: 'route-replace', id: 'source-debug' }))
      } else {
        SourceToolCard({
          title: `${this.moduleName()}调测 · ${this.result.sourceId}`,
          subtitle: this.message.length > 0 ? this.message : 'Core 返回的本次结构化调测投影。',
          chip: this.resultChip(),
          tone: this.resultTone(),
        })
        if (this.result.sourceCheck === null) {
          SourceToolRow({
            title: 'L1–L5 verdict 缺失',
            detail: this.result.sourceCheckError.length > 0 ? this.result.sourceCheckError : 'Core 未返回可验证 verdict；不会把回放日志当成成功。',
            chip: '未验证',
            tone: 'warn',
          })
        } else {
          SourceToolRow({
            title: 'Core L1–L5 真实诊断',
            detail: this.result.sourceCheck.available
              ? `全部通过 · ${this.result.sourceCheck.durationMs}ms`
              : `未通过：${this.result.sourceCheck.failureReason}`,
            chip: this.result.sourceCheck.available ? '通过' : '未通过',
            tone: this.result.sourceCheck.available ? 'filled' : 'warn',
          })
        }
        SourceToolSectionTitle({ title: '带注解 Host 阶段状态' })
        ForEach(this.result.stages, (stage: CoreSourceDebugStage, index: number) => {
          SourceToolRow({
            title: `${stage.stage} · ${stage.stage === 'L2' ? '搜索' : (stage.stage === 'L3' ? '详情' : (stage.stage === 'L4' ? '目录' : '正文'))}`,
            detail: this.stageDetail(stage),
            chip: this.stageChip(stage),
            tone: stage.failed ? 'warn' : 'soft',
          })
            .margin({ top: index === 0 ? 0 : 2 })
        })
        if (this.result.replayNotice.length > 0) {
          SourceToolRow({ title: '回放范围', detail: this.result.replayNotice, chip: this.result.replayLimited ? '有限' : '单份', tone: this.result.replayLimited ? 'warn' : 'soft' })
        }
        if (this.result.sourceDebugError.length > 0) {
          SourceToolRow({ title: 'Core source.debug', detail: this.result.sourceDebugError, chip: '失败', tone: 'warn' })
        } else {
          SourceToolRow({
            title: 'Core source.debug 终态',
            detail: this.result.replayAttempted
              ? `finalState = ${this.result.finalState} · ${this.result.durationMs}ms`
              : '未调用：没有可重放的 L2 真实响应。',
            chip: this.result.replayAttempted ? '结构化' : '未回放',
            tone: this.result.replayAttempted ? 'soft' : 'warn',
          })
        }
        SourceToolSectionTitle({ title: `${this.moduleName()}结构化日志` })
        if (this.visibleLogs().length === 0) {
          SourceToolRow({
            title: '该模块没有结构化日志',
            detail: 'Core 未输出该步骤的日志，或该步骤未执行；不使用演示 INFO / ERROR 补齐。',
            chip: '空',
            tone: 'soft',
          })
        } else {
          ForEach(this.visibleLogs(), (log: CoreSourceDebugLog, index: number) => {
            SourceToolRow({
              title: log.message,
              detail: this.logDetail(log),
              chip: `${log.state}`,
              tone: log.state === -1 ? 'warn' : 'soft',
            })
              .margin({ top: index === 0 ? 0 : 2 })
          })
        }
        Row() {
          SourceToolActionButton({ label: '重新选择书源' })
            .onClick(() => ReaderUiStore.dispatch({ type: 'route-replace', id: 'source-debug' }))
          SourceToolActionButton({ label: '正文结构日志', primary: true })
            .margin({ left: 10 })
            .onClick(() => ReaderUiStore.dispatch({ type: 'route-push', id: 'source-debug-content-log' }))
        }
        .width('100%')
      }
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}

@Component
export struct SourceDebugContentLogPage {
  @StorageProp('reader.sourceDebugLoading') loading: boolean = false;
  @StorageProp('reader.sourceDebugMessage') message: string = '';
  @StorageProp('reader.sourceDebugError') errorMessage: string = '';
  @StorageProp('reader.sourceDebugResult') result: CoreSourceDebugResult | null = null;

  private contentLogs(): CoreSourceDebugLog[] {
    const logs: CoreSourceDebugLog[] = [];
    if (this.result === null) return logs;
    for (let i = 0; i < this.result.logs.length; i++) {
      if (this.result.logs[i].step === 'content') logs.push(this.result.logs[i]);
    }
    return logs;
  }

  private detail(log: CoreSourceDebugLog): string {
    const details: string[] = [`${log.timestampMs}ms`];
    if (log.rule.length > 0) details.push(`规则：${log.rule}`);
    if (log.extractedCount >= 0) details.push(`提取：${log.extractedCount}`);
    if (log.errorKind.length > 0) details.push(`类型：${log.errorKind}`);
    return details.join(' · ');
  }

  build() {
    Column({ space: 10 }) {
      if (this.loading) {
        SourceToolCard({ title: '正文调测仍在运行', subtitle: this.message, chip: '处理中', tone: 'soft' })
      } else if (this.errorMessage.length > 0) {
        SourceToolCard({ title: '正文调测不可用', subtitle: this.errorMessage, chip: '失败', tone: 'warn' })
      } else if (this.result === null) {
        SourceToolCard({
          title: '没有正文调测 transaction',
          subtitle: this.message.length > 0 ? this.message : '请先运行一次真实书源调测；本页不会显示持久原文或静态日志。',
          chip: '空状态',
          tone: 'warn',
        })
      } else {
        SourceToolCard({
          title: `正文结构化日志 · ${this.result.sourceId}`,
          subtitle: '仅展示 Core source.debug 返回的结构化 log 字段；不会展示或缓存 Host 响应正文。',
          chip: this.result.finalState === -1 ? 'Core 错误' : '结构化',
          tone: this.result.finalState === -1 ? 'warn' : 'soft',
        })
        if (this.contentLogs().length === 0) {
          SourceToolRow({
            title: 'Core 没有输出正文结构日志',
            detail: '正文阶段可能未执行、没有响应或 Core 没有生成该步骤日志；不以虚构日志代替。',
            chip: '空',
            tone: 'soft',
          })
        } else {
          ForEach(this.contentLogs(), (log: CoreSourceDebugLog, index: number) => {
            SourceToolRow({
              title: log.message,
              detail: this.detail(log),
              chip: `${log.state}`,
              tone: log.state === -1 ? 'warn' : 'soft',
            })
              .margin({ top: index === 0 ? 0 : 2 })
          })
        }
        if (this.result.replayLimited) {
          SourceToolRow({ title: '分页回放限制', detail: this.result.replayNotice, chip: '有限', tone: 'warn' })
        }
      }
      SourceToolActionButton({ label: '返回调测结果', primary: true })
        .onClick(() => ReaderUiStore.dispatch({ type: 'route-pop' }))
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}

@Component
export struct SourceCodeViewPage {
  build() {
    SourceCoreUnavailablePage({
      title: '诊断源码查看未接入',
      message: '真实调测的 Host 响应正文只在内存中短暂提供给 Core source.debug，回放后立即清除；本页不持久化或展示原文/HTML。',
    })
  }
}

@Component
export struct SourceLogsPage {
  build() {
    SourceCoreUnavailablePage({
      title: '书源错误日志未接入',
      message: 'Core 没有向该页面提供持久化的书源诊断日志集合；Harmony 不会用历史演示错误替代真实日志。',
    })
  }
}

@Component
export struct SourceDeleteConfirmPage {
  @StorageProp('reader.availableSources') sources: CoreSourceEntry[] = [];
  @StorageProp('reader.selectedSourceId') selectedSourceId: string = '';

  private selectedSource(): CoreSourceEntry | null {
    for (let i = 0; i < this.sources.length; i++) {
      if (this.sources[i].sourceId === this.selectedSourceId) return this.sources[i];
    }
    return null;
  }

  private confirmDelete(): void {
    const source = this.selectedSource();
    if (source === null) return;
    // This is the sole UI grant for Core source.delete. Normal source rows
    // only enter this route via source-delete-request.
    ReaderUiStore.dispatch({ type: 'source-delete-confirm' });
  }

  build() {
    if (this.selectedSource() === null) {
      SourceCoreUnavailablePage({
        title: '未选择有效书源',
        message: '该书源已被删除或未由 Core source.list 返回，不能执行删除操作。',
      })
    } else {
      Column({ space: 10 }) {
        SourceToolCard({
          title: `删除“${this.selectedSource()!.name}”？`,
          subtitle: `sourceId: ${this.selectedSource()!.sourceId}。确认后才会调用 Core source.delete；不会删除书架书籍。`,
          chip: '谨慎操作',
          tone: 'warn',
        })
        SourceToolRow({
          title: '删除范围',
          detail: '仅删除当前由 Core 返回且已选择的一条书源，不会使用固定的多选数量。',
          chip: '1 条',
          tone: 'soft',
        })
        Row() {
          SourceToolActionButton({ label: '取消' })
            .onClick(() => ReaderUiStore.dispatch({ type: 'route-pop' }))
          SourceToolActionButton({ label: '删除', warning: true })
            .margin({ left: 10 })
            .onClick(() => this.confirmDelete())
        }
        .width('100%')
      }
      .width('100%')
      .alignItems(HorizontalAlign.Start)
    }
  }
}

@Component
export struct SourceRuleEditPage {
  @Prop title: string = '规则编辑';
  @Prop variant: string = 'edit';

  private unavailableMessage(): string {
    if (this.variant === 'debug') {
      return '当前没有可验证的 Core 规则编辑 DTO；调测结果只能读取，不能从此页伪造规则修改或保存成功。';
    }
    return '当前没有完整的 Core source-update / 规则编辑契约和保存结果 DTO。为避免“保存成功”假象，本页不显示或修改固定规则。';
  }

  private unavailableTitle(): string {
    // Source-rule editing is outside typed Slice 10 TxtTocRule CRUD. Keep the
    // exact fail-closed capability name visible instead of constructing an
    // ambiguous title from the fixture-provided heading.
    return this.variant === 'debug' ? `${this.title}未接入` : '书源规则编辑未接入';
  }

  build() {
    SourceCoreUnavailablePage({
      title: this.unavailableTitle(),
      message: this.unavailableMessage(),
    })
  }
}

@Component
export struct SourceBatchPage {
  build() {
    SourceCoreUnavailablePage({
      title: '书源批量启停未接入',
      message: 'Harmony 尚未接入可验证的 Core 批量启停、批量检测和分组操作契约，因此不会展示静态源列表或执行伪批量成功。',
    })
  }
}
