// RssComponents — rss skeleton ported from render-runtime.js mainTabRss()
// DOM: .fd-search-entry.fd-rss-search → .fd-rss-mode-row → .fd-rss-source-overview
// → .fd-rss-article-section (header + .fd-rss-article-list).
import { ColorTokens } from '../../contract/generated/ColorTokens';
import { DemoAliasTokens } from '../../contract/generated/DemoAliasTokens';
import { RouteId } from '../../contract/generated/RouteTable';
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
    .scrollBar(BarState.Off)
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
        Text('导入')
          .fontSize(11)
          .fontWeight(850)
          .fontColor(ColorTokens.primaryDark)
          .padding({ left: 9, right: 9, top: 6, bottom: 6 })
          .borderRadius(DemoAliasTokens.radiusPill)
          .backgroundColor(ColorTokens.metaBg)
          .onClick(() => ReaderUiStore.dispatch({ type: 'route-push', id: 'rss-source-import' }))
        Text('新建')
          .fontSize(11)
          .fontWeight(850)
          .fontColor(ColorTokens.primaryDark)
          .padding({ left: 9, right: 9, top: 6, bottom: 6 })
          .borderRadius(DemoAliasTokens.radiusPill)
          .backgroundColor(ColorTokens.metaBg)
          .margin({ left: 6 })
          .onClick(() => ReaderUiStore.dispatch({ type: 'route-push', id: 'rss-source-add' }))
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
  @Prop title: string = '最近未读';
  @Prop actionLabel: string = '查看全部';
  @Prop actionRoute: string = 'rss-all';
  private articles: Array<[string, string, string]> = [
    ['示例条目一', 'Hacker News · 10:18 · 技术', '一个关于技术趋势的摘要内容,值得一读。'],
    ['示例条目二', '阮一峰博客 · 09:30 · 技术', '每周更新的技术博客摘要,涵盖多个主题。'],
    ['示例条目三', '菜鸟教程 · 昨天 · 技术', '一篇关于前端开发的技术文章摘要。'],
  ];

  build() {
    Column() {
      Row() {
        Text(this.title)
          .fontSize(15)
          .fontColor(ColorTokens.ink)
        Blank()
        Text(this.actionLabel)
          .fontSize(11)
          .fontWeight(850)
          .fontColor(ColorTokens.primaryDark)
          .onClick(() => ReaderUiStore.dispatch({ type: 'route-push', id: this.actionRoute as RouteId }))
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

@Component
struct RssSourceStrip {
  private sources: Array<[string, string]> = [
    ['Hacker News', '技术 · 12 未读'],
    ['阮一峰博客', '技术 · 5 未读'],
    ['菜鸟教程', '技术 · 8 未读'],
  ];

  build() {
    Scroll() {
      Row() {
        ForEach(this.sources, (s: [string, string], i: number) => {
          Row() {
            Stack()
              .width(26).height(26)
              .borderRadius(DemoAliasTokens.radiusPill)
              .backgroundColor(ColorTokens.metaBg)
            Column() {
              Text(s[0])
                .fontSize(12)
                .fontColor(ColorTokens.ink)
                .maxLines(1)
                .textOverflow({ overflow: TextOverflow.Ellipsis })
              Text(s[1])
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
        }, (s: [string, string], i: number) => `${s[0]}-${i}`)
      }
    }
    .scrollable(ScrollDirection.Horizontal)
    .scrollBar(BarState.Off)
    .width('100%')
  }
}

@Component
struct RssRefreshLine {
  @Prop text: string = '正在刷新启用订阅源';

  build() {
    Row() {
      Circle()
        .width(14).height(14)
        .fill(ColorTokens.primary)
      Text(this.text)
        .fontSize(12)
        .fontWeight(800)
        .fontColor(ColorTokens.muted)
        .margin({ left: 8 })
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
      RssRefreshLine({ text: '正在刷新启用订阅源和分类入口' })
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
  @Prop title: string = 'github.com/minliny/Reader-UI/releases/latest';
  @Prop meta: string = '来自 GitHub Releases · 已保留 RSS 阅读上下文';

  build() {
    Row() {
      Stack()
        .width(32).height(32)
        .borderRadius(DemoAliasTokens.radiusPill)
        .backgroundColor(ColorTokens.metaBg)
      Column() {
        Text(this.title)
          .fontSize(13)
          .fontColor(ColorTokens.ink)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
        Text(this.meta)
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
    .shadow({ radius: 26, color: DemoAliasTokens.shadowSoftColor, offsetX: 0, offsetY: 8 })
    .alignItems(VerticalAlign.Center)
  }
}

@Component
struct RssWebPreviewCard {
  @Prop title: string = 'Reader UI 前端输入件更新说明';
  @Prop message: string = '这里展示原文网页入口的预览状态。实际 APP 中应打开内置 WebView，并保留返回 RSS 阅读页、复制链接、分享和用浏览器打开。';

  build() {
    Column() {
      Text(this.title)
        .fontSize(17)
        .fontColor(ColorTokens.ink)
        .fontWeight(800)
      Text(this.message)
        .fontSize(13)
        .fontColor(ColorTokens.controlInk)
        .lineHeight(22)
        .margin({ top: 12 })
      Column() {
        Blank().height(12).width('100%').borderRadius(DemoAliasTokens.radiusPill).backgroundColor(ColorTokens.border)
        Blank().height(12).width('78%').borderRadius(DemoAliasTokens.radiusPill).backgroundColor(ColorTokens.border)
        Blank().height(12).width('52%').borderRadius(DemoAliasTokens.radiusPill).backgroundColor(ColorTokens.border)
      }
      .alignItems(HorizontalAlign.Start)
      .margin({ top: 16 })
    }
    .width('100%')
    .height(360)
    .padding({ top: 16, left: 14, right: 14 })
    .border({ width: 1, color: ColorTokens.border })
    .borderRadius(DemoAliasTokens.radiusMd)
    .backgroundColor(DemoAliasTokens.surface)
    .shadow({ radius: 26, color: DemoAliasTokens.shadowSoftColor, offsetX: 0, offsetY: 8 })
    .alignItems(HorizontalAlign.Start)
  }
}

@Component
struct RssActionRow {
  @Prop primary: string = '返回正文';
  @Prop secondary: string = '浏览器打开';

  build() {
    Row() {
      Text(this.primary)
        .fontSize(13)
        .fontWeight(850)
        .fontColor(ColorTokens.primaryDark)
        .height(42)
        .layoutWeight(1)
        .textAlign(TextAlign.Center)
        .borderRadius(DemoAliasTokens.radiusPill)
        .backgroundColor(ColorTokens.metaBg)
      Text(this.secondary)
        .fontSize(13)
        .fontWeight(850)
        .fontColor(DemoAliasTokens.onPrimary)
        .height(42)
        .layoutWeight(1)
        .textAlign(TextAlign.Center)
        .borderRadius(DemoAliasTokens.radiusPill)
        .backgroundColor(ColorTokens.primary)
        .margin({ left: 8 })
    }
    .width('100%')
  }
}

@Component
export struct RssOriginalPage {
  build() {
    Column() {
      RssOriginalPreviewHeader()
      RssWebPreviewCard()
        .margin({ top: 12 })
      RssActionRow({ primary: '返回正文', secondary: '浏览器打开' })
        .margin({ top: 12 })
    }
    .width('100%')
  }
}

@Component
export struct RssOriginalBrowserPage {
  build() {
    Column() {
      RssOriginalPreviewHeader({
        title: '外部浏览器',
        meta: 'github.com/minliny/Reader-UI/releases/latest',
      })
      RssWebPreviewCard({
        title: '即将用浏览器打开',
        message: '这里保留 RSS 阅读上下文，同时把当前原文链接交给系统浏览器。返回应用后仍停留在 RSS 原文页面。',
      })
        .margin({ top: 12 })
      RssActionRow({ primary: '返回原文', secondary: '复制链接' })
        .margin({ top: 12 })
    }
    .width('100%')
  }
}

@Component
struct RssGroupList {
  @Prop kind: string = 'favorite';
  private favoriteGroups: Array<[string, string]> = [
    ['技术文章', '12 篇收藏 · 最近更新 10:18'],
    ['小说连载', '5 篇收藏 · 有 2 条未读'],
    ['稍后阅读', '8 篇收藏 · 手动整理'],
  ];
  private sourceGroups: Array<[string, string]> = [
    ['开源项目', '2 个订阅源 · 默认展开'],
    ['社区', '1 个订阅源 · 有 12 条未读'],
    ['维护', '1 个订阅源 · 需要登录'],
    ['系统', '1 个订阅源 · 已暂停'],
  ];

  build() {
    Column() {
      ForEach(this.kind === 'source' ? this.sourceGroups : this.favoriteGroups, (g: [string, string], i: number) => {
        Row() {
          Stack()
            .width(32).height(32)
            .borderRadius(DemoAliasTokens.radiusPill)
            .backgroundColor(ColorTokens.metaBg)
          Column() {
            Text(g[0])
              .fontSize(14)
              .fontColor(ColorTokens.ink)
            Text(g[1])
              .fontSize(10)
              .fontColor(ColorTokens.muted)
              .margin({ top: 3 })
          }
          .alignItems(HorizontalAlign.Start)
          .layoutWeight(1)
          .margin({ left: 9 })
          Text(i < 3 ? '启用' : '暂停')
            .fontSize(10)
            .fontWeight(850)
            .fontColor(i < 3 ? ColorTokens.primaryDark : ColorTokens.muted)
            .padding({ left: 8, right: 8, top: 5, bottom: 5 })
            .borderRadius(DemoAliasTokens.radiusPill)
            .backgroundColor(ColorTokens.metaBg)
        }
        .width('100%')
        .padding({ top: 10, bottom: 10, left: 10, right: 10 })
        .border(i > 0 ? { width: { top: 1 }, color: ColorTokens.border } : { width: 0 })
        .alignItems(VerticalAlign.Center)
      }, (g: [string, string], i: number) => `${g[0]}-${i}`)
    }
    .width('100%')
    .border({ width: 1, color: ColorTokens.border })
    .borderRadius(DemoAliasTokens.radiusMd)
    .backgroundColor(DemoAliasTokens.surface)
    .shadow({ radius: 26, color: DemoAliasTokens.shadowSoftColor, offsetX: 0, offsetY: 8 })
  }
}

@Component
struct RssRuleActionRow {
  @Prop first: string = '新增分组';
  @Prop second: string = '重命名';

  build() {
    Row() {
      Text(this.first)
        .fontSize(12)
        .fontWeight(850)
        .fontColor(ColorTokens.controlInk)
        .height(34)
        .padding({ left: 12, right: 12 })
        .borderRadius(DemoAliasTokens.radiusPill)
        .backgroundColor(ColorTokens.metaBg)
      Text(this.second)
        .fontSize(12)
        .fontWeight(850)
        .fontColor(ColorTokens.controlInk)
        .height(34)
        .padding({ left: 12, right: 12 })
        .borderRadius(DemoAliasTokens.radiusPill)
        .backgroundColor(ColorTokens.metaBg)
        .margin({ left: 8 })
    }
    .width('100%')
  }
}

@Component
export struct RssFavoriteGroupsPage {
  build() {
    Column() {
      RssGroupList({ kind: 'favorite' })
      RssRuleActionRow({ first: '新增收藏分组', second: '清空已读收藏' })
        .margin({ top: 10 })
      RssActionRow({ primary: '返回 RSS', secondary: '保存排序' })
        .margin({ top: 12 })
    }
    .width('100%')
  }
}

@Component
export struct RssSourceGroupsPage {
  build() {
    Column() {
      RssGroupList({ kind: 'source' })
      RssRuleActionRow({ first: '新增分组', second: '重命名' })
        .margin({ top: 10 })
      RssActionRow({ primary: '取消', secondary: '保存' })
        .margin({ top: 12 })
    }
    .width('100%')
  }
}

@Component
export struct RssSourceImportPage {
  build() {
    Column() {
      Column() {
        Text('导入订阅源')
          .fontSize(17)
          .fontWeight(800)
          .fontColor(ColorTokens.ink)
        Text('从 OPML 文件、订阅源 URL 或剪贴板批量导入 RSS 源。导入前会预览分组、入口数和重复项。')
          .fontSize(12)
          .fontColor(ColorTokens.muted)
          .lineHeight(20)
          .margin({ top: 8 })
      }
      .width('100%')
      .padding(14)
      .border({ width: 1, color: ColorTokens.border })
      .borderRadius(DemoAliasTokens.radiusMd)
      .backgroundColor(DemoAliasTokens.surface)
      .shadow({ radius: 26, color: DemoAliasTokens.shadowSoftColor, offsetX: 0, offsetY: 8 })
      .alignItems(HorizontalAlign.Start)

      Column() {
        ForEach([
          ['OPML 文件', '从本地文件导入多个订阅源和分组'],
          ['订阅源 URL', '输入单个 feed 地址并立即测试'],
          ['剪贴板', '识别复制的 OPML、JSON 或 URL 列表'],
        ], (o: string[], i: number) => {
          Row() {
            Stack()
              .width(32).height(32)
              .borderRadius(DemoAliasTokens.radiusPill)
              .backgroundColor(ColorTokens.metaBg)
            Column() {
              Text(o[0])
                .fontSize(14)
                .fontColor(ColorTokens.ink)
              Text(o[1])
                .fontSize(10)
                .fontColor(ColorTokens.muted)
                .margin({ top: 3 })
            }
            .alignItems(HorizontalAlign.Start)
            .layoutWeight(1)
            .margin({ left: 9 })
            Image($r('app.media.reader_icon_more_dark')).width(18).height(18)
          }
          .width('100%')
          .padding({ top: 10, bottom: 10, left: 10, right: 10 })
          .border(i > 0 ? { width: { top: 1 }, color: ColorTokens.border } : { width: 0 })
        }, (o: string[], i: number) => `${o[0]}-${i}`)
      }
      .width('100%')
      .margin({ top: 12 })
      .border({ width: 1, color: ColorTokens.border })
      .borderRadius(DemoAliasTokens.radiusMd)
      .backgroundColor(DemoAliasTokens.surface)
      .shadow({ radius: 26, color: DemoAliasTokens.shadowSoftColor, offsetX: 0, offsetY: 8 })

      RssActionRow({ primary: '取消', secondary: '选择导入方式' })
        .margin({ top: 12 })
    }
    .width('100%')
  }
}
