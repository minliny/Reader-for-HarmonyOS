// Exact production methods from Host 7fbc2a603ddee92af73389153d73c4599cd26fe2.
// Display-only SDK differential input; not another production implementation.
@Component
struct ShelfProgressGridBaseline {
@Builder
  private projectionGridDetails(book: ShelfBook, isTablet: boolean) {
    Column({ space: 6 }) {
      Text(book.title)
        .width(this.shelfBookCardWidth(isTablet))
        .fontFamily(TYPE_SHELF_LIST_TITLE.fontFamily)
        .fontWeight(TYPE_SHELF_LIST_TITLE.fontWeight)
        .fontSize(TYPE_SHELF_LIST_TITLE.fontSizeFp)
        .lineHeight(TYPE_SHELF_LIST_TITLE.lineHeightFp)
        .letterSpacing(TYPE_SHELF_LIST_TITLE.letterSpacingFp)
        .fontColor(readerAppColor('TOK_INK', this.appThemeScheme))
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis });
      Text(book.author)
        .width(this.shelfBookCardWidth(isTablet))
        .fontFamily(TYPE_SHELF_LIST_AUTHOR.fontFamily)
        .fontWeight(TYPE_SHELF_LIST_AUTHOR.fontWeight)
        .fontSize(TYPE_SHELF_LIST_AUTHOR.fontSizeFp)
        .lineHeight(TYPE_SHELF_LIST_AUTHOR.lineHeightFp)
        .letterSpacing(TYPE_SHELF_LIST_AUTHOR.letterSpacingFp)
        .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme))
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis });
      if ((book.readProgress ?? 0) > 0) {
        Text(this.gridProgressLabel(book))
          .width(this.shelfBookCardWidth(isTablet))
          .fontFamily(TYPE_SHELF_LIST_STATUS.fontFamily)
          .fontWeight(TYPE_SHELF_LIST_STATUS.fontWeight)
          .fontSize(TYPE_SHELF_LIST_STATUS.fontSizeFp)
          .lineHeight(TYPE_SHELF_LIST_STATUS.lineHeightFp)
          .letterSpacing(TYPE_SHELF_LIST_STATUS.letterSpacingFp)
          .fontColor(readerAppColor('TOK_GREEN', this.appThemeScheme))
          .maxLines(1);
      }
    }
    .width(this.shelfBookCardWidth(isTablet))
    .alignItems(HorizontalAlign.Start)
    .translate({ y: this.bookCardHeight(this.shelfBookCardWidth(isTablet), isTablet) + 6 })
    .opacity(this.viewSwitchGridContentOpacity)
    .hitTestBehavior(this.viewMode === 'cover' ? HitTestMode.Default : HitTestMode.None);
  }
private gridProgressLabel(book: ShelfBook): string {
    return this.shelfProgressText(book.readProgress ?? 0);
  }
private shelfProgressText(readProgressBasisPoints: number): string {
    const percent = readProgressBasisPoints / 100;
    if (readProgressBasisPoints > 0 && percent < 1) {
      return '已读 <1%';
    }
    return `已读 ${Math.floor(percent)}%`;
  }
private gridBookCardHeight(book: ShelfBook, isTablet: boolean): number {
    const coverHeight = this.bookCardHeight(this.shelfBookCardWidth(isTablet), isTablet);
    const titleAndAuthor = 6 + 18.3 + 6 + 15;
    const progress = (book.readProgress ?? 0) > 0 ? 6 + 12 : 0;
    return coverHeight + titleAndAuthor + progress;
  }
build() { Column() {} }
}
