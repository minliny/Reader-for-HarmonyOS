import { MainTabTitleBar, ReaderUiIcon } from './SharedComponents';

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
  private entries: string[] = ['排行榜', '畅销', '分类', '完本', '最新', '新书', '书单'];
  private filters: string[] = ['关键词', '男频', '女频'];
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
      MainTabTitleBar({ title: '发现' })

      Scroll() {
        Column() {
          DiscoverSourceBar()
          DiscoverEntryRow({ entries: this.entries })
          DiscoverFilterRow({ filters: this.filters })
          Text('排行榜')
            .fontSize(15)
            .fontWeight(FontWeight.Bold)
            .fontColor('#201B16')
            .width('100%')
            .padding({ left: 2 })

          DiscoverBookList({ books: this.books })
        }
        .width('100%')
        .padding({ left: 15, right: 15, top: 8, bottom: 122 })
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
          .fontWeight(FontWeight.Bold)
          .fontColor('#201B16')
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
        Text('排行榜 · 热门')
          .fontSize(11)
          .fontColor('#756F69')
          .fontWeight(FontWeight.Medium)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
          .margin({ top: 3 })
      }
      .layoutWeight(1)
      .margin({ left: 10, right: 10 })

      ReaderUiIcon({ iconName: 'chevron', tone: 'muted', iconSize: 18 })
    }
    .width('100%')
    .height(58)
    .padding({ left: 12, right: 12, top: 10, bottom: 10 })
    .alignItems(VerticalAlign.Center)
    .backgroundColor('#FFFCF8')
    .border({ width: 1, color: '#5CB4A697' })
    .borderRadius(8)
    .shadow({ radius: 12, color: '#34261A18', offsetX: 0, offsetY: 4 })
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
  @Prop filters: string[] = [];

  build() {
    Column() {
      Row() {
        ForEach(this.filters, (filter: string) => {
          DiscoverChip({
            label: filter,
            active: filter === '关键词',
            compact: true,
            mutedActive: true
          })
        }, (filter: string) => filter)
        DiscoverChip({ label: '排序：人气', compact: true, mutedActive: true })
        Blank()
        Row() {
          ReaderUiIcon({ iconName: 'check', tone: 'white', iconSize: 13 })
          Text('应用')
            .fontSize(12)
            .fontWeight(FontWeight.Bolder)
            .fontColor('#FFFFFF')
        }
        .height(34)
        .padding({ left: 10, right: 10 })
        .justifyContent(FlexAlign.Center)
        .alignItems(VerticalAlign.Center)
        .backgroundColor('#366179')
        .borderRadius(6)
      }
      .width('100%')
      .alignItems(VerticalAlign.Center)
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
          .lineHeight(19)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
        Text(`${this.book.author} · ${this.book.kind}`)
          .fontSize(11)
          .fontColor('#756F69')
          .fontWeight(FontWeight.Bold)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
          .margin({ top: 4 })
        Text(this.book.latest)
          .fontSize(11)
          .fontColor('#274F66')
          .fontWeight(FontWeight.Bold)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
          .margin({ top: 4 })
        Text(this.book.intro)
          .fontSize(12)
          .fontColor('#5C554D')
          .lineHeight(17)
          .maxLines(2)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
          .margin({ top: 4 })
      }
      .layoutWeight(1)
      .margin({ left: 11 })
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
