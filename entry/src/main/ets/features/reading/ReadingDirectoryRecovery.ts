import type { ReadingBookDetail } from './ReadingBookDetail';
import type { ReaderDirectoryOperation } from './ReaderDirectoryHost';
import type { ReadingOfflineOperation } from './ReadingOfflineHost';
import { readerRecoveryView, type ReaderRecoveryView } from '../../app/ReaderRecoveryProjection';
import { readingOfflineFailureHint } from './ReadingOfflineFailurePresentation';

/** Presentation DTO only. Exact receipts/mutex/continuation authority remain in
 * the directory/offline owners. A canonical availability list is never an ACK. */
export interface ReadingDirectoryRecovery {
  presentationId: string;
  bookmarks: ReaderRecoveryView;
  offline: ReaderRecoveryView;
  canContinueBookmarks: boolean;
  canContinueOffline: boolean;
  offlineBlocked?: boolean;
  bookmarksKind?: ReadingDirectoryMessageKind;
  offlineKind?: ReadingDirectoryMessageKind;
  bookmarksReadbackFailed?: boolean;
  offlineReadbackFailed?: boolean;
  bookmarksBusy?: boolean;
  offlineBusy?: boolean;
}
export type ReadingDirectoryMessageKind = 'pending' | 'result' | 'readback' | 'none';
const EMPTY_VIEW: ReaderRecoveryView = { message: '', visible: false, canRetry: false, generation: 0 };
export const EMPTY_READING_DIRECTORY_RECOVERY: ReadingDirectoryRecovery = { presentationId: '',
  bookmarks: EMPTY_VIEW, offline: EMPTY_VIEW, canContinueBookmarks: false, canContinueOffline: false,
  bookmarksBusy: false, offlineBusy: false };

export function readingDirectoryRecovery(presentationId: string, book: ReadingBookDetail,
  directory?: ReaderDirectoryOperation, offline?: ReadingOfflineOperation): ReadingDirectoryRecovery {
  const dir = directory !== undefined && directory.book.sourceId === book.sourceId && directory.book.bookId === book.bookId &&
    directory.book.title === book.title && directory.book.author === book.author ? directory : undefined;
  const cached = offline !== undefined && offline.sourceId === book.sourceId && offline.bookId === book.bookId ? offline : undefined;
  let bookmarks = readerRecoveryView(dir?.projection, undefined, dir?.confirmedCount ?? 0);
  if (dir === undefined && directory?.projection.receipt.confirmation === 'unknown') bookmarks = {
    message: `《${directory.book.title}》的原书签操作尚未确认，请返回原书籍核对`, visible: true, canRetry: false, generation: directory.generation };
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
  else if (cached?.progress !== undefined && cached.progress.failedChapters > 0) cache = { ...cache, visible: true,
    generation: cached.generation, message: `离线下载部分完成：${cached.progress.completedChapters}/${cached.progress.totalChapters} 章已完成，${cached.progress.failedChapters} 章失败` };
  const bookmarksReadbackFailed = dir?.projection.receipt.confirmation === 'confirmed' && dir.projection.receipt.readback === 'failed';
  const offlineReadbackFailed = cached?.projection.receipt.confirmation === 'confirmed' && cached.projection.receipt.readback === 'failed';
  // These are presentation channels, never a new confirmation or a retry
  // authority. Known outcomes must not inherit the pending-notice shell.
  let bookmarksKind: ReadingDirectoryMessageKind = 'none';
  if (bookmarks.visible) {
    if (dir === undefined || dir.projection.receipt.confirmation === 'unknown' || dir.canContinueOriginal === true) bookmarksKind = 'pending';
    else if (dir.completion === 'partial' ||
      (dir.projection.receipt.confirmation === 'undispatched' && dir.projection.receipt.readback === 'failed')) bookmarksKind = 'result';
    else if (bookmarksReadbackFailed) bookmarksKind = 'readback';
  }
  let offlineKind: ReadingDirectoryMessageKind = 'none';
  if (cache.visible) {
    if (cached === undefined || cached.projection.receipt.confirmation === 'unknown' || cached.canContinueOriginal === true) offlineKind = 'pending';
    else if (cached.materializationFailure !== undefined || (cached.progress?.failedChapters ?? 0) > 0 ||
      (cached.projection.receipt.confirmation === 'undispatched' && cached.projection.receipt.readback === 'failed')) offlineKind = 'result';
    else if (offlineReadbackFailed) offlineKind = 'readback';
  }
  if (cached?.projection.receipt.confirmation === 'unknown' && offlineKind === 'pending' &&
    !cache.message.startsWith('离线操作结果尚未确认')) {
    cache = { ...cache, message: `离线操作结果尚未确认；${cache.message}` };
  }
  bookmarks = { ...bookmarks, visible: bookmarksKind !== 'none' };
  cache = { ...cache, visible: offlineKind !== 'none' };
  return { presentationId, bookmarks, offline: cache, bookmarksKind, offlineKind,
    bookmarksReadbackFailed, offlineReadbackFailed,
    bookmarksBusy: dir?.projection.receipt.readback === 'reading', offlineBusy: cached?.projection.receipt.readback === 'reading',
    canContinueBookmarks: dir?.canContinueOriginal === true, canContinueOffline: cached?.canContinueOriginal === true,
    offlineBlocked: offline?.action === 'clear' && offline.projection.receipt.confirmation === 'unknown' && offline.blockingClear?.active !== false };
}
