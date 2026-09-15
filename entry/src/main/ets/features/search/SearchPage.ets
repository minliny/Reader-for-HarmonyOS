import { bookAuthorLabel, bookTitleAuthorKey } from '../common/BookAuthorMetadata';
import { FrameCallback, LengthMetrics } from '@kit.ArkUI';
import { SearchResultProjection } from './SearchResultProjection';
import { readerAppColor } from '../common/ReaderThemeRegistry';
import { SearchSpinner } from './SearchSpinner';
import { SearchViewState } from './SearchViewState';
import { SearchPublication } from './SearchPublication';
import type { SearchPresentation } from './SearchPresentation';
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

export type {
  SearchInitialPresentation,
  SearchLoadingPresentation,
  SearchResultsPresentation,
  SearchEmptyPresentation,
  SearchErrorPresentation,
  SearchSourceRequiredPresentation,
  SearchSourceLoadErrorPresentation,
  SearchPresentation,
} from './SearchPresentation';

class SearchLayoutFrame extends FrameCallback {
  private action: () => void;
  constructor(action: () => void) { super(); this.action = action; }
  onFrame(_time: number): void {}
  onIdle(_remaining: number): void { this.action(); }
}

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
  private input: SearchBookGroup[] | undefined = undefined;
  private positions: Map<string, number> = new Map();

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
    const alias = bookTitleAuthorKey(book.title, book.author, book.authorIdentity, book.sourceRuleVersion);
    return `online:${alias}`;
  }

  private sameBook(left: SearchBook, right: SearchBook): boolean {
    return left === right || (left.sourceId === right.sourceId && left.bookId === right.bookId &&
      left.groupKey === right.groupKey && left.title === right.title && left.author === right.author &&
      (left.authorIdentity === right.authorIdentity || JSON.stringify(left.authorIdentity) === JSON.stringify(right.authorIdentity)) &&
      left.sourceName === right.sourceName && left.coverUrl === right.coverUrl && left.intro === right.intro &&
      left.kind === right.kind && left.latestChapterTitle === right.latestChapterTitle &&
      left.category === right.category && left.detailUrl === right.detailUrl &&
      left.searchRequestId === right.searchRequestId && left.sourceRuleVersion === right.sourceRuleVersion &&
      left.bookSourceUrl === right.bookSourceUrl &&
      (left.variables === right.variables || JSON.stringify(left.variables) === JSON.stringify(right.variables)) &&
      (left.acquisition === right.acquisition || JSON.stringify(left.acquisition) === JSON.stringify(right.acquisition)));
  }

  private update(retained: SearchBookGroup, next: SearchBookGroup): boolean {
    if (retained === next) return false;
    let changed = false;
    if (!this.sameBook(retained.book, next.book)) { retained.book = next.book; changed = true; }
    if (retained.sourceCount !== next.sourceCount) { retained.sourceCount = next.sourceCount; changed = true; }
    if (retained.inBookshelf !== next.inBookshelf) { retained.inBookshelf = next.inBookshelf; changed = true; }
    if (retained.sourceIds.length !== next.sourceIds.length ||
      retained.sourceIds.some((id: string, index: number): boolean => id !== next.sourceIds[index])) {
      retained.sourceIds = next.sourceIds; changed = true;
    }
    if (retained.variants.length !== next.variants.length ||
      retained.variants.some((book: SearchBook, index: number): boolean => !this.sameBook(book, next.variants[index]))) {
      retained.variants = next.variants; changed = true;
    }
    return changed;
  }

  replace(items: SearchBookGroup[], changedKeys?: Set<string>): boolean {
    if (this.input === items && changedKeys !== undefined) {
      const operations: DataOperation[] = [];
      for (const key of changedKeys) {
        const index = this.positions.get(key);
        if (index !== undefined && this.update(this.items[index], items[index])) {
          operations.push({ type: DataOperationType.CHANGE, index });
        }
      }
      if (operations.length > 0) for (const listener of this.listeners) listener.onDatasetChange(operations);
      return false;
    }
    const oldItems = this.items;
    const oldKeys = this.keys;
    const previous = new Map<string, SearchBookGroup>();
    for (let index = 0; index < oldKeys.length; index++) previous.set(oldKeys[index], oldItems[index]);
    const nextKeys: string[] = [];
    const nextItems: SearchBookGroup[] = [];
    const changes: number[] = [];
    const additions: number[] = [];
    const nextSet = new Set<string>();
    for (let index = 0; index < items.length; index++) {
      const next = items[index]; const key = this.key(next);
      nextKeys.push(key); nextSet.add(key);
      const retained = previous.get(key);
      if (retained === undefined) { nextItems.push(next); additions.push(index); }
      else {
        if (this.update(retained, next) || changedKeys?.has(key)) changes.push(this.positions.get(key) as number);
        nextItems.push(retained);
      }
    }
    const retainedOld = oldKeys.filter((key: string): boolean => nextSet.has(key));
    const retainedNext = nextKeys.filter((key: string): boolean => previous.has(key));
    const reordered = retainedOld.some((key: string, index: number): boolean => key !== retainedNext[index]);
    const operations: DataOperation[] = [];
    if (reordered) {
      const nextPositions = new Map<string, number>();
      for (let index = 0; index < nextKeys.length; index++) nextPositions.set(nextKeys[index], index);
      const moved: string[] = [];
      for (const key of changedKeys ?? []) if (this.positions.has(key) &&
        nextPositions.has(key) && this.positions.get(key) !== nextPositions.get(key)) moved.push(key);
      const single = moved.length === 1 && oldKeys.length === nextKeys.length && additions.length === 0;
      const oldRest = single ? oldKeys.filter((key: string): boolean => key !== moved[0]) : [];
      const nextRest = single ? nextKeys.filter((key: string): boolean => key !== moved[0]) : [];
      if (single && oldRest.every((key: string, index: number): boolean => key === nextRest[index])) {
        // A known group changed relevance: SDK MOVE uses old and final
        // positions. Legacy onDataMove is an exchange and is never used.
        operations.push({ type: DataOperationType.MOVE, index: {
          from: this.positions.get(moved[0]) as number, to: nextPositions.get(moved[0]) as number } });
        for (const index of changes) if (index !== this.positions.get(moved[0]) && index !== nextPositions.get(moved[0])) {
          operations.push({ type: DataOperationType.CHANGE, index });
        }
      } else {
        // Arbitrary permutations belong to ArkUI's keyed comparison, not a
        // second Reader diff engine. The page restores its measured anchor.
        operations.push({ type: DataOperationType.RELOAD });
      }
    } else {
      // A metadata update or insertion/deletion preserves the retained order.
      // Build the next arrays once; no repeated indexOf/splice shifting.
      for (let index = oldKeys.length - 1; index >= 0;) {
        if (nextSet.has(oldKeys[index])) { index--; continue; }
        const end = index;
        while (index >= 0 && !nextSet.has(oldKeys[index])) index--;
        operations.push({ type: DataOperationType.DELETE, index: index + 1, count: end - index });
      }
      // All SDK batch indexes refer to the original array, not sequential
      // mutation positions. Added runs are anchored before the next old row.
      const additionAnchors: Map<number, number> = new Map();
      let nextOriginal = oldKeys.length;
      for (let index = nextKeys.length - 1; index >= 0; index--) {
        const original = this.positions.get(nextKeys[index]);
        if (original !== undefined) nextOriginal = original;
        else additionAnchors.set(index, nextOriginal);
      }
      const insertedAt = new Set<number>();
      for (let position = 0; position < additions.length;) {
        const start = additions[position]; let end = position + 1;
        while (end < additions.length && additions[end] === additions[end - 1] + 1) end++;
        const anchor = additionAnchors.get(start) as number; insertedAt.add(anchor);
        operations.push({ type: DataOperationType.ADD, index: anchor, count: end - position,
          key: nextKeys.slice(start, start + end - position) });
        position = end;
      }
      // ArkUI admits only the first operation at an old index. The observed
      // retained row already carries changed fields when an ADD owns its index.
      for (const index of changes) if (!insertedAt.has(index)) operations.push({ type: DataOperationType.CHANGE, index });
    }
    this.items = nextItems; this.keys = nextKeys;
    this.input = items;
    this.positions = new Map();
    for (let index = 0; index < nextKeys.length; index++) this.positions.set(nextKeys[index], index);
    if (operations.length > 0) for (const listener of this.listeners) {
      listener.onDatasetChange(operations);
    }
    return reordered;
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
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';

  @StorageLink('readerWindowMetricsRevision') private readerWindowMetricsRevision: number = 0;
  @Prop @Watch('acceptPublication') publicationRevision: number = 0;
  publication: SearchPublication = new SearchPublication();
  // @State observes the top-level reference without @Prop's recursive copy.
  // Status Builders receive native dependency updates; nested immutable books
  // retain their identities for the incremental projection.
  @State private presentation: SearchPresentation = { kind: 'initial', history: [] };
  private shelfBooks: ShelfBook[] = [];
  viewState: SearchViewState = new SearchViewState();
  private resultScroller: Scroller = new Scroller();
  private restoreKey: string = '';
  private restoreOffset: number = 0;
  private restoreItemY: number = 0;
  private scrollRestored: boolean = false;
  private viewStateRevision: number = -1;
  @Prop isTablet: boolean;
  @Prop reduceMotion: boolean = false;
  @State private historyWidth: number = 0;
  @State private spinnerRunKey: number = 0;
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
  onVisibleGroups: (groups: SearchBook[][]) => void = (_groups: SearchBook[][]): void => {};
  private visibleStart: number = 0;
  private visibleEnd: number = 0;
  private warmupGroups: SearchBook[][] = [];
  onRetry: () => void = (): void => {};
  onManageSources: () => void = (): void => {};
  @State keyword: string = '';
  @State private focusInputOnAppear: boolean = false;
  // Product result categories filter one session; changing a chip never
  // starts another network sweep.
  @State selectedGroupName: string = '全部';
  @State private visibleGroups: SearchBookGroup[] = [];
  private acceptedVisibleGroups: SearchBookGroup[] | undefined = undefined;
  private resultDataSource: SearchResultDataSource = new SearchResultDataSource();
  private groupedCategory: string = '';
  private groupedResultsCache: SearchBookGroup[] = [];
  private resultProjection: SearchResultProjection | undefined = undefined;
  private projectedGroups: Map<string, SearchBookGroup> = new Map();
  private projectedGroupKeys: string[] = [];
  private projectedGroupIndexes: Map<string, number> = new Map();
  private changedGroupKeys: Set<string> = new Set();
  private pageEpoch: number = 0;
  private listEpoch: number = 0;
  private restoreEpoch: number = 0;
  private pageMounted: boolean = false;
  private listMounted: boolean = false;
  private restoreCancelled: boolean = false;
  private userInteracting: boolean = false;
  private userScrolling: boolean = false;
  private restoreScheduled: boolean = false;

  private acceptPublication(): void {
    this.presentation = this.publication.presentationAt(this.publicationRevision);
    this.shelfBooks = this.publication.shelfAt(this.publicationRevision);
    this.refreshVisibleResults();
  }

  aboutToAppear(): void {
    this.pageMounted = true;
    this.pageEpoch = ++this.viewState.pageRevision;
    this.restoreCancelled = false;
    registerReaderFonts(this.getUIContext().getFont());
    this.restoreKey = this.viewState.anchorKey;
    this.restoreOffset = this.viewState.anchorOffset;
    this.restoreItemY = this.viewState.anchorItemY;
    this.scrollRestored = false;
    this.selectedGroupName = this.viewState.category;
    this.focusInputOnAppear = this.viewState.consumeInputFocusRequest();
    this.keyword = this.viewState.keywordDraft;
    this.acceptPublication();
  }

  aboutToDisappear(): void {
    this.rememberAnchorNeighbors();
    this.pageMounted = false;
    this.listMounted = false;
    this.restoreEpoch += 1;
    this.restoreScheduled = false;
    this.onVisibleGroups([]);
  }

  private publishVisibleGroups(start: number = this.visibleStart, end: number = this.visibleEnd): void {
    this.visibleStart = Math.max(0, start);
    this.visibleEnd = Math.max(this.visibleStart, end);
    const groups = this.presentation.kind !== 'results' || this.presentation.stopped === true ? [] :
      this.visibleGroups.slice(this.visibleStart, Math.min(this.visibleEnd + 1, this.visibleStart + 6))
        .filter((group: SearchBookGroup): boolean => group.book.sourceId !== 'local')
        .map((group: SearchBookGroup): SearchBook[] => group.variants);
    if (groups.length === this.warmupGroups.length && groups.every((group: SearchBook[], i: number): boolean =>
      group.length === this.warmupGroups[i].length && group.every((book: SearchBook, j: number): boolean =>
        book === this.warmupGroups[i][j]))) return;
    this.warmupGroups = groups;
    this.onVisibleGroups(groups);
  }

  build() {
    Stack({ alignContent: Alignment.Bottom }) {
      Column() {
        this.searchBar();
        if (this.presentation.kind === 'results' || this.presentation.kind === 'empty') {
          this.groupScopeRow();
        }
        Column() { this.stateContent(); }.layoutWeight(1).width('100%');
      }.width('100%').height('100%');
      // Stable actor anchored to the whole safe viewport, outside changing
      // source/category/result rows. Caption keeps its lane during streaming.
      Column({ space: 18 }) {
        SearchSpinner({ active: this.isSweeping(), runKey: this.spinnerRunKey,
          reduceMotion: this.reduceMotion, diameter: 36 });
        Text('正在搜索本地与在线书籍…').fontFamily('ReaderInter')
          .fontWeight(FontWeight.Regular).fontSize(13).lineHeight(19.5).fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme))
          .textAlign(TextAlign.Center)
          .opacity(this.presentation.kind === 'loading' ? 1 : 0);
      }.width('100%').margin({ bottom: 48 })
        .visibility(this.isSweeping() ? Visibility.Visible : Visibility.Hidden)
        .hitTestBehavior(HitTestMode.None);
    }
    .width('100%').height('100%')
    .padding({ left: this.contentFrame().left, right: this.contentFrame().right })
    .backgroundColor(readerAppColor('TOK_PAPER', this.appThemeScheme));
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
    this.restoreEpoch += 1;
    this.restoreCancelled = false;
    this.selectedGroupName = name;
    this.viewState.category = name;
    this.viewState.anchorKey = '';
    this.viewState.anchorOffset = 0;
    this.viewState.anchorIndex = 0;
    this.viewState.anchorItemY = 0;
    this.restoreKey = ''; this.restoreOffset = 0; this.restoreItemY = 0;
    this.viewState.anchorNeighbors = []; this.scrollRestored = false;
    this.resultScroller.scrollTo({ xOffset: 0, yOffset: 0 });
    this.refreshVisibleResults();
  }

  @Builder
  private searchBar() {
    Row({ space: TOK_SPACE_CONTROL_INLINE }) {
      Stack({ alignContent: Alignment.Center }) {
        Image((this.appThemeScheme === 'night' ? $r('app.media.search_back_theme_night') : $r('app.media.search_back'))).width(20).height(20);
      }
      .width(32)
      .height(32)
      .borderRadius(16)
      .onClick((): void => this.onBack());

      Row() {
        ReaderSearchField({
          variant: 'bookPage',
          mode: 'submit',
          focusOnAppear: this.focusInputOnAppear,
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
        if (this.isSweeping()) {
          Row({ space: 6 }) {
            SearchSpinner({ active: this.isSweeping(), runKey: this.spinnerRunKey,
              reduceMotion: this.reduceMotion, diameter: 13, light: true });
            Text('停止')
              .fontFamily('ReaderInter')
              .fontWeight(800)
              .fontSize(this.isTablet ? 14 : 13)
              .lineHeight(this.isTablet ? 14 : 13)
              .fontColor(readerAppColor('TOK_ON_PRIMARY', this.appThemeScheme));
          }
          .alignItems(VerticalAlign.Center);
        } else {
          Text('搜索')
            .fontFamily('ReaderInter')
            .fontWeight(800)
            .fontSize(this.isTablet ? 14 : 13)
            .lineHeight(this.isTablet ? 14 : 13)
            .fontColor(readerAppColor('TOK_ON_PRIMARY', this.appThemeScheme));
        }
      }
      .height(this.isTablet ? 40 : 36)
      .padding({ left: this.isTablet ? 18 : TOK_SPACE_CARD_PADDING, right: this.isTablet ? 18 : TOK_SPACE_CARD_PADDING })
      .backgroundColor(readerAppColor('app.action.fill', this.appThemeScheme))
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
    .border({ width: { bottom: TOK_BORDER_W }, color: { bottom: readerAppColor('TOK_BORDER', this.appThemeScheme) } });
  }

  @Builder
  private stateContent() {
    if (this.presentation.kind === 'initial') {
      Scroll() { this.initialContent(); }.width('100%').height('100%')
        .align(Alignment.TopStart).scrollBar(BarState.Off);
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
            .fontColor(readerAppColor('TOK_INK', this.appThemeScheme))
            .layoutWeight(1);
          Text('清空记录')
            .fontFamily('ReaderInter')
            .fontWeight(FontWeight.Medium)
            .fontSize(12)
            .lineHeight(18)
            .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme))
            .onClick((): void => this.onClearHistory());
        }
        .width('100%')
        .height(26)
        .alignItems(VerticalAlign.Center);

        // All retained history is visible inside the existing page Scroll.
        Flex({ wrap: FlexWrap.Wrap, direction: FlexDirection.Row }) {
          ForEach(this.presentation.history, (keyword: string) => {
            Text(keyword)
              .fontFamily('ReaderInter')
              .fontWeight(FontWeight.Medium)
              .fontSize(13)
              .lineHeight(19.5)
              .fontColor(readerAppColor('TOK_INK', this.appThemeScheme))
              .padding({ left: 14.5, right: 14.5, top: 7.5, bottom: 7.5 })
              .backgroundColor(readerAppColor('TOK_CARD_BG', this.appThemeScheme))
              .border({ width: TOK_BORDER_W, color: readerAppColor('TOK_BORDER', this.appThemeScheme) })
              .borderRadius(999)
              .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis })
              .constraintSize({ maxWidth: this.historyWidth > 0 ? Math.max(0, this.historyWidth - TOK_SPACE_XS) : '100%' })
              .margin({ right: TOK_SPACE_XS, bottom: TOK_SPACE_XS })
              .onClick((): void => {
                this.keyword = keyword;
                this.submitSearch();
              });
          }, (keyword: string): string => `search-history-${keyword}`);
        }
        .width('100%')
        .padding({ top: TOK_SPACE_CARD_PADDING });

      }
    }
    .width('100%')
    .padding({
      left: this.isTablet ? 20 : 18,
      right: this.isTablet ? 20 : 18,
      top: TOK_SPACE_XS,
      bottom: 20,
    })
    // Only constrain long chip width; history admission never depends on measurement.
    .onAreaChange((_old: Area, next: Area): void => {
      const outerWidth = Number(next.width);
      if (!Number.isFinite(outerWidth)) return;
      const width = Math.max(0, outerWidth - (this.isTablet ? 40 : 36));
      if (Math.abs(width - this.historyWidth) > .1) {
        this.historyWidth = width;
      }
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
      .fontColor(this.selectedGroupName === label ? readerAppColor('TOK_ON_PRIMARY', this.appThemeScheme) : readerAppColor('TOK_INK', this.appThemeScheme))
      .padding({ left: 10, right: 10, top: 5.5, bottom: 5.5 })
      .backgroundColor(this.selectedGroupName === label ? readerAppColor('app.action.fill', this.appThemeScheme) : readerAppColor('TOK_PAPER', this.appThemeScheme))
      .border({ width: TOK_BORDER_W, color: this.selectedGroupName === label ? readerAppColor('TOK_GREEN', this.appThemeScheme) : readerAppColor('TOK_BORDER', this.appThemeScheme) })
      .borderRadius(999)
      .maxLines(1)
      .textOverflow({ overflow: TextOverflow.Ellipsis })
      .constraintSize({ maxWidth: 160 })
      .onClick((): void => this.selectGroup(label))
      .accessibilityText(this.selectedGroupName === label ? `当前搜索范围:${label}` : `筛选搜索结果:${label}`);
  }

  @Builder
  private loadingContent() {
    Blank().width('100%').height('100%');
  }

  private refreshVisibleResults(): void {
    this.spinnerRunKey = this.viewState.revision;
    if (this.viewStateRevision !== this.viewState.revision) {
      this.viewStateRevision = this.viewState.revision;
      this.selectedGroupName = this.viewState.category;
      this.keyword = this.viewState.keywordDraft;
      this.restoreKey = this.viewState.anchorKey;
      this.restoreOffset = this.viewState.anchorOffset;
      this.restoreItemY = this.viewState.anchorItemY;
      this.scrollRestored = false;
      this.restoreEpoch += 1;
      this.restoreCancelled = false;
      this.resultProjection = undefined;
      this.projectedGroups = new Map();
    }
    // API 23 can retain Repeat rows after replacement even with a state
    // array. Notify a lazy data source explicitly, as Source Management does.
    if (this.presentation.kind !== 'results') this.changedGroupKeys = new Set();
    const groups = this.presentation.kind === 'results'
      ? this.groupResults(this.presentation.results) : [];
    if (this.acceptedVisibleGroups !== groups || (this.changedGroupKeys?.size ?? 0) > 0) {
      if (this.listMounted && this.scrollRestored) {
        this.saveScrollAnchor();
        if (this.acceptedVisibleGroups !== groups) this.rememberAnchorNeighbors();
        this.restoreKey = this.viewState.anchorKey;
        this.restoreItemY = this.viewState.anchorItemY;
        this.restoreOffset = this.viewState.anchorOffset;
      }
      this.visibleGroups = groups;
      this.acceptedVisibleGroups = groups;
      this.listEpoch = (this.listEpoch ?? 0) + 1;
      this.viewState.listRevision = this.listEpoch;
      this.restoreEpoch = (this.restoreEpoch ?? 0) + 1;
      this.restoreScheduled = false;
      const reordered = this.resultDataSource.replace(groups, this.changedGroupKeys);
      if (this.listMounted && !this.userInteracting && !this.userScrolling) {
        this.restoreCancelled = false;
        // Metadata can change the measured height of a visible row, while
        // ArkUI only promises automatic preservation for offscreen add/delete.
        if (reordered || !this.scrollRestored || (this.changedGroupKeys?.size ?? 0) > 0) this.scheduleScrollRestore();
      }
    }
    this.publishVisibleGroups();
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
            .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme));
          Text(`${this.visibleGroups.length}`)
            .fontFamily('ReaderInter')
            .fontWeight(FontWeight.Bold)
            .fontSize(11)
            .lineHeight(16.5)
            .fontColor(readerAppColor('TOK_GREEN', this.appThemeScheme));
          Text(' 本相关书籍')
            .fontFamily('ReaderInter')
            .fontWeight(FontWeight.Regular)
            .fontSize(11)
            .lineHeight(16.5)
            .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme));
          // Reads the presentation directly (not a builder param) so the
          // minimal-update re-render tracks it exactly like the search/stop
          // pill does: the sweep counter must update live per source landing.
          if (this.presentation.kind === 'results') {
            if (this.presentation.localSearchFailed || this.presentation.sourceListFailed) {
              Text(this.partialSearchFailure()).fontSize(12).fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme))
                .onClick((): void => this.onRetry());
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
                .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme))
                .maxLines(1)
                .textOverflow({ overflow: TextOverflow.Ellipsis });
            } else if (this.presentation.searching) {
              Text(` · 正在搜索 ${this.presentation.completedSourceCount}/${this.presentation.totalSourceCount} 个书源,已返回 ${this.visibleGroups.length} 个`)
                .fontFamily('ReaderInter')
                .fontWeight(FontWeight.Regular)
                .fontSize(11)
                .lineHeight(16.5)
                .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme))
                .maxLines(1)
                .textOverflow({ overflow: TextOverflow.Ellipsis });
            }
            if (this.presentation.failedSourceCount > 0) {
              Text(` · 失败 ${this.presentation.failedSourceCount} 个书源${!this.presentation.searching || this.presentation.completedSourceCount === this.presentation.totalSourceCount ? '，重试' : ''}`)
                .fontFamily('ReaderInter')
                .fontWeight(FontWeight.Regular)
                .fontSize(11)
                .lineHeight(16.5)
                .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme))
                .maxLines(1)
                .textOverflow({ overflow: TextOverflow.Ellipsis })
                .onClick((): void => this.onRetry());
            }
          }
        }
        .width(this.contentFrame().width)
        .padding({ left: this.isTablet ? 20 : 18, right: this.isTablet ? 20 : 18, top: 6, bottom: 6 })
        .alignItems(VerticalAlign.Center)
        .border({ width: { bottom: TOK_BORDER_W }, color: { bottom: readerAppColor('TOK_BORDER', this.appThemeScheme) } });

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
        .onTouch((event: TouchEvent): void => {
          if (event.type === TouchType.Down) { this.userInteracting = true; this.cancelScrollRestoreForUser(); }
          else if (event.type === TouchType.Up || event.type === TouchType.Cancel) this.userInteracting = false;
        })
        .onScrollStart((): void => { if (this.userInteracting) this.userScrolling = true; })
        .onScrollStop((): void => { this.userScrolling = false; })
        .onScrollIndex((start: number, end: number): void => this.onResultScrollIndex(start, end))
        .onScroll((): void => { if (this.scrollRestored) this.saveScrollAnchor(); })
        .onAppear((): void => { this.listMounted = true; this.scheduleScrollRestore(); })
        .onDisAppear((): void => { this.listMounted = false; this.restoreEpoch += 1; })
        .onAreaChange((): void => { if (!this.scrollRestored) this.scheduleScrollRestore(); });
      }
      .width('100%')
      .height('100%');

    }
    .width('100%')
    .layoutWeight(1);
  }

  private groupResults(results: SearchBook[]): SearchBookGroup[] {
    const keyword = this.presentation.kind === 'results' ? this.presentation.keyword : '';
    if (this.resultProjection === undefined) this.resultProjection = new SearchResultProjection();
    if (this.projectedGroups === undefined) this.projectedGroups = new Map();
    const delta = this.presentation.kind === 'results' ? this.presentation.delta : undefined;
    const update = this.resultProjection.update(results, this.shelfBooks, keyword, this.viewState, delta);
    this.changedGroupKeys = update.changedKeys;
    for (const key of update.changedKeys) {
      const row = update.rows.get(key);
      if (row === undefined) { this.projectedGroups.delete(key); continue; }
      const group = new SearchBookGroup(row.variants[0], 1, row.inBookshelf);
      for (let index = 1; index < row.variants.length; index++) group.admit(row.variants[index], row.inBookshelf);
      group.book = row.book;
      this.projectedGroups.set(key, group);
    }
    const categoryChanged = this.groupedCategory !== this.selectedGroupName;
    if (update.orderChanged || categoryChanged || this.projectedGroupKeys === undefined) {
      this.projectedGroupKeys = update.orderedKeys.filter((key: string): boolean =>
        this.selectedGroupName === '全部' || (this.selectedGroupName === '本地' ? key.startsWith('local:') : !key.startsWith('local:')));
      this.groupedResultsCache = this.projectedGroupKeys.map((key: string): SearchBookGroup => this.projectedGroups.get(key) as SearchBookGroup);
      this.projectedGroupIndexes = new Map();
      for (let index = 0; index < this.projectedGroupKeys.length; index++) this.projectedGroupIndexes.set(this.projectedGroupKeys[index], index);
    } else {
      for (const key of update.changedKeys) {
        const index = this.projectedGroupIndexes.get(key);
        if (index !== undefined) this.groupedResultsCache[index] = this.projectedGroups.get(key) as SearchBookGroup;
      }
    }
    this.groupedCategory = this.selectedGroupName;
    return this.groupedResultsCache;
  }

  private saveScrollAnchor(): void {
    this.viewState.anchorOffset = this.resultScroller.currentOffset().yOffset;
    try { this.viewState.anchorItemY = this.resultScroller.getItemRect(this.viewState.anchorIndex).y; }
    catch (_error) { /* A lazy row can be between layout passes. */ }
  }

  private onResultScrollIndex(start: number, end: number): void {
    this.publishVisibleGroups(start, end);
    if (!this.scrollRestored) return;
    const group = this.visibleGroups[start];
    if (group === undefined) return;
    this.viewState.anchorIndex = start;
    this.viewState.anchorKey = this.resultGroupKey(group.book);
    this.saveScrollAnchor();
  }

  private rememberAnchorNeighbors(): void {
    const index = this.visibleGroups.findIndex((group: SearchBookGroup): boolean =>
      this.resultGroupKey(group.book) === this.viewState.anchorKey);
    if (index < 0) return;
    const neighbors: string[] = [];
    for (let distance = 1; distance < this.visibleGroups.length; distance++) {
      if (index + distance < this.visibleGroups.length) neighbors.push(this.resultGroupKey(this.visibleGroups[index + distance].book));
      if (index - distance >= 0) neighbors.push(this.resultGroupKey(this.visibleGroups[index - distance].book));
    }
    this.viewState.anchorNeighbors = neighbors;
  }

  private cancelScrollRestoreForUser(): void {
    this.restoreCancelled = true;
    this.restoreEpoch += 1;
    this.restoreScheduled = false;
    this.scrollRestored = true;
  }

  private scheduleScrollRestore(attempt: number = 0): void {
    if (!this.pageMounted || !this.listMounted || this.restoreCancelled || this.restoreScheduled) return;
    this.scrollRestored = false;
    this.restoreScheduled = true;
    const restore = ++this.restoreEpoch;
    const page = this.pageEpoch;
    const list = this.listEpoch;
    const query = this.viewState.revision;
    const current = (): boolean => this.pageMounted && this.listMounted && !this.restoreCancelled &&
      restore === this.restoreEpoch && page === this.pageEpoch && page === this.viewState.pageRevision &&
      list === this.listEpoch && query === this.viewState.revision;
    // onIdle is after this frame's layout. It is not a display fence.
    this.getUIContext().postFrameCallback(new SearchLayoutFrame((): void => {
      if (!current()) return;
      let key = this.viewState.resolveKey(this.restoreKey);
      let index = this.visibleGroups.findIndex((group: SearchBookGroup): boolean => this.resultGroupKey(group.book) === key);
      if (index < 0) for (const neighbor of this.viewState.anchorNeighbors) {
        key = this.viewState.resolveKey(neighbor);
        index = this.visibleGroups.findIndex((group: SearchBookGroup): boolean => this.resultGroupKey(group.book) === key);
        if (index >= 0) break;
      }
      if (index < 0) {
        this.resultScroller.scrollTo({ xOffset: 0, yOffset: this.restoreKey.length === 0 ? this.restoreOffset : 0 });
        this.restoreScheduled = false;
        this.scrollRestored = true;
        return;
      }
      const anchorKey = key;
      this.resultScroller.scrollToIndex(index, false, ScrollAlign.START);
      this.getUIContext().postFrameCallback(new SearchLayoutFrame((): void => {
        if (!current()) return;
        // No captured numeric index survives asynchronous layout.
        const actual = this.visibleGroups.findIndex((group: SearchBookGroup): boolean => this.resultGroupKey(group.book) === anchorKey);
        try {
          if (actual < 0) throw new Error('anchor removed');
          const rect = this.resultScroller.getItemRect(actual);
          if (!Number.isFinite(rect.y) || !Number.isFinite(rect.height) || rect.height <= 0) throw new Error('anchor not laid out');
          const offset = Math.max(1 - rect.height, Math.min(0, this.restoreItemY));
          this.resultScroller.scrollBy(0, rect.y - offset);
          this.viewState.anchorKey = anchorKey;
          this.viewState.anchorIndex = actual;
          this.scrollRestored = true;
          this.saveScrollAnchor();
        } catch (_error) {
          // Bounded retries cover lazy realization; area change can resume a
          // later valid layout. User input always revokes this work.
          this.restoreScheduled = false;
          if (attempt < 2) this.scheduleScrollRestore(attempt + 1);
          return;
        }
        this.restoreScheduled = false;
      }));
    }));
  }

  private resultGroupKey(book: SearchBook): string {
    return book.sourceId === 'local' ? `local:${book.bookId}` :
      `online:${book.groupKey ?? this.normalizedBookKey(book.title, book.author)}`;
  }

  private normalizedBookKey(title: string, author: string): string {
    return bookTitleAuthorKey(title, author);
  }

  private partialSearchFailure(): string {
    if (this.presentation.kind !== 'results' && this.presentation.kind !== 'empty' && this.presentation.kind !== 'error') return '';
    const messages: string[] = [];
    if (this.presentation.localSearchFailed) messages.push(`本地检索：${this.presentation.localFailureMessage ?? '读取未完成，请重试'}`);
    if (this.presentation.sourceListFailed) messages.push(`书源列表：${this.presentation.sourceListFailureMessage ?? '读取未完成，请重试'}`);
    if (messages.length > 0) return messages.join('；');
    return (this.presentation.failedSourceCount ?? 0) > 0 ? `${this.presentation.failedSourceCount} 个书源请求失败，可重试或检查书源状态` : '';
  }

  private searchFailureTitle(): string {
    if (this.presentation.kind !== 'error') return '搜索失败';
    if (this.presentation.localSearchFailed) return '本地检索未完成';
    return this.presentation.sourceListFailed ? '书源列表加载失败' : '书源搜索失败';
  }

  private searchFailureMessage(): string {
    if (this.presentation.kind !== 'error') return '';
    return this.partialSearchFailure();
  }

  @Builder
  private emptyContent(keyword: string, searchedSourceCount: number) {
    Scroll() {
      Column({ space: 0 }) {
        Image((this.appThemeScheme === 'night' ? $r('app.media.search_empty_theme_night') : $r('app.media.search_empty')))
          .width(128)
          .height(120)
          .alignSelf(ItemAlign.Center);

        Text('没有找到相关书籍')
          .margin({ top: 28 })
          .fontFamily('ReaderNotoSerifSCBold')
          .fontWeight(FontWeight.Bold)
          .fontSize(17)
          .lineHeight(25.5)
          .fontColor(readerAppColor('TOK_INK', this.appThemeScheme))
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
          .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme))
          .textAlign(TextAlign.Center)
          .maxLines(3);

        if (this.partialSearchFailure().length > 0) {
          Text(this.partialSearchFailure())
            .fontSize(12)
            .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme))
            .margin({ top: TOK_SPACE_CONTROL_INLINE })
            .onClick((): void => this.onRetry());
        }

        Column({ space: 0 }) {
          Text('搜索建议')
            .width('100%')
            .fontFamily('ReaderInter')
            .fontWeight(FontWeight.Bold)
            .fontSize(12)
            .lineHeight(18)
            .fontColor(readerAppColor('TOK_INK', this.appThemeScheme))
            .maxLines(1);
          this.suggestion('检查书名拼写是否正确');
          this.suggestion('尝试更短的关键词或作者名');
          this.suggestion('前往书源管理添加或启用更多书源');
        }
        .width(this.isTablet ? 300 : 190)
        .padding({ left: 18.5, right: 18.5, top: 14.5, bottom: 14.5 })
        .margin({ top: 22 })
        .backgroundColor(readerAppColor('TOK_CARD_BG', this.appThemeScheme))
        .border({ width: TOK_BORDER_W, color: readerAppColor('TOK_BORDER', this.appThemeScheme) })
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
        Image((this.appThemeScheme === 'night' ? $r('app.media.search_empty_theme_night') : $r('app.media.search_empty')))
          .width(128)
          .height(120)
          .alignSelf(ItemAlign.Center);

        Text(reason === 'noSources' ? '还没有可用书源' : '没有启用的书源')
          .margin({ top: 28 })
          .fontFamily('ReaderNotoSerifSCBold')
          .fontWeight(FontWeight.Bold)
          .fontSize(17)
          .lineHeight(25.5)
          .fontColor(readerAppColor('TOK_INK', this.appThemeScheme))
          .textAlign(TextAlign.Center);

        Text(reason === 'noSources' ? '添加至少一个书源后才能搜索在线书籍' : '启用已有书源,或导入新的书源')
          .margin({ top: TOK_SPACE_CONTROL_INLINE })
          .width('100%')
          .fontFamily('ReaderInter')
          .fontWeight(FontWeight.Regular)
          .fontSize(13)
          .lineHeight(21.125)
          .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme))
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
      Image((this.appThemeScheme === 'night' ? $r('app.media.search_error_theme_night') : $r('app.media.search_error'))).width(80).height(80);

      Text('书源列表加载失败')
        .margin({ top: 20 })
        .fontFamily('ReaderNotoSerifSCBold')
        .fontWeight(FontWeight.Bold)
        .fontSize(17)
        .lineHeight(25.5)
        .fontColor(readerAppColor('TOK_INK', this.appThemeScheme))
        .textAlign(TextAlign.Center);

      Text('无法获取书源列表,请重试')
        .margin({ top: TOK_SPACE_XS })
        .fontFamily('ReaderInter')
        .fontWeight(FontWeight.Regular)
        .fontSize(13)
        .lineHeight(19.5)
        .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme))
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
      .fontColor(readerAppColor('TOK_ON_PRIMARY', this.appThemeScheme))
      .padding({ left: 18, right: 18, top: 11.5, bottom: 11.5 })
      .backgroundColor(readerAppColor('app.action.fill', this.appThemeScheme))
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
      .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme))
      .padding({ left: 18.5, right: 18.5, top: 11.5, bottom: 11.5 })
      .backgroundColor(readerAppColor('TOK_CARD_BG', this.appThemeScheme))
      .border({ width: TOK_BORDER_W, color: readerAppColor('TOK_BORDER', this.appThemeScheme) })
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
        .fontColor(readerAppColor('TOK_GREEN', this.appThemeScheme));
      Text(text)
        .fontFamily('ReaderInter')
        .fontWeight(FontWeight.Regular)
        .fontSize(12)
        .lineHeight(19.5)
        .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme))
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
      Image((this.appThemeScheme === 'night' ? $r('app.media.search_error_theme_night') : $r('app.media.search_error'))).width(80).height(80);

      Text(this.searchFailureTitle())
        .margin({ top: 20 })
        .fontFamily('ReaderNotoSerifSCBold')
        .fontWeight(FontWeight.Bold)
        .fontSize(17)
        .lineHeight(25.5)
        .fontColor(readerAppColor('TOK_INK', this.appThemeScheme))
        .textAlign(TextAlign.Center);

      Text(this.searchFailureMessage())
        .margin({ top: TOK_SPACE_XS })
        .fontFamily('ReaderInter')
        .fontWeight(FontWeight.Regular)
        .fontSize(13)
        .lineHeight(19.5)
        .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme))
        .textAlign(TextAlign.Center)
        .maxLines(2);

      Stack({ alignContent: Alignment.Center }) {
        Text('重新搜索')
          .fontFamily('ReaderInter')
          .fontWeight(800)
          .fontSize(14)
          .lineHeight(14)
          .fontColor(readerAppColor('TOK_ON_PRIMARY', this.appThemeScheme));
      }
      .height(40)
      .margin({ top: TOK_SPACE_LG })
      .padding({ left: 28, right: 28 })
      .backgroundColor(readerAppColor('app.action.fill', this.appThemeScheme))
      .borderRadius(999)
      .onClick((): void => this.onRetry())
      .responseRegion({ x: 0, y: -4, width: '100%', height: 48 })
      .accessibilityText('重新搜索');

      Text('检查书源')
        .fontFamily('ReaderInter')
        .fontWeight(FontWeight.Bold)
        .fontSize(13)
        .lineHeight(13)
        .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme))
        .padding({ left: 18.5, right: 18.5, top: 11.5, bottom: 11.5 })
        .backgroundColor(readerAppColor('TOK_CARD_BG', this.appThemeScheme))
        .border({ width: TOK_BORDER_W, color: readerAppColor('TOK_BORDER', this.appThemeScheme) })
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
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';

  // LazyForEach supplies a regular row value.  ObjectLink requires the
  // parent to pass an @Observed-owned object and the compiler otherwise
  // rejects this boundary; the data source emits an explicit row change when
  // an existing observed group is enriched in place.
  @ObjectLink group: SearchBookGroup;
  @Prop isTablet: boolean = false;
  @Prop cardWidth: number = 0;
  onSelectResult: (book: SearchBook, variants: SearchBook[]) => void = (): void => {};

  private displayIntro(): string {
    return bookIntroText(this.group.book.intro);
  }

  private coverWidth(): number {
    return this.isTablet ? 96 : 88;
  }

  private coverHeight(): number {
    return this.coverWidth() * (this.isTablet ? 92 / 68 : 82 / 60);
  }

  build() {
    Row({ space: TOK_SPACE_SM }) {
      Stack({ alignContent: Alignment.Bottom }) {
        if (this.group.book.coverUrl !== undefined && this.group.book.coverUrl.trim().length > 0) {
          Image(this.group.book.coverUrl)
            .width(this.coverWidth())
            .height(this.coverHeight())
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
              .fontColor(readerAppColor('app.SearchResultCard.build.fontColor.99FFFAF4', this.appThemeScheme))
              .textAlign(TextAlign.Center)
              .maxLines(1)
              .textOverflow({ overflow: TextOverflow.Ellipsis })
              .padding({ left: TOK_SPACE_ROW_BLOCK, right: TOK_SPACE_ROW_BLOCK, bottom: 6 });
          }
          .width(this.coverWidth())
          .height(this.coverHeight())
          .linearGradient({
            angle: 141.7,
            colors: [[readerAppColor('TOK_PRIMARY_GRADIENT_START', this.appThemeScheme), 0.077], [readerAppColor('TOK_PRIMARY_DARK', this.appThemeScheme), 0.923]],
          })
          .borderRadius(6);
        }
      }
      .width(this.coverWidth())
      .height(this.coverHeight())
      .borderRadius(6);

      Column() {
        Column({ space: 5 }) {
          Text(this.group.book.title)
            .width('100%')
            .fontFamily('ReaderNotoSerifSCBold')
            .fontWeight(FontWeight.Bold)
            .fontSize(15)
            .lineHeight(19.5)
            .fontColor(readerAppColor('TOK_INK', this.appThemeScheme))
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis });

          Text(bookAuthorLabel(this.group.book.author, this.group.book.authorIdentity, this.group.book.sourceRuleVersion))
            .width('100%')
            .fontFamily('ReaderInter')
            .fontWeight(FontWeight.Regular)
            .fontSize(12)
            .lineHeight(12)
            .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme))
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis });

          if ((this.group.book.latestChapterTitle?.trim().length ?? 0) > 0) {
            Text(this.group.book.latestChapterTitle)
              .width('100%')
              .opacity(0.8)
              .fontFamily('ReaderInter')
              .fontWeight(FontWeight.Regular)
              .fontSize(11)
              .lineHeight(11)
              .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme))
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
              .fontColor(readerAppColor('app.SearchResultCard.build.fontColor.FF9A948E', this.appThemeScheme))
              .maxLines(2)
              .textOverflow({ overflow: TextOverflow.Ellipsis });
          }
        }
        .width('100%')
        .alignItems(HorizontalAlign.Start);

        Flex({ direction: FlexDirection.Row, wrap: FlexWrap.Wrap, alignItems: ItemAlign.Center,
          space: { main: LengthMetrics.vp(6), cross: LengthMetrics.vp(2) } }) {
          Text(this.group.book.sourceName.length > 0 ? this.group.book.sourceName : this.group.book.sourceId)
            .fontFamily('ReaderInter').fontWeight(FontWeight.Bold).fontSize(10).lineHeight(15)
            .fontColor(readerAppColor('TOK_GREEN', this.appThemeScheme))
            .padding({ left: 6, right: 6, top: 2, bottom: 2 })
            .backgroundColor(readerAppColor('TOK_PRIMARY_SOFT', this.appThemeScheme))
            .borderRadius(4).constraintSize({ maxWidth: '100%' }).maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis });
          Text(this.group.book.sourceId === 'local' ? '本地书籍' : `已发现 ${this.group.sourceCount} 个书源`)
            .fontFamily('ReaderInter').fontWeight(FontWeight.Bold).fontSize(10).lineHeight(15)
            .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme))
            .padding({ left: 6, right: 6, top: 2, bottom: 2 })
            .backgroundColor(readerAppColor('TOK_PRIMARY_SOFT', this.appThemeScheme))
            .borderRadius(4).maxLines(1);
          if (this.group.inBookshelf) {
            Text('已在书架')
              .fontFamily('ReaderInter').fontWeight(FontWeight.Bold).fontSize(10).lineHeight(15)
              .fontColor(readerAppColor('TOK_GREEN', this.appThemeScheme))
              .padding({ left: 6, right: 6, top: 2, bottom: 2 })
              .backgroundColor(readerAppColor('TOK_PRIMARY_SOFT', this.appThemeScheme))
              .borderRadius(4).maxLines(1);
          }
        }
        .width('100%')
        .margin({ top: 5 });
      }
      .layoutWeight(1)
      // Only the gap above the tags grows for short metadata. Long metadata
      // grows the row naturally, while the original cover ratio stays intact.
      .constraintSize({ minHeight: this.coverHeight() })
      .justifyContent(FlexAlign.SpaceBetween)
      .alignItems(HorizontalAlign.Start);
    }
    .width(this.cardWidth)
    .padding({ left: this.isTablet ? 20 : 18, right: this.isTablet ? 20 : 18, top: TOK_SPACE_CARD_PADDING, bottom: 14.5 })
    .alignItems(VerticalAlign.Bottom)
    .border({ width: { bottom: TOK_BORDER_W }, color: { bottom: readerAppColor('TOK_BORDER', this.appThemeScheme) } })
    .onClick((): void => this.onSelectResult(this.group.book, this.group.variants));
  }
}
