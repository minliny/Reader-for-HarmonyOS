import type { JsonObject } from '@reader/core-harmony';
import type { ReadingGatewayRuntime } from './ReadingGatewayRuntime';
import type { ReadingSessionChapter, ReadingSessionImage } from './ReadingChapterWindow';
import { materializeReadingDocument } from './ReadingDocumentProjection';
import { prepareReadingChapterLayoutMap, ReadingSurfaceLayoutMap } from './ReadingSurfaceLayoutMap';
import { prepareReadingParagraphUtf16Ranges, type ReadingParagraphBoundaryMode, type ReadingParagraphUtf16Range } from './ReadingParagraphProjection';
import { decodeRemotePositionScope, type RemoteReadingPositionScope } from './RemoteReadingPositionMigration';

/** Explicitly a range, never a fake complete ReadingSessionChapter. */
export type ReadingDocumentWindow = {
  readonly scope: RemoteReadingPositionScope;
  readonly startScalar: number;
  readonly endScalar: number;
  readonly totalScalars: number;
  readonly content: string;
  readonly baseUrl: string;
  readonly images: ReadingSessionImage[];
  readonly layout: ReadingDocumentWindowLayout;
  readonly isCurrent: () => boolean;
};

/** Reuses the existing Unicode boundary mapping; no virtual indentation slots
 * or window-relative offsets can escape into Core's chapter position space. */
export class ReadingDocumentWindowLayout {
  private readonly map: ReadingSurfaceLayoutMap;
  private readonly start: number;
  constructor(content: string, startScalar: number) {
    this.start = integer(startScalar);
    this.map = new ReadingSurfaceLayoutMap(content);
  }
  scalarForUtf16(offset: number): number { return this.start + this.map.scalarForUtf16(offset); }
  utf16ForScalar(offset: number): number { return this.map.utf16ForScalar(offset - this.start); }
  endScalar(): number { return this.start + this.map.scalarCount(); }
  slice(start: number, end: number): string { return this.map.sliceByScalar(start - this.start, end - this.start); }
}

export async function readReadingDocumentWindow(runtime: ReadingGatewayRuntime, scope: RemoteReadingPositionScope,
  startScalar: number, scalarLimit: number, isCurrent: () => boolean): Promise<ReadingDocumentWindow | undefined> {
  integer(startScalar); integer(scalarLimit);
  if (scalarLimit === 0 || scalarLimit > 65536) throw new Error('invalid document window limit');
  if (runtime.supportsCoreCapability?.('reading.document.window.v1') !== true) return undefined;
  const contentValid = runtime.captureReadingContentValidity?.(scope.sourceId, scope.bookId);
  const current = (): boolean => isCurrent() && contentValid?.() !== false;
  if (!current()) throw new Error('reading document window was cancelled');
  const result = await runtime.request('reading.document.window', {
    sourceId: scope.sourceId, bookId: scope.bookId, chapterIndex: scope.chapterIndex, startScalar, scalarLimit,
    positionContext: { bodyVersion: scope.bodyVersion, processingVersion: scope.processingVersion,
      anchors: [{ id: 'window', offset: startScalar }] },
  }, { shouldCancel: (): boolean => !current() });
  if (!current()) throw new Error('reading document window was cancelled');
  const data = result.data;
  if (data['sourceId'] !== scope.sourceId || data['bookId'] !== scope.bookId || data['chapterIndex'] !== scope.chapterIndex)
    throw new Error('reading document window identity mismatch');
  if (data['kind'] === 'missing') {
    if (data['reason'] !== 'documentMissing' && data['reason'] !== 'sourceSwitchPending') throw new Error('invalid document window miss');
    return undefined;
  }
  if (data['kind'] !== 'ready') throw new Error('invalid document window result');
  const actual = decodeRemotePositionScope(data['positionScope']);
  if (actual === undefined || actual.sourceId !== scope.sourceId || actual.bookId !== scope.bookId ||
    actual.chapterIndex !== scope.chapterIndex || actual.bodyVersion !== scope.bodyVersion ||
    actual.processingVersion !== scope.processingVersion) throw new Error('reading document window scope mismatch');
  const start = integer(data['startScalar']), end = integer(data['endScalar']), total = integer(data['totalScalars']);
  if (start > startScalar || end < startScalar || end < start || end > total ||
    (end === start && start !== total) || data['hasMore'] !== (end < total) || end - start > scalarLimit + 8192)
    throw new Error('reading document window range mismatch');
  const baseUrl = data['baseUrl'];
  if (typeof baseUrl !== 'string') throw new Error('reading document window base URL missing');
  if (!Array.isArray(data['blocks']) || data['blocks'].length > 128) throw new Error('invalid reading document window blocks');
  const projected = await materializeReadingDocument(data as JsonObject, scope.sourceId, baseUrl, runtime, current, start);
  if (!current()) throw new Error('reading document window was cancelled');
  const layout = new ReadingDocumentWindowLayout(projected.content, start);
  if (layout.endScalar() !== end) throw new Error('reading document window text length mismatch');
  return { scope: actual, startScalar: start, endScalar: end, totalScalars: total,
    content: projected.content, baseUrl, images: projected.images, layout, isCurrent: current };
}

export type ReadingParagraphWindowDirection = 'before' | 'after';

/** Extend only the missing original paragraph context, using the existing
 * scanner and version-bound block RPC. An admitted window is retained for the
 * current page preparation; its caller releases unused paragraphs after page
 * admission. This function owns neither a chapter cache nor progress writes.
 * `provenEdges` is false only for the raw initial entry returned by Core. */
export async function extendReadingParagraphWindow(runtime: ReadingGatewayRuntime, chapter: ReadingSessionChapter,
  anchorScalar: number, direction: ReadingParagraphWindowDirection, mode: ReadingParagraphBoundaryMode,
  isCurrent: () => boolean, provenEdges: boolean = true): Promise<ReadingSessionChapter> {
  integer(anchorScalar);
  if (direction !== 'before' && direction !== 'after') throw new Error('invalid paragraph window direction');
  const contentValid = runtime.captureReadingContentValidity?.(chapter.sourceId, chapter.bookId);
  const current = (): boolean => isCurrent() && contentValid?.() !== false;
  const check = (): void => { if (!current()) throw new Error('reading paragraph window was cancelled'); };
  check();
  const initialMap = await prepareReadingChapterLayoutMap(chapter, current);
  if (!initialMap.containsScalar(anchorScalar)) throw new Error('paragraph window anchor is outside resident range');
  if (chapter.documentRange === undefined) return chapter;
  if (chapter.bodyVersion === undefined || chapter.processingVersion === undefined)
    throw new Error('reading paragraph window scope is missing');
  const scope: RemoteReadingPositionScope = { sourceId: chapter.sourceId, bookId: chapter.bookId,
    chapterIndex: chapter.chapterIndex, bodyVersion: chapter.bodyVersion, processingVersion: chapter.processingVersion };
  const original = chapter.documentRange;
  let working = chapter;
  let startKnown = provenEdges || original.startScalar === 0;
  let endKnown = provenEdges || original.endScalar === original.totalScalars;
  let nextDirection = direction;
  while (true) {
    check();
    const map = await prepareReadingChapterLayoutMap(working, current);
    const start = map.residentStart(), end = map.residentEnd(), total = map.scalarCount();
    const ranges = await prepareReadingParagraphUtf16Ranges(working.content, mode, current);
    check();
    if (ranges === undefined) throw new Error('reading paragraph window was cancelled');
    // Same conservative edge proof as completeReadingParagraphWindow: a raw
    // leading/trailing paragraph may be truncated, including half of CRLF.
    const complete = ranges.filter((_range: ReadingParagraphUtf16Range, index: number): boolean =>
      (startKnown || index > 0) && (endKnown || index < ranges.length - 1));
    const first = complete[0], last = complete[complete.length - 1];
    const firstScalar = first === undefined ? undefined : map.scalarForUtf16(first.startUtf16);
    const lastScalar = last === undefined ? undefined : map.scalarForUtf16(last.endUtf16);
    const anchorUtf16 = map.utf16ForScalar(anchorScalar);
    const containsAnchor = first !== undefined && last !== undefined &&
      (anchorScalar >= (firstScalar as number) || (startKnown && working.content.substring(anchorUtf16, first.startUtf16).trim().length === 0)) &&
      (anchorScalar < (lastScalar as number) || (endKnown && working.content.substring(last.endUtf16, anchorUtf16).trim().length === 0));
    const extendsRequestedEdge = !provenEdges ||
      (direction === 'before' ? (firstScalar !== undefined && firstScalar < anchorScalar) || start === 0 :
        (lastScalar !== undefined && lastScalar > anchorScalar) || end === total);
    if (first !== undefined && last !== undefined && containsAnchor && extendsRequestedEdge) {
      const startUtf16 = startKnown ? 0 : first.startUtf16;
      const endUtf16 = endKnown ? working.content.length : last.endUtf16;
      const admittedStart = map.scalarForUtf16(startUtf16), admittedEnd = map.scalarForUtf16(endUtf16);
      if (provenEdges && (admittedStart > original.startScalar || admittedEnd < original.endScalar))
        throw new Error('paragraph window lost admitted context');
      check();
      return { ...chapter, content: working.content.substring(startUtf16, endUtf16), textLayoutIdentity: undefined,
        documentRange: admittedStart === 0 && admittedEnd === total ? undefined :
          { startScalar: admittedStart, endScalar: admittedEnd, totalScalars: total },
        images: working.images.filter((image: ReadingSessionImage): boolean => image.startScalar >= admittedStart && image.endScalar <= admittedEnd) };
    }
    // A genuinely empty/whitespace-only chapter has no paragraph to shape.
    if (start === 0 && end === total) return { ...working, documentRange: undefined };
    const needBefore = start > 0 && (!startKnown &&
      (firstScalar === undefined || anchorScalar < firstScalar) ||
      provenEdges && direction === 'before' && (firstScalar === undefined || firstScalar >= anchorScalar));
    const needAfter = end < total && (!endKnown &&
      (lastScalar === undefined || anchorScalar >= lastScalar) ||
      provenEdges && direction === 'after' && (lastScalar === undefined || lastScalar <= anchorScalar));
    const before = needBefore && (!needAfter || nextDirection === 'before');
    if (!before && !needAfter) throw new Error('reading paragraph window cannot prove anchor context');
    // One scalar overlap verifies continuity as well as scope. Core may align
    // to a stored block, but every request remains below its 65536 limit.
    let lookBehind = Math.min(start, 8192);
    let fetched: ReadingDocumentWindow | undefined;
    while (true) {
      const requestStart = before ? start - lookBehind : Math.max(start, end - 1);
      const limit = before ? lookBehind + 1 : 8193;
      fetched = await readReadingDocumentWindow(runtime, scope, requestStart, limit, current);
      check();
      if (fetched === undefined || fetched.totalScalars !== total || fetched.baseUrl !== (chapter.chapterUrl ?? ''))
        break;
      // The 128-part limit can underfill a backwards request in image-rich
      // content. Retry closer to the admitted edge until an overlap exists;
      // never join a disconnected island or interpret underfill as EOF.
      if (!before || fetched.endScalar > start || lookBehind <= 1) break;
      lookBehind = Math.max(1, Math.floor(lookBehind / 2));
    }
    check();
    if (fetched === undefined || !fetched.isCurrent()) throw new Error('reading paragraph window is unavailable');
    if (fetched.totalScalars !== total || fetched.baseUrl !== (chapter.chapterUrl ?? ''))
      throw new Error('reading paragraph window document mismatch');
    if (before ? fetched.startScalar >= start : fetched.endScalar <= end)
      throw new Error('reading paragraph window made no progress');
    const overlapStart = Math.max(start, fetched.startScalar), overlapEnd = Math.min(end, fetched.endScalar);
    if (overlapStart >= overlapEnd || map.sliceByScalar(overlapStart, overlapEnd) !== fetched.layout.slice(overlapStart, overlapEnd))
      throw new Error('reading paragraph window overlap mismatch');
    const images = mergeWindowImages(working.images, fetched.images, overlapStart, overlapEnd);
    const mergedStart = Math.min(start, fetched.startScalar), mergedEnd = Math.max(end, fetched.endScalar);
    const content = (mergedStart < start ? fetched.layout.slice(mergedStart, start) : '') + working.content +
      (mergedEnd > end ? fetched.layout.slice(end, mergedEnd) : '');
    if (mergedStart < start) startKnown = mergedStart === 0;
    if (mergedEnd > end) endKnown = mergedEnd === total;
    working = { ...chapter, content, textLayoutIdentity: undefined, images,
      documentRange: { startScalar: mergedStart, endScalar: mergedEnd, totalScalars: total } };
    nextDirection = before ? 'after' : 'before';
  }
}

function mergeWindowImages(existing: ReadingSessionImage[], incoming: ReadingSessionImage[],
  overlapStart: number, overlapEnd: number): ReadingSessionImage[] {
  const overlapExisting = existing.filter((image: ReadingSessionImage): boolean => image.startScalar >= overlapStart && image.endScalar <= overlapEnd);
  const overlapIncoming = incoming.filter((image: ReadingSessionImage): boolean => image.startScalar >= overlapStart && image.endScalar <= overlapEnd);
  if (overlapExisting.length !== overlapIncoming.length) throw new Error('reading paragraph window image mismatch');
  const images = existing.slice();
  for (const image of incoming) {
    const retained = images.find((candidate: ReadingSessionImage): boolean => candidate.startScalar === image.startScalar);
    if (retained !== undefined) {
      if (retained.endScalar !== image.endScalar || retained.source !== image.source || retained.baseUrl !== image.baseUrl)
        throw new Error('reading paragraph window image mismatch');
    } else images.push(image);
  }
  return images.sort((left: ReadingSessionImage, right: ReadingSessionImage): number => left.startScalar - right.startScalar);
}

function integer(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new Error('invalid document window integer');
  return value;
}
