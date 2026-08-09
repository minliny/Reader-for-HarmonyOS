/**
 * Pure, versioned state for the Reader Settings module.
 *
 * Figma defines the complete option vocabulary. The current Harmony bundle,
 * however, has no admitted window/audio Host for orientation, screen timeout,
 * system bars, volume keys, or TTS lifecycle. Those values remain visible in
 * the panels but normalize to their safe no-op values here. Only layout/text
 * options that the reading surface can apply locally are writable today.
 */
export type ReaderScreenDirection = 'system' | 'portrait' | 'landscape';

export type ReaderPageTurnStyle = 'cover' | 'slide' | 'simulation' | 'scroll' | 'none';

export type ReaderScreenTimeout = 'system' | 'oneMinute' | 'fiveMinutes' | 'tenMinutes' | 'alwaysOn';

export type ReaderSettingsToggleKey =
  | 'hideStatusBar'
  | 'hideNavigationBar'
  | 'extendIntoCutout'
  | 'justifyText'
  | 'alignPageBottom'
  | 'volumeKeysTurnPage'
  | 'stopTtsOnScreenOff'
  | 'longPressSelectText';

export type ReaderSettingsSnapshot = {
  version: 1;
  screenDirection: ReaderScreenDirection;
  pageTurnStyle: ReaderPageTurnStyle;
  screenTimeout: ReaderScreenTimeout;
  hideStatusBar: boolean;
  hideNavigationBar: boolean;
  extendIntoCutout: boolean;
  justifyText: boolean;
  alignPageBottom: boolean;
  volumeKeysTurnPage: boolean;
  stopTtsOnScreenOff: boolean;
  longPressSelectText: boolean;
};

export function createDefaultReaderSettingsSnapshot(): ReaderSettingsSnapshot {
  return {
    version: 1,
    screenDirection: 'system',
    pageTurnStyle: 'none',
    screenTimeout: 'system',
    hideStatusBar: false,
    hideNavigationBar: false,
    extendIntoCutout: false,
    justifyText: true,
    alignPageBottom: false,
    volumeKeysTurnPage: false,
    stopTtsOnScreenOff: false,
    longPressSelectText: true,
  };
}

/**
 * Decoded preferences are not trusted. Host-backed fields always fail closed,
 * even when an older or hand-edited snapshot contains a visually valid Figma
 * option. Pure local fields fall back independently when malformed.
 */
export function normalizeReaderSettingsSnapshot(
  candidate: ReaderSettingsSnapshot,
): ReaderSettingsSnapshot {
  const fallback = createDefaultReaderSettingsSnapshot();
  if (candidate === undefined || candidate === null) {
    return fallback;
  }
  return {
    version: 1,
    screenDirection: 'system',
    pageTurnStyle: 'none',
    screenTimeout: 'system',
    hideStatusBar: false,
    hideNavigationBar: false,
    extendIntoCutout: false,
    justifyText: booleanOrFallback(candidate.justifyText, fallback.justifyText),
    alignPageBottom: booleanOrFallback(candidate.alignPageBottom, fallback.alignPageBottom),
    volumeKeysTurnPage: false,
    stopTtsOnScreenOff: false,
    longPressSelectText: booleanOrFallback(candidate.longPressSelectText, fallback.longPressSelectText),
  };
}

export function copyReaderSettingsSnapshot(snapshot: ReaderSettingsSnapshot): ReaderSettingsSnapshot {
  return normalizeReaderSettingsSnapshot(snapshot);
}

export function setReaderSettingsToggle(
  snapshot: ReaderSettingsSnapshot,
  key: ReaderSettingsToggleKey,
  value: boolean,
): ReaderSettingsSnapshot {
  if (!isReaderSettingsToggleAvailable(key)) {
    throw new RangeError(`${key} requires an unavailable Reader Host capability`);
  }
  const current = copyReaderSettingsSnapshot(snapshot);
  return normalizeReaderSettingsSnapshot({
    version: 1,
    screenDirection: current.screenDirection,
    pageTurnStyle: current.pageTurnStyle,
    screenTimeout: current.screenTimeout,
    hideStatusBar: current.hideStatusBar,
    hideNavigationBar: current.hideNavigationBar,
    extendIntoCutout: current.extendIntoCutout,
    justifyText: key === 'justifyText' ? value : current.justifyText,
    alignPageBottom: key === 'alignPageBottom' ? value : current.alignPageBottom,
    volumeKeysTurnPage: current.volumeKeysTurnPage,
    stopTtsOnScreenOff: current.stopTtsOnScreenOff,
    longPressSelectText: key === 'longPressSelectText' ? value : current.longPressSelectText,
  });
}

export function isReaderScreenDirectionAvailable(direction: ReaderScreenDirection): boolean {
  return direction === 'system';
}

export function isReaderPageTurnStyleAvailable(style: ReaderPageTurnStyle): boolean {
  return style === 'none';
}

export function isReaderScreenTimeoutAvailable(timeout: ReaderScreenTimeout): boolean {
  return timeout === 'system';
}

export function isReaderSettingsToggleAvailable(key: ReaderSettingsToggleKey): boolean {
  return key === 'justifyText' || key === 'alignPageBottom' || key === 'longPressSelectText';
}

function booleanOrFallback(value: boolean, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}
