/**
 * A source category is part of the source identity used by the Reader UI.
 * Non-text declarations are authoritative. Many exports incorrectly use the
 * default type 0 for media sources, so strong media metadata must also be
 * checked before admitting a source to the text reader. Other categories
 * remain visible and manageable, but are never sent through the novel search,
 * detail, TOC, or reading pipeline.
 */
export type ReaderSourceCategory = 'novel' | 'comic' | 'music' | 'download' | 'external' | 'other';

export type ReaderSourceCategoryInput = {
  bookSourceType?: unknown;
  name?: string;
  group?: string;
  sourceId?: string;
  baseUrl?: string;
};

function normalizedType(value: unknown): string {
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') return value.trim().toLowerCase();
  return '';
}

function containsAny(value: string, needles: string[]): boolean {
  return needles.some((needle: string): boolean => value.indexOf(needle) >= 0);
}

/** Classify one source without mutating or rewriting its raw Legado payload. */
export function classifyReaderSource(input: ReaderSourceCategoryInput): ReaderSourceCategory {
  const type = normalizedType(input.bookSourceType);
  if (type === '1' || type === 'audio' || type === 'music' || type === '有声') return 'music';
  if (type === '2' || type === 'image' || type === 'manga' || type === 'comic' || type === '漫画') return 'comic';
  if (type === '3' || type === 'file' || type === 'download' || type === '下载') return 'download';
  if (type === '4' || type === 'video' || type === 'game' || type === 'external') return 'external';
  if (type.length > 0 && !['0', 'text', 'novel', '小说'].includes(type)) return 'other';

  const name = `${input.group ?? ''} ${input.name ?? ''}`.toLowerCase();
  // Explicit picture metadata, not an image/CDN URL, rejects mislabeled type 0 sources.
  if (containsAny(name, ['图片', '图库', '图集', '壁纸'])) return 'other';
  const url = `${input.sourceId ?? ''} ${input.baseUrl ?? ''}`.toLowerCase();
  const haystack = `${name} ${url}`;
  const comic = containsAny(haystack, ['漫画', '漫客', 'comic', 'manga', 'manhua', 'cartoon', 'ac.qq.com', 'mkzhan', 'baozimh', 'pixiv', '图站', '写真']);
  const music = containsAny(haystack, ['音乐', '有声', '听书', 'audio', 'music', 'ximalaya', 'missevan', 'lrts', '5sing']);
  const download = containsAny(haystack, ['下载', '书盘', 'download']) || /(?:^|[/:.])files?[./:]/.test(url);
  const external = containsAny(haystack, ['视频', 'video', 'vod', 'game', '游戏', 'player.', '动漫', 'gugu3', 'yikm.net']);
  // Ambiguous mixed-media sources must never silently enter novel results.
  const mediaCount = Number(comic) + Number(music) + Number(download) + Number(external);
  if (mediaCount > 1 || (mediaCount > 0 && /小说\s*[\/、+&]\s*(?:漫画|音乐|有声|视频)|(?:漫画|音乐|有声|视频)\s*[\/、+&]\s*小说/.test(name))) return 'other';
  if (comic) return 'comic';
  if (music) return 'music';
  if (download) return 'download';
  if (external) return 'external';
  return 'novel';
}

export function readerSourceCategoryLabel(category: ReaderSourceCategory): string {
  switch (category) {
    case 'novel': return '小说';
    case 'comic': return '漫画';
    case 'music': return '音乐/有声';
    case 'download': return '下载/文件';
    case 'external': return '视频/外部媒体';
    default: return '其他/混合';
  }
}

export function readerSourceCategoryIsText(category: ReaderSourceCategory): boolean {
  return category === 'novel';
}
