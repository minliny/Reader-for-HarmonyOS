// BookDetailComponents — book-detail skeleton ported from render-runtime.js
// libraryScreen() DOM: .fd-book-hero (cover + identity) → .fd-book-summary-card →
// .fd-chapter-list. Action buttons (继续阅读/移除书架) live in LibraryShell's
// bottomActionHost, not content.
import { ColorTokens } from '../../contract/generated/ColorTokens';
import { DemoAliasTokens } from '../../contract/generated/DemoAliasTokens';
import { ReaderTypography } from '../tokens/ReaderTypography';
import { ReaderUiStore } from '../store/ReaderUiStore';
import { BookDetail, ChapterTocEntry } from '../store/ReaderUiState';
import { MotionAdapter } from '../adapters/MotionAdapter';
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
            .fontColor(ColorTokens.muted)
            .width(34)
          Text(f.value)
            .fontSize(12)
            .fontColor(ColorTokens.controlInk)
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
    if (book.sourceName.length > 0) {
      facts.push({ label: '来源', value: book.sourceName });
    }
    return facts;
  }

  private openSourceSwitch(): void {
    if (this.currentBook === null) return;
    MotionAdapter.apply('app.route.push.forward', this.reducedMotion, this.getUIContext(), () => {
      ReaderUiStore.dispatch({ type: 'route-push', id: 'source-switch' });
    });
  }

  build() {
    Column() {
      if (this.currentBook === null) {
        Row({ space: 14 }) {
          Column()
            .width(86)
            .height(122)
            .borderRadius(DemoAliasTokens.radiusSm)
            .backgroundColor(ColorTokens.metaBg)
          Column({ space: 8 }) {
            Text('未选择书籍')
              .fontSize(20)
              .fontWeight(700)
              .fontColor(ColorTokens.ink)
              .fontFamily(ReaderTypography.serifFamily())
            Text('请从书架、搜索或发现结果打开一本书。')
              .fontSize(13)
              .lineHeight(13 * 1.5)
              .fontColor(ColorTokens.muted)
              .maxLines(3)
          }
          .alignItems(HorizontalAlign.Start)
          .layoutWeight(1)
          .justifyContent(FlexAlign.Center)
        }
        .width('100%')
        .height(122)
        .alignItems(VerticalAlign.Center)
      } else {
        Row({ space: 14 }) {
          Stack() {
            SourceCoverImage({
              sourceId: this.currentBook.sourceId ?? '',
              coverUrl: this.currentBook.coverUrl ?? '',
            })
          }
          .width(86)
          .height(122)
          .borderRadius(DemoAliasTokens.radiusSm)
          .shadow({ radius: 16, color: DemoAliasTokens.shadowElevatedColor, offsetX: 0, offsetY: 8 })
          Column() {
            Text(this.currentBook.title.length > 0 ? this.currentBook.title : '未命名书籍')
              .fontSize(22)
              .lineHeight(22 * 1.18)
              .fontWeight(700)
              .fontColor(ColorTokens.ink)
              .fontFamily(ReaderTypography.serifFamily())
              .maxLines(1)
              .textOverflow({ overflow: TextOverflow.Ellipsis })
            if (this.currentBook.author.length > 0) {
              Text(this.currentBook.author)
                .fontSize(13)
                .lineHeight(13 * 1.35)
                .fontColor(ColorTokens.muted)
                .maxLines(1)
                .textOverflow({ overflow: TextOverflow.Ellipsis })
                .margin({ top: 8 })
            }
            if (this.currentBook.latestChapter.length > 0) {
              Row({ space: 8 }) {
                Text('最新')
                  .fontSize(11)
                  .fontWeight(800)
                  .fontColor(ColorTokens.muted)
                  .width(34)
                Text(this.currentBook.latestChapter)
                  .fontSize(12)
                  .fontColor(ColorTokens.ink)
                  .lineHeight(12 * 1.35)
                  .layoutWeight(1)
                  .maxLines(1)
                  .textOverflow({ overflow: TextOverflow.Ellipsis })
              }
              .width('100%')
              .alignItems(VerticalAlign.Center)
              .margin({ top: 10 })
            }
            if (this.facts().length > 0) {
              BookFacts({ facts: this.facts() })
            }
            if (this.currentBook.sourceName.length > 0) {
              Row({ space: 8 }) {
                Text(`书源：${this.currentBook.sourceName}`)
                  .fontSize(12)
                  .fontWeight(700)
                  .fontColor(ColorTokens.muted)
                  .maxLines(1)
                  .textOverflow({ overflow: TextOverflow.Ellipsis })
                Text('更换书源')
                  .fontSize(9)
                  .fontWeight(900)
                  .fontColor(ColorTokens.primary)
                  .height(18)
                  .padding({ left: 8, right: 8 })
                  .borderRadius(DemoAliasTokens.radiusPill)
                  .backgroundColor(ColorTokens.surfaceSoft)
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
    }
    .width('100%')
    .padding(14)
    .border({ width: 1, color: ColorTokens.border })
    .borderRadius(DemoAliasTokens.radiusMd)
    .backgroundColor(DemoAliasTokens.surface)
    .shadow({ radius: 26, color: DemoAliasTokens.shadowSoftColor, offsetX: 0, offsetY: 8 })
    .alignItems(HorizontalAlign.Center)
  }
}

// .fd-book-summary-card: card — h2 "简介" 15 + p 13 muted line-clamp 4 (1.65).
@Component
export struct BookSummaryCard {
  @StorageProp('reader.currentBook') currentBook: BookDetail | null = null;

  build() {
    Column() {
      Text('简介')
        .fontSize(15)
        .fontWeight(700)
        .fontColor(ColorTokens.ink)
      Text(this.currentBook !== null && this.currentBook.summary.length > 0
        ? this.currentBook.summary
        : (this.currentBook === null ? '尚未选择书籍，暂无简介。' : 'Core 未返回本书简介。'))
        .fontSize(13)
        .fontColor(ColorTokens.muted)
        .lineHeight(13 * 1.65)
        .maxLines(4)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
        .margin({ top: 8 })
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
    .padding(14)
    .border({ width: 1, color: ColorTokens.border })
    .borderRadius(DemoAliasTokens.radiusMd)
    .backgroundColor(DemoAliasTokens.surface)
    .shadow({ radius: 26, color: DemoAliasTokens.shadowSoftColor, offsetX: 0, offsetY: 8 })
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

  private directoryStatus(): string {
    if (this.currentBook === null) return '尚未选择书籍，无法显示章节目录。';
    return this.loading ? '正在从 Core 加载章节目录…' : '暂无从 Core 返回的章节目录。';
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
    Column() {
      Row() {
        Text('章节信息')
          .fontSize(15)
          .fontWeight(700)
          .fontColor(ColorTokens.ink)
        Blank()
        if (this.hasDirectory()) {
          Row({ space: 5 }) {
            Image($r('app.media.ui_icon_list_primary')).width(16).height(16)
            Text('完整目录')
              .fontSize(12)
              .fontWeight(850)
              .fontColor(ColorTokens.primaryDark)
          }
          .height(30)
          .padding({ left: 10, right: 10 })
          .borderRadius(DemoAliasTokens.radiusPill)
          .border({ width: 1, color: ColorTokens.border })
          .alignItems(VerticalAlign.Center)
          .onClick(() => this.openDirectory())
        } else {
          Text('目录未就绪')
            .fontSize(12)
            .fontWeight(700)
            .fontColor(ColorTokens.muted)
        }
      }
      .width('100%')
      .height(48)
      .padding({ left: 14, right: 14 })
      if (!this.hasDirectory()) {
        Text(this.directoryStatus())
          .fontSize(12)
          .fontColor(ColorTokens.muted)
          .lineHeight(18)
          .width('100%')
          .padding({ left: 14, right: 14, top: 14, bottom: 14 })
      } else {
        ForEach(this.previewChapters(), (chapter: ChapterTocEntry, i: number) => {
          Row({ space: 8 }) {
            Text(chapter.title)
              .fontSize(14)
              .fontColor(this.isCurrent(chapter) ? ColorTokens.accent : ColorTokens.controlInk)
              .maxLines(1)
              .textOverflow({ overflow: TextOverflow.Ellipsis })
              .layoutWeight(1)
            if (this.isCurrent(chapter)) {
              Text('当前')
                .fontSize(10)
                .fontWeight(800)
                .fontColor(ColorTokens.primaryDark)
                .padding({ left: 8, right: 8, top: 4, bottom: 4 })
                .borderRadius(DemoAliasTokens.radiusPill)
                .backgroundColor(ColorTokens.surfaceSoft)
            }
          }
          .width('100%')
          .height(58)
          .padding({ left: 14, right: 14 })
          .border({ width: { top: 1 }, color: ColorTokens.border })
          .alignItems(VerticalAlign.Center)
          .onClick(() => this.openChapter(chapter))
        }, (chapter: ChapterTocEntry, i: number) => `${chapter.chapterId}-${i}`)
      }
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
    .padding(0)
    .border({ width: 1, color: ColorTokens.border })
    .borderRadius(DemoAliasTokens.radiusMd)
    .backgroundColor(DemoAliasTokens.surface)
    .shadow({ radius: 26, color: DemoAliasTokens.shadowSoftColor, offsetX: 0, offsetY: 8 })
  }
}
