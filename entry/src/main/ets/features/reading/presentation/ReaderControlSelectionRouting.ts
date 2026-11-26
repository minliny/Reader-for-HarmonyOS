import {
  readerControlSelectionOwnsReading, type ReaderControlSelectionOwner, type ReaderControlSelectionTicket,
} from '../application/ReaderControlSelectionTransaction.ts';
import { wholeBookAnchorForPercent } from '../application/LocalReadingWholeBookProgress.ts';
import type { LocalReadingContentMetrics } from '../application/LocalReadingFlowGateway';
import type { ReaderDirectoryTargetProof } from '../application/ReaderDirectoryTargetProof';
import type { ReadingContentSearchResult } from '../application/ReadingSessionFlowGateway';
import {
  createRequestedRemoteReadingPositionContext, type RemoteReadingPositionContext, type RemoteReadingPositionScope,
} from '../application/RemoteReadingPositionMigration.ts';
import { readerDirectoryProgressTarget } from './ReaderDirectoryProjection.ts';

export interface ReaderControlBookmarkSelection {
  sourceId: string;
  bookId: string;
  local: boolean;
  chapterIndex: number;
  chapterOffset: number;
  positionScope?: RemoteReadingPositionScope;
  directoryTargetProof?: ReaderDirectoryTargetProof;
}

/** A nonzero remote bookmark/search offset needs its own original position proof. */
export function readerControlBookmarkPosition(input: ReaderControlBookmarkSelection): RemoteReadingPositionContext | undefined {
  if (!input.local && input.chapterOffset > 0 && input.positionScope === undefined)
    throw new Error('READING_POSITION_SCOPE_UNAVAILABLE');
  const context = createRequestedRemoteReadingPositionContext(input.sourceId, input.bookId,
    input.chapterIndex, input.chapterOffset, input.positionScope);
  const proof = input.directoryTargetProof;
  if (proof === undefined) return context;
  if (proof.sourceId !== input.sourceId || proof.bookId !== input.bookId) throw new Error('DIRECTORY_SCOPE_CHANGED');
  if (context === undefined) return { anchors: [], directoryTargetProof: proof };
  context.directoryTargetProof = proof;
  return context;
}

export interface ReaderControlDeferredCatalogSelection {
  isCurrent(): boolean;
  dispatch(): void;
}

export type ReaderControlCatalogTarget =
  { kind: 'head'; chapterIndex: number } |
  { kind: 'exact'; chapterIndex: number; chapterOffset: number } |
  { kind: 'approximate'; position: number; chapterProgress: number };

type ReaderControlCatalogAction = 'chapter step' | 'seek' | 'selection';

export interface ReaderControlCatalogRoutingHost {
  canDispatch(): boolean;
  isCatalogPending(): boolean;
  captureControlOwner(): () => boolean;
  hydrate(): Promise<void>;
  findAdjacent(delta: number): number | undefined;
  metrics(): LocalReadingContentMetrics | undefined;
  catalogLength(): number;
  dispatch(target: ReaderControlCatalogTarget): void;
  warn(action: ReaderControlCatalogAction, error: Error): void;
}

/** Shared latest-intent ordering for the three ways to wait for the entry catalog. */
export class ReaderControlCatalogRouting {
  private revision: number = 0;
  private readonly host: ReaderControlCatalogRoutingHost;

  constructor(host: ReaderControlCatalogRoutingHost) { this.host = host; }

  invalidate(): void { this.revision += 1; }

  step(delta: number): void {
    if (!this.host.canDispatch() || (delta !== -1 && delta !== 1)) return;
    const revision = ++this.revision;
    const target = this.host.findAdjacent(delta);
    if (target !== undefined) this.host.dispatch({ kind: 'head', chapterIndex: target });
    else if (this.host.isCatalogPending())
      this.waitControl(revision, 'chapter step', (): void => this.step(delta));
  }

  seek(percent: number): void {
    if (!this.host.canDispatch() || !Number.isFinite(percent)) return;
    const revision = ++this.revision;
    if (this.host.isCatalogPending()) {
      this.waitControl(revision, 'seek', (): void => this.seek(percent));
      return;
    }
    const metrics = this.host.metrics();
    if (metrics !== undefined) {
      const anchor = wholeBookAnchorForPercent(metrics, percent);
      if (anchor !== undefined) this.host.dispatch({ kind: 'exact', chapterIndex: anchor.chapterIndex,
        chapterOffset: anchor.chapterOffset });
      return;
    }
    const target = readerDirectoryProgressTarget(this.host.catalogLength(), percent);
    if (target !== undefined) this.host.dispatch({ kind: 'approximate', position: target.position,
      chapterProgress: target.chapterProgress });
  }

  deferSelection(capture: () => ReaderControlDeferredCatalogSelection): void {
    const revision = ++this.revision;
    this.waitForCatalog(revision, 'selection', capture());
  }

  private waitControl(revision: number, action: ReaderControlCatalogAction, dispatch: () => void): void {
    const owner = this.host.captureControlOwner();
    this.waitForCatalog(revision, action, {
      isCurrent: (): boolean => !this.host.isCatalogPending() && owner(), dispatch,
    });
  }

  private waitForCatalog(revision: number, action: ReaderControlCatalogAction,
    intent: ReaderControlDeferredCatalogSelection): void {
    void this.host.hydrate().then((): void => {
      if (revision === this.revision && intent.isCurrent()) intent.dispatch();
    }).catch((error: Error): void => this.host.warn(action, error));
  }
}

export interface ReaderQuickSearchSelectionFacts {
  scope: number;
  ordinal: number;
  form: 'quick';
  epoch: number;
  matchingChapter?: boolean;
  containsTarget?: boolean;
}

export interface ReaderDirectorySelectionFacts {
  fromChapterIndex: number;
  chapterIndex: number;
  selectionToken: number;
  openRevision: number;
  epoch: number;
  matchingChapter?: boolean;
  chapterStart?: boolean;
}

export interface ReaderControlQuickSearchSelection {
  readingId: string;
  target: ReadingContentSearchResult;
  scope: number;
  ordinal: number;
  epoch: number;
}

export interface ReaderControlDirectorySelection {
  readingId: string;
  chapterIndex: number;
  fromChapterIndex: number;
  readEpoch(): number;
}

interface ReaderQuickSearchObservation {
  ticket: ReaderControlSelectionTicket;
  readingId: string;
  scope: number;
  ordinal: number;
  epoch: number;
  targetOffset: number;
}

interface ReaderDirectoryObservation {
  ticket: ReaderControlSelectionTicket;
  readingId: string;
  facts: ReaderDirectorySelectionFacts;
}

export interface ReaderControlObservedCommit {
  phaseReady: boolean;
  materializedSelectionToken: number;
  visibleSelectionToken: number;
  visibleChapterIndex: number | undefined;
  storedChapterIndex: number;
  storedChapterOffset: number;
  pageStartScalar: number;
  pageEndScalar: number;
}

export interface ReaderControlSelectionObservationHost {
  selectionToken(): number;
  ticket(): ReaderControlSelectionTicket | undefined;
  owner(): ReaderControlSelectionOwner;
  readingIdentity(): string;
  publishQuick(stage: 'selection-admitted' | 'selection-committed', facts: ReaderQuickSearchSelectionFacts): void;
  publishDirectory(stage: 'selection-admitted' | 'selection-committed', facts: ReaderDirectorySelectionFacts): void;
}

/** A real dispatch ticket can report admission and at most one committed observation. */
export class ReaderControlSelectionObservations {
  private quick: ReaderQuickSearchObservation | undefined = undefined;
  private directory: ReaderDirectoryObservation | undefined = undefined;
  private readonly host: ReaderControlSelectionObservationHost;

  constructor(host: ReaderControlSelectionObservationHost) { this.host = host; }

  reset(): void { this.quick = undefined; this.directory = undefined; }

  observeQuick(input: ReaderControlQuickSearchSelection, dispatch: () => void): void {
    const previousToken = this.host.selectionToken();
    dispatch();
    const ticket = this.host.ticket();
    if (input.readingId.length === 0 || this.host.readingIdentity() !== input.readingId ||
      ticket === undefined || ticket.selectionToken === previousToken || ticket.targetChapterIndex !== input.target.chapterIndex ||
      !readerControlSelectionOwnsReading(ticket, this.host.owner())) return;
    this.quick = { ticket, readingId: input.readingId, scope: input.scope, ordinal: input.ordinal,
      epoch: input.epoch, targetOffset: input.target.chapterOffset };
    this.host.publishQuick('selection-admitted', { scope: input.scope, ordinal: input.ordinal, form: 'quick', epoch: input.epoch });
  }

  observeDirectory(input: ReaderControlDirectorySelection, dispatch: () => void): void {
    const previousToken = this.host.selectionToken();
    dispatch();
    const ticket = this.host.ticket();
    if (input.readingId.length === 0 || this.host.readingIdentity() !== input.readingId ||
      input.fromChapterIndex < 0 || input.fromChapterIndex === input.chapterIndex || ticket === undefined ||
      ticket.selectionToken <= previousToken || ticket.targetChapterIndex !== input.chapterIndex ||
      !readerControlSelectionOwnsReading(ticket, this.host.owner())) return;
    const facts: ReaderDirectorySelectionFacts = { fromChapterIndex: input.fromChapterIndex,
      chapterIndex: input.chapterIndex, selectionToken: ticket.selectionToken, openRevision: ticket.controlOpenRevision,
      epoch: input.readEpoch() };
    this.directory = { ticket, readingId: input.readingId, facts };
    this.host.publishDirectory('selection-admitted', facts);
  }

  complete(ticket: ReaderControlSelectionTicket, owner: ReaderControlSelectionOwner,
    readCommit: () => ReaderControlObservedCommit): void {
    const quick = this.quick;
    if (quick?.ticket === ticket) {
      this.quick = undefined;
      if (readerControlSelectionOwnsReading(ticket, owner) && this.host.readingIdentity() === quick.readingId) {
        const commit = readCommit();
        const matchingChapter = this.matchesChapter(ticket, commit);
        this.host.publishQuick('selection-committed', { scope: quick.scope, ordinal: quick.ordinal, form: 'quick',
          epoch: quick.epoch, matchingChapter, containsTarget: matchingChapter &&
            commit.storedChapterOffset === commit.pageStartScalar && commit.pageStartScalar <= quick.targetOffset &&
            quick.targetOffset < commit.pageEndScalar });
      }
    }
    const directory = this.directory;
    if (directory?.ticket === ticket) {
      this.directory = undefined;
      if (readerControlSelectionOwnsReading(ticket, owner) && this.host.readingIdentity() === directory.readingId) {
        const commit = readCommit();
        const matchingChapter = this.matchesChapter(ticket, commit);
        const facts = directory.facts;
        this.host.publishDirectory('selection-committed', { fromChapterIndex: facts.fromChapterIndex,
          chapterIndex: facts.chapterIndex, selectionToken: facts.selectionToken, openRevision: facts.openRevision,
          epoch: facts.epoch, matchingChapter,
          chapterStart: matchingChapter && commit.pageStartScalar === 0 && commit.storedChapterOffset === 0 });
      }
    }
  }

  private matchesChapter(ticket: ReaderControlSelectionTicket, commit: ReaderControlObservedCommit): boolean {
    return commit.phaseReady && commit.materializedSelectionToken === ticket.selectionToken &&
      commit.visibleSelectionToken === ticket.selectionToken && commit.visibleChapterIndex === ticket.targetChapterIndex &&
      commit.storedChapterIndex === ticket.targetChapterIndex;
  }
}
