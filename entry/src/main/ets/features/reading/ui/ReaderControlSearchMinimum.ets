import type { UIContext } from '@ohos.arkui.UIContext';
import { ReaderTextStyle, ReaderInheritedTextStyle, TYPE_READER_SEARCH_RETAINED_SEARCH_FIELD_INPUT,
  TYPE_READER_SEARCH_RETAINED_RESULT_ROW_TITLE, TYPE_READER_SEARCH_RETAINED_RESULT_SNIPPET_SNIPPET } from '../../../ui/foundation/ReaderTypography';
import { TYPE_READER_SEARCH_RETAINED_QUICK_BACK_BACK } from '../../../ui/foundation/ReaderTypography';
import { MESSAGE_ACTION, MESSAGE_BODY } from '../../../ui/foundation/ReaderMessageStyle';
import type { ReaderControlCandidateWidths, ReaderControlFormMinimum } from './ReaderLayoutGeometry';
import type { ReaderControlSearchNaturalSize } from './ReaderControlSearchGeometry';
import { sampleReaderControlSearch } from './ReaderControlSearchGeometry';
import { measureReaderControlText } from './ReaderControlTextMeasurement';

export interface ReaderSearchMinimumFacts {
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
  const loadAction = measureReaderControlText(context, facts.loadMoreLabel, MESSAGE_ACTION, Math.max(1, width - 36), 'wrap');
  const loadWidth = loadAction === undefined ? 0 : Math.max(facts.loadMoreMessage.length > 0 ? 30 : 112,
    loadAction.singleLineWidthVp + (facts.loadMoreMessage.length > 0 ? 4 : 16));
  const loadMessage = measureReaderControlText(context, facts.loadMoreMessage,
    new ReaderInheritedTextStyle(MESSAGE_BODY.fontFamily, undefined, MESSAGE_BODY.fontSizeFp,
      MESSAGE_BODY.lineHeightFp, undefined, 'system', 'appBaseline'),
    Math.max(1, original.results.width - loadWidth - 10), 'wrap');
  const status = measureReaderControlText(context, facts.message, MESSAGE_BODY, Math.max(1, width - 4), 'wrap');
  if (field === undefined || title === undefined || snippet === undefined || match === undefined ||
    loadAction === undefined || loadMessage === undefined || status === undefined || back === undefined || glyph === undefined) return undefined;
  const inputHeight = Math.max(14, field.heightVp);
  const backHeight = Math.max(24, back.heightVp);
  const fieldHeight = Math.max(full ? 32 : 24, inputHeight + 10, full ? 0 : backHeight);
  const titleHeight = Math.max(13, title.heightVp);
  // The actual Text keeps maxLines(2); both real Span weights share this
  // declared line-height upper bound, including short and long result rows.
  const snippetHeight = Math.max(28, Math.max(snippet.heightVp, match.heightVp) * 2);
  const rowHeight = Math.max(full ? 72 : 54, 9.09375 + titleHeight + 9 + snippetHeight + 8);
  const loadHeight = facts.loadMoreLabel.length > 0 ? Math.max(facts.loadMoreMessage.length > 0 ? 44 : 26,
    loadAction.heightVp + 8, facts.loadMoreMessage.length > 0 ? loadMessage.heightVp : 0) : 0;
  const natural: ReaderControlSearchNaturalSize = { fieldHeightVp: fieldHeight, inputHeightVp: inputHeight,
    titleHeightVp: titleHeight, snippetHeightVp: snippetHeight, rowHeightVp: rowHeight, loadMoreHeightVp: loadHeight,
    loadMoreWidthVp: loadWidth,
    statusHeightVp: status.heightVp + (facts.loading ? 44 : 0), backHeightVp: backHeight,
    backWidthVp: Math.max(51, back.singleLineWidthVp + 23) };
  const actual = sampleReaderControlSearch(full ? 1 : 0, width, full ? 666 : 190, natural);
  const viewport = facts.hasResults ? rowHeight + actual.firstResult.y + loadHeight + (loadHeight > 0 ? 4 : 0) + actual.resultEndPadding :
    facts.resultsMode ? Math.max(1, loadHeight) : natural.statusHeightVp;
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
