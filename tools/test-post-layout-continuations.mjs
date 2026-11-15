import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';
import { pureModuleProbe } from './lib/ets-pure-module-probe.mjs';
import { selectedProductionMethods } from './lib/selected-production-methods.mjs';
import { installedEtsCompiler } from './lib/ets-compiler-runtime.mjs';
import { actualReaderPostLayoutFrame } from './lib/reader-post-layout-frame-probe.mjs';
import * as rectangle from '../entry/src/main/ets/ui/layout/ReaderSurfaceRect.ts';

const cases = selectContractCases({
  'adapter-delivery': 'Actual shared post-layout adapter and8normal wrapper classes deliver once after layout, through idle or a next-frame fallback. The old idle-only negative is rejected.',
  'slot-delivery': 'Actual current slot/rectangle producer converges without Area or idle, reads after the first frame, and rejects replaced requests, zero boxes and unmounted callbacks.',
  'manga-delivery': 'Actual manga restore/landing keep two distinct fences without idle. Actual panel opening and focus continuations retain generation guards.',
});
const root = new URL('../entry/src/main/ets/', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');
const producers = [
  ['ui/layout/ReaderNativeSlotMeasurement.ets', 'ReaderSlotMeasurementFrame'],
  ['features/source/ui/SourceManagementPage.ets', 'SourceListLayoutFrame'],
  ['features/source/ui/SourceSwitchWindow.ets', 'SourceSwitchLayoutFrame'],
  ['features/search/ui/SearchPage.ets', 'SearchLayoutFrame'],
  ['features/downloads/ui/SharedDownloadPage.ets', 'SharedDownloadIdleFrame'],
  ['features/reading/ui/ReaderFullDirectory.ets', 'FullDirectoryHeaderMeasurementFrame'],
  ['features/manga/ui/MangaReadingSurface.ets', 'MangaLayoutFrame'],
  ['features/manga/ui/MangaReadingSurface.ets', 'MangaSheetFrame'],
];
const Adapter = actualReaderPostLayoutFrame();
const { ts, options } = installedEtsCompiler();

function productionFrame(path, name) {
  const source = read(path);
  const tree = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
  assert.deepEqual(tree.parseDiagnostics, []);
  const declaration = tree.statements.find(node => ts.isClassDeclaration(node) && node.name?.text === name);
  assert.ok(declaration);
  return pureModuleProbe(declaration.getText(tree), `${name}.ts`, { ReaderPostLayoutFrame: Adapter }, [name])[name];
}

function clock() {
  const pending = [];
  const delivered = [];
  const context = { postFrameCallback: frame => pending.push(frame) };
  return {
    pending, context,
    pulse() {
      const batch = pending.splice(0);
      for (const frame of batch) { frame.onFrame(0); delivered.push(frame); }
    },
    lateIdle() { for (const frame of delivered) frame.onIdle(2_000_000); },
  };
}

function checkAdapter(Frame) {
  for (const idle of [false, true]) {
    const frames = clock();
    let calls = 0;
    let started = 0;
    const frame = new Frame(frames.context, () => { calls += 1; }, () => { started += 1; });
    frame.onFrame(0);
    assert.equal(calls, 0, 'first frame start cannot establish new layout geometry');
    assert.equal(started, 1);
    if (idle) frame.onIdle(2_000_000);
    frames.pulse();
    assert.equal(calls, 1, 'layout continuation must arrive without requiring idle');
    frame.onIdle(2_000_000);
    frame.onFrame(1);
    frames.lateIdle();
    assert.equal(calls, 1, 'idle/fallback and late callback delivery run the action once');
    assert.equal(started, 1);
  }
  const frames = clock();
  let calls = 0;
  const failedTrace = new Frame(frames.context, () => { calls += 1; }, () => { throw Error('trace unavailable'); });
  failedTrace.onFrame(0);
  frames.pulse();
  assert.equal(calls, 1, 'diagnostic failure cannot suppress layout delivery');
}

function slotDelivery() {
  const frames = clock();
  let height = 58;
  const context = {
    ...frames.context, px2vp: value => value / 2,
    getFrameNodeById: () => ({ getPositionToWindowWithTransform: () => ({ x: 0, y: 0 }) }),
    getComponentUtils: () => ({ getRectangleById: () => ({ scale: { x: 1, y: 1 }, rotate: { angle: 0 },
      size: { width: 786, height: height * 2 } }) }),
  };
  const measurement = pureModuleProbe(read('ui/layout/ReaderSurfaceRectMeasurement.ets'),
    'ReaderSurfaceRectMeasurement.ets', rectangle, ['readerMeasureSurfaceRect']);
  const { ReaderNativeSlotMeasurement } = pureModuleProbe(read('ui/layout/ReaderNativeSlotMeasurement.ets'),
    'ReaderNativeSlotMeasurement.ets', { ReaderPostLayoutFrame: Adapter, ...measurement }, ['ReaderNativeSlotMeasurement']);
  const receipts = [];
  const slot = new ReaderNativeSlotMeasurement();
  slot.mount(context, 1, (value, key) => receipts.push([value, key]));
  frames.pulse();
  assert.deepEqual(receipts, []);
  height = 93;
  frames.pulse();
  assert.deepEqual(receipts, [[93, 1]], 'fallback reads the new layout rectangle');
  frames.lateIdle();
  assert.equal(receipts.length, 1);
  slot.request(2);
  slot.request(3);
  frames.pulse();
  frames.pulse();
  assert.deepEqual(receipts, [[93, 1], [93, 3]], 'a superseded request cannot publish its rectangle');
  slot.request(4);
  frames.pulse();
  slot.unmount();
  frames.pulse();
  frames.lateIdle();
  assert.equal(receipts.length, 2, 'unmounted fallback and idle callbacks are rejected');
  height = 0;
  slot.mount(context, 5, (value, key) => receipts.push([value, key]));
  frames.pulse(); frames.pulse();
  assert.equal(receipts.length, 2, 'zero native rectangle is not a valid height receipt');
  height = 101;
  slot.request(6);
  frames.pulse(); frames.pulse();
  assert.deepEqual(receipts.at(-1), [101, 6]);
  return { receipts, nativeAreaEvents: 0, idleRequired: false };
}

async function mangaDelivery() {
  const frames = clock();
  const scrolls = [];
  const focus = [];
  const MangaLayoutFrame = productionFrame('features/manga/ui/MangaReadingSurface.ets', 'MangaLayoutFrame');
  const MangaSheetFrame = productionFrame('features/manga/ui/MangaReadingSurface.ets', 'MangaSheetFrame');
  const Page = selectedProductionMethods(new URL('features/manga/ui/MangaReadingSurface.ets', root), 'MangaReadingSurface',
    ['restore', 'finishLayout', 'onViewportScroll', 'openPanel', 'panelOpeningCurrent', 'requestPanelFocus'], {
      MangaLayoutFrame, MangaSheetFrame, ScrollAlign: { START: 'start' }, LengthMetrics: { vp: value => value },
      motionAnimateParam: () => ({ duration: 0 }),
    });
  const page = Object.assign(new Page(), {
    mounted: true, layoutGeneration: 0, appliedLayoutGeneration: -1, first: 0, last: 0,
    boundaryDragging: false, boundaryBusy: false, sourceId: 'source', bookId: 'book',
    data: { projection: { index: () => 2 }, getData: () => ({ known: true, width: 1000, sourceHeight: 1200, sourceY: 0 }) },
    scroller: { scrollToIndex: (...args) => scrolls.push(args) }, horizontalScroller: { scrollTo() {} },
    getUIContext: () => ({ ...frames.context, animateTo(_options, action) { action(); },
      getFocusController: () => ({ requestFocus: target => focus.push(target) }) }),
    tracePosition() {}, traceBoundary() {}, refreshLoginRequiredForControls() {}, updateViewport() {},
    rowDisplayWidth: () => 1000, rowDisplayTop: () => 0, rowDisplayLeft: () => 0,
    measureVisibleWindow: () => true, rememberVisible: () => true,
    readerPanelForeground: () => true, widePanel: () => false,
    panelGeneration: 1, panelFocusGeneration: 0, panel: '', panelPhase: 'closed', reduceMotion: false,
    controller: { chapter: {} }, panelTriggerFocusId: panel => `trigger:${panel}`,
    invalidatePanelMotion() { this.panelGeneration += 1; },
    saveVisible: async () => {}, dismissPanelKeyboard: async () => {}, preparePanelFonts: async () => true,
    panelTravel: () => 300, cancelPanelOpening() { this.panelPhase = 'closed'; },
    settlePanel(generation, opening) {
      assert.equal(generation, this.panelGeneration);
      assert.equal(opening, true);
      this.panelPhase = 'open';
    },
  });
  page.restore(2, .5);
  frames.pulse();
  assert.equal(scrolls.length, 0);
  frames.pulse();
  assert.equal(scrolls.length, 1);
  assert.equal(scrolls[0][3].extraOffset, 600);
  assert.equal(page.appliedLayoutGeneration, -1, 'scroll dispatch does not also confirm the landing frame');
  frames.pulse();
  assert.equal(page.appliedLayoutGeneration, -1);
  frames.pulse();
  assert.equal(page.appliedLayoutGeneration, page.layoutGeneration);
  assert.equal(page.restoringAnchor, false);
  frames.lateIdle();
  assert.equal(scrolls.length, 1);
  page.restore(3, .2);
  page.layoutGeneration += 1;
  frames.pulse(); frames.pulse(); frames.lateIdle();
  assert.equal(scrolls.length, 1, 'a retired restore generation cannot scroll');
  await page.openPanel('more');
  assert.equal(page.panelPhase, 'opening');
  frames.pulse();
  assert.equal(page.panelPhase, 'opening');
  frames.pulse();
  assert.equal(page.panelPhase, 'open', 'panel opening continues without an idle callback');
  page.requestPanelFocus('close', page.panelGeneration, true);
  frames.pulse();
  assert.deepEqual(focus, []);
  frames.pulse();
  assert.deepEqual(focus, ['close']);
  frames.lateIdle();
  assert.deepEqual(focus, ['close']);
  page.requestPanelFocus('retired-close', page.panelGeneration, true);
  page.panelGeneration += 1;
  frames.pulse(); frames.pulse(); frames.lateIdle();
  assert.deepEqual(focus, ['close'], 'old panel focus request cannot reach a successor opening');
  return { restoreFences: 2, admittedScrolls: scrolls.length, focus, nativeLayout: 'finite port' };
}

for (const id of cases) {
  let result;
  if (id === 'adapter-delivery') {
    checkAdapter(Adapter);
    for (const [path, name] of producers) checkAdapter(productionFrame(path, name));
    const source = read('ui/layout/ReaderPostLayoutFrame.ets');
    const tree = ts.createSourceFile('ReaderPostLayoutFrame.ets', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
    const declaration = tree.statements.find(node => node.name?.text === 'ReaderPostLayoutFrame');
    const method = declaration.members.find(node => node.name?.text === 'onFrame');
    const idleOnly = source.slice(0, method.getStart(tree)) +
      'onFrame(_time: number): void { this.started?.(); }' + source.slice(method.end);
    const OldAdapter = pureModuleProbe(idleOnly, 'IdleOnlyFrame.ets', { FrameCallback: class {} }, ['ReaderPostLayoutFrame']).ReaderPostLayoutFrame;
    assert.throws(() => checkAdapter(OldAdapter), /layout continuation must arrive without requiring idle/);
    result = { families: 8, idlePaths: 2, oldIdleOnlyNegative: 'rejected' };
  } else if (id === 'slot-delivery') result = slotDelivery();
  else result = await mangaDelivery();
  console.log(JSON.stringify({ case: id, result, boundary: 'Actual frame classes and owner methods with finite frame/native geometry ports. No VM/native rendering.' }));
  recordContractCasePass(id);
}
