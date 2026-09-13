/**
 * Pure, versioned state for the Reader Settings module.
 *
 * The page-turn choices describe two different concerns. `scroll`
 * changes the navigation model, while the remaining choices select a transition for
 * paged navigation. Persist those facts independently so later transition
 * work never has to reinterpret a single overloaded enum.
 */
export type ReaderScreenDirection = 'system' | 'portrait' | 'landscape';

export type ReaderNavigationMode = 'paged' | 'continuous';

export type ReaderPageTransition = 'simulation' | 'cover' | 'slide' | 'none';

/** Presentation vocabulary used by the Figma-backed settings controls. */
export type ReaderPageTurnStyle = 'simulation' | 'cover' | 'slide' | 'scroll' | 'none';

export type ReaderScreenTimeout = 'system' | 'oneMinute' | 'fiveMinutes' | 'tenMinutes' | 'alwaysOn';

export type ReaderSettingsToggleKey =
  | 'hideNavigationBar'
  | 'extendIntoCutout'
  | 'justifyText'
  | 'alignPageBottom'
  | 'volumeKeysTurnPage'
  | 'stopTtsOnScreenOff'
  | 'longPressSelectText';

export type ReaderSettingsSnapshot = {
  version: 5;
  screenDirection: ReaderScreenDirection;
  navigationMode: ReaderNavigationMode;
  pageTransition: ReaderPageTransition;
  screenTimeout: ReaderScreenTimeout;
  hideNavigationBar: boolean;
  extendIntoCutout: boolean;
  /** Compatibility field only; ReaderAppearance remains the single owner. */
  justifyText: boolean;
  alignPageBottom: boolean;
  volumeKeysTurnPage: boolean;
  stopTtsOnScreenOff: boolean;
  longPressSelectText: boolean;
};

/** Raw V4 migration input; never written again. */
export type ReaderSettingsSnapshotV4 = {
  version: 4;
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

/** On-disk shape written while text selection still defaulted to disabled. */
export type ReaderSettingsSnapshotV3 = {
  version: 3;
  screenDirection: ReaderScreenDirection;
  navigationMode: ReaderNavigationMode;
  pageTransition: ReaderPageTransition;
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

/** On-disk shape written before immersive reading hid the system status bar by default. */
export type ReaderSettingsSnapshotV2 = {
  version: 2;
  screenDirection: ReaderScreenDirection;
  navigationMode: ReaderNavigationMode;
  pageTransition: ReaderPageTransition;
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
    version: 5,
    screenDirection: 'system',
    navigationMode: 'paged',
    pageTransition: 'slide',
    screenTimeout: 'system',
    hideNavigationBar: false,
    extendIntoCutout: false,
    justifyText: false,
    alignPageBottom: false,
    volumeKeysTurnPage: false,
    stopTtsOnScreenOff: false,
    longPressSelectText: true,
  };
}

/**
 * Decoded preferences are not trusted. V1/V2/V3 are migrated at this boundary;
 * every field then validates independently and malformed values fail back to
 * the safe default without erasing valid siblings. V3 is the first version in
 * which `hideStatusBar` represents an explicit user choice: older snapshots
 * are moved to the new immersive default once by ReaderSettingsGateway. V4
 * enables the now-functional native text-selection path once for existing
 * installs; subsequent explicit V4 choices remain stable.
 */
export function normalizeReaderSettingsSnapshot(
  candidate: ReaderSettingsSnapshot | ReaderSettingsSnapshotV4 | ReaderSettingsSnapshotV3 | ReaderSettingsSnapshotV2 |
    ReaderSettingsSnapshotV1 | undefined | null,
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
    version: 5,
    screenDirection: candidate.screenDirection === 'portrait' || candidate.screenDirection === 'landscape' ?
      candidate.screenDirection : 'system',
    navigationMode: pageTurn.navigationMode,
    pageTransition: pageTurn.pageTransition,
    screenTimeout: isReaderScreenTimeout(candidate.screenTimeout) ? candidate.screenTimeout : fallback.screenTimeout,
    hideNavigationBar: candidate.hideNavigationBar === true,
    // Read raw fields before adding defaults: an explicitly stored extend
    // value wins. Only V3/V4 missing that field migrate their old hide value.
    extendIntoCutout: typeof candidate.extendIntoCutout === 'boolean' ? candidate.extendIntoCutout :
      (candidate.version === 3 || candidate.version === 4) ? candidate.hideStatusBar === true : false,
    // ReaderAppearance owns justification; never recreate a second truth from
    // a stale V1 settings value.
    justifyText: false,
    alignPageBottom: candidate.alignPageBottom === true,
    volumeKeysTurnPage: candidate.volumeKeysTurnPage === true,
    stopTtsOnScreenOff: candidate.stopTtsOnScreenOff === true,
    longPressSelectText: candidate.version === 4 || candidate.version === 5 ? candidate.longPressSelectText === true : true,
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
  return snapshot.navigationMode === 'paged';
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
  return style === 'simulation' || style === 'cover' || style === 'slide' || style === 'scroll' || style === 'none';
}

export function isReaderScreenTimeoutAvailable(timeout: ReaderScreenTimeout): boolean {
  return isReaderScreenTimeout(timeout);
}

export function isReaderSettingsToggleAvailable(key: ReaderSettingsToggleKey): boolean {
  // Justification is exposed through ReaderAppearance and deliberately remains
  // unavailable here so settings cannot become a second owner.
  return key === 'hideNavigationBar' || key === 'extendIntoCutout' || key === 'alignPageBottom' ||
    key === 'volumeKeysTurnPage' || key === 'stopTtsOnScreenOff' || key === 'longPressSelectText';
}

function pageTurnContractFor(style: ReaderPageTurnStyle): ReaderPageTurnContract {
  if (style === 'scroll') {
    return new ReaderPageTurnContract('continuous', 'slide');
  }
  if (style === 'simulation' || style === 'cover' || style === 'none') {
    return new ReaderPageTurnContract('paged', style);
  }
  return new ReaderPageTurnContract('paged', 'slide');
}

function isReaderPageTransition(value: ReaderPageTransition): boolean {
  return value === 'simulation' || value === 'cover' || value === 'slide' || value === 'none';
}

function isReaderScreenTimeout(value: ReaderScreenTimeout): boolean {
  return value === 'system' || value === 'oneMinute' || value === 'fiveMinutes' ||
    value === 'tenMinutes' || value === 'alwaysOn';
}
