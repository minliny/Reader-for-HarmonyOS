import { TYPE_READER_DIRECTORY_TITLE, TYPE_READER_DIRECTORY_TITLE_INTER } from '../../../ui/foundation/ReaderTypography';
import { readerAppColor } from '../../../ui/foundation/ReaderThemeRegistry';
import type { LocalReadingTocEntry } from '../application/LocalReadingFlowGateway';
import { readerDirectoryBookmarkMarkerState, type ReaderDirectoryChapterStartBookmarkRequest } from '../presentation/ReaderDirectoryMarkerState';
import { readerDirectoryAccessibilityText, readerDirectoryIndentVp } from './ReaderDirectoryHierarchy';
import { ReaderActionAccessibility } from '../../../ui/controls/ReaderActionAccessibility';

/** Shared chapter presentation; all storage operations remain with the owner. */
@Component
export struct ReaderDirectoryChapterRow {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  @Prop entry: LocalReadingTocEntry;
  @Prop rowHeight: number = 40;
  @Prop currentChapterIndex: number = -1;
  @Prop variant: 'control' | 'standalone' | 'detail-preview' = 'control';
  @Prop previewNested: boolean = false;
  @Prop previewGroupCollapsed: boolean = false;
  @Prop previewEnabled: boolean = true;
  @Prop chapterDownloadEnabled: boolean = false;
  @Prop chapterStartBookmarkCreationEnabled: boolean = false;
  canActOnEntry?: (entry: LocalReadingTocEntry) => boolean;
  onSelectChapter: (index: number) => void = (_index: number): void => {};
  onTogglePreviewGroup: (index: number) => void = (_index: number): void => {};
  onDownloadChapter: (index: number) => void = (_index: number): void => {};
  onDeleteBookmarks: (times: number[]) => void = (_times: number[]): void => {};
  onCreateChapterStartBookmark: (request: ReaderDirectoryChapterStartBookmarkRequest) => void =
    (_request: ReaderDirectoryChapterStartBookmarkRequest): void => {};

  private bookmarkActionEnabled(): boolean {
    return this.entry.navigable !== false && this.entry.bookmarks !== undefined &&
      (this.entry.bookmarks.length > 0 || this.chapterStartBookmarkCreationEnabled);
  }

  private bookmarkActionLabel(): string {
    if ((this.entry.bookmarks?.length ?? 0) > 0) return '删除本章已有书签';
    return this.chapterStartBookmarkCreationEnabled ? '添加本章章首书签' : '当前章节不支持添加书签';
  }

  private marker(): void {
    if (!this.bookmarkActionEnabled() || this.canActOnEntry?.(this.entry) === false) return;
    const state = readerDirectoryBookmarkMarkerState(this.entry);
    if (state.kind === 'bookmarked') this.onDeleteBookmarks(state.bookmarkTimes);
    else if (state.kind === 'empty') this.onCreateChapterStartBookmark(state.createRequest);
  }

  private downloadActionEnabled(): boolean {
    if (this.entry.navigable === false || !this.chapterDownloadEnabled) return false;
    const state = this.entry.downloadState;
    return state === 'missing' || state === 'cached' || state === 'failed' || state === 'cancelled';
  }

  private downloadActionLabel(): string {
    switch (this.entry.downloadState) {
      case 'cached': return '正文已缓存，补齐离线资源';
      case 'queued': return '等待下载';
      case 'paused': return this.variant === 'standalone' ? '未下载，点按下载' : '下载已暂停';
      case 'inProgress': return '下载中';
      case 'completed': return '已下载';
      case 'failed': return '下载失败，点按重试';
      case 'cancelled': return '下载已取消，点按重试';
      default: return this.variant === 'standalone' ? '未下载，点按下载' : '下载章节';
    }
  }

  @Builder
  private chapterTitle() {
    Text(this.entry.title.trim().length > 0 && this.entry.title.trim() !== '第话' && this.entry.title.trim() !== '第 话' ?
      this.entry.title : `第${Math.max(1, this.entry.index + 1)}话`)
      .width(this.variant === 'standalone' ? '100%' : undefined)
      .layoutWeight(this.variant === 'standalone' ? 0 : 1)
      .padding({ left: 9 + readerDirectoryIndentVp(this.entry), right: 9 })
      .fontFamily((this.variant === 'standalone' ? TYPE_READER_DIRECTORY_TITLE_INTER : TYPE_READER_DIRECTORY_TITLE).fontFamily)
      .fontWeight((this.variant === 'standalone' ? TYPE_READER_DIRECTORY_TITLE_INTER : TYPE_READER_DIRECTORY_TITLE).fontWeight)
      .fontSize((this.variant === 'standalone' ? TYPE_READER_DIRECTORY_TITLE_INTER : TYPE_READER_DIRECTORY_TITLE).fontSizeFp)
      .fontColor(readerAppColor('TOK_READ_INK', this.appThemeScheme)).maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis });
  }

  @Builder
  private detailPreviewRow() {
    Row({ space: 8 }) {
      Text(this.entry.title).layoutWeight(1).constraintSize({ minWidth: 0 })
        .fontFamily('ReaderNotoSansSC').fontSize(14).lineHeight(22)
        .fontWeight(this.entry.navigable === false ? FontWeight.Medium : FontWeight.Regular)
        .fontColor(readerAppColor(this.entry.navigable === false ? 'TOK_MUTED' : 'TOK_INK', this.appThemeScheme));
      if (this.entry.navigable === false) {
        Text(this.previewGroupCollapsed ? '›' : '⌄').width(24).fontSize(18)
          .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme));
      }
    }.width('100%').constraintSize({ minHeight: this.entry.navigable === false ? 44 : 58 })
      .padding({ left: this.previewNested ? 26 : 10, right: 10, top: 10, bottom: 10 })
      .border({ width: { bottom: 0.5 }, color: { bottom: readerAppColor('TOK_CHAPTER_DIVIDER', this.appThemeScheme) } })
      .backgroundColor(this.entry.navigable === false ? readerAppColor('TOK_CARD_BG', this.appThemeScheme) : Color.Transparent)
      .borderRadius(this.entry.navigable === false ? 8 : 0)
      .attributeModifier(new ReaderActionAccessibility(this.previewActionLabel(), this.previewEnabled))
      .onClick((): void => {
        if (!this.previewEnabled || this.canActOnEntry?.(this.entry) === false) return;
        if (this.entry.navigable === false) this.onTogglePreviewGroup(this.entry.index);
        else this.onSelectChapter(this.entry.index);
      });
  }

  private previewActionLabel(): string {
    const label = readerDirectoryAccessibilityText(this.entry);
    return this.entry.navigable === false ? `${label}，${this.previewGroupCollapsed ? '展开' : '收起'}` : label;
  }

  build() {
    if (this.variant === 'detail-preview') {
      this.detailPreviewRow();
    } else {
    Row() {
      Row() {
        if (this.entry.index === this.currentChapterIndex) {
          Row().width(3).height(this.rowHeight).borderRadius(999).backgroundColor(readerAppColor('TOK_ACCENT', this.appThemeScheme));
        }
        if (this.variant === 'standalone') {
          Stack({ alignContent: Alignment.Center }) { this.chapterTitle(); }.layoutWeight(1).height(this.rowHeight);
        } else {
          this.chapterTitle();
        }
      }.layoutWeight(1).height(this.rowHeight).accessibilityText(readerDirectoryAccessibilityText(this.entry))
        .enabled(this.entry.navigable !== false)
        .onClick((): void => {
          if (this.entry.navigable !== false && this.canActOnEntry?.(this.entry) !== false) this.onSelectChapter(this.entry.index);
        });
      if (this.entry.navigable !== false && this.chapterDownloadEnabled && this.entry.downloadState !== 'unknown') {
        Button({ type: ButtonType.Normal, stateEffect: false }) {
          Image(this.entry.downloadState === 'completed' ? (this.appThemeScheme === 'night' ? $r('app.media.reader_directory_marker_check_theme_night') : $r('app.media.reader_directory_marker_check')) :
            (this.appThemeScheme === 'night' ? $r('app.media.reader_directory_marker_download_theme_night') : $r('app.media.reader_directory_marker_download'))).width(15).height(15).accessibilityLevel('no');
        }.width(26).height(this.variant === 'standalone' ? 26 : this.rowHeight)
          .padding(0).backgroundColor(Color.Transparent)
          .borderRadius(this.variant === 'standalone' ? 6 : 0).accessibilityText(this.downloadActionLabel())
          .enabled(this.downloadActionEnabled())
          .onClick((): void => {
            if (this.downloadActionEnabled() && this.canActOnEntry?.(this.entry) !== false) this.onDownloadChapter(this.entry.index);
          });
      }
      if (this.entry.navigable !== false && this.entry.bookmarks !== undefined) {
        Button({ type: ButtonType.Normal, stateEffect: false }) {
          Image(this.entry.bookmarks.length > 0 ? (this.appThemeScheme === 'night' ? $r('app.media.reader_directory_marker_bookmark_active_theme_night') : $r('app.media.reader_directory_marker_bookmark_active')) :
            (this.appThemeScheme === 'night' ? $r('app.media.reader_directory_marker_bookmark_theme_night') : $r('app.media.reader_directory_marker_bookmark'))).width(15).height(15).accessibilityLevel('no');
        }.width(26).height(this.variant === 'standalone' ? 26 : this.rowHeight)
          .padding(0)
          .backgroundColor(this.variant === 'standalone' && (this.entry.bookmarks?.length ?? 0) > 0 ?
            readerAppColor('TOK_READ_ACTIVE_SOFT', this.appThemeScheme) : Color.Transparent)
          .borderRadius(this.variant === 'standalone' ? 6 : 0)
          .margin({ right: this.variant === 'standalone' ? 5 : 0 }).accessibilityText(this.bookmarkActionLabel())
          .enabled(this.bookmarkActionEnabled())
          .onClick((): void => this.marker());
      }
    }.width('100%').height(this.rowHeight).borderRadius(6)
      .backgroundColor(this.entry.index === this.currentChapterIndex ? readerAppColor('TOK_READ_ACTIVE_SOFT', this.appThemeScheme) : Color.Transparent);
    }
  }
}
