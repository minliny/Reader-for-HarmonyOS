import { ReaderTransientFeedback, READER_FEEDBACK_EXTENDED_MS } from '../common/ReaderTransientFeedback';
import { ReaderPageScaffold } from '../common/ReaderPageScaffold';
import { readerPageContentStartInset, readerStandardPageSpec } from '../common/ReaderPageShell';
import { ReaderMeasurementStore } from '../common/ReaderMeasurements';
import { ReaderPageGeometry, ReaderPageGeometryInput, resolveReaderPageGeometry } from '../common/ReaderPageGeometry';
import { ReaderButton } from '../common/ReaderButton';
import { ReaderIconButton } from '../common/ReaderIconButton';
import { ReaderPressFeedback } from '../common/ReaderPressFeedback';
import { ReaderLabeledIconAction } from '../common/ReaderLabeledIconAction';
import { readerRecoveryView, type ReaderRecoveryView } from '../../app/ReaderRecoveryProjection';
import type { SourceManagementProjection } from './SourceHost';
import { ReaderRecoveryAction } from '../common/ReaderRecoveryAction';
import { ReaderRecoveryNotice } from '../common/ReaderRecoveryNotice';
import { ReaderPageState } from '../common/ReaderPageState';
import { MESSAGE_BODY } from '../common/ReaderMessageStyle';
import { TYPE_FORM_COMPACT_ACTION, TYPE_FORM_HINT, TYPE_FORM_LABEL_ACTION, TYPE_SEARCH_RESULT_INTRO, TYPE_SOURCE_MANAGEMENT_COUNT, TYPE_SOURCE_MANAGEMENT_STATUS, TYPE_SOURCE_MANAGEMENT_TITLE, TYPE_SOURCE_STATE_TITLE } from '../common/ReaderTypography';
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
import { TYPE_SOURCE_MANAGEMENT_META } from '../common/ReaderTypography';
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
  onStatusAction: (generation: number) => void = (_generation: number): void => {};
  onBack: () => void = (): void => {};
  onToggleSource: (id: string, enabled: boolean) => void = (_id: string, _enabled: boolean): void => {};
  onDetectSource: (id: string) => void = (_id: string): void => {};
  onLoginSource: (id: string) => void = (_id: string): void => {};
  onAddSource: () => void = (): void => {};
  onOpenTools: () => void = (): void => {};
  onRetryLoad: () => void = (): void => {};
  @State private searchQuery: string = '';
  @State private statusValue: string = '全部';
  @State private categoryValue: string = 'all';
  @State private groupValue: string = '全部分组';
  @State private groupOpen: boolean = false;
  @State private groupClosing: boolean = false;
  @State private groupSelectionId: string = '';
  private mounted: boolean = false;
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
        specId: 'toolbar-compact', accessibilityLabel: '书源工具', onTap: (): void => this.onOpenTools() });
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
  private statusBanner() {
    Row({ space: TOK_SPACE_XS }) {
      Text(this.recovery().visible ? this.recovery().message : this.statusMessage)
        .layoutWeight(1)
        .fontFamily(TYPE_SOURCE_MANAGEMENT_STATUS.fontFamily as string)
        .fontSize(TYPE_SOURCE_MANAGEMENT_STATUS.fontSizeFp)
        .lineHeight(TYPE_SOURCE_MANAGEMENT_STATUS.lineHeightFp as number)
        .fontColor(this.statusKind === 'error' ? readerAppColor('app.SourceManagementPage.STATUS_ERROR_DOT', this.appThemeScheme) : readerAppColor('TOK_INK', this.appThemeScheme))
        .maxLines(2)
        .textOverflow({ overflow: TextOverflow.Ellipsis });
      if (this.recovery().canRetry || this.statusKind === 'error') {
        ReaderButton({ scheme: this.appThemeScheme, specId: 'source-management-retry', label: '重试',
          onAction: (): void => {
            if (this.recovery().canRetry) this.onReconcile(this.recovery().generation);
            else this.onRetryLoad();
          } });
      }
      if (this.statusActionLabel.length > 0) {
        ForEach([this.statusActionGeneration], (generation: number): void => {
          ReaderButton({ scheme: this.appThemeScheme, specId: 'source-management-retry', label: this.statusActionLabel,
            onAction: (): void => this.onStatusAction(generation) });
        }, (generation: number): string => generation.toString());
      }
    }
    .width(this.contentFrame().width)
    .padding(TOK_SPACE_XS)
    .margin({ top: TOK_SPACE_XS })
    .backgroundColor(this.statusKind === 'error' ? readerAppColor('app.SourceManagementPage.STATUS_ERROR_BG', this.appThemeScheme) : readerAppColor('TOK_CARD_BG', this.appThemeScheme))
    .borderRadius(7);
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
            primary: this.categoryValue === category,
            onAction: (): void => { this.categoryValue = category; this.rebuildSourceProjection(); } })
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
      label, primary: active, actionEnabled: enabled, availableWidth: this.filterControlWidth(),
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
    List() {
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
    .scrollBar(BarState.Off);
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

      this.statusBadge(
        this.statusBadgeBackground(source),
        this.statusBadgeDot(source),
      );

      this.sourceSwitch(source.enabled, (next: boolean): void => this.onToggleSource(source.sourceId, next), source.sourceId);

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
      label: source.checkState === 'checking' ? '检测中' : '检测', isBusy: source.checkState === 'checking',
      onAction: (): void => { if (source.checkState !== 'checking') this.onDetectSource(source.sourceId); } });
  }

  @Builder
  private loginButton(source: BookSource) {
    ReaderButton({ scheme: this.appThemeScheme, specId: 'source-management-login', label: '登录',
      onAction: (): void => this.onLoginSource(source.sourceId) });
  }

  @Builder
  private statusBadge(bg: string, dot: string) {
    StatusBadge({ bg: bg, dot: dot, radius: 999 });
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
  private bottomActionBar() {
    Row({ space: TOK_SPACE_CONTROL_INLINE }) {
      ReaderButton({ scheme: this.appThemeScheme, specId: 'source-management-manage', label: '批量管理', layout: 'equal',
        onAction: (): void => this.onOpenTools() });
      ReaderLabeledIconAction({ scheme: this.appThemeScheme, specId: 'source-management-add', label: '新增书源',
        icon: $r('app.media.source_add'), onAction: (): void => this.onAddSource() });
    }
    .width(this.contentFrame().width)
    .height(48)
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
      return readerAppColor('app.SourceManagementPage.STATUS_GOOD_BG', this.appThemeScheme);
    }
    if (source.checkState === 'failed') {
      return readerAppColor('app.SourceManagementPage.STATUS_ERROR_BG', this.appThemeScheme);
    }
    return readerAppColor('app.SourceManagementPage.STATUS_MUTED_BG', this.appThemeScheme);
  }

  private statusBadgeDot(source: BookSource): string {
    if (source.checkState === 'passed') {
      return readerAppColor('app.SourceManagementPage.STATUS_GOOD_DOT', this.appThemeScheme);
    }
    if (source.checkState === 'failed') {
      return readerAppColor('app.SourceManagementPage.STATUS_ERROR_DOT', this.appThemeScheme);
    }
    return readerAppColor('app.SourceManagementPage.STATUS_MUTED_DOT', this.appThemeScheme);
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
    this.rebuildSourceProjection();
  }

  private rebuildSourceProjection(): void {
    const projected = this.filteredSources();
    this.sourceDataSource.replace(projected);
    this.projectedSources = projected;
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

  private measurementGeneration(): number {
    return Math.max(0, this.readerWindowMetricsRevision);
  }

  private footerFallbackHeight(): number {
    return 48 + TOK_SPACE_SM + this.actionBottomInset();
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
    return Math.max(0, this.filterControlWidth() - (GROUP_FILTER_WIDTH - GROUP_SELECT_WIDTH));
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
