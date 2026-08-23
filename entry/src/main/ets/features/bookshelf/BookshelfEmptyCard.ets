import { registerReaderFonts } from '../common/ReaderFonts';
import {
  TOK_BORDER,
  TOK_CARD_BG_HI,
  TOK_GREEN,
  TOK_INK,
  TOK_MUTED,
  TOK_PRIMARY_DARK,
  TOK_PRIMARY_SOFT,
  TOK_SPACE_CARD_PADDING,
  TOK_BORDER_W,
} from '../common/ReaderTokens';


/**
 * Figma `State/BookshelfEmpty` `286:31`, icon `Icon/Bookshelf` `271:96`,
 * rebuilt 2026-08-06 against the live node geometry. Single source for the
 * empty-shelf card, consumed by BookshelfEmptyPage so the two never drift.
 */
@Component
export struct BookshelfEmptyCard {
  @Prop cardWidth: number = 352;
  onImportRequested: () => void = (): void => {};
  onSearchRequested: () => void = (): void => {};

  aboutToAppear(): void {
    registerReaderFonts(this.getUIContext().getFont());
  }

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      // Rotated book placeholder (left, +8°): Figma 286:33
      Stack({ alignContent: Alignment.Center }) {
        Text('')
          .width(72)
          .height(52)
          .backgroundColor(TOK_CARD_BG_HI)
          .border({ width: TOK_BORDER_W, color: TOK_BORDER })
          .borderRadius(8)
          .rotate({ angle: 8 });
      }
      .width(78.536)
      .height(61.514)
      .position({ x: this.cardCenterX() - 58.24, y: 59 });

      // Rotated book placeholder (right, -8°): Figma 286:34
      Stack({ alignContent: Alignment.Center }) {
        Text('')
          .width(72)
          .height(52)
          .backgroundColor(TOK_CARD_BG_HI)
          .border({ width: TOK_BORDER_W, color: TOK_BORDER })
          .borderRadius(8)
          .rotate({ angle: -8 });
      }
      .width(78.536)
      .height(61.514)
      .position({ x: this.cardCenterX() - 23, y: 48.98 });

      // Library icon frame: Figma 286:35 (green primary-soft, r16, 32 icon)
      Stack({ alignContent: Alignment.Center }) {
        Image($r('app.media.bookshelf_empty_library')).width(32).height(32);
      }
      .width(62)
      .height(62)
      .backgroundColor(TOK_PRIMARY_SOFT)
      .border({ width: TOK_BORDER_W, color: TOK_GREEN })
      .borderRadius(16)
      .position({ x: this.cardCenterX() - 32, y: 35 });

      Text('书架还是空的')
        .width('100%')
        .fontFamily('ReaderNotoSansSC')
        .fontWeight(FontWeight.Bold)
        .fontSize(19)
        .fontColor(TOK_INK)
        .textAlign(TextAlign.Center)
        .position({ x: 0, y: 137 });

      Text('导入本地书籍或通过搜索加入书架。')
        .width('100%')
        .fontFamily('ReaderNotoSansSC')
        .fontWeight(FontWeight.Regular)
        .fontSize(13)
        .fontColor(TOK_MUTED)
        .textAlign(TextAlign.Center)
        .position({ x: 0, y: 173 });

      // Primary action — 导入本地书籍 (solid): Figma 286:144
      Stack({ alignContent: Alignment.Start }) {
        Text('导入本地书籍')
          .fontFamily('ReaderNotoSansSC')
          .fontWeight(FontWeight.Bold)
          .fontSize(13)
          .fontColor(TOK_CARD_BG_HI)
          .margin({ left: TOK_SPACE_CARD_PADDING });
      }
      .width(this.actionWidth())
      .height(52)
      .backgroundColor(TOK_GREEN)
      .borderRadius(12)
      .position({ x: 17, y: 219 })
      .onClick((): void => this.onImportRequested());

      // Secondary action — 搜索并加入书架 (outlined): Figma 286:146
      Stack({ alignContent: Alignment.Start }) {
        Text('搜索并加入书架')
          .fontFamily('ReaderNotoSansSC')
          .fontWeight(FontWeight.Bold)
          .fontSize(13)
          .fontColor(TOK_PRIMARY_DARK)
          .margin({ left: 13 });
      }
      .width(this.actionWidth())
      .height(52)
      .backgroundColor(TOK_PRIMARY_SOFT)
      .border({ width: TOK_BORDER_W, color: TOK_GREEN })
      .borderRadius(12)
      .position({ x: 17, y: 281 })
      .onClick((): void => this.onSearchRequested());
    }
    .width(this.cardWidth)
    .height(350)
    .backgroundColor(TOK_CARD_BG_HI)
    .border({ width: TOK_BORDER_W, color: TOK_BORDER })
    .borderRadius(12);
  }

  private cardCenterX(): number {
    return this.cardWidth / 2;
  }

  private actionWidth(): number {
    return Math.max(0, this.cardWidth - 34);
  }
}
