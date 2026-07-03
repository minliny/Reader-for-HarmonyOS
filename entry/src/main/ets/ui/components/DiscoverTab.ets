import { ReaderUiIcon } from './SharedComponents';

class DiscoverBookItem {
  title: string = '';
  author: string = '';
  kind: string = '';
  latest: string = '';
  intro: string = '';
  coverKey: string = '';
  inShelf: boolean = false;
}

@Component
export struct DiscoverTab {
  private entries: string[] = ['排行榜', '分类', '完本', '最新', '书单'];
  private books: DiscoverBookItem[] = [
    {
      title: '长夜余火',
      author: '爱潜水的乌贼',
      kind: '科幻 · 连载',
      latest: '最新：第 32 章 雨夜',
      intro: '雨声在窗外连成一片，旧世界的线索在夜里慢慢浮出。',
      coverKey: 'longNight',
      inShelf: true
    },
    {
      title: '诡秘之主',
      author: '爱潜水的乌贼',
      kind: '奇幻 · 完本',
      latest: '最新：番外已整理',
      intro: '蒸汽、塔罗与旧日秘密交织，适合继续追读。',
      coverKey: 'mysteryLord',
      inShelf: true
    },
    {
      title: '三体',
      author: '刘慈欣',
      kind: '科幻 · 完本',
      latest: '最新：三部曲合集',
      intro: '文明在宇宙暗处相互凝视，微小选择带来巨大回声。',
      coverKey: 'threeBody',
      inShelf: false
    },
    {
      title: '明朝那些事儿',
      author: '当年明月',
      kind: '历史 · 完本',
      latest: '最新：全集校对',
      intro: '用更轻松的方式重新翻开明朝人物与权力线索。',
      coverKey: 'brightMoon',
      inShelf: false
    },
    {
      title: '纸上城市',
      author: '默认分组',
      kind: '都市 · 连载',
      latest: '最新：第 12 章',
      intro: '纸页边缘折起，城市的名字开始变化。',
      coverKey: 'renjian',
      inShelf: false
    }
  ];

  build() {
    Column() {
      DiscoverTopBar()

      Scroll() {
        Column() {
          DiscoverSourceBar()
          DiscoverEntryRow({ entries: this.entries })
          DiscoverFilterRow()
          Text('排行榜')
            .fontSize(15)
            .lineHeight(18.75)
            .fontWeight(FontWeight.Bold)
            .fontColor('#201B16')
            .width('100%')
            .padding({ left: 2 })

          DiscoverBookList({ books: this.books })
        }
        .width('100%')
        .padding({ left: 19, right: 19, top: 8, bottom: 116 })
      }
      .width('100%')
      .layoutWeight(1)
      .scrollBar(BarState.Off)
    }
    .width('100%')
    .height('100%')
    .backgroundColor('#FFF8F4')
  }
}

@Component
struct DiscoverTopBar {
  build() {
    Row() {
      Text('发现')
        .fontSize(29)
        .fontWeight(FontWeight.Medium)
        .fontFamily('Songti SC')
        .fontColor('#201B16')
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
        .layoutWeight(1)

      Row() {
        ReaderUiIcon({ iconName: 'refresh', tone: 'dark', iconSize: 24 })
      }
      .width(44)
      .height(44)
      .justifyContent(FlexAlign.Center)
      .alignItems(VerticalAlign.Center)
      .borderRadius(22)
      .accessibilityText('刷新')
    }
    .width('100%')
    .height(58)
    .padding({ left: 20, right: 20, top: 6 })
    .margin({ top: 9 })
    .alignItems(VerticalAlign.Center)
  }
}

@Component
struct DiscoverSourceBar {
  build() {
    Row() {
      Row() {
        ReaderUiIcon({ iconName: 'source-stack', tone: 'primary', iconSize: 20 })
      }
      .width(34)
      .height(34)
      .justifyContent(FlexAlign.Center)
      .alignItems(VerticalAlign.Center)
      .backgroundColor('#1A366179')
      .borderRadius(17)

      Column() {
        Text('优书网')
          .fontSize(15)
          .lineHeight(18)
          .fontWeight(FontWeight.Bold)
          .fontColor('#201B16')
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
          .width('100%')
        Text('默认分组 · 已启用发现 · 120ms')
          .fontSize(11)
          .fontColor('#756F69')
          .fontWeight(FontWeight.Medium)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
          .margin({ top: 3 })
          .width('100%')
      }
      .layoutWeight(1)
      .margin({ left: 10, right: 10 })
      .alignItems(HorizontalAlign.Start)

      ReaderUiIcon({ iconName: 'chevron', tone: 'muted', iconSize: 18 })
        .rotate({ angle: 90 })
    }
    .width('100%')
    .height(58)
    .padding({ left: 12, right: 12, top: 10, bottom: 10 })
    .alignItems(VerticalAlign.Center)
    .backgroundColor('#EBFFFCF8')
    .border({ width: 1, color: '#5CB4A697' })
    .borderRadius(8)
    .shadow({ radius: 26, color: '#1A594632', offsetX: 0, offsetY: 8 })
  }
}

@Component
struct DiscoverEntryRow {
  @Prop entries: string[] = [];

  build() {
    Scroll() {
      Row() {
        ForEach(this.entries, (entry: string) => {
          DiscoverChip({ label: entry, active: entry === '排行榜' })
        }, (entry: string) => entry)
      }
      .padding({ right: 1 })
    }
    .scrollable(ScrollDirection.Horizontal)
    .scrollBar(BarState.Off)
    .width('100%')
    .margin({ top: 7 })
  }
}

@Component
struct DiscoverFilterRow {
  build() {
    Row() {
      Row() {
        ReaderUiIcon({ iconName: 'filter', tone: 'dark', iconSize: 16 })
        Text('筛选')
          .fontSize(12)
          .fontWeight(FontWeight.Bolder)
          .fontColor('#3F372F')
          .margin({ left: 7 })

        Blank()

        Text('男频 · 人气')
          .fontSize(11)
          .fontWeight(FontWeight.Bolder)
          .fontColor('#756F69')
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })

        ReaderUiIcon({ iconName: 'chevron', tone: 'dark', iconSize: 14 })
          .rotate({ angle: 90 })
          .margin({ left: 7 })
      }
      .layoutWeight(1)
      .height(34)
      .padding({ left: 10, right: 10 })
      .alignItems(VerticalAlign.Center)
      .backgroundColor('#E6FFFCF8')
      .border({ width: 1, color: '#7AB4A697' })
      .borderRadius(8)

      Row() {
        ReaderUiIcon({ iconName: 'check', tone: 'white', iconSize: 13 })
        Text('应用')
          .fontSize(12)
          .fontWeight(FontWeight.Bolder)
          .fontColor('#FFFFFF')
          .margin({ left: 4 })
      }
      .width(70)
      .height(34)
      .justifyContent(FlexAlign.Center)
      .alignItems(VerticalAlign.Center)
      .backgroundColor('#366179')
      .border({ width: 1, color: '#C72D5D76' })
      .borderRadius(8)
      .shadow({ radius: 14, color: '#38315F78', offsetX: 0, offsetY: 7 })
      .margin({ left: 7 })
    }
    .width('100%')
    .margin({ top: 7, bottom: 7 })
  }
}

@Component
struct DiscoverChip {
  @Prop label: string = '';
  @Prop active: boolean = false;
  @Prop compact: boolean = false;
  @Prop mutedActive: boolean = false;

  build() {
    Text(this.label)
      .height(this.compact ? 30 : 32)
      .padding({ left: this.compact ? 9 : 12, right: this.compact ? 9 : 12 })
      .fontSize(12)
      .fontWeight(FontWeight.Bolder)
      .fontColor(this.active ? (this.mutedActive ? '#274F66' : '#FFFFFF') : '#3F372F')
      .textAlign(TextAlign.Center)
      .backgroundColor(this.active ? (this.mutedActive ? '#1F366179' : '#366179') : '#D6EEE8DF')
      .borderRadius(16)
      .margin({ right: 7 })
  }
}

@Component
struct DiscoverBookList {
  @Prop books: DiscoverBookItem[] = [];

  build() {
    Column() {
      ForEach(this.books, (book: DiscoverBookItem, index: number) => {
        DiscoverBookRow({ book, topDivider: index > 0 })
      }, (book: DiscoverBookItem) => book.title)
    }
    .width('100%')
    .backgroundColor('#FFFCF8')
    .border({ width: 1, color: '#57B4A697' })
    .borderRadius(8)
    .clip(true)
    .shadow({ radius: 12, color: '#34261A18', offsetX: 0, offsetY: 4 })
  }
}

@Component
struct DiscoverBookRow {
  @Prop book: DiscoverBookItem;
  @Prop topDivider: boolean = false;

  build() {
    Row() {
      Stack({ alignContent: Alignment.BottomEnd }) {
        DiscoverCover({ coverKey: this.book.coverKey })
        if (this.book.inShelf) {
          Circle({ width: 8, height: 8 })
            .fill('#2E7D68')
            .margin({ right: -2, bottom: -2 })
        }
      }
      .width(52)
      .height(74)

      Column() {
        Text(this.book.title)
          .fontSize(15)
          .fontWeight(FontWeight.Bold)
          .fontColor('#201B16')
          .lineHeight(18.75)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
          .width('100%')
        Text(`${this.book.author} · ${this.book.kind}`)
          .fontSize(11)
          .fontColor('#756F69')
          .fontWeight(FontWeight.Bold)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
          .margin({ top: 4 })
          .width('100%')
        Text(this.book.latest)
          .fontSize(11)
          .fontColor('#274F66')
          .fontWeight(FontWeight.Bold)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
          .margin({ top: 4 })
          .width('100%')
        Text(this.book.intro)
          .fontSize(12)
          .fontColor('#5C554D')
          .lineHeight(17.4)
          .maxLines(2)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
          .margin({ top: 4 })
          .width('100%')
      }
      .layoutWeight(1)
      .margin({ left: 11 })
      .alignItems(HorizontalAlign.Start)
    }
    .width('100%')
    .height(108)
    .padding(12)
    .alignItems(VerticalAlign.Top)
    .border({ width: { top: this.topDivider ? 1 : 0 }, color: '#3DB4A697' })
  }
}

@Component
struct DiscoverCover {
  @Prop coverKey: string = '';

  build() {
    Stack() {
      if (this.coverKey === 'mysteryLord') {
        Image($r('app.media.bookshelf_cover_mystery_lord')).width('100%').height('100%').objectFit(ImageFit.Cover)
      } else if (this.coverKey === 'threeBody') {
        Image($r('app.media.bookshelf_cover_three_body')).width('100%').height('100%').objectFit(ImageFit.Cover)
      } else if (this.coverKey === 'brightMoon') {
        Image($r('app.media.bookshelf_cover_bright_moon')).width('100%').height('100%').objectFit(ImageFit.Cover)
      } else if (this.coverKey === 'renjian') {
        Image($r('app.media.bookshelf_cover_renjian_cihua')).width('100%').height('100%').objectFit(ImageFit.Cover)
      } else {
        Image($r('app.media.bookshelf_cover_long_night')).width('100%').height('100%').objectFit(ImageFit.Cover)
      }
    }
    .width(52)
    .height(74)
    .borderRadius(4)
    .clip(true)
    .shadow({ radius: 10, color: '#5043341F', offsetX: 0, offsetY: 4 })
  }
}
