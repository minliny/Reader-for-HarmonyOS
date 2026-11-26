import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  cancelReaderPagePan,
  finishReaderPagePan,
  readerPageGestureCanTap,
  startReaderPagePan,
  updateReaderPagePanInPlace,
  type ReaderPageGestureState,
} from '../../entry/src/main/ets/features/reading/ui/ReaderPageGestureState.ts';

function move(state: ReaderPageGestureState, dx: number, dy: number, elapsedMs = 40): ReaderPageGestureState {
  return updateReaderPagePanInPlace(state, dx, dy, 0, state.startLocalX + dx, state.startLocalY + dy, 0,
    state.startEventTimeMs + elapsedMs);
}

test('thumb arcs at 0, 35, 45 and 55 degrees claim and commit in both directions', () => {
  for (const angle of [0, 35, 45, 55]) {
    for (const horizontalSign of [-1, 1]) {
      for (const verticalSign of [-1, 1]) {
        const direction = horizontalSign < 0 ? 'next' : 'previous';
        const start = startReaderPagePan(400, 200, 500, 100, 800);
        const dx = horizontalSign * 12;
        const dy = verticalSign * 12 * Math.tan(angle * Math.PI / 180);
        const arc = `${angle} degrees, dx=${dx}, dy=${dy}`;
        assert.strictEqual(move(start, dx, dy), start, arc);
        assert.equal(start.owner, 'horizontalPage', arc);
        assert.equal(start.phase, 'dragging', arc);
        assert.equal(start.direction, direction, arc);
        assert.equal(start.verticalPrevious, false, arc);
        const release = finishReaderPagePan(start, dx * 2, dy * 2);
        assert.equal(release.direction, direction, arc);
        assert.equal(release.state.settleTarget, 'commit', arc);
      }
    }
  }
});

test('a slightly downward arc at the horizontal threshold claims the page', () => {
  const state = startReaderPagePan(400);
  move(state, -11.9, 16);
  assert.equal(state.owner, 'undecided');
  move(state, -12, 16);
  assert.equal(state.owner, 'horizontalPage');
  assert.equal(finishReaderPagePan(state, -32, 25).direction, 'next');
});

test('bookmark claims at 24 vp in the downward cone and commits at the damped threshold', () => {
  const state = startReaderPagePan(400);
  move(state, 12, 23.9);
  assert.equal(state.owner, 'undecided');
  move(state, 12, 24);
  assert.equal(state.owner, 'bookmark');
  assert.ok(state.bookmarkOffsetY > 0);
  assert.equal(state.bookmarkPreviewChanged, false);

  move(state, 45, 90);
  assert.ok(state.bookmarkOffsetY >= 46);
  assert.equal(state.bookmarkPreviewChanged, true);
  const release = finishReaderPagePan(state, 45, 90);
  assert.equal(release.bookmarkChanged, true);
  assert.equal(release.direction, undefined);
  assert.equal(release.state.settleTarget, 'commit');

  move(state, 135, 90);
  assert.equal(state.owner, 'bookmark');
  assert.equal(state.bookmarkPreviewChanged, false);
  assert.equal(finishReaderPagePan(state, 135, 90).state.settleTarget, 'rollback');
  assert.equal(cancelReaderPagePan(state).settleTarget, 'rollback');
});

test('cone boundary belongs to the bookmark and terminal samples use the action thresholds', () => {
  const coneY = 20 * 1.8;
  const below = startReaderPagePan(400);
  assert.equal(move(below, -20, coneY - 0.1).owner, 'horizontalPage');
  const on = startReaderPagePan(400);
  assert.equal(move(on, -20, coneY).owner, 'bookmark');

  const terminal = startReaderPagePan(400);
  assert.equal(finishReaderPagePan(terminal, -8, -14).direction, 'next');
  assert.equal(finishReaderPagePan(terminal, 0, 47.9).state.owner, 'undecided');
  const bookmark = finishReaderPagePan(terminal, 0, 48);
  assert.equal(bookmark.state.owner, 'bookmark');
  assert.equal(bookmark.bookmarkChanged, false);
  assert.equal(finishReaderPagePan(terminal, 0, 90).bookmarkChanged, true);
});

test('steep upward swipes leave the page and tap actions idle', () => {
  for (const [dx, dy] of [[0, -35], [-20, -38], [20, -36], [1, -10], [0, -8]]) {
    const state = startReaderPagePan(400);
    move(state, dx, dy);
    assert.equal(state.owner, 'undecided');
    assert.equal(state.verticalPrevious, false);
    assert.equal(readerPageGestureCanTap(state, 40), false);
    const release = finishReaderPagePan(state, dx, dy);
    assert.equal(release.direction, undefined);
    assert.equal(release.bookmarkChanged, false);
  }
});

test('small upward jitter stays eligible for a tap', () => {
  for (const [dx, dy] of [[0, -0.5], [1, -2], [0, -2], [-1, -3]]) {
    const state = startReaderPagePan(400);
    move(state, dx, dy);
    assert.equal(readerPageGestureCanTap(state, 40), true, `dx=${dx}, dy=${dy}`);
  }
});

test('a claimed page uses signed release distance even after a steep or reversed tail', () => {
  const state = startReaderPagePan(400);
  move(state, -36, -10);
  assert.equal(state.owner, 'horizontalPage');
  assert.equal(finishReaderPagePan(state, -8, -80).direction, 'next');
  assert.equal(finishReaderPagePan(state, -7.9, -80, -5000).state.settleTarget, 'rollback');
  const reversed = finishReaderPagePan(state, 12, -80, 5000);
  assert.equal(reversed.state.reversed, true);
  assert.equal(reversed.direction, undefined);
  assert.equal(reversed.state.settleTarget, 'rollback');
});

test('claim and commit distances stay in physical vp when stage coordinates are scaled', () => {
  const state = startReaderPagePan(600, 300, 300);
  updateReaderPagePanInPlace(state, -6, 30, 0, 294, 330, 0, 40, -12, 16);
  assert.equal(state.owner, 'horizontalPage');
  assert.equal(finishReaderPagePan(state, -4, 60, 0, 296, 360, 0, 50, -8, 32).direction, 'next');
  assert.equal(finishReaderPagePan(state, -3.95, 60, 0, 296.05, 360, 0, 50, -7.9, 32).direction, undefined);
});

test('long press locks at 500 ms only when selection is allowed', () => {
  const selecting = startReaderPagePan(400, 200, 500, 100, 800);
  assert.equal(move(selecting, 3, 2, 499).owner, 'undecided');
  assert.equal(readerPageGestureCanTap(selecting, 599), true);
  assert.equal(move(selecting, 3, 2, 500).owner, 'longPress');
  assert.equal(readerPageGestureCanTap(selecting, 600), false);
  assert.equal(move(selecting, -40, -22, 550).owner, 'longPress');
  assert.equal(finishReaderPagePan(selecting, -55, -35).direction, undefined);

  const moved = startReaderPagePan(400, 200, 500, 100, 800, true);
  move(moved, 5, 7, 200);
  assert.equal(move(moved, 0, 0, 500).owner, 'undecided');
  assert.equal(move(moved, -12, 0, 550).owner, 'horizontalPage');

  const resting = startReaderPagePan(400, 200, 500, 100, 800, false);
  assert.equal(move(resting, 1, 2, 600).owner, 'undecided');
  assert.equal(readerPageGestureCanTap(resting, 700), false);
  assert.equal(move(resting, -12, -14, 650).owner, 'horizontalPage');
  assert.equal(finishReaderPagePan(resting, -24, -30).direction, 'next');
});
