import { ReaderPressFeedback } from '../foundation/ReaderPressFeedback';
import { readerSurfaceElevation } from '../surfaces/ReaderSurfaceSpecs';
import { FrameCallback } from '@kit.ArkUI';
import type { AnimatorResult } from '@ohos.animator';
import { readerAppColor } from '../foundation/ReaderThemeRegistry';
import { ReaderChoiceRow } from './ReaderChoiceRow';
import { registerReaderFonts } from '../foundation/ReaderFonts';
import { readerWindowMetrics } from '../foundation/ReaderWindowEnvironment';
import { readerInteractiveSafeLeft, readerInteractiveSafeRight } from '../foundation/ReaderWindowMetrics';
import { ReaderSelectMenuKind, readerSelectAvailableWidth, readerSelectMenuWidth,
  SOURCE_GROUP_SELECT_ARROW_TARGET, SOURCE_GROUP_SELECT_PAINT_INSET,
  SOURCE_GROUP_SELECT_RADIUS } from '../foundation/ReaderSelectGeometry';
import {
  TOK_BORDER_W,
  TOK_SPACE_CONTROL_INLINE,
} from '../foundation/ReaderTokens';
import { motionAnimateParam, motionSpecGet } from '../foundation/MotionSpec';
import { readerMotionReducedFadeParam } from '../foundation/ReaderMotionPolicy';
import {
  APPEARANCE_SELECT_OPTION_HEIGHT, appearanceSelectMenuHeight,
} from './ReaderSelectAppearanceStyle';
import type { ReaderSelectVariant } from './ReaderSelect';
import {
  TYPE_SELECT_DEFAULT_VALUE,
  TYPE_SELECT_SETTINGS_VALUE,
  TYPE_SELECT_SOURCE_GROUP_VALUE,
} from '../foundation/ReaderTypography';

// 展开下拉面板 — 宿主页在全高 overlay Stack 内定位渲染, position 相对宿主 Stack。
// 全部选项行都落在宿主 Stack bounds 内 → 可点 (ArkUI 命中测试裁到父边界, 行内面板
// 下层选项不可点; 拆到全高容器即解决)。
// 面板 = 已选行置顶 (panel-soft 高亮 + Bold + chevron 上旋) + 其余选项 (透明 +
// Regular #41484C), 选项左对齐 px10, 对齐 motion 1506:8807。
// 默认菜单独立测量选项；书源分组在触发条宽度内折行。
const OPTION_H = 36;
const SELECT_PAD = TOK_SPACE_CONTROL_INLINE; // 10
const CHEVRON_GAP = 8;
const CHEVRON_W = 12;
const CHEVRON_H = 8;
const SELECT_CHROME = SELECT_PAD * 2 + CHEVRON_GAP + CHEVRON_W; // 40

class ReaderSelectParentFrame extends FrameCallback {
  private readonly callback: () => void;
  constructor(callback: () => void) { super(); this.callback = callback; }
  onFrame(): void { this.callback(); }
}

@Component
export struct ReaderSelectPanel {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  @StorageLink('readerWindowMetricsRevision') @Watch('onGeometryChanged') private readerWindowMetricsRevision: number = 0;

  @Prop @Watch('onGeometryChanged') value: string = '';
  @Prop @Watch('onGeometryChanged') options: string[] = [];
  @Prop @Watch('onGeometryChanged') selectedIndex: number = -1;
  @Prop hosting: 'overlay' | 'popup' = 'overlay';
  @Prop @Watch('onGeometryChanged') x: number = 0;
  @Prop y: number = 0;
  @Prop @Watch('onGeometryChanged') variant: ReaderSelectVariant = 'default';
  @Prop @Watch('onReduceMotionChanged') reduceMotion: boolean = false;
  @Prop @Watch('onClosingChanged') closing: boolean = false;
  @Prop @Watch('onIdentityChanged') selectionId: string = '';
  // 书源分组使用实测触发条宽。default 菜单独立测量选项。
  @Prop @Watch('onGeometryChanged') controlWidth: number = 0;
  @Prop @Watch('onGeometryChanged') menuHeaderHeight: number = 0;
  @Prop emptyOptionsText: string = '';
  @BuilderParam menuHeader: () => void = this.emptyMenuHeader;
  @Prop @Watch('onGeometryChanged') menuFooterHeight: number = 0;
  @BuilderParam menuFooter: () => void = this.emptyMenuHeader;
  onMenuHeaderCollapse: ((identity: string) => void) | undefined = undefined;
  /** Optional current appearance host budget. Zero keeps the original menu contract. */
  @Prop @Watch('onGeometryChanged') maxPanelHeight: number = 0;
  /** Overlay coordinates, or a popup's local height budget from its window owner. */
  @Prop @Watch('onGeometryChanged') hostTopVp: number = 0;
  @Prop @Watch('onGeometryChanged') hostLeftVp: number = 0;
  @Prop @Watch('onGeometryChanged') hostRightVp: number = -1;
  @Prop @Watch('onGeometryChanged') hostBottomVp: number = -1;
  @Prop @Watch('onGeometryChanged') menuKind: ReaderSelectMenuKind = 'standard';
  // true = x 为面板右缘 (宿主触发条整行右对齐场景, 如 RSS 筛选)。
  @Prop alignRight: boolean = false;
  /** Optional addresses for the selected row and its wrapping alternatives. */
  @Prop focusIdPrefix: string = '';
  @Prop nativeAnchorId: string = '';
  // Production callers commit the immutable choice now; finish only unmounts.
  onCommit: ((option: string, identity: string, index?: number) => void) | undefined = undefined;
  inputCurrent: (() => boolean) | undefined = undefined;
  optionTextLayoutOptions: ((option: string, identity: string) => TextOptions | undefined) | undefined = undefined;
  onOptionsScrollStop: ((identity: string) => void) | undefined = undefined;
  onDismiss: (identity: string) => void = (_identity: string): void => {};
  @State private expandedHeight: number = OPTION_H;
  @State private panelOpacity: number = 1;
  @State private chevronAngle: number = 0;
  @State private closeInFlight: boolean = false;
  @State private measuredHeightRevision: number = 0;
  private optionHeights: Map<string, number> = new Map<string, number>();
  private optionLayoutInputs: string = '';
  private optionLayoutIdentity: string = '';
  private optionHeightsLayoutIdentity: string = '';
  private mounted: boolean = false;
  private generation: number = 0;
  private reducedEnterGeneration: number = -1;
  private closingValue: string = '';
  private closingOptions: string[] = [];
  private closingSelectedIndex: number = -1;
  private closeFinish: (() => void) | undefined = undefined;
  private appearanceHeightAnimator: AnimatorResult | undefined = undefined;
  private appearanceHeightTarget: number = 0;

  private renderedValue(): string { return this.closeInFlight ? this.closingValue : this.value; }
  private renderedOptions(): string[] { return this.closeInFlight ? this.closingOptions : this.options; }
  private renderedSelectedIndex(): number {
    if (this.closeInFlight) return this.closingSelectedIndex;
    return this.options[this.selectedIndex] === this.value ? this.selectedIndex : this.options.indexOf(this.value);
  }
  private showsSelectedRow(): boolean {
    return this.menuHeaderHeight === 0 || this.renderedOptions().includes(this.renderedValue());
  }

  private collapsedHeight(): number { return this.menuHeaderHeight > 0 ? this.menuHeaderHeight : OPTION_H; }

  aboutToAppear(): void {
    this.mounted = true;
    this.generation += 1;
    this.closeFinish = undefined;
    this.panelOpacity = this.reduceMotion ? 0 : 1;
    registerReaderFonts(this.getUIContext().getFont());
  }

  aboutToDisappear(): void {
    this.mounted = false;
    this.generation += 1;
    this.closeFinish = undefined;
    if (this.appearanceHeightAnimator !== undefined) this.cancelAppearanceHeightAnimation();
  }

  private onIdentityChanged(): void {
    this.generation += 1;
    if (this.appearanceHeightAnimator !== undefined) this.cancelAppearanceHeightAnimation();
    this.closeInFlight = false;
    this.closeFinish = undefined;
    this.panelOpacity = this.reduceMotion ? 0 : 1;
    if (this.mounted) this.expandPanel();
  }

  private onReduceMotionChanged(): void {
    if (!this.mounted) return;
    if (!this.reduceMotion) {
      if (!this.closeInFlight) this.panelOpacity = 1;
      return;
    }
    const generation = ++this.generation;
    if (this.appearanceHeightAnimator !== undefined) this.cancelAppearanceHeightAnimation();
    if (this.closeInFlight) this.fadePanelOut(generation, true);
    else this.expandPanel();
  }

  private fadePanelIn(): void {
    const generation = this.generation;
    if (this.panelOpacity === 1 || this.reducedEnterGeneration === generation) return;
    this.reducedEnterGeneration = generation;
    try {
      const context = this.getUIContext();
      context.postFrameCallback(new ReaderSelectParentFrame((): void => {
        if (!this.mounted || this.closeInFlight || !this.reduceMotion || generation !== this.generation) return;
        try {
          context.animateTo(readerMotionReducedFadeParam(), (): void => { this.panelOpacity = 1; });
        } catch (_) { this.panelOpacity = 1; }
      }));
    } catch (_) { this.panelOpacity = 1; }
  }

  private fadePanelOut(generation: number, deferParent: boolean): void {
    const finish = (): void => this.finishCollapse(generation, deferParent);
    try {
      this.getUIContext().animateTo(readerMotionReducedFadeParam(finish), (): void => { this.panelOpacity = 0; });
    } catch (_) { void Promise.resolve().then(finish); }
  }

  private finishCollapse(generation: number, deferParent: boolean = false): void {
    if (!this.mounted || generation !== this.generation || !this.closeInFlight) return;
    if (deferParent) {
      this.getUIContext().postFrameCallback(new ReaderSelectParentFrame((): void => this.finishCollapse(generation)));
      return;
    }
    const finish = this.closeFinish;
    this.closeFinish = undefined;
    finish?.();
  }

  private wrapsOptions(): boolean {
    return this.variant === 'default' || this.variant === 'sourceGroup' || this.variant === 'appearanceLibrary';
  }

  private onGeometryChanged(): void {
    if (this.variant !== 'appearanceLibrary' && this.appearanceHeightAnimator !== undefined) {
      this.cancelAppearanceHeightAnimation();
    }
    if (this.mounted && !this.closeInFlight && this.wrapsOptions()) {
      this.invalidateOptionHeights();
      this.expandPanel();
    }
  }

  private recordOptionHeight(option: string, selected: boolean, height: number): void {
    if (!this.mounted || this.closeInFlight || !Number.isFinite(height) || height <= 0) return;
    this.invalidateOptionHeights();
    const key = `${this.variant}:${selected}:${option}`;
    const measuredGroup = this.variant === 'sourceGroup' && this.controlWidth > 0;
    const nextHeight = measuredGroup ? Math.max(44, height) : height;
    if (Math.abs((this.optionHeights.get(key) ?? 0) - nextHeight) < .1) return;
    const previousPanelHeight = measuredGroup ? this.fullPanelHeight() : -1;
    this.optionHeights.set(key, nextHeight);
    if (measuredGroup && previousPanelHeight === this.fullPanelHeight()) return;
    this.measuredHeightRevision += 1;
    this.expandPanel();
  }

  private optionHeightHandler(option: string, selected: boolean): (height: number) => void {
    // Even a future host expansion cannot make these menus need row receipts.
    if (this.fillsMeasuredSourceGroupHeight(330)) return this.ignoreOptionHeight;
    const generation = this.generation;
    const identity = this.optionMeasurementIdentity();
    return (height: number): void => {
      if (this.fillsMeasuredSourceGroupHeight(330)) return;
      if (generation === this.generation && identity === this.optionMeasurementIdentity())
        this.recordOptionHeight(option, selected, height);
    };
  }

  private ignoreOptionHeight(_height: number): void {}

  private optionMeasurementIdentity(): string {
    this.readerWindowMetricsRevision;
    const metrics = readerWindowMetrics();
    const inputs = JSON.stringify([this.selectionId, this.variant, this.controlWidth, this.menuKind,
      this.renderedValue(), this.renderedOptions(), this.hosting === 'popup' ? this.renderedSelectedIndex() : -1,
      this.hostLeftVp, this.hostRightVp, metrics.windowRect.width,
      readerInteractiveSafeLeft(metrics), readerInteractiveSafeRight(metrics), metrics.systemFontScale, metrics.densityPixels,
      this.variant === 'sourceGroup' && this.controlWidth > 0 ? this.x : 0]);
    if (inputs !== this.optionLayoutInputs) {
      this.optionLayoutInputs = inputs;
      this.optionLayoutIdentity = JSON.stringify([inputs, this.resolvedWidth()]);
    }
    return this.optionLayoutIdentity;
  }

  private invalidateOptionHeights(): void {
    if (this.fillsMeasuredSourceGroupHeight(330)) {
      this.optionHeights.clear();
      this.optionHeightsLayoutIdentity = '';
      return;
    }
    const identity = this.optionMeasurementIdentity();
    if (identity === this.optionHeightsLayoutIdentity) return;
    this.optionHeights.clear();
    this.optionHeightsLayoutIdentity = identity;
  }

  private panelHeight(): number {
    const height = Math.max(this.menuHeaderHeight, this.menuFooterHeight, this.expandedHeight);
    return this.hostBottomVp >= 0 ? Math.min(height, Math.max(0, this.hostBottomVp - this.hostTopVp)) : height;
  }

  build() {
    if (this.hosting === 'popup') {
      this.panelBody();
    } else {
      Column() { this.panelBody(); }
        .width(this.resolvedWidth()).height(this.panelHeight())
        .position({ x: this.panelX(), y: this.panelY() }).zIndex(10);
    }
  }

  @Builder
  private emptyMenuHeader() {}

  @Builder
  private panelBody() {
    Column({ space: 0 }) {
      if (this.menuHeaderHeight > 0) {
        this.searchableFrame();
        this.searchableHeader(this.selectionId);
      }
      if (this.wrapsOptions()) {
        Scroll() {
          Column({ space: 0 }) { this.optionContent(); }.width('100%');
        }.width('100%').layoutWeight(1).scrollBar(BarState.Auto)
          .onScrollStop(this.onOptionsScrollStop === undefined ? (): void => {} : this.optionsScrollStopAction());
      } else { this.optionContent(); }
      if (this.menuFooterHeight > 0) { this.menuFooter(); }
    }
    .id(this.nativeAnchorId)
    .width(this.resolvedWidth())
    .height(this.panelHeight())
    .padding(this.variant === 'appearanceLibrary' ? 3 : 0)
    .zIndex(10)
    .backgroundColor(this.menuHeaderHeight > 0 ? Color.Transparent : this.panelBackgroundColor())
    .border({ width: this.menuHeaderHeight > 0 ? 0 : TOK_BORDER_W, color: this.panelBorderColor() })
    .borderRadius(this.variant === 'appearanceLibrary' ? 9 : (this.variant === 'sourceGroup' ? SOURCE_GROUP_SELECT_RADIUS : 14))
    .opacity(this.panelOpacity)
    .shadow(this.variant === 'appearanceLibrary' ? this.appearanceShadow() :
      readerSurfaceElevation(this.variant === 'sourceGroup' ? 'popover' : 'embedded', this.appThemeScheme))
    .clip(true).onAppear((): void => this.expandPanel());
  }

  @Builder
  private searchableFrame() {
    Row()
      .id(`${this.selectionId}:frame`)
      .width('100%').height(this.searchablePaintHeight())
      .position({ x: 0, y: SOURCE_GROUP_SELECT_PAINT_INSET })
      .backgroundColor(this.panelBackgroundColor())
      .border({ width: TOK_BORDER_W, color: this.panelBorderColor() })
      .borderRadius(SOURCE_GROUP_SELECT_RADIUS)
      .hitTestBehavior(HitTestMode.None)
      .accessibilityLevel('no');
  }

  private searchablePaintHeight(): number {
    const height = this.panelHeight();
    const shownBelowHeader = Math.max(0, height - this.menuHeaderHeight);
    const bottomInset = Math.max(0, SOURCE_GROUP_SELECT_PAINT_INSET - shownBelowHeader);
    return Math.max(0, height - SOURCE_GROUP_SELECT_PAINT_INSET - bottomInset);
  }

  @Builder
  private searchableHeader(identity: string) {
    Stack({ alignContent: Alignment.End }) {
      this.menuHeader();
      if (this.onMenuHeaderCollapse !== undefined) {
        Button({ type: ButtonType.Normal, stateEffect: false }) {
          Stack({ alignContent: Alignment.TopStart }) {
            Image(this.appThemeScheme === 'night' ? $r('app.media.reader_chevron_down_theme_night') : $r('app.media.reader_chevron_down'))
              .width(CHEVRON_W).height(CHEVRON_H)
              .position({ x: SOURCE_GROUP_SELECT_ARROW_TARGET - CHEVRON_W - SELECT_PAD,
                y: (this.menuHeaderHeight - CHEVRON_H) / 2 })
              .rotate({ angle: this.chevronAngle }).accessibilityLevel('no');
          }.width('100%').height('100%');
        }.width(SOURCE_GROUP_SELECT_ARROW_TARGET).height(this.menuHeaderHeight)
          .padding(0)
          .attributeModifier(new ReaderPressFeedback(Color.Transparent, this.appThemeScheme,
            SOURCE_GROUP_SELECT_RADIUS, SOURCE_GROUP_SELECT_RADIUS, !this.closing))
          .responseRegion({ x: 0, y: Math.min(0, (this.menuHeaderHeight - 44) / 2),
            width: SOURCE_GROUP_SELECT_ARROW_TARGET, height: Math.max(44, this.menuHeaderHeight) })
          .enabled(!this.closing)
          .id('reader-source-group-collapse').accessibilityText('收起分组')
          .onClick((): void => this.onMenuHeaderCollapse?.(identity));
      }
    }.width('100%').height(this.menuHeaderHeight);
  }

  @Builder
  private optionContent() {
      if (this.hosting === 'popup') {
        if (this.variant !== 'appearanceLibrary') this.selectedRow(this.renderedSelectedIndex());
        ForEach(this.renderedOptions(), (opt: string, index: number) => {
          if (this.variant === 'appearanceLibrary') {
            this.appearanceLibraryOption(opt, index);
          } else if (index !== this.renderedSelectedIndex()) {
            this.optionRow(opt, index);
          }
        }, (opt: string, index: number): string => `ropt-${index}-${opt}`);
      } else if (this.variant === 'appearanceLibrary') {
        ForEach(this.renderedOptions(), (opt: string) => {
          this.appearanceLibraryOption(opt);
        }, (opt: string): string => `ropt-${opt}`);
      } else {
        if (this.showsSelectedRow()) {
          this.selectedRow();
        } else if (this.renderedOptions().length === 0) {
          Text(this.emptyOptionsText).width('100%').height(44).padding({ left: 14, right: 14 })
            .fontFamily(TYPE_SELECT_SOURCE_GROUP_VALUE.fontFamily)
            .fontWeight(TYPE_SELECT_SOURCE_GROUP_VALUE.fontWeight)
            .fontSize(TYPE_SELECT_SOURCE_GROUP_VALUE.fontSizeFp)
            .lineHeight(TYPE_SELECT_SOURCE_GROUP_VALUE.lineHeightFp as number).halfLeading(true)
            .fontColor(readerAppColor('TOK_CONTROL_INK', this.appThemeScheme))
            .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis });
        }
        ForEach(this.renderedOptions().filter((o: string): boolean => o !== this.renderedValue()), (opt: string) => {
          this.optionRow(opt);
        }, (opt: string): string => `ropt-${opt}`);
      }
  }

  @Builder
  private appearanceLibraryOption(opt: string, index: number = -1) {
    ReaderChoiceRow({
      specId: 'appearance-library', label: opt,
      selected: index < 0 ? opt === this.renderedValue() : index === this.renderedSelectedIndex(), scheme: this.appThemeScheme,
      actionEnabled: !this.closeInFlight,
      wrapLabel: true,
      focusId: this.optionFocusId(opt === this.renderedValue() ? 'selected' : `option:${opt}`),
      onHeightChange: this.optionHeightHandler(opt, index < 0 ? opt === this.renderedValue() : index === this.renderedSelectedIndex()),
      onChoose: (option: string): void => this.selectAndCollapse(option, index),
    });
  }

  @Builder
  private selectedRow(index: number = -1) {
    ReaderChoiceRow({
      specId: this.variant === 'sourceGroup' ? 'source-group-selected' : 'default-selected',
      label: this.renderedValue(), selected: true, scheme: this.appThemeScheme,
      chevronAngle: this.chevronAngle,
      hideIcon: this.menuHeaderHeight > 0,
      actionEnabled: !this.closeInFlight,
      wrapLabel: this.wrapsOptions(),
      focusId: this.optionFocusId('selected'),
      onHeightChange: this.optionHeightHandler(this.renderedValue(), true),
      onChoose: (option: string): void => this.selectAndCollapse(option, index),
    });
  }

  @Builder
  private optionRow(opt: string, index: number = -1) {
    ReaderChoiceRow({
      specId: this.variant === 'sourceGroup' ? 'source-group-option' : 'default-option',
      label: opt, scheme: this.appThemeScheme, actionEnabled: !this.closeInFlight,
      textLayoutOptions: this.optionTextLayoutOptions?.(opt, this.selectionId),
      wrapLabel: this.wrapsOptions(),
      focusId: this.optionFocusId(`option:${opt}`),
      onHeightChange: this.optionHeightHandler(opt, false),
      onChoose: (option: string): void => this.selectAndCollapse(option, index),
    });
  }

  private optionFocusId(key: string): string {
    return this.focusIdPrefix.length > 0 ? `${this.focusIdPrefix}:${key}` : '';
  }

  private optionsScrollStopAction(): () => void {
    const identity = this.selectionId;
    const generation = this.generation;
    const report = this.onOptionsScrollStop;
    return (): void => {
      if (this.mounted && !this.closing && !this.closeInFlight && this.selectionId === identity &&
        this.generation === generation) report?.(identity);
    };
  }

  private resolvedWidth(): number {
    if (this.variant === 'sourceGroup' && this.controlWidth > 0) {
      return this.hostRightVp >= 0 ? Math.min(this.controlWidth, this.hostRightVp - this.panelX()) : this.controlWidth;
    }
    if (this.controlWidth > 0 && this.variant !== 'default') {
      return this.hostRightVp >= 0 ? Math.min(this.controlWidth, readerSelectAvailableWidth(this.hostRightVp - this.hostLeftVp, 0, 0)) : this.controlWidth;
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
        fontWeight: this.measureTextStyle().fontWeight,
      });
      if (w > maxPx) {
        maxPx = w;
      }
    }
    const naturalWidth = Math.ceil(ctx.px2vp(maxPx)) + this.resolvedChrome();
    if (this.variant !== 'default' && this.variant !== 'sourceGroup') return naturalWidth;
    const metrics = readerWindowMetrics();
    const viewportWidth = this.hostRightVp >= 0 ? Math.max(0, this.hostRightVp - this.hostLeftVp) :
      this.readerWindowMetricsRevision < 0 ? 0 : metrics.windowRect.width;
    const available = this.hostRightVp >= 0 ? readerSelectAvailableWidth(viewportWidth, 0, 0) :
      readerSelectAvailableWidth(viewportWidth, readerInteractiveSafeLeft(metrics), readerInteractiveSafeRight(metrics));
    // The panel border consumes one vp on each side of the 44vp option lane.
    const minimum = 44 + TOK_BORDER_W * 2;
    const contentWidth = this.variant === 'sourceGroup' && available >= minimum ?
      Math.max(minimum, naturalWidth) : naturalWidth;
    return readerSelectMenuWidth(contentWidth, viewportWidth, available, this.menuKind);
  }

  private panelX(): number {
    if (this.variant === 'sourceGroup' && this.controlWidth > 0) {
      return this.hostRightVp >= 0 ? Math.max(this.hostLeftVp, Math.min(this.x, this.hostRightVp)) : this.x;
    }
    const requested = this.alignRight ? this.x - this.resolvedWidth() : this.x;
    if (this.hostRightVp >= 0) {
      const left = Math.min(this.hostRightVp, this.hostLeftVp + 16);
      const right = Math.max(left, this.hostRightVp - 16);
      return Math.max(left, Math.min(requested, right - this.resolvedWidth()));
    }
    if (this.variant !== 'sourceGroup') return requested;
    const metrics = readerWindowMetrics();
    return Math.max(Math.max(16, readerInteractiveSafeLeft(metrics)), Math.min(requested,
      metrics.windowRect.width - Math.max(16, readerInteractiveSafeRight(metrics)) - this.resolvedWidth()));
  }

  private appearanceShadow(): ShadowOptions {
    const density = readerWindowMetrics().densityPixels;
    return { radius: 20 * density, offsetY: 8 * density,
      color: readerAppColor('app.shadow.select', this.appThemeScheme) };
  }

  private panelY(): number {
    if (this.hostBottomVp < 0) return this.y;
    const height = this.fullPanelHeight();
    const below = this.hostBottomVp - this.y;
    const requested = below >= height ? this.y : this.y - height;
    return Math.max(this.hostTopVp, Math.min(requested, this.hostBottomVp - height));
  }

  private resolvedChrome(): number {
    if (this.variant === 'settingsPhone' || this.variant === 'settingsTablet') {
      return 10 + 8 + 6 + (this.variant === 'settingsTablet' ? 10 : 7);
    }
    return SELECT_CHROME + TOK_BORDER_W * 2;
  }

  private panelBackgroundColor(): ResourceColor {
    if (this.variant === 'appearanceLibrary') return readerAppColor('app.appearance.selectSurface', this.appThemeScheme);
    if (this.variant === 'sourceGroup') {
      return readerAppColor(this.menuHeaderHeight > 0 ? 'app.surface.menuSolid' : 'app.select.panelSolid', this.appThemeScheme);
    }
    return readerAppColor(this.variant === 'default' ? 'app.select.menuSurface' : 'TOK_FIELD_SURFACE', this.appThemeScheme);
  }

  private panelBorderColor(): ResourceColor {
    if (this.variant === 'appearanceLibrary') return readerAppColor('app.appearance.selectBorder', this.appThemeScheme);
    if (this.variant === 'sourceGroup') {
      return readerAppColor('app.border.sourceGroup', this.appThemeScheme);
    }
    return readerAppColor('TOK_BORDER', this.appThemeScheme);
  }

  private measureTextStyle() {
    if (this.variant === 'settingsPhone' || this.variant === 'settingsTablet') {
      return TYPE_SELECT_SETTINGS_VALUE;
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
      this.fadePanelIn();
      return;
    }
    if (this.expandedHeight === targetHeight && this.chevronAngle === -180) {
      if (this.appearanceHeightAnimator !== undefined && this.appearanceHeightTarget !== targetHeight) {
        this.cancelAppearanceHeightAnimation();
      }
      return;
    }
    if (this.variant === 'appearanceLibrary' && this.animateAppearanceHeight(targetHeight, -180)) return;
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
    this.collapsePanel((): void => dismiss(identity), undefined, true);
  }

  private selectAndCollapse(option: string, index: number = -1): void {
    if (!this.mounted || this.closeInFlight || this.inputCurrent?.() === false) return;
    const identity = this.selectionId;
    const commit = this.onCommit;
    if (commit === undefined) return;
    const dismiss = this.onDismiss;
    this.collapsePanel((): void => dismiss(identity), (): void => {
      if (this.hosting === 'popup') commit(option, identity, index);
      else commit(option, identity);
    });
  }

  private collapsePanel(onFinish: () => void, onCommit?: () => void, deferParent: boolean = false): void {
    if (!this.mounted || this.closeInFlight) {
      return;
    }
    this.closingValue = this.value;
    this.closingOptions = this.options.slice();
    if (this.hosting === 'popup') this.closingSelectedIndex = this.renderedSelectedIndex();
    this.closeInFlight = true;
    this.closeFinish = onFinish;
    const generation = ++this.generation;
    if (this.appearanceHeightAnimator !== undefined) this.cancelAppearanceHeightAnimation();
    if (onCommit !== undefined) onCommit();
    if (!this.mounted || generation !== this.generation) return;
    if (this.reduceMotion) {
      this.fadePanelOut(generation, deferParent);
      return;
    }
    if (this.variant === 'appearanceLibrary' &&
      this.animateAppearanceHeight(OPTION_H, 0, (): void => this.finishCollapse(generation))) return;
    this.getUIContext().animateTo(
      motionAnimateParam('dropdown.menu.collapse', (): void => {
        this.finishCollapse(generation);
      }),
      (): void => {
        this.expandedHeight = this.collapsedHeight();
        this.chevronAngle = 0;
      },
    );
  }

  private cancelAppearanceHeightAnimation(): void {
    const animator = this.appearanceHeightAnimator;
    this.appearanceHeightAnimator = undefined;
    animator?.cancel();
  }

  private animateAppearanceHeight(height: number, angle: number, finish?: () => void): boolean {
    if (this.hosting !== 'overlay') return false;
    if (this.appearanceHeightAnimator !== undefined && this.appearanceHeightTarget === height) return true;
    this.cancelAppearanceHeightAnimation();
    const spec = motionSpecGet(finish === undefined ? 'dropdown.menu.expand' : 'dropdown.menu.collapse');
    const curve = spec?.curve;
    if (spec === undefined || typeof curve !== 'object') return false;
    const generation = this.generation;
    const fromHeight = this.expandedHeight;
    const fromAngle = this.chevronAngle;
    const context = this.getUIContext();
    try {
      const animator = context.createAnimator({
        duration: spec.durationMs, easing: 'linear', delay: 0, fill: 'forwards',
        direction: 'normal', iterations: 1, begin: 0, end: 1,
      });
      this.appearanceHeightAnimator = animator;
      this.appearanceHeightTarget = height;
      animator.onFrame = (fraction: number): void => {
        if (this.appearanceHeightAnimator !== animator || !this.mounted || generation !== this.generation) return;
        const progress = curve.interpolate(fraction);
        this.expandedHeight = fromHeight + (height - fromHeight) * progress;
        this.chevronAngle = fromAngle + (angle - fromAngle) * progress;
      };
      animator.onFinish = (): void => {
        if (this.appearanceHeightAnimator !== animator || !this.mounted || generation !== this.generation) return;
        this.appearanceHeightAnimator = undefined;
        this.expandedHeight = height;
        this.chevronAngle = angle;
        if (finish !== undefined) {
          context.postFrameCallback(new ReaderSelectParentFrame(finish));
        }
      };
      animator.play();
      return true;
    } catch (_) {
      this.appearanceHeightAnimator = undefined;
      return false;
    }
  }

  private fullPanelHeight(): number {
    if (this.wrapsOptions()) {
      // Native rows report their actual wrapped height. Retain this state read
      // so measurements also update the animated frame during font/width changes.
      if (this.measuredHeightRevision < 0) return 0;
      const configured = Number.isFinite(this.maxPanelHeight) && this.maxPanelHeight > 0 ? Math.min(330, this.maxPanelHeight) : 330;
      const maximum = this.hostBottomVp >= 0 ?
        Math.min(configured + this.menuHeaderHeight, Math.max(0, this.hostBottomVp - this.hostTopVp)) :
        configured + this.menuHeaderHeight;
      if (this.fillsMeasuredSourceGroupHeight(maximum - this.menuHeaderHeight)) return maximum;
      const appearance = this.variant === 'appearanceLibrary';
      const minimum = appearance ? APPEARANCE_SELECT_OPTION_HEIGHT : 44;
      let height = this.menuHeaderHeight + (this.menuFooterHeight || 0) + (appearance ? 8 : TOK_BORDER_W * 2);
      if (height >= maximum) return maximum;
      const selected = this.renderedValue();
      const indexed = this.hosting === 'popup';
      const selectedIndex = indexed ? this.renderedSelectedIndex() : -1;
      // The identity includes the complete option list. Resolve it once per
      // panel height, since native row measurement can run this for every row.
      const heights = this.optionHeightsLayoutIdentity === this.optionMeasurementIdentity() ? this.optionHeights : undefined;
      if (!appearance && (indexed || this.showsSelectedRow())) {
        height += heights?.get(`${this.variant}:true:${selected}`) ?? minimum;
      } else if (this.menuHeaderHeight > 0 && this.renderedOptions().length === 0) {
        height += minimum;
      }
      const options = this.renderedOptions();
      for (let i = 0; i < options.length; i++) {
        if (height >= maximum) return maximum;
        const option = options[i];
        const isSelected = indexed ? i === selectedIndex : option === selected;
        if (appearance || !isSelected) {
          height += heights?.get(`${this.variant}:${appearance && isSelected}:${option}`) ?? minimum;
        }
      }
      return Math.min(height,maximum);
    }
    if (this.variant === 'appearanceLibrary') return appearanceSelectMenuHeight(this.options.length);
    if (this.hosting === 'popup') return OPTION_H * (this.options.length + (this.renderedSelectedIndex() < 0 ? 1 : 0));
    let unselectedCount = 0;
    for (const option of this.options) {
      if (option !== this.value) {
        unselectedCount += 1;
      }
    }
    return OPTION_H * (1 + unselectedCount);
  }

  private fillsMeasuredSourceGroupHeight(maximum: number): boolean {
    if (this.variant !== 'sourceGroup' || this.controlWidth <= 0) return false;
    if (this.menuHeaderHeight > 0) return Math.max(1, this.renderedOptions().length) * 44 + (this.menuFooterHeight || 0) + TOK_BORDER_W * 2 >= maximum;
    if (this.hosting === 'popup') return (this.renderedOptions().length + (this.renderedSelectedIndex() < 0 ? 1 : 0)) * 44 + TOK_BORDER_W * 2 >= maximum;
    // The selected row is always present, even if its value left the option list.
    let minimum = 44 + TOK_BORDER_W * 2;
    const selected = this.renderedValue();
    for (const option of this.renderedOptions()) {
      if (minimum >= maximum) return true;
      if (option !== selected) minimum += 44;
    }
    return minimum >= maximum;
  }
}
