import type { ReadingContentSearchResult } from './ReadingSessionFlowGateway';
import { splitReaderSearchSnippet } from './ReaderSearchHighlight';
import {
  TOK_BORDER_W,
  TOK_LINE,
  TOK_READ_INK,
  TOK_READ_MUTED,
  TOK_READ_PRIMARY,
  TOK_SURFACE_PANEL,
  TOK_SURFACE_PANEL_SOFT,
} from '../common/ReaderTokens';

export interface ReaderQuickSearchIdleState {
  kind: 'idle';
}

export interface ReaderQuickSearchLoadingState {
  kind: 'loading';
  keyword: string;
}

export interface ReaderQuickSearchResultsState {
  kind: 'results';
  keyword: string;
  results: ReadingContentSearchResult[];
}

export interface ReaderQuickSearchEmptyState {
  kind: 'empty';
  keyword: string;
}

export interface ReaderQuickSearchErrorState {
  kind: 'error';
  message: string;
}

export type ReaderQuickSearchState =
  | ReaderQuickSearchIdleState
  | ReaderQuickSearchLoadingState
  | ReaderQuickSearchResultsState
  | ReaderQuickSearchEmptyState
  | ReaderQuickSearchErrorState;

/** Figma Reader Quick Search / Phone (`943:8625`) content area only. */
@Component
export struct ReaderQuickSearchPanel {
  @Prop query: string = '';
  @Prop state: ReaderQuickSearchState = { kind: 'idle' };
  onBack: () => void = (): void => {};
  onQueryChange: (query: string) => void = (_query: string): void => {};
  onSearch: () => void = (): void => {};
  onSelectResult: (result: ReadingContentSearchResult) => void = (_result: ReadingContentSearchResult): void => {};

  build() {
    Column() {
      this.searchHeader();
      this.resultsBody();
    }
    .width('100%')
    .height(196)
    .padding({ left: 11, right: 11, top: 13, bottom: 13 })
    .backgroundColor(TOK_SURFACE_PANEL)
    .border({ width: TOK_BORDER_W, color: TOK_LINE })
    .borderRadius(8)
    .clip(true);
  }

  @Builder
  private searchHeader() {
    Row({ space: 5 }) {
      Row({ space: 4 }) {
        Image($r('app.media.reader_quick_back'))
          .width(11)
          .height(11);
        Text('返回')
          .fontFamily('ReaderInter')
          .fontWeight(600)
          .fontSize(10)
          .fontColor(TOK_READ_PRIMARY);
      }
      .width(51)
      .height(24)
      .padding({ left: 8 })
      .alignItems(VerticalAlign.Center)
      .onClick((): void => this.onBack());

      Row({ space: 4 }) {
        Image($r('app.media.reader_quick_search'))
          .width(11)
          .height(11);
        TextInput({ text: this.query, placeholder: '搜索正文内容' })
          .layoutWeight(1)
          .height(22)
          .padding(0)
          .fontFamily('ReaderInter')
          .fontSize(10)
          .fontColor(TOK_READ_INK)
          .caretColor(TOK_READ_PRIMARY)
          .placeholderColor(TOK_READ_MUTED)
          .backgroundColor(Color.Transparent)
          .onChange((value: string): void => this.onQueryChange(value));
      }
      .layoutWeight(1)
      .height(24)
      .padding({ left: 7, right: 7 })
      .backgroundColor(TOK_SURFACE_PANEL_SOFT)
      .borderRadius(8)
      .alignItems(VerticalAlign.Center);

      Stack({ alignContent: Alignment.Center }) {
        Text('搜索')
          .fontFamily('ReaderInter')
          .fontWeight(700)
          .fontSize(10)
          .fontColor('#FFFAF4');
      }
      .width(36)
      .height(24)
      .backgroundColor(TOK_READ_PRIMARY)
      .borderRadius(8)
      .opacity(this.canSearch() ? 1 : 0.4)
      .onClick((): void => {
        if (this.canSearch()) {
          this.onSearch();
        }
      });
    }
    .width('100%')
    .height(24)
    .alignItems(VerticalAlign.Center);
  }

  @Builder
  private resultsBody() {
    Stack({ alignContent: Alignment.TopStart }) {
      if (this.state.kind === 'results') {
        Scroll() {
          Column() {
            ForEach(this.state.results, (result: ReadingContentSearchResult) => {
              this.resultRow(result);
            }, (result: ReadingContentSearchResult): string =>
              `reader-search-${result.chapterIndex}-${result.chapterOffset}`);
          }
          .width('100%');
        }
        .width('100%')
        .height(141)
        .scrollBar(BarState.Off);
      } else {
        Stack({ alignContent: Alignment.Center }) {
          Text(this.statusText())
            .width('100%')
            .fontFamily('ReaderInter')
            .fontWeight(FontWeight.Regular)
            .fontSize(10)
            .fontColor(TOK_READ_MUTED)
            .textAlign(TextAlign.Center)
            .maxLines(2);
        }
        .width('100%')
        .height(141);
      }
    }
    .width('100%')
    .height(141)
    .margin({ top: 5 })
    .border({ width: TOK_BORDER_W, color: TOK_LINE })
    .borderRadius(8)
    .clip(true);
  }

  @Builder
  private resultRow(result: ReadingContentSearchResult) {
    Column({ space: 5 }) {
      Text(this.resultTitle(result))
        .width('100%')
        .fontFamily('ReaderInter')
        .fontWeight(700)
        .fontSize(10)
        .fontColor(TOK_READ_INK)
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis });
      this.resultSnippet(result);
    }
    .width('100%')
    .height(54)
    .padding({ left: 8, right: 8, top: 6 })
    .border({ width: { bottom: 1 }, color: TOK_LINE })
    .onClick((): void => this.onSelectResult(result));
  }

  @Builder
  private resultSnippet(result: ReadingContentSearchResult) {
    Text() {
      if (splitReaderSearchSnippet(result.snippet, result.snippetStart,
        result.chapterOffset, result.matchLength).prefix.length > 0) {
        Span(splitReaderSearchSnippet(result.snippet, result.snippetStart,
          result.chapterOffset, result.matchLength).prefix)
          .fontFamily('ReaderNotoSansSC')
          .fontWeight(FontWeight.Regular)
          .fontColor(TOK_READ_MUTED);
      }
      if (splitReaderSearchSnippet(result.snippet, result.snippetStart,
        result.chapterOffset, result.matchLength).match.length > 0) {
        Span(splitReaderSearchSnippet(result.snippet, result.snippetStart,
          result.chapterOffset, result.matchLength).match)
          .fontFamily('ReaderNotoSansSC')
          .fontWeight(FontWeight.Bold)
          .fontColor(TOK_READ_INK);
      }
      if (splitReaderSearchSnippet(result.snippet, result.snippetStart,
        result.chapterOffset, result.matchLength).suffix.length > 0) {
        Span(splitReaderSearchSnippet(result.snippet, result.snippetStart,
          result.chapterOffset, result.matchLength).suffix)
          .fontFamily('ReaderNotoSansSC')
          .fontWeight(FontWeight.Regular)
          .fontColor(TOK_READ_MUTED);
      }
    }
    .width('100%')
    .fontFamily('ReaderNotoSansSC')
    .fontWeight(FontWeight.Regular)
    .fontSize(8)
    .lineHeight(10)
    .fontColor(TOK_READ_MUTED)
    .maxLines(2)
    .textOverflow({ overflow: TextOverflow.Ellipsis });
  }

  private canSearch(): boolean {
    return this.query.trim().length > 0 && this.state.kind !== 'loading';
  }

  private resultTitle(result: ReadingContentSearchResult): string {
    return result.chapterTitle.trim().length > 0 ? result.chapterTitle : `第 ${result.chapterIndex + 1} 章`;
  }

  private statusText(): string {
    if (this.state.kind === 'loading') {
      return '正在搜索…';
    }
    if (this.state.kind === 'empty') {
      return `未找到“${this.state.keyword}”`;
    }
    if (this.state.kind === 'error') {
      return this.state.message;
    }
    return '';
  }
}
