export const chapter = { sourceId: 'source-1', bookId: 'book-1', chapterIndex: 0, chapterTitle: '第一章' };
export const canonicalRemoteContent = '第一句。\n\n\uFFFC\n\n第二句。';
export const plan = {
  chapter,
  strategy: 'paragraph-then-sentence',
  slices: [
    { index: 0, text: '第一句。', charStart: 0, charEnd: 4, paragraphIndex: 0 },
    { index: 1, text: '第二句。', charStart: 9, charEnd: 13, paragraphIndex: 1 },
  ],
  sourceCharCount: 13,
};

export class FakeGateway {
  calls = [];
  cursor = 0;
  callbacks = new Set();
  queueState = 'idle';

  async getConfig() { this.calls.push('config'); return { rate: 5, pitch: 0, followSys: false }; }
  async slice() { this.calls.push('slice'); return plan; }
  async play(_plan, index) { this.calls.push(`play:${index}`); this.cursor = index; this.queueState = 'playing'; return this.snapshot('playing'); }
  async pause() { this.calls.push('pause'); this.queueState = 'paused'; return this.snapshot('paused'); }
  async resume() { this.calls.push('resume'); this.queueState = 'playing'; return this.snapshot('playing'); }
  async stop() { this.calls.push('stop'); this.queueState = 'stopped'; return this.snapshot('stopped'); }
  async setRate(_chapter, rate) { this.calls.push(`rate:${rate}`); return this.snapshot(this.queueState); }
  async previous() { this.calls.push('previous'); this.cursor = Math.max(0, this.cursor - 1); return this.snapshot('playing'); }
  async seek(_chapter, index) { this.calls.push(`seek:${index}`); this.cursor = index; return this.snapshot(this.queueState); }
  async skip() { this.calls.push('skip'); this.cursor += 1; return this.cursor >= 2 ? this.snapshot('completed') : this.snapshot('playing'); }
  async next() { this.calls.push('next'); this.cursor += 1; return this.cursor >= 2 ? this.snapshot('completed') : this.snapshot('playing'); }
  async reportStatus(_chapter, index, status) { this.calls.push(`report:${index}:${status}`); return this.snapshot('playing'); }
  async reportCallback(_chapter, index, status, callbackId, failurePolicy, failureLimit) {
    this.calls.push(`callback:${index}:${status}:${callbackId}`);
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

export class FakeHost {
  calls = [];
  listener;
  listenerOwner;
  requests = [];
  speakGate;
  setEventListener(listener, owner) { this.listener = listener; this.listenerOwner = owner; }
  clearEventListener(owner) {
    if (this.listenerOwner !== owner) return;
    this.listener = undefined;
    this.listenerOwner = undefined;
  }
  async selectEngine(engine) { this.calls.push(`engine:${engine ?? 'system'}`); return true; }
  async probe() { this.calls.push('available'); return { available: true }; }
  async isAvailable() { this.calls.push('available'); return true; }
  async activateAudioSession(mix) { this.calls.push(`activate:${mix}`); }
  async deactivateAudioSession() { this.calls.push('deactivate'); }
  async speak(request) {
    this.calls.push(`speak:${request.requestId}`);
    this.requests.push(request);
    const gate = this.speakGate;
    if (gate !== undefined) {
      this.speakGate = undefined;
      gate.markEntered();
      await gate.blocked;
    }
  }
  async stop() { this.calls.push('stop'); }
  publishPlaybackState(state) { this.calls.push(`media:${state}`); }
  emit(event) { this.listener?.(event); }
  blockNextSpeak() {
    let markEntered = () => {};
    let release = () => {};
    const entered = new Promise(resolve => { markEntered = resolve; });
    const blocked = new Promise(resolve => { release = resolve; });
    this.speakGate = { blocked, markEntered };
    return { entered, release };
  }
}
