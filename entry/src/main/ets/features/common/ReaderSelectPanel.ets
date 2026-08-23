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
import { motionAnimateParam } from './MotionSpec';
import type { ReaderSelectVariant } from './ReaderSelect';
import {
  TYPE_SELECT_APPEARANCE_VALUE,
  TYPE_SELECT_DEFAULT_VALUE,
  TYPE_SELECT_OPTION,
  TYPE_SELECT_SETTINGS_VALUE,
} from './ReaderTypography';

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
  @Prop variant: ReaderSelectVariant = 'default';
  @Prop reduceMotion: boolean = false;
  // 与 ReaderSelect.controlWidth 成对使用；0 保持按内容测量。
  @Prop controlWidth: number = 0;
  // true = x 为面板右缘 (宿主触发条整行右对齐场景, 如 RSS 筛选)。
  @Prop alignRight: boolean = false;
  onSelect: (option: string) => void = (_option: string): void => {};
  @State private expandedHeight: number = OPTION_H;
  @State private chevronAngle: number = 0;

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
    .height(this.expandedHeight)
    .zIndex(10)
    .backgroundColor(this.variant === 'appearanceCompact' ? '#D1FFF8EF' : TOK_FIELD_SURFACE)
    .border({
      width: TOK_BORDER_W,
      color: this.variant === 'appearanceCompact' ? '#C1C7CD' : TOK_BORDER,
    })
    .borderRadius(6)
    .clip(true)
    .onAppear((): void => this.expandPanel());
  }

  // 已选行 = 触发条展开态 (panel-soft 高亮 + 上旋 chevron)。点它 = 选中当前值并收起。
  @Builder
  private selectedRow() {
    if (this.variant === 'appearanceCompact') {
      this.appearanceSelectedRow();
    } else {
      this.defaultSelectedRow();
    }
  }

  @Builder
  private appearanceSelectedRow() {
    Stack({ alignContent: Alignment.TopStart }) {
      Text(this.value)
        .width(Math.max(0, this.resolvedWidth() - 28))
        .height(14)
        .fontFamily(TYPE_SELECT_APPEARANCE_VALUE.fontFamily)
        .fontWeight(TYPE_SELECT_APPEARANCE_VALUE.fontWeight)
        .fontSize(TYPE_SELECT_APPEARANCE_VALUE.fontSizeFp)
        .lineHeight(TYPE_SELECT_APPEARANCE_VALUE.lineHeightFp as number)
        .fontColor(TOK_PRIMARY_DARK)
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
        .position({ x: 10, y: 11 });
      Image($r('app.media.reader_chevron_down'))
        .width(8)
        .height(4)
        .rotate({ angle: this.chevronAngle })
        .position({ x: this.resolvedWidth() - 14, y: 16 });
    }
    .width('100%')
    .height(OPTION_H)
    .backgroundColor(TOK_SURFACE_PANEL_SOFT)
    .onClick((): void => this.onSelect(this.value));
  }

  @Builder
  private defaultSelectedRow() {
    Row({ space: CHEVRON_GAP }) {
      Text(this.value)
        .layoutWeight(1)
        .fontFamily(TYPE_SELECT_DEFAULT_VALUE.fontFamily)
        .fontWeight(TYPE_SELECT_DEFAULT_VALUE.fontWeight)
        .fontSize(TYPE_SELECT_DEFAULT_VALUE.fontSizeFp)
        .fontColor(TOK_PRIMARY_DARK)
        .textAlign(TextAlign.Start)
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis });
      Image($r('app.media.reader_chevron_down')).width(CHEVRON_W).height(CHEVRON_H)
        .rotate({ angle: this.chevronAngle });
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
        .fontFamily(TYPE_SELECT_OPTION.fontFamily)
        .fontWeight(TYPE_SELECT_OPTION.fontWeight)
        .fontSize(TYPE_SELECT_OPTION.fontSizeFp)
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
        fontSize: this.measureTextStyle().fontSizeFp,
        fontFamily: this.measureTextStyle().fontFamily,
      });
      if (w > maxPx) {
        maxPx = w;
      }
    }
    return Math.ceil(ctx.px2vp(maxPx)) + this.resolvedChrome();
  }

  private resolvedChrome(): number {
    if (this.variant === 'settingsPhone' || this.variant === 'settingsTablet') {
      return 10 + 8 + 6 + (this.variant === 'settingsTablet' ? 10 : 7);
    }
    return SELECT_CHROME;
  }

  private measureTextStyle() {
    if (this.variant === 'settingsPhone' || this.variant === 'settingsTablet') {
      return TYPE_SELECT_SETTINGS_VALUE;
    }
    if (this.variant === 'appearanceCompact') {
      return TYPE_SELECT_APPEARANCE_VALUE;
    }
    return TYPE_SELECT_DEFAULT_VALUE;
  }

  private expandPanel(): void {
    const targetHeight = this.fullPanelHeight();
    if (this.reduceMotion) {
      this.expandedHeight = targetHeight;
      this.chevronAngle = -180;
      return;
    }
    this.getUIContext().animateTo(motionAnimateParam('dropdown.menu.expand'), (): void => {
      this.expandedHeight = targetHeight;
      this.chevronAngle = -180;
    });
  }

  private fullPanelHeight(): number {
    let unselectedCount = 0;
    for (const option of this.options) {
      if (option !== this.value) {
        unselectedCount += 1;
      }
    }
    return OPTION_H * (1 + unselectedCount);
  }
}
