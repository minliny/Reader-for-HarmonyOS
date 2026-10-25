import { readerAppColor } from './ReaderThemeRegistry';
import { readerReadableFontScale, readerScaledControlHeight } from './ReaderSurfaceResolvers';
import { ReaderWindowCoordinator } from '../../app/ReaderWindowCoordinator';
import { TYPE_FILE_IMPORT_ACTION, TYPE_FILE_IMPORT_CANCEL,
  TYPE_READER_TTS_CONFIG_MANAGER_FOOTER_CANCEL, TYPE_READER_TTS_CONFIG_MANAGER_FOOTER_SAVE,
  TYPE_READER_REPLACE_RETAINED_EDITOR_ACTIONS_CANCEL, TYPE_READER_REPLACE_RETAINED_EDITOR_ACTIONS_SAVE } from './ReaderTypography';
import { TOK_SPACE_SM, TOK_SPACE_XS, TOK_BORDER_W } from './ReaderTokens';

export type ReaderBoundedActionSpecId = 'local-file-selection' | 'local-import-result' | 'tts-manager' | 'replace-editor';
export type ReaderBoundedActionId = 'primary' | 'cancel';

/** Match original AUTO width or weighted selection without undefined resets. */
export class ReaderBoundedFileActionModifier implements AttributeModifier<CommonAttribute> {
  private readonly id: ReaderBoundedActionSpecId;
  private readonly width: number;
  constructor(id: ReaderBoundedActionSpecId, width: number) { this.id = id; this.width = width; }
  applyNormalAttribute(instance: CommonAttribute): void {
    if (this.id === 'local-import-result') instance.width(this.width);
    else instance.layoutWeight(1);
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
          top: Math.min(16, Math.max(0, (this.availableHeight - 40) / 2)),
          bottom: Math.min(20, Math.max(0, (this.availableHeight - 40) / 2)) })
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
        .width('100%').height(this.scaledHeight(36, TYPE_READER_REPLACE_RETAINED_EDITOR_ACTIONS_SAVE.lineHeightFp))
        .flexShrink(0);
    }
  }

  private scaledHeight(baseHeight: number, lineHeight: number | undefined): number {
    return readerScaledControlHeight(baseHeight, lineHeight === undefined ? 20 : lineHeight, this.fontScale());
  }

  private fontScale(): number {
    if (this.readerWindowMetricsRevision < 0) return 1;
    return readerReadableFontScale(ReaderWindowCoordinator.metrics().systemFontScale);
  }

  private actionEnabled(id: ReaderBoundedActionId): boolean { return id === 'primary' ? this.primaryEnabled : this.cancelEnabled; }
  private dispatch(id: ReaderBoundedActionId): void { if (this.actionEnabled(id)) this.onAction(id); }

  @Builder private fileAction(id: ReaderBoundedActionId) {
    if (id === 'cancel') {
      Row({ space: 6 }) {
        Image(this.appThemeScheme === 'night' ? $r('app.media.import_cancel_theme_night') : $r('app.media.import_cancel')).width(13).height(13);
        Text('取消').fontFamily(TYPE_FILE_IMPORT_CANCEL.fontFamily).fontWeight(TYPE_FILE_IMPORT_CANCEL.fontWeight)
          .fontSize(TYPE_FILE_IMPORT_CANCEL.fontSizeFp).lineHeight(TYPE_FILE_IMPORT_CANCEL.lineHeightFp as number)
          .letterSpacing(TYPE_FILE_IMPORT_CANCEL.letterSpacingFp as number).fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme));
      }.height(this.scaledHeight(44, TYPE_FILE_IMPORT_CANCEL.lineHeightFp)).padding({ left: 21, right: 21 }).justifyContent(FlexAlign.Center)
        .border({ width: TOK_BORDER_W, color: readerAppColor('TOK_BORDER', this.appThemeScheme) }).borderRadius(22)
        .enabled(this.cancelEnabled).onClick((): void => this.dispatch(id));
    } else {
      Row({ space: this.specId === 'local-import-result' ? 6 : TOK_SPACE_XS }) {
        Image(this.specId === 'local-import-result' ? $r('app.media.import_done') : $r('app.media.import_choose_file'))
          .width(this.specId === 'local-import-result' ? 14 : 15).height(this.specId === 'local-import-result' ? 14 : 15);
        Text(this.primaryLabel).fontFamily(TYPE_FILE_IMPORT_ACTION.fontFamily).fontWeight(TYPE_FILE_IMPORT_ACTION.fontWeight)
          .fontSize(TYPE_FILE_IMPORT_ACTION.fontSizeFp).lineHeight(TYPE_FILE_IMPORT_ACTION.lineHeightFp as number)
          .letterSpacing(TYPE_FILE_IMPORT_ACTION.letterSpacingFp as number).fontColor(readerAppColor('TOK_ON_PRIMARY', this.appThemeScheme));
      }.attributeModifier(new ReaderBoundedFileActionModifier(this.specId, this.actionWidth))
        .height(this.scaledHeight(this.specId === 'local-import-result' ? 40 : 44, TYPE_FILE_IMPORT_ACTION.lineHeightFp)).justifyContent(FlexAlign.Center)
        .backgroundColor(readerAppColor('app.action.fill', this.appThemeScheme)).borderRadius(this.specId === 'local-import-result' ? 20 : 22)
        .enabled(this.primaryEnabled).onClick((): void => this.dispatch(id));
    }
  }

  @Builder private textAction(id: ReaderBoundedActionId) {
    if (this.specId === 'tts-manager') {
      if (id === 'cancel') {
        Text('取消').layoutWeight(1).height(this.scaledHeight(44, TYPE_READER_TTS_CONFIG_MANAGER_FOOTER_CANCEL.lineHeightFp)).fontFamily(TYPE_READER_TTS_CONFIG_MANAGER_FOOTER_CANCEL.fontFamily)
          .fontWeight(TYPE_READER_TTS_CONFIG_MANAGER_FOOTER_CANCEL.fontWeight).fontSize(TYPE_READER_TTS_CONFIG_MANAGER_FOOTER_CANCEL.fontSizeFp)
          .fontColor(readerAppColor('app.ReaderTtsConfigOverlay.managerFooter.fontColor.FF5B5046', this.appThemeScheme)).textAlign(TextAlign.Center)
          .backgroundColor(readerAppColor('app.ReaderTtsConfigOverlay.managerFooter.backgroundColor.29B4A697', this.appThemeScheme)).borderRadius(12)
          .enabled(this.cancelEnabled).onClick((): void => this.dispatch(id));
      } else {
        Text(this.primaryLabel).layoutWeight(1).height(this.scaledHeight(44, TYPE_READER_TTS_CONFIG_MANAGER_FOOTER_SAVE.lineHeightFp)).fontFamily(TYPE_READER_TTS_CONFIG_MANAGER_FOOTER_SAVE.fontFamily)
          .fontWeight(TYPE_READER_TTS_CONFIG_MANAGER_FOOTER_SAVE.fontWeight).fontSize(TYPE_READER_TTS_CONFIG_MANAGER_FOOTER_SAVE.fontSizeFp)
          .fontColor(readerAppColor('app.ReaderTtsConfigOverlay.managerFooter.fontColor.FFFFFAF4', this.appThemeScheme)).textAlign(TextAlign.Center)
          .linearGradient({ angle: 155, colors: [[readerAppColor('app.ReaderTtsConfigOverlay.managerFooter.linearGradient.FF2F6373', this.appThemeScheme), 0], [readerAppColor('app.ReaderTtsConfigOverlay.managerFooter.linearGradient.FF244F5C', this.appThemeScheme), 1]] }).borderRadius(12)
          .shadow({ radius: 12, color: readerAppColor('app.ReaderTtsConfigOverlay.managerFooter.color.4D2F6373', this.appThemeScheme), offsetY: 4 })
          .enabled(this.primaryEnabled).opacity(this.primaryEnabled ? 1 : 0.42).onClick((): void => this.dispatch(id));
      }
    } else {
      if (id === 'cancel') {
        Text('取消').fontFamily(TYPE_READER_REPLACE_RETAINED_EDITOR_ACTIONS_CANCEL.fontFamily as string)
          .fontSize(TYPE_READER_REPLACE_RETAINED_EDITOR_ACTIONS_CANCEL.fontSizeFp).fontColor(readerAppColor('TOK_READ_INK', this.appThemeScheme))
          .layoutWeight(1).height(this.scaledHeight(36, TYPE_READER_REPLACE_RETAINED_EDITOR_ACTIONS_CANCEL.lineHeightFp)).textAlign(TextAlign.Center).borderRadius(6)
          .backgroundColor(readerAppColor('TOK_SURFACE_PANEL_SOFT', this.appThemeScheme))
          .border({ width: TOK_BORDER_W, color: readerAppColor('TOK_LINE', this.appThemeScheme) })
          .enabled(this.cancelEnabled).onClick((): void => this.dispatch(id));
      } else {
        Text(this.primaryLabel).fontFamily(TYPE_READER_REPLACE_RETAINED_EDITOR_ACTIONS_SAVE.fontFamily as string)
          .fontSize(TYPE_READER_REPLACE_RETAINED_EDITOR_ACTIONS_SAVE.fontSizeFp)
          .fontColor(readerAppColor('app.ReaderControlReplaceContent.toolbarButton.fontColor.FFFFFFFF', this.appThemeScheme))
          .layoutWeight(1).height(this.scaledHeight(36, TYPE_READER_REPLACE_RETAINED_EDITOR_ACTIONS_SAVE.lineHeightFp)).textAlign(TextAlign.Center).borderRadius(6)
          .backgroundColor(readerAppColor('TOK_READ_PRIMARY', this.appThemeScheme))
          .enabled(this.primaryEnabled).onClick((): void => this.dispatch(id));
      }
    }
  }
}
