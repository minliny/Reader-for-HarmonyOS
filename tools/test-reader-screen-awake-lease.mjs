import assert from 'node:assert/strict';

import {
  ReaderScreenAwakeLease,
  readerScreenAwakeLeaseDurationMs,
} from '../entry/src/main/ets/features/reading/ReaderScreenAwakeLease.ts';

class FakeScheduler {
  nextHandle = 1;
  tasks = new Map();

  set(delayMs, task) {
    const handle = this.nextHandle++;
    this.tasks.set(handle, { delayMs, task });
    return handle;
  }

  clear(handle) {
    this.tasks.delete(handle);
  }

  fireOnly() {
    assert.equal(this.tasks.size, 1);
    const [handle, entry] = [...this.tasks.entries()][0];
    this.tasks.delete(handle);
    entry.task();
  }
}

assert.equal(readerScreenAwakeLeaseDurationMs('system'), 0);
assert.equal(readerScreenAwakeLeaseDurationMs('oneMinute'), 60_000);
assert.equal(readerScreenAwakeLeaseDurationMs('fiveMinutes'), 300_000);
assert.equal(readerScreenAwakeLeaseDurationMs('tenMinutes'), 600_000);
assert.equal(readerScreenAwakeLeaseDurationMs('alwaysOn'), 0);

const scheduler = new FakeScheduler();
const changes = [];
const lease = new ReaderScreenAwakeLease((keepScreenOn) => changes.push(keepScreenOn), scheduler);
lease.configure('fiveMinutes', true);
assert.deepEqual(changes, [true]);
assert.equal([...scheduler.tasks.values()][0].delayMs, 300_000);

lease.rearm();
assert.equal(scheduler.tasks.size, 1, 'rearm replaces rather than stacks timers');
scheduler.fireOnly();
assert.deepEqual(changes, [true, false]);

lease.configure('alwaysOn', true);
assert.deepEqual(changes, [true, false, true]);
assert.equal(scheduler.tasks.size, 0);
lease.setForeground(false);
assert.deepEqual(changes, [true, false, true, false]);
lease.setForeground(true);
assert.deepEqual(changes, [true, false, true, false, true]);

lease.configure('oneMinute', true);
assert.equal(scheduler.tasks.size, 1);
lease.configure('system', true);
assert.equal(scheduler.tasks.size, 0);
assert.equal(changes.at(-1), false);

lease.dispose();
lease.configure('alwaysOn', true);
assert.equal(lease.currentKeepScreenOn(), false);

console.log('reader screen-awake lease: PASS');
