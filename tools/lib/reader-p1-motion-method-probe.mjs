import { productionMotionMethods as actualMethods } from './reader-motion-method-probe.mjs';
import { drainReaderPagePreparation } from '../../entry/src/main/ets/features/reading/ui/ReaderPagePreparationCoordinator.ts';
import { measureReaderControlMinimumCandidates } from '../../entry/src/main/ets/features/reading/ui/ReaderControlMinimumReceipt.ts';

/** Only opted-in reader fixtures link the newly extracted production helpers.
 * The global method probe and unrelated indexed definitions remain unchanged. */
export function productionMotionMethods(file, names, dependencies = {}) {
  names = [...names];
  if (names.includes('drainPageTurnPreparationQueue') && !names.includes('retryPageTurnPreparation'))
    names.push('retryPageTurnPreparation');
  return actualMethods(file, names, { drainReaderPagePreparation,
    measureReaderControlMinimumCandidates, ...dependencies });
}
