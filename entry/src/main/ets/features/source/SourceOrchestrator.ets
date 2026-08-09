import {
  SourceGateway,
  type BookSource,
} from './SourceGateway';
import type { BookSourceJsonSelection } from '../../app/ReaderHostRegistry';
import { ReaderRuntimeOwner } from '../../app/ReaderRuntimeOwner';
import { hilog } from '@kit.PerformanceAnalysisKit';

const DOMAIN = 0x5244;

/** Resolves after `millis`, used for bounded backoff in transient-Core retries. */
function delay(millis: number): Promise<void> {
  return new Promise<void>((resolve: () => void): void => {
    setTimeout(resolve, millis);
  });
}

/**
 * Core rejects unrelated commands while a persistence transaction is awaiting
 * Host durability ("transaction is pending") and rejects `source.update` while
 * any Host operation is in flight ("no pending Host operations"). Both are
 * transient busy conditions, but Core encodes them as non-retryable
 * INVALID_PARAMS, so the stable message is the only discriminator there is.
 */
function isPendingTransactionError(error: Error): boolean {
  return error.message.indexOf('transaction is pending') !== -1
    || error.message.indexOf('no pending Host operations') !== -1;
}

/**
 * Owns the Source Management page's orchestration. A plain class: a serial
 * toggle chain (Core rejects `source.update` while an earlier Host operation
 * is pending), bounded Core-idle waits, and entry `session` / per-toggle `seq`
 * guards on every write-back. Emits typed `BookSource[]` snapshots; Index only
 * forwards them.
 *
 * The toggle chain deliberately outlives a single page entry: a queued toggle
 * is the user's last intent and is still submitted even if they leave before
 * it runs; re-entering awaits this chain so the fresh list reflects the
 * persisted truth.
 */
export class SourceOrchestrator {
  private owner: ReaderRuntimeOwner;
  private gateway: SourceGateway;
  private emit: (sources: BookSource[]) => void;
  private isCurrent: () => boolean;
  /** Authoritative mirror; Index's @State is a projection of it. */
  private sources: BookSource[] = [];
  /** Bumped on every entry; stale-entry loads/write-backs are dropped. */
  private session: number = 0;
  /** Bumped per toggle; an older toggle's reload must not overwrite a newer. */
  private toggleSeq: number = 0;
  /** Serializes source toggles across entries. */
  private toggleChain: Promise<void> = Promise.resolve();
  /** Prevents repeated taps from opening multiple system pickers. */
  private importActive: boolean = false;

  constructor(
    emit: (sources: BookSource[]) => void,
    isCurrent: () => boolean,
    owner: ReaderRuntimeOwner = ReaderRuntimeOwner.current(),
  ) {
    this.owner = owner;
    this.gateway = new SourceGateway(owner);
    this.emit = emit;
    this.isCurrent = isCurrent;
  }

  /** Enter Source Management: wait for in-flight toggles, then load the list. */
  open(): void {
    this.session += 1;
    const session = this.session;
    this.presentSources([]);
    void this.loadList(session);
  }

  private async loadList(session: number): Promise<void> {
    // A toggle tapped just before leaving the page may still be awaiting Host
    // durability; Core rejects `source.list` while that persistence transaction
    // is pending. Wait (bounded) for the toggle queue to drain, then load the
    // authoritative list, retrying if an unrelated transaction still holds the
    // bus so a transient rejection can never leave the page permanently blank.
    await this.waitForSourceToggles(3000);
    let sources: BookSource[];
    try {
      sources = await this.loadSourcesWithRetry();
    } catch (error) {
      if (this.isCurrentSession(session)) {
        hilog.error(DOMAIN, 'Reader',
          'Source management load failed: %{public}s', (error as Error).message);
      }
      return;
    }
    if (this.isCurrentSession(session)) {
      this.presentSources(sources);
    }
  }

  /**
   * Enqueue a source toggle on the serial chain. The write-back is gated on
   * the entry session that enqueued it and the toggle's own seq, so a stale
   * completion never repaints a re-entry or a newer toggle.
   */
  toggleSource(id: string, enabled: boolean): void {
    this.toggleSeq += 1;
    const seq = this.toggleSeq;
    const session = this.session;
    this.toggleChain = this.toggleChain
      .then((): Promise<void> => this.applyToggle(id, enabled, seq, session))
      .catch((error: Error): void => {
        hilog.error(DOMAIN, 'Reader',
          'Source toggle failed; row unchanged: sourceId=%{public}s enabled=%{public}s err=%{public}s',
          id, enabled, error.message);
      });
  }

  /**
   * Select and import one production Legado JSON document. The task joins the
   * same serialized mutation chain as toggles so Core never sees overlapping
   * source writes. With no admitted Figma error state, failures are logged and
   * the current page remains visible; no success state is fabricated.
   */
  importBookSources(): void {
    if (this.importActive) {
      return;
    }
    this.importActive = true;
    const session = this.session;
    this.toggleChain = this.toggleChain
      .then((): Promise<void> => this.applyBookSourceImport(session))
      .catch((error: Error): void => {
        hilog.error(DOMAIN, 'Reader',
          'Book-source import failed; page kept unchanged: %{public}s', error.message);
      })
      .finally((): void => {
        this.importActive = false;
      });
  }

  private async applyBookSourceImport(session: number): Promise<void> {
    if (!this.isCurrentSession(session)) {
      return;
    }
    let selection: BookSourceJsonSelection | undefined;
    try {
      selection = await this.owner.selectBookSourceJson();
    } catch (error) {
      if (!this.isCurrentSession(session)) {
        return;
      }
      throw error instanceof Error ? error : new Error(`${error}`);
    }
    if (selection === undefined || !this.isCurrentSession(session)) {
      return;
    }
    let importedCount = 0;
    try {
      const summary = await this.gateway.importBookSourceDocument(
        selection.text,
        (): boolean => this.isCurrentSession(session),
      );
      importedCount = summary.importedCount;
    } catch (error) {
      const importError = error instanceof Error ? error : new Error(`${error}`);
      if (!this.isCurrentSession(session)) {
        return;
      }
      // Earlier items in a multi-source document may already be durable. A
      // best-effort authoritative reload reflects that truth without hiding
      // the original item-level Core failure.
      await this.reloadAfterImportFailure(session, selection.fileName);
      if (!this.isCurrentSession(session)) {
        return;
      }
      throw importError;
    }

    if (!this.isCurrentSession(session)) {
      return;
    }
    let sources: BookSource[];
    try {
      sources = await this.gateway.loadSources();
    } catch (error) {
      if (!this.isCurrentSession(session)) {
        return;
      }
      hilog.warn(DOMAIN, 'Reader',
        'Book-source import persisted but source.list refresh failed: file=%{public}s count=%{public}d err=%{public}s',
        selection.fileName, importedCount, (error as Error).message);
      return;
    }
    if (!this.isCurrentSession(session)) {
      return;
    }
    this.presentSources(sources);
    hilog.info(DOMAIN, 'Reader',
      'Book-source import completed: file=%{public}s count=%{public}d',
      selection.fileName, importedCount);
  }

  private async reloadAfterImportFailure(session: number, fileName: string): Promise<void> {
    if (!this.isCurrentSession(session)) {
      return;
    }
    try {
      const sources = await this.gateway.loadSources();
      if (this.isCurrentSession(session)) {
        this.presentSources(sources);
      }
    } catch (reloadError) {
      if (!this.isCurrentSession(session)) {
        return;
      }
      hilog.warn(DOMAIN, 'Reader',
        'Book-source import failure reload also failed: file=%{public}s err=%{public}s',
        fileName, (reloadError as Error).message);
    }
  }

  private async applyToggle(
    id: string, enabled: boolean, seq: number, session: number,
  ): Promise<void> {
    // A toggle can be rejected while an unrelated Host operation (search,
    // check, sync) is in flight, because Core refuses to start `source.update`
    // until the bus is free. Wait until Core reports idle, then retry once —
    // the serial chain means this retry only waits out the external operation,
    // never a concurrent toggle.
    await this.updateSourceWithRetry(id, enabled);
    // `updateSource` resolved → the toggle IS persisted (Core awaits the Host
    // snapshot put). Reflect it locally even if the reload below fails, so a
    // reload failure is never reported as "nothing changed". The flip and the
    // reload share the session guard: leaving and re-entering Source
    // Management starts a fresh list load that supersedes this write-back.
    if (this.isCurrentSession(session)) {
      this.presentSources(this.sources.map((source): BookSource => {
        if (source.sourceId !== id) {
          return source;
        }
        const updated: BookSource = {
          sourceId: source.sourceId,
          name: source.name,
          baseUrl: source.baseUrl,
          enabled,
          enabledExplore: source.enabledExplore,
        };
        return updated;
      }));
    }
    let sources: BookSource[];
    try {
      sources = await this.gateway.loadSources();
    } catch (error) {
      hilog.warn(DOMAIN, 'Reader',
        'Source toggle persisted but list reload failed: sourceId=%{public}s enabled=%{public}s err=%{public}s',
        id, enabled, (error as Error).message);
      return;
    }
    if (this.isCurrentSession(session) && seq === this.toggleSeq) {
      this.presentSources(sources);
    }
  }

  private async updateSourceWithRetry(id: string, enabled: boolean): Promise<void> {
    try {
      await this.gateway.updateSource(id, { enabled });
      return;
    } catch (error) {
      const err = error as Error;
      if (!isPendingTransactionError(err)) {
        throw err;
      }
      // A pending external Host operation blocked the toggle. Wait until Core
      // reports idle, then retry once; a genuine mismatch echo is rethrown
      // above and never retried.
      await this.waitForCoreIdle(5000);
      await this.gateway.updateSource(id, { enabled });
    }
  }

  private async loadSourcesWithRetry(): Promise<BookSource[]> {
    try {
      return await this.gateway.loadSources();
    } catch (error) {
      const err = error as Error;
      if (!isPendingTransactionError(err)) {
        throw err;
      }
      // A persistence transaction (a toggle's durability, a replace mutation)
      // is holding the bus. Wait until Core reports idle, then load once more
      // instead of guessing a fixed backoff window.
      await this.waitForCoreIdle(5000);
      return await this.gateway.loadSources();
    }
  }

  /**
   * Polls `runtime.status` until Core reports no pending Host operations
   * (bounded). `runtime.status` is exempt from the persistence-transaction
   * gate, so it stays responsive while other commands are rejected.
   */
  private async waitForCoreIdle(maxMillis: number): Promise<void> {
    const deadline = Date.now() + maxMillis;
    while (Date.now() < deadline) {
      try {
        const result = await this.owner.request('runtime.status', {});
        const pending = result.data['pendingHostOperationCount'] as number | undefined;
        if (pending === 0) {
          return;
        }
      } catch (error) {
        // The probe itself failed transiently; keep polling until the deadline.
        hilog.warn(DOMAIN, 'Reader',
          'runtime.status probe failed during idle wait: %{public}s', (error as Error).message);
      }
      await delay(250);
    }
  }

  /**
   * Resolves once every source toggle enqueued so far has settled (persisted,
   * failed, or timed out). Source Management re-entry awaits this before the
   * authoritative load; bounded so a stuck toggle cannot strand the entry.
   */
  private waitForSourceToggles(maxMillis: number): Promise<void> {
    return Promise.race([this.toggleChain, delay(maxMillis)]);
  }

  private isCurrentSession(session: number): boolean {
    return this.isCurrent() && session === this.session;
  }

  private presentSources(sources: BookSource[]): void {
    this.sources = sources;
    this.emit(sources);
  }
}
