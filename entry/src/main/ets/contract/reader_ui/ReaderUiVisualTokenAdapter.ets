// Reader-UI visual-token adapter.
//
// This file deliberately contains no literal visual value. It only gives the
// native renderer semantic names for the generated Reader-UI contract tokens.
// Exact current-Figma values live in ReaderUiVisualTokens (VisualAdmission.ets)
// and generic contract colors live in generated/ColorTokens. Keeping this
// adapter value-free prevents HarmonyOS from becoming a second visual source.
import { ColorTokens } from '../generated/ColorTokens';

export class ReaderUiNightPaletteTokens {
  static readonly muted: string = ColorTokens.muted;
  static readonly surface: string = ColorTokens.paperNight;
  static readonly surfaceSoft: string = ColorTokens.paperNight;
  static readonly floatingControlBg: string = ColorTokens.paperNight;
  static readonly border: string = ColorTokens.border;
  static readonly primary: string = ColorTokens.primaryNight;
  static readonly primaryDark: string = ColorTokens.primaryNight;
  static readonly accent: string = ColorTokens.primaryNight;
  static readonly metaBg: string = ColorTokens.paperNight;
  static readonly bottomBarBg: string = ColorTokens.paperNight;
}

export class ReaderUiWarmSurfaceTokens {
  static readonly secondaryText: string = ColorTokens.muted;
  static readonly strongText: string = ColorTokens.ink;
  static readonly disabledText: string = ColorTokens.muted;
  static readonly surface: string = ColorTokens.paper;
  static readonly surfaceAlt: string = ColorTokens.paperBright;
  static readonly disabledSurface: string = ColorTokens.floatingControlBgAlt;
  static readonly border: string = ColorTokens.border;
  static readonly onAccentText: string = ColorTokens.paper;
  static readonly accent: string = ColorTokens.primary;
}

export class ReaderUiErrorTokens {
  static readonly errorText: string = ColorTokens.statusWarn;
  static readonly errorTextStrong: string = ColorTokens.statusWarn;
  static readonly errorSurface: string = ColorTokens.paperBright;
  static readonly errorBorder: string = ColorTokens.statusWarn;
}
