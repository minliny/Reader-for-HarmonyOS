import type { MangaOfflineProbeScope } from './MangaOfflineNetworkProbe';

/**
 * Production EntryAbility has one default cold-start page. Diagnostic pages
 * are admitted only for an exact debug cold start used by the local VM probe.
 */
export type ReaderColdStartPage = 'pages/Index' | 'pages/ReaderControlMotionVerification' | 'pages/ReaderRendererPilot';

/**
 * Cold-start-only allowlist. Only primitive boolean true is accepted, and
 * both generated debug fields must identify the debug build. Any conflict
 * falls back to the normal reader shell.
 */
export function readerControlVerificationColdStartPage(debug: boolean,
  buildModeName: string, parameterValue: Object | undefined,
  rendererParameterValue: Object | undefined = undefined): ReaderColdStartPage {
  if (debug !== true || buildModeName !== 'debug') return 'pages/Index';
  const motion = parameterValue === true;
  const renderer = rendererParameterValue === true;
  if (motion && renderer) return 'pages/Index';
  if (renderer) return 'pages/ReaderRendererPilot';
  if (motion) return 'pages/ReaderControlMotionVerification';
  return 'pages/Index';
}

/** Diagnostic cold-start flag, independent of route selection. Never coerce
 * Want values: release builds and warm intents cannot enable this mode. */
export function readerDisableOptionalEntryMemory(debug: boolean, buildModeName: string,
  parameterValue: Object | undefined): boolean {
  return debug === true && buildModeName === 'debug' && parameterValue === true;
}

/** Exact cold Want only. Never persists or accepts a warm route parameter. */
export function readerMangaOfflineProbeScope(debug: boolean, buildModeName: string,
  enabled: Object | undefined, sourceId: Object | undefined, bookId: Object | undefined): MangaOfflineProbeScope | undefined {
  if (debug !== true || buildModeName !== 'debug' || enabled !== true ||
    typeof sourceId !== 'string' || typeof bookId !== 'string' || sourceId.length === 0 || bookId.length === 0 ||
    sourceId.length > 8192 || bookId.length > 8192 || sourceId.trim() !== sourceId || bookId.trim() !== bookId ||
    /[\u0000-\u001f\u007f]/.test(sourceId) || /[\u0000-\u001f\u007f]/.test(bookId)) return undefined;
  return { sourceId, bookId };
}
