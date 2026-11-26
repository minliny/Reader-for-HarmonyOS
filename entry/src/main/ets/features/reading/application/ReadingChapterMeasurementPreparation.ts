import { retainReadingEntryImageHandles, type ReadingSessionChapter, type ReadingSessionImage } from './ReadingChapterWindow.ts';
import type { ReadingParagraphWindowDirection } from './ReadingDocumentWindow';
import type { ReadingSessionFlowGateway } from './ReadingSessionFlowGateway';
import { ParagraphRange } from './ReadingMeasurementFacts.ts';
import {
  prepareReadingParagraphUtf16Ranges,
  type ReadingParagraphBoundaryMode,
  type ReadingParagraphUtf16Range,
} from './ReadingParagraphProjection.ts';
import {
  prepareReadingChapterLayoutMap, readingChapterLayoutMap, type ReadingSurfaceLayoutMap,
} from './ReadingSurfaceLayoutMap.ts';

export interface ReadingChapterMeasurementProjection {
  map: ReadingSurfaceLayoutMap;
  ranges: ParagraphRange[];
}

export interface ReadingParagraphWindowProjection extends ReadingChapterMeasurementProjection {
  chapter: ReadingSessionChapter;
}

export interface ReadingEntryExpansionHost {
  firstPagePersistence: () => Promise<void> | undefined;
  boundaryMode: () => ReadingParagraphBoundaryMode;
  admit: (expanded: ReadingSessionChapter, ranges: ParagraphRange[], map: ReadingSurfaceLayoutMap) => void;
}

function projectParagraph(
  range: ReadingParagraphUtf16Range,
  index: number,
  map: ReadingSurfaceLayoutMap,
): ParagraphRange {
  return new ParagraphRange(`paragraph-${index}-${range.startUtf16}`,
    range.startUtf16, range.endUtf16, map.scalarForUtf16(range.startUtf16),
    map.scalarForUtf16(range.endUtf16));
}

/** Prepare privately. A changed selection must never provide a native layout. */
export async function prepareReadingChapterMeasurement(
  chapter: ReadingSessionChapter,
  boundaryMode: () => ReadingParagraphBoundaryMode,
  isCurrent: () => boolean,
): Promise<ReadingChapterMeasurementProjection> {
  const map = await prepareReadingChapterLayoutMap(chapter, isCurrent);
  const utf16Ranges = await prepareReadingParagraphUtf16Ranges(chapter.content, boundaryMode(), isCurrent);
  if (utf16Ranges === undefined || !isCurrent()) throw new Error('READING_CONTENT_PREPARATION_CANCELLED');
  const ranges: ParagraphRange[] = [];
  for (let index = 0; index < utf16Ranges.length; index += 1) {
    if (index > 0 && index % 512 === 0) {
      await new Promise<void>((resolve): void => { setTimeout(resolve, 0); });
      if (!isCurrent()) throw new Error('READING_CONTENT_PREPARATION_CANCELLED');
    }
    ranges.push(projectParagraph(utf16Ranges[index], index, map));
  }
  if (!isCurrent()) throw new Error('READING_CONTENT_PREPARATION_CANCELLED');
  return { map, ranges };
}

/** Expand an admitted entry after its existing first-page save has settled. */
export function completeReadingEntryWindow(
  completion: Promise<ReadingSessionChapter>,
  currentChapter: ReadingSessionChapter,
  isCurrent: () => boolean,
  host: ReadingEntryExpansionHost,
): Promise<void> {
  return completion.then(async (full: ReadingSessionChapter): Promise<void> => {
    // Expansion cannot orphan an in-flight save against the original immutable page.
    await host.firstPagePersistence();
    if (!isCurrent()) return;
    const expanded = retainReadingEntryImageHandles(full, currentChapter);
    const map = readingChapterLayoutMap(expanded);
    const utf16Ranges = await prepareReadingParagraphUtf16Ranges(expanded.content, host.boundaryMode(), isCurrent);
    if (utf16Ranges === undefined || !isCurrent()) return;
    const ranges: ParagraphRange[] = [];
    for (let index = 0; index < utf16Ranges.length; index += 1) {
      if (index > 0 && index % 512 === 0) {
        await new Promise<void>((resolve): void => { setTimeout(resolve, 0); });
        if (!isCurrent()) return;
      }
      ranges.push(projectParagraph(utf16Ranges[index], index, map));
    }
    if (!isCurrent()) return;
    host.admit(expanded, ranges, map);
  });
}

export function lastMeasurableParagraphScalar(
  content: string, map: ReadingSurfaceLayoutMap, ranges: ParagraphRange[],
): number {
  for (let index = ranges.length - 1; index >= 0; index -= 1) {
    const range = ranges[index];
    for (let scalar = range.endScalar - 1; scalar >= range.startScalar; scalar -= 1) {
      const startUtf16 = map.utf16ForScalar(scalar);
      const endUtf16 = map.utf16ForScalar(scalar + 1);
      if (content.substring(startUtf16, endUtf16).trim().length > 0) return scalar;
    }
  }
  throw new Error('READING_CONTENT_EMPTY');
}

export interface ReadingMeasurementStart {
  readonly expand: ReadingParagraphWindowDirection | undefined;
  readonly offset: number;
  readonly progress: number;
}

/** Clamp only a presentation offset in the resident window. A request for
 * missing original context is returned before reading any paragraph text. */
export function planForwardReadingMeasurement(
  requested: number, content: string, map: ReadingSurfaceLayoutMap, ranges: ParagraphRange[],
): ReadingMeasurementStart {
  const scalarCount = map.scalarCount();
  if (requested < map.residentStart()) return { expand: 'before', offset: requested, progress: 0 };
  if (requested >= map.residentEnd() && map.residentEnd() < scalarCount) {
    return { expand: 'after', offset: requested, progress: 0 };
  }
  const last = lastMeasurableParagraphScalar(content, map, ranges);
  const offset = Math.max(ranges[0].startScalar, Math.min(last, requested));
  return { expand: undefined, offset, progress: scalarCount === 0 ? 0 : offset / scalarCount };
}

export function readMeasuredParagraphWindow(
  gateway: ReadingSessionFlowGateway, chapter: ReadingSessionChapter, anchor: number,
  direction: ReadingParagraphWindowDirection, mode: ReadingParagraphBoundaryMode, current: () => boolean,
  admit: (expanded: ReadingSessionChapter, projection: ReadingChapterMeasurementProjection) => void,
  recover: (error: Error) => Promise<void>,
): Promise<void> {
  return gateway.loadParagraphWindow(chapter, anchor, direction, mode, current)
    .then((result: ReadingSessionChapter): Promise<void> =>
      prepareReadingParagraphWindowMeasurement(result, chapter, mode, current, admit))
    .catch(recover);
}

/** A bounded adjacent window never replaces the active measurement after its lease expires. */
export async function prepareReadingParagraphWindowMeasurement(
  result: ReadingSessionChapter,
  currentChapter: ReadingSessionChapter,
  mode: ReadingParagraphBoundaryMode,
  isCurrent: () => boolean,
  admit: (expanded: ReadingSessionChapter, projected: ReadingChapterMeasurementProjection) => void,
): Promise<void> {
  if (!isCurrent()) return;
  const expanded = retainReadingEntryImageHandles(result, currentChapter);
  const map = await prepareReadingChapterLayoutMap(expanded, isCurrent);
  const ranges = await prepareReadingParagraphUtf16Ranges(expanded.content, mode, isCurrent);
  if (!isCurrent() || ranges === undefined) return;
  const paragraphs = ranges.map((range, index): ParagraphRange => projectParagraph(range, index, map));
  admit(expanded, { map, ranges: paragraphs });
}

/** Retain the page's original paragraphs and at most one bounded neighbour on either side. */
export function projectRetainedReadingParagraphWindow(
  chapter: ReadingSessionChapter,
  ranges: ParagraphRange[],
  pageStart: number,
  pageEnd: number,
  measurementMap: () => ReadingSurfaceLayoutMap,
): ReadingParagraphWindowProjection | undefined {
  const first = ranges.findIndex((range: ParagraphRange): boolean => range.endScalar > pageStart);
  let last = ranges.length - 1;
  while (last >= 0 && ranges[last].startScalar >= pageEnd) last -= 1;
  if (first < 0 || last < first) throw new Error('PAGINATION_PAGE_OUTSIDE_PARAGRAPH_WINDOW');
  const keepFirst = first > 0 && ranges[first - 1].endScalar - ranges[first - 1].startScalar <= 8192 ? first - 1 : first;
  const keepLast = last + 1 < ranges.length && ranges[last + 1].endScalar - ranges[last + 1].startScalar <= 8192 ? last + 1 : last;
  if (keepFirst === 0 && keepLast === ranges.length - 1) return undefined;
  const oldMap = measurementMap();
  const startUtf16 = keepFirst === 0 ? 0 : ranges[keepFirst].startUtf16;
  const endUtf16 = keepLast === ranges.length - 1 ? chapter.content.length : ranges[keepLast].endUtf16;
  const startScalar = oldMap.scalarForUtf16(startUtf16), endScalar = oldMap.scalarForUtf16(endUtf16);
  // A necessary giant paragraph has already been mapped cooperatively.
  // Keep its whole map rather than rebuild it synchronously just to trim neighbours.
  if (endScalar - startScalar > 32768) return undefined;
  const cropped: ReadingSessionChapter = {
    sourceId: chapter.sourceId, bookId: chapter.bookId, chapterIndex: chapter.chapterIndex,
    chapterTitle: chapter.chapterTitle, chapterUrl: chapter.chapterUrl,
    contentVersion: chapter.contentVersion, directoryTargetProof: chapter.directoryTargetProof, bodyVersion: chapter.bodyVersion,
    processingVersion: chapter.processingVersion, positionMigration: chapter.positionMigration,
    cacheRefreshRequired: chapter.cacheRefreshRequired, extractionVia: chapter.extractionVia,
    content: chapter.content.substring(startUtf16, endUtf16), textLayoutIdentity: undefined,
    documentRange: { startScalar, endScalar, totalScalars: oldMap.scalarCount() },
    images: chapter.images.filter((image: ReadingSessionImage): boolean =>
      image.startScalar >= startScalar && image.endScalar <= endScalar),
  };
  const map = readingChapterLayoutMap(cropped);
  const retained = ranges.slice(keepFirst, keepLast + 1).map((range: ParagraphRange): ParagraphRange =>
    new ParagraphRange(range.id, range.startUtf16 - startUtf16, range.endUtf16 - startUtf16,
      range.startScalar, range.endScalar));
  return { chapter: cropped, map, ranges: retained };
}
