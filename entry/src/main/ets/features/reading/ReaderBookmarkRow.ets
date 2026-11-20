import { ReaderActionAccessibility, readerActionTouchRegion } from '../common/ReaderActionAccessibility';
import { TYPE_READER_BOOKMARK_CHAPTER, TYPE_READER_BOOKMARK_EXCERPT, TYPE_READER_BOOKMARK_EXCERPT_LEGACY, TYPE_READER_BOOKMARK_META, TYPE_READER_BOOKMARK_PENDING, TYPE_READER_BOOKMARK_PENDING_LEGACY } from '../common/ReaderTypography';
import type { RemoteReadingPositionScope } from './RemoteReadingPositionMigration';
import { readerAppColor } from '../common/ReaderThemeRegistry';
import { TOK_LINE, TOK_READ_INK, TOK_READ_MUTED } from '../common/ReaderTokens';
import type { ReaderBookmarkRowModel } from './ReaderBookmarkProjection';
import { sampleReaderControlBookmark, type ReaderControlBookmarkFrame } from './ReaderControlBookmarkGeometry';
import { ReaderWindowCoordinator } from '../../app/ReaderWindowCoordinator';
import { readerReadableFontScale } from '../common/ReaderSurfaceResolvers';

export const BOOKMARK_ROW_HEIGHT = 74;
const BOOKMARK_PENDING_LABEL = '待确认';

/**
 * One bookmark row: icon, chapter title, in-chapter position (percent when the
 * chapter scalar length is known), excerpt and
 * creation time. Tap emits the exact Core anchor — never a chapter opening.
 */
@Component
export struct ReaderBookmarkRow {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  @StorageLink('readerWindowMetricsRevision') private readerWindowMetricsRevision: number = 0;

  @Prop embeddedInControl: boolean = false;
  @Prop motionProgress: number = 1;
  @Prop availableWidth: number = 316;
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
    return sampleReaderControlBookmark(this.motionProgress, this.availableWidth, this.fontScale());
  }

  private fontScale(): number {
    return !Number.isFinite(this.readerWindowMetricsRevision) || this.readerWindowMetricsRevision < 0 ? 1 :
      readerReadableFontScale(ReaderWindowCoordinator.metrics().systemFontScale);
  }

  private rowHeight(): number { return sampleReaderControlBookmark(1, this.availableWidth, this.fontScale()).card.height; }

  @Builder
  private motionBody() {
    Stack({ alignContent: Alignment.TopStart }) {
      Row({ space: 4 }) {
        Text(this.row.chapterTitle).layoutWeight(1).constraintSize({ minWidth: 0 })
          .fontFamily(TYPE_READER_BOOKMARK_CHAPTER.fontFamily).fontWeight(TYPE_READER_BOOKMARK_CHAPTER.fontWeight).fontSize(TYPE_READER_BOOKMARK_CHAPTER.fontSizeFp).maxFontScale(this.fontScale()).lineHeight(TYPE_READER_BOOKMARK_CHAPTER.lineHeightFp as number)
          .fontColor(readerAppColor('TOK_READ_INK', this.appThemeScheme)).maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis })
          .id(`reader-verify-bookmark-${this.row.chapterIndex}-${this.row.chapterOffset}-title`);
        if (this.row.identityStatus === 'pendingConfirmation') {
          Text(BOOKMARK_PENDING_LABEL).fontSize(TYPE_READER_BOOKMARK_PENDING.fontSizeFp).maxFontScale(this.fontScale()).fontColor(readerAppColor('TOK_READ_MUTED', this.appThemeScheme)).flexShrink(0);
        }
        if (this.fontScale() <= 1.3) {
        Text(this.row.positionLabel).fontFamily(TYPE_READER_BOOKMARK_META.fontFamily as string).fontSize(TYPE_READER_BOOKMARK_META.fontSizeFp).maxFontScale(this.fontScale()).fontColor(readerAppColor('TOK_READ_MUTED', this.appThemeScheme))
          .maxLines(1).constraintSize({ maxWidth: 50 }).textOverflow({ overflow: TextOverflow.Ellipsis })
          .id(`reader-verify-bookmark-${this.row.chapterIndex}-${this.row.chapterOffset}-position`);
        Text(this.row.timeLabel).fontFamily(TYPE_READER_BOOKMARK_META.fontFamily as string).fontSize(TYPE_READER_BOOKMARK_META.fontSizeFp).maxFontScale(this.fontScale()).fontColor(readerAppColor('TOK_READ_MUTED', this.appThemeScheme))
          .maxLines(1).constraintSize({ maxWidth: 64 }).textOverflow({ overflow: TextOverflow.Ellipsis })
          .id(`reader-verify-bookmark-${this.row.chapterIndex}-${this.row.chapterOffset}-time`);
        }
      }.width(this.frame().title.width).constraintSize({ minHeight: this.frame().title.height })
        .position({ x: this.frame().title.x, y: this.frame().title.y });
      if (this.fontScale() > 1.3) {
        Row({ space: 8 }) {
          Text(this.row.positionLabel).fontFamily(TYPE_READER_BOOKMARK_META.fontFamily as string)
            .fontSize(TYPE_READER_BOOKMARK_META.fontSizeFp).maxFontScale(this.fontScale())
            .fontColor(readerAppColor('TOK_READ_MUTED', this.appThemeScheme)).maxLines(1)
            .id(`reader-verify-bookmark-${this.row.chapterIndex}-${this.row.chapterOffset}-position`);
          Text(this.row.timeLabel).fontFamily(TYPE_READER_BOOKMARK_META.fontFamily as string)
            .fontSize(TYPE_READER_BOOKMARK_META.fontSizeFp).maxFontScale(this.fontScale())
            .fontColor(readerAppColor('TOK_READ_MUTED', this.appThemeScheme)).maxLines(1)
            .id(`reader-verify-bookmark-${this.row.chapterIndex}-${this.row.chapterOffset}-time`);
        }.width(this.frame().metadata.width).constraintSize({ minHeight: this.frame().metadata.height })
          .position({ x: this.frame().metadata.x, y: this.frame().metadata.y });
      }
      Text('').width(this.frame().accent.width).height(this.frame().accent.height)
        .backgroundColor(readerAppColor('app.bookmark.excerptAccent', this.appThemeScheme)).borderRadius(1)
        .position({ x: this.frame().accent.x, y: this.frame().accent.y });
      Text(this.row.excerpt).width(this.frame().excerpt.width)
        .constraintSize({ minHeight: this.frame().excerpt.height }).maxFontScale(this.fontScale())
        .fontFamily(TYPE_READER_BOOKMARK_EXCERPT.fontFamily).fontWeight(TYPE_READER_BOOKMARK_EXCERPT.fontWeight)
        .fontSize(TYPE_READER_BOOKMARK_EXCERPT.fontSizeFp).lineHeight(TYPE_READER_BOOKMARK_EXCERPT.lineHeightFp as number).fontColor(readerAppColor('TOK_READ_MUTED', this.appThemeScheme)).maxLines(2)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
        .position({ x: this.frame().excerpt.x, y: this.frame().excerpt.y })
        .id(`reader-verify-bookmark-${this.row.chapterIndex}-${this.row.chapterOffset}-excerpt`);
      Text('').width(this.frame().divider.width).height(this.frame().divider.height)
        .backgroundColor(readerAppColor('TOK_LINE', this.appThemeScheme))
        .position({ x: this.frame().divider.x, y: this.frame().divider.y })
        .id(`reader-verify-bookmark-${this.row.chapterIndex}-${this.row.chapterOffset}-divider`);
    }.width(this.frame().card.width).height(this.frame().card.height).clip(true)
      .id(`reader-verify-bookmark-${this.row.chapterIndex}-${this.row.chapterOffset}-card`)
      .accessibilityText(`打开书签：${this.row.chapterTitle} ${this.row.positionLabel} ${this.row.timeLabel}` +
        (this.row.identityStatus === 'pendingConfirmation' ? ` ${BOOKMARK_PENDING_LABEL}` : ''))
      .responseRegion( readerActionTouchRegion(this.frame().card.width, this.frame().card.height))
      .attributeModifier(new ReaderActionAccessibility(`打开书签：${this.row.chapterTitle} ${this.row.positionLabel} ${this.row.timeLabel}` +
        (this.row.identityStatus === 'pendingConfirmation' ? ` ${BOOKMARK_PENDING_LABEL}` : ''), true, false))
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
          .fontSize(TYPE_READER_BOOKMARK_CHAPTER.fontSizeFp).maxFontScale(this.fontScale())
          .lineHeight(TYPE_READER_BOOKMARK_CHAPTER.lineHeightFp as number)
          .fontColor(readerAppColor('TOK_READ_INK', this.appThemeScheme))
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
          .id(`reader-verify-bookmark-${this.row.chapterIndex}-${this.row.chapterOffset}-title`);
        if (this.row.identityStatus === 'pendingConfirmation') {
          Text(BOOKMARK_PENDING_LABEL)
            .flexShrink(0)
            .fontFamily(TYPE_READER_BOOKMARK_PENDING_LEGACY.fontFamily as string)
            .fontSize(TYPE_READER_BOOKMARK_PENDING_LEGACY.fontSizeFp).maxFontScale(this.fontScale())
            .fontColor(readerAppColor('TOK_READ_MUTED', this.appThemeScheme));
        }
        if (this.fontScale() <= 1.3) {
        Text(this.row.positionLabel)
          .flexShrink(0)
          .fontFamily(TYPE_READER_BOOKMARK_META.fontFamily as string)
          .fontSize(TYPE_READER_BOOKMARK_META.fontSizeFp).maxFontScale(this.fontScale())
          .fontColor(readerAppColor('TOK_READ_MUTED', this.appThemeScheme))
          .maxLines(1)
          .id(`reader-verify-bookmark-${this.row.chapterIndex}-${this.row.chapterOffset}-position`);
        Text(this.row.timeLabel)
          .flexShrink(0)
          .fontFamily(TYPE_READER_BOOKMARK_META.fontFamily as string)
          .fontSize(TYPE_READER_BOOKMARK_META.fontSizeFp).maxFontScale(this.fontScale())
          .fontColor(readerAppColor('TOK_READ_MUTED', this.appThemeScheme))
          .maxLines(1)
          .id(`reader-verify-bookmark-${this.row.chapterIndex}-${this.row.chapterOffset}-time`);
        }
      }
      .width('100%')
      .height(16 * this.fontScale())
      .margin({ top: 8 })
      .alignItems(VerticalAlign.Center);

      if (this.fontScale() > 1.3) {
        Row({ space: 8 }) {
          Text(this.row.positionLabel).fontFamily(TYPE_READER_BOOKMARK_META.fontFamily as string)
            .fontSize(TYPE_READER_BOOKMARK_META.fontSizeFp).maxFontScale(this.fontScale())
            .fontColor(readerAppColor('TOK_READ_MUTED', this.appThemeScheme)).maxLines(1)
            .id(`reader-verify-bookmark-${this.row.chapterIndex}-${this.row.chapterOffset}-position`);
          Text(this.row.timeLabel).fontFamily(TYPE_READER_BOOKMARK_META.fontFamily as string)
            .fontSize(TYPE_READER_BOOKMARK_META.fontSizeFp).maxFontScale(this.fontScale())
            .fontColor(readerAppColor('TOK_READ_MUTED', this.appThemeScheme)).maxLines(1)
            .id(`reader-verify-bookmark-${this.row.chapterIndex}-${this.row.chapterOffset}-time`);
        }.width('100%').height(14 * this.fontScale()).margin({ top: 4 });
      }

      Row({ space: 8 }) {
        Text('')
          .width(1)
          .height(26 * this.fontScale())
          .backgroundColor(readerAppColor('app.bookmark.excerptAccent', this.appThemeScheme))
          .borderRadius(1);
        Text(this.row.excerpt)
          .layoutWeight(1)
          .constraintSize({ minWidth: 0 })
          .fontFamily(TYPE_READER_BOOKMARK_EXCERPT_LEGACY.fontFamily)
          .fontWeight(TYPE_READER_BOOKMARK_EXCERPT_LEGACY.fontWeight)
          .fontSize(TYPE_READER_BOOKMARK_EXCERPT_LEGACY.fontSizeFp).maxFontScale(this.fontScale())
          .lineHeight(TYPE_READER_BOOKMARK_EXCERPT_LEGACY.lineHeightFp as number)
          .fontColor(readerAppColor('TOK_READ_MUTED', this.appThemeScheme))
          .maxLines(2)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
          .id(`reader-verify-bookmark-${this.row.chapterIndex}-${this.row.chapterOffset}-excerpt`);
      }
      .width('100%')
      .height(28 * this.fontScale())
      .margin({ top: 7 })
      .alignItems(VerticalAlign.Center);

      Text('')
        .width('100%')
        .height(1)
        .margin({ top: 13 })
        .backgroundColor(readerAppColor('TOK_LINE', this.appThemeScheme))
        .id(`reader-verify-bookmark-${this.row.chapterIndex}-${this.row.chapterOffset}-divider`);
    }
    .width('100%')
    .height(this.rowHeight())
    .padding({ left: 10, right: 10 })
    .id(`reader-verify-bookmark-${this.row.chapterIndex}-${this.row.chapterOffset}-card`)
    .accessibilityText(`打开书签：${this.row.chapterTitle} ${this.row.positionLabel}`)
      .responseRegion( readerActionTouchRegion('100%', this.rowHeight()))
      .attributeModifier(new ReaderActionAccessibility(`打开书签：${this.row.chapterTitle} ${this.row.positionLabel}`, true, false))
    .onClick((): void =>
      this.onSelectBookmark(this.row.bookmarkId, this.row.chapterIndex, this.row.chapterOffset, this.row.positionScope));
  }
}
