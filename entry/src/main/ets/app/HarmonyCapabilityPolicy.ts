export type ReaderNavigationOverride = 'unset' | 'unified' | 'systemNative';
export type ReaderNativeNavigationMaterial = 'unavailable' | 'adaptive' | 'immersive';
export type ReaderNavigationAppearance = 'unified' | 'adaptive' | 'immersive';

export interface ReaderNavigationPreferences {
  override: ReaderNavigationOverride;
  reduceTransparency: boolean;
}

export interface ReaderNavigationPreferenceChange {
  override?: ReaderNavigationOverride;
  reduceTransparency?: boolean;
}

export interface HarmonyCapabilityPort {
  distributionVersion: () => number;
  api26: () => boolean;
  navigation: () => boolean;
  material: (api26: boolean) => ReaderNativeNavigationMaterial;
  grip: () => boolean;
}

export interface ReaderHarmonyCapabilities {
  distributionVersion: number;
  api23: boolean;
  api24: boolean;
  api26: boolean;
  nativeNavigation: boolean;
  nativeMaterial: ReaderNativeNavigationMaterial;
  grip: boolean;
}

function readCapability(query: () => boolean): boolean {
  try { return query() === true; } catch (_) { return false; }
}

export function readHarmonyDistributionVersion(read: () => number): number {
  try {
    const version = read();
    if (Number.isSafeInteger(version) && version > 0) return version;
  } catch (_) {}
  return 0;
}

export function harmonyDistributionSupportsApi24(version: number): boolean { return version >= 60101; }

/** Check the distribution API before invoking optional platform methods. */
export function probeHarmonyCapabilities(port: HarmonyCapabilityPort): ReaderHarmonyCapabilities {
  const version = readHarmonyDistributionVersion(port.distributionVersion);
  const api23 = version >= 60100;
  const api24 = harmonyDistributionSupportsApi24(version);
  const api26 = version >= 260000 && readCapability(port.api26);
  const nativeNavigation = api23 && readCapability(port.navigation);
  let nativeMaterial: ReaderNativeNavigationMaterial = 'unavailable';
  if (nativeNavigation) {
    try {
      const supported = port.material(api26);
      if (supported === 'adaptive' || supported === 'immersive') {
        nativeMaterial = api26 && supported === 'immersive' ? 'immersive' : 'adaptive';
      }
    } catch (_) {}
  }
  return { distributionVersion: version, api23, api24, api26, nativeNavigation, nativeMaterial,
    grip: api23 && readCapability(port.grip) };
}

export function normalizeReaderNavigationPreferences(value: ReaderNavigationPreferenceChange | undefined):
  ReaderNavigationPreferences {
  const override = value?.override;
  return { override: override === 'systemNative' || override === 'unified' ? override : 'unset',
    reduceTransparency: value?.reduceTransparency === true };
}

/** HDS follows system colors. Keep the override when the app theme or
 * accessibility preference temporarily requires the opaque Reader surface. */
export function resolveReaderNavigationAppearance(preferences: ReaderNavigationPreferences,
  capabilities: ReaderHarmonyCapabilities, appScheme: string, systemScheme: string,
  sharedIntent: ReaderNavigationOverride = 'unset'): ReaderNavigationAppearance {
  const intent = preferences.override === 'unset' ? sharedIntent : preferences.override;
  if (intent !== 'systemNative' || preferences.reduceTransparency ||
    !capabilities.nativeNavigation || appScheme !== systemScheme ||
    (appScheme !== 'day' && appScheme !== 'night') || capabilities.nativeMaterial === 'unavailable') return 'unified';
  return capabilities.nativeMaterial;
}

export function adoptReaderNavigationAppearance(current: ReaderNavigationAppearance,
  requested: ReaderNavigationAppearance, interactionInProgress: boolean): ReaderNavigationAppearance {
  return interactionInProgress ? current : requested;
}
