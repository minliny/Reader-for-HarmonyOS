import { MESSAGE_META, MESSAGE_GESTURE_ICON } from '../common/ReaderMessageStyle';

/** A brief footer revealed by an upward boundary pull.
 * The reading owner supplies release/preparation copy and the current theme. */
@Component
export struct MangaBoundaryTurnFeedback {
  @Prop caption: string = '';
  @Prop paperColor: ResourceColor = '#ffffff';
  @Prop inkColor: ResourceColor = '#111111';
  @Prop mutedColor: ResourceColor = '#666666';

  build() {
    Row({ space: 8 }) {
      Text('↑')
        .fontFamily(MESSAGE_GESTURE_ICON.fontFamily)
        .fontWeight(MESSAGE_GESTURE_ICON.fontWeight)
        .fontSize(MESSAGE_GESTURE_ICON.fontSizeFp)
        .lineHeight(MESSAGE_GESTURE_ICON.lineHeightFp as number)
        .minFontScale(1).maxFontScale(1).accessibilityLevel('no')
        .fontColor(this.mutedColor).maxLines(1);
      Text(this.caption)
        .fontFamily(MESSAGE_META.fontFamily)
        .fontWeight(MESSAGE_META.fontWeight)
        .fontSize(MESSAGE_META.fontSizeFp)
        .lineHeight(MESSAGE_META.lineHeightFp as number)
        .fontColor(this.inkColor).maxLines(1);
    }.width('100%').height(48).justifyContent(FlexAlign.Center)
      .backgroundColor(this.paperColor).padding({ left: 18, right: 18 })
      .hitTestBehavior(HitTestMode.None);
  }
}
