import type { ReaderAppearanceTheme } from './ReaderAppearanceState';

/**
 * The single color-value source for the reading experience domain
 * (body pages + every overlay). Per DESIGN_READER_THEME_PALETTE_MATRIX_
 * 2026-08-30.md, no other reading-domain file may carry a hex literal.
 * The `day` column is the byte-exact regression anchor for the previous
 * day-mode tokens; dark-theme overlay columns are screenshot-tunable
 * proposals that only change in this one file.
 */
export type ReaderThemePalette = {
  // Body page (Figma `Reader · Reading Palette` 245:4 / `Reading Scheme` 245:5)
  paperStart: string;
  paperEnd: string;
  bodyInk: string;
  paperTexture: boolean;
  sourcePaperLighting: boolean;
  // Overlays (control shell, panels, directory, source-switch window)
  surface: string;
  surfaceElevated: string;
  surfacePanelSoft: string;
  ink: string;
  inkSecondary: string;
  inkTertiary: string;
  chromeMeta: string;
  primary: string;
  onPrimary: string;
  activeSoft: string;
  icon: string;
  handle: string;
  lineStrong: string;
  borderSoft: string;
  disabledBg: string;
  // Neutral hairline stroke (theme-swatch grid edge); constant across light themes.
  hairline: string;
  // Disabled control stroke (Motion Select spec gray); darkens per dark theme.
  disabledBorder: string;
  // Text-selection highlight (body chain); dark themes use ink @ 20%.
  selection: string;
  // Surface RGB with alpha 00 — gradient tail that must match the surface hue
  // (Color.Transparent interpolates through black and greys the fade edge).
  surfaceFade: string;
  // Slider knob stays light across themes (physical-knob semantics).
  knob: string;
  // App accent (brightness slider highlight); constant across themes for now.
  accent: string;
  // Status colors (download/search/TTS error and timeout states).
  error: string;
  warning: string;
  // Modal veil behind overlay windows.
  scrim: string;
};

export type ReaderThemePaletteTable = {
  day: ReaderThemePalette;
  warm: ReaderThemePalette;
  night: ReaderThemePalette;
  warmNight: ReaderThemePalette;
  paper: ReaderThemePalette;
  green: ReaderThemePalette;
  paperNight: ReaderThemePalette;
  greenNight: ReaderThemePalette;
};

export const READER_THEME_PALETTES: ReaderThemePaletteTable = {
  day: {
    paperStart: '#FFFFFF',
    paperEnd: '#FFFFFF',
    bodyInk: '#2B241D',
    paperTexture: false,
    sourcePaperLighting: false,
    surface: '#FAFFFAF4',
    surfaceElevated: '#BDFFFCF8',
    surfacePanelSoft: '#9EFFFCF8',
    ink: '#332C25',
    inkSecondary: '#5B5046',
    inkTertiary: '#8A7D6E',
    chromeMeta: '#766C61',
    primary: '#2F6373',
    onPrimary: '#FFFFFF',
    activeSoft: '#142F6373',
    icon: '#4D463F',
    handle: '#B9AD9F',
    lineStrong: '#57B4A697',
    borderSoft: '#3D9B8466',
    disabledBg: '#8FEEE6DB',
    hairline: '#1F5B5046',
    disabledBorder: '#C1C7CD',
    selection: '#33594632',
    surfaceFade: '#00FFFCF8',
    knob: '#FAFFFCF8',
    accent: '#F48B13',
    error: '#D7473E',
    warning: '#C08020',
    scrim: '#40FFFFFF',
  },
  warm: {
    paperStart: '#FFF6E9',
    paperEnd: '#FFF6E9',
    bodyInk: '#2C241D',
    paperTexture: false,
    sourcePaperLighting: false,
    surface: '#FFF9F0',
    surfaceElevated: '#C8FFF6EC',
    surfacePanelSoft: '#A3FFF6EC',
    ink: '#33291F',
    inkSecondary: '#6B5D4E',
    inkTertiary: '#9A8B79',
    chromeMeta: '#7A6E60',
    primary: '#2F6373',
    onPrimary: '#FFFFFF',
    activeSoft: '#142F6373',
    icon: '#524A40',
    handle: '#C2B4A4',
    lineStrong: '#57B4A697',
    borderSoft: '#3D9B8466',
    disabledBg: '#99F2EADB',
    hairline: '#1F5B5046',
    disabledBorder: '#C1C7CD',
    selection: '#33594632',
    surfaceFade: '#00FFFCF8',
    knob: '#FAFFFCF8',
    accent: '#F48B13',
    error: '#D7473E',
    warning: '#C08020',
    scrim: '#40FFFFFF',
  },
  night: {
    paperStart: '#26231F',
    paperEnd: '#26231F',
    bodyInk: '#E9DECE',
    paperTexture: false,
    sourcePaperLighting: false,
    surface: '#332E28',
    surfaceElevated: '#3E3830',
    surfacePanelSoft: '#38322B',
    ink: '#E9DECE',
    inkSecondary: '#BFB2A0',
    inkTertiary: '#94897A',
    chromeMeta: '#C8C0B4',
    primary: '#7FAFC2',
    onPrimary: '#16282E',
    activeSoft: '#337FAFC2',
    icon: '#CFC5B6',
    handle: '#6E655A',
    lineStrong: '#4C453C',
    borderSoft: '#267FAFC2',
    disabledBg: '#404845',
    hairline: '#1FE9DECE',
    disabledBorder: '#4A443C',
    selection: '#33E9DECE',
    surfaceFade: '#00332E28',
    knob: '#E9DECE',
    accent: '#F48B13',
    error: '#D7473E',
    warning: '#C08020',
    scrim: '#4015110D',
  },
  warmNight: {
    paperStart: '#27231F',
    paperEnd: '#27231F',
    bodyInk: '#E7D8C8',
    paperTexture: false,
    sourcePaperLighting: false,
    surface: '#352E27',
    surfaceElevated: '#403830',
    surfacePanelSoft: '#3A332C',
    ink: '#E7D8C8',
    inkSecondary: '#C0B09E',
    inkTertiary: '#96887A',
    chromeMeta: '#C8BCAC',
    primary: '#CBA672',
    onPrimary: '#2E2416',
    activeSoft: '#33CBA672',
    icon: '#CFC2B0',
    handle: '#6E6458',
    lineStrong: '#4C443A',
    borderSoft: '#26CBA672',
    disabledBg: '#474036',
    hairline: '#1FE7D8C8',
    disabledBorder: '#4A423A',
    selection: '#33E7D8C8',
    surfaceFade: '#00352E27',
    knob: '#E7D8C8',
    accent: '#F48B13',
    error: '#D7473E',
    warning: '#C08020',
    scrim: '#4015110D',
  },
  paper: {
    paperStart: '#FBF4E9',
    paperEnd: '#EFE2D0',
    bodyInk: '#2B241D',
    paperTexture: true,
    sourcePaperLighting: true,
    surface: '#FAF3E6',
    surfaceElevated: '#C8F5EBD9',
    surfacePanelSoft: '#A3F5EBD9',
    ink: '#332B22',
    inkSecondary: '#695C4C',
    inkTertiary: '#978976',
    chromeMeta: '#77695B',
    primary: '#2F6373',
    onPrimary: '#FFFFFF',
    activeSoft: '#142F6373',
    icon: '#514940',
    handle: '#C0B2A0',
    lineStrong: '#57B4A697',
    borderSoft: '#3D9B8466',
    disabledBg: '#99F0E5D2',
    hairline: '#1F5B5046',
    disabledBorder: '#C1C7CD',
    selection: '#33594632',
    surfaceFade: '#00FFFCF8',
    knob: '#FAFFFCF8',
    accent: '#F48B13',
    error: '#D7473E',
    warning: '#C08020',
    scrim: '#40FFFFFF',
  },
  green: {
    paperStart: '#EEF5E8',
    paperEnd: '#EEF5E8',
    bodyInk: '#263423',
    paperTexture: false,
    sourcePaperLighting: false,
    surface: '#F1F6EC',
    surfaceElevated: '#C8EFF3E6',
    surfacePanelSoft: '#A3EFF3E6',
    ink: '#2C3828',
    inkSecondary: '#5D6B57',
    inkTertiary: '#8A9682',
    chromeMeta: '#6E7A67',
    primary: '#3D7A54',
    onPrimary: '#FFFFFF',
    activeSoft: '#143D7A54',
    icon: '#47543F',
    handle: '#B3C0A8',
    lineStrong: '#57A0AE93',
    borderSoft: '#3D7A5466',
    disabledBg: '#99E4EDD9',
    hairline: '#1F5B5046',
    disabledBorder: '#C1C7CD',
    selection: '#33594632',
    surfaceFade: '#00FFFCF8',
    knob: '#FAFFFCF8',
    accent: '#F48B13',
    error: '#D7473E',
    warning: '#C08020',
    scrim: '#40FFFFFF',
  },
  paperNight: {
    paperStart: '#302B26',
    paperEnd: '#211F1C',
    bodyInk: '#E9DECE',
    paperTexture: true,
    sourcePaperLighting: false,
    surface: '#38322B',
    surfaceElevated: '#433C34',
    surfacePanelSoft: '#3D372F',
    ink: '#E9DECE',
    inkSecondary: '#C1B4A2',
    inkTertiary: '#978B7C',
    chromeMeta: '#C8C0B4',
    primary: '#B99C6B',
    onPrimary: '#2B2314',
    activeSoft: '#33B99C6B',
    icon: '#D0C4B4',
    handle: '#6F675B',
    lineStrong: '#4E463D',
    borderSoft: '#26B99C6B',
    disabledBg: '#454B42',
    hairline: '#1FE9DECE',
    disabledBorder: '#4C463D',
    selection: '#33E9DECE',
    surfaceFade: '#0038322B',
    knob: '#E9DECE',
    accent: '#F48B13',
    error: '#D7473E',
    warning: '#C08020',
    scrim: '#4015110D',
  },
  greenNight: {
    paperStart: '#202B26',
    paperEnd: '#202B26',
    bodyInk: '#D8E2D2',
    paperTexture: false,
    sourcePaperLighting: false,
    surface: '#2C3A34',
    surfaceElevated: '#37463F',
    surfacePanelSoft: '#31403A',
    ink: '#D8E2D2',
    inkSecondary: '#AEBFB2',
    inkTertiary: '#84948A',
    chromeMeta: '#BECBBF',
    primary: '#8FBC9F',
    onPrimary: '#14261D',
    activeSoft: '#338FBC9F',
    icon: '#C2CFC5',
    handle: '#5E6B62',
    lineStrong: '#414E46',
    borderSoft: '#268FBC9F',
    disabledBg: '#3C4A44',
    hairline: '#1FD8E2D2',
    disabledBorder: '#3E4C45',
    selection: '#33D8E2D2',
    surfaceFade: '#002C3A34',
    knob: '#D8E2D2',
    accent: '#F48B13',
    error: '#D7473E',
    warning: '#C08020',
    scrim: '#4015110D',
  },
};

export function readerThemePalette(theme: ReaderAppearanceTheme): ReaderThemePalette {
  if (theme === 'warm') {
    return READER_THEME_PALETTES.warm;
  }
  if (theme === 'night') {
    return READER_THEME_PALETTES.night;
  }
  if (theme === 'warmNight') {
    return READER_THEME_PALETTES.warmNight;
  }
  if (theme === 'paper') {
    return READER_THEME_PALETTES.paper;
  }
  if (theme === 'green') {
    return READER_THEME_PALETTES.green;
  }
  if (theme === 'paperNight') {
    return READER_THEME_PALETTES.paperNight;
  }
  if (theme === 'greenNight') {
    return READER_THEME_PALETTES.greenNight;
  }
  // Fail closed to the day palette, matching the V1-only fail-closed rule.
  return READER_THEME_PALETTES.day;
}
