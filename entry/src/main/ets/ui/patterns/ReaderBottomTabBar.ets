import { readerAppColor } from '../foundation/ReaderThemeRegistry';
import { TOK_BORDER_W, TOK_RADIUS_PILL, TOK_SPACE_XS } from '../foundation/ReaderTokens';
import { TYPE_MAIN_TAB_LABEL } from '../foundation/ReaderTypography';
import { readerSurfaceElevation } from '../surfaces/ReaderSurfaceSpecs';
import { readerPageAreaLength } from '../layout/ReaderPageShell';
import { readerFloatingTabBarHeight, readerMainTabItemHeight } from '../layout/ReaderFloatingBarMetrics';
import { ReaderRaisedShape, resolveReaderRaisedShape } from '../layout/ReaderRaisedShape';

export interface ReaderBottomTabItem {
  key: string;
  label: string;
  icon: Resource;
}

/** Paints admitted phone tabs; the product owner retains destinations and scope. */
@Component
export struct ReaderBottomTabBar {
  @Prop items: ReaderBottomTabItem[] = [];
  @Prop current: string = '';
  @Prop scheme: string = 'day';
  @Prop surfaceWidth: number = 0;
  @Prop translateX: number = 0;
  @Prop bottomInset: number = 0;
  @Prop fontScale: number = 1;
  @Prop inputEnabled: boolean = true;
  onSelect: (key: string) => void = (_key: string): void => {};
  onCurrentTap: (key: string) => void = (_key: string): void => {};
  @StorageLink('readerWindowMetricsRevision') private metricsRevision: number = 0;
  @State private raisedShape: ReaderRaisedShape | undefined = undefined;
  private mounted: boolean = false;
  private appearanceEpoch: number = 0;

  aboutToAppear(): void { this.appearanceEpoch += 1; this.raisedShape = undefined; this.mounted = true; }
  aboutToDisappear(): void { this.mounted = false; }

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      Row({ space: TOK_SPACE_XS }) {
        ForEach(this.items, (tab: ReaderBottomTabItem): void => {
          this.tabItem(tab);
        }, (tab: ReaderBottomTabItem): string => `main-tab-${tab.key}`);
      }
      .width(this.surfaceWidth)
      .constraintSize({ minHeight: readerFloatingTabBarHeight(this.fontScale) })
      .padding(TOK_SPACE_XS)
      .backgroundColor(readerAppColor('app.navigation.floatingSurface', this.scheme))
      .border({ width: TOK_BORDER_W, color: readerAppColor('app.navigation.floatingBorder', this.scheme) })
      .borderRadius(this.materialRadius())
      .shadow(readerSurfaceElevation('raised', this.scheme))
      .clip(true)
      .hitTestBehavior(HitTestMode.Transparent)
      .onAreaChange(this.measurementHandler(this.surfaceWidth, this.fontScale));
    }.width(this.surfaceWidth).clip(false)
      .hitTestBehavior(HitTestMode.Transparent)
      .margin({ bottom: this.bottomInset })
      .translate({ x: this.translateX });
  }

  @Builder
  private tabItem(tab: ReaderBottomTabItem) {
    Button({ type: ButtonType.Normal, stateEffect: false }) {
      Column({ space: 2 }) {
        Stack({ alignContent: Alignment.Center }) {
          Image(tab.icon).width(24).height(24).accessibilityLevel('no');
        }.width(30).height(30);
        Text(tab.label)
          .width('100%')
          .fontFamily(TYPE_MAIN_TAB_LABEL.fontFamily)
          .fontWeight(TYPE_MAIN_TAB_LABEL.fontWeight)
          .fontSize(TYPE_MAIN_TAB_LABEL.fontSizeFp)
          .lineHeight(`${TYPE_MAIN_TAB_LABEL.lineHeightFp}fp`)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
          .textAlign(TextAlign.Center)
          .fontColor(readerAppColor(this.current === tab.key ? 'TOK_ON_PRIMARY' : 'TOK_MUTED', this.scheme))
          .accessibilityLevel('no');
      }.width('100%').justifyContent(FlexAlign.Center).alignItems(HorizontalAlign.Center);
    }
    .layoutWeight(1)
    .constraintSize({ minHeight: readerMainTabItemHeight(this.fontScale, false) })
    .padding(0)
    .backgroundColor(this.current === tab.key ? readerAppColor('TOK_PRIMARY_DARK', this.scheme) : Color.Transparent)
    .borderRadius(this.current === tab.key ? TOK_RADIUS_PILL : 0)
    .enabled(this.inputEnabled)
    .accessibilityText(`${tab.label}${this.current === tab.key ? '，已选中' : ''}`)
    .accessibilitySelected(this.current === tab.key)
    .onClick((): void => this.activate(tab.key));
  }

  private activate(key: string): void {
    if (!this.mounted || !this.inputEnabled || !this.items.some((item: ReaderBottomTabItem): boolean => item.key === key)) return;
    if (key === this.current) this.onCurrentTap(key);
    else this.onSelect(key);
  }

  private measurementHandler(width: number, fontScale: number): (_old: Area, area: Area) => void {
    const identity = this.raisedShapeIdentity();
    return (_old: Area, area: Area): void => {
      if (width !== this.surfaceWidth || fontScale !== this.fontScale || identity !== this.raisedShapeIdentity()) return;
      this.recordRaisedSurface(area, identity);
    };
  }

  private raisedShapeIdentity(): string {
    return JSON.stringify(['main-tabs', this.appearanceEpoch, this.surfaceWidth, this.fontScale, this.metricsRevision]);
  }

  private currentRaisedShape(): ReaderRaisedShape | undefined {
    // Reject old callbacks separately. A new input key with an unchanged
    // native box need not emit another area event; retain its adopted shape.
    return this.mounted ? this.raisedShape : undefined;
  }

  private materialRadius(): number {
    return this.currentRaisedShape()?.radius ?? resolveReaderRaisedShape(this.raisedShapeIdentity(),
      this.surfaceWidth, readerFloatingTabBarHeight(this.fontScale), TOK_RADIUS_PILL)?.radius ?? 0;
  }

  private recordRaisedSurface(area: Area, identity: string): void {
    if (!this.mounted || identity !== this.raisedShapeIdentity()) return;
    const width = readerPageAreaLength(area.width);
    const height = readerPageAreaLength(area.height);
    const shape = resolveReaderRaisedShape(identity, width, height, TOK_RADIUS_PILL);
    if (shape === undefined) return;
    const previous = this.raisedShape;
    if (previous?.identity === identity && Math.abs(previous.width - width) <= .1 && Math.abs(previous.height - height) <= .1) return;
    this.raisedShape = shape;
  }
}
