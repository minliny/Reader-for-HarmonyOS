import assert from 'node:assert/strict';
import { test } from 'node:test';
import { layoutReceiptProblem } from '../../scripts/lib/vm-journey-evidence.mjs';
import { evaluateLayoutInvariants, type LayoutInvariantRect } from '../../entry/src/main/ets/ui/layout/LayoutInvariantEvaluator.ts';
import { measureMountedTextEvidence, measuredTextReflowClips, READER_LAYOUT_IMPORT_LABEL_TEXT_ID,
  type LayoutInvariantNativeNode, type LayoutInvariantNativeSample,
  type LayoutInvariantSurfaceAudit }
  from '../../entry/src/main/ets/ui/layout/LayoutInvariantNativeAudit.ts';
import { inspectReaderNativeMaterialPaint } from '../../entry/src/main/ets/ui/layout/ReaderNativeMaterialPaint.ts';
import { ReaderNativeTextSliceAudit } from '../../entry/src/main/ets/ui/layout/ReaderNativeTextSliceAudit.ts';

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

test('R10 uses the measured arrow bubble while R9 still checks the menu scroll viewport', () => {
  const anchor = rect(250, 54, 44, 44);
  const bubble = rect(100, 106, 200, 174);
  const scrollViewport = rect(112, 118.25, 176, 150);
  const moreMenu = panel({ id: 'reader-control-more-menu', anchor, bounds: bubble, close: 'native-dismiss',
    contentBounds: scrollViewport, contentViewport: scrollViewport, naturalHeight: bubble.height,
    expectsContentMeasurement: true, scrollable: true });

  assert.deepEqual(gate({ surfaces: [moreMenu] }).violations, []);
  assert.deepEqual(gate({ surfaces: [{ ...moreMenu, bounds: scrollViewport }] }).violations.map(issue => issue.rule), ['R10']);
  assert.deepEqual(gate({ surfaces: [{ ...moreMenu, contentBounds: rect(112, 118.25, 176, 156) }] })
    .violations.map(issue => issue.rule), ['R9']);
  assert.ok(gate({ surfaces: [{ ...moreMenu, bounds: undefined }], requiredRules: ['R10'] })
    .missing.includes('R10:no-applicable-evidence'));
});

test('source group panel measures its positioned surface against the saved trigger, and audits its chevron envelope', () => {
  const group = panel({ id: 'reader-source-group-panel', placement: 'anchor-overlap',
    bounds: rect(162, 115, 140, 172), anchor: rect(195, 115, 90, 40), close: 'visible' });
  const chevron = leaf('Image', 'reader-source-group-collapse-chevron', rect(275, 127, 15, 15),
    { parentBounds: rect(275, 127, 15, 15), parentType: 'Stack', clip: group.bounds });
  const measured = gate({ surfaces: [group], nodes: [chevron], requiredRules: ['R9', 'R10', 'R13'] });
  assert.deepEqual(measured.violations, []);
  assert.deepEqual(measured.missing, []);
  assert.ok(gate({ surfaces: [{ ...group, anchor: undefined }] }).missing.includes('R10:anchor:reader-source-group-panel'));
  const outside = gate({ surfaces: [group], nodes: [{ ...chevron, bounds: rect(291, 127, 15, 15),
    parentBounds: rect(291, 127, 15, 15) }] });
  assert.deepEqual(outside.violations.map(issue => issue.rule), ['R13']);
});

test('paged native text projects admitted glyphs instead of the retained full paragraph and preserves R13 clipping', () => {
  const audit = new ReaderNativeTextSliceAudit();
  const textFrame = rect(30, -500, 240, 900);
  const owner = rect(30, 100, 240, 200);
  audit.publish(2, 3, rect(1, 601, 241, 195), 4);
  assert.equal(audit.project(2, '4', textFrame, owner), undefined);
  const slice = audit.project(2, '3', textFrame, owner);
  assert.deepEqual(slice, { bounds: rect(31, 101, 241, 195), parentBounds: rect(30, 100, 244, 200) });
  assert.ok(slice);
  const leafInSlice = leaf('Text', 'paged-paragraph', slice.bounds,
    { parentBounds: slice.parentBounds, clip: rect(30, 100, 244, 200) });
  assert.deepEqual(gate({ nodes: [leafInSlice] }).violations, []);
  const clipped = gate({ nodes: [{ ...leafInSlice, clip: rect(30, 100, 244, 180) },
    leaf('Text', 'chapter-title', rect(30, 60, 100, 16), { textClipped: true })] });
  assert.deepEqual(clipped.violations.map(issue => [issue.rule, issue.nodeId]), [
    ['R13', 'paged-paragraph'], ['R13', 'chapter-title'],
  ]);
  audit.retire(2);
  assert.equal(audit.project(2, '3', textFrame, owner), undefined);
});

test('complete mounted text evidence supersedes independent reflow while R13 still rejects clipped ink and missing text', () => {
  const frame = rect(59, 381, 248, 16.5);
  const parentBounds = rect(59, 360, 248, 37.5);
  const clip = rect(16, 222, 299, 320);
  const ink = rect(91, 384, 183, 11);
  const tail = rect(269, 384, 5, 11);
  const length = '支持多选 TXT、EPUB、MOBI、AZW3'.length;
  const line = { start: 0, end: length };
  const hint = leaf('Text', 'local-import-hint', frame, { parentBounds, clip, scrollClip: true, textClipped: true });
  const withLayout = (mountedText: LayoutInvariantNativeNode['mountedText']) =>
    gate({ nodes: [{ ...hint, mountedText }] });

  assert.deepEqual(gate({ nodes: [hint] }).violations.map(issue => issue.rule), ['R13']);
  const proven = measureMountedTextEvidence(length, [line], [ink], [tail]);
  const complete = withLayout(proven);
  assert.deepEqual(complete.violations, []);
  assert.deepEqual(complete.missing, []);
  assert.ok(complete.observedRules.includes('R13'));

  const outside = rect(91, 384, 220, 11);
  const clippedInk = withLayout(measureMountedTextEvidence(length, [line], [outside], [rect(305, 384, 5, 11)]));
  assert.deepEqual(clippedInk.violations.map(issue => [issue.rule, issue.nodeId]), [['R13', hint.id]]);

  const clippedText = withLayout(measureMountedTextEvidence(length, [{ start: 0, end: length - 1 }], [ink], []));
  assert.deepEqual(clippedText.violations.map(issue => [issue.rule, issue.nodeId]), [['R13', hint.id]]);

  const missing = withLayout(measureMountedTextEvidence(length, [line], [ink], []));
  assert.deepEqual(missing.missing, ['R13:native-text-layout:local-import-hint']);
  assert.equal(missing.observedRules.includes('R13'), false);

  const ancestorClipped = gate({ nodes: [{ ...hint, mountedText: proven, scrollClip: false, clip: rect(60, 381, 210, 16.5) }] });
  assert.deepEqual(ancestorClipped.violations.map(issue => [issue.rule, issue.nodeId]), [['R13', hint.id]]);

  const wrapped = measureMountedTextEvidence(length, [{ start: 0, end: 12 }, { start: 12, end: length }],
    [rect(91, 384, 90, 11), rect(91, 402, 95, 11)], [rect(180, 402, 6, 11)]);
  const tallFrame = rect(59, 381, 248, 35);
  assert.deepEqual(gate({ nodes: [{ ...hint, bounds: tallFrame, parentBounds: rect(59, 360, 248, 57), mountedText: wrapped }] })
    .violations, []);
});

test('R13 clipping evidence identifies the native node and the reason without exporting its text', () => {
  const frame = rect(59, 381, 248, 16.5);
  const parent = rect(30, 360, 300, 45);
  const clip = rect(16, 222, 250, 320);
  const measuredText = leaf('Text', 'Text:1502', frame, { key: '1502', parentBounds: parent,
    clip, textClipped: true, textReflow: { independentHeightVp: 33, matchedStyleHeightVp: 16.5,
      style: { fontSize: '11.00fp', lineHeight: '16.50fp' } } });
  const result = gate({ nodes: [measuredText] });
  assert.deepEqual(result.violations.map(issue => [issue.rule, issue.nodeId]), [['R13', 'Text:1502']]);
  assert.deepEqual(JSON.parse(JSON.stringify(result.nativeAudit.clippingOffenders)), [{
    key: '1502', id: 'Text:1502', type: 'Text', frame, parentBounds: parent, clip, scrollClip: false,
    reasons: ['independent-text-height', 'ancestor-clips-frame'],
    reflow: { independentHeightVp: 33, matchedStyleHeightVp: 16.5,
      style: { fontSize: '11.00fp', lineHeight: '16.50fp' } },
  }]);
  const multiple = gate({ nodes: Array.from({ length: 5 }, (_, index) => ({
    ...measuredText, id: `text:${index}`, key: `text:${index}`, parentKey: `parent:${index}`,
  })) });
  assert.equal(multiple.violations.length, 5);
  assert.equal(multiple.nativeAudit.clippingOffenderCount, 5);
  assert.equal(multiple.nativeAudit.clippingOffenders?.length, 3);
});

test('the local import label uses matched native reflow without weakening R13 clipping', () => {
  // Round 8 FrameNode 1502 was one fully drawn line at this measured width.
  // Repeating the measurement with the exact inspector style and px width
  // returns one line, while reflow with the omitted style returns two.
  const singleLine = 19.428571428571427;
  const twoLines = 38.857142857142854;
  const measured = { independentHeightVp: twoLines, matchedStyleHeightVp: singleLine };
  assert.equal(measuredTextReflowClips(READER_LAYOUT_IMPORT_LABEL_TEXT_ID, singleLine, measured), false);
  assert.equal(measuredTextReflowClips(READER_LAYOUT_IMPORT_LABEL_TEXT_ID, singleLine, {
    ...measured, matchedStyleHeightVp: twoLines,
  }), true);
  assert.equal(measuredTextReflowClips(READER_LAYOUT_IMPORT_LABEL_TEXT_ID, singleLine, {
    independentHeightVp: twoLines,
  }), true);
  assert.equal(measuredTextReflowClips('other-text', singleLine, measured), true);
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

test('R9, R10 and R13 require actual evidence for the off-tree backup, restore, and confirmation dialogs', () => {
  const requiredRules = ['R9', 'R10', 'R13'] as const;
  for (const id of ['local-recovery-export', 'local-recovery-inspect', 'local-recovery-confirm', 'book-removal']) {
    const surface: LayoutInvariantSurfaceAudit = { id, bounds: rect(40, 211, 236, 180),
      viewport: safeViewport, placement: 'center', close: 'visible' };
    const input = leaf('Button', `${id}-cancel`, rect(65, 315, 88, 44), { parentBounds: surface.bounds, closeAction: true });
    const good = gate({ surfaces: [surface], nodes: [input], requiredRules: [...requiredRules] });
    assert.deepEqual(good.missing, [], id);
    assert.deepEqual(good.violations, [], id);
    assert.deepEqual(good.observedRules.filter(rule => rule === 'R9' || rule === 'R10' || rule === 'R13'),
      requiredRules, id);
    assert.equal(layoutReceiptProblem({ ...good, status: 'measured' }, { requiredRules }), '', id);
    const omitted = gate({ complete: false, surfaces: [], nodes: [], requiredRules: [...requiredRules] });
    for (const rule of requiredRules) assert.ok(omitted.missing.includes(`${rule}:no-applicable-evidence`), id);
    assert.match(layoutReceiptProblem({ ...omitted, status: 'incomplete' }, { requiredRules }), /缺失/, id);
    const broken = gate({ surfaces: [{ ...surface, bounds: rect(0, 250, 236, 180), close: 'absent' }],
      nodes: [{ ...input, id: `${id}-hidden-interceptor`, opacity: 0, hitTest: 'block' }],
      requiredRules: [...requiredRules] });
    assert.deepEqual([...new Set(broken.violations.map(issue => issue.rule))], requiredRules, id);
    assert.match(layoutReceiptProblem({ ...broken, status: 'measured' }, { requiredRules }), /违规/, id);
  }
});

test('a dynamically keyed native popup reports clipping separately from a missing measured anchor', () => {
  const selector: LayoutInvariantSurfaceAudit = { ...panel(), id: 'reader-layout-overlay:select-panel:42',
    close: 'native-dismiss' };
  assert.deepEqual(gate({ surfaces: [selector] }).violations, []);
  const clipped = { ...selector, anchor: undefined, contentBounds: rect(45, 180, 160, 124) };
  const result = gate({ surfaces: [clipped], requiredRules: ['R9', 'R10'] });
  assert.ok(result.missing.includes(`R10:anchor:${selector.id}`));
  assert.deepEqual(result.violations.map(issue => [issue.rule, issue.nodeId]), [['R9', selector.id]]);
});

test('R11 evaluates a supplied runtime palette check once', () => {
  const result = gate({ readingPaletteChecks: [{ id: 'native-edge-paint', actual: 0, minimum: 1 }] });
  assert.deepEqual(result.violations.map(issue => [issue.rule, issue.nodeId]), [['R11', 'native-edge-paint']]);
});

test('R11 requires a paper witness when a visible text reader was measured', () => {
  const result = gate({ readingPaletteChecks: [{ id: 'shell-outline', actual: 4, minimum: 3 }],
    readingPaperEvidenceMissing: true });
  assert.ok(result.missing.includes('R11:reading-paper'));
});

test('R11 rejects visible native material whose border, outline and shadow are all absent', () => {
  const material = leaf('Column', 'native-sheet', rect(24, 120, 260, 200), {
    nativeMaterialPaint: { border: false, outline: false, shadow: false },
  });
  const result = gate({ nodes: [material] });
  assert.deepEqual(result.violations.map(issue => [issue.rule, issue.nodeId]), [['R11', 'native-sheet']]);
  for (const paint of [{ outline: true }, { border: true }, { shadow: true }]) {
    assert.deepEqual(gate({ nodes: [{ ...material, nativeMaterialPaint: paint }] }).violations, []);
  }
  const unobserved = gate({ nodes: [{ ...material, nativeMaterialPaint: { border: false } }] });
  assert.ok(unobserved.missing.includes('R11:native-edge:native-sheet'));
});

test('R11 native paint receipt reads the actual outline, border and shadow from inspector attributes', () => {
  const base = {
    outlineWidth: '0.00vp', outlineColor: '#FF867A6E',
    borderWidth: '0.00vp', borderColor: '#FF000000',
    shadow: { radius: '0.000000', color: '#00000000' },
  };
  assert.deepEqual(inspectReaderNativeMaterialPaint(base), { outline: false, border: false, shadow: false });
  assert.deepEqual(inspectReaderNativeMaterialPaint({ ...base,
    outlineWidth: { top: '1.50vp' }, outlineStyle: 'OutlineStyle.SOLID' }),
  { outline: true, border: false, shadow: false });
  assert.equal(inspectReaderNativeMaterialPaint({ ...base, borderWidth: '1vp', borderStyle: 'BorderStyle.None' }).border, false);
  assert.equal(inspectReaderNativeMaterialPaint({ ...base, borderWidth: '1vp', borderColor: '#00867A6E' }).border, false);
  assert.equal(inspectReaderNativeMaterialPaint({ ...base, shadow: 'ShadowStyle.OuterDefaultSM' }).shadow, true);
  assert.equal(inspectReaderNativeMaterialPaint({ ...base, shadow: { radius: '8', color: '#7F332C25' } }).shadow, true);
  assert.equal(inspectReaderNativeMaterialPaint({ outlineWidth: '1.50vp' }).outline, undefined);
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
