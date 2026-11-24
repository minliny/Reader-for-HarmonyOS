import { readerAppColor } from '../foundation/ReaderThemeRegistry';
import { motionAnimateParam } from '../foundation/MotionSpec';
import { readerMotionReducedFadeParam } from '../foundation/ReaderMotionPolicy';
import { ReaderPostLayoutFrame } from '../layout/ReaderPostLayoutFrame';
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
  @Prop @Watch('moveActivePill') current: string = '';
  @Prop scheme: string = 'day';
  @Prop @Watch('traceGeometry') surfaceWidth: number = 0;
  @Prop translateX: number = 0;
  @Prop bottomInset: number = 0;
  @Prop fontScale: number = 1;
  @Prop inputEnabled: boolean = true;
  onSelect: (key: string) => void = (_key: string): void => {};
  onCurrentTap: (key: string) => void = (_key: string): void => {};
  onGeometryTrace: (width: number, paintReady: boolean) => void =
    (_width: number, _paintReady: boolean): void => {};
  @StorageLink('readerWindowMetricsRevision') private metricsRevision: number = 0;
  @StorageProp('readerReduceMotion') @Watch('motionPreferenceChanged') private reduceMotion: boolean = false;
  @State private paintedTab: number = -1;
  @State private pillOpacity: number = 1;
  private pillGeneration: number = 0;
  @State private raisedShape: ReaderRaisedShape | undefined = undefined;
  private mounted: boolean = false;
  private appearanceEpoch: number = 0;

  aboutToAppear(): void {
    this.appearanceEpoch += 1;
    this.raisedShape = undefined;
    this.mounted = true;
    this.syncActivePill();
    this.traceGeometry();
  }
  aboutToDisappear(): void {
    this.mounted = false;
    this.pillGeneration += 1;
  }

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      if (this.hasPaintGeometry()) {
        Row({ space: TOK_SPACE_XS }) {
          this.activePill();
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
        .clip(this.requiresChildClip())
        .hitTestBehavior(HitTestMode.Transparent)
        .onAreaChange(this.measurementHandler(this.surfaceWidth, this.fontScale));
      }
    }.width(this.hasPaintGeometry() ? this.surfaceWidth : 0)
      .constraintSize({ minHeight: readerFloatingTabBarHeight(this.fontScale) }).clip(false)
      .hitTestBehavior(HitTestMode.Transparent)
      .margin({ bottom: this.bottomInset })
      .translate({ x: this.translateX });
  }

  @Builder
  private activePill() {
    if (this.paintedTab >= 0) {
      Row()
        .width(this.pillWidth()).height(readerMainTabItemHeight(this.fontScale, false))
        .position({ x: TOK_SPACE_XS + TOK_BORDER_W, y: this.pillTop() })
        .translate({ x: this.paintedTab * (this.pillWidth() + TOK_SPACE_XS) })
        .backgroundColor(readerAppColor('TOK_PRIMARY_DARK', this.scheme))
        .borderRadius(readerMainTabItemHeight(this.fontScale, false) / 2)
        .opacity(this.pillOpacity)
        .hitTestBehavior(HitTestMode.None)
        .accessibilityLevel('no');
    }
  }

  private pillWidth(): number {
    const count = this.items.length;
    const inset = TOK_SPACE_XS + TOK_BORDER_W;
    const width = this.currentRaisedShape()?.width ?? this.surfaceWidth;
    return count > 0 ? Math.max(0, (width - 2 * inset - (count - 1) * TOK_SPACE_XS) / count) : 0;
  }

  private pillTop(): number {
    const height = this.currentRaisedShape()?.height ?? readerFloatingTabBarHeight(this.fontScale);
    return Math.max(0, (height - readerMainTabItemHeight(this.fontScale, false)) / 2);
  }

  private activeTabIndex(): number {
    return this.items.findIndex((tab: ReaderBottomTabItem): boolean => tab.key === this.current);
  }

  private syncActivePill(): void {
    this.pillGeneration += 1;
    this.paintedTab = this.activeTabIndex();
    this.pillOpacity = 1;
  }

  private motionPreferenceChanged(): void {
    if (this.mounted) this.syncActivePill();
  }

  private moveActivePill(): void {
    if (!this.mounted) return;
    const index = this.activeTabIndex();
    if (index === this.paintedTab) return;
    if (!this.hasPaintGeometry() || index < 0 || this.paintedTab < 0) {
      this.syncActivePill();
      return;
    }
    const context = this.getUIContext();
    if (!this.reduceMotion) {
      try {
        context.animateTo(motionAnimateParam('app.navigation.pill'), (): void => { this.paintedTab = index; });
      } catch (_) { this.syncActivePill(); }
      return;
    }
    const generation = ++this.pillGeneration;
    this.pillOpacity = 0;
    this.paintedTab = index;
    try {
      context.postFrameCallback(new ReaderPostLayoutFrame(context, (): void => {
        if (!this.mounted || generation !== this.pillGeneration) return;
        try {
          context.animateTo(readerMotionReducedFadeParam(), (): void => { this.pillOpacity = 1; });
        } catch (_) { this.pillOpacity = 1; }
      }));
    } catch (_) { this.pillOpacity = 1; }
  }

  @Builder
  private tabItem(tab: ReaderBottomTabItem) {
    Button({ type: ButtonType.Capsule, stateEffect: false }) {
      Column({ space: 2 }) {
        Stack({ alignContent: Alignment.Center }) {
          Image(this.currentTab(tab).icon).width(24).height(24).accessibilityLevel('no');
        }.width(30).height(30);
        Text(this.currentTab(tab).label)
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
    .backgroundColor(Color.Transparent)
    .enabled(this.inputEnabled)
    .accessibilityText(`${this.currentTab(tab).label}${this.current === tab.key ? '，已选中' : ''}`)
    .id(`reader-main-tab-${tab.key}`)
    .accessibilitySelected(this.current === tab.key)
    .onClick((): void => this.activate(tab.key));
  }

  private currentTab(snapshot: ReaderBottomTabItem): ReaderBottomTabItem {
    return this.items.find((item: ReaderBottomTabItem): boolean => item.key === snapshot.key) ?? snapshot;
  }

  private activate(key: string): void {
    if (!this.mounted || !this.inputEnabled || !this.items.some((item: ReaderBottomTabItem): boolean => item.key === key)) return;
    if (key === this.current) this.onCurrentTap(key);
    else this.onSelect(key);
  }

  private hasPaintGeometry(): boolean {
    return Number.isFinite(this.surfaceWidth) && this.surfaceWidth > 0;
  }

  private traceGeometry(): void {
    if (!this.mounted) return;
    try {
      this.onGeometryTrace(this.surfaceWidth, this.hasPaintGeometry());
    } catch (_) { /* Diagnostic observers are isolated from material admission. */ }
  }

  private requiresChildClip(): boolean {
    const adopted = this.currentRaisedShape();
    const current = adopted?.identity === this.raisedShapeIdentity() ? adopted : undefined;
    const width = current?.width ?? this.surfaceWidth;
    const height = current?.height ?? readerFloatingTabBarHeight(this.fontScale);
    // Current Area paint and containment share one border-box. Retained
    // geometry from a previous input still uses the new conservative budget.
    return this.childGeometryNeedsClip(width, height, this.materialRadius());
  }

  private childGeometryNeedsClip(width: number, height: number, radius: number): boolean {
    const count = this.items.length;
    const itemHeight = readerMainTabItemHeight(this.fontScale, false);
    const inset = TOK_SPACE_XS + TOK_BORDER_W;
    const minimumWidth = count * Math.max(44, itemHeight) + Math.max(0, count - 1) * TOK_SPACE_XS +
      2 * inset;
    const minimumHeight = itemHeight + 2 * inset;
    const precision = Number.EPSILON * Math.max(1, width, height, minimumWidth, minimumHeight) * 4;
    return count === 0 || !Number.isFinite(width) || !Number.isFinite(height) ||
      minimumWidth - width > precision || minimumHeight - height > precision ||
      radius - Math.min(width, height) / 2 > precision;
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
    if (previous?.identity === identity && Math.abs(previous.width - width) <= .1 && Math.abs(previous.height - height) <= .1 &&
      this.childGeometryNeedsClip(previous.width, previous.height, previous.radius) ===
        this.childGeometryNeedsClip(shape.width, shape.height, shape.radius)) return;
    this.raisedShape = shape;
  }
}
