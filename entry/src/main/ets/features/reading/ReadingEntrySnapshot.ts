import type { JsonObject } from '@reader/core-harmony';
import type { ReadingGatewayRuntime } from './ReadingGatewayRuntime';
import { completeReadingParagraphWindow, type ReadingParagraphBoundaryMode } from './ReadingParagraphProjection';
import { readingChapterLayoutMap, sliceReadingChapterText, type ReadingDocumentRange } from './ReadingSurfaceLayoutMap';
import type { ReadingSessionChapter } from './ReadingChapterWindow';
import type { LocalReadingProgressState, LocalReadingTocEntry } from './LocalReadingFlowGateway';
import { materializeReadingDocument, materializePreparedReadingDocument, type MaterializedReadingDocument } from './ReadingDocumentProjection';
import { captureRemotePositionContext, encodeRemotePositionContext, decodeRemotePositionMigration, decodeRemotePositionScope, type RemoteReadingPositionContext } from './RemoteReadingPositionMigration';

export type ReadingEntryNavigationItem = LocalReadingTocEntry & { position: number; readablePosition?: number };
export type ReadingEntryNavigation = {
  revision: string; chapterCount: number; readableChapterCount: number;
  current: ReadingEntryNavigationItem; before: ReadingEntryNavigationItem[]; after: ReadingEntryNavigationItem[];
};
export type ReadingEntrySnapshot = {
  chapter: ReadingSessionChapter; progress: LocalReadingProgressState;
  navigation?: ReadingEntryNavigation;
  requestedScalar?: number;
  isCurrent: () => boolean;
};

/** Decode one Core-owned offline entry, without constructing an acquisition session. */
export async function readReadingEntrySnapshot(runtime: ReadingGatewayRuntime, sourceId: string, bookId: string,
  chapterIndex: number | undefined, isCurrent: () => boolean,
  positionContext?: RemoteReadingPositionContext, windowScalarLimit?: number): Promise<ReadingEntrySnapshot | undefined> {
  if (!isCurrent() || runtime.supportsCoreCapability?.('reading.entry.snapshot.v1') !== true) return undefined;
  const contentCurrent = runtime.captureReadingContentValidity?.(sourceId, bookId);
  const current = (): boolean => isCurrent() && contentCurrent?.() !== false;
  const params: JsonObject = { sourceId, bookId };
  const windowRequested = windowScalarLimit !== undefined && runtime.supportsCoreCapability?.('reading.entry.snapshot.window.v1') === true;
  if (windowScalarLimit !== undefined && (!Number.isSafeInteger(windowScalarLimit) || windowScalarLimit < 1 || windowScalarLimit > 61440))
    throw new Error('invalid entry window limit');
  if (windowRequested) params['windowScalarLimit'] = windowScalarLimit as number;
  if (chapterIndex !== undefined) params['chapterIndex'] = chapterIndex;
  const context = captureRemotePositionContext(positionContext);
  if (context !== undefined) params['positionContext'] = encodeRemotePositionContext(context);
  const result = await runtime.request('reading.entry.snapshot', params, { shouldCancel: (): boolean => !current() });
  if (!current()) throw new Error('reading entry snapshot was cancelled');
  const data = result.data;
  if (data['kind'] !== 'ready') return decodeEntrySnapshot(data, sourceId, bookId, chapterIndex, context,
    windowRequested, windowScalarLimit, current);
  const scope = decodeRemotePositionScope(data['positionScope']);
  if (scope === undefined) throw new Error('reading entry position scope mismatch');
  const version = `reader-entry-scope-v1:${JSON.stringify([sourceId, bookId, integer(data, 'chapterIndex'),
    scope.bodyVersion, scope.processingVersion, string(data, 'baseUrl')])}${imagePresentationSuffix(data)}`;
  const range = data['documentWindow'] === undefined || data['documentWindow'] === null ? undefined : object(data['documentWindow']);
  // A bounded text window can use the same synchronous validator as first
  // build. Do not add per-block continuations or 8K-scalar timers after I/O;
  // whole chapters and images keep the cooperative materialization path.
  const content = data['content'], blocks = data['blocks'];
  if (windowRequested && range !== undefined && typeof content === 'string' && content.length <= 131072 &&
    Array.isArray(blocks) && blocks.length <= 128 &&
    integer(range, 'endScalar') - integer(range, 'startScalar') <= 65536 &&
    blocks.every((block: unknown): boolean => block !== null && typeof block === 'object' && !Array.isArray(block) &&
      (block as JsonObject)['kind'] === 'text')) {
    return decodeEntrySnapshot(data, sourceId, bookId, chapterIndex, context,
      windowRequested, windowScalarLimit, current);
  }
  const document = await materializeReadingDocument(data, sourceId, string(data, 'baseUrl') || undefined, runtime, current,
    range === undefined ? 0 : integer(range, 'startScalar'), version);
  return decodeEntrySnapshot(data, sourceId, bookId, chapterIndex, context, windowRequested, windowScalarLimit, current, document);
}

/** Does not touch optional preparation. Every ready result came from one
 * persisted read transaction and is decoded before the caller's first build. */
export function readPreparedReadingEntrySnapshot(runtime: ReadingGatewayRuntime, sourceId: string, bookId: string,
  chapterIndex: number | undefined, isCurrent: () => boolean, mode: ReadingParagraphBoundaryMode,
  positionContext?: RemoteReadingPositionContext): ReadingEntrySnapshot | undefined {
  if (!isCurrent() || runtime.supportsCoreCapability?.('reading.entry.firstFrame.v1') !== true ||
    runtime.readPreparedEntry === undefined) return undefined;
  const contentCurrent = runtime.captureReadingContentValidity?.(sourceId, bookId);
  const current = (): boolean => isCurrent() && contentCurrent?.() !== false;
  if (!current()) return undefined;
  const limit = 16384;
  const params: JsonObject = { sourceId, bookId, windowScalarLimit: limit };
  if (chapterIndex !== undefined) params['chapterIndex'] = chapterIndex;
  const context = captureRemotePositionContext(positionContext);
  if (context !== undefined) params['positionContext'] = encodeRemotePositionContext(context);
  const data = runtime.readPreparedEntry(params);
  if (!current()) return undefined;
  if (data['sourceId'] !== sourceId || data['bookId'] !== bookId) throw new Error('prepared entry identity mismatch');
  // A known damaged cache must enter the foreground position transaction before
  // it can supply a first frame. Ordinary prepared chapters keep this sync path.
  if (data['sourceCorrectionRequired'] === true) return undefined;
  if (data['kind'] === 'unavailable') {
    if (!['storageUnsupported', 'storageBusy', 'runtimeClosed', 'catalogMissing', 'documentMissing',
      'sourceSwitchPending', 'positionUnresolved', 'resourceLimit', 'corruptDocument'].includes(string(data, 'reason')))
      throw new Error('unknown prepared entry outcome');
    return undefined;
  }
  if (string(data, 'progressRevision').length === 0) throw new Error('prepared entry progress observation missing');
  const snapshot = decodeEntrySnapshot(data, sourceId, bookId, chapterIndex, context, true, limit, current);
  return snapshot === undefined ? undefined : qualifyReadingEntryWindow(snapshot, mode);
}

function decodeEntrySnapshot(data: JsonObject, sourceId: string, bookId: string,
  chapterIndex: number | undefined, context: RemoteReadingPositionContext | undefined,
  windowRequested: boolean, windowScalarLimit: number | undefined, current: () => boolean,
  materialized?: MaterializedReadingDocument): ReadingEntrySnapshot | undefined {
  if (data['sourceId'] !== sourceId || data['bookId'] !== bookId) throw new Error('reading entry identity mismatch');
  if (data['kind'] === 'missing') {
    if (!['catalogMissing', 'contentMissing', 'sourceSwitchPending', 'leadingContentEmpty'].includes(string(data, 'reason'))) throw new Error('unknown reading entry miss');
    return undefined;
  }
  if (data['kind'] !== 'ready') throw new Error('invalid reading entry result');
  const index = integer(data, 'chapterIndex');
  if (chapterIndex !== undefined && index !== chapterIndex) throw new Error('reading entry chapter mismatch');
  const scope = decodeRemotePositionScope(data['positionScope']);
  if (scope === undefined || scope.sourceId !== sourceId || scope.bookId !== bookId || scope.chapterIndex !== index) throw new Error('reading entry position scope mismatch');
  decodeRemotePositionMigration(undefined, sourceId, bookId, scope.bodyVersion, scope.processingVersion, context);
  let documentRange: ReadingDocumentRange | undefined;
  let windowAnchor: number | undefined;
  if (data['documentWindow'] !== undefined && data['documentWindow'] !== null) {
    if (!windowRequested) throw new Error('unexpected partial reading entry');
    const range = object(data['documentWindow']);
    const startScalar = integer(range, 'startScalar'), endScalar = integer(range, 'endScalar');
    const totalScalars = integer(range, 'totalScalars'), requestedScalar = integer(range, 'requestedScalar');
    if (startScalar > requestedScalar || endScalar < requestedScalar || endScalar < startScalar || endScalar > totalScalars ||
      endScalar - startScalar > (windowScalarLimit as number) + 4096 + 8192 ||
      (startScalar === endScalar && endScalar !== totalScalars)) throw new Error('invalid entry window range');
    const expected = context?.anchors[0]?.offset;
    if (expected !== undefined && requestedScalar !== expected) throw new Error('entry window anchor mismatch');
    documentRange = { startScalar, endScalar, totalScalars };
    windowAnchor = requestedScalar;
  }
  const contentVersion = `reader-entry-scope-v1:${JSON.stringify([sourceId, bookId, index,
    scope.bodyVersion, scope.processingVersion, string(data, 'baseUrl')])}${imagePresentationSuffix(data)}`;
  const document = materialized ?? materializePreparedReadingDocument(data, documentRange?.startScalar ?? 0, contentVersion, documentRange);
  if (!current()) throw new Error('reading entry snapshot was cancelled');
  const chapter: ReadingSessionChapter = { sourceId, bookId, chapterIndex: index,
    chapterTitle: string(data, 'chapterTitle'), chapterUrl: string(data, 'baseUrl') || undefined,
    content: document.content, documentRange: documentRange !== undefined &&
      (documentRange.startScalar !== 0 || documentRange.endScalar !== documentRange.totalScalars) ? documentRange : undefined,
    images: document.images, contentVersion, textLayoutIdentity: document.textLayoutIdentity,
    bodyVersion: scope.bodyVersion, processingVersion: scope.processingVersion,
    cacheRefreshRequired: data['contentRefreshRequired'] === true,
    sourceCorrectionRequired: data['sourceCorrectionRequired'] === true,
    extractionVia: sourceId === 'local' ? 'local' : 'rule' };
  if (documentRange !== undefined) {
    const map = readingChapterLayoutMap(chapter);
    if (map.residentStart() !== documentRange.startScalar || map.residentEnd() !== documentRange.endScalar)
      throw new Error('invalid entry window resident range');
  }
  const progressRevision = typeof data['progressRevision'] === 'string' ? data['progressRevision'] as string : undefined;
  let progress: LocalReadingProgressState = { kind: 'missing' };
  if (data['progress'] !== null && data['progress'] !== undefined) {
    const raw = object(data['progress']);
    if (raw['sourceId'] !== sourceId || raw['bookId'] !== bookId) throw new Error('reading entry progress identity mismatch');
    const value = raw['chapterProgress'];
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) throw new Error('invalid entry chapter progress');
    const progressIndex = integer(raw, 'chapterIndex');
    if (progressIndex === index && (raw['bodyVersion'] !== scope.bodyVersion || raw['processingVersion'] !== scope.processingVersion)) throw new Error('reading entry progress scope mismatch');
    progress = { kind: 'restored', progress: { bookId, chapterIndex: progressIndex,
      chapterOffset: integer(raw, 'chapterOffset'), chapterProgress: value, updatedAt: integer(raw, 'updatedAt'),
      ...(typeof raw['locationRevision'] === 'string' ? { locationRevision: raw['locationRevision'] as string } : {}),
      ...(progressIndex === index ? { bodyVersion: scope.bodyVersion, processingVersion: scope.processingVersion } : {}) } };
  }
  if (progressRevision !== undefined) progress.progressRevision = progressRevision;
  let navigation: ReadingEntryNavigation | undefined;
  if (data['navigation'] !== null && data['navigation'] !== undefined) {
    const raw = object(data['navigation']);
    const before = raw['before'], after = raw['after'];
    if (!Array.isArray(before) || !Array.isArray(after) || before.length > 3 || after.length > 3) throw new Error('invalid reading navigation window');
    navigation = { revision: string(raw, 'revision'), chapterCount: integer(raw, 'chapterCount'), readableChapterCount: integer(raw, 'readableChapterCount'),
      current: navigationItem(raw['current']), before: before.map(navigationItem), after: after.map(navigationItem) };
    const items = [...navigation.before, navigation.current, ...navigation.after];
    const ids = new Set<number>(); let previous = -1;
    for (const item of items) {
      if (ids.has(item.index) || item.position <= previous || item.position >= navigation.chapterCount) throw new Error('invalid reading navigation order');
      if (item.navigable && (item.readablePosition === undefined || item.readablePosition >= navigation.readableChapterCount)) throw new Error('invalid readable navigation position');
      ids.add(item.index); previous = item.position;
    }
    if (navigation.current.index !== index || navigation.revision.length === 0) throw new Error('reading navigation identity mismatch');
  }
  return { chapter, progress, navigation, requestedScalar: windowAnchor, isCurrent: current };
}
function navigationItem(value: unknown): ReadingEntryNavigationItem {
  const raw = object(value);
  if (typeof raw['navigable'] !== 'boolean') throw new Error('invalid reading navigation availability');
  const level = raw['level'] === null || raw['level'] === undefined ? undefined : integer(raw, 'level');
  if (level !== undefined && level < 1) throw new Error('invalid reading navigation level');
  return { index: integer(raw, 'index'), position: integer(raw, 'position'),
    ...(raw['readablePosition'] === null || raw['readablePosition'] === undefined ? {} : { readablePosition: integer(raw, 'readablePosition') }), title: string(raw, 'title'),
    ...(level === undefined ? {} : { level }), navigable: raw['navigable'] as boolean, downloadState: 'unknown' };
}
function object(value: unknown): JsonObject {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid reading entry object');
  return value as JsonObject;
}
/** Layout upgrades have a chapter-wide identity without changing character
 * position proofs. Every resident window must keep that same pagination key. */
function imagePresentationSuffix(data: JsonObject): string {
  const version = data['imagePresentationVersion'];
  if (version === undefined) return '';
  if (typeof version !== 'string' || version.length === 0 || version.length > 256)
    throw new Error('invalid entry image presentation version');
  return `:image-presentation=${JSON.stringify(version)}`;
}
function string(raw: JsonObject, key: string): string {
  const value = raw[key]; if (typeof value !== 'string') throw new Error(`invalid reading entry ${key}`); return value;
}
function integer(raw: JsonObject, key: string): number {
  const value = raw[key]; if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new Error(`invalid reading entry ${key}`); return value;
}

/** Legacy directory UI can collect bounded projections after the visible entry.
 * Every page is bound to one revision; never concatenate changed catalogs. */
export async function readReadingCatalog(runtime: ReadingGatewayRuntime, sourceId: string, bookId: string,
  isCurrent: () => boolean): Promise<{ bookId: string; entries: LocalReadingTocEntry[]; revision: string } | undefined> {
  if (runtime.supportsCoreCapability?.('reading.catalog.page.v1') !== true) return undefined;
  const valid = runtime.captureReadingContentValidity?.(sourceId, bookId);
  const current = (): boolean => isCurrent() && valid?.() !== false;
  const entries: LocalReadingTocEntry[] = [];
  const ids = new Set<number>();
  let revision: string | undefined, count: number | undefined;
  while (true) {
    if (!current()) throw new Error('reading catalog was cancelled');
    const params: JsonObject = { sourceId, bookId, offset: entries.length, limit: 256 };
    if (revision !== undefined) params['revision'] = revision;
    const result = await runtime.request('reading.catalog.page', params, { shouldCancel: (): boolean => !current() });
    if (!current()) throw new Error('reading catalog was cancelled');
    const data = result.data;
    if (data['sourceId'] !== sourceId || data['bookId'] !== bookId) throw new Error('reading catalog identity mismatch');
    if (data['kind'] === 'missing') { if (entries.length === 0) return undefined; throw new Error('reading catalog disappeared'); }
    if (data['kind'] === 'changed') throw new Error('READING_CATALOG_REVISION_CHANGED');
    if (data['kind'] !== 'ready') throw new Error('invalid reading catalog result');
    const nextRevision = string(data, 'revision'), nextCount = integer(data, 'chapterCount');
    if (!nextRevision || (revision !== undefined && nextRevision !== revision) || (count !== undefined && nextCount !== count)) throw new Error('READING_CATALOG_REVISION_CHANGED');
    revision = nextRevision; count = nextCount;
    const rawEntries = data['entries'];
    if (integer(data, 'offset') !== entries.length || !Array.isArray(rawEntries) || rawEntries.length > 256 ||
      entries.length + rawEntries.length > count || (rawEntries.length === 0 && entries.length < count)) throw new Error('invalid reading catalog page');
    for (const raw of rawEntries) {
      const entry = navigationItem(raw);
      if (entry.position !== entries.length || ids.has(entry.index)) throw new Error('invalid reading catalog order');
      ids.add(entry.index); entries.push(entry);
    }
    if (entries.length === count) return { bookId, entries, revision };
    await new Promise<void>((resolve): void => { setTimeout(resolve, 0); });
  }
}

/** Admit only the original complete paragraphs surrounding the requested
 * anchor. No synthetic prefix/indent, relative position or partial image can
 * enter pagination. A context miss uses the same version-bound full read. */
export function qualifyReadingEntryWindow(snapshot: ReadingEntrySnapshot,
  mode: ReadingParagraphBoundaryMode): ReadingEntrySnapshot | undefined {
  const chapter = snapshot.chapter, range = chapter.documentRange;
  if (range === undefined) return snapshot;
  const map = readingChapterLayoutMap(chapter);
  if (map.isComplete()) return { ...snapshot, chapter: { ...chapter, documentRange: undefined } };
  const anchor = snapshot.requestedScalar;
  if (anchor === undefined || !map.containsScalar(anchor)) return undefined;
  const complete = completeReadingParagraphWindow(chapter.content, mode, range.startScalar === 0,
    range.endScalar === range.totalScalars, map.utf16ForScalar(anchor));
  if (complete === undefined) return undefined;
  const startUtf16 = range.startScalar === 0 ? 0 : complete.startUtf16;
  const endUtf16 = range.endScalar === range.totalScalars ? chapter.content.length : complete.endUtf16;
  const startScalar = map.scalarForUtf16(startUtf16), endScalar = map.scalarForUtf16(endUtf16);
  if (startUtf16 === 0 && endUtf16 === chapter.content.length) return snapshot;
  // A later consumer can only claim the admitted paragraphs, not discarded
  // edge text. Full chapter length remains the Core-owned position denominator.
  const text = sliceReadingChapterText(chapter, startScalar, endScalar);
  return { ...snapshot, chapter: { ...chapter, content: text.content,
    textLayoutIdentity: text.textLayoutIdentity ?? text, documentRange: text.documentRange,
    images: chapter.images.filter((image): boolean => image.startScalar >= startScalar && image.endScalar <= endScalar) } };
}
