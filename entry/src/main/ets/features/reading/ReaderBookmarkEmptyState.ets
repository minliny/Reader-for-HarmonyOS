import { readerAppColor } from '../common/ReaderThemeRegistry';
import { TOK_READ_INK, TOK_READ_MUTED, TOK_READ_PRIMARY } from '../common/ReaderTokens';

const EMPTY_STATE_ICON_SIZE = 22;
const EMPTY_STATE_BUTTON_HEIGHT = 26;

/**
 * Strict empty state for the bookmark tab. Rendered only when the Core
 * bookmark projection is admitted and contains zero rows; never mixed with
 * directory data or an empty List.
 */
@Component
export struct ReaderBookmarkEmptyState {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';

  onReturnToDirectory: () => void = (): void => {};

  build() {
    Column({ space: 4 }) {
      Image((this.appThemeScheme === 'night' ? $r('app.media.reader_directory_marker_bookmark_theme_night') : $r('app.media.reader_directory_marker_bookmark')))
        .width(EMPTY_STATE_ICON_SIZE)
        .height(EMPTY_STATE_ICON_SIZE);
      Text('暂无书签')
        .fontFamily('ReaderNotoSansSC')
        .fontWeight(FontWeight.Bold)
        .fontSize(13)
        .lineHeight(16)
        .fontColor(readerAppColor('TOK_READ_INK', this.appThemeScheme));
      Text('在阅读页面点按书签图标即可收藏当前位置')
        .fontFamily('ReaderNotoSansSC')
        .fontSize(10)
        .lineHeight(14)
        .fontColor(readerAppColor('TOK_READ_MUTED', this.appThemeScheme))
        .textAlign(TextAlign.Center);
      Row() {
        Text('返回目录')
          .fontFamily('ReaderNotoSansSC')
          .fontWeight(FontWeight.Bold)
          .fontSize(10)
          .fontColor(readerAppColor('app.ReaderBookmarkEmptyState.EMPTY_STATE_BUTTON_COLOR', this.appThemeScheme))
          .textAlign(TextAlign.Center);
      }
      .width(88)
      .height(EMPTY_STATE_BUTTON_HEIGHT)
      .justifyContent(FlexAlign.Center)
      .alignItems(VerticalAlign.Center)
      .backgroundColor(readerAppColor('TOK_READ_PRIMARY', this.appThemeScheme))
      .borderRadius(13)
      .margin({ top: 8 })
      .accessibilityText('返回目录')
      .onClick((): void => this.onReturnToDirectory());
    }
    .width('100%')
    .height('100%')
    .justifyContent(FlexAlign.Center)
    .alignItems(HorizontalAlign.Center);
  }
}
