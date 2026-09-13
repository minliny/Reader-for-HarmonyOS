import { readerAppColor } from '../common/ReaderThemeRegistry';
import type { ShelfBook } from '../../app/ReaderCoreGateway';
import { TOK_INK, TOK_MUTED, TOK_GREEN, TOK_CARD_BG } from '../common/ReaderTokens';
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
      Text(this.book.author).width('100%').fontFamily('ReaderNotoSansSC')
        .fontWeight(FontWeight.Regular).fontSize(12).lineHeight(15).fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme))
        .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis });
      Text(ShelfBookPresentation.latestChapter(this.book)).width('100%').fontFamily('ReaderNotoSansSC')
        .fontWeight(FontWeight.Regular).fontSize(11).lineHeight(13.75).fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme))
        .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis });
      Row() {
        this.statusPill(ShelfBookPresentation.source(this.book), false);
        this.statusPill(ShelfBookPresentation.progress(this.book), true);
        Blank().layoutWeight(1);
      }
      .width('100%').height(18);
    }
    .width('100%').height(76).alignItems(HorizontalAlign.Start);
  }

  @Builder
  private statusPill(label: string, primary: boolean) {
    Text(label).layoutWeight(1).constraintSize({ minWidth: 0 }).height(18)
      .padding({ left: 6, right: 6 }).backgroundColor(primary ? readerAppColor('app.ShelfBookListDetails.statusPill.backgroundColor.FFF5ECE6', this.appThemeScheme) : readerAppColor('TOK_CARD_BG', this.appThemeScheme))
      .borderRadius(999).fontFamily('ReaderNotoSansSC').fontWeight(FontWeight.Regular)
      .fontSize(10).lineHeight(12).fontColor(primary ? readerAppColor('TOK_GREEN', this.appThemeScheme) : readerAppColor('TOK_MUTED', this.appThemeScheme))
      .textAlign(primary ? TextAlign.Center : TextAlign.Start)
      .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis });
  }
}
