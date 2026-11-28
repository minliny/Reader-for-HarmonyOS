import vibrator from '@ohos.vibrator';

/** Subtle 10ms tactile confirmation for discrete state changes, respecting reduceMotion. */
export function triggerReaderTouchHaptic(reduceMotion: boolean): void {
  if (reduceMotion) return;
  try {
    void vibrator.startVibration({ type: 'time', duration: 10 }, { usage: 'touch' }).catch((): void => {});
  } catch (_) {}
}
