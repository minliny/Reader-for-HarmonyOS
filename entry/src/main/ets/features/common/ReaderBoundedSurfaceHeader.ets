import { TYPE_SOURCE_SWITCH_HEADING, TYPE_READER_TTS_MANAGER_TITLE, TYPE_READER_TTS_CONFIGURATION_TITLE } from './ReaderTypography';
import { readerAppColor } from './ReaderThemeRegistry';
import { SheetSurfaceSpec, resolveSheetSpec } from './ReaderSurfaceSpecs';
import type { ReaderBoundedSurfaceId } from './ReaderBoundedSurface';

/** Header title, close target and finite physical layout shared by real
 * bounded surfaces. The optional source sort control is a business slot. */
@Component
export struct ReaderBoundedSurfaceHeader {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  @Prop specId: ReaderBoundedSurfaceId = 'source-switch-window';
  @Prop title: string = '';
  @Prop width: number = 300;
  @Prop enabled: boolean = true;
  @BuilderParam accessory: () => void = this.emptySlot;
  onClose: () => void = (): void => {};

  @Builder private emptySlot() {}

  build() {
    if (this.specId === 'bookshelf-book-action') {
      this.sheetHeader();
    } else if (this.specId === 'source-switch-window') {
      Column({ space: 0 }) {
        this.headerRow();
        Text('').width(Math.max(0, this.width - 1)).height(1)
          .backgroundColor(readerAppColor('TOK_LINE', this.appThemeScheme));
      }.width('100%').height(34);
    } else { this.headerRow(); }
  }

  private sheetSpec(): SheetSurfaceSpec { return resolveSheetSpec('bookshelf-book-action'); }

  @Builder private sheetHeader() {
    Row() {
      Blank().width(this.sheetSpec().handleWidth).height(this.sheetSpec().handleHeight)
        .backgroundColor(readerAppColor(this.sheetSpec().handleRole, this.appThemeScheme)).borderRadius(999);
    }.width('100%').height(this.sheetSpec().handleHeight).justifyContent(FlexAlign.Center)
      .position({ x: 0, y: this.sheetSpec().handleTop });
    Text(this.title).fontFamily(this.sheetSpec().titleFontFamily).fontWeight(this.sheetSpec().titleFontWeight)
      .fontSize(this.sheetSpec().titleFontSize).lineHeight(this.sheetSpec().titleLineHeight)
      .fontColor(readerAppColor(this.sheetSpec().titleRole, this.appThemeScheme)).maxLines(1)
      .position({ x: this.sheetSpec().titleInset, y: this.sheetSpec().titleTop });
  }

  @Builder private headerRow() {
    Row({ space: this.specId === 'source-switch-window' ? 0 : 8 }) {
      if (this.specId === 'source-switch-window') {
        Image(this.appThemeScheme === 'night' ? $r('app.media.reader_directory_switch_theme_night') : $r('app.media.reader_directory_switch'))
          .width(18).height(18).margin({ left: 9 });
      } else if (this.specId === 'tts-config-manager') {
        Image(this.appThemeScheme === 'night' ? $r('app.media.reader_tts_online_engine_theme_night') : $r('app.media.reader_tts_online_engine')).width(20).height(20);
      }
      this.titleText();
      this.accessory();
      this.closeAction();
    }.width('100%').height(this.specId === 'source-switch-window' ? 33 : this.specId === 'tts-config-manager' ? 58 : 40)
      .alignItems(VerticalAlign.Center)
      .padding(this.specId === 'source-switch-window' ? 0 : {
        left: this.specId === 'tts-config-manager' ? 18 : 12, right: this.specId === 'tts-config-manager' ? 24 : 16,
      });
  }

  @Builder private titleText() {
    Text(this.title).layoutWeight(1)
      .constraintSize(this.specId === 'source-switch-window' ? { minWidth: 0 } : {})
      .height(this.specId === 'source-switch-window' ? 16 : undefined)
      .fontFamily(this.specId === 'source-switch-window' ? TYPE_SOURCE_SWITCH_HEADING.fontFamily : this.specId === 'tts-config-manager' ? TYPE_READER_TTS_MANAGER_TITLE.fontFamily : TYPE_READER_TTS_CONFIGURATION_TITLE.fontFamily)
      .fontWeight(this.specId === 'source-switch-window' ? TYPE_SOURCE_SWITCH_HEADING.fontWeight : this.specId === 'tts-config-manager' ? TYPE_READER_TTS_MANAGER_TITLE.fontWeight : TYPE_READER_TTS_CONFIGURATION_TITLE.fontWeight)
      .fontSize(this.specId === 'source-switch-window' ? TYPE_SOURCE_SWITCH_HEADING.fontSizeFp : this.specId === 'tts-config-manager' ? TYPE_READER_TTS_MANAGER_TITLE.fontSizeFp : TYPE_READER_TTS_CONFIGURATION_TITLE.fontSizeFp)
      .lineHeight(this.specId === 'source-switch-window' ? TYPE_SOURCE_SWITCH_HEADING.lineHeightFp as number : undefined)
      .fontColor(readerAppColor(this.specId === 'source-switch-window' ? 'TOK_READ_INK' : 'TOK_TTS_INK', this.appThemeScheme))
      .margin(this.specId === 'source-switch-window' ? { left: 7 } : 0);
  }

  @Builder private closeAction() {
    if (this.specId === 'source-switch-window') {
      Stack({ alignContent: Alignment.Center }) {
        Stack({ alignContent: Alignment.Center }) {
          Image(this.appThemeScheme === 'night' ? $r('app.media.source_switch_close_theme_night') : $r('app.media.source_switch_close')).width(20).height(20);
        }.width(22).height(22).borderRadius(8).backgroundColor(readerAppColor('TOK_SS_CLOSE_BG', this.appThemeScheme));
      }.width(44).height(44).margin({ left: 1 }).enabled(this.enabled)
        .onClick((): void => { if (this.enabled) this.onClose(); });
    } else {
      Image(this.appThemeScheme === 'night' ? $r('app.media.reader_tts_make_close_theme_night') : $r('app.media.reader_tts_make_close')).width(16).height(16)
        .responseRegion({ x: -6, y: -6, width: 28, height: 28 }).enabled(this.enabled)
        .accessibilityText('关闭 TTS 配置').onClick((): void => { if (this.enabled) this.onClose(); });
    }
  }
}
