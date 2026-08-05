import {
  type RssItem,
  type RssSubscription,
} from './RssGateway';

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

const PHONE_CONTENT_WIDTH = 350;
const TABLET_CONTENT_WIDTH = 620;

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

  aboutToAppear(): void {
    const font = this.getUIContext().getFont();
    font.registerFont({
      familyName: 'ReaderInter',
      familySrc: $rawfile('InterVariable.ttf'),
    });
  }

  build() {
    Column() {
      this.topBar();
      this.searchBar();
      this.statusTabs();
      this.stateContent();
    }
    .width('100%')
    .height('100%')
    .backgroundColor('#F8F4EC');
  }

  @Builder
  private topBar() {
    Row({ space: 12 }) {
      Text('RSS')
        .layoutWeight(1)
        .fontFamily('ReaderInter')
        .fontWeight(FontWeight.Bold)
        .fontSize(24)
        .lineHeight(33)
        .fontColor('#1F1B17')
        .maxLines(1);

      Row({ space: 5 }) {
        Image($r('app.media.rss_refresh'))
          .width(14)
          .height(14);
        Text(this.enabledSourceSummary())
          .fontFamily('ReaderInter')
          .fontWeight(FontWeight.Regular)
          .fontSize(12)
          .lineHeight(16)
          .fontColor('#756F69')
          .maxLines(1);
      }
      .alignItems(VerticalAlign.Center)
      .onClick((): void => this.onRefresh());

      Row({ space: 5 }) {
        Image($r('app.media.rss_manage'))
          .width(14)
          .height(14);
        Text('管理')
          .fontFamily('ReaderInter')
          .fontWeight(FontWeight.Bold)
          .fontSize(12)
          .lineHeight(16)
          .fontColor('#2D4A3E')
          .maxLines(1);
      }
      .alignItems(VerticalAlign.Center)
      .onClick((): void => this.onManage());
    }
    .width(this.contentWidth())
    .height(58)
    .padding({ left: this.isTablet ? 20 : 16, right: this.isTablet ? 20 : 16, top: 6 })
    .alignItems(VerticalAlign.Center);
  }

  @Builder
  private searchBar() {
    Row({ space: 8 }) {
      Image($r('app.media.search_mag')).width(14).height(14);
      Text('搜索订阅源、文章标题或分组')
        .layoutWeight(1)
        .fontFamily('ReaderInter')
        .fontWeight(FontWeight.Regular)
        .fontSize(14)
        .fontColor('#801F1B17')
        .maxLines(1);
    }
    .width(this.contentWidth())
    .height(40)
    .padding({ left: 12, right: 12 })
    .backgroundColor('#1A1F1B17')
    .borderRadius(999)
    .alignItems(VerticalAlign.Center);
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
    .padding({ left: this.isTablet ? 20 : 16, right: this.isTablet ? 20 : 16, top: 8 })
    .alignItems(VerticalAlign.Top);
  }

  @Builder
  private statusTab(label: string, active: boolean) {
    Text(label)
      .fontFamily('ReaderInter')
      .fontWeight(900)
      .fontSize(12)
      .fontColor(active ? '#FFFFFF' : '#564D44')
      .padding({ left: 10, right: 10, top: 6, bottom: 6 })
      .backgroundColor(active ? '#2D4A3E' : '#EEE8DF')
      .borderRadius(999)
      .textAlign(TextAlign.Center)
      .maxLines(1);
  }

  @Builder
  private stateContent() {
    if (this.presentation.kind === 'feed') {
      this.feedContent(this.presentation.subscriptions, this.presentation.recentUnread, false);
    } else if (this.presentation.kind === 'refreshing') {
      this.feedContent(this.presentation.subscriptions, this.presentation.recentUnread, true);
    } else if (this.presentation.kind === 'empty') {
      this.emptyContent();
    } else {
      this.errorContent(this.presentation.failedSources);
    }
  }

  @Builder
  private feedContent(subscriptions: RssSubscription[], recentUnread: RssItem[], refreshing: boolean) {
    Scroll() {
      Column({ space: 0 }) {
        if (refreshing) {
          Row({ space: 8 }) {
            Image($r('app.media.importing_spinner_track')).width(14).height(14);
            Image($r('app.media.importing_spinner_arc')).width(14).height(14);
            Text('正在刷新启用订阅源和分类入口')
              .fontFamily('ReaderInter')
              .fontWeight(FontWeight.Regular)
              .fontSize(12)
              .lineHeight(16)
              .fontColor('#756F69')
              .maxLines(1);
          }
          .width(this.contentWidth())
          .height(30)
          .padding({ left: this.isTablet ? 20 : 16, right: this.isTablet ? 20 : 16 })
          .alignItems(VerticalAlign.Center);
        }

        this.subscriptionSection(subscriptions);
        this.recentUnreadSection(recentUnread);
      }
      .width('100%')
      .padding({ top: 8, bottom: 120 });
    }
    .width('100%')
    .layoutWeight(1)
    .scrollBar(BarState.Off)
    .opacity(refreshing ? 0.6 : 1);
  }

  @Builder
  private subscriptionSection(subscriptions: RssSubscription[]) {
    Column({ space: 0 }) {
      Row() {
        Text('订阅源')
          .layoutWeight(1)
          .fontFamily('ReaderInter')
          .fontWeight(FontWeight.Bold)
          .fontSize(15)
          .lineHeight(18)
          .fontColor('#1F1B17')
          .maxLines(1);
        Row({ space: 12 }) {
          Text('导入')
            .fontFamily('ReaderInter')
            .fontWeight(FontWeight.Bold)
            .fontSize(12)
            .lineHeight(16)
            .fontColor('#2D4A3E');
          Text('新建')
            .fontFamily('ReaderInter')
            .fontWeight(FontWeight.Bold)
            .fontSize(12)
            .lineHeight(16)
            .fontColor('#2D4A3E');
        }
        .alignItems(VerticalAlign.Center);
      }
      .width(this.contentWidth())
      .height(48)
      .padding({ left: this.isTablet ? 20 : 16, right: this.isTablet ? 20 : 16 })
      .alignItems(VerticalAlign.Center);

      ForEach(subscriptions, (sub: RssSubscription) => {
        this.sourceItem(sub);
      }, (sub: RssSubscription): string => `rss-sub-${sub.subscriptionId}`);
    }
    .width('100%');
  }

  @Builder
  private sourceItem(sub: RssSubscription) {
    Row({ space: 10 }) {
      Stack({ alignContent: Alignment.Center }) {
        Image($r('app.media.rss_source'))
          .width(20)
          .height(20);
      }
      .width(32)
      .height(32)
      .backgroundColor('#1F2D4A3E')
      .borderRadius(16);

      Column({ space: 3 }) {
        Text(sub.title)
          .width('100%')
          .fontFamily('ReaderInter')
          .fontWeight(FontWeight.Bold)
          .fontSize(13)
          .fontColor('#1F1B17')
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis });
        Text(sub.feedUrl)
          .width('100%')
          .fontFamily('ReaderInter')
          .fontWeight(FontWeight.Regular)
          .fontSize(10)
          .fontColor('#756F69')
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis });
      }
      .layoutWeight(1)
      .alignItems(HorizontalAlign.Start);

      Text(`${sub.unreadCount}`)
        .fontFamily('ReaderInter')
        .fontWeight(900)
        .fontSize(16)
        .fontColor('#1F3528')
        .maxLines(1);

      Stack({ alignContent: Alignment.Center }) {
        Text('')
          .width(7)
          .height(7)
          .backgroundColor(sub.enabled ? '#2F6B52' : '#C1C7CD')
          .borderRadius(3.5);
      }
      .width(24)
      .height(18)
      .backgroundColor(sub.enabled ? '#1F36795B' : '#1FC1C7CD')
      .borderRadius(999);
    }
    .width(this.contentWidth())
    .height(62)
    .padding({ left: this.isTablet ? 20 : 10, right: this.isTablet ? 20 : 10, top: 9, bottom: 9 })
    .alignItems(VerticalAlign.Center)
    .onClick((): void => this.onSelectSubscription(sub.subscriptionId));
  }

  @Builder
  private recentUnreadSection(recentUnread: RssItem[]) {
    Column({ space: 0 }) {
      Row() {
        Text('最近未读')
          .layoutWeight(1)
          .fontFamily('ReaderInter')
          .fontWeight(FontWeight.Bold)
          .fontSize(15)
          .lineHeight(18)
          .fontColor('#1F1B17')
          .maxLines(1);
        Text('查看全部')
          .fontFamily('ReaderInter')
          .fontWeight(FontWeight.Bold)
          .fontSize(12)
          .lineHeight(16)
          .fontColor('#2D4A3E')
          .maxLines(1);
      }
      .width(this.contentWidth())
      .height(48)
      .padding({ left: this.isTablet ? 20 : 16, right: this.isTablet ? 20 : 16 })
      .alignItems(VerticalAlign.Center);

      ForEach(recentUnread, (item: RssItem) => {
        this.recentUnreadItem(item);
      }, (item: RssItem): string => `rss-item-${item.guid}`);
    }
    .width('100%');
  }

  @Builder
  private recentUnreadItem(item: RssItem) {
    Row({ space: 10 }) {
      Text('')
        .width(7)
        .height(7)
        .backgroundColor('#2D4A3E')
        .borderRadius(3.5);

      Column({ space: 3 }) {
        Text(item.title)
          .width('100%')
          .fontFamily('ReaderInter')
          .fontWeight(FontWeight.Bold)
          .fontSize(13)
          .lineHeight(16.25)
          .fontColor('#1F1B17')
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis });
        if (item.pubDate !== undefined) {
          Text(item.pubDate)
            .width('100%')
            .fontFamily('ReaderInter')
            .fontWeight(FontWeight.Regular)
            .fontSize(10)
            .fontColor('#756F69')
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
            .fontColor('#6F655D')
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
    .width(this.contentWidth())
    .padding({ left: this.isTablet ? 20 : 12, right: this.isTablet ? 20 : 12, top: 10, bottom: 10 })
    .alignItems(VerticalAlign.Top)
    .onClick((): void => this.onSelectItem(item.guid));
  }

  @Builder
  private emptyContent() {
    Column({ space: 0 }) {
      Blank().layoutWeight(1);
      Image($r('app.media.rss_empty')).width(28).height(28);

      Text('暂无未读订阅')
        .margin({ top: 16 })
        .fontFamily('ReaderInter')
        .fontWeight(FontWeight.Bold)
        .fontSize(17)
        .lineHeight(22)
        .fontColor('#1F1B17')
        .textAlign(TextAlign.Center);

      Text('当前订阅源没有新的未读条目。你可以查看全部、管理订阅源或手动刷新。')
        .margin({ top: 8 })
        .width(314)
        .fontFamily('ReaderInter')
        .fontWeight(FontWeight.Regular)
        .fontSize(13)
        .lineHeight(19)
        .fontColor('#756F69')
        .textAlign(TextAlign.Center);

      Row({ space: 10 }) {
        Text('查看全部')
          .fontFamily('ReaderInter')
          .fontWeight(FontWeight.Bold)
          .fontSize(13)
          .lineHeight(16)
          .fontColor('#2D4A3E')
          .padding({ left: 18, right: 18, top: 9, bottom: 9 })
          .backgroundColor('#E6FFFCF8')
          .border({ width: 0.5, color: '#C1C7CD' })
          .borderRadius(999);
        Text('订阅管理')
          .fontFamily('ReaderInter')
          .fontWeight(FontWeight.Bold)
          .fontSize(13)
          .lineHeight(16)
          .fontColor('#2D4A3E')
          .padding({ left: 18, right: 18, top: 9, bottom: 9 })
          .backgroundColor('#E6FFFCF8')
          .border({ width: 0.5, color: '#C1C7CD' })
          .borderRadius(999)
          .onClick((): void => this.onManage());
      }
      .margin({ top: 20 });
      Blank().layoutWeight(1);
    }
    .width('100%')
    .layoutWeight(1);
  }

  @Builder
  private errorContent(failedSources: string[]) {
    Column({ space: 0 }) {
      Blank().layoutWeight(1);
      Image($r('app.media.rss_error')).width(28).height(28);

      Text('订阅刷新失败')
        .margin({ top: 16 })
        .fontFamily('ReaderInter')
        .fontWeight(FontWeight.Bold)
        .fontSize(17)
        .lineHeight(22)
        .fontColor('#1F1B17')
        .textAlign(TextAlign.Center);

      Text('部分订阅源刷新失败，已保留最近缓存条目。可以稍后重试、查看错误源，或进入订阅源管理修复登录态和规则。')
        .margin({ top: 8 })
        .width(314)
        .fontFamily('ReaderInter')
        .fontWeight(FontWeight.Regular)
        .fontSize(13)
        .lineHeight(19)
        .fontColor('#756F69')
        .textAlign(TextAlign.Center);

      ForEach(failedSources, (name: string) => {
        Text(name)
          .width('100%')
          .fontFamily('ReaderInter')
          .fontWeight(FontWeight.Bold)
          .fontSize(13)
          .lineHeight(16)
          .fontColor('#1F1B17')
          .padding({ left: 10, right: 10, top: 8, bottom: 8 })
          .border({ width: { bottom: 0.5 }, color: { bottom: '#C1C7CD' } })
          .maxLines(1);
      }, (name: string): string => `rss-fail-${name}`);

      Row({ space: 10 }) {
        Text('重试刷新')
          .fontFamily('ReaderInter')
          .fontWeight(FontWeight.Bold)
          .fontSize(13)
          .lineHeight(16)
          .fontColor('#2D4A3E')
          .padding({ left: 18, right: 18, top: 9, bottom: 9 })
          .backgroundColor('#E6FFFCF8')
          .border({ width: 0.5, color: '#C1C7CD' })
          .borderRadius(999)
          .onClick((): void => this.onRefresh());
        Text('订阅管理')
          .fontFamily('ReaderInter')
          .fontWeight(FontWeight.Bold)
          .fontSize(13)
          .lineHeight(16)
          .fontColor('#2D4A3E')
          .padding({ left: 18, right: 18, top: 9, bottom: 9 })
          .backgroundColor('#E6FFFCF8')
          .border({ width: 0.5, color: '#C1C7CD' })
          .borderRadius(999)
          .onClick((): void => this.onManage());
      }
      .margin({ top: 20 });
      Blank().layoutWeight(1);
    }
    .width('100%')
    .layoutWeight(1);
  }

  private enabledSourceSummary(): string {
    if (this.presentation.kind !== 'feed' && this.presentation.kind !== 'refreshing') {
      return '';
    }
    const enabled = this.presentation.subscriptions.filter((sub) => sub.enabled).length;
    return `${enabled} 个启用源`;
  }

  private contentWidth(): number {
    return this.isTablet ? TABLET_CONTENT_WIDTH : PHONE_CONTENT_WIDTH;
  }
}