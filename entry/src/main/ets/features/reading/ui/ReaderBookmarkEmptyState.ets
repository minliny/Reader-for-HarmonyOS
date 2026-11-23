import { ReaderPageState } from '../../../ui/feedback/ReaderPageState';
import { readerPageAreaLength } from '../../../ui/layout/ReaderPageShell';
import { readerBookmarkEmptyCopy } from '../presentation/ReaderBookmarkProjection';

/** Strict empty state after the Core bookmark projection has been admitted. */
@Component
export struct ReaderBookmarkEmptyState {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  @State private viewportHeight: number = 0;
  private mounted: boolean = false;
  @Prop filtered: boolean = false;
  @Prop compact: boolean = false;
  @Prop actionGeneration: number = 0;
  onAction: (generation: number, filtered: boolean) => void = (_generation: number, _filtered: boolean): void => {};

  private actionKey(): number {
    return this.actionGeneration * 2 + (this.filtered ? 1 : 0);
  }

  aboutToAppear(): void { this.mounted = true; }
  aboutToDisappear(): void { this.mounted = false; }

  @Builder
  private emptyIcon() {
    Image((this.appThemeScheme === 'night' ? $r('app.media.reader_directory_marker_bookmark_theme_night') : $r('app.media.reader_directory_marker_bookmark')))
      .width(28).height(28).margin({ bottom: 16 });
  }

  build() {
    Scroll() {
      Column() {
        ReaderPageState({ variant: this.filtered && this.compact ? 'inline' : 'readingBookmark',
          padded: !this.filtered || !this.compact,
          leading: (): void => { if (!this.filtered || !this.compact) this.emptyIcon(); },
          title: readerBookmarkEmptyCopy(this.filtered).title, message: readerBookmarkEmptyCopy(this.filtered).message,
          actionLabel: readerBookmarkEmptyCopy(this.filtered).action, actionGeneration: this.actionKey(),
          onAction: (generation: number): void => {
            if (this.mounted && generation === this.actionKey()) this.onAction(this.actionGeneration, this.filtered);
          } });
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
