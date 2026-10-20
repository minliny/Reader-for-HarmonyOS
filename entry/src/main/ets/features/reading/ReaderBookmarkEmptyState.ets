import { ReaderPageState } from '../common/ReaderPageState';

/** Strict empty state after the Core bookmark projection has been admitted. */
@Component
export struct ReaderBookmarkEmptyState {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  onReturnToDirectory: () => void = (): void => {};

  build() {
    Column() {
      Image((this.appThemeScheme === 'night' ? $r('app.media.reader_directory_marker_bookmark_theme_night') : $r('app.media.reader_directory_marker_bookmark')))
        .width(28).height(28);
      ReaderPageState({ title: '暂无书签', message: '在阅读页面下拉，收藏当前位置。',
        actionLabel: '返回目录', onAction: this.onReturnToDirectory });
    }.width('100%').height('100%').justifyContent(FlexAlign.Center)
      .alignItems(HorizontalAlign.Center);
  }
}
