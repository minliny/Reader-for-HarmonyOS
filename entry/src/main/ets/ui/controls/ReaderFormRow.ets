import { ReaderPressFeedback } from '../foundation/ReaderPressFeedback';
import { readerAppColor } from '../foundation/ReaderThemeRegistry';
import { TYPE_APP_INHERITED_LABEL, TYPE_APP_ROW_LABEL, TYPE_SETTINGS_DANGER_LABEL } from '../foundation/ReaderTypography';
import { TOK_BORDER_W, TOK_SPACE_CONTROL_INLINE, TOK_SPACE_SM } from '../foundation/ReaderTokens';

type ReaderFormRowKind = 'standard' | 'compact' | 'danger';

/** A row either owns one native action or lays out its child control. */
@Component
export struct ReaderFormRow {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  @Prop @Watch('refreshContentLayout') icon: Resource | undefined = undefined;
  @Prop @Watch('refreshContentLayout') label: string = '';
  /** A known-width child may move below its label when the real text budget does not fit. */
  @Prop @Watch('refreshContentLayout') contentMinWidth: number = 0;
  @StorageLink('readerUiConfigurationRevision') @Watch('refreshContentLayout')
  private uiConfigurationRevision: number = 0;
  @StorageLink('readerWindowMetricsRevision') @Watch('refreshContentLayout')
  private windowMetricsRevision: number = 0;
  @State private contentAppearanceRevision: number = 0;
  @State private contentStacked: boolean = true;
  private contentRowWidth: number = 0;
  @Prop kind: ReaderFormRowKind = 'standard';
  @Prop actionEnabled: boolean = true;
  @Prop isBusy: boolean = false;
  @Prop disclosure: boolean = false;
  onAction: (() => void) | undefined = undefined;
  onLabelAction: (() => void) | undefined = undefined;
  @BuilderParam content: () => void = this.emptyContent;
  private mounted: boolean = false;

  aboutToAppear(): void {
    this.mounted = true;
    this.contentAppearanceRevision += 1;
    this.refreshContentLayout();
  }
  aboutToDisappear(): void { this.mounted = false; }

  @Builder
  private emptyContent() {}

  build() {
    if (this.onAction !== undefined) {
      Button({ type: ButtonType.Normal, stateEffect: false }) {
        this.rowContent();
      }
        .width('100%').constraintSize({ minHeight: 58 }).padding(0)
        .attributeModifier(new ReaderPressFeedback(Color.Transparent, this.appThemeScheme, 0, 14, this.canAct()))
        .enabled(this.canAct())
        .accessibilityText(this.label)
        .onClick((): void => { if (this.canAct()) this.onAction?.(); });
    } else {
      this.rowContent();
    }
  }

  private canAct(): boolean { return this.mounted && this.actionEnabled && !this.isBusy; }

  @Builder
  private rowContent() {
    if (this.contentMinWidth > 0 && this.contentStacked) {
      Column({ space: TOK_SPACE_SM }) {
        this.labelContent();
        this.content();
      }
        .width('100%')
        .padding(TOK_SPACE_SM)
        .alignItems(HorizontalAlign.End)
        .border({ width: { top: TOK_BORDER_W }, color: readerAppColor('TOK_ROW_DIVIDER', this.appThemeScheme) })
        .onAreaChange(this.contentWidthChangeHandler());
    } else {
      Row({ space: this.kind === 'danger' ? TOK_SPACE_CONTROL_INLINE : TOK_SPACE_SM }) {
        if (this.onAction === undefined && this.onLabelAction !== undefined) {
          // The label target is a sibling of the native switch. Only the
          // switch is exposed to keyboard and assistive technologies.
          Button({ type: ButtonType.Normal, stateEffect: false }) {
            this.labelContent();
          }
            .layoutWeight(1).constraintSize({ minHeight: 58 }).padding(0)
            .backgroundColor(Color.Transparent).enabled(this.canAct()).focusable(false)
            .accessibilityLevel('no-hide-descendants')
            .onClick((): void => { if (this.canAct()) this.onLabelAction?.(); });
        } else {
          this.labelContent();
        }
        this.content();
        if (this.disclosure) {
          Image(this.appThemeScheme === 'night' ? $r('app.media.reader_chevron_right_theme_night') : $r('app.media.reader_chevron_right'))
            .width(14).height(14).accessibilityLevel('no');
        }
      }
        .width('100%')
        .constraintSize({ minHeight: this.kind === 'compact' ? 44 : 58 })
        .padding({ left: this.kind === 'compact' ? 0 : this.kind === 'danger' ? 13 : TOK_SPACE_SM,
          right: this.kind === 'compact' ? 0 : TOK_SPACE_SM })
        .alignItems(VerticalAlign.Center)
        .border({ width: { top: this.kind === 'standard' ? TOK_BORDER_W : 0 },
          color: readerAppColor('TOK_ROW_DIVIDER', this.appThemeScheme) })
        .onAreaChange(this.contentWidthChangeHandler());
    }
  }

  private contentLayoutKey(): string {
    return JSON.stringify([this.label, this.icon, this.contentMinWidth, this.uiConfigurationRevision,
      this.windowMetricsRevision, this.contentStacked, this.contentAppearanceRevision]);
  }

  private contentWidthChangeHandler(): (oldValue: Area, next: Area) => void {
    const key = this.contentLayoutKey();
    return (_oldValue: Area, next: Area): void => {
      if (key !== this.contentLayoutKey()) return;
      this.recordContentWidth(Number.parseFloat(String(next.width)));
    };
  }

  private recordContentWidth(width: number): void {
    if (!this.mounted || !Number.isFinite(width) || width <= 0 || this.contentMinWidth <= 0) return;
    this.contentRowWidth = width;
    this.refreshContentLayout();
  }

  private refreshContentLayout(): void {
    if (!this.mounted || this.contentMinWidth <= 0 || this.contentRowWidth <= 0) return;
    try {
      const context = this.getUIContext();
      const labelWidth = context.px2vp(context.getMeasureUtils().measureText({ textContent: this.label,
        fontFamily: TYPE_APP_ROW_LABEL.fontFamily, fontSize: `${TYPE_APP_ROW_LABEL.fontSizeFp}fp`,
        fontWeight: TYPE_APP_ROW_LABEL.fontWeight }));
      if (!Number.isFinite(labelWidth) || labelWidth <= 0) return;
      const iconWidth = this.icon === undefined ? 0 : 28 + TOK_SPACE_SM;
      this.contentStacked = this.contentRowWidth < 2 * TOK_SPACE_SM + iconWidth + labelWidth + TOK_SPACE_SM + this.contentMinWidth;
    } catch (_) { /* Keep the complete label above its control until measurement is available. */ }
  }

  @Builder
  private labelContent() {
    Row({ space: this.kind === 'danger' ? TOK_SPACE_CONTROL_INLINE : TOK_SPACE_SM }) {
      if (this.icon !== undefined) {
        Stack({ alignContent: Alignment.Center }) {
          Image(this.icon).width(15).height(15).objectFit(ImageFit.Contain).accessibilityLevel('no');
        }
          .width(28).height(28).borderRadius(14)
          .backgroundColor(readerAppColor(this.kind === 'danger' ? 'TOK_SETTING_DANGER_ICON_BG' : 'TOK_SETTING_ICON_BG', this.appThemeScheme));
      }
      if (this.kind === 'compact') {
        Text(this.label).layoutWeight(1).fontSize(TYPE_APP_INHERITED_LABEL.fontSizeFp)
          .fontColor(readerAppColor('TOK_INK', this.appThemeScheme));
      } else {
        Text(this.label).layoutWeight(1)
          .fontFamily(this.kind === 'danger' ? TYPE_SETTINGS_DANGER_LABEL.fontFamily : TYPE_APP_ROW_LABEL.fontFamily)
          .fontWeight(this.kind === 'danger' ? TYPE_SETTINGS_DANGER_LABEL.fontWeight : TYPE_APP_ROW_LABEL.fontWeight)
          .fontSize(this.kind === 'danger' ? TYPE_SETTINGS_DANGER_LABEL.fontSizeFp : TYPE_APP_ROW_LABEL.fontSizeFp)
          .lineHeight((this.kind === 'danger' ? TYPE_SETTINGS_DANGER_LABEL.lineHeightFp : TYPE_APP_ROW_LABEL.lineHeightFp) as number)
          .fontColor(readerAppColor(this.kind === 'danger' ? 'TOK_DANGER' : 'TOK_INK', this.appThemeScheme))
          .maxLines(this.contentMinWidth > 0 && this.contentStacked ? undefined : 1)
          .textOverflow({ overflow: this.contentMinWidth > 0 && this.contentStacked ? TextOverflow.Clip : TextOverflow.Ellipsis });
      }
    }
      .width('100%').layoutWeight(this.contentMinWidth > 0 && this.contentStacked ? undefined : 1)
      .alignItems(VerticalAlign.Center);
  }
}
