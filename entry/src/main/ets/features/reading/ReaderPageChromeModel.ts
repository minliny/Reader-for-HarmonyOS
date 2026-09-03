/**
 * Immutable page-owned metadata rendered together with one physical page.
 *
 * Text/content acquisition remains outside this module. The model only
 * formats already-known canonical reading facts and provides stable cache
 * identities for page-chrome and composed-page rasters.
 */
export class ReaderPageChromeSnapshot {
  topStartText: string;
  topEndText: string;
  bottomStartText: string;
  bottomEndText: string;
  sessionVisible: boolean;
  sessionWidth: number;
  sessionHeight: number;

  constructor(
    topStartText: string = '',
    topEndText: string = '',
    bottomStartText: string = '',
    bottomEndText: string = '',
    sessionVisible: boolean = false,
    sessionWidth: number = 0,
    sessionHeight: number = 0,
  ) {
    this.topStartText = topStartText;
    this.topEndText = topEndText;
    this.bottomStartText = bottomStartText;
    this.bottomEndText = bottomEndText;
    this.sessionVisible = sessionVisible && sessionWidth > 0 && sessionHeight > 0;
    this.sessionWidth = this.sessionVisible ? sessionWidth : 0;
    this.sessionHeight = this.sessionVisible ? sessionHeight : 0;
  }
}

export class ReaderPageOrdinal {
  pageIndex: number;
  pageCount: number | undefined;

  constructor(pageIndex: number, pageCount?: number) {
    this.pageIndex = pageIndex;
    this.pageCount = pageCount;
  }
}

export function formatReaderPageClock(epochMillis: number): string {
  const date = new Date(epochMillis);
  if (!Number.isFinite(date.getTime())) {
    return '';
  }
  const hour = date.getHours().toString().padStart(2, '0');
  const minute = date.getMinutes().toString().padStart(2, '0');
  return `${hour}:${minute}`;
}

export function formatReaderPageProgress(percent: number): string {
  return `${Math.round(clampPercent(percent))}%`;
}

export function formatReaderPageOrdinal(ordinal: ReaderPageOrdinal | undefined): string {
  if (ordinal === undefined || !Number.isSafeInteger(ordinal.pageIndex) || ordinal.pageIndex < 0) {
    return '';
  }
  const current = ordinal.pageIndex + 1;
  if (ordinal.pageCount !== undefined && Number.isSafeInteger(ordinal.pageCount) &&
    ordinal.pageCount >= current) {
    return `第 ${current} / ${ordinal.pageCount} 页`;
  }
  return `第 ${current} 页`;
}

/** Cache identity for the page-owned chrome raster only. */
export function readerPageChromeCacheKey(
  pageIdentity: string,
  snapshot: ReaderPageChromeSnapshot,
  themeIdentity: string,
  layoutIdentity: string,
): string {
  return [
    'reader-page-chrome-v2',
    encodeKeyPart(pageIdentity),
    encodeKeyPart(snapshot.topStartText),
    encodeKeyPart(snapshot.topEndText),
    encodeKeyPart(snapshot.bottomStartText),
    encodeKeyPart(snapshot.bottomEndText),
    snapshot.sessionVisible ? `session=${snapshot.sessionWidth}x${snapshot.sessionHeight}` : 'session=0',
    encodeKeyPart(themeIdentity),
    encodeKeyPart(layoutIdentity),
  ].join('|');
}

/** Body and chrome stay independently cacheable, then join at composition. */
export function readerComposedPageTextureKey(bodyRasterKey: string, chromeRasterKey: string): string {
  return `reader-page-composed-v1|body=${encodeKeyPart(bodyRasterKey)}|chrome=${encodeKeyPart(chromeRasterKey)}`;
}

export function readerPageBodyRasterKey(
  pageIdentity: string,
  contentRevision: string,
  layoutIdentity: string,
  appearanceIdentity: string,
): string {
  return [
    'reader-page-body-v1',
    encodeKeyPart(pageIdentity),
    encodeKeyPart(contentRevision),
    encodeKeyPart(layoutIdentity),
    encodeKeyPart(appearanceIdentity),
  ].join('|');
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(100, value));
}

function encodeKeyPart(value: string): string {
  return `${value.length}:${value}`;
}
