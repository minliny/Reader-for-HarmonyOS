import { TYPE_SOURCE_SWITCH_HEADING, TYPE_READER_TTS_MANAGER_TITLE, TYPE_READER_TTS_CONFIGURATION_TITLE, TYPE_FILE_IMPORT_TITLE, TYPE_READER_REPLACE_RETAINED_TEMPORARY_OVERLAY_VALUE } from '../foundation/ReaderTypography';
import { readerAppColor } from '../foundation/ReaderThemeRegistry';
import { SheetSurfaceSpec, DrawerSurfaceSpec, resolveSheetSpec, resolveDrawerSpec } from './ReaderSurfaceSpecs';
import type { ReaderBoundedSurfaceId } from './ReaderBoundedSurface';

/** Preserve the excluded side-placement policy without overriding Native
 * Button focus defaults on the phone drawer. */
class ReaderDrawerCloseFocusModifier implements AttributeModifier<ButtonAttribute> {
  private readonly placement: 'bottom' | 'side';
  private readonly enabled: boolean;
  constructor(placement: 'bottom' | 'side', enabled: boolean) {
    this.placement = placement;
    this.enabled = enabled;
  }
  applyNormalAttribute(instance: ButtonAttribute): void {
    if (this.placement === 'side') instance.focusable(this.enabled);
  }
}

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
  // Only the embedded reading replacement editor supplies a natural header budget.
  @Prop naturalHeaderHeightVp: number = 0;
  @Prop surfaceWidth: number = 300;
  @Prop actionEnabled: boolean = true;
  @Prop closeFocusId: string = '';
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
      }.width('100%').height(this.naturalHeaderHeightVp > 0 ? Math.max(28, this.naturalHeaderHeightVp) : 28);
    } else if (this.specId === 'bookshelf-book-action' || this.specId === 'search-result-filter' || this.specId === 'search-task-status') {
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
    Column({ space: 0 }) {
      if (this.placement === 'bottom') {
        Row() {
          Blank().width(this.drawerSpec().handleWidth).height(this.drawerSpec().handleHeight).borderRadius(3)
            .backgroundColor(readerAppColor(this.drawerSpec().handleRole, this.drawerScheme()));
        }.width('100%').justifyContent(FlexAlign.Center)
          .padding({ top: this.drawerSpec().handleTop, bottom: this.drawerSpec().handleBottom })
          .gesture(PanGesture({ fingers: 1, direction: PanDirection.Vertical, distance: 1 })
            .onActionStart((): void => this.onHandlePanStart())
            .onActionUpdate((event: GestureEvent): void => this.onHandlePanUpdate(event.offsetY))
            .onActionEnd((event: GestureEvent): void => this.onHandlePanEnd(event.offsetY, event.velocityY))
            .onActionCancel((): void => this.onHandlePanEnd(0, 0)));
      }
      Row({ space: 12 }) {
        Text(this.title).fontFamily(this.drawerSpec().titleFontFamily).fontWeight(this.drawerSpec().titleFontWeight)
          .fontSize(this.drawerSpec().titleFontSize).lineHeight(this.drawerSpec().titleLineHeight).halfLeading(true)
          .minFontScale(this.drawerSpec().titleMinFontScale).maxFontScale(this.drawerSpec().titleMaxFontScale)
          .fontColor(readerAppColor(this.drawerSpec().inkRole, this.drawerScheme())).layoutWeight(1)
          .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis });
        this.drawerClose();
      }.width('100%').constraintSize({ minHeight: this.drawerSpec().titleHeight })
        .padding({ left: this.drawerInset(), right: this.drawerInset() });
    }.width('100%')
      .padding(this.placement === 'side' ? { top: this.drawerSpec().handleTop, bottom: this.drawerSpec().handleBottom } : {})
      .onAreaChange((oldValue: Area, next: Area): void => this.onAreaChanged(oldValue, next));
  }

  @Builder private drawerClose() {
    Button({ type: ButtonType.Normal, stateEffect: false }) {
      Image(this.drawerScheme() === 'night' ? $r('app.media.source_switch_close_theme_night') : $r('app.media.source_switch_close'))
        .width(this.drawerSpec().closeIcon).height(this.drawerSpec().closeIcon);
    }.id(this.closeFocusId).width(this.drawerSpec().closeSize).height(this.drawerSpec().closeSize).padding(0)
      .backgroundColor(Color.Transparent).borderRadius(8)
      .enabled(this.actionEnabled)
      .attributeModifier(new ReaderDrawerCloseFocusModifier(this.placement, this.actionEnabled))
      .accessibilityText(this.placement === 'side' ? '关闭宽屏面板' : '关闭面板')
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
        'app.import.separator' : 'app.import.separator', this.appThemeScheme));
    }.width('100%').onAreaChange((oldValue: Area, next: Area): void => this.onAreaChanged(oldValue, next));
  }

  @Builder private importTitle() {
    Text(this.title).fontFamily(TYPE_FILE_IMPORT_TITLE.fontFamily).fontWeight(TYPE_FILE_IMPORT_TITLE.fontWeight)
      .fontSize(TYPE_FILE_IMPORT_TITLE.fontSizeFp).lineHeight(TYPE_FILE_IMPORT_TITLE.lineHeightFp as number)
      .fontColor(readerAppColor('TOK_INK', this.appThemeScheme)).maxLines(1);
  }

  private sheetSpec(): SheetSurfaceSpec {
    const id = this.specId;
    return resolveSheetSpec(id === 'search-result-filter' || id === 'search-task-status' ? id : 'bookshelf-book-action');
  }

  @Builder private sheetHeader() {
    Column({ space: 0 }) {
      Row() {
        Blank().width(this.sheetSpec().handleWidth).height(this.sheetSpec().handleHeight)
          .backgroundColor(readerAppColor(this.sheetSpec().handleRole, this.appThemeScheme)).borderRadius(999);
      }.width('100%').justifyContent(FlexAlign.Center)
        .margin({ top: this.sheetSpec().handleTop, bottom: this.sheetSpec().handleBottom });
      Row({ space: this.sheetSpec().compactHeader ? this.sheetSpec().titleGap : 0 }) {
        Text(this.title).fontFamily(this.sheetSpec().titleFontFamily).fontWeight(this.sheetSpec().titleFontWeight)
          .fontSize(this.sheetSpec().titleFontSize).lineHeight(this.sheetSpec().titleLineHeight).halfLeading(true)
          .fontColor(readerAppColor(this.sheetSpec().titleRole, this.appThemeScheme)).maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
          .width(this.sheetSpec().compactHeader ? undefined : '100%')
          .layoutWeight(this.sheetSpec().compactHeader ? 1 : 0);
        if (this.sheetSpec().compactHeader) {
          this.accessory();
          this.sheetClose();
        }
      }.width('100%').constraintSize({ minHeight: this.sheetSpec().titleHeight })
        .padding({ left: this.sheetSpec().titleInset, right: this.sheetSpec().titleInset });
    }.width('100%').padding({ bottom: this.sheetSpec().titleBottom })
      .onAreaChange((oldValue: Area, next: Area): void => this.onAreaChanged(oldValue, next));
  }

  @Builder private sheetClose() {
    Button({ type: ButtonType.Normal }) {
      Image(this.appThemeScheme === 'night' ? $r('app.media.reader_action_close_theme_night') : $r('app.media.reader_action_close'))
        .width(this.sheetSpec().closeIcon).height(this.sheetSpec().closeIcon);
    }.width(this.sheetSpec().closeSize).height(this.sheetSpec().closeSize).padding(0)
      .backgroundColor(Color.Transparent).enabled(this.actionEnabled).accessibilityText('关闭面板')
      .onClick((): void => { if (this.actionEnabled) this.onClose(); });
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
      Button({ type: ButtonType.Normal, stateEffect: false }) {
        Stack({ alignContent: Alignment.Center }) {
          Image(this.appThemeScheme === 'night' ? $r('app.media.source_switch_close_theme_night') : $r('app.media.source_switch_close'))
            .width(20).height(20).accessibilityLevel('no');
        }.width(22).height(22).borderRadius(8).backgroundColor(readerAppColor('TOK_SS_CLOSE_BG', this.appThemeScheme));
      }.width(44).height(44).padding(0).backgroundColor(Color.Transparent).margin({ left: 1 })
        .id(this.closeFocusId).enabled(this.actionEnabled).focusable(this.actionEnabled)
        .accessibilityText('关闭换源')
        .onClick((): void => { if (this.actionEnabled) this.onClose(); });
    } else {
      Button({ type: ButtonType.Normal, stateEffect: false }) {
        Image(this.appThemeScheme === 'night' ? $r('app.media.reader_tts_make_close_theme_night') : $r('app.media.reader_tts_make_close'))
          .width(16).height(16).accessibilityLevel('no');
      }.width(16).height(16).padding(0).backgroundColor(Color.Transparent)
        .id(this.closeFocusId)
        .responseRegion({ x: -6, y: -6, width: 28, height: 28 }).enabled(this.actionEnabled)
        .accessibilityText('关闭 TTS 配置').onClick((): void => { if (this.actionEnabled) this.onClose(); });
    }
  }
}
