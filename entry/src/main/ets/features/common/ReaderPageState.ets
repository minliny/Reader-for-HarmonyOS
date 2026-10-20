import { LengthMetrics } from '@kit.ArkUI';
import { MESSAGE_TITLE, MESSAGE_BODY } from './ReaderMessageStyle';
import { readerAppColor } from './ReaderThemeRegistry';
import { ReaderRecoveryAction } from './ReaderRecoveryAction';

/** Content-state presentation only. The page retains loading/empty/failure
 * facts, retry admission and the bounds of its original content region. */
@Component
export struct ReaderPageState {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  @Prop title: string = '';
  @Prop message: string = '';
  @Prop loading: boolean = false;
  @Prop actionLabel: string = '';
  @Prop secondaryActionLabel: string = '';
  @Prop actionEnabled: boolean = true;
  @Prop secondaryActionEnabled: boolean = true;
  @Prop padded: boolean = true;
  @Prop customActions: boolean = false;
  @BuilderParam leading: () => void = this.emptySlot;
  @BuilderParam actionContent: () => void = this.emptySlot;
  @Prop inkColor: ResourceColor | undefined = undefined;
  @Prop mutedColor: ResourceColor | undefined = undefined;
  onAction: () => void = (): void => {};
  onSecondaryAction: () => void = (): void => {};

  @Builder
  private emptySlot() {}

  build() {
    Column({ space: 12 }) {
      this.leading();
      if (this.loading) {
        LoadingProgress().width(32).height(32)
          .color(this.mutedColor ?? readerAppColor('TOK_MESSAGE_SOFT_INK', this.appThemeScheme))
          .accessibilityText('载入中');
      }
      if (this.title.length > 0) {
        Text(this.title).width('100%').textAlign(TextAlign.Center)
          .fontFamily(MESSAGE_TITLE.fontFamily).fontWeight(MESSAGE_TITLE.fontWeight)
          .fontSize(MESSAGE_TITLE.fontSizeFp).lineHeight(MESSAGE_TITLE.lineHeightFp as number)
          .fontColor(this.inkColor ?? readerAppColor('TOK_MESSAGE_INK', this.appThemeScheme));
      }
      if (this.message.length > 0) {
        Text(this.message).width('100%').textAlign(TextAlign.Center)
          .fontFamily(MESSAGE_BODY.fontFamily).fontWeight(MESSAGE_BODY.fontWeight)
          .fontSize(MESSAGE_BODY.fontSizeFp).lineHeight(MESSAGE_BODY.lineHeightFp as number)
          .fontColor(this.mutedColor ?? readerAppColor('TOK_MESSAGE_MUTED', this.appThemeScheme));
      }
      if (!this.loading && this.customActions) {
        this.actionContent();
      } else if (!this.loading && (this.actionLabel.length > 0 || this.secondaryActionLabel.length > 0)) {
        Flex({ justifyContent: FlexAlign.Center, wrap: FlexWrap.Wrap, space: { main: LengthMetrics.vp(10), cross: LengthMetrics.vp(10) } }) {
          if (this.actionLabel.length > 0) {
            ReaderRecoveryAction({ label: this.actionLabel, actionEnabled: this.actionEnabled,
              onReconcile: (): void => this.onAction() });
          }
          if (this.secondaryActionLabel.length > 0) {
            ReaderRecoveryAction({ label: this.secondaryActionLabel, actionEnabled: this.secondaryActionEnabled,
              onReconcile: (): void => this.onSecondaryAction() });
          }
        }.width('100%');
      }
    }.width('100%').padding({ left: this.padded ? 20 : 0, right: this.padded ? 20 : 0,
      top: this.padded ? 24 : 0, bottom: this.padded ? 24 : 0 });
  }
}
