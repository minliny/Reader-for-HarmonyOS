import { MESSAGE_ACTION } from './ReaderMessageStyle';
import { readerAppColor } from './ReaderThemeRegistry';

/** Presentation only. Generation and admission remain owned by the caller. */
@Component
export struct ReaderRecoveryAction {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  @Prop variant: 'compact' | 'rssManagement' | 'notice' | 'text' = 'compact';
  @Prop label: string = '刷新列表';
  @Prop generation: number = 0;
  @Prop actionEnabled: boolean = true;
  @Prop isBusy: boolean = false;
  onReconcile: (generation: number) => void = (_generation: number): void => {};
  build() {
    ForEach([this.generation], (expected: number): void => {
    Stack({ alignContent: Alignment.Center }) {
      Text(this.label)
        .fontFamily(MESSAGE_ACTION.fontFamily).fontWeight(MESSAGE_ACTION.fontWeight)
        .fontSize(MESSAGE_ACTION.fontSizeFp).lineHeight(MESSAGE_ACTION.lineHeightFp as number)
        .fontColor(readerAppColor(this.variant === 'notice' ? 'TOK_MESSAGE_NOTICE_INK' : 'TOK_MESSAGE_SOFT_INK', this.appThemeScheme))
        .textAlign(TextAlign.Center).opacity(this.isBusy ? 0 : 1);
      if (this.isBusy) {
        LoadingProgress().width(18).height(18)
          .color(readerAppColor(this.variant === 'notice' ? 'TOK_MESSAGE_NOTICE_INK' : 'TOK_MESSAGE_SOFT_INK', this.appThemeScheme));
      }
    }
      .constraintSize({ minHeight: this.variant === 'notice' ? 28 : 44, minWidth: 30, maxWidth: '100%' })
      .padding({ left: this.variant === 'notice' || this.variant === 'text' ? 2 : 16, right: this.variant === 'notice' || this.variant === 'text' ? 2 : 16 })
      .backgroundColor(this.variant === 'notice' || this.variant === 'text' ? Color.Transparent : readerAppColor('TOK_MESSAGE_SOFT', this.appThemeScheme))
      .borderRadius(this.variant === 'notice' ? 4 : 12)
      .enabled(this.actionEnabled && !this.isBusy)
      .focusable(this.actionEnabled && !this.isBusy)
      .accessibilityRole(AccessibilityRoleType.BUTTON)
      .accessibilityText(this.isBusy ? `${this.label}，正在处理` : this.label)
      .onClick((): void => { if (expected === this.generation && this.actionEnabled && !this.isBusy) this.onReconcile(expected); });
    }, (expected: number): string => expected.toString());
  }
}
