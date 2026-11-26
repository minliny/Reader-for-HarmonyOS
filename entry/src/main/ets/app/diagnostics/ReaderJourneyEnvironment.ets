import { defaultNavigationPreferences, readerSurfaceMaterialDecision } from '../../ui/surfaces/ReaderSurfaceMaterial';
import type { ReaderNavigationPreferences } from '../HarmonyCapabilityPolicy';
import type { ReaderWindowMetricsSnapshot } from '../../ui/foundation/ReaderWindowMetrics';

export interface ReaderJourneyEnvironment {
  material: 'native' | 'fallback' | 'performance';
  materialPolicy: 'quality' | 'performance';
  reducedMotion: boolean;
  fontScale: number;
  widthVp: number;
  heightVp: number;
}

/** Observation only. The harness changes preferences through their real UI owners. */
export function readerJourneyEnvironment(metrics: ReaderWindowMetricsSnapshot, scheme: string): ReaderJourneyEnvironment {
  const preferences = AppStorage.get<ReaderNavigationPreferences>('readerNavigationAppearancePreferences') ??
    defaultNavigationPreferences();
  const systemScheme = AppStorage.get<string>('readerSystemScheme') ?? 'day';
  const material = readerSurfaceMaterialDecision('chromeBar', preferences, scheme, systemScheme);
  return {
    material: material.native ? 'native' : material.performanceMode ? 'performance' : 'fallback',
    materialPolicy: preferences.renderMode,
    reducedMotion: AppStorage.get<boolean>('readerReduceMotion') === true,
    fontScale: metrics.systemFontScale, widthVp: metrics.windowRect.width, heightVp: metrics.windowRect.height,
  };
}
