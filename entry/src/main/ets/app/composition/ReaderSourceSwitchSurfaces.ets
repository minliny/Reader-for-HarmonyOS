import { BookDirectoryPage } from '../../features/reading/ui/BookDirectoryPage';
import { MangaSourceSwitchPresentation } from '../../features/manga/presentation/MangaSourceSwitchPresentation';
import { ReadingEntryPresentation } from '../../features/reading/presentation/ReadingEntryPresentation';
import { SourceSwitchPanel } from '../../features/source/ui/SourceSwitchPanel';
import { SourceSwitchPresentation } from '../../features/source/presentation/SourceSwitchPresentation';
import type { ReaderSourceSwitchActions } from './ReaderSourceSwitchActions';

/** Root siblings for the entry picker and the manga target catalog. */
@Component
export struct ReaderSourceSwitchSurfaces {
  @ObjectLink reading: ReadingEntryPresentation;
  @ObjectLink source: SourceSwitchPresentation;
  @ObjectLink manga: MangaSourceSwitchPresentation;
  @Prop entryPickerAllowed: boolean = false;
  @Prop interactive: boolean = true;
  @Prop reduceMotion: boolean = false;
  @Prop consumeTopInset: boolean = true;
  actions: ReaderSourceSwitchActions | undefined = undefined;

  build() {
    if (this.manga.selectionVisible && this.manga.selection !== undefined) {
      // Keep the original entry and its reading session until the exact
      // candidate chapter has been admitted by MangaSourceSwitchPresentation.
      BookDirectoryPage({
        sourceId: this.manga.selection.target.identity.sourceId,
        bookId: this.manga.selection.target.identity.bookId,
        interactive: this.interactive,
        isOpeningCurrent: this.manga.directoryOpening(this.manga.selection),
        bookTitle: this.manga.selection.target.book.title,
        currentChapterIndex: -1,
        currentPageOrdinal: -1,
        currentPageTotal: -1,
        entries: this.manga.selection.entries,
        catalogMessage: '请选择目标章节继续换源',
        onSelectChapter: this.manga.directorySelection(this.manga.selection),
        onSelectNavigationTarget: this.manga.directorySelection(this.manga.selection),
        onTemporaryBackBridge: this.manga.directoryTemporaryBack(this.manga.selection),
        onBack: this.manga.directoryBack(this.manga.selection),
      }).width('100%').height('100%');
    } else if (this.entryPickerAllowed && !this.reading.sessionActive && this.source.isSurfacePresented() &&
      !this.manga.selectionVisible && this.reading.book !== undefined && this.actions !== undefined) {
      SourceSwitchPanel({
        showing: this.source.visible, surface: this.source,
        scopeId: this.source.scopeId, state: this.source.state,
        currentSourceId: this.reading.book.sourceId, bookTitle: this.reading.book.title,
        author: this.reading.book.author, coverUrl: this.reading.book.coverUrl ?? '',
        currentSourceName: this.reading.book.sourceName, latestChapterTitle: this.reading.book.lastChapter ?? '',
        currentChapterTitle: this.reading.directoryChapterTitle || this.reading.book.mangaPosition?.chapterTitle || '',
        contentKind: this.reading.book.contentKind ?? 'text',
        allowCancelWhileSwitching: this.manga.canCancelPreparation() ||
          this.source.host()?.canCancelPreparation(this.source.scopeId) === true,
        reduceMotion: this.reduceMotion, consumeTopInset: this.consumeTopInset,
        interactive: this.interactive,
        onStop: this.actions.stop, onClose: this.actions.close, onRetry: this.actions.retry, onRefresh: this.actions.refresh,
        onSelectCandidate: this.actions.select, onRollback: this.actions.rollback,
      });
    }
  }
}
