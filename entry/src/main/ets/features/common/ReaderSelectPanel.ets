import { readerAppColor } from './ReaderThemeRegistry';
import { registerReaderFonts } from './ReaderFonts';
import {
  TOK_BORDER,
  TOK_BORDER_W,
  TOK_CONTROL_INK,
  TOK_FIELD_SURFACE,
  TOK_INK,
  TOK_PRIMARY_DARK,
  TOK_SPACE_CONTROL_INLINE,
  TOK_SURFACE_PANEL_SOFT,
} from '../common/ReaderTokens';
import { motionAnimateParam } from './MotionSpec';
import {
  APPEARANCE_SELECT_OPTION_HEIGHT, appearanceSelectMenuHeight,
} from './ReaderSelectAppearanceStyle';
import type { ReaderSelectVariant } from './ReaderSelect';
import {
  TYPE_SELECT_APPEARANCE_VALUE,
  TYPE_SELECT_DEFAULT_VALUE,
  TYPE_SELECT_OPTION,
  TYPE_SELECT_SETTINGS_VALUE,
  TYPE_SELECT_SOURCE_GROUP_VALUE,
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
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';

  @Prop value: string = '';
  @Prop options: string[] = [];
  @Prop x: number = 0;
  @Prop y: number = 0;
  @Prop variant: ReaderSelectVariant = 'default';
  @Prop reduceMotion: boolean = false;
  @Prop @Watch('onClosingChanged') closing: boolean = false;
  @Prop @Watch('onIdentityChanged') selectionId: string = '';
  // 与 ReaderSelect.controlWidth 成对使用；0 保持按内容测量。
  @Prop controlWidth: number = 0;
  // true = x 为面板右缘 (宿主触发条整行右对齐场景, 如 RSS 筛选)。
  @Prop alignRight: boolean = false;
  onSelect: (option: string) => void = (_option: string): void => {};
  // Production callers commit the immutable choice now; finish only unmounts.
  // onSelect remains a guarded compatibility callback for the legacy preview.
  onCommit: ((option: string, identity: string) => void) | undefined = undefined;
  onDismiss: (identity: string) => void = (_identity: string): void => {};
  @State private expandedHeight: number = OPTION_H;
  @State private chevronAngle: number = 0;
  @State private closeInFlight: boolean = false;
  private mounted: boolean = false;
  private generation: number = 0;
  private closingValue: string = '';
  private closingOptions: string[] = [];

  private renderedValue(): string { return this.closeInFlight ? this.closingValue : this.value; }
  private renderedOptions(): string[] { return this.closeInFlight ? this.closingOptions : this.options; }

  aboutToAppear(): void {
    this.mounted = true;
    this.generation += 1;
    registerReaderFonts(this.getUIContext().getFont());
  }

  aboutToDisappear(): void { this.mounted = false; this.generation += 1; }

  private onIdentityChanged(): void {
    this.generation += 1;
    this.closeInFlight = false;
    if (this.mounted) this.expandPanel();
  }

  build() {
    Column({ space: 0 }) {
      if (this.variant === 'appearanceLibrary') {
        ForEach(this.renderedOptions(), (opt: string) => {
          this.appearanceLibraryOption(opt);
        }, (opt: string): string => `ropt-${opt}`);
      } else {
        this.selectedRow();
        ForEach(this.renderedOptions().filter((o: string): boolean => o !== this.renderedValue()), (opt: string) => {
          this.optionRow(opt);
        }, (opt: string): string => `ropt-${opt}`);
      }
    }
    .position({ x: this.alignRight ? this.x - this.resolvedWidth() : this.x, y: this.y })
    .width(this.resolvedWidth())
    .height(this.expandedHeight)
    .padding(this.variant === 'appearanceLibrary' ? 3 : 0)
    .zIndex(10)
    .backgroundColor(this.panelBackgroundColor())
    .border({
      width: TOK_BORDER_W,
      color: this.panelBorderColor(),
    })
    .borderRadius(this.variant === 'appearanceLibrary' ? 9 : (this.variant === 'sourceGroup' ? 8 : 6))
    .shadow({ radius: this.variant === 'appearanceLibrary' ? 20 : 0,
      color: this.variant === 'appearanceLibrary' ? readerAppColor('app.ReaderSelectPanel.build.color.474B3A26', this.appThemeScheme) : Color.Transparent, offsetY: 8 })
    .clip(true)
    .onAppear((): void => this.expandPanel());
  }

  @Builder
  private appearanceLibraryOption(opt: string) {
    Row({ space: 10 }) {
      Text(opt).layoutWeight(1).fontFamily(opt === this.renderedValue() ? 'ReaderNotoSansSCUIBold' : 'ReaderNotoSansSCUIRegular').fontSize(11).lineHeight(13)
        .fontWeight(opt === this.renderedValue() ? FontWeight.Bold : FontWeight.Regular, { enableVariableFontWeight: true })
        .fontColor(opt === this.renderedValue() ? readerAppColor('app.ReaderSelectPanel.appearanceLibraryOption.fontColor.FF2F6373', this.appThemeScheme) : readerAppColor('app.ReaderSelectPanel.appearanceLibraryOption.fontColor.FF41484C', this.appThemeScheme)).maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis });
      if (opt === this.renderedValue()) {
        Image((this.appThemeScheme === 'night' ? $r('app.media.reader_appearance_make_check_theme_night') : $r('app.media.reader_appearance_make_check'))).width(11).height(9);
      }
    }.width('100%').height(APPEARANCE_SELECT_OPTION_HEIGHT).padding({ left: 9, right: 9 })
      .borderRadius(6).backgroundColor(opt === this.renderedValue() ? readerAppColor('app.appearance.selectSelected', this.appThemeScheme) : Color.Transparent)
      .accessibilityText(`${opt}${opt === this.renderedValue() ? '，已选择' : ''}`)
      .onClick((): void => this.selectAndCollapse(opt));
  }

  // 已选行 = 触发条展开态 (panel-soft 高亮 + 上旋 chevron)。点它 = 选中当前值并收起。
  @Builder
  private selectedRow() {
    if (this.variant === 'appearanceCompact') {
      this.appearanceSelectedRow();
    } else if (this.variant === 'sourceGroup') {
      this.sourceGroupSelectedRow();
    } else {
      this.defaultSelectedRow();
    }
  }

  @Builder
  private sourceGroupSelectedRow() {
    Stack({ alignContent: Alignment.TopStart }) {
      Text(this.renderedValue())
        .width(Math.max(0, this.resolvedWidth() - 42))
        .height(15)
        .fontFamily(TYPE_SELECT_SOURCE_GROUP_VALUE.fontFamily)
        .fontWeight(TYPE_SELECT_SOURCE_GROUP_VALUE.fontWeight)
        .fontSize(TYPE_SELECT_SOURCE_GROUP_VALUE.fontSizeFp)
        .lineHeight(TYPE_SELECT_SOURCE_GROUP_VALUE.lineHeightFp as number)
        .fontColor(readerAppColor('TOK_INK', this.appThemeScheme))
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
        .position({ x: 14, y: 10 });
      Image((this.appThemeScheme === 'night' ? $r('app.media.source_group_chevron_theme_night') : $r('app.media.source_group_chevron')))
        .width(12)
        .height(12)
        .rotate({ angle: this.chevronAngle })
        .position({ x: this.resolvedWidth() - 21, y: 12 });
    }
    .width('100%')
    .height(OPTION_H)
    .backgroundColor(readerAppColor('app.ReaderSelectPanel.sourceGroupSelectedRow.backgroundColor.FFFFFCF8', this.appThemeScheme))
    .onClick((): void => this.selectAndCollapse(this.renderedValue()));
  }

  @Builder
  private appearanceSelectedRow() {
    Stack({ alignContent: Alignment.TopStart }) {
      Text(this.renderedValue())
        .width(Math.max(0, this.resolvedWidth() - 28))
        .height(14)
        .fontFamily(TYPE_SELECT_APPEARANCE_VALUE.fontFamily)
        .fontWeight(TYPE_SELECT_APPEARANCE_VALUE.fontWeight)
        .fontSize(TYPE_SELECT_APPEARANCE_VALUE.fontSizeFp)
        .lineHeight(TYPE_SELECT_APPEARANCE_VALUE.lineHeightFp as number)
        .fontColor(readerAppColor('TOK_PRIMARY_TEXT', this.appThemeScheme))
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
        .position({ x: 10, y: 11 });
      Image((this.appThemeScheme === 'night' ? $r('app.media.reader_chevron_down_theme_night') : $r('app.media.reader_chevron_down')))
        .width(8)
        .height(4)
        .rotate({ angle: this.chevronAngle })
        .position({ x: this.resolvedWidth() - 14, y: 16 });
    }
    .width('100%')
    .height(OPTION_H)
    .backgroundColor(readerAppColor('TOK_SURFACE_PANEL_SOFT', this.appThemeScheme))
    .onClick((): void => this.selectAndCollapse(this.renderedValue()));
  }

  @Builder
  private defaultSelectedRow() {
    Row({ space: CHEVRON_GAP }) {
      Text(this.renderedValue())
        .layoutWeight(1)
        .fontFamily(TYPE_SELECT_DEFAULT_VALUE.fontFamily)
        .fontWeight(TYPE_SELECT_DEFAULT_VALUE.fontWeight)
        .fontSize(TYPE_SELECT_DEFAULT_VALUE.fontSizeFp)
        .fontColor(readerAppColor('TOK_PRIMARY_TEXT', this.appThemeScheme))
        .textAlign(TextAlign.Start)
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis });
      Image((this.appThemeScheme === 'night' ? $r('app.media.reader_chevron_down_theme_night') : $r('app.media.reader_chevron_down'))).width(CHEVRON_W).height(CHEVRON_H)
        .rotate({ angle: this.chevronAngle });
    }
    .width('100%')
    .height(OPTION_H)
    .padding({ left: SELECT_PAD, right: SELECT_PAD })
    .backgroundColor(readerAppColor('TOK_SURFACE_PANEL_SOFT', this.appThemeScheme))
    .alignItems(VerticalAlign.Center)
    .onClick((): void => this.selectAndCollapse(this.renderedValue()));
  }

  @Builder
  private optionRow(opt: string) {
    Row() {
      Text(opt)
        .layoutWeight(1)
        .fontFamily(this.optionTextStyle().fontFamily)
        .fontWeight(this.optionTextStyle().fontWeight)
        .fontSize(this.optionTextStyle().fontSizeFp)
        .lineHeight(this.optionTextStyle().lineHeightFp as number)
        .fontColor(this.variant === 'sourceGroup' ? readerAppColor('TOK_INK', this.appThemeScheme) : readerAppColor('TOK_CONTROL_INK', this.appThemeScheme))
        .textAlign(TextAlign.Start)
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis });
    }
    .width('100%')
    .height(OPTION_H)
    .padding({
      left: this.variant === 'sourceGroup' ? 14 : SELECT_PAD,
      right: this.variant === 'sourceGroup' ? 14 : SELECT_PAD,
    })
    .alignItems(VerticalAlign.Center)
    .onClick((): void => this.selectAndCollapse(opt));
  }

  // 最长文本(值 ∪ 选项)实测宽 + chrome, px→vp。
  private resolvedWidth(): number {
    if (this.controlWidth > 0) {
      return this.controlWidth;
    }
    const ctx = this.getUIContext();
    const utils = ctx.getMeasureUtils();
    let maxPx = 0;
    const texts: string[] = [this.renderedValue(), ...this.renderedOptions()];
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

  private panelBackgroundColor(): ResourceColor {
    if (this.variant === 'appearanceLibrary') return readerAppColor('app.appearance.selectSurface', this.appThemeScheme);
    if (this.variant === 'appearanceCompact') {
      return readerAppColor('app.ReaderSelectPanel.panelBackgroundColor.paint.D1FFF8EF', this.appThemeScheme);
    }
    if (this.variant === 'sourceGroup') {
      return readerAppColor('app.ReaderSelectPanel.panelBackgroundColor.paint.FFFFFCF8', this.appThemeScheme);
    }
    return readerAppColor('TOK_FIELD_SURFACE', this.appThemeScheme);
  }

  private panelBorderColor(): ResourceColor {
    if (this.variant === 'appearanceLibrary') return readerAppColor('app.appearance.selectBorder', this.appThemeScheme);
    if (this.variant === 'appearanceCompact') {
      return readerAppColor('app.ReaderSelectPanel.panelBorderColor.paint.FFC1C7CD', this.appThemeScheme);
    }
    if (this.variant === 'sourceGroup') {
      return readerAppColor('app.ReaderSelectPanel.panelBorderColor.paint.85B4A697', this.appThemeScheme);
    }
    return readerAppColor('TOK_BORDER', this.appThemeScheme);
  }

  private optionTextStyle() {
    return this.variant === 'sourceGroup' ? TYPE_SELECT_SOURCE_GROUP_VALUE : TYPE_SELECT_OPTION;
  }

  private measureTextStyle() {
    if (this.variant === 'settingsPhone' || this.variant === 'settingsTablet') {
      return TYPE_SELECT_SETTINGS_VALUE;
    }
    if (this.variant === 'appearanceCompact') {
      return TYPE_SELECT_APPEARANCE_VALUE;
    }
    if (this.variant === 'sourceGroup') {
      return TYPE_SELECT_SOURCE_GROUP_VALUE;
    }
    return TYPE_SELECT_DEFAULT_VALUE;
  }

  private expandPanel(): void {
    if (!this.mounted || this.closeInFlight) return;
    if (this.closing) { this.onClosingChanged(); return; }
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

  private onClosingChanged(): void {
    if (!this.closing) {
      return;
    }
    const identity = this.selectionId;
    const dismiss = this.onDismiss;
    this.collapsePanel((): void => dismiss(identity));
  }

  private selectAndCollapse(option: string): void {
    if (!this.mounted || this.closeInFlight) return;
    const identity = this.selectionId;
    const commit = this.onCommit;
    const selection = this.onSelect;
    const dismiss = this.onDismiss;
    if (commit === undefined) {
      this.collapsePanel((): void => selection(option));
    } else {
      this.collapsePanel((): void => dismiss(identity), (): void => commit(option, identity));
    }
  }

  private collapsePanel(onFinish: () => void, onCommit?: () => void): void {
    if (!this.mounted || this.closeInFlight) {
      return;
    }
    this.closingValue = this.value;
    this.closingOptions = this.options.slice();
    this.closeInFlight = true;
    const generation = ++this.generation;
    if (onCommit !== undefined) onCommit();
    if (!this.mounted || generation !== this.generation) return;
    if (this.reduceMotion) {
      this.expandedHeight = OPTION_H;
      this.chevronAngle = 0;
      onFinish();
      return;
    }
    this.getUIContext().animateTo(
      motionAnimateParam('dropdown.menu.collapse', (): void => {
        if (!this.mounted || generation !== this.generation) return;
        onFinish();
      }),
      (): void => {
        this.expandedHeight = OPTION_H;
        this.chevronAngle = 0;
      },
    );
  }

  private fullPanelHeight(): number {
    if (this.variant === 'appearanceLibrary') return appearanceSelectMenuHeight(this.options.length);
    let unselectedCount = 0;
    for (const option of this.options) {
      if (option !== this.value) {
        unselectedCount += 1;
      }
    }
    return OPTION_H * (1 + unselectedCount);
  }
}
