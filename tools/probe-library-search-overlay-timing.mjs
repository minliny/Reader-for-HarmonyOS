import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { selectedProductionComponentCallback, selectedProductionMethods } from './lib/selected-production-methods.mjs';
import { pureModuleProbe } from './lib/ets-pure-module-probe.mjs';
import { createReaderBuilderProbe, productionReaderMotionSdk } from './lib/reader-control-builder-probe.mjs';
import { readerProbeCubicBezierProgress } from './lib/reader-motion-curve-fixture.mjs';
import { readerSurfaceSpecsForProbe } from './lib/bounded-surface-sdk-probe.mjs';
import { createArkUIPropertyRuntimeProbe } from './lib/arkui-property-runtime-probe.mjs';
import * as searchControlGeometry from '../entry/src/main/ets/ui/foundation/ReaderSearchControlGeometry.ts';

const base = new URL('../entry/src/main/ets/', import.meta.url);
const surfaceFile = new URL('features/search/ui/ReaderLibrarySearchSurface.ets', base);
const presentationFile = new URL('features/search/presentation/LibrarySearchPresentation.ets', base);
const indexFile = new URL('pages/Index.ets', base);
const timelineFile = new URL('ui/foundation/MotionTimeline.ts', base);
const { motionSegment } = pureModuleProbe(readFileSync(timelineFile, 'utf8'), 'MotionTimeline.ts', {}, ['motionSegment']);
const historyGeometryFile = new URL('features/search/ui/SearchHistoryGeometry.ts', base);
const { SearchHistoryGeometry, SearchHistoryViewport, projectSearchHistoryPanel } = pureModuleProbe(
  readFileSync(historyGeometryFile, 'utf8'), 'SearchHistoryGeometry.ts', searchControlGeometry,
  ['SearchHistoryGeometry', 'SearchHistoryViewport', 'projectSearchHistoryPanel']);
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
  'toggleHistoryAction',
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
    historyExpanded: false, historyResizeOpacity: 1, historyToggleRevision: 0,
    historyResizeRevision: 0, historyResizeHoldingCoverage: false,
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

verify('folded history keeps two complete rows and expanded history reaches the oldest keyword', () => {
  const keywords = Array.from({ length: 35 }, (_, index) => `词条${index + 1}`);
  const flatten = layout => layout.rows.flatMap(row => row.chips.map(chip => chip.keyword));
  for (const [fontScale, controlWidth] of [[1, 100], [1.45, 130]]) {
    const geometry = new SearchHistoryGeometry(328, 435, fontScale, false);
    const folded = projectSearchHistoryPanel(keywords, geometry, false, () => controlWidth);
    assert.equal(folded.canToggle, true);
    assert.equal(folded.rows.length, 2);
    assert.deepEqual(flatten(folded), keywords.slice(0, flatten(folded).length));
    const expanded = projectSearchHistoryPanel(keywords, geometry, true, () => controlWidth);
    assert.equal(expanded.expanded, true);
    assert.deepEqual(flatten(expanded), keywords);
    assert.ok(expanded.height <= 435);
    assert.ok(expanded.bodyViewport < expanded.rows.length * geometry.buttonHeight);
    const short = projectSearchHistoryPanel(keywords.slice(0, 1), geometry, false, () => controlWidth);
    assert.equal(short.canToggle, false);
  }
  const keyboard = new SearchHistoryGeometry(328, 185, 1, false);
  const expanded = projectSearchHistoryPanel(keywords, keyboard, true, () => 100);
  assert.equal(expanded.expanded, true);
  assert.ok(expanded.height <= 185);
  assert.equal(flatten(expanded).at(-1), keywords.at(-1));
});

verify('collapsing history retains the covered card until the size animation completes', () => {
  const { surface, covered, flushFrame, animations } = createSurface('input');
  surface.historyInteractive = () => true;
  surface.model.owns = owner => owner === 4;
  surface.historyExpanded = true;
  surface.historyLayout = () => ({ canToggle: true, expanded: surface.historyExpanded });
  surface.resolvedHistoryViewport = () => surface.historyExpanded ?
    { height: 120, suppressContinueCard: true } : { height: 80, suppressContinueCard: false };
  surface.toggleHistoryAction(3)();
  assert.equal(surface.historyExpanded, true);
  surface.toggleHistoryAction(4)();
  assert.equal(surface.historyExpanded, false);
  assert.equal(covered(), true);
  const resize = animations.shift();
  resize.mutate();
  flushFrame();
  assert.equal(covered(), true);
  resize.param.onFinish();
  flushFrame();
  assert.equal(covered(), false);
});

verify('rapid reduced-motion toggles schedule only the latest fade at the same panel height', () => {
  const { surface, flushFrame, animations } = createSurface('input', true);
  surface.historyInteractive = () => true;
  surface.model.owns = owner => owner === 4;
  surface.historyLayout = () => ({ canToggle: true, expanded: surface.historyExpanded });
  const toggle = surface.toggleHistoryAction(4);
  toggle();
  toggle();
  toggle();
  flushFrame();
  assert.equal(surface.historyExpanded, true);
  assert.equal(animations.length, 1);
  animations[0].mutate();
  assert.equal(surface.historyResizeOpacity, 1);
  toggle();
  surface.identity += 1;
  surface.modeChanged();
  flushFrame();
  assert.equal(surface.historyExpanded, false);
  assert.equal(surface.historyResizeOpacity, 1);
  assert.equal(animations.length, 1, 'the retired opening cannot start an opacity program');
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

verify('history retains a fully covered card as its lower edge passes across the card', () => {
  for (const reduced of [false, true]) {
    const { surface, move, flushFrame, covered, animations } = createSurface('input', reduced);
    const none = new SearchHistoryViewport(0, 64, 380, 160, 90);
    const below = new SearchHistoryViewport(24, 64, 380, 160, 90);
    const partial = new SearchHistoryViewport(46, 64, 380, 160, 90);
    const full = new SearchHistoryViewport(280, 64, 380, 160, 90);
    assert.equal(none.suppressContinueCard, false);
    assert.equal(below.suppressContinueCard, false);
    assert.equal(partial.suppressContinueCard, true);
    assert.equal(full.suppressContinueCard, true);
    surface.resolvedHistoryViewport = () => full;
    surface.retargetHistoryViewport(true);
    flushFrame();
    move('idle');
    flushFrame();
    assert.equal(covered(), true);
    if (reduced) {
      const fade = animations.shift();
      fade.mutate();
      assert.equal(covered(), true);
      fade.param.onFinish();
    } else {
      now = surface.backSpec.durationMs * .75;
      flushFrame();
      assert.equal(covered(), true);
      now = surface.backSpec.durationMs;
      flushFrame();
    }
    flushFrame();
    assert.equal(covered(), false);
  }
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

for (const initial of ['input', 'results']) {
  verify(`${initial} return hands off its painted state when reduced motion turns on mid-flight`, () => {
    for (const switchAt of initial === 'input' ? [100, 199] : [100]) {
      now = 0;
      const { surface, move, flushFrame, covered, animations } = createSurface(initial);
      const tracks = () => [surface.displayedSurfaceProgress, surface.historyProgress(),
        surface.resultsProgress(), surface.scrimProgress()];
      move('idle');
      now = switchAt;
      assert.ok(now < surface.backSpec.durationMs);
      flushFrame();
      flushFrame(); // Deliver any coverage change queued by the sampled frame.
      const before = tracks();
      const shadow = surface.headerStackShadow();
      const activeTrack = initial === 'input' ? before[1] : before[2];
      assert.ok(activeTrack > 0 && activeTrack < 1, 'handoff happens inside the return');
      const keepCoverage = initial === 'input' && switchAt === 100;
      assert.equal(before[1] > .01, keepCoverage);
      assert.equal(covered(), keepCoverage);

      surface.reduceMotion = true;
      surface.modeChanged();
      assert.deepEqual(tracks(), before, `visual tracks jump at ${switchAt}ms`);
      assert.deepEqual(surface.headerStackShadow(), shadow);
      flushFrame();
      assert.equal(animations.length, 1);
      const fade = animations[0];
      assert.equal(fade.param.duration, 120);
      assert.equal(surface.reducedSearchOpacity, 1);

      const painted = () => [surface.reducedSearchOpacity,
        ...tracks().map(progress => progress * surface.reducedSearchOpacity)];
      let previous = painted();
      const verifyFrame = () => {
        assert.deepEqual(tracks(), before, 'geometry remains fixed during the fade');
        assert.equal(surface.headerVeil(), false);
        assert.equal(covered(), keepCoverage);
        const current = painted();
        assert.ok(current.every((value, index) => value >= 0 && value <= previous[index]), 'paint fades monotonically');
        previous = current;
      };
      // The test context records animateTo. Sample its registered curve at the native opacity seam.
      for (let elapsed = 0; elapsed < fade.param.duration; elapsed += 30) {
        now = switchAt + elapsed;
        surface.reducedSearchOpacity = 1 - readerProbeCubicBezierProgress(elapsed / fade.param.duration, ...fade.param.curve);
        flushFrame();
        verifyFrame();
      }
      now = switchAt + fade.param.duration;
      fade.mutate();
      verifyFrame();
      assert.ok(previous.every(value => value === 0));
      fade.param.onFinish();
      flushFrame();
      assert.deepEqual(tracks(), [0, 0, 0, 0]);
      assert.equal(surface.headerVeil(), true);
      assert.equal(covered(), false);
    }
  });
}

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
