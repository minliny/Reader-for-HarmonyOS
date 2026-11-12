import { BookDirectoryPage } from './BookDirectoryPage';
import type { MangaDownloadAction, MangaDownloadActionId } from '../../manga/application/MangaDownloadActionsGateway';
import type { LocalReadingTocEntry } from '../application/LocalReadingFlowGateway';
import type { ReaderBookIdentity } from '../presentation/ReaderBookmarkProjection';
import type { ReaderDirectoryChapterStartBookmarkRequest } from '../presentation/ReaderDirectoryMarkerState';
import type { ReaderDirectoryTargetProof } from '../application/ReaderDirectoryTargetProof';
import { EMPTY_READING_DIRECTORY_RECOVERY, type ReadingDirectoryRecovery } from '../presentation/ReadingDirectoryRecovery';
import { ReaderFullDirectory } from './ReaderFullDirectory';
import type { RemoteReadingPositionScope } from '../application/RemoteReadingPositionMigration';

/** Directory reached from book detail or an already mounted reader. */
@Component
export struct ReaderDirectoryDestination {
  @Prop opening: number = 0;
  @Prop catalogContext: 'detail' | 'reader' = 'reader';
  @Prop contentKind: 'text' | 'manga' = 'text';
  @Prop sourceId: string = '';
  @Prop bookId: string = '';
  @Prop bookTitle: string = '';
  @Prop bookKind: string = '';
  @Prop chapterTitle: string = '';
  @Prop currentChapterIndex: number = -1;
  @Prop currentPageOrdinal: number = -1;
  @Prop currentPageTotal: number = -1;
  @Prop entries: LocalReadingTocEntry[] = [];
  @Prop catalogMessage: string = '';
  @Prop catalogBusy: boolean = false;
  @Prop directoryRecovery: ReadingDirectoryRecovery = EMPTY_READING_DIRECTORY_RECOVERY;
  @Prop interactive: boolean = true;
  @Prop offlineBookOperationActive: boolean = false;
  @Prop mangaDownloadEnabled: boolean = false;
  @Prop chapterStartBookmarkCreationEnabled: boolean = false;
  bookmarkIdentity: ReaderBookIdentity | undefined = undefined;
  private mounted: boolean = false;
  isOpeningCurrent: (opening: number) => boolean = (_opening: number): boolean => true;

  onReconcileBookmarks: (generation: number, identity: string) => void = (): void => {};
  onContinueBookmarks: (generation: number, identity: string) => void = (): void => {};
  onReconcileOffline: (generation: number, identity: string) => void = (): void => {};
  onContinueOffline: (generation: number, identity: string) => void = (): void => {};
  onLoadDownloadActions: (chapterIndex?: number) => Promise<MangaDownloadAction[]> = async (): Promise<MangaDownloadAction[]> => [];
  onDownloadAction: (action: MangaDownloadActionId, chapterIndex?: number) => Promise<void> = async (): Promise<void> => {};
  onSelectChapter: (chapterIndex: number) => void = (): void => {};
  onSelectNavigationTarget: (chapterIndex: number, chapterOffsetScalar: number,
    positionScope?: RemoteReadingPositionScope, directoryTargetProof?: ReaderDirectoryTargetProof) => void = (): void => {};
  onSelectBookmark: ((bookmarkId: string, chapterIndex: number, chapterOffset: number,
    positionScope?: RemoteReadingPositionScope) => void) | undefined = undefined;
  onDownloadChapter: (chapterIndex: number) => void = (): void => {};
  onDownloadBook: () => void = (): void => {};
  onClearBookOffline: () => void = (): void => {};
  onDeleteBookmarks: (times: number[]) => void = (): void => {};
  onCreateChapterStartBookmark: (request: ReaderDirectoryChapterStartBookmarkRequest) => void = (): void => {};
  onRetryCatalog: () => void = (): void => {};
  onSwitchSource: () => void = (): void => {};
  onBack: () => void = (): void => {};
  onTemporaryBackBridge: (handler: (() => boolean) | undefined, identity: string, opening: number) => void = (): void => {};

  aboutToAppear(): void { this.mounted = true; }
  aboutToDisappear(): void { this.mounted = false; }

  private canHandle(opening: number): boolean {
    return this.mounted && this.interactive && opening === this.opening && this.isOpeningCurrent(opening);
  }

  private forwardTemporaryBack(opening: number, handler: (() => boolean) | undefined, identity: string): void {
    if (handler === undefined) this.onTemporaryBackBridge(undefined, identity, opening);
    else if (opening === this.opening) this.onTemporaryBackBridge(
      (): boolean => this.canHandle(opening) && handler(), identity, opening);
  }

  private bookmarkSelection(opening: number): ((bookmarkId: string, chapterIndex: number, chapterOffset: number,
    positionScope?: RemoteReadingPositionScope) => void) | undefined {
    if (this.onSelectBookmark === undefined) return undefined;
    return (bookmarkId: string, chapterIndex: number, chapterOffset: number, positionScope?: RemoteReadingPositionScope): void => {
      if (this.canHandle(opening)) this.onSelectBookmark?.(bookmarkId, chapterIndex, chapterOffset, positionScope);
    };
  }

  private async loadDownloadActions(opening: number, chapterIndex?: number): Promise<MangaDownloadAction[]> {
    if (!this.canHandle(opening)) return [];
    try {
      const actions = await this.onLoadDownloadActions(chapterIndex);
      return this.canHandle(opening) ? actions : [];
    } catch (error) {
      if (!this.canHandle(opening)) return [];
      throw error as Error;
    }
  }

  build() {
    ForEach([this.opening], (opening: number): void => {
      this.catalog(opening);
    }, (opening: number): string => opening.toString());
  }

  @Builder
  private catalog(opening: number) {
    if (this.contentKind === 'manga') {
      BookDirectoryPage({
        sourceId: this.sourceId, bookId: this.bookId,
        interactive: this.interactive, isOpeningCurrent: (): boolean => this.canHandle(opening),
        bookTitle: this.bookTitle, entries: this.entries, catalogMessage: this.catalogMessage, catalogBusy: this.catalogBusy,
        currentChapterIndex: this.currentChapterIndex, currentPageOrdinal: this.currentPageOrdinal,
        currentPageTotal: this.currentPageTotal, directoryRecovery: this.directoryRecovery,
        onReconcileBookmarks: (generation: number, identity: string): void => {
          if (this.canHandle(opening)) this.onReconcileBookmarks(generation, identity);
        },
        onContinueBookmarks: (generation: number, identity: string): void => {
          if (this.canHandle(opening)) this.onContinueBookmarks(generation, identity);
        },
        onReconcileOffline: (generation: number, identity: string): void => {
          if (this.canHandle(opening)) this.onReconcileOffline(generation, identity);
        },
        onContinueOffline: (generation: number, identity: string): void => {
          if (this.canHandle(opening)) this.onContinueOffline(generation, identity);
        },
        mangaDownloadEnabled: this.mangaDownloadEnabled,
        onLoadDownloadActions: (chapterIndex?: number): Promise<MangaDownloadAction[]> =>
          this.loadDownloadActions(opening, chapterIndex),
        onDownloadAction: (action: MangaDownloadActionId, chapterIndex?: number): Promise<void> =>
          this.canHandle(opening) ? this.onDownloadAction(action, chapterIndex) : Promise.resolve(),
        onSelectChapter: (chapterIndex: number): void => {
          if (this.canHandle(opening)) this.onSelectChapter(chapterIndex);
        },
        onSelectNavigationTarget: (chapterIndex: number, offset: number, scope?: RemoteReadingPositionScope,
          proof?: ReaderDirectoryTargetProof): void => {
          if (this.canHandle(opening)) this.onSelectNavigationTarget(chapterIndex, offset, scope, proof);
        },
        onRetryCatalog: (): void => { if (this.canHandle(opening)) this.onRetryCatalog(); },
        onTemporaryBackBridge: (handler: (() => boolean) | undefined, identity: string): void =>
          this.forwardTemporaryBack(opening, handler, identity),
        onBack: (): void => { if (this.canHandle(opening)) this.onBack(); },
      })
        .width('100%').height('100%')
        .enabled(this.interactive)
        .accessibilityLevel(this.interactive ? 'auto' : 'no-hide-descendants')
        .hitTestBehavior(this.interactive ? HitTestMode.Default : HitTestMode.None);
    } else {
      ReaderFullDirectory({
        sourceId: this.sourceId, bookId: this.bookId, bookTitle: this.bookTitle, bookKind: this.bookKind,
        interactive: this.interactive, isOpeningCurrent: (): boolean => this.canHandle(opening),
        chapterTitle: this.chapterTitle, catalogContext: this.catalogContext,
        entries: this.entries, catalogMessage: this.catalogMessage, catalogBusy: this.catalogBusy,
        directoryRecovery: this.directoryRecovery, currentChapterIndex: this.currentChapterIndex,
        onReconcileBookmarks: (generation: number, identity: string): void => {
          if (this.canHandle(opening)) this.onReconcileBookmarks(generation, identity);
        },
        onContinueBookmarks: (generation: number, identity: string): void => {
          if (this.canHandle(opening)) this.onContinueBookmarks(generation, identity);
        },
        onReconcileOffline: (generation: number, identity: string): void => {
          if (this.canHandle(opening)) this.onReconcileOffline(generation, identity);
        },
        onContinueOffline: (generation: number, identity: string): void => {
          if (this.canHandle(opening)) this.onContinueOffline(generation, identity);
        },
        offlineBookOperationActive: this.offlineBookOperationActive, bookmarkIdentity: this.bookmarkIdentity,
        onSelectChapter: (chapterIndex: number): void => {
          if (this.canHandle(opening)) this.onSelectChapter(chapterIndex);
        },
        onSelectNavigationTarget: (chapterIndex: number, offset: number, scope?: RemoteReadingPositionScope,
          proof?: ReaderDirectoryTargetProof): void => {
          if (this.canHandle(opening)) this.onSelectNavigationTarget(chapterIndex, offset, scope, proof);
        },
        onSelectBookmark: this.bookmarkSelection(opening),
        onDownloadChapter: (chapterIndex: number): void => {
          if (this.canHandle(opening)) this.onDownloadChapter(chapterIndex);
        },
        onDownloadBook: (): void => { if (this.canHandle(opening)) this.onDownloadBook(); },
        onClearBookOffline: (): void => { if (this.canHandle(opening)) this.onClearBookOffline(); },
        onDeleteBookmarks: (times: number[]): void => { if (this.canHandle(opening)) this.onDeleteBookmarks(times); },
        chapterStartBookmarkCreationEnabled: this.chapterStartBookmarkCreationEnabled,
        onCreateChapterStartBookmark: (request: ReaderDirectoryChapterStartBookmarkRequest): void => {
          if (this.canHandle(opening)) this.onCreateChapterStartBookmark(request);
        },
        onRetryCatalog: (): void => { if (this.canHandle(opening)) this.onRetryCatalog(); },
        onSwitchSource: (): void => { if (this.canHandle(opening)) this.onSwitchSource(); },
        onTemporaryBackBridge: (handler: (() => boolean) | undefined, identity: string): void =>
          this.forwardTemporaryBack(opening, handler, identity),
        onExit: (): void => { if (this.canHandle(opening)) this.onBack(); },
      })
        .enabled(this.interactive)
        .accessibilityLevel(this.interactive ? 'auto' : 'no-hide-descendants')
        .hitTestBehavior(this.interactive ? HitTestMode.Default : HitTestMode.None);
    }
  }
}
