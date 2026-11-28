import { readerAnimatePress, readerPressOpacity, readerPressPointer, readerPressScale, readerPressSurface } from '../foundation/ReaderPressMotion';
import { readerAppColor } from '../foundation/ReaderThemeRegistry';
import { TYPE_APP_ROW_DETAIL, TYPE_APP_ROW_LABEL } from '../foundation/ReaderTypography';
import { TOK_BORDER_W, TOK_SPACE_SM } from '../foundation/ReaderTokens';

type ReaderFormRowKind = 'standard' | 'compact' | 'danger';

/** A row either owns one native action or lays out its child control. */
@Component
export struct ReaderFormRow {
  @StorageProp('readerReduceMotion') private reduceMotion: boolean = false;
  @State private pressPointer: number = -1;
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  @Prop @Watch('refreshContentLayout') icon: Resource | undefined = undefined;
  @Prop @Watch('refreshContentLayout') label: string = '';
  @Prop secondaryText: string = '';
  /** A known-width child may move below its label when the real text budget does not fit. */
  @Prop @Watch('refreshContentLayout') contentMinWidth: number = 0;
  @StorageLink('readerUiConfigurationRevision') @Watch('refreshContentLayout')
  private uiConfigurationRevision: number = 0;
  @StorageLink('readerWindowMetricsRevision') @Watch('refreshContentLayout')
  private windowMetricsRevision: number = 0;
  @State private contentAppearanceRevision: number = 0;
  @State private contentStacked: boolean = false;
  private contentRowWidth: number = 0;
  @Prop @Watch('refreshContentLayout') kind: ReaderFormRowKind = 'standard';
  @Prop @Watch('clearPress') actionEnabled: boolean = true;
  @Prop @Watch('clearPress') isBusy: boolean = false;
  @Prop disclosure: boolean = false;
  @Prop @Watch('clearPress') actionId: string = '';
  onAction: (() => void) | undefined = undefined;
  onLabelAction: (() => void) | undefined = undefined;
  @BuilderParam content: () => void = this.emptyContent;
  private mounted: boolean = false;

  aboutToAppear(): void {
    this.mounted = true;
    this.contentAppearanceRevision += 1;
    this.refreshContentLayout();
  }
  aboutToDisappear(): void { this.mounted = false; this.clearPress(); }

  private clearPress(): void { this.pressPointer = -1; }

  private observePress(event: TouchEvent): void {
    const next = readerPressPointer(event, this.pressPointer, this.canAct());
    if (next !== this.pressPointer) readerAnimatePress(this.getUIContext(), this.reduceMotion, (): void => { this.pressPointer = next; });
  }

  @Builder
  private emptyContent() {}

  build() {
    if (this.onAction !== undefined) {
      Button({ type: ButtonType.Normal, stateEffect: false }) {
        Stack() { this.rowContent(); }.width('100%')
          .backgroundColor(readerPressSurface(Color.Transparent, this.appThemeScheme, this.pressPointer >= 0, this.reduceMotion))
          .borderRadius(14).scale(readerPressScale(this.pressPointer >= 0, this.reduceMotion))
          .opacity(readerPressOpacity(this.pressPointer >= 0, this.reduceMotion));
      }
        .width('100%').constraintSize({ minHeight: this.secondaryText.length > 0 ? 58 : 52 }).padding(0)
        .borderRadius(0).backgroundColor(Color.Transparent)
        .onTouch((event: TouchEvent): void => this.observePress(event))
        .enabled(this.canAct())
        .id(this.actionId)
        .accessibilityText(this.label)
        .accessibilityDescription(this.secondaryText)
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
      Row({ space: TOK_SPACE_SM }) {
        if (this.onAction === undefined && this.onLabelAction !== undefined) {
          // The label target is a sibling of the native switch. Only the
          // switch is exposed to keyboard and assistive technologies.
          Button({ type: ButtonType.Normal, stateEffect: false }) {
            Stack() { this.labelContent(); }.width('100%')
              .backgroundColor(readerPressSurface(Color.Transparent, this.appThemeScheme, this.pressPointer >= 0, this.reduceMotion))
              .borderRadius(14).scale(readerPressScale(this.pressPointer >= 0, this.reduceMotion))
              .opacity(readerPressOpacity(this.pressPointer >= 0, this.reduceMotion));
          }
            .layoutWeight(1).constraintSize({ minHeight: this.secondaryText.length > 0 ? 58 : 52 }).padding(0)
            .backgroundColor(Color.Transparent).enabled(this.canAct()).focusable(false)
            .accessibilityLevel('no-hide-descendants')
            .onTouch((event: TouchEvent): void => this.observePress(event))
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
        .constraintSize({ minHeight: this.kind === 'compact' ? 44 : (this.secondaryText.length > 0 ? 58 : 52) })
        .padding({ left: this.contentInset(), right: this.contentInset(),
          top: this.secondaryText.length > 0 ? 6 : 0, bottom: this.secondaryText.length > 0 ? 6 : 0 })
        .alignItems(VerticalAlign.Center)
        .border({ width: { top: this.kind === 'compact' ? 0 : TOK_BORDER_W },
          color: readerAppColor('TOK_ROW_DIVIDER', this.appThemeScheme) })
        .onAreaChange(this.contentWidthChangeHandler());
    }
  }

  private contentLayoutKey(): string {
    return JSON.stringify([this.label, this.icon, this.kind, this.contentMinWidth, this.uiConfigurationRevision,
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
      const iconWidth = this.icon === undefined ? 0 : 32 + TOK_SPACE_SM;
      const requiredWidth = 2 * this.contentInset() + iconWidth + labelWidth + TOK_SPACE_SM + this.contentMinWidth;
      this.contentStacked = this.contentRowWidth < Math.ceil(requiredWidth);
    } catch (_) { /* Keep the current layout until measurement is available. */ }
  }

  private contentInset(): number { return this.kind === 'compact' ? 0 : TOK_SPACE_SM; }

  @Builder
  private labelContent() {
    Row({ space: TOK_SPACE_SM }) {
      if (this.icon !== undefined) {
        Stack({ alignContent: Alignment.Center }) {
          Image(this.icon).width(16).height(16).objectFit(ImageFit.Contain).accessibilityLevel('no');
        }
          .width(32).height(32).borderRadius(10)
          .backgroundColor(readerAppColor('TOK_SETTING_ICON_BG', this.appThemeScheme));
      }
      if (this.secondaryText.length > 0) {
        Column({ space: 2 }) {
          this.primaryLabel(true);
          Text(this.secondaryText).width('100%')
            .fontFamily(TYPE_APP_ROW_DETAIL.fontFamily).fontWeight(TYPE_APP_ROW_DETAIL.fontWeight)
            .fontSize(TYPE_APP_ROW_DETAIL.fontSizeFp).lineHeight(TYPE_APP_ROW_DETAIL.lineHeightFp as number).halfLeading(true)
            .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme));
        }.layoutWeight(1).alignItems(HorizontalAlign.Start);
      } else {
        this.primaryLabel(false);
      }
    }
      .width('100%').layoutWeight(this.contentMinWidth > 0 && this.contentStacked ? undefined : 1)
      .alignItems(VerticalAlign.Center);
  }

  @Builder
  private primaryLabel(withDetail: boolean) {
    Text(this.label).layoutWeight(withDetail ? undefined : 1).width(withDetail ? '100%' : undefined)
      .fontFamily(TYPE_APP_ROW_LABEL.fontFamily).fontWeight(TYPE_APP_ROW_LABEL.fontWeight)
      .fontSize(TYPE_APP_ROW_LABEL.fontSizeFp).lineHeight(TYPE_APP_ROW_LABEL.lineHeightFp as number).halfLeading(true)
      .fontColor(readerAppColor(this.kind === 'danger' ? 'TOK_DANGER' : 'TOK_INK', this.appThemeScheme))
      .maxLines(this.contentMinWidth > 0 && this.contentStacked ? undefined : 1)
      .textOverflow({ overflow: this.contentMinWidth > 0 && this.contentStacked ? TextOverflow.Clip : TextOverflow.Ellipsis });
  }
}
