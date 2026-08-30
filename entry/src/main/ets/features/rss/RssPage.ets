import {
  type RssItem,
  type RssSubscription,
} from './RssGateway';
import { ReaderWindowCoordinator } from '../../app/ReaderWindowCoordinator';
import { MainTabShell } from '../shell/MainTabShell';
import { registerReaderFonts } from '../common/ReaderFonts';
import { ReaderSearchField } from '../common/ReaderSearchField';
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
  TOK_BORDER,
  TOK_BORDER_W,
  TOK_CARD_BG,
  TOK_CARD_BG_HI,
  TOK_CONTENT_RAIL_W_TABLET,
  TOK_GREEN,
  TOK_INK,
  TOK_LINE_STRONG,
  TOK_MUTED,
  TOK_ON_PRIMARY,
  TOK_PRIMARY_BG,
  TOK_PRIMARY_DARK,
  TOK_PRIMARY_SOFT,
  TOK_ROW_DIVIDER,
  TOK_SCREEN_INSET,
  TOK_SPACE_CONTROL_INLINE,
  TOK_SPACE_LG,
  TOK_SPACE_MD,
  TOK_SPACE_SM,
  TOK_SPACE_XS,
} from '../common/ReaderTokens';

export interface RssFeedPresentation {
  kind: 'feed';
  subscriptions: RssSubscription[];
  recentUnread: RssItem[];
}

export interface RssRefreshingPresentation {
  kind: 'refreshing';
  subscriptions: RssSubscription[];
  recentUnread: RssItem[];
}

export interface RssEmptyUnreadPresentation {
  kind: 'emptyUnread';
  subscriptions: RssSubscription[];
}

export interface RssFailedSource {
  name: string;
  reason?: string;
}

export interface RssFatalErrorPresentation {
  kind: 'fatalError';
  failedSources: RssFailedSource[];
}

/** Main-page content modes. These are component/content changes, never routes. */
export type RssMode = 'sources' | 'all' | 'favorites' | 'rules';

export type RssPresentation =
  | RssFeedPresentation
  | RssRefreshingPresentation
  | RssEmptyUnreadPresentation
  | RssFatalErrorPresentation;

// Figma tokens (AARRGGBB)
const MUTED_DEEP = '#6F655D';
const FILTER_TEXT = '#3F372F';

// rgba(255,252,248,0.92)  cards
// rgba(255,252,248,0.90)  filter bar / state card
// rgba(255,252,248,0.86)  top-bar pills
const PILL_BG = '#DBFFFCF8';
// rgba(238,232,223,0.84)  inactive tabs / import-new pills
const SOFT_PILL_BG = '#D6EEE8DF';
// rgba(45,74,62,0.1)      view-all pill
const VIEW_ALL_BG = '#172D4A3E';    // rgba(45,74,62,0.09) 设计稿
// rgba(45,74,62,0.12)     source icon chip
// rgba(54,121,91,0.12)    enabled source status
const STATUS_ENABLED_BG = '#1F36795B';
// rgba(127,118,108,0.12)  disabled source status
const STATUS_DISABLED_BG = '#1F7F766C';
// Figma 暂停源整行降透明度 62%
const STATUS_PAUSED_OPACITY = 0.62;
// rgba(214,34,34,0.08)    error source card
const ERROR_CARD_BG = '#14D62222';
const RSS_WIDE_BREAKPOINT = 600;
const RSS_TABLET_RAIL_WIDTH = 100;

// borders
const CARD_BORDER = '#4DB4A697';       // rgba(180,166,151,0.3)
const FILTER_BORDER = '#7AB4A697';     // rgba(180,166,151,0.48)
const PILL_BORDER = '#6BB4A697';       // rgba(180,166,151,0.42)

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
  @StorageLink('readerWindowMetricsRevision') private readerWindowMetricsRevision: number = 0;
  @Prop presentation: RssPresentation;
  @Prop isTablet: boolean;
  @Prop activeMode: RssMode = 'sources';
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
  @State private viewportWidth: number = 0;

  aboutToAppear(): void {
    registerReaderFonts(this.getUIContext().getFont());
  }

  build() {
    MainTabShell({
      activeTab: 'rss',
      showBottomNav: !this.isWideViewport(),
      showTabletRail: this.isWideViewport(),
      onMainTab: (key: string): void => this.onMainTab(key),
    }) {
      Row() {
        if (this.isWideViewport()) {
          Blank().width(RSS_TABLET_RAIL_WIDTH);
        }

        Column() {
          this.topBar();
          this.searchBar();
          this.statusTabs();
          if (this.presentation.kind === 'feed') {
            this.feedScroll(this.presentation.subscriptions, this.presentation.recentUnread, false);
          } else if (this.presentation.kind === 'refreshing') {
            this.feedScroll(this.presentation.subscriptions, this.presentation.recentUnread, true);
          } else if (this.presentation.kind === 'emptyUnread') {
            this.emptyUnreadScroll(this.presentation.subscriptions);
          } else {
            this.errorContent(this.presentation.failedSources);
          }
        }
        .layoutWeight(1)
        .height('100%')
        .alignItems(HorizontalAlign.Start);
      }
      .width('100%')
      .height('100%')
      .onAreaChange((_oldValue: Area, newValue: Area): void => {
        const width = this.numericAreaLength(newValue.width);
        if (width > 0 && Math.abs(width - this.viewportWidth) >= 0.01) {
          this.viewportWidth = width;
        }
      });
    }
  }

  // 页私有 (不用 AppTopBar): Figma 2305:29 容器 justify-end → 刷新/管理胶囊簇靠右,
  // RSS 标题左 20vp。SpaceBetween 复现 justify-end (管理右缘 = 栏宽 - 20vp 内缩)。
  @Builder
  private topBar() {
    Row() {
      Text('RSS')
        .fontFamily('ReaderNotoSerifSCBold')
        .fontWeight(FontWeight.Bold)
        .fontSize(29)
        .lineHeight(41)
        .fontColor(TOK_PRIMARY_DARK)
        .maxLines(1)
        .margin({ left: 20 });

      Row({ space: 6 }) {
        this.refreshPill();
        this.managePill();
      }
      .margin({ left: TOK_SPACE_CONTROL_INLINE })
      .alignItems(VerticalAlign.Center);
    }
    .width('100%')
    .height(58)
    .justifyContent(FlexAlign.SpaceBetween)
    .padding({ right: 20 })
    .alignItems(VerticalAlign.Center);
  }

  @Builder
  private refreshPill() {
    Row({ space: 7 }) {
      Text('')
        .width(9)
        .height(9)
        .borderRadius(4.5)
        .backgroundColor(TOK_GREEN);
      if (this.isWideViewport()) {
        Text(this.refreshStatusText())
          .fontFamily('ReaderInter')
          .fontWeight(900)
          .fontSize(12)
          .fontColor(TOK_PRIMARY_DARK)
          .maxLines(1);
      } else {
        Marquee({
          start: true,
          step: 4,
          loop: -1,
          fromStart: true,
          src: this.refreshStatusText(),
        })
          .width(132.5625)
          .constraintSize({ maxWidth: this.refreshMarqueeWidth() })
          .fontFamily('ReaderInter')
          .fontWeight(900)
          .fontSize(12)
          .fontColor(TOK_PRIMARY_DARK);
      }
      Image($r('app.media.rss_refresh'))
        .width(18)
        .height(18);
    }
    .height(34)
    .padding({ left: 11, right: 9 })
    .alignItems(VerticalAlign.Center)
    .backgroundColor(PILL_BG)
    .border({ width: TOK_BORDER_W, color: PILL_BORDER })
    .borderRadius(999)
    .responseRegion({ x: 0, y: -5, width: '100%', height: 44 })
    .onClick((): void => this.onRefresh());
  }

  @Builder
  private managePill() {
    Row({ space: 5 }) {
      Image($r('app.media.rss_manage'))
        .width(16)
        .height(16);
      Text('管理')
        .fontFamily('ReaderInter')
        .fontWeight(900)
        .fontSize(12)
        .fontColor(TOK_PRIMARY_DARK)
        .maxLines(1);
    }
    .width(64)
    .height(34)
    .justifyContent(FlexAlign.Center)
    .alignItems(VerticalAlign.Center)
    .backgroundColor(PILL_BG)
    .border({ width: TOK_BORDER_W, color: PILL_BORDER })
    .borderRadius(12)
    .responseRegion({ x: 0, y: -5, width: '100%', height: 44 })
    .onClick((): void => this.onManage());
  }

  @Builder
  private searchBar() {
    Row() {
      ReaderSearchField({
        variant: 'rssPassive',
        mode: 'passive',
        placeholder: '搜索订阅源、文章标题或分组',
        accessibilityLabel: '搜索订阅源、文章标题或分组',
      });
    }
    .width(this.contentFrame().width)
    .height(44)
    .alignItems(VerticalAlign.Center)
    .margin({ top: TOK_SPACE_XS, left: this.contentFrame().left });
  }

  @Builder
  private statusTabs() {
    Row({ space: 6 }) {
      this.statusTab('源列表', 'sources');
      this.statusTab('全部', 'all');
      this.statusTab('收藏', 'favorites');
      this.statusTab('规则订阅', 'rules');
    }
    .width(this.contentFrame().width)
    .height(30)
    .alignItems(VerticalAlign.Center)
    .margin({ top: TOK_SPACE_XS, left: this.contentFrame().left });
  }

  @Builder
  private statusTab(label: string, mode: RssMode) {
    Stack({ alignContent: Alignment.Center }) {
      Text(label)
        .fontFamily('ReaderInter')
        .fontWeight(900)
        .fontSize(12)
        .fontColor(this.activeMode === mode ? TOK_ON_PRIMARY : '#564D44')
        .textAlign(TextAlign.Center)
        .maxLines(1);
    }
    .height(30)
    .padding({ left: TOK_SPACE_CONTROL_INLINE, right: TOK_SPACE_CONTROL_INLINE })
    .backgroundColor(this.activeMode === mode ? TOK_GREEN : SOFT_PILL_BG)
    .borderRadius(999)
    .responseRegion({ x: 0, y: -7, width: '100%', height: 44 })
    .onClick((): void => this.onModeRequested(mode));
  }

  @Builder
  private feedScroll(subscriptions: RssSubscription[], recentUnread: RssItem[], refreshing: boolean) {
    Scroll() {
      Column({ space: TOK_SPACE_XS }) {
        if (refreshing) {
          this.refreshingRow();
        }
        this.subscriptionSection(subscriptions);
        this.recentUnreadSection(subscriptions, recentUnread);
      }
      .width(this.contentFrame().width)
      .padding({ top: TOK_SPACE_XS, bottom: TOK_SPACE_LG });
    }
    .width('100%')
    .layoutWeight(1)
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
        .border({ width: 2, color: '#2E2D4A3E' })
        .borderRadius(7);
      Text('正在刷新启用订阅源')
        .fontFamily('ReaderInter')
        .fontWeight(800)
        .fontSize(12)
        .fontColor(TOK_MUTED)
        .maxLines(1);
    }
    .width(this.contentFrame().width)
    .height(30)
    .justifyContent(FlexAlign.Center)
    .alignItems(VerticalAlign.Center);
  }

  @Builder
  private subscriptionSection(subscriptions: RssSubscription[]) {
    Column({ space: TOK_SPACE_XS }) {
      Row() {
        Text('订阅源')
          .fontFamily('ReaderInter')
          .fontWeight(FontWeight.Bold)
          .fontSize(15)
          .fontColor(TOK_INK)
          .maxLines(1);
      }
      .width('100%')
      .height(44)
      .padding({ left: 11, right: 11 })
      .justifyContent(FlexAlign.SpaceBetween)
      .alignItems(VerticalAlign.Center)
      .backgroundColor(TOK_CARD_BG_HI)
      .border({ width: TOK_BORDER_W, color: CARD_BORDER })
      .borderRadius(8);

      Row({ space: 7 }) {
        Image($r('app.media.rss_filter'))
          .width(20)
          .height(20);
        Text('筛选')
          .fontFamily('ReaderInter')
          .fontWeight(900)
          .fontSize(12)
          .fontColor(FILTER_TEXT)
          .maxLines(1);
        Blank();
        Row({ space: 7 }) {
          Text(this.filterValue)
            .fontFamily('ReaderInter')
            .fontWeight(800)
            .fontSize(11)
            .fontColor(TOK_MUTED)
            .maxLines(1);
          Image($r('app.media.rss_filter_chevron'))
            .width(20)
            .height(20)
            .rotate({ angle: this.filterOpen ? 180 : 0 });
        }
        .alignItems(VerticalAlign.Center);
      }
      .width('100%')
      .height(34)
      .padding({ left: 11, right: 11 })
      .alignItems(VerticalAlign.Center)
      .backgroundColor(TOK_CARD_BG)
      .border({ width: TOK_BORDER_W, color: FILTER_BORDER })
      .borderRadius(8)
      .responseRegion({ x: 0, y: -5, width: '100%', height: 44 })
      .onClick((): void => {
        this.filterOpen = !this.filterOpen;
      });

      // 筛选 = 内联展开 (非下拉): 状态胶囊在页面流中展开, 列表被下推。
      if (this.filterOpen) {
        this.filterExpand();
      }

      List() {
        Repeat(this.filteredSubscriptions(subscriptions))
          .each((repeatItem: RepeatItem<RssSubscription>) => {
          ListItem() {
            this.sourceItem(repeatItem.item, repeatItem.index);
          }
        })
        .key((sub: RssSubscription): string => `rss-sub-${sub.subscriptionId}`)
        .virtualScroll({ reusable: true });
      }
      .width('100%')
      .height(Math.min(420, Math.max(62, this.filteredSubscriptions(subscriptions).length * 62)))
      .scrollBar(BarState.Off)
      .backgroundColor(TOK_CARD_BG_HI)
      .border({ width: TOK_BORDER_W, color: CARD_BORDER })
      .borderRadius(8);
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
    .backgroundColor(TOK_CARD_BG)
    .border({ width: TOK_BORDER_W, color: CARD_BORDER })
    .borderRadius(8);
  }

  @Builder
  private filterPill(opt: string) {
    Stack({ alignContent: Alignment.Center }) {
      Text(opt)
        .fontFamily('ReaderInter')
        .fontWeight(900)
        .fontSize(12)
        .fontColor(this.filterValue === opt ? TOK_ON_PRIMARY : '#564D44')
        .textAlign(TextAlign.Center)
        .maxLines(1);
    }
    .height(30)
    .padding({ left: TOK_SPACE_CONTROL_INLINE, right: TOK_SPACE_CONTROL_INLINE })
    .backgroundColor(this.filterValue === opt ? TOK_GREEN : SOFT_PILL_BG)
    .borderRadius(999)
    .margin({ right: 6, bottom: 6 })
    .onClick((): void => {
      this.filterValue = opt;
    });
  }

  @Builder
  private sourceItem(sub: RssSubscription, index: number) {
    Row({ space: TOK_SPACE_XS }) {
      Stack({ alignContent: Alignment.Center }) {
        Image($r('app.media.rss_source'))
          .width(20)
          .height(20);
      }
      .width(32)
      .height(32)
      .backgroundColor(TOK_PRIMARY_BG)
      .borderRadius(16);

      Column({ space: 3 }) {
        Text(sub.title)
          .width('100%')
          .fontFamily('ReaderInter')
          .fontWeight(FontWeight.Bold)
          .fontSize(13)
          .fontColor(TOK_INK)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis });
        Text(this.sourceSubtitle(sub))
          .width('100%')
          .fontFamily('ReaderInter')
          .fontWeight(FontWeight.Regular)
          .fontSize(10)
          .fontColor(TOK_MUTED)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis });
      }
      .layoutWeight(1)
      .alignItems(HorizontalAlign.Start);

      Text(`${sub.unreadCount}`)
        .fontFamily('ReaderInter')
        .fontWeight(900)
        .fontSize(16)
        .fontColor(TOK_PRIMARY_DARK)
        .maxLines(1);

      StatusBadge({
        bg: this.sourceBadgeBg(sub),
        dot: this.sourceBadgeDot(sub),
        radius: 999,
      });
    }
    .width('100%')
    .height(62)
    .padding({ left: TOK_SPACE_CONTROL_INLINE, right: TOK_SPACE_CONTROL_INLINE })
    .alignItems(VerticalAlign.Center)
    .border({ width: { top: index > 0 ? TOK_BORDER_W : 0 }, color: TOK_ROW_DIVIDER })
    .opacity(this.sourceRowOpacity(sub))
    .onClick((): void => this.onSelectSubscription(sub.subscriptionId));
  }

  @Builder
  private recentUnreadSection(subscriptions: RssSubscription[], recentUnread: RssItem[]) {
    Column({ space: 6 }) {
      this.recentUnreadHeader();

      List() {
        Repeat(recentUnread)
          .each((repeatItem: RepeatItem<RssItem>) => {
          ListItem() {
            this.recentUnreadItem(subscriptions, repeatItem.item, repeatItem.index);
          }
        })
        .key((item: RssItem): string =>
          `rss-item-${item.subscriptionId.length}:${item.subscriptionId}-${item.guid.length}:${item.guid}`)
        .virtualScroll({ reusable: true });
      }
      .width('100%')
      .height(Math.min(420, Math.max(72, recentUnread.length * 72)))
      .scrollBar(BarState.Off)
      .backgroundColor(TOK_CARD_BG_HI)
      .border({ width: TOK_BORDER_W, color: CARD_BORDER })
      .borderRadius(8);
    }
    .width(this.contentFrame().width);
  }

  @Builder
  private recentUnreadHeader() {
    Row() {
      Text('最近未读')
        .layoutWeight(1)
        .fontFamily('ReaderInter')
        .fontWeight(FontWeight.Bold)
        .fontSize(15)
        .fontColor(TOK_INK)
        .maxLines(1);
      Row({ space: 5 }) {
        Image($r('app.media.rss_view_all'))
          .width(20)
          .height(20);
        Text('查看全部')
          .fontFamily('ReaderInter')
          .fontWeight(900)
          .fontSize(11)
          .fontColor(TOK_PRIMARY_DARK)
          .maxLines(1);
      }
      .height(28)
      .padding({ left: TOK_SPACE_XS, right: TOK_SPACE_XS })
      .alignItems(VerticalAlign.Center)
      .backgroundColor(VIEW_ALL_BG)
      .borderRadius(999)
      .responseRegion({ x: 0, y: -8, width: '100%', height: 44 })
      .onClick((): void => this.onModeRequested('all'));
    }
    .width('100%')
    .height(30)
    .padding({ left: 2, right: 2 })
    .alignItems(VerticalAlign.Center);
  }

  @Builder
  private recentUnreadItem(subscriptions: RssSubscription[], item: RssItem, index: number) {
    Row({ space: TOK_SPACE_XS }) {
      Text('')
        .width(7)
        .height(7)
        .borderRadius(3.5)
        .backgroundColor(TOK_GREEN);

      Column({ space: 3 }) {
        Text(item.title)
          .width('100%')
          .fontFamily('ReaderInter')
          .fontWeight(FontWeight.Bold)
          .fontSize(13)
          .lineHeight(16.25)
          .fontColor(TOK_INK)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis });
        if (this.itemSubtitle(subscriptions, item) !== '') {
          Text(this.itemSubtitle(subscriptions, item))
            .width('100%')
            .fontFamily('ReaderInter')
            .fontWeight(FontWeight.Regular)
            .fontSize(10)
            .fontColor(TOK_MUTED)
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis });
        }
        if (item.description !== undefined && item.description.trim().length > 0) {
          Text(item.description)
            .width('100%')
            .fontFamily('ReaderInter')
            .fontWeight(FontWeight.Regular)
            .fontSize(11)
            .lineHeight(15.95)
            .fontColor(MUTED_DEEP)
            .maxLines(2)
            .textOverflow({ overflow: TextOverflow.Ellipsis });
        }
      }
      .layoutWeight(1)
      .alignItems(HorizontalAlign.Start);

      Image($r('app.media.rss_item_chevron'))
        .width(20)
        .height(20);
    }
    .width('100%')
    .padding({ left: TOK_SPACE_SM, right: TOK_SPACE_SM, top: TOK_SPACE_CONTROL_INLINE, bottom: TOK_SPACE_CONTROL_INLINE })
    .alignItems(VerticalAlign.Top)
    .border({ width: { top: index > 0 ? TOK_BORDER_W : 0 }, color: TOK_ROW_DIVIDER })
    .onClick((): void => this.onSelectItem(item.subscriptionId, item.guid));
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
  private emptyUnreadScroll(subscriptions: RssSubscription[]) {
    Scroll() {
      Column({ space: TOK_SPACE_XS }) {
        this.subscriptionSection(subscriptions);
        this.emptyUnreadSection();
      }
      .width(this.contentFrame().width)
      .padding({ top: TOK_SPACE_XS, bottom: TOK_SPACE_LG });
    }
    .width('100%')
    .layoutWeight(1)
    .align(Alignment.Top)
    .padding({ left: this.contentFrame().left, right: this.contentFrame().right })
    .scrollBar(BarState.Off);
  }

  @Builder
  private emptyUnreadSection() {
    Column({ space: 6 }) {
      this.recentUnreadHeader();
      this.stateCard(
        $r('app.media.rss_empty'),
        '暂无未读订阅',
        '当前订阅源没有新的未读条目。你可以查看全部、管理订阅源或手动刷新。日常空状态仍保留 RSS 主导航上下文。',
        [],
        '查看全部',
        (): void => this.onModeRequested('all'));
    }
    .width(this.contentFrame().width);
  }

  @Builder
  private errorContent(failedSources: RssFailedSource[]) {
    Column() {
      this.stateCard(
        $r('app.media.rss_error'),
        'RSS 暂时无法载入',
        `${failedSources.length} 个订阅源无法载入。可以稍后重试，或进入订阅源管理修复登录态和规则。`,
        failedSources,
        '重试刷新',
        (): void => this.onRefresh());
    }
    .width('100%')
    .layoutWeight(1)
    .padding({
      top: TOK_SPACE_XS,
      left: this.contentFrame().left,
      right: this.contentFrame().right,
    });
  }

  @Builder
  private stateCard(icon: Resource, title: string, body: string, failedSources: RssFailedSource[],
    primaryLabel: string, primaryAction: () => void) {
    Column() {
      Image(icon)
        .width(28)
        .height(28);

      Text(title)
        .margin({ top: TOK_SPACE_MD })
        .fontFamily('ReaderInter')
        .fontWeight(FontWeight.Bold)
        .fontSize(17)
        .lineHeight(21.25)
        .fontColor(TOK_INK)
        .textAlign(TextAlign.Center);

      Text(body)
        .margin({ top: TOK_SPACE_XS })
        .width('100%')
        .constraintSize({ maxWidth: 314 })
        .fontFamily('ReaderInter')
        .fontWeight(FontWeight.Regular)
        .fontSize(12)
        .lineHeight(18.6)
        .fontColor(TOK_MUTED)
        .textAlign(TextAlign.Center);

      if (failedSources.length > 0) {
        Column({ space: 6 }) {
          ForEach(failedSources, (source: RssFailedSource) => {
            this.errorSourceRow(source);
          }, (source: RssFailedSource): string => `rss-fail-${source.name}`);
        }
        .width('100%')
        .margin({ top: TOK_SPACE_MD });
      }

      this.stateButtons(primaryLabel, primaryAction);
    }
    .width('100%')
    .backgroundColor(TOK_CARD_BG)
    .border({ width: TOK_BORDER_W, color: TOK_LINE_STRONG })
    .borderRadius(8)
    .padding({ top: 26, bottom: 26, left: 18, right: 18 })
    .alignItems(HorizontalAlign.Center);
  }

  @Builder
  private errorSourceRow(source: RssFailedSource) {
    Column() {
      Text(source.name)
        .width('100%')
        .fontFamily('ReaderInter')
        .fontWeight(FontWeight.Bold)
        .fontSize(12)
        .fontColor('#7D2F2B')
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis });
      if (source.reason !== undefined && source.reason !== '') {
        Text(source.reason)
          .margin({ top: 2 })
          .width('100%')
          .fontFamily('ReaderInter')
          .fontWeight(FontWeight.Regular)
          .fontSize(11)
          .fontColor(TOK_MUTED)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis });
      }
    }
    .width('100%')
    .padding({ left: TOK_SPACE_CONTROL_INLINE, right: TOK_SPACE_CONTROL_INLINE, top: TOK_SPACE_XS, bottom: TOK_SPACE_XS })
    .alignItems(HorizontalAlign.Start)
    .backgroundColor(ERROR_CARD_BG)
    .borderRadius(6);
  }

  @Builder
  private stateButtons(primaryLabel: string, primaryAction: () => void) {
    Row({ space: TOK_SPACE_CONTROL_INLINE }) {
      Stack({ alignContent: Alignment.Center }) {
        Text(primaryLabel)
          .fontFamily('ReaderInter')
          .fontWeight(800)
          .fontSize(13)
          .fontColor(TOK_ON_PRIMARY)
          .maxLines(1);
      }
      .width(88)
      .height(36)
      .backgroundColor(TOK_GREEN)
      .borderRadius(999)
      .responseRegion({ x: 0, y: -4, width: '100%', height: 44 })
      .onClick((): void => primaryAction());

      Stack({ alignContent: Alignment.Center }) {
        Text('订阅管理')
          .fontFamily('ReaderInter')
          .fontWeight(800)
          .fontSize(13)
          .fontColor(TOK_PRIMARY_DARK)
          .maxLines(1);
      }
      .width(88)
      .height(36)
      .backgroundColor(TOK_PRIMARY_SOFT)
      .borderRadius(999)
      .responseRegion({ x: 0, y: -4, width: '100%', height: 44 })
      .onClick((): void => this.onManage());
    }
    .margin({ top: 20 })
    .alignItems(VerticalAlign.Center);
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

  private contentFrame(): SurfaceHorizontalFrame {
    if (this.readerWindowMetricsRevision < 0) {
      return new SurfaceHorizontalFrame(0, 0, 0);
    }
    const metrics = ReaderWindowCoordinator.metrics();
    const railWidth = this.isWideViewport() ? RSS_TABLET_RAIL_WIDTH : 0;
    const containerWidth = Math.max(0, this.effectiveViewportWidth() - railWidth);
    const safeLeft = Math.max(0, readerVisualSafeLeft(metrics) - railWidth);
    return resolveHorizontalFrame(
      containerWidth,
      safeLeft,
      readerVisualSafeRight(metrics),
      new SurfaceWidthSpec(TOK_CONTENT_RAIL_W_TABLET, TOK_SCREEN_INSET, TOK_SCREEN_INSET),
    );
  }

  private refreshMarqueeWidth(): number {
    const viewportWidth = this.effectiveViewportWidth();
    if (viewportWidth <= 0) {
      return 132.5625;
    }
    // Figma's 390vp top bar has a 132.5625vp status slot. Keep a conservative
    // 240vp budget for the title, controls, gaps and 20vp edges; only the
    // scrolling status slot contracts on narrower physical viewports.
    return Math.max(0, Math.min(132.5625, viewportWidth - 240));
  }

  private isWideViewport(): boolean {
    return this.effectiveViewportWidth() >= RSS_WIDE_BREAKPOINT;
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

  private sourceBadgeBg(sub: RssSubscription): string {
    if (!sub.enabled) {
      return STATUS_DISABLED_BG;
    }
    return STATUS_ENABLED_BG;
  }

  private sourceBadgeDot(sub: RssSubscription): string {
    if (!sub.enabled) {
      return TOK_MUTED;
    }
    return '#2F6B52';
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
    if (this.filterValue === '全部') {
      return subs;
    }
    return subs.filter((sub: RssSubscription): boolean =>
      this.subscriptionStatus(sub) === this.filterValue);
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
