import type { JsonObject } from '@reader/core-harmony';

export interface RemoteReadingPositionAnchor { id: string; offset: number; }
export interface RemoteReadingPositionContext {
  bodyVersion: string;
  processingVersion: string;
  anchors: RemoteReadingPositionAnchor[];
}
export interface RemoteReadingPositionScope {
  sourceId: string;
  bookId: string;
  chapterIndex: number;
  bodyVersion: string;
  processingVersion: string;
}
export interface RemoteReadingMappedAnchor { id: string; previousOffset: number; offset: number; }
export interface RemoteReadingMigratedProgress {
  sourceId: string;
  bookId: string;
  chapterIndex: number;
  chapterOffset: number;
  chapterProgress: number;
  updatedAt: number;
  locationRevision?: string;
  bodyVersion?: string;
  processingVersion?: string;
}
export interface RemoteReadingPositionMigration {
  status: 'committed' | 'preserved' | 'unchanged';
  reason?: string;
  previousBodyVersion: string;
  bodyVersion: string;
  previousProcessingVersion: string;
  processingVersion: string;
  anchors: RemoteReadingMappedAnchor[];
  progress?: RemoteReadingMigratedProgress;
}
function object(value: unknown): JsonObject {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid position migration object');
  return value as JsonObject;
}
function nonBlank(value: unknown, name: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`invalid position ${name}`);
  return value;
}
function integer(value: unknown, name: string, minimum: number = 0): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum) throw new Error(`invalid position ${name}`);
  return value;
}
function optionalText(value: unknown, name: string): string | undefined {
  return value === undefined ? undefined : nonBlank(value, name);
}
export function encodeRemotePositionContext(context: RemoteReadingPositionContext): JsonObject {
  const ids = new Set<string>();
  const anchors: JsonObject[] = context.anchors.map((anchor: RemoteReadingPositionAnchor): JsonObject => {
    const id = nonBlank(anchor.id, 'anchor id');
    if (ids.has(id)) throw new Error('duplicate position anchor id'); ids.add(id);
    return { id, offset: integer(anchor.offset, 'anchor offset') };
  });
  return { bodyVersion: nonBlank(context.bodyVersion, 'bodyVersion'),
    processingVersion: nonBlank(context.processingVersion, 'processingVersion'), anchors };
}
export function captureRemotePositionContext(context: RemoteReadingPositionContext | undefined): RemoteReadingPositionContext | undefined {
  if (context === undefined) return undefined;
  encodeRemotePositionContext(context);
  return { bodyVersion: context.bodyVersion, processingVersion: context.processingVersion,
    anchors: context.anchors.map((anchor: RemoteReadingPositionAnchor): RemoteReadingPositionAnchor => ({ id: anchor.id, offset: anchor.offset })) };
}
export function decodeRemotePositionScope(value: unknown): RemoteReadingPositionScope | undefined {
  if (value === undefined) return undefined;
  const scope = object(value);
  return { sourceId: nonBlank(scope['sourceId'], 'sourceId'), bookId: nonBlank(scope['bookId'], 'bookId'),
    chapterIndex: integer(scope['chapterIndex'], 'chapterIndex'), bodyVersion: nonBlank(scope['bodyVersion'], 'bodyVersion'),
    processingVersion: nonBlank(scope['processingVersion'], 'processingVersion') };
}
export function encodeRemotePositionScope(scope: RemoteReadingPositionScope): JsonObject {
  return { sourceId: nonBlank(scope.sourceId, 'sourceId'), bookId: nonBlank(scope.bookId, 'bookId'),
    chapterIndex: integer(scope.chapterIndex, 'chapterIndex'), bodyVersion: nonBlank(scope.bodyVersion, 'bodyVersion'),
    processingVersion: nonBlank(scope.processingVersion, 'processingVersion') };
}
export function appendExpectedPositionVersions(params: JsonObject, bodyVersion?: string, processingVersion?: string): void {
  if ((bodyVersion === undefined) !== (processingVersion === undefined)) throw new Error('position versions must be supplied together');
  if (bodyVersion !== undefined) {
    params['expectedBodyVersion'] = nonBlank(bodyVersion, 'expectedBodyVersion');
    params['expectedProcessingVersion'] = nonBlank(processingVersion, 'expectedProcessingVersion');
  }
}

/** Validate the Core transaction receipt before a Host anchor can use the new body. */
export function decodeRemotePositionMigration(value: unknown, sourceId: string, bookId: string,
  bodyVersion: string | undefined, processingVersion: string | undefined,
  context?: RemoteReadingPositionContext): RemoteReadingPositionMigration | undefined {
  if (value === undefined) {
    if (context !== undefined && (context.bodyVersion !== bodyVersion || context.processingVersion !== processingVersion)) {
      throw new Error('chapter response changed position versions without a migration receipt');
    }
    return undefined;
  }
  const raw = object(value); const status = raw['status'];
  if (status !== 'committed' && status !== 'preserved' && status !== 'unchanged') throw new Error('invalid position migration status');
  const previousBodyVersion = nonBlank(raw['previousBodyVersion'], 'previousBodyVersion');
  const previousProcessingVersion = nonBlank(raw['previousProcessingVersion'], 'previousProcessingVersion');
  const nextBodyVersion = nonBlank(raw['bodyVersion'], 'bodyVersion');
  const nextProcessingVersion = nonBlank(raw['processingVersion'], 'processingVersion');
  if (nextBodyVersion !== bodyVersion || nextProcessingVersion !== processingVersion) throw new Error('position receipt does not match returned body');
  if (context !== undefined && (context.bodyVersion !== previousBodyVersion || context.processingVersion !== previousProcessingVersion)) {
    throw new Error('position receipt does not match captured body');
  }
  if (status !== 'committed' && (previousBodyVersion !== nextBodyVersion || previousProcessingVersion !== nextProcessingVersion)) {
    throw new Error('uncommitted position receipt changed body versions');
  }
  if (!Array.isArray(raw['anchors'])) throw new Error('invalid position mapped anchors');
  const expected = new Map<string, number>();
  if (context !== undefined) for (const anchor of context.anchors) expected.set(anchor.id, anchor.offset);
  const ids = new Set<string>();
  const anchors: RemoteReadingMappedAnchor[] = [];
  for (const value of raw['anchors']) {
    const anchor = object(value); const id = nonBlank(anchor['id'], 'anchor id');
    const previousOffset = integer(anchor['previousOffset'], 'previousOffset'); const offset = integer(anchor['offset'], 'offset');
    if (ids.has(id) || (context !== undefined && expected.get(id) !== previousOffset)) throw new Error('position receipt anchor mismatch');
    if (status !== 'committed' && offset !== previousOffset) throw new Error('uncommitted position receipt moved anchor');
    ids.add(id); anchors.push({ id, previousOffset, offset });
  }
  if (context !== undefined && ids.size !== expected.size) throw new Error('position receipt omitted captured anchor');
  let progress: RemoteReadingMigratedProgress | undefined = undefined;
  if (raw['progress'] !== undefined) {
    const row = object(raw['progress']);
    if (row['sourceId'] !== sourceId || row['bookId'] !== bookId) throw new Error('position receipt progress identity mismatch');
    const chapterProgress = row['chapterProgress'];
    if (typeof chapterProgress !== 'number' || !Number.isFinite(chapterProgress) || chapterProgress < 0 || chapterProgress > 1) throw new Error('invalid migrated chapterProgress');
    progress = { sourceId, bookId, chapterIndex: integer(row['chapterIndex'], 'chapterIndex', -1),
      chapterOffset: integer(row['chapterOffset'], 'chapterOffset'), chapterProgress, updatedAt: integer(row['updatedAt'], 'updatedAt'),
      locationRevision: optionalText(row['locationRevision'], 'locationRevision'),
      bodyVersion: optionalText(row['bodyVersion'], 'bodyVersion'), processingVersion: optionalText(row['processingVersion'], 'processingVersion') };
  }
  return { status, reason: optionalText(raw['reason'], 'reason'), previousBodyVersion, bodyVersion: nextBodyVersion,
    previousProcessingVersion, processingVersion: nextProcessingVersion, anchors, progress };
}
