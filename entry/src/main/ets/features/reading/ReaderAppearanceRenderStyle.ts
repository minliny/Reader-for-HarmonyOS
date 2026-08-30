import type {
  ReaderAppearanceAlignment,
  ReaderAppearanceFont,
  ReaderAppearanceFontSlot,
  ReaderAppearanceIndent,
  ReaderAppearanceSnapshot,
  ReaderAppearanceTheme,
} from './ReaderAppearanceState';
import { readerThemePalette } from './ReaderThemePalettes.ts';
import {
  READER_FONT_HARMONYOS_SANS,
  READER_FONT_LXGW_WENKAI_LITE,
  READER_FONT_LXGW_WENKAI_GB_LITE,
  READER_FONT_NOTO_SANS_SC,
  READER_FONT_NOTO_SERIF_SC_REGULAR,
  READER_FONT_SARASA_MONO_SC,
  READER_FONT_SOURCE_HAN_SERIF,
  READER_FONT_ZHUQUE_FANGSONG,
} from '../common/ReaderFontFamilies.ts';

/**
 * Reading-surface values resolved from the authoritative Figma variables:
 * - `Reader · Reading Palette` (`245:4`)
 * - `Reader · Reading Scheme` (`245:5`)
 * - `Reader Appearance Choices` (`755:1164`)
 *
 * The control swatch color is not reused as the page fill. Paper, Warm and
 * Green have separate source-backed reading fills and ink values in Figma.
 */
export type ReaderAppearanceThemeStyle = {
  paperStart: string;
  paperEnd: string;
  ink: string;
  paperTexture: boolean;
  sourcePaperLighting: boolean;
};

export function readerAppearanceThemeStyle(theme: ReaderAppearanceTheme): ReaderAppearanceThemeStyle {
  const palette = readerThemePalette(theme);
  return {
    paperStart: palette.paperStart,
    paperEnd: palette.paperEnd,
    ink: palette.bodyInk,
    paperTexture: palette.paperTexture,
    sourcePaperLighting: palette.sourcePaperLighting,
  };
}

export function readerAppearanceChromeTone(theme: ReaderAppearanceTheme): 'light' | 'dark' {
  return theme === 'night' || theme === 'warmNight' || theme === 'paperNight' || theme === 'greenNight' ?
    'light' : 'dark';
}

export function readerAppearanceFontFamily(font: ReaderAppearanceFont): string {
  if (font === 'system') {
    // ArkUI's documented default family. Keep this explicit because the same
    // value is part of the non-blank pagination layout signature.
    return READER_FONT_HARMONYOS_SANS;
  }
  if (font === 'sans') {
    return READER_FONT_NOTO_SANS_SC;
  }
  if (font === 'serif') {
    return READER_FONT_NOTO_SERIF_SC_REGULAR;
  }
  if (font === 'kai') {
    return READER_FONT_LXGW_WENKAI_GB_LITE;
  }
  if (font === 'fangSong') {
    return READER_FONT_ZHUQUE_FANGSONG;
  }
  if (font === 'mono') {
    return READER_FONT_SARASA_MONO_SC;
  }
  if (font === 'sourceHanSerif') {
    return READER_FONT_SOURCE_HAN_SERIF;
  }
  if (font === 'lxgwWenKai') {
    return READER_FONT_LXGW_WENKAI_LITE;
  }
  // A custom family is snapshot-scoped and must be resolved through
  // readerAppearanceSnapshotFontFamily(). The enum-only helper remains the
  // built-in preview mapping and therefore fails closed here.
  return READER_FONT_NOTO_SERIF_SC_REGULAR;
}

/**
 * One product-facing name table for both the quick and full Figma font grids.
 * Import becomes the installed custom font only after the Host has admitted it.
 */
export function readerAppearanceFontSlotLabel(
  snapshot: ReaderAppearanceSnapshot,
  font: ReaderAppearanceFontSlot,
): string {
  if (font === 'system') {
    return '系统';
  }
  if (font === 'serif') {
    return '宋体';
  }
  if (font === 'sans') {
    return '黑体';
  }
  if (font === 'kai') {
    return '楷体';
  }
  if (font === 'fangSong') {
    return '仿宋';
  }
  if (font === 'mono') {
    return '等宽';
  }
  if (font === 'sourceHanSerif') {
    return '思源宋体';
  }
  if (font === 'lxgwWenKai') {
    return '霞鹜文楷';
  }
  if (snapshot.customFont !== undefined) {
    return snapshot.customFont.displayName;
  }
  return '导入';
}

export function readerAppearanceFontSlotFamily(
  snapshot: ReaderAppearanceSnapshot,
  font: ReaderAppearanceFontSlot,
): string {
  if (font === 'import') {
    return snapshot.customFont?.familyName ?? READER_FONT_NOTO_SANS_SC;
  }
  return readerAppearanceFontFamily(font);
}

export function readerAppearanceSnapshotFontFamily(snapshot: ReaderAppearanceSnapshot): string {
  if (snapshot.font === 'custom' && snapshot.customFont !== undefined) {
    return snapshot.customFont.familyName;
  }
  return readerAppearanceFontFamily(snapshot.font);
}

export function readerAppearanceLineHeight(snapshot: ReaderAppearanceSnapshot): number {
  return snapshot.fontSize * snapshot.lineHeightMultiplier;
}

export function readerAppearanceFontScale(snapshot: ReaderAppearanceSnapshot): number {
  return snapshot.fontSize / 18;
}

export function readerAppearanceParagraphIndent(
  fontSize: number,
  indent: ReaderAppearanceIndent,
): number {
  if (indent === 'single') {
    return fontSize;
  }
  return indent === 'firstLine' ? fontSize * 2 : 0;
}

/**
 * The visible reader is projected as one Text node per already-measured line.
 * ArkUI's paragraph-level textIndent is therefore not a reliable primitive
 * for that surface.  Use explicit ideographic spaces in both the hidden
 * measurement text and the visible first-line Text so both layouts share the
 * same one-character/two-character contract without changing Core offsets.
 */
export function readerAppearanceParagraphIndentPrefix(
  indent: ReaderAppearanceIndent,
): string {
  if (indent === 'single') {
    return '\u3000';
  }
  return indent === 'firstLine' ? '\u3000\u3000' : '';
}

export function readerAppearanceParagraphDisplayText(
  text: string,
  isParagraphStart: boolean,
  indent: ReaderAppearanceIndent,
): string {
  return isParagraphStart ? `${readerAppearanceParagraphIndentPrefix(indent)}${text}` : text;
}

export function readerAppearanceParagraphContentScalarOffset(
  displayScalarOffset: number,
  contentScalarCount: number,
  isParagraphStart: boolean,
  indent: ReaderAppearanceIndent,
): number {
  const prefixScalarCount = isParagraphStart ? readerAppearanceParagraphIndentPrefix(indent).length : 0;
  return Math.max(0, Math.min(contentScalarCount, displayScalarOffset - prefixScalarCount));
}

export function readerAppearanceUsesJustify(alignment: ReaderAppearanceAlignment): boolean {
  return alignment === 'justify';
}
