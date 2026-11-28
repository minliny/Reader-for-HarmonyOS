export const BOOK_COVER_FAILURE_TTL_MS: number = 24 * 60 * 60 * 1000;
const MAX_FAILED_COVER_ENTRIES = 256;

export interface BookCoverFailureEntry {
  readonly url: string;
  readonly failedAtMs: number;
}

/** Native book-cover input only. This does not change source metadata or
 * parse source request formats; a missing/unsupported input stays absent. */
export function bookCoverDisplayUrl(value: string | undefined): string | undefined {
  const url = value?.trim();
  return url !== undefined && /^(https?:\/\/[^\s/]+(?:\/\S*)?|data:image\/(png|jpeg|bmp|webp);base64,\S+|file:\/\/\S+)$/.test(url) ? url : undefined;
}

export function bookContentKindLabel(sourceId: string, contentKind: string | undefined): string {
  if (contentKind === 'manga') return '漫画';
  if (contentKind === 'audio') return '有声';
  return contentKind === 'text' || sourceId === 'local' ? '小说' : '';
}

export function rememberBookCoverFailure(current: string[], url: string): string[] {
  if (current.includes(url)) return current;
  const retained = current.slice(Math.max(0, current.length - (MAX_FAILED_COVER_ENTRIES - 1)));
  retained.push(url);
  return retained;
}

export function pruneBookCoverFailureEntries(
  entries: readonly BookCoverFailureEntry[],
  nowMs: number,
  ttlMs: number = BOOK_COVER_FAILURE_TTL_MS,
): BookCoverFailureEntry[] {
  const effectiveNow = Number.isFinite(nowMs) ? nowMs : 0;
  const effectiveTtl = Number.isFinite(ttlMs) && ttlMs > 0 ? ttlMs : BOOK_COVER_FAILURE_TTL_MS;
  const latestByUrl = new Map<string, BookCoverFailureEntry>();
  for (const entry of entries) {
    const url = bookCoverDisplayUrl(entry.url);
    if (url === undefined || !Number.isFinite(entry.failedAtMs) || entry.failedAtMs < 0) continue;
    if (effectiveNow - entry.failedAtMs >= effectiveTtl) continue;
    const existing = latestByUrl.get(url);
    if (existing !== undefined) {
      if (existing.failedAtMs > entry.failedAtMs) continue;
      latestByUrl.delete(url);
    }
    latestByUrl.set(url, { url, failedAtMs: entry.failedAtMs });
  }
  const normalized = Array.from(latestByUrl.values());
  return normalized.length <= MAX_FAILED_COVER_ENTRIES
    ? normalized
    : normalized.slice(normalized.length - MAX_FAILED_COVER_ENTRIES);
}

export function recordBookCoverFailureEntry(
  entries: readonly BookCoverFailureEntry[],
  url: string,
  nowMs: number,
  ttlMs: number = BOOK_COVER_FAILURE_TTL_MS,
): BookCoverFailureEntry[] {
  const normalizedUrl = bookCoverDisplayUrl(url);
  if (normalizedUrl === undefined) {
    return pruneBookCoverFailureEntries(entries, nowMs, ttlMs);
  }
  const next = pruneBookCoverFailureEntries(entries, nowMs, ttlMs).filter(
    (entry: BookCoverFailureEntry): boolean => entry.url !== normalizedUrl,
  );
  next.push({ url: normalizedUrl, failedAtMs: Number.isFinite(nowMs) && nowMs >= 0 ? nowMs : 0 });
  return next.length <= MAX_FAILED_COVER_ENTRIES
    ? next
    : next.slice(next.length - MAX_FAILED_COVER_ENTRIES);
}

export function parseBookCoverFailureCache(
  raw: string,
  nowMs: number,
  ttlMs: number = BOOK_COVER_FAILURE_TTL_MS,
): BookCoverFailureEntry[] {
  try {
    const parsed: Object = JSON.parse(raw) as Object;
    if (!Array.isArray(parsed)) return [];
    const candidates: BookCoverFailureEntry[] = [];
    for (const item of parsed as Object[]) {
      if (item === null || typeof item !== 'object') continue;
      const record = item as Record<string, Object>;
      if (typeof record['url'] === 'string' && typeof record['failedAtMs'] === 'number') {
        candidates.push({ url: record['url'], failedAtMs: record['failedAtMs'] });
      }
    }
    return pruneBookCoverFailureEntries(candidates, nowMs, ttlMs);
  } catch (_error) {
    return [];
  }
}

export function serializeBookCoverFailureCache(entries: readonly BookCoverFailureEntry[]): string {
  return JSON.stringify(entries);
}
