export type ReaderNavigationOverride = 'unset' | 'systemNative';
export type ReaderRenderMode = 'quality' | 'performance';
export type ReaderNativeNavigationMaterial = 'unavailable' | 'adaptive' | 'immersive';
export type ReaderNavigationAppearance = 'unified' | 'adaptive' | 'immersive';
export type ReaderSurfaceMaterialRole = 'chromeBar' | 'floatingDock' | 'sessionCapsule' | 'controlPanel' | 'popoverMenu' | 'modalSheet';
export type ReaderImmersiveStyleName = 'ultraThin' | 'thin' | 'regular' | 'thick' | 'ultraThick';

export interface ReaderSurfaceMaterialDecision {
  readonly native: boolean;
  readonly style: ReaderImmersiveStyleName;
  readonly interactive: boolean;
  readonly performanceMode: boolean;
}

export interface ReaderNavigationPreferences {
  override: ReaderNavigationOverride;
  renderMode: ReaderRenderMode;
}

export interface ReaderNavigationPreferenceChange {
  override?: ReaderNavigationOverride;
  renderMode?: ReaderRenderMode;
}

export interface ReaderNavigationPreferencesSnapshot {
  override?: ReaderNavigationOverride | 'unified';
  renderMode?: ReaderRenderMode;
  reduceTransparency?: boolean;
}

export interface ReaderModalScrimSpec {
  blurred: boolean;
  radiusVp: number;
  scrimColor: string;
}

export const READER_MODAL_BLUR_RADIUS_VP: number = 15;

export interface HarmonyCapabilityPort {
  distributionVersion: () => number;
  api26: () => boolean;
  navigation: () => boolean;
  material: (api26: boolean) => ReaderNativeNavigationMaterial;
  grip: () => boolean;
  surfaceMaterial?: () => boolean;
}

export interface ReaderHarmonyCapabilities {
  distributionVersion: number;
  api23: boolean;
  api24: boolean;
  api26: boolean;
  nativeNavigation: boolean;
  nativeMaterial: ReaderNativeNavigationMaterial;
  grip: boolean;
  immersiveSurfaceMaterial: boolean;
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
  const immersiveSurfaceMaterial = api26 && port.surfaceMaterial !== undefined && readCapability(port.surfaceMaterial);
  return { distributionVersion: version, api23, api24, api26, nativeNavigation, nativeMaterial,
    grip: api23 && readCapability(port.grip), immersiveSurfaceMaterial };
}

export function normalizeReaderNavigationPreferences(value: ReaderNavigationPreferencesSnapshot | undefined):
  ReaderNavigationPreferences {
  const renderMode = value?.renderMode;
  return { override: value?.override === 'systemNative' ? 'systemNative' : 'unset',
    renderMode: renderMode === 'performance' || (renderMode === undefined && value?.reduceTransparency === true) ?
      'performance' : 'quality' };
}

/** Select the HDS renderer only when it can show the same material as ArkUI. */
export function resolveReaderNavigationAppearance(preferences: ReaderNavigationPreferences,
  capabilities: ReaderHarmonyCapabilities, appScheme: string, systemScheme: string): ReaderNavigationAppearance {
  return canUseImmersiveSurfaceMaterial(preferences, capabilities, appScheme, systemScheme) &&
    capabilities.nativeNavigation && capabilities.nativeMaterial === 'immersive' ? 'immersive' : 'unified';
}

export function adoptReaderNavigationAppearance(current: ReaderNavigationAppearance,
  requested: ReaderNavigationAppearance, interactionInProgress: boolean): ReaderNavigationAppearance {
  // Strip native paint with the other surfaces, even when navigation input is held.
  if (requested === 'unified') return requested;
  return interactionInProgress ? current : requested;
}

function surfaceMaterialSpecForRole(role: ReaderSurfaceMaterialRole): { style: ReaderImmersiveStyleName; interactive: boolean } {
  switch (role) {
    case 'sessionCapsule':
      return { style: 'ultraThin', interactive: true };
    case 'chromeBar':
    case 'floatingDock':
      return { style: 'thin', interactive: false };
    case 'controlPanel':
    case 'popoverMenu':
      return { style: 'thick', interactive: false };
    case 'modalSheet':
      return { style: 'ultraThick', interactive: false };
  }
}

export function resolveReaderSurfaceMaterial(
  role: ReaderSurfaceMaterialRole,
  preferences: ReaderNavigationPreferences,
  capabilities: ReaderHarmonyCapabilities,
  appScheme: string,
  systemScheme: string,
): ReaderSurfaceMaterialDecision {
  const spec = surfaceMaterialSpecForRole(role);
  return {
    native: canUseImmersiveSurfaceMaterial(preferences, capabilities, appScheme, systemScheme),
    style: spec.style,
    interactive: spec.interactive,
    performanceMode: preferences.renderMode === 'performance',
  };
}

function canUseImmersiveSurfaceMaterial(preferences: ReaderNavigationPreferences, capabilities: ReaderHarmonyCapabilities,
  appScheme: string, systemScheme: string): boolean {
  return preferences.override === 'systemNative' && isReaderRealtimeBlurEnabled(preferences) &&
    capabilities.api26 && capabilities.immersiveSurfaceMaterial &&
    appScheme === systemScheme && (appScheme === 'day' || appScheme === 'night');
}

export function isReaderRealtimeBlurEnabled(preferences: ReaderNavigationPreferences): boolean {
  return preferences.renderMode === 'quality';
}

/** True when System Native appearance is enabled (frameless scroll-linked headers & full-page search). */
export function isReaderNativeChromeStyle(preferences: ReaderNavigationPreferences): boolean {
  return preferences.override === 'systemNative';
}

export function shouldBlurBackdrop(preferences: ReaderNavigationPreferences,
  overlayUsesNativeMaterial: boolean = false): boolean {
  return isReaderRealtimeBlurEnabled(preferences) && !overlayUsesNativeMaterial;
}

export function resolveReaderModalScrimSpec(preferences: ReaderNavigationPreferences, scheme: string,
  standardScrimColor: string, overlayUsesNativeMaterial: boolean = false): ReaderModalScrimSpec {
  if (!shouldBlurBackdrop(preferences, overlayUsesNativeMaterial))
    return { blurred: false, radiusVp: 0, scrimColor: standardScrimColor };
  return { blurred: true, radiusVp: READER_MODAL_BLUR_RADIUS_VP,
    scrimColor: scheme === 'night' ? '#6B000000' : '#3D151715' };
}
