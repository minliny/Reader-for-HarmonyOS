import assert from 'node:assert/strict';
import test from 'node:test';
import {classifyFocusWindow, prepareUnlockedFocus, requireUnlockedFocus} from '../collectors/harmonyos/run.mjs';
import {focusWindowCommand} from '../collectors/harmonyos/focus-window.mjs';
import {installedCommand, logCommand, requireActionFocus, startCommand, verifyStartupFocus}
  from '../collectors/harmonyos/records.mjs';
import {sha256} from '../../lib/native-ui-evidence.mjs';

const lock = 'SCBScreenLock13  0  5838  16  2110  1  0  2000  0  [ 0 0 1280 2832 ]';
const reader = 'minliny0  0  4515  223  1  1  0  5  0  [ 0 0 1280 2832 ]';
const report = (id, rows = [lock, reader]) => [...rows, `Focus window: ${id}`, 'All Focus window:', `DisplayId: 0 WindowId: ${id}`].join('\n');

test('matches the focused row, not just a resident lock screen window', () => {
  assert.equal(classifyFocusWindow(report(16)), 'LOCKED');
  assert.equal(classifyFocusWindow(report(223)), 'NOT_LOCKED');
});

test('missing, ambiguous or hidden focused windows remain unknown', () => {
  for (const value of ['', report(700), report(16, [lock, lock]), report(16, [lock.replace('1280 2832', '0 0')]),
    report(16, [lock.replace('SCBScreenLock13', 'OtherLock')]), `${report(16)}\nFocus window: 223`]) {
    assert.equal(classifyFocusWindow(value), 'UNKNOWN');
  }
});

test('locked and unknown stop after a read-only focus query', async () => {
  for (const [stdout, reason] of [[report(16), /SCREEN_LOCKED/], ['', /SCREEN_FOCUS_UNKNOWN/], [report(223), null]]) {
    const calls = [];
    const result = requireUnlockedFocus({command: async op => {calls.push(op); return {stdout};}}, 'before-launch');
    if (reason) await assert.rejects(result, reason); else await result;
    assert.deepEqual(calls, [{op:'uiContractFocusWindow'}]);
  }
});

const localVm = {targetKind:'vm', server:'127.0.0.1:8710', target:'127.0.0.1:5555'};
const tryDismiss = (reports, config = localVm) => {
  const calls = [];
  const done = prepareUnlockedFocus({command: async op => {
    calls.push(op);
    return op.op === 'uiContractFocusWindow' ? {stdout:reports.shift()} : {};
  }}, config, async () => {});
  return {calls, done};
};

test('known local VM gets exactly one normal swipe before confirming Reader focus', async () => {
  const {calls, done} = tryDismiss([report(16), report(223)]);
  assert.equal(await done, 'DISMISSED');
  assert.deepEqual(calls.map(x => x.op), ['uiContractFocusWindow', 'swipe', 'uiContractFocusWindow']);
  assert.deepEqual(calls[1], {op:'swipe', fromX:640, toX:640, fromY:2379, toY:765, velocity:1600});
});

test('locked again or unexpected focus is not retried; other targets never get an unlock gesture', async () => {
  const other = reader.replace('minliny0', 'PasswordDialog');
  for (const [end, reason] of [[report(16), /after-one-swipe/], [report(223, [other]), /no confirmed Reader or launcher/]]) {
    const {calls, done} = tryDismiss([report(16), end]);
    await assert.rejects(done, reason);
    assert.equal(calls.filter(x => x.op === 'swipe').length, 1);
  }
  for (const config of [{...localVm, targetKind:'physical'}, {...localVm, server:'192.168.1.10:8710'}]) {
    const {calls, done} = tryDismiss([report(16)], config);
    await assert.rejects(done, /SCREEN_LOCKED/);
    assert.deepEqual(calls, [{op:'uiContractFocusWindow'}]);
  }
  const {calls, done} = tryDismiss([report(223)]);
  assert.equal(await done, 'ALREADY_UNLOCKED');
  assert.deepEqual(calls, [{op:'uiContractFocusWindow'}]);
});

const command = (args, stdout = '') => ({event:'command', ok:true, args, stdout});
const candidate = {targetKind:'vm', hdcServer:localVm.server, targetRef:sha256(localVm.target).slice(0,12)};
const swipeArgs = ['shell','uitest','uiInput','swipe','640','2379','640','765','1600'];

function startup({guards = [], afterLaunch} = {}) {
  const guarded = afterLaunch !== undefined;
  const baselineLog = 4 + guards.length;
  const entry = {kind:'preflight',readiness:2,installed:3,baselineLog,start:baselineLog+1,
    startFloor:baselineLog+(guarded ? 3 : 2),initialLog:baselineLog+(guarded ? 4 : 3)};
  const records = [{event:'ready'}, {event:'readiness'}, command(installedCommand), ...guards,
    command(logCommand), command(startCommand)];
  if (guarded) records.push(command(focusWindowCommand, afterLaunch));
  records.push(command(logCommand), command(logCommand));
  return {records,entry};
}

test('startup replay admits exact pre- and post-launch focus and the legacy journal order', () => {
  const legacy = startup();
  assert.equal(verifyStartupFocus(legacy.records,legacy.entry,candidate), false);
  const current = startup({guards:[command(focusWindowCommand,report(223))],afterLaunch:report(223)});
  assert.equal(verifyStartupFocus(current.records,current.entry,candidate), true);
  const foreign = startup({guards:[command(['shell','other-command'],report(223))],afterLaunch:report(223)});
  assert.throws(() => verifyStartupFocus(foreign.records,foreign.entry,candidate), /Unexpected command/);
  const locked = startup({guards:[command(focusWindowCommand,report(223))],afterLaunch:report(16)});
  assert.throws(() => verifyStartupFocus(locked.records,locked.entry,candidate), /SCREEN_LOCKED \(after-launch\)/);
  assert.throws(() => verifyStartupFocus(current.records,{...current.entry,startFloor:current.entry.start+1},candidate),
    /Missing ordered boot/);
});

test('startup replay accepts a single matching local VM dismissal and rejects other dispatches', () => {
  const initial = command(focusWindowCommand,report(16));
  const unlocked = command(focusWindowCommand,report(223));
  const current = startup({guards:[initial,command(swipeArgs),unlocked],afterLaunch:report(223)});
  assert.equal(verifyStartupFocus(current.records,current.entry,candidate), true);
  assert.throws(() => verifyStartupFocus(current.records,current.entry,{...candidate,targetKind:'physical'}),
    /admitted local VM/);
  const extra = startup({guards:[initial,command(swipeArgs),command(swipeArgs),unlocked],afterLaunch:report(223)});
  assert.throws(() => verifyStartupFocus(extra.records,extra.entry,candidate), /admitted local VM/);
  const wrong = startup({guards:[initial,command([...swipeArgs.slice(0,-1),'100']),unlocked],afterLaunch:report(223)});
  assert.throws(() => verifyStartupFocus(wrong.records,wrong.entry,candidate), /Unexpected command/);
});

test('action replay consumes exactly the immediate focus check in a guarded journal', () => {
  const records = [command(logCommand),command(focusWindowCommand,report(223)),command(logCommand)];
  assert.equal(requireActionFocus(records,1,true,'open-sources'), 2);
  assert.equal(requireActionFocus(records,1,false,'open-sources'), 1);
  assert.throws(() => requireActionFocus(records,2,true,'open-sources'), /Unexpected command/);
  assert.throws(() => requireActionFocus([records[0],command(focusWindowCommand,report(16))],1,true,'open-sources'),
    /SCREEN_LOCKED \(open-sources\)/);
});
