import { readerPageAreaLength } from './ReaderPageShell';
import { ReaderHeaderFrameModifier } from './ReaderPageNativeAttributes';
import { ReaderHeaderFrameStyle } from './ReaderFrameStyle';
import { ReaderNativeSlotMeasurement } from './ReaderNativeSlotMeasurement';

/** Actual native header owner. Compound title/tools or search/filter/statistics
 * slots measure together so expansion updates their scroll clearance. */
@Component
export struct ReaderFixedHeaderHost {
  @Prop style: ReaderHeaderFrameStyle;
  @Prop layoutDebugHeaderKey: string = '';
  @Prop @Watch('requestMeasurement') measurementKey: number = 0;
  private readonly nativeMeasurement: ReaderNativeSlotMeasurement = new ReaderNativeSlotMeasurement();
  onHeightChange: (height: number, presentedKey: number) => void = (_height: number, _presentedKey: number): void => {};
  @BuilderParam content: () => void = this.emptySlot;
  @Builder private emptySlot() {}

  build() {
    Column() { this.content(); }
      .width('100%')
      .attributeModifier(new ReaderHeaderFrameModifier(this.style))
      .hitTestBehavior(HitTestMode.Transparent)
      .id(this.nativeMeasurement.id)
      .customProperty('readerLayoutDebugOpaqueHeader', this.layoutDebugHeaderKey)
      .onAppear((): void => this.nativeMeasurement.mount(this.getUIContext(), this.measurementKey,
        (height: number, key: number): void => this.onHeightChange(height, key)))
      .onDisAppear((): void => this.nativeMeasurement.unmount())
      .onAreaChange(this.areaChangeHandler(this.measurementKey));
  }

  private requestMeasurement(): void { this.nativeMeasurement.request(this.measurementKey); }

  private areaChangeHandler(presentedKey: number): (_old: Area, next: Area) => void {
    return (_old: Area, next: Area): void => {
      if (presentedKey !== this.measurementKey) return;
      const height = readerPageAreaLength(next.height);
      if (Number.isFinite(height) && height >= 0) this.onHeightChange(height, presentedKey);
    };
  }
}
