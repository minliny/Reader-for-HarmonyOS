import { FrameCallback } from '@kit.ArkUI';
import { ReaderTransientFeedback, READER_FEEDBACK_EXTENDED_MS } from '../common/ReaderTransientFeedback';
import { ReaderPageScaffold } from '../common/ReaderPageScaffold';
import { readerPageContentStartInset, readerStandardPageSpec } from '../common/ReaderPageShell';
import { ReaderMeasurementStore } from '../common/ReaderMeasurements';
import { ReaderPageGeometry, ReaderPageGeometryInput, resolveReaderPageGeometry } from '../common/ReaderPageGeometry';
import { ReaderButton } from '../common/ReaderButton';
import { resolveReaderButtonSpec } from '../common/ReaderControlSpecs';
import { readerReadableFontScale, readerScaledControlHeight } from '../common/ReaderSurfaceResolvers';
import { resolveSourceManagementLayout, type SourceManagementLayout } from './SourceManagementLayout';
import { ReaderIconButton } from '../common/ReaderIconButton';
import { ReaderPressFeedback } from '../common/ReaderPressFeedback';
import { ReaderLabeledIconAction } from '../common/ReaderLabeledIconAction';
import { readerRecoveryView, type ReaderRecoveryView } from '../../app/ReaderRecoveryProjection';
import type { SourceManagementProjection } from './SourceHost';
import { defaultSourceManagementFilters, copySourceManagementFilters,
  sourceManagementFilterKey, copySourceManagementScroll,
  type SourceManagementFilterState, type SourceManagementScrollState } from './SourceManagementPresentation';
import { ReaderRecoveryAction } from '../common/ReaderRecoveryAction';
import { ReaderRecoveryNotice } from '../common/ReaderRecoveryNotice';
import { ReaderPageState } from '../common/ReaderPageState';
import { MESSAGE_BODY } from '../common/ReaderMessageStyle';
import { TYPE_FORM_COMPACT_ACTION, TYPE_FORM_HINT, TYPE_FORM_LABEL_ACTION, TYPE_SEARCH_RESULT_INTRO, TYPE_SOURCE_TOOLS_STATUS, TYPE_SOURCE_MANAGEMENT_TITLE, TYPE_SOURCE_STATE_TITLE } from '../common/ReaderTypography';
import { readerAppColor } from '../common/ReaderThemeRegistry';
import { ReaderFrameStyle, readerFrameStyle } from '../common/ReaderFrameStyle';
import { ReaderScrollLayout, readerScrollLayout, readerScrollEndOffset, readerScrollStartOffset } from '../common/ReaderScrollLayout';
// Source Management — rebuilt 2026-08-05 against live Figma nodes
// 943:4281 (Phone 390×844) / 943:4745 (Tablet 760×960).
// Structural notes: search field h38 r8 + status filter (5 chips h32 r16)
// + group filter (folder icon + select) above a 70-tall source list whose
// rows carry status badge + bordered 检测 button + 44×24 switch + login
// button (when the source declares loginUrl); bottom action bar = 批量管理
// + ＋新增书源. Content inset is 19vp.
import {
  type BookSource,
} from './SourceGateway';
import type { SourceManagementStatusKind } from './SourceOrchestrator';
import { readerSourceCategoryLabel, type ReaderSourceCategory } from './ReaderSourceCategory';
import { ReaderWindowCoordinator } from '../../app/ReaderWindowCoordinator';
import { registerReaderFonts } from '../common/ReaderFonts';
import { PageBackBar } from '../common/PageBackBar';
import { readerFloatingBarBottomInset } from '../common/ReaderFloatingBarMetrics';
import { ReaderSearchField } from '../common/ReaderSearchField';
import { ReaderToggle } from '../common/ReaderToggle';
import { ReaderSelect } from '../common/ReaderSelect';
import { ReaderSelectPanel } from '../common/ReaderSelectPanel';
import { StatusBadge } from '../common/StatusBadge';
import {
  SurfaceHorizontalFrame,
} from '../common/SurfaceHorizontalGeometry';
import {
  TOK_BORDER_W,
  TOK_CARD_BG,
  TOK_INK,
  TOK_MUTED,
  TOK_ON_PRIMARY,
  TOK_PAPER,
  TOK_PRIMARY_DARK,
  TOK_ROW_DIVIDER,
  TOK_SPACE_CONTROL_INLINE,
  TOK_SPACE_MD,
  TOK_SPACE_SM,
  TOK_SPACE_XS,
  TOK_SURFACE_SOLID,
} from '../common/ReaderTokens';

const GROUP_FILTER_WIDTH = 350;
const GROUP_SELECT_WIDTH = 276;
let sourceTemporaryGeneration: number = 0;

class SourceManagementLayoutFrame extends FrameCallback {
  private action: () => void;
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

  @StorageLink('readerWindowMetricsRevision') private readerWindowMetricsRevision: number = 0;
  @Prop @Watch('onSourcesChanged') sources: BookSource[];
  @Prop expandedLayout: boolean;
  @Prop reduceMotion: boolean = false;
  @Prop @Watch('onMessageChanged') operation: SourceManagementProjection = { action: 'load', sourceId: '' };
  onReconcile: (generation: number) => void = (_generation: number): void => {};
  onContinueOriginal: (generation: number) => void = (_generation: number): void => {};
  @Prop @Watch('onMessageChanged') statusKind: SourceManagementStatusKind = 'idle';
  @Prop @Watch('onMessageChanged') statusMessage: string = '';
  @Prop statusActionLabel: string = '';
  @Prop statusActionGeneration: number = 0;
  onStatusAction: (generation: number) => void = (_generation: number): void => {};
  onBack: () => void = (): void => {};
  onToggleSource: (id: string, enabled: boolean) => void = (_id: string, _enabled: boolean): void => {};
  onDetectSource: (id: string) => void = (_id: string): void => {};
  onLoginSource: (id: string) => void = (_id: string): void => {};
  onAddSource: () => void = (): void => {};
  onOpenTools: () => void = (): void => {};
  onRetryLoad: () => void = (): void => {};
  @Prop initialFilters: SourceManagementFilterState = defaultSourceManagementFilters();
  onFiltersChange: (filters: SourceManagementFilterState) => void = (_filters: SourceManagementFilterState): void => {};
  @Prop initialScroll: SourceManagementScrollState | undefined = undefined;
  onScrollChange: (state: SourceManagementScrollState) => void = (_state: SourceManagementScrollState): void => {};
  @State private searchQuery: string = '';
  @State private statusValue: string = '全部';
  @State private categoryValue: string = 'all';
  @State private groupValue: string = '全部分组';
  @State private groupOpen: boolean = false;
  @State private groupClosing: boolean = false;
  @State private groupSelectionId: string = '';
  private mounted: boolean = false;
  private readonly sourceScroller: Scroller = new Scroller();
  private sourceListMounted: boolean = false;
  private firstVisibleListIndex: number = 0;
  private pendingScroll: SourceManagementScrollState | undefined = undefined;
  private restoringScroll: boolean = false;
  private scrollRestoreEpoch: number = 0;
  private lastProjectionFilterKey: string = '';
  private lastFeedbackIdentity: string = '';
  private lastToastMessage: string = '';
  private temporaryBackIdentity: string = '';
  onTemporaryBackBridge: (handler: (() => boolean) | undefined, identity: string) => void =
    (_handler: (() => boolean) | undefined, _identity: string): void => {};
  @State private projectedSources: BookSource[] = [];
  private readonly sourceDataSource: SourceListDataSource = new SourceListDataSource();
  // 展开面板锚点: 触发条全局坐标 - 根 Stack 原点 = 面板相对根 Stack 位置。
  @State private groupX: number = 0;
  @State private groupY: number = 0;
  @State private originX: number = 0;
  @State private originY: number = 0;
  @State private viewportWidth: number = 0;
  @State private measurementRevision: number = 0;
  private readonly measurements: ReaderMeasurementStore = new ReaderMeasurementStore();

  aboutToAppear(): void {
    this.restoreInitialFilters();
    this.pendingScroll = copySourceManagementScroll(this.initialScroll);
    this.lastProjectionFilterKey = this.currentFilterKey();
    this.mounted = true;
    registerReaderFonts(this.getUIContext().getFont());
    this.rebuildSourceProjection();
    this.lastFeedbackIdentity = this.feedbackIdentity();
    const identity = `source-back:${++sourceTemporaryGeneration}`;
    this.temporaryBackIdentity = identity;
    this.onTemporaryBackBridge((): boolean => this.consumeTemporaryBack(identity), identity);
  }

  aboutToDisappear(): void {
    this.transientFeedback.reset();
    const identity = this.temporaryBackIdentity;
    this.mounted = false;
    this.sourceListMounted = false;
    this.cancelScrollRestore();
    this.temporaryBackIdentity = '';
    this.retireGroupSelection();
    this.onTemporaryBackBridge(undefined, identity);
  }

  private consumeTemporaryBack(identity: string): boolean {
    if (!this.mounted || identity !== this.temporaryBackIdentity || !this.groupOpen) return false;
    // Keep consuming while the existing panel owns its collapse animation.
    this.groupClosing = true;
    return true;
  }

  private retireGroupSelection(): void {
    this.groupOpen = false;
    this.groupClosing = false;
    this.groupSelectionId = '';
  }

  private ownsGroupSelection(identity: string): boolean {
    return this.mounted && this.groupOpen && identity.length > 0 && identity === this.groupSelectionId;
  }

  private toggleGroupSelection(): void {
    if (!this.mounted || this.groupOptions().length <= 1) return;
    if (this.groupOpen) { this.groupClosing = true; return; }
    this.groupSelectionId = `source-group:${++sourceTemporaryGeneration}`;
    this.groupClosing = false;
    this.groupOpen = true;
  }

  private groupCloseAction(identity: string): () => void {
    return (): void => { if (this.ownsGroupSelection(identity)) this.groupClosing = true; };
  }

  private commitGroupSelection(option: string, identity: string): void {
    if (!this.ownsGroupSelection(identity) || this.groupClosing || this.groupOptions().indexOf(option) < 0) return;
    this.groupValue = option;
    this.rebuildSourceProjection();
  }

  private dismissGroupSelection(identity: string): void {
    if (this.ownsGroupSelection(identity)) this.retireGroupSelection();
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
      geometry: this.pageGeometry(),
      headerMeasurementKey: this.measurementGeneration(),
      footerMeasurementKey: this.measurementGeneration(),
      content: (): void => { this.pageContent(); },
      header: (): void => { this.backBar(); },
      footer: (): void => { this.pageFooter(); },
      overlayContent: (): void => { this.pendingOverlay(this.pageGeometry().content.startInset); this.groupOverlay(); },
      onHeaderHeightChange: (height: number, presentedKey: number): void => {
        if (height > 0 && this.measurements.record('source:header', height, presentedKey))
          this.measurementRevision += 1;
      },
      onFooterHeightChange: (height: number): void => {
        if (height > 0 && this.measurements.record('source:footer', height, this.measurementGeneration()))
          this.measurementRevision += 1;
      },
    });
  }

  @Builder
  private pageContent() {
    Column() { this.sourceList(); }
      .width('100%')
      .height('100%')
      .onAreaChange((_oldValue: Area, newValue: Area): void => {
        // Area.globalPosition 已是 vp 单位, 直接取用 (曾 px2vp 二次÷3.5 致面板错位)。
        this.originX = Number(newValue.globalPosition.x);
        this.originY = Number(newValue.globalPosition.y);
        const width = this.numericAreaLength(newValue.width);
        if (width > 0 && Math.abs(width - this.viewportWidth) >= 0.01) {
          this.viewportWidth = width;
        }
      });
  }

  @Builder
  private pageFooter() {
    Column() { this.bottomActionBar(); }
      .width('100%').height(this.pageGeometry().footer.height)
      .padding({ left: this.contentFrame().left, right: this.contentFrame().right })
      .hitTestBehavior(HitTestMode.Transparent);
  }

  @Builder
  private groupOverlay() {
    if (this.groupOpen) {
      Row().width('100%').height('100%').backgroundColor(Color.Transparent)
        .onClick(this.groupCloseAction(this.groupSelectionId));
      ReaderSelectPanel({
        value: this.groupValue,
        options: this.groupOptions(),
        variant: 'sourceGroup',
        controlWidth: this.groupSelectWidth(),
        reduceMotion: this.reduceMotion,
        closing: this.groupClosing,
        selectionId: this.groupSelectionId,
        x: this.groupX - this.originX,
        y: this.groupY - this.originY,
        onCommit: (opt: string, identity: string): void => this.commitGroupSelection(opt, identity),
        onDismiss: (identity: string): void => this.dismissGroupSelection(identity),
      });
    }
  }

  @Builder
  private backBar() {
    PageBackBar({
      title: '书源管理',
      onBack: (): void => this.onBack(),
    }) {
      ReaderIconButton({ icon: this.appThemeScheme === 'night' ? $r('app.media.bookshelf_more_theme_night') : $r('app.media.bookshelf_more'),
        specId: 'toolbar-compact', accessibilityLabel: '书源工具', onTap: (): void => this.openTools() });
    }
  }

  @Builder
  private searchField() {
    Row({ space: TOK_SPACE_XS }) {
      Row() {
        ReaderSearchField({
          variant: 'sourceManagement',
          mode: 'live',
          text: this.searchQuery,
          placeholder: '搜索书源名称或域名',
          accessibilityLabel: '搜索书源名称或域名',
          onTextChange: (value: string): void => {
            this.searchQuery = value;
            this.rebuildSourceProjection();
          },
          onSubmit: (): void => this.rebuildSourceProjection(),
        });
      }
      .layoutWeight(1)
      .height(44);

      Stack({ alignContent: Alignment.Center }) {
        Stack({ alignContent: Alignment.Center }) {
          Image($r('app.media.source_add')).width(18).height(18);
        }
        .width(40)
        .height(40)
        .attributeModifier(new ReaderPressFeedback(readerAppColor('TOK_PRIMARY_DARK', this.appThemeScheme), this.appThemeScheme, 12))
        .responseRegion({ x: -2, y: -2, width: 44, height: 44 })
        .focusable(true)
        .accessibilityRole(AccessibilityRoleType.BUTTON)
        .accessibilityText('导入书源')
        .onClick((): void => this.onAddSource());
      }.width(44).height(44).focusable(false);
    }
    .width(this.contentFrame().width)
    .height(44)
    .alignItems(VerticalAlign.Center)
    .margin({ top: TOK_SPACE_XS });
  }

  @Builder
  private statsRow() {
    Text(this.statsText())
      .width(this.contentFrame().width)
      .fontFamily(TYPE_SOURCE_TOOLS_STATUS.fontFamily as string)
      .fontWeight(TYPE_SOURCE_TOOLS_STATUS.fontWeight ?? 400)
      .fontSize(TYPE_SOURCE_TOOLS_STATUS.fontSizeFp)
      .lineHeight(TYPE_SOURCE_TOOLS_STATUS.lineHeightFp as number)
      .fontColor(readerAppColor('TOK_CONTROL_INK', this.appThemeScheme))
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

  private originalActionCurrent(identity: string): boolean {
    return this.mounted && this.originalActionIdentities().indexOf(identity) >= 0 && this.operation.original?.busy !== true;
  }

  @Builder
  private originalRecovery() {
    ForEach(this.originalActionIdentities(), (identity: string) => {
      ReaderRecoveryNotice({ view: this.originalRecoveryView(), actionLabel: '核对',
        busy: this.operation.original?.busy === true,
        secondaryActionLabel: this.operation.original?.canRetryOriginal === true ?
          (this.operation.original?.confirmation === 'confirmed' && this.operation.original?.writeStage === 'cleanup' ? '继续清理' : '继续') : '',
        onReconcile: (generation: number): void => { if (this.originalActionCurrent(identity)) this.onReconcile(generation); },
        onSecondaryAction: (generation: number): void => { if (this.originalActionCurrent(identity)) this.onContinueOriginal(generation); } });
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
      .hitTestBehavior(HitTestMode.Transparent);
  }

  private feedbackIdentity(): string {
    return `${this.operation.receipt?.facts.generation ?? 0}:${this.operation.readFacts?.generation ?? 0}:` +
      `${this.statusKind}:${this.statusMessage}`;
  }

  private onMessageChanged(): void {
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
            label: category === 'all' ? '全部类型' : readerSourceCategoryLabel(category as ReaderSourceCategory),
            primary: this.categoryValue === category, selectionSemantic: true,
            actionAccessibilityLabel: `书源类型，${category === 'all' ? '全部类型' : readerSourceCategoryLabel(category as ReaderSourceCategory)}`,
            onAction: (): void => { this.categoryValue = category; this.rebuildSourceProjection(); } })
            .id(`source-category-${category}`);
        }, (category: string): string => category);
      }
    }
    .scrollable(ScrollDirection.Horizontal)
    .scrollBar(BarState.Off)
    .width(this.contentFrame().width)
    .height(this.layoutBudget().filterHeight)
    .margin({ top: TOK_SPACE_XS });
  }

  @Builder
  private statusFilter() {
    Scroll() {
    Row({ space: TOK_SPACE_XS }) {
      this.chip('全部', 58, true);
      this.chip('启用', 58, true);
      this.chip('异常', 58, true);
      this.chip('未检测', 72, true);
      // 原稿保留该视觉位，但没有稳定业务定义；禁用比伪造筛选语义更诚实。
      this.chip('自定义', 72, false);
    }
    .width(this.layoutBudget().statusContentWidth)
    .height(this.layoutBudget().filterHeight)
    .alignItems(VerticalAlign.Center);
    }
    .width(this.filterControlWidth())
    .height(this.layoutBudget().filterHeight)
    .scrollable(ScrollDirection.Horizontal)
    .scrollBar(BarState.Off);
  }

  @Builder
  private chip(label: string, width: number, enabled: boolean) {
    ReaderButton({ scheme: this.appThemeScheme, specId: width === 58 ? 'source-management-status-compact' : 'source-management-status-wide',
      label, primary: enabled && this.statusValue === label, actionEnabled: enabled, availableWidth: this.filterControlWidth(),
      selectionSemantic: true, actionAccessibilityLabel: `书源状态，${label}${enabled ? '' : '，暂不可用'}`,
      onAction: (): void => { if (enabled) { this.statusValue = label; this.rebuildSourceProjection(); } } });
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
        .maxFontScale(this.fontScale())
        .fontColor(readerAppColor('TOK_INK', this.appThemeScheme))
        .maxLines(1);
      ReaderSelect({
        value: this.groupValue,
        options: this.groupOptions(),
        controlWidth: this.groupSelectWidth(),
        isOpen: this.groupOpen,
        variant: 'sourceGroup',
        reduceMotion: this.reduceMotion,
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
      if (this.sources.length > 0 && this.projectedSources.length === 0 &&
        this.statusKind !== 'loading' && this.operation.original?.blocked !== true &&
        this.operation.receipt?.receipt.confirmation !== 'unknown') {
        ListItem() {
          ReaderPageState({ title: '没有匹配的书源', message: '调整搜索、状态、分类或分组',
            actionLabel: '清除筛选', onAction: (): void => this.clearFilters() });
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
    .onAppear((): void => {
      this.sourceListMounted = true;
      if (this.pendingScroll === undefined) {
        try { this.sourceScroller.scrollEdge(Edge.Top); } catch (_error) {}
      } else this.queueScrollRestore();
    })
    .onAreaChange((): void => this.queueScrollRestore())
    .onScrollIndex((first: number): void => { this.firstVisibleListIndex = first; this.captureScroll(); })
    .onScrollStop((): void => this.captureScroll())
    .onTouch((event: TouchEvent): void => { if (event.type === TouchType.Down) this.cancelScrollRestore(); })
    .scrollBar(BarState.Off);
  }

  @Builder
  private sourceRow(source: BookSource) {
    Column({ space: TOK_SPACE_XS }) {
      if (this.layoutBudget(source).rowForm === 'stacked-leading') {
        this.sourceLeading();
        this.sourceInfo(source);
        this.sourceActions(source);
      } else {
        Row({ space: TOK_SPACE_XS }) {
          this.sourceLeading();
          this.sourceInfo(source);
          if (this.layoutBudget(source).rowForm === 'inline') {
            this.sourceActions(source);
          }
        }.width('100%').alignItems(VerticalAlign.Center);
        if (this.layoutBudget(source).rowForm === 'stacked-actions') {
          this.sourceActions(source);
        }
      }
    }
    .width(this.contentFrame().width)
    .constraintSize({ minHeight: this.layoutBudget(source).rowMinHeight })
    .padding({ top: TOK_SPACE_XS, bottom: TOK_SPACE_XS, right: TOK_SPACE_XS })
    .alignItems(HorizontalAlign.Start)
    .border({ width: { top: TOK_BORDER_W }, color: readerAppColor('TOK_ROW_DIVIDER', this.appThemeScheme) });
  }

  @Builder
  private sourceLeading() {
      Stack({ alignContent: Alignment.Center }) {
        Image((this.appThemeScheme === 'night' ? $r('app.media.source_group_folder_theme_night') : $r('app.media.source_group_folder')))
          .width(20).height(20).accessibilityLevel('no');
      }
      .width(36)
      .height(40)
      .borderRadius(10)
      .backgroundColor(readerAppColor('TOK_SURFACE_PANEL_SOFT', this.appThemeScheme));
  }

  @Builder
  private sourceInfo(source: BookSource) {
      Column({ space: TOK_SPACE_XS }) {
        Row({ space: 6 }) {
          Text(source.name)
            .constraintSize({ minWidth: 0 }).flexShrink(1)
            .fontFamily(TYPE_SOURCE_MANAGEMENT_TITLE.fontFamily)
            .fontWeight(TYPE_SOURCE_MANAGEMENT_TITLE.fontWeight)
            .fontSize(TYPE_SOURCE_MANAGEMENT_TITLE.fontSizeFp)
            .maxFontScale(this.fontScale())
            .lineHeight(TYPE_SOURCE_MANAGEMENT_TITLE.lineHeightFp as number)
            .fontColor(readerAppColor('TOK_INK', this.appThemeScheme))
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis });
          Text(readerSourceCategoryLabel(source.category))
            .flexShrink(0)
            .fontFamily(TYPE_SOURCE_TOOLS_STATUS.fontFamily as string)
            .fontWeight(TYPE_SOURCE_TOOLS_STATUS.fontWeight ?? 400)
            .fontSize(TYPE_SOURCE_TOOLS_STATUS.fontSizeFp)
            .maxFontScale(this.fontScale())
            .lineHeight(TYPE_SOURCE_TOOLS_STATUS.lineHeightFp as number)
            .fontColor(readerAppColor('TOK_CONTROL_INK', this.appThemeScheme))
            .maxLines(1);
        }.width('100%').alignItems(VerticalAlign.Center);
        Text(source.baseUrl)
          .width('100%')
          .fontFamily(TYPE_SOURCE_TOOLS_STATUS.fontFamily as string)
          .fontWeight(TYPE_SOURCE_TOOLS_STATUS.fontWeight ?? 400)
          .fontSize(TYPE_SOURCE_TOOLS_STATUS.fontSizeFp)
          .maxFontScale(this.fontScale())
          .lineHeight(TYPE_SOURCE_TOOLS_STATUS.lineHeightFp as number)
          .fontColor(readerAppColor('TOK_CONTROL_INK', this.appThemeScheme))
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis });
        if (source.checkMessage !== undefined && source.checkMessage.trim().length > 0 &&
          source.checkState !== undefined && source.checkState !== 'unchecked') {
          Text(source.checkMessage)
            .width('100%')
            .fontFamily(TYPE_SOURCE_TOOLS_STATUS.fontFamily as string)
            .fontWeight(TYPE_SOURCE_TOOLS_STATUS.fontWeight ?? 400)
            .fontSize(TYPE_SOURCE_TOOLS_STATUS.fontSizeFp)
            .maxFontScale(this.fontScale())
            .lineHeight(TYPE_SOURCE_TOOLS_STATUS.lineHeightFp as number)
            .fontColor(readerAppColor('TOK_CONTROL_INK', this.appThemeScheme))
            .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis });
        }
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
    Row({ space: TOK_SPACE_XS }) {
      if (source.loginUrl !== undefined && source.loginUrl.trim().length > 0) {
        this.loginButton(source);
      }

      this.detectButton(source);

      this.statusBadge(
        this.statusBadgeBackground(source),
        this.statusBadgeDot(source),
        this.statusBadgeLabel(source),
      );

      this.sourceSwitch(source.enabled, (next: boolean): void => this.onToggleSource(source.sourceId, next), source.sourceId, source.name);

    }
    .width(this.layoutBudget(source).trailingWidth)
    .constraintSize({ minHeight: this.layoutBudget(source).filterHeight })
    .alignItems(VerticalAlign.Center);
  }

  @Builder
  private detectButton(source: BookSource) {
    ForEach([`${this.temporaryBackIdentity}:${source.sourceId}`], (identity: string): void => {
      ReaderButton({ scheme: this.appThemeScheme, specId: 'source-management-detect',
        label: source.checkState === 'checking' ? '检测中' : '检测', isBusy: source.checkState === 'checking',
        actionEnabled: this.sourceDetectEnabled(source.sourceId),
        actionAccessibilityLabel: this.sourceActionLabel(source, '检测', this.sourceDetectEnabled(source.sourceId), source.checkState === 'checking'),
        onAction: (): void => {
          if (identity === `${this.temporaryBackIdentity}:${source.sourceId}` && this.sourceDetectEnabled(source.sourceId)) {
            this.onDetectSource(source.sourceId);
          }
        } });
    }, (identity: string): string => identity);
  }

  private sourceDetectEnabled(sourceId: string): boolean {
    if (!this.mounted) return false;
    const current = this.sources.find((candidate: BookSource): boolean => candidate.sourceId === sourceId);
    // Diagnostic intent does not confirm/replay a pending source write. Core
    // still owns transaction admission and any diagnostic/content cache writes.
    return current !== undefined && current.checkState !== 'checking';
  }

  @Builder
  private loginButton(source: BookSource) {
    ReaderButton({ scheme: this.appThemeScheme, specId: 'source-management-login', label: '登录',
      isBusy: source.checkState === 'checking',
      actionEnabled: this.sourceActionEnabled() && source.checkState !== 'checking',
      actionAccessibilityLabel: this.sourceActionLabel(source, '登录', this.sourceActionEnabled() && source.checkState !== 'checking', source.checkState === 'checking'),
      onAction: (): void => this.onLoginSource(source.sourceId) });
  }

  private sourceActionLabel(source: BookSource, action: string, enabled: boolean, busy: boolean): string {
    const entity = source.name.trim().length > 0 ? source.name : source.sourceId;
    return `${entity}，${action}${busy ? '，忙碌' : enabled ? '' : '，暂不可用'}`;
  }

  private statusBadgeLabel(source: BookSource): string {
    if (source.checkState === 'checking') return '正在检测';
    if (source.checkState === 'passed') return '检测通过';
    if (source.checkState === 'failed') return '检测失败';
    return '未检测';
  }

  @Builder
  private statusBadge(bg: string, dot: string, label: string) {
    Row() { StatusBadge({ bg: bg, dot: dot, radius: 999 }); }
      .accessibilityText(label)
      .accessibilityGroup(true);
  }

  @Builder
  private sourceSwitch(value: boolean, onTap: (next: boolean) => void, sourceId: string, sourceName: string = '') {
    ForEach([`${this.temporaryBackIdentity}:${sourceId}`], (identity: string): void => {
      ReaderToggle({ value, specId: 'standard-toggle', inputIdentity: identity,
        accessibilityLabel: `${sourceName.trim().length > 0 ? sourceName : sourceId}，启用书源${this.sourceToggleBusy() ? '，忙碌' : this.sourceActionEnabled() ? '' : '，暂不可用'}`,
        actionEnabled: this.sourceActionEnabled(), isBusy: this.sourceToggleBusy(),
        onToggle: (next: boolean): void => {
          if (identity === `${this.temporaryBackIdentity}:${sourceId}` && this.sourceActionEnabled() && !this.sourceToggleBusy()) onTap(next);
        } });
    }, (identity: string): string => identity);
  }

  private sourceToggleBusy(): boolean {
    return this.operation.original?.busy === true || this.operation.receipt?.facts.fact === 'refreshing';
  }

  private sourceActionEnabled(): boolean {
    return this.mounted && this.operation.original?.blocked !== true && this.operation.receipt?.receipt.confirmation !== 'unknown';
  }

  @Builder
  private bottomActionBar() {
    Row({ space: TOK_SPACE_CONTROL_INLINE }) {
      ReaderButton({ scheme: this.appThemeScheme, specId: 'source-management-manage', label: '批量管理', layout: 'equal',
        onAction: (): void => this.openTools() });
      ReaderLabeledIconAction({ scheme: this.appThemeScheme, specId: 'source-management-add', label: '新增书源',
        icon: $r('app.media.source_add'), onAction: (): void => this.onAddSource() });
    }
    .width(this.contentFrame().width)
    .height(this.layoutBudget().footerHeight)
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

  private statusBadgeBackground(source: BookSource): string {
    if (source.checkState === 'passed') {
      return readerAppColor('app.status.goodSoft', this.appThemeScheme);
    }
    if (source.checkState === 'failed') {
      return readerAppColor('app.status.checkErrorSoft', this.appThemeScheme);
    }
    return readerAppColor('app.status.mutedSoft', this.appThemeScheme);
  }

  private statusBadgeDot(source: BookSource): string {
    if (source.checkState === 'passed') {
      return readerAppColor('app.status.good', this.appThemeScheme);
    }
    if (source.checkState === 'failed') {
      return readerAppColor('app.status.checkError', this.appThemeScheme);
    }
    return readerAppColor('app.status.mutedDot', this.appThemeScheme);
  }

  private filteredEnabledCount(): number {
    return this.projectedSources.filter((source) => source.enabled).length;
  }

  private statsText(): string {
    const filteredCount = this.projectedSources.length;
    const prefix = filteredCount === this.sources.length ? `${this.sources.length} 个书源` :
      `显示 ${filteredCount}/${this.sources.length} 个书源`;
    return `${prefix} · ${this.filteredEnabledCount()} 个启用`;
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
    this.rebuildSourceProjection();
  }

  private restoreInitialFilters(): void {
    const filters = copySourceManagementFilters(this.initialFilters);
    this.searchQuery = filters.searchQuery;
    this.statusValue = filters.statusValue;
    this.categoryValue = filters.categoryValue;
    this.groupValue = filters.groupValue;
  }

  private publishFilters(): void {
    if (!this.mounted || this.temporaryBackIdentity.length === 0) return;
    this.onFiltersChange(copySourceManagementFilters({ searchQuery: this.searchQuery, statusValue: this.statusValue,
      categoryValue: this.categoryValue, groupValue: this.groupValue }));
  }

  private rebuildSourceProjection(): void {
    const key = this.currentFilterKey();
    const changed = this.lastProjectionFilterKey.length > 0 && this.lastProjectionFilterKey !== key;
    this.lastProjectionFilterKey = key;
    const projected = this.filteredSources();
    this.sourceDataSource.replace(projected);
    this.projectedSources = projected;
    this.publishFilters();
    if (changed && this.mounted) {
      this.cancelScrollRestore();
      this.firstVisibleListIndex = 0;
      if (this.sourceListMounted) {
        try { this.sourceScroller.scrollEdge(Edge.Top); } catch (_error) {}
      }
      this.onScrollChange({ anchorId: '', firstIndex: 0, itemY: 0, offset: -readerScrollStartOffset(this.scrollLayout()),
        filterKey: key, layoutKey: this.scrollLayoutKey() });
    } else this.queueScrollRestore();
  }

  private currentFilterKey(): string {
    return sourceManagementFilterKey({ searchQuery: this.searchQuery, statusValue: this.statusValue,
      categoryValue: this.categoryValue, groupValue: this.groupValue });
  }

  private scrollLayoutKey(): string { return `${this.contentFrame().width}:${this.fontScale()}:${this.readerWindowMetricsRevision}`; }

  private cancelScrollRestore(): void {
    this.scrollRestoreEpoch++;
    this.pendingScroll = undefined;
    this.restoringScroll = false;
  }

  private captureScroll(): void {
    if (!this.mounted || !this.sourceListMounted || this.pendingScroll !== undefined || this.restoringScroll) return;
    try {
      const offset = this.sourceScroller.currentOffset();
      if (offset === undefined || !Number.isFinite(offset.yOffset)) return;
      const index = Math.max(0, this.firstVisibleListIndex);
      const source = index > 0 ? this.projectedSources[index - 1] : undefined;
      let itemY = 0;
      if (source !== undefined) itemY = this.sourceScroller.getItemRect(index).y;
      if (!Number.isFinite(itemY)) return;
      this.onScrollChange({ anchorId: source?.sourceId ?? '', firstIndex: index, itemY,
        offset: offset.yOffset, filterKey: this.currentFilterKey(), layoutKey: this.scrollLayoutKey() });
    } catch (_error) {}
  }

  private openTools(): void { this.captureScroll(); this.onOpenTools(); }

  private queueScrollRestore(): void {
    const pending = this.pendingScroll;
    if (!this.mounted || !this.sourceListMounted || this.restoringScroll || pending === undefined) return;
    if (pending.filterKey !== this.currentFilterKey()) { this.cancelScrollRestore(); return; }
    if (pending.anchorId.length > 0 && this.sources.length === 0 && this.statusKind === 'loading') return;
    const identity = this.temporaryBackIdentity, epoch = ++this.scrollRestoreEpoch;
    this.restoringScroll = true;
    const current = (): boolean => this.mounted && this.sourceListMounted && identity === this.temporaryBackIdentity &&
      epoch === this.scrollRestoreEpoch && pending.filterKey === this.currentFilterKey();
    this.getUIContext().postFrameCallback(new SourceManagementLayoutFrame((): void => {
      if (!current()) return;
      if (pending.anchorId.length === 0 || this.projectedSources.length === 0) {
        try {
          if (pending.anchorId.length === 0 && this.projectedSources.length > 0 && pending.layoutKey === this.scrollLayoutKey()) {
            this.sourceScroller.scrollTo({ xOffset: 0, yOffset: pending.offset, animation: false });
          } else this.sourceScroller.scrollEdge(Edge.Top);
        } catch (_error) {}
        this.pendingScroll = undefined; this.restoringScroll = false; return;
      }
      const found = this.projectedSources.findIndex((source: BookSource): boolean => source.sourceId === pending.anchorId);
      const index = (found >= 0 ? found : Math.min(Math.max(0, pending.firstIndex - 1), this.projectedSources.length - 1)) + 1;
      const targetId = this.projectedSources[index - 1].sourceId;
      try { this.sourceScroller.scrollToIndex(index, false, ScrollAlign.START); }
      catch (_error) { this.cancelScrollRestore(); return; }
      this.getUIContext().postFrameCallback(new SourceManagementLayoutFrame((): void => {
        if (!current()) return;
        try {
          if (this.projectedSources.length === 0) {
            this.sourceScroller.scrollEdge(Edge.Top);
            this.pendingScroll = undefined; this.restoringScroll = false; return;
          }
          const latest = this.projectedSources.findIndex((source: BookSource): boolean => source.sourceId === pending.anchorId);
          const latestIndex = (latest >= 0 ? latest : Math.min(Math.max(0, pending.firstIndex - 1), this.projectedSources.length - 1)) + 1;
          if (latestIndex !== index || this.projectedSources[index - 1]?.sourceId !== targetId) {
            this.sourceScroller.scrollToIndex(latestIndex, false, ScrollAlign.START);
            this.pendingScroll = undefined; this.restoringScroll = false; return;
          }
          const rect = this.sourceScroller.getItemRect(index);
          const desired = pending.layoutKey === this.scrollLayoutKey() ? pending.itemY : readerScrollStartOffset(this.scrollLayout());
          if (rect.height > 0 && Number.isFinite(rect.y)) this.sourceScroller.scrollBy(0, rect.y - desired);
        } catch (_error) {}
        this.pendingScroll = undefined; this.restoringScroll = false;
      }));
    }));
  }

  private clearFilters(): void {
    this.searchQuery = '';
    this.statusValue = '全部';
    this.categoryValue = 'all';
    this.groupValue = '全部分组';
    this.rebuildSourceProjection();
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
    const options: string[] = ['全部分组'];
    for (const source of this.sources) {
      const group = this.normalizedSourceGroup(source);
      if (group !== '' && group !== '全部分组' && options.indexOf(group) < 0) {
        options.push(group);
      }
    }
    return options;
  }

  private measurementGeneration(): number {
    return Math.max(0, this.readerWindowMetricsRevision);
  }

  private footerFallbackHeight(): number {
    return this.footerControlHeight() + TOK_SPACE_SM + this.actionBottomInset();
  }

  private fontScale(): number {
    if (this.readerWindowMetricsRevision < 0) return 1;
    return readerReadableFontScale(ReaderWindowCoordinator.metrics().systemFontScale);
  }

  private layoutBudget(source?: BookSource): SourceManagementLayout {
    const scale = this.fontScale();
    const action = resolveReaderButtonSpec('source-management-detect');
    const actionHeight = readerScaledControlHeight(action.height ?? 44,
      action.text.lineHeightFp ?? action.text.fontSizeFp * 1.5, scale);
    return resolveSourceManagementLayout({ availableWidth: this.contentFrame().width, fontScale: scale,
      hasLogin: source?.loginUrl !== undefined && source.loginUrl.trim().length > 0,
      hasSummary: source?.checkMessage !== undefined && source.checkMessage.trim().length > 0 && source.checkState !== 'unchecked',
      actionWidth: action.fixedWidth * scale, actionHeight, filterHeight: actionHeight, footerHeight: this.footerControlHeight(),
      titleLineHeight: Math.max(TYPE_SOURCE_MANAGEMENT_TITLE.lineHeightFp ?? TYPE_SOURCE_MANAGEMENT_TITLE.fontSizeFp * 1.5,
        TYPE_SOURCE_TOOLS_STATUS.lineHeightFp ?? TYPE_SOURCE_TOOLS_STATUS.fontSizeFp * 1.5),
      metaLineHeight: TYPE_SOURCE_TOOLS_STATUS.lineHeightFp ?? TYPE_SOURCE_TOOLS_STATUS.fontSizeFp * 1.5 });
  }

  private footerControlHeight(): number {
    const footer = resolveReaderButtonSpec('source-management-manage');
    return Math.max(48, readerScaledControlHeight(footer.height ?? 44,
      footer.text.lineHeightFp ?? footer.text.fontSizeFp * 1.5, this.fontScale()), readerScaledControlHeight(44, 20, this.fontScale()));
  }

  private scrollLayout(): ReaderScrollLayout {
    return readerScrollLayout(this.pageGeometry(), { mode: 'contentOffset' });
  }

  private pageGeometry(): ReaderPageGeometry {
    const metrics = ReaderWindowCoordinator.metrics();
    const input = new ReaderPageGeometryInput(metrics);
    input.viewportWidth = this.viewportWidth;
    input.measurementRevision = this.measurementRevision;
    input.headerHeight = this.measurements.read('source:header', readerPageContentStartInset());
    input.footerHeight = this.measurements.read('source:footer', this.footerFallbackHeight());
    input.contentMaxWidth = readerStandardPageSpec('sourceManagement').maxWidth;
    input.contentHorizontalPadding = 19;
    input.contentEndInset = input.footerHeight;
    return resolveReaderPageGeometry(input);
  }

  private contentFrame(): SurfaceHorizontalFrame {
    if (this.readerWindowMetricsRevision < 0) {
      return new SurfaceHorizontalFrame(0, 0, 0);
    }
    return this.pageGeometry().content.frame;
  }

  private filterControlWidth(): number {
    if (!this.expandedLayout) {
      return this.contentFrame().width;
    }
    return Math.max(0, (this.contentFrame().width - 20) / 2);
  }



  private groupSelectWidth(): number {
    return Math.max(0, this.filterControlWidth() - 49 - TYPE_FORM_LABEL_ACTION.fontSizeFp * 2 * this.fontScale());
  }

  private numericAreaLength(value: Length): number {
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
