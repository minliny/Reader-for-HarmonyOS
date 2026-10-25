import { ReaderIconButton } from '../common/ReaderIconButton';
import { ReaderButton } from '../common/ReaderButton';
import { ReaderPageState } from '../common/ReaderPageState';
import type { SearchHistoryStatus, SearchOperationFacts } from './SearchPresentation';
import { TYPE_APP_FILTER_OPTION, TYPE_APP_INHERITED_BODY, TYPE_APP_PRIMARY_ACTION, TYPE_APP_SECONDARY_ACTION, TYPE_SEARCH_BOOK_INPUT, TYPE_SEARCH_FIELD_ACTION, TYPE_SEARCH_FIELD_ACTION_WIDE, TYPE_SEARCH_HISTORY_HEADING, TYPE_SEARCH_HISTORY_KEYWORD, TYPE_SEARCH_PROGRESS_META, TYPE_SEARCH_RESULT_COUNT, TYPE_SEARCH_RETRY_ACTION, TYPE_SEARCH_SCOPE_LABEL, TYPE_SEARCH_SCOPE_SELECTED, TYPE_SEARCH_SUGGESTION_BODY, TYPE_SEARCH_SUGGESTION_HEADING } from '../common/ReaderTypography';
import { bookAuthorLabel, bookTitleAuthorKey, type BookAuthorIdentityProof } from '../common/BookAuthorMetadata';
import { FrameCallback, LengthMetrics } from '@kit.ArkUI';
import { SearchResultProjection } from './SearchResultProjection';
import { searchBookSnapshot } from './SearchBookSnapshot';
import { readerAppColor } from '../common/ReaderThemeRegistry';
import { ReaderFrameStyle, readerFrameStyle } from '../common/ReaderFrameStyle';
import { ReaderScrollLayout, readerScrollLayout, readerScrollEndOffset, readerScrollStartOffset } from '../common/ReaderScrollLayout';
import { SearchSpinner } from './SearchSpinner';
import { SearchViewState, type SearchContentType } from './SearchViewState';
import { SearchPublication } from './SearchPublication';
import type { SearchPresentation } from './SearchPresentation';
import { bookIntroText } from '../common/BookIntroText';
import {
  type SearchBook,
  type SearchSource,
} from './SearchGateway';
import type { ShelfBook } from '../../app/ReaderCoreGateway';
import { readerSourceCategoryIsText, readerMediaIdentity } from '../source/ReaderSourceCategory';
import { ReaderWindowCoordinator } from '../../app/ReaderWindowCoordinator';
import { readerFloatingBarBottomInset } from '../common/ReaderFloatingBarMetrics';
import { registerReaderFonts } from '../common/ReaderFonts';
import {
  TYPE_SEARCH_RESULT_AUTHOR,
  TYPE_SEARCH_RESULT_CHAPTER,
  TYPE_SEARCH_RESULT_COVER_TITLE,
  TYPE_SEARCH_RESULT_INTRO,
  TYPE_SEARCH_RESULT_TAG,
  TYPE_SEARCH_RESULT_TITLE,
} from '../common/ReaderTypography';
import { ReaderSearchField } from '../common/ReaderSearchField';
import { readerSearchActionWidth, readerSearchControlHeight } from '../common/ReaderControlSpecs';
import {
  SurfaceHorizontalFrame,
  SurfaceWidthSpec,
  resolveHorizontalFrame,
} from '../common/SurfaceHorizontalGeometry';
import {
  readerVisualSafeLeft,
  readerVisualSafeRight,
  readerVisualSafeTop,
  readerVisualSafeBottom,
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
  TOK_SPACE_MD,
  TOK_SPACE_ROW_BLOCK,
  TOK_SPACE_SM,
  TOK_SPACE_XS,
} from '../common/ReaderTokens';
import { readerPageAreaLength } from '../common/ReaderPageShell';
import { ReaderPageScaffold } from '../common/ReaderPageScaffold';
import { ReaderMeasurementStore } from '../common/ReaderMeasurements';
import { ReaderPageGeometry, ReaderPageGeometryInput, resolveReaderPageGeometry } from '../common/ReaderPageGeometry';
import { readerMotionAnimateParam } from '../common/ReaderMotionPolicy';
import { SearchHeaderSpec, readerSearchHeaderHeight, searchHeaderSpec } from '../common/ReaderHeaderSpecs';

export type {
  SearchInitialPresentation,
  SearchLoadingPresentation,
  SearchResultsPresentation,
  SearchEmptyPresentation,
  SearchErrorPresentation,
  SearchSourceRequiredPresentation,
  SearchSourceLoadErrorPresentation,
  SearchOperationFacts,
  SearchOperationValue,
  SearchPresentation,
} from './SearchPresentation';

const SEARCH_LOCAL_SCOPE = '本地';
const SEARCH_ONLINE_SCOPE = '在线';

interface SearchScopeEntry {
  name: string;
  sourceIds: string[];
}

interface SearchResultSelection {
  queryRevision: number;
  book: SearchBook;
  variants: SearchBook[];
  coverUrl: string;
}

interface SearchNoticeFacts {
  queryRevision: number;
  operationGeneration: number | undefined;
  partial: boolean;
  partialText: string;
  failed: number;
  skipped: number;
  canRetry: boolean;
}

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
  coverUrl: string;
  private readonly sourceIdSet: Set<string>;
  private readonly failedCoverUrls: Set<string> = new Set();

  constructor(book: SearchBook, sourceCount: number, inBookshelf: boolean) {
    this.book = book;
    this.sourceCount = sourceCount;
    this.inBookshelf = inBookshelf;
    this.sourceIds = [book.sourceId];
    this.variants = [book];
    this.coverUrl = book.coverUrl?.trim() ?? '';
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
    // Admission is append-only; do not rescan every prior variant per source.
    const url = book.coverUrl?.trim() ?? '';
    if (this.coverUrl.length === 0 && url.length > 0 && !this.failedCoverUrls.has(url)) this.coverUrl = url;
  }

  resetCoverFailures(): void { this.failedCoverUrls.clear(); }

  refreshCover(): void {
    // A source becoming a better reading candidate must not replace this
    // book's already displayed image. Cover choice belongs to the retained row.
    if (this.coverUrl.length > 0 && !this.failedCoverUrls.has(this.coverUrl) &&
      this.variants.some((book: SearchBook): boolean => book.coverUrl?.trim() === this.coverUrl)) return;
    const candidate = this.variants.find((book: SearchBook): boolean => {
      const url = book.coverUrl?.trim() ?? '';
      return url.length > 0 && !this.failedCoverUrls.has(url);
    });
    const next = candidate?.coverUrl?.trim() ?? '';
    if (this.coverUrl !== next) this.coverUrl = next;
  }

  rejectCover(url: string): void {
    if (url.length === 0 || this.coverUrl !== url) return;
    this.failedCoverUrls.add(url);
    this.refreshCover();
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
    return `online:${readerMediaIdentity(book.category === 'comic', alias)}`;
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
    const newRequest = retained.book.searchRequestId !== next.book.searchRequestId;
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
    if (newRequest) retained.resetCoverFailures();
    retained.refreshCover();
    return changed;
  }

  replace(items: SearchBookGroup[], changedKeys?: Set<string>): boolean {
    if (this.input === items && changedKeys !== undefined) {
      for (const key of changedKeys) {
        const index = this.positions.get(key);
        if (index !== undefined) this.update(this.items[index], items[index]);
      }
      // @ObjectLink observes these retained objects. Native batch CHANGE
      // invalidates the lazy child, including an already decoded cover image.
      return false;
    }
    const oldItems = this.items;
    const oldKeys = this.keys;
    const previous = new Map<string, SearchBookGroup>();
    for (let index = 0; index < oldKeys.length; index++) previous.set(oldKeys[index], oldItems[index]);
    const nextKeys: string[] = [];
    const nextItems: SearchBookGroup[] = [];
    const additions: number[] = [];
    const nextSet = new Set<string>();
    for (let index = 0; index < items.length; index++) {
      const next = items[index]; const key = this.key(next);
      nextKeys.push(key); nextSet.add(key);
      const retained = previous.get(key);
      if (retained === undefined) { nextItems.push(next); additions.push(index); }
      else {
        this.update(retained, next);
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
      for (let position = 0; position < additions.length;) {
        const start = additions[position]; let end = position + 1;
        while (end < additions.length && additions[end] === additions[end - 1] + 1) end++;
        const anchor = additionAnchors.get(start) as number;
        operations.push({ type: DataOperationType.ADD, index: anchor, count: end - position,
          key: nextKeys.slice(start, start + end - position) });
        position = end;
      }
      // Only membership/order changes notify LazyForEach. Observed metadata
      // updates do not invalidate retained native children.
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
  /** The latest source.list snapshot; used by both scope dispatch and result projection. */
  private searchSources: SearchSource[] = [];
  viewState: SearchViewState = new SearchViewState();
  private resultScroller: Scroller = new Scroller();
  private restoreKey: string = '';
  private restoreOffset: number = 0;
  private restoreItemY: number = 0;
  private scrollRestored: boolean = false;
  private viewStateRevision: number = -1;
  @Prop expandedLayout: boolean;
  @Prop reduceMotion: boolean = false;
  private readonly headerSpec: SearchHeaderSpec = searchHeaderSpec();
  @State private historyWidth: number = 0;
  @State private measurementRevision: number = 0;
  private readonly measurements: ReaderMeasurementStore = new ReaderMeasurementStore();
  @State private filtersExpanded: boolean = false;
  private queryAtMount: number = -1;
  private startPositionedQuery: number = -1;
  private headerAnchorPending: boolean = false;
  private headerAnchorInset: number = 0;
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
  onRetryHistory: () => void = (): void => {};
  onSelectResult: (book: SearchBook, variants: SearchBook[], displayCoverUrl?: string) => void =
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
  @State private selectedContentType: SearchContentType = '全部类型';
  @State private visibleGroups: SearchBookGroup[] = [];
  private acceptedVisibleGroups: SearchBookGroup[] | undefined = undefined;
  private resultDataSource: SearchResultDataSource = new SearchResultDataSource();
  private groupedCategory: string = '';
  private groupedContentType: string = '';
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
  private resultsDeferred: boolean = false;
  private resultFlushEpoch: number = 0;
  @State private displayIdleRevision: number = 0;
  @State private resultNoticeFacts: SearchNoticeFacts | undefined = undefined;
  private progressHeightLayoutKey: string = '';
  private progressHeight: number = 0;

  private acceptPublication(): void {
    if (!this.ownsPageQuery()) return;
    this.presentation = this.publication.presentationAt(this.publicationRevision);
    this.shelfBooks = this.publication.shelfAt(this.publicationRevision);
    this.searchSources = this.publication.sourcesAt(this.publicationRevision);
    this.refreshVisibleResults();
  }

  aboutToAppear(): void {
    this.pageMounted = true;
    this.pageEpoch = ++this.viewState.pageRevision;
    this.queryAtMount = this.viewState.revision;
    this.startPositionedQuery = -1;
    this.restoreCancelled = false;
    registerReaderFonts(this.getUIContext().getFont());
    this.restoreKey = this.viewState.anchorKey;
    this.restoreOffset = this.viewState.anchorOffset;
    this.restoreItemY = this.viewState.anchorItemY;
    this.scrollRestored = false;
    this.selectedGroupName = this.viewState.category;
    this.selectedContentType = this.viewState.contentType;
    this.filtersExpanded = this.viewState.filtersExpanded;
    this.focusInputOnAppear = this.viewState.consumeInputFocusRequest();
    this.keyword = this.viewState.keywordDraft;
    this.acceptPublication();
  }

  aboutToDisappear(): void {
    const current = this.ownsPageQuery();
    if (current) this.rememberAnchorNeighbors();
    this.pageMounted = false;
    this.listMounted = false;
    this.scrollRestored = false;
    this.headerAnchorPending = false;
    this.restoreEpoch += 1;
    this.restoreScheduled = false;
    this.resultsDeferred = false;
    this.resultNoticeFacts = undefined;
    this.resultFlushEpoch += 1;
    this.userInteracting = false;
    this.userScrolling = false;
    if (current) this.onVisibleGroups([]);
  }

  private ownsPageQuery(): boolean {
    return this.pageMounted && this.pageEpoch === this.viewState.pageRevision &&
      this.queryAtMount === this.viewState.revision;
  }

  private ownsList(): boolean { return this.ownsPageQuery() && this.listMounted; }

  private publishVisibleGroups(start: number = this.visibleStart, end: number = this.visibleEnd): void {
    this.visibleStart = Math.max(0, start);
    this.visibleEnd = Math.max(-1, end);
    const groups = this.presentation.kind !== 'results' || this.presentation.stopped === true ||
      this.visibleEnd < this.visibleStart ? [] :
      this.visibleGroups.slice(this.visibleStart, Math.min(this.visibleEnd + 1, this.visibleStart + 6))
        .filter((group: SearchBookGroup): boolean => group.book.sourceId !== 'local')
        .map((group: SearchBookGroup): SearchBook[] => group.variants);
    if (groups.length === this.warmupGroups.length && groups.every((group: SearchBook[], i: number): boolean =>
      group.length === this.warmupGroups[i].length && group.every((book: SearchBook, j: number): boolean =>
        book === this.warmupGroups[i][j]))) return;
    this.warmupGroups = groups;
    this.onVisibleGroups(groups);
  }

  private frameStyle(): ReaderFrameStyle {
    const pageBackground = readerAppColor('TOK_PAPER', this.appThemeScheme);
    return readerFrameStyle({ backgroundColor: pageBackground, headerBackground: pageBackground,
      headerTransparent: true, footerBackground: pageBackground });
  }

  build() {
    ReaderPageScaffold({
      // Only the rounded card paints the header. A solid search host also
      // paints its side/bottom gutters beyond that card's visible border.
      frameStyle: this.frameStyle(),
      geometry: this.pageGeometry(),
      headerMeasurementKey: this.searchHeaderMeasurementKey(),
      content: (): void => { this.stateContent(); },
      header: (): void => { this.searchHeader(); },
      onHeaderHeightChange: (height: number, presentedKey: number): void => this.acceptSearchHeaderHeight(height, presentedKey),
    });
  }

  @Builder
  private searchHeader() {
    Column() {
      Column() {
        this.searchBar();
        if (this.hasSearchSession()) {
          Column() {
            Column() {
              this.filterProgressRow();
              if (this.filtersExpanded) {
                Scroll() {
                  Column() {
                    this.groupScopeRow();
                    this.contentTypeRow();
                  }.width('100%').padding({ bottom: this.headerSpec.filterGroupBottomPadding });
                }.width('100%').constraintSize({ maxHeight: this.searchFilterMaxHeight() })
                  .align(Alignment.TopStart).scrollBar(BarState.Auto);
              }
            }.width('100%')
              .border({ width: { top: this.headerSpec.borderWidth },
                color: readerAppColor('app.search.listRule', this.appThemeScheme) });
          }.width('100%').padding({ left: 12, right: 12 });
        }
      }.width('100%').borderRadius(this.headerSpec.panelRadius)
        .backgroundColor(readerAppColor('app.search.panelSurface', this.appThemeScheme))
        .border({ width: this.headerSpec.borderWidth,
          color: readerAppColor('app.search.panelBorder', this.appThemeScheme) })
        .clip(true);
    }.width('100%').padding({ left: this.searchOuterInset(), right: this.searchOuterInset(),
      bottom: this.headerSpec.panelBottomGap })
      .hitTestBehavior(HitTestMode.Transparent);
  }

  @Builder
  private filterProgressRow() {
    Row({ space: 8 }) {
      Text(this.searchProgressText()).layoutWeight(1)
        .fontFamily('ReaderNotoSansSC').fontWeight(FontWeight.Regular).fontSize(12).lineHeight(18).halfLeading(true)
        .minFontScale(Math.min(1, this.searchFontScale())).maxFontScale(Math.max(1, this.searchFontScale()))
        .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme))
        .padding({ top: this.headerSpec.statsPaddingTop, bottom: this.headerSpec.statsPaddingBottom });
      Stack({ alignContent: Alignment.End }) {
        Row({ space: 5 }) {
          Text('筛选').fontFamily('ReaderNotoSansSC').fontSize(13).lineHeight(20).halfLeading(true)
            .minFontScale(Math.min(1, this.searchFontScale())).maxFontScale(Math.max(1, this.searchFontScale()))
            .fontColor(readerAppColor('TOK_GREEN', this.appThemeScheme));
          Image(this.appThemeScheme === 'night' ? $r('app.media.rss_filter_chevron_theme_night') : $r('app.media.rss_filter_chevron'))
            .width(16).height(16).rotate({ angle: this.filtersExpanded ? 270 : 90 });
        }.width('100%').justifyContent(FlexAlign.End).alignItems(VerticalAlign.Center);
        if (this.hasActiveSearchFilters()) {
          Circle().width(4).height(4).fill(readerAppColor('TOK_GREEN', this.appThemeScheme))
            .position({ x: this.searchActionWidth() - 26, y: this.searchControlHeight() / 2 - 11 }).hitTestBehavior(HitTestMode.None);
        }
      }.width(this.searchActionWidth()).constraintSize({ minHeight: this.searchControlHeight() })
        .accessibilityRole(AccessibilityRoleType.BUTTON).focusable(true)
        .accessibilityText(`${this.filtersExpanded ? '收起筛选' : '展开筛选'}${this.hasActiveSearchFilters() ? '，筛选条件已生效' : ''}`)
        .onClick((): void => this.toggleSearchFilters());
    }.width('100%').constraintSize({ minHeight: this.searchStatsHeight() }).alignItems(VerticalAlign.Center);
  }

  private toggleSearchFilters(): void {
    if (!this.ownsPageQuery()) return;
    if (this.ownsList() && this.scrollRestored) {
      this.saveScrollAnchor();
      this.restoreKey = this.viewState.anchorKey;
      this.restoreOffset = this.viewState.anchorOffset;
      this.restoreItemY = this.viewState.anchorItemY;
      this.headerAnchorInset = this.searchContentStartInset();
      this.headerAnchorPending = true;
      this.restoreCancelled = false;
      this.scrollRestored = false;
    }
    const params = readerMotionAnimateParam('search.filters.toggle', this.reduceMotion);
    this.getUIContext().animateTo(params, (): void => {
      if (!this.ownsPageQuery()) return;
      this.filtersExpanded = !this.filtersExpanded;
      this.viewState.filtersExpanded = this.filtersExpanded;
    });
  }

  private acceptSearchHeaderHeight(height: number, presentedKey: number): void {
    if (!this.ownsPageQuery() || presentedKey !== this.searchHeaderMeasurementKey() || !Number.isFinite(height) || height <= 0) return;
    const previous = this.resolvedHeaderHeight();
    if (this.measurements.record('search:header', height, presentedKey)) this.measurementRevision += 1;
    if (this.headerAnchorPending) {
      const delta = height - this.headerAnchorInset;
      this.restoreItemY += delta;
      if (this.restoreKey.length === 0 && !this.viewState.anchorAtStart) this.restoreOffset -= delta;
      this.headerAnchorPending = false;
      if (this.viewState.anchorAtStart) this.startPositionedQuery = -1;
      this.scheduleScrollRestore();
    } else if (this.ownsList() && this.viewState.anchorAtStart && Math.abs(height - previous) > .5 &&
      !this.userInteracting && !this.userScrolling) {
      this.startPositionedQuery = -1;
      this.restoreCancelled = false;
      this.scheduleScrollRestore();
    }
  }

  private searchHeaderHeight(): number {
    // Fallback until the natural-height panel is measured. Result facts never
    // add another fixed row; the two option groups exist only while expanded.
    // Keep the branches so initial/history frames do not measure text or read
    // keyboard insets for rows that are not mounted.
    const barHeight = this.searchBarHeight();
    if (!this.hasSearchSession()) {
      return readerSearchHeaderHeight(this.headerSpec, false, false, barHeight, 0, 0, 0);
    }
    const statsHeight = this.searchStatsHeight();
    if (!this.filtersExpanded) {
      return readerSearchHeaderHeight(this.headerSpec, true, false, barHeight, statsHeight, 0, 0);
    }
    return readerSearchHeaderHeight(this.headerSpec, true, true, barHeight, statsHeight,
      this.searchFilterHeight(), this.searchFilterMaxHeight());
  }

  private hasSearchSession(): boolean {
    return this.presentation.kind === 'loading' || this.presentation.kind === 'results' ||
      this.presentation.kind === 'empty' || this.presentation.kind === 'error';
  }

  private searchSummaryHeight(): number {
    return this.headerSpec.summaryHeight(this.searchSummaryStacked(), this.searchFontScale());
  }

  private searchSummaryStacked(): boolean {
    // Window/font changes may reflow the summary; progress/count updates may
    // not. At large accessibility sizes give both original labels a full row.
    return this.headerSpec.summaryStacked(this.searchResultWidth(), this.searchFontScale());
  }

  private searchHeaderMeasurementKey(): number {
    // Keep delayed loading/old-window receipts out of the current header.
    // The window owner advances its revision for width and font changes.
    const structure = this.hasSearchSession() ? (this.filtersExpanded ? 2 : 1) : 0;
    return Math.max(0, this.readerWindowMetricsRevision) * 8 + (this.expandedLayout ? 4 : 0) + structure;
  }

  private searchStatsHeight(): number {
    const scale = this.searchFontScale();
    const width = Math.max(24, this.searchResultWidth() - 2 * TOK_BORDER_W - 24 - 8 - this.searchActionWidth());
    const key = `${this.readerWindowMetricsRevision}:${width}:${scale}`;
    if (this.progressHeightLayoutKey === key && this.progressHeight > 0) return this.progressHeight;
    // A source sweep does not need a MAX_SAFE_INTEGER-sized text reservation.
    // Keep the ordinary counter/waiting line stable; longer actual text may
    // still grow naturally instead of being clipped or locally scrolled.
    const texts: string[] = [
      '正在搜索本地与在线书籍…',
      '正在搜索 999999/999999 个书源',
      '已搜索 999999/999999 个书源',
      '本次搜索未完成',
    ];
    let height = 18 * scale;
    try {
      const context = this.getUIContext();
      for (const text of texts) {
        const measured = context.px2vp(Number(context.getMeasureUtils().measureTextSize({
          textContent: text, constraintWidth: `${width}vp`, fontSize: '12fp', lineHeight: '18fp',
          fontFamily: 'ReaderNotoSansSC', fontWeight: FontWeight.Regular,
        }).height));
        if (!Number.isFinite(measured) || measured <= 0) throw new Error('Search progress measurement unavailable');
        height = Math.max(height, measured);
      }
    } catch (_error) {
      // Keep a two-line minimum while native text measurement is unavailable;
      // the row still grows naturally for longer real text.
      height = Math.max(height, this.headerSpec.statsFallbackHeight * scale);
    }
    this.progressHeightLayoutKey = key;
    this.progressHeight = Math.max(this.searchControlHeight(),
      this.headerSpec.statsVerticalPadding + Math.ceil(height));
    return this.progressHeight;
  }

  private resolvedHeaderHeight(): number {
    return this.measurements.readForGeneration('search:header', this.searchHeaderMeasurementKey(),
      this.searchHeaderHeight());
  }

  private pageGeometry(): ReaderPageGeometry {
    const metrics = ReaderWindowCoordinator.metrics();
    const input = new ReaderPageGeometryInput(metrics);
    input.viewportWidth = metrics.windowRect.width;
    input.measurementRevision = this.measurementRevision;
    input.headerHeight = this.resolvedHeaderHeight();
    input.contentEndInset = this.searchBottomInset();
    input.contentMaxWidth = TOK_CONTENT_RAIL_W_TABLET;
    return resolveReaderPageGeometry(input);
  }

  private scrollLayout(): ReaderScrollLayout {
    return readerScrollLayout(this.pageGeometry(), { mode: 'contentOffset' });
  }

  private searchContentStartInset(): number {
    return this.scrollLayout().startInset;
  }

  private searchContentEndInset(): number {
    return this.scrollLayout().endInset;
  }

  private searchFontScale(): number {
    const scale = this.readerWindowMetricsRevision < 0 ? 1 : ReaderWindowCoordinator.metrics().systemFontScale;
    return Number.isFinite(scale) && scale > 0 ? scale : 1;
  }

  private searchFilterHeight(): number {
    return this.headerSpec.filterHeight(this.searchFontScale());
  }

  private searchFilterMaxHeight(): number {
    const metrics = ReaderWindowCoordinator.metrics();
    if (!Number.isFinite(metrics.windowRect.height) || metrics.windowRect.height <= 0) {
      return this.headerSpec.unmeasuredViewportHeight;
    }
    const available = metrics.windowRect.height - readerVisualSafeTop(metrics) -
      Math.max(readerVisualSafeBottom(metrics), metrics.keyboardInsets.bottom);
    const base = readerSearchHeaderHeight(this.headerSpec, true, false,
      this.searchBarHeight(), this.searchStatsHeight(), 0, 0);
    // Only long filter options scroll. The input/progress rows stay intact,
    // and ordinary windows retain room for the result header and first book.
    return Math.max(this.headerSpec.filterMinExpandedHeight,
      available - base - this.headerSpec.filterViewportReserve);
  }

  private searchFilterLabelWidth(): number {
    return 51 * Math.max(1, this.searchFontScale());
  }

  private searchBarHeight(): number {
    return this.headerSpec.barHeight(this.searchControlHeight());
  }

  private searchOuterInset(): number { return this.headerSpec.outerInset(this.expandedLayout); }

  private searchResultWidth(): number { return Math.max(0, this.contentFrame().width - 2 * this.searchOuterInset()); }

  private searchActionWidth(): number { return readerSearchActionWidth(this.expandedLayout, this.searchFontScale()); }

  private searchControlHeight(): number { return readerSearchControlHeight(this.searchFontScale()); }

  private hasActiveSearchFilters(): boolean {
    return this.selectedGroupName !== '全部' || this.selectedContentType !== '全部类型';
  }

  private searchBottomInset(minimum: number = 20): number {
    if (this.readerWindowMetricsRevision < 0) { return minimum; }
    return readerFloatingBarBottomInset(ReaderWindowCoordinator.metrics(), minimum);
  }

  private operation(): SearchOperationFacts | undefined {
    const presentation = this.presentation;
    if (presentation.kind === 'loading' || presentation.kind === 'results' || presentation.kind === 'empty' || presentation.kind === 'error') {
      return presentation.operation;
    }
    return undefined;
  }

  private retryOperation(): void {
    const operation = this.operation();
    if (operation !== undefined && !operation.canRetry) return;
    this.onRetry();
  }

  private isSweeping(): boolean {
    const operation = this.operation();
    if (operation !== undefined) return operation.canCancel;
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
    return this.presentation.kind === 'empty' && (this.operation()?.fact === 'cancelled' || this.presentation.stopped === true);
  }

  private submitSearch(): void {
    if (!this.ownsPageQuery()) return;
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
    this.selectedContentType = '全部类型';
    this.onSearch(keyword, scope);
  }

  /** undefined = all enabled sources; otherwise the selected group's usable subset. */
  private scopeSourceIds(): string[] | undefined {
    if (this.selectedGroupName === '全部') return undefined;
    const scope = this.scopeEntries().find((entry: SearchScopeEntry): boolean => entry.name === this.selectedGroupName);
    return scope === undefined ? [] : scope.sourceIds.slice();
  }

  private groupNames(): string[] {
    return this.scopeEntries().map((entry: SearchScopeEntry): string => entry.name);
  }

    /**
     * Keep the first-release search scope intentionally small.  Core source
     * groups are still carried by SearchSource for source-switch and future
     * grouped search, but they are not a user-facing search scope yet.  A
     * source group here used to turn every provider label (for example 七猫)
     * into a filter chip, which changed the approved local/online contract and
     * made the header grow as sources arrived.
     */
  private scopeEntries(): SearchScopeEntry[] {
    const entries: SearchScopeEntry[] = [];
    const byName: Map<string, SearchScopeEntry> = new Map();
    const add = (name: string, sourceId: string): void => {
      const trimmed = name.trim();
      if (trimmed.length === 0 || sourceId.trim().length === 0) return;
      let entry = byName.get(trimmed);
      if (entry === undefined) {
        entry = { name: trimmed, sourceIds: [] };
        byName.set(trimmed, entry);
        entries.push(entry);
      }
      if (entry.sourceIds.indexOf(sourceId) < 0) entry.sourceIds.push(sourceId);
    };
    const presentedResults = this.presentation.kind === 'results' && Array.isArray(this.presentation.results) ?
      this.presentation.results : [];
    // The first-release contract always exposes exactly the local and online
    // scopes.  An empty local scope is still useful feedback (it produces the
    // local empty state) and must not make the filter row change shape as
    // streaming results arrive.
    add(SEARCH_LOCAL_SCOPE, 'local');
    const knownRemoteIds = new Set<string>();
    const sources = Array.isArray(this.searchSources) ? this.searchSources : [];
    for (const source of sources) {
      if (!source.enabled) continue;
      add(SEARCH_ONLINE_SCOPE, source.sourceId);
      knownRemoteIds.add(source.sourceId);
    }
    // During a streaming sweep a result can arrive before the corresponding
    // source snapshot is published. Keep the row filter and the next submit
    // coherent by admitting that source to the fallback online scope.
    if (this.presentation.kind === 'results') {
      for (const book of presentedResults) {
        if (book.sourceId !== 'local' && !knownRemoteIds.has(book.sourceId)) add(SEARCH_ONLINE_SCOPE, book.sourceId);
      }
    }
    return entries;
  }

  private selectGroup(name: string): void {
    if (!this.ownsPageQuery() || this.selectedGroupName === name) return;
    this.selectedGroupName = name;
    this.viewState.category = name;
    this.resetFilteredResults();
  }

  private resetFilteredResults(): void {
    this.userInteracting = false;
    this.userScrolling = false;
    this.resultFlushEpoch += 1;
    this.restoreEpoch += 1;
    this.restoreCancelled = false;
    this.restoreScheduled = false;
    this.viewState.anchorKey = '';
    this.viewState.anchorOffset = 0;
    this.viewState.anchorIndex = 0;
    this.viewState.anchorItemY = 0;
    this.viewState.anchorAtStart = true;
    this.startPositionedQuery = -1;
    this.restoreKey = ''; this.restoreOffset = 0; this.restoreItemY = 0;
    this.viewState.anchorNeighbors = []; this.scrollRestored = false;
    this.resultScroller.scrollEdge(Edge.Top);
    this.refreshVisibleResults();
    this.scheduleScrollRestore();
  }

  private selectContentType(contentType: SearchContentType): void {
    if (!this.ownsPageQuery() || this.selectedContentType === contentType) return;
    this.selectedContentType = contentType;
    this.viewState.contentType = contentType;
    // Reuse scope navigation/anchor handling without changing the query run.
    this.resetFilteredResults();
  }

  private filteredEmptyMessage(): string {
    const selection = `${this.selectedGroupName} · ${this.selectedContentType}`;
    if (this.presentation.kind === 'results' && this.presentation.searching) {
      return `当前筛选（${selection}）下暂无结果，搜索仍在继续。`;
    }
    if (this.presentation.kind === 'results' && this.presentation.stopped === true) {
      return `搜索已停止，已返回的结果中没有符合当前筛选（${selection}）的书籍。可切换范围或内容类型。`;
    }
    return `已返回的结果中没有符合当前筛选（${selection}）的书籍，可切换范围或内容类型。`;
  }

  @Builder
  private searchBar() {
    Row({ space: 4 }) {
      ReaderIconButton({ icon: (this.appThemeScheme === 'night' ? $r('app.media.book_detail_back_theme_night') : $r('app.media.book_detail_back')),
        specId: 'toolbar-compact', accessibilityLabel: '返回', onTap: (): void => this.onBack() })
        .constraintSize({ minWidth: 44, minHeight: this.searchControlHeight() });

      Row() {
        ReaderSearchField({
          variant: 'bookPanel',
          mode: 'submit',
          focusOnAppear: this.focusInputOnAppear,
          text: this.keyword,
          placeholder: '搜索书名、作者...',
          accessibilityLabel: '搜索书名或作者',
          expandedLayout: this.expandedLayout,
          clearable: true,
          submitEnabled: this.presentation.kind !== 'loading',
          onTextChange: (value: string): void => {
            if (!this.ownsPageQuery()) return;
            this.keyword = value;
            this.viewState.keywordDraft = value;
          },
          onSubmit: (): void => this.submitSearch(),
        });
      }
      .layoutWeight(1)
      .alignItems(VerticalAlign.Center);

      // The original action remains one stop/submit intent inside the panel.
      ReaderButton({ scheme: this.appThemeScheme, specId: this.expandedLayout ? 'search-field-wide' : 'search-field-phone',
        label: this.isSweeping() ? '停止' : '搜索', isBusy: this.isSweeping(), actionEnabled: this.canSubmit(),
        leading: (): void => this.searchActionLeading(),
        onAction: (): void => { if (!this.ownsPageQuery()) return; if (this.isSweeping()) this.onStop(); else this.submitSearch(); } });
    }
    .width('100%')
    .height(this.searchBarHeight())
    .padding({ left: this.headerSpec.barPaddingLeft, right: this.headerSpec.barPaddingRight,
      top: this.headerSpec.barPaddingTop, bottom: this.headerSpec.barPaddingBottom })
    .alignItems(VerticalAlign.Center)
    .hitTestBehavior(HitTestMode.Transparent);
  }

  @Builder
  private searchActionLeading() {
    SearchSpinner({ active: this.isSweeping(), runKey: this.spinnerRunKey,
      reduceMotion: this.reduceMotion, diameter: 14 });
  }

  @Builder
  private stateContent() {
    if (this.hasSearchSession()) {
      this.resultsContent();
    } else if (this.presentation.kind === 'initial') {
      Scroll() {
        Column() { this.initialContent(); }.width('100%').padding({ top: this.searchContentStartInset() });
      }.width('100%').height('100%')
        .align(Alignment.TopStart).scrollBar(BarState.Off);
    } else if (this.presentation.kind === 'sourceRequired') {
      Scroll() {
        Column() {
          this.sourceRequiredContent(this.sourceRequiredReason());
          this.initialContent();
        }.width('100%').padding({ top: this.searchContentStartInset() });
      }.width('100%').height('100%').align(Alignment.TopStart).scrollBar(BarState.Off);
    } else if (this.presentation.kind === 'sourceLoadError') {
      Scroll() {
        Column() {
          this.sourceLoadErrorContent();
          this.initialContent();
        }.width('100%').padding({ top: this.searchContentStartInset() });
      }.width('100%').height('100%').align(Alignment.TopStart).scrollBar(BarState.Off);
    }
  }

  private sourceRequiredReason(): string {
    return this.presentation.kind === 'sourceRequired' ? this.presentation.reason : 'noSources';
  }

  private historyStatus(): SearchHistoryStatus | undefined {
    const presentation = this.presentation;
    if (presentation.kind === 'initial' || presentation.kind === 'sourceRequired' ||
      presentation.kind === 'sourceLoadError') return presentation.historyStatus;
    return undefined;
  }

  // Reads presentation.history directly (never a @Builder value parameter):
  // loadHistory can resolve after any entry state and must update the same
  // history chips without relying on an untracked Builder parameter.
  @Builder
  private initialContent() {
    Column({ space: 0 }) {
      if (this.presentation.kind === 'initial' || this.presentation.kind === 'sourceRequired' ||
        this.presentation.kind === 'sourceLoadError') {
        if (this.presentation.historyStatus === 'loading') {
          ReaderPageState({ message: '正在读取搜索历史', loading: true, padded: false });
        } else if (this.presentation.historyStatus === 'loadFailed' || this.presentation.historyStatus === 'clearFailed') {
          ReaderPageState({ message: this.presentation.historyStatus === 'clearFailed' ? '搜索历史清空失败' : '搜索历史读取失败',
            padded: false, customActions: true, actionContent: (): void => {
              this.secondaryPill(this.historyStatus() === 'clearFailed' ? '重试清空' : '重试读取',
                (): void => this.onRetryHistory());
            } }).padding({ bottom: TOK_SPACE_XS });
        }
      }
      if ((this.presentation.kind === 'initial' || this.presentation.kind === 'sourceRequired' ||
        this.presentation.kind === 'sourceLoadError') && this.presentation.history.length > 0) {
        Row() {
          Text('最近搜索')
            .fontFamily(TYPE_SEARCH_HISTORY_HEADING.fontFamily)
            .fontWeight(TYPE_SEARCH_HISTORY_HEADING.fontWeight)
            .fontSize(TYPE_SEARCH_HISTORY_HEADING.fontSizeFp)
            .lineHeight(TYPE_SEARCH_HISTORY_HEADING.lineHeightFp as number)
            .fontColor(readerAppColor('TOK_INK', this.appThemeScheme))
            .layoutWeight(1);
          ReaderButton({ scheme: this.appThemeScheme, specId: 'search-history-clear', label: '清空记录',
            actionEnabled: this.presentation.historyStatus !== 'loading', onAction: (): void => this.onClearHistory() });
        }
        .width('100%')
        .constraintSize({ minHeight: 26 })
        .alignItems(VerticalAlign.Center);

        // All retained history is visible inside the existing page Scroll.
        Flex({ wrap: FlexWrap.Wrap, direction: FlexDirection.Row }) {
          ForEach(this.presentation.history, (keyword: string) => {
            ReaderButton({ scheme: this.appThemeScheme, specId: 'search-history-keyword', label: keyword, availableWidth: this.historyWidth,
              onAction: (): void => { this.keyword = keyword; this.submitSearch(); } });
          }, (keyword: string): string => `search-history-${keyword}`);
        }
        .width('100%')
        .padding({ top: TOK_SPACE_CARD_PADDING });

      }
    }
    .width('100%')
    .padding({
      left: this.expandedLayout ? 20 : 18,
      right: this.expandedLayout ? 20 : 18,
      top: TOK_SPACE_XS,
      bottom: this.searchBottomInset(),
    })
    // Only constrain long chip width; history admission never depends on measurement.
    .onAreaChange((_old: Area, next: Area): void => {
      const outerWidth = readerPageAreaLength(next.width);
      if (!Number.isFinite(outerWidth)) return;
      const width = Math.max(0, outerWidth - (this.expandedLayout ? 40 : 36));
      if (Math.abs(width - this.historyWidth) > .1) {
        this.historyWidth = width;
      }
    });
  }

  private searchFiltersStacked(): boolean { return this.searchFontScale() >= 1.5; }

  // Reuse the existing options and actions; wrapping replaces hidden
  // horizontal option scroll at narrow widths and large text sizes.
  @Builder
  private groupScopeRow() {
    if (this.groupNames().length > 0) {
      Flex({ direction: this.searchFiltersStacked() ? FlexDirection.Column : FlexDirection.Row,
        alignItems: ItemAlign.Start }) {
        Text('来源')
          .width(this.searchFiltersStacked() ? '100%' : this.searchFilterLabelWidth())
          .constraintSize({ minHeight: this.searchFiltersStacked() ? 0 : this.headerSpec.filterMinHeight })
          .fontFamily('ReaderNotoSansSC')
          .fontSize(11)
          .lineHeight(this.headerSpec.filterLabelLineHeight)
          .minFontScale(Math.min(1, this.searchFontScale())).maxFontScale(Math.max(1, this.searchFontScale()))
          .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme));
          Flex({ wrap: FlexWrap.Wrap, alignItems: ItemAlign.Center,
            space: { main: LengthMetrics.vp(TOK_SPACE_XS) } }) {
            this.groupScopeChip('全部');
            ForEach(this.groupNames(), (name: string) => {
              this.groupScopeChip(name);
            }, (name: string): string => `search-group-${name}`);
          }.layoutWeight(this.searchFiltersStacked() ? 0 : 1)
            .width(this.searchFiltersStacked() ? '100%' : undefined)
            .constraintSize({ minHeight: this.headerSpec.filterMinHeight });
      }
      .width('100%')
      .constraintSize({ minHeight: this.searchFilterHeight() });
    }
  }

  @Builder
  private groupScopeChip(label: string) {
    ReaderButton({ scheme: this.appThemeScheme, specId: 'search-scope', label, primary: this.selectedGroupName === label,
      actionAccessibilityLabel: this.selectedGroupName === label ? `当前搜索范围:${label}` : `筛选搜索结果:${label}`,
      onAction: (): void => this.selectGroup(label) });
  }

  @Builder
  private contentTypeRow() {
    Flex({ direction: this.searchFiltersStacked() ? FlexDirection.Column : FlexDirection.Row,
      alignItems: ItemAlign.Start }) {
      Text('内容类型')
        .width(this.searchFiltersStacked() ? '100%' : this.searchFilterLabelWidth())
        .constraintSize({ minHeight: this.searchFiltersStacked() ? 0 : this.headerSpec.filterMinHeight })
        .fontFamily('ReaderNotoSansSC')
        .fontSize(11)
        .lineHeight(this.headerSpec.filterLabelLineHeight)
        .minFontScale(Math.min(1, this.searchFontScale())).maxFontScale(Math.max(1, this.searchFontScale()))
        .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme));
        Flex({ wrap: FlexWrap.Wrap, alignItems: ItemAlign.Center,
          space: { main: LengthMetrics.vp(TOK_SPACE_XS) } }) {
          this.contentTypeChip('全部类型');
          this.contentTypeChip('小说');
          this.contentTypeChip('漫画');
        }.layoutWeight(this.searchFiltersStacked() ? 0 : 1)
          .width(this.searchFiltersStacked() ? '100%' : undefined)
          .constraintSize({ minHeight: this.headerSpec.filterMinHeight });
    }
    .width('100%')
    .constraintSize({ minHeight: this.searchFilterHeight() });
  }

  @Builder
  private contentTypeChip(label: SearchContentType) {
    ReaderButton({ scheme: this.appThemeScheme, specId: 'search-scope', label,
      primary: this.selectedContentType === label,
      actionAccessibilityLabel: this.selectedContentType === label ? `当前内容类型:${label}` : `筛选内容类型:${label}`,
      onAction: (): void => this.selectContentType(label) }).id(`search-content-type-${label}`);
  }

  @Builder
  private loadingContent() {
    // Waiting feedback already belongs to the progress row and stop actor.
    // Keep the same List without introducing a second loading panel.
    Blank().width('100%').height(0);
  }

  private refreshVisibleResults(): void {
    if (!this.ownsPageQuery()) return;
    this.spinnerRunKey = this.viewState.revision;
    if (this.viewStateRevision !== this.viewState.revision) {
      this.resultsDeferred = false;
      this.resultFlushEpoch += 1;
      this.userInteracting = false;
      this.userScrolling = false;
      this.viewStateRevision = this.viewState.revision;
      this.selectedGroupName = this.viewState.category;
      this.selectedContentType = this.viewState.contentType;
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
    // Keep only the latest immutable publication while a finger or an inertial
    // scroll owns the list. Projection's missed-delta path reconstructs it.
    if (this.presentation.kind === 'results' && (this.userInteracting || this.userScrolling)) {
      this.resultsDeferred = true;
      return;
    }
    this.resultsDeferred = false;
    this.acceptResultNoticeFacts();
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
        // Check actual layout once; non-geometric metadata never scrolls.
        if (reordered || !this.scrollRestored || (this.changedGroupKeys?.size ?? 0) > 0) this.scheduleScrollRestore();
      }
    }
    this.publishVisibleGroups();
  }

  private scheduleDeferredResults(): void {
    if (!this.resultsDeferred || !this.pageMounted || this.userInteracting || this.userScrolling) return;
    const flush = ++this.resultFlushEpoch;
    const page = this.pageEpoch;
    const query = this.viewState.revision;
    this.getUIContext().postFrameCallback(new SearchLayoutFrame((): void => {
      if (flush !== this.resultFlushEpoch || !this.pageMounted || page !== this.pageEpoch ||
        query !== this.viewState.revision || this.userInteracting || this.userScrolling) return;
      if (this.resultsDeferred) this.refreshVisibleResults();
    }));
  }

  private onListTouch(type: TouchType): void {
    if (!this.ownsList()) return;
    if (type === TouchType.Down) {
      this.userInteracting = true;
      this.resultFlushEpoch += 1;
      this.cancelScrollRestoreForUser();
    } else if (type === TouchType.Up || type === TouchType.Cancel) {
      this.userInteracting = false;
      // The click dispatch still owns its pressed identity until this event
      // completes. Do not replace native rows in the Up handler itself.
      this.scheduleDeferredResults();
      if (!this.userScrolling) this.displayIdleRevision += 1;
    }
  }

  private onListScrollStop(): void {
    if (!this.ownsList()) return;
    this.userScrolling = false;
    this.scheduleDeferredResults();
    if (!this.userInteracting) this.displayIdleRevision += 1;
  }

  private onListWillScroll(offset: number, source: ScrollSource): void {
    if (!this.ownsList()) return;
    const userInput = source === ScrollSource.DRAG || source === ScrollSource.FLING ||
      source === ScrollSource.OTHER_USER_INPUT || source === ScrollSource.SCROLL_BAR ||
      source === ScrollSource.SCROLL_BAR_FLING;
    if (!userInput || !Number.isFinite(offset) || Math.abs(offset) < .01) return;
    this.userScrolling = true;
    this.resultFlushEpoch += 1;
    this.cancelScrollRestoreForUser();
  }

  private onCardDisplayFactsChange(): void {
    if (!this.ownsList() || this.userInteracting || this.userScrolling || this.headerAnchorPending) return;
    // This callback precedes the card's next layout. Keep the current native
    // anchor while an offscreen card admits its deferred metadata dimensions.
    this.saveScrollAnchor();
    this.restoreKey = this.viewState.anchorKey;
    this.restoreItemY = this.viewState.anchorItemY;
    this.restoreOffset = this.viewState.anchorOffset;
    this.restoreCancelled = false;
    this.scheduleScrollRestore();
  }

  @Builder
  private resultSummary() {
    Flex({ direction: this.searchSummaryStacked() ? FlexDirection.Column : FlexDirection.Row,
      alignItems: this.searchSummaryStacked() ? ItemAlign.Start : ItemAlign.Center,
      justifyContent: FlexAlign.Center }) {
      Text() {
        Span('找到 ');
        Span(`${this.presentation.kind === 'results' ? this.visibleGroups.length : 0}`).fontWeight(FontWeight.Medium);
        Span(' 本');
      }.fontFamily('ReaderNotoSansSC').fontSize(14).lineHeight(21)
        .fontColor(readerAppColor('TOK_INK', this.appThemeScheme))
        .minFontScale(Math.min(1, this.searchFontScale())).maxFontScale(Math.max(1, this.searchFontScale()))
        .layoutWeight(this.searchSummaryStacked() ? 0 : 1);
      Text(this.searchStatusLabel()).fontFamily('ReaderNotoSansSC').fontSize(12).lineHeight(18)
        .fontColor(this.searchStatusColor())
        .minFontScale(Math.min(1, this.searchFontScale())).maxFontScale(Math.max(1, this.searchFontScale()));
    }.width('100%').constraintSize({ minHeight: this.searchSummaryHeight() })
      .padding({ top: this.headerSpec.summaryPaddingTop, bottom: this.headerSpec.summaryPaddingBottom });
  }

  private searchStatusColor(): string {
    if (this.presentation.kind === 'error') return readerAppColor('app.search.failedStatus', this.appThemeScheme);
    if (this.isSweeping()) return readerAppColor('TOK_GREEN', this.appThemeScheme);
    if (this.hasSearchNotice('partial') || this.hasSearchNotice('failed')) return readerAppColor('app.search.partialStatus', this.appThemeScheme);
    return readerAppColor('TOK_MUTED', this.appThemeScheme);
  }

  private searchStopped(): boolean {
    return (this.presentation.kind === 'results' || this.presentation.kind === 'empty') &&
      (this.operation()?.fact === 'cancelled' || this.presentation.stopped === true);
  }

  private searchStatusLabel(): string {
    if (this.searchStopped()) return '已停止';
    if (this.isSweeping()) return '搜索中';
    if (this.presentation.kind === 'error') return '搜索失败';
    if (this.hasSearchNotice('partial') || this.hasSearchNotice('failed')) return '部分失败';
    return '搜索完成';
  }

  private searchProgressText(): string {
    const presentation = this.presentation;
    if (presentation.kind === 'loading') return '正在搜索本地与在线书籍…';
    if (presentation.kind === 'results') {
      if (presentation.totalSourceCount <= 0) return this.isSweeping() ?
        '正在搜索本地与在线书籍…' : this.searchStopped() ? '已停止搜索' : '本次搜索已结束';
      const progress = `${presentation.completedSourceCount}/${presentation.totalSourceCount} 个书源`;
      if (this.isSweeping()) return `正在搜索 ${progress}`;
      return `已搜索 ${progress}`;
    }
    if (presentation.kind === 'empty' || presentation.kind === 'error') {
      if (presentation.searchedSourceCount > 0) return `已搜索 ${presentation.searchedSourceCount} 个书源`;
      return this.searchStopped() ? '已停止搜索' : presentation.kind === 'error' ? '本次搜索未完成' : '本次搜索已结束';
    }
    return '';
  }

  private hasSearchNotice(kind: string): boolean {
    const facts = this.captureSearchNoticeFacts();
    if (kind === 'partial') return facts.partial;
    if (kind === 'failed') return facts.failed > 0;
    return facts.skipped > 0;
  }

  private hasDisplayedSearchNotice(kind: string): boolean {
    const facts = this.displayedSearchNoticeFacts();
    if (kind === 'partial') return facts.partial;
    if (kind === 'failed') return facts.failed > 0;
    return facts.skipped > 0;
  }

  private captureSearchNoticeFacts(): SearchNoticeFacts {
    const presentation = this.presentation;
    const facts: SearchNoticeFacts = { queryRevision: this.viewState.revision,
      operationGeneration: this.operation()?.generation, partial: false,
      partialText: '', failed: 0, skipped: 0, canRetry: false };
    if (presentation.kind === 'results' || presentation.kind === 'empty' || presentation.kind === 'error') {
      facts.partial = presentation.localSearchFailed === true || presentation.sourceListFailed === true;
      facts.partialText = facts.partial ? this.partialSearchFailure() : '';
      facts.failed = presentation.failedSourceCount ?? 0;
      facts.skipped = presentation.skippedSourceCount ?? 0;
      facts.canRetry = this.operation()?.canRetry !== false;
    }
    return facts;
  }

  private displayedSearchNoticeFacts(): SearchNoticeFacts {
    const retained = this.resultNoticeFacts;
    if (this.presentation.kind === 'results' && retained?.queryRevision === this.viewState.revision) return retained;
    return this.captureSearchNoticeFacts();
  }

  private acceptResultNoticeFacts(): void {
    if (this.presentation.kind !== 'results') {
      if (this.resultNoticeFacts !== undefined) this.resultNoticeFacts = undefined;
      return;
    }
    const next = this.captureSearchNoticeFacts();
    const previous = this.resultNoticeFacts;
    const sameQuery = previous?.queryRevision === next.queryRevision;
    const sameText = sameQuery && previous?.partial === next.partial && previous?.partialText === next.partialText &&
      previous?.failed === next.failed && previous?.skipped === next.skipped;
    if (sameText && previous?.canRetry === next.canRetry && previous?.operationGeneration === next.operationGeneration) return;
    // This executes only after the list's existing interaction freeze admits
    // the latest publication. Capture geometry before the prefix can reflow.
    if (sameQuery && !sameText) this.onCardDisplayFactsChange();
    this.resultNoticeFacts = next;
  }

  private hasAnySearchNotice(): boolean {
    return this.hasDisplayedSearchNotice('partial') || this.hasDisplayedSearchNotice('failed') || this.hasDisplayedSearchNotice('skipped');
  }

  private searchNoticeText(kind: string): string {
    const facts = this.displayedSearchNoticeFacts();
    if (kind === 'partial') return facts.partialText;
    if (kind === 'failed') return `${facts.failed} 个书源搜索失败。`;
    return `已跳过 ${facts.skipped} 个近期不可用书源。`;
  }

  private searchNoticeActionEnabled(kind: string): boolean {
    const displayed = this.displayedSearchNoticeFacts();
    const current = this.captureSearchNoticeFacts();
    if (displayed.queryRevision !== current.queryRevision || displayed.operationGeneration !== current.operationGeneration) return false;
    const available = kind === 'partial' ? current.partial : kind === 'failed' && current.failed > 0;
    return available && !this.isSweeping() && current.canRetry;
  }

  private searchNoticeOffersRetry(kind: string): boolean {
    return kind === 'partial' ? this.hasDisplayedSearchNotice('partial') :
      kind === 'failed' && !this.hasDisplayedSearchNotice('partial') && this.hasDisplayedSearchNotice('failed');
  }

  private hasSearchNoticeRetry(): boolean {
    return this.hasDisplayedSearchNotice('partial') || this.hasDisplayedSearchNotice('failed');
  }

  private searchProgressRetryHandler(kind: string): () => void {
    const page = this.pageEpoch;
    const query = this.viewState.revision;
    const operationGeneration = this.displayedSearchNoticeFacts().operationGeneration;
    return (): void => {
      if (!this.pageMounted || page !== this.pageEpoch || query !== this.viewState.revision ||
        operationGeneration !== this.operation()?.generation) return;
      if (!this.searchNoticeActionEnabled(kind)) return;
      this.retryOperation();
    };
  }

  private searchNoticeActionKey(kind: string): string {
    const facts = this.displayedSearchNoticeFacts();
    return `${this.pageEpoch}:${facts.queryRevision}:${facts.operationGeneration}:${kind}`;
  }

  @Builder
  private searchProgressDetails() {
    if (this.hasDisplayedSearchNotice('partial')) { this.searchProgressNotice('partial'); }
    if (this.hasDisplayedSearchNotice('failed')) { this.searchProgressNotice('failed'); }
    if (this.hasDisplayedSearchNotice('skipped')) { this.searchProgressNotice('skipped'); }
  }

  @Builder
  private mainSearchNotices() {
    Column() { this.resultSummary(); this.searchProgressDetails(); }
      .width('100%')
      .padding({ left: 12, right: 12,
        top: 0, bottom: this.hasAnySearchNotice() ? 4 : 0 })
      .backgroundColor(readerAppColor('TOK_PAPER', this.appThemeScheme))
      .border({ width: { bottom: TOK_BORDER_W },
        color: { bottom: readerAppColor('app.search.listRule', this.appThemeScheme) } });
  }

  @Builder
  private searchProgressNotice(kind: string) {
    Row({ space: 8 }) {
      Text(this.searchNoticeText(kind)).layoutWeight(1)
        .fontFamily('ReaderNotoSansSC').fontWeight(FontWeight.Regular).fontSize(12).lineHeight(18)
        .minFontScale(Math.min(1, this.searchFontScale())).maxFontScale(Math.max(1, this.searchFontScale()))
        .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme));
      // ReaderButton keeps its regular action callback for the instance.
      // Replace only the action when its displayed task identity changes.
      if (this.searchNoticeOffersRetry(kind)) {
        ForEach([this.searchNoticeActionKey(kind)], (_key: string) => {
          ReaderButton({ scheme: this.appThemeScheme, specId: 'search-retry-progress', label: '重试',
            actionEnabled: this.searchNoticeActionEnabled(kind),
            onAction: this.searchProgressRetryHandler(kind) })
            .constraintSize({ minWidth: 44, minHeight: this.searchControlHeight() });
        }, (key: string) => key);
      }
    }.width('100%').alignItems(VerticalAlign.Center);
  }

  // ArkUI does not track mutable @Builder value parameters. Read state at
  // the consuming nodes so category changes and stop both update in place.
  @Builder
  private resultsContent() {
        List({ scroller: this.resultScroller }) {
          // The permanent result header is native index zero in every state.
          ListItem() { this.mainSearchNotices(); }.id('search-main-notices');
          if (this.presentation.kind === 'loading') {
            ListItem() { this.loadingContent(); }
          } else if (this.presentation.kind === 'empty') {
            ListItem() { this.emptyContent(this.presentation.keyword, this.presentation.searchedSourceCount); }
          } else if (this.presentation.kind === 'error') {
            ListItem() { this.errorContent(this.presentation.searchedSourceCount); }
          } else if (this.visibleGroups.length === 0) {
            ListItem() {
              ReaderPageState({ message: this.filteredEmptyMessage() });
            }
          }
          LazyForEach(this.resultDataSource, (group: SearchBookGroup) => {
            ListItem() {
              SearchResultCard({ group, viewState: this.viewState, queryRevision: this.viewState.revision,
                displayIdleRevision: this.displayIdleRevision,
                expandedLayout: this.expandedLayout, cardWidth: this.searchResultWidth(),
                canRefreshDisplay: (): boolean => !this.userInteracting && !this.userScrolling,
                onDisplayFactsChange: (): void => this.onCardDisplayFactsChange(),
                onSelectResult: (book: SearchBook, variants: SearchBook[], displayCoverUrl?: string): void => this.onSelectResult(book, variants, displayCoverUrl) });
            }
          }, (group: SearchBookGroup): string =>
            this.resultGroupKey(group.book));
        }
        .width('100%')
        .height('100%')
        .padding({ left: this.searchOuterInset(), right: this.searchOuterInset() })
        .contentStartOffset(readerScrollStartOffset(this.scrollLayout()))
        .contentEndOffset(readerScrollEndOffset(this.scrollLayout()))
        .scrollBar(BarState.Off)
        .maintainVisibleContentPosition(true)
        .onTouch((event: TouchEvent): void => this.onListTouch(event.type))
        .onWillScroll((offset: number, _state: ScrollState, source: ScrollSource): void => this.onListWillScroll(offset, source))
        .onScrollStart((): void => { if (this.ownsList() && this.userInteracting) this.userScrolling = true; })
        .onScrollStop((): void => this.onListScrollStop())
        .onScrollIndex((start: number, end: number): void => this.onResultScrollIndex(start, end))
        .onScroll((): void => { if (this.ownsList() && this.scrollRestored) this.saveScrollAnchor(); })
        .onAppear((): void => {
          if (!this.ownsPageQuery()) return;
          this.listMounted = true;
          this.startPositionedQuery = -1;
          this.scheduleScrollRestore();
        })
        .onDisAppear((): void => { this.listMounted = false; this.scrollRestored = false; this.restoreEpoch += 1; })
        .onAreaChange((): void => { if (this.ownsList() && !this.scrollRestored) this.scheduleScrollRestore(); });
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
    const contentType = this.selectedContentType ?? '全部类型';
    const categoryChanged = this.groupedCategory !== this.selectedGroupName;
    const typeChanged = this.groupedContentType !== contentType;
    if (update.orderChanged || categoryChanged || typeChanged ||
      (contentType !== '全部类型' && update.changedKeys.size > 0) || this.projectedGroupKeys === undefined) {
      this.projectedGroupKeys = update.orderedKeys.filter((key: string): boolean => {
        const book = (this.projectedGroups.get(key) as SearchBookGroup).book;
        const scopeIds = this.selectedGroupName === '全部' ? undefined :
          this.scopeEntries().find((entry: SearchScopeEntry): boolean => entry.name === this.selectedGroupName)?.sourceIds;
        // Legacy snapshots may not carry source.list yet; retain the previous
        // identity fallback for the local/online labels until the first source
        // publication arrives.
        const scopeMatches = scopeIds !== undefined ? scopeIds.indexOf(book.sourceId) >= 0 :
          (this.selectedGroupName === '全部' ||
            (this.selectedGroupName === SEARCH_LOCAL_SCOPE ? book.sourceId === 'local' : book.sourceId !== 'local'));
        // Facts admitted by the gateway determine type. Unknown declarations
        // remain visible under All; titles/genres never grant type admission.
        const typeMatches = contentType === '全部类型' || (contentType === '漫画' ? book.category === 'comic' :
          book.category === 'novel' || (book.sourceId === 'local' && book.category === undefined));
        return scopeMatches && typeMatches;
      });
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
    this.groupedContentType = contentType;
    return this.groupedResultsCache;
  }

  private saveScrollAnchor(): void {
    if (!this.ownsList() || !this.scrollRestored || this.headerAnchorPending) return;
    this.viewState.anchorOffset = this.resultScroller.currentOffset().yOffset;
    try {
      const prefix = this.resultScroller.getItemRect(0);
      if (Number.isFinite(prefix.y) && prefix.height > 0)
        this.viewState.anchorAtStart = prefix.y >= this.searchContentStartInset() - .5;
    } catch (_error) {
      if (this.userScrolling) this.viewState.anchorAtStart = false;
    }
    if (this.viewState.anchorKey.length === 0) return;
    try { this.viewState.anchorItemY = this.resultScroller.getItemRect(this.resultNativeIndex(this.viewState.anchorIndex)).y; }
    catch (_error) { /* A lazy row can be between layout passes. */ }
  }

  private resultNativeIndex(bookIndex: number): number { return bookIndex + 1; }

  private onResultScrollIndex(start: number, end: number): void {
    if (!this.ownsList()) return;
    this.publishVisibleGroups(Math.max(0, start - 1), end - 1);
    if (!this.scrollRestored) return;
    // While the notice prefix/top edge owns the viewport, retain the page
    // offset instead of hiding newly admitted notices behind a book anchor.
    if (start === 0 || this.resultScroller.currentOffset().yOffset <= .5) {
      this.viewState.anchorKey = '';
      this.viewState.anchorIndex = 0;
      this.viewState.anchorItemY = 0;
      this.viewState.anchorNeighbors = [];
      this.saveScrollAnchor();
      return;
    }
    const index = start - 1;
    this.viewState.anchorAtStart = false;
    const group = this.visibleGroups[index];
    if (group === undefined) return;
    this.viewState.anchorIndex = index;
    this.viewState.anchorKey = this.resultGroupKey(group.book);
    this.saveScrollAnchor();
  }

  private rememberAnchorNeighbors(): void {
    if (!this.ownsPageQuery()) return;
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

  private restoreMeasuredAnchor(index: number, key: string): boolean {
    try {
      const rect = this.resultScroller.getItemRect(this.resultNativeIndex(index));
      if (!Number.isFinite(rect.y) || !Number.isFinite(rect.height) || rect.height <= 0) return false;
      const offset = Math.max(1 - rect.height,
        Math.min(this.searchContentStartInset(), this.restoreItemY));
      const displacement = rect.y - offset;
      if (Math.abs(displacement) > .5) this.resultScroller.scrollBy(0, displacement);
      this.viewState.anchorKey = key;
      this.viewState.anchorIndex = index;
      this.scrollRestored = true;
      this.saveScrollAnchor();
      return true;
    } catch (_error) { return false; }
  }

  private scheduleScrollRestore(attempt: number = 0): void {
    if (!this.ownsList() || this.headerAnchorPending || this.restoreCancelled || this.restoreScheduled) return;
    this.scrollRestored = false;
    this.restoreScheduled = true;
    const restore = ++this.restoreEpoch;
    const page = this.pageEpoch;
    const list = this.listEpoch;
    const query = this.viewState.revision;
    const current = (): boolean => this.ownsList() && !this.restoreCancelled &&
      restore === this.restoreEpoch && page === this.pageEpoch && page === this.viewState.pageRevision &&
      list === this.listEpoch && query === this.viewState.revision;
    this.getUIContext().postFrameCallback(new SearchLayoutFrame((): void => {
      if (!current()) return;
      let key = this.viewState.resolveKey(this.restoreKey);
      let index = this.visibleGroups.findIndex((group: SearchBookGroup): boolean => this.resultGroupKey(group.book) === key);
      if (index < 0 && this.restoreKey.length > 0) for (const neighbor of this.viewState.anchorNeighbors) {
        key = this.viewState.resolveKey(neighbor);
        index = this.visibleGroups.findIndex((group: SearchBookGroup): boolean => this.resultGroupKey(group.book) === key);
        if (index >= 0) break;
      }
      if (index < 0) {
        if (this.viewState.anchorAtStart || this.restoreKey.length > 0) {
          // List offset zero can consume contentStartOffset. The permanent
          // header's native START is the semantic beginning of a fresh query.
          if (this.startPositionedQuery !== query) {
            this.resultScroller.scrollToIndex(0, false, ScrollAlign.START);
            this.startPositionedQuery = query;
          }
          this.viewState.anchorAtStart = true;
        } else {
          let actual = 0;
          try { actual = this.resultScroller.currentOffset().yOffset; } catch (_error) {}
          if (Math.abs(actual - this.restoreOffset) > .5)
            this.resultScroller.scrollTo({ xOffset: 0, yOffset: this.restoreOffset });
        }
        this.restoreScheduled = false;
        this.scrollRestored = true;
        this.saveScrollAnchor();
        return;
      }
      // A realized row already has an authoritative position. Do not jump it
      // to START and then correct it in the next frame for every metadata tick.
      if (this.restoreMeasuredAnchor(index, key)) {
        this.restoreScheduled = false;
        return;
      }
      // Realize an offscreen anchor only once; subsequent frames only measure.
      if (attempt === 0) this.resultScroller.scrollToIndex(this.resultNativeIndex(index), false, ScrollAlign.START);
      this.restoreScheduled = false;
      if (attempt < 2) this.scheduleScrollRestore(attempt + 1);
      else this.scrollRestored = true;
    }));
  }

  private resultGroupKey(book: SearchBook): string {
    return book.sourceId === 'local' ? `local:${book.bookId}` :
      `online:${book.groupKey ?? readerMediaIdentity(book.category === 'comic',
        this.normalizedBookKey(book.title, book.author, book.authorIdentity, book.sourceRuleVersion))}`;
  }

  private normalizedBookKey(title: string, author: string, proof?: BookAuthorIdentityProof, sourceVersion?: string): string {
    return bookTitleAuthorKey(title, author, proof, sourceVersion);
  }

  private partialSearchFailure(): string {
    if (this.presentation.kind !== 'results' && this.presentation.kind !== 'empty' && this.presentation.kind !== 'error') return '';
    const messages: string[] = [];
    if (this.presentation.localSearchFailed) messages.push(`本地检索：${this.presentation.localFailureMessage ?? '读取未完成，请重试'}`);
    if (this.presentation.sourceListFailed) messages.push(`书源列表：${this.presentation.sourceListFailureMessage ?? '读取未完成，请重试'}`);
    if (messages.length > 0) return messages.join('；');
    const failed = (this.presentation.failedSourceCount ?? 0) > 0 ?
      `${this.presentation.failedSourceCount} 个书源请求失败，可重试或检查书源状态` : '';
    const skipped = (this.presentation.skippedSourceCount ?? 0) > 0 ?
      `${this.presentation.skippedSourceCount} 个近期不可用书源已跳过，可点击重试` : '';
    return [failed, skipped].filter((message: string): boolean => message.length > 0).join('；');
  }

  private searchFailureTitle(): string {
    if (this.presentation.kind !== 'error') return '搜索失败';
    if (this.presentation.localSearchFailed) return '本地检索未完成';
    return this.presentation.sourceListFailed ? '书源列表加载失败' : '书源搜索失败';
  }

  private searchFailureMessage(): string {
    if (this.presentation.kind !== 'error') return '';
    return this.hasAnySearchNotice() ? '' : this.partialSearchFailure();
  }

  @Builder
  private emptyContent(keyword: string, searchedSourceCount: number) {
        Column() {
          ReaderPageState({ title: this.isStoppedEmpty() ? '搜索已停止' : '没有找到相关书籍', padded: false,
            message: this.isStoppedEmpty()
            ? (searchedSourceCount > 0
              ? `已搜索 ${searchedSourceCount} 个书源后停止,未找到「${keyword}」的相关结果`
              : '停止前尚未返回结果，可继续搜索')
            : `已搜索 ${searchedSourceCount} 个书源,未找到「${keyword}」的相关结果`,
            leading: (): void => { this.searchStateIllustration(false); }, customActions: true,
            actionContent: (): void => { this.emptyStateActions(); } });
        }.width('100%').padding({ top: 50, bottom: this.searchBottomInset(40) });
  }

  @Builder
  private emptyStateActions() {
    Column({ space: 0 }) {
      Column({ space: 0 }) {
        Text('搜索建议')
          .width('100%')
          .fontFamily(TYPE_SEARCH_SUGGESTION_HEADING.fontFamily)
          .fontWeight(TYPE_SEARCH_SUGGESTION_HEADING.fontWeight)
          .fontSize(TYPE_SEARCH_SUGGESTION_HEADING.fontSizeFp)
          .lineHeight(TYPE_SEARCH_SUGGESTION_HEADING.lineHeightFp as number)
          .fontColor(readerAppColor('TOK_INK', this.appThemeScheme))
          .maxLines(1);
        this.suggestion('检查书名拼写是否正确');
        this.suggestion('尝试更短的关键词或作者名');
        this.suggestion('前往书源管理添加或启用更多书源');
      }
      .width(this.expandedLayout ? 300 : 190)
      .padding({ left: 18.5, right: 18.5, top: 14.5, bottom: 14.5 })
      .margin({ top: 10 })
      .backgroundColor(readerAppColor('TOK_CARD_BG', this.appThemeScheme))
      .border({ width: TOK_BORDER_W, color: readerAppColor('TOK_BORDER', this.appThemeScheme) })
      .borderRadius(12)
      .alignItems(HorizontalAlign.Start)
      .alignSelf(ItemAlign.Center);

      Row({ space: TOK_SPACE_CONTROL_INLINE }) {
        this.primaryPill('添加更多书源', (): void => this.onManageSources());
        if (!this.hasSearchNoticeRetry()) { this.secondaryPill('重新搜索', (): void => this.retryOperation()); }
      }
      .margin({ top: 20 })
      .alignSelf(ItemAlign.Center);
    }.width('100%');
  }
  /**
   * P0 add-source flow extension state: no source can search online books.
   * The search bar still accepts local-book queries. Layout reuses the Empty
   * surface (illustration, title/description, primary+secondary pill row).
   */
  @Builder
  private sourceRequiredContent(reason: string) {
    Column({ space: 0 }) {
      ReaderPageState({ title: reason === 'noSources' ? '还没有可用书源' : '没有可搜索书籍的书源',
        message: reason === 'noSources' ? '添加书源后可搜索在线书籍；本地导入的书仍可在上方搜索' :
          '启用可搜索书籍的书源；本地导入的书仍可在上方搜索', padded: false,
        leading: (): void => { this.searchStateIllustration(false); }, customActions: true,
        actionContent: (): void => { this.sourceRequiredActions(reason); } });
    }
    .width('100%')
    .padding({ top: 50, bottom: 40 });
  }

  @Builder
  private sourceRequiredActions(reason: string) {
    Row({ space: TOK_SPACE_CONTROL_INLINE }) {
      this.primaryPill(reason === 'noSources' ? '添加书源' : '管理书源',
        (): void => this.onManageSources());
      this.secondaryPill('返回书架', (): void => this.onBack());
    }.margin({ top: 8 }).alignSelf(ItemAlign.Center);
  }

  @Builder
  private sourceLoadErrorContent() {
    Column({ space: 0 }) {
      ReaderPageState({ title: '书源列表加载失败', message: '在线书源暂不可用；本地导入的书仍可在上方搜索',
        padded: false, leading: (): void => { this.searchStateIllustration(true); }, customActions: true,
        actionContent: (): void => { this.sourceLoadErrorActions(); } });
    }
    .width('100%')
    .alignItems(HorizontalAlign.Center)
    .padding({ top: 96, bottom: 40 });
  }

  @Builder
  private sourceLoadErrorActions() {
    Row({ space: TOK_SPACE_CONTROL_INLINE }) {
      this.primaryPill('重试加载', (): void => this.retryOperation());
      this.secondaryPill('返回书架', (): void => this.onBack());
    }.margin({ top: 8 }).alignSelf(ItemAlign.Center);
  }

  @Builder
  private primaryPill(label: string, onTap: () => void) {
    ReaderButton({ scheme: this.appThemeScheme, specId: 'search-primary', label, primary: true, onAction: onTap });
  }

  @Builder
  private secondaryPill(label: string, onTap: () => void) {
    ReaderButton({ scheme: this.appThemeScheme, specId: 'search-secondary', label, onAction: onTap });
  }

  @Builder
  private suggestion(text: string) {
    Row({ space: 6 }) {
      Text('·')
        .fontFamily(TYPE_SEARCH_PROGRESS_META.fontFamily)
        .fontWeight(TYPE_SEARCH_PROGRESS_META.fontWeight)
        .fontSize(TYPE_SEARCH_PROGRESS_META.fontSizeFp)
        .lineHeight(TYPE_SEARCH_PROGRESS_META.lineHeightFp as number)
        .fontColor(readerAppColor('TOK_GREEN', this.appThemeScheme));
      Text(text)
        .fontFamily(TYPE_SEARCH_SUGGESTION_BODY.fontFamily)
        .fontWeight(TYPE_SEARCH_SUGGESTION_BODY.fontWeight)
        .fontSize(TYPE_SEARCH_SUGGESTION_BODY.fontSizeFp)
        .lineHeight(TYPE_SEARCH_SUGGESTION_BODY.lineHeightFp as number)
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
      Column() {
        ReaderPageState({ title: this.searchFailureTitle(), message: this.searchFailureMessage(), padded: false,
          leading: (): void => { this.searchStateIllustration(true); }, customActions: true,
          actionContent: (): void => { this.searchErrorActions(); } });
      }.width('100%').padding({ top: 96, bottom: this.searchBottomInset(40) });
  }

  @Builder
  private searchErrorActions() {
    Column() {
      if (!this.hasSearchNoticeRetry()) {
        ReaderButton({ scheme: this.appThemeScheme, specId: 'search-error-retry', label: '重新搜索',
          actionEnabled: this.operation()?.canRetry !== false, onAction: (): void => this.retryOperation() });
      }
      ReaderButton({ scheme: this.appThemeScheme, specId: 'search-error-source', label: '检查书源', onAction: (): void => this.onManageSources() });
    }.width('100%');
  }

  @Builder
  private searchStateIllustration(failed: boolean) {
    if (failed) {
      Image((this.appThemeScheme === 'night' ? $r('app.media.search_error_theme_night') : $r('app.media.search_error')))
        .width(80).height(80).margin({ bottom: 8 });
    } else {
      Image((this.appThemeScheme === 'night' ? $r('app.media.search_empty_theme_night') : $r('app.media.search_empty')))
        .width(128).height(120).margin({ bottom: 16 });
    }
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

interface SearchResultDisplayFacts {
  queryRevision: number;
  book: SearchBook;
  sourceCount: number;
  inBookshelf: boolean;
}

/** A stable lazy row observes enrichment without remounting the whole result. */
@Component
struct SearchResultCard {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  @StorageLink('readerWindowMetricsRevision') private readerWindowMetricsRevision: number = 0;

  // The data source keeps the same @Observed instance for the same book key.
  // ObjectLink delivers metadata changes without replacing the lazy child.
  @ObjectLink @Watch('acceptDisplayFacts') group: SearchBookGroup;
  viewState: SearchViewState = new SearchViewState();
  @Prop @Watch('acceptDisplayFacts') queryRevision: number = 0;
  @Prop @Watch('acceptDisplayFacts') displayIdleRevision: number = 0;
  @Prop expandedLayout: boolean = false;
  @Prop cardWidth: number = 0;
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
  }

  private captureDisplayFacts(): SearchResultDisplayFacts {
    return { queryRevision: this.queryRevision, book: searchBookSnapshot(this.group.book),
      sourceCount: this.group.sourceCount, inBookshelf: this.group.inBookshelf };
  }

  private acceptDisplayFacts(): void {
    if (!this.mounted) return;
    // Prop/ObjectLink callbacks may arrive in either order within one update.
    // The request identity also retires an old-query snapshot, so a new Prop
    // value cannot accidentally pin the preceding query's book while visible.
    const changedQuery = this.displayedFacts?.queryRevision !== this.queryRevision ||
      this.displayedFacts?.book.searchRequestId !== this.group.book.searchRequestId;
    if (changedQuery) {
      this.visibilityEpoch += 1;
      this.selectionEpoch += 1;
      this.pressedSelection = undefined;
    }
    // Keep visible rows stable and leave offscreen height changes pending
    // while a gesture owns the list. A new query replaces its old display.
    if (!changedQuery && (this.displayVisible || !this.canRefreshDisplay())) return;
    if (!changedQuery && this.displayedBookInput === this.group.book &&
      this.displayedFacts?.sourceCount === this.group.sourceCount &&
      this.displayedFacts?.inBookshelf === this.group.inBookshelf) return;
    const next = this.captureDisplayFacts();
    // The owner captures the old geometry before this text can be relaid out.
    // Query changes already have their own navigation reset/restore owner.
    if (!changedQuery) this.onDisplayFactsChange();
    this.displayedBookInput = this.group.book;
    this.displayedFacts = next;
  }

  private displayBook(): SearchBook { return this.displayedFacts?.book ?? this.group.book; }
  private displaySourceCount(): number { return this.group.sourceCount; }
  private displayInBookshelf(): boolean { return this.displayedFacts?.inBookshelf ?? this.group.inBookshelf; }

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
    return { queryRevision: this.displayedFacts?.queryRevision ?? this.queryRevision, book: searchBookSnapshot(this.displayBook()),
      variants: this.group.variants.map((book: SearchBook): SearchBook => searchBookSnapshot(book)),
      coverUrl: this.group.coverUrl };
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
      // Up precedes Click. Retire a drag/no-click after event dispatch rather
      // than dropping the pressed identity before the click can consume it.
      this.getUIContext().postFrameCallback(new SearchLayoutFrame((): void => {
        if (selection === this.selectionEpoch) this.pressedSelection = undefined;
      }));
    }
  }

  private selectResult(source: SourceType): void {
    if (!this.mounted) return;
    const pressed = this.pressedSelection;
    this.selectionEpoch += 1;
    this.pressedSelection = undefined;
    // A cancelled/retired touchscreen press must never fall back to whichever
    // book happens to occupy this native row now. Keyboard/assistive clicks
    // have no Down and intentionally select the currently presented identity.
    if (source === SourceType.TouchScreen && pressed === undefined) return;
    const selected = pressed ?? this.captureSelection();
    if (selected.queryRevision !== this.viewState.revision) return;
    this.onSelectResult(selected.book, selected.variants, selected.coverUrl);
  }

  private displayIntro(): string {
    return bookIntroText(this.displayBook().intro);
  }

  private searchFontScale(): number {
    const scale = this.readerWindowMetricsRevision < 0 ? 1 : ReaderWindowCoordinator.metrics().systemFontScale;
    return Number.isFinite(scale) && scale > 0 ? Math.max(1, scale) : 1;
  }

  private resultTagWidth(): number { return 30 * this.searchFontScale(); }
  private resultTagHeight(): number { return 16 + 14 * (this.searchFontScale() - 1); }

  private coverWidth(): number {
    return this.expandedLayout ? 96 : 88;
  }

  private coverHeight(): number {
    return this.coverWidth() * (this.expandedLayout ? 92 / 68 : 82 / 60);
  }

  private coverErrorHandler(url: string): () => void {
    const group = this.group;
    const requestId = group.book.searchRequestId;
    return (): void => {
      if (this.group === group && group.book.searchRequestId === requestId) group.rejectCover(url);
    };
  }

  build() {
    Row({ space: TOK_SPACE_SM }) {
      Stack({ alignContent: Alignment.Bottom }) {
        if (this.group.coverUrl.length > 0) {
          Image(this.group.coverUrl)
            .width(this.coverWidth())
            .height(this.coverHeight())
            .objectFit(ImageFit.Cover)
            .borderRadius(6)
            .onError(this.coverErrorHandler(this.group.coverUrl));
        } else {
          // Figma CoverContainer placeholder: a primary-green gradient with the
          // book title overlaid at the bottom. No per-book gradient mapping
          // rule exists, so the sole primary gradient is reused as the
          // DESIGN_FIXTURE no-cover placeholder.
          Stack({ alignContent: Alignment.Bottom }) {
            Text(this.displayBook().title)
              .width('100%')
              .fontFamily(TYPE_SEARCH_RESULT_COVER_TITLE.fontFamily)
              .fontWeight(TYPE_SEARCH_RESULT_COVER_TITLE.fontWeight)
              .fontSize(TYPE_SEARCH_RESULT_COVER_TITLE.fontSizeFp)
              .lineHeight(TYPE_SEARCH_RESULT_COVER_TITLE.lineHeightFp as number)
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
        if (this.displayBook().category === 'comic') {
          Flex({ direction: FlexDirection.Row, wrap: FlexWrap.Wrap, alignItems: ItemAlign.Center,
            space: { main: LengthMetrics.vp(6), cross: LengthMetrics.vp(2) } }) {
            Text('漫画').fontFamily('ReaderNotoSansSC').fontWeight(FontWeight.Medium).fontSize(9).lineHeight(14)
              .fontColor(readerAppColor('TOK_ON_PRIMARY', this.appThemeScheme)).width(this.resultTagWidth()).height(this.resultTagHeight())
              .textAlign(TextAlign.Center).backgroundColor(readerAppColor('TOK_GREEN', this.appThemeScheme)).borderRadius(5);
            if (this.displayBook().sourceId === 'local') {
              Text('本地').fontFamily('ReaderNotoSansSC').fontWeight(FontWeight.Medium).fontSize(9).lineHeight(14)
                .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme)).width(this.resultTagWidth()).height(this.resultTagHeight())
                .textAlign(TextAlign.Center).backgroundColor(readerAppColor('TOK_PRIMARY_SOFT', this.appThemeScheme)).borderRadius(5);
            } else {
              Text('在线').fontFamily('ReaderNotoSansSC').fontWeight(FontWeight.Medium).fontSize(9).lineHeight(14)
                .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme)).width(this.resultTagWidth()).height(this.resultTagHeight())
                .textAlign(TextAlign.Center).backgroundColor(readerAppColor('TOK_PRIMARY_SOFT', this.appThemeScheme)).borderRadius(5);
            }
          }.width('100%');
        }

        Column({ space: 4 }) {
          Text(this.displayBook().title)
            .width('100%')
            .fontFamily(TYPE_SEARCH_RESULT_TITLE.fontFamily)
            .fontWeight(TYPE_SEARCH_RESULT_TITLE.fontWeight)
            .fontSize(TYPE_SEARCH_RESULT_TITLE.fontSizeFp)
            .lineHeight(TYPE_SEARCH_RESULT_TITLE.lineHeightFp as number)
            .fontColor(readerAppColor('TOK_INK', this.appThemeScheme))
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis });

          Text(bookAuthorLabel(this.displayBook().author, this.displayBook().authorIdentity, this.displayBook().sourceRuleVersion))
            .width('100%')
            .fontFamily(TYPE_SEARCH_RESULT_AUTHOR.fontFamily)
            .fontWeight(TYPE_SEARCH_RESULT_AUTHOR.fontWeight)
            .fontSize(TYPE_SEARCH_RESULT_AUTHOR.fontSizeFp)
            .lineHeight(TYPE_SEARCH_RESULT_AUTHOR.lineHeightFp as number)
            .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme))
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis });

          if ((this.displayBook().latestChapterTitle?.trim().length ?? 0) > 0) {
            Text(this.displayBook().category === 'comic' ? `最新 · ${this.displayBook().latestChapterTitle}` : this.displayBook().latestChapterTitle)
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

          if (this.displayIntro().length > 0) {
            if (this.displayBook().category !== 'comic') {
            Text(this.displayIntro())
              .width('100%')
              .fontFamily(TYPE_SEARCH_RESULT_INTRO.fontFamily)
              .fontWeight(TYPE_SEARCH_RESULT_INTRO.fontWeight)
              .fontSize(TYPE_SEARCH_RESULT_INTRO.fontSizeFp)
              .lineHeight(TYPE_SEARCH_RESULT_INTRO.lineHeightFp as number)
              .fontColor(readerAppColor('app.SearchResultCard.build.fontColor.FF9A948E', this.appThemeScheme))
              .maxLines(2)
              .textOverflow({ overflow: TextOverflow.Ellipsis });
            }
          }
        }
        .width('100%')
        .alignItems(HorizontalAlign.Start);

        Flex({ direction: FlexDirection.Row, wrap: FlexWrap.Wrap, alignItems: ItemAlign.Center,
          space: { main: LengthMetrics.vp(6), cross: LengthMetrics.vp(2) } }) {
          if (this.displayBook().category !== 'comic') {
            Text('小说')
              .fontFamily(TYPE_SEARCH_RESULT_TAG.fontFamily)
              .fontWeight(TYPE_SEARCH_RESULT_TAG.fontWeight)
              .fontSize(TYPE_SEARCH_RESULT_TAG.fontSizeFp)
              .lineHeight(TYPE_SEARCH_RESULT_TAG.lineHeightFp as number)
              .fontColor(readerAppColor('TOK_GREEN', this.appThemeScheme))
              .padding({ left: 6, right: 6, top: 2, bottom: 2 })
              .backgroundColor(readerAppColor('TOK_PRIMARY_SOFT', this.appThemeScheme))
              .borderRadius(4).constraintSize({ maxWidth: '100%' }).maxLines(1)
              .textOverflow({ overflow: TextOverflow.Ellipsis });
          }
          Text(this.displayBook().sourceName.length > 0 ? this.displayBook().sourceName : this.displayBook().sourceId)
            .fontFamily(TYPE_SEARCH_RESULT_TAG.fontFamily)
            .fontWeight(TYPE_SEARCH_RESULT_TAG.fontWeight)
            .fontSize(TYPE_SEARCH_RESULT_TAG.fontSizeFp)
            .lineHeight(TYPE_SEARCH_RESULT_TAG.lineHeightFp as number)
            .fontColor(readerAppColor('TOK_GREEN', this.appThemeScheme))
            .padding({ left: 6, right: 6, top: 2, bottom: 2 })
            .backgroundColor(readerAppColor('TOK_PRIMARY_SOFT', this.appThemeScheme))
            .borderRadius(4).constraintSize({ maxWidth: '100%' }).maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis });
          Text(this.displayBook().sourceId === 'local' ? '本地书籍' : `已发现 ${this.displaySourceCount()} 个书源`)
            .fontFamily(TYPE_SEARCH_RESULT_TAG.fontFamily)
            .fontWeight(TYPE_SEARCH_RESULT_TAG.fontWeight)
            .fontSize(TYPE_SEARCH_RESULT_TAG.fontSizeFp)
            .lineHeight(TYPE_SEARCH_RESULT_TAG.lineHeightFp as number)
            .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme))
            .padding({ left: 6, right: 6, top: 2, bottom: 2 })
            .backgroundColor(readerAppColor('TOK_PRIMARY_SOFT', this.appThemeScheme))
            .borderRadius(4).constraintSize({ maxWidth: '100%' }).maxLines(1)
              .textOverflow({ overflow: TextOverflow.Ellipsis });
          if (this.displayInBookshelf()) {
            Text('已在书架')
              .fontFamily(TYPE_SEARCH_RESULT_TAG.fontFamily)
              .fontWeight(TYPE_SEARCH_RESULT_TAG.fontWeight)
              .fontSize(TYPE_SEARCH_RESULT_TAG.fontSizeFp)
              .lineHeight(TYPE_SEARCH_RESULT_TAG.lineHeightFp as number)
              .fontColor(readerAppColor('TOK_GREEN', this.appThemeScheme))
              .padding({ left: 6, right: 6, top: 2, bottom: 2 })
              .backgroundColor(readerAppColor('TOK_PRIMARY_SOFT', this.appThemeScheme))
              .borderRadius(4).constraintSize({ maxWidth: '100%' }).maxLines(1)
              .textOverflow({ overflow: TextOverflow.Ellipsis });
          }
        }
        .width('100%')
        .margin({ top: 5 });
      }
      .layoutWeight(1)
      // Only the gap above the tags grows for short metadata. Long metadata
      // grows the row naturally, while the original cover ratio stays intact.
      .constraintSize({ minHeight: this.coverHeight() })
      .justifyContent(FlexAlign.Start)
      .alignItems(HorizontalAlign.Start);
    }
    .width(this.cardWidth)
    .padding({ left: 12, right: 12, top: 14, bottom: 14 })
    .alignItems(VerticalAlign.Top)
    .border({ width: { bottom: TOK_BORDER_W }, color: { bottom: readerAppColor('app.search.listRule', this.appThemeScheme) } })
      .onVisibleAreaChange([0], this.displayVisibilityHandler())
      .onTouch((event: TouchEvent): void => this.onCardTouch(event.type))
      .onClick((event: ClickEvent): void => this.selectResult(event.source));
  }

  @Builder
  private resultTag(label: string, primary: boolean) {
    Text(label)
      .fontFamily('ReaderNotoSansSC')
      .fontWeight(FontWeight.Medium)
      .fontSize(9)
      .lineHeight(14)
      .fontColor(primary ? readerAppColor('TOK_ON_PRIMARY', this.appThemeScheme) : readerAppColor('TOK_MUTED', this.appThemeScheme))
      .width(this.resultTagWidth())
      .height(this.resultTagHeight())
      .textAlign(TextAlign.Center)
      .backgroundColor(primary ? readerAppColor('TOK_GREEN', this.appThemeScheme) : readerAppColor('TOK_PRIMARY_SOFT', this.appThemeScheme))
      .borderRadius(4);
  }
}
