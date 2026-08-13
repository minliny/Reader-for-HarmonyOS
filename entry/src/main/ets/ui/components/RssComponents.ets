// RssComponents — rss skeleton ported from render-runtime.js mainTabRss()
// DOM: .fd-search-entry.fd-rss-search → .fd-rss-mode-row → .fd-rss-source-overview
// → .fd-rss-article-section (header + .fd-rss-article-list).
import { ColorTokens } from '../../contract/generated/ColorTokens';
import { DemoAliasTokens } from '../../contract/generated/DemoAliasTokens';
import { RouteId } from '../../contract/generated/RouteTable';
import { ReaderUiVisualTokens } from '../../contract/reader_ui/VisualAdmission';
import { ReaderUiStore } from '../store/ReaderUiStore';
import { CoreRssSubscription, CoreRssItem } from '../store/ReaderUiState';
import { CoreRuntime } from '../../bridge/CoreRuntime';
import { HostWebViewCloseRequest, HostWebViewOpenRequest } from '../../host/types/HostRequest';
import { RssSelectionProjection } from './RssSelectionProjection';
import webview from '@ohos.web.webview';

const RSS_ORIGINAL_WEB_PROFILE: string = 'rss-original';

// Web must never be constructed for an arbitrary feed string. The Core RSS
// item may have no link, or a non-web scheme intended only as metadata.
export function isSafeRssOriginalUrl(value: string): boolean {
  const url = value.trim();
  return /^https?:\/\/[^\s]+$/i.test(url);
}

// .fd-search-entry: min-height 44, pill, 24 icon + 14 muted, padding 0 14.
@Component
export struct RssSearchEntry {
  build() {
    Row() {
      Image($r('app.media.ui_icon_search_muted')).width(20).height(20)
      Text('搜索订阅源、文章标题或分组')
        .fontFamily(ReaderUiVisualTokens.rssControlFontFamily)
        .fontSize(14)
        .fontColor(ReaderUiVisualTokens.rssSearchPlaceholder)
        .margin({ left: 10 })
    }
    .width('100%')
    .height(ReaderUiVisualTokens.rssSearchHeight)
    .padding({ left: 14, right: 14 })
    .borderRadius(999)
    .backgroundColor(ReaderUiVisualTokens.rssSearchSurface)
    .border({ width: 1, color: ReaderUiVisualTokens.rssSearchBorder })
    .alignItems(VerticalAlign.Center)
    .accessibilityText('搜索订阅源、文章标题或分组：当前 Figma 未提供可进入的搜索目标')
  }
}

// Core currently exposes subscriptions and their items.  Keep navigation to
// those real surfaces only; group/favorite/rule management is rendered as an
// explicit unavailable state on its legacy routes.
@Component
export struct RssModeRow {
  private modes: string[] = ['源列表', '全部', '收藏', '规则订阅'];

  build() {
    Scroll() {
      Row() {
        ForEach(this.modes, (m: string) => {
          Text(m)
            .fontFamily(ReaderUiVisualTokens.rssControlFontFamily)
            .fontSize(ReaderUiVisualTokens.rssControlLabelSize)
            .fontWeight(850)
            .fontColor(m === '源列表' ? ReaderUiVisualTokens.rssOnPrimary : ReaderUiVisualTokens.rssInactiveChipInk)
            .backgroundColor(m === '源列表' ? ReaderUiVisualTokens.rssPrimary : ReaderUiVisualTokens.rssInactiveChipSurface)
            .height(ReaderUiVisualTokens.rssModeHeight)
            .padding({ left: 10, right: 10 })
            .borderRadius(999)
            .margin({ right: 6 })
            .accessibilityText(`${m}${m === '源列表' ? '，当前页面' : '，当前 Figma 未提供可进入的目标'}`)
        }, (m: string) => m)
      }
    }
    .scrollable(ScrollDirection.Horizontal)
    .scrollBar(BarState.Off)
    .width('100%')
  }
}

// Current Figma RSS master: subscription header, filter field and truthful
// Core-projected subscription rows. Actions without an admitted Figma target
// remain present as visuals but deliberately inert.
@Component
export struct RssSourceOverview {
  @StorageProp('reader.rssSubscriptions') coreSources: CoreRssSubscription[] = [];
  @StorageProp('reader.rssLoaded') rssLoaded: boolean = false;

  private sourceTitle(source: CoreRssSubscription): string {
    return source.title.length > 0 ? source.title : source.feedUrl;
  }

  private sourceMeta(source: CoreRssSubscription): string {
    return source.enabled ? '已启用' : '已暂停';
  }

  build() {
    Column() {
      Row() {
        Text('订阅源')
          .fontFamily(ReaderUiVisualTokens.rssControlFontFamily)
          .fontSize(ReaderUiVisualTokens.rssTitleSize)
          .fontWeight(700)
          .fontColor(ReaderUiVisualTokens.rssHeaderInk)
        Blank()
        Row() {
          Text('导入')
            .fontFamily(ReaderUiVisualTokens.rssControlFontFamily)
            .fontSize(ReaderUiVisualTokens.rssControlLabelSize)
            .fontWeight(850)
            .fontColor(ReaderUiVisualTokens.rssInactiveChipInk)
        }
        .width(65)
        .height(30)
        .borderRadius(999)
        .backgroundColor(ReaderUiVisualTokens.rssInactiveChipSurface)
        .justifyContent(FlexAlign.Center)
        .alignItems(VerticalAlign.Center)
        .accessibilityText('导入订阅源：当前 Figma 未提供可进入的目标')
        Row() {
          Text('新建')
            .fontFamily(ReaderUiVisualTokens.rssControlFontFamily)
            .fontSize(ReaderUiVisualTokens.rssControlLabelSize)
            .fontWeight(850)
            .fontColor(ReaderUiVisualTokens.rssInactiveChipInk)
        }
        .width(65)
        .height(30)
        .borderRadius(999)
        .backgroundColor(ReaderUiVisualTokens.rssInactiveChipSurface)
        .justifyContent(FlexAlign.Center)
        .alignItems(VerticalAlign.Center)
        .margin({ left: 6 })
        .accessibilityText('新建订阅源：当前 Figma 未提供可进入的目标')
      }
      .width('100%')
      .height(ReaderUiVisualTokens.rssSourceHeaderHeight)
      .padding({ left: 10, right: 10 })
      .border({ width: 1, color: ReaderUiVisualTokens.rssCardBorder })
      .borderRadius(8)
      .backgroundColor(ReaderUiVisualTokens.rssCardSurface)
      .alignItems(VerticalAlign.Center)
      Row() {
        Text('筛选')
          .fontFamily(ReaderUiVisualTokens.rssControlFontFamily)
          .fontSize(ReaderUiVisualTokens.rssControlLabelSize)
          .fontWeight(900)
          .fontColor(ReaderUiVisualTokens.rssInactiveChipInk)
        Blank().layoutWeight(1)
        Text('全部')
          .fontFamily(ReaderUiVisualTokens.rssControlFontFamily)
          .fontSize(ReaderUiVisualTokens.rssMetaSize)
          .fontWeight(800)
          .fontColor(ReaderUiVisualTokens.rssMuted)
        Text('⌄')
          .fontFamily(ReaderUiVisualTokens.rssControlFontFamily)
          .fontSize(16)
          .fontColor(ReaderUiVisualTokens.rssInactiveChipInk)
          .margin({ left: 7 })
      }
      .width('100%')
      .height(34)
      .padding({ left: 10, right: 10 })
      .border({ width: 1, color: ReaderUiVisualTokens.rssFieldBorder })
      .borderRadius(8)
      .backgroundColor(ReaderUiVisualTokens.rssFieldSurface)
      .alignItems(VerticalAlign.Center)
      .margin({ top: ReaderUiVisualTokens.rssSectionGap })
      Column() {
        if (this.rssLoaded) {
          ForEach(this.coreSources, (source: CoreRssSubscription, index: number) => {
          Row() {
            Stack({ alignContent: Alignment.Center }) {
              Image($r('app.media.ui_icon_rss_primary')).width(16).height(16)
            }
              .width(ReaderUiVisualTokens.rssSourceIconSize)
              .height(ReaderUiVisualTokens.rssSourceIconSize)
              .borderRadius(16)
              .backgroundColor(ReaderUiVisualTokens.rssSourceIconSurface)
            Column() {
              Text(this.sourceTitle(source))
                .fontFamily(ReaderUiVisualTokens.rssControlFontFamily)
                .fontSize(ReaderUiVisualTokens.rssSourceTitleSize)
                .fontWeight(700)
                .fontColor(ReaderUiVisualTokens.rssHeaderInk)
                .maxLines(1)
                .textOverflow({ overflow: TextOverflow.Ellipsis })
              Text(this.sourceMeta(source))
                .fontFamily(ReaderUiVisualTokens.rssControlFontFamily)
                .fontSize(ReaderUiVisualTokens.rssMetaSize)
                .fontColor(ReaderUiVisualTokens.rssMuted)
                .margin({ top: 3 })
            }
            .alignItems(HorizontalAlign.Start)
            .layoutWeight(1)
            .margin({ left: 8 })
            Text(`${source.unreadCount}`)
              .fontFamily(ReaderUiVisualTokens.rssControlFontFamily)
              .fontSize(16)
              .fontWeight(900)
              .fontColor(ReaderUiVisualTokens.rssHeaderInk)
            Circle()
              .width(7)
              .height(7)
              .fill(source.enabled ? ReaderUiVisualTokens.rssSourceStatusGood : ReaderUiVisualTokens.rssSourceStatusWarn)
              .margin({ left: 8 })
          }
          .width('100%')
          .height(ReaderUiVisualTokens.rssSourceRowHeight)
          .padding({ left: 10, right: 10 })
          .border(index > 0 ? { width: { top: 1 }, color: ReaderUiVisualTokens.rssCardBorder } : { width: 0 })
          .alignItems(VerticalAlign.Center)
          }, (source: CoreRssSubscription, index: number) => `${source.subscriptionId}-${index}`)
        }
      }
      .width('100%')
      .margin({ top: ReaderUiVisualTokens.rssSectionGap })
      .border({ width: 1, color: ReaderUiVisualTokens.rssCardBorder })
      .borderRadius(8)
      .backgroundColor(ReaderUiVisualTokens.rssCardSurface)
      .clip(true)
    }
    .width('100%')
  }
}

// The all/unread controls issue a new Core request; they never hide the
// currently cached array with a local predicate. This matters because Core is
// the only owner of the subscription-scoped read record.
@Component
struct RssCoreFilterControls {
  @StorageProp('reader.rssItemFilter') itemFilter: string = 'all';
  @StorageProp('reader.rssLoading') rssLoading: boolean = false;

  @Builder chip(label: string, filter: string) {
    Text(label)
      .fontSize(11)
      .fontWeight(800)
      .fontColor(this.itemFilter === filter ? DemoAliasTokens.onPrimary : ColorTokens.controlInk)
      .backgroundColor(this.itemFilter === filter ? ColorTokens.primary : ColorTokens.metaBg)
      .height(28)
      .padding({ left: 10, right: 10 })
      .borderRadius(DemoAliasTokens.radiusPill)
      .margin({ right: 6 })
      .opacity(this.rssLoading && this.itemFilter !== filter ? 0.72 : 1)
      .onClick(() => {
        if (this.itemFilter !== filter) {
          ReaderUiStore.dispatch({ type: 'rss-filter-set', rssItemFilter: filter === 'unread' ? 'unread' : 'all' });
        }
      })
  }

  build() {
    Row() {
      this.chip('全部', 'all')
      this.chip('未读', 'unread')
      Blank()
      Text(this.rssLoading ? '读取中…' : '刷新')
        .fontSize(11)
        .fontWeight(850)
        .fontColor(ColorTokens.primaryDark)
        .height(28)
        .padding({ left: 10, right: 10 })
        .borderRadius(DemoAliasTokens.radiusPill)
        .backgroundColor(ColorTokens.metaBg)
        .onClick(() => {
          if (!this.rssLoading) ReaderUiStore.dispatch({ type: 'rss-refresh' });
        })
    }
    .width('100%')
  }
}

// Current Figma RSS page shows the recent-unread section below the subscription
// list.  The static Figma examples never become app data: only unread Core
// records are projected here, and article detail stays inert until Figma has a
// corresponding admitted destination.
@Component
export struct RssArticleSection {
  @Prop title: string = '最近未读';
  // Legacy blocked routes still instantiate this component with these props.
  // Keep the schema-compatible inputs but never turn them into unadmitted UI.
  @Prop actionLabel: string = '';
  @Prop actionRoute: string = '';
  @StorageProp('reader.rssItems') coreArticles: CoreRssItem[] = [];
  @StorageProp('reader.rssLoaded') rssLoaded: boolean = false;

  private unreadArticles(): CoreRssItem[] {
    const rows: CoreRssItem[] = [];
    for (let index = 0; index < this.coreArticles.length; index += 1) {
      if (!this.coreArticles[index].read) rows.push(this.coreArticles[index]);
    }
    return rows;
  }

  build() {
    Column() {
      Row() {
        Text(this.title)
          .fontFamily(ReaderUiVisualTokens.rssControlFontFamily)
          .fontSize(ReaderUiVisualTokens.rssTitleSize)
          .fontWeight(700)
          .fontColor(ReaderUiVisualTokens.rssHeaderInk)
      }
      .width('100%')
      .margin({ bottom: 6 })
      if (this.rssLoaded && this.unreadArticles().length > 0) {
        Column() {
          ForEach(this.unreadArticles(), (article: CoreRssItem, index: number) => {
          Row() {
            Stack({ alignContent: Alignment.Center }) {
              Circle().width(7).height(7).fill(ReaderUiVisualTokens.rssUnreadIndicator)
            }
            .width(10)
            .height(10)
            Column() {
              Text(article.title)
                .fontFamily(ReaderUiVisualTokens.rssControlFontFamily)
                .fontSize(ReaderUiVisualTokens.rssSourceTitleSize)
                .fontWeight(700)
                .fontColor(ReaderUiVisualTokens.rssHeaderInk)
                .maxLines(1)
                .textOverflow({ overflow: TextOverflow.Ellipsis })
              Text(`${article.sourceTitle}${article.pubDate.length > 0 ? ' · ' + article.pubDate : ''}`)
                .fontFamily(ReaderUiVisualTokens.rssControlFontFamily)
                .fontSize(ReaderUiVisualTokens.rssMetaSize)
                .fontColor(ReaderUiVisualTokens.rssMuted)
                .margin({ top: 4 })
            }
            .alignItems(HorizontalAlign.Start)
            .layoutWeight(1)
            .margin({ left: 8 })
          }
          .width('100%')
          .height(ReaderUiVisualTokens.rssSourceRowHeight)
          .padding({ left: 12, right: 12 })
          .border(index > 0 ? { width: { top: 1 }, color: ReaderUiVisualTokens.rssCardBorder } : { width: 0 })
          .alignItems(VerticalAlign.Center)
          }, (article: CoreRssItem, index: number) => `${article.subscriptionId}-${article.guid}-${index}`)
        }
        .width('100%')
        .border({ width: 1, color: ReaderUiVisualTokens.rssCardBorder })
        .borderRadius(8)
        .backgroundColor(ReaderUiVisualTokens.rssCardSurface)
        .clip(true)
      }
    }
    .width('100%')
  }
}

@Component
struct RssSourceStrip {
  @StorageProp('reader.rssSubscriptions') sources: CoreRssSubscription[] = [];
  @StorageProp('reader.rssLoaded') rssLoaded: boolean = false;

  build() {
    if (!this.rssLoaded) {
      Text('正在读取订阅源…')
        .fontSize(12)
        .fontColor(ColorTokens.muted)
        .width('100%')
        .padding({ top: 12, bottom: 12 })
    } else if (this.sources.length === 0) {
      Text('暂无订阅源')
        .fontSize(12)
        .fontColor(ColorTokens.muted)
        .width('100%')
        .padding({ top: 12, bottom: 12 })
    } else {
      Scroll() {
        Row() {
          ForEach(this.sources, (s: CoreRssSubscription, i: number) => {
          Row() {
            Stack()
              .width(26).height(26)
              .borderRadius(DemoAliasTokens.radiusPill)
              .backgroundColor(ColorTokens.metaBg)
            Column() {
              Text(s.title)
                .fontSize(12)
                .fontColor(ColorTokens.ink)
                .maxLines(1)
                .textOverflow({ overflow: TextOverflow.Ellipsis })
              Text(`${s.unreadCount} 未读`)
                .fontSize(10)
                .fontColor(ColorTokens.muted)
                .maxLines(1)
                .textOverflow({ overflow: TextOverflow.Ellipsis })
                .margin({ top: 2 })
            }
            .alignItems(HorizontalAlign.Start)
            .layoutWeight(1)
            .margin({ left: 8 })
          }
          .width(138)
          .height(58)
          .padding({ left: 8, right: 8 })
          .border({ width: 1, color: i === 0 ? ColorTokens.primary : ColorTokens.border })
          .borderRadius(DemoAliasTokens.radiusMd)
          .backgroundColor(i === 0 ? ColorTokens.metaBg : DemoAliasTokens.surface)
          .margin({ right: 6 })
          .alignItems(VerticalAlign.Center)
          }, (s: CoreRssSubscription, i: number) => `${s.subscriptionId}-${i}`)
        }
      }
      .scrollable(ScrollDirection.Horizontal)
      .scrollBar(BarState.Off)
      .width('100%')
    }
  }
}

@Component
struct RssRefreshLine {
  @StorageProp('reader.rssRefreshStatus') status: string = 'idle';
  @StorageProp('reader.rssRefreshMessage') message: string = '';

  private displayText(): string {
    if (this.message.length > 0) return this.message;
    if (this.status === 'refreshing') return '正在刷新启用订阅源…';
    if (this.status === 'success') return 'RSS 刷新完成。';
    if (this.status === 'error') return 'RSS 刷新失败。';
    return '尚未开始刷新。';
  }

  build() {
    Row() {
      Circle()
        .width(14).height(14)
        .fill(this.status === 'error' ? ColorTokens.statusWarn
          : (this.status === 'success' ? ColorTokens.statusGood : ColorTokens.primary))
      Text(this.displayText())
        .fontSize(12)
        .fontWeight(800)
        .fontColor(this.status === 'error' ? ColorTokens.statusWarn : ColorTokens.muted)
        .margin({ left: 8 })
        .layoutWeight(1)
        .maxLines(2)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
      if (this.status !== 'refreshing') {
        Text('刷新')
          .fontSize(12)
          .fontWeight(800)
          .fontColor(ColorTokens.primaryDark)
          .margin({ left: 8 })
          .onClick(() => ReaderUiStore.dispatch({ type: 'rss-refresh' }))
      }
    }
    .width('100%')
    .height(30)
    .justifyContent(FlexAlign.Center)
    .alignItems(VerticalAlign.Center)
  }
}

@Component
export struct RssAllPage {
  build() {
    Column() {
      RssSearchEntry()
      RssModeRow()
        .margin({ top: 8 })
      RssSourceStrip()
        .margin({ top: 8 })
      RssArticleSection({ title: '全部条目', actionLabel: '管理源', actionRoute: 'rss-subscription-management' })
        .margin({ top: 8 })
    }
    .width('100%')
  }
}

@Component
export struct RssRefreshingPage {
  build() {
    Column() {
      RssSearchEntry()
      RssModeRow()
        .margin({ top: 8 })
      RssRefreshLine()
        .margin({ top: 8 })
      RssSourceOverview()
        .margin({ top: 8 })
      RssArticleSection({ title: '最近未读', actionLabel: '查看全部' })
        .margin({ top: 8 })
    }
    .width('100%')
  }
}

@Component
struct RssOriginalPreviewHeader {
  @Prop title: string = '';
  @Prop meta: string = '';

  build() {
    Row() {
      Stack()
        .width(32).height(32)
        .borderRadius(DemoAliasTokens.radiusPill)
        .backgroundColor(ColorTokens.metaBg)
      Column() {
        Text(this.title.length > 0 ? this.title : '未选择 RSS 条目')
          .fontSize(13)
          .fontColor(ColorTokens.ink)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
        Text(this.meta.length > 0 ? this.meta : '请选择一条由 Core 返回的 RSS 条目。')
          .fontSize(10)
          .fontColor(ColorTokens.muted)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
          .margin({ top: 3 })
      }
      .alignItems(HorizontalAlign.Start)
      .layoutWeight(1)
      .margin({ left: 9 })
    }
    .width('100%')
    .height(62)
    .padding({ left: 10, right: 10 })
    .border({ width: 1, color: ColorTokens.border })
    .borderRadius(DemoAliasTokens.radiusMd)
    .backgroundColor(DemoAliasTokens.surface)
    .alignItems(VerticalAlign.Center)
  }
}

// The Web component is UI-owned, while WebViewHostAdapter owns the controller
// registry used by Host operations.  Register before the component loads and
// unregister when this route disappears so a later RSS selection never drives
// a stale controller.
@Component
struct RssOriginalWebSurface {
  @Prop url: string = '';
  @State private loadState: string = 'idle';
  @State private failureMessage: string = '';
  private controller: webview.WebviewController = new webview.WebviewController();

  private normalizedUrl(): string {
    return this.url.trim();
  }

  private canLoad(): boolean {
    return isSafeRssOriginalUrl(this.normalizedUrl());
  }

  aboutToAppear(): void {
    if (this.normalizedUrl().length === 0) {
      this.loadState = 'empty';
      return;
    }
    if (!this.canLoad()) {
      this.loadState = 'invalid';
      this.failureMessage = 'Core 返回的原文链接不是可加载的 http(s) 地址。';
      return;
    }
    if (!CoreRuntime.isInitialized()) {
      this.loadState = 'error';
      this.failureMessage = 'Core Host 尚未初始化，无法注册原文 WebView。';
      return;
    }
    try {
      const adapter = CoreRuntime.get().getWebViewAdapter();
      adapter.registerController(RSS_ORIGINAL_WEB_PROFILE, this.controller);
      this.loadState = 'loading';
      adapter.open({
        url: this.normalizedUrl(),
        profileId: RSS_ORIGINAL_WEB_PROFILE,
      } as HostWebViewOpenRequest).then((response): void => {
        if (!response.opened) {
          this.loadState = 'error';
          this.failureMessage = '原文 WebView 控制器注册失败。';
        }
      }).catch((e: Error): void => {
        this.loadState = 'error';
        this.failureMessage = `原文 WebView 打开失败：${e.message}`;
      });
    } catch (e) {
      this.loadState = 'error';
      this.failureMessage = `原文 WebView 注册失败：${(e as Error).message}`;
    }
  }

  aboutToDisappear(): void {
    if (!CoreRuntime.isInitialized()) return;
    try {
      const adapter = CoreRuntime.get().getWebViewAdapter();
      adapter.close({ profileId: RSS_ORIGINAL_WEB_PROFILE } as HostWebViewCloseRequest);
      adapter.unregisterController(RSS_ORIGINAL_WEB_PROFILE);
    } catch (e) {
      console.info(`RssOriginalWebSurface: unregister failed: ${(e as Error).message}`);
    }
  }

  build() {
    Column() {
      if (this.loadState === 'empty') {
        Text('Core 未提供原文链接。')
          .fontSize(13)
          .fontColor(ColorTokens.muted)
          .width('100%')
          .padding(16)
      } else if (this.loadState === 'invalid') {
        Text(this.failureMessage)
          .fontSize(13)
          .lineHeight(20)
          .fontColor(ColorTokens.statusWarn)
          .width('100%')
          .padding(16)
      } else if (this.loadState === 'error') {
        Column({ space: 8 }) {
          Text(this.failureMessage.length > 0 ? this.failureMessage : '原文页面加载失败。')
            .fontSize(13)
            .lineHeight(20)
            .fontColor(ColorTokens.statusWarn)
          Text('重试加载')
            .fontSize(12)
            .fontWeight(800)
            .fontColor(ColorTokens.primaryDark)
            .onClick(() => this.aboutToAppear())
        }
        .width('100%')
        .padding(16)
        .alignItems(HorizontalAlign.Start)
      } else if (this.canLoad()) {
        if (this.loadState === 'loading') {
          Text('正在加载原文…')
            .fontSize(12)
            .fontColor(ColorTokens.muted)
            .width('100%')
            .padding({ left: 12, right: 12, top: 8, bottom: 8 })
        }
        Web({ src: this.normalizedUrl(), controller: this.controller })
          .javaScriptAccess(false)
          .domStorageAccess(true)
          .onPageBegin(() => {
            this.loadState = 'loading';
            this.failureMessage = '';
          })
          .onPageEnd(() => {
            if (this.loadState !== 'error') this.loadState = 'loaded';
          })
          .onErrorReceive(() => {
            this.loadState = 'error';
            this.failureMessage = '原文页面加载失败，请检查网络或链接。';
          })
          .width('100%')
          .height(480)
      }
    }
    .width('100%')
    .border({ width: 1, color: ColorTokens.border })
    .borderRadius(DemoAliasTokens.radiusMd)
    .backgroundColor(DemoAliasTokens.surface)
    .clip(true)
  }
}

@Component
export struct RssOriginalPage {
  @StorageProp(RssSelectionProjection.K_TITLE) selectedTitle: string = '';
  @StorageProp(RssSelectionProjection.K_DESCRIPTION) selectedDescription: string = '';
  @StorageProp(RssSelectionProjection.K_AUTHOR) selectedAuthor: string = '';
  @StorageProp(RssSelectionProjection.K_DATE) selectedDate: string = '';
  @StorageProp(RssSelectionProjection.K_LINK) selectedLink: string = '';
  @StorageProp(RssSelectionProjection.K_SUBSCRIPTION_ID) selectedSubscriptionId: string = '';

  private hasSelection(): boolean {
    return this.selectedTitle.length > 0 || this.selectedDescription.length > 0 || this.selectedLink.length > 0;
  }

  private meta(): string {
    const values: string[] = [];
    if (this.selectedAuthor.length > 0) values.push(this.selectedAuthor);
    if (this.selectedDate.length > 0) values.push(this.selectedDate);
    if (this.selectedSubscriptionId.length > 0) values.push(`订阅：${this.selectedSubscriptionId}`);
    return values.join(' · ');
  }

  build() {
    Column() {
      RssOriginalPreviewHeader({ title: this.selectedTitle, meta: this.meta() })
      if (!this.hasSelection()) {
        Text('未选择由 Core 返回的 RSS 条目，无法加载原文。')
          .fontSize(13)
          .fontColor(ColorTokens.muted)
          .width('100%')
          .padding(16)
          .margin({ top: 12 })
          .border({ width: 1, color: ColorTokens.border })
          .borderRadius(DemoAliasTokens.radiusMd)
      } else {
        RssOriginalWebSurface({ url: this.selectedLink })
          .margin({ top: 12 })
      }
      Text('返回 RSS 详情')
        .fontSize(13)
        .fontWeight(850)
        .fontColor(ColorTokens.primaryDark)
        .height(42)
        .width('100%')
        .textAlign(TextAlign.Center)
        .borderRadius(DemoAliasTokens.radiusPill)
        .backgroundColor(ColorTokens.metaBg)
        .margin({ top: 12 })
        .onClick(() => ReaderUiStore.dispatch({ type: 'route-push', id: 'rss-detail' }))
    }
    .width('100%')
  }
}

// Compatibility route retained by the Reader UI contract. It now renders the
// same in-app WebView rather than claiming an unavailable external browser.
@Component
export struct RssOriginalBrowserPage {
  build() {
    RssOriginalPage()
  }
}

@Component
struct RssCoreContractNotice {
  @Prop title: string = '';
  @Prop message: string = '';

  build() {
    Column() {
      Text(this.title)
        .fontSize(17)
        .fontWeight(800)
        .fontColor(ColorTokens.ink)
      Text(this.message)
        .fontSize(13)
        .lineHeight(20)
        .fontColor(ColorTokens.muted)
        .margin({ top: 8 })
      Text('前往订阅管理')
        .fontSize(13)
        .fontWeight(800)
        .fontColor(DemoAliasTokens.onPrimary)
        .height(40)
        .padding({ left: 18, right: 18 })
        .borderRadius(DemoAliasTokens.radiusPill)
        .backgroundColor(ColorTokens.primary)
        .margin({ top: 14 })
        .onClick(() => ReaderUiStore.dispatch({ type: 'route-push', id: 'rss-subscription-management' }))
    }
    .width('100%')
    .padding(14)
    .border({ width: 1, color: ColorTokens.border })
    .borderRadius(DemoAliasTokens.radiusMd)
    .backgroundColor(DemoAliasTokens.surface)
    .alignItems(HorizontalAlign.Start)
  }
}

// The Reader UI demo has a favorites page, but the currently integrated Core
// RSS surface exposes subscriptions/items/read state only.  Never reuse the
// all-items projection here: doing so would present every article as a saved
// favorite.  This remains a visible, actionable route instead of a blank
// compatibility screen until Core publishes a favorites contract.
@Component
export struct RssFavoritesUnavailablePage {
  build() {
    Column() {
      RssCoreContractNotice({
        title: 'RSS 收藏未接入',
        message: '当前 Core 无 RSS 收藏契约，无法判断哪些条目已收藏，也不能把全部 RSS 条目当作收藏显示。可在订阅管理中维护真实订阅源。',
      })
    }
    .width('100%')
  }
}

@Component
export struct RssFavoriteGroupsPage {
  build() {
    Column() {
      RssCoreContractNotice({
        title: 'RSS 收藏分组未接入',
        message: '当前 Core 无 RSS 收藏分组契约，无法显示或保存演示分组。可在订阅管理中维护真实订阅源。',
      })
    }
    .width('100%')
  }
}

@Component
export struct RssSourceGroupsPage {
  build() {
    Column() {
      RssCoreContractNotice({
        title: 'RSS 订阅源分组未接入',
        message: '当前 Core 无 RSS 订阅源分组契约，不能伪造分组、新增或保存成功。真实订阅可在订阅管理中维护。',
      })
    }
    .width('100%')
  }
}

@Component
export struct RssSourceImportPage {
  @Prop message: string = '从 OPML 或 URL 导入。';

  build() {
    Column() {
      RssCoreContractNotice({
        title: 'RSS 批量导入未接入',
        message: `${this.message} 当前 Core 无 RSS 批量导入契约，不能把 OPML、剪贴板或 URL 列表展示为已可导入。请在订阅管理中逐个添加真实 Feed URL。`,
      })
    }
    .width('100%')
  }
}

@Component
export struct RssSourceEditPage {
  @Prop mode: string = 'edit';
  private titleText(): string {
    return this.mode === 'add'
      ? 'RSS 源添加由订阅管理提供'
      : 'RSS 源编辑由订阅管理提供';
  }

  build() {
    Column() {
      RssCoreContractNotice({
        title: this.titleText(),
        message: '当前 Core 支持逐条添加、编辑、启停和删除订阅源；当前 Core 无 RSS 规则订阅、解析规则、批量分组或 WebView 配置契约，因此不显示伪造的编辑字段或保存成功。',
      })
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}
