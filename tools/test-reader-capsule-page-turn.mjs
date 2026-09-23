import { installReaderMeasurementOwner } from './lib/reader-measurement-owner-fixture.mjs';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { deriveReaderSessionCapsule } from '../entry/src/main/ets/features/reading/ReaderSessionCapsuleModel.ts';
import { completeReaderPageGestureSettlement } from '../entry/src/main/ets/features/reading/ReaderPageGestureState.ts';

const require = createRequire(import.meta.url);
const sdk = '/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const ts = require(`${sdk}/node_modules/typescript`);
const options = require(`${sdk}/lib/ets_checker.js`).compilerOptions;
const baseline = process.env.READER_CAPSULE_BASELINE;
let file = new URL('../entry/src/main/ets/features/reading/LocalReadingExperience.ets', import.meta.url);
if (baseline) {
  file = join(mkdtempSync(join(tmpdir(), 'reader-ph109-')), 'LocalReadingExperience.ets');
  writeFileSync(file, execFileSync('/Library/Developer/CommandLineTools/usr/bin/git',
    ['show', `${baseline}:entry/src/main/ets/features/reading/LocalReadingExperience.ets`],
    { cwd: new URL('..', import.meta.url) }));
}
const source = readFileSync(file, 'utf8');
const tree = ts.createSourceFile('/tmp/CapsuleSource.ets', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
const component = tree.statements.find(node => node.members?.some(m => m.name?.getText(tree) === 'liveSessionCapsuleSnapshot'));
const member = name => component.members.find(node => node.name?.getText(tree) === name);
const observed = new Set(component.members.filter(node =>
  ts.getAllDecorators(node).some(d => /@(State|Prop|Link|StorageLink|StorageProp)\b/.test(d.getText(tree))))
  .map(node => node.name?.getText(tree)));
const projectionNames = ['shouldShowSessionCapsule', 'sessionCapsuleType', 'sessionCapsuleState',
  'sessionCapsuleCountdown', 'sessionCapsuleSnapshot', 'liveSessionCapsuleSnapshot', 'sessionLaunchBusinessStatus'];

// Isolate the exact production If subtree (not a rewritten condition). The SDK
// emits its real observer closures. The probe tests branch decisions/dependency
// reads; it makes no claim about native frame scheduling or compositor pixels.
let capsuleIf;
function visit(node) {
  if (ts.isIfStatement(node) && node.expression.getText(tree) ===
    'this.sessionLaunch === undefined && this.shouldShowSessionCapsule()') capsuleIf = node;
  ts.forEachChild(node, visit);
}
visit(member('build'));
assert.ok(capsuleIf);
const probeSource = `@Component struct CapsuleProbe {\n${projectionNames.map(n => member(n).getText(tree)).join('\n')}
  build() { ${capsuleIf.getText(tree)} }
}`;
const syntax = require(`${sdk}/lib/validate_ui_syntax.js`);
syntax.componentCollection.customComponents.add('ReaderSessionCapsule');
syntax.propCollection.set('ReaderSessionCapsule', new Set(['type', 'sessionState', 'countdown', 'interactionEnabled']));
class CapsuleChild {
  constructor(owner, params, _storage, id) { Object.assign(this, { owner, params, id }); }
}
class PreparedReaderPageTurn { constructor(...args) { this.args = args; } }
const Model = productionMotionMethods(file, [...projectionNames, 'beginMeasurement', 'completePreparedPageTurn',
  'pageChromeStateFrozen', 'flushDeferredPageChromeState', 'flushDeferredReadingImagePixels', 'pageTurnInputPhase',
  'onReaderPageGestureStateChanged', 'completeDirectPageTurnGesture'], {
  deriveReaderSessionCapsule, TextController: class {}, PreparedReaderPageTurn,
  readerPageTransitionUsesPreparedPages: () => false, completeReaderPageGestureSettlement,
});
const checks = [];
function check(name, fn) {
  try { fn(); checks.push({ name, status: 'PASS' }); }
  catch (error) { checks.push({ name, status: 'FAIL', error: error.message }); }
}
function fixture(type, status) {
  const chapter = { sourceId: 'local', bookId: 'capsule', content: 'body text', chapterIndex: 1, images: [] };
  const p = Object.assign(new Model(), {
    mounted: true, exitRequested: false, phase: 'ready', controlObscured: false, interactionBlocked: false,
    sessionLaunch: undefined, controlVisible: () => false, controlShellExitArmed: () => false,
    autoPageState: { status: type === 'autoPage' ? status : 'stopped', remainingSeconds: 8 },
    ttsState: { status: type === 'tts' ? status : 'idle' },
    visiblePage: { startScalar: 0 }, visibleFragments: [{ text: 'retained body' }],
    measurementBatch: [], measurementGeneration: 0, measurementEpoch: 0, readerSettingsSnapshot: { navigationMode: 'paged' },
    materializedChapterSelectionToken: 1, pageTurnGeneration: 1, lifecycleToken: 1,
    pageTurnGestureState: { phase: 'idle' }, pageTurnRenderRevision: 1, pageTurnFrozenRevision: -1,
    pageTurnSessionCapsuleFrozen: false, pageTurnSessionCapsuleSnapshot: undefined,
    isSessionActive: () => true, hasMeasuredViewport: () => true, isSelectionCurrent: () => true,
    measuringChapter: () => chapter, measuringRanges: () => [{ startScalar: 0, endScalar: 9 }],
    requireMeasurementLayoutMap: () => ({ scalarCount: () => 9, residentStart: () => 0, residentEnd: () => 9 }), lastMeasurableScalar: () => 8,
    measuringOffset: () => 0, setMeasuringOffset() {}, setMeasuringProgress() {}, setMeasuringRequestedAnchor() {},
    rangeIndexForOffset: () => 0, resetPendingPage() {}, prepareNextMeasurementBatch: () => true,
    armMeasurementDeadline() {}, ensureFirstPageReadyDeadline() {}, fail(error) { throw error; },
    isMeasurementCurrent: () => true, captureMeasurementChapterContext: () => ({ chapter }), measurementPaginationKey: () => ({}),
    geometryImageRequests: new Map(),
    finishAdjacentMeasurementContext() {}, releaseUnretainedReadingImages() {}, drainRapidPageTurn() {},
    resumePendingAutoPageTurn() {}, resumePagePreparationAfterTextureFrame() {},
    freezePageTurnProjection() {}, clearPageTurnProjection() {}, usesBookTurnSimulation: () => false,
    pageTurnOffsetX: 0, drainPageTurnPreparationQueue() {},
    admitPageChromeClock() {}, admitSessionCapsuleMeasurement() {},
  });
  p.automaticReadingState = () => p.autoPageState;
  return installReaderMeasurementOwner(p);
}
function nativeProjection(p) {
  const reads = new Map(), stack = [];
  const { owner } = createReaderBuilderProbe(probeSource, ['build', ...projectionNames], {
    deriveReaderSessionCapsule, ReaderSessionCapsule: CapsuleChild,
  }, {
    onObserverEnter: (_owner, id) => { stack.push(id); reads.set(id, new Set()); },
    onObserverExit: (_owner, id) => assert.equal(stack.pop(), id),
  });
  for (const key of Object.keys(p)) Object.defineProperty(owner, key, {
    configurable: true, get() {
      if (observed.has(key) && stack.length) reads.get(stack.at(-1)).add(key);
      return p[key];
    },
  });
  owner.sessionCapsuleLayout = () => ({ sessionX: 269, sessionY: 797 });
  const decisions = [];
  const update = owner.ifElseBranchUpdateFunction;
  owner.ifElseBranchUpdateFunction = function(id, generator) {
    decisions.push(id); return update.call(this, id, generator);
  };
  owner.initialRender();
  return { owner, reads, decisions };
}

for (const [type, status] of [['tts', 'paused'], ['tts', 'interrupted'], ['autoPage', 'paused'], ['autoPage', 'running']]) {
  for (const gesture of [false, true]) check(`${type}/${status}/${gesture ? 'gesture release' : 'tap or timer'}: retained page survives hidden measurement`, () => {
    const p = fixture(type, status), original = p.visiblePage;
    const ui = nativeProjection(p);
    if (gesture) {
      p.onReaderPageGestureStateChanged({ phase: 'tracking' });
      ui.owner.replay();
      p.onReaderPageGestureStateChanged({ phase: 'idle' });
      ui.owner.replay();
    }
    for (let turn = 0; turn < 5; turn++) {
      p.pageTurnPreparation = { generation: 1, direction: 'next', originChapterIndex: 1, originPageStartScalar: 0 };
      p.beginMeasurement(1);
      assert.equal(p.phase, 'measuring'); assert.equal(p.visiblePage, original);
      ui.owner.replay();
      assert.ok(ui.decisions.every(branch => branch === 0), 'production capsule If must never request the empty branch');
      p.completePreparedPageTurn({ startScalar: 9, fragments: [] }, p.measurementGeneration, 1, 1);
      assert.equal(p.phase, 'ready'); ui.owner.replay();
      assert.equal(ui.owner.children.size, 1, 'probe retains one child; branch decisions above establish no removal request');
    }
  });
}

check('freeze release remains an observed dependency of the real capsule If', () => {
  const p = fixture('tts', 'paused');
  p.onReaderPageGestureStateChanged({ phase: 'tracking' });
  const ui = nativeProjection(p);
  const ifNode = [...ui.owner.nodes.values()].find(node => node.type === 'If');
  assert.ok(ui.reads.get(ifNode.id).has('pageTurnSessionCapsuleFrozen'),
    'frozen projection must subscribe to its release, even without a business-state update');
  p.ttsState = { status: 'stopped' };
  assert.equal(p.shouldShowSessionCapsule(), true, 'gesture holds the snapshot');
  p.onReaderPageGestureStateChanged({ phase: 'idle' });
  ui.owner.replay();
  assert.equal(ui.decisions.at(-1), 1, 'release admits the terminal business state');
});
check('chapter loading retains the capsule while the committed reading body remains visible', () => {
  for (const type of ['tts', 'autoPage']) {
    const p = fixture(type, 'paused'), ui = nativeProjection(p);
    p.phase = 'loading'; ui.owner.replay();
    assert.ok(ui.decisions.every(branch => branch === 0));
    p.visibleFragments = []; ui.owner.replay();
    assert.equal(ui.decisions.at(-1), 1, 'an empty retained page is insufficient');
  }
});

check('first load, real failure, controls, obstruction and exit still hide the capsule', () => {
  for (const [key, value] of [['mounted', false], ['exitRequested', true], ['controlObscured', true],
    ['interactionBlocked', true], ['phase', 'failed'], ['controlVisible', () => true]]) {
    const p = fixture('tts', 'paused'); p[key] = value;
    assert.equal(p.shouldShowSessionCapsule(), false, key);
  }
  for (const phase of ['loading', 'measuring']) {
    const p = fixture('tts', 'paused'); p.phase = phase; p.visiblePage = undefined; p.visibleFragments = [];
    assert.equal(p.shouldShowSessionCapsule(), false, `${phase} without committed body`);
  }
});
check('a no-animation gesture rollback releases its held capsule snapshot', () => {
  const p = fixture('tts', 'paused');
  p.onReaderPageGestureStateChanged({ phase: 'tracking' });
  p.ttsState = { status: 'stopped' };
  p.onReaderPageGestureStateChanged({ phase: 'settling', settleTarget: 'rollback' });
  assert.equal(p.pageTurnGestureState.phase, 'idle');
  assert.equal(p.pageTurnSessionCapsuleFrozen, false, 'synchronous rollback must release without requiring a second idle event');
  assert.equal(p.shouldShowSessionCapsule(), false);
});
check('a direct gesture commit releases session state and countdown updates', () => {
  for (const type of ['tts', 'autoPage']) {
    const p = fixture(type, 'paused');
    p.onReaderPageGestureStateChanged({ phase: 'tracking' });
    p.onReaderPageGestureStateChanged({ phase: 'settling', settleTarget: 'commit' });
    if (type === 'tts') p.ttsState = { status: 'playing' };
    else p.autoPageState = { status: 'running', remainingSeconds: 3 };
    p.completeDirectPageTurnGesture();
    assert.equal(p.pageTurnGestureState.phase, 'idle');
    assert.equal(p.pageTurnSessionCapsuleFrozen, false);
    assert.equal(p.sessionCapsuleState(), 'playing');
    assert.equal(p.sessionCapsuleCountdown(), type === 'tts' ? 0 : 3);
  }
});
for (const result of checks) console.log(JSON.stringify(result));
assert.equal(checks.filter(r => r.status === 'FAIL').length, 0, 'PH109 production regression');
