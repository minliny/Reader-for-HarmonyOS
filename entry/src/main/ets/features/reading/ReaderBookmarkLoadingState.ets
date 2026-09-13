import { readerAppColor } from '../common/ReaderThemeRegistry';
import { TOK_READ_MUTED, TOK_READ_PRIMARY } from '../common/ReaderTokens';

/**
 * Loading state for the bookmark tab: shown while the Core bookmark
 * projection has not been admitted yet (any entry with `bookmarks === undefined`).
 */
@Component
export struct ReaderBookmarkLoadingState {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';

  build() {
    Column({ space: 8 }) {
      LoadingProgress()
        .width(20)
        .height(20)
        .color(readerAppColor('TOK_READ_PRIMARY', this.appThemeScheme));
      Text('书签载入中…')
        .fontFamily('ReaderNotoSansSC')
        .fontSize(10)
        .fontColor(readerAppColor('TOK_READ_MUTED', this.appThemeScheme));
    }
    .width('100%')
    .height('100%')
    .justifyContent(FlexAlign.Center)
    .alignItems(HorizontalAlign.Center);
  }
}
