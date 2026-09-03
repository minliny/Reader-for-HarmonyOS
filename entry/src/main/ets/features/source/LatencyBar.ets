import { TOK_LINE } from '../common/ReaderTokens';


// LatencyBar —— 换源候选行延迟条 (Figma SourceSwitch/LatencyBar): 36×3 track r1.5。
// fillWidth 数据驱动 (ms→px, 由调用方换算); 无延迟数据时 track 空 (与 "—" 占位一致)。
// 纯展示组件, 不持有业务状态。
@Component
export struct LatencyBar {
  @Prop fillWidth: number = 0;
  @Prop fillColor: string = '#C08020';
  @Prop trackColor: string = TOK_LINE;

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      Text('')
        .width(36)
        .height(3)
        .borderRadius(1.5)
        .backgroundColor(this.trackColor);
      if (this.fillWidth > 0) {
        Text('')
          .width(this.fillWidth)
          .height(3)
          .borderRadius(1.5)
          .backgroundColor(this.fillColor);
      }
    }
    .width(36)
    .height(3);
  }
}