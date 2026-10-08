import { TYPE_SOURCE_SWITCH_NOVEL_ACTION } from '../common/ReaderTypography';

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
        .fontFamily(TYPE_SOURCE_SWITCH_NOVEL_ACTION.fontFamily)
        .fontWeight(TYPE_SOURCE_SWITCH_NOVEL_ACTION.fontWeight)
        .fontSize(TYPE_SOURCE_SWITCH_NOVEL_ACTION.fontSizeFp)
        .lineHeight(TYPE_SOURCE_SWITCH_NOVEL_ACTION.lineHeightFp as number)
        .fontColor(this.mutedColor).maxLines(1);
      Text(this.caption)
        .fontFamily(TYPE_SOURCE_SWITCH_NOVEL_ACTION.fontFamily)
        .fontWeight(TYPE_SOURCE_SWITCH_NOVEL_ACTION.fontWeight)
        .fontSize(TYPE_SOURCE_SWITCH_NOVEL_ACTION.fontSizeFp)
        .lineHeight(TYPE_SOURCE_SWITCH_NOVEL_ACTION.lineHeightFp as number)
        .fontColor(this.inkColor).maxLines(1);
    }.width('100%').height(48).justifyContent(FlexAlign.Center)
      .backgroundColor(this.paperColor).padding({ left: 18, right: 18 })
      .hitTestBehavior(HitTestMode.None);
  }
}
