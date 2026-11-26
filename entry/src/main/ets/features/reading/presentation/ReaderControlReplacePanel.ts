import type { BookSourceJsonSelection } from '../../../app/ReaderHostRegistry';
import type { ReaderRecoveryView } from '../../../ui/feedback/ReaderRecoveryView';
import type { RulesMutationSnapshot } from '../../settings/application/RulesMutationOwner';
import type { ReaderControlReplaceSaveResult } from '../application/ReaderControlReplaceGateway';
import type { ReadingSessionChapter } from '../application/ReadingChapterWindow';
import type { ReaderReplacePreview } from '../application/ReaderReplaceQuickGateway';
import type { ReaderControlReplaceDraft, ReaderReplaceRule } from '../application/ReaderReplaceQuickState';
import {
  admitReaderControlReplaceDeletion, admitReaderControlReplaceImport, admitReaderControlReplaceLoad,
  admitReaderControlReplaceRule, beginReaderControlReplaceLoad, beginReaderControlReplaceMutation,
  copyReaderControlReplaceState, createReaderControlReplaceState, failReaderControlReplaceRequest,
  readerControlReplaceTicket, readerControlReplaceTicketCurrent, settleReaderControlReplaceOriginal,
  type ReaderControlReplaceState,
} from './ReaderControlReplaceState.ts';

export interface ReaderControlReplacePanelGateway {
  recoverMutation(current: () => boolean, retryOriginal: boolean): Promise<RulesMutationSnapshot>;
  loadRules(current: () => boolean): Promise<ReaderReplaceRule[]>;
  save(draft: ReaderControlReplaceDraft, current: () => boolean): Promise<ReaderControlReplaceSaveResult>;
  toggle(rule: ReaderReplaceRule, enabled: boolean, current: () => boolean): Promise<ReaderControlReplaceSaveResult>;
  deleteRule(ruleId: number, current: () => boolean): Promise<number>;
  preview(sourceId: string, bookId: string, chapterIndex: number): Promise<ReaderReplacePreview>;
  importJson(json: string, current: () => boolean): Promise<number>;
  exportJson(current: () => boolean): Promise<string>;
}

export interface ReaderControlReplaceSession {
  lifecycleToken: number;
  sourceId: string;
  bookId: string;
}

export interface ReaderControlReplacePanelView {
  readState(): ReaderControlReplaceState;
  publishState(state: ReaderControlReplaceState): void;
  recovery(): ReaderRecoveryView;
  publishRecovery(recovery: ReaderRecoveryView): void;
  panelOpen(): boolean;
  committedPresentationIdentity(): string;
  controlInputEnabled(): boolean;
}

export interface ReaderControlReplaceReadingOwner {
  session(): ReaderControlReplaceSession;
  runtimeCurrent(): boolean;
  sessionActive(lifecycleToken: number): boolean;
  chapter(): ReadingSessionChapter | undefined;
  selectionToken(): number;
  selectionActive(lifecycleToken: number, selectionToken: number): boolean;
  persistPosition(): Promise<() => boolean>;
  reloadContent(lifecycleToken: number, bookId: string): void;
}

interface ReaderControlReplaceSnapshotOwner { snapshot(): RulesMutationSnapshot; }

interface ReaderControlReplaceCommit {
  rule?: ReaderReplaceRule;
  deletedId?: number;
  changed: boolean;
  needsReload: boolean;
}

interface ReaderControlReplaceActiveMutation {
  generation: number;
  lifecycleToken: number;
  bookId: string;
  ruleId: number;
}

/** Owns the reading panel's tickets and write/readback order. The shared rules
 * owner owns durable operation identity, and the reader owns position and page effects. */
export class ReaderControlReplacePanel {
  private panelGeneration: number = 0;
  private preparedIdentity: string = '';
  private recoveryOperationId: string | undefined = undefined;
  private mutationGeneration: number = 0;
  private mutation: ReaderControlReplaceActiveMutation | undefined = undefined;
  private readonly rules: ReaderControlReplaceSnapshotOwner;
  private readonly gateway: ReaderControlReplacePanelGateway;
  private readonly view: ReaderControlReplacePanelView;
  private readonly reading: ReaderControlReplaceReadingOwner;
  private readonly writeUncertain: (error: Error) => boolean;

  constructor(rules: ReaderControlReplaceSnapshotOwner, gateway: ReaderControlReplacePanelGateway,
    view: ReaderControlReplacePanelView, reading: ReaderControlReplaceReadingOwner,
    writeUncertain: (error: Error) => boolean) {
    this.rules = rules;
    this.gateway = gateway;
    this.view = view;
    this.reading = reading;
    this.writeUncertain = writeUncertain;
  }

  open(bookTitle: () => string): void {
    this.advancePanel();
    const session = this.reading.session();
    const sessionKey = `${session.sourceId}:${session.bookId}:${session.lifecycleToken}`;
    if (this.view.readState().sessionKey !== sessionKey) {
      this.view.publishState(createReaderControlReplaceState(sessionKey, bookTitle(), session.sourceId));
    }
    this.projectWriteFacts();
  }

  advancePanel(): void { this.panelGeneration += 1; }

  invalidateMutation(): void {
    this.nextMutationGeneration();
    this.mutation = undefined;
  }

  recoveryCurrent(generation: number): boolean {
    const recovery = this.view.recovery();
    return generation === recovery.generation && recovery.visible &&
      this.rules.snapshot().operationId === this.recoveryOperationId;
  }

  prepare(identity: string): void {
    if (JSON.stringify([identity, this.panelGeneration]) === this.preparedIdentity) return;
    // A pending write keeps its owner. The current loader claims this identity when admitted.
    void this.reload().catch((_error: Error): void => {});
  }

  async reload(explicitRecovery: boolean = false, expectedOperationId?: string): Promise<void> {
    const session = this.reading.session();
    const panelGeneration = this.panelGeneration;
    if (!this.panelCurrent(session, panelGeneration)) throw new Error('规则面板已关闭');
    const recoveryFact = this.rules.snapshot();
    if (expectedOperationId !== undefined && recoveryFact.operationId !== expectedOperationId) return;
    if (explicitRecovery && (recoveryFact.confirmation === 'unknown' || recoveryFact.blocked) &&
      recoveryFact.operationId !== expectedOperationId) return;
    this.preparedIdentity = JSON.stringify([this.view.committedPresentationIdentity(), panelGeneration]);
    this.projectWriteFacts();
    const wasUncertain = this.view.readState().writeUncertain;
    this.view.publishState(beginReaderControlReplaceLoad(this.view.readState()));
    const ticket = readerControlReplaceTicket(this.view.readState());
    const isCurrent = (): boolean => this.panelCurrent(session, panelGeneration) &&
      readerControlReplaceTicketCurrent(this.view.readState(), ticket);
    try {
      const prior = this.rules.snapshot();
      if (!prior.busy) {
        await this.gateway.recoverMutation(isCurrent, explicitRecovery && prior.canRetryOriginal);
        if (!isCurrent()) return;
        this.projectWriteFacts();
      }
      const rules = await this.gateway.loadRules(isCurrent);
      if (!isCurrent()) return;
      this.view.publishState(admitReaderControlReplaceLoad(this.view.readState(), ticket, rules));
      this.projectWriteFacts();
      if (wasUncertain) this.reading.reloadContent(session.lifecycleToken, session.bookId);
    } catch (error) {
      if (isCurrent()) {
        this.view.publishState(failReaderControlReplaceRequest(this.view.readState(), ticket, (error as Error).message));
      }
      if (error instanceof Error) throw error;
      throw new Error((error as Error).message);
    }
  }

  async save(draft: ReaderControlReplaceDraft): Promise<void> {
    await this.mutate(draft.original?.id ?? -1,
      async (isCurrent: () => boolean): Promise<ReaderControlReplaceCommit> => {
        const result = await this.gateway.save(draft, isCurrent);
        return { rule: result.rule, changed: result.changed, needsReload: false };
      });
  }

  async toggle(rule: ReaderReplaceRule, enabled: boolean): Promise<void> {
    await this.mutate(rule.id,
      async (isCurrent: () => boolean): Promise<ReaderControlReplaceCommit> => {
        const result = await this.gateway.toggle(rule, enabled, isCurrent);
        return { rule: result.rule, changed: result.changed, needsReload: false };
      });
  }

  async delete(rule: ReaderReplaceRule): Promise<void> {
    await this.mutate(rule.id,
      async (isCurrent: () => boolean): Promise<ReaderControlReplaceCommit> => {
        const id = await this.gateway.deleteRule(rule.id, isCurrent);
        return { deletedId: id, changed: true, needsReload: false };
      });
  }

  async preview(): Promise<ReaderReplacePreview> {
    const chapter = this.reading.chapter();
    const session = this.reading.session();
    const panelGeneration = this.panelGeneration;
    const selection = this.reading.selectionToken();
    if (chapter === undefined || !this.panelCurrent(session, panelGeneration)) throw new Error('当前阅读章节不可用');
    const preview = await this.gateway.preview(session.sourceId, session.bookId, chapter.chapterIndex);
    if (!this.panelCurrent(session, panelGeneration) || !this.reading.selectionActive(session.lifecycleToken, selection) ||
      this.reading.chapter() !== chapter) throw new Error('替换预览已过期');
    return preview;
  }

  async importBundle(pick: () => Promise<BookSourceJsonSelection | undefined>): Promise<void> {
    const session = this.reading.session();
    const panelGeneration = this.panelGeneration;
    if (!this.panelCurrent(session, panelGeneration)) throw new Error('规则面板已关闭');
    const document = await pick();
    if (document === undefined) return;
    if (!this.panelCurrent(session, panelGeneration)) throw new Error('导入选择已过期');
    await this.mutate(-2, async (isCurrent: () => boolean): Promise<ReaderControlReplaceCommit> => {
      const count = await this.gateway.importJson(document.text, isCurrent);
      return { changed: count > 0, needsReload: true };
    });
  }

  async exportBundle(save: (json: string) => Promise<string | undefined>): Promise<void> {
    const session = this.reading.session();
    const panelGeneration = this.panelGeneration;
    const isCurrent = (): boolean => this.panelCurrent(session, panelGeneration) && this.view.controlInputEnabled();
    if (!isCurrent()) throw new Error('规则面板已关闭');
    const json = await this.gateway.exportJson(isCurrent);
    if (!isCurrent()) return;
    await save(json);
  }

  private panelCurrent(session: ReaderControlReplaceSession, panelGeneration: number): boolean {
    if (!this.reading.runtimeCurrent() || !this.reading.sessionActive(session.lifecycleToken)) return false;
    const now = this.reading.session();
    return now.sourceId === session.sourceId && now.bookId === session.bookId &&
      panelGeneration === this.panelGeneration && this.view.panelOpen();
  }

  private async mutate(ruleId: number, action: (isCurrent: () => boolean) => Promise<ReaderControlReplaceCommit>): Promise<void> {
    const session = this.reading.session();
    const panelGeneration = this.panelGeneration;
    if (!this.panelCurrent(session, panelGeneration)) throw new Error('规则面板已关闭');
    this.projectWriteFacts();
    const shared = this.rules.snapshot();
    if (shared.busy || shared.blocked || shared.confirmation === 'unknown') throw new Error(shared.message || '另一规则操作尚未确认');
    const next = beginReaderControlReplaceMutation(this.view.readState());
    const mutation = this.beginMutation(session, ruleId);
    if (mutation === undefined) throw new Error('另一条规则正在保存，请等待完成');
    this.view.publishState(next);
    const ticket = readerControlReplaceTicket(next);
    const ownsWrite = (): boolean => this.reading.session().sourceId === session.sourceId && this.ownsMutation(mutation);
    const canDispatch = (): boolean => ownsWrite() && this.panelCurrent(session, panelGeneration) &&
      readerControlReplaceTicketCurrent(this.view.readState(), ticket);
    let needsReload = false;
    try {
      const positionCurrent = await this.reading.persistPosition();
      const canMutate = (): boolean => canDispatch() && positionCurrent();
      if (!canMutate()) throw new Error('READING_CONTENT_MUTATION_SUPERSEDED');
      const commit = await action(canMutate);
      if (!ownsWrite()) return;
      if (commit.rule !== undefined) {
        this.view.publishState(admitReaderControlReplaceRule(this.view.readState(), ticket, commit.rule));
      } else if (commit.deletedId !== undefined) {
        this.view.publishState(admitReaderControlReplaceDeletion(this.view.readState(), ticket, commit.deletedId));
      } else {
        this.view.publishState(admitReaderControlReplaceImport(this.view.readState(), ticket));
      }
      needsReload = commit.needsReload;
      if (commit.changed) this.reading.reloadContent(session.lifecycleToken, session.bookId);
    } catch (error) {
      if (ownsWrite()) {
        const uncertain = this.writeUncertain(error as Error);
        this.view.publishState(failReaderControlReplaceRequest(this.view.readState(), ticket, (error as Error).message, uncertain));
        this.projectWriteFacts();
        // An unknown reply may still have applied. Re-materialize the original book without replaying the write.
        if (uncertain) this.reading.reloadContent(session.lifecycleToken, session.bookId);
      }
      if (error instanceof Error) throw error;
      throw new Error((error as Error).message);
    } finally {
      if (ownsWrite()) this.projectWriteFacts();
      if (this.sameMutation(mutation)) this.mutation = undefined;
    }
    // An import read belongs to the current same-book panel, even if it reopened during the write.
    if (needsReload && this.panelCurrent(session, this.panelGeneration)) await this.reload();
  }

  private projectWriteFacts(): void {
    const fact = this.rules.snapshot();
    const pending = fact.confirmation === 'unknown' || fact.blocked;
    const message = pending ? '规则操作尚未确认，当前正文已保留，请在规则面板核对原操作。' : '';
    if (message !== this.view.recovery().message || fact.operationId !== this.recoveryOperationId) {
      this.recoveryOperationId = fact.operationId;
      this.view.publishRecovery({ message, visible: pending, canRetry: pending, generation: this.view.recovery().generation + 1 });
    }
    const projected = copyReaderControlReplaceState(this.view.readState());
    projected.writeBlocked = fact.blocked || fact.busy;
    projected.recoveryLabel = fact.canRetryOriginal ? '重试已保留的原规则操作' : '核对原规则操作';
    this.view.publishState(projected);
    if (fact.confirmation === 'unknown') {
      this.view.publishState(failReaderControlReplaceRequest(this.view.readState(),
        readerControlReplaceTicket(this.view.readState()),
        fact.message || '规则写入结果尚未确认；可以读取当前列表，但不能继续写入', true, fact.operationId));
    } else if (!fact.busy) {
      this.view.publishState(settleReaderControlReplaceOriginal(this.view.readState(), fact.operationId));
    }
    if (!this.view.readState().writeUncertain) {
      const settled = copyReaderControlReplaceState(this.view.readState());
      settled.writeOperationId = fact.blocked ? fact.operationId : undefined;
      settled.errorMessage = fact.blocked ? fact.message : this.view.readState().errorMessage;
      this.view.publishState(settled);
    }
  }

  private nextMutationGeneration(): number {
    this.mutationGeneration = this.mutationGeneration >= Number.MAX_SAFE_INTEGER ? 1 : this.mutationGeneration + 1;
    return this.mutationGeneration;
  }

  private beginMutation(session: ReaderControlReplaceSession, ruleId: number): ReaderControlReplaceActiveMutation | undefined {
    const shared = this.rules.snapshot();
    if (shared.busy || shared.blocked || shared.confirmation === 'unknown' || !this.reading.runtimeCurrent()) return undefined;
    if (this.mutation !== undefined && this.mutation.lifecycleToken === session.lifecycleToken &&
      this.mutation.bookId === session.bookId) return undefined;
    const mutation: ReaderControlReplaceActiveMutation = { generation: this.nextMutationGeneration(),
      lifecycleToken: session.lifecycleToken, bookId: session.bookId, ruleId };
    this.mutation = mutation;
    return mutation;
  }

  private ownsMutation(mutation: ReaderControlReplaceActiveMutation): boolean {
    return this.reading.sessionActive(mutation.lifecycleToken) && this.reading.session().bookId === mutation.bookId &&
      this.sameMutation(mutation);
  }

  private sameMutation(mutation: ReaderControlReplaceActiveMutation): boolean {
    const active = this.mutation;
    return active !== undefined && active.generation === mutation.generation && active.lifecycleToken === mutation.lifecycleToken &&
      active.bookId === mutation.bookId && active.ruleId === mutation.ruleId;
  }
}
