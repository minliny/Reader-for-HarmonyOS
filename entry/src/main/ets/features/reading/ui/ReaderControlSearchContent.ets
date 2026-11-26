import type { ReaderControlTemporaryInputKind } from './ReaderControlSessionState';
import { ReaderEditingVisibility } from '../../../ui/layout/ReaderEditingVisibility';
import { ReaderRectVp } from '../../../ui/foundation/ReaderWindowMetrics';
import { readerControlSearchResultTitle, readerControlSearchStatusText, readerControlSearchMinimumFacts, measureReaderSearchMinimum, type ReaderSearchMinimumFacts, type ReaderSearchMinimumProfile } from './ReaderControlSearchMinimum';

import { readerControlModuleProfileMatches, readerControlModuleFactsMatch, readerControlModuleFactsGeometryKey, type ReaderControlPreparedModuleProfile, type ReaderControlModuleFacts } from './ReaderControlMinimumMeasurement';
import { ReaderFormField } from '../../../ui/controls/ReaderFormField';
import { readerActionTouchRegion } from '../../../ui/controls/ReaderActionAccessibility';
import hilog from '@ohos.hilog';
import { DEBUG } from '../../../../../../build/default/generated/profile/default/BuildProfile';
import { ReaderPanelFrame } from '../../../ui/surfaces/ReaderPanelFrame';
import { ReaderControlQuickBack } from './ReaderControlQuickBack';
import { ReaderRecoveryAction } from '../../../ui/feedback/ReaderRecoveryAction';
import { ReaderPageState } from '../../../ui/feedback/ReaderPageState';
import { MESSAGE_BODY } from '../../../ui/foundation/ReaderMessageStyle';
import { TYPE_READER_SNIPPET_INLINE_MATCH, TYPE_READER_SNIPPET_INLINE_REGULAR, TYPE_READER_SEARCH_RETAINED_RESULT_ROW_TITLE, TYPE_READER_SEARCH_RETAINED_RESULT_SNIPPET_SNIPPET, TYPE_SEARCH_FIELD_ACTION } from '../../../ui/foundation/ReaderTypography';

import { readerAppColor } from '../../../ui/foundation/ReaderThemeRegistry';
import { PathShape } from '@ohos.arkui.shape';
import { sampleReaderControlMotionPresentation, readerControlMotionClipRects, readerControlMotionClipPath,
  readerControlMotionVisibleRect, type ReaderControlMotionPresentation, type ReaderControlMotionClipRect } from './ReaderControlMotionPresentation';
import { sampleReaderControlMorphScrollPath,
  type ReaderControlMorphScrollPath } from './ReaderControlMorphScroll';
import { registerReaderFonts } from '../../../ui/foundation/ReaderFonts';
import { ReaderPressFeedback } from '../../../ui/foundation/ReaderPressFeedback';
import { TOK_BORDER_W } from '../../../ui/foundation/ReaderTokens';
import { SEARCH_CONTROL_CLEAR_ICON_SIZE, SEARCH_CONTROL_MIN_TARGET } from '../../../ui/foundation/ReaderSearchControlGeometry';
import type { ReadingContentSearchResult } from '../application/ReadingSessionFlowGateway';
import { ReaderContentSearchPublication, type ReaderQuickSearchState, type ReaderQuickSearchResultsState } from '../presentation/ReaderContentSearchPublication';
import { ReaderContentSearchDataSource, readerContentSearchResultKey } from './ReaderContentSearchDataSource';
import { READER_SEARCH_LIST_ITEM_HEIGHT, READER_SEARCH_LIST_CACHE_COUNT, readerControlSearchListProjection,
  readerControlSearchListRowTranslation, readerControlSearchListScrollDelta,
  type ReaderControlSearchListProjection } from './ReaderControlSearchListProjection';
import { splitReaderSearchSnippet, type ReaderSearchSnippetParts } from '../presentation/ReaderSearchHighlight';
import { READER_CONTROL_SEARCH_BORDER, READER_CONTROL_SEARCH_CLEAR_SLOT, READER_CONTROL_SEARCH_END_INSET,
  READER_CONTROL_SEARCH_ICON_GAP, READER_CONTROL_SEARCH_ICON_SIZE, READER_CONTROL_SEARCH_INPUT_START, READER_CONTROL_SEARCH_LEADING_INSET,
  sampleReaderControlSearch, type ReaderControlSearchFrame,
  type ReaderControlSearchNaturalSize } from './ReaderControlSearchGeometry';
import type { ReaderControlModuleMeasurer, ReaderControlModuleMinimum, ReaderControlCandidateWidths } from './ReaderLayoutGeometry';

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
 * actor retains the authored anchors, with 32/36vp query capsules. */
@Component
export struct ReaderControlSearchContent {
  editingHost: ReaderEditingVisibility | undefined = undefined;
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  @StorageLink('readerWindowMetricsRevision') @Watch('publishMinimumMeasurer') private minimumMetricsRevision: number = 0;
  @Prop @Watch('onPreparedMinimumChanged') preparedMinimum: ReaderControlPreparedModuleProfile | undefined = undefined;
  @Prop preparedMinimumRequired: boolean = false;
  onMinimumFactsChanged: (identity: string, facts: ReaderControlModuleFacts) => void =
    (_identity: string, _facts: ReaderControlModuleFacts): void => {};
  @Prop @Watch('publishMinimumMeasurer') minimumIdentity: string = '';
  @Prop @Watch('onPreparedMinimumChanged') minimumKey: string = '';
  onMinimumMeasurerReady: (identity: string, measurer: ReaderControlModuleMeasurer | undefined) => void =
    (_identity: string, _measurer: ReaderControlModuleMeasurer | undefined): void => {};

  @Prop @Watch('onResultLayoutChanged') motionProgress: number = 0;
  @Prop @Watch('onResultLayoutChanged') availableWidth: number = 286;
  @Prop @Watch('onResultLayoutChanged') availableHeight: number = 190;
  @Prop fullContentHeight: number = 666;
  @Prop quickContentHeight: number = 190;
  @Prop @Watch('onInputChanged') interactionEnabled: boolean = true;
  inputCurrent?: () => boolean;
  @Prop @Watch('dismissTemporaryLayer') dismissTemporaryRevision: number = 0;
  @Prop @Watch('publishMinimumMeasurer') query: string = '';
  @Prop @Watch('publishMinimumMeasurer') onlineBook: boolean = false;
  searchPublication: ReaderContentSearchPublication = new ReaderContentSearchPublication();
  @Prop @Watch('acceptSearchPublication') searchRevision: number = 0;
  @State @Watch('onResultDataChanged') private state: ReaderQuickSearchState = { kind: 'idle' };
  @State private retainedLoadMoreFailure: boolean = false;
  private adoptedPrepared: ReaderControlPreparedModuleProfile | undefined = undefined;
  private presentationPrepared(): ReaderControlPreparedModuleProfile | undefined {
    const current = this.preparedMinimum;
    if (current !== undefined && current.identity === this.minimumIdentity && current.key === this.minimumKey &&
      readerControlModuleProfileMatches(current.moduleData, 'search') && readerControlModuleFactsMatch(current.facts, 'search')) return current;
    const adopted = this.adoptedPrepared;
    return this.preparedMinimumRequired && adopted !== undefined &&
      readerControlModuleProfileMatches(adopted.moduleData, 'search') && readerControlModuleFactsMatch(adopted.facts, 'search') ? adopted : undefined;
  }
  private preparedProfile(): ReaderSearchMinimumProfile | undefined {
    return this.presentationPrepared()?.moduleData.search;
  }
  private currentMinimumProfile(): ReaderSearchMinimumProfile | undefined {
    return this.preparedMinimumRequired ? this.preparedProfile() : this.preparedProfile() ?? this.minimumProfiles.get(this.minimumKey);
  }
  private displayState(): ReaderQuickSearchState {
    // Keep the existing observable read. Accepted snapshots retain the raw
    // Publication identity used by its cursor and operation scope.
    const observed = this.state;
    return this.displayedFacts()?.readViewState() ?? this.acceptedSearchState ?? observed;
  }
  private currentSearchState(): ReaderQuickSearchState {
    return this.searchPublication.stateAt(this.searchRevision);
  }
  private displayedFacts(): ReaderSearchMinimumFacts | undefined {
    return this.preparedMinimumRequired && this.preparedProfile() !== undefined ? this.presentationPrepared()?.facts.search : undefined;
  }
  private adoptedPreparedKey: string = '';
  private onPreparedMinimumChanged(): void {
    if (!this.preparedMinimumRequired) { this.onResultLayoutChanged(); return; }
    const prepared = this.preparedMinimum;
    if (prepared === undefined || prepared.identity !== this.minimumIdentity || prepared.key !== this.minimumKey ||
      !readerControlModuleProfileMatches(prepared.moduleData, 'search') || !readerControlModuleFactsMatch(prepared.facts, 'search')) return;
    this.adoptedPrepared = prepared;
    this.onResultDataChanged();
    const adopted = `${prepared.identity}|${prepared.key}`;
    if (adopted === this.adoptedPreparedKey) return;
    this.adoptedPreparedKey = adopted;
    this.onResultLayoutChanged();
  }
  private acceptedSearchState: ReaderQuickSearchState | undefined = undefined;
  private acceptedResultScrollScope: number = 0;
  onTemporaryLayerChange: (active: boolean, kind?: ReaderControlTemporaryInputKind, endEditing?: () => void | Promise<void>) => void =
    (_active: boolean, _kind?: ReaderControlTemporaryInputKind, _endEditing?: () => void | Promise<void>): void => {};
  onBack: () => void = (): void => {};
  onQueryChange: (query: string) => void = (_query: string): void => {};
  onSearch: () => void = (): void => {};
  onLoadMore: () => void = (): void => {};
  onNeedMore: () => void = (): void => {};
  onResultListPublished?: (scope: number, count: number) => void;
  private continuationQueued: boolean = false;
  onSelectResult: (result: ReadingContentSearchResult, scope: number, ordinal: number) => void =
    (_result: ReadingContentSearchResult, _scope: number, _ordinal: number): void => {};
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
  private indexedResultCount: number = 0;
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

    if (this.preparedMinimumRequired) this.onPreparedMinimumChanged();
  }

  aboutToDisappear(): void {
    this.adoptedPrepared = undefined;
    this.adoptedPreparedKey = '';

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

  editorInputCurrent: (() => boolean) | undefined = undefined;

  private currentEditorInputEnabled(): boolean {
    return (!this.preparedMinimumRequired || this.presentationPrepared()?.ownerCurrent?.() === true) &&
      this.queryInputMounted && (this.editorInputCurrent?.() ?? this.currentInputEnabled());
  }

  private currentInputEnabled(): boolean {
    return (!this.preparedMinimumRequired || this.presentationPrepared()?.ownerCurrent?.() === true) &&
      this.interactionEnabled && (this.inputCurrent?.() ?? true);
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
        String(editing), String(this.queryEditing), String(this.queryInputMounted), String(this.currentInputEnabled()));
    }
    if (!this.queryInputMounted) return;
    if (editing && !this.currentEditorInputEnabled()) {
      this.stopQueryEditing();
      return;
    }
    if (editing === this.queryEditing) return;
    this.queryEditing = editing;
    this.onTemporaryLayerChange(editing, 'inlineEditor', (): void => this.dismissTemporaryLayer());
  }

  private focusQueryField(): void {
    if (!this.currentEditorInputEnabled()) return;
    try {
      this.getUIContext().getFocusController().requestFocus(this.queryInputId);
    } catch (_) {
      // A detached native focus context must not fail the retained search UI.
    }
  }

  private onInputChanged(): void {
    if (!this.currentEditorInputEnabled()) this.dismissTemporaryLayer();
    this.onResultLayoutChanged();
  }

  private frame(): ReaderControlSearchFrame {
    return sampleReaderControlSearch(this.motionProgress, this.availableWidth, this.availableHeight, this.naturalSize(this.motionProgress));
  }

  private queryEditingContext(field: ReaderRectVp): ReaderRectVp | undefined {
    const profile = this.currentMinimumProfile();
    if (profile === undefined || (this.motionProgress !== 0 && this.motionProgress !== 1)) return undefined;
    const minimum = this.motionProgress === 1 ? profile.full.minimum : profile.quick.minimum;
    if (!minimum.fits || !Number.isFinite(minimum.heightVp) || minimum.heightVp <= 0) return undefined;
    const frame = this.frame();
    // Anchor the semantic minimum to the current native field, including the
    // capsule's border, leading icon and centered native input. The
    // minimum producer already measures one whole result plus paging/recovery,
    // or the current idle/loading/empty/error state. Never substitute the
    // currently clipped result viewport: zero visible results is the defect.
    const originX = field.left - READER_CONTROL_SEARCH_INPUT_START - frame.field.x;
    const originY = field.top - Math.max(0, (frame.field.height - field.height) / 2) - frame.field.y;
    const top = Math.min(frame.field.y, frame.action.y, this.motionProgress === 0 ? frame.back.y : frame.field.y);
    const bottom = Math.max(minimum.heightVp, frame.field.y + frame.field.height, frame.action.y + frame.action.height);
    return new ReaderRectVp(originX, originY + top, this.availableWidth, bottom - top);
  }

  private publishMinimumMeasurer(): void {
    if (!this.queryInputMounted || this.minimumIdentity.length === 0) return;
    const identity = this.minimumIdentity;
    const state = this.currentSearchState();
    const facts = readerControlSearchMinimumFacts({ query: this.query, state: state,
      onlineBook: this.onlineBook,
      resultScope: this.searchPublication.resultScrollScopeFor(state), retainedLoadMoreFailure: this.retainedLoadMoreFailure });
    if (this.preparedMinimumRequired) { this.onMinimumFactsChanged(identity, { module: 'search', search: facts }); return; }
    const signature = JSON.stringify([identity, this.minimumMetricsRevision, readerControlModuleFactsGeometryKey({ module: 'search', search: facts })]);
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
        const selected = this.currentMinimumProfile();
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
    const profile = this.currentMinimumProfile();
    if (profile === undefined) return undefined;
    const q = profile.quick.natural, f = profile.full.natural;
    const quickScopeHeight = q.cacheScopeHeightVp ?? 0;
    const fullScopeHeight = f.cacheScopeHeightVp ?? 0;
    return { fieldHeightVp: q.fieldHeightVp + (f.fieldHeightVp - q.fieldHeightVp) * progress,
      actionWidthVp: q.actionWidthVp + (f.actionWidthVp - q.actionWidthVp) * progress,
      placeholderWidthVp: q.placeholderWidthVp + (f.placeholderWidthVp - q.placeholderWidthVp) * progress,
      inputHeightVp: q.inputHeightVp + (f.inputHeightVp - q.inputHeightVp) * progress,
      titleHeightVp: q.titleHeightVp + (f.titleHeightVp - q.titleHeightVp) * progress,
      snippetHeightVp: q.snippetHeightVp + (f.snippetHeightVp - q.snippetHeightVp) * progress,
      rowHeightVp: q.rowHeightVp + (f.rowHeightVp - q.rowHeightVp) * progress,
      loadMoreHeightVp: q.loadMoreHeightVp + (f.loadMoreHeightVp - q.loadMoreHeightVp) * progress,
      loadMoreWidthVp: q.loadMoreWidthVp + (f.loadMoreWidthVp - q.loadMoreWidthVp) * progress,
      cacheScopeHeightVp: quickScopeHeight + (fullScopeHeight - quickScopeHeight) * progress,
      statusHeightVp: q.statusHeightVp + (f.statusHeightVp - q.statusHeightVp) * progress,
      backHeightVp: q.backHeightVp + (f.backHeightVp - q.backHeightVp) * progress,
      backWidthVp: q.backWidthVp + (f.backWidthVp - q.backWidthVp) * progress };
  }

  private resultLayout(): ReaderControlSearchScrollLayout {
    return this.resultLayoutAt(this.frame());
  }

  private resultLayoutAt(frame: ReaderControlSearchFrame): ReaderControlSearchScrollLayout {
    const displayState = this.displayState();
    return { rowHeightVp: frame.rowHeight, viewportHeightVp: Math.max(0, frame.results.height - frame.loadMoreHeightVp -
      (frame.loadMoreHeightVp > 0 ? 4 : 0) - frame.cacheScopeHeightVp),
      contentOriginVp: frame.firstResult.y, contentEndPaddingVp: frame.resultEndPadding,
      resultCount: displayState.kind === 'results' ? displayState.results.length : 0 };
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
    const fullOffset = this.resultMotionPath?.fullOffset ?? this.resultScrollPosition.anchorRows;
    const quickOffset = this.resultMotionPath?.quickOffset ?? this.resultScrollPosition.anchorRows;
    const fullScroll = sampleReaderControlSearchScroll({ anchorRows: fullOffset,
      nativeOffsetVp: this.resultScrollPosition.nativeOffsetVp, revision: this.resultScrollPosition.revision }, this.resultLayoutAt(f));
    const quickScroll = sampleReaderControlSearchScroll({ anchorRows: quickOffset,
      nativeOffsetVp: this.resultScrollPosition.nativeOffsetVp, revision: this.resultScrollPosition.revision }, this.resultLayoutAt(q));
    // At the result tail, the larger viewport can show earlier rows. Clip
    // against the same clamped projection that actually paints those rows.
    const full: ReaderControlMotionClipRect = { x: f.firstResult.x, y: f.firstResult.y + index * f.rowHeight - fullScroll.offsetVp,
      width: f.firstResult.width, height: f.rowHeight };
    const current: ReaderControlMotionClipRect = { x: b.firstResult.x,
      y: b.firstResult.y + index * b.rowHeight - this.resultScrollFrame().offsetVp,
      width: b.firstResult.width, height: b.rowHeight };
    const quick = readerControlMotionVisibleRect({ x: q.firstResult.x,
      y: q.firstResult.y + index * q.rowHeight - quickScroll.offsetVp,
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
    const displayState = this.displayState();
    this.publishMinimumMeasurer();
    this.editingHost?.refresh();
    this.scheduleResultContinuation();
    const state = displayState;
    // A fast same-keyword requery can coalesce away the loading render. Its
    // new owner scope must still reset; only the same scope may append.
    const scope = state.kind === 'results' ? this.displayedResultScope() : 0;
    const change = this.resultDataSource.publish(state.kind === 'results' ? `${scope}:${state.keyword}` : state.kind,
      state.kind === 'results' ? state.results : []);
    if (state.kind === 'results' && scope > 0 && state.results.length > 0 && this.motionProgress === 0 &&
      this.onResultListPublished !== undefined && this.displayedFacts()?.resultScope === scope &&
      this.searchPublication.resultScrollScopeFor(this.currentSearchState()) === scope) {
      this.onResultListPublished(scope, state.results.length);
    }
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
    this.editingHost?.refresh();
    const settled = this.currentInputEnabled() && (this.motionProgress === 0 || this.motionProgress === 1);
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
      // Search keeps one query-owned result position in both forms. The
      // generic form-scroll path converges to the opposite form's top,
      // which would rewind a long result list when collapsing or expanding.
      const anchor = this.resultScrollPosition.anchorRows;
      this.resultMotionPath = { quickOffset: anchor, fullOffset: anchor };
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
    if (!this.currentInputEnabled() || (this.motionProgress !== 0 && this.motionProgress !== 1)) {
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
      progress: this.motionProgress, inputEnabled: this.currentInputEnabled(),
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
    this.scheduleResultContinuation();
    this.syncResultNativeOffset('layout');
    this.scheduleResultNativeFollow();
  }

  private onResultWillScroll(y: number, source: ScrollSource): OffsetResult {
    const accepted = this.resultScrollMounted && (source === ScrollSource.SCROLLER ||
      (this.currentInputEnabled() && (this.motionProgress === 0 || this.motionProgress === 1)));
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
    this.scheduleResultContinuation();
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
    const displayState = this.displayState();
    if (!this.resultScrollMounted || displayState.kind !== 'results' ||
      Math.abs(this.resultViewportHeight - this.resultListFrame().viewportHeightVp) > 0.5) return;
    const next = prepareReaderControlSearchScrollRebase(this.resultScrollPosition, this.resultLayout(), {
      progress: this.motionProgress, inputEnabled: this.currentInputEnabled(),
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

  private scheduleResultContinuation(): void {
    if (this.continuationQueued || !this.resultScrollMounted) return;
    const visit = this.resultScrollVisit;
    const scope = this.acceptedResultScrollScope;
    this.continuationQueued = true;
    void Promise.resolve().then((): void => {
      this.continuationQueued = false;
      const state = this.currentSearchState();
      if (visit !== this.resultScrollVisit || scope !== this.acceptedResultScrollScope || !this.resultScrollMounted ||
        !this.resultActionCurrent(this.displayState(), scope, state) || state.kind !== 'results' ||
        state.hasMore !== true || state.loadMoreError !== undefined || state.paginationRetired === true) return;
      const layout = this.resultLayout();
      if (layout.viewportHeightVp <= 0 || this.resultViewportHeight <= 0 ||
        Math.abs(this.resultViewportHeight - this.resultListFrame().viewportHeightVp) > 0.5) return;
      const visibleRows = Math.max(1, Math.ceil(layout.viewportHeightVp / layout.rowHeightVp));
      const visibleEnd = Math.ceil((this.resultScrollFrame().offsetVp + layout.viewportHeightVp - (layout.contentOriginVp ?? 0)) / layout.rowHeightVp);
      if (visibleEnd + Math.max(visibleRows, READER_SEARCH_LIST_CACHE_COUNT) >= state.results.length) this.onNeedMore();
    });
  }

  private cancelResultNativeFollow(): void {
    this.resultNativeFollowLifecycle += 1;
    if (this.resultNativeFollowTimer >= 0) clearTimeout(this.resultNativeFollowTimer);
    this.resultNativeFollowTimer = -1;
  }

  private scheduleResultNativeFollow(): void {
    const displayState = this.displayState();
    if (!this.resultScrollMounted || this.resultNativeFollowTimer >= 0) return;
    const lifecycle = this.resultNativeFollowLifecycle;
    // Coalesce property Watch deliveries outside native List reconciliation.
    // Read the latest p/query/layout at dispatch, never an obsolete sample.
    this.resultNativeFollowTimer = setTimeout((): void => {
      if (lifecycle !== this.resultNativeFollowLifecycle || !this.resultScrollMounted) return;
      this.resultNativeFollowTimer = -1;
      if (displayState.kind !== 'results' || this.resultPointers.length > 0 || this.resultUserScrolling ||
        this.resultListFrame().viewportHeightVp <= 0 || Math.abs(this.resultViewportHeight - this.resultListFrame().viewportHeightVp) > 0.5) return;
      const endpoint = this.currentInputEnabled() && (this.motionProgress === 0 || this.motionProgress === 1);
      if (endpoint) { this.tryResultScrollRebase(); this.scheduleResultContinuation(); return; }
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
    if (!this.preparedMinimumRequired || this.presentationPrepared() !== undefined) {
    Stack({ alignContent: Alignment.TopStart }) {
      // Query bottom follows the actual input row in both forms.
      Row().height(this.frame().queryDivider.height).width(this.frame().queryDivider.width)
        .backgroundColor(readerAppColor('app.border.readerConfig', this.appThemeScheme))
        .position({ x: this.frame().queryDivider.x, y: this.frame().queryDivider.y });
      this.searchField();
      this.searchAction();
      this.resultsBody();
      this.quickBack();
    }
    .width(this.availableWidth).height(this.availableHeight)
    .id('reader-control-module-search')
    .attributeModifier(new ReaderPanelFrame('reader-full-card', this.appThemeScheme))
    .clip(true).enabled(this.currentInputEnabled() || this.currentEditorInputEnabled());

    }
  }

  @Builder
  private searchField() {
    Row({ space: 0 }) {
      Image($r('app.media.reader_directory_input_search'))
        .width(READER_CONTROL_SEARCH_ICON_SIZE).height(READER_CONTROL_SEARCH_ICON_SIZE)
        .margin({ right: READER_CONTROL_SEARCH_ICON_GAP })
        .fillColor(readerAppColor('TOK_READ_MUTED', this.appThemeScheme))
        .accessibilityLevel('no').hitTestBehavior(HitTestMode.None);
      ReaderFormField({ editingHost: this.editingHost, specId: 'reader-content-search', scheme: this.appThemeScheme,
        editingContext: (field: ReaderRectVp): ReaderRectVp | undefined => this.queryEditingContext(field),
        naturalInputHeightVp: this.frame().inputHeightVp,
        text: this.query, placeholder: this.frame().placeholder, inputController: this.inputController, inputIdentity: this.queryInputId,
        fieldAccessibilityLabel: '搜索正文内容', onTextChange: (value: string): void => {
          if (this.currentEditorInputEnabled()) this.onQueryChange(value);
        },
        onEditingChange: (editing: boolean): void => this.onQueryEditingChanged(editing), onSubmit: (): void => this.submit() })
        .layoutWeight(1);
      if (this.query.length > 0) {
        Button({ type: ButtonType.Normal, stateEffect: false }) {
          Image($r('app.media.search_clear'))
            .width(SEARCH_CONTROL_CLEAR_ICON_SIZE).height(SEARCH_CONTROL_CLEAR_ICON_SIZE)
            .fillColor(readerAppColor('TOK_READ_MUTED', this.appThemeScheme))
            .accessibilityLevel('no').hitTestBehavior(HitTestMode.None);
        }.width(READER_CONTROL_SEARCH_CLEAR_SLOT).height(SEARCH_CONTROL_CLEAR_ICON_SIZE).padding(0)
          .backgroundColor(Color.Transparent).focusOnTouch(false)
          .responseRegion({ x: READER_CONTROL_SEARCH_CLEAR_SLOT + READER_CONTROL_SEARCH_END_INSET - SEARCH_CONTROL_MIN_TARGET,
            y: (SEARCH_CONTROL_CLEAR_ICON_SIZE - SEARCH_CONTROL_MIN_TARGET) / 2,
            width: SEARCH_CONTROL_MIN_TARGET, height: SEARCH_CONTROL_MIN_TARGET })
          .enabled(this.currentEditorInputEnabled()).accessibilityText('清空正文搜索')
          .onClick((): void => {
            if (!this.currentEditorInputEnabled()) return;
            this.onQueryChange('');
            this.focusQueryField();
          });
      }
    }
    .id('reader-control-search-field')
    .width(this.frame().field.width).height(this.frame().field.height)
    .padding({ left: READER_CONTROL_SEARCH_LEADING_INSET, right: READER_CONTROL_SEARCH_END_INSET })
    .alignItems(VerticalAlign.Center)
    .backgroundColor(readerAppColor('TOK_READ_ELEVATED', this.appThemeScheme))
    .border({ width: READER_CONTROL_SEARCH_BORDER, color: readerAppColor('app.border.readerConfig', this.appThemeScheme) })
    .borderRadius(this.frame().field.height / 2)
    .responseRegion(readerActionTouchRegion(this.frame().field.width, this.frame().field.height))
    .position({ x: this.frame().field.x, y: this.frame().field.y })
    .opacity(this.presentation().contentOpacity).blur(this.presentation().contentBlur)
    .onClick((): void => this.focusQueryField());
  }

  @Builder
  private searchAction() {
    Button({ type: ButtonType.Normal, stateEffect: false }) {
      Stack({ alignContent: Alignment.Center }) {
        Image($r('app.media.reader_directory_search')).width(16).height(16)
          .fillColor(readerAppColor(this.canSearch() ? 'app.control.onPrimary' : 'TOK_READ_MUTED', this.appThemeScheme))
          .opacity(1 - this.frame().actionLabelOpacity);
        Text('搜索')
          .fontFamily(TYPE_SEARCH_FIELD_ACTION.fontFamily).fontWeight(TYPE_SEARCH_FIELD_ACTION.fontWeight)
          .fontSize(TYPE_SEARCH_FIELD_ACTION.fontSizeFp).lineHeight(TYPE_SEARCH_FIELD_ACTION.lineHeightFp as number)
          .maxLines(1).halfLeading(true)
          .fontColor(readerAppColor(this.canSearch() ? 'app.control.onPrimary' : 'TOK_READ_MUTED', this.appThemeScheme))
          .opacity(this.frame().actionLabelOpacity);
      }.accessibilityLevel('no-hide-descendants').hitTestBehavior(HitTestMode.None);
    }
    .id('reader-control-search-submit')
    .width(this.frame().action.width).height(this.frame().action.height)
    .padding(0)
    .responseRegion(readerActionTouchRegion(this.frame().action.width, this.frame().action.height))
    .position({ x: this.frame().action.x, y: this.frame().action.y })
    .opacity(this.presentation().contentOpacity).blur(this.presentation().contentBlur)
    .attributeModifier(new ReaderPressFeedback(
      readerAppColor(this.canSearch() ? 'TOK_READ_PRIMARY' : 'TOK_READ_DISABLED_BG', this.appThemeScheme),
      this.appThemeScheme, this.frame().action.height / 2, this.frame().action.height / 2, this.canSearch()))
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
      actionVisible: this.frame().back.opacity > 0, actionEnabled: this.currentInputEnabled(),
      onAction: (): void => {
        if (this.queryInputMounted && this.currentInputEnabled() && this.motionProgress === 0) this.onBack();
      },
    }).position({ x: this.frame().back.x, y: this.frame().back.y })
      .opacity(this.frame().back.opacity * this.presentation().contentOpacity).blur(this.presentation().contentBlur);
  }

  @Builder
  private resultsBody() {
    Stack({ alignContent: Alignment.TopStart }) {
      if (this.displayState().kind === 'results') {
        Stack({ alignContent: Alignment.TopStart }) {
        List({ space: 0, scroller: this.resultScroller, initialIndex: this.resultInitialNativeIndex }) {
          // A new query can find the same anchor. Bind both the native cell
          // and its click to the publication that actually presented it.
          LazyForEach(this.resultDataSource, (result: ReadingContentSearchResult, index: number) => {
            ListItem() {
              this.resultRow(result.chapterIndex, result.chapterOffset, index, result.sourceId, result.bookId,
                this.displayedResultScope());
            }
            .width('100%').height(READER_SEARCH_LIST_ITEM_HEIGHT)
            .translate({ y: this.resultRowTranslation(this.currentResultIndex(result.chapterIndex, result.chapterOffset)) }).clip(false);
          }, (result: ReadingContentSearchResult): string => `${this.displayedResultScope()}:${readerContentSearchResultKey(result)}`);
        }
        .id('reader-control-search-results')
        .width(this.frame().firstResult.width).height(this.resultListFrame().viewportHeightVp)
        .position({ x: 0, y: 0 })
        .childrenMainSize(this.resultItemSizes).cachedCount(READER_SEARCH_LIST_CACHE_COUNT, true)
        // Feature scroll exception: contentEndOffsetVp is a normalized native
        // List coordinate (visualToNativeRatio), not page geometry.
        // ReaderScrollLayout must not reinterpret it.
        .contentEndOffset(this.resultListFrame().contentEndOffsetVp)
        .maintainVisibleContentPosition(true)
        // Rows retain authored geometry outside their normalized native item.
        // The parent Results viewport owns the only visual/input clipping box.
        .clip(false).scrollBar(BarState.Off).edgeEffect(EdgeEffect.None)
        .enableScrollInteraction(this.currentInputEnabled() && (this.motionProgress === 0 || this.motionProgress === 1))
        .onAppear((): void => this.onResultScrollAppear())
        .onDisAppear((): void => this.onResultScrollDisappear())
        .onAreaChange((_old: Area, area: Area): void => this.onResultScrollArea(area))
        .onTouch((event: TouchEvent): void => this.onResultTouch(event))
        .onWillScroll((offset: number, _state: ScrollState, source: ScrollSource): ScrollResult =>
          ({ offsetRemain: this.onResultWillScroll(offset, source).yOffset }))
        .onDidScroll((_offset: number, _state: ScrollState): void => this.onResultDidScroll())
        .onScrollStop((): void => this.onResultScrollStop());
        // Native item coordinates are normalized across the morph and their
        // List intentionally permits overflow. Clip that paint at the real
        // visual list lane, inside the actual result lane.
        }.width(this.frame().firstResult.width).height(this.resultLayout().viewportHeightVp)
          .position({ x: this.frame().firstResult.x, y: 0 }).clip(true);
        this.loadMoreAction();
        if (this.frame().cacheScopeHeightVp > 0) {
          Text(this.statusText()).width(this.frame().results.width).height(this.frame().cacheScopeHeightVp)
            .fontFamily(MESSAGE_BODY.fontFamily).fontWeight(MESSAGE_BODY.fontWeight)
            .fontSize(MESSAGE_BODY.fontSizeFp).lineHeight(MESSAGE_BODY.lineHeightFp as number)
            .fontColor(readerAppColor('TOK_READ_MUTED', this.appThemeScheme)).textAlign(TextAlign.Center)
            .wordBreak(WordBreak.BREAK_WORD).hitTestBehavior(HitTestMode.None)
            .position({ x: 0, y: Math.max(0, this.frame().results.height - this.frame().cacheScopeHeightVp) })
            .opacity(this.presentation().contentOpacity).blur(this.presentation().contentBlur);
        }
      } else {
        Stack({ alignContent: Alignment.Center }) {
          ReaderPageState({ message: this.statusText(), loading: this.displayState().kind === 'loading', padded: false,
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
  private displayResults(): ReaderQuickSearchResultsState | undefined {
    const state = this.displayState();
    return state.kind === 'results' ? state : undefined;
  }
  private displayedResultScope(): number {
    return this.displayedFacts()?.resultScope ?? this.searchPublication.resultScrollScopeFor(this.displayState());
  }
  private loadMoreActionEnabled(recovery: boolean): boolean {
    const displayed = this.displayState();
    const scope = this.displayedResultScope();
    const state = this.currentSearchState();
    return state.kind === 'results' && this.resultActionCurrent(displayed, scope, state) &&
      (recovery ? state.loadMoreError !== undefined || state.paginationRetired === true : state.hasMore === true);
  }
  private loadMoreActionHandler(recovery: boolean): () => void {
    const scope = this.displayedResultScope();
    return (): void => this.performLoadMore(recovery, scope);
  }
  private performLoadMore(recovery: boolean, expectedScope: number): void {
    const displayed = this.displayState();
    const state = this.currentSearchState();
    if (this.displayedResultScope() !== expectedScope ||
      state.kind !== 'results' || !this.resultActionCurrent(displayed, expectedScope, state)) return;
    if (recovery && state.loadMoreError === undefined && state.paginationRetired !== true) return;
    if (state.continuationRetryable === true) this.onLoadMore();
    else if (recovery) this.submit();
  }
  private resultActionCurrent(displayed: ReaderQuickSearchState, scope: number,
    state: ReaderQuickSearchState = this.currentSearchState()): boolean {
    return displayed.kind === 'results' && scope > 0 && this.queryInputMounted && this.currentInputEnabled() &&
      (this.motionProgress === 0 || this.motionProgress === 1) && state.kind === 'results' &&
      this.searchPublication.resultScrollScopeFor(state) === scope && state.keyword === displayed.keyword &&
      state.loadingMore !== true;
  }
  private displayedLoadMoreFailure(): boolean {
    const displayed = this.displayedFacts();
    return displayed === undefined ? this.retainedLoadMoreFailure : displayed.loadMoreMessage.length > 0;
  }

  @Builder
  private loadMoreAction() {
    if (this.displayState().kind === 'results' && (this.displayResults()?.loadMoreError !== undefined ||
      this.displayResults()?.paginationRetired === true)) {
      if (this.displayedLoadMoreFailure()) {
        Row({ space: 10 }) {
          Text(this.displayResults()?.paginationRetired === true ? '需重新搜索才能加载更多' : '后续结果加载失败')
            .attributeModifier(new ReaderSearchMeasuredMessageFrame(this.frame().loadMoreHeightVp > 0))
            .fontFamily(MESSAGE_BODY.fontFamily).fontSize(MESSAGE_BODY.fontSizeFp)
            .lineHeight(MESSAGE_BODY.lineHeightFp as number)
            .fontColor(readerAppColor('TOK_MESSAGE_MUTED', this.appThemeScheme));
          ReaderRecoveryAction({ label: this.displayResults()?.continuationRetryable === true ? '重试' : '重新搜索', variant: 'text', isBusy: this.displayResults()?.loadingMore === true,
            generation: this.displayedResultScope(),
            actionEnabled: this.loadMoreActionEnabled(true),
            onReconcile: (expected: number): void => this.performLoadMore(true, expected) });
        }.width(this.frame().results.width).height(Math.max(44, this.frame().loadMoreHeightVp)).justifyContent(FlexAlign.Center)
          .position({ x: 0, y: Math.max(0, this.frame().results.height - (this.frame().cacheScopeHeightVp ?? 0) -
            Math.max(44, this.frame().loadMoreHeightVp)) })
          .opacity(this.presentation().contentOpacity).blur(this.presentation().contentBlur);

      }
    }
  }

  @Builder
  private resultRow(chapterIndex: number, chapterOffset: number, resultOrdinal: number,
    sourceId: string, bookId: string, resultScope: number) {
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
    .id(`reader-control-search-result:${resultScope}:${resultOrdinal}`)
    .width(this.frame().firstResult.width).height(this.frame().rowHeight)
    .padding(0).backgroundColor(Color.Transparent)
    .opacity(this.presentation().contentOpacity).blur(this.presentation().contentBlur)
    .clipShape(this.resultClip(chapterIndex, chapterOffset))
    .borderRadius(6).clip(false)
    .accessibilityText(`${this.resultTitle(this.currentResult(chapterIndex, chapterOffset))}，搜索结果`)
    .onClick((): void => this.selectCurrentResult(chapterIndex, chapterOffset, resultOrdinal, sourceId, bookId, resultScope));
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
    return this.queryInputMounted && this.currentInputEnabled() && this.query.trim().length > 0 && this.currentSearchState().kind !== 'loading';
  }

  private submit(): void {
    if (this.canSearch()) this.onSearch();
  }

  // LazyForEach identity is stable, but a later result set may replace its payload.
  // Builder update closures resolve current owner data, never the first object.
  private currentResultIndex(chapterIndex: number, chapterOffset: number): number {
    const displayState = this.displayState();
    if (displayState.kind !== 'results') {
      this.indexedResultRows = undefined;
      this.indexedResultCount = 0;
      this.resultRowIndexes.clear();
      return -1;
    }
    const rows = displayState.results;
    if (this.indexedResultRows !== rows || this.indexedResultCount > rows.length) {
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
      this.indexedResultCount = rows.length;
    } else {
      for (let index = this.indexedResultCount; index < rows.length; index += 1) {
        const result = rows[index];
        const key = `${result.chapterIndex}:${result.chapterOffset}`;
        if (!this.resultRowIndexes.has(key)) this.resultRowIndexes.set(key, index);
      }
      this.indexedResultCount = rows.length;
    }
    return this.resultRowIndexes.get(`${chapterIndex}:${chapterOffset}`) ?? -1;
  }

  private currentResult(chapterIndex: number, chapterOffset: number): ReadingContentSearchResult | undefined {
    const displayState = this.displayState();
    const index = this.currentResultIndex(chapterIndex, chapterOffset);
    return displayState.kind === 'results' && index >= 0 ? displayState.results[index] : undefined;
  }

  private currentSnippet(chapterIndex: number, chapterOffset: number): ReaderSearchSnippetParts {
    const result = this.currentResult(chapterIndex, chapterOffset);
    if (result === undefined) return { prefix: '', match: '', suffix: '' };
    return splitReaderSearchSnippet(result.snippet, result.snippetStart, result.chapterOffset, result.matchLength);
  }

  private selectCurrentResult(chapterIndex: number, chapterOffset: number, resultOrdinal: number,
    sourceId: string, bookId: string, resultScope: number): void {
    if (resultScope <= 0 || resultScope !== this.displayedResultScope() || !this.queryInputMounted ||
      !this.currentInputEnabled() || (this.motionProgress !== 0 && this.motionProgress !== 1)) return;
    const state = this.currentSearchState();
    if (state.kind !== 'results' || this.searchPublication.resultScrollScopeFor(state) !== resultScope) return;
    const result = state.results[resultOrdinal];
    if (result !== undefined && result.chapterIndex === chapterIndex && result.chapterOffset === chapterOffset &&
      result.sourceId === sourceId && result.bookId === bookId) this.onSelectResult(result, resultScope, resultOrdinal);
  }

  private resultTitle(result: ReadingContentSearchResult | undefined): string {
    return readerControlSearchResultTitle(result);
  }

  private statusText(): string {
    return this.displayedFacts()?.message ?? readerControlSearchStatusText(this.displayState(), this.onlineBook);
  }

}
