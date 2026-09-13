import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  readerControlAppearanceEndpoint,
  readerControlAppearanceFontActor,
  readerControlAppearanceFontDropIndex,
  readerControlAppearanceFontInput,
  sampleReaderControlAppearance,
} from '../entry/src/main/ets/features/reading/ReaderControlAppearanceGeometry.ts';
import {
  moveReaderAppearanceFontSlot,
  normalizeReaderAppearanceFontOrder,
} from '../entry/src/main/ets/features/reading/ReaderAppearanceState.ts';

const near = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1e-8,
  `${message}: ${actual} != ${expected}`);
const sample = (p, widthDelta = 0) =>
  sampleReaderControlAppearance(p, 286 + 52 * p + widthDelta, 666);
const quick = sample(0);
const full = sample(1);

// Independent evidence: original live recursive motion JSON, not a fixture
// generated from the sampler or its expected values. Source has a hold; target
// deliberately removes it. Only raw endpoints are compared below.
const fixture = JSON.parse(await readFile(new URL('./fixtures/reader-control-restored-baseline-20260905.json', import.meta.url)));
const source = fixture.records.find(record => record.module === 'appearance' && record.direction === 'expand');
assert.equal(source.rootNodeId, '1691:20749');
function css(id) {
  const node = source.motionContext.nodes.find(node => node.nodeId === id);
  assert.ok(node, `live source node ${id} exists`);
  return node.codeSnippets.css;
}
function endpoints(id, property) {
  const expression = new RegExp(`${property}: ([^;]+);`, 'g');
  const values = [...css(id).matchAll(expression)].map(match =>
    match[1].split(' ').map(value => Number.parseFloat(value)));
  assert.ok(values.length >= 2, `${id} ${property} supplies endpoints`);
  return [values[0], values.at(-1)];
}
for (let index = 0; index < 8; index += 1) {
  const [start, end] = endpoints(`1691:${20785 + index}`, 'translate');
  near(quick.themeSwatches[index].x - full.themeSwatches[index].x, start[0] - end[0], 'swatch source X delta');
  near(quick.themeSwatches[index].y - full.themeSwatches[index].y, start[1] - end[1], 'swatch source Y delta');
  assert.equal(quick.themeSwatches[index].opacity, 1);
  assert.equal(full.themeSwatches[index].opacity, 1);
  assert.equal(quick.themeSwatches[index].width, 62.5);
  assert.equal(full.themeSwatches[index].width, 62.5);
  assert.equal(quick.themeSwatches[index].height, 24);
  assert.equal(full.themeSwatches[index].height, 24);
  const qFont = readerControlAppearanceFontActor(quick, index, index);
  const fFont = readerControlAppearanceFontActor(full, index, index);
  const [fontStart, fontEnd] = endpoints(`1691:${20799 + index}`, 'translate');
  near(qFont.x - fFont.x, fontStart[0] - fontEnd[0], 'font source X delta');
  near(qFont.y - fFont.y, fontStart[1] - fontEnd[1], 'font source Y delta');
  const [widthStart, widthEnd] = endpoints(`1691:${20799 + index}`, 'width');
  const [heightStart, heightEnd] = endpoints(`1691:${20799 + index}`, 'height');
  near(qFont.width, widthStart[0], 'font source Quick width');
  near(fFont.width, widthEnd[0], 'font source Full width');
  near(qFont.height, heightStart[0], 'font source Quick height');
  near(fFont.height, heightEnd[0], 'font source Full height');
}
near(quick.contentTranslateX, -0.9, 'Appearance viewport X is owned once locally');
near(full.contentTranslateX, 0, 'Full local X');
near(full.themeSwatches[0].x, 18.5, 'static Full swatch position');
near(full.themeSwatches[0].y, 53.39, 'static Full swatch position');
near(full.themeShells[0].x, 13, 'static Full card shell position');
near(full.themeShells[0].y, 43.39, 'static Full card shell position');
near(full.themeShells[0].width, 73.5, 'static Full card shell width');
near(full.layout.y, 367, 'static Full layout origin');
near(full.layout.height, 322, 'Full layout removes two duplicate 42vp settings rows');

// Every actor's transformation is linear in ONE p. Reverse/stop/re-grab samples
// have no previous-frame state and cannot trigger a local easing/window.
for (const p of [0, 0.001, 0.03, 0.2, 0.5, 0.9, 0.97, 1]) {
  const frame = sample(p);
  for (const property of ['quickThemeHeader', 'fullThemeHeader', 'quickFontHeader',
    'fullFontHeader', 'divider', 'themeDayAction', 'themeNightAction', 'layout']) {
    for (const coordinate of ['x', 'y', 'width', 'height', 'opacity']) {
      near(frame[property][coordinate], quick[property][coordinate] +
        (full[property][coordinate] - quick[property][coordinate]) * p,
      `${property}.${coordinate} shares spatial progress ${p}`);
    }
  }
  for (let index = 0; index < 8; index += 1) {
    for (const coordinate of ['x', 'y', 'width', 'height', 'opacity']) {
      near(frame.themeSwatches[index][coordinate], quick.themeSwatches[index][coordinate] +
        (full.themeSwatches[index][coordinate] - quick.themeSwatches[index][coordinate]) * p,
      `theme ${index}.${coordinate} shares p`);
      const q = readerControlAppearanceFontActor(quick, index, index);
      const f = readerControlAppearanceFontActor(full, index, index);
      const actor = readerControlAppearanceFontActor(frame, index, index);
      near(actor[coordinate], q[coordinate] + (f[coordinate] - q[coordinate]) * p,
        `font ${index}.${coordinate} shares p`);
    }
  }
  assert.deepEqual(sample(p), frame, 'sampling after a reversal never changes its value');
  assert.equal('scrollCompensationY' in frame, false, 'scroll lifecycle belongs to shared runtime policy, not authored geometry');
}

// Shared identities may have different slot indices after a persisted reorder,
// but each identity has one trajectory (including import in a previous slot).
const reorderedQuick = readerControlAppearanceFontActor(quick, 0, 3);
const reorderedFull = readerControlAppearanceFontActor(full, 0, 3);
const reorderedHalf = readerControlAppearanceFontActor(sample(0.5), 0, 3);
near(reorderedHalf.x, (reorderedQuick.x + reorderedFull.x) / 2, 'reordered identity X midpoint');
near(reorderedHalf.y, (reorderedQuick.y + reorderedFull.y) / 2, 'reordered identity Y midpoint');
for (const delta of [-30, 0, 100]) {
  const resized = sample(0.3, delta);
  near(resized.fullViewportWidth, 338 + delta, 'responsive endpoint width does not scale text');
  near(resized.themeSwatches[0].width, 62.5, 'resize keeps source fixed swatch size');
  assert.ok(readerControlAppearanceFontActor(resized, 3, 3).width > 0);
}

// User-confirmed overlay: a distinct ordered slot, default last. The original
// overlapping Figma endpoint remains available only as explicit raw comparison.
const defaultImport = readerControlAppearanceFontActor(full, -1, 8, true);
near(defaultImport.y, 327, 'approved default import has its own final grid slot');
const rawImport = readerControlAppearanceFontActor(full, -1, 8, true, 'source-overlap-pending');
const system = readerControlAppearanceFontActor(full, 0, 0);
assert.deepEqual(rawImport, system, 'explicit source-only comparison retains the original overlap');
const approvedImport = readerControlAppearanceFontActor(full, -1, 8, true, 'ordered-slot-approved');
near(approvedImport.y, 327, 'explicit approved ordered slot, not a source assertion');
assert.equal(readerControlAppearanceFontActor(quick, -1, 8, true).opacity, 0);
assert.equal(readerControlAppearanceEndpoint(0, true), 'quick');
assert.equal(readerControlAppearanceEndpoint(1, true), 'full');
for (const p of [0.001, 0.5, 0.999]) assert.equal(readerControlAppearanceEndpoint(p, true), 'none');
for (const p of [0, 0.5, 1]) assert.equal(readerControlAppearanceEndpoint(p, false), 'none');

const defaultOrder = ['system', 'serif', 'sans', 'kai', 'fangSong', 'mono',
  'sourceHanSerif', 'lxgwWenKai', 'import'];
for (const candidate of [undefined, [], defaultOrder.slice(0, -1)]) {
  assert.deepEqual(normalizeReaderAppearanceFontOrder(candidate), defaultOrder,
    'missing/default order gives import its final, distinct slot');
}
const partial = ['serif', 'system', 'serif', 'unknown'];
const partialBefore = partial.slice();
const repaired = normalizeReaderAppearanceFontOrder(partial);
assert.deepEqual(repaired.slice(0, 2), ['serif', 'system'], 'valid custom prefix survives normalization');
assert.equal(repaired.at(-1), 'import', 'missing import is appended last');
assert.deepEqual(partial, partialBefore, 'normalization does not mutate saved input');
assert.equal(new Set(repaired).size, 9, 'invalid/duplicate entries cannot create overlapping slots');

function actorsForOrder(frame, order) {
  const quickOrder = order.filter(slot => slot !== 'import');
  return order.map((slot, fullIndex) => readerControlAppearanceFontActor(frame,
    quickOrder.indexOf(slot), fullIndex, slot === 'import'));
}
function assertNonoverlap(actors, message) {
  actors.forEach((actor, index) => {
    assert.ok(actor.width > 0 && actor.height > 0, `${message}: positive cell ${index}`);
    actors.slice(index + 1).forEach((other, offset) => {
      const intersectionWidth = Math.min(actor.x + actor.width, other.x + other.width) - Math.max(actor.x, other.x);
      const intersectionHeight = Math.min(actor.y + actor.height, other.y + other.height) - Math.max(actor.y, other.y);
      assert.ok(intersectionWidth <= 1e-8 || intersectionHeight <= 1e-8,
        `${message}: cells ${index} and ${index + offset + 1} overlap`);
    });
  });
}

// Real production normalizer + motion sampler + drag hit geometry + reorder
// operation. Check narrow/standard/wide endpoints and every persisted Import
// position, not a requirement that custom-order trajectories cannot cross.
let dragScenarios = 0;
for (const delta of [-64, -30, 0, 100, 338]) {
  const qFrame = sample(0, delta);
  const fFrame = sample(1, delta);
  for (const builtins of [defaultOrder.slice(0, -1), defaultOrder.slice(0, -1).reverse()]) {
    for (let importIndex = 0; importIndex < 9; importIndex += 1) {
      const saved = builtins.slice();
      saved.splice(importIndex, 0, 'import');
      const savedBefore = saved.slice();
      const order = normalizeReaderAppearanceFontOrder(saved);
      assert.deepEqual(order, saved, 'valid saved import position is not forced to last');
      const fullActors = actorsForOrder(fFrame, order);
      const quickActors = actorsForOrder(qFrame, order);
      assertNonoverlap(fullActors, `full width ${fFrame.fullViewportWidth}, import ${importIndex}`);
      assertNonoverlap(quickActors.filter((actor, index) => order[index] !== 'import'), 'quick eight cells');
      for (const actor of fullActors) {
        assert.ok(actor.x >= 11 && actor.x + actor.width <= 11 + fFrame.sectionWidth + 1e-8,
          'full cell fits the responsive section');
        assert.ok(actor.y + actor.height <= fFrame.layout.y - 10,
          'ninth cell leaves a gap before layout controls');
      }
      assert.equal(quickActors[importIndex].opacity, 0, 'import is absent from Quick regardless of saved slot');
      assert.equal(fullActors[importIndex].opacity, 1, 'import is visible at Full');
      for (const p of [0.1, 0.5, 0.9]) {
        const actors = actorsForOrder(sample(p, delta), order);
        actors.forEach((actor, index) => {
          for (const coordinate of ['x', 'y', 'width', 'height', 'opacity']) {
            near(actor[coordinate], quickActors[index][coordinate] +
              (fullActors[index][coordinate] - quickActors[index][coordinate]) * p,
            'reordered identity retains a single linear spatial path');
          }
        });
      }
      // Import can be dragged from any custom position to every grid slot.
      const origin = fullActors[importIndex];
      for (let desired = 0; desired < 9; desired += 1) {
        const destination = fullActors[desired];
        const target = readerControlAppearanceFontDropIndex(fFrame, origin.x, origin.y,
          destination.x - origin.x, destination.y - origin.y, order.length);
        assert.equal(target, desired, 'pointer center resolves the intended ordered slot');
        const result = moveReaderAppearanceFontSlot(order, importIndex, target);
        assert.equal(result.indexOf('import'), desired, 'import is movable, not permanently pinned last');
        assert.deepEqual(normalizeReaderAppearanceFontOrder(result), result, 'saved reorder survives normalization');
        assertNonoverlap(actorsForOrder(fFrame, result), 'drag result has distinct slots');
        assert.deepEqual(moveReaderAppearanceFontSlot(result, desired, importIndex), order,
          'drag back restores the complete order');
        dragScenarios += 1;
      }
      // Built-in fonts use the same slots and may move across Import as well.
      const firstBuiltin = order.findIndex(slot => slot !== 'import');
      const movedBuiltin = moveReaderAppearanceFontSlot(order, firstBuiltin, 8);
      assert.equal(movedBuiltin[8], order[firstBuiltin]);
      assertNonoverlap(actorsForOrder(fFrame, movedBuiltin), 'built-in reorder across import');
      assert.deepEqual(saved, savedBefore, 'preview and drag tests never mutate the saved order');
    }
  }
}
assert.equal(readerControlAppearanceFontDropIndex(full, 11, 327, -10000, -10000, 9), 0);
assert.equal(readerControlAppearanceFontDropIndex(full, 11, 327, 10000, 10000, 9), 8);
assert.equal(readerControlAppearanceFontDropIndex(full, 11, 327, 0, 0, 0), -1);
for (const p of [0, 0.001, 0.5, 0.999, 1]) {
  assert.equal(readerControlAppearanceFontInput(p, true, true), p === 1, 'import accepts input only at Full');
  assert.equal(readerControlAppearanceFontInput(p, false, true), false, 'disabled host never exposes import input');
  assert.equal(readerControlAppearanceFontInput(p, true, true, 'source-overlap-pending'), false,
    'raw overlapping source comparison never exposes an ambiguous import hit target');
  assert.equal(readerControlAppearanceFontInput(p, true, false), p === 0 || p === 1,
    'shared built-in inputs are available only at stable endpoints');
}

// Supplemental source-tree guard only: this does not claim ArkUI/runtime or
// visual acceptance. Production sampler behavior above is the primary test.
const tree = await readFile(new URL('../entry/src/main/ets/features/reading/ReaderControlAppearanceContent.ets', import.meta.url), 'utf8');
assert.doesNotMatch(tree, /ReaderAppearanceFullPanel\(|ReaderAppearanceSharedActors\(|animateTo\(|setTimeout\(/);
assert.match(tree, /private scheduleFontFrame/,'font sorting has a separate cancellable feedback clock, not a panel morph clock');
assert.match(tree, /control-appearance-theme-\$\{theme\}/);
assert.match(tree, /control-appearance-font-\$\{font\}/);
assert.match(tree, /importLayout: ReaderControlAppearanceImportLayout = 'ordered-slot-approved'/);
assert.match(tree, /return readerControlAppearanceFontInput\(/);
assert.match(tree, /const target = readerControlAppearanceFontDropIndex\(/);
assert.match(tree, /this\.fontOriginalOrder = normalizeReaderAppearanceFontOrder\(this\.snapshot\.fontOrder\)/);
assert.match(tree, /dismissTemporaryRevision/);
assert.match(tree, /onTemporaryLayerChange/);
console.log(`reader control appearance production geometry + independent source endpoints: PASS (${dragScenarios} ordered import drag cases)`);
