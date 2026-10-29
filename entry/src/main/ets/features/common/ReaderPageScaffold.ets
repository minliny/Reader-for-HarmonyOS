import { ReaderFixedHeaderHost } from './ReaderFixedHeaderHost';
import { ReaderFooterFrameModifier, ReaderFooterSurface, ReaderPageFrameModifier, readerPageAreaLength } from './ReaderPageShell';
import { ReaderPageGeometry } from './ReaderPageGeometry';
import { ReaderFrameStyle } from './ReaderFrameStyle';

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
  @Prop footerMeasurementKey: number = 0;
  /** Resolved page contract. The measured header height still arrives below. */
  @Prop geometry: ReaderPageGeometry;
  onHeaderHeightChange: (height: number, presentedKey: number) => void = (_height: number, _presentedKey: number): void => {};
  onFooterHeightChange: (height: number) => void = (_height: number): void => {};
  @BuilderParam content: () => void = this.emptySlot;
  @BuilderParam header: () => void = this.emptySlot;
  @BuilderParam footer: () => void = this.emptySlot;
  @BuilderParam overlayContent: () => void = this.emptySlot;
  @Builder private emptySlot() {}

  private footerSurfaceValue(): ReaderFooterSurface {
    return this.geometry.footer.surface;
  }
  private footerAreaChangeHandler(presentedKey: number): (_old: Area, next: Area) => void {
    return (_old: Area, next: Area): void => {
      if (presentedKey !== this.footerMeasurementKey) return;
      const height = readerPageAreaLength(next.height);
      if (Number.isFinite(height) && height >= 0) this.onFooterHeightChange(height);
    };
  }

  build() {
    Stack({ alignContent: this.frameStyle.alignment === 'top' ? Alignment.Top : Alignment.TopStart }) {
      Stack({ alignContent: Alignment.TopStart }) { this.content(); }
        .width('100%').height(this.geometry.content.nativeEndInset > 0 ?
          `calc(100% - ${this.geometry.content.nativeEndInset}vp)` : '100%')
        .clip(this.geometry.content.nativeEndInset > 0).zIndex(0)
        .hitTestBehavior(this.transparentContent ? HitTestMode.Transparent : HitTestMode.Default);
      if (this.headerVisible) {
        Column() {
          ReaderFixedHeaderHost({ style: this.frameStyle.header, measurementKey: this.headerMeasurementKey,
            content: (): void => { this.header(); },
            onHeightChange: (height: number, presentedKey: number): void => this.onHeaderHeightChange(height, presentedKey) });
        }.width('100%').padding({ left: this.geometry.header.insetLeft, right: this.geometry.header.insetRight })
          .margin({ top: this.geometry.header.top }).zIndex(10).hitTestBehavior(HitTestMode.Transparent);
      }
      Stack({ alignContent: Alignment.Bottom }) {
        Column() {
          Column() { this.footer(); }
            .width('100%').padding({ left: this.geometry.footer.insetLeft, right: this.geometry.footer.insetRight })
            .hitTestBehavior(this.footerSurfaceValue() === 'solid' ? HitTestMode.Default : HitTestMode.Transparent)
            .onAreaChange(this.footerAreaChangeHandler(this.footerMeasurementKey));
        }.width('100%')
          .hitTestBehavior(this.footerSurfaceValue() === 'solid' ? HitTestMode.Default : HitTestMode.Transparent)
          .padding({ bottom: this.footerSurfaceValue() === 'solid' ? this.geometry.footer.bottom : 0 })
          .margin({ bottom: this.footerSurfaceValue() === 'solid' ? 0 : this.geometry.footer.bottom })
          .attributeModifier(new ReaderFooterFrameModifier(this.frameStyle.footer));
      }.width('100%').height('100%').zIndex(20).hitTestBehavior(HitTestMode.Transparent);
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
