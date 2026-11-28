import { MESSAGE_META } from '../../../ui/foundation/ReaderMessageStyle';
import { motionAnimateParam } from '../../../ui/foundation/MotionSpec';
import { readerMotionReducedFadeParam } from '../../../ui/foundation/ReaderMotionPolicy';
import { readerAppColor } from '../../../ui/foundation/ReaderAppColors';

/** A brief footer revealed by an upward boundary pull.
 * The reading owner supplies release/preparation copy and the current theme. */
@Component
export struct MangaBoundaryTurnFeedback {
  @Prop caption: string = '';
  @Prop scheme: string = 'day';
  @Prop distance: number = 0;
  @Prop armed: boolean = false;
  @Prop busy: boolean = false;
  @Prop reduceMotion: boolean = false;

  private revealOpacity(): number {
    if (this.busy || this.armed) return 1;
    const distance = Math.max(0, this.distance - 24);
    return this.reduceMotion ? (distance > 0 ? 1 : 0) : 1 - Math.exp(-distance / 34);
  }

  build() {
    Row({ space: 8 }) {
      Image(this.scheme === 'night' ? $r('app.media.reader_chevron_down_primary_theme_night') :
        $r('app.media.reader_chevron_down_primary'))
        .width(16).height(16).flexShrink(0)
        .rotate({ angle: this.armed && !this.reduceMotion ? 0 : 180 })
        .animation(this.reduceMotion ? { duration: 0 } : motionAnimateParam('manga.boundary.arrow'))
        .accessibilityLevel('no');
      Text(this.caption)
        .fontFamily(MESSAGE_META.fontFamily)
        .fontWeight(MESSAGE_META.fontWeight)
        .fontSize(MESSAGE_META.fontSizeFp)
        .lineHeight(MESSAGE_META.lineHeightFp as number)
        .fontColor(readerAppColor('TOK_PRIMARY_TEXT', this.scheme)).maxLines(2)
        .textOverflow({ overflow: TextOverflow.Ellipsis });
    }.width('100%').height(56).justifyContent(FlexAlign.Center)
      .backgroundColor(readerAppColor('TOK_SURFACE_ELEVATED', this.scheme)).padding({ left: 18, right: 18 })
      .opacity(this.revealOpacity()).animation(this.reduceMotion ? readerMotionReducedFadeParam() : { duration: 0 })
      .hitTestBehavior(HitTestMode.None);
  }
}
