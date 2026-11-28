import assert from 'node:assert/strict';
import { test } from 'node:test';
import { evaluateTransitionInvariants, readerTransitionLaunchNodes, READER_LAUNCH_PROXY, READER_LAUNCH_SOURCE,
  READER_LAUNCH_SHARP, READER_LAUNCH_LEADING_ICON, READER_LAUNCH_LEADING_LABEL, READER_LAUNCH_PAUSE,
  type ReaderTransitionFrame, type ReaderTransitionNode, type ReaderTransitionObservation
} from '../../entry/src/main/ets/ui/layout/TransitionInvariantEvaluator.ts';

function actor(id: string, changes: Partial<ReaderTransitionNode> = {}): ReaderTransitionNode {
  return { id, nativeId: 1, x: 20, y: 24, width: 355, height: 44, opacity: 1, visible: true, ...changes };
}

function samples(...nodes: ReaderTransitionNode[][]): ReaderTransitionFrame[] {
  return nodes.map((sample, index) => ({ atMs: index * 16, nodes: sample, unreadableIds: [] }));
}

function request(kind: ReaderTransitionObservation['kind'], action: string, nodes: string[]): ReaderTransitionObservation {
  return { kind, action, subject: 'fixture', scope: 'fixture', nodes };
}

test('T1 measures the header/footer/popup anchor and permits motion only on the authored axis', () => {
  const header = actor('header');
  const footer = actor('footer', { nativeId: 2, y: 740 });
  const page = { ...request('surface', 'mount', ['header', 'footer']), axis: 'x' } as const;
  assert.deepEqual(evaluateTransitionInvariants(page, samples([header, footer],
    [{ ...header, x: 19, y: 25 }, { ...footer, x: 0 }])).observedRules, ['T1']);
  const sheet = { ...request('surface', 'mount', ['sheet']), axis: 'y' } as const;
  assert.deepEqual(evaluateTransitionInvariants(sheet, samples([actor('sheet', { y: 800 })],
    [actor('sheet', { y: 550 })])).observedRules, ['T1']);
});

test('T1 catches late safe-top settling, cumulative anchor movement, size snap and reappearance', () => {
  const input = request('surface', 'mount', ['panel']);
  const start = actor('panel');
  const regressions = [
    samples([start], [actor('panel', { y: 27 })]),
    samples([start], [actor('panel', { x: 21 })], [actor('panel', { x: 22 })], [actor('panel', { x: 23 })]),
    samples([start], [actor('panel', { width: 352 })]),
    samples([start], [], [actor('panel', { nativeId: 2 })]),
  ];
  for (const frames of regressions) {
    const result = evaluateTransitionInvariants(input, frames);
    assert.deepEqual(result.observedRules, ['T1']);
    assert.equal(result.violations.length, 1);
  }
});

function lane(...xs: number[]): ReaderTransitionFrame[] { return samples(...xs.map(x => [actor('lane', { x })])); }

test('T2 accepts separate push, pop, retained reveal, and returning edge-cancel intervals', () => {
  const push = request('route', 'push', ['lane']);
  const pop = request('route', 'pop', ['lane']);
  const preview = { ...request('route', 'preview', ['lane']), routeOriginX: 24 };
  const cancel = { ...request('route', 'cancel', ['lane']), routeOriginX: 24 };
  for (const result of [
    evaluateTransitionInvariants(push, lane(360, 290, 142, 22)),
    evaluateTransitionInvariants(pop, lane(0, 40, 125, 290)),
    evaluateTransitionInvariants({ ...pop, staticMotion: true }, lane(0, 0, 0)),
    evaluateTransitionInvariants(preview, lane(24, 72, 50, 95)),
    evaluateTransitionInvariants(cancel, lane(95, 55, 24, 24)),
  ]) {
    assert.deepEqual(result.observedRules, ['T2']);
    assert.deepEqual(result.violations, []);
  }
});

test('T2 rejects reversed pushes, pop reversal smaller than 2vp per frame, and displaced cancel', () => {
  const push = request('route', 'push', ['lane']);
  const pop = request('route', 'pop', ['lane']);
  const preview = { ...request('route', 'preview', ['lane']), routeOriginX: 24 };
  const cancel = { ...request('route', 'cancel', ['lane']), routeOriginX: 24 };
  assert.equal(evaluateTransitionInvariants(push, lane(100, 70, 80)).violations[0].code, 'route-direction-reversed');
  assert.equal(evaluateTransitionInvariants(pop, lane(7, 40, 39, 38, 37)).violations[0].code, 'route-direction-reversed');
  assert.equal(evaluateTransitionInvariants(preview, lane(24, 48, 20)).violations[0].code, 'route-direction-reversed');
  assert.equal(evaluateTransitionInvariants(cancel, lane(52, 76, 24)).violations[0].code, 'route-direction-reversed');
  assert.equal(evaluateTransitionInvariants(cancel, lane(70, 45, 32)).violations[0].code, 'route-cancel-rest-position');
  const superseded = evaluateTransitionInvariants(cancel, lane(70, 45, 32), false);
  assert.deepEqual(superseded.violations, []);
  assert.deepEqual(superseded.missing, ['T2:required-actor-unobserved']);
  assert.equal(evaluateTransitionInvariants({ ...pop, staticMotion: true }, lane(4, 3, 2, 1)).violations[0].code,
    'route-direction-reversed');
  assert.deepEqual(evaluateTransitionInvariants(pop, lane(0, 0)).missing, ['T2:required-actor-unobserved']);
});

test('T3 detects same-frame source/proxy ink and requires actual proxy samples', () => {
  const input = request('launch', 'tts', readerTransitionLaunchNodes('source'));
  const source = actor('source');
  const proxy = actor(READER_LAUNCH_PROXY, { nativeId: 2 });
  const sharp = actor(READER_LAUNCH_SHARP);
  const contents = [actor(READER_LAUNCH_LEADING_ICON), actor(READER_LAUNCH_LEADING_LABEL), actor(READER_LAUNCH_PAUSE)];
  const accepted = evaluateTransitionInvariants(input, samples([source], [proxy, sharp], [proxy, ...contents]));
  assert.deepEqual(accepted.observedRules, ['T3']);
  assert.deepEqual(accepted.violations, []);
  assert.deepEqual(evaluateTransitionInvariants({ ...input, action: 'autoPage' }, samples([source], [source, proxy], [proxy]))
    .violations, [{ rule: 'T3', frame: 1, code: 'source-and-proxy-visible' }]);
  assert.deepEqual(evaluateTransitionInvariants(input, samples([source], [source])).missing, ['T3:required-actor-unobserved']);
  const unreadable = samples([proxy, sharp], [proxy, ...contents]);
  unreadable[0].unreadableIds.push('source');
  assert.deepEqual(evaluateTransitionInvariants(input, unreadable).missing, ['T3:native-frame-unreadable']);
  assert.deepEqual(evaluateTransitionInvariants(input, samples([proxy], [proxy, ...contents])).missing,
    ['T3:required-actor-unobserved']);
  assert.deepEqual(evaluateTransitionInvariants({ ...input, staticMotion: true },
    samples([proxy, ...contents], [proxy, ...contents])).missing, []);
});

test('T3 rejects highly visible sharp source content intersecting the leading ink or pause circle', () => {
  const sharp = actor(READER_LAUNCH_SHARP, { x: 32, y: 18, width: 26, height: 24, opacity: .82 });
  const icon = actor(READER_LAUNCH_LEADING_ICON, { x: 45, y: 21, width: 11, height: 11, opacity: .75 });
  const label = actor(READER_LAUNCH_LEADING_LABEL, { x: 52, y: 21, width: 36, height: 15, opacity: .75 });
  const pause = actor(READER_LAUNCH_PAUSE, { x: 40, y: 20, width: 16, height: 16, opacity: .84 });
  const proxy = actor(READER_LAUNCH_PROXY);
  for (const contender of [icon, label, pause]) {
    const input = request('launch', contender === pause ? 'autoPage' : 'tts', readerTransitionLaunchNodes('source'));
    assert.deepEqual(evaluateTransitionInvariants(input,
      samples([proxy, sharp], [proxy, sharp, contender], [proxy, contender])).violations,
      [{ rule: 'T3', frame: 1, code: 'sharp-and-capsule-content-overlap' }]);
  }
  const input = request('launch', 'tts', readerTransitionLaunchNodes('source'));
  const accepted = evaluateTransitionInvariants(input, samples(
    [proxy, sharp, { ...icon, opacity: .1 }, { ...label, x: 58 }, { ...pause, visible: false }],
    [proxy, icon, label, pause]));
  assert.deepEqual(accepted.violations, []);
  assert.deepEqual(accepted.observedRules, ['T3']);
});

test('T3 handoff witnesses the returning live card and permits the separate canonical capsule fade', () => {
  const input = { ...request('launch', 'autoPage', readerTransitionLaunchNodes('source')), launchHandoff: true };
  const live = actor('source', { y: 120 });
  const proxy = actor(READER_LAUNCH_PROXY, { y: 540 });
  const sourceShell = actor(READER_LAUNCH_SOURCE);
  const sharp = actor(READER_LAUNCH_SHARP);
  const pause = actor(READER_LAUNCH_PAUSE, { x: 40, y: 20, width: 16, height: 16 });
  const accepted = evaluateTransitionInvariants(input, samples([proxy], [proxy, live], [live]));
  assert.deepEqual(accepted.observedRules, ['T3']);
  assert.deepEqual(accepted.violations, []);
  assert.deepEqual(evaluateTransitionInvariants(input, samples([proxy], [proxy])).missing, ['T3:required-actor-unobserved']);
  assert.deepEqual(evaluateTransitionInvariants(input, samples([proxy], [proxy, live, sourceShell])).violations,
    [{ rule: 'T3', frame: 1, code: 'source-and-proxy-visible' }]);
  assert.deepEqual(evaluateTransitionInvariants(input, samples([proxy, sharp], [proxy, sharp, pause], [proxy, live])).violations,
    [{ rule: 'T3', frame: 1, code: 'sharp-and-capsule-content-overlap' }]);
});

test('T4 requires old-or-new live body and witnesses the requested chapter, with distinct chapter first lines', () => {
  const input = { ...request('chapter', 'advance', ['body', 'loading']), chapterBodyCount: 1, targetChapterIndex: 7 };
  const previous = actor('body', { bodyVisible: true, bodyAnchorId: 19, bodyAnchorY: 54, chapterIndex: 6 });
  const next = actor('body', { bodyVisible: true, bodyAnchorId: 21, bodyAnchorY: 82, chapterIndex: 7 });
  const accepted = evaluateTransitionInvariants(input, samples([previous], [next], [next]));
  assert.deepEqual(accepted.observedRules, ['T4']);
  assert.deepEqual(accepted.violations, []);
  assert.deepEqual(evaluateTransitionInvariants(input, samples([previous], [previous])).missing,
    ['T4:required-actor-unobserved']);
  assert.deepEqual(evaluateTransitionInvariants(input, samples([previous], [actor('body')])).missing,
    ['T4:required-actor-unobserved']);
});

test('T4 at deferred chapter submission must witness the retained origin before the requested chapter', () => {
  const input = { ...request('chapter', 'advance', ['body', 'loading']), chapterBodyCount: 1,
    originChapterIndex: 3, targetChapterIndex: 1 };
  const origin = actor('body', { bodyVisible: true, bodyAnchorId: 28, bodyAnchorY: 75, chapterIndex: 3 });
  const target = actor('body', { bodyVisible: true, bodyAnchorId: 41, bodyAnchorY: 75, chapterIndex: 1 });
  const unrelated = actor('body', { bodyVisible: true, bodyAnchorId: 39, bodyAnchorY: 75, chapterIndex: 2 });
  assert.deepEqual(evaluateTransitionInvariants(input, samples([origin], [target], [target])).observedRules, ['T4']);
  assert.deepEqual(evaluateTransitionInvariants(input, samples([origin], [origin], [origin])).missing,
    ['T4:required-actor-unobserved']);
  assert.deepEqual(evaluateTransitionInvariants(input, samples([target], [target], [target])).missing,
    ['T4:required-actor-unobserved']);
  assert.deepEqual(evaluateTransitionInvariants(input, samples([target], [origin])).missing,
    ['T4:required-actor-unobserved']);
  assert.deepEqual(evaluateTransitionInvariants(input, samples([unrelated], [target])).missing,
    ['T4:required-actor-unobserved']);
  assert.equal(evaluateTransitionInvariants(input, samples([origin, actor('loading')], [target]))
    .violations[0].code, 'cached-chapter-loading-visible');
});

test('T4 catches an admitted loading state, blank body, safe-top shift, and drift of the same paint anchor', () => {
  const input = { ...request('chapter', 'advance', ['body', 'loading']), chapterBodyCount: 1, targetChapterIndex: 7 };
  const previous = actor('body', { bodyVisible: true, bodyAnchorId: 19, bodyAnchorY: 54, chapterIndex: 6 });
  const next = actor('body', { bodyVisible: true, bodyAnchorId: 21, bodyAnchorY: 82, chapterIndex: 7 });
  assert.equal(evaluateTransitionInvariants(input, samples([previous], [previous, actor('loading')], [next]))
    .violations[0].code, 'cached-chapter-loading-visible');
  assert.equal(evaluateTransitionInvariants(input, samples([previous], [actor('body', { bodyVisible: false })], [next]))
    .violations[0].code, 'chapter-body-blank');
  assert.equal(evaluateTransitionInvariants(input, samples([previous], [{ ...next, y: 30 }], [next]))
    .violations[0].code, 'chapter-body-vertical-shift');
  assert.equal(evaluateTransitionInvariants(input, samples([previous], [next], [{ ...next, bodyAnchorY: 79 }]))
    .violations[0].code, 'chapter-first-line-vertical-shift');
});
