import { MESSAGE_ACTION } from '../foundation/ReaderMessageStyle';
import { readerAppColor } from '../foundation/ReaderThemeRegistry';

/** Presentation only. Generation and admission remain owned by the caller. */
@Component
export struct ReaderRecoveryAction {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  @StorageLink('readerAppForeground') private appForeground: boolean = true;
  @StorageLink('readerReduceMotion') private appReduceMotion: boolean = false;
  @Prop variant: 'compact' | 'rssManagement' | 'notice' | 'text' | 'readingState' = 'compact';
  @Prop label: string = '刷新列表';
  @Prop generation: number = 0;
  @Prop actionEnabled: boolean = true;
  @Prop isBusy: boolean = false;
  @Prop minimumWidth: number = 44;
  @Prop focusId: string = '';
  onReconcile: (generation: number) => void = (_generation: number): void => {};
  build() {
    ForEach([this.generation], (expected: number): void => {
    Button({ type: ButtonType.Normal, stateEffect: false }) {
    Stack({ alignContent: Alignment.Center }) {
      Text(this.label)
        .fontFamily(MESSAGE_ACTION.fontFamily).fontWeight(MESSAGE_ACTION.fontWeight)
        .fontSize(MESSAGE_ACTION.fontSizeFp).lineHeight(MESSAGE_ACTION.lineHeightFp as number)
        .fontColor(readerAppColor(this.variant === 'notice' ? 'TOK_MESSAGE_NOTICE_INK' : 'TOK_MESSAGE_SOFT_INK', this.appThemeScheme))
        .textAlign(TextAlign.Center)
        .decoration({ type: this.variant === 'notice' && !this.isBusy ? TextDecorationType.Underline : TextDecorationType.None })
        .opacity(this.isBusy && this.appForeground && !this.appReduceMotion ? 0 : 1);
      if (this.isBusy) {
        LoadingProgress().width(18).height(18)
          .color(readerAppColor(this.variant === 'notice' ? 'TOK_MESSAGE_NOTICE_INK' : 'TOK_MESSAGE_SOFT_INK', this.appThemeScheme))
          .enableLoading(this.appForeground && !this.appReduceMotion);
      }
    }.accessibilityLevel('no-hide-descendants');
    }
      .constraintSize({ minHeight: 44, minWidth: this.minimumWidth, maxWidth: '100%' })
      .padding({ top: this.variant === 'readingState' ? 10 : 0, bottom: this.variant === 'readingState' ? 10 : 0,
        left: this.variant === 'readingState' ? 17 : this.variant === 'notice' || this.variant === 'text' ? 2 : 16,
        right: this.variant === 'readingState' ? 17 : this.variant === 'notice' || this.variant === 'text' ? 2 : 16 })
      .backgroundColor(this.variant === 'notice' || this.variant === 'text' ? Color.Transparent : readerAppColor('TOK_MESSAGE_SOFT', this.appThemeScheme))
      .borderRadius(this.variant === 'notice' ? 4 : 12)
      .id(this.focusId)
      .enabled(this.actionEnabled && !this.isBusy)
      .accessibilityRole(AccessibilityRoleType.BUTTON)
      .accessibilityText(this.isBusy ? `${this.label}，正在处理` : this.label)
      .onClick((): void => { if (expected === this.generation && this.actionEnabled && !this.isBusy) this.onReconcile(expected); });
    }, (expected: number): string => expected.toString());
  }
}
