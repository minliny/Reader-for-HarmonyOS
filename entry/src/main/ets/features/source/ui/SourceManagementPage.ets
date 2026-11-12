import hilog from '@ohos.hilog';
import inputMethod from '@ohos.inputMethod';
import { ReaderTransientFeedback, READER_FEEDBACK_EXTENDED_MS } from '../../../ui/feedback/ReaderTransientFeedback';
import { consumeReaderControlKeyboardBack } from '../../../ui/foundation/ReaderKeyboardBack';
import { ReaderPageScaffold } from '../../../ui/layout/ReaderPageScaffold';
import { readerPageAreaLength, readerPageContentStartInset, readerStandardPageSpec } from '../../../ui/layout/ReaderPageShell';
import { ReaderMeasurementStore } from '../../../ui/layout/ReaderMeasurements';
import { ReaderPageGeometry, ReaderPageGeometryInput, resolveReaderPageGeometry } from '../../../ui/layout/ReaderPageGeometry';
import { ReaderButton } from '../../../ui/controls/ReaderButton';
import { ReaderIconButton } from '../../../ui/controls/ReaderIconButton';
import { ReaderLabeledIconAction } from '../../../ui/controls/ReaderLabeledIconAction';
import { readerRecoveryView } from '../../../app/ReaderRecoveryProjection';
import type { ReaderRecoveryView } from '../../../ui/feedback/ReaderRecoveryView';
import type { SourceManagementViewState, SourceToolsEntry } from '../presentation/SourceJourneyPresentation';
import { FrameCallback } from '@kit.ArkUI';
import { ReaderRecoveryAction } from '../../../ui/feedback/ReaderRecoveryAction';
import { ReaderRecoveryNotice } from '../../../ui/feedback/ReaderRecoveryNotice';
import { ReaderPageState } from '../../../ui/feedback/ReaderPageState';
import { MESSAGE_BODY } from '../../../ui/foundation/ReaderMessageStyle';
import { TYPE_FORM_COMPACT_ACTION, TYPE_FORM_HINT, TYPE_FORM_LABEL_ACTION, TYPE_SEARCH_RESULT_INTRO, TYPE_SOURCE_MANAGEMENT_COUNT, TYPE_SOURCE_MANAGEMENT_STATUS, TYPE_SOURCE_MANAGEMENT_TITLE, TYPE_SOURCE_STATE_TITLE } from '../../../ui/foundation/ReaderTypography';
import { readerAppColor } from '../../../ui/foundation/ReaderThemeRegistry';
import { ReaderFrameStyle, readerFrameStyle } from '../../../ui/layout/ReaderFrameStyle';
import { ReaderScrollLayout, readerScrollLayout, readerScrollEndOffset, readerScrollStartOffset } from '../../../ui/layout/ReaderScrollLayout';
// Source Management — rebuilt 2026-08-05 against live Figma nodes
// 943:4281 (Phone 390×844) / 943:4745 (Tablet 760×960).
// Structural notes: search field h38 r8 + status filter (5 chips h32 r16)
// + group filter (folder icon + select) above a 70-tall source list whose
// rows carry status badge + bordered 检测 button + 44×24 switch + login
// button (when the source declares loginUrl); bottom action bar = 批量管理
// + ＋新增书源. Content inset is 19vp.
import {
  type BookSource,
} from '../application/SourceGateway';
import type { SourceManagementStatusKind, SourceManagementProjection } from '../application/SourceOrchestrator';
import { readerSourceCategoryLabel, type ReaderSourceCategory } from '../application/ReaderSourceCategory';
import { TYPE_SOURCE_MANAGEMENT_META } from '../../../ui/foundation/ReaderTypography';
import { ReaderWindowCoordinator } from '../../../app/ReaderWindowCoordinator';
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
  TOK_CARD_BG,
  TOK_INK,
  TOK_MUTED,
  TOK_ON_PRIMARY,
  TOK_PAPER,
  TOK_ROW_DIVIDER,
  TOK_SPACE_CONTROL_INLINE,
  TOK_SPACE_MD,
  TOK_SPACE_SM,
  TOK_SPACE_XS,
  TOK_SURFACE_SOLID,
} from '../../../ui/foundation/ReaderTokens';

const GROUP_FILTER_WIDTH = 350;
const GROUP_SELECT_WIDTH = 276;
let sourceTemporaryGeneration: number = 0;

class SourceListLayoutFrame extends FrameCallback {
  private readonly action: () => void;
  constructor(action: () => void) { super(); this.action = action; }
  onFrame(_time: number): void {}
  onIdle(_remaining: number): void { this.action(); }
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
  private readonly transientFeedback: ReaderTransientFeedback = new ReaderTransientFeedback();
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  @StorageLink('readerAppForeground') @Watch('onToolsFocusContextChanged') private appForeground: boolean = true;

  @StorageLink('readerWindowMetricsRevision') @Watch('onGeometryInputsChanged') private readerWindowMetricsRevision: number = 0;
  @Prop @Watch('onSourcesChanged') sources: BookSource[];
  @Prop initialViewState: SourceManagementViewState | undefined = undefined;
  // 额外分组可由调用方补充；常规选项直接来自 Core 返回的原始
  // bookSource.bookSourceGroup，不按启用状态等 UI 属性伪造。
  @Prop groups: string[] = [];
  @Prop expandedLayout: boolean;
  @Prop reduceMotion: boolean = false;
  @Prop @Watch('onMessageChanged') operation: SourceManagementProjection = { action: 'load', sourceId: '' };
  onReconcile: (generation: number) => void = (_generation: number): void => {};
  onContinueOriginal: (generation: number) => void = (_generation: number): void => {};
  @Prop @Watch('onMessageChanged') statusKind: SourceManagementStatusKind = 'idle';
  @Prop @Watch('onMessageChanged') statusMessage: string = '';
  @Prop statusActionLabel: string = '';
  @Prop statusActionGeneration: number = 0;
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
  @State private groupSelectionId: string = '';
  private pendingGroupFocus: string = '';
  private groupFocusRevision: number = 0;
  private mounted: boolean = false;
  private lastFeedbackIdentity: string = '';
  private lastToastMessage: string = '';
  private temporaryBackIdentity: string = '';
  onTemporaryBackBridge: (handler: (() => boolean) | undefined, identity: string) => void =
    (_handler: (() => boolean) | undefined, _identity: string): void => {};
  @State private projectedSources: BookSource[] = [];
  private readonly sourceDataSource: SourceListDataSource = new SourceListDataSource();
  private readonly sourceScroller: Scroller = new Scroller();
  private listMounted: boolean = false;
  private firstVisibleSourceId: string = '';
  private pendingSourceAnchor: string = '';
  private anchorRestoreScheduled: boolean = false;
  private pendingToolsFocus: SourceToolsEntry | undefined;
  private toolsFocusReady: boolean = false;
  private toolsFocusScheduled: boolean = false;
  private toolsFocusRevision: number = 0;
  private toolsFocusAttempt: number = 0;
  // 展开面板锚点: 触发条全局坐标 - 根 Stack 原点 = 面板相对根 Stack 位置。
  @State private groupX: number = 0;
  @State private groupY: number = 0;
  @State private originX: number = 0;
  @State private originY: number = 0;
  @State private geometry: ReaderPageGeometry = new ReaderPageGeometry();
  @State private measurementKey: number = 0;
  private viewportWidth: number = 0;
  private viewportHeight: number = 0;
  private measurementRevision: number = 0;
  private readonly measurements: ReaderMeasurementStore = new ReaderMeasurementStore();

  aboutToAppear(): void {
    this.mounted = true;
    this.searchQuery = this.initialViewState?.searchQuery ?? '';
    this.statusValue = this.initialViewState?.status ?? '全部';
    this.categoryValue = this.initialViewState?.category ?? 'all';
    this.groupValue = this.initialViewState?.group ?? '全部分组';
    this.pendingSourceAnchor = this.initialViewState?.anchorSourceId ?? '';
    this.pendingToolsFocus = this.initialViewState?.toolsEntry;
    this.toolsFocusRevision += 1;
    this.toolsFocusAttempt = 0;
    this.onGeometryInputsChanged();
    registerReaderFonts(this.getUIContext().getFont());
    this.rebuildSourceProjection();
    this.lastFeedbackIdentity = this.feedbackIdentity();
    const identity = `source-back:${++sourceTemporaryGeneration}`;
    this.temporaryBackIdentity = identity;
    this.onTemporaryBackBridge((): boolean => this.consumeTemporaryBack(identity), identity);
    if (this.pendingToolsFocus !== undefined) this.traceToolsReturnFocus('armed');
  }

  aboutToDisappear(): void {
    this.cancelToolsReturnFocus('retire');
    this.transientFeedback.reset();
    const identity = this.temporaryBackIdentity;
    this.mounted = false;
    this.listMounted = false;
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
    if (consumeReaderControlKeyboardBack(ReaderWindowCoordinator.metrics(), {
      hideTextInput: (): Promise<void> => inputMethod.getController().hideTextInput(),
      onFailure: (error: Error): void => {
        if (this.managementBackIsCurrent(identity))
          hilog.warn(0x5244, 'Reader', 'Source management keyboard dismissal: %{private}s', error.message);
      },
    })) return true;
    return this.requestGroupClose(this.groupSelectionId);
  }

  private retireGroupSelection(): void {
    this.cancelGroupFocus();
    this.groupOpen = false;
    this.groupClosing = false;
    this.groupSelectionId = '';
  }

  private ownsGroupSelection(identity: string): boolean {
    return this.managementOpeningIsCurrent() && this.groupOpen && identity.length > 0 && identity === this.groupSelectionId;
  }

  private toggleGroupSelection(): void {
    if (!this.managementOpeningIsCurrent()) return;
    if (this.requestGroupClose(this.groupSelectionId) || this.groupOptions().length <= 1) return;
    this.cancelGroupFocus();
    this.cancelToolsReturnFocus('group');
    this.groupSelectionId = `source-group:${++sourceTemporaryGeneration}`;
    this.pendingGroupFocus = this.groupSelectionId;
    this.groupClosing = false;
    this.groupOpen = true;
  }

  private requestGroupClose(identity: string): boolean {
    if (!this.ownsGroupSelection(identity)) return false;
    // The collapsing panel continues to consume Back until it dismisses.
    this.cancelGroupFocus();
    this.groupClosing = true;
    return true;
  }

  private groupCloseAction(identity: string): () => void {
    return (): void => { this.requestGroupClose(identity); };
  }

  private commitGroupSelection(option: string, identity: string): void {
    if (!this.ownsGroupSelection(identity) || this.groupClosing || this.groupOptions().indexOf(option) < 0) return;
    this.cancelGroupFocus();
    this.groupValue = option;
    this.rebuildSourceProjection();
  }

  private dismissGroupSelection(identity: string): void {
    if (!this.ownsGroupSelection(identity)) return;
    this.retireGroupSelection();
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
    };
  }

  private scheduleGroupFocus(targets: string[], selection: string = ''): void {
    if (!this.managementOpeningIsCurrent() || !this.appForeground) return;
    const mount = this.temporaryBackIdentity;
    const revision = ++this.groupFocusRevision;
    try {
      this.getUIContext().postFrameCallback(new SourceListLayoutFrame((): void => {
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
    if (!this.mounted || this.groupOpen) return;
    this.cancelToolsReturnFocus('open-tools');
    const pending = this.pendingSourceAnchor.length > 0 && this.sourceReturnFiltersMatch();
    const anchorSourceId = pending ? this.pendingSourceAnchor : this.firstVisibleSourceId;
    const index = this.projectedSources.findIndex((source: BookSource): boolean => source.sourceId === anchorSourceId);
    this.onOpenTools({ searchQuery: this.searchQuery, status: this.statusValue,
      category: this.categoryValue, group: this.groupValue,
      anchorSourceId,
      anchorFallbackIndex: pending ? this.initialViewState?.anchorFallbackIndex ?? index : index,
      toolsEntry: entry });
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
      this.getUIContext().postFrameCallback(new SourceListLayoutFrame((): void => {
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
      headerBackground: readerAppColor('TOK_SURFACE_SOLID', this.appThemeScheme),
      footerBackground: pageBackground });
  }

  build() {
    ReaderPageScaffold({
      frameStyle: this.frameStyle(),
      geometry: this.geometry,
      headerMeasurementKey: this.measurementKey,
      footerMeasurementKey: this.measurementKey,
      content: (): void => { this.pageContent(); },
      header: (): void => { this.backBar(); },
      footer: (): void => { this.pageFooter(); },
      overlayContent: (): void => { this.pendingOverlay(this.geometry.content.startInset); this.groupOverlay(); },
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

  @Builder
  private pageContent() {
    Column() { this.sourceList(); }
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
      .width('100%')
      .padding({ left: this.contentFrame().left, right: this.contentFrame().right })
      .enabled(!this.groupOpen)
      .accessibilityLevel(this.groupOpen ? 'no-hide-descendants' : 'auto')
      .hitTestBehavior(this.groupOpen ? HitTestMode.None : HitTestMode.Transparent);
  }

  @Builder
  private groupOverlay() {
    if (this.groupOpen) {
      Row().width('100%').height('100%').backgroundColor(Color.Transparent)
        .hitTestBehavior(HitTestMode.Default).accessibilityLevel('no')
        .onClick(this.groupCloseAction(this.groupSelectionId));
      ReaderSelectPanel({
        value: this.groupValue,
        options: this.groupOptions(),
        variant: 'sourceGroup',
        controlWidth: this.groupSelectWidth(),
        reduceMotion: this.reduceMotion,
        closing: this.groupClosing,
        selectionId: this.groupSelectionId,
        focusIdPrefix: this.groupPanelFocusPrefix(this.groupSelectionId),
        x: this.groupX - this.originX,
        y: this.groupY - this.originY,
        onCommit: (opt: string, identity: string): void => this.commitGroupSelection(opt, identity),
        onDismiss: (identity: string): void => this.dismissGroupSelection(identity),
      }).onAreaChange(this.groupPanelLayoutAction(this.groupSelectionId));
    }
  }

  @Builder
  private backBar(identity: string = this.temporaryBackIdentity) {
    PageBackBar({
      title: '书源管理',
      onBack: (): void => {
        if (this.managementBackIsCurrent(identity) && !this.consumeTemporaryBack(identity)) this.onBack();
      },
    }) {
      Row() {
        ReaderIconButton({ icon: this.appThemeScheme === 'night' ? $r('app.media.bookshelf_more_theme_night') : $r('app.media.bookshelf_more'),
          specId: 'toolbar-compact', accessibilityLabel: '书源工具', focusId: this.toolsFocusId('header'),
          onFocused: (): void => this.onToolsEntryFocused(identity, 'header'),
          onTap: (): void => this.requestOpenTools('header') });
      }.enabled(!this.groupOpen).accessibilityLevel(this.groupOpen ? 'no-hide-descendants' : 'auto')
        .onAreaChange((_old: Area, area: Area): void => this.onToolsEntryLayout(identity, 'header', area));
    }
  }

  @Builder
  private searchField() {
    Row({ space: TOK_SPACE_XS }) {
      Row() {
        ForEach([this.sourceSearchInputIdentity()], (identity: string): void => {
          ReaderSearchField({
            variant: 'sourceManagement',
            mode: 'live',
            text: this.searchQuery,
            placeholder: '搜索书源名称或域名',
            accessibilityLabel: '搜索书源名称或域名',
            onTextChange: (value: string): void => this.applySourceSearchInput(identity, value),
            onSubmit: (): void => this.applySourceSearchInput(identity),
          });
        }, (identity: string): string => identity);
      }
      .layoutWeight(1)
      .height(44);

      ForEach([this.temporaryBackIdentity], (identity: string): void => { this.importAction(identity); },
        (identity: string): string => identity);
    }
    .width(this.contentFrame().width)
    .height(44)
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
      this.cancelToolsReturnFocus('edit');
      this.searchQuery = value;
    }
    this.rebuildSourceProjection();
  }

  @Builder
  private importAction(identity: string) {
    ReaderIconButton({ icon: $r('app.media.source_add'), specId: 'form-primary-icon', accessibilityLabel: '导入书源',
      focusId: this.importFocusId(identity, 'header'),
      onFocused: (): void => this.cancelToolsReturnFocus('other-focus'),
      actionEnabled: this.mounted,
      onTap: (): void => {
        if (this.mounted && identity === this.temporaryBackIdentity)
          this.onAddSource(this.importFocusId(identity, 'header'), this.toolsFocusId('header'));
      } });
  }

  private importFocusId(identity: string, entry: 'header' | 'footer'): string { return `${identity}:import:${entry}`; }

  @Builder
  private statsRow() {
    Text(this.statsText())
      .width(this.contentFrame().width)
      .fontFamily(TYPE_SOURCE_MANAGEMENT_COUNT.fontFamily)
      .fontWeight(TYPE_SOURCE_MANAGEMENT_COUNT.fontWeight)
      .fontSize(TYPE_SOURCE_MANAGEMENT_COUNT.fontSizeFp)
      .lineHeight(TYPE_SOURCE_MANAGEMENT_COUNT.lineHeightFp as number)
      .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme))
      .maxLines(1)
      .margin({ top: TOK_SPACE_XS });
  }

  private recovery(): ReaderRecoveryView { return readerRecoveryView(this.operation.receipt, this.operation.readFacts, this.operation.confirmedParts ?? 0); }

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
    return this.managementBackIsCurrent(this.temporaryBackIdentity) && !this.groupOpen &&
      this.originalActionIdentities().includes(identity) && generation === this.originalActionGeneration(identity) &&
      this.operation.original?.busy !== true;
  }

  @Builder
  private originalRecovery() {
    ForEach(this.originalActionIdentities(), (identity: string) => {
      ReaderRecoveryNotice({ view: this.originalRecoveryView(), actionLabel: '核对',
        busy: this.operation.original?.busy === true,
        secondaryActionLabel: this.operation.original?.canRetryOriginal === true ?
          (this.operation.original?.confirmation === 'confirmed' && this.operation.original?.writeStage === 'cleanup' ? '继续清理' : '继续') : '',
        onReconcile: (generation: number): void => {
          if (this.originalActionCurrent(identity, generation)) this.onReconcile(generation);
        },
        onSecondaryAction: (generation: number): void => {
          if (this.originalActionCurrent(identity, generation) && this.operation.original?.canRetryOriginal === true)
            this.onContinueOriginal(generation);
        } });
    }, (identity: string): string => identity);
  }

  @Builder
  private pendingOverlay(contentStartInset: number) {
    Column() {
      if (this.operation.original?.blocked === true) { this.originalRecovery(); }
      else if (this.operation.receipt?.receipt.confirmation === 'unknown') {
        ReaderRecoveryNotice({ view: this.recovery(), actionLabel: '核对', busy: this.statusKind === 'loading',
          onReconcile: this.onReconcile });
      }
    }.width('100%')
      .padding({ left: this.contentFrame().left, right: this.contentFrame().right,
        top: contentStartInset })
      .enabled(this.appForeground && !this.groupOpen)
      .accessibilityLevel(this.appForeground && !this.groupOpen ? 'auto' : 'no-hide-descendants')
      .hitTestBehavior(this.appForeground && !this.groupOpen ? HitTestMode.Transparent : HitTestMode.None);
  }

  private feedbackIdentity(): string {
    return `${this.operation.receipt?.facts.generation ?? 0}:${this.operation.readFacts?.generation ?? 0}:` +
      `${this.statusKind}:${this.statusMessage}`;
  }

  private onMessageChanged(): void {
    this.scheduleSourceAnchorRestore();
    const identity = this.feedbackIdentity();
    if (!this.mounted || identity === this.lastFeedbackIdentity) return;
    this.lastFeedbackIdentity = identity;
    if (this.statusKind === 'loading' || this.operation.receipt?.facts.fact === 'refreshing') {
      this.lastToastMessage = '';
      return;
    }
    if (this.operation.original?.blocked ||
      this.operation.receipt?.receipt.confirmation === 'unknown') return;
    if (this.sources.length === 0 && this.operation.readFacts?.fact === 'failed') return;
    const message = this.statusMessage || (this.recovery().visible ? this.recovery().message : '');
    if (message.length === 0 || message.startsWith('正在') || message === this.lastToastMessage) return;
    this.lastToastMessage = message;
    try { this.transientFeedback.show(() => this.getUIContext(), { message, duration: READER_FEEDBACK_EXTENDED_MS }, (): boolean => this.mounted); } catch (_) {}
  }

  @Builder
  private statusAction() {
    if (this.statusActionLabel.length > 0 && this.operation.original?.blocked !== true) {
      ForEach([this.statusActionGeneration], (generation: number): void => {
        ReaderRecoveryAction({ label: this.statusActionLabel, generation,
          onReconcile: (value: number): void => this.onStatusAction(value) });
      }, (generation: number): string => `source-status-action:${generation}`);
    }
  }

  @Builder
  private filterArea() {
    if (this.expandedLayout) {
      Row({ space: 20 }) {
        this.statusFilter();
        this.groupFilter();
      }
      .width(this.contentFrame().width)
      .constraintSize({ minHeight: 36 })
      .alignItems(VerticalAlign.Top)
      .margin({ top: TOK_SPACE_XS });
    } else {
      Column({ space: TOK_SPACE_XS }) {
        this.statusFilter();
        this.groupFilter();
      }
      .width(this.contentFrame().width)
      .margin({ top: TOK_SPACE_XS });
    }
  }

  @Builder
  private categoryFilter() {
    Scroll() {
      Row({ space: TOK_SPACE_XS }) {
        ForEach(['all', 'novel', 'comic', 'music', 'download', 'external', 'other'], (category: string) => {
          ReaderButton({ scheme: this.appThemeScheme, specId: 'source-management-category',
            onFocused: (): void => this.cancelToolsReturnFocus('other-focus'),
            label: category === 'all' ? '全部类型' : readerSourceCategoryLabel(category as ReaderSourceCategory),
            primary: this.categoryValue === category,
            onAction: (): void => {
              this.cancelToolsReturnFocus('selection');
              this.categoryValue = category;
              this.rebuildSourceProjection();
            } })
            .id(`source-category-${category}`);
        }, (category: string): string => category);
      }
    }
    .scrollable(ScrollDirection.Horizontal)
    .scrollBar(BarState.Off)
    .width(this.contentFrame().width)
    .height(40)
    .margin({ top: TOK_SPACE_XS });
  }

  @Builder
  private statusFilter() {
    Row({ space: TOK_SPACE_XS }) {
      this.chip('全部', 58, this.statusValue === '全部', true);
      this.chip('启用', 58, this.statusValue === '启用', true);
      this.chip('异常', 58, this.statusValue === '异常', true);
      this.chip('未检测', 72, this.statusValue === '未检测', true);
      // 原稿保留该视觉位，但没有稳定业务定义；禁用比伪造筛选语义更诚实。
      this.chip('自定义', 72, false, false);
    }
    .width(this.filterControlWidth())
    .height(32)
    .alignItems(VerticalAlign.Center);
  }

  @Builder
  private chip(label: string, width: number, active: boolean, enabled: boolean) {
    ReaderButton({ scheme: this.appThemeScheme, specId: width === 58 ? 'source-management-status-compact' : 'source-management-status-wide',
      onFocused: (): void => this.cancelToolsReturnFocus('other-focus'),
      label, primary: active, actionEnabled: enabled, availableWidth: this.filterControlWidth(),
      onAction: (): void => {
        if (!enabled) return;
        this.cancelToolsReturnFocus('selection');
        this.statusValue = label;
        this.rebuildSourceProjection();
      } });
  }

  @Builder
  private groupFilter() {
    Row() {
      Image((this.appThemeScheme === 'night' ? $r('app.media.source_group_folder_theme_night') : $r('app.media.source_group_folder'))).width(15).height(15);
      Text('分组')
        .margin({ left: 12 })
        .fontFamily(TYPE_FORM_LABEL_ACTION.fontFamily)
        .fontWeight(TYPE_FORM_LABEL_ACTION.fontWeight)
        .fontSize(TYPE_FORM_LABEL_ACTION.fontSizeFp)
        .fontColor(readerAppColor('TOK_INK', this.appThemeScheme))
        .maxLines(1);
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
      .margin({ left: 22 })
      .onAreaChange((_oldValue: Area, newValue: Area): void => {
        // Area.globalPosition 已是 vp 单位, 直接取用 (曾 px2vp 二次÷3.5 致面板错位)。
        this.groupX = Number(newValue.globalPosition.x);
        this.groupY = Number(newValue.globalPosition.y);
      });
    }
    .width(this.filterControlWidth())
    .constraintSize({ minHeight: 36 })
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
          if (this.operation.original?.blocked !== true && this.operation.receipt?.receipt.confirmation !== 'unknown' && this.recovery().canRetry && this.sources.length > 0) {
            ReaderRecoveryAction({ label: '刷新列表', generation: this.recovery().generation, onReconcile: this.onReconcile });
          }
          if (this.statusKind === 'loading' && this.sources.length > 0 && this.operation.original?.blocked !== true) {
            Row({ space: 10 }) {
              LoadingProgress().width(32).height(32).color(readerAppColor('TOK_MESSAGE_SOFT_INK', this.appThemeScheme));
              Text(this.statusMessage || '正在读取书源').layoutWeight(1)
                .fontFamily(MESSAGE_BODY.fontFamily as string).fontSize(MESSAGE_BODY.fontSizeFp)
                .lineHeight(MESSAGE_BODY.lineHeightFp as number).fontColor(readerAppColor('TOK_MESSAGE_MUTED', this.appThemeScheme));
            }.width('100%').padding({ top: 12, bottom: 12 });
          }
          this.filterArea();
          this.categoryFilter();
        }.width('100%').padding({ bottom: TOK_SPACE_CONTROL_INLINE });
      }
      if (this.sources.length === 0 && this.operation.original?.blocked !== true) {
        ListItem() {
          ReaderPageState({ title: this.statusKind === 'loading' ? '正在读取书源' :
            (this.operation.readFacts?.fact === 'failed' ? '书源读取失败' : '暂无书源'),
            message: this.statusKind === 'loading' ? '请稍候' : this.operation.readFacts?.fact === 'failed' ?
              '请稍后重试。' : '点击下方「＋ 新增书源」导入 Legado 书源 JSON',
            loading: this.statusKind === 'loading',
            actionLabel: this.operation.readFacts?.fact === 'failed' ? '重试' : '',
            onAction: (): void => {
              if (this.recovery().canRetry) this.onReconcile(this.recovery().generation);
              else this.onRetryLoad();
            } });
        }
      }
      // LazyForEach owns an explicit data source so an empty-to-populated Core
      // load and later filter replacements can notify ArkUI after mount. A
      // reusable Repeat over a derived array retained zero stale rows on API
      // 23 even though the surrounding count text had already updated.
      LazyForEach(this.sourceDataSource, (source: BookSource) => {
        ListItem() {
          this.sourceRow(source);
        }
      }, (source: BookSource): string => this.sourceRenderKey(source));
    }
    .width('100%')
    .height('100%')
    .padding({ left: this.contentFrame().left, right: this.contentFrame().right })
    .contentStartOffset(readerScrollStartOffset(this.scrollLayout()))
    .contentEndOffset(readerScrollEndOffset(this.scrollLayout()))
    .scrollBar(BarState.Off)
    .onAppear((): void => { this.listMounted = true; this.scheduleSourceAnchorRestore(); })
    .onDisAppear((): void => { this.listMounted = false; })
    .onScrollIndex((start: number): void => {
      if (!this.listMounted || this.pendingSourceAnchor.length > 0) return;
      // The permanent filter header is the first native ListItem.
      this.firstVisibleSourceId = start > 0 ? this.projectedSources[start - 1]?.sourceId ?? '' : '';
    })
    .onWillScroll((_offset: number, _state: ScrollState, source: ScrollSource): void => {
      if (source === ScrollSource.DRAG || source === ScrollSource.OTHER_USER_INPUT || source === ScrollSource.SCROLL_BAR) {
        this.pendingSourceAnchor = '';
        this.cancelToolsReturnFocus('scroll');
      }
    });
  }

  private scheduleSourceAnchorRestore(): void {
    if (!this.managementOpeningIsCurrent() || !this.listMounted || this.anchorRestoreScheduled ||
      this.pendingSourceAnchor.length === 0 || this.sourceAnchorReadPending()) return;
    const identity = this.temporaryBackIdentity;
    this.anchorRestoreScheduled = true;
    try {
      this.getUIContext().postFrameCallback(new SourceListLayoutFrame((): void => {
        if (!this.mounted || identity !== this.temporaryBackIdentity) return;
        this.anchorRestoreScheduled = false;
        const sourceId = this.pendingSourceAnchor;
        if (!this.managementOpeningIsCurrent() || !this.listMounted || sourceId.length === 0 || this.sourceAnchorReadPending()) return;
        this.pendingSourceAnchor = '';
        if (!this.sourceReturnFiltersMatch() || this.projectedSources.length === 0) return;
        const exact = this.projectedSources.findIndex((source: BookSource): boolean => source.sourceId === sourceId);
        const index = exact >= 0 ? exact :
          Math.min(this.initialViewState?.anchorFallbackIndex ?? -1, this.projectedSources.length - 1);
        if (index < 0) return;
        try {
          this.sourceScroller.scrollToIndex(index + 1, false, ScrollAlign.START);
          this.firstVisibleSourceId = this.projectedSources[index].sourceId;
        } catch (_unbound) {}
      }));
    } catch (_unmounted) { this.anchorRestoreScheduled = false; }
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
    Row({ space: TOK_SPACE_XS }) {
      Stack({ alignContent: Alignment.Center }) {
        Image((this.appThemeScheme === 'night' ? $r('app.media.source_group_folder_theme_night') : $r('app.media.source_group_folder')))
          .width(20).height(20);
      }
      .width(36)
      .height(40)
      .borderRadius(10)
      .backgroundColor(readerAppColor('TOK_SURFACE_PANEL_SOFT', this.appThemeScheme));

      Column({ space: TOK_SPACE_XS }) {
        Row({ space: 6 }) {
          Text(source.name)
            .constraintSize({ minWidth: 0 }).flexShrink(1)
            .fontFamily(TYPE_SOURCE_MANAGEMENT_TITLE.fontFamily)
            .fontWeight(TYPE_SOURCE_MANAGEMENT_TITLE.fontWeight)
            .fontSize(TYPE_SOURCE_MANAGEMENT_TITLE.fontSizeFp)
            .lineHeight(TYPE_SOURCE_MANAGEMENT_TITLE.lineHeightFp as number)
            .fontColor(readerAppColor('TOK_INK', this.appThemeScheme))
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis });
          Text(readerSourceCategoryLabel(source.category))
            .flexShrink(0)
            .fontFamily(TYPE_SOURCE_MANAGEMENT_META.fontFamily)
            .fontWeight(TYPE_SOURCE_MANAGEMENT_META.fontWeight)
            .fontSize(TYPE_SOURCE_MANAGEMENT_META.fontSizeFp)
            .lineHeight(TYPE_SOURCE_MANAGEMENT_META.lineHeightFp)
            .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme))
            .maxLines(1);
        }.width('100%').alignItems(VerticalAlign.Center);
        Text(source.baseUrl)
          .width('100%')
          .fontFamily(TYPE_SOURCE_MANAGEMENT_META.fontFamily)
          .fontWeight(TYPE_SOURCE_MANAGEMENT_META.fontWeight)
          .fontSize(TYPE_SOURCE_MANAGEMENT_META.fontSizeFp)
          .lineHeight(TYPE_SOURCE_MANAGEMENT_META.lineHeightFp)
          .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme))
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis });
        if (source.checkMessage !== undefined && source.checkMessage.trim().length > 0 &&
          source.checkState !== undefined && source.checkState !== 'unchecked') {
          Text(source.checkMessage)
            .width('100%')
            .fontFamily(TYPE_SOURCE_MANAGEMENT_META.fontFamily)
            .fontWeight(TYPE_SOURCE_MANAGEMENT_META.fontWeight)
            .fontSize(TYPE_SOURCE_MANAGEMENT_META.fontSizeFp)
            .lineHeight(TYPE_SOURCE_MANAGEMENT_META.lineHeightFp)
            .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme))
            .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis });
        }
      }
      .layoutWeight(1)
      .constraintSize({ minWidth: 0 })
      .alignItems(HorizontalAlign.Start);

      if (source.loginUrl !== undefined && source.loginUrl.trim().length > 0) {
        this.loginButton(source);
      }

      this.detectButton(source);

      this.statusBadge(source);

      this.sourceSwitch(source.enabled, this.sourceRowToggle(source), source.sourceId);

    }
    .width(this.contentFrame().width)
    .height(76)
    .padding({ left: 0, right: TOK_SPACE_XS })
    .alignItems(VerticalAlign.Center)
    .border({ width: { top: TOK_BORDER_W }, color: readerAppColor('TOK_ROW_DIVIDER', this.appThemeScheme) });
  }

  @Builder
  private detectButton(source: BookSource) {
    ReaderButton({ scheme: this.appThemeScheme, specId: 'source-management-detect',
      onFocused: (): void => this.cancelToolsReturnFocus('other-focus'),
      label: source.checkState === 'checking' ? '检测中' : '检测', isBusy: source.checkState === 'checking',
      onAction: this.sourceRowCommand(source, 'check') });
  }

  @Builder
  private loginButton(source: BookSource) {
    ReaderButton({ scheme: this.appThemeScheme, specId: 'source-management-login', label: '登录',
      onFocused: (): void => this.cancelToolsReturnFocus('other-focus'),
      onAction: this.sourceRowCommand(source, 'login') });
  }

  private sourceRowIsCurrent(source: BookSource, opening: string): boolean {
    if (!this.managementBackIsCurrent(opening) || this.groupOpen) return false;
    const current = this.projectedSources.find((candidate: BookSource): boolean => candidate.sourceId === source.sourceId);
    return current !== undefined && this.sourceRenderKey(current) === this.sourceRenderKey(source);
  }

  private sourceRowCommand(source: BookSource, command: 'check' | 'login'): () => void {
    const opening = this.temporaryBackIdentity;
    return (): void => {
      if (!this.sourceRowIsCurrent(source, opening)) return;
      if (command === 'check') {
        if (source.checkState !== 'checking') this.onDetectSource(source.sourceId);
      } else if (source.loginUrl !== undefined) {
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
    StatusBadge({ status: this.sourceBadgeStatus(source), label: this.sourceBadgeLabel(source) });
  }

  @Builder
  private sourceSwitch(value: boolean, onTap: (next: boolean) => void, sourceId: string) {
    ForEach([`${this.temporaryBackIdentity}:${sourceId}`], (identity: string): void => {
      ReaderToggle({ value, specId: 'standard-toggle', inputIdentity: identity,
        accessibilityLabel: '启用书源', actionEnabled: this.sourceToggleEnabled(), isBusy: this.sourceToggleBusy(),
        onToggle: (next: boolean): void => {
          if (identity === `${this.temporaryBackIdentity}:${sourceId}` && this.sourceToggleEnabled() && !this.sourceToggleBusy()) onTap(next);
        } });
    }, (identity: string): string => identity);
  }

  private sourceToggleBusy(): boolean {
    return this.operation.original?.busy === true || this.operation.receipt?.facts.fact === 'refreshing';
  }

  private sourceToggleEnabled(): boolean {
    return this.mounted && this.operation.original?.blocked !== true && this.operation.receipt?.receipt.confirmation !== 'unknown';
  }

  @Builder
  private bottomActionBar(identity: string = this.temporaryBackIdentity) {
    Row({ space: TOK_SPACE_CONTROL_INLINE }) {
      ReaderButton({ scheme: this.appThemeScheme, specId: 'source-management-manage', label: '批量管理', layout: 'equal',
        focusId: this.toolsFocusId('footer'), onFocused: (): void => this.onToolsEntryFocused(identity, 'footer'),
        onAction: (): void => this.requestOpenTools('footer') })
        .onAreaChange((_old: Area, area: Area): void => this.onToolsEntryLayout(identity, 'footer', area));
      ReaderLabeledIconAction({ scheme: this.appThemeScheme, specId: 'source-management-add', label: '新增书源',
        icon: $r('app.media.source_add'), focusId: this.importFocusId(identity, 'footer'),
        onAction: (): void => {
          if (this.mounted && identity === this.temporaryBackIdentity)
            this.onAddSource(this.importFocusId(identity, 'footer'), this.toolsFocusId('header'));
        } });
    }
    .width(this.contentFrame().width)
    .constraintSize({ minHeight: 48 })
    .alignItems(VerticalAlign.Center)
    .margin({ top: TOK_SPACE_SM, bottom: this.actionBottomInset() })
    .hitTestBehavior(HitTestMode.Transparent);
  }

  private actionBottomInset(): number {
    if (this.readerWindowMetricsRevision < 0) { return TOK_SPACE_MD; }
    return readerFloatingBarBottomInset(ReaderWindowCoordinator.metrics(), TOK_SPACE_MD);
  }

  private sourceRenderKey(source: BookSource): string {
    return `source-${source.sourceId}-${source.name}-${source.baseUrl}-${source.group ?? ''}-${source.category}-` +
      `${source.loginUrl ?? ''}-${source.enabled}-${source.checkState ?? 'unchecked'}-` +
      `${source.checkMessage ?? ''}`;
  }

  private sourceBadgeStatus(source: BookSource): ReaderStatusBadgeStatus {
    if (source.checkState === 'passed') return 'success';
    if (source.checkState === 'failed') return 'error';
    if (source.checkState === 'checking') return 'pending';
    return 'neutral';
  }

  private sourceBadgeLabel(source: BookSource): string {
    if (source.checkState === 'passed') return '检查通过';
    if (source.checkState === 'failed') return '检查失败';
    if (source.checkState === 'checking') return '检查中';
    return '未检查';
  }

  private enabledCount(): number {
    return this.sources.filter((source) => source.enabled).length;
  }

  private statsText(): string {
    const filteredCount = this.projectedSources.length;
    const prefix = filteredCount === this.sources.length ? `${this.sources.length} 个书源` :
      `显示 ${filteredCount}/${this.sources.length} 个书源`;
    return `${prefix} · ${this.enabledCount()} 个启用`;
  }

  private filteredSources(): BookSource[] {
    const query = this.searchQuery.trim().toLowerCase();
    return this.sources.filter((source: BookSource): boolean => {
      const matchesQuery = query.length === 0 || source.name.toLowerCase().includes(query) ||
        source.baseUrl.toLowerCase().includes(query);
      const matchesGroup = this.groupValue === '全部分组' || source.group === this.groupValue;
      const matchesCategory = this.categoryValue === 'all' || source.category === this.categoryValue;
      return matchesQuery && matchesGroup && matchesCategory && this.matchesStatus(source);
    });
  }

  private onSourcesChanged(): void {
    if (this.groupValue !== '全部分组' && this.groupOptions().indexOf(this.groupValue) < 0) {
      this.groupValue = '全部分组';
    }
    this.rebuildSourceProjection();
  }

  private rebuildSourceProjection(): void {
    if (this.pendingSourceAnchor.length > 0 && !this.sourceReturnFiltersMatch()) this.pendingSourceAnchor = '';
    const projected = this.filteredSources();
    this.projectedSources = projected;
    this.sourceDataSource.replace(projected);
    this.scheduleSourceAnchorRestore();
  }

  private matchesStatus(source: BookSource): boolean {
    if (this.statusValue === '启用') {
      return source.enabled;
    }
    if (this.statusValue === '异常') {
      return source.checkState === 'failed';
    }
    if (this.statusValue === '未检测') {
      return source.checkState === undefined || source.checkState === 'unchecked';
    }
    return true;
  }

  private groupOptions(): string[] {
    const options: string[] = ['全部分组'];
    for (let i = 0; i < this.groups.length; i++) {
      const group = this.groups[i].trim();
      if (group !== '' && group !== '全部分组' && options.indexOf(group) < 0) {
        options.push(group);
      }
    }
    for (const source of this.sources) {
      const group = source.group?.trim() ?? '';
      if (group !== '' && group !== '全部分组' && options.indexOf(group) < 0) {
        options.push(group);
      }
    }
    return options;
  }

  private recordViewport(area: Area): void {
    if (!this.mounted) return;
    const x = this.numericAreaLength(area.globalPosition.x), y = this.numericAreaLength(area.globalPosition.y);
    this.originX = x;
    this.originY = y;
    const width = this.numericAreaLength(area.width), height = this.numericAreaLength(area.height);
    if (width > 0 && height > 0 &&
      (Math.abs(width - this.viewportWidth) >= 0.01 || Math.abs(height - this.viewportHeight) >= 0.01)) {
      this.viewportWidth = width;
      this.viewportHeight = height;
      this.onGeometryInputsChanged();
    }
  }

  private onGeometryInputsChanged(): void {
    if (!this.mounted) return;
    this.measurementKey += 1;
    this.refreshGeometry();
  }

  private recordMeasurement(slot: string, height: number, presentedKey: number): void {
    if (!this.mounted || presentedKey !== this.measurementKey || height <= 0) return;
    if (this.measurements.record(slot, height, presentedKey)) this.refreshGeometry();
  }

  private footerFallbackHeight(): number {
    return 48 + TOK_SPACE_SM + this.actionBottomInset();
  }

  private scrollLayout(): ReaderScrollLayout {
    return readerScrollLayout(this.geometry, { mode: 'contentOffset' });
  }

  private refreshGeometry(): void {
    const input = new ReaderPageGeometryInput(ReaderWindowCoordinator.metrics());
    input.viewportWidth = this.viewportWidth;
    input.viewportHeight = this.viewportHeight;
    input.measurementRevision = ++this.measurementRevision;
    input.headerHeight = this.measurements.readForGeneration('source:header', this.measurementKey, readerPageContentStartInset());
    input.footerHeight = this.measurements.readForGeneration('source:footer', this.measurementKey, this.footerFallbackHeight());
    input.contentMaxWidth = readerStandardPageSpec('sourceManagement').maxWidth;
    input.contentHorizontalPadding = 19;
    input.contentEndInset = input.footerHeight;
    this.geometry = resolveReaderPageGeometry(input);
  }

  private contentFrame(): SurfaceHorizontalFrame {
    if (this.readerWindowMetricsRevision < 0) {
      return new SurfaceHorizontalFrame(0, 0, 0);
    }
    return this.geometry.content.frame;
  }

  private filterControlWidth(): number {
    if (!this.expandedLayout) {
      return this.contentFrame().width;
    }
    return Math.max(0, (this.contentFrame().width - 20) / 2);
  }



  private groupSelectWidth(): number {
    return Math.max(0, this.filterControlWidth() - (GROUP_FILTER_WIDTH - GROUP_SELECT_WIDTH));
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
