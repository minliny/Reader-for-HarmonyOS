import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import * as gesture from '/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderPageGestureState.ts';

// Read-only production-method probes. Mocked surrounding state is explicit;
// these results do not measure ArkUI timing, rendering, or a real pointer.
const base = '/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/';
function make(file, names, bindings = {}) {
  const s = readFileSync(base + file, 'utf8');
  const methods = names.map(name => {
    const start = s.indexOf(`  private ${name}(`);
    assert.ok(start >= 0, name);
    const end = s.indexOf('\n  private ', start + 10);
    return s.slice(start, end < 0 ? s.lastIndexOf('\n}') : end);
  });
  return new Function(...Object.keys(bindings), stripTypeScriptTypes(
    `class Probe {\n${methods.join('\n')}\n}`, { mode: 'strip' }) + '\nreturn Probe;')(...Object.values(bindings));
}
const Queue = make('LocalReadingExperience.ets', ['schedulePageTurnPreparation'], {
  readerPageTransitionUsesPreparedPages: () => true, setTimeout: () => 0,
});
const q = Object.assign(new Queue(), { pageTurnGeneration: 1, pageTurnRenderRevision: 0 });
q.schedulePageTurnPreparation();
assert.deepEqual(q.pageTurnPreparationQueue, ['next', 'previous']);
console.log(JSON.stringify({ case: 'default preparation order', directions: q.pageTurnPreparationQueue }));

const Target = make('LocalReadingExperience.ets', ['adjacentPageTurnTarget'], {
  ReaderPageTurnTarget: class { constructor(chapterIndex, chapterOffset) { Object.assign(this, { chapterIndex, chapterOffset }); } },
});
const t = Object.assign(new Target(), {
  visiblePage: { startScalar: 100, endScalar: 200 }, chapter: { chapterIndex: 3, content: 'fixture' },
  lastVisibleScalar: () => 499, requireChapterLayoutMap: () => ({}), currentPaginationKey: () => ({}),
  adjacentChapterIndex: (c, delta) => c + delta, paginationDraft: undefined,
  paginationIndex: { findContainingPage: () => undefined },
});
const next = t.adjacentPageTurnTarget('next');
const previous = t.adjacentPageTurnTarget('previous');
assert.equal(next.chapterOffset, 200);
assert.equal(previous, undefined);
console.log(JSON.stringify({ case: 'restored anchor without measured predecessor', next, previous: previous ?? null }));

const Admission = make('LocalReadingExperience.ets', ['canStartReaderPageTurn'], {
  readerPageTransitionUsesPreparedPages: () => true,
});
const a = Object.assign(new Admission(), { canTurnPage: () => false, preparedPageTurn: () => ({}), usesNoAnimationPageTurnRuntime: () => false });
assert.equal(a.canStartReaderPageTurn('next'), false);
assert.equal(a.canStartReaderPageTurn('previous'), false);
console.log(JSON.stringify({ case: 'shared busy gate blocks both directions even with prepared pages', next: false, previous: false }));

const Pointer = make('ReaderPageInteractionLayer.ets', ['updateRawPointer'], gesture);
let ready = false;
let presented = 0;
const p = Object.assign(new Pointer(), {
  gestureState: gesture.startReaderPagePan(390, 100, 200, 0, 800),
  tapOnlyPointer: false, pointerRejected: false, velocityX: 0, velocityY: 0,
  pageLocalX: (_e, point) => point.x, pageLocalY: (_e, point) => point.y,
  eventTimeMs: e => e.time, updateVelocity: () => {},
  isPageOwner: s => s.owner === 'horizontalPage' || s.owner === 'verticalPrevious',
  canStartTurn: () => ready, canStartBookmark: () => true, reportManualInteraction: () => {},
  clearLongPressTimer: () => {}, ownPointer: () => {}, armPointerWatchdog: () => {},
  onGestureStateChange: () => { presented++; }, onBookmarkStateChange: () => {},
});
p.updateRawPointer({ time: 30 }, { x: 180, y: 200 });
assert.equal(p.pointerRejected, true);
ready = true;
p.updateRawPointer({ time: 60 }, { x: 240, y: 200 });
assert.equal(p.pointerRejected, true);
assert.equal(presented, 0);
console.log(JSON.stringify({ case: 'cold rejection does not start presentation after readiness improves while held', presented, pointerRejected: p.pointerRejected }));

const Promote = make('ReaderPageInteractionLayer.ets', ['onInteractionModeChanged'], gesture);
const promoted = [];
const d = Object.assign(new Promote(), {
  activePointerId: 1, tapOnlyPointer: true, tapOnly: false, deferredSegmentReserved: true,
  onDeferredSegmentPromote: () => {}, viewportWidth: 390, viewportHeight: 800,
  lastLocalX: 240, lastLocalY: 200, lastSampleTimeMs: 60,
  onGestureStateChange: state => promoted.push(state), armLongPressTimer: () => {},
});
d.onInteractionModeChanged();
assert.equal(promoted[0].phase, 'tracking');
assert.equal(promoted[0].currentOffsetX, 0);
console.log(JSON.stringify({ case: 'settlement unlock rebases held segment without starting a new page turn', phase: promoted[0].phase, offset: promoted[0].currentOffsetX }));

const Clamp = make('LocalReadingExperience.ets', ['clampedPageTurnOffset']);
const c = Object.assign(new Clamp(), { viewportWidth: 390 });
for (const x of [0, 8, 40, 120, 390, 450]) assert.equal(Math.abs(c.clampedPageTurnOffset('next', -x)), c.clampedPageTurnOffset('previous', x));
console.log(JSON.stringify({ case: 'admitted horizontal displacement is symmetric', samples: 6 }));

const Owner = make('LocalReadingExperience.ets', ['onReaderPageGestureStateChanged', 'clampedPageTurnOffset'], {
  readerPageTransitionUsesPreparedPages: () => true,
});
for (const direction of ['next', 'previous']) {
  const start = direction === 'next' ? 300 : 90;
  const sign = direction === 'next' ? -1 : 1;
  const owner = Object.assign(new Owner(), {
    pageTurnGestureState: gesture.createReaderPageGestureState(), pageTurnSessionCapsuleFrozen: true,
    usesBookTurnSimulation: () => false, usesNoAnimationPageTurnRuntime: () => false,
    preparedPageTurn: () => ({}), beginPageTurnPerf: () => {}, viewportWidth: 390,
  });
  const trace = [];
  const hot = Object.assign(new Pointer(), {
    ...p, gestureState: gesture.startReaderPagePan(390, start, 200, 0, 800), pointerRejected: false,
    canStartTurn: () => true,
    onGestureStateChange: state => { owner.onReaderPageGestureStateChanged(state); trace.push(owner.pageTurnOffsetX); },
  });
  for (const [i, distance] of [40, 120, 80].entries()) hot.updateRawPointer({ time: 20 + 20 * i }, { x: start + sign * distance, y: 200 });
  assert.deepEqual(trace, [40, 120, 80].map(x => sign * x));
  assert.equal(owner.pageTurnGestureState.phase, 'dragging');
  console.log(JSON.stringify({ case: 'hot admitted MOVE and reverse retreat without UP', direction, offsetTrace: trace, phase: owner.pageTurnGestureState.phase, meaning: 'synchronous owner state only, not presented frames' }));
  hot.updateRawPointer({ time: 100 }, { x: start - sign * 40, y: 200 });
  assert.equal(owner.pageTurnDirection, direction);
  assert.equal(Math.abs(owner.pageTurnOffsetX), 0);
  console.log(JSON.stringify({ case: 'same pointer crosses original down point', direction, actualDirection: owner.pageTurnDirection, offset: owner.pageTurnOffsetX, meaning: 'current direction lock, requires explicit behavior decision' }));
}
