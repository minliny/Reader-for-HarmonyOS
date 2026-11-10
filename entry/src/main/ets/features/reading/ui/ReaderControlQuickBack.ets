import { ReaderActionAccessibility } from '../../../ui/controls/ReaderActionAccessibility';
import { readerAppColor } from '../../../ui/foundation/ReaderThemeRegistry';
import { TYPE_READER_AUTO_PAGE_RETAINED_QUICK_BACK_BACK, TYPE_READER_REPLACE_RETAINED_QUICK_BACK_BACK,
  TYPE_READER_SEARCH_RETAINED_QUICK_BACK_BACK, ReaderTextStyle } from '../../../ui/foundation/ReaderTypography';

/** The reading module supplies the actor bounds, motion and return action. */
@Component
export struct ReaderControlQuickBack {
  @Prop variant: 'search' | 'auto-page' | 'replace' = 'search';
  @Prop scheme: string = 'day';
  @Prop actionWidth: number = 51;
  @Prop actionHeight: number = 24;
  @Prop actionVisible: boolean = true;
  @Prop actionEnabled: boolean = true;
  onAction: () => void = (): void => {};

  build() {
    Button({ type: ButtonType.Normal, stateEffect: false }) {
      Row({ space: this.variant === 'replace' ? 5 : 4 }) {
        Image(this.icon()).width(11).height(11).accessibilityLevel('no');
        Text('返回').fontFamily(this.labelStyle().fontFamily).fontWeight(this.labelStyle().fontWeight)
          .fontSize(this.labelStyle().fontSizeFp).fontColor(readerAppColor('TOK_READ_PRIMARY', this.scheme))
          .accessibilityLevel('no');
      }.width('100%').justifyContent(this.variant === 'replace' ? FlexAlign.Center : FlexAlign.Start)
        .alignItems(VerticalAlign.Center).accessibilityLevel('no-hide-descendants').hitTestBehavior(HitTestMode.None);
    }.width(this.actionWidth).height(this.actionHeight)
      .padding({ left: this.variant === 'search' ? 8 : this.variant === 'auto-page' ? 9 : 0,
        right: this.variant === 'auto-page' ? 9 : 0, top: 0, bottom: 0 })
      .backgroundColor(readerAppColor(this.variant === 'auto-page' ? 'TOK_SURFACE_PANEL' : 'TOK_SURFACE_PANEL_SOFT', this.scheme))
      .borderRadius(8).opacity(1)
      .hitTestBehavior(this.actionVisible ? HitTestMode.Default : HitTestMode.None)
      .accessibilityLevel(this.actionVisible ? 'auto' : 'no-hide-descendants')
      .attributeModifier(new ReaderActionAccessibility(this.variant === 'search' ? '返回初始控制栏' : '返回阅读控制首页',
        this.actionVisible && this.actionEnabled, false, true, undefined, 'nativeButton'))
      .onClick((): void => { if (this.actionVisible && this.actionEnabled) this.onAction(); });
  }

  private icon(): Resource {
    if (this.variant === 'replace') return this.scheme === 'night' ? $r('app.media.reader_control_replace_back_theme_night') :
      $r('app.media.reader_control_replace_back');
    return this.scheme === 'night' ? $r('app.media.reader_quick_back_theme_night') : $r('app.media.reader_quick_back');
  }

  private labelStyle(): ReaderTextStyle {
    if (this.variant === 'replace') return TYPE_READER_REPLACE_RETAINED_QUICK_BACK_BACK;
    if (this.variant === 'auto-page') return TYPE_READER_AUTO_PAGE_RETAINED_QUICK_BACK_BACK;
    return TYPE_READER_SEARCH_RETAINED_QUICK_BACK_BACK;
  }
}
