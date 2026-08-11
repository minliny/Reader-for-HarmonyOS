import { PageBackBar } from '../common/PageBackBar';
import { ReaderToggle } from '../common/ReaderToggle';
import { registerReaderFonts } from '../common/ReaderFonts';
import {
  TOK_BORDER,
  TOK_BORDER_W,
  TOK_INK,
  TOK_MUTED,
  TOK_ON_PRIMARY,
  TOK_PAPER,
  TOK_PRIMARY_DARK,
  TOK_SCREEN_INSET,
  TOK_SPACE_MD,
  TOK_SPACE_SM,
  TOK_SPACE_XS,
  TOK_SURFACE_PANEL_SOFT,
  TOK_SURFACE_SOLID,
} from '../common/ReaderTokens';
import {
  type RssSubscriptionEditorSnapshot,
  EMPTY_RSS_EDITOR_SNAPSHOT,
} from './RssSubscriptionEditorOrchestrator';

@Component
export struct RssSubscriptionEditorPage {
  @Prop snapshot: RssSubscriptionEditorSnapshot = EMPTY_RSS_EDITOR_SNAPSHOT;
  onBack: () => void = (): void => {};
  onFeedUrlChanged: (value: string) => void = (_value: string): void => {};
  onTitleChanged: (value: string) => void = (_value: string): void => {};
  onEnabledChanged: (value: boolean) => void = (_value: boolean): void => {};
  onSave: () => void = (): void => {};

  aboutToAppear(): void {
    registerReaderFonts(this.getUIContext().getFont());
  }

  build() {
    Column() {
      PageBackBar({
        title: this.snapshot.mode === 'create' ? '新增 RSS 订阅' : '编辑 RSS 订阅',
        onBack: (): void => this.onBack(),
      });
      Scroll() {
        Column({ space: TOK_SPACE_MD }) {
          Text(this.snapshot.statusMessage)
            .width('100%')
            .fontFamily('ReaderNotoSansSC')
            .fontSize(12)
            .lineHeight(18)
            .fontColor(this.snapshot.busy ? TOK_PRIMARY_DARK : TOK_MUTED)
            .padding(TOK_SPACE_SM)
            .backgroundColor(TOK_SURFACE_PANEL_SOFT)
            .border({ width: TOK_BORDER_W, color: TOK_BORDER })
            .borderRadius(8);
          Column({ space: TOK_SPACE_MD }) {
            this.editorField('订阅名称', this.snapshot.title, '留空时由 Core 回退为 Feed URL',
              (value: string): void => this.onTitleChanged(value));
            this.editorField('Feed URL', this.snapshot.feedUrl, 'https://example.com/feed.xml',
              (value: string): void => this.onFeedUrlChanged(value));
            Row() {
              Column({ space: TOK_SPACE_XS }) {
                Text('启用订阅')
                  .fontFamily('ReaderNotoSansSC')
                  .fontWeight(FontWeight.Bold)
                  .fontSize(13)
                  .fontColor(TOK_INK);
                Text('刷新、解析、未读统计均由 Core 维护')
                  .fontFamily('ReaderNotoSansSC')
                  .fontSize(11)
                  .fontColor(TOK_MUTED);
              }
              .layoutWeight(1)
              .alignItems(HorizontalAlign.Start);
              ReaderToggle({
                value: this.snapshot.enabled,
                onToggle: (): void => this.onEnabledChanged(!this.snapshot.enabled),
              });
            }
            .width('100%')
            .height(60)
            .alignItems(VerticalAlign.Center);
            Text('保存')
              .width('100%')
              .height(44)
              .textAlign(TextAlign.Center)
              .fontFamily('ReaderNotoSansSC')
              .fontWeight(FontWeight.Bold)
              .fontSize(13)
              .fontColor(TOK_ON_PRIMARY)
              .backgroundColor(TOK_PRIMARY_DARK)
              .borderRadius(8)
              .opacity(this.snapshot.busy ? 0.62 : 1)
              .onClick((): void => {
                if (!this.snapshot.busy) {
                  this.onSave();
                }
              });
          }
          .width('100%')
          .padding(TOK_SPACE_MD)
          .backgroundColor(TOK_SURFACE_SOLID)
          .border({ width: TOK_BORDER_W, color: TOK_BORDER })
          .borderRadius(10);
          Text('规则型 RSS、排序/分组及导入导出属于后续独立 gate，本编辑器不伪造这些字段。')
            .width('100%')
            .fontFamily('ReaderNotoSansSC')
            .fontSize(10)
            .lineHeight(16)
            .fontColor(TOK_MUTED);
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
  private editorField(label: string, value: string, placeholder: string, onChange: (value: string) => void) {
    Column({ space: TOK_SPACE_XS }) {
      Text(label)
        .width('100%')
        .fontFamily('ReaderNotoSansSC')
        .fontWeight(FontWeight.Bold)
        .fontSize(13)
        .fontColor(TOK_INK);
      TextInput({ text: value, placeholder })
        .width('100%')
        .height(44)
        .fontFamily('ReaderNotoSansSC')
        .fontSize(12)
        .fontColor(TOK_INK)
        .backgroundColor(TOK_PAPER)
        .border({ width: TOK_BORDER_W, color: TOK_BORDER })
        .borderRadius(8)
        .padding({ left: TOK_SPACE_SM, right: TOK_SPACE_SM })
        .onChange(onChange);
    }
    .width('100%')
    .constraintSize({ minHeight: 60 });
  }
}
