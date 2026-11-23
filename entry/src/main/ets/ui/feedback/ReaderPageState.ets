import { LengthMetrics } from '@kit.ArkUI';
import { MESSAGE_TITLE, MESSAGE_BODY, MESSAGE_INLINE_STATE_SPACING } from '../foundation/ReaderMessageStyle';
import { readerAppColor } from '../foundation/ReaderThemeRegistry';
import { ReaderRecoveryAction } from './ReaderRecoveryAction';

/** Content-state presentation only. The page retains loading/empty/failure
 * facts, retry admission and the bounds of its original content region. */
@Component
export struct ReaderPageState {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  @StorageLink('readerAppForeground') private appForeground: boolean = true;
  @StorageLink('readerReduceMotion') private appReduceMotion: boolean = false;
  @Prop variant: 'default' | 'readingBookmark' | 'inline' = 'default';
  @Prop title: string = '';
  @Prop message: string = '';
  @Prop loading: boolean = false;
  @Prop loadingActive: boolean = true;
  @Prop loadingProgressId: string = '';
  @Prop actionLabel: string = '';
  @Prop actionGeneration: number = 0;
  @Prop actionFocusId: string = '';
  @Prop secondaryActionLabel: string = '';
  @Prop secondaryActionFocusId: string = '';
  @Prop actionEnabled: boolean = true;
  @Prop secondaryActionEnabled: boolean = true;
  @Prop padded: boolean = true;
  @Prop customActions: boolean = false;
  @BuilderParam leading: () => void = this.emptySlot;
  @BuilderParam actionContent: () => void = this.emptySlot;
  @Prop inkColor: ResourceColor | undefined = undefined;
  @Prop mutedColor: ResourceColor | undefined = undefined;
  @Prop titleTextId: string = '';
  @Prop messageTextId: string = '';
  titleTextLayoutOptions: TextOptions | undefined = undefined;
  messageTextLayoutOptions: TextOptions | undefined = undefined;
  actionTextLayoutOptions: TextOptions | undefined = undefined;
  onAction: (generation: number) => void = (_generation: number): void => {};
  onSecondaryAction: (generation: number) => void = (_generation: number): void => {};
  onLoadingProgressVisible: ((ratio: number) => void) | undefined = undefined;

  @Builder
  private emptySlot() {}

  @Builder
  private loadingProgress() {
    if (this.onLoadingProgressVisible === undefined) {
      LoadingProgress().id(this.loadingProgressId).width(32).height(32)
        .color(this.mutedColor ?? readerAppColor('TOK_MESSAGE_SOFT_INK', this.appThemeScheme))
        .enableLoading(this.loadingActive && this.appForeground && !this.appReduceMotion)
        .accessibilityText('载入中');
    } else {
      LoadingProgress().id(this.loadingProgressId).width(32).height(32)
        .color(this.mutedColor ?? readerAppColor('TOK_MESSAGE_SOFT_INK', this.appThemeScheme))
        .enableLoading(this.loadingActive && this.appForeground && !this.appReduceMotion)
        .accessibilityText('载入中')
        .onVisibleAreaChange([0, 0.01, 1], (visible: boolean, ratio: number): void => {
          if (visible && ratio > 0) this.onLoadingProgressVisible?.(ratio);
        });
    }
  }

  build() {
    if (this.variant === 'inline' && this.loading) {
      Row({ space: 10 }) {
        this.loadingProgress();
        Text(this.message.length > 0 ? this.message : this.title).layoutWeight(1)
          .fontFamily(MESSAGE_BODY.fontFamily).fontWeight(MESSAGE_BODY.fontWeight)
          .fontSize(MESSAGE_BODY.fontSizeFp).lineHeight(MESSAGE_BODY.lineHeightFp as number)
          .fontColor(this.mutedColor ?? readerAppColor('TOK_MESSAGE_MUTED', this.appThemeScheme));
      }.width('100%').padding({ left: this.padded ? 20 : 0, right: this.padded ? 20 : 0,
        top: this.padded ? 24 : 0, bottom: this.padded ? 24 : 0 });
    } else {
      Column({ space: this.variant === 'readingBookmark' ? 0 : this.variant === 'inline' ? MESSAGE_INLINE_STATE_SPACING : 12 }) {
        this.leading();
        if (this.loading) {
          this.loadingProgress();
        }
        if (this.title.length > 0) {
          Text(this.title, this.titleTextLayoutOptions).id(this.titleTextId).width('100%').textAlign(TextAlign.Center)
            .fontFamily(MESSAGE_TITLE.fontFamily).fontWeight(MESSAGE_TITLE.fontWeight)
            .fontSize(MESSAGE_TITLE.fontSizeFp).lineHeight(MESSAGE_TITLE.lineHeightFp as number)
            .fontColor(this.inkColor ?? readerAppColor('TOK_MESSAGE_INK', this.appThemeScheme));
        }
        if (this.message.length > 0) {
          Text(this.message, this.messageTextLayoutOptions).id(this.messageTextId).width('100%').textAlign(TextAlign.Center)
            .fontFamily(MESSAGE_BODY.fontFamily).fontWeight(MESSAGE_BODY.fontWeight)
            .fontSize(MESSAGE_BODY.fontSizeFp).lineHeight(MESSAGE_BODY.lineHeightFp as number)
            .fontColor(this.mutedColor ?? readerAppColor('TOK_MESSAGE_MUTED', this.appThemeScheme))
            .margin({ top: this.variant === 'readingBookmark' && this.title.length > 0 ? 9 : 0 });
        }
        if (!this.loading && this.customActions) {
          this.actionContent();
        } else if (!this.loading && (this.actionLabel.length > 0 || this.secondaryActionLabel.length > 0)) {
          Flex({ justifyContent: FlexAlign.Center, wrap: FlexWrap.Wrap, space: { main: LengthMetrics.vp(10), cross: LengthMetrics.vp(10) } }) {
            if (this.actionLabel.length > 0) {
              ReaderRecoveryAction({ variant: this.variant === 'readingBookmark' ? 'readingState' : 'compact', minimumWidth: this.variant === 'readingBookmark' ? 92 : 44, label: this.actionLabel, actionEnabled: this.actionEnabled, focusId: this.actionFocusId,
                textLayoutOptions: this.actionTextLayoutOptions,
                generation: this.actionGeneration,
                onReconcile: (expected: number): void => this.onAction(expected) });
            }
            if (this.secondaryActionLabel.length > 0) {
              ReaderRecoveryAction({ variant: this.variant === 'readingBookmark' ? 'readingState' : 'compact', minimumWidth: this.variant === 'readingBookmark' ? 92 : 44, label: this.secondaryActionLabel, actionEnabled: this.secondaryActionEnabled,
                focusId: this.secondaryActionFocusId, generation: this.actionGeneration,
                onReconcile: (expected: number): void => this.onSecondaryAction(expected) });
            }
          }.width('100%').margin({ top: this.variant === 'readingBookmark' ? 23 : 0 });
        }
      }.width('100%').padding({ left: this.padded ? 20 : 0, right: this.padded ? 20 : 0,
        top: this.padded ? (this.variant === 'readingBookmark' ? 30 : 24) : 0,
        bottom: this.padded ? (this.variant === 'readingBookmark' ? 30 : 24) : 0 });
    }
  }
}
