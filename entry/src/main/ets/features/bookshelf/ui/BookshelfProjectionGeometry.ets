import type { ShelfBook } from '../../../app/ReaderCoreGateway';
import { ReaderWindowCoordinator } from '../../../app/ReaderWindowCoordinator';
import { bookshelfHeaderSpec } from '../../../ui/foundation/ReaderHeaderSpecs';
import { TOK_CONTENT_MAX_W_PHONE, TOK_CONTENT_RAIL_W_TABLET, TOK_SCREEN_INSET, TOK_SPACE_CONTROL_INLINE, TOK_SPACE_MD } from '../../../ui/foundation/ReaderTokens';
import { readerFloatingBarBottomInset, readerFloatingTabContentInset } from '../../../ui/layout/ReaderFloatingBarMetrics';
import { ReaderPageGeometry, ReaderPageGeometryInput, resolveReaderPageGeometry } from '../../../ui/layout/ReaderPageGeometry';
import { readerMainRailContentLeft, readerMainRailContentRight } from '../../shell/MainNavigationSpec';
import { ShelfBookPresentation } from '../presentation/ShelfBookPresentation';
import {
  projectionBookTranslateXForProgress,
  projectionBookTranslateYForProgress,
  projectionCoverCompensationXForProgress,
  projectionCoverCompensationYForProgress,
  projectionCoverRadiusForProgress,
  projectionCoverScaleForProgress,
  projectionListDetailsWidthValue,
  projectionListSlotX,
  projectionListSlotY,
  projectionRowHeightForProgress,
  projectionRowTopMarginForProgress,
  resolveBookshelfProjectionMetrics,
  resolveBookshelfViewSwitchPlan,
  type BookshelfProjectionMetrics,
  type BookshelfViewSwitchPlan,
} from './BookshelfListGeometry';
import {
  BOOKSHELF_GRID_TEXT_GAP,
  BOOKSHELF_GRID_TITLE_LINES,
  bookshelfGridFrame,
} from './BookshelfGridSpec';

export {
  projectionBookTranslateXForProgress,
  projectionBookTranslateYForProgress,
  projectionCoverCompensationXForProgress,
  projectionCoverCompensationYForProgress,
  projectionCoverRadiusForProgress,
  projectionCoverScaleForProgress,
  projectionListDetailsWidthValue,
  projectionListSlotX,
  projectionListSlotY,
  projectionRowHeightForProgress,
  projectionRowTopMarginForProgress,
  resolveBookshelfViewSwitchPlan,
  type BookshelfProjectionMetrics,
  type BookshelfViewSwitchPlan,
};

export interface BookshelfGeometryParams {
  viewportWidth: number;
  headerBottom: number;
  railActive: boolean;
  metricsRevision: number;
  wideViewport: boolean;
  measuredFooterHeight: number;
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
  _book: ShelfBook,
  contentWidth: number,
  expandedLayout: boolean,
  systemFontScale: number,
): number {
  return bookshelfGridFrame(
    contentWidth,
    expandedLayout,
    systemFontScale,
    false,
    BOOKSHELF_GRID_TITLE_LINES,
  ).cardHeight;
}

export function buildBookshelfProjectionMetrics(
  contentWidth: number,
  expandedLayout: boolean,
  systemFontScale: number,
  listCoverWidth: number,
  listContentHeight: number,
  listRowHeight: number,
): BookshelfProjectionMetrics {
  const frameNoProgress = bookshelfGridFrame(
    contentWidth,
    expandedLayout,
    systemFontScale,
    false,
    BOOKSHELF_GRID_TITLE_LINES,
  );
  return resolveBookshelfProjectionMetrics({
    contentWidth,
    expandedLayout,
    gridCardWidth: frameNoProgress.cardWidth,
    gridCoverHeight: frameNoProgress.coverHeight,
    gridColumnGap: frameNoProgress.columnGap,
    gridCardHeightNoProgress: frameNoProgress.cardHeight,
    gridCardHeightWithProgress: frameNoProgress.cardHeight,
    listCoverWidth,
    listContentHeight,
    listRowHeight,
    listRowGap: expandedLayout ? TOK_SPACE_CONTROL_INLINE : 0,
    gridTextGap: BOOKSHELF_GRID_TEXT_GAP,
  });
}
