// BookDetailComponents — book-detail skeleton ported from render-runtime.js
// libraryScreen() DOM: .fd-book-hero (cover + identity) → .fd-book-summary-card →
// .fd-chapter-list. Action buttons (继续阅读/移除书架) live in LibraryShell's
// bottomActionHost, not content.
import { ColorTokens } from '../../contract/generated/ColorTokens';
import { DemoAliasTokens } from '../../contract/generated/DemoAliasTokens';
import { ReaderTypography } from '../tokens/ReaderTypography';
import { ReaderUiStore } from '../store/ReaderUiStore';
import { BookDetail } from '../store/ReaderUiState';

// .fd-book-hero.fd-book-detail-hero: card — img cover (left) + .fd-book-identity
//   (h2 title + p author + dl facts + inline source row).
@Component
export struct BookHero {
  @StorageProp('reader.currentBook') currentBook: BookDetail | null = null;

  build() {
    Row() {
      Image($r('app.media.bookshelf_cover_three_body'))
        .width(96).height(144)
        .objectFit(ImageFit.Cover)
        .borderRadius(DemoAliasTokens.radiusSm)
      Column() {
        Text(this.currentBook !== null ? this.currentBook.title : '三体')
          .fontSize(20)
          .fontWeight(700)
          .fontColor(ColorTokens.ink)
          .fontFamily(ReaderTypography.serifFamily())
        Text(this.currentBook !== null ? this.currentBook.author : '刘慈欣')
          .fontSize(14)
          .fontColor(ColorTokens.muted)
          .margin({ top: 4 })
        Row() {
          Text('最新：').fontSize(12).fontColor(ColorTokens.muted)
          Text(this.currentBook !== null && this.currentBook.latestChapter.length > 0
            ? this.currentBook.latestChapter : '第3部').fontSize(12).fontColor(ColorTokens.ink)
        }
        .margin({ top: 6 })
        Row() {
          Text('书源：').fontSize(12).fontColor(ColorTokens.muted)
          Text(this.currentBook !== null ? this.currentBook.sourceName : '默认书源')
            .fontSize(12).fontColor(ColorTokens.primaryDark)
            .onClick(() => ReaderUiStore.dispatch({ type: 'route-push', id: 'source-switch-results' }))
        }
        .margin({ top: 4 })
      }
      .alignItems(HorizontalAlign.Start)
      .layoutWeight(1)
      .margin({ left: 12 })
    }
    .width('100%')
    .padding(14)
    .border({ width: 1, color: ColorTokens.border })
    .borderRadius(DemoAliasTokens.radiusMd)
    .backgroundColor(DemoAliasTokens.surface)
    .shadow({ radius: 26, color: DemoAliasTokens.shadowSoftColor, offsetX: 0, offsetY: 8 })
    .alignItems(VerticalAlign.Top)
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
        : '文化大革命如火如荼地进行，叶文洁在雷达峰向宇宙发出了人类第一条信息。这是一个关于宇宙黑暗森林的故事，关于人类文明的命运与抉择。')
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
  private chapters: string[] = ['第一章 科学边界', '第二章 疯狂年代', '第三章 红岸之一'];

  build() {
    Column() {
      Row() {
        Text('章节信息')
          .fontSize(15)
          .fontWeight(700)
          .fontColor(ColorTokens.ink)
        Blank()
        Text('完整目录')
          .fontSize(12)
          .fontWeight(850)
          .fontColor(ColorTokens.primaryDark)
          .onClick(() => ReaderUiStore.dispatch({ type: 'route-push', id: 'book-directory' }))
      }
      .width('100%')
      .margin({ bottom: 8 })
      ForEach(this.chapters, (c: string, i: number) => {
        Row() {
          Text(c)
            .fontSize(13)
            .fontColor(ColorTokens.controlInk)
            .layoutWeight(1)
          Image($r('app.media.reader_icon_more_dark')).width(16).height(16)
        }
        .width('100%')
        .padding({ top: 10, bottom: 10 })
        .border(i > 0 ? { width: { top: 1 }, color: ColorTokens.border } : { width: 0 })
        .alignItems(VerticalAlign.Center)
        .onClick(() => {
          // If we have a real chapter URL from the detail page, load it;
          // otherwise fall back to fixture reader route.
          if (this.currentBook !== null && this.currentBook.chapterListUrl.length > 0 && i === 0) {
            ReaderUiStore.dispatch({ type: 'chapter-load', chapterId: this.currentBook.chapterListUrl });
            ReaderUiStore.dispatch({ type: 'route-push', id: 'reader' });
          } else {
            ReaderUiStore.dispatch({ type: 'route-push', id: 'reader' });
          }
        })
      }, (c: string, i: number) => `${c}-${i}`)
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
