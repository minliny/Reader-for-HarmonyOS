import { readerControlActor as actor, readerControlLerp as lerp, readerControlUnit as unit,
  sampleReaderControlActor as sample, type ReaderControlActorFrame } from './ReaderControlActorGeometry.ts';

export const READER_CONTROL_SEARCH_BORDER = 1;
export const READER_CONTROL_SEARCH_LEADING_INSET = 10;
export const READER_CONTROL_SEARCH_ICON_SIZE = 14;
export const READER_CONTROL_SEARCH_ICON_GAP = 6;
export const READER_CONTROL_SEARCH_INPUT_START = READER_CONTROL_SEARCH_BORDER + READER_CONTROL_SEARCH_LEADING_INSET +
  READER_CONTROL_SEARCH_ICON_SIZE + READER_CONTROL_SEARCH_ICON_GAP;
export const READER_CONTROL_SEARCH_END_INSET = 6;
export const READER_CONTROL_SEARCH_CLEAR_SLOT = 24;
export const READER_CONTROL_SEARCH_FULL_ACTION_PADDING = 16;
export const READER_CONTROL_SEARCH_PLACEHOLDER = '搜索正文内容';
export const READER_CONTROL_SEARCH_COMPACT_PLACEHOLDER = '正文';

export function readerControlSearchFieldChrome(hasQuery: boolean): number {
  return READER_CONTROL_SEARCH_INPUT_START + READER_CONTROL_SEARCH_END_INSET + READER_CONTROL_SEARCH_BORDER +
    (hasQuery ? READER_CONTROL_SEARCH_CLEAR_SLOT : 0);
}

export interface ReaderControlSearchFrame {
  field: ReaderControlActorFrame;
  action: ReaderControlActorFrame;
  actionLabelOpacity: number;
  back: ReaderControlActorFrame;
  /** Results viewport begins immediately below the current query row. */
  results: ReaderControlActorFrame;
  /** First row in Results-local coordinates, including its authored motion. */
  firstResult: ReaderControlActorFrame;
  rowHeight: number;
  resultEndPadding: number;
  queryDivider: ReaderControlActorFrame;
  placeholder: string;
  inputHeightVp: number;
  titleHeightVp: number;
  snippetHeightVp: number;
  loadMoreHeightVp: number;
  loadMoreWidthVp: number;
  cacheScopeHeightVp: number;
}
export interface ReaderControlSearchNaturalSize {
  fieldHeightVp: number;
  actionWidthVp: number;
  placeholderWidthVp: number;
  inputHeightVp: number;
  titleHeightVp: number;
  snippetHeightVp: number;
  rowHeightVp: number;
  loadMoreHeightVp: number;
  loadMoreWidthVp: number;
  cacheScopeHeightVp?: number;
  statusHeightVp: number;
  backHeightVp: number;
  backWidthVp: number;
}

/** Source-local actors before adapting the source's unanimated viewport to the
 * common Stage slot. Preserve the original parent origins. */
export function readerControlSearchSourceField(p: number): ReaderControlActorFrame {
  return sample(actor(64.55, -17.45, 167, 24), actor(10, 9, 277, 32), p);
}

export function readerControlSearchSourceResult(index: number, p: number): ReaderControlActorFrame {
  const i = Number.isFinite(index) ? Math.max(0, Math.floor(index)) : 0;
  return sample(actor(9.55, -38.45 + 54 * i, 262, 54),
    actor(10, 5 + 72 * i, 314, 72), p);
}

/** Search 1938:4927 has no ContentViewport motion. Source shell content origin
 * is (14,58)+(1,1), while the shared Stage slot is (13,29+28p).
 * This changes coordinate basis, not the Stage translation or clock.
 * Source shell fractional translation -.448/406.443 is a local residual.
 * Width changes outside canonical phone bounds reflow controls, never text.
 */
export function sampleReaderControlSearch(p: number, availableWidth: number,
  availableHeight: number, natural?: ReaderControlSearchNaturalSize): ReaderControlSearchFrame {
  const progress = unit(p);
  const width = Number.isFinite(availableWidth) ? Math.max(0, availableWidth) : lerp(286, 338, progress);
  const height = Number.isFinite(availableHeight) ? Math.max(0, availableHeight) : lerp(190, 666, progress);
  const widthDelta = width - lerp(286, 338, progress);
  const basisX = 2 - .448 * (1 - progress);
  const basisY = 2 + 28.443 * (1 - progress);
  const field = readerControlSearchSourceField(progress);
  const action = sample(actor(236.55, -17.45, 36, 24), actor(292, 9, 32, 32), progress);
  const first = readerControlSearchSourceResult(0, progress);
  // The unanimated Full Query parent left a 38.45vp empty band in Quick,
  // and clipped most of the first result. Adapt the viewport to the query
  // row while compensating its children so their authored screen paths stay.
  const fieldHeight = Math.max(lerp(32, 36, progress), natural?.fieldHeightVp ?? 0);
  const actionWidth = Math.max(lerp(36, 58, progress), natural?.actionWidthVp ?? 0);
  const actionGrowth = actionWidth - action.width;
  const queryBottom = basisY + field.y + fieldHeight + lerp(5, 9, progress);
  const resultsY = queryBottom + 1;
  // Use the existing result inset to absorb the added Full capsule height.
  // This keeps the default first row on its authored screen path.
  const resultOriginCorrection = 51 - (field.y + field.height + lerp(5, 9, progress) + 1) - 4 * progress;
  const back = sample(actor(10.1, 12.99, 51, 24), actor(10.1, 404.99, 51, 24, 0), progress);
  const rowHeight = natural === undefined ? first.height : Math.max(first.height, natural.rowHeightVp);
  const backWidth = natural === undefined ? back.width : Math.max(back.width, natural.backWidthVp);
  const fieldShift = natural === undefined ? 0 : Math.max(0, back.x + backWidth + 4 - (basisX + field.x)) * (1 - progress);
  const fieldX = basisX + field.x + fieldShift;
  const actionX = Math.max(0, basisX + action.x + widthDelta - actionGrowth);
  const fieldWidth = Math.max(0, actionX - fieldX - 8);
  const placeholderWidth = natural?.placeholderWidthVp ?? READER_CONTROL_SEARCH_PLACEHOLDER.length * 13;
  return {
    field: actor(fieldX, basisY + field.y, fieldWidth, fieldHeight),
    action: actor(actionX, basisY + action.y, Math.min(width, actionWidth), fieldHeight),
    actionLabelOpacity: unit(2 * progress - 1),
    // Back is a screen-level sibling, NOT under the moving source shell.
    back: actor(back.x, back.y, backWidth, natural === undefined ? back.height : Math.max(back.height, natural.backHeightVp), back.opacity),
    // Both viewports follow the actual query height. Row offsets preserve
    // the underlying authored path as the query capsule grows.
    results: actor(basisX, resultsY, Math.max(0, width - 4), Math.max(0, height - resultsY - 1)),
    firstResult: actor(first.x, first.y + resultOriginCorrection,
      Math.max(0, first.width + widthDelta), rowHeight),
    rowHeight,
    // Source Results inner wrapper uses py-[5px]. The first row's static y=5
    // already contains its top padding; retain the bottom padding separately.
    resultEndPadding: 5,
    queryDivider: actor(basisX, queryBottom, Math.max(0, width - 4), 1),
    placeholder: fieldWidth - readerControlSearchFieldChrome(false) >= placeholderWidth
      ? READER_CONTROL_SEARCH_PLACEHOLDER : READER_CONTROL_SEARCH_COMPACT_PLACEHOLDER,
    inputHeightVp: natural?.inputHeightVp ?? 0,
    titleHeightVp: natural?.titleHeightVp ?? 13,
    snippetHeightVp: natural?.snippetHeightVp ?? 28,
    loadMoreHeightVp: natural?.loadMoreHeightVp ?? 0,
    loadMoreWidthVp: natural?.loadMoreWidthVp ?? 112,
    cacheScopeHeightVp: natural?.cacheScopeHeightVp ?? 0,
  };
}
