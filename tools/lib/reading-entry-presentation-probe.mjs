import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { errorMessageOf } from '../../entry/src/main/ets/app/ErrorMessage.ts';
import { diagnosticCodeOf } from '../../entry/src/main/ets/app/LogPrivacy.ts';
import { readingFailureHint } from '../../entry/src/main/ets/features/reading/presentation/ReadingFailurePresentation.ts';
import { ReaderBookmarkAnchorRequest } from '../../entry/src/main/ets/features/reading/presentation/ReaderBookmarkAnchorRequest.ts';
import { ReaderDirectoryBackfill } from '../../entry/src/main/ets/features/reading/application/ReaderDirectoryBackfill.ts';
import { MangaBookPresentation } from '../../entry/src/main/ets/features/manga/presentation/MangaBookPresentation.ts';
import { readingSessionForCommittedSource } from '../../entry/src/main/ets/features/reading/presentation/ReadingEntryDto.ts';
import { remoteReadingEntryKind, remoteShelfDetailInput } from '../../entry/src/main/ets/features/reading/presentation/ReadingBookDetail.ts';

const source = readFileSync(new URL('../../entry/src/main/ets/features/reading/presentation/ReadingEntryPresentation.ets', import.meta.url), 'utf8');
const build = new Function('hilog', 'LOCAL_SOURCE_ID', 'ReadingEntryHost', 'errorMessageOf', 'diagnosticCodeOf', 'readingFailureHint', 'MangaBookPresentation', 'ReaderBookmarkAnchorRequest', 'ReaderDirectoryBackfill', 'remoteReadingEntryKind', 'remoteShelfDetailInput', 'readingSessionForCommittedSource',
  `${stripTypeScriptTypes(source.replace(/^import[^;]+;\s*/gm, '').replace(/^@Observed\n/gm, '').replace(/^export /gm, ''))}; return ReadingEntryPresentation;`);

export function actualReadingEntryPresentation(dependencies = {}) {
  return build(dependencies.hilog ?? { warn() {} }, dependencies.LOCAL_SOURCE_ID ?? 'local', dependencies.ReadingEntryHost,
    errorMessageOf, diagnosticCodeOf, readingFailureHint, dependencies.MangaBookPresentation ?? MangaBookPresentation,
    ReaderBookmarkAnchorRequest, ReaderDirectoryBackfill, remoteReadingEntryKind, remoteShelfDetailInput, readingSessionForCommittedSource);
}

const legacy = {
  detailBook: 'book', detailToc: 'toc', detailInBookshelf: 'inBookshelf', detailLoadingMessage: 'loadingMessage',
  detailCatalogBusy: 'catalogBusy', readingContentKind: 'contentKind', remoteReadingSession: 'session', remoteReadingSeed: 'seed',
  remoteContentVerdict: 'verdict', remoteSessionGeneration: 'sessionGeneration', readingEntryScopeId: 'scopeId',
  readingPresentedScopeId: 'presentedScopeId', readingEntryHost: 'host', pendingRemoteDirectoryProjection: 'pendingRemoteDirectory',
  pendingLocalDirectoryProjection: 'pendingLocalDirectory',
  directoryOperation: 'directoryOperation', offlineOperation: 'offlineOperation', offlineOperationActive: 'offlineOperationActive',
  directoryPresentationGeneration: 'directoryPresentationGeneration', directoryCurrentChapterIndex: 'directoryCurrentChapterIndex',
  directoryChapterTitle: 'directoryChapterTitle',
  indexRecoveryNotice: 'recoveryNotice', indexRecoveryActionLabel: 'recoveryActionLabel',
  indexRecoveryAction: 'recoveryAction', indexRecoveryCurrent: 'recoveryCurrent',
  indexRecoveryRevision: 'recoveryRevision', remoteCacheRefreshConsent: 'cacheRefreshConsent',
  readingExitRequest: 'exitRequest', readingSessionActive: 'sessionActive', readingReadyGeneration: 'readyGeneration',
  requestedChapterIndex: 'requestedChapterIndex', mangaChapterRequestGeneration: 'mangaChapterRequestGeneration',
  mangaChapterStartRequestGeneration: 'mangaChapterStartRequestGeneration',
  mangaCommittedRequestGeneration: 'mangaCommittedRequestGeneration',
  requestedMangaDirectoryTargetProof: 'requestedMangaDirectoryTargetProof',
  requestedBookmarkAnchor: 'requestedBookmarkAnchor', bookmarkAnchorRequestId: 'bookmarkAnchorRequestId',
};
export const legacyReadingEntryIndexFields = Object.keys(legacy);
export function bindReadingEntryFixtureFields(prototype) {
  for (const [name, field] of Object.entries(legacy)) Object.defineProperty(prototype, name, {
    get() { return this.readingEntry[field]; },
    set(value) { this.readingEntry[field] = value; },
    configurable: true,
  });
}
