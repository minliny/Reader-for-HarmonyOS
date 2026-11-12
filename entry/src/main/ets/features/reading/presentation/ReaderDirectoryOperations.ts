import type { ReadingGatewayRuntime } from '../application/ReadingGatewayRuntime';
import type { ReadingBookDetail } from './ReadingBookDetail';
import type { LocalReadingTocEntry } from '../application/LocalReadingFlowGateway';
import type { RemoteReadingSession } from '../application/RemoteReadingFlowGateway';
import type { ReaderDirectoryChapterStartBookmarkRequest, ReaderPageBookmarkToggleRequest } from './ReaderDirectoryMarkerState';
import { ReaderDirectoryHost, type ReaderDirectoryBinding, type ReaderDirectoryOperation } from '../application/ReaderDirectoryHost';
import { ReadingOfflineHost, type ReadingOfflineBinding, type ReadingOfflineOperation } from '../application/ReadingOfflineHost';
import { BookmarkOperationIntentStore, CacheClearOperationIntentStore } from '../application/ReadingOperationIntents';
import { readingDirectoryRecovery, EMPTY_READING_DIRECTORY_RECOVERY, type ReadingDirectoryRecovery } from './ReadingDirectoryRecovery';
import { readingOfflineFailureHint } from './ReadingOfflineFailurePresentation';
import type { ReadingOfflineBookProgress } from '../application/ReadingOfflineGateway';
import type { MangaDownloadAction, MangaDownloadActionId } from '../../manga/application/MangaDownloadActionsGateway';
import { SharedDownloadProjectionRefreshError } from '../../downloads/application/SharedDownloadCoordinator';

export interface ReaderDirectoryScene {
  readonly owner?: ReadingGatewayRuntime;
  readonly retired: boolean;
  readonly mount: number;
  readonly navigation: number;
  readonly presentation: number;
  readonly sessionGeneration: number;
  readonly directoryVisible: boolean;
  readonly acceptsProjection: boolean;
  readonly foreground: boolean;
  readonly reading: boolean;
  readonly offlineBusy: boolean;
  readonly book?: ReadingBookDetail;
  readonly session?: RemoteReadingSession;
}

export type ReaderDirectoryDiagnostic = 'bookmarkDelivery' | 'bookmarkOperation' | 'offlineDelivery' | 'offlineOperation' | 'sourceCleanup';

export interface ReaderDirectoryPorts {
  scene(): ReaderDirectoryScene;
  ownsRuntime(owner: ReadingGatewayRuntime): boolean;
  currentEntries(): LocalReadingTocEntry[];
  replaceEntries(entries: LocalReadingTocEntry[]): void;
  publishBookmarks(operation: ReaderDirectoryOperation | undefined): void;
  publishOffline(operation: ReadingOfflineOperation | undefined, busy: boolean): void;
  refreshMangaDirectory(detailOnly: boolean): void;
  feedback(message: string): void;
  openDownloadProgress(key: string): void;
  canExitReader(): boolean;
  afterReaderExitInDetail(action: () => void): void;
  confirmOfflineClear(title: string, message: string, accept: () => void, current: () => boolean): void;
  diagnostic(kind: ReaderDirectoryDiagnostic, error: Error): void;
}

/** Delivers the directory's projections and intents to their existing Runtime owners.
 * A retired scene rejects delivery while accepted writes keep their original identity. */
export class ReaderDirectoryOperations {
  private readonly ports: ReaderDirectoryPorts;
  private offlineOperation: ReadingOfflineOperation | undefined;
  private mangaActionActive: boolean = false;

  constructor(ports: ReaderDirectoryPorts) { this.ports = ports; }

  downloadChapter(chapterIndex: number): void { void this.submitDownload(chapterIndex); }

  downloadBook(): void { void this.submitDownload(); }

  private async submitDownload(chapterIndex?: number): Promise<void> {
    const scene = this.ports.scene();
    const { owner, session } = scene;
    if (owner === undefined || session === undefined) return;
    const current = this.downloadOpening(scene, owner, session);
    if (!current()) return;
    if (session.contentKind === 'manga' && owner.supportsCoreCapability?.('manga.offline.v1') !== true) {
      this.ports.feedback('漫画离线下载尚未开放');
      return;
    }
    const hasChapter = session.entries.some(entry => entry.navigable !== false && entry.url.trim().length > 0 &&
      (chapterIndex === undefined || entry.index === chapterIndex));
    if (!hasChapter) {
      if (chapterIndex === undefined) this.ports.feedback('当前书籍没有可下载的在线章节');
      return;
    }
    try {
      const coordinator = owner.getDownloadCoordinator?.();
      if (coordinator === undefined) return;
      const receipt = await coordinator.submit(session, chapterIndex === undefined ? undefined : [chapterIndex]);
      if (!current()) return;
      if (!receipt.accepted) { this.ports.feedback('下载请求尚未确认，请重试'); return; }
      if (chapterIndex === undefined) this.ports.openDownloadProgress(receipt.key);
      else this.ports.feedback(receipt.alreadyRunning ? '本章已在下载中' : '已加入下载，可在下载管理查看进度');
    } catch (error) {
      if (current()) this.ports.feedback(`下载失败：${readingOfflineFailureHint(error as Error) || '请重试。'}`);
      this.ports.diagnostic('offlineOperation', error as Error);
    }
  }

  loadMangaActions(chapter?: number): Promise<MangaDownloadAction[]> {
    const { owner, session } = this.ports.scene();
    if (owner === undefined || session?.contentKind !== 'manga') return Promise.resolve([]);
    const binding = this.offlineBinding(owner, session);
    if (!binding.current()) return Promise.resolve([]);
    const host = this.offlineHost(owner);
    return host?.loadMangaActions(chapter, binding) ?? Promise.resolve([]);
  }

  async performMangaAction(action: MangaDownloadActionId, chapter?: number): Promise<void> {
    const scene = this.ports.scene();
    const { owner, session } = scene;
    if (owner === undefined || session?.contentKind !== 'manga') return;
    const binding = this.offlineBinding(owner, session);
    if (!binding.current()) return;
    if (action === 'downloadChapter') { if (chapter !== undefined) this.downloadChapter(chapter); return; }
    if (action === 'downloadBook') { this.downloadBook(); return; }
    if (action === 'clearCache') { this.requestClearOffline(); return; }
    if (action === 'deleteDownloads' && scene.reading) {
      if (!this.ports.canExitReader()) { this.ports.feedback('请先退出漫画阅读后再删除下载'); return; }
      const chapterUrl = session.entries.find(entry => entry.index === chapter)?.url;
      if (chapter !== undefined && !chapterUrl) return;
      this.ports.afterReaderExitInDetail((): void => {
        const latest = this.ports.scene(), current = latest.session;
        if (latest.owner !== owner || latest.mount !== scene.mount || latest.reading || current === undefined ||
          current.identity.sourceId !== session.identity.sourceId || current.identity.bookId !== session.identity.bookId ||
          current.sourceVersion !== session.sourceVersion || current.catalogVersion !== session.catalogVersion ||
          (chapter !== undefined && current.entries.find(entry => entry.index === chapter)?.url !== chapterUrl)) return;
        void this.performMangaAction('deleteDownloads', chapter);
      });
      return;
    }
    await this.operateManga(owner, action, chapter, binding);
  }

  requestClearOffline(): void {
    const scene = this.ports.scene();
    const { owner, session } = scene;
    if (owner === undefined || session === undefined || scene.offlineBusy) return;
    const opening = this.downloadOpening(scene, owner, session);
    const current = (): boolean => opening() && !this.ports.scene().offlineBusy;
    if (!current()) return;
    const manga = session.contentKind === 'manga';
    this.ports.confirmOfflineClear(manga ? '清除本书普通阅读缓存' : '清除本书离线内容', manga ?
      '清除可清理的普通漫画缓存；永久保留的下载及正在使用的内容会保留，书架、阅读进度与书签不会受影响。' :
      '将删除本书已下载的正文和图片，书架、阅读进度与书签不会受影响。',
      (): void => { if (current()) this.clearOffline(); }, current);
  }

  private async operateManga(owner: ReadingGatewayRuntime, action: MangaDownloadActionId, chapter: number | undefined,
    binding: ReadingOfflineBinding): Promise<void> {
    const host = this.offlineHost(owner);
    if (host === undefined || this.mangaActionActive || !binding.current()) return;
    this.mangaActionActive = true;
    try {
      const outcome = await host.operateManga(action, chapter, binding);
      if (!binding.current()) return;
      if (action === 'releaseRetention') this.ports.feedback('已解除永久保留，现有阅读缓存仍可使用');
      else if (action === 'pause') this.ports.feedback('下载已暂停，已获取的内容保留');
      else if (action === 'cancel') this.ports.feedback('下载任务已取消，已获取的下载内容保留');
      else if (action === 'deleteDownloads' && outcome !== undefined) this.ports.feedback(outcome.protectedVersions > 0 ?
        '部分内容仍在使用，已解除保留，退出使用后可清理普通缓存' :
        outcome.removedVersions > 0 ? '下载内容已删除' : '没有可删除的下载内容');
    } catch (error) {
      if (binding.current()) this.ports.feedback(error instanceof SharedDownloadProjectionRefreshError ?
        '下载状态已保存，列表刷新失败' : '下载操作未完成，请重新读取状态后重试');
      this.ports.diagnostic('offlineOperation', error as Error);
    } finally {
      this.mangaActionActive = false;
    }
  }

  private bindingId(scene: ReaderDirectoryScene): string {
    return JSON.stringify([scene.mount, scene.navigation, scene.book?.sourceId ?? '', scene.book?.bookId ?? '', scene.sessionGeneration]);
  }

  presentationId(scene: ReaderDirectoryScene): string {
    return JSON.stringify([this.bindingId(scene), scene.presentation]);
  }

  private acceptsBinding(scene: ReaderDirectoryScene, identity: string, owner: ReadingGatewayRuntime): boolean {
    return scene.owner === owner && this.ports.ownsRuntime(owner) && !scene.retired &&
      identity === this.bindingId(scene) && scene.book !== undefined && scene.acceptsProjection;
  }

  private downloadOpening(opening: ReaderDirectoryScene, owner: ReadingGatewayRuntime,
    session: RemoteReadingSession): () => boolean {
    const identity = this.bindingId(opening);
    return (): boolean => {
      const scene = this.ports.scene();
      return scene.foreground && this.acceptsBinding(scene, identity, owner) && scene.session === session &&
        scene.presentation === opening.presentation && scene.directoryVisible === opening.directoryVisible;
    };
  }

  private acceptsPresentation(scene: ReaderDirectoryScene, identity: string, owner: ReadingGatewayRuntime): boolean {
    return scene.directoryVisible && identity === this.presentationId(scene) && this.acceptsBinding(scene, this.bindingId(scene), owner);
  }

  private bookmarkHost(owner: ReadingGatewayRuntime): ReaderDirectoryHost | undefined {
    const current = (): boolean => this.ports.ownsRuntime(owner);
    const host = ReaderDirectoryHost.forRuntime(owner, current,
      (error: Error): void => this.ports.diagnostic('bookmarkDelivery', error), new BookmarkOperationIntentStore(owner, current));
    this.ports.publishBookmarks(host?.snapshot());
    return host;
  }

  offlineHost(owner: ReadingGatewayRuntime): ReadingOfflineHost | undefined {
    const current = (): boolean => this.ports.ownsRuntime(owner);
    const host = ReadingOfflineHost.forRuntime(owner, current,
      (error: Error): void => this.ports.diagnostic('offlineDelivery', error), new CacheClearOperationIntentStore(owner, current));
    this.publishOffline(host?.snapshot(), host?.busy() ?? false);
    return host;
  }

  private publishOffline(operation: ReadingOfflineOperation | undefined, busy: boolean): void {
    this.offlineOperation = operation;
    this.ports.publishOffline(operation, busy);
  }

  bookmarkBinding(owner: ReadingGatewayRuntime, book: ReadingBookDetail,
    isRequestCurrent?: () => boolean, onSettled?: (confirmed: boolean) => void): ReaderDirectoryBinding {
    const identity = this.bindingId(this.ports.scene());
    return { book, current: (): boolean => {
      const scene = this.ports.scene();
      return this.acceptsBinding(scene, identity, owner) && (isRequestCurrent?.() ?? true) &&
        scene.book?.title === book.title && scene.book?.author === book.author;
    }, currentEntries: this.ports.currentEntries, emitEntries: this.ports.replaceEntries,
      emitOperation: (operation: ReaderDirectoryOperation): void => this.ports.publishBookmarks({ action: operation.action,
        book: operation.book, generation: operation.generation, requestedCount: operation.requestedCount,
        confirmedCount: operation.confirmedCount, completion: operation.completion,
        canContinueOriginal: operation.canContinueOriginal, projection: operation.projection }),
      failed: (error: Error): void => this.ports.diagnostic('bookmarkOperation', error), onSettled };
  }

  offlineBinding(owner: ReadingGatewayRuntime, session: RemoteReadingSession): ReadingOfflineBinding {
    const identity = this.bindingId(this.ports.scene());
    const current = (): boolean => {
      const scene = this.ports.scene();
      return this.acceptsBinding(scene, identity, owner) && scene.session === session;
    };
    return { session, current, currentEntries: this.ports.currentEntries, emitEntries: this.ports.replaceEntries,
      emitOperation: (operation: ReadingOfflineOperation): void => this.publishOffline({ action: operation.action,
        sourceId: operation.sourceId, bookId: operation.bookId, chapterIndex: operation.chapterIndex, generation: operation.generation,
        materialization: operation.materialization, materializationFailure: operation.materializationFailure,
        operationFailure: operation.operationFailure, canContinueOriginal: operation.canContinueOriginal, blockingClear: operation.blockingClear,
        progress: operation.progress, projection: operation.projection }, operation.materialization === 'running'),
      onProgress: (progress: ReadingOfflineBookProgress, finished: boolean): void => {
        if (finished && current()) this.ports.feedback(offlineDownloadFeedback(session, progress));
      }, failed: (error: Error): void => {
        if (!current()) return;
        const hint = readingOfflineFailureHint(error);
        if (hint.length === 0) return;
        const operation = this.offlineOperation;
        if (operation?.projection.receipt.confirmation === 'unknown') {
          this.ports.feedback(operation.action === 'clear' ? '缓存清理结果尚未确认，请重试核对' : '下载结果尚未确认，请在目录中重试核对');
        } else if (operation?.action === 'clear') {
          this.ports.feedback(`缓存清理未完成：${hint}`);
        } else {
          this.ports.feedback(error.message === 'MANGA_DOWNLOAD_PAUSED_RESUME_REQUIRED' ? hint : `本章下载失败：${hint}`);
        }
        this.ports.diagnostic('offlineOperation', error);
      } };
  }

  deleteBookmarks(times: number[]): void {
    const { owner, book } = this.ports.scene();
    if (owner === undefined || book === undefined) return;
    const host = this.bookmarkHost(owner);
    if (host !== undefined) void host.deleteBookmarks(times, this.bookmarkBinding(owner, book));
  }

  createChapterStart(request: ReaderDirectoryChapterStartBookmarkRequest): void {
    const { owner, book } = this.ports.scene();
    if (owner === undefined || book === undefined || !this.ports.currentEntries().some(entry =>
      entry.index === request.chapterIndex && entry.title === request.chapterTitle)) return;
    const host = this.bookmarkHost(owner);
    if (host !== undefined) void host.createChapterStart(request.chapterIndex, this.bookmarkBinding(owner, book));
  }

  togglePageBookmark(request: ReaderPageBookmarkToggleRequest): void {
    const { owner, book } = this.ports.scene();
    const entry = this.ports.currentEntries().find(candidate => candidate.index === request.chapterIndex && candidate.title === request.chapterTitle);
    if (owner === undefined || book === undefined || entry?.bookmarks === undefined ||
      !Number.isSafeInteger(request.chapterOffset) || request.chapterOffset < 0) { request.onSettled?.(false); return; }
    const times: number[] = [];
    for (const time of request.bookmarkTimes) {
      if (!Number.isSafeInteger(time) || times.indexOf(time) >= 0 || !entry.bookmarks.some(mark => mark.time === time)) {
        request.onSettled?.(false); return;
      }
      times.push(time);
    }
    const host = this.bookmarkHost(owner);
    if (host === undefined) { request.onSettled?.(false); return; }
    const binding = this.bookmarkBinding(owner, book, undefined, request.onSettled);
    if (times.length > 0) { void host.deleteBookmarks(times, binding); return; }
    void host.createPosition({ bookName: book.title, bookAuthor: book.author, chapterIndex: request.chapterIndex,
      chapterOffset: request.chapterOffset, chapterTitle: request.chapterTitle, bookText: request.bookText,
      positionScope: request.positionScope }, binding);
  }

  reconcileBookmarks(generation: number, identity: string, continueOriginal: boolean): void {
    const scene = this.ports.scene();
    const { owner, book } = scene;
    // Both the independent directory and the retained reader's existing
    // recovery notice carry this exact presentation. Their UI input leases
    // still decide whether the visible actor can submit the original intent.
    if (owner === undefined || book === undefined || !scene.foreground ||
      (!scene.directoryVisible && !scene.reading) || identity !== this.presentationId(scene) ||
      !this.acceptsBinding(scene, this.bindingId(scene), owner)) return;
    const host = this.bookmarkHost(owner);
    if (host !== undefined) {
      const binding = this.bookmarkBinding(owner, book);
      if (continueOriginal) void host.continueOriginal(generation, binding).catch((): void => {});
      else void host.reconcile(generation, binding).catch((): void => {});
    }
  }

  reconcileOffline(generation: number, identity: string, continueOriginal: boolean): void {
    const scene = this.ports.scene();
    const { owner, session } = scene;
    if (owner === undefined || session === undefined || !this.acceptsPresentation(scene, identity, owner)) return;
    const host = this.offlineHost(owner);
    if (host !== undefined) {
      const binding = this.offlineBinding(owner, session);
      if (continueOriginal) void host.continueOriginal(generation, binding).catch((): void => {});
      else void host.reconcile(generation, binding).catch((): void => {});
    }
  }

  loadDirectory(): void {
    const { owner, book, session, reading } = this.ports.scene();
    if (owner === undefined || book === undefined) return;
    if (session?.contentKind === 'manga') this.ports.refreshMangaDirectory(!reading);
    const directory = this.bookmarkHost(owner);
    if (directory !== undefined) void directory.load(this.bookmarkBinding(owner, book)).catch((): void => {});
    const offline = this.offlineHost(owner);
    if (offline !== undefined && session !== undefined) void offline.load(this.offlineBinding(owner, session)).catch((): void => {});
  }

  loadControlBookmarks(sourceId: string, bookId: string, isRequestCurrent: () => boolean): Promise<void> {
    const { owner, book, reading } = this.ports.scene();
    if (owner === undefined || book === undefined || book.sourceId !== sourceId || book.bookId !== bookId ||
      !reading || !isRequestCurrent()) return Promise.reject(new Error('Bookmark projection session superseded'));
    const host = this.bookmarkHost(owner);
    if (host === undefined) return Promise.reject(new Error('Bookmark projection Runtime retired'));
    return host.load(this.bookmarkBinding(owner, book, isRequestCurrent));
  }

  clearOffline(): void {
    const { owner, session, mount } = this.ports.scene();
    if (owner === undefined || session === undefined) return;
    const host = this.offlineHost(owner);
    if (host === undefined) return;
    const binding = this.offlineBinding(owner, session);
    void host.clearBook(binding).catch((error: Error): void => {
      if (binding.current()) this.ports.feedback(readingOfflineFailureHint(error) || '缓存清理未完成，请重试');
      this.ports.diagnostic('offlineOperation', error);
    }).finally((): void => {
      const scene = this.ports.scene();
      // The initiating directory can leave while the Runtime settles its receipt.
      if (!scene.retired && scene.owner === owner && scene.mount === mount && this.ports.ownsRuntime(owner)) {
        this.publishOffline(host.snapshot(), host.busy());
      }
    });
  }

  cleanupRetiredSource(sourceId: string, bookId: string): void {
    const { owner } = this.ports.scene();
    if (owner === undefined || !this.ports.ownsRuntime(owner)) return;
    void this.offlineHost(owner)?.cleanupRetiredSource({ sourceId, bookId })
      .catch((error: Error): void => this.ports.diagnostic('sourceCleanup', error));
  }

  recovery(bookmarks: ReaderDirectoryOperation | undefined,
    offline: ReadingOfflineOperation | undefined): ReadingDirectoryRecovery {
    const scene = this.ports.scene();
    return scene.book === undefined ? EMPTY_READING_DIRECTORY_RECOVERY :
      readingDirectoryRecovery(this.presentationId(scene), scene.book, bookmarks, offline);
  }

  bookmarkMessage(operation: ReaderDirectoryOperation | undefined): string {
    // The original write may remain unknown after a successful canonical list
    // read. Its recovery notice is independent from a list-loading error.
    return operation?.projection.receipt.fact === 'confirmedRefreshFailed' ?
      this.recovery(operation, undefined).bookmarks.message : '';
  }
}

function offlineDownloadFeedback(session: RemoteReadingSession, progress: ReadingOfflineBookProgress): string {
  const total = progress.totalChapters;
  if (progress.completedChapters === total) return `全部 ${total} 章下载完成`;
  let message = `下载结果：已完成 ${progress.completedChapters}/${total} 章`;
  if (progress.cachedChapters > 0) message += `，另有 ${progress.cachedChapters} 章正文已缓存`;
  if (progress.failedChapters > 0) {
    message += `，${progress.failedChapters} 章失败`;
    if (progress.firstFailure !== undefined) {
      const title = session.entries.find(entry => entry.index === progress.firstFailure?.chapterIndex)?.title.trim();
      const label = title === undefined || title.length === 0 ? `目录第 ${progress.firstFailure.chapterIndex + 1} 项` :
        (title.length > 32 ? `${title.slice(0, 32)}…` : title);
      message += `（${label}：${progress.firstFailure.reason}）`;
    }
  } else message += '，其余章节尚未完成';
  return message;
}
