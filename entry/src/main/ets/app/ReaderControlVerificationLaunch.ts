import type { MangaOfflineProbeScope, MangaProbeSelectionMode } from './MangaOfflineNetworkProbe';

/**
 * Production EntryAbility has one default cold-start page. Diagnostic pages
 * are admitted only for an exact debug cold start used by the local VM probe.
 */
export type ReaderColdStartPage = 'pages/Index' | 'pages/ReaderControlMotionVerification' | 'pages/ReaderRendererPilot' | 'pages/__ReaderStartupMainLoadFailure';

/**
 * Cold-start-only allowlist. Only primitive boolean true is accepted, and
 * both generated debug fields must identify the debug build. Any conflict
 * falls back to the normal reader shell.
 */
export function readerControlVerificationColdStartPage(debug: boolean,
  buildModeName: string, parameterValue: Object | undefined,
  rendererParameterValue: Object | undefined = undefined,
  mainLoadFailureParameterValue: Object | undefined = undefined): ReaderColdStartPage {
  if (debug !== true || buildModeName !== 'debug') return 'pages/Index';
  const motion = parameterValue === true;
  const renderer = rendererParameterValue === true;
  const mainLoadFailure = mainLoadFailureParameterValue === true;
  if ((motion && renderer) || (mainLoadFailure && (motion || renderer))) return 'pages/Index';
  // Deliberately not registered as a page. Failure comes from the actual
  // platform dispatch/callback; EntryAbility consumes this destination once.
  if (mainLoadFailure) return 'pages/__ReaderStartupMainLoadFailure';
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

/** Explicit debug Want for preserve-data VM cache maintenance. This flag is
 * never inferred from a route or error and is ignored by release builds. */
export function readerRebuildableCacheClearEnabled(debug: boolean, buildModeName: string,
  parameterValue: Object | undefined): boolean {
  return debug === true && buildModeName === 'debug' && parameterValue === true;
}

/** Exact cold Want only. Never persists or accepts a warm route parameter. */
export function readerMangaOfflineProbeScope(debug: boolean, buildModeName: string,
  enabled: Object | undefined, sourceId: Object | undefined, bookId: Object | undefined,
  otherProbeEnabled: Object | undefined = undefined): MangaOfflineProbeScope | undefined {
  if (debug !== true || buildModeName !== 'debug' || enabled !== true || otherProbeEnabled === true ||
    typeof sourceId !== 'string' || typeof bookId !== 'string' || sourceId.length === 0 || bookId.length === 0 ||
    sourceId.length > 8192 || bookId.length > 8192 || sourceId.trim() !== sourceId || bookId.trim() !== bookId ||
    /[\u0000-\u001f\u007f]/.test(sourceId) || /[\u0000-\u001f\u007f]/.test(bookId)) return undefined;
  return { sourceId, bookId };
}

/** Normal online reading only. Conflicting primitive true flags enable neither
 * observer nor offline blocker; both parsers share the exact cold scope rules. */
export function readerMangaReadingProbeScope(debug: boolean, buildModeName: string,
  enabled: Object | undefined, sourceId: Object | undefined, bookId: Object | undefined,
  offlineEnabled: Object | undefined = undefined): MangaOfflineProbeScope | undefined {
  return readerMangaOfflineProbeScope(debug, buildModeName, enabled, sourceId, bookId, offlineEnabled);
}

/** Selection-only diagnostics are admitted by EntryAbility.onCreate alone.
 * A conflicting primitive true diagnostic enables neither selection probe.
 * Unlike exact-ID Wants, this mode cannot protect or observe any book network
 * until the normal manga shelf selection provides the exact Native identity. */
export function readerMangaProbeSelectionMode(debug: boolean, buildModeName: string,
  offlineSelect: Object | undefined, readingSelect: Object | undefined,
  conflictingFlags: Array<Object | undefined> = []): MangaProbeSelectionMode | undefined {
  if (debug !== true || buildModeName !== 'debug') return undefined;
  const offline = offlineSelect === true;
  const reading = readingSelect === true;
  if (offline === reading || conflictingFlags.some((value: Object | undefined): boolean => value === true)) return undefined;
  return offline ? 'offline' : 'reading';
}
