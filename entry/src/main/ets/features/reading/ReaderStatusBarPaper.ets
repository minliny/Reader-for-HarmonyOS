import { findReaderTheme, readerThemeDefinition } from '../common/ReaderThemeRegistry';
import { ReaderRectVp } from '../common/ReaderWindowMetrics';
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
    }
    .width(this.statusRect.width).height(this.statusRect.height)
    .position({ x: this.statusRect.left, y: this.statusRect.top })
    .backgroundColor(this.fallbackColor)
    .clip(true)
    .hitTestBehavior(HitTestMode.None);
  }
}
