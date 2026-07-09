// BookDetailComponents — book-detail skeleton ported from render-runtime.js
// libraryScreen() DOM: .fd-book-hero (cover + identity) → .fd-book-summary-card →
// .fd-chapter-list. Action buttons (继续阅读/移除书架) live in LibraryShell's
// bottomActionHost, not content.
import { ColorTokens } from '../../contract/generated/ColorTokens';
import { DemoAliasTokens } from '../../contract/generated/DemoAliasTokens';
import { ReaderTypography } from '../tokens/ReaderTypography';
import { ReaderUiStore } from '../store/ReaderUiStore';
import { BookDetail } from '../store/ReaderUiState';

interface ChapterPreviewEntry {
  title: string;
  cached: boolean;
  bookmarked: boolean;
  current: boolean;
}

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

  build() {
    Row({ space: 14 }) {
      Image($r('app.media.bookshelf_cover_long_night'))
        .width(86)
        .height(122)
        .objectFit(ImageFit.Cover)
        .borderRadius(DemoAliasTokens.radiusSm)
        .shadow({ radius: 16, color: DemoAliasTokens.shadowElevatedColor, offsetX: 0, offsetY: 8 })
      Column() {
        Text(this.currentBook !== null ? this.currentBook.title : '长夜余火')
          .fontSize(22)
          .lineHeight(22 * 1.18)
          .fontWeight(700)
          .fontColor(ColorTokens.ink)
          .fontFamily(ReaderTypography.serifFamily())
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
        Text(this.currentBook !== null ? this.currentBook.author : '爱潜水的乌贼')
          .fontSize(13)
          .lineHeight(13 * 1.35)
          .fontColor(ColorTokens.muted)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
          .margin({ top: 8 })
        BookFacts({
          facts: [
            { label: '最新', value: this.currentBook !== null && this.currentBook.latestChapter.length > 0
                ? this.currentBook.latestChapter : '第 32 章 雨夜' },
            { label: '字数', value: '128.4 万' },
            { label: '状态', value: '连载中' },
            { label: '来源', value: this.currentBook !== null ? this.currentBook.sourceName : '优书网' },
            { label: '分类', value: '悬疑 · 推理' }
          ]
        })
        Row({ space: 8 }) {
          Text(`书源：${this.currentBook !== null ? this.currentBook.sourceName : '优书网'}`)
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
            .onClick(() => ReaderUiStore.dispatch({ type: 'route-push', id: 'source-switch' }))
        }
        .width('100%')
        .alignItems(VerticalAlign.Center)
        .margin({ top: 8 })
      }
      .alignItems(HorizontalAlign.Start)
      .layoutWeight(1)
      .height(122)
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
        : '旧世界的余烬尚未冷却，新的秩序已经在废墟之上生长。主角沿着被遗忘的线索追寻真相，也在一次次选择里确认自己想守住的东西。')
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
  private chapters: ChapterPreviewEntry[] = [
    { title: '第 30 章 旧日', cached: true, bookmarked: false, current: false },
    { title: '第 31 章 归途', cached: true, bookmarked: true, current: false },
    { title: '第 32 章 雨夜', cached: false, bookmarked: true, current: true },
    { title: '第 33 章 灯塔', cached: false, bookmarked: false, current: false },
  ];

  build() {
    Column() {
      Row() {
        Text('章节信息')
          .fontSize(15)
          .fontWeight(700)
          .fontColor(ColorTokens.ink)
        Blank()
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
        .onClick(() => ReaderUiStore.dispatch({ type: 'route-push', id: 'book-directory' }))
      }
      .width('100%')
      .height(48)
      .padding({ left: 14, right: 14 })
      ForEach(this.chapters, (c: ChapterPreviewEntry, i: number) => {
        Row() {
          Text(c.title)
            .fontSize(14)
            .fontColor(c.current ? ColorTokens.accent : ColorTokens.controlInk)
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
            .layoutWeight(1)
          Row({ space: 6 }) {
            Stack({ alignContent: Alignment.Center }) {
              if (c.cached) {
                Image($r('app.media.ui_icon_check_primary')).width(13).height(13)
              }
            }
            .width(26)
            .height(26)
            .borderRadius(DemoAliasTokens.radiusPill)
            .backgroundColor(c.cached ? ColorTokens.surfaceSoft : ColorTokens.metaBg)

            Stack({ alignContent: Alignment.Center }) {
              if (c.bookmarked) {
                Image($r('app.media.ui_icon_bookmark_primary')).width(13).height(13)
              }
            }
            .width(26)
            .height(26)
            .borderRadius(DemoAliasTokens.radiusPill)
            .backgroundColor(c.bookmarked ? ColorTokens.surfaceSoft : ColorTokens.metaBg)
          }
          .width(64)
          .justifyContent(FlexAlign.End)
        }
        .width('100%')
        .height(58)
        .padding({ left: 14, right: 14 })
        .border({ width: { top: 1 }, color: ColorTokens.border })
        .alignItems(VerticalAlign.Center)
        .onClick(() => {
          // route-push first (resets pageState='default'), then chapter-load
          // switches pageState='loading' on the immersive reader route.
          ReaderUiStore.dispatch({ type: 'route-push', id: 'immersive-reading' });
          if (this.currentBook !== null && this.currentBook.chapterListUrl.length > 0 && i === 0) {
            ReaderUiStore.dispatch({ type: 'chapter-load', chapterId: this.currentBook.chapterListUrl });
          }
        })
      }, (c: ChapterPreviewEntry, i: number) => `${c.title}-${i}`)
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
