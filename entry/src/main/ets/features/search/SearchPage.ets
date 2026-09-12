import { SearchViewState } from './SearchViewState';
import { bookIntroText } from '../common/BookIntroText';
import {
  type SearchBook,
  type SearchSource,
} from './SearchGateway';
import type { ShelfBook } from '../../app/ReaderCoreGateway';
import { readerSourceCategoryIsText } from '../source/ReaderSourceCategory';
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
  localSearchFailed?: boolean;
  sourceListFailed?: boolean;
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
  localSearchFailed?: boolean;
  sourceListFailed?: boolean;
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
  localSearchFailed?: boolean;
  sourceListFailed?: boolean;
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

@Observed
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

class SearchResultDataSource implements IDataSource {
  private items: SearchBookGroup[] = [];
  private keys: string[] = [];
  private listeners: DataChangeListener[] = [];

  totalCount(): number { return this.items.length; }
  getData(index: number): SearchBookGroup { return this.items[index]; }

  registerDataChangeListener(listener: DataChangeListener): void {
    if (this.listeners.indexOf(listener) < 0) this.listeners.push(listener);
  }

  unregisterDataChangeListener(listener: DataChangeListener): void {
    const index = this.listeners.indexOf(listener);
    if (index >= 0) this.listeners.splice(index, 1);
  }

  private key(group: SearchBookGroup): string {
    const book = group.book;
    if (book.sourceId === 'local') return `local:${book.bookId}`;
    if (book.groupKey !== undefined) return `online:${book.groupKey}`;
    const alias = `${book.title.trim().replace(/\s+/g, ' ').toLocaleLowerCase()}\u0000${book.author.trim().replace(/\s+/g, ' ').toLocaleLowerCase()}`;
    return `online:${alias}`;
  }

  private update(retained: SearchBookGroup, next: SearchBookGroup): void {
    retained.book = next.book;
    retained.sourceCount = next.sourceCount;
    retained.inBookshelf = next.inBookshelf;
    retained.sourceIds = next.sourceIds;
    retained.variants = next.variants;
  }

  replace(items: SearchBookGroup[]): void {
    // Streaming additions are the common path. Compute each next key once;
    // never scan existing groups (and invoke ICU) for a key not in the list.
    const nextKeys = items.map((group: SearchBookGroup): string => this.key(group));
    const nextKeySet = new Set<string>(nextKeys);
    // Remove only disappeared rows first. A source/category removal leaves a
    // subsequence, not thousands of artificial row moves and key scans.
    for (let index = this.keys.length - 1; index >= 0; index -= 1) {
      if (!nextKeySet.has(this.keys[index])) {
        this.items.splice(index, 1);
        this.keys.splice(index, 1);
        for (const listener of this.listeners) listener.onDataDelete(index);
      }
    }
    const knownKeys = new Set<string>(this.keys);
    // Incremental notifications preserve visible lazy rows. Reloading the
    // entire data source defeats ArkUI's visible-content-position guarantee.
    for (let index = 0; index < items.length; index += 1) {
      let next = items[index];
      const nextKey = nextKeys[index];
      if (this.items[index] !== undefined && this.keys[index] === nextKey) {
        const retained = this.items[index];
        this.update(retained, next);
        for (const listener of this.listeners) listener.onDataChange(index);
        continue;
      }
      const previous = knownKeys.has(nextKey) ? this.keys.indexOf(nextKey) : -1;
      if (previous >= 0) {
        const retained = this.items[previous];
        this.update(retained, next);
        next = retained;
        this.items.splice(previous, 1);
        this.keys.splice(previous, 1);
        for (const listener of this.listeners) listener.onDataDelete(previous);
      }
      this.items.splice(index, 0, next);
      this.keys.splice(index, 0, nextKey);
      knownKeys.add(nextKey);
      for (const listener of this.listeners) listener.onDataAdd(index);
    }
    while (this.items.length > items.length) {
      this.items.splice(items.length, 1);
      this.keys.splice(items.length, 1);
      for (const listener of this.listeners) listener.onDataDelete(items.length);
    }
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
  @Prop @Watch('refreshVisibleResults') presentation: SearchPresentation;
  @Prop sources: SearchSource[];
  viewState: SearchViewState = new SearchViewState();
  private resultScroller: Scroller = new Scroller();
  private restoreKey: string = '';
  private restoreOffset: number = 0;
  private restoreItemY: number = 0;
  private scrollRestored: boolean = false;
  private viewStateRevision: number = -1;
  @Prop @Watch('refreshVisibleResults') shelfBooks: ShelfBook[] = [];
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
  // Product result categories filter one session; changing a chip never
  // starts another network sweep.
  @State selectedGroupName: string = '全部';
  @State private visibleGroups: SearchBookGroup[] = [];
  private resultDataSource: SearchResultDataSource = new SearchResultDataSource();
  private groupedCategory: string = '';
  private groupedResultsInput: SearchBook[] | undefined = undefined;
  private groupedShelfInput: ShelfBook[] | undefined = undefined;
  private groupedResultsCache: SearchBookGroup[] = [];

  aboutToAppear(): void {
    registerReaderFonts(this.getUIContext().getFont());
    this.restoreKey = this.viewState.anchorKey;
    this.restoreOffset = this.viewState.anchorOffset;
    this.restoreItemY = this.viewState.anchorItemY;
    this.scrollRestored = false;
    this.selectedGroupName = this.viewState.category;
    this.historyExpanded = this.viewState.historyExpanded;
    this.keyword = this.viewState.keywordDraft;
    this.refreshVisibleResults();
  }

  build() {
    Column() {
      this.searchBar();
      if (this.presentation.kind === 'results' || this.presentation.kind === 'empty') {
        this.groupScopeRow();
      }
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
    this.viewState.reset(keyword);
    this.selectedGroupName = '全部';
    this.onSearch(keyword, scope);
  }

  /** undefined = all enabled sources; otherwise the selected group's usable subset. */
  private scopeSourceIds(): string[] | undefined {
    return undefined;
  }

  private groupNames(): string[] {
    return ['本地', '在线'];
  }

  private selectGroup(name: string): void {
    this.selectedGroupName = name;
    this.viewState.category = name;
    this.viewState.anchorKey = '';
    this.viewState.anchorOffset = 0;
    this.viewState.anchorIndex = 0;
    this.viewState.anchorItemY = 0;
    this.resultScroller.scrollTo({ xOffset: 0, yOffset: 0 });
    this.refreshVisibleResults();
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
            this.viewState.keywordDraft = value;
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
      this.initialContent();
    } else if (this.presentation.kind === 'loading') {
      this.loadingContent();
    } else if (this.presentation.kind === 'results') {
      this.resultsContent();
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

  // Reads presentation.history directly (never a @Builder value parameter):
  // loadHistory resolves after presentInitial() with the same presentation
  // kind, and untracked parameters would keep the stale empty-history
  // snapshot — the same ACQ-02 @Builder-parameter trap.
  @Builder
  private initialContent() {
    Column({ space: 0 }) {
      if (this.presentation.kind === 'initial' && this.presentation.history.length > 0) {
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
          ForEach(this.historyExpanded ? this.presentation.history :
            this.presentation.history.slice(0, 4), (keyword: string) => {
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
          if (this.presentation.history.length > 4 && !this.historyExpanded) {
            this.moreChip(this.presentation.history.length - 4);
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

  // Figma 2635:58985 / 2635:59076: the chip wall sits directly under the
  // search bar in Results/Empty — row 41.5 tall, chips 23 tall, 8px gaps,
  // horizontally scrollable when the group names overflow.
  @Builder
  private groupScopeRow() {
    if (this.groupNames().length > 0) {
      Scroll() {
        Row({ space: TOK_SPACE_XS }) {
          this.groupScopeChip('全部');
          ForEach(this.groupNames(), (name: string) => {
            this.groupScopeChip(name);
          }, (name: string): string => `search-group-${name}`);
        }
        .alignItems(VerticalAlign.Center)
        .padding({ left: this.isTablet ? 20 : 16, right: this.isTablet ? 20 : 16 });
      }
      .scrollable(ScrollDirection.Horizontal)
      .scrollBar(BarState.Off)
      .width('100%')
      .height(41.5)
      .align(Alignment.Start);
    }
  }

  @Builder
  private groupScopeChip(label: string) {
    Text(label)
      .fontFamily('ReaderInter')
      .fontWeight(this.selectedGroupName === label ? FontWeight.Bold : FontWeight.Medium)
      .fontSize(12)
      .lineHeight(12)
      .fontColor(this.selectedGroupName === label ? TOK_ON_PRIMARY : TOK_INK)
      .padding({ left: 10, right: 10, top: 5.5, bottom: 5.5 })
      .backgroundColor(this.selectedGroupName === label ? TOK_GREEN : TOK_PAPER)
      .border({ width: TOK_BORDER_W, color: this.selectedGroupName === label ? TOK_GREEN : TOK_BORDER })
      .borderRadius(999)
      .maxLines(1)
      .textOverflow({ overflow: TextOverflow.Ellipsis })
      .constraintSize({ maxWidth: 160 })
      .onClick((): void => this.selectGroup(label))
      .accessibilityText(this.selectedGroupName === label ? `当前搜索范围:${label}` : `筛选搜索结果:${label}`);
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
      this.viewState.historyExpanded = true;
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
      Text('正在搜索本地与在线书籍…')
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

  private refreshVisibleResults(): void {
    if (this.viewStateRevision !== this.viewState.revision) {
      this.viewStateRevision = this.viewState.revision;
      this.selectedGroupName = this.viewState.category;
      this.keyword = this.viewState.keywordDraft;
      this.historyExpanded = this.viewState.historyExpanded;
      this.restoreKey = this.viewState.anchorKey;
      this.restoreOffset = this.viewState.anchorOffset;
      this.restoreItemY = this.viewState.anchorItemY;
      this.scrollRestored = false;
      this.groupedResultsInput = undefined;
    }
    // API 23 can retain Repeat rows after replacement even with a state
    // array. Notify a lazy data source explicitly, as Source Management does.
    const groups = this.presentation.kind === 'results'
      ? this.groupResults(this.presentation.results) : [];
    this.visibleGroups = groups;
    this.resultDataSource.replace(groups);
  }

  // ArkUI does not track mutable @Builder value parameters. Read state at
  // the consuming nodes so category changes and stop both update in place.
  @Builder
  private resultsContent() {
    Stack({ alignContent: Alignment.Bottom }) {
      Column() {
        Row() {
          Text('找到 ')
            .fontFamily('ReaderInter')
            .fontWeight(FontWeight.Regular)
            .fontSize(11)
            .lineHeight(16.5)
            .fontColor(TOK_MUTED);
          Text(`${this.visibleGroups.length}`)
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
            if (this.presentation.localSearchFailed || this.presentation.sourceListFailed) {
              Text('部分搜索未完成，请重试').fontSize(12).fontColor(TOK_MUTED);
            }
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
              Text(` · 正在搜索 ${this.presentation.completedSourceCount}/${this.presentation.totalSourceCount} 个书源,已返回 ${this.visibleGroups.length} 个`)
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

        List({ scroller: this.resultScroller }) {
          LazyForEach(this.resultDataSource, (group: SearchBookGroup) => {
            ListItem() {
              SearchResultCard({ group, isTablet: this.isTablet, cardWidth: this.contentFrame().width,
                onSelectResult: (book: SearchBook, variants: SearchBook[]): void => this.onSelectResult(book, variants) });
            }
          }, (group: SearchBookGroup): string =>
            this.resultGroupKey(group.book));
        }
        .width('100%')
        .layoutWeight(1)
        .scrollBar(BarState.Off)
        .maintainVisibleContentPosition(true)
        .onScrollIndex((start: number): void => {
          if (!this.scrollRestored) return;
          const group = this.visibleGroups[start];
          if (group === undefined) return;
          this.viewState.anchorIndex = start;
          this.viewState.anchorKey = this.resultGroupKey(group.book);
          this.saveScrollAnchor();
        })
        .onScroll((): void => { if (this.scrollRestored) this.saveScrollAnchor(); })
        .onAppear((): void => {
          const anchor = this.visibleGroups.findIndex((group: SearchBookGroup): boolean =>
            this.resultGroupKey(group.book) === this.restoreKey);
          if (anchor >= 0) {
            this.resultScroller.scrollToIndex(anchor, false, ScrollAlign.START);
            // Correct by measured item coordinates after the indexed jump;
            // metadata may have changed the heights of preceding cards.
            setTimeout((): void => {
              try {
                const currentY = this.resultScroller.getItemRect(anchor).y;
                this.resultScroller.scrollBy(0, currentY - this.restoreItemY);
              } catch (_error) { /* The anchor may have disappeared after source deletion. */ }
              this.scrollRestored = true;
            }, 0);
          } else {
            this.resultScroller.scrollTo({ xOffset: 0, yOffset: this.restoreOffset });
            this.scrollRestored = true;
          }
        });
      }
      .width('100%')
      .height('100%');

      // Product-approved extension (no Figma frame): while the source sweep is
      // still running the live query indicator stays anchored at the same
      // bottom position as the no-results loading state, as a non-interactive
      // overlay — every touch reaches the result list beneath it.
      if (this.presentation.kind === 'results' && this.presentation.searching) {
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

  private groupResults(results: SearchBook[]): SearchBookGroup[] {
    if (this.groupedResultsInput === results && this.groupedShelfInput === this.shelfBooks &&
      this.groupedCategory === this.selectedGroupName) {
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
      const local = book.sourceId === 'local';
      if ((this.selectedGroupName === '本地' && !local) ||
        (this.selectedGroupName === '在线' && local)) continue;
      const titleKey = book.groupKey ?? this.normalizedBookKey(book.title, book.author);
      const key = this.resultGroupKey(book);
      this.viewState.rank(key);
      const inBookshelf = shelfIdentityKeys.has(`${book.sourceId}\u0000${book.bookId}`) ||
        (!local && shelfBookKeys.has(titleKey));
      const existing = byBook.get(key);
      if (existing === undefined) {
        byBook.set(key, new SearchBookGroup(book, 1, inBookshelf));
      } else {
        existing.admit(book, inBookshelf);
      }
    }
    // Freeze first-seen order within this query so enrichment/source counts
    // cannot move the book under the user's finger or invalidate the anchor.
    const grouped = Array.from(byBook.values()).sort((left: SearchBookGroup, right: SearchBookGroup): number =>
      this.viewState.rank(this.resultGroupKey(left.book)) - this.viewState.rank(this.resultGroupKey(right.book)));
    this.groupedCategory = this.selectedGroupName;
    this.groupedResultsInput = results;
    this.groupedShelfInput = this.shelfBooks;
    this.groupedResultsCache = grouped;
    return grouped;
  }

  private saveScrollAnchor(): void {
    this.viewState.anchorOffset = this.resultScroller.currentOffset().yOffset;
    try { this.viewState.anchorItemY = this.resultScroller.getItemRect(this.viewState.anchorIndex).y; }
    catch (_error) { /* A lazy row can be between layout passes. */ }
  }

  private resultGroupKey(book: SearchBook): string {
    return book.sourceId === 'local' ? `local:${book.bookId}` :
      `online:${book.groupKey ?? this.normalizedBookKey(book.title, book.author)}`;
  }

  private normalizedBookKey(title: string, author: string): string {
    return `${title.trim().replace(/\s+/g, ' ').toLocaleLowerCase()}\u0000${author.trim().replace(/\s+/g, ' ').toLocaleLowerCase()}`;
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

/** A stable lazy row observes enrichment without remounting the whole result. */
@Component
struct SearchResultCard {
  // LazyForEach supplies a regular row value.  ObjectLink requires the
  // parent to pass an @Observed-owned object and the compiler otherwise
  // rejects this boundary; the data source emits an explicit row change when
  // an existing observed group is enriched in place.
  @Prop group: SearchBookGroup;
  @Prop isTablet: boolean = false;
  @Prop cardWidth: number = 0;
  onSelectResult: (book: SearchBook, variants: SearchBook[]) => void = (): void => {};

  private displayIntro(): string {
    return bookIntroText(this.group.book.intro);
  }

  build() {
    Row({ space: TOK_SPACE_SM }) {
      Stack({ alignContent: Alignment.Bottom }) {
        if (this.group.book.coverUrl !== undefined && this.group.book.coverUrl.trim().length > 0) {
          Image(this.group.book.coverUrl)
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
            Text(this.group.book.title)
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
        Text(this.group.book.title)
          .width('100%')
          .fontFamily('ReaderNotoSerifSCBold')
          .fontWeight(FontWeight.Bold)
          .fontSize(15)
          .lineHeight(19.5)
          .fontColor(TOK_INK)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis });

        Text(this.group.book.author)
          .width('100%')
          .fontFamily('ReaderInter')
          .fontWeight(FontWeight.Regular)
          .fontSize(12)
          .lineHeight(12)
          .fontColor(TOK_MUTED)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis });

        if (this.group.book.latestChapterTitle !== undefined) {
          Text(this.group.book.latestChapterTitle)
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

        if (this.displayIntro().length > 0) {
          Text(this.displayIntro())
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
          Text(this.group.book.sourceName.length > 0 ? this.group.book.sourceName : this.group.book.sourceId)
            .fontFamily('ReaderInter')
            .fontWeight(FontWeight.Bold)
            .fontSize(10)
            .lineHeight(10)
            .fontColor(TOK_GREEN)
            .padding({ left: 6, right: 6, top: 2, bottom: 2 })
            .backgroundColor(TOK_PRIMARY_SOFT)
            .borderRadius(4)
            .maxLines(1);
          Text(this.group.book.sourceId === 'local' ? '本地书籍' : `已发现 ${this.group.sourceCount} 个书源`)
            .fontFamily('ReaderInter')
            .fontWeight(FontWeight.Regular)
            .fontSize(11)
            .lineHeight(16.5)
            .fontColor(TOK_MUTED)
            .maxLines(1);
          if (this.group.inBookshelf) {
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
    .width(this.cardWidth)
    .padding({ left: this.isTablet ? 20 : 18, right: this.isTablet ? 20 : 18, top: TOK_SPACE_CARD_PADDING, bottom: 14.5 })
    .alignItems(VerticalAlign.Top)
    .border({ width: { bottom: TOK_BORDER_W }, color: { bottom: TOK_BORDER } })
    .onClick((): void => this.onSelectResult(this.group.book, this.group.variants));
  }
}
