import { readerMainTabItemHeight } from '../common/ReaderFloatingBarMetrics';
import { ReaderWindowCoordinator } from '../../app/ReaderWindowCoordinator';
import { isReaderMainTabEnabled } from '../../app/ReaderProductScope';
import {
  readerInteractiveSafeBottom,
  readerInteractiveSafeLeft,
  readerVisualSafeTop,
} from '../common/ReaderWindowMetrics';
import { READER_EXPANDED_MIN_WIDTH } from '../common/ReaderWidthClass';

export type MainNavigationMode = 'rail' | 'bottom';

export interface MainViewport { width: number; height: number; }

/** Main shells measure the full content host, after Index consumes safe top.
 * Pages and navigation read this same receipt; no padded child republishes it. */
export function publishReaderMainViewport(width: number, height: number): void {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return;
  const previous = AppStorage.get<MainViewport>('readerMainViewport');
  if (previous !== undefined && Math.abs(previous.width - width) < 0.01 &&
    Math.abs(previous.height - height) < 0.01) return;
  AppStorage.setOrCreate<MainViewport>('readerMainViewport', { width, height });
  AppStorage.setOrCreate<number>('readerMainViewportRevision',
    (AppStorage.get<number>('readerMainViewportRevision') ?? 0) + 1);
}

export function readerMainViewport(_revision: number = 0): MainViewport {
  const measured = AppStorage.get<MainViewport>('readerMainViewport');
  if (measured !== undefined) return measured;
  const metrics = ReaderWindowCoordinator.metrics();
  return { width: metrics.windowRect.width,
    height: Math.max(0, metrics.windowRect.height - readerVisualSafeTop(metrics)) };
}


export interface MainTabDef {
  key: string;
  label: string;
}

const ALL_MAIN_TABS: MainTabDef[] = [
  { key: 'bookshelf', label: '书架' },
  { key: 'discover', label: '发现' },
  { key: 'rss', label: 'RSS' },
  { key: 'settings', label: '设置' },
];

export const MAIN_TABS: MainTabDef[] = ALL_MAIN_TABS.filter(
  (tab: MainTabDef): boolean => isReaderMainTabEnabled(tab.key),
);

export const WIDE_NAVIGATION_RAIL_STORAGE_KEY = 'readerWideNavigationRail';
export const MAIN_TAB_RAIL_WIDTH = 82;
export const MAIN_TAB_RAIL_LEFT_GAP = 17;
export const MAIN_TAB_RAIL_CONTENT_GAP = 20;
export const MAIN_TAB_RAIL_CONTENT_RIGHT_GAP = 21;
export const MAIN_TAB_RAIL_PADDING = 8;
export const MAIN_TAB_RAIL_ITEM_GAP = 6;
export const MAIN_TAB_BOTTOM_WIDTH_PER_TAB = 98;
export const MAIN_TAB_BOTTOM_MAX_WIDTH = 360;

const RAIL_PAIR_GAP = 24;

export function mainTabRailItemHeight(fontScale: number = 1): number {
  return readerMainTabItemHeight(fontScale, true);
}

export function mainTabRailHeight(tabCount: number, fontScale: number = 1): number {
  const count = Math.max(1, Math.floor(tabCount));
  return count * mainTabRailItemHeight(fontScale) + (count - 1) * MAIN_TAB_RAIL_ITEM_GAP +
    MAIN_TAB_RAIL_PADDING * 2;
}

export function mainTabBottomWidth(tabCount: number): number {
  return Math.min(MAIN_TAB_BOTTOM_MAX_WIDTH,
    MAIN_TAB_BOTTOM_WIDTH_PER_TAB * Math.max(1, Math.floor(tabCount)));
}

export function mainNavigationMode(useRail: boolean, viewportWidth: number, windowHeight: number,
  safeTop: number, safeBottom: number, tabCount: number, fontScale: number = 1): MainNavigationMode {
  if (!useRail || !Number.isFinite(viewportWidth) || viewportWidth < READER_EXPANDED_MIN_WIDTH) return 'bottom';
  const availableHeight = Math.max(0, windowHeight - Math.max(0, safeTop) - Math.max(0, safeBottom));
  return availableHeight >= mainTabRailHeight(tabCount, fontScale) + RAIL_PAIR_GAP ? 'rail' : 'bottom';
}

export function mainTabRailTop(windowHeight: number, safeTop: number, safeBottom: number,
  tabCount: number, fontScale: number = 1): number {
  const availableHeight = Math.max(0, windowHeight - Math.max(0, safeTop) - Math.max(0, safeBottom));
  return Math.max(0, (availableHeight - mainTabRailHeight(tabCount, fontScale)) / 2);
}

export function readerMainNavigationMode(useRail: boolean, revision: number = 0, _metricsRevision: number = 0): MainNavigationMode {
  const metrics = ReaderWindowCoordinator.metrics();
  const viewport = readerMainViewport(revision);
  return mainNavigationMode(useRail, viewport.width, viewport.height,
    0, readerInteractiveSafeBottom(metrics), MAIN_TABS.length, metrics.systemFontScale);
}

export function readerMainRailLeft(_metricsRevision: number = 0): number {
  return Math.max(MAIN_TAB_RAIL_LEFT_GAP, readerInteractiveSafeLeft(ReaderWindowCoordinator.metrics()));
}

export function readerMainRailLeading(): number {
  return readerMainRailLeft() + MAIN_TAB_RAIL_WIDTH;
}

export function readerMainRailContentLeft(): number {
  return readerMainRailLeading() + MAIN_TAB_RAIL_CONTENT_GAP;
}

export function readerMainRailContentRight(): number {
  return MAIN_TAB_RAIL_CONTENT_RIGHT_GAP;
}

export function readerMainRailTop(revision: number = 0, _metricsRevision: number = 0): number {
  const metrics = ReaderWindowCoordinator.metrics();
  return mainTabRailTop(readerMainViewport(revision).height, 0,
    readerInteractiveSafeBottom(metrics), MAIN_TABS.length, metrics.systemFontScale);
}

export function readerMainRailBottomInset(): number {
  return Math.max(24, readerInteractiveSafeBottom(ReaderWindowCoordinator.metrics()));
}
