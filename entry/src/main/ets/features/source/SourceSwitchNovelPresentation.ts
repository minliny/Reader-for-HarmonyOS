import type { SourceSwitchCandidate } from './SourceSwitchGateway';
import { SOURCE_SWITCH_VISUAL as visual } from './SourceSwitchVisual.ts';

/** Cached successes never fabricate a current search timing. */
export function sourceSwitchNovelChapter(candidate: SourceSwitchCandidate): string {
  return candidate.latestChapterTitle?.trim() || '暂无最新章节';
}
export function sourceSwitchNovelLatency(candidate: SourceSwitchCandidate): string {
  const latency = candidate.latencyMs;
  return candidate.latencyKind === 'search' && latency !== undefined && Number.isFinite(latency) && latency >= 0 ?
    `${Math.round(latency)} ms` : '—';
}
export function sourceSwitchNovelScale(fontScale: number): number {
  return Number.isFinite(fontScale) && fontScale > 0 ? fontScale : 1;
}
export function sourceSwitchNovelCompact(height: number): boolean {
  return Number.isFinite(height) && height > 0 && height < visual.shortHeightThreshold;
}
export function sourceSwitchNovelDrawerHeight(height: number, safeTop: number): number {
  const available = Number.isFinite(height) ? Math.max(0, height) : 0;
  const top = Number.isFinite(safeTop) ? Math.max(0, safeTop) : 0;
  return Math.max(0, available - Math.max(top, sourceSwitchNovelCompact(available) ? 0 : visual.drawerTopReserve));
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
  return Math.max(compact ? visual.compactDiscoveryActionWidth : visual.discoveryActionWidth,
    4 * fontSize * scale + visual.discoveryActionIconSize + visual.discoveryActionGap + 2 * paddingX);
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
