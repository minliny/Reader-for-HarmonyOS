import { ReaderPageState } from '../../../ui/feedback/ReaderPageState';
import { readerPageAreaLength } from '../../../ui/layout/ReaderPageShell';

/** Strict empty state after the Core bookmark projection has been admitted. */
@Component
export struct ReaderBookmarkEmptyState {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  @State private viewportHeight: number = 0;
  private mounted: boolean = false;
  onReturnToDirectory: () => void = (): void => {};

  aboutToAppear(): void { this.mounted = true; }
  aboutToDisappear(): void { this.mounted = false; }

  build() {
    Scroll() {
      Column() {
        Image((this.appThemeScheme === 'night' ? $r('app.media.reader_directory_marker_bookmark_theme_night') : $r('app.media.reader_directory_marker_bookmark')))
          .width(28).height(28);
        ReaderPageState({ title: '暂无书签', message: '在阅读页面下拉，收藏当前位置。',
          actionLabel: '返回目录', onAction: this.onReturnToDirectory });
      }.width('100%').constraintSize({ minHeight: this.viewportHeight })
        .justifyContent(FlexAlign.Center).alignItems(HorizontalAlign.Center);
    }.width('100%').height('100%').scrollBar(BarState.Off)
      .onAreaChange((_oldArea: Area, newArea: Area): void => {
        const height = readerPageAreaLength(newArea.height);
        if (!this.mounted || !Number.isFinite(height) || height <= 0 ||
          Math.abs(height - this.viewportHeight) < .1) return;
        this.viewportHeight = height;
      });
  }
}
