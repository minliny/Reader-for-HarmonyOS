import { readerAppColor } from '../foundation/ReaderThemeRegistry';
import type { ReaderAppColorRole } from '../foundation/ReaderThemeRegistry';

import { FrameCallback } from '@kit.ArkUI';
import { accessibility } from '@kit.AccessibilityKit';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { DEBUG } from '../../../../../build/default/generated/profile/default/BuildProfile';

class ReaderToggleFocusFrame extends FrameCallback {
  private readonly action: () => void;
  constructor(action: () => void) { super(); this.action = action; }
  onFrame(_time: number): void {}
  onIdle(_remaining: number): void { this.action(); }
}

type ReaderToggleSpecId = 'standard-toggle' | 'bookshelf-update-toggle';
interface ReaderToggleSpec {
  thumbColor: ReaderAppColorRole;
  checkedColor: ReaderAppColorRole;
  uncheckedColor: ReaderAppColorRole;
}
const STANDARD_TOGGLE: ReaderToggleSpec = {
  thumbColor: 'app.toggle.thumb',
  checkedColor: 'TOK_PRIMARY_DARK', uncheckedColor: 'app.toggle.offTrack',
};
// Preserves the bookshelf settings page's pre-migration green track while
// adopting the one shared switch geometry and interaction contract.
const BOOKSHELF_UPDATE_TOGGLE: ReaderToggleSpec = {
  thumbColor: 'app.toggle.thumb',
  checkedColor: 'TOK_GREEN', uncheckedColor: 'app.toggle.offTrack',
};
function resolveReaderToggleSpec(id: ReaderToggleSpecId): ReaderToggleSpec {
  if (id === 'bookshelf-update-toggle') return BOOKSHELF_UPDATE_TOGGLE;
  if (id !== 'standard-toggle') throw new Error('Unknown ReaderToggle specification');
  return STANDARD_TOGGLE;
}

/** Controlled value: clicking emits an intent; only the original owner can
 * publish the accepted/draft value. Native ArkUI owns press/release/cancel. */
@Component
export struct ReaderToggle {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  @StorageLink('readerAppForeground') private appForeground: boolean = true;
  @Prop specId: ReaderToggleSpecId = 'standard-toggle';
  @Prop value: boolean = false;
  @Prop actionEnabled: boolean = true;
  @Prop isBusy: boolean = false;
  @Prop @Watch('clearFocusContinuation') inputIdentity: string = '';
  @Prop accessibilityLabel: string = '';
  @State private nativeRevision: number = 0;
  onToggle: (next: boolean) => void = (_next: boolean): void => {};
  private mounted: boolean = false;
  private focusedRevision: number = -1;
  private pendingFocusRevision: number = -1;
  private accessibilityFocusedRevision: number = -1;
  private pendingAccessibilityFocusRevision: number = -1;
  private pendingKeyboardAfterAccessibilityRevision: number = -1;
  private diagnosticFocusEvents: number = 0;
  aboutToAppear(): void { this.mounted = true; }
  aboutToDisappear(): void {
    this.mounted = false;
    this.clearFocusContinuation();
  }
  private clearFocusContinuation(): void {
    this.focusedRevision = -1;
    this.pendingFocusRevision = -1;
    this.accessibilityFocusedRevision = -1;
    this.pendingAccessibilityFocusRevision = -1;
    this.pendingKeyboardAfterAccessibilityRevision = -1;
  }
  build() {
    ForEach([this.inputIdentity], (identity: string): void => {
      Stack({ alignContent: Alignment.Center }) {
        ForEach([this.nativeRevision], (revision: number): void => {
          Toggle({ type: ToggleType.Switch, isOn: this.value })
            .width(44).height(24)
            .selectedColor(readerAppColor(resolveReaderToggleSpec(this.specId).checkedColor, this.appThemeScheme))
            .switchStyle({ pointRadius: 10, trackBorderRadius: 12,
              pointColor: readerAppColor(resolveReaderToggleSpec(this.specId).thumbColor, this.appThemeScheme),
              unselectedColor: readerAppColor(resolveReaderToggleSpec(this.specId).uncheckedColor, this.appThemeScheme) })
            .responseRegion({ x: 0, y: -10, width: 44, height: 44 })
            .enabled(this.canAct(identity)).focusable(this.canAct(identity))
            .accessibilityText(this.accessibilityLabel)
            .id(this.nativeFocusId(identity))
            .onFocus((): void => {
              this.diagnosticFocus('keyboard-focus', revision);
              if (this.mounted && identity === this.inputIdentity && revision === this.nativeRevision) this.focusedRevision = revision;
            })
            .onBlur((): void => {
              this.diagnosticFocus('keyboard-blur', revision);
              if (this.mounted && identity === this.inputIdentity && revision === this.nativeRevision) this.focusedRevision = -1;
            })
            .onAccessibilityFocus((focused: boolean): void => {
              this.diagnosticFocus('accessibility-focus', revision, focused);
              if (!this.mounted || identity !== this.inputIdentity || revision !== this.nativeRevision) return;
              if (focused) {
                this.accessibilityFocusedRevision = revision;
                this.continueKeyboardAfterAccessibility(identity, revision);
              } else if (this.accessibilityFocusedRevision === revision) {
                this.accessibilityFocusedRevision = -1;
                this.pendingKeyboardAfterAccessibilityRevision = -1;
              }
            })
            .onAppear((): void => this.restoreNativeFocus(identity, revision))
            .onChange((next: boolean): void => this.toggle(identity, revision, next));
        }, (revision: number): string => revision.toString());
      }.width(44).height(44);
    }, (identity: string): string => identity);
  }
  private canAct(identity: string): boolean {
    return this.mounted && identity.length > 0 && this.actionEnabled && !this.isBusy && identity === this.inputIdentity;
  }
  private nativeFocusId(identity: string): string { return `reader-toggle:${identity}`; }

  private restoreNativeFocus(identity: string, revision: number): void {
    this.diagnosticFocus('appear-restore', revision);
    const keyboardFocused = this.pendingFocusRevision === revision;
    const accessibilityFocused = this.pendingAccessibilityFocusRevision === revision;
    if (!keyboardFocused && !accessibilityFocused) return;
    this.pendingKeyboardAfterAccessibilityRevision = keyboardFocused && accessibilityFocused ? revision : -1;
    this.pendingFocusRevision = -1;
    this.pendingAccessibilityFocusRevision = -1;
    if (!this.appForeground || !this.canAct(identity) || revision !== this.nativeRevision) return;
    try {
      this.getUIContext().postFrameCallback(new ReaderToggleFocusFrame((): void => {
        if (!this.appForeground || !this.canAct(identity) || revision !== this.nativeRevision) return;
        if (keyboardFocused) this.restoreKeyboardFocus(identity, revision);
        if (accessibilityFocused && (this.accessibilityFocusedRevision === revision - 1 ||
          this.accessibilityFocusedRevision === revision)) {
          try {
            const bundleName = this.getUIContext().getHostContext()?.applicationInfo.name;
            if (bundleName !== undefined && bundleName.length > 0) {
              this.diagnosticFocus('accessibility-request', revision);
              accessibility.sendAccessibilityEvent({ type: 'requestFocusForAccessibilityNotInterrupt', bundleName,
                triggerAction: 'accessibilityFocus', customId: this.nativeFocusId(identity) }).then((): void => {
                  this.diagnosticFocus('accessibility-accepted', revision);
                  this.continueKeyboardAfterAccessibility(identity, revision);
                }).catch((): void => {});
            }
          } catch (_unavailable) {}
        }
      }));
    } catch (_detached) {}
  }

  private continueKeyboardAfterAccessibility(identity: string, revision: number): void {
    this.diagnosticFocus('keyboard-after-accessibility', revision);
    if (this.pendingKeyboardAfterAccessibilityRevision !== revision || this.accessibilityFocusedRevision !== revision ||
      !this.appForeground || !this.canAct(identity) || revision !== this.nativeRevision) return;
    this.pendingKeyboardAfterAccessibilityRevision = -1;
    try {
      this.getUIContext().postFrameCallback(new ReaderToggleFocusFrame((): void => {
        if (this.accessibilityFocusedRevision === revision) this.restoreKeyboardFocus(identity, revision);
      }));
    } catch (_detached) {}
  }

  private restoreKeyboardFocus(identity: string, revision: number): void {
    if (!this.appForeground || !this.canAct(identity) || revision !== this.nativeRevision) return;
    this.diagnosticFocus('keyboard-request', revision);
    try { this.getUIContext().getFocusController().requestFocus(this.nativeFocusId(identity)); }
    catch (_unavailable) {}
  }

  private diagnosticFocus(stage: string, revision: number, focused: boolean = false): void {
    if (!DEBUG || this.diagnosticFocusEvents >= 40) return;
    this.diagnosticFocusEvents += 1;
    hilog.info(0x5244, 'ReaderToggleFocus', 'READER_TOGGLE_FOCUS %{public}s', JSON.stringify({
      stage, revision, focused, label: this.accessibilityLabel, current: this.nativeRevision, keyboard: this.focusedRevision,
      accessibility: this.accessibilityFocusedRevision, pendingKeyboard: this.pendingFocusRevision,
      pendingAccessibility: this.pendingAccessibilityFocusRevision,
      pendingAfterAccessibility: this.pendingKeyboardAfterAccessibilityRevision, foreground: this.appForeground,
    }));
  }

  private toggle(identity: string, revision: number, next: boolean): void {
    if (revision !== this.nativeRevision || !this.canAct(identity) || next === this.value) return;
    // A native switch mutates its own transient value. Recreate that control
    // from the owner projection even when the intent is rejected without a prop change.
    this.diagnosticFocus('change', revision);
    this.pendingFocusRevision = this.focusedRevision === revision ? revision + 1 : -1;
    this.pendingAccessibilityFocusRevision = this.accessibilityFocusedRevision === revision ? revision + 1 : -1;
    this.nativeRevision += 1;
    this.onToggle(next);
  }
}
