// BookDetailComponents — book-detail skeleton ported from render-runtime.js
// libraryScreen() DOM: .fd-book-hero (cover + identity) → .fd-book-summary-card →
// .fd-chapter-list. Action buttons (继续阅读/移除书架) live in LibraryShell's
// bottomActionHost, not content.
import { ReaderUiVisualTokens } from '../../contract/reader_ui/VisualAdmission';
import { ReaderUiStore } from '../store/ReaderUiStore';
import { BookDetail, ChapterTocEntry, canSwitchBookSourceId } from '../store/ReaderUiState';
import { MotionAdapter } from '../adapters/MotionAdapter';
import { ViewportAdapter } from '../adapters/ViewportAdapter';
import { SourceCoverImage } from './SourceCoverImage';

interface BookFactEntry {
  label: string;
  value: string;
}

// .fd-book-facts: grid (gap 5, margin-top 10) of label/value rows.
//   Each row: dt 11px/800 muted (34px) + dd 12px/1.35 ink (1fr).
@Component
struct BookFacts {
  @Prop facts: BookFactEntry[] = [];

  build() {
    Column({ space: 5 }) {
      ForEach(this.facts, (f: BookFactEntry) => {
        Row({ space: 8 }) {
          Text(f.label)
            .fontSize(11)
            .fontWeight(800)
            .fontColor(ReaderUiVisualTokens.bookDetailMuted)
            .fontFamily(ReaderUiVisualTokens.bookDetailControlFontFamily)
            .width(34)
          Text(f.value)
            .fontSize(12)
            .fontColor(ReaderUiVisualTokens.bookDetailInk)
            .fontFamily(ReaderUiVisualTokens.bookDetailControlFontFamily)
            .lineHeight(12 * 1.35)
            .layoutWeight(1)
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
        }
        .width('100%')
        .alignItems(VerticalAlign.Center)
      }, (f: BookFactEntry, i: number) => `fact-${i}`)
    }
    .width('100%')
    .margin({ top: 10 })
  }
}

// .fd-book-hero.fd-book-detail-hero: card — img cover (left) + .fd-book-identity
//   (h2 title + p author + dl facts + inline source row).
@Component
export struct BookHero {
  @StorageProp('reader.currentBook') currentBook: BookDetail | null = null;
  // B1 P0：路由跳转用 MotionAdapter.apply 包裹，motionId 取 LibraryShell 的 app.route.push.forward
  @StorageProp('reader.reducedMotion') reducedMotion: boolean = false;

  private facts(): BookFactEntry[] {
    const book = this.currentBook;
    const facts: BookFactEntry[] = [];
    if (book === null) return facts;
    if (book.latestChapter.length > 0) {
      facts.push({ label: '最新', value: book.latestChapter });
    }
    return facts;
  }

  private openSourceSwitch(): void {
    if (!canSwitchBookSourceId(this.currentBook?.sourceId)) return;
    MotionAdapter.apply('app.route.push.forward', this.reducedMotion, this.getUIContext(), () => {
      ReaderUiStore.requestSourceSwitchOpen();
    });
  }

  build() {
    if (this.currentBook !== null) {
      Column() {
        Row({ space: 14 }) {
          Stack() {
            SourceCoverImage({
              sourceId: this.currentBook.sourceId ?? '',
              coverUrl: this.currentBook.coverUrl ?? '',
            })
          }
          .width(86)
          .height(122)
          .borderRadius(6)
          Column() {
            Text(this.currentBook.title)
              .fontSize(22)
              .lineHeight(22 * 1.18)
              .fontWeight(700)
              .fontColor(ReaderUiVisualTokens.bookDetailInk)
              .fontFamily(ReaderUiVisualTokens.bookDetailTitleFontFamily)
              .maxLines(1)
              .textOverflow({ overflow: TextOverflow.Ellipsis })
            if (this.currentBook.author.length > 0) {
              Text(this.currentBook.author)
                .fontSize(13)
                .lineHeight(13 * 1.35)
                .fontColor(ReaderUiVisualTokens.bookDetailMuted)
                .fontFamily(ReaderUiVisualTokens.bookDetailControlFontFamily)
                .maxLines(1)
                .textOverflow({ overflow: TextOverflow.Ellipsis })
                .margin({ top: 8 })
            }
            if (this.facts().length > 0) {
              BookFacts({ facts: this.facts() })
            }
            if (canSwitchBookSourceId(this.currentBook.sourceId) && this.currentBook.sourceName.length > 0) {
              Row({ space: 8 }) {
                Text(`书源：${this.currentBook.sourceName}`)
                  .fontSize(12)
                  .fontWeight(700)
                  .fontColor(ReaderUiVisualTokens.bookDetailMuted)
                  .fontFamily(ReaderUiVisualTokens.bookDetailControlFontFamily)
                  .layoutWeight(1)
                  .maxLines(1)
                  .textOverflow({ overflow: TextOverflow.Ellipsis })
                Text('更换书源')
                  .fontSize(9)
                  .fontWeight(900)
                  .fontColor(ReaderUiVisualTokens.bookDetailSourceSwitchInk)
                  .fontFamily(ReaderUiVisualTokens.bookDetailControlFontFamily)
                  .height(18)
                  .padding({ left: 8, right: 8 })
                  .borderRadius(999)
                  .backgroundColor(ReaderUiVisualTokens.bookDetailSourceSwitchSurface)
                  .textAlign(TextAlign.Center)
                  .onClick(() => this.openSourceSwitch())
              }
              .width('100%')
              .alignItems(VerticalAlign.Center)
              .margin({ top: 8 })
            }
          }
          .alignItems(HorizontalAlign.Start)
          .layoutWeight(1)
          .height(122)
        }
        .width('100%')
        .alignItems(VerticalAlign.Top)
      }
      .width('100%')
      .height(152)
      .padding(14)
      .border({ width: 1, color: ReaderUiVisualTokens.bookDetailSectionBorder })
      .borderRadius(8)
      .backgroundColor(ReaderUiVisualTokens.bookDetailSectionSurface)
      .alignItems(HorizontalAlign.Center)
    } else {
      // There is no Figma "no selected book" hero. Do not substitute an
      // instructional card while the Core-backed book identity is absent.
      Column().width(0).height(0)
    }
  }
}

// .fd-book-summary-card: card — h2 "简介" 15 + p 13 muted line-clamp 4 (1.65).
@Component
export struct BookSummaryCard {
  @StorageProp('reader.currentBook') currentBook: BookDetail | null = null;
  @StorageProp(ViewportAdapter.K_WIDTH) viewportWidth: number = ViewportAdapter.DEFAULT_WIDTH;
  @StorageProp(ViewportAdapter.K_HEIGHT) viewportHeight: number = ViewportAdapter.DEFAULT_HEIGHT;

  // The only responsive branches in the Book Detail Figma master are Phone
  // and Tablet.  Landscape intentionally reuses Tablet geometry.
  private cardHeight(): number {
    return ViewportAdapter.isWide(this.viewportWidth, this.viewportHeight) ? 98 : 120;
  }

  build() {
    if (this.currentBook !== null && this.currentBook.summary.length > 0) {
      Column() {
        Text('简介')
          .fontSize(15)
          .fontWeight(700)
          .fontColor(ReaderUiVisualTokens.bookDetailInk)
          .fontFamily(ReaderUiVisualTokens.bookDetailControlFontFamily)
        Text(this.currentBook.summary)
          .fontSize(13)
          .fontColor(ReaderUiVisualTokens.bookDetailMuted)
          .fontFamily(ReaderUiVisualTokens.bookDetailControlFontFamily)
          .lineHeight(13 * 1.65)
          .maxLines(4)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
          .margin({ top: 8 })
      }
      .width('100%')
      .height(this.cardHeight())
      .alignItems(HorizontalAlign.Start)
      .padding(14)
      .border({ width: 1, color: ReaderUiVisualTokens.bookDetailSectionBorder })
      .borderRadius(8)
      .backgroundColor(ReaderUiVisualTokens.bookDetailSectionSurface)
    } else {
      // Figma has no summary-error or no-book card variant.
      Column().width(0).height(0)
    }
  }
}

// .fd-chapter-list.fd-book-chapter-preview: card — header (h2 "章节信息" 15 +
//   "完整目录" button) + chapter rows (span title, min 52, border-top).
@Component
export struct BookChapterList {
  @StorageProp('reader.currentBook') currentBook: BookDetail | null = null;
  @StorageProp('reader.chapterToc') chapterToc: ChapterTocEntry[] = [];
  @StorageProp('reader.currentChapterTitle') currentChapterTitle: string = '';
  @StorageProp('reader.loading') loading: boolean = false;
  // B1 P0：路由跳转用 MotionAdapter.apply 包裹，motionId 取 LibraryShell 的 app.route.push.forward
  @StorageProp('reader.reducedMotion') reducedMotion: boolean = false;

  private previewChapters(): ChapterTocEntry[] {
    const entries: ChapterTocEntry[] = [];
    const limit = Math.min(4, this.chapterToc.length);
    for (let i = 0; i < limit; i++) {
      entries.push(this.chapterToc[i]);
    }
    return entries;
  }

  private hasDirectory(): boolean {
    return this.currentBook !== null && this.chapterToc.length > 0;
  }

  private isCurrent(chapter: ChapterTocEntry): boolean {
    return this.currentChapterTitle.length > 0 && chapter.title === this.currentChapterTitle;
  }

  private openDirectory(): void {
    if (!this.hasDirectory()) return;
    MotionAdapter.apply('app.route.push.forward', this.reducedMotion, this.getUIContext(), () => {
      ReaderUiStore.dispatch({ type: 'route-push', id: 'book-directory' });
    });
  }

  private openChapter(chapter: ChapterTocEntry): void {
    const book = this.currentBook;
    if (book === null || chapter.chapterId.length === 0) return;
    MotionAdapter.apply('app.route.push.forward', this.reducedMotion, this.getUIContext(), () => {
      // The reader route is entered before the asynchronous load so the visible
      // loading state belongs to the selected, real chapter rather than a demo row.
      ReaderUiStore.dispatch({ type: 'route-push', id: 'immersive-reading' });
      ReaderUiStore.dispatch({
        type: 'chapter-load', chapterId: chapter.chapterId, bookId: book.bookId, chapterTitle: chapter.title,
      });
    });
  }

  build() {
    if (this.hasDirectory()) {
      Column() {
      Row() {
        Text('章节信息')
          .fontSize(15)
          .fontWeight(700)
          .fontColor(ReaderUiVisualTokens.bookDetailInk)
          .fontFamily(ReaderUiVisualTokens.bookDetailControlFontFamily)
        Blank()
        if (this.hasDirectory()) {
          Row({ space: 4 }) {
            Image($r('app.media.ui_icon_list_primary')).width(20).height(20)
            Text('完整目录')
              .fontSize(12)
              .fontWeight(900)
              .fontColor(ReaderUiVisualTokens.bookDetailActionPrimary)
              .fontFamily(ReaderUiVisualTokens.bookDetailControlFontFamily)
          }
          .width(94)
          .height(30)
          .padding({ left: 10, right: 10 })
          .borderRadius(999)
          .border({ width: 1, color: ReaderUiVisualTokens.bookDetailSectionBorder })
          .backgroundColor(ReaderUiVisualTokens.bookDetailActionSecondarySurface)
          .alignItems(VerticalAlign.Center)
          .onClick(() => this.openDirectory())
        }
      }
      .width('100%')
      .height(48)
      .padding({ left: 14, right: 14 })
      ForEach(this.previewChapters(), (chapter: ChapterTocEntry, i: number) => {
          Stack({ alignContent: Alignment.TopStart }) {
            if (this.isCurrent(chapter)) {
              Column()
                .width('100%')
                .height(58)
                .backgroundColor(ReaderUiVisualTokens.bookDetailChapterSelectedSurface)
            }
            Row({ space: 8 }) {
              Text(chapter.title)
                .fontSize(14)
                .fontColor(ReaderUiVisualTokens.bookDetailInk)
                .fontFamily(ReaderUiVisualTokens.bookDetailControlFontFamily)
                .maxLines(1)
                .textOverflow({ overflow: TextOverflow.Ellipsis })
                .layoutWeight(1)
            }
            .width('100%')
            .height(58)
            .padding({ left: 14, right: 14 })
            .alignItems(VerticalAlign.Center)
            if (this.isCurrent(chapter)) {
              Column()
                .width(3)
                .height(58)
                .backgroundColor(ReaderUiVisualTokens.bookDetailChapterCurrentIndicator)
            }
          }
          .width('100%')
          .height(58)
          .border({ width: { top: 1 }, color: ReaderUiVisualTokens.bookDetailChapterDivider })
          .onClick(() => this.openChapter(chapter))
      }, (chapter: ChapterTocEntry, i: number) => `${chapter.chapterId}-${i}`)
      }
      .width('100%')
      .height(282)
      .alignItems(HorizontalAlign.Start)
      .padding(0)
      .border({ width: 1, color: ReaderUiVisualTokens.bookDetailSectionBorder })
      .borderRadius(8)
      .backgroundColor(ReaderUiVisualTokens.bookDetailSectionSurface)
    } else {
      // Loading/error variants are supplied through the bound StateHost; the
      // content master itself never becomes a locally written status card.
      Column().width(0).height(0)
    }
  }
}
