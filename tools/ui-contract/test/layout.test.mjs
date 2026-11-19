import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateLayout, layoutTapPoint, normalizeHarmonyLayout, selectLayoutNode } from '../lib/layout.mjs';
import { requestedOperation } from '../collectors/harmonyos/records.mjs';

const density = 3.5;
const windowId = '42';
const field = 'reader-bookshelf-search-field';
const submit = 'reader-bookshelf-search-submit';
const bar = 'reader-bookshelf-search-bar';
const back = 'reader-library-search-back';
const clip = 'reader-control-motion-content-clip';
const content = 'reader-control-content-host';
const title = 'Reader Phase 0 Public Fixture';
const bounds = (left, top, right, bottom) =>
  `[${Math.round((left + 10) * density)},${Math.round((top + 20) * density)}]` +
  `[${Math.round((right + 10) * density)},${Math.round((bottom + 20) * density)}]`;

function node(id, box, { children = [], ...attributes } = {}) {
  return {
    attributes: {
      id, origBounds: bounds(...box), bounds: bounds(...box), hostWindowId: windowId,
      visible: 'true', focused: 'false', enabled: 'true', opacity: '1.000000', clip: 'false',
      ...attributes,
    },
    children,
  };
}

function dump(nodes, other = []) {
  return {
    attributes: { bounds: '[0,0][600,900]' },
    children: [
      node('', [0, 0, 100, 200], {
        bundleName: 'io.reader.minliny', type: 'root', abilityName: 'EntryAbility', pagePath: 'pages/Index',
        children: nodes,
      }),
      ...other,
    ],
  };
}

function report({ rects = [], keyboardRevision = 8 } = {}) {
  return {
    windowId, vpPixels: density,
    metrics: {
      ready: true, revision: 8, densityPixels: density,
      windowRect: { left: 0, top: 0, width: 100, height: 200 },
      globalRect: { left: 10, top: 20, width: 100, height: 200 },
      keyboardArea: { available: true, visible: rects.length > 0, rects, revision: keyboardRevision },
      keyboardInsets: { left: 0, top: 0, right: 0, bottom: 0 },
    },
  };
}

function sample(tree, extras = {}) {
  return normalizeHarmonyLayout({
    tree, report: report(), sampleId: 'stable', instanceId: 'instance-2',
    evidenceRefs: ['tree', 'window'], ...extras,
  });
}

function search(headerTop = 20, fieldOffset = 0) {
  return node(bar, [0, headerTop, 100, headerTop + 20], {
    accessibilityId: '1',
    children: [
      node(back, [0, headerTop, 10, headerTop + 20]),
      node('reader-bookshelf-search-lane-row', [10, headerTop, 90, headerTop + 20], {
        children: [
          node(field, [10 + fieldOffset, headerTop, 50 + fieldOffset, headerTop + 20], {
            accessibilityId: '2',
          }),
          node(submit, [55, headerTop, 90, headerTop + 20], { clickable: 'true', accessibilityId: '3' }),
        ],
      }),
    ],
  });
}

function reading({ clipEnabled = true, overrun = false, hideOverrun = true } = {}) {
  const childRight = overrun ? 70 : 60;
  const childVisibleRight = hideOverrun ? 60 : childRight;
  return node(clip, [20, 100, 60, 150], {
    clip: String(clipEnabled),
    children: [node(content, [30, 110, childRight, 140], { bounds: bounds(30, 110, childVisibleRight, 140) })],
  });
}

function check(assertion, current, baseline) {
  return evaluateLayout({ sample: 'current', ...assertion }, new Map([['current', current], ['baseline', baseline]]));
}

test('scopes a Reader node to the normal window and rejects within-window ambiguity', () => {
  const external = node(field, [0, 0, 10, 10], { hostWindowId: '9', bundleName: 'com.ohos.sceneboard' });
  const searchTree = sample(dump([search()], [external, external]));
  const selected = selectLayoutNode(searchTree, { id: field, ancestors: [bar] });
  assert.equal(selected.key, '2');
  assert.deepEqual(layoutTapPoint(selectLayoutNode(searchTree, submit)), { x: 289, y: 175 });
  assert.equal(searchTree.branch, 'row');
  assert.throws(() => selectLayoutNode(sample(dump([search(), search()])), field), /ambiguous/);
  assert.throws(() => sample(dump([search()]), { windowId: '999' }), /IDs disagree/);
});

test('replays row gap, center alignment and non-overlap with one px-to-vp conversion', () => {
  const current = sample(dump([search()]));
  const gap = check({ kind: 'gap', a: field, b: submit, axis: 'x', branch: 'row', expected: 5, tolerancePx: 1 }, current);
  assert.equal(gap.verdict, 'PASS');
  assert.ok(Math.abs(gap.actual.valueVp - 18 / density) < 1e-10);
  assert.deepEqual(gap.evidenceRefs, ['tree', 'window']);
  assert.equal(check({ kind: 'gap', a: field, b: submit, axis: 'x', expected: 10, tolerancePx: 1 }, current).verdict, 'FAIL');
  assert.equal(check({ kind: 'align', a: field, b: submit, axis: 'y', expected: 0 }, current).verdict, 'PASS');
  assert.equal(check({ kind: 'nonOverlap', a: field, b: back, expected: { maxOverlapAreaVp2: 0 } }, current).actual.overlapAreaVp2, 0);
  assert.equal(check({ kind: 'gap', a: field, b: submit, axis: 'x', branch: 'stacked', expected: 5 }, current).verdict, 'NOT_RUN');
});

test('admits only the search action from the submit button native description', () => {
  const step = {id:'submit-search', op:'click', target:submit, from:'ready'};
  const ready = description => sample(dump([node(submit, [10, 20, 50, 40], {clickable:'true', description})]));
  assert.deepEqual(requestedOperation(step, {ready:ready('搜索')}), {op:'click', x:140, y:175});
  assert.throws(() => requestedOperation(step, {ready:ready('停止搜索')}), /no enabled search semantics/);
  const unrecognized = ready('private button description');
  assert.throws(() => requestedOperation(step, {ready:unrecognized}), /no enabled search semantics/);
  assert.doesNotMatch(JSON.stringify(unrecognized), /private button description/);
});

test('reads an enabled search button’s direct native text child without accepting a stop action', () => {
  const step = {id:'submit-search', op:'click', target:submit, from:'ready'};
  const ready = (label, attributes = {}, childAttrs = {}) => sample(dump([node(submit, [10, 20, 50, 40], {
    clickable:'true', ...attributes,
    children:[node('', [20, 25, 40, 36], {type:'Text', originalText:label, ...childAttrs})],
  })]));
  assert.deepEqual(requestedOperation(step, {ready:ready('搜索')}), {op:'click', x:140, y:175});
  assert.throws(() => requestedOperation(step, {ready:ready('停止搜索')}), /no enabled search semantics/);
  assert.throws(() => requestedOperation(step, {ready:ready('搜索', {enabled:'false'})}), /no admitted native tap point/);
  assert.throws(() => requestedOperation(step, {ready:ready('搜索', {}, {hostWindowId:'other'})}), /no enabled search semantics/);
  assert.throws(() => requestedOperation(step, {ready:ready('搜索', {description:'停止搜索'})}), /no enabled search semantics/);
});

test('measures ancestor containment and distinguishes clipping configuration and effect', () => {
  const assertion = { a: content, b: clip };
  const config = { ...assertion, kind: 'clip', mode: 'configuration', expected: { enabled: true } };
  const effect = { ...assertion, kind: 'clip', mode: 'effect', expected: { minClippedAreaVp2: 0 }, tolerancePx: 1 };
  const contain = { ...assertion, kind: 'contain', expected: { maxOverflowVp: 0 } };
  const stable = sample(dump([reading()]), { transitionId: 'open-3' });
  const overrun = sample(dump([reading({ overrun: true })]), { transitionId: 'open-3' });
  assert.equal(check(contain, stable).verdict, 'PASS');
  assert.equal(check(contain, overrun).actual.overflowVp.right, 10);
  assert.equal(check(contain, overrun).verdict, 'FAIL');
  assert.equal(check(config, stable).verdict, 'PASS');
  assert.equal(check({ ...config, expected: { enabled: true, shape: 'roundedRect' } }, stable).verdict, 'NOT_RUN');
  assert.equal(check(effect, stable).verdict, 'NOT_RUN');
  assert.equal(check(effect, overrun).verdict, 'PASS');
  assert.equal(check(effect, overrun).actual.clippedAreaVp2, 300);
  assert.equal(check(effect, { ...overrun, transitionId: undefined }).verdict, 'NOT_RUN');
  const uncut = sample(dump([reading({ clipEnabled: false, overrun: true, hideOverrun: false })]),
    { transitionId: 'open-3' });
  assert.equal(check(config, uncut).verdict, 'FAIL');
  assert.equal(check(effect, uncut).verdict, 'FAIL');
});

test('separates window clipping, opacity and zero area, and uses exact measured round-rect geometry', () => {
  const off = 'reader-offscreen';
  const zero = 'reader-zero';
  const ring = 'reader-round-clip';
  const probe = 'reader-round-probe';
  const current = sample(dump([
    node(off, [0, 210, 15, 230]),
    node(zero, [0, 20, 0, 20]),
    node(ring, [10, 20, 20, 30], { clip: 'true', children: [node(probe, [10, 20, 20, 30])] }),
  ]), { clipShapes: [{ id: ring, shape: 'roundedRect', radiusVp: 2, source: 'debug-frame' }] });
  const visibility = { kind: 'visibleFraction', basis: 'rectangular', expected: { minFraction: 1 } };
  const offscreen = check({ ...visibility, a: off }, current);
  assert.equal(offscreen.actual.opacity, 1);
  assert.equal(offscreen.actual.fraction, 0);
  assert.equal(offscreen.verdict, 'FAIL');
  assert.equal(check({ ...visibility, a: zero }, current).verdict, 'NOT_RUN');
  assert.equal(check({ ...visibility, a: probe }, current).actual.fraction, 1);
  const rounded = check({ ...visibility, a: probe, basis: 'rounded' }, current);
  assert.equal(rounded.verdict, 'FAIL');
  assert.ok(Math.abs(rounded.actual.visibleAreaVp2 - (100 - 16 + 4 * Math.PI)) < 1e-10);
  assert.equal(check({ ...visibility, a: probe, basis: 'rounded', acceptedSources: ['native-tree'] }, current).verdict, 'NOT_RUN');
});

test('constrains visible fraction by native node and window readback bounds', () => {
  const box = [0, 20, 20, 40];
  const tree = dump([node(submit, box, {bounds: bounds(0, 20, 10, 40)})]);
  const visibility = { kind:'visibleFraction', basis:'rectangular', a:submit, expected:{minFraction:1} };
  const measured = check(visibility, sample(tree));
  assert.equal(measured.verdict, 'FAIL');
  assert.equal(measured.actual.fraction, 0.5);
  assert.equal(measured.actual.sourceAreaVp2, 400);
  assert.deepEqual(measured.actual.visibleReadbackVp, {left:0, top:20, width:10, height:20});

  const partialWindow = dump([node(submit, box)]);
  partialWindow.children[0].attributes.bounds = bounds(0, 30, 100, 200);
  assert.equal(check(visibility, sample(partialWindow)).actual.fraction, 0.5);

  const missing = check(visibility, sample(dump([node(submit, box, {bounds: ''})])));
  assert.equal(missing.verdict, 'NOT_RUN');
  assert.match(missing.reason, /Native visible bounds are unavailable/);
});

test('uses window-local IME geometry for floating and bottom-docked keyboards and rejects old IME revisions', () => {
  const float = { left: 55, top: 10, width: 12, height: 20 };
  const dock = { left: 0, top: 180, width: 100, height: 20 };
  const current = sample(dump([search()]), { report: report({ rects: [float, float, dock] }) });
  const assertion = { kind: 'keyboardAvoidance', a: field, expected: { maxOverlapAreaVp2: 0 } };
  const fieldClear = check(assertion, current);
  assert.equal(fieldClear.verdict, 'PASS');
  assert.equal(fieldClear.actual.bottomGapVp, 140);
  const button = check({ ...assertion, a: submit }, current);
  assert.equal(button.verdict, 'FAIL');
  assert.ok(button.actual.overlapAreaVp2 > 117 && button.actual.overlapAreaVp2 <= 120);
  const visibility = check({ kind: 'visibleFraction', a: submit, basis: 'rectangular',
    expected: { minFraction: 1 }, includeKeyboard: true }, current);
  assert.equal(visibility.verdict, 'FAIL');
  assert.equal(check(assertion, sample(dump([search()]), {
    report: report({ rects: [float], keyboardRevision: 7 }),
  })).verdict, 'NOT_RUN');
});

test('compares node displacement relative to the same anchor with verified continuity', () => {
  const comparison = { kind: 'relativeDelta', a: field, anchor: bar, baseline: 'baseline', expected: { dx: 0, dy: 0 }, tolerancePx: 1 };
  const before = sample(dump([search(20)]), { continuityId: 'search-2' });
  const after = sample(dump([search(50)]), { continuityId: 'search-2' });
  assert.equal(check(comparison, after, before).actual.dy, 0);
  assert.equal(check(comparison, after, before).verdict, 'PASS');
  const moved = pixels => ({ ...after, nodes: after.nodes.map(item => item.id === field ?
    {...item, rectPx:{...item.rectPx, left:item.rectPx.left + pixels}} : item) });
  const atTolerance = check(comparison, moved(1), before);
  assert.equal(atTolerance.actual.dx, 1 / density);
  assert.equal(atTolerance.verdict, 'PASS');
  assert.equal(check(comparison, moved(2), before).verdict, 'FAIL');
  assert.equal(check(comparison, sample(dump([search(50, 3)])), before).verdict, 'FAIL');
  assert.equal(check(comparison, { ...after, instanceId: 'different' }, before).verdict, 'NOT_RUN');
  const newMount = { ...after, nodes: after.nodes.map(item => item.id === field ? { ...item, key: '40' } : item) };
  assert.equal(check(comparison, newMount, before).verdict, 'NOT_RUN');
  assert.equal(check({ ...comparison, sameContinuity: true }, newMount, before).verdict, 'PASS');
});

test('selects a unique local public fixture card and excludes arbitrary text and book IDs', () => {
  const publicLeaf = node('', [10, 18, 30, 23], { text: title });
  const card = (sourceId, bookId) => node(`reader-shelf-book-action:[1,"${sourceId}","${bookId}",false]`, [10, 10, 60, 60], {
    clickable: 'true',
    description: `${title}，private author，0%`,
    children: [publicLeaf, publicLeaf, node('', [11, 10, 12, 12], { text: 'private leaf' })],
  });
  const online = card('remote', 'private remote identifier');
  const local = card('local', 'private local identifier');
  const current = sample(dump([online, local]), { publicBookTitle: title });
  const book = selectLayoutNode(current, { publicBookTitle: title });
  assert.equal(book.localBookAction, true);
  assert.equal(book.path, '0/1');
  assert.deepEqual(layoutTapPoint(book), { x: 157, y: 192 });
  assert.doesNotMatch(JSON.stringify(current), /private/);
  assert.throws(() => selectLayoutNode(sample(dump([online]), { publicBookTitle: title }), { publicBookTitle: title }), /missing/);
  assert.throws(() => selectLayoutNode(sample(dump([local, local]), { publicBookTitle: title }), { publicBookTitle: title }), /ambiguous/);
});
