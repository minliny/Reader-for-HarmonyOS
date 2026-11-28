export interface SearchSourceSummary {
  primarySource: string;
  multiSourceLabel: string;
}

function isLeadingDecorativeCodePoint(cp: number): boolean {
  return (cp >= 0x1F000 && cp <= 0x1FAFF) ||
    (cp >= 0x2600 && cp <= 0x27BF) ||
    (cp >= 0x2300 && cp <= 0x23FF) ||
    (cp >= 0x25A0 && cp <= 0x25FF) ||
    (cp >= 0x2B00 && cp <= 0x2BFF) ||
    (cp >= 0xFE00 && cp <= 0xFE0F) ||
    cp === 0x200D ||
    cp === 0x20E3 ||
    (cp >= 0xE0020 && cp <= 0xE007F);
}

function isTrailingPrefixSeparator(cp: number): boolean {
  return cp <= 0x20 || cp === 0x3000 || cp === 0x00B7 || cp === 0x2022 || cp === 0x007C;
}

/**
 * Strip leading decorative emoji/symbols for search result display only.
 * Persisted source names and pure-emoji names remain intact via fallback.
 */
export function cleanDisplaySourceName(sourceName: string): string {
  const trimmed = sourceName.trim();
  if (trimmed.length === 0) return '';
  let index = 0;
  let strippedDecorative = false;
  while (index < trimmed.length) {
    const cp = trimmed.codePointAt(index);
    if (cp === undefined) break;
    const step = cp > 0xFFFF ? 2 : 1;
    if (isLeadingDecorativeCodePoint(cp)) {
      strippedDecorative = true;
      index += step;
      continue;
    }
    if (strippedDecorative && isTrailingPrefixSeparator(cp)) {
      index += step;
      continue;
    }
    break;
  }
  const cleaned = trimmed.slice(index).trim();
  return cleaned.length > 0 ? cleaned : trimmed;
}

export function formatSearchSourceSummary(sourceName: string, sourceCount: number): SearchSourceSummary {
  const primarySource = cleanDisplaySourceName(sourceName);
  const count = Number.isFinite(sourceCount) ? Math.max(0, Math.floor(sourceCount)) : 0;
  if (count > 1) {
    return {
      primarySource,
      multiSourceLabel: primarySource.length > 0 ? `等 ${count} 个书源` : `发现 ${count} 个书源`,
    };
  }
  return {
    primarySource,
    multiSourceLabel: primarySource.length > 0 ? '' : (count === 1 ? '1 个书源' : ''),
  };
}

export function formatSearchInitialEmptyHint(enabledSourceCount: number | undefined): string {
  if (enabledSourceCount !== undefined && Number.isFinite(enabledSourceCount) && Math.floor(enabledSourceCount) > 0) {
    return `暂无搜索历史 · 可搜索本地书架与 ${Math.floor(enabledSourceCount)} 个已启用书源`;
  }
  return '暂无搜索历史 · 可输入书名或作者搜索本地与在线书籍';
}
