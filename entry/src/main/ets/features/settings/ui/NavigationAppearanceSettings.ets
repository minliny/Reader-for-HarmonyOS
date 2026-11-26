import type {
  ReaderNavigationOverride, ReaderNavigationPreferenceChange, ReaderNavigationPreferences, ReaderRenderMode,
} from '../../../app/HarmonyCapabilityPolicy';
import { ReaderFormRow } from '../../../ui/controls/ReaderFormRow';
import { ReaderSegmentedControl, READER_APP_THEME_SEGMENT_WIDTH } from '../../../ui/controls/ReaderSegmentedControl';
import { defaultNavigationPreferences, readerSurfaceMaterialDecision } from '../../../ui/surfaces/ReaderSurfaceMaterial';

const OVERRIDES: ReaderNavigationOverride[] = ['unset', 'systemNative'];
const RENDER_MODES: ReaderRenderMode[] = ['quality', 'performance'];

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

  build() {
    ForEach([this.generation], (generation: number): void => {
      Column() {
        ReaderFormRow({ label: '界面外观', contentMinWidth: READER_APP_THEME_SEGMENT_WIDTH,
          secondaryText: this.appearanceSummary() }) {
          ReaderSegmentedControl({
            specId: 'app-theme-segment', options: ['默认', '原生'],
            optionIds: OVERRIDES, selectedIndex: OVERRIDES.indexOf(this.preferences.override),
            accessibilityLabel: '界面外观', inputIdentity: `navigation-appearance:${generation}`,
            actionEnabled: this.actionEnabled,
            onSelect: (index: number): void => this.selectOverride(index, generation),
          });
        }
        ReaderFormRow({ label: '渲染模式', contentMinWidth: READER_APP_THEME_SEGMENT_WIDTH,
          secondaryText: this.preferences.renderMode === 'quality' ? '启用实时模糊与可用的原生材质' : '使用实色界面，关闭实时模糊与原生材质' }) {
          ReaderSegmentedControl({
            specId: 'app-theme-segment', options: ['效果优先', '性能优先'],
            optionIds: RENDER_MODES, selectedIndex: RENDER_MODES.indexOf(this.preferences.renderMode),
            accessibilityLabel: '渲染模式', inputIdentity: `render-mode:${generation}`,
            actionEnabled: this.actionEnabled,
            onSelect: (index: number): void => this.selectRenderMode(index, generation),
          });
        }
      }.width('100%');
    }, (generation: number): string => generation.toString());
  }

  private appearanceSummary(): string {
    if (this.preferences.override !== 'systemNative') return '';
    if (this.preferences.renderMode === 'performance') return '性能优先模式下沿用默认外观';
    return readerSurfaceMaterialDecision('chromeBar', this.preferences, this.appScheme, this.systemScheme).native ?
      '' : '当前系统或主题下沿用默认外观';
  }

  private selectOverride(index: number, generation: number): void {
    const override = OVERRIDES[index];
    if (override !== undefined && override !== this.preferences.override) this.onChange({ override }, generation);
  }

  private selectRenderMode(index: number, generation: number): void {
    const renderMode = RENDER_MODES[index];
    if (renderMode !== undefined && renderMode !== this.preferences.renderMode) this.onChange({ renderMode }, generation);
  }
}
