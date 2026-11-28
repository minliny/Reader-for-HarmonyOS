import { ReaderInsetsVp, ReaderRectVp } from '../../../ui/foundation/ReaderWindowMetrics';
import { READER_LAYOUT_DEBUG_BUILD } from '../../../ui/foundation/ReaderLayoutInvariantSignals';
import { readerOverlayListHeight, readerOverlayPanel, readerOverlayViewport } from '../../../ui/layout/ReaderOverlayGeometry';
import { ReaderChoiceRow, readerSettingsTabletOptionHeight } from '../../../ui/controls/ReaderChoiceRow';
import { readerAppColor } from '../../../ui/foundation/ReaderThemeRegistry';
import { ReaderPressFeedback } from '../../../ui/foundation/ReaderPressFeedback';
import { readerMotionAnimateParam, readerMotionReducedFadeParam } from '../../../ui/foundation/ReaderMotionPolicy';
import { registerReaderFonts } from '../../../ui/foundation/ReaderFonts';
import {
  TYPE_SETTINGS_SELECT_PHONE_CANCEL,
  TYPE_SETTINGS_SELECT_TITLE,
} from '../../../ui/foundation/ReaderTypography';
import { PopupSurfaceSpec, readerSurfaceElevation, resolvePopupSpec } from '../../../ui/surfaces/ReaderSurfaceSpecs';
import { defaultNavigationPreferences, ReaderImmersiveMaterialModifier, ReaderModalScrimModifier, readerNativeSurfaceOutline,
  readerSurfaceMaterialDecision } from '../../../ui/surfaces/ReaderSurfaceMaterial';
import type { ReaderNavigationPreferences, ReaderSurfaceMaterialDecision } from '../../../app/HarmonyCapabilityPolicy';
import { readerReadableFontScale, readerScaledBarHeight, readerScaledControlHeight } from '../../../ui/foundation/ReaderSurfaceResolvers';
import { ReaderWindowCoordinator } from '../../../app/ReaderWindowCoordinator';

export type SettingsSelectField = 'language' | 'startup' | 'renderMode';

const PHONE_HORIZONTAL_INSET = 14;
const PHONE_BOTTOM_INSET = 20;
const PHONE_OPTION_HEIGHT = 52;
const PHONE_CANCEL_GAP = 10;
const PHONE_RADIUS = 12;
const PHONE_SHEET_CORNERS: OutlineRadiuses = { topLeft: 24, topRight: 24 };

/**
 * Settings-only responsive selector.
 *
 * Figma:
 * - Settings/SelectPanel `4106:64687`
 * - Settings/SelectOptionRow `4103:909`
 * - Phone references `4108:4622`, `4108:4956`, `4108:5231`
 * - Tablet references `4108:5502`, `4108:5827`, `4108:6093`
 *
 * Phone is a modal bottom sheet. Tablet is a trigger-right-aligned popover.
 * This deliberately does not reuse ReaderSelectPanel: that component's inline
 * dropdown geometry is a different Figma contract.
 */
@Component
export struct SettingsSelectOverlay {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  @StorageLink('readerSystemScheme') private systemScheme: string = 'day';
  @StorageProp('readerNavigationAppearancePreferences') private appearancePreferences: ReaderNavigationPreferences =
    defaultNavigationPreferences();
  @StorageLink('readerReduceMotion') private reduceMotion: boolean = false;
  @StorageLink('readerWindowMetricsRevision') private readerWindowMetricsRevision: number = 0;

  @Prop visible: boolean = true;
  @Prop expandedLayout: boolean = false;
  @Prop @Watch('onFieldChanged') field: SettingsSelectField = 'language';
  @Prop @Watch('onFieldChanged') selectionId: string = '';
  @Prop value: string = '';
  @Prop options: string[] = [];
  @Prop hostGeometry: ReaderRectVp = new ReaderRectVp();
  @Prop anchorGeometry: ReaderRectVp = new ReaderRectVp();
  onSelect: (option: string, identity?: string) => void = (_option: string, _identity?: string): void => {};
  onDismiss: (identity?: string) => void = (_identity?: string): void => {};
  onClosed: (identity: string) => void = (_identity: string): void => {};

  private mounted: boolean = false;
  private closed: boolean = false;

  aboutToAppear(): void {
    this.mounted = true;
    this.closed = false;
    registerReaderFonts(this.getUIContext().getFont());
    if (!this.visible) this.onClosed(this.selectionId);
  }

  aboutToDisappear(): void { this.mounted = false; this.closed = true; }

  private onFieldChanged(): void { this.closed = false; }
  private ownsOpening(identity: string): boolean {
    return this.mounted && this.visible && !this.closed && identity.length > 0 && identity === this.selectionId;
  }
  private dismiss(identity: string): void {
    if (!this.ownsOpening(identity)) return;
    this.closed = true;
    this.onDismiss(identity);
  }
  private choose(option: string, identity: string): void {
    if (!this.ownsOpening(identity) || this.options.indexOf(option) < 0) return;
    this.closed = true;
    this.onSelect(option, identity);
  }

  private panelTransition(bottomSheet: boolean): TransitionEffect {
    if (this.reduceMotion) return TransitionEffect.OPACITY.animation(readerMotionReducedFadeParam());
    return TransitionEffect.asymmetric(
      (bottomSheet ? TransitionEffect.move(TransitionEdge.BOTTOM) : TransitionEffect.OPACITY)
        .animation(readerMotionAnimateParam('app.sheet.open', false)),
      (bottomSheet ? TransitionEffect.move(TransitionEdge.BOTTOM) : TransitionEffect.OPACITY)
        .animation(readerMotionAnimateParam('app.sheet.close', false)));
  }

  private finishMotion(entering: boolean, identity: string): void {
    if (!entering && this.mounted && !this.visible && identity === this.selectionId) this.onClosed(identity);
  }

  private panelMaterial(role: 'modalSheet' | 'popoverMenu'): ReaderSurfaceMaterialDecision {
    return readerSurfaceMaterialDecision(role, this.appearancePreferences, this.appThemeScheme, this.systemScheme);
  }

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      ForEach([this.selectionId], (identity: string) => {
        if (this.visible) {
          Stack().width('100%').height('100%')
            .attributeModifier(new ReaderModalScrimModifier(this.appearancePreferences, this.appThemeScheme,
              this.expandedLayout ? Color.Transparent : readerAppColor('app.scrim.select', this.appThemeScheme),
              this.panelMaterial('modalSheet').native, !this.expandedLayout))
            .hitTestBehavior(HitTestMode.Default)
            .accessibilityLevel('no')
            .transition(TransitionEffect.OPACITY.animation(readerMotionAnimateParam('app.sheet.scrim', this.reduceMotion)))
            .onClick((): void => this.dismiss(identity));

        }
        if (this.expandedLayout) {
          if (this.visible) this.tabletPanel(identity);
        } else {
          this.phonePanel(identity);
        }
      }, (identity: string): string => identity);
    }
    .width('100%')
    .height('100%')
    .hitTestBehavior(HitTestMode.Transparent)
    .zIndex(30);
  }

  @Builder
  private phonePanel(identity: string) {
    Stack({ alignContent: Alignment.Bottom }) {
      if (this.visible) {
        Column() {
          if (this.phoneChoicesCapacity() > 0) {
            this.phoneSheet(true);
          } else {
            Scroll() { this.phoneSheet(false); }
              .width('100%').constraintSize({ maxHeight: this.viewport().height }).scrollBar(BarState.Auto);
          }
        }.width('100%')
          .id(typeof READER_LAYOUT_DEBUG_BUILD === 'boolean' && READER_LAYOUT_DEBUG_BUILD ? `reader-settings-select-phone:${this.field}` : '')
          .backgroundEffect(undefined)
          .backgroundColor(Color.Transparent)
          .border({ width: 0, color: Color.Transparent })
          .borderRadius(PHONE_SHEET_CORNERS)
          .clip(true)
          .shadow(this.panelMaterial('modalSheet').native ? undefined : readerSurfaceElevation('sheet', this.appThemeScheme))
          .attributeModifier(new ReaderImmersiveMaterialModifier(this.panelMaterial('modalSheet'),
            readerNativeSurfaceOutline(this.appThemeScheme, PHONE_SHEET_CORNERS, 'top')))
          .transition(this.panelTransition(true), (entering: boolean): void => this.finishMotion(entering, identity));
      }
    }
    .position({ x: this.viewport().left - this.hostGeometry.left, y: this.viewport().top - this.hostGeometry.top })
    .width(this.viewport().width)
    .height(this.viewport().height)
    .hitTestBehavior(HitTestMode.Transparent);
  }

  @Builder
  private phoneSheet(scrollChoices: boolean) {
    Column() {
      Row() {
        Blank()
          .width(36)
          .height(4)
          .borderRadius(2)
          .backgroundColor(readerAppColor('app.select.sheetHandle', this.appThemeScheme));
      }
      .width('100%')
      .height(24)
      .justifyContent(FlexAlign.Center)
      .alignItems(VerticalAlign.Center);

      Row() {
        Text(this.title())
          .fontFamily(TYPE_SETTINGS_SELECT_TITLE.fontFamily)
          .fontWeight(TYPE_SETTINGS_SELECT_TITLE.fontWeight)
          .fontSize(TYPE_SETTINGS_SELECT_TITLE.fontSizeFp)
          .lineHeight(TYPE_SETTINGS_SELECT_TITLE.lineHeightFp as number)
          .letterSpacing(TYPE_SETTINGS_SELECT_TITLE.letterSpacingFp as number)
          .fontColor(readerAppColor('app.text.heading', this.appThemeScheme));
      }
      .width('100%')
      .height(this.phoneTitleHeight())
      .padding({ left: 6, bottom: 12 })
      .alignItems(VerticalAlign.Top);

      if (scrollChoices) {
        Scroll() { this.phoneChoices(); }
          .width('100%').constraintSize({ maxHeight: this.phoneChoicesCapacity() }).scrollBar(BarState.Auto);
      } else {
        this.phoneChoices();
      }

      Blank().width('100%').height(PHONE_CANCEL_GAP);

      ForEach([this.selectionId], (identity: string) => {
        Button({ type: ButtonType.Normal, stateEffect: false }) {
          Text('取消')
            .fontFamily(TYPE_SETTINGS_SELECT_PHONE_CANCEL.fontFamily)
            .fontWeight(TYPE_SETTINGS_SELECT_PHONE_CANCEL.fontWeight)
            .fontSize(TYPE_SETTINGS_SELECT_PHONE_CANCEL.fontSizeFp)
            .lineHeight(TYPE_SETTINGS_SELECT_PHONE_CANCEL.lineHeightFp as number)
            .fontColor(readerAppColor('TOK_CONTROL_INK', this.appThemeScheme)).accessibilityLevel('no');
        }
        .width('100%')
        .id(typeof READER_LAYOUT_DEBUG_BUILD === 'boolean' && READER_LAYOUT_DEBUG_BUILD ? 'reader-settings-select-cancel' : '')
        .height(this.phoneCancelHeight())
        .padding(0)
        .border({ width: 1, color: readerAppColor('app.border.control', this.appThemeScheme) })
        .attributeModifier(new ReaderPressFeedback(this.panelMaterial('modalSheet').native ? Color.Transparent :
          readerAppColor('app.surface.menuSolid', this.appThemeScheme),
          this.appThemeScheme, PHONE_RADIUS, PHONE_RADIUS, this.ownsOpening(identity)))
        .accessibilityRole(AccessibilityRoleType.BUTTON).accessibilityText('取消')
        .onClick((): void => this.dismiss(identity));
      }, (identity: string): string => identity);
    }
    .width('100%')
    .padding({
      left: PHONE_HORIZONTAL_INSET,
      right: PHONE_HORIZONTAL_INSET,
      bottom: PHONE_BOTTOM_INSET,
    })
    .linearGradient(this.panelMaterial('modalSheet').native ? undefined : {
      angle: 180,
      colors: [[readerAppColor('app.surface.selectWarm', this.appThemeScheme), 0], [readerAppColor('app.surface.selectGradientEnd', this.appThemeScheme), 1]],
    })
    .borderRadius(PHONE_SHEET_CORNERS);
  }

  @Builder
  private phoneChoices() {
    Column({ space: 0 }) {
      ForEach(this.options, (option: string, index: number) => {
        this.phoneOption(option, index);
      }, (option: string): string => `settings-phone-option-${this.field}-${option}`);
    }.width('100%')
      .id(typeof READER_LAYOUT_DEBUG_BUILD === 'boolean' && READER_LAYOUT_DEBUG_BUILD ? 'reader-settings-select-options' : '')
      .backgroundColor(this.panelMaterial('modalSheet').native ? Color.Transparent :
        readerAppColor('app.surface.menuSolid', this.appThemeScheme))
      .border({ width: 1, color: readerAppColor('app.border.control', this.appThemeScheme) })
      .borderRadius(PHONE_RADIUS).clip(true);
  }

  @Builder
  private phoneOption(option: string, index: number) {
    ForEach([this.selectionId], (identity: string) => {
      ReaderChoiceRow({
        specId: 'settings-phone', wrapLabel: true, label: option, selected: this.isSelected(option),
        showDivider: index < this.options.length - 1, scheme: this.appThemeScheme,
        onChoose: (value: string): void => this.choose(value, identity),
      });
    }, (identity: string): string => identity);
  }

  @Builder
  private tabletPanel(identity: string) {
    Scroll() {
    Column() {
      ForEach(this.options, (option: string, index: number) => {
        this.tabletOption(option, index);
      }, (option: string): string => `settings-tablet-option-${this.field}-${option}`);
    }
    .width('100%')
      .id(typeof READER_LAYOUT_DEBUG_BUILD === 'boolean' && READER_LAYOUT_DEBUG_BUILD ? 'reader-settings-select-options' : '');
    }
    .width(this.tabletFrame().width).height(this.tabletFrame().height).scrollBar(BarState.Auto)
    .id(typeof READER_LAYOUT_DEBUG_BUILD === 'boolean' && READER_LAYOUT_DEBUG_BUILD ? `reader-settings-select-tablet:${this.field}` : '')
    .backgroundEffect(undefined)
    .backgroundColor(this.panelMaterial('popoverMenu').native ? Color.Transparent :
      readerAppColor(this.tabletSpec().surfaceBackgroundRole, this.appThemeScheme))
    .border(this.panelMaterial('popoverMenu').native ? { width: 0, color: Color.Transparent } :
      { width: this.tabletSpec().borderWidth, color: readerAppColor(this.tabletSpec().surfaceBorderRole, this.appThemeScheme) })
    .borderRadius(this.tabletSpec().borderRadius)
    .clip(true)
    .shadow(this.panelMaterial('popoverMenu').native ? undefined : readerSurfaceElevation('popover', this.appThemeScheme))
    .attributeModifier(new ReaderImmersiveMaterialModifier(this.panelMaterial('popoverMenu'),
      readerNativeSurfaceOutline(this.appThemeScheme, this.tabletSpec().borderRadius)))
    .position({
      x: this.tabletFrame().left - this.hostGeometry.left,
      y: this.tabletFrame().top - this.hostGeometry.top,
    }).transition(this.panelTransition(false), (entering: boolean): void => this.finishMotion(entering, identity));
  }

  @Builder
  private tabletOption(option: string, index: number) {
    ForEach([this.selectionId], (identity: string) => {
      ReaderChoiceRow({
        specId: 'settings-tablet', wrapLabel: true, minimumRowHeight: readerSettingsTabletOptionHeight(this.fontScale()),
        label: option, selected: this.isSelected(option),
        showDivider: index < this.options.length - 1, scheme: this.appThemeScheme,
        onChoose: (value: string): void => this.choose(value, identity),
      });
    }, (identity: string): string => identity);
  }

  private viewport(): ReaderRectVp {
    this.readerWindowMetricsRevision;
    const host = this.hostGeometry.width > 0 && this.hostGeometry.height > 0 ? this.hostGeometry : undefined;
    return readerOverlayViewport(ReaderWindowCoordinator.metrics(), host,
      this.expandedLayout ? new ReaderInsetsVp(8, 4, 8, 4) : undefined);
  }
  private phoneTitleHeight(): number {
    return readerScaledBarHeight(26, TYPE_SETTINGS_SELECT_TITLE.lineHeightFp as number, this.fontScale(), 0) + 12;
  }
  private phoneCancelHeight(): number {
    return readerScaledControlHeight(PHONE_OPTION_HEIGHT, TYPE_SETTINGS_SELECT_PHONE_CANCEL.lineHeightFp as number, this.fontScale());
  }
  private phoneChoicesCapacity(): number {
    return Math.max(0, this.viewport().height - 24 - this.phoneTitleHeight() - PHONE_CANCEL_GAP -
      PHONE_BOTTOM_INSET - this.phoneCancelHeight());
  }
  private tabletFrame(): ReaderRectVp {
    const spec = this.tabletSpec();
    const natural = readerOverlayListHeight(0, readerSettingsTabletOptionHeight(this.fontScale()), this.options.length,
      spec.dividerHeight, 0, 0, this.panelMaterial('popoverMenu').native ? 0 : spec.borderWidth, 0);
    return readerOverlayPanel(this.viewport(), spec.width, natural, 'anchor-end', this.anchorGeometry, spec.anchorOverlap);
  }

  private tabletSpec(): PopupSurfaceSpec {
    return resolvePopupSpec('settings-select-tablet');
  }

  private fontScale(): number {
    if (this.readerWindowMetricsRevision < 0) return 1;
    return readerReadableFontScale(ReaderWindowCoordinator.metrics().systemFontScale);
  }

  private isSelected(option: string): boolean {
    return option === this.value;
  }

  private title(): string {
    if (this.field === 'language') return '选择语言';
    if (this.field === 'renderMode') return '选择渲染模式';
    return '选择启动页';
  }
}
