import { registerReaderFonts } from './ReaderFonts';
import {
  TOK_BORDER,
  TOK_BORDER_W,
  TOK_CONTROL_INK,
  TOK_FIELD_SURFACE,
  TOK_PRIMARY_DARK,
  TOK_SPACE_CONTROL_INLINE,
  TOK_SURFACE_PANEL_SOFT,
} from '../common/ReaderTokens';

// 展开下拉面板 — 宿主页在全高 overlay Stack 内定位渲染, position 相对宿主 Stack。
// 全部选项行都落在宿主 Stack bounds 内 → 可点 (ArkUI 命中测试裁到父边界, 行内面板
// 下层选项不可点; 拆到全高容器即解决)。
// 面板 = 已选行置顶 (panel-soft 高亮 + Bold + chevron 上旋) + 其余选项 (透明 +
// Regular #41484C), 选项左对齐 px10, 对齐 motion 1506:8807。
// 宽度 = 最长文本实测宽 + chrome, 与 ReaderSelect.trigger 同式, 保证面板与触发条同宽。
const OPTION_H = 36;
const SELECT_PAD = TOK_SPACE_CONTROL_INLINE; // 10
const CHEVRON_GAP = 8;
const CHEVRON_W = 12;
const CHEVRON_H = 8;
const SELECT_CHROME = SELECT_PAD * 2 + CHEVRON_GAP + CHEVRON_W; // 40

// 宿主页记录触发条全局锚点的类型 (Record<string, SelectAnchor>): ArkTS 禁止 obj-literal 作
// Record 值类型, 须具名接口。锚点 = 触发条 onAreaChange 的 globalPosition, 已是 vp 单位,
// 直接取用 (勿再 px2vp —— 曾二次÷3.5 致面板错位)。
export interface SelectAnchor {
  x: number;
  y: number;
}

@Component
export struct ReaderSelectPanel {
  @Prop value: string = '';
  @Prop options: string[] = [];
  @Prop x: number = 0;
  @Prop y: number = 0;
  // 与 ReaderSelect.controlWidth 成对使用；0 保持按内容测量。
  @Prop controlWidth: number = 0;
  // true = x 为面板右缘 (宿主触发条整行右对齐场景, 如 RSS 筛选)。
  @Prop alignRight: boolean = false;
  onSelect: (option: string) => void = (_option: string): void => {};

  aboutToAppear(): void {
    registerReaderFonts(this.getUIContext().getFont());
  }

  build() {
    Column({ space: 0 }) {
      this.selectedRow();
      ForEach(this.options.filter((o: string): boolean => o !== this.value), (opt: string) => {
        this.optionRow(opt);
      }, (opt: string): string => `ropt-${opt}`);
    }
    .position({ x: this.alignRight ? this.x - this.resolvedWidth() : this.x, y: this.y })
    .width(this.resolvedWidth())
    .zIndex(10)
    .backgroundColor(TOK_FIELD_SURFACE)
    .border({ width: TOK_BORDER_W, color: TOK_BORDER })
    .borderRadius(6);
  }

  // 已选行 = 触发条展开态 (panel-soft 高亮 + 上旋 chevron)。点它 = 选中当前值并收起。
  @Builder
  private selectedRow() {
    Row({ space: CHEVRON_GAP }) {
      Text(this.value)
        .layoutWeight(1)
        .fontFamily('ReaderNotoSansSC')
        .fontWeight(FontWeight.Bold)
        .fontSize(12)
        .fontColor(TOK_PRIMARY_DARK)
        .textAlign(TextAlign.Start)
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis });
      Image($r('app.media.reader_chevron_down')).width(CHEVRON_W).height(CHEVRON_H)
        .rotate({ angle: 180 });
    }
    .width('100%')
    .height(OPTION_H)
    .padding({ left: SELECT_PAD, right: SELECT_PAD })
    .backgroundColor(TOK_SURFACE_PANEL_SOFT)
    .alignItems(VerticalAlign.Center)
    .onClick((): void => this.onSelect(this.value));
  }

  @Builder
  private optionRow(opt: string) {
    Row() {
      Text(opt)
        .layoutWeight(1)
        .fontFamily('ReaderNotoSansSC')
        .fontWeight(FontWeight.Regular)
        .fontSize(12)
        .fontColor(TOK_CONTROL_INK)
        .textAlign(TextAlign.Start)
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis });
    }
    .width('100%')
    .height(OPTION_H)
    .padding({ left: SELECT_PAD, right: SELECT_PAD })
    .alignItems(VerticalAlign.Center)
    .onClick((): void => this.onSelect(opt));
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
