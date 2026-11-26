import { hasKnownReadingImageGeometry, type ReadingSessionImage } from '../application/ReadingChapterWindow.ts';
import type { MeasuredReadingLine } from '../application/ReadingMeasurementFacts';
import type { ReadingDocumentRange } from '../application/ReadingSurfaceLayoutMap';
import type { ReadingPaginationIndex, ReadingPaginationKey, ReadingPaginationPrefix } from '../application/ReadingPaginationIndex';
import type { ReaderPhysicalPaginationOwner } from './ReaderPhysicalPaginationOwner';

export type ReaderMeasuredParagraphResult = 'continue' | 'page-ready' | 'waiting';
export type ReaderMeasuredBatchResult = 'page-ready' | 'waiting' | 'next-batch';

export interface ReaderMeasuredBatchInput<TParagraph> {
  paragraphStart: (paragraph: TParagraph) => number;
  knownEnd: () => number | undefined;
  consumeParagraph: (paragraph: TParagraph, batchIndex: number, knownEnd: number | undefined) => ReaderMeasuredParagraphResult;
  releaseMeasurement: () => void;
  prepareNextBatch: () => boolean;
}

/** Draws no native content. A wait preserves the current batch suffix and a
 * full page does not read or release later native paragraph controllers. */
export function advanceMeasuredReadingBatch<TParagraph, TFragment>(
  batch: TParagraph[], packing: ReaderPhysicalPaginationOwner<TFragment>,
  input: ReaderMeasuredBatchInput<TParagraph>,
): ReaderMeasuredBatchResult {
  for (let batchIndex = 0; batchIndex < batch.length; batchIndex += 1) {
    const paragraph = batch[batchIndex];
    const knownEnd = input.knownEnd();
    if (knownEnd !== undefined && input.paragraphStart(paragraph) >= knownEnd) {
      packing.endScalar = knownEnd;
      return 'page-ready';
    }
    const result = input.consumeParagraph(paragraph, batchIndex, knownEnd);
    if (result !== 'continue') return result;
  }

  input.releaseMeasurement();
  batch.length = 0;
  const knownEnd = input.knownEnd();
  if (knownEnd !== undefined && packing.endScalar >= knownEnd) {
    packing.endScalar = knownEnd;
    return 'page-ready';
  }
  return input.prepareNextBatch() ? 'next-batch' : 'page-ready';
}

export function admittedMeasuredPageCapacity(capacity: number): number {
  if (!Number.isFinite(capacity) || capacity <= 0) throw new Error('PAGINATION_SURFACE_HEIGHT_INVALID');
  return capacity;
}

export interface ReaderMeasuredImageGeometry {
  capacity: (startScalar: number) => number;
  lineHeight: () => number;
  paragraphSpacing: () => number;
  scaledHeight: (capacity: number) => number;
}

export interface ReaderMeasuredImagePlan {
  readonly result: 'waiting' | 'page-ready' | 'outside-page' | 'admitted';
  readonly height: number;
}

function measuredImageHeight(image: ReadingSessionImage, input: ReaderMeasuredImageGeometry, capacity: number): number {
  return image.state === 'ready' || hasKnownReadingImageGeometry(image) ?
    input.scaledHeight(capacity) : input.lineHeight();
}

export function planForwardMeasuredImage<TFragment>(
  image: ReadingSessionImage, packing: ReaderPhysicalPaginationOwner<TFragment>, input: ReaderMeasuredImageGeometry,
): ReaderMeasuredImagePlan {
  const capacity = admittedMeasuredPageCapacity(input.capacity(image.startScalar));
  // An already full text page must not wait for the next page's decode.
  if (!packing.canAppend(Math.min(1, input.lineHeight()), true, input.paragraphSpacing(), capacity)) {
    return { result: 'page-ready', height: 0 };
  }
  if (image.state === 'pending' && !hasKnownReadingImageGeometry(image)) return { result: 'waiting', height: 0 };
  const height = measuredImageHeight(image, input, capacity);
  return packing.canAppend(height, true, input.paragraphSpacing(), capacity) ?
    { result: 'admitted', height } : { result: 'page-ready', height: 0 };
}

export function planReverseMeasuredImage<TFragment>(
  image: ReadingSessionImage, endScalar: number, packing: ReaderPhysicalPaginationOwner<TFragment>,
  input: ReaderMeasuredImageGeometry,
): ReaderMeasuredImagePlan {
  if (image.state === 'pending' && !hasKnownReadingImageGeometry(image)) return { result: 'waiting', height: 0 };
  if (!(image.endScalar <= endScalar)) return { result: 'outside-page', height: 0 };
  // Reverse capacity may read the chapter title, so only request it for an
  // image eligible to belong to the prior page.
  const capacity = input.capacity(image.startScalar);
  const height = measuredImageHeight(image, input, capacity);
  return packing.canPrepend(height, input.paragraphSpacing(), capacity) ?
    { result: 'admitted', height } : { result: 'page-ready', height: 0 };
}

export interface ReaderForwardMeasuredLinesInput {
  readonly knownEnd: number | undefined;
  readonly isParagraphStart: boolean;
  capacity: () => number;
  paragraphSpacing: () => number;
  spanHeight: (firstLineIndex: number, lastLineIndex: number) => number;
  appendLine: (line: MeasuredReadingLine, height: number, isParagraphStart: boolean, firstNativeLine: boolean) => void;
}

/** Use the admitted span height (including the earlier line spacing), never a
 * sum of individual native line metrics. Leave a rejected line untouched. */
export function admitForwardMeasuredLines<TFragment>(
  lines: MeasuredReadingLine[], packing: ReaderPhysicalPaginationOwner<TFragment>,
  input: ReaderForwardMeasuredLinesInput,
): ReaderMeasuredParagraphResult {
  let firstLine: number | undefined;
  let nativeHeight = 0;
  for (const line of lines) {
    if (input.knownEnd !== undefined && line.startScalar >= input.knownEnd) {
      packing.endScalar = input.knownEnd;
      return 'page-ready';
    }
    if (input.knownEnd !== undefined && line.endScalar > input.knownEnd)
      throw new Error('PAGINATION_KNOWN_PAGE_BOUNDARY_CHANGED');
    const capacity = admittedMeasuredPageCapacity(input.capacity());
    const isParagraphStart = input.isParagraphStart && line.lineIndex === 0;
    const candidate = input.spanHeight(firstLine ?? line.lineIndex, line.lineIndex);
    const height = candidate - nativeHeight;
    if (!packing.canAppend(height, isParagraphStart, input.paragraphSpacing(), capacity)) return 'page-ready';
    const firstNativeLine = firstLine === undefined;
    if (firstNativeLine) firstLine = line.lineIndex;
    nativeHeight = candidate;
    input.appendLine(line, height, isParagraphStart, firstNativeLine);
  }
  return 'continue';
}

export interface ReaderSelectedReverseLines {
  readonly lines: MeasuredReadingLine[];
  readonly height: number;
  readonly full: boolean;
}

export function selectReverseMeasuredLines<TFragment>(
  lines: MeasuredReadingLine[], packing: ReaderPhysicalPaginationOwner<TFragment>,
  spanHeight: (firstLineIndex: number, lastLineIndex: number) => number,
  capacityAt: (startScalar: number) => number, paragraphSpacing: () => number,
): ReaderSelectedReverseLines {
  const selected: MeasuredReadingLine[] = [];
  let height = 0;
  for (const line of lines) {
    const candidate = spanHeight(line.lineIndex, lines[0].lineIndex);
    const capacity = capacityAt(line.startScalar);
    if (!packing.canPrepend(candidate, paragraphSpacing(), capacity, selected.length > 0))
      return { lines: selected, height, full: true };
    selected.unshift(line);
    height = candidate;
  }
  return { lines: selected, height, full: false };
}

export interface ReaderMeasuredPageEndInput {
  residentRange: () => ReadingDocumentRange | undefined;
  isReverse: () => boolean;
  knownEnd: () => number | undefined;
  gapText: (startScalar: number, endScalar: number) => string;
  lastMeasurable: () => number;
}

export function admitMeasuredPageEnd<TFragment>(
  packing: ReaderPhysicalPaginationOwner<TFragment>, input: ReaderMeasuredPageEndInput,
): 'empty' | 'expand-after' | 'ready' {
  if (packing.fragments.length === 0 || packing.startScalar < 0 || packing.endScalar < packing.startScalar) return 'empty';
  const resident = input.residentRange();
  const knownEnd = input.isReverse() ? undefined : input.knownEnd();
  if (knownEnd !== undefined && packing.endScalar < knownEnd) {
    if (resident !== undefined && resident.endScalar < knownEnd) return 'expand-after';
    if (input.gapText(packing.endScalar, knownEnd).trim().length !== 0)
      throw new Error('PAGINATION_KNOWN_PAGE_BOUNDARY_CHANGED');
    packing.endScalar = knownEnd;
  }
  if (resident !== undefined && resident.endScalar < resident.totalScalars && !input.isReverse() &&
    knownEnd === undefined && packing.endScalar > input.lastMeasurable()) return 'expand-after';
  return 'ready';
}

export interface ReaderCanonicalPageRequest {
  readonly offset: number;
  readonly unresolvedAnchor: number;
}

export function canonicalMeasuredPageRequest(
  index: ReadingPaginationIndex, key: ReadingPaginationKey, readPrefix: () => ReadingPaginationPrefix | undefined,
  chapterStart: () => number, target: number,
): ReaderCanonicalPageRequest {
  const known = index.findContainingPage(key, target);
  const prefix = readPrefix();
  const headPrefix = prefix !== undefined && prefix.matches(key) && prefix.startsAtRequest(chapterStart()) ? prefix : undefined;
  // Keep gaps between page requests and visible glyphs on the preceding
  // page, matching the admitted complete index's lookup rule.
  const knownStart = known?.startScalar ?? (headPrefix !== undefined && target < headPrefix.nextRequestScalar() ?
    headPrefix.pageStartScalars()[Math.max(0, headPrefix.pageIndexAtOrBefore(target))] : undefined);
  return {
    offset: knownStart ?? headPrefix?.nextRequestScalar() ?? chapterStart(),
    unresolvedAnchor: knownStart === undefined ? target : -1,
  };
}
