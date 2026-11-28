import { READER_FONT_NOTO_SANS_SC_UI_MEDIUM, READER_FONT_NOTO_SANS_SC_UI_REGULAR } from '../../../ui/foundation/ReaderFontFamilies';
import { ReaderDelayedRowPress, readerAnimatePress, readerPressOpacity, readerPressScale, readerPressSurface } from '../../../ui/foundation/ReaderPressMotion';
import { ReaderActionAccessibility, readerActionTouchRegion } from '../../../ui/controls/ReaderActionAccessibility';
import { TYPE_READER_DIRECTORY_TITLE, TYPE_READER_DIRECTORY_TITLE_INTER } from '../../../ui/foundation/ReaderTypography';
import { readerAppColor } from '../../../ui/foundation/ReaderAppColors';
import { ReaderPressFeedback } from '../../../ui/foundation/ReaderPressFeedback';
import type { LocalReadingTocEntry } from '../application/LocalReadingFlowTypes';
import { readerDirectoryBookmarkMarkerState, type ReaderDirectoryChapterStartBookmarkRequest } from '../presentation/ReaderDirectoryMarkerState';
import { readerDirectoryAccessibilityText, readerDirectoryIndentVp } from './ReaderDirectoryHierarchy';

/** Shared chapter presentation; all storage operations remain with the owner. */
@Component
export struct ReaderDirectoryChapterRow {
  @StorageProp('readerReduceMotion') private reduceMotion: boolean = false;
  @State private pressedKey: string = '';
  private readonly delayedPress: ReaderDelayedRowPress = new ReaderDelayedRowPress((key: string): void => {
    if (key.length === 0) this.pressedKey = '';
    else readerAnimatePress(this.getUIContext(), this.reduceMotion, (): void => { this.pressedKey = key; });
  });
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  @Prop @Watch('clearPress') entry: LocalReadingTocEntry;
  @Prop rowHeight: number = 44;
  @Prop currentChapterIndex: number = -1;
  @Prop variant: 'control' | 'standalone' | 'detail-preview' = 'control';
  @Prop previewNested: boolean = false;
  @Prop previewGroupCollapsed: boolean = false;
  @Prop @Watch('clearPress') previewEnabled: boolean = true;
  @Prop chapterDownloadEnabled: boolean = false;
  @Prop bookmarkActionsEnabled: boolean = true;
  @Prop chapterStartBookmarkCreationEnabled: boolean = false;
  @Prop selectionFocusId: string = '';
  canActOnEntry?: (entry: LocalReadingTocEntry) => boolean;
  onSelectChapter: (index: number) => void = (_index: number): void => {};
  onTogglePreviewGroup: (index: number) => void = (_index: number): void => {};
  onDownloadChapter: (index: number) => void = (_index: number): void => {};
  onDeleteBookmarks: (times: number[]) => void = (_times: number[]): void => {};
  onCreateChapterStartBookmark: (request: ReaderDirectoryChapterStartBookmarkRequest) => void =
    (_request: ReaderDirectoryChapterStartBookmarkRequest): void => {};

  aboutToDisappear(): void { this.clearPress(); }

  private clearPress(): void { this.delayedPress.cancel(); }

  private observeChapterPress(event: TouchEvent, enabled: boolean): void {
    this.delayedPress.observe(event, 'row', enabled && this.canActOnEntry?.(this.entry) !== false);
  }

  private bookmarkActionEnabled(): boolean {
    return this.bookmarkActionsEnabled && this.entry.navigable !== false && this.entry.bookmarks !== undefined &&
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
    Row() {
    Row({ space: 8 }) {
      Text(this.entry.title).layoutWeight(1).constraintSize({ minWidth: 0 })
        .fontFamily(this.entry.navigable === false ? READER_FONT_NOTO_SANS_SC_UI_MEDIUM : READER_FONT_NOTO_SANS_SC_UI_REGULAR)
        .fontSize(14).lineHeight(22)
        .fontWeight(this.entry.navigable === false ? FontWeight.Medium : FontWeight.Regular)
        .fontColor(readerAppColor(this.entry.navigable === false ? 'TOK_MUTED' : 'TOK_INK', this.appThemeScheme));
      if (this.entry.navigable === false) {
        Image(this.appThemeScheme === 'night' ? $r('app.media.reader_chevron_right_theme_night') : $r('app.media.reader_chevron_right'))
          .width(16).height(16).rotate({ angle: this.previewGroupCollapsed ? 0 : 90 })
          .fillColor(readerAppColor('TOK_MUTED', this.appThemeScheme)).accessibilityLevel('no');
      }
    }.width('100%').constraintSize({ minHeight: this.entry.navigable === false ? 44 : 58 })
      .padding({ left: this.previewNested ? 26 : 10, right: 10, top: 10, bottom: 10 })
      .border({ width: { bottom: 0.5 }, color: { bottom: readerAppColor('TOK_CHAPTER_DIVIDER', this.appThemeScheme) } })
      .backgroundColor(readerPressSurface(this.entry.navigable === false ? readerAppColor('TOK_CARD_BG', this.appThemeScheme) : Color.Transparent,
        this.appThemeScheme, this.pressedKey === 'row', this.reduceMotion))
      .borderRadius(this.entry.navigable === false ? 8 : 0).scale(readerPressScale(this.pressedKey === 'row', this.reduceMotion))
      .opacity(readerPressOpacity(this.pressedKey === 'row', this.reduceMotion));
    }.width('100%')
      .attributeModifier(new ReaderActionAccessibility(this.previewActionLabel(), this.previewEnabled))
      .onTouch((event: TouchEvent): void => this.observeChapterPress(event, this.previewEnabled))
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
      Row() {
        if (this.entry.index === this.currentChapterIndex) {
          Row().width(3).height(this.rowHeight).borderRadius(1.5).backgroundColor(readerAppColor('TOK_ACCENT', this.appThemeScheme));
        }
        if (this.variant === 'standalone') {
          Stack({ alignContent: Alignment.Center }) { this.chapterTitle(); }.layoutWeight(1).height(this.rowHeight);
        } else {
          this.chapterTitle();
        }
      }.width('100%').height(this.rowHeight).borderRadius(6)
        .backgroundColor(readerPressSurface(Color.Transparent, this.appThemeScheme, this.pressedKey === 'row', this.reduceMotion))
        .scale(readerPressScale(this.pressedKey === 'row', this.reduceMotion))
        .opacity(readerPressOpacity(this.pressedKey === 'row', this.reduceMotion));
      }.layoutWeight(1).height(this.rowHeight).accessibilityText(readerDirectoryAccessibilityText(this.entry))
        .id(this.selectionFocusId)
        .enabled(this.entry.navigable !== false)
        .responseRegion({ x: 0, y: 0, width: '100%', height: this.rowHeight })
        .onTouch((event: TouchEvent): void => this.observeChapterPress(event, this.entry.navigable !== false))
        .onClick((): void => {
          if (this.entry.navigable !== false && this.canActOnEntry?.(this.entry) !== false) this.onSelectChapter(this.entry.index);
        });
      if (this.entry.navigable !== false && this.chapterDownloadEnabled && this.entry.downloadState !== 'unknown') {
        Button({ type: ButtonType.Normal, stateEffect: false }) {
          Image(this.entry.downloadState === 'completed' ? (this.appThemeScheme === 'night' ? $r('app.media.reader_directory_marker_check_theme_night') : $r('app.media.reader_directory_marker_check')) :
            (this.appThemeScheme === 'night' ? $r('app.media.reader_directory_marker_download_theme_night') : $r('app.media.reader_directory_marker_download'))).width(15).height(15).accessibilityLevel('no');
        }.width(44).height(Math.max(44, this.rowHeight))
          .responseRegion(readerActionTouchRegion(44, Math.max(44, this.rowHeight)))
          .padding(0).attributeModifier(new ReaderPressFeedback(Color.Transparent, this.appThemeScheme, 6, 6,
            this.downloadActionEnabled(), this.pressedKey === 'download', false)).accessibilityText(this.downloadActionLabel())
          .enabled(this.downloadActionEnabled())
          .onTouch((event: TouchEvent): void => {
            this.delayedPress.observe(event, 'download', this.downloadActionEnabled() && this.canActOnEntry?.(this.entry) !== false);
          })
          .onClick((): void => {
            if (this.downloadActionEnabled() && this.canActOnEntry?.(this.entry) !== false) this.onDownloadChapter(this.entry.index);
          });
      }
      if (this.entry.navigable !== false && this.entry.bookmarks !== undefined) {
        Button({ type: ButtonType.Normal, stateEffect: false }) {
          Image(this.entry.bookmarks.length > 0 ? (this.appThemeScheme === 'night' ? $r('app.media.reader_directory_marker_bookmark_active_theme_night') : $r('app.media.reader_directory_marker_bookmark_active')) :
            (this.appThemeScheme === 'night' ? $r('app.media.reader_directory_marker_bookmark_theme_night') : $r('app.media.reader_directory_marker_bookmark'))).width(15).height(15).accessibilityLevel('no');
        }.width(44).height(Math.max(44, this.rowHeight))
          .responseRegion(readerActionTouchRegion(44, Math.max(44, this.rowHeight)))
          .padding(0)
          .attributeModifier(new ReaderPressFeedback(this.variant === 'standalone' && (this.entry.bookmarks?.length ?? 0) > 0 ?
            readerAppColor('TOK_READ_ACTIVE_SOFT', this.appThemeScheme) : Color.Transparent, this.appThemeScheme, 6, 6,
            this.bookmarkActionEnabled(), this.pressedKey === 'bookmark', false))
          .margin({ right: this.variant === 'standalone' ? 5 : 0 }).accessibilityText(this.bookmarkActionLabel())
          .enabled(this.bookmarkActionEnabled())
          .onTouch((event: TouchEvent): void => {
            this.delayedPress.observe(event, 'bookmark', this.bookmarkActionEnabled() && this.canActOnEntry?.(this.entry) !== false);
          })
          .onClick((): void => this.marker());
      }
    }.width('100%').height(this.rowHeight).borderRadius(6)
      .backgroundColor(this.entry.index === this.currentChapterIndex ? readerAppColor('TOK_READ_ACTIVE_SOFT', this.appThemeScheme) : Color.Transparent);
    }
  }
}
