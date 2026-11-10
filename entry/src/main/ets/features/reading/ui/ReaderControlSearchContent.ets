import { ReaderFormField } from '../../../ui/controls/ReaderFormField';
import hilog from '@ohos.hilog';
import { DEBUG } from '../../../../../../build/default/generated/profile/default/BuildProfile';
import { ReaderPanelFrame } from '../../../ui/surfaces/ReaderPanelFrame';
import { ReaderControlQuickBack } from './ReaderControlQuickBack';
import { ReaderRecoveryAction } from '../../../ui/feedback/ReaderRecoveryAction';
import { ReaderPageState } from '../../../ui/feedback/ReaderPageState';
import { MESSAGE_BODY, MESSAGE_ACTION } from '../../../ui/foundation/ReaderMessageStyle';
import { TYPE_READER_SNIPPET_INLINE_MATCH, TYPE_READER_SNIPPET_INLINE_REGULAR } from '../../../ui/foundation/ReaderTypography';
import { TYPE_READER_SEARCH_RETAINED_RESULT_ROW_TITLE, TYPE_READER_SEARCH_RETAINED_RESULT_SNIPPET_SNIPPET, TYPE_READER_SEARCH_RETAINED_SEARCH_FIELD_INPUT } from '../../../ui/foundation/ReaderTypography';
import { readerAppColor } from '../../../ui/foundation/ReaderThemeRegistry';
import { PathShape } from '@ohos.arkui.shape';
import { sampleReaderControlMotionPresentation, readerControlMotionClipRects, readerControlMotionClipPath,
  readerControlMotionVisibleRect, type ReaderControlMotionPresentation, type ReaderControlMotionClipRect } from './ReaderControlMotionPresentation';
import { readerControlMorphScrollPath, sampleReaderControlMorphScrollPath,
  type ReaderControlMorphScrollPath } from './ReaderControlMorphScroll';
import { registerReaderFonts } from '../../../ui/foundation/ReaderFonts';
import { TOK_BORDER_W, TOK_DANGER, TOK_LINE, TOK_LINE_STRONG, TOK_READ_INK,
  TOK_READ_MUTED, TOK_READ_PRIMARY, TOK_SURFACE_PANEL_SOFT } from '../../../ui/foundation/ReaderTokens';
import type { ReadingContentSearchResult } from '../application/ReadingSessionFlowGateway';
import { ReaderContentSearchPublication, type ReaderQuickSearchState } from '../presentation/ReaderContentSearchPublication';
import { ReaderContentSearchDataSource, readerContentSearchResultKey } from './ReaderContentSearchDataSource';
import { READER_SEARCH_LIST_ITEM_HEIGHT, READER_SEARCH_LIST_CACHE_COUNT, readerControlSearchListProjection,
  readerControlSearchListRowTranslation, readerControlSearchListScrollDelta,
  type ReaderControlSearchListProjection } from './ReaderControlSearchListProjection';
import { splitReaderSearchSnippet, type ReaderSearchSnippetParts } from '../presentation/ReaderSearchHighlight';
import { sampleReaderControlSearch, type ReaderControlSearchFrame,
  type ReaderControlSearchNaturalSize } from './ReaderControlSearchGeometry';
import type { ReaderControlModuleMeasurer, ReaderControlModuleMinimum, ReaderControlCandidateWidths } from './ReaderLayoutGeometry';
import { measureReaderSearchMinimum, type ReaderSearchMinimumFacts, type ReaderSearchMinimumProfile } from './ReaderControlSearchMinimum';
import { createReaderControlSearchScroll, resetReaderControlSearchScroll, sampleReaderControlSearchScroll,
  observeReaderControlSearchScroll, prepareReaderControlSearchScrollRebase,
  confirmReaderControlSearchScrollRebase, cancelReaderControlSearchScrollRebase,
  type ReaderControlSearchScrollState, type ReaderControlSearchScrollLayout,
  type ReaderControlSearchScrollProjection, type ReaderControlSearchScrollSource } from './ReaderControlSearchScroll';

let readerContentSearchInputSequence: number = 0;

class ReaderSearchMeasuredMessageFrame implements AttributeModifier<TextAttribute> {
  private measured: boolean;
  constructor(measured: boolean) { this.measured = measured; }
  applyNormalAttribute(instance: TextAttribute): void {
    if (this.measured) instance.layoutWeight(1).constraintSize({ minWidth: 0 });
  }
}

/** Search 1938:4927 content only. One input and one result scroll tree survive
 * Quick/Full; Stage owns the shell, header, p, whole visibility and timing.
 * ReaderFormField owns the exact native IME/caret recipe; this persistent
 * actor retains the authored24->32 outer geometry and one input controller. */
@Component
export struct ReaderControlSearchContent {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  @StorageLink('readerWindowMetricsRevision') @Watch('publishMinimumMeasurer') private minimumMetricsRevision: number = 0;
  @Prop @Watch('publishMinimumMeasurer') minimumIdentity: string = '';
  @Prop @Watch('onResultLayoutChanged') minimumKey: string = '';
  onMinimumMeasurerReady: (identity: string, measurer: ReaderControlModuleMeasurer | undefined) => void =
    (_identity: string, _measurer: ReaderControlModuleMeasurer | undefined): void => {};

  @Prop @Watch('onResultLayoutChanged') motionProgress: number = 0;
  @Prop @Watch('onResultLayoutChanged') availableWidth: number = 286;
  @Prop @Watch('onResultLayoutChanged') availableHeight: number = 190;
  @Prop fullContentHeight: number = 666;
  @Prop quickContentHeight: number = 190;
  @Prop @Watch('onInputChanged') interactionEnabled: boolean = true;
  @Prop @Watch('dismissTemporaryLayer') dismissTemporaryRevision: number = 0;
  @Prop @Watch('publishMinimumMeasurer') query: string = '';
  searchPublication: ReaderContentSearchPublication = new ReaderContentSearchPublication();
  @Prop @Watch('acceptSearchPublication') searchRevision: number = 0;
  @State @Watch('onResultDataChanged') private state: ReaderQuickSearchState = { kind: 'idle' };
  @State private retainedLoadMoreFailure: boolean = false;
  private acceptedSearchState: ReaderQuickSearchState | undefined = undefined;
  private acceptedResultScrollScope: number = 0;
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
  private queryEditing: boolean = false;
  private diagnosticEditingEvents: number = 0;
  private resultScroller: Scroller = new Scroller();
  private readonly resultDataSource: ReaderContentSearchDataSource = new ReaderContentSearchDataSource();
  @State private resultItemSizes: ChildrenMainSize = new ChildrenMainSize(READER_SEARCH_LIST_ITEM_HEIGHT);
  private resultNativeFollowTimer: number = -1;
  private resultNativeFollowLifecycle: number = 0;
  private resultNativeRawBase: number = 0;
  private resultScrollVisit: number = 0;
  private resultInitialNativeIndex: number = 0;
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
  private minimumProfiles: Map<string, ReaderSearchMinimumProfile> = new Map<string, ReaderSearchMinimumProfile>();
  private minimumProfileTicket: string = '';
  private minimumMeasurer: ReaderControlModuleMeasurer | undefined = undefined;
  private registeredMinimumIdentity: string = '';
  private minimumFactsSignature: string = '';

  aboutToAppear(): void {
    this.queryInputMounted = true;
    registerReaderFonts(this.getUIContext().getFont());
    this.resultScrollVisit = this.searchPublication.attachResultScroll();
    this.acceptSearchPublication();
    this.onResultDataChanged();
  }

  aboutToDisappear(): void {
    const identity = this.registeredMinimumIdentity;
    this.minimumMeasurer = undefined;
    if (identity.length > 0) this.onMinimumMeasurerReady(identity, undefined);
    // Preserve the last settled form, never an interpolated frame on the
    // way out. A superseded query/reader rejects this snapshot at the owner.
    const anchorRows = this.resultMotionPath === undefined ? this.resultScrollPosition.anchorRows :
      sampleReaderControlMorphScrollPath(this.resultMotionPath, this.resultRestingProgress);
    this.rememberResultScroll(anchorRows);
    this.searchPublication.detachResultScroll(this.resultScrollVisit);
    this.resultScrollVisit = 0;
    this.queryInputMounted = false;
    this.dismissTemporaryLayer();
    this.onResultScrollDisappear();
  }

  private acceptSearchPublication(): void {
    const next = this.searchPublication.stateAt(this.searchRevision);
    // Compare the raw owner snapshot, not ArkUI's top-level @State proxy.
    if (this.acceptedSearchState === next) return;
    this.acceptedSearchState = next;
    this.acceptedResultScrollScope = this.searchPublication.resultScrollScopeFor(next);
    if (next.kind !== 'results') this.retainedLoadMoreFailure = false;
    else if (next.loadMoreError !== undefined || next.paginationRetired === true) this.retainedLoadMoreFailure = true;
    else if (next.loadingMore !== true) this.retainedLoadMoreFailure = false;
    this.state = next;
  }

  private dismissTemporaryLayer(): void {
    if (!this.queryEditing) return;
    this.queryEditing = false;
    this.stopQueryEditing();
    this.onTemporaryLayerChange(false);
  }

  private stopQueryEditing(): void {
    try {
      this.inputController.stopEditing();
    } catch (_) {
      // A detached native field no longer owns keyboard input.
    }
  }

  private onQueryEditingChanged(editing: boolean): void {
    if (DEBUG && this.diagnosticEditingEvents < 32) {
      this.diagnosticEditingEvents += 1;
      hilog.info(0xD004, 'ReaderControlDiagnostic',
        'stage=search-edit editing=%{public}s stored=%{public}s mounted=%{public}s input=%{public}s',
        String(editing), String(this.queryEditing), String(this.queryInputMounted), String(this.interactionEnabled));
    }
    if (!this.queryInputMounted) return;
    if (editing && !this.interactionEnabled) {
      this.stopQueryEditing();
      return;
    }
    if (editing === this.queryEditing) return;
    this.queryEditing = editing;
    this.onTemporaryLayerChange(editing);
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
    return sampleReaderControlSearch(this.motionProgress, this.availableWidth, this.availableHeight, this.naturalSize(this.motionProgress));
  }

  private publishMinimumMeasurer(): void {
    if (!this.queryInputMounted || this.minimumIdentity.length === 0) return;
    const identity = this.minimumIdentity;
    const state = this.state, first = state.kind === 'results' ? state.results[0] : undefined;
    const pagination = state.kind === 'results' && (state.hasMore === true || state.loadMoreError !== undefined || state.paginationRetired === true);
    const retainedFailure = pagination && this.retainedLoadMoreFailure;
    const facts: ReaderSearchMinimumFacts = { query: this.query, title: this.resultTitle(first), snippet: first?.snippet ?? '',
      message: this.statusText(), hasResults: first !== undefined, resultsMode: state.kind === 'results', loading: state.kind === 'loading',
      loadMoreLabel: !pagination ? '' : retainedFailure ? state.kind === 'results' && state.hasMore === true ? '重试' : '重新搜索' :
        state.kind === 'results' && state.loadingMore === true ? '正在加载…' :
          state.kind === 'results' && state.loadMoreError !== undefined ? '加载失败，重试' : '加载更多结果',
      loadMoreMessage: retainedFailure ? state.kind === 'results' && state.paginationRetired === true ? '需重新搜索才能加载更多' : '后续结果加载失败' : '' };
    const signature = JSON.stringify([identity, this.minimumMetricsRevision, facts]);
    if (this.minimumMeasurer !== undefined && this.registeredMinimumIdentity === identity &&
      this.minimumFactsSignature === signature) return;
    const context = this.getUIContext();
    const cache = new Map<string, ReaderSearchMinimumProfile>();
    let measurer: ReaderControlModuleMeasurer;
    measurer = (widths: ReaderControlCandidateWidths, key: string): ReaderControlModuleMinimum | undefined => {
      if (!this.queryInputMounted || identity !== this.minimumIdentity || this.minimumMeasurer !== measurer) return undefined;
      let profile = cache.get(key);
      if (profile === undefined) {
        profile = measureReaderSearchMinimum(context, widths, facts);
        if (profile === undefined) return undefined;
        cache.set(key, profile);
      }
      const ticket = key.slice(0, key.lastIndexOf('|'));
      if (ticket !== this.minimumProfileTicket) {
        const selected = this.minimumProfiles.get(this.minimumKey);
        this.minimumProfiles.clear();
        if (selected !== undefined) this.minimumProfiles.set(this.minimumKey, selected);
        this.minimumProfileTicket = ticket;
      }
      this.minimumProfiles.set(key, profile);
      return { module: 'search', quick: profile.quick.minimum, full: profile.full.minimum };
    };
    this.registeredMinimumIdentity = identity;
    this.minimumFactsSignature = signature;
    this.minimumMeasurer = measurer;
    this.onMinimumMeasurerReady(identity, measurer);
  }

  private naturalSize(progress: number): ReaderControlSearchNaturalSize | undefined {
    const profile = this.minimumProfiles.get(this.minimumKey);
    if (profile === undefined) return undefined;
    const q = profile.quick.natural, f = profile.full.natural;
    return { fieldHeightVp: q.fieldHeightVp + (f.fieldHeightVp - q.fieldHeightVp) * progress,
      inputHeightVp: q.inputHeightVp + (f.inputHeightVp - q.inputHeightVp) * progress,
      titleHeightVp: q.titleHeightVp + (f.titleHeightVp - q.titleHeightVp) * progress,
      snippetHeightVp: q.snippetHeightVp + (f.snippetHeightVp - q.snippetHeightVp) * progress,
      rowHeightVp: q.rowHeightVp + (f.rowHeightVp - q.rowHeightVp) * progress,
      loadMoreHeightVp: q.loadMoreHeightVp + (f.loadMoreHeightVp - q.loadMoreHeightVp) * progress,
      loadMoreWidthVp: q.loadMoreWidthVp + (f.loadMoreWidthVp - q.loadMoreWidthVp) * progress,
      statusHeightVp: q.statusHeightVp + (f.statusHeightVp - q.statusHeightVp) * progress,
      backHeightVp: q.backHeightVp + (f.backHeightVp - q.backHeightVp) * progress,
      backWidthVp: q.backWidthVp + (f.backWidthVp - q.backWidthVp) * progress };
  }

  private resultLayout(): ReaderControlSearchScrollLayout {
    return { rowHeightVp: this.frame().rowHeight, viewportHeightVp: Math.max(0, this.frame().results.height - this.frame().loadMoreHeightVp -
      (this.frame().loadMoreHeightVp > 0 ? 4 : 0)),
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
    const f = sampleReaderControlSearch(1, this.availableWidth, this.fullContentHeight, this.naturalSize(1));
    const q = sampleReaderControlSearch(0, this.availableWidth, this.quickContentHeight, this.naturalSize(0));
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
    this.publishMinimumMeasurer();
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
    const layout = this.resultLayout();
    this.resultRestingLayout = layout;
    const position = resetReaderControlSearchScroll(this.resultScrollPosition, this.resultNativeOffset(layout));
    position.anchorRows = this.searchPublication.resultScrollAnchor(this.resultScrollVisit, this.acceptedResultScrollScope);
    this.resultScrollPosition = position;
    // Seed the native List near the restored row on mount. Its existing
    // measured endpoint rebase settles the remaining fractional offset.
    const list = readerControlSearchListProjection(layout, sampleReaderControlSearchScroll(position, layout));
    this.resultInitialNativeIndex = Math.min(Math.max(0, layout.resultCount - 1),
      Math.floor(list.targetOffsetVp / READER_SEARCH_LIST_ITEM_HEIGHT));
    this.resultScrollSource = 'unknown';
    this.scheduleResultNativeFollow();
  }

  private onResultLayoutChanged(): void {
    const settled = this.interactionEnabled && (this.motionProgress === 0 || this.motionProgress === 1);
    if (this.resultMotionPath === undefined &&
      (!settled || this.motionProgress !== this.resultRestingProgress)) {
      if (this.resultScrollMounted && this.resultRestingLayout !== undefined) {
        // Handoff samples the native last frame before canceling inertia.
        const position = observeReaderControlSearchScroll(this.resultScrollPosition,
          this.resultRestingLayout, { nativeOffsetVp: this.resultNativeOffset(this.resultRestingLayout),
            source: this.resultScrollPosition.pendingRebase === undefined ? 'fling' : 'layout',
            progress: this.resultRestingProgress, inputEnabled: true });
        this.resultScrollPosition = position;
        this.rememberResultScroll(position.anchorRows);
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
    const previous = this.resultScrollPosition;
    const position = observeReaderControlSearchScroll(previous, this.resultLayout(), {
      nativeOffsetVp: this.resultNativeOffset(), source: source,
      progress: this.motionProgress, inputEnabled: this.interactionEnabled,
    });
    this.resultScrollPosition = position;
    if (position.anchorRows !== previous.anchorRows) this.rememberResultScroll(position.anchorRows);
  }

  private rememberResultScroll(anchorRows: number): void {
    this.searchPublication.rememberResultScroll(this.resultScrollVisit, this.acceptedResultScrollScope, anchorRows);
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
    .attributeModifier(new ReaderPanelFrame('reader-full-card', this.appThemeScheme))
    .clip(true).enabled(this.interactionEnabled);
  }

  @Builder
  private searchField() {
    Row({ space: 5 }) {
      ReaderFormField({ specId: 'reader-content-search', scheme: this.appThemeScheme,
        naturalInputHeightVp: this.frame().inputHeightVp,
        text: this.query, placeholder: '搜索正文内容', inputController: this.inputController, inputIdentity: this.queryInputId,
        fieldAccessibilityLabel: '搜索正文内容', onTextChange: (value: string): void => {
          if (this.queryInputMounted && this.interactionEnabled) this.onQueryChange(value);
        },
        onEditingChange: (editing: boolean): void => this.onQueryEditingChanged(editing), onSubmit: (): void => this.submit() });
    }
    .width(this.frame().field.width).height(this.frame().field.height)
    .padding({ left: 9, right: 9 }).alignItems(VerticalAlign.Center)
    .attributeModifier(new ReaderPanelFrame('reader-soft-control', this.appThemeScheme))
    .position({ x: this.frame().field.x, y: this.frame().field.y })
    .opacity(this.presentation().contentOpacity).blur(this.presentation().contentBlur)
    .onClick((): void => this.focusQueryField());
  }

  @Builder
  private searchAction() {
    Button({ type: ButtonType.Normal, stateEffect: false }) {
      Image((this.appThemeScheme === 'night' ? $r('app.media.reader_directory_search_theme_night') : $r('app.media.reader_directory_search'))).width(16).height(16)
        .opacity(this.canSearch() ? 1 : .4);
    }
    .width(this.frame().action.width).height(this.frame().action.height)
    .padding(0)
    .position({ x: this.frame().action.x, y: this.frame().action.y })
    .opacity(this.presentation().contentOpacity).blur(this.presentation().contentBlur)
    .attributeModifier(new ReaderPanelFrame('reader-soft-control', this.appThemeScheme))
    .enabled(this.canSearch()).accessibilityText('搜索正文')
    .onClick((): void => this.submit());
  }

  @Builder
  private quickBack() {
    // Keep the actor mounted while p changes; toggling Visibility at the
    // endpoint forces a subtree rebuild during the parent morph and can expose
    // a transient black frame.
    ReaderControlQuickBack({ variant: 'search', scheme: this.appThemeScheme,
      actionWidth: this.frame().back.width, actionHeight: this.frame().back.height,
      actionVisible: this.frame().back.opacity > 0, actionEnabled: this.interactionEnabled,
      onAction: (): void => this.onBack(),
    }).position({ x: this.frame().back.x, y: this.frame().back.y })
      .opacity(this.frame().back.opacity * this.presentation().contentOpacity).blur(this.presentation().contentBlur);
  }

  @Builder
  private resultsBody() {
    Stack({ alignContent: Alignment.TopStart }) {
      if (this.state.kind === 'results') {
        List({ space: 0, scroller: this.resultScroller, initialIndex: this.resultInitialNativeIndex }) {
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
        // Feature scroll exception: contentEndOffsetVp is a normalized native
        // List coordinate (visualToNativeRatio), not page geometry.
        // ReaderScrollLayout must not reinterpret it.
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
          ReaderPageState({ message: this.statusText(), loading: this.state.kind === 'loading', padded: false,
            mutedColor: readerAppColor('TOK_READ_MUTED', this.appThemeScheme) });
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
    if (this.state.kind === 'results' && (this.state.hasMore === true || this.state.loadMoreError !== undefined ||
      this.state.paginationRetired === true)) {
      if (this.retainedLoadMoreFailure) {
        Row({ space: 10 }) {
          Text(this.state.paginationRetired === true ? '需重新搜索才能加载更多' : '后续结果加载失败')
            .attributeModifier(new ReaderSearchMeasuredMessageFrame(this.frame().loadMoreHeightVp > 0))
            .fontFamily(MESSAGE_BODY.fontFamily).fontSize(MESSAGE_BODY.fontSizeFp)
            .lineHeight(MESSAGE_BODY.lineHeightFp as number)
            .fontColor(readerAppColor('TOK_MESSAGE_MUTED', this.appThemeScheme));
          ReaderRecoveryAction({ label: this.state.hasMore === true ? '重试' : '重新搜索', variant: 'text', isBusy: this.state.loadingMore === true,
            actionEnabled: this.interactionEnabled && (this.motionProgress === 0 || this.motionProgress === 1),
            onReconcile: (): void => {
              if (this.state.kind !== 'results' || !this.interactionEnabled ||
                (this.motionProgress !== 0 && this.motionProgress !== 1) || this.state.loadingMore === true ||
                (this.state.loadMoreError === undefined && this.state.paginationRetired !== true)) return;
              if (this.state.hasMore === true) this.onLoadMore(); else this.submit();
            } });
        }.width(this.frame().results.width).height(Math.max(44, this.frame().loadMoreHeightVp)).justifyContent(FlexAlign.Center)
          .position({ x: 0, y: Math.max(0, this.frame().results.height - Math.max(44, this.frame().loadMoreHeightVp)) })
          .opacity(this.presentation().contentOpacity).blur(this.presentation().contentBlur);
      } else {
      Button({ type: ButtonType.Normal, stateEffect: false }) {
        Text(this.state.loadingMore === true ? '正在加载…' :
          (this.state.loadMoreError === undefined ? '加载更多结果' : '加载失败，重试'))
          .fontFamily(MESSAGE_ACTION.fontFamily).fontWeight(MESSAGE_ACTION.fontWeight)
          .fontSize(MESSAGE_ACTION.fontSizeFp).lineHeight(MESSAGE_ACTION.lineHeightFp as number)
          .fontColor(readerAppColor('TOK_READ_PRIMARY', this.appThemeScheme))
          .maxLines(1);
      }
      .width(Math.min(this.frame().results.width, this.frame().loadMoreWidthVp)).height(Math.max(26, this.frame().loadMoreHeightVp)).padding(0)
      .position({ x: Math.max(0, this.frame().results.width - this.frame().loadMoreWidthVp - 8),
        y: Math.max(0, this.frame().results.height - Math.max(26, this.frame().loadMoreHeightVp) - 4) })
      .backgroundColor(readerAppColor('TOK_SURFACE_PANEL_SOFT', this.appThemeScheme)).borderRadius(8)
      .opacity(this.presentation().contentOpacity).blur(this.presentation().contentBlur)
      .enabled(this.interactionEnabled && (this.motionProgress === 0 || this.motionProgress === 1) &&
        this.state.loadingMore !== true)
      .accessibilityText(this.state.loadingMore === true ? '正在加载更多搜索结果' :
        (this.state.loadMoreError === undefined ? '加载更多搜索结果' : '重试加载更多搜索结果'))
      .onClick((): void => {
        if (this.state.kind === 'results' && this.state.hasMore === true && this.state.loadingMore !== true && this.interactionEnabled &&
          (this.motionProgress === 0 || this.motionProgress === 1)) this.onLoadMore();
      });
      }
    }
  }

  @Builder
  private resultRow(chapterIndex: number, chapterOffset: number, sourceId: string = '', bookId: string = '') {
    Button({ type: ButtonType.Normal, stateEffect: false }) {
      Stack({ alignContent: Alignment.TopStart }) {
        Text(this.resultTitle(this.currentResult(chapterIndex, chapterOffset)))
          .width(Math.max(0, this.frame().firstResult.width - 18)).height(this.frame().titleHeightVp)
          .fontFamily(TYPE_READER_SEARCH_RETAINED_RESULT_ROW_TITLE.fontFamily).fontSize(TYPE_READER_SEARCH_RETAINED_RESULT_ROW_TITLE.fontSizeFp).lineHeight(TYPE_READER_SEARCH_RETAINED_RESULT_ROW_TITLE.lineHeightFp as number)
          .fontWeight(TYPE_READER_SEARCH_RETAINED_RESULT_ROW_TITLE.fontWeight).fontColor(readerAppColor('TOK_READ_INK', this.appThemeScheme))
          .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis })
          .position({ x: 9, y: 9.09375 });
        this.resultSnippet(chapterIndex, chapterOffset);
      }.width(this.frame().firstResult.width).height(this.frame().rowHeight);
    }
    .width(this.frame().firstResult.width).height(this.frame().rowHeight)
    .padding(0).backgroundColor(Color.Transparent)
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
        .fontColor(readerAppColor('TOK_READ_MUTED', this.appThemeScheme)).fontWeight(TYPE_READER_SNIPPET_INLINE_REGULAR.fontWeight);
      Span(this.currentSnippet(chapterIndex, chapterOffset).match)
        .fontColor(readerAppColor('TOK_DANGER', this.appThemeScheme)).fontWeight(TYPE_READER_SNIPPET_INLINE_MATCH.fontWeight);
      Span(this.currentSnippet(chapterIndex, chapterOffset).suffix)
        .fontColor(readerAppColor('TOK_READ_MUTED', this.appThemeScheme)).fontWeight(TYPE_READER_SNIPPET_INLINE_REGULAR.fontWeight);
    }
    .width(Math.max(0, this.frame().firstResult.width - 18)).height(this.frame().snippetHeightVp)
    .padding({ left: 11 }).border({ width: { left: TOK_BORDER_W }, color: readerAppColor('TOK_LINE_STRONG', this.appThemeScheme) })
    .fontFamily(TYPE_READER_SEARCH_RETAINED_RESULT_SNIPPET_SNIPPET.fontFamily as string).fontSize(TYPE_READER_SEARCH_RETAINED_RESULT_SNIPPET_SNIPPET.fontSizeFp).lineHeight(TYPE_READER_SEARCH_RETAINED_RESULT_SNIPPET_SNIPPET.lineHeightFp as number)
    .maxLines(2).textOverflow({ overflow: TextOverflow.Ellipsis })
    .position({ x: 9, y: 18.09375 + this.frame().titleHeightVp });
  }

  private canSearch(): boolean {
    return this.queryInputMounted && this.interactionEnabled && this.query.trim().length > 0 && this.state.kind !== 'loading';
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
