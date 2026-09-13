import { readerAppColor } from './ReaderThemeRegistry';
import { registerReaderFonts } from './ReaderFonts';
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
import { motionAnimateParam } from './MotionSpec';
import { APPEARANCE_SELECT_FILL, APPEARANCE_SELECT_OPEN_FILL } from './ReaderSelectAppearanceStyle';
import {
  TYPE_SELECT_APPEARANCE_VALUE,
  TYPE_SELECT_DEFAULT_VALUE,
  TYPE_SELECT_SETTINGS_VALUE,
  TYPE_SELECT_SOURCE_GROUP_VALUE,
} from './ReaderTypography';

// 统一下拉触发条 — 对齐最终下拉模板 (1506:8807/9291): panel-soft 高亮底 +
// 边框 + r6 + 容器 padding 10 + 文字-chevron gap 8, 值左对齐 Noto Sans SC Bold 12。
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

  @Prop value: string = '';
  @Prop options: string[] = [];
  @Prop isOpen: boolean = false;
  // One variant selects a complete visual contract. This replaces the old
  // independent booleans, which could describe contradictory combinations.
  @Prop variant: ReaderSelectVariant = 'default';
  @Prop reduceMotion: boolean = false;
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
      Text(this.value).layoutWeight(1).fontFamily('ReaderNotoSansSCUIRegular').fontSize(11).lineHeight(15)
        .fontWeight(FontWeight.Regular).fontColor(readerAppColor('app.ReaderSelect.appearanceLibraryTrigger.fontColor.FF332C25', this.appThemeScheme)).maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis });
      Image((this.appThemeScheme === 'night' ? $r('app.media.reader_appearance_make_chevron_theme_night') : $r('app.media.reader_appearance_make_chevron'))).width(12).height(12)
        .rotate({ angle: this.isOpen ? 90 : 0 }).animation(this.dropdownAnimation());
    }.width('100%').height(30).padding({ left: 11, right: 9 }).borderRadius(999)
      .backgroundColor(this.isOpen ? APPEARANCE_SELECT_OPEN_FILL : APPEARANCE_SELECT_FILL)
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
    .height(34)
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
        .rotate({ angle: this.isOpen ? 180 : 0 })
        .animation(this.dropdownAnimation())
        .position({ x: this.resolvedWidth() - 21, y: 12 });
    }
    .width('100%')
    .height(TRIGGER_H)
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
    .height(TRIGGER_H)
    .padding({ left: SELECT_PAD, right: SELECT_PAD })
    .backgroundColor(readerAppColor('TOK_SURFACE_PANEL_SOFT', this.appThemeScheme))
    .border({ width: TOK_BORDER_W, color: readerAppColor('TOK_BORDER', this.appThemeScheme) })
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
    if (this.variant === 'appearanceLibrary') {
      return Math.ceil(ctx.px2vp(utils.measureText({ textContent: this.value,
        fontSize: 11, fontFamily: 'ReaderNotoSansSCUIRegular' }))) + 38;
    }
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

  private triggerHeight(): number {
    if (this.variant === 'appearanceLibrary') return 30;
    return this.isSettingsVariant() ? 34 : TRIGGER_H;
  }

  private resolvedChrome(): number {
    if (this.isSettingsVariant()) {
      return 10 + 8 + 6 + (this.variant === 'settingsTablet' ? 10 : 7);
    }
    return SELECT_CHROME;
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
    if (this.reduceMotion) {
      return { duration: 0, curve: Curve.Linear };
    }
    return motionAnimateParam(this.isOpen ? 'dropdown.menu.expand' : 'dropdown.menu.collapse');
  }
}
