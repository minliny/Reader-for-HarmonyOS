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
}
const EMPTY_VIEW: ReaderRecoveryView = { message: '', visible: false, canRetry: false, generation: 0 };
export const EMPTY_READING_DIRECTORY_RECOVERY: ReadingDirectoryRecovery = { presentationId: '',
  bookmarks: EMPTY_VIEW, offline: EMPTY_VIEW, canContinueBookmarks: false, canContinueOffline: false };

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
  return { presentationId, bookmarks, offline: cache,
    canContinueBookmarks: dir?.canContinueOriginal === true, canContinueOffline: cached?.canContinueOriginal === true,
    offlineBlocked: offline?.action === 'clear' && offline.projection.receipt.confirmation === 'unknown' && offline.blockingClear?.active !== false };
}
