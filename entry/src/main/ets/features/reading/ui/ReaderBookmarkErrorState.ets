import { ReaderPageState } from '../../../ui/feedback/ReaderPageState';
import { readerPageAreaLength } from '../../../ui/layout/ReaderPageShell';

/** The owner retains bookmark admission, error facts and the existing retry. */
@Component
export struct ReaderBookmarkErrorState {
  @State private viewportHeight: number = 0;
  private mounted: boolean = false;
  aboutToAppear(): void { this.mounted = true; }
  aboutToDisappear(): void { this.mounted = false; }

  @Prop message: string = '书签载入失败，请稍后重试';
  onRetry: () => void = (): void => {};

  build() {
    Scroll() {
      Column() {
        ReaderPageState({ variant: 'readingBookmark', title: '书签载入失败',
          message: this.message === '书签载入失败，请稍后重试' || this.message.trim().length === 0 ?
            '请稍后重试。' : this.message,
          actionLabel: '重试', onAction: this.onRetry });
      }.width('100%').constraintSize({ minHeight: this.viewportHeight })
        .justifyContent(FlexAlign.Center).alignItems(HorizontalAlign.Center);
    }.width('100%').height('100%').scrollBar(BarState.Off)
      .onAreaChange((_oldArea: Area, area: Area): void => {
        const height = readerPageAreaLength(area.height);
        if (this.mounted && Number.isFinite(height) && height > 0 && Math.abs(height - this.viewportHeight) >= .1)
          this.viewportHeight = height;
      });
  }
}
