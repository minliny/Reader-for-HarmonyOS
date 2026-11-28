import { TYPE_READER_BOOKMARK_CHAPTER, TYPE_READER_BOOKMARK_EXCERPT, TYPE_READER_BOOKMARK_EXCERPT_LEGACY, TYPE_READER_BOOKMARK_META, TYPE_READER_BOOKMARK_PENDING, TYPE_READER_BOOKMARK_PENDING_LEGACY } from '../../../ui/foundation/ReaderTypography';
import type { RemoteReadingPositionScope } from '../application/RemoteReadingPositionMigration';
import { readerAppColor } from '../../../ui/foundation/ReaderAppColors';
import { ReaderPressFeedback } from '../../../ui/foundation/ReaderPressFeedback';
import type { ReaderBookmarkRowModel } from '../presentation/ReaderBookmarkProjection';
import { sampleReaderControlBookmark, type ReaderControlBookmarkFrame,
  type ReaderControlBookmarkNaturalSize } from './ReaderControlBookmarkGeometry';
import type { UIContext } from '@ohos.arkui.UIContext';
import { measureReaderControlText } from './ReaderControlTextMeasurement';

export const BOOKMARK_ROW_HEIGHT = 74;
const BOOKMARK_PENDING_LABEL = '待确认';

export interface ReaderStandaloneBookmarkSize {
  titleHeight: number;
  excerptHeight: number;
  rowHeight: number;
}

/** The standalone list and its materialized rows consume one native line budget. */
export function measureReaderStandaloneBookmark(context: UIContext, width: number,
  fontScale: number): ReaderStandaloneBookmarkSize {
  const scale = Number.isFinite(fontScale) ? Math.max(1, fontScale) : 1;
  const title = measureReaderControlText(context, '字', TYPE_READER_BOOKMARK_CHAPTER, Math.max(1, width));
  const meta = measureReaderControlText(context, '100%', TYPE_READER_BOOKMARK_META, Math.max(1, width));
  const pending = measureReaderControlText(context, BOOKMARK_PENDING_LABEL, TYPE_READER_BOOKMARK_PENDING_LEGACY, Math.max(1, width));
  const excerpt = measureReaderControlText(context, '字', TYPE_READER_BOOKMARK_EXCERPT_LEGACY, Math.max(1, width));
  const titleHeight = Math.max(16, title?.heightVp ?? 16 * scale, meta?.heightVp ?? 16 * scale,
    pending?.heightVp ?? 16 * scale);
  const excerptHeight = Math.max(28, (excerpt?.heightVp ?? 14 * scale) * 2);
  return { titleHeight, excerptHeight, rowHeight: Math.max(BOOKMARK_ROW_HEIGHT, 8 + titleHeight + 7 + excerptHeight + 14) };
}

/**
 * One bookmark row: icon, chapter title, in-chapter position (percent when the
 * chapter scalar length is known), excerpt and
 * creation time. Tap emits the exact Core anchor — never a chapter opening.
 */
@Component
export struct ReaderBookmarkRow {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';

  @Prop embeddedInControl: boolean = false;
  @Prop motionProgress: number = 1;
  @Prop showExcerpt: boolean = true;
  @Prop availableWidth: number = 316;
  @Prop naturalSize: ReaderControlBookmarkNaturalSize | undefined = undefined;
  @Prop standaloneSize: ReaderStandaloneBookmarkSize | undefined = undefined;
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
  onSelectBookmark: (bookmarkId: string, chapterIndex: number, chapterOffset: number, positionScope?: RemoteReadingPositionScope) => void =
    (_bookmarkId: string, _chapterIndex: number, _chapterOffset: number): void => {};

  build() {
    if (this.embeddedInControl) {
      this.motionBody();
    } else {
      this.legacyBody();
    }
  }

  private frame(): ReaderControlBookmarkFrame {
    return sampleReaderControlBookmark(this.motionProgress, this.availableWidth, this.naturalSize, this.showExcerpt);
  }

  @Builder
  private motionBody() {
    Stack({ alignContent: Alignment.TopStart }) {
      Row({ space: 4 }) {
        Text(this.row.chapterTitle).layoutWeight(1).constraintSize({ minWidth: 0 })
          .fontFamily(TYPE_READER_BOOKMARK_CHAPTER.fontFamily).fontWeight(TYPE_READER_BOOKMARK_CHAPTER.fontWeight).fontSize(TYPE_READER_BOOKMARK_CHAPTER.fontSizeFp).lineHeight(TYPE_READER_BOOKMARK_CHAPTER.lineHeightFp as number)
          .fontColor(readerAppColor('TOK_READ_INK', this.appThemeScheme)).maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis });
        if (this.row.identityStatus === 'pendingConfirmation') {
          Text(BOOKMARK_PENDING_LABEL)
            .fontFamily(TYPE_READER_BOOKMARK_PENDING.fontFamily as string)
            .fontWeight(TYPE_READER_BOOKMARK_PENDING.fontWeight as number)
            .fontSize(TYPE_READER_BOOKMARK_PENDING.fontSizeFp)
            .fontColor(readerAppColor('TOK_READ_MUTED', this.appThemeScheme)).flexShrink(0);
        }
        Text(this.row.positionLabel).fontFamily(TYPE_READER_BOOKMARK_META.fontFamily as string).fontSize(TYPE_READER_BOOKMARK_META.fontSizeFp).fontColor(readerAppColor('TOK_READ_MUTED', this.appThemeScheme))
          .maxLines(1).constraintSize({ maxWidth: 50 }).textOverflow({ overflow: TextOverflow.Ellipsis });
        Text(this.row.timeLabel).fontFamily(TYPE_READER_BOOKMARK_META.fontFamily as string).fontSize(TYPE_READER_BOOKMARK_META.fontSizeFp).fontColor(readerAppColor('TOK_READ_MUTED', this.appThemeScheme))
          .maxLines(1).constraintSize({ maxWidth: 64 }).textOverflow({ overflow: TextOverflow.Ellipsis });
      }.width(this.frame().title.width).height(this.frame().title.height)
        .position({ x: this.frame().title.x, y: this.frame().title.y });
      if (this.showExcerpt) {
        Text('').width(this.frame().accent.width).height(this.frame().accent.height)
          .backgroundColor(readerAppColor('TOK_ACCENT', this.appThemeScheme)).borderRadius(1)
          .position({ x: this.frame().accent.x, y: this.frame().accent.y });
        Text(this.row.excerpt).width(this.frame().excerpt.width).height(this.frame().excerpt.height)
          .fontFamily(TYPE_READER_BOOKMARK_EXCERPT.fontFamily).fontWeight(TYPE_READER_BOOKMARK_EXCERPT.fontWeight)
          .fontSize(TYPE_READER_BOOKMARK_EXCERPT.fontSizeFp).lineHeight(TYPE_READER_BOOKMARK_EXCERPT.lineHeightFp as number)
          .fontColor(readerAppColor('TOK_READ_MUTED', this.appThemeScheme)).maxLines(2)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
          .position({ x: this.frame().excerpt.x, y: this.frame().excerpt.y });
      }
    }.width(this.frame().card.width).height(this.frame().card.height).clip(true)
      .attributeModifier(new ReaderPressFeedback(Color.Transparent, this.appThemeScheme, 6))
      .accessibilityText(`打开书签：${this.row.chapterTitle} ${this.row.positionLabel} ${this.row.timeLabel}` +
        (this.row.identityStatus === 'pendingConfirmation' ? ` ${BOOKMARK_PENDING_LABEL}` : '') +
        (!this.showExcerpt && this.row.excerpt.trim().length > 0 ? `，${this.row.excerpt}` : ''))
      .onClick((): void => this.onSelectBookmark(this.row.bookmarkId, this.row.chapterIndex, this.row.chapterOffset, this.row.positionScope));
  }

  @Builder
  private legacyBody() {
    Column({ space: 0 }) {
      Row({ space: 6 }) {
        Image((this.appThemeScheme === 'night' ? $r('app.media.reader_directory_marker_bookmark_active_theme_night') : $r('app.media.reader_directory_marker_bookmark_active')))
          .width(12)
          .height(12);
        Text(this.row.chapterTitle)
          .layoutWeight(1)
          .constraintSize({ minWidth: 0 })
          .fontFamily(TYPE_READER_BOOKMARK_CHAPTER.fontFamily)
          .fontWeight(TYPE_READER_BOOKMARK_CHAPTER.fontWeight)
          .fontSize(TYPE_READER_BOOKMARK_CHAPTER.fontSizeFp)
          .lineHeight(TYPE_READER_BOOKMARK_CHAPTER.lineHeightFp as number)
          .fontColor(readerAppColor('TOK_READ_INK', this.appThemeScheme))
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis });
        if (this.row.identityStatus === 'pendingConfirmation') {
          Text(BOOKMARK_PENDING_LABEL)
            .flexShrink(0)
            .fontFamily(TYPE_READER_BOOKMARK_PENDING_LEGACY.fontFamily as string)
            .fontSize(TYPE_READER_BOOKMARK_PENDING_LEGACY.fontSizeFp)
            .fontColor(readerAppColor('TOK_READ_MUTED', this.appThemeScheme));
        }
        Text(this.row.positionLabel)
          .flexShrink(1).constraintSize({ maxWidth: 50 }).textOverflow({ overflow: TextOverflow.Ellipsis })
          .fontFamily(TYPE_READER_BOOKMARK_META.fontFamily as string)
          .fontSize(TYPE_READER_BOOKMARK_META.fontSizeFp)
          .fontColor(readerAppColor('TOK_READ_MUTED', this.appThemeScheme))
          .maxLines(1);
        Text(this.row.timeLabel)
          .flexShrink(1).constraintSize({ maxWidth: 64 }).textOverflow({ overflow: TextOverflow.Ellipsis })
          .fontFamily(TYPE_READER_BOOKMARK_META.fontFamily as string)
          .fontSize(TYPE_READER_BOOKMARK_META.fontSizeFp)
          .fontColor(readerAppColor('TOK_READ_MUTED', this.appThemeScheme))
          .maxLines(1);
      }
      .width('100%')
      .height(this.standaloneSize?.titleHeight ?? 16)
      .margin({ top: 8 })
      .alignItems(VerticalAlign.Center);

      Row({ space: 8 }) {
        Text('')
          .width(1)
          .height(Math.max(26, (this.standaloneSize?.excerptHeight ?? 28) - 2))
          .backgroundColor(readerAppColor('TOK_ACCENT', this.appThemeScheme))
          .borderRadius(1);
        Text(this.row.excerpt)
          .layoutWeight(1)
          .constraintSize({ minWidth: 0 })
          .fontFamily(TYPE_READER_BOOKMARK_EXCERPT_LEGACY.fontFamily)
          .fontWeight(TYPE_READER_BOOKMARK_EXCERPT_LEGACY.fontWeight)
          .fontSize(TYPE_READER_BOOKMARK_EXCERPT_LEGACY.fontSizeFp)
          .lineHeight(TYPE_READER_BOOKMARK_EXCERPT_LEGACY.lineHeightFp as number)
          .fontColor(readerAppColor('TOK_READ_MUTED', this.appThemeScheme))
          .maxLines(2)
          .textOverflow({ overflow: TextOverflow.Ellipsis });
      }
      .width('100%')
      .height(this.standaloneSize?.excerptHeight ?? 28)
      .margin({ top: 7 })
      .alignItems(VerticalAlign.Center);

    }
    .width('100%')
    .height(this.standaloneSize?.rowHeight ?? BOOKMARK_ROW_HEIGHT)
    .padding({ left: 10, right: 10 })
    .attributeModifier(new ReaderPressFeedback(Color.Transparent, this.appThemeScheme, 6))
    .accessibilityText(`打开书签：${this.row.chapterTitle} ${this.row.positionLabel} ${this.row.timeLabel}`)
    .onClick((): void =>
      this.onSelectBookmark(this.row.bookmarkId, this.row.chapterIndex, this.row.chapterOffset, this.row.positionScope));
  }
}
