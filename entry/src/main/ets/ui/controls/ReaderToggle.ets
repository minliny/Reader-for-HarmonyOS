import { readerAppColor } from '../foundation/ReaderThemeRegistry';
import type { ReaderAppColorRole } from '../foundation/ReaderThemeRegistry';

import { FrameCallback } from '@kit.ArkUI';
import { accessibility } from '@kit.AccessibilityKit';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { DEBUG } from '../../../../../build/default/generated/profile/default/BuildProfile';

class ReaderToggleFocusFrame extends FrameCallback {
  private readonly action: () => void;
  constructor(action: () => void) { super(); this.action = action; }
  onFrame(_time: number): void { this.action(); }
  onIdle(_remaining: number): void {}
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
function resolveReaderToggleSpec(id: ReaderToggleSpecId): ReaderToggleSpec {
  if (id !== 'standard-toggle' && id !== 'bookshelf-update-toggle') {
    throw new Error('Unknown ReaderToggle specification');
  }
  return STANDARD_TOGGLE;
}

/** Controlled value: clicking emits an intent; only the original owner can
 * publish the accepted/draft value. Native ArkUI owns press/release/cancel. */
@Component
export struct ReaderToggle {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  @StorageLink('readerAppForeground') @Watch('onForegroundChanged') private appForeground: boolean = true;
  @Prop specId: ReaderToggleSpecId = 'standard-toggle';
  @Prop value: boolean = false;
  @Prop @Watch('onAvailabilityChanged') actionEnabled: boolean = true;
  @Prop @Watch('onAvailabilityChanged') isBusy: boolean = false;
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
  private accessibilityFocusRetryTimer: number = -1;
  private diagnosticFocusEvents: number = 0;
  private restoringRevision: number = -1;
  aboutToAppear(): void { this.mounted = true; }
  aboutToDisappear(): void {
    this.mounted = false;
    this.clearFocusContinuation();
  }
  private onForegroundChanged(): void {
    if (!this.appForeground) this.clearFocusContinuation();
  }
  private onAvailabilityChanged(): void {
    if (!this.appForeground) return;
    if (!this.canAct(this.inputIdentity)) {
      if (this.pendingFocusRevision === this.nativeRevision || this.pendingAccessibilityFocusRevision === this.nativeRevision) {
        this.restoringRevision = -1;
      }
      return;
    }
    this.continueKeyboardAfterAccessibility(this.inputIdentity, this.nativeRevision);
    this.restoreNativeFocus(this.inputIdentity, this.nativeRevision);
  }
  private clearFocusContinuation(): void {
    this.clearAccessibilityFocusRetry();
    this.focusedRevision = -1;
    this.pendingFocusRevision = -1;
    this.accessibilityFocusedRevision = -1;
    this.pendingAccessibilityFocusRevision = -1;
    this.pendingKeyboardAfterAccessibilityRevision = -1;
    this.restoringRevision = -1;
  }
  build() {
    ForEach([this.inputIdentity], (identity: string): void => {
      Stack({ alignContent: Alignment.Center }) {
        ForEach([this.nativeRevision], (revision: number): void => {
          Toggle({ type: ToggleType.Switch, isOn: this.value })
            .width(44).height(26)
            .selectedColor(readerAppColor(resolveReaderToggleSpec(this.specId).checkedColor, this.appThemeScheme))
            .switchStyle({ pointRadius: 10, trackBorderRadius: 13,
              pointColor: readerAppColor(resolveReaderToggleSpec(this.specId).thumbColor, this.appThemeScheme),
              unselectedColor: readerAppColor(resolveReaderToggleSpec(this.specId).uncheckedColor, this.appThemeScheme) })
            .responseRegion({ x: 0, y: -9, width: 44, height: 44 })
            .enabled(this.canAct(identity)).focusable(this.canAct(identity))
            .accessibilityText(this.accessibilityLabel)
            .id(this.nativeFocusId(identity, revision))
            .onFocus((): void => {
              this.diagnosticFocus('keyboard-focus', revision);
              if (this.mounted && identity === this.inputIdentity && revision === this.nativeRevision) {
                this.focusedRevision = revision;
                this.restoreAccessibilityFocus(identity, revision);
              }
            })
            .onBlur((): void => {
              this.diagnosticFocus('keyboard-blur', revision);
              if (this.mounted && identity === this.inputIdentity && revision === this.nativeRevision) this.focusedRevision = -1;
            })
            .onAccessibilityFocus((focused: boolean): void => {
              this.diagnosticFocus('accessibility-focus', revision, focused);
              if (!this.mounted || identity !== this.inputIdentity || revision !== this.nativeRevision) return;
              if (focused) {
                this.clearAccessibilityFocusRetry();
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
  private nativeFocusId(identity: string, revision: number): string { return `reader-toggle:${identity}:${revision}`; }

  private restoreNativeFocus(identity: string, revision: number): void {
    this.diagnosticFocus('appear-restore', revision);
    const keyboardFocused = this.pendingFocusRevision === revision;
    const accessibilityFocused = this.pendingAccessibilityFocusRevision === revision;
    if ((!keyboardFocused && !accessibilityFocused) || this.restoringRevision === revision) return;
    if (!this.appForeground || !this.canAct(identity) || revision !== this.nativeRevision) return;
    this.restoringRevision = revision;
    this.pendingKeyboardAfterAccessibilityRevision = (keyboardFocused && accessibilityFocused) ||
      this.pendingKeyboardAfterAccessibilityRevision === revision ? revision : -1;
    this.pendingFocusRevision = -1;
    try {
      this.getUIContext().postFrameCallback(new ReaderToggleFocusFrame((): void => {
        if (!this.appForeground || !this.mounted || identity !== this.inputIdentity || revision !== this.nativeRevision) return;
        if (!this.canAct(identity)) {
          this.pendingFocusRevision = keyboardFocused ? revision : -1;
          this.restoringRevision = -1;
          return;
        }
        if (keyboardFocused) this.restoreKeyboardFocus(identity, revision);
        else this.restoreAccessibilityFocus(identity, revision);
      }));
    } catch (_detached) {}
  }

  private restoreAccessibilityFocus(identity: string, revision: number): void {
    if (this.pendingAccessibilityFocusRevision !== revision || !this.appForeground || !this.canAct(identity) ||
      revision !== this.nativeRevision) return;
    this.pendingAccessibilityFocusRevision = -1;
    try {
      this.getUIContext().postFrameCallback(new ReaderToggleFocusFrame((): void => {
        if (!this.appForeground || !this.mounted || identity !== this.inputIdentity || revision !== this.nativeRevision) return;
        if (!this.canAct(identity)) {
          this.pendingAccessibilityFocusRevision = revision;
          this.restoringRevision = -1;
          return;
        }
        if (this.accessibilityFocusedRevision !== revision - 1 && this.accessibilityFocusedRevision !== revision) return;
        this.sendAccessibilityFocus(identity, revision);
      }));
    } catch (_detached) {}
  }

  private clearAccessibilityFocusRetry(): void {
    if (this.accessibilityFocusRetryTimer >= 0) clearTimeout(this.accessibilityFocusRetryTimer);
    this.accessibilityFocusRetryTimer = -1;
  }

  private sendAccessibilityFocus(identity: string, revision: number, allowRetry: boolean = true): void {
    if (!this.appForeground || !this.mounted || identity !== this.inputIdentity || revision !== this.nativeRevision ||
      (this.accessibilityFocusedRevision !== revision - 1 && this.accessibilityFocusedRevision !== revision)) return;
    if (!this.canAct(identity)) {
      this.pendingAccessibilityFocusRevision = revision;
      this.restoringRevision = -1;
      return;
    }
    try {
      const bundleName = this.getUIContext().getHostContext()?.applicationInfo.name;
      if (bundleName === undefined || bundleName.length === 0) return;
      this.diagnosticFocus('accessibility-request', revision);
      accessibility.sendAccessibilityEvent({ type: 'requestFocusForAccessibilityNotInterrupt', bundleName,
        triggerAction: 'accessibilityFocus', customId: this.nativeFocusId(identity, revision) }).then((): void => {
          this.diagnosticFocus('accessibility-accepted', revision);
          this.continueKeyboardAfterAccessibility(identity, revision);
        }).catch((): void => { this.diagnosticFocus('accessibility-rejected', revision); }).finally((): void => {
          // Acceptance can precede the replacement's accessibility-tree update.
          // Keep one bounded retry until the actual native focus acknowledgement.
          if (!this.appForeground || !this.mounted || identity !== this.inputIdentity || revision !== this.nativeRevision ||
            this.accessibilityFocusedRevision !== revision - 1) return;
          if (!this.canAct(identity)) {
            this.pendingAccessibilityFocusRevision = revision;
            this.restoringRevision = -1;
            return;
          }
          if (!allowRetry) return;
          this.clearAccessibilityFocusRetry();
          this.accessibilityFocusRetryTimer = setTimeout((): void => {
            this.accessibilityFocusRetryTimer = -1;
            if (this.accessibilityFocusedRevision === revision - 1) this.sendAccessibilityFocus(identity, revision, false);
          }, 100);
        });
    } catch (_unavailable) {}
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

  private restoreKeyboardFocus(identity: string, revision: number, attempt: number = 0): void {
    if (!this.appForeground || !this.mounted || identity !== this.inputIdentity || revision !== this.nativeRevision) return;
    if (!this.canAct(identity)) {
      this.pendingFocusRevision = revision;
      this.restoringRevision = -1;
      return;
    }
    this.diagnosticFocus('keyboard-request', revision);
    try {
      this.getUIContext().getFocusController().requestFocus(this.nativeFocusId(identity, revision));
    } catch (_unavailable) {
      if (attempt === 0) {
        try {
          this.getUIContext().postFrameCallback(new ReaderToggleFocusFrame((): void => this.restoreKeyboardFocus(identity, revision, 1)));
        } catch (_detached) {}
      }
    }
  }

  private diagnosticFocus(stage: string, revision: number, focused: boolean = false): void {
    const mode = DEBUG ? AppStorage.get<boolean | string>('readerToggleFocusTrace') : false;
    if ((mode !== true && mode !== 'buffered') || this.diagnosticFocusEvents >= (mode === 'buffered' ? 64 : 40)) return;
    this.diagnosticFocusEvents += 1;
    const event = JSON.stringify({
      atMs: Date.now(), stage, revision, focused, label: this.accessibilityLabel, current: this.nativeRevision, keyboard: this.focusedRevision,
      accessibility: this.accessibilityFocusedRevision, pendingKeyboard: this.pendingFocusRevision,
      pendingAccessibility: this.pendingAccessibilityFocusRevision,
      pendingAfterAccessibility: this.pendingKeyboardAfterAccessibilityRevision, foreground: this.appForeground,
      enabled: this.actionEnabled, busy: this.isBusy,
    });
    if (mode === 'buffered') {
      const events = AppStorage.get<string[]>('readerToggleFocusBuffer') ?? [];
      events.push(event);
      AppStorage.setOrCreate('readerToggleFocusBuffer', events.slice(-64));
    } else hilog.info(0x5244, 'ReaderToggleFocus', 'READER_TOGGLE_FOCUS %{public}s', event);
  }

  private toggle(identity: string, revision: number, next: boolean): void {
    if (revision !== this.nativeRevision || !this.canAct(identity) || next === this.value) return;
    this.clearAccessibilityFocusRetry();
    // A native switch mutates its own transient value. Recreate that control
    // from the owner projection even when the intent is rejected without a prop change.
    this.diagnosticFocus('change', revision);
    this.pendingFocusRevision = this.focusedRevision === revision ? revision + 1 : -1;
    this.pendingAccessibilityFocusRevision = this.accessibilityFocusedRevision === revision ? revision + 1 : -1;
    this.nativeRevision += 1;
    this.onToggle(next);
  }
}
