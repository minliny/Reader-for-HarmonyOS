import { LengthMetrics } from '@kit.ArkUI';
import { MESSAGE_TITLE, MESSAGE_BODY, MESSAGE_LIST_TITLE, MESSAGE_LIST_BODY } from './ReaderMessageStyle';
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
  @Prop loadingActive: boolean = true;
  @Prop actionLabel: string = '';
  @Prop secondaryActionLabel: string = '';
  @Prop actionEnabled: boolean = true;
  @Prop secondaryActionEnabled: boolean = true;
  @Prop padded: boolean = true;
  /** Quiet list-empty tone from the audited search demo (.list-empty). */
  @Prop listTone: boolean = false;
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
    Column({ space: this.listTone ? 0 : 12 }) {
      this.leading();
      if (this.loading) {
        LoadingProgress().width(32).height(32).enableLoading(this.loadingActive)
          .color(this.mutedColor ?? readerAppColor(this.listTone ? 'TOK_MUTED' : 'TOK_MESSAGE_SOFT_INK', this.appThemeScheme))
          .margin({ bottom: this.listTone ? 8 : 0 })
          .accessibilityText('载入中');
      }
      if (this.title.length > 0) {
        Text(this.title).width('100%').textAlign(TextAlign.Center)
          .fontFamily(this.listTone ? MESSAGE_LIST_TITLE.fontFamily : MESSAGE_TITLE.fontFamily)
          .fontWeight(this.listTone ? MESSAGE_LIST_TITLE.fontWeight : MESSAGE_TITLE.fontWeight)
          .fontSize(this.listTone ? MESSAGE_LIST_TITLE.fontSizeFp : MESSAGE_TITLE.fontSizeFp)
          .lineHeight((this.listTone ? MESSAGE_LIST_TITLE.lineHeightFp : MESSAGE_TITLE.lineHeightFp) as number)
          .margin({ bottom: this.listTone ? 8 : 0 })
          .fontColor(this.inkColor ?? readerAppColor(this.listTone ? 'TOK_MUTED' : 'TOK_MESSAGE_INK', this.appThemeScheme));
      }
      if (this.message.length > 0) {
        Text(this.message).width('100%').textAlign(TextAlign.Center)
          .fontFamily(this.listTone ? MESSAGE_LIST_BODY.fontFamily : MESSAGE_BODY.fontFamily)
          .fontWeight(this.listTone ? MESSAGE_LIST_BODY.fontWeight : MESSAGE_BODY.fontWeight)
          .fontSize(this.listTone ? MESSAGE_LIST_BODY.fontSizeFp : MESSAGE_BODY.fontSizeFp)
          .lineHeight((this.listTone ? MESSAGE_LIST_BODY.lineHeightFp : MESSAGE_BODY.lineHeightFp) as number)
          .margin({ bottom: this.listTone ? 14 : 0 })
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
    }.width('100%').padding(this.listTone
      ? { left: this.padded ? 8 : 0, right: this.padded ? 8 : 0,
        top: this.padded ? 34 : 0, bottom: this.padded ? 34 : 0 }
      : { left: this.padded ? 20 : 0, right: this.padded ? 20 : 0,
        top: this.padded ? 24 : 0, bottom: this.padded ? 24 : 0 });
  }
}
