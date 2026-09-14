import type { RemoteReadingSession } from './RemoteReadingFlowGateway';
import type { ReadingSessionChapter } from './ReadingChapterWindow';

/** One validated current chapter; never a second durable/content cache. */
export type RemoteReadingPreparedChapter = {
  session: RemoteReadingSession;
  chapter: ReadingSessionChapter;
  projectionRevision: number;
};

/** Metadata changes do not alter canonical acquisition identity. Legacy
 * snapshots may only share evidence while their original arrays survive. */
export function sameRemoteSessionEvidence(
  left: RemoteReadingSession | undefined, right: RemoteReadingSession | undefined,
): boolean {
  if (left === undefined || right === undefined) return left === right;
  if (left.identity.sourceId !== right.identity.sourceId || left.identity.bookId !== right.identity.bookId ||
    left.sourceVersion !== right.sourceVersion || left.acquisitionMode !== right.acquisitionMode ||
    left.requiresContextRefresh !== right.requiresContextRefresh) return false;
  if (left.catalogVersion !== undefined && left.contextVersion !== undefined &&
    right.catalogVersion !== undefined && right.contextVersion !== undefined) {
    return left.catalogVersion === right.catalogVersion && left.contextVersion === right.contextVersion;
  }
  return left.entries === right.entries && left.continuationVariables === right.continuationVariables;
}

export function preparedRemoteChapterMatches(prepared: RemoteReadingPreparedChapter | undefined,
  session: RemoteReadingSession, chapterIndex: number | undefined, projectionRevision: number): boolean {
  if (prepared === undefined || prepared.projectionRevision !== projectionRevision ||
    !sameRemoteSessionEvidence(prepared.session, session)) return false;
  const chapter = prepared.chapter;
  if (chapter.sourceId !== session.identity.sourceId || chapter.bookId !== session.identity.bookId ||
    (chapterIndex !== undefined && chapter.chapterIndex !== chapterIndex) || chapter.contentVersion.length === 0) return false;
  const entry = session.entries.find((item): boolean => item.index === chapter.chapterIndex);
  return entry !== undefined && entry.url.length > 0 && entry.url === chapter.chapterUrl;
}

export function withPreparedRemoteChapter(session: RemoteReadingSession, chapter: ReadingSessionChapter,
  projectionRevision: number): RemoteReadingSession {
  // Strip an earlier handoff from the retained snapshot to keep the object
  // graph bounded even after repeated previews and metadata projections.
  const snapshot: RemoteReadingSession = { ...session, preparedChapter: undefined };
  const prepared: RemoteReadingPreparedChapter = { session: snapshot, chapter, projectionRevision };
  if (!preparedRemoteChapterMatches(prepared, snapshot, chapter.chapterIndex, projectionRevision)) {
    throw new Error('validated chapter does not belong to this reading session');
  }
  return { ...snapshot, preparedChapter: prepared };
}
