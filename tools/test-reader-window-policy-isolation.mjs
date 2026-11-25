import assert from 'node:assert/strict';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';
import { createWindowCoordinatorFixture } from './lib/reader-window-coordinator-fixture.mjs';

const definitions = {
  'install': 'A failed optional native startup write preserves initial metrics, live listeners and the remaining writes',
  'policy': 'Distinct rejected, acknowledged and unsupported window steps retain serial ownership through reader and app policies',
  'superseded': 'A stale native completion cannot advance an older window install or policy revision',
};

async function install(f) {
  const win = f.windowPort();
  const calls = [], initial = [];
  win.setWindowLayoutFullScreen = () => {
    calls.push('layout');
    initial.push(f.C.metrics().windowRect.width, win.events.has('avoidAreaChange'));
    throw new Error('layout failed');
  };
  win.setWindowSystemBarEnable = async () => {
    calls.push('visibility');
    throw { code: 801 };
  };
  assert.equal(await f.C.install(win, undefined, 2), true);
  assert.deepEqual(initial, [390, true], 'metrics and listeners are ready before optional writes');
  assert.deepEqual(calls, ['layout', 'visibility']);
  assert.equal(win.orientation, 2, 'explicit app orientation survives independent startup failures');
  assert.equal(win.events.size, 4);
  assert.equal(f.C.metrics().windowRect.width, 390);
  win.rect = { ...win.rect, width: 550 };
  win.events.get('windowSizeChange')({});
  assert.equal(f.C.metrics().windowRect.width, 550, 'the installed window keeps live metrics');
  assert.ok(f.warnings.some(row => row.includes('fullscreen') && row.includes('failed')));
  assert.ok(f.warnings.some(row => row.includes('initial-system-bars') && row.includes('unsupported')));
}

async function policy(f) {
  const win = f.windowPort();
  await f.C.install(win);
  const orientation = win.setPreferredOrientation;
  const setBar = win.setSpecificSystemBarEnabled;
  const orientationFailure = new Error('orientation temporarily denied');
  win.setPreferredOrientation = async () => { throw orientationFailure; };
  win.setSpecificSystemBarEnabled = async (bar, visible, animated) => {
    if (bar === 'status') throw { code: 1300003 };
    return setBar(bar, visible, animated);
  };
  await assert.rejects(f.C.requestReaderWindowPolicy(new f.P('portrait', true, true, true)),
    error => error === orientationFailure);
  assert.equal(win.keepScreenOn, true);
  assert.deepEqual(win.barEnabled, { status: true, navigation: false, navigationIndicator: false });
  assert.equal(f.C.statusBarHiddenApplied, false);
  assert.notEqual(f.C.appliedPolicyRevision, f.C.windowPolicyRevision);

  win.setPreferredOrientation = orientation;
  win.setSpecificSystemBarEnabled = setBar;
  await f.C.requestReaderWindowPolicy(new f.P('portrait', true, true, true));
  assert.equal(win.orientation, 1);
  assert.equal(f.C.statusBarHiddenApplied, true);
  assert.equal(f.C.appliedPolicyRevision, f.C.windowPolicyRevision);

  win.setPreferredOrientation = async () => { throw { code: 801 }; };
  await f.C.requestAppWindowPolicy();
  assert.equal(win.keepScreenOn, false);
  assert.deepEqual(win.barEnabled, { status: true, navigation: true, navigationIndicator: true });
  assert.notEqual(f.C.appliedPolicyRevision, f.C.windowPolicyRevision, 'a limited policy has no complete native ACK');
  const calls = win.calls.length;
  await f.C.requestAppWindowPolicy();
  assert.equal(win.calls.length, calls, 'known unsupported steps do not make equal policy requests loop');

  f.C.isTwoInOneDevice = () => true;
  win.setSpecificSystemBarEnabled = () => assert.fail('2-in-1 must not attempt the unsupported platform API');
  win.setPreferredOrientation = () => assert.fail('2-in-1 must not request unsupported rotation');
  const priorWarnings = f.warnings.length;
  await f.C.requestReaderWindowPolicy(new f.P('landscape', true, true, true));
  assert.equal(win.keepScreenOn, true);
  assert.equal(f.C.statusBarHiddenApplied, false);
  assert.notEqual(f.C.appliedPolicyRevision, f.C.windowPolicyRevision);
  assert.ok(f.warnings.slice(priorWarnings).some(row => row.includes('2in1')));
}

function deferred() {
  let resolve;
  const promise = new Promise(complete => { resolve = complete; });
  return { promise, resolve };
}

async function superseded(f) {
  const first = f.windowPort();
  const second = f.windowPort();
  const layout = deferred();
  first.setWindowLayoutFullScreen = () => layout.promise;
  first.setWindowSystemBarEnable = () => assert.fail('a retired install cannot write bars');
  const oldInstall = f.C.install(first);
  assert.equal(await f.C.install(second), true);
  layout.resolve();
  assert.equal(await oldInstall, false);
  assert.equal(first.events.size, 0);
  assert.ok(second.events.size > 0);

  const active = deferred();
  const delayed = deferred();
  const orientation = second.setPreferredOrientation;
  second.setPreferredOrientation = async value => {
    if (value === 1) { active.resolve(); await delayed.promise; }
    return orientation(value);
  };
  const stale = f.C.requestReaderWindowPolicy(new f.P('portrait', true, true, true));
  await active.promise;
  const latest = f.C.requestAppWindowPolicy();
  delayed.resolve();
  await Promise.all([stale, latest]);
  assert.equal(second.orientation, 0);
  assert.equal(second.keepScreenOn, false);
  assert.ok(second.calls.every(([step, value, enabled]) =>
    (step !== 'awake' || value === false) && (step !== 'visible' || enabled === true)));

  const retiredSizeListener = second.events.get('windowSizeChange');
  assert.equal(await f.C.install(second), true);
  second.rect = { ...second.rect, width: 430 };
  retiredSizeListener({});
  assert.equal(f.C.metrics().windowRect.width, 390, 'an older install listener cannot publish in a new epoch');
  second.events.get('windowSizeChange')({});
  assert.equal(f.C.metrics().windowRect.width, 430);
}

const cases = { install, policy, superseded };
for (const id of selectContractCases(definitions)) {
  const f = await createWindowCoordinatorFixture();
  try { await cases[id](f); } finally { f.cleanup(); }
  recordContractCasePass(id);
}
