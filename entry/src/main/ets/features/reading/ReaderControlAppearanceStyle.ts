import { READER_THEME_DEFINITIONS, readerThemeDefinition, readerAppColor } from '../common/ReaderThemeRegistry.ts';
import type { ReaderAppearanceTheme } from './ReaderAppearanceState';

/** Make LOYUJr93KwespD5j7N6icw V9. Shared Quick/Full swatches, not reading-page fills. */
export const READER_CONTROL_APPEARANCE_THEMES: ReaderAppearanceTheme[] = READER_THEME_DEFINITIONS.map(theme => theme.id);
export const APPEARANCE_LAYOUT_SURFACE = readerAppColor('app.appearance.layoutSurface', 'day');
export const APPEARANCE_LAYOUT_BORDER = readerAppColor('app.appearance.layoutBorder', 'day');
export const APPEARANCE_LAYOUT_CAPTION = readerAppColor('app.appearance.layoutCaption', 'day');

export function readerControlAppearanceThemeLabel(theme: ReaderAppearanceTheme): string {
  return readerThemeDefinition(theme).displayName;
}

export function readerControlAppearanceThemeSwatch(theme: ReaderAppearanceTheme): string {
  // Keep paperNight as its persisted identity when changing the label to 靛夜.
  return readerThemeDefinition(theme).swatch;
}
