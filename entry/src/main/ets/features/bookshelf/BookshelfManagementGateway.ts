import type { JsonObject } from '@reader/core-harmony';
import { ReaderCoreGateway, type ShelfBook } from '../../app/ReaderCoreGateway';
import { ReaderRuntimeOwner } from '../../app/ReaderRuntimeOwner';

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

  constructor(owner: ReaderRuntimeOwner = ReaderRuntimeOwner.current()) {
    this.owner = owner;
    this.shelf = new ReaderCoreGateway(owner);
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
    const result = await this.owner.request('book-group.create', {
      groupName: normalizedName,
      order,
      enableRefresh: true,
      show: true,
    });
    return this.decodeGroup(this.requiredObject(result.data, 'group', 'book-group.create'));
  }

  async updateGroup(group: BookGroup, groupName: string, order: number): Promise<BookGroup> {
    this.requireInteger(group.groupId, 'book-group.update groupId');
    this.requireInteger(order, 'book-group.update order');
    const result = await this.owner.request('book-group.update', {
      groupId: group.groupId,
      groupName: this.requireGroupName(groupName),
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
    const result = await this.owner.request('book-group.update', {
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
    const result = await this.owner.request('book-group.delete', { groupId });
    const deleted = result.data['deleted'];
    const echoedId = result.data['groupId'];
    if (typeof deleted !== 'boolean' || echoedId !== groupId) {
      throw new Error('book-group.delete returned invalid data');
    }
    return deleted;
  }

  async assignGroup(book: ShelfBook, group: string): Promise<ShelfBook> {
    const result = await this.owner.request('bookshelf.group.assign', {
      sourceId: book.sourceId,
      bookId: book.bookId,
      group: group.trim(),
    });
    const updated = this.decodeShelfBook(
      this.requiredObject(result.data, 'book', 'bookshelf.group.assign'),
    );
    if (updated.sourceId !== book.sourceId || updated.bookId !== book.bookId) {
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
