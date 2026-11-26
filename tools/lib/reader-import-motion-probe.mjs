import { readFileSync } from 'node:fs';
import { pureModuleProbe } from './ets-pure-module-probe.mjs';
import { READER_REDUCED_FADE_MS } from '../../entry/src/main/ets/ui/foundation/ProductMotionTiming.ts';

function effect(kind, value) {
  return {
    kind, value,
    animation(parameters) { return { kind, value, parameters }; },
    combine(other) { return effect('combine', [this, other]); },
  };
}

export function readerImportMotionForProbe() {
  const TransitionEffect = {
    OPACITY: effect('opacity'), IDENTITY: effect('identity'),
    scale: value => effect('scale', value), translate: value => effect('translate', value),
    asymmetric: (appear, disappear) => ({ appear, disappear }),
  };
  return pureModuleProbe(readFileSync(new URL('../../entry/src/main/ets/ui/surfaces/ReaderImportDialogStyle.ets', import.meta.url), 'utf8'),
    'ReaderImportDialogStyle.ets', {
      TransitionEffect,
      readerMotionStandardCurve: () => 'standard',
      readerMotionReducedFadeParam: () => ({ duration: READER_REDUCED_FADE_MS, curve: 'ease-out' }),
    }, ['readerImportCardTransition', 'readerImportOverlayTransition']);
}
