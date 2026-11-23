/**
 * Control-bar list placement policy (execution reference D-01 through D-03).
 *
 * A chapterOrdinal is the position in the canonical, unfiltered reading order,
 * not an index in a sorted/filtered visible list and not necessarily a Core id.
 * The host keeps this state across Quick/Full morphs and cancelled closes.
 * No function here sorts or mutates a directory/bookmark business projection.
 */
export interface ReaderControlDirectoryPosition {
  chapterOrdinal: number;
}

export interface ReaderControlBookmarkPosition {
  chapterOrdinal: number;
  chapterOffset: number;
}

export interface ReaderControlListViewport {
  viewportHeight: number;
  contentHeight: number;
  targetTop: number;
  targetHeight: number;
}

export interface ReaderControlUniformListLayout {
  rowCount: number;
  rowIndex: number;
  rowHeight: number;
  rowSpacing: number;
  paddingTop: number;
  paddingBottom: number;
  viewportHeight: number;
}

export type ReaderControlListPositioningStatus = 'inactive' | 'pending' | 'positioned' | 'userScrolled';

export interface ReaderControlListPositioningState {
  listKey: string;
  listOpenRevision: number;
  preparationRevision: number;
  currentChapterOrdinal: number;
  status: ReaderControlListPositioningStatus;
}

export interface ReaderControlListPositionCommand {
  listKey: string;
  listOpenRevision: number;
  preparationRevision: number;
  yOffset: number;
}

export interface ReaderControlListPositionPreparation {
  state: ReaderControlListPositioningState;
  command: ReaderControlListPositionCommand | undefined;
}

function validOrdinal(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

function finiteNonnegative(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

function nextRevision(revision: number): number {
  // Never wrap into a revision that could re-admit an old queued callback.
  if (!Number.isSafeInteger(revision) || revision < 0 || revision >= Number.MAX_SAFE_INTEGER) {
    throw new Error('ReaderControlListPositioning: exhausted or invalid revision');
  }
  return revision + 1;
}

/** Return the matching row in the current projection, without changing its order. */
export function readerControlDirectoryTargetRow(
  rows: ReaderControlDirectoryPosition[],
  currentChapterOrdinal: number,
): number | undefined {
  if (!validOrdinal(currentChapterOrdinal)) return undefined;
  for (let index = 0; index < rows.length; index += 1) {
    if (rows[index].chapterOrdinal === currentChapterOrdinal) return index;
  }
  return undefined;
}

/**
 * Compare chapter distance first, then reading order (chapter, scalar offset).
 * Equal anchors keep the first existing row; creation time is never consulted.
 */
export function readerControlNearestBookmarkRow(
  rows: ReaderControlBookmarkPosition[],
  currentChapterOrdinal: number,
): number | undefined {
  if (!validOrdinal(currentChapterOrdinal)) return undefined;
  let selectedIndex: number | undefined = undefined;
  let selectedDistance = Number.POSITIVE_INFINITY;
  let selectedChapter = Number.POSITIVE_INFINITY;
  let selectedOffset = Number.POSITIVE_INFINITY;
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    if (!validOrdinal(row.chapterOrdinal) || !validOrdinal(row.chapterOffset)) continue;
    const distance = Math.abs(row.chapterOrdinal - currentChapterOrdinal);
    if (distance < selectedDistance ||
      (distance === selectedDistance && row.chapterOrdinal < selectedChapter) ||
      (distance === selectedDistance && row.chapterOrdinal === selectedChapter &&
        row.chapterOffset < selectedOffset)) {
      selectedIndex = index;
      selectedDistance = distance;
      selectedChapter = row.chapterOrdinal;
      selectedOffset = row.chapterOffset;
    }
  }
  return selectedIndex;
}

/**
 * Use measured content coordinates; no synthetic edge padding is introduced.
 * Unmeasured/missing targets are undefined, not an invented scroll-to-top.
 */
export function readerControlCenteredListOffset(
  viewport: ReaderControlListViewport,
): number | undefined {
  if (!Number.isFinite(viewport.viewportHeight) || viewport.viewportHeight <= 0 ||
    !Number.isFinite(viewport.contentHeight) || viewport.contentHeight <= 0 ||
    !finiteNonnegative(viewport.targetTop) ||
    !Number.isFinite(viewport.targetHeight) || viewport.targetHeight <= 0 ||
    viewport.targetTop + viewport.targetHeight > viewport.contentHeight) {
    return undefined;
  }
  const centeredOffset = viewport.targetTop + viewport.targetHeight / 2 - viewport.viewportHeight / 2;
  const maxOffset = Math.max(0, viewport.contentHeight - viewport.viewportHeight);
  return Math.min(maxOffset, Math.max(0, centeredOffset));
}

/** Adapter for the existing fixed-height directory/bookmark rows. */
export function readerControlUniformListViewport(
  layout: ReaderControlUniformListLayout,
): ReaderControlListViewport | undefined {
  if (!Number.isSafeInteger(layout.rowCount) || layout.rowCount <= 0 ||
    !Number.isSafeInteger(layout.rowIndex) || layout.rowIndex < 0 || layout.rowIndex >= layout.rowCount ||
    !Number.isFinite(layout.rowHeight) || layout.rowHeight <= 0 ||
    !finiteNonnegative(layout.rowSpacing) || !finiteNonnegative(layout.paddingTop) ||
    !finiteNonnegative(layout.paddingBottom) ||
    !Number.isFinite(layout.viewportHeight) || layout.viewportHeight <= 0) {
    return undefined;
  }
  const contentHeight = layout.paddingTop + layout.paddingBottom + layout.rowCount * layout.rowHeight +
    (layout.rowCount - 1) * layout.rowSpacing;
  const targetTop = layout.paddingTop + layout.rowIndex * (layout.rowHeight + layout.rowSpacing);
  if (!Number.isFinite(contentHeight) || !Number.isFinite(targetTop)) return undefined;
  return {
    viewportHeight: layout.viewportHeight,
    contentHeight,
    targetTop,
    targetHeight: layout.rowHeight,
  };
}

export function createReaderControlListPositioning(): ReaderControlListPositioningState {
  return {
    listKey: '',
    listOpenRevision: 0,
    preparationRevision: 0,
    currentChapterOrdinal: -1,
    status: 'inactive',
  };
}

/** New list entry/tab reveal only; listKey must include the owning book/session. */
export function beginReaderControlListOpen(
  state: ReaderControlListPositioningState,
  listKey: string,
  currentChapterOrdinal: number,
): ReaderControlListPositioningState {
  if (listKey.length === 0 || !validOrdinal(currentChapterOrdinal)) {
    throw new Error('ReaderControlListPositioning: a list identity and reading chapter are required');
  }
  return {
    listKey,
    listOpenRevision: nextRevision(state.listOpenRevision),
    preparationRevision: 0,
    currentChapterOrdinal,
    status: 'pending',
  };
}

/** Quick/Full morph, re-grab and cancelled close retain the same open token. */
export function retainReaderControlListPositioning(
  state: ReaderControlListPositioningState,
): ReaderControlListPositioningState {
  return state;
}

/** Call only when leaving this list or when the whole control close commits. */
export function endReaderControlListOpen(
  state: ReaderControlListPositioningState,
): ReaderControlListPositioningState {
  return {
    listKey: '',
    listOpenRevision: nextRevision(state.listOpenRevision),
    preparationRevision: 0,
    currentChapterOrdinal: -1,
    status: 'inactive',
  };
}

/** Programmatic scroll callbacks must not be forwarded as user scroll intent. */
export function markReaderControlListUserScrolled(
  state: ReaderControlListPositioningState,
  listOpenRevision: number,
): ReaderControlListPositioningState {
  if (state.status === 'inactive' || state.status === 'userScrolled' ||
    state.listOpenRevision !== listOpenRevision) return state;
  return {
    listKey: state.listKey,
    listOpenRevision: state.listOpenRevision,
    preparationRevision: state.preparationRevision,
    currentChapterOrdinal: state.currentChapterOrdinal,
    status: 'userScrolled',
  };
}

/**
 * Recompute from the latest projection and actual viewport after layout.
 * Every pending preparation invalidates its previous queued command, including
 * loading/empty/unavailable updates. It never fabricates a target for them.
 */
export function prepareReaderControlListPosition(
  state: ReaderControlListPositioningState,
  listOpenRevision: number,
  dataReady: boolean,
  viewport: ReaderControlListViewport | undefined,
): ReaderControlListPositionPreparation {
  if (state.status !== 'pending' || state.listOpenRevision !== listOpenRevision) {
    return { state, command: undefined };
  }
  const prepared: ReaderControlListPositioningState = {
    listKey: state.listKey,
    listOpenRevision: state.listOpenRevision,
    preparationRevision: nextRevision(state.preparationRevision),
    currentChapterOrdinal: state.currentChapterOrdinal,
    status: state.status,
  };
  const yOffset = dataReady && viewport !== undefined ? readerControlCenteredListOffset(viewport) : undefined;
  if (yOffset === undefined) return { state: prepared, command: undefined };
  const command: ReaderControlListPositionCommand = {
    listKey: prepared.listKey,
    listOpenRevision: prepared.listOpenRevision,
    preparationRevision: prepared.preparationRevision,
    yOffset,
  };
  return { state: prepared, command };
}

/** Recheck immediately before the synchronous scroll; never trust a queued plan. */
export function readerControlListPositionIsCurrent(
  state: ReaderControlListPositioningState,
  command: ReaderControlListPositionCommand,
): boolean {
  return state.status === 'pending' && state.listKey === command.listKey &&
    state.listOpenRevision === command.listOpenRevision &&
    state.preparationRevision === command.preparationRevision &&
    finiteNonnegative(command.yOffset);
}

/**
 * After a current command is synchronously applied, consume this open's single
 * positioning opportunity. If applying the scroll throws, do not commit it.
 */
export function commitReaderControlListPosition(
  state: ReaderControlListPositioningState,
  command: ReaderControlListPositionCommand,
): ReaderControlListPositioningState {
  if (!readerControlListPositionIsCurrent(state, command)) return state;
  return {
    listKey: state.listKey,
    listOpenRevision: state.listOpenRevision,
    preparationRevision: state.preparationRevision,
    currentChapterOrdinal: state.currentChapterOrdinal,
    status: 'positioned',
  };
}
