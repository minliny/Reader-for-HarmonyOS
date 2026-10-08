import {
  TYPE_SOURCE_SWITCH_NOVEL_ACTION,
  TYPE_SOURCE_SWITCH_NOVEL_METADATA,
  TYPE_SOURCE_SWITCH_NOVEL_COLUMN
} from '../common/ReaderTypography';

/** The two finite chapter-turn feedback actors share existing app typography.
 * The reading owner supplies chapter facts, current theme and safe insets. */
@Component
export struct MangaBoundaryTurnFeedback {
  @Prop kind: 'hint' | 'status' = 'hint';
  @Prop caption: string = '';
  @Prop chapterTitle: string = '';
  @Prop progressPercent: number = 0;
  @Prop busy: boolean = false;
  @Prop paperColor: ResourceColor = '#ffffff';
  @Prop surfaceColor: ResourceColor = '#ffffff';
  @Prop inkColor: ResourceColor = '#111111';
  @Prop mutedColor: ResourceColor = '#666666';
  @Prop accentColor: ResourceColor = '#22a06b';
  @Prop insetLeft: number = 0;
  @Prop insetTop: number = 0;
  @Prop insetRight: number = 0;
  @Prop insetBottom: number = 0;
  onRetry: () => void = (): void => {};
  onDismiss: () => void = (): void => {};

  build() {
    if (this.kind === 'hint') this.hint();
    else this.status();
  }

  @Builder
  private hint() {
    Column({ space: 4 }) {
      Text(this.caption)
        .fontFamily(TYPE_SOURCE_SWITCH_NOVEL_ACTION.fontFamily)
        .fontWeight(TYPE_SOURCE_SWITCH_NOVEL_ACTION.fontWeight)
        .fontSize(TYPE_SOURCE_SWITCH_NOVEL_ACTION.fontSizeFp)
        .lineHeight(TYPE_SOURCE_SWITCH_NOVEL_ACTION.lineHeightFp as number)
        .fontColor(this.inkColor);
      Text(this.chapterTitle)
        .fontFamily(TYPE_SOURCE_SWITCH_NOVEL_COLUMN.fontFamily)
        .fontWeight(TYPE_SOURCE_SWITCH_NOVEL_COLUMN.fontWeight)
        .fontSize(TYPE_SOURCE_SWITCH_NOVEL_COLUMN.fontSizeFp)
        .lineHeight(TYPE_SOURCE_SWITCH_NOVEL_COLUMN.lineHeightFp as number)
        .fontColor(this.mutedColor).maxLines(1);
      Progress({ value: Math.max(0, Math.min(100, this.progressPercent)), total: 100, type: ProgressType.Linear })
        .color(this.accentColor).width(112).height(3);
    }.height(88).width('100%').justifyContent(FlexAlign.Center).backgroundColor(this.paperColor)
      .padding({ left: 18, right: 18 }).hitTestBehavior(HitTestMode.None);
  }

  @Builder
  private status() {
    Stack({ alignContent: Alignment.Bottom }) {
      Column({ space: 8 }) {
        Text(this.caption)
          .fontFamily(TYPE_SOURCE_SWITCH_NOVEL_METADATA.fontFamily)
          .fontWeight(TYPE_SOURCE_SWITCH_NOVEL_METADATA.fontWeight)
          .fontSize(TYPE_SOURCE_SWITCH_NOVEL_METADATA.fontSizeFp)
          .lineHeight(TYPE_SOURCE_SWITCH_NOVEL_METADATA.lineHeightFp as number)
          .fontColor(this.inkColor).maxLines(2);
        Row({ space: 12 }) {
          if (!this.busy) {
            Button('重试').height(36)
              .fontFamily(TYPE_SOURCE_SWITCH_NOVEL_ACTION.fontFamily)
              .fontWeight(TYPE_SOURCE_SWITCH_NOVEL_ACTION.fontWeight)
              .fontSize(TYPE_SOURCE_SWITCH_NOVEL_ACTION.fontSizeFp)
              .onClick((): void => this.onRetry());
          }
          Button(this.busy ? '取消' : '关闭').height(36)
            .fontFamily(TYPE_SOURCE_SWITCH_NOVEL_ACTION.fontFamily)
            .fontWeight(TYPE_SOURCE_SWITCH_NOVEL_ACTION.fontWeight)
            .fontSize(TYPE_SOURCE_SWITCH_NOVEL_ACTION.fontSizeFp)
            .onClick((): void => this.onDismiss());
        }
      }.padding(14).borderRadius(14).backgroundColor(this.surfaceColor).margin({ left: 18, right: 18, bottom: 18 });
    }.width('100%').height('100%')
      .padding({ left: this.insetLeft, top: this.insetTop, right: this.insetRight, bottom: this.insetBottom })
      .hitTestBehavior(HitTestMode.Transparent);
  }
}
