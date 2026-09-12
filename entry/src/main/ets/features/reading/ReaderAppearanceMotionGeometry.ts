/**
 * Phone appearance Quick <-> Full motion geometry.
 *
 * `masterProgress` is the only spatial coordinate. It is produced from the
 * grabber's measured screen-space position and is then used, unchanged, to
 * sample every actor/property track. Expand and collapse are therefore the
 * same function traversed in opposite directions.
 *
 * Figma N (`1505:18040`) is the authority for actor identity, hierarchy,
 * property values, local timing and easing. The measured grabber still owns
 * the master p=0..1 input, but no production-only motion is inserted between
 * the authored keyframes.
 */

export type ReaderAppearanceMotionActorId =
  'BrightnessRail' |
  'ModuleNav' |
  'MorphStage' |
  'ContentSurface' |
  'AppearanceContent' |
  'ThemeLibrary' |
  'FontLibrary' |
  'QuickMorph' |
  'ThemeHeader' |
  'ThemeDay' |
  'ThemeWarm' |
  'ThemeNight' |
  'ThemeWarmNight' |
  'ThemePaper' |
  'ThemeGreen' |
  'ThemePaperNight' |
  'ThemeGreenNight' |
  'QuickDivider' |
  'FontHeader' |
  'Font0' |
  'Font1' |
  'Font2' |
  'Font3' |
  'Font4' |
  'Font5' |
  'Font6' |
  'Font7' |
  'Header' |
  'Typography';

export type ReaderAppearanceTrackEasing = 'linear' | 'ease-out' | 'ease-in-out';
export type ReaderAppearanceTrackAuthority =
  'figma-n';

export interface ReaderAppearanceMeasuredAxis {
  /** Resting grabber center in the compact control bar, in screen coordinates. */
  quickGrabberScreenY: number;
  /** Resting grabber center in the full control bar, in screen coordinates. */
  fullGrabberScreenY: number;
}

export interface ReaderAppearanceMotionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ReaderAppearanceMotionActorFrame extends ReaderAppearanceMotionRect {
  /** Local progress of this actor's primary changing track. */
  trackProgress: number;
  opacity: number;
  translateX: number;
  translateY: number;
  blurVp: number;
}

export interface ReaderAppearanceMotionActorSample {
  id: ReaderAppearanceMotionActorId;
  frame: ReaderAppearanceMotionActorFrame;
}

export interface ReaderAppearanceMotionFrame {
  /** The sole clamped Quick=0 -> Full=1 spatial coordinate. */
  masterProgress: number;
  /** Corresponding position on the active Figma N review timeline. */
  figmaFramePercent: number;
  shellHeight: number;
  shellTranslateY: number;
  brightnessRail: ReaderAppearanceMotionActorFrame;
  moduleNav: ReaderAppearanceMotionActorFrame;
  morphStage: ReaderAppearanceMotionActorFrame;
  contentSurface: ReaderAppearanceMotionActorFrame;
  appearanceContent: ReaderAppearanceMotionActorFrame;
  themeLibrary: ReaderAppearanceMotionActorFrame;
  fontLibrary: ReaderAppearanceMotionActorFrame;
  quickMorph: ReaderAppearanceMotionActorFrame;
  themeHeader: ReaderAppearanceMotionActorFrame;
  themeItems: ReaderAppearanceMotionActorFrame[];
  quickDivider: ReaderAppearanceMotionActorFrame;
  fontHeader: ReaderAppearanceMotionActorFrame;
  fontItems: ReaderAppearanceMotionActorFrame[];
  header: ReaderAppearanceMotionActorFrame;
  typography: ReaderAppearanceMotionActorFrame;
  actorSamples: ReaderAppearanceMotionActorSample[];
}

export interface ReaderAppearanceNumberTrack {
  startMasterProgress: number;
  endMasterProgress: number;
  from: number;
  to: number;
  easing: ReaderAppearanceTrackEasing;
}

export interface ReaderAppearanceActorTracks {
  id: ReaderAppearanceMotionActorId;
  authority: ReaderAppearanceTrackAuthority;
  x: ReaderAppearanceNumberTrack;
  y: ReaderAppearanceNumberTrack;
  width: ReaderAppearanceNumberTrack;
  height: ReaderAppearanceNumberTrack;
  opacity: ReaderAppearanceNumberTrack;
  translateX: ReaderAppearanceNumberTrack;
  translateY: ReaderAppearanceNumberTrack;
  blurVp: ReaderAppearanceNumberTrack;
}

export const READER_APPEARANCE_SETTLE_FULL_DISTANCE_MS = 420;
export const READER_APPEARANCE_QUICK_HEIGHT = 330;
export const READER_APPEARANCE_FULL_HEIGHT = 736;
export const READER_APPEARANCE_STAGE_WIDTH = 364;
/** Smallest useful direct-manipulation axis; matches the grabber touch target. */
export const READER_APPEARANCE_MIN_INTERACTIVE_TRAVEL_VP = 44;
/** Design-space endpoint delta only. It must never normalize a screen gesture. */
export const READER_APPEARANCE_DESIGN_TRAVEL_VP =
  READER_APPEARANCE_FULL_HEIGHT - READER_APPEARANCE_QUICK_HEIGHT;

export const READER_APPEARANCE_FIGMA_N_REVIEW_START_PERCENT = 1 / 9;
export const READER_APPEARANCE_FIGMA_N_REVIEW_END_PERCENT = 3 / 4;
/** The source timeline is available; this is not a runtime visual-acceptance flag. */
export const READER_APPEARANCE_FIGMA_N_SOURCE_EVIDENCE_AVAILABLE = true;
/** Figma 200ms -> 700ms inside the effective 200ms -> 1350ms master window. */
export const READER_APPEARANCE_SHARED_GEOMETRY_END_PROGRESS = 10 / 23;

export const READER_APPEARANCE_SHARED_ACTOR_IDS: ReaderAppearanceMotionActorId[] = [
  'MorphStage',
  'QuickMorph',
  'ThemeHeader',
  'ThemeDay',
  'ThemeWarm',
  'ThemeNight',
  'ThemeWarmNight',
  'ThemePaper',
  'ThemeGreen',
  'ThemePaperNight',
  'ThemeGreenNight',
  'QuickDivider',
  'FontHeader',
  'Font0',
  'Font1',
  'Font2',
  'Font3',
  'Font4',
  'Font5',
  'Font6',
  'Font7',
];

export const READER_APPEARANCE_FULL_ONLY_ACTOR_IDS: ReaderAppearanceMotionActorId[] = [
  'ContentSurface',
  'AppearanceContent',
  'ThemeLibrary',
  'FontLibrary',
  'Typography',
  'Header',
];

export const READER_APPEARANCE_FIXED_SCREEN_ACTOR_IDS: ReaderAppearanceMotionActorId[] = [
  'BrightnessRail',
  'ModuleNav',
];

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
}

function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

/** Runtime guard while Figma N remains a fixed 364vp coordinate space. */
export function readerAppearanceMotionStageSupported(
  availableWidth: number,
  availableHeight: number,
): boolean {
  return Number.isFinite(availableWidth) &&
    Number.isFinite(availableHeight) &&
    availableWidth >= READER_APPEARANCE_STAGE_WIDTH &&
    availableHeight - READER_APPEARANCE_QUICK_HEIGHT >=
      READER_APPEARANCE_MIN_INTERACTIVE_TRAVEL_VP;
}

/** Cancel retained Full scrolling continuously as the same tree returns to Quick. */
export function readerAppearanceScrollCompensationVp(
  scrollOffsetY: number,
  masterProgress: number,
): number {
  const offset = Math.max(0, finiteOr(scrollOffsetY, 0));
  return offset * (1 - clamp01(masterProgress));
}

export function readerAppearanceMotionViewportWidth(
  frame: ReaderAppearanceMotionFrame,
  sheetWidth: number,
): number {
  const surfaceLeft = frame.quickMorph.x + frame.quickMorph.translateX;
  const available = Math.max(0, finiteOr(sheetWidth, 0) - surfaceLeft);
  return Math.max(0, Math.min(frame.quickMorph.width, available));
}

export function readerAppearanceMotionViewportHeight(
  frame: ReaderAppearanceMotionFrame,
): number {
  const surfaceTop = frame.quickMorph.y + frame.quickMorph.translateY;
  const available = Math.max(0, frame.shellHeight - surfaceTop);
  return Math.max(0, Math.min(frame.quickMorph.height, available));
}

function cubicCoordinate(parameter: number, first: number, second: number): number {
  const inverse = 1 - parameter;
  return 3 * inverse * inverse * parameter * first +
    3 * inverse * parameter * parameter * second + parameter * parameter * parameter;
}

export function readerAppearanceCubicBezierProgress(
  progress: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number {
  const x = clamp01(progress);
  if (x === 0 || x === 1) {
    return x;
  }
  let low = 0;
  let high = 1;
  for (let index = 0; index < 52; index += 1) {
    const parameter = (low + high) / 2;
    if (cubicCoordinate(parameter, x1, x2) < x) {
      low = parameter;
    } else {
      high = parameter;
    }
  }
  return clamp01(cubicCoordinate((low + high) / 2, y1, y2));
}

function applyTrackEasing(progress: number, easing: ReaderAppearanceTrackEasing): number {
  if (easing === 'ease-out') {
    return readerAppearanceCubicBezierProgress(progress, 0, 0, 0.58, 1);
  }
  if (easing === 'ease-in-out') {
    return readerAppearanceCubicBezierProgress(progress, 0.42, 0, 0.58, 1);
  }
  return clamp01(progress);
}

/**
 * Local progress for one property track. The master axis is never eased or
 * rewritten before this function is called.
 */
export function readerAppearanceTrackProgress(
  masterProgress: number,
  track: ReaderAppearanceNumberTrack,
): number {
  const master = clamp01(masterProgress);
  if (master <= track.startMasterProgress) {
    return 0;
  }
  if (master >= track.endMasterProgress ||
    track.endMasterProgress <= track.startMasterProgress) {
    return 1;
  }
  const local = (master - track.startMasterProgress) /
    (track.endMasterProgress - track.startMasterProgress);
  return applyTrackEasing(local, track.easing);
}

export function sampleReaderAppearanceNumberTrack(
  masterProgress: number,
  track: ReaderAppearanceNumberTrack,
): number {
  const local = readerAppearanceTrackProgress(masterProgress, track);
  return track.from + (track.to - track.from) * local;
}

export function readerAppearanceMeasuredTravelVp(axis: ReaderAppearanceMeasuredAxis): number {
  if (!Number.isFinite(axis.quickGrabberScreenY) ||
    !Number.isFinite(axis.fullGrabberScreenY)) {
    return 0;
  }
  return Math.abs(axis.quickGrabberScreenY - axis.fullGrabberScreenY);
}

/** Convert the grabber's actual screen Y into the sole spatial progress. */
export function readerAppearanceMasterProgressFromScreenY(
  grabberScreenY: number,
  axis: ReaderAppearanceMeasuredAxis,
): number {
  const signedTravel = axis.quickGrabberScreenY - axis.fullGrabberScreenY;
  if (!Number.isFinite(grabberScreenY) || !Number.isFinite(signedTravel) ||
    Math.abs(signedTravel) <= Number.EPSILON) {
    return 0;
  }
  return clamp01((axis.quickGrabberScreenY - grabberScreenY) / signedTravel);
}

export function readerAppearanceGrabberScreenYFromMasterProgress(
  masterProgress: number,
  axis: ReaderAppearanceMeasuredAxis,
): number {
  const master = clamp01(masterProgress);
  if (!Number.isFinite(axis.quickGrabberScreenY) ||
    !Number.isFinite(axis.fullGrabberScreenY)) {
    return 0;
  }
  return axis.quickGrabberScreenY +
    (axis.fullGrabberScreenY - axis.quickGrabberScreenY) * master;
}

/** Map p=0..1 directly onto Figma N's evidenced 11.111%..75% window. */
export function readerAppearanceFigmaFramePercent(masterProgress: number): number {
  const master = clamp01(masterProgress);
  return READER_APPEARANCE_FIGMA_N_REVIEW_START_PERCENT +
    (READER_APPEARANCE_FIGMA_N_REVIEW_END_PERCENT -
      READER_APPEARANCE_FIGMA_N_REVIEW_START_PERCENT) * master;
}

function track(
  from: number,
  to: number,
  startMasterProgress: number = 0,
  endMasterProgress: number = 1,
  easing: ReaderAppearanceTrackEasing = 'linear',
): ReaderAppearanceNumberTrack {
  return { startMasterProgress, endMasterProgress, from, to, easing };
}

function constantTrack(value: number): ReaderAppearanceNumberTrack {
  return track(value, value, 0, 1, 'linear');
}

function actorTracks(
  id: ReaderAppearanceMotionActorId,
  authority: ReaderAppearanceTrackAuthority,
  source: ReaderAppearanceMotionRect,
  target: ReaderAppearanceMotionRect,
  start: number,
  end: number,
  easing: ReaderAppearanceTrackEasing,
  opacity: ReaderAppearanceNumberTrack = constantTrack(1),
  translateX: ReaderAppearanceNumberTrack = constantTrack(0),
  translateY: ReaderAppearanceNumberTrack = constantTrack(0),
  blurVp: ReaderAppearanceNumberTrack = constantTrack(0),
): ReaderAppearanceActorTracks {
  return {
    id,
    authority,
    x: track(source.x, target.x, start, end, easing),
    y: track(source.y, target.y, start, end, easing),
    width: track(source.width, target.width, start, end, easing),
    height: track(source.height, target.height, start, end, easing),
    opacity,
    translateX,
    translateY,
    blurVp,
  };
}

function effectTracks(
  id: ReaderAppearanceMotionActorId,
  opacity: ReaderAppearanceNumberTrack,
  translateY: ReaderAppearanceNumberTrack = constantTrack(0),
  blurVp: ReaderAppearanceNumberTrack = constantTrack(0),
  rect: ReaderAppearanceMotionRect = { x: 0, y: 0, width: 0, height: 0 },
): ReaderAppearanceActorTracks {
  return actorTracks(
    id,
    'figma-n',
    rect,
    rect,
    0,
    1,
    'linear',
    opacity,
    constantTrack(0),
    translateY,
    blurVp,
  );
}

const FIGMA_GEOMETRY_START = 0;
const FIGMA_GEOMETRY_END = READER_APPEARANCE_SHARED_GEOMETRY_END_PROGRESS;
const FIGMA_FIXED_CHROME_START = 10 / 23;
const FIGMA_CONTENT_SURFACE_START = 7 / 23;
const FIGMA_APPEARANCE_START = 8 / 23;
const FIGMA_CONTENT_END = 14 / 23;
const FIGMA_THEME_LIBRARY_END = 15 / 23;
const FIGMA_FONT_LIBRARY_START = 48 / 115;
const FIGMA_HEADER_FONT_END = 17 / 23;
const FIGMA_QUICK_FADE_END = 18 / 23;

const QUICK_MORPH_BASE_X = 13;
const QUICK_MORPH_BASE_Y = 57;
const THEME_LOCAL_X: number[] = [12, 91.5, 171, 250.5];
const THEME_LOCAL_Y: number[] = [42.39, 107.19];
const THEME_TRANSLATE_X: number[] = [-1, -14, -27, -40];
const THEME_TRANSLATE_Y: number[] = [-8.492, -45.292];
const FONT_LOCAL_X: number[] = [37, 103.5, 170, 236.5];
const FONT_LOCAL_Y: number[] = [253.38, 284.38];

function themeRect(index: number, expandedSize: boolean): ReaderAppearanceMotionRect {
  const column = index % 4;
  const row = Math.floor(index / 4);
  return {
    x: QUICK_MORPH_BASE_X + THEME_LOCAL_X[column],
    y: QUICK_MORPH_BASE_Y + THEME_LOCAL_Y[row],
    width: expandedSize ? 73.5 : 62.5,
    height: expandedSize ? 58.8 : 24,
  };
}

function fontRect(index: number): ReaderAppearanceMotionRect {
  const column = index % 4;
  const row = Math.floor(index / 4);
  return {
    x: QUICK_MORPH_BASE_X + FONT_LOCAL_X[column],
    y: QUICK_MORPH_BASE_Y + FONT_LOCAL_Y[row],
    width: 62.5,
    height: 27,
  };
}

const themeIds: ReaderAppearanceMotionActorId[] = [
  'ThemeDay', 'ThemeWarm', 'ThemeNight', 'ThemeWarmNight',
  'ThemePaper', 'ThemeGreen', 'ThemePaperNight', 'ThemeGreenNight',
];
const fontIds: ReaderAppearanceMotionActorId[] = [
  'Font0', 'Font1', 'Font2', 'Font3', 'Font4', 'Font5', 'Font6', 'Font7',
];

const appearanceTracks: ReaderAppearanceActorTracks[] = [
  effectTracks(
    'BrightnessRail',
    track(1, 0, FIGMA_FIXED_CHROME_START, 1, 'ease-out'),
    track(0, 15, FIGMA_FIXED_CHROME_START, 1, 'ease-out'),
    track(0, 12, FIGMA_FIXED_CHROME_START, 1, 'ease-out'),
  ),
  effectTracks(
    'ModuleNav',
    track(1, 0, FIGMA_FIXED_CHROME_START, 1, 'ease-out'),
    track(0, 20, FIGMA_FIXED_CHROME_START, 1, 'ease-out'),
    track(0, 12, FIGMA_FIXED_CHROME_START, 1, 'ease-out'),
  ),
  actorTracks(
    'MorphStage',
    'figma-n',
    { x: 0, y: READER_APPEARANCE_DESIGN_TRAVEL_VP, width: READER_APPEARANCE_STAGE_WIDTH,
      height: READER_APPEARANCE_QUICK_HEIGHT },
    { x: 0, y: 0, width: READER_APPEARANCE_STAGE_WIDTH,
      height: READER_APPEARANCE_FULL_HEIGHT },
    0,
    1,
    'ease-out',
  ),
  effectTracks(
    'ContentSurface',
    track(0, 1, FIGMA_CONTENT_SURFACE_START, FIGMA_CONTENT_END, 'ease-out'),
    constantTrack(0),
    constantTrack(0),
    { x: 13, y: 57, width: 338, height: 666 },
  ),
  effectTracks(
    'AppearanceContent',
    track(0, 1, FIGMA_APPEARANCE_START, FIGMA_CONTENT_END, 'ease-out'),
    constantTrack(0),
    constantTrack(0),
    { x: 13, y: 57, width: 338, height: 989 },
  ),
  effectTracks(
    'ThemeLibrary',
    track(0, 1, FIGMA_APPEARANCE_START, FIGMA_THEME_LIBRARY_END, 'ease-out'),
    constantTrack(0),
    constantTrack(0),
    { x: 24, y: 68, width: 316, height: 210 },
  ),
  effectTracks(
    'FontLibrary',
    track(0, 1, FIGMA_FONT_LIBRARY_START, FIGMA_HEADER_FONT_END, 'ease-out'),
    constantTrack(0),
    constantTrack(0),
    { x: 24, y: 277.98, width: 316, height: 136 },
  ),
  actorTracks(
    'QuickMorph',
    'figma-n',
    { x: QUICK_MORPH_BASE_X, y: QUICK_MORPH_BASE_Y, width: 286, height: 190 },
    { x: QUICK_MORPH_BASE_X, y: QUICK_MORPH_BASE_Y, width: 338, height: 666 },
    FIGMA_GEOMETRY_START,
    FIGMA_GEOMETRY_END,
    'ease-out',
    track(1, 0, FIGMA_APPEARANCE_START, FIGMA_QUICK_FADE_END, 'ease-out'),
    track(-0.896, 0, FIGMA_GEOMETRY_START, FIGMA_GEOMETRY_END, 'ease-out'),
    track(-28.007, 0, FIGMA_GEOMETRY_START, FIGMA_GEOMETRY_END, 'ease-out'),
  ),
  actorTracks(
    'ThemeHeader',
    'figma-n',
    { x: 25, y: 77, width: 262, height: 15.898 },
    { x: 25, y: 77, width: 312, height: 20 },
    FIGMA_GEOMETRY_START,
    FIGMA_GEOMETRY_END,
    'ease-out',
    constantTrack(1),
    track(-1, 0, FIGMA_GEOMETRY_START, FIGMA_GEOMETRY_END, 'ease-out'),
    track(-5, 0, FIGMA_GEOMETRY_START, FIGMA_GEOMETRY_END, 'ease-out'),
  ),
  actorTracks(
    'QuickDivider',
    'figma-n',
    { x: 23, y: 276.98, width: 262, height: 1 },
    { x: 23, y: 276.98, width: 316, height: 1 },
    FIGMA_GEOMETRY_START,
    FIGMA_GEOMETRY_END,
    'ease-out',
    constantTrack(1),
    track(1, 0, FIGMA_GEOMETRY_START, FIGMA_GEOMETRY_END, 'ease-out'),
    track(-122.082, 0, FIGMA_GEOMETRY_START, FIGMA_GEOMETRY_END, 'ease-out'),
  ),
  actorTracks(
    'FontHeader',
    'figma-n',
    { x: 25, y: 287.98, width: 262, height: 10 },
    { x: 25, y: 287.98, width: 312, height: 20 },
    FIGMA_GEOMETRY_START,
    FIGMA_GEOMETRY_END,
    'ease-out',
    constantTrack(1),
    track(-1, 0, FIGMA_GEOMETRY_START, FIGMA_GEOMETRY_END, 'ease-out'),
    track(-129.082, 0, FIGMA_GEOMETRY_START, FIGMA_GEOMETRY_END, 'ease-out'),
  ),
  effectTracks(
    'Header',
    track(0, 1, FIGMA_APPEARANCE_START, FIGMA_HEADER_FONT_END, 'ease-out'),
    track(-12, 0, FIGMA_APPEARANCE_START, FIGMA_HEADER_FONT_END, 'ease-out'),
    track(8, 0, FIGMA_APPEARANCE_START, FIGMA_HEADER_FONT_END, 'ease-out'),
    { x: 13, y: 19, width: 338, height: 30 },
  ),
  effectTracks(
    'Typography',
    track(0, 1, FIGMA_CONTENT_END, 1, 'ease-out'),
    constantTrack(0),
    constantTrack(0),
    { x: 24, y: 423.98, width: 316, height: 406 },
  ),
];

for (let index = 0; index < themeIds.length; index += 1) {
  const column = index % 4;
  const row = Math.floor(index / 4);
  appearanceTracks.push(actorTracks(
    themeIds[index],
    'figma-n',
    themeRect(index, false),
    themeRect(index, true),
    FIGMA_GEOMETRY_START,
    FIGMA_GEOMETRY_END,
    'ease-out',
    constantTrack(1),
    track(THEME_TRANSLATE_X[column], 0, FIGMA_GEOMETRY_START, FIGMA_GEOMETRY_END, 'ease-out'),
    track(THEME_TRANSLATE_Y[row], 0, FIGMA_GEOMETRY_START, FIGMA_GEOMETRY_END, 'ease-out'),
  ));
}

for (let index = 0; index < fontIds.length; index += 1) {
  const rect = fontRect(index);
  appearanceTracks.push(actorTracks(
    fontIds[index],
    'figma-n',
    rect,
    rect,
    FIGMA_GEOMETRY_START,
    FIGMA_GEOMETRY_END,
    'ease-out',
    constantTrack(1),
    track(-26, 0, FIGMA_GEOMETRY_START, FIGMA_GEOMETRY_END, 'ease-out'),
    track(-138.482, 0, FIGMA_GEOMETRY_START, FIGMA_GEOMETRY_END, 'ease-out'),
  ));
}

/** Runtime actor tracks driven by the one measured grabber progress. */
export const READER_APPEARANCE_ACTOR_TRACKS: ReaderAppearanceActorTracks[] = appearanceTracks;

function tracksFor(id: ReaderAppearanceMotionActorId): ReaderAppearanceActorTracks {
  for (let index = 0; index < READER_APPEARANCE_ACTOR_TRACKS.length; index += 1) {
    const candidate = READER_APPEARANCE_ACTOR_TRACKS[index];
    if (candidate.id === id) {
      return candidate;
    }
  }
  throw new Error(`Missing appearance actor tracks: ${id}`);
}

function sampleActor(
  id: ReaderAppearanceMotionActorId,
  masterProgress: number,
  fullHeight: number,
): ReaderAppearanceMotionActorFrame {
  const actor = tracksFor(id);
  const candidateTracks: ReaderAppearanceNumberTrack[] = [
    actor.x, actor.y, actor.width, actor.height,
    actor.opacity, actor.translateX, actor.translateY, actor.blurVp,
  ];
  let primaryTrack = actor.x;
  for (let index = 0; index < candidateTracks.length; index += 1) {
    if (candidateTracks[index].from !== candidateTracks[index].to) {
      primaryTrack = candidateTracks[index];
      break;
    }
  }
  const safeFullHeight = Math.max(READER_APPEARANCE_QUICK_HEIGHT, finiteOr(
    fullHeight,
    READER_APPEARANCE_FULL_HEIGHT,
  ));
  if (id === 'MorphStage') {
    const stageProgress = readerAppearanceTrackProgress(masterProgress, actor.height);
    const shellHeight = READER_APPEARANCE_QUICK_HEIGHT +
      (safeFullHeight - READER_APPEARANCE_QUICK_HEIGHT) * stageProgress;
    return {
      trackProgress: stageProgress,
      x: 0,
      y: safeFullHeight - shellHeight,
      width: READER_APPEARANCE_STAGE_WIDTH,
      height: shellHeight,
      opacity: 1,
      translateX: 0,
      translateY: 0,
      blurVp: 0,
    };
  }
  return {
    trackProgress: readerAppearanceTrackProgress(masterProgress, primaryTrack),
    x: finiteOr(sampleReaderAppearanceNumberTrack(masterProgress, actor.x), 0),
    y: finiteOr(sampleReaderAppearanceNumberTrack(masterProgress, actor.y), 0),
    width: Math.max(0, finiteOr(sampleReaderAppearanceNumberTrack(masterProgress, actor.width), 0)),
    height: Math.max(0, finiteOr(sampleReaderAppearanceNumberTrack(masterProgress, actor.height), 0)),
    opacity: clamp01(sampleReaderAppearanceNumberTrack(masterProgress, actor.opacity)),
    translateX: finiteOr(sampleReaderAppearanceNumberTrack(masterProgress, actor.translateX), 0),
    translateY: finiteOr(sampleReaderAppearanceNumberTrack(masterProgress, actor.translateY), 0),
    blurVp: Math.max(0, finiteOr(sampleReaderAppearanceNumberTrack(masterProgress, actor.blurVp), 0)),
  };
}

/**
 * Sample the one persistent layered actor graph. Calling this with the same p always
 * returns the same frame, regardless of direction, gesture history or clock.
 */
export function sampleReaderAppearanceMasterProgress(
  masterProgress: number,
  fullHeight: number = READER_APPEARANCE_FULL_HEIGHT,
): ReaderAppearanceMotionFrame {
  const master = clamp01(masterProgress);
  const safeFullHeight = Math.max(READER_APPEARANCE_QUICK_HEIGHT, finiteOr(
    fullHeight,
    READER_APPEARANCE_FULL_HEIGHT,
  ));
  const brightnessRail = sampleActor('BrightnessRail', master, safeFullHeight);
  const moduleNav = sampleActor('ModuleNav', master, safeFullHeight);
  const morphStage = sampleActor('MorphStage', master, safeFullHeight);
  const contentSurface = sampleActor('ContentSurface', master, safeFullHeight);
  const appearanceContent = sampleActor('AppearanceContent', master, safeFullHeight);
  const themeLibrary = sampleActor('ThemeLibrary', master, safeFullHeight);
  const fontLibrary = sampleActor('FontLibrary', master, safeFullHeight);
  const quickMorph = sampleActor('QuickMorph', master, safeFullHeight);
  const themeHeader = sampleActor('ThemeHeader', master, safeFullHeight);
  const quickDivider = sampleActor('QuickDivider', master, safeFullHeight);
  const fontHeader = sampleActor('FontHeader', master, safeFullHeight);
  const header = sampleActor('Header', master, safeFullHeight);
  const typography = sampleActor('Typography', master, safeFullHeight);
  const themeItems: ReaderAppearanceMotionActorFrame[] = [];
  const fontItems: ReaderAppearanceMotionActorFrame[] = [];
  const samples: ReaderAppearanceMotionActorSample[] = [];

  const add = (id: ReaderAppearanceMotionActorId, frame: ReaderAppearanceMotionActorFrame): void => {
    samples.push({ id, frame });
  };
  add('BrightnessRail', brightnessRail);
  add('ModuleNav', moduleNav);
  add('MorphStage', morphStage);
  add('ContentSurface', contentSurface);
  add('AppearanceContent', appearanceContent);
  add('ThemeLibrary', themeLibrary);
  add('FontLibrary', fontLibrary);
  add('QuickMorph', quickMorph);
  add('ThemeHeader', themeHeader);
  for (let index = 0; index < themeIds.length; index += 1) {
    const frame = sampleActor(themeIds[index], master, safeFullHeight);
    themeItems.push(frame);
    add(themeIds[index], frame);
  }
  add('QuickDivider', quickDivider);
  add('FontHeader', fontHeader);
  for (let index = 0; index < fontIds.length; index += 1) {
    const frame = sampleActor(fontIds[index], master, safeFullHeight);
    fontItems.push(frame);
    add(fontIds[index], frame);
  }
  add('Header', header);
  add('Typography', typography);

  return {
    masterProgress: master,
    figmaFramePercent: readerAppearanceFigmaFramePercent(master),
    shellHeight: morphStage.height,
    shellTranslateY: morphStage.y,
    brightnessRail,
    moduleNav,
    morphStage,
    contentSurface,
    appearanceContent,
    themeLibrary,
    fontLibrary,
    quickMorph,
    themeHeader,
    themeItems,
    quickDivider,
    fontHeader,
    fontItems,
    header,
    typography,
    actorSamples: samples,
  };
}
