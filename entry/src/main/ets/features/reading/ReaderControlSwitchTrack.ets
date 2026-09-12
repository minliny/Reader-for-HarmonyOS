import { TOK_READ_ELEVATED, TOK_READ_PRIMARY } from '../common/ReaderTokens';

/** Visual-only shared switch. The owning row retains business availability,
 * accessibility and its click callback; this child never starts an animation or
 * consumes the same tap twice. Dimensions/colors remain design parameters.
 */
@Component
export struct ReaderControlSwitchTrack {
  @Prop value: boolean = false;
  @Prop trackWidth: number = 44;
  @Prop trackHeight: number = 24;
  @Prop thumbSize: number = 20;
  @Prop thumbInset: number = 2;
  @Prop activeColor: ResourceColor = TOK_READ_PRIMARY;
  @Prop inactiveColor: ResourceColor = '#AAA39A';
  @Prop thumbColor: ResourceColor = TOK_READ_ELEVATED;

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      Row()
        .width(this.thumbSize).height(this.thumbSize)
        .backgroundColor(this.thumbColor).borderRadius(this.thumbSize / 2)
        .position({ x: this.value ? this.trackWidth - this.thumbInset - this.thumbSize : this.thumbInset,
          y: (this.trackHeight - this.thumbSize) / 2 });
    }
    .width(this.trackWidth).height(this.trackHeight)
    .backgroundColor(this.value ? this.activeColor : this.inactiveColor)
    .borderRadius(999)
    .hitTestBehavior(HitTestMode.Transparent);
  }
}
