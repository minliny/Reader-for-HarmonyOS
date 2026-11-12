import type { MangaDownloadAction, MangaDownloadActionId } from '../../manga/application/MangaDownloadActionsGateway';
import type { ReaderDirectoryChapterStartBookmarkRequest } from './ReaderDirectoryMarkerState';
import type { ReaderDirectoryTargetProof } from '../application/ReaderDirectoryTargetProof';
import type { RemoteReadingPositionScope } from '../application/RemoteReadingPositionMigration';
import type { ReaderDirectoryOperations } from './ReaderDirectoryOperations';
import type { ReadingDirectoryNavigationPorts, ReadingEntryPresentation } from './ReadingEntryPresentation';

export interface ReaderDirectoryActions {
  selectChapter: (chapter: number) => void;
  selectTarget: (chapter: number, offset: number, scope?: RemoteReadingPositionScope, proof?: ReaderDirectoryTargetProof) => void;
  selectBookmark: (bookmarkId: string, chapter: number, offset: number, scope?: RemoteReadingPositionScope) => void;
  createChapterStart: (request: ReaderDirectoryChapterStartBookmarkRequest) => void;
  deleteBookmarks: (times: number[]) => void;
  reconcileBookmarks: (generation: number, identity: string) => void;
  continueBookmarks: (generation: number, identity: string) => void;
  reconcileOffline: (generation: number, identity: string) => void;
  continueOffline: (generation: number, identity: string) => void;
  downloadChapter: (chapter: number) => void;
  downloadBook: () => void;
  clearBookOffline: () => void;
  loadMangaActions: (chapter?: number) => Promise<MangaDownloadAction[]>;
  performMangaAction: (action: MangaDownloadActionId, chapter?: number) => Promise<void>;
}

/** Both directory entries send the same intents to the current feature owners. */
export function readerDirectoryActions(reading: () => ReadingEntryPresentation,
  navigation: () => ReadingDirectoryNavigationPorts | undefined,
  operations: () => ReaderDirectoryOperations | undefined): ReaderDirectoryActions {
  return {
    selectChapter: (chapter: number): void => {
      const ports = navigation();
      if (ports !== undefined) reading().selectDirectoryChapter(chapter, undefined, ports);
    },
    selectTarget: (chapter: number, offset: number, scope?: RemoteReadingPositionScope,
      proof?: ReaderDirectoryTargetProof): void => {
      const ports = navigation();
      if (ports !== undefined) reading().selectDirectoryTarget(chapter, offset, scope, proof, ports);
    },
    selectBookmark: (_bookmarkId: string, chapter: number, offset: number, scope?: RemoteReadingPositionScope): void => {
      const ports = navigation();
      if (ports !== undefined) reading().selectDirectoryBookmark(chapter, offset, scope, undefined, ports);
    },
    createChapterStart: (request: ReaderDirectoryChapterStartBookmarkRequest): void => operations()?.createChapterStart(request),
    deleteBookmarks: (times: number[]): void => operations()?.deleteBookmarks(times),
    reconcileBookmarks: (generation: number, identity: string): void => operations()?.reconcileBookmarks(generation, identity, false),
    continueBookmarks: (generation: number, identity: string): void => operations()?.reconcileBookmarks(generation, identity, true),
    reconcileOffline: (generation: number, identity: string): void => operations()?.reconcileOffline(generation, identity, false),
    continueOffline: (generation: number, identity: string): void => operations()?.reconcileOffline(generation, identity, true),
    downloadChapter: (chapter: number): void => operations()?.downloadChapter(chapter),
    downloadBook: (): void => operations()?.downloadBook(),
    clearBookOffline: (): void => operations()?.requestClearOffline(),
    loadMangaActions: (chapter?: number): Promise<MangaDownloadAction[]> => operations()?.loadMangaActions(chapter) ?? Promise.resolve([]),
    performMangaAction: (action: MangaDownloadActionId, chapter?: number): Promise<void> =>
      operations()?.performMangaAction(action, chapter) ?? Promise.resolve(),
  };
}
