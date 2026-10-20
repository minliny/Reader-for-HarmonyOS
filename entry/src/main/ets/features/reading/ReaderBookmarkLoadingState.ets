import { ReaderPageState } from '../common/ReaderPageState';
import { readerAppColor } from '../common/ReaderThemeRegistry';

/**
 * Loading state for the bookmark tab: shown while the Core bookmark
 * projection has not been admitted yet (any entry with `bookmarks === undefined`).
 */
@Component
export struct ReaderBookmarkLoadingState {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';

  build() {
    Column() {
      ReaderPageState({ loading: true, message: '书签载入中…', padded: false,
        mutedColor: readerAppColor('TOK_READ_MUTED', this.appThemeScheme) });
    }
    .width('100%')
    .height('100%')
    .justifyContent(FlexAlign.Center)
    .alignItems(HorizontalAlign.Center);
  }
}
