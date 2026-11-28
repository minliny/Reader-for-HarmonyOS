import {
  prepareReadingChapterMeasurement, type ReadingChapterMeasurementProjection,
} from './ReadingChapterMeasurementPreparation.ts';
import type { ReadingChapterWindow, ReadingSessionChapter } from './ReadingChapterWindow';
import type { LocalReadingProgress, LocalReadingProgressState } from './LocalReadingFlowTypes';
import type { ReadingParagraphBoundaryMode } from './ReadingParagraphProjection';
import type { RemoteReadingPositionContext } from './RemoteReadingPositionMigration';
import type { ReadingSurfaceLayoutMap } from './ReadingSurfaceLayoutMap';

export interface ReadingChapterOpeningRequest {
  chapterIndex: number;
  refreshContent: boolean;
  restored: LocalReadingProgress | undefined;
  explicitContext: RemoteReadingPositionContext | undefined;
  prepared: ReadingPreparedChapterBody | undefined;
  layoutReady: Promise<void[]> | undefined;
}

export interface ReadingPreparedChapterBody {
  chapter: ReadingSessionChapter;
  isCurrent: () => boolean;
}

export interface ReadingChapterOpeningLease {
  isCurrent: () => boolean;
  contentCurrent: () => boolean;
  restartPreparedEntry: () => Promise<void>;
}

export type ReadingChapterPositionUpdate =
  | { kind: 'requested'; offset: number }
  | { kind: 'restored'; progress: LocalReadingProgressState };

/** Effects at the original acquisition, position, metrics, and publication stages. */
export interface ReadingChapterOpeningHost {
  loadChapter: (context: RemoteReadingPositionContext | undefined) => Promise<ReadingSessionChapter>;
  chapterReady?: () => void;
  boundaryMode: () => ReadingParagraphBoundaryMode;
  confirmContentMetrics: (chapter: ReadingSessionChapter, map: ReadingSurfaceLayoutMap,
    current: () => boolean) => Promise<boolean>;
  applyPosition: (update: ReadingChapterPositionUpdate) => void;
  admit: (chapter: ReadingSessionChapter, layout: ReadingChapterMeasurementProjection) => void;
  fail: (error: Error) => Promise<void>;
}

/** Shared cache admission for chapter acquisition and the presentation's loading policy. */
export function readingChapterMatchesDirectoryProof(chapter: ReadingSessionChapter,
  context: RemoteReadingPositionContext): boolean {
  const proof = context.directoryTargetProof;
  return proof !== undefined && chapter.catalogRevision !== undefined &&
    chapter.catalogRevision === proof.catalogRevision && chapter.sourceId === proof.sourceId &&
    chapter.bookId === proof.bookId && chapter.chapterIndex === proof.chapterIndex &&
    chapter.documentRange === undefined && chapter.positionMigration === undefined &&
    chapter.sourceCorrectionRequired !== true &&
    (context.bodyVersion === undefined && context.processingVersion === undefined && context.anchors.length === 0 ||
      chapter.bodyVersion === context.bodyVersion && chapter.processingVersion === context.processingVersion &&
        context.bodyVersion !== undefined && context.processingVersion !== undefined);
}

export function findReusableReadingWindowChapter(
  window: ReadingChapterWindow,
  chapterIndex: number,
  forceRefresh: boolean = false,
  context?: RemoteReadingPositionContext,
): ReadingSessionChapter | undefined {
  const cached = window.get(chapterIndex);
  if (cached !== undefined &&
    cached.sourceCorrectionRequired !== true && cached.documentRange === undefined && !forceRefresh &&
    (context === undefined || (context.directoryTargetProof === undefined ?
      cached.bodyVersion === context.bodyVersion && cached.processingVersion === context.processingVersion :
      readingChapterMatchesDirectoryProof(cached, context)))) {
    return cached;
  }
  return undefined;
}

/** Reuse a complete, version-compatible chapter for reading and TTS. The gateway stays lazy on a hit. */
export async function readReadingWindowChapter(
  window: ReadingChapterWindow,
  chapterIndex: number,
  load: () => Promise<ReadingSessionChapter>,
  forceRefresh: boolean = false,
  context?: RemoteReadingPositionContext,
): Promise<ReadingSessionChapter> {
  return findReusableReadingWindowChapter(window, chapterIndex, forceRefresh, context) ?? load();
}

/** Read in parallel with layout admission, retaining both lease checks around measurement. */
export async function prepareReadingChapterOpening(
  request: ReadingChapterOpeningRequest,
  window: ReadingChapterWindow,
  lease: ReadingChapterOpeningLease,
  host: ReadingChapterOpeningHost,
): Promise<void> {
  try {
    const restored = request.restored;
    const context: RemoteReadingPositionContext | undefined = request.explicitContext ??
      (restored?.bodyVersion !== undefined && restored.processingVersion !== undefined ?
        { bodyVersion: restored.bodyVersion, processingVersion: restored.processingVersion,
          anchors: [{ id: 'restored', offset: restored.chapterOffset }] } : undefined);
    const [chapter] = await Promise.all([
      (request.prepared === undefined ? readReadingWindowChapter(window, request.chapterIndex,
        (): Promise<ReadingSessionChapter> => host.loadChapter(context), request.refreshContent, context) :
        Promise.resolve(request.prepared.chapter))
        .then((chapter: ReadingSessionChapter): ReadingSessionChapter => {
          if (host.chapterReady !== undefined && lease.isCurrent()) host.chapterReady();
          return chapter;
        }),
      request.layoutReady,
    ]);
    if (!lease.isCurrent()) return;
    if (!lease.contentCurrent()) throw new Error('READING_CONTENT_EPOCH_CHANGED');
    if (request.prepared !== undefined && !request.prepared.isCurrent()) {
      await lease.restartPreparedEntry();
      return;
    }
    applyChapterPositionMigration(chapter, context, restored, host.applyPosition);
    const projection = await prepareReadingChapterMeasurement(chapter, host.boundaryMode,
      (): boolean => lease.isCurrent() && lease.contentCurrent());
    if (projection.map.scalarCount() === 0) throw new Error('READING_CONTENT_EMPTY');
    if (!await host.confirmContentMetrics(chapter, projection.map, lease.isCurrent)) return;
    if (!lease.isCurrent()) return;
    if (!lease.contentCurrent()) throw new Error('READING_CONTENT_EPOCH_CHANGED');
    if (request.prepared !== undefined && !request.prepared.isCurrent()) {
      await lease.restartPreparedEntry();
      return;
    }
    host.admit(chapter, projection);
  } catch (error) {
    await host.fail(error as Error);
  }
}

function applyChapterPositionMigration(
  chapter: ReadingSessionChapter,
  context: RemoteReadingPositionContext | undefined,
  restored: LocalReadingProgress | undefined,
  apply: (update: ReadingChapterPositionUpdate) => void,
): void {
  const migration = chapter.positionMigration;
  if (migration === undefined && context?.bodyVersion !== undefined &&
    (chapter.bodyVersion !== context.bodyVersion || chapter.processingVersion !== context.processingVersion)) {
    throw new Error('READING_POSITION_CONTEXT_STALE');
  }
  if (migration?.status !== 'committed' || context?.bodyVersion === undefined) return;
  if (migration.previousBodyVersion !== context.bodyVersion || migration.previousProcessingVersion !== context.processingVersion ||
    migration.bodyVersion !== chapter.bodyVersion || migration.processingVersion !== chapter.processingVersion) {
    throw new Error('READING_POSITION_MIGRATION_IDENTITY_MISMATCH');
  }
  for (const anchor of context.anchors) {
    const mapped = migration.anchors.find((item): boolean => item.id === anchor.id && item.previousOffset === anchor.offset);
    if (mapped === undefined) throw new Error('READING_POSITION_MIGRATION_ANCHOR_MISSING');
    if (anchor.id === 'requested') apply({ kind: 'requested', offset: mapped.offset });
    if (anchor.id === 'restored' && restored !== undefined) {
      apply({ kind: 'restored', progress: { kind: 'restored', progress: {
        bookId: restored.bookId, chapterIndex: restored.chapterIndex, chapterOffset: mapped.offset,
        chapterProgress: restored.chapterProgress, updatedAt: restored.updatedAt, locationRevision: restored.locationRevision,
        bodyVersion: chapter.bodyVersion, processingVersion: chapter.processingVersion,
      } } });
    }
  }
}

export interface ReadingChapterOpeningAnchor {
  offset: number;
  progress: number;
}

/** An explicit target outranks a stored location; stale text offsets fall back to relative progress. */
export function resolveReadingChapterOpeningAnchor(
  chapter: ReadingSessionChapter,
  map: ReadingSurfaceLayoutMap,
  progressState: LocalReadingProgressState | undefined,
  requestedOffset?: number,
  requestedProgress?: number,
): ReadingChapterOpeningAnchor {
  const restored = progressState?.kind === 'restored' && progressState.progress.chapterIndex === chapter.chapterIndex ?
    progressState.progress : undefined;
  if (requestedOffset === undefined && requestedProgress === undefined && restored === undefined) {
    return { offset: 0, progress: 0 };
  }
  const scalarCount = map.scalarCount();
  let requested = requestedOffset;
  if (requested === undefined && requestedProgress !== undefined) {
    requested = Math.round(normalizeReadingProgressRatio(requestedProgress) * scalarCount);
  }
  if (requested === undefined && restored !== undefined) {
    requested = restored.chapterOffset <= scalarCount ? restored.chapterOffset :
      Math.round(restored.chapterProgress * scalarCount);
  }
  // A blank tail can outlive the old progress record but is never a visible anchor.
  const offset = Math.max(0, Math.min(lastVisibleReadingScalar(chapter.content, map), requested ?? 0));
  return { offset, progress: scalarCount === 0 ? 0 : offset / scalarCount };
}

export function normalizeReadingProgressRatio(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
}

export function lastVisibleReadingScalar(content: string, map: ReadingSurfaceLayoutMap): number {
  const scalarCount = map.scalarCount();
  if (map.residentEnd() < scalarCount) return scalarCount - 1;
  for (let scalar = map.residentEnd() - 1; scalar >= map.residentStart(); scalar -= 1) {
    const startUtf16 = map.utf16ForScalar(scalar);
    const endUtf16 = map.utf16ForScalar(scalar + 1);
    if (content.substring(startUtf16, endUtf16).trim().length > 0) return scalar;
  }
  return 0;
}
