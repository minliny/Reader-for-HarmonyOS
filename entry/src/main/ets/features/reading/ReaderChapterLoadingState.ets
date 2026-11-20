import { ReaderIconButton } from '../common/ReaderIconButton';
import { ReaderPageState } from '../common/ReaderPageState';
import type { ReaderAppearanceTheme } from './ReaderAppearanceState';
import { readerAppearanceChromeTone, readerAppearanceThemeStyle } from './ReaderAppearanceRenderStyle';
import { ReaderPaperBackground } from './ReaderPaperBackground';

/** A pending chapter is visible navigation, not an admitted reading position. */
@Component
export struct ReaderChapterLoadingState {
  @Prop theme: ReaderAppearanceTheme = 'day';
  @Prop expanded: boolean = false;
  @Prop chapterTitle: string = '';
  @Prop active: boolean = true;
  @Prop reduceMotion: boolean = false;
  @Prop topInset: number = 0;
  @Prop leftInset: number = 0;
  onBack: () => void = (): void => {};

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      ReaderPaperBackground({ theme: this.theme, expanded: this.expanded });
      Column() {
        ReaderPageState({ title: this.chapterTitle, message: '正在加载章节…', padded: false,
          loading: true, loadingActive: this.active && !this.reduceMotion,
          inkColor: readerAppearanceThemeStyle(this.theme).ink,
          mutedColor: readerAppearanceThemeStyle(this.theme).ink });
      }.width('100%').height('100%').padding(24)
        .justifyContent(FlexAlign.Center).alignItems(HorizontalAlign.Center);
      ReaderIconButton({
        specId: 'navigation-back',
        scheme: readerAppearanceChromeTone(this.theme) === 'light' ? 'night' : 'day',
        icon: readerAppearanceChromeTone(this.theme) === 'light' ? $r('app.media.book_detail_back_theme_night') : $r('app.media.book_detail_back'),
        accessibilityLabel: '取消加载并返回',
        onTap: (): void => this.onBack(),
      }).position({ x: this.leftInset + 12, y: this.topInset + 8 });
    }.width('100%').height('100%')
      .backgroundColor(readerAppearanceThemeStyle(this.theme).paperStart)
      .hitTestBehavior(HitTestMode.Block);
  }
}
