import type { MeasureOptions } from '@ohos.measure';
import { TYPE_SELECT_LIBRARY_VALUE } from './ReaderTypography';
import { readerAppColor } from './ReaderThemeRegistry';
import { registerReaderFonts } from './ReaderFonts';
import { ReaderWindowCoordinator } from '../../app/ReaderWindowCoordinator';
import { readerInteractiveSafeLeft, readerInteractiveSafeRight } from './ReaderWindowMetrics';
import { readerSelectAvailableWidth, readerSelectTriggerWidth } from './ReaderSelectGeometry';
import {
  TOK_BORDER,
  TOK_BORDER_W,
  TOK_GREEN,
  TOK_INK,
  TOK_PRIMARY_DARK,
  TOK_SPACE_CONTROL_INLINE,
  TOK_SURFACE_FIELD,
  TOK_SURFACE_PANEL_SOFT,
} from '../common/ReaderTokens';
import { readerMotionAnimateParam } from './ReaderMotionPolicy';
import {
  TYPE_SELECT_APPEARANCE_VALUE,
  TYPE_SELECT_DEFAULT_VALUE,
  TYPE_SELECT_SETTINGS_VALUE,
  TYPE_SELECT_SOURCE_GROUP_VALUE,
} from './ReaderTypography';

// 统一下拉触发条 — 对齐最终下拉模板 (1506:8807/9291): panel-soft 高亮底 +
// 边框 + r6 + 容器 padding 10 + 文字-chevron gap 8, 值左对齐 Noto Sans SC Bold 12。
// 展开面板已拆至 ReaderSelectPanel: 默认触发条最小 36 高，随真实字高增长。展开面板由宿主
// 页在全高 overlay Stack 内按触发条全局坐标定位渲染 (ReaderSelectPanel)。
// 原因: ArkUI 把溢出父容器边界的子组件命中测试裁到父边界 — 固定高行(58/50/36)内的
// 下拉面板下层选项渲染可见但不可点, 所以面板必须挂在全高容器, 不能留在行内。
// 默认紧凑按钮只测当前值；菜单独立测量全部选项，不借最长选项撑大闭合按钮。
const TRIGGER_H = 36;
const SELECT_PAD = TOK_SPACE_CONTROL_INLINE; // 10
const CHEVRON_GAP = 8;
const CHEVRON_W = 12;
const CHEVRON_H = 8;
const SELECT_CHROME = SELECT_PAD * 2 + CHEVRON_GAP + CHEVRON_W; // 40

export type ReaderSelectVariant =
  | 'default'
  | 'appearanceCompact'
  | 'appearanceLibrary'
  | 'settingsPhone'
  | 'settingsTablet'
  | 'sourceGroup';

@Component
export struct ReaderSelect {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  @StorageLink('readerWindowMetricsRevision') private readerWindowMetricsRevision: number = 0;

  @Prop value: string = '';
  @Prop options: string[] = [];
  @Prop isOpen: boolean = false;
  // One variant selects a complete visual contract. This replaces the old
  // independent booleans, which could describe contradictory combinations.
  @Prop variant: ReaderSelectVariant = 'default';
  @Prop reduceMotion: boolean = false;
  // default: 当前按钮可用宽度上限；其他明确的字段变体保留其固定宽合同。
  @Prop controlWidth: number = 0;
  onToggle: () => void = (): void => {};

  aboutToAppear(): void {
    registerReaderFonts(this.getUIContext().getFont());
  }

  build() {
    // 收起/展开态同构；面板由宿主 overlay 覆盖，不参与字段行的测量。
    Stack({ alignContent: Alignment.TopStart }) {
      this.trigger();
    }
    .width(this.resolvedWidth())
    .height(this.triggerHeight());
  }

  @Builder
  private trigger() {
    if (this.variant === 'appearanceLibrary') {
      this.appearanceLibraryTrigger();
    } else if (this.variant === 'appearanceCompact') {
      this.appearanceTrigger();
    } else if (this.variant === 'settingsPhone' || this.variant === 'settingsTablet') {
      this.settingsTrigger();
    } else if (this.variant === 'sourceGroup') {
      this.sourceGroupTrigger();
    } else {
      this.defaultTrigger();
    }
  }

  @Builder
  private appearanceLibraryTrigger() {
    Row({ space: 6 }) {
      Text(this.value).layoutWeight(1).fontFamily(TYPE_SELECT_LIBRARY_VALUE.fontFamily).fontSize(TYPE_SELECT_LIBRARY_VALUE.fontSizeFp).lineHeight(TYPE_SELECT_LIBRARY_VALUE.lineHeightFp as number)
        .fontWeight(TYPE_SELECT_LIBRARY_VALUE.fontWeight).fontColor(readerAppColor('app.ReaderSelect.appearanceLibraryTrigger.fontColor.FF332C25', this.appThemeScheme)).maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis });
      Image((this.appThemeScheme === 'night' ? $r('app.media.reader_appearance_make_chevron_theme_night') : $r('app.media.reader_appearance_make_chevron'))).width(12).height(12)
        .rotate({ angle: this.isOpen ? 90 : 0 }).animation(this.dropdownAnimation());
    }.width('100%').height(30).padding({ left: 11, right: 9 }).borderRadius(999)
      .backgroundColor(this.isOpen ? readerAppColor('app.appearance.selectOpenFill', this.appThemeScheme) : readerAppColor('app.appearance.selectFill', this.appThemeScheme))
      .responseRegion({ x: 0, y: -6, width: '100%', height: 42 })
      .onClick((): void => this.onToggle());
  }

  @Builder
  private appearanceTrigger() {
    Stack({ alignContent: Alignment.TopStart }) {
      Text(this.value)
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
        .rotate({ angle: this.isOpen ? 180 : 0 })
        .animation(this.dropdownAnimation())
        .position({ x: this.resolvedWidth() - 14, y: 16 });
    }
    .width('100%')
    .height(TRIGGER_H)
    .backgroundColor(readerAppColor('TOK_SURFACE_FIELD', this.appThemeScheme))
    .border({ width: TOK_BORDER_W, color: readerAppColor('app.ReaderSelect.appearanceTrigger.color.FFC1C7CD', this.appThemeScheme) })
    .borderRadius(6)
    .responseRegion({ x: 0, y: -4, width: '100%', height: 44 })
    .onClick((): void => this.onToggle());
  }

  @Builder
  private settingsTrigger() {
    Row({ space: 6 }) {
      Text(this.value)
        .fontFamily(TYPE_SELECT_SETTINGS_VALUE.fontFamily)
        .fontWeight(TYPE_SELECT_SETTINGS_VALUE.fontWeight)
        .fontSize(TYPE_SELECT_SETTINGS_VALUE.fontSizeFp)
        .lineHeight(TYPE_SELECT_SETTINGS_VALUE.lineHeightFp as number)
        .fontColor(readerAppColor('TOK_INK', this.appThemeScheme))
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis });
      if (this.variant === 'settingsTablet') {
        Image((this.appThemeScheme === 'night' ? $r('app.media.reader_chevron_down_theme_night') : $r('app.media.reader_chevron_down')))
          .width(10)
          .height(6)
          .rotate({ angle: this.isOpen ? 180 : 0 })
          .animation(this.dropdownAnimation());
      } else {
        Image((this.appThemeScheme === 'night' ? $r('app.media.reader_chevron_right_theme_night') : $r('app.media.reader_chevron_right')))
          .width(7)
          .height(12);
      }
    }
    .height(this.triggerHeight())
    .padding({ left: 10, right: 8 })
    .alignItems(VerticalAlign.Center)
    .backgroundColor(readerAppColor('app.ReaderSelect.settingsTrigger.backgroundColor.0F2D4A3E', this.appThemeScheme))
    .border({ width: TOK_BORDER_W, color: readerAppColor('TOK_GREEN', this.appThemeScheme) })
    .borderRadius(7)
    .onClick((): void => this.onToggle());
  }

  @Builder
  private sourceGroupTrigger() {
    Stack({ alignContent: Alignment.TopStart }) {
      Text(this.value)
        .width(Math.max(0, this.resolvedWidth() - 42))
        .height(this.measuredValueHeight(TYPE_SELECT_SOURCE_GROUP_VALUE.fontSizeFp,
          TYPE_SELECT_SOURCE_GROUP_VALUE.fontFamily, TYPE_SELECT_SOURCE_GROUP_VALUE.fontWeight,
          TYPE_SELECT_SOURCE_GROUP_VALUE.lineHeightFp))
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
        .rotate({ angle: this.isOpen ? 180 : 0 })
        .animation(this.dropdownAnimation())
        .position({ x: this.resolvedWidth() - 21, y: (this.triggerHeight() - 12) / 2 });
    }
    .width('100%')
    .height(this.triggerHeight())
    .backgroundColor(readerAppColor('app.ReaderSelect.sourceGroupTrigger.backgroundColor.FFFFFCF8', this.appThemeScheme))
    .border({ width: TOK_BORDER_W, color: readerAppColor('app.ReaderSelect.sourceGroupTrigger.color.85B4A697', this.appThemeScheme) })
    .borderRadius(8)
    .onClick((): void => this.onToggle());
  }

  @Builder
  private defaultTrigger() {
    Row({ space: CHEVRON_GAP }) {
      Text(this.value)
        .layoutWeight(1)
        .fontFamily(TYPE_SELECT_DEFAULT_VALUE.fontFamily)
        .fontWeight(TYPE_SELECT_DEFAULT_VALUE.fontWeight)
        .fontSize(TYPE_SELECT_DEFAULT_VALUE.fontSizeFp)
        .fontColor(readerAppColor('TOK_PRIMARY_TEXT', this.appThemeScheme))
        .textAlign(TextAlign.Start)
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis });
      Image((this.appThemeScheme === 'night' ? $r('app.media.reader_chevron_down_theme_night') : $r('app.media.reader_chevron_down'))).width(CHEVRON_W).height(CHEVRON_H)
        .rotate({ angle: this.isOpen ? 180 : 0 })
        .animation(this.dropdownAnimation());
    }
    .width('100%')
    .height(this.triggerHeight())
    .padding({ left: SELECT_PAD, right: SELECT_PAD })
    .backgroundColor(readerAppColor('app.select.triggerSurface', this.appThemeScheme))
    .border({ width: TOK_BORDER_W, color: readerAppColor('TOK_BORDER', this.appThemeScheme) })
    .borderRadius(6)
    .alignItems(VerticalAlign.Center)
    .onClick((): void => this.onToggle());
  }

  // Native fp measurement already includes system text scaling. Do not
  // multiply it by systemFontScale a second time.
  private resolvedWidth(): number {
    if (this.variant === 'default') {
      const context = this.getUIContext();
      const style = TYPE_SELECT_DEFAULT_VALUE;
      const width = context.px2vp(context.getMeasureUtils().measureText({ textContent: this.value,
        fontSize: style.fontSizeFp, fontFamily: style.fontFamily, fontWeight: style.fontWeight }));
      const metrics = ReaderWindowCoordinator.metrics();
      return readerSelectTriggerWidth(width, readerSelectAvailableWidth(
        this.readerWindowMetricsRevision < 0 ? 0 : metrics.windowRect.width,
        readerInteractiveSafeLeft(metrics), readerInteractiveSafeRight(metrics)), this.controlWidth);
    }
    if (this.controlWidth > 0) {
      return this.controlWidth;
    }
    const ctx = this.getUIContext();
    const utils = ctx.getMeasureUtils();
    if (this.variant === 'appearanceLibrary') {
      return Math.ceil(ctx.px2vp(utils.measureText({ textContent: this.value,
        fontSize: 11, fontFamily: 'ReaderNotoSansSCUIRegular' }))) + 38;
    }
    let maxPx = 0;
    const texts: string[] = [this.value];
    for (let i = 0; i < texts.length; i++) {
      const w = utils.measureText({
        textContent: texts[i],
        fontSize: this.measureTextStyle().fontSizeFp,
        fontFamily: this.measureTextStyle().fontFamily,
        fontWeight: this.measureTextStyle().fontWeight,
      });
      if (w > maxPx) {
        maxPx = w;
      }
    }
    return Math.ceil(ctx.px2vp(maxPx)) + this.resolvedChrome();
  }

  private triggerHeight(): number {
    if (this.variant === 'default') {
      const style = TYPE_SELECT_DEFAULT_VALUE;
      return Math.max(TRIGGER_H, this.measuredValueHeight(style.fontSizeFp, style.fontFamily, style.fontWeight, style.lineHeightFp) + 16);
    }
    if (this.variant === 'appearanceLibrary') return 30;
    if (this.variant === 'sourceGroup') return Math.max(TRIGGER_H,
      this.measuredValueHeight(TYPE_SELECT_SOURCE_GROUP_VALUE.fontSizeFp, TYPE_SELECT_SOURCE_GROUP_VALUE.fontFamily,
        TYPE_SELECT_SOURCE_GROUP_VALUE.fontWeight, TYPE_SELECT_SOURCE_GROUP_VALUE.lineHeightFp) + 20);
    if (this.isSettingsVariant()) return Math.max(34,
      this.measuredValueHeight(TYPE_SELECT_SETTINGS_VALUE.fontSizeFp, TYPE_SELECT_SETTINGS_VALUE.fontFamily,
        TYPE_SELECT_SETTINGS_VALUE.fontWeight, TYPE_SELECT_SETTINGS_VALUE.lineHeightFp) + 18);
    return TRIGGER_H;
  }

  private measuredValueHeight(fontSize: number, fontFamily: string, fontWeight: number, lineHeight: number | undefined): number {
    const options: MeasureOptions = { textContent: this.value || '字', fontSize, fontFamily, fontWeight };
    if (lineHeight !== undefined) options.lineHeight = `${lineHeight}fp`;
    const context = this.getUIContext();
    const height = context.px2vp(Number(context.getMeasureUtils().measureTextSize(options).height));
    return Number.isFinite(height) ? Math.ceil(height) : 15;
  }

  private resolvedChrome(): number {
    if (this.isSettingsVariant()) {
      return 10 + 8 + 6 + (this.variant === 'settingsTablet' ? 10 : 7) + TOK_BORDER_W * 2;
    }
    if (this.variant === 'appearanceCompact') return 28;
    if (this.variant === 'sourceGroup') return 42;
    return SELECT_CHROME + TOK_BORDER_W * 2;
  }

  private isSettingsVariant(): boolean {
    return this.variant === 'settingsPhone' || this.variant === 'settingsTablet';
  }

  private measureTextStyle() {
    if (this.isSettingsVariant()) {
      return TYPE_SELECT_SETTINGS_VALUE;
    }
    if (this.variant === 'sourceGroup') {
      return TYPE_SELECT_SOURCE_GROUP_VALUE;
    }
    if (this.variant === 'appearanceCompact') {
      return TYPE_SELECT_APPEARANCE_VALUE;
    }
    return TYPE_SELECT_DEFAULT_VALUE;
  }

  private dropdownAnimation(): AnimateParam {
    return readerMotionAnimateParam(this.isOpen ? 'dropdown.menu.expand' : 'dropdown.menu.collapse',
      this.reduceMotion);
  }
}
