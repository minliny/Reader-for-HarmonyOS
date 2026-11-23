import type { ReaderPageTurnDirection } from './ReaderPageGestureState';

export type ReaderPagePreparationAttempt = 'begun' | 'retry' | 'abandon' | 'wait';

/** The reader retains the queue, generations, measurement lane and commits.
 * This finite coordinator owns only the existing order of preparation work. */
export interface ReaderPagePreparationPort {
  renderWorkBlocked: () => boolean;
  laneBlocked: () => boolean;
  take: () => ReaderPageTurnDirection | undefined;
  ready: (direction: ReaderPageTurnDirection) => boolean;
  prepare: (direction: ReaderPageTurnDirection) => ReaderPagePreparationAttempt;
  idle: () => void;
  begun: () => void;
  retry: (direction: ReaderPageTurnDirection) => void;
}

export function drainReaderPagePreparation(port: ReaderPagePreparationPort): void {
  if (port.renderWorkBlocked()) return;
  for (;;) {
    if (port.laneBlocked()) return;
    const direction = port.take();
    if (direction === undefined) { port.idle(); return; }
    if (port.ready(direction)) continue;
    const outcome = port.prepare(direction);
    if (outcome === 'wait') return;
    if (outcome === 'abandon') continue;
    if (outcome === 'begun') { port.begun(); return; }
    port.retry(direction);
    return;
  }
}
