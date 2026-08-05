import {
  type BookSource,
} from './SourceGateway';

const PHONE_CONTENT_WIDTH = 350;
const TABLET_CONTENT_WIDTH = 620;

@Component
export struct SourceManagementPage {
  @Prop sources: BookSource[];
  @Prop isTablet: boolean;
  onBack: () => void = (): void => {};
  onToggleSource: (id: string, enabled: boolean) => void = (_id: string, _enabled: boolean): void => {};

  aboutToAppear(): void {
    const font = this.getUIContext().getFont();
    font.registerFont({
      familyName: 'ReaderInter',
      familySrc: $rawfile('InterVariable.ttf'),
    });
  }

  build() {
    Column() {
      this.backBar();
      Column() {
        this.searchField();
        this.statsRow();
        this.filterRow();
        this.sourceList();
        this.bottomActionBar();
      }
      .layoutWeight(1)
      .width('100%');
    }
    .width('100%')
    .height('100%')
    .backgroundColor('#F8F4EC');
  }

  @Builder
  private backBar() {
    Row({ space: 10 }) {
      Stack({ alignContent: Alignment.Center }) {
        Image($r('app.media.search_back')).width(20).height(20);
      }
      .width(44)
      .height(44)
      .borderRadius(22)
      .onClick((): void => this.onBack());

      Text('书源管理')
        .fontFamily('ReaderInter')
        .fontWeight(FontWeight.Bold)
        .fontSize(24)
        .lineHeight(33)
        .fontColor('#1F1B17')
        .maxLines(1)
        .layoutWeight(1);

      Stack({ alignContent: Alignment.Center }) {
        Image($r('app.media.bookshelf_more')).width(20).height(20);
      }
      .width(44)
      .height(44)
      .borderRadius(22);
    }
    .width('100%')
    .height(58)
    .padding({ left: 20, right: 20 })
    .alignItems(VerticalAlign.Center);
  }

  @Builder
  private searchField() {
    Row({ space: 8 }) {
      Image($r('app.media.search_mag')).width(14).height(14);
      Text('搜索书名、作者或 URL')
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
  private statsRow() {
    Text(`${this.sources.length} 个书源 · ${this.enabledCount()} 个启用`)
      .width(this.contentWidth())
      .fontFamily('ReaderInter')
      .fontWeight(FontWeight.Regular)
      .fontSize(12)
      .lineHeight(16)
      .fontColor('#756F69')
      .padding({ left: this.isTablet ? 20 : 14, right: this.isTablet ? 20 : 14, top: 8 });
  }

  @Builder
  private filterRow() {
    Row({ space: 8 }) {
      this.chip('全部', true);
      this.chip('已启用', false);
      this.chip('已禁用', false);
    }
    .width(this.contentWidth())
    .height(30)
    .padding({ left: this.isTablet ? 20 : 14, right: this.isTablet ? 20 : 14, top: 8 })
    .alignItems(VerticalAlign.Top);
  }

  @Builder
  private chip(label: string, active: boolean) {
    Text(label)
      .fontFamily('ReaderInter')
      .fontWeight(FontWeight.Bold)
      .fontSize(12)
      .fontColor(active ? '#FFFFFF' : '#564D44')
      .padding({ left: 10, right: 10, top: 6, bottom: 6 })
      .backgroundColor(active ? '#2D4A3E' : '#EEE8DF')
      .borderRadius(999)
      .textAlign(TextAlign.Center)
      .maxLines(1);
  }

  @Builder
  private sourceList() {
    List() {
      ForEach(this.sources, (source: BookSource) => {
        ListItem() {
          this.sourceRow(source);
        }
      }, (source: BookSource): string => `source-${source.sourceId}`);
    }
    .width('100%')
    .layoutWeight(1)
    .scrollBar(BarState.Off);
  }

  @Builder
  private sourceRow(source: BookSource) {
    Row() {
      Column({ space: 2 }) {
        Text(source.name)
          .width('100%')
          .fontFamily('ReaderInter')
          .fontWeight(FontWeight.Bold)
          .fontSize(14)
          .lineHeight(18)
          .fontColor('#1F1B17')
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis });
        Text(source.enabled ? '已启用' : '已禁用')
          .width('100%')
          .fontFamily('ReaderInter')
          .fontWeight(FontWeight.Regular)
          .fontSize(11)
          .lineHeight(14)
          .fontColor('#756F69')
          .maxLines(1);
      }
      .layoutWeight(1)
      .alignItems(HorizontalAlign.Start);

      Text('检测')
        .fontFamily('ReaderInter')
        .fontWeight(FontWeight.Bold)
        .fontSize(12)
        .fontColor('#2D4A3E')
        .maxLines(1);

      Text('')
        .width(36)
        .height(20)
        .margin({ left: 8 })
        .backgroundColor(source.enabled ? '#2D4A3E' : '#C1C7CD')
        .borderRadius(10)
        .onClick((): void => this.onToggleSource(source.sourceId, !source.enabled));

      Stack({ alignContent: Alignment.Center }) {
        Image($r('app.media.bookshelf_more')).width(20).height(20);
      }
      .width(44)
      .height(44)
      .borderRadius(22);
    }
    .width(this.contentWidth())
    .height(48)
    .padding({ left: this.isTablet ? 20 : 14, right: this.isTablet ? 20 : 14 })
    .alignItems(VerticalAlign.Center);
  }

  @Builder
  private bottomActionBar() {
    Row({ space: 8 }) {
      Text('导入')
        .fontFamily('ReaderInter')
        .fontWeight(FontWeight.Bold)
        .fontSize(13)
        .fontColor('#2D4A3E')
        .padding({ left: 16, right: 16, top: 9, bottom: 9 })
        .backgroundColor('#E6FFFCF8')
        .border({ width: 0.5, color: '#C1C7CD' })
        .borderRadius(999);
      Text('分组')
        .fontFamily('ReaderInter')
        .fontWeight(FontWeight.Bold)
        .fontSize(13)
        .fontColor('#2D4A3E')
        .padding({ left: 16, right: 16, top: 9, bottom: 9 })
        .backgroundColor('#E6FFFCF8')
        .border({ width: 0.5, color: '#C1C7CD' })
        .borderRadius(999);
    }
    .width(this.contentWidth())
    .height(48)
    .padding({ left: this.isTablet ? 20 : 14, right: this.isTablet ? 20 : 14 })
    .alignItems(VerticalAlign.Center);
  }

  private enabledCount(): number {
    return this.sources.filter((source) => source.enabled).length;
  }

  private contentWidth(): number {
    return this.isTablet ? TABLET_CONTENT_WIDTH : PHONE_CONTENT_WIDTH;
  }
}