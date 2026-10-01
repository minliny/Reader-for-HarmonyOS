import { readerAppColor } from '../common/ReaderThemeRegistry';
import { SearchSpinner } from '../search/SearchSpinner';

@Component
export struct BookshelfStatusContent {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  @Prop failed: boolean = false;
  @Prop reduceMotion: boolean = false;
  onRetry: () => void = (): void => {};

  build() {
    if (this.failed) {
      Column({ space: 16 }) {
        Text('书架加载失败')
          .fontFamily('ReaderInter')
          .fontWeight(FontWeight.Bold)
          .fontSize(17)
          .lineHeight(25.5)
          .fontColor(readerAppColor('TOK_INK', this.appThemeScheme))
          .textAlign(TextAlign.Center);
        Text('无法读取书架内容，请重试。')
          .fontFamily('ReaderInter')
          .fontWeight(FontWeight.Regular)
          .fontSize(13)
          .lineHeight(19.5)
          .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme))
          .textAlign(TextAlign.Center);
        Text('重试')
          .fontFamily('ReaderInter')
          .fontWeight(800)
          .fontSize(13)
          .lineHeight(13)
          .fontColor(readerAppColor('TOK_ON_PRIMARY', this.appThemeScheme))
          .padding({ left: 18, right: 18, top: 11.5, bottom: 11.5 })
          .backgroundColor(readerAppColor('app.action.fill', this.appThemeScheme))
          .borderRadius(999)
          .responseRegion({ x: 0, y: -4, width: '100%', height: 44 })
          .onClick((): void => this.onRetry());
      }
      .width('100%')
      .height('100%')
      .justifyContent(FlexAlign.Center)
      .alignItems(HorizontalAlign.Center);

    } else {
      Column({ space: 16 }) {
        SearchSpinner({ active: true, reduceMotion: this.reduceMotion, diameter: 24 });
        Text('正在加载书架…')
          .fontFamily('ReaderInter')
          .fontWeight(FontWeight.Regular)
          .fontSize(13)
          .lineHeight(19.5)
          .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme));
      }
      .width('100%')
      .height('100%')
      .justifyContent(FlexAlign.Center)
      .alignItems(HorizontalAlign.Center);
    }
  }
}
