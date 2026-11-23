/** One control-directory allocation. The shell still owns motion and height;
 * these local viewports reveal the existing unscaled toolbar/footer actors. */
export interface ReaderControlDirectoryGeometry {
  tabTop: number;
  tabHeight: number;
  tabBottom: number;
  dividerTop: number;
  toolbarTop: number;
  toolbarHeight: number;
  toolbarViewportHeight: number;
  toolbarComplete: boolean;
  nominalListTop: number;
  listTop: number;
  listHeight: number;
  footerReservation: number;
  footerViewportHeight: number;
  footerTop: number;
  footerContentY: number;
  wholeRowFits: boolean;
  rowShortfall: number;
  headerShortfall: number;
  fixedChromeHeight: number;
  minUnitHeight: number;
  shortContentRequired: boolean;
}

export interface ReaderControlDirectoryMeasuredGeometry {
  listTop: number;
  toolbarHeight: number;
  footerHeight: number;
}

export function resolveReaderControlDirectoryGeometry(progress: number, tab: string,
  availableHeight: number, tabHeight: number, queryGrowth: number,
  rowHeight: number, measured?: ReaderControlDirectoryMeasuredGeometry,
  fallbackToolbarHeight?: number): ReaderControlDirectoryGeometry {
  const p = Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : 0;
  const height = Number.isFinite(availableHeight) ? Math.max(0, availableHeight) : 0;
  const actualTabHeight = Number.isFinite(tabHeight) ? Math.max(0, tabHeight) : 31 + 5 * p;
  const tabGrowth = actualTabHeight - (31 + 5 * p);
  const query = Number.isFinite(queryGrowth) ? Math.max(0, queryGrowth) : 0;
  const row = Number.isFinite(rowHeight) ? Math.max(0, rowHeight) : 32 + 8 * p;
  const bookmarks = tab === 'bookmarks';
  const tabQuickTop = bookmarks ? 12 : 13;
  const tabTop = tabQuickTop + (6 - tabQuickTop) * p;
  const tabBottom = tabTop + actualTabHeight;
  const toolbarTop = 61 - 18 * p + tabGrowth;
  const toolbarHeight = measured === undefined ? Math.max(52 + query,
    Number.isFinite(fallbackToolbarHeight) ? fallbackToolbarHeight as number : 0) : Math.max(0, measured.toolbarHeight);
  const toolbarViewportHeight = Math.min(toolbarHeight * p, Math.max(0, height - toolbarTop));
  const quickListTop = bookmarks ? 47 : 48;
  const nominalListTop = measured === undefined ? quickListTop + (99 - quickListTop) * p + query * p +
    tabGrowth + Math.max(0, toolbarHeight - 52 - query) * p : Math.max(tabBottom, measured.listTop);
  const listTop = Math.min(height, nominalListTop);
  // The current-chapter summary is informational. Give it only space left
  // after one whole row; shortage is explicit even when no summary remains.
  const footerHeight = measured === undefined ? 48 : Math.max(0, measured.footerHeight);
  const footerReservation = bookmarks ? Math.min(1, Math.max(0, height - listTop)) :
    Math.min(1 + footerHeight * p, Math.max(0, height - listTop - row));
  const footerViewportHeight = bookmarks ? 0 : Math.max(0, footerReservation - 1);
  const footerTop = height - footerReservation;
  const listHeight = Math.max(0, height - listTop - footerReservation);
  return { tabTop, tabHeight: actualTabHeight, tabBottom, dividerTop: tabBottom,
    toolbarTop, toolbarHeight, toolbarViewportHeight,
    toolbarComplete: p === 1 && toolbarViewportHeight === toolbarHeight,
    nominalListTop, listTop, listHeight, footerReservation, footerViewportHeight, footerTop,
    footerContentY: height - 1 - footerHeight + 24 * (1 - p) - footerTop,
    wholeRowFits: listHeight >= row, rowShortfall: Math.max(0, row - listHeight),
    headerShortfall: Math.max(0, nominalListTop - height),
    fixedChromeHeight: nominalListTop + (bookmarks ? 1 : 0), minUnitHeight: row,
    shortContentRequired: p === 1 && (nominalListTop + (bookmarks ? 1 : 0) + row > height || toolbarViewportHeight < toolbarHeight) };
}
