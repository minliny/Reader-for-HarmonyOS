import { readerAppColor } from '../common/ReaderThemeRegistry';
import { registerReaderFonts, prepareSourceSwitchNovelFonts, sourceSwitchNovelFontsReady } from '../common/ReaderFonts';
import { ReaderWindowCoordinator } from '../../app/ReaderWindowCoordinator';
import { TYPE_SOURCE_SWITCH_NOVEL_SWITCH_TITLE, TYPE_SOURCE_SWITCH_NOVEL_SWITCH_SOURCE,
  TYPE_SOURCE_SWITCH_NOVEL_SWITCH_STATUS, TYPE_SOURCE_SWITCH_NOVEL_SWITCH_CAPTION } from '../common/ReaderTypography';
import { SourceSwitchSpinner } from './SourceSwitchSpinner';
import { SOURCE_SWITCH_VISUAL } from './SourceSwitchVisual';

/** One preparation surface spans the transaction and actual first-page
 * admission. Its owner supplies real state; a short viewport can scroll. */
@Component
export struct SourceSwitchProgress {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  @Prop sourceName: string = '';
  @Prop chapterTitle: string = '';
  @Prop statusText: string = '正在准备新书源…';
  @Prop reduceMotion: boolean = false;
  @Prop active: boolean = true;
  @Prop allowCancel: boolean = false;
  onCancel: () => void = (): void => {};
  @Prop topInset: number = 0;
  @Prop bottomInset: number = 0;
  @State private viewportHeight: number = 0;
  @State private novelFontsReady: boolean = sourceSwitchNovelFontsReady();
  private mounted: boolean = false;

  aboutToAppear(): void {
    this.mounted = true;
    registerReaderFonts(this.getUIContext().getFont());
    if (!this.novelFontsReady) {
      void prepareSourceSwitchNovelFonts().then((ready: boolean): void => {
        if (this.mounted) this.novelFontsReady = ready;
      });
    }
  }
  aboutToDisappear(): void { this.mounted = false; }

  private availableHeight(): number {
    return this.viewportHeight > 0 ? this.viewportHeight :
      Math.max(0, ReaderWindowCoordinator.metrics().windowRect.height - this.topInset - this.bottomInset);
  }

  build() {
    Stack({ alignContent: Alignment.TopEnd }) {
    Scroll() {
      Column() {
        if (this.novelFontsReady) {
        Column() {
          Row() {
            SourceSwitchSpinner({ active: this.active, diameter: SOURCE_SWITCH_VISUAL.switchSpinnerSize,
              reduceMotion: this.reduceMotion });
          }.width(SOURCE_SWITCH_VISUAL.switchSpinnerSlotSize).height(SOURCE_SWITCH_VISUAL.switchSpinnerSlotSize)
            .justifyContent(FlexAlign.Center).margin({ bottom: SOURCE_SWITCH_VISUAL.switchSpinnerBottomGap });
          Text('正在切换书源').fontFamily(TYPE_SOURCE_SWITCH_NOVEL_SWITCH_TITLE.fontFamily)
            .fontWeight(TYPE_SOURCE_SWITCH_NOVEL_SWITCH_TITLE.fontWeight).fontSize(TYPE_SOURCE_SWITCH_NOVEL_SWITCH_TITLE.fontSizeFp)
            .lineHeight(TYPE_SOURCE_SWITCH_NOVEL_SWITCH_TITLE.lineHeightFp).halfLeading(true).textAlign(TextAlign.Center)
            .fontColor(readerAppColor('TOK_INK', this.appThemeScheme)).margin({ bottom: SOURCE_SWITCH_VISUAL.switchTitleBottomGap });
          Text(this.sourceName).fontFamily(TYPE_SOURCE_SWITCH_NOVEL_SWITCH_SOURCE.fontFamily)
            .fontWeight(TYPE_SOURCE_SWITCH_NOVEL_SWITCH_SOURCE.fontWeight).fontSize(TYPE_SOURCE_SWITCH_NOVEL_SWITCH_SOURCE.fontSizeFp)
            .lineHeight(TYPE_SOURCE_SWITCH_NOVEL_SWITCH_SOURCE.lineHeightFp).halfLeading(true).textAlign(TextAlign.Center)
            .fontColor(readerAppColor('TOK_GREEN', this.appThemeScheme)).maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis });
          Text(this.statusText).fontFamily(TYPE_SOURCE_SWITCH_NOVEL_SWITCH_STATUS.fontFamily)
            .fontWeight(TYPE_SOURCE_SWITCH_NOVEL_SWITCH_STATUS.fontWeight).fontSize(TYPE_SOURCE_SWITCH_NOVEL_SWITCH_STATUS.fontSizeFp)
            .lineHeight(TYPE_SOURCE_SWITCH_NOVEL_SWITCH_STATUS.lineHeightFp).halfLeading(true).textAlign(TextAlign.Center)
            .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme)).constraintSize({ minHeight: SOURCE_SWITCH_VISUAL.switchStepMinHeight })
            .margin({ top: SOURCE_SWITCH_VISUAL.switchStepTopGap, bottom: SOURCE_SWITCH_VISUAL.switchStepBottomGap });
          Text(this.chapterTitle.length > 0 ? `定位对应章节 · ${this.chapterTitle}` : '正在定位对应章节')
            .fontFamily(TYPE_SOURCE_SWITCH_NOVEL_SWITCH_CAPTION.fontFamily).fontWeight(TYPE_SOURCE_SWITCH_NOVEL_SWITCH_CAPTION.fontWeight)
            .fontSize(TYPE_SOURCE_SWITCH_NOVEL_SWITCH_CAPTION.fontSizeFp).lineHeight(TYPE_SOURCE_SWITCH_NOVEL_SWITCH_CAPTION.lineHeightFp).halfLeading(true)
            .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme)).textAlign(TextAlign.Center)
            .maxLines(2).textOverflow({ overflow: TextOverflow.Ellipsis });
        }.width('100%').constraintSize({ maxWidth: SOURCE_SWITCH_VISUAL.switchContentMaxWidth });
        }
      }.width('100%').constraintSize({ minHeight: this.availableHeight() }).justifyContent(FlexAlign.Center);
    }.width('100%').height('100%').scrollBar(BarState.Off)
      .padding({ left: SOURCE_SWITCH_VISUAL.switchPadding, right: SOURCE_SWITCH_VISUAL.switchPadding, top: this.topInset, bottom: this.bottomInset })
      .backgroundColor(readerAppColor('TOK_SS_PROGRESS_BG', this.appThemeScheme))
      .onAreaChange((_old: Area, area: Area): void => {
        const height = Number(area.height) - this.topInset - this.bottomInset;
        if (Number.isFinite(height) && height > 0) this.viewportHeight = height;
      });
      if (this.allowCancel) {
        Button({ type: ButtonType.Normal }) {
          Image(this.appThemeScheme === 'night' ? $r('app.media.source_switch_close_theme_night') : $r('app.media.source_switch_close'))
            .width(SOURCE_SWITCH_VISUAL.closeIconSize).height(SOURCE_SWITCH_VISUAL.closeIconSize);
        }.width(44).height(44).padding(0).backgroundColor(Color.Transparent)
          .borderRadius(SOURCE_SWITCH_VISUAL.closeRadius)
          .margin({ top: this.topInset + SOURCE_SWITCH_VISUAL.switchPadding, right: SOURCE_SWITCH_VISUAL.switchPadding })
          .accessibilityText('取消切换书源').onClick((): void => this.onCancel());
      }
    }.width('100%').height('100%');
  }
}
