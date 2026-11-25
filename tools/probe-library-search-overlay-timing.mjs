import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { selectedProductionComponentCallback, selectedProductionMethods } from './lib/selected-production-methods.mjs';
import { pureModuleProbe } from './lib/ets-pure-module-probe.mjs';
import { createReaderBuilderProbe, productionReaderMotionSdk } from './lib/reader-control-builder-probe.mjs';
import { readerProbeCubicBezierProgress } from './lib/reader-motion-curve-fixture.mjs';
import { readerSurfaceSpecsForProbe } from './lib/bounded-surface-sdk-probe.mjs';
import { createArkUIPropertyRuntimeProbe } from './lib/arkui-property-runtime-probe.mjs';

const base = new URL('../entry/src/main/ets/', import.meta.url);
const surfaceFile = new URL('features/search/ui/ReaderLibrarySearchSurface.ets', base);
const presentationFile = new URL('features/search/presentation/LibrarySearchPresentation.ets', base);
const indexFile = new URL('pages/Index.ets', base);
const timelineFile = new URL('ui/foundation/MotionTimeline.ts', base);
const { motionSegment } = pureModuleProbe(readFileSync(timelineFile, 'utf8'), 'MotionTimeline.ts', {}, ['motionSegment']);
const motion = productionReaderMotionSdk();
const surfaceSpecs = readerSurfaceSpecsForProbe({ densityPixels: 2.5 });
const timing = (id) => {
  const { durationMs, curve } = motion.motionSpecGet(`search.surface.${id}`);
  return { durationMs, curve: { interpolate: fraction => readerProbeCubicBezierProgress(fraction, ...curve) } };
};
class Frame {
  constructor(callback, postLayoutCallback) { this.action = postLayoutCallback ?? callback; }
}
let now = 0;
const Surface = selectedProductionMethods(surfaceFile, 'ReaderLibrarySearchSurface', [
  'applyTargets', 'snapToMode', 'transitionFor', 'durationFor', 'modeChanged', 'beginReducedTransition', 'aboutToDisappear',
  'retargetHistoryViewport', 'publishContinueCardCoverage', 'schedule', 'completeTransition',
  'segment', 'backFraction', 'sampleSurfaceProgress', 'resultsProgress', 'historyProgress',
  'scrimProgress', 'blend', 'headerVeil', 'headerStackShadow', 'headerShadowStrength',
], { ...motion, ...surfaceSpecs, motionSegment, readerMotionNowMs: () => now,
  LibrarySearchFrame: Frame, ReaderPostLayoutFrame: Frame });
const Presentation = selectedProductionMethods(presentationFile, 'LibrarySearchPresentation', [
  'setContinueCardCoverage', 'continueCardSuppressed',
]);

function createSurface(initial, reduceMotion = false) {
  const frames = [], animations = [];
  const presentation = Object.assign(new Presentation(), { mode: initial, identity: 7 });
  const context = {
    postFrameCallback: frame => frames.push(frame),
    getFocusController: () => ({ clearFocus() {} }),
    animateTo: (param, mutate) => animations.push({ param, mutate }),
  };
  const surface = Object.assign(new Surface(), {
    mode: initial, scheme: 'night', reduceMotion, mounted: true, generation: 0, scheduledToken: -1,
    identity: 7, navigationGeneration: 9, mounting: 11, model: {}, lastCardSuppressed: false,
    lastCardCoverageScope: '', cardCoverageRevision: 0,
    openSpec: timing('open'), submitSpec: timing('submit'), backSpec: timing('back'),
    submitRetractFraction: .3, editCollapseFraction: .5, editHistoryStartFraction: .28,
    displayedHistoryViewport: 120, displayedHistoryLimit: 160,
    resolvedHistoryViewport: () => ({ height: 120, suppressContinueCard: true }), historyLimit: () => 160,
    getUIContext: () => context, observeEntryHistory() {}, scheduleInputFocus() {}, onSettled() {},
    onHistoryCoverageChanged: (...args) => presentation.setContinueCardCoverage(...args),
  });
  const flushFrame = () => frames.splice(0).forEach(frame => frame.action());
  const move = mode => { surface.mode = mode; presentation.mode = mode; surface.modeChanged(); };
  const covered = () => presentation.continueCardSuppressed(surface.navigationGeneration, surface.mounting);
  surface.snapToMode(initial);
  surface.retargetHistoryViewport(true);
  flushFrame();
  return { surface, move, flushFrame, covered, animations };
}

const failures = [];
function verify(name, check) {
  try {
    now = 0;
    check();
    console.log(`PASS ${name}`);
  } catch (error) {
    failures.push(error);
    console.error(`FAIL ${name}`, error.message);
  }
}

verify('results return never paints a scrim or admits veil while mounted', () => {
  const { surface, move, flushFrame } = createSurface('results');
  move('idle');
  for (now = 0; now < surface.backSpec.durationMs; now++) {
    flushFrame();
    assert.equal(surface.scrimProgress(), 0, `results back scrim at ${now}ms`);
    assert.equal(surface.headerVeil(), false, `results back veil at ${now}ms`);
  }
  flushFrame();
  assert.equal(surface.headerVeil(), true);
});

verify('input return preserves the covering card until history falls away', () => {
  const { surface, move, flushFrame, covered } = createSurface('input');
  assert.equal(covered(), true);
  move('idle');
  assert.equal(covered(), true, 'the logical mode change must retain current visual coverage');
  let previous = 1;
  for (now = 0; now < surface.backSpec.durationMs; now++) {
    flushFrame();
    const current = surface.scrimProgress();
    assert.ok(current <= previous, `input back scrim reverses at ${now}ms`);
    if (surface.historyProgress() > .01) assert.equal(covered(), true, `history still covers at ${now}ms`);
    previous = current;
  }
  flushFrame();
  flushFrame();
  assert.equal(surface.scrimProgress(), 0);
  assert.equal(covered(), false, 'settled close releases coverage');
});

verify('history submit and an interrupted edit retain only current coverage', () => {
  const { surface, move, flushFrame, covered } = createSurface('input');
  move('results');
  assert.equal(covered(), true);
  now = 22;
  flushFrame();
  assert.ok(surface.historyProgress() > .01);
  const interruptedShadow = surface.headerStackShadow();
  move('input');
  assert.deepEqual(surface.headerStackShadow(), interruptedShadow, 'edit starts at the painted shadow');
  assert.equal(covered(), true);
  now += surface.backSpec.durationMs;
  flushFrame();
  move('results');
  now += surface.submitSpec.durationMs;
  flushFrame();
  flushFrame();
  assert.equal(covered(), false, 'settled results release the covered card');

  move('input');
  surface.aboutToDisappear();
  surface.mounted = true;
  surface.mounting++;
  surface.mode = 'results';
  surface.snapToMode('results');
  surface.retargetHistoryViewport(true);
  flushFrame();
  assert.equal(covered(), false, 'a queued old-mount history receipt cannot hide the card');
});

verify('open, submit, edit and both returns maintain continuous shared shadow', () => {
  for (const [from, to] of [['idle', 'input'], ['input', 'results'], ['results', 'input'], ['input', 'idle'], ['results', 'idle']]) {
    now = 0;
    const { surface, move, flushFrame } = createSurface(from);
    let previous = surface.headerStackShadow();
    const raised = surfaceSpecs.readerSurfaceElevation('raised', surface.scheme);
    assert.equal(previous.radius, from === 'results' ? 0 : raised.radius);
    move(to);
    const duration = surface.transitionDurationMs;
    for (now = 0; now <= duration; now++) {
      flushFrame();
      const current = surface.headerStackShadow();
      const label = `${from} → ${to} at ${now}ms`;
      assert.ok(Math.abs(current.radius - previous.radius) <= raised.radius * .06, `radius jumps ${label}`);
      assert.ok(Math.abs(current.offsetY - previous.offsetY) <= raised.offsetY * .06, `offset jumps ${label}`);
      const alpha = color => Number.parseInt(color.slice(1, 3), 16);
      assert.ok(Math.abs(alpha(current.color) - alpha(previous.color)) <= 3, `alpha jumps ${label}`);
      previous = current;
    }
    assert.equal(previous.radius, to === 'results' ? 0 : raised.radius);
  }
});

verify('reduced return waits for fade completion before admitting veil or releasing coverage', () => {
  for (const initial of ['results', 'input']) {
    const { surface, move, flushFrame, covered, animations } = createSurface(initial, true);
    const original = surface.headerStackShadow();
    move('idle');
    assert.equal(surface.headerVeil(), false);
    assert.deepEqual(surface.headerStackShadow(), original);
    if (initial === 'input') assert.equal(covered(), true);
    flushFrame();
    const fade = animations.shift();
    assert.equal(fade.param.duration, 120);
    surface.reducedSearchOpacity = .5;
    if (initial === 'results') {
      assert.equal(surface.headerVeil(), false);
      assert.ok(surface.headerStackShadow().radius > 0);
      assert.ok(surface.headerStackShadow().radius < surfaceSpecs.readerSurfaceElevation('raised', surface.scheme).radius);
    }
    fade.mutate();
    assert.equal(surface.headerVeil(), false, 'target assignment does not settle the material');
    if (initial === 'results') assert.equal(surface.scrimProgress() * surface.reducedSearchOpacity, 0);
    if (initial === 'input') assert.equal(covered(), true);
    const endpoint = surface.headerStackShadow();
    assert.deepEqual(endpoint, surfaceSpecs.readerSurfaceElevation('raised', surface.scheme));
    fade.param.onFinish();
    flushFrame();
    assert.equal(surface.headerVeil(), true);
    assert.equal(covered(), false);
    assert.deepEqual(surface.headerStackShadow(), endpoint, 'revealing the veil does not step the shadow');
  }
});

verify('reduced open, submit and edit keep geometry fixed during the opacity fade', () => {
  for (const [from, to] of [['idle', 'input'], ['input', 'results'], ['results', 'input']]) {
    const { surface, move, flushFrame, animations } = createSurface(from, true);
    const original = surface.headerStackShadow();
    move(to);
    assert.deepEqual(surface.headerStackShadow(), original, `${from} → ${to} first shadow`);
    const endpoints = [surface.displayedSurfaceProgress, surface.historyProgress(), surface.resultsProgress()];
    flushFrame();
    const fade = animations.shift();
    assert.equal(fade.param.duration, 120);
    surface.reducedSearchOpacity = .5;
    assert.deepEqual([surface.displayedSurfaceProgress, surface.historyProgress(), surface.resultsProgress()], endpoints);
    fade.mutate();
    const endpoint = surface.headerStackShadow();
    assert.equal(endpoint.radius, to === 'results' ? 0 : surfaceSpecs.readerSurfaceElevation('raised', surface.scheme).radius);
    fade.param.onFinish();
    assert.deepEqual(surface.headerStackShadow(), endpoint);
  }
});

verify('retained SDK-lowered header Stack consumes interpolated shadow at live density', () => {
  const historySource = readFileSync(new URL('features/search/ui/ReaderSearchHistoryPanel.ets', base), 'utf8');
  const metrics = { densityPixels: 2.5 };
  const liveSpecs = readerSurfaceSpecsForProbe(metrics);
  const properties = createArkUIPropertyRuntimeProbe();
  const { owner } = createReaderBuilderProbe(readFileSync(surfaceFile, 'utf8'),
    ['header', 'headerStackShadow', 'headerShadowStrength', 'blend'], { ...properties.sdk, ...liveSpecs },
    { ...properties.hooks, childSources: { ReaderSearchHistoryPanel: historySource } });
  Object.assign(owner, {
    mode: 'results', searchMounted: false, scheme: 'night', transitionKind: 'submit',
    reducedTransition: true, reducedSearchOpacity: .5, fromShadowStrength: 1, toResults: 1,
    spec: { borderWidth: 1 }, bar() {}, headerVeil: () => false, headerMaterialRadius: () => 18,
    panelBorderColor: () => '#000000', headerSurfaceAreaChange: () => () => {},
  });
  const revision = new properties.sdk.ObservedPropertySimplePU(0, owner, 'metricsRevision');
  Object.defineProperty(owner, 'metricsRevision', { get: () => revision.get() });
  owner.header();
  const shadowNodes = [...owner.nodes.values()].filter(node => node.shadow !== undefined);
  assert.equal(shadowNodes.length, 1);
  const [headerStack] = shadowNodes;
  assert.equal(headerStack.type, 'Stack');
  assert.equal(headerStack.borderRadius, 18);
  const checkShadow = () => {
    const raised = liveSpecs.readerSurfaceElevation('raised', owner.scheme);
    assert.equal(headerStack.shadow.radius, raised.radius * .5);
    assert.equal(headerStack.shadow.offsetY, raised.offsetY * .5);
    const alpha = Math.round(Number.parseInt(raised.color.slice(1, 3), 16) / 2);
    assert.equal(headerStack.shadow.color, `#${alpha.toString(16).padStart(2, '0').toUpperCase()}${raised.color.slice(3)}`);
  };
  checkShadow();
  metrics.densityPixels = 3.5;
  revision.set(1);
  properties.flush();
  checkShadow();
});

verify('scrolled bookshelf passes final 14vp blur before and after route handoff', () => {
  const owner = { route: 'search', librarySearch: { mode: 'idle' },
    shelfRead: { snapshot: { visualAdmitted: true }, headerScrolled: true } };
  const currentBlur = () => surfaceSpecs.readerHeaderVeilMaterial(
    selectedProductionComponentCallback(indexFile, 'ReaderLibrarySearchSurface', 'headerScrolled', owner), 'day').radius;
  assert.equal(currentBlur(), 14);
  owner.route = 'bookshelf';
  assert.equal(currentBlur(), 14);
  owner.shelfRead.snapshot.visualAdmitted = false;
  assert.equal(currentBlur(), 10);
});

if (failures.length > 0) process.exitCode = 1;
