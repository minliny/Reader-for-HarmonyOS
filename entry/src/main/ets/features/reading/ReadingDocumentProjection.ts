import type { JsonObject } from '@reader/core-harmony';
import type { ReadingGatewayRuntime } from './ReadingGatewayRuntime';
import { hasKnownReadingImageGeometry, hasImmutableLocalReadingImageSource, type ReadingSessionImage } from './ReadingChapterWindow';
import { deriveReadingContentVersion } from './ReadingPaginationIndex';
import { canonicalReadingImageBaseUrl } from '../../common/ReadingImageIdentity';
import { readingChapterLayoutMap, readingChapterTextIdentity, type ReadingChapterText,
  type ReadingDocumentRange } from './ReadingSurfaceLayoutMap';

export type MaterializedReadingDocument = {
  content: string;
  images: ReadingSessionImage[];
  contentVersion: string;
  textLayoutIdentity?: ReadingChapterText;
};

type ImageBlock = {
  source: string;
  startScalar: number;
  endScalar: number;
  imageWidthBasisPoints?: number;
  imageIntrinsicWidth?: number;
  imageIntrinsicHeight?: number;
};

/** Small persisted entry only. Shares the canonical block checks, but has no
 * timers, I/O or async continuations between admission and the first build. */
export function materializePreparedReadingDocument(data: JsonObject, scalarStart: number,
  contentVersion: string, documentRange?: ReadingDocumentRange): MaterializedReadingDocument {
  requireNonNegativeInteger(scalarStart, 'document scalar start');
  const content = data['content'];
  const blocks = data['blocks'];
  if (typeof content !== 'string' || content.length > 131072 || !Array.isArray(blocks) || blocks.length > 128 ||
    contentVersion.length === 0) throw new Error('invalid prepared reading document');
  const lastEnd = blocks.length === 0 ? scalarStart : requireNonNegativeInteger(
    requireObject(blocks[blocks.length - 1], 'reading block')['endScalar'], 'reading block endScalar');
  const range = documentRange ?? { startScalar: scalarStart, endScalar: lastEnd, totalScalars: lastEnd };
  if (range.startScalar !== scalarStart || range.endScalar !== lastEnd || lastEnd - scalarStart > 65536)
    throw new Error('invalid prepared reading block range');
  const text: ReadingChapterText = { content, documentRange:
    range.startScalar === 0 && range.endScalar === range.totalScalars ? undefined : range };
  const map = readingChapterLayoutMap(text);
  if (map.residentEnd() !== lastEnd) throw new Error('invalid prepared reading scalar extent');
  let expectedStart = scalarStart;
  const images: ReadingSessionImage[] = [];
  for (const raw of blocks) {
    const block = requireObject(raw, 'reading block');
    const start = requireNonNegativeInteger(block['startScalar'], 'reading block startScalar');
    const end = requireNonNegativeInteger(block['endScalar'], 'reading block endScalar');
    if (start !== expectedStart || end <= start || end - scalarStart > 65536)
      throw new Error('invalid prepared reading block range');
    const image = validateBlockProjection(block, map.sliceByScalar(start, end), start, end);
    if (image !== undefined) {
      const pending = pendingReadingImage(image, undefined);
      if (data['sourceId'] !== 'local' || !hasImmutableLocalReadingImageSource(pending.source))
        throw new Error('READING_PREPARED_IMAGE_GEOMETRY_UNAVAILABLE');
      // Unknown geometry does not invalidate other complete text paragraphs
      // in this window. The page assembler waits only if it reaches this image.
      images.push(pending);
    }
    expectedStart = end;
  }
  if (expectedStart !== map.residentEnd()) throw new Error('reading blocks do not cover the complete canonical chapter content');
  return { content, images, contentVersion, textLayoutIdentity: readingChapterTextIdentity(text) };
}

/**
 * The single Harmony projection boundary for local and online chapters.
 * Core owns block parsing and canonical offsets; this function validates that
 * contract and emits pending image anchors. Byte loading is deliberately
 * deferred until pagination reaches that exact anchor.
 */
export async function materializeReadingDocument(
  data: JsonObject,
  sourceId: string,
  baseUrl: string | undefined,
  _runtime: ReadingGatewayRuntime,
  isCurrent?: () => boolean,
  scalarStart: number = 0,
  admittedContentVersion?: string,
): Promise<MaterializedReadingDocument> {
  assertProjectionCurrent(isCurrent);
  requireNonNegativeInteger(scalarStart, 'document scalar start');
  const content = data['content'];
  if (typeof content !== 'string') {
    throw new Error('chapter content is not a native reading document');
  }
  const blocks = data['blocks'];
  if (blocks === undefined) {
    if (content.indexOf('\uFFFC') >= 0) {
      throw new Error('chapter image markers are missing Core block metadata');
    }
    return { content, images: [], contentVersion: admittedContentVersion ?? deriveReadingContentVersion(content) };
  }
  if (!Array.isArray(blocks)) {
    throw new Error('chapter content returned invalid reading blocks');
  }
  const imageBlocks = await validateBlocks(content, blocks, scalarStart, isCurrent);
  assertProjectionCurrent(isCurrent);
  if (imageBlocks.length === 0) {
    return { content, images: [], contentVersion: admittedContentVersion ?? deriveReadingContentVersion(content) };
  }
  const canonicalBaseUrl = canonicalReadingImageBaseUrl(baseUrl);
  const images: ReadingSessionImage[] = [];
  for (const block of imageBlocks) {
    images.push(pendingReadingImage(block, canonicalBaseUrl));
  }
  const mediaVersion = images.map((image: ReadingSessionImage): string =>
    `${sourceId}:${image.startScalar}:${image.source}:${image.baseUrl ?? ''}` +
      (image.imageWidthBasisPoints !== undefined && image.imageWidthBasisPoints !== 10000 ?
        `:width=${image.imageWidthBasisPoints}` : '') +
      (hasKnownReadingImageGeometry(image) ? `:size=${image.intrinsicWidth}x${image.intrinsicHeight}` : '')).join('|');
  return {
    content,
    images,
    contentVersion: admittedContentVersion ?? (`reader-document-v1:${deriveReadingContentVersion(content)}:` +
      `${deriveReadingContentVersion(mediaVersion)}`),
  };
}

function pendingReadingImage(block: ImageBlock, baseUrl: string | undefined): ReadingSessionImage {
    return {
      source: block.source,
      baseUrl,
      startScalar: block.startScalar,
      endScalar: block.endScalar,
      state: 'pending',
      pixelMap: undefined,
      fileUri: '',
      intrinsicWidth: block.imageIntrinsicWidth ?? 0,
      intrinsicHeight: block.imageIntrinsicHeight ?? 0,
      imageWidthBasisPoints: block.imageWidthBasisPoints,
      revision: 'pending',
    };
}

async function validateBlocks(content: string, values: unknown[], scalarStart: number,
  isCurrent: (() => boolean) | undefined): Promise<ImageBlock[]> {
  const work: ReadingProjectionWork = { remaining: 8192, isCurrent };
  let expectedStart = scalarStart;
  let startUtf16 = 0;
  const images: ImageBlock[] = [];
  for (const raw of values) {
    const block = requireObject(raw, 'reading block');
    const startScalar = requireNonNegativeInteger(block['startScalar'], 'reading block startScalar');
    const endScalar = requireNonNegativeInteger(block['endScalar'], 'reading block endScalar');
    if (startScalar !== expectedStart || endScalar <= startScalar) {
      throw new Error('reading blocks do not form one contiguous canonical scalar projection');
    }
    const endUtf16 = await advanceUtf16ByScalars(content, startUtf16, endScalar - startScalar, work);
    if (endUtf16 < 0) {
      throw new Error('reading blocks do not form one contiguous canonical scalar projection');
    }
    const projectedText = content.substring(startUtf16, endUtf16);
    const image = validateBlockProjection(block, projectedText, startScalar, endScalar);
    if (image !== undefined) images.push(image);
    expectedStart = endScalar;
    startUtf16 = endUtf16;
  }
  if (startUtf16 !== content.length) {
    throw new Error('reading blocks do not cover the complete canonical chapter content');
  }
  return images;
}

function validateBlockProjection(block: JsonObject, projectedText: string, startScalar: number,
  endScalar: number): ImageBlock | undefined {
  if (block['kind'] === 'text') {
    if (typeof block['text'] !== 'string' || projectedText !== block['text'])
      throw new Error('reading text block does not match canonical chapter content');
    return undefined;
  }
  if (block['kind'] === 'image') {
    const source = block['source'];
    if (typeof source !== 'string' || source.trim().length === 0 || endScalar !== startScalar + 1 || projectedText !== '\uFFFC')
      throw new Error('reading image block does not match its canonical object scalar');
    const width = block['imageWidthBasisPoints'];
    if (width !== undefined && (typeof width !== 'number' || !Number.isSafeInteger(width) || width <= 0 || width > 10000))
      throw new Error('reading image width is outside its relative layout contract');
    const intrinsicWidth = block['imageIntrinsicWidth'], intrinsicHeight = block['imageIntrinsicHeight'];
    if ((intrinsicWidth !== undefined || intrinsicHeight !== undefined) &&
      (typeof intrinsicWidth !== 'number' || typeof intrinsicHeight !== 'number' ||
        !Number.isSafeInteger(intrinsicWidth) || !Number.isSafeInteger(intrinsicHeight) ||
        intrinsicWidth <= 0 || intrinsicHeight <= 0 || intrinsicWidth > 4096 || intrinsicHeight > 4096 ||
        intrinsicWidth * intrinsicHeight > 4 * 1024 * 1024))
      throw new Error('reading image intrinsic geometry exceeds its bounded contract');
    return { source, startScalar, endScalar, imageWidthBasisPoints: width as number | undefined,
      imageIntrinsicWidth: intrinsicWidth as number | undefined, imageIntrinsicHeight: intrinsicHeight as number | undefined };
  }
  throw new Error('reading block returned an unsupported kind');
}

function requireObject(value: unknown, context: string): JsonObject {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${context} must be an object`);
  }
  return value as JsonObject;
}

function requireNonNegativeInteger(value: unknown, context: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${context} must be a non-negative safe integer`);
  }
  return value;
}

type ReadingProjectionWork = { remaining: number; isCurrent: (() => boolean) | undefined };

function assertProjectionCurrent(isCurrent: (() => boolean) | undefined): void {
  if (isCurrent?.() === false) throw new Error('reading document projection cancelled');
}

async function advanceUtf16ByScalars(text: string, startUtf16: number, scalarLength: number,
  work: ReadingProjectionWork): Promise<number> {
  let utf16 = startUtf16;
  for (let scalar = 0; scalar < scalarLength; scalar += 1) {
    if (utf16 >= text.length) {
      return -1;
    }
    const point = text.codePointAt(utf16);
    utf16 += point !== undefined && point > 0xFFFF ? 2 : 1;
    if (--work.remaining === 0) {
      work.remaining = 8192;
      await new Promise<void>((resolve): void => { setTimeout(resolve, 0); });
      assertProjectionCurrent(work.isCurrent);
    }
  }
  return utf16;
}
