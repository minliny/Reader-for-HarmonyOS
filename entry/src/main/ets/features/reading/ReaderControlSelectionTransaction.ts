/** Control selection UI effects are admitted only by a real committed page. */
export interface ReaderControlSelectionTicket {
  sourceId: string;
  bookId: string;
  lifecycleToken: number;
  selectionToken: number;
  controlOpenRevision: number;
  targetChapterIndex: number;
  /** Slider scrubbing keeps the panel open; list/search selections still close. */
  closeOnCommit?: boolean;
}

export interface ReaderControlSelectionOwner {
  sourceId: string;
  bookId: string;
  lifecycleToken: number;
  selectionToken: number;
  controlOpenRevision: number;
  mounted: boolean;
  exitRequested: boolean;
  controlVisible: boolean;
  controlClosing: boolean;
}

export interface ReaderControlSelectionCommit {
  phaseReady: boolean;
  materializedSelectionToken: number;
  visibleSelectionToken: number;
  visibleChapterIndex: number;
  visiblePageStartScalar: number;
  storedChapterIndex: number;
  storedChapterOffset: number;
}

/** Reading ownership is distinct from ownership of a newer control opening. */
export function readerControlSelectionOwnsReading(
  ticket: ReaderControlSelectionTicket,
  owner: ReaderControlSelectionOwner,
): boolean {
  return owner.mounted && !owner.exitRequested && ticket.sourceId === owner.sourceId &&
    ticket.bookId === owner.bookId && ticket.lifecycleToken === owner.lifecycleToken &&
    ticket.selectionToken === owner.selectionToken;
}

/**
 * This is not satisfied by chapter download or the openChapter promise. The
 * host calls it only after its serialized Core commit and actual page admit.
 */
export function readerControlSelectionMayClose(
  ticket: ReaderControlSelectionTicket,
  owner: ReaderControlSelectionOwner,
  commit: ReaderControlSelectionCommit,
): boolean {
  return ticket.closeOnCommit !== false && readerControlSelectionOwnsReading(ticket, owner) && owner.controlVisible &&
    !owner.controlClosing && ticket.controlOpenRevision === owner.controlOpenRevision &&
    commit.phaseReady && commit.materializedSelectionToken === ticket.selectionToken &&
    commit.visibleSelectionToken === ticket.selectionToken &&
    Number.isSafeInteger(commit.visiblePageStartScalar) && commit.visiblePageStartScalar >= 0 &&
    commit.visibleChapterIndex === ticket.targetChapterIndex &&
    commit.storedChapterIndex === commit.visibleChapterIndex &&
    commit.storedChapterOffset === commit.visiblePageStartScalar;
}

/** A recoverable failed selection must not invoke the reader's fatal-exit route. */
export function readerControlSelectionMayRecover(
  ticket: ReaderControlSelectionTicket,
  owner: ReaderControlSelectionOwner,
  hasCommittedOrigin: boolean,
  persistence: 'unverified' | 'origin-confirmed' = 'unverified',
): boolean {
  return persistence === 'origin-confirmed' && hasCommittedOrigin &&
    readerControlSelectionOwnsReading(ticket, owner);
}

export interface ReaderControlSelectionStoredProgress {
  bookId: string;
  chapterIndex: number;
  chapterOffset: number;
  chapterProgress: number;
  updatedAt: number;
  locationRevision?: string;
}

export interface ReaderControlSelectionDisplayAnchor {
  chapterIndex: number;
  pageStartScalar: number;
  visibleScalar: number;
  scalarCount: number;
  continuous: boolean;
}

export interface ReaderControlSelectionReconciliation {
  kind: 'obsolete' | 'verified' | 'unavailable';
  progress?: ReaderControlSelectionStoredProgress;
  errorCode: string;
}

export interface ReaderControlSelectionReconciliationDependencies {
  isCurrent: () => boolean;
  runSerial: (operation: () => Promise<void>) => Promise<void>;
  readProgress: () => Promise<ReaderControlSelectionStoredProgress | undefined>;
  observationTimeoutMs?: number;
}

/** Bound UI observation, never cancel/release the actual serialized write lane. */
export async function observeReaderProgressOperation(operation: Promise<void>,
  timeoutMs: number = 35000): Promise<'completed' | 'unknown'> {
  let timer: number = -1;
  try {
    return await Promise.race([
      operation.then((): 'completed' => 'completed'),
      new Promise<'unknown'>((resolve): void => {
        timer = setTimeout((): void => resolve('unknown'), Math.max(1, timeoutMs));
      }),
    ]);
  } finally {
    if (timer >= 0) clearTimeout(timer);
  }
}

/**
 * An error/timeout from a stateful write is not evidence that it never committed.
 * Read the actual stored row after the same serialized lane, then recheck the
 * selection owner. This production orchestration is runnable with a fake lane.
 */
export async function reconcileReaderControlSelectionProgress(
  dependencies: ReaderControlSelectionReconciliationDependencies,
): Promise<ReaderControlSelectionReconciliation> {
  let result: ReaderControlSelectionReconciliation = { kind: 'obsolete', errorCode: '' };
  let observing = true;
  try {
    const operation = dependencies.runSerial(async (): Promise<void> => {
      if (!observing || !dependencies.isCurrent()) return;
      const progress = await dependencies.readProgress();
      if (!observing || !dependencies.isCurrent()) return;
      if (progress === undefined || !Number.isSafeInteger(progress.chapterIndex) ||
        progress.chapterIndex < 0 || !Number.isSafeInteger(progress.chapterOffset) ||
        progress.chapterOffset < 0) {
        result = { kind: 'unavailable', errorCode: 'READING_PROGRESS_RECONCILIATION_UNAVAILABLE' };
      } else {
        result = { kind: 'verified', progress: progress, errorCode: '' };
      }
    });
    if (await observeReaderProgressOperation(operation, dependencies.observationTimeoutMs) === 'unknown') {
      result = { kind: 'unavailable', errorCode: 'READING_PROGRESS_RECONCILIATION_UNKNOWN' };
    }
  } catch (error) {
    if (dependencies.isCurrent()) {
      result = { kind: 'unavailable', errorCode: error instanceof Error ?
        error.message : 'READING_PROGRESS_RECONCILIATION_FAILED' };
    }
  }
  observing = false;
  if (!dependencies.isCurrent()) return { kind: 'obsolete', errorCode: '' };
  return result;
}

function displayCanShowStored(anchor: ReaderControlSelectionDisplayAnchor | undefined,
  progress: ReaderControlSelectionStoredProgress): boolean {
  if (anchor === undefined || anchor.chapterIndex !== progress.chapterIndex) return false;
  if (anchor.continuous) return progress.chapterOffset < anchor.scalarCount;
  return progress.chapterOffset === anchor.pageStartScalar;
}

/** Never call the old page authoritative unless the serialized Core read agrees. */
export function readerControlSelectionRecoveryAction(
  result: ReaderControlSelectionReconciliation,
  origin: ReaderControlSelectionDisplayAnchor | undefined,
  target: ReaderControlSelectionDisplayAnchor | undefined,
): 'obsolete' | 'blocked' | 'origin' | 'target' {
  if (result.kind === 'obsolete') return 'obsolete';
  if (result.kind !== 'verified' || result.progress === undefined) return 'blocked';
  if (target !== undefined && target.chapterIndex === result.progress.chapterIndex &&
    target.pageStartScalar === result.progress.chapterOffset) return 'target';
  if (displayCanShowStored(origin, result.progress)) return 'origin';
  return 'blocked';
}
