import { readerAppColor } from '../../../ui/foundation/ReaderThemeRegistry';
import {
  TYPE_SHELF_LIST_AUTHOR,
  TYPE_SHELF_LIST_CHAPTER,
  TYPE_SHELF_LIST_STATUS,
  TYPE_SHELF_LIST_TITLE, TYPE_SHELF_METADATA_TAG,
} from '../../../ui/foundation/ReaderTypography';
import type { ShelfBook } from '../../../app/ReaderCoreGateway';
import { BookshelfListTextFrame, bookshelfListTextFrame } from './BookshelfGridSpec';
import { ShelfBookPresentation } from '../presentation/ShelfBookPresentation';

/** Shared shelf facts. Only content type and origin occupy metadata tags. */
@Component
export struct ShelfBookListDetails {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  @StorageLink('readerMangaPresentationRevision') private mangaRevision: number = 0;
  @Prop book: ShelfBook;
  @Prop textFrame: BookshelfListTextFrame = bookshelfListTextFrame();

  build() {
    Column({ space: 2 }) {
      Flex({ direction: this.textFrame.stackTitle ? FlexDirection.Column : FlexDirection.Row,
        alignItems: this.textFrame.stackTitle ? ItemAlign.Start : ItemAlign.Center }) {
        Text(this.book.title).layoutWeight(this.textFrame.stackTitle ? 0 : 1)
          .width(this.textFrame.stackTitle ? '100%' : undefined).constraintSize({ minWidth: 0 })
          .margin({ right: this.textFrame.stackTitle ? 0 : 6, bottom: this.textFrame.stackTitle ? 2 : 0 })
          .fontFamily(TYPE_SHELF_LIST_TITLE.fontFamily).fontWeight(TYPE_SHELF_LIST_TITLE.fontWeight)
          .fontSize(TYPE_SHELF_LIST_TITLE.fontSizeFp).lineHeight(TYPE_SHELF_LIST_TITLE.lineHeightFp as number).letterSpacing(TYPE_SHELF_LIST_TITLE.letterSpacingFp as number)
          .fontColor(readerAppColor('TOK_INK', this.appThemeScheme))
          .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis });
        Flex({ direction: this.textFrame.metadataColumns === 2 ? FlexDirection.Row : FlexDirection.Column }) {
          this.metadataTag(ShelfBookPresentation.contentLabel(this.book), false);
          this.metadataTag(ShelfBookPresentation.originLabel(this.book), true);
        }.width(this.textFrame.metadataWidth).height(this.textFrame.metadataHeight).flexShrink(0);
      }.width('100%').height(this.textFrame.titleGroupHeight);
      Text(this.book.author).width('100%').constraintSize({ minHeight: (TYPE_SHELF_LIST_AUTHOR.lineHeightFp as number) * this.textFrame.scale }).fontFamily(TYPE_SHELF_LIST_AUTHOR.fontFamily).fontWeight(TYPE_SHELF_LIST_AUTHOR.fontWeight)
          .fontSize(TYPE_SHELF_LIST_AUTHOR.fontSizeFp).lineHeight(TYPE_SHELF_LIST_AUTHOR.lineHeightFp as number).letterSpacing(TYPE_SHELF_LIST_AUTHOR.letterSpacingFp as number)
        .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme))
        .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis });
      Text(this.positionLabel()).width('100%').fontFamily(TYPE_SHELF_LIST_CHAPTER.fontFamily).fontWeight(TYPE_SHELF_LIST_CHAPTER.fontWeight)
          .fontSize(TYPE_SHELF_LIST_CHAPTER.fontSizeFp).lineHeight(TYPE_SHELF_LIST_CHAPTER.lineHeightFp as number).letterSpacing(TYPE_SHELF_LIST_CHAPTER.letterSpacingFp as number)
        .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme))
        .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis });
      Flex({ direction: this.textFrame.stackStatus ? FlexDirection.Column : FlexDirection.Row }) {
        Text(`最新：${ShelfBookPresentation.latestChapter(this.book)}`).layoutWeight(this.textFrame.stackStatus ? 0 : 1)
          .width(this.textFrame.stackStatus ? '100%' : undefined)
          .margin({ right: this.textFrame.stackStatus ? 0 : 8, bottom: this.textFrame.stackStatus ? 2 : 0 })
          .constraintSize({ minWidth: 0 }).fontFamily(TYPE_SHELF_LIST_CHAPTER.fontFamily).fontWeight(TYPE_SHELF_LIST_CHAPTER.fontWeight)
          .fontSize(TYPE_SHELF_LIST_CHAPTER.fontSizeFp).lineHeight(TYPE_SHELF_LIST_CHAPTER.lineHeightFp as number).letterSpacing(TYPE_SHELF_LIST_CHAPTER.letterSpacingFp as number)
          .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme))
          .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis });
        Text(ShelfBookPresentation.progress(this.book)).width(this.textFrame.stackStatus ? '100%' : undefined)
          .fontFamily(TYPE_SHELF_LIST_STATUS.fontFamily).fontWeight(TYPE_SHELF_LIST_STATUS.fontWeight)
          .fontSize(TYPE_SHELF_LIST_STATUS.fontSizeFp).lineHeight(TYPE_SHELF_LIST_STATUS.lineHeightFp as number).letterSpacing(TYPE_SHELF_LIST_STATUS.letterSpacingFp as number).fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme)).maxLines(this.textFrame.stackStatus ? undefined : 1).wordBreak(WordBreak.BREAK_WORD).flexShrink(0);
      }.width('100%').height(this.textFrame.readingGroupHeight);
      Progress({ value: ShelfBookPresentation.progressPercent(this.book), total: 100, type: ProgressType.Linear })
        .width('100%').height(3).color(readerAppColor('TOK_GREEN', this.appThemeScheme))
        .backgroundColor(readerAppColor('TOK_LINE', this.appThemeScheme))
        .style({ strokeWidth: 3, strokeRadius: 2, enableSmoothEffect: false })
        .hitTestBehavior(HitTestMode.None);
    }.width('100%').height(this.textFrame.height).alignItems(HorizontalAlign.Start);
  }

  @Builder
  private metadataTag(label: string, trailing: boolean) {
    Text(label).constraintSize({ minWidth: Math.min(30, this.textFrame.width), maxWidth: this.textFrame.width, minHeight: this.textFrame.tagHeight })
      .maxLines(this.textFrame.metadataColumns === 2 ? 1 : undefined).wordBreak(WordBreak.BREAK_WORD).flexShrink(0)
      .margin({ left: trailing && this.textFrame.metadataColumns === 2 ? 6 : 0,
        top: trailing && this.textFrame.metadataColumns === 1 ? 2 : 0 }).padding({ left: 4, right: 4 })
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
