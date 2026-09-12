import type { ReaderAppearanceTheme } from './ReaderAppearanceState';

/** Make LOYUJr93KwespD5j7N6icw V9. Shared Quick/Full swatches, not reading-page fills. */
export const READER_CONTROL_APPEARANCE_THEMES: ReaderAppearanceTheme[] = [
  'day', 'warm', 'night', 'warmNight', 'paper', 'green', 'paperNight', 'greenNight',
];
const THEME_LABELS: string[] = ['日间', '暖白', '夜间', '暖夜', '纸纹', '青叶纹', '靛夜', '林夜纹'];
const THEME_SWATCHES: string[] = [
  '#FCF8F0', '#F4E3BF', '#2B2823', '#413020', '#EBDABB', '#D7E8CF', '#26313F', '#24382C',
];
export const APPEARANCE_LAYOUT_SURFACE = '#E0FFF9F2';
export const APPEARANCE_LAYOUT_BORDER = '#429B8466';
export const APPEARANCE_LAYOUT_CAPTION = '#807366';

export function readerControlAppearanceThemeLabel(theme: ReaderAppearanceTheme): string {
  return THEME_LABELS[READER_CONTROL_APPEARANCE_THEMES.indexOf(theme)];
}

export function readerControlAppearanceThemeSwatch(theme: ReaderAppearanceTheme): string {
  // Keep paperNight as its persisted identity when changing the label to 靛夜.
  return THEME_SWATCHES[READER_CONTROL_APPEARANCE_THEMES.indexOf(theme)];
}
