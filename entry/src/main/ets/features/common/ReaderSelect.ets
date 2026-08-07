import { registerReaderFonts } from './ReaderFonts';
import {
  TOK_BORDER,
  TOK_BORDER_W,
  TOK_CONTROL_INK,
  TOK_FIELD_SURFACE,
  TOK_PRIMARY_DARK,
  TOK_SPACE_CONTROL_INLINE,
  TOK_SPACE_ROW_BLOCK,
  TOK_SURFACE_PANEL_SOFT,
} from '../common/ReaderTokens';


// 统一下拉表面（动效 1506:8807）：收起 = 已选高亮行(h36)，展开 = 全部选项(36×n)，
// 宽度随最长选项内容自适应，箭头收起↓/展开↑。Source/Sync/RSS/Settings 共用。
@Component
export struct ReaderSelect {
  @Prop value: string = '';
  @Prop options: string[] = [];
  @Prop isOpen: boolean = false;
  onToggle: () => void = (): void => {};
  onSelect: (option: string) => void = (_option: string): void => {};

  aboutToAppear(): void {
    registerReaderFonts(this.getUIContext().getFont());
  }

  build() {
    Column({ space: 0 }) {
      Row() {
        Text(this.value)
          .padding({ left: TOK_SPACE_CONTROL_INLINE, right: TOK_SPACE_CONTROL_INLINE })
          .fontFamily('ReaderNotoSansSC')
          .fontWeight(FontWeight.Bold)
          .fontSize(12)
          .fontColor(TOK_PRIMARY_DARK)
          .maxLines(1);
        Image($r('app.media.rss_chevron'))
          .width(12)
          .height(8)
          .margin({ left: TOK_SPACE_ROW_BLOCK })
          .rotate({ angle: this.isOpen ? 180 : 0 });
      }
      .width('100%')
      .height(36)
      .backgroundColor(TOK_SURFACE_PANEL_SOFT)
      .borderRadius(6)
      .alignItems(VerticalAlign.Center)
      .onClick((): void => this.onToggle());

      if (this.isOpen) {
        ForEach(this.options.filter((o: string): boolean => o !== this.value), (opt: string) => {
          Row() {
            Text(opt)
              .padding({ left: TOK_SPACE_CONTROL_INLINE, right: TOK_SPACE_CONTROL_INLINE })
              .fontFamily('ReaderNotoSansSC')
              .fontWeight(FontWeight.Regular)
              .fontSize(12)
              .fontColor(TOK_CONTROL_INK)
              .maxLines(1);
          }
          .width('100%')
          .height(36)
          .borderRadius(6)
          .alignItems(VerticalAlign.Center)
          .onClick((): void => this.onSelect(opt));
        }, (opt: string): string => `ropt-${opt}`);
      }
    }
    .width(this.selectWidth())
    .backgroundColor(TOK_FIELD_SURFACE)
    .border({ width: TOK_BORDER_W, color: TOK_BORDER })
    .borderRadius(6)
    .clip(true);
  }

  private selectWidth(): number {
    let maxLen = 0;
    for (const opt of this.options) {
      if (opt.length > maxLen) {
        maxLen = opt.length;
      }
    }
    return maxLen * 12 + 44;
  }
}
