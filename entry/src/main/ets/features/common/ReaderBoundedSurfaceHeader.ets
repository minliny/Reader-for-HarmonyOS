import { TYPE_SOURCE_SWITCH_HEADING, TYPE_READER_TTS_MANAGER_TITLE, TYPE_READER_TTS_CONFIGURATION_TITLE, TYPE_FILE_IMPORT_TITLE, TYPE_READER_REPLACE_RETAINED_TEMPORARY_OVERLAY_VALUE } from './ReaderTypography';
import { readerAppColor } from './ReaderThemeRegistry';
import { SheetSurfaceSpec, DrawerSurfaceSpec, resolveSheetSpec, resolveDrawerSpec } from './ReaderSurfaceSpecs';
import type { ReaderBoundedSurfaceId } from './ReaderBoundedSurface';

/** Only set attributes present in the selected original header. In particular
 * the TTS AUTO title does not call height/lineHeight with undefined. The IDs
 * are stable per mounted family; native node reuse across IDs is not a contract. */
export class ReaderBoundedTitleModifier implements AttributeModifier<TextAttribute> {
  private readonly id: ReaderBoundedSurfaceId;
  private readonly scheme: string;
  constructor(id: ReaderBoundedSurfaceId, scheme: string) { this.id = id; this.scheme = scheme; }
  applyNormalAttribute(instance: TextAttribute): void {
    const type = this.id === 'source-switch-window' ? TYPE_SOURCE_SWITCH_HEADING :
      this.id === 'tts-config-manager' ? TYPE_READER_TTS_MANAGER_TITLE : TYPE_READER_TTS_CONFIGURATION_TITLE;
    instance.fontFamily(type.fontFamily).fontWeight(type.fontWeight).fontSize(type.fontSizeFp)
      .fontColor(readerAppColor(this.id === 'source-switch-window' ? 'TOK_READ_INK' : 'TOK_TTS_INK', this.scheme));
    if (this.id === 'source-switch-window') instance.constraintSize({ minWidth: 0 }).height(16)
      .lineHeight(TYPE_SOURCE_SWITCH_HEADING.lineHeightFp as number).margin({ left: 7 });
  }
}

/** Header title, close target and finite physical layout shared by real
 * bounded surfaces. The optional source sort control is a business slot. */
@Component
export struct ReaderBoundedSurfaceHeader {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  @Prop specId: ReaderBoundedSurfaceId = 'source-switch-window';
  @Prop title: string = '';
  @Prop surfaceWidth: number = 300;
  @Prop actionEnabled: boolean = true;
  @Prop placement: 'bottom' | 'side' = 'bottom';
  @Prop scheme: 'auto' | 'day' | 'night' = 'auto';
  @BuilderParam leading: () => void = this.emptySlot;
  @BuilderParam accessory: () => void = this.emptySlot;
  onAreaChanged: (oldValue: Area, next: Area) => void = (_oldValue: Area, _next: Area): void => {};
  onClose: () => void = (): void => {};
  onHandlePanStart: () => void = (): void => {};
  onHandlePanUpdate: (offset: number) => void = (_offset: number): void => {};
  onHandlePanEnd: (offset: number, velocity: number) => void = (_offset: number, _velocity: number): void => {};

  @Builder private emptySlot() {}

  build() {
    if (this.specId === 'reader-action-sheet') {
      this.actionSheetHeader();
    } else if (this.specId === 'local-import-selection' || this.specId === 'local-import-result-content') {
      this.localImportHeader();
    } else if (this.specId === 'reader-replace-editor') {
      Row({ space: 8 }) { this.leading();
        Text(this.title).fontFamily(TYPE_READER_REPLACE_RETAINED_TEMPORARY_OVERLAY_VALUE.fontFamily)
          .fontSize(TYPE_READER_REPLACE_RETAINED_TEMPORARY_OVERLAY_VALUE.fontSizeFp).fontWeight(TYPE_READER_REPLACE_RETAINED_TEMPORARY_OVERLAY_VALUE.fontWeight)
          .fontColor(readerAppColor('TOK_READ_INK', this.appThemeScheme)).layoutWeight(1);
        this.accessory();
      }.width('100%').height(28);
    } else if (this.specId === 'bookshelf-book-action') {
      this.sheetHeader();
    } else if (this.specId === 'source-switch-window') {
      Column({ space: 0 }) {
        this.headerRow();
        Text('').width(Math.max(0, this.surfaceWidth - 1)).height(1)
          .backgroundColor(readerAppColor('TOK_LINE', this.appThemeScheme));
      }.width('100%').height(34);
    } else { this.headerRow(); }
  }

  private drawerSpec(): DrawerSurfaceSpec { return resolveDrawerSpec('reader-action-sheet'); }
  private drawerScheme(): string { return this.scheme === 'auto' ? this.appThemeScheme : this.scheme; }
  private drawerInset(): number {
    const spec = this.drawerSpec();
    return this.surfaceWidth <= spec.compactViewportWidth ? spec.compactSideContentInset : spec.sideContentInset;
  }

  @Builder private actionSheetHeader() {
    if (this.placement === 'side') {
      Column() {
        Row({ space: 12 }) {
          Text(this.title).fontFamily(this.drawerSpec().sideTitleFontFamily).fontWeight(this.drawerSpec().sideTitleFontWeight)
            .fontSize(this.drawerSpec().sideTitleFontSize).lineHeight(this.drawerSpec().sideTitleLineHeight)
            .minFontScale(this.drawerSpec().titleMinFontScale).maxFontScale(this.drawerSpec().titleMaxFontScale)
            .fontColor(readerAppColor(this.drawerSpec().inkRole, this.drawerScheme())).layoutWeight(1);
          this.drawerClose();
        }.width('100%').height(this.drawerSpec().sideHeaderHeight)
          .border({ width: { bottom: 1 }, color: readerAppColor(this.drawerSpec().lineRole, this.drawerScheme()) });
      }.width('100%').padding({ left: this.drawerInset(), right: this.drawerInset() })
        .margin({ bottom: this.drawerSpec().sideHeaderBottom });
    } else {
      Stack({ alignContent: Alignment.TopEnd }) {
        Column() {
          Row() {
            Blank().width(this.drawerSpec().handleWidth).height(this.drawerSpec().handleHeight).borderRadius(3)
              .backgroundColor(readerAppColor(this.drawerSpec().handleRole, this.drawerScheme()));
          }.width('100%').height(this.drawerSpec().handleZone).justifyContent(FlexAlign.Center)
            .gesture(PanGesture({ fingers: 1, direction: PanDirection.Vertical, distance: 1 })
              .onActionStart((): void => this.onHandlePanStart())
              .onActionUpdate((event: GestureEvent): void => this.onHandlePanUpdate(event.offsetY))
              .onActionEnd((event: GestureEvent): void => this.onHandlePanEnd(event.offsetY, event.velocityY))
              .onActionCancel((): void => this.onHandlePanEnd(0, 0)));
          Text(this.title).fontFamily(this.drawerSpec().titleFontFamily).fontWeight(this.drawerSpec().titleFontWeight)
            .fontSize(this.drawerSpec().titleFontSize).lineHeight(this.drawerSpec().titleLineHeight)
            .minFontScale(this.drawerSpec().titleMinFontScale).maxFontScale(this.drawerSpec().titleMaxFontScale)
            .fontColor(readerAppColor(this.drawerSpec().inkRole, this.drawerScheme())).width('100%')
            .padding({ left: this.drawerSpec().contentInset, right: this.drawerSpec().contentInset + this.drawerSpec().closeSize, bottom: this.drawerSpec().titleBottom });
        }.width('100%');
        this.drawerClose();
      }.width('100%');
    }
  }

  @Builder private drawerClose() {
    Row() {
      Image(this.drawerScheme() === 'night' ? $r('app.media.manga_sheet_close_theme_night') : $r('app.media.manga_sheet_close'))
        .width(this.drawerSpec().closeIcon).height(this.drawerSpec().closeIcon);
    }.width(this.drawerSpec().closeSize).height(this.drawerSpec().closeSize).justifyContent(FlexAlign.Center)
      .margin(this.placement === 'side' ? {} : { top: this.drawerSpec().closeTop, right: this.drawerSpec().closeRight })
      .enabled(this.actionEnabled).accessibilityText(this.placement === 'side' ? '关闭宽屏面板' : '关闭面板')
      .onClick((): void => { if (this.actionEnabled) this.onClose(); });
  }

  @Builder private localImportHeader() {
    Column() {
      if (this.specId === 'local-import-selection') {
        Row() { this.importTitle(); }.width('100%').padding({ left: 20, right: 20, top: 20, bottom: 17 }).alignItems(VerticalAlign.Center);
      } else {
        Text(this.title).fontFamily(TYPE_FILE_IMPORT_TITLE.fontFamily).fontWeight(TYPE_FILE_IMPORT_TITLE.fontWeight)
          .fontSize(TYPE_FILE_IMPORT_TITLE.fontSizeFp).lineHeight(TYPE_FILE_IMPORT_TITLE.lineHeightFp as number)
          .fontColor(readerAppColor('TOK_INK', this.appThemeScheme)).maxLines(1).width('100%')
          .padding({ left: 20, right: 20, top: 20, bottom: 17 });
      }
      Blank().width('100%').height(1).backgroundColor(readerAppColor(this.specId === 'local-import-selection' ?
        'app.LocalImportDialog.fileSelectionPanel.backgroundColor.FFE8E2D9' : 'app.LocalImportDialog.resultHeader.backgroundColor.FFE8E2D9', this.appThemeScheme));
    }.width('100%').onAreaChange((oldValue: Area, next: Area): void => this.onAreaChanged(oldValue, next));
  }

  @Builder private importTitle() {
    Text(this.title).fontFamily(TYPE_FILE_IMPORT_TITLE.fontFamily).fontWeight(TYPE_FILE_IMPORT_TITLE.fontWeight)
      .fontSize(TYPE_FILE_IMPORT_TITLE.fontSizeFp).lineHeight(TYPE_FILE_IMPORT_TITLE.lineHeightFp as number)
      .fontColor(readerAppColor('TOK_INK', this.appThemeScheme)).maxLines(1);
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
    Text(this.title).layoutWeight(1).attributeModifier(new ReaderBoundedTitleModifier(this.specId, this.appThemeScheme));
  }

  @Builder private closeAction() {
    if (this.specId === 'source-switch-window') {
      Stack({ alignContent: Alignment.Center }) {
        Stack({ alignContent: Alignment.Center }) {
          Image(this.appThemeScheme === 'night' ? $r('app.media.source_switch_close_theme_night') : $r('app.media.source_switch_close')).width(20).height(20);
        }.width(22).height(22).borderRadius(8).backgroundColor(readerAppColor('TOK_SS_CLOSE_BG', this.appThemeScheme));
      }.width(44).height(44).margin({ left: 1 }).enabled(this.actionEnabled)
        .onClick((): void => { if (this.actionEnabled) this.onClose(); });
    } else {
      Image(this.appThemeScheme === 'night' ? $r('app.media.reader_tts_make_close_theme_night') : $r('app.media.reader_tts_make_close')).width(16).height(16)
        .responseRegion({ x: -6, y: -6, width: 28, height: 28 }).enabled(this.actionEnabled)
        .accessibilityText('关闭 TTS 配置').onClick((): void => { if (this.actionEnabled) this.onClose(); });
    }
  }
}
