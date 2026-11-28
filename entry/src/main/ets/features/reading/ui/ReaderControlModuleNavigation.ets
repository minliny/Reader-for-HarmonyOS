import { ReaderActionAccessibility } from '../../../ui/controls/ReaderActionAccessibility';
import { readerPressOpacity, readerPressScale, readerPressSurface } from '../../../ui/foundation/ReaderPressMotion';
import { readerAppColor } from '../../../ui/foundation/ReaderThemeRegistry';
import { TOK_BORDER_W, TOK_RADIUS_LG } from '../../../ui/foundation/ReaderTokens';
import { TYPE_READER_CONTROL_SOURCE_ACTION, TYPE_READER_CONTROLS_RETAINED_MODULE_BUTTON_LABEL } from '../../../ui/foundation/ReaderTypography';

export type ReaderControlNavigationModule = 'autoPage' | 'tts' | 'appearance' | 'settings';

/** Renders the existing module action strip from the panel's current frame. */
@Component
export struct ReaderControlModuleNavigation {
  @Prop appScheme: string = 'day';
  @Prop activeModule: string = '';
  @Prop navHeight: number = 0;
  @Prop topRadius: number = 0;
  @Prop labelHeight: number = 13.889;
  @Prop hasMeasuredProfile: boolean = false;
  @Prop ttsUnavailable: boolean = false;
  @Link quickOrModulePress: string;
  @Prop reduceMotion: boolean = false;
  @Prop actionEnabled: boolean = false;
  @Prop actionScope: string = '';
  onModulePress: (event: TouchEvent, module: ReaderControlNavigationModule) => void =
    (_event: TouchEvent, _module: ReaderControlNavigationModule): void => {};
  // Rebind the panel's guard when its presented action scope changes.
  moduleClickHandler: (module: ReaderControlNavigationModule, scope: string) => () => void =
    (_module: ReaderControlNavigationModule, _scope: string): (() => void) => (): void => {};

  build() {
    Row({ space: 4 }) {
      this.moduleButton('rc_autopage', '翻页', 'autoPage');
      this.moduleButton('rc_headphones', '朗读', 'tts');
      this.moduleButton('rc_palette', '界面', 'appearance');
      this.moduleButton('rc_settings', '设置', 'settings');
    }
    .width('100%')
    .height(this.navHeight)
    .padding({ left: 6, right: 6, top: 6, bottom: 6 })
    .backgroundColor(readerAppColor('TOK_SURFACE_SOLID_OPAQUE', this.appScheme))
    .border({ width: TOK_BORDER_W, color: readerAppColor('TOK_LINE', this.appScheme) })
    .borderRadius(TOK_RADIUS_LG);
  }

  @Builder
  private moduleButton(icon: string, label: string, module: ReaderControlNavigationModule) {
    Button({ type: ButtonType.Normal, stateEffect: false }) {
    Column() {
      Stack({ alignContent: Alignment.Center }) {
        Image($r(`app.media.${this.moduleIcon(icon, module)}`))
          .width(20)
          .height(20).accessibilityLevel('no');
      }
      .width(42)
      .height(42)
      .backgroundColor(readerPressSurface(readerAppColor(this.isActiveModule(module) ? 'TOK_READ_PRIMARY' : 'TOK_SURFACE_PANEL_SOFT', this.appScheme),
        this.appScheme, this.quickOrModulePress === module, this.reduceMotion))
      .borderRadius(21).scale(readerPressScale(this.quickOrModulePress === module, this.reduceMotion))
      .opacity(readerPressOpacity(this.quickOrModulePress === module, this.reduceMotion));

      // Original Make V17 navigation uses Black 10/13.889; the complete bundled Sans face owns its 900 axis.
      Text(label)
        .width('100%')
        .height(this.labelHeight)
        .fontFamily(TYPE_READER_CONTROLS_RETAINED_MODULE_BUTTON_LABEL.fontFamily)
        .fontWeight(TYPE_READER_CONTROLS_RETAINED_MODULE_BUTTON_LABEL.fontWeight, { enableVariableFontWeight: true })
        .fontSize(TYPE_READER_CONTROL_SOURCE_ACTION.fontSizeFp)
        .lineHeight(TYPE_READER_CONTROLS_RETAINED_MODULE_BUTTON_LABEL.lineHeightFp as number)
        .halfLeading(true)
        .fontColor(this.isActiveModule(module) ? readerAppColor('TOK_READ_PRIMARY', this.appScheme) : readerAppColor('TOK_READ_ICON', this.appScheme))
        .textAlign(TextAlign.Center)
        .maxLines(!this.hasMeasuredProfile ? 1 : undefined)
        .accessibilityLevel('no')
        .margin({ top: 3 });
    }.width('100%').height('100%').alignItems(HorizontalAlign.Center).justifyContent(FlexAlign.Center);
    }
    .layoutWeight(1)
    .id('reader-control-entry-' + module)
    .height(64 + this.labelHeight - 13.889)
    .padding(0).backgroundColor(Color.Transparent)
    .borderRadius(12)
    .opacity(module === 'tts' && this.ttsUnavailable ? 0.72 : 1)
    .attributeModifier(new ReaderActionAccessibility(label, this.actionEnabled, this.isActiveModule(module), true, undefined, 'nativeButton'))
    .onTouch((event: TouchEvent): void => this.onModulePress(event, module))
    .onClick(this.moduleClickHandler(module, this.actionScope));
  }

  private isActiveModule(module: string): boolean { return this.activeModule === module; }

  private moduleIcon(icon: string, module: string): string {
    const night = this.appScheme === 'night';
    if (module === 'autoPage') return this.isActiveModule(module) ?
      (night ? 'reader_autopage_nav_active_theme_night' : 'reader_autopage_nav_active') :
      (night ? 'rc_autopage_theme_night' : icon);
    if (module === 'tts') return this.isActiveModule(module) ?
      (night ? 'reader_tts_nav_active_theme_night' : 'reader_tts_nav_active') :
      (night ? 'rc_headphones_theme_night' : icon);
    if (module === 'appearance') return this.isActiveModule(module) ?
      (night ? 'reader_appearance_nav_active_theme_night' : 'reader_appearance_nav_active') :
      (night ? 'rc_palette_theme_night' : icon);
    if (module === 'settings') return this.isActiveModule(module) ?
      (night ? 'reader_settings_nav_active_theme_night' : 'reader_settings_nav_active') :
      (night ? 'rc_settings_theme_night' : icon);
    return icon;
  }
}
