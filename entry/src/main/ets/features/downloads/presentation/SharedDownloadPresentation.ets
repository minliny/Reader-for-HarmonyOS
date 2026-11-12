import hilog from '@ohos.hilog';
import { errorMessageOf } from '../../../app/ErrorMessage';
import type { ReaderRecoveryView } from '../../../ui/feedback/ReaderRecoveryView';
import type { ReaderRuntimeOwner } from '../../../app/ReaderRuntimeOwner';
import type { ShelfBook } from '../../../app/ReaderCoreGateway';
import { RemoteReadingFlowGateway, type RemoteReadingBookSeed, type RemoteReadingSession } from '../../reading/application/RemoteReadingFlowGateway';
import { readingOfflineFailureHint } from '../../reading/presentation/ReadingOfflineFailurePresentation';
import { SharedDownloadHost, withoutDownloadStorageSummary, type SharedDownloadSnapshot, type SharedDownloadBookAction,
  type SharedDownloadBatchReceipt } from '../application/SharedDownloadHost';
import type { SharedDownloadStoragePolicyResult } from '../application/SharedDownloadStorageGateway';
import type { SharedDownloadExpectedChapter } from '../application/SharedDownloadCoordinator';
import { SharedDownloadActionTarget, canCleanDownloadStorage, formatDownloadStorageBytes, type DownloadBookView,
  type DownloadReadingTarget } from './SharedDownloadProjection';
import type { SharedDownloadOpeningIntent, SharedDownloadReadingControl, SharedDownloadReadingFocus,
  SharedDownloadReturnState, SharedDownloadUiIntent, SharedDownloadViewState } from './SharedDownloadUiContract';

const DOMAIN = 0x5244;

export interface DownloadReadingEntry {
  shelfBook: ShelfBook;
  chapterIndex: number;
  mangaOfflineChapterId?: string;
  seed?: RemoteReadingBookSeed;
  sourceLabel: string;
  session?: RemoteReadingSession;
}

interface SharedDownloadOpening {
  owner: ReaderRuntimeOwner;
  identity: string;
  isRouteCurrent: () => boolean;
}

interface DownloadBatchObservation {
  action: SharedDownloadBookAction;
  targets: SharedDownloadActionTarget[];
}

/** Owns the active view and its in-process return state. SharedDownloadHost
 * and the runtime continue to own readback and accepted operations. */
@Observed
export class SharedDownloadPresentation {
  snapshot: SharedDownloadSnapshot = { books: [], loading: false, error: '', storageSummary: {} };
  identity: string = '';
  storagePolicyBusy: boolean = false;
  storageCleanupBusy: boolean = false;
  batchRecovery: ReaderRecoveryView = { message: '', visible: false, canRetry: false, generation: 0 };
  private batchOwner: ReaderRuntimeOwner | undefined;
  private batchObservations: DownloadBatchObservation[] = [];
  private storagePolicyWrite: SharedDownloadOpening | undefined;
  private storageCleanupWrite: SharedDownloadOpening | undefined;
  private storageCleanupRevision: number = 0;
  private opening: SharedDownloadOpening | undefined;
  private host: SharedDownloadHost | undefined;
  private retainedSnapshot: SharedDownloadSnapshot | undefined;
  private retainedOwner: ReaderRuntimeOwner | undefined;
  private membershipRevision: number = 0;
  private readingRequestRevision: number = 0;
  private readingFocus: SharedDownloadReadingFocus | undefined;
  private view: SharedDownloadViewState = { query: '', type: 'all', state: 'all',
    sourceId: 'all', sort: 'recent', direction: 'desc', listScroll: 0, detailKey: '' };

  isCurrent(identity: string): boolean {
    const opening = this.opening;
    return opening !== undefined && identity.length > 0 && opening.identity === identity && opening.isRouteCurrent();
  }

  open(owner: ReaderRuntimeOwner, identity: string, isRouteCurrent: () => boolean, intent: SharedDownloadOpeningIntent,
    readingBook: ShelfBook | undefined,
    feedback: (message: string) => void): void {
    const opening: SharedDownloadOpening = { owner, identity, isRouteCurrent };
    if (this.batchOwner !== owner) this.resetBatchRecovery(owner);
    this.opening = opening;
    if (intent.kind !== 'resume') this.readingFocus = undefined;
    this.storagePolicyBusy = this.storagePolicyWrite?.owner === owner;
    this.storageCleanupBusy = this.storageCleanupWrite?.owner === owner;
    if (intent.kind !== 'resume' && (intent.kind === 'fresh' || intent.detailKey.length > 0)) {
      const view = this.copyView(this.view);
      if (view.detailKey !== intent.detailKey) view.chapterScroll = 0;
      view.detailKey = intent.detailKey;
      this.view = view;
    }
    const retained = intent.kind === 'resume' && this.retainedOwner === owner && this.retainedSnapshot?.loading === false ?
      this.retainedSnapshot : undefined;
    if (retained === undefined) {
      this.retainedSnapshot = undefined;
      this.retainedOwner = undefined;
    }
    this.snapshot = retained ?? { books: [], loading: true, error: '', storageSummary: {} };
    const current = (): boolean => this.opening === opening && isRouteCurrent();
    const host = new SharedDownloadHost(owner, (snapshot: SharedDownloadSnapshot): void => {
      if (!current() || this.host !== host) return;
      this.retainedSnapshot = snapshot;
      this.retainedOwner = owner;
      this.snapshot = snapshot;
    });
    this.host = host;
    this.identity = identity;
    if (retained === undefined) {
      void host.reload(current);
    } else {
      host.resume(retained, current);
      if (retained.storageSummary.cleanableBytes === undefined && !this.storageCleanupBusy)
        void host.refreshStorageSummary(current);
      if (readingBook !== undefined) {
        void host.refreshReadingMetadata(readingBook.sourceId, readingBook.bookId, current).catch((): void => {
          if (current() && this.host === host) feedback('阅读位置暂未刷新，请稍后重试');
        });
      }
    }
  }

  retire(): void {
    this.opening = undefined;
    this.host?.retire();
    this.host = undefined;
    this.identity = '';
  }

  dispose(): void {
    this.retire();
    this.resetBatchRecovery();
    this.readingFocus = undefined;
    this.retainedSnapshot = undefined;
    this.retainedOwner = undefined;
  }

  initialView(): SharedDownloadViewState { return this.view; }

  takeReadingFocus(identity: string): SharedDownloadReadingFocus | undefined {
    if (!this.isCurrent(identity)) return undefined;
    const focus = this.readingFocus;
    this.readingFocus = undefined;
    return focus?.bookKey === this.view.detailKey ? focus : undefined;
  }

  updateView(identity: string, view: SharedDownloadViewState): void {
    if (this.isCurrent(identity)) this.view = view;
  }

  captureReturn(owner: ReaderRuntimeOwner): SharedDownloadReturnState {
    return { view: this.copyView(this.view), readingFocus: this.readingFocus, membershipRevision: this.membershipRevision,
      storageCleanupRevision: this.storageCleanupRevision,
      snapshot: this.retainedOwner === owner ? this.retainedSnapshot : undefined };
  }

  restoreReturn(owner: ReaderRuntimeOwner, state: SharedDownloadReturnState): void {
    this.view = this.copyView(state.view);
    this.readingFocus = state.readingFocus;
    const retained = state.membershipRevision === this.membershipRevision ? state.snapshot : undefined;
    this.retainedSnapshot = retained !== undefined && state.storageCleanupRevision !== this.storageCleanupRevision ?
      withoutDownloadStorageSummary(retained) : retained;
    this.retainedOwner = this.retainedSnapshot === undefined ? undefined : owner;
  }

  invalidateMembership(): void {
    this.membershipRevision += 1;
    this.retainedSnapshot = undefined;
    this.retainedOwner = undefined;
  }

  private copyView(view: SharedDownloadViewState): SharedDownloadViewState {
    return { query: view.query, type: view.type, state: view.state, sourceId: view.sourceId, sort: view.sort,
      direction: view.direction, listScroll: view.listScroll, chapterScroll: view.chapterScroll, detailKey: view.detailKey };
  }

  refresh(identity: string): void {
    if (this.isCurrent(identity)) void this.host?.reload((): boolean => this.isCurrent(identity));
  }

  refreshBatchRecovery(identity: string, generation: number): void {
    if (!this.batchRecovery.visible || generation !== this.batchRecovery.generation || this.snapshot.loading) return;
    this.refresh(identity);
  }

  refreshBook(identity: string, book: DownloadBookView): void {
    if (this.isCurrent(identity)) void this.host?.refreshBook(book, (): boolean => this.isCurrent(identity));
  }

  refreshStorage(identity: string): void {
    if (!this.isCurrent(identity)) return;
    const current = (): boolean => this.isCurrent(identity);
    if (!this.storagePolicyBusy && this.snapshot.storagePolicy === undefined)
      void this.host?.refreshStoragePolicy(current);
    if (!this.storageCleanupBusy && this.snapshot.storageSummary.cleanableBytes === undefined)
      void this.host?.refreshStorageSummary(current);
  }

  async applyIntent(identity: string, intent: SharedDownloadUiIntent, feedback: (message: string) => void): Promise<void> {
    const host = this.host;
    const opening = this.opening;
    const current = (): boolean => this.isCurrent(identity) && this.host === host;
    if (!current() || host === undefined || opening === undefined) return;
    if (intent.action === 'cleanup') {
      if (intent.scope === 'storage' && intent.books.length === 0 && this.storageCleanupWrite?.owner !== opening.owner &&
        canCleanDownloadStorage(this.snapshot.storageSummary))
        await this.clearCache(opening, current, feedback);
      return;
    }
    if (intent.action === 'configureStorage') {
      await this.configureStorage(opening, intent, current, feedback);
      return;
    }
    if (intent.books.length === 0) return;
    const targets = intent.books.map((target): SharedDownloadActionTarget =>
      new SharedDownloadActionTarget(target.sourceId, target.bookId, target.chapterIndices?.slice(),
        target.expectedChapters?.map((chapter: SharedDownloadExpectedChapter): SharedDownloadExpectedChapter =>
          ({ chapterIndex: chapter.chapterIndex, chapterId: chapter.chapterId }))));
    const action = intent.action;
    if (this.batchObservations.some(batch => batch.action === action && batch.targets.some(previous =>
      targets.some(target => this.overlapsBatchTarget(previous, target))))) return;
    const batch: DownloadBatchObservation = { action, targets };
    this.batchObservations.push(batch);
    let receipt: SharedDownloadBatchReceipt | undefined;
    try {
      receipt = await host.runAction(action, targets, current);
    } catch (error) {
      if (current()) feedback('暂时无法发起下载操作，请稍后重试');
      hilog.warn(DOMAIN, 'Reader', 'Download-page action failed: %{private}s', errorMessageOf(error));
      return;
    } finally {
      if (receipt?.stop !== 'operationUnconfirmed') this.batchObservations = this.batchObservations.filter(value => value !== batch);
    }
    if (receipt.error !== undefined)
      hilog.warn(DOMAIN, 'Reader', 'Download-page action stopped: %{private}s', errorMessageOf(receipt.error));
    if (receipt.stop === 'operationUnconfirmed') {
      // The Host stops at the first unknown result. Prior confirmed and
      // unavailable targets count toward that position in the original order.
      if (!this.batchObservations.includes(batch)) return;
      const uncertain = targets[receipt.confirmed + receipt.unavailable];
      if (uncertain !== undefined) batch.targets = [uncertain];
      const generation = this.batchRecovery.generation + 1;
      const other = generation > 1 ? `。另有 ${generation - 1} 批操作结果未确认` : '';
      this.batchRecovery = { message: this.batchFeedback(action, receipt) + other +
        '。刷新仅查看当前列表，原操作结果仍未确认。', visible: true, canRetry: true, generation };
      if (current()) await host.reload(current);
      return;
    }
    if (!current()) return;
    feedback(this.batchFeedback(action, receipt));
    // A confirmed write whose projection failed keeps the existing explicit
    // refresh entry; reporting that failure must not silently retry the read.
    if (receipt.confirmed > 0 && receipt.stop !== 'readbackFailed') await host.reload(current);
  }

  private resetBatchRecovery(owner?: ReaderRuntimeOwner): void {
    this.batchOwner = owner;
    this.batchObservations = [];
    this.batchRecovery = { message: '', visible: false, canRetry: false, generation: 0 };
  }

  private overlapsBatchTarget(previous: SharedDownloadActionTarget, next: SharedDownloadActionTarget): boolean {
    if (previous.sourceId !== next.sourceId || previous.bookId !== next.bookId) return false;
    if (previous.chapterIndices === undefined || next.chapterIndices === undefined) return true;
    const previousChapters = previous.expectedChapters, nextChapters = next.expectedChapters;
    if (previousChapters !== undefined && nextChapters !== undefined)
      return previousChapters.some(chapter => nextChapters.some(candidate => candidate.chapterId === chapter.chapterId));
    return previous.chapterIndices.some(index => next.chapterIndices?.includes(index) === true);
  }

  private batchFeedback(action: SharedDownloadBookAction, receipt: SharedDownloadBatchReceipt): string {
    if (receipt.confirmed === receipt.requested) {
      if (receipt.stop === 'readbackFailed') return '下载状态已保存，列表刷新失败';
      return action === 'download' ? '下载任务已提交' : action === 'pause' ? '下载已暂停' :
        action === 'cancel' ? '下载任务已取消' : '本地内容已删除';
    }
    if (receipt.requested === 1) {
      if (receipt.stop === 'scopeChanged') return '目录已变化，章节操作未执行，请刷新后重新选择';
      if (receipt.stop === 'operationUnconfirmed') {
        const hint = receipt.error === undefined ? '' : readingOfflineFailureHint(receipt.error);
        const status = '下载操作结果未确认';
        return hint.length > 0 && hint !== '请稍后重试。' ? status + '。' + hint : status;
      }
      return '目标书籍暂不可操作，请刷新后重新选择';
    }
    const unconfirmed = receipt.stop === 'operationUnconfirmed' ? 1 : 0;
    const remaining = receipt.requested - receipt.confirmed - receipt.unavailable - unconfirmed;
    const parts: string[] = [];
    if (receipt.confirmed > 0) parts.push(`已确认 ${receipt.confirmed} 本`);
    if (receipt.unavailable > 0) parts.push(`目标不可用 ${receipt.unavailable} 本`);
    if (unconfirmed > 0) parts.push('1 本结果未确认');
    if (remaining > 0) parts.push(`${remaining} 本未处理`);
    if (receipt.stop === 'scopeChanged') parts.push('章节目录已变化');
    if (receipt.stop === 'readbackFailed') parts.push('已保存的状态未能读回');
    const label = action === 'download' ? '提交下载' : action === 'pause' ? '暂停下载' :
      action === 'cancel' ? '取消下载' : '删除本地内容';
    return label + ' · ' + parts.join('，');
  }

  private async configureStorage(opening: SharedDownloadOpening,
    intent: SharedDownloadUiIntent, current: () => boolean, feedback: (message: string) => void): Promise<void> {
    const policy = this.snapshot.storagePolicy;
    if (intent.scope !== 'storage' || intent.books.length > 0 || policy === undefined || this.storagePolicyBusy) return;
    const limit = intent.cacheLimitMb ?? policy.capacityBytes / (1024 * 1024);
    const days = intent.cleanupAfterDays ?? policy.expiryDays;
    const capacity = limit * 1024 * 1024;
    if (!Number.isSafeInteger(capacity) || capacity < 0 || !Number.isSafeInteger(days) || days < 1 ||
      (capacity === policy.capacityBytes && days === policy.expiryDays)) return;
    this.storagePolicyWrite = opening;
    this.storagePolicyBusy = true;
    try {
      let receipt: SharedDownloadStoragePolicyResult | undefined;
      try {
        receipt = await opening.owner.configureDownloadStorage(limit, days);
      } catch (error) {
        hilog.warn(DOMAIN, 'Reader', 'Download storage policy write failed: %{private}s', errorMessageOf(error));
      }
      if (this.storagePolicyWrite !== opening) return;
      // A newly opened page for the same Runtime receives the real policy
      // without replaying feedback from the previous opening.
      const latest = this.opening;
      const latestHost = this.host;
      if (latest === undefined || latestHost === undefined || latest.owner !== opening.owner) return;
      const readCurrent = (): boolean => this.opening === latest && this.host === latestHost && latest.isRouteCurrent();
      let readback = false;
      if (receipt !== undefined) latestHost.acceptStoragePolicy(receipt.capacityBytes, receipt.expiryDays, readCurrent);
      else readback = await latestHost.refreshStoragePolicy(readCurrent, true);
      if (readCurrent()) void latestHost.refreshStorageSummary(readCurrent);
      if (!current()) return;
      if (receipt === undefined) feedback(readback ? '存储设置结果未确认，已重新读取当前设置' : '存储设置结果未确认，请重新打开存储管理');
      else feedback(receipt.maintenanceMessage ?? '存储设置已保存');
    } finally {
      if (this.storagePolicyWrite === opening) {
        this.storagePolicyWrite = undefined;
        this.storagePolicyBusy = false;
      }
    }
  }

  async read(identity: string, target: DownloadReadingTarget, present: (entry: DownloadReadingEntry) => void,
    feedback: (message: string) => void, isViewCurrent: () => boolean, control: SharedDownloadReadingControl): Promise<void> {
    const opening = this.opening;
    if (opening === undefined || !this.isCurrent(identity) || !isViewCurrent() ||
      target.route === 'unavailable' || target.chapterIndex === undefined) return;
    const findBook = (): DownloadBookView | undefined => this.snapshot.books.find((entry: DownloadBookView): boolean =>
      entry.sourceId === target.sourceId && entry.bookId === target.bookId);
    const book = findBook();
    if (book === undefined || book.contentKind === undefined || book.projectionStatus !== 'ready') return;
    const local = book.sourceId === 'local';
    const chapter = book.chapters.find(row => row.navigable && row.index === target.chapterIndex &&
      (local || row.chapterId === target.chapterId));
    if (chapter === undefined) { feedback('目录已变化，请刷新下载页后重新选择'); return; }
    const revision = ++this.readingRequestRevision;
    const current = (): boolean => this.opening === opening && opening.isRouteCurrent() &&
      revision === this.readingRequestRevision && isViewCurrent();
    const deliver = (entry: DownloadReadingEntry): void => {
      const focus: SharedDownloadReadingFocus = { bookKey: book.key, chapterKey: chapter.key,
        chapterId: chapter.chapterId, control };
      this.readingFocus = focus;
      try {
        present(entry);
      } finally {
        if (this.opening === opening && this.readingFocus === focus) this.readingFocus = undefined;
      }
    };
    // Catalog admission reads metadata. The reader owns storage protection
    // once it accepts the handoff.
    try {
      if (local) {
        deliver({ shelfBook: book.shelfBook, chapterIndex: chapter.index, sourceLabel: book.sourceLabel });
        return;
      }
      const seed: RemoteReadingBookSeed = { sourceId: book.sourceId, bookId: book.bookId, detailUrl: book.bookId,
        title: book.title, author: book.author, coverUrl: book.coverUrl, contentKind: book.contentKind === 'manga' ? 'manga' : 'text' };
      const session = await new RemoteReadingFlowGateway(opening.owner)
        .openCachedCatalogSession(seed, current, false, book.contentKind === 'manga');
      if (!current()) return;
      // The Host may publish a replacement before ArkUI forwards its Props to the page.
      const latest = findBook();
      if (latest === undefined || latest.projectionStatus !== 'ready' || latest.contentKind !== book.contentKind ||
        !latest.chapters.some(row => row.navigable && row.index === chapter.index && row.chapterId === chapter.chapterId)) {
        feedback('目录已变化，请刷新下载页后重新选择');
        return;
      }
      if (!session.entries.some(row => row.navigable !== false && row.index === chapter.index && row.url === chapter.chapterId))
        throw new Error('目录已变化，请刷新下载页后重新选择');
      const entry: DownloadReadingEntry = { shelfBook: latest.shelfBook, chapterIndex: chapter.index,
        seed, sourceLabel: latest.sourceLabel, session };
      if (book.contentKind === 'manga') entry.mangaOfflineChapterId = chapter.chapterId;
      deliver(entry);
    } catch (error) {
      if (!current()) return;
      feedback(`无法打开阅读页：${readingOfflineFailureHint(error as Error) || '本地目录尚未完整，请先重新校验下载。'}`);
      hilog.warn(DOMAIN, 'Reader', 'Download reading admission failed: %{private}s', errorMessageOf(error));
    }
  }

  private async clearCache(opening: SharedDownloadOpening,
    current: () => boolean, feedback: (message: string) => void): Promise<void> {
    this.storageCleanupWrite = opening;
    this.storageCleanupBusy = true;
    try {
      let message: string;
      try {
        const cleanup = await opening.owner.clearDownloadRebuildableCache();
        const contentBytes = typeof cleanup['removedContentBytes'] === 'number' ? cleanup['removedContentBytes'] as number : 0;
        const imageBytes = typeof cleanup['deletedBytes'] === 'number' ? cleanup['deletedBytes'] as number : 0;
        const files = typeof cleanup['deletedFiles'] === 'number' ? cleanup['deletedFiles'] as number : 0;
        const partial = typeof cleanup['cleanupError'] === 'string';
        message = contentBytes > 0 || imageBytes > 0 || files > 0 ?
          `已清理正文缓存 ${formatDownloadStorageBytes(contentBytes)}，回收图片 ${formatDownloadStorageBytes(imageBytes)}（${files} 个文件）${partial ? '；部分清理未完成，请重试' : ''}` :
          partial ? '缓存清理未完成，请重试；已下载与受保护内容保留' : '当前没有可清理的缓存；已下载与受保护内容保留';
      } catch (error) {
        message = '清理结果暂未确认，请在存储管理核对';
        hilog.warn(DOMAIN, 'Reader', 'Download cache cleanup failed: %{private}s', errorMessageOf(error));
      }
      if (this.storageCleanupWrite !== opening) return;
      // A pre-cleanup estimate cannot authorize another clear, including
      // a retained return from reading captured before the receipt arrived.
      this.storageCleanupRevision += 1;
      if (this.retainedOwner === opening.owner && this.retainedSnapshot !== undefined)
        this.retainedSnapshot = withoutDownloadStorageSummary(this.retainedSnapshot);
      const latest = this.opening;
      const latestHost = this.host;
      if (latest !== undefined && latest.owner === opening.owner && latestHost !== undefined) {
        const readCurrent = (): boolean => this.opening === latest && this.host === latestHost && latest.isRouteCurrent();
        latestHost.invalidateStorageSummary(readCurrent);
        void latestHost.reload(readCurrent);
      }
      if (current()) feedback(message);
    } finally {
      if (this.storageCleanupWrite === opening) {
        this.storageCleanupWrite = undefined;
        this.storageCleanupBusy = false;
      }
    }
  }
}
