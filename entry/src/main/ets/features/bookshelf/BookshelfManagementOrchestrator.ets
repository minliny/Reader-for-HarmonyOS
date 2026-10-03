import { hilog } from '@kit.PerformanceAnalysisKit';
import type { ShelfBook } from '../../app/ReaderCoreGateway';
import { ReaderRuntimeOwner } from '../../app/ReaderRuntimeOwner';
import { ReaderWriteEvidence } from '../../app/ReaderWriteEvidence';
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
}

/** Serial coordinator; Core remains the sole owner of groups, membership and records. */
export class BookshelfManagementOrchestrator {
  private readonly gateway: BookshelfManagementGateway;
  private readonly emit: (snapshot: BookshelfManagementSnapshot) => void;
  private readonly isCurrent: () => boolean;
  private snapshot: BookshelfManagementSnapshot = EMPTY_BOOKSHELF_MANAGEMENT_SNAPSHOT;
  private operationTail: Promise<void> = Promise.resolve();
  private session: number = 0;
  private readonly owner: ReaderRuntimeOwner;
  private hasRead: boolean = false;
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

  open(): void {
    this.session += 1;
    const session = this.session;
    this.publish({ busy: true, statusMessage: '正在读取 Core 书架数据…',
      readFacts: projectOperationFacts({ phase: 'loading', value: this.hasRead ? this.snapshot.data : undefined,
        generation: ++bookshelfManagementGeneration }) });
    this.enqueue(async (): Promise<void> => { await this.reload(session, '已读取分组、书架与阅读记录'); });
  }

  owns(owner: ReaderRuntimeOwner): boolean { return this.owner === owner; }

  reconcile(generation: number): void {
    const session = this.session;
    this.enqueue(async (): Promise<void> => {
      if (!this.isCurrentSession(session)) return;
      const receipt = this.latestReceipt;
      const read = this.snapshot.readFacts;
      if (receipt?.facts.generation === generation && receipt.facts.canRetry) {
        this.publishReceipt(session, receipt.receipt.confirmation, 'reading');
        await this.reload(session, '已读取分组、书架与阅读记录');
      } else if (read?.generation === generation && read.canRetry) {
        this.publishIfCurrent(session, { busy: true, readFacts: projectOperationFacts({ phase: 'loading',
          value: this.hasRead ? this.snapshot.data : undefined, generation: ++bookshelfManagementGeneration }) });
        await this.reload(session, '已读取分组、书架与阅读记录');
      }
    });
  }

  updateGroupName(value: string): void {
    if (value.length <= 256) this.publish({ groupNameDraft: value });
  }

  updateGroupOrder(value: string): void {
    if (/^-?\d{0,9}$/.test(value)) this.publish({ groupOrderDraft: value });
  }

  selectGroup(groupId: number): void {
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

  clearGroupEditor(): void {
    this.publish({ selectedGroupId: 0, groupNameDraft: '', groupOrderDraft: '0' });
  }

  saveGroup(): void {
    const session = this.session;
    const name = this.snapshot.groupNameDraft;
    let order: number;
    try { order = this.parseOrder(this.snapshot.groupOrderDraft); }
    catch (error) { this.publishReceipt(session, 'undispatched', 'failed', (error as Error).message); return; }
    const selected = this.snapshot.data.groups.find(
      (candidate: BookGroup): boolean => candidate.groupId === this.snapshot.selectedGroupId,
    );
    this.enqueue(async (): Promise<void> => {
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

  toggleGroupShown(groupId: number): void {
    const session = this.session;
    const group = this.snapshot.data.groups.find((candidate: BookGroup): boolean => candidate.groupId === groupId);
    if (group === undefined) return;
    this.enqueue(async (): Promise<void> => {
      this.publishIfCurrent(session, { busy: true, statusMessage: '正在更新分组显示状态…' });
      await this.performWrite(session, async (): Promise<void> => {
        await this.gateway.setGroupShown(group, !group.show);
      }, '分组显示状态已更新');
    });
  }

  deleteGroup(groupId: number): void {
    const session = this.session;
    this.enqueue(async (): Promise<void> => {
      this.publishIfCurrent(session, { busy: true, statusMessage: '正在由 Core 删除分组…' });
      await this.performWrite(session, async (): Promise<void> => {
        await this.gateway.deleteGroup(groupId);
      }, '分组实体已删除；书籍上的同名标签按 Core 原值保留');
    });
  }

  selectBook(sourceId: string, bookId: string): void {
    const book = this.findBook(sourceId, bookId);
    if (book === undefined) return;
    this.publish({
      selectedSourceId: sourceId,
      selectedBookId: bookId,
      assignmentGroupDraft: book.group ?? '',
      statusMessage: `已选择书籍：${book.title}`,
    });
  }

  updateAssignmentGroup(value: string): void {
    if (value.length <= 256) this.publish({ assignmentGroupDraft: value });
  }

  assignSelectedBook(): void {
    const session = this.session;
    const book = this.findBook(this.snapshot.selectedSourceId, this.snapshot.selectedBookId);
    if (book === undefined) return;
    const group = this.snapshot.assignmentGroupDraft;
    this.enqueue(async (): Promise<void> => {
      this.publishIfCurrent(session, { busy: true, statusMessage: '正在由 Core 分配书架分组…' });
      await this.performWrite(session, async (): Promise<void> => {
        await this.gateway.assignGroup(book, group);
      }, group.trim().length === 0 ? '已清除书籍分组' : `已分配到：${group.trim()}`);
    });
  }

  private async performWrite(session: number, operation: () => Promise<void>, status: string,
    clearDraft: boolean = false): Promise<void> {
    const evidence = new ReaderWriteEvidence();
    this.gateway.observeWrites(evidence);
    try { await operation(); }
    catch (error) { this.publishReceipt(session, evidence.confirmation(), 'failed', (error as Error).message); return; }
    finally { this.gateway.observeWrites(undefined); }
    this.publishReceipt(session, evidence.confirmation(), 'reading');
    if (await this.reload(session, status) && clearDraft) {
      this.publishIfCurrent(session, { selectedGroupId: 0, groupNameDraft: '', groupOrderDraft: '0' });
    }
  }

  private async reload(session: number, statusMessage: string): Promise<boolean> {
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
    this.publishIfCurrent(session, { receipt: this.latestReceipt, busy: readback === 'reading',
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
    if (!ReaderRuntimeOwner.isCurrent(this.owner) || !this.isCurrent()) return;
    this.operationTail = this.operationTail.then(async (): Promise<void> => {
      if (!ReaderRuntimeOwner.isCurrent(this.owner)) return;
      await operation();
    }).catch((error: Error): void => {
      hilog.error(DOMAIN, 'Reader', 'Bookshelf management operation failed: %{private}s', error.message);
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
      busy: patch.busy ?? this.snapshot.busy,
      statusMessage: patch.statusMessage ?? this.snapshot.statusMessage,
      receipt: patch.receipt ?? this.snapshot.receipt,
      readFacts: patch.readFacts ?? this.snapshot.readFacts,
    };
    if (ReaderRuntimeOwner.isCurrent(this.owner) && this.isCurrent()) this.emit(this.copySnapshot(this.snapshot));
  }

  private publishIfCurrent(session: number, patch: BookshelfManagementPatch): void {
    if (this.isCurrentSession(session)) this.publish(patch);
  }

  private fail(session: number, label: string, error: Error): void {
    if (this.isCurrentSession(session)) this.publish({ busy: false, statusMessage: `${label}：${error.message}` });
    hilog.error(DOMAIN, 'Reader', '%{private}s: %{private}s', label, error.message);
  }

  private isCurrentSession(session: number): boolean {
    return ReaderRuntimeOwner.isCurrent(this.owner) && this.isCurrent() && session === this.session;
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
    };
  }
}
