import { readerAppColor } from '../../../ui/foundation/ReaderThemeRegistry';
import {
  READER_FONT_NOTO_SANS_SC_UI_MEDIUM,
  READER_FONT_NOTO_SANS_SC_UI_REGULAR,
  READER_FONT_NOTO_SANS_SC_UI_BOLD,
} from '../../../ui/foundation/ReaderFontFamilies';
import { ReaderIconButton } from '../../../ui/controls/ReaderIconButton';
import type { ShelfBook } from '../../../app/ReaderCoreGateway';
import {
  BOOKSHELF_LIST_COVER_HEIGHT, BOOKSHELF_LIST_PROGRESS_STROKE,
  BookshelfListTextFrame, bookshelfListTextFrame,
} from './BookshelfGridSpec';
import { ShelfBookPresentation } from '../presentation/ShelfBookPresentation';

const SHELF_LIST_BADGE_FONT_SIZE = 10;
const SHELF_LIST_BADGE_INLINE_PADDING = 4;
const SHELF_LIST_BADGE_GAP = 4;

@Component
export struct ShelfBookListDetails {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  @StorageLink('readerMangaPresentationRevision') private mangaRevision: number = 0;
  @Prop book: ShelfBook;
  @Prop textFrame: BookshelfListTextFrame = bookshelfListTextFrame();
  @Prop targetHeight: number = BOOKSHELF_LIST_COVER_HEIGHT;
  @Prop moreFocusId: string = '';
  @Prop moreAccessibilityLabel: string = '';
  @Prop moreEnabled: boolean = false;
  onMore: () => void = (): void => {};

  build() {
    Column() {
      Row({ space: 4 }) {
        Text(this.book.title).layoutWeight(1).constraintSize({ minWidth: 0 })
          .fontFamily(READER_FONT_NOTO_SANS_SC_UI_BOLD).fontWeight(FontWeight.Bold)
          .fontSize(15).lineHeight(`${this.textFrame.titleLineHeight}vp`)
          .minFontScale(Math.min(1, this.textFrame.scale)).maxFontScale(Math.max(1, this.textFrame.scale))
          .fontColor(readerAppColor('TOK_INK', this.appThemeScheme))
          .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis }).ellipsisMode(EllipsisMode.END);
        if (this.moreFocusId !== '') {
          ReaderIconButton({
            specId: 'shelf-list-more',
            icon: this.appThemeScheme === 'night' ? $r('app.media.rc_dots_theme_night') : $r('app.media.rc_dots'),
            focusId: this.moreFocusId, accessibilityLabel: this.moreAccessibilityLabel,
            actionEnabled: this.moreEnabled, onTap: this.onMore,
          }).hitTestBehavior(this.moreEnabled ? HitTestMode.Default : HitTestMode.None);
        }
      }.width('100%').height(this.textFrame.titleLineHeight).alignItems(VerticalAlign.Top);

      Row({ space: SHELF_LIST_BADGE_GAP }) {
        Text(this.book.author).layoutWeight(1).constraintSize({ minWidth: 0 })
          .fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR).fontWeight(FontWeight.Regular)
          .fontSize(12).lineHeight(`${this.textFrame.authorLineHeight}vp`)
          .minFontScale(Math.min(1, this.textFrame.scale)).maxFontScale(Math.max(1, this.textFrame.scale))
          .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme))
          .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis }).ellipsisMode(EllipsisMode.END);
        if (this.updateBadgeLabel() !== '' || ShelfBookPresentation.listAttribute(this.book) !== '') {
          Row({ space: SHELF_LIST_BADGE_GAP }) {
            if (this.updateBadgeLabel() !== '') {
              this.metadataTag((): string => this.updateBadgeLabel(), true);
            }
            if (ShelfBookPresentation.listAttribute(this.book) !== '') {
              this.metadataTag((): string => ShelfBookPresentation.listAttribute(this.book), false);
            }
          }.flexShrink(0);
        }
      }.width('100%').height(this.textFrame.authorLineHeight).alignItems(VerticalAlign.Center);

      Text(this.positionLabel()).width('100%').height(this.textFrame.chapterLineHeight)
        .fontFamily(READER_FONT_NOTO_SANS_SC_UI_MEDIUM).fontWeight(FontWeight.Medium)
        .fontSize(12).lineHeight(`${this.textFrame.chapterLineHeight}vp`)
        .minFontScale(Math.min(1, this.textFrame.scale)).maxFontScale(Math.max(1, this.textFrame.scale))
        .fontColor(readerAppColor(this.positionLabel() === '尚未阅读' ? 'TOK_MUTED' : 'TOK_INK', this.appThemeScheme))
        .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis }).ellipsisMode(EllipsisMode.END);

      if (ShelfBookPresentation.listSecondary(this.book) !== '') {
        Text(ShelfBookPresentation.listSecondary(this.book)).width('100%').height(this.textFrame.latestLineHeight)
          .fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR).fontWeight(FontWeight.Regular)
          .fontSize(12).lineHeight(`${this.textFrame.latestLineHeight}vp`)
          .minFontScale(Math.min(1, this.textFrame.scale)).maxFontScale(Math.max(1, this.textFrame.scale))
          .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme))
          .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis }).ellipsisMode(EllipsisMode.END);
      }

      Row({ space: 8 }) {
        // Anchor the painted track at the cover edge while keeping the label centered in its line.
        Progress({ value: ShelfBookPresentation.progressPercent(this.book), total: 100, type: ProgressType.Linear })
          .layoutWeight(1).height(BOOKSHELF_LIST_PROGRESS_STROKE).alignSelf(ItemAlign.End)
          .color(readerAppColor('TOK_ACCENT', this.appThemeScheme))
          .backgroundColor(readerAppColor('TOK_FIELD_SURFACE', this.appThemeScheme))
          .style({ strokeWidth: BOOKSHELF_LIST_PROGRESS_STROKE, strokeRadius: 2, enableSmoothEffect: false })
          .hitTestBehavior(HitTestMode.None);
        Text(this.progressLabel()).flexShrink(0)
          .fontFamily(READER_FONT_NOTO_SANS_SC_UI_MEDIUM).fontWeight(FontWeight.Medium)
          .fontSize(11).lineHeight(`${this.textFrame.progressRowHeight}vp`).fontFeature('"tnum" 1')
          .minFontScale(Math.min(1, this.textFrame.scale)).maxFontScale(Math.max(1, this.textFrame.scale))
          .fontColor(readerAppColor(this.progressLabel() === '未读' ? 'TOK_MUTED' : 'TOK_ACCENT', this.appThemeScheme))
          .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis }).ellipsisMode(EllipsisMode.END);
      }.width('100%').height(this.textFrame.progressRowHeight).alignItems(VerticalAlign.Center);
    }.width('100%').height(this.targetHeight).alignItems(HorizontalAlign.Start).justifyContent(FlexAlign.SpaceBetween);
  }

  @Builder
  private metadataTag(label: () => string, isUpdate: boolean) {
    Text(label()).flexShrink(0)
      .constraintSize({ maxWidth: isUpdate ? this.updateBadgeWidth() : undefined })
      .padding({ left: SHELF_LIST_BADGE_INLINE_PADDING, right: SHELF_LIST_BADGE_INLINE_PADDING })
      .fontFamily(READER_FONT_NOTO_SANS_SC_UI_MEDIUM).fontWeight(FontWeight.Medium)
      .fontSize(SHELF_LIST_BADGE_FONT_SIZE).lineHeight(`${12 * this.textFrame.scale}vp`)
      .minFontScale(Math.min(1, this.textFrame.scale)).maxFontScale(Math.max(1, this.textFrame.scale))
      .fontColor(readerAppColor(isUpdate ? 'TOK_GREEN' : 'TOK_MUTED', this.appThemeScheme))
      .backgroundColor(readerAppColor(isUpdate ? 'TOK_PRIMARY_SOFT' : 'TOK_FIELD_SURFACE', this.appThemeScheme))
      .borderRadius(5).maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis }).ellipsisMode(EllipsisMode.END);
  }

  private updateBadgeLabel(): string {
    const label = ShelfBookPresentation.listUpdateBadge(this.book);
    if (label === '') return '';
    const fullBadgeWidth = label.length * SHELF_LIST_BADGE_FONT_SIZE * this.textFrame.scale +
      2 * SHELF_LIST_BADGE_INLINE_PADDING;
    return fullBadgeWidth > this.updateBadgeWidth()
      ? ShelfBookPresentation.listUpdateBadge(this.book, true) : label;
  }

  private updateBadgeWidth(): number {
    const attribute = ShelfBookPresentation.listAttribute(this.book);
    const authorAllowance = 24 * this.textFrame.scale + SHELF_LIST_BADGE_GAP;
    const attributeAllowance = attribute === '' ? 0 : attribute.length * SHELF_LIST_BADGE_FONT_SIZE * this.textFrame.scale +
      2 * SHELF_LIST_BADGE_INLINE_PADDING + SHELF_LIST_BADGE_GAP;
    return Math.max(0, this.textFrame.width - authorAllowance - attributeAllowance);
  }

  private positionLabel(): string {
    if (this.mangaRevision < 0) return '';
    return ShelfBookPresentation.listReadingPosition(this.book);
  }

  private progressLabel(): string {
    if (this.mangaRevision < 0) return '';
    return ShelfBookPresentation.listProgress(this.book);
  }
}
