import * as directoryState from '../../entry/src/main/ets/features/manga/MangaDirectoryState.ts';
import { mangaDirectoryDisplay } from '../../entry/src/main/ets/features/manga/MangaDirectoryDisplay.ts';
import * as visual from '../../entry/src/main/ets/features/manga/MangaDirectoryVisual.ts';
import * as layout from '../../entry/src/main/ets/features/manga/MangaDirectoryLayout.ts';

/** Named production members needed when the SDK lowers the real Grid build.
 * Empty data is only the IO seam for chrome probes, never a layout substitute. */
export const mangaGridBuilderMembers = ['chapterByIndex', 'mangaGridSpans', 'mangaDisplayNode', 'mangaTitle', 'mangaContextTitle', 'mangaDownloadable', 'mangaStatusText', 'mangaAccessoryWidth', 'prepareMangaGridProjection', 'mangaLayoutByNode', 'mangaLayoutSignature', 'mangaLayoutPageRefs', 'mangaPaintNode', 'mangaChapter', 'mangaRowAccessibility', 'mangaRowAdmitted', 'mangaEmptyState', 'mangaRowBody', 'mangaNumberCell', 'mangaGridLayoutOptions', 'mangaGridNarrow', 'mangaQuickContextRow', 'mangaQuickContextTitle',
  'mangaLoadedRuns', 'mangaCellPlacement', 'mangaCellOrdinal', 'mangaCellWidth', 'mangaCellTop', 'mangaCellBottom',
  'mangaFontScale', 'mangaContentWidth', 'mangaContentStartOffset', 'mangaContentEndOffset', 'mangaCellHeight', 'mangaFirstDisplayRow', 'mangaFirstGridRun', 'publishMangaScrollOffset', 'toggleMangaRow', 'canDownloadTarget', 'downloadTarget', 'admitMangaPages', 'settleMangaScroll'];
/** Shared real row closure for metadata, font and download consumers. */
export const mangaRowBuilderMembers = [...mangaGridBuilderMembers, 'mangaRow', 'selectMangaRow', 'mangaColor',
  'displayLevel', 'mangaGroupNode', 'mangaGroupSpacing', 'mangaRowIndex', 'mangaRowPaddingLeft', 'isCurrentMangaNode', 'isCurrentNode'];
export const mangaGridProbeDependencies = { ...layout, ...visual, ...directoryState, mangaDirectoryDisplay, WordBreak: { BREAK_WORD: 'WordBreak.BREAK_WORD' }, FlexWrap: { Wrap: 'FlexWrap.Wrap' }, ReaderWindowCoordinator: { metrics: () => ({ systemFontScale: 1 }) } };
export function emptyMangaGridState() {
  return { view: { visibleTotal: 0 }, windowMetricsRevision: 0, mangaGridSpans: new Map(), mangaLayoutByNode: new Map(), mangaLayoutSignature: '', mangaLayoutPageRefs: new Map(), mangaViewportWidth: 390, mangaInitialViewportWidth: 0, mangaQuickDisplay: false, mangaVisibleTopInset: 0, contentStartInset: 0, contentEndInset: 0,
    dataSource: { loadedPages: () => [], loadedPageAt: () => undefined, coreIndex: index => index, displayIndex: index => index } };
}
