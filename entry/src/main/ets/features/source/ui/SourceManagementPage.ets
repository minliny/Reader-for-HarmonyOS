import { readerKeyboardHostBottom } from '../../../ui/layout/ReaderKeyboardGeometry';
import { readerHarmonyApi24 } from '../../../app/HarmonyCapabilityProbe';
import { ReaderEditingVisibility } from '../../../ui/layout/ReaderEditingVisibility';
import { ReaderEditingScrollBinding } from '../../../ui/layout/ReaderEditingScrollBinding';
import { ReaderPostLayoutFrame } from '../../../ui/layout/ReaderPostLayoutFrame';
import { ReaderRectVp, readerInteractiveSafeTop, readerInteractiveSafeBottom, readerInteractiveSafeLeft, readerInteractiveSafeRight } from '../../../ui/foundation/ReaderWindowMetrics';
import hilog from '@ohos.hilog';
import inputMethod from '@ohos.inputMethod';
import { ReaderTransientFeedback, READER_FEEDBACK_EXTENDED_MS, readerTransientTextObserver,
  type ReaderTransientTextObserver } from '../../../ui/feedback/ReaderTransientFeedback';
import { consumeReaderControlKeyboardBack } from '../../../ui/foundation/ReaderKeyboardBack';
import { ReaderPageScaffold } from '../../../ui/layout/ReaderPageScaffold';
import { readerPageAreaLength, readerStandardPageSpec, READER_STANDARD_PAGE_CONTENT_GAP } from '../../../ui/layout/ReaderPageShell';
import { ReaderMeasurementStore } from '../../../ui/layout/ReaderMeasurements';
import { ReaderPageGeometry, ReaderPageGeometryInput, applyReaderStandardFloatingHeader, resolveReaderPageGeometry } from '../../../ui/layout/ReaderPageGeometry';
import { APP_FLOATING_HEADER_BAR_HEIGHT } from '../../../ui/foundation/ReaderHeaderMetrics';
import { resolveReaderButtonMatrixSize, resolveReaderButtonSpec } from '../../../ui/controls/ReaderControlSpecs';
import { readerReadableFontScale, readerScaledControlHeight } from '../../../ui/foundation/ReaderSurfaceResolvers';
import { resolveSourceManagementLayout, SOURCE_ROW_ICON_WIDTH, SOURCE_STATUS_CHIP_GAP, type SourceManagementLayout } from '../presentation/SourceManagementLayout';
import { sourceManagementFilterKey, copySourceManagementScroll, type SourceManagementScrollState } from '../presentation/SourceManagementScrollState';
import { ReaderButton } from '../../../ui/controls/ReaderButton';
import { ReaderIconButton } from '../../../ui/controls/ReaderIconButton';
import { resolveReaderLabeledIconActionSpec } from '../../../ui/controls/ReaderLabeledIconActionSpecs';
import { ReaderLabeledIconAction } from '../../../ui/controls/ReaderLabeledIconAction';
import { readerRecoveryView } from '../../../app/ReaderRecoveryProjection';
import type { ReaderRecoveryView } from '../../../ui/feedback/ReaderRecoveryView';
import type { SourceManagementViewState, SourceToolsEntry } from '../presentation/SourceJourneyPresentation';
import { FrameCallback, LengthMetrics } from '@kit.ArkUI';
import { ReaderRecoveryAction } from '../../../ui/feedback/ReaderRecoveryAction';
import { ReaderRecoveryNotice, type ReaderRecoveryBodyPresentation, type ReaderRecoveryTextAction } from '../../../ui/feedback/ReaderRecoveryNotice';
import { ReaderPageState } from '../../../ui/feedback/ReaderPageState';
import { TYPE_SELECT_SOURCE_GROUP_VALUE, TYPE_SEARCH_RESULT_INTRO, TYPE_SOURCE_MANAGEMENT_COUNT, TYPE_SOURCE_MANAGEMENT_STATUS, TYPE_SOURCE_MANAGEMENT_ROW_TITLE, TYPE_SOURCE_STATE_TITLE } from '../../../ui/foundation/ReaderTypography';
import { readerAppColor } from '../../../ui/foundation/ReaderThemeRegistry';
import { ReaderFrameStyle, readerFrameStyle } from '../../../ui/layout/ReaderFrameStyle';
import { ReaderScrollLayout, readerScrollLayout, readerScrollEndOffset, readerScrollStartOffset } from '../../../ui/layout/ReaderScrollLayout';
// Source Management — rebuilt 2026-08-05 against live Figma nodes
// 943:4281 (Phone 390×844) / 943:4745 (Tablet 760×960).
// The list row has two text lines and two separate touch rows for its actions.
import {
  type BookSource,
} from '../application/SourceGateway';
import type { SourceManagementStatusKind, SourceManagementProjection } from '../application/SourceOrchestrator';
import { readerSourceCategoryLabel, type ReaderSourceCategory } from '../application/ReaderSourceCategory';
import { httpUrlHostname } from '../../../platform/network/HttpTransportPolicy';
import { TYPE_SOURCE_MANAGEMENT_META, TYPE_SEARCH_SOURCE_INPUT } from '../../../ui/foundation/ReaderTypography';
import { ReaderWindowCoordinator } from '../../../app/ReaderWindowCoordinator';
import { ReaderUIVerificationProbe } from '../../../app/diagnostics/ReaderUIVerificationProbe';
import { sourceReadLoadingFrame, SOURCE_READ_FAILURE_TITLE } from './SourceReadLoadingVerification';
import { ReaderSourceTextMetrics, type SourceTextLayoutLabel } from '../../../pages/ReaderSourceTextMetrics';
import { sourceVerificationOfflineDetectIdentity, sourceVerificationOpening, sourceVerificationRowActions,
  sourceVerificationReservedTypographyRow, sourceVerificationToggleAnchor, SourceVerificationAnchors,
  type SourceGeometryObservation, type SourceProjectionObservation,
  type SourceProjectionState, type SourceProjectionTrigger, type SourceScrollObservation, type SourceVerificationOpening,
  type SourceOverlayObservation, type SourceRecoveryBranch, type SourceRecoveryTitleObservation,
  type SourceImportStatusActionObservation, type SourceRecoveryVerificationFacts,
  type SourceToggleReadyObservation } from './SourceManagementVerification';
import { registerReaderFonts } from '../../../ui/foundation/ReaderFonts';
import { PageBackBar } from '../../../ui/chrome/PageBackBar';
import { readerFloatingBarBottomInset } from '../../../ui/layout/ReaderFloatingBarMetrics';
import { ReaderSearchField } from '../../../ui/controls/ReaderSearchField';
import { ReaderToggle } from '../../../ui/controls/ReaderToggle';
import { ReaderSelect } from '../../../ui/controls/ReaderSelect';
import { ReaderSelectPanel } from '../../../ui/controls/ReaderSelectPanel';
import { StatusBadge, type ReaderStatusBadgeStatus } from '../../../ui/controls/StatusBadge';
import {
  SurfaceHorizontalFrame,
} from '../../../ui/layout/SurfaceHorizontalGeometry';
import {
  TOK_BORDER_W,
  TOK_SPACE_CONTROL_INLINE,
  TOK_SPACE_MD,
  TOK_SPACE_SM,
  TOK_SPACE_XS,
} from '../../../ui/foundation/ReaderTokens';

const SOURCE_TEXT_ROLES = ['stats', 'status/all', 'category/all', 'row/title',
  'row/domain', 'row/detect', 'footer/manage', 'footer/add'];
const SOURCE_RESERVED_TEXT_ROLES = ['row/domain', 'row/detect'];
let sourceTemporaryGeneration: number = 0;

class SourceListLayoutFrame extends ReaderPostLayoutFrame {}

type SourceTextOptions = (role: string, sourceId?: string, text?: string) => TextOptions | undefined;
type SourceSurfaceTextScope = 'read-empty' | 'read-failed' | 'retained-read-failed' | 'operation-status' | 'operation-recovery' |
  'operation-recovery-body';

interface SourceSurfaceTextFact {
  scope: SourceSurfaceTextScope;
  branch?: string;
  generation?: number;
  statusRevision?: number;
  presentation?: ReaderRecoveryBodyPresentation;
  expansionRevision?: number;
}

interface SourceTransientTextFact {
  scope: 'operation-status' | 'retained-read-failed';
  owner: SourceVerificationOpening;
  readGeneration: number;
  branch?: 'import';
  generation?: number;
}

interface SourceRecoveryBodyAttachment {
  branch: SourceRecoveryBranch;
  generation: number;
  presentation: ReaderRecoveryBodyPresentation;
}
type SourceFilterTextLane = 'status' | 'category';

interface SourceTextLayoutScope {
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

@Component
export struct SourceManagementPage {
  @Prop @Watch('onGeometryInputsChanged') embeddedWide: boolean = false;
  private readonly metadataEllipsisMode: EllipsisMode = readerHarmonyApi24() ? EllipsisMode.CENTER : EllipsisMode.END;
  private readonly editingHost: ReaderEditingVisibility = new ReaderEditingVisibility();
  private readonly editingScroll: ReaderEditingScrollBinding = new ReaderEditingScrollBinding('reader-source-list');
  private readonly transientFeedback: ReaderTransientFeedback = new ReaderTransientFeedback();
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  @StorageLink('readerAppForeground') @Watch('onToolsFocusContextChanged') private appForeground: boolean = true;

  @StorageLink('readerWindowMetricsRevision') @Watch('onGeometryInputsChanged') private readerWindowMetricsRevision: number = 0;
  @Prop @Watch('onSourcesChanged') sources: BookSource[];
  @Prop initialViewState: SourceManagementViewState | undefined = undefined;
  @Prop expandedLayout: boolean;
  @Prop reduceMotion: boolean = false;
  verificationOpening: string = '';
  @Prop inputEnabled: boolean = true;
  @Prop @Watch('onMessageChanged') operation: SourceManagementProjection = { action: 'load', sourceId: '' };
  onReconcile: (generation: number) => void = (_generation: number): void => {};
  onContinueOriginal: (generation: number) => void = (_generation: number): void => {};
  @Prop @Watch('onMessageChanged') statusKind: SourceManagementStatusKind = 'idle';
  @Prop @Watch('onMessageChanged') statusMessage: string = '';
  @Prop @Watch('scheduleImportStatusReadyObservation') statusActionLabel: string = '';
  @Prop @Watch('scheduleImportStatusReadyObservation') statusActionGeneration: number = 0;
  // The existing diagnostic may supply its own controllers instead of the normal-route probe.
  textLayoutOptions: SourceTextOptions | undefined = undefined;
  isOpeningCurrent: (() => boolean) | undefined = undefined;
  isInputAllowed: (() => boolean) | undefined = undefined;
  onStatusAction: (generation: number) => void = (_generation: number): void => {};
  onBack: () => void = (): void => {};
  onToggleSource: (id: string, enabled: boolean) => void = (_id: string, _enabled: boolean): void => {};
  onDetectSource: (id: string) => void = (_id: string): void => {};
  onLoginSource: (id: string, loginUrl: string) => void = (_id: string, _loginUrl: string): void => {};
  onAddSource: (preferred?: string, fallback?: string) => void = (): void => {};
  onOpenTools: (viewState: SourceManagementViewState) => void = (_viewState: SourceManagementViewState): void => {};
  onRetryLoad: () => void = (): void => {};
  @State private searchQuery: string = '';
  @State private searchInputRevision: number = 0;
  @State private statusValue: string = '全部';
  @State private categoryValue: string = 'all';
  @State private groupValue: string = '全部分组';
  @State private groupOpen: boolean = false;
  @State private groupClosing: boolean = false;
  @State private groupSearchQuery: string = '';
  @State private groupSelectionId: string = '';
  private pendingGroupFocus: string = '';
  private groupFocusRevision: number = 0;
  private mounted: boolean = false;
  private lastFeedbackIdentity: string = '';
  private lastToastMessage: string = '';
  private temporaryBackIdentity: string = '';
  onTemporaryBackBridge: (handler: (() => boolean) | undefined, identity: string) => void =
    (_handler: (() => boolean) | undefined, _identity: string): void => {};
  // 838 条书源时 @State 会为每个对象建立观察代理，重建一次就产生数百 MB 峰值。
  // 列表本身由 LazyForEach 数据源驱动，这里只保留普通引用并以计数触发重渲染。
  private projectedSources: BookSource[] = [];
  @State private projectedSourceCount: number = 0;
  @State private projectedEnabledSourceCount: number = 0;
  private groupOptionsCache: string[] = [];
  private groupOptionsCacheSource: BookSource[] | undefined = undefined;
  private projectionRebuildPending: boolean = false;
  private readonly sourceDataSource: SourceListDataSource = new SourceListDataSource();
  private readonly sourceScroller: Scroller = new Scroller();
  private listMounted: boolean = false;
  private firstVisibleSourceId: string = '';
  private pendingSourceAnchor: string = '';
  private anchorRestoreScheduled: boolean = false;
  private pendingScroll: SourceManagementScrollState | undefined;
  private capturedScroll: SourceManagementScrollState | undefined;
  private scrollRestoreEpoch: number = 0;
  private firstVisibleListIndex: number = 0;
  private lastProjectionFilterKey: string = '';
  private verificationFilterRevision: number = 0;
  private verificationGeometryKey: string = '';
  private verificationTextMetrics: ReaderSourceTextMetrics | undefined;
  private verificationReadTextMetrics: ReaderSourceTextMetrics | undefined;
  private readonly verificationSurfaceTextMetrics: Map<string, ReaderSourceTextMetrics> = new Map();
  private readonly verificationSurfaceTextFrameKeys: Map<string, string> = new Map();
  private verificationTextOptions: SourceTextOptions | undefined;
  private readonly verificationFilterTextMetrics: Map<SourceFilterTextLane, ReaderSourceTextMetrics> = new Map();
  private readonly verificationFilterTextRevisions: Map<SourceFilterTextLane, number> = new Map();
  private verificationGroupTextMetrics: ReaderSourceTextMetrics | undefined;
  private verificationGroupTextRevision: number = 0;
  private verificationTextRowId: string = '';
  private verificationTextFrameKey: string = '';
  @State private verificationReservedTextRowId: string = '';
  private verificationReservedTextMetrics: ReaderSourceTextMetrics | undefined;
  private verificationReservedTextFrameKey: string = '';
  private verificationTextProjectionRevision: number = 0;
  private verificationImportStatusPending: string = '';
  private verificationImportStatusReadyKey: string = '';
  private verificationOperationTextKey: string = '';
  private readonly verificationOperationTextRoles = new Set<string>();
  private verificationRecoveryBodyKey: string = '';
  private verificationRecoveryBodyRevision: number = 0;
  private verificationRecoveryBodyExpanded: SourceRecoveryBodyAttachment | undefined;
  private verificationRecoveryBodyAttachment: SourceRecoveryBodyAttachment | undefined;
  private pendingToolsFocus: SourceToolsEntry | undefined;
  private toolsFocusReady: boolean = false;
  private toolsFocusScheduled: boolean = false;
  private toolsFocusRevision: number = 0;
  private toolsFocusAttempt: number = 0;
  // 展开面板锚点: 触发条全局坐标 - 根 Stack 原点 = 面板相对根 Stack 位置。
  @State private groupX: number = 0;
  @State private groupY: number = 0;
  @State private groupTriggerWidth: number = 0;
  @State private groupTriggerHeight: number = 0;
  @State private groupClosingAnchor: ReaderRectVp | undefined = undefined;
  @State private originX: number = 0;
  @State private originY: number = 0;
  @State private geometry: ReaderPageGeometry = new ReaderPageGeometry();
  @State private measurementKey: number = 0;
  @State private footerMeasurementKey: number = 0;
  private headerInputs: string = '';
  private headerTopAlignmentScheduled: boolean = false;
  private footerInputs: string = '';
  @State private viewportWidth: number = 0;
  @State private viewportHeight: number = 0;
  private measurementRevision: number = 0;
  private readonly measurements: ReaderMeasurementStore = new ReaderMeasurementStore();
  private verificationReadLoadingGeneration: number = 0;

  aboutToAppear(): void {
    this.mounted = true;
    if (this.textLayoutOptions === undefined && (this.verificationOpening ?? '').length > 0 && ReaderUIVerificationProbe.enabled()) {
      const metrics = new ReaderSourceTextMetrics('');
      this.verificationFilterTextMetrics.set('status', new ReaderSourceTextMetrics(''));
      this.verificationFilterTextMetrics.set('category', new ReaderSourceTextMetrics(''));
      this.verificationTextMetrics = metrics;
      this.verificationReadTextMetrics = new ReaderSourceTextMetrics('');
      this.verificationTextOptions = (role: string, sourceId?: string, text?: string): TextOptions | undefined => {
        if (!this.mounted || this.verificationTextMetrics !== metrics || !ReaderUIVerificationProbe.enabled() ||
          text === undefined) return undefined;
        const measuredRole = role === 'chip/全部' ? 'status/all' : role;
        if (sourceId !== undefined && sourceId === this.verificationReservedTextRowId &&
          SOURCE_RESERVED_TEXT_ROLES.includes(measuredRole)) {
          try { return this.verificationReservedTextMetrics?.track(measuredRole, text); }
          catch (_unavailable) { return undefined; }
        }
        if (sourceId !== undefined && sourceId !== this.verificationTextRowId) return undefined;
        if (!SOURCE_TEXT_ROLES.includes(measuredRole) && measuredRole !== 'row/login') return undefined;
        try { return metrics.track(measuredRole, text); } catch (_unavailable) { return undefined; }
      };
      this.textLayoutOptions = this.verificationTextOptions;
    }
    this.searchQuery = this.initialViewState?.searchQuery ?? '';
    this.statusValue = this.initialViewState?.status ?? '全部';
    this.categoryValue = this.initialViewState?.category ?? 'all';
    this.groupValue = this.initialViewState?.group ?? '全部分组';
    this.pendingScroll = copySourceManagementScroll(this.initialViewState?.scroll);
    this.pendingSourceAnchor = this.pendingScroll?.anchorId ?? this.initialViewState?.anchorSourceId ?? '';
    this.pendingToolsFocus = this.initialViewState?.toolsEntry;
    this.toolsFocusRevision += 1;
    this.toolsFocusAttempt = 0;
    this.onGeometryInputsChanged();
    registerReaderFonts(this.getUIContext().getFont());
    const identity = `source-back:${++sourceTemporaryGeneration}`;
    this.temporaryBackIdentity = identity;
    this.onTemporaryBackBridge((): boolean => this.consumeTemporaryBack(identity), identity);
    this.rebuildSourceProjection('mount');
    this.lastFeedbackIdentity = this.feedbackIdentity();
    this.scheduleImportStatusReadyObservation();
    if (this.pendingToolsFocus !== undefined) this.traceToolsReturnFocus('armed');
  }

  aboutToDisappear(): void {
    this.cancelToolsReturnFocus('retire');
    this.transientFeedback.reset();
    const identity = this.temporaryBackIdentity;
    this.mounted = false;
    this.verificationOperationTextKey = '';
    this.verificationOperationTextRoles.clear();
    this.verificationRecoveryBodyKey = '';
    this.verificationRecoveryBodyExpanded = undefined;
    this.verificationRecoveryBodyAttachment = undefined;
    if (this.verificationTextMetrics !== undefined) {
      this.verificationTextMetrics = undefined;
      this.verificationReadTextMetrics = undefined;
      this.verificationSurfaceTextMetrics.clear();
      this.verificationSurfaceTextFrameKeys.clear();
      this.verificationTextOptions = undefined;
      this.verificationFilterTextMetrics.clear();
      this.verificationFilterTextRevisions.clear();
      this.textLayoutOptions = undefined;
      this.verificationTextRowId = '';
      this.verificationTextFrameKey = '';
      this.verificationReservedTextMetrics = undefined;
      this.verificationReservedTextRowId = '';
      this.verificationReservedTextFrameKey = '';
    }
    this.listMounted = false;
    this.cancelScrollRestore();
    this.capturedScroll = undefined;
    this.firstVisibleSourceId = '';
    this.pendingSourceAnchor = '';
    this.anchorRestoreScheduled = false;
    this.pendingToolsFocus = undefined;
    this.toolsFocusReady = false;
    this.toolsFocusScheduled = false;
    this.temporaryBackIdentity = '';
    this.viewportWidth = 0;
    this.viewportHeight = 0;
    this.measurements.clear();
    this.headerInputs = '';
    this.footerInputs = '';
    this.retireGroupSelection();
    this.onTemporaryBackBridge(undefined, identity);
  }

  private managementOpeningIsCurrent(): boolean {
    return this.mounted && (this.isOpeningCurrent?.() ?? true);
  }

  private managementBackIsCurrent(identity: string): boolean {
    return this.managementOpeningIsCurrent() && this.appForeground && identity.length > 0 &&
      identity === this.temporaryBackIdentity;
  }

  private consumeTemporaryBack(identity: string): boolean {
    if (!this.managementBackIsCurrent(identity)) return false;
    if (this.hideManagementKeyboard(identity)) {
      this.observeVerificationOverlay('back', 'ime');
      return true;
    }
    const consumed = this.requestGroupClose(this.groupSelectionId);
    if (consumed) this.observeVerificationOverlay('back', 'group');
    return consumed;
  }

  private hideManagementKeyboard(identity: string): boolean {
    return consumeReaderControlKeyboardBack(ReaderWindowCoordinator.metrics(), {
      hideTextInput: (): Promise<void> => inputMethod.getController().hideTextInput(),
      onFailure: (error: Error): void => {
        if (this.managementBackIsCurrent(identity))
          hilog.warn(0x5244, 'Reader', 'Source management keyboard dismissal: %{private}s', error.message);
      },
    });
  }

  private retireGroupSelection(): void {
    this.cancelGroupFocus();
    this.verificationGroupTextMetrics = undefined;
    this.groupOpen = false;
    this.groupClosing = false;
    this.groupSearchQuery = '';
    this.groupClosingAnchor = undefined;
    this.groupSelectionId = '';
  }

  private ownsGroupSelection(identity: string): boolean {
    return this.managementOpeningIsCurrent() && this.groupOpen && identity.length > 0 && identity === this.groupSelectionId;
  }

  private managementInputIsCurrent(): boolean {
    return this.inputEnabled && this.managementOpeningIsCurrent() && this.appForeground && this.isInputAllowed?.() !== false;
  }

  private toggleGroupSelection(): void {
    if (!this.managementInputIsCurrent()) return;
    if (this.requestGroupClose(this.groupSelectionId) || this.groupOptions().length <= 1 ||
      this.groupTriggerWidth <= 0 || this.groupTriggerHeight <= 0) return;
    if (this.overlayBottom() - this.groupOverlayTop() < this.groupTriggerHeight + 44 + 2 * TOK_BORDER_W ||
      this.groupX - this.originX >= this.overlayRight()) return;
    this.cancelGroupFocus();
    this.cancelToolsReturnFocus('group');
    this.groupSelectionId = `source-group:${++sourceTemporaryGeneration}`;
    this.pendingGroupFocus = this.groupSelectionId;
    this.groupClosing = false;
    this.groupOpen = true;
    this.prepareVerificationGroupText();
    this.observeVerificationOverlay('open', 'group', this.groupSelectionId);
  }

  private requestGroupClose(identity: string, outside: boolean = false): boolean {
    if (!this.ownsGroupSelection(identity)) return false;
    if (outside && !this.groupClosing) this.observeVerificationOverlay('outside', 'group', identity);
    // The collapsing panel continues to consume Back until it dismisses.
    this.cancelGroupFocus();
    this.groupClosing = true;
    if (outside) this.hideManagementKeyboard(this.temporaryBackIdentity);
    return true;
  }

  private groupCloseAction(identity: string): () => void {
    return (): void => { if (this.managementInputIsCurrent()) this.requestGroupClose(identity, true); };
  }

  private commitGroupSelection(option: string, identity: string): void {
    if (!this.groupSearchIsCurrent(identity) || this.visibleGroupOptions().indexOf(option) < 0) return;
    this.cancelGroupFocus();
    // Applying a group can scroll the list to its top before the panel finishes closing.
    this.groupClosingAnchor = new ReaderRectVp(this.groupX, this.groupY, this.groupTriggerWidth, this.groupTriggerHeight);
    this.groupClosing = true;
    this.hideManagementKeyboard(this.temporaryBackIdentity);
    this.groupValue = option;
    this.rebuildSourceProjection('group');
  }

  private groupSearchIsCurrent(identity: string): boolean {
    return this.managementInputIsCurrent() && this.ownsGroupSelection(identity) && !this.groupClosing;
  }

  private changeGroupSearch(identity: string, value: string): void {
    if (this.groupSearchIsCurrent(identity)) this.groupSearchQuery = value;
  }

  private collapseGroupSearch(identity: string): void {
    if (this.groupSearchIsCurrent(identity) && this.requestGroupClose(identity)) {
      this.hideManagementKeyboard(this.temporaryBackIdentity);
    }
  }

  private dismissGroupSelection(identity: string): void {
    if (!this.ownsGroupSelection(identity)) return;
    this.retireGroupSelection();
    this.observeVerificationOverlay('dismiss', 'group', identity);
    const fallback = this.toolsFocusId('header');
    this.scheduleGroupFocus(this.groupOptions().length > 1 ? [this.groupTriggerFocusId(), fallback] : [fallback]);
  }

  private cancelGroupFocus(): void {
    this.pendingGroupFocus = '';
    this.groupFocusRevision += 1;
  }

  private groupTriggerFocusId(): string { return `${this.temporaryBackIdentity}:group-trigger`; }
  private groupPanelFocusPrefix(identity: string): string { return `${identity}:focus`; }

  private groupPanelLayoutAction(identity: string): (_old: Area, next: Area) => void {
    return (_old: Area, next: Area): void => {
      if (identity !== this.pendingGroupFocus || !this.ownsGroupSelection(identity) || this.groupClosing ||
        readerPageAreaLength(next.width) <= 0 || readerPageAreaLength(next.height) <= 0) return;
      this.pendingGroupFocus = '';
      this.scheduleGroupFocus([`${this.groupPanelFocusPrefix(identity)}:selected`], identity);
      if (this.verificationGroupTextMetrics !== undefined) this.scheduleVerificationGroupText(identity, 'initial');
    };
  }

  private scheduleGroupFocus(targets: string[], selection: string = ''): void {
    if (!this.managementOpeningIsCurrent() || !this.appForeground) return;
    const mount = this.temporaryBackIdentity;
    const revision = ++this.groupFocusRevision;
    try {
      this.getUIContext().postFrameCallback(new SourceListLayoutFrame(this.getUIContext(), (): void => {
        if (!this.managementOpeningIsCurrent() || !this.appForeground || mount !== this.temporaryBackIdentity ||
          revision !== this.groupFocusRevision || (selection.length > 0 ?
            !this.ownsGroupSelection(selection) || this.groupClosing : this.groupOpen)) return;
        const controller = this.getUIContext().getFocusController();
        for (const target of targets) {
          try { controller.requestFocus(target); return; } catch (_unavailableTarget) {}
        }
      }));
    } catch (_unmounted) {}
  }

  private requestOpenTools(entry: SourceToolsEntry): void {
    if (!this.managementBackIsCurrent(this.temporaryBackIdentity) || this.isInputAllowed?.() === false || this.groupOpen) return;
    this.captureScroll('tools');
    this.cancelToolsReturnFocus('open-tools');
    const pending = (this.pendingScroll !== undefined || this.pendingSourceAnchor.length > 0) && this.sourceReturnFiltersMatch();
    const scroll = copySourceManagementScroll(pending ? this.pendingScroll : this.capturedScroll);
    const anchorSourceId = scroll?.anchorId ?? (pending ? this.pendingSourceAnchor : this.firstVisibleSourceId);
    const index = this.projectedSources.findIndex((source: BookSource): boolean => source.sourceId === anchorSourceId);
    this.onOpenTools({ searchQuery: this.searchQuery, status: this.statusValue,
      category: this.categoryValue, group: this.groupValue, anchorSourceId,
      anchorFallbackIndex: pending ? this.initialViewState?.anchorFallbackIndex ?? index : index,
      toolsEntry: entry, scroll });
  }

  private toolsFocusId(entry: SourceToolsEntry): string { return `${this.temporaryBackIdentity}:tools:${entry}`; }

  private onToolsEntryLayout(identity: string, entry: SourceToolsEntry, area: Area): void {
    if (!this.managementBackIsCurrent(identity) || this.pendingToolsFocus !== entry || readerPageAreaLength(area.width) <= 0 ||
      readerPageAreaLength(area.height) <= 0) return;
    if (!this.toolsFocusReady) this.traceToolsReturnFocus('layout');
    this.toolsFocusReady = true;
    this.scheduleToolsReturnFocus();
  }

  private traceToolsReturnFocus(phase: string, success: boolean = false): void {
    hilog.info(0x5244, 'Reader', 'Source tools focus phase=%{public}s attempt=%{public}d success=%{public}s',
      phase, this.toolsFocusAttempt, success ? 'true' : 'false');
  }

  private cancelToolsReturnFocus(phase: string): void {
    if (this.pendingToolsFocus !== undefined || this.toolsFocusScheduled) this.traceToolsReturnFocus(phase);
    this.toolsFocusRevision += 1;
    this.pendingToolsFocus = undefined;
    this.toolsFocusReady = false;
    this.toolsFocusScheduled = false;
  }

  private onToolsFocusContextChanged(): void {
    if (!this.appForeground || !this.managementOpeningIsCurrent() || this.isInputAllowed?.() === false || this.groupOpen)
      this.cancelToolsReturnFocus('inactive');
  }

  private onToolsEntryFocused(identity: string, entry: SourceToolsEntry): void {
    if (!this.managementBackIsCurrent(identity) || this.isInputAllowed?.() === false) return;
    if (this.pendingToolsFocus !== entry) { this.cancelToolsReturnFocus('other-focus'); return; }
    this.traceToolsReturnFocus('focused', true);
    this.toolsFocusRevision += 1;
    this.pendingToolsFocus = undefined;
    this.toolsFocusReady = false;
    this.toolsFocusScheduled = false;
  }

  private scheduleToolsReturnFocus(): void {
    const entry = this.pendingToolsFocus;
    if (entry === undefined) return;
    if (!this.managementOpeningIsCurrent() || !this.appForeground || this.isInputAllowed?.() === false || this.groupOpen) {
      this.cancelToolsReturnFocus('inactive'); return;
    }
    if (!this.toolsFocusReady || this.toolsFocusScheduled || this.toolsFocusAttempt >= 2) return;
    const identity = this.temporaryBackIdentity;
    const revision = this.toolsFocusRevision;
    this.toolsFocusScheduled = true;
    try {
      this.getUIContext().postFrameCallback(new SourceListLayoutFrame(this.getUIContext(), (): void => {
        if (!this.mounted || identity !== this.temporaryBackIdentity || revision !== this.toolsFocusRevision) return;
        this.toolsFocusScheduled = false;
        if (!this.managementOpeningIsCurrent() || !this.appForeground || this.isInputAllowed?.() === false ||
          this.groupOpen || this.pendingToolsFocus !== entry) { this.cancelToolsReturnFocus('inactive'); return; }
        this.toolsFocusAttempt += 1;
        this.traceToolsReturnFocus('request');
        // API 23 returns void. A request without an exception is not an ACK;
        // only the existing native Button's onFocus confirms this target.
        try { this.getUIContext().getFocusController().requestFocus(this.toolsFocusId(entry)); }
        catch (_unbound) { this.traceToolsReturnFocus('request-error'); }
        if (revision === this.toolsFocusRevision && this.pendingToolsFocus === entry) {
          if (this.toolsFocusAttempt < 2) this.scheduleToolsReturnFocus();
          else this.traceToolsReturnFocus('attempt-limit');
        }
      }));
    } catch (_unmounted) { this.cancelToolsReturnFocus('schedule-error'); }
  }

  private frameStyle(): ReaderFrameStyle {
    const pageBackground = readerAppColor('TOK_PAPER', this.appThemeScheme);
    return readerFrameStyle({ backgroundColor: pageBackground,
      headerBackground: pageBackground, headerTransparent: true,
      footerBackground: pageBackground });
  }

  build() {
    ReaderPageScaffold({
      frameStyle: this.frameStyle(),
      geometry: this.geometry,
      headerMeasurementKey: this.measurementKey,
      footerMeasurementKey: this.footerMeasurementKey,
      content: (): void => { this.pageContent(); },
      header: (): void => { this.backBar(); },
      footer: (): void => { this.pageFooter(); },
      overlayContent: (): void => { this.pendingRecovery(); this.groupOverlay(); },
      onHeaderHeightChange: (height: number, presentedKey: number): void => {
        this.recordMeasurement('source:header', height, presentedKey);
      },
      onFooterHeightChange: (height: number, presentedKey: number): void => {
        this.recordMeasurement('source:footer', height, presentedKey);
      },
    }).onTouch((event: TouchEvent): void => {
      if (event.type === TouchType.Down) { this.cancelGroupFocus(); this.cancelToolsReturnFocus('touch'); }
    }).onKeyEvent((event: KeyEvent): void => {
      if (event.type === KeyType.Down) { this.cancelGroupFocus(); this.cancelToolsReturnFocus('key'); }
    });
  }

  private sourceAddIcon(): Resource {
    return this.appThemeScheme === 'night' ? $r('app.media.source_add_theme_night') : $r('app.media.source_add');
  }

  @Builder
  private pageContent() {
    Column() { this.sourceList(); }
      .id('reader-source-content')
      .width('100%')
      .height('100%')
      .enabled(!this.groupOpen)
      .accessibilityLevel(this.groupOpen ? 'no-hide-descendants' : 'auto')
      .hitTestBehavior(this.groupOpen ? HitTestMode.None : HitTestMode.Default)
      .onTouch((event: TouchEvent): void => {
        if (event.type === TouchType.Down) this.cancelToolsReturnFocus('touch');
      })
      .onAreaChange((_oldValue: Area, next: Area): void => this.recordViewport(next));
  }

  @Builder
  private pageFooter() {
    Column() { this.bottomActionBar(); }
      .id('reader-source-footer')
      .width('100%')
      .padding({ left: this.contentFrame().left, right: this.contentFrame().right })
      .enabled(!this.groupOpen)
      .accessibilityLevel(this.groupOpen ? 'no-hide-descendants' : 'auto')
      .hitTestBehavior(HitTestMode.None);
  }

  @Builder
  private groupOverlay() {
    if (this.groupOpen) {
      Row().width('100%').height('100%').backgroundColor(Color.Transparent)
        .id(`reader-source-group-backdrop:${this.groupSelectionId}`)
        .hitTestBehavior(HitTestMode.Default).accessibilityLevel('no')
        .onClick(this.groupCloseAction(this.groupSelectionId));
      ReaderSelectPanel({
        inputCurrent: (): boolean => this.managementInputIsCurrent(),
        value: this.groupValue,
        options: this.visibleGroupOptions(),
        variant: 'sourceGroup',
        controlWidth: Math.max(148, this.groupClosingAnchor?.width ?? this.groupTriggerWidth),
        menuHeaderHeight: this.groupClosingAnchor?.height ?? this.groupTriggerHeight,
        emptyOptionsText: '没有匹配的分组',
        menuHeader: (): void => { this.groupSearchField(this.groupSelectionId); },
        onMenuHeaderCollapse: (identity: string): void => this.collapseGroupSearch(identity),
        reduceMotion: this.reduceMotion,
        closing: this.groupClosing,
        selectionId: this.groupSelectionId,
        focusIdPrefix: this.groupPanelFocusPrefix(this.groupSelectionId),
        x: (this.groupClosingAnchor?.left ?? this.groupX) - this.originX,
        y: (this.groupClosingAnchor?.top ?? this.groupY) - this.originY,
        hostTopVp: this.groupOverlayTop(), hostBottomVp: this.overlayBottom(),
        hostLeftVp: this.overlayLeft(), hostRightVp: this.overlayRight(),
        optionTextLayoutOptions: this.verificationGroupTextMetrics === undefined ? undefined :
          (opt: string, identity: string): TextOptions | undefined => this.verificationGroupTextOptions(opt, identity),
        onOptionsScrollStop: this.verificationGroupTextMetrics === undefined ? undefined :
          (identity: string): void => this.scheduleVerificationGroupText(identity, 'settled'),
        onCommit: (opt: string, identity: string): void => this.commitGroupSelection(opt, identity),
        onDismiss: (identity: string): void => this.dismissGroupSelection(identity),
      }).id('reader-source-group-panel').onAreaChange(this.groupPanelLayoutAction(this.groupSelectionId));
    }
  }

  @Builder
  private groupSearchField(identity: string) {
    ReaderSearchField({
      variant: 'sourceGroup',
      mode: 'live',
      editingFocusId: `${identity}:search`,
      naturalFieldHeightVp: this.groupClosingAnchor?.height ?? this.groupTriggerHeight,
      text: this.groupSearchQuery,
      placeholder: '搜索分组',
      editingCurrent: (): boolean => this.groupSearchIsCurrent(identity),
      onTextChange: (value: string): void => this.changeGroupSearch(identity, value),
    }).id('reader-source-group-search').enabled(!this.groupClosing);
  }

  @Builder
  private backBar(identity: string = this.temporaryBackIdentity) {
    PageBackBar({
      floating: true, centered: true, elevation: 'floating',
      showBack: !this.embeddedWide,
      title: '书源管理',
      backFocusId: 'reader-source-back',
      onBack: (): void => {
        if (this.managementBackIsCurrent(identity) && !this.consumeTemporaryBack(identity)) this.onBack();
      },
    }) {
      Row() {
        ReaderIconButton({ icon: this.appThemeScheme === 'night' ? $r('app.media.bookshelf_more_theme_night') : $r('app.media.bookshelf_more'),
          specId: 'toolbar-compact', accessibilityLabel: '书源工具', focusId: this.toolsFocusId('header'),
          onFocused: (): void => this.onToolsEntryFocused(identity, 'header'),
          onTap: (): void => this.requestOpenTools('header') });
      }.id('reader-source-header-tools').enabled(!this.groupOpen).accessibilityLevel(this.groupOpen ? 'no-hide-descendants' : 'auto')
        .onAreaChange((_old: Area, area: Area): void => this.onToolsEntryLayout(identity, 'header', area));
    }
  }

  @Builder
  private searchField() {
    Row({ space: TOK_SPACE_XS }) {
      Row() {
        ForEach([this.sourceSearchInputIdentity()], (identity: string): void => {
          ReaderSearchField({ editingHost: this.editingHost,
            variant: 'sourceManagement',
            editingFocusId: 'reader-source-editor',
            mode: 'live',
            text: this.searchQuery,
            placeholder: '搜索书源名称或域名',
            accessibilityLabel: '搜索书源名称或域名',
            editingCurrent: (): boolean => identity === this.sourceSearchInputIdentity() &&
              this.managementInputIsCurrent() && !this.groupOpen,
            onTextChange: (value: string): void => this.applySourceSearchInput(identity, value),
            onSubmit: (): void => this.applySourceSearchInput(identity),
          });
        }, (identity: string): string => identity);
      }
      .layoutWeight(1)
      .height(this.layoutBudget().filterHeight);

      this.groupFilter();
    }
    .id('reader-source-search')
    .width(this.contentFrame().width)
    .constraintSize({ minHeight: this.layoutBudget().filterHeight })
    .alignItems(VerticalAlign.Center)
    .margin({ top: TOK_SPACE_XS });
  }

  private sourceSearchInputIdentity(): string {
    return `${this.temporaryBackIdentity}:search:${this.searchInputRevision}`;
  }

  private applySourceSearchInput(identity: string, value?: string): void {
    if (identity !== this.sourceSearchInputIdentity() || !this.managementOpeningIsCurrent()) return;
    if (!this.appForeground || this.isInputAllowed?.() === false || this.groupOpen) {
      // A queued native edit may already have changed the control's buffer.
      // Rebind the field to the accepted draft while its foreground is suspended.
      if (value !== undefined && value !== this.searchQuery) this.searchInputRevision += 1;
      return;
    }
    if (value !== undefined) {
      if (value === this.searchQuery) return;
      this.cancelToolsReturnFocus('edit');
      this.searchQuery = value;
    }
    this.rebuildSourceProjection('edit');
  }

  @Builder
  private importAction(identity: string) {
    Stack({ alignContent: Alignment.Center }) {
      ReaderIconButton({ icon: this.sourceAddIcon(), specId: 'form-primary-icon', accessibilityLabel: '导入书源',
        minimumTargetSize: 44,
        focusId: this.importFocusId(identity, 'header'),
        onFocused: (): void => this.cancelToolsReturnFocus('other-focus'),
        actionEnabled: this.mounted,
        onTap: (): void => {
          if (this.mounted && identity === this.temporaryBackIdentity)
            this.onAddSource(this.importFocusId(identity, 'header'), this.toolsFocusId('header'));
        } });
    }.width(44).height(44);
  }

  private importFocusId(identity: string, entry: 'header' | 'footer'): string { return `${identity}:import:${entry}`; }

  @Builder
  private statsRow() {
    Text(this.statsText(), this.verificationTextOptions?.('stats', undefined, this.statsText()))
      .id('reader-source-stats')
      .width(this.contentFrame().width)
      .fontFamily(TYPE_SOURCE_MANAGEMENT_COUNT.fontFamily)
      .fontWeight(TYPE_SOURCE_MANAGEMENT_COUNT.fontWeight)
      .fontSize(TYPE_SOURCE_MANAGEMENT_COUNT.fontSizeFp)
      .lineHeight(TYPE_SOURCE_MANAGEMENT_COUNT.lineHeightFp as number)
      .fontColor(readerAppColor('TOK_CONTROL_INK', this.appThemeScheme))
      .maxFontScale(this.fontScale())
      .wordBreak(WordBreak.BREAK_WORD)
      .margin({ top: TOK_SPACE_XS });
  }

  private recovery(): ReaderRecoveryView { return readerRecoveryView(this.operation.receipt, this.operation.readFacts, this.operation.confirmedParts ?? 0); }

  private hasPendingSourceRecovery(): boolean {
    return this.operation.original?.blocked === true || this.operation.receipt?.receipt.confirmation === 'unknown';
  }

  private sourceListLoading(): boolean {
    return this.statusKind === 'loading' || this.sourceAnchorReadPending() || this.operation.receipt?.facts.fact === 'refreshing';
  }

  private hasEmptyListReadFailure(): boolean {
    const fact = this.operation.readFacts?.fact;
    return this.sources.length === 0 && (fact === 'failed' || fact === 'refreshFailed');
  }

  private sourceListInputIsCurrent(opening: string): boolean {
    return this.managementBackIsCurrent(opening) && this.inputEnabled && this.isInputAllowed?.() !== false &&
      !this.groupOpen && !this.hasPendingSourceRecovery();
  }

  private retryEmptyListAction(opening: string): (generation: number) => void {
    return (generation: number): void => {
      const read = this.operation.readFacts;
      if (!this.sourceListInputIsCurrent(opening) || this.sourceListLoading() ||
        !this.hasEmptyListReadFailure() || read === undefined || read.generation !== generation) return;
      if (read.canRetry) this.onReconcile(generation);
      else this.onRetryLoad();
    };
  }

  private retryRetainedListAction(opening: string): (generation: number) => void {
    return (generation: number): void => {
      if (!this.sourceListInputIsCurrent(opening) || this.sourceListLoading() || this.sources.length === 0) return;
      const recovery = this.recovery();
      if (recovery.canRetry && recovery.generation === generation) this.onReconcile(generation);
    };
  }

  private readPageStateTitle(): string {
    return this.sourceListLoading() ? '正在读取书源' : this.hasEmptyListReadFailure() ? '书源读取失败' : '暂无书源';
  }

  private readPageStateMessage(): string {
    return this.sourceListLoading() ? '请稍候' : this.hasEmptyListReadFailure() ?
      '请稍后重试。' : '点击下方「＋ 新增书源」导入 Legado 书源 JSON';
  }

  private verificationReadTextScope(): SourceSurfaceTextScope | undefined {
    if (this.verificationTextMetrics === undefined || this.groupOpen || this.groupClosing ||
      this.searchQuery.length !== 0 || this.statusValue !== '全部' ||
      this.categoryValue !== 'all' || this.groupValue !== '全部分组') return undefined;
    const read = this.operation.readFacts?.fact;
    const state = this.verificationProjectionState();
    if (state === 'empty' && read === 'current') return 'read-empty';
    if (state === 'readFailure' && (read === 'failed' || read === 'refreshFailed')) return 'read-failed';
    if (state === 'rows' && read === 'refreshFailed' && this.recovery().canRetry) return 'retained-read-failed';
    return undefined;
  }

  private readPageStateTextOptions(role: 'title' | 'message' | 'retry'): TextOptions | undefined {
    if (!this.mounted || !ReaderUIVerificationProbe.enabled()) return undefined;
    // TextOptions is set when the child mounts, including its initial loading state.
    try { return this.verificationReadTextMetrics?.options(role); }
    catch (_unavailable) { return undefined; }
  }

  private readVerificationPageText(scope: 'read-empty' | 'read-failed'): SourceTextLayoutLabel[] {
    const metrics = this.verificationReadTextMetrics;
    if (metrics === undefined) return [];
    metrics.track('title', this.readPageStateTitle());
    metrics.track('message', this.readPageStateMessage());
    const roles = ['title', 'message'];
    if (scope === 'read-failed') {
      metrics.track('retry', '重试');
      roles.push('retry');
    }
    const state = scope === 'read-empty' ? 'empty' : 'failure';
    const labels = metrics.readTracked(roles);
    for (const label of labels) {
      label.role = label.role === 'retry' ? 'read/retry' : `read/${state}-${label.role}`;
    }
    if (scope === 'read-empty') labels.push(...(this.verificationTextMetrics?.readTracked(['footer/add']) ?? []));
    return labels;
  }

  private verificationSurfaceTextKey(scope: SourceSurfaceTextScope, branch?: string): string {
    return branch === undefined ? scope : `${scope}/${branch}`;
  }

  private verificationSurfaceTextOptions(scope: SourceSurfaceTextScope, role: string, text: string,
    branch?: string): TextOptions | undefined {
    if (!this.mounted || this.verificationTextMetrics === undefined || !ReaderUIVerificationProbe.enabled()) return undefined;
    try {
      const key = this.verificationSurfaceTextKey(scope, branch);
      let metrics = this.verificationSurfaceTextMetrics.get(key);
      if (metrics === undefined) {
        metrics = new ReaderSourceTextMetrics('');
        this.verificationSurfaceTextMetrics.set(key, metrics);
      }
      return metrics.track(role, text);
    } catch (_unavailable) { return undefined; }
  }

  private scheduleVerificationReadText(): void {
    if (this.verificationTextMetrics === undefined) return;
    const scope = this.verificationReadTextScope();
    if (scope === undefined) return;
    this.scheduleVerificationSurfaceText((): SourceSurfaceTextFact | undefined => {
      const current = this.verificationReadTextScope();
      return current === scope ? { scope: current } : undefined;
    }, scope === 'retained-read-failed' ? 1 : 3);
  }

  private scheduleVerificationSurfaceText(current: () => SourceSurfaceTextFact | undefined, expectedRoles: number): void {
    try {
      const scope = this.verificationTextLayoutScope('surface');
      const fact = current();
      if (scope === undefined || fact === undefined) return;
      const bucket = this.verificationSurfaceTextKey(fact.scope, fact.branch);
      const key = JSON.stringify([scope, fact, expectedRoles]);
      if (key === this.verificationSurfaceTextFrameKeys.get(bucket)) return;
      const context = this.getUIContext();
      let allowNextFrame = true;
      const observe = (): void => {
        try {
          if (this.verificationSurfaceTextFrameKeys.get(bucket) !== key ||
            JSON.stringify([this.verificationTextLayoutScope('surface'), current(), expectedRoles]) !== key) return;
          const labels = fact.scope === 'read-empty' || fact.scope === 'read-failed' ? this.readVerificationPageText(fact.scope) :
            this.verificationSurfaceTextMetrics.get(bucket)?.readTracked() ?? [];
          if (allowNextFrame && (labels.length < expectedRoles || labels.some(label =>
            label.lines.length === 0 || fact.scope === 'operation-recovery-body' && !label.complete))) {
            allowNextFrame = false;
            context.postFrameCallback(new SourceListLayoutFrame(context, observe));
            return;
          }
          ReaderUIVerificationProbe.emit('source.surface-text-layout', 'business', {
            owner: scope.owner, textProjectionRevision: scope.textProjectionRevision,
            filterRevision: scope.filterRevision, readGeneration: scope.readGeneration,
            windowRevision: scope.windowRevision, widthVp: scope.widthVp, heightVp: scope.heightVp,
            density: scope.density, systemFontScale: scope.systemFontScale, fontScale: scope.fontScale,
            rowAnchor: scope.rowAnchor, scope: fact.scope, branch: fact.branch, generation: fact.generation,
            statusRevision: fact.statusRevision, presentation: fact.presentation,
            expansionRevision: fact.expansionRevision, labels,
          });
        } catch (_detached) {}
      };
      context.postFrameCallback(new SourceListLayoutFrame(context, observe));
      this.verificationSurfaceTextFrameKeys.set(bucket, key);
    } catch (_detached) {}
  }

  private statusListAction(opening: string): (generation: number) => void {
    return (generation: number): void => {
      if (this.sourceListInputIsCurrent(opening) && this.statusActionLabel.length > 0 &&
        this.statusActionGeneration === generation) {
        this.observeImportStatusAction('accepted');
        this.onStatusAction(generation);
      }
    };
  }

  private scheduleImportStatusReadyObservation(): void {
    const opening = this.temporaryBackIdentity;
    if (!ReaderUIVerificationProbe.enabled() || !this.managementBackIsCurrent(opening) ||
      this.statusActionLabel.length === 0 || this.verificationImportStatusPending === opening) return;
    this.verificationImportStatusPending = opening;
    try {
      const context = this.getUIContext();
      context.postFrameCallback(new SourceListLayoutFrame(context, (): void => {
        if (this.verificationImportStatusPending !== opening) return;
        this.verificationImportStatusPending = '';
        if (this.managementBackIsCurrent(opening)) this.observeImportStatusAction('ready');
      }));
    } catch (_) {
      this.verificationImportStatusPending = '';
    }
  }

  private observeImportStatusAction(phase: 'ready' | 'accepted'): void {
    if (!ReaderUIVerificationProbe.enabled() || !this.managementOpeningIsCurrent() ||
      this.statusActionLabel.length === 0 || this.operation.action !== 'import' || this.hasPendingSourceRecovery()) return;
    const owner = sourceVerificationOpening(this.verificationOpening);
    const receipt = this.operation.receipt;
    if (owner === undefined || receipt === undefined) return;
    if (phase === 'ready') {
      if (this.statusActionGeneration <= 0 || this.sources.length === 0 || this.sourceListLoading() ||
        receipt.receipt.confirmation !== 'confirmed' || receipt.receipt.readback !== 'succeeded') return;
      const key = JSON.stringify([owner.mounting, owner.generation, receipt.facts.generation, this.statusActionGeneration]);
      if (key === this.verificationImportStatusReadyKey) return;
      this.verificationImportStatusReadyKey = key;
    }
    const fixtureUrl = 'https://status-research.reader-phase1.invalid/';
    const fixturePresent = this.sources.some(source => source.sourceId === fixtureUrl && source.baseUrl === fixtureUrl &&
      source.name === 'Reader Phase 1 Search Return' && !source.enabled && !source.enabledExplore);
    const observation: SourceImportStatusActionObservation = {
      owner, phase, statusRevision: this.statusActionGeneration, receiptGeneration: receipt.facts.generation,
      confirmation: receipt.receipt.confirmation, readback: receipt.receipt.readback,
      confirmedParts: this.operation.confirmedParts ?? 0, fixturePresent, count: this.sources.length,
    };
    ReaderUIVerificationProbe.emit('source.import-status-action', 'business', observation);
    if (phase === 'ready' && this.verificationTextMetrics !== undefined) this.scheduleVerificationOperationText();
  }

  private verificationOperationTextFact(): SourceSurfaceTextFact | undefined {
    if (!ReaderUIVerificationProbe.enabled() || !this.managementOpeningIsCurrent()) return undefined;
    const recovery = this.verificationRecoveryFacts();
    if (recovery !== undefined && this.recoveryOverlayVisible()) {
      return { scope: 'operation-recovery', branch: recovery.branch, generation: recovery.generation };
    }
    const receipt = this.operation.receipt;
    if (this.hasPendingSourceRecovery() || this.operation.action !== 'import' ||
      this.statusActionLabel !== '重新搜索' || this.statusActionGeneration <= 0 || this.sourceListLoading() ||
      this.sources.length === 0 || receipt?.receipt.confirmation !== 'confirmed' || receipt.receipt.readback !== 'succeeded') {
      return undefined;
    }
    return { scope: 'operation-status', branch: 'import', generation: receipt.facts.generation,
      statusRevision: this.statusActionGeneration };
  }

  private scheduleVerificationOperationText(): void {
    const fact = this.verificationOperationTextFact();
    if (fact === undefined) {
      this.verificationOperationTextKey = '';
      this.verificationOperationTextRoles.clear();
      return;
    }
    this.prepareOperationGlyphs(fact);
    if (this.verificationOperationTextRoles.size > 0) {
      this.scheduleVerificationSurfaceText((): SourceSurfaceTextFact | undefined => this.verificationOperationTextFact(),
        this.verificationOperationTextRoles.size);
    }
    this.scheduleVerificationRecoveryBody();
  }

  private prepareOperationGlyphs(fact: SourceSurfaceTextFact): void {
    const key = JSON.stringify(fact);
    if (this.verificationOperationTextKey === key) return;
    this.verificationOperationTextKey = key;
    this.verificationOperationTextRoles.clear();
    const bucket = this.verificationSurfaceTextKey(fact.scope, fact.branch);
    this.verificationSurfaceTextMetrics.delete(bucket);
    this.verificationSurfaceTextFrameKeys.delete(bucket);
  }

  private operationGlyphOptions(fact: SourceSurfaceTextFact, role: string, label: string): TextOptions | undefined {
    this.prepareOperationGlyphs(fact);
    const options = this.verificationSurfaceTextOptions(fact.scope, role, label, fact.branch);
    if (options === undefined) return undefined;
    this.verificationOperationTextRoles.add(role);
    this.scheduleVerificationOperationText();
    return options;
  }

  private statusGlyphOptions(generation: number): TextOptions | undefined {
    const fact = this.verificationOperationTextFact();
    if (fact?.scope !== 'operation-status' || fact.statusRevision !== generation) return undefined;
    return this.operationGlyphOptions(fact, 'operation/action', this.statusActionLabel);
  }

  private recoveryGlyphOptions(branch: SourceRecoveryBranch, generation: number):
    (action: ReaderRecoveryTextAction, label: string) => TextOptions | undefined {
    return (action: ReaderRecoveryTextAction, label: string): TextOptions | undefined => {
      const fact = this.verificationOperationTextFact();
      if (fact?.scope !== 'operation-recovery' || fact.branch !== branch || fact.generation !== generation) return undefined;
      return this.operationGlyphOptions(fact, `recovery/${branch}/${action}`, label);
    };
  }

  private verificationRecoveryBodyFact(attachment: SourceRecoveryBodyAttachment): SourceSurfaceTextFact | undefined {
    const current = this.verificationOperationTextFact();
    const expanded = this.verificationRecoveryBodyExpanded;
    if (attachment.presentation === 'collapsed' || current?.scope !== 'operation-recovery' || current.branch !== attachment.branch ||
      current.generation !== attachment.generation) return undefined;
    const expansion = expanded?.branch === attachment.branch && expanded.generation === attachment.generation;
    if ((attachment.presentation === 'expanded') !== expansion) return undefined;
    return { scope: 'operation-recovery-body', branch: attachment.branch,
      generation: attachment.generation, presentation: attachment.presentation,
      expansionRevision: expansion ? this.verificationRecoveryBodyRevision : undefined };
  }

  private scheduleVerificationRecoveryBody(): void {
    const attachment = this.verificationRecoveryBodyAttachment;
    if (attachment === undefined ||
      JSON.stringify([attachment.branch, attachment.generation]) !== this.verificationRecoveryBodyKey) return;
    this.scheduleVerificationSurfaceText((): SourceSurfaceTextFact | undefined => this.verificationRecoveryBodyFact(attachment), 1);
  }

  private recoveryBodyGlyphOptions(branch: SourceRecoveryBranch):
    (generation: number, presentation: ReaderRecoveryBodyPresentation, prefix: string) => TextOptions | undefined {
    return (generation: number, presentation: ReaderRecoveryBodyPresentation, prefix: string): TextOptions | undefined => {
      const attachment: SourceRecoveryBodyAttachment = { branch, generation, presentation };
      const current = this.verificationOperationTextFact();
      if (current?.scope !== 'operation-recovery' || current.branch !== branch || current.generation !== generation) return undefined;
      const bucket = this.verificationSurfaceTextKey('operation-recovery-body', branch);
      const key = JSON.stringify([branch, generation]);
      if (key !== this.verificationRecoveryBodyKey) {
        this.verificationRecoveryBodyKey = key;
        this.verificationSurfaceTextMetrics.delete(bucket);
        this.verificationSurfaceTextFrameKeys.delete(bucket);
      }
      try {
        const metrics = this.verificationSurfaceTextMetrics.get(bucket) ?? new ReaderSourceTextMetrics('');
        this.verificationSurfaceTextMetrics.set(bucket, metrics);
        const options = metrics.track(`recovery/${branch}/message`, prefix, true);
        this.verificationRecoveryBodyAttachment = options !== undefined && this.verificationRecoveryBodyFact(attachment) !== undefined
          ? attachment : undefined;
        if (this.verificationRecoveryBodyAttachment !== undefined) this.scheduleVerificationRecoveryBody();
        return options;
      } catch (_unavailable) { return undefined; }
    };
  }

  private recoveryBodyExpansionObserver(branch: SourceRecoveryBranch): (generation: number, expanded: boolean) => void {
    return (generation: number, expanded: boolean): void => {
      const current = this.verificationOperationTextFact();
      const owner = sourceVerificationOpening(this.verificationOpening);
      if (owner === undefined || current?.scope !== 'operation-recovery' ||
        current.branch !== branch || current.generation !== generation) return;
      this.verificationRecoveryBodyExpanded = expanded ? { branch, generation, presentation: 'expanded' } : undefined;
      this.verificationRecoveryBodyAttachment = this.verificationRecoveryBodyExpanded;
      const expansionRevision = ++this.verificationRecoveryBodyRevision;
      ReaderUIVerificationProbe.emit('source.recovery-body-state', 'business', {
        owner, branch, generation, phase: expanded ? 'expanded' : 'collapsed', expansionRevision
      });
      if (expanded) this.scheduleVerificationRecoveryBody();
    };
  }

  private originalRecoveryView(): ReaderRecoveryView {
    const original = this.operation.original;
    return { message: original?.message ?? '', visible: original?.blocked === true,
      canRetry: true, generation: original?.generation ?? 0 };
  }

  private originalActionIdentities(): string[] {
    const original = this.operation.original;
    if (original?.blocked !== true) return [];
    return [JSON.stringify([this.temporaryBackIdentity, original.operationId ?? '', original.generation, original.writeStage])];
  }

  private originalActionGeneration(identity: string): number { return Number((JSON.parse(identity) as string[])[2]); }
  private originalActionCurrent(identity: string, generation: number): boolean {
    return this.managementInputIsCurrent() && this.recoveryOverlayVisible() &&
      this.originalActionIdentities().includes(identity) && generation === this.originalActionGeneration(identity) &&
      this.operation.original?.busy !== true;
  }

  private verificationRecoveryTitleKey: string = '';

  private verificationRecoveryFacts(): SourceRecoveryVerificationFacts | undefined {
    const original = this.operation.original;
    if (original?.blocked === true) {
      return { branch: 'original', generation: original.generation, busy: original.busy === true,
        canReconcile: true, canContinue: original.canRetryOriginal === true };
    }
    const receipt = this.operation.receipt;
    if (receipt?.receipt.confirmation === 'unknown') {
      return { branch: 'unknown', generation: receipt.facts.generation, busy: this.sourceListLoading(),
        canReconcile: receipt.facts.canRetry, canContinue: false };
    }
    return undefined;
  }

  private observeVerificationRecoveryTitle(opening: string, branch: SourceRecoveryBranch, generation: number,
    clipped: boolean | undefined): void {
    if (!ReaderUIVerificationProbe.enabled() || !this.managementBackIsCurrent(opening) || !this.recoveryOverlayVisible()) return;
    const owner = sourceVerificationOpening(this.verificationOpening);
    const facts = this.verificationRecoveryFacts();
    if (owner === undefined || facts?.branch !== branch || facts.generation !== generation) return;
    const title = clipped === undefined ? 'unmeasured' : clipped ? 'clipped' : 'fits';
    const key = JSON.stringify([owner.mounting, owner.generation, branch, generation, title, this.readerWindowMetricsRevision]);
    if (key === this.verificationRecoveryTitleKey) return;
    this.verificationRecoveryTitleKey = key;
    const observation: SourceRecoveryTitleObservation = { owner, branch, generation, title };
    ReaderUIVerificationProbe.emit('source.recovery-title', 'business', observation);
    if (this.verificationTextMetrics !== undefined) this.scheduleVerificationOperationText();
  }

  private unknownRecoveryTitleObserver(opening: string): (generation: number, clipped: boolean | undefined) => void {
    return (generation: number, clipped: boolean | undefined): void => {
      this.observeVerificationRecoveryTitle(opening, 'unknown', generation, clipped);
    };
  }

  @Builder
  private originalRecovery() {
    ForEach(this.originalActionIdentities(), (identity: string) => {
      ReaderRecoveryNotice({ view: this.originalRecoveryView(), layoutWidthVp: this.contentFrame().width, actionLabel: '核对',
        focusIdPrefix: 'reader-source-original', titleId: 'reader-source-recovery-message',
        textLayoutOptions: this.verificationTextMetrics === undefined ? undefined :
          this.recoveryGlyphOptions('original', this.originalActionGeneration(identity)),
        bodyTextLayoutOptions: this.verificationTextMetrics === undefined ? undefined : this.recoveryBodyGlyphOptions('original'),
        onBodyExpansion: this.verificationTextMetrics === undefined ? undefined : this.recoveryBodyExpansionObserver('original'),
        busy: this.operation.original?.busy === true,
        secondaryActionLabel: this.operation.original?.canRetryOriginal === true ?
          (this.operation.original?.confirmation === 'confirmed' && this.operation.original?.writeStage === 'cleanup' ? '继续清理' : '继续') : '',
        onReconcile: (generation: number): void => {
          if (this.originalActionCurrent(identity, generation)) this.onReconcile(generation);
        },
        onSecondaryAction: (generation: number): void => {
          if (this.originalActionCurrent(identity, generation) && this.operation.original?.canRetryOriginal === true)
            this.onContinueOriginal(generation);
        },
        onTitleMeasured: (generation: number, clipped: boolean | undefined): void => {
          if (this.originalActionIdentities().includes(identity) && generation === this.originalActionGeneration(identity)) {
            this.observeVerificationRecoveryTitle(this.temporaryBackIdentity, 'original', generation, clipped);
          }
        } });
    }, (identity: string): string => identity);
  }

  @Builder
  private pendingRecovery() {
    if (this.recoveryOverlayVisible()) {
      Scroll() {
        Column() {
          if (this.operation.original?.blocked === true) { this.originalRecovery(); }
          else if (this.operation.receipt?.receipt.confirmation === 'unknown') {
            ReaderRecoveryNotice({ view: this.recovery(), layoutWidthVp: this.contentFrame().width, actionLabel: '核对',
              focusIdPrefix: 'reader-source-unknown', titleId: 'reader-source-recovery-message', busy: this.sourceListLoading(),
              textLayoutOptions: this.verificationTextMetrics === undefined ? undefined :
                this.recoveryGlyphOptions('unknown', this.recovery().generation),
              bodyTextLayoutOptions: this.verificationTextMetrics === undefined ? undefined : this.recoveryBodyGlyphOptions('unknown'),
              onBodyExpansion: this.verificationTextMetrics === undefined ? undefined : this.recoveryBodyExpansionObserver('unknown'),
              onReconcile: this.unknownReceiptAction(this.temporaryBackIdentity),
              onTitleMeasured: this.unknownRecoveryTitleObserver(this.temporaryBackIdentity) });
          }
        }.width('100%');
      }.id('reader-source-pending-recovery').width(this.contentFrame().width)
        .constraintSize({ maxHeight: this.recoveryOverlayBottom() - this.recoveryOverlayTop() })
        .margin({ left: this.contentFrame().left, top: this.recoveryOverlayTop() })
        .scrollBar(BarState.Auto).clip(true).hitTestBehavior(HitTestMode.Default)
        .onTouch((event: TouchEvent): void => event.stopPropagation());
    }
  }

  private recoveryOverlayBottom(): number { return Math.min(this.overlayBottom(), this.geometry.footer.top); }
  private recoveryOverlayTop(): number {
    const start = this.geometry.content.startInset;
    const searchBottom = start + Math.max(44, this.layoutBudget().filterHeight) + TOK_SPACE_XS * 2;
    return this.recoveryOverlayBottom() - searchBottom >= 44 ? searchBottom : start;
  }
  private recoveryOverlayVisible(): boolean {
    this.readerWindowMetricsRevision;
    return this.managementInputIsCurrent() && !this.groupOpen && !this.groupClosing &&
      !ReaderWindowCoordinator.metrics().keyboardArea.visible && this.hasPendingSourceRecovery() &&
      this.recoveryOverlayBottom() > this.recoveryOverlayTop();
  }

  private unknownReceiptAction(opening: string): (generation: number) => void {
    return (generation: number): void => {
      const receipt = this.operation.receipt;
      if (this.managementBackIsCurrent(opening) && this.managementInputIsCurrent() && this.recoveryOverlayVisible() &&
        this.operation.original?.blocked !== true && !this.sourceListLoading() &&
        receipt?.receipt.confirmation === 'unknown' && receipt.facts.canRetry && receipt.facts.generation === generation) {
        this.onReconcile(generation);
      }
    };
  }

  private feedbackIdentity(): string {
    return `${this.operation.receipt?.facts.generation ?? 0}:${this.operation.readFacts?.generation ?? 0}:` +
      `${this.statusKind}:${this.statusMessage}`;
  }

  private transientTextFact(message: string): SourceTransientTextFact | undefined {
    if (this.verificationTextMetrics === undefined || !ReaderUIVerificationProbe.enabled() ||
      !this.managementOpeningIsCurrent()) return undefined;
    const owner = sourceVerificationOpening(this.verificationOpening);
    if (owner === undefined) return undefined;
    const readGeneration = this.operation.readFacts?.generation ?? 0;
    if (this.verificationReadTextScope() === 'retained-read-failed' && readGeneration > 0) {
      return { scope: 'retained-read-failed', owner, readGeneration };
    }
    const receipt = this.operation.receipt;
    if (this.operation.action === 'import' && this.statusKind === 'success' &&
      this.statusMessage === message && message.startsWith('书源导入完成：') &&
      receipt?.receipt.confirmation === 'confirmed' && receipt.receipt.readback === 'succeeded' &&
      receipt.facts.generation > 0) {
      return { scope: 'operation-status', owner, readGeneration, branch: 'import', generation: receipt.facts.generation };
    }
    return undefined;
  }

  private transientTextObserver(message: string): ReaderTransientTextObserver | undefined {
    const fact = this.transientTextFact(message);
    if (fact === undefined) return undefined;
    const metrics = new ReaderSourceTextMetrics('');
    const role = fact.scope === 'operation-status' ? 'operation/status' : 'read/retained-status';
    const key = JSON.stringify(fact);
    let windowSamplePublishedAt: number | undefined = undefined;
    let stopWindowSamples: (() => void) | undefined = undefined;
    return {
      textOptions: (text: string): TextOptions | undefined => metrics.track(role, text),
      onPublished: (toastGeneration: number, durationMs: number): void => {
        if (fact.scope === 'operation-status' && fact.branch === 'import') {
          windowSamplePublishedAt = ReaderUIVerificationProbe.sourceImportToastPublishedAt(durationMs);
        }
        ReaderUIVerificationProbe.emit('source.transient-feedback', 'business', {
          scope: fact.scope, owner: fact.owner, readGeneration: fact.readGeneration,
          branch: fact.branch, generation: fact.generation, phase: 'published',
          toastGeneration, durationMs,
        });
      },
      onLayout: (toastGeneration: number, hostId: number, durationMs: number): boolean => {
        const current = this.transientTextFact(message);
        const window = this.verificationTextLayoutScope('surface');
        if (JSON.stringify(current) !== key || window === undefined || window.readGeneration !== fact.readGeneration) return false;
        const status = fact.scope === 'operation-status' ? this.verificationOperationTextFact() : undefined;
        if (fact.scope === 'operation-status' && (status?.scope !== 'operation-status' ||
          status.generation !== fact.generation || status.statusRevision === undefined)) return false;
        const labels = metrics.readTracked();
        if (labels.length !== 1 || labels[0].lines.length === 0) return false;
        ReaderUIVerificationProbe.emit('source.transient-text-layout', 'business', {
          owner: window.owner, textProjectionRevision: window.textProjectionRevision,
          filterRevision: window.filterRevision, readGeneration: window.readGeneration,
          windowRevision: window.windowRevision, widthVp: window.widthVp, heightVp: window.heightVp,
          density: window.density, systemFontScale: window.systemFontScale, fontScale: window.fontScale,
          rowAnchor: window.rowAnchor, scope: fact.scope, branch: fact.branch,
          generation: fact.generation, statusRevision: status?.statusRevision,
          toastGeneration, hostId, durationMs, labels,
        });
        if (windowSamplePublishedAt !== undefined) {
          const publishedAt = windowSamplePublishedAt;
          windowSamplePublishedAt = undefined;
          const windowId = ReaderWindowCoordinator.diagnosticWindowId();
          if (windowId !== null) {
            stopWindowSamples = ReaderUIVerificationProbe.sampleSourceImportToastWindow(publishedAt, durationMs,
              windowId, window.windowRevision, (): boolean =>
                ReaderWindowCoordinator.diagnosticWindowId() === windowId &&
                readerTransientTextObserver(toastGeneration, hostId) !== undefined &&
                JSON.stringify(this.transientTextFact(message)) === key);
          }
        }
        return true;
      },
      onRetired: (toastGeneration: number, durationMs: number): void => {
        windowSamplePublishedAt = undefined;
        stopWindowSamples?.();
        stopWindowSamples = undefined;
        ReaderUIVerificationProbe.emit('source.transient-feedback', 'business', {
          scope: fact.scope, owner: fact.owner, readGeneration: fact.readGeneration,
          branch: fact.branch, generation: fact.generation, phase: 'retired',
          toastGeneration, durationMs,
        });
      },
    };
  }

  private onMessageChanged(): void {
    this.scheduleSourceAnchorRestore();
    this.observeVerificationProjection('owner-update');
    this.scheduleImportStatusReadyObservation();
    const identity = this.feedbackIdentity();
    if (!this.mounted || identity === this.lastFeedbackIdentity) return;
    this.lastFeedbackIdentity = identity;
    if (this.sourceListLoading()) {
      this.lastToastMessage = '';
      return;
    }
    if (this.hasPendingSourceRecovery() || this.hasEmptyListReadFailure()) return;
    const message = this.statusMessage || (this.recovery().visible ? this.recovery().message : '');
    if (message.length === 0 || message.startsWith('正在') || message === this.lastToastMessage) return;
    this.lastToastMessage = message;
    let textObserver: ReaderTransientTextObserver | undefined;
    try { if (this.verificationTextMetrics !== undefined) textObserver = this.transientTextObserver(message); } catch (_) {}
    try {
      this.transientFeedback.show(() => this.getUIContext(), { message, duration: READER_FEEDBACK_EXTENDED_MS, textObserver },
        (): boolean => this.mounted);
    } catch (_) {}
  }

  @Builder
  private statusAction() {
    if (this.statusActionLabel.length > 0 && !this.hasPendingSourceRecovery()) {
      ForEach([this.statusActionGeneration], (generation: number): void => {
        ReaderRecoveryAction({ label: this.statusActionLabel, generation,
          focusId: 'reader-source-status-action',
          textLayoutOptions: this.verificationTextMetrics === undefined ? undefined : this.statusGlyphOptions(generation),
          onReconcile: this.statusListAction(this.temporaryBackIdentity) });
      }, (generation: number): string => `source-status-action:${generation}`);
    }
  }

  @Builder
  private filterArea() {
    Row({ space: TOK_SPACE_XS }) {
      this.statusFilter();
      ForEach([this.temporaryBackIdentity], (identity: string): void => { this.importAction(identity); },
        (identity: string): string => identity);
    }
    .width(this.contentFrame().width)
    .constraintSize({ minHeight: this.layoutBudget().filterHeight })
    .alignItems(VerticalAlign.Center)
    .margin({ top: TOK_SPACE_XS });
  }

  @Builder
  private categoryFilter() {
    Scroll() {
      Row({ space: TOK_SPACE_XS }) {
        ForEach(['all', 'novel', 'comic', 'music', 'download', 'external', 'other'], (category: string) => {
          ReaderButton({ scheme: this.appThemeScheme, specId: 'source-management-category',
            variant: this.categoryValue === category ? 'tonal' : 'subtle', visualSize: 'small',
            textLayoutOptions: category === 'all' ? this.verificationTextOptions?.('category/all', undefined, '全部类型') :
              this.verificationFilterTextMetrics?.has('category') ?
                this.filterTextLayoutOptions('category', category, readerSourceCategoryLabel(category as ReaderSourceCategory)) : undefined,
            onFocused: (): void => this.cancelToolsReturnFocus('other-focus'),
            label: category === 'all' ? '全部类型' : readerSourceCategoryLabel(category as ReaderSourceCategory),
            primary: this.categoryValue === category, selectionSemantic: true,
            actionAccessibilityLabel: `书源类型，${category === 'all' ? '全部类型' : readerSourceCategoryLabel(category as ReaderSourceCategory)}`,
            onAction: (): void => {
              if (!this.managementInputIsCurrent() || this.groupOpen) return;
              this.cancelToolsReturnFocus('selection');
              this.categoryValue = category;
              this.rebuildSourceProjection('category');
            } })
            .id(`source-category-${category}`);
        }, (category: string): string => category);
      }
    }
    .id('reader-source-category-filter')
    .scrollable(ScrollDirection.Horizontal)
    .scrollBar(BarState.Off)
    .width(this.contentFrame().width)
    .height(this.layoutBudget().filterHeight)
    .margin({ top: TOK_SPACE_XS })
    .onScrollStop((): void => this.scheduleVerificationFilterText('category', 'settled'));
  }

  @Builder
  private statusFilter() {
    Scroll() {
    Row({ space: SOURCE_STATUS_CHIP_GAP }) {
      this.chip('全部', 'all', 58, true);
      this.chip('启用', 'enabled', 72, true, '已启用');
      this.chip('异常', 'error', 58, true);
      this.chip('未检测', 'unchecked', 72, true, '未测速');
      // 原稿保留该视觉位，但没有稳定业务定义；禁用比伪造筛选语义更诚实。
      this.chip('自定义', 'custom', 72, false);
    }
    .width(this.layoutBudget().statusContentWidth)
    .height(this.layoutBudget().filterHeight)
    .alignItems(VerticalAlign.Center);
    }
    .id('reader-source-status-filter')
    .width(this.filterControlWidth())
    .height(this.layoutBudget().filterHeight)
    .scrollable(ScrollDirection.Horizontal)
    .scrollBar(BarState.Off)
    .onScrollStop((): void => this.scheduleVerificationFilterText('status', 'settled'));
  }

  @Builder
  private chip(label: string, verificationId: string, width: number, enabled: boolean, title: string = label) {
    ReaderButton({ scheme: this.appThemeScheme, specId: width === 58 ? 'source-management-status-compact' : 'source-management-status-wide',
      variant: enabled && this.statusValue === label ? 'tonal' : 'subtle', visualSize: 'small',
      onFocused: (): void => this.cancelToolsReturnFocus('other-focus'),
      label: title, primary: enabled && this.statusValue === label, actionEnabled: enabled, availableWidth: this.filterControlWidth(),
      textLayoutOptions: verificationId !== 'all' && this.verificationFilterTextMetrics?.has('status') ?
        this.filterTextLayoutOptions('status', verificationId, title) : this.textLayoutOptions?.(`chip/${label}`, undefined, title),
      selectionSemantic: true, actionAccessibilityLabel: `书源状态，${title}${enabled ? '' : '，暂不可用'}`,
      onAction: (): void => {
        if (!enabled || !this.managementInputIsCurrent() || this.groupOpen) return;
        this.cancelToolsReturnFocus('selection');
        this.statusValue = label;
        this.rebuildSourceProjection('status');
      } }).id(`reader-source-status-${verificationId}`);
  }

  private filterTextLayoutOptions(lane: SourceFilterTextLane, role: string, label: string): TextOptions | undefined {
    try { return this.verificationFilterTextMetrics.get(lane)?.track(`${lane}/${role}`, label); }
    catch (_unavailable) { return undefined; }
  }

  @Builder
  private groupFilter() {
    Row() {
      ReaderSelect({
        value: this.groupValue,
        options: this.groupOptions(),
        controlWidth: this.groupSelectWidth(),
        isOpen: this.groupOpen,
        variant: 'sourceGroup',
        reduceMotion: this.reduceMotion,
        focusId: this.groupTriggerFocusId(),
        onToggle: (): void => this.toggleGroupSelection(),
      })
      .id('reader-source-group-trigger')
      .visibility(this.groupOpen ? Visibility.Hidden : Visibility.Visible)
      .onAreaChange((_oldValue: Area, newValue: Area): void => this.recordGroupTrigger(newValue));
    }
    .id('reader-source-group-filter')
    .width(this.groupSelectWidth())
    .constraintSize({ minHeight: 44 })
    .alignItems(VerticalAlign.Center);
  }

  @Builder
  private sourceList() {
    List({ scroller: this.sourceScroller }) {
      // Filters remain ordinary scroll content; only the navigation and
      // action bars float. The list viewport extends behind both bars.
      ListItem() {
        Column() {
          this.searchField();
          this.statsRow();
          this.statusAction();
          if (!this.hasPendingSourceRecovery() && !this.sourceListLoading() && this.recovery().canRetry && this.sources.length > 0) {
            ReaderRecoveryAction({ label: '刷新列表', generation: this.recovery().generation,
              focusId: 'reader-source-retained-read-retry',
              textLayoutOptions: this.verificationReadTextScope() === 'retained-read-failed' ?
                this.verificationSurfaceTextOptions('retained-read-failed', 'read/retained-retry', '刷新列表') : undefined,
              onReconcile: this.retryRetainedListAction(this.temporaryBackIdentity) });
          }
          if (this.sourceListLoading() && this.sources.length > 0 && !this.hasPendingSourceRecovery()) {
            ReaderPageState({ variant: 'inline', padded: false, loading: true,
              loadingProgressId: 'reader-source-loading-progress',
              onLoadingProgressVisible: this.verificationLoadingObserver(),
              loadingActive: !this.reduceMotion, message: this.statusMessage || '正在读取书源' })
              .padding({ top: 12, bottom: 12 });
          }
          this.filterArea();
          this.categoryFilter();
        }.id('reader-source-filter-block').width('100%').padding({ bottom: TOK_SPACE_CONTROL_INLINE });
      }
      if (this.sources.length === 0 && !this.hasPendingSourceRecovery()) {
        ListItem() {
          ReaderPageState({ title: this.readPageStateTitle(), message: this.readPageStateMessage(),
            titleTextId: this.verificationTextMetrics === undefined ? '' :
              this.hasEmptyListReadFailure() && !this.sourceListLoading() ? SOURCE_READ_FAILURE_TITLE : 'reader-source-text-read-title',
            messageTextId: this.verificationTextMetrics === undefined ? '' : 'reader-source-text-read-message',
            titleTextLayoutOptions: this.readPageStateTextOptions('title'),
            messageTextLayoutOptions: this.readPageStateTextOptions('message'),
            loading: this.sourceListLoading(),
            loadingProgressId: 'reader-source-loading-progress',
            onLoadingProgressVisible: this.verificationLoadingObserver(),
            loadingActive: !this.reduceMotion,
            actionLabel: this.hasEmptyListReadFailure() ? '重试' : '',
            actionFocusId: this.hasEmptyListReadFailure() ? 'reader-source-read-retry' : '',
            actionTextLayoutOptions: this.readPageStateTextOptions('retry'),
            actionGeneration: this.operation.readFacts?.generation ?? 0,
            onAction: this.retryEmptyListAction(this.temporaryBackIdentity) });
        }.id('reader-source-empty-state');
      }
      if (this.hasFilteredEmpty()) {
        ListItem() {
          ReaderPageState({ title: '没有匹配的书源', message: '调整搜索、状态、分类或分组',
            actionLabel: '清除筛选', actionFocusId: 'reader-source-clear-filters', onAction: (): void => this.clearFilters() });
        }.id('reader-source-filtered-empty');
      }
      // LazyForEach owns an explicit data source so an empty-to-populated Core
      // load and later filter replacements can notify ArkUI after mount. A
      // reusable Repeat over a derived array retained zero stale rows on API
      // 23 even though the surrounding count text had already updated.
      LazyForEach(this.sourceDataSource, (source: BookSource) => {
        ListItem() {
          this.sourceRow(source);
        }
      }, (source: BookSource): string => this.sourceRowKey(source));
    }
    .id(this.editingScroll.id)
    .width('100%')
    .height('100%')
    .padding({ left: this.contentFrame().left, right: this.contentFrame().right })
    .contentStartOffset(readerScrollStartOffset(this.scrollLayout()))
    .contentEndOffset(readerScrollEndOffset(this.scrollLayout()))
    .scrollBar(BarState.Off)
    .onAppear((): void => {
      this.editingScroll.mount(this.getUIContext(), this.editingHost, this.sourceScroller,
        (): number => this.geometry.content.startInset);
      this.listMounted = true;
      if (this.pendingScroll === undefined && this.pendingSourceAnchor.length === 0) {
        try { this.sourceScroller.scrollEdge(Edge.Top); } catch (_unbound) {}
      } else this.scheduleSourceAnchorRestore();
    })
    .onAreaChange((): void => { this.editingHost.refresh(); this.scheduleSourceAnchorRestore(); })
    .onDisAppear((): void => { this.editingScroll.unmount(); this.listMounted = false; })
    .onScrollIndex((start: number): void => {
      if (!this.listMounted || this.pendingScroll !== undefined || this.pendingSourceAnchor.length > 0) return;
      this.firstVisibleListIndex = Math.max(0, start);
      // The permanent filter header is the first native ListItem.
      this.firstVisibleSourceId = start > 0 ? this.projectedSources[start - 1]?.sourceId ?? '' : '';
    })
    .onScrollStop((): void => this.captureScroll('settled'))
    .onTouch((event: TouchEvent): void => { if (event.type === TouchType.Down) this.cancelScrollRestore(); })
    .onWillScroll((_offset: number, _state: ScrollState, source: ScrollSource): void => {
      if (source === ScrollSource.DRAG || source === ScrollSource.OTHER_USER_INPUT || source === ScrollSource.SCROLL_BAR) {
        this.cancelScrollRestore();
        this.cancelToolsReturnFocus('scroll');
      }
    });
  }

  private scheduleSourceAnchorRestore(): void {
    if (!this.managementOpeningIsCurrent() || !this.listMounted || this.anchorRestoreScheduled ||
      (this.pendingScroll === undefined && this.pendingSourceAnchor.length === 0) || this.sourceAnchorReadPending()) return;
    if (!this.sourceReturnFiltersMatch()) { this.cancelScrollRestore(); return; }
    const pending = this.pendingScroll;
    if (pending !== undefined && pending.filterKey !== this.currentFilterKey()) { this.cancelScrollRestore(); return; }
    const identity = this.temporaryBackIdentity, epoch = ++this.scrollRestoreEpoch;
    this.anchorRestoreScheduled = true;
    const current = (): boolean => this.managementOpeningIsCurrent() && this.listMounted &&
      identity === this.temporaryBackIdentity && epoch === this.scrollRestoreEpoch && this.sourceReturnFiltersMatch();
    try {
      this.getUIContext().postFrameCallback(new SourceListLayoutFrame(this.getUIContext(), (): void => {
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
        const fallback = pending === undefined ? this.initialViewState?.anchorFallbackIndex ?? -1 : pending.firstIndex - 1;
        const index = exact >= 0 ? exact : Math.min(Math.max(0, fallback), this.projectedSources.length - 1);
        const targetId = this.projectedSources[index].sourceId;
        try { this.sourceScroller.scrollToIndex(index + 1, false, ScrollAlign.START); }
        catch (_unbound) { this.cancelScrollRestore(); return; }
        this.getUIContext().postFrameCallback(new SourceListLayoutFrame(this.getUIContext(), (): void => {
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
                pending.itemY : readerScrollStartOffset(this.scrollLayout());
              if (rect.height > 0 && Number.isFinite(rect.y)) this.sourceScroller.scrollBy(0, rect.y - desired);
              this.firstVisibleSourceId = targetId;
              this.firstVisibleListIndex = index + 1;
            }
          } catch (_unbound) {}
          this.cancelScrollRestore();
          this.observeRestoredScroll(pending);
        }));
      }));
    } catch (_unmounted) { this.cancelScrollRestore(); }
  }

  private currentFilterKey(): string {
    return sourceManagementFilterKey({ searchQuery: this.searchQuery, status: this.statusValue,
      category: this.categoryValue, group: this.groupValue });
  }

  private scrollLayoutKey(): string {
    const metrics = ReaderWindowCoordinator.metrics();
    // Opening and closing the keyboard in Tools advances the shared window
    // revision even when the parent returns to the same layout.
    return JSON.stringify([this.contentFrame().width, this.fontScale(), this.expandedLayout,
      metrics.windowRect.height, metrics.densityPixels,
      readerInteractiveSafeTop(metrics), readerInteractiveSafeBottom(metrics)]);
  }

  private cancelScrollRestore(): void {
    this.scrollRestoreEpoch += 1;
    this.pendingScroll = undefined;
    this.pendingSourceAnchor = '';
    this.anchorRestoreScheduled = false;
  }

  private readCurrentScroll(): SourceManagementScrollState | undefined {
    if (!this.managementOpeningIsCurrent() || !this.listMounted || this.pendingScroll !== undefined ||
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

  private captureScroll(trigger: string): void {
    const measured = this.readCurrentScroll();
    if (measured === undefined) return;
    this.capturedScroll = measured;
    this.observeVerificationScroll(trigger, measured);
  }

  private observeRestoredScroll(saved?: SourceManagementScrollState): void {
    if (!ReaderUIVerificationProbe.enabled() || this.verificationOpening.length === 0) return;
    try {
      const context = this.getUIContext();
      context.postFrameCallback(new SourceListLayoutFrame(context, (): void => {
        const measured = this.readCurrentScroll();
        if (measured !== undefined) this.observeVerificationScroll('restored', measured, saved);
      }));
    } catch (_unmounted) {}
  }

  private sourceAnchorReadPending(): boolean {
    const fact = this.operation.readFacts?.fact;
    return fact === 'loading' || fact === 'refreshing' || (fact === undefined && this.statusKind === 'loading');
  }

  private sourceReturnFiltersMatch(): boolean {
    const initial = this.initialViewState;
    return initial !== undefined && initial.searchQuery === this.searchQuery && initial.status === this.statusValue &&
      initial.category === this.categoryValue && initial.group === this.groupValue;
  }

  @Builder
  private sourceRow(source: BookSource) {
    Column({ space: TOK_SPACE_XS }) {
      if (this.layoutBudget(this.currentSourceRow(source)).rowForm === 'stacked-leading') {
        this.sourceLeading(source);
        this.currentSourceInfo(source);
        this.sourceActions(source);
      } else {
        Row({ space: TOK_SPACE_XS }) {
          this.sourceLeading(source);
          this.currentSourceInfo(source);
          if (this.layoutBudget(this.currentSourceRow(source)).rowForm === 'inline') {
            this.sourceActions(source);
          }
        }.width('100%').alignItems(VerticalAlign.Center);
        if (this.layoutBudget(this.currentSourceRow(source)).rowForm === 'stacked-actions') {
          this.sourceActions(source);
        }
      }
    }
    .id(this.verificationRowId(source.sourceId))
    .width(this.contentFrame().width)
    .constraintSize({ minHeight: this.layoutBudget(this.currentSourceRow(source)).rowMinHeight })
    .padding({ right: TOK_SPACE_XS })
    .alignItems(HorizontalAlign.Start)
    .border({ width: { top: TOK_BORDER_W }, color: readerAppColor('TOK_ROW_DIVIDER', this.appThemeScheme) });
  }

  private currentSourceRow(source: BookSource): BookSource {
    // The retained row must observe the owner publication that changes its content slots.
    return (this.sources ?? this.projectedSources).find(
      (current: BookSource): boolean => current.sourceId === source.sourceId) ?? source;
  }

  @Builder
  private currentSourceInfo(source: BookSource) {
    ForEach([this.currentSourceRow(source)], (current: BookSource): void => {
      this.sourceInfo(current);
    }, (current: BookSource): string => this.sourceRenderKey(current));
  }

  @Builder
  private sourceLeading(source: BookSource) {
    Stack({ alignContent: Alignment.Center }) {
      Image(this.sourceCategoryIcon(this.currentSourceRow(source).category))
        .width(20).height(20).accessibilityLevel('no');
    }.width(SOURCE_ROW_ICON_WIDTH).height(32);
  }

  private sourceCategoryIcon(category: ReaderSourceCategory): Resource {
    const night = this.appThemeScheme === 'night';
    if (category === 'novel') {
      return night ? $r('app.media.bookshelf_library_outline_theme_night') : $r('app.media.bookshelf_library_outline');
    }
    if (category === 'comic') {
      return night ? $r('app.media.manga_sheet_horizontal_theme_night') : $r('app.media.manga_sheet_horizontal');
    }
    return night ? $r('app.media.source_group_folder_theme_night') : $r('app.media.source_group_folder');
  }

  private sourceDomain(source: BookSource): string {
    return httpUrlHostname(source.baseUrl) ?? source.baseUrl;
  }

  @Builder
  private sourceInfo(source: BookSource) {
    Column({ space: 3 }) {
      Text(source.name, this.textLayoutOptions?.('row/title', source.sourceId, source.name))
        .id(this.verificationTextOptions !== undefined && source.sourceId === this.verificationTextRowId ? 'reader-source-text-row-title' : '')
        .width('100%')
        .fontFamily(TYPE_SOURCE_MANAGEMENT_ROW_TITLE.fontFamily)
        .fontWeight(TYPE_SOURCE_MANAGEMENT_ROW_TITLE.fontWeight)
        .fontSize(TYPE_SOURCE_MANAGEMENT_ROW_TITLE.fontSizeFp)
        .maxFontScale(this.fontScale())
        .lineHeight(TYPE_SOURCE_MANAGEMENT_ROW_TITLE.lineHeightFp as number)
        .fontColor(readerAppColor('TOK_INK', this.appThemeScheme))
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
        .ellipsisMode(this.metadataEllipsisMode);
      Text(this.sourceDomain(source), this.textLayoutOptions?.('row/domain', source.sourceId, this.sourceDomain(source)))
        .id(this.verificationRowTextId(source.sourceId, 'reader-source-text-row-domain'))
        .width('100%')
        .fontFamily(TYPE_SOURCE_MANAGEMENT_META.fontFamily as string)
        .fontWeight(TYPE_SOURCE_MANAGEMENT_META.fontWeight ?? 400)
        .fontSize(TYPE_SOURCE_MANAGEMENT_META.fontSizeFp)
        .maxFontScale(this.fontScale())
        .lineHeight(TYPE_SOURCE_MANAGEMENT_META.lineHeightFp as number)
        .fontColor(readerAppColor('TOK_CONTROL_INK', this.appThemeScheme))
        .wordBreak(WordBreak.BREAK_ALL)
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
        .ellipsisMode(this.metadataEllipsisMode);
    }
    .layoutWeight(this.layoutBudget(source).rowForm === 'stacked-leading' ? 0 : 1)
    .width(this.layoutBudget(source).rowForm === 'stacked-leading' ? '100%' : undefined)
    .constraintSize({ minWidth: this.layoutBudget(source).textMinWidth })
    .accessibilityGroup(true)
    .accessibilityText(`${source.name}，${readerSourceCategoryLabel(source.category)}，${source.baseUrl}`)
    .alignItems(HorizontalAlign.Start);
  }

  @Builder
  private sourceActions(source: BookSource) {
    Column() {
      ForEach([this.currentSourceRow(source)], (current: BookSource): void => {
        this.detectButton(current);
      }, (current: BookSource): string => this.sourceRenderKey(current));
      Row({ space: TOK_SPACE_XS }) {
        ForEach([this.currentSourceRow(source)], (current: BookSource): void => {
          if (current.loginUrl !== undefined && current.loginUrl.trim().length > 0) this.loginButton(current);
        }, (current: BookSource): string => this.sourceRenderKey(current));
        Row() {
          this.sourceSwitch(source.enabled, (next: boolean): void => this.sourceRowToggle(this.currentSourceRow(source))(next), source.sourceId, source.name);
        }.width(resolveReaderButtonSpec('source-management-detect').fixedWidth * this.fontScale())
          .justifyContent(FlexAlign.Center);
      }.width('100%').justifyContent(FlexAlign.End);
    }
    .width(this.layoutBudget(this.currentSourceRow(source)).trailingWidth)
    .alignItems(HorizontalAlign.End)
    .constraintSize({ minHeight: this.layoutBudget(this.currentSourceRow(source)).actionsHeight });
  }

  @Builder
  private detectButton(source: BookSource) {
    ReaderButton({ scheme: this.appThemeScheme, specId: 'source-management-detect',
      variant: 'tonal', visualSize: 'small',
      textLayoutOptions: this.textLayoutOptions?.('row/detect', source.sourceId, source.checkState === 'checking' ? '检测中' : '检测'),
      onFocused: (): void => this.cancelToolsReturnFocus('other-focus'),
      label: source.checkState === 'checking' ? '检测中' : '检测', isBusy: source.checkState === 'checking',
      actionEnabled: this.sourceDetectEnabled(source.sourceId),
      actionAccessibilityLabel: this.sourceActionLabel(source, `检测，${this.sourceBadgeLabel(source)}`,
        this.sourceDetectEnabled(source.sourceId), source.checkState === 'checking'),
      leading: (): void => { this.statusBadge(source); },
      onAction: this.sourceRowCommand(source, 'check') })
      .id(this.verificationRowTextId(source.sourceId, 'reader-source-text-row-detect'))
      .flexShrink(0);
  }

  @Builder
  private loginButton(source: BookSource) {
    ReaderButton({ scheme: this.appThemeScheme, specId: 'source-management-login', label: '登录',
      variant: 'subtle', visualSize: 'small',
      textLayoutOptions: this.textLayoutOptions?.('row/login', source.sourceId,
        this.verificationRowActionsCurrent(source) ? '登录' : undefined),
      onFocused: (): void => this.cancelToolsReturnFocus('other-focus'),
      isBusy: source.checkState === 'checking',
      actionEnabled: this.sourceActionEnabled() && source.checkState !== 'checking',
      actionAccessibilityLabel: this.sourceActionLabel(source, '登录', this.sourceActionEnabled() && source.checkState !== 'checking', source.checkState === 'checking'),
      onAction: this.sourceRowCommand(source, 'login') })
      .id(this.verificationRowActionsCurrent(source) ? 'reader-source-text-row-login' : '')
      .flexShrink(0);
  }

  private sourceRowIsCurrent(source: BookSource, opening: string): boolean {
    if (!this.managementBackIsCurrent(opening) || this.isInputAllowed?.() === false || this.groupOpen) return false;
    const current = this.projectedSources.find((candidate: BookSource): boolean => candidate.sourceId === source.sourceId);
    return current !== undefined && this.sourceRenderKey(current) === this.sourceRenderKey(source);
  }

  private sourceRowCommand(source: BookSource, command: 'check' | 'login'): () => void {
    const opening = this.temporaryBackIdentity;
    return (): void => {
      if (!this.sourceRowIsCurrent(source, opening)) return;
      if (command === 'check') {
        if (this.sourceDetectEnabled(source.sourceId)) this.onDetectSource(source.sourceId);
      } else if (source.loginUrl !== undefined && this.sourceActionEnabled() && source.checkState !== 'checking') {
        this.onLoginSource(source.sourceId, source.loginUrl);
      }
    };
  }

  private sourceRowToggle(source: BookSource): (next: boolean) => void {
    const opening = this.temporaryBackIdentity;
    return (next: boolean): void => {
      if (this.sourceRowIsCurrent(source, opening)) this.onToggleSource(source.sourceId, next);
    };
  }

  @Builder
  private statusBadge(source: BookSource) {
    StatusBadge({ status: this.sourceBadgeStatus(source), label: this.sourceBadgeLabel(source), symbolOnly: true,
      verificationId: this.verificationRowActionsCurrent(source) ?
        `reader-source-row-status-${source.checkState ?? 'unchecked'}` : '' })
      .id(this.offlineDetectBadgeId(source))
      .flexShrink(0);
  }

  private offlineDetectBadgeId(source: BookSource): string {
    if (source.offlineDetectReportVersion === undefined || !ReaderUIVerificationProbe.enabled()) return '';
    if (source.checkState === 'unchecked') return 'reader-source-offline-detect-ready';
    if (source.checkState === 'failed') return 'reader-source-offline-detect-failed';
    return '';
  }

  private verificationRowActionsCurrent(source: BookSource): boolean {
    return this.verificationTextOptions !== undefined && source.sourceId === this.verificationTextRowId &&
      this.projectedSources.length === 1 && sourceVerificationRowActions(source) !== undefined;
  }

  private sourceSwitchValue(sourceId: string, fallback: boolean): boolean {
    // An unchanged LazyForEach key retains this control across owner publications.
    const current = (this.sources ?? this.projectedSources).find((source: BookSource): boolean => source.sourceId === sourceId);
    return current?.enabled ?? fallback;
  }

  private sourceSwitchName(sourceId: string, fallback: string): string {
    return this.projectedSources.find((source: BookSource): boolean => source.sourceId === sourceId)?.name ?? fallback;
  }

  @Builder
  private sourceSwitch(value: boolean, onTap: (next: boolean) => void, sourceId: string, sourceName: string = '') {
    ForEach([`${this.temporaryBackIdentity}:${sourceId}`], (identity: string): void => {
      ReaderToggle({ value: this.sourceSwitchValue(sourceId, value), specId: 'standard-toggle', inputIdentity: identity,
        accessibilityLabel: `${this.sourceSwitchName(sourceId, sourceName).trim() || sourceId}，启用书源${this.sourceToggleBusy() ? '，忙碌' : this.sourceActionEnabled() ? '' : '，暂不可用'}`, actionEnabled: this.sourceActionEnabled(), isBusy: this.sourceToggleBusy(),
        onToggle: (next: boolean): void => {
          if (identity === `${this.temporaryBackIdentity}:${sourceId}` && this.sourceActionEnabled() && !this.sourceToggleBusy()) onTap(next);
        } })
        .id((this.verificationOpening ?? '').length > 0 && ReaderUIVerificationProbe.enabled() &&
          this.projectedSources.length === 1 && this.projectedSources[0].sourceId === sourceId &&
          sourceVerificationToggleAnchor(this.projectedSources[0]) > 0 ? 'reader-source-public-toggle-fixture' : '')
        .flexShrink(0);
    }, (identity: string): string => identity);
  }

  private sourceToggleBusy(): boolean {
    return this.operation.original?.busy === true || this.operation.receipt?.facts.fact === 'refreshing';
  }

  private sourceActionEnabled(): boolean {
    return this.inputEnabled && this.managementBackIsCurrent(this.temporaryBackIdentity) && this.isInputAllowed?.() !== false &&
      !this.groupOpen && this.operation.original?.blocked !== true && this.operation.receipt?.receipt.confirmation !== 'unknown';
  }

  private sourceActionLabel(source: BookSource, action: string, enabled: boolean, busy: boolean): string {
    const entity = source.name.trim().length > 0 ? source.name : source.sourceId;
    return `${entity}，${action}${busy ? '，忙碌' : enabled ? '' : '，暂不可用'}`;
  }

  private sourceDetectEnabled(sourceId: string): boolean {
    if (!this.inputEnabled || !this.managementBackIsCurrent(this.temporaryBackIdentity) || this.isInputAllowed?.() === false || this.groupOpen) return false;
    const current = this.sources.find((candidate: BookSource): boolean => candidate.sourceId === sourceId);
    // Diagnostic intent neither confirms nor replays an unresolved source write.
    return current !== undefined && current.checkState !== 'checking';
  }

  @Builder
  private bottomActionBar(identity: string = this.temporaryBackIdentity) {
    Flex({ direction: this.footerStacked() ? FlexDirection.Column : FlexDirection.Row,
      alignItems: ItemAlign.Center, space: { main: LengthMetrics.vp(TOK_SPACE_CONTROL_INLINE) } }) {
      ReaderButton({ scheme: this.appThemeScheme, specId: 'source-management-manage', label: '批量管理', layout: 'full',
        variant: 'tonal', visualSize: 'large',
        textLayoutOptions: this.textLayoutOptions?.('footer/manage', undefined, '批量管理'),
        focusId: this.toolsFocusId('footer'), onFocused: (): void => this.onToolsEntryFocused(identity, 'footer'),
        onAction: (): void => this.requestOpenTools('footer') })
        .id(this.verificationTextOptions === undefined ? '' : 'reader-source-text-footer-manage')
        .width(this.footerStacked() ? '100%' : undefined)
        .layoutWeight(this.footerStacked() ? 0 : 1)
        .onAreaChange((_old: Area, area: Area): void => this.onToolsEntryLayout(identity, 'footer', area));
      ReaderLabeledIconAction({ scheme: this.appThemeScheme, specId: 'source-management-add', label: '新增书源', fillWidth: true,
        textLayoutOptions: this.textLayoutOptions?.('footer/add', undefined, '新增书源'),
        icon: this.sourceAddIcon(), focusId: this.importFocusId(identity, 'footer'),
        onAction: (): void => {
          if (this.mounted && identity === this.temporaryBackIdentity)
            this.onAddSource(this.importFocusId(identity, 'footer'), this.toolsFocusId('header'));
        } })
        .id(this.verificationTextOptions === undefined ? '' : 'reader-source-text-footer-add')
        .width(this.footerStacked() ? '100%' : undefined)
        .layoutWeight(this.footerStacked() ? 0 : 1);
    }
    .id(this.footerStacked() ? 'reader-source-footer-stacked' : 'reader-source-footer-row')
    .width(this.contentFrame().width)
    .constraintSize({ minHeight: this.layoutBudget().footerHeight })
    .margin({ top: TOK_SPACE_SM, bottom: this.actionBottomInset() })
    .hitTestBehavior(HitTestMode.None);
  }

  private actionBottomInset(actionHeight: number = this.footerActionHeight()): number {
    if (this.readerWindowMetricsRevision < 0) { return TOK_SPACE_MD; }
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

  // Keep the toggle owner while the complete source digest and content slots update.
  private sourceRowKey(source: BookSource): string { return source.sourceId; }

  private sourceRenderKey(source: BookSource): string {
    return `source-${source.sourceId}-${source.name}-${source.baseUrl}-${source.group ?? ''}-${source.category}-` +
      `${source.loginUrl ?? ''}-${source.sourceVersion ?? ''}-${source.enabled}-${source.checkState ?? 'unchecked'}-` +
      `${source.checkMessage ?? ''}${source.sourceId === this.verificationReservedTextRowId ? '-reserved-text' : ''}`;
  }

  private verificationRowTextId(sourceId: string, textId: string): string {
    return this.verificationTextOptions !== undefined &&
      (sourceId === this.verificationTextRowId || sourceId === this.verificationReservedTextRowId) ? textId : '';
  }

  private sourceBadgeStatus(source: BookSource): ReaderStatusBadgeStatus {
    if (source.checkState === 'passed') return 'success';
    if (source.checkState === 'failed') return 'error';
    if (source.checkState === 'checking') return 'pending';
    return 'unknown';
  }

  private sourceBadgeLabel(source: BookSource): string {
    if (source.checkState === 'passed') return '检查通过';
    if (source.checkState === 'failed') return '检查失败';
    if (source.checkState === 'checking') return '检查中';
    return '未检查';
  }

  private verificationRowId(sourceId: string): string {
    if (this.verificationOpening.length === 0 || !ReaderUIVerificationProbe.enabled()) return '';
    return `reader-source-row-${SourceVerificationAnchors.identify(sourceId)}`;
  }

  private hasFilteredEmpty(): boolean {
    return this.sources.length > 0 && this.projectedSourceCount === 0 &&
      !this.sourceListLoading() && !this.hasPendingSourceRecovery();
  }

  private verificationProjectionState(): SourceProjectionState {
    if (this.hasPendingSourceRecovery()) return 'recovery';
    if (this.sourceListLoading()) return 'loading';
    if (this.hasEmptyListReadFailure()) return 'readFailure';
    if (this.sources.length === 0) return 'empty';
    if (this.hasFilteredEmpty()) return 'filteredEmpty';
    return 'rows';
  }

  private verificationLoadingObserver(): ((ratio: number) => void) | undefined {
    return ReaderUIVerificationProbe.enabled() ? (ratio: number): void => this.observeVerificationReadLoading(ratio) : undefined;
  }

  private observeVerificationReadLoading(ratio: number): void {
    if (!this.mounted || !ReaderUIVerificationProbe.enabled() || this.verificationProjectionState() !== 'loading') return;
    const owner = sourceVerificationOpening(this.verificationOpening);
    const read = this.operation.readFacts;
    if (owner === undefined || read === undefined || read.generation <= this.verificationReadLoadingGeneration ||
      (read.fact !== 'loading' && read.fact !== 'refreshing')) return;
    const frame = sourceReadLoadingFrame(this.getUIContext(),owner,read.generation,ratio);
    if (frame === undefined) return;
    this.verificationReadLoadingGeneration = read.generation;
    ReaderUIVerificationProbe.emit('source.read-loading-frame','probe',frame);
  }

  private observeVerificationProjection(trigger: SourceProjectionTrigger): void {
    if (!this.mounted || !ReaderUIVerificationProbe.enabled()) return;
    const owner = sourceVerificationOpening(this.verificationOpening);
    if (owner === undefined) return;
    const status = this.statusValue === '启用' ? 'enabled' : this.statusValue === '异常' ? 'error' :
      this.statusValue === '未检测' ? 'unchecked' : 'all';
    const observation: SourceProjectionObservation = { owner, trigger, status, category: this.categoryValue,
      textProjectionRevision: ++this.verificationTextProjectionRevision,
      allGroups: this.groupValue === '全部分组', groupIndex: this.groupOptions().indexOf(this.groupValue),
      filterRevision: this.verificationFilterRevision, queryLength: this.searchQuery.length,
      count: this.sources.length, projected: this.projectedSources.length,
      firstAnchor: SourceVerificationAnchors.identify(this.projectedSources[0]?.sourceId ?? ''),
      rowActions: this.sources.length === 1 && this.projectedSources.length === 1 ?
        sourceVerificationRowActions(this.projectedSources[0]) : undefined,
      readGeneration: this.operation.readFacts?.generation ?? 0, readFact: this.operation.readFacts?.fact ?? 'idle',
      state: this.verificationProjectionState(), recovery: this.verificationRecoveryFacts() };
    ReaderUIVerificationProbe.emit('source.projection', 'business', observation);
    if (this.verificationTextMetrics !== undefined) this.scheduleVerificationTextLayout();
    if (this.verificationReservedTextMetrics !== undefined) this.scheduleVerificationTextLayout(true);
    this.scheduleVerificationReadText();
    if (this.verificationTextMetrics !== undefined) this.scheduleVerificationOperationText();
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

  private observeVerificationScroll(trigger: string, scroll: SourceManagementScrollState, saved?: SourceManagementScrollState): void {
    if (!ReaderUIVerificationProbe.enabled()) return;
    const owner = sourceVerificationOpening(this.verificationOpening);
    if (owner === undefined) return;
    try {
      const observation: SourceScrollObservation = { owner, trigger, filterRevision: this.verificationFilterRevision,
        itemIndex: scroll.firstIndex, anchor: SourceVerificationAnchors.identify(scroll.anchorId),
        lastAnchor: SourceVerificationAnchors.identify(this.projectedSources[this.projectedSources.length - 1]?.sourceId ?? ''),
        itemYVp: scroll.itemY, offsetVp: scroll.offset, atEnd: this.sourceScroller.isAtEnd(),
        viewportWidthVp: this.viewportWidth, viewportHeightVp: this.viewportHeight,
        layoutMatchesSaved: saved !== undefined && saved.layoutKey === scroll.layoutKey,
        filterMatchesSaved: saved !== undefined && saved.filterKey === scroll.filterKey };
      ReaderUIVerificationProbe.emit('source.scroll', 'business', observation);
    } catch (_unmounted) {}
  }

  private observeVerificationGeometry(): void {
    if (!ReaderUIVerificationProbe.enabled() || this.viewportWidth <= 0 || this.viewportHeight <= 0) return;
    const owner = sourceVerificationOpening(this.verificationOpening);
    if (owner === undefined) return;
    if (this.verificationTextMetrics !== undefined) this.scheduleVerificationTextLayout();
    if (this.verificationReservedTextMetrics !== undefined) this.scheduleVerificationTextLayout(true);
    this.scheduleVerificationReadText();
    if (this.verificationTextMetrics !== undefined) this.scheduleVerificationOperationText();
    const scroll = this.scrollLayout();
    const observation: SourceGeometryObservation = { owner, expanded: this.expandedLayout,
      footerStacked: this.footerStacked(), fontScale: this.fontScale(),
      viewportWidthVp: this.viewportWidth, viewportHeightVp: this.viewportHeight,
      headerHeightVp: this.geometry.header.height, footerHeightVp: this.geometry.footer.height,
      headerTopVp: this.geometry.header.top, footerTopVp: this.geometry.footer.top,
      listStartInsetVp: readerScrollStartOffset(scroll), listEndInsetVp: readerScrollEndOffset(scroll),
      groupHostTopVp: this.overlayTop(), groupHostBottomVp: this.overlayBottom(),
      groupHostLeftVp: this.overlayLeft(), groupHostRightVp: this.overlayRight() };
    const key = JSON.stringify(observation);
    if (key === this.verificationGeometryKey) return;
    this.verificationGeometryKey = key;
    ReaderUIVerificationProbe.emit('source.geometry', 'business', observation);
  }

  private verificationTextLayoutScope(scope: 'default' | 'group' | 'surface' | 'reserved' = 'default'): SourceTextLayoutScope | undefined {
    const owner = sourceVerificationOpening(this.verificationOpening);
    const read = this.operation.readFacts;
    const window = ReaderWindowCoordinator.metrics();
    if (!ReaderUIVerificationProbe.enabled() || !owner || this.verificationTextProjectionRevision < 1 ||
      !this.managementOpeningIsCurrent() || (scope !== 'group' && this.groupOpen) || this.groupClosing ||
      this.viewportWidth <= 0 || this.viewportHeight <= 0 || !window.ready || !window.keyboardArea.available || window.keyboardArea.visible) {
      return undefined;
    }
    if (scope === 'reserved') {
      if (read?.fact !== 'current' || this.verificationProjectionState() !== 'rows' ||
        this.verificationReservedTextRowId.length === 0 ||
        this.verificationReservedTypographyRow(this.projectedSources) !== this.verificationReservedTextRowId) return undefined;
    } else if (scope !== 'surface' && (read?.fact !== 'current' || this.verificationProjectionState() !== 'rows' || this.searchQuery.length !== 0 ||
      this.statusValue !== '全部' || this.categoryValue !== 'all' || this.groupValue !== '全部分组' ||
      this.verificationTextRowId.length === 0 || this.projectedSources[0]?.sourceId !== this.verificationTextRowId)) return undefined;
    const density = window.densityPixels;
    if (!Number.isFinite(density) || density <= 0 || !Number.isFinite(window.systemFontScale) || window.systemFontScale <= 0)
      return undefined;
    return { owner, textProjectionRevision: this.verificationTextProjectionRevision,
      filterRevision: this.verificationFilterRevision, readGeneration: read?.generation ?? 0,
      windowRevision: window.revision, widthVp: window.windowRect.width, heightVp: window.windowRect.height,
      density, systemFontScale: window.systemFontScale, fontScale: this.fontScale(),
      rowAnchor: SourceVerificationAnchors.identify(scope === 'reserved' ? this.verificationReservedTextRowId : this.verificationTextRowId) };
  }

  private scheduleVerificationTextLayout(reserved: boolean = false): void {
    try {
      const scopeKind: 'default' | 'reserved' = reserved ? 'reserved' : 'default';
      const scope = this.verificationTextLayoutScope(scopeKind);
      const metrics = reserved ? this.verificationReservedTextMetrics : this.verificationTextMetrics;
      if (scope === undefined || metrics === undefined) return;
      const key = JSON.stringify(scope);
      if (key === (reserved ? this.verificationReservedTextFrameKey : this.verificationTextFrameKey)) return;
      const context = this.getUIContext();
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
            context.postFrameCallback(new SourceListLayoutFrame(context, observe));
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
      context.postFrameCallback(new SourceListLayoutFrame(context, observe));
      if (reserved) {
        this.verificationReservedTextFrameKey = key;
      } else {
        this.verificationTextFrameKey = key;
        if (this.verificationFilterTextMetrics?.size > 0) {
          this.scheduleVerificationFilterText('status', 'initial');
          this.scheduleVerificationFilterText('category', 'initial');
        }
      }
    } catch (_detached) {}
  }

  private scheduleVerificationFilterText(lane: SourceFilterTextLane, phase: 'initial' | 'settled'): void {
    const metrics = this.verificationFilterTextMetrics.get(lane);
    if (metrics === undefined) return;
    try {
      const scope = this.verificationTextLayoutScope();
      if (scope === undefined || scope.fontScale < 1.99 || scope.fontScale > 2.01 ||
        (Math.abs(scope.widthVp - 320) > 0.4 && Math.abs(scope.widthVp - 366) > 0.4)) return;
      const revision = (this.verificationFilterTextRevisions.get(lane) ?? 0) + 1;
      this.verificationFilterTextRevisions.set(lane, revision);
      const key = JSON.stringify(scope);
      const context = this.getUIContext();
      const expectedRoles = lane === 'status' ? 4 : 6;
      const initiallyVisible = lane === 'status' ? 'status/enabled' : 'category/novel';
      let allowNextFrame = true;
      const observe = (): void => {
        try {
          if (this.verificationFilterTextMetrics.get(lane) !== metrics || this.verificationFilterTextRevisions.get(lane) !== revision ||
            JSON.stringify(this.verificationTextLayoutScope()) !== key) return;
          const labels = metrics.readTracked();
          if (allowNextFrame && (labels.length !== expectedRoles ||
            phase === 'initial' && !labels.some(label => label.role === initiallyVisible && label.lines.length > 0))) {
            allowNextFrame = false;
            context.postFrameCallback(new SourceListLayoutFrame(context, observe));
            return;
          }
          ReaderUIVerificationProbe.emit('source.filter-text-layout', 'business', {
            owner: scope.owner, textProjectionRevision: scope.textProjectionRevision,
            filterRevision: scope.filterRevision, readGeneration: scope.readGeneration,
            windowRevision: scope.windowRevision, widthVp: scope.widthVp, heightVp: scope.heightVp,
            density: scope.density, systemFontScale: scope.systemFontScale, fontScale: scope.fontScale,
            rowAnchor: scope.rowAnchor, lane, phase, revision, labels,
          });
        } catch (_detached) {}
      };
      context.postFrameCallback(new SourceListLayoutFrame(context, observe));
    } catch (_detached) {}
  }

  private prepareVerificationGroupText(): void {
    if (this.verificationTextMetrics === undefined || this.sources.length !== 12) return;
    const options = this.groupOptions();
    if (options.length !== 13 || !options.slice(1).every((option: string, index: number): boolean =>
      option === `Phase1 Scroll ${String(index + 1).padStart(2, '0')}`)) return;
    this.verificationGroupTextMetrics = new ReaderSourceTextMetrics('');
  }

  private verificationGroupTextOptions(option: string, identity: string): TextOptions | undefined {
    if (!this.ownsGroupSelection(identity) || this.groupClosing || !ReaderUIVerificationProbe.enabled()) return undefined;
    const role = option === 'Phase1 Scroll 01' ? 'group/option-head' :
      option === 'Phase1 Scroll 12' ? 'group/option-tail' : '';
    if (role.length === 0) return undefined;
    try { return this.verificationGroupTextMetrics?.track(role, option); }
    catch (_unavailable) { return undefined; }
  }

  private scheduleVerificationGroupText(identity: string, phase: 'initial' | 'settled'): void {
    const metrics = this.verificationGroupTextMetrics;
    if (metrics === undefined || !this.ownsGroupSelection(identity) || this.groupClosing) return;
    try {
      const scope = this.verificationTextLayoutScope('group');
      if (scope === undefined || this.expandedLayout || Math.abs(scope.fontScale - 1) > 0.01) return;
      const key = JSON.stringify(scope);
      const revision = ++this.verificationGroupTextRevision;
      const role = phase === 'initial' ? 'group/option-head' : 'group/option-tail';
      const context = this.getUIContext();
      let allowNextFrame = true;
      const observe = (): void => {
        try {
          if (this.verificationGroupTextMetrics !== metrics || this.verificationGroupTextRevision !== revision ||
            !this.ownsGroupSelection(identity) || this.groupClosing || JSON.stringify(this.verificationTextLayoutScope('group')) !== key) return;
          const labels = metrics.readTracked().filter(label => label.role === role);
          if (allowNextFrame && !labels.some(label => label.lines.length > 0)) {
            allowNextFrame = false;
            context.postFrameCallback(new SourceListLayoutFrame(context, observe));
            return;
          }
          ReaderUIVerificationProbe.emit('source.surface-text-layout', 'business', {
            owner: scope.owner, textProjectionRevision: scope.textProjectionRevision,
            filterRevision: scope.filterRevision, readGeneration: scope.readGeneration,
            windowRevision: scope.windowRevision, widthVp: scope.widthVp, heightVp: scope.heightVp,
            density: scope.density, systemFontScale: scope.systemFontScale, fontScale: scope.fontScale,
            rowAnchor: scope.rowAnchor, scope: 'group-menu', phase, selectionId: identity,
            revision, labels,
          });
        } catch (_detached) {}
      };
      context.postFrameCallback(new SourceListLayoutFrame(context, observe));
    } catch (_detached) {}
  }

  private observeVerificationOverlay(phase: string, overlay: 'group' | 'ime', selectionId?: string): void {
    if (!ReaderUIVerificationProbe.enabled()) return;
    const owner = sourceVerificationOpening(this.verificationOpening);
    if (owner === undefined) return;
    const observation: SourceOverlayObservation = { owner, phase, overlay, selectionId };
    ReaderUIVerificationProbe.emit('source.overlay', 'business', observation);
  }

  private statsText(): string {
    const filteredCount = this.projectedSourceCount;
    const prefix = filteredCount === this.sources.length ? `${this.sources.length} 个书源` :
      `显示 ${filteredCount}/${this.sources.length} 个书源`;
    return `${prefix} · ${this.projectedEnabledSourceCount} 个启用`;
  }

  private filteredSources(): BookSource[] {
    const query = this.searchQuery.trim().toLowerCase();
    return this.sources.filter((source: BookSource): boolean => {
      const matchesQuery = query.length === 0 || source.name.toLowerCase().includes(query) ||
        source.baseUrl.toLowerCase().includes(query);
      const matchesGroup = this.groupValue === '全部分组' || this.normalizedSourceGroup(source) === this.groupValue;
      const matchesCategory = this.categoryValue === 'all' || source.category === this.categoryValue;
      return matchesQuery && matchesGroup && matchesCategory && this.matchesStatus(source);
    });
  }

  private onSourcesChanged(): void {
    // 同一轮内多次 owner 更新会各自触发全量重建；合并到下一帧只做一次。
    this.groupOptionsCacheSource = undefined;
    if (this.projectionRebuildPending) {
      this.scheduleImportStatusReadyObservation();
      return;
    }
    this.projectionRebuildPending = true;
    setTimeout((): void => {
      this.projectionRebuildPending = false;
      if (!this.mounted) return;
      this.rebuildSourceProjection('owner-update');
    }, 0);
    this.scheduleImportStatusReadyObservation();
  }

  private rebuildSourceProjection(trigger: SourceProjectionTrigger): void {
    const key = this.currentFilterKey();
    const changed = this.lastProjectionFilterKey.length > 0 && this.lastProjectionFilterKey !== key;
    if (changed || this.verificationFilterRevision === 0) this.verificationFilterRevision += 1;
    this.lastProjectionFilterKey = key;
    const projected = this.filteredSources();
    if (this.verificationTextMetrics !== undefined && this.verificationTextRowId.length === 0 && this.searchQuery.length === 0 &&
      this.statusValue === '全部' && this.categoryValue === 'all' && this.groupValue === '全部分组')
      this.verificationTextRowId = projected[0]?.sourceId ?? '';
    if (this.verificationTextMetrics !== undefined) {
      const reservedRow = this.verificationReservedTypographyRow(projected);
      if (reservedRow !== this.verificationReservedTextRowId) {
        this.verificationReservedTextMetrics = reservedRow.length > 0 ? new ReaderSourceTextMetrics(reservedRow) : undefined;
        this.verificationReservedTextFrameKey = '';
        this.verificationReservedTextRowId = reservedRow;
      }
    }
    this.sourceDataSource.replace(projected);
    this.projectedSources = projected;
    this.projectedSourceCount = projected.length;
    this.projectedEnabledSourceCount = projected.reduce(
      (count: number, source: BookSource): number => source.enabled ? count + 1 : count, 0);
    if (changed && this.mounted) {
      this.cancelScrollRestore();
      this.capturedScroll = undefined;
      this.firstVisibleListIndex = 0;
      this.firstVisibleSourceId = '';
      // 过滤条件变化后的大列表重排不能占用点击回调的同一帧：先让本次状态提交返回，
      // 再在下一帧请求回顶，避免 800+ 行场景下主线程被连续重排阻塞。
      if (this.listMounted) {
        const scroller = this.sourceScroller;
        setTimeout((): void => {
          if (!this.mounted || !this.listMounted) return;
          try { scroller.scrollEdge(Edge.Top); } catch (_unbound) {}
        }, 0);
      }
    } else this.scheduleSourceAnchorRestore();
    this.observeVerificationProjection(trigger);
  }

  private verificationReservedTypographyRow(projected: BookSource[]): string {
    return sourceVerificationReservedTypographyRow(this.sources.length, projected, this.searchQuery, this.statusValue,
      this.categoryValue, this.groupValue);
  }

  private matchesStatus(source: BookSource): boolean {
    if (this.statusValue === '启用') {
      return source.enabled;
    }
    if (this.statusValue === '异常') {
      return source.checkState === 'failed';
    }
    if (this.statusValue === '未检测') {
      return source.checkState === undefined || source.checkState === 'unchecked' || source.checkState === 'checking';
    }
    return true;
  }

  private normalizedSourceGroup(source: BookSource): string {
    return source.group?.trim() ?? '';
  }

  private groupOptions(): string[] {
    // 每次渲染都遍历全部书源并用 indexOf 去重是 O(n^2)；结果只在书源集合变化时失效。
    if (this.groupOptionsCacheSource === this.sources) return this.groupOptionsCache;
    const options: string[] = ['全部分组'];
    const seen: Set<string> = new Set<string>();
    for (const source of this.sources) {
      const group = this.normalizedSourceGroup(source);
      if (group === '' || group === '全部分组' || seen.has(group)) continue;
      seen.add(group);
      options.push(group);
    }
    this.groupOptionsCache = options;
    this.groupOptionsCacheSource = this.sources;
    return options;
  }

  private visibleGroupOptions(): string[] {
    const options = this.groupOptions();
    const query = this.groupSearchQuery.trim().toLowerCase();
    return query.length === 0 ? options : options.filter((option: string): boolean => option.toLowerCase().includes(query));
  }

  private clearFilters(): void {
    if (!this.managementInputIsCurrent() || this.groupOpen) return;
    this.searchQuery = '';
    this.statusValue = '全部';
    this.categoryValue = 'all';
    this.groupValue = '全部分组';
    this.rebuildSourceProjection('clear');
  }

  private recordViewport(area: Area): void {
    if (!this.mounted) return;
    const x = this.numericAreaLength(area.globalPosition.x), y = this.numericAreaLength(area.globalPosition.y);
    const originChanged = this.embeddedWide && Math.abs(x - this.originX) >= .01;
    this.originX = x;
    this.originY = y;
    const width = this.numericAreaLength(area.width), height = this.numericAreaLength(area.height);
    if (width > 0 && height > 0 &&
      (Math.abs(width - this.viewportWidth) >= 0.01 || Math.abs(height - this.viewportHeight) >= 0.01 || originChanged)) {
      this.viewportWidth = width;
      this.viewportHeight = height;
      this.onGeometryInputsChanged();
    }
  }

  private recordGroupTrigger(area: Area): void {
    const width = this.numericAreaLength(area.width);
    const height = this.numericAreaLength(area.height);
    if (!this.mounted || width <= 0 || height <= 0) return;
    // Area already reports vp. Use the actual trigger box in the overlay's coordinates.
    this.groupX = this.numericAreaLength(area.globalPosition.x);
    this.groupY = this.numericAreaLength(area.globalPosition.y);
    this.groupTriggerWidth = width;
    this.groupTriggerHeight = height;
  }

  private onGeometryInputsChanged(): void {
    if (!this.mounted) return;
    const metrics = ReaderWindowCoordinator.metrics();
    const headerInputs = JSON.stringify([this.viewportWidth > 0 ? this.viewportWidth : metrics.windowRect.width, metrics.systemFontScale,
      metrics.densityPixels, readerInteractiveSafeLeft(metrics), readerInteractiveSafeRight(metrics),
      this.embeddedWide ? this.originX : undefined]);
    const footerInputs = JSON.stringify([headerInputs, this.footerFallbackHeight()]);
    if (headerInputs !== this.headerInputs) {
      this.headerInputs = headerInputs;
      this.measurementKey += 1;
    }
    if (footerInputs !== this.footerInputs) {
      this.footerInputs = footerInputs;
      this.footerMeasurementKey += 1;
    }
    this.refreshGeometry();
  }

  private recordMeasurement(slot: string, height: number, presentedKey: number): void {
    const currentKey = slot === 'source:footer' ? this.footerMeasurementKey : this.measurementKey;
    if (!this.mounted || presentedKey !== currentKey || height < 0) return;
    const previousTop = this.geometry.content.startInset;
    if (!this.measurements.record(slot, height, presentedKey)) return;
    this.refreshGeometry();
    if (slot === 'source:header' && Math.abs(previousTop - this.geometry.content.startInset) > .5) {
      this.alignListTopAfterHeaderChange(previousTop);
    }
  }

  private alignListTopAfterHeaderChange(previousTop: number): void {
    if (!this.listMounted || this.headerTopAlignmentScheduled || this.pendingScroll !== undefined ||
      this.pendingSourceAnchor.length > 0) return;
    const opening = this.temporaryBackIdentity, scrollEpoch = this.scrollRestoreEpoch;
    // Changing contentStartOffset updates the native boundary. The list can
    // still be at its old absolute offset after the first header measurement.
    const stillAtPreviousTop = (): boolean => {
      const first = this.sourceScroller.getItemRect(0);
      return first.height > 0 && Math.abs(first.y - previousTop) <= .5;
    };
    try {
      if (!stillAtPreviousTop()) return;
      this.headerTopAlignmentScheduled = true;
      this.getUIContext().postFrameCallback(new SourceListLayoutFrame(this.getUIContext(), (): void => {
        this.headerTopAlignmentScheduled = false;
        if (!this.managementBackIsCurrent(opening) || !this.listMounted || scrollEpoch !== this.scrollRestoreEpoch ||
          this.pendingScroll !== undefined || this.pendingSourceAnchor.length > 0 ||
          Math.abs(this.geometry.content.startInset - previousTop) <= .5) return;
        try {
          if (stillAtPreviousTop()) this.sourceScroller.scrollEdge(Edge.Top);
        } catch (_unbound) {}
      }));
    } catch (_detached) {
      this.headerTopAlignmentScheduled = false;
    }
  }

  private footerFallbackHeight(): number {
    const actionHeight = this.footerActionHeight();
    return actionHeight + TOK_SPACE_SM + this.actionBottomInset(actionHeight);
  }

  private fontScale(): number {
    if (this.readerWindowMetricsRevision < 0) return 1;
    return readerReadableFontScale(ReaderWindowCoordinator.metrics().systemFontScale);
  }

  private layoutBudget(source?: BookSource): SourceManagementLayout {
    const scale = this.fontScale();
    const action = resolveReaderButtonSpec('source-management-detect');
    const login = resolveReaderButtonSpec('source-management-login');
    const compact = resolveReaderButtonMatrixSize('small');
    const actionHeight = Math.max(44, readerScaledControlHeight(compact.height, compact.lineHeight, scale));
    return resolveSourceManagementLayout({ availableWidth: this.contentFrame().width, fontScale: scale,
      hasLogin: source?.loginUrl !== undefined && source.loginUrl.trim().length > 0,
      detectWidth: action.fixedWidth * scale,
      actionWidth: login.fixedWidth * scale, actionHeight,
      loginHeight: actionHeight,
      filterHeight: Math.max(actionHeight, readerScaledControlHeight(44,
        TYPE_SEARCH_SOURCE_INPUT.lineHeightFp ?? TYPE_SEARCH_SOURCE_INPUT.fontSizeFp * 1.5, scale)), footerHeight: this.footerActionHeight(),
      titleLineHeight: TYPE_SOURCE_MANAGEMENT_ROW_TITLE.lineHeightFp ?? TYPE_SOURCE_MANAGEMENT_ROW_TITLE.fontSizeFp * 1.5,
      metaLineHeight: TYPE_SOURCE_MANAGEMENT_META.lineHeightFp ?? TYPE_SOURCE_MANAGEMENT_META.fontSizeFp * 1.5 });
  }

  private footerControlHeight(): number {
    const footer = resolveReaderButtonMatrixSize('large');
    return Math.max(48, readerScaledControlHeight(footer.height, footer.lineHeight, this.fontScale()),
      readerScaledControlHeight(44, 20, this.fontScale()));
  }

  private footerContentWidth(): number {
    const input = new ReaderPageGeometryInput(ReaderWindowCoordinator.metrics());
    input.originX = this.embeddedWide ? this.originX : undefined;
    input.viewportWidth = this.viewportWidth;
    input.viewportHeight = this.viewportHeight;
    input.contentMaxWidth = readerStandardPageSpec('sourceManagement').maxWidth;
    input.contentHorizontalPadding = 19;
    return resolveReaderPageGeometry(input).content.frame.width;
  }

  private footerStacked(): boolean {
    const scale = this.fontScale();
    const manage = resolveReaderButtonMatrixSize('large');
    const add = resolveReaderLabeledIconActionSpec('source-management-add');
    // Both current labels are four full-width CJK glyphs in their shared font.
    const manageWidth = Math.ceil(manage.fontSize * scale) * '批量管理'.length + manage.horizontalPadding * 2;
    const addWidth = Math.ceil(add.text.fontSizeFp * scale) * '新增书源'.length + add.iconSize + add.gap;
    return (this.footerContentWidth() - TOK_SPACE_CONTROL_INLINE) / 2 < Math.max(manageWidth, addWidth);
  }

  private footerActionHeight(): number {
    const controlHeight = this.footerControlHeight();
    return this.footerStacked() ? controlHeight * 2 + TOK_SPACE_CONTROL_INLINE : controlHeight;
  }

  private scrollLayout(): ReaderScrollLayout {
    return readerScrollLayout(this.geometry, { mode: 'contentOffset' });
  }

  private refreshGeometry(): void {
    const input = new ReaderPageGeometryInput(ReaderWindowCoordinator.metrics());
    input.originX = this.embeddedWide ? this.originX : undefined;
    input.viewportWidth = this.viewportWidth;
    input.viewportHeight = this.viewportHeight;
    input.measurementRevision = ++this.measurementRevision;
    input.headerHeight = this.measurements.readForGeneration('source:header', this.measurementKey, APP_FLOATING_HEADER_BAR_HEIGHT);
    applyReaderStandardFloatingHeader(input);
    input.contentGap = READER_STANDARD_PAGE_CONTENT_GAP;
    input.footerHeight = this.measurements.readForGeneration('source:footer', this.footerMeasurementKey, this.footerFallbackHeight());
    input.contentMaxWidth = readerStandardPageSpec('sourceManagement').maxWidth;
    input.contentHorizontalPadding = 19;
    input.contentEndInset = input.footerHeight;
    this.geometry = resolveReaderPageGeometry(input);
    this.observeVerificationGeometry();
  }

  private overlayLeft(): number {
    this.readerWindowMetricsRevision;
    return Math.min(Math.max(0, this.viewportWidth),
      Math.max(0, readerInteractiveSafeLeft(ReaderWindowCoordinator.metrics()) - this.originX));
  }

  private overlayRight(): number {
    const metrics = ReaderWindowCoordinator.metrics();
    return Math.max(this.overlayLeft(), Math.min(Math.max(0, this.viewportWidth),
      metrics.windowRect.width - readerInteractiveSafeRight(metrics) - this.originX));
  }

  private overlayTop(): number {
    // The keyboard can change while the trigger and root keep the same area.
    this.readerWindowMetricsRevision;
    return Math.max(0, readerInteractiveSafeTop(ReaderWindowCoordinator.metrics(), true) - this.originY);
  }

  private groupOverlayTop(): number {
    const anchor = this.groupClosingAnchor?.top ?? this.groupY;
    return Math.max(this.overlayTop(), Math.min(anchor - this.originY, this.overlayBottom()));
  }

  private overlayBottom(): number {
    const metrics = ReaderWindowCoordinator.metrics();
    return Math.max(this.overlayTop(), readerKeyboardHostBottom(metrics, this.originY,
      this.viewportHeight >= 0 ? this.viewportHeight : metrics.windowRect.height, this.originX,
      this.viewportWidth > 0 ? this.viewportWidth : metrics.windowRect.width));
  }

  private contentFrame(): SurfaceHorizontalFrame {
    if (this.readerWindowMetricsRevision < 0) {
      return new SurfaceHorizontalFrame(0, 0, 0);
    }
    return this.geometry.content.frame;
  }

  private filterControlWidth(): number {
    return Math.max(0, this.contentFrame().width - 44 - TOK_SPACE_XS);
  }

  private groupSelectWidth(): number {
    const available = this.contentFrame().width;
    const text = this.groupValue.length > 4 ? this.groupValue : '全部分组';
    const style = TYPE_SELECT_SOURCE_GROUP_VALUE;
    const fallback = Math.ceil(style.fontSizeFp * text.length * this.fontScale());
    const context = this.getUIContext();
    const measured = context.px2vp(context.getMeasureUtils().measureText({ textContent: text,
      fontSize: style.fontSizeFp, fontFamily: style.fontFamily, fontWeight: style.fontWeight }));
    const label = Number.isFinite(measured) && measured > 0 ? Math.ceil(measured) : fallback;
    return Math.min(Math.max(96, label + 42), Math.max(0, available * 0.55));
  }

  private numericAreaLength(value: Length | undefined): number {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : 0;
    }
    if (typeof value === 'string') {
      const parsed = Number.parseFloat(value);
      return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
  }
}
