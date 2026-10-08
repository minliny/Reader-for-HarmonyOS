import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire, stripTypeScriptTypes } from 'node:module';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { createArkUIPropertyRuntimeProbe } from './lib/arkui-property-runtime-probe.mjs';

// Execute the actual patched upstream methods and official SDK-emitted layout.
// Scroller edge facts and native pointer callbacks are controlled seams; this
// probe does not emulate native gesture arbitration, frames or device feel.
const source = readFileSync(new URL('../entry/src/main/ets/features/manga/vendor/pulltorefresh/PullToRefresh.ets', import.meta.url), 'utf8');
const vendorRoot = new URL('../entry/src/main/ets/features/manga/vendor/pulltorefresh/', import.meta.url);
const sourceLock = JSON.parse(readFileSync(new URL('source-lock.json', vendorRoot), 'utf8'));
for (const file of sourceLock.files) assert.equal(createHash('sha256').update(readFileSync(new URL(file.path, vendorRoot))).digest('hex'), file.vendoredSha256, file.path + ' source-lock');
assert.equal(createHash('sha256').update(readFileSync(new URL('LICENSE', vendorRoot))).digest('hex'), sourceLock.licenseSha256);
assert.equal(createHash('sha256').update(readFileSync(new URL('reader.patch', vendorRoot))).digest('hex'), sourceLock.patchSha256);
const configSource = readFileSync(new URL('../entry/src/main/ets/features/manga/vendor/pulltorefresh/PullToRefreshConfigurator.ets', import.meta.url), 'utf8');
const require = createRequire(import.meta.url);
const sdk = process.env.READER_ETS_LOADER_ROOT ?? '/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const ts = require(`${sdk}/node_modules/typescript`);
const tree = ts.createSourceFile('/tmp/PullToRefresh.ets', source, ts.ScriptTarget.Latest, true,
  ts.ScriptKind.ETS, require(`${sdk}/lib/ets_checker.js`).compilerOptions);
assert.equal(tree.parseDiagnostics.length, 0);
const component = tree.statements.find(node => node.name?.getText(tree) === 'PullToRefresh');
const names = component.members.map(node => node.name?.getText(tree)).filter(Boolean);
const Configurator = new Function(`${stripTypeScriptTypes(configSource.replace(/^export /gm, ''))};return PullToRefreshConfigurator`)();
const constants = Object.fromEntries(tree.statements.filter(ts.isVariableStatement).flatMap(node =>
  node.declarationList.declarations.map(decl => [decl.name.getText(tree), Number(decl.initializer.getText(tree))])));
let now = 1000;
const boundary = new Proxy({}, { get: () => () => {} });
class Scroller {
  constructor() { this.offset = 0; this.end = false; this.pins = []; }
  currentOffset() { return { xOffset: 0, yOffset: this.offset }; }
  isAtEnd() { return this.end; }
  scrollEdge(edge) { this.pins.push(edge); }
}
function fixture(candidate = source) {
  const runtime = createArkUIPropertyRuntimeProbe();
  const pulls = [], activity = [], animations = [];
  const built = createReaderBuilderProbe(candidate, names, {
    ...runtime.sdk, ...constants, PullToRefreshConfigurator: Configurator,
    Scroller, PanGestureOptions: class { constructor(option) { Object.assign(this, option); } },
    PanDirection: { Up: 1, Down: 2 }, Edge: { Top: 0, Bottom: 1 },
    Gesture: boundary, PanGesture: boundary, GesturePriority: { Parallel: 0 }, globalThis: { Gesture: boundary }, TouchType: { Down: 0, Up: 1, Move: 2, Cancel: 3 },
    Date: { now: () => now },
    animateTo: (options, callback) => { animations.push(options); callback(); },
  }, runtime.hooks);
  const owner = built.owner;
  owner.onPull = (...args) => pulls.push(args);
  owner.onActivity = value => activity.push(value);
  owner.mHeightNumber = 800;
  owner.aboutToAppear();
  return { ...built, owner, pulls, activity, animations, runtime };
}
const tick = () => new Promise(resolve => setImmediate(resolve));
const event = (offsetY, fingers = 1) => ({ offsetY, fingerList: Array.from({ length: fingers }, () => ({})) });
function startAtEnd(f, offset = 100) {
  f.owner.scroller.offset = offset;
  f.owner.scroller.end = true;
  f.owner.onActionStart(event(0));
  now += 101;
}
function pull(f, distance) { f.owner.onActionUpdate(event(-distance)); }
const outcomes = [];
function check(label, fn) { fn(); outcomes.push(label); }

check('adapter API avoids actual SDK inherited attribute methods', () => {
  const nativeAttributes = ts.createSourceFile('common.d.ts', readFileSync(`${sdk}/../../component/common.d.ts`, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const reserved = new Set(nativeAttributes.statements.filter(node => ['CommonMethod', 'CommonAttribute'].includes(node.name?.getText(nativeAttributes)))
    .flatMap(node => node.members.map(member => member.name?.getText(nativeAttributes)).filter(Boolean)));
  assert.ok(reserved.has('enabled') && reserved.has('onTouch'), 'actual ArkUI CommonAttribute inherited names');
  function verify(candidate) {
    const parsed = ts.createSourceFile('/tmp/PullApi.ets', candidate, ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS,
      require(`${sdk}/lib/ets_checker.js`).compilerOptions);
    assert.equal(parsed.parseDiagnostics.length, 0);
    const declaration = parsed.statements.find(node => node.name?.getText(parsed) === 'PullToRefresh');
    for (const member of declaration.members) assert.equal(reserved.has(member.name?.getText(parsed)), false,
      `adapter member must not shadow CustomComponent attribute ${member.name?.getText(parsed)}`);
  }
  verify(source);
  const oldEnabled = source.replace('pullEnabled: boolean', 'enabled: boolean');
  assert.notEqual(oldEnabled, source); assert.throws(() => verify(oldEnabled), /CustomComponent attribute enabled/);
  const oldTouch = source.replace('private handleTouchEvent(event: TouchEvent)', 'private onTouch(event: TouchEvent)');
  assert.notEqual(oldTouch, source); assert.throws(() => verify(oldTouch), /CustomComponent attribute onTouch/);
});

check('actual viewport threshold clamps to 120–180vp', () => {
  const { owner } = fixture();
  for (const [height, expected] of [[300,120],[800,160],[1800,180]]) {
    owner.mHeightNumber = height; assert.equal(owner.triggerDistance(), expected);
  }
});
check('scrolling distance and first 100ms at boundary do not count', () => {
  const f = fixture(); f.owner.scroller.offset = 300;
  f.owner.onActionStart(event(0));
  f.owner.onActionUpdate(event(-200)); assert.equal(f.owner.rawDistance, 0);
  f.owner.scroller.end = true;
  f.owner.onActionUpdate(event(-300)); assert.equal(f.owner.rawDistance, 0);
  now += 80; f.owner.onActionUpdate(event(-400)); assert.equal(f.owner.rawDistance, 0);
  now += 21; f.owner.onActionUpdate(event(-430)); assert.equal(f.owner.rawDistance, 30);
  assert.deepEqual(f.pulls.at(-1), ['next',30,false]);
});
check('short and single-image chapters admit an up-pull at yOffset=0', () => {
  const f = fixture(); startAtEnd(f, 0); pull(f, 23);
  assert.deepEqual(f.pulls.at(-1), ['',23,false]);
  pull(f, 24); assert.deepEqual(f.pulls.at(-1), ['next',24,false]);
  pull(f, 160); assert.deepEqual(f.pulls.at(-1), ['next',160,true]);
  assert.equal(f.owner.state, constants.IS_PULL_UP_2);
});
check('reverse movement disarms, returning to zero cancels for the same pointer', () => {
  const f = fixture(); startAtEnd(f); pull(f, 170); pull(f, 140);
  assert.deepEqual(f.pulls.at(-1), ['next',140,false]);
  pull(f, 0); assert.deepEqual(f.pulls.at(-1), ['',0,false]);
  assert.equal(f.owner.gestureCancelled, true); pull(f, 200);
  assert.equal(f.owner.rawDistance, 0);
});
check('unarmed release bounces without preparing a chapter', () => {
  const f = fixture(); let calls = 0;
  f.owner.onLoadMore = async () => { calls++; return ''; };
  startAtEnd(f); pull(f, 159); f.owner.onActionEnd();
  assert.equal(calls, 0); assert.equal(f.owner.trYBottom, 0);
  assert.deepEqual(f.activity, [true,false]);
});
{
  const f = fixture(); let calls = 0, settle;
  f.owner.onLoadMore = () => { calls++; return new Promise(resolve => { settle = resolve; }); };
  startAtEnd(f); pull(f, 160); f.owner.onActionEnd(); f.owner.onActionEnd();
  assert.equal(calls, 1); assert.equal(f.owner.requestPending, true);
  assert.equal(f.owner.trYBottom, -96);
  settle(''); await tick(); assert.equal(f.owner.requestPending, false);
  assert.equal(f.owner.trYBottom, 0); outcomes.push('armed release triggers once and resets after success');
}
{
  const f = fixture(); f.owner.onLoadMore = async () => { throw new Error('controlled offline'); };
  startAtEnd(f); pull(f, 160); f.owner.onActionEnd(); await tick();
  assert.equal(f.owner.requestPending, false); assert.equal(f.owner.state, constants.IS_FREE);
  assert.deepEqual(f.pulls.at(-1), ['',0,false]); outcomes.push('rejected target preparation returns to the retained current view');
}
check('double finger and native cancel discard pending pulls', () => {
  const f = fixture(); startAtEnd(f); pull(f, 160);
  f.owner.handleTouchEvent({ type: 0, touches: [{},{}] }); f.owner.onActionEnd();
  assert.equal(f.owner.rawDistance, 0); assert.equal(f.owner.gestureCancelled, true);
  const single = fixture(); startAtEnd(single); pull(single, 160);
  single.owner.handleTouchEvent({ type: 3, touches: [] }); assert.equal(single.owner.rawDistance, 0);
});
check('disabled, removed neighbour and resetToken stop a pull', () => {
  for (const change of [f => { f.owner.pullEnabled = false; f.owner.handleEnabledChange(); },
    f => { f.owner.hasNext = false; f.owner.handleAdmissionChange(); },
    f => f.owner.handleResetToken()]) {
    const f = fixture(); startAtEnd(f); pull(f, 160); change(f);
    assert.equal(f.owner.rawDistance, 0); assert.equal(f.owner.gestureCancelled, true);
  }
});
{
  const f = fixture(); let settle;
  f.owner.onLoadMore = () => new Promise(resolve => { settle = resolve; });
  startAtEnd(f); pull(f, 160); f.owner.onActionEnd(); f.owner.aboutToDisappear();
  const count = f.pulls.length; settle(''); await tick();
  assert.equal(f.pulls.length, count); assert.equal(f.owner.alive, false);
  outcomes.push('unmounted component ignores late request completion');
}
check('chapter start supports previous direction with the same threshold', () => {
  const f = fixture(); f.owner.scroller.offset = 0; f.owner.onActionStart(event(0)); now += 101;
  f.owner.onActionUpdate(event(160)); assert.deepEqual(f.pulls.at(-1), ['previous',160,true]);
  assert.equal(f.owner.state, constants.IS_PULL_DOWN_2);
});
check('original upstream five-stage damping remains bound and reversible', () => {
  const f = fixture(); const owner = f.owner;
  owner.trYTop = 0; assert.equal(owner.getTranslateYOfRefresh(10), 7);
  owner.trYTop = 170; assert.equal(owner.getTranslateYOfRefresh(100), 170);
  owner.trYTop = 0; assert.equal(owner.getTranslateYOfRefresh(-100), 0);
  owner.trYBottom = 0; assert.equal(owner.getTranslateYOfLoadMore(-10), -7);
  owner.trYBottom = -170; assert.equal(owner.getTranslateYOfLoadMore(-100), -170);
  owner.trYBottom = 0; assert.equal(owner.getTranslateYOfLoadMore(100), 0);
});
check('official SDK emits fixed viewport translation and native single-finger pan', () => {
  const f = fixture(); f.owner.customList = () => {}; f.owner.initialRender();
  const columns = [...f.owner.nodes.values()].filter(node => node.type === 'Column');
  assert.equal(columns[0].height, '100%');
  assert.deepEqual(columns[0].translate, {y:0});
  assert.match(f.output, /PanGesture\.onActionCancel/);
  assert.equal(f.owner.panOption.fingers,1);
  assert.equal(f.owner.panOption.distance,1);
});

{
  const f = fixture(); const settles = [];
  f.owner.onLoadMore = () => new Promise(resolve => settles.push(resolve));
  startAtEnd(f); pull(f, 160); f.owner.onActionEnd(); f.owner.cancelPull();
  startAtEnd(f); pull(f, 160); f.owner.onActionEnd();
  settles[0](''); await tick();
  assert.equal(f.owner.requestPending, true); assert.equal(f.owner.trYBottom, -96);
  settles[1](''); await tick(); assert.equal(f.owner.requestPending, false);
  outcomes.push('cancelled request completion cannot clear a newer loading pull');
}
check('unknown Scroller boundary refuses admission', () => {
  const f = fixture(); f.owner.scroller.isAtEnd = () => { throw new Error('edge unavailable'); };
  f.owner.onActionStart(event(0)); now += 101; pull(f,160);
  assert.equal(f.owner.rawDistance,0); assert.deepEqual(f.activity,[]);
});
check('real-source counterfactuals reject original short-content, missing stability and resize defects', () => {
  function verifyShort(candidate) {
    const f = fixture(candidate); startAtEnd(f,0); pull(f,160);
    assert.deepEqual(f.pulls.at(-1), ['next',160,true]);
  }
  const oldShort = source.replace('delta < 0 && this.hasNext && this.atBottom',
    'delta < 0 && this.hasNext && this.scroller.currentOffset().yOffset !== 0 && this.atBottom');
  assert.notEqual(oldShort,source); assert.throws(() => verifyShort(oldShort));
  function verifyWait(candidate) {
    const f = fixture(candidate); f.owner.scroller.offset=100; f.owner.scroller.end=true;
    f.owner.onActionStart(event(0)); now += 80; pull(f,160); assert.equal(f.owner.rawDistance,0);
  }
  const noWait = source.replace('now - this.bottomSince >= 100','now - this.bottomSince >= 0');
  assert.notEqual(noWait,source); assert.throws(() => verifyWait(noWait));
  function verifyViewport(candidate) {
    const f = fixture(candidate); f.owner.customList=()=>{}; f.owner.trYBottom=-60; f.owner.initialRender();
    const content=[...f.owner.nodes.values()].find(node=>node.type==='Column');
    assert.equal(content.height,'100%');
  }
  const resizing = source.replace(".height('100%')\n      .translate", '.height(this.mHeightNumber + this.trYBottom - this.trYTop)\n      .translate');
  assert.notEqual(resizing,source); assert.throws(() => verifyViewport(resizing));
});
console.log(JSON.stringify({upstream:'@ohos/pulltorefresh 2.1.1 f4829f0913472cac588abd3e70d4edf58cf2d34a', outcomes,
  boundary:'Actual upstream-derived methods and installed-SDK layout emission; native arbitration and VM pixels are separate evidence.'}, null, 2));
