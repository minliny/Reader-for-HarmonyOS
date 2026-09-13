import { readerAppColor } from '../common/ReaderThemeRegistry';
import { registerReaderFonts } from '../common/ReaderFonts';

export type SettingsSelectField = 'language' | 'startup' | 'animation';

const PHONE_HORIZONTAL_INSET = 14;
const PHONE_BOTTOM_INSET = 20;
const PHONE_OPTION_HEIGHT = 52;
const PHONE_CANCEL_GAP = 10;
const PHONE_RADIUS = 12;
const TABLET_PANEL_WIDTH = 160;
const TABLET_OPTION_HEIGHT = 42;
const TABLET_ANCHOR_GAP = 6;

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

  @Prop isTablet: boolean = false;
  @Prop field: SettingsSelectField = 'language';
  @Prop value: string = '';
  @Prop options: string[] = [];
  @Prop anchorRight: number = 0;
  @Prop anchorBottom: number = 0;
  onSelect: (option: string) => void = (_option: string): void => {};
  onDismiss: () => void = (): void => {};

  aboutToAppear(): void {
    registerReaderFonts(this.getUIContext().getFont());
  }

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      Row()
        .width('100%')
        .height('100%')
        .backgroundColor(this.isTablet ? Color.Transparent : readerAppColor('app.SettingsSelectOverlay.build.backgroundColor.521F1B17', this.appThemeScheme))
        .hitTestBehavior(HitTestMode.Default)
        .onClick((): void => this.onDismiss());

      if (this.isTablet) {
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
          .fontFamily('ReaderNotoSansSC')
          .fontWeight(FontWeight.Regular)
          .fontSize(12)
          .lineHeight(14.4)
          .letterSpacing(0.48)
          .fontColor(readerAppColor('app.SettingsSelectOverlay.phoneSheet.fontColor.FF1F1B17', this.appThemeScheme));
      }
      .width('100%')
      .height(26)
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

      Stack({ alignContent: Alignment.Center }) {
        Text('取消')
          .fontFamily('ReaderNotoSansSC')
          .fontWeight(FontWeight.Regular)
          .fontSize(15)
          .lineHeight(18)
          .fontColor(readerAppColor('app.SettingsSelectOverlay.phoneSheet.fontColor.FF41484C', this.appThemeScheme));
      }
      .width('100%')
      .height(PHONE_OPTION_HEIGHT)
      .backgroundColor(readerAppColor('app.SettingsSelectOverlay.phoneSheet.backgroundColor.FFFFFCF8', this.appThemeScheme))
      .border({ width: 1, color: readerAppColor('app.SettingsSelectOverlay.phoneSheet.color.FFC1C7CD', this.appThemeScheme) })
      .borderRadius(PHONE_RADIUS)
      .onClick((): void => this.onDismiss());
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
    Column() {
      Row() {
        Text(option)
          .layoutWeight(1)
          .fontFamily('ReaderNotoSansSC')
          .fontWeight(this.isSelected(option) ? FontWeight.Bold : FontWeight.Regular)
          .fontSize(15)
          .lineHeight(18)
          .fontColor(this.isSelected(option) ? readerAppColor('app.SettingsSelectOverlay.phoneOption.fontColor.FF2D4A3E', this.appThemeScheme) : readerAppColor('app.SettingsSelectOverlay.phoneOption.fontColor.FF1F1B17', this.appThemeScheme))
          .maxLines(1);
        if (this.isSelected(option)) {
          Image((this.appThemeScheme === 'night' ? $r('app.media.settings_select_check_theme_night') : $r('app.media.settings_select_check')))
            .width(16)
            .height(16);
        }
      }
      .width('100%')
      .height(index < this.options.length - 1 ? PHONE_OPTION_HEIGHT - 1 : PHONE_OPTION_HEIGHT)
      .padding({ left: 16, right: 16 })
      .alignItems(VerticalAlign.Center)
      .backgroundColor(this.isSelected(option) ? readerAppColor('app.SettingsSelectOverlay.phoneOption.backgroundColor.0D2D4A3E', this.appThemeScheme) : Color.Transparent)
      .onClick((): void => this.onSelect(option));

      if (index < this.options.length - 1) {
        Row() {
          Blank()
            .layoutWeight(1)
            .height(1)
            .backgroundColor(readerAppColor('app.SettingsSelectOverlay.phoneOption.backgroundColor.FFC1C7CD', this.appThemeScheme));
        }
          .width('100%')
          .height(1)
          .padding({ left: 16, right: 16 });
      }
    }
    .width('100%')
    .height(PHONE_OPTION_HEIGHT);
  }

  @Builder
  private tabletPanel() {
    Column() {
      ForEach(this.options, (option: string, index: number) => {
        this.tabletOption(option, index);
      }, (option: string): string => `settings-tablet-option-${this.field}-${option}`);
    }
    .width(TABLET_PANEL_WIDTH)
    .backgroundColor(readerAppColor('app.SettingsSelectOverlay.tabletPanel.backgroundColor.FFFAF7F2', this.appThemeScheme))
    .border({ width: 1, color: readerAppColor('app.SettingsSelectOverlay.tabletPanel.color.FFC1C7CD', this.appThemeScheme) })
    .borderRadius(10)
    .clip(true)
    .shadow({ radius: 24, color: readerAppColor('app.SettingsSelectOverlay.tabletPanel.color.1F1B171F', this.appThemeScheme), offsetX: 0, offsetY: 8 })
    .position({
      x: this.anchorRight - TABLET_PANEL_WIDTH,
      y: this.anchorBottom + TABLET_ANCHOR_GAP,
    });
  }

  @Builder
  private tabletOption(option: string, index: number) {
    Column() {
      Row() {
        Text(option)
          .layoutWeight(1)
          .fontFamily('ReaderNotoSansSC')
          .fontWeight(this.isSelected(option) ? FontWeight.Bold : FontWeight.Regular)
          .fontSize(14)
          .lineHeight(16.8)
          .fontColor(this.isSelected(option) ? readerAppColor('app.SettingsSelectOverlay.tabletOption.fontColor.FF2D4A3E', this.appThemeScheme) : readerAppColor('app.SettingsSelectOverlay.tabletOption.fontColor.FF1F1B17', this.appThemeScheme))
          .maxLines(1);
        if (this.isSelected(option)) {
          Image((this.appThemeScheme === 'night' ? $r('app.media.settings_select_check_theme_night') : $r('app.media.settings_select_check')))
            .width(14)
            .height(14);
        }
      }
      .width('100%')
      .height(index < this.options.length - 1 ? TABLET_OPTION_HEIGHT - 1 : TABLET_OPTION_HEIGHT)
      .padding({ left: 14, right: 14 })
      .alignItems(VerticalAlign.Center)
      .backgroundColor(this.isSelected(option) ? readerAppColor('app.SettingsSelectOverlay.tabletOption.backgroundColor.0F2D4A3E', this.appThemeScheme) : Color.Transparent)
      .onClick((): void => this.onSelect(option));

      if (index < this.options.length - 1) {
        Row() {
          Blank()
            .layoutWeight(1)
            .height(1)
            .backgroundColor(readerAppColor('app.SettingsSelectOverlay.tabletOption.backgroundColor.FFC1C7CD', this.appThemeScheme));
        }
          .width('100%')
          .height(1)
          .padding({ left: 14, right: 14 });
      }
    }
    .width('100%')
    .height(TABLET_OPTION_HEIGHT);
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
