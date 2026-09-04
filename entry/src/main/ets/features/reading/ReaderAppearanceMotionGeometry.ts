/**
 * Phone appearance Quick <-> Full motion geometry.
 *
 * `masterProgress` is the only spatial coordinate. It is produced from the
 * grabber's measured screen-space position and is then used, unchanged, to
 * sample every actor/property track. Expand and collapse are therefore the
 * same function traversed in opposite directions.
 *
 * The published Figma N export (`1505:18040`) supplies actor endpoints and
 * independent reveal/fade tracks. Product direct-manipulation extends every
 * shared actor's spatial interpolation across p=0 -> 1: the components keep
 * separating, moving and resizing until the grabber reaches Full. This timing
 * correction is explicit product authority, not a claim that final N2 motion
 * has been published in Figma.
 */

export type ReaderAppearanceMotionActorId =
  'BrightnessRail' |
  'ModuleNav' |
  'MorphStage' |
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
  'ThemeActions' |
  'FontImport' |
  'Typography';

export type ReaderAppearanceTrackEasing = 'linear' | 'ease-out' | 'ease-in-out';
export type ReaderAppearanceTrackAuthority =
  'interaction-axis' |
  'legacy-figma-n' |
  'legacy-static-endpoint' |
  'product-direct-manipulation' |
  'product-mapping-alias';

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
  /** Corresponding position on the legacy N review timeline, for provenance. */
  figmaFramePercent: number;
  shellHeight: number;
  shellTranslateY: number;
  brightnessRail: ReaderAppearanceMotionActorFrame;
  moduleNav: ReaderAppearanceMotionActorFrame;
  morphStage: ReaderAppearanceMotionActorFrame;
  quickMorph: ReaderAppearanceMotionActorFrame;
  themeHeader: ReaderAppearanceMotionActorFrame;
  themeItems: ReaderAppearanceMotionActorFrame[];
  quickDivider: ReaderAppearanceMotionActorFrame;
  fontHeader: ReaderAppearanceMotionActorFrame;
  fontItems: ReaderAppearanceMotionActorFrame[];
  header: ReaderAppearanceMotionActorFrame;
  themeActions: ReaderAppearanceMotionActorFrame;
  fontImport: ReaderAppearanceMotionActorFrame;
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
export const READER_APPEARANCE_FINAL_N2_PUBLISHED = false;
/** User-approved runtime timing correction while final N2 remains unpublished. */
export const READER_APPEARANCE_SHARED_GEOMETRY_END_PROGRESS = 1;

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
  'Header',
  'ThemeActions',
  'FontImport',
  'Typography',
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

/** Product guard while legacy N remains a fixed 364vp coordinate space. */
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
  const shellBottom = frame.shellTranslateY + frame.shellHeight;
  const available = Math.max(0, shellBottom - surfaceTop);
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
): ReaderAppearanceActorTracks {
  return actorTracks(
    id,
    'legacy-figma-n',
    { x: 0, y: 0, width: 0, height: 0 },
    { x: 0, y: 0, width: 0, height: 0 },
    0,
    1,
    'linear',
    opacity,
    constantTrack(0),
    translateY,
    blurVp,
  );
}

function productMappedEffectTracks(
  id: ReaderAppearanceMotionActorId,
  opacity: ReaderAppearanceNumberTrack,
): ReaderAppearanceActorTracks {
  return actorTracks(
    id,
    'product-mapping-alias',
    { x: 0, y: 0, width: 0, height: 0 },
    { x: 0, y: 0, width: 0, height: 0 },
    0,
    1,
    'linear',
    opacity,
  );
}

const SHARED_GEOMETRY_START = 0;
const SHARED_GEOMETRY_END = READER_APPEARANCE_SHARED_GEOMETRY_END_PROGRESS;
const LEGACY_FIXED_CHROME_START = 10 / 23;
const LEGACY_APPEARANCE_START = 8 / 23;
const LEGACY_CONTENT_END = 14 / 23;
const LEGACY_THEME_LIBRARY_END = 15 / 23;
const LEGACY_FONT_LIBRARY_START = 48 / 115;
const LEGACY_HEADER_FONT_END = 17 / 23;

const THEME_SOURCE_X: number[] = [23.104, 89.604, 156.104, 222.604];
const THEME_SOURCE_Y: number[] = [468.891, 496.891];
const THEME_TARGET_X: number[] = [25, 104.5, 184, 263.5];
const THEME_TARGET_Y: number[] = [99.39, 164.19];
const FONT_SOURCE_X: number[] = [23.104, 89.604, 156.104, 222.604];
const FONT_SOURCE_Y: number[] = [549.891, 580.891];
const FONT_TARGET_X: number[] = [24, 105, 186, 267];
const FONT_TARGET_Y: number[] = [307.98, 345.98];

function themeRect(index: number, target: boolean): ReaderAppearanceMotionRect {
  const column = index % 4;
  const row = Math.floor(index / 4);
  return target ? {
    x: THEME_TARGET_X[column], y: THEME_TARGET_Y[row], width: 73.5, height: 58.8,
  } : {
    x: THEME_SOURCE_X[column], y: THEME_SOURCE_Y[row], width: 62.5, height: 24,
  };
}

function fontRect(index: number, target: boolean): ReaderAppearanceMotionRect {
  const column = index % 4;
  const row = Math.floor(index / 4);
  return target ? {
    x: FONT_TARGET_X[column], y: FONT_TARGET_Y[row], width: 73, height: 30,
  } : {
    x: FONT_SOURCE_X[column], y: FONT_SOURCE_Y[row], width: 62.5, height: 27,
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
    track(1, 0, LEGACY_FIXED_CHROME_START, 1, 'ease-out'),
    track(0, 15, LEGACY_FIXED_CHROME_START, 1, 'ease-out'),
    track(0, 12, LEGACY_FIXED_CHROME_START, 1, 'ease-out'),
  ),
  effectTracks(
    'ModuleNav',
    track(1, 0, LEGACY_FIXED_CHROME_START, 1, 'ease-out'),
    track(0, 20, LEGACY_FIXED_CHROME_START, 1, 'ease-out'),
    track(0, 12, LEGACY_FIXED_CHROME_START, 1, 'ease-out'),
  ),
  actorTracks(
    'MorphStage',
    'interaction-axis',
    { x: 0, y: READER_APPEARANCE_DESIGN_TRAVEL_VP, width: READER_APPEARANCE_STAGE_WIDTH,
      height: READER_APPEARANCE_QUICK_HEIGHT },
    { x: 0, y: 0, width: READER_APPEARANCE_STAGE_WIDTH,
      height: READER_APPEARANCE_FULL_HEIGHT },
    0,
    1,
    'linear',
  ),
  actorTracks(
    'QuickMorph',
    'product-direct-manipulation',
    { x: 12.104, y: 434.993, width: 286, height: 190 },
    { x: 13, y: 57, width: 338, height: 666 },
    SHARED_GEOMETRY_START,
    SHARED_GEOMETRY_END,
    'ease-out',
  ),
  actorTracks(
    'ThemeHeader',
    'product-direct-manipulation',
    { x: 23.104, y: 449.993, width: 262, height: 15.898 },
    { x: 25, y: 77, width: 312, height: 20 },
    SHARED_GEOMETRY_START,
    SHARED_GEOMETRY_END,
    'ease-out',
  ),
  actorTracks(
    'QuickDivider',
    'product-direct-manipulation',
    { x: 23.104, y: 532.891, width: 262, height: 1 },
    { x: 23, y: 276.98, width: 316, height: 1 },
    SHARED_GEOMETRY_START,
    SHARED_GEOMETRY_END,
    'ease-out',
  ),
  actorTracks(
    'FontHeader',
    'product-direct-manipulation',
    { x: 23.104, y: 536.891, width: 262, height: 10 },
    { x: 25, y: 287.98, width: 312, height: 20 },
    SHARED_GEOMETRY_START,
    SHARED_GEOMETRY_END,
    'ease-out',
  ),
  effectTracks(
    'Header',
    track(0, 1, LEGACY_APPEARANCE_START, LEGACY_HEADER_FONT_END, 'ease-out'),
    track(-12, 0, LEGACY_APPEARANCE_START, LEGACY_HEADER_FONT_END, 'ease-out'),
    track(8, 0, LEGACY_APPEARANCE_START, LEGACY_HEADER_FONT_END, 'ease-out'),
  ),
  productMappedEffectTracks('ThemeActions',
    track(0, 1, LEGACY_APPEARANCE_START, LEGACY_THEME_LIBRARY_END, 'ease-out')),
  productMappedEffectTracks('FontImport',
    track(0, 1, LEGACY_FONT_LIBRARY_START, LEGACY_HEADER_FONT_END, 'ease-out')),
  effectTracks('Typography',
    track(0, 1, LEGACY_CONTENT_END, 1, 'ease-out')),
];

for (let index = 0; index < themeIds.length; index += 1) {
  appearanceTracks.push(actorTracks(
    themeIds[index],
    'product-direct-manipulation',
    themeRect(index, false),
    themeRect(index, true),
    SHARED_GEOMETRY_START,
    SHARED_GEOMETRY_END,
    'ease-out',
  ));
}

for (let index = 0; index < fontIds.length; index += 1) {
  appearanceTracks.push(actorTracks(
    fontIds[index],
    'product-direct-manipulation',
    fontRect(index, false),
    fontRect(index, true),
    SHARED_GEOMETRY_START,
    SHARED_GEOMETRY_END,
    'ease-out',
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

function isBottomAnchoredSharedActor(id: ReaderAppearanceMotionActorId): boolean {
  if (id === 'MorphStage') {
    return false;
  }
  for (let index = 0; index < READER_APPEARANCE_SHARED_ACTOR_IDS.length; index += 1) {
    if (READER_APPEARANCE_SHARED_ACTOR_IDS[index] === id) {
      return true;
    }
  }
  return false;
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
    const shellHeight = READER_APPEARANCE_QUICK_HEIGHT +
      (safeFullHeight - READER_APPEARANCE_QUICK_HEIGHT) * clamp01(masterProgress);
    return {
      trackProgress: clamp01(masterProgress),
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
  const sourceYOffset = isBottomAnchoredSharedActor(id) ?
    safeFullHeight - READER_APPEARANCE_FULL_HEIGHT : 0;
  const yProgress = readerAppearanceTrackProgress(masterProgress, actor.y);
  const sampledY = actor.y.from + sourceYOffset +
    (actor.y.to - actor.y.from - sourceYOffset) * yProgress;
  return {
    trackProgress: readerAppearanceTrackProgress(masterProgress, primaryTrack),
    x: finiteOr(sampleReaderAppearanceNumberTrack(masterProgress, actor.x), 0),
    y: finiteOr(sampledY, 0),
    width: Math.max(0, finiteOr(sampleReaderAppearanceNumberTrack(masterProgress, actor.width), 0)),
    height: Math.max(0, finiteOr(sampleReaderAppearanceNumberTrack(masterProgress, actor.height), 0)),
    opacity: clamp01(sampleReaderAppearanceNumberTrack(masterProgress, actor.opacity)),
    translateX: finiteOr(sampleReaderAppearanceNumberTrack(masterProgress, actor.translateX), 0),
    translateY: finiteOr(sampleReaderAppearanceNumberTrack(masterProgress, actor.translateY), 0),
    blurVp: Math.max(0, finiteOr(sampleReaderAppearanceNumberTrack(masterProgress, actor.blurVp), 0)),
  };
}

/**
 * Sample the one persistent visual tree. Calling this with the same p always
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
  const quickMorph = sampleActor('QuickMorph', master, safeFullHeight);
  const themeHeader = sampleActor('ThemeHeader', master, safeFullHeight);
  const quickDivider = sampleActor('QuickDivider', master, safeFullHeight);
  const fontHeader = sampleActor('FontHeader', master, safeFullHeight);
  const header = sampleActor('Header', master, safeFullHeight);
  const themeActions = sampleActor('ThemeActions', master, safeFullHeight);
  const fontImport = sampleActor('FontImport', master, safeFullHeight);
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
  add('ThemeActions', themeActions);
  add('FontImport', fontImport);
  add('Typography', typography);

  return {
    masterProgress: master,
    figmaFramePercent: readerAppearanceFigmaFramePercent(master),
    shellHeight: morphStage.height,
    shellTranslateY: morphStage.y,
    brightnessRail,
    moduleNav,
    morphStage,
    quickMorph,
    themeHeader,
    themeItems,
    quickDivider,
    fontHeader,
    fontItems,
    header,
    themeActions,
    fontImport,
    typography,
    actorSamples: samples,
  };
}
