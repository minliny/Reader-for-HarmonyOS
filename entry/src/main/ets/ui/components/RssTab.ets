import { ReaderUiIcon } from './SharedComponents';

class RssSourceItem {
  name: string = '';
  group: string = '';
  unread: number = 0;
  status: string = '';
  tone: string = '';
  enabled: boolean = true;
  categories: number = 0;
  articleStyle: string = '';
  rule: string = '';
}

class RssArticleItem {
  title: string = '';
  source: string = '';
  time: string = '';
  group: string = '';
  desc: string = '';
  unread: boolean = false;
  starred: boolean = false;
}

@Component
export struct RssTab {
  private sources: RssSourceItem[] = [
    { name: 'GitHub Releases', group: '开源项目', unread: 6, status: '正常', tone: 'good', enabled: true, categories: 3, articleStyle: '列表', rule: '默认 RSS' },
    { name: '阅读器版本讨论', group: '社区', unread: 12, status: '有更新', tone: 'good', enabled: true, categories: 4, articleStyle: '图文', rule: '自定义列表' },
    { name: '书源维护公告', group: '维护', unread: 2, status: '需登录', tone: 'warn', enabled: true, categories: 2, articleStyle: '紧凑', rule: '正文规则' },
    { name: '本地系统通知', group: '系统', unread: 0, status: '暂停', tone: 'muted', enabled: false, categories: 1, articleStyle: '列表', rule: '单 URL' }
  ];
  private articles: RssArticleItem[] = [
    { title: 'Reader UI 前端输入件更新说明', source: 'GitHub Releases', time: '10:18', group: '开源项目', desc: '新增发现页状态路由、阅读控制层响应式约束，并补充 RSS 页面结构规划。', unread: true, starred: true },
    { title: '订阅源规则解析失败排查', source: '书源维护公告', time: '09:52', group: '维护', desc: '部分订阅源返回 HTML 而不是 XML，已建议检查 Cookie、登录态和正文提取规则。', unread: true, starred: false },
    { title: 'Legado 订阅源配置经验整理', source: '阅读器版本讨论', time: '昨天', group: '社区', desc: '社区整理了单 URL 源、分类入口、文章样式和 WebView 正文处理的常见配置方式。', unread: true, starred: false }
  ];

  build() {
    Column() {
      RssTopBar({ enabledCount: 3 })

      Scroll() {
        Column() {
          RssSearchEntry()
          RssModeRow()
          RssSourceOverview({ sources: this.sources })
          RssArticleSection({ articles: this.articles })
        }
        .width('100%')
        .padding({ left: 20, right: 20, top: 8, bottom: 116 })
      }
      .width('100%')
      .layoutWeight(1)
      .scrollBar(BarState.Off)
    }
    .width('100%')
    .height('100%')
    .backgroundColor('#F4EFE8')
  }
}

@Component
struct RssTopBar {
  @Prop enabledCount: number = 0;

  build() {
    Row() {
      Text('RSS')
        .fontSize(29)
        .fontWeight(FontWeight.Bold)
        .fontFamily('serif')
        .fontColor('#201B16')
        .layoutWeight(1)

      Row() {
        Circle({ width: 8, height: 8 })
          .fill('#2E7D68')
        Column() {
          Text(`${this.enabledCount} 个启用源`)
            .fontSize(11)
            .fontWeight(FontWeight.Bold)
            .fontColor('#201B16')
            .maxLines(1)
          Text('· 10:18 更新')
            .fontSize(10)
            .fontColor('#756F69')
            .maxLines(1)
        }
        .margin({ left: 6, right: 6 })
        ReaderUiIcon({ iconName: 'refresh', tone: 'primary', iconSize: 18 })
      }
      .height(36)
      .padding({ left: 12, right: 12 })
      .alignItems(VerticalAlign.Center)
      .backgroundColor('#FFFCF8')
      .border({ width: 1, color: '#D8CCBC' })
      .borderRadius(18)
      .margin({ right: 8 })

      Row() {
        ReaderUiIcon({ iconName: 'list', tone: 'primary', iconSize: 18 })
        Text('管理')
          .fontSize(12)
          .fontWeight(FontWeight.Bold)
          .fontColor('#274F66')
          .margin({ left: 5 })
      }
      .height(36)
      .padding({ left: 12, right: 12 })
      .alignItems(VerticalAlign.Center)
      .backgroundColor('#FFFCF8')
      .border({ width: 1, color: '#D8CCBC' })
      .borderRadius(18)
    }
    .width('100%')
    .height(62)
    .padding({ left: 20, right: 20, top: 6 })
    .alignItems(VerticalAlign.Center)
  }
}

@Component
struct RssSearchEntry {
  build() {
    Row() {
      ReaderUiIcon({ iconName: 'search', tone: 'muted', iconSize: 18 })
      Text('搜索订阅源、文章标题或分组')
        .fontSize(13)
        .fontColor('#756F69')
        .fontWeight(FontWeight.Bold)
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
        .margin({ left: 8 })
    }
    .width('100%')
    .height(42)
    .padding({ left: 12, right: 12 })
    .alignItems(VerticalAlign.Center)
    .backgroundColor('#FFFCF8')
    .border({ width: 1, color: '#D8CCBC' })
    .borderRadius(21)
    .shadow({ radius: 10, color: '#34261A14', offsetX: 0, offsetY: 3 })
  }
}

@Component
struct RssModeRow {
  private modes: string[] = ['源列表', '全部', '收藏', '规则订阅'];

  build() {
    Row() {
      ForEach(this.modes, (mode: string) => {
        Text(mode)
          .height(30)
          .padding({ left: 10, right: 10 })
          .fontSize(12)
          .fontWeight(FontWeight.Bolder)
          .fontColor(mode === '源列表' ? '#FFFFFF' : '#564D44')
          .textAlign(TextAlign.Center)
          .backgroundColor(mode === '源列表' ? '#366179' : '#D6EEE8DF')
          .borderRadius(15)
          .margin({ right: 6 })
      }, (mode: string) => mode)
    }
    .width('100%')
    .margin({ top: 7, bottom: 7 })
  }
}

@Component
struct RssSourceOverview {
  @Prop sources: RssSourceItem[] = [];

  build() {
    Column() {
      Row() {
        Text('订阅源')
          .fontSize(15)
          .fontWeight(FontWeight.Bold)
          .fontColor('#201B16')
          .layoutWeight(1)
        RssSmallPill({ label: '导入', iconName: 'upload' })
        RssSmallPill({ label: '新建', iconName: 'add' })
      }
      .width('100%')
      .height(44)
      .padding({ left: 10, right: 10 })
      .alignItems(VerticalAlign.Center)
      .backgroundColor('#FFFCF8')
      .border({ width: 1, color: '#4DB4A697' })
      .borderRadius(8)

      RssFilterControl()
        .margin({ top: 8 })

      Column() {
        ForEach(this.sources, (source: RssSourceItem, index: number) => {
          RssSourceRow({ source, topDivider: index > 0 })
        }, (source: RssSourceItem) => source.name)
      }
      .width('100%')
      .backgroundColor('#FFFCF8')
      .border({ width: 1, color: '#4DB4A697' })
      .borderRadius(8)
      .clip(true)
      .margin({ top: 8 })
    }
    .width('100%')
  }
}

@Component
struct RssSmallPill {
  @Prop label: string = '';
  @Prop iconName: string = '';

  build() {
    Row() {
      ReaderUiIcon({ iconName: this.iconName, tone: 'muted', iconSize: 15 })
      Text(this.label)
        .fontSize(11)
        .fontWeight(FontWeight.Bolder)
        .fontColor('#554C43')
        .margin({ left: 5 })
    }
    .height(30)
    .padding({ left: 9, right: 9 })
    .alignItems(VerticalAlign.Center)
    .backgroundColor('#D6EEE8DF')
    .borderRadius(15)
    .margin({ left: 6 })
  }
}

@Component
struct RssFilterControl {
  build() {
    Row() {
      ReaderUiIcon({ iconName: 'filter', tone: 'dark', iconSize: 16 })
      Text('筛选')
        .fontSize(12)
        .fontWeight(FontWeight.Bolder)
        .fontColor('#3F372F')
        .margin({ left: 7 })

      Blank()

      Text('全部')
        .fontSize(11)
        .fontWeight(FontWeight.Bolder)
        .fontColor('#756F69')
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis })

      ReaderUiIcon({ iconName: 'chevron', tone: 'dark', iconSize: 14 })
        .rotate({ angle: 90 })
        .margin({ left: 7 })
    }
    .width('100%')
    .height(34)
    .padding({ left: 10, right: 10 })
    .alignItems(VerticalAlign.Center)
    .backgroundColor('#E6FFFCF8')
    .border({ width: 1, color: '#7AB4A697' })
    .borderRadius(8)
  }
}

@Component
struct RssSourceRow {
  @Prop source: RssSourceItem;
  @Prop topDivider: boolean = false;

  build() {
    Row() {
      Row() {
        ReaderUiIcon({ iconName: 'rss', tone: this.source.enabled ? 'primary' : 'muted', iconSize: 18 })
      }
      .width(32)
      .height(32)
      .justifyContent(FlexAlign.Center)
      .alignItems(VerticalAlign.Center)
      .backgroundColor('#1F366179')
      .borderRadius(16)

      Column() {
        Text(this.source.name)
          .fontSize(13)
          .lineHeight(16)
          .fontWeight(FontWeight.Bold)
          .fontColor('#201B16')
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
          .width('100%')
        Text(`${this.source.group} · ${this.source.categories} 个入口 · ${this.source.articleStyle} · ${this.source.rule}`)
          .fontSize(10)
          .lineHeight(13)
          .fontColor('#756F69')
          .fontWeight(FontWeight.Medium)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
          .margin({ top: 3 })
          .width('100%')
      }
      .layoutWeight(1)
      .margin({ left: 8, right: 8 })
      .alignItems(HorizontalAlign.Start)

      Text(this.source.unread.toString())
        .fontSize(16)
        .fontWeight(FontWeight.Bold)
        .fontColor('#274F66')
        .width(28)
        .textAlign(TextAlign.Center)

      Circle({ width: 8, height: 8 })
        .fill(this.source.tone === 'warn' ? '#F48B13' : this.source.tone === 'muted' ? '#A9A199' : '#2E7D68')
    }
    .width('100%')
    .height(62)
    .padding({ left: 10, right: 10, top: 9, bottom: 9 })
    .alignItems(VerticalAlign.Center)
    .opacity(this.source.enabled ? 1 : 0.62)
    .border({ width: { top: this.topDivider ? 1 : 0 }, color: '#33B4A697' })
  }
}

@Component
struct RssArticleSection {
  @Prop articles: RssArticleItem[] = [];

  build() {
    Column() {
      Row() {
        Text('最近未读')
          .fontSize(15)
          .fontWeight(FontWeight.Bold)
          .fontColor('#201B16')
          .layoutWeight(1)
        RssSmallPill({ label: '查看全部', iconName: 'list' })
      }
      .width('100%')
      .height(38)
      .alignItems(VerticalAlign.Center)
      .margin({ top: 8 })

      Column() {
        ForEach(this.articles, (article: RssArticleItem, index: number) => {
          RssArticleRow({ article, topDivider: index > 0 })
        }, (article: RssArticleItem) => article.title)
      }
      .width('100%')
      .backgroundColor('#FFFCF8')
      .border({ width: 1, color: '#4DB4A697' })
      .borderRadius(8)
      .clip(true)
    }
    .width('100%')
  }
}

@Component
struct RssArticleRow {
  @Prop article: RssArticleItem;
  @Prop topDivider: boolean = false;

  build() {
    Row() {
      Circle({ width: 8, height: 8 })
        .fill(this.article.unread ? '#366179' : '#C8BDB0')
        .margin({ right: 8 })

      Column() {
        Text(this.article.title)
          .fontSize(13)
          .lineHeight(16)
          .fontWeight(FontWeight.Bold)
          .fontColor('#201B16')
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
          .width('100%')
        Text(`${this.article.source} · ${this.article.time} · ${this.article.group}`)
          .fontSize(10)
          .lineHeight(13)
          .fontColor('#756F69')
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
          .margin({ top: 4 })
          .width('100%')
        Text(this.article.desc)
          .fontSize(11)
          .fontColor('#5C554D')
          .lineHeight(16)
          .maxLines(2)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
          .margin({ top: 5 })
          .width('100%')
      }
      .layoutWeight(1)
      .alignItems(HorizontalAlign.Start)

      ReaderUiIcon({ iconName: this.article.starred ? 'bookmark' : 'chevron', tone: 'muted', iconSize: 18 })
    }
    .width('100%')
    .height(88)
    .padding({ left: 12, right: 12, top: 10, bottom: 10 })
    .alignItems(VerticalAlign.Top)
    .border({ width: { top: this.topDivider ? 1 : 0 }, color: '#33B4A697' })
  }
}
