import { readerAppColor } from '../common/ReaderThemeRegistry';
import { ReaderWindowCoordinator } from '../../app/ReaderWindowCoordinator';
import { registerReaderFonts } from '../common/ReaderFonts';
import { PageBackBar } from '../common/PageBackBar';
import {
  SurfaceHorizontalFrame,
  SurfaceWidthSpec,
  resolveHorizontalFrame,
} from '../common/SurfaceHorizontalGeometry';
import { readerVisualSafeLeft, readerVisualSafeRight } from '../common/ReaderWindowMetrics';
import {
  TOK_BORDER,
  TOK_BORDER_W,
  TOK_CARD_BG,
  TOK_INK,
  TOK_MUTED,
  TOK_ON_PRIMARY,
  TOK_PAPER,
  TOK_PRIMARY_DARK,
  TOK_SCREEN_INSET,
  TOK_SPACE_CONTROL_INLINE,
  TOK_SPACE_MD,
  TOK_SPACE_SM,
  TOK_SPACE_XS,
  TOK_SURFACE_PANEL_SOFT,
  TOK_SURFACE_SOLID,
} from '../common/ReaderTokens';
import type { BookSource, SourceDebugLog } from './SourceGateway';
import {
  type SourceBatchCheckProgress,
  type SourceBatchCheckResult,
  type SourceToolsSnapshot,
  EMPTY_SOURCE_TOOLS_SNAPSHOT,
} from './SourceToolsOrchestrator';

class SourceToolListRow {
  readonly source: BookSource;
  readonly selected: boolean;
  readonly actionsEnabled: boolean;

  constructor(source: BookSource, selected: boolean, actionsEnabled: boolean) {
    this.source = source;
    this.selected = selected;
    this.actionsEnabled = actionsEnabled;
  }
}

class SourceToolListDataSource implements IDataSource {
  private items: SourceToolListRow[] = [];
  private listeners: DataChangeListener[] = [];

  totalCount(): number {
    return this.items.length;
  }

  getData(index: number): SourceToolListRow {
    return this.items[index];
  }

  registerDataChangeListener(listener: DataChangeListener): void {
    if (this.listeners.indexOf(listener) < 0) {
      this.listeners.push(listener);
    }
  }

  unregisterDataChangeListener(listener: DataChangeListener): void {
    const index = this.listeners.indexOf(listener);
    if (index >= 0) {
      this.listeners.splice(index, 1);
    }
  }

  replace(sources: BookSource[], selectedSourceIds: string[], actionsEnabled: boolean): void {
    const selected = new Set<string>();
    for (const sourceId of selectedSourceIds) {
      selected.add(sourceId);
    }
    const next: SourceToolListRow[] = [];
    for (const source of sources) {
      next.push(new SourceToolListRow(source, selected.has(source.sourceId), actionsEnabled));
    }
    this.items = next;
    for (const listener of this.listeners) {
      listener.onDataReloaded();
    }
  }
}

class SourceCheckResultDataSource implements IDataSource {
  private items: SourceBatchCheckResult[] = [];
  private listeners: DataChangeListener[] = [];

  totalCount(): number {
    return this.items.length;
  }

  getData(index: number): SourceBatchCheckResult {
    return this.items[index];
  }

  registerDataChangeListener(listener: DataChangeListener): void {
    if (this.listeners.indexOf(listener) < 0) {
      this.listeners.push(listener);
    }
  }

  unregisterDataChangeListener(listener: DataChangeListener): void {
    const index = this.listeners.indexOf(listener);
    if (index >= 0) {
      this.listeners.splice(index, 1);
    }
  }

  replace(items: SourceBatchCheckResult[]): void {
    this.items = items.slice();
    for (const listener of this.listeners) {
      listener.onDataReloaded();
    }
  }
}

class SourceDebugLogDataSource implements IDataSource {
  private items: SourceDebugLog[] = [];
  private listeners: DataChangeListener[] = [];

  totalCount(): number {
    return this.items.length;
  }

  getData(index: number): SourceDebugLog {
    return this.items[index];
  }

  registerDataChangeListener(listener: DataChangeListener): void {
    if (this.listeners.indexOf(listener) < 0) {
      this.listeners.push(listener);
    }
  }

  unregisterDataChangeListener(listener: DataChangeListener): void {
    const index = this.listeners.indexOf(listener);
    if (index >= 0) {
      this.listeners.splice(index, 1);
    }
  }

  replace(items: SourceDebugLog[]): void {
    this.items = items.slice();
    for (const listener of this.listeners) {
      listener.onDataReloaded();
    }
  }
}

@Component
export struct SourceToolsPage {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';

  @StorageLink('readerWindowMetricsRevision') private readerWindowMetricsRevision: number = 0;
  @Prop @Watch('onSnapshotChanged') snapshot: SourceToolsSnapshot = EMPTY_SOURCE_TOOLS_SNAPSHOT;
  onBack: () => void = (): void => {};
  onExportAll: () => void = (): void => {};
  onExportSelected: (sourceIds: string[]) => void = (_sourceIds: string[]): void => {};
  onCheckSelected: (sourceIds: string[]) => void = (_sourceIds: string[]): void => {};
  onStopCheck: () => void = (): void => {};
  onSetSelectedEnabled: (sourceIds: string[], enabled: boolean) => void =
    (_sourceIds: string[], _enabled: boolean): void => {};
  onDeleteSelected: (sourceIds: string[]) => void = (_sourceIds: string[]): void => {};
  onOpenEditor: (sourceId: string) => void = (_sourceId: string): void => {};
  onEditorDraftChanged: (text: string) => void = (_text: string): void => {};
  onSaveEditor: () => void = (): void => {};
  onCancelEditor: () => void = (): void => {};
  onDebugKeyChanged: (value: string) => void = (_value: string): void => {};
  onDebugSource: (sourceId: string) => void = (_sourceId: string): void => {};
  onSelectAll: () => void = (): void => {};
  onClearSelection: () => void = (): void => {};
  onToggleSelection: (sourceId: string) => void = (_sourceId: string): void => {};
  private readonly sourceDataSource: SourceToolListDataSource = new SourceToolListDataSource();
  private readonly batchResultDataSource: SourceCheckResultDataSource = new SourceCheckResultDataSource();
  private readonly debugLogDataSource: SourceDebugLogDataSource = new SourceDebugLogDataSource();
  private projectedSourceListRevision: number = -1;
  private projectedSelectionRevision: number = -1;
  private projectedBusy: boolean = false;
  private projectedBatchResultsIdentity: string = '';
  private projectedDebugLogsIdentity: string = '';

  aboutToAppear(): void {
    registerReaderFonts(this.getUIContext().getFont());
    this.projectedSourceListRevision = -1;
    this.projectedSelectionRevision = -1;
    this.projectedBusy = !this.snapshot.busy;
    this.projectedBatchResultsIdentity = '';
    this.projectedDebugLogsIdentity = '';
    this.syncListDataSources();
  }

  build() {
    Column() {
      PageBackBar({ title: '批量管理与书源工具', onBack: (): void => this.onBack() });
      Scroll() {
        Column({ space: TOK_SPACE_MD }) {
          this.statusCard();
          this.exportCard();
          // V1 @Builder parameters are captured when the builder subtree is
          // mounted. Rebuild only this small controls card when its primitive
          // inputs change so enabled guards and selected IDs never remain at
          // the initial loading snapshot. The 1,777-row LazyForEach below is
          // deliberately outside this keyed subtree.
          ForEach([this.batchControlsRenderKey()], (_key: string) => {
            this.batchCard();
          }, (key: string): string => `source-batch-controls:${key}`);
          if (this.snapshot.batchCheck.phase !== 'idle') {
            // The progress card has the same V1 builder-capture boundary.
            // Its compact subtree is keyed independently so every source
            // completion updates counters/current item/results without
            // remounting the source catalog.
            ForEach([this.batchProgressRenderKey()], (_key: string) => {
              this.batchCheckCard();
            }, (key: string): string => `source-batch-progress:${key}`);
          }
          this.sourceCard();
          if (this.snapshot.editorSourceId.length > 0) {
            this.editorCard();
          }
          this.debugCard();
        }
        .width('100%')
        .padding({
          left: this.contentFrame().left,
          right: this.contentFrame().right,
          top: TOK_SPACE_XS,
          bottom: TOK_SPACE_MD,
        });
      }
      .layoutWeight(1)
      .width('100%')
      .align(Alignment.TopStart)
      .scrollBar(BarState.Off);
    }
    .width('100%')
    .height('100%')
    .backgroundColor(readerAppColor('TOK_PAPER', this.appThemeScheme));
  }

  @Builder
  private batchCard() {
    Column({ space: TOK_SPACE_SM }) {
      this.heading(`批量管理（已选 ${this.snapshot.selectedSourceCount}/${this.snapshot.sources.length}）`);
      Row({ space: TOK_SPACE_XS }) {
        this.actionButton('全选', false, !this.snapshot.busy, (): void => this.onSelectAll());
        this.actionButton('清空', false, !this.snapshot.busy && this.snapshot.selectedSourceCount > 0,
          (): void => this.onClearSelection());
        this.actionButton('导出所选', false,
          !this.snapshot.busy && this.snapshot.selectedSourceCount > 0,
          (): void => this.confirmExportThen((): void =>
            this.onExportSelected(this.snapshot.selectedSourceIds)));
      }
      .width('100%');
      Row({ space: TOK_SPACE_XS }) {
        if (this.snapshot.batchCheck.phase === 'running' || this.snapshot.batchCheck.phase === 'stopping') {
          this.actionButton(this.snapshot.batchCheck.phase === 'stopping' ? '停止中…' : '停止检测', false,
            this.snapshot.batchCheck.phase === 'running', (): void => this.onStopCheck());
        } else {
          this.actionButton('检测所选', false,
            !this.snapshot.busy && this.snapshot.selectedSourceCount > 0,
            (): void => this.onCheckSelected(this.snapshot.selectedSourceIds));
        }
        this.actionButton('启用', false,
          !this.snapshot.busy && this.snapshot.selectedSourceCount > 0,
          (): void => this.onSetSelectedEnabled(this.snapshot.selectedSourceIds, true));
        this.actionButton('停用', false,
          !this.snapshot.busy && this.snapshot.selectedSourceCount > 0,
          (): void => this.onSetSelectedEnabled(this.snapshot.selectedSourceIds, false));
        this.actionButton('删除', false,
          !this.snapshot.busy && this.snapshot.selectedSourceCount > 0,
          (): void => this.onDeleteSelected(this.snapshot.selectedSourceIds));
      }
      .width('100%');
      Text('批量操作复用 source.export / source.check.run / source.update / source.delete；删除由系统确认框二次确认。')
        .width('100%')
        .fontFamily('ReaderNotoSansSC')
        .fontSize(10)
        .lineHeight(16)
        .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme));
    }
    .width('100%')
    .padding(TOK_SPACE_SM)
    .backgroundColor(readerAppColor('TOK_SURFACE_SOLID', this.appThemeScheme))
    .border({ width: TOK_BORDER_W, color: readerAppColor('TOK_BORDER', this.appThemeScheme) })
    .borderRadius(10);
  }

  @Builder
  private batchCheckCard() {
    Column({ space: TOK_SPACE_SM }) {
      Row({ space: TOK_SPACE_XS }) {
        Text(`检测进度 ${this.snapshot.batchCheck.completed}/${this.snapshot.batchCheck.total}` +
          `（${this.batchCheckPercent(this.snapshot.batchCheck)}%）`)
          .layoutWeight(1)
          .fontFamily('ReaderNotoSansSC')
          .fontWeight(FontWeight.Bold)
          .fontSize(14)
          .fontColor(readerAppColor('TOK_INK', this.appThemeScheme));
        Text(this.batchCheckPhaseLabel(this.snapshot.batchCheck))
          .fontFamily('ReaderNotoSansSC')
          .fontSize(11)
          .fontWeight(FontWeight.Bold)
          .fontColor(this.snapshot.batchCheck.phase === 'failed' ? readerAppColor('app.SourceToolsPage.batchCheckCard.fontColor.FFA8584D', this.appThemeScheme) : readerAppColor('TOK_PRIMARY_TEXT', this.appThemeScheme));
      }
      .width('100%');
      Row() {
        Row()
          .width(`${this.batchCheckPercent(this.snapshot.batchCheck)}%`)
          .height(8)
          .backgroundColor(readerAppColor('TOK_PRIMARY_DARK', this.appThemeScheme))
          .borderRadius(4);
      }
      .width('100%')
      .height(8)
      .backgroundColor(readerAppColor('TOK_SURFACE_PANEL_SOFT', this.appThemeScheme))
      .borderRadius(4);
      if (this.snapshot.batchCheck.currentSourceName.length > 0) {
        Text(`当前 ${this.snapshot.batchCheck.currentIndex}/${this.snapshot.batchCheck.total}：` +
          `${this.snapshot.batchCheck.currentSourceName}（执行真实 L1–L5 检测）`)
          .width('100%')
          .fontFamily('ReaderNotoSansSC')
          .fontSize(11)
          .lineHeight(17)
          .fontColor(readerAppColor('TOK_INK', this.appThemeScheme))
          .maxLines(2)
          .textOverflow({ overflow: TextOverflow.Ellipsis });
      }
      Row({ space: TOK_SPACE_XS }) {
        this.batchCounter(`可用 ${this.snapshot.batchCheck.passed}`, readerAppColor('TOK_PRIMARY_DARK', this.appThemeScheme));
        this.batchCounter(`不可用 ${this.snapshot.batchCheck.failed}`, readerAppColor('app.SourceToolsPage.batchCheckCard.batchCounter.FFA8584D', this.appThemeScheme));
        this.batchCounter(`检测错误 ${this.snapshot.batchCheck.errors}`, readerAppColor('app.SourceToolsPage.batchCheckCard.batchCounter.FF9A6A1F', this.appThemeScheme));
        this.batchCounter(`剩余 ${Math.max(0,
          this.snapshot.batchCheck.total - this.snapshot.batchCheck.completed)}`, readerAppColor('TOK_MUTED', this.appThemeScheme));
      }
      .width('100%');
      if (this.snapshot.batchCheck.results.length === 0) {
        Text('每个书源完成后，结果会立即出现在这里。')
          .width('100%')
          .fontFamily('ReaderNotoSansSC')
          .fontSize(11)
          .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme));
      } else {
        Text('实时结果（最新在前）')
          .width('100%')
          .fontFamily('ReaderNotoSansSC')
          .fontSize(11)
          .fontWeight(FontWeight.Bold)
          .fontColor(readerAppColor('TOK_INK', this.appThemeScheme));
        List() {
          LazyForEach(this.batchResultDataSource, (result: SourceBatchCheckResult) => {
            ListItem() {
              this.batchResultRow(result);
            }
          }, (result: SourceBatchCheckResult): string =>
            `source-check-${result.sourceId}-${result.traceId}-${result.state}`);
        }
        .width('100%')
        .height(Math.min(320, Math.max(58, this.snapshot.batchCheck.results.length * 58)))
        .scrollBar(BarState.Off);
      }
    }
    .width('100%')
    .padding(TOK_SPACE_SM)
    .backgroundColor(readerAppColor('TOK_CARD_BG', this.appThemeScheme))
    .border({ width: TOK_BORDER_W, color: readerAppColor('TOK_BORDER', this.appThemeScheme) })
    .borderRadius(10);
  }

  @Builder
  private batchCounter(label: string, color: string) {
    Text(label)
      .layoutWeight(1)
      .height(32)
      .textAlign(TextAlign.Center)
      .fontFamily('ReaderNotoSansSC')
      .fontSize(11)
      .fontWeight(FontWeight.Bold)
      .fontColor(color)
      .backgroundColor(readerAppColor('TOK_SURFACE_PANEL_SOFT', this.appThemeScheme))
      .borderRadius(7);
  }

  @Builder
  private batchResultRow(result: SourceBatchCheckResult) {
    Row({ space: TOK_SPACE_XS }) {
      Column({ space: 3 }) {
        Text(result.sourceName)
          .width('100%')
          .fontFamily('ReaderNotoSansSC')
          .fontSize(12)
          .fontWeight(FontWeight.Bold)
          .fontColor(readerAppColor('TOK_INK', this.appThemeScheme))
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis });
        Text(result.message)
          .width('100%')
          .fontFamily('ReaderNotoSansSC')
          .fontSize(10)
          .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme))
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis });
      }
      .layoutWeight(1)
      .alignItems(HorizontalAlign.Start);
      Text(this.batchResultLabel(result))
        .fontFamily('ReaderNotoSansSC')
        .fontSize(11)
        .fontWeight(FontWeight.Bold)
        .fontColor(result.state === 'passed' ? readerAppColor('TOK_PRIMARY_TEXT', this.appThemeScheme) :
          (result.state === 'failed' ? readerAppColor('app.SourceToolsPage.batchResultRow.fontColor.FFA8584D', this.appThemeScheme) : readerAppColor('app.SourceToolsPage.batchResultRow.fontColor.FF9A6A1F', this.appThemeScheme)));
    }
    .width('100%')
    .height(58)
    .padding({ left: TOK_SPACE_XS, right: TOK_SPACE_XS })
    .border({ width: { bottom: TOK_BORDER_W }, color: readerAppColor('TOK_BORDER', this.appThemeScheme) });
  }

  @Builder
  private statusCard() {
    Text(this.snapshot.statusMessage.length > 0 ? this.snapshot.statusMessage : '书源规则与持久化均由 Rust Core 负责')
      .width('100%')
      .fontFamily('ReaderNotoSansSC')
      .fontSize(12)
      .lineHeight(18)
      .fontColor(this.snapshot.busy ? readerAppColor('TOK_PRIMARY_TEXT', this.appThemeScheme) : readerAppColor('TOK_MUTED', this.appThemeScheme))
      .padding(TOK_SPACE_SM)
      .backgroundColor(readerAppColor('TOK_SURFACE_PANEL_SOFT', this.appThemeScheme))
      .border({ width: TOK_BORDER_W, color: readerAppColor('TOK_BORDER', this.appThemeScheme) })
      .borderRadius(8);
  }

  @Builder
  private exportCard() {
    Column({ space: TOK_SPACE_SM }) {
      this.heading('书源导出');
      Text('Core 生成 Legado 兼容 JSON；Host 只通过系统文件选择器写入。')
        .width('100%')
        .fontFamily('ReaderNotoSansSC')
        .fontSize(11)
        .lineHeight(17)
        .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme));
      this.fullWidthActionButton('导出全部书源', true,
        (): void => this.confirmExportThen((): void => this.onExportAll()));
    }
    .width('100%')
    .padding(TOK_SPACE_SM)
    .backgroundColor(readerAppColor('TOK_SURFACE_SOLID', this.appThemeScheme))
    .border({ width: TOK_BORDER_W, color: readerAppColor('TOK_BORDER', this.appThemeScheme) })
    .borderRadius(10);
  }

  @Builder
  private sourceCard() {
    Column({ space: TOK_SPACE_XS }) {
      this.heading(`书源编辑（${this.snapshot.sources.length}）`);
      List() {
        LazyForEach(this.sourceDataSource, (row: SourceToolListRow) => {
          ListItem() {
            this.sourceRow(row);
          }
        }, (row: SourceToolListRow): string =>
          `source-tool-${row.source.sourceId}-${row.selected ? 1 : 0}-${row.actionsEnabled ? 1 : 0}`);
      }
      .width('100%')
      .height(Math.min(420, Math.max(58, this.snapshot.sources.length * 58)))
      .scrollBar(BarState.Off);
    }
    .width('100%')
    .padding(TOK_SPACE_SM)
    .backgroundColor(readerAppColor('TOK_CARD_BG', this.appThemeScheme))
    .border({ width: TOK_BORDER_W, color: readerAppColor('TOK_BORDER', this.appThemeScheme) })
    .borderRadius(10);
  }

  @Builder
  private sourceRow(row: SourceToolListRow) {
        Row({ space: TOK_SPACE_XS }) {
          Column({ space: 3 }) {
            Text(row.source.name)
              .width('100%')
              .fontFamily('ReaderNotoSansSC')
              .fontSize(12)
              .fontWeight(FontWeight.Bold)
              .fontColor(readerAppColor('TOK_INK', this.appThemeScheme))
              .maxLines(1)
              .textOverflow({ overflow: TextOverflow.Ellipsis });
            Text(row.source.baseUrl)
              .width('100%')
              .fontFamily('ReaderInter')
              .fontSize(10)
              .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme))
              .maxLines(1)
              .textOverflow({ overflow: TextOverflow.Ellipsis });
          }
          .layoutWeight(1)
          .alignItems(HorizontalAlign.Start);
          this.smallButton(row.selected ? '已选' : '选择', row.actionsEnabled,
            (): void => this.onToggleSelection(row.source.sourceId));
          this.smallButton('编辑', row.actionsEnabled, (): void => this.onOpenEditor(row.source.sourceId));
          this.smallButton('调试', row.actionsEnabled, (): void => this.onDebugSource(row.source.sourceId));
        }
        .width('100%')
        .height(58)
        .padding({ left: TOK_SPACE_XS, right: TOK_SPACE_XS })
        .border({ width: { bottom: TOK_BORDER_W }, color: readerAppColor('TOK_BORDER', this.appThemeScheme) });
  }

  @Builder
  private editorCard() {
    Column({ space: TOK_SPACE_SM }) {
      this.heading(`编辑：${this.snapshot.editorSourceId}`);
      Text('bookSourceUrl 是主键；本页不执行隐式迁移。保存时由 Core source.import 校验并持久化。')
        .width('100%')
        .fontFamily('ReaderNotoSansSC')
        .fontSize(11)
        .lineHeight(17)
        .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme));
      TextArea({ text: this.snapshot.editorText, placeholder: 'BookSource JSON' })
        .width('100%')
        .height(320)
        .fontFamily('monospace')
        .fontSize(11)
        .fontColor(readerAppColor('TOK_INK', this.appThemeScheme))
        .backgroundColor(readerAppColor('TOK_PAPER', this.appThemeScheme))
        .border({ width: TOK_BORDER_W, color: readerAppColor('TOK_BORDER', this.appThemeScheme) })
        .borderRadius(8)
        .padding(TOK_SPACE_XS)
        .onChange((value: string): void => this.onEditorDraftChanged(value));
      Row({ space: TOK_SPACE_XS }) {
        this.actionButton('取消', false, !this.snapshot.busy, (): void => this.onCancelEditor());
        this.actionButton('校验并保存', true, !this.snapshot.busy, (): void => this.onSaveEditor());
      }
      .width('100%');
    }
    .width('100%')
    .padding(TOK_SPACE_SM)
    .backgroundColor(readerAppColor('TOK_SURFACE_SOLID', this.appThemeScheme))
    .border({ width: TOK_BORDER_W, color: readerAppColor('TOK_BORDER', this.appThemeScheme) })
    .borderRadius(10);
  }

  @Builder
  private debugCard() {
    Column({ space: TOK_SPACE_SM }) {
      this.heading(this.snapshot.debugSourceId.length > 0 ? '最近一次检测详情' : '书源调试');
      TextInput({ text: this.snapshot.debugKey, placeholder: '检测关键词（留空时使用 Core 默认“我的”）' })
        .width('100%')
        .height(40)
        .fontFamily('ReaderNotoSansSC')
        .fontSize(12)
        .fontColor(readerAppColor('TOK_INK', this.appThemeScheme))
        .backgroundColor(readerAppColor('TOK_PAPER', this.appThemeScheme))
        .border({ width: TOK_BORDER_W, color: readerAppColor('TOK_BORDER', this.appThemeScheme) })
        .borderRadius(8)
        .padding({ left: TOK_SPACE_SM, right: TOK_SPACE_SM })
        .onChange((value: string): void => this.onDebugKeyChanged(value));
      if (this.snapshot.debugSourceId.length > 0) {
        Text(`检测对象：${this.snapshot.debugSourceId}`)
          .width('100%')
          .fontFamily('ReaderInter')
          .fontSize(11)
          .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme))
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis });
      }
      List() {
        LazyForEach(this.debugLogDataSource, (log: SourceDebugLog, index: number) => {
          ListItem() {
            this.debugLogRow(log, index);
          }
        }, (log: SourceDebugLog): string =>
          `debug-${log.sourceId ?? ''}-${log.traceId ?? ''}-${log.requestId ?? 0}-` +
            `${log.timestampMs}-${log.state}-${log.message}`);
      }
      .width('100%')
      .height(Math.min(360, Math.max(32, this.snapshot.debugLogs.length * 32)))
      .scrollBar(BarState.Off);
    }
    .width('100%')
    .padding(TOK_SPACE_SM)
    .backgroundColor(readerAppColor('TOK_CARD_BG', this.appThemeScheme))
    .border({ width: TOK_BORDER_W, color: readerAppColor('TOK_BORDER', this.appThemeScheme) })
    .borderRadius(10);
  }

  @Builder
  private debugLogRow(log: SourceDebugLog, index: number) {
        Text(`${index + 1}. [${log.state}] ${log.message}`)
          .width('100%')
          .fontFamily('monospace')
          .fontSize(10)
          .lineHeight(16)
          .fontColor(log.state === -1 ? readerAppColor('app.SourceToolsPage.debugLogRow.fontColor.FFA8584D', this.appThemeScheme) : readerAppColor('TOK_INK', this.appThemeScheme));
  }

  @Builder
  private heading(value: string) {
    Text(value)
      .width('100%')
      .fontFamily('ReaderNotoSansSC')
      .fontWeight(FontWeight.Bold)
      .fontSize(14)
      .fontColor(readerAppColor('TOK_INK', this.appThemeScheme));
  }

  @Builder
  private smallButton(label: string, enabled: boolean, action: () => void) {
    Text(label)
      .height(30)
      .padding({ left: TOK_SPACE_CONTROL_INLINE, right: TOK_SPACE_CONTROL_INLINE })
      .textAlign(TextAlign.Center)
      .fontFamily('ReaderNotoSansSC')
      .fontWeight(FontWeight.Bold)
      .fontSize(11)
      .fontColor(readerAppColor('TOK_PRIMARY_TEXT', this.appThemeScheme))
      .backgroundColor(readerAppColor('TOK_SURFACE_PANEL_SOFT', this.appThemeScheme))
      .border({ width: TOK_BORDER_W, color: readerAppColor('TOK_BORDER', this.appThemeScheme) })
      .borderRadius(7)
      .opacity(enabled ? 1 : 0.62)
      .onClick((): void => {
        if (enabled) {
          action();
        }
      });
  }

  @Builder
  private actionButton(label: string, primary: boolean, enabled: boolean, action: () => void) {
    Text(label)
      .layoutWeight(1)
      .height(42)
      .textAlign(TextAlign.Center)
      .fontFamily('ReaderNotoSansSC')
      .fontWeight(FontWeight.Bold)
      .fontSize(12)
      .fontColor(primary ? readerAppColor('TOK_ON_PRIMARY', this.appThemeScheme) : readerAppColor('TOK_PRIMARY_TEXT', this.appThemeScheme))
      .backgroundColor(primary ? readerAppColor('TOK_PRIMARY_DARK', this.appThemeScheme) : readerAppColor('TOK_SURFACE_PANEL_SOFT', this.appThemeScheme))
      .border({ width: TOK_BORDER_W, color: primary ? readerAppColor('TOK_PRIMARY_DARK', this.appThemeScheme) : readerAppColor('TOK_BORDER', this.appThemeScheme) })
      .borderRadius(8)
      .opacity(enabled ? 1 : 0.62)
      .onClick((): void => {
        if (enabled) {
          action();
        }
      });
  }

  @Builder
  private fullWidthActionButton(label: string, primary: boolean, action: () => void) {
    Text(label)
      .width('100%')
      .height(42)
      .textAlign(TextAlign.Center)
      .fontFamily('ReaderNotoSansSC')
      .fontWeight(FontWeight.Bold)
      .fontSize(12)
      .fontColor(primary ? readerAppColor('TOK_ON_PRIMARY', this.appThemeScheme) : readerAppColor('TOK_PRIMARY_TEXT', this.appThemeScheme))
      .backgroundColor(primary ? readerAppColor('TOK_PRIMARY_DARK', this.appThemeScheme) : readerAppColor('TOK_SURFACE_PANEL_SOFT', this.appThemeScheme))
      .border({ width: TOK_BORDER_W, color: primary ? readerAppColor('TOK_PRIMARY_DARK', this.appThemeScheme) : readerAppColor('TOK_BORDER', this.appThemeScheme) })
      .borderRadius(8)
      .opacity(this.snapshot.busy ? 0.62 : 1)
      .onClick((): void => {
        if (!this.snapshot.busy) {
          action();
        }
      });
  }

  /**
   * P2-10: exported Legado JSON keeps each source's static Cookie /
   * Authorization headers verbatim, so every export run first confirms the
   * credential exposure once, in the same system-dialog style the app uses
   * elsewhere (e.g. delete confirmation).
   */
  private confirmExportThen(action: () => void): void {
    this.getUIContext().showAlertDialog({
      title: '导出文件含登录凭据',
      message: '导出的书源 JSON 会原样保留 Cookie、Authorization 等登录凭据，' +
        '请勿转发给不可信的对象或公开渠道。是否继续导出？',
      autoCancel: true,
      primaryButton: {
        value: '继续导出',
        action: (): void => action(),
      },
      secondaryButton: {
        value: '取消',
        action: (): void => {},
      },
    });
  }

  private contentFrame(): SurfaceHorizontalFrame {
    if (this.readerWindowMetricsRevision < 0) {
      return new SurfaceHorizontalFrame(0, 0, 0);
    }
    const metrics = ReaderWindowCoordinator.metrics();
    return resolveHorizontalFrame(
      metrics.windowRect.width,
      readerVisualSafeLeft(metrics),
      readerVisualSafeRight(metrics),
      new SurfaceWidthSpec(metrics.windowRect.width, TOK_SCREEN_INSET, TOK_SCREEN_INSET),
    );
  }

  private onSnapshotChanged(): void {
    this.syncListDataSources();
  }

  private syncListDataSources(): void {
    if (this.projectedSourceListRevision !== this.snapshot.sourceListRevision ||
      this.projectedSelectionRevision !== this.snapshot.selectionRevision ||
      this.projectedBusy !== this.snapshot.busy) {
      this.sourceDataSource.replace(
        this.snapshot.sources,
        this.snapshot.selectedSourceIds,
        !this.snapshot.busy,
      );
      this.projectedSourceListRevision = this.snapshot.sourceListRevision;
      this.projectedSelectionRevision = this.snapshot.selectionRevision;
      this.projectedBusy = this.snapshot.busy;
    }

    const batchIdentity = this.batchResultsIdentity();
    if (batchIdentity !== this.projectedBatchResultsIdentity) {
      this.batchResultDataSource.replace(this.snapshot.batchCheck.results);
      this.projectedBatchResultsIdentity = batchIdentity;
    }

    const debugIdentity = this.debugLogsIdentity();
    if (debugIdentity !== this.projectedDebugLogsIdentity) {
      this.debugLogDataSource.replace(this.snapshot.debugLogs);
      this.projectedDebugLogsIdentity = debugIdentity;
    }
  }

  private batchResultsIdentity(): string {
    const results = this.snapshot.batchCheck.results;
    if (results.length === 0) {
      return '0';
    }
    const newest = results[0];
    return `${results.length}:${newest.sourceId}:${newest.traceId}:${newest.state}:${newest.message}`;
  }

  private batchControlsRenderKey(): string {
    return `${this.snapshot.selectionRevision}:${this.snapshot.selectedSourceCount}:` +
      `${this.snapshot.busy ? 1 : 0}:${this.snapshot.batchCheck.phase}`;
  }

  private batchProgressRenderKey(): string {
    const progress = this.snapshot.batchCheck;
    return `${progress.phase}:${progress.total}:${progress.completed}:${progress.passed}:` +
      `${progress.failed}:${progress.errors}:${progress.currentIndex}:${progress.currentSourceId}:` +
      `${this.batchResultsIdentity()}`;
  }

  private debugLogsIdentity(): string {
    const logs = this.snapshot.debugLogs;
    if (logs.length === 0) {
      return `0:${this.snapshot.debugSourceId}`;
    }
    const first = logs[0];
    const last = logs[logs.length - 1];
    return `${this.snapshot.debugSourceId}:${logs.length}:${first.timestampMs}:${last.timestampMs}:` +
      `${last.state}:${last.message}`;
  }

  private batchCheckPercent(progress: SourceBatchCheckProgress): number {
    if (progress.total <= 0) {
      return 0;
    }
    return Math.min(100, Math.max(0, Math.round(progress.completed * 100 / progress.total)));
  }

  private batchCheckPhaseLabel(progress: SourceBatchCheckProgress): string {
    switch (progress.phase) {
      case 'running': return '检测中';
      case 'stopping': return '停止中';
      case 'completed': return '已完成';
      case 'stopped': return '已停止';
      case 'failed': return '已中断';
      default: return '';
    }
  }

  private batchResultLabel(result: SourceBatchCheckResult): string {
    if (result.state === 'passed') {
      return '可用';
    }
    return result.state === 'failed' ? '不可用' : '检测错误';
  }

}
