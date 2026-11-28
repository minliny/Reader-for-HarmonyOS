import { findReaderTheme, readerThemeDefinition } from '../../../ui/foundation/ReaderThemeRegistry';
import { ReaderRectVp } from '../../../ui/foundation/ReaderWindowMetrics';
import { ReaderPaperBackground } from './ReaderPaperBackground';

/** A crop of the full-window paper, not a separately scaled status-bar texture. */
@Component
export struct ReaderStatusBarPaper {
  @Prop theme: string = '';
  @Prop fallbackColor: string = '#FFF8F4EC';
  @Prop viewportWidth: number = 0;
  @Prop viewportHeight: number = 0;
  @Prop statusRect: ReaderRectVp = new ReaderRectVp();
  @Prop expanded: boolean = false;
  @Prop overlayTintColor: string = '';
  @Prop overlayOpacity: number = 0;

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      if (findReaderTheme(this.theme) !== undefined && this.viewportWidth > 0 && this.viewportHeight > 0) {
        ReaderPaperBackground({
          theme: readerThemeDefinition(this.theme).id,
          expanded: this.expanded,
        })
          .width(this.viewportWidth).height(this.viewportHeight)
          .position({ x: -this.statusRect.left, y: -this.statusRect.top });
      }
      if (this.overlayOpacity > 0 && this.overlayTintColor.length > 0) {
        Stack()
          .width('100%').height('100%')
          .backgroundColor(this.overlayTintColor)
          .opacity(this.overlayOpacity)
          .hitTestBehavior(HitTestMode.None)
          .accessibilityLevel('no');
      }
    }
    .width(this.statusRect.width).height(this.statusRect.height)
    .position({ x: this.statusRect.left, y: this.statusRect.top })
    .backgroundColor(this.fallbackColor)
    .clip(true)
    .hitTestBehavior(HitTestMode.None);
  }
}
