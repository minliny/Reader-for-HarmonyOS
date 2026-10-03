import { hilog } from '@kit.PerformanceAnalysisKit';
import type { ShelfBook } from '../../app/ReaderCoreGateway';
import { ReaderRuntimeOwner } from '../../app/ReaderRuntimeOwner';
import { ReaderWriteEvidence } from '../../app/ReaderWriteEvidence';
import type { BookshelfManagementMutationState } from './BookshelfManagementIntentStore';
import { projectOperationFacts, type OperationFacts } from '../../app/ReaderOperationFacts';
import { projectPersistedReceipt, type PersistedReceiptProjection } from '../../app/ReaderPersistedReceiptProjection';
import {
  BookshelfManagementGateway,
  type BookGroup,
  type BookshelfManagementData,
} from './BookshelfManagementGateway';

const DOMAIN = 0x5244;
let bookshelfManagementGeneration: number = 0;

export interface BookshelfManagementSnapshot {
  data: BookshelfManagementData;
  selectedGroupId: number;
  groupNameDraft: string;
  groupOrderDraft: string;
  selectedSourceId: string;
  selectedBookId: string;
  assignmentGroupDraft: string;
  busy: boolean;
  statusMessage: string;
  receipt?: PersistedReceiptProjection<BookshelfManagementData>;
  readFacts?: OperationFacts<BookshelfManagementData>;
  mutationBlocked?: boolean;
  managementMutation?: BookshelfManagementMutationState;
}

const EMPTY_DATA: BookshelfManagementData = {
  groups: [],
  books: [],
  records: [],
  totalReadTime: 0,
  latestReadAt: 0,
};

export const EMPTY_BOOKSHELF_MANAGEMENT_SNAPSHOT: BookshelfManagementSnapshot = {
  data: EMPTY_DATA,
  selectedGroupId: 0,
  groupNameDraft: '',
  groupOrderDraft: '0',
  selectedSourceId: '',
  selectedBookId: '',
  assignmentGroupDraft: '',
  busy: false,
  statusMessage: '',
};

interface BookshelfManagementPatch {
  data?: BookshelfManagementData;
  selectedGroupId?: number;
  groupNameDraft?: string;
  groupOrderDraft?: string;
  selectedSourceId?: string;
  selectedBookId?: string;
  assignmentGroupDraft?: string;
  busy?: boolean;
  statusMessage?: string;
  receipt?: PersistedReceiptProjection<BookshelfManagementData>;
  readFacts?: OperationFacts<BookshelfManagementData>;
  mutationBlocked?: boolean;
  managementMutation?: BookshelfManagementMutationState;
}

/** Serial coordinator; Core remains the sole owner of groups, membership and records. */
export class BookshelfManagementOrchestrator {
  private readonly gateway: BookshelfManagementGateway;
  private emit: (snapshot: BookshelfManagementSnapshot) => void;
  private isCurrent: () => boolean;
  private snapshot: BookshelfManagementSnapshot = EMPTY_BOOKSHELF_MANAGEMENT_SNAPSHOT;
  private operationTail: Promise<void> = Promise.resolve();
  private session: number = 0;
  private readonly owner: ReaderRuntimeOwner;
  private hasRead: boolean = false;
  private presentationIdentity: string | undefined;
  private writeReserved: boolean = false;
  private readReservations: number = 0;
  private latestReceipt: PersistedReceiptProjection<BookshelfManagementData> | undefined;

  constructor(
    emit: (snapshot: BookshelfManagementSnapshot) => void,
    isCurrent: () => boolean,
    owner: ReaderRuntimeOwner = ReaderRuntimeOwner.current(),
  ) {
    this.owner = owner;
    this.gateway = new BookshelfManagementGateway(owner);
    this.emit = emit;
    this.isCurrent = isCurrent;
  }

  attachPresentation(identity: string, emit: (snapshot: BookshelfManagementSnapshot) => void, current: () => boolean): boolean {
    if (identity.length === 0 || !ReaderRuntimeOwner.isCurrent(this.owner)) return false;
    try { if (!current()) return false; } catch (_) { return false; }
    if (this.presentationIdentity === identity) return true;
    this.session += 1; this.presentationIdentity = identity; this.emit = emit; this.isCurrent = current;
    this.publish({}); return true;
  }
  detachPresentation(identity: string): void {
    if (identity !== this.presentationIdentity) return;
    this.session += 1; this.presentationIdentity = undefined;
    this.emit = (_snapshot: BookshelfManagementSnapshot): void => {}; this.isCurrent = (): boolean => false;
  }
  isPresentationCurrent(identity: string): boolean {
    return identity.length > 0 && identity === this.presentationIdentity && this.isCurrentSession(this.session);
  }
  currentSnapshot(): BookshelfManagementSnapshot { return this.copySnapshot(this.snapshot); }
  private admit(identity?: string): boolean {
    return identity === this.presentationIdentity && this.isCurrentSession(this.session);
  }
  private canWrite(identity?: string): boolean {
    return this.admit(identity) && !this.writeReserved && !this.snapshot.busy &&
      this.latestReceipt?.receipt.confirmation !== 'unknown' && !this.gateway.mutationSnapshot().blocked;
  }

  open(identity?: string): void {
    if (!this.admit(identity)) return;
    this.session += 1;
    const session = this.session;
    this.publish({ busy: true, statusMessage: '正在读取 Core 书架数据…',
      readFacts: projectOperationFacts({ phase: 'loading', value: this.hasRead ? this.snapshot.data : undefined,
        generation: ++bookshelfManagementGeneration }) });
    this.enqueue(async (): Promise<void> => {
      await this.recoverOriginal(session);
      await this.reload(session, '已读取分组、书架与阅读记录');
    });
  }

  owns(owner: ReaderRuntimeOwner): boolean { return this.owner === owner; }

  reconcile(generation: number, identity?: string): void {
    if (!this.admit(identity)) return;
    const session = this.session;
    this.enqueue(async (): Promise<void> => {
      if (!this.isCurrentSession(session)) return;
      const receipt = this.latestReceipt;
      const read = this.snapshot.readFacts;
      if (receipt?.facts.generation === generation && (receipt.facts.canRetry || this.gateway.mutationSnapshot().blocked)) {
        this.publishReceipt(session, receipt.receipt.confirmation, 'reading');
        await this.recoverOriginal(session);
        await this.reload(session, '已读取分组、书架与阅读记录');
      } else if (read?.generation === generation && read.canRetry) {
        this.publishIfCurrent(session, { busy: true, readFacts: projectOperationFacts({ phase: 'loading',
          value: this.hasRead ? this.snapshot.data : undefined, generation: ++bookshelfManagementGeneration }) });
        await this.recoverOriginal(session);
        await this.reload(session, '已读取分组、书架与阅读记录');
      }
    });
  }

  continueOriginal(generation: number, identity?: string): void {
    if (!this.admit(identity) || this.writeReserved || this.snapshot.busy ||
      this.latestReceipt?.facts.generation !== generation || !this.gateway.mutationSnapshot().canContinueOriginal) return;
    const session = this.session;
    this.enqueueWrite(session, async (): Promise<void> => {
      await this.recoverOriginal(session, true);
      await this.reload(session, '已核对并读取分组、书架与阅读记录');
    }, true);
  }

  private async recoverOriginal(session: number, continueOriginal: boolean = false): Promise<void> {
    try {
      const state = await this.gateway.recoverWrites((): boolean => this.isCurrentSession(session), continueOriginal);
      this.publish({ managementMutation: state });
      if (state.operationId !== undefined) this.publishReceipt(session, state.confirmation, 'reading', state.message || undefined);
    } catch (error) {
      const state = this.gateway.mutationSnapshot();
      this.publish({ managementMutation: state });
      if (state.operationId !== undefined || state.blocked) this.publishReceipt(session, state.confirmation, 'failed', (error as Error).message);
    }
  }

  updateGroupName(value: string, identity?: string): void {
    if (!this.admit(identity)) return;
    if (value.length <= 256) this.publish({ groupNameDraft: value });
  }

  updateGroupOrder(value: string, identity?: string): void {
    if (!this.admit(identity)) return;
    if (/^-?\d{0,9}$/.test(value)) this.publish({ groupOrderDraft: value });
  }

  selectGroup(groupId: number, identity?: string): void {
    if (!this.admit(identity)) return;
    const group = this.snapshot.data.groups.find((candidate: BookGroup): boolean => candidate.groupId === groupId);
    if (group === undefined) return;
    this.publish({
      selectedGroupId: group.groupId,
      groupNameDraft: group.groupName,
      groupOrderDraft: `${group.order}`,
      assignmentGroupDraft: group.groupName,
      statusMessage: `已选择分组：${group.groupName}`,
    });
  }

  clearGroupEditor(identity?: string): void {
    if (!this.admit(identity)) return;
    this.publish({ selectedGroupId: 0, groupNameDraft: '', groupOrderDraft: '0' });
  }

  saveGroup(identity?: string): void {
    if (!this.canWrite(identity)) return;
    const session = this.session;
    const name = this.snapshot.groupNameDraft;
    let order: number;
    try { order = this.parseOrder(this.snapshot.groupOrderDraft); }
    catch (error) { this.publishReceipt(session, 'undispatched', 'failed', (error as Error).message); return; }
    const selected = this.snapshot.data.groups.find(
      (candidate: BookGroup): boolean => candidate.groupId === this.snapshot.selectedGroupId,
    );
    this.enqueueWrite(session, async (): Promise<void> => {
      this.publishIfCurrent(session, { busy: true, statusMessage: '正在由 Core 保存分组…' });
      await this.performWrite(session, async (): Promise<void> => {
        if (selected === undefined) {
          await this.gateway.createGroup(name, order);
        } else {
          await this.gateway.updateGroup(selected, name, order);
        }
      }, selected === undefined ? '分组已创建' : '分组已更新', true);
    });
  }

  toggleGroupShown(groupId: number, identity?: string): void {
    if (!this.canWrite(identity)) return;
    const session = this.session;
    const group = this.snapshot.data.groups.find((candidate: BookGroup): boolean => candidate.groupId === groupId);
    if (group === undefined) return;
    this.enqueueWrite(session, async (): Promise<void> => {
      this.publishIfCurrent(session, { busy: true, statusMessage: '正在更新分组显示状态…' });
      await this.performWrite(session, async (): Promise<void> => {
        await this.gateway.setGroupShown(group, !group.show);
      }, '分组显示状态已更新');
    });
  }

  deleteGroup(groupId: number, identity?: string): void {
    if (!this.canWrite(identity)) return;
    const session = this.session;
    this.enqueueWrite(session, async (): Promise<void> => {
      this.publishIfCurrent(session, { busy: true, statusMessage: '正在由 Core 删除分组…' });
      await this.performWrite(session, async (): Promise<void> => {
        await this.gateway.deleteGroup(groupId);
      }, '分组实体已删除；书籍上的同名标签按 Core 原值保留');
    });
  }

  selectBook(sourceId: string, bookId: string, identity?: string): void {
    if (!this.admit(identity)) return;
    const book = this.findBook(sourceId, bookId);
    if (book === undefined) return;
    this.publish({
      selectedSourceId: sourceId,
      selectedBookId: bookId,
      assignmentGroupDraft: book.group ?? '',
      statusMessage: `已选择书籍：${book.title}`,
    });
  }

  updateAssignmentGroup(value: string, identity?: string): void {
    if (!this.admit(identity)) return;
    if (value.length <= 256) this.publish({ assignmentGroupDraft: value });
  }

  assignSelectedBook(identity?: string): void {
    if (!this.canWrite(identity)) return;
    const session = this.session;
    const book = this.findBook(this.snapshot.selectedSourceId, this.snapshot.selectedBookId);
    if (book === undefined) return;
    const group = this.snapshot.assignmentGroupDraft;
    this.enqueueWrite(session, async (): Promise<void> => {
      this.publishIfCurrent(session, { busy: true, statusMessage: '正在由 Core 分配书架分组…' });
      await this.performWrite(session, async (): Promise<void> => {
        await this.gateway.assignGroup(book, group);
      }, group.trim().length === 0 ? '已清除书籍分组' : `已分配到：${group.trim()}`);
    });
  }

  assignBookGroup(book: ShelfBook, group: string, identity: string): Promise<BookshelfManagementSnapshot> {
    if (!this.canWrite(identity)) return Promise.resolve(this.currentSnapshot());
    const session = this.session;
    return this.enqueueWrite(session, async (): Promise<void> => {
      this.publish({ busy: true, statusMessage: '正在由 Core 分配书架分组…' });
      await this.performWrite(session, async (): Promise<void> => { await this.gateway.assignGroup(book, group); },
        group.trim().length === 0 ? '已清除书籍分组' : `已分配到：${group.trim()}`);
    }).then((): BookshelfManagementSnapshot => this.currentSnapshot());
  }

  private enqueueWrite(session: number, operation: () => Promise<void>, continuation: boolean = false): Promise<void> {
    this.writeReserved = true;
    const accepted = this.operationTail.then(async (): Promise<void> => {
      if (!this.isCurrentSession(session) || (!continuation && (this.latestReceipt?.receipt.confirmation === 'unknown' || this.gateway.mutationSnapshot().blocked))) return;
      await operation();
    });
    this.operationTail = accepted.catch((error: Error): void => {
      try { hilog.error(DOMAIN, 'Reader', 'Bookshelf management operation failed: %{private}s', error.message); } catch (_) {}
    }).finally((): void => { this.writeReserved = false; this.publish({ busy: false }); });
    return this.operationTail;
  }

  private async performWrite(session: number, operation: () => Promise<void>, status: string,
    clearDraft: boolean = false): Promise<void> {
    const evidence = new ReaderWriteEvidence();
    this.gateway.observeWrites(evidence, (): boolean => this.isCurrentSession(session));
    try { await operation(); }
    catch (error) {
      const state = this.gateway.mutationSnapshot(); this.publish({ managementMutation: state });
      this.publishReceipt(session, state.blocked ? state.confirmation : evidence.confirmation(), 'failed', (error as Error).message); return;
    }
    finally { this.gateway.observeWrites(undefined); }
    this.publish({ managementMutation: this.gateway.mutationSnapshot() });
    this.publishReceipt(session, evidence.confirmation(), this.isCurrentSession(session) ? 'reading' : 'failed');
    if (!this.isCurrentSession(session)) return;
    if (await this.reload(session, status) && clearDraft) {
      this.publishIfCurrent(session, { selectedGroupId: 0, groupNameDraft: '', groupOrderDraft: '0' });
    }
  }

  private async reload(session: number, statusMessage: string): Promise<boolean> {
    if (!this.isCurrentSession(session)) return false;
    try {
      const data = await this.gateway.load();
      if (this.isCurrentSession(session)) {
        this.hasRead = true;
        this.publish({ data });
        const receipt = this.latestReceipt;
        if (receipt !== undefined) this.publishReceipt(session, receipt.receipt.confirmation, 'succeeded');
        this.publish({ busy: false, statusMessage: receipt === undefined || receipt.receipt.confirmation === 'confirmed' ?
          statusMessage : this.snapshot.statusMessage,
          readFacts: projectOperationFacts({ phase: 'succeeded', value: data, generation: ++bookshelfManagementGeneration }) });
      }
      return true;
    } catch (error) {
      const receipt = this.latestReceipt;
      if (receipt !== undefined) this.publishReceipt(session, receipt.receipt.confirmation, 'failed', (error as Error).message);
      this.publishIfCurrent(session, { busy: false,
        statusMessage: receipt === undefined ? `书架管理数据读取失败：${(error as Error).message}` : this.snapshot.statusMessage,
        readFacts: projectOperationFacts({ phase: 'failed', value: this.hasRead ? this.snapshot.data : undefined,
          canRetry: true, generation: ++bookshelfManagementGeneration, message: (error as Error).message }) });
      return false;
    }
  }

  private publishReceipt(session: number, confirmation: 'confirmed' | 'unknown' | 'undispatched',
    readback: 'reading' | 'failed' | 'succeeded', error?: string): void {
    this.latestReceipt = projectPersistedReceipt({ confirmation, readback,
      value: this.hasRead ? this.snapshot.data : undefined, refreshError: error,
      canRetry: confirmation !== 'undispatched' && readback !== 'reading' && (readback === 'failed' || confirmation === 'unknown'),
      generation: ++bookshelfManagementGeneration });
    this.publish({ receipt: this.latestReceipt, busy: readback === 'reading',
      statusMessage: this.latestReceipt.receipt.message + (error === undefined ? '' : `：${error}`) });
  }

  private findBook(sourceId: string, bookId: string): ShelfBook | undefined {
    return this.snapshot.data.books.find((candidate: ShelfBook): boolean =>
      candidate.sourceId === sourceId && candidate.bookId === bookId);
  }

  private parseOrder(value: string): number {
    if (!/^-?\d+$/.test(value)) throw new Error('分组顺序必须为整数');
    const order = Number(value);
    if (!Number.isSafeInteger(order)) throw new Error('分组顺序超出安全范围');
    return order;
  }

  private enqueue(operation: () => Promise<void>): void {
    if (!this.isCurrentSession(this.session)) return;
    this.readReservations += 1;
    this.operationTail = this.operationTail.then(async (): Promise<void> => {
      if (!ReaderRuntimeOwner.isCurrent(this.owner)) return;
      await operation();
    }).catch((error: Error): void => {
      try { hilog.error(DOMAIN, 'Reader', 'Bookshelf management operation failed: %{private}s', error.message); } catch (_) {}
    }).finally((): void => {
      this.readReservations -= 1; this.publish({ busy: false });
    });
  }

  private publish(patch: BookshelfManagementPatch): void {
    this.snapshot = {
      data: patch.data ?? this.snapshot.data,
      selectedGroupId: patch.selectedGroupId ?? this.snapshot.selectedGroupId,
      groupNameDraft: patch.groupNameDraft ?? this.snapshot.groupNameDraft,
      groupOrderDraft: patch.groupOrderDraft ?? this.snapshot.groupOrderDraft,
      selectedSourceId: patch.selectedSourceId ?? this.snapshot.selectedSourceId,
      selectedBookId: patch.selectedBookId ?? this.snapshot.selectedBookId,
      assignmentGroupDraft: patch.assignmentGroupDraft ?? this.snapshot.assignmentGroupDraft,
      busy: this.writeReserved || this.readReservations > 0 || (patch.busy ?? this.snapshot.busy),
      statusMessage: patch.statusMessage ?? this.snapshot.statusMessage,
      receipt: patch.receipt ?? this.snapshot.receipt,
      readFacts: patch.readFacts ?? this.snapshot.readFacts,
      mutationBlocked: this.latestReceipt?.receipt.confirmation === 'unknown' || this.gateway.mutationSnapshot().blocked,
      managementMutation: patch.managementMutation ?? this.snapshot.managementMutation,
    };
    if (this.isCurrentSession(this.session)) { try { this.emit(this.copySnapshot(this.snapshot)); } catch (error) {
      try { hilog.error(DOMAIN, 'Reader', 'Bookshelf observer failed: %{private}s', (error as Error).message); } catch (_) {}
    } }
  }

  private publishIfCurrent(session: number, patch: BookshelfManagementPatch): void {
    if (this.isCurrentSession(session)) this.publish(patch);
  }

  private fail(session: number, label: string, error: Error): void {
    if (this.isCurrentSession(session)) this.publish({ busy: false, statusMessage: `${label}：${error.message}` });
    hilog.error(DOMAIN, 'Reader', '%{private}s: %{private}s', label, error.message);
  }

  private isCurrentSession(session: number): boolean {
    try { return ReaderRuntimeOwner.isCurrent(this.owner) && this.isCurrent() && session === this.session; } catch (_) { return false; }
  }

  private copySnapshot(source: BookshelfManagementSnapshot): BookshelfManagementSnapshot {
    return {
      data: {
        groups: source.data.groups.slice(),
        books: source.data.books.slice(),
        records: source.data.records.slice(),
        totalReadTime: source.data.totalReadTime,
        latestReadAt: source.data.latestReadAt,
      },
      selectedGroupId: source.selectedGroupId,
      groupNameDraft: source.groupNameDraft,
      groupOrderDraft: source.groupOrderDraft,
      selectedSourceId: source.selectedSourceId,
      selectedBookId: source.selectedBookId,
      assignmentGroupDraft: source.assignmentGroupDraft,
      busy: source.busy,
      statusMessage: source.statusMessage,
      receipt: source.receipt,
      readFacts: source.readFacts,
      mutationBlocked: source.mutationBlocked,
      managementMutation: source.managementMutation,
    };
  }
}
