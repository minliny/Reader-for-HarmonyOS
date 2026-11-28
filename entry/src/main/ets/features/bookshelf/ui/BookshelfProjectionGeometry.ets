import type { ShelfBook } from '../../../app/ReaderCoreGateway';
import { ReaderWindowCoordinator } from '../../../app/ReaderWindowCoordinator';
import { bookshelfHeaderSpec } from '../../../ui/foundation/ReaderHeaderSpecs';
import { BookshelfViewMotionContract, bookshelfViewCoverDelayMs } from '../../../ui/foundation/MotionSpec';
import { motionSegment } from '../../../ui/foundation/MotionTimeline';
import { TOK_CONTENT_MAX_W_PHONE, TOK_CONTENT_RAIL_W_TABLET, TOK_SCREEN_INSET, TOK_SPACE_CONTROL_INLINE, TOK_SPACE_MD } from '../../../ui/foundation/ReaderTokens';
import { readerFloatingBarBottomInset, readerFloatingTabContentInset } from '../../../ui/layout/ReaderFloatingBarMetrics';
import { ReaderPageGeometry, ReaderPageGeometryInput, resolveReaderPageGeometry } from '../../../ui/layout/ReaderPageGeometry';
import { readerMainRailContentLeft, readerMainRailContentRight } from '../../shell/MainNavigationSpec';
import { ShelfBookPresentation } from '../presentation/ShelfBookPresentation';
import type { BookshelfViewMode } from '../application/BookshelfViewMode';
import {
  BOOKSHELF_GRID_TITLE_LINES,
  BOOKSHELF_LIST_CARD_PADDING,
  BOOKSHELF_LIST_COLUMN_GAP,
  BOOKSHELF_LIST_DETAILS_GAP,
  bookshelfColumnCount,
  bookshelfCoverHeight,
  bookshelfGridFrame,
  bookshelfListCardWidth,
} from './BookshelfGridSpec';

export interface BookshelfGeometryParams {
  viewportWidth: number;
  headerBottom: number;
  railActive: boolean;
  metricsRevision: number;
  wideViewport: boolean;
  measuredFooterHeight: number;
}

export interface BookshelfProjectionParams {
  contentWidth: number;
  expandedLayout: boolean;
  systemFontScale: number;
  viewMode: BookshelfViewMode;
  viewSwitchRunning: boolean;
  reduceMotion: boolean;
  pendingViewMode: BookshelfViewMode;
  viewSwitchDestinationMode: BookshelfViewMode;
  viewSwitchTimeMs: number;
  viewMotion: BookshelfViewMotionContract;
  viewSwitchRanks: Map<number, number>;
  viewSwitchGridContentOpacity: number;
  viewSwitchListContentOpacity: number;
  listCoverWidth: number;
  listRowHeight: number;
}

export interface BookshelfViewSwitchSample {
  viewSwitchHeaderOpacity: number;
  viewSwitchGridContentOpacity: number;
  viewSwitchListContentOpacity: number;
  viewSwitchDestinationCoverOpacity: number;
  viewSwitchMorphCoverOpacity: number;
  viewMode: BookshelfViewMode;
}

export function resolveBookshelfContentEndValue(params: BookshelfGeometryParams): number {
  if (params.metricsRevision < 0) return TOK_SPACE_MD;
  const metrics = ReaderWindowCoordinator.metrics();
  return params.wideViewport && params.railActive
    ? Math.max(24, readerFloatingBarBottomInset(metrics, TOK_SPACE_MD))
    : readerFloatingTabContentInset(metrics, params.measuredFooterHeight);
}

export function resolveBookshelfPageGeometry(expandedLayout: boolean, params: BookshelfGeometryParams): ReaderPageGeometry {
  const metrics = ReaderWindowCoordinator.metrics();
  const input = new ReaderPageGeometryInput(metrics);
  input.viewportWidth = params.viewportWidth;
  input.headerHeight = params.headerBottom;
  input.contentGap = bookshelfHeaderSpec().contentGap;
  input.contentUnderlap = bookshelfHeaderSpec().contentUnderlap;
  input.contentEndInset = resolveBookshelfContentEndValue(params);
  input.contentMaxWidth = expandedLayout ? TOK_CONTENT_RAIL_W_TABLET : TOK_CONTENT_MAX_W_PHONE;
  input.contentLeftGap = expandedLayout
    ? (params.railActive ? readerMainRailContentLeft() : TOK_SCREEN_INSET) : TOK_SCREEN_INSET;
  input.contentRightGap = expandedLayout
    ? (params.railActive ? readerMainRailContentRight() : TOK_SCREEN_INSET) : TOK_SCREEN_INSET;
  return resolveReaderPageGeometry(input);
}

export function gridProgressLabelValue(book: ShelfBook): string {
  return ShelfBookPresentation.progress(book, 'grid-caption');
}

export function gridBookCardHeightValue(
  book: ShelfBook,
  contentWidth: number,
  expandedLayout: boolean,
  systemFontScale: number,
): number {
  return bookshelfGridFrame(
    contentWidth,
    expandedLayout,
    systemFontScale,
    gridProgressLabelValue(book).length > 0,
    BOOKSHELF_GRID_TITLE_LINES,
  ).cardHeight;
}

export function sampleBookshelfViewSwitch(
  t: number,
  m: BookshelfViewMotionContract,
  sourceMode: BookshelfViewMode,
  destinationMode: BookshelfViewMode,
): BookshelfViewSwitchSample {
  const content = (p: number): number => m.contentCurve.interpolate(p);
  const fade = (p: number): number => m.coverFadeCurve.interpolate(p);
  const outgoing = 1 - motionSegment(t, m.layoutCommitMs, m.outgoingDurationMs, content);
  const incoming = motionSegment(t, m.contentIncomingStartMs, m.contentIncomingDurationMs, content);
  return {
    viewSwitchHeaderOpacity: outgoing + motionSegment(t, m.headerIncomingStartMs, m.headerIncomingDurationMs, content),
    viewSwitchGridContentOpacity: sourceMode === 'cover' ? outgoing : incoming,
    viewSwitchListContentOpacity: sourceMode === 'list' ? outgoing : incoming,
    viewSwitchDestinationCoverOpacity: 1,
    viewSwitchMorphCoverOpacity: destinationMode === 'list'
      ? 1 - motionSegment(t, m.movingCoverFadeStartMs, m.movingCoverFadeDurationMs, fade)
      : motionSegment(t, m.morphCoverIncomingStartMs, m.morphCoverIncomingDurationMs, fade),
    viewMode: t < m.layoutCommitMs ? sourceMode : destinationMode,
  };
}

export function projectionDetailsOpacityValue(params: BookshelfProjectionParams, mode: BookshelfViewMode, index?: number): number {
  if (params.viewSwitchRunning && index !== undefined && !params.viewSwitchRanks.has(index)) {
    return params.pendingViewMode === mode ? 1 : 0;
  }
  return mode === 'cover' ? params.viewSwitchGridContentOpacity : params.viewSwitchListContentOpacity;
}

export function projectionListProgressValue(
  params: BookshelfProjectionParams,
  index: number,
  scale: boolean = false,
  columnCount: number = 1,
): number {
  if (!params.viewSwitchRunning || params.reduceMotion) return params.viewMode === 'list' ? 1 : 0;
  let visibleIndex = params.viewSwitchRanks.get(index);
  for (let column = 1; visibleIndex === undefined && column < columnCount; column += 1) {
    visibleIndex = params.viewSwitchRanks.get(index + column);
  }
  if (visibleIndex === undefined) return params.pendingViewMode === 'list' ? 1 : 0;
  const progress = motionSegment(
    params.viewSwitchTimeMs,
    params.viewMotion.layoutCommitMs + bookshelfViewCoverDelayMs(visibleIndex),
    scale ? params.viewMotion.coverScaleDurationMs : params.viewMotion.coverMoveDurationMs,
    (p: number): number => scale ? params.viewMotion.coverScaleCurve.interpolate(p) : params.viewMotion.coverMoveCurve.interpolate(p),
  );
  return params.viewSwitchDestinationMode === 'list' ? progress : 1 - progress;
}

export function projectionRowHeightValue(params: BookshelfProjectionParams, row: ShelfBook[], index: number): number {
  let grid = 0;
  for (const book of row) {
    grid = Math.max(grid, gridBookCardHeightValue(book, params.contentWidth, params.expandedLayout, params.systemFontScale));
  }
  const listRows = Math.ceil(row.length / bookshelfColumnCount(params.expandedLayout, true));
  const list = listRows * params.listRowHeight + Math.max(0, listRows - 1) * TOK_SPACE_CONTROL_INLINE;
  return grid + (list - grid) * projectionListProgressValue(params, index, false, bookshelfColumnCount(params.expandedLayout));
}

export function projectionBookWidthValue(params: BookshelfProjectionParams, index: number): number {
  const grid = bookshelfGridFrame(params.contentWidth, params.expandedLayout).cardWidth;
  const list = bookshelfListCardWidth(params.contentWidth, params.expandedLayout);
  return grid + (list - grid) * projectionListProgressValue(params, index);
}

export function projectionBookHeightValue(params: BookshelfProjectionParams, book: ShelfBook, index: number): number {
  const grid = gridBookCardHeightValue(book, params.contentWidth, params.expandedLayout, params.systemFontScale);
  return grid + (params.listRowHeight - grid) * projectionListProgressValue(params, index);
}

export function projectionBookTranslateXValue(params: BookshelfProjectionParams, columnIndex: number, index: number): number {
  const gridFrame = bookshelfGridFrame(params.contentWidth, params.expandedLayout);
  const grid = columnIndex * (gridFrame.cardWidth + gridFrame.columnGap);
  const list = (columnIndex % bookshelfColumnCount(params.expandedLayout, true)) *
    (bookshelfListCardWidth(params.contentWidth, params.expandedLayout) + BOOKSHELF_LIST_COLUMN_GAP);
  return grid + (list - grid) * projectionListProgressValue(params, index);
}

export function projectionBookTranslateYValue(params: BookshelfProjectionParams, columnIndex: number, index: number): number {
  const row = Math.floor(columnIndex / bookshelfColumnCount(params.expandedLayout, true));
  return row * (params.listRowHeight + TOK_SPACE_CONTROL_INLINE) * projectionListProgressValue(params, index);
}

export function projectionCoverScaleValue(params: BookshelfProjectionParams, index: number): number {
  const gridCardWidth = bookshelfGridFrame(params.contentWidth, params.expandedLayout).cardWidth;
  const list = params.listCoverWidth / Math.max(1, gridCardWidth);
  return 1 + (list - 1) * projectionListProgressValue(params, index, true);
}

export function projectionCoverRadiusValue(params: BookshelfProjectionParams, index: number): number {
  const gridCardWidth = bookshelfGridFrame(params.contentWidth, params.expandedLayout).cardWidth;
  const list = 6 / (params.listCoverWidth / gridCardWidth);
  return 8 + (list - 8) * projectionListProgressValue(params, index, true);
}

export function projectionCoverCompensationXValue(params: BookshelfProjectionParams, index: number): number {
  const gridCenter = bookshelfGridFrame(params.contentWidth, params.expandedLayout).cardWidth / 2;
  const listCenter = BOOKSHELF_LIST_CARD_PADDING + params.listCoverWidth / 2;
  return (listCenter - gridCenter) * projectionListProgressValue(params, index, true);
}

export function projectionCoverCompensationYValue(params: BookshelfProjectionParams, index: number): number {
  const gridCardWidth = bookshelfGridFrame(params.contentWidth, params.expandedLayout).cardWidth;
  const gridCenter = bookshelfCoverHeight(gridCardWidth, params.expandedLayout) / 2;
  const listCenter = params.listRowHeight / 2;
  return (listCenter - gridCenter) * projectionListProgressValue(params, index, true);
}

export function projectionListDetailsWidthValue(params: BookshelfProjectionParams): number {
  return Math.max(
    0,
    bookshelfListCardWidth(params.contentWidth, params.expandedLayout) -
      params.listCoverWidth - 2 * BOOKSHELF_LIST_CARD_PADDING - BOOKSHELF_LIST_DETAILS_GAP,
  );
}
