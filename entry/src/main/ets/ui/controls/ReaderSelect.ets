import type { MeasureOptions } from '@ohos.measure';
import { KeyCode } from '@kit.InputKit';
import { readerAppColor } from '../foundation/ReaderThemeRegistry';
import { registerReaderFonts } from '../foundation/ReaderFonts';
import { readerWindowMetrics } from '../foundation/ReaderWindowEnvironment';
import { readerInteractiveSafeLeft, readerInteractiveSafeRight } from '../foundation/ReaderWindowMetrics';
import { readerSelectAvailableWidth, readerSelectTriggerWidth,
  READER_SELECT_TRIGGER_CHROME, SOURCE_GROUP_SELECT_RADIUS } from '../foundation/ReaderSelectGeometry';
import {
  TOK_BORDER_W,
  TOK_SPACE_CONTROL_INLINE,
} from '../foundation/ReaderTokens';
import { ReaderPressFeedback } from '../foundation/ReaderPressFeedback';
import { readerMotionAnimateParam } from '../foundation/ReaderMotionPolicy';
import {
  TYPE_SELECT_DEFAULT_VALUE,
  TYPE_SELECT_LIBRARY_VALUE,
} from '../foundation/ReaderTypography';

// The trigger stays in the form row. Its popup is hosted separately so
// option targets remain within their own ArkUI hit-testing bounds.
const TRIGGER_H = 44;
const SELECT_PAD = TOK_SPACE_CONTROL_INLINE; // 10
const CHEVRON_GAP = 8;
const CHEVRON_W = 12;
const CHEVRON_H = 8;
const APPEARANCE_TRIGGER_H = 30;
const APPEARANCE_VALUE_VERTICAL_SPACE = 15; // Original 30vp frame around the 15fp value line.
const APPEARANCE_HIT_OUTSET = 6;

export type ReaderSelectVariant =
  | 'default'
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
  @Prop actionEnabled: boolean = true;
  // One variant selects a complete visual contract. This replaces the old
  // independent booleans, which could describe contradictory combinations.
  @Prop variant: ReaderSelectVariant = 'default';
  @Prop reduceMotion: boolean = false;
  // default: 当前按钮可用宽度上限；其他明确的字段变体保留其固定宽合同。
  @Prop controlWidth: number = 0;
  /** Measured caller cap for the default trigger. -1 keeps intrinsic sizing. */
  @Prop maxTriggerWidthVp: number = -1;
  /** Optional address of the source-group or appearance-library native action. */
  @Prop focusId: string = '';
  @Prop nativeAnchorId: string = '';
  onToggle: () => void = (): void => {};
  private mounted: boolean = false;
  private sourceGroupKeyDown: boolean = false;

  aboutToAppear(): void {
    this.mounted = true;
    registerReaderFonts(this.getUIContext().getFont());
  }

  aboutToDisappear(): void {
    this.mounted = false;
    this.sourceGroupKeyDown = false;
  }

  build() {
    // 收起/展开态同构；面板由宿主 overlay 覆盖，不参与字段行的测量。
    Stack({ alignContent: Alignment.TopStart }) {
      this.phoneTrigger();
    }
    .id(this.nativeAnchorId)
    .width(this.resolvedWidth())
    .height(this.triggerHeight());
  }

  @Builder
  private phoneTrigger() {
    Button({ type: ButtonType.Normal, stateEffect: false }) {
      this.trigger();
    }
    .width('100%')
    .height(this.triggerHeight())
    .padding(0)
    .attributeModifier(new ReaderPressFeedback(this.variant === 'sourceGroup' ?
      readerAppColor('app.sourceUi.field', this.appThemeScheme) : Color.Transparent, this.appThemeScheme,
      this.variant === 'sourceGroup' ? SOURCE_GROUP_SELECT_RADIUS : this.triggerHeight() / 2,
      SOURCE_GROUP_SELECT_RADIUS, this.variant === 'sourceGroup' && this.triggerEnabled()))
    .responseRegion({ x: 0, y: this.variant === 'appearanceLibrary' ? -APPEARANCE_HIT_OUTSET : this.variant === 'sourceGroup' ? -2 : 0,
      width: '100%', height: this.variant === 'appearanceLibrary' ?
        this.triggerHeight() + APPEARANCE_HIT_OUTSET * 2 : this.variant === 'sourceGroup' ? 44 : this.triggerHeight() })
    .id(this.focusId)
    .accessibilityText(this.variant === 'sourceGroup' ? `分组：${this.value}` : this.value)
    .accessibilityDescription(this.isOpen ? '已展开' : '已收起')
    .enabled(this.triggerEnabled())
    .onClick((): void => { if (this.mounted && this.triggerEnabled()) this.onToggle(); })
    .onKeyEventDispatch((event: KeyEvent): boolean => this.handleSourceGroupKey(event))
    .onKeyEvent((event: KeyEvent): boolean => this.handleSourceGroupKey(event));
  }

  private triggerEnabled(): boolean {
    return this.actionEnabled && (this.variant !== 'sourceGroup' || this.focusId.length === 0 || this.options.length > 1);
  }

  private handleSourceGroupKey(event: KeyEvent): boolean {
    if (this.variant !== 'sourceGroup') return false;
    const actionKey = event.keyCode === KeyCode.KEYCODE_ENTER ||
      event.keyCode === KeyCode.KEYCODE_SPACE ||
      event.keyCode === KeyCode.KEYCODE_DPAD_CENTER;
    if (!actionKey) return false;
    event.stopPropagation();
    if (event.type === KeyType.Down) {
      if (this.sourceGroupKeyDown) return true;
      this.sourceGroupKeyDown = true;
      if (this.mounted && this.triggerEnabled()) this.onToggle();
      return true;
    }
    if (event.type === KeyType.Up) {
      this.sourceGroupKeyDown = false;
      return true;
    }
    return false;
  }

  @Builder
  private trigger() {
    if (this.variant === 'appearanceLibrary') {
      this.appearanceLibraryTrigger();
    } else {
      this.standardTrigger();
    }
  }

  @Builder
  private appearanceLibraryTrigger() {
    Row({ space: 6 }) {
      Text(this.value).layoutWeight(1).fontFamily(TYPE_SELECT_LIBRARY_VALUE.fontFamily)
        .fontSize(TYPE_SELECT_LIBRARY_VALUE.fontSizeFp).lineHeight(TYPE_SELECT_LIBRARY_VALUE.lineHeightFp as number).halfLeading(true)
        .fontWeight(TYPE_SELECT_LIBRARY_VALUE.fontWeight).fontColor(readerAppColor('TOK_READ_INK', this.appThemeScheme)).maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis });
      Image((this.appThemeScheme === 'night' ? $r('app.media.reader_appearance_make_chevron_theme_night') : $r('app.media.reader_appearance_make_chevron'))).width(12).height(12)
        .rotate({ angle: this.isOpen && !this.reduceMotion ? 90 : 0 }).animation(this.dropdownAnimation());
    }.width('100%').height(this.triggerHeight()).padding({ left: 11, right: 9 })
      .borderRadius(Math.min(this.resolvedWidth(), this.triggerHeight()) / 2)
      .backgroundColor(this.isOpen ? readerAppColor('app.appearance.selectOpenFill', this.appThemeScheme) : readerAppColor('app.appearance.selectFill', this.appThemeScheme));
  }

  @Builder
  private standardTrigger() {
    Row({ space: CHEVRON_GAP }) {
      Text(this.value).layoutWeight(1)
        .fontFamily(TYPE_SELECT_DEFAULT_VALUE.fontFamily).fontWeight(TYPE_SELECT_DEFAULT_VALUE.fontWeight)
        .fontSize(TYPE_SELECT_DEFAULT_VALUE.fontSizeFp)
        .lineHeight(TYPE_SELECT_DEFAULT_VALUE.lineHeightFp as number).halfLeading(true)
        .maxFontScale(this.variant === 'sourceGroup' ? (this.triggerHeight() - 2 * TOK_BORDER_W) /
          (TYPE_SELECT_DEFAULT_VALUE.lineHeightFp as number) : undefined)
        .fontColor(readerAppColor('TOK_INK', this.appThemeScheme)).textAlign(TextAlign.Start)
        .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis });
      Image(this.appThemeScheme === 'night' ? $r('app.media.reader_chevron_down_theme_night') : $r('app.media.reader_chevron_down'))
        .width(CHEVRON_W).height(CHEVRON_H).flexShrink(0)
        .rotate({ angle: this.isOpen && !this.reduceMotion ? 180 : 0 })
        .animation(this.dropdownAnimation()).accessibilityLevel('no');
    }
    .id(this.variant === 'sourceGroup' && this.focusId.length > 0 ? `${this.focusId}:frame` : '')
    .width('100%').height(this.triggerHeight())
    .padding({ left: SELECT_PAD, right: SELECT_PAD })
    .backgroundColor(this.variant === 'sourceGroup' ? Color.Transparent : readerAppColor('TOK_SURFACE_FIELD', this.appThemeScheme))
    .border({ width: TOK_BORDER_W, color: readerAppColor('TOK_LINE_STRONG', this.appThemeScheme) })
    .borderRadius(this.variant === 'sourceGroup' ? SOURCE_GROUP_SELECT_RADIUS : this.triggerHeight() / 2)
    .alignItems(VerticalAlign.Center);
  }

  // Native fp measurement already includes system text scaling. Do not
  // multiply it by systemFontScale a second time.
  private resolvedWidth(): number {
    this.readerWindowMetricsRevision;
    if (this.variant === 'default') {
      const context = this.getUIContext();
      const style = TYPE_SELECT_DEFAULT_VALUE;
      const width = context.px2vp(context.getMeasureUtils().measureText({ textContent: this.value,
        fontSize: style.fontSizeFp, fontFamily: style.fontFamily, fontWeight: style.fontWeight }));
      const metrics = readerWindowMetrics();
      const windowAvailable = readerSelectAvailableWidth(this.readerWindowMetricsRevision < 0 ? 0 : metrics.windowRect.width,
        readerInteractiveSafeLeft(metrics), readerInteractiveSafeRight(metrics));
      const available = this.maxTriggerWidthVp >= 0 ? Math.min(windowAvailable, this.maxTriggerWidthVp) : windowAvailable;
      return Math.min(available, Math.max(44, readerSelectTriggerWidth(width, available, this.controlWidth)));
    }
    if (this.controlWidth > 0) {
      return this.controlWidth;
    }
    const context = this.getUIContext();
    const style = this.variant === 'appearanceLibrary' ? TYPE_SELECT_LIBRARY_VALUE : TYPE_SELECT_DEFAULT_VALUE;
    const width = context.px2vp(context.getMeasureUtils().measureText({ textContent: this.value,
      fontSize: style.fontSizeFp, fontFamily: style.fontFamily, fontWeight: style.fontWeight }));
    const chrome = this.variant === 'appearanceLibrary' ? 38 : READER_SELECT_TRIGGER_CHROME;
    return Math.max(44, Math.ceil(width) + chrome);
  }

  private triggerHeight(): number {
    if (this.variant === 'appearanceLibrary') return this.appearanceLibraryTriggerHeight(this.readerWindowMetricsRevision);
    if (this.variant === 'sourceGroup') return 40;
    const style = TYPE_SELECT_DEFAULT_VALUE;
    return Math.max(TRIGGER_H, this.measuredValueHeight(style.fontSizeFp, style.fontFamily, style.fontWeight,
      style.lineHeightFp) + 16);
  }

  // Reading the existing metrics revision makes native font changes remeasure
  // this finite variant; fp measurement already includes system font scaling.
  private appearanceLibraryTriggerHeight(_metricsRevision: number): number {
    const style = TYPE_SELECT_LIBRARY_VALUE;
    return Math.max(APPEARANCE_TRIGGER_H, this.measuredValueHeight(style.fontSizeFp,
      style.fontFamily, style.fontWeight, style.lineHeightFp) + APPEARANCE_VALUE_VERTICAL_SPACE);
  }

  private measuredValueHeight(fontSize: number, fontFamily: string, fontWeight: number, lineHeight: number | undefined): number {
    this.readerWindowMetricsRevision;
    const options: MeasureOptions = { textContent: this.value || '字', fontSize, fontFamily, fontWeight };
    if (lineHeight !== undefined) options.lineHeight = `${lineHeight}fp`;
    const context = this.getUIContext();
    const height = context.px2vp(Number(context.getMeasureUtils().measureTextSize(options).height));
    return Number.isFinite(height) ? Math.ceil(height) : 15;
  }

  private dropdownAnimation(): AnimateParam {
    return readerMotionAnimateParam(this.isOpen ? 'dropdown.menu.expand' : 'dropdown.menu.collapse',
      this.reduceMotion);
  }
}
