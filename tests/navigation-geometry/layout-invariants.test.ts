import assert from 'node:assert/strict';
import { test } from 'node:test';
import { evaluateLayoutInvariants } from '../../entry/src/main/ets/ui/layout/LayoutInvariantEvaluator.ts';
import type { LayoutInvariantNode, LayoutInvariantSample } from '../../entry/src/main/ets/ui/layout/LayoutInvariantEvaluator.ts';

const header: LayoutInvariantNode = {
  tag: { role: 'floating-header', id: 'header', expectedHeightVp: 52, expectedTopGapVp: 8, scope: 'shelf' },
  bounds: { x: 12, y: 32, width: 360, height: 52 }, opacity: 1,
};
const title: LayoutInvariantNode = {
  tag: { role: 'header-content', id: 'title' }, headerId: 'header',
  bounds: { x: 64, y: 44, width: 256, height: 28 }, opacity: 1,
};
const body: LayoutInvariantNode = {
  tag: { role: 'scroll-content', id: 'first', scope: 'shelf', expectedContentGapVp: 8 },
  bounds: { x: 16, y: 92, width: 352, height: 36 }, opacity: 1,
};
const action: LayoutInvariantNode = {
  tag: { role: 'key-control', id: 'more' },
  bounds: { x: 326, y: 36, width: 44, height: 44 }, opacity: 1, enabled: true,
};
const sample: LayoutInvariantSample = {
  safeTopVp: 24, fontScale: 1, nodes: [header, title, body, action], scanComplete: true,
  requiresHeader: true, requiresControl: true, requiresFirstContent: true, modalOpen: false,
  recoveryPending: false, checkRecovery: false, mainInputEnabled: true,
};

test('a measured clear sample includes each applicable rule', () => {
  const result = evaluateLayoutInvariants(sample);
  assert.deepEqual(result.violations, []);
  assert.deepEqual(result.missing, []);
  assert.deepEqual(result.observedRules, ['R1', 'R2', 'R3', 'R4', 'R5']);
});

test('detects a covered top, double inset, oversized bar, overflow, and excessive first gap', () => {
  const above = { ...header, bounds: { ...header.bounds!, y: 21 } };
  assert.ok(evaluateLayoutInvariants({ ...sample, nodes: [above, title, body, action] }).violations.some(v => v.rule === 'R1'));
  const below = { ...header, bounds: { ...header.bounds!, y: 54, height: 62 } };
  const overflow = { ...title, bounds: { ...title.bounds!, y: 42 } };
  const distant = { ...body, bounds: { ...body.bounds!, y: 152 } };
  const rules = evaluateLayoutInvariants({ ...sample, nodes: [below, overflow, distant, action] }).violations;
  assert.deepEqual(rules.map(v => v.rule), ['R2', 'R3', 'R4', 'R4']);
  assert.ok(!evaluateLayoutInvariants({ ...sample, fontScale: 1.6, nodes: [below, overflow, distant, action] })
    .violations.some(v => v.rule === 'R3'));
});

test('checks a key control and admits documented busy or unavailable states', () => {
  const disabled = { ...action, opacity: 0.4, enabled: false };
  assert.ok(evaluateLayoutInvariants({ ...sample, nodes: [header, title, body, disabled] }).violations.some(v => v.rule === 'R5'));
  for (const tag of [{ ...action.tag, busy: true }, { ...action.tag, unavailable: true }]) {
    assert.deepEqual(evaluateLayoutInvariants({ ...sample, nodes: [header, title, body, { ...disabled, tag }] }).violations, []);
  }
  const clipped = { ...action, bounds: { ...action.bounds!, width: 40 }, clipped: true };
  assert.ok(evaluateLayoutInvariants({ ...sample, nodes: [header, title, body, clipped] }).violations.some(v => v.rule === 'R5'));
});

test('a wrapping header reserves its measured rows plus its authored inter-row gap', () => {
  const wrappedHeader: LayoutInvariantNode = {
    tag: { role: 'fixed-header', id: 'rss', expectedHeightVp: 58, expectedTopGapVp: 0, wrapGapVp: 8 },
    bounds: { x: 0, y: 39, width: 366, height: 93.1 }, opacity: 1,
  };
  const leading: LayoutInvariantNode = {
    tag: { role: 'header-content', id: 'rss-title', wrapPart: 'leading' }, headerId: 'rss',
    bounds: { x: 20, y: 39, width: 55, height: 41 }, opacity: 1,
  };
  const trailing: LayoutInvariantNode = {
    tag: { role: 'header-content', id: 'rss-actions', wrapPart: 'trailing' }, headerId: 'rss',
    bounds: { x: 20, y: 88, width: 326, height: 44 }, opacity: 1,
  };
  const rssSample = { ...sample, safeTopVp: 39, requiresFirstContent: false, requiresControl: false };
  const result = evaluateLayoutInvariants({ ...rssSample, nodes: [wrappedHeader, leading, trailing] });
  assert.deepEqual(result.violations, []);
  assert.ok(result.observedRules.includes('R3'));
  const enlarged = { ...wrappedHeader, bounds: { ...wrappedHeader.bounds!, height: 107 } };
  assert.deepEqual(evaluateLayoutInvariants({ ...rssSample, nodes: [enlarged, leading, trailing] })
    .violations.map(v => v.rule), ['R3']);
  assert.deepEqual(evaluateLayoutInvariants({ ...rssSample, nodes: [wrappedHeader, leading] }).missing,
    ['header-wrap-children:rss']);
});

test('waits for modal recovery then checks the original route and any retained input blocker', () => {
  const blocked = { ...sample, mainInputEnabled: false, checkRecovery: true };
  assert.equal(evaluateLayoutInvariants({ ...blocked, recoveryPending: true }).violations.length, 0);
  assert.deepEqual(evaluateLayoutInvariants(blocked).violations.map(v => v.rule), ['R6']);
  const retained: LayoutInvariantNode = {
    tag: { role: 'modal-overlay', id: 'sheet', active: false }, intercepts: true, opacity: 0,
  };
  assert.deepEqual(evaluateLayoutInvariants({ ...sample, nodes: [...sample.nodes, retained], checkRecovery: true })
    .violations.map(v => v.rule), ['R6']);
  const recovered = evaluateLayoutInvariants({ ...sample, checkRecovery: true });
  assert.ok(recovered.observedRules.includes('R6'));
  assert.deepEqual(recovered.violations, []);
});

test('an active drawer requires its foreground control and still checks visible underlying geometry', () => {
  const drawer: LayoutInvariantNode = {
    tag: { role: 'modal-overlay', id: 'source-drawer', active: true, expectsModalControl: true }, opacity: 1,
  };
  const close: LayoutInvariantNode = { ...action, tag: { role: 'key-control', id: 'source-close', modalControl: true } };
  const covered = { ...sample, modalOpen: true, nodes: [drawer] };
  assert.deepEqual(evaluateLayoutInvariants(covered).missing, ['modal-control']);
  const measured = evaluateLayoutInvariants({ ...covered, nodes: [drawer, close] });
  assert.deepEqual(measured.missing, []);
  assert.deepEqual(measured.observedRules, ['R5']);
  const unsafeHeader = { ...header, bounds: { ...header.bounds!, y: 19 } };
  assert.deepEqual(evaluateLayoutInvariants({ ...covered, nodes: [drawer, { ...close, enabled: false }, unsafeHeader] })
    .violations.map(v => v.rule), ['R1', 'R5']);
});

test('reading recovery requires the native input host to agree with application admission', () => {
  const reading = { ...sample, checkRecovery: true, requiresNativeMainInput: true };
  assert.deepEqual(evaluateLayoutInvariants(reading).missing, ['recovered-input']);
  const nativeHost: LayoutInvariantNode = { tag: { role: 'main-input', id: 'reader-body' }, opacity: 1, enabled: false };
  assert.deepEqual(evaluateLayoutInvariants({ ...reading, nodes: [...reading.nodes, nativeHost] })
    .violations.map(v => v.detail), ['native input host is still disabled']);
  const restored = evaluateLayoutInvariants({ ...reading, nodes: [...reading.nodes, { ...nativeHost, enabled: true }] });
  assert.deepEqual(restored.missing, []);
  assert.deepEqual(restored.violations, []);
  assert.ok(restored.observedRules.includes('R6'));
});

test('absent data and a truncated scan stay incomplete with zero violations', () => {
  const result = evaluateLayoutInvariants({ ...sample, safeTopVp: undefined, nodes: [], scanComplete: false });
  assert.deepEqual(result.violations, []);
  assert.deepEqual(result.missing, ['frame-scan', 'window-metrics', 'header', 'first-content', 'key-control']);
  assert.deepEqual(result.observedRules, []);
});
