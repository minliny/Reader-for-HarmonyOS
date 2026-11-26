import assert from 'node:assert/strict';
import { test } from 'node:test';
import { evaluateLayoutInvariants, type LayoutInvariantRect } from '../../entry/src/main/ets/ui/layout/LayoutInvariantEvaluator.ts';
import type { LayoutInvariantNativeNode, LayoutInvariantNativeSample, LayoutInvariantSurfaceAudit }
  from '../../entry/src/main/ets/ui/layout/LayoutInvariantNativeAudit.ts';

const rect = (x: number, y: number, width: number, height: number): LayoutInvariantRect => ({ x, y, width, height });
const viewport = rect(0, 0, 320, 600);
const safeViewport = rect(8, 30, 300, 542);

function leaf(type: string, id: string, bounds: LayoutInvariantRect, overrides: Partial<LayoutInvariantNativeNode> = {}): LayoutInvariantNativeNode {
  return { key: id, id, type, bounds, parentKey: 'container', parentType: 'Column', parentBounds: safeViewport,
    scrollClip: false, opacity: 1, interactive: type === 'Button', enabled: true, hitTest: 'default', ...overrides };
}

function panel(overrides: Partial<LayoutInvariantSurfaceAudit> = {}): LayoutInvariantSurfaceAudit {
  return { id: 'popup', bounds: rect(35, 140, 180, 150), anchor: rect(40, 90, 120, 44),
    placement: 'anchor', close: 'visible', contentBounds: rect(45, 185, 160, 70), contentViewport: rect(45, 180, 160, 100),
    naturalHeight: 120, ...overrides };
}

function gate(overrides: Partial<LayoutInvariantNativeSample> = {}) {
  const native = { viewport, safeViewport, nodes: [leaf('Text', 'title', rect(50, 50, 120, 22)),
    leaf('Image', 'cover-icon', rect(60, 80, 16, 16)), leaf('Button', 'done', rect(60, 200, 44, 44))],
    complete: true, dockBounds: [rect(0, 518, 320, 54)], expectDock: true, surfaces: [panel()],
    density: [{ id: 'search-lane', specId: 'library-search-lane', bounds: rect(0, 80, 320, 48), contentBounds: rect(20, 84, 280, 40) }],
    features: [{ id: 'transport', state: 'pass' as const, detail: 'toggle and peers visible' }], ...overrides };
  return evaluateLayoutInvariants({ safeTopVp: 30, fontScale: 1, nodes: [], scanComplete: native.complete,
    requiresHeader: false, requiresControl: false, requiresFirstContent: false, modalOpen: true, recoveryPending: false,
    checkRecovery: false, native });
}

test('independent evidence observes R8–R14 in order', () => {
  const result = gate();
  assert.deepEqual(result.observedRules, ['R8', 'R9', 'R10', 'R11', 'R12', 'R13', 'R14']);
  assert.deepEqual(result.violations, []);
  assert.deepEqual(result.missing, []);
  assert.deepEqual(result.nativeAudit, { textCount: 1, imageCount: 1, interactiveCount: 1, complete: true });
});

test('R8 detects a bottom action that enters the gesture band', () => {
  assert.deepEqual(gate({ dockBounds: [rect(0, 530, 320, 54)] }).violations.map(issue => issue.rule), ['R8']);
  assert.deepEqual(gate({ dockBounds: [], expectDock: true }).missing, ['R8:footer-bounds']);
});

test('R9 fails clipped short rows and missing close, but admits a reachable long scrolling list', () => {
  const clipped = panel({ contentBounds: rect(45, 185, 160, 115), close: 'absent' });
  assert.deepEqual(gate({ surfaces: [clipped] }).violations.map(issue => [issue.rule, issue.detail]), [
    ['R9', 'no reachable close action'], ['R9', 'short list clipped despite room for its natural layout'],
  ]);
  assert.deepEqual(gate({ surfaces: [panel({ contentBounds: rect(45, 185, 160, 700), naturalHeight: 760,
    close: 'scroll-reachable' })] }).violations, []);
});

test('R10 detects detached, overlapping and falsely centered popovers', () => {
  assert.deepEqual(gate({ surfaces: [panel({ bounds: rect(35, 220, 180, 150) })] }).violations.map(issue => issue.rule), ['R10']);
  assert.deepEqual(gate({ surfaces: [panel({ bounds: rect(40, 90, 180, 150) })] }).violations.map(issue => issue.rule), ['R10']);
  assert.deepEqual(gate({ surfaces: [panel({ placement: 'center' })] }).violations.map(issue => issue.rule), ['R10']);
});

test('a long scroll-backed dialog can reach its close action while a bounded drawer must meet the correct window edge', () => {
  const longDialog = panel({ placement: 'center', bounds: rect(66, 30, 184, 800), scrollable: true,
    viewport: safeViewport, close: 'scroll-reachable' });
  const sideDrawer = panel({ placement: 'side-end', bounds: rect(140, 0, 180, 600), viewport, windowEdge: true });
  assert.deepEqual(gate({ surfaces: [longDialog, sideDrawer] }).violations, []);
  assert.deepEqual(gate({ surfaces: [{ ...sideDrawer, bounds: rect(130, 0, 180, 600) }] }).violations
    .map(issue => issue.rule), ['R10']);
  assert.deepEqual(gate({ surfaces: [{ ...longDialog, bounds: rect(0, 30, 184, 800) }] }).violations
    .map(issue => issue.rule), ['R9', 'R10']);
});

test('R11 rejects a collapsed island outline reported by the same pure palette gate', () => {
  const result = gate({ readingPaletteChecks: [{ id: 'native-edge-paint', actual: 0, minimum: 1 }] });
  assert.ok(result.violations.some(issue => issue.rule === 'R11' && issue.nodeId === 'native-edge-paint'));
});

test('R12 rejects inflated empty area without any authored tag height', () => {
  const result = gate({ density: [{ specId: 'library-search-lane', id: 'search-lane', bounds: rect(0, 60, 320, 64),
    contentBounds: rect(12, 77, 296, 30) }] });
  assert.deepEqual(result.violations.map(issue => issue.rule), ['R12']);
});

test('R13 scans untagged child text, image, and painted waveform geometry', () => {
  const result = gate({ nodes: [
    leaf('Text', 'wrapped', rect(12, 60, 140, 15), { textClipped: true }),
    leaf('Image', 'cover', rect(20, 93, 83, 30), { clip: rect(21, 90, 70, 40) }),
    leaf('Row', 'wave-bars', rect(30, 130, 28, 26), { parentBounds: rect(30, 135, 28, 12), paintedLeaf: true }),
  ] });
  assert.deepEqual(result.violations.map(issue => [issue.rule, issue.nodeId]), [
    ['R13', 'wrapped'], ['R13', 'cover'], ['R13', 'wave-bars'],
  ]);
});

test('R13 catches naked sibling collision and transparent hit blockers, preserving clipped scroll rows', () => {
  const result = gate({ nodes: [
    leaf('Button', 'first', rect(40, 160, 44, 44)), leaf('Button', 'second', rect(58, 160, 44, 44)),
    leaf('Button', 'different-paint-layer', rect(58, 160, 44, 44), { zIndex: 4 }),
    leaf('Stack', 'ghost', rect(20, 50, 244, 350), { opacity: 0, hitTest: 'block' }),
    leaf('Stack', 'disabled-buffer', rect(20, 50, 244, 350), { opacity: 0, hitTest: 'block', inputAdmissionSuppressed: true }),
    leaf('Text', 'offscreen-list-row', rect(12, 240, 110, 35), { scrollClip: true, clip: rect(8, 120, 280, 100) }),
  ] });
  assert.deepEqual(result.violations.map(issue => [issue.rule, issue.nodeId]), [['R13', 'second'], ['R13', 'ghost']]);
});

test('R14 cannot pass a requested feature missing companion or scan evidence', () => {
  const result = gate({ complete: false, nodes: [], requiredFeatures: ['appearance'], requiredRules: ['R13', 'R14'],
    features: [{ id: 'feature', state: 'missing', detail: 'no snapshot' }] });
  assert.ok(result.missing.includes('R13:native-tree'));
  assert.ok(result.missing.includes('R14:feature:appearance'));
  assert.ok(result.missing.includes('R14:no-applicable-evidence'));
  assert.ok(!result.observedRules.includes('R14'));
  assert.deepEqual(gate({ features: [{ id: 'feature', state: 'fail', detail: 'selected value never changed' }] })
    .violations.map(issue => issue.rule), ['R14']);
});
