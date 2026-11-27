import { ReaderPressFeedback } from '../../../ui/foundation/ReaderPressFeedback';
import { ReaderDelayedRowPress } from '../../../ui/foundation/ReaderPressMotion';
import { readerMotionAnimateParam } from '../../../ui/foundation/ReaderMotionPolicy';
import { READER_FONT_NOTO_SANS_SC_UI_MEDIUM } from '../../../ui/foundation/ReaderFontFamilies';
import { readerLayoutCarrierResponseRegion } from '../../../ui/layout/ReaderPageNativeAttributes';
import { readerHarmonyApi24 } from '../../../app/HarmonyCapabilityProbe';
import type { ReaderNavigationPreferences } from '../../../app/HarmonyCapabilityPolicy';
import { ReaderEditingVisibility } from '../../../ui/layout/ReaderEditingVisibility';
import { ReaderEditingScrollBinding } from '../../../ui/layout/ReaderEditingScrollBinding';
import { ReaderPostLayoutFrame } from '../../../ui/layout/ReaderPostLayoutFrame';
import { readerInteractiveSafeTop, readerStableInteractiveSafeBottom } from '../../../ui/foundation/ReaderWindowMetrics';
import { readerStandardPageSpec } from '../../../ui/layout/ReaderPageShell';
import { ReaderPageGeometry, ReaderPageGeometryInput, resolveReaderPageGeometry } from '../../../ui/layout/ReaderPageGeometry';
import { readerScaledControlHeight } from '../../../ui/foundation/ReaderSurfaceResolvers';
import { resolveSourceManagementLayout, SOURCE_ROW_ACTION_GAP, SOURCE_ROW_ICON_WIDTH, type SourceManagementLayout } from '../presentation/SourceManagementLayout';
import { sourceManagementFilterKey, copySourceManagementScroll, type SourceManagementScrollState } from '../presentation/SourceManagementScrollState';
import { sourceV9DisplayUrl, sourceV9ReportTone, sourceV9Supports, type SourceV9Counts, type SourceV9ListAction, type SourceV9Projection, type SourceV9View } from '../presentation/SourceManagementV9';
import { ReaderButton } from '../../../ui/controls/ReaderButton';
import { resolveReaderLabeledIconActionSpec } from '../../../ui/controls/ReaderLabeledIconActionSpecs';
import { ReaderLabeledIconAction } from '../../../ui/controls/ReaderLabeledIconAction';
import type { SourceManagementViewState, SourceToolsEntry } from '../presentation/SourceJourneyPresentation';
import { LengthMetrics } from '@kit.ArkUI';
import { ReaderPageState } from '../../../ui/feedback/ReaderPageState';
import { TYPE_SOURCE_MANAGEMENT_ROW_TITLE, TYPE_SOURCE_MANAGEMENT_ROW_URL } from '../../../ui/foundation/ReaderTypography';
import { readerAppColor } from '../../../ui/foundation/ReaderThemeRegistry';
import { ReaderScrollLayout, readerScrollEndOffset, readerScrollStartOffset } from '../../../ui/layout/ReaderScrollLayout';
import { type BookSource } from '../application/SourceGateway';
import type { SourceManagementStatusKind, SourceManagementProjection } from '../application/SourceOrchestrator';
import { readerSourceCategoryLabel } from '../application/ReaderSourceCategory';
import { ReaderWindowCoordinator } from '../../../app/ReaderWindowCoordinator';
import { ReaderUIVerificationProbe } from '../../../app/diagnostics/ReaderUIVerificationProbe';
import { ReaderSourceTextMetrics, type SourceTextLayoutLabel } from '../../../pages/ReaderSourceTextMetrics';
import { sourceVerificationOfflineDetectIdentity, sourceVerificationOpening, sourceVerificationRowActions, sourceVerificationReservedTypographyRow, sourceVerificationStatus, sourceVerificationToggleAnchor, SourceVerificationAnchors, type SourceProjectionObservation, type SourceProjectionState, type SourceProjectionTrigger, type SourceRecoveryVerificationFacts, type SourceScrollObservation, type SourceVerificationOpening, type SourceToggleReadyObservation, type SourceV9ListReturnView } from './SourceManagementVerification';
import { readerSurfaceElevation } from '../../../ui/surfaces/ReaderSurfaceSpecs';
import { readerFloatingBarBottomInset } from '../../../ui/layout/ReaderFloatingBarMetrics';
import { ReaderToggle } from '../../../ui/controls/ReaderToggle';
import { readerActionIcon } from '../../../ui/foundation/ReaderActionIconResources';
import { SourceV9CircleCheck, SourceV9DetectButton, SourceV9TypeSeal } from './SourceV9Chrome';
import { SurfaceHorizontalFrame } from '../../../ui/layout/SurfaceHorizontalGeometry';
import { TOK_BORDER_W, TOK_SPACE_CONTROL_INLINE, TOK_SPACE_MD, TOK_SPACE_SM, TOK_SPACE_XS } from '../../../ui/foundation/ReaderTokens';
import type { UIContext } from '@ohos.arkui.UIContext';
import { SourceManagementSearchField, SourceManagementFilters, SourceManagementCategoryFilter,
  type SourceManagementFiltersOwner } from './SourceManagementFiltersAndGroupSheet';
import { SourceManagementReadState, SourceManagementRetainedReadFeedback, SourceManagementStatusAction,
  type SourceManagementRecoveryOwner } from './SourceManagementRecoveryBanner';

const SOURCE_TEXT_ROLES = ['status/all', 'category/all', 'row/title',
  'row/domain', 'footer/manage', 'footer/add'];
const SOURCE_RESERVED_TEXT_ROLES = ['row/domain'];
export type SourceTextOptions = (role: string, sourceId?: string, text?: string) => TextOptions | undefined;

export interface SourceTextLayoutScope {
  owner: SourceVerificationOpening;
  textProjectionRevision: number;
  filterRevision: number;
  readGeneration: number;
  windowRevision: number;
  widthVp: number;
  heightVp: number;
  density: number;
  systemFontScale: number;
  fontScale: number;
  rowAnchor: number;
}

class SourceListDataSource implements IDataSource {
  private items: BookSource[] = [];
  private listeners: DataChangeListener[] = [];

  totalCount(): number {
    return this.items.length;
  }

  getData(index: number): BookSource {
    return this.items[index];
  }

  registerDataChangeListener(listener: DataChangeListener): void {
    if (this.listeners.indexOf(listener) < 0) {
      this.listeners.push(listener);
    }
  }

  unregisterDataChangeListener(listener: DataChangeListener): void {
    const index = this.listeners.indexOf(listener);
    if (index >= 0) {
      this.listeners.splice(index, 1);
    }
  }

  replace(items: BookSource[]): void {
    this.items = items;
    for (const listener of this.listeners) {
      listener.onDataReloaded();
    }
  }
}

export interface SourceManagementListFilters {
  readonly searchQuery: () => string;
  readonly statusValue: () => string;
  readonly categoryValue: () => string;
  readonly groupValue: () => string;
  readonly groupClosing: () => boolean;
  readonly filtersInDefaultState: () => boolean;
  readonly project: () => SourceV9Projection;
  readonly groupChoices: () => string[];
  readonly clear: () => void;
  readonly chooseUngrouped: () => void;
  readonly closeMore: () => void;
}

interface SourceManagementListReadback {
  readonly pendingRecovery: () => boolean;
  readonly loading: () => boolean;
  readonly emptyReadFailure: () => boolean;
  readonly recoveryFacts: () => SourceRecoveryVerificationFacts | undefined;
}

interface SourceManagementListTypography {
  readonly startFilter: () => void;
  readonly startReadback: () => void;
  readonly retireReadback: () => void;
  readonly retireFilter: () => void;
  readonly filtersPrepared: () => boolean;
  readonly measureInitialFilters: () => void;
  readonly scheduleReadText: () => void;
  readonly scheduleOperationText: () => void;
}

interface SourceManagementListNativePort {
  readonly getUIContext: () => UIContext;
  readonly contentFrame: () => SurfaceHorizontalFrame;
  readonly fontScale: () => number;
  readonly geometry: () => ReaderPageGeometry;
  readonly readerWindowMetricsRevision: () => number;
  readonly originX: () => number;
  readonly viewportWidth: () => number;
  readonly viewportHeight: () => number;
  readonly scrollLayout: () => ReaderScrollLayout;
  readonly editingHost: () => ReaderEditingVisibility;
}

interface SourceManagementListPresentationPort {
  readonly appThemeScheme: () => string;
  readonly expandedLayout: () => boolean;
  readonly embeddedWide: () => boolean;
  readonly reduceMotion: () => boolean;
  readonly groupOpen: () => boolean;
  readonly batchMode: () => boolean;
  readonly setBatchMode: (active: boolean) => void;
}

interface SourceManagementListOpeningPort {
  readonly mounted: () => boolean;
  readonly temporaryBackIdentity: () => string;
  readonly verificationOpening: () => string;
  readonly managementBackIsCurrent: (identity: string) => boolean;
  readonly managementOpeningIsCurrent: () => boolean;
  readonly managementInputIsCurrent: () => boolean;
  readonly isInputAllowed: () => boolean;
}

interface SourceManagementListViewPort {
  readonly initialViewState: () => SourceManagementViewState | undefined;
  readonly inputEnabled: () => boolean;
  readonly sources: () => BookSource[];
  readonly operation: () => SourceManagementProjection;
  readonly statusKind: () => SourceManagementStatusKind;
  readonly ungroupedBatchIds: () => string[];
  readonly textLayoutOptions: () => SourceTextOptions | undefined;
}

interface SourceManagementListActionsPort {
  readonly onV9Action: (action: SourceV9ListAction, sourceIds: string[]) => void;
  readonly onAddSource: (preferred?: string, fallback?: string) => void;
  readonly onDetectSource: (id: string) => void;
  readonly onLoginSource: (id: string, loginUrl: string) => void;
  readonly onToggleSource: (id: string, enabled: boolean) => void;
}

interface SourceManagementListFocusPort {
  readonly cancelToolsReturnFocus: (phase: string) => void;
  readonly prepareV9ListReturn: (view: SourceV9ListReturnView) => void;
  readonly completeV9ListReturn: (view: SourceV9ListReturnView) => void;
  readonly observeV9ListEntry: (view: SourceV9ListReturnView) => void;
  readonly onToolsEntryFocused: (identity: string, entry: SourceToolsEntry) => void;
  readonly onToolsEntryLayout: (identity: string, entry: SourceToolsEntry, area: Area) => void;
  readonly toolsFocusId: (entry: SourceToolsEntry) => string;
}

export interface SourceManagementListHost {
  readonly native: SourceManagementListNativePort;
  readonly presentation: SourceManagementListPresentationPort;
  readonly opening: SourceManagementListOpeningPort;
  readonly view: SourceManagementListViewPort;
  readonly actions: SourceManagementListActionsPort;
  readonly focus: SourceManagementListFocusPort;
}

export interface SourceManagementListView {
  readonly host: SourceManagementListHost;
  readonly paint: () => SourceManagementListPaint;
  readonly filters: SourceManagementListFilters;
  readonly readback: SourceManagementListReadback;
  readonly typography: SourceManagementListTypography;
}

@Observed
export class SourceManagementListPaint {
  @Track pressedRowKey: string = '';
  @Track batchSourceIds: string[] = [];
  @Track statusCounts: SourceV9Counts = { all: 0, enabled: 0, disabled: 0, abnormal: 0 };
  @Track hasReadableSources: boolean = false;
  @Track projectedSourceCount: number = 0;
  @Track firstSourceId: string = '';
  @Track lastSourceId: string = '';
  @Track verificationReservedTextRowId: string = '';
}

/** Owns the one native list, its projection, row actions, batch selection and scroll restoration. */
export class SourceManagementListOwner {
  private readonly metadataEllipsisMode: EllipsisMode = readerHarmonyApi24() ? EllipsisMode.CENTER : EllipsisMode.END;
  private readonly delayedPress: ReaderDelayedRowPress = new ReaderDelayedRowPress((key: string): void => {
    this.paint().pressedRowKey = key;
  });
  private projectedSources: BookSource[] = [];
  private projectionRebuildPending: boolean = false;
  private readonly sourceDataSource: SourceListDataSource = new SourceListDataSource();
  private readonly sourceScroller: Scroller = new Scroller();
  private readonly editingScroll: ReaderEditingScrollBinding = new ReaderEditingScrollBinding('reader-source-list');
  private listMounted: boolean = false;
  private pendingSourceAnchor: string = '';
  private anchorRestoreScheduled: boolean = false;
  private pendingScroll: SourceManagementScrollState | undefined;
  private scrollRestoreEpoch: number = 0;
  private firstVisibleListIndex: number = 0;
  private lastProjectionFilterKey: string = '';
  private verificationFilterRevision: number = 0;
  private verificationTextMetrics: ReaderSourceTextMetrics | undefined;
  private verificationTextOptions: SourceTextOptions | undefined;
  private verificationTextRowId: string = '';
  private verificationTextFrameKey: string = '';
  private verificationReservedTextMetrics: ReaderSourceTextMetrics | undefined;
  private verificationReservedTextFrameKey: string = '';
  private verificationTextProjectionRevision: number = 0;
  private headerTopAlignmentScheduled: boolean = false;

  readonly host: SourceManagementListHost;
  readonly filterInputs: SourceManagementListFilters;
  private readonly view: SourceManagementListView;

  constructor(view: SourceManagementListView) {
    this.view = view;
    this.host = view.host;
    this.filterInputs = view.filters;
  }

  paint(): SourceManagementListPaint { return this.view.paint(); }
  hasReadableSources(): boolean { return this.paint().hasReadableSources; }
  projectedSourceCount(): number { return this.paint().projectedSourceCount; }
  statusCounts(): SourceV9Counts { return this.paint().statusCounts; }
  filterHeight(): number { return this.layoutBudget().filterHeight; }
  batchSelectionCount(): number { return this.paint().batchSourceIds.length; }
  hasPendingReadRecovery(): boolean { return this.view.readback.pendingRecovery(); }


  mountTypography(options: SourceTextOptions | undefined): SourceTextOptions | undefined {
    if (options !== undefined || (this.host.opening.verificationOpening() ?? '').length === 0 || !ReaderUIVerificationProbe.enabled()) return options;
    const metrics = new ReaderSourceTextMetrics('');
    this.view.typography.startFilter();
    this.verificationTextMetrics = metrics;
    this.view.typography.startReadback();
    this.verificationTextOptions = (role: string, sourceId?: string, text?: string): TextOptions | undefined => {
      if (!this.host.opening.mounted() || this.verificationTextMetrics !== metrics || !ReaderUIVerificationProbe.enabled() ||
        text === undefined) return undefined;
      const measuredRole = role === 'chip/全部' ? 'status/all' : role;
      if (sourceId !== undefined && sourceId === this.paint().verificationReservedTextRowId &&
        SOURCE_RESERVED_TEXT_ROLES.includes(measuredRole)) {
        try { return this.verificationReservedTextMetrics?.track(measuredRole, text); }
        catch (_unavailable) { return undefined; }
      }
      if (sourceId !== undefined && sourceId !== this.verificationTextRowId) return undefined;
      if (!SOURCE_TEXT_ROLES.includes(measuredRole) && measuredRole !== 'row/login') return undefined;
      try { return metrics.track(measuredRole, text); } catch (_unavailable) { return undefined; }
    };
    return this.verificationTextOptions;
  }

  retireTypography(): boolean {
    if (this.verificationTextMetrics === undefined) return false;
    this.verificationTextMetrics = undefined;
    this.view.typography.retireReadback();
    this.verificationTextOptions = undefined;
    this.view.typography.retireFilter();
    this.verificationTextRowId = '';
    this.verificationTextFrameKey = '';
    this.verificationReservedTextMetrics = undefined;
    this.paint().verificationReservedTextRowId = '';
    this.verificationReservedTextFrameKey = '';
    return true;
  }

  hasTypographyProbe(): boolean { return this.verificationTextMetrics !== undefined; }
  hasReservedTypographyProbe(): boolean { return this.verificationReservedTextMetrics !== undefined; }
  hasTypographyLayoutOptions(): boolean { return this.verificationTextOptions !== undefined; }

  typographyOptions(role: string, label: string): TextOptions | undefined {
    return this.verificationTextOptions?.(role, undefined, label);
  }

  verificationFooterText(): SourceTextLayoutLabel[] {
    return this.verificationTextMetrics?.readTracked(['footer/add']) ?? [];
  }

  verificationTitleId(sourceId: string): string {
    return this.verificationTextOptions !== undefined && sourceId === this.verificationTextRowId ? 'reader-source-text-row-title' : '';
  }

  listScroller(): Scroller { return this.sourceScroller; }
  listDataSource(): IDataSource { return this.sourceDataSource; }
  listEditingId(): string { return this.editingScroll.id; }
  ellipsisMode(): EllipsisMode { return this.metadataEllipsisMode; }

  attachList(): void {
    this.editingScroll.mount(this.host.native.getUIContext(), this.host.native.editingHost(), this.sourceScroller,
      (): number => this.host.native.geometry().content.startInset);
    this.listMounted = true;
    if (this.pendingScroll === undefined && this.pendingSourceAnchor.length === 0) {
      try { this.sourceScroller.scrollEdge(Edge.Top); } catch (_unbound) {}
    } else this.scheduleSourceAnchorRestore();
  }

  updateListLayout(): void {
    this.host.native.editingHost().refresh();
    this.scheduleSourceAnchorRestore();
  }

  detachList(): void {
    this.cancelRowPress();
    this.editingScroll.unmount();
    this.listMounted = false;
  }

  updateVisibleIndex(start: number): void {
    if (!this.listMounted || this.pendingScroll !== undefined || this.pendingSourceAnchor.length > 0) return;
    // The permanent filter header is the first native ListItem.
    this.firstVisibleListIndex = Math.max(0, start);
  }

  publicToggleFixtureId(sourceId: string): string {
    return (this.host.opening.verificationOpening() ?? '').length > 0 && ReaderUIVerificationProbe.enabled() &&
      this.projectedSources.length === 1 && this.projectedSources[0].sourceId === sourceId &&
      sourceVerificationToggleAnchor(this.projectedSources[0]) > 0 ? 'reader-source-public-toggle-fixture' : '';
  }

  startScrollRestore(view: SourceManagementViewState | undefined): void {
    this.pendingScroll = copySourceManagementScroll(view?.scroll);
    this.pendingSourceAnchor = this.pendingScroll?.anchorId ?? view?.anchorSourceId ?? '';
  }

  retireScroll(): void {
    this.listMounted = false;
    this.cancelScrollRestore();
    this.pendingSourceAnchor = '';
    this.anchorRestoreScheduled = false;
  }

  visibleIds(): string[] {
    return this.projectedSources.map((source: BookSource): string => source.sourceId);
  }

  batchTransition(): TransitionEffect {
    const fade = TransitionEffect.OPACITY;
    if (this.host.presentation.reduceMotion()) return fade.animation(readerMotionAnimateParam('app.navigation.tab', true));
    return fade.combine(TransitionEffect.translate({ y: 4 }))
      .animation(readerMotionAnimateParam('app.navigation.tab', false));
  }

  endBatch(): void {
    this.host.presentation.setBatchMode(false);
    this.paint().batchSourceIds = [];
    this.host.focus.completeV9ListReturn('batch');
  }

  visibleBatchSelected(): boolean {
    return this.projectedSources.length > 0 && this.visibleIds().every((id: string): boolean => this.paint().batchSourceIds.includes(id));
  }

  toggleVisibleBatch(): void {
    if (!this.host.opening.managementInputIsCurrent() || !this.host.presentation.batchMode()) return;
    const visible = this.visibleIds();
    this.paint().batchSourceIds = this.visibleBatchSelected() ?
      this.paint().batchSourceIds.filter((id: string): boolean => !visible.includes(id)) :
      Array.from(new Set<string>(this.paint().batchSourceIds.concat(visible)));
  }

  toggleBatchSource(source: BookSource, checked: boolean): void {
    if (!this.host.presentation.batchMode() || !this.sourceRowIsCurrent(source, this.host.opening.temporaryBackIdentity())) return;
    const previous = this.paint().batchSourceIds.includes(source.sourceId);
    if (checked === previous) return;
    this.paint().batchSourceIds = checked ? this.paint().batchSourceIds.concat([source.sourceId]) :
      this.paint().batchSourceIds.filter((id: string): boolean => id !== source.sourceId);
  }

  private rowPressKey(source: BookSource, part: string): string {
    return `${source.sourceId}\u0000${part}`;
  }

  rowPressed(source: BookSource, part: string): boolean {
    return this.paint().pressedRowKey === this.rowPressKey(source, part);
  }

  cancelRowPress(): void { this.delayedPress.cancel(); }

  rowPressTouch(source: BookSource, part: string, event: TouchEvent): void {
    this.delayedPress.observe(event, this.rowPressKey(source, part), true);
  }

  scheduleSourceAnchorRestore(): void {
    if (!this.host.opening.managementOpeningIsCurrent() || !this.listMounted || this.anchorRestoreScheduled ||
      (this.pendingScroll === undefined && this.pendingSourceAnchor.length === 0) || this.sourceAnchorReadPending()) return;
    if (!this.sourceReturnFiltersMatch()) { this.cancelScrollRestore(); return; }
    const pending = this.pendingScroll;
    if (pending !== undefined && pending.filterKey !== this.currentFilterKey()) { this.cancelScrollRestore(); return; }
    const identity = this.host.opening.temporaryBackIdentity(), epoch = ++this.scrollRestoreEpoch;
    this.anchorRestoreScheduled = true;
    const current = (): boolean => this.host.opening.managementOpeningIsCurrent() && this.listMounted &&
      identity === this.host.opening.temporaryBackIdentity() && epoch === this.scrollRestoreEpoch && this.sourceReturnFiltersMatch();
    try {
      this.host.native.getUIContext().postFrameCallback(new ReaderPostLayoutFrame(this.host.native.getUIContext(), (): void => {
        if (!current()) return;
        if (this.sourceAnchorReadPending()) { this.anchorRestoreScheduled = false; return; }
        const sourceId = pending?.anchorId ?? this.pendingSourceAnchor;
        if (sourceId.length === 0 || this.projectedSources.length === 0) {
          try {
            if (sourceId.length === 0 && pending !== undefined && this.projectedSources.length > 0 &&
              pending.layoutKey === this.scrollLayoutKey()) {
              this.sourceScroller.scrollTo({ xOffset: 0, yOffset: pending.offset, animation: false });
            } else this.sourceScroller.scrollEdge(Edge.Top);
          } catch (_unbound) {}
          this.cancelScrollRestore();
          return;
        }
        const exact = this.projectedSources.findIndex((source: BookSource): boolean => source.sourceId === sourceId);
        const fallback = pending === undefined ? this.host.view.initialViewState()?.anchorFallbackIndex ?? -1 : pending.firstIndex - 1;
        const index = exact >= 0 ? exact : Math.min(Math.max(0, fallback), this.projectedSources.length - 1);
        const targetId = this.projectedSources[index].sourceId;
        try { this.sourceScroller.scrollToIndex(index + 1, false, ScrollAlign.START); }
        catch (_unbound) { this.cancelScrollRestore(); return; }
        this.host.native.getUIContext().postFrameCallback(new ReaderPostLayoutFrame(this.host.native.getUIContext(), (): void => {
          if (!current()) return;
          try {
            const latest = this.projectedSources.findIndex((source: BookSource): boolean => source.sourceId === sourceId);
            const latestIndex = latest >= 0 ? latest : Math.min(Math.max(0, fallback), this.projectedSources.length - 1);
            if (latestIndex < 0) this.sourceScroller.scrollEdge(Edge.Top);
            else if (latestIndex !== index || this.projectedSources[index]?.sourceId !== targetId) {
              this.sourceScroller.scrollToIndex(latestIndex + 1, false, ScrollAlign.START);
            } else {
              const rect = this.sourceScroller.getItemRect(index + 1);
              const desired = pending !== undefined && pending.layoutKey === this.scrollLayoutKey() ?
                pending.itemY : readerScrollStartOffset(this.host.native.scrollLayout());
              if (rect.height > 0 && Number.isFinite(rect.y)) this.sourceScroller.scrollBy(0, rect.y - desired);
              this.firstVisibleListIndex = index + 1;
            }
          } catch (_unbound) {}
          this.cancelScrollRestore();
          this.observeRestoredScroll(pending);
        }));
      }));
    } catch (_unmounted) { this.cancelScrollRestore(); }
  }

  currentFilterKey(): string {
    return sourceManagementFilterKey({ searchQuery: this.filterInputs.searchQuery(), status: this.filterInputs.statusValue(),
      category: this.filterInputs.categoryValue(), group: this.filterInputs.groupValue() });
  }

  private scrollLayoutKey(): string {
    const metrics = ReaderWindowCoordinator.metrics();
    // Opening and closing the keyboard in Tools advances the shared window
    // revision even when the parent returns to the same layout.
    return JSON.stringify([this.host.native.contentFrame().width, this.host.native.fontScale(), this.host.presentation.expandedLayout(),
      metrics.windowRect.height, metrics.densityPixels,
      readerInteractiveSafeTop(metrics), readerStableInteractiveSafeBottom(metrics)]);
  }

  cancelScrollRestore(): void {
    this.scrollRestoreEpoch += 1;
    this.pendingScroll = undefined;
    this.pendingSourceAnchor = '';
    this.anchorRestoreScheduled = false;
  }

  readCurrentScroll(): SourceManagementScrollState | undefined {
    if (!this.host.opening.managementOpeningIsCurrent() || !this.listMounted || this.pendingScroll !== undefined ||
      this.pendingSourceAnchor.length > 0 || this.anchorRestoreScheduled) return undefined;
    try {
      const offset = this.sourceScroller.currentOffset();
      if (offset === undefined || !Number.isFinite(offset.yOffset)) return undefined;
      const firstIndex = Math.max(0, this.firstVisibleListIndex);
      const source = firstIndex > 0 ? this.projectedSources[firstIndex - 1] : undefined;
      const itemY = source === undefined ? 0 : this.sourceScroller.getItemRect(firstIndex).y;
      if (!Number.isFinite(itemY)) return undefined;
      return { anchorId: source?.sourceId ?? '', firstIndex, itemY,
        offset: offset.yOffset, filterKey: this.currentFilterKey(), layoutKey: this.scrollLayoutKey() };
    } catch (_unbound) {
      return undefined;
    }
  }

  captureScroll(trigger: string): void {
    const measured = this.readCurrentScroll();
    if (measured === undefined) return;
    this.observeVerificationScroll(trigger, measured);
  }

  private observeRestoredScroll(saved?: SourceManagementScrollState): void {
    if (!ReaderUIVerificationProbe.enabled() || this.host.opening.verificationOpening().length === 0) return;
    try {
      const context = this.host.native.getUIContext();
      context.postFrameCallback(new ReaderPostLayoutFrame(context, (): void => {
        const measured = this.readCurrentScroll();
        if (measured !== undefined) this.observeVerificationScroll('restored', measured, saved);
      }));
    } catch (_unmounted) {}
  }

  sourceAnchorReadPending(): boolean {
    const fact = this.host.view.operation().readFacts?.fact;
    return fact === 'loading' || fact === 'refreshing' || (fact === undefined && this.host.view.statusKind() === 'loading');
  }

  private sourceReturnFiltersMatch(): boolean {
    const initial = this.host.view.initialViewState();
    return initial !== undefined && initial.searchQuery === this.filterInputs.searchQuery() && initial.status === this.filterInputs.statusValue() &&
      initial.category === this.filterInputs.categoryValue() && initial.group === this.filterInputs.groupValue();
  }

  isFirstSource(source: BookSource): boolean { return this.paint().firstSourceId === source.sourceId; }

  isLastSource(source: BookSource): boolean {
    return this.paint().lastSourceId === source.sourceId;
  }

  currentSourceRow(source: BookSource): BookSource {
    // The retained row must observe the owner publication that changes its content slots.
    return (this.host.view.sources() ?? this.projectedSources).find(
      (current: BookSource): boolean => current.sourceId === source.sourceId) ?? source;
  }

  sourceDomain(source: BookSource): string {
    return sourceV9DisplayUrl(source.baseUrl);
  }

  loginInk(source: BookSource): string {
    return readerAppColor(source.loginState === 'verified' ? 'app.status.good' :
      source.loginState === 'expired' ? 'app.sourceUi.danger' : 'app.sourceUi.muted', this.host.presentation.appThemeScheme());
  }

  loginSurface(source: BookSource): string {
    return readerAppColor(source.loginState === 'verified' ? 'app.status.goodSoft' :
      source.loginState === 'expired' ? 'app.sourceUi.dangerSurface' : 'app.sourceUi.field', this.host.presentation.appThemeScheme());
  }

  private sourceRowIsCurrent(source: BookSource, opening: string): boolean {
    if (!this.host.opening.managementBackIsCurrent(opening) || this.host.opening.isInputAllowed() === false || this.host.presentation.groupOpen()) return false;
    const current = this.projectedSources.find((candidate: BookSource): boolean => candidate.sourceId === source.sourceId);
    return current !== undefined && this.sourceRenderKey(current) === this.sourceRenderKey(source);
  }

  sourceRowCommand(source: BookSource, command: 'check' | 'login'): () => void {
    const opening = this.host.opening.temporaryBackIdentity();
    return (): void => {
      if (!this.sourceRowIsCurrent(source, opening)) return;
      if (command === 'check') {
        if (this.sourceDetectEnabled(source.sourceId)) this.host.actions.onDetectSource(source.sourceId);
      } else if (source.loginUrl !== undefined && this.sourceActionEnabled() && source.checkState !== 'checking') {
        this.host.actions.onLoginSource(source.sourceId, source.loginUrl);
      }
    };
  }

  sourceRowToggle(source: BookSource): (next: boolean) => void {
    const opening = this.host.opening.temporaryBackIdentity();
    return (next: boolean): void => {
      if (this.sourceRowIsCurrent(source, opening)) this.host.actions.onToggleSource(source.sourceId, next);
    };
  }

  offlineDetectBadgeId(source: BookSource): string {
    if (source.offlineDetectReportVersion === undefined || !ReaderUIVerificationProbe.enabled()) return '';
    if (source.checkState === 'unchecked') return 'reader-source-offline-detect-ready';
    if (source.checkState === 'failed') return 'reader-source-offline-detect-failed';
    return '';
  }

  verificationRowActionsCurrent(source: BookSource): boolean {
    return this.verificationTextOptions !== undefined && source.sourceId === this.verificationTextRowId &&
      this.projectedSources.length === 1 && sourceVerificationRowActions(source) !== undefined;
  }

  sourceSwitchValue(sourceId: string, fallback: boolean): boolean {
    // An unchanged LazyForEach key retains this control across owner publications.
    const current = (this.host.view.sources() ?? this.projectedSources).find((source: BookSource): boolean => source.sourceId === sourceId);
    return current?.enabled ?? fallback;
  }

  sourceSwitchName(sourceId: string, fallback: string): string {
    return this.projectedSources.find((source: BookSource): boolean => source.sourceId === sourceId)?.name ?? fallback;
  }

  sourceToggleBusy(): boolean {
    return this.host.view.operation().original?.busy === true || this.host.view.operation().receipt?.facts.fact === 'refreshing';
  }

  sourceActionEnabled(): boolean {
    return this.host.view.inputEnabled() && this.host.opening.managementBackIsCurrent(this.host.opening.temporaryBackIdentity()) && this.host.opening.isInputAllowed() !== false &&
      !this.host.presentation.groupOpen() && this.host.view.operation().original?.blocked !== true && this.host.view.operation().receipt?.receipt.confirmation !== 'unknown';
  }

  sourceActionLabel(source: BookSource, action: string, enabled: boolean, busy: boolean): string {
    const entity = source.name.trim().length > 0 ? source.name : source.sourceId;
    return `${entity}，${action}${busy ? '，忙碌' : enabled ? '' : '，暂不可用'}`;
  }

  sourceDetectEnabled(sourceId: string): boolean {
    if (!this.host.view.inputEnabled() || !this.host.opening.managementBackIsCurrent(this.host.opening.temporaryBackIdentity()) || this.host.opening.isInputAllowed() === false || this.host.presentation.groupOpen()) return false;
    const current = this.host.view.sources().find((candidate: BookSource): boolean => candidate.sourceId === sourceId);
    // Diagnostic intent neither confirms nor replays an unresolved source write.
    return current !== undefined && current.checkState !== 'checking';
  }

  batchActionInk(action: SourceV9ListAction): string {
    return readerAppColor(action === 'delete' ? 'app.sourceUi.danger' : action === 'disable' ? 'TOK_MUTED' :
      action === 'move' ? 'TOK_INK' : 'app.sourceUi.primary', this.host.presentation.appThemeScheme());
  }

  sourceAddIcon(): Resource {
    return this.host.presentation.appThemeScheme() === 'night' ? $r('app.media.source_add_theme_night') : $r('app.media.source_add');
  }

  importFocusId(identity: string): string { return `${identity}:import:footer`; }

  actionBottomInset(actionHeight: number = this.footerActionHeight()): number {
    if (this.host.native.readerWindowMetricsRevision() < 0) { return TOK_SPACE_MD; }
    const metrics = ReaderWindowCoordinator.metrics();
    const safeBottom = readerFloatingBarBottomInset(metrics, TOK_SPACE_MD);
    const density = metrics.densityPixels;
    if (!Number.isFinite(density) || density <= 0) return safeBottom;
    // Pay the final fractional pixel in the transparent inset of the bottom-aligned slot.
    const extentPx = (actionHeight + TOK_SPACE_SM + safeBottom) * density;
    if (!Number.isSafeInteger(Math.ceil(extentPx))) return safeBottom;
    const epsilon = Number.EPSILON * Math.max(1, extentPx) * 4;
    const extraPx = Math.max(0, Math.ceil(extentPx - epsilon) - extentPx);
    return safeBottom + extraPx / density;
  }

  footerFallbackHeight(): number {
    const actionHeight = this.footerActionHeight();
    return actionHeight + TOK_SPACE_SM + this.actionBottomInset(actionHeight);
  }

  footerControlHeight(): number {
    return readerScaledControlHeight(44, resolveReaderLabeledIconActionSpec('source-management-add').text.lineHeightFp ?? 20, this.host.native.fontScale());
  }

  private footerContentWidth(): number {
    const input = new ReaderPageGeometryInput(ReaderWindowCoordinator.metrics());
    input.originX = this.host.presentation.embeddedWide() ? this.host.native.originX() : undefined;
    input.viewportWidth = this.host.native.viewportWidth();
    input.viewportHeight = this.host.native.viewportHeight();
    input.contentMaxWidth = readerStandardPageSpec('sourceManagement').maxWidth;
    input.contentHorizontalPadding = 19;
    input.contentHorizontalSafeArea = 'interactive';
    return resolveReaderPageGeometry(input).content.frame.width;
  }

  footerManageWidth(): number {
    return Math.max(112, Math.ceil(4 * 16 * this.host.native.fontScale()) + 28);
  }

  footerStacked(): boolean {
    const scale = this.host.native.fontScale();
    const add = resolveReaderLabeledIconActionSpec('source-management-add');
    // Both current labels are four full-width CJK glyphs in their shared font.
    const addWidth = Math.ceil(add.text.fontSizeFp * scale) * '导入书源'.length + add.iconSize + add.gap;
    return this.footerContentWidth() < this.footerManageWidth() + TOK_SPACE_CONTROL_INLINE + addWidth;
  }

  footerActionHeight(): number {
    if (this.host.presentation.batchMode()) return Math.max(54, Math.ceil(37 * this.host.native.fontScale()));
    const controlHeight = this.footerControlHeight();
    return this.footerStacked() ? controlHeight * 2 + TOK_SPACE_CONTROL_INLINE : controlHeight;
  }

  layoutBudget(source?: BookSource): SourceManagementLayout {
    const scale = this.host.native.fontScale();
    return resolveSourceManagementLayout({ availableWidth: this.host.native.contentFrame().width, fontScale: scale,
      hasLogin: !this.host.presentation.batchMode() && source?.loginUrl !== undefined && source.loginUrl.trim().length > 0,
      detectWidth: this.host.presentation.batchMode() ? 0 : 28, batchStatusWidth: this.host.presentation.batchMode() ? Math.ceil(35 * scale) : 0,
      actionWidth: 58, actionHeight: this.host.presentation.batchMode() ? 34 : 44,
      loginHeight: 26,
      filterHeight: 40, footerHeight: this.footerActionHeight(),
      titleLineHeight: TYPE_SOURCE_MANAGEMENT_ROW_TITLE.lineHeightFp ?? TYPE_SOURCE_MANAGEMENT_ROW_TITLE.fontSizeFp * 1.5,
      metaLineHeight: TYPE_SOURCE_MANAGEMENT_ROW_URL.lineHeightFp ?? TYPE_SOURCE_MANAGEMENT_ROW_URL.fontSizeFp * 1.5 });
  }

  sourceRowKey(source: BookSource): string { return source.sourceId; }

  sourceRenderKey(source: BookSource): string {
    return `source-${source.sourceId}-${source.name}-${source.baseUrl}-${source.group ?? ''}-${source.category}-` +
      `${source.loginUrl ?? ''}-${source.sourceVersion ?? ''}-${source.enabled}-${source.checkState ?? 'unchecked'}-` +
      `${source.checkMessage ?? ''}-${source.loginState ?? 'unknown'}-${source.checkReports?.[0]?.report.traceId ?? ''}${source.sourceId === this.paint().verificationReservedTextRowId ? '-reserved-text' : ''}`;
  }

  verificationRowTextId(sourceId: string, textId: string): string {
    return this.verificationTextOptions !== undefined &&
      (sourceId === this.verificationTextRowId || sourceId === this.paint().verificationReservedTextRowId) ? textId : '';
  }

  sourceBadgeLabel(source: BookSource): string {
    if (source.checkState === 'checking') return '检测中';
    const tone = sourceV9ReportTone(source);
    if (tone === 'partial' || tone === 'content') return '检测通过';
    if (tone === 'earlyFailure' || tone === 'deepFailure') return '检测失败';
    return '尚无有效检测报告';
  }

  verificationRowId(sourceId: string): string {
    if (this.host.opening.verificationOpening().length === 0 || !ReaderUIVerificationProbe.enabled()) return '';
    return `reader-source-row-${SourceVerificationAnchors.identify(sourceId)}`;
  }

  hasFilteredEmpty(): boolean {
    return this.paint().hasReadableSources && this.paint().projectedSourceCount === 0 &&
      !this.view.readback.loading() && !this.view.readback.pendingRecovery();
  }

  verificationProjectionState(): SourceProjectionState {
    if (this.view.readback.pendingRecovery()) return 'recovery';
    if (this.view.readback.loading()) return 'loading';
    if (this.view.readback.emptyReadFailure()) return 'readFailure';
    if (this.host.view.sources().length === 0) return 'empty';
    if (this.hasFilteredEmpty()) return 'filteredEmpty';
    return 'rows';
  }

  observeVerificationProjection(trigger: SourceProjectionTrigger): void {
    if (!this.host.opening.mounted() || !ReaderUIVerificationProbe.enabled()) return;
    const owner = sourceVerificationOpening(this.host.opening.verificationOpening());
    if (owner === undefined) return;
    const status = sourceVerificationStatus(this.filterInputs.statusValue());
    const observation: SourceProjectionObservation = { owner, trigger, status, category: this.filterInputs.categoryValue(),
      textProjectionRevision: ++this.verificationTextProjectionRevision,
      allGroups: this.filterInputs.groupValue() === '全部分组', groupIndex: this.filterInputs.groupChoices().indexOf(this.filterInputs.groupValue()),
      filterRevision: this.verificationFilterRevision, queryLength: this.filterInputs.searchQuery().length,
      count: this.host.view.sources().length, projected: this.projectedSources.length,
      firstAnchor: SourceVerificationAnchors.identify(this.projectedSources[0]?.sourceId ?? ''),
      rowActions: this.host.view.sources().length === 1 && this.projectedSources.length === 1 ?
        sourceVerificationRowActions(this.projectedSources[0]) : undefined,
      readGeneration: this.host.view.operation().readFacts?.generation ?? 0, readFact: this.host.view.operation().readFacts?.fact ?? 'idle',
      state: this.verificationProjectionState(), recovery: this.view.readback.recoveryFacts() };
    ReaderUIVerificationProbe.emit('source.projection', 'business', observation);
    if (this.verificationTextMetrics !== undefined) this.scheduleVerificationTextLayout();
    if (this.verificationReservedTextMetrics !== undefined) this.scheduleVerificationTextLayout(true);
    this.view.typography.scheduleReadText();
    if (this.verificationTextMetrics !== undefined) this.view.typography.scheduleOperationText();
    if (observation.state !== 'rows' || observation.readFact !== 'current' || this.projectedSources.length !== 1 ||
      !this.sourceActionEnabled() || this.sourceToggleBusy()) return;
    const source = this.projectedSources[0];
    const detect = sourceVerificationOfflineDetectIdentity(source, owner, observation.readGeneration);
    if (detect !== undefined) ReaderUIVerificationProbe.emit('source.row-detect', 'business', {
      owner: detect.owner, anchor: detect.anchor, readGeneration: detect.readGeneration,
      definition: detect.definition, reportVersion: detect.reportVersion, phase: 'ready',
    });
    const anchor = sourceVerificationToggleAnchor(source);
    if (anchor === 0) return;
    const toggle: SourceToggleReadyObservation = { phase: 'ready', owner, anchor, enabled: source.enabled,
      filterRevision: observation.filterRevision, readGeneration: observation.readGeneration };
    ReaderUIVerificationProbe.emit('source.toggle', 'business', toggle);
  }

  observeVerificationScroll(trigger: string, scroll: SourceManagementScrollState, saved?: SourceManagementScrollState): void {
    if (!ReaderUIVerificationProbe.enabled()) return;
    const owner = sourceVerificationOpening(this.host.opening.verificationOpening());
    if (owner === undefined) return;
    try {
      const observation: SourceScrollObservation = { owner, trigger, filterRevision: this.verificationFilterRevision,
        itemIndex: scroll.firstIndex, anchor: SourceVerificationAnchors.identify(scroll.anchorId),
        lastAnchor: SourceVerificationAnchors.identify(this.projectedSources[this.projectedSources.length - 1]?.sourceId ?? ''),
        itemYVp: scroll.itemY, offsetVp: scroll.offset, atEnd: this.sourceScroller.isAtEnd(),
        viewportWidthVp: this.host.native.viewportWidth(), viewportHeightVp: this.host.native.viewportHeight(),
        layoutMatchesSaved: saved !== undefined && saved.layoutKey === scroll.layoutKey,
        filterMatchesSaved: saved !== undefined && saved.filterKey === scroll.filterKey };
      ReaderUIVerificationProbe.emit('source.scroll', 'business', observation);
    } catch (_unmounted) {}
  }

  verificationTextLayoutScope(scope: 'default' | 'group' | 'surface' | 'reserved' = 'default'): SourceTextLayoutScope | undefined {
    const owner = sourceVerificationOpening(this.host.opening.verificationOpening());
    const read = this.host.view.operation().readFacts;
    const window = ReaderWindowCoordinator.metrics();
    if (!ReaderUIVerificationProbe.enabled() || !owner || this.verificationTextProjectionRevision < 1 ||
      !this.host.opening.managementOpeningIsCurrent() || (scope !== 'group' && this.host.presentation.groupOpen()) || this.filterInputs.groupClosing() ||
      this.host.native.viewportWidth() <= 0 || this.host.native.viewportHeight() <= 0 || !window.ready || !window.keyboardArea.available || window.keyboardArea.visible) {
      return undefined;
    }
    if (scope === 'reserved') {
      if (read?.fact !== 'current' || this.verificationProjectionState() !== 'rows' ||
        this.paint().verificationReservedTextRowId.length === 0 ||
        this.verificationReservedTypographyRow(this.projectedSources) !== this.paint().verificationReservedTextRowId) return undefined;
    } else if (scope !== 'surface' && (read?.fact !== 'current' || this.verificationProjectionState() !== 'rows' || !this.filterInputs.filtersInDefaultState() ||
      this.verificationTextRowId.length === 0 || this.projectedSources[0]?.sourceId !== this.verificationTextRowId)) return undefined;
    const density = window.densityPixels;
    if (!Number.isFinite(density) || density <= 0 || !Number.isFinite(window.systemFontScale) || window.systemFontScale <= 0)
      return undefined;
    return { owner, textProjectionRevision: this.verificationTextProjectionRevision,
      filterRevision: this.verificationFilterRevision, readGeneration: read?.generation ?? 0,
      windowRevision: window.revision, widthVp: window.windowRect.width, heightVp: window.windowRect.height,
      density, systemFontScale: window.systemFontScale, fontScale: this.host.native.fontScale(),
      rowAnchor: SourceVerificationAnchors.identify(scope === 'reserved' ? this.paint().verificationReservedTextRowId : this.verificationTextRowId) };
  }

  scheduleVerificationTextLayout(reserved: boolean = false): void {
    try {
      const scopeKind: 'default' | 'reserved' = reserved ? 'reserved' : 'default';
      const scope = this.verificationTextLayoutScope(scopeKind);
      const metrics = reserved ? this.verificationReservedTextMetrics : this.verificationTextMetrics;
      if (scope === undefined || metrics === undefined) return;
      const key = JSON.stringify(scope);
      if (key === (reserved ? this.verificationReservedTextFrameKey : this.verificationTextFrameKey)) return;
      const context = this.host.native.getUIContext();
      let allowNextFrame = true;
      const observe = (): void => {
        try {
          if ((reserved ? this.verificationReservedTextMetrics : this.verificationTextMetrics) !== metrics ||
            (reserved ? this.verificationReservedTextFrameKey : this.verificationTextFrameKey) !== key ||
            JSON.stringify(this.verificationTextLayoutScope(scopeKind)) !== key) return;
          const labels = metrics.readTracked();
          const first = this.projectedSources.length === 1 ? this.projectedSources[0] : undefined;
          const count = reserved ? SOURCE_RESERVED_TEXT_ROLES.length :
            SOURCE_TEXT_ROLES.length + (first !== undefined && this.verificationRowActionsCurrent(first) ? 1 : 0);
          if (allowNextFrame && (labels.length < count || labels.some(label => label.lines.length === 0))) {
            allowNextFrame = false;
            context.postFrameCallback(new ReaderPostLayoutFrame(context, observe));
            return;
          }
          ReaderUIVerificationProbe.emit('source.text-layout', 'business', {
            owner: scope.owner, textProjectionRevision: scope.textProjectionRevision,
            filterRevision: scope.filterRevision, readGeneration: scope.readGeneration,
            windowRevision: scope.windowRevision, widthVp: scope.widthVp, heightVp: scope.heightVp,
            density: scope.density, systemFontScale: scope.systemFontScale, fontScale: scope.fontScale,
            rowAnchor: scope.rowAnchor, labels,
          });
        } catch (_detached) {}
      };
      context.postFrameCallback(new ReaderPostLayoutFrame(context, observe));
      if (reserved) {
        this.verificationReservedTextFrameKey = key;
      } else {
        this.verificationTextFrameKey = key;
        if (this.view.typography.filtersPrepared()) this.view.typography.measureInitialFilters();
      }
    } catch (_detached) {}
  }

  onBatchApplied(): void { this.endBatch(); }

  onUngroupedBatch(): void {
    if (!this.host.opening.mounted() || this.host.view.ungroupedBatchIds().length === 0) return;
    this.filterInputs.chooseUngrouped();
    this.filterInputs.closeMore();
    this.host.presentation.setBatchMode(true);
    this.paint().batchSourceIds = this.host.view.ungroupedBatchIds().slice();
    this.rebuildSourceProjection('group');
  }

  scheduleProjectionRefresh(): void {
    // 同一轮内多次 owner 更新会各自触发全量重建；合并到下一帧只做一次。
    if (this.projectionRebuildPending) return;
    this.projectionRebuildPending = true;
    setTimeout((): void => {
      this.projectionRebuildPending = false;
      if (!this.host.opening.mounted()) return;
      this.rebuildSourceProjection('owner-update');
    }, 0);
  }

  rebuildSourceProjection(trigger: SourceProjectionTrigger): void {
    const key = this.currentFilterKey();
    const changed = this.lastProjectionFilterKey.length > 0 && this.lastProjectionFilterKey !== key;
    if (changed || this.verificationFilterRevision === 0) this.verificationFilterRevision += 1;
    this.lastProjectionFilterKey = key;
    const projection = this.filterInputs.project();
    this.paint().statusCounts = projection.counts;
    this.paint().hasReadableSources = this.host.view.sources().some(sourceV9Supports);
    const projected = projection.rows;
    if (this.host.presentation.batchMode()) {
      const available = new Set<string>(this.host.view.sources().filter(sourceV9Supports)
        .map((source: BookSource): string => source.sourceId));
      this.paint().batchSourceIds = this.paint().batchSourceIds.filter((id: string): boolean => available.has(id));
    }
    if (this.verificationTextMetrics !== undefined && this.verificationTextRowId.length === 0 && this.filterInputs.filtersInDefaultState())
      this.verificationTextRowId = projected[0]?.sourceId ?? '';
    if (this.verificationTextMetrics !== undefined) {
      const reservedRow = this.verificationReservedTypographyRow(projected);
      if (reservedRow !== this.paint().verificationReservedTextRowId) {
        this.verificationReservedTextMetrics = reservedRow.length > 0 ? new ReaderSourceTextMetrics(reservedRow) : undefined;
        this.verificationReservedTextFrameKey = '';
        this.paint().verificationReservedTextRowId = reservedRow;
      }
    }
    this.projectedSources = projected;
    this.paint().firstSourceId = projected[0]?.sourceId ?? '';
    this.paint().lastSourceId = projected[projected.length - 1]?.sourceId ?? '';
    this.paint().projectedSourceCount = projected.length;
    this.sourceDataSource.replace(projected);
    if (changed && this.host.opening.mounted()) {
      this.cancelScrollRestore();
      this.firstVisibleListIndex = 0;
      // 过滤条件变化后的大列表重排不能占用点击回调的同一帧：先让本次状态提交返回，
      // 再在下一帧请求回顶，避免 800+ 行场景下主线程被连续重排阻塞。
      if (this.listMounted) {
        const scroller = this.sourceScroller;
        setTimeout((): void => {
          if (!this.host.opening.mounted() || !this.listMounted) return;
          try { scroller.scrollEdge(Edge.Top); } catch (_unbound) {}
        }, 0);
      }
    } else this.scheduleSourceAnchorRestore();
    this.observeVerificationProjection(trigger);
  }

  private verificationReservedTypographyRow(projected: BookSource[]): string {
    return sourceVerificationReservedTypographyRow(this.host.view.sources().length, projected, this.filterInputs.searchQuery(), this.filterInputs.statusValue(),
      this.filterInputs.categoryValue(), this.filterInputs.groupValue());
  }

  alignListTopAfterHeaderChange(previousTop: number): void {
    if (!this.listMounted || this.headerTopAlignmentScheduled || this.pendingScroll !== undefined ||
      this.pendingSourceAnchor.length > 0) return;
    const opening = this.host.opening.temporaryBackIdentity(), scrollEpoch = this.scrollRestoreEpoch;
    // Changing contentStartOffset updates the native boundary. The list can
    // still be at its old absolute offset after the first header measurement.
    const stillAtPreviousTop = (): boolean => {
      const first = this.sourceScroller.getItemRect(0);
      return first.height > 0 && Math.abs(first.y - previousTop) <= .5;
    };
    try {
      if (!stillAtPreviousTop()) return;
      this.headerTopAlignmentScheduled = true;
      this.host.native.getUIContext().postFrameCallback(new ReaderPostLayoutFrame(this.host.native.getUIContext(), (): void => {
        this.headerTopAlignmentScheduled = false;
        if (!this.host.opening.managementBackIsCurrent(opening) || !this.listMounted || scrollEpoch !== this.scrollRestoreEpoch ||
          this.pendingScroll !== undefined || this.pendingSourceAnchor.length > 0 ||
          Math.abs(this.host.native.geometry().content.startInset - previousTop) <= .5) return;
        try {
          if (stillAtPreviousTop()) this.sourceScroller.scrollEdge(Edge.Top);
        } catch (_unbound) {}
      }));
    } catch (_detached) {
      this.headerTopAlignmentScheduled = false;
    }
  }
}

export interface SourceManagementListOwnerSlot { readonly owner: SourceManagementListOwner; }

// Render-only inputs preserve the native ListItem builder receiver and hierarchy.
export interface SourceManagementListSurfaces {
  readonly filters: SourceManagementFiltersOwner;
  readonly recovery: SourceManagementRecoveryOwner;
}

@Builder
export function SourceManagementList($$: SourceManagementListOwnerSlot, surfaces: SourceManagementListSurfaces) {
  List({ scroller: $$.owner.listScroller() }) {
    // Filters remain ordinary scroll content; only the navigation and
    // action bars float. The list viewport extends behind both bars.
    ListItem() {
      Column() {
        SourceManagementSearchField({ owner: surfaces.filters });
        SourceManagementStatusAction({ owner: surfaces.recovery });
        SourceManagementRetainedReadFeedback({ owner: surfaces.recovery });
        SourceManagementFilters({ owner: surfaces.filters });
        SourceManagementCategoryFilter({ owner: surfaces.filters });
      }.id('reader-source-filter-block').width('100%').padding({ bottom: TOK_SPACE_CONTROL_INLINE });
    }
    if (!$$.owner.paint().hasReadableSources && !$$.owner.hasPendingReadRecovery()) {
      ListItem() {
        SourceManagementReadState({ owner: surfaces.recovery });
      }.id('reader-source-empty-state');
    }
    if ($$.owner.hasFilteredEmpty()) {
      ListItem() {
        ReaderPageState({ title: '没有匹配的书源', message: '调整搜索、状态、分类或分组',
          actionLabel: '清除筛选', actionFocusId: 'reader-source-clear-filters', onAction: (): void => $$.owner.filterInputs.clear() });
      }.id('reader-source-filtered-empty');
    }
    // LazyForEach owns an explicit data source so an empty-to-populated Core
    // load and later filter replacements can notify ArkUI after mount. A
    // reusable Repeat over a derived array retained zero stale rows on API
    // 23 even though the surrounding count text had already updated.
    LazyForEach($$.owner.listDataSource(), (source: BookSource) => {
      ListItem() {
        SourceListSourceRow({ owner: $$.owner }, source);
      }
    }, (source: BookSource): string => $$.owner.sourceRowKey(source));
  }
  .id($$.owner.listEditingId())
  .width('100%')
  .height('100%')
  .padding({ left: $$.owner.host.native.contentFrame().left, right: $$.owner.host.native.contentFrame().right })
  .contentStartOffset(readerScrollStartOffset($$.owner.host.native.scrollLayout()))
  .contentEndOffset(readerScrollEndOffset($$.owner.host.native.scrollLayout()))
  .scrollBar(BarState.Off)
  .onAppear((): void => $$.owner.attachList())
  .onAreaChange((): void => $$.owner.updateListLayout())
  .onDisAppear((): void => $$.owner.detachList())
  .onScrollIndex((start: number): void => $$.owner.updateVisibleIndex(start))
  .onScrollStart((): void => $$.owner.cancelRowPress())
  .onScrollStop((): void => $$.owner.captureScroll('settled'))
  .onTouch((event: TouchEvent): void => { if (event.type === TouchType.Down) $$.owner.cancelScrollRestore(); })
  .onWillScroll((_offset: number, _state: ScrollState, source: ScrollSource): void => {
    if (source === ScrollSource.DRAG || source === ScrollSource.OTHER_USER_INPUT || source === ScrollSource.SCROLL_BAR) {
      $$.owner.cancelRowPress();
      $$.owner.cancelScrollRestore();
      $$.owner.host.focus.cancelToolsReturnFocus('scroll');
    }
  });
}

@Builder
function SourceListSourceRow($$: SourceManagementListOwnerSlot, source: BookSource) {
  Column() {
    if ($$.owner.host.presentation.batchMode()) {
      Button({ type: ButtonType.Normal, stateEffect: false }) {
        SourceListSourceRowContent({ owner: $$.owner }, source);
      }.width('100%').padding(10)
        .attributeModifier(new ReaderPressFeedback(Color.Transparent, $$.owner.host.presentation.appThemeScheme(), 0, 0, true,
          $$.owner.rowPressed(source, 'row'), false))
        .onTouch((event: TouchEvent): void => $$.owner.rowPressTouch(source, 'row', event))
        .accessibilitySelected($$.owner.paint().batchSourceIds.includes(source.sourceId))
        .accessibilityText(source.name)
        .onClick((): void => $$.owner.toggleBatchSource($$.owner.currentSourceRow(source),
          !$$.owner.paint().batchSourceIds.includes(source.sourceId)));
    } else {
      SourceListSourceRowContent({ owner: $$.owner }, source);
    }
  }
  .id($$.owner.verificationRowId(source.sourceId))
  .width($$.owner.host.native.contentFrame().width)
  .constraintSize({ minHeight: $$.owner.layoutBudget($$.owner.currentSourceRow(source)).rowMinHeight })
  .padding($$.owner.host.presentation.batchMode() ? 0 : 10)
  .alignItems(HorizontalAlign.Start)
  .backgroundColor(readerAppColor('TOK_CARD_BG', $$.owner.host.presentation.appThemeScheme()))
  .borderRadius({ topLeft: $$.owner.isFirstSource(source) ? 14 : 0, topRight: $$.owner.isFirstSource(source) ? 14 : 0,
    bottomLeft: $$.owner.isLastSource(source) ? 14 : 0, bottomRight: $$.owner.isLastSource(source) ? 14 : 0 })
  .border({ width: { left: 1, right: 1, bottom: $$.owner.isLastSource(source) ? 1 : 0, top: 1 },
    color: readerAppColor('TOK_LINE', $$.owner.host.presentation.appThemeScheme()) })
  .clip(true);
}

@Builder
function SourceListSourceRowContent($$: SourceManagementListOwnerSlot, source: BookSource) {
  Column({ space: TOK_SPACE_XS }) {
    if ($$.owner.layoutBudget($$.owner.currentSourceRow(source)).rowForm === 'stacked-leading') {
      SourceListSourceLeading({ owner: $$.owner }, source);
      SourceListCurrentSourceInfo({ owner: $$.owner }, source);
      SourceListSourceActions({ owner: $$.owner }, source);
    } else {
      Row({ space: TOK_SPACE_XS }) {
        SourceListSourceLeading({ owner: $$.owner }, source);
        SourceListCurrentSourceInfo({ owner: $$.owner }, source);
        if ($$.owner.layoutBudget($$.owner.currentSourceRow(source)).rowForm === 'inline') {
          SourceListSourceActions({ owner: $$.owner }, source);
        }
      }.width('100%').alignItems(VerticalAlign.Center);
      if ($$.owner.layoutBudget($$.owner.currentSourceRow(source)).rowForm === 'stacked-actions') {
        SourceListSourceActions({ owner: $$.owner }, source);
      }
    }
  }
  .width('100%')
  .alignItems(HorizontalAlign.Start)
  .accessibilityLevel($$.owner.host.presentation.batchMode() ? 'no-hide-descendants' : 'auto')
  .hitTestBehavior($$.owner.host.presentation.batchMode() ? HitTestMode.None : HitTestMode.Default);
}

@Builder
function SourceListCurrentSourceInfo($$: SourceManagementListOwnerSlot, source: BookSource) {
  ForEach([$$.owner.currentSourceRow(source)], (current: BookSource): void => {
    SourceListSourceInfo({ owner: $$.owner }, current);
  }, (current: BookSource): string => $$.owner.sourceRenderKey(current));
}

@Builder
function SourceListSourceLeading($$: SourceManagementListOwnerSlot, source: BookSource) {
  if ($$.owner.host.presentation.batchMode()) {
    Stack({ alignContent: Alignment.Center }) {
      SourceV9CircleCheck({ selected: $$.owner.paint().batchSourceIds.includes(source.sourceId), interactive: false });
    }.width(SOURCE_ROW_ICON_WIDTH).height(34);
  } else {
    Stack({ alignContent: Alignment.Center }) {
      Button({ type: ButtonType.Normal, stateEffect: false }) {
        SourceV9TypeSeal({ category: source.category, paintSurface: false });
      }.width('100%').height('100%').padding(0)
        .attributeModifier(new ReaderPressFeedback(readerAppColor(source.category === 'comic' ? 'app.status.warningSoft' :
          'app.sourceUi.selected', $$.owner.host.presentation.appThemeScheme()), $$.owner.host.presentation.appThemeScheme(), 10, 10, $$.owner.sourceDetectEnabled(source.sourceId),
          $$.owner.rowPressed(source, 'leading'), false))
        .onTouch((event: TouchEvent): void => $$.owner.rowPressTouch(source, 'leading', event))
        .enabled($$.owner.sourceDetectEnabled(source.sourceId))
        .onClick($$.owner.sourceRowCommand($$.owner.currentSourceRow(source), 'check'));
    }.width(SOURCE_ROW_ICON_WIDTH).height(34).accessibilityLevel('no-hide-descendants');
  }
}

@Builder
function SourceListSourceInfo($$: SourceManagementListOwnerSlot, source: BookSource) {
  Column({ space: 3 }) {
    Text(source.name, $$.owner.host.view.textLayoutOptions()?.('row/title', source.sourceId, source.name))
      .id($$.owner.verificationTitleId(source.sourceId))
      .width('100%')
      .fontFamily(TYPE_SOURCE_MANAGEMENT_ROW_TITLE.fontFamily)
      .fontWeight(TYPE_SOURCE_MANAGEMENT_ROW_TITLE.fontWeight)
      .fontSize(TYPE_SOURCE_MANAGEMENT_ROW_TITLE.fontSizeFp)
      .maxFontScale($$.owner.host.native.fontScale())
      .lineHeight(TYPE_SOURCE_MANAGEMENT_ROW_TITLE.lineHeightFp as number)
      .fontColor(readerAppColor('TOK_INK', $$.owner.host.presentation.appThemeScheme()))
      .maxLines(1)
      .textOverflow({ overflow: TextOverflow.Ellipsis })
      .ellipsisMode($$.owner.ellipsisMode());
    Text($$.owner.sourceDomain(source), $$.owner.host.view.textLayoutOptions()?.('row/domain', source.sourceId, $$.owner.sourceDomain(source)))
      .id($$.owner.verificationRowTextId(source.sourceId, 'reader-source-text-row-domain'))
      .width('100%')
      .fontFamily(TYPE_SOURCE_MANAGEMENT_ROW_URL.fontFamily as string)
      .fontWeight(TYPE_SOURCE_MANAGEMENT_ROW_URL.fontWeight ?? 400)
      .fontSize(TYPE_SOURCE_MANAGEMENT_ROW_URL.fontSizeFp)
      .maxFontScale($$.owner.host.native.fontScale())
      .lineHeight(TYPE_SOURCE_MANAGEMENT_ROW_URL.lineHeightFp as number)
      .fontColor(readerAppColor('app.sourceUi.muted', $$.owner.host.presentation.appThemeScheme()))
      .wordBreak(WordBreak.BREAK_ALL)
      .maxLines(1)
      .textOverflow({ overflow: TextOverflow.Ellipsis })
      .ellipsisMode($$.owner.ellipsisMode());
  }
  .layoutWeight($$.owner.layoutBudget(source).rowForm === 'stacked-leading' ? 0 : 1)
  .width($$.owner.layoutBudget(source).rowForm === 'stacked-leading' ? '100%' : undefined)
  .constraintSize({ minWidth: $$.owner.layoutBudget(source).textMinWidth })
  .accessibilityGroup(true)
  .accessibilityText(`${source.name}，${readerSourceCategoryLabel(source.category)}，${source.baseUrl}`)
  .alignItems(HorizontalAlign.Start)
  .attributeModifier(new ReaderPressFeedback(Color.Transparent, $$.owner.host.presentation.appThemeScheme(), 6, 6,
    !$$.owner.host.presentation.batchMode() && $$.owner.sourceDetectEnabled(source.sourceId), $$.owner.rowPressed(source, 'info'), false))
  .onTouch((event: TouchEvent): void => { if (!$$.owner.host.presentation.batchMode()) $$.owner.rowPressTouch(source, 'info', event); })
  .onClick((): void => {
    if (!$$.owner.host.presentation.batchMode()) $$.owner.sourceRowCommand(source, 'check')();
  });
}

@Builder
function SourceListSourceActions($$: SourceManagementListOwnerSlot, source: BookSource) {
  if ($$.owner.host.presentation.batchMode()) {
    Text($$.owner.currentSourceRow(source).enabled ? '已启用' : '已停用').fontSize(11).maxLines(1)
      .fontFamily(TYPE_SOURCE_MANAGEMENT_ROW_TITLE.fontFamily)
      .fontColor(readerAppColor($$.owner.currentSourceRow(source).enabled ? 'app.sourceUi.primary' : 'app.sourceUi.muted',
        $$.owner.host.presentation.appThemeScheme()));
  } else {
    Row({ space: SOURCE_ROW_ACTION_GAP }) {
      ForEach([$$.owner.currentSourceRow(source)], (current: BookSource): void => {
        if (current.loginUrl !== undefined && current.loginUrl.trim().length > 0) SourceListLoginButton({ owner: $$.owner }, current);
        SourceListDetectButton({ owner: $$.owner }, current);
      }, (current: BookSource): string => $$.owner.sourceRenderKey(current));
      SourceListSourceSwitch({ owner: $$.owner }, source.enabled, (next: boolean): void => $$.owner.sourceRowToggle($$.owner.currentSourceRow(source))(next), source.sourceId, source.name);
    }.width($$.owner.layoutBudget($$.owner.currentSourceRow(source)).trailingWidth)
      .justifyContent(FlexAlign.End).constraintSize({ minHeight: $$.owner.layoutBudget($$.owner.currentSourceRow(source)).actionsHeight });
  }
}

@Builder
function SourceListDetectButton($$: SourceManagementListOwnerSlot, source: BookSource) {
  SourceV9DetectButton({ tone: sourceV9ReportTone(source), checking: source.checkState === 'checking',
    controlId: source.offlineDetectReportVersion !== undefined && ReaderUIVerificationProbe.enabled() ?
      'reader-source-v9-fixture-detect' : $$.owner.verificationRowTextId(source.sourceId, 'reader-source-text-row-detect'),
    iconId: $$.owner.offlineDetectBadgeId(source), actionEnabled: $$.owner.sourceDetectEnabled(source.sourceId),
    label: $$.owner.sourceActionLabel(source, `检测，${$$.owner.sourceBadgeLabel(source)}`, $$.owner.sourceDetectEnabled(source.sourceId),
      source.checkState === 'checking'),
    nativePress: false, paintPressed: $$.owner.rowPressed(source, 'detect'),
    onPressTouch: (event: TouchEvent): void => $$.owner.rowPressTouch(source, 'detect', event),
    onTap: $$.owner.sourceRowCommand(source, 'check') });
}

@Builder
function SourceListLoginButton($$: SourceManagementListOwnerSlot, source: BookSource) {
  Button({ type: ButtonType.Capsule, stateEffect: false }) {
    Row({ space: 3 }) {
      Image(source.loginState === 'verified' ? readerActionIcon('check', $$.owner.host.presentation.appThemeScheme()) :
        source.loginState === 'expired' ? readerActionIcon('close', $$.owner.host.presentation.appThemeScheme()) : $r('app.media.source_v9_question'))
        .width(12).height(12).fillColor($$.owner.loginInk(source)).accessibilityLevel('no');
      Text('登录', $$.owner.host.view.textLayoutOptions()?.('row/login', source.sourceId, '登录'))
        .fontSize(11).maxLines(1)
        .fontFamily(READER_FONT_NOTO_SANS_SC_UI_MEDIUM)
        .fontColor($$.owner.loginInk(source));
    }.justifyContent(FlexAlign.Center);
  }.id($$.owner.verificationRowActionsCurrent(source) ? 'reader-source-text-row-login' : '')
    .width(58).height(26).padding(2).flexShrink(0)
    .responseRegion({ x: 0, y: -9, width: 58, height: 44 })
    .attributeModifier(new ReaderPressFeedback($$.owner.loginSurface(source), $$.owner.host.presentation.appThemeScheme(), 13, 13,
      $$.owner.sourceActionEnabled() && source.checkState !== 'checking', $$.owner.rowPressed(source, 'login'), false))
    .onTouch((event: TouchEvent): void => $$.owner.rowPressTouch(source, 'login', event))
    .border({ width: 1, color: readerAppColor('TOK_LINE_STRONG', $$.owner.host.presentation.appThemeScheme()) })
    .enabled($$.owner.sourceActionEnabled() && source.checkState !== 'checking')
    .accessibilityText($$.owner.sourceActionLabel(source, source.loginState === 'verified' ? '登录，已验证' :
      source.loginState === 'expired' ? '登录，验证失效' : '登录，状态未知', $$.owner.sourceActionEnabled(), false))
    .onClick($$.owner.sourceRowCommand(source, 'login'));
}

@Builder
function SourceListSourceSwitch($$: SourceManagementListOwnerSlot, value: boolean, onTap: (next: boolean) => void, sourceId: string, sourceName: string) {
  ForEach([`${$$.owner.host.opening.temporaryBackIdentity()}:${sourceId}`], (identity: string): void => {
    ReaderToggle({ value: $$.owner.sourceSwitchValue(sourceId, value), specId: 'standard-toggle', inputIdentity: identity, checkedColor: readerAppColor('app.sourceUi.primary', $$.owner.host.presentation.appThemeScheme()),
      accessibilityLabel: `${$$.owner.sourceSwitchName(sourceId, sourceName).trim() || sourceId}，启用书源${$$.owner.sourceToggleBusy() ? '，忙碌' : $$.owner.sourceActionEnabled() ? '' : '，暂不可用'}`, actionEnabled: $$.owner.sourceActionEnabled(), isBusy: $$.owner.sourceToggleBusy(),
      onToggle: (next: boolean): void => {
        if (identity === `${$$.owner.host.opening.temporaryBackIdentity()}:${sourceId}` && $$.owner.sourceActionEnabled() && !$$.owner.sourceToggleBusy()) onTap(next);
      } })
      .id($$.owner.publicToggleFixtureId(sourceId))
      .flexShrink(0);
  }, (identity: string): string => identity);
}

@Builder
export function SourceManagementBatchFooter($$: SourceManagementListOwnerSlot, identity: string) {
  if ($$.owner.host.presentation.batchMode()) {
    Row() {
      SourceListBatchAction({ owner: $$.owner }, $r('app.media.reader_action_check'), '启用', 'enable');
      SourceListBatchAction({ owner: $$.owner }, $r('app.media.reader_action_pause'), '停用', 'disable');
      SourceListBatchAction({ owner: $$.owner }, $r('app.media.reader_action_folder'), '移至分组', 'move');
      SourceListBatchAction({ owner: $$.owner }, $r('app.media.source_v9_wave'), '检测', 'detect');
      SourceListBatchAction({ owner: $$.owner }, $r('app.media.download_visual_trash'), '删除', 'delete');
    }.id('reader-source-v9-batch-dock').width($$.owner.host.native.contentFrame().width).height($$.owner.footerActionHeight())
      .padding({ left: 6, right: 6 }).borderRadius(999).margin({ top: TOK_SPACE_SM, bottom: $$.owner.actionBottomInset() })
      .border({ width: TOK_BORDER_W, color: readerAppColor('app.sourceUi.border', $$.owner.host.presentation.appThemeScheme()) })
      .backgroundColor(readerAppColor('TOK_CARD_BG', $$.owner.host.presentation.appThemeScheme()))
      .shadow(readerSurfaceElevation('floating', $$.owner.host.presentation.appThemeScheme()))
      .transition($$.owner.batchTransition());
  } else {
    Flex({ direction: $$.owner.footerStacked() ? FlexDirection.Column : FlexDirection.Row,
      alignItems: ItemAlign.Center, space: { main: LengthMetrics.vp(TOK_SPACE_CONTROL_INLINE) } }) {
      ReaderButton({ scheme: $$.owner.host.presentation.appThemeScheme(), specId: 'source-management-manage', label: '批量管理', layout: 'full',
        controlHeight: $$.owner.footerControlHeight(), actionEnabled: $$.owner.paint().hasReadableSources,
        textLayoutOptions: $$.owner.host.view.textLayoutOptions()?.('footer/manage', undefined, '批量管理'),
        focusId: $$.owner.host.focus.toolsFocusId('footer'), onFocused: (): void => $$.owner.host.focus.onToolsEntryFocused(identity, 'footer'),
        onAction: (): void => {
          if ($$.owner.host.opening.managementInputIsCurrent() && !$$.owner.host.presentation.groupOpen()) {
            $$.owner.filterInputs.closeMore();
            $$.owner.host.focus.prepareV9ListReturn('batch');
            $$.owner.paint().batchSourceIds = [];
            $$.owner.host.presentation.setBatchMode(true);
            $$.owner.host.focus.observeV9ListEntry('batch');
          }
        } })
        .id(!$$.owner.hasTypographyLayoutOptions() ? '' : 'reader-source-text-footer-manage')
        .height($$.owner.footerControlHeight())
        .width($$.owner.footerStacked() ? '100%' : $$.owner.footerManageWidth())
        .onAreaChange((_old: Area, area: Area): void => $$.owner.host.focus.onToolsEntryLayout(identity, 'footer', area));
      ReaderLabeledIconAction({ scheme: $$.owner.host.presentation.appThemeScheme(), specId: 'source-management-add', label: '导入书源', fillWidth: true, surfaceColor: readerAppColor('app.sourceUi.primary', $$.owner.host.presentation.appThemeScheme()),
        textLayoutOptions: $$.owner.host.view.textLayoutOptions()?.('footer/add', undefined, '导入书源'),
        icon: $$.owner.sourceAddIcon(), focusId: $$.owner.importFocusId(identity),
        onAction: (): void => {
          if ($$.owner.host.opening.managementInputIsCurrent() && identity === $$.owner.host.opening.temporaryBackIdentity() && !$$.owner.host.presentation.groupOpen())
            $$.owner.host.actions.onAddSource($$.owner.importFocusId(identity), $$.owner.host.focus.toolsFocusId('header'));
        } })
        .id(!$$.owner.hasTypographyLayoutOptions() ? '' : 'reader-source-text-footer-add')
        .height($$.owner.footerControlHeight())
        .width($$.owner.footerStacked() ? '100%' : undefined).layoutWeight($$.owner.footerStacked() ? 0 : 1);
    }.id($$.owner.footerStacked() ? 'reader-source-footer-stacked' : 'reader-source-footer-row')
      .width($$.owner.host.native.contentFrame().width).constraintSize({ minHeight: $$.owner.layoutBudget().footerHeight })
      .margin({ top: TOK_SPACE_SM, bottom: $$.owner.actionBottomInset() })
      .hitTestBehavior(HitTestMode.Default).responseRegion(readerLayoutCarrierResponseRegion());
  }
}

@Builder
function SourceListBatchAction($$: SourceManagementListOwnerSlot, icon: Resource, label: string, action: SourceV9ListAction) {
  Button({ type: ButtonType.Capsule, stateEffect: false }) {
    Column({ space: 2 }) {
      Image(icon).width(16).height(16).fillColor($$.owner.batchActionInk(action)).accessibilityLevel('no');
      Text(label).fontSize(10).maxLines(1).textAlign(TextAlign.Center)
        .minFontSize(8).maxFontSize(10).textOverflow({ overflow: TextOverflow.Ellipsis })
        .fontFamily(READER_FONT_NOTO_SANS_SC_UI_MEDIUM).fontColor($$.owner.batchActionInk(action));
    }
  }.layoutWeight(1).height('100%').padding(2)
    .attributeModifier(new ReaderPressFeedback(Color.Transparent, $$.owner.host.presentation.appThemeScheme(), 24, 24, $$.owner.paint().batchSourceIds.length > 0))
    .id(`reader-source-batch-${action}`).accessibilityText(label).enabled($$.owner.paint().batchSourceIds.length > 0)
    .opacity($$.owner.paint().batchSourceIds.length > 0 ? 1 : 0.45)
    .onClick((): void => {
      if ($$.owner.host.opening.managementInputIsCurrent() && $$.owner.host.presentation.batchMode() && $$.owner.paint().batchSourceIds.length > 0)
        $$.owner.host.actions.onV9Action(action, $$.owner.paint().batchSourceIds.slice());
    });
}

@Builder
export function SourceManagementBatchHeaderAction($$: SourceManagementListOwnerSlot, label: string, run: () => void) {
  Button({ type: ButtonType.Normal, stateEffect: false }) {
    Text(label).fontFamily(READER_FONT_NOTO_SANS_SC_UI_MEDIUM).fontSize(13)
      .maxLines(1).minFontSize(10).maxFontSize(13)
      .fontColor(readerAppColor('app.sourceUi.primary', $$.owner.host.presentation.appThemeScheme()));
  }.width('100%').height(44).padding(0)
    .attributeModifier(new ReaderPressFeedback(Color.Transparent, $$.owner.host.presentation.appThemeScheme(), 22))
    .onClick(run);
}
