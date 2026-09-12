/** Search result scroll coordinates, independent of the Stage's motion clock.
 * rowHeightVp/viewportHeightVp come from the existing Figma geometry sampler.
 * Native scrolling must use EdgeEffect.None; elastic overscroll is not a
 * second reading-position owner. Query/result identity resets belong to Content.
 */
export type ReaderControlSearchScrollSource = 'drag' | 'fling' | 'scrollBar' |
  'scrollBarFling' | 'otherUserInput' | 'layout' | 'programmatic' | 'unknown';

export interface ReaderControlSearchScrollLayout {
  rowHeightVp: number;
  viewportHeightVp: number;
  resultCount: number;
  /** Authored first-row origin inside the fixed clipping parent. May be
   * negative. Content applies it once, separately from B-O compensation. */
  contentOriginVp?: number;
  /** Authored trailing inset, independent of the animated row origin. */
  contentEndPaddingVp?: number;
}

export interface ReaderControlSearchScrollContext {
  progress: number;
  inputEnabled: boolean;
  userScrolling: boolean;
  /** Readback rounding tolerance only, never a gesture settlement threshold. */
  nativeToleranceVp?: number;
}

export interface ReaderControlSearchScrollRebase {
  revision: number;
  targetOffsetVp: number;
  toleranceVp: number;
  rowHeightVp: number;
  viewportHeightVp: number;
  resultCount: number;
  contentOriginVp: number;
  contentEndPaddingVp: number;
}

export interface ReaderControlSearchScrollState {
  /** Scroll distance in row units. The authored first-row origin remains a
   * separate actor transform; sampling never clamps this remembered value. */
  anchorRows: number;
  /** Last confirmed real Scroller offset, not the desired visual offset. */
  nativeOffsetVp: number;
  revision: number;
  pendingRebase?: ReaderControlSearchScrollRebase;
}

export interface ReaderControlSearchScrollProjection {
  offsetVp: number;
  translateYVp: number;
  contentHeightVp: number;
  minContentHeightVp: number;
  maxOffsetVp: number;
}

export interface ReaderControlSearchScrollObservation {
  nativeOffsetVp: number;
  source: ReaderControlSearchScrollSource;
  progress: number;
  inputEnabled: boolean;
}

export interface ReaderControlSearchScrollPreparation {
  state: ReaderControlSearchScrollState;
  command?: ReaderControlSearchScrollRebase;
}

function nonnegative(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function contentOrigin(layout: ReaderControlSearchScrollLayout): number {
  return layout.contentOriginVp === undefined ? 0 : layout.contentOriginVp;
}

function contentEndPadding(layout: ReaderControlSearchScrollLayout): number {
  return layout.contentEndPaddingVp === undefined ? 0 : layout.contentEndPaddingVp;
}

function validLayout(layout: ReaderControlSearchScrollLayout): boolean {
  return Number.isFinite(layout.rowHeightVp) && layout.rowHeightVp > 0 &&
    Number.isFinite(layout.viewportHeightVp) && layout.viewportHeightVp >= 0 &&
    Number.isSafeInteger(layout.resultCount) && layout.resultCount >= 0 &&
    Number.isFinite(layout.resultCount * layout.rowHeightVp) &&
    Number.isFinite(contentOrigin(layout)) && Number.isFinite(contentEndPadding(layout)) &&
    contentEndPadding(layout) >= 0 &&
    Number.isFinite(layout.resultCount * layout.rowHeightVp + contentOrigin(layout) + contentEndPadding(layout));
}

function endpoint(progress: number): boolean { return progress === 0 || progress === 1; }

function nextRevision(revision: number): number {
  if (!Number.isSafeInteger(revision) || revision < 0 || revision >= Number.MAX_SAFE_INTEGER) {
    throw new Error('ReaderControlSearchScroll: invalid or exhausted revision');
  }
  return revision + 1;
}

function tolerance(context: ReaderControlSearchScrollContext): number {
  return context.nativeToleranceVp !== undefined && Number.isFinite(context.nativeToleranceVp) &&
    context.nativeToleranceVp >= 0 ? context.nativeToleranceVp : 0.5;
}

export function createReaderControlSearchScroll(nativeOffsetVp: number = 0): ReaderControlSearchScrollState {
  return { anchorRows: 0, nativeOffsetVp: nonnegative(nativeOffsetVp), revision: 0 };
}

/** Keep the measured native base until Content's single reset rebase is read
 * back. Resetting the semantic anchor alone already projects the new query top.
 */
export function resetReaderControlSearchScroll(state: ReaderControlSearchScrollState,
  nativeOffsetVp: number = 0): ReaderControlSearchScrollState {
  return { anchorRows: 0, nativeOffsetVp: nonnegative(nativeOffsetVp), revision: nextRevision(state.revision) };
}

export function sampleReaderControlSearchScroll(state: ReaderControlSearchScrollState,
  layout: ReaderControlSearchScrollLayout): ReaderControlSearchScrollProjection {
  const viewport = nonnegative(layout.viewportHeightVp);
  // This is native range adaptation, not a change to the authored child
  // trajectory. Keep the actual rows at N*H in a top-aligned inner tree;
  // Content's outer extent owns this possibly smaller/larger measured height.
  const content = validLayout(layout) && layout.resultCount > 0 ?
    Math.max(0, layout.resultCount * layout.rowHeightVp + contentOrigin(layout) + contentEndPadding(layout)) : 0;
  const maxOffset = Math.max(0, content - viewport);
  const desired = validLayout(layout) ? nonnegative(state.anchorRows) * layout.rowHeightVp : 0;
  const offset = Math.min(maxOffset, desired);
  const base = nonnegative(state.nativeOffsetVp);
  return {
    offsetVp: offset,
    translateYVp: base - offset,
    contentHeightVp: content,
    // Preserve an already valid native base even if the viewport grows or
    // results shorten. Padding is not additional business-scrollable results.
    minContentHeightVp: Math.max(content, viewport + base),
    maxOffsetVp: maxOffset,
  };
}

export function readerControlSearchScrollIsUserSource(source: ReaderControlSearchScrollSource): boolean {
  return source === 'drag' || source === 'fling' || source === 'scrollBar' ||
    source === 'scrollBarFling' || source === 'otherUserInput';
}

/** Read absolute currentOffset() after the native callback; callback deltas
 * alone cannot distinguish layout clamps from user movement. Unknown/layout/
 * controller callbacks update only B, so B-O still produces the same picture.
 */
export function observeReaderControlSearchScroll(state: ReaderControlSearchScrollState,
  layout: ReaderControlSearchScrollLayout,
  observation: ReaderControlSearchScrollObservation): ReaderControlSearchScrollState {
  if (!Number.isFinite(observation.nativeOffsetVp)) return state;
  const user = readerControlSearchScrollIsUserSource(observation.source);
  const projection = sampleReaderControlSearchScroll(state, layout);
  let base = nonnegative(observation.nativeOffsetVp);
  let anchor = state.anchorRows;
  if (user && observation.inputEnabled && endpoint(observation.progress) &&
    validLayout(layout) && layout.viewportHeightVp > 0) {
    // With EdgeEffect.None, native input is bounded by the currently rendered
    // extent. Reject synthetic overscroll rather than growing the padding from
    // it or turning the rebound into a second user scroll.
    const nativeMax = Math.max(0, projection.minContentHeightVp - layout.viewportHeightVp);
    base = Math.min(nativeMax, base);
    const delta = base - nonnegative(state.nativeOffsetVp);
    // Start from what is actually visible, not an out-of-range remembered a.
    // This is crucial after viewport growth or a long result set becoming short.
    if (delta !== 0) {
      const desired = Math.min(projection.maxOffsetVp, Math.max(0, projection.offsetVp + delta));
      anchor = desired / layout.rowHeightVp;
    }
  }
  const cancel = user && state.pendingRebase !== undefined;
  if (base === state.nativeOffsetVp && anchor === state.anchorRows && !cancel) return state;
  return {
    anchorRows: anchor, nativeOffsetVp: base,
    revision: cancel ? nextRevision(state.revision) : state.revision,
    pendingRebase: cancel ? undefined : state.pendingRebase,
  };
}

export function cancelReaderControlSearchScrollRebase(
  state: ReaderControlSearchScrollState): ReaderControlSearchScrollState {
  if (state.pendingRebase === undefined) return state;
  return { anchorRows: state.anchorRows, nativeOffsetVp: state.nativeOffsetVp,
    revision: nextRevision(state.revision) };
}

/** One non-animated normalization at a stable, untouched endpoint. It is
 * necessary for native top/bottom reachability after a row-height change.
 * Merely translating with a forever-frozen B can strand the visual first row
 * below native offset zero. Never dispatch this command during finger input.
 */
export function prepareReaderControlSearchScrollRebase(state: ReaderControlSearchScrollState,
  layout: ReaderControlSearchScrollLayout,
  context: ReaderControlSearchScrollContext): ReaderControlSearchScrollPreparation {
  if (!context.inputEnabled || context.userScrolling || !endpoint(context.progress) ||
    !validLayout(layout) || layout.viewportHeightVp <= 0) {
    return { state: cancelReaderControlSearchScrollRebase(state) };
  }
  const projection = sampleReaderControlSearchScroll(state, layout);
  let current = state;
  if (current.pendingRebase !== undefined) {
    const pending = current.pendingRebase;
    if (pending.rowHeightVp === layout.rowHeightVp && pending.viewportHeightVp === layout.viewportHeightVp &&
      pending.resultCount === layout.resultCount && pending.contentOriginVp === contentOrigin(layout) &&
      pending.contentEndPaddingVp === contentEndPadding(layout) && pending.targetOffsetVp === projection.offsetVp) {
      return { state: current };
    }
    current = cancelReaderControlSearchScrollRebase(current);
  }
  const allowedError = tolerance(context);
  if (Math.abs(current.nativeOffsetVp - projection.offsetVp) <= allowedError) return { state: current };
  const command: ReaderControlSearchScrollRebase = {
    revision: nextRevision(current.revision), targetOffsetVp: projection.offsetVp, toleranceVp: allowedError,
    rowHeightVp: layout.rowHeightVp, viewportHeightVp: layout.viewportHeightVp, resultCount: layout.resultCount,
    contentOriginVp: contentOrigin(layout), contentEndPaddingVp: contentEndPadding(layout),
  };
  return { state: { anchorRows: current.anchorRows, nativeOffsetVp: current.nativeOffsetVp,
    revision: command.revision, pendingRebase: command }, command: command };
}

export function readerControlSearchScrollRebaseIsCurrent(state: ReaderControlSearchScrollState,
  command: ReaderControlSearchScrollRebase): boolean {
  return state.pendingRebase !== undefined && state.revision === command.revision &&
    state.pendingRebase.revision === command.revision &&
    state.pendingRebase.targetOffsetVp === command.targetOffsetVp &&
    state.pendingRebase.contentOriginVp === command.contentOriginVp &&
    state.pendingRebase.contentEndPaddingVp === command.contentEndPaddingVp;
}

/** An asynchronous controller callback is never a user anchor update. A stale
 * receipt cannot overwrite a re-grab/reset; an unchanged pre-scroll readback
 * cannot pretend the command finished. While waiting, retain B-O compensation.
 */
export function confirmReaderControlSearchScrollRebase(state: ReaderControlSearchScrollState,
  command: ReaderControlSearchScrollRebase, actualNativeOffsetVp: number): ReaderControlSearchScrollState {
  if (!readerControlSearchScrollRebaseIsCurrent(state, command) || !Number.isFinite(actualNativeOffsetVp)) return state;
  const base = nonnegative(actualNativeOffsetVp);
  const reached = Math.abs(base - command.targetOffsetVp) <= command.toleranceVp;
  return { anchorRows: state.anchorRows, nativeOffsetVp: base, revision: state.revision,
    pendingRebase: reached ? undefined : state.pendingRebase };
}
