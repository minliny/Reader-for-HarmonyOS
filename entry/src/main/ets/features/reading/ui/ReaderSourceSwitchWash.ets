import type { UIContext } from '@ohos.arkui.UIContext';
import type { AnimatorResult } from '@ohos.animator';
import { SOURCE_SWITCH_VISUAL } from '../../source/ui/SourceSwitchVisual';

export function createReaderSourceSwitchWash(uiContext: () => UIContext,
  publishOpacity: (opacity: number) => void): AnimatorResult {
  const from = 1 - SOURCE_SWITCH_VISUAL.readerEnterFromOpacity;
  publishOpacity(from);
  return uiContext().createAnimator({
    duration: SOURCE_SWITCH_VISUAL.readerEnterDurationMs,
    easing: `cubic-bezier(${SOURCE_SWITCH_VISUAL.easingX1},${SOURCE_SWITCH_VISUAL.easingY1},${SOURCE_SWITCH_VISUAL.easingX2},${SOURCE_SWITCH_VISUAL.easingY2})`,
    delay: 0, fill: 'forwards', direction: 'normal', iterations: 1, begin: from, end: 0,
  });
}
