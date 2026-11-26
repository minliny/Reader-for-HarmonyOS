import assert from 'node:assert/strict';
import test from 'node:test';
import { ReaderPagePreparationQueue, type ReaderPagePreparationAttempt }
  from '../../entry/src/main/ets/features/reading/ui/ReaderPagePreparationCoordinator.ts';
import type { ReaderPageTurnDirection }
  from '../../entry/src/main/ets/features/reading/ui/ReaderPageGestureState.ts';

test('preparation retains the first direction during a retry and discards work from a retired selection', () => {
  const timers = new Map<number, { run: () => void; delay: number }>();
  let last = 0;
  const queue = new ReaderPagePreparationQueue((run, delay) => {
    const id = ++last;
    timers.set(id, { run, delay });
    return id;
  }, id => { timers.delete(id); });
  let selector = 1;
  const directions: ReaderPageTurnDirection[] = [];
  let outcome: ReaderPagePreparationAttempt = 'retry';
  const port = {
    renderWorkBlocked: () => false,
    laneBlocked: () => false,
    ready: () => false,
    prepare: (direction: ReaderPageTurnDirection) => {
      directions.push(direction);
      return outcome;
    },
    idle: () => assert.fail('before the retry settles'),
    captureCurrent: () => {
      const captured = selector;
      return () => selector === captured;
    },
  };

  queue.reset('next');
  queue.promoteQueued('previous');
  queue.drain(port);
  assert.deepEqual(directions, ['previous']);
  const first = timers.get(1)!;
  assert.equal(first.delay, 250);
  timers.delete(1);
  first.run();
  assert.deepEqual(directions, ['previous', 'previous']);
  const second = timers.get(2)!;
  assert.equal(second.delay, 500);
  outcome = 'begun';
  selector += 1;
  timers.delete(2);
  second.run();
  assert.equal(queue.hasQueued(), false);
  assert.deepEqual(directions, ['previous', 'previous']);
});

test('preparation leaves blocked work queued and only a begun measurement cancels its pending retry', () => {
  const canceled: number[] = [];
  const queue = new ReaderPagePreparationQueue(() => 42, id => { canceled.push(id); });
  let blocked = true;
  let outcome: ReaderPagePreparationAttempt = 'retry';
  const prepared: ReaderPageTurnDirection[] = [];
  const port = {
    renderWorkBlocked: () => false,
    laneBlocked: () => blocked,
    ready: () => false,
    prepare: (direction: ReaderPageTurnDirection) => { prepared.push(direction); return outcome; },
    idle: () => assert.fail('preparation should keep one direction'),
    captureCurrent: () => () => true,
  };

  queue.reset('previous');
  queue.drain(port);
  assert.deepEqual(prepared, []);
  blocked = false;
  queue.drain(port);
  assert.deepEqual(prepared, ['previous']);
  queue.prioritize('next');
  outcome = 'begun';
  queue.drain(port);
  assert.deepEqual(prepared, ['previous', 'next']);
  assert.deepEqual(canceled, [42]);
  assert.equal(queue.contains('previous'), true);
});
