import { EMPTY_READING_DIRECTORY_RECOVERY } from '../presentation/ReadingDirectoryRecovery';
import { readerDirectoryActions, type ReaderDirectoryActions } from '../presentation/ReaderDirectoryActions';
import type { ReaderDirectoryOperations } from '../presentation/ReaderDirectoryOperations';
import { ReadingEntryPresentation, type ReadingDirectoryNavigationPorts } from '../presentation/ReadingEntryPresentation';
import { ReaderDirectoryDestination } from './ReaderDirectoryDestination';

@Component
export struct DetailDirectoryScene {
  @ObjectLink reading: ReadingEntryPresentation;
  @Prop interactive: boolean = true;
  @Prop mangaDownloadEnabled: boolean = false;
  operations: ReaderDirectoryOperations | undefined = undefined;
  navigation: ReadingDirectoryNavigationPorts | undefined = undefined;
  isOpeningCurrent: (opening: number) => boolean = (): boolean => false;
  onRetryCatalog: () => void = (): void => {};
  onSwitchSource: () => void = (): void => {};
  onBack: () => void = (): void => {};
  onTemporaryBackBridge: (handler: (() => boolean) | undefined, identity: string, opening: number) => void = (): void => {};
  private readonly directoryActions: ReaderDirectoryActions = readerDirectoryActions(() => this.reading,
    () => this.navigation, () => this.operations);

  build() {
    if (this.reading.book !== undefined) {
      ReaderDirectoryDestination({
        opening: this.reading.directoryPresentationGeneration,
        isOpeningCurrent: (opening: number): boolean => this.isOpeningCurrent(opening),
        catalogContext: 'detail', contentKind: this.reading.book.contentKind === 'manga' ? 'manga' : 'text',
        sourceId: this.reading.book.sourceId, bookId: this.reading.book.bookId,
        bookKind: this.reading.book.kind ?? '', bookTitle: this.reading.book.title,
        chapterTitle: this.reading.directoryChapterTitle,
        currentChapterIndex: this.reading.book.contentKind === 'manga' ?
          this.reading.book.mangaPosition?.chapterIndex ?? this.reading.directoryCurrentChapterIndex :
          this.reading.directoryCurrentChapterIndex,
        currentPageOrdinal: this.reading.book.mangaPosition?.pageOrdinal ?? -1,
        currentPageTotal: this.reading.book.mangaPosition?.totalPages ?? -1,
        entries: this.reading.toc, catalogMessage: this.reading.loadingMessage, catalogBusy: this.reading.catalogBusy,
        directoryRecovery: this.operations?.recovery(this.reading.directoryOperation, this.reading.offlineOperation) ??
          EMPTY_READING_DIRECTORY_RECOVERY,
        interactive: this.interactive,
        offlineBookOperationActive: this.reading.offlineOperationActive,
        onReconcileBookmarks: this.directoryActions.reconcileBookmarks,
        onContinueBookmarks: this.directoryActions.continueBookmarks,
        onReconcileOffline: this.directoryActions.reconcileOffline,
        onContinueOffline: this.directoryActions.continueOffline,
        mangaDownloadEnabled: this.mangaDownloadEnabled,
        onLoadDownloadActions: this.directoryActions.loadMangaActions,
        onDownloadAction: this.directoryActions.performMangaAction,
        onSelectChapter: this.directoryActions.selectChapter,
        onSelectNavigationTarget: this.directoryActions.selectTarget,
        onSelectBookmark: this.directoryActions.selectBookmark,
        bookmarkIdentity: this.reading.bookmarkIdentity(),
        onDownloadChapter: this.directoryActions.downloadChapter,
        onDownloadBook: this.directoryActions.downloadBook,
        onClearBookOffline: this.directoryActions.clearBookOffline,
        onDeleteBookmarks: this.directoryActions.deleteBookmarks,
        chapterStartBookmarkCreationEnabled: true,
        onCreateChapterStartBookmark: this.directoryActions.createChapterStart,
        onRetryCatalog: (): void => this.onRetryCatalog(),
        onSwitchSource: (): void => this.onSwitchSource(),
        onTemporaryBackBridge: (handler: (() => boolean) | undefined, identity: string, opening: number): void =>
          this.onTemporaryBackBridge(handler, identity, opening),
        onBack: (): void => this.onBack(),
      }).width('100%').height('100%');
    }
  }
}
