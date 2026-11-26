// ProductMotionTiming.READER_CONTROL_EXPAND_MS bounds the Search Quick → Full command.
// This host cutoff guards dispatch only. Owner epochs and native frames prove the overlap.
export const searchMorphDispatchWindowMs = 320;

// Only host dispatch is bounded here. The owner receipt proves that controls
// actually released and native playback launch had not settled at the cut.
export const capsuleCenterDispatch = Object.freeze({ earliestMs:205, latestMs:350 });

export const crossoverTouchTiming = Object.freeze({ keepMs:100, moveMs:900 });

export function crossoverTouchArgs({x,fromY,toY}) {
  if (![x,fromY,toY].every(value => Number.isSafeInteger(value) && value >= 0 && value <= 16384) || fromY >= toY) {
    throw new Error('Timed grabber crossover requires one bounded, downward vertical touch');
  }
  // API 23 uinput keeps the endpoint pointer moving until UP. -k takes keep, then move time.
  const {keepMs,moveMs} = crossoverTouchTiming;
  return ['shell','uinput','-T','-m',String(x),String(fromY),String(x),String(toY),'-k',String(keepMs),String(moveMs)];
}

export function uiInputKeyArgument(key) {
  if (key === 'Back' || key === 'Home') return key;
  if (key === 'Enter') return '2054';
  return null;
}

const grabberRunner = 'collectors/harmonyos/pointer-matrix-runner/entry/src/ohosTest';
export const grabberReversalRunnerInputs = Object.freeze([
  `${grabberRunner}/module.json5`,
  `${grabberRunner}/ets/testrunner/ReaderGrabberReversalRunner.ets`,
  `${grabberRunner}/ets/testrunner/ReversalPlan.ts`,
]);

export function clickThenBackArgs(point) {
  return [
    ['shell', 'uitest', 'uiInput', 'click', String(point.x), String(point.y)],
    ['shell', 'uitest', 'uiInput', 'keyEvent', 'Back'],
  ];
}

export function clickThenReaderCenterArgs(point) {
  return [
    ['shell', 'uitest', 'uiInput', 'click', String(point.x), String(point.y)],
    ['shell', 'uitest', 'uiInput', 'click', String(point.centerX), String(point.centerY)],
  ];
}
