import { readerAppColor } from '../foundation/ReaderThemeRegistry';
import { readerReadableFontScale, readerScaledControlHeight } from '../foundation/ReaderSurfaceResolvers';
import { readerWindowMetrics } from '../foundation/ReaderWindowEnvironment';
import { TYPE_FILE_IMPORT_ACTION, TYPE_FILE_IMPORT_CANCEL,
  TYPE_READER_TTS_CONFIG_MANAGER_FOOTER_CANCEL, TYPE_READER_TTS_CONFIG_MANAGER_FOOTER_SAVE,
  TYPE_READER_REPLACE_RETAINED_EDITOR_ACTIONS_CANCEL, TYPE_READER_REPLACE_RETAINED_EDITOR_ACTIONS_SAVE } from '../foundation/ReaderTypography';
import { TOK_SPACE_SM, TOK_SPACE_XS, TOK_BORDER_W } from '../foundation/ReaderTokens';
import { ReaderPressFeedback } from '../foundation/ReaderPressFeedback';
import { readerSurfaceElevation } from './ReaderSurfaceSpecs';

export type ReaderBoundedActionSpecId = 'local-file-selection' | 'local-import-result' | 'tts-manager' | 'replace-editor';
export type ReaderBoundedActionId = 'primary' | 'cancel';

/** Match original AUTO width or weighted selection without undefined resets. */
export class ReaderBoundedFileActionModifier implements AttributeModifier<CommonAttribute> {
  private readonly id: ReaderBoundedActionSpecId;
  private readonly width: number;
  private readonly feedback: ReaderPressFeedback;
  constructor(id: ReaderBoundedActionSpecId, width: number, scheme: string, enabled: boolean) {
    this.id = id;
    this.width = width;
    this.feedback = new ReaderPressFeedback(readerAppColor('app.action.fill', scheme), scheme, 999, 999, enabled);
  }
  applyNormalAttribute(instance: CommonAttribute): void {
    if (this.id === 'local-import-result') instance.width(this.width);
    else instance.layoutWeight(1);
    this.feedback.applyNormalAttribute(instance);
  }
  applyPressedAttribute(instance: CommonAttribute): void {
    this.applyNormalAttribute(instance);
    this.feedback.applyPressedAttribute(instance);
  }
}

class ReaderBoundedTtsPrimaryPaint implements AttributeModifier<CommonAttribute> {
  private readonly scheme: string;
  private readonly enabled: boolean;
  constructor(scheme: string, enabled: boolean) { this.scheme = scheme; this.enabled = enabled; }
  applyNormalAttribute(instance: CommonAttribute): void { this.paint(instance, false); }
  applyPressedAttribute(instance: CommonAttribute): void { this.paint(instance, this.enabled); }
  private paint(instance: CommonAttribute, pressed: boolean): void {
    const start = readerAppColor('TOK_READ_PRIMARY', this.scheme);
    const end = readerAppColor('TOK_TTS_PLAY_END', this.scheme);
    instance.borderRadius(999).linearGradient({ angle: 155, colors: [
      [pressed ? new ReaderPressFeedback(start, this.scheme).pressedSurface() : start, 0],
      [pressed ? new ReaderPressFeedback(end, this.scheme).pressedSurface() : end, 1],
    ] });
  }
}

/** Finite real action regions. Owner provides current admission and intent;
 * this component owns existing row/body padding, targets, icons and styles.
 * It owns no draft, task, retry or dismissal lifecycle. */
@Component
export struct ReaderBoundedSurfaceActions {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  @StorageLink('readerWindowMetricsRevision') private readerWindowMetricsRevision: number = 0;
  @Prop specId: ReaderBoundedActionSpecId = 'tts-manager';
  @Prop primaryLabel: string = '保存';
  @Prop primaryEnabled: boolean = true;
  @Prop cancelEnabled: boolean = true;
  @Prop actionWidth: number = 0;
  @Prop availableHeight: number = 844;
  @BuilderParam feedback: () => void = this.emptySlot;
  onAction: (id: ReaderBoundedActionId) => void = (_id: ReaderBoundedActionId): void => {};
  onAreaChanged: (oldValue: Area, next: Area) => void = (_oldValue: Area, _next: Area): void => {};
  @Builder private emptySlot() {}

  build() {
    if (this.specId === 'local-import-result') {
      Column() { this.feedback(); this.fileAction('primary'); }
        .width('100%').padding({ left: 16, right: 16,
          top: Math.min(16, Math.max(0, (this.availableHeight - 44) / 2)),
          bottom: Math.min(20, Math.max(0, (this.availableHeight - 44) / 2)) })
        .onAreaChange((oldValue: Area, next: Area): void => this.onAreaChanged(oldValue, next));
    } else if (this.specId === 'local-file-selection') {
      Column() {
        Row({ space: TOK_SPACE_SM }) { this.fileAction('primary'); this.fileAction('cancel'); }
          .width('100%').padding({ top: 20, bottom: 20 });
      }.width('100%').padding({ left: 20, right: 20 });
    } else if (this.specId === 'tts-manager') {
      Row({ space: 10 }) { this.textAction('cancel'); this.textAction('primary'); }
        .width('100%').height(this.scaledHeight(76, TYPE_READER_TTS_CONFIG_MANAGER_FOOTER_SAVE.lineHeightFp))
        .padding({ left: 18, right: 18, top: 16, bottom: 16 });
    } else {
      Row({ space: 8 }) { this.textAction('cancel'); this.textAction('primary'); }
        .width('100%').height(this.scaledHeight(44, TYPE_READER_REPLACE_RETAINED_EDITOR_ACTIONS_SAVE.lineHeightFp))
        .flexShrink(0);
    }
  }

  private scaledHeight(baseHeight: number, lineHeight: number | undefined): number {
    return readerScaledControlHeight(baseHeight, lineHeight === undefined ? 20 : lineHeight, this.fontScale());
  }

  private fontScale(): number {
    if (this.readerWindowMetricsRevision < 0) return 1;
    return readerReadableFontScale(readerWindowMetrics().systemFontScale);
  }

  private actionEnabled(id: ReaderBoundedActionId): boolean { return id === 'primary' ? this.primaryEnabled : this.cancelEnabled; }
  private dispatch(id: ReaderBoundedActionId): void { if (this.actionEnabled(id)) this.onAction(id); }

  @Builder private fileAction(id: ReaderBoundedActionId) {
    if (id === 'cancel') {
      Button({ type: ButtonType.Normal, stateEffect: false }) {
      Row({ space: 6 }) {
        Image(this.appThemeScheme === 'night' ? $r('app.media.import_cancel_theme_night') : $r('app.media.import_cancel'))
          .width(15).height(15).accessibilityLevel('no');
        Text('取消').fontFamily(TYPE_FILE_IMPORT_CANCEL.fontFamily).fontWeight(TYPE_FILE_IMPORT_CANCEL.fontWeight)
          .fontSize(TYPE_FILE_IMPORT_CANCEL.fontSizeFp).lineHeight(TYPE_FILE_IMPORT_CANCEL.lineHeightFp as number).halfLeading(true)
          .letterSpacing(TYPE_FILE_IMPORT_CANCEL.letterSpacingFp as number).fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme));
      }.justifyContent(FlexAlign.Center);
      }.padding(0)
        .height(this.scaledHeight(44, TYPE_FILE_IMPORT_CANCEL.lineHeightFp)).padding({ left: 21, right: 21 })
        .border({ width: TOK_BORDER_W, color: readerAppColor('TOK_BORDER', this.appThemeScheme) })
        .attributeModifier(new ReaderPressFeedback(Color.Transparent, this.appThemeScheme, 22, 22, this.cancelEnabled))
        .enabled(this.cancelEnabled).accessibilityText('取消').onClick((): void => this.dispatch(id));
    } else {
      Button({ type: ButtonType.Normal, stateEffect: false }) {
      Row({ space: this.specId === 'local-import-result' ? 6 : TOK_SPACE_XS }) {
        Image(this.specId === 'local-import-result' ?
          (this.appThemeScheme === 'night' ? $r('app.media.import_done_theme_night') : $r('app.media.import_done')) :
          (this.appThemeScheme === 'night' ? $r('app.media.import_choose_file_theme_night') : $r('app.media.import_choose_file')))
          .width(15).height(15).accessibilityLevel('no');
        Text(this.primaryLabel).fontFamily(TYPE_FILE_IMPORT_ACTION.fontFamily).fontWeight(TYPE_FILE_IMPORT_ACTION.fontWeight)
          .fontSize(TYPE_FILE_IMPORT_ACTION.fontSizeFp).lineHeight(TYPE_FILE_IMPORT_ACTION.lineHeightFp as number).halfLeading(true)
          .letterSpacing(TYPE_FILE_IMPORT_ACTION.letterSpacingFp as number).fontColor(readerAppColor('TOK_ON_PRIMARY', this.appThemeScheme));
      }.justifyContent(FlexAlign.Center);
      }.padding(0).attributeModifier(new ReaderBoundedFileActionModifier(this.specId, this.actionWidth, this.appThemeScheme, this.primaryEnabled))
        .height(this.scaledHeight(44, TYPE_FILE_IMPORT_ACTION.lineHeightFp))
        .enabled(this.primaryEnabled).accessibilityText(this.primaryLabel).onClick((): void => this.dispatch(id));
    }
  }

  @Builder private textAction(id: ReaderBoundedActionId) {
    if (this.specId === 'tts-manager') {
      if (id === 'cancel') {
        Button({ type: ButtonType.Normal, stateEffect: false }) {
        Text('取消').fontFamily(TYPE_READER_TTS_CONFIG_MANAGER_FOOTER_CANCEL.fontFamily)
          .fontWeight(TYPE_READER_TTS_CONFIG_MANAGER_FOOTER_CANCEL.fontWeight).fontSize(TYPE_READER_TTS_CONFIG_MANAGER_FOOTER_CANCEL.fontSizeFp)
          .fontColor(readerAppColor('TOK_READ_MUTED', this.appThemeScheme)).textAlign(TextAlign.Center);
        }.layoutWeight(1).height(this.scaledHeight(44, TYPE_READER_TTS_CONFIG_MANAGER_FOOTER_CANCEL.lineHeightFp)).padding(0)
          .attributeModifier(new ReaderPressFeedback(readerAppColor('app.reader.secondaryAction', this.appThemeScheme),
            this.appThemeScheme, 999, 999, this.cancelEnabled))
          .enabled(this.cancelEnabled).accessibilityText('取消').onClick((): void => this.dispatch(id));
      } else {
        Button({ type: ButtonType.Normal, stateEffect: false }) {
        Text(this.primaryLabel).fontFamily(TYPE_READER_TTS_CONFIG_MANAGER_FOOTER_SAVE.fontFamily)
          .fontWeight(TYPE_READER_TTS_CONFIG_MANAGER_FOOTER_SAVE.fontWeight).fontSize(TYPE_READER_TTS_CONFIG_MANAGER_FOOTER_SAVE.fontSizeFp)
          .fontColor(readerAppColor('app.control.onPrimary', this.appThemeScheme)).textAlign(TextAlign.Center);
        }.layoutWeight(1).height(this.scaledHeight(44, TYPE_READER_TTS_CONFIG_MANAGER_FOOTER_SAVE.lineHeightFp)).padding(0)
          .attributeModifier(new ReaderBoundedTtsPrimaryPaint(this.appThemeScheme, this.primaryEnabled))
          .shadow(readerSurfaceElevation('raised', this.appThemeScheme))
          .enabled(this.primaryEnabled).opacity(this.primaryEnabled ? 1 : 0.42).accessibilityText(this.primaryLabel).onClick((): void => this.dispatch(id));
      }
    } else {
      if (id === 'cancel') {
        Button({ type: ButtonType.Normal, stateEffect: false }) {
        Text('取消').fontFamily(TYPE_READER_REPLACE_RETAINED_EDITOR_ACTIONS_CANCEL.fontFamily as string)
          .fontSize(TYPE_READER_REPLACE_RETAINED_EDITOR_ACTIONS_CANCEL.fontSizeFp).fontColor(readerAppColor('TOK_READ_INK', this.appThemeScheme))
          .textAlign(TextAlign.Center);
      }.layoutWeight(1).height(this.scaledHeight(44, TYPE_READER_REPLACE_RETAINED_EDITOR_ACTIONS_CANCEL.lineHeightFp)).padding(0)
          .border({ width: TOK_BORDER_W, color: readerAppColor('TOK_LINE', this.appThemeScheme) })
          .attributeModifier(new ReaderPressFeedback(readerAppColor('TOK_SURFACE_PANEL_SOFT', this.appThemeScheme),
            this.appThemeScheme, 999, 999, this.cancelEnabled))
          .enabled(this.cancelEnabled).accessibilityText('取消').onClick((): void => this.dispatch(id));
      } else {
        Button({ type: ButtonType.Normal, stateEffect: false }) {
        Text(this.primaryLabel).fontFamily(TYPE_READER_REPLACE_RETAINED_EDITOR_ACTIONS_SAVE.fontFamily as string)
          .fontSize(TYPE_READER_REPLACE_RETAINED_EDITOR_ACTIONS_SAVE.fontSizeFp)
          .fontColor(readerAppColor('app.replace.onToolbarAction', this.appThemeScheme)).textAlign(TextAlign.Center);
        }.layoutWeight(1).height(this.scaledHeight(44, TYPE_READER_REPLACE_RETAINED_EDITOR_ACTIONS_SAVE.lineHeightFp)).padding(0)
          .attributeModifier(new ReaderPressFeedback(readerAppColor('TOK_READ_PRIMARY', this.appThemeScheme),
            this.appThemeScheme, 999, 999, this.primaryEnabled))
          .enabled(this.primaryEnabled).accessibilityText(this.primaryLabel).onClick((): void => this.dispatch(id));
      }
    }
  }
}
