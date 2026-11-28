const UNSIGNED_MISSING_CHILD_INDEX = 0xffffffff;
const INVALID_CHILD_INDEX = -1;

interface ReaderFrameChildQueryRange {
  readonly first: number;
  readonly last: number;
  readonly byMountedIndex: boolean;
}

/** The range API reports expanded indices; NOT_EXPAND addresses mounted frames. */
export function readerFrameChildQueryRange(rawFirst: number, rawLast: number,
  queryBudget: number): ReaderFrameChildQueryRange | undefined {
  const first = rawFirst === UNSIGNED_MISSING_CHILD_INDEX ? INVALID_CHILD_INDEX : rawFirst;
  const last = rawLast === UNSIGNED_MISSING_CHILD_INDEX ? INVALID_CHILD_INDEX : rawLast;
  if (first === INVALID_CHILD_INDEX && last === INVALID_CHILD_INDEX) return undefined;
  if (Number.isInteger(first) && Number.isInteger(last) && first >= 0 && last >= first &&
    last - first + 1 <= queryBudget) {
    return { first, last, byMountedIndex: false };
  }
  return { first: 0, last: INVALID_CHILD_INDEX, byMountedIndex: true };
}
