import assert from 'node:assert/strict';
import { createSourceFlow, sourceFlowFixtures } from './source-flow-model.mjs';

class Clock {
  time = 0;
  sequence = 0;
  pending = new Map();
  callbacks = new Map();

  setTimeout(callback, delayMs) {
    const id = ++this.sequence;
    const task = { id, at: this.time + delayMs, callback };
    this.pending.set(id, task);
    this.callbacks.set(id, callback);
    return id;
  }
  clearTimeout(id) { this.pending.delete(id); }
  advance(ms) {
    const target = this.time + ms;
    for (;;) {
      const next = [...this.pending.values()]
        .filter((task) => task.at <= target)
        .sort((left, right) => left.at - right.at || left.id - right.id)[0];
      if (!next) break;
      this.time = next.at;
      this.pending.delete(next.id);
      next.callback();
    }
    this.time = target;
  }
  // An uncooperative transport can still deliver a saved, cancelled callback.
  deliverCancelled(ids) { ids.forEach((id) => this.callbacks.get(id)?.()); }
  ids() { return [...this.pending.keys()]; }
}

const verified = [];
const run = (name, test) => { test(); verified.push(name); };
const setup = (options = {}) => {
  const scheduler = new Clock();
  const changes = [];
  const flow = createSourceFlow({ scheduler, onChange: (snapshot) => changes.push(snapshot), ...options });
  return { scheduler, changes, flow, snapshot: () => flow.getSnapshot() };
};
const successful = sourceFlowFixtures.filter((entry) => entry.success);
const unsuccessfulKeys = new Set(sourceFlowFixtures.filter((entry) => !entry.success).map((entry) => entry.key));

run('incremental success-only admission and immutable snapshots', () => {
  const { scheduler, changes, flow, snapshot } = setup();
  assert.equal(snapshot().stage, 'controls');
  assert.equal(flow.open(), true);
  assert.equal(snapshot().stage, 'opening');
  scheduler.advance(319);
  assert.equal(snapshot().discovery, 'idle');
  scheduler.advance(1);
  assert.equal(snapshot().stage, 'discovering');
  assert.equal(snapshot().round, 1);
  let previousTime = 0;
  for (const response of sourceFlowFixtures) {
    scheduler.advance(response.delayMs - previousTime - 1);
    const before = snapshot().candidates.length;
    const notifications = changes.length;
    scheduler.advance(1);
    assert.equal(snapshot().candidates.length, before + Number(response.success));
    assert.equal(changes.length, notifications + Number(response.success));
    assert(snapshot().candidates.every((entry) => !unsuccessfulKeys.has(entry.key)));
    previousTime = response.delayMs;
  }
  assert.equal(snapshot().stage, 'discovering');
  scheduler.advance(6000 - previousTime);
  assert.equal(snapshot().stage, 'ready');
  assert.equal(snapshot().discovery, 'complete');
  assert.deepEqual(snapshot().candidates.map((entry) => entry.key), successful.map((entry) => entry.key));
  assert.equal(scheduler.pending.size, 0);
  const firstResult = changes.find((entry) => entry.candidates.length === 1);
  assert(Object.isFrozen(firstResult) && Object.isFrozen(firstResult.book));
  assert(Object.isFrozen(firstResult.candidates) && Object.isFrozen(firstResult.candidates[0]));
  assert.throws(() => firstResult.candidates[0].sourceName = 'mutated', TypeError);
  assert.equal(firstResult.candidates.length, 1);
  flow.destroy();
});

run('stop preserves results and ignores late callbacks', () => {
  const { scheduler, flow, snapshot } = setup();
  flow.open();
  scheduler.advance(320 + 1250);
  const keys = snapshot().candidates.map((entry) => entry.key);
  const cancelled = scheduler.ids();
  const generation = snapshot().generation;
  assert.equal(flow.stop(), true);
  assert.equal(snapshot().stage, 'stopped');
  assert(snapshot().generation > generation);
  assert.equal(scheduler.pending.size, 0);
  scheduler.deliverCancelled(cancelled);
  scheduler.advance(12000);
  assert.deepEqual(snapshot().candidates.map((entry) => entry.key), keys);
  assert.equal(snapshot().discovery, 'stopped');
  flow.destroy();
});

run('restart retains, deduplicates and appends by composite key', () => {
  const { scheduler, flow, snapshot } = setup();
  flow.open();
  scheduler.advance(320 + 2100);
  const retained = snapshot().candidates.map((entry) => entry.key);
  const cancelled = scheduler.ids();
  flow.stop();
  assert.equal(flow.restart(), true);
  assert.deepEqual(snapshot().candidates.map((entry) => entry.key), retained);
  assert.equal(snapshot().round, 2);
  scheduler.deliverCancelled(cancelled);
  scheduler.advance(1250);
  assert.deepEqual(snapshot().candidates.map((entry) => entry.key), retained);
  scheduler.advance(6000 - 1250);
  const resultKeys = snapshot().candidates.map((entry) => entry.key);
  assert.equal(resultKeys.length, 6);
  assert.equal(new Set(resultKeys).size, 6);
  assert.deepEqual(resultKeys.slice(0, retained.length), retained);
  assert(resultKeys.every((key) => key.includes('https://preview.reader.invalid/')));
  flow.destroy();
});

run('selection freezes discovery and commits source only after all switch phases', () => {
  const { scheduler, changes, flow, snapshot } = setup();
  flow.open();
  scheduler.advance(320 + 2100);
  const candidate = snapshot().candidates[2];
  const previousBook = snapshot().book;
  const cancelled = scheduler.ids();
  assert.equal(flow.choose('missing-candidate'), false);
  assert.equal(flow.choose(candidate.key), true);
  assert.equal(snapshot().stage, 'switching');
  assert.equal(snapshot().switchStep, 'prepare');
  assert.equal(snapshot().discovery, 'stopped');
  assert.equal(flow.choose(snapshot().candidates[0].key), false);
  assert.equal(flow.restart(), false);
  assert.equal(flow.dismiss(), false);
  scheduler.deliverCancelled(cancelled);
  assert.equal(snapshot().candidates.length, 3);
  scheduler.advance(899);
  assert.deepEqual(snapshot().book, previousBook);
  scheduler.advance(1);
  assert.equal(snapshot().switchStep, 'locate');
  assert.deepEqual(snapshot().book, previousBook);
  scheduler.advance(900);
  assert.equal(snapshot().switchStep, 'finish');
  assert.deepEqual(snapshot().book, previousBook);
  scheduler.advance(599);
  assert.equal(snapshot().stage, 'switching');
  assert.deepEqual(snapshot().book, previousBook);
  scheduler.advance(1);
  assert.equal(snapshot().stage, 'completed');
  assert.deepEqual(snapshot().book, { ...previousBook, source: candidate.sourceName, latestChapter: candidate.latestChapter });
  assert.equal(snapshot().book.chapter, '第三章 山路');
  assert(snapshot().candidates.every((entry) => entry.sourceId !== candidate.sourceId));
  const steps = changes.filter((entry) => entry.stage === 'switching').map((entry) => entry.switchStep);
  assert.deepEqual(steps, ['prepare', 'locate', 'finish']);
  assert.equal(scheduler.pending.size, 0);
  flow.destroy();
});

run('completed source is excluded when controls reopen the sheet', () => {
  const { scheduler, flow, snapshot } = setup();
  flow.open();
  scheduler.advance(6320);
  const chosen = snapshot().candidates[0];
  flow.choose(chosen.key);
  scheduler.advance(2400);
  assert.equal(flow.showControls(), true);
  assert.equal(snapshot().stage, 'controls');
  assert.equal(snapshot().book.source, chosen.sourceName);
  assert.equal(flow.open(), true);
  assert(snapshot().candidates.every((entry) => entry.sourceId !== chosen.sourceId));
  scheduler.advance(6320);
  assert.equal(snapshot().candidates.length, 5);
  assert(snapshot().candidates.every((entry) => entry.sourceId !== chosen.sourceId));
  assert.equal(flow.choose(chosen.key), false);
  flow.destroy();
});

run('a lower latest chapter follows the chosen source while reading position survives reopening', () => {
  const { scheduler, flow, snapshot } = setup();
  flow.open();
  scheduler.advance(6320);
  const candidate = snapshot().candidates.find((entry) => entry.sourceId === 'source-yuanshan');
  assert.equal(candidate.latestChapter, '第十一章 山路');
  assert.equal(snapshot().book.latestChapter, '第十二章 雨夜归人');
  flow.choose(candidate.key);
  scheduler.advance(2399);
  assert.equal(snapshot().book.latestChapter, '第十二章 雨夜归人');
  scheduler.advance(1);
  assert.equal(snapshot().book.source, '远山书库');
  assert.equal(snapshot().book.latestChapter, candidate.latestChapter);
  assert.equal(snapshot().book.chapter, '第三章 山路');
  flow.showControls();
  flow.open();
  assert.equal(snapshot().stage, 'opening');
  assert.equal(snapshot().book.latestChapter, candidate.latestChapter);
  assert.equal(snapshot().book.chapter, '第三章 山路');
  scheduler.advance(6320);
  assert.equal(snapshot().stage, 'ready');
  assert.equal(snapshot().book.latestChapter, candidate.latestChapter);
  assert.equal(snapshot().book.chapter, '第三章 山路');
  flow.destroy();
});

run('dismiss during opening cancels and cannot revive an old sheet', () => {
  const { scheduler, changes, flow, snapshot } = setup();
  flow.open();
  const cancelled = scheduler.ids();
  assert.equal(flow.dismiss(), true);
  assert.equal(snapshot().stage, 'reader');
  assert.equal(scheduler.pending.size, 0);
  const notifications = changes.length;
  scheduler.deliverCancelled(cancelled);
  scheduler.advance(10000);
  assert.equal(changes.length, notifications);
  assert.equal(snapshot().stage, 'reader');
  assert.equal(flow.showControls(), true);
  assert.equal(flow.hideControls(), true);
  assert.equal(flow.showControls(), true);
  flow.open();
  scheduler.advance(320 + 650);
  assert.equal(snapshot().candidates.length, 1);
  flow.destroy();
  assert.equal(scheduler.pending.size, 0);
});

run('dismiss during discovery retains successful rows across reopening', () => {
  const { scheduler, flow, snapshot } = setup();
  flow.open();
  scheduler.advance(320 + 1250);
  const retained = snapshot().candidates.map((entry) => entry.key);
  const cancelled = scheduler.ids();
  flow.dismiss();
  flow.showControls();
  flow.open();
  scheduler.deliverCancelled(cancelled);
  assert.equal(snapshot().stage, 'opening');
  assert.deepEqual(snapshot().candidates.map((entry) => entry.key), retained);
  scheduler.advance(6320);
  assert.equal(snapshot().candidates.length, 6);
  assert.equal(snapshot().round, 2);
  flow.destroy();
});

run('reset and destroy invalidate every outstanding phase', () => {
  const { scheduler, changes, flow, snapshot } = setup();
  flow.open();
  scheduler.advance(320 + 650);
  flow.choose(snapshot().candidates[0].key);
  scheduler.advance(900);
  const cancelled = scheduler.ids();
  const generation = snapshot().generation;
  flow.reset();
  assert.equal(snapshot().stage, 'controls');
  assert.equal(snapshot().book.source, '青溪书阁');
  assert.equal(snapshot().book.chapter, '第三章 山路');
  assert.equal(snapshot().candidates.length, 0);
  assert.equal(snapshot().round, 0);
  assert(snapshot().generation > generation);
  assert.equal(scheduler.pending.size, 0);
  scheduler.deliverCancelled(cancelled);
  assert.equal(snapshot().stage, 'controls');
  flow.open();
  const afterDestroy = scheduler.ids();
  flow.destroy();
  const notifications = changes.length;
  assert.equal(scheduler.pending.size, 0);
  scheduler.deliverCancelled(afterDestroy);
  scheduler.advance(10000);
  assert.equal(changes.length, notifications);
  for (const method of ['showControls', 'hideControls', 'open', 'stop', 'restart', 'dismiss', 'reset', 'destroy']) {
    assert.equal(flow[method](), false);
  }
  assert.equal(flow.choose(successful[0].key), false);
});

run('reduced motion skips entrance movement, preserves asynchronous discovery and switching', () => {
  const { scheduler, flow, snapshot } = setup({ reduceMotion: true });
  flow.open();
  assert.equal(snapshot().stage, 'opening');
  assert.equal(snapshot().candidates.length, 0);
  scheduler.advance(0);
  assert.equal(snapshot().stage, 'discovering');
  scheduler.advance(649);
  assert.equal(snapshot().candidates.length, 0);
  scheduler.advance(1);
  assert.equal(snapshot().candidates.length, 1);
  flow.choose(snapshot().candidates[0].key);
  scheduler.advance(2399);
  assert.equal(snapshot().stage, 'switching');
  assert.equal(snapshot().book.source, '青溪书阁');
  scheduler.advance(1);
  assert.equal(snapshot().stage, 'completed');
  flow.destroy();
});

run('a change listener can cancel a phase before its timers are queued', () => {
  const scheduler = new Clock();
  let flow;
  flow = createSourceFlow({
    scheduler,
    onChange: (snapshot) => {
      if (snapshot.stage === 'discovering') flow.dismiss();
    },
  });
  flow.open();
  scheduler.advance(320);
  assert.equal(flow.getSnapshot().stage, 'reader');
  assert.equal(scheduler.pending.size, 0);
  scheduler.advance(10000);
  assert.equal(flow.getSnapshot().candidates.length, 0);
  flow.destroy();
});

console.log(JSON.stringify({ status: 'pass', checks: verified.length, verified, evidence: 'injected-time model only' }, null, 2));
