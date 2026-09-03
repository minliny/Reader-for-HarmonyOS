import { TOK_READ_MUTED, TOK_READ_PRIMARY } from '../common/ReaderTokens';

/**
 * Loading state for the bookmark tab: shown while the Core bookmark
 * projection has not been admitted yet (any entry with `bookmarks === undefined`).
 */
@Component
export struct ReaderBookmarkLoadingState {
  build() {
    Column({ space: 8 }) {
      LoadingProgress()
        .width(20)
        .height(20)
        .color(TOK_READ_PRIMARY);
      Text('书签载入中…')
        .fontFamily('ReaderNotoSansSC')
        .fontSize(10)
        .fontColor(TOK_READ_MUTED);
    }
    .width('100%')
    .height('100%')
    .justifyContent(FlexAlign.Center)
    .alignItems(HorizontalAlign.Center);
  }
}
