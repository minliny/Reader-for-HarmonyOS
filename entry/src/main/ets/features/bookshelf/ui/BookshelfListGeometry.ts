export const BOOKSHELF_LIST_COLUMN_GAP = 10;
export const BOOKSHELF_LIST_COVER_WIDTH = 60;
export const BOOKSHELF_LIST_COVER_HEIGHT = 82;
export const BOOKSHELF_LIST_CARD_PADDING = 12;
export const BOOKSHELF_LIST_DETAILS_GAP = BOOKSHELF_LIST_CARD_PADDING;
export const BOOKSHELF_COVER_GRID_RADIUS = 8;
export const BOOKSHELF_COVER_LIST_VISUAL_RADIUS = 6;
export const BOOKSHELF_VIEW_SWITCH_INCOMING_DELAY_MS = 60;

export interface BookshelfProjectionMetricsInput {
  contentWidth: number;
  expandedLayout: boolean;
  gridCardWidth: number;
  gridCoverHeight: number;
  gridColumnGap: number;
  gridCardHeightNoProgress: number;
  gridCardHeightWithProgress: number;
  listCoverWidth: number;
  listContentHeight: number;
  listRowHeight: number;
  listRowGap: number;
  gridTextGap: number;
}

export interface BookshelfProjectionMetrics {
  readonly contentWidth: number;
  readonly expandedLayout: boolean;
  readonly gridColumns: number;
  readonly listColumns: number;
  readonly gridCardWidth: number;
  readonly gridCoverHeight: number;
  readonly gridColumnGap: number;
  readonly gridCardHeightNoProgress: number;
  readonly gridCardHeightWithProgress: number;
  readonly listCardWidth: number;
  readonly listCoverWidth: number;
  readonly listRowGap: number;
  readonly listContentHeight: number;
  readonly listRowHeight: number;
  readonly listDetailsWidth: number;
  readonly coverListScale: number;
  readonly coverListRadius: number;
  readonly coverCompX: number;
  readonly coverCompY: number;
  readonly listDetailsX: number;
  readonly listDetailsY: number;
  readonly gridDetailsY: number;
}

export interface BookshelfViewSwitchPlan {
  readonly targetListProgress: number;
  readonly targetGridOpacity: number;
  readonly targetListOpacity: number;
  readonly outgoingTarget: 'grid' | 'list';
  readonly reflowDurationMs: number;
  readonly outgoingDurationMs: number;
  readonly incomingDelayMs: number;
  readonly incomingDurationMs: number;
  readonly safetyTimeoutMs: number;
}

export function bookshelfColumnCount(expanded: boolean, list: boolean = false): number {
  return list ? (expanded ? 2 : 1) : (expanded ? 4 : 3);
}

export function bookshelfListCardWidth(contentWidth: number, expanded: boolean): number {
  const columns = bookshelfColumnCount(expanded, true);
  return Math.max(0, (contentWidth - BOOKSHELF_LIST_COLUMN_GAP * (columns - 1)) / columns);
}

export function projectionListDetailsWidthValue(
  contentWidth: number,
  expandedLayout: boolean,
  listCoverWidth: number,
): number {
  return Math.max(
    0,
    bookshelfListCardWidth(contentWidth, expandedLayout) -
      listCoverWidth - 2 * BOOKSHELF_LIST_CARD_PADDING - BOOKSHELF_LIST_DETAILS_GAP,
  );
}

function clampUnitProgress(progress: number): number {
  if (!Number.isFinite(progress)) return 0;
  return progress <= 0 ? 0 : (progress >= 1 ? 1 : progress);
}

export function resolveBookshelfProjectionMetrics(
  input: BookshelfProjectionMetricsInput,
): BookshelfProjectionMetrics {
  const gridColumns = bookshelfColumnCount(input.expandedLayout, false);
  const listColumns = bookshelfColumnCount(input.expandedLayout, true);
  const listCardWidth = bookshelfListCardWidth(input.contentWidth, input.expandedLayout);
  const listDetailsWidth = projectionListDetailsWidthValue(
    input.contentWidth,
    input.expandedLayout,
    input.listCoverWidth,
  );
  const coverListScale = input.listCoverWidth / Math.max(1, input.gridCardWidth);
  const coverListRadius = BOOKSHELF_COVER_LIST_VISUAL_RADIUS / Math.max(0.01, coverListScale);
  const gridCenterX = input.gridCardWidth / 2;
  const listCenterX = BOOKSHELF_LIST_CARD_PADDING + input.listCoverWidth / 2;
  const gridCenterY = input.gridCoverHeight / 2;
  const listCenterY = input.listRowHeight / 2;
  return {
    contentWidth: input.contentWidth,
    expandedLayout: input.expandedLayout,
    gridColumns,
    listColumns,
    gridCardWidth: input.gridCardWidth,
    gridCoverHeight: input.gridCoverHeight,
    gridColumnGap: input.gridColumnGap,
    gridCardHeightNoProgress: input.gridCardHeightNoProgress,
    gridCardHeightWithProgress: input.gridCardHeightWithProgress,
    listCardWidth,
    listCoverWidth: input.listCoverWidth,
    listRowGap: input.listRowGap,
    listContentHeight: input.listContentHeight,
    listRowHeight: input.listRowHeight,
    listDetailsWidth,
    coverListScale,
    coverListRadius,
    coverCompX: listCenterX - gridCenterX,
    coverCompY: listCenterY - gridCenterY,
    listDetailsX: BOOKSHELF_LIST_CARD_PADDING + input.listCoverWidth + BOOKSHELF_LIST_DETAILS_GAP,
    listDetailsY: BOOKSHELF_LIST_CARD_PADDING,
    gridDetailsY: input.gridCoverHeight + input.gridTextGap,
  };
}

export function projectionRowTopMarginForProgress(
  expandedLayout: boolean,
  rowIndex: number,
  rowGap: number,
  progress: number,
): number {
  if (rowIndex <= 0) return 0;
  if (expandedLayout) return rowGap;
  return rowGap * (1 - clampUnitProgress(progress));
}

export function projectionRowHeightForProgress(
  metrics: BookshelfProjectionMetrics,
  rowBookCount: number,
  hasAnyGridProgress: boolean,
  progress: number,
): number {
  const p = clampUnitProgress(progress);
  const grid = rowBookCount <= 0 ? 0 :
    (hasAnyGridProgress ? metrics.gridCardHeightWithProgress : metrics.gridCardHeightNoProgress);
  const listRows = Math.ceil(rowBookCount / metrics.listColumns);
  const list = listRows * metrics.listRowHeight + Math.max(0, listRows - 1) * metrics.listRowGap;
  return grid + (list - grid) * p;
}

export function projectionListSlotX(metrics: BookshelfProjectionMetrics, columnIndex: number): number {
  return (columnIndex % metrics.listColumns) * (metrics.listCardWidth + BOOKSHELF_LIST_COLUMN_GAP);
}

export function projectionListSlotY(metrics: BookshelfProjectionMetrics, columnIndex: number): number {
  return Math.floor(columnIndex / metrics.listColumns) * (metrics.listRowHeight + metrics.listRowGap);
}

export function projectionBookTranslateXForProgress(
  metrics: BookshelfProjectionMetrics,
  columnIndex: number,
  progress: number,
): number {
  const p = clampUnitProgress(progress);
  const grid = columnIndex * (metrics.gridCardWidth + metrics.gridColumnGap);
  const list = projectionListSlotX(metrics, columnIndex);
  return grid + (list - grid) * p;
}

export function projectionBookTranslateYForProgress(
  metrics: BookshelfProjectionMetrics,
  columnIndex: number,
  progress: number,
): number {
  return projectionListSlotY(metrics, columnIndex) * clampUnitProgress(progress);
}

export function projectionCoverScaleForProgress(
  metrics: BookshelfProjectionMetrics,
  progress: number,
): number {
  return 1 + (metrics.coverListScale - 1) * clampUnitProgress(progress);
}

export function projectionCoverRadiusForProgress(
  metrics: BookshelfProjectionMetrics,
  progress: number,
): number {
  return BOOKSHELF_COVER_GRID_RADIUS + (metrics.coverListRadius - BOOKSHELF_COVER_GRID_RADIUS) * clampUnitProgress(progress);
}

export function projectionCoverCompensationXForProgress(
  metrics: BookshelfProjectionMetrics,
  progress: number,
): number {
  const p = clampUnitProgress(progress);
  return p === 0 ? 0 : metrics.coverCompX * p;
}

export function projectionCoverCompensationYForProgress(
  metrics: BookshelfProjectionMetrics,
  progress: number,
): number {
  const p = clampUnitProgress(progress);
  return p === 0 ? 0 : metrics.coverCompY * p;
}

export function resolveBookshelfViewSwitchPlan(
  targetMode: 'cover' | 'list',
  reduceMotion: boolean,
  totalMs: number,
  outgoingMs: number,
  incomingMs: number,
): BookshelfViewSwitchPlan {
  const toList = targetMode === 'list';
  const safeTotalMs = Math.max(0, totalMs);
  const safeOutgoingMs = Math.max(0, outgoingMs);
  const safeIncomingMs = Math.max(0, incomingMs);
  return {
    targetListProgress: toList ? 1 : 0,
    targetGridOpacity: toList ? 0 : 1,
    targetListOpacity: toList ? 1 : 0,
    outgoingTarget: toList ? 'grid' : 'list',
    reflowDurationMs: reduceMotion ? 0 : safeTotalMs,
    outgoingDurationMs: reduceMotion ? 0 : safeOutgoingMs,
    incomingDelayMs: reduceMotion ? 0 : Math.min(BOOKSHELF_VIEW_SWITCH_INCOMING_DELAY_MS, Math.max(0, safeTotalMs - safeIncomingMs)),
    incomingDurationMs: reduceMotion ? 0 : safeIncomingMs,
    safetyTimeoutMs: reduceMotion ? 0 : safeTotalMs + 80,
  };
}
