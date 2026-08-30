import { TOK_READ_MUTED, TOK_READ_PRIMARY, TOK_SURFACE_PANEL_SOFT } from '../common/ReaderTokens';

const ERROR_STATE_ICON_SIZE = 22;
const ERROR_STATE_BUTTON_HEIGHT = 26;

/**
 * Error state for the bookmark tab. The current data contract carries no
 * bookmark error channel; owners opt in by setting `bookmarkLoadFailed` and
 * are responsible for the retry that clears it.
 */
@Component
export struct ReaderBookmarkErrorState {
  @Prop message: string = '书签载入失败，请稍后重试';
  onRetry: () => void = (): void => {};

  build() {
    Column({ space: 4 }) {
      Image($r('app.media.reader_directory_marker_bookmark'))
        .width(ERROR_STATE_ICON_SIZE)
        .height(ERROR_STATE_ICON_SIZE);
      Text(this.message)
        .fontFamily('ReaderNotoSansSC')
        .fontSize(10)
        .lineHeight(14)
        .fontColor(TOK_READ_MUTED)
        .textAlign(TextAlign.Center);
      Row() {
        Text('重试')
          .fontFamily('ReaderNotoSansSC')
          .fontWeight(FontWeight.Bold)
          .fontSize(10)
          .fontColor(TOK_READ_PRIMARY)
          .textAlign(TextAlign.Center);
      }
      .width(72)
      .height(ERROR_STATE_BUTTON_HEIGHT)
      .justifyContent(FlexAlign.Center)
      .alignItems(VerticalAlign.Center)
      .backgroundColor(TOK_SURFACE_PANEL_SOFT)
      .borderRadius(13)
      .margin({ top: 8 })
      .accessibilityText('重试载入书签')
      .onClick((): void => this.onRetry());
    }
    .width('100%')
    .height('100%')
    .justifyContent(FlexAlign.Center)
    .alignItems(HorizontalAlign.Center)
    .constraintSize({ minHeight: 0 });
  }
}
