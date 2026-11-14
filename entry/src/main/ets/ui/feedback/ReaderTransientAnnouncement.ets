import { accessibility } from '@kit.AccessibilityKit';
import { hilog } from '@kit.PerformanceAnalysisKit';
import type { UIContext } from '@ohos.arkui.UIContext';
import { claimReaderTransientAnnouncement } from './ReaderTransientFeedback';

/** Shared short-feedback platform boundary. Announcing preserves input focus. */
export function announceReaderTransientToast(context: () => UIContext, hostId: number, generation: number): void {
  try {
    const bundleName = context().getHostContext()?.applicationInfo.name;
    if (bundleName === undefined || bundleName.length === 0) return;
    const text = claimReaderTransientAnnouncement(hostId, generation);
    if (text === undefined) return;
    accessibility.sendAccessibilityEvent({ type: 'announceForAccessibilityNotInterrupt', bundleName,
      triggerAction: 'common', textAnnouncedForAccessibility: text }).catch((): void => {
      hilog.warn(0x0000, 'ReaderTransientToast', 'Accessibility announcement rejected');
    });
  } catch (_unavailable) {
    hilog.warn(0x0000, 'ReaderTransientToast', 'Accessibility announcement unavailable');
  }
}
