import { TOK_LINE, TOK_READ_INK, TOK_READ_MUTED } from '../common/ReaderTokens';
import type { ReaderBookmarkRowModel } from './ReaderBookmarkProjection';

export const BOOKMARK_ROW_HEIGHT = 74;
const BOOKMARK_EXCERPT_ACCENT = '#8C9B8466';
const BOOKMARK_PENDING_LABEL = '待确认';

/**
 * One bookmark row: icon, chapter title, in-chapter position (percent when the
 * chapter scalar length is known, exact scalar offset otherwise), excerpt and
 * creation time. Tap emits the exact Core anchor — never a chapter opening.
 */
@Component
export struct ReaderBookmarkRow {
  @Prop row: ReaderBookmarkRowModel = {
    bookmarkId: '',
    identityStatus: 'confirmed',
    chapterIndex: 0,
    chapterOffset: 0,
    chapterTitle: '',
    excerpt: '',
    positionLabel: '',
    timeLabel: '',
  };
  onSelectBookmark: (bookmarkId: string, chapterIndex: number, chapterOffset: number) => void =
    (_bookmarkId: string, _chapterIndex: number, _chapterOffset: number): void => {};

  build() {
    Column({ space: 0 }) {
      Row({ space: 6 }) {
        Image($r('app.media.reader_directory_marker_bookmark_active'))
          .width(12)
          .height(12);
        Text(this.row.chapterTitle)
          .layoutWeight(1)
          .constraintSize({ minWidth: 0 })
          .fontFamily('ReaderNotoSansSC')
          .fontWeight(500)
          .fontSize(11)
          .lineHeight(14)
          .fontColor(TOK_READ_INK)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis });
        if (this.row.identityStatus === 'pendingConfirmation') {
          Text(BOOKMARK_PENDING_LABEL)
            .flexShrink(0)
            .fontFamily('ReaderInter')
            .fontSize(8)
            .fontColor(TOK_READ_MUTED);
        }
        Text(this.row.positionLabel)
          .flexShrink(0)
          .fontFamily('ReaderInter')
          .fontSize(9)
          .fontColor(TOK_READ_MUTED)
          .maxLines(1);
        Text(this.row.timeLabel)
          .flexShrink(0)
          .fontFamily('ReaderInter')
          .fontSize(9)
          .fontColor(TOK_READ_MUTED)
          .maxLines(1);
      }
      .width('100%')
      .height(16)
      .margin({ top: 8 })
      .alignItems(VerticalAlign.Center);

      Row({ space: 8 }) {
        Text('')
          .width(1)
          .height(26)
          .backgroundColor(BOOKMARK_EXCERPT_ACCENT)
          .borderRadius(1);
        Text(this.row.excerpt)
          .layoutWeight(1)
          .constraintSize({ minWidth: 0 })
          .fontFamily('ReaderNotoSerifSCRegular')
          .fontWeight(FontWeight.Regular)
          .fontSize(9)
          .lineHeight(13)
          .fontColor(TOK_READ_MUTED)
          .maxLines(2)
          .textOverflow({ overflow: TextOverflow.Ellipsis });
      }
      .width('100%')
      .height(28)
      .margin({ top: 7 })
      .alignItems(VerticalAlign.Center);

      Text('')
        .width('100%')
        .height(1)
        .margin({ top: 13 })
        .backgroundColor(TOK_LINE);
    }
    .width('100%')
    .height(BOOKMARK_ROW_HEIGHT)
    .padding({ left: 10, right: 10 })
    .accessibilityText(`打开书签：${this.row.chapterTitle} ${this.row.positionLabel}`)
    .onClick((): void =>
      this.onSelectBookmark(this.row.bookmarkId, this.row.chapterIndex, this.row.chapterOffset));
  }
}
