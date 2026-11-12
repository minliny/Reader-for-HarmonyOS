import { readerWindowMetrics } from '../../../ui/foundation/ReaderWindowEnvironment';
import { readerInteractiveSafeLeft, readerInteractiveSafeRight, readerInteractiveSafeTop, readerInteractiveSafeBottom } from '../../../ui/foundation/ReaderWindowMetrics';
import { readerPageAreaLength } from '../../../ui/layout/ReaderPageShell';
import { ReaderChoiceRow } from '../../../ui/controls/ReaderChoiceRow';
import { readerAppColor } from '../../../ui/foundation/ReaderThemeRegistry';
import { registerReaderFonts } from '../../../ui/foundation/ReaderFonts';
import {
  TYPE_SETTINGS_SELECT_PHONE_CANCEL,
  TYPE_SETTINGS_SELECT_TITLE,
} from '../../../ui/foundation/ReaderTypography';
import { PopupSurfaceSpec, resolvePopupSpec } from '../../../ui/surfaces/ReaderSurfaceSpecs';
import { readerReadableFontScale, readerScaledControlHeight } from '../../../ui/foundation/ReaderSurfaceResolvers';
import { ReaderWindowCoordinator } from '../../../app/ReaderWindowCoordinator';

export type SettingsSelectField = 'language' | 'startup' | 'animation';

const PHONE_HORIZONTAL_INSET = 14;
const PHONE_BOTTOM_INSET = 20;
const PHONE_OPTION_HEIGHT = 52;
const PHONE_CANCEL_GAP = 10;
const PHONE_RADIUS = 12;

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
  @StorageLink('readerWindowMetricsRevision') private readerWindowMetricsRevision: number = 0;

  @Prop expandedLayout: boolean = false;
  @Prop @Watch('onFieldChanged') field: SettingsSelectField = 'language';
  @Prop @Watch('onFieldChanged') selectionId: string = '';
  @Prop value: string = '';
  @Prop options: string[] = [];
  @Prop anchorRight: number = 0;
  @Prop anchorBottom: number = 0;
  onSelect: (option: string, identity?: string) => void = (_option: string, _identity?: string): void => {};
  onDismiss: (identity?: string) => void = (_identity?: string): void => {};

  @State private hostWidth: number = 0;
  @State private hostHeight: number = 0;
  @State private hostX: number = 0;
  @State private hostY: number = 0;
  private mounted: boolean = false;
  private closed: boolean = false;

  aboutToAppear(): void {
    this.mounted = true;
    this.closed = false;
    registerReaderFonts(this.getUIContext().getFont());
  }

  aboutToDisappear(): void { this.mounted = false; this.closed = true; }

  private onFieldChanged(): void { this.closed = false; }
  private ownsOpening(identity: string): boolean {
    return this.mounted && !this.closed && identity.length > 0 && identity === this.selectionId;
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

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      ForEach([this.selectionId], (identity: string) => {
        Row()
          .width('100%')
          .height('100%')
          .backgroundColor(this.expandedLayout ? Color.Transparent : readerAppColor('app.scrim.select', this.appThemeScheme))
          .hitTestBehavior(HitTestMode.Default)
          .onClick((): void => this.dismiss(identity));
      }, (identity: string): string => identity);

      if (this.expandedLayout) {
        this.tabletPanel();
      } else {
        Stack({ alignContent: Alignment.Bottom }) {
          Scroll() { this.phoneSheet(); }
            .width('100%').constraintSize({ maxHeight: this.safeHeight() }).scrollBar(BarState.Auto).clip(true);
        }
        .position({ x: this.safeLeft(), y: this.safeTop() })
        .width(this.safeWidth())
        .height(this.safeHeight())
        .hitTestBehavior(HitTestMode.Transparent);
      }
    }
    .width('100%')
    .height('100%')
    .onAreaChange((_old: Area, next: Area): void => {
      if (!this.mounted) return;
      this.hostWidth = readerPageAreaLength(next.width); this.hostHeight = readerPageAreaLength(next.height);
      this.hostX = readerPageAreaLength(next.globalPosition.x); this.hostY = readerPageAreaLength(next.globalPosition.y);
    })
    .zIndex(30);
  }

  @Builder
  private phoneSheet() {
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
      .constraintSize({ minHeight: readerScaledControlHeight(26, TYPE_SETTINGS_SELECT_TITLE.lineHeightFp as number, this.fontScale()) })
      .padding({ left: 6, bottom: 12 })
      .alignItems(VerticalAlign.Top);

      Column() {
        ForEach(this.options, (option: string, index: number) => {
          this.phoneOption(option, index);
        }, (option: string): string => `settings-phone-option-${this.field}-${option}`);
      }
      .width('100%')
      .backgroundColor(readerAppColor('app.surface.menuSolid', this.appThemeScheme))
      .border({ width: 1, color: readerAppColor('app.border.control', this.appThemeScheme) })
      .borderRadius(PHONE_RADIUS)
      .clip(true);

      Blank().width('100%').height(PHONE_CANCEL_GAP);

      ForEach([this.selectionId], (identity: string) => {
        Stack({ alignContent: Alignment.Center }) {
          Text('取消')
            .fontFamily(TYPE_SETTINGS_SELECT_PHONE_CANCEL.fontFamily)
            .fontWeight(TYPE_SETTINGS_SELECT_PHONE_CANCEL.fontWeight)
            .fontSize(TYPE_SETTINGS_SELECT_PHONE_CANCEL.fontSizeFp)
            .lineHeight(TYPE_SETTINGS_SELECT_PHONE_CANCEL.lineHeightFp as number)
            .fontColor(readerAppColor('TOK_CONTROL_INK', this.appThemeScheme));
        }
        .width('100%')
        .height(readerScaledControlHeight(PHONE_OPTION_HEIGHT, TYPE_SETTINGS_SELECT_PHONE_CANCEL.lineHeightFp as number, this.fontScale()))
        .backgroundColor(readerAppColor('app.surface.menuSolid', this.appThemeScheme))
        .border({ width: 1, color: readerAppColor('app.border.control', this.appThemeScheme) })
        .borderRadius(PHONE_RADIUS)
        .onClick((): void => this.dismiss(identity));
      }, (identity: string): string => identity);
    }
    .width('100%')
    .padding({
      left: PHONE_HORIZONTAL_INSET,
      right: PHONE_HORIZONTAL_INSET,
      bottom: PHONE_BOTTOM_INSET,
    })
    .linearGradient({
      angle: 180,
      colors: [[readerAppColor('app.surface.selectWarm', this.appThemeScheme), 0], [readerAppColor('app.surface.selectGradientEnd', this.appThemeScheme), 1]],
    })
    .borderRadius({ topLeft: 18, topRight: 18 })
    .shadow({ radius: 40, color: readerAppColor('app.shadow.selectPanel', this.appThemeScheme), offsetX: 0, offsetY: -8 });
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
  private tabletPanel() {
    Scroll() {
    Column() {
      ForEach(this.options, (option: string, index: number) => {
        this.tabletOption(option, index);
      }, (option: string): string => `settings-tablet-option-${this.field}-${option}`);
    }
    .width('100%');
    }
    .width(this.tabletWidth()).constraintSize({ maxHeight: Math.max(0, this.safeTop() + this.safeHeight() - this.tabletTop()) }).scrollBar(BarState.Auto)
    .backgroundColor(readerAppColor(this.tabletSpec().surfaceBackgroundRole, this.appThemeScheme))
    .border({ width: this.tabletSpec().borderWidth, color: readerAppColor(this.tabletSpec().surfaceBorderRole, this.appThemeScheme) })
    .borderRadius(this.tabletSpec().borderRadius)
    .clip(true)
    .shadow({ radius: this.tabletSpec().shadowRadius, color: readerAppColor(this.tabletSpec().surfaceShadowRole, this.appThemeScheme), offsetX: 0, offsetY: this.tabletSpec().shadowOffsetY })
    .position({
      x: Math.max(this.safeLeft(), Math.min(this.anchorRight - this.tabletWidth(), this.safeLeft() + this.safeWidth() - this.tabletWidth())),
      y: this.tabletTop(),
    });
  }

  @Builder
  private tabletOption(option: string, index: number) {
    ForEach([this.selectionId], (identity: string) => {
      ReaderChoiceRow({
        specId: 'settings-tablet', wrapLabel: true, label: option, selected: this.isSelected(option),
        showDivider: index < this.options.length - 1, scheme: this.appThemeScheme,
        onChoose: (value: string): void => this.choose(value, identity),
      });
    }, (identity: string): string => identity);
  }

  private safeLeft(): number { return Math.max(0, readerInteractiveSafeLeft(readerWindowMetrics(), true) - this.hostX); }
  private safeTop(): number { return Math.max(0, readerInteractiveSafeTop(readerWindowMetrics(), true) - this.hostY); }
  private safeWidth(): number {
    const metrics = readerWindowMetrics();
    return Math.max(0, Math.min(this.hostWidth > 0 ? this.hostWidth : metrics.windowRect.width,
      metrics.windowRect.width - readerInteractiveSafeRight(metrics, true) - this.hostX) - this.safeLeft());
  }
  private safeHeight(): number {
    if (this.readerWindowMetricsRevision < 0) return 0;
    const metrics = readerWindowMetrics();
    return Math.max(0, Math.min(this.hostHeight > 0 ? this.hostHeight : metrics.windowRect.height,
      metrics.windowRect.height - readerInteractiveSafeBottom(metrics, true) - this.hostY) - this.safeTop());
  }
  private tabletWidth(): number { return Math.min(this.tabletSpec().width, this.safeWidth()); }
  private tabletTop(): number {
    const natural = this.options.length * readerScaledControlHeight(52, 20, this.fontScale());
    const height = Math.min(this.safeHeight(), natural);
    return Math.max(this.safeTop(), Math.min(this.anchorBottom + this.tabletSpec().anchorOverlap,
      this.safeTop() + this.safeHeight() - height));
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
    if (this.field === 'language') {
      return '选择语言';
    }
    if (this.field === 'startup') {
      return '选择启动页';
    }
    return '选择动画效果';
  }
}
