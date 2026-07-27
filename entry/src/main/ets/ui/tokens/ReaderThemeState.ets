// ReaderThemeState — holds runtime theme state in AppStorage.
// colorMode is informational for Phase 1 (colors auto-adapt via $r resources; the contract
// has no dark variants yet, so dark = base). reducedMotion is mirrored from UiState by the
// store so non-component code (e.g. MotionAdapter callers without a UiState in scope) can read it.

export type ColorMode = 'light' | 'dark';

export class ReaderThemeState {
  private static readonly KEY_COLOR_MODE = 'reader.theme.colorMode';
  private static readonly KEY_REDUCED_MOTION = 'reader.theme.reducedMotion';

  static init(): void {
    AppStorage.setOrCreate<string>(ReaderThemeState.KEY_COLOR_MODE, 'light');
    AppStorage.setOrCreate<boolean>(ReaderThemeState.KEY_REDUCED_MOTION, false);
  }

  static colorMode(): ColorMode {
    return AppStorage.get<string>(ReaderThemeState.KEY_COLOR_MODE) === 'dark' ? 'dark' : 'light';
  }

  static setColorMode(mode: ColorMode): void {
    AppStorage.set<string>(ReaderThemeState.KEY_COLOR_MODE, mode);
  }

  static reducedMotion(): boolean {
    return AppStorage.get<boolean>(ReaderThemeState.KEY_REDUCED_MOTION) === true;
  }

  static setReducedMotion(enabled: boolean): void {
    AppStorage.set<boolean>(ReaderThemeState.KEY_REDUCED_MOTION, enabled);
  }
}
