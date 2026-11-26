import curves from '@ohos.curves';
import type { ReaderSessionLaunchCurves } from './ReaderSessionLaunchPresentation';

// Construct native easing instances once. All actors read the same sampled
// presentation, so they cannot acquire independent implicit animation clocks.
const STANDARD = curves.cubicBezierCurve(.2, 0, 0, 1);
const EASE_OUT = curves.cubicBezierCurve(0, 0, .58, 1);

export const READER_SESSION_LAUNCH_CURVES: ReaderSessionLaunchCurves = {
  flight: (progress: number): number => STANDARD.interpolate(progress),
  expand: (progress: number): number => STANDARD.interpolate(progress),
  easeOut: (progress: number): number => EASE_OUT.interpolate(progress),
};
