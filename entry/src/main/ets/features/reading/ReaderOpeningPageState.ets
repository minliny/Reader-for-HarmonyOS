import { ReaderIconButton } from '../common/ReaderIconButton';
import { ReaderPageState } from '../common/ReaderPageState';
import type { ReaderAppearanceTheme } from './ReaderAppearanceState';
import { readerAppearanceChromeTone, readerAppearanceThemeStyle } from './ReaderAppearanceRenderStyle';
import { ReaderReadingLayoutSnapshot } from './ReaderLayoutGeometry';
import { ReaderPaperBackground } from './ReaderPaperBackground';

/** A visual placeholder only: the reading owner continues to control readiness. */
@Component
export struct ReaderOpeningPageState {
  @Prop theme: ReaderAppearanceTheme = 'day';
  @Prop expanded: boolean = false;
  @Prop layout: ReaderReadingLayoutSnapshot;
  @Prop topInset: number = 0;
  @Prop leftInset: number = 0;
  onBack: () => void = (): void => {};

  @Builder
  private placeholder() {
    Column({ space: Math.max(2, this.layout.titleToBodySpacingVp * 0.5) }) {
      Blank().width('58%').height(Math.max(2, this.layout.titleLineHeightFp * this.layout.systemFontScale * 0.3))
        .backgroundColor(readerAppearanceThemeStyle(this.theme).ink).opacity(0.12);
      Blank().width('100%').height(Math.max(2, this.layout.titleLineHeightFp * this.layout.systemFontScale * 0.2))
        .backgroundColor(readerAppearanceThemeStyle(this.theme).ink).opacity(0.09);
      Blank().width('92%').height(Math.max(2, this.layout.titleLineHeightFp * this.layout.systemFontScale * 0.2))
        .backgroundColor(readerAppearanceThemeStyle(this.theme).ink).opacity(0.09);
      Blank().width('74%').height(Math.max(2, this.layout.titleLineHeightFp * this.layout.systemFontScale * 0.2))
        .backgroundColor(readerAppearanceThemeStyle(this.theme).ink).opacity(0.09);
    }.width('100%').alignItems(HorizontalAlign.Start)
      .accessibilityText('正在加载章节');
  }

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      ReaderPaperBackground({ theme: this.theme, expanded: this.expanded });
      ReaderPageState({ padded: false, leading: (): void => { this.placeholder(); } })
        .width(this.layout.bodyWidth())
        .position({ x: this.layout.contentLeft, y: this.layout.contentTop });
      ReaderIconButton({
        specId: 'navigation-back',
        scheme: readerAppearanceChromeTone(this.theme) === 'light' ? 'night' : 'day',
        icon: readerAppearanceChromeTone(this.theme) === 'light' ?
          $r('app.media.book_detail_back_theme_night') : $r('app.media.book_detail_back'),
        accessibilityLabel: '取消加载并返回',
        onTap: (): void => this.onBack(),
      }).position({ x: this.leftInset + 12, y: this.topInset + 8 });
    }.width('100%').height('100%')
      .backgroundColor(readerAppearanceThemeStyle(this.theme).paperStart)
      .hitTestBehavior(HitTestMode.Block);
  }
}
