import { ReaderFixedHeaderHost } from './ReaderFixedHeaderHost';
import { ReaderFooterSurface, readerPageAreaLength } from './ReaderPageShell';
import { ReaderFooterFrameModifier, ReaderPageFrameModifier, readerLayoutCarrierResponseRegion } from './ReaderPageNativeAttributes';
import { ReaderPageGeometry } from './ReaderPageGeometry';
import { ReaderFrameStyle } from './ReaderFrameStyle';
import { ReaderNativeSlotMeasurement } from './ReaderNativeSlotMeasurement';

/** One native frame for finite categories. Geometry inputs are measured safe,
 * rail or card offsets. Visual surfaces and layers stay at the shared owner. */
@Component
export struct ReaderPageScaffold {
  // Hidden reading sessions still receive real layout and retain their actors.
  @Prop pageVisible: boolean = true;
  /** A surrounding surface may own the sole fixed header for this content. */
  @Prop headerVisible: boolean = true;
  /** Transparent content hosts let a lower overlay receive taps outside children. */
  @Prop transparentContent: boolean = false;
  @Prop frameStyle: ReaderFrameStyle;
  @Prop headerMeasurementKey: number = 0;
  @Prop @Watch('requestFooterMeasurement') footerMeasurementKey: number = 0;
  private readonly footerMeasurement: ReaderNativeSlotMeasurement = new ReaderNativeSlotMeasurement();
  /** Resolved page contract. The measured header height still arrives below. */
  @Prop geometry: ReaderPageGeometry;
  onHeaderHeightChange: (height: number, presentedKey: number) => void = (_height: number, _presentedKey: number): void => {};
  onFooterHeightChange: (height: number, presentedKey: number) => void = (_height: number, _presentedKey: number): void => {};
  @BuilderParam content: () => void = this.emptySlot;
  @BuilderParam header: () => void = this.emptySlot;
  @BuilderParam footer: () => void = this.emptySlot;
  @BuilderParam overlayContent: () => void = this.emptySlot;
  @Builder private emptySlot() {}

  private footerSurfaceValue(): ReaderFooterSurface {
    return this.geometry.footer.surface;
  }
  private layoutDebugHeaderKey(): string {
    const header = this.frameStyle.header;
    return this.headerVisible && !header.transparent && /^#(?:[0-9a-f]{6}|ff[0-9a-f]{6})$/i.test(header.backgroundColor)
      ? this.footerMeasurement.id : '';
  }
  private requestFooterMeasurement(): void { this.footerMeasurement.request(this.footerMeasurementKey); }

  private publishFooterMeasurement(height: number, presentedKey: number): void {
    if (presentedKey !== this.footerMeasurementKey || !Number.isFinite(height) || height < 0) return;
    // The initial empty slot can report before a declared footer has laid out.
    if (height === 0 && this.geometry.footer.height > 0) return;
    this.onFooterHeightChange(height, presentedKey);
  }

  private footerAreaChangeHandler(presentedKey: number): (_old: Area, next: Area) => void {
    return (_old: Area, next: Area): void => this.publishFooterMeasurement(readerPageAreaLength(next.height), presentedKey);
  }

  build() {
    Stack({ alignContent: this.frameStyle.alignment === 'top' ? Alignment.Top : Alignment.TopStart }) {
      Stack({ alignContent: Alignment.TopStart }) { this.content(); }
        .width('100%').height(this.geometry.content.nativeEndInset > 0 ?
          `calc(100% - ${this.geometry.content.nativeEndInset}vp)` : '100%')
        .clip(this.geometry.content.nativeEndInset > 0).zIndex(0)
        .customProperty('readerLayoutDebugContentUnderHeader', this.layoutDebugHeaderKey())
        .hitTestBehavior(this.transparentContent ? HitTestMode.Transparent : HitTestMode.Default);
      if (this.headerVisible) {
        Column() {
          ReaderFixedHeaderHost({ style: this.frameStyle.header, measurementKey: this.headerMeasurementKey,
            layoutDebugHeaderKey: this.layoutDebugHeaderKey(),
            content: (): void => { this.header(); },
            onHeightChange: (height: number, presentedKey: number): void => this.onHeaderHeightChange(height, presentedKey) });
        }.width('100%').padding({ left: this.geometry.header.insetLeft, right: this.geometry.header.insetRight })
          .margin({ top: this.geometry.header.top }).zIndex(10)
          .hitTestBehavior(HitTestMode.Default).responseRegion(readerLayoutCarrierResponseRegion());
      }
      // Keep sibling blocking on a child hit. A layout carrier's empty lane
      // has no hit region of its own, even when it spans the viewport width.
      Column() {
        Column() { this.footer(); }
          .width('100%').padding({ left: this.geometry.footer.insetLeft, right: this.geometry.footer.insetRight })
          .hitTestBehavior(HitTestMode.Default).responseRegion(readerLayoutCarrierResponseRegion())
          .id(this.footerMeasurement.id)
          .onAppear((): void => this.footerMeasurement.mount(this.getUIContext(), this.footerMeasurementKey,
            (height: number, key: number): void => this.publishFooterMeasurement(height, key)))
          .onDisAppear((): void => this.footerMeasurement.unmount())
          .onAreaChange(this.footerAreaChangeHandler(this.footerMeasurementKey));
      }.width('100%').layoutGravity(LocalizedAlignment.BOTTOM).zIndex(20)
        .hitTestBehavior(HitTestMode.Default)
        .responseRegion(readerLayoutCarrierResponseRegion(this.footerSurfaceValue() === 'solid'))
        .padding({ bottom: this.footerSurfaceValue() === 'solid' ? this.geometry.footer.bottom : 0 })
        .margin({ bottom: this.footerSurfaceValue() === 'solid' ? 0 : this.geometry.footer.bottom })
        .attributeModifier(new ReaderFooterFrameModifier(this.frameStyle.footer));
      Stack({ alignContent: Alignment.TopStart }) { this.overlayContent(); }
        .width('100%').height('100%').zIndex(30).hitTestBehavior(HitTestMode.Transparent);
    }.width('100%').height('100%')
      .padding({ left: this.geometry.frameInsetLeft, right: this.geometry.frameInsetRight })
      .attributeModifier(new ReaderPageFrameModifier(this.frameStyle))
      .expandSafeArea(
        this.frameStyle.safeArea === 'none' ? [] :
          this.frameStyle.safeArea === 'systemCutoutAll' ? [SafeAreaType.SYSTEM, SafeAreaType.CUTOUT] : [SafeAreaType.SYSTEM],
        this.frameStyle.safeArea === 'none' ? [] :
          this.frameStyle.safeArea === 'systemCutoutAll' ?
            [SafeAreaEdge.TOP, SafeAreaEdge.BOTTOM, SafeAreaEdge.START, SafeAreaEdge.END] :
            [SafeAreaEdge.TOP, SafeAreaEdge.BOTTOM])
      .ignoreLayoutSafeArea(
        this.frameStyle.safeArea === 'systemCutoutAll' ? [LayoutSafeAreaType.SYSTEM] : [],
        this.frameStyle.safeArea === 'systemCutoutAll' ? [LayoutSafeAreaEdge.ALL] : [])
      .opacity(this.pageVisible ? 1 : 0)
      .hitTestBehavior(this.pageVisible && !this.transparentContent ? HitTestMode.Default : HitTestMode.Transparent);
  }
}
