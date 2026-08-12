import {
  SourceGateway,
  type BookSource,
  type SourceCheckOutcome,
} from './SourceGateway';
import type { BookSourceJsonSelection } from '../../app/ReaderHostRegistry';
import { ReaderRuntimeOwner } from '../../app/ReaderRuntimeOwner';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { isReaderCoreTransactionPendingError } from '@reader/core-harmony';

const DOMAIN = 0x5244;

/** Resolves after `millis`, used for bounded backoff in transient-Core retries. */
function delay(millis: number): Promise<void> {
  return new Promise<void>((resolve: () => void): void => {
    setTimeout(resolve, millis);
  });
}

/**
 * Core exposes persistence/Host-operation contention through a stable typed
 * `TRANSACTION_PENDING` error. Human-readable message text is not an ABI.
 */
function isPendingTransactionError(error: Error): boolean {
  return isReaderCoreTransactionPendingError(error);
}

interface SourceLoginFailure {
  code?: string;
  message: string;
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
  /** Serializes Core source operations across entries. */
  private operationChain: Promise<void> = Promise.resolve();
  /** Prevents repeated taps from opening multiple system pickers. */
  private importActive: boolean = false;
  /** Session-local source-check projections; Core remains authoritative. */
  private checkResults: Map<string, BookSource> = new Map<string, BookSource>();
  private checkingSourceIds: Set<string> = new Set<string>();

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
    this.checkResults.clear();
    this.checkingSourceIds.clear();
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
    this.operationChain = this.operationChain
      .then((): Promise<void> => this.applyToggle(id, enabled, seq, session))
      .catch((error: Error): void => {
        hilog.error(DOMAIN, 'Reader',
          'Source toggle failed; row unchanged: sourceId=%{public}s enabled=%{public}s err=%{public}s',
          id, enabled, error.message);
      });
  }

  /** Queue one production L1-L5 diagnostic; repeated taps never duplicate it. */
  checkSource(id: string): void {
    if (this.checkingSourceIds.has(id)) {
      return;
    }
    const session = this.session;
    this.checkingSourceIds.add(id);
    this.setCheckProjection(id, 'checking', [], '检测中');
    this.operationChain = this.operationChain
      .then((): Promise<void> => this.applySourceCheck(id, session))
      .catch((error: Error): void => {
        if (this.isCurrentSession(session)) {
          this.setCheckProjection(id, 'failed', [], error.message);
        }
        hilog.error(DOMAIN, 'Reader',
          'Source check failed: sourceId=%{public}s err=%{public}s', id, error.message);
      })
      .finally((): void => {
        if (session === this.session) {
          this.checkingSourceIds.delete(id);
        }
      });
  }

  /** Open the source-owned login/challenge URL on the shared Host session. */
  loginSource(id: string): void {
    const source = this.sources.find((candidate: BookSource): boolean => candidate.sourceId === id);
    if (source === undefined || source.loginUrl === undefined || this.checkingSourceIds.has(id)) {
      return;
    }
    const loginUrl = source.loginUrl;
    const session = this.session;
    this.checkingSourceIds.add(id);
    this.setCheckProjection(id, 'checking', [], '等待登录 / 验证');
    this.operationChain = this.operationChain
      .then(async (): Promise<void> => {
        await this.owner.openSourceLogin(source.sourceId, loginUrl, source.name);
        if (!this.isCurrentSession(session)) {
          return;
        }
        const outcome = await this.gateway.checkSource(
          source.sourceId,
          (): boolean => this.isCurrentSession(session),
        );
        if (this.isCurrentSession(session)) {
          this.applySourceCheckOutcome(outcome);
        }
      })
      .catch((error: SourceLoginFailure): void => {
        const message = error.message;
        if (this.isCurrentSession(session)) {
          if (error.code === 'CANCELLED') {
            this.setCheckProjection(id, 'unchecked', [], '登录 / 验证已取消');
          } else {
            this.setCheckProjection(id, 'failed', [], message);
          }
        }
        hilog.warn(DOMAIN, 'Reader',
          'Source login/challenge ended without completion: sourceId=%{public}s err=%{public}s',
          id, message);
      })
      .finally((): void => {
        if (session === this.session) {
          this.checkingSourceIds.delete(id);
        }
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
    this.operationChain = this.operationChain
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
    if (!enabled) {
      try {
        // Security policy: disabling a source removes both session and
        // persistent cookies. Re-enabling starts a fresh login/session.
        await this.owner.clearSourceCookieSession(id);
      } catch (error) {
        hilog.error(DOMAIN, 'Reader',
          'Source disabled but cookie-session cleanup failed: sourceId=%{public}s err=%{public}s',
          id, (error as Error).message);
      }
    }
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
          loginUrl: source.loginUrl,
          checkState: source.checkState,
          checkLevels: source.checkLevels,
          checkMessage: source.checkMessage,
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

  private async applySourceCheck(id: string, session: number): Promise<void> {
    if (!this.isCurrentSession(session)) {
      return;
    }
    const outcome = await this.gateway.checkSource(
      id,
      (): boolean => this.isCurrentSession(session),
    );
    if (!this.isCurrentSession(session)) {
      return;
    }
    this.applySourceCheckOutcome(outcome);
    hilog.info(DOMAIN, 'Reader',
      'Source check completed: sourceId=%{public}s available=%{public}s levels=%{public}s durationMs=%{public}d reason=%{public}s',
      id, outcome.available, outcome.levelsPassed.join(','), outcome.durationMs,
      outcome.failureReason ?? '');
  }

  private applySourceCheckOutcome(outcome: SourceCheckOutcome): void {
    if (outcome.available) {
      this.setCheckProjection(
        outcome.sourceId,
        'passed',
        outcome.levelsPassed,
        `L1–L5 通过 · ${outcome.durationMs}ms`,
      );
      return;
    }
    this.setCheckProjection(
      outcome.sourceId,
      'failed',
      outcome.levelsPassed,
      outcome.failureReason ?? '检测失败',
    );
  }

  private setCheckProjection(
    id: string,
    state: 'unchecked' | 'checking' | 'passed' | 'failed',
    levels: string[],
    message: string,
  ): void {
    const source = this.sources.find((candidate: BookSource): boolean => candidate.sourceId === id);
    if (source === undefined) {
      return;
    }
    this.checkResults.set(id, {
      sourceId: source.sourceId,
      name: source.name,
      baseUrl: source.baseUrl,
      enabled: source.enabled,
      enabledExplore: source.enabledExplore,
      loginUrl: source.loginUrl,
      checkState: state,
      checkLevels: levels,
      checkMessage: message,
    });
    this.presentSources(this.sources);
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
    return Promise.race([this.operationChain, delay(maxMillis)]);
  }

  private isCurrentSession(session: number): boolean {
    return this.isCurrent() && session === this.session;
  }

  private presentSources(sources: BookSource[]): void {
    this.sources = sources.map((source: BookSource): BookSource => {
      const checked = this.checkResults.get(source.sourceId);
      return {
        sourceId: source.sourceId,
        name: source.name,
        baseUrl: source.baseUrl,
        enabled: source.enabled,
        enabledExplore: source.enabledExplore,
        loginUrl: source.loginUrl,
        checkState: checked?.checkState ?? source.checkState ?? 'unchecked',
        checkLevels: checked?.checkLevels ?? source.checkLevels ?? [],
        checkMessage: checked?.checkMessage ?? source.checkMessage,
      };
    });
    this.emit(this.sources);
  }
}
