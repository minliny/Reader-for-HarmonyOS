import type { RemoteReadingFailureKind } from './RemoteContentAdmission';

/** Public copy only. The owning operation retains the original diagnostic. */
export function readingFailureHint(code: string, kind?: RemoteReadingFailureKind): string {
  if (code === 'ENOSPC' || code === 'NO_SPACE' || code === 'MANGA_CACHE_STORAGE_FULL') {
    return '存储空间不足，请清理可重建缓存或释放空间后重试。';
  }
  switch (kind ?? code) {
    case 'SOURCE_AUTH_REQUIRED': return '书源需要登录或验证，请完成验证后重试。';
    case 'SOURCE_PAYWALL': return '此章节需要书源授权，请检查购买或登录状态。';
    case 'SOURCE_TOC_EMPTY': return '暂未获取到目录，请重试或切换书源。';
    case 'SOURCE_CONTENT_EMPTY': return '暂未获取到本章正文，请重试或切换书源。';
    case 'SOURCE_HTTP_FAILED':
    case 'NETWORK_ENVIRONMENT': return '当前网络无法获取正文，请检查网络连接后重试。';
    case 'SOURCE_PARSE_FAILED': return '书源暂时无法解析本章，请重试或切换书源。';
    case 'POSITION_CONTEXT_STALE': return '章节内容已变化，原位置暂时无法对应，请重新打开本章。';
    case 'STORAGE_FAILED': return '本地内容暂时无法读写，请检查存储空间后重试。';
    case 'PAGINATION_FAILED':
    case 'LAYOUT_FAILED':
    case 'RENDER_FAILED': return '本章暂时无法显示，请重试或调整阅读设置。';
    default: return '正文暂时无法加载，请重试；仍失败时可返回后重新打开。';
  }
}
