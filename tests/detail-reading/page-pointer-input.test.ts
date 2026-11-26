import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  cancelReaderPagePan,
  finishReaderPagePan,
  readerPageGestureCanTap,
  startReaderPagePan,
  updateReaderPagePanInPlace,
  type ReaderPageTurnDirection,
} from '../../entry/src/main/ets/features/reading/ui/ReaderPageGestureState.ts';
import {
  ReaderPagePalmCandidate,
  readerPageCanOfferPalmHandoff,
  readerPageGestureAdmission,
  readerPagePointerAtPalmEdge,
  readerPagePointerBlocksTap,
  readerPagePointerGeometryValueMatches,
  readerPagePointerLocalCoordinate,
  readerPageSystemOwnsPointer,
} from '../../entry/src/main/ets/features/reading/ui/ReaderPagePointerInput.ts';

test('full-width and full-height mapping admits a bottom swipe and screens a bottom tap', () => {
  const width = 400;
  const height = 800;
  const bottom = 24;
  const x = 370;
  const y = 790;
  const startX = readerPagePointerLocalCoordinate(x, width, 320);
  const endX = readerPagePointerLocalCoordinate(x - 24, width, 320);
  const startY = readerPagePointerLocalCoordinate(y, height, 640);
  const endY = readerPagePointerLocalCoordinate(y - 10, height, 640);
  assert.equal(readerPageSystemOwnsPointer(x, width, 24, 24), false);
  assert.equal(readerPagePointerBlocksTap(y, height, bottom), true);
  assert.equal(readerPagePointerBlocksTap(height - bottom, height, bottom), false);
  assert.ok(endY < startY, 'bottom navigation inset does not flatten stage Y');
  const state = startReaderPagePan(320, startX, startY, 0, 640);
  assert.equal(readerPageGestureCanTap(state, 30), true);
  updateReaderPagePanInPlace(state, endX - startX, endY - startY, 0, endX, endY, 0, 70, -24, -10);
  assert.equal(finishReaderPagePan(state, endX - startX, endY - startY, 0, endX, endY, 0, 90, -24, -10)
    .direction, 'next');
});

test('side DOWN rejection ends at 12 vp or the smaller system inset', () => {
  const width = 400;
  assert.equal(readerPageSystemOwnsPointer(12, width, 24, 30), true);
  assert.equal(readerPageSystemOwnsPointer(388, width, 24, 30), true);
  assert.equal(readerPageSystemOwnsPointer(12.5, width, 24, 30), false);
  assert.equal(readerPageSystemOwnsPointer(387.5, width, 24, 30), false);
  assert.equal(readerPageSystemOwnsPointer(6, width, 6, 0), true);
  assert.equal(readerPageSystemOwnsPointer(6.5, width, 6, 0), false);
  assert.equal(readerPageSystemOwnsPointer(width, width, 6, 0), false);
  assert.equal(readerPagePointerLocalCoordinate(-5, width, 320), 0);
  assert.equal(readerPagePointerLocalCoordinate(405, width, 320), 320);

  for (const [startX, dx, direction] of [[13, 18, 'previous'], [387, -18, 'next']] as const) {
    const localStart = readerPagePointerLocalCoordinate(startX, width, 320);
    const localEnd = readerPagePointerLocalCoordinate(startX + dx, width, 320);
    const state = startReaderPagePan(320, localStart, 200, 0, 800);
    updateReaderPagePanInPlace(state, localEnd - localStart, 0, 0, localEnd, 200, 0, 50, dx, 0);
    assert.equal(state.direction, direction);
    const cancelled = cancelReaderPagePan(state);
    assert.equal(cancelled.settleTarget, 'rollback');
    assert.equal(finishReaderPagePan(cancelled, localEnd - localStart).direction, undefined);
    assert.equal(finishReaderPagePan(state, localEnd - localStart, 0, 0, localEnd, 200, 0, 60, dx, 0)
      .direction, direction);
  }
});

test('held horizontal gesture shares normal admission and releases from its original DOWN', () => {
  const state = startReaderPagePan(400, 300, 410, 100, 800);
  updateReaderPagePanInPlace(state, -21, -13, 0, 279, 397, 0, 160, -21, -13);
  const admissions: ReaderPageTurnDirection[] = [];
  const canStart = (ready: boolean) => (direction: ReaderPageTurnDirection): boolean => {
    admissions.push(direction);
    return ready;
  };
  for (const [ready, expected] of [[true, 'admitted'], [false, 'preparing']] as const) {
    assert.equal(readerPageGestureAdmission(state, canStart(ready), () => true), expected);
    assert.equal(state.phase, 'dragging');
    assert.equal(state.startLocalX, 300);
    assert.equal(state.startLocalY, 410);
    assert.equal(state.startEventTimeMs, 100);
    assert.equal(state.inputOffsetX, -21);
    assert.equal(finishReaderPagePan(state, -21, -13, 0, 279, 397, 0, 180, -21, -13).direction, 'next');
  }
  assert.deepEqual(admissions, ['next', 'next']);
});

test('an undecided held gesture preserves both a short tap and later accumulated displacement', () => {
  const state = startReaderPagePan(400, 300, 410, 100, 800);
  updateReaderPagePanInPlace(state, -4, 0, 0, 296, 410, 0, 120, -4, 0);
  assert.equal(readerPageGestureAdmission(state, () => assert.fail('tracking is not a turn'), () => true),
    'admitted');
  assert.equal(readerPageGestureCanTap(state, 140), true);
  const endX = 287;
  updateReaderPagePanInPlace(state, endX - state.startLocalX, 0, 0, endX, 410, 0, 170);
  assert.equal(state.owner, 'horizontalPage');
  assert.equal(state.inputOffsetX, -13);
});

test('a stationary edge pointer can hand off to one inner horizontal drag with paired leases', () => {
  const primary = startReaderPagePan(400, 32, 400, 100, 800);
  updateReaderPagePanInPlace(primary, 7.9, 0);
  assert.equal(readerPageCanOfferPalmHandoff(primary, false, 32, 400), true);
  assert.equal(readerPageCanOfferPalmHandoff(primary, true, 32, 400), false);
  assert.equal(readerPageCanOfferPalmHandoff(primary, false, 32.1, 400), false);
  assert.equal(readerPagePointerAtPalmEdge(368, 400), true);
  assert.equal(readerPagePointerAtPalmEdge(367.9, 400), false);
  const state = startReaderPagePan(400, 250, 440, 125, 800);
  const candidate = new ReaderPagePalmCandidate(22, 250, 440, 125, state);
  assert.equal(candidate.claimsHorizontal(239, 440), false);
  assert.equal(candidate.claimsHorizontal(238, 462), false);
  assert.equal(candidate.claimsHorizontal(238, 456), true);

  const called: string[] = [];
  let liveId = -1;
  const start = (id: number): boolean => {
    assert.equal(liveId, -1);
    liveId = id;
    called.push(`start ${id}`);
    return true;
  };
  const end = (id: number): void => {
    assert.equal(liveId, id);
    liveId = -1;
    called.push(`end ${id}`);
  };
  start(11);
  assert.equal(candidate.replaceLease(11, end, start), true);
  assert.equal(liveId, 22);
  assert.equal(updateReaderPagePanInPlace(candidate.state, -12, 16, 0, 238, 456, 0, 160), state);
  assert.equal(candidate.state.startLocalX, 250);
  assert.equal(finishReaderPagePan(candidate.state, -12, 16).direction, 'next');
  end(22);
  assert.deepEqual(called, ['start 11', 'end 11', 'start 22', 'end 22']);
  assert.equal(liveId, -1);
});

test('an edge palm locked by long press can still hand off to a second finger', () => {
  const primary = startReaderPagePan(400, 32, 400, 100, 800);
  updateReaderPagePanInPlace(primary, 0, 0, 0, 32, 400, 0, 700);
  assert.equal(primary.owner, 'longPress');
  assert.equal(readerPageCanOfferPalmHandoff(primary, false, 32, 400), true);
  assert.equal(readerPageCanOfferPalmHandoff(primary, false, 368, 400), true);
  assert.equal(readerPageCanOfferPalmHandoff(primary, false, 32.1, 400), false);
  assert.equal(readerPageCanOfferPalmHandoff(primary, true, 32, 400), false);

  const state = startReaderPagePan(400, 250, 440, 800, 800);
  const candidate = new ReaderPagePalmCandidate(22, 250, 440, 800, state);
  assert.equal(candidate.claimsHorizontal(238, 456), true);
  const calls: string[] = [];
  const end = (id: number): void => { calls.push(`end ${id}`); };
  assert.equal(candidate.replaceLease(11, end, (id) => {
    calls.push(`start ${id}`);
    return true;
  }), true);
  updateReaderPagePanInPlace(candidate.state, -12, 16, 0, 238, 456, 0, 900);
  assert.equal(finishReaderPagePan(candidate.state, -12, 16).direction, 'next');
  end(22);
  assert.deepEqual(calls, ['end 11', 'start 22', 'end 22']);

  updateReaderPagePanInPlace(primary, 8, 0);
  assert.equal(primary.owner, 'longPress');
  assert.equal(readerPageCanOfferPalmHandoff(primary, false, 32, 400), false);
});

test('a palm candidate can claim at the 8 vp terminal threshold', () => {
  const state = startReaderPagePan(400, 250, 440, 125, 800);
  const candidate = new ReaderPagePalmCandidate(22, 250, 440, 125, state);
  assert.equal(candidate.claimsHorizontal(242, 454), false);
  assert.equal(candidate.claimsHorizontal(242.1, 440, true), false);
  assert.equal(candidate.claimsHorizontal(242, 454.5, true), false);
  assert.equal(candidate.claimsHorizontal(242, 454, true), true);
  assert.equal(finishReaderPagePan(candidate.state, -8, 14, 0, 242, 454, 0, 160, -8, 14).direction, 'next');
});

test('a moved or claimed primary keeps ownership and a rejected transfer releases the old lease', () => {
  const primary = startReaderPagePan(400, 30, 400, 100, 800);
  updateReaderPagePanInPlace(primary, 8, 0);
  assert.equal(primary.owner, 'undecided');
  updateReaderPagePanInPlace(primary, 0, 0);
  assert.equal(readerPageCanOfferPalmHandoff(primary, false, 30, 400), false);
  updateReaderPagePanInPlace(primary, 12, 0);
  assert.equal(primary.owner, 'horizontalPage');
  assert.equal(readerPageCanOfferPalmHandoff(primary, false, 30, 400), false);

  const calls: string[] = [];
  const candidate = new ReaderPagePalmCandidate(22, 250, 440, 125, startReaderPagePan(400));
  assert.equal(candidate.replaceLease(11, (id) => calls.push(`end ${id}`), (id) => {
    calls.push(`reject ${id}`);
    return false;
  }), false);
  assert.deepEqual(calls, ['end 11', 'reject 22']);
});

test('frozen geometry tolerates up to 0.5 vp of drift without changing coordinate mapping', () => {
  for (const frozen of [0, 12, 24, 400, 800]) {
    assert.equal(readerPagePointerGeometryValueMatches(frozen, frozen + 0.5), true);
    assert.equal(readerPagePointerGeometryValueMatches(frozen, frozen - 0.5), true);
    assert.equal(readerPagePointerGeometryValueMatches(frozen, frozen + 0.51), false);
  }
  const state = startReaderPagePan(320, readerPagePointerLocalCoordinate(200, 400, 320), 400, 100, 800);
  const currentX = readerPagePointerLocalCoordinate(185, 400, 320);
  updateReaderPagePanInPlace(state, currentX - state.startLocalX, 0, 0, currentX, 400, 0, 150, -15, 0);
  assert.equal(finishReaderPagePan(state, currentX - state.startLocalX, 0, 0, currentX, 400, 0, 160, -15, 0)
    .direction, 'next');
});
