// ContractComponents — native renderers for the contract ComponentType enum
// entries used by view-state.fixtures.json that had no native struct. Phase 1
// renderers consume the fixture props that affect visible labels/counts where
// practical, while keeping richer data wiring as a later reducer/ViewState slice.
// Names match the contract
// enum 1:1 so DemoViewState can cite them directly from the fixture trees.
// Existing contract-named structs that already live in the domain files
// (BookCard / BookCover / ShelfSectionHeader / ShelfChipGroup / SettingsSection
// / SettingsListItem) are wired via ViewStateRenderer branches, not duplicated here.
import { ColorTokens } from '../../contract/generated/ColorTokens';
import { DemoAliasTokens } from '../../contract/generated/DemoAliasTokens';
import { SpacingTokens } from '../../contract/generated/DimensionTokens';
import { ReaderTypography } from '../tokens/ReaderTypography';
import { ReaderUiStore } from '../store/ReaderUiStore';
import { SearchResultEntry, BookDetail } from '../store/ReaderUiState';

// ── Bookshelf / book ───────────────────────────────────────────────────────

@Component
export struct ProgressBar {
  @Prop progress: number = 0.42;

  build() {
    Row() {
      Column().width(`${Math.round(this.progress * 100)}%`).height(4).backgroundColor(ColorTokens.primary)
      Blank().layoutWeight(1)
    }
    .width('100%').height(4)
    .backgroundColor(ColorTokens.metaBg)
    .borderRadius(DemoAliasTokens.radiusPill)
  }
}

@Component
export struct BookTitleAuthor {
  @Prop title: string = '三体';
  @Prop author: string = '刘慈欣';
  @StorageProp('reader.currentBook') currentBook: BookDetail | null = null;

  // Prefer real data from the reducer; fall back to the @Prop fixture passed
  // by ViewStateRenderer so the page still renders in demo flows.
  private displayTitle(): string {
    return this.currentBook !== null && this.currentBook.title.length > 0
      ? this.currentBook.title : this.title;
  }
  private displayAuthor(): string {
    return this.currentBook !== null && this.currentBook.author.length > 0
      ? this.currentBook.author : this.author;
  }

  build() {
    Column() {
      Text(this.displayTitle())
        .fontSize(20).fontWeight(700).fontColor(ColorTokens.ink)
        .fontFamily(ReaderTypography.serifFamily())
      Text(this.displayAuthor())
        .fontSize(14).fontColor(ColorTokens.muted)
        .margin({ top: 4 })
    }
    .width('100%').alignItems(HorizontalAlign.Start)
  }
}

@Component
export struct SourceStatus {
  @StorageProp('reader.currentBook') currentBook: BookDetail | null = null;

  private sourceName(): string {
    return this.currentBook !== null && this.currentBook.sourceName.length > 0
      ? this.currentBook.sourceName : '默认书源';
  }

  build() {
    Row() {
      Text('书源：').fontSize(12).fontColor(ColorTokens.muted)
      Text(this.sourceName()).fontSize(12).fontColor(ColorTokens.primaryDark)
        .onClick(() => ReaderUiStore.dispatch({ type: 'route-push', id: 'source-switch-results' }))
    }
    .width('100%').alignItems(VerticalAlign.Center)
  }
}

@Component
export struct ReadButton {
  @Prop label: string = '开始阅读';
  @StorageProp('reader.currentBook') currentBook: BookDetail | null = null;

  build() {
    Text(this.label)
      .fontSize(13).fontWeight(800).fontColor(DemoAliasTokens.onPrimary)
      .backgroundColor(ColorTokens.primary)
      .borderRadius(DemoAliasTokens.radiusPill)
      .height(40).padding({ left: 18, right: 18 })
      .onClick(() => {
        // route-push first (resets pageState='default'), then chapter-load
        // switches pageState='loading' so reader/loading ViewState renders.
        ReaderUiStore.dispatch({ type: 'route-push', id: 'reader' });
        if (this.currentBook !== null && this.currentBook.chapterListUrl.length > 0) {
          ReaderUiStore.dispatch({ type: 'chapter-load', chapterId: this.currentBook.chapterListUrl });
        }
      })
  }
}

@Component
export struct DirectoryPreview {
  @StorageProp('reader.currentBook') currentBook: BookDetail | null = null;
  private fixtureChapters: string[] = ['第一章 科学边界', '第二章 疯狂年代', '第三章 红岸之一'];

  // currentBook only carries latestChapter (a single string, not a full TOC).
  // Show it as the first preview row; keep fixture rows as placeholders for the
  // rest of the TOC. Real TOC list migration is a later phase.
  private previewChapters(): string[] {
    if (this.currentBook !== null && this.currentBook.latestChapter.length > 0) {
      const rest: string[] = this.fixtureChapters.slice(1);
      return [this.currentBook.latestChapter].concat(rest);
    }
    return this.fixtureChapters;
  }

  build() {
    Column() {
      Row() {
        Text('目录').fontSize(15).fontWeight(700).fontColor(ColorTokens.ink)
        Blank()
        Text('完整目录').fontSize(12).fontColor(ColorTokens.primaryDark)
          .onClick(() => ReaderUiStore.dispatch({ type: 'route-push', id: 'book-directory' }))
      }.width('100%').margin({ bottom: 6 })
      ForEach(this.previewChapters(), (c: string, i: number) => {
        Text(c).fontSize(13).fontColor(ColorTokens.controlInk)
          .width('100%').padding({ top: 8, bottom: 8 })
          .border(i > 0 ? { width: { top: 1 }, color: ColorTokens.border } : { width: 0 })
      }, (c: string, i: number) => `${c}-${i}`)
    }
    .width('100%').alignItems(HorizontalAlign.Start)
  }
}

@Component
export struct BookIntro {
  @StorageProp('reader.currentBook') currentBook: BookDetail | null = null;

  private summary(): string {
    return this.currentBook !== null && this.currentBook.summary.length > 0
      ? this.currentBook.summary
      : '文化大革命如火如荼地进行，叶文洁在雷达峰向宇宙发出了人类第一条信息。';
  }

  build() {
    Column() {
      Text('简介').fontSize(15).fontWeight(700).fontColor(ColorTokens.ink)
      Text(this.summary())
        .fontSize(13).fontColor(ColorTokens.muted).lineHeight(13 * 1.65)
        .maxLines(4).textOverflow({ overflow: TextOverflow.Ellipsis }).margin({ top: 8 })
    }
    .width('100%').alignItems(HorizontalAlign.Start)
  }
}

@Component
export struct ConfigEntry {
  build() {
    Row() {
      Text('阅读设置').fontSize(13).fontWeight(800).fontColor(ColorTokens.ink).layoutWeight(1)
      Image($r('app.media.reader_icon_more_dark')).width(20).height(20)
    }
    .width('100%').height(48).padding({ left: 14, right: 14 })
    .border({ width: { top: 1 }, color: ColorTokens.border }).alignItems(VerticalAlign.Center)
    .backgroundColor(DemoAliasTokens.surface)
  }
}

// ── Discover ───────────────────────────────────────────────────────────────

@Component
export struct SearchEntry {
  build() {
    Row() {
      Image($r('app.media.bookshelf_icon_search_dark')).width(20).height(20)
      Text('搜索书名/作者').fontSize(14).fontColor(ColorTokens.muted).margin({ left: 10 })
    }
    .width('100%').height(44).padding({ left: 14, right: 14 })
    .borderRadius(DemoAliasTokens.radiusPill).backgroundColor(DemoAliasTokens.surface)
    .border({ width: 1, color: ColorTokens.border }).alignItems(VerticalAlign.Center)
  }
}

@Component
export struct SourceTypeSegment {
  private segs: string[] = ['全部', '书源', '规则'];
  private active: string = '全部';
  build() {
    Row() {
      ForEach(this.segs, (s: string) => {
        Text(s)
          .fontSize(13).fontWeight(700)
          .fontColor(s === this.active ? DemoAliasTokens.onPrimary : ColorTokens.controlInk)
          .backgroundColor(s === this.active ? ColorTokens.primary : ColorTokens.metaBg)
          .height(32).padding({ left: 14, right: 14 })
          .borderRadius(DemoAliasTokens.radiusSm).margin({ right: 8 })
      }, (s: string) => s)
    }
    .width('100%')
  }
}

@Component
export struct CurrentSourceCard {
  build() {
    Row() {
      Stack().width(34).height(34).borderRadius(DemoAliasTokens.radiusPill).backgroundColor(ColorTokens.metaBg)
      Column() {
        Text('默认书源').fontSize(15).fontColor(ColorTokens.ink)
        Text('小说 · 已启用').fontSize(11).fontColor(ColorTokens.muted).margin({ top: 3 })
      }.alignItems(HorizontalAlign.Start).layoutWeight(1).margin({ left: 10 })
      Image($r('app.media.reader_icon_more_dark')).width(18).height(18)
    }
    .width('100%').height(58).padding({ left: 12, right: 12 })
    .border({ width: 1, color: ColorTokens.border }).borderRadius(DemoAliasTokens.radiusMd)
    .backgroundColor(DemoAliasTokens.surface).alignItems(VerticalAlign.Center)
  }
}

@Component
export struct SourceCategoryChips {
  private chips: string[] = ['玄幻', '都市', '科幻', '历史', '悬疑'];
  build() {
    Scroll() {
      Row() {
        ForEach(this.chips, (c: string) => {
          Text(c)
            .fontSize(12).fontWeight(800).fontColor(ColorTokens.controlInk)
            .backgroundColor(ColorTokens.metaBg).height(30).padding({ left: 12, right: 12 })
            .borderRadius(DemoAliasTokens.radiusPill).margin({ right: 7 })
        }, (c: string) => c)
      }
    }.scrollable(ScrollDirection.Horizontal).width('100%')
  }
}

@Component
export struct DiscoveryContentCard {
  build() {
    Column() {
      Text('发现内容').fontSize(15).fontWeight(700).fontColor(ColorTokens.ink)
      Text('精选好书与热门书单').fontSize(12).fontColor(ColorTokens.muted).margin({ top: 4 })
    }
    .width('100%').padding(14).alignItems(HorizontalAlign.Start)
    .border({ width: 1, color: ColorTokens.border }).borderRadius(DemoAliasTokens.radiusMd)
    .backgroundColor(DemoAliasTokens.surface)
  }
}

@Component
export struct SourceStatusBar {
  build() {
    Row() {
      Text('书源状态：').fontSize(12).fontColor(ColorTokens.muted)
      Text('已启用').fontSize(12).fontColor(ColorTokens.primary)
    }
    .width('100%').alignItems(VerticalAlign.Center)
  }
}

// ── RSS ────────────────────────────────────────────────────────────────────

@Component
export struct SubscriptionSummaryCard {
  @Prop sources: number = 25;
  @Prop unread: number = 28;

  build() {
    Row() {
      Column() {
        Text('订阅源').fontSize(15).fontColor(ColorTokens.ink)
        Text(`${this.sources} 个 · ${this.unread} 篇未读`).fontSize(11).fontColor(ColorTokens.muted).margin({ top: 3 })
      }.alignItems(HorizontalAlign.Start).layoutWeight(1)
      Text(`${this.unread}`).fontSize(24).fontWeight(900).fontColor(ColorTokens.primaryDark)
    }
    .width('100%').padding(14).alignItems(VerticalAlign.Center)
    .border({ width: 1, color: ColorTokens.border }).borderRadius(DemoAliasTokens.radiusMd)
    .backgroundColor(DemoAliasTokens.surface)
  }
}

@Component
export struct FeedStatusChips {
  private chips: string[] = ['全部', '未读', '星标'];
  private active: string = '全部';
  build() {
    Row() {
      ForEach(this.chips, (c: string) => {
        Text(c)
          .fontSize(12).fontWeight(850)
          .fontColor(c === this.active ? DemoAliasTokens.onPrimary : ColorTokens.controlInk)
          .backgroundColor(c === this.active ? ColorTokens.primary : ColorTokens.metaBg)
          .height(30).padding({ left: 12, right: 12 })
          .borderRadius(DemoAliasTokens.radiusPill).margin({ right: 6 })
      }, (c: string) => c)
    }
    .width('100%')
  }
}

@Component
export struct FeedSourceChips {
  private chips: string[] = ['Hacker News', '阮一峰博客', '菜鸟教程'];
  private active: string = 'Hacker News';
  build() {
    Scroll() {
      Row() {
        ForEach(this.chips, (c: string) => {
          Text(c)
            .fontSize(12).fontWeight(800)
            .fontColor(c === this.active ? DemoAliasTokens.onPrimary : ColorTokens.controlInk)
            .backgroundColor(c === this.active ? ColorTokens.primary : ColorTokens.metaBg)
            .height(30).padding({ left: 12, right: 12 })
            .borderRadius(DemoAliasTokens.radiusPill).margin({ right: 6 })
        }, (c: string) => c)
      }
    }.scrollable(ScrollDirection.Horizontal).width('100%')
  }
}

@Component
export struct RssEntryItem {
  @Prop title: string = 'AI 周报';

  build() {
    Row() {
      Circle().width(7).height(7).fill(ColorTokens.primary)
      Column() {
        Text(this.title).fontSize(13).fontColor(ColorTokens.ink)
        Text('Hacker News · 10:18 · 技术').fontSize(10).fontColor(ColorTokens.muted).margin({ top: 4 })
      }.alignItems(HorizontalAlign.Start).layoutWeight(1).margin({ left: 8 })
      UnreadIndicator()
    }
    .width('100%').padding({ top: 10, bottom: 10, left: 12, right: 12 })
    .border({ width: { top: 1 }, color: ColorTokens.border }).alignItems(VerticalAlign.Center)
    .onClick(() => ReaderUiStore.dispatch({ type: 'route-push', id: 'rss-detail' }))
  }
}

@Component
export struct UnreadIndicator {
  build() {
    Text('12')
      .fontSize(11).fontWeight(800).fontColor(DemoAliasTokens.onPrimary)
      .backgroundColor(ColorTokens.rssUnread)
      .borderRadius(DemoAliasTokens.radiusPill)
      .padding({ left: 6, right: 6, top: 2, bottom: 2 })
  }
}

// ── Settings ───────────────────────────────────────────────────────────────

@Component
export struct LocalOverviewCard {
  build() {
    Row() {
      Column() {
        Text('本地书籍').fontSize(15).fontColor(ColorTokens.ink)
        Text('12 本 · 已分类 3 组').fontSize(11).fontColor(ColorTokens.muted).margin({ top: 3 })
      }.alignItems(HorizontalAlign.Start).layoutWeight(1)
      Text('12').fontSize(24).fontWeight(900).fontColor(ColorTokens.primaryDark)
    }
    .width('100%').padding(14).alignItems(VerticalAlign.Center)
    .border({ width: 1, color: ColorTokens.border }).borderRadius(DemoAliasTokens.radiusMd)
    .backgroundColor(DemoAliasTokens.surface)
  }
}

@Component
export struct QuickEntryGrid {
  private entries: string[] = ['书源管理', '同步备份', '阅读设置', '关于'];
  build() {
    Grid() {
      ForEach(this.entries, (e: string, i: number) => {
        GridItem() {
          Column() {
            Stack().width(40).height(40).borderRadius(DemoAliasTokens.radiusPill).backgroundColor(ColorTokens.metaBg)
            Text(e).fontSize(12).fontColor(ColorTokens.ink).margin({ top: 6 })
          }.alignItems(HorizontalAlign.Center)
        }
      }, (e: string, i: number) => `${e}-${i}`)
    }
    .columnsTemplate('1fr 1fr 1fr 1fr')
    .rowsGap(16).columnsGap(12)
    .width('100%').padding({ top: 12, bottom: 12, left: 14, right: 14 })
  }
}

// ── Search ─────────────────────────────────────────────────────────────────

@Component
export struct SearchInputBox {
  @Prop query: string = '';
  @Prop placeholder: string = '搜索书名/作者';
  @State queryText: string = '';

  build() {
    Row() {
      Image($r('app.media.bookshelf_icon_search_dark')).width(20).height(20)
      TextInput({ text: this.queryText, placeholder: this.placeholder })
        .fontSize(ReaderTypography.bookMeta().fontSize).fontColor(ColorTokens.ink)
        .backgroundColor(ColorTokens.metaBg).borderRadius(DemoAliasTokens.radiusSm)
        .height(40).padding({ left: SpacingTokens.md, right: SpacingTokens.md })
        .layoutWeight(1).margin({ left: 8 })
        .onChange((v: string) => { this.queryText = v; })
        .onSubmit(() => {
          const q = this.queryText.trim();
          if (q.length > 0) {
            ReaderUiStore.dispatch({ type: 'search-submit', query: q });
          }
        })
    }
    .width('100%').alignItems(VerticalAlign.Center)
  }
}

@Component
export struct ScopeSelector {
  private scopes: string[] = ['书名', '作者', '书源'];
  private active: string = '书名';
  build() {
    Row() {
      ForEach(this.scopes, (s: string) => {
        Text(s)
          .fontSize(13).fontWeight(700)
          .fontColor(s === this.active ? DemoAliasTokens.onPrimary : ColorTokens.controlInk)
          .backgroundColor(s === this.active ? ColorTokens.primary : ColorTokens.metaBg)
          .height(32).padding({ left: 14, right: 14 })
          .borderRadius(DemoAliasTokens.radiusSm).margin({ right: 8 })
      }, (s: string) => s)
    }
    .width('100%')
  }
}

@Component
export struct GroupSelector {
  build() {
    Row() {
      Text('分组：全部').fontSize(13).fontColor(ColorTokens.controlInk)
      Image($r('app.media.reader_icon_more_dark')).width(16).height(16).margin({ left: 6 })
    }
    .width('100%').height(36).padding({ left: 14, right: 14 })
    .border({ width: 1, color: ColorTokens.border }).borderRadius(DemoAliasTokens.radiusMd)
    .backgroundColor(DemoAliasTokens.surface).alignItems(VerticalAlign.Center)
  }
}

@Component
export struct SearchHistoryList {
  @StorageProp('reader.searchResults') searchResults: SearchResultEntry[] = [];
  private history: string[] = ['三体', '刘慈欣', '球状闪电'];
  build() {
    if (this.searchResults.length > 0) {
      SearchResultsPanel({ results: this.searchResults })
    } else {
      Column() {
        Text('搜索历史').fontSize(13).fontWeight(900).fontColor(ColorTokens.ink).margin({ bottom: 6 })
        ForEach(this.history, (h: string, i: number) => {
          Text(h).fontSize(13).fontColor(ColorTokens.controlInk)
            .width('100%').padding({ top: 8, bottom: 8 })
            .border(i > 0 ? { width: { top: 1 }, color: ColorTokens.border } : { width: 0 })
            .onClick(() => {
              ReaderUiStore.dispatch({ type: 'search-submit', query: h });
            })
        }, (h: string, i: number) => `${h}-${i}`)
      }
      .width('100%').alignItems(HorizontalAlign.Start)
    }
  }
}

// SearchResultsPanel — renders live search results from reader.searchResults.
// Tap a result → dispatch book-detail-load (effect fires Host HTTP) + route-push
// book-detail so the detail page shows its loading state immediately.
@Component
export struct SearchResultsPanel {
  @Prop results: SearchResultEntry[];

  build() {
    Column() {
      Text(`搜索结果（${this.results.length}）`).fontSize(13).fontWeight(900)
        .fontColor(ColorTokens.ink).margin({ bottom: 6 })
      ForEach(this.results, (r: SearchResultEntry, i: number) => {
        Row() {
          Column() {
            Text(r.title).fontSize(15).fontWeight(600).fontColor(ColorTokens.ink)
            Row() {
              Text(r.author).fontSize(12).fontColor(ColorTokens.muted)
              Text(` · ${r.sourceName}`).fontSize(12).fontColor(ColorTokens.muted)
            }.margin({ top: 2 })
          }
          .alignItems(HorizontalAlign.Start).layoutWeight(1)
          Text('详情').fontSize(12).fontColor(ColorTokens.primary)
        }
        .width('100%').padding({ top: 10, bottom: 10 })
        .alignItems(VerticalAlign.Center)
        .border(i > 0 ? { width: { top: 1 }, color: ColorTokens.border } : { width: 0 })
        .onClick(() => {
          // route-push first (resets pageState='default'), then book-detail-load
          // switches pageState='loading' so book-detail/loading ViewState renders
          // the Loading component instead of the fixture body.
          ReaderUiStore.dispatch({ type: 'route-push', id: 'book-detail' });
          ReaderUiStore.dispatch({ type: 'book-detail-load', bookId: r.bookId });
        })
      }, (r: SearchResultEntry, i: number) => `${r.bookId}-${i}`)
    }
    .width('100%').alignItems(HorizontalAlign.Start)
  }
}
