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
import { type SourceToolsSnapshot, EMPTY_SOURCE_TOOLS_SNAPSHOT } from './SourceToolsOrchestrator';

@Component
export struct SourceToolsPage {
  @StorageLink('readerWindowMetricsRevision') private readerWindowMetricsRevision: number = 0;
  @Prop snapshot: SourceToolsSnapshot = EMPTY_SOURCE_TOOLS_SNAPSHOT;
  onBack: () => void = (): void => {};
  onExportAll: () => void = (): void => {};
  onExportSelected: (sourceIds: string[]) => void = (_sourceIds: string[]): void => {};
  onCheckSelected: (sourceIds: string[]) => void = (_sourceIds: string[]): void => {};
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

  aboutToAppear(): void {
    registerReaderFonts(this.getUIContext().getFont());
  }

  build() {
    Column() {
      PageBackBar({ title: '批量管理与书源工具', onBack: (): void => this.onBack() });
      Scroll() {
        Column({ space: TOK_SPACE_MD }) {
          this.statusCard();
          this.exportCard();
          ForEach([this.snapshot.statusMessage], (_renderKey: string) => {
            this.batchCard(this.snapshot);
            this.sourceCard(this.snapshot);
          }, (renderKey: string): string => `source-tools-cards-${renderKey}`);
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
      .scrollBar(BarState.Off);
    }
    .width('100%')
    .height('100%')
    .backgroundColor(TOK_PAPER);
  }

  @Builder
  private batchCard(snapshot: SourceToolsSnapshot) {
    Column({ space: TOK_SPACE_SM }) {
      this.heading(`批量管理（已选 ${snapshot.selectedSourceCount}/${snapshot.sources.length}）`);
      Row({ space: TOK_SPACE_XS }) {
        this.actionButton('全选', false, (): void => this.onSelectAll());
        this.actionButton('清空', false, (): void => this.onClearSelection());
        this.actionButton('导出所选', false, (): void => this.onExportSelected(snapshot.selectedSourceIds));
      }
      .width('100%');
      Row({ space: TOK_SPACE_XS }) {
        this.actionButton('检测所选', false, (): void => this.onCheckSelected(snapshot.selectedSourceIds));
        this.actionButton('启用', false, (): void => this.onSetSelectedEnabled(snapshot.selectedSourceIds, true));
        this.actionButton('停用', false, (): void => this.onSetSelectedEnabled(snapshot.selectedSourceIds, false));
        this.actionButton('删除', false, (): void => this.onDeleteSelected(snapshot.selectedSourceIds));
      }
      .width('100%');
      Text('批量操作复用 source.export / source.check.run / source.update / source.delete；删除由系统确认框二次确认。')
        .width('100%')
        .fontFamily('ReaderNotoSansSC')
        .fontSize(10)
        .lineHeight(16)
        .fontColor(TOK_MUTED);
    }
    .width('100%')
    .padding(TOK_SPACE_SM)
    .backgroundColor(TOK_SURFACE_SOLID)
    .border({ width: TOK_BORDER_W, color: TOK_BORDER })
    .borderRadius(10);
  }

  @Builder
  private statusCard() {
    Text(this.snapshot.statusMessage.length > 0 ? this.snapshot.statusMessage : '书源规则与持久化均由 Rust Core 负责')
      .width('100%')
      .fontFamily('ReaderNotoSansSC')
      .fontSize(12)
      .lineHeight(18)
      .fontColor(this.snapshot.busy ? TOK_PRIMARY_DARK : TOK_MUTED)
      .padding(TOK_SPACE_SM)
      .backgroundColor(TOK_SURFACE_PANEL_SOFT)
      .border({ width: TOK_BORDER_W, color: TOK_BORDER })
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
        .fontColor(TOK_MUTED);
      this.fullWidthActionButton('导出全部书源', true, (): void => this.onExportAll());
    }
    .width('100%')
    .padding(TOK_SPACE_SM)
    .backgroundColor(TOK_SURFACE_SOLID)
    .border({ width: TOK_BORDER_W, color: TOK_BORDER })
    .borderRadius(10);
  }

  @Builder
  private sourceCard(snapshot: SourceToolsSnapshot) {
    Column({ space: TOK_SPACE_XS }) {
      this.heading(`书源编辑（${snapshot.sources.length}）`);
      ForEach(snapshot.sources, (source: BookSource) => {
        Row({ space: TOK_SPACE_XS }) {
          Column({ space: 3 }) {
            Text(source.name)
              .width('100%')
              .fontFamily('ReaderNotoSansSC')
              .fontSize(12)
              .fontWeight(FontWeight.Bold)
              .fontColor(TOK_INK)
              .maxLines(1)
              .textOverflow({ overflow: TextOverflow.Ellipsis });
            Text(source.baseUrl)
              .width('100%')
              .fontFamily('ReaderInter')
              .fontSize(10)
              .fontColor(TOK_MUTED)
              .maxLines(1)
              .textOverflow({ overflow: TextOverflow.Ellipsis });
          }
          .layoutWeight(1)
          .alignItems(HorizontalAlign.Start);
          this.smallButton(this.isSelected(source.sourceId, snapshot.selectedSourceIds) ? '已选' : '选择',
            !snapshot.busy,
            (): void => this.onToggleSelection(source.sourceId));
          this.smallButton('编辑', !snapshot.busy, (): void => this.onOpenEditor(source.sourceId));
          this.smallButton('调试', !snapshot.busy, (): void => this.onDebugSource(source.sourceId));
        }
        .width('100%')
        .height(58)
        .padding({ left: TOK_SPACE_XS, right: TOK_SPACE_XS })
        .border({ width: { bottom: TOK_BORDER_W }, color: TOK_BORDER });
      }, (source: BookSource): string => `source-tool-${source.sourceId}`);
    }
    .width('100%')
    .padding(TOK_SPACE_SM)
    .backgroundColor(TOK_CARD_BG)
    .border({ width: TOK_BORDER_W, color: TOK_BORDER })
    .borderRadius(10);
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
        .fontColor(TOK_MUTED);
      TextArea({ text: this.snapshot.editorText, placeholder: 'BookSource JSON' })
        .width('100%')
        .height(320)
        .fontFamily('monospace')
        .fontSize(11)
        .fontColor(TOK_INK)
        .backgroundColor(TOK_PAPER)
        .border({ width: TOK_BORDER_W, color: TOK_BORDER })
        .borderRadius(8)
        .padding(TOK_SPACE_XS)
        .onChange((value: string): void => this.onEditorDraftChanged(value));
      Row({ space: TOK_SPACE_XS }) {
        this.actionButton('取消', false, (): void => this.onCancelEditor());
        this.actionButton('校验并保存', true, (): void => this.onSaveEditor());
      }
      .width('100%');
    }
    .width('100%')
    .padding(TOK_SPACE_SM)
    .backgroundColor(TOK_SURFACE_SOLID)
    .border({ width: TOK_BORDER_W, color: TOK_BORDER })
    .borderRadius(10);
  }

  @Builder
  private debugCard() {
    Column({ space: TOK_SPACE_SM }) {
      this.heading('书源调试');
      TextInput({ text: this.snapshot.debugKey, placeholder: '检测关键词（留空时使用 Core 默认“我的”）' })
        .width('100%')
        .height(40)
        .fontFamily('ReaderNotoSansSC')
        .fontSize(12)
        .fontColor(TOK_INK)
        .backgroundColor(TOK_PAPER)
        .border({ width: TOK_BORDER_W, color: TOK_BORDER })
        .borderRadius(8)
        .padding({ left: TOK_SPACE_SM, right: TOK_SPACE_SM })
        .onChange((value: string): void => this.onDebugKeyChanged(value));
      if (this.snapshot.debugSourceId.length > 0) {
        Text(`当前：${this.snapshot.debugSourceId}`)
          .width('100%')
          .fontFamily('ReaderInter')
          .fontSize(11)
          .fontColor(TOK_MUTED);
      }
      ForEach(this.snapshot.debugLogs, (log: SourceDebugLog, index: number) => {
        Text(`${index + 1}. [${log.state}] ${log.message}`)
          .width('100%')
          .fontFamily('monospace')
          .fontSize(10)
          .lineHeight(16)
          .fontColor(log.state === -1 ? '#A8584D' : TOK_INK);
      }, (log: SourceDebugLog, index: number): string => `debug-${index}-${log.timestampMs}-${log.state}`);
    }
    .width('100%')
    .padding(TOK_SPACE_SM)
    .backgroundColor(TOK_CARD_BG)
    .border({ width: TOK_BORDER_W, color: TOK_BORDER })
    .borderRadius(10);
  }

  @Builder
  private heading(value: string) {
    Text(value)
      .width('100%')
      .fontFamily('ReaderNotoSansSC')
      .fontWeight(FontWeight.Bold)
      .fontSize(14)
      .fontColor(TOK_INK);
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
      .fontColor(TOK_PRIMARY_DARK)
      .backgroundColor(TOK_SURFACE_PANEL_SOFT)
      .border({ width: TOK_BORDER_W, color: TOK_BORDER })
      .borderRadius(7)
      .opacity(enabled ? 1 : 0.62)
      .onClick((): void => {
        if (enabled) {
          action();
        }
      });
  }

  @Builder
  private actionButton(label: string, primary: boolean, action: () => void) {
    Text(label)
      .layoutWeight(1)
      .height(42)
      .textAlign(TextAlign.Center)
      .fontFamily('ReaderNotoSansSC')
      .fontWeight(FontWeight.Bold)
      .fontSize(12)
      .fontColor(primary ? TOK_ON_PRIMARY : TOK_PRIMARY_DARK)
      .backgroundColor(primary ? TOK_PRIMARY_DARK : TOK_SURFACE_PANEL_SOFT)
      .border({ width: TOK_BORDER_W, color: primary ? TOK_PRIMARY_DARK : TOK_BORDER })
      .borderRadius(8)
      .opacity(this.snapshot.busy ? 0.62 : 1)
      .onClick((): void => {
        if (!this.snapshot.busy) {
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
      .fontColor(primary ? TOK_ON_PRIMARY : TOK_PRIMARY_DARK)
      .backgroundColor(primary ? TOK_PRIMARY_DARK : TOK_SURFACE_PANEL_SOFT)
      .border({ width: TOK_BORDER_W, color: primary ? TOK_PRIMARY_DARK : TOK_BORDER })
      .borderRadius(8)
      .opacity(this.snapshot.busy ? 0.62 : 1)
      .onClick((): void => {
        if (!this.snapshot.busy) {
          action();
        }
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

  private isSelected(sourceId: string, selectedSourceIds: string[]): boolean {
    return selectedSourceIds.indexOf(sourceId) >= 0;
  }

}
