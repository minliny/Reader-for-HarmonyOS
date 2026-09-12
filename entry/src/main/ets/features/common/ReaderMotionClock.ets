import systemDateTime from '@ohos.systemDateTime';

/** Commands and callbacks share this clock, never mixing epoch and frame time. */
export function readerMotionNowMs(): number {
  return systemDateTime.getUptime(systemDateTime.TimeType.ACTIVE, false);
}
