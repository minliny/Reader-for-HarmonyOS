import type { ReaderControlVisualFrame } from './ReaderControlSessionState.ts';
import type { ReaderControlMeasuredAxis } from './ReaderControlGestureDriver.ts';
import { readerControlUnit as unit, readerControlActor as actor } from './ReaderControlActorGeometry.ts';
import {
  READER_CONTROL_BRIGHTNESS_RAIL_WIDTH,
  READER_CONTROL_CONTENT_PADDING_RIGHT,
  READER_CONTROL_HOME_TOP_ROW_HEIGHT,
} from './ReaderControlGeometry.ts';

/** Restored Directory 1689:1616 + MR1 1247:28/1247:489 + M-01/M-02/L-01.
 * Spatial samples deliberately contain no easing, timers or route decisions.
 * The raw Figma snapshot is kept separately; user overrides are identified here.
 */
export const READER_CONTROL_MR1_DOCK_TRANSLATE_Y = 18;
export const READER_CONTROL_MR1_TOP_BAR_TRANSLATE_Y = -8;

/** MR1 composition leaves. These numbers coordinate more than one actor, so
 * the motion geometry owns them instead of each builder. Values are authored
 * Figma leaves; only measured bounds and progress enter at call time. */
export const READER_CONTROL_MOTION_QUICK_CONTENT_VERTICAL_RESERVE = 140;
export const READER_CONTROL_MOTION_FULL_CONTENT_VERTICAL_RESERVE = 70;
export const READER_CONTROL_MOTION_CONTENT_INSET_MAX = 13;
export const READER_CONTROL_MOTION_QUICK_CONTENT_HORIZONTAL_RESERVE = 52;
export const READER_CONTROL_MOTION_HEADER_TOP = 19;
export const READER_CONTROL_MOTION_HEADER_HEIGHT = 30;
export const READER_CONTROL_MOTION_CONTENT_SURFACE_TOP = 57;
export const READER_CONTROL_MOTION_CONTENT_TOP_QUICK = 29;
export const READER_CONTROL_MOTION_CONTENT_TOP_FULL_DELTA = 28;
export const READER_CONTROL_MOTION_NAVIGATION_LEFT = 12;
export const READER_CONTROL_MOTION_NAVIGATION_BOTTOM = 93;
export const READER_CONTROL_MOTION_NAVIGATION_TRANSLATE_Y = 20;
export const READER_CONTROL_MOTION_NAVIGATION_HORIZONTAL_INSET = 24;
export const READER_CONTROL_MOTION_NAVIGATION_HEIGHT = 80;
export const READER_CONTROL_MOTION_GRABBER_WIDTH = 42;
export const READER_CONTROL_MOTION_GRABBER_TOP = 9;
export const READER_CONTROL_MOTION_GRABBER_HEIGHT = 4;

export interface ReaderControlMotionBounds {
  width: number;
  fullHeight: number;
  quickHeight: number;
  bottomGap: number;
}

export interface ReaderControlMotionActor {
  x: number;
  y: number;
  width: number;
  height: number;
  opacity: number;
}

/** Relative transforms only: the host owns each actor's measured layout box. */
export interface ReaderControlVisibilityActor {
  translateY: number;
  opacity: number;
}

export interface ReaderControlWholeVisibilityFrame {
  topBar: ReaderControlVisibilityActor;
  dock: ReaderControlVisibilityActor;
}

export interface ReaderControlMotionFrame {
  progress: number;
  visibility: number;
  topBar: ReaderControlVisibilityActor;
  dock: ReaderControlVisibilityActor;
  shell: ReaderControlMotionActor;
  grabber: ReaderControlMotionActor;
  header: ReaderControlMotionActor;
  contentSurface: ReaderControlMotionActor;
  content: ReaderControlMotionActor;
  brightness: ReaderControlMotionActor;
  navigation: ReaderControlMotionActor;
}

function positive(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

/** These five source groups use a fixed Full surface behind a transparent
 * morphing viewport. Search/AutoPage/Replace have different source shells. */
export function readerControlHasFullContentSurface(module: string | undefined): boolean {
  return module === 'directory' || module === 'tts' || module === 'appearance' || module === 'settings';
}

export function readerControlMotionBounds(width: number, fullHeight: number,
  bottomGap: number, quickHeight: number = 330): ReaderControlMotionBounds {
  const height = Number.isFinite(fullHeight) ? Math.max(0, fullHeight) : 736;
  return {
    width: Number.isFinite(width) ? Math.max(0, width) : 364, fullHeight: height,
    quickHeight: Math.min(height, positive(quickHeight, 330)),
    bottomGap: Number.isFinite(bottomGap) ? Math.max(0, bottomGap) : 0,
  };
}

export function readerControlMotionAxis(bounds: ReaderControlMotionBounds,
  screenTop: number): ReaderControlMeasuredAxis {
  const quickY = screenTop + bounds.fullHeight - bounds.quickHeight + 9;
  return {
    quickGrabberScreenY: quickY,
    fullGrabberScreenY: screenTop + 9,
    // This legacy field names the QUICK hidden pose, not a shared off-screen
    // endpoint. Full/captured compositions retain their own visible origin.
    hiddenGrabberScreenY: quickY + READER_CONTROL_MR1_DOCK_TRANSLATE_Y,
  };
}

/** MR1's two actors share visibility; neither owns a separate clock. The raw
 * loop is a review replay. The session owns one-shot open/close and interruption.
 * Source: SHOW_HIDE_MOTION_RAW.json, 1247:37/80 and 1247:496/523.
 */
export function sampleReaderControlWholeVisibility(
  visibilityProgress: number): ReaderControlWholeVisibilityFrame {
  const visibility = unit(visibilityProgress);
  const hidden = 1 - visibility;
  return {
    topBar: { translateY: READER_CONTROL_MR1_TOP_BAR_TRANSLATE_Y * hidden, opacity: visibility },
    dock: { translateY: READER_CONTROL_MR1_DOCK_TRANSLATE_Y * hidden, opacity: visibility },
  };
}

/** Production group composition. Actor geometry/opacity depends ONLY on p;
 * frame.visibility remains the real v, while dock/topBar own its ONE composite
 * transform/opacity. Apply dock to a single parent of all dock actors. Never
 * divide actor opacity by v (v=0 remains a valid retained composition).
 */
export function sampleReaderControlMotionComposition(frame: ReaderControlVisualFrame,
  bounds: ReaderControlMotionBounds): ReaderControlMotionFrame {
  const p = unit(frame.expansionProgress);
  const visibility = unit(frame.visibilityProgress);
  const whole = sampleReaderControlWholeVisibility(visibility);
  const height = bounds.quickHeight + (bounds.fullHeight - bounds.quickHeight) * p;
  // L-01 freezes expansion during dismissal. MR1's displacement/opacity lives
  // on the parent dock actor, not on these individually composited children.
  const shellY = bounds.fullHeight - height;
  const quickContentHeight = Math.min(READER_CONTROL_HOME_TOP_ROW_HEIGHT,
    Math.max(0, bounds.quickHeight - READER_CONTROL_MOTION_QUICK_CONTENT_VERTICAL_RESERVE));
  const fullContentHeight = Math.max(0, bounds.fullHeight - READER_CONTROL_MOTION_FULL_CONTENT_VERTICAL_RESERVE);
  const inset = Math.min(READER_CONTROL_MOTION_CONTENT_INSET_MAX, bounds.width / 4);
  const fullContentWidth = Math.max(0, bounds.width - inset * 2);
  const quickContentWidth = Math.max(0, fullContentWidth - READER_CONTROL_MOTION_QUICK_CONTENT_HORIZONTAL_RESERVE);
  const brightnessWidth = READER_CONTROL_BRIGHTNESS_RAIL_WIDTH;
  const brightnessRight = READER_CONTROL_CONTENT_PADDING_RIGHT;
  return {
    progress: p, visibility: visibility,
    topBar: whole.topBar, dock: whole.dock,
    shell: actor(0, shellY, bounds.width, height, 1),
    grabber: actor((bounds.width - READER_CONTROL_MOTION_GRABBER_WIDTH) / 2,
      shellY + READER_CONTROL_MOTION_GRABBER_TOP, READER_CONTROL_MOTION_GRABBER_WIDTH,
      READER_CONTROL_MOTION_GRABBER_HEIGHT, 1),
    header: actor(inset, shellY + READER_CONTROL_MOTION_HEADER_TOP, fullContentWidth,
      READER_CONTROL_MOTION_HEADER_HEIGHT, p),
    // AddedActor/FullContentSurface is a sibling, not a viewport decoration.
    // Only its opacity changes; parent root movement supplies its translation.
    contentSurface: actor(inset, shellY + READER_CONTROL_MOTION_CONTENT_SURFACE_TOP,
      fullContentWidth, fullContentHeight, p),
    content: actor(inset, shellY + READER_CONTROL_MOTION_CONTENT_TOP_QUICK +
      READER_CONTROL_MOTION_CONTENT_TOP_FULL_DELTA * p,
      quickContentWidth + (fullContentWidth - quickContentWidth) * p,
      quickContentHeight + (fullContentHeight - quickContentHeight) * p, 1),
    // M-02 override: same 190vp height, follows the top, translates completely
    // past the stage's right edge. This distance is derived from the rail bounds,
    // NOT falsely recorded as the baseline's original vertical-fade track.
    brightness: actor(bounds.width - brightnessRight - brightnessWidth +
      (brightnessWidth + brightnessRight) * p, shellY + READER_CONTROL_MOTION_CONTENT_TOP_QUICK,
      brightnessWidth, READER_CONTROL_HOME_TOP_ROW_HEIGHT, 1 - p),
    // Original navigation displacement 0 -> 20, on the common spatial axis.
    navigation: actor(READER_CONTROL_MOTION_NAVIGATION_LEFT,
      shellY + height - READER_CONTROL_MOTION_NAVIGATION_BOTTOM +
        READER_CONTROL_MOTION_NAVIGATION_TRANSLATE_Y * p,
      Math.max(0, bounds.width - READER_CONTROL_MOTION_NAVIGATION_HORIZONTAL_INSET),
      READER_CONTROL_MOTION_NAVIGATION_HEIGHT, 1 - p),
  };
}

function flattenedActor(value: ReaderControlMotionActor,
  dock: ReaderControlVisibilityActor): ReaderControlMotionActor {
  return actor(value.x, value.y + dock.translateY, value.width, value.height, value.opacity * dock.opacity);
}

/** Compatibility/diagnostic flattened sample. Its numbers describe each actor's
 * final transform, NOT a license to fade overlapping siblings independently.
 * Production Stage uses sampleReaderControlMotionComposition and one dock group.
 */
export function sampleReaderControlMotion(frame: ReaderControlVisualFrame,
  bounds: ReaderControlMotionBounds): ReaderControlMotionFrame {
  const sampled = sampleReaderControlMotionComposition(frame, bounds);
  sampled.shell = flattenedActor(sampled.shell, sampled.dock);
  sampled.grabber = flattenedActor(sampled.grabber, sampled.dock);
  sampled.header = flattenedActor(sampled.header, sampled.dock);
  sampled.contentSurface = flattenedActor(sampled.contentSurface, sampled.dock);
  sampled.content = flattenedActor(sampled.content, sampled.dock);
  sampled.brightness = flattenedActor(sampled.brightness, sampled.dock);
  sampled.navigation = flattenedActor(sampled.navigation, sampled.dock);
  return sampled;
}

/** One immutable spatial sample per distinct input. Build helpers share it;
 * changing any measured dimension or live progress invalidates the cache. */
export class ReaderControlMotionFrameCache {
  private frame: ReaderControlMotionFrame | undefined = undefined;
  private visibility: number = -1;
  private progress: number = -1;
  private width: number = -1;
  private height: number = -1;
  private quickHeight: number = -1;
  private gap: number = -1;
  private offset: number = 0;

  sample(visibility: number, progress: number, width: number, height: number,
    gap: number, quickHeight: number, offset: number = 0): ReaderControlMotionFrame {
    if (this.frame !== undefined && this.visibility === visibility && this.progress === progress &&
      this.width === width && this.height === height && this.gap === gap &&
      this.quickHeight === quickHeight && this.offset === offset) return this.frame;
    const frame = sampleReaderControlMotionComposition({ visibilityProgress: visibility,
      expansionProgress: progress }, readerControlMotionBounds(width, height, gap, quickHeight));
    frame.shell.y += offset; frame.grabber.y += offset; frame.header.y += offset;
    frame.contentSurface.y += offset; frame.content.y += offset;
    frame.brightness.y += offset; frame.navigation.y += offset;
    this.visibility = visibility; this.progress = progress; this.width = width;
    this.height = height; this.gap = gap; this.quickHeight = quickHeight; this.offset = offset;
    this.frame = frame;
    return frame;
  }
}
