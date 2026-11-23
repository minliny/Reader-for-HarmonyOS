import curves from '@ohos.curves';
import type { ReaderSessionLaunchCurves } from './ReaderSessionLaunchPresentation';

// Construct native easing instances once. All actors read the same sampled
// presentation, so they cannot acquire independent implicit animation clocks.
const FLIGHT = curves.cubicBezierCurve(.4, 0, .2, 1);
const EXPAND = curves.cubicBezierCurve(.2, 0, 0, 1);
const EASE_IN = curves.cubicBezierCurve(.42, 0, 1, 1);
const EASE_OUT = curves.cubicBezierCurve(0, 0, .58, 1);
const EASE_IN_OUT = curves.cubicBezierCurve(.42, 0, .58, 1);

export const READER_SESSION_LAUNCH_CURVES: ReaderSessionLaunchCurves = {
  flight: (progress: number): number => FLIGHT.interpolate(progress),
  expand: (progress: number): number => EXPAND.interpolate(progress),
  easeIn: (progress: number): number => EASE_IN.interpolate(progress),
  easeOut: (progress: number): number => EASE_OUT.interpolate(progress),
  easeInOut: (progress: number): number => EASE_IN_OUT.interpolate(progress),
};
