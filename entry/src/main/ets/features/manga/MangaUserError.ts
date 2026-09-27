/** Presentation only. Callers retain the original failure and receipt state. */
export function mangaUserError(code: string): string {
  switch (code) {
    case 'READING_IMAGE_AUTH_REQUIRED': return '书源需要登录或验证。请完成登录后重试图片。';
    case 'READING_IMAGE_ACCESS_DENIED': return '书源拒绝了图片请求。可尝试登录验证，或切换书源。';
    case 'READING_IMAGE_SIGNATURE_EXPIRED': return '图片链接已过期。自动刷新未完成，请重新获取本章图片。';
    case 'READING_IMAGE_RATE_LIMITED': return '书源请求过于频繁，请稍后重试。';
    case 'READING_IMAGE_HTTP_FAILED': return '图片服务暂时不可用，请稍后重试。';
    case 'MANGA_SOURCE_LOGIN_UNAVAILABLE': return '这个书源没有提供登录入口，请检查书源配置或切换书源。';
    case 'MANGA_REGION_FORMAT_UNSUPPORTED': return '暂不支持这张图片的格式，目前支持静态 JPEG、PNG 和 WebP。可尝试其他章节或书源。';
    case 'MANGA_REGION_ANIMATION_UNSUPPORTED': return '这张图片包含动画，暂时无法作为漫画页面阅读。可尝试其他书源。';
    case 'MANGA_REGION_TRANSFORM_MISMATCH': return '设备未能正确调整这张图片的方向，请重试或更换书源。';
    case 'MANGA_LOGIN_IN_PROGRESS': return '登录验证正在进行，请完成后再重试图片。';
    case 'MANGA_REGION_METADATA_UNAVAILABLE': return '无法确认这张图片的显示方向，暂时无法安全显示。可尝试重新获取图片或更换书源。';
    case 'MANGA_REGION_OUT_OF_RANGE': return '这张图片的尺寸超出当前阅读支持范围，暂时无法显示。可尝试其他书源。';
    case 'MANGA_REGION_DECODE_MISMATCH': return '设备未能正确解码这张长图。请重试，或尝试其他书源。';
    case 'REMOTE_READING_IMAGE_NOT_DOWNLOADED': return '这张图片尚未下载。请联网后重新获取本章图片。';
    case 'MANGA_POSITION_RECOVERY_REQUIRED': return '章节内容已更新，请先确认阅读位置，再继续保存进度。';
    case 'MANGA_REFRESH_REQUIRES_NETWORK': return '重新获取图片需要联网，请连接网络后重试。';
    case 'MANGA_ADMISSION_SOURCE_CHANGED':
    case 'MANGA_SWITCH_SOURCE_CHANGED': return '书源规则已更新，请重新打开详情并获取章节。';
    case 'MANGA_RESOURCE_HOST_UNAVAILABLE': return '图片读取服务尚未就绪，请返回后重新打开。';
    case 'MANGA_IMAGE_FAILED':
    case 'MANGA_TILE_FAILED': return '图片暂时无法加载，请重试。';
    default: return code;
  }
}
