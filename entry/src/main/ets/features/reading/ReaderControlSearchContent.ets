import { readerAppColor } from '../common/ReaderThemeRegistry';
import { PathShape } from '@ohos.arkui.shape';
import { sampleReaderControlMotionPresentation, readerControlMotionClipRects, readerControlMotionClipPath,
  readerControlMotionVisibleRect, type ReaderControlMotionPresentation, type ReaderControlMotionClipRect } from './ReaderControlMotionPresentation';
import { readerControlMorphScrollPath, sampleReaderControlMorphScrollPath,
  type ReaderControlMorphScrollPath } from './ReaderControlMorphScroll';
import { registerReaderFonts } from '../common/ReaderFonts';
import { TOK_BORDER_W, TOK_DANGER, TOK_LINE, TOK_LINE_STRONG, TOK_READ_INK,
  TOK_READ_MUTED, TOK_READ_PRIMARY, TOK_SURFACE_PANEL, TOK_SURFACE_PANEL_SOFT } from '../common/ReaderTokens';
import type { ReadingContentSearchResult } from './ReadingSessionFlowGateway';
import type { ReaderQuickSearchState } from './ReaderQuickSearchPanel';
import { ReaderContentSearchPublication } from './ReaderContentSearchPublication';
import { ReaderContentSearchDataSource, readerContentSearchResultKey } from './ReaderContentSearchDataSource';
import { READER_SEARCH_LIST_ITEM_HEIGHT, READER_SEARCH_LIST_CACHE_COUNT, readerControlSearchListProjection,
  readerControlSearchListRowTranslation, readerControlSearchListScrollDelta,
  type ReaderControlSearchListProjection } from './ReaderControlSearchListProjection';
import { splitReaderSearchSnippet, type ReaderSearchSnippetParts } from './ReaderSearchHighlight';
import { sampleReaderControlSearch, type ReaderControlSearchFrame } from './ReaderControlSearchGeometry';
import { createReaderControlSearchScroll, resetReaderControlSearchScroll, sampleReaderControlSearchScroll,
  observeReaderControlSearchScroll, prepareReaderControlSearchScrollRebase,
  confirmReaderControlSearchScrollRebase, cancelReaderControlSearchScrollRebase,
  type ReaderControlSearchScrollState, type ReaderControlSearchScrollLayout,
  type ReaderControlSearchScrollProjection, type ReaderControlSearchScrollSource } from './ReaderControlSearchScroll';

let readerContentSearchInputSequence: number = 0;

/** Search 1938:4927 content only. One input and one result scroll tree survive
 * Quick/Full; Stage owns the shell, header, p, whole visibility and timing.
 * The input primitive's real IME/caret semantics are retained here because the
 * fixed-height ReaderSearchField variants cannot represent 24->32 geometry. */
@Component
export struct ReaderControlSearchContent {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';

  @Prop @Watch('onResultLayoutChanged') motionProgress: number = 0;
  @Prop @Watch('onResultLayoutChanged') availableWidth: number = 286;
  @Prop @Watch('onResultLayoutChanged') availableHeight: number = 190;
  @Prop fullContentHeight: number = 666;
  @Prop quickContentHeight: number = 190;
  @Prop @Watch('onInputChanged') interactionEnabled: boolean = true;
  @Prop @Watch('dismissTemporaryLayer') dismissTemporaryRevision: number = 0;
  @Prop query: string = '';
  searchPublication: ReaderContentSearchPublication = new ReaderContentSearchPublication();
  @Prop @Watch('acceptSearchPublication') searchRevision: number = 0;
  @State @Watch('onResultDataChanged') private state: ReaderQuickSearchState = { kind: 'idle' };
  private acceptedSearchState: ReaderQuickSearchState | undefined = undefined;
  onTemporaryLayerChange: (active: boolean) => void = (_active: boolean): void => {};
  onBack: () => void = (): void => {};
  onQueryChange: (query: string) => void = (_query: string): void => {};
  onSearch: () => void = (): void => {};
  onLoadMore: () => void = (): void => {};
  onSelectResult: (result: ReadingContentSearchResult) => void =
    (_result: ReadingContentSearchResult): void => {};
  private inputController: TextInputController = new TextInputController();
  private readonly queryInputId: string = `reader-content-search-input-${++readerContentSearchInputSequence}`;
  private queryInputMounted: boolean = false;
  private resultScroller: Scroller = new Scroller();
  private readonly resultDataSource: ReaderContentSearchDataSource = new ReaderContentSearchDataSource();
  @State private resultItemSizes: ChildrenMainSize = new ChildrenMainSize(READER_SEARCH_LIST_ITEM_HEIGHT);
  private resultNativeFollowTimer: number = -1;
  private resultNativeFollowLifecycle: number = 0;
  private resultNativeRawBase: number = 0;
  @State private resultScrollPosition: ReaderControlSearchScrollState = createReaderControlSearchScroll();
  private resultScrollMounted: boolean = false;
  private resultViewportHeight: number = 0;
  private resultPointers: number[] = [];
  private resultUserScrolling: boolean = false;
  private resultScrollSource: ReaderControlSearchScrollSource = 'unknown';
  private indexedResultRows: ReadingContentSearchResult[] | undefined = undefined;
  private resultRowIndexes: Map<string, number> = new Map<string, number>();
  private resultMotionPath: ReaderControlMorphScrollPath | undefined = undefined;
  private resultRestingProgress: number = 0;
  private resultRestingLayout: ReaderControlSearchScrollLayout | undefined = undefined;

  aboutToAppear(): void {
    this.queryInputMounted = true;
    registerReaderFonts(this.getUIContext().getFont());
    this.acceptSearchPublication();
    this.onResultDataChanged();
  }

  aboutToDisappear(): void {
    this.queryInputMounted = false;
    this.dismissTemporaryLayer();
    this.onResultScrollDisappear();
  }

  private acceptSearchPublication(): void {
    const next = this.searchPublication.stateAt(this.searchRevision);
    // Compare the raw owner snapshot, not ArkUI's top-level @State proxy.
    if (this.acceptedSearchState === next) return;
    this.acceptedSearchState = next;
    this.state = next;
  }

  private dismissTemporaryLayer(): void {
    this.inputController.stopEditing();
    this.onTemporaryLayerChange(false);
  }

  private focusQueryField(): void {
    if (!this.queryInputMounted || !this.interactionEnabled) return;
    try {
      this.getUIContext().getFocusController().requestFocus(this.queryInputId);
    } catch (_) {
      // A detached native focus context must not fail the retained search UI.
    }
  }

  private onInputChanged(): void {
    if (!this.interactionEnabled) this.dismissTemporaryLayer();
    this.onResultLayoutChanged();
  }

  private frame(): ReaderControlSearchFrame {
    return sampleReaderControlSearch(this.motionProgress, this.availableWidth, this.availableHeight);
  }

  private resultLayout(): ReaderControlSearchScrollLayout {
    return { rowHeightVp: this.frame().rowHeight, viewportHeightVp: this.frame().results.height,
      contentOriginVp: this.frame().firstResult.y, contentEndPaddingVp: this.frame().resultEndPadding,
      resultCount: this.state.kind === 'results' ? this.state.results.length : 0 };
  }

  private resultListFrame(): ReaderControlSearchListProjection {
    return readerControlSearchListProjection(this.resultLayout(), this.resultScrollFrame());
  }

  private resultRowTranslation(index: number): number {
    const layout = this.resultLayout();
    const scroll = this.resultScrollFrame();
    const rawBase = this.resultScrollPosition.nativeOffsetVp * this.resultListFrame().visualToNativeRatio;
    return readerControlSearchListRowTranslation(index, layout, scroll, rawBase);
  }

  private presentation(): ReaderControlMotionPresentation {
    return sampleReaderControlMotionPresentation(this.motionProgress);
  }
  private resultClip(chapterIndex: number, chapterOffset: number): PathShape {
    const index = this.currentResultIndex(chapterIndex, chapterOffset);
    const f = sampleReaderControlSearch(1, this.availableWidth, this.fullContentHeight);
    const q = sampleReaderControlSearch(0, this.availableWidth, this.quickContentHeight);
    const b = this.frame();
    const fullOffset = this.resultMotionPath?.fullOffset ?? (this.motionProgress === 1 ? this.resultScrollPosition.anchorRows : 0);
    const quickOffset = this.resultMotionPath?.quickOffset ?? (this.motionProgress === 0 ? this.resultScrollPosition.anchorRows : 0);
    const full: ReaderControlMotionClipRect = { x: f.firstResult.x, y: f.firstResult.y + (index - fullOffset) * f.rowHeight,
      width: f.firstResult.width, height: f.rowHeight };
    const current: ReaderControlMotionClipRect = { x: b.firstResult.x,
      y: b.firstResult.y + index * b.rowHeight - this.resultScrollFrame().offsetVp,
      width: b.firstResult.width, height: b.rowHeight };
    const quick = readerControlMotionVisibleRect({ x: q.firstResult.x,
      y: q.firstResult.y + (index - quickOffset) * q.rowHeight,
      width: q.firstResult.width, height: q.rowHeight }, q.results.height);
    return new PathShape().commands(readerControlMotionClipPath(readerControlMotionClipRects(this.motionProgress,
      full, current, quick, f.results.height, 0), this.getUIContext().vp2px(1)));
  }

  private resultScrollFrame(): ReaderControlSearchScrollProjection {
    return sampleReaderControlSearchScroll(this.resultScrollPosition, this.resultLayout());
  }

  private resultNativeRawOffset(): number {
    if (!this.resultScrollMounted) return 0;
    const offset = this.resultScroller.currentOffset().yOffset;
    if (Number.isFinite(offset)) this.resultNativeRawBase = Math.max(0, offset);
    return this.resultNativeRawBase;
  }

  private resultNativeOffset(layout: ReaderControlSearchScrollLayout = this.resultLayout()): number {
    return this.resultNativeRawOffset() * layout.rowHeightVp / READER_SEARCH_LIST_ITEM_HEIGHT;
  }

  private onResultDataChanged(): void {
    const state = this.state;
    const change = this.resultDataSource.publish(state.kind === 'results' ? state.keyword : state.kind,
      state.kind === 'results' ? state.results : []);
    if (change !== 'replace') {
      if (change === 'append') this.scheduleResultNativeFollow();
      return;
    }
    this.cancelResultNativeFollow();
    this.resultMotionPath = undefined;
    this.resultRestingProgress = this.motionProgress === 1 ? 1 : 0;
    this.resultRestingLayout = this.resultLayout();
    this.resultScrollPosition = resetReaderControlSearchScroll(this.resultScrollPosition, this.resultNativeOffset());
    this.resultScrollSource = 'unknown';
    this.scheduleResultNativeFollow();
  }

  private onResultLayoutChanged(): void {
    const settled = this.interactionEnabled && (this.motionProgress === 0 || this.motionProgress === 1);
    if (this.resultMotionPath === undefined &&
      (!settled || this.motionProgress !== this.resultRestingProgress)) {
      if (this.resultScrollMounted && this.resultRestingLayout !== undefined) {
        // Handoff samples the native last frame before canceling inertia.
        this.resultScrollPosition = observeReaderControlSearchScroll(this.resultScrollPosition,
          this.resultRestingLayout, { nativeOffsetVp: this.resultNativeOffset(this.resultRestingLayout),
            source: this.resultScrollPosition.pendingRebase === undefined ? 'fling' : 'layout',
            progress: this.resultRestingProgress, inputEnabled: true });
        this.resultScroller.scrollTo({ xOffset: 0, yOffset: this.resultNativeRawOffset(), animation: false });
      }
      this.resultMotionPath = readerControlMorphScrollPath(this.resultRestingProgress,
        this.resultScrollPosition.anchorRows);
    }
    if (this.resultMotionPath !== undefined) {
      this.resultScrollPosition = { anchorRows: sampleReaderControlMorphScrollPath(this.resultMotionPath, this.motionProgress),
        nativeOffsetVp: this.resultScrollPosition.nativeOffsetVp, revision: this.resultScrollPosition.revision };
      if (settled) this.resultMotionPath = undefined;
    }
    if (settled) {
      this.resultRestingProgress = this.motionProgress;
      this.resultRestingLayout = this.resultLayout();
    }
    this.resultScrollPosition = cancelReaderControlSearchScrollRebase(this.resultScrollPosition);
    if (!this.interactionEnabled || (this.motionProgress !== 0 && this.motionProgress !== 1)) {
      this.resultUserScrolling = false;
    }
    if (!this.resultScrollMounted) return;
    this.syncResultNativeOffset('layout');
    this.scheduleResultNativeFollow();
  }

  private syncResultNativeOffset(source: ReaderControlSearchScrollSource): void {
    this.resultScrollPosition = observeReaderControlSearchScroll(this.resultScrollPosition, this.resultLayout(), {
      nativeOffsetVp: this.resultNativeOffset(), source: source,
      progress: this.motionProgress, inputEnabled: this.interactionEnabled,
    });
  }

  private onResultScrollAppear(): void {
    this.resultNativeFollowLifecycle += 1;
    this.resultScrollMounted = true;
    this.syncResultNativeOffset('layout');
    this.scheduleResultNativeFollow();
  }

  private onResultScrollDisappear(): void {
    this.resultScrollMounted = false;
    this.cancelResultNativeFollow();
    this.resultViewportHeight = 0;
    this.resultPointers = [];
    this.resultUserScrolling = false;
    this.resultScrollSource = 'unknown';
    this.resultScrollPosition = cancelReaderControlSearchScrollRebase(this.resultScrollPosition);
  }

  private onResultScrollArea(area: Area): void {
    const height = Number(area.height);
    if (!Number.isFinite(height) || height <= 0) return;
    this.resultViewportHeight = height;
    this.syncResultNativeOffset('layout');
    this.scheduleResultNativeFollow();
  }

  private onResultWillScroll(y: number, source: ScrollSource): OffsetResult {
    const accepted = this.resultScrollMounted && (source === ScrollSource.SCROLLER ||
      (this.interactionEnabled && (this.motionProgress === 0 || this.motionProgress === 1)));
    if (!accepted) { this.resultScrollSource = 'unknown'; return { xOffset: 0, yOffset: 0 }; }
    if (source === ScrollSource.DRAG) this.resultScrollSource = 'drag';
    else if (source === ScrollSource.FLING) this.resultScrollSource = 'fling';
    else if (source === ScrollSource.SCROLL_BAR) this.resultScrollSource = 'scrollBar';
    else if (source === ScrollSource.SCROLL_BAR_FLING) this.resultScrollSource = 'scrollBarFling';
    else if (source === ScrollSource.OTHER_USER_INPUT) this.resultScrollSource = 'otherUserInput';
    else if (source === ScrollSource.SCROLLER || source === ScrollSource.SCROLLER_ANIMATION) {
      this.resultScrollSource = 'programmatic';
    } else this.resultScrollSource = 'unknown';
    if (this.resultScrollSource !== 'programmatic' && this.resultScrollSource !== 'unknown') {
      this.resultUserScrolling = true;
      this.resultScrollPosition = cancelReaderControlSearchScrollRebase(this.resultScrollPosition);
    }
    return { xOffset: 0, yOffset: readerControlSearchListScrollDelta(
      this.resultNativeRawOffset(), y, this.resultListFrame().maxOffsetVp) };
  }

  private onResultDidScroll(): void {
    if (!this.resultScrollMounted) return;
    const source = this.resultScrollSource;
    this.resultScrollSource = 'unknown';
    this.syncResultNativeOffset(source);
    const pending = this.resultScrollPosition.pendingRebase;
    if (pending !== undefined) {
      this.resultScrollPosition = confirmReaderControlSearchScrollRebase(
        this.resultScrollPosition, pending, this.resultNativeOffset());
    }
    this.scheduleResultNativeFollow();
  }

  private onResultTouch(event: TouchEvent): void {
    if (event.type === TouchType.Cancel) {
      this.resultPointers = [];
      this.resultUserScrolling = false;
    }
    else {
      event.changedTouches.forEach((touch: TouchObject): void => {
        if (event.type === TouchType.Down && !this.resultPointers.includes(touch.id)) this.resultPointers.push(touch.id);
        else if (event.type === TouchType.Up) this.resultPointers = this.resultPointers.filter((id: number): boolean => id !== touch.id);
      });
    }
    if (event.type === TouchType.Down) {
      this.cancelResultNativeFollow();
      // Supersede queued controller movement before the new drag owns input.
      if (this.resultScrollMounted) {
        this.resultScroller.scrollTo({ xOffset: 0, yOffset: this.resultNativeRawOffset(), animation: false });
      }
      this.resultScrollPosition = cancelReaderControlSearchScrollRebase(this.resultScrollPosition);
    } else this.tryResultScrollRebase();
  }

  private onResultScrollStop(): void {
    this.resultUserScrolling = false;
    this.syncResultNativeOffset('unknown');
    this.tryResultScrollRebase();
  }

  private tryResultScrollRebase(): void {
    if (!this.resultScrollMounted || this.state.kind !== 'results' ||
      Math.abs(this.resultViewportHeight - this.resultListFrame().viewportHeightVp) > 0.5) return;
    const next = prepareReaderControlSearchScrollRebase(this.resultScrollPosition, this.resultLayout(), {
      progress: this.motionProgress, inputEnabled: this.interactionEnabled,
      userScrolling: this.resultUserScrolling || this.resultPointers.length > 0,
    });
    this.resultScrollPosition = next.state;
    if (next.command === undefined) return;
    // Stable endpoints still normalize through the existing receipt policy.
    // The List uses a fixed ruler; only a real readback confirms the command.
    this.resultScroller.scrollTo({ xOffset: 0,
      yOffset: next.command.targetOffsetVp * this.resultListFrame().visualToNativeRatio, animation: false });
    this.resultScrollPosition = confirmReaderControlSearchScrollRebase(
      this.resultScrollPosition, next.command, this.resultNativeOffset());
  }

  private cancelResultNativeFollow(): void {
    this.resultNativeFollowLifecycle += 1;
    if (this.resultNativeFollowTimer >= 0) clearTimeout(this.resultNativeFollowTimer);
    this.resultNativeFollowTimer = -1;
  }

  private scheduleResultNativeFollow(): void {
    if (!this.resultScrollMounted || this.resultNativeFollowTimer >= 0) return;
    const lifecycle = this.resultNativeFollowLifecycle;
    // Coalesce property Watch deliveries outside native List reconciliation.
    // Read the latest p/query/layout at dispatch, never an obsolete sample.
    this.resultNativeFollowTimer = setTimeout((): void => {
      if (lifecycle !== this.resultNativeFollowLifecycle || !this.resultScrollMounted) return;
      this.resultNativeFollowTimer = -1;
      if (this.state.kind !== 'results' || this.resultPointers.length > 0 || this.resultUserScrolling ||
        this.resultListFrame().viewportHeightVp <= 0 || Math.abs(this.resultViewportHeight - this.resultListFrame().viewportHeightVp) > 0.5) return;
      const endpoint = this.interactionEnabled && (this.motionProgress === 0 || this.motionProgress === 1);
      if (endpoint) { this.tryResultScrollRebase(); return; }
      const target = this.resultListFrame().targetOffsetVp;
      if (Math.abs(this.resultNativeRawOffset() - target) <= 0.5) return;
      // Native virtualization must follow the visual row range during morphs.
      // B is observed, never assigned to target optimistically. Late receipts
      // remain layout/programmatic observations and cannot rewrite the anchor.
      this.resultScroller.scrollTo({ xOffset: 0, yOffset: target, animation: false });
      this.syncResultNativeOffset('programmatic');
    }, 0);
  }

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      // Query bottom follows the actual input row in both forms.
      Row().height(this.frame().queryDivider.height).width(this.frame().queryDivider.width)
        .backgroundColor(readerAppColor('TOK_LINE', this.appThemeScheme))
        .position({ x: this.frame().queryDivider.x, y: this.frame().queryDivider.y });
      this.searchField();
      this.searchAction();
      this.resultsBody();
      this.quickBack();
    }
    .width(this.availableWidth).height(this.availableHeight)
    .backgroundColor(readerAppColor('TOK_SURFACE_PANEL', this.appThemeScheme))
    .border({ width: TOK_BORDER_W, color: readerAppColor('TOK_LINE', this.appThemeScheme) }).borderRadius(12)
    .clip(true).enabled(this.interactionEnabled);
  }

  @Builder
  private searchField() {
    Row({ space: 5 }) {
      TextInput({ placeholder: '搜索正文内容', text: this.query, controller: this.inputController })
        .id(this.queryInputId).enableKeyboardOnFocus(true)
        // This is a 14vp text line inside the authored 24->32vp field. Clear
        // native vertical content insets explicitly; horizontal-only padding
        // leaves the platform's TextInput top/bottom defaults unspecified.
        .layoutWeight(1).height(14).padding({ left: 2, right: 2, top: 0, bottom: 0 }).borderRadius(0)
        .fontFamily('ReaderNotoSansSC').fontSize(10).fontWeight(FontWeight.Regular)
        .fontColor(readerAppColor('TOK_READ_INK', this.appThemeScheme)).backgroundColor(Color.Transparent)
        .caretColor(readerAppColor('TOK_READ_INK', this.appThemeScheme)).placeholderColor(readerAppColor('TOK_READ_MUTED', this.appThemeScheme))
        .placeholderFont({ size: 10, family: 'ReaderNotoSansSC' })
        .maxLines(1).enterKeyType(EnterKeyType.Search)
        .accessibilityText('搜索正文内容')
        .onChange((value: string): void => this.onQueryChange(value))
        .onEditChange((editing: boolean): void => this.onTemporaryLayerChange(editing))
        .onSubmit((_key: EnterKeyType): void => this.submit());
    }
    .width(this.frame().field.width).height(this.frame().field.height)
    .padding({ left: 9, right: 9 }).alignItems(VerticalAlign.Center)
    .backgroundColor(readerAppColor('TOK_SURFACE_PANEL_SOFT', this.appThemeScheme))
    .border({ width: TOK_BORDER_W, color: readerAppColor('TOK_LINE', this.appThemeScheme) }).borderRadius(8)
    .position({ x: this.frame().field.x, y: this.frame().field.y })
    .opacity(this.presentation().contentOpacity).blur(this.presentation().contentBlur)
    .onClick((): void => this.focusQueryField());
  }

  @Builder
  private searchAction() {
    Stack({ alignContent: Alignment.Center }) {
      Image((this.appThemeScheme === 'night' ? $r('app.media.reader_directory_search_theme_night') : $r('app.media.reader_directory_search'))).width(16).height(16)
        .opacity(this.canSearch() ? 1 : .4);
    }
    .width(this.frame().action.width).height(this.frame().action.height)
    .backgroundColor(readerAppColor('TOK_SURFACE_PANEL_SOFT', this.appThemeScheme))
    .border({ width: TOK_BORDER_W, color: readerAppColor('TOK_LINE', this.appThemeScheme) }).borderRadius(8)
    .position({ x: this.frame().action.x, y: this.frame().action.y })
    .opacity(this.presentation().contentOpacity).blur(this.presentation().contentBlur)
    .enabled(this.canSearch())
    .accessibilityText('搜索正文').onClick((): void => this.submit());
  }

  @Builder
  private quickBack() {
    Row({ space: 4 }) {
      Image((this.appThemeScheme === 'night' ? $r('app.media.reader_quick_back_theme_night') : $r('app.media.reader_quick_back'))).width(11).height(11);
      Text('返回').fontFamily('ReaderInter').fontWeight(FontWeight.Bold)
        .fontSize(10).fontColor(readerAppColor('TOK_READ_PRIMARY', this.appThemeScheme));
    }
    .width(this.frame().back.width).height(this.frame().back.height)
    .padding({ left: 8 }).alignItems(VerticalAlign.Center)
    .backgroundColor(readerAppColor('TOK_SURFACE_PANEL_SOFT', this.appThemeScheme)).borderRadius(8)
    .position({ x: this.frame().back.x, y: this.frame().back.y })
    .opacity(this.frame().back.opacity * this.presentation().contentOpacity).blur(this.presentation().contentBlur)
    // Keep the actor mounted while p changes; toggling Visibility at the
    // endpoint forces a subtree rebuild during the parent morph and can expose
    // a transient black frame. Opacity plus hit-testing preserves the same
    // visual and interaction contract without that lifecycle seam.
    .hitTestBehavior(this.frame().back.opacity > 0 ? HitTestMode.Default : HitTestMode.None)
    .enabled(this.interactionEnabled && this.frame().back.opacity > 0)
    .accessibilityText('返回初始控制栏').onClick((): void => this.onBack());
  }

  @Builder
  private resultsBody() {
    Stack({ alignContent: Alignment.TopStart }) {
      if (this.state.kind === 'results') {
        List({ space: 0, scroller: this.resultScroller }) {
          LazyForEach(this.resultDataSource, (result: ReadingContentSearchResult, index: number) => {
            ListItem() {
              this.resultRow(result.chapterIndex, result.chapterOffset, result.sourceId, result.bookId);
            }
            .width('100%').height(READER_SEARCH_LIST_ITEM_HEIGHT)
            .translate({ y: this.resultRowTranslation(this.currentResultIndex(result.chapterIndex, result.chapterOffset)) }).clip(false);
          }, (result: ReadingContentSearchResult): string => readerContentSearchResultKey(result));
        }
        .width(this.frame().firstResult.width).height(this.resultListFrame().viewportHeightVp)
        .position({ x: this.frame().firstResult.x, y: 0 })
        .childrenMainSize(this.resultItemSizes).cachedCount(READER_SEARCH_LIST_CACHE_COUNT, true)
        .contentEndOffset(this.resultListFrame().contentEndOffsetVp)
        .maintainVisibleContentPosition(true)
        // Rows retain authored geometry outside their normalized native item.
        // The parent Results viewport owns the only visual/input clipping box.
        .clip(false).scrollBar(BarState.Off).edgeEffect(EdgeEffect.None)
        .enableScrollInteraction(this.interactionEnabled && (this.motionProgress === 0 || this.motionProgress === 1))
        .onAppear((): void => this.onResultScrollAppear())
        .onDisAppear((): void => this.onResultScrollDisappear())
        .onAreaChange((_old: Area, area: Area): void => this.onResultScrollArea(area))
        .onTouch((event: TouchEvent): void => this.onResultTouch(event))
        .onWillScroll((offset: number, _state: ScrollState, source: ScrollSource): ScrollResult =>
          ({ offsetRemain: this.onResultWillScroll(offset, source).yOffset }))
        .onDidScroll((_offset: number, _state: ScrollState): void => this.onResultDidScroll())
        .onScrollStop((): void => this.onResultScrollStop());
        this.loadMoreAction();
      } else {
        Stack({ alignContent: Alignment.Center }) {
          Text(this.statusText()).width('100%').padding({ left: 12, right: 12 })
            .fontFamily('ReaderNotoSansSC').fontSize(11).fontColor(readerAppColor('TOK_READ_MUTED', this.appThemeScheme))
            .textAlign(TextAlign.Center).maxLines(3);
        }.width('100%').height('100%')
          .opacity(this.presentation().contentOpacity).blur(this.presentation().contentBlur);
      }
    }
    .width(this.frame().results.width).height(this.frame().results.height)
    .position({ x: this.frame().results.x, y: this.frame().results.y }).clip(true);
  }

  /**
   * Keep pagination affordance outside the result extent so adding a page does
   * not alter the authored row trajectory or the quick/full morph geometry.
   */
  @Builder
  private loadMoreAction() {
    if (this.state.kind === 'results' && this.state.hasMore === true) {
      Stack({ alignContent: Alignment.Center }) {
        Text(this.state.loadingMore === true ? '正在加载…' :
          (this.state.loadMoreError === undefined ? '加载更多结果' : '加载失败，重试'))
          .fontFamily('ReaderNotoSansSC').fontSize(9).fontColor(readerAppColor('TOK_READ_PRIMARY', this.appThemeScheme))
          .maxLines(1);
      }
      .width(112).height(26)
      .position({ x: Math.max(0, this.frame().results.width - 120),
        y: Math.max(0, this.frame().results.height - 30) })
      .backgroundColor(readerAppColor('TOK_SURFACE_PANEL_SOFT', this.appThemeScheme)).borderRadius(8)
      .opacity(this.presentation().contentOpacity).blur(this.presentation().contentBlur)
      .enabled(this.interactionEnabled && (this.motionProgress === 0 || this.motionProgress === 1) &&
        this.state.loadingMore !== true)
      .accessibilityText(this.state.loadingMore === true ? '正在加载更多搜索结果' :
        (this.state.loadMoreError === undefined ? '加载更多搜索结果' : '重试加载更多搜索结果'))
      .onClick((): void => {
        if (this.state.kind === 'results' && this.state.loadingMore !== true && this.interactionEnabled &&
          (this.motionProgress === 0 || this.motionProgress === 1)) this.onLoadMore();
      });
    }
  }

  @Builder
  private resultRow(chapterIndex: number, chapterOffset: number, sourceId: string = '', bookId: string = '') {
    Stack({ alignContent: Alignment.TopStart }) {
      Text(this.resultTitle(this.currentResult(chapterIndex, chapterOffset)))
        .width(Math.max(0, this.frame().firstResult.width - 18)).height(13)
        .fontFamily('ReaderNotoSansSC').fontSize(11).lineHeight(13.2)
        .fontWeight(FontWeight.Medium).fontColor(readerAppColor('TOK_READ_INK', this.appThemeScheme))
        .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis })
        .position({ x: 9, y: 9.09375 });
      this.resultSnippet(chapterIndex, chapterOffset);
    }
    .width(this.frame().firstResult.width).height(this.frame().rowHeight)
    .opacity(this.presentation().contentOpacity).blur(this.presentation().contentBlur)
    .clipShape(this.resultClip(chapterIndex, chapterOffset))
    .borderRadius(6).clip(false)
    .accessibilityText(`${this.resultTitle(this.currentResult(chapterIndex, chapterOffset))}，搜索结果`)
    .onClick((): void => this.selectCurrentResult(chapterIndex, chapterOffset, sourceId, bookId));
  }

  @Builder
  private resultSnippet(chapterIndex: number, chapterOffset: number) {
    Text() {
      Span(this.currentSnippet(chapterIndex, chapterOffset).prefix)
        .fontColor(readerAppColor('TOK_READ_MUTED', this.appThemeScheme)).fontWeight(FontWeight.Regular);
      Span(this.currentSnippet(chapterIndex, chapterOffset).match)
        .fontColor(readerAppColor('TOK_DANGER', this.appThemeScheme)).fontWeight(FontWeight.Bold);
      Span(this.currentSnippet(chapterIndex, chapterOffset).suffix)
        .fontColor(readerAppColor('TOK_READ_MUTED', this.appThemeScheme)).fontWeight(FontWeight.Regular);
    }
    .width(Math.max(0, this.frame().firstResult.width - 18)).height(28)
    .padding({ left: 11 }).border({ width: { left: TOK_BORDER_W }, color: readerAppColor('TOK_LINE_STRONG', this.appThemeScheme) })
    .fontFamily('ReaderNotoSansSC').fontSize(9).lineHeight(13.95)
    .maxLines(2).textOverflow({ overflow: TextOverflow.Ellipsis })
    .position({ x: 9, y: 31.09375 });
  }

  private canSearch(): boolean {
    return this.interactionEnabled && this.query.trim().length > 0 && this.state.kind !== 'loading';
  }

  private submit(): void {
    if (this.canSearch()) this.onSearch();
  }

  // LazyForEach identity is stable, but a later result set may replace its payload.
  // Builder update closures resolve current owner data, never the first object.
  private currentResultIndex(chapterIndex: number, chapterOffset: number): number {
    if (this.state.kind !== 'results') {
      this.indexedResultRows = undefined;
      this.resultRowIndexes.clear();
      return -1;
    }
    const rows = this.state.results;
    if (this.indexedResultRows !== rows) {
      // A result publication may replace the array. Index it once instead of scanning
      // all rows for every title, snippet span, clip and accessibility label.
      // Keys only locate the current payload; they never capture an old row.
      const indexes = new Map<string, number>();
      rows.forEach((result: ReadingContentSearchResult, index: number): void => {
        const key = `${result.chapterIndex}:${result.chapterOffset}`;
        if (!indexes.has(key)) indexes.set(key, index);
      });
      this.resultRowIndexes = indexes;
      this.indexedResultRows = rows;
    }
    return this.resultRowIndexes.get(`${chapterIndex}:${chapterOffset}`) ?? -1;
  }

  private currentResult(chapterIndex: number, chapterOffset: number): ReadingContentSearchResult | undefined {
    const index = this.currentResultIndex(chapterIndex, chapterOffset);
    return this.state.kind === 'results' && index >= 0 ? this.state.results[index] : undefined;
  }

  private currentSnippet(chapterIndex: number, chapterOffset: number): ReaderSearchSnippetParts {
    const result = this.currentResult(chapterIndex, chapterOffset);
    if (result === undefined) return { prefix: '', match: '', suffix: '' };
    return splitReaderSearchSnippet(result.snippet, result.snippetStart, result.chapterOffset, result.matchLength);
  }

  private selectCurrentResult(chapterIndex: number, chapterOffset: number, sourceId: string = '', bookId: string = ''): void {
    const result = this.currentResult(chapterIndex, chapterOffset);
    if (this.interactionEnabled && (this.motionProgress === 0 || this.motionProgress === 1) &&
      result !== undefined && (sourceId.length === 0 || result.sourceId === sourceId) &&
      (bookId.length === 0 || result.bookId === bookId)) this.onSelectResult(result);
  }

  private resultTitle(result: ReadingContentSearchResult | undefined): string {
    if (result === undefined) return '';
    return result.chapterTitle.trim().length > 0 ? result.chapterTitle : `第 ${result.chapterIndex + 1} 章`;
  }

  private statusText(): string {
    if (this.state.kind === 'loading') return '正在搜索…';
    if (this.state.kind === 'empty') return `未找到“${this.state.keyword}”`;
    if (this.state.kind === 'error') return this.state.message;
    return '输入关键词搜索正文内容';
  }

}
