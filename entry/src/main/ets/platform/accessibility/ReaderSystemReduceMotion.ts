import accessibility from '@ohos.accessibility';

/** API 23 Accessibility Kit. A stable listener belongs to the mounting page. */
export function watchReaderSystemReduceMotion(notify: (enabled: boolean) => void): () => void {
  let active = true;
  let listening = false;
  function changed(enabled: boolean): void {
    if (active) notify(enabled === true);
  }
  if (canIUse('SystemCapability.BarrierFree.Accessibility.Core')) {
    try {
      accessibility.onAnimationReduceStateChange(changed);
      listening = true;
    } catch (_) {}
    try { changed(accessibility.isAnimationReduceEnabledSync()); } catch (_) {}
  }
  return (): void => {
    active = false;
    if (!listening) return;
    listening = false;
    try { accessibility.offAnimationReduceStateChange(changed); } catch (_) {}
  };
}
