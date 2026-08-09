import { registerReaderFonts } from './ReaderFonts';
import {
  TOK_BORDER,
  TOK_BORDER_W,
  TOK_PRIMARY_DARK,
  TOK_SPACE_CONTROL_INLINE,
  TOK_SURFACE_PANEL_SOFT,
} from '../common/ReaderTokens';

// 统一下拉触发条 — 对齐 Primitive/Select MD Selected (282:124): panel-soft 高亮底 +
// 边框 + r6 + 容器 padding 10 + 文字-chevron gap 8, 值右对齐 Noto Sans SC Bold 12。
// 展开面板已拆至 ReaderSelectPanel: 本组件只渲染固定 36 高的触发条。展开面板由宿主
// 页在全高 overlay Stack 内按触发条全局坐标定位渲染 (ReaderSelectPanel)。
// 原因: ArkUI 把溢出父容器边界的子组件命中测试裁到父边界 — 固定高行(58/50/36)内的
// 下拉面板下层选项渲染可见但不可点, 所以面板必须挂在全高容器, 不能留在行内。
// 宽度 = 最长文本实际测量宽(measureText) + chrome(padding 20 + gap 8 + chevron 12),
// 替代原 maxLen*12+44 启发式(对混合 CJK/拉丁严重偏大)。
const TRIGGER_H = 36;
const SELECT_PAD = TOK_SPACE_CONTROL_INLINE; // 10
const CHEVRON_GAP = 8;
const CHEVRON_W = 12;
const CHEVRON_H = 8;
const SELECT_CHROME = SELECT_PAD * 2 + CHEVRON_GAP + CHEVRON_W; // 40

@Component
export struct ReaderSelect {
  @Prop value: string = '';
  @Prop options: string[] = [];
  @Prop isOpen: boolean = false;
  // 仅用于设计明确要求占满剩余行宽的真实单选字段（如书源分组）。
  // 0 保持按最长选项测量；正值固定触发条宽度并对长文本截断。
  @Prop controlWidth: number = 0;
  onToggle: () => void = (): void => {};

  aboutToAppear(): void {
    registerReaderFonts(this.getUIContext().getFont());
  }

  build() {
    // 触发条固定 36 高, 收起/展开态同构 (展开时面板由宿主 overlay 覆盖, 顶行即已选项)。
    Stack({ alignContent: Alignment.TopStart }) {
      this.trigger();
    }
    .width(this.resolvedWidth())
    .height(TRIGGER_H);
  }

  @Builder
  private trigger() {
    Row({ space: CHEVRON_GAP }) {
      Text(this.value)
        .layoutWeight(1)
        .fontFamily('ReaderNotoSansSC')
        .fontWeight(FontWeight.Bold)
        .fontSize(12)
        .fontColor(TOK_PRIMARY_DARK)
        .textAlign(TextAlign.End)
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis });
      Image($r('app.media.reader_chevron_down')).width(CHEVRON_W).height(CHEVRON_H)
        .rotate({ angle: this.isOpen ? 180 : 0 });
    }
    .width('100%')
    .height(TRIGGER_H)
    .padding({ left: SELECT_PAD, right: SELECT_PAD })
    .backgroundColor(TOK_SURFACE_PANEL_SOFT)
    .border({ width: TOK_BORDER_W, color: TOK_BORDER })
    .borderRadius(6)
    .alignItems(VerticalAlign.Center)
    .onClick((): void => this.onToggle());
  }

  // 最长文本(值 ∪ 选项)实测宽 + chrome, px→vp。
  private resolvedWidth(): number {
    if (this.controlWidth > 0) {
      return this.controlWidth;
    }
    const ctx = this.getUIContext();
    const utils = ctx.getMeasureUtils();
    let maxPx = 0;
    const texts: string[] = [this.value, ...this.options];
    for (let i = 0; i < texts.length; i++) {
      const w = utils.measureText({
        textContent: texts[i],
        fontSize: 12,
        fontFamily: 'ReaderNotoSansSC',
      });
      if (w > maxPx) {
        maxPx = w;
      }
    }
    return Math.ceil(ctx.px2vp(maxPx)) + SELECT_CHROME;
  }
}
