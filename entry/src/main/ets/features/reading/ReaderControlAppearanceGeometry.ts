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
}

/**
 * User override approved 2026-09-05: Import occupies its ordered grid slot,
 * defaulting to the end through the existing font-order normalizer. The raw
 * overlapping endpoint is retained only for an explicitly requested comparison.
 */
export type ReaderControlAppearanceImportLayout =
  'source-overlap-pending' | 'ordered-slot-approved';

export function sampleReaderControlAppearance(progress: number, viewportWidth: number,
  fullContentHeight: number, themeCount: number = 8): ReaderControlAppearanceFrame {
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
    contentHeight: Math.max(height, 773 + fullExtra),
    quickContentHeight: 190 + quickExtra,
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
    layout: actor(11, 367 + fullExtra + 96 * (1 - p), sectionWidth, 406, p),
    themeSwatches: themeSwatches, themeShells: themeShells,
  };
}

/** Stable font identity can occupy different Quick/Full slots after reordering. */
export function readerControlAppearanceFontActor(frame: ReaderControlAppearanceFrame,
  quickIndex: number, fullIndex: number, importSlot: boolean = false,
  importLayout: ReaderControlAppearanceImportLayout = 'ordered-slot-approved'): ReaderControlAppearanceActor {
  const p = frame.progress;
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
  const width = Math.max(0, (frame.sectionWidth - 24) / 4);
  const x = Number.isFinite(deltaX) ? deltaX : 0;
  const y = Number.isFinite(deltaY) ? deltaY : 0;
  const column = Math.max(0, Math.min(3, Math.floor((originX - 11 + width / 2 + x) / (width + 8))));
  const row = Math.max(0, Math.min(Math.ceil(count / 4) - 1,
    Math.floor((originY - 251 - frame.themeExtraRows * 64.8 + 15 + y) / 38)));
  return Math.max(0, Math.min(count - 1, row * 4 + column));
}
