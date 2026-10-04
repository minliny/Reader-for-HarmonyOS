import { ReaderButton } from '../common/ReaderButton';
import { ReaderIconButton } from '../common/ReaderIconButton';
import { ReaderLabeledIconAction } from '../common/ReaderLabeledIconAction';
import { readerRecoveryView, type ReaderRecoveryView } from '../../app/ReaderRecoveryProjection';
import type { SourceManagementProjection } from './SourceHost';
import { ReaderRecoveryAction } from '../common/ReaderRecoveryAction';
import { ReaderRecoveryNotice } from '../common/ReaderRecoveryNotice';
import { TYPE_FORM_COMPACT_ACTION, TYPE_FORM_HINT, TYPE_FORM_LABEL_ACTION, TYPE_SEARCH_RESULT_INTRO, TYPE_SOURCE_MANAGEMENT_COUNT, TYPE_SOURCE_MANAGEMENT_STATUS, TYPE_SOURCE_MANAGEMENT_TITLE, TYPE_SOURCE_STATE_TITLE } from '../common/ReaderTypography';
import { readerAppColor } from '../common/ReaderThemeRegistry';
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
  SurfaceWidthSpec,
  resolveHorizontalFrame,
} from '../common/SurfaceHorizontalGeometry';
import {
  readerVisualSafeLeft,
  readerVisualSafeRight,
} from '../common/ReaderWindowMetrics';
import {
  TOK_BORDER_W,
  TOK_CARD_BG,
  TOK_CONTENT_MAX_W_TABLET,
  TOK_INK,
  TOK_MUTED,
  TOK_ON_PRIMARY,
  TOK_PAPER,
  TOK_PRIMARY_DARK,
  TOK_ROW_DIVIDER,
  TOK_SCREEN_INSET,
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
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';

  @StorageLink('readerWindowMetricsRevision') private readerWindowMetricsRevision: number = 0;
  @Prop @Watch('onSourcesChanged') sources: BookSource[];
  // 额外分组可由调用方补充；常规选项直接来自 Core 返回的原始
  // bookSource.bookSourceGroup，不按启用状态等 UI 属性伪造。
  @Prop groups: string[] = [];
  @Prop isTablet: boolean;
  @Prop reduceMotion: boolean = false;
  @Prop operation: SourceManagementProjection = { action: 'load', sourceId: '' };
  onReconcile: (generation: number) => void = (_generation: number): void => {};
  onContinueOriginal: (generation: number) => void = (_generation: number): void => {};
  @Prop statusKind: SourceManagementStatusKind = 'idle';
  @Prop statusMessage: string = '';
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

  aboutToAppear(): void {
    this.mounted = true;
    registerReaderFonts(this.getUIContext().getFont());
    this.rebuildSourceProjection();
    const identity = `source-back:${++sourceTemporaryGeneration}`;
    this.temporaryBackIdentity = identity;
    this.onTemporaryBackBridge((): boolean => this.consumeTemporaryBack(identity), identity);
  }

  aboutToDisappear(): void {
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

  build() {
    // 根 Stack = 下拉面板 overlay 宿主: 展开面板必须挂在全高容器才可点 (ArkUI 命中测试
    // 裁到父边界, 固定高行内面板下层选项不可点)。
    Stack({ alignContent: Alignment.TopStart }) {
      Column() { this.sourceList(); }
      .width('100%')
      .height('100%')
      .backgroundColor(readerAppColor('TOK_PAPER', this.appThemeScheme))
      .onAreaChange((_oldValue: Area, newValue: Area): void => {
        // Area.globalPosition 已是 vp 单位, 直接取用 (曾 px2vp 二次÷3.5 致面板错位)。
        this.originX = Number(newValue.globalPosition.x);
        this.originY = Number(newValue.globalPosition.y);
        const width = this.numericAreaLength(newValue.width);
        if (width > 0 && Math.abs(width - this.viewportWidth) >= 0.01) {
          this.viewportWidth = width;
        }
      });

      Row() { this.backBar(); }
        .width('100%').height(58).hitTestBehavior(HitTestMode.Transparent);
      Column() { this.bottomActionBar(); }
        .width('100%').height(44 + TOK_SPACE_SM + this.actionBottomInset())
        .padding({ left: this.contentFrame().left, right: this.contentFrame().right })
        .position({ bottom: 0, left: 0 }).hitTestBehavior(HitTestMode.Transparent);

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
    .width('100%')
    .height('100%')
    .clip(true);
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
    .width(this.contentFrame().width)
    .height(38)
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
      canRetry: false, generation: original?.generation ?? 0 };
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
    ReaderRecoveryNotice({ view: this.originalRecoveryView() });
    ForEach(this.originalActionIdentities(), (identity: string) => {
      ReaderRecoveryAction({ label: '核对原操作回执', generation: this.originalActionGeneration(identity),
        actionEnabled: this.operation.original?.busy !== true,
        onReconcile: (generation: number): void => { if (this.originalActionCurrent(identity)) this.onReconcile(generation); } });
      if (this.operation.original?.canRetryOriginal === true) {
        ReaderRecoveryAction({ label: this.operation.original?.confirmation === 'confirmed' && this.operation.original?.writeStage === 'cleanup' ? '继续原清理' : '继续原操作',
          generation: this.originalActionGeneration(identity), actionEnabled: this.operation.original?.busy !== true,
          onReconcile: (generation: number): void => { if (this.originalActionCurrent(identity)) this.onContinueOriginal(generation); } });
      }
    }, (identity: string): string => identity);
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
    }
    .width(this.contentFrame().width)
    .padding(TOK_SPACE_XS)
    .margin({ top: TOK_SPACE_XS })
    .backgroundColor(this.statusKind === 'error' ? readerAppColor('app.SourceManagementPage.STATUS_ERROR_BG', this.appThemeScheme) : readerAppColor('TOK_CARD_BG', this.appThemeScheme))
    .borderRadius(7);
  }

  @Builder
  private filterArea() {
    if (this.isTablet) {
      Row({ space: 20 }) {
        this.statusFilter();
        this.groupFilter();
      }
      .width(this.contentFrame().width)
      .height(36)
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
    .height(36)
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
          if (this.operation.original?.blocked === true) { this.originalRecovery(); }
          else if (this.statusKind !== 'idle' || this.recovery().visible) { this.statusBanner(); }
          this.filterArea();
          this.categoryFilter();
        }.width('100%').padding({ bottom: TOK_SPACE_CONTROL_INLINE });
      }
      if (this.sources.length === 0 && this.statusKind !== 'loading') {
        ListItem() {
          Column({ space: TOK_SPACE_XS }) {
            Text('暂无书源').fontFamily(TYPE_SOURCE_STATE_TITLE.fontFamily).fontWeight(TYPE_SOURCE_STATE_TITLE.fontWeight)
              .fontSize(TYPE_SOURCE_STATE_TITLE.fontSizeFp).lineHeight(TYPE_SOURCE_STATE_TITLE.lineHeightFp as number).fontColor(readerAppColor('TOK_INK', this.appThemeScheme));
            Text('点击下方「＋ 新增书源」导入 Legado 书源 JSON').fontFamily(TYPE_SEARCH_RESULT_INTRO.fontFamily)
              .fontWeight(TYPE_SEARCH_RESULT_INTRO.fontWeight).fontSize(TYPE_SEARCH_RESULT_INTRO.fontSizeFp).lineHeight(TYPE_SEARCH_RESULT_INTRO.lineHeightFp as number)
              .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme));
          }.width('100%').padding({ top: 64 }).alignItems(HorizontalAlign.Center);
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
    .contentStartOffset(58)
    .contentEndOffset(44 + TOK_SPACE_SM + this.actionBottomInset())
    .scrollBar(BarState.Off);
  }

  @Builder
  private sourceRow(source: BookSource) {
    Row({ space: TOK_SPACE_XS }) {
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
    .height(70)
    .padding({ left: TOK_SPACE_SM })
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
    .height(44)
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

  private contentFrame(): SurfaceHorizontalFrame {
    if (this.readerWindowMetricsRevision < 0) {
      return new SurfaceHorizontalFrame(0, 0, 0);
    }
    const metrics = ReaderWindowCoordinator.metrics();
    const containerWidth = this.viewportWidth > 0 ? this.viewportWidth : metrics.windowRect.width;
    return resolveHorizontalFrame(
      containerWidth,
      readerVisualSafeLeft(metrics),
      readerVisualSafeRight(metrics),
      new SurfaceWidthSpec(TOK_CONTENT_MAX_W_TABLET, TOK_SCREEN_INSET, TOK_SCREEN_INSET),
    );
  }

  private filterControlWidth(): number {
    if (!this.isTablet) {
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
