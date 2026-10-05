import { readerAppColor } from '../common/ReaderThemeRegistry';
import {
  TYPE_SHELF_LIST_AUTHOR,
  TYPE_SHELF_LIST_CHAPTER,
  TYPE_SHELF_LIST_STATUS,
  TYPE_SHELF_LIST_TITLE, TYPE_SHELF_METADATA_TAG,
} from '../common/ReaderTypography';
import type { ShelfBook } from '../../app/ReaderCoreGateway';
import { ShelfBookPresentation } from './ShelfBookPresentation';

/** Shared shelf facts. Only content type and origin occupy metadata tags. */
@Component
export struct ShelfBookListDetails {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  @StorageLink('readerMangaPresentationRevision') private mangaRevision: number = 0;
  @Prop book: ShelfBook;

  build() {
    Column({ space: 2 }) {
      Row({ space: 6 }) {
        Text(this.book.title).layoutWeight(1).constraintSize({ minWidth: 0 })
          .fontFamily(TYPE_SHELF_LIST_TITLE.fontFamily).fontWeight(TYPE_SHELF_LIST_TITLE.fontWeight)
          .fontSize(TYPE_SHELF_LIST_TITLE.fontSizeFp).lineHeight(TYPE_SHELF_LIST_TITLE.lineHeightFp as number).letterSpacing(TYPE_SHELF_LIST_TITLE.letterSpacingFp as number)
          .fontColor(readerAppColor('TOK_INK', this.appThemeScheme))
          .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis });
        this.metadataTag(ShelfBookPresentation.contentLabel(this.book));
        this.metadataTag(ShelfBookPresentation.originLabel(this.book));
      }.width('100%').height(18);
      Text(this.book.author).width('100%').constraintSize({ minHeight: 14 }).fontFamily(TYPE_SHELF_LIST_AUTHOR.fontFamily).fontWeight(TYPE_SHELF_LIST_AUTHOR.fontWeight)
          .fontSize(TYPE_SHELF_LIST_AUTHOR.fontSizeFp).lineHeight(TYPE_SHELF_LIST_AUTHOR.lineHeightFp as number).letterSpacing(TYPE_SHELF_LIST_AUTHOR.letterSpacingFp as number)
        .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme))
        .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis });
      Text(this.positionLabel()).width('100%').fontFamily(TYPE_SHELF_LIST_CHAPTER.fontFamily).fontWeight(TYPE_SHELF_LIST_CHAPTER.fontWeight)
          .fontSize(TYPE_SHELF_LIST_CHAPTER.fontSizeFp).lineHeight(TYPE_SHELF_LIST_CHAPTER.lineHeightFp as number).letterSpacing(TYPE_SHELF_LIST_CHAPTER.letterSpacingFp as number)
        .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme))
        .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis });
      Row({ space: 8 }) {
        Text(`最新：${ShelfBookPresentation.latestChapter(this.book)}`).layoutWeight(1)
          .constraintSize({ minWidth: 0 }).fontFamily(TYPE_SHELF_LIST_CHAPTER.fontFamily).fontWeight(TYPE_SHELF_LIST_CHAPTER.fontWeight)
          .fontSize(TYPE_SHELF_LIST_CHAPTER.fontSizeFp).lineHeight(TYPE_SHELF_LIST_CHAPTER.lineHeightFp as number).letterSpacing(TYPE_SHELF_LIST_CHAPTER.letterSpacingFp as number)
          .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme))
          .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis });
        Text(ShelfBookPresentation.progress(this.book)).fontFamily(TYPE_SHELF_LIST_STATUS.fontFamily).fontWeight(TYPE_SHELF_LIST_STATUS.fontWeight)
          .fontSize(TYPE_SHELF_LIST_STATUS.fontSizeFp).lineHeight(TYPE_SHELF_LIST_STATUS.lineHeightFp as number).letterSpacing(TYPE_SHELF_LIST_STATUS.letterSpacingFp as number).fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme));
      }.width('100%');
      Progress({ value: ShelfBookPresentation.progressPercent(this.book), total: 100, type: ProgressType.Linear })
        .width('100%').height(3).color(readerAppColor('TOK_GREEN', this.appThemeScheme))
        .backgroundColor(readerAppColor('TOK_LINE', this.appThemeScheme))
        .style({ strokeWidth: 3, strokeRadius: 2, enableSmoothEffect: false })
        .hitTestBehavior(HitTestMode.None);
    }.width('100%').height(72).alignItems(HorizontalAlign.Start);
  }

  @Builder
  private metadataTag(label: string) {
    Text(label).constraintSize({ minWidth: 30 }).height(16).padding({ left: 4, right: 4 })
      .fontFamily(TYPE_SHELF_METADATA_TAG.fontFamily).fontWeight(TYPE_SHELF_METADATA_TAG.fontWeight)
          .fontSize(TYPE_SHELF_METADATA_TAG.fontSizeFp).lineHeight(TYPE_SHELF_METADATA_TAG.lineHeightFp as number).letterSpacing(TYPE_SHELF_METADATA_TAG.letterSpacingFp as number).textAlign(TextAlign.Center)
      .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme))
      .backgroundColor(readerAppColor('TOK_CARD_BG', this.appThemeScheme))
      .border({ width: 0.5, color: readerAppColor('TOK_BORDER', this.appThemeScheme) }).borderRadius(4);
  }

  private positionLabel(): string {
    if (this.mangaRevision < 0) return '';
    return ShelfBookPresentation.readingPosition(this.book);
  }
}
