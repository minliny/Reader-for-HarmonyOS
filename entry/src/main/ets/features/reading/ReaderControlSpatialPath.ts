import type {
  ReaderControlTransition, ReaderControlVisualFrame,
} from './ReaderControlSessionState.ts';

/** Structural axis type keeps this pure sampler independent of GestureDriver. */
export interface ReaderControlSpatialAxis {
  quickGrabberScreenY: number;
  fullGrabberScreenY: number;
  /** Quick hidden pose. hidden-quick is the relative MR1 close displacement;
   * it is NOT a single hidden destination shared by Quick and Full. */
  hiddenGrabberScreenY: number;
}

export interface ReaderControlSpatialProjection {
  progress: number;
  reachable: boolean;
  spatiallyStatic: boolean;
  screenY: number;
  consumedDelta: number;
  remainingDelta: number;
  atBoundary: boolean;
}

function unit(value: number): number { return Math.max(0, Math.min(1, value)); }

export function readerControlSpatialFrameAt(transition: ReaderControlTransition,
  progress: number): ReaderControlVisualFrame {
  return {
    expansionProgress: transition.from.expansionProgress +
      (transition.to.expansionProgress - transition.from.expansionProgress) * progress,
    visibilityProgress: transition.from.visibilityProgress +
      (transition.to.visibilityProgress - transition.from.visibilityProgress) * progress,
  };
}

export function readerControlSpatialY(frame: ReaderControlVisualFrame,
  axis: ReaderControlSpatialAxis): number {
  const visibleY = axis.quickGrabberScreenY +
    (axis.fullGrabberScreenY - axis.quickGrabberScreenY) * frame.expansionProgress;
  const closeTravel = axis.hiddenGrabberScreenY - axis.quickGrabberScreenY;
  return visibleY + closeTravel * (1 - frame.visibilityProgress);
}

export function sampleReaderControlSpatialPath(transition: ReaderControlTransition,
  axis: ReaderControlSpatialAxis, progress: number): number {
  return readerControlSpatialY(readerControlSpatialFrameAt(transition, progress), axis);
}

function projection(transition: ReaderControlTransition, axis: ReaderControlSpatialAxis,
  desiredScreenY: number, currentProgress: number): ReaderControlSpatialProjection {
  const fromY = sampleReaderControlSpatialPath(transition, axis, 0);
  const toY = sampleReaderControlSpatialPath(transition, axis, 1);
  const travel = toY - fromY;
  const currentY = sampleReaderControlSpatialPath(transition, axis, currentProgress);
  const epsilon = Number.EPSILON * Math.max(1, Math.abs(fromY), Math.abs(toY), Math.abs(desiredScreenY)) * 16;
  const spatiallyStatic = Math.abs(travel) <= epsilon;
  let nearest = currentProgress;
  let reachable = Math.abs(currentY - desiredScreenY) <= epsilon;
  if (!reachable && !spatiallyStatic) {
    // MR1 translates the captured composition by 18vp instead of interpolating
    // it towards a shared off-screen point. Even mixed expansion/visibility is
    // therefore affine; the old quadratic term described the wrong geometry.
    const root = (desiredScreenY - fromY) / travel;
    // Arithmetic can produce 1 + one ULP for an exact endpoint. This numeric
    // tolerance is not a product threshold or an unreachable-anchor clamp.
    const progressTolerance = Number.EPSILON * 64;
    if (Number.isFinite(root)) {
      reachable = root >= -progressTolerance && root <= 1 + progressTolerance;
      nearest = unit(root);
    }
  }
  const screenY = sampleReaderControlSpatialPath(transition, axis, nearest);
  return { progress: nearest, reachable: reachable, spatiallyStatic: spatiallyStatic,
    // An in-range projection consumed all physical travel. Reconstructing Y
    // from progress can differ by an ULP; carrying that rounding error as
    // out-of-bounds travel would block every following same-direction MOVE.
    screenY: screenY, consumedDelta: (reachable ? desiredScreenY : screenY) - currentY,
    remainingDelta: reachable ? 0 : desiredScreenY - screenY,
    atBoundary: nearest === 0 || nearest === 1 };
}

/** Absolute layout projection may choose any legal sample. When unreachable,
 * the returned boundary is EXPLICIT: layout must use compensation, not pretend
 * that a bounded progress alone preserved the requested screen anchor.
 */
export function projectReaderControlSpatialPath(transition: ReaderControlTransition,
  axis: ReaderControlSpatialAxis, desiredScreenY: number,
  currentProgress: number = transition.progress): ReaderControlSpatialProjection {
  return projection(transition, axis, desiredScreenY, unit(currentProgress));
}

/** Exact pointer displacement on the same production path as layout rebase.
 * Any beyond-endpoint remainder is explicit; the driver owns its retention.
 */
export function moveReaderControlSpatialPath(transition: ReaderControlTransition,
  axis: ReaderControlSpatialAxis, deltaScreenY: number): ReaderControlSpatialProjection {
  const currentProgress = unit(transition.progress);
  const desiredY = sampleReaderControlSpatialPath(transition, axis, currentProgress) + deltaScreenY;
  return projection(transition, axis, desiredY, currentProgress);
}
