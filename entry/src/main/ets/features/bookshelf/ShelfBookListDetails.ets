import { readerAppColor } from '../common/ReaderThemeRegistry';
import {
  TYPE_SHELF_LIST_AUTHOR,
  TYPE_SHELF_LIST_CHAPTER,
  TYPE_SHELF_LIST_STATUS,
  TYPE_SHELF_LIST_TITLE,
} from '../common/ReaderTypography';
import type { ShelfBook } from '../../app/ReaderCoreGateway';
import { ShelfBookPresentation } from './ShelfBookPresentation';

/** Shared list typography. Small metadata uses the fixed 400 face instead of
 * depending on the variable font's Thin default being promoted by ArkUI. */
@Component
export struct ShelfBookListDetails {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';

  @Prop book: ShelfBook;

  build() {
    Column({ space: 3 }) {
      Text(this.book.title).width('100%').fontFamily(TYPE_SHELF_LIST_TITLE.fontFamily)
        .fontWeight(TYPE_SHELF_LIST_TITLE.fontWeight).fontSize(TYPE_SHELF_LIST_TITLE.fontSizeFp)
        .lineHeight(TYPE_SHELF_LIST_TITLE.lineHeightFp).letterSpacing(TYPE_SHELF_LIST_TITLE.letterSpacingFp)
        .fontColor(readerAppColor('TOK_INK', this.appThemeScheme))
        .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis });
      Text(this.book.author).width('100%').constraintSize({ minHeight: 15 }).fontFamily(TYPE_SHELF_LIST_AUTHOR.fontFamily)
        .fontWeight(TYPE_SHELF_LIST_AUTHOR.fontWeight).fontSize(TYPE_SHELF_LIST_AUTHOR.fontSizeFp)
        .lineHeight(TYPE_SHELF_LIST_AUTHOR.lineHeightFp).letterSpacing(TYPE_SHELF_LIST_AUTHOR.letterSpacingFp)
        .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme))
        .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis });
      Text(ShelfBookPresentation.latestChapter(this.book)).width('100%').fontFamily(TYPE_SHELF_LIST_CHAPTER.fontFamily)
        .fontWeight(TYPE_SHELF_LIST_CHAPTER.fontWeight).fontSize(TYPE_SHELF_LIST_CHAPTER.fontSizeFp)
        .lineHeight(TYPE_SHELF_LIST_CHAPTER.lineHeightFp).letterSpacing(TYPE_SHELF_LIST_CHAPTER.letterSpacingFp)
        .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme))
        .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis });
      Row({ space: 8 }) {
        this.statusPill(true);
        this.statusPill(false);
      }
      .width('100%').height(18);
    }
    .width('100%').height(76).alignItems(HorizontalAlign.Start);
  }

  @Builder
  private statusPill(primary: boolean) {
    Stack({ alignContent: Alignment.Start }) {
      if (primary) {
        Progress({ value: ShelfBookPresentation.progressPercent(this.book), total: 100, type: ProgressType.Linear })
          .width('100%').height(18)
          .color(readerAppColor('TOK_PRIMARY_STRONG', this.appThemeScheme))
          .backgroundColor(readerAppColor('app.ShelfBookListDetails.statusPill.backgroundColor.FFF5ECE6', this.appThemeScheme))
          .style({ strokeWidth: 18, strokeRadius: 9, enableSmoothEffect: false })
          .hitTestBehavior(HitTestMode.None);
      }
      Text(primary ? ShelfBookPresentation.progress(this.book) : ShelfBookPresentation.source(this.book))
        .width('100%').height(12).padding({ left: 6, right: 6 })
        .fontFamily(TYPE_SHELF_LIST_STATUS.fontFamily).fontWeight(TYPE_SHELF_LIST_STATUS.fontWeight)
        .fontSize(TYPE_SHELF_LIST_STATUS.fontSizeFp).lineHeight(TYPE_SHELF_LIST_STATUS.lineHeightFp)
        .letterSpacing(TYPE_SHELF_LIST_STATUS.letterSpacingFp)
        .fontColor(primary ? readerAppColor('TOK_GREEN', this.appThemeScheme) : readerAppColor('TOK_MUTED', this.appThemeScheme))
        .textAlign(TextAlign.Start).maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis });
    }
    // Equal fixed slots follow the row width, never the label's text length.
    .layoutWeight(1).constraintSize({ minWidth: 0 }).height(18)
    .backgroundColor(primary ? readerAppColor('app.ShelfBookListDetails.statusPill.backgroundColor.FFF5ECE6', this.appThemeScheme) : readerAppColor('TOK_CARD_BG', this.appThemeScheme))
    .borderRadius(9).clip(true);
  }
}
