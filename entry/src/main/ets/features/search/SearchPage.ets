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
  /**
   * True while the source sweep is still running: the list already shows
   * partial results plus a trailing in-progress slot, and keeps updating as
   * each source lands. False once every enabled source has finished.
   */
  searching: boolean;
  /** Enabled sources the sweep attempts in total. */
  totalSourceCount: number;
  /** Enabled sources finished (ok or failed) so far. */
  completedSourceCount: number;
  /** Enabled sources whose `book.search` failed so far. */
  failedSourceCount: number;
  /** True when the user stopped the sweep early (ACQ-02); partial results stay. */
  stopped?: boolean;
}

export interface SearchEmptyPresentation {
  kind: 'empty';
  keyword: string;
  /** Enabled sources the search actually attempted. */
  searchedSourceCount: number;
  /** Enabled sources whose `book.search` failed before this verdict. */
  failedSourceCount?: number;
  /** True when the sweep was stopped by the user before this verdict (ACQ-02). */
  stopped?: boolean;
}

export interface SearchErrorPresentation {
  kind: 'error';
  keyword: string;
  /** Enabled sources the search actually attempted. */
  searchedSourceCount: number;
  /** Enabled sources whose `book.search` failed; every source failed here. */
  failedSourceCount?: number;
}

/**
 * P0 add-source flow: zero or fully-disabled sources is a configuration gap,
 * not a search failure. Product-approved extension state (no Figma final
 * frame); it reuses the Empty layout.
 */
export interface SearchSourceRequiredPresentation {
  kind: 'sourceRequired';
  reason: 'noSources' | 'allDisabled';
}

/** `source.list` itself failed; the search chain never started. */
export interface SearchSourceLoadErrorPresentation {
  kind: 'sourceLoadError';
}

export type SearchPresentation =
  | SearchInitialPresentation
  | SearchLoadingPresentation
  | SearchResultsPresentation
  | SearchEmptyPresentation
  | SearchErrorPresentation
  | SearchSourceRequiredPresentation
  | SearchSourceLoadErrorPresentation;

class SearchBookGroup {
  book: SearchBook;
  sourceCount: number;
  inBookshelf: boolean;
  sourceIds: string[];
  variants: SearchBook[];
  private readonly sourceIdSet: Set<string>;

  constructor(book: SearchBook, sourceCount: number, inBookshelf: boolean) {
    this.book = book;
    this.sourceCount = sourceCount;
    this.inBookshelf = inBookshelf;
    this.sourceIds = [book.sourceId];
    this.variants = [book];
    this.sourceIdSet = new Set<string>([book.sourceId]);
  }

  admit(book: SearchBook, inBookshelf: boolean): void {
    this.variants.push(book);
    if (!this.sourceIdSet.has(book.sourceId)) {
      this.sourceIdSet.add(book.sourceId);
      this.sourceIds.push(book.sourceId);
      this.sourceCount += 1;
    }
    this.inBookshelf = this.inBookshelf || inBookshelf;
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
  /**
   * `scopeSourceIds` is undefined for the all-sources scope; an explicit array
   * restricts the sweep to those sources (ACQ-02). Callers forwarding the
   * intent must pass it through to the orchestrator verbatim.
   */
  onSearch: (keyword: string, scopeSourceIds?: string[]) => void =
    (_keyword: string, _scopeSourceIds?: string[]): void => {};
  /** Stop the live sweep, keeping whatever partial results already landed. */
  onStop: () => void = (): void => {};
  onClearHistory: () => void = (): void => {};
  onSelectResult: (book: SearchBook, variants: SearchBook[]) => void =
    (_book: SearchBook, _variants: SearchBook[]): void => {};
  onRetry: () => void = (): void => {};
  onManageSources: () => void = (): void => {};
  @State keyword: string = '';
  @State historyExpanded: boolean = false;
  // ACQ-02 scope state (product-approved extension, no Figma final frame):
  // all-sources by default; a custom subset is built from the chip wall.
  @State scopeAll: boolean = true;
  @State scopeSelection: string[] = [];
  @State scopeExpanded: boolean = false;
  private groupedResultsInput: SearchBook[] | undefined = undefined;
  private groupedShelfInput: ShelfBook[] | undefined = undefined;
  private groupedResultsCache: SearchBookGroup[] = [];

  aboutToAppear(): void {
    registerReaderFonts(this.getUIContext().getFont());
    // Returning from Source Management rebuilds this page; the pre-leave
    // presentation survives in Index, so restore its keyword into the field.
    const presentation = this.presentation;
    if (presentation.kind === 'loading' || presentation.kind === 'results' ||
      presentation.kind === 'empty' || presentation.kind === 'error') {
      this.keyword = presentation.keyword;
    }
  }

  build() {
    Column() {
      this.searchBar();
      this.stateContent();
    }
    .width('100%')
    .height('100%')
    .padding({ left: this.contentFrame().left, right: this.contentFrame().right })
    .backgroundColor(TOK_PAPER);
  }

  private isSweeping(): boolean {
    return this.presentation.kind === 'loading' ||
      (this.presentation.kind === 'results' && this.presentation.searching);
  }

  /** The pill is the stop control while sweeping and always active there. */
  private canSubmit(): boolean {
    if (this.isSweeping()) {
      return true;
    }
    const scope = this.scopeSourceIds();
    return scope === undefined || scope.length > 0;
  }

  /** Reads the presentation directly so minimal-update re-render tracks it. */
  private isStoppedEmpty(): boolean {
    return this.presentation.kind === 'empty' && this.presentation.stopped === true;
  }

  private submitSearch(): void {
    if (this.presentation.kind === 'loading') {
      return;
    }
    const keyword = this.keyword.trim();
    if (keyword.length === 0) {
      return;
    }
    const scope = this.scopeSourceIds();
    if (scope !== undefined && scope.length === 0) {
      // A custom scope with zero usable sources cannot be searched; the pill
      // renders dimmed so the dead submit reads as disabled, not broken.
      return;
    }
    this.onSearch(keyword, scope);
  }

  /** undefined = all enabled sources; otherwise the usable selected subset. */
  private scopeSourceIds(): string[] | undefined {
    if (this.scopeAll) {
      return undefined;
    }
    const selected: string[] = [];
    for (const source of this.sources) {
      if (source.enabled && source.name.trim().length > 0 &&
        this.scopeSelection.indexOf(source.sourceId) >= 0) {
        selected.push(source.sourceId);
      }
    }
    return selected;
  }

  private enabledSources(): SearchSource[] {
    return this.sources.filter((source: SearchSource): boolean =>
      source.enabled && source.name.trim().length > 0);
  }

  private toggleScopeSource(sourceId: string): void {
    if (this.scopeAll) {
      // Chips start from the all-sources default: the first tap enters the
      // custom subset with every usable source except the tapped one.
      this.scopeAll = false;
      this.scopeSelection = this.enabledSources()
        .map((source: SearchSource): string => source.sourceId)
        .filter((id: string): boolean => id !== sourceId);
      return;
    }
    if (this.scopeSelection.indexOf(sourceId) >= 0) {
      this.scopeSelection = this.scopeSelection.filter((id: string): boolean => id !== sourceId);
    } else {
      this.scopeSelection = this.scopeSelection.concat([sourceId]);
    }
  }

  private scopeLabel(): string {
    if (this.scopeAll) {
      return '全部书源';
    }
    const count = this.scopeSourceIds()?.length ?? 0;
    return count === 0 ? '未选择书源' : `已选 ${count} 个书源`;
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

      // The search action doubles as the ACQ-02 stop control: while a sweep
      // is live the pill reads 停止 and stops the sweep; otherwise it submits.
      // Loading additionally inlines a 13px spinner and submitSearch prevents
      // re-entry.
      Stack({ alignContent: Alignment.Center }) {
        if (this.presentation.kind === 'loading') {
          Row({ space: 6 }) {
            LoadingProgress()
              .width(13)
              .height(13)
              .color(TOK_ON_PRIMARY)
              .enableLoading(true);
            Text('停止')
              .fontFamily('ReaderInter')
              .fontWeight(800)
              .fontSize(this.isTablet ? 14 : 13)
              .lineHeight(this.isTablet ? 14 : 13)
              .fontColor(TOK_ON_PRIMARY);
          }
          .alignItems(VerticalAlign.Center);
        } else if (this.presentation.kind === 'results' && this.presentation.searching) {
          Text('停止')
            .fontFamily('ReaderInter')
            .fontWeight(800)
            .fontSize(this.isTablet ? 14 : 13)
            .lineHeight(this.isTablet ? 14 : 13)
            .fontColor(TOK_ON_PRIMARY);
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
      .opacity(this.canSubmit() ? 1 : 0.4)
      .borderRadius(999)
      .onClick((): void => {
        if (this.isSweeping()) {
          this.onStop();
          return;
        }
        this.submitSearch();
      });
    }
    .width(this.contentFrame().width)
    .height(this.isTablet ? 56 : 52)
    .padding({ left: this.isTablet ? 20 : TOK_SPACE_MD, right: this.isTablet ? 20 : TOK_SPACE_MD, top: TOK_SPACE_XS })
    .alignItems(VerticalAlign.Center)
    .border({ width: { bottom: TOK_BORDER_W }, color: { bottom: TOK_BORDER } });
  }

  @Builder
  private stateContent() {
    if (this.presentation.kind === 'initial') {
      this.initialContent(this.presentation.history);
    } else if (this.presentation.kind === 'loading') {
      this.loadingContent();
    } else if (this.presentation.kind === 'results') {
      this.resultsContent(this.presentation.keyword, this.groupResults(this.presentation.results),
        this.presentation.searching);
    } else if (this.presentation.kind === 'sourceRequired') {
      this.sourceRequiredContent(this.presentation.reason);
    } else if (this.presentation.kind === 'sourceLoadError') {
      this.sourceLoadErrorContent();
    } else if (this.presentation.kind === 'empty') {
      this.emptyContent(this.presentation.keyword, this.presentation.searchedSourceCount);
    } else {
      this.errorContent(this.presentation.searchedSourceCount);
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

        // History chips show the first 4; when more remain, a primary-outline
        // "N 条更多" chip follows (Figma 2635:58745) and expands the rest in
        // place — its wired intent per P0-DEAD-CONTROL-CLEANUP.
        Flex({ wrap: FlexWrap.Wrap, direction: FlexDirection.Row }) {
          ForEach(this.historyExpanded ? history : history.slice(0, 4), (keyword: string) => {
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
              .onClick((): void => {
                this.keyword = keyword;
                this.submitSearch();
              });
          }, (keyword: string): string => `search-history-${keyword}`);
          if (history.length > 4 && !this.historyExpanded) {
            this.moreChip(history.length - 4);
          }
        }
        .width('100%')
        .padding({ top: TOK_SPACE_CARD_PADDING });
      }

      // ACQ-02 scope control (product-approved extension, no Figma final
      // frame): restrict the next search to selected sources. Wired intent per
      // P0-DEAD-CONTROL-CLEANUP — these chips toggle real filter state.
      if (this.enabledSources().length > 0) {
        this.scopeSection();
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
  private scopeSection() {
    Row() {
      Text('搜索范围')
        .fontFamily('ReaderInter')
        .fontWeight(FontWeight.Bold)
        .fontSize(13)
        .lineHeight(19.5)
        .fontColor(TOK_INK)
        .layoutWeight(1);
      Row({ space: 4 }) {
        Text(this.scopeLabel())
          .fontFamily('ReaderInter')
          .fontWeight(FontWeight.Medium)
          .fontSize(12)
          .lineHeight(18)
          .fontColor(TOK_MUTED)
          .maxLines(1);
        Image($r('app.media.reader_chevron_right'))
          .width(12)
          .height(12)
          .rotate({ angle: this.scopeExpanded ? 90 : 0 });
      }
      .alignItems(VerticalAlign.Center)
      .onClick((): void => {
        this.scopeExpanded = !this.scopeExpanded;
      })
      .accessibilityText(this.scopeExpanded ? '收起搜索范围' : '展开搜索范围');
    }
    .width('100%')
    .height(26)
    .alignItems(VerticalAlign.Center)
    .margin({ top: 18 });

    if (this.scopeExpanded) {
      Flex({ wrap: FlexWrap.Wrap, direction: FlexDirection.Row }) {
        this.scopeChip('全部', this.scopeAll, (): void => {
          this.scopeAll = true;
        });
        ForEach(this.enabledSources(), (source: SearchSource) => {
          this.scopeChip(source.name,
            !this.scopeAll && this.scopeSelection.indexOf(source.sourceId) >= 0,
            (): void => this.toggleScopeSource(source.sourceId));
        }, (source: SearchSource): string => `search-scope-${source.sourceId}`);
      }
      .width('100%')
      .padding({ top: TOK_SPACE_CARD_PADDING });
    }
  }

  @Builder
  private scopeChip(label: string, selected: boolean, onToggle: () => void) {
    Text(label)
      .fontFamily('ReaderInter')
      .fontWeight(FontWeight.Medium)
      .fontSize(13)
      .lineHeight(19.5)
      .fontColor(selected ? TOK_GREEN : TOK_INK)
      .padding({ left: 14.5, right: 14.5, top: 7.5, bottom: 7.5 })
      .backgroundColor(selected ? TOK_PRIMARY_SOFT : TOK_CARD_BG)
      .border({ width: TOK_BORDER_W, color: selected ? TOK_GREEN : TOK_BORDER })
      .borderRadius(999)
      .margin({ right: TOK_SPACE_XS, bottom: TOK_SPACE_XS })
      .maxLines(1)
      .textOverflow({ overflow: TextOverflow.Ellipsis })
      .constraintSize({ maxWidth: 160 })
      .onClick((): void => onToggle())
      .accessibilityText(selected ? `已选入搜索范围:${label}` : `选入搜索范围:${label}`);
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
    .margin({ right: TOK_SPACE_XS, bottom: TOK_SPACE_XS })
    .onClick((): void => {
      this.historyExpanded = true;
    })
    .accessibilityText(`展开其余 ${count} 条搜索历史`);
  }

  @Builder
  private loadingContent() {
    // Product-approved modification of Figma Loading (2635:58801): the
    // spinner + caption anchor to the bottom of the screen (fixed gap) so the
    // same indicator position continues as the results floating overlay once
    // the first books land.
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
    .justifyContent(FlexAlign.End)
    .alignItems(HorizontalAlign.Center)
    .padding({ bottom: 48 });
  }

  @Builder
  private resultsContent(keyword: string, results: SearchBookGroup[], searching: boolean) {
    Stack({ alignContent: Alignment.Bottom }) {
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
          // Reads the presentation directly (not a builder param) so the
          // minimal-update re-render tracks it exactly like the search/stop
          // pill does: the sweep counter must update live per source landing.
          if (this.presentation.kind === 'results') {
            if (this.presentation.stopped === true) {
              // ACQ-02: a stopped sweep keeps its partial results; the header
              // states how far the interrupted sweep got so partials never read
              // as a complete verdict.
              Text(` · 已停止,已搜索 ${this.presentation.completedSourceCount}/${this.presentation.totalSourceCount} 个书源`)
                .fontFamily('ReaderInter')
                .fontWeight(FontWeight.Regular)
                .fontSize(11)
                .lineHeight(16.5)
                .fontColor(TOK_MUTED)
                .maxLines(1)
                .textOverflow({ overflow: TextOverflow.Ellipsis });
            } else if (this.presentation.searching) {
              Text(` · 正在搜索 ${this.presentation.completedSourceCount}/${this.presentation.totalSourceCount} 个书源,已返回 ${results.length} 个`)
                .fontFamily('ReaderInter')
                .fontWeight(FontWeight.Regular)
                .fontSize(11)
                .lineHeight(16.5)
                .fontColor(TOK_MUTED)
                .maxLines(1)
                .textOverflow({ overflow: TextOverflow.Ellipsis });
            }
            if (this.presentation.failedSourceCount > 0) {
              Text(` · 失败 ${this.presentation.failedSourceCount} 个书源`)
                .fontFamily('ReaderInter')
                .fontWeight(FontWeight.Regular)
                .fontSize(11)
                .lineHeight(16.5)
                .fontColor(TOK_MUTED)
                .maxLines(1)
                .textOverflow({ overflow: TextOverflow.Ellipsis });
            }
          }
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
                  repeatItem.item.inBookshelf, repeatItem.item.variants);
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
      .height('100%');

      // Product-approved extension (no Figma frame): while the source sweep is
      // still running the live query indicator stays anchored at the same
      // bottom position as the no-results loading state, as a non-interactive
      // overlay — every touch reaches the result list beneath it.
      if (searching) {
        LoadingProgress()
          .width(36)
          .height(36)
          .color(TOK_GREEN)
          .enableLoading(true)
          .margin({ bottom: 48 })
          .hitTestBehavior(HitTestMode.None);
      }
    }
    .width('100%')
    .layoutWeight(1);
  }

  @Builder
  private resultCard(
    book: SearchBook,
    sourceCount: number,
    inBookshelf: boolean,
    variants: SearchBook[],
  ) {
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
    .onClick((): void => this.onSelectResult(book, variants));
  }

  private groupResults(results: SearchBook[]): SearchBookGroup[] {
    if (this.groupedResultsInput === results && this.groupedShelfInput === this.shelfBooks) {
      return this.groupedResultsCache;
    }
    const byBook = new Map<string, SearchBookGroup>();
    // The shelf is stable for this render pass. Build both identity views once
    // so every streamed search result uses O(1) membership instead of scanning
    // the full shelf again.
    const shelfIdentityKeys = new Set<string>();
    const shelfBookKeys = new Set<string>();
    for (const shelf of this.shelfBooks) {
      shelfIdentityKeys.add(`${shelf.sourceId}\u0000${shelf.bookId}`);
      shelfBookKeys.add(this.normalizedBookKey(shelf.title, shelf.author));
    }
    for (const book of results) {
      const key = this.normalizedBookKey(book.title, book.author);
      const inBookshelf = shelfIdentityKeys.has(`${book.sourceId}\u0000${book.bookId}`) ||
        shelfBookKeys.has(key);
      const existing = byBook.get(key);
      if (existing === undefined) {
        byBook.set(key, new SearchBookGroup(book, 1, inBookshelf));
      } else {
        existing.admit(book, inBookshelf);
      }
    }
    // Legado keeps one card per exact title/author and promotes books found
    // by more origins. Preserve discovery order for equal source counts.
    const grouped = Array.from(byBook.values()).sort((left: SearchBookGroup, right: SearchBookGroup): number =>
      right.sourceCount - left.sourceCount);
    this.groupedResultsInput = results;
    this.groupedShelfInput = this.shelfBooks;
    this.groupedResultsCache = grouped;
    return grouped;
  }

  private normalizedBookKey(title: string, author: string): string {
    return `${title.trim().toLocaleLowerCase()}\u0000${author.trim().toLocaleLowerCase()}`;
  }

  @Builder
  private emptyContent(keyword: string, searchedSourceCount: number) {
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

        Text(this.isStoppedEmpty()
          ? (searchedSourceCount > 0
            ? `已搜索 ${searchedSourceCount} 个书源后停止,未找到「${keyword}」的相关结果`
            : `已停止搜索,未找到「${keyword}」的相关结果`)
          : `已搜索 ${searchedSourceCount} 个书源,未找到「${keyword}」的相关结果`)
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
          this.suggestion('前往书源管理添加或启用更多书源');
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
          this.primaryPill('添加更多书源', (): void => this.onManageSources());
          this.secondaryPill('重新搜索', (): void => this.onRetry());
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

  /**
   * P0 add-source flow extension state: the entry source list is empty or
   * fully disabled, so search cannot run. Layout reuses the Empty surface
   * (illustration, title/description, primary+secondary pill row).
   */
  @Builder
  private sourceRequiredContent(reason: string) {
    Scroll() {
      Column({ space: 0 }) {
        Image($r('app.media.search_empty'))
          .width(128)
          .height(120)
          .alignSelf(ItemAlign.Center);

        Text(reason === 'noSources' ? '还没有可用书源' : '没有启用的书源')
          .margin({ top: 28 })
          .fontFamily('ReaderNotoSerifSCBold')
          .fontWeight(FontWeight.Bold)
          .fontSize(17)
          .lineHeight(25.5)
          .fontColor(TOK_INK)
          .textAlign(TextAlign.Center);

        Text(reason === 'noSources' ? '添加至少一个书源后才能搜索在线书籍' : '启用已有书源,或导入新的书源')
          .margin({ top: TOK_SPACE_CONTROL_INLINE })
          .width('100%')
          .fontFamily('ReaderInter')
          .fontWeight(FontWeight.Regular)
          .fontSize(13)
          .lineHeight(21.125)
          .fontColor(TOK_MUTED)
          .textAlign(TextAlign.Center)
          .maxLines(3);

        Row({ space: TOK_SPACE_CONTROL_INLINE }) {
          this.primaryPill(reason === 'noSources' ? '添加书源' : '管理书源',
            (): void => this.onManageSources());
          this.secondaryPill('返回书架', (): void => this.onBack());
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
  private sourceLoadErrorContent() {
    Column({ space: 0 }) {
      Image($r('app.media.search_error')).width(80).height(80);

      Text('书源列表加载失败')
        .margin({ top: 20 })
        .fontFamily('ReaderNotoSerifSCBold')
        .fontWeight(FontWeight.Bold)
        .fontSize(17)
        .lineHeight(25.5)
        .fontColor(TOK_INK)
        .textAlign(TextAlign.Center);

      Text('无法获取书源列表,请重试')
        .margin({ top: TOK_SPACE_XS })
        .fontFamily('ReaderInter')
        .fontWeight(FontWeight.Regular)
        .fontSize(13)
        .lineHeight(19.5)
        .fontColor(TOK_MUTED)
        .textAlign(TextAlign.Center);

      Row({ space: TOK_SPACE_CONTROL_INLINE }) {
        this.primaryPill('重试加载', (): void => this.onRetry());
        this.secondaryPill('返回书架', (): void => this.onBack());
      }
      .margin({ top: TOK_SPACE_LG })
      .alignSelf(ItemAlign.Center);
    }
    .width('100%')
    .layoutWeight(1)
    .alignItems(HorizontalAlign.Center)
    .padding({ top: 96, bottom: 40 });
  }

  @Builder
  private primaryPill(label: string, onTap: () => void) {
    Text(label)
      .fontFamily('ReaderInter')
      .fontWeight(800)
      .fontSize(13)
      .lineHeight(13)
      .fontColor(TOK_ON_PRIMARY)
      .padding({ left: 18, right: 18, top: 11.5, bottom: 11.5 })
      .backgroundColor(TOK_GREEN)
      .borderRadius(999)
      .onClick((): void => onTap())
      .responseRegion({ x: 0, y: -4, width: '100%', height: 44 })
      .accessibilityText(label);
  }

  @Builder
  private secondaryPill(label: string, onTap: () => void) {
    Text(label)
      .fontFamily('ReaderInter')
      .fontWeight(FontWeight.Bold)
      .fontSize(13)
      .lineHeight(13)
      .fontColor(TOK_MUTED)
      .padding({ left: 18.5, right: 18.5, top: 11.5, bottom: 11.5 })
      .backgroundColor(TOK_CARD_BG)
      .border({ width: TOK_BORDER_W, color: TOK_BORDER })
      .borderRadius(999)
      .onClick((): void => onTap())
      .responseRegion({ x: 0, y: -4, width: '100%', height: 44 })
      .accessibilityText(label);
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
  private errorContent(searchedSourceCount: number) {
    // Figma Error (2635:59125): content is top-anchored at 96, retry is a solid
    // primary pill (not the outline used before the rebuild). The "检查书源"
    // secondary action is a P0 add-source flow addition.
    Column({ space: 0 }) {
      Image($r('app.media.search_error')).width(80).height(80);

      Text('书源搜索失败')
        .margin({ top: 20 })
        .fontFamily('ReaderNotoSerifSCBold')
        .fontWeight(FontWeight.Bold)
        .fontSize(17)
        .lineHeight(25.5)
        .fontColor(TOK_INK)
        .textAlign(TextAlign.Center);

      Text(searchedSourceCount > 0
        ? `${searchedSourceCount} 个书源均请求失败,可检查网络连接或书源状态`
        : '书源请求失败,可检查网络连接或书源状态')
        .margin({ top: TOK_SPACE_XS })
        .fontFamily('ReaderInter')
        .fontWeight(FontWeight.Regular)
        .fontSize(13)
        .lineHeight(19.5)
        .fontColor(TOK_MUTED)
        .textAlign(TextAlign.Center)
        .maxLines(2);

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
      .onClick((): void => this.onRetry())
      .responseRegion({ x: 0, y: -4, width: '100%', height: 48 })
      .accessibilityText('重新搜索');

      Text('检查书源')
        .fontFamily('ReaderInter')
        .fontWeight(FontWeight.Bold)
        .fontSize(13)
        .lineHeight(13)
        .fontColor(TOK_MUTED)
        .padding({ left: 18.5, right: 18.5, top: 11.5, bottom: 11.5 })
        .backgroundColor(TOK_CARD_BG)
        .border({ width: TOK_BORDER_W, color: TOK_BORDER })
        .borderRadius(999)
        .margin({ top: TOK_SPACE_CONTROL_INLINE })
        .onClick((): void => this.onManageSources())
        .responseRegion({ x: 0, y: -4, width: '100%', height: 44 })
        .accessibilityText('检查书源');
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
