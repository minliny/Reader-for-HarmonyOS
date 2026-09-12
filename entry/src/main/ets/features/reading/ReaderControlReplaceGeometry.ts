import {
  readerControlActor, readerControlLerp, readerControlUnit, sampleReaderControlActor,
  type ReaderControlActorFrame,
} from './ReaderControlActorGeometry';

export interface ReaderControlReplaceFrame {
  progress: number;
  toolbar: ReaderControlActorFrame;
  list: ReaderControlActorFrame;
  rowHeight: number;
  rowGap: number;
  rowPadding: number;
  toggleWidth: number;
  toggleHeight: number;
  thumbSize: number;
  nameSize: number;
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
  availableHeight: number): ReaderControlReplaceFrame {
  const p = readerControlUnit(progress);
  const width = Math.max(0, availableWidth);
  const fullInset = 14;
  const quickInset = 17.55;
  const inset = readerControlLerp(quickInset, fullInset, p);
  const listY = readerControlLerp(47.55, 64, p);
  return {
    progress: p,
    toolbar: sampleReaderControlActor(readerControlActor(14, 60, width - 28, 40, 0),
      readerControlActor(14, 14, width - 28, 40), p),
    list: readerControlActor(inset, listY, width - readerControlLerp(36, 28, p),
      Math.max(0, availableHeight - readerControlLerp(106, 77, p))),
    rowHeight: readerControlLerp(28, 77, p), rowGap: readerControlLerp(0, 7, p),
    rowPadding: readerControlLerp(5, 13, p),
    toggleWidth: readerControlLerp(27, 44, p), toggleHeight: readerControlLerp(16, 24, p),
    thumbSize: readerControlLerp(12, 20, p),
    // Execution reference M-02 overrides recovered text scaling: native rule
    // names keep the Full 12fp size while their row/window geometry changes.
    nameSize: 12,
    back: sampleReaderControlActor(readerControlActor(10.1, 14.55, 51, 24),
      readerControlActor(10.1, 28.55, 51, 24, 0), p),
    // Existing Quick preview/expand affordances are retained as an explicit
    // business overlay; they are not claimed as actors in this restored cohort.
    quickFooter: sampleReaderControlActor(readerControlActor(17.55, 145, width - 35.1, 28),
      readerControlActor(14, 159, width - 28, 28, 0), p),
  };
}

export function readerControlReplaceEndpoint(progress: number, enabled: boolean): 'none' | 'quick' | 'full' {
  if (!enabled) return 'none';
  const p = readerControlUnit(progress);
  return p === 0 ? 'quick' : p === 1 ? 'full' : 'none';
}
