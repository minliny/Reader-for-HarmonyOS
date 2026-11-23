import assert from 'node:assert/strict';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

const definitions = {
  'first-slice-continuity': { description: 'Actual Coordinator rejects first Previous without retiring playing, paused or blocked preparing; original callbacks and media route retain ownership', resources: [] },
  'start-watchdog': { description: 'Original first-request watchdog survives rejected Previous and still owns its timeout', resources: [] },
  'valid-adjacent': { description: 'Valid Previous still stops immediately; next at the final slice completes the queue', resources: [] },
};

// A finite timer port observes the actual coordinator watchdog without a wall-clock wait.
function installClock() {
  const originalSet = globalThis.setTimeout, originalClear = globalThis.clearTimeout;
  const tasks = new Map();
  let sequence = 0;
  globalThis.setTimeout = (callback, delay, ...args) => {
    const handle = ++sequence;
    tasks.set(handle, { callback, delay, args });
    return handle;
  };
  globalThis.clearTimeout = handle => { tasks.delete(handle); };
  return {
    tasks,
    fire(handle) {
      const task = tasks.get(handle);
      assert.ok(task, 'only an actually armed timer can fire');
      tasks.delete(handle);
      task.callback(...task.args);
    },
    restore() { globalThis.setTimeout = originalSet; globalThis.clearTimeout = originalClear; },
  };
}

async function run(id) {
  const { ReaderTtsSessionCoordinator } = await import('../entry/src/main/ets/features/reading/application/ReaderTtsSessionCoordinator.ts');
  const { chapter, canonicalRemoteContent, plan, FakeGateway, FakeHost } = await import('./lib/reader-tts-fixtures.mjs');
  // The shared fixture clamps first Previous. This port instead keeps Core's
  // known boundary rejection; the invalid App operation must never call it.
  class StrictGateway extends FakeGateway {
    async previous() {
      this.calls.push('previous');
      if (this.cursor === 0) throw new Error('INVALID_PARAMS: already at first slice');
      this.cursor -= 1;
      return this.snapshot(this.queueState);
    }
  }
  const clock = installClock(), owned = [];
  async function fixture(phase = 'playing', scalarPosition = 0) {
    const gateway = new StrictGateway(), host = new FakeHost(), progress = [], states = [];
    const coordinator = new ReaderTtsSessionCoordinator(gateway, host,
      async update => { progress.push(update.charEnd); }, state => { states.push(state); },
      undefined, { startCallbackTimeoutMs: 500 });
    const gate = phase === 'blocked-preparing' ? host.blockNextSpeak() : undefined;
    const f = { coordinator, gateway, host, progress, states, gate };
    owned.push(f);
    f.startTask = coordinator.start({ chapter, content: canonicalRemoteContent,
      contentVersion: 2801, scalarPosition });
    if (gate) await gate.entered;
    else await f.startTask;
    if (phase === 'playing' || phase === 'paused') {
      host.emit({ type: 'start', requestId: host.requests[0].requestId });
      await coordinator.whenSettled();
      if (phase === 'paused') await coordinator.pause();
    }
    return f;
  }
  function capture(f) {
    return { state: f.coordinator.getState(), transport: f.coordinator.getTransportState(),
      hostCalls: [...f.host.calls], gatewayCalls: [...f.gateway.calls], requests: [...f.host.requests],
      publications: f.states.length };
  }
  function unchanged(f, before, label) {
    assert.deepEqual(f.coordinator.getState(), before.state, label + ': state and position stay owned');
    assert.deepEqual(f.coordinator.getTransportState(), before.transport, label + ': original request stays owned');
    assert.deepEqual(f.host.calls, before.hostCalls, label + ': no stop or replacement speech');
    assert.deepEqual(f.gateway.calls, before.gatewayCalls, label + ': no boundary Core RPC');
    assert.deepEqual(f.host.requests, before.requests, label + ': no replacement request');
    assert.equal(f.states.length, before.publications, label + ': no transient preparing publication');
  }
  async function rejectPrevious(f) {
    const before = capture(f);
    const task = f.coordinator.previous();
    assert.ok(task instanceof Promise, 'boundary retains the rejected Promise API');
    const rejection = task.then(() => undefined, error => error);
    unchanged(f, before, 'synchronous first Previous');
    const error = await rejection;
    assert.ok(error instanceof Error);
    assert.equal(error.message, 'Reader TTS previous rejected: already at first slice');
    unchanged(f, before, 'settled first Previous');
  }
  async function finishOriginalSlice(f, request) {
    f.host.emit({ type: 'start', requestId: request.requestId });
    await f.coordinator.whenSettled();
    assert.equal(f.coordinator.getState().status, 'playing');
    assert.equal(f.coordinator.getState().requestId, request.requestId);
    assert.ok(f.gateway.calls.some(call => call === `callback:0:speaking:${request.requestId}:start`));
    const requests = f.host.requests.length;
    f.host.emit({ type: 'complete', requestId: request.requestId, completion: 'audio' });
    f.host.emit({ type: 'complete', requestId: request.requestId, completion: 'audio' });
    await f.coordinator.whenSettled();
    assert.deepEqual(f.progress, [plan.slices[0].charEnd], 'original heard ACK commits once');
    assert.equal(f.host.requests.length, requests + 1, 'original completion speaks the next slice once');
    assert.equal(f.coordinator.getState().sliceIndex, 1);
    assert.equal(f.host.requests.at(-1).text, plan.slices[1].text);
  }
  try {
    if (id === 'first-slice-continuity') {
      for (const phase of ['playing', 'paused', 'blocked-preparing']) {
        const f = await fixture(phase);
        try {
          const original = f.host.requests[0];
          await rejectPrevious(f);
          if (phase === 'playing') {
            const before = capture(f), errors = [], originalError = console.error;
            console.error = (...args) => { errors.push(args.join(' ')); };
            try {
              f.host.emit({ type: 'mediaControl', action: 'previous' });
              await f.coordinator.whenSettled();
              unchanged(f, before, 'media first Previous');
              assert.ok(errors.some(message => message.includes('stage=mediaControl.previous')));
            } finally { console.error = originalError; }
          }
          let request = original;
          if (phase === 'paused') {
            assert.equal(f.coordinator.getState().status, 'paused');
            await f.coordinator.resume();
            request = f.host.requests.at(-1);
            assert.notEqual(request.requestId, original.requestId, 'only explicit resume creates a new request');
          } else if (f.gate) {
            f.gate.release();
            await f.startTask;
            assert.equal(f.host.requests[0], original, 'unblocked original speak retains its request');
          }
          await finishOriginalSlice(f, request);
        } finally {
          f.gate?.release();
          await f.startTask;
          await f.coordinator.dispose();
        }
      }
    } else if (id === 'start-watchdog') {
      const f = await fixture('preparing');
      const request = f.host.requests[0], started = f.coordinator.whenStarted();
      assert.equal(f.coordinator.getState().status, 'preparing');
      assert.equal(clock.tasks.size, 1, 'actual first-request watchdog armed');
      const [handle, watchdog] = [...clock.tasks][0];
      await rejectPrevious(f);
      assert.equal(clock.tasks.get(handle), watchdog, 'same original watchdog remains armed');
      assert.equal(f.coordinator.getState().requestId, request.requestId);
      clock.fire(handle);
      await f.coordinator.whenSettled();
      assert.equal(await started, false);
      assert.equal(f.coordinator.getState().status, 'error');
      assert.equal(f.coordinator.getState().stopReason, 'startTimeout');
      assert.ok(f.gateway.calls.some(call => call.startsWith(`callback:0:failed:${request.requestId}:`)),
        'original watchdog reports its original request before error cleanup');
      assert.equal(f.host.calls.filter(call => call === 'stop').length, 1, 'timeout, not rejected Previous, stops Host');
      assert.equal(f.host.requests.length, 1);
      assert.equal(clock.tasks.size, 0);
    } else if (id === 'valid-adjacent') {
      const f = await fixture('playing', plan.slices[1].charStart);
      const previous = f.coordinator.previous();
      assert.equal(f.host.calls.filter(call => call === 'stop').length, 1, 'valid Previous still stops immediately');
      await previous;
      assert.equal(f.gateway.calls.filter(call => call === 'previous').length, 1);
      assert.equal(f.coordinator.getState().sliceIndex, 0);
      assert.equal(f.host.requests.at(-1).text, plan.slices[0].text);
      f.host.emit({ type: 'start', requestId: f.host.requests.at(-1).requestId });
      await f.coordinator.whenSettled();
      await f.coordinator.next();
      assert.equal(f.coordinator.getState().sliceIndex, 1);
      f.host.emit({ type: 'start', requestId: f.host.requests.at(-1).requestId });
      await f.coordinator.whenSettled();
      const requests = f.host.requests.length;
      await f.coordinator.next();
      assert.equal(f.coordinator.getState().status, 'completed');
      assert.equal(f.gateway.calls.filter(call => call === 'skip').length, 2);
      assert.equal(f.host.requests.length, requests, 'last Next does not invent another slice');
      assert.deepEqual(f.progress, [], 'manual skips do not claim heard progress');
    }
  } finally {
    try {
      for (const f of owned) f.gate?.release();
      for (const f of owned) {
        await f.startTask;
        await f.coordinator.dispose();
      }
    } finally { clock.restore(); }
  }
}

for (const id of selectContractCases(definitions)) {
  await run(id);
  recordContractCasePass(id);
}
