import { hilog } from '@kit.PerformanceAnalysisKit';
import type { ShelfBook } from '../../app/ReaderCoreGateway';
import { ReaderRuntimeOwner } from '../../app/ReaderRuntimeOwner';
import {
  BookshelfManagementGateway,
  type BookGroup,
  type BookshelfManagementData,
} from './BookshelfManagementGateway';

const DOMAIN = 0x5244;

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
}

/** Serial coordinator; Core remains the sole owner of groups, membership and records. */
export class BookshelfManagementOrchestrator {
  private readonly gateway: BookshelfManagementGateway;
  private readonly emit: (snapshot: BookshelfManagementSnapshot) => void;
  private readonly isCurrent: () => boolean;
  private snapshot: BookshelfManagementSnapshot = EMPTY_BOOKSHELF_MANAGEMENT_SNAPSHOT;
  private operationTail: Promise<void> = Promise.resolve();
  private session: number = 0;

  constructor(
    emit: (snapshot: BookshelfManagementSnapshot) => void,
    isCurrent: () => boolean,
    owner: ReaderRuntimeOwner = ReaderRuntimeOwner.current(),
  ) {
    this.gateway = new BookshelfManagementGateway(owner);
    this.emit = emit;
    this.isCurrent = isCurrent;
  }

  open(): void {
    this.session += 1;
    const session = this.session;
    this.snapshot = this.copySnapshot(EMPTY_BOOKSHELF_MANAGEMENT_SNAPSHOT);
    this.publish({ busy: true, statusMessage: '正在读取 Core 书架数据…' });
    this.enqueue(async (): Promise<void> => this.reload(session, '已读取分组、书架与阅读记录'));
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
    const order = this.parseOrder(this.snapshot.groupOrderDraft);
    const selected = this.snapshot.data.groups.find(
      (candidate: BookGroup): boolean => candidate.groupId === this.snapshot.selectedGroupId,
    );
    this.enqueue(async (): Promise<void> => {
      this.publishIfCurrent(session, { busy: true, statusMessage: '正在由 Core 保存分组…' });
      try {
        if (selected === undefined) {
          await this.gateway.createGroup(name, order);
        } else {
          await this.gateway.updateGroup(selected, name, order);
        }
        await this.reload(session, selected === undefined ? '分组已创建' : '分组已更新');
        this.publishIfCurrent(session, { selectedGroupId: 0, groupNameDraft: '', groupOrderDraft: '0' });
      } catch (error) {
        this.fail(session, '分组保存失败', error as Error);
      }
    });
  }

  toggleGroupShown(groupId: number): void {
    const session = this.session;
    const group = this.snapshot.data.groups.find((candidate: BookGroup): boolean => candidate.groupId === groupId);
    if (group === undefined) return;
    this.enqueue(async (): Promise<void> => {
      this.publishIfCurrent(session, { busy: true, statusMessage: '正在更新分组显示状态…' });
      try {
        await this.gateway.setGroupShown(group, !group.show);
        await this.reload(session, '分组显示状态已更新');
      } catch (error) {
        this.fail(session, '分组状态更新失败', error as Error);
      }
    });
  }

  deleteGroup(groupId: number): void {
    const session = this.session;
    this.enqueue(async (): Promise<void> => {
      this.publishIfCurrent(session, { busy: true, statusMessage: '正在由 Core 删除分组…' });
      try {
        await this.gateway.deleteGroup(groupId);
        await this.reload(session, '分组实体已删除；书籍上的同名标签按 Core 原值保留');
      } catch (error) {
        this.fail(session, '分组删除失败', error as Error);
      }
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
      try {
        await this.gateway.assignGroup(book, group);
        await this.reload(session, group.trim().length === 0 ? '已清除书籍分组' : `已分配到：${group.trim()}`);
      } catch (error) {
        this.fail(session, '书籍分组失败', error as Error);
      }
    });
  }

  private async reload(session: number, statusMessage: string): Promise<void> {
    try {
      const data = await this.gateway.load();
      if (this.isCurrentSession(session)) {
        this.publish({ data, busy: false, statusMessage });
      }
    } catch (error) {
      this.fail(session, '书架管理数据读取失败', error as Error);
    }
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
    this.operationTail = this.operationTail.then(operation).catch((error: Error): void => {
      hilog.error(DOMAIN, 'Reader', 'Bookshelf management operation failed: %{public}s', error.message);
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
    };
    if (this.isCurrent()) this.emit(this.copySnapshot(this.snapshot));
  }

  private publishIfCurrent(session: number, patch: BookshelfManagementPatch): void {
    if (this.isCurrentSession(session)) this.publish(patch);
  }

  private fail(session: number, label: string, error: Error): void {
    if (this.isCurrentSession(session)) this.publish({ busy: false, statusMessage: `${label}：${error.message}` });
    hilog.error(DOMAIN, 'Reader', '%{public}s: %{public}s', label, error.message);
  }

  private isCurrentSession(session: number): boolean {
    return this.isCurrent() && session === this.session;
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
    };
  }
}
