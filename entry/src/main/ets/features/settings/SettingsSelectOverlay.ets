import { ReaderChoiceRow } from '../common/ReaderChoiceRow';
import { readerAppColor } from '../common/ReaderThemeRegistry';
import { registerReaderFonts } from '../common/ReaderFonts';
import {
  TYPE_SETTINGS_SELECT_PHONE_CANCEL,
  TYPE_SETTINGS_SELECT_TITLE,
} from '../common/ReaderTypography';
import { PopupSurfaceSpec, resolvePopupSpec } from '../common/ReaderSurfaceSpecs';
import { readerReadableFontScale, readerScaledControlHeight } from '../common/ReaderSurfaceResolvers';
import { ReaderWindowCoordinator } from '../../app/ReaderWindowCoordinator';

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
          .backgroundColor(this.expandedLayout ? Color.Transparent : readerAppColor('app.SettingsSelectOverlay.build.backgroundColor.521F1B17', this.appThemeScheme))
          .hitTestBehavior(HitTestMode.Default)
          .onClick((): void => this.dismiss(identity));
      }, (identity: string): string => identity);

      if (this.expandedLayout) {
        this.tabletPanel();
      } else {
        Stack({ alignContent: Alignment.Bottom }) {
          this.phoneSheet();
        }
        .width('100%')
        .height('100%')
        .hitTestBehavior(HitTestMode.Transparent);
      }
    }
    .width('100%')
    .height('100%')
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
          .backgroundColor(readerAppColor('app.SettingsSelectOverlay.phoneSheet.backgroundColor.381F1B17', this.appThemeScheme));
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
          .fontColor(readerAppColor('app.SettingsSelectOverlay.phoneSheet.fontColor.FF1F1B17', this.appThemeScheme));
      }
      .width('100%')
      .height(readerScaledControlHeight(26, TYPE_SETTINGS_SELECT_TITLE.lineHeightFp as number, this.fontScale()))
      .padding({ left: 6, bottom: 12 })
      .alignItems(VerticalAlign.Top);

      Column() {
        ForEach(this.options, (option: string, index: number) => {
          this.phoneOption(option, index);
        }, (option: string): string => `settings-phone-option-${this.field}-${option}`);
      }
      .width('100%')
      .backgroundColor(readerAppColor('app.SettingsSelectOverlay.phoneSheet.backgroundColor.FFFFFCF8', this.appThemeScheme))
      .border({ width: 1, color: readerAppColor('app.SettingsSelectOverlay.phoneSheet.color.FFC1C7CD', this.appThemeScheme) })
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
            .fontColor(readerAppColor('app.SettingsSelectOverlay.phoneSheet.fontColor.FF41484C', this.appThemeScheme));
        }
        .width('100%')
        .height(readerScaledControlHeight(PHONE_OPTION_HEIGHT, TYPE_SETTINGS_SELECT_PHONE_CANCEL.lineHeightFp as number, this.fontScale()))
        .backgroundColor(readerAppColor('app.SettingsSelectOverlay.phoneSheet.backgroundColor.FFFFFCF8', this.appThemeScheme))
        .border({ width: 1, color: readerAppColor('app.SettingsSelectOverlay.phoneSheet.color.FFC1C7CD', this.appThemeScheme) })
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
      colors: [[readerAppColor('app.SettingsSelectOverlay.phoneSheet.linearGradient.FFFAF7F2', this.appThemeScheme), 0], [readerAppColor('app.SettingsSelectOverlay.phoneSheet.linearGradient.FFF5F0E8', this.appThemeScheme), 1]],
    })
    .borderRadius({ topLeft: 18, topRight: 18 })
    .shadow({ radius: 40, color: readerAppColor('app.SettingsSelectOverlay.phoneSheet.color.1F1B171F', this.appThemeScheme), offsetX: 0, offsetY: -8 });
  }

  @Builder
  private phoneOption(option: string, index: number) {
    ForEach([this.selectionId], (identity: string) => {
      ReaderChoiceRow({
        specId: 'settings-phone', label: option, selected: this.isSelected(option),
        showDivider: index < this.options.length - 1, scheme: this.appThemeScheme,
        onChoose: (value: string): void => this.choose(value, identity),
      });
    }, (identity: string): string => identity);
  }

  @Builder
  private tabletPanel() {
    Column() {
      ForEach(this.options, (option: string, index: number) => {
        this.tabletOption(option, index);
      }, (option: string): string => `settings-tablet-option-${this.field}-${option}`);
    }
    .width(this.tabletSpec().width)
    .backgroundColor(readerAppColor(this.tabletSpec().surfaceBackgroundRole, this.appThemeScheme))
    .border({ width: this.tabletSpec().borderWidth, color: readerAppColor(this.tabletSpec().surfaceBorderRole, this.appThemeScheme) })
    .borderRadius(this.tabletSpec().borderRadius)
    .clip(true)
    .shadow({ radius: this.tabletSpec().shadowRadius, color: readerAppColor(this.tabletSpec().surfaceShadowRole, this.appThemeScheme), offsetX: 0, offsetY: this.tabletSpec().shadowOffsetY })
    .position({
      x: this.anchorRight - this.tabletSpec().width,
      y: this.anchorBottom + this.tabletSpec().anchorOverlap,
    });
  }

  @Builder
  private tabletOption(option: string, index: number) {
    ForEach([this.selectionId], (identity: string) => {
      ReaderChoiceRow({
        specId: 'settings-tablet', label: option, selected: this.isSelected(option),
        showDivider: index < this.options.length - 1, scheme: this.appThemeScheme,
        onChoose: (value: string): void => this.choose(value, identity),
      });
    }, (identity: string): string => identity);
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
