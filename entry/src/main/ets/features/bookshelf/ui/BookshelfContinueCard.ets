import { READER_LAYOUT_DEBUG_BUILD } from '../../../ui/foundation/ReaderLayoutInvariantSignals';
import type { LayoutInvariantTag } from '../../../ui/layout/LayoutInvariantEvaluator';
import { readerPressOpacity, readerPressScale, readerPressSurface } from '../../../ui/foundation/ReaderPressMotion';
import { bookCoverDisplayUrl } from '../../../app/library/BookCoverDisplay';
import { readerAppColor } from '../../../ui/foundation/ReaderThemeRegistry';
import { bookshelfHeaderSpec } from '../../../ui/foundation/ReaderHeaderSpecs';
import { NoCoverCover, noCoverGlyph } from '../../../ui/patterns/NoCoverCover';
import { readerSurfaceElevation } from '../../../ui/surfaces/ReaderSurfaceSpecs';
import { TOK_BORDER_W } from '../../../ui/foundation/ReaderTokens';
import {
  TYPE_SHELF_ACTION,
  TYPE_SHELF_CONTINUE_AUTHOR,
  TYPE_SHELF_CONTINUE_LABEL,
  TYPE_SHELF_CONTINUE_TITLE,
  TYPE_SHELF_LIST_STATUS,
} from '../../../ui/foundation/ReaderTypography';
import { ReaderWindowCoordinator } from '../../../app/ReaderWindowCoordinator';
import type { ShelfBook } from '../../../app/ReaderCoreGateway';
import { BOOKSHELF_LIST_PROGRESS_STROKE } from './BookshelfGridSpec';
import { bookshelfContinueCardFrame, type BookshelfContinueCardFrame } from './BookshelfContinueCardSpec';
import { ShelfBookPresentation } from '../presentation/ShelfBookPresentation';
import { MangaBookPresentation } from '../../manga/presentation/MangaBookPresentation';

@Component
export struct BookshelfContinueCard {
  @StorageProp('readerAppScheme') private appThemeScheme: string = 'day';
  @StorageProp('readerWindowMetricsRevision') private readerWindowMetricsRevision: number = 0;

  @Prop continueReading: ShelfBook | undefined = undefined;
  @Prop expandedLayout: boolean = false;
  @Prop continueCardSuppressed: boolean = false;
  @Prop headerScrolled: boolean = false;
  @Prop mangaRevision: number = 0;
  @Prop reduceMotion: boolean = false;
  @Prop shelfPressKey: string = '';
  @Prop failedCoverUrls: string[] = [];
  @Prop contentWidth: number = 0;
  @Prop rectId: string = '';
  onCoverError: (url: string | undefined) => void = (_url: string | undefined): void => {};
  onAreaMeasured: () => void = (): void => {};
  onPressTouch: (event: TouchEvent) => void = (_event: TouchEvent): void => {};
  onSelect: () => void = (): void => {};

  private continueCardFontScale(): number {
    const scale = this.readerWindowMetricsRevision < 0 ? 1 : ReaderWindowCoordinator.metrics().systemFontScale;
    return Number.isFinite(scale) ? Math.max(1, scale) : 1;
  }

  private continueCardFrame(): BookshelfContinueCardFrame {
    const scale = this.readerWindowMetricsRevision < 0 ? 1 : ReaderWindowCoordinator.metrics().systemFontScale;
    return bookshelfContinueCardFrame(this.contentWidth, scale);
  }

  private coverUrl(book: ShelfBook | undefined): string | undefined {
    const url = bookCoverDisplayUrl(book?.coverUrl);
    return url !== undefined && !this.failedCoverUrls.includes(url) ? url : undefined;
  }

  private mangaReadingPosition(book: ShelfBook): string {
    if (this.mangaRevision < 0) return '';
    const position = ShelfBookPresentation.readingPosition(book);
    return position.replace(' · 第 ', ' · ').replace(/^第 /, '');
  }

  private continueReadingPosition(book: ShelfBook | undefined): string {
    if (book === undefined) return '';
    if (book.contentKind === 'manga') {
      if (this.mangaRevision < 0 || MangaBookPresentation.get(book.sourceId, book.bookId) === undefined) return '';
      return `读至：${this.mangaReadingPosition(book)}`;
    }
    return `读至：${ShelfBookPresentation.readingPosition(book)}`;
  }

  private continueBookProgress(book: ShelfBook | undefined): number {
    return book === undefined ? 0 : ShelfBookPresentation.progressPercent(book);
  }

  private continueBookProgressLabel(book: ShelfBook | undefined): string {
    return book === undefined ? '' : ShelfBookPresentation.listProgress(book);
  }

  @Builder
  private continueCardCover() {
    Stack() {
      if (this.coverUrl(this.continueReading) !== undefined) {
        Image(this.coverUrl(this.continueReading) ?? '')
          .width(this.continueCardFrame().coverWidth)
          .height(this.continueCardFrame().coverHeight)
          .autoResize(true)
          .sourceSize({
            width: this.continueCardFrame().coverWidth,
            height: this.continueCardFrame().coverHeight,
          })
          .objectFit(ImageFit.Cover)
          .borderRadius(8)
          .onError((): void => this.onCoverError(this.coverUrl(this.continueReading)));
      } else {
        NoCoverCover({
          coverWidth: this.continueCardFrame().coverWidth,
          coverHeight: this.continueCardFrame().coverHeight,
          glyph: noCoverGlyph(this.continueReading?.title),
          kindLabel: ShelfBookPresentation.contentLabel(this.continueReading),
        });
      }
    }
    .width(this.continueCardFrame().coverWidth)
    .height(this.continueCardFrame().coverHeight)
    .borderRadius(8)
    .clip(true);
  }

  @Builder
  private continueCardCopy() {
    Column({ space: this.continueCardFrame().textGap }) {
      Text(this.continueReading?.title ?? '').width('100%')
        .fontFamily(TYPE_SHELF_CONTINUE_TITLE.fontFamily).fontWeight(TYPE_SHELF_CONTINUE_TITLE.fontWeight)
        .fontSize(TYPE_SHELF_CONTINUE_TITLE.fontSizeFp).lineHeight(TYPE_SHELF_CONTINUE_TITLE.lineHeightFp as number)
        .letterSpacing(TYPE_SHELF_CONTINUE_TITLE.letterSpacingFp as number)
        .minFontScale(1).maxFontScale(this.continueCardFontScale())
        .fontColor(readerAppColor('TOK_INK', this.appThemeScheme)).maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis });
      Text(this.continueReading?.author ?? '').width('100%')
        .fontFamily(TYPE_SHELF_CONTINUE_AUTHOR.fontFamily).fontWeight(TYPE_SHELF_CONTINUE_AUTHOR.fontWeight)
        .fontSize(TYPE_SHELF_CONTINUE_AUTHOR.fontSizeFp).lineHeight(TYPE_SHELF_CONTINUE_AUTHOR.lineHeightFp as number)
        .letterSpacing(TYPE_SHELF_CONTINUE_AUTHOR.letterSpacingFp as number)
        .minFontScale(1).maxFontScale(this.continueCardFontScale())
        .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme)).maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis });
      Text(this.continueReadingPosition(this.continueReading)).width('100%')
        .fontFamily(TYPE_SHELF_CONTINUE_AUTHOR.fontFamily).fontWeight(TYPE_SHELF_CONTINUE_AUTHOR.fontWeight)
        .fontSize(TYPE_SHELF_CONTINUE_AUTHOR.fontSizeFp).lineHeight(TYPE_SHELF_CONTINUE_AUTHOR.lineHeightFp as number)
        .letterSpacing(TYPE_SHELF_CONTINUE_AUTHOR.letterSpacingFp as number)
        .minFontScale(1).maxFontScale(this.continueCardFontScale())
        .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme)).maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis });
      Row({ space: 8 }) {
        Progress({ value: this.continueBookProgress(this.continueReading), total: 100, type: ProgressType.Linear })
          .layoutWeight(1).height(BOOKSHELF_LIST_PROGRESS_STROKE).color(readerAppColor('TOK_ACCENT', this.appThemeScheme))
          .backgroundColor(readerAppColor('TOK_FIELD_SURFACE', this.appThemeScheme))
          .style({ strokeWidth: BOOKSHELF_LIST_PROGRESS_STROKE, strokeRadius: 2, enableSmoothEffect: false })
          .hitTestBehavior(HitTestMode.None);
        Text(this.continueBookProgressLabel(this.continueReading)).fontFamily(TYPE_SHELF_LIST_STATUS.fontFamily)
          .fontSize(TYPE_SHELF_LIST_STATUS.fontSizeFp).fontColor(readerAppColor('TOK_ACCENT', this.appThemeScheme))
          .fontFeature('"tnum" 1')
          .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis });
      }.width('100%').alignItems(VerticalAlign.Center);
    }
    .layoutWeight(1)
    .constraintSize({ minHeight: this.continueCardFrame().textMinHeight })
    .alignItems(HorizontalAlign.Start)
    .justifyContent(FlexAlign.Center);
  }

  @Builder
  private continueCardReadAction() {
    Stack({ alignContent: Alignment.Center }) {
      Text('阅读').fontFamily(TYPE_SHELF_ACTION.fontFamily).fontWeight(TYPE_SHELF_ACTION.fontWeight)
        .fontSize(TYPE_SHELF_ACTION.fontSizeFp).lineHeight(TYPE_SHELF_ACTION.lineHeightFp as number)
        .letterSpacing(TYPE_SHELF_ACTION.letterSpacingFp as number)
        .minFontScale(1).maxFontScale(this.continueCardFontScale()).maxLines(2).textAlign(TextAlign.Center)
        .fontColor(readerAppColor('TOK_ON_PRIMARY', this.appThemeScheme));
    }
    .width(this.continueCardFrame().actionWidth)
    .height(this.continueCardFrame().actionHeight)
    .backgroundColor(readerAppColor('app.action.fill', this.appThemeScheme))
    .borderRadius(this.continueCardFrame().actionHeight / 2);
  }

  build() {
    Column({ space: 6 }) {
      Text('继续阅读').width('100%')
        .customProperty('readerLayoutInvariant', typeof READER_LAYOUT_DEBUG_BUILD === 'boolean' && READER_LAYOUT_DEBUG_BUILD
          ? { role: 'scroll-content', id: 'shelf-continue-heading', scope: 'bookshelf', active: !this.headerScrolled,
            expectedContentGapVp: bookshelfHeaderSpec().contentGap } as LayoutInvariantTag : undefined)
        .fontFamily(TYPE_SHELF_CONTINUE_LABEL.fontFamily).fontWeight(TYPE_SHELF_CONTINUE_LABEL.fontWeight)
        .fontSize(TYPE_SHELF_CONTINUE_LABEL.fontSizeFp).lineHeight(TYPE_SHELF_CONTINUE_LABEL.lineHeightFp as number)
        .letterSpacing(TYPE_SHELF_CONTINUE_LABEL.letterSpacingFp as number)
        .minFontScale(1).maxFontScale(this.continueCardFontScale())
        .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme)).maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis });
      Stack() {
        Column({ space: this.continueCardFrame().actionBelow ? this.continueCardFrame().gap : 0 }) {
          Row({ space: this.continueCardFrame().gap }) {
            this.continueCardCover();
            this.continueCardCopy();
            if (!this.continueCardFrame().actionBelow) {
              this.continueCardReadAction();
            }
          }
          .width('100%')
          .constraintSize({ minHeight: this.continueCardFrame().bodyMinHeight })
          .alignItems(VerticalAlign.Center);
          if (this.continueCardFrame().actionBelow) {
            Row() {
              Blank().layoutWeight(1);
              this.continueCardReadAction();
            }.width('100%');
          }
        }
        .width(this.continueCardFrame().width)
        .constraintSize({ minHeight: this.continueCardFrame().minHeight })
        .padding({
          left: this.continueCardFrame().paddingHorizontal,
          right: this.continueCardFrame().paddingHorizontal,
          top: this.continueCardFrame().paddingVertical,
          bottom: this.continueCardFrame().paddingVertical,
        })
        .backgroundColor(readerPressSurface(readerAppColor('TOK_CARD_BG', this.appThemeScheme), this.appThemeScheme,
          this.shelfPressKey === 'continue', this.reduceMotion))
        .border({ width: TOK_BORDER_W, color: readerAppColor('TOK_LINE', this.appThemeScheme) }).borderRadius(16)
        .shadow(readerSurfaceElevation('card', this.appThemeScheme))
        .scale(readerPressScale(this.shelfPressKey === 'continue', this.reduceMotion))
        .opacity(readerPressOpacity(this.shelfPressKey === 'continue', this.reduceMotion));
      }
      .width(this.continueCardFrame().width)
      .alignSelf(ItemAlign.Center)
      .id(this.rectId)
      .onAreaChange((): void => this.onAreaMeasured())
      .onTouch((event: TouchEvent): void => this.onPressTouch(event))
      .onClick((): void => this.onSelect());
    }
    .width(this.contentWidth)
    .alignItems(HorizontalAlign.Start)
    .opacity(this.continueCardSuppressed ? 0 : 1)
    .enabled(!this.continueCardSuppressed)
    .hitTestBehavior(this.continueCardSuppressed ? HitTestMode.None : HitTestMode.Default)
    .accessibilityLevel(this.continueCardSuppressed ? 'no-hide-descendants' : 'auto');
  }
}
