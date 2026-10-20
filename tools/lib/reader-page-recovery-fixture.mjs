import { cancelReaderRapidPageTurn, createReaderRapidPageTurnState } from '../../entry/src/main/ets/features/reading/ReaderRapidPageTurnState.ts';
import { createReaderPageGestureState } from '../../entry/src/main/ets/features/reading/ReaderPageGestureState.ts';

export const readerPageRecoveryDependencies = { cancelReaderRapidPageTurn, createReaderPageGestureState };

/** Finite native/resource ports around the actual invalidate/release methods.
 * No generation, persistence or gesture-recovery algorithm is restated here. */
export function readerPageRecoveryPorts(subject, resumed = () => {}) {
  Object.assign(subject, {
    rapidPageTurnState: createReaderRapidPageTurnState(),
    pageTurnInputRevision: 0, bookmarkRollbackGeneration: 0, pageTurnGeneration: 0,
    bookTurnTextureCaptureGeneration: 0,
    autoPageCoordinator: { cancelPendingTurn() {} },
    clearPageTurnProjection() {}, finishPageTurnPerf() {},
    clearBookTurnCapturedIdentities() {}, releaseBookTurnTextureContent() {},
    releaseBookTurnPendingSnapshot() {}, releaseUnretainedReadingImages() {},
    resumeDeferredPageTurnWork: resumed,
  });
  return subject;
}
