import { READER_LAYOUT_DEBUG_BUILD } from './ReaderLayoutInvariantSignals';
import type { UIContext } from '@kit.ArkUI';
import type { ReaderTransitionObservation } from '../layout/TransitionInvariantEvaluator';

type ReaderTransitionConsumer = (observation: ReaderTransitionObservation) => void;
let consumer: ReaderTransitionConsumer | undefined;

export const READER_DETAIL_TRANSITION_HEADER = 'reader-detail-transition-header';
export const READER_DETAIL_PRIMARY_ACTION = 'reader-detail-primary-action';

export function readerTransitionsEnabled(): boolean {
  return READER_LAYOUT_DEBUG_BUILD && AppStorage.get<boolean>('readerAppForeground') === true &&
    (AppStorage.get<boolean>('readerDeveloperMode') === true || AppStorage.get<boolean>('readerLayoutInvariantAutomation') === true);
}

/** Frame-by-frame JS sampling (createAnimator / postFrameCallback) is reserved
 * for automated transition invariant probes, so enabling Developer Mode on
 * device keeps native animateTo playback smooth. */
export function readerTransitionFrameSamplingEnabled(): boolean {
  return READER_LAYOUT_DEBUG_BUILD && AppStorage.get<boolean>('readerAppForeground') === true &&
    AppStorage.get<boolean>('readerLayoutInvariantAutomation') === true;
}

export function observeReaderTransitions(receive: ReaderTransitionConsumer): () => void {
  consumer = receive;
  return (): void => { if (consumer === receive) consumer = undefined; };
}

export function readerBeginTransition(observation: ReaderTransitionObservation): void {
  if (readerTransitionsEnabled()) consumer?.(observation);
}

export function readerRouteTransitionLaneId(surface: string, lane: string): string {
  return `reader-route-transition:${surface}:${lane}`;
}

export function readerTransitionActorX(context: UIContext, id: string): number | undefined {
  if (!readerTransitionsEnabled()) return undefined;
  try {
    const node = context.getAttachedFrameNodeById(id);
    if (node === null || !node.isAttached() || node.isDisposed()) return undefined;
    const x = Number(node.getPositionToWindowWithTransform().x);
    return Number.isFinite(x) ? x : undefined;
  } catch (_) { return undefined; }
}
