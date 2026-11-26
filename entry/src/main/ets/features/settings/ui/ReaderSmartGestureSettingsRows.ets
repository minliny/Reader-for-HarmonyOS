import { ReaderSmartGesturePreferences } from '../../../app/ReaderSmartGesturePreferences';
import { DEFAULT_READER_SMART_GESTURES, type ReaderSmartGestureSettings, type ReaderSmartTapAction } from
  '../../reading/application/ReaderSmartGesturePolicy';
import { ReaderFormRow } from '../../../ui/controls/ReaderFormRow';
import { ReaderSegmentedControl, READER_APP_THEME_SEGMENT_WIDTH } from '../../../ui/controls/ReaderSegmentedControl';
import { ReaderToggle } from '../../../ui/controls/ReaderToggle';

const TAP_ACTIONS: ReaderSmartTapAction[] = ['next', 'toggleControls', 'none'];

@Component
export struct ReaderSmartGestureSettingsRows {
  @StorageLink('readerSmartGestureSettings') private settings: ReaderSmartGestureSettings = DEFAULT_READER_SMART_GESTURES;
  @Prop generation: number = 0;
  @State private saving: boolean = false;
  inputCurrent: () => boolean = (): boolean => false;
  onFailure: () => void = (): void => {};
  private mounted: boolean = false;

  aboutToAppear(): void { this.mounted = true; }
  aboutToDisappear(): void { this.mounted = false; }

  build() {
    Column() {
      ReaderFormRow({ label: '智慧手势', secondaryText: '在沉浸阅读时使用系统智慧手势',
        actionEnabled: this.current(this.generation) && !this.saving,
        onLabelAction: (): void => { void this.save({ enabled: !this.settings.enabled,
          tapAction: this.settings.tapAction }, this.generation); } }) {
        ReaderToggle({ value: this.settings.enabled, accessibilityLabel: '智慧手势',
          inputIdentity: `smart-gestures:${this.generation}`,
          actionEnabled: this.current(this.generation) && !this.saving,
          onToggle: (enabled: boolean): void => { void this.save({ enabled, tapAction: this.settings.tapAction },
            this.generation); } });
      }
      if (this.settings.enabled) {
        ReaderFormRow({ label: '敲一敲', contentMinWidth: READER_APP_THEME_SEGMENT_WIDTH }) {
          ReaderSegmentedControl({ specId: 'app-theme-segment', options: ['下一页', '控制栏', '无动作'],
            optionIds: TAP_ACTIONS, selectedIndex: TAP_ACTIONS.indexOf(this.settings.tapAction),
            accessibilityLabel: '敲一敲', inputIdentity: `smart-gesture-tap:${this.generation}`,
            actionEnabled: this.current(this.generation) && !this.saving,
            onSelect: (index: number): void => {
              const tapAction = TAP_ACTIONS[index];
              if (tapAction !== undefined) void this.save({ enabled: true, tapAction }, this.generation);
            },
          });
        }
      }
    }.width('100%');
  }

  private current(generation: number): boolean {
    return this.mounted && generation === this.generation && this.inputCurrent();
  }

  private async save(settings: ReaderSmartGestureSettings, generation: number): Promise<void> {
    if (!this.current(generation) || this.saving) return;
    this.saving = true;
    try {
      await ReaderSmartGesturePreferences.select(settings, (): boolean => this.current(generation));
    } catch (_) {
      if (this.current(generation)) this.onFailure();
    } finally {
      this.saving = false;
    }
  }
}
