import { ReaderNavigationAppearancePreferences } from '../../../app/ReaderNavigationAppearancePreferences';
import { readerHarmonyCapabilities } from '../../../app/HarmonyCapabilityProbe';
import {
  resolveReaderNavigationAppearance, type ReaderNavigationOverride, type ReaderNavigationPreferenceChange,
  type ReaderNavigationPreferences,
} from '../../../app/HarmonyCapabilityPolicy';
import { ReaderFormRow } from '../../../ui/controls/ReaderFormRow';
import { ReaderSegmentedControl } from '../../../ui/controls/ReaderSegmentedControl';
import { ReaderToggle } from '../../../ui/controls/ReaderToggle';
import { ReaderRecoveryNotice } from '../../../ui/feedback/ReaderRecoveryNotice';
import { TYPE_APP_INHERITED_BODY } from '../../../ui/foundation/ReaderTypography';
import { readerAppColor } from '../../../ui/foundation/ReaderThemeRegistry';

const OVERRIDES: ReaderNavigationOverride[] = ['unset', 'unified', 'systemNative'];

@Component
export struct NavigationAppearanceSettings {
  @StorageLink('readerNavigationAppearancePreferences')
  private preferences: ReaderNavigationPreferences = { override: 'unset', reduceTransparency: false };
  @StorageLink('readerNavigationAppearanceSavePending') private savePending: boolean = false;
  @StorageLink('readerAppScheme') private appScheme: string = 'day';
  @StorageLink('readerSystemScheme') private systemScheme: string = 'day';
  @StorageLink('readerAppForeground') private foreground: boolean = true;
  @Prop generation: number = 0;
  inputCurrent: () => boolean = (): boolean => false;
  @State private saving: boolean = false;
  private mounted: boolean = false;

  aboutToAppear(): void { this.mounted = true; }
  aboutToDisappear(): void { this.mounted = false; }

  build() {
    ForEach([this.generation], (generation: number): void => {
      Column() {
        ReaderFormRow({ label: '导航外观' }) {
          ReaderSegmentedControl({
            specId: 'app-theme-segment', options: ['默认', '统一', '原生'],
            optionIds: ['unset', 'unified', 'systemNative'], selectedIndex: this.selectedIndex(),
            accessibilityLabel: '导航外观', inputIdentity: `navigation-appearance:${generation}`,
            actionEnabled: this.canSave(generation),
            onSelect: (index: number): void => { this.select(index, generation); },
          });
        }
        if (this.usesUnifiedFallback()) {
          Text('当前条件下沿用统一外观')
            .fontSize(TYPE_APP_INHERITED_BODY.fontSizeFp)
            .fontColor(readerAppColor('TOK_MUTED', this.appScheme))
            .width('100%').padding({ left: 12, right: 12 });
        }
        ReaderFormRow({ label: '减少导航透明度', actionEnabled: this.canSave(generation),
          onLabelAction: (): void => { void this.save({ reduceTransparency: !this.preferences.reduceTransparency }, generation); } }) {
          ReaderToggle({ value: this.preferences.reduceTransparency, specId: 'standard-toggle',
            accessibilityLabel: '减少导航透明度', inputIdentity: `navigation-transparency:${generation}`,
            actionEnabled: this.canSave(generation),
            onToggle: (value: boolean): void => { void this.save({ reduceTransparency: value }, generation); } });
        }
        this.saveRecovery(generation);
      }.width('100%');
    }, (generation: number): string => generation.toString());
  }

  @Builder
  private saveRecovery(generation: number) {
    if (this.savePending) {
      ReaderRecoveryNotice({ view: { visible: true, generation, canRetry: true,
        message: '导航外观的保存结果待确认' }, actionLabel: '重试保存',
        actionEnabled: this.current(generation), busy: this.saving,
        onReconcile: (expected: number): void => {
          if (expected === generation && this.current(generation)) void this.retry(generation);
        } });
    }
  }

  private usesUnifiedFallback(): boolean {
    return this.preferences.override === 'systemNative' &&
      resolveReaderNavigationAppearance(this.preferences, readerHarmonyCapabilities(), this.appScheme, this.systemScheme) === 'unified';
  }

  private selectedIndex(): number { return OVERRIDES.indexOf(this.preferences.override); }

  private current(generation: number): boolean {
    return this.mounted && this.foreground && generation === this.generation && this.inputCurrent();
  }

  private canSave(generation: number): boolean {
    return this.current(generation) && !this.saving && !this.savePending;
  }

  private select(index: number, generation: number): void {
    const override = OVERRIDES[index];
    if (override !== undefined && override !== this.preferences.override) void this.save({ override }, generation);
  }

  private async save(change: ReaderNavigationPreferenceChange, generation: number): Promise<void> {
    if (!this.canSave(generation)) return;
    this.saving = true;
    try { await ReaderNavigationAppearancePreferences.save(change); }
    catch (_) { /* The preferences owner publishes the retryable receipt state. */ }
    finally { if (this.mounted && generation === this.generation) this.saving = false; }
  }

  private async retry(generation: number): Promise<void> {
    if (!this.current(generation) || !this.savePending || this.saving) return;
    this.saving = true;
    try { await ReaderNavigationAppearancePreferences.retry(); }
    catch (_) { /* The same save remains pending if confirmation is unavailable. */ }
    finally { if (this.mounted && generation === this.generation) this.saving = false; }
  }
}
