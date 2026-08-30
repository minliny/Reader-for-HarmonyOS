import { TOK_READ_INK, TOK_READ_MUTED, TOK_READ_PRIMARY } from '../common/ReaderTokens';

const EMPTY_STATE_ICON_SIZE = 22;
const EMPTY_STATE_BUTTON_HEIGHT = 26;
const EMPTY_STATE_BUTTON_COLOR = '#FFFFFF';

/**
 * Strict empty state for the bookmark tab. Rendered only when the Core
 * bookmark projection is admitted and contains zero rows; never mixed with
 * directory data or an empty List.
 */
@Component
export struct ReaderBookmarkEmptyState {
  onReturnToDirectory: () => void = (): void => {};

  build() {
    Column({ space: 4 }) {
      Image($r('app.media.reader_directory_marker_bookmark'))
        .width(EMPTY_STATE_ICON_SIZE)
        .height(EMPTY_STATE_ICON_SIZE);
      Text('暂无书签')
        .fontFamily('ReaderNotoSansSC')
        .fontWeight(FontWeight.Bold)
        .fontSize(13)
        .lineHeight(16)
        .fontColor(TOK_READ_INK);
      Text('在阅读页面点按书签图标即可收藏当前位置')
        .fontFamily('ReaderNotoSansSC')
        .fontSize(10)
        .lineHeight(14)
        .fontColor(TOK_READ_MUTED)
        .textAlign(TextAlign.Center);
      Row() {
        Text('返回目录')
          .fontFamily('ReaderNotoSansSC')
          .fontWeight(FontWeight.Bold)
          .fontSize(10)
          .fontColor(EMPTY_STATE_BUTTON_COLOR)
          .textAlign(TextAlign.Center);
      }
      .width(88)
      .height(EMPTY_STATE_BUTTON_HEIGHT)
      .justifyContent(FlexAlign.Center)
      .alignItems(VerticalAlign.Center)
      .backgroundColor(TOK_READ_PRIMARY)
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
