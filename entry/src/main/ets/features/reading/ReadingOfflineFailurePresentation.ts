import { errorMessageOf, isDomainResolutionFailure, isNetworkEnvironmentFailure } from '../../app/ErrorMessage';
import { diagnosticCodeOf } from '../../app/LogPrivacy';
import { normalizeReadingOfflineMaterializationError } from './ReadingOfflineContract';

/** Fixed public copy only; the original error remains with its owner. */
export function readingOfflineFailureHint(error: Error): string {
  const text = errorMessageOf(error);
  const failure = normalizeReadingOfflineMaterializationError(error);
  const category = diagnosticCodeOf(text);
  if (text === 'MANGA_DOWNLOAD_PAUSED_RESUME_REQUIRED') return '本话下载已暂停，请在下载管理中选择继续下载';
  if (failure.code === 'cancelled' || category === 'CANCELLED') return '';
  if (failure.code === 'storage_full' || category === 'NO_SPACE' ||
    text === 'MANGA_CACHE_STORAGE_FULL' || text === 'MANGA_CHAPTER_CACHE_CAPACITY' ||
    text === 'ENOSPC' || text.includes('13900025')) return '存储空间不足，请释放空间后重试。';
  if (isDomainResolutionFailure(error)) return '当前网络无法解析书源域名，请检查代理或网络连接后重试。';
  if (isNetworkEnvironmentFailure(error) || category === 'NETWORK') return '当前网络无法完成下载，请检查代理或网络连接后重试。';
  if (category === 'TIMEOUT') return '下载请求超时，请稍后重试。';
  return '请稍后重试。';
}
