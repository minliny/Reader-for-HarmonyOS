/**
 * Phone appearance Quick <-> Full motion geometry.
 *
 * Motion V2 has one spatial source of truth: physical expansion `e` in [0, 1].
 * Click, drag, release settlement and reverse playback only decide how `e`
 * changes. Every visible actor is sampled from this file, so changing drivers
 * can never switch trees or jump to a second set of keyframes.
 *
 * Figma sources of record:
 * - N / Appearance Expand: `1505:18040` (authored displacement evidence).
 * - Full static AppearanceContent: `1082:235` (corrected terminal layout).
 *
 * N's exported shared reflow ended at product 183ms and then handed off to a
 * root dissolve. That handoff is deliberately not a runtime contract: shared
 * actors retain N's source/direction and corrected Full endpoints, but their
 * rects remain continuous for the complete physical range e=0 -> 1.
 */

export type ReaderAppearanceMotionProfile = 'expandN' | 'collapseO';

export type ReaderAppearanceMotionActorId =
  'BrightnessRail' |
  'ModuleNav' |
  'MorphStage' |
  'QuickMorph' |
  'ContentSurface' |
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

export interface ReaderAppearanceMotionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ReaderAppearanceMotionActorFrame extends ReaderAppearanceMotionRect {
  opacity: number;
  /** Compatibility fields for existing ArkUI views. Shared actors keep these at zero. */
  translateX: number;
  translateY: number;
  blurVp: number;
}

export interface ReaderAppearanceMotionActorSample {
  id: ReaderAppearanceMotionActorId;
  frame: ReaderAppearanceMotionActorFrame;
}

export interface ReaderAppearanceMotionFrame {
  /** The only spatial progress. It is always Quick=0 -> Full=1. */
  expansionProgress: number;
  shellHeight: number;
  shellTranslateY: number;
  brightnessRail: ReaderAppearanceMotionActorFrame;
  moduleNav: ReaderAppearanceMotionActorFrame;
  morphStage: ReaderAppearanceMotionActorFrame;

  /** Persistent shared surface and its independently positioned descendants. */
  quickMorph: ReaderAppearanceMotionActorFrame;
  themeHeader: ReaderAppearanceMotionActorFrame;
  themeItems: ReaderAppearanceMotionActorFrame[];
  quickDivider: ReaderAppearanceMotionActorFrame;
  fontHeader: ReaderAppearanceMotionActorFrame;
  fontItems: ReaderAppearanceMotionActorFrame[];

  /** Full-only actors. These never fade an entire Full root over the shared tree. */
  header: ReaderAppearanceMotionActorFrame;
  themeActions: ReaderAppearanceMotionActorFrame;
  fontImport: ReaderAppearanceMotionActorFrame;
  typography: ReaderAppearanceMotionActorFrame;

  /** Compatibility aliases used by the presentation-only Full panel. */
  contentSurface: ReaderAppearanceMotionActorFrame;
  appearanceContent: ReaderAppearanceMotionActorFrame;
  themeLibrary: ReaderAppearanceMotionActorFrame;
  fontLibrary: ReaderAppearanceMotionActorFrame;

  actorSamples: ReaderAppearanceMotionActorSample[];
}

export const READER_APPEARANCE_EXPAND_DURATION_MS = 420;
export const READER_APPEARANCE_COLLAPSE_DURATION_MS = 360;
export const READER_APPEARANCE_QUICK_HEIGHT = 330;
export const READER_APPEARANCE_FULL_HEIGHT = 736;
export const READER_APPEARANCE_STAGE_WIDTH = 364;
export const READER_APPEARANCE_SHELL_TRAVEL_VP =
  READER_APPEARANCE_FULL_HEIGHT - READER_APPEARANCE_QUICK_HEIGHT;

/** Actors whose identity and geometry persist from Quick through Full. */
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

/** Full-only content reveals around, never on top of, the shared actors. */
export const READER_APPEARANCE_FULL_ONLY_ACTOR_IDS: ReaderAppearanceMotionActorId[] = [
  'ContentSurface',
  'Header',
  'ThemeActions',
  'FontImport',
  'Typography',
];

/** Fixed-screen Quick chrome is not a child of the moving/clipped shell tree. */
export const READER_APPEARANCE_FIXED_SCREEN_ACTOR_IDS: ReaderAppearanceMotionActorId[] = [
  'BrightnessRail',
  'ModuleNav',
];

export const READER_APPEARANCE_QUICK_MORPH_SOURCE_RECT: ReaderAppearanceMotionRect = {
  x: 12.104,
  y: 434.993,
  width: 286,
  height: 190,
};

export const READER_APPEARANCE_QUICK_MORPH_TARGET_RECT: ReaderAppearanceMotionRect = {
  x: 13,
  y: 57,
  width: 338,
  height: 666,
};

export const READER_APPEARANCE_THEME_HEADER_SOURCE_RECT: ReaderAppearanceMotionRect = {
  x: 23.104,
  y: 449.993,
  width: 262,
  height: 15.898,
};

export const READER_APPEARANCE_THEME_HEADER_TARGET_RECT: ReaderAppearanceMotionRect = {
  x: 25,
  y: 77,
  width: 312,
  height: 20,
};

export const READER_APPEARANCE_DIVIDER_SOURCE_RECT: ReaderAppearanceMotionRect = {
  x: 23.104,
  y: 532.891,
  width: 262,
  height: 1,
};

export const READER_APPEARANCE_DIVIDER_TARGET_RECT: ReaderAppearanceMotionRect = {
  x: 23,
  y: 276.98,
  width: 316,
  height: 1,
};

export const READER_APPEARANCE_FONT_HEADER_SOURCE_RECT: ReaderAppearanceMotionRect = {
  x: 23.104,
  y: 536.891,
  width: 262,
  height: 10,
};

export const READER_APPEARANCE_FONT_HEADER_TARGET_RECT: ReaderAppearanceMotionRect = {
  x: 25,
  y: 287.98,
  width: 312,
  height: 20,
};

export const READER_APPEARANCE_FONT_TARGET_X: number[] = [24, 105, 186, 267];
export const READER_APPEARANCE_FONT_TARGET_Y: number[] = [307.98, 345.98];

const READER_APPEARANCE_THEME_SOURCE_X: number[] = [23.104, 89.604, 156.104, 222.604];
const READER_APPEARANCE_THEME_SOURCE_Y: number[] = [468.891, 496.891];
const READER_APPEARANCE_THEME_TARGET_X: number[] = [25, 104.5, 184, 263.5];
const READER_APPEARANCE_THEME_TARGET_Y: number[] = [99.39, 164.19];
const READER_APPEARANCE_FONT_SOURCE_X: number[] = [23.104, 89.604, 156.104, 222.604];
const READER_APPEARANCE_FONT_SOURCE_Y: number[] = [549.891, 580.891];

const EASE_OUT_X1 = 0;
const EASE_OUT_Y1 = 0;
const EASE_OUT_X2 = 0.58;
const EASE_OUT_Y2 = 1;

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
}

function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

function cubicCoordinate(parameter: number, first: number, second: number): number {
  const inverse = 1 - parameter;
  return 3 * inverse * inverse * parameter * first +
    3 * inverse * parameter * parameter * second + parameter * parameter * parameter;
}

/** CSS/Figma cubic-bezier evaluation: input is timeline x, output is eased y. */
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

function easeOut(progress: number): number {
  return readerAppearanceCubicBezierProgress(
    progress,
    EASE_OUT_X1,
    EASE_OUT_Y1,
    EASE_OUT_X2,
    EASE_OUT_Y2,
  );
}

function easeInOut(progress: number): number {
  return readerAppearanceCubicBezierProgress(progress, 0.42, 0, 0.58, 1);
}

/**
 * Shared actor geometry consumes physical expansion directly. The exported N
 * direction is retained by endpoint rects; no 183ms sub-timeline is allowed
 * to finish early and leave a frozen shared tree behind.
 */
export function readerAppearanceSharedActorProgress(expansionProgress: number): number {
  return easeOut(clamp01(expansionProgress));
}

function segmentProgress(
  expansionProgress: number,
  startExpansion: number,
  endExpansion: number,
): number {
  const expansion = clamp01(expansionProgress);
  if (expansion <= startExpansion) {
    return 0;
  }
  if (expansion >= endExpansion || endExpansion <= startExpansion) {
    return 1;
  }
  return (expansion - startExpansion) / (endExpansion - startExpansion);
}

/** Reversible reveal progress for a Full-only actor. */
export function readerAppearanceFullOnlyProgress(
  expansionProgress: number,
  startExpansion: number,
  endExpansion: number,
): number {
  return easeOut(segmentProgress(expansionProgress, startExpansion, endExpansion));
}

function lerp(start: number, end: number, progress: number): number {
  const safeProgress = clamp01(progress);
  return start + (end - start) * safeProgress;
}

function interpolateRect(
  source: ReaderAppearanceMotionRect,
  target: ReaderAppearanceMotionRect,
  progress: number,
): ReaderAppearanceMotionRect {
  return {
    x: lerp(source.x, target.x, progress),
    y: lerp(source.y, target.y, progress),
    width: lerp(source.width, target.width, progress),
    height: lerp(source.height, target.height, progress),
  };
}

function actorFromRect(
  rect: ReaderAppearanceMotionRect,
  opacity: number = 1,
  blurVp: number = 0,
): ReaderAppearanceMotionActorFrame {
  return {
    opacity: clamp01(opacity),
    x: finiteOr(rect.x, 0),
    y: finiteOr(rect.y, 0),
    translateX: 0,
    translateY: 0,
    blurVp: Math.max(0, finiteOr(blurVp, 0)),
    width: Math.max(0, finiteOr(rect.width, 0)),
    height: Math.max(0, finiteOr(rect.height, 0)),
  };
}

function effectActor(
  opacity: number,
  translateY: number = 0,
  blurVp: number = 0,
): ReaderAppearanceMotionActorFrame {
  return {
    opacity: clamp01(opacity),
    x: 0,
    y: 0,
    translateX: 0,
    translateY: finiteOr(translateY, 0),
    blurVp: Math.max(0, finiteOr(blurVp, 0)),
    width: 0,
    height: 0,
  };
}

function themeSourceRect(index: number): ReaderAppearanceMotionRect {
  const column = index % 4;
  const row = Math.floor(index / 4);
  return {
    x: READER_APPEARANCE_THEME_SOURCE_X[column],
    y: READER_APPEARANCE_THEME_SOURCE_Y[row],
    width: 62.5,
    height: 24,
  };
}

function themeTargetRect(index: number): ReaderAppearanceMotionRect {
  const column = index % 4;
  const row = Math.floor(index / 4);
  return {
    x: READER_APPEARANCE_THEME_TARGET_X[column],
    y: READER_APPEARANCE_THEME_TARGET_Y[row],
    width: 73.5,
    height: 58.8,
  };
}

function fontSourceRect(index: number): ReaderAppearanceMotionRect {
  const column = index % 4;
  const row = Math.floor(index / 4);
  return {
    x: READER_APPEARANCE_FONT_SOURCE_X[column],
    y: READER_APPEARANCE_FONT_SOURCE_Y[row],
    width: 62.5,
    height: 27,
  };
}

function fontTargetRect(index: number): ReaderAppearanceMotionRect {
  const column = index % 4;
  const row = Math.floor(index / 4);
  return {
    x: READER_APPEARANCE_FONT_TARGET_X[column],
    y: READER_APPEARANCE_FONT_TARGET_Y[row],
    width: 73,
    height: 30,
  };
}

function addSample(
  samples: ReaderAppearanceMotionActorSample[],
  id: ReaderAppearanceMotionActorId,
  frame: ReaderAppearanceMotionActorFrame,
): void {
  samples.push({ id, frame });
}

/** Physical Quick->Full completion for a direction-specific click clock. */
export function readerAppearanceExpansionFromTrajectory(
  profile: ReaderAppearanceMotionProfile,
  trajectoryProgress: number,
): number {
  const progress = clamp01(trajectoryProgress);
  if (profile === 'collapseO') {
    return 1 - easeInOut(progress);
  }
  return easeOut(progress);
}

/** Inverse of the monotonic direction-specific click clock. */
export function readerAppearanceTrajectoryFromExpansion(
  profile: ReaderAppearanceMotionProfile,
  expansionProgress: number,
): number {
  const target = clamp01(expansionProgress);
  if (profile === 'expandN' && (target === 0 || target === 1)) {
    return target;
  }
  if (profile === 'collapseO' && target === 1) {
    return 0;
  }
  if (profile === 'collapseO' && target === 0) {
    return 1;
  }
  let low = 0;
  let high = 1;
  for (let index = 0; index < 80; index += 1) {
    const middle = (low + high) / 2;
    const candidate = readerAppearanceExpansionFromTrajectory(profile, middle);
    if ((profile === 'expandN' && candidate < target) ||
      (profile === 'collapseO' && candidate > target)) {
      low = middle;
    } else {
      high = middle;
    }
  }
  return (low + high) / 2;
}

/** Helper for the Stage: upward finger travel increases physical expansion. */
export function readerAppearanceExpansionFromDrag(
  startRawExpansion: number,
  deltaYVp: number,
): number {
  return finiteOr(startRawExpansion, 0) -
    finiteOr(deltaYVp, 0) / READER_APPEARANCE_SHELL_TRAVEL_VP;
}

/**
 * Canonical Motion V2 sampler. Calling it twice with the same `e` returns the
 * same complete visual frame regardless of how that progress was reached.
 */
export function sampleReaderAppearanceExpansion(
  expansionProgress: number,
): ReaderAppearanceMotionFrame {
  const expansion = clamp01(expansionProgress);
  const sharedProgress = readerAppearanceSharedActorProgress(expansion);
  const shellHeight = lerp(READER_APPEARANCE_QUICK_HEIGHT, READER_APPEARANCE_FULL_HEIGHT, expansion);
  const shellTranslateY = READER_APPEARANCE_FULL_HEIGHT - shellHeight;

  const chromeProgress = readerAppearanceFullOnlyProgress(expansion, 0.45, 1);
  const brightnessRail = effectActor(
    1 - chromeProgress,
    lerp(0, 15, chromeProgress),
    lerp(0, 12, chromeProgress),
  );
  const moduleNav = effectActor(
    1 - chromeProgress,
    lerp(0, 20, chromeProgress),
    lerp(0, 12, chromeProgress),
  );
  const morphStage = actorFromRect({
    x: 0,
    y: shellTranslateY,
    width: READER_APPEARANCE_STAGE_WIDTH,
    height: shellHeight,
  });

  const quickMorph = actorFromRect(interpolateRect(
    READER_APPEARANCE_QUICK_MORPH_SOURCE_RECT,
    READER_APPEARANCE_QUICK_MORPH_TARGET_RECT,
    sharedProgress,
  ));
  const themeHeader = actorFromRect(interpolateRect(
    READER_APPEARANCE_THEME_HEADER_SOURCE_RECT,
    READER_APPEARANCE_THEME_HEADER_TARGET_RECT,
    sharedProgress,
  ));
  const quickDivider = actorFromRect(interpolateRect(
    READER_APPEARANCE_DIVIDER_SOURCE_RECT,
    READER_APPEARANCE_DIVIDER_TARGET_RECT,
    sharedProgress,
  ));
  const fontHeader = actorFromRect(interpolateRect(
    READER_APPEARANCE_FONT_HEADER_SOURCE_RECT,
    READER_APPEARANCE_FONT_HEADER_TARGET_RECT,
    sharedProgress,
  ));

  const themeItems: ReaderAppearanceMotionActorFrame[] = [];
  const fontItems: ReaderAppearanceMotionActorFrame[] = [];
  for (let index = 0; index < 8; index += 1) {
    themeItems.push(actorFromRect(interpolateRect(
      themeSourceRect(index),
      themeTargetRect(index),
      sharedProgress,
    )));
    fontItems.push(actorFromRect(interpolateRect(
      fontSourceRect(index),
      fontTargetRect(index),
      sharedProgress,
    )));
  }

  const contentSurfaceProgress = readerAppearanceFullOnlyProgress(expansion, 0.304762, 0.609524);
  const contentSurface = effectActor(contentSurfaceProgress);
  const headerProgress = readerAppearanceFullOnlyProgress(expansion, 0.347619, 0.738095);
  const themeActionsProgress = readerAppearanceFullOnlyProgress(expansion, 0.347619, 0.652381);
  const fontImportProgress = readerAppearanceFullOnlyProgress(expansion, 0.416667, 0.738095);
  const typographyProgress = readerAppearanceFullOnlyProgress(expansion, 0.609524, 1);
  const header = effectActor(headerProgress, lerp(-12, 0, headerProgress), lerp(8, 0, headerProgress));
  const themeActions = effectActor(
    themeActionsProgress,
    lerp(10, 0, themeActionsProgress),
    lerp(5, 0, themeActionsProgress),
  );
  const fontImport = effectActor(
    fontImportProgress,
    lerp(12, 0, fontImportProgress),
    lerp(5, 0, fontImportProgress),
  );
  const typography = effectActor(
    typographyProgress,
    lerp(24, 0, typographyProgress),
    lerp(8, 0, typographyProgress),
  );

  // These aliases intentionally cannot hide a shared actor subtree. They let
  // legacy Full presentation code migrate one leaf at a time without reviving
  // Quick/Full root crossfades.
  const identity = effectActor(1);
  const samples: ReaderAppearanceMotionActorSample[] = [];
  addSample(samples, 'BrightnessRail', brightnessRail);
  addSample(samples, 'ModuleNav', moduleNav);
  addSample(samples, 'MorphStage', morphStage);
  addSample(samples, 'QuickMorph', quickMorph);
  addSample(samples, 'ContentSurface', contentSurface);
  addSample(samples, 'ThemeHeader', themeHeader);
  const themeIds: ReaderAppearanceMotionActorId[] = [
    'ThemeDay', 'ThemeWarm', 'ThemeNight', 'ThemeWarmNight',
    'ThemePaper', 'ThemeGreen', 'ThemePaperNight', 'ThemeGreenNight',
  ];
  for (let index = 0; index < themeIds.length; index += 1) {
    addSample(samples, themeIds[index], themeItems[index]);
  }
  addSample(samples, 'QuickDivider', quickDivider);
  addSample(samples, 'FontHeader', fontHeader);
  const fontIds: ReaderAppearanceMotionActorId[] = [
    'Font0', 'Font1', 'Font2', 'Font3', 'Font4', 'Font5', 'Font6', 'Font7',
  ];
  for (let index = 0; index < fontIds.length; index += 1) {
    addSample(samples, fontIds[index], fontItems[index]);
  }
  addSample(samples, 'Header', header);
  addSample(samples, 'ThemeActions', themeActions);
  addSample(samples, 'FontImport', fontImport);
  addSample(samples, 'Typography', typography);

  return {
    expansionProgress: expansion,
    shellHeight,
    shellTranslateY,
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
    contentSurface,
    appearanceContent: identity,
    themeLibrary: themeActions,
    fontLibrary: fontImport,
    actorSamples: samples,
  };
}

/**
 * Compatibility clock sampler. It immediately converts direction/timeline to
 * physical expansion, then delegates every actor to the canonical sampler.
 */
export function sampleReaderAppearanceMotion(
  profile: ReaderAppearanceMotionProfile,
  trajectoryProgress: number,
): ReaderAppearanceMotionFrame {
  return sampleReaderAppearanceExpansion(
    readerAppearanceExpansionFromTrajectory(profile, trajectoryProgress),
  );
}
