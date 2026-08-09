import type { LocalReadingTocEntry } from './LocalReadingFlowGateway';
import {
  readerDirectoryBookmarkMarkerState,
  type ReaderDirectoryBookmarkMarkerState,
  type ReaderDirectoryChapterStartBookmarkRequest,
} from './ReaderDirectoryMarkerState';
import {
  TOK_ACCENT,
  TOK_BORDER_W,
  TOK_LINE,
  TOK_READ_ACTIVE_SOFT,
  TOK_READ_INK,
  TOK_READ_MUTED,
  TOK_READ_PRIMARY,
  TOK_SURFACE_PANEL,
} from '../common/ReaderTokens';

/**
 * Figma Reader Module Directory / Phone (`943:9888`) content area only.
 * Bookmark/download markers appear only when the owning projection exposes
 * those facts; this component never fabricates them from a raw TOC row.
 */
@Component
export struct ReaderDirectoryModulePanel {
  @Prop entries: LocalReadingTocEntry[] = [];
  @Prop currentChapterIndex: number = -1;
  @State private activeTab: string = 'directory';
  onSelectChapter: (chapterIndex: number) => void = (_chapterIndex: number): void => {};
  // A filled chapter marker represents every existing Core bookmark projected
  // onto that chapter. An empty marker may emit only the exact chapter-start
  // request; the owner adds book identity and reloads after Core confirmation.
  onDeleteBookmarks: (bookmarkTimes: number[]) => void = (_bookmarkTimes: number[]): void => {};
  // Creation stays disabled until the owning reading transaction supplies
  // book identity and refreshes the projection after Core confirmation.
  @Prop chapterStartBookmarkCreationEnabled: boolean = false;
  onCreateChapterStartBookmark: (request: ReaderDirectoryChapterStartBookmarkRequest) => void =
    (_request: ReaderDirectoryChapterStartBookmarkRequest): void => {};

  build() {
    Column() {
      this.tabs();
      Column() {
        ForEach(this.visibleEntries(), (entry: LocalReadingTocEntry) => {
          this.chapterRow(entry);
        }, (entry: LocalReadingTocEntry): string => `reader-module-toc-${entry.index}`);
      }
      .width('100%')
      .height(128)
      .padding({ left: 6, right: 6, top: 3, bottom: 3 });
    }
    .width('100%')
    .height(190)
    .padding({ left: 11, right: 11, top: 13, bottom: 13 })
    .backgroundColor(TOK_SURFACE_PANEL)
    .border({ width: TOK_BORDER_W, color: TOK_LINE })
    .borderRadius(8)
    .clip(true);
  }

  @Builder
  private tabs() {
    Column() {
      Row() {
        Stack({ alignContent: Alignment.Bottom }) {
          Text('目录')
            .width('100%')
            .height(31)
            .fontFamily('ReaderInter')
            .fontWeight(600)
            .fontSize(10)
            .fontColor(this.activeTab === 'directory' ? TOK_READ_PRIMARY : TOK_READ_MUTED)
            .textAlign(TextAlign.Center);
          if (this.activeTab === 'directory') {
            Row()
              .width(66)
              .height(2)
              .backgroundColor(TOK_READ_PRIMARY)
              .borderRadius(999);
          }
        }
        .layoutWeight(1)
        .height(31)
        .accessibilityText('目录')
        .onClick((): void => {
          this.activeTab = 'directory';
        });

        Stack({ alignContent: Alignment.Bottom }) {
          Text('书签')
            .width('100%')
            .height(31)
            .fontFamily('ReaderInter')
            .fontWeight(600)
            .fontSize(10)
            .fontColor(this.activeTab === 'bookmarks' ? TOK_READ_PRIMARY : TOK_READ_MUTED)
            .textAlign(TextAlign.Center);
          if (this.activeTab === 'bookmarks') {
            Row()
              .width(66)
              .height(2)
              .backgroundColor(TOK_READ_PRIMARY)
              .borderRadius(999);
          }
        }
        .layoutWeight(1)
        .height(31)
        .accessibilityText('书签')
        .onClick((): void => {
          this.activeTab = 'bookmarks';
        });
      }
      .width('100%')
      .height(31)
      .padding({ left: 5, right: 5 });
      Row()
        .width('100%')
        .height(1)
        .backgroundColor(TOK_LINE);
    }
    .width('100%')
    .height(32);
  }

  @Builder
  private chapterRow(entry: LocalReadingTocEntry) {
    Row() {
      Row() {
        if (this.isCurrent(entry)) {
          Row()
            .width(3)
            .height(32)
            .backgroundColor(TOK_ACCENT)
            .borderRadius(999);
        }
        Stack({ alignContent: Alignment.Center }) {
          Text(entry.title)
            .width('100%')
            .padding({ left: this.isCurrent(entry) ? 5 : 8, right: 8 })
            .fontFamily('ReaderInter')
            .fontWeight(500)
            .fontSize(11)
            .lineHeight(12.32)
            .fontColor(TOK_READ_INK)
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis });
        }
        .layoutWeight(1)
        .height(32);
      }
      .layoutWeight(1)
      .height(32)
      .accessibilityText(`打开章节：${entry.title}`)
      .onClick((): void => this.onSelectChapter(entry.index));
      if (entry.downloadState !== 'unknown') {
        this.downloadMarkerHitTarget(entry);
      }
      if (entry.bookmarks !== undefined) {
        this.bookmarkMarkerHitTarget(entry);
      }
    }
    .width('100%')
    .height(32)
    .backgroundColor(this.isCurrent(entry) ? TOK_READ_ACTIVE_SOFT : Color.Transparent)
    .border({ width: { top: 1 }, color: this.isFirstVisible(entry) ? Color.Transparent : TOK_LINE })
    .borderRadius(6)
    .alignItems(VerticalAlign.Center);
  }

  @Builder
  private downloadMarkerHitTarget(entry: LocalReadingTocEntry) {
    Stack({ alignContent: Alignment.Center }) {
      Image($r(`app.media.${this.downloadMarker(entry)}`))
        .width(15)
        .height(15);
    }
    .width(26)
    .height(26)
    .borderRadius(6)
    .enabled(false)
    .accessibilityText(this.downloadMarkerLabel(entry));
  }

  @Builder
  private bookmarkMarkerHitTarget(entry: LocalReadingTocEntry) {
    Stack({ alignContent: Alignment.Center }) {
      Image($r(`app.media.${this.bookmarkMarker(entry)}`))
        .width(15)
        .height(15);
    }
    .width(26)
    .height(26)
    .backgroundColor(this.hasBookmark(entry) ? TOK_READ_ACTIVE_SOFT : Color.Transparent)
    .borderRadius(6)
    .margin({ right: 3 })
    .enabled(this.bookmarkMarkerEnabled(readerDirectoryBookmarkMarkerState(entry)))
    .accessibilityText(this.bookmarkMarkerLabel(readerDirectoryBookmarkMarkerState(entry)))
    .onClick((): void => {
      const markerState = readerDirectoryBookmarkMarkerState(entry);
      if (markerState.kind === 'bookmarked') {
        this.onDeleteBookmarks(markerState.bookmarkTimes);
      } else if (markerState.kind === 'empty' && this.chapterStartBookmarkCreationEnabled) {
        this.onCreateChapterStartBookmark(markerState.createRequest);
      }
    });
  }

  private visibleEntries(): LocalReadingTocEntry[] {
    const tabEntries = this.tabEntries();
    if (tabEntries.length <= 4) {
      return tabEntries;
    }
    let currentPosition = 0;
    for (let index = 0; index < tabEntries.length; index += 1) {
      if (tabEntries[index].index === this.currentChapterIndex) {
        currentPosition = index;
        break;
      }
    }
    const start = Math.max(0, Math.min(tabEntries.length - 4, currentPosition - 2));
    return tabEntries.slice(start, start + 4);
  }

  private tabEntries(): LocalReadingTocEntry[] {
    if (this.activeTab === 'directory') {
      return this.entries;
    }
    const bookmarkedEntries: LocalReadingTocEntry[] = [];
    for (const entry of this.entries) {
      if (this.hasBookmark(entry)) {
        bookmarkedEntries.push(entry);
      }
    }
    return bookmarkedEntries;
  }

  private isFirstVisible(entry: LocalReadingTocEntry): boolean {
    const visible = this.visibleEntries();
    return visible.length > 0 && visible[0].index === entry.index;
  }

  private isCurrent(entry: LocalReadingTocEntry): boolean {
    return entry.index === this.currentChapterIndex;
  }

  private hasBookmark(entry: LocalReadingTocEntry): boolean {
    return entry.bookmarks !== undefined && entry.bookmarks.length > 0;
  }

  private bookmarkMarkerEnabled(state: ReaderDirectoryBookmarkMarkerState): boolean {
    return state.kind === 'bookmarked' ||
      (state.kind === 'empty' && this.chapterStartBookmarkCreationEnabled);
  }

  private bookmarkMarkerLabel(state: ReaderDirectoryBookmarkMarkerState): string {
    if (state.kind === 'bookmarked') {
      return '删除本章已有书签';
    }
    if (state.kind === 'empty' && this.chapterStartBookmarkCreationEnabled) {
      return '添加本章章首书签';
    }
    return state.kind === 'unknown' ? '书签状态尚未载入' : '添加书签尚未接线';
  }

  private downloadMarker(entry: LocalReadingTocEntry): string {
    return entry.downloadState === 'cached' || entry.downloadState === 'completed' ?
      'reader_directory_marker_check' : 'reader_directory_marker_download';
  }

  private downloadMarkerLabel(entry: LocalReadingTocEntry): string {
    return entry.downloadState === 'cached' || entry.downloadState === 'completed' ? '已下载' : '未下载';
  }

  private bookmarkMarker(entry: LocalReadingTocEntry): string {
    return this.hasBookmark(entry) ?
      'reader_directory_marker_bookmark_active' : 'reader_directory_marker_bookmark';
  }
}
