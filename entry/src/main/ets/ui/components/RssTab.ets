import { SectionHeader } from './SharedComponents';

interface RssFeedItem {
  source: string;
  title: string;
  summary: string;
  time: string;
  unread: boolean;
}

@Component
export struct RssTab {
  @State feeds: RssFeedItem[] = [
    {
      source: '少数派',
      title: '本周值得读的长文章',
      summary: '应用、效率和数字生活精选。',
      time: '12 分钟前',
      unread: true
    },
    {
      source: '机核',
      title: '从桌游到互动叙事',
      summary: '关于规则、世界观和阅读体验的专题。',
      time: '1 小时前',
      unread: true
    },
    {
      source: 'The Margins',
      title: 'Independent publishing notes',
      summary: '电子书制作、排版和发行观察。',
      time: '昨天',
      unread: false
    }
  ];

  build() {
    Navigation() {
      Scroll() {
        Column() {
          SectionHeader({ title: 'RSS', detail: '订阅更新' })
          RssSummaryCard({ unreadCount: this.feeds.filter((item: RssFeedItem) => item.unread).length })
          ForEach(this.feeds, (item: RssFeedItem) => {
            RssFeedCard({ item })
          }, (item: RssFeedItem) => `${item.source}-${item.title}`)
        }
        .width('100%')
        .padding(16)
      }
      .width('100%')
      .height('100%')
      .backgroundColor('#F5F5F5')
    }
    .title('RSS')
    .titleMode(NavigationTitleMode.Mini)
  }
}

@Component
struct RssSummaryCard {
  @Prop unreadCount: number = 0;

  build() {
    Row() {
      Column() {
        Text('未读')
          .fontSize(12)
          .fontColor('#666666')
        Text(this.unreadCount.toString())
          .fontSize(26)
          .fontWeight(FontWeight.Bold)
          .fontColor('#1A1A1A')
          .margin({ top: 4 })
      }
      .layoutWeight(1)
      .alignItems(HorizontalAlign.Start)

      Text('全部订阅')
        .fontSize(13)
        .fontColor('#007AFF')
    }
    .width('100%')
    .padding(16)
    .backgroundColor('#FFFFFF')
    .borderRadius(8)
    .margin({ bottom: 12 })
  }
}

@Component
struct RssFeedCard {
  @Prop item: RssFeedItem;

  build() {
    Column() {
      Row() {
        Text(this.item.source)
          .fontSize(13)
          .fontColor(this.item.unread ? '#007AFF' : '#777777')
          .layoutWeight(1)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
        Text(this.item.time)
          .fontSize(12)
          .fontColor('#999999')
      }
      .width('100%')

      Text(this.item.title)
        .fontSize(16)
        .fontWeight(this.item.unread ? FontWeight.Medium : FontWeight.Regular)
        .fontColor('#1A1A1A')
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
        .margin({ top: 8 })

      Text(this.item.summary)
        .fontSize(13)
        .fontColor('#666666')
        .lineHeight(20)
        .maxLines(2)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
        .margin({ top: 6 })
    }
    .width('100%')
    .padding(16)
    .backgroundColor('#FFFFFF')
    .borderRadius(8)
    .margin({ bottom: 8 })
  }
}
