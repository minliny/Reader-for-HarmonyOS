import { registerReaderFonts } from '../common/ReaderFonts';
import { ReaderSearchField } from '../common/ReaderSearchField';
import {
  TOK_BORDER_W,
  TOK_LINE,
  TOK_LINE_STRONG,
  TOK_READ_HANDLE,
  TOK_READ_INK,
  TOK_READ_MUTED,
  TOK_READ_PRIMARY,
  TOK_READ_SURFACE,
  TOK_SURFACE_PANEL,
  TOK_SURFACE_PANEL_SOFT,
} from '../common/ReaderTokens';
import type { ReadingContentSearchResult } from './ReadingSessionFlowGateway';
import type { ReaderQuickSearchState } from './ReaderQuickSearchPanel';
import { splitReaderSearchSnippet } from './ReaderSearchHighlight';

const READER_SEARCH_FULL_WIDTH = 364;
const READER_SEARCH_FULL_HEIGHT = 736;
const READER_SEARCH_FULL_INSET = 13;
const READER_SEARCH_FULL_HEADER_Y = 19;
const READER_SEARCH_FULL_VIEWPORT_Y = 57;
const READER_SEARCH_FULL_SEARCH_ROW_HEIGHT = 51;
const READER_SEARCH_FULL_RESULT_ROW_HEIGHT = 72;
const READER_SEARCH_FULL_SEARCH_GAP = 7;
const READER_SEARCH_FULL_SEARCH_PADDING_X = 10;
const READER_SEARCH_FULL_ACTION_SIZE = 32;

/**
 * Figma Reader Full Search sheet (`Domain=Search`, node `1770:10207`).
 *
 * Search execution and canonical result selection remain owned by the reading
 * session. This surface is the full counterpart of ReaderQuickSearchPanel and
 * intentionally reuses the shared directory/search-field visual contract.
 */
@Component
export struct ReaderSearchFullPanel {
  @Prop availableWidth: number = 0;
  @Prop availableHeight: number = 0;
  @Prop query: string = '';
  @Prop state: ReaderQuickSearchState = { kind: 'idle' };
  onCollapse: () => void = (): void => {};
  onQueryChange: (query: string) => void = (_query: string): void => {};
  onSearch: () => void = (): void => {};
  onSelectResult: (result: ReadingContentSearchResult) => void =
    (_result: ReadingContentSearchResult): void => {};

  aboutToAppear(): void {
    registerReaderFonts(this.getUIContext().getFont());
  }

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      Row()
        .width(42)
        .height(4)
        .backgroundColor(TOK_READ_HANDLE)
        .borderRadius(999)
        .position({ x: this.handleX(), y: 9 });

      this.header();

      Stack({ alignContent: Alignment.TopStart }) {
        this.searchRow();
        this.resultsBody();
      }
      .width(this.viewportWidth())
      .height(this.viewportHeight())
      .backgroundColor(TOK_SURFACE_PANEL)
      .border({ width: TOK_BORDER_W, color: TOK_LINE })
      .borderRadius(12)
      .clip(true)
      .position({ x: READER_SEARCH_FULL_INSET, y: READER_SEARCH_FULL_VIEWPORT_Y });
    }
    .width(this.sheetWidth())
    .height(this.sheetHeight())
    .backgroundColor(TOK_READ_SURFACE)
    .border({ width: TOK_BORDER_W, color: TOK_LINE_STRONG })
    .borderRadius(24)
    .clip(true);
  }

  @Builder
  private header() {
    Row() {
      Image($r('app.media.rc_search'))
        .width(16)
        .height(16);
      Text('内容搜索')
        .margin({ left: 8 })
        .fontFamily('ReaderNotoSansSC')
        .fontWeight(FontWeight.Bold)
        .fontSize(14)
        .fontColor(TOK_READ_INK)
        .maxLines(1);
      Blank();
      Text('收起')
        .width(40)
        .height(26)
        .backgroundColor(TOK_SURFACE_PANEL_SOFT)
        .borderRadius(8)
        .fontFamily('ReaderNotoSansSC')
        .fontWeight(FontWeight.Bold)
        .fontSize(10)
        .fontColor(TOK_READ_PRIMARY)
        .textAlign(TextAlign.Center)
        .accessibilityText('收起内容搜索')
        .onClick((): void => this.onCollapse());
    }
    .width(this.viewportWidth())
    .height(30)
    .alignItems(VerticalAlign.Center)
    .position({ x: READER_SEARCH_FULL_INSET, y: READER_SEARCH_FULL_HEADER_Y });
  }

  @Builder
  private searchRow() {
    Row({ space: READER_SEARCH_FULL_SEARCH_GAP }) {
      ReaderSearchField({
        variant: 'readerDirectory',
        mode: 'submit',
        text: this.query,
        placeholder: '搜索正文内容',
        accessibilityLabel: '搜索正文内容',
        submitEnabled: this.canSearch(),
        onTextChange: (value: string): void => this.onQueryChange(value),
        onSubmit: (): void => this.onSearch(),
      })
        .layoutWeight(1);

      Stack({ alignContent: Alignment.Center }) {
        Image($r('app.media.reader_directory_input_search'))
          .width(16)
          .height(16);
      }
      .width(READER_SEARCH_FULL_ACTION_SIZE)
      .height(READER_SEARCH_FULL_ACTION_SIZE)
      .backgroundColor(TOK_SURFACE_PANEL_SOFT)
      .border({ width: TOK_BORDER_W, color: TOK_LINE_STRONG })
      .borderRadius(8)
      .opacity(this.canSearch() ? 1 : 0.4)
      .accessibilityText('搜索正文')
      .onClick((): void => {
        if (this.canSearch()) {
          this.onSearch();
        }
      });
    }
    .width('100%')
    .height(READER_SEARCH_FULL_SEARCH_ROW_HEIGHT)
    .padding({ left: READER_SEARCH_FULL_SEARCH_PADDING_X, right: READER_SEARCH_FULL_SEARCH_PADDING_X })
    .alignItems(VerticalAlign.Center)
    .border({ width: { bottom: TOK_BORDER_W }, color: TOK_LINE });
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
              `reader-search-full-${result.chapterIndex}-${result.chapterOffset}`);
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
            .padding({ left: 16, right: 16 })
            .fontFamily('ReaderNotoSansSC')
            .fontWeight(FontWeight.Regular)
            .fontSize(12)
            .fontColor(TOK_READ_MUTED)
            .textAlign(TextAlign.Center)
            .maxLines(3);
        }
        .width('100%')
        .height(this.resultsHeight());
      }
    }
    .width('100%')
    .height(this.resultsHeight())
    .position({ x: 0, y: READER_SEARCH_FULL_SEARCH_ROW_HEIGHT });
  }

  @Builder
  private resultRow(result: ReadingContentSearchResult) {
    Column({ space: 6 }) {
      Text(this.resultTitle(result))
        .width('100%')
        .fontFamily('ReaderNotoSansSC')
        .fontWeight(FontWeight.Bold)
        .fontSize(12)
        .fontColor(TOK_READ_INK)
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis });
      this.resultSnippet(result);
    }
    .width('100%')
    .height(READER_SEARCH_FULL_RESULT_ROW_HEIGHT)
    .padding({ left: 12, right: 12, top: 10, bottom: 8 })
    .alignItems(HorizontalAlign.Start)
    .border({ width: { bottom: TOK_BORDER_W }, color: TOK_LINE })
    .accessibilityText(`${this.resultTitle(result)}，搜索结果`)
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
    .fontSize(10)
    .lineHeight(14)
    .fontColor(TOK_READ_MUTED)
    .maxLines(2)
    .textOverflow({ overflow: TextOverflow.Ellipsis });
  }

  private canSearch(): boolean {
    return this.query.trim().length > 0 && this.state.kind !== 'loading';
  }

  private sheetWidth(): number {
    const available = Number.isFinite(this.availableWidth) && this.availableWidth > 0 ?
      this.availableWidth : READER_SEARCH_FULL_WIDTH;
    return Math.min(READER_SEARCH_FULL_WIDTH, available);
  }

  private sheetHeight(): number {
    const available = Number.isFinite(this.availableHeight) && this.availableHeight > 0 ?
      this.availableHeight : READER_SEARCH_FULL_HEIGHT;
    return Math.min(READER_SEARCH_FULL_HEIGHT, available);
  }

  private viewportWidth(): number {
    return Math.max(0, this.sheetWidth() - READER_SEARCH_FULL_INSET * 2);
  }

  private viewportHeight(): number {
    return Math.max(0, this.sheetHeight() - 70);
  }

  private resultsHeight(): number {
    return Math.max(0, this.viewportHeight() - READER_SEARCH_FULL_SEARCH_ROW_HEIGHT);
  }

  private handleX(): number {
    return Math.max(0, (this.sheetWidth() - 42) / 2);
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
    return '输入关键词搜索正文内容';
  }
}
