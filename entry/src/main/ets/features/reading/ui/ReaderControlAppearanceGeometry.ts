/**
 * Appearance 1691:20749, live design + recursive motion context 2026-09-05.
 * Coordinates are ContentViewport-local, not screen or moving-shell coordinates.
 * The shared Stage owns its -28 -> 0 Y, width/height, surface and handle travel.
 * User target override: remove the prototype's initial hold; every actor samples
 * the same spatial p. Never ease p here (the automatic clock owns its curve).
 */
import { readerControlUnit as unit, readerControlLerp as lerp,
  readerControlActor as actor } from './ReaderControlActorGeometry.ts';

export interface ReaderControlAppearanceActor {
  x: number;
  y: number;
  width: number;
  height: number;
  opacity: number;
}

/** One selected candidate's finite natural row sizes, not a layout-node tree. */
export interface ReaderControlAppearanceMinimumProfile {
  quickThemeColumns: number;
  quickThemeHitWidth: number;
  fullThemeColumns: number;
  quickFontColumns: number;
  fullFontColumns: number;
  quickThemeHeaderHeight: number;
  fullThemeHeaderHeight: number;
  quickFontHeaderHeight: number;
  fullFontHeaderHeight: number;
  themeLabelHeight: number;
  themeActionHeight: number;
  quickFontCellHeight: number;
  fullFontCellHeight: number;
  layoutHeaderHeight: number;
  selectLabelHeight: number;
  selectTriggerHeight: number;
  selectRowHeight: number;
  selectStacked: boolean;
  indentTriggerWidth: number;
  languageTriggerWidth: number;
  indentMenuHeight: number;
  languageMenuHeight: number;
  stepperLabelHeight: number;
  stepperValueHeight: number;
  stepperValueWidth: number;
  stepButtonTextHeight: number;
  stepButtonTextWidth: number;
  stepButtonWidth: number;
  stepperRowHeight: number;
  stepperStacked: boolean;
}

export interface ReaderControlAppearanceFrame {
  progress: number;
  fullViewportWidth: number;
  sectionWidth: number;
  contentHeight: number;
  quickContentHeight: number;
  themeExtraRows: number;
  contentTranslateX: number;
  surfaceOpacity: number;
  quickThemeHeader: ReaderControlAppearanceActor;
  fullThemeHeader: ReaderControlAppearanceActor;
  quickFontHeader: ReaderControlAppearanceActor;
  fullFontHeader: ReaderControlAppearanceActor;
  divider: ReaderControlAppearanceActor;
  themeDayAction: ReaderControlAppearanceActor;
  themeNightAction: ReaderControlAppearanceActor;
  layout: ReaderControlAppearanceActor;
  themeSwatches: ReaderControlAppearanceActor[];
  themeShells: ReaderControlAppearanceActor[];
  minimum?: ReaderControlAppearanceMinimumProfile;
}

/**
 * User override approved 2026-09-05: Import occupies its ordered grid slot,
 * defaulting to the end through the existing font-order normalizer. The raw
 * overlapping endpoint is retained only for an explicitly requested comparison.
 */
export type ReaderControlAppearanceImportLayout =
  'source-overlap-pending' | 'ordered-slot-approved';

export function sampleReaderControlAppearance(progress: number, viewportWidth: number,
  fullContentHeight: number, themeCount: number = 8, fontCount: number = 8,
  minimum?: ReaderControlAppearanceMinimumProfile): ReaderControlAppearanceFrame {
  if (minimum !== undefined) return sampleNaturalAppearance(progress, viewportWidth,
    fullContentHeight, themeCount, fontCount, minimum);
  const p = unit(progress);
  const currentWidth = Number.isFinite(viewportWidth) && viewportWidth > 0 ?
    viewportWidth : lerp(286, 338, p);
  // The Stage consumes the viewport's 286 -> 338 width track. Recover its full
  // width for a resize-safe endpoint layout; do not scale typography/actor trees.
  const fullWidth = currentWidth + 52 * (1 - p);
  const sectionWidth = Math.max(0, fullWidth - 22);
  const quickSectionWidth = Math.max(0, sectionWidth - 52);
  const fullThemeWidth = Math.max(0, (sectionWidth - 22) / 4);
  const fullThemeStride = fullThemeWidth + 6;
  const quickThemeStride = Math.max(0, (quickSectionWidth - 64.5) / 3);
  const themeSwatches: ReaderControlAppearanceActor[] = [];
  const themeShells: ReaderControlAppearanceActor[] = [];
  const count = Number.isFinite(themeCount) ? Math.max(0, Math.floor(themeCount)) : 8;
  const extraRows = Math.max(0, Math.ceil(count / 4) - 2);
  const quickExtra = extraRows * 28;
  const fullExtra = extraRows * 64.8;
  for (let index = 0; index < count; index += 1) {
    const column = index % 4;
    const row = Math.floor(index / 4);
    const fullX = 13 + column * fullThemeStride;
    const fullY = 43.39 + row * 64.8;
    themeShells.push(actor(fullX, fullY, fullThemeWidth, 58.8, p));
    // 20785..20792 are persistent, fixed-size roots. Only their position moves;
    // their 46x18 inset color swatch is not swapped for a second Full swatch.
    const fullSwatchX = fullX + (fullThemeWidth - 62.5) / 2;
    const quickSwatchX = 12 + column * quickThemeStride;
    themeSwatches.push(actor(lerp(quickSwatchX, fullSwatchX, p),
      lerp(34.9 + row * 28, 53.39 + row * 64.8, p), 62.5, 24, 1));
  }
  const height = Number.isFinite(fullContentHeight) ? Math.max(0, fullContentHeight) : 666;
  return {
    progress: p, fullViewportWidth: fullWidth, sectionWidth: sectionWidth,
    contentHeight: Math.max(height, 689 + fullExtra),
    quickContentHeight: 190 + quickExtra + Math.max(0, Math.ceil(fontCount / 4) - 2) * 31,
    themeExtraRows: extraRows,
    // Appearance-only viewport X track. Stage already applies its Y track.
    contentTranslateX: -0.9 * (1 - p),
    surfaceOpacity: p,
    quickThemeHeader: actor(12, 16 + 5 * p, Math.max(0, quickSectionWidth - 2), 15.898, 1 - p),
    fullThemeHeader: actor(13, 21 - 5 * (1 - p), Math.max(0, sectionWidth - 4), 20, p),
    quickFontHeader: actor(12, 102.9 + quickExtra + 6 * p, Math.max(0, quickSectionWidth - 2), 10, 1 - p),
    fullFontHeader: actor(11, 221 + fullExtra, sectionWidth, 16, p),
    divider: actor(11, 220 + fullExtra, sectionWidth, 1, p),
    themeDayAction: actor(sectionWidth - 145, 183 + fullExtra + 8 * (1 - p), 74, 28, p),
    themeNightAction: actor(sectionWidth - 65, 183 + fullExtra + 8 * (1 - p), 74, 28, p),
    layout: actor(11, 367 + fullExtra + 96 * (1 - p), sectionWidth, 322, p),
    themeSwatches: themeSwatches, themeShells: themeShells,
  };
}

function sampleNaturalAppearance(progress: number, viewportWidth: number, fullContentHeight: number,
  themeCount: number, fontCount: number, minimum: ReaderControlAppearanceMinimumProfile): ReaderControlAppearanceFrame {
  const p = unit(progress);
  const currentWidth = Number.isFinite(viewportWidth) && viewportWidth > 0 ? viewportWidth : lerp(286, 338, p);
  const fullWidth = currentWidth + 52 * (1 - p);
  const sectionWidth = Math.max(0, fullWidth - 22);
  const quickSectionWidth = Math.max(0, sectionWidth - 52);
  const count = Math.max(0, Math.floor(themeCount));
  const quickRows = Math.max(2, Math.ceil(count / minimum.quickThemeColumns));
  const fullRows = Math.max(2, Math.ceil(count / minimum.fullThemeColumns));
  const fullCellWidth = Math.max(0, (sectionWidth - 22 - (minimum.fullThemeColumns - 4) * 6) / minimum.fullThemeColumns);
  const fullStride = minimum.themeLabelHeight + 51.8;
  const quickTop = 34.9 + minimum.quickThemeHeaderHeight - 15.898;
  const fullTop = 43.39 + minimum.fullThemeHeaderHeight - 20;
  const quickFontTop = quickTop + quickRows * 28 + 12;
  const actionTop = fullTop + fullRows * fullStride + 10.01;
  const dividerTop = actionTop + minimum.themeActionHeight + 9;
  const fullFontTop = dividerTop + 1;
  const fullFontGridTop = fullFontTop + minimum.fullFontHeaderHeight + 14;
  const fullFontRows = Math.max(3, Math.ceil((fontCount + 1) / minimum.fullFontColumns));
  const layoutTop = fullFontGridTop + (fullFontRows - 1) * (minimum.fullFontCellHeight + 8) + minimum.fullFontCellHeight + 10;
  const layoutHeight = 10 + minimum.layoutHeaderHeight + 11 + minimum.selectRowHeight * 2 + minimum.stepperRowHeight * 4 + 32;
  const quickFontRows = Math.max(2, Math.ceil(fontCount / minimum.quickFontColumns));
  const quickHeight = quickFontTop + minimum.quickFontHeaderHeight + 3 +
    (quickFontRows - 1) * (minimum.quickFontCellHeight + 4) + minimum.quickFontCellHeight + 16.1;
  const themeSwatches: ReaderControlAppearanceActor[] = [];
  const themeShells: ReaderControlAppearanceActor[] = [];
  for (let index = 0; index < count; index += 1) {
    const fullColumn = index % minimum.fullThemeColumns;
    const fullRow = Math.floor(index / minimum.fullThemeColumns);
    const quickColumn = index % minimum.quickThemeColumns;
    const quickRow = Math.floor(index / minimum.quickThemeColumns);
    const fullX = 13 + fullColumn * (fullCellWidth + 6);
    const fullY = fullTop + fullRow * fullStride;
    const quickStride = minimum.quickThemeColumns > 1 ?
      Math.max(0, (quickSectionWidth - 64.5) / (minimum.quickThemeColumns - 1)) : 0;
    themeShells.push(actor(fullX, fullY, fullCellWidth, minimum.themeLabelHeight + 45.8, p));
    themeSwatches.push(actor(lerp(12 + quickColumn * quickStride, fullX + (fullCellWidth - 62.5) / 2, p),
      lerp(quickTop + quickRow * 28, fullY + 10, p), 62.5, 24, 1));
  }
  return {
    progress: p, fullViewportWidth: fullWidth, sectionWidth,
    contentHeight: Math.max(Number.isFinite(fullContentHeight) ? fullContentHeight : 0, layoutTop + layoutHeight),
    quickContentHeight: quickHeight, themeExtraRows: Math.max(0, fullRows - 2),
    contentTranslateX: -.9 * (1 - p), surfaceOpacity: p,
    quickThemeHeader: actor(12, 16 + 5 * p, Math.max(0, quickSectionWidth - 2), minimum.quickThemeHeaderHeight, 1 - p),
    fullThemeHeader: actor(13, 21 - 5 * (1 - p), Math.max(0, sectionWidth - 4), minimum.fullThemeHeaderHeight, p),
    quickFontHeader: actor(12, quickFontTop + 6 * p, Math.max(0, quickSectionWidth - 2), minimum.quickFontHeaderHeight, 1 - p),
    fullFontHeader: actor(11, fullFontTop, sectionWidth, minimum.fullFontHeaderHeight, p),
    divider: actor(11, dividerTop, sectionWidth, 1, p),
    themeDayAction: actor(sectionWidth - 145, actionTop + 8 * (1 - p), 74, minimum.themeActionHeight, p),
    themeNightAction: actor(sectionWidth - 65, actionTop + 8 * (1 - p), 74, minimum.themeActionHeight, p),
    layout: actor(11, layoutTop + 96 * (1 - p), sectionWidth, layoutHeight, p),
    themeSwatches, themeShells, minimum,
  };
}

/** Stable font identity can occupy different Quick/Full slots after reordering. */
export function readerControlAppearanceFontActor(frame: ReaderControlAppearanceFrame,
  quickIndex: number, fullIndex: number, importSlot: boolean = false,
  importLayout: ReaderControlAppearanceImportLayout = 'ordered-slot-approved'): ReaderControlAppearanceActor {
  const p = frame.progress;
  if (frame.minimum !== undefined) {
    const natural = frame.minimum;
    const fullWidth = Math.max(0, (frame.sectionWidth - 24 - (natural.fullFontColumns - 4) * 8) / natural.fullFontColumns);
    const quickWidth = Math.max(0, (frame.sectionWidth - 66 - (natural.quickFontColumns - 4) * 4) / natural.quickFontColumns);
    const fullX = 11 + Math.max(0, fullIndex) % natural.fullFontColumns * (fullWidth + 8);
    const fullY = frame.fullFontHeader.y + natural.fullFontHeaderHeight + 14 +
      Math.floor(Math.max(0, fullIndex) / natural.fullFontColumns) * (natural.fullFontCellHeight + 8);
    if (importSlot) return actor(importLayout === 'ordered-slot-approved' ? fullX : 11,
      (importLayout === 'ordered-slot-approved' ? fullY : frame.fullFontHeader.y + natural.fullFontHeaderHeight + 14) + 8 * (1 - p),
      fullWidth, natural.fullFontCellHeight, p);
    const quickX = 12 + Math.max(0, quickIndex) % natural.quickFontColumns * (quickWidth + 4);
    const quickY = frame.quickFontHeader.y - 6 * p + natural.quickFontHeaderHeight + 3 +
      Math.floor(Math.max(0, quickIndex) / natural.quickFontColumns) * (natural.quickFontCellHeight + 4);
    return actor(lerp(quickX, fullX, p), lerp(quickY, fullY, p), lerp(quickWidth, fullWidth, p),
      lerp(natural.quickFontCellHeight, natural.fullFontCellHeight, p), 1);
  }
  const fullWidth = Math.max(0, (frame.sectionWidth - 24) / 4);
  const quickWidth = Math.max(0, (frame.sectionWidth - 66) / 4);
  const fullColumn = Math.max(0, fullIndex) % 4;
  const fullRow = Math.floor(Math.max(0, fullIndex) / 4);
  const fullX = 11 + fullColumn * (fullWidth + 8);
  const fullY = 251 + frame.themeExtraRows * 64.8 + fullRow * 38;
  if (importSlot) {
    // Raw 20807 overlaps System at (11,251). The default ordered slot is the
    // user-approved product overlay, never a claimed original Figma coordinate.
    const importX = importLayout === 'ordered-slot-approved' ? fullX : 11;
    const importY = importLayout === 'ordered-slot-approved' ? fullY : 251 + frame.themeExtraRows * 64.8;
    return actor(importX, importY + 8 * (1 - p), fullWidth, 30, p);
  }
  const quickColumn = Math.max(0, quickIndex) % 4;
  const quickRow = Math.floor(Math.max(0, quickIndex) / 4);
  return actor(lerp(12 + quickColumn * (quickWidth + 4), fullX, p),
    lerp(115.9 + frame.themeExtraRows * 28 + quickRow * 31, fullY, p), lerp(quickWidth, fullWidth, p),
    lerp(27, 30, p), 1);
}

/** Input hit regions are available only on the current stable input surface. */
export function readerControlAppearanceEndpoint(progress: number,
  interactionEnabled: boolean): 'none' | 'quick' | 'full' {
  if (!interactionEnabled) return 'none';
  const p = unit(progress);
  if (p === 0) return 'quick';
  if (p === 1) return 'full';
  return 'none';
}

/** Import is Full-only, including when a saved custom order places it first. */
export function readerControlAppearanceFontInput(progress: number,
  interactionEnabled: boolean, importSlot: boolean,
  importLayout: ReaderControlAppearanceImportLayout = 'ordered-slot-approved'): boolean {
  const endpoint = readerControlAppearanceEndpoint(progress, interactionEnabled);
  return importSlot ? endpoint === 'full' && importLayout === 'ordered-slot-approved' :
    endpoint !== 'none';
}

/** Uses the held cell's center in viewport-local coordinates, without easing. */
export function readerControlAppearanceFontDropIndex(frame: ReaderControlAppearanceFrame,
  originX: number, originY: number, deltaX: number, deltaY: number, slotCount: number): number {
  if (!Number.isFinite(slotCount) || slotCount < 1) return -1;
  const count = Math.floor(slotCount);
  if (frame.minimum !== undefined) {
    const profile = frame.minimum;
    const x = Number.isFinite(deltaX) ? deltaX : 0;
    const y = Number.isFinite(deltaY) ? deltaY : 0;
    const width = Math.max(0, (frame.sectionWidth - 24 - (profile.fullFontColumns - 4) * 8) / profile.fullFontColumns);
    const column = Math.max(0, Math.min(profile.fullFontColumns - 1,
      Math.floor((originX - 11 + width / 2 + x) / (width + 8))));
    const top = frame.fullFontHeader.y + profile.fullFontHeaderHeight + 14;
    const row = Math.max(0, Math.min(Math.ceil(count / profile.fullFontColumns) - 1,
      Math.floor((originY - top + profile.fullFontCellHeight / 2 + y) / (profile.fullFontCellHeight + 8))));
    return Math.max(0, Math.min(count - 1, row * profile.fullFontColumns + column));
  }
  const width = Math.max(0, (frame.sectionWidth - 24) / 4);
  const x = Number.isFinite(deltaX) ? deltaX : 0;
  const y = Number.isFinite(deltaY) ? deltaY : 0;
  const column = Math.max(0, Math.min(3, Math.floor((originX - 11 + width / 2 + x) / (width + 8))));
  const row = Math.max(0, Math.min(Math.ceil(count / 4) - 1,
    Math.floor((originY - 251 - frame.themeExtraRows * 64.8 + 15 + y) / 38)));
  return Math.max(0, Math.min(count - 1, row * 4 + column));
}
