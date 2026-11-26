import type { SourceSwitchCandidate } from '../application/SourceSwitchGateway';
import { SOURCE_SWITCH_VISUAL as visual } from './SourceSwitchVisual.ts';
import { bookSearchDuration as sourceSwitchSearchLatency } from '../../../app/library/BookSearchTiming.ts';
import { readerCompactSearchHeight, SEARCH_CONTROL_MIN_TARGET } from '../../../ui/foundation/ReaderSearchControlGeometry';

export { sourceSwitchSearchLatency };

/** The approved native two-glyph refresh/stop variant uses the base visual
 * typography, icon and padding. The older reference uses a four-glyph slot. */
export const SOURCE_SWITCH_DISCOVERY_ACTION = {
  refreshLabel: '重查',
  stopLabel: '停止',
  minimumWidth: 64,
  compactMinimumWidth: 58,
  labelReserve: 4,
};

export const SOURCE_SWITCH_FILTER_GAP = 4;

export function sourceSwitchNovelFilterRowHeight(fontScale: number): number {
  return readerCompactSearchHeight(36, visual.discoveryActionLineHeight, fontScale);
}

export function sourceSwitchNovelFilterHeight(fontScale: number, sweepProgressVisible: boolean): number {
  const scale = sourceSwitchNovelScale(fontScale);
  const sortingHeight = Math.max(SEARCH_CONTROL_MIN_TARGET, Math.ceil(visual.discoveryActionLineHeight * scale + 12)) + 2;
  const sweepHeight = sweepProgressVisible ? Math.ceil(11 * 1.5 * scale) + 7 + SOURCE_SWITCH_FILTER_GAP : 0;
  return sourceSwitchNovelFilterRowHeight(scale) + sortingHeight + 2 * SOURCE_SWITCH_FILTER_GAP + sweepHeight;
}

export function sourceSwitchNovelChapter(candidate: SourceSwitchCandidate): string {
  return candidate.latestChapterTitle?.trim() || '暂无最新章节';
}
export function sourceSwitchNovelLatency(candidate: SourceSwitchCandidate, allowCachedLatency: boolean = false): string {
  const latency = sourceSwitchSearchLatency(candidate, allowCachedLatency);
  return latency === undefined ? '—' : `${Math.round(latency)} ms`;
}
export function sourceSwitchNovelScale(fontScale: number): number {
  return Number.isFinite(fontScale) && fontScale > 0 ? fontScale : 1;
}
export function sourceSwitchNovelCompact(height: number): boolean {
  return Number.isFinite(height) && height > 0 && height < visual.shortHeightThreshold;
}
export function sourceSwitchNovelDrawerHeight(height: number, safeTop: number, side: boolean = false): number {
  const available = Number.isFinite(height) ? Math.max(0, height) : 0;
  const top = Number.isFinite(safeTop) ? Math.max(0, safeTop) : 0;
  return side ? available : Math.max(0, Math.min(available - top, available * .82));
}

export function sourceSwitchCandidateMatches(candidate: SourceSwitchCandidate, query: string): boolean {
  const needle = query.trim().toLowerCase();
  return needle.length === 0 || (candidate.sourceName || candidate.sourceId).toLowerCase().includes(needle) ||
    (candidate.latestChapterTitle ?? '').toLowerCase().includes(needle);
}

/** Recognize a chapter number only when it is marked as a chapter. A date or
 * bare number inside prose does not give the candidate a fabricated rank. */
export function sourceSwitchChapterOrdinal(title: string): number {
  const match = /(?:第\s*)?([0-9]+|[零〇一二两兩三四五六七八九十百千万萬]+)\s*[章话話回节節]/u.exec(title.normalize('NFKC'));
  if (match === null) return 0;
  const numeric = Number(match[1]);
  if (/^[0-9]+$/.test(match[1])) return Number.isSafeInteger(numeric) ? numeric : 0;
  const chinese = match[1].replace(/[〇]/g, '零').replace(/[两兩]/g, '二').replace(/萬/g, '万');
  let total = 0, section = 0, pending = 0;
  for (const symbol of chinese) {
    const digit = '零一二三四五六七八九'.indexOf(symbol);
    if (digit >= 0) pending = pending * 10 + digit;
    else if (symbol === '万') { total += (section + pending || 1) * 10000; section = 0; pending = 0; }
    else { section += (pending || 1) * (symbol === '千' ? 1000 : symbol === '百' ? 100 : 10); pending = 0; }
  }
  return Number.isSafeInteger(total + section + pending) ? total + section + pending : 0;
}

function compareLatency(left: SourceSwitchCandidate, right: SourceSwitchCandidate, allowCachedLatency: boolean): number {
  const a = sourceSwitchSearchLatency(left, allowCachedLatency);
  const b = sourceSwitchSearchLatency(right, allowCachedLatency);
  if (a === undefined) return b === undefined ? 0 : 1;
  return b === undefined ? -1 : a - b;
}

/** "延迟优先": measured search latency ascending; unmeasured rows keep provider order at the end. */
export function sourceSwitchOrderByLatency(candidates: SourceSwitchCandidate[], allowCachedLatency: boolean = false): SourceSwitchCandidate[] {
  return candidates.slice().sort((left, right) => compareLatency(left, right, allowCachedLatency));
}

/** "最新章优先": highest marked chapter first; equal chapters fall back to the faster source. */
export function sourceSwitchOrderByChapter(candidates: SourceSwitchCandidate[], allowCachedLatency: boolean = false): SourceSwitchCandidate[] {
  return candidates.map((candidate: SourceSwitchCandidate, index: number) => ({ candidate, index,
    ordinal: sourceSwitchChapterOrdinal(candidate.latestChapterTitle ?? '') }))
    .sort((left, right) => right.ordinal - left.ordinal || compareLatency(left.candidate, right.candidate, allowCachedLatency) ||
      left.index - right.index).map(item => item.candidate);
}
export function sourceSwitchNovelRowHeight(fontScale: number): number {
  return visual.rowHeight * sourceSwitchNovelScale(fontScale);
}
export function sourceSwitchNovelBookHeight(fontScale: number): number {
  const scale = sourceSwitchNovelScale(fontScale);
  return scale === 1 ? visual.bookHeight : Math.max(visual.bookHeight, visual.bookPaddingY * 2 + visual.bookMetadataLineBoxes * scale);
}
export function sourceSwitchNovelHeadingHeight(fontScale: number): number {
  return Math.max(visual.headingHeight, visual.titleLineHeight * sourceSwitchNovelScale(fontScale));
}
export function sourceSwitchNovelDiscoveryCompact(width: number, fontScale: number): boolean {
  return width / Math.max(1, sourceSwitchNovelScale(fontScale)) <= visual.discoveryCompactWidthThreshold;
}
export function sourceSwitchNovelDiscoveryPrefixVisible(width: number, fontScale: number): boolean {
  return width / Math.max(1, sourceSwitchNovelScale(fontScale)) > visual.discoveryPrefixWidthThreshold;
}
export function sourceSwitchNovelDiscoveryActionWidth(width: number, fontScale: number): number {
  const compact = sourceSwitchNovelDiscoveryCompact(width, fontScale);
  const scale = sourceSwitchNovelScale(fontScale);
  const fontSize = compact ? visual.compactDiscoveryActionFontSize : visual.discoveryActionFontSize;
  const paddingX = compact ? visual.compactDiscoveryActionPaddingX : visual.discoveryActionPaddingX;
  const action = SOURCE_SWITCH_DISCOVERY_ACTION;
  const labelWidth = Math.max(action.refreshLabel.length, action.stopLabel.length) * fontSize * scale;
  const minimum = compact ? action.compactMinimumWidth : action.minimumWidth;
  return Math.ceil(Math.max(minimum,
    labelWidth + visual.discoveryActionIconSize + visual.discoveryActionGap + 2 * paddingX + action.labelReserve));
}
export function sourceSwitchNovelDiscoveryActionVisibleHeight(fontScale: number): number {
  return Math.max(visual.discoveryActionVisibleHeight,
    visual.discoveryActionLineHeight * sourceSwitchNovelScale(fontScale) + visual.discoveryActionPaddingY * 2);
}
export function sourceSwitchNovelDiscoveryActionHitHeight(fontScale: number): number {
  return Math.max(visual.discoveryActionMinHeight,
    sourceSwitchNovelDiscoveryActionVisibleHeight(fontScale) + visual.discoveryActionInsetY * 2);
}
export function sourceSwitchNovelDiscoveryToolbarHeight(fontScale: number, narrow: boolean): number {
  const scale = sourceSwitchNovelScale(fontScale);
  const countLine = Math.max(visual.discoveryCountLineHeight,
    narrow ? visual.narrowDiscoveryStatusLineHeight : visual.discoveryStatusLineHeight);
  return Math.max(visual.discoveryHeight, (countLine + visual.discoveryPhaseLineHeight) * scale,
    sourceSwitchNovelDiscoveryActionHitHeight(scale));
}
export function sourceSwitchNovelDiscoveryHeight(fontScale: number, narrow: boolean): number {
  return sourceSwitchNovelDiscoveryToolbarHeight(fontScale, narrow) + visual.discoveryBottomGap;
}
export function sourceSwitchNovelColumnHeight(fontScale: number, compact: boolean): number {
  return Math.max(compact ? visual.compactColumnHeight : visual.columnHeight,
    visual.columnLineHeight * sourceSwitchNovelScale(fontScale) + visual.columnTextPaddingY);
}
export function sourceSwitchNovelFooterHeight(fontScale: number, compact: boolean): number {
  return Math.max(compact ? visual.compactFooterHeight : visual.footerHeight,
    visual.footerLineHeight * sourceSwitchNovelScale(fontScale) + visual.footerTextPaddingY);
}
export function sourceSwitchNovelTimingWidth(fontScale: number, narrow: boolean): number {
  return (narrow ? visual.narrowTimingColumnWidth : visual.timingColumnWidth) * Math.max(1, sourceSwitchNovelScale(fontScale));
}
