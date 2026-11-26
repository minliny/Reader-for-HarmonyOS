import type { LocalReadingAnchor } from './LocalReadingFlowGateway';
import type { ReaderProgressProducerHost, ReaderProgressProducerIntent } from './ReaderProgressProducerHost';
import type { CoreReadingLayout } from './ReadingMeasurementFacts';
import type { ReadingSessionCommittedProgress } from './ReadingSessionFlowGateway';

export interface ReaderFirstPageMeasurementLease {
  isCurrent: () => boolean;
  liveLayoutSignature: () => string;
  resumeSuperseded: (measuredLayoutSignature: string) => boolean;
  hasCurrentControlCandidate: () => boolean;
  fail: (error: Error) => void;
}

interface ReaderOrdinaryFirstPage {
  readonly kind: 'ordinary';
  present: () => Promise<void>;
}

interface ReaderDurableFirstPage {
  readonly kind: 'durable';
  persist: (isAdmitted: () => boolean) => Promise<ReadingSessionCommittedProgress>;
  matchesAnchor: (stored: ReadingSessionCommittedProgress) => boolean;
  admitSavedProgress: (stored: ReadingSessionCommittedProgress) => void;
  present: (stored: ReadingSessionCommittedProgress) => void;
}

export type ReaderFirstPagePlan = ReaderOrdinaryFirstPage | ReaderDurableFirstPage;

const INITIAL_ANCHOR_MISMATCH = 'READING_INITIAL_PROGRESS_ANCHOR_MISMATCH';

/** Ordinary input is released before a save can settle. A source switch or
 * control selection must admit the exact durable receipt before presentation. */
export async function completeReaderFirstPage(lease: ReaderFirstPageMeasurementLease,
  prepare: (measuredLayoutSignature: string) => ReaderFirstPagePlan): Promise<void> {
  let measuredLayoutSignature = '';
  try {
    if (!lease.isCurrent()) return;
    measuredLayoutSignature = lease.liveLayoutSignature();
    const plan = prepare(measuredLayoutSignature);
    if (plan.kind === 'ordinary') {
      await plan.present();
      return;
    }
    if (!lease.isCurrent() || lease.resumeSuperseded(measuredLayoutSignature)) return;
    const stored = await plan.persist((): boolean =>
      lease.isCurrent() && measuredLayoutSignature === lease.liveLayoutSignature());
    if (!lease.isCurrent()) return;
    if (!plan.matchesAnchor(stored)) throw new Error(INITIAL_ANCHOR_MISMATCH);
    if (measuredLayoutSignature !== lease.liveLayoutSignature()) {
      plan.admitSavedProgress(stored);
      lease.resumeSuperseded(measuredLayoutSignature);
      return;
    }
    plan.present(stored);
  } catch (error) {
    // Preserve the exact-anchor failure even if the old measurement is also obsolete.
    if ((error as Error).message !== INITIAL_ANCHOR_MISMATCH && lease.resumeSuperseded(measuredLayoutSignature)) return;
    if (lease.isCurrent() || lease.hasCurrentControlCandidate()) lease.fail(error as Error);
  }
}

export interface ReaderMeasuredProgressGateway {
  hasPendingSourceSwitch(): boolean;
  persistPresentedProgress(bookId: string, title: string | undefined, anchor: LocalReadingAnchor,
    layout: CoreReadingLayout, isAdmitted: () => boolean): Promise<ReadingSessionCommittedProgress>;
  persistCanonicalProgress(bookId: string, title: string | undefined, anchor: LocalReadingAnchor,
    layout: CoreReadingLayout, isAdmitted: () => boolean): Promise<ReadingSessionCommittedProgress>;
}

export async function persistReaderMeasuredProgress(currentGateway: () => ReaderMeasuredProgressGateway,
  bookId: string, title: string | undefined, anchor: LocalReadingAnchor, layout: CoreReadingLayout,
  isAdmitted: () => boolean): Promise<ReadingSessionCommittedProgress> {
  const gateway = currentGateway();
  if (!gateway.hasPendingSourceSwitch()) {
    // Control and prepared presentation share the durable CAS owner with continuous reading and TTS.
    // Calling from runSerial would block the same owner it must drain.
    return gateway.persistPresentedProgress(bookId, title, anchor, layout, isAdmitted);
  }
  // The source-switch owner retains the original canonical tuple until Core's exact first-write receipt.
  return gateway.persistCanonicalProgress(bookId, title, anchor, layout, isAdmitted);
}

export interface ReaderOrdinaryFirstPageReceipt {
  traceIfReaderCurrent: () => boolean;
  isPresentationCurrent: () => boolean;
  layoutIsCurrent: () => boolean;
  requestRemeasurement: () => void;
  ready: () => void;
  failed: (error: Error) => void;
}

/** The first page can present before this write. Content mutation can still
 * observe the original operation, and the Gateway retains durable recovery. */
export class ReaderOrdinaryFirstPagePersistence {
  private operation: Promise<void> | undefined = undefined;

  pending(): Promise<void> | undefined {
    return this.operation;
  }

  release(): void {
    this.operation = undefined;
  }

  async persist(producer: ReaderProgressProducerHost, capture: () => ReaderProgressProducerIntent,
    presentedTurn: boolean, receipt: ReaderOrdinaryFirstPageReceipt): Promise<void> {
    const intent = capture();
    const operation = producer.persistPresented(intent, INITIAL_ANCHOR_MISMATCH).then((): void => {
      if (!receipt.traceIfReaderCurrent()) return;
      if (!receipt.isPresentationCurrent()) return;
      // The durable receipt cannot reinstall a page over a newer presentation or measurement.
      if (!receipt.isPresentationCurrent()) return;
      if (presentedTurn) return;
      if (!receipt.layoutIsCurrent()) {
        receipt.requestRemeasurement();
        return;
      }
      receipt.ready();
    });
    this.operation = operation;
    try {
      await operation;
    } catch (error) {
      receipt.failed(error as Error);
    }
  }
}
