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
import { splitReaderSearchSnippet, type ReaderSearchSnippetParts } from './ReaderSearchHighlight';
import { sampleReaderControlSearch, type ReaderControlSearchFrame } from './ReaderControlSearchGeometry';
import { createReaderControlSearchScroll, resetReaderControlSearchScroll, sampleReaderControlSearchScroll,
  observeReaderControlSearchScroll, prepareReaderControlSearchScrollRebase,
  confirmReaderControlSearchScrollRebase, cancelReaderControlSearchScrollRebase,
  type ReaderControlSearchScrollState, type ReaderControlSearchScrollLayout,
  type ReaderControlSearchScrollProjection, type ReaderControlSearchScrollSource } from './ReaderControlSearchScroll';

/** Search 1938:4927 content only. One input and one result scroll tree survive
 * Quick/Full; Stage owns the shell, header, p, whole visibility and timing.
 * The input primitive's real IME/caret semantics are retained here because the
 * fixed-height ReaderSearchField variants cannot represent 24->32 geometry. */
@Component
export struct ReaderControlSearchContent {
  @Prop @Watch('onResultLayoutChanged') motionProgress: number = 0;
  @Prop @Watch('onResultLayoutChanged') availableWidth: number = 286;
  @Prop @Watch('onResultLayoutChanged') availableHeight: number = 190;
  @Prop fullContentHeight: number = 666;
  @Prop quickContentHeight: number = 190;
  @Prop @Watch('onInputChanged') interactionEnabled: boolean = true;
  @Prop @Watch('dismissTemporaryLayer') dismissTemporaryRevision: number = 0;
  @Prop query: string = '';
  @Prop @Watch('onResultDataChanged') state: ReaderQuickSearchState = { kind: 'idle' };
  onTemporaryLayerChange: (active: boolean) => void = (_active: boolean): void => {};
  onBack: () => void = (): void => {};
  onQueryChange: (query: string) => void = (_query: string): void => {};
  onSearch: () => void = (): void => {};
  onLoadMore: () => void = (): void => {};
  onSelectResult: (result: ReadingContentSearchResult) => void =
    (_result: ReadingContentSearchResult): void => {};
  private inputController: TextInputController = new TextInputController();
  private resultScroller: Scroller = new Scroller();
  @State private resultScrollPosition: ReaderControlSearchScrollState = createReaderControlSearchScroll();
  private resultScrollMounted: boolean = false;
  private resultViewportHeight: number = 0;
  private resultPointers: number[] = [];
  private resultUserScrolling: boolean = false;
  private resultScrollSource: ReaderControlSearchScrollSource = 'unknown';
  private resultDataIdentity: string = '';
  private resultMotionPath: ReaderControlMorphScrollPath | undefined = undefined;
  private resultRestingProgress: number = 0;
  private resultRestingLayout: ReaderControlSearchScrollLayout | undefined = undefined;

  aboutToAppear(): void {
    registerReaderFonts(this.getUIContext().getFont());
    this.onResultDataChanged();
  }

  aboutToDisappear(): void {
    this.dismissTemporaryLayer();
    this.onResultScrollDisappear();
  }

  private dismissTemporaryLayer(): void {
    this.inputController.stopEditing();
    this.onTemporaryLayerChange(false);
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

  private resultRowsHeight(): number {
    return this.state.kind === 'results' ? this.state.results.length * this.frame().rowHeight : 0;
  }
  private presentation(): ReaderControlMotionPresentation {
    return sampleReaderControlMotionPresentation(this.motionProgress);
  }
  private resultClip(chapterIndex: number, chapterOffset: number): PathShape {
    const index = this.state.kind === 'results' ? this.state.results.findIndex((r: ReadingContentSearchResult): boolean =>
      r.chapterIndex === chapterIndex && r.chapterOffset === chapterOffset) : -1;
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

  private resultNativeOffset(): number {
    if (!this.resultScrollMounted) return 0;
    const offset = this.resultScroller.currentOffset().yOffset;
    return Number.isFinite(offset) ? Math.max(0, offset) : this.resultScrollPosition.nativeOffsetVp;
  }

  private onResultDataChanged(): void {
    // Owner/Prop copies at every morph frame are not a new search. A changed
    // result identity (or loading/empty phase) invalidates only this scroll run.
    const identity = this.state.kind === 'results' ? JSON.stringify({ keyword: this.state.keyword,
      keys: this.state.results.map((result: ReadingContentSearchResult): string =>
        JSON.stringify([result.sourceId, result.bookId, String(result.chapterIndex), String(result.chapterOffset)])) }) : this.state.kind;
    if (identity === this.resultDataIdentity) return;
    this.resultDataIdentity = identity;
    this.resultMotionPath = undefined;
    this.resultRestingProgress = this.motionProgress === 1 ? 1 : 0;
    this.resultRestingLayout = this.resultLayout();
    this.resultScrollPosition = resetReaderControlSearchScroll(this.resultScrollPosition, this.resultNativeOffset());
    this.resultScrollSource = 'unknown';
    this.tryResultScrollRebase();
  }

  private onResultLayoutChanged(): void {
    const settled = this.interactionEnabled && (this.motionProgress === 0 || this.motionProgress === 1);
    if (this.resultMotionPath === undefined &&
      (!settled || this.motionProgress !== this.resultRestingProgress)) {
      if (this.resultScrollMounted && this.resultRestingLayout !== undefined) {
        // Handoff samples the native last frame before canceling inertia.
        this.resultScrollPosition = observeReaderControlSearchScroll(this.resultScrollPosition,
          this.resultRestingLayout, { nativeOffsetVp: this.resultNativeOffset(),
            source: this.resultScrollPosition.pendingRebase === undefined ? 'fling' : 'layout',
            progress: this.resultRestingProgress, inputEnabled: true });
        this.resultScroller.scrollTo({ xOffset: 0, yOffset: this.resultNativeOffset(), animation: false });
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
    this.tryResultScrollRebase();
  }

  private syncResultNativeOffset(source: ReaderControlSearchScrollSource): void {
    this.resultScrollPosition = observeReaderControlSearchScroll(this.resultScrollPosition, this.resultLayout(), {
      nativeOffsetVp: this.resultNativeOffset(), source: source,
      progress: this.motionProgress, inputEnabled: this.interactionEnabled,
    });
  }

  private onResultScrollAppear(): void {
    this.resultScrollMounted = true;
    this.syncResultNativeOffset('layout');
    this.tryResultScrollRebase();
  }

  private onResultScrollDisappear(): void {
    this.resultScrollMounted = false;
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
    this.tryResultScrollRebase();
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
    return { xOffset: 0, yOffset: y };
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
      Math.abs(this.resultViewportHeight - this.frame().results.height) > 0.5) return;
    const next = prepareReaderControlSearchScrollRebase(this.resultScrollPosition, this.resultLayout(), {
      progress: this.motionProgress, inputEnabled: this.interactionEnabled,
      userScrolling: this.resultUserScrolling || this.resultPointers.length > 0,
    });
    this.resultScrollPosition = next.state;
    if (next.command === undefined) return;
    // One non-animated endpoint normalization makes both native edges reachable.
    // Never run per frame or under a held pointer. Until real offset confirms,
    // retain B-O compensation; programmatic events cannot rewrite the row anchor.
    this.resultScroller.scrollTo({ xOffset: 0, yOffset: next.command.targetOffsetVp, animation: false });
    this.resultScrollPosition = confirmReaderControlSearchScrollRebase(
      this.resultScrollPosition, next.command, this.resultNativeOffset());
  }

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      // Static Query border under the same source parent, not an invented
      // animated separator or a mask hiding the recovered trajectories.
      Row().height(this.frame().queryDivider.height).width(this.frame().queryDivider.width)
        .backgroundColor(TOK_LINE)
        .position({ x: this.frame().queryDivider.x, y: this.frame().queryDivider.y });
      this.searchField();
      this.searchAction();
      this.resultsBody();
      this.quickBack();
    }
    .width(this.availableWidth).height(this.availableHeight)
    .backgroundColor(TOK_SURFACE_PANEL)
    .border({ width: TOK_BORDER_W, color: TOK_LINE }).borderRadius(12)
    .clip(true).enabled(this.interactionEnabled);
  }

  @Builder
  private searchField() {
    Row({ space: 5 }) {
      Image($r('app.media.reader_directory_input_search')).width(16).height(16).margin({ right: 2 });
      TextInput({ placeholder: '搜索正文内容', text: this.query, controller: this.inputController })
        // This is a 14vp text line inside the authored 24->32vp field. Clear
        // native vertical content insets explicitly; horizontal-only padding
        // leaves the platform's TextInput top/bottom defaults unspecified.
        .layoutWeight(1).height(14).padding({ left: 2, right: 2, top: 0, bottom: 0 })
        .fontFamily('ReaderNotoSansSC').fontSize(10).fontWeight(FontWeight.Regular)
        .fontColor(TOK_READ_INK).backgroundColor(Color.Transparent)
        .caretColor(TOK_READ_INK).placeholderColor(TOK_READ_MUTED)
        .placeholderFont({ size: 10, family: 'ReaderNotoSansSC' })
        .maxLines(1).enterKeyType(EnterKeyType.Search)
        .accessibilityText('搜索正文内容')
        .onChange((value: string): void => this.onQueryChange(value))
        .onEditChange((editing: boolean): void => this.onTemporaryLayerChange(editing))
        .onSubmit((_key: EnterKeyType): void => this.submit());
    }
    .width(this.frame().field.width).height(this.frame().field.height)
    .padding({ left: 9, right: 9 }).alignItems(VerticalAlign.Center)
    .backgroundColor(TOK_SURFACE_PANEL_SOFT).borderRadius(8)
    .position({ x: this.frame().field.x, y: this.frame().field.y })
    .opacity(this.presentation().contentOpacity).blur(this.presentation().contentBlur);
  }

  @Builder
  private searchAction() {
    Stack({ alignContent: Alignment.Center }) {
      Image($r('app.media.reader_directory_input_search')).width(16).height(16);
    }
    .width(this.frame().action.width).height(this.frame().action.height)
    .backgroundColor(TOK_SURFACE_PANEL_SOFT).borderRadius(8)
    .position({ x: this.frame().action.x, y: this.frame().action.y })
    .opacity((this.canSearch() ? 1 : .4) * this.presentation().contentOpacity).blur(this.presentation().contentBlur)
    .enabled(this.canSearch())
    .accessibilityText('搜索正文').onClick((): void => this.submit());
  }

  @Builder
  private quickBack() {
    Row({ space: 4 }) {
      Image($r('app.media.reader_quick_back')).width(11).height(11);
      Text('返回').fontFamily('ReaderInter').fontWeight(FontWeight.Bold)
        .fontSize(10).fontColor(TOK_READ_PRIMARY);
    }
    .width(this.frame().back.width).height(this.frame().back.height)
    .padding({ left: 8 }).alignItems(VerticalAlign.Center)
    .backgroundColor(TOK_SURFACE_PANEL_SOFT).borderRadius(8)
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
        Scroll(this.resultScroller) {
          // Native extent and the row layout are different boxes: the authored
          // negative first-row Y must not squeeze the rows or move their clip.
          Stack({ alignContent: Alignment.TopStart }) {
            Column() {
              ForEach(this.state.results, (result: ReadingContentSearchResult) => {
                this.resultRow(result.chapterIndex, result.chapterOffset);
              }, (result: ReadingContentSearchResult): string =>
                `reader-control-search-${result.chapterIndex}-${result.chapterOffset}`);
            }.width(this.frame().firstResult.width).height(this.resultRowsHeight())
              .position({ x: this.frame().firstResult.x, y: this.frame().firstResult.y })
              .translate({ y: this.resultScrollFrame().translateYVp }).alignItems(HorizontalAlign.Start);
          }.width('100%').height(this.resultScrollFrame().minContentHeightVp);
        }
        .width('100%').height('100%').scrollBar(BarState.Off).edgeEffect(EdgeEffect.None)
        .enableScrollInteraction(this.interactionEnabled && (this.motionProgress === 0 || this.motionProgress === 1))
        .onAppear((): void => this.onResultScrollAppear())
        .onDisAppear((): void => this.onResultScrollDisappear())
        .onAreaChange((_old: Area, area: Area): void => this.onResultScrollArea(area))
        .onTouch((event: TouchEvent): void => this.onResultTouch(event))
        .onWillScroll((_x: number, y: number, _state: ScrollState, source: ScrollSource): OffsetResult => this.onResultWillScroll(y, source))
        .onDidScroll((_x: number, _y: number, _state: ScrollState): void => this.onResultDidScroll())
        .onScrollStop((): void => this.onResultScrollStop());
        this.loadMoreAction();
      } else {
        Stack({ alignContent: Alignment.Center }) {
          Text(this.statusText()).width('100%').padding({ left: 12, right: 12 })
            .fontFamily('ReaderNotoSansSC').fontSize(11).fontColor(TOK_READ_MUTED)
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
          .fontFamily('ReaderNotoSansSC').fontSize(9).fontColor(TOK_READ_PRIMARY)
          .maxLines(1);
      }
      .width(112).height(26)
      .position({ x: Math.max(0, this.frame().results.width - 120),
        y: Math.max(0, this.frame().results.height - 30) })
      .backgroundColor(TOK_SURFACE_PANEL_SOFT).borderRadius(8)
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
  private resultRow(chapterIndex: number, chapterOffset: number) {
    Stack({ alignContent: Alignment.TopStart }) {
      Text(this.resultTitle(this.currentResult(chapterIndex, chapterOffset)))
        .width(Math.max(0, this.frame().firstResult.width - 18)).height(13)
        .fontFamily('ReaderNotoSansSC').fontSize(11).lineHeight(13.2)
        .fontWeight(FontWeight.Medium).fontColor(TOK_READ_INK)
        .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis })
        .position({ x: 9, y: 9.09375 });
      this.resultSnippet(chapterIndex, chapterOffset);
    }
    .width(this.frame().firstResult.width).height(this.frame().rowHeight)
    .opacity(this.presentation().contentOpacity).blur(this.presentation().contentBlur)
    .clipShape(this.resultClip(chapterIndex, chapterOffset))
    .borderRadius(6).clip(false)
    .accessibilityText(`${this.resultTitle(this.currentResult(chapterIndex, chapterOffset))}，搜索结果`)
    .onClick((): void => this.selectCurrentResult(chapterIndex, chapterOffset));
  }

  @Builder
  private resultSnippet(chapterIndex: number, chapterOffset: number) {
    Text() {
      Span(this.currentSnippet(chapterIndex, chapterOffset).prefix)
        .fontColor(TOK_READ_MUTED).fontWeight(FontWeight.Regular);
      Span(this.currentSnippet(chapterIndex, chapterOffset).match)
        .fontColor(TOK_DANGER).fontWeight(FontWeight.Bold);
      Span(this.currentSnippet(chapterIndex, chapterOffset).suffix)
        .fontColor(TOK_READ_MUTED).fontWeight(FontWeight.Regular);
    }
    .width(Math.max(0, this.frame().firstResult.width - 18)).height(28)
    .padding({ left: 11 }).border({ width: { left: TOK_BORDER_W }, color: TOK_LINE_STRONG })
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

  // ForEach identity is stable, but a later result set may replace its payload.
  // Builder update closures resolve current owner data, never the first object.
  private currentResult(chapterIndex: number, chapterOffset: number): ReadingContentSearchResult | undefined {
    if (this.state.kind !== 'results') return undefined;
    return this.state.results.find((result: ReadingContentSearchResult): boolean =>
      result.chapterIndex === chapterIndex && result.chapterOffset === chapterOffset);
  }

  private currentSnippet(chapterIndex: number, chapterOffset: number): ReaderSearchSnippetParts {
    const result = this.currentResult(chapterIndex, chapterOffset);
    if (result === undefined) return { prefix: '', match: '', suffix: '' };
    return splitReaderSearchSnippet(result.snippet, result.snippetStart, result.chapterOffset, result.matchLength);
  }

  private selectCurrentResult(chapterIndex: number, chapterOffset: number): void {
    const result = this.currentResult(chapterIndex, chapterOffset);
    if (this.interactionEnabled && result !== undefined) this.onSelectResult(result);
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
