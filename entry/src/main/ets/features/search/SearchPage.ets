import {
  type SearchBook,
  type SearchSource,
} from './SearchGateway';
import type { ShelfBook } from '../../app/ReaderCoreGateway';
import { ReaderWindowCoordinator } from '../../app/ReaderWindowCoordinator';
import { registerReaderFonts } from '../common/ReaderFonts';
import { ReaderSearchField } from '../common/ReaderSearchField';
import {
  SurfaceHorizontalFrame,
  SurfaceWidthSpec,
  resolveHorizontalFrame,
} from '../common/SurfaceHorizontalGeometry';
import {
  readerVisualSafeLeft,
  readerVisualSafeRight,
} from '../common/ReaderWindowMetrics';
import {
  TOK_BORDER,
  TOK_BORDER_W,
  TOK_CARD_BG,
  TOK_CONTENT_RAIL_W_TABLET,
  TOK_GREEN,
  TOK_INK,
  TOK_MUTED,
  TOK_ON_PRIMARY,
  TOK_PAPER,
  TOK_PRIMARY_DARK,
  TOK_PRIMARY_GRADIENT_START,
  TOK_PRIMARY_SOFT,
  TOK_SPACE_CARD_PADDING,
  TOK_SPACE_CONTROL_INLINE,
  TOK_SPACE_LG,
  TOK_SPACE_MD,
  TOK_SPACE_ROW_BLOCK,
  TOK_SPACE_SM,
  TOK_SPACE_XS,
} from '../common/ReaderTokens';

/**
 * The search page's full presentation. `initial` is the pre-search surface
 * (recent history); the remaining states are reached by a real search
 * attempt. `keyword` is the Figma Input text; results are real Core
 * `search-book` entries decoded by SearchGateway.
 */
export interface SearchInitialPresentation {
  kind: 'initial';
  history: string[];
}

export interface SearchLoadingPresentation {
  kind: 'loading';
  keyword: string;
}

export interface SearchResultsPresentation {
  kind: 'results';
  keyword: string;
  results: SearchBook[];
}

export interface SearchEmptyPresentation {
  kind: 'empty';
  keyword: string;
}

export interface SearchErrorPresentation {
  kind: 'error';
  keyword: string;
}

export type SearchPresentation =
  | SearchInitialPresentation
  | SearchLoadingPresentation
  | SearchResultsPresentation
  | SearchEmptyPresentation
  | SearchErrorPresentation;

class SearchBookGroup {
  book: SearchBook;
  sourceCount: number;
  inBookshelf: boolean;
  sourceIds: string[];

  constructor(book: SearchBook, sourceCount: number, inBookshelf: boolean) {
    this.book = book;
    this.sourceCount = sourceCount;
    this.inBookshelf = inBookshelf;
    this.sourceIds = [book.sourceId];
  }
}

/**
 * Figma-backed Book Search for `11 · Search`:
 * `2635:58749`(Phone) / `2635:59195`(Tablet) Initial, `2635:58809` Loading,
 * `2635:58985` Results, `2635:59076` Empty, `2635:59138` Error.
 *
 * This is a presentation component. It consumes characterized page state and
 * emits user intents; it never creates a Core runtime or parses Core protocol.
 */
@Component
export struct SearchPage {
  @StorageLink('readerWindowMetricsRevision') private readerWindowMetricsRevision: number = 0;
  @Prop presentation: SearchPresentation;
  @Prop sources: SearchSource[];
  @Prop shelfBooks: ShelfBook[] = [];
  @Prop isTablet: boolean;
  onBack: () => void = (): void => {};
  onSearch: (keyword: string) => void = (_keyword: string): void => {};
  onClearHistory: () => void = (): void => {};
  onSelectResult: (book: SearchBook, variants: SearchBook[]) => void =
    (_book: SearchBook, _variants: SearchBook[]): void => {};
  onRetry: () => void = (): void => {};
  @State keyword: string = '';

  aboutToAppear(): void {
    registerReaderFonts(this.getUIContext().getFont());
  }

  build() {
    Column() {
      this.searchBar();
      if (this.presentation.kind !== 'initial') {
        this.sourceChips();
      }
      this.stateContent();
    }
    .width('100%')
    .height('100%')
    .padding({ left: this.contentFrame().left, right: this.contentFrame().right })
    .backgroundColor(TOK_PAPER);
  }

  private submitSearch(): void {
    if (this.presentation.kind === 'loading') {
      return;
    }
    const keyword = this.keyword.trim();
    if (keyword.length > 0) {
      this.onSearch(keyword);
    }
  }

  @Builder
  private searchBar() {
    Row({ space: TOK_SPACE_CONTROL_INLINE }) {
      Stack({ alignContent: Alignment.Center }) {
        Image($r('app.media.search_back')).width(20).height(20);
      }
      .width(32)
      .height(32)
      .borderRadius(16)
      .onClick((): void => this.onBack());

      Row() {
        ReaderSearchField({
          variant: 'bookPage',
          mode: 'submit',
          text: this.keyword,
          placeholder: '搜索书名、作者...',
          accessibilityLabel: '搜索书名或作者',
          isTablet: this.isTablet,
          clearable: true,
          submitEnabled: this.presentation.kind !== 'loading',
          onTextChange: (value: string): void => {
            this.keyword = value;
          },
          onSubmit: (): void => this.submitSearch(),
        });
      }
      .layoutWeight(1)
      .height(this.isTablet ? 40 : 36)
      .alignItems(VerticalAlign.Center);

      // The search action stays visually enabled in every state. Loading
      // additionally inlines a 13px spinner and submitSearch prevents re-entry.
      Stack({ alignContent: Alignment.Center }) {
        if (this.presentation.kind === 'loading') {
          Row({ space: 6 }) {
            LoadingProgress()
              .width(13)
              .height(13)
              .color(TOK_ON_PRIMARY)
              .enableLoading(true);
            Text('搜索')
              .fontFamily('ReaderInter')
              .fontWeight(800)
              .fontSize(this.isTablet ? 14 : 13)
              .lineHeight(this.isTablet ? 14 : 13)
              .fontColor(TOK_ON_PRIMARY);
          }
          .alignItems(VerticalAlign.Center);
        } else {
          Text('搜索')
            .fontFamily('ReaderInter')
            .fontWeight(800)
            .fontSize(this.isTablet ? 14 : 13)
            .lineHeight(this.isTablet ? 14 : 13)
            .fontColor(TOK_ON_PRIMARY);
        }
      }
      .height(this.isTablet ? 40 : 36)
      .padding({ left: this.isTablet ? 18 : TOK_SPACE_CARD_PADDING, right: this.isTablet ? 18 : TOK_SPACE_CARD_PADDING })
      .backgroundColor(TOK_GREEN)
      .opacity(1)
      .borderRadius(999)
      .onClick((): void => this.submitSearch());
    }
    .width(this.contentFrame().width)
    .height(this.isTablet ? 56 : 52)
    .padding({ left: this.isTablet ? 20 : TOK_SPACE_MD, right: this.isTablet ? 20 : TOK_SPACE_MD, top: TOK_SPACE_XS })
    .alignItems(VerticalAlign.Center)
    .border({ width: { bottom: TOK_BORDER_W }, color: { bottom: TOK_BORDER } });
  }

  @Builder
  private sourceChips() {
    Scroll() {
      Row({ space: TOK_SPACE_XS }) {
        this.sourceChip('全部', true);
        ForEach(this.sources, (source: SearchSource) => {
          this.sourceChip(source.name, false);
        }, (source: SearchSource): string => `search-source-${source.sourceId}`);
      }
      .height(40)
      .padding({ left: this.isTablet ? 20 : TOK_SPACE_MD, right: this.isTablet ? 20 : TOK_SPACE_MD, top: 9 })
      .alignItems(VerticalAlign.Top);
    }
    .width(this.contentFrame().width)
    .height(41)
    .scrollable(ScrollDirection.Horizontal)
    .scrollBar(BarState.Off)
    .border({ width: { bottom: TOK_BORDER_W }, color: { bottom: TOK_BORDER } });
  }

  @Builder
  private sourceChip(label: string, active: boolean) {
    Text(label)
      .fontFamily('ReaderInter')
      .fontWeight(FontWeight.Bold)
      .fontSize(12)
      .lineHeight(12)
      .fontColor(active ? TOK_ON_PRIMARY : TOK_MUTED)
      .padding({ left: 12.5, right: 12.5, top: 5.5, bottom: 5.5 })
      .backgroundColor(active ? TOK_GREEN : TOK_CARD_BG)
      .border({ width: TOK_BORDER_W, color: active ? TOK_GREEN : TOK_BORDER })
      .borderRadius(999)
      .textAlign(TextAlign.Center)
      .maxLines(1);
  }

  @Builder
  private stateContent() {
    if (this.presentation.kind === 'initial') {
      this.initialContent(this.presentation.history);
    } else if (this.presentation.kind === 'loading') {
      this.loadingContent();
    } else if (this.presentation.kind === 'results') {
      this.resultsContent(this.presentation.keyword, this.groupResults(this.presentation.results));
    } else if (this.presentation.kind === 'empty') {
      this.emptyContent(this.presentation.keyword);
    } else {
      this.errorContent();
    }
  }

  @Builder
  private initialContent(history: string[]) {
    Column({ space: 0 }) {
      if (history.length > 0) {
        Row() {
          Text('最近搜索')
            .fontFamily('ReaderInter')
            .fontWeight(FontWeight.Bold)
            .fontSize(13)
            .lineHeight(19.5)
            .fontColor(TOK_INK)
            .layoutWeight(1);
          Text('清空记录')
            .fontFamily('ReaderInter')
            .fontWeight(FontWeight.Medium)
            .fontSize(12)
            .lineHeight(18)
            .fontColor(TOK_MUTED)
            .onClick((): void => this.onClearHistory());
        }
        .width('100%')
        .height(26)
        .alignItems(VerticalAlign.Center);

        // History chips are capped at 4; when more remain, a primary-outline
        // "N 条更多" chip follows (Figma 2635:58745). No dedicated callback
        // exists, so it is presentational.
        Flex({ wrap: FlexWrap.Wrap, direction: FlexDirection.Row }) {
          ForEach(history.slice(0, 4), (keyword: string) => {
            Text(keyword)
              .fontFamily('ReaderInter')
              .fontWeight(FontWeight.Medium)
              .fontSize(13)
              .lineHeight(19.5)
              .fontColor(TOK_INK)
              .padding({ left: 14.5, right: 14.5, top: 7.5, bottom: 7.5 })
              .backgroundColor(TOK_CARD_BG)
              .border({ width: TOK_BORDER_W, color: TOK_BORDER })
              .borderRadius(999)
              .margin({ right: TOK_SPACE_XS, bottom: TOK_SPACE_XS })
              .onClick((): void => this.onSearch(keyword));
          }, (keyword: string): string => `search-history-${keyword}`);
          if (history.length > 4) {
            this.moreChip(history.length - 4);
          }
        }
        .width('100%')
        .padding({ top: TOK_SPACE_CARD_PADDING });
      }
    }
    .width('100%')
    .padding({
      left: this.isTablet ? 20 : 18,
      right: this.isTablet ? 20 : 18,
      top: 28,
      bottom: 20,
    });
  }

  @Builder
  private moreChip(count: number) {
    Row({ space: TOK_SPACE_ROW_BLOCK }) {
      Text(`${count} 条更多`)
        .fontFamily('ReaderInter')
        .fontWeight(FontWeight.Bold)
        .fontSize(12)
        .lineHeight(18)
        .fontColor(TOK_GREEN)
        .textAlign(TextAlign.Center)
        .maxLines(1);
      Image($r('app.media.reader_chevron_right')).width(12).height(12);
    }
    .padding({ left: 12.5, right: 12.5, top: 7.5, bottom: 7.5 })
    .alignItems(VerticalAlign.Center)
    .border({ width: TOK_BORDER_W, color: TOK_GREEN })
    .borderRadius(999)
    .margin({ right: TOK_SPACE_XS, bottom: TOK_SPACE_XS });
  }

  @Builder
  private loadingContent() {
    // Figma Loading (2635:58801): spinner + caption are top-anchored at 120
    // (not vertically centered). Caption is leading 19.5 with an 18px gap.
    Column({ space: 0 }) {
      LoadingProgress()
        .width(36)
        .height(36)
        .color(TOK_GREEN)
        .enableLoading(true);
      Text('正在搜索所有书源…')
        .margin({ top: 18 })
        .fontFamily('ReaderInter')
        .fontWeight(FontWeight.Regular)
        .fontSize(13)
        .lineHeight(19.5)
        .fontColor(TOK_MUTED)
        .textAlign(TextAlign.Center);
    }
    .width('100%')
    .layoutWeight(1)
    .alignItems(HorizontalAlign.Center)
    .padding({ top: 120 });
  }

  @Builder
  private resultsContent(keyword: string, results: SearchBookGroup[]) {
    Column() {
      Row() {
        Text('找到 ')
          .fontFamily('ReaderInter')
          .fontWeight(FontWeight.Regular)
          .fontSize(11)
          .lineHeight(16.5)
          .fontColor(TOK_MUTED);
        Text(`${results.length}`)
          .fontFamily('ReaderInter')
          .fontWeight(FontWeight.Bold)
          .fontSize(11)
          .lineHeight(16.5)
          .fontColor(TOK_GREEN);
        Text(' 本相关书籍')
          .fontFamily('ReaderInter')
          .fontWeight(FontWeight.Regular)
          .fontSize(11)
          .lineHeight(16.5)
          .fontColor(TOK_MUTED);
      }
      .width(this.contentFrame().width)
      .padding({ left: this.isTablet ? 20 : 18, right: this.isTablet ? 20 : 18, top: 6, bottom: 6 })
      .alignItems(VerticalAlign.Center)
      .border({ width: { bottom: TOK_BORDER_W }, color: { bottom: TOK_BORDER } });

      List() {
        Repeat(results)
          .each((repeatItem: RepeatItem<SearchBookGroup>) => {
            ListItem() {
              this.resultCard(repeatItem.item.book, repeatItem.item.sourceCount,
                repeatItem.item.inBookshelf);
            }
          })
          .key((group: SearchBookGroup): string =>
            `search-result-${this.normalizedBookKey(group.book.title, group.book.author)}`)
          .virtualScroll({ reusable: true });
      }
      .width('100%')
      .layoutWeight(1)
      .scrollBar(BarState.Off);
    }
    .width('100%')
    .layoutWeight(1);
  }

  @Builder
  private resultCard(book: SearchBook, sourceCount: number, inBookshelf: boolean) {
    Row({ space: TOK_SPACE_SM }) {
      Stack({ alignContent: Alignment.Bottom }) {
        if (book.coverUrl !== undefined && book.coverUrl.trim().length > 0) {
          Image(book.coverUrl)
            .width(this.isTablet ? 68 : 60)
            .height(this.isTablet ? 92 : 82)
            .objectFit(ImageFit.Cover)
            .borderRadius(6);
        } else {
          // Figma CoverContainer placeholder: a primary-green gradient with the
          // book title overlaid at the bottom. No per-book gradient mapping
          // rule exists, so the sole primary gradient is reused as the
          // DESIGN_FIXTURE no-cover placeholder.
          Stack({ alignContent: Alignment.Bottom }) {
            Text(book.title)
              .width('100%')
              .fontFamily('ReaderNotoSerifSCBold')
              .fontWeight(FontWeight.Bold)
              .fontSize(9)
              .lineHeight(11.7)
              .fontColor('#99FFFAF4')
              .textAlign(TextAlign.Center)
              .maxLines(1)
              .textOverflow({ overflow: TextOverflow.Ellipsis })
              .padding({ left: TOK_SPACE_ROW_BLOCK, right: TOK_SPACE_ROW_BLOCK, bottom: 6 });
          }
          .width(this.isTablet ? 68 : 60)
          .height(this.isTablet ? 92 : 82)
          .linearGradient({
            angle: 141.7,
            colors: [[TOK_PRIMARY_GRADIENT_START, 0.077], [TOK_PRIMARY_DARK, 0.923]],
          })
          .borderRadius(6);
        }
      }
      .width(this.isTablet ? 68 : 60)
      .height(this.isTablet ? 92 : 82)
      .borderRadius(6);

      Column({ space: 5 }) {
        Text(book.title)
          .width('100%')
          .fontFamily('ReaderNotoSerifSCBold')
          .fontWeight(FontWeight.Bold)
          .fontSize(15)
          .lineHeight(19.5)
          .fontColor(TOK_INK)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis });

        Text(book.author)
          .width('100%')
          .fontFamily('ReaderInter')
          .fontWeight(FontWeight.Regular)
          .fontSize(12)
          .lineHeight(12)
          .fontColor(TOK_MUTED)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis });

        if (book.latestChapterTitle !== undefined) {
          Text(book.latestChapterTitle)
            .width('100%')
            .opacity(0.8)
            .fontFamily('ReaderInter')
            .fontWeight(FontWeight.Regular)
            .fontSize(11)
            .lineHeight(11)
            .fontColor(TOK_MUTED)
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis });
        }

        if (book.intro !== undefined && book.intro.trim().length > 0) {
          Text(book.intro)
            .width('100%')
            .fontFamily('ReaderInter')
            .fontWeight(FontWeight.Regular)
            .fontSize(12)
            .lineHeight(18)
            .fontColor('#9A948E')
            .maxLines(2)
            .textOverflow({ overflow: TextOverflow.Ellipsis });
        }

        Row({ space: 6 }) {
          Text(book.sourceName.length > 0 ? book.sourceName : book.sourceId)
            .fontFamily('ReaderInter')
            .fontWeight(FontWeight.Bold)
            .fontSize(10)
            .lineHeight(10)
            .fontColor(TOK_GREEN)
            .padding({ left: 6, right: 6, top: 2, bottom: 2 })
            .backgroundColor(TOK_PRIMARY_SOFT)
            .borderRadius(4)
            .maxLines(1);
          Text(`共 ${sourceCount} 个书源`)
            .fontFamily('ReaderInter')
            .fontWeight(FontWeight.Regular)
            .fontSize(11)
            .lineHeight(16.5)
            .fontColor(TOK_MUTED)
            .maxLines(1);
          if (inBookshelf) {
            Text('已在书架')
              .fontFamily('ReaderInter')
              .fontWeight(FontWeight.Bold)
              .fontSize(10)
              .fontColor(TOK_GREEN)
              .maxLines(1);
          }
        }
        .width('100%')
        .alignItems(VerticalAlign.Center);
      }
      .layoutWeight(1)
      .alignItems(HorizontalAlign.Start);
    }
    .width(this.contentFrame().width)
    .padding({ left: this.isTablet ? 20 : 18, right: this.isTablet ? 20 : 18, top: TOK_SPACE_CARD_PADDING, bottom: 14.5 })
    .alignItems(VerticalAlign.Top)
    .border({ width: { bottom: TOK_BORDER_W }, color: { bottom: TOK_BORDER } })
    .onClick((): void => this.onSelectResult(book, this.collectBookVariants(book)));
  }

  private groupResults(results: SearchBook[]): SearchBookGroup[] {
    const byBook = new Map<string, SearchBookGroup>();
    for (const book of results) {
      const key = this.normalizedBookKey(book.title, book.author);
      const existing = byBook.get(key);
      if (existing === undefined) {
        byBook.set(key, new SearchBookGroup(book, 1, this.isBookOnShelf(book)));
      } else {
        if (existing.sourceIds.indexOf(book.sourceId) < 0) {
          existing.sourceIds.push(book.sourceId);
          existing.sourceCount += 1;
        }
        existing.inBookshelf = existing.inBookshelf || this.isBookOnShelf(book);
      }
    }
    // Legado keeps one card per exact title/author and promotes books found
    // by more origins. Preserve discovery order for equal source counts.
    return Array.from(byBook.values()).sort((left: SearchBookGroup, right: SearchBookGroup): number =>
      right.sourceCount - left.sourceCount);
  }

  private normalizedBookKey(title: string, author: string): string {
    return `${title.trim().toLocaleLowerCase()}\u0000${author.trim().toLocaleLowerCase()}`;
  }

  private collectBookVariants(book: SearchBook): SearchBook[] {
    if (this.presentation.kind !== 'results') {
      return [book];
    }
    const key = this.normalizedBookKey(book.title, book.author);
    return this.presentation.results.filter((candidate: SearchBook): boolean =>
      this.normalizedBookKey(candidate.title, candidate.author) === key);
  }

  private isBookOnShelf(book: SearchBook): boolean {
    const key = this.normalizedBookKey(book.title, book.author);
    return this.shelfBooks.some((shelf: ShelfBook): boolean =>
      (shelf.sourceId === book.sourceId && shelf.bookId === book.bookId) ||
      this.normalizedBookKey(shelf.title, shelf.author) === key);
  }

  @Builder
  private emptyContent(keyword: string) {
    Scroll() {
      Column({ space: 0 }) {
        Image($r('app.media.search_empty'))
          .width(128)
          .height(120)
          .alignSelf(ItemAlign.Center);

        Text('没有找到相关书籍')
          .margin({ top: 28 })
          .fontFamily('ReaderNotoSerifSCBold')
          .fontWeight(FontWeight.Bold)
          .fontSize(17)
          .lineHeight(25.5)
          .fontColor(TOK_INK)
          .textAlign(TextAlign.Center);

        Text(`所有书源均未搜索到「${keyword}」的相关结果`)
          .margin({ top: TOK_SPACE_CONTROL_INLINE })
          .width('100%')
          .fontFamily('ReaderInter')
          .fontWeight(FontWeight.Regular)
          .fontSize(13)
          .lineHeight(21.125)
          .fontColor(TOK_MUTED)
          .textAlign(TextAlign.Center)
          .maxLines(3);

        Column({ space: 0 }) {
          Text('搜索建议')
            .width('100%')
            .fontFamily('ReaderInter')
            .fontWeight(FontWeight.Bold)
            .fontSize(12)
            .lineHeight(18)
            .fontColor(TOK_INK)
            .maxLines(1);
          this.suggestion('检查书名拼写是否正确');
          this.suggestion('尝试更短的关键词或作者名');
          this.suggestion('前往发现页手动添加书源');
        }
        .width(this.isTablet ? 300 : 190)
        .padding({ left: 18.5, right: 18.5, top: 14.5, bottom: 14.5 })
        .margin({ top: 22 })
        .backgroundColor(TOK_CARD_BG)
        .border({ width: TOK_BORDER_W, color: TOK_BORDER })
        .borderRadius(12)
        .alignItems(HorizontalAlign.Start)
        .alignSelf(ItemAlign.Center);

        Row({ space: TOK_SPACE_CONTROL_INLINE }) {
          Text('添加书源')
            .fontFamily('ReaderInter')
            .fontWeight(800)
            .fontSize(13)
            .lineHeight(13)
            .fontColor(TOK_ON_PRIMARY)
            .padding({ left: 18, right: 18, top: 11.5, bottom: 11.5 })
            .backgroundColor(TOK_GREEN)
            .borderRadius(999);
          Text('重新搜索')
            .fontFamily('ReaderInter')
            .fontWeight(FontWeight.Bold)
            .fontSize(13)
            .lineHeight(13)
            .fontColor(TOK_MUTED)
            .padding({ left: 18.5, right: 18.5, top: 11.5, bottom: 11.5 })
            .backgroundColor(TOK_CARD_BG)
            .border({ width: TOK_BORDER_W, color: TOK_BORDER })
            .borderRadius(999)
            .onClick((): void => this.onRetry());
        }
        .margin({ top: 20 })
        .alignSelf(ItemAlign.Center);
      }
      .width('100%')
      .padding({ top: 50, bottom: 40 });
    }
    .width('100%')
    .layoutWeight(1)
    .scrollBar(BarState.Off);
  }

  @Builder
  private suggestion(text: string) {
    Row({ space: 6 }) {
      Text('·')
        .fontFamily('ReaderInter')
        .fontWeight(FontWeight.Regular)
        .fontSize(11)
        .lineHeight(16.5)
        .fontColor(TOK_GREEN);
      Text(text)
        .fontFamily('ReaderInter')
        .fontWeight(FontWeight.Regular)
        .fontSize(12)
        .lineHeight(19.5)
        .fontColor(TOK_MUTED)
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis });
    }
    .width('100%')
    .margin({ top: TOK_SPACE_XS })
    .alignItems(VerticalAlign.Top);
  }

  @Builder
  private errorContent() {
    // Figma Error (2635:59125): content is top-anchored at 96, retry is a solid
    // primary pill (not the outline used before the rebuild).
    Column({ space: 0 }) {
      Image($r('app.media.search_error')).width(80).height(80);

      Text('搜索失败')
        .margin({ top: 20 })
        .fontFamily('ReaderNotoSerifSCBold')
        .fontWeight(FontWeight.Bold)
        .fontSize(17)
        .lineHeight(25.5)
        .fontColor(TOK_INK)
        .textAlign(TextAlign.Center);

      Text('请检查网络后重试')
        .margin({ top: TOK_SPACE_XS })
        .fontFamily('ReaderInter')
        .fontWeight(FontWeight.Regular)
        .fontSize(13)
        .lineHeight(19.5)
        .fontColor(TOK_MUTED)
        .textAlign(TextAlign.Center);

      Stack({ alignContent: Alignment.Center }) {
        Text('重新搜索')
          .fontFamily('ReaderInter')
          .fontWeight(800)
          .fontSize(14)
          .lineHeight(14)
          .fontColor(TOK_ON_PRIMARY);
      }
      .height(40)
      .margin({ top: TOK_SPACE_LG })
      .padding({ left: 28, right: 28 })
      .backgroundColor(TOK_GREEN)
      .borderRadius(999)
      .onClick((): void => this.onRetry());
    }
    .width('100%')
    .layoutWeight(1)
    .alignItems(HorizontalAlign.Center)
    .padding({ top: 96, bottom: 40 });
  }

  private contentFrame(): SurfaceHorizontalFrame {
    // 手机为全宽 (Figma 2635:58749/2635:58985 各层 Container 均横跨整 390 画布:
    // 搜索栏 x:0 w:390、结果卡 x:0 w:390), 故用 '100%' 自适应而非固定 390; 平板收敛到内容 rail。
    if (this.readerWindowMetricsRevision < 0) {
      return new SurfaceHorizontalFrame(0, 0, 0);
    }
    const metrics = ReaderWindowCoordinator.metrics();
    return resolveHorizontalFrame(
      metrics.windowRect.width,
      readerVisualSafeLeft(metrics),
      readerVisualSafeRight(metrics),
      new SurfaceWidthSpec(TOK_CONTENT_RAIL_W_TABLET),
    );
  }
}
