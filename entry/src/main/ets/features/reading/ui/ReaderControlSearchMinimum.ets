import type { ReadingContentSearchResult } from '../application/ReadingSessionFlowGateway';
import type { ReaderQuickSearchState } from '../presentation/ReaderContentSearchPublication';
import type { UIContext } from '@ohos.arkui.UIContext';
import { ReaderTextStyle, ReaderInheritedTextStyle, TYPE_READER_SEARCH_RETAINED_SEARCH_FIELD_INPUT, TYPE_READER_SEARCH_RETAINED_RESULT_ROW_TITLE, TYPE_READER_SEARCH_RETAINED_RESULT_SNIPPET_SNIPPET, TYPE_READER_SEARCH_RETAINED_QUICK_BACK_BACK } from '../../../ui/foundation/ReaderTypography';

import { MESSAGE_ACTION, MESSAGE_BODY } from '../../../ui/foundation/ReaderMessageStyle';
import type { ReaderControlCandidateWidths, ReaderControlFormMinimum } from './ReaderLayoutGeometry';
import { type ReaderControlSearchNaturalSize, sampleReaderControlSearch } from './ReaderControlSearchGeometry';

import { measureReaderControlText, type ReaderControlTextExtent } from './ReaderControlTextMeasurement';

export interface ReaderSearchMinimumFactsInput {
  query: string;
  state: ReaderQuickSearchState;
  onlineBook?: boolean;
  resultScope?: number;
  retainedLoadMoreFailure: boolean;
}
export function readerControlSearchResultTitle(result: ReadingContentSearchResult | undefined): string {
  return result === undefined ? '' : result.chapterTitle.trim().length > 0 ? result.chapterTitle : `第 ${result.chapterIndex + 1} 章`;
}
export function readerControlSearchStatusText(state: ReaderQuickSearchState, onlineBook: boolean = false): string {
  const scope = state.kind === 'results' || state.kind === 'empty' ? state.cacheScope : undefined;
  const cacheHint = !onlineBook ? '' : scope === undefined ? '仅搜索已缓存章节' :
    `仅搜索已缓存章节（目录已缓存 ${scope.cachedChapters} / ${scope.totalChapters} 章）`;
  if (state.kind === 'results') return cacheHint;
  if (state.kind === 'idle') return cacheHint.length > 0 ? cacheHint : '输入关键词搜索正文内容';
  const status = state.kind === 'loading' ? '正在搜索…' : state.kind === 'empty' ? `未找到“${state.keyword}”` : state.message;
  return cacheHint.length > 0 ? `${status}\n${cacheHint}` : status;
}
export function readerControlSearchMinimumFacts(input: ReaderSearchMinimumFactsInput): ReaderSearchMinimumFacts {
  const state = input.state;
  const resultScope = input.resultScope ?? 0;
  const first = state.kind === 'results' ? state.results[0] : undefined;
  const pagination = state.kind === 'results' &&
    (state.loadMoreError !== undefined || state.paginationRetired === true);
  const retainedFailure = pagination;
  return { readViewState: (): ReaderQuickSearchState => state,
    resultScope: state.kind === 'results' && Number.isFinite(resultScope) && resultScope > 0 ? resultScope : 0,
    query: input.query, title: readerControlSearchResultTitle(first), snippet: first?.snippet ?? '',
    message: readerControlSearchStatusText(state, input.onlineBook === true),
    hasResults: first !== undefined, resultsMode: state.kind === 'results', loading: state.kind === 'loading',
    loadMoreLabel: !pagination ? '' : state.kind === 'results' && state.continuationRetryable === true ? '重试' : '重新搜索',
    loadMoreMessage: retainedFailure ? state.kind === 'results' && state.paginationRetired === true ?
      '需重新搜索才能加载更多' : '后续结果加载失败' : '' };
}
export interface ReaderSearchMinimumFacts {
  readViewState: () => ReaderQuickSearchState;
  resultScope: number;
  query: string;
  title: string;
  snippet: string;
  message: string;
  hasResults: boolean;
  resultsMode: boolean;
  loading: boolean;
  loadMoreLabel: string;
  loadMoreMessage: string;
}
export interface ReaderSearchFormProfile {
  minimum: ReaderControlFormMinimum;
  natural: ReaderControlSearchNaturalSize;
}
export interface ReaderSearchMinimumProfile {
  quick: ReaderSearchFormProfile;
  full: ReaderSearchFormProfile;
}

function form(context: UIContext, width: number, full: boolean,
  facts: ReaderSearchMinimumFacts): ReaderSearchFormProfile | undefined {
  const original = sampleReaderControlSearch(full ? 1 : 0, width, full ? 666 : 190);
  if (original.field.width <= 22 || original.firstResult.width <= 18) return undefined;
  const field = measureReaderControlText(context, facts.query || '搜索正文内容', TYPE_READER_SEARCH_RETAINED_SEARCH_FIELD_INPUT,
    original.field.width - 22);
  const title = measureReaderControlText(context, facts.title, TYPE_READER_SEARCH_RETAINED_RESULT_ROW_TITLE,
    original.firstResult.width - 18);
  const snippetRole = TYPE_READER_SEARCH_RETAINED_RESULT_SNIPPET_SNIPPET;
  const snippetStyle = new ReaderTextStyle(snippetRole.fontFamily ?? TYPE_READER_SEARCH_RETAINED_RESULT_ROW_TITLE.fontFamily,
    400, snippetRole.fontSizeFp, snippetRole.lineHeightFp, snippetRole.letterSpacingFp, 'system', 'appBaseline');
  const matchStyle = new ReaderTextStyle(snippetStyle.fontFamily, 700, snippetStyle.fontSizeFp,
    snippetStyle.lineHeightFp, snippetStyle.letterSpacingFp, 'system', 'appBaseline');
  const snippet = measureReaderControlText(context, facts.snippet, snippetStyle, original.firstResult.width - 18);
  const match = measureReaderControlText(context, facts.snippet, matchStyle, original.firstResult.width - 18);
  const back = measureReaderControlText(context, '返回', TYPE_READER_SEARCH_RETAINED_QUICK_BACK_BACK, 51);
  const glyph = measureReaderControlText(context, '字', TYPE_READER_SEARCH_RETAINED_SEARCH_FIELD_INPUT, original.field.width - 22);
  const noAction: ReaderControlTextExtent = { widthVp: 0, heightVp: 0, singleLineWidthVp: 0, fitsWidth: true };
  const loadAction = facts.loadMoreLabel.length > 0 ?
    measureReaderControlText(context, facts.loadMoreLabel, MESSAGE_ACTION, Math.max(1, width - 36), 'wrap') : noAction;
  // ReaderRecoveryAction's text variant keeps a 44vp native minimum and 2vp
  // horizontal padding on each side, beside the weighted message Text.
  const recoveryNativeMinimumWidth = 44;
  const recoveryHorizontalPadding = 2 * 2;
  const loadActionGap = 10;
  const loadWidth = facts.loadMoreLabel.length === 0 || loadAction === undefined ? 0 : Math.max(facts.loadMoreMessage.length > 0 ? recoveryNativeMinimumWidth : 112,
    loadAction.singleLineWidthVp + (facts.loadMoreMessage.length > 0 ? recoveryHorizontalPadding : 16));
  const loadMessage = facts.loadMoreMessage.length === 0 ? noAction : measureReaderControlText(context, facts.loadMoreMessage,
    new ReaderInheritedTextStyle(MESSAGE_BODY.fontFamily, undefined, MESSAGE_BODY.fontSizeFp,
      MESSAGE_BODY.lineHeightFp, undefined, 'system', 'appBaseline'),
    Math.max(1, original.results.width - loadWidth - loadActionGap), 'wrap');
  const status = facts.message.length === 0 ? noAction :
    measureReaderControlText(context, facts.message, MESSAGE_BODY, statusWidth, 'wrap');
  const statusWidth = facts.resultsMode ? original.results.width : Math.max(1, width - 4);
  if (field === undefined || title === undefined || snippet === undefined || match === undefined ||
    loadAction === undefined || loadMessage === undefined || status === undefined || back === undefined || glyph === undefined) return undefined;
  const inputHeight = Math.max(14, field.heightVp);
  const backHeight = Math.max(24, back.heightVp + 8);
  const fieldHeight = Math.max(full ? 32 : 24, inputHeight, full ? 0 : backHeight);
  const titleHeight = Math.max(13, title.heightVp);
  // The actual Text keeps maxLines(2); both real Span weights share this
  // declared line-height upper bound, including short and long result rows.
  const snippetHeight = Math.max(28, Math.max(snippet.heightVp, match.heightVp) * 2);
  const rowHeight = Math.max(full ? 72 : 54, (full ? 72 : 54) + Math.max(0, titleHeight - 13) + Math.max(0, snippetHeight - 28));
  const loadHeight = facts.loadMoreLabel.length > 0 ? Math.max(44,
    loadAction.heightVp + 8, facts.loadMoreMessage.length > 0 ? loadMessage.heightVp : 0) : 0;
  const cacheScopeHeight = facts.resultsMode && facts.message.length > 0 ? status.heightVp : 0;
  const natural: ReaderControlSearchNaturalSize = { fieldHeightVp: fieldHeight, inputHeightVp: inputHeight,
    titleHeightVp: titleHeight, snippetHeightVp: snippetHeight, rowHeightVp: rowHeight, loadMoreHeightVp: loadHeight,
    loadMoreWidthVp: loadWidth, cacheScopeHeightVp: cacheScopeHeight,
    statusHeightVp: status.heightVp + (facts.loading ? 44 : 0), backHeightVp: backHeight,
    backWidthVp: Math.max(51, back.singleLineWidthVp + 23) };
  const actual = sampleReaderControlSearch(full ? 1 : 0, width, full ? 666 : 190, natural);
  const viewport = facts.hasResults ? rowHeight + actual.firstResult.y + loadHeight + (loadHeight > 0 ? 4 : 0) +
    actual.resultEndPadding + cacheScopeHeight :
    facts.resultsMode ? Math.max(1, loadHeight + cacheScopeHeight) : natural.statusHeightVp;
  const minWidth = Math.max(width - actual.field.width + 22 + glyph.singleLineWidthVp,
    facts.loadMoreLabel.length > 0 ? loadWidth + 4 : 0);
  return { minimum: { heightVp: actual.results.y + Math.max(1, viewport) + 1, minWidthVp: minWidth,
    fits: width + .1 >= minWidth && actual.field.width > 22 }, natural };
}

export function measureReaderSearchMinimum(context: UIContext, widths: ReaderControlCandidateWidths,
  facts: ReaderSearchMinimumFacts): ReaderSearchMinimumProfile | undefined {
  const quick = form(context, widths.quickContentWidthVp, false, facts);
  const full = form(context, widths.fullContentWidthVp, true, facts);
  return quick === undefined || full === undefined ? undefined : { quick, full };
}
