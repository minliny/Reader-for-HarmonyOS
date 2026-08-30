import assert from 'node:assert/strict';

import { ReaderTtsSessionCoordinator } from '../entry/src/main/ets/features/reading/ReaderTtsSessionCoordinator.ts';

const chapter = { sourceId: 'source-1', bookId: 'book-1', chapterIndex: 0, chapterTitle: '第一章' };
const content = '第一句。\n\n￼\n\n第二句。';
const plan = {
  chapter,
  strategy: 'paragraph-then-sentence',
  slices: [
    { index: 0, text: '第一句。', charStart: 0, charEnd: 4, paragraphIndex: 0 },
    { index: 1, text: '第二句。', charStart: 9, charEnd: 13, paragraphIndex: 1 },
  ],
  sourceCharCount: 13,
};

function startInput(overrides = {}) {
  return {
    chapter,
    content,
    contentVersion: 1,
    scalarPosition: 0,
    ...overrides,
  };
}

class FakeGateway {
  calls = [];
  cursor = 0;
  callbacks = new Set();
  queueState = 'idle';
  failPoints = new Map();

  async fail(point) {
    const failure = this.failPoints.get(point);
    if (failure !== undefined) throw failure;
  }

  async getConfig() { this.calls.push('config'); await this.fail('getConfig'); return { rate: 5, pitch: 0, followSys: false }; }
  async slice() { this.calls.push('slice'); await this.fail('slice'); return plan; }
  async play(_plan, index) { this.calls.push(`play:${index}`); await this.fail('play'); this.cursor = index; this.queueState = 'playing'; return this.snapshot('playing'); }
  async pause() { this.calls.push('pause'); await this.fail('pause'); this.queueState = 'paused'; return this.snapshot('paused'); }
  async resume() { this.calls.push('resume'); await this.fail('resume'); this.queueState = 'playing'; return this.snapshot('playing'); }
  async stop() { this.calls.push('stop'); this.queueState = 'stopped'; return this.snapshot('stopped'); }
  async setRate(_chapter, rate) { this.calls.push(`rate:${rate}`); await this.fail('setRate'); return this.snapshot('playing'); }
  async previous() { this.calls.push('previous'); this.cursor = Math.max(0, this.cursor - 1); return this.snapshot('playing'); }
  async seek(_chapter, index) { this.calls.push(`seek:${index}`); this.cursor = index; return this.snapshot(this.queueState); }
  async skip() { this.calls.push('skip'); this.cursor += 1; return this.cursor >= 2 ? this.snapshot('completed') : this.snapshot('playing'); }
  async reportCallback(_chapter, index, status, callbackId, failurePolicy, failureLimit) {
    this.calls.push(`callback:${index}:${status}:${callbackId}`);
    await this.fail('reportCallback');
    if (this.callbacks.has(callbackId)) {
      return { snapshot: this.snapshot(this.cursor >= 2 ? 'completed' : 'playing'), callbackDisposition: 'duplicate' };
    }
    this.callbacks.add(callbackId);
    if (this.queueState !== 'playing') {
      return { snapshot: this.snapshot(this.queueState), callbackDisposition: 'stale' };
    }
    if (status === 'done') this.cursor += 1;
    if (this.cursor >= 2) this.queueState = 'completed';
    return {
      snapshot: this.snapshot(this.queueState, failurePolicy, failureLimit),
      callbackDisposition: 'applied',
    };
  }
  snapshot(state, failurePolicy = 'stop', failureLimit = 3) {
    return {
      state,
      currentSliceIndex: state === 'completed' ? 1 : this.cursor,
      totalSlices: 2,
      completedSlices: state === 'completed' ? 2 : this.cursor,
      chapter,
      sliceStatuses: [],
      failurePolicy,
      consecutiveFailures: 0,
      failureLimit,
      drainBehavior: 'advance-to-next',
      restartPolicy: 'reset-on-core-restart',
    };
  }
}

class FakeHost {
  calls = [];
  listener;
  listenerOwner;
  requests = [];
  probeResult = { available: true };
  failPoints = new Map();

  setEventListener(listener, owner) { this.listener = listener; this.listenerOwner = owner; }
  clearEventListener(owner) {
    if (this.listenerOwner !== owner) return;
    this.listener = undefined;
    this.listenerOwner = undefined;
  }
  async fail(point) {
    const failure = this.failPoints.get(point);
    if (failure !== undefined) throw failure;
  }
  async selectEngine(engine) { this.calls.push(`engine:${engine ?? 'system'}`); await this.fail('selectEngine'); return true; }
  async probe() { this.calls.push('probe'); await this.fail('probe'); return this.probeResult; }
  async activateAudioSession(mix) { this.calls.push(`activate:${mix}`); await this.fail('activateAudioSession'); }
  async deactivateAudioSession() { this.calls.push('deactivate'); }
  async speak(request) {
    this.calls.push(`speak:${request.requestId}`);
    this.requests.push(request);
    await this.fail('speak');
  }
  async stop() { this.calls.push('stop'); }
  publishPlaybackState(state) { this.calls.push(`media:${state}`); }
  emit(event) { this.listener?.(event); }
}

function captureConsoleError() {
  const captured = [];
  const original = console.error;
  console.error = (...args) => { captured.push(args.map(String).join(' ')); };
  return {
    lines: captured,
    restore() { console.error = original; },
  };
}

const sleep = ms => new Promise(resolve => { setTimeout(resolve, ms); });

// ---------------------------------------------------------------------------
// A. Probe lifecycle: uninitialized -> probing -> idle, with preserved reasons.
// ---------------------------------------------------------------------------
{
  const gateway = new FakeGateway();
  const host = new FakeHost();
  const coordinator = new ReaderTtsSessionCoordinator(gateway, host);
  assert.equal(coordinator.getState().status, 'uninitialized');
  assert.equal(await coordinator.probeAvailability(), true);
  assert.equal(coordinator.getState().status, 'idle');

  host.probeResult = { available: false, reason: '中文离线音色未安装或音色创建失败：detail-1' };
  assert.equal(await coordinator.probeAvailability(), false);
  const unavailable = coordinator.getState();
  assert.equal(unavailable.status, 'unavailable');
  assert.equal(unavailable.stopReason, 'engineUnavailable');
  assert.equal(unavailable.errorMessage, '中文离线音色未安装或音色创建失败：detail-1',
    'unavailable must keep its concrete cause instead of clearing the error');

  host.probeResult = { available: true };
  host.failPoints.set('probe', new Error('engine boom'));
  assert.equal(await coordinator.probeAvailability(), false);
  assert.equal(coordinator.getState().status, 'unavailable');
  assert.equal(coordinator.getState().errorMessage, 'engine boom');
  host.failPoints.delete('probe');

  assert.equal(await coordinator.probeAvailability(), true);
  assert.equal(coordinator.getState().status, 'idle');
  assert.equal(coordinator.getState().errorMessage, undefined);
}

// ---------------------------------------------------------------------------
// B. Transactional start: any RPC / audio-session / Host failure rolls back
//    into a retryable error, never a wedged preparing.
// ---------------------------------------------------------------------------
{
  const scenarios = [
    { name: 'getConfig', gatewayFail: new Error('config rpc failed') },
    { name: 'host.selectEngine', hostFail: new Error('engine select failed') },
    { name: 'slice', gatewayFail: new Error('slice rpc failed'), point: 'slice' },
    { name: 'play', gatewayFail: new Error('play rpc failed'), point: 'play' },
    { name: 'setRate', gatewayFail: new Error('rate rpc failed'), point: 'setRate' },
  ];
  for (const scenario of scenarios) {
    const gateway = new FakeGateway();
    const host = new FakeHost();
    const coordinator = new ReaderTtsSessionCoordinator(gateway, host);
    if (scenario.gatewayFail !== undefined) {
      gateway.failPoints.set(scenario.point ?? 'getConfig', scenario.gatewayFail);
    }
    if (scenario.hostFail !== undefined) host.failPoints.set('selectEngine', scenario.hostFail);

    await coordinator.start(startInput());
    const state = coordinator.getState();
    assert.equal(state.status, 'error', `${scenario.name} must land in error`);
    assert.equal(state.stopReason, 'startFailed');
    assert.equal(state.audioStarted, false);
    assert.equal(state.chapterKey, undefined, `${scenario.name} must clear the active session`);
    assert.equal(state.requestId, undefined);
    assert.ok(state.errorMessage !== undefined && state.errorMessage.length > 0,
      `${scenario.name} must surface a concrete message`);
    assert.ok(host.calls.includes('stop'), `${scenario.name} must stop the Host`);
    assert.ok(host.calls.includes('deactivate'), `${scenario.name} must release the audio session`);

    // Retryable: clearing the fault makes the next start succeed.
    gateway.failPoints.delete(scenario.point ?? 'getConfig');
    host.failPoints.delete('selectEngine');
    await coordinator.start(startInput({ contentVersion: 2 }));
    assert.equal(coordinator.getState().status, 'preparing');
    host.emit({ type: 'start', requestId: host.requests.at(-1).requestId });
    await coordinator.whenSettled();
    assert.equal(coordinator.getState().status, 'playing');
    await coordinator.dispose();
  }

  // Engine unavailable mid-start: capability gate, not error.
  {
    const gateway = new FakeGateway();
    const host = new FakeHost();
    host.probeResult = { available: false, reason: '系统不支持朗读：detail-2' };
    const coordinator = new ReaderTtsSessionCoordinator(gateway, host);
    await coordinator.start(startInput());
    const state = coordinator.getState();
    assert.equal(state.status, 'unavailable');
    assert.equal(state.stopReason, 'engineUnavailable');
    assert.equal(state.errorMessage, '系统不支持朗读：detail-2');
    assert.equal(state.chapterKey, undefined, 'unavailable must not keep a phantom active session');
    await coordinator.dispose();
  }

  // Audio session failure keeps the concrete cause.
  {
    const gateway = new FakeGateway();
    const host = new FakeHost();
    host.failPoints.set('activateAudioSession', new Error('focus denied'));
    const coordinator = new ReaderTtsSessionCoordinator(gateway, host);
    await coordinator.start(startInput());
    const state = coordinator.getState();
    assert.equal(state.status, 'error');
    assert.ok(state.errorMessage.includes('音频会话启动失败'), state.errorMessage);
    assert.ok(state.errorMessage.includes('focus denied'), state.errorMessage);
    assert.ok(host.calls.includes('deactivate'));
    await coordinator.dispose();
  }

  // speak() rejection before any real onStart: retryable error.
  {
    const gateway = new FakeGateway();
    const host = new FakeHost();
    host.failPoints.set('speak', new Error('synth failed'));
    const coordinator = new ReaderTtsSessionCoordinator(gateway, host);
    await coordinator.start(startInput());
    const state = coordinator.getState();
    assert.equal(state.status, 'error');
    assert.equal(state.errorMessage, 'synth failed');
    await coordinator.dispose();
  }
}

// ---------------------------------------------------------------------------
// C. speak accepted but no onStart: watchdog lands in error, panel-visible,
//    retry and engine selection stay reachable, late start cannot fake playing.
// ---------------------------------------------------------------------------
{
  const gateway = new FakeGateway();
  const host = new FakeHost();
  const coordinator = new ReaderTtsSessionCoordinator(
    gateway,
    host,
    async () => {},
    undefined,
    undefined,
    { startCallbackTimeoutMs: 60 },
  );
  await coordinator.start(startInput());
  const started = coordinator.whenStarted();
  assert.equal(coordinator.getState().status, 'preparing');
  assert.equal(coordinator.getState().audioStarted, false);
  assert.equal(await started, false, 'no onStart within the deadline must resolve whenStarted(false)');
  const state = coordinator.getState();
  assert.equal(state.status, 'error');
  assert.equal(state.stopReason, 'startTimeout');
  assert.equal(state.errorMessage, '语音引擎未在规定时间内开始播放');
  assert.ok(host.calls.includes('stop'), 'watchdog must stop the Host transport');
  assert.ok(host.calls.includes('deactivate'), 'watchdog must release the audio session');

  host.emit({ type: 'start', requestId: host.requests.at(-1).requestId });
  await coordinator.whenSettled();
  assert.equal(coordinator.getState().status, 'error',
    'a late start callback must not revive a timed-out session');

  // Retry path stays available from the error state.
  await coordinator.start(startInput({ contentVersion: 2 }));
  const retriedStarted = coordinator.whenStarted();
  host.emit({ type: 'start', requestId: host.requests.at(-1).requestId });
  await coordinator.whenSettled();
  assert.equal(coordinator.getState().status, 'playing');
  assert.equal(await retriedStarted, true);
  await coordinator.dispose();
}

// ---------------------------------------------------------------------------
// D. Callback queue failures: structured log, state update, no ghost playing.
// ---------------------------------------------------------------------------
{
  const consoleCapture = captureConsoleError();
  try {
    const gateway = new FakeGateway();
    const host = new FakeHost();
    gateway.failPoints.set('reportCallback', new Error('core down'));
    const coordinator = new ReaderTtsSessionCoordinator(gateway, host);
    await coordinator.start(startInput());
    host.emit({ type: 'start', requestId: host.requests.at(-1).requestId });
    await coordinator.whenSettled();
    assert.equal(coordinator.getState().status, 'error',
      'a failed start callback must not leave the session preparing');
    assert.ok(coordinator.getState().errorMessage.includes('朗读回调处理失败'));
    assert.ok(
      consoleCapture.lines.some(line => line.includes('[ReaderTTS]') && line.includes('callback.start')),
      `callback failures must log structurally, got: ${JSON.stringify(consoleCapture.lines)}`,
    );
    await coordinator.dispose();

    // Detached transport intents log rejections instead of crashing silently.
    const detachedGateway = new FakeGateway();
    const detachedHost = new FakeHost();
    const detached = new ReaderTtsSessionCoordinator(detachedGateway, detachedHost);
    await detached.start(startInput({ contentVersion: 2 }));
    detachedHost.emit({ type: 'start', requestId: detachedHost.requests.at(-1).requestId });
    await detached.whenSettled();
    assert.equal(detached.getState().status, 'playing');
    detachedGateway.failPoints.set('pause', new Error('pause rpc failed'));
    detachedHost.emit({ type: 'mediaControl', action: 'pause' });
    await detached.whenSettled();
    await sleep(10);
    assert.ok(
      consoleCapture.lines.some(line => line.includes('mediaControl.pause')),
      'detached media-control failures must be logged',
    );
    await detached.dispose();
  } finally {
    consoleCapture.restore();
  }
}

// ---------------------------------------------------------------------------
// E. Shared listener owner isolation: page A teardown must not drop page B.
// ---------------------------------------------------------------------------
{
  const host = new FakeHost();
  const gatewayA = new FakeGateway();
  const gatewayB = new FakeGateway();
  const coordinatorA = new ReaderTtsSessionCoordinator(gatewayA, host);
  const coordinatorB = new ReaderTtsSessionCoordinator(gatewayB, host);
  const ownerAfterB = host.listenerOwner;
  assert.ok(ownerAfterB !== undefined);

  await coordinatorA.dispose();
  assert.equal(host.listenerOwner, ownerAfterB,
    'disposing the stale page must keep the newer page listener');

  await coordinatorB.start(startInput());
  host.emit({ type: 'start', requestId: host.requests.at(-1).requestId });
  await coordinatorB.whenSettled();
  assert.equal(coordinatorB.getState().status, 'playing',
    'the newer page must keep receiving host callbacks after the stale page exits');

  await coordinatorB.dispose();
  assert.equal(host.listener, undefined,
    'disposing the current owner must clear the listener');
}

// ---------------------------------------------------------------------------
// F. Real onStart gates `playing`; slice auto-advance keeps flowing.
// ---------------------------------------------------------------------------
{
  const gateway = new FakeGateway();
  const host = new FakeHost();
  const coordinator = new ReaderTtsSessionCoordinator(gateway, host);
  await coordinator.start(startInput());
  // Core already reports a `playing` queue, but no engine callback arrived yet.
  assert.equal(coordinator.getState().status, 'preparing',
    'a Core playing snapshot must not fake audible playback');
  assert.equal(coordinator.getState().audioStarted, false);

  host.emit({ type: 'start', requestId: host.requests.at(-1).requestId });
  await coordinator.whenSettled();
  assert.equal(coordinator.getState().status, 'playing');
  assert.equal(coordinator.getState().audioStarted, true);

  host.emit({ type: 'complete', requestId: host.requests.at(-1).requestId, completion: 'audio' });
  await coordinator.whenSettled();
  assert.equal(host.requests.length, 2, 'finishing slice one must automatically speak slice two');
  assert.notEqual(host.requests[1].requestId, host.requests[0].requestId);
  assert.equal(coordinator.getState().status, 'preparing');

  host.emit({ type: 'start', requestId: host.requests.at(-1).requestId });
  await coordinator.whenSettled();
  host.emit({ type: 'complete', requestId: host.requests.at(-1).requestId, completion: 'audio' });
  await coordinator.whenSettled();
  assert.equal(coordinator.getState().status, 'completed',
    'draining the queue with no next chapter must complete the session');
  await coordinator.dispose();
}

// ---------------------------------------------------------------------------
// G. Background / foreground and audio-interruption transitions.
// ---------------------------------------------------------------------------
{
  const gateway = new FakeGateway();
  const host = new FakeHost();
  const coordinator = new ReaderTtsSessionCoordinator(gateway, host);
  await coordinator.start(startInput());
  host.emit({ type: 'start', requestId: host.requests.at(-1).requestId });
  await coordinator.whenSettled();
  assert.equal(coordinator.getState().status, 'playing');

  await coordinator.pauseForBackground();
  const backgroundState = coordinator.getState();
  assert.equal(backgroundState.status, 'interrupted');
  assert.equal(backgroundState.pauseReason, 'routeBackground');
  assert.ok(host.calls.includes('deactivate'), 'background pause must release the audio session');

  host.emit({ type: 'interruption', action: 'resume' });
  await coordinator.whenSettled();
  assert.equal(coordinator.getState().status, 'preparing');
  host.emit({ type: 'start', requestId: host.requests.at(-1).requestId });
  await coordinator.whenSettled();
  assert.equal(coordinator.getState().status, 'playing',
    'foreground resume must return to real playback only after onStart');

  host.emit({ type: 'interruption', action: 'pause' });
  await coordinator.whenSettled();
  assert.equal(coordinator.getState().status, 'interrupted');
  assert.equal(coordinator.getState().pauseReason, 'systemInterruption');

  host.emit({ type: 'interruption', action: 'resume' });
  await coordinator.whenSettled();
  host.emit({ type: 'start', requestId: host.requests.at(-1).requestId });
  await coordinator.whenSettled();
  await coordinator.dispose();
  assert.equal(coordinator.getState().status, 'idle');
}

console.log('reader TTS state machine transactions and isolation: PASS');
