import type { JsonObject } from '@reader/core-harmony';
import type { ReadingGatewayRuntime } from './ReadingGatewayRuntime';
import type { ReadingSessionImage } from './ReadingChapterWindow';
import { deriveReadingContentVersion } from './ReadingPaginationIndex';
import { canonicalReadingImageBaseUrl } from '../../common/ReadingImageIdentity';

export type MaterializedReadingDocument = {
  content: string;
  images: ReadingSessionImage[];
  contentVersion: string;
};

type ImageBlock = {
  source: string;
  startScalar: number;
  endScalar: number;
};

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
  _isCurrent?: () => boolean,
): Promise<MaterializedReadingDocument> {
  const content = data['content'];
  if (typeof content !== 'string') {
    throw new Error('chapter content is not a native reading document');
  }
  const blocks = data['blocks'];
  if (blocks === undefined) {
    if (content.indexOf('\uFFFC') >= 0) {
      throw new Error('chapter image markers are missing Core block metadata');
    }
    return { content, images: [], contentVersion: deriveReadingContentVersion(content) };
  }
  if (!Array.isArray(blocks)) {
    throw new Error('chapter content returned invalid reading blocks');
  }
  const imageBlocks = validateBlocks(content, blocks);
  if (imageBlocks.length === 0) {
    return { content, images: [], contentVersion: deriveReadingContentVersion(content) };
  }
  const canonicalBaseUrl = canonicalReadingImageBaseUrl(baseUrl);
  const images: ReadingSessionImage[] = [];
  for (const block of imageBlocks) {
    images.push({
      source: block.source,
      baseUrl: canonicalBaseUrl,
      startScalar: block.startScalar,
      endScalar: block.endScalar,
      state: 'pending',
      pixelMap: undefined,
      fileUri: '',
      intrinsicWidth: 0,
      intrinsicHeight: 0,
      revision: 'pending',
    });
  }
  const mediaVersion = images.map((image: ReadingSessionImage): string =>
    `${sourceId}:${image.startScalar}:${image.source}:${image.baseUrl ?? ''}`).join('|');
  return {
    content,
    images,
    contentVersion: `reader-document-v1:${deriveReadingContentVersion(content)}:` +
      `${deriveReadingContentVersion(mediaVersion)}`,
  };
}

function validateBlocks(content: string, values: unknown[]): ImageBlock[] {
  let expectedStart = 0;
  let startUtf16 = 0;
  const images: ImageBlock[] = [];
  for (const raw of values) {
    const block = requireObject(raw, 'reading block');
    const kind = block['kind'];
    const startScalar = requireNonNegativeInteger(block['startScalar'], 'reading block startScalar');
    const endScalar = requireNonNegativeInteger(block['endScalar'], 'reading block endScalar');
    if (startScalar !== expectedStart || endScalar <= startScalar) {
      throw new Error('reading blocks do not form one contiguous canonical scalar projection');
    }
    const endUtf16 = advanceUtf16ByScalars(content, startUtf16, endScalar - startScalar);
    if (endUtf16 < 0) {
      throw new Error('reading blocks do not form one contiguous canonical scalar projection');
    }
    const projectedText = content.substring(startUtf16, endUtf16);
    if (kind === 'text') {
      const text = block['text'];
      if (typeof text !== 'string' || projectedText !== text) {
        throw new Error('reading text block does not match canonical chapter content');
      }
    } else if (kind === 'image') {
      const source = block['source'];
      if (typeof source !== 'string' || source.trim().length === 0 || endScalar !== startScalar + 1 ||
        projectedText !== '\uFFFC') {
        throw new Error('reading image block does not match its canonical object scalar');
      }
      images.push({ source, startScalar, endScalar });
    } else {
      throw new Error('reading block returned an unsupported kind');
    }
    expectedStart = endScalar;
    startUtf16 = endUtf16;
  }
  if (startUtf16 !== content.length) {
    throw new Error('reading blocks do not cover the complete canonical chapter content');
  }
  return images;
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

function advanceUtf16ByScalars(text: string, startUtf16: number, scalarLength: number): number {
  let utf16 = startUtf16;
  for (let scalar = 0; scalar < scalarLength; scalar += 1) {
    if (utf16 >= text.length) {
      return -1;
    }
    const point = text.codePointAt(utf16);
    utf16 += point !== undefined && point > 0xFFFF ? 2 : 1;
  }
  return utf16;
}
