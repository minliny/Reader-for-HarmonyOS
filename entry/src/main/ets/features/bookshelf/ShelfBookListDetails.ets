import { readerAppColor } from '../common/ReaderThemeRegistry';
import type { ShelfBook } from '../../app/ReaderCoreGateway';
import { ShelfBookPresentation } from './ShelfBookPresentation';

/** The original four text styles, shared by ordinary and batch list rows. */
@Component
export struct ShelfBookListDetails {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';

  @Prop book: ShelfBook;

  build() {
    Column({ space: 3 }) {
      Text(this.book.title).width('100%').fontFamily('ReaderNotoSerifSCBold')
        .fontWeight(FontWeight.Bold).fontSize(15).lineHeight(18.3).fontColor(readerAppColor('TOK_INK', this.appThemeScheme))
        .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis });
      Text(this.book.author).width('100%').constraintSize({ minHeight: 15 }).fontFamily('ReaderNotoSansSC')
        .fontWeight(FontWeight.Regular).fontSize(12).lineHeight(15).fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme))
        .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis });
      Text(ShelfBookPresentation.latestChapter(this.book)).width('100%').fontFamily('ReaderNotoSansSC')
        .fontWeight(FontWeight.Regular).fontSize(11).lineHeight(13.75).fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme))
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
        .fontFamily('ReaderNotoSansSC').fontWeight(FontWeight.Regular)
        .fontSize(10).lineHeight(12)
        .fontColor(primary ? readerAppColor('TOK_GREEN', this.appThemeScheme) : readerAppColor('TOK_MUTED', this.appThemeScheme))
        .textAlign(TextAlign.Start).maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis });
    }
    // Equal fixed slots follow the row width, never the label's text length.
    .layoutWeight(1).constraintSize({ minWidth: 0 }).height(18)
    .backgroundColor(primary ? readerAppColor('app.ShelfBookListDetails.statusPill.backgroundColor.FFF5ECE6', this.appThemeScheme) : readerAppColor('TOK_CARD_BG', this.appThemeScheme))
    .borderRadius(9).clip(true);
  }
}
