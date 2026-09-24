import { readerAppColor } from '../common/ReaderThemeRegistry';
import type { LocalReadingTocEntry } from './LocalReadingFlowGateway';
import { readerDirectoryBookmarkMarkerState, type ReaderDirectoryChapterStartBookmarkRequest } from './ReaderDirectoryMarkerState';
import { readerDirectoryAccessibilityText, readerDirectoryIndentVp } from './ReaderDirectoryHierarchy';

/** Shared chapter presentation; all storage operations remain with the owner. */
@Component
export struct ReaderDirectoryChapterRow {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  @Prop entry: LocalReadingTocEntry;
  @Prop rowHeight: number = 40;
  @Prop currentChapterIndex: number = -1;
  @Prop chapterDownloadEnabled: boolean = false;
  @Prop chapterStartBookmarkCreationEnabled: boolean = false;
  onSelectChapter: (index: number) => void = (_index: number): void => {};
  onDownloadChapter: (index: number) => void = (_index: number): void => {};
  onDeleteBookmarks: (times: number[]) => void = (_times: number[]): void => {};
  onCreateChapterStartBookmark: (request: ReaderDirectoryChapterStartBookmarkRequest) => void =
    (_request: ReaderDirectoryChapterStartBookmarkRequest): void => {};

  private marker(): void {
    const state = readerDirectoryBookmarkMarkerState(this.entry);
    if (state.kind === 'bookmarked') this.onDeleteBookmarks(state.bookmarkTimes);
    else if (state.kind === 'empty' && this.chapterStartBookmarkCreationEnabled) {
      this.onCreateChapterStartBookmark(state.createRequest);
    }
  }

  build() {
    Row() {
      Row() {
        if (this.entry.index === this.currentChapterIndex) {
          Row().width(3).height(this.rowHeight).borderRadius(999).backgroundColor(readerAppColor('TOK_ACCENT', this.appThemeScheme));
        }
        Text(this.entry.title).layoutWeight(1).padding({ left: 9 + readerDirectoryIndentVp(this.entry), right: 9 })
          .fontFamily('ReaderNotoSansSC').fontWeight(500).fontSize(11).fontColor(readerAppColor('TOK_READ_INK', this.appThemeScheme))
          .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis });
      }.layoutWeight(1).height(this.rowHeight).accessibilityText(readerDirectoryAccessibilityText(this.entry))
        .enabled(this.entry.navigable !== false)
        .onClick((): void => { if (this.entry.navigable !== false) this.onSelectChapter(this.entry.index); });
      if (this.entry.navigable !== false && this.chapterDownloadEnabled && this.entry.downloadState !== 'unknown') {
        Stack() {
          Image(this.entry.downloadState === 'completed' ? (this.appThemeScheme === 'night' ? $r('app.media.reader_directory_marker_check_theme_night') : $r('app.media.reader_directory_marker_check')) :
            (this.appThemeScheme === 'night' ? $r('app.media.reader_directory_marker_download_theme_night') : $r('app.media.reader_directory_marker_download'))).width(15).height(15);
        }.width(26).height(this.rowHeight).accessibilityText(this.entry.downloadState === 'completed' ? '已下载' : '下载章节')
          .enabled(this.entry.downloadState === 'missing' || this.entry.downloadState === 'cached' ||
            this.entry.downloadState === 'failed' || this.entry.downloadState === 'cancelled')
          .onClick((): void => this.onDownloadChapter(this.entry.index));
      }
      if (this.entry.navigable !== false && this.entry.bookmarks !== undefined) {
        Stack() {
          Image(this.entry.bookmarks.length > 0 ? (this.appThemeScheme === 'night' ? $r('app.media.reader_directory_marker_bookmark_active_theme_night') : $r('app.media.reader_directory_marker_bookmark_active')) :
            (this.appThemeScheme === 'night' ? $r('app.media.reader_directory_marker_bookmark_theme_night') : $r('app.media.reader_directory_marker_bookmark'))).width(15).height(15);
        }.width(26).height(this.rowHeight).accessibilityText(this.entry.bookmarks.length > 0 ? '删除本章已有书签' : '添加本章章首书签')
          .onClick((): void => this.marker());
      }
    }.width('100%').height(this.rowHeight).borderRadius(6)
      .backgroundColor(this.entry.index === this.currentChapterIndex ? readerAppColor('TOK_READ_ACTIVE_SOFT', this.appThemeScheme) : Color.Transparent);
  }
}
