import {
  isReaderNativeChromeStyle,
  type ReaderNavigationOverride,
  type ReaderNavigationPreferenceChange,
  type ReaderNavigationPreferences,
  type ReaderRenderMode,
} from '../../../app/HarmonyCapabilityPolicy';
import { ReaderFormRow } from '../../../ui/controls/ReaderFormRow';
import { ReaderToggle } from '../../../ui/controls/ReaderToggle';
import { readerAppColor } from '../../../ui/foundation/ReaderThemeRegistry';
import { TYPE_SELECT_DEFAULT_VALUE } from '../../../ui/foundation/ReaderTypography';
import { ReaderRectVp } from '../../../ui/foundation/ReaderWindowMetrics';
import { readerPageAreaLength } from '../../../ui/layout/ReaderPageShell';
import { defaultNavigationPreferences } from '../../../ui/surfaces/ReaderSurfaceMaterial';

export function readerRenderModeLabel(mode: ReaderRenderMode): string {
  return mode === 'performance' ? '性能优先' : '效果优先';
}

@Component
export struct NavigationAppearanceSettings {
  @StorageProp('readerNavigationAppearancePreferences')
  private preferences: ReaderNavigationPreferences = defaultNavigationPreferences();
  @StorageProp('readerAppScheme') private appScheme: string = 'day';
  @Prop generation: number = 0;
  @Prop actionEnabled: boolean = false;
  onChange: (change: ReaderNavigationPreferenceChange, generation: number) => void =
    (_change: ReaderNavigationPreferenceChange, _generation: number): void => {};
  onOpenRenderMode: (generation: number) => void = (_generation: number): void => {};
  onRenderModeAnchor: (anchor: ReaderRectVp) => void = (_anchor: ReaderRectVp): void => {};

  build() {
    ForEach([this.generation], (generation: number): void => {
      Column() {
        ReaderFormRow({
          label: '系统原生外观',
          secondaryText: this.appearanceSummary(),
          actionEnabled: this.nativeToggleEnabled(),
          onLabelAction: (): void => this.toggleOverride(generation),
        }) {
          ReaderToggle({
            value: this.nativeToggleValue(),
            specId: 'standard-toggle',
            inputIdentity: `navigation-appearance:${generation}`,
            accessibilityLabel: '系统原生外观',
            actionEnabled: this.nativeToggleEnabled(),
            onToggle: (enabled: boolean): void => this.selectOverride(enabled ? 'systemNative' : 'unset', generation),
          });
        }
        Stack() {
          ReaderFormRow({
            label: '渲染模式',
            secondaryText: this.preferences.renderMode === 'quality' ?
              '启用实时模糊与可用的原生材质' : '使用实色界面，关闭实时模糊与原生材质',
            disclosure: true,
            actionEnabled: this.actionEnabled,
            onAction: (): void => this.onOpenRenderMode(generation),
          }) {
            Text(readerRenderModeLabel(this.preferences.renderMode))
              .fontFamily(TYPE_SELECT_DEFAULT_VALUE.fontFamily)
              .fontWeight(TYPE_SELECT_DEFAULT_VALUE.fontWeight)
              .fontSize(TYPE_SELECT_DEFAULT_VALUE.fontSizeFp)
              .lineHeight(TYPE_SELECT_DEFAULT_VALUE.lineHeightFp as number)
              .halfLeading(true)
              .fontColor(readerAppColor('TOK_PRIMARY_DARK', this.appScheme))
              .flexShrink(0);
          }
        }.width('100%')
          .onAreaChange((_old: Area, next: Area): void => {
            this.onRenderModeAnchor(new ReaderRectVp(
              readerPageAreaLength(next.globalPosition.x),
              readerPageAreaLength(next.globalPosition.y),
              readerPageAreaLength(next.width),
              readerPageAreaLength(next.height),
            ));
          });
      }.width('100%');
    }, (generation: number): string => generation.toString());
  }

  private nativeToggleEnabled(): boolean {
    return this.actionEnabled;
  }

  private nativeToggleValue(): boolean {
    return isReaderNativeChromeStyle(this.preferences);
  }

  private appearanceSummary(): string {
    if (isReaderNativeChromeStyle(this.preferences)) {
      return this.preferences.renderMode === 'performance' ?
        '原生无框顶栏、实底浮层与整页搜索' : '原生无框顶栏、原生/雾面浮层与整页搜索';
    }
    return '关闭时使用统一实底栏与弹窗；开启后启用无框顶栏、原生材质与整页搜索';
  }

  private toggleOverride(generation: number): void {
    if (!this.nativeToggleEnabled()) return;
    this.selectOverride(this.nativeToggleValue() ? 'unset' : 'systemNative', generation);
  }

  private selectOverride(override: ReaderNavigationOverride, generation: number): void {
    if (override !== this.preferences.override) this.onChange({ override }, generation);
  }
}
