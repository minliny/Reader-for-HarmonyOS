import { registerReaderFonts } from '../common/ReaderFonts';
import { PageBackBar } from '../common/PageBackBar';
import { ReaderToggle } from '../common/ReaderToggle';
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
import type { BookSource, RuleSubscription, SourceDebugLog } from './SourceGateway';
import { type SourceToolsSnapshot, EMPTY_SOURCE_TOOLS_SNAPSHOT } from './SourceToolsOrchestrator';

@Component
export struct SourceToolsPage {
  @Prop snapshot: SourceToolsSnapshot = EMPTY_SOURCE_TOOLS_SNAPSHOT;
  onBack: () => void = (): void => {};
  onExportAll: () => void = (): void => {};
  onOpenEditor: (sourceId: string) => void = (_sourceId: string): void => {};
  onEditorDraftChanged: (text: string) => void = (_text: string): void => {};
  onSaveEditor: () => void = (): void => {};
  onCancelEditor: () => void = (): void => {};
  onDebugKeyChanged: (value: string) => void = (_value: string): void => {};
  onDebugSource: (sourceId: string) => void = (_sourceId: string): void => {};
  onPutSubscription: (name: string, url: string, autoUpdate: boolean) => void =
    (_name: string, _url: string, _autoUpdate: boolean): void => {};
  onDeleteSubscription: (id: number) => void = (_id: number): void => {};
  @State private subscriptionName: string = '';
  @State private subscriptionUrl: string = '';
  @State private subscriptionAutoUpdate: boolean = false;

  aboutToAppear(): void {
    registerReaderFonts(this.getUIContext().getFont());
  }

  build() {
    Column() {
      PageBackBar({ title: '书源产品工具', onBack: (): void => this.onBack() });
      Scroll() {
        Column({ space: TOK_SPACE_MD }) {
          this.statusCard();
          this.exportCard();
          this.sourceCard();
          if (this.snapshot.editorSourceId.length > 0) {
            this.editorCard();
          }
          this.debugCard();
          this.subscriptionCard();
        }
        .width('100%')
        .padding({ left: TOK_SCREEN_INSET, right: TOK_SCREEN_INSET, top: TOK_SPACE_XS, bottom: TOK_SPACE_MD });
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
  private statusCard() {
    Text(this.snapshot.statusMessage.length > 0 ? this.snapshot.statusMessage : '所有规则与持久化均由 Rust Core 负责')
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
      this.actionButton('导出全部书源', true, (): void => this.onExportAll());
    }
    .width('100%')
    .padding(TOK_SPACE_SM)
    .backgroundColor(TOK_SURFACE_SOLID)
    .border({ width: TOK_BORDER_W, color: TOK_BORDER })
    .borderRadius(10);
  }

  @Builder
  private sourceCard() {
    Column({ space: TOK_SPACE_XS }) {
      this.heading(`书源编辑（${this.snapshot.sources.length}）`);
      ForEach(this.snapshot.sources, (source: BookSource) => {
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
          this.smallButton('编辑', (): void => this.onOpenEditor(source.sourceId));
          this.smallButton('调试', (): void => this.onDebugSource(source.sourceId));
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
      TextInput({ text: this.snapshot.debugKey, placeholder: '关键词；++URL 从目录开始，--URL 从正文开始' })
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
  private subscriptionCard() {
    Column({ space: TOK_SPACE_SM }) {
      this.heading(`规则订阅（${this.snapshot.subscriptions.length}）`);
      TextInput({ text: this.subscriptionName, placeholder: '订阅名称' })
        .width('100%').height(40)
        .backgroundColor(TOK_PAPER)
        .border({ width: TOK_BORDER_W, color: TOK_BORDER })
        .borderRadius(8)
        .padding({ left: TOK_SPACE_SM, right: TOK_SPACE_SM })
        .onChange((value: string): void => { this.subscriptionName = value; });
      TextInput({ text: this.subscriptionUrl, placeholder: 'https://example.com/rules.json' })
        .width('100%').height(40)
        .backgroundColor(TOK_PAPER)
        .border({ width: TOK_BORDER_W, color: TOK_BORDER })
        .borderRadius(8)
        .padding({ left: TOK_SPACE_SM, right: TOK_SPACE_SM })
        .onChange((value: string): void => { this.subscriptionUrl = value; });
      Row() {
        Text('自动更新标记')
          .layoutWeight(1)
          .fontFamily('ReaderNotoSansSC')
          .fontSize(12)
          .fontColor(TOK_INK);
        ReaderToggle({
          value: this.subscriptionAutoUpdate,
          onToggle: (): void => { this.subscriptionAutoUpdate = !this.subscriptionAutoUpdate; },
        });
      }
      .width('100%')
      .height(40);
      this.actionButton('保存规则订阅', true, (): void => {
        this.onPutSubscription(this.subscriptionName, this.subscriptionUrl, this.subscriptionAutoUpdate);
      });
      Text('本批只接入 Core 规则订阅实体 CRUD；订阅 URL 拉取/合并尚未声明通过。')
        .width('100%')
        .fontFamily('ReaderNotoSansSC')
        .fontSize(10)
        .lineHeight(16)
        .fontColor(TOK_MUTED);
      ForEach(this.snapshot.subscriptions, (subscription: RuleSubscription) => {
        Row({ space: TOK_SPACE_XS }) {
          Column({ space: 3 }) {
            Text(subscription.name)
              .width('100%')
              .fontFamily('ReaderNotoSansSC')
              .fontWeight(FontWeight.Bold)
              .fontSize(12)
              .fontColor(TOK_INK)
              .maxLines(1);
            Text(subscription.url)
              .width('100%')
              .fontFamily('ReaderInter')
              .fontSize(10)
              .fontColor(TOK_MUTED)
              .maxLines(1)
              .textOverflow({ overflow: TextOverflow.Ellipsis });
          }
          .layoutWeight(1)
          .alignItems(HorizontalAlign.Start);
          this.smallButton('删除', (): void => this.onDeleteSubscription(subscription.id));
        }
        .width('100%')
        .height(56)
        .border({ width: { top: TOK_BORDER_W }, color: TOK_BORDER });
      }, (subscription: RuleSubscription): string => `rule-sub-${subscription.id}`);
    }
    .width('100%')
    .padding(TOK_SPACE_SM)
    .backgroundColor(TOK_SURFACE_SOLID)
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
  private smallButton(label: string, action: () => void) {
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
      .onClick(action);
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
}
