import { TYPE_FORM_COMPACT_ACTION } from './ReaderTypography';
import { readerAppColor } from './ReaderThemeRegistry';

/** Finite read-only recovery control. The domain owns generation/admission;
 * the shared component owns the existing compact 36vp action presentation. */
@Component
export struct ReaderRecoveryAction {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  @Prop label: string = '刷新列表';
  @Prop generation: number = 0;
  @Prop enabled: boolean = true;
  onReconcile: (generation: number) => void = (_generation: number): void => {};
  build() {
    Text(this.label)
      .fontFamily(TYPE_FORM_COMPACT_ACTION.fontFamily)
      .fontWeight(TYPE_FORM_COMPACT_ACTION.fontWeight)
      .fontSize(TYPE_FORM_COMPACT_ACTION.fontSizeFp)
      .fontColor(readerAppColor('TOK_PRIMARY_TEXT', this.appThemeScheme))
      .height(36)
      .padding({ left: 12, right: 12 })
      .backgroundColor(readerAppColor('TOK_PRIMARY_SOFT', this.appThemeScheme))
      .borderRadius(6)
      .textAlign(TextAlign.Center)
      .enabled(this.enabled)
      .accessibilityText(this.label)
      .onClick((): void => { if (this.enabled) this.onReconcile(this.generation); });
  }
}
