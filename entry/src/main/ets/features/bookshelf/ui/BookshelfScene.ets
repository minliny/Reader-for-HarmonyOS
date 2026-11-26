import type { ShelfBook } from '../../../app/ReaderCoreGateway';
import type { ReaderSurfaceRect } from '../../../ui/layout/ReaderSurfaceRect';
import { BookshelfCatalogPresentation } from '../presentation/BookshelfCatalogPresentation';
import { BookshelfEmptyPage } from './BookshelfEmptyPage';
import { BookshelfMutationPresentation } from '../presentation/BookshelfMutationPresentation';
import { BookshelfPage } from './BookshelfPage';
import type { BookshelfFileDrop } from '../application/BookshelfFileDrop';
import { BookshelfReadPresentation } from '../presentation/BookshelfReadPresentation';
import { BookshelfShell } from './BookshelfShell';
import { BookshelfStatusContent } from './BookshelfStatusContent';
import type { BookshelfDetailReturnFocus } from '../presentation/BookshelfViewState';

export type BookshelfSceneDestination =
  'search' | 'discover' | 'rss' | 'settings' | 'bookshelfSettings' | 'bookshelfManagement' | 'downloads';

export interface BookshelfScenePorts {
  isCurrent: (navigation: number) => boolean;
  isInteractive: (navigation: number) => boolean;
  registerMore: (handler: (() => void) | undefined, identity: string, navigation: number) => void;
  registerBack: (handler: (() => boolean) | undefined, identity: string, navigation: number) => void;
  measureContinueCard: (rect: ReaderSurfaceRect | undefined, navigation: number, bookKey: string) => void;
  prepareVisibleBooks: (books: ShelfBook[]) => void;
  openDestination: (destination: BookshelfSceneDestination) => void;
  openBook: (book: ShelfBook) => void;
  openSelection: (book?: ShelfBook) => void;
  openBookInfo: (book: ShelfBook, focus?: BookshelfDetailReturnFocus) => void;
  takeDetailReturnFocus: (navigation: number) => BookshelfDetailReturnFocus | undefined;
  openGroup: (book: ShelfBook, focusTarget?: string) => void;
}

@Component
export struct BookshelfScene {
  @ObjectLink read: BookshelfReadPresentation;
  @ObjectLink mutations: BookshelfMutationPresentation;
  @ObjectLink catalog: BookshelfCatalogPresentation;
  @Prop navigation: number = 0;
  @Prop feedbackEnabled: boolean = true;
  @Prop continueCardSuppressed: boolean = false;
  @Prop reduceMotion: boolean = false;
  @Prop tapBottomScrollTop: boolean = false;
  @Prop sharedBottomNavigationHeight: number = -1;
  ports: BookshelfScenePorts | undefined;

  private isCurrent(navigation?: number): boolean {
    return navigation !== undefined && this.ports?.isCurrent(navigation) === true;
  }

  private isInteractive(navigation?: number): boolean {
    return navigation !== undefined && this.ports?.isInteractive(navigation) === true;
  }

  private open(destination: BookshelfSceneDestination, navigation?: number): void {
    if (this.isInteractive(navigation)) this.ports?.openDestination(destination);
  }

  @Builder
  private shelfContent(measuredFooterHeight: () => number, navigation: number = this.navigation) {
    if (this.read.snapshot.visualAdmitted) {
      BookshelfPage({
        feedbackEnabled: this.feedbackEnabled,
        noticeTopInset: this.read.noticeTopInset(),
        headerBottom: this.read.headerBottom,
        measuredFooterHeight: measuredFooterHeight(),
        onHeaderScrolledChanged: (scrolled: boolean, presentedNavigation: number): void => {
          if (this.isCurrent(presentedNavigation)) this.read.headerScrolled = scrolled;
        },
        scrollToTopToken: this.read.scrollTopToken,
        navigationGeneration: this.navigation,
        viewState: this.read.viewState,
        books: this.read.snapshot.books,
        serverFiltered: this.read.snapshot.revision.length > 0,
        projectedSourceFilter: this.read.snapshot.filter.sourceKind,
        projectedContentFilter: this.read.snapshot.filter.contentKind ?? 'all',
        projectedBookCount: this.read.snapshot.facts?.fact === 'refreshing' ||
          this.read.snapshot.facts?.fact === 'refreshFailed' || this.read.snapshot.facts?.fact === 'partial' ?
          -1 : this.read.snapshot.matchedTotal,
        onNextPageRequested: (presentedNavigation?: number): void => {
          if (this.isCurrent(presentedNavigation ?? navigation)) this.read.page(false);
        },
        onPreviousPageRequested: (presentedNavigation?: number): void => {
          if (this.isCurrent(presentedNavigation ?? navigation)) this.read.page(true);
        },
        onFilterRequested: (_readingState: string, _sourceKind: string, _contentKind?: string, presentedNavigation?: number): void => {
          if (this.isCurrent(presentedNavigation ?? navigation)) this.read.refreshForFilter();
        },
        onEmptySearch: (presentedNavigation: number): void => this.open('search', presentedNavigation),
        onEmptyImport: (presentedNavigation: number, focusTarget: string): void => {
          if (this.isInteractive(presentedNavigation)) this.mutations.openImport(focusTarget);
        },
        fileDropEnabled: this.feedbackEnabled,
        onFilesDropped: (drop: BookshelfFileDrop, presentedNavigation: number): boolean =>
          this.isInteractive(presentedNavigation) && this.mutations.importDroppedFiles(drop, presentedNavigation),
        continueReading: this.read.snapshot.continueReading,
        continueCardSuppressed: this.continueCardSuppressed,
        onContinueCardRect: (rect: ReaderSurfaceRect | undefined, presentedNavigation: number, bookKey: string): void => {
          this.ports?.measureContinueCard(rect, presentedNavigation, bookKey);
        },
        reduceMotion: this.reduceMotion,
        onRssRequested: (presentedNavigation?: number): void => this.open('rss', presentedNavigation ?? navigation),
        onSettingsRequested: (presentedNavigation?: number): void => this.open('settings', presentedNavigation ?? navigation),
        onDiscoverRequested: (presentedNavigation?: number): void => this.open('discover', presentedNavigation ?? navigation),
        onBookSelected: (book: ShelfBook, presentedNavigation?: number): void => {
          if (this.isInteractive(presentedNavigation ?? navigation)) this.ports?.openBook(book);
        },
        onVisibleBooksChanged: (books: ShelfBook[], presentedNavigation?: number): void => {
          if (this.isCurrent(presentedNavigation ?? navigation)) this.ports?.prepareVisibleBooks(books);
        },
        isCurrentChromeHost: (presentedNavigation?: number): boolean => this.isCurrent(presentedNavigation ?? navigation),
        isCurrentShelfInput: (presentedNavigation: number): boolean => this.isInteractive(presentedNavigation),
        onBookMultiSelectRequested: (book: ShelfBook, presentedNavigation?: number): void => {
          if (this.isInteractive(presentedNavigation ?? navigation)) this.ports?.openSelection(book);
        },
        onBookInfoRequested: (book: ShelfBook, presentedNavigation?: number, focus?: BookshelfDetailReturnFocus): void => {
          if (this.isInteractive(presentedNavigation ?? navigation)) this.ports?.openBookInfo(book, focus);
        },
        takeDetailReturnFocus: (presentedNavigation: number): BookshelfDetailReturnFocus | undefined => {
          return this.isInteractive(presentedNavigation) ? this.ports?.takeDetailReturnFocus(presentedNavigation) : undefined;
        },
        onBookGroupRequested: (book: ShelfBook, presentedNavigation?: number, focusTarget?: string): void => {
          if (this.isInteractive(presentedNavigation ?? navigation)) this.ports?.openGroup(book, focusTarget);
        },
        onBookRemoveRequested: (book: ShelfBook, presentedNavigation?: number): void => {
          if (this.isInteractive(presentedNavigation ?? navigation)) this.mutations.requestSingleRemoval(book);
        },
      }).enabled(this.feedbackEnabled);
    } else if (this.read.snapshot.coreEmpty) {
      BookshelfEmptyPage({
        headerBottom: this.read.headerBottom,
        measuredFooterHeight: measuredFooterHeight(),
        fileDropEnabled: this.feedbackEnabled,
        navigationGeneration: this.navigation,
        reduceMotion: this.reduceMotion,
        isCurrentShelfInput: (presentedNavigation: number): boolean => this.isInteractive(presentedNavigation),
        onFilesDropped: (drop: BookshelfFileDrop, presentedNavigation: number): boolean =>
          this.isInteractive(presentedNavigation) && this.mutations.importDroppedFiles(drop, presentedNavigation),
        onImportRequested: (focusTarget: string): void => {
          if (this.isInteractive(navigation)) this.mutations.openImport(focusTarget);
        },
        onSearchRequested: (): void => this.open('search', navigation),
      });
    } else {
      BookshelfStatusContent({
        headerBottom: this.read.headerBottom,
        measuredFooterHeight: measuredFooterHeight(),
        failed: this.read.failed,
        onRetry: (): void => { if (this.isInteractive(navigation)) this.read.refresh(); },
      });
    }
  }

  build() {
    BookshelfShell({
      isCurrentShelfInput: (navigation: number): boolean => this.isInteractive(navigation),
      onMoreBridge: (handler: (() => void) | undefined, identity: string, navigation?: number): void => {
        if (navigation !== undefined) this.ports?.registerMore(handler, identity, navigation);
      },
      onTemporaryBackBridge: (handler: (() => boolean) | undefined, identity: string, navigation?: number): void => {
        if (navigation !== undefined) this.ports?.registerBack(handler, identity, navigation);
      },
      feedbackEnabled: this.feedbackEnabled,
      headerBottom: this.read.headerBottom,
      navigationGeneration: this.navigation,
      sharedBottomNavigationHeight: this.sharedBottomNavigationHeight,
      onNoticeHeightChange: (height: number, navigation?: number): void => {
        if (this.isCurrent(navigation)) this.read.noticeHeight = height;
      },
      populated: this.read.snapshot.visualAdmitted,
      recovery: this.mutations.recovery(),
      recoveryBusy: this.mutations.snapshot.reconcileBusy,
      canContinueRemoval: this.mutations.canContinueRemoval(),
      removalActionLabel: this.mutations.snapshot.removalMutation?.confirmation === 'confirmed' ? '完成原删除清理' : '继续原删除操作',
      onContinueRemoval: (generation: number, navigation: number): void => {
        if (this.isInteractive(navigation)) void this.mutations.continueRemoval(generation);
      },
      readRecovery: this.read.recovery(),
      onRetryRead: (generation: number, navigation?: number): void => {
        if (this.isInteractive(navigation)) this.read.retry(generation);
      },
      onReconcile: (generation: number, navigation?: number): void => {
        if (!this.isInteractive(navigation)) return;
        if (generation < 0) void this.catalog.reconcile(generation);
        else void this.mutations.reconcile(generation);
      },
      reduceMotion: this.reduceMotion,
      canBatchManage: this.read.snapshot.visualAdmitted && this.read.snapshot.books.length > 0,
      canCheckUpdates: this.read.canCheckUpdates(),
      updateRunning: this.catalog.snapshot.manualRunning,
      backgroundUpdateRunning: this.catalog.snapshot.automaticRunning,
      updateProgressDone: this.catalog.snapshot.done,
      updateProgressTotal: this.catalog.snapshot.total,
      onImportRequested: (navigation?: number, focusTarget?: string): void => {
        if (this.isInteractive(navigation)) this.mutations.openImport(focusTarget);
      },
      onBookshelfSettingsRequested: (navigation?: number): void => this.open('bookshelfSettings', navigation),
      onBookshelfManagementRequested: (navigation?: number): void => this.open('bookshelfManagement', navigation),
      onDownloadsRequested: (navigation?: number): void => this.open('downloads', navigation),
      onBatchManageRequested: (navigation?: number): void => {
        if (this.isInteractive(navigation) && this.read.snapshot.books.length > 0) this.ports?.openSelection();
      },
      onCheckUpdatesRequested: (navigation?: number): void => {
        if (this.isInteractive(navigation)) this.catalog.manual(this.read.snapshot.books);
      },
      onMainTab: (key: string, navigation?: number): void => {
        if (key === 'discover' || key === 'rss' || key === 'settings') this.open(key, navigation);
      },
      onCurrentTabTap: (navigation?: number): void => {
        if (this.isInteractive(navigation) && this.tapBottomScrollTop) this.read.scrollTopToken += 1;
      },
      content: (measuredFooterHeight: () => number): void => { this.shelfContent(measuredFooterHeight); },
    });
  }
}
