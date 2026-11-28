import { readerAppColor } from '../foundation/ReaderAppColors';
import { readerReadableFontScale, readerScaledControlHeight } from '../foundation/ReaderSurfaceResolvers';
import { readerWindowMetrics } from '../foundation/ReaderWindowEnvironment';

/**
 * Shared styled wrapper for ArkUI SecurityComponent PasteButton so all URL/JSON
 * paste triggers adhere to Paper & Pine 2.0 height, radius, typography and contrast
 * without bypassing platform clipboard security authorization rules.
 */
@Component
export struct ReaderPasteButton {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  @StorageLink('readerWindowMetricsRevision') private readerWindowMetricsRevision: number = 0;
  @Prop actionEnabled: boolean = true;
  @Prop controlId: string = '';
  @Prop scheme: string = '';
  onPaste: (result: PasteButtonOnClickResult) => void = (_result: PasteButtonOnClickResult): void => {};

  private effectiveScheme(): string {
    return this.scheme.length > 0 ? this.scheme : this.appThemeScheme;
  }

  private fontScale(): number {
    return readerReadableFontScale(this.readerWindowMetricsRevision < 0 ? 1 : readerWindowMetrics().systemFontScale);
  }

  private buttonHeight(): number {
    return readerScaledControlHeight(32, 16, this.fontScale());
  }

  build() {
    PasteButton({
      icon: PasteIconStyle.LINES,
      text: PasteDescription.PASTE,
      buttonType: ButtonType.Capsule,
    })
      .id(this.controlId)
      .height(this.buttonHeight())
      .padding({ left: 10, right: 10, top: 4, bottom: 4 })
      .fontSize(12)
      .iconSize(14)
      .textIconSpace(4)
      .fontColor(readerAppColor(this.actionEnabled ? 'TOK_PRIMARY_DARK' : 'TOK_MUTED', this.effectiveScheme()))
      .iconColor(readerAppColor(this.actionEnabled ? 'TOK_PRIMARY_DARK' : 'TOK_MUTED', this.effectiveScheme()))
      .backgroundColor(readerAppColor('TOK_CARD_BG', this.effectiveScheme()))
      .borderStyle(BorderStyle.Solid)
      .borderWidth(1)
      .borderColor(readerAppColor('TOK_LINE_STRONG', this.effectiveScheme()))
      .enabled(this.actionEnabled)
      .onClick((_event: ClickEvent, result: PasteButtonOnClickResult): void => {
        if (this.actionEnabled) this.onPaste(result);
      });
  }
}
