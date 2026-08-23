/**
 * Pure, versioned state for the Reader Settings module.
 *
 * The five Figma page-turn choices describe two different concerns. `scroll`
 * changes the navigation model, while the other four select a transition for
 * paged navigation. Persist those facts independently so later transition
 * work never has to reinterpret a single overloaded enum.
 */
export type ReaderScreenDirection = 'system' | 'portrait' | 'landscape';

export type ReaderNavigationMode = 'paged' | 'continuous';

export type ReaderPageTransition = 'cover' | 'slide' | 'simulation' | 'none';

/** Presentation vocabulary used by the Figma-backed settings controls. */
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
  version: 2;
  screenDirection: ReaderScreenDirection;
  navigationMode: ReaderNavigationMode;
  pageTransition: ReaderPageTransition;
  screenTimeout: ReaderScreenTimeout;
  hideStatusBar: boolean;
  hideNavigationBar: boolean;
  extendIntoCutout: boolean;
  /** Compatibility field only; ReaderAppearance remains the single owner. */
  justifyText: boolean;
  alignPageBottom: boolean;
  volumeKeysTurnPage: boolean;
  stopTtsOnScreenOff: boolean;
  longPressSelectText: boolean;
};

/** On-disk shape written before navigation and transition were separated. */
export type ReaderSettingsSnapshotV1 = {
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

class ReaderPageTurnContract {
  navigationMode: ReaderNavigationMode;
  pageTransition: ReaderPageTransition;

  constructor(navigationMode: ReaderNavigationMode, pageTransition: ReaderPageTransition) {
    this.navigationMode = navigationMode;
    this.pageTransition = pageTransition;
  }
}

export function createDefaultReaderSettingsSnapshot(): ReaderSettingsSnapshot {
  return {
    version: 2,
    screenDirection: 'system',
    navigationMode: 'paged',
    pageTransition: 'slide',
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
 * Decoded preferences are not trusted. V1 is migrated once at this boundary;
 * every V2 field then validates independently and malformed values fail back
 * to the safe default without erasing valid siblings.
 */
export function normalizeReaderSettingsSnapshot(
  candidate: ReaderSettingsSnapshot | ReaderSettingsSnapshotV1 | undefined | null,
): ReaderSettingsSnapshot {
  const fallback = createDefaultReaderSettingsSnapshot();
  if (candidate === undefined || candidate === null) {
    return fallback;
  }
  const pageTurn = candidate.version === 1 ?
    pageTurnContractFor(candidate.pageTurnStyle) :
    new ReaderPageTurnContract(
      candidate.navigationMode === 'continuous' ? 'continuous' : 'paged',
      isReaderPageTransition(candidate.pageTransition) ? candidate.pageTransition : fallback.pageTransition,
    );
  return {
    version: 2,
    screenDirection: candidate.screenDirection === 'portrait' || candidate.screenDirection === 'landscape' ?
      candidate.screenDirection : 'system',
    navigationMode: pageTurn.navigationMode,
    pageTransition: pageTurn.pageTransition,
    screenTimeout: isReaderScreenTimeout(candidate.screenTimeout) ? candidate.screenTimeout : fallback.screenTimeout,
    hideStatusBar: candidate.hideStatusBar === true,
    hideNavigationBar: candidate.hideNavigationBar === true,
    extendIntoCutout: candidate.extendIntoCutout === true,
    // ReaderAppearance owns justification; never recreate a second truth from
    // a stale V1 settings value.
    justifyText: false,
    alignPageBottom: candidate.alignPageBottom === true,
    volumeKeysTurnPage: candidate.volumeKeysTurnPage === true,
    stopTtsOnScreenOff: candidate.stopTtsOnScreenOff === true,
    longPressSelectText: candidate.longPressSelectText === true,
  };
}

export function copyReaderSettingsSnapshot(snapshot: ReaderSettingsSnapshot): ReaderSettingsSnapshot {
  return normalizeReaderSettingsSnapshot(snapshot);
}

export function readerPageTurnStyle(snapshot: ReaderSettingsSnapshot): ReaderPageTurnStyle {
  if (snapshot.navigationMode === 'continuous') {
    return 'scroll';
  }
  return snapshot.pageTransition;
}

export function readerPageTransitionUsesPreparedPages(snapshot: ReaderSettingsSnapshot): boolean {
  return snapshot.navigationMode === 'paged' && snapshot.pageTransition !== 'none';
}

export function setReaderScreenDirection(
  snapshot: ReaderSettingsSnapshot,
  direction: ReaderScreenDirection,
): ReaderSettingsSnapshot {
  if (!isReaderScreenDirectionAvailable(direction)) {
    throw new RangeError(`${direction} requires an unavailable Reader orientation capability`);
  }
  return normalizeReaderSettingsSnapshot({
    ...copyReaderSettingsSnapshot(snapshot),
    screenDirection: direction,
  });
}

export function setReaderScreenTimeout(
  snapshot: ReaderSettingsSnapshot,
  timeout: ReaderScreenTimeout,
): ReaderSettingsSnapshot {
  if (!isReaderScreenTimeoutAvailable(timeout)) {
    throw new RangeError(`${timeout} requires an unavailable Reader screen-awake lease`);
  }
  return normalizeReaderSettingsSnapshot({
    ...copyReaderSettingsSnapshot(snapshot),
    screenTimeout: timeout,
  });
}

export function setReaderPageTurnStyle(
  snapshot: ReaderSettingsSnapshot,
  style: ReaderPageTurnStyle,
): ReaderSettingsSnapshot {
  if (!isReaderPageTurnStyleAvailable(style)) {
    throw new RangeError(`${style} requires an unavailable Reader page-turn capability`);
  }
  const current = copyReaderSettingsSnapshot(snapshot);
  const pageTurn = pageTurnContractFor(style);
  return normalizeReaderSettingsSnapshot({
    ...current,
    navigationMode: pageTurn.navigationMode,
    pageTransition: pageTurn.pageTransition,
  });
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
    ...current,
    hideStatusBar: key === 'hideStatusBar' ? value : current.hideStatusBar,
    hideNavigationBar: key === 'hideNavigationBar' ? value : current.hideNavigationBar,
    extendIntoCutout: key === 'extendIntoCutout' ? value : current.extendIntoCutout,
    alignPageBottom: key === 'alignPageBottom' ? value : current.alignPageBottom,
    volumeKeysTurnPage: key === 'volumeKeysTurnPage' ? value : current.volumeKeysTurnPage,
    stopTtsOnScreenOff: key === 'stopTtsOnScreenOff' ? value : current.stopTtsOnScreenOff,
    longPressSelectText: key === 'longPressSelectText' ? value : current.longPressSelectText,
  });
}

export function isReaderScreenDirectionAvailable(direction: ReaderScreenDirection): boolean {
  return direction === 'system' || direction === 'portrait' || direction === 'landscape';
}

export function isReaderPageTurnStyleAvailable(style: ReaderPageTurnStyle): boolean {
  return style === 'cover' || style === 'slide' || style === 'simulation' || style === 'scroll' || style === 'none';
}

export function isReaderScreenTimeoutAvailable(timeout: ReaderScreenTimeout): boolean {
  return isReaderScreenTimeout(timeout);
}

export function isReaderSettingsToggleAvailable(key: ReaderSettingsToggleKey): boolean {
  // Justification is exposed through ReaderAppearance and deliberately remains
  // unavailable here so settings cannot become a second owner.
  return key !== 'justifyText';
}

function pageTurnContractFor(style: ReaderPageTurnStyle): ReaderPageTurnContract {
  if (style === 'scroll') {
    return new ReaderPageTurnContract('continuous', 'slide');
  }
  if (style === 'cover' || style === 'simulation' || style === 'none') {
    return new ReaderPageTurnContract('paged', style);
  }
  return new ReaderPageTurnContract('paged', 'slide');
}

function isReaderPageTransition(value: ReaderPageTransition): boolean {
  return value === 'cover' || value === 'slide' || value === 'simulation' || value === 'none';
}

function isReaderScreenTimeout(value: ReaderScreenTimeout): boolean {
  return value === 'system' || value === 'oneMinute' || value === 'fiveMinutes' ||
    value === 'tenMinutes' || value === 'alwaysOn';
}
