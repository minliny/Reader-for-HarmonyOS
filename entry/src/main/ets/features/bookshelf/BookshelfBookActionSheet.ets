import { readerAppColor } from '../common/ReaderThemeRegistry';
import {
  TOK_BORDER,
  TOK_CARD_BG_HI,
  TOK_GREEN,
  TOK_INK,
  TOK_MUTED,
  TOK_PRIMARY_SOFT,
} from '../common/ReaderTokens';

const BOOK_ACTION_SHEET_HEIGHT = 270;
const BOOK_ACTION_INSET = 14;
const BOOK_ACTION_HEIGHT = 40;

/**
 * Per-book action surface. The host presents this content as a centered
 * opaque floating panel so its outline remains visible on every device.
 *
 * The action contents retain the Figma typography and spacing; the host-level
 * presentation follows the same horizontal inset as the shelf covers.
 */
@Component
export struct BookshelfBookActionSheet {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';

  onMultiSelect: () => void = (): void => {};
  onEditGroup: () => void = (): void => {};
  onBookInfo: () => void = (): void => {};
  onRemoveFromBookshelf: () => void = (): void => {};

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      Row() {
        Blank()
          .width(42)
          .height(4)
          .backgroundColor(readerAppColor('TOK_MUTED', this.appThemeScheme))
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
        .fontColor(readerAppColor('TOK_INK', this.appThemeScheme))
        .maxLines(1)
        .position({ x: BOOK_ACTION_INSET, y: 34 });

      this.actionSlot('多选', false, 70, (): void => this.onMultiSelect());
      this.actionSlot('书籍信息', false, 116, (): void => this.onBookInfo());
      this.actionSlot('编辑分组', false, 162, (): void => this.onEditGroup());
      this.actionSlot('移除书架', true, 208, (): void => this.onRemoveFromBookshelf());
    }
    .width('100%')
    .height(BOOK_ACTION_SHEET_HEIGHT)
    .backgroundColor(readerAppColor('TOK_CARD_BG_HI', this.appThemeScheme))
    .border({ width: 1, color: readerAppColor('TOK_BORDER', this.appThemeScheme) })
    .borderRadius({ topLeft: 24, topRight: 24, bottomLeft: 0, bottomRight: 0 })
    .shadow({ radius: 46, color: readerAppColor('app.BookshelfBookActionSheet.build.color.29594632', this.appThemeScheme), offsetX: 0, offsetY: 18 })
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
          .fontColor(danger ? readerAppColor('app.BookshelfBookActionSheet.actionSlot.fontColor.FFD7473E', this.appThemeScheme) : readerAppColor('TOK_GREEN', this.appThemeScheme))
          .maxLines(1);
      }
      .layoutWeight(1)
      .height(BOOK_ACTION_HEIGHT)
      .padding({ left: 12 })
      .alignItems(VerticalAlign.Center)
      .backgroundColor(danger ? readerAppColor('app.BookshelfBookActionSheet.actionSlot.backgroundColor.1AD6473D', this.appThemeScheme) : readerAppColor('TOK_PRIMARY_SOFT', this.appThemeScheme))
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
