/**
 * Pure, versioned state for the Reader Settings module.
 *
 * Figma defines the complete option vocabulary. Harmony owns the window and
 * key-event side effects; this value object owns only persisted user intent.
 * TTS screen-off lifecycle remains fail-closed until a screen-state Host is
 * admitted separately.
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
    justifyText: false,
    alignPageBottom: false,
    volumeKeysTurnPage: false,
    stopTtsOnScreenOff: false,
    longPressSelectText: false,
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
    screenDirection: isReaderScreenDirection(candidate.screenDirection) ?
      candidate.screenDirection : fallback.screenDirection,
    pageTurnStyle: isReaderPageTurnStyle(candidate.pageTurnStyle) ?
      candidate.pageTurnStyle : fallback.pageTurnStyle,
    screenTimeout: isReaderScreenTimeout(candidate.screenTimeout) ?
      candidate.screenTimeout : fallback.screenTimeout,
    hideStatusBar: booleanOrFallback(candidate.hideStatusBar, fallback.hideStatusBar),
    hideNavigationBar: booleanOrFallback(candidate.hideNavigationBar, fallback.hideNavigationBar),
    extendIntoCutout: booleanOrFallback(candidate.extendIntoCutout, fallback.extendIntoCutout),
    justifyText: booleanOrFallback(candidate.justifyText, fallback.justifyText),
    alignPageBottom: booleanOrFallback(candidate.alignPageBottom, fallback.alignPageBottom),
    volumeKeysTurnPage: booleanOrFallback(candidate.volumeKeysTurnPage, fallback.volumeKeysTurnPage),
    stopTtsOnScreenOff: false,
    longPressSelectText: false,
  };
}

export function setReaderScreenDirection(
  snapshot: ReaderSettingsSnapshot,
  direction: ReaderScreenDirection,
): ReaderSettingsSnapshot {
  if (!isReaderScreenDirection(direction)) {
    throw new RangeError(`unsupported Reader screen direction: ${direction}`);
  }
  return normalizeReaderSettingsSnapshot({ ...snapshot, screenDirection: direction });
}

export function setReaderPageTurnStyle(
  snapshot: ReaderSettingsSnapshot,
  style: ReaderPageTurnStyle,
): ReaderSettingsSnapshot {
  if (!isReaderPageTurnStyle(style)) {
    throw new RangeError(`unsupported Reader page-turn style: ${style}`);
  }
  return normalizeReaderSettingsSnapshot({ ...snapshot, pageTurnStyle: style });
}

export function setReaderScreenTimeout(
  snapshot: ReaderSettingsSnapshot,
  timeout: ReaderScreenTimeout,
): ReaderSettingsSnapshot {
  if (!isReaderScreenTimeout(timeout)) {
    throw new RangeError(`unsupported Reader screen timeout: ${timeout}`);
  }
  return normalizeReaderSettingsSnapshot({ ...snapshot, screenTimeout: timeout });
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
    hideStatusBar: key === 'hideStatusBar' ? value : current.hideStatusBar,
    hideNavigationBar: key === 'hideNavigationBar' ? value : current.hideNavigationBar,
    extendIntoCutout: key === 'extendIntoCutout' ? value : current.extendIntoCutout,
    justifyText: key === 'justifyText' ? value : current.justifyText,
    alignPageBottom: key === 'alignPageBottom' ? value : current.alignPageBottom,
    volumeKeysTurnPage: key === 'volumeKeysTurnPage' ? value : current.volumeKeysTurnPage,
    stopTtsOnScreenOff: current.stopTtsOnScreenOff,
    longPressSelectText: key === 'longPressSelectText' ? value : current.longPressSelectText,
  });
}

export function isReaderScreenDirectionAvailable(direction: ReaderScreenDirection): boolean {
  return isReaderScreenDirection(direction);
}

export function isReaderPageTurnStyleAvailable(style: ReaderPageTurnStyle): boolean {
  return isReaderPageTurnStyle(style);
}

export function isReaderScreenTimeoutAvailable(timeout: ReaderScreenTimeout): boolean {
  return isReaderScreenTimeout(timeout);
}

export function isReaderSettingsToggleAvailable(key: ReaderSettingsToggleKey): boolean {
  return key !== 'stopTtsOnScreenOff';
}

function isReaderScreenDirection(value: string): value is ReaderScreenDirection {
  return value === 'system' || value === 'portrait' || value === 'landscape';
}

function isReaderPageTurnStyle(value: string): value is ReaderPageTurnStyle {
  return value === 'cover' || value === 'slide' || value === 'simulation' || value === 'scroll' || value === 'none';
}

function isReaderScreenTimeout(value: string): value is ReaderScreenTimeout {
  return value === 'system' || value === 'oneMinute' || value === 'fiveMinutes' ||
    value === 'tenMinutes' || value === 'alwaysOn';
}

function booleanOrFallback(value: boolean, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}
