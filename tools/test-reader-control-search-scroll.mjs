import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import * as scroll from '../entry/src/main/ets/features/reading/ReaderControlSearchScroll.ts';
import { sampleReaderControlSearch } from '../entry/src/main/ets/features/reading/ReaderControlSearchGeometry.ts';

const near = (actual, expected, label) => assert.ok(Math.abs(actual - expected) < 1e-7,
  `${label}: ${actual} != ${expected}`);
function layout(p, resultCount = 20) {
  const frame = sampleReaderControlSearch(p, 286 + 52 * p, 190 + 476 * p);
  return { rowHeightVp: frame.rowHeight, viewportHeightVp: frame.results.height, resultCount };
}
const context = (progress, extra = {}) => ({ progress, inputEnabled: true, userScrolling: false, ...extra });
function observe(api, state, position, p = 0, source = 'drag', shape = layout(p), inputEnabled = true) {
  return api.observeReaderControlSearchScroll(state, shape,
    { nativeOffsetVp: position, source, progress: p, inputEnabled });
}
function initialScrolled(api = scroll) {
  return observe(api, api.createReaderControlSearchScroll(), 426 / 3.5);
}
function normalize(api, state, shape, p) {
  const prepared = api.prepareReaderControlSearchScrollRebase(state, shape, context(p));
  if (!prepared.command) return prepared.state;
  assert.ok(api.readerControlSearchScrollRebaseIsCurrent(prepared.state, prepared.command));
  const result = api.confirmReaderControlSearchScrollRebase(prepared.state, prepared.command,
    prepared.command.targetOffsetVp);
  assert.equal(result.pendingRebase, undefined);
  return result;
}

function checkProjection(api = scroll) {
  const state = initialScrolled(api), before = structuredClone(state);
  near(state.anchorRows, 426 / 3.5 / 54, 'native Quick observation has a semantic row anchor');
  const quick = api.sampleReaderControlSearchScroll(state, layout(0));
  const full = api.sampleReaderControlSearchScroll(state, layout(1));
  near(quick.offsetVp, 426 / 3.5, 'Quick uses actual native offset');
  near(full.offsetVp, 162.28571428571428, 'Full preserves 2.253968 rows, not the old pixel offset');
  near(full.translateYVp, -40.57142857142857, 'translation compensates one native base');
  for (const p of [0, .1, .45, .9, 1, .9, .45, .1, 0]) {
    const frame = api.sampleReaderControlSearchScroll(state, layout(p));
    near(frame.offsetVp / layout(p).rowHeightVp, state.anchorRows, 'same leading row at each unclamped phase');
    near(frame.translateYVp - state.nativeOffsetVp, -frame.offsetVp, 'native scroll and local translation compose once');
    assert.ok(frame.minContentHeightVp >= layout(p).viewportHeightVp + state.nativeOffsetVp);
    assert.deepEqual(api.sampleReaderControlSearchScroll(state, layout(p)), frame, 'same p is reversible/deterministic');
  }
  assert.deepEqual(state, before, 'sampling never writes the semantic anchor or native base');
}
checkProjection();

function checkNativeOwnership(api = scroll) {
  const original = initialScrolled(api);
  for (const source of ['layout', 'programmatic', 'unknown']) {
    const next = observe(api, original, 44, 1, source);
    assert.equal(next.anchorRows, original.anchorRows, `${source} cannot change a`);
    assert.equal(next.nativeOffsetVp, 44, `${source} records real B`);
    const projected = api.sampleReaderControlSearchScroll(next, layout(1));
    near(projected.translateYVp - 44, -162.28571428571428, `${source} does not jump the visible anchor`);
  }
  for (const source of ['drag', 'fling', 'scrollBar', 'scrollBarFling', 'otherUserInput']) {
    assert.equal(api.readerControlSearchScrollIsUserSource(source), true);
    const next = observe(api, original, original.nativeOffsetVp + 12, 0, source);
    near(next.anchorRows, original.anchorRows + 12 / 54, `${source} admits real endpoint delta`);
    for (const [p, enabled] of [[.5, true], [0, false], [1, false], [NaN, true]]) {
      const blocked = observe(api, original, 200, p, source, layout(0), enabled);
      assert.equal(blocked.anchorRows, original.anchorRows, 'unstable/disabled user callback cannot rewrite a');
      assert.equal(blocked.nativeOffsetVp, 200, 'even blocked input synchronizes actual native B');
    }
  }
  assert.equal(api.readerControlSearchScrollIsUserSource('unknown'), false);
}
checkNativeOwnership();

function checkRebase(api = scroll) {
  let state = initialScrolled(api);
  const a = state.anchorRows;
  const prepared = api.prepareReaderControlSearchScrollRebase(state, layout(1), context(1));
  assert.ok(prepared.command, 'Full requires one native normalization for reachable top');
  near(prepared.command.targetOffsetVp, 162.28571428571428, 'normalization target is visible Full offset');
  assert.equal(prepared.state.nativeOffsetVp, state.nativeOffsetVp, 'request does not invent a successful native offset');
  const repeated = api.prepareReaderControlSearchScrollRebase(prepared.state, layout(1), context(1));
  assert.equal(repeated.command, undefined, 'pending normalization is never issued every render/frame');

  const early = api.confirmReaderControlSearchScrollRebase(prepared.state, prepared.command, state.nativeOffsetVp);
  assert.ok(early.pendingRebase, 'unchanged immediate currentOffset is not an asynchronous success receipt');
  assert.equal(early.anchorRows, a);
  near(api.sampleReaderControlSearchScroll(early, layout(1)).translateYVp - early.nativeOffsetVp,
    -162.28571428571428, 'early readback retains exact compensation');
  const partial = api.confirmReaderControlSearchScrollRebase(early, prepared.command, 140);
  assert.ok(partial.pendingRebase, 'partial native movement is still pending');
  const confirmed = api.confirmReaderControlSearchScrollRebase(partial, prepared.command, 162.28571428571428);
  assert.equal(confirmed.pendingRebase, undefined);
  assert.equal(confirmed.anchorRows, a, 'controller normalization never becomes user scroll');
  assert.equal(api.prepareReaderControlSearchScrollRebase(confirmed, layout(1), context(1)).command, undefined);
  state = observe(api, confirmed, 0, 1);
  near(api.sampleReaderControlSearchScroll(state, layout(1)).offsetVp, 0,
    'after B121.714->162.286 normalization real Full native scroll reaches first row');

  // A native rounded readback completes once, without altering a or retry storms.
  const rounded = api.confirmReaderControlSearchScrollRebase(prepared.state, prepared.command,
    prepared.command.targetOffsetVp + .1);
  assert.equal(rounded.pendingRebase, undefined);
  assert.equal(rounded.anchorRows, a);
  assert.equal(api.prepareReaderControlSearchScrollRebase(rounded, layout(1), context(1)).command, undefined);

  for (const ctx of [context(.4), context(1, { inputEnabled: false }), context(1, { userScrolling: true })]) {
    const stopped = api.prepareReaderControlSearchScrollRebase(prepared.state, layout(1), ctx);
    assert.equal(stopped.command, undefined); assert.equal(stopped.state.pendingRebase, undefined);
    assert.equal(api.readerControlSearchScrollRebaseIsCurrent(stopped.state, prepared.command), false);
    assert.equal(api.confirmReaderControlSearchScrollRebase(stopped.state, prepared.command, 162.285714), stopped.state,
      're-grab/mid-morph/disabled old confirmation cannot overwrite current state');
  }
  const reset = api.resetReaderControlSearchScroll(prepared.state, 12);
  assert.equal(reset.anchorRows, 0); assert.equal(reset.nativeOffsetVp, 12);
  assert.equal(api.confirmReaderControlSearchScrollRebase(reset, prepared.command, 162.285714), reset,
    'old query receipt cannot reapply old normalization');
  const resized = api.prepareReaderControlSearchScrollRebase(prepared.state,
    { ...layout(1), viewportHeightVp: 800 }, context(1));
  assert.ok(resized.command && resized.command.revision > prepared.command.revision);
  assert.equal(api.confirmReaderControlSearchScrollRebase(resized.state, prepared.command, 162.285714), resized.state);
}
checkRebase();

function checkClampedRanges(api = scroll) {
  // Remember a deep Quick anchor through a larger Full window, then reverse.
  const quickLayout = layout(0, 12), fullLayout = layout(1, 12);
  const quickMax = api.sampleReaderControlSearchScroll(api.createReaderControlSearchScroll(), quickLayout).maxOffsetVp;
  let state = observe(api, api.createReaderControlSearchScroll(), quickMax, 0, 'drag', quickLayout);
  const remembered = state.anchorRows;
  const clamped = api.sampleReaderControlSearchScroll(state, fullLayout);
  near(clamped.offsetVp, clamped.maxOffsetVp, 'Full presentation clamps to real business bottom');
  assert.equal(state.anchorRows, remembered, 'presentation clamp does not destroy reverse path');
  near(api.sampleReaderControlSearchScroll(state, quickLayout).offsetVp, quickMax, 'Quick bottom restored on reverse');
  state = normalize(api, state, fullLayout, 1);
  assert.equal(state.anchorRows, remembered, 'native normalization also preserves unclamped a');
  // A zero delta callback is not actual movement and must not replace the old a.
  assert.equal(observe(api, state, state.nativeOffsetVp, 1, 'drag', fullLayout).anchorRows, remembered);
  state = observe(api, state, state.nativeOffsetVp - 20, 1, 'drag', fullLayout);
  near(api.sampleReaderControlSearchScroll(state, fullLayout).offsetVp, clamped.offsetVp - 20,
    'new user delta starts at clamped visible anchor, not the old deep offset');
  state = normalize(api, state, quickLayout, 0);
  state = observe(api, state, 0, 0, 'drag', quickLayout);
  near(api.sampleReaderControlSearchScroll(state, quickLayout).offsetVp, 0, 'reverse endpoint remains top-reachable');

  // System clamp after a long set shortens: synchronize B only, then real input
  // continues from the short set's visible bottom without reviving stale a.
  const longLayout = { rowHeightVp: 54, viewportHeightVp: 100, resultCount: 100 };
  const shortLayout = { rowHeightVp: 72, viewportHeightVp: 100, resultCount: 3 };
  state = observe(api, api.createReaderControlSearchScroll(), 4320, 0, 'drag', longLayout);
  const shortened = api.sampleReaderControlSearchScroll(state, shortLayout);
  assert.equal(shortened.offsetVp, 116);
  assert.ok(shortened.minContentHeightVp >= 4420, 'native B remains reachable until actual clamp acknowledgement');
  state = observe(api, state, 116, 1, 'layout', shortLayout);
  assert.equal(state.anchorRows, 80, 'system clamp does not become user intent');
  state = observe(api, state, 96, 1, 'drag', shortLayout);
  near(state.anchorRows, 96 / 72, 'shortened result user scroll rebases from visible anchor plus delta');
  assert.equal(api.sampleReaderControlSearchScroll(state, shortLayout).offsetVp, 96);
  state = normalize(api, state, shortLayout, 1);
  state = observe(api, state, 0, 1, 'drag', shortLayout);
  assert.equal(state.anchorRows, 0);

  // Synthetic out-of-range user observations cannot generate logical overscroll
  // or a phantom rebound; actual production Scroll uses EdgeEffect.None.
  state = observe(api, state, -50, 1, 'drag', shortLayout);
  assert.equal(state.nativeOffsetVp, 0); assert.equal(state.anchorRows, 0);
  state = observe(api, state, 0, 1, 'unknown', shortLayout);
  assert.equal(state.anchorRows, 0);
  state = observe(api, state, 116, 1, 'drag', shortLayout);
  state = observe(api, state, 900, 1, 'drag', shortLayout);
  assert.equal(state.nativeOffsetVp, 116); assert.equal(api.sampleReaderControlSearchScroll(state, shortLayout).offsetVp, 116);
  state = observe(api, state, 116, 1, 'unknown', shortLayout);
  assert.equal(api.sampleReaderControlSearchScroll(state, shortLayout).offsetVp, 116);
  const empty = { rowHeightVp: 72, viewportHeightVp: 100, resultCount: 0 };
  assert.equal(api.sampleReaderControlSearchScroll(state, empty).offsetVp, 0);
  assert.equal(api.sampleReaderControlSearchScroll(state, empty).minContentHeightVp, 216);
  const reset = api.resetReaderControlSearchScroll(state, state.nativeOffsetVp);
  assert.equal(api.sampleReaderControlSearchScroll(reset, empty).offsetVp, 0);
  assert.equal(normalize(api, reset, empty, 1).nativeOffsetVp, 0);
}
checkClampedRanges();

// Source receipt: Results is the fixed parent below the 51vp Query, not the
// moving first row. Canonical Full (slot 338x666) has y53/h612. Row local y is
// -38.45 -> 5, with source py5 retained as an independent trailing inset.
// These inputs isolate the production scroll policy from Geometry's adapter.
function sourceLayout(p, resultCount = 13) {
  return { rowHeightVp: 54 + 18 * p,
    viewportHeightVp: 190 + 476 * p - (2 + 28.443 * (1 - p) + 51) - 1,
    resultCount, contentOriginVp: -38.45 + 43.45 * p, contentEndPaddingVp: 5 };
}
function checkContentOrigin(api = scroll) {
  const quick = sourceLayout(0), full = sourceLayout(1);
  near(full.viewportHeightVp, 612, 'canonical source parent viewport is 612, not the old row-bound viewport');
  const start = api.createReaderControlSearchScroll();
  const q = api.sampleReaderControlSearchScroll(start, quick);
  const f = api.sampleReaderControlSearchScroll(start, full);
  near(q.contentHeightVp, 668.55, 'Quick extent includes negative source origin and separate py5');
  near(f.contentHeightVp, 946, 'Full extent includes source top5 and end5');
  near(q.maxOffsetVp, 560.993, 'Quick range uses actual fixed parent height');
  near(f.maxOffsetVp, 334, 'Full range preserves source bottom padding');

  for (const shape of [quick, full]) {
    const top = api.sampleReaderControlSearchScroll(start, shape);
    near(shape.contentOriginVp + top.translateYVp - start.nativeOffsetVp, shape.contentOriginVp,
      'top preserves authored first-row clipping/inset instead of cancelling the source trajectory');
    let bottom = observe(api, start, top.maxOffsetVp, shape === quick ? 0 : 1, 'drag', shape);
    const projected = api.sampleReaderControlSearchScroll(bottom, shape);
    near(projected.offsetVp, top.maxOffsetVp, 'real native bottom is reachable');
    near(shape.contentOriginVp + projected.translateYVp - bottom.nativeOffsetVp +
      shape.resultCount * shape.rowHeightVp, shape.viewportHeightVp - 5,
    'last actor at bottom retains exactly source py5, not an invented gap or clipped tail');
    bottom = observe(api, bottom, 0, shape === quick ? 0 : 1, 'drag', shape);
    near(api.sampleReaderControlSearchScroll(bottom, shape).offsetVp, 0, 'real native input returns to source top');
  }

  let state = observe(api, start, 81, 0, 'drag', quick);
  const remembered = structuredClone(state);
  for (const p of [0, .15, .5, .8, 1, .8, .5, .15, 0]) {
    const shape = sourceLayout(p), projected = api.sampleReaderControlSearchScroll(state, shape);
    near(projected.offsetVp, state.anchorRows * shape.rowHeightVp,
      'scroll projection never absorbs contentOriginVp into aH');
    near(shape.contentOriginVp + projected.translateYVp - state.nativeOffsetVp,
      shape.contentOriginVp - state.anchorRows * shape.rowHeightVp,
      'source actor movement composes once with native scroll compensation');
    assert.deepEqual(projected, api.sampleReaderControlSearchScroll(state, shape), 'same p is reversible');
  }
  assert.deepEqual(state, remembered, 'origin sampling cannot mutate scroll memory');

  state = observe(api, start, q.maxOffsetVp, 0, 'drag', quick);
  const quickAnchor = state.anchorRows;
  state = normalize(api, state, full, 1);
  near(state.nativeOffsetVp, 334, 'Full normalizes only to its legal clamped bottom');
  assert.equal(state.anchorRows, quickAnchor);
  for (const source of ['layout', 'programmatic', 'unknown', 'drag']) {
    const unchanged = observe(api, state, state.nativeOffsetVp, 1, source, full);
    assert.equal(unchanged.anchorRows, quickAnchor, 'non-user/zero actual delta cannot erase Quick bottom memory');
  }
  near(api.sampleReaderControlSearchScroll(state, quick).offsetVp, q.maxOffsetVp,
    'return Quick restores pre-clamp bottom despite Full origin/range change');
  state = normalize(api, state, quick, 0);
  near(state.nativeOffsetVp, q.maxOffsetVp, 'return Quick normalization makes actual bottom reachable');
  state = observe(api, state, 0, 0, 'drag', quick);
  near(state.anchorRows, 0, 'after reversal a real drag can reach Quick top');

  // Shortened results retain B while clamped presentation changes; real input
  // then continues from the visible range, never from a hidden old offset.
  state = observe(api, start, q.maxOffsetVp, 0, 'drag', quick);
  const short = { ...full, resultCount: 3, viewportHeightVp: 100 };
  const shortFrame = api.sampleReaderControlSearchScroll(state, short);
  near(shortFrame.maxOffsetVp, 126, 'short source extent includes two independent 5vp insets');
  assert.ok(shortFrame.minContentHeightVp >= short.viewportHeightVp + state.nativeOffsetVp);
  state = observe(api, state, 126, 1, 'layout', short);
  state = observe(api, state, 106, 1, 'drag', short);
  near(state.anchorRows, 106 / 72, 'new input after origin-aware clamp starts at visible O plus real delta');
  const reset = api.resetReaderControlSearchScroll(state, state.nativeOffsetVp);
  near(api.sampleReaderControlSearchScroll(reset, short).offsetVp, 0, 'new query projects its authored top');
  const empty = api.sampleReaderControlSearchScroll(reset, { ...full, resultCount: 0 });
  near(empty.contentHeightVp, 0, 'an empty result set has no synthetic origin or trailing-padding extent');

  // Defaults preserve every existing caller's coordinate model.
  const legacy = layout(1);
  assert.deepEqual(api.sampleReaderControlSearchScroll(reset, legacy),
    api.sampleReaderControlSearchScroll(reset, { ...legacy, contentOriginVp: 0, contentEndPaddingVp: 0 }));
}
checkContentOrigin();

function checkOriginRebase(api = scroll) {
  const quick = sourceLayout(0), full = sourceLayout(1);
  const initial = observe(api, api.createReaderControlSearchScroll(), 81, 0, 'drag', quick);
  const pending = api.prepareReaderControlSearchScrollRebase(initial, full, context(1));
  assert.ok(pending.command);
  assert.equal(pending.command.contentOriginVp, 5);
  assert.equal(pending.command.contentEndPaddingVp, 5);
  const early = api.confirmReaderControlSearchScrollRebase(pending.state, pending.command, 81);
  assert.ok(early.pendingRebase, 'source offset does not turn stale immediate readback into confirmation');
  for (const changed of [{ ...full, contentOriginVp: 6 }, { ...full, contentEndPaddingVp: 6 }]) {
    const next = api.prepareReaderControlSearchScrollRebase(early, changed, context(1));
    assert.ok(next.command && next.command.revision > pending.command.revision,
      'origin/end-padding change revokes the old layout ticket even if desired O happens to be unchanged');
    assert.equal(api.confirmReaderControlSearchScrollRebase(next.state, pending.command, 108), next.state);
  }
  for (const canceled of [api.cancelReaderControlSearchScrollRebase(early),
    api.resetReaderControlSearchScroll(early, 81)]) {
    assert.equal(api.confirmReaderControlSearchScrollRebase(canceled, pending.command, 108), canceled,
      're-grab/new data cancels source-aware old normalization');
  }
  for (const invalid of [{ ...full, contentOriginVp: NaN }, { ...full, contentOriginVp: Infinity },
    { ...full, contentEndPaddingVp: -1 }, { ...full, contentEndPaddingVp: NaN },
    { ...full, contentOriginVp: Number.MAX_VALUE, contentEndPaddingVp: Number.MAX_VALUE }]) {
    const projected = api.sampleReaderControlSearchScroll(initial, invalid);
    assert.ok(Object.values(projected).every(Number.isFinite));
    assert.equal(api.prepareReaderControlSearchScrollRebase(initial, invalid, context(1)).command, undefined);
  }
}
checkOriginRebase();

// Exact reviewer case: Full shows every result and therefore O=0. Merely
// touching the edge / receiving DRAG with zero actual delta must not consume
// the remembered Quick row anchor. Sampling back to Quick restores it.
{
  const quick = layout(0, 5), full = layout(1, 5);
  let state = observe(scroll, scroll.createReaderControlSearchScroll(), 54, 0, 'drag', quick);
  const originalAnchor = state.anchorRows;
  assert.equal(scroll.sampleReaderControlSearchScroll(state, full).maxOffsetVp, 0);
  assert.equal(scroll.sampleReaderControlSearchScroll(state, full).offsetVp, 0);
  state = normalize(scroll, state, full, 1);
  assert.equal(state.nativeOffsetVp, 0);
  state = observe(scroll, state, 0, 1, 'drag', full);
  assert.equal(state.anchorRows, originalAnchor, 'zero actual Full delta preserves Quick anchor despite O=0');
  near(scroll.sampleReaderControlSearchScroll(state, quick).offsetVp, 54, 'Quick still projects original one-row offset');
}

// Invalid native reads are not synthetic scroll commands or anchors.
const unchanged = initialScrolled();
assert.equal(observe(scroll, unchanged, NaN), unchanged);
for (const invalid of [layout(0, -1), { ...layout(0), rowHeightVp: 0 },
  { ...layout(0), viewportHeightVp: NaN }, { ...layout(0), resultCount: Infinity }]) {
  const projected = scroll.sampleReaderControlSearchScroll(unchanged, invalid);
  assert.ok(Object.values(projected).every(Number.isFinite));
  assert.equal(scroll.prepareReaderControlSearchScrollRebase(unchanged, invalid, context(0)).command, undefined);
}

const source = readFileSync(new URL('../entry/src/main/ets/features/reading/ReaderControlSearchScroll.ts', import.meta.url), 'utf8');
assert.doesNotMatch(source, /(?:setTimeout|setInterval|animateTo|scrollTo|postFrameCallback)\s*\(/,
  'pure policy cannot own a clock or execute native scrolling');
function mutated(from, to) {
  assert.ok(source.includes(from), `production mutation target exists: ${from}`);
  const js = stripTypeScriptTypes(source.replace(from, to)).replace(/^export /gm, '');
  return new Function(`${js};return { ${Object.keys(scroll).join(',')} };`)();
}
assert.throws(() => checkProjection(mutated('base - offset', '0')), 'kills frozen pixel-offset projection');
assert.throws(() => checkClampedRanges(mutated('projection.offsetVp + delta',
  'state.anchorRows * layout.rowHeightVp + delta')), 'kills input based on invisible unclamped anchor');
assert.throws(() => checkNativeOwnership(mutated('user && observation.inputEnabled',
  'observation.inputEnabled')), 'kills layout callback rewriting user anchor');
assert.throws(() => checkRebase(mutated('pendingRebase: reached ? undefined : state.pendingRebase',
  'pendingRebase: undefined')), 'kills immediate stale native readback confirmation');
assert.throws(() => checkContentOrigin(mutated(
  'Math.max(0, layout.resultCount * layout.rowHeightVp + contentOrigin(layout) + contentEndPadding(layout))',
  'Math.max(0, layout.resultCount * layout.rowHeightVp + contentEndPadding(layout))')),
'kills extent that ignores the authored first-row origin');
assert.throws(() => checkContentOrigin(mutated(
  'Math.max(0, layout.resultCount * layout.rowHeightVp + contentOrigin(layout) + contentEndPadding(layout))',
  'Math.max(0, layout.resultCount * layout.rowHeightVp + contentOrigin(layout))')),
'kills extent that drops the independent source bottom padding');
assert.throws(() => checkContentOrigin(mutated(
  'nonnegative(state.anchorRows) * layout.rowHeightVp : 0',
  'Math.max(0, nonnegative(state.anchorRows) * layout.rowHeightVp + contentOrigin(layout)) : 0')),
'kills scroll offset that cancels the authored child trajectory');
assert.throws(() => checkOriginRebase(mutated('pending.contentOriginVp === contentOrigin(layout) &&',
  'true &&')), 'kills stale rebase ticket retained after an origin-only layout change');
assert.throws(() => checkOriginRebase(mutated('pending.contentEndPaddingVp === contentEndPadding(layout) &&',
  'true &&')), 'kills stale rebase ticket retained after a padding-only layout change');
console.log('PASS Search scroll: production row projection, source origin/end-padding, both-end reachability, guarded async rebase, clamp/user continuation, callback ownership and 9 mutations; NOT device acceptance');
