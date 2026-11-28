import { readerAppColor } from '../foundation/ReaderThemeRegistry';
import { READER_FONT_NOTO_SANS_SC_UI_MEDIUM } from '../foundation/ReaderFontFamilies';

export type ReaderStatusBadgeStatus = 'success' | 'error' | 'pending' | 'neutral' | 'enabled' | 'paused' | 'unknown';

/** Read-only compact status. Features provide the fact and its complete label;
 * native vector marks distinguish it without color or font-size dependence. */
@Component
export struct StatusBadge {
  @StorageProp('readerAppScheme') private appThemeScheme: string = 'day';
  @StorageProp('readerUiConfigurationRevision') private configurationRevision: number = 0;
  @Prop status: ReaderStatusBadgeStatus = 'unknown';
  @Prop label: string = '';
  @Prop text: string = '';
  @Prop verificationId: string = '';
  @Prop symbolOnly: boolean = false;

  build() {
    Stack({ alignContent: Alignment.Center }) {
      if (this.hasText()) {
        Row({ space: 4 }) {
          this.mark();
          Text(this.text).fontFamily(READER_FONT_NOTO_SANS_SC_UI_MEDIUM).fontSize(11).fontWeight(500)
            .fontColor(this.symbolColor())
            .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis })
            .accessibilityLevel('no');
        }.alignItems(VerticalAlign.Center);
      } else {
        this.mark();
      }
    }.width(this.hasText() ? undefined : this.symbolOnly ? 14 : 24)
      .height(this.hasText() ? undefined : 18)
      .constraintSize({ minHeight: 18 })
      .padding(this.hasText() ? { left: 8, right: 8, top: 2, bottom: 2 } : 0)
      .borderRadius(6).backgroundColor(this.symbolOnly ? Color.Transparent : this.surfaceColor())
      .id(this.verificationId)
      .accessibilityLevel(this.symbolOnly ? 'no' : 'auto')
      .accessibilityGroup(true).accessibilityText(this.label.trim().length > 0 ? this.label :
        this.hasText() ? this.text : '状态未知');
  }

  @Builder
  private mark() {
    Stack({ alignContent: Alignment.Center }) {
      if (this.symbolOnly && this.status !== 'pending') {
        Row().width(14).height(14).borderRadius(7).border({ width: 1, color: this.symbolColor() })
          .accessibilityLevel('no');
      }
      Path().width(12).height(12).commands(this.symbolPath())
        .fill(Color.Transparent).stroke(this.symbolColor()).strokeWidth(1.6)
        .strokeLineCap(LineCapStyle.Round).strokeLineJoin(LineJoinStyle.Round)
        .accessibilityLevel('no');
    }.width(14).height(14).accessibilityLevel('no');
  }

  private hasText(): boolean { return !this.symbolOnly && this.text.trim().length > 0; }

  private surfaceColor(): ResourceColor {
    if (this.status === 'success') return readerAppColor('app.status.goodSoft', this.appThemeScheme);
    if (this.status === 'error') return readerAppColor('app.status.checkErrorSoft', this.appThemeScheme);
    if (this.status === 'enabled') return readerAppColor('app.feed.enabledSurface', this.appThemeScheme);
    if (this.status === 'paused') return readerAppColor('app.feed.disabledSurface', this.appThemeScheme);
    return readerAppColor('app.status.mutedSoft', this.appThemeScheme);
  }

  private symbolColor(): ResourceColor {
    if (this.status === 'success') return readerAppColor('app.status.good', this.appThemeScheme);
    if (this.status === 'error') return readerAppColor('app.status.checkError', this.appThemeScheme);
    if (this.status === 'enabled') return readerAppColor('app.status.availableDot', this.appThemeScheme);
    if (this.status === 'paused') return readerAppColor('TOK_MUTED', this.appThemeScheme);
    return readerAppColor('app.status.mutedDot', this.appThemeScheme);
  }

  private symbolPath(): string {
    if (this.configurationRevision < 0) return '';
    // Path commands use px; the 12vp vector and its stroke keep native density
    // conversion, independent of system text scaling. Configuration invalidates it.
    const u = this.getUIContext().vp2px(1);
    if (this.status === 'success') return `M ${2*u} ${6*u} L ${5*u} ${9*u} L ${10*u} ${3*u}`;
    if (this.status === 'error') return `M ${3*u} ${3*u} L ${9*u} ${9*u} M ${9*u} ${3*u} L ${3*u} ${9*u}`;
    if (this.status === 'pending') return `M ${6*u} ${1*u} C ${3*u} ${1*u} ${1*u} ${3*u} ${1*u} ${6*u} C ${1*u} ${9*u} ${3*u} ${11*u} ${6*u} ${11*u} C ${9*u} ${11*u} ${11*u} ${9*u} ${11*u} ${6*u} C ${11*u} ${3*u} ${9*u} ${1*u} ${6*u} ${1*u} M ${6*u} ${3*u} L ${6*u} ${6*u} L ${8*u} ${7*u}`;
    if (this.status === 'neutral') return `M ${3*u} ${6*u} L ${9*u} ${6*u}`;
    if (this.status === 'enabled') return `M ${3*u} ${2*u} L ${10*u} ${6*u} L ${3*u} ${10*u} Z`;
    if (this.status === 'paused') return `M ${4*u} ${2*u} L ${4*u} ${10*u} M ${8*u} ${2*u} L ${8*u} ${10*u}`;
    return `M ${3*u} ${4*u} C ${3*u} ${1*u} ${9*u} ${1*u} ${9*u} ${4*u} C ${9*u} ${6*u} ${6*u} ${6*u} ${6*u} ${8*u} M ${6*u} ${10*u} L ${6.1*u} ${10*u}`;
  }
}
