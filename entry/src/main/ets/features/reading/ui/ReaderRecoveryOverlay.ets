/** A floating recovery surface inside the reading stage. The reading owner supplies the current actions. */
@Component
export struct ReaderRecoveryOverlay {
  @Prop overlayId: string = '';
  @Prop widthVp: number = 0;
  @Prop maxHeightVp: number = 0;
  @Prop leftVp: number = 0;
  @Prop topVp: number = 0;
  @Prop interactionEnabled: boolean = false;
  @BuilderParam content: () => void;

  build() {
    Scroll() {
      Column({ space: 8 }) {
        this.content();
      }.width('100%');
    }
    .width(this.widthVp)
    .constraintSize({ maxHeight: this.maxHeightVp })
    .position({ x: this.leftVp, y: this.topVp })
    .id(this.overlayId)
    // Keep recovery touches within the overlay so they do not dismiss controls.
    .onTouch((event: TouchEvent): void => event.stopPropagation())
    .opacity(this.interactionEnabled ? 1 : 0)
    .enabled(this.interactionEnabled)
    .accessibilityLevel(this.interactionEnabled ? 'auto' : 'no-hide-descendants')
    .zIndex(8)
    .hitTestBehavior(this.interactionEnabled ? HitTestMode.Default : HitTestMode.None);
  }
}
