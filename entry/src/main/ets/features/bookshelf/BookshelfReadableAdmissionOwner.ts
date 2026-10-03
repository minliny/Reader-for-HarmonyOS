import { ReaderRuntimeOwner } from '../../app/ReaderRuntimeOwner';
import { ReaderCoreGateway, type BookshelfAddReceipt, type ShelfBookUpsert } from '../../app/ReaderCoreGateway';
import { ReaderCoreRequestError } from '@reader/core-harmony';

export interface BookshelfReadableAdmissionSnapshot {
  key: string;
  generation: number;
  adding: boolean;
  cancelling: boolean;
  message: string;
  confirmation: 'none' | 'confirmed' | 'unknown' | 'rejected';
  receipt?: BookshelfAddReceipt;
  membership?: boolean;
}
export const EMPTY_READABLE_ADMISSION: BookshelfReadableAdmissionSnapshot = {
  key: '', generation: 0, adding: false, cancelling: false, message: '', confirmation: 'none',
};
interface ReadableAdmissionTask {
  snapshot: BookshelfReadableAdmissionSnapshot;
  addPending: boolean;
  cancelPending: boolean;
  cancelUnconfirmed: boolean;
  addUnconfirmed: boolean;
  cancelConfirmed: boolean;
}
export interface BookshelfReadableAdmissionEffect {
  snapshot: BookshelfReadableAdmissionSnapshot;
  duplicate: boolean;
}
let nextReadableAdmission: number = 0;

/** Button/cancellation coordination only. BookAcquisitionCoordinator remains
 * the sole durable preparation owner. A shelf read is current membership,
 * never an acknowledgement of this accepted add. */
export class BookshelfReadableAdmissionOwner {
  private readonly tasks: Map<string, ReadableAdmissionTask> = new Map();
  private readonly subscribers: Set<(snapshots: BookshelfReadableAdmissionSnapshot[]) => void> = new Set();
  constructor(private readonly owner: ReaderRuntimeOwner) {}
  owns(owner: ReaderRuntimeOwner): boolean { return owner === this.owner; }
  current(): BookshelfReadableAdmissionSnapshot[] { return Array.from(this.tasks.values()).map((task): BookshelfReadableAdmissionSnapshot => task.snapshot); }
  subscribe(emit: (snapshots: BookshelfReadableAdmissionSnapshot[]) => void): () => void {
    this.subscribers.add(emit); return (): void => { this.subscribers.delete(emit); };
  }
  find(sourceId: string, bookId: string): BookshelfReadableAdmissionSnapshot | undefined { return this.tasks.get(this.key(sourceId, bookId))?.snapshot; }

  async add(book: ShelfBookUpsert, admitted: () => boolean,
    completed: (effect: BookshelfReadableAdmissionEffect) => void): Promise<void> {
    if (!this.live() || !this.allowed(admitted) || book.sourceId === 'local') return;
    const key = this.key(book.sourceId, book.bookId);
    const previous = this.tasks.get(key);
    if (previous !== undefined && (previous.addPending || previous.cancelPending || previous.cancelUnconfirmed || previous.addUnconfirmed)) return;
    const active = Array.from(this.tasks.values()).filter((task): boolean => task.addPending || task.cancelPending || task.cancelUnconfirmed || task.addUnconfirmed);
    if (active.length >= 16) {
      const capacity: ReadableAdmissionTask = {snapshot: { ...EMPTY_READABLE_ADMISSION, key, generation: ++nextReadableAdmission,
        message: '加入书架未完成：正在准备的书籍较多，请稍后重试' }, addPending: false, cancelPending: false,
        cancelUnconfirmed: false, addUnconfirmed: false, cancelConfirmed: false};
      this.tasks.set(key, capacity); this.effect(capacity, false, admitted, completed); this.trim(); return;
    }
    const task: ReadableAdmissionTask = {snapshot: { ...EMPTY_READABLE_ADMISSION, key, generation: ++nextReadableAdmission, adding: true },
      addPending: true, cancelPending: false, cancelUnconfirmed: false, addUnconfirmed: false, cancelConfirmed: false};
    this.tasks.set(key, task); this.publish();
    try {
      // A synchronous page publication may retire the originating intent.
      if (!this.live() || !this.allowed(admitted)) return;
      const receipt = await new ReaderCoreGateway(this.owner).upsertBook(book);
      task.snapshot = { ...task.snapshot, receipt, confirmation: 'confirmed', membership: true, message: '' };
      task.addUnconfirmed = false;
      this.effect(task, false, admitted, completed);
    } catch (error) {
      // Generic throws do not prove whether durable admission was dispatched.
      // No automatic replay or compensating remove is performed.
      if (task.snapshot.receipt === undefined) task.snapshot = { ...task.snapshot, confirmation: 'unknown' };
      if (!task.cancelPending && !task.cancelConfirmed && !task.cancelUnconfirmed) {
        const duplicate = error instanceof ReaderCoreRequestError && error.event.error.code === 'BOOK_ALREADY_ON_SHELF';
        const rejected = duplicate;
        task.addUnconfirmed = !rejected;
        task.snapshot = { ...task.snapshot, confirmation: rejected ? 'rejected' : 'unknown', message: duplicate ? '这本书已加入书架，请从书架打开已有书籍后换源。' : `加入书架未完成：${(error as Error).message}` };
        this.effect(task, duplicate, admitted, completed);
      }
    } finally {
      task.addPending = false; this.update(task); this.trim(); this.publish();
    }
  }

  async cancel(sourceId: string, bookId: string, admitted: () => boolean,
    completed: (effect: BookshelfReadableAdmissionEffect) => void): Promise<void> {
    const task = this.tasks.get(this.key(sourceId, bookId));
    if (!this.live() || !this.allowed(admitted) || task === undefined || task.cancelPending || task.cancelConfirmed ||
      (!task.addPending && !task.cancelUnconfirmed && !task.addUnconfirmed)) return;
    task.cancelPending = true; task.cancelUnconfirmed = true;
    task.snapshot = { ...task.snapshot, generation: ++nextReadableAdmission, message: '' }; this.update(task); this.publish();
    try {
      if (!this.live() || !this.allowed(admitted)) return;
      await this.owner.bookAcquisitions().cancelReadableBook(sourceId, bookId);
      if (!this.live() || !this.allowed(admitted)) return;
      const saved = await new ReaderCoreGateway(this.owner).loadShelfBook(sourceId, bookId, (): boolean => this.live() && this.allowed(admitted));
      // Membership is a separate observed fact. A matching pre-existing row
      // never creates an add receipt or finalizes a pending preparation.
      task.cancelConfirmed = true; task.cancelUnconfirmed = false; task.addUnconfirmed = false;
      task.snapshot = { ...task.snapshot, membership: saved !== undefined,
        message: saved === undefined ? '已取消加入书架' : '' };
      this.effect(task, false, admitted, completed);
    } catch (error) {
      task.snapshot = { ...task.snapshot, message: `取消状态未确认，请重试：${(error as Error).message}` };
      this.effect(task, false, admitted, completed);
    } finally {
      task.cancelPending = false; this.update(task); this.trim(); this.publish();
    }
  }

  private update(task: ReadableAdmissionTask): void {
    task.snapshot = { ...task.snapshot, adding: task.addPending || task.cancelUnconfirmed || task.addUnconfirmed, cancelling: task.cancelPending };
  }
  private effect(task: ReadableAdmissionTask, duplicate: boolean, admitted: () => boolean,
    completed: (effect: BookshelfReadableAdmissionEffect) => void): void {
    this.update(task); this.publish();
    if (this.live() && this.allowed(admitted)) { try { completed({snapshot: task.snapshot, duplicate}); } catch (_presentation) {} }
  }
  private publish(): void {
    if (!this.live()) return;
    const snapshots = this.current();
    this.subscribers.forEach((emit): void => { try { emit(snapshots); } catch (_presentation) {} });
  }
  private trim(): void {
    // Active accepted work is never evicted. Only the latest 32 settled button
    // snapshots survive in this feature-local exact Runtime lane.
    const settled = Array.from(this.tasks.entries()).filter((entry): boolean => !entry[1].addPending && !entry[1].cancelPending && !entry[1].cancelUnconfirmed && !entry[1].addUnconfirmed);
    for (let index = 0; index < settled.length - 32; index += 1) this.tasks.delete(settled[index][0]);
  }
  private allowed(admitted: () => boolean): boolean { try { return admitted(); } catch (_retired) { return false; } }
  private live(): boolean { return ReaderRuntimeOwner.isCurrent(this.owner); }
  private key(sourceId: string, bookId: string): string { return `${sourceId}\u0000${bookId}`; }
}
