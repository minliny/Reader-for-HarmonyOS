import { readerAppColor } from '../common/ReaderThemeRegistry';
import { TOK_READ_ELEVATED, TOK_READ_PRIMARY } from '../common/ReaderTokens';

/** Visual-only shared switch. The owning row retains business availability,
 * accessibility and its click callback; this child never starts an animation or
 * consumes the same tap twice. Dimensions/colors remain design parameters.
 */
@Component
export struct ReaderControlSwitchTrack {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';

  @Prop value: boolean = false;
  @Prop trackWidth: number = 44;
  @Prop trackHeight: number = 24;
  @Prop thumbSize: number = 20;
  @Prop thumbInset: number = 2;
  @Prop activeColor: ResourceColor = '';
  @Prop inactiveColor: ResourceColor = '';
  @Prop thumbColor: ResourceColor = '';

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      Row()
        .width(this.thumbSize).height(this.thumbSize)
        .backgroundColor((this.thumbColor === '' ? readerAppColor('TOK_READ_ELEVATED', this.appThemeScheme) : this.thumbColor)).borderRadius(this.thumbSize / 2)
        .position({ x: this.value ? this.trackWidth - this.thumbInset - this.thumbSize : this.thumbInset,
          y: (this.trackHeight - this.thumbSize) / 2 });
    }
    .width(this.trackWidth).height(this.trackHeight)
    .backgroundColor(this.value ? (this.activeColor === '' ? readerAppColor('TOK_READ_PRIMARY', this.appThemeScheme) : this.activeColor) : (this.inactiveColor === '' ? readerAppColor('app.ReaderControlSwitchTrack.inactiveColor.default.FFAAA39A', this.appThemeScheme) : this.inactiveColor))
    .borderRadius(999)
    .hitTestBehavior(HitTestMode.Transparent);
  }
}
