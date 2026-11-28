import type {
  ReaderNavigationOverride, ReaderNavigationPreferenceChange, ReaderNavigationPreferences, ReaderRenderMode,
} from '../../../app/HarmonyCapabilityPolicy';
import { ReaderFormRow } from '../../../ui/controls/ReaderFormRow';
import { ReaderToggle } from '../../../ui/controls/ReaderToggle';
import { readerAppColor } from '../../../ui/foundation/ReaderThemeRegistry';
import { TYPE_SELECT_DEFAULT_VALUE } from '../../../ui/foundation/ReaderTypography';
import { ReaderRectVp } from '../../../ui/foundation/ReaderWindowMetrics';
import { readerPageAreaLength } from '../../../ui/layout/ReaderPageShell';
import { defaultNavigationPreferences, readerSurfaceMaterialDecision } from '../../../ui/surfaces/ReaderSurfaceMaterial';

export function readerRenderModeLabel(mode: ReaderRenderMode): string {
  return mode === 'performance' ? '性能优先' : '效果优先';
}

@Component
export struct NavigationAppearanceSettings {
  @StorageProp('readerNavigationAppearancePreferences')
  private preferences: ReaderNavigationPreferences = defaultNavigationPreferences();
  @StorageProp('readerAppScheme') private appScheme: string = 'day';
  @StorageProp('readerSystemScheme') private systemScheme: string = 'day';
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
    return this.actionEnabled && this.preferences.renderMode !== 'performance';
  }

  private nativeToggleValue(): boolean {
    return this.preferences.override === 'systemNative' && this.preferences.renderMode !== 'performance';
  }

  private appearanceSummary(): string {
    if (this.preferences.renderMode === 'performance') return '性能优先模式下沿用默认外观';
    if (this.preferences.override === 'systemNative' &&
      !readerSurfaceMaterialDecision('chromeBar', this.preferences, this.appScheme, this.systemScheme).native) {
      return '当前系统或主题下沿用默认外观';
    }
    return '导航栏与浮层优先使用系统材质';
  }

  private toggleOverride(generation: number): void {
    if (!this.nativeToggleEnabled()) return;
    this.selectOverride(this.nativeToggleValue() ? 'unset' : 'systemNative', generation);
  }

  private selectOverride(override: ReaderNavigationOverride, generation: number): void {
    if (override !== this.preferences.override) this.onChange({ override }, generation);
  }
}
