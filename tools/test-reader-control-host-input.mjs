import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions={
 'portable-protocol':{description:'Actual ordinary Host input/backdrop methods and queued preparation priority',resources:[]},
 'sdk-members':{description:'Required SDK V1 transform and dropped-getter negative reproduction',resources:[]}
};
const selected=selectContractCases(definitions);
async function runCase(selectedCase){
const { resolveEtsLoaderRoot, virtualFilePath }=await import('./lib/tool-environment.mjs');
const {default:assert}=await import('node:assert/strict');
const { existsSync, readFileSync }=await import('node:fs');
const { createRequire, stripTypeScriptTypes }=await import('node:module');
const hostPolicy=await import('../entry/src/main/ets/features/reading/ReaderControlHostSession.ts');
const sessionPolicy=await import('../entry/src/main/ets/features/reading/ReaderControlSessionState.ts');
const rapidPolicy=await import('../entry/src/main/ets/features/reading/ReaderRapidPageTurnState.ts');
const backdropPolicy=await import('../entry/src/main/ets/features/reading/ReaderControlBackdropTouch.ts');

const source = readFileSync(new URL(
  '../entry/src/main/ets/features/reading/LocalReadingExperience.ets', import.meta.url), 'utf8');
const methodNames = ['controlVisible', 'controlShellExitArmed', 'controlPage',
  'controlMotionSession', 'controlMotionVisible', 'controlMotionPage',
  'isReaderPageInteractionEnabled', 'requestPageTurn', 'canTurnPage', 'onControlBackdropTouch',
  'isControlInputEnabled'];
function method(name) {
  const start = source.indexOf(`  private ${name}(`);
  assert.ok(start >= 0, `ordinary production ${name} method exists`);
  const open = source.indexOf('{', start);
  let depth = 1;
  let end = open + 1;
  while (depth > 0 && end < source.length) {
    if (source[end] === '{') depth++;
    if (source[end] === '}') depth--;
    end++;
  }
  assert.equal(depth, 0, `production ${name} extraction ends`);
  return source.slice(start, end);
}
const methods = methodNames.map(method).join('\n');
let monotonicMs = 1000;
const deps = { ...hostPolicy, ...sessionPolicy, ...rapidPolicy, ...backdropPolicy,
  TouchType: { Down: 0, Up: 1, Move: 2, Cancel: 3 },
  readerMotionNowMs: () => monotonicMs,
  Date: { now() { throw Error("backdrop duration must not use calendar time"); } },
  ViewPU: class { finalizeConstruction() {} },
};
function executeClass(code) {
  return new Function(...Object.keys(deps), `${stripTypeScriptTypes(code)}\nreturn ReaderControlInputProbe;`)(
    ...Object.values(deps));
}
const Host = executeClass(`class ReaderControlInputProbe { ${methods} }`);
const hidden = () => sessionPolicy.createReaderControlSessionState();
const home = () => sessionPolicy.openReaderControlSession(hidden(), 0);
const quick = () => sessionPolicy.enterReaderControlModule(home(), 'directory', 0);
function owner(HostClass = Host, session = home()) {
  const host = new HostClass();
  Object.assign(host, {
    readerSettingsSnapshot: { navigationMode: 'paged' }, knownPageTurnBoundary: () => undefined,
    mounted: true, exitRequested: false, appForeground: true, windowChromeActive: true,
    interactionBlocked: false, controlObscured: false, phase: 'ready', visiblePage: {}, chapter: {},
    visiblePageSelectionToken: 1, chapterSelectionToken: 1, materializedChapterSelectionToken: 1,
    controlSession: session, latestControlVisualSession: sessionPolicy.copyReaderControlSessionState(session),
    rapidPageTurnState: rapidPolicy.createReaderRapidPageTurnState(),
    controlBackdropState: backdropPolicy.createReaderControlBackdropTouchState(),
    controlBackdropGeometryReady: true, controlInputRevision: 0,
    controlBackdropRegions: [{ x: 0, y: 500, width: 364, height: 236 }],
    drainPageCalls: 0, dismissCalls: 0,
    drainRapidPageTurn() { this.drainPageCalls++; return { kind: 'busy' }; },
    hideControl() { this.dismissCalls++;
      this.controlSession = sessionPolicy.dismissReaderControlSession(this.controlSession, 360); },
  });
  return host;
}
function checkInputGate(HostClass) {
  const collapsing = sessionPolicy.dismissReaderControlSession(quick(), 360);
  for (const state of [home(), quick(), sessionPolicy.expandReaderControlSession(quick(), 0),
    sessionPolicy.openReaderControlSession(hidden(), 420), collapsing,
    sessionPolicy.holdReaderControlSession(collapsing, 7)]) {
    const host = owner(HostClass, state);
    assert.equal(host.isReaderPageInteractionEnabled(), false, 'visible/transition/held control owns reading input');
    assert.equal(host.canTurnPage(), false, 'the final page-change barrier also rejects control input');
    for (const direction of ['previous', 'next']) {
      assert.deepEqual(host.requestPageTurn(direction), { kind: 'blocked', reason: 'control' });
    }
    assert.equal(host.drainPageCalls, 0, 'a control tap cannot enqueue/drain a page turn');
    assert.equal(host.rapidPageTurnState.pendingDelta, 0);
  }
  const reading = owner(HostClass, hidden());
  assert.equal(reading.isReaderPageInteractionEnabled(), true, 'normal reader remains interactive');
  assert.equal(reading.canTurnPage(), true);
  assert.deepEqual(reading.requestPageTurn('previous'), { kind: 'busy' });
  assert.equal(reading.drainPageCalls, 1);
  assert.equal(reading.rapidPageTurnState.pendingDelta, -1, 'normal page intent is retained');
  const priority = owner(HostClass, hidden());
  Object.assign(priority, {activePagePointerId:-1, pendingPointerSegmentReserved:false,
    preferredPageTextureDirection:'next', pageTurnPreparationQueue:['next','previous']});
  priority.requestPageTurn('previous');
  assert.equal(priority.preferredPageTextureDirection, 'previous');
  assert.deepEqual(priority.pageTurnPreparationQueue, ['previous','next']);
  priority.requestPageTurn('previous'); priority.requestPageTurn('next');
  assert.equal(priority.preferredPageTextureDirection, 'previous', 'opposing tap reduces net target without stealing its direction');
  priority.activePagePointerId = 7; priority.requestPageTurn('next'); priority.requestPageTurn('next');
  assert.equal(priority.preferredPageTextureDirection, 'previous', 'queued producer never changes held finger preparation priority');

}
function touch(type, x, y, pointerId = 1) {
  const pointer = { id: pointerId, windowX: x, windowY: y };
  return { type, changedTouches: [pointer], touches: type === deps.TouchType.Up ? [] : [pointer] };
}
function checkBackdrop(HostClass) {
  const host = owner(HostClass);
  host.onControlBackdropTouch(touch(deps.TouchType.Down, 50, 550));
  host.onControlBackdropTouch(touch(deps.TouchType.Up, 50, 550));
  assert.equal(host.dismissCalls, 0, 'controls inside measured Dock cannot become a backdrop click');
  assert.deepEqual(host.requestPageTurn('previous'), { kind: 'blocked', reason: 'control' });
  host.onControlBackdropTouch(touch(deps.TouchType.Down, 50, 100));
  host.onControlBackdropTouch(touch(deps.TouchType.Up, 50, 100));
  assert.equal(host.dismissCalls, 1, 'a legitimate reading-background tap closes the control');
  assert.equal(host.drainPageCalls, 0, 'background closure itself cannot turn a page');
  assert.equal(host.controlShellExitArmed(), true);
  assert.deepEqual(host.requestPageTurn('previous'), { kind: 'blocked', reason: 'control' },
    'closing still excludes reader input until close commits');
  const held = owner(HostClass);
  held.onControlBackdropTouch(touch(deps.TouchType.Down, 50, 100));
  monotonicMs += 6000;
  held.onControlBackdropTouch(touch(deps.TouchType.Up, 50, 100));
  assert.equal(held.dismissCalls, 0, 'long stationary backdrop hold cannot close controls');
  const noDown = owner(HostClass);
  noDown.onControlBackdropTouch(touch(deps.TouchType.Up, 50, 100));
  assert.equal(noDown.dismissCalls, 0, 'an orphan UP cannot close controls');
}

if(selectedCase==='portable-protocol'){checkInputGate(Host);checkBackdrop(Host);}
// Optional, read-only SDK member transformation. No Hvigor/HAP is built and no
// device is touched. Portable gates above still run on machines without SDK.
// We intentionally omit build(): this tests component-member preservation only,
// and accepts only the expected "missing build" diagnostic from the SDK.
if(selectedCase==='sdk-members'){
const sdk = resolveEtsLoaderRoot();
assert.ok(existsSync(`${sdk}/lib/process_component_class.js`),'selected SDK member case requires installed ETS loader');
{
  const require = createRequire(import.meta.url);
  const ts = require(`${sdk}/node_modules/typescript`);
  const compiler = require(`${sdk}/lib/process_component_class.js`);
  const utils = require(`${sdk}/lib/utils.js`);
  const main = require(`${sdk}/main.js`);
  main.partialUpdateConfig.partialUpdateMode = true;
  function compileMembers(componentMethods) {
    utils.storedFileInfo.setCurrentArkTsFile();
    const file = ts.createSourceFile(virtualFilePath('ReaderControlInputProbe.ets'),
      `@Component struct ReaderControlInputProbe { ${componentMethods} }`,
      ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS,require(`${sdk}/lib/ets_checker.js`).compilerOptions);
    const diagnostics = [];
    let output;
    const result = ts.transform(file, [context => node => {
      output = compiler.processComponentClass(node.statements[0], context, diagnostics, false);
      return node;
    }]);
    result.dispose();
    assert.ok(diagnostics.every(item => item.code === '10905103'),
      `only the intentional missing-build diagnostic is allowed: ${JSON.stringify(diagnostics)}`);
    return ts.createPrinter().printNode(ts.EmitHint.Unspecified, output, file);
  }
  const compiled = compileMembers(methods);
  const compiledHost = executeClass(compiled);
  checkInputGate(compiledHost);
  checkBackdrop(compiledHost);
  const legacyMethods = methods
    .replace(/private (controlVisible|controlPage|controlShellExitArmed)\(/g, 'private get $1(')
    .replace(/this\.(controlVisible|controlPage|controlShellExitArmed)\(\)/g, 'this.$1');
  const legacyOutput = compileMembers(legacyMethods);
  const LegacyHost = executeClass(legacyOutput);
  const legacy = owner(LegacyHost);
  assert.equal(legacy.controlVisible, undefined, 'SDK actually omits the handwritten getter');
  assert.equal(legacy.isReaderPageInteractionEnabled(), true,
    'reproduces the incorrect enabled reader while the control session is home');
  assert.deepEqual(legacy.requestPageTurn('previous'), { kind: 'busy' },
    'reproduces the exact missing control gate on the SDK-transformed Host');
  assert.equal(legacy.rapidPageTurnState.pendingDelta, -1, 'legacy compiled control tap enqueues previous page');
  console.log('Reader control Host: actual SDK V1 member transform reproduces dropped accessor; ordinary-method input/backdrop gates PASS');
}
}
console.log('Reader control Host input: actual production methods PASS (not device hit-testing/visual acceptance)');

}
for(const id of selected){await runCase(id);recordContractCasePass(id);}
