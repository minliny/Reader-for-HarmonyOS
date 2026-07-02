import { SectionHeader } from './SharedComponents';

interface DiscoverBookItem {
  title: string;
  author: string;
  tag: string;
  score: string;
  accent: string;
}

interface DiscoverCategoryItem {
  name: string;
  count: string;
}

@Component
export struct DiscoverTab {
  @State picks: DiscoverBookItem[] = [
    { title: '银河边界', author: '陈楸帆', tag: '科幻', score: '9.1', accent: '#365C8D' },
    { title: '长安的荔枝', author: '马伯庸', tag: '历史', score: '8.6', accent: '#8B5A2B' },
    { title: '芯片简史', author: '汪波', tag: '科技', score: '8.4', accent: '#2E7D68' }
  ];
  @State categories: DiscoverCategoryItem[] = [
    { name: '科幻', count: '128 本' },
    { name: '推理', count: '96 本' },
    { name: '历史', count: '84 本' },
    { name: '技术', count: '52 本' }
  ];

  build() {
    Navigation() {
      Scroll() {
        Column() {
          SectionHeader({ title: '发现', detail: '今日推荐' })
          if (this.picks.length > 0) {
            DiscoverFeatureCard({ item: this.picks[0] })
          }

          SectionHeader({ title: '热门分类', detail: '按题材快速浏览' })
          Grid() {
            ForEach(this.categories, (item: DiscoverCategoryItem) => {
              GridItem() {
                CategoryTile({ item })
              }
            }, (item: DiscoverCategoryItem) => item.name)
          }
          .columnsTemplate('1fr 1fr')
          .columnsGap(8)
          .rowsGap(8)
          .width('100%')
          .height(156)
          .margin({ bottom: 16 })

          SectionHeader({ title: '正在上新', detail: '精选书单' })
          ForEach(this.picks, (item: DiscoverBookItem) => {
            DiscoverBookCard({ item })
          }, (item: DiscoverBookItem) => item.title)
        }
        .width('100%')
        .padding(16)
      }
      .width('100%')
      .height('100%')
      .backgroundColor('#F5F5F5')
    }
    .title('发现')
    .titleMode(NavigationTitleMode.Mini)
  }
}

@Component
struct DiscoverFeatureCard {
  @Prop item: DiscoverBookItem;

  build() {
    Column() {
      Row() {
        Column() {
          Text(this.item.tag)
            .fontSize(12)
            .fontColor('#EAF1FF')
          Text(this.item.title)
            .fontSize(22)
            .fontWeight(FontWeight.Bold)
            .fontColor('#FFFFFF')
            .margin({ top: 10 })
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
          Text(this.item.author)
            .fontSize(13)
            .fontColor('#EAF1FF')
            .margin({ top: 6 })
        }
        .layoutWeight(1)
        .alignItems(HorizontalAlign.Start)

        Column() {
          Text(this.item.score)
            .fontSize(24)
            .fontWeight(FontWeight.Bold)
            .fontColor('#FFFFFF')
          Text('评分')
            .fontSize(11)
            .fontColor('#EAF1FF')
            .margin({ top: 2 })
        }
        .width(70)
        .height(70)
        .justifyContent(FlexAlign.Center)
        .alignItems(HorizontalAlign.Center)
        .backgroundColor('#22FFFFFF')
        .borderRadius(8)
      }
      .width('100%')
    }
    .width('100%')
    .padding(18)
    .backgroundColor(this.item.accent)
    .borderRadius(8)
    .margin({ bottom: 16 })
  }
}

@Component
struct CategoryTile {
  @Prop item: DiscoverCategoryItem;

  build() {
    Column() {
      Text(this.item.name)
        .fontSize(16)
        .fontWeight(FontWeight.Medium)
        .fontColor('#1A1A1A')
      Text(this.item.count)
        .fontSize(12)
        .fontColor('#666666')
        .margin({ top: 6 })
    }
    .width('100%')
    .height('100%')
    .padding(14)
    .alignItems(HorizontalAlign.Start)
    .justifyContent(FlexAlign.Center)
    .backgroundColor('#FFFFFF')
    .borderRadius(8)
  }
}

@Component
struct DiscoverBookCard {
  @Prop item: DiscoverBookItem;

  build() {
    Row() {
      Column() {
        Text(this.item.tag)
          .fontSize(11)
          .fontColor('#FFFFFF')
      }
      .width(50)
      .height(62)
      .justifyContent(FlexAlign.Center)
      .alignItems(HorizontalAlign.Center)
      .backgroundColor(this.item.accent)
      .borderRadius(8)
      .margin({ right: 12 })

      Column() {
        Text(this.item.title)
          .fontSize(16)
          .fontWeight(FontWeight.Medium)
          .fontColor('#1A1A1A')
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
        Text(this.item.author)
          .fontSize(13)
          .fontColor('#666666')
          .margin({ top: 4 })
      }
      .layoutWeight(1)

      Text(this.item.score)
        .fontSize(13)
        .fontColor('#1B7F4A')
        .margin({ left: 8 })
    }
    .width('100%')
    .padding(12)
    .backgroundColor('#FFFFFF')
    .borderRadius(8)
    .margin({ bottom: 8 })
  }
}
