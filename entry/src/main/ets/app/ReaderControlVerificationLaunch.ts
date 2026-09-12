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
