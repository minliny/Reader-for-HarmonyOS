/** Product control state only. No reading, settings, TTS or list side effects. */
export type ReaderControlLevel = 'hidden' | 'home' | 'secondary';
export type ReaderControlForm = 'quick' | 'full';
export type ReaderControlModule = 'directory' | 'tts' | 'appearance' | 'settings' |
  'search' | 'autoPage' | 'replace';
export type ReaderControlDirectoryTab = 'directory' | 'bookmarks';
export type ReaderControlTransitionKind = 'open' | 'navigate' | 'morph' | 'dismiss';
export type ReaderControlTransitionIntent = 'forward' | 'back' | 'dismiss';

export interface ReaderControlLocation {
  level: ReaderControlLevel;
  module: ReaderControlModule;
  directoryTab: ReaderControlDirectoryTab;
  form: ReaderControlForm;
}

export interface ReaderControlVisualFrame {
  expansionProgress: number;
  visibilityProgress: number;
}

export interface ReaderControlTransitionSnapshot {
  kind: ReaderControlTransitionKind;
  intent: ReaderControlTransitionIntent;
  fromLocation: ReaderControlLocation;
  toLocation: ReaderControlLocation;
  from: ReaderControlVisualFrame;
  to: ReaderControlVisualFrame;
  progress: number;
  targetProgress: number;
  startProgress: number;
  elapsedMs: number;
  durationMs: number;
}

export interface ReaderControlTransition extends ReaderControlTransitionSnapshot {
  // A close freezes an unfinished operation. This is a suspended record, not
  // another running clock; it can resume only after undo reaches its capture.
  interruptedOperation?: ReaderControlTransitionSnapshot;
}

export interface ReaderControlSessionState {
  location: ReaderControlLocation;
  transition: ReaderControlTransition | undefined;
  heldPointerId: number;
  epoch: number;
  closeRevision: number;
}

export interface ReaderControlBackResult {
  state: ReaderControlSessionState;
  consumed: boolean;
}

function unit(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
}

function duration(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

export function copyReaderControlLocation(location: ReaderControlLocation): ReaderControlLocation {
  return {
    level: location.level,
    module: location.module,
    directoryTab: location.directoryTab,
    form: location.level === 'secondary' ? location.form : 'quick',
  };
}

function defaultLocation(level: ReaderControlLevel): ReaderControlLocation {
  return { level: level, module: 'directory', directoryTab: 'directory', form: 'quick' };
}

function copyFrame(frame: ReaderControlVisualFrame): ReaderControlVisualFrame {
  return { expansionProgress: frame.expansionProgress, visibilityProgress: frame.visibilityProgress };
}

function endpointFrame(location: ReaderControlLocation): ReaderControlVisualFrame {
  return {
    expansionProgress: location.level === 'secondary' && location.form === 'full' ? 1 : 0,
    visibilityProgress: location.level === 'hidden' ? 0 : 1,
  };
}

function copyTransitionSnapshot(value: ReaderControlTransitionSnapshot): ReaderControlTransition {
  return {
    kind: value.kind, intent: value.intent,
    fromLocation: copyReaderControlLocation(value.fromLocation),
    toLocation: copyReaderControlLocation(value.toLocation),
    from: copyFrame(value.from), to: copyFrame(value.to),
    progress: value.progress, targetProgress: value.targetProgress,
    startProgress: value.startProgress, elapsedMs: value.elapsedMs, durationMs: value.durationMs,
  };
}

function copyTransition(value: ReaderControlTransition): ReaderControlTransition {
  const next: ReaderControlTransition = copyTransitionSnapshot(value);
  if (value.interruptedOperation !== undefined) {
    next.interruptedOperation = copyTransitionSnapshot(value.interruptedOperation);
  }
  return next;
}

function copyState(state: ReaderControlSessionState): ReaderControlSessionState {
  return {
    location: copyReaderControlLocation(state.location),
    transition: state.transition === undefined ? undefined : copyTransition(state.transition),
    heldPointerId: state.heldPointerId, epoch: state.epoch, closeRevision: state.closeRevision,
  };
}

function sameTransitionValue(first: ReaderControlTransition | undefined,
  second: ReaderControlTransition | undefined): boolean {
  if (first === second) return true;
  if (first === undefined || second === undefined) return false;
  const sameSnapshot = first.kind === second.kind && first.intent === second.intent &&
    sameLocation(first.fromLocation, second.fromLocation) &&
    sameLocation(first.toLocation, second.toLocation) &&
    sameFrame(first.from, second.from) && sameFrame(first.to, second.to) &&
    first.progress === second.progress && first.targetProgress === second.targetProgress &&
    first.startProgress === second.startProgress && first.elapsedMs === second.elapsedMs &&
    first.durationMs === second.durationMs;
  if (!sameSnapshot) return false;
  const firstInterrupted = first.interruptedOperation;
  const secondInterrupted = second.interruptedOperation;
  if (firstInterrupted === undefined || secondInterrupted === undefined) return firstInterrupted === secondInterrupted;
  return firstInterrupted.kind === secondInterrupted.kind && firstInterrupted.intent === secondInterrupted.intent &&
    sameLocation(firstInterrupted.fromLocation, secondInterrupted.fromLocation) &&
    sameLocation(firstInterrupted.toLocation, secondInterrupted.toLocation) &&
    sameFrame(firstInterrupted.from, secondInterrupted.from) && sameFrame(firstInterrupted.to, secondInterrupted.to) &&
    firstInterrupted.progress === secondInterrupted.progress &&
    firstInterrupted.targetProgress === secondInterrupted.targetProgress &&
    firstInterrupted.startProgress === secondInterrupted.startProgress &&
    firstInterrupted.elapsedMs === secondInterrupted.elapsedMs &&
    firstInterrupted.durationMs === secondInterrupted.durationMs;
}

/**
 * Clone a session at a semantic hand-off boundary.
 *
 * The control stage keeps a local visual clock so VSync samples do not write
 * the reading host's @State.  Consumers may therefore pass a snapshot into
 * that clock without sharing the nested transition object.  This is
 * intentionally exported as a narrow copy operation rather than exposing the
 * reducer's internal mutable helpers.
 */
export function copyReaderControlSessionState(state: ReaderControlSessionState): ReaderControlSessionState {
  return copyState(state);
}

/** Exact value comparison used at sparse semantic/visual hand-off points. */
export function readerControlSessionStateEquals(first: ReaderControlSessionState,
  second: ReaderControlSessionState): boolean {
  return first.heldPointerId === second.heldPointerId && first.epoch === second.epoch &&
    first.closeRevision === second.closeRevision && sameLocation(first.location, second.location) &&
    sameTransitionValue(first.transition, second.transition);
}

export function createReaderControlSessionState(): ReaderControlSessionState {
  return { location: defaultLocation('hidden'), transition: undefined, heldPointerId: -1,
    epoch: 0, closeRevision: 0 };
}

/** The stage consumes this sample; only transition.progress is clock-driven. */
export function sampleReaderControlSession(state: ReaderControlSessionState): ReaderControlVisualFrame {
  const transition = state.transition;
  if (transition === undefined) return endpointFrame(state.location);
  return sampleTransition(transition);
}

function sampleTransition(transition: ReaderControlTransitionSnapshot): ReaderControlVisualFrame {
  return {
    expansionProgress: transition.from.expansionProgress +
      (transition.to.expansionProgress - transition.from.expansionProgress) * transition.progress,
    visibilityProgress: transition.from.visibilityProgress +
      (transition.to.visibilityProgress - transition.from.visibilityProgress) * transition.progress,
  };
}

function sameFrame(first: ReaderControlVisualFrame, second: ReaderControlVisualFrame): boolean {
  return first.expansionProgress === second.expansionProgress &&
    first.visibilityProgress === second.visibilityProgress;
}

function sameLocation(first: ReaderControlLocation, second: ReaderControlLocation): boolean {
  return first.level === second.level && first.form === second.form &&
    first.module === second.module && first.directoryTab === second.directoryTab;
}

function interruptedOperation(state: ReaderControlSessionState): ReaderControlTransitionSnapshot | undefined {
  const transition = state.transition;
  if (transition === undefined) return undefined;
  if (transition.interruptedOperation !== undefined) {
    return copyTransitionSnapshot(transition.interruptedOperation);
  }
  const target = readerControlTargetLocation(state);
  if (target.level === 'hidden' || sameFrame(sampleTransition(transition), endpointFrame(target))) return undefined;
  return copyTransitionSnapshot(transition);
}

export function readerControlTargetLocation(state: ReaderControlSessionState): ReaderControlLocation {
  const transition = state.transition;
  if (transition === undefined) return copyReaderControlLocation(state.location);
  return copyReaderControlLocation(transition.targetProgress === 0 ?
    transition.fromLocation : transition.toLocation);
}

/** Hidden is committed only after release. Until then the original content stays mounted. */
export function readerControlContentLocation(state: ReaderControlSessionState): ReaderControlLocation {
  const transition = state.transition;
  if (transition === undefined) return copyReaderControlLocation(state.location);
  if (transition.toLocation.level === 'hidden') return copyReaderControlLocation(transition.fromLocation);
  if (transition.fromLocation.level === 'hidden') return copyReaderControlLocation(transition.toLocation);
  return readerControlTargetLocation(state);
}

export function readerControlSessionIsActive(state: ReaderControlSessionState): boolean {
  return state.heldPointerId >= 0 || state.transition !== undefined;
}

function parentLocation(location: ReaderControlLocation): ReaderControlLocation {
  if (location.level === 'secondary' && location.form === 'full') {
    const quick = copyReaderControlLocation(location);
    quick.form = 'quick';
    return quick;
  }
  return defaultLocation(location.level === 'secondary' ? 'home' : 'hidden');
}

function finishIfReached(state: ReaderControlSessionState): ReaderControlSessionState {
  const transition = state.transition;
  if (transition === undefined || state.heldPointerId >= 0 ||
    transition.progress !== transition.targetProgress) return state;
  const next = copyState(state);
  const target = readerControlTargetLocation(state);
  const frame = sampleReaderControlSession(state);
  if (target.level === 'hidden') {
    next.location = defaultLocation('hidden');
    next.transition = undefined;
    next.closeRevision += 1;
    return next;
  }
  const endpoint = endpointFrame(target);
  if (frame.expansionProgress !== endpoint.expansionProgress ||
    frame.visibilityProgress !== endpoint.visibilityProgress) {
    const interrupted = transition.interruptedOperation;
    if (interrupted !== undefined) {
      const interruptedTarget = interrupted.targetProgress === 0 ?
        interrupted.fromLocation : interrupted.toLocation;
      if (sameLocation(target, interruptedTarget) && sameFrame(frame, sampleTransition(interrupted))) {
        // Undo has reached the exact pre-close sample. Restore its original
        // source and clock phase; never inherit MR1's 420ms as a morph duration.
        next.transition = copyTransitionSnapshot(interrupted);
        next.epoch += 1;
        return next;
      }
    }
    // A dismissed in-flight morph was restored to its exact capture frame.
    // Resume towards its logical endpoint without snapping that frame.
    return startTransition(next, target, 'morph', 'forward', transition.durationMs, false);
  }
  next.location = target;
  next.transition = undefined;
  return next;
}

function startTransition(
  state: ReaderControlSessionState,
  target: ReaderControlLocation,
  kind: ReaderControlTransitionKind,
  intent: ReaderControlTransitionIntent,
  durationMs: number,
  releasePointer: boolean = true,
): ReaderControlSessionState {
  const next = copyState(state);
  const frame = sampleReaderControlSession(state);
  if (kind === 'navigate' && durationMs <= 0 && state.transition?.kind === 'open' &&
    target.level !== 'hidden' && target.form === 'quick' && frame.expansionProgress === 0) {
    // Navigation changes content immediately, not the still-opening shell's
    // visibility. Keep the exact clock sample and remaining opening trajectory.
    next.epoch += 1;
    if (next.transition !== undefined) next.transition.toLocation = copyReaderControlLocation(target);
    return next;
  }
  const destination = endpointFrame(target);
  if (kind === 'dismiss') destination.expansionProgress = frame.expansionProgress;
  const source = readerControlContentLocation(state);
  next.epoch += 1;
  if (releasePointer) next.heldPointerId = -1;
  next.transition = {
    kind: kind, intent: intent,
    fromLocation: source, toLocation: copyReaderControlLocation(target),
    from: frame, to: destination, progress: 0, targetProgress: 1,
    startProgress: 0, elapsedMs: 0, durationMs: duration(durationMs),
  };
  if (kind === 'dismiss') {
    const previous = state.transition;
    if (previous !== undefined && previous.kind === 'dismiss' &&
      previous.from.expansionProgress === frame.expansionProgress && previous.from.visibilityProgress > 0) {
      // Another close command must not crop its reversible path at the
      // current visibility. Reuse the original capture axis and project this
      // exact sample onto it, including when the previous close was undoing.
      next.transition.from = copyFrame(previous.from);
      next.transition.progress = unit(1 - frame.visibilityProgress / previous.from.visibilityProgress);
      next.transition.startProgress = next.transition.progress;
    }
    const interrupted = interruptedOperation(state);
    if (interrupted !== undefined) next.transition.interruptedOperation = interrupted;
  }
  if (durationMs <= 0 && next.heldPointerId < 0) {
    next.transition.progress = 1;
    return finishIfReached(next);
  }
  return next;
}

/** Host timing is injected; this module does not invent a motion duration. */
export function openReaderControlSession(state: ReaderControlSessionState,
  durationMs: number): ReaderControlSessionState {
  if (state.transition !== undefined && state.transition.kind === 'dismiss') {
    return retargetReaderControlTransition(state, 0, durationMs);
  }
  if (state.location.level !== 'hidden' || state.transition !== undefined) return state;
  return startTransition(state, defaultLocation('home'), 'open', 'forward', durationMs);
}

export function enterReaderControlModule(state: ReaderControlSessionState,
  module: ReaderControlModule, durationMs: number,
  directoryTab: ReaderControlDirectoryTab = 'directory'): ReaderControlSessionState {
  if (readerControlTargetLocation(state).level === 'hidden') return state;
  const target: ReaderControlLocation = {
    level: 'secondary', module: module, directoryTab: directoryTab, form: 'quick',
  };
  return startTransition(state, target, 'navigate', 'forward', durationMs);
}

export function setReaderControlDirectoryTab(state: ReaderControlSessionState,
  tab: ReaderControlDirectoryTab): ReaderControlSessionState {
  if (readerControlContentLocation(state).module !== 'directory' ||
    readerControlContentLocation(state).level !== 'secondary') return state;
  const next = copyState(state);
  next.location.directoryTab = tab;
  if (next.transition !== undefined) {
    if (next.transition.fromLocation.module === 'directory') next.transition.fromLocation.directoryTab = tab;
    if (next.transition.toLocation.module === 'directory') next.transition.toLocation.directoryTab = tab;
    const interrupted = next.transition.interruptedOperation;
    if (interrupted !== undefined) {
      if (interrupted.fromLocation.module === 'directory') interrupted.fromLocation.directoryTab = tab;
      if (interrupted.toLocation.module === 'directory') interrupted.toLocation.directoryTab = tab;
    }
  }
  return next;
}

export function expandReaderControlSession(state: ReaderControlSessionState,
  durationMs: number): ReaderControlSessionState {
  const target = readerControlContentLocation(state);
  if (target.level !== 'secondary') return state;
  target.form = 'full';
  return startTransition(state, target, 'morph', 'forward', durationMs);
}

export function collapseReaderControlSession(state: ReaderControlSessionState,
  durationMs: number): ReaderControlSessionState {
  const target = readerControlContentLocation(state);
  if (target.level !== 'secondary') return state;
  target.form = 'quick';
  return startTransition(state, target, 'morph', 'back', durationMs);
}

export function dismissReaderControlSession(state: ReaderControlSessionState,
  durationMs: number): ReaderControlSessionState {
  if (state.location.level === 'hidden' && state.transition === undefined) return state;
  return startTransition(state, defaultLocation('hidden'), 'dismiss', 'dismiss', durationMs);
}

/**
 * Resume the logical goal captured before a pointer paused the clock.
 *
 * A drag may cross into a new spatial segment whose local progress zero no
 * longer represents that original goal. Rebuilding from the currently sampled
 * frame keeps the image continuous while preserving the requested module/tab,
 * the close revision, and every business state owned outside this module.
 */
export function resumeReaderControlSessionTarget(state: ReaderControlSessionState,
  targetLocation: ReaderControlLocation, durationMs: number): ReaderControlSessionState {
  const target = copyReaderControlLocation(targetLocation);
  const frame = sampleReaderControlSession(state);
  let kind: ReaderControlTransitionKind = 'morph';
  let intent: ReaderControlTransitionIntent = target.form === 'full' ? 'forward' : 'back';
  if (target.level === 'hidden') {
    kind = 'dismiss';
    intent = 'dismiss';
  } else if (target.level === 'home') {
    kind = frame.visibilityProgress < 1 ? 'open' : 'navigate';
    intent = frame.visibilityProgress < 1 ? 'forward' : 'back';
  }
  const destination = endpointFrame(target);
  if (kind === 'dismiss') destination.expansionProgress = frame.expansionProgress;
  const alreadyAtTarget = frame.expansionProgress === destination.expansionProgress &&
    frame.visibilityProgress === destination.visibilityProgress;
  return startTransition(state, target, kind, intent, alreadyAtTarget ? 0 : durationMs);
}

/** Explicit commands revoke the old pointer and pending frame epoch. */
export function backReaderControlSession(state: ReaderControlSessionState,
  durationMs: number): ReaderControlBackResult {
  if (state.location.level === 'hidden' && state.transition === undefined) {
    return { state: state, consumed: false };
  }
  const transition = state.transition;
  if (transition !== undefined && transition.kind === 'dismiss' && transition.targetProgress === 1) {
    return { state: retargetReaderControlTransition(state, 1, durationMs), consumed: true };
  }
  let target: ReaderControlLocation;
  if (transition !== undefined && transition.intent === 'forward' && transition.targetProgress === 1) {
    target = copyReaderControlLocation(transition.fromLocation);
  } else {
    target = parentLocation(readerControlTargetLocation(state));
  }
  const kind: ReaderControlTransitionKind = target.level === 'hidden' ? 'dismiss' :
    target.level === 'home' ? 'navigate' : 'morph';
  return { state: startTransition(state, target, kind, target.level === 'hidden' ? 'dismiss' : 'back',
    durationMs), consumed: true };
}

export function toggleReaderControlSession(state: ReaderControlSessionState,
  durationMs: number): ReaderControlSessionState {
  if (state.transition !== undefined) {
    return retargetReaderControlTransition(state, state.transition.targetProgress === 1 ? 0 : 1, durationMs);
  }
  return state.location.form === 'full' ? collapseReaderControlSession(state, durationMs) :
    expandReaderControlSession(state, durationMs);
}

export function holdReaderControlSession(state: ReaderControlSessionState,
  pointerId: number): ReaderControlSessionState {
  if (pointerId < 0 || state.heldPointerId >= 0 ||
    (state.location.level === 'hidden' && state.transition === undefined)) return state;
  const next = copyState(state);
  next.heldPointerId = pointerId;
  next.epoch += 1;
  return next;
}

/** Release a stationary pause without rebuilding its operation or easing phase. */
export function releaseReaderControlSessionHold(state: ReaderControlSessionState): ReaderControlSessionState {
  if (state.heldPointerId < 0) return state;
  const next = copyState(state);
  next.heldPointerId = -1;
  next.epoch += 1;
  return finishIfReached(next);
}

/** Driver chooses the segment once; creation must not move the sampled frame. */
export function beginReaderControlDragSegment(state: ReaderControlSessionState,
  direction: 'up' | 'down', durationMs: number): ReaderControlSessionState {
  if (state.heldPointerId < 0) return state;
  let source = state;
  const frame = sampleReaderControlSession(state);
  const transition = state.transition;
  if (transition !== undefined) {
    const spatiallyStatic = transition.from.expansionProgress === transition.to.expansionProgress &&
      transition.from.visibilityProgress === transition.to.visibilityProgress;
    const morphIntoClose = transition.kind === 'morph' && direction === 'down' &&
      (frame.expansionProgress === 0 || frame.expansionProgress === 1);
    const closeIntoMorph = transition.kind === 'dismiss' && direction === 'up' &&
      frame.expansionProgress === 0 && frame.visibilityProgress === transition.from.visibilityProgress;
    const crossesSpatialSegment = morphIntoClose || closeIntoMorph;
    // Undo must first retrace the captured close segment before crossing into
    // expansion. Crossing early crops the MR1 path and can create a zero-length
    // dismiss on a second reversal. A resumed source may itself be partially
    // hidden, so compare its captured visibility rather than assuming it is 1.
    if (!crossesSpatialSegment &&
      (frame.visibilityProgress !== 1 || !spatiallyStatic)) return state;
    source = copyState(state);
    source.location = readerControlContentLocation(state);
    source.location.form = frame.expansionProgress === 1 ? 'full' : 'quick';
    source.transition = undefined;
  }
  const location = readerControlContentLocation(source);
  if (direction === 'up' && location.level !== 'secondary') return state;
  if (direction === 'up' && location.form === 'full') return state;
  const target = direction === 'down' ? defaultLocation('hidden') : copyReaderControlLocation(location);
  if (direction === 'up') target.form = 'full';
  const next = startTransition(source, target, direction === 'down' ? 'dismiss' : 'morph',
    direction === 'down' ? 'dismiss' : 'forward', durationMs, false);
  if (direction === 'down' && transition !== undefined && next.transition !== undefined) {
    const interrupted = interruptedOperation(state);
    if (interrupted !== undefined) next.transition.interruptedOperation = interrupted;
  }
  if (transition !== undefined && frame.visibilityProgress !== 1 &&
    next.transition !== undefined) next.transition.from = copyFrame(frame);
  return next;
}

export function trackReaderControlTransition(state: ReaderControlSessionState,
  progress: number, expectedEpoch: number): ReaderControlSessionState {
  if (state.epoch !== expectedEpoch || state.heldPointerId < 0 || state.transition === undefined) return state;
  const next = copyState(state);
  if (next.transition !== undefined) {
    next.transition.progress = unit(progress);
    // The finger owns this frame. Keep the old unspent time but make its clock
    // start at the actual sample, so a subsequent close can safely suspend and
    // restore it before an UP has had a chance to retarget the transition.
    next.transition.startProgress = next.transition.progress;
    next.transition.durationMs = Math.max(0, next.transition.durationMs - next.transition.elapsedMs);
    next.transition.elapsedMs = 0;
  }
  return next;
}

/** Geometry-only rebase: never changes the logical goal or commits an endpoint.
 * Restart the injected clock at this sample using only its unspent duration.
 * In particular, even a hidden target at progress 1 is not committed here.
 */
export function rebaseReaderControlTransitionProgress(state: ReaderControlSessionState,
  progress: number, expectedEpoch: number): ReaderControlSessionState {
  if (state.epoch !== expectedEpoch || state.transition === undefined ||
    !Number.isFinite(progress)) return state;
  const next = copyState(state);
  const transition = next.transition;
  if (transition === undefined) return state;
  transition.progress = unit(progress);
  transition.startProgress = transition.progress;
  transition.durationMs = Math.max(0, transition.durationMs - transition.elapsedMs);
  transition.elapsedMs = 0;
  return next;
}

export function retargetReaderControlTransition(state: ReaderControlSessionState,
  targetProgress: number, durationMs: number): ReaderControlSessionState {
  const next = copyState(state);
  next.heldPointerId = -1;
  next.epoch += 1;
  if (next.transition === undefined) return next;
  next.transition.targetProgress = targetProgress === 0 ? 0 : 1;
  next.transition.startProgress = next.transition.progress;
  next.transition.elapsedMs = 0;
  next.transition.durationMs = duration(durationMs);
  if (durationMs <= 0) next.transition.progress = next.transition.targetProgress;
  return finishIfReached(next);
}

/** A single injected clock. Pointer-owned frames never advance automatically. */
export function advanceReaderControlSession(state: ReaderControlSessionState,
  deltaMs: number, expectedEpoch: number,
  clockCurve?: (fraction: number) => number): ReaderControlSessionState {
  if (expectedEpoch !== state.epoch || state.heldPointerId >= 0 || state.transition === undefined) return state;
  const next = copyState(state);
  const transition = next.transition;
  if (transition === undefined) return state;
  transition.elapsedMs += duration(deltaMs);
  const rawFraction = transition.durationMs === 0 ? 1 : unit(transition.elapsedMs / transition.durationMs);
  // Easing belongs to this automatic clock only, never to pointer-position sampling.
  const fraction = rawFraction === 1 ? 1 : clockCurve === undefined ? rawFraction : unit(clockCurve(rawFraction));
  transition.progress = transition.startProgress +
    (transition.targetProgress - transition.startProgress) * fraction;
  return finishIfReached(next);
}
