import { TOK_SPACE_CONTROL_INLINE } from '../common/ReaderTokens';
import type { ReaderBookmarkRowModel } from './ReaderBookmarkProjection';
import { BOOKMARK_ROW_HEIGHT, ReaderBookmarkRow } from './ReaderBookmarkRow';

/**
 * Flat bookmark list: one row per bookmark, same-chapter bookmarks as separate
 * rows. Consumers render the empty/loading/error states themselves; this
 * component never fabricates rows from directory data.
 */
@Component
export struct ReaderBookmarkList {
  @Prop rows: ReaderBookmarkRowModel[] = [];
  @Prop listPaddingX: number = TOK_SPACE_CONTROL_INLINE;
  @Prop listPaddingY: number = 4;
  scroller: Scroller | undefined = undefined;
  onSelectBookmark: (bookmarkId: string, chapterIndex: number, chapterOffset: number) => void =
    (_bookmarkId: string, _chapterIndex: number, _chapterOffset: number): void => {};

  build() {
    List({ space: 0, scroller: this.scroller }) {
      Repeat(this.rows)
        .each((repeatItem: RepeatItem<ReaderBookmarkRowModel>) => {
          ListItem() {
            ReaderBookmarkRow({
              row: repeatItem.item,
              onSelectBookmark: this.onSelectBookmark,
            });
          }
          .width('100%')
          .height(BOOKMARK_ROW_HEIGHT);
        })
        .key((row: ReaderBookmarkRowModel): string => `reader-bookmark-${row.bookmarkId}`)
        .virtualScroll({ totalCount: this.rows.length, reusable: false });
    }
    .width('100%')
    .height('100%')
    .padding({
      left: this.listPaddingX,
      right: this.listPaddingX,
      top: this.listPaddingY,
      bottom: this.listPaddingY,
    })
    .scrollBar(BarState.Off);
  }
}
