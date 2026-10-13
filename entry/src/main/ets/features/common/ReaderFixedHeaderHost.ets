import { ReaderHeaderFrameModifier, ReaderHeaderKind, ReaderHeaderSurface, readerPageAreaLength } from './ReaderPageShell';

/** Actual native header owner. Compound title/tools or search/filter/statistics
 * slots measure together so expansion updates their scroll clearance. */
@Component
export struct ReaderFixedHeaderHost {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  @Prop kind: ReaderHeaderKind = 'standard';
  @Prop surface: ReaderHeaderSurface = 'solid';
  onHeightChange: (height: number) => void = (_height: number): void => {};
  @BuilderParam content: () => void = this.emptySlot;
  @Builder private emptySlot() {}

  build() {
    Column() { this.content(); }
      .width('100%')
      .attributeModifier(new ReaderHeaderFrameModifier(this.kind, this.surface, this.appThemeScheme))
      .hitTestBehavior(HitTestMode.Transparent)
      .onAreaChange((_old: Area, next: Area): void => {
        const height = readerPageAreaLength(next.height);
        if (Number.isFinite(height) && height >= 0) this.onHeightChange(height);
      });
  }
}
