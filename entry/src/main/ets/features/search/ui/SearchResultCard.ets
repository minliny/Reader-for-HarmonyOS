import { LengthMetrics } from '@kit.ArkUI';
import { readerAnimatePress, readerPressOpacity, readerPressPointer, readerPressScale, readerPressSurface } from '../../../ui/foundation/ReaderPressMotion';
import { bookAuthorLabel } from '../../../app/library/BookAuthorMetadata';
import { SEARCH_RESULT_GEOMETRY } from './SearchResultGeometry';
import { searchBookSnapshot } from '../presentation/SearchBookSnapshot';
import { formatSearchSourceSummary } from '../presentation/SearchSourceDisplay';
import { readerAppColor } from '../../../ui/foundation/ReaderThemeRegistry';
import { SearchViewState } from '../presentation/SearchViewState';
import { bookIntroText } from '../../../app/library/BookIntroText';
import type { SearchBook } from '../application/SearchGateway';
import { READER_FONT_NOTO_SANS_SC_UI_MEDIUM } from '../../../ui/foundation/ReaderFontFamilies';
import { NoCoverCover, noCoverGlyph } from '../../../ui/patterns/NoCoverCover';
import {
  TYPE_SEARCH_RESULT_AUTHOR,
  TYPE_SEARCH_RESULT_CHAPTER,
  TYPE_SEARCH_RESULT_INTRO,
  TYPE_SEARCH_RESULT_TAG,
  TYPE_SEARCH_RESULT_TITLE,
} from '../../../ui/foundation/ReaderTypography';
import { TOK_BORDER_W } from '../../../ui/foundation/ReaderTokens';
import {
  SearchBookGroup,
  SearchLayoutFrame,
  type SearchResultSelection,
} from './SearchResultDataSource';

export interface SearchResultDisplayFacts {
  queryRevision: number;
  book: SearchBook;
  sourceCount: number;
}

/** A stable lazy row observes enrichment without remounting the whole result. */
@Component
export struct SearchResultCard {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';

  @ObjectLink @Watch('acceptDisplayFacts') group: SearchBookGroup;
  viewState: SearchViewState = new SearchViewState();
  @Prop @Watch('acceptDisplayFacts') queryRevision: number = 0;
  @Prop @Watch('acceptDisplayFacts') displayIdleRevision: number = 0;
  @Prop reduceMotion: boolean = false;
  @State private pressPointer: number = -1;
  @Prop expandedLayout: boolean = false;
  @Prop cardWidth: number = 0;
  @Prop focusId: string = '';
  onSelectResult: (book: SearchBook, variants: SearchBook[], displayCoverUrl?: string) => void = (): void => {};
  canRefreshDisplay: () => boolean = (): boolean => true;
  onDisplayFactsChange: () => void = (): void => {};
  @State private displayedFacts: SearchResultDisplayFacts | undefined = undefined;
  private displayedBookInput: SearchBook | undefined = undefined;
  private displayVisible: boolean = false;
  private visibilityEpoch: number = 0;
  private mounted: boolean = false;
  private selectionEpoch: number = 0;
  private pressedSelection: SearchResultSelection | undefined = undefined;

  aboutToAppear(): void {
    this.mounted = true;
    this.visibilityEpoch += 1;
    this.selectionEpoch += 1;
    this.pressedSelection = undefined;
    this.pressPointer = -1;
    this.displayVisible = false;
    this.acceptDisplayFacts();
  }

  aboutToDisappear(): void {
    this.mounted = false;
    this.visibilityEpoch += 1;
    this.displayVisible = false;
    this.displayedFacts = undefined;
    this.displayedBookInput = undefined;
    this.selectionEpoch += 1;
    this.pressedSelection = undefined;
    this.pressPointer = -1;
  }

  private captureDisplayFacts(): SearchResultDisplayFacts {
    return {
      queryRevision: this.queryRevision,
      book: searchBookSnapshot(this.group.book),
      sourceCount: this.group.sourceCount,
    };
  }

  private acceptDisplayFacts(): void {
    if (!this.mounted) return;
    const changedQuery = this.displayedFacts?.queryRevision !== this.queryRevision ||
      this.displayedFacts?.book.searchRequestId !== this.group.book.searchRequestId;
    if (changedQuery) {
      this.visibilityEpoch += 1;
      this.selectionEpoch += 1;
      this.pressedSelection = undefined;
      this.pressPointer = -1;
    }
    if (!changedQuery && (this.displayVisible || !this.canRefreshDisplay())) return;
    if (!changedQuery && this.displayedBookInput === this.group.book &&
      this.displayedFacts?.sourceCount === this.group.sourceCount) return;
    const next = this.captureDisplayFacts();
    if (!changedQuery) this.onDisplayFactsChange();
    this.displayedBookInput = this.group.book;
    this.displayedFacts = next;
  }

  private displayBook(): SearchBook { return this.displayedFacts?.book ?? this.group.book; }
  private displaySourceCount(): number { return this.group.sourceCount; }
  private displayInBookshelf(): boolean { return this.group.inBookshelf; }

  private displayVisibilityHandler(): (visible: boolean, ratio: number) => void {
    const epoch = this.visibilityEpoch;
    const query = this.queryRevision;
    return (visible: boolean, ratio: number): void => {
      if (!this.mounted || epoch !== this.visibilityEpoch || query !== this.queryRevision ||
        query !== this.viewState.revision) return;
      const nextVisible = visible && ratio > 0;
      if (!nextVisible || !this.displayVisible) {
        this.displayVisible = false;
        this.acceptDisplayFacts();
      }
      this.displayVisible = nextVisible;
    };
  }

  private captureSelection(): SearchResultSelection {
    return {
      queryRevision: this.displayedFacts?.queryRevision ?? this.queryRevision,
      book: searchBookSnapshot(this.displayBook()),
      variants: this.group.variants.map((book: SearchBook): SearchBook => searchBookSnapshot(book)),
      coverUrl: this.group.coverUrl,
    };
  }

  private onCardTouch(type: TouchType): void {
    if (!this.mounted) return;
    if (type === TouchType.Down) {
      this.selectionEpoch += 1;
      this.pressedSelection = this.captureSelection();
    } else if (type === TouchType.Cancel) {
      this.selectionEpoch += 1;
      this.pressedSelection = undefined;
    } else if (type === TouchType.Up) {
      const selection = this.selectionEpoch;
      this.getUIContext().postFrameCallback(new SearchLayoutFrame(this.getUIContext(), (): void => {
        if (selection === this.selectionEpoch) this.pressedSelection = undefined;
      }));
    }
  }

  private selectResult(source: SourceType): void {
    if (!this.mounted) return;
    const pressed = this.pressedSelection;
    this.selectionEpoch += 1;
    this.pressedSelection = undefined;
    if (source === SourceType.TouchScreen && pressed === undefined) return;
    const selected = pressed ?? this.captureSelection();
    if (selected.queryRevision !== this.viewState.revision) return;
    this.onSelectResult(selected.book, selected.variants, selected.coverUrl);
  }

  private displayIntro(): string {
    return bookIntroText(this.displayBook().intro);
  }

  private showResultIntro(): boolean {
    return this.displayBook().category !== 'comic' && this.displayIntro().length > 0;
  }

  private resultAuthorLine(): string {
    const book = this.displayBook();
    const author = bookAuthorLabel(book.author, book.authorIdentity, book.sourceRuleVersion);
    return [author, this.resultKindLabel(book)].filter((value: string): boolean => value.length > 0).join(' · ');
  }

  private resultKindLabel(book: SearchBook): string {
    return book.category === 'comic' ? '漫画' :
      book.category === 'novel' || (book.sourceId === 'local' && book.category === undefined) ? '小说' : '';
  }

  private coverWidth(): number {
    return SEARCH_RESULT_GEOMETRY.coverWidth(this.cardWidth, this.expandedLayout);
  }

  private coverHeight(): number {
    return this.coverWidth() * SEARCH_RESULT_GEOMETRY.coverAspect;
  }

  private coverErrorHandler(url: string): () => void {
    const group = this.group;
    const requestId = group.book.searchRequestId;
    return (): void => {
      if (this.group === group && group.book.searchRequestId === requestId) group.rejectCover(url);
    };
  }

  private displayLatestChapter(): string {
    return (this.displayBook().latestChapterTitle ?? '').trim();
  }

  private showLatestChapter(): boolean {
    return this.displayLatestChapter().length > 0;
  }

  private displayPrimarySource(): string {
    return formatSearchSourceSummary(this.displayBook().sourceName, this.displaySourceCount()).primarySource;
  }

  private displayMultiSourceLabel(): string {
    return formatSearchSourceSummary(this.displayBook().sourceName, this.displaySourceCount()).multiSourceLabel;
  }

  build() {
    Button({ type: ButtonType.Normal, stateEffect: false }) {
      Row({ space: SEARCH_RESULT_GEOMETRY.columnGap }) {
        Stack({ alignContent: Alignment.Bottom }) {
          if (this.group.coverUrl.length > 0) {
            Image(this.group.coverUrl)
              .width(this.coverWidth())
              .height(this.coverHeight())
              .objectFit(ImageFit.Cover)
              .borderRadius(6)
              .onError(this.coverErrorHandler(this.group.coverUrl));
          } else {
            NoCoverCover({
              coverWidth: this.coverWidth(),
              coverHeight: this.coverHeight(),
              glyph: noCoverGlyph(this.displayBook().title),
              kindLabel: this.resultKindLabel(this.displayBook()),
              cornerRadius: 6,
            });
          }
        }
        .width(this.coverWidth())
        .height(this.coverHeight())
        .backgroundColor(readerAppColor(
          this.group.coverUrl.length > 0 ? 'app.cover.placeholder' : 'TOK_META_BG',
          this.appThemeScheme,
        ))
        .border(this.group.coverUrl.length > 0 ? {
          width: 0.7,
          color: readerAppColor('TOK_LINE_STRONG', this.appThemeScheme),
        } : undefined)
        .borderRadius(6).clip(true);

        Column({ space: SEARCH_RESULT_GEOMETRY.metadataGap }) {
          Column({ space: SEARCH_RESULT_GEOMETRY.metadataGap }) {
            Text(this.displayBook().title)
              .width('100%')
              .fontFamily(TYPE_SEARCH_RESULT_TITLE.fontFamily)
              .fontWeight(TYPE_SEARCH_RESULT_TITLE.fontWeight)
              .fontSize(TYPE_SEARCH_RESULT_TITLE.fontSizeFp)
              .lineHeight(TYPE_SEARCH_RESULT_TITLE.lineHeightFp as number)
              .fontColor(readerAppColor('TOK_INK', this.appThemeScheme))
              .maxLines(2)
              .textOverflow({ overflow: TextOverflow.Ellipsis });

            Text(this.resultAuthorLine())
              .width('100%')
              .fontFamily(TYPE_SEARCH_RESULT_AUTHOR.fontFamily)
              .fontWeight(TYPE_SEARCH_RESULT_AUTHOR.fontWeight)
              .fontSize(TYPE_SEARCH_RESULT_AUTHOR.fontSizeFp)
              .lineHeight(TYPE_SEARCH_RESULT_AUTHOR.lineHeightFp as number)
              .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme))
              .maxLines(1)
              .textOverflow({ overflow: TextOverflow.Ellipsis });

            if (this.showLatestChapter()) {
              Text(this.displayBook().category === 'comic' ? `最新 · ${this.displayLatestChapter()}` : this.displayLatestChapter())
                .width('100%')
                .opacity(0.8)
                .fontFamily(TYPE_SEARCH_RESULT_CHAPTER.fontFamily)
                .fontWeight(TYPE_SEARCH_RESULT_CHAPTER.fontWeight)
                .fontSize(TYPE_SEARCH_RESULT_CHAPTER.fontSizeFp)
                .lineHeight(TYPE_SEARCH_RESULT_CHAPTER.lineHeightFp as number)
                .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme))
                .maxLines(1)
                .textOverflow({ overflow: TextOverflow.Ellipsis });
            }

            if (this.showResultIntro()) {
              Text(this.displayIntro())
                .width('100%')
                .fontFamily(TYPE_SEARCH_RESULT_INTRO.fontFamily)
                .fontWeight(TYPE_SEARCH_RESULT_INTRO.fontWeight)
                .fontSize(TYPE_SEARCH_RESULT_INTRO.fontSizeFp)
                .lineHeight(TYPE_SEARCH_RESULT_INTRO.lineHeightFp as number)
                .fontColor(readerAppColor('app.search.resultHint', this.appThemeScheme))
                .maxLines(this.showLatestChapter() ? 1 : 2)
                .textOverflow({ overflow: TextOverflow.Ellipsis });
            }
          }
          .width('100%')
          .alignItems(HorizontalAlign.Start);

          Flex({
            direction: FlexDirection.Row,
            wrap: FlexWrap.Wrap,
            alignItems: ItemAlign.Center,
            space: { main: LengthMetrics.vp(6), cross: LengthMetrics.vp(2) },
          }) {
            if (this.displayBook().sourceId === 'local') {
              Text('本地书籍').fontFamily(TYPE_SEARCH_RESULT_TAG.fontFamily).fontWeight(TYPE_SEARCH_RESULT_TAG.fontWeight)
                .fontSize(TYPE_SEARCH_RESULT_TAG.fontSizeFp).lineHeight(TYPE_SEARCH_RESULT_TAG.lineHeightFp as number)
                .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme)).maxLines(1);
            } else {
              if (this.displayPrimarySource().length > 0) {
                Text(this.displayPrimarySource())
                  .fontFamily(TYPE_SEARCH_RESULT_TAG.fontFamily).fontWeight(TYPE_SEARCH_RESULT_TAG.fontWeight)
                  .fontSize(TYPE_SEARCH_RESULT_TAG.fontSizeFp).lineHeight(TYPE_SEARCH_RESULT_TAG.lineHeightFp as number)
                  .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme))
                  .constraintSize({ maxWidth: '100%' }).maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis });
              }
              if (this.displayPrimarySource().length > 0 && this.displayMultiSourceLabel().length > 0) {
                Text('·').fontFamily(TYPE_SEARCH_RESULT_TAG.fontFamily).fontSize(TYPE_SEARCH_RESULT_TAG.fontSizeFp)
                  .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme));
              }
              if (this.displayMultiSourceLabel().length > 0) {
                Text(this.displayMultiSourceLabel())
                  .fontFamily(TYPE_SEARCH_RESULT_TAG.fontFamily).fontWeight(TYPE_SEARCH_RESULT_TAG.fontWeight)
                  .fontSize(TYPE_SEARCH_RESULT_TAG.fontSizeFp).lineHeight(TYPE_SEARCH_RESULT_TAG.lineHeightFp as number)
                  .fontColor(readerAppColor('app.search.discoveredSource', this.appThemeScheme))
                  .constraintSize({ maxWidth: '100%' }).maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis });
              }
            }
            if (this.displayInBookshelf()) {
              Text('已在书架').fontFamily(READER_FONT_NOTO_SANS_SC_UI_MEDIUM)
                .fontSize(TYPE_SEARCH_RESULT_TAG.fontSizeFp)
                .lineHeight(TYPE_SEARCH_RESULT_TAG.lineHeightFp as number)
                .fontColor(readerAppColor('TOK_PRIMARY_DARK', this.appThemeScheme)).maxLines(1)
                .backgroundColor(readerAppColor('TOK_PRIMARY_SOFT', this.appThemeScheme))
                .borderRadius(6).padding({ left: 8, right: 8, top: 2, bottom: 2 })
                .textOverflow({ overflow: TextOverflow.Ellipsis });
            }
          }.width('100%').margin({ top: SEARCH_RESULT_GEOMETRY.footerGap });
        }
        .layoutWeight(1)
        .constraintSize({ minHeight: this.coverHeight() })
        .justifyContent(FlexAlign.SpaceBetween)
        .alignItems(HorizontalAlign.Start);
      }
      .width(this.cardWidth)
      .padding({ top: SEARCH_RESULT_GEOMETRY.rowPadding, bottom: SEARCH_RESULT_GEOMETRY.rowPadding })
      .alignItems(VerticalAlign.Top)
      .backgroundColor(readerPressSurface(Color.Transparent, this.appThemeScheme, this.pressPointer >= 0, this.reduceMotion))
      .scale(readerPressScale(this.pressPointer >= 0, this.reduceMotion))
      .opacity(readerPressOpacity(this.pressPointer >= 0, this.reduceMotion))
      .border({ width: { bottom: TOK_BORDER_W }, color: { bottom: readerAppColor('app.search.listRule', this.appThemeScheme) } });
    }
    .width(this.cardWidth).padding(0).borderRadius(0).backgroundColor(Color.Transparent)
    .id(this.focusId)
    .onVisibleAreaChange([0], this.displayVisibilityHandler())
    .onTouch((event: TouchEvent): void => {
      const next = readerPressPointer(event, this.pressPointer, this.mounted);
      if (next !== this.pressPointer) readerAnimatePress(this.getUIContext(), this.reduceMotion, (): void => { this.pressPointer = next; });
      this.onCardTouch(event.type);
    })
    .onClick((event: ClickEvent): void => this.selectResult(event.source));
  }
}
