export const READER_TRANSITION_SAMPLE_MS = 400;
const TOLERANCE_VP = 2;
const HIGH_VISIBILITY = .5;

export const READER_LAUNCH_PROXY = 'reader-session-launch-proxy';
export const READER_LAUNCH_SOURCE = 'reader-session-launch-source';
export const READER_LAUNCH_SHARP = 'reader-session-launch-sharp';
export const READER_LAUNCH_LEADING = 'reader-session-launch-leading';
export const READER_LAUNCH_LEADING_ICON = 'reader-session-launch-leading-icon';
export const READER_LAUNCH_LEADING_LABEL = 'reader-session-launch-leading-label';
export const READER_LAUNCH_PAUSE = 'reader-session-launch-pause';
export const READER_LAUNCH_SHARP_SCALE = 'readerTransitionLaunchSharpScale';
export const READER_LAUNCH_SOURCE_CLIP = 'readerTransitionLaunchSourceClip';

export interface ReaderLaunchSourceClip {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export function readerTransitionLaunchNodes(sourceActorId: string): string[] {
  return [sourceActorId, READER_LAUNCH_PROXY, READER_LAUNCH_SOURCE, READER_LAUNCH_SHARP,
    READER_LAUNCH_LEADING, READER_LAUNCH_LEADING_ICON, READER_LAUNCH_LEADING_LABEL, READER_LAUNCH_PAUSE];
}

export type ReaderTransitionKind = 'surface' | 'route' | 'launch' | 'chapter';
export type ReaderTransitionAxis = 'x' | 'y' | 'none';
export type ReaderTransitionRule = 'T1' | 'T2' | 'T3' | 'T4';

export interface ReaderTransitionObservation {
  kind: ReaderTransitionKind;
  action: string;
  subject: string;
  scope: string;
  nodes: string[];
  axis?: ReaderTransitionAxis;
  staticMotion?: boolean;
  /** The retained capsule can fade next to the restored card after a handoff. */
  launchHandoff?: boolean;
  /** Native rest position captured before an edge preview changes that actor. */
  routeOriginX?: number;
  firstChildBounds?: boolean;
  /** Use layout anchors where the dialog card has a decorative scale transform. */
  layoutBounds?: boolean;
  /** Prefix of nodes reserved for real body geometry; the final node is loading. */
  chapterBodyCount?: number;
  /** Deferred presentation samples the mounted origin before submitting its replacement. */
  originChapterIndex?: number;
  targetChapterIndex?: number;
}

export interface ReaderTransitionNode {
  id: string;
  nativeId: number;
  x: number;
  y: number;
  width: number;
  height: number;
  opacity: number;
  visible: boolean;
  /** For reading roots, the scan must resolve a genuinely visible native text or image. */
  bodyVisible?: boolean;
  bodyAnchorId?: number;
  bodyAnchorY?: number;
  chapterIndex?: number;
}

export interface ReaderTransitionFrame {
  atMs: number;
  nodes: ReaderTransitionNode[];
  unreadableIds: string[];
}

export interface ReaderTransitionViolation {
  rule: ReaderTransitionRule;
  code: string;
  frame: number;
}

export interface ReaderTransitionEvaluation {
  observedRules: ReaderTransitionRule[];
  violations: ReaderTransitionViolation[];
  missing: string[];
}

function node(frame: ReaderTransitionFrame, id: string): ReaderTransitionNode | undefined {
  return frame.nodes.find((candidate: ReaderTransitionNode): boolean => candidate.id === id);
}

function excessive(value: number, reference: number): boolean { return Math.abs(value - reference) > TOLERANCE_VP; }

function anchorJump(first: ReaderTransitionNode, next: ReaderTransitionNode, axis: ReaderTransitionAxis): boolean {
  return (axis !== 'x' && excessive(first.x, next.x)) || (axis !== 'y' && excessive(first.y, next.y)) ||
    excessive(first.width, next.width) || excessive(first.height, next.height);
}

/** T1 compares against the first actual bounds, so several adjacent small jumps cannot evade the gate. */
function surfaceRule(input: ReaderTransitionObservation, frames: ReaderTransitionFrame[],
  result: ReaderTransitionEvaluation): boolean {
  for (const id of input.nodes) {
    let first: ReaderTransitionNode | undefined;
    let samples = 0;
    let retired = false;
    for (let index = 0; index < frames.length; index += 1) {
      const current = node(frames[index], id);
      if (current === undefined || current.width <= 0 || current.height <= 0) {
        retired = first !== undefined;
        continue;
      }
      samples += 1;
      if (first === undefined) first = current;
      else if (retired) {
        result.violations.push({ rule: 'T1', code: 'surface-anchor-remounted', frame: index });
        return true;
      }
      else if (anchorJump(first, current, input.axis ?? 'none')) {
        result.violations.push({ rule: 'T1', code: 'stationary-anchor-shift', frame: index });
        return true;
      }
    }
    if (samples < 2) return false;
  }
  return input.nodes.length > 0;
}

function routeRule(input: ReaderTransitionObservation, frames: ReaderTransitionFrame[],
  result: ReaderTransitionEvaluation, completed: boolean): boolean {
  let first: number | undefined;
  let last: number | undefined;
  let furthest: number | undefined;
  let lastFrame = 0;
  let samples = 0;
  const rightward = input.action === 'pop' || input.action === 'preview';
  for (let index = 0; index < frames.length; index += 1) {
    const actor = node(frames[index], input.nodes[0]);
    if (actor === undefined || actor.width <= 0 || actor.height <= 0) continue;
    const x = actor.x;
    const signed = rightward ? x : -x;
    samples += 1;
    if (first === undefined) first = x;
    const reversal = input.staticMotion === true ? excessive(x, first) : input.action === 'preview' ?
      input.routeOriginX !== undefined && x < input.routeOriginX - TOLERANCE_VP :
      furthest !== undefined && signed < furthest - TOLERANCE_VP;
    if (reversal) {
      result.violations.push({ rule: 'T2', code: 'route-direction-reversed', frame: index });
      return true;
    }
    furthest = Math.max(furthest ?? signed, signed);
    last = x;
    lastFrame = index;
  }
  if (samples < 2 || first === undefined || last === undefined || furthest === undefined) return false;
  if (input.action === 'cancel' && input.routeOriginX !== undefined && excessive(last, input.routeOriginX)) {
    if (!completed) return false;
    result.violations.push({ rule: 'T2', code: 'route-cancel-rest-position', frame: lastFrame });
    return true;
  }
  if (input.action === 'preview' && input.routeOriginX === undefined) return false;
  if (input.action === 'cancel' && input.routeOriginX === undefined) return false;
  return input.staticMotion === true || furthest - (rightward ? first : -first) > TOLERANCE_VP ||
    (input.action === 'preview' && input.routeOriginX !== undefined && furthest - input.routeOriginX > TOLERANCE_VP);
}

function launchRule(input: ReaderTransitionObservation, frames: ReaderTransitionFrame[],
  result: ReaderTransitionEvaluation): boolean {
  let proxyFrames = 0;
  let sawSharp = false;
  let sawLeadingIcon = false;
  let sawLeadingLabel = false;
  let sawPause = false;
  let sawRestoredSource = false;
  for (let index = 0; index < frames.length; index += 1) {
    const frame = frames[index];
    const live = node(frame, input.nodes[0]);
    const proxy = node(frame, READER_LAUNCH_PROXY);
    const sharp = node(frame, READER_LAUNCH_SHARP);
    const leadingIcon = node(frame, READER_LAUNCH_LEADING_ICON);
    const leadingLabel = node(frame, READER_LAUNCH_LEADING_LABEL);
    const pause = node(frame, READER_LAUNCH_PAUSE);
    if (proxy?.visible === true) proxyFrames += 1;
    if (live?.visible === true && proxyFrames > 0) sawRestoredSource = true;
    sawSharp = sawSharp || sharp?.visible === true;
    sawLeadingIcon = sawLeadingIcon || leadingIcon?.visible === true;
    sawLeadingLabel = sawLeadingLabel || leadingLabel?.visible === true;
    sawPause = sawPause || pause?.visible === true;
    // During a return, the canonical capsule may fade while the card is
    // restored. A visible source shell or sharp content still duplicates it.
    const proxyShowsSource = input.launchHandoff !== true ||
      sharp?.visible === true || node(frame, READER_LAUNCH_SOURCE)?.visible === true;
    if (live?.visible === true && proxy?.visible === true && proxyShowsSource) {
      result.violations.push({ rule: 'T3', code: 'source-and-proxy-visible', frame: index });
      return true;
    }
    if (sharp?.visible === true && sharp.opacity >= HIGH_VISIBILITY &&
      (highVisibilityOverlap(sharp, leadingIcon) || highVisibilityOverlap(sharp, leadingLabel) || highVisibilityOverlap(sharp, pause))) {
      result.violations.push({ rule: 'T3', code: 'sharp-and-capsule-content-overlap', frame: index });
      return true;
    }
  }
  return proxyFrames >= 2 && (input.launchHandoff === true ? sawRestoredSource :
    sawLeadingIcon && sawLeadingLabel && sawPause && (input.staticMotion === true || sawSharp));
}

function highVisibilityOverlap(sharp: ReaderTransitionNode, actor?: ReaderTransitionNode): boolean {
  return actor?.visible === true && actor.opacity >= HIGH_VISIBILITY &&
    Math.min(sharp.x + sharp.width, actor.x + actor.width) > Math.max(sharp.x, actor.x) &&
    Math.min(sharp.y + sharp.height, actor.y + actor.height) > Math.max(sharp.y, actor.y);
}

function chapterRule(input: ReaderTransitionObservation, frames: ReaderTransitionFrame[],
  result: ReaderTransitionEvaluation): boolean {
  const bodyCount = input.chapterBodyCount ?? 0;
  if (bodyCount < 1 || input.nodes.length !== bodyCount + 1) return false;
  const baseline = new Map<string, ReaderTransitionNode>();
  const anchors = new Map<number, number>();
  let witnessedBody = false;
  let witnessedOrigin = input.originChapterIndex === undefined;
  let witnessedTarget = input.targetChapterIndex === undefined;
  for (let index = 0; index < frames.length; index += 1) {
    const frame = frames[index];
    if (node(frame, input.nodes[bodyCount])?.visible === true) {
      result.violations.push({ rule: 'T4', code: 'cached-chapter-loading-visible', frame: index });
      return true;
    }
    const bodyNodes = input.nodes.slice(0, bodyCount).map((id: string): ReaderTransitionNode | undefined => node(frame, id));
    if (bodyNodes.some((body: ReaderTransitionNode | undefined): boolean => body?.visible === true && body.bodyVisible === undefined))
      return false;
    const visibleBody = bodyNodes.find((body: ReaderTransitionNode | undefined): boolean => body?.visible === true && body.bodyVisible === true);
    if (visibleBody === undefined) {
      result.violations.push({ rule: 'T4', code: 'chapter-body-blank', frame: index });
      return true;
    }
    witnessedBody = true;
    for (const body of bodyNodes) {
      if (body?.visible !== true || body.bodyVisible !== true) continue;
      if (index === 0 && body.chapterIndex === input.originChapterIndex) witnessedOrigin = true;
      if ((input.originChapterIndex === undefined || index > 0) && body.chapterIndex === input.targetChapterIndex)
        witnessedTarget = true;
      const identity = body.id;
      const initial = baseline.get(identity);
      if (initial === undefined) baseline.set(identity, body);
      else if (excessive(initial.y, body.y)) {
        result.violations.push({ rule: 'T4', code: 'chapter-body-vertical-shift', frame: index });
        return true;
      }
      if (body.bodyAnchorId === undefined || body.bodyAnchorY === undefined) continue;
      const anchorY = anchors.get(body.bodyAnchorId);
      if (anchorY === undefined) anchors.set(body.bodyAnchorId, body.bodyAnchorY);
      else if (excessive(anchorY, body.bodyAnchorY)) {
        result.violations.push({ rule: 'T4', code: 'chapter-first-line-vertical-shift', frame: index });
        return true;
      }
    }
  }
  return witnessedBody && witnessedOrigin && witnessedTarget;
}

export function evaluateTransitionInvariants(input: ReaderTransitionObservation, frames: ReaderTransitionFrame[],
  completed: boolean = true): ReaderTransitionEvaluation {
  const result: ReaderTransitionEvaluation = { observedRules: [], violations: [], missing: [] };
  const rule: ReaderTransitionRule = input.kind === 'surface' ? 'T1' : input.kind === 'route' ? 'T2' :
    input.kind === 'launch' ? 'T3' : 'T4';
  if (frames.length < 2) { result.missing.push(rule + ':too-few-frames'); return result; }
  const hasUnreadable = frames.some((frame: ReaderTransitionFrame): boolean => frame.unreadableIds.length > 0);
  const observed = input.kind === 'surface' ? surfaceRule(input, frames, result) : input.kind === 'route' ?
    routeRule(input, frames, result, completed) : input.kind === 'launch' ? launchRule(input, frames, result) : chapterRule(input, frames, result);
  if (observed && (!hasUnreadable || result.violations.length > 0)) result.observedRules.push(rule);
  else result.missing.push(rule + (hasUnreadable ? ':native-frame-unreadable' : ':required-actor-unobserved'));
  return result;
}
