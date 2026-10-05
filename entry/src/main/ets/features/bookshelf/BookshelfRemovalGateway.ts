import type { JsonObject } from '@reader/core-harmony';
import { ReaderRuntimeOwner } from '../../app/ReaderRuntimeOwner';
import { ReaderWriteEvidence } from '../../app/ReaderWriteEvidence';
import { ReaderCoreGateway, type BookshelfRemoveTarget, type BookshelfRemoveBatchReceipt } from '../../app/ReaderCoreGateway';
import { BookshelfManagementIntentStore, type BookshelfManagementMethod, type BookshelfManagementMutationState,
  type BookshelfManagementIntent, isBookshelfRemovalMethod } from './BookshelfManagementIntentStore';
import { BookshelfManagementGateway } from './BookshelfManagementGateway';

/** Two original deletion commands use the same complete intent, Core head,
 * AtomicFile and IO lane as group management. Domain projection and EPUB
 * cleanup remain finite bookshelf responsibilities. */
export class BookshelfRemovalGateway {
  private readonly store: BookshelfManagementIntentStore;
  private readonly core: ReaderCoreGateway;
  constructor(private readonly owner: ReaderRuntimeOwner) {
    this.store = BookshelfManagementIntentStore.forRuntime(owner);
    this.core = new ReaderCoreGateway(owner);
  }
  snapshot(): BookshelfManagementMutationState { return this.store.snapshot(); }

  async remove(targets: BookshelfRemoveTarget[], batch: boolean, evidence: ReaderWriteEvidence,
    confirmed: (count: number) => void): Promise<number> {
    if (targets.length === 0 || (!batch && targets.length !== 1) || targets.some((target: BookshelfRemoveTarget): boolean =>
      typeof target.sourceId !== 'string' || target.sourceId.trim().length === 0 ||
      typeof target.bookId !== 'string' || target.bookId.trim().length === 0)) throw new Error('删除书籍身份无效');
    const method: BookshelfManagementMethod = batch ? 'bookshelf.removeBatch' : 'bookshelf.remove';
    const params: JsonObject = batch ? { targets: targets.map((target: BookshelfRemoveTarget): JsonObject =>
      ({ sourceId: target.sourceId, bookId: target.bookId })) } : { sourceId: targets[0].sourceId, bookId: targets[0].bookId };
    const result = await this.store.execute(method, params,
      (actualMethod: BookshelfManagementMethod, original: JsonObject, data: JsonObject): number =>
        this.qualify(actualMethod, original, data), evidence, (): boolean => ReaderRuntimeOwner.isCurrent(this.owner));
    confirmed(result);
    const id = this.store.snapshot().operationId;
    if (id === undefined) throw new Error('删除原操作标识缺失');
    await this.cleanup(id); return result;
  }

  /** Pure exact historical query. A matching current list is never an ACK;
   * an original group intent is projected as blocked, never executed here. */
  async recover(current: () => boolean, continueOriginal: boolean = false): Promise<BookshelfManagementMutationState> {
    const admitted = (): boolean => ReaderRuntimeOwner.isCurrent(this.owner) && current();
    const state = await this.store.recover((method: BookshelfManagementMethod, params: JsonObject, data: JsonObject): void => {
      if (isBookshelfRemovalMethod(method)) this.qualify(method, params, data);
      else new BookshelfManagementGateway(this.owner, this.store).qualifyOriginal(method, params, data);
    }, admitted, false);
    if (!isBookshelfRemovalMethod(state.method) || !continueOriginal) return state;
    if (!state.canContinueOriginal || !state.blocked) return state;
    const continued = state.confirmation === 'confirmed' ? state : await this.store.recover(
      (method: BookshelfManagementMethod, params: JsonObject, data: JsonObject): void => { this.qualify(method, params, data); }, admitted, true);
    if (continued.confirmation === 'confirmed' && continued.operationId !== undefined) await this.cleanup(continued.operationId, admitted);
    return this.store.snapshot();
  }
  private qualify(method: BookshelfManagementMethod, params: JsonObject, data: JsonObject): number {
    if (method === 'bookshelf.remove') return this.core.qualifyBookRemoval(data) ? 1 : 0;
    if (method === 'bookshelf.removeBatch') {
      const receipt: BookshelfRemoveBatchReceipt = this.core.qualifyBookBatchRemoval(params['targets'] as BookshelfRemoveTarget[], data);
      return receipt.removedTargets.length;
    }
    throw new Error('原操作属于分组管理，不能执行删除或释放资产');
  }
  private async cleanup(operationId: string, current: () => boolean = (): boolean => ReaderRuntimeOwner.isCurrent(this.owner)): Promise<void> {
    await this.store.completeRemoval(operationId, async (intent: BookshelfManagementIntent): Promise<void> => {
      const original = intent.mutation.params;
      const targets: BookshelfRemoveTarget[] = intent.mutation.method === 'bookshelf.remove' ?
        [{ sourceId: original['sourceId'] as string, bookId: original['bookId'] as string }] : original['targets'] as BookshelfRemoveTarget[];
      await this.core.finishBookRemoval(targets, current);
    }, current);
  }
}
