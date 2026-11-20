import { ReaderActionAccessibility, readerActionTouchRegion } from '../common/ReaderActionAccessibility';
import { TYPE_READER_DIRECTORY_TITLE } from '../common/ReaderTypography';
import { readerAppColor } from '../common/ReaderThemeRegistry';
import type { LocalReadingTocEntry } from './LocalReadingFlowGateway';
import { readerDirectoryBookmarkMarkerState, type ReaderDirectoryChapterStartBookmarkRequest } from './ReaderDirectoryMarkerState';
import { readerDirectoryAccessibilityText, readerDirectoryIndentVp } from './ReaderDirectoryHierarchy';

/** Shared chapter presentation; all storage operations remain with the owner. */
@Component
export struct ReaderDirectoryChapterRow {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  @Prop entry: LocalReadingTocEntry;
  @Prop rowHeight: number = 44;
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
          Row().width(3).height(Math.max(44, this.rowHeight)).borderRadius(999).backgroundColor(readerAppColor('TOK_ACCENT', this.appThemeScheme));
        }
        Text(this.entry.title.trim().length > 0 && this.entry.title.trim() !== '第话' && this.entry.title.trim() !== '第 话' ?
          this.entry.title : `第${Math.max(1, this.entry.index + 1)}话`).layoutWeight(1)
          .padding({ left: 9 + readerDirectoryIndentVp(this.entry), right: 9 })
          .fontFamily(TYPE_READER_DIRECTORY_TITLE.fontFamily).fontWeight(TYPE_READER_DIRECTORY_TITLE.fontWeight).fontSize(TYPE_READER_DIRECTORY_TITLE.fontSizeFp).fontColor(readerAppColor('TOK_READ_INK', this.appThemeScheme))
          .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis });
      }.layoutWeight(1).height(Math.max(44, this.rowHeight)).accessibilityText(readerDirectoryAccessibilityText(this.entry))
        .enabled(this.entry.navigable !== false)
      .responseRegion( readerActionTouchRegion('100%', Math.max(44, this.rowHeight)))
      .attributeModifier(new ReaderActionAccessibility(readerDirectoryAccessibilityText(this.entry), this.entry.navigable !== false, this.entry.index === this.currentChapterIndex))
        .onClick((): void => { if (this.entry.navigable !== false) this.onSelectChapter(this.entry.index); });
      if (this.entry.navigable !== false && this.chapterDownloadEnabled && this.entry.downloadState !== 'unknown') {
        Stack() {
          Image(this.entry.downloadState === 'completed' ? (this.appThemeScheme === 'night' ? $r('app.media.reader_directory_marker_check_theme_night') : $r('app.media.reader_directory_marker_check')) :
            (this.appThemeScheme === 'night' ? $r('app.media.reader_directory_marker_download_theme_night') : $r('app.media.reader_directory_marker_download'))).width(15).height(15);
        }.width(44).height(Math.max(44, this.rowHeight)).accessibilityText(this.entry.downloadState === 'completed' ? '已下载' : '下载章节')
          .enabled(this.entry.downloadState === 'missing' || this.entry.downloadState === 'cached' ||
            this.entry.downloadState === 'failed' || this.entry.downloadState === 'cancelled')
      .responseRegion( readerActionTouchRegion(44, Math.max(44, this.rowHeight)))
      .attributeModifier(new ReaderActionAccessibility(this.entry.downloadState === 'completed' ? '已下载' : '下载章节', this.entry.downloadState === 'missing' || this.entry.downloadState === 'cached' ||
            this.entry.downloadState === 'failed' || this.entry.downloadState === 'cancelled', this.entry.downloadState === 'completed'))
          .onClick((): void => this.onDownloadChapter(this.entry.index));
      }
      if (this.entry.navigable !== false && this.entry.bookmarks !== undefined) {
        Stack() {
          Image(this.entry.bookmarks.length > 0 ? (this.appThemeScheme === 'night' ? $r('app.media.reader_directory_marker_bookmark_active_theme_night') : $r('app.media.reader_directory_marker_bookmark_active')) :
            (this.appThemeScheme === 'night' ? $r('app.media.reader_directory_marker_bookmark_theme_night') : $r('app.media.reader_directory_marker_bookmark'))).width(15).height(15);
        }.width(44).height(Math.max(44, this.rowHeight)).accessibilityText(this.entry.bookmarks.length > 0 ? '删除本章已有书签' : '添加本章章首书签')
      .responseRegion( readerActionTouchRegion(44, Math.max(44, this.rowHeight)))
      .attributeModifier(new ReaderActionAccessibility(this.entry.bookmarks.length > 0 ? '删除本章已有书签' : '添加本章章首书签', true, this.entry.bookmarks !== undefined && this.entry.bookmarks.length > 0))
          .onClick((): void => this.marker());
      }
    }.width('100%').height(Math.max(44, this.rowHeight)).borderRadius(6)
      .id(`reader-verify-directory-row-${this.entry.index}`)
      .backgroundColor(this.entry.index === this.currentChapterIndex ? readerAppColor('TOK_READ_ACTIVE_SOFT', this.appThemeScheme) : Color.Transparent);
  }
}
