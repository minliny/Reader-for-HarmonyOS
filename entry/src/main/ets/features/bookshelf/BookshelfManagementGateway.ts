import type { JsonObject } from '@reader/core-harmony';
import { ReaderCoreGateway, type ShelfBook } from '../../app/ReaderCoreGateway';
import { ReaderRuntimeOwner } from '../../app/ReaderRuntimeOwner';
import type { ReaderWriteEvidence } from '../../app/ReaderWriteEvidence';
import { BookshelfManagementIntentStore, type BookshelfManagementMethod, type BookshelfManagementMutationState } from './BookshelfManagementIntentStore';

export interface BookGroup {
  groupId: number;
  groupName: string;
  order: number;
  enableRefresh: boolean;
  show: boolean;
}

export interface ShelfReadRecord {
  deviceId: string;
  bookName: string;
  readTime: number;
  lastRead: number;
}

export interface BookshelfManagementData {
  groups: BookGroup[];
  books: ShelfBook[];
  records: ShelfReadRecord[];
  totalReadTime: number;
  latestReadAt: number;
}

/** Core-only data boundary for Legado-style groups, assignment and read records. */
export class BookshelfManagementGateway {
  private readonly owner: ReaderRuntimeOwner;
  private readonly shelf: ReaderCoreGateway;
  private writeEvidence: ReaderWriteEvidence | undefined;
  private readonly intents: BookshelfManagementIntentStore;

  private admitted: (() => boolean) | undefined;
  observeWrites(evidence: ReaderWriteEvidence | undefined, admitted?: () => boolean): void {
    this.writeEvidence = evidence; this.admitted = admitted;
  }
  constructor(owner: ReaderRuntimeOwner = ReaderRuntimeOwner.current(), intents?: BookshelfManagementIntentStore) {
    this.owner = owner;
    this.shelf = new ReaderCoreGateway(owner);
    this.intents = intents ?? BookshelfManagementIntentStore.forRuntime(owner);
  }
  mutationSnapshot(): BookshelfManagementMutationState { return this.intents.snapshot(); }
  qualifyOriginal(method: BookshelfManagementMethod, params: JsonObject, data: JsonObject): void {
    this.qualifyMutation(method, params, data);
  }
  async recoverWrites(admitted: () => boolean, continueOriginal: boolean = false): Promise<BookshelfManagementMutationState> {
    const qualify = (method: BookshelfManagementMethod, params: JsonObject, data: JsonObject): void => {
      this.qualifyMutation(method, params, data);
    };
    const state = await this.intents.recover(qualify, admitted, false);
    if (continueOriginal && state.method !== 'bookshelf.remove' && state.method !== 'bookshelf.removeBatch')
      return this.intents.recover(qualify, admitted, true);
    return state;
  }
  private async write(method: BookshelfManagementMethod, params: JsonObject): Promise<{ data: JsonObject }> {
    const evidence = this.writeEvidence, admitted = this.admitted;
    const data = await this.intents.execute(method, params,
      (originalMethod: BookshelfManagementMethod, original: JsonObject, result: JsonObject): JsonObject => {
        this.qualifyMutation(originalMethod, original, result); return result;
      }, evidence, (): boolean => ReaderRuntimeOwner.isCurrent(this.owner) && (admitted?.() ?? true));
    return { data };
  }
  private qualifyMutation(method: BookshelfManagementMethod, params: JsonObject, data: JsonObject): void {
    if (method === 'book-group.create' || method === 'book-group.update') {
      const group = this.decodeGroup(this.requiredObject(data, 'group', method));
      if (method === 'book-group.update' && group.groupId !== params['groupId']) throw new Error('分组原回执实体不符');
      if (params['groupName'] !== undefined && group.groupName !== params['groupName']) throw new Error('分组原回执名称不符');
      if (params['order'] !== undefined && group.order !== params['order']) throw new Error('分组原回执顺序不符');
      if (params['enableRefresh'] !== undefined && group.enableRefresh !== params['enableRefresh']) throw new Error('分组原回执刷新选项不符');
      if (params['show'] !== undefined && group.show !== params['show']) throw new Error('分组原回执显示选项不符');
      return;
    }
    if (method === 'book-group.delete') {
      if (typeof data['deleted'] !== 'boolean' || data['groupId'] !== params['groupId']) throw new Error('分组原删除回执不符');
      return;
    }
    if (method === 'bookshelf.remove') { this.shelf.qualifyBookRemoval(data); return; }
    if (method === 'bookshelf.removeBatch') {
      this.shelf.qualifyBookBatchRemoval(params['targets'] as { sourceId: string; bookId: string }[], data); return;
    }
    const book = this.decodeShelfBook(this.requiredObject(data, 'book', method));
    if (book.sourceId !== params['sourceId'] || book.bookId !== params['bookId'] || (book.group ?? '').trim() !== params['group'])
      throw new Error('原分组分配回执与完整书籍/分组不符');
  }

  async load(): Promise<BookshelfManagementData> {
    const [groupResult, recordResult, shelf] = await Promise.all([
      this.owner.request('book-group.list', {}),
      this.owner.request('read-record.list', {}),
      this.shelf.loadBookshelf({ sortBy: 'manual', sortDirection: 'ascending' }),
    ]);
    const groups = this.decodeGroups(groupResult.data['groups']);
    const records = this.decodeRecords(recordResult.data['records']);
    let totalReadTime = 0;
    let latestReadAt = 0;
    for (const record of records) {
      totalReadTime += record.readTime;
      latestReadAt = Math.max(latestReadAt, record.lastRead);
    }
    if (!Number.isSafeInteger(totalReadTime)) {
      throw new Error('read-record.list total read time exceeds safe integer range');
    }
    return { groups, books: shelf.books, records, totalReadTime, latestReadAt };
  }

  async createGroup(groupName: string, order: number): Promise<BookGroup> {
    const normalizedName = this.requireGroupName(groupName);
    this.requireInteger(order, 'book-group.create order');
    const result = await this.write('book-group.create', {
      groupName: normalizedName,
      order,
      enableRefresh: true,
      show: true,
    });
    const created = this.decodeGroup(this.requiredObject(result.data, 'group', 'book-group.create'));
    return created;
  }

  async updateGroup(group: BookGroup, groupName: string, order: number): Promise<BookGroup> {
    this.requireInteger(group.groupId, 'book-group.update groupId');
    this.requireInteger(order, 'book-group.update order');
    const normalizedName = this.requireGroupName(groupName);
    const result = await this.write('book-group.update', {
      groupId: group.groupId,
      groupName: normalizedName,
      order,
      enableRefresh: group.enableRefresh,
      show: group.show,
    });
    const updated = this.decodeGroup(this.requiredObject(result.data, 'group', 'book-group.update'));
    if (updated.groupId !== group.groupId) {
      throw new Error('book-group.update returned a mismatched group id');
    }
    return updated;
  }

  async setGroupShown(group: BookGroup, shown: boolean): Promise<BookGroup> {
    const result = await this.write('book-group.update', {
      groupId: group.groupId,
      show: shown,
    });
    const updated = this.decodeGroup(this.requiredObject(result.data, 'group', 'book-group.update'));
    if (updated.groupId !== group.groupId || updated.show !== shown) {
      throw new Error('book-group.update returned inconsistent visibility');
    }
    return updated;
  }

  async deleteGroup(groupId: number): Promise<boolean> {
    this.requireInteger(groupId, 'book-group.delete groupId');
    const result = await this.write('book-group.delete', { groupId });
    const deleted = result.data['deleted'];
    const echoedId = result.data['groupId'];
    if (typeof deleted !== 'boolean' || echoedId !== groupId) {
      throw new Error('book-group.delete returned invalid data');
    }
    return deleted;
  }

  async assignGroup(book: ShelfBook, group: string): Promise<ShelfBook> {
    const result = await this.write('bookshelf.group.assign', {
      sourceId: book.sourceId,
      bookId: book.bookId,
      group: group.trim(),
    });
    const updated = this.decodeShelfBook(
      this.requiredObject(result.data, 'book', 'bookshelf.group.assign'),
    );
    if (updated.sourceId !== book.sourceId || updated.bookId !== book.bookId || (updated.group ?? '').trim() !== group.trim()) {
      throw new Error('bookshelf.group.assign returned a mismatched composite identity');
    }
    return updated;
  }

  private decodeGroups(value: unknown): BookGroup[] {
    if (!Array.isArray(value)) {
      throw new Error('book-group.list returned invalid groups');
    }
    return value.map((item: unknown): BookGroup => this.decodeGroup(item));
  }

  private decodeGroup(value: unknown): BookGroup {
    const object = this.requireObjectValue(value, 'book group');
    return {
      groupId: this.requiredInteger(object, 'groupId', 'book group'),
      groupName: this.requiredString(object, 'groupName', 'book group'),
      order: this.requiredInteger(object, 'order', 'book group'),
      enableRefresh: this.requiredBoolean(object, 'enableRefresh', 'book group'),
      show: this.requiredBoolean(object, 'show', 'book group'),
    };
  }

  private decodeRecords(value: unknown): ShelfReadRecord[] {
    if (!Array.isArray(value)) {
      throw new Error('read-record.list returned invalid records');
    }
    return value.map((item: unknown): ShelfReadRecord => {
      const object = this.requireObjectValue(item, 'read record');
      return {
        deviceId: this.requiredString(object, 'deviceId', 'read record'),
        bookName: this.requiredString(object, 'bookName', 'read record'),
        readTime: this.requiredNonNegativeInteger(object, 'readTime', 'read record'),
        lastRead: this.requiredNonNegativeInteger(object, 'lastRead', 'read record'),
      };
    });
  }

  private decodeShelfBook(object: JsonObject): ShelfBook {
    const decoded: ShelfBook = {
      sourceId: this.requiredString(object, 'sourceId', 'shelf book'),
      bookId: this.requiredString(object, 'bookId', 'shelf book'),
      title: this.requiredString(object, 'title', 'shelf book'),
      author: this.requiredString(object, 'author', 'shelf book'),
      addedAt: this.requiredNonNegativeInteger(object, 'addedAt', 'shelf book'),
      sortIndex: this.requiredInteger(object, 'sortIndex', 'shelf book'),
    };
    const group = this.optionalString(object, 'group', 'shelf book');
    const coverUrl = this.optionalString(object, 'coverUrl', 'shelf book');
    const intro = this.optionalString(object, 'intro', 'shelf book');
    const lastChapter = this.optionalString(object, 'lastChapter', 'shelf book');
    const lastReadAt = this.optionalInteger(object, 'lastReadAt', 'shelf book');
    if (group !== undefined) decoded.group = group;
    if (coverUrl !== undefined) decoded.coverUrl = coverUrl;
    if (intro !== undefined) decoded.intro = intro;
    if (lastChapter !== undefined) decoded.lastChapter = lastChapter;
    if (lastReadAt !== undefined) decoded.lastReadAt = lastReadAt;
    return decoded;
  }

  private requireGroupName(value: string): string {
    const normalized = value.trim();
    if (normalized.length === 0 || normalized.length > 256) {
      throw new Error('分组名不能为空且不得超过 256 字符');
    }
    return normalized;
  }

  private requiredObject(object: JsonObject, field: string, label: string): JsonObject {
    return this.requireObjectValue(object[field], `${label}.${field}`);
  }

  private requireObjectValue(value: unknown, label: string): JsonObject {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new Error(`${label} must be an object`);
    }
    return value as JsonObject;
  }

  private requiredString(object: JsonObject, field: string, label: string): string {
    const value = object[field];
    if (typeof value !== 'string') {
      throw new Error(`${label}.${field} must be a string`);
    }
    return value;
  }

  private optionalString(object: JsonObject, field: string, label: string): string | undefined {
    const value = object[field];
    if (value === undefined || value === null) return undefined;
    if (typeof value !== 'string') throw new Error(`${label}.${field} must be a string`);
    return value;
  }

  private requiredBoolean(object: JsonObject, field: string, label: string): boolean {
    const value = object[field];
    if (typeof value !== 'boolean') throw new Error(`${label}.${field} must be a boolean`);
    return value;
  }

  private requiredInteger(object: JsonObject, field: string, label: string): number {
    const value = object[field];
    if (typeof value !== 'number') throw new Error(`${label}.${field} must be a number`);
    this.requireInteger(value, `${label}.${field}`);
    return value;
  }

  private requiredNonNegativeInteger(object: JsonObject, field: string, label: string): number {
    const value = this.requiredInteger(object, field, label);
    if (value < 0) throw new Error(`${label}.${field} must be non-negative`);
    return value;
  }

  private optionalInteger(object: JsonObject, field: string, label: string): number | undefined {
    const value = object[field];
    if (value === undefined || value === null) return undefined;
    if (typeof value !== 'number') throw new Error(`${label}.${field} must be a number`);
    this.requireInteger(value, `${label}.${field}`);
    return value;
  }

  private requireInteger(value: number, label: string): void {
    if (!Number.isSafeInteger(value)) throw new Error(`${label} must be a safe integer`);
  }
}
