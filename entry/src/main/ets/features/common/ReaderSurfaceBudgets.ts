import { readerScaledControlHeight } from './ReaderSurfaceResolvers';

function nonNegative(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

export const FULL_DIRECTORY_MIN_PANEL: number = 214;

export interface ReaderFullDirectoryHeights {
  panel: number;
  content: number;
  body: number;
  chapterList: number;
  bookmarkList: number;
}

/** Standalone directory allocations all consume the same admitted panel. */
export function readerFullDirectoryHeights(panelHeight: number): ReaderFullDirectoryHeights {
  const panel = nonNegative(panelHeight);
  const content = Math.max(0, panel - 32);
  const body = Math.max(0, content - 38);
  return { panel, content, body,
    chapterList: Math.max(0, body - 143),
    bookmarkList: Math.max(0, body - 93) };
}

export interface ReaderSheetBodyBudgetInput {
  windowHeight: number;
  safeTop: number;
  safeBottom: number;
  headerFrame: number;
  titleBottom: number;
  contentBottom: number;
  footerHeight?: number;
  capRatio?: number;
}

/** Header measurements exclude their external margin. Budget it explicitly,
 * along with the surface's own bottom inset and the measured footer. */
export function readerSheetBodyBudget(input: ReaderSheetBodyBudgetInput): number {
  const height = nonNegative(input.windowHeight);
  const fixed = nonNegative(input.safeTop) + nonNegative(input.safeBottom) +
    nonNegative(input.headerFrame) + nonNegative(input.titleBottom) +
    nonNegative(input.contentBottom) + nonNegative(input.footerHeight ?? 0);
  const available = Math.max(0, height - fixed);
  return input.capRatio === undefined ? available :
    Math.min(available, height * nonNegative(input.capRatio));
}

const TTS_MANAGER_HEADER: number = 58;
const TTS_MANAGER_BODY: number = 440;
const TTS_MANAGER_OUTER_PADDING: number = 32;
const TTS_MANAGER_FOOTER_BASE: number = 76;

export function readerTtsManagerFooterHeight(fontScale: number, lineHeight: number = 20): number {
  return readerScaledControlHeight(TTS_MANAGER_FOOTER_BASE, lineHeight, fontScale);
}

export function readerTtsManagerChromeHeight(fontScale: number, lineHeight: number = 20): number {
  return TTS_MANAGER_HEADER + readerTtsManagerFooterHeight(fontScale, lineHeight);
}

export function readerTtsManagerDesignHeight(fontScale: number, lineHeight: number = 20): number {
  return readerTtsManagerChromeHeight(fontScale, lineHeight) + TTS_MANAGER_BODY;
}

export function readerTtsManagerScrollHeight(panelHeight: number, fontScale: number, lineHeight: number = 20): number {
  return Math.max(0, nonNegative(panelHeight) - readerTtsManagerChromeHeight(fontScale, lineHeight));
}

/** This extra 32 is the outer vertical padding, not a minimum body height. */
export function readerTtsManagerCompactThreshold(fontScale: number, lineHeight: number = 20): number {
  return readerTtsManagerChromeHeight(fontScale, lineHeight) + TTS_MANAGER_OUTER_PADDING;
}

const SHELF_DETAILS_TEXT_BASE: number = 60;
const SHELF_DETAILS_CHROME: number = 11;

export function readerShelfDetailsHeight(fontScale: number): number {
  const scale = Number.isFinite(fontScale) ? Math.max(1, fontScale) : 1;
  return Math.max(72, Math.ceil(SHELF_DETAILS_TEXT_BASE * scale) + SHELF_DETAILS_CHROME);
}

export function readerShelfListRowHeight(coverHeight: number, fontScale: number): number {
  return Math.max(nonNegative(coverHeight), readerShelfDetailsHeight(fontScale));
}
