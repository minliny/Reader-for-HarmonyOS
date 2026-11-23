import type { ReadingOperationContext } from '../application/ReadingOperationIntents';
import type { ReadingBookDetail } from './ReadingBookDetail';
import type { ReaderDirectoryOperation, ReaderOriginalBookmarkRecovery } from '../application/ReaderDirectoryHost';
import type { ReadingOfflineOperation } from '../application/ReadingOfflineHost';
import { readerRecoveryView } from '../../../app/ReaderRecoveryProjection';
import type { ReaderRecoveryView } from '../../../ui/feedback/ReaderRecoveryView';
import { readingOfflineFailureHint } from './ReadingOfflineFailurePresentation';

/** Presentation DTO only. Exact receipts/mutex/continuation authority remain in
 * the directory/offline owners. A canonical availability list is never an ACK. */
export interface ReadingDirectoryRecovery {
  presentationId: string;
  bookmarks: ReaderRecoveryView;
  offline: ReaderRecoveryView;
  canContinueBookmarks: boolean;
  canContinueOffline: boolean;
  bookmarkWriteEnabled: boolean;
  /** Read-only guidance about a foreign original operation. Never grants retry. */
  bookmarkWriteBlockReason?: string;
  originalBookmarks?: ReaderOriginalBookmarkRecovery;
  offlineBlocked?: boolean;
  bookmarksKind?: ReadingDirectoryMessageKind;
  offlineKind?: ReadingDirectoryMessageKind;
  bookmarksReadbackFailed?: boolean;
  offlineReadbackFailed?: boolean;
  bookmarksBusy?: boolean;
  offlineBusy?: boolean;
  bookmarksRecoveryAction?: ReadingDirectoryRecoveryAction;
  offlineRecoveryAction?: ReadingDirectoryRecoveryAction;
}
export type ReadingDirectoryMessageKind = 'pending' | 'result' | 'readback' | 'none';
export type ReadingDirectoryRecoveryAction = 'reconcile' | 'continue';
const EMPTY_VIEW: ReaderRecoveryView = { message: '', visible: false, canRetry: false, generation: 0 };
export const EMPTY_READING_DIRECTORY_RECOVERY: ReadingDirectoryRecovery = { presentationId: '',
  bookmarks: EMPTY_VIEW, offline: EMPTY_VIEW, canContinueBookmarks: false, canContinueOffline: false,
  bookmarkWriteEnabled: false, bookmarksBusy: false, offlineBusy: false };

export function readingDirectoryRecovery(presentationId: string, book: ReadingBookDetail,
  directory?: ReaderDirectoryOperation, offline?: ReadingOfflineOperation, bookmarkWriteEnabled: boolean = false, blockingBookmarkBook?: ReadingOperationContext, originalBookmarks?: ReaderOriginalBookmarkRecovery): ReadingDirectoryRecovery {
  const dir = directory !== undefined && directory.book.sourceId === book.sourceId && directory.book.bookId === book.bookId &&
    directory.book.title === book.title && directory.book.author === book.author ? directory : undefined;
  const cached = offline !== undefined && offline.sourceId === book.sourceId && offline.bookId === book.bookId ? offline : undefined;
  const downloadProgress = cached?.action === 'clear' ? undefined : cached?.progress;
  let bookmarks = readerRecoveryView(dir?.projection, undefined, dir?.confirmedCount ?? 0);
  if (dir?.projection.receipt.confirmation === 'unknown') {
    // A successful list read cannot qualify the original write. Retain the
    // owner's exact recovery explanation after that independent read succeeds.
    const reason = dir.projection.facts.message;
    if (reason !== undefined && reason.trim().length > 0 && !bookmarks.message.includes(reason)) {
      bookmarks = { ...bookmarks, message: `${bookmarks.message}。${reason}` };
    }
  }
  if (dir?.completion === 'partial') bookmarks = { ...bookmarks, visible: true, generation: dir.generation,
    message: `部分书签已更新（已确认 ${dir.confirmedCount}/${dir.requestedCount} 项），后续操作未派发`,
    canRetry: dir.projection.facts.canRetry };
  let cache = readerRecoveryView(cached?.projection);
  if (cached !== undefined && cache.visible) {
    // Keep the original receipt and retry flags; refresh/failure diagnostics
    // may contain source URLs or credentials and do not belong in public copy.
    const confirmation = cached.projection.receipt.confirmation;
    cache = { ...cache, message: confirmation === 'unknown' ? '离线操作结果尚未确认，请重试核对；已有内容仍保留' :
      confirmation === 'confirmed' ? (cached.projection.receipt.readback === 'failed' ?
        '缓存操作已确认，状态读取失败，请重试核对' : '缓存操作已确认，正在读取离线状态…') : '离线操作未派发，请稍后重试' };
  }
  if (cached === undefined && offline?.action === 'clear' && offline.projection.receipt.confirmation === 'unknown' && offline.blockingClear?.active !== false) cache = {
    message: offline.blockingClear?.scope === 'cache' ? '原全局文字缓存清理尚未确认，请返回设置核对；暂不能开始新的本书离线操作，已有正文仍可使用' :
      '另一缓存清理操作尚未确认，请返回原内容核对；已有正文仍可使用', visible: true, canRetry: false, generation: offline.generation };
  if (cached?.materializationFailure !== undefined) cache = { ...cache, visible: true, generation: cached.generation,
    message: `${cached.projection.receipt.confirmation === 'confirmed' ? '缓存操作已确认；' : ''}${readingOfflineFailureHint(new Error(cached.materializationFailure)) || '离线操作已取消'}`,
    canRetry: cached.projection.facts.canRetry };
  else if (downloadProgress !== undefined && downloadProgress.failedChapters > 0) cache = { ...cache, visible: true,
    generation: cached!.generation, message: `离线下载部分完成：${downloadProgress.completedChapters}/${downloadProgress.totalChapters} 章已完成，${downloadProgress.failedChapters} 章失败` };
  const bookmarksReadbackFailed = dir?.projection.receipt.confirmation === 'confirmed' && dir.projection.receipt.readback === 'failed';
  const offlineReadbackFailed = cached?.projection.receipt.confirmation === 'confirmed' && cached.projection.receipt.readback === 'failed';
  // These are presentation channels, never a new confirmation or a retry
  // authority. Known outcomes must not inherit the pending-notice shell.
  let bookmarksKind: ReadingDirectoryMessageKind = 'none';
  if (bookmarks.visible) {
    if (dir === undefined || dir.projection.receipt.confirmation === 'unknown' || dir.canContinueOriginal === true) bookmarksKind = 'pending';
    else if (dir.completion === 'partial' ||
      (dir.projection.receipt.confirmation === 'undispatched' && dir.projection.receipt.readback === 'failed')) bookmarksKind = 'result';
    else if (bookmarksReadbackFailed || (dir.recoveryAction !== undefined && dir.projection.receipt.readback === 'reading')) bookmarksKind = 'readback';
  }
  let offlineKind: ReadingDirectoryMessageKind = 'none';
  if (cache.visible) {
    if (cached === undefined || cached.projection.receipt.confirmation === 'unknown' || cached.canContinueOriginal === true) offlineKind = 'pending';
    else if (cached.materializationFailure !== undefined || (downloadProgress?.failedChapters ?? 0) > 0 ||
      (cached.projection.receipt.confirmation === 'undispatched' && cached.projection.receipt.readback === 'failed')) offlineKind = 'result';
    else if (offlineReadbackFailed || (cached.recoveryAction !== undefined && cached.projection.receipt.readback === 'reading')) offlineKind = 'readback';
  }
  if (cached?.projection.receipt.confirmation === 'unknown' && offlineKind === 'pending' &&
    !cache.message.startsWith('离线操作结果尚未确认')) {
    cache = { ...cache, message: `离线操作结果尚未确认；${cache.message}` };
  }
  bookmarks = { ...bookmarks, visible: bookmarksKind !== 'none' };
  cache = { ...cache, visible: offlineKind !== 'none' };
  const pendingBook = blockingBookmarkBook ?? (directory !== undefined &&
    (directory.projection.receipt.confirmation === 'unknown' || directory.canContinueOriginal === true) ? directory.book : undefined);
  const foreignBookmarkPending = !bookmarkWriteEnabled && pendingBook !== undefined &&
    (pendingBook.sourceId !== book.sourceId || pendingBook.bookId !== book.bookId || pendingBook.title !== book.title || pendingBook.author !== book.author);
  const bookmarkWriteBlockReason = originalBookmarks !== undefined ?
    '存在旧版书签原操作记录。请在当前阅读页“更多 → 待处理事项”中核对原记录。' : foreignBookmarkPending ?
    `${pendingBook!.title?.trim() ? `《${pendingBook!.title}》` : '另一书籍'}${pendingBook!.author?.trim() ? `（${pendingBook!.author}）` : ''}的原书签操作尚未确认。请打开原书的阅读页，在“更多 → 待处理事项”中核对原记录。` : undefined;
  return { presentationId, bookmarks, offline: cache, bookmarksKind, offlineKind, bookmarkWriteEnabled, bookmarkWriteBlockReason, originalBookmarks,
    bookmarksReadbackFailed, offlineReadbackFailed,
    bookmarksBusy: dir?.recoveryAction !== undefined || dir?.projection.receipt.readback === 'reading',
    offlineBusy: cached?.recoveryAction !== undefined || cached?.projection.receipt.readback === 'reading',
    bookmarksRecoveryAction: dir?.recoveryAction, offlineRecoveryAction: cached?.recoveryAction,
    canContinueBookmarks: dir?.canContinueOriginal === true, canContinueOffline: cached?.canContinueOriginal === true,
    offlineBlocked: offline?.action === 'clear' && offline.projection.receipt.confirmation === 'unknown' && offline.blockingClear?.active !== false };
}
