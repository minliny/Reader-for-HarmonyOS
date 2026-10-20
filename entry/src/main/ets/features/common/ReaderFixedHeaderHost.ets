import { ReaderHeaderFrameModifier, ReaderHeaderKind, ReaderHeaderSurface, readerPageAreaLength } from './ReaderPageShell';

/** Actual native header owner. Compound title/tools or search/filter/statistics
 * slots measure together so expansion updates their scroll clearance. */
@Component
export struct ReaderFixedHeaderHost {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  @Prop kind: ReaderHeaderKind = 'standard';
  @Prop surface: ReaderHeaderSurface = 'solid';
  @Prop measurementKey: number = 0;
  onHeightChange: (height: number, presentedKey: number) => void = (_height: number, _presentedKey: number): void => {};
  @BuilderParam content: () => void = this.emptySlot;
  @Builder private emptySlot() {}

  build() {
    Column() { this.content(); }
      .width('100%')
      .attributeModifier(new ReaderHeaderFrameModifier(this.kind, this.surface, this.appThemeScheme))
      .hitTestBehavior(HitTestMode.Transparent)
      .onAreaChange(this.areaChangeHandler(this.measurementKey));
  }

  private areaChangeHandler(presentedKey: number): (_old: Area, next: Area) => void {
    return (_old: Area, next: Area): void => {
      if (presentedKey !== this.measurementKey) return;
      const height = readerPageAreaLength(next.height);
      if (Number.isFinite(height) && height >= 0) this.onHeightChange(height, presentedKey);
    };
  }
}
