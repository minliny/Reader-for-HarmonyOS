import {
  TOK_BORDER,
  TOK_CARD_BG_HI,
  TOK_GREEN,
  TOK_INK,
  TOK_MUTED,
  TOK_PRIMARY_SOFT,
} from '../common/ReaderTokens';

const BOOK_ACTION_SHEET_HEIGHT = 224;
const BOOK_ACTION_INSET = 14;
const BOOK_ACTION_HEIGHT = 40;

/**
 * Per-book action surface. The host presents this content as a centered
 * opaque floating panel so its outline remains visible on every device.
 *
 * The action contents retain the Figma typography and spacing; the host-level
 * presentation intentionally follows the product's new 75% width requirement.
 */
@Component
export struct BookshelfBookActionSheet {
  onMultiSelect: () => void = (): void => {};
  onBookInfo: () => void = (): void => {};
  onRemoveFromBookshelf: () => void = (): void => {};

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      Row() {
        Blank()
          .width(42)
          .height(4)
          .backgroundColor(TOK_MUTED)
          .borderRadius(999);
      }
      .width('100%')
      .height(4)
      .justifyContent(FlexAlign.Center)
      .position({ x: 0, y: 9 });

      Text('书籍操作')
        .fontFamily('ReaderNotoSansSC')
        .fontWeight(FontWeight.Bold)
        .fontSize(17)
        .lineHeight(20.4)
        .fontColor(TOK_INK)
        .maxLines(1)
        .position({ x: BOOK_ACTION_INSET, y: 34 });

      this.actionSlot('多选', false, 70, (): void => this.onMultiSelect());
      this.actionSlot('书籍信息', false, 116, (): void => this.onBookInfo());
      this.actionSlot('移除书架', true, 162, (): void => this.onRemoveFromBookshelf());
    }
    .width('100%')
    .height(BOOK_ACTION_SHEET_HEIGHT)
    .backgroundColor(TOK_CARD_BG_HI)
    .border({ width: 1, color: TOK_BORDER })
    .borderRadius(24)
    .shadow({ radius: 46, color: '#29594632', offsetX: 0, offsetY: 18 })
    .clip(true);
  }

  @Builder
  private actionSlot(label: string, danger: boolean, y: number, action: () => void) {
    Row() {
      Row() {
        Text(label)
          .fontFamily('ReaderNotoSansSC')
          .fontWeight(FontWeight.Bold)
          .fontSize(13)
          .lineHeight(15.6)
          .fontColor(danger ? '#D7473E' : TOK_GREEN)
          .maxLines(1);
      }
      .layoutWeight(1)
      .height(BOOK_ACTION_HEIGHT)
      .padding({ left: 12 })
      .alignItems(VerticalAlign.Center)
      .backgroundColor(danger ? '#1AD6473D' : TOK_PRIMARY_SOFT)
      .borderRadius(12)
      .accessibilityText(label)
      .onClick(action);
    }
    .width('100%')
    .height(BOOK_ACTION_HEIGHT)
    .padding({ left: BOOK_ACTION_INSET, right: BOOK_ACTION_INSET })
    .position({ x: 0, y });
  }
}
