import {
  type RssItem,
  type RssSubscription,
} from './RssGateway';
import { MainTabShell } from '../shell/MainTabShell';
import { registerReaderFonts } from '../common/ReaderFonts';
import { PageBackBar } from '../common/PageBackBar';
import { ReaderSelect } from '../common/ReaderSelect';
import { StatusBadge } from '../common/StatusBadge';
import {
  TOK_BORDER,
  TOK_BORDER_W,
  TOK_CARD_BG,
  TOK_CARD_BG_HI,
  TOK_CONTENT_MAX_W_PHONE,
  TOK_CONTENT_RAIL_W_TABLET,
  TOK_GREEN,
  TOK_INK,
  TOK_LINE_STRONG,
  TOK_MUTED,
  TOK_ON_PRIMARY,
  TOK_PAPER,
  TOK_PRIMARY_BG,
  TOK_PRIMARY_DARK,
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

export interface RssEmptyPresentation {
  kind: 'empty';
}

export interface RssErrorPresentation {
  kind: 'error';
  failedSources: string[];
}

export type RssPresentation =
  | RssFeedPresentation
  | RssRefreshingPresentation
  | RssEmptyPresentation
  | RssErrorPresentation;

// Figma tokens (AARRGGBB)
const MUTED_DEEP = '#6F655D';
const SEARCH_HINT = '#817A72';
const PILL_TEXT = '#554C43';
const FILTER_TEXT = '#3F372F';

// rgba(255,252,248,0.92)  cards
// rgba(255,252,248,0.90)  filter bar / state card
// rgba(255,252,248,0.86)  top-bar pills
const PILL_BG = '#DBFFFCF8';
// rgba(238,232,223,0.84)  inactive tabs / import-new pills
const SOFT_PILL_BG = '#D6EEE8DF';
// rgba(255,255,255,0.58)  search field
const SEARCH_BG = '#94FFFFFF';
// rgba(45,74,62,0.1)      view-all pill
const VIEW_ALL_BG = '#1A2D4A3E';
// rgba(45,74,62,0.12)     source icon chip
// rgba(54,121,91,0.12)    enabled source status
const STATUS_ENABLED_BG = '#1F36795B';
// rgba(127,118,108,0.12)  disabled source status
const STATUS_DISABLED_BG = '#1F7F766C';
// rgba(214,34,34,0.08)    error source card
const ERROR_CARD_BG = '#14D62222';

// borders
const CARD_BORDER = '#4DB4A697';       // rgba(180,166,151,0.3)
const FILTER_BORDER = '#7AB4A697';     // rgba(180,166,151,0.48)
const PILL_BORDER = '#6BB4A697';       // rgba(180,166,151,0.42)

/**
 * Figma-backed RSS page for `10 · Reference · RSS` `F2 · Canonical · RSS`:
 * CanonicalContent `2305:267`(Phone)/`2305:529`(Tablet), CanonicalState
 * Refreshing `2305:738`, Empty `2305:789`, Error `2305:849`.
 *
 * Presentation component: consumes characterized state and emits intents; it
 * never creates a Core runtime or parses Core protocol.
 */
@Component
export struct RssPage {
  @Prop presentation: RssPresentation;
  @Prop isTablet: boolean;
  onBack: () => void = (): void => {};
  onRefresh: () => void = (): void => {};
  onManage: () => void = (): void => {};
  onSelectSubscription: (id: string) => void = (_id: string): void => {};
  onSelectItem: (guid: string) => void = (_guid: string): void => {};
  onSettingsRequested: () => void = (): void => {};
  onDiscoverRequested: () => void = (): void => {};
  @State private filterValue: string = '全部';
  @State private filterOpen: boolean = false;

  aboutToAppear(): void {
    registerReaderFonts(this.getUIContext().getFont());
  }

  build() {
    if (this.presentation.kind === 'feed') {
      MainTabShell({
        activeTab: 'rss',
        onMainTab: (key: string): void => this.onMainTab(key),
      }) {
        this.feedTabContent(this.presentation.subscriptions, this.presentation.recentUnread);
      }
    } else if (this.presentation.kind === 'refreshing') {
      Column() {
        this.backBar('刷新订阅');
        this.searchBar();
        this.statusTabs();
        this.feedScroll(this.presentation.subscriptions, this.presentation.recentUnread, true);
      }
      .width('100%')
      .height('100%')
      .backgroundColor(TOK_PAPER);
    } else if (this.presentation.kind === 'empty') {
      Column() {
        this.backBar('RSS 空状态');
        this.emptyContent();
      }
      .width('100%')
      .height('100%')
      .backgroundColor(TOK_PAPER);
    } else {
      Column() {
        this.backBar('RSS 错误');
        this.errorContent(this.presentation.failedSources);
      }
      .width('100%')
      .height('100%')
      .backgroundColor(TOK_PAPER);
    }
  }

  @Builder
  private feedTabContent(subscriptions: RssSubscription[], recentUnread: RssItem[]) {
    Column() {
      this.topBar();
      this.searchBar();
      this.statusTabs();
      this.feedScroll(subscriptions, recentUnread, false);
    }
    .width('100%')
    .height('100%');
  }

  @Builder
  private backBar(title: string) {
    PageBackBar({ title: title, onBack: (): void => this.onBack() });
  }

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
      Text(this.enabledSourceSummary())
        .fontFamily('ReaderInter')
        .fontWeight(900)
        .fontSize(12)
        .fontColor(TOK_PRIMARY_DARK)
        .maxLines(1);
      if (this.lastUpdateSuffix() !== '') {
        Text(this.lastUpdateSuffix())
          .fontFamily('ReaderInter')
          .fontWeight(900)
          .fontSize(12)
          .fontColor(TOK_PRIMARY_DARK)
          .maxLines(1);
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
    .onClick((): void => this.onManage());
  }

  @Builder
  private searchBar() {
    Row({ space: TOK_SPACE_CONTROL_INLINE }) {
      Image($r('app.media.search_mag'))
        .width(20)
        .height(20);
      Text('搜索订阅源、文章标题或分组')
        .layoutWeight(1)
        .fontFamily('ReaderInter')
        .fontWeight(FontWeight.Regular)
        .fontSize(14)
        .fontColor(SEARCH_HINT)
        .maxLines(1);
    }
    .width(this.contentWidth())
    .height(44)
    .padding({ left: 15, right: 15 })
    .backgroundColor(SEARCH_BG)
    .border({ width: TOK_BORDER_W, color: TOK_BORDER })
    .borderRadius(999)
    .alignItems(VerticalAlign.Center)
    .margin({ top: TOK_SPACE_XS, left: TOK_SCREEN_INSET });
  }

  @Builder
  private statusTabs() {
    Row({ space: 6 }) {
      this.statusTab('源列表', true);
      this.statusTab('全部', false);
      this.statusTab('收藏', false);
      this.statusTab('规则订阅', false);
    }
    .width(this.contentWidth())
    .height(30)
    .alignItems(VerticalAlign.Center)
    .margin({ top: TOK_SPACE_XS, left: TOK_SCREEN_INSET });
  }

  @Builder
  private statusTab(label: string, active: boolean) {
    Stack({ alignContent: Alignment.Center }) {
      Text(label)
        .fontFamily('ReaderInter')
        .fontWeight(900)
        .fontSize(12)
        .fontColor(active ? '#FFFFFF' : '#564D44')
        .textAlign(TextAlign.Center)
        .maxLines(1);
    }
    .height(30)
    .padding({ left: TOK_SPACE_CONTROL_INLINE, right: TOK_SPACE_CONTROL_INLINE })
    .backgroundColor(active ? TOK_GREEN : SOFT_PILL_BG)
    .borderRadius(999);
  }

  @Builder
  private feedScroll(subscriptions: RssSubscription[], recentUnread: RssItem[], refreshing: boolean) {
    Scroll() {
      Column({ space: TOK_SPACE_XS }) {
        if (refreshing) {
          this.refreshingRow();
        }
        this.subscriptionSection(subscriptions);
        this.recentUnreadSection(recentUnread);
      }
      .width('100%')
      .padding({ top: TOK_SPACE_XS, bottom: TOK_SPACE_LG })
      .alignItems(HorizontalAlign.Center);
    }
    .width('100%')
    .layoutWeight(1)
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
      Text('正在刷新启用订阅源和分类入口')
        .fontFamily('ReaderInter')
        .fontWeight(800)
        .fontSize(12)
        .fontColor(TOK_MUTED)
        .maxLines(1);
    }
    .width(this.contentWidth())
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
        Row({ space: 6 }) {
          this.actionPill('导入', $r('app.media.import_document'));
          this.actionPill('新建', $r('app.media.import_choose_file'));
        }
        .alignItems(VerticalAlign.Center);
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
        Image($r('app.media.bookshelf_filter'))
          .width(20)
          .height(20);
        Text('筛选')
          .fontFamily('ReaderInter')
          .fontWeight(900)
          .fontSize(12)
          .fontColor(FILTER_TEXT)
          .maxLines(1);
        Blank();
        ReaderSelect({
          value: this.filterValue,
          options: ['全部', '已启用', '已禁用'],
          isOpen: this.filterOpen,
          onToggle: (): void => {
            this.filterOpen = !this.filterOpen;
          },
          onSelect: (opt: string): void => {
            this.filterValue = opt;
            this.filterOpen = false;
          },
        });
      }
      .width('100%')
      .height(34)
      .padding({ left: 11, right: 11 })
      .alignItems(VerticalAlign.Center)
      .backgroundColor(TOK_CARD_BG)
      .border({ width: TOK_BORDER_W, color: FILTER_BORDER })
      .borderRadius(8);

      Column() {
        ForEach(subscriptions, (sub: RssSubscription, index: number) => {
          this.sourceItem(sub, index);
        }, (sub: RssSubscription): string => `rss-sub-${sub.subscriptionId}`);
      }
      .width('100%')
      .backgroundColor(TOK_CARD_BG_HI)
      .border({ width: TOK_BORDER_W, color: CARD_BORDER })
      .borderRadius(8);
    }
    .width(this.contentWidth());
  }

  @Builder
  private actionPill(label: string, icon: Resource) {
    Row({ space: 5 }) {
      Image(icon)
        .width(20)
        .height(20);
      Text(label)
        .fontFamily('ReaderInter')
        .fontWeight(900)
        .fontSize(11)
        .fontColor(PILL_TEXT)
        .maxLines(1);
    }
    .height(30)
    .padding({ left: 9, right: 9 })
    .alignItems(VerticalAlign.Center)
    .backgroundColor(SOFT_PILL_BG)
    .borderRadius(999);
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
        Text(sub.feedUrl)
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
        bg: sub.enabled ? STATUS_ENABLED_BG : STATUS_DISABLED_BG,
        dot: sub.enabled ? '#2F6B52' : TOK_MUTED,
        radius: 999,
      });
    }
    .width('100%')
    .height(62)
    .padding({ left: TOK_SPACE_CONTROL_INLINE, right: TOK_SPACE_CONTROL_INLINE })
    .alignItems(VerticalAlign.Center)
    .border({ width: { top: index > 0 ? TOK_BORDER_W : 0 }, color: TOK_ROW_DIVIDER })
    .onClick((): void => this.onSelectSubscription(sub.subscriptionId));
  }

  @Builder
  private recentUnreadSection(recentUnread: RssItem[]) {
    Column({ space: 6 }) {
      Row() {
        Text('最近未读')
          .layoutWeight(1)
          .fontFamily('ReaderInter')
          .fontWeight(FontWeight.Bold)
          .fontSize(15)
          .fontColor(TOK_INK)
          .maxLines(1);
        Row({ space: 5 }) {
          Image($r('app.media.rss_chevron'))
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
        .borderRadius(999);
      }
      .width('100%')
      .height(30)
      .padding({ left: 2, right: 2 })
      .alignItems(VerticalAlign.Center);

      Column() {
        ForEach(recentUnread, (item: RssItem, index: number) => {
          this.recentUnreadItem(item, index);
        }, (item: RssItem): string => `rss-item-${item.guid}`);
      }
      .width('100%')
      .backgroundColor(TOK_CARD_BG_HI)
      .border({ width: TOK_BORDER_W, color: CARD_BORDER })
      .borderRadius(8);
    }
    .width(this.contentWidth());
  }

  @Builder
  private recentUnreadItem(item: RssItem, index: number) {
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
        if (item.pubDate !== undefined) {
          Text(item.pubDate)
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

      Image($r('app.media.rss_chevron'))
        .width(20)
        .height(20);
    }
    .width('100%')
    .padding({ left: TOK_SPACE_SM, right: TOK_SPACE_SM, top: TOK_SPACE_CONTROL_INLINE, bottom: TOK_SPACE_CONTROL_INLINE })
    .alignItems(VerticalAlign.Top)
    .border({ width: { top: index > 0 ? TOK_BORDER_W : 0 }, color: TOK_ROW_DIVIDER })
    .onClick((): void => this.onSelectItem(item.guid));
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
  private emptyContent() {
    Column() {
      this.stateCard(
        $r('app.media.rss_empty'),
        '暂无未读订阅',
        '当前订阅源没有新的未读条目。你可以查看全部、管理订阅源或手动刷新。',
        [],
        '查看全部',
        (): void => {});
    }
    .width('100%')
    .layoutWeight(1)
    .padding({ top: TOK_SPACE_XS, left: TOK_SCREEN_INSET, right: TOK_SCREEN_INSET, bottom: 86 });
  }

  @Builder
  private errorContent(failedSources: string[]) {
    Column() {
      this.stateCard(
        $r('app.media.rss_error'),
        '订阅刷新失败',
        `${failedSources.length} 个订阅源刷新失败，已保留最近缓存条目。可以稍后重试、查看错误源，或进入订阅源管理修复登录态和规则。`,
        failedSources,
        '重试刷新',
        (): void => this.onRefresh());
    }
    .width('100%')
    .layoutWeight(1)
    .padding({ top: TOK_SPACE_XS, left: TOK_SCREEN_INSET, right: TOK_SCREEN_INSET, bottom: 86 });
  }

  @Builder
  private stateCard(icon: Resource, title: string, body: string, failedSources: string[],
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
        .width(314)
        .fontFamily('ReaderInter')
        .fontWeight(FontWeight.Regular)
        .fontSize(12)
        .lineHeight(18.6)
        .fontColor(TOK_MUTED)
        .textAlign(TextAlign.Center);

      if (failedSources.length > 0) {
        Column({ space: 6 }) {
          ForEach(failedSources, (name: string) => {
            this.errorSourceRow(name);
          }, (name: string): string => `rss-fail-${name}`);
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
  private errorSourceRow(name: string) {
    Column() {
      Text(name)
        .width('100%')
        .fontFamily('ReaderInter')
        .fontWeight(FontWeight.Bold)
        .fontSize(12)
        .fontColor('#7D2F2B')
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis });
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
      .height(34)
      .padding({ left: 18, right: 18 })
      .backgroundColor(TOK_GREEN)
      .borderRadius(999)
      .onClick((): void => primaryAction());

      Stack({ alignContent: Alignment.Center }) {
        Text('订阅管理')
          .fontFamily('ReaderInter')
          .fontWeight(800)
          .fontSize(14)
          .fontColor(TOK_INK)
          .maxLines(1);
      }
      .height(44)
      .padding({ left: 18, right: 18 })
      .border({ width: TOK_BORDER_W, color: TOK_BORDER })
      .borderRadius(8)
      .onClick((): void => this.onManage());
    }
    .margin({ top: 20 })
    .alignItems(VerticalAlign.Bottom);
  }

  private enabledSourceSummary(): string {
    if (this.presentation.kind !== 'feed' && this.presentation.kind !== 'refreshing') {
      return '';
    }
    const enabled = this.presentation.subscriptions.filter((sub) => sub.enabled).length;
    return `${enabled} 个启用源`;
  }

  private lastUpdateSuffix(): string {
    if (this.presentation.kind !== 'feed' && this.presentation.kind !== 'refreshing') {
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

  private contentWidth(): number {
    return this.isTablet ? TOK_CONTENT_RAIL_W_TABLET : TOK_CONTENT_MAX_W_PHONE;
  }
}
