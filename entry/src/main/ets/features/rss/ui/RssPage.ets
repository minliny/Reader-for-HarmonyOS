import { LengthMetrics } from '@kit.ArkUI';
import { APP_HEADER_BAR_HEIGHT } from '../../../ui/foundation/ReaderHeaderMetrics';
import { READER_LAYOUT_DEBUG_BUILD } from '../../../ui/foundation/ReaderLayoutInvariantSignals';
import type { LayoutInvariantTag } from '../../../ui/layout/LayoutInvariantEvaluator';
import type { RssOriginalMutationIdentity, RssOriginalMutationProjection } from '../application/RssMutationRecoveryContract';
import { ReaderLabeledIconAction } from '../../../ui/controls/ReaderLabeledIconAction';
import { RssPresentationProjection } from '../presentation/RssPresentationProjection';
import type { RssFailedSource, RssFeedItems, RssMode, RssPresentation } from '../presentation/RssPresentationContract';
import { ReaderButton } from '../../../ui/controls/ReaderButton';
import { ReaderRecessedSegmentRail } from '../../../ui/controls/ReaderRecessedSegmentRail';
import { ReaderPageState } from '../../../ui/feedback/ReaderPageState';
import { readerRecoveryView } from '../../../app/ReaderRecoveryProjection';
import { projectOperationFacts, type OperationFacts } from '../../../app/ReaderOperationFacts';
import { TYPE_APP_COMPACT_PRIMARY_ACTION, TYPE_APP_SEGMENT_LABEL, TYPE_APP_SMALL_ACTION, TYPE_RSS_ENTRY_DESCRIPTION, TYPE_RSS_ENTRY_TITLE, TYPE_RSS_ERROR_REASON, TYPE_RSS_HOME_TITLE, TYPE_RSS_LINK_ACTION, TYPE_RSS_META, TYPE_RSS_REFRESH_STATUS, TYPE_RSS_SECTION_HEADING, TYPE_RSS_SOURCE_TITLE, TYPE_RSS_STATE_ACTION, TYPE_RSS_STATE_BODY, TYPE_RSS_STATE_TITLE, TYPE_RSS_UNREAD_COUNT } from '../../../ui/foundation/ReaderTypography';
import { readerAppColor } from '../../../ui/foundation/ReaderThemeRegistry';
import { readerUnionTouchRegion } from '../../../ui/controls/ReaderActionAccessibility';
import {
  type RssFavorite,
  type RssItem,
  type RssSubscription,
} from '../application/RssGateway';
import { ReaderWindowCoordinator } from '../../../app/ReaderWindowCoordinator';
import {
  readerFloatingBarBottomInset,
  readerFloatingTabContentInset,
} from '../../../ui/layout/ReaderFloatingBarMetrics';
import { MainTabShell } from '../../shell/MainTabShell';
import { readerMainNavigationMode, readerMainRailLeading } from '../../shell/MainNavigationSpec';
import { readerIsExpandedWidth } from '../../../ui/foundation/ReaderWidthClass';
import { readerPageAreaLength } from '../../../ui/layout/ReaderPageShell';
import { ReaderEditingVisibility } from '../../../ui/layout/ReaderEditingVisibility';
import { ReaderRaisedShape, resolveReaderRaisedShape } from '../../../ui/layout/ReaderRaisedShape';
import { ReaderPageGeometry, ReaderPageGeometryInput, resolveReaderPageGeometry } from '../../../ui/layout/ReaderPageGeometry';
import { registerReaderFonts } from '../../../ui/foundation/ReaderFonts';
import { ReaderSearchField } from '../../../ui/controls/ReaderSearchField';
import { SEARCH_CAPSULE_HEIGHT } from '../../../ui/foundation/ReaderSearchControlGeometry';
import { StatusBadge, type ReaderStatusBadgeStatus } from '../../../ui/controls/StatusBadge';
import { SurfaceHorizontalFrame } from '../../../ui/layout/SurfaceHorizontalGeometry';
import {
  ReaderRectVp,
  readerInteractiveSafeLeft,
  readerInteractiveSafeRight,
} from '../../../ui/foundation/ReaderWindowMetrics';
import {
  TOK_BORDER_W,
  TOK_CONTENT_RAIL_W_TABLET,
  TOK_SCREEN_INSET,
  TOK_SPACE_CONTROL_INLINE,
  TOK_SPACE_LG,
  TOK_SPACE_MD,
  TOK_SPACE_SM,
  TOK_SPACE_XS,
} from '../../../ui/foundation/ReaderTokens';

// Authored Day colors and opacity are retained in the shared App registry.
// Figma 暂停源整行降透明度 62%
const STATUS_PAUSED_OPACITY = 0.62;
const RSS_STATUS_TABS_HEIGHT = 44;
const RSS_FLOATING_HEADER_HEIGHT = APP_HEADER_BAR_HEIGHT + SEARCH_CAPSULE_HEIGHT + RSS_STATUS_TABS_HEIGHT + TOK_SPACE_XS * 2;

/**
 * Figma-backed RSS page (`10 · Reference · RSS` `F2 · Canonical · RSS`).
 * Content-swap architecture: the RSS skeleton (top bar + search + status tabs)
 * and bottom Tab bar stay constant; only the content area swaps per state.
 * User decision 2026-08-08: the Figma `State=*` symbols (2305:738/789/849)
 * draw these states as standalone back-bar screens, but they are meant as
 * in-place content replacement within the skeleton + Tab bar. Consumes
 * characterized state and emits intents; never creates a Core runtime or
 * parses Core protocol.
 */
@Component
export struct RssPage {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';

  @StorageLink('readerWindowMetricsRevision') private readerWindowMetricsRevision: number = 0;
  @StorageLink('readerUiConfigurationRevision') private uiConfigurationRevision: number = 0;
  @StorageLink('readerMainViewportRevision') private mainViewportRevision: number = 0;
  @StorageLink('readerWideNavigationRail') private wideNavigationRail: boolean = false;
  @Prop presentation: RssPresentation;
  @Prop expandedLayout: boolean;
  @Prop activeMode: RssMode = 'sources';
  @Prop feedItems: RssFeedItems = { all: [], favorites: [] };
  @Prop original: RssOriginalMutationProjection | undefined = undefined;
  @Prop presentationIdentity: string = '';
  onReconcileOriginal: (expected: RssOriginalMutationIdentity) => void = (_expected: RssOriginalMutationIdentity): void => {};
  @Prop readFacts: OperationFacts<RssSubscription[]> = projectOperationFacts<RssSubscription[]>({ phase: 'idle' });
  onRetryRead: (facts: OperationFacts<RssSubscription[]>) => void = (_facts: OperationFacts<RssSubscription[]>): void => {};
  onBack: () => void = (): void => {};
  onRefresh: () => void = (): void => {};
  onManage: () => void = (): void => {};
  onSelectSubscription: (id: string) => void = (_id: string): void => {};
  onSelectItem: (subscriptionId: string, guid: string) => void =
    (_subscriptionId: string, _guid: string): void => {};
  onModeRequested: (mode: RssMode) => void = (_mode: RssMode): void => {};
  onSettingsRequested: () => void = (): void => {};
  onDiscoverRequested: () => void = (): void => {};
  @State private filterValue: string = '全部';
  @State private filterOpen: boolean = false;
  @State private query: string = '';
  @State private measuredHeaderHeight: number = 0;
  @State private viewportWidth: number = 0;
  @State private refreshPillShape: ReaderRaisedShape | undefined = undefined;
  @State private pillAppearanceRevision: number = 0;
  private pillMounted: boolean = false;
  private readonly editingHost: ReaderEditingVisibility = new ReaderEditingVisibility();

  aboutToAppear(): void {
    this.pillMounted = true;
    this.pillAppearanceRevision += 1;
    this.refreshPillShape = undefined;
    registerReaderFonts(this.getUIContext().getFont());
    this.editingHost.mount({
      current: (): boolean => this.pillMounted,
      metrics: () => ReaderWindowCoordinator.metrics(),
      viewport: (): ReaderRectVp => {
        const window = ReaderWindowCoordinator.metrics().windowRect;
        return new ReaderRectVp(0, 0, window.width, window.height);
      },
      // The header is fixed. The native editor scrolls its own query to the caret.
      scroll: (_delta: number): void => {},
    });
  }

  aboutToDisappear(): void {
    this.pillMounted = false;
    this.editingHost.unmount();
  }

  build() {
    MainTabShell({
      activeTab: 'rss', headerKind: 'rss',
      onMainTab: (key: string): void => this.onMainTab(key),
      header: (): void => { this.rssHeader(); },
      content: (): void => { this.rssContent(); },
    });
  }

  @Builder
  private rssContent() {
    Row() {
      Stack({ alignContent: Alignment.TopStart }) {
        if (this.presentation.kind === 'fatalError') {
          this.errorContent();
        } else if (this.activeMode !== 'sources') {
          this.articleModeContent();
        } else if (this.presentation.kind === 'feed') {
          this.feedScroll(
            (): RssSubscription[] => RssPresentationProjection.subscriptions(this.presentation),
            (): RssItem[] => RssPresentationProjection.recentUnread(this.presentation), false);
        } else if (this.presentation.kind === 'refreshing') {
          this.feedScroll(
            (): RssSubscription[] => RssPresentationProjection.subscriptions(this.presentation),
            (): RssItem[] => RssPresentationProjection.recentUnread(this.presentation), true);
        } else if (this.presentation.kind === 'emptyUnread') {
          this.emptyUnreadScroll((): RssSubscription[] => RssPresentationProjection.subscriptions(this.presentation));
        }
      }.layoutWeight(1).height('100%');
    }.width('100%').height('100%')
      .onAreaChange((_oldValue: Area, newValue: Area): void => {
        const width = this.numericAreaLength(newValue.width);
        if (width > 0 && Math.abs(width - this.viewportWidth) >= 0.01) {
          this.viewportWidth = width;
        }
      });
  }

  @Builder
  private rssHeader() {
    Row() {
      if (this.isRailActive()) { Blank().width(readerMainRailLeading()); }
      Column() {
        this.topBar();
        this.searchBar();
        this.statusTabs();
      }.layoutWeight(1).constraintSize({ minHeight: RSS_FLOATING_HEADER_HEIGHT }).alignItems(HorizontalAlign.Start)
        .onAreaChange((_old: Area, next: Area): void => { this.measuredHeaderHeight = this.numericAreaLength(next.height); });
    }.width('100%');
  }

  // 页私有 (不用 AppTopBar): Figma 2305:29 容器 justify-end → 刷新/管理胶囊簇靠右,
  // RSS 标题左 20vp。SpaceBetween 复现 justify-end (管理右缘 = 栏宽 - 20vp 内缩)。
  @Builder
  private topBar() {
    Flex({ wrap: FlexWrap.Wrap, justifyContent: FlexAlign.SpaceBetween, alignItems: ItemAlign.Center,
      space: { main: LengthMetrics.vp(TOK_SPACE_XS), cross: LengthMetrics.vp(TOK_SPACE_XS) } }) {
      Text('RSS')
        .customProperty('readerLayoutInvariant', typeof READER_LAYOUT_DEBUG_BUILD === 'boolean' && READER_LAYOUT_DEBUG_BUILD
          ? { role: 'header-content', id: 'rss-title', wrapPart: 'leading' } as LayoutInvariantTag : undefined)
        .fontFamily(TYPE_RSS_HOME_TITLE.fontFamily)
        .fontWeight(TYPE_RSS_HOME_TITLE.fontWeight)
        .fontSize(TYPE_RSS_HOME_TITLE.fontSizeFp)
        .lineHeight(TYPE_RSS_HOME_TITLE.lineHeightFp as number)
        .fontColor(readerAppColor('TOK_PRIMARY_TEXT', this.appThemeScheme))
        .maxLines(1)
        .margin({ left: this.headerLeftInset() });

      Flex({ wrap: FlexWrap.Wrap, alignItems: ItemAlign.Center,
        space: { main: LengthMetrics.vp(6), cross: LengthMetrics.vp(6) } }) {
        this.refreshPill();
        this.managePill();
      }
      .customProperty('readerLayoutInvariant', typeof READER_LAYOUT_DEBUG_BUILD === 'boolean' && READER_LAYOUT_DEBUG_BUILD
        ? { role: 'header-content', id: 'rss-top-actions', wrapPart: 'trailing' } as LayoutInvariantTag : undefined)
      .constraintSize({ maxWidth: this.contentFrame().width })
      .margin({ left: this.headerLeftInset() });
    }
    .width('100%')
    .constraintSize({ minHeight: APP_HEADER_BAR_HEIGHT })
    .customProperty('readerLayoutInvariant', typeof READER_LAYOUT_DEBUG_BUILD === 'boolean' && READER_LAYOUT_DEBUG_BUILD
      ? { role: 'fixed-header', id: 'rss-top-bar', expectedHeightVp: APP_HEADER_BAR_HEIGHT,
        expectedTopGapVp: 0, wrapGapVp: TOK_SPACE_XS } as LayoutInvariantTag : undefined)
    .padding({ right: this.headerRightInset() });
  }

  private headerLeftInset(): number {
    if (this.readerWindowMetricsRevision < 0) return TOK_SCREEN_INSET;
    return Math.max(TOK_SCREEN_INSET, readerInteractiveSafeLeft(ReaderWindowCoordinator.metrics()));
  }

  private headerRightInset(): number {
    if (this.readerWindowMetricsRevision < 0) return TOK_SCREEN_INSET;
    return Math.max(TOK_SCREEN_INSET, readerInteractiveSafeRight(ReaderWindowCoordinator.metrics()));
  }

  @Builder
  private refreshPill() {
    Row({ space: 7 }) {
      Text('')
        .width(9)
        .height(9)
        .borderRadius(4.5)
        .backgroundColor(readerAppColor('app.action.fill', this.appThemeScheme));
      if (this.isWideViewport()) {
        Text(this.refreshStatusText())
          .fontFamily(TYPE_APP_COMPACT_PRIMARY_ACTION.fontFamily)
          .fontWeight(TYPE_APP_COMPACT_PRIMARY_ACTION.fontWeight)
          .fontSize(TYPE_APP_COMPACT_PRIMARY_ACTION.fontSizeFp).lineHeight(18).halfLeading(true)
          .fontColor(readerAppColor('TOK_PRIMARY_TEXT', this.appThemeScheme))
          .maxLines(1);
      } else {
        Marquee({
          start: true,
          step: 4,
          loop: -1,
          fromStart: true,
          src: this.refreshStatusText(),
        })
          .constraintSize({ maxWidth: this.refreshMarqueeWidth() })
          .fontFamily(TYPE_APP_COMPACT_PRIMARY_ACTION.fontFamily)
          .fontWeight(TYPE_APP_COMPACT_PRIMARY_ACTION.fontWeight)
          .fontSize(TYPE_APP_COMPACT_PRIMARY_ACTION.fontSizeFp)
          .fontColor(readerAppColor('TOK_PRIMARY_TEXT', this.appThemeScheme));
      }
      Image((this.appThemeScheme === 'night' ? $r('app.media.rss_refresh_theme_night') : $r('app.media.rss_refresh')))
        .width(14)
        .height(14);
    }
    .constraintSize({ minHeight: 34 })
    .padding({ left: 11, right: 9 })
    .alignItems(VerticalAlign.Center)
    .backgroundColor(readerAppColor('app.feed.pillSurface', this.appThemeScheme))
    .border({ width: TOK_BORDER_W, color: readerAppColor('app.feed.pillBorder', this.appThemeScheme) })
    .borderRadius(this.currentRefreshPillRadius())
    .onAreaChange(this.refreshPillAreaHandler())
    .responseRegion(readerUnionTouchRegion('100%', 34))
    .accessibilityText('刷新订阅')
    .onClick((): void => { if (!this.feedBusy()) this.onRefresh(); });
  }

  private refreshPillMeasurementKey(): string {
    return `${this.pillAppearanceRevision}:${this.readerWindowMetricsRevision}:${this.uiConfigurationRevision}:` +
      `${this.viewportWidth}:${this.mainViewportRevision}:${this.isWideViewport()}:${this.refreshStatusText()}`;
  }

  private refreshPillAreaHandler(): (oldValue: Area, next: Area) => void {
    const identity = this.refreshPillMeasurementKey();
    return (_old: Area, next: Area): void => {
      if (!this.pillMounted || identity !== this.refreshPillMeasurementKey()) return;
      const shape = resolveReaderRaisedShape(identity, readerPageAreaLength(next.width),
        readerPageAreaLength(next.height), 999);
      if (shape === undefined) return;
      if (shape.identity !== this.refreshPillShape?.identity || shape.radius !== this.refreshPillShape?.radius) {
        this.refreshPillShape = shape;
      }
    };
  }

  private currentRefreshPillRadius(): number {
    return this.pillMounted && this.refreshPillShape !== undefined ? this.refreshPillShape.radius : 17;
  }

  @Builder
  private managePill() {
    ReaderLabeledIconAction({ scheme: this.appThemeScheme, specId: 'rss-manage', label: '管理',
      icon: this.appThemeScheme === 'night' ? $r('app.media.rss_manage_theme_night') : $r('app.media.rss_manage'),
      onAction: (): void => this.onManage() });
  }

  @Builder
  private searchBar() {
    Row() {
      ReaderSearchField({
        editingHost: this.editingHost, variant: 'rss', mode: 'live', text: this.query,
        placeholder: '搜索订阅内容', accessibilityLabel: '搜索订阅源、文章标题或分组',
        onTextChange: (value: string): void => { this.query = value; },
      });
    }.width(this.contentFrame().width)
      .alignItems(VerticalAlign.Center)
      .margin({ top: TOK_SPACE_XS, left: this.contentFrame().left });
  }

  private systemFontScale(): number {
    const value = this.readerWindowMetricsRevision < 0 ? 1 : ReaderWindowCoordinator.metrics().systemFontScale;
    return Number.isFinite(value) && value > 0 ? value : 1;
  }

  @Builder
  private statusTabs() {
    if (this.systemFontScale() < 1.75) {
      Row() {
        ReaderRecessedSegmentRail({
          options: [
            { id: 'sources', label: '源列表', accessibilityText: '订阅视图：源列表' },
            { id: 'all', label: '全部', accessibilityText: '订阅视图：全部' },
            { id: 'favorites', label: '收藏', accessibilityText: '订阅视图：收藏' },
          ],
          selectedId: this.activeMode,
          accessibilityGroupLabel: '订阅视图',
          trackHeight: 36,
          pillShape: true,
          onSelect: (modeId: string): void => this.onModeRequested(modeId as RssMode),
        });
      }.width(this.contentFrame().width).height(RSS_STATUS_TABS_HEIGHT)
        .margin({ top: TOK_SPACE_XS, left: this.contentFrame().left })
        .alignItems(VerticalAlign.Center);
    } else {
      Scroll() {
        Row({ space: 6 }) {
          this.statusTab('源列表', 'sources');
          this.statusTab('全部', 'all');
          this.statusTab('收藏', 'favorites');
        }.constraintSize({ minWidth: this.contentFrame().width, minHeight: RSS_STATUS_TABS_HEIGHT })
          .alignItems(VerticalAlign.Center);
      }.width(this.contentFrame().width).scrollable(ScrollDirection.Horizontal).scrollBar(BarState.Off)
        .margin({ top: TOK_SPACE_XS, left: this.contentFrame().left });
    }
  }

  @Builder
  private statusTab(label: string, mode: RssMode) {
    ReaderButton({ scheme: this.appThemeScheme, specId: 'rss-mode-tab', label, primary: this.activeMode === mode,
      onAction: (): void => this.onModeRequested(mode) });
  }

  @Builder
  private readFeedback() {
    if (readerRecoveryView(undefined, this.readFacts).visible) {
      ForEach([this.readFacts.generation], (generation: number): void => {
      ReaderPageState({ message: readerRecoveryView(undefined, this.readFacts).message,
        loading: this.readFacts.fact === 'loading' || this.readFacts.fact === 'refreshing', padded: false,
        actionLabel: this.readFacts.canRetry ? '重新读取' : '',
        onAction: (): void => {
          if (this.readFacts.generation === generation && this.readFacts.canRetry) this.onRetryRead(this.readFacts);
        } });
      }, (generation: number): string => `rss-read:${generation}`);
    }
  }

  private feedBusy(): boolean {
    return this.readFacts.fact === 'loading' || this.readFacts.fact === 'refreshing';
  }

  private matchesQuery(value: string): boolean {
    return value.toLowerCase().includes(this.query.trim().toLowerCase());
  }

  private visibleItems(items: RssItem[]): RssItem[] {
    const subscriptions = RssPresentationProjection.subscriptions(this.presentation);
    const sourceMatches = new Set<string>(subscriptions.filter((source: RssSubscription): boolean =>
      this.matchesQuery(source.title) || this.matchesQuery(source.sourceGroup ?? '')).map((source: RssSubscription): string => source.subscriptionId));
    return items.filter((item: RssItem): boolean => this.matchesQuery(item.title) || sourceMatches.has(item.subscriptionId));
  }

  private visibleArchivedFavorites(): RssFavorite[] {
    return (this.feedItems.archivedFavorites ?? []).filter((favorite: RssFavorite): boolean =>
      this.matchesQuery(favorite.title) || this.matchesQuery(favorite.subscriptionTitle) || this.matchesQuery(favorite.summary ?? ''));
  }

  @Builder
  private emptyFeedResults(title: string) {
    ReaderPageState({ title, padded: false,
      actionLabel: this.query.trim().length > 0 ? '清除搜索' : '',
      onAction: (): void => { this.query = ''; } });
  }

  @Builder
  private articleModeContent() {
    Scroll() {
      Column({ space: TOK_SPACE_XS }) {
        this.readFeedback();
        if (this.visibleItems(this.activeMode === 'favorites' ? this.feedItems.favorites : this.feedItems.all).length > 0) {
          this.articleList((): RssSubscription[] => RssPresentationProjection.subscriptions(this.presentation),
            (): RssItem[] => this.visibleItems(this.activeMode === 'favorites' ? this.feedItems.favorites : this.feedItems.all));
        }
        if (this.visibleArchivedFavorites().length > 0) {
          this.archivedArticleList((): RssFavorite[] => this.visibleArchivedFavorites());
        } else if (!this.feedBusy() && this.visibleItems(this.activeMode === 'favorites' ? this.feedItems.favorites : this.feedItems.all).length === 0) {
          this.emptyFeedResults(this.query.trim().length > 0 ? '没有匹配的文章' :
            this.activeMode === 'favorites' ? '暂无收藏' : '暂无文章');
        }
      }.width(this.contentFrame().width)
        .padding({ top: this.pageGeometry().content.startInset, bottom: this.pageGeometry().content.endInset });
    }.width('100%').height('100%').align(Alignment.Top)
      .padding({ left: this.contentFrame().left, right: this.contentFrame().right }).scrollBar(BarState.Off);
  }

  @Builder
  private feedScroll(subscriptions: () => RssSubscription[], recentUnread: () => RssItem[], refreshing: boolean) {
    Scroll() {
      Column({ space: TOK_SPACE_XS }) {
        this.readFeedback();
        if (refreshing) {
          this.refreshingRow();
        }
        this.subscriptionSection(subscriptions);
        this.recentUnreadSection(subscriptions, recentUnread);
      }
      .width(this.contentFrame().width)
      .padding({ top: this.pageGeometry().content.startInset, bottom: this.pageGeometry().content.endInset });
    }
    .width('100%')
    .height('100%')
    .align(Alignment.Top)
    .padding({ left: this.contentFrame().left, right: this.contentFrame().right })
    .scrollBar(BarState.Off);
  }

  @Builder
  private refreshingRow() {
    Row({ space: TOK_SPACE_XS }) {
      Text('')
        .width(14)
        .height(14)
        .border({ width: 2, color: readerAppColor('app.feed.refreshBorder', this.appThemeScheme) })
        .borderRadius(7);
      Text('正在刷新启用订阅源')
        .fontFamily(TYPE_RSS_REFRESH_STATUS.fontFamily)
        .fontWeight(TYPE_RSS_REFRESH_STATUS.fontWeight)
        .fontSize(TYPE_RSS_REFRESH_STATUS.fontSizeFp)
        .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme))
        .maxLines(1);
    }
    .width(this.contentFrame().width)
    .constraintSize({ minHeight: 30 })
    .justifyContent(FlexAlign.Center)
    .alignItems(VerticalAlign.Center);
  }

  @Builder
  private subscriptionSection(subscriptions: () => RssSubscription[]) {
    Column({ space: TOK_SPACE_XS }) {
      Row() {
        Text('订阅源')
          .fontFamily(TYPE_RSS_SECTION_HEADING.fontFamily)
          .fontWeight(TYPE_RSS_SECTION_HEADING.fontWeight)
          .fontSize(TYPE_RSS_SECTION_HEADING.fontSizeFp)
          .fontColor(readerAppColor('TOK_INK', this.appThemeScheme))
          .maxLines(1);
      }
      .width('100%')
      .constraintSize({ minHeight: 44 })
      .padding({ left: 11, right: 11 })
      .justifyContent(FlexAlign.SpaceBetween)
      .alignItems(VerticalAlign.Center)
      .backgroundColor(readerAppColor('TOK_CARD_BG_HI', this.appThemeScheme))
      .border({ width: TOK_BORDER_W, color: readerAppColor('app.border.contentCard', this.appThemeScheme) })
      .borderRadius(14);

      Row({ space: 7 }) {
        Image((this.appThemeScheme === 'night' ? $r('app.media.rss_filter_theme_night') : $r('app.media.rss_filter')))
          .width(14)
          .height(14);
        Text('筛选')
          .fontFamily(TYPE_APP_COMPACT_PRIMARY_ACTION.fontFamily)
          .fontWeight(TYPE_APP_COMPACT_PRIMARY_ACTION.fontWeight)
          .fontSize(TYPE_APP_COMPACT_PRIMARY_ACTION.fontSizeFp).lineHeight(18).halfLeading(true)
          .fontColor(readerAppColor('app.text.filter', this.appThemeScheme))
          .maxLines(1);
        Blank();
        Row({ space: 7 }) {
          Text(this.filterValue)
            .fontFamily(TYPE_APP_SMALL_ACTION.fontFamily)
            .fontWeight(TYPE_APP_SMALL_ACTION.fontWeight)
            .fontSize(TYPE_APP_SMALL_ACTION.fontSizeFp).lineHeight(17).halfLeading(true)
            .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme))
            .maxLines(1);
          Image((this.appThemeScheme === 'night' ? $r('app.media.rss_filter_chevron_theme_night') : $r('app.media.rss_filter_chevron')))
            .width(20)
            .height(20)
            .rotate({ angle: this.filterOpen ? 180 : 0 });
        }
        .alignItems(VerticalAlign.Center);
      }
      .width('100%')
      .constraintSize({ minHeight: 34 })
      .padding({ left: 11, right: 11 })
      .alignItems(VerticalAlign.Center)
      .backgroundColor(readerAppColor('TOK_CARD_BG', this.appThemeScheme))
      .border({ width: TOK_BORDER_W, color: readerAppColor('app.border.filter', this.appThemeScheme) })
      .borderRadius(14)
      .responseRegion(readerUnionTouchRegion('100%', 34))
      .onClick((): void => {
        this.filterOpen = !this.filterOpen;
      });

      // 筛选 = 内联展开 (非下拉): 状态胶囊在页面流中展开, 列表被下推。
      if (this.filterOpen) {
        this.filterExpand();
      }

      if (this.filteredSubscriptions(subscriptions()).length === 0 && this.query.trim().length > 0) {
        this.emptyFeedResults('没有匹配的订阅源');
      } else {
      Column() {
        ForEach(this.filteredSubscriptions(subscriptions()), (sub: RssSubscription, index: number): void => {
          this.sourceItem((): RssSubscription => sub, (): number => index);
        }, (sub: RssSubscription): string => `rss-sub-${sub.subscriptionId}`);
      }
      .width('100%')
      .backgroundColor(readerAppColor('TOK_CARD_BG_HI', this.appThemeScheme))
      .border({ width: TOK_BORDER_W, color: readerAppColor('app.border.contentCard', this.appThemeScheme) })
      .borderRadius(14)
      .clip(true);
      }
    }
    .width(this.contentFrame().width);
  }

  // 筛选展开区: 状态胶囊内联排布 (复用 statusTab 选中语言 = 绿底白字), 包换行。
  // 选中后保持展开 (accordion 语义), 再点筛选行收起。
  @Builder
  private filterExpand() {
    Flex({ wrap: FlexWrap.Wrap, justifyContent: FlexAlign.Start, alignItems: ItemAlign.Center }) {
      ForEach(this.filterOptions(), (opt: string) => {
        this.filterPill(opt);
      }, (opt: string): string => `rss-filter-${opt}`);
    }
    .width('100%')
    .padding({ left: 11, right: 11, top: TOK_SPACE_XS, bottom: TOK_SPACE_XS })
    .backgroundColor(readerAppColor('TOK_CARD_BG', this.appThemeScheme))
    .border({ width: TOK_BORDER_W, color: readerAppColor('app.border.contentCard', this.appThemeScheme) })
    .borderRadius(14);
  }

  @Builder
  private filterPill(opt: string) {
    ReaderButton({ scheme: this.appThemeScheme, specId: 'rss-filter', label: opt, primary: this.filterValue === opt,
      onAction: (): void => { this.filterValue = opt; } });
  }

  @Builder
  private sourceItem(sub: () => RssSubscription, index: () => number) {
    Row({ space: TOK_SPACE_XS }) {
      Stack({ alignContent: Alignment.Center }) {
        Image((this.appThemeScheme === 'night' ? $r('app.media.rss_source_theme_night') : $r('app.media.rss_source')))
          .width(20)
          .height(20);
      }
      .width(32)
      .height(32)
      .backgroundColor(readerAppColor('TOK_PRIMARY_BG', this.appThemeScheme))
      .borderRadius(16);

      Column({ space: 3 }) {
        Text(sub().title)
          .width('100%')
          .fontFamily(TYPE_RSS_SOURCE_TITLE.fontFamily)
          .fontWeight(TYPE_RSS_SOURCE_TITLE.fontWeight)
          .fontSize(TYPE_RSS_SOURCE_TITLE.fontSizeFp)
          .fontColor(readerAppColor('TOK_INK', this.appThemeScheme))
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis });
        Text(this.sourceSubtitle(sub()))
          .width('100%')
          .fontFamily(TYPE_RSS_META.fontFamily)
          .fontWeight(TYPE_RSS_META.fontWeight)
          .fontSize(TYPE_RSS_META.fontSizeFp)
          .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme))
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis });
      }
      .layoutWeight(1)
      .alignItems(HorizontalAlign.Start);

      Text(`${sub().unreadCount}`)
        .fontFamily(TYPE_RSS_UNREAD_COUNT.fontFamily)
        .fontWeight(TYPE_RSS_UNREAD_COUNT.fontWeight)
        .fontSize(TYPE_RSS_UNREAD_COUNT.fontSizeFp)
        .fontColor(readerAppColor('TOK_PRIMARY_TEXT', this.appThemeScheme))
        .maxLines(1);

      StatusBadge({
        status: this.sourceBadgeStatus(sub()),
        label: this.sourceBadgeLabel(sub()),
      });
    }
    .width('100%')
    .constraintSize({ minHeight: 62 })
    .padding({ left: TOK_SPACE_CONTROL_INLINE, right: TOK_SPACE_CONTROL_INLINE })
    .alignItems(VerticalAlign.Center)
    .border({ width: { top: index() > 0 ? TOK_BORDER_W : 0 }, color: readerAppColor('TOK_ROW_DIVIDER', this.appThemeScheme) })
    .opacity(this.sourceRowOpacity(sub()))
    .onClick((): void => this.onSelectSubscription(sub().subscriptionId));
  }

  @Builder
  private recentUnreadSection(subscriptions: () => RssSubscription[], recentUnread: () => RssItem[]) {
    Column({ space: 6 }) {
      this.recentUnreadHeader();
      if (this.visibleItems(recentUnread()).length > 0) {
        this.articleList(subscriptions, (): RssItem[] => this.visibleItems(recentUnread()));
      } else if (!this.feedBusy()) {
        this.emptyFeedResults(this.query.trim().length > 0 ? '没有匹配的未读文章' : '暂无未读文章');
      }
    }
    .width(this.contentFrame().width);
  }

  @Builder
  private articleList(subscriptions: () => RssSubscription[], recentUnread: () => RssItem[]) {
      Column() {
        ForEach(recentUnread(), (item: RssItem, index: number): void => {
          this.recentUnreadItem(subscriptions, (): RssItem => item, (): number => index);
        }, (item: RssItem): string =>
          `rss-item-${item.subscriptionId.length}:${item.subscriptionId}-${item.guid.length}:${item.guid}`);
      }
      .width('100%')
      .backgroundColor(readerAppColor('TOK_CARD_BG_HI', this.appThemeScheme))
      .border({ width: TOK_BORDER_W, color: readerAppColor('app.border.contentCard', this.appThemeScheme) })
      .borderRadius(14)
      .clip(true);
  }

  @Builder
  private archivedArticleList(favorites: () => RssFavorite[]) {
    Column() {
      ForEach(favorites(), (favorite: RssFavorite, index: number): void => {
        this.articleRow((): string => favorite.title, (): string => favorite.subscriptionTitle,
          (): string => favorite.summary ?? '', (): boolean => false, (): number => index,
          (): void => this.onSelectItem(favorite.subscriptionId, favorite.guid));
      }, (favorite: RssFavorite): string => JSON.stringify([favorite.subscriptionId, favorite.guid]));
    }.width('100%')
      .backgroundColor(readerAppColor('TOK_CARD_BG_HI', this.appThemeScheme))
      .border({ width: TOK_BORDER_W, color: readerAppColor('app.border.contentCard', this.appThemeScheme) })
      .borderRadius(14)
      .clip(true);
  }

  @Builder
  private recentUnreadHeader() {
    Row() {
      Text('最近未读')
        .layoutWeight(1)
        .fontFamily(TYPE_RSS_SECTION_HEADING.fontFamily)
        .fontWeight(TYPE_RSS_SECTION_HEADING.fontWeight)
        .fontSize(TYPE_RSS_SECTION_HEADING.fontSizeFp)
        .fontColor(readerAppColor('TOK_INK', this.appThemeScheme))
        .maxLines(1);
      ReaderLabeledIconAction({ scheme: this.appThemeScheme, specId: 'rss-view-all', label: '查看全部',
        icon: this.appThemeScheme === 'night' ? $r('app.media.rss_view_all_theme_night') : $r('app.media.rss_view_all'),
        onAction: (): void => this.onModeRequested('all') });
    }
    .width('100%')
    .constraintSize({ minHeight: 30 })
    .padding({ left: 2, right: 2 })
    .alignItems(VerticalAlign.Center);
  }

  @Builder
  private recentUnreadItem(subscriptions: () => RssSubscription[], item: () => RssItem, index: () => number) {
    this.articleRow((): string => item().title, (): string => this.itemSubtitle(subscriptions(), item()),
      (): string => item().description ?? '', (): boolean => !item().read, index,
      (): void => this.onSelectItem(item().subscriptionId, item().guid));
  }

  @Builder
  private articleRow(title: () => string, subtitle: () => string, description: () => string,
    showUnreadMarker: () => boolean, index: () => number, open: () => void) {
    Row({ space: TOK_SPACE_XS }) {
      Text('')
        .width(7)
        .height(7)
        .borderRadius(3.5)
        .backgroundColor(showUnreadMarker() ? readerAppColor('app.action.fill', this.appThemeScheme) : Color.Transparent);

      Column({ space: 3 }) {
        Text(title())
          .width('100%')
          .fontFamily(TYPE_RSS_ENTRY_TITLE.fontFamily)
          .fontWeight(TYPE_RSS_ENTRY_TITLE.fontWeight)
          .fontSize(TYPE_RSS_ENTRY_TITLE.fontSizeFp)
          .lineHeight(TYPE_RSS_ENTRY_TITLE.lineHeightFp as number)
          .fontColor(readerAppColor('TOK_INK', this.appThemeScheme))
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis });
        if (subtitle() !== '') {
          Text(subtitle())
            .width('100%')
            .fontFamily(TYPE_RSS_META.fontFamily)
            .fontWeight(TYPE_RSS_META.fontWeight)
            .fontSize(TYPE_RSS_META.fontSizeFp)
            .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme))
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis });
        }
        if (description().trim().length > 0) {
          Text(description())
            .width('100%')
            .fontFamily(TYPE_RSS_ENTRY_DESCRIPTION.fontFamily)
            .fontWeight(TYPE_RSS_ENTRY_DESCRIPTION.fontWeight)
            .fontSize(TYPE_RSS_ENTRY_DESCRIPTION.fontSizeFp)
            .lineHeight(TYPE_RSS_ENTRY_DESCRIPTION.lineHeightFp as number)
            .fontColor(readerAppColor('app.text.feedMeta', this.appThemeScheme))
            .maxLines(2)
            .textOverflow({ overflow: TextOverflow.Ellipsis });
        }
      }
      .layoutWeight(1)
      .alignItems(HorizontalAlign.Start);

      Image((this.appThemeScheme === 'night' ? $r('app.media.rss_item_chevron_theme_night') : $r('app.media.rss_item_chevron')))
        .width(20)
        .height(20);
    }
    .width('100%')
    .padding({ left: TOK_SPACE_SM, right: TOK_SPACE_SM, top: TOK_SPACE_CONTROL_INLINE, bottom: TOK_SPACE_CONTROL_INLINE })
    .alignItems(VerticalAlign.Top)
    .border({ width: { top: index() > 0 ? TOK_BORDER_W : 0 }, color: readerAppColor('TOK_ROW_DIVIDER', this.appThemeScheme) })
    .onClick((): void => open());
  }

  private onMainTab(key: string): void {
    if (key === 'bookshelf') {
      this.onBack();
    } else if (key === 'discover') {
      this.onDiscoverRequested();
    } else if (key === 'settings') {
      this.onSettingsRequested();
    }
    // 'rss' is this page; MainTabBar suppresses the current tab.
  }

  @Builder
  private emptyUnreadScroll(subscriptions: () => RssSubscription[]) {
    Scroll() {
      Column({ space: TOK_SPACE_XS }) {
        this.readFeedback();
        this.subscriptionSection(subscriptions);
        this.emptyUnreadSection();
      }
      .width(this.contentFrame().width)
      .padding({ top: this.pageGeometry().content.startInset, bottom: this.pageGeometry().content.endInset });
    }
    .width('100%')
    .height('100%')
    .align(Alignment.Top)
    .padding({ left: this.contentFrame().left, right: this.contentFrame().right })
    .scrollBar(BarState.Off);
  }

  @Builder
  private emptyUnreadSection() {
    Column({ space: 6 }) {
      this.recentUnreadHeader();
      this.stateCard(
        (): Resource => (this.appThemeScheme === 'night' ? $r('app.media.rss_empty_theme_night') : $r('app.media.rss_empty')),
        '暂无未读订阅',
        (): string => '当前订阅源没有新的未读条目，可查看全部、管理订阅源或手动刷新。',
        (): RssFailedSource[] => [],
        '查看全部',
        (): void => this.onModeRequested('all'));
    }
    .width(this.contentFrame().width);
  }

  @Builder
  private errorContent() {
    Scroll() {
      Column() {
        this.stateCard(
          (): Resource => (this.appThemeScheme === 'night' ? $r('app.media.rss_error_theme_night') : $r('app.media.rss_error')),
          'RSS 暂时无法载入',
          (): string => '可以重试刷新，或在订阅源管理中检查订阅配置。',
          (): RssFailedSource[] => this.failedSources(),
          '重试刷新',
          (): void => this.onRefresh());
      }
      .width('100%')
      .padding({
        top: this.pageGeometry().content.startInset,
        bottom: this.pageGeometry().content.endInset,
        left: this.contentFrame().left,
        right: this.contentFrame().right,
      });
    }
    .width('100%')
    .height('100%')
    .align(Alignment.Top)
    .scrollBar(BarState.Off);
  }

  private failedSources(): RssFailedSource[] {
    return this.presentation.kind === 'fatalError' ? this.presentation.failedSources : [];
  }

  private bottomContentInset(): number {
    if (this.readerWindowMetricsRevision < 0) return TOK_SPACE_LG;
    const metrics = ReaderWindowCoordinator.metrics();
    return this.isRailActive() ? readerFloatingBarBottomInset(metrics, TOK_SPACE_LG) : readerFloatingTabContentInset(metrics);
  }

  @Builder
  private stateCard(icon: () => Resource, title: string, body: () => string, failedSources: () => RssFailedSource[],
    primaryLabel: string, primaryAction: () => void) {
    Column() {
      Image(icon())
        .width(28)
        .height(28);

      Text(title)
        .margin({ top: TOK_SPACE_MD })
        .fontFamily(TYPE_RSS_STATE_TITLE.fontFamily)
        .fontWeight(TYPE_RSS_STATE_TITLE.fontWeight)
        .fontSize(TYPE_RSS_STATE_TITLE.fontSizeFp)
        .lineHeight(TYPE_RSS_STATE_TITLE.lineHeightFp as number)
        .fontColor(readerAppColor('TOK_INK', this.appThemeScheme))
        .textAlign(TextAlign.Center);

      Text(body())
        .margin({ top: TOK_SPACE_XS })
        .width('100%')
        .constraintSize({ maxWidth: 314 })
        .fontFamily(TYPE_RSS_STATE_BODY.fontFamily)
        .fontWeight(TYPE_RSS_STATE_BODY.fontWeight)
        .fontSize(TYPE_RSS_STATE_BODY.fontSizeFp)
        .lineHeight(TYPE_RSS_STATE_BODY.lineHeightFp as number)
        .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme))
        .textAlign(TextAlign.Center);

      if (failedSources().length > 0) {
        Column({ space: 6 }) {
          ForEach(failedSources(), (source: RssFailedSource) => {
            this.errorSourceRow(source);
          }, (source: RssFailedSource, index: number): string => JSON.stringify([index, source.name, source.reason ?? '']));
        }
        .width('100%')
        .margin({ top: TOK_SPACE_MD });
      }

      this.stateButtons(primaryLabel, primaryAction);
    }
    .width('100%')
    .backgroundColor(readerAppColor('TOK_CARD_BG', this.appThemeScheme))
    .border({ width: TOK_BORDER_W, color: readerAppColor('TOK_LINE_STRONG', this.appThemeScheme) })
    .borderRadius(14)
    .padding({ top: 26, bottom: 26, left: 18, right: 18 })
    .alignItems(HorizontalAlign.Center);
  }

  @Builder
  private errorSourceRow(source: RssFailedSource) {
    Column() {
      Text(source.name)
        .width('100%')
        .fontFamily(TYPE_APP_SEGMENT_LABEL.fontFamily)
        .fontWeight(TYPE_APP_SEGMENT_LABEL.fontWeight)
        .fontSize(TYPE_APP_SEGMENT_LABEL.fontSizeFp)
        .fontColor(readerAppColor('app.feed.errorText', this.appThemeScheme))
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis });
      if (source.reason !== undefined && source.reason !== '') {
        Text(source.reason)
          .margin({ top: 2 })
          .width('100%')
          .fontFamily(TYPE_RSS_ERROR_REASON.fontFamily)
          .fontWeight(TYPE_RSS_ERROR_REASON.fontWeight)
          .fontSize(TYPE_RSS_ERROR_REASON.fontSizeFp)
          .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme))
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis });
      }
    }
    .width('100%')
    .padding({ left: TOK_SPACE_CONTROL_INLINE, right: TOK_SPACE_CONTROL_INLINE, top: TOK_SPACE_XS, bottom: TOK_SPACE_XS })
    .alignItems(HorizontalAlign.Start)
    .backgroundColor(readerAppColor('app.feed.errorSurface', this.appThemeScheme))
    .borderRadius(6);
  }

  @Builder
  private stateButtons(primaryLabel: string, primaryAction: () => void) {
    Row({ space: TOK_SPACE_CONTROL_INLINE }) {
      ReaderButton({ scheme: this.appThemeScheme, specId: 'rss-state', label: primaryLabel, primary: true, onAction: primaryAction });
      ReaderButton({ scheme: this.appThemeScheme, specId: 'rss-state', label: '订阅管理', onAction: (): void => this.onManage() });
    }.margin({ top: 20 }).alignItems(VerticalAlign.Center);
  }

  private refreshStatusText(): string {
    const suffix = this.lastUpdateSuffix();
    return suffix === '' ? this.enabledSourceSummary() : `${this.enabledSourceSummary()} ${suffix}`;
  }

  private enabledSourceSummary(): string {
    if (this.presentation.kind !== 'feed' && this.presentation.kind !== 'refreshing' &&
      this.presentation.kind !== 'emptyUnread') {
      return '';
    }
    const enabled = this.presentation.subscriptions.filter((sub) => sub.enabled).length;
    return `${enabled} 个启用源`;
  }

  private lastUpdateSuffix(): string {
    if (this.presentation.kind !== 'feed' && this.presentation.kind !== 'refreshing' &&
      this.presentation.kind !== 'emptyUnread') {
      return '';
    }
    let latest = 0;
    for (const sub of this.presentation.subscriptions) {
      if (sub.enabled && sub.lastFetchAt !== undefined && sub.lastFetchAt > latest) {
        latest = sub.lastFetchAt;
      }
    }
    if (latest <= 0) {
      return '';
    }
    const d = new Date(latest);
    const hh = d.getHours() < 10 ? `0${d.getHours()}` : `${d.getHours()}`;
    const mm = d.getMinutes() < 10 ? `0${d.getMinutes()}` : `${d.getMinutes()}`;
    return `· ${hh}:${mm} 更新`;
  }

  private pageGeometry(): ReaderPageGeometry {
    const metrics = ReaderWindowCoordinator.metrics();
    const input = new ReaderPageGeometryInput(metrics);
    input.viewportWidth = this.effectiveViewportWidth();
    input.headerHeight = Math.max(RSS_FLOATING_HEADER_HEIGHT, this.measuredHeaderHeight);
    input.contentGap = TOK_SPACE_XS;
    input.contentMaxWidth = TOK_CONTENT_RAIL_W_TABLET;
    input.contentHorizontalPadding = TOK_SCREEN_INSET;
    input.contentLeadingRail = this.isRailActive() ? readerMainRailLeading() : 0;
    input.contentEndInset = this.bottomContentInset();
    return resolveReaderPageGeometry(input);
  }

  private contentFrame(): SurfaceHorizontalFrame {
    if (this.readerWindowMetricsRevision < 0) {
      return new SurfaceHorizontalFrame(0, 0, 0);
    }
    return this.pageGeometry().content.frame;
  }

  private refreshMarqueeWidth(): number {
    const viewportWidth = this.effectiveViewportWidth();
    if (viewportWidth <= 0) {
      return 140;
    }
    return Math.max(72, Math.min(180, viewportWidth - 220));
  }

  private isWideViewport(): boolean {
    return readerIsExpandedWidth(this.effectiveViewportWidth());
  }

  private isRailActive(): boolean {
    return readerMainNavigationMode(this.wideNavigationRail, this.mainViewportRevision, this.readerWindowMetricsRevision) === 'rail';
  }

  private effectiveViewportWidth(): number {
    if (this.readerWindowMetricsRevision < 0) {
      return 0;
    }
    const metricsWidth = ReaderWindowCoordinator.metrics().windowRect.width;
    return this.viewportWidth > 0 ? this.viewportWidth : metricsWidth;
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

  /** Core subscription subtitle: prefer the declared site URL, then the feed URL. */
  private sourceSubtitle(sub: RssSubscription): string {
    if (sub.siteUrl !== undefined && sub.siteUrl !== '') {
      return sub.siteUrl;
    }
    return sub.feedUrl;
  }

  private sourceBadgeStatus(sub: RssSubscription): ReaderStatusBadgeStatus {
    return sub.enabled ? 'enabled' : 'paused';
  }

  private sourceBadgeLabel(sub: RssSubscription): string {
    return sub.enabled ? '订阅已启用' : '订阅已暂停';
  }

  /** Figma 暂停源整行降透明度 62%. */
  private sourceRowOpacity(sub: RssSubscription): number {
    return sub.enabled ? 1 : STATUS_PAUSED_OPACITY;
  }

  /** Only statuses derivable from the current Core subscription DTO. */
  private filterOptions(): string[] {
    return ['全部', '有更新', '暂停'];
  }

  /** No health/auth state is inferred: enabled sources without unread items have no filter status. */
  private subscriptionStatus(sub: RssSubscription): string {
    if (!sub.enabled) {
      return '暂停';
    }
    if (sub.unreadCount > 0) {
      return '有更新';
    }
    return '';
  }

  private filteredSubscriptions(subs: RssSubscription[]): RssSubscription[] {
    return subs.filter((sub: RssSubscription): boolean =>
      (this.filterValue === '全部' || this.subscriptionStatus(sub) === this.filterValue) &&
      (this.matchesQuery(sub.title) || this.matchesQuery(sub.sourceGroup ?? '')));
  }

  /** Source title is a page projection resolved by subscriptionId, not part of the Core item DTO. */
  private itemSubtitle(subscriptions: RssSubscription[], item: RssItem): string {
    const parts: string[] = [];
    const source = subscriptions.find((sub: RssSubscription): boolean =>
      sub.subscriptionId === item.subscriptionId);
    if (source !== undefined) {
      parts.push(source.title);
    }
    if (item.pubDate !== undefined && item.pubDate !== '') {
      parts.push(item.pubDate);
    }
    return parts.join(' · ');
  }
}
