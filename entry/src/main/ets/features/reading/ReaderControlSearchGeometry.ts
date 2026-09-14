import { readerControlActor as actor, readerControlLerp as lerp, readerControlUnit as unit,
  sampleReaderControlActor as sample, type ReaderControlActorFrame } from './ReaderControlActorGeometry.ts';

export interface ReaderControlSearchFrame {
  field: ReaderControlActorFrame;
  action: ReaderControlActorFrame;
  back: ReaderControlActorFrame;
  /** Results viewport begins immediately below the current query row. */
  results: ReaderControlActorFrame;
  /** First row in Results-local coordinates, including its authored motion. */
  firstResult: ReaderControlActorFrame;
  rowHeight: number;
  resultEndPadding: number;
  queryDivider: ReaderControlActorFrame;
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
  availableHeight: number): ReaderControlSearchFrame {
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
  const queryBottom = basisY + field.y + field.height + lerp(5, 9, progress);
  const resultsY = queryBottom + 1;
  const resultOriginCorrection = basisY + 51 - resultsY;
  return {
    field: actor(basisX + field.x, basisY + field.y,
      Math.max(0, field.width + widthDelta), field.height),
    action: actor(Math.max(0, basisX + action.x + widthDelta), basisY + action.y,
      Math.min(width, action.width), action.height),
    // Back is a screen-level sibling, NOT under the moving source shell.
    back: sample(actor(10.1, 12.99, 51, 24), actor(10.1, 404.99, 51, 24, 0), progress),
    // Full 1938:5101 remains (2,53,334,612) in its canonical 338x666 slot.
    // Quick adapts this viewport to the query instead of retaining Full's
    // empty band; compensate the row origin below to preserve screen paths.
    results: actor(basisX, resultsY, Math.max(0, width - 4), Math.max(0, height - resultsY - 1)),
    firstResult: actor(first.x, first.y + resultOriginCorrection,
      Math.max(0, first.width + widthDelta), first.height),
    rowHeight: first.height,
    // Source Results inner wrapper uses py-[5px]. The first row's static y=5
    // already contains its top padding; retain the bottom padding separately.
    resultEndPadding: 5,
    queryDivider: actor(basisX, queryBottom, Math.max(0, width - 4), 1),
  };
}
