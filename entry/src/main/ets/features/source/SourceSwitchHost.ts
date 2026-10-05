import { ReaderCoreRequestError } from '@reader/core-harmony';
import { ReaderRuntimeOwner } from '../../app/ReaderRuntimeOwner';
import { ReaderCoreGateway, type ShelfBook } from '../../app/ReaderCoreGateway';
import { ReaderWriteEvidence } from '../../app/ReaderWriteEvidence';
import { MangaAdmissionGateway } from '../manga/MangaAdmissionGateway';
import { errorMessageOf } from '../../app/ErrorMessage';
import { ReadingSessionFlowGateway } from '../reading/ReadingSessionFlowGateway';
import { RemoteReadingFlowGateway, type RemoteReadingBookSeed, type RemoteReadingProgressState,
  type RemoteReadingSession } from '../reading/RemoteReadingFlowGateway';
import { remoteReadingFailureKindOf } from '../reading/RemoteContentAdmission';
import type { RemoteReadingIdentity } from '../reading/RemoteReadingContract';
import type { BookAcquisitionChange } from '../../app/BookAcquisitionCoordinator';
import type { SourceSwitchPanelState } from './SourceSwitchPresentationState';
import { buildSourceSwitchCommitParams, sourceSwitchCandidateKey, SourceSwitchGateway,
  type PendingSourceSwitch, type SourceSwitchCandidate, type SourceSwitchCommitOutcome,
  type SourceSwitchProbeQuery } from './SourceSwitchGateway';
import type { SourceSwitchTransactionProjection } from './SourceSwitchGateway';
import { SourceSwitchIntentStore, SourceSwitchIntentRecoveryError, type SourceSwitchIntent } from './SourceSwitchIntentStore';

export interface SourceSwitchAnchor { chapterIndex: number; chapterTitle: string; }
export interface SourceSwitchPendingTransaction extends PendingSourceSwitch { targetChapterIndex: number; }
export interface SourceSwitchContext {
  query: SourceSwitchProbeQuery;
  inBookshelf: boolean;
  toc: SourceSwitchAnchor[];
  shelfBook?: ShelfBook;
  knownCandidates: SourceSwitchCandidate[];
  /** Current search publication, read only while the admitted lease is current. */
  readKnownCandidates?: () => SourceSwitchCandidate[];
  searchedSourceIds: string[];
}
export interface SourceSwitchWriteFact {
  generation: number;
  action: 'commit' | 'rollback';
  confirmation: 'undispatched' | 'confirmed' | 'unknown';
  message?: string;
  transactionId?: string;
  /** A matching pending journal is actionable, but is not a lost-ACK receipt. */
  observedPending: PendingSourceSwitch[];
  intentPending?: boolean;
  readbackFailed?: boolean;
}
export interface SourceSwitchSnapshot {
  scopeId: number;
  visible: boolean;
  state: SourceSwitchPanelState;
  failureMessage: string;
  pending?: SourceSwitchPendingTransaction;
  rollbackInFlight: boolean;
  write?: SourceSwitchWriteFact;
}
export type SourceSwitchEffect =
  | { kind: 'previewReady'; seed: RemoteReadingBookSeed; session: RemoteReadingSession; candidate: SourceSwitchCandidate }
  | { kind: 'targetReady'; book: ShelfBook; session: RemoteReadingSession; chapterIndex: number }
  | { kind: 'restoredForNextChoice'; book: ShelfBook }
  | { kind: 'rollbackReady'; book: ShelfBook }
  | { kind: 'canonicalReady'; book: ShelfBook }
  | { kind: 'acquisitionFailed'; identity: RemoteReadingIdentity; candidate: SourceSwitchCandidate; message: string }
  | { kind: 'closed' };
export interface SourceSwitchLease {
  /** Page navigation/lifecycle identity; the Host supplies its current book. */
  isCurrent: (identity: RemoteReadingIdentity) => boolean;
  changed: (snapshot: SourceSwitchSnapshot) => void;
  effect: (effect: SourceSwitchEffect) => void;
}

/** Owns the existing source-switch journey, never the reader component tree,
 * navigation, UI geometry, chapter matcher, or Core's before-image journal.
 * UI retirement stops delivery/acquisition. Accepted durable writes retain
 * their ACK/unknown fact; a matching shelf or pending list is never an ACK. */
export class SourceSwitchHost {
  private static shared: SourceSwitchHost | undefined;
  private readonly runtime: ReaderRuntimeOwner;
  private readonly gateway: SourceSwitchGateway;
  private readonly shelf: ReaderCoreGateway;
  private readonly intents: SourceSwitchIntentStore;
  private fixedIntent: SourceSwitchIntent | undefined;
  private confirmedIntent: SourceSwitchIntent | undefined;
  private recoveredTransaction: SourceSwitchTransactionProjection | undefined;
  private targetSession: RemoteReadingSession | undefined;
  private context: SourceSwitchContext | undefined;
  private lease: SourceSwitchLease | undefined;
  private generation: number = 0;
  private unsubscribe: (() => void) | undefined;
  private failedCandidate: SourceSwitchCandidate | undefined;
  private failedIdentity: RemoteReadingIdentity | undefined;
  private reconciliationGeneration: number = 0;
  private scopeGeneration: number = 0;
  private snapshot: SourceSwitchSnapshot = { scopeId: 0, visible: false, state: { kind: 'discovering' },
    failureMessage: '', rollbackInFlight: false };

  constructor(runtime: ReaderRuntimeOwner = ReaderRuntimeOwner.current()) {
    this.runtime = runtime;
    this.gateway = new SourceSwitchGateway(runtime);
    this.shelf = new ReaderCoreGateway(runtime);
    this.intents = new SourceSwitchIntentStore(runtime, this.gateway);
  }

  /** Typed manga preparation shares the feature's captured Runtime/gateway.
   * Manga's own progress transaction remains with its existing Core adapter. */
  mangaPreparationGateway(): SourceSwitchGateway {
    if (!ReaderRuntimeOwner.isCurrent(this.runtime)) throw new Error('MANGA_SESSION_CANCELLED');
    return this.gateway;
  }

  async readMangaShelf(sourceId: string, bookId: string, isCurrent: () => boolean): Promise<ShelfBook | undefined> {
    const current = (): boolean => ReaderRuntimeOwner.isCurrent(this.runtime) && isCurrent();
    if (!current()) throw new Error('MANGA_SESSION_CANCELLED');
    const book = await this.shelf.loadShelfBook(sourceId, bookId);
    if (!current()) throw new Error('MANGA_SESSION_CANCELLED');
    return book;
  }

  async prepareMangaPreview(candidate: SourceSwitchCandidate, isCurrent: () => boolean): Promise<RemoteReadingSession> {
    const current = (): boolean => ReaderRuntimeOwner.isCurrent(this.runtime) && isCurrent();
    if (!current() || candidate.category !== 'comic') throw new Error('MANGA_SESSION_CANCELLED');
    const seed: RemoteReadingBookSeed = { ...this.seed(candidate), contentKind: 'manga' };
    const session = await this.runtime.bookAcquisitions().acquireBook(seed, { isCurrent: current, canDispatch: current });
    if (!current()) throw new Error('MANGA_SESSION_CANCELLED');
    if (session.contentKind !== 'manga' || !this.sameIdentity(session.identity, seed))
      throw new Error('漫画换源返回了其他书籍的阅读会话');
    await new MangaAdmissionGateway(this.runtime).verify(session, current);
    if (!current()) throw new Error('MANGA_SESSION_CANCELLED');
    return session;
  }

  /** One finite feature owner survives Index remounts for this exact Runtime.
   * A retired Runtime cannot evict a successor or borrow its pending work. */
  static forRuntime(runtime: ReaderRuntimeOwner = ReaderRuntimeOwner.current()): SourceSwitchHost {
    if (!ReaderRuntimeOwner.isCurrent(runtime)) throw new SourceSwitchIntentRecoveryError('pending', '换源服务已退役，请使用当前服务核对');
    if (SourceSwitchHost.shared?.owns(runtime) !== true) {
      SourceSwitchHost.shared?.retire();
      SourceSwitchHost.shared = new SourceSwitchHost(runtime);
    }
    return SourceSwitchHost.shared;
  }

  current(): SourceSwitchSnapshot { return this.snapshot; }
  owns(runtime: ReaderRuntimeOwner): boolean { return this.runtime === runtime; }

  /** Rebind only the existing pending or failed acquisition journey after
   * Index's navigation seam. This does not open UI, execute IO, or mount trees. */
  bindReader(context: SourceSwitchContext, lease: SourceSwitchLease): boolean {
    const pending = this.snapshot.pending;
    const ownsPending = pending !== undefined &&
      ((pending.targetSourceId === context.query.sourceId && pending.targetBookId === context.query.bookId) ||
        (pending.fromSourceId === context.query.sourceId && pending.fromBookId === context.query.bookId));
    const ownsFailure = this.failedCandidate !== undefined && this.failedIdentity !== undefined &&
      this.snapshot.failureMessage.length > 0 && this.sameIdentity(this.failedIdentity, context.query);
    if ((!ownsPending && !ownsFailure) || this.snapshot.visible || this.snapshot.state.kind === 'switching' ||
      !ReaderRuntimeOwner.isCurrent(this.runtime)) return false;
    this.retire(); this.context = context; this.lease = lease;
    if (!this.currentLease()) { this.retire(); return false; }
    this.snapshot = { ...this.snapshot, scopeId: ++this.scopeGeneration };
    this.publish(); return true;
  }

  open(context: SourceSwitchContext, lease: SourceSwitchLease): boolean {
    const unknown = this.snapshot.write?.confirmation === 'unknown' || this.snapshot.write?.intentPending === true;
    if (context.query.sourceId === 'local' || this.snapshot.visible || this.snapshot.state.kind === 'switching' ||
      this.snapshot.rollbackInFlight || (unknown && (this.context === undefined ||
        !this.sameIdentity(context.query, this.context.query)))) return false;
    this.retire();
    this.context = context;
    this.lease = lease;
    if (!this.currentLease()) { this.retire(); return false; }
    this.snapshot = { ...this.snapshot, scopeId: ++this.scopeGeneration, visible: true,
      state: unknown ? this.snapshot.state : { kind: 'discovering' }, failureMessage: '' };
    this.publish();
    void this.openJourney(unknown);
    return true;
  }

  retry(scopeId: number): void {
    if (!this.currentScope(scopeId) || !this.snapshot.visible) return;
    if (this.snapshot.write?.action === 'rollback' && this.snapshot.write.confirmation === 'unknown') {
      void this.reconcileRollback(true); return;
    }
    if (this.snapshot.write?.confirmation === 'unknown' || this.snapshot.write?.intentPending || this.snapshot.write?.readbackFailed) {
      void this.recoverIntent(true); return;
    }
    if (this.snapshot.state.kind === 'discoveryError' || this.snapshot.state.kind === 'empty') void this.discover(true);
  }

  stop(scopeId: number): void {
    if (!this.currentScope(scopeId) || !this.snapshot.visible || this.busyOrUnknown()) return;
    this.generation += 1; this.stopDiscovery();
    const state = this.snapshot.state;
    this.snapshot = { ...this.snapshot, state: state.kind === 'candidates' ?
      { ...state, refreshing: false, stopped: true } : { kind: 'empty', stopped: true } };
    this.publish();
  }

  refresh(scopeId: number): void {
    if (this.currentScope(scopeId) && this.snapshot.visible && this.snapshot.state.kind === 'candidates' &&
      this.snapshot.state.refreshing !== true) void this.discover(true);
  }

  /** Close/Back consumes the overlay even when durable safety forbids closing. */
  consumeBack(scopeId: number): boolean {
    if (!this.currentScope(scopeId) || !this.snapshot.visible) return false;
    this.close(scopeId);
    return true;
  }

  close(scopeId: number): boolean {
    if (!this.snapshot.visible || !this.currentScope(scopeId) || this.busyOrUnknown() ||
      (this.snapshot.state.kind === 'failure' && this.snapshot.state.transactionId !== undefined)) return false;
    this.generation += 1;
    this.stopDiscovery();
    this.snapshot = { ...this.snapshot, visible: false, state: { kind: 'discovering' } };
    this.publish();
    this.deliver({ kind: 'closed' });
    return true;
  }

  /** Page teardown cannot cancel or erase a command already sent to Core. */
  retire(): void {
    this.generation += 1;
    this.reconciliationGeneration += 1;
    this.stopDiscovery();
    this.snapshot = { ...this.snapshot, visible: false };
    this.lease = undefined;
  }

  blocksExit(identity: RemoteReadingIdentity): boolean {
    return this.busyOrUnknown() || this.currentTransactionId(identity) !== undefined;
  }

  currentTransactionId(identity: RemoteReadingIdentity): string | undefined {
    const pending = this.snapshot.pending;
    return pending?.targetSourceId === identity.sourceId && pending.targetBookId === identity.bookId
      ? pending.transactionId : undefined;
  }

  dismissFailure(scopeId: number): void {
    if (!this.currentScope(scopeId)) return;
    this.failedCandidate = undefined; this.failedIdentity = undefined;
    this.snapshot = { ...this.snapshot, failureMessage: '' }; this.publish();
  }

  retryFailed(scopeId: number): void {
    const candidate = this.failedCandidate, identity = this.failedIdentity;
    if (!this.currentScope(scopeId) || this.snapshot.visible || candidate === undefined || identity === undefined ||
      !this.sameIdentity(identity, this.identity()) || this.busyOrUnknown()) return;
    this.snapshot = { ...this.snapshot, visible: true, state: { kind: 'candidates', candidates: [candidate] } };
    this.publish(); void this.pick(candidate, scopeId);
  }

  async pick(candidate: SourceSwitchCandidate, scopeId: number): Promise<void> {
    const context = this.context;
    if (context === undefined || !this.currentScope(scopeId) || !this.snapshot.visible ||
      this.snapshot.state.kind !== 'candidates' || this.busyOrUnknown() ||
      sourceSwitchCandidateKey(candidate.sourceId, candidate.bookUrl) ===
        sourceSwitchCandidateKey(context.query.sourceId, context.query.bookId)) return;
    const canonical = this.snapshot.state.candidates.find((value): boolean =>
      sourceSwitchCandidateKey(value.sourceId, value.bookUrl) === sourceSwitchCandidateKey(candidate.sourceId, candidate.bookUrl) &&
      value.sourceVersion === candidate.sourceVersion);
    if (canonical === undefined) return;
    candidate = canonical;
    const generation = ++this.generation;
    this.stopDiscovery();
    this.failedCandidate = undefined; this.failedIdentity = undefined;
    this.snapshot = { ...this.snapshot, failureMessage: '', state: { kind: 'switching', targetSourceId: candidate.sourceId } };
    this.publish();
    const admitted = (): boolean => this.admitted(generation);
    if (!context.inBookshelf) {
      try {
        const seed = this.seed(candidate);
        const session = await this.runtime.bookAcquisitions().acquireBook(seed, { isCurrent: admitted });
        if (!admitted()) return;
        if (!this.sameIdentity(session.identity, seed)) throw new Error('换源返回了其他书籍的阅读会话');
        this.hide(); this.deliver({ kind: 'previewReady', seed, session, candidate });
      } catch (error) { if (admitted()) this.acquisitionFailed(candidate, errorMessageOf(error)); }
      finally { this.settleRetired(generation); }
      return;
    }
    const evidence = new ReaderWriteEvidence();
    try {
      const restored = await this.prepareNextChoice(generation);
      if (!admitted()) return;
      const toc = await this.gateway.fetchTargetToc(candidate.sourceId, candidate.bookUrl, admitted, candidate);
      if (!admitted()) return;
      this.targetSession = toc.readingSession;
      const identity = this.identity();
      const progressLane = new ReadingSessionFlowGateway(identity.sourceId, identity.bookId, { kind: 'remote' }, this.runtime);
      let outcome: SourceSwitchCommitOutcome | undefined;
      await progressLane.runProgressCommitSerial(async (): Promise<void> => {
        if (!admitted()) throw new Error('source switch aborted');
        const anchor = await this.loadAnchor(generation, restored);
        if (!admitted()) throw new Error('source switch aborted');
        this.fixedIntent = await this.intents.accept(buildSourceSwitchCommitParams(identity, candidate, toc,
          anchor.chapterTitle, anchor.chapterIndex, Math.floor(Date.now() / 1000)), admitted);
        if (!admitted()) throw new Error('source switch aborted');
        outcome = await this.gateway.commitSwitch(this.fixedIntent.params, admitted, evidence);
      });
      if (outcome === undefined) throw new Error('source switch did not produce an outcome');
      // Settle the accepted command independently of its retired UI lease.
      this.recordWrite(generation, 'commit', evidence, outcome.status === 'failed' ? outcome.error : undefined,
        outcome.transactionId);
      if (outcome.status === 'success') {
        this.snapshot = { ...this.snapshot, pending: { fromSourceId: identity.sourceId, fromBookId: identity.bookId,
          targetSourceId: outcome.book.sourceId, targetBookId: outcome.book.bookId,
          targetChapterIndex: outcome.matchedChapter.order, transactionId: outcome.transactionId } };
        // ACK establishes Core acceptance. Query provides the actual retained
        // lineage/phase needed to persist and retire this Host intent safely.
        await this.recoverIntent(false, false);
        if (this.fixedIntent !== undefined) return;
        if (!admitted()) return;
        this.hide(); this.deliver({ kind: 'targetReady', book: outcome.book, session: toc.readingSession,
          chapterIndex: outcome.matchedChapter.order });
      } else if (evidence.confirmation() === 'unknown') {
        await this.recoverIntent(false);
      } else if (admitted()) {
        this.snapshot = { ...this.snapshot, write: { ...this.snapshot.write!, intentPending: this.fixedIntent !== undefined },
          state: { kind: 'failure', message: outcome.error, confirmation: evidence.confirmation(), reconcile: this.fixedIntent !== undefined,
          transactionId: outcome.transactionId } }; this.publish();
      }
    } catch (error) {
      if (evidence.confirmation() !== 'undispatched') {
        this.recordWrite(generation, 'commit', evidence, errorMessageOf(error));
        await this.recoverIntent(false);
      } else if (error instanceof SourceSwitchIntentRecoveryError) {
        this.snapshot = { ...this.snapshot, write: { generation, action: 'commit', confirmation: 'undispatched',
          observedPending: [], intentPending: true, message: error.message } };
        if (admitted()) { this.snapshot = { ...this.snapshot, state: { kind: 'failure', message: error.message } }; this.publish(); }
      } else if (this.snapshot.write?.generation === generation && this.snapshot.write.confirmation === 'unknown') {
        if (admitted()) { this.snapshot = { ...this.snapshot, state: { kind: 'failure', message: errorMessageOf(error),
          confirmation: 'unknown', reconcile: true, transactionId: this.snapshot.write.transactionId } }; this.publish(); }
        if (this.snapshot.write.action === 'rollback') await this.reconcileRollback(false);
        else await this.reconcileUnknown(generation);
      } else if (admitted()) this.acquisitionFailed(candidate, errorMessageOf(error));
    } finally { this.settleRetired(generation); }
  }

  /** Read-only recovery. Neither zero matches nor a matching identity proves
   * the terminal result of a command whose opaque transaction ACK was lost. */
  async reconcileUnknown(generation: number = this.snapshot.write?.generation ?? -1,
    candidate?: SourceSwitchCandidate): Promise<void> {
    const write = this.snapshot.write;
    if (write?.generation !== generation || write.confirmation !== 'unknown' || !this.currentLease()) return;
    const current = (): boolean => this.currentLease() && this.snapshot.write === write;
    let observed: PendingSourceSwitch[] = [], message = write.message ?? '换源结果尚未确认，请核对待处理记录';
    try {
      const records = await this.gateway.listPendingSwitches(current);
      if (!current()) return;
      const identity = this.identity();
      observed = records.filter((record): boolean => write.transactionId !== undefined
        ? record.transactionId === write.transactionId
        : record.fromSourceId === identity.sourceId && record.fromBookId === identity.bookId &&
          (candidate === undefined || (record.targetSourceId === candidate.sourceId && record.targetBookId === candidate.bookUrl)));
    } catch (error) { if (!current()) return; message = errorMessageOf(error); }
    if (!current()) return;
    this.snapshot = { ...this.snapshot, write: { ...write, observedPending: observed, message },
      state: { kind: 'failure', message: `换源结果尚未确认：${message}`, confirmation: 'unknown', reconcile: true,
        transactionId: write.transactionId ?? (observed.length === 1 ? observed[0].transactionId : undefined) } };
    this.publish();
  }

  /** Existing exact journal, selected by an explicit user recovery action. */
  async rollback(scopeId: number): Promise<void> {
    if (!this.currentScope(scopeId) || this.snapshot.rollbackInFlight || this.snapshot.state.kind !== 'failure' ||
      this.snapshot.state.transactionId === undefined) return;
    await this.rollbackTransaction(this.snapshot.state.transactionId);
  }

  async rollbackPending(): Promise<void> {
    const pending = this.snapshot.pending;
    if (pending === undefined || !this.currentLease() || this.snapshot.rollbackInFlight) return;
    await this.rollbackTransaction(pending.transactionId);
  }

  async inspectPending(isCurrent: () => boolean): Promise<PendingSourceSwitch[] | undefined> {
    const generation = ++this.reconciliationGeneration;
    const current = (): boolean => generation === this.reconciliationGeneration &&
      ReaderRuntimeOwner.isCurrent(this.runtime) && isCurrent();
    const records = await this.gateway.listPendingSwitches(current);
    return current() ? records : undefined;
  }

  async resolveTransaction(identity: RemoteReadingIdentity, isCurrent: () => boolean): Promise<string | undefined> {
    if (identity.sourceId === 'local' || !isCurrent() || !ReaderRuntimeOwner.isCurrent(this.runtime)) return undefined;
    const active = this.currentTransactionId(identity);
    if (active !== undefined) return active;
    const current = (): boolean => ReaderRuntimeOwner.isCurrent(this.runtime) && isCurrent();
    const records = await this.gateway.listPendingSwitches(current);
    if (!current()) return undefined;
    const matches = records.filter((record): boolean => record.targetSourceId === identity.sourceId && record.targetBookId === identity.bookId);
    if (matches.length > 1) throw new Error('当前书籍存在多个未完成的换源记录，请重试');
    if (matches.length === 0) return undefined;
    this.snapshot = { ...this.snapshot, pending: { ...matches[0], targetChapterIndex: -1 } };
    this.publish();
    return matches[0].transactionId;
  }

  /** Called only by the existing Core-confirmed first canonical anchor commit. */
  targetCommitted(identity: RemoteReadingIdentity, transactionId: string): SourceSwitchPendingTransaction | undefined {
    const pending = this.snapshot.pending;
    if (pending === undefined || pending.transactionId !== transactionId || this.currentTransactionId(identity) === undefined ||
      !ReaderRuntimeOwner.isCurrent(this.runtime)) return undefined;
    this.snapshot = { ...this.snapshot, pending: undefined, rollbackInFlight: false };
    this.publish();
    // The real canonical producer already acknowledged this exact ID. Keep
    // the full durable intent until a pure query verifies its terminal phase;
    // old UI retirement does not cancel accepted local cleanup IO.
    void this.finishReaderIntent(transactionId);
    return pending;
  }

  private async rollbackTransaction(transactionId: string): Promise<void> {
    const generation = ++this.generation, evidence = new ReaderWriteEvidence();
    const admitted = (): boolean => this.admitted(generation);
    this.stopDiscovery();
    this.snapshot = { ...this.snapshot, rollbackInFlight: true,
      state: { kind: 'switching', targetSourceId: '' } }; this.publish();
    try {
      const result = await this.gateway.rollbackSwitch(transactionId, admitted, evidence);
      this.recordWrite(generation, 'rollback', evidence, undefined, transactionId);
      if (this.snapshot.pending?.transactionId === transactionId) this.snapshot = { ...this.snapshot, pending: undefined };
      await this.clearTerminalIntent(transactionId, admitted);
      if (!admitted()) return;
      this.hide(); this.deliver({ kind: 'rollbackReady', book: result.restoredBook });
    } catch (error) {
      this.recordWrite(generation, 'rollback', evidence, errorMessageOf(error), transactionId);
      if (admitted()) {
        const confirmation = evidence.confirmation();
        this.snapshot = { ...this.snapshot, visible: true, write: { ...this.snapshot.write!,
          intentPending: this.fixedIntent !== undefined || this.confirmedIntent !== undefined,
          readbackFailed: true },
          state: { kind: 'failure', message: errorMessageOf(error), transactionId, confirmation, reconcile: true } }; this.publish();
      }
      if (evidence.confirmation() === 'unknown') await this.reconcileRollback(false);
    } finally {
      this.snapshot = { ...this.snapshot, rollbackInFlight: false }; this.publish();
    }
  }

  private async prepareNextChoice(generation: number): Promise<ShelfBook | undefined> {
    const current = (): boolean => this.admitted(generation);
    const identity = this.identity();
    let pending = this.snapshot.pending;
    if (pending?.targetSourceId !== identity.sourceId || pending.targetBookId !== identity.bookId) {
      const records = await this.gateway.listPendingSwitches(current);
      if (!current()) throw new Error('source switch aborted');
      const matches = records.filter((record): boolean => record.targetSourceId === identity.sourceId && record.targetBookId === identity.bookId);
      if (matches.length > 1) throw new Error('当前书籍存在多个未完成的换源记录，请重试');
      if (matches.length === 0) return undefined;
      pending = { ...matches[0], targetChapterIndex: -1 };
      this.snapshot = { ...this.snapshot, pending };
    }
    const transaction = pending, evidence = new ReaderWriteEvidence();
    let restored: ShelfBook;
    try {
      const result = await this.gateway.rollbackSwitch(transaction.transactionId, current, evidence);
      this.recordWrite(generation, 'rollback', evidence, undefined, transaction.transactionId);
      restored = result.restoredBook;
    } catch (error) {
      this.recordWrite(generation, 'rollback', evidence, errorMessageOf(error), transaction.transactionId);
      if (!current() || !(error instanceof ReaderCoreRequestError) ||
        error.event.error.details?.['reason'] !== 'already_finalized' ||
        error.event.error.details?.['transactionId'] !== transaction.transactionId) throw error as Error;
      const records = await this.gateway.listPendingSwitches(current);
      if (!current() || records.some((record): boolean => record.transactionId === transaction.transactionId)) throw error as Error;
      const canonical = await this.shelf.loadShelfBook(transaction.targetSourceId, transaction.targetBookId);
      if (!current() || canonical === undefined) throw error as Error;
      restored = canonical;
    }
    if (!current()) throw new Error('source switch aborted');
    await this.clearTerminalIntent(transaction.transactionId, current);
    if (!current()) throw new Error('source switch aborted');
    this.snapshot = { ...this.snapshot, pending: undefined };
    this.deliver({ kind: 'restoredForNextChoice', book: restored });
    const context = this.context;
    if (context === undefined) throw new Error('source switch aborted');
    const same = this.sameIdentity(identity, restored);
    this.context = { ...context, query: { ...context.query, sourceId: restored.sourceId,
      bookId: restored.bookId, bookName: restored.title, author: restored.author },
      shelfBook: restored, toc: same ? context.toc : [] };
    if (!current()) throw new Error('source switch aborted');
    return restored;
  }

  private async loadAnchor(generation: number, restored?: ShelfBook): Promise<SourceSwitchAnchor> {
    const context = this.context;
    if (context === undefined) throw new Error('source switch aborted');
    const current = (): boolean => this.admitted(generation), identity = this.identity();
    try {
      const progress = await new RemoteReadingFlowGateway(this.runtime).loadProgress(identity, current);
      if (!current()) throw new Error('source switch aborted');
      return this.resolveAnchor(progress, restored);
    } catch (error) {
      if (!current() || remoteReadingFailureKindOf(error) !== 'POSITION_CONTEXT_STALE') throw error as Error;
      const canonical = await this.shelf.loadShelfBook(identity.sourceId, identity.bookId);
      if (!current() || canonical?.sourceId !== identity.sourceId || canonical.bookId !== identity.bookId ||
        canonical.currentChapterIndex === undefined || !Number.isSafeInteger(canonical.currentChapterIndex) ||
        canonical.currentChapterIndex < 0) throw error as Error;
      return { chapterIndex: canonical.currentChapterIndex,
        chapterTitle: context.toc.find((entry): boolean => entry.chapterIndex === canonical.currentChapterIndex)?.chapterTitle ?? '' };
    }
  }

  private resolveAnchor(progress: RemoteReadingProgressState, restored?: ShelfBook): SourceSwitchAnchor {
    const context = this.context;
    if (context === undefined) throw new Error('source switch aborted');
    for (const book of [restored, context.shelfBook]) {
      if (book?.currentChapterTitle !== undefined && book.currentChapterIndex !== undefined &&
        (progress.kind === 'missing' || progress.progress.chapterIndex === book.currentChapterIndex) &&
        (book === restored || context.toc.length === 0)) {
        return { chapterIndex: book.currentChapterIndex, chapterTitle: book.currentChapterTitle };
      }
    }
    const index = progress.kind === 'restored' ? progress.progress.chapterIndex : context.toc[0]?.chapterIndex;
    const entry = context.toc.find((value): boolean => value.chapterIndex === index);
    if (entry !== undefined) return entry;
    if (progress.kind === 'restored' && Number.isSafeInteger(index) && index !== undefined && index >= 0) {
      return { chapterIndex: index, chapterTitle: '' };
    }
    throw new Error('当前目录不可用，且没有可核对的阅读位置，请先恢复目录');
  }

  private async discover(force: boolean): Promise<void> {
    const context = this.context;
    if (context === undefined || !this.currentLease()) return;
    const generation = ++this.generation, current = (): boolean => this.admitted(generation);
    this.stopDiscovery();
    const knownCandidates = (): SourceSwitchCandidate[] => context.readKnownCandidates?.() ?? context.knownCandidates;
    const initialKnown = knownCandidates();
    const previous = this.snapshot.state.kind === 'candidates' ? this.snapshot.state.candidates : [];
    if (!force && initialKnown.length > 0) this.snapshot = { ...this.snapshot,
      state: { kind: 'candidates', candidates: initialKnown, refreshing: false } };
    if (force && previous.length > 0) this.snapshot = { ...this.snapshot,
      state: { kind: 'candidates', candidates: previous, refreshing: true } };
    this.publish();
    let projecting = true, again = false, reset = false;
    const dirty = new Map<string, RemoteReadingIdentity>();
    const refreshProjection = (change: BookAcquisitionChange): void => {
      if (!current()) return;
      reset = reset || change.reset;
      for (const identity of change.identities) dirty.set(sourceSwitchCandidateKey(identity.sourceId, identity.bookId), identity);
      if (!reset && dirty.size === 0) return;
      if (projecting) { again = true; return; }
      if (this.snapshot.state.kind !== 'candidates' && this.snapshot.state.kind !== 'empty' &&
        this.snapshot.state.kind !== 'discovering') return;
      projecting = true; again = false;
      const batch: BookAcquisitionChange = { reset, identities: Array.from(dirty.values()) };
      reset = false; dirty.clear();
      void this.gateway.loadCachedCandidates(context.query, current, knownCandidates(), batch).then((candidates): void => {
        if (!current()) return;
        if (candidates.length > 0) this.snapshot = { ...this.snapshot, state: { kind: 'candidates', candidates,
          refreshing: this.snapshot.state.kind === 'candidates' && this.snapshot.state.refreshing === true } };
        else if (this.snapshot.state.kind !== 'candidates' || this.snapshot.state.refreshing !== true) {
          this.snapshot = { ...this.snapshot, state: { kind: 'empty' } };
        }
        this.publish();
      }).catch((): void => {
        if (!current()) return;
        reset = reset || batch.reset;
        for (const identity of batch.identities) dirty.set(sourceSwitchCandidateKey(identity.sourceId, identity.bookId), identity);
      }).finally((): void => { projecting = false; if (again) refreshProjection({ reset: false, identities: [] }); });
    };
    this.unsubscribe = this.runtime.bookAcquisitions().subscribe(refreshProjection);
    try {
      const cached = force ? [] : await this.gateway.loadCachedCandidates(context.query, current, knownCandidates());
      if (!current()) return;
      const outcome = cached.length > 0 ? { kind: 'sources' as const, candidates: cached }
        : await this.gateway.refreshCandidates(context.query, current, force ? [] : context.searchedSourceIds);
      if (!current()) return;
      this.snapshot = { ...this.snapshot, state: outcome.kind === 'noSources' || outcome.candidates.length === 0
        ? { kind: 'empty' } : { kind: 'candidates', candidates: outcome.candidates, refreshing: false } };
      this.publish();
    } catch (error) {
      if (!current()) return;
      const message = errorMessageOf(error);
      this.snapshot = { ...this.snapshot, state: force && previous.length > 0
        ? { kind: 'candidates', candidates: previous, refreshing: false, refreshError: message }
        : { kind: 'discoveryError', message } }; this.publish();
    } finally { projecting = false; if (again) refreshProjection({ reset: false, identities: [] }); }
  }

  private recordWrite(generation: number, action: 'commit' | 'rollback', evidence: ReaderWriteEvidence,
    message?: string, transactionId?: string): void {
    this.snapshot = { ...this.snapshot, write: { generation, action, confirmation: evidence.confirmation(),
      message, transactionId, observedPending: [] } };
  }

  private async openJourney(hasUnknown: boolean): Promise<void> {
    const generation = this.generation;
    try {
      this.fixedIntent = await this.intents.load();
      if (!this.admitted(generation)) return;
      if (this.fixedIntent !== undefined) { await this.recoverIntent(false); return; }
      if (hasUnknown && this.snapshot.write?.action === 'rollback') { await this.reconcileRollback(false); return; }
      if (hasUnknown) { await this.reconcileUnknown(); return; }
      await this.discover(false);
    } catch (error) {
      if (!this.admitted(generation)) return;
      const write = this.snapshot.write, confirmation = write?.confirmation ?? 'unknown';
      this.snapshot = { ...this.snapshot, write: { generation, action: write?.action ?? 'commit', confirmation,
        transactionId: write?.transactionId, observedPending: [], intentPending: true, readbackFailed: true, message: errorMessageOf(error) },
        state: { kind: 'failure', message: errorMessageOf(error), confirmation, reconcile: true } }; this.publish();
    }
  }

  private async recoverIntent(retryWrite: boolean, deliverResult: boolean = true): Promise<void> {
    const generation = this.generation, admitted = (): boolean => this.admitted(generation);
    let intent = this.fixedIntent;
    try {
      intent = intent ?? await this.intents.load();
      this.fixedIntent = intent;
      if (!admitted()) return;
      if (intent === undefined) {
        if (this.recoveredTransaction !== undefined) await this.deliverRecovered(this.recoveredTransaction, generation);
        else await this.reconcileUnknown();
        return;
      }
      const fixed = intent;
      let query = await this.gateway.queryTransaction(fixed.operationId, fixed.params, admitted);
      if (!admitted()) return;
      if (query.transaction === undefined && retryWrite) {
        if ((query.head?.sequence ?? 0) !== fixed.sequence - 1) {
          throw new SourceSwitchIntentRecoveryError('blocked', '换源水位已越过或不连续，缺少此标识的精确回执；记录已保留，不能分配新标识或按书架推断');
        }
        await this.intents.ensureDurable(fixed, admitted);
        if (!admitted()) return;
        const evidence = new ReaderWriteEvidence();
        const outcome = await this.gateway.commitSwitch(fixed.params, admitted, evidence);
        this.recordWrite(generation, 'commit', evidence, outcome.status === 'failed' ? outcome.error : undefined,
          outcome.transactionId);
        if (!admitted()) return;
        query = await this.gateway.queryTransaction(fixed.operationId, fixed.params, admitted);
        if (!admitted()) return;
      }
      const transaction = query.transaction;
      if (transaction === undefined) {
        throw new SourceSwitchIntentRecoveryError('pending', (query.head?.sequence ?? 0) >= fixed.sequence
          ? '换源流水缺少该标识的精确回执，已停止覆盖；不能按当前书架推断结果'
          : '尚未取得换源精确回执；可重试同一固定标识核对，不能创建新操作');
      }
      this.recoveredTransaction = transaction;
      this.snapshot = { ...this.snapshot, write: { generation, action: transaction.phase === 'rolledBack' ? 'rollback' : 'commit',
        confirmation: 'confirmed', transactionId: transaction.operationId, observedPending: [], intentPending: true },
        pending: transaction.phase === 'pending' ? { fromSourceId: transaction.from.sourceId, fromBookId: transaction.from.bookId,
          targetSourceId: transaction.target.sourceId, targetBookId: transaction.target.bookId,
          targetChapterIndex: transaction.commit.matchedChapter.order, transactionId: transaction.operationId } : undefined };
      // Exact Core proof is established before local cleanup. A flush failure
      // here remains a separate intent cleanup fact, never a false Core failure.
      await this.intents.confirm(fixed, transaction);
      // A pending journal is already committed but not finalized. Retain its
      // full exact payload through the reader seam/Ability replacement so a
      // rollback's lost ACK can be queried without an identity-only match.
      if (transaction.phase !== 'pending') await this.intents.clear(fixed);
      if (!admitted()) return;
      this.fixedIntent = undefined;
      this.confirmedIntent = transaction.phase === 'pending' ? fixed : undefined;
      this.snapshot = { ...this.snapshot, write: { ...this.snapshot.write!, intentPending: false } };
      if (!deliverResult) return;
      await this.deliverRecovered(transaction, generation);
    } catch (error) {
      if (!admitted()) return;
      const write = this.snapshot.write;
      this.snapshot = { ...this.snapshot, write: { generation, action: write?.action ?? 'commit',
        confirmation: write?.confirmation ?? 'unknown', transactionId: write?.transactionId,
        observedPending: write?.observedPending ?? [], intentPending: this.fixedIntent !== undefined || write?.intentPending === true,
        readbackFailed: true, message: errorMessageOf(error) },
        state: { kind: 'failure', message: errorMessageOf(error), confirmation: write?.confirmation ?? 'unknown', reconcile: true,
          transactionId: write?.transactionId } }; this.publish();
    }
  }

  private async deliverRecovered(transaction: SourceSwitchTransactionProjection, generation: number): Promise<void> {
    if (!this.admitted(generation)) return;
    const contextIdentity = this.identity();
    if (transaction.phase === 'rolledBack') {
        const history = transaction.restoredBook;
        if (history === undefined) throw new Error('换源回滚缺少精确恢复书籍');
        const restored = await this.shelf.loadShelfBook(history.sourceId, history.bookId);
        if (!this.admitted(generation)) return;
        if (restored === undefined) throw new Error('换源已撤销，当前书架投影尚未恢复，请重试只读核对');
        this.hide();
        if (!this.sameIdentity(contextIdentity, restored)) this.deliver({ kind: 'rollbackReady', book: restored });
        else this.deliver({ kind: 'closed' });
      } else if (this.sameIdentity(contextIdentity, transaction.target)) {
        this.hide(); this.deliver({ kind: 'closed' });
      } else if (this.sameIdentity(contextIdentity, transaction.from)) {
        if (transaction.phase === 'pending' && this.targetSession !== undefined &&
          this.sameIdentity(this.targetSession.identity, transaction.target)) {
          this.hide(); this.deliver({ kind: 'targetReady', book: transaction.commit.book, session: this.targetSession,
            chapterIndex: transaction.commit.matchedChapter.order });
        } else {
          const canonical = await this.shelf.loadShelfBook(transaction.target.sourceId, transaction.target.bookId);
          if (!this.admitted(generation)) return;
          if (canonical === undefined) throw new Error('换源已确认，当前书架投影尚未恢复，请重试只读核对');
          this.hide(); this.deliver({ kind: 'canonicalReady', book: canonical });
        }
      } else {
        this.snapshot = { ...this.snapshot, state: { kind: 'failure', message: '已有换源已核对，请返回对应书籍继续；当前书籍未改变' } };
        this.publish();
    }
    if (this.snapshot.write !== undefined) this.snapshot = { ...this.snapshot,
      write: { ...this.snapshot.write, readbackFailed: false } };
  }

  private async reconcileRollback(retry: boolean): Promise<void> {
    const intent = this.confirmedIntent ?? this.fixedIntent;
    const write = this.snapshot.write, generation = this.generation;
    const current = (): boolean => this.admitted(generation) && this.snapshot.write?.generation === write?.generation &&
      this.snapshot.write?.action === 'rollback' && this.snapshot.write?.transactionId === write?.transactionId;
    if (intent === undefined || write?.action !== 'rollback' || write.transactionId !== intent.operationId || !current()) return;
    try {
      const query = await this.gateway.queryTransaction(intent.operationId, intent.params, current);
      if (!current()) return;
      const transaction = query.transaction;
      if (transaction === undefined) throw new Error('撤销结果尚未取得精确回执，原记录已保留');
      if (transaction.phase === 'rolledBack') {
        this.snapshot = { ...this.snapshot, pending: undefined, write: { ...write, confirmation: 'confirmed' } };
        this.recoveredTransaction = transaction;
        await this.clearTerminalIntent(transaction.operationId, current);
        if (!current()) return;
        await this.deliverRecovered(transaction, generation);
      } else if (transaction.phase === 'finalized') {
        await this.clearTerminalIntent(transaction.operationId, current);
        if (!current()) return;
        this.snapshot = { ...this.snapshot, pending: undefined, write: { ...write, confirmation: 'undispatched' },
          state: { kind: 'failure', message: '阅读位置已经确认，换源不能再撤销；当前阅读已保留', confirmation: 'confirmed' } };
        this.publish();
      } else if (retry) {
        // Core's exact same-ID journal is still pending. This explicit retry
        // reuses its atomic/idempotent rollback, never an identity-only match.
        await this.rollbackTransaction(transaction.operationId);
      }
    } catch (error) {
      if (!current()) return;
      const confirmation = this.snapshot.write?.confirmation ?? 'unknown';
      this.snapshot = { ...this.snapshot, state: { kind: 'failure', message: errorMessageOf(error),
        confirmation, reconcile: true, transactionId: write.transactionId },
        write: { ...this.snapshot.write!, readbackFailed: true,
          intentPending: this.fixedIntent !== undefined || this.confirmedIntent !== undefined } }; this.publish();
    }
  }

  private async clearTerminalIntent(transactionId: string, current: () => boolean): Promise<void> {
    const intent = this.fixedIntent ?? this.confirmedIntent ?? await this.intents.load();
    if (!current()) return;
    if (intent === undefined) return; // legacy Core journal has no caller intent
    if (intent.operationId !== transactionId) throw new SourceSwitchIntentRecoveryError('blocked', '旧换源不能清除另一固定标识');
    const query = await this.gateway.queryTransaction(intent.operationId, intent.params, current);
    if (!current()) return;
    if (query.transaction === undefined || query.transaction.phase === 'pending') {
      throw new SourceSwitchIntentRecoveryError('pending', '换源仍缺少精确终结回执，原标识已保留');
    }
    this.recoveredTransaction = query.transaction;
    await this.intents.confirm(intent, query.transaction);
    await this.intents.clear(intent);
    if (this.fixedIntent?.operationId === transactionId) this.fixedIntent = undefined;
    if (this.confirmedIntent?.operationId === transactionId) this.confirmedIntent = undefined;
    if (this.snapshot.write?.transactionId === transactionId) this.snapshot = { ...this.snapshot,
      write: { ...this.snapshot.write, intentPending: false, readbackFailed: false } };
  }

  private async finishReaderIntent(transactionId: string): Promise<void> {
    const current = (): boolean => ReaderRuntimeOwner.isCurrent(this.runtime);
    try {
      await this.clearTerminalIntent(transactionId, current);
      this.publish();
    } catch (error) {
      if (!current() || this.snapshot.write?.transactionId !== transactionId) return;
      this.snapshot = { ...this.snapshot, write: { ...this.snapshot.write, confirmation: 'confirmed',
        intentPending: true, readbackFailed: true, message: errorMessageOf(error) } };
      this.publish();
    }
  }
  private settleRetired(generation: number): void {
    if (this.admitted(generation)) return;
    const write = this.snapshot.write;
    this.snapshot = { ...this.snapshot, visible: false, state: write?.confirmation === 'unknown'
      ? { kind: 'failure', message: `换源结果尚未确认：${write.message ?? '请核对待处理记录'}`,
        transactionId: write.transactionId } : { kind: 'discovering' } };
  }
  private busyOrUnknown(): boolean {
    return this.snapshot.state.kind === 'switching' || this.snapshot.rollbackInFlight ||
      this.snapshot.write?.confirmation === 'unknown' || this.snapshot.write?.intentPending === true;
  }
  private admitted(generation: number): boolean { return generation === this.generation && this.currentLease(); }
  private identity(): RemoteReadingIdentity {
    if (this.context === undefined) throw new Error('source switch has no admitted book');
    return { sourceId: this.context.query.sourceId, bookId: this.context.query.bookId };
  }
  private currentLease(): boolean {
    return this.context !== undefined && this.lease !== undefined && ReaderRuntimeOwner.isCurrent(this.runtime) &&
      this.lease.isCurrent(this.identity());
  }
  private currentScope(scopeId: number): boolean { return scopeId === this.snapshot.scopeId && this.currentLease(); }
  private sameIdentity(left: RemoteReadingIdentity, right: RemoteReadingIdentity): boolean {
    return left.sourceId === right.sourceId && left.bookId === right.bookId;
  }
  private seed(candidate: SourceSwitchCandidate): RemoteReadingBookSeed {
    return { sourceId: candidate.sourceId, bookId: candidate.bookUrl, detailUrl: candidate.bookUrl,
      title: candidate.bookName, author: candidate.author ?? '', sourceVersion: candidate.sourceVersion,
      authorIdentity: candidate.authorIdentity, coverUrl: candidate.coverUrl, searchVariables: candidate.searchVariables };
  }
  private stopDiscovery(): void { this.unsubscribe?.(); this.unsubscribe = undefined; }
  private publish(): void {
    if (!this.currentLease()) return;
    // An observer failure must not turn a confirmed Core write into failure.
    try { this.lease?.changed(this.snapshot); } catch (_) {}
  }
  private deliver(effect: SourceSwitchEffect): void {
    if (!this.currentLease()) return;
    try { this.lease?.effect(effect); } catch (_) {}
  }
  private hide(): void {
    this.stopDiscovery(); this.snapshot = { ...this.snapshot, visible: false, state: { kind: 'discovering' }, failureMessage: '' };
    this.publish();
  }
  private acquisitionFailed(candidate: SourceSwitchCandidate, message: string): void {
    this.failedCandidate = candidate; this.failedIdentity = this.identity();
    this.stopDiscovery(); this.snapshot = { ...this.snapshot, visible: false, state: { kind: 'discovering' }, failureMessage: message };
    this.publish(); this.deliver({ kind: 'acquisitionFailed', identity: this.identity(), candidate, message });
  }
}
