import { readerAppColor } from '../foundation/ReaderThemeRegistry';
import { ReaderChoiceRow } from './ReaderChoiceRow';
import { registerReaderFonts } from '../foundation/ReaderFonts';
import { ReaderWindowCoordinator } from '../../app/ReaderWindowCoordinator';
import { readerInteractiveSafeLeft, readerInteractiveSafeRight } from '../foundation/ReaderWindowMetrics';
import { ReaderSelectMenuKind, readerSelectAvailableWidth, readerSelectMenuWidth } from '../foundation/ReaderSelectGeometry';
import {
  TOK_BORDER,
  TOK_BORDER_W,
  TOK_CONTROL_INK,
  TOK_FIELD_SURFACE,
  TOK_INK,
  TOK_PRIMARY_DARK,
  TOK_SPACE_CONTROL_INLINE,
  TOK_SURFACE_PANEL_SOFT,
} from '../foundation/ReaderTokens';
import { motionAnimateParam } from '../foundation/MotionSpec';
import { readerMotionAnimateParam } from '../foundation/ReaderMotionPolicy';
import {
  APPEARANCE_SELECT_OPTION_HEIGHT, appearanceSelectMenuHeight,
} from './ReaderSelectAppearanceStyle';
import type { ReaderSelectVariant } from './ReaderSelect';
import {
  TYPE_SELECT_DEFAULT_VALUE,
  TYPE_SELECT_OPTION,
  TYPE_SELECT_SETTINGS_VALUE,
  TYPE_SELECT_SOURCE_GROUP_VALUE,
} from '../foundation/ReaderTypography';

// 展开下拉面板 — 宿主页在全高 overlay Stack 内定位渲染, position 相对宿主 Stack。
// 全部选项行都落在宿主 Stack bounds 内 → 可点 (ArkUI 命中测试裁到父边界, 行内面板
// 下层选项不可点; 拆到全高容器即解决)。
// 面板 = 已选行置顶 (panel-soft 高亮 + Bold + chevron 上旋) + 其余选项 (透明 +
// Regular #41484C), 选项左对齐 px10, 对齐 motion 1506:8807。
// 默认菜单独立测量选项；长名称受安全宽度/紧凑书源上限约束并原生折行。
const OPTION_H = 36;
const SELECT_PAD = TOK_SPACE_CONTROL_INLINE; // 10
const CHEVRON_GAP = 8;
const CHEVRON_W = 12;
const CHEVRON_H = 8;
const SELECT_CHROME = SELECT_PAD * 2 + CHEVRON_GAP + CHEVRON_W; // 40

@Component
export struct ReaderSelectPanel {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  @StorageLink('readerWindowMetricsRevision') @Watch('onGeometryChanged') private readerWindowMetricsRevision: number = 0;

  @Prop value: string = '';
  @Prop options: string[] = [];
  @Prop x: number = 0;
  @Prop y: number = 0;
  @Prop variant: ReaderSelectVariant = 'default';
  @Prop @Watch('onReduceMotionChanged') reduceMotion: boolean = false;
  @Prop @Watch('onClosingChanged') closing: boolean = false;
  @Prop @Watch('onIdentityChanged') selectionId: string = '';
  // 仅 appearance 等既有定宽模板保留固定菜单宽；default/sourceGroup独立测量。
  @Prop controlWidth: number = 0;
  /** Optional current appearance host budget. Zero keeps the original menu contract. */
  @Prop @Watch('onGeometryChanged') maxPanelHeight: number = 0;
  @Prop menuKind: ReaderSelectMenuKind = 'standard';
  // true = x 为面板右缘 (宿主触发条整行右对齐场景, 如 RSS 筛选)。
  @Prop alignRight: boolean = false;
  /** Optional addresses for the selected row and its wrapping alternatives. */
  @Prop focusIdPrefix: string = '';
  // Production callers commit the immutable choice now; finish only unmounts.
  onCommit: ((option: string, identity: string) => void) | undefined = undefined;
  onDismiss: (identity: string) => void = (_identity: string): void => {};
  @State private expandedHeight: number = OPTION_H;
  @State private chevronAngle: number = 0;
  @State private closeInFlight: boolean = false;
  @State private measuredHeightRevision: number = 0;
  private optionHeights: Map<string, number> = new Map<string, number>();
  private mounted: boolean = false;
  private generation: number = 0;
  private closingValue: string = '';
  private closingOptions: string[] = [];
  private closeFinish: (() => void) | undefined = undefined;

  private renderedValue(): string { return this.closeInFlight ? this.closingValue : this.value; }
  private renderedOptions(): string[] { return this.closeInFlight ? this.closingOptions : this.options; }

  aboutToAppear(): void {
    this.mounted = true;
    this.generation += 1;
    this.closeFinish = undefined;
    registerReaderFonts(this.getUIContext().getFont());
  }

  aboutToDisappear(): void { this.mounted = false; this.generation += 1; this.closeFinish = undefined; }

  private onIdentityChanged(): void {
    this.generation += 1;
    this.closeInFlight = false;
    this.closeFinish = undefined;
    if (this.mounted) this.expandPanel();
  }

  private onReduceMotionChanged(): void {
    if (!this.mounted || !this.reduceMotion) return;
    const generation = ++this.generation;
    this.getUIContext().animateTo(readerMotionAnimateParam(
      this.closeInFlight ? 'dropdown.menu.collapse' : 'dropdown.menu.expand', true), (): void => {
      this.expandedHeight = this.closeInFlight ? OPTION_H : this.fullPanelHeight();
      this.chevronAngle = this.closeInFlight ? 0 : -180;
    });
    if (this.closeInFlight) this.finishCollapse(generation);
  }

  private finishCollapse(generation: number): void {
    if (!this.mounted || generation !== this.generation || !this.closeInFlight) return;
    const finish = this.closeFinish;
    this.closeFinish = undefined;
    finish?.();
  }

  private wrapsOptions(): boolean {
    return this.variant === 'default' || this.variant === 'sourceGroup' || this.variant === 'appearanceLibrary';
  }

  private onGeometryChanged(): void {
    if (this.mounted && !this.closeInFlight && this.wrapsOptions()) this.expandPanel();
  }

  private recordOptionHeight(option: string, selected: boolean, height: number): void {
    if (!this.mounted || this.closeInFlight || !Number.isFinite(height) || height <= 0) return;
    const key = `${this.variant}:${selected}:${option}`;
    if (Math.abs((this.optionHeights.get(key) ?? 0) - height) < .1) return;
    this.optionHeights.set(key, height);
    this.measuredHeightRevision += 1;
    this.expandPanel();
  }

  private optionHeightHandler(option: string, selected: boolean): (height: number) => void {
    const generation = this.generation;
    return (height: number): void => {
      if (generation === this.generation) this.recordOptionHeight(option, selected, height);
    };
  }

  build() {
    Column({ space: 0 }) {
      if (this.wrapsOptions()) {
        Scroll() {
          Column({ space: 0 }) { this.optionContent(); }.width('100%');
        }.width('100%').layoutWeight(1).scrollBar(BarState.Auto);
      } else { this.optionContent(); }
    }
    .position({ x: this.panelX(), y: this.y })
    .width(this.resolvedWidth())
    .height(this.expandedHeight)
    .padding(this.variant === 'appearanceLibrary' ? 3 : 0)
    .zIndex(10)
    .backgroundColor(this.panelBackgroundColor())
    .border({ width: TOK_BORDER_W, color: this.panelBorderColor() })
    .borderRadius(this.variant === 'appearanceLibrary' ? 9 : (this.variant === 'sourceGroup' ? 8 : 6))
    .shadow({ radius: this.variant === 'appearanceLibrary' ? 20 : 0,
      color: this.variant === 'appearanceLibrary' ? readerAppColor('app.shadow.select', this.appThemeScheme) : Color.Transparent, offsetY: 8 })
    .clip(true).onAppear((): void => this.expandPanel());
  }

  @Builder
  private optionContent() {
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

  @Builder
  private appearanceLibraryOption(opt: string) {
    ReaderChoiceRow({
      specId: 'appearance-library', label: opt,
      selected: opt === this.renderedValue(), scheme: this.appThemeScheme,
      actionEnabled: !this.closeInFlight,
      wrapLabel: true,
      focusId: this.optionFocusId(opt === this.renderedValue() ? 'selected' : `option:${opt}`),
      onHeightChange: this.optionHeightHandler(opt, opt === this.renderedValue()),
      onChoose: (option: string): void => this.selectAndCollapse(option),
    });
  }

  @Builder
  private selectedRow() {
    ReaderChoiceRow({
      specId: this.variant === 'sourceGroup' ? 'source-group-selected' : 'default-selected',
      label: this.renderedValue(), selected: true, scheme: this.appThemeScheme,
      chevronAngle: this.chevronAngle,
      actionEnabled: !this.closeInFlight,
      wrapLabel: this.wrapsOptions(),
      focusId: this.optionFocusId('selected'),
      onHeightChange: this.optionHeightHandler(this.renderedValue(), true),
      onChoose: (option: string): void => this.selectAndCollapse(option),
    });
  }

  @Builder
  private optionRow(opt: string) {
    ReaderChoiceRow({
      specId: this.variant === 'sourceGroup' ? 'source-group-option' : 'default-option',
      label: opt, scheme: this.appThemeScheme, actionEnabled: !this.closeInFlight,
      wrapLabel: this.wrapsOptions(),
      focusId: this.optionFocusId(`option:${opt}`),
      onHeightChange: this.optionHeightHandler(opt, false),
      onChoose: (option: string): void => this.selectAndCollapse(option),
    });
  }

  private optionFocusId(key: string): string {
    return this.focusIdPrefix.length > 0 ? `${this.focusIdPrefix}:${key}` : '';
  }

  // 最长文本(值 ∪ 选项)实测宽 + chrome, px→vp。
  private resolvedWidth(): number {
    if (this.controlWidth > 0 && this.variant !== 'default' && this.variant !== 'sourceGroup') {
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
        fontWeight: this.measureTextStyle().fontWeight,
      });
      if (w > maxPx) {
        maxPx = w;
      }
    }
    const naturalWidth = Math.ceil(ctx.px2vp(maxPx)) + this.resolvedChrome();
    if (this.variant !== 'default' && this.variant !== 'sourceGroup') return naturalWidth;
    const metrics = ReaderWindowCoordinator.metrics();
    const viewportWidth = this.readerWindowMetricsRevision < 0 ? 0 : metrics.windowRect.width;
    return readerSelectMenuWidth(naturalWidth, viewportWidth, readerSelectAvailableWidth(viewportWidth,
      readerInteractiveSafeLeft(metrics), readerInteractiveSafeRight(metrics)), this.menuKind);
  }

  private panelX(): number {
    const requested = this.alignRight ? this.x - this.resolvedWidth() : this.x;
    if (this.variant !== 'sourceGroup') return requested;
    const metrics = ReaderWindowCoordinator.metrics();
    return Math.max(Math.max(16, readerInteractiveSafeLeft(metrics)), Math.min(requested,
      metrics.windowRect.width - Math.max(16, readerInteractiveSafeRight(metrics)) - this.resolvedWidth()));
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
      return readerAppColor('app.select.panelSolid', this.appThemeScheme);
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
    if (commit === undefined) return;
    const dismiss = this.onDismiss;
    this.collapsePanel((): void => dismiss(identity), (): void => commit(option, identity));
  }

  private collapsePanel(onFinish: () => void, onCommit?: () => void): void {
    if (!this.mounted || this.closeInFlight) {
      return;
    }
    this.closingValue = this.value;
    this.closingOptions = this.options.slice();
    this.closeInFlight = true;
    this.closeFinish = onFinish;
    const generation = ++this.generation;
    if (onCommit !== undefined) onCommit();
    if (!this.mounted || generation !== this.generation) return;
    if (this.reduceMotion) {
      this.expandedHeight = OPTION_H;
      this.chevronAngle = 0;
      this.finishCollapse(generation);
      return;
    }
    this.getUIContext().animateTo(
      motionAnimateParam('dropdown.menu.collapse', (): void => {
        this.finishCollapse(generation);
      }),
      (): void => {
        this.expandedHeight = OPTION_H;
        this.chevronAngle = 0;
      },
    );
  }

  private fullPanelHeight(): number {
    if (this.wrapsOptions()) {
      // Native rows report their actual wrapped height. Retain this state read
      // so measurements also update the animated frame during font/width changes.
      if (this.measuredHeightRevision < 0) return 0;
      const minimum = this.variant === 'appearanceLibrary' ? APPEARANCE_SELECT_OPTION_HEIGHT : this.variant === 'default' ? 44 : OPTION_H;
      let height = this.variant === 'appearanceLibrary' ? 8 : TOK_BORDER_W * 2;
      if (this.variant !== 'appearanceLibrary') height += this.optionHeights.get(`${this.variant}:true:${this.renderedValue()}`) ?? minimum;
      for (const option of this.renderedOptions()) {
        if (this.variant === 'appearanceLibrary' || option !== this.renderedValue())
          height += this.optionHeights.get(`${this.variant}:${this.variant === 'appearanceLibrary' && option === this.renderedValue()}:${option}`) ?? minimum;
      }
      const maximum = this.variant === 'appearanceLibrary' && Number.isFinite(this.maxPanelHeight) && this.maxPanelHeight > 0 ?
        Math.min(330, this.maxPanelHeight) : 330;
      return Math.min(height, maximum);
    }
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
