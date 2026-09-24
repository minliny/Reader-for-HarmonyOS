import assert from 'node:assert/strict';
import { ReaderAutoPageCoordinator } from '../entry/src/main/ets/features/reading/ReaderAutoPageCoordinator.ts';

function fixture() {
  let now = 10000, serial = 0;
  const timers = new Map(), cancelled = [];
  const view = { active: true, ready: true, canResume: true, changes: 0, turns: 0, outcome: { kind: 'started' } };
  const owner = new ReaderAutoPageCoordinator({
    now: () => now,
    schedule: (fn, ms) => { const id = ++serial; timers.set(id, { fn, at: now + ms }); return id; },
    cancel: id => { if (timers.has(id)) cancelled.push(timers.get(id).fn); timers.delete(id); },
    active: () => view.active,
    ready: () => view.ready,
    canResumeTurn: () => view.canResume,
    turn: () => { view.turns++; return view.outcome; },
    changed: () => view.changes++,
  });
  function advance(ms) {
    const until = now + ms;
    for (;;) {
      const next = [...timers].sort((a, b) => a[1].at - b[1].at)[0];
      if (!next || next[1].at > until) break;
      timers.delete(next[0]); now = next[1].at; next[1].fn();
    }
    now = until;
  }
  function start() { owner.start(); owner.armPageTimer(true); owner.armSessionTimer(true); }
  return { owner, view, timers, cancelled, advance, start, jump: ms => { now += ms; } };
}

{
  const f = fixture(); f.owner.setSessionTimer(1, 0); f.start();
  f.advance(3000); assert.equal(f.owner.snapshot().remainingSeconds, 5);
  f.owner.pause('background'); assert.equal(f.timers.size, 0);
  f.advance(30000); assert.equal(f.owner.snapshot().remainingSeconds, 5);
  f.owner.resume(); f.owner.armPageTimer(true); f.owner.armSessionTimer(false);
  f.advance(5000); assert.equal(f.view.turns, 1); assert.equal(f.owner.snapshot().awaitingPageCommit, true);
  f.advance(10000); assert.equal(f.view.turns, 1, 'one turn until the admitted page commits');
  f.owner.pageCommitted(); assert.equal(f.owner.snapshot().remainingSeconds, 8);
  f.owner.pause('touch'); f.owner.pageCommitted();
  assert.equal(f.owner.snapshot().status, 'paused'); assert.equal(f.timers.size, 0);
  f.owner.dispose(); f.cancelled.forEach(fn => fn());
  assert.equal(f.view.turns, 1); assert.equal(f.timers.size, 0);
}

for (const mode of ['simulation', 'cover', 'slide', 'none', 'continuous']) {
  const f = fixture(); f.owner.setSpeed(2); f.owner.setSessionTimer(0, 0);
  f.view.outcome = { kind: 'preparing' }; f.start(); f.advance(2000);
  assert.equal(f.view.turns, 1, mode);
  f.view.canResume = false; f.owner.resumePendingTurn(); assert.equal(f.view.turns, 1);
  f.view.canResume = true; f.view.outcome = { kind: 'started' }; f.owner.resumePendingTurn();
  assert.equal(f.view.turns, 2); f.owner.resumePendingTurn(); assert.equal(f.view.turns, 2);
  const previous = f.owner.snapshot().generation;
  f.owner.retryTurn(previous); assert.equal(f.owner.snapshot().awaitingPageCommit, false);
  f.owner.armPageTimer(true); f.advance(2000); assert.equal(f.view.turns, 3);
  f.owner.pause('touch'); f.owner.pageCommitted();
  assert.equal(f.owner.snapshot().status, 'paused', `${mode}: manual interaction owns pause during commit`);
  f.owner.resume(); f.owner.armPageTimer(true); f.view.outcome = { kind: 'boundary', edge: 'end' };
  f.advance(2000); assert.equal(f.owner.snapshot().stopReason, 'bookEnd'); assert.equal(f.timers.size, 0);
}

{
  const f = fixture(); f.owner.setSpeed(2); f.view.outcome = { kind: 'preparing' };
  f.start(); f.advance(2000);
  assert.equal(f.owner.catalogLoadFailed(), true, 'failed TOC settles the pending automatic turn');
  assert.equal(f.owner.snapshot().status, 'stopped');
  assert.equal(f.owner.snapshot().stopReason, 'catalogUnavailable');
  assert.equal(f.owner.snapshot().awaitingPageCommit, false);
  assert.equal(f.timers.size, 0);
  assert.equal(f.owner.catalogLoadFailed(), false, 'a late duplicate failure cannot stop a new session');
  f.owner.start(); f.owner.armPageTimer(true); f.view.outcome = { kind: 'started' };
  f.advance(2000); assert.equal(f.view.turns, 2, 'the user can start again after the catalog recovers');
}

{
  const f = fixture(); f.owner.setSessionTimer(0, 3); f.start();
  f.jump(3000); f.owner.pause('background');
  assert.equal(f.owner.snapshot().status, 'stopped', 'deadline wins over a same-instant pause');
  assert.equal(f.timers.size, 0);
  const generation = f.owner.beginStart(); f.owner.cancelStart();
  assert.equal(f.owner.admitStart(generation), false, 'late TTS stop cannot start cancelled playback');
  const newGeneration = f.owner.beginStart(); assert.equal(f.owner.admitStart(newGeneration), true);
  assert.equal(f.owner.admitStart(newGeneration), false, 'stop barrier admitted once');
}

{
  const f = fixture(); f.owner.setSessionTimer(0, 4); f.start();
  f.advance(2000); f.owner.pause('manual'); f.advance(10000);
  f.owner.resume(); f.owner.armPageTimer(true); f.owner.armSessionTimer(false);
  f.advance(2000); assert.equal(f.owner.snapshot().status, 'stopped', 'resume preserves remaining session duration');
  assert.equal(f.timers.size, 0);
}

{
  const f = fixture(); f.owner.setSessionTimer(1, 0); f.start(); f.advance(3000);
  f.owner.pause('manual'); f.advance(1000);
  f.owner.resume(); f.owner.armPageTimer(true); f.owner.armSessionTimer(false);
  f.advance(56000); assert.equal(f.owner.snapshot().status, 'running', 'short pause must not consume captured duration');
  f.advance(1000); assert.equal(f.owner.snapshot().status, 'stopped');
}

{
  const f = fixture(); f.start(); f.owner.armPageTimer(true);
  const stale = f.cancelled[0]; f.advance(1000); stale();
  assert.equal(f.owner.snapshot().remainingSeconds, 7);
  assert.equal(f.timers.size, 2, 'cancelled callback cannot clear or reschedule the replacement timer');
  f.owner.dispose(); const atDispose = f.view.changes;
  f.cancelled.forEach(fn => fn()); assert.equal(f.view.changes, atDispose);
}
// The 500 ms automatic curl is a presentation budget, not part of the next
// page's reading interval. A late durable commit must not accumulate turns.
{
  const f = fixture(); f.owner.setSessionTimer(0, 0); f.start();
  f.advance(8000);
  assert.equal(f.view.turns, 1);
  assert.equal(f.owner.snapshot().awaitingPageCommit, true);
  f.advance(500);
  assert.equal(f.view.turns, 1, 'animation time cannot start another turn');
  f.advance(150);
  assert.equal(f.view.turns, 1, 'presentation completion alone is not a commit');
  f.owner.pageCommitted();
  assert.equal(f.owner.snapshot().remainingSeconds, 8);
  f.advance(7999);
  assert.equal(f.view.turns, 1, 'the new page receives its complete reading interval');
  f.advance(1);
  assert.equal(f.view.turns, 2);
  f.advance(30000);
  assert.equal(f.view.turns, 2, 'slow commits retain one intention rather than a page backlog');
  f.owner.dispose();
}

for (const interruption of ['pause', 'stop']) {
  const f = fixture(); f.owner.setSessionTimer(0, 0); f.start();
  f.advance(8000); f.advance(250);
  if (interruption === 'pause') f.owner.pause('touch');
  else f.owner.stop();
  f.advance(250); f.owner.pageCommitted();
  f.advance(20000);
  assert.equal(f.view.turns, 1, `${interruption}: late animation/commit cannot resume automatic reading`);
  assert.equal(f.timers.size, 0);
  assert.equal(f.owner.snapshot().status, interruption === 'pause' ? 'paused' : 'stopped');
  f.owner.dispose();
}

console.log('automatic reading coordinator: deadlines, 500 ms presentation isolation, full reading interval, interruption and commit barrier PASS');
