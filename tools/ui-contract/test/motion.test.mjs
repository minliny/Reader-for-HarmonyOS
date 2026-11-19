import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadCase } from '../lib/cases.mjs';
import { evaluateMotion } from '../lib/motion.mjs';

const contract = loadCase('reading.control-open-motion');
const byKind = new Map(contract.assertions.map(assertion => [assertion.kind, assertion]));
const instanceId = 'phase0-test-instance';
const readingId = 'reading-1';
const readyHost = 'reader-reading-interaction-host-paged';
const readingStage = 'reader-reading-stage';
const fixtureTitle = contract.fixture.bookTitle;
const matrixIdentity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const boxPx = { left: 0, top: 0, width: 600, height: 900 };
const measuredSizeVp = { x: 0, y: 0, width: 100, height: 50 };

const payloadBefore = { epoch: 0, openRevision: 0, closeRevision: 0, level: 'hidden',
  targetLevel: 'hidden', transition: '', heldPointerId: -1 };

function node(id, extras = {}) {
  return { id, source: 'native-tree', path: '0/0', visible: true, enabled: true, opacity: 1,
    clickable: true, rectPx: boxPx, visibleRectPx: boxPx, ...extras };
}

function sample(sampleId, seq, time, nodes) {
  return { sampleId, instanceId, beforeSeq: seq, afterSeq: seq + 1, hostBeginMs: time, hostEndMs: time + 5,
    nodes, window: { id: 'reader-window', revision: 17, keyboard: { visible: false, revision: 17 } } };
}

function action(actionId, op, beforeSeq, afterSeq, time, targetId) {
  return { actionId, instanceId, op, beforeSeq, afterSeq, hostBeginMs: time,
    hostEndMs: time + 100, targetId };
}

function record(kind, channel, eventSeq, payload, deviceMonoMs) {
  return { instanceId, kind, channel, eventSeq, deviceMonoMs, payload };
}

function frame(direction, index, epoch, startMs) {
  const opening = direction === 'open';
  const durationMs = opening ? 220 : 200;
  const progress = [0, 0.877833605, 1][index];
  const v = opening ? progress : 1 - progress;
  const dockY = 18 * (1 - v);
  const root = { uniqueId: 100, clipToFrame: true, measuredSizeVp };
  const dock = { uniqueId: 110, parentUniqueId: 100, clipToFrame: false, zIndex: 0 };
  const clip = { uniqueId: 120, parentUniqueId: 110, clipToFrame: true, zIndex: 0,
    borderRadiusVp: 8, measuredSizeVp };
  const actors = [
    ['reader-control-motion-shell', 130, 0, [dock, root], 100, 50, 0, 1],
    ['reader-control-motion-grabber', 140, 3, [dock, root], 72, 28, 0, 1],
    ['reader-control-motion-dock', 110, 0, [root], 100, 70, dockY, v],
    ['reader-control-content-host', 150, 0, [clip, dock, root], 100, 50, 0, 1],
  ].map(([id, uniqueId, zIndex, ancestors, width, height, translateY, opacity]) => ({
    id, uniqueId, mounted: true, opacity, zIndex, ancestors, ancestorChainComplete: true,
    parentUniqueId: ancestors[0].uniqueId, inspectorSource: 'FrameNode.getInspectorInfo', clipToFrame: false,
    layoutRectVp: { x: 100, y: 500, width, height },
    windowOriginVp: { x: 100, y: 500 + dockY },
    translateVp: { x: 0, y: translateY, z: 0 },
    scale: { x: 1, y: 1, z: 1, centerX: width / 2, centerY: height / 2 },
    rotation: { x: 0, y: 0, z: 0, angle: 0, centerX: width / 2, centerY: height / 2 },
    matrix: [...matrixIdentity],
  }));
  const elapsedMs = durationMs * index / 2;
  return {
    index, phase: ['start', 'progress', 'endpoint'][index],
    frameTimeNs: (startMs + elapsedMs) * 1e6, captureStartMs: startMs + elapsedMs,
    captureEndMs: startMs + elapsedMs + 1,
    observationPhase: index === 2 ? 'after-endpoint-publication' : 'before-runtime-publication',
    runtimeElapsedMs: elapsedMs, runtimeDurationMs: durationMs,
    runtimeTickMs: startMs + durationMs * Math.min(index, 1) / 2,
    runtimeElapsedSource: index === 2 ? 'runtime-tick-delta' : 'runtime-transition',
    runtimeEpoch: epoch, runtimeTicket: epoch,
    visibilityProgress: v, expansionProgress: 0, runtimeLayoutOffsetVp: 0, density: 3.5,
    content: { level: 'home', module: 'directory', directoryTab: 'directory', form: 'quick' },
    actors, contentClip: { id: 'reader-control-motion-content-clip', uniqueId: clip.uniqueId },
  };
}

function transition(direction, firstSeq, before, startMs) {
  const opening = direction === 'open';
  const transitionId = `${direction}-${firstSeq}`;
  const durationMs = opening ? 220 : 200;
  const endpoint = opening ? 'home' : 'hidden';
  const epoch = before.epoch + 1;
  const identity = { readingId, transitionId, direction };
  const accepted = { ...before, epoch, openRevision: before.openRevision + Number(opening),
    targetLevel: endpoint, transition: direction };
  const committed = { ...accepted, level: endpoint, transition: '', closeRevision: before.closeRevision + Number(!opening) };
  const records = [
    record('reading.control-requested', 'business', firstSeq,
      { ...identity, origin: opening ? 'paged-tap' : 'system-back', before, accepted, durationMs }, startMs - 1),
    record('reading.control-visual', 'motion', firstSeq + 1,
      { ...identity, epoch, source: 'runtime-progress', visibilityProgress: 0.5 }, startMs + durationMs / 2),
    record('reading.control-committed', 'business', firstSeq + 2,
      { ...identity, state: committed }, startMs + durationMs),
    ...[0, 1, 2].map(index => record('reading.control-motion', 'motion', firstSeq + 3 + index,
      { ...identity, epoch, blockIndex: index, blockCount: 3, frameStart: index, frameEnd: index,
        endReason: 'completed', droppedSamples: 0, frames: [frame(direction, index, epoch, startMs)] },
      startMs + durationMs + index + 2)),
  ];
  return { records, committed };
}

function fixture() {
  const opened = transition('open', 11, { ...payloadBefore }, 1000);
  const dismissed = transition('dismiss', 21, opened.committed, 2000);
  const sourceHash = '1'.repeat(64);
  const ownerSources = Object.fromEntries(contract.ownerSources.map(path => [path, { path: `sources/${path}`, sha256: sourceHash }]));
  return {
    samples: {
      'reading-book-entry': { ...sample('reading-book-entry', 1, 2,
        [node(null, { localBookAction: true, fixtureCard: true })]), publicBookTitle: fixtureTitle },
      'reading-before': sample('reading-before', 7, 120, [node(readingStage), node(readyHost)]),
      'control-open': sample('control-open', 18, 243, [node(readingStage), node('reader-control-motion-dock')]),
      'control-closed': sample('control-closed', 28, 370, [node(readingStage), node(readyHost)]),
    },
    actions: {
      'enter-reading': action('enter-reading', 'click', 3, 6, 8),
      open: action('open', 'click', 10, 16, 130, readyHost),
      dismiss: action('dismiss', 'keyEvent', 20, 26, 255),
    },
    events: [record('reading.ready', 'business', 4, { readingId, interactionHostId: readyHost, mode: 'paged',
      localBook: true, reduceMotion: false, state: { ...payloadBefore } }, 30),
    ...opened.records, ...dismissed.records],
    candidate: { ownerSources },
  };
}

const evaluate = (kind, data) => evaluateMotion(byKind.get(kind), data);
const openFrames = data => data.events.filter(event => event.kind === 'reading.control-motion' && event.payload.direction === 'open');
const part = (data, index, role) => openFrames(data)[index].payload.frames[0].actors.find(actor => actor.id === role);

test('recomputes both complete owner transitions and animated trajectories independently', () => {
  const data = fixture();
  for (const kind of ['control-open', 'control-dismiss', 'motion-open', 'motion-dismiss']) {
    const result = evaluate(kind, data);
    assert.equal(result.verdict, 'PASS', result.reason);
  }
  assert.equal(evaluate('control-open', data).actual.open, true);
  assert.equal(evaluate('control-dismiss', data).actual.hidden, true);
  assert.equal(evaluate('motion-open', data).actual.firstMount.grabber, 0);
  assert.equal(evaluate('motion-open', data).actual.frameCount, 3);
});

test('rejects a truncated or repeated frame block before classifying a numeric deviation', () => {
  const data = fixture();
  const frames = openFrames(data);
  for (const event of frames) {
    event.payload.endReason = 'error';
    event.payload.droppedSamples = 16;
    event.payload.frames[0].frameTimeNs = (1000 + event.payload.blockIndex * 16) * 1e6;
  }
  assert.equal(evaluate('motion-open', data).verdict, 'NOT_RUN');
  assert.equal(evaluate('motion-dismiss', data).verdict, 'PASS');
  const other = fixture();
  openFrames(other)[1].payload.blockIndex = 0;
  assert.equal(evaluate('motion-open', other).verdict, 'NOT_RUN');
});

test('does not convert already-vp translation again and reports the first mid-trace matrix violation', () => {
  const units = fixture();
  part(units, 0, 'reader-control-motion-dock').translateVp.y /= 3.5;
  const doubleConvert = evaluate('motion-open', units);
  assert.equal(doubleConvert.verdict, 'FAIL');
  assert.ok(doubleConvert.actual.deviations.some(item => item.actor === 'dock' && item.field === 'translateVp' && item.frame === 0));

  const matrix = fixture();
  part(matrix, 1, 'reader-control-motion-shell').matrix[1] = -0.3;
  const midFrame = evaluate('motion-open', matrix);
  assert.equal(midFrame.verdict, 'FAIL');
  assert.equal(midFrame.observationsComplete, true);
  assert.ok(midFrame.actual.deviations.some(item => item.actor === 'shell' && item.field === 'matrix' && item.frame === 1));
  assert.equal(evaluate('motion-dismiss', matrix).verdict, 'PASS');
});

test('rejects a common window-space hop with correct local transforms in either direction', () => {
  for (const direction of ['open', 'dismiss']) {
    const data = fixture();
    const frame = data.events.find(event => event.kind === 'reading.control-motion' &&
      event.payload.direction === direction && event.payload.blockIndex === 1).payload.frames[0];
    for (const actor of frame.actors) {
      actor.layoutRectVp.y += 64;
      actor.windowOriginVp.y += 64;
    }
    const result = evaluate(`motion-${direction}`, data);
    assert.equal(result.verdict, 'FAIL');
    assert.deepEqual(result.actual.deviations.map(({actor, field, frame}) => ({actor, field, frame})), [
      {actor:'dock', field:'anchoredWindowPathVp', frame:1},
    ]);
  }
});

test('reports the affected actor and frame when a real z observation is missing', () => {
  const data = fixture();
  delete part(data, 1, 'reader-control-motion-grabber').zIndex;
  const result = evaluate('motion-open', data);
  assert.equal(result.verdict, 'NOT_RUN');
  assert.equal(result.observationsComplete, false);
  assert.ok(result.actual.missing.some(item =>
    item.actor === 'grabber' && item.field === 'stackingContext' && item.frame === 1));
  assert.equal(evaluate('control-open', data).verdict, 'PASS');
});

test('preserves a measured deviation alongside incomplete required motion observations', () => {
  const data = fixture();
  delete part(data, 1, 'reader-control-motion-grabber').zIndex;
  part(data, 1, 'reader-control-motion-shell').matrix[1] = -0.3;
  const result = evaluate('motion-open', data);
  assert.equal(result.verdict, 'FAIL');
  assert.equal(result.observationsComplete, false);
  assert.ok(result.actual.missing.some(item => item.actor === 'grabber' && item.field === 'stackingContext'));
  assert.ok(result.actual.deviations.some(item => item.actor === 'shell' && item.field === 'matrix'));
});

test('cannot accept an old request, wrong epoch or an owner omitted from deployed provenance', () => {
  const stale = fixture();
  stale.events.find(event => event.kind === 'reading.control-committed').payload.transitionId = 'old-open';
  assert.equal(evaluate('control-open', stale).verdict, 'NOT_RUN');
  assert.equal(evaluate('motion-open', stale).verdict, 'NOT_RUN');

  const wrongEpoch = fixture();
  wrongEpoch.events.find(event => event.kind === 'reading.control-requested').payload.accepted.epoch += 1;
  assert.equal(evaluate('control-open', wrongEpoch).verdict, 'NOT_RUN');

  const omitted = fixture();
  delete omitted.candidate.ownerSources[contract.ownerSources[0]];
  assert.match(evaluate('control-open', omitted).reason, /owner source SHA-256/u);
});

test('accepts an explicitly unmounted first open frame and requires all four roles after mounting', () => {
  const data = fixture();
  const first = openFrames(data)[0].payload.frames[0];
  first.actors = first.actors.map(actor => ({ id: actor.id, mounted: false }));
  assert.equal(evaluate('motion-open', data).verdict, 'PASS');
  assert.equal(evaluate('motion-open', data).actual.firstMount.dock, 1);
  part(data, 1, 'reader-control-motion-grabber').mounted = false;
  assert.equal(evaluate('motion-open', data).verdict, 'NOT_RUN');
});
