// RssComponents — rss skeleton ported from render-runtime.js mainTabRss()
// DOM: .fd-search-entry.fd-rss-search → .fd-rss-mode-row → .fd-rss-source-overview
// → .fd-rss-article-section (header + .fd-rss-article-list).
import { ColorTokens } from '../../contract/generated/ColorTokens';
import { DemoAliasTokens } from '../../contract/generated/DemoAliasTokens';
import { ReaderUiStore } from '../store/ReaderUiStore';

// .fd-search-entry: min-height 44, pill, 24 icon + 14 muted, padding 0 14.
@Component
export struct RssSearchEntry {
  build() {
    Row() {
      Image($r('app.media.ui_icon_search_dark')).width(24).height(24)
      Text('搜索订阅源、文章标题或分组')
        .fontSize(14)
        .fontColor(ColorTokens.muted)
        .margin({ left: 10 })
    }
    .width('100%')
    .height(44)
    .padding({ left: 14, right: 14 })
    .borderRadius(DemoAliasTokens.radiusPill)
    .backgroundColor(DemoAliasTokens.surface)
    .border({ width: 1, color: ColorTokens.border })
    .alignItems(VerticalAlign.Center)
  }
}

// .fd-rss-mode-row: 4 chips (源列表/全部/收藏/规则订阅), min 30, pill, 12/850.
@Component
export struct RssModeRow {
  private modes: string[] = ['源列表', '全部', '收藏', '规则订阅'];
  private active: string = '全部';

  build() {
    Scroll() {
      Row() {
        ForEach(this.modes, (m: string) => {
          Text(m)
            .fontSize(12)
            .fontWeight(850)
            .fontColor(m === this.active ? DemoAliasTokens.onPrimary : ColorTokens.controlInk)
            .backgroundColor(m === this.active ? ColorTokens.primary : ColorTokens.metaBg)
            .height(30)
            .padding({ left: 10, right: 10 })
            .borderRadius(DemoAliasTokens.radiusPill)
            .margin({ right: 6 })
        }, (m: string) => m)
      }
    }
    .scrollable(ScrollDirection.Horizontal)
    .width('100%')
  }
}

// .fd-rss-source-overview (simplified): card — header (h2 "订阅源" + count) +
//   source-overview-list rows (icon 32 + name/meta + count + badge).
@Component
export struct RssSourceOverview {
  private sources: Array<[string, string, number]> = [
    ['Hacker News', '技术 · 10 入口', 12],
    ['阮一峰博客', '技术 · 1 入口', 5],
    ['菜鸟教程', '技术 · 3 入口', 8],
  ];

  build() {
    Column() {
      Row() {
        Text('订阅源')
          .fontSize(15)
          .fontColor(ColorTokens.ink)
        Blank()
        Text('25 个')
          .fontSize(12)
          .fontColor(ColorTokens.muted)
      }
      .width('100%')
      .margin({ bottom: 8 })
      ForEach(this.sources, (s: [string, string, number], i: number) => {
        Row() {
          Stack()
            .width(32).height(32)
            .borderRadius(DemoAliasTokens.radiusPill)
            .backgroundColor(ColorTokens.metaBg)
          Column() {
            Text(s[0])
              .fontSize(13)
              .fontColor(ColorTokens.ink)
            Text(s[1])
              .fontSize(10)
              .fontColor(ColorTokens.muted)
              .margin({ top: 3 })
          }
          .alignItems(HorizontalAlign.Start)
          .layoutWeight(1)
          .margin({ left: 8 })
          Text(`${s[2]}`)
            .fontSize(16)
            .fontWeight(900)
            .fontColor(ColorTokens.primaryDark)
        }
        .width('100%')
        .padding({ top: 9, bottom: 9, left: 10, right: 10 })
        .border(i > 0 ? { width: { top: 1 }, color: ColorTokens.border } : { width: 0 })
        .alignItems(VerticalAlign.Center)
      }, (s: [string, string, number], i: number) => `${s[0]}-${i}`)
    }
    .width('100%')
    .padding(10)
    .border({ width: 1, color: ColorTokens.border })
    .borderRadius(DemoAliasTokens.radiusMd)
    .backgroundColor(DemoAliasTokens.surface)
    .shadow({ radius: 26, color: DemoAliasTokens.shadowSoftColor, offsetX: 0, offsetY: 8 })
  }
}

// .fd-rss-article-section: header (h2 "最近未读" 15 + "查看全部" button) +
//   .fd-rss-article-list > .fd-rss-article-row (min 84, grid 10/1fr/18, border-top,
//   i 7 dot, strong 13, small 10, p 11 clamp 2).
@Component
export struct RssArticleSection {
  private articles: Array<[string, string, string]> = [
    ['示例条目一', 'Hacker News · 10:18 · 技术', '一个关于技术趋势的摘要内容,值得一读。'],
    ['示例条目二', '阮一峰博客 · 09:30 · 技术', '每周更新的技术博客摘要,涵盖多个主题。'],
    ['示例条目三', '菜鸟教程 · 昨天 · 技术', '一篇关于前端开发的技术文章摘要。'],
  ];

  build() {
    Column() {
      Row() {
        Text('最近未读')
          .fontSize(15)
          .fontColor(ColorTokens.ink)
        Blank()
        Text('查看全部')
          .fontSize(11)
          .fontWeight(850)
          .fontColor(ColorTokens.primaryDark)
      }
      .width('100%')
      .margin({ bottom: 6 })
      ForEach(this.articles, (a: [string, string, string], i: number) => {
        Row() {
          Circle().width(7).height(7).fill(ColorTokens.primary)
          Column() {
            Text(a[0])
              .fontSize(13)
              .fontColor(ColorTokens.ink)
            Text(a[1])
              .fontSize(10)
              .fontColor(ColorTokens.muted)
              .margin({ top: 4 })
            Text(a[2])
              .fontSize(11)
              .fontColor(ColorTokens.muted)
              .maxLines(2)
              .textOverflow({ overflow: TextOverflow.Ellipsis })
              .margin({ top: 5 })
          }
          .alignItems(HorizontalAlign.Start)
          .layoutWeight(1)
          .margin({ left: 8 })
          Image($r('app.media.reader_icon_more_dark')).width(18).height(18)
        }
        .width('100%')
        .padding({ top: 10, bottom: 10, left: 12, right: 12 })
        .border(i > 0 ? { width: { top: 1 }, color: ColorTokens.border } : { width: 0 })
        .alignItems(VerticalAlign.Center)
        .onClick(() => ReaderUiStore.dispatch({ type: 'route-push', id: 'rss-detail' }))
      }, (a: [string, string, string], i: number) => `${a[0]}-${i}`)
    }
    .width('100%')
  }
}
