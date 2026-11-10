import {
  readerControlActor, readerControlLerp, readerControlUnit, sampleReaderControlActor,
  type ReaderControlActorFrame,
} from './ReaderControlActorGeometry';

export interface ReaderControlReplaceEndpointMinimum {
  width: number;
  nameHeight: number;
  metaHeight: number;
  actionHeight: number;
  editorFlagHeight: number;
  editorHeaderHeight: number;
  editorBackHeight: number;
  editorBackWidth: number;
  rowHeight: number;
  backHeight: number;
  backWidth: number;
  toolbarColumns: number;
  toolbarCellHeight: number;
  statusHeight: number;
  fits: boolean;
}
export interface ReaderControlReplaceMinimumProfile {
  quick: ReaderControlReplaceEndpointMinimum;
  full: ReaderControlReplaceEndpointMinimum;
}

export interface ReaderControlReplaceFrame {
  progress: number;
  toolbar: ReaderControlActorFrame;
  list: ReaderControlActorFrame;
  rowHeight: number;
  nameHeight: number;
  nameY: number;
  metaHeight: number;
  metaY: number;
  actionHeight: number;
  editorFlagHeight: number;
  editorHeaderHeight: number;
  editorBackHeight: number;
  editorBackWidth: number;
  statusHeight: number;
  toolbarColumns: number;
  toolbarCellHeight: number;
  rowGap: number;
  rowPadding: number;
  toggleWidth: number;
  toggleHeight: number;
  thumbSize: number;
  back: ReaderControlActorFrame;
  quickFooter: ReaderControlActorFrame;
}

export interface ReaderControlReplaceHeaderFrame {
  title: ReaderControlActorFrame;
  icon: ReaderControlActorFrame;
  action: ReaderControlActorFrame;
}

/** Header is a sibling of the viewport, not its child. Stage's header origin
 * is shell-local (13,19); live Header is (14,20). Keep this wrapper opacity 1
 * and unclipped: the persistent Quick title extends below its 30px bounds.
 */
export function sampleReaderControlReplaceHeader(progress: number,
  headerWidth: number): ReaderControlReplaceHeaderFrame {
  const p = readerControlUnit(progress);
  const actionX = Math.max(0, headerWidth - 41);
  return {
    title: sampleReaderControlActor(readerControlActor(66.55, 29.55, 208, 14),
      readerControlActor(25, 7.5, 84, 17), p),
    icon: sampleReaderControlActor(readerControlActor(1, 22, 16, 16, 0),
      readerControlActor(1, 8, 16, 16), p),
    action: sampleReaderControlActor(readerControlActor(actionX, 17, 40, 26, 0),
      readerControlActor(actionX, 3, 40, 26), p),
  };
}

/** Live 1938:11606 -> Stage viewport-local coordinates. Raw hold/ease is
 * intentionally replaced by the user's one shared continuous p. The Quick
 * three-row window is a projection, never a truncated source array.
 */
export function sampleReaderControlReplace(progress: number, availableWidth: number,
  availableHeight: number, minimum?: ReaderControlReplaceMinimumProfile, quickContentHeight: number = 190): ReaderControlReplaceFrame {
  const p = readerControlUnit(progress);
  const width = Math.max(0, availableWidth);
  const fullInset = 14;
  const quickInset = 17.55;
  const inset = readerControlLerp(quickInset, fullInset, p);
  const q = minimum?.quick; const f = minimum?.full;
  const qBackHeight = q?.backHeight ?? 24;
  const qListY = Math.max(47.55, 14.55 + qBackHeight + 9);
  const fullToolbarHeight = f === undefined ? 40 : Math.ceil(3 / f.toolbarColumns) * (f.toolbarCellHeight + 8) - 8;
  const fullListY = 14 + fullToolbarHeight + 10;
  const listY = readerControlLerp(qListY, fullListY, p);
  const qActionHeight = q?.actionHeight ?? 28;
  const quickFooterY = minimum === undefined ? 145 : quickContentHeight - qActionHeight - 17;
  const actionHeight = readerControlLerp(qActionHeight, f?.actionHeight ?? 28, p);
  const nameHeight = readerControlLerp(q?.nameHeight ?? 17, f?.nameHeight ?? 17, p);
  const rowHeight = readerControlLerp(q?.rowHeight ?? 28, f?.rowHeight ?? 77, p);
  return {
    progress: p,
    toolbar: sampleReaderControlActor(readerControlActor(14, 60, width - 28, 40, 0),
      readerControlActor(14, 14, width - 28, fullToolbarHeight), p),
    list: readerControlActor(inset, listY, width - readerControlLerp(36, 28, p),
      Math.max(0, availableHeight - listY - readerControlLerp(qActionHeight + 30.45, 13, p))),
    rowHeight, nameHeight, nameY: readerControlLerp(((q?.rowHeight ?? 28) - (q?.nameHeight ?? 17)) / 2, 11, p),
    metaHeight: readerControlLerp(q?.metaHeight ?? 34, f?.metaHeight ?? 34, p),
    metaY: 11 + nameHeight + 4, actionHeight,
    editorHeaderHeight: f?.editorHeaderHeight ?? 28, editorFlagHeight: f?.editorFlagHeight ?? 32, editorBackHeight: f?.editorBackHeight ?? 28, editorBackWidth: f?.editorBackWidth ?? 38,
    statusHeight: readerControlLerp(q?.statusHeight ?? 76, f?.statusHeight ?? 76, p),
    toolbarColumns: f?.toolbarColumns ?? 3,
    toolbarCellHeight: readerControlLerp(40, f?.toolbarCellHeight ?? 40, p), rowGap: readerControlLerp(0, 7, p),
    rowPadding: readerControlLerp(5, 13, p),
    toggleWidth: readerControlLerp(27, 44, p), toggleHeight: readerControlLerp(16, 24, p),
    thumbSize: readerControlLerp(12, 20, p),
    back: sampleReaderControlActor(readerControlActor(10.1, 14.55, q?.backWidth ?? 51, qBackHeight),
      readerControlActor(10.1, 28.55, 51, 24, 0), p),
    // Existing Quick preview/expand affordances are retained as an explicit
    // business overlay; they are not claimed as actors in this restored cohort.
    quickFooter: sampleReaderControlActor(readerControlActor(17.55, quickFooterY, width - 35.1, qActionHeight),
      readerControlActor(14, quickFooterY + 14, width - 28, qActionHeight, 0), p),
  };
}

export function readerControlReplaceEndpoint(progress: number, enabled: boolean): 'none' | 'quick' | 'full' {
  if (!enabled) return 'none';
  const p = readerControlUnit(progress);
  return p === 0 ? 'quick' : p === 1 ? 'full' : 'none';
}
