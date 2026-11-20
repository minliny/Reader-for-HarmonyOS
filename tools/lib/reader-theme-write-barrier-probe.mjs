import { readFileSync } from 'node:fs';
import { pureModuleProbe } from './ets-pure-module-probe.mjs';

/** Actual static seal/generation/recovery methods. Unselected window/theme
 * installation paths have no platform ports and are never exercised here. */
export function readerThemeWriteBarrierProbe(runtime = {}) {
  const source = readFileSync(new URL('../../entry/src/main/ets/app/ReaderThemeHost.ts', import.meta.url), 'utf8');
  return pureModuleProbe(source, 'ReaderThemeHost.ts', { ReaderRuntimeOwner: runtime }, ['ReaderThemeHost']).ReaderThemeHost;
}
