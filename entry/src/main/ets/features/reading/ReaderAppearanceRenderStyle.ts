import type {
  ReaderAppearanceAlignment,
  ReaderAppearanceFont,
  ReaderAppearanceIndent,
  ReaderAppearanceSnapshot,
  ReaderAppearanceTheme,
} from './ReaderAppearanceState';

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
  if (theme === 'warm') {
    return themeStyle('#FFF6E9', '#FFF6E9', '#2C241D', false, false);
  }
  if (theme === 'warmNight') {
    return themeStyle('#27231F', '#27231F', '#E7D8C8', false, false);
  }
  if (theme === 'paper') {
    return themeStyle('#FBF4E9', '#EFE2D0', '#2B241D', true, true);
  }
  if (theme === 'green') {
    return themeStyle('#EEF5E8', '#EEF5E8', '#263423', false, false);
  }
  if (theme === 'paperNight') {
    return themeStyle('#302B26', '#211F1C', '#E9DECE', true, false);
  }
  if (theme === 'greenNight') {
    return themeStyle('#202B26', '#202B26', '#D8E2D2', false, false);
  }
  if (theme === 'night') {
    return themeStyle('#26231F', '#26231F', '#E9DECE', false, false);
  }
  return themeStyle('#FFFFFF', '#FFFFFF', '#2B241D', false, false);
}

export function readerAppearanceFontFamily(font: ReaderAppearanceFont): string {
  if (font === 'system') {
    // An empty family lets ArkUI resolve the current system reading face.
    return '';
  }
  if (font === 'sans') {
    return 'ReaderNotoSansSC';
  }
  if (font === 'serif') {
    return 'ReaderNotoSerifSCRegular';
  }
  if (font === 'lxgwWenKai') {
    return 'ReaderLXGWWenKaiLite';
  }
  return 'ReaderNotoSerifSCRegular';
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

export function readerAppearanceUsesJustify(alignment: ReaderAppearanceAlignment): boolean {
  return alignment === 'justify';
}

function themeStyle(
  paperStart: string,
  paperEnd: string,
  ink: string,
  paperTexture: boolean,
  sourcePaperLighting: boolean,
): ReaderAppearanceThemeStyle {
  return { paperStart, paperEnd, ink, paperTexture, sourcePaperLighting };
}
