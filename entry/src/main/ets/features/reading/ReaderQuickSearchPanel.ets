import type { ReadingContentSearchResult } from './ReadingSessionFlowGateway';
import { splitReaderSearchSnippet } from './ReaderSearchHighlight';
import { ReaderSearchField } from '../common/ReaderSearchField';
import {
  TOK_BORDER_W,
  TOK_RADIUS_MD,
} from '../common/ReaderTokens';
import type { ReaderAppearanceSnapshot } from './ReaderAppearanceState';
import { createDefaultReaderAppearanceSnapshot } from './ReaderAppearanceState';
import { readerThemePalette, type ReaderThemePalette } from './ReaderThemePalettes';

const QUICK_SEARCH_PANEL_PADDING_X = 11;
const QUICK_SEARCH_PANEL_PADDING_Y = 13;
const QUICK_SEARCH_HEADER_HEIGHT = 24;
const QUICK_SEARCH_HEADER_BODY_GAP_PHONE = 5;
const QUICK_SEARCH_HEADER_BODY_GAP_TABLET = 6;
const QUICK_SEARCH_RESULTS_HEIGHT_PHONE = 141;
const QUICK_SEARCH_RESULTS_HEIGHT_TABLET = 134;
const QUICK_SEARCH_RESULT_ROW_HEIGHT = 54;

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

/** Figma Reader Quick Search content: Phone `943:8625`, Tablet `942:48`. */
@Component
export struct ReaderQuickSearchPanel {
  @Prop isTablet: boolean = false;
  @Prop query: string = '';
  @Prop state: ReaderQuickSearchState = { kind: 'idle' };
  @Prop appearanceSnapshot: ReaderAppearanceSnapshot = createDefaultReaderAppearanceSnapshot();

  private palette(): ReaderThemePalette {
    return readerThemePalette(this.appearanceSnapshot.activeTheme);
  }
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
    .height(this.panelHeight())
    .padding({
      left: QUICK_SEARCH_PANEL_PADDING_X,
      right: QUICK_SEARCH_PANEL_PADDING_X,
      top: QUICK_SEARCH_PANEL_PADDING_Y,
      bottom: QUICK_SEARCH_PANEL_PADDING_Y,
    })
    .backgroundColor(this.palette().surfacePanelSoft)
    .border({ width: TOK_BORDER_W, color: this.palette().borderSoft })
    .borderRadius(TOK_RADIUS_MD)
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
          .fontColor(this.palette().primary);
      }
      .width(51)
      .height(QUICK_SEARCH_HEADER_HEIGHT)
      .padding({ left: 8 })
      .alignItems(VerticalAlign.Center)
      .onClick((): void => this.onBack());

      Row() {
        ReaderSearchField({
          variant: 'readerQuick',
          mode: 'submit',
          text: this.query,
          placeholder: '搜索正文内容',
          accessibilityLabel: '搜索正文内容',
          submitEnabled: this.canSearch(),
          onTextChange: (value: string): void => this.onQueryChange(value),
          onSubmit: (): void => this.onSearch(),
        });
      }
      .layoutWeight(1)
      .height(QUICK_SEARCH_HEADER_HEIGHT)
      .alignItems(VerticalAlign.Center);

      Stack({ alignContent: Alignment.Center }) {
        Text('搜索')
          .fontFamily('ReaderInter')
          .fontWeight(700)
          .fontSize(10)
          .fontColor(this.palette().onPrimary);
      }
      .width(36)
      .height(QUICK_SEARCH_HEADER_HEIGHT)
      .backgroundColor(this.palette().primary)
      .borderRadius(TOK_RADIUS_MD)
      .opacity(this.canSearch() ? 1 : 0.4)
      .onClick((): void => {
        if (this.canSearch()) {
          this.onSearch();
        }
      });
    }
    .width('100%')
    .height(QUICK_SEARCH_HEADER_HEIGHT)
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
        .height(this.resultsHeight())
        .scrollBar(BarState.Off);
      } else {
        Stack({ alignContent: Alignment.Center }) {
          Text(this.statusText())
            .width('100%')
            .fontFamily('ReaderInter')
            .fontWeight(FontWeight.Regular)
            .fontSize(10)
            .fontColor(this.palette().inkSecondary)
            .textAlign(TextAlign.Center)
            .maxLines(2);
        }
        .width('100%')
        .height(this.resultsHeight());
      }
    }
    .width('100%')
    .height(this.resultsHeight())
    .margin({ top: this.headerBodyGap() })
    .border({ width: TOK_BORDER_W, color: this.palette().borderSoft })
    .borderRadius(TOK_RADIUS_MD)
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
        .fontColor(this.palette().ink)
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis });
      this.resultSnippet(result);
    }
    .width('100%')
    .height(QUICK_SEARCH_RESULT_ROW_HEIGHT)
    .padding({ left: 8, right: 8, top: 6 })
    .border({ width: { bottom: 1 }, color: this.palette().borderSoft })
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
          .fontColor(this.palette().inkSecondary);
      }
      if (splitReaderSearchSnippet(result.snippet, result.snippetStart,
        result.chapterOffset, result.matchLength).match.length > 0) {
        Span(splitReaderSearchSnippet(result.snippet, result.snippetStart,
          result.chapterOffset, result.matchLength).match)
          .fontFamily('ReaderNotoSansSC')
          .fontWeight(FontWeight.Bold)
          .fontColor(this.palette().ink);
      }
      if (splitReaderSearchSnippet(result.snippet, result.snippetStart,
        result.chapterOffset, result.matchLength).suffix.length > 0) {
        Span(splitReaderSearchSnippet(result.snippet, result.snippetStart,
          result.chapterOffset, result.matchLength).suffix)
          .fontFamily('ReaderNotoSansSC')
          .fontWeight(FontWeight.Regular)
          .fontColor(this.palette().inkSecondary);
      }
    }
    .width('100%')
    .fontFamily('ReaderNotoSansSC')
    .fontWeight(FontWeight.Regular)
    .fontSize(8)
    .lineHeight(10)
    .fontColor(this.palette().inkSecondary)
    .maxLines(2)
    .textOverflow({ overflow: TextOverflow.Ellipsis });
  }

  private canSearch(): boolean {
    return this.query.trim().length > 0 && this.state.kind !== 'loading';
  }

  private headerBodyGap(): number {
    return this.isTablet ? QUICK_SEARCH_HEADER_BODY_GAP_TABLET : QUICK_SEARCH_HEADER_BODY_GAP_PHONE;
  }

  private resultsHeight(): number {
    return this.isTablet ? QUICK_SEARCH_RESULTS_HEIGHT_TABLET : QUICK_SEARCH_RESULTS_HEIGHT_PHONE;
  }

  private panelHeight(): number {
    return QUICK_SEARCH_PANEL_PADDING_Y * 2 + QUICK_SEARCH_HEADER_HEIGHT +
      this.headerBodyGap() + this.resultsHeight();
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
