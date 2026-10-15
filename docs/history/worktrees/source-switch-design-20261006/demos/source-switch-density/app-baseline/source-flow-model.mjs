/**
 * Standalone source-switch preview data. These are fictional timed responses,
 * not real source health or body-reading speed measurements.
 */
const freeze = (value) => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};

const candidateKey = (sourceId, bookUrl) => `${sourceId.length}:${sourceId}${bookUrl.length}:${bookUrl}`;

const fixture = (sourceId, name, delayMs, searchLatencyMs, latestChapter, success = true) => {
  const bookUrl = `https://preview.reader.invalid/${sourceId}/shanjian-zaji`;
  return {
    key: candidateKey(sourceId, bookUrl), sourceId, bookUrl,
    name, sourceName: name, latestChapter,
    searchLatencyMs, latencyMs: searchLatencyMs, delayMs, success,
  };
};

export const sourceFlowFixtures = freeze([
  fixture('source-songjian', '松间书屋', 650, 240, '第十二章 雨夜归人'),
  fixture('source-yunhai', '云海阅读', 1250, 330, '第十二章 雨夜归人'),
  fixture('source-xiliu', '溪流阅读', 1750, null, '', false),
  fixture('source-yuanshan', '远山书库', 2100, 510, '第十一章 山路'),
  fixture('source-qingye', '青叶书坊', 3100, 680, '第十二章 雨夜归人'),
  fixture('source-nanfeng', '南风书库', 3600, null, '', false),
  fixture('source-zhujian', '竹简书库', 4100, 810, '第十二章 雨夜归人'),
  fixture('source-yuexia', '月下藏书', 5300, 960, '第十一章 山路'),
]);

const originalBook = freeze({
  id: 'demo-novel-shanjian-zaji', title: '山间札记', author: '林远',
  latestChapter: '第十二章 雨夜归人', source: '青溪书阁',
  chapter: '第三章 山路', content: 'novel', kind: 'online',
});

const asCandidate = ({ delayMs, success, ...candidate }) => ({ ...candidate });
const selectableStages = new Set(['discovering', 'stopped', 'ready']);
const closedStages = new Set(['reader', 'controls', 'completed']);

/**
 * Pure demo lifecycle with injected time. Successful responses update their
 * stable sourceId + bookUrl row in place; unsuccessful responses have no row.
 * Cancelling a phase also advances its generation, so even a transport that
 * delivers after cancellation cannot modify the new phase.
 */
export function createSourceFlow({ scheduler = globalThis, onChange = () => {}, reduceMotion = false } = {}) {
  if (typeof scheduler.setTimeout !== 'function' || typeof scheduler.clearTimeout !== 'function') {
    throw new TypeError('Source flow scheduler must provide setTimeout and clearTimeout.');
  }
  const setTimer = scheduler.setTimeout.bind(scheduler);
  const clearTimer = scheduler.clearTimeout.bind(scheduler);
  const timers = new Set();
  let destroyed = false;
  let currentSourceId = 'source-qingxi';
  let state = {
    stage: 'controls', discovery: 'idle', candidates: [], book: { ...originalBook },
    selected: null, switchStep: '', round: 0, generation: 0,
  };

  const getSnapshot = () => freeze({
    ...state,
    candidates: state.candidates.map((candidate) => ({ ...candidate })),
    book: { ...state.book },
    selected: state.selected ? { ...state.selected } : null,
  });
  const publish = () => {
    if (!destroyed) onChange(getSnapshot());
  };
  const cancelPhase = () => {
    state.generation += 1;
    for (const timer of timers) clearTimer(timer);
    timers.clear();
    return state.generation;
  };
  const later = (delayMs, generation, action) => {
    // onChange may itself dismiss/reset the preview before this phase queues.
    if (destroyed || state.generation !== generation) return;
    let handle;
    handle = setTimer(() => {
      timers.delete(handle);
      if (destroyed || state.generation !== generation) return;
      action();
    }, delayMs);
    timers.add(handle);
  };
  const acceptSuccess = (response) => {
    if (state.stage !== 'discovering' || state.discovery !== 'running' || !response.success) return;
    if (response.sourceId === currentSourceId) return;
    const candidate = asCandidate(response);
    const existing = state.candidates.find((entry) => entry.key === candidate.key);
    state.candidates = existing
      ? state.candidates.map((entry) => entry.key === candidate.key ? candidate : entry)
      : [...state.candidates, candidate];
    publish();
  };
  const discover = (generation) => {
    state.stage = 'discovering';
    state.discovery = 'running';
    state.round += 1;
    state.selected = null;
    state.switchStep = '';
    state.candidates = state.candidates.filter((candidate) => candidate.sourceId !== currentSourceId);
    publish();
    for (const response of sourceFlowFixtures) {
      later(response.delayMs, generation, () => acceptSuccess(response));
    }
    later(6000, generation, () => {
      if (state.stage !== 'discovering') return;
      state.stage = 'ready';
      state.discovery = 'complete';
      publish();
    });
  };

  const showControls = () => {
    if (destroyed || !['reader', 'completed'].includes(state.stage)) return false;
    state.stage = 'controls';
    state.selected = null;
    state.switchStep = '';
    publish();
    return true;
  };
  const hideControls = () => {
    if (destroyed || state.stage !== 'controls') return false;
    state.stage = 'reader';
    publish();
    return true;
  };
  const open = () => {
    if (destroyed || !closedStages.has(state.stage)) return false;
    const generation = cancelPhase();
    state.stage = 'opening';
    state.discovery = 'idle';
    state.selected = null;
    state.switchStep = '';
    state.candidates = state.candidates.filter((candidate) => candidate.sourceId !== currentSourceId);
    publish();
    later(reduceMotion ? 0 : 320, generation, () => discover(generation));
    return true;
  };
  const stop = () => {
    if (destroyed || state.stage !== 'discovering' || state.discovery !== 'running') return false;
    cancelPhase();
    state.stage = 'stopped';
    state.discovery = 'stopped';
    publish();
    return true;
  };
  const restart = () => {
    if (destroyed || !selectableStages.has(state.stage)) return false;
    const generation = cancelPhase();
    discover(generation);
    return true;
  };
  const choose = (key) => {
    if (destroyed || !selectableStages.has(state.stage)) return false;
    const candidate = state.candidates.find((entry) => entry.key === key && entry.sourceId !== currentSourceId);
    if (!candidate) return false;
    const generation = cancelPhase();
    state.stage = 'switching';
    if (state.discovery === 'running') state.discovery = 'stopped';
    state.selected = { ...candidate };
    state.switchStep = 'prepare';
    publish();
    later(900, generation, () => {
      state.switchStep = 'locate';
      publish();
      later(900, generation, () => {
        state.switchStep = 'finish';
        publish();
        later(600, generation, () => {
          currentSourceId = candidate.sourceId;
          state.book = { ...state.book, source: candidate.sourceName, latestChapter: candidate.latestChapter };
          state.candidates = state.candidates.filter((entry) => entry.sourceId !== currentSourceId);
          state.stage = 'completed';
          publish();
        });
      });
    });
    return true;
  };
  const dismiss = () => {
    if (destroyed || closedStages.has(state.stage) || state.stage === 'switching') return false;
    cancelPhase();
    state.stage = 'reader';
    state.discovery = 'idle';
    state.selected = null;
    state.switchStep = '';
    publish();
    return true;
  };
  const reset = () => {
    if (destroyed) return false;
    const generation = cancelPhase();
    currentSourceId = 'source-qingxi';
    state = {
      stage: 'controls', discovery: 'idle', candidates: [], book: { ...originalBook },
      selected: null, switchStep: '', round: 0, generation,
    };
    publish();
    return true;
  };
  const destroy = () => {
    if (destroyed) return false;
    cancelPhase();
    destroyed = true;
    return true;
  };

  return freeze({ getSnapshot, showControls, hideControls, open, stop, restart, choose, dismiss, reset, destroy });
}
