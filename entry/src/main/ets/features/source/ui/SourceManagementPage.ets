import { readerLayoutCarrierResponseRegion } from '../../../ui/layout/ReaderPageNativeAttributes';
import { readerKeyboardHostBottom } from '../../../ui/layout/ReaderKeyboardGeometry';
import type { ReaderNavigationPreferences } from '../../../app/HarmonyCapabilityPolicy';
import { ReaderEditingVisibility } from '../../../ui/layout/ReaderEditingVisibility';
import { ReaderPostLayoutFrame } from '../../../ui/layout/ReaderPostLayoutFrame';
import { readerStableInteractiveSafeTop, readerInteractiveSafeLeft, readerInteractiveSafeRight } from '../../../ui/foundation/ReaderWindowMetrics';
import hilog from '@ohos.hilog';
import inputMethod from '@ohos.inputMethod';
import { consumeReaderControlKeyboardBack, readerControlKeyboardVisible } from '../../../ui/foundation/ReaderKeyboardBack';
import { ReaderPageScaffold } from '../../../ui/layout/ReaderPageScaffold';
import { readerPageAreaLength, readerStandardPageSpec, READER_STANDARD_PAGE_CONTENT_GAP } from '../../../ui/layout/ReaderPageShell';
import { ReaderMeasurementStore } from '../../../ui/layout/ReaderMeasurements';
import { ReaderPageGeometry, ReaderPageGeometryInput, applyReaderStandardFloatingHeader, resolveReaderPageGeometry } from '../../../ui/layout/ReaderPageGeometry';
import { readerReadableFontScale } from '../../../ui/foundation/ReaderSurfaceResolvers';
import { type SourceManagementScrollState } from '../presentation/SourceManagementScrollState';
import { type SourceV9Counts, type SourceV9ListAction, type SourceV9View } from '../presentation/SourceManagementV9';
import { ReaderIconButton } from '../../../ui/controls/ReaderIconButton';
import type { SourceManagementViewState, SourceToolsEntry } from '../presentation/SourceJourneyPresentation';
import { readerAppColor } from '../../../ui/foundation/ReaderAppColors';
import { TOK_BORDER_W } from '../../../ui/foundation/ReaderTokens';
import { ReaderFrameStyle, readerFrameStyle } from '../../../ui/layout/ReaderFrameStyle';
import { ReaderScrollLayout, readerScrollLayout, readerScrollEndOffset, readerScrollStartOffset } from '../../../ui/layout/ReaderScrollLayout';
import { type BookSource } from '../application/SourceGateway';
import type { SourceManagementStatusKind, SourceManagementProjection } from '../application/SourceOrchestrator';
import { ReaderWindowCoordinator } from '../../../app/ReaderWindowCoordinator';
import { ReaderUIVerificationProbe } from '../../../app/diagnostics/ReaderUIVerificationProbe';
import { sourceVerificationOpening, type SourceGeometryObservation, type SourceOverlayObservation, type SourceProjectionTrigger, type SourceV9ListReturnView, type SourceV9ListTransitionObservation } from './SourceManagementVerification';
import { registerReaderFonts } from '../../../ui/foundation/ReaderFonts';
import { APP_FLOATING_HEADER_BAR_HEIGHT } from '../../../ui/foundation/ReaderHeaderMetrics';
import { defaultNavigationPreferences } from '../../../ui/surfaces/ReaderSurfaceMaterial';
import { PageBackBar } from '../../../ui/chrome/PageBackBar';
import { SurfaceHorizontalFrame } from '../../../ui/layout/SurfaceHorizontalGeometry';
import type { UIContext } from '@ohos.arkui.UIContext';
import { SourceManagementFiltersOwner, SourceManagementFilterPaint, SourceManagementGroupSheet, SourceManagementMoreMenu, SourceManagementGroupSearch, SourceManagementGroupFooter, type SourceManagementFiltersHost } from './SourceManagementFiltersAndGroupSheet';
import { SourceManagementListOwner, SourceManagementListPaint, SourceManagementList, SourceManagementBatchFooter, SourceManagementBatchHeaderAction, type SourceTextOptions, type SourceManagementListHost } from './SourceManagementListRow';
import { SourceManagementRecoveryOwner, SourceManagementRecoveryBanner, type SourceManagementRecoveryHost } from './SourceManagementRecoveryBanner';

let sourceTemporaryGeneration: number = 0;

@Component
export struct SourceManagementPage {

  @State private filterPaint: SourceManagementFilterPaint = new SourceManagementFilterPaint();
  @State private listPaint: SourceManagementListPaint = new SourceManagementListPaint();

  // Read native state at use time so nested callbacks see the current opening and input gates.
  private readonly filtersHost: SourceManagementFiltersHost = {
    native: {
      getUIContext: (): UIContext => this.getUIContext(),
      contentFrame: (): SurfaceHorizontalFrame => this.contentFrame(),
      fontScale: (): number => this.fontScale(),
      geometry: (): ReaderPageGeometry => this.geometry,
      originX: (): number => this.originX,
      originY: (): number => this.originY,
      viewportWidth: (): number => this.viewportWidth,
      overlayBottom: (): number => this.overlayBottom(),
      overlayTop: (): number => this.overlayTop(),
      overlayLeft: (): number => this.overlayLeft(),
      overlayRight: (): number => this.overlayRight(),
      editingHost: (): ReaderEditingVisibility => this.editingHost,
      numericAreaLength: (value: Length | undefined): number => this.numericAreaLength(value),
    },
    presentation: {
      appThemeScheme: (): string => this.appThemeScheme,
      systemScheme: (): string => this.systemScheme,
      appearancePreferences: (): ReaderNavigationPreferences => this.appearancePreferences,
      expandedLayout: (): boolean => this.expandedLayout,
      reduceMotion: (): boolean => this.reduceMotion,
      appForeground: (): boolean => this.appForeground,
      groupOpen: (): boolean => this.groupOpen,
      moreMenuOpen: (): boolean => this.moreMenuOpen,
      batchMode: (): boolean => this.batchMode,
      setGroupOpen: (open: boolean): void => { this.groupOpen = open; },
      setMoreMenuOpen: (open: boolean): void => { this.moreMenuOpen = open; },
    },
    opening: {
      mounted: (): boolean => this.mounted,
      temporaryBackIdentity: (): string => this.temporaryBackIdentity,
      managementBackIsCurrent: (identity: string): boolean => this.managementBackIsCurrent(identity),
      managementOpeningIsCurrent: (): boolean => this.managementOpeningIsCurrent(),
      managementInputIsCurrent: (): boolean => this.managementInputIsCurrent(),
      isInputAllowed: (): boolean => this.isInputAllowed?.() !== false,
      hideManagementKeyboard: (identity: string): boolean => this.hideManagementKeyboard(identity),
      observeVerificationOverlay: (phase: string, overlay: 'group' | 'ime', selectionId?: string): void => this.observeVerificationOverlay(phase, overlay, selectionId),
      nextTemporaryGeneration: (): number => ++sourceTemporaryGeneration,
    },
    view: {
      v9Pane: (): SourceV9View => this.v9Pane,
      sources: (): BookSource[] => this.sources,
      catalogGroupNames: (): string[] => this.catalogGroupNames,
    },
    actions: {
      onV9Action: (action: SourceV9ListAction, sourceIds: string[]): void => this.onV9Action(action, sourceIds),
    },
    focus: {
      cancelToolsReturnFocus: (phase: string): void => this.cancelToolsReturnFocus(phase),
      prepareV9ListReturn: (view: SourceV9ListReturnView): void => this.prepareV9ListReturn(view),
      onToolsEntryLayout: (identity: string, entry: SourceToolsEntry, area: Area): void => this.onToolsEntryLayout(identity, entry, area),
      toolsFocusId: (entry: SourceToolsEntry): string => this.toolsFocusId(entry),
    },
  };

  private readonly listHost: SourceManagementListHost = {
    native: {
      getUIContext: (): UIContext => this.getUIContext(),
      contentFrame: (): SurfaceHorizontalFrame => this.contentFrame(),
      fontScale: (): number => this.fontScale(),
      geometry: (): ReaderPageGeometry => this.geometry,
      readerWindowMetricsRevision: (): number => this.readerWindowMetricsRevision,
      originX: (): number => this.originX,
      viewportWidth: (): number => this.viewportWidth,
      viewportHeight: (): number => this.viewportHeight,
      scrollLayout: (): ReaderScrollLayout => this.scrollLayout(),
      editingHost: (): ReaderEditingVisibility => this.editingHost,
    },
    presentation: {
      appThemeScheme: (): string => this.appThemeScheme,
      expandedLayout: (): boolean => this.expandedLayout,
      embeddedWide: (): boolean => this.embeddedWide,
      reduceMotion: (): boolean => this.reduceMotion,
      groupOpen: (): boolean => this.groupOpen,
      batchMode: (): boolean => this.batchMode,
      setBatchMode: (active: boolean): void => {
        if (this.batchMode === active) return;
        this.batchMode = active;
        this.list.notifyBatchModeChanged();
      },
    },
    opening: {
      mounted: (): boolean => this.mounted,
      temporaryBackIdentity: (): string => this.temporaryBackIdentity,
      verificationOpening: (): string => this.verificationOpening,
      managementBackIsCurrent: (identity: string): boolean => this.managementBackIsCurrent(identity),
      managementOpeningIsCurrent: (): boolean => this.managementOpeningIsCurrent(),
      managementInputIsCurrent: (): boolean => this.managementInputIsCurrent(),
      isInputAllowed: (): boolean => this.isInputAllowed?.() !== false,
    },
    view: {
      initialViewState: (): SourceManagementViewState | undefined => this.initialViewState,
      inputEnabled: (): boolean => this.inputEnabled,
      sources: (): BookSource[] => this.sources,
      operation: (): SourceManagementProjection => this.operation,
      statusKind: (): SourceManagementStatusKind => this.statusKind,
      ungroupedBatchIds: (): string[] => this.ungroupedBatchIds,
      textLayoutOptions: (): SourceTextOptions | undefined => this.textLayoutOptions,
    },
    actions: {
      onV9Action: (action: SourceV9ListAction, sourceIds: string[]): void => this.onV9Action(action, sourceIds),
      onAddSource: (preferred?: string, fallback?: string): void => this.onAddSource(preferred, fallback),
      onDetectSource: (id: string): void => this.onDetectSource(id),
      onLoginSource: (id: string, loginUrl: string): void => this.onLoginSource(id, loginUrl),
      onToggleSource: (id: string, enabled: boolean): void => this.onToggleSource(id, enabled),
    },
    focus: {
      cancelToolsReturnFocus: (phase: string): void => this.cancelToolsReturnFocus(phase),
      prepareV9ListReturn: (view: SourceV9ListReturnView): void => this.prepareV9ListReturn(view),
      completeV9ListReturn: (view: SourceV9ListReturnView): void => this.completeV9ListReturn(view),
      observeV9ListEntry: (view: SourceV9ListReturnView): void => this.observeV9ListEntry(view),
      onToolsEntryFocused: (identity: string, entry: SourceToolsEntry): void => this.onToolsEntryFocused(identity, entry),
      onToolsEntryLayout: (identity: string, entry: SourceToolsEntry, area: Area): void => this.onToolsEntryLayout(identity, entry, area),
      toolsFocusId: (entry: SourceToolsEntry): string => this.toolsFocusId(entry),
    },
  };

  private readonly recoveryHost: SourceManagementRecoveryHost = {
    native: {
      getUIContext: (): UIContext => this.getUIContext(),
      contentFrame: (): SurfaceHorizontalFrame => this.contentFrame(),
      geometry: (): ReaderPageGeometry => this.geometry,
      readerWindowMetricsRevision: (): number => this.readerWindowMetricsRevision,
      overlayBottom: (): number => this.overlayBottom(),
    },
    presentation: {
      reduceMotion: (): boolean => this.reduceMotion,
      groupOpen: (): boolean => this.groupOpen,
    },
    opening: {
      mounted: (): boolean => this.mounted,
      temporaryBackIdentity: (): string => this.temporaryBackIdentity,
      verificationOpening: (): string => this.verificationOpening,
      managementBackIsCurrent: (identity: string): boolean => this.managementBackIsCurrent(identity),
      managementOpeningIsCurrent: (): boolean => this.managementOpeningIsCurrent(),
      managementInputIsCurrent: (): boolean => this.managementInputIsCurrent(),
      isInputAllowed: (): boolean => this.isInputAllowed?.() !== false,
    },
    view: {
      v9Pane: (): SourceV9View => this.v9Pane,
      inputEnabled: (): boolean => this.inputEnabled,
      sources: (): BookSource[] => this.sources,
      operation: (): SourceManagementProjection => this.operation,
      statusActionGeneration: (): number => this.statusActionGeneration,
      statusActionLabel: (): string => this.statusActionLabel,
      statusKind: (): SourceManagementStatusKind => this.statusKind,
      statusMessage: (): string => this.statusMessage,
    },
    actions: {
      onContinueOriginal: (generation: number): void => this.onContinueOriginal(generation),
      onReconcile: (generation: number): void => this.onReconcile(generation),
      onRetryLoad: (): void => this.onRetryLoad(),
      onStatusAction: (generation: number): void => this.onStatusAction(generation),
    },
  };

  private readonly filters: SourceManagementFiltersOwner = new SourceManagementFiltersOwner({
    host: this.filtersHost,
    paint: (): SourceManagementFilterPaint => this.filterPaint,
    results: {
      visibleIds: (): string[] => this.list.visibleIds(),
      hasReadableSources: (): boolean => this.list.hasReadableSources(),
      projectedSourceCount: (): number => this.list.projectedSourceCount(),
      statusCounts: (): SourceV9Counts => this.list.statusCounts(),
      filterHeight: (): number => this.list.filterHeight(),
      changed: (trigger: SourceProjectionTrigger): void => this.list.rebuildSourceProjection(trigger),
    },
    typography: {
      hasProbe: () => this.list.hasTypographyProbe(),
      scope: (scope) => this.list.verificationTextLayoutScope(scope),
      options: (role, label) => this.list.typographyOptions(role, label),
    },
    paintGroupSearch: (identity: string): void => { this.sourceGroupSearch(identity); },
    paintGroupFooter: (identity: string): void => { this.sourceGroupFooter(identity); },
  });

  private readonly list: SourceManagementListOwner = new SourceManagementListOwner({
    host: this.listHost,
    paint: (): SourceManagementListPaint => this.listPaint,
    filters: {
      searchQuery: () => this.filters.searchQuery(),
      statusValue: () => this.filters.statusValue(),
      categoryValue: () => this.filters.categoryValue(),
      groupValue: () => this.filters.groupValue(),
      groupClosing: () => this.filters.groupClosing(),
      filtersInDefaultState: () => this.filters.filtersInDefaultState(),
      project: () => this.filters.filterProjection(),
      groupChoices: () => this.filters.groupOptions(),
      clear: (): void => this.filters.clearFilters(),
      chooseUngrouped: (): void => this.filters.selectUngrouped(),
      closeMore: (): void => this.filters.closeMoreMenu(),
    },
    readback: {
      pendingRecovery: () => this.recovery.hasPendingSourceRecovery(),
      loading: () => this.recovery.sourceListLoading(),
      emptyReadFailure: () => this.recovery.hasEmptyListReadFailure(),
      recoveryFacts: () => this.recovery.verificationRecoveryFacts(),
    },
    typography: {
      startFilter: (): void => this.filters.startTypography(),
      startReadback: (): void => this.recovery.startReadTypography(),
      retireReadback: (): void => this.recovery.retireTypography(),
      retireFilter: (): void => this.filters.retireTypography(),
      filtersPrepared: () => this.filters.typographyPrepared(),
      measureInitialFilters: (): void => {
        this.filters.scheduleVerificationFilterText('status', 'initial');
        this.filters.scheduleVerificationFilterText('category', 'initial');
      },
      scheduleReadText: (): void => this.recovery.scheduleVerificationReadText(),
      scheduleOperationText: (): void => this.recovery.scheduleVerificationOperationText(),
    },
  });

  private readonly recovery: SourceManagementRecoveryOwner = new SourceManagementRecoveryOwner({
    host: this.recoveryHost,
    readback: {
      listReadPending: () => this.list.sourceAnchorReadPending(),
      filterHeight: () => this.list.filterHeight(),
      filtersInDefaultState: () => this.filters.filtersInDefaultState(),
      groupClosing: () => this.filters.groupClosing(),
    },
    diagnostics: {
      hasTypographyProbe: () => this.list.hasTypographyProbe(),
      projectionState: () => this.list.verificationProjectionState(),
      typographyScope: (scope) => this.list.verificationTextLayoutScope(scope),
      footerText: () => this.list.verificationFooterText(),
    },
  });

  @Builder
  private sourceGroupSearch(identity: string) {
    SourceManagementGroupSearch({ owner: this.filters }, identity);
  }

  @Builder
  private sourceGroupFooter(identity: string) {
    SourceManagementGroupFooter({ owner: this.filters }, identity);
  }

  @Builder
  private sourceBatchHeaderAction(label: string, run: () => void) {
    SourceManagementBatchHeaderAction({ owner: this.list }, label, run);
  }


  @Prop @Watch('onGeometryInputsChanged') embeddedWide: boolean = false;

  private readonly editingHost: ReaderEditingVisibility = new ReaderEditingVisibility();

  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';

  @StorageLink('readerSystemScheme') private systemScheme: string = 'day';

  @StorageProp('readerNavigationAppearancePreferences') private appearancePreferences: ReaderNavigationPreferences =
    defaultNavigationPreferences();

  @StorageLink('readerAppForeground') @Watch('onToolsFocusContextChanged') private appForeground: boolean = true;

  @StorageLink('readerWindowMetricsRevision') @Watch('onGeometryInputsChanged') private readerWindowMetricsRevision: number = 0;

  @Prop @Watch('onSourcesChanged') sources: BookSource[];

  @Prop initialViewState: SourceManagementViewState | undefined = undefined;

  @Prop @Watch('onV9PaneChanged') v9Pane: SourceV9View = 'list';

  @Prop expandedLayout: boolean;

  @Prop reduceMotion: boolean = false;

  verificationOpening: string = '';

  @Prop @Watch('onV9ListInputChanged') inputEnabled: boolean = true;

  @Prop @Watch('onMessageChanged') operation: SourceManagementProjection = { action: 'load', sourceId: '' };

  onReconcile: (generation: number) => void = (_generation: number): void => {};

  onContinueOriginal: (generation: number) => void = (_generation: number): void => {};

  @Prop @Watch('onMessageChanged') statusKind: SourceManagementStatusKind = 'idle';

  @Prop @Watch('onMessageChanged') statusMessage: string = '';

  @Prop @Watch('scheduleImportStatusReadyObservation') statusActionLabel: string = '';

  @Prop @Watch('scheduleImportStatusReadyObservation') statusActionGeneration: number = 0;

  textLayoutOptions: SourceTextOptions | undefined = undefined;

  isOpeningCurrent: (() => boolean) | undefined = undefined;

  isInputAllowed: (() => boolean) | undefined = undefined;

  onStatusAction: (generation: number) => void = (_generation: number): void => {};

  onBack: () => void = (): void => {};

  onToggleSource: (id: string, enabled: boolean) => void = (_id: string, _enabled: boolean): void => {};

  onDetectSource: (id: string) => void = (_id: string): void => {};

  onLoginSource: (id: string, loginUrl: string) => void = (_id: string, _loginUrl: string): void => {};

  onAddSource: (preferred?: string, fallback?: string) => void = (): void => {};

  onV9Action: (action: SourceV9ListAction, sourceIds: string[]) => void =
    (_action: SourceV9ListAction, _sourceIds: string[]): void => {};

  onRetryLoad: () => void = (): void => {};

  @Prop @Watch('onSourcesChanged') catalogGroupNames: string[] = [];

  @Prop @Watch('onUngroupedBatch') ungroupedBatchIds: string[] = [];

  @Prop @Watch('onBatchApplied') batchApplied: number = 0;

  @State @Watch('publishBackPreviewBlock') private moreMenuOpen: boolean = false;

  @State @Watch('publishBackPreviewBlock') private batchMode: boolean = false;

  @State @Watch('publishBackPreviewBlock') private groupOpen: boolean = false;

  private mounted: boolean = false;

  private temporaryBackIdentity: string = '';

  onTemporaryBackBridge: (handler: (() => boolean) | undefined, identity: string) => void =
    (_handler: (() => boolean) | undefined, _identity: string): void => {};

  onBackPreviewBlocked: (blocked: boolean) => void = (): void => {};

  private lastBackPreviewBlocked: boolean = false;

  private verificationGeometryKey: string = '';

  private pendingToolsFocus: SourceToolsEntry | undefined;

  private toolsFocusReady: boolean = false;

  private toolsFocusScheduled: boolean = false;

  private toolsFocusRevision: number = 0;

  private toolsFocusAttempt: number = 0;

  private v9ListReturnView: SourceV9ListReturnView | undefined = undefined;

  private v9ListReturnScroll: SourceManagementScrollState | undefined = undefined;

  private v9ListReturnFilterKey: string = '';

  private v9ListReturnEntered: boolean = false;

  private v9ListTransitionRevision: number = 0;

  @State private originX: number = 0;

  @State private originY: number = 0;

  @State private geometry: ReaderPageGeometry = new ReaderPageGeometry();

  @State private measurementKey: number = 0;

  @State private footerMeasurementKey: number = 0;

  private headerInputs: string = '';

  private footerInputs: string = '';

  @State private viewportWidth: number = 0;

  @State private viewportHeight: number = 0;

  private measurementRevision: number = 0;

  private readonly measurements: ReaderMeasurementStore = new ReaderMeasurementStore();

  aboutToAppear(): void {
    this.mounted = true;
    this.textLayoutOptions = this.list.mountTypography(this.textLayoutOptions);
    this.filters.restore(this.initialViewState);
    this.list.startScrollRestore(this.initialViewState);
    this.pendingToolsFocus = this.initialViewState?.toolsEntry;
    this.toolsFocusRevision += 1;
    this.toolsFocusAttempt = 0;
    this.onGeometryInputsChanged();
    registerReaderFonts(this.getUIContext().getFont());
    const identity = `source-back:${++sourceTemporaryGeneration}`;
    this.temporaryBackIdentity = identity;
    this.onTemporaryBackBridge((): boolean => this.consumeTemporaryBack(identity), identity);
    this.list.rebuildSourceProjection('mount');
    this.recovery.captureInitialFeedback();
    this.scheduleImportStatusReadyObservation();
    if (this.pendingToolsFocus !== undefined) this.traceToolsReturnFocus('armed');
  }

  aboutToDisappear(): void {
    this.list.cancelRowPress();
    this.cancelToolsReturnFocus('retire');
    this.v9ListReturnView = undefined;
    this.v9ListReturnScroll = undefined;
    this.v9ListReturnFilterKey = '';
    this.recovery.retireTransientFeedback();
    const identity = this.temporaryBackIdentity;
    this.mounted = false;
    this.recovery.retireDiagnosticFacts();
    if (this.list.retireTypography()) this.textLayoutOptions = undefined;
    this.list.retireScroll();
    this.pendingToolsFocus = undefined;
    this.toolsFocusReady = false;
    this.toolsFocusScheduled = false;
    this.filters.retireMoreMenu();
    this.temporaryBackIdentity = '';
    this.viewportWidth = 0;
    this.viewportHeight = 0;
    this.measurements.clear();
    this.headerInputs = '';
    this.footerInputs = '';
    this.filters.retireGroupSelection();
    this.onTemporaryBackBridge(undefined, identity);
    this.lastBackPreviewBlocked = false;
    this.onBackPreviewBlocked(false);
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
    const consumed = this.filters.requestGroupClose(this.filters.currentSelection());
    if (consumed) this.observeVerificationOverlay('back', 'group');
    if (consumed) return true;
    if (this.moreMenuOpen) {
      this.filters.closeMoreMenu(true);
      return true;
    }
    if (this.batchMode) {
      this.list.endBatch();
      return true;
    }
    return false;
  }

  private publishBackPreviewBlock(): void {
    if (!this.mounted) return;
    const blocked = this.groupOpen || this.moreMenuOpen || this.batchMode ||
      readerControlKeyboardVisible(ReaderWindowCoordinator.metrics());
    if (blocked === this.lastBackPreviewBlocked) return;
    this.lastBackPreviewBlocked = blocked;
    this.onBackPreviewBlocked(blocked);
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

  private managementInputIsCurrent(): boolean {
    return this.inputEnabled && this.managementOpeningIsCurrent() && this.appForeground && this.isInputAllowed?.() !== false;
  }

  private toolsFocusId(entry: SourceToolsEntry): string { return `${this.temporaryBackIdentity}:tools:${entry}`; }

  private prepareV9ListReturn(view: SourceV9ListReturnView): void {
    this.cancelToolsReturnFocus('v9-departure');
    this.v9ListReturnView = view;
    this.v9ListReturnEntered = false;
    this.v9ListTransitionRevision += 1;
    if (ReaderUIVerificationProbe.enabled()) {
      this.v9ListReturnFilterKey = this.list.currentFilterKey();
      this.v9ListReturnScroll = this.list.readCurrentScroll();
      const saved = this.v9ListReturnScroll;
      if (saved !== undefined) this.list.observeVerificationScroll('v9-list-enter', saved);
    }
  }

  private onV9PaneChanged(): void {
    if (this.v9Pane !== 'list') this.filters.closeMoreMenu();
    if (this.v9Pane === 'list') this.recovery.scheduleImportStatusReadyObservation();
    if (!this.mounted || this.v9ListReturnView !== 'groups') return;
    if (this.v9Pane === 'groups') this.observeV9ListEntry('groups');
    if (this.v9Pane === 'list' && this.v9ListReturnEntered) this.completeV9ListReturn('groups');
  }

  private onV9ListInputChanged(): void {
    if (!this.inputEnabled) this.filters.closeMoreMenu();
    if (this.inputEnabled && this.v9Pane === 'list') this.recovery.scheduleImportStatusReadyObservation();
  }

  private observeV9ListEntry(view: SourceV9ListReturnView): void {
    if (this.v9ListReturnView !== view || this.v9ListReturnEntered) return;
    this.v9ListReturnEntered = true;
    this.observeV9ListTransition(view, 'enter', this.v9ListTransitionRevision);
  }

  private completeV9ListReturn(view: SourceV9ListReturnView): void {
    if (this.v9ListReturnView !== view || !this.v9ListReturnEntered) return;
    const saved = this.v9ListReturnScroll;
    const filterKey = this.v9ListReturnFilterKey;
    this.v9ListReturnView = undefined;
    this.v9ListReturnScroll = undefined;
    this.v9ListReturnFilterKey = '';
    this.v9ListReturnEntered = false;
    const identity = this.temporaryBackIdentity;
    const transition = this.v9ListTransitionRevision;
    const focusRevision = this.toolsFocusRevision;
    try {
      const context = this.getUIContext();
      context.postFrameCallback(new ReaderPostLayoutFrame(context, (): void => {
        if (!this.managementBackIsCurrent(identity) || this.v9Pane !== 'list' ||
          this.v9ListTransitionRevision !== transition || this.batchMode) return;
        if (ReaderUIVerificationProbe.enabled()) {
          this.observeV9ListTransition(view, 'return', transition, filterKey === this.list.currentFilterKey());
          this.list.observeVerificationProjection('v9-return');
          if (saved !== undefined) {
            const measured = this.list.readCurrentScroll();
            if (measured !== undefined) this.list.observeVerificationScroll('v9-list-return', measured, saved);
          }
        }
        if (this.toolsFocusRevision !== focusRevision || !this.managementInputIsCurrent()) return;
        this.pendingToolsFocus = view === 'groups' ? 'header' : 'footer';
        this.toolsFocusReady = true;
        this.toolsFocusAttempt = 0;
        this.scheduleToolsReturnFocus();
      }));
    } catch (_unmounted) {}
  }

  private observeV9ListTransition(view: SourceV9ListReturnView, phase: 'enter' | 'return', revision: number,
    filterMatchesDeparture?: boolean): void {
    if (!ReaderUIVerificationProbe.enabled()) return;
    const owner = sourceVerificationOpening(this.verificationOpening);
    if (owner === undefined) return;
    const observation: SourceV9ListTransitionObservation = { owner, view, phase, revision, filterMatchesDeparture };
    ReaderUIVerificationProbe.emit('source.v9-list-transition', 'business', observation);
  }

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
    if (!this.appForeground) this.filters.closeMoreMenu();
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
      this.getUIContext().postFrameCallback(new ReaderPostLayoutFrame(this.getUIContext(), (): void => {
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
      auditFooterDock: false,
      content: (): void => { this.pageContent(); },
      header: (): void => { this.backBar(); },
      footer: (): void => { this.pageFooter(); },
      overlayContent: (): void => { this.sourceOverlays(); },
      onHeaderHeightChange: (height: number, presentedKey: number): void => {
        this.recordMeasurement('source:header', height, presentedKey);
      },
      onFooterHeightChange: (height: number, presentedKey: number): void => {
        this.recordMeasurement('source:footer', height, presentedKey);
      },
    }).onTouch((event: TouchEvent): void => {
      if (event.type === TouchType.Down) { this.filters.cancelGroupFocus(); this.cancelToolsReturnFocus('touch'); }
    }).onKeyEvent((event: KeyEvent): void => {
      if (event.type === KeyType.Down) { this.filters.cancelGroupFocus(); this.cancelToolsReturnFocus('key'); }
    });
  }

  @Builder
  private sourceOverlays() {
    SourceManagementRecoveryBanner({ owner: this.recovery });
    SourceManagementGroupSheet({ owner: this.filters });
    SourceManagementMoreMenu({ owner: this.filters });
  }

  @Builder
  private pageContent() {
    Column() {
      SourceManagementList({ owner: this.list }, { filters: this.filters, recovery: this.recovery });
    }
      .id('reader-source-content')
      .width('100%')
      .height('100%')
      .enabled(this.inputEnabled && !this.groupOpen && !this.moreMenuOpen)
      .accessibilityLevel(this.groupOpen || this.moreMenuOpen ? 'no-hide-descendants' : 'auto')
      .hitTestBehavior(this.groupOpen || this.moreMenuOpen ? HitTestMode.None : HitTestMode.Default)
      .onTouch((event: TouchEvent): void => {
        if (event.type === TouchType.Down) this.cancelToolsReturnFocus('touch');
      })
      .onAreaChange((_oldValue: Area, next: Area): void => this.recordViewport(next));
  }

  @Builder
  private pageFooter() {
    Column() { SourceManagementBatchFooter({ owner: this.list }, this.temporaryBackIdentity); }
      .id('reader-source-footer')
      .width('100%')
      .padding({ left: this.contentFrame().left, right: this.contentFrame().right })
      .backgroundColor(this.batchMode ? Color.Transparent : readerAppColor('TOK_PAPER', this.appThemeScheme))
      .border(this.batchMode ? undefined : { width: { top: TOK_BORDER_W }, color: readerAppColor('TOK_LINE', this.appThemeScheme) })
      .enabled(this.inputEnabled && !this.groupOpen && !this.moreMenuOpen)
      .accessibilityLevel(this.groupOpen || this.moreMenuOpen ? 'no-hide-descendants' : 'auto')
      .hitTestBehavior(this.groupOpen || this.moreMenuOpen ? HitTestMode.None : HitTestMode.Default)
      .responseRegion(readerLayoutCarrierResponseRegion());
  }

  @Builder
  private backBar(identity: string = this.temporaryBackIdentity) {
    if (this.batchMode) {
      PageBackBar({ floating: true, centered: true, elevation: 'floating', showBack: false,
        trailingWidthVp: 76, title: `已选 ${this.list.batchSelectionCount()} 项`,
        leadingActionLabel: '取消', onLeadingAction: (): void => this.list.endBatch(),
        trailing: (): void => {
          this.sourceBatchHeaderAction(this.list.visibleBatchSelected() ? '取消全选' : '全选', (): void => this.list.toggleVisibleBatch());
        },
      }).transition(this.list.batchTransition());
    } else {
      PageBackBar({
        floating: true, centered: true, elevation: 'floating',
        showBack: !this.embeddedWide, balancedCenteredSlots: this.embeddedWide,
        title: '书源管理',
        backFocusId: 'reader-source-back',
        onBack: (): void => {
          if (this.managementBackIsCurrent(identity) && !this.consumeTemporaryBack(identity)) this.onBack();
        },
      }) {
        Row() {
          ReaderIconButton({ icon: this.appThemeScheme === 'night' ? $r('app.media.rc_dots_theme_night') : $r('app.media.rc_dots'),
            specId: 'toolbar-standard', accessibilityLabel: '书源管理更多操作', focusId: this.toolsFocusId('header'),
            selectionState: this.moreMenuOpen ? 'selected' : 'none',
            onFocused: (): void => this.onToolsEntryFocused(identity, 'header'),
            onTap: (): void => this.filters.toggleMoreMenu() });
        }.id('reader-source-header-tools').enabled(!this.groupOpen)
          .accessibilityLevel(this.groupOpen ? 'no-hide-descendants' : 'auto')
          .onAreaChange((_old: Area, area: Area): void => this.filters.recordMoreAnchor(identity, area));
      }
    }
  }

  private scheduleImportStatusReadyObservation(): void { this.recovery.scheduleImportStatusReadyObservation(); }

  private onMessageChanged(): void {
    this.list.scheduleSourceAnchorRestore();
    this.list.observeVerificationProjection('owner-update');
    this.recovery.onMessageChanged();
  }

  private observeVerificationGeometry(): void {
    if (!ReaderUIVerificationProbe.enabled() || this.viewportWidth <= 0 || this.viewportHeight <= 0) return;
    const owner = sourceVerificationOpening(this.verificationOpening);
    if (owner === undefined) return;
    if (this.list.hasTypographyProbe()) this.list.scheduleVerificationTextLayout();
    if (this.list.hasReservedTypographyProbe()) this.list.scheduleVerificationTextLayout(true);
    this.recovery.scheduleVerificationReadText();
    if (this.list.hasTypographyProbe()) this.recovery.scheduleVerificationOperationText();
    const scroll = this.scrollLayout();
    const observation: SourceGeometryObservation = { owner, expanded: this.expandedLayout,
      footerStacked: this.list.footerStacked(), fontScale: this.fontScale(),
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

  private observeVerificationOverlay(phase: string, overlay: 'group' | 'ime', selectionId?: string): void {
    if (!ReaderUIVerificationProbe.enabled()) return;
    const owner = sourceVerificationOpening(this.verificationOpening);
    if (owner === undefined) return;
    const observation: SourceOverlayObservation = { owner, phase, overlay, selectionId };
    ReaderUIVerificationProbe.emit('source.overlay', 'business', observation);
  }

  private onBatchApplied(): void { this.list.onBatchApplied(); }

  private onUngroupedBatch(): void { this.list.onUngroupedBatch(); }

  private onSourcesChanged(): void {
    this.filters.invalidateGroupChoices();
    this.list.scheduleProjectionRefresh();
    this.recovery.scheduleImportStatusReadyObservation();
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

  private onGeometryInputsChanged(): void {
    if (!this.mounted) return;
    this.publishBackPreviewBlock();
    const metrics = ReaderWindowCoordinator.metrics();
    const headerInputs = JSON.stringify([this.viewportWidth > 0 ? this.viewportWidth : metrics.windowRect.width, metrics.systemFontScale,
      metrics.densityPixels, readerInteractiveSafeLeft(metrics), readerInteractiveSafeRight(metrics),
      this.embeddedWide ? this.originX : undefined]);
    const footerInputs = JSON.stringify([headerInputs, this.list.footerFallbackHeight()]);
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
      this.list.alignListTopAfterHeaderChange(previousTop);
    }
  }

  private fontScale(): number {
    if (this.readerWindowMetricsRevision < 0) return 1;
    return readerReadableFontScale(ReaderWindowCoordinator.metrics().systemFontScale);
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
    input.footerHeight = this.measurements.readForGeneration('source:footer', this.footerMeasurementKey, this.list.footerFallbackHeight());
    input.contentMaxWidth = readerStandardPageSpec('sourceManagement').maxWidth;
    input.contentHorizontalPadding = 16;
    input.contentHorizontalSafeArea = 'interactive';
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
    return Math.max(0, readerStableInteractiveSafeTop(ReaderWindowCoordinator.metrics(), true) - this.originY);
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
