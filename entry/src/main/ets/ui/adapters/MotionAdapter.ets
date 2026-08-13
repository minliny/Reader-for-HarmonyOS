// MotionAdapter — the ONLY place that calls animateTo.
// Resolves a motionId → MotionSpec (duration/easing/reducedMotionPolicy) and runs the
// state mutation inside animateTo. Pages/components must NEVER call animateTo directly;
// they declare intent via ReaderMotionResolver and hand the motionId here.
//
// API 22 note: the global animateTo() is deprecated; we use UIContext.animateTo()
// instead. Callers (all @Component structs) pass their UIContext via this.getUIContext().
import { MotionSpec } from '../../contract/generated/MotionSpecTable';
import { MotionSpecRegistry } from '../motion/MotionSpecRegistry';

export class MotionAdapter {
  // Apply by motionId. `event` mutates the animatable state (opacity / offset / scale).
  static apply(motionId: string, reducedMotion: boolean, uiContext: UIContext, event: () => void): void {
    const spec = MotionSpecRegistry.byId(motionId);
    if (spec === undefined) {
      event();
      return;
    }
    MotionAdapter.applySpec(spec, reducedMotion, uiContext, event);
  }

  // Apply when the caller already holds the resolved MotionSpec.
  static applySpec(spec: MotionSpec, reducedMotion: boolean, uiContext: UIContext, event: () => void): void {
    if (MotionAdapter.shouldSkipAnimation(spec, reducedMotion)) {
      event();
      return;
    }
    const duration = MotionAdapter.durationFor(spec, reducedMotion);
    if (duration <= 0) {
      event();
      return;
    }
    uiContext.animateTo({ duration: duration, curve: MotionAdapter.curveFor(spec.easing) }, event);
  }

  // Reduced-motion policy: zeroDuration → 0ms ; keepDirectManipulation → gesture-driven (no animateTo).
  static shouldSkipAnimation(spec: MotionSpec, reducedMotion: boolean): boolean {
    if (!reducedMotion) return false;
    return spec.reducedMotionPolicy === 'keepDirectManipulation';
  }

  static durationFor(spec: MotionSpec, reducedMotion: boolean): number {
    if (reducedMotion && spec.reducedMotionPolicy === 'zeroDuration') return 0;
    return spec.durationMs;
  }

  // Map CSS easing token value → ArkUI Curve enum.
  static curveFor(easing: string): Curve {
    switch (easing) {
      case 'ease': return Curve.Ease;
      case 'ease-in': return Curve.EaseIn;
      case 'ease-out': return Curve.EaseOut;
      case 'ease-in-out': return Curve.EaseInOut;
      default: return Curve.EaseInOut;
    }
  }
}
