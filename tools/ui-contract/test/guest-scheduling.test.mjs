import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { spawnSync } from 'node:child_process';
import { PassThrough } from 'node:stream';
import { test } from 'node:test';
import { guestSchedulingActionWindow, guestSchedulingCase, guestSchedulingClick, guestSchedulingCommands,
  guestSchedulingCoverage, guestSchedulingVmLog,
  observeGuestSchedulingChild } from '../collectors/harmonyos/guest-scheduling.mjs';

const digest = 'a'.repeat(64);
const nonce = '12345678-1234-4123-8123-123456789abc';
const bundle = 'io.reader.minliny';
const readyLine = 'READER_GUEST_TRACE_ARMED 3142\n';
const savedLine = 'READER_GUEST_TRACE_SAVED 3142 9876 ' + digest + '\n';
const exactClick = { op:'click', x:32, y:41 };
const playbackLaunch = { kind:'action', id:'playback-launch', target:'reader-control-tts-transport-toggle' };

function fakeTraceClient() {
  const client = new EventEmitter();
  client.stdout = new PassThrough();
  client.stderr = new PassThrough();
  client.kill = signal => client.emit('close', null, signal);
  return client;
}

test('Guest scheduling is scoped to the Full handoff launch and a finite private guest command', () => {
  const actualCase = { id:guestSchedulingCase };
  assert.equal(guestSchedulingClick(actualCase, playbackLaunch, exactClick), true);
  assert.equal(guestSchedulingClick({id:'reading.control-tts-launch-full'}, playbackLaunch, exactClick), false);
  assert.equal(guestSchedulingClick(actualCase, {...playbackLaunch, id:'pause'}, exactClick), false);
  assert.equal(guestSchedulingClick(actualCase, {...playbackLaunch, target:'other'}, exactClick), false);
  assert.equal(guestSchedulingClick(actualCase, playbackLaunch, {op:'longClick'}), false);
  assert.equal(guestSchedulingVmLog('/vm/Mate 90 Pro/Log/Emulator.log', 'Mate 90 Pro'), true);
  assert.equal(guestSchedulingVmLog('/vm/Other/Log/Emulator.log'), false);
  assert.equal(guestSchedulingVmLog('/vm/Mate 90 Pro/Log/Emulator.log', 'Other'), false);

  assert.throws(() => guestSchedulingCommands(nonce + '; other', bundle));
  assert.throws(() => guestSchedulingCommands(nonce, 'other.bundle'));
  const command = guestSchedulingCommands(nonce, bundle);
  const [prefix, script] = command.armArgs;
  assert.equal(prefix, 'shell');
  assert.match(script, /\/bin\/hitrace --trace_clock mono -b 18432 -t 5 -o [^\n]+ sched ace graphic/);
  assert.match(script, /grep -qm 1 "sched_switch:".+armed\.ftrace/);
  assert.doesNotMatch(script, /uitest|uiInput|--trace_finish|killall|pkill/);
  assert.equal(command.cleanupArgs[1], 'rm -f ' + command.remote + ' && rmdir ' + command.remote.split('/').slice(0,-1).join('/'));
  const syntax = spawnSync('/bin/sh', ['-n'], { input:script, encoding:'utf8' });
  assert.equal(syntax.status, 0, syntax.stderr);
});

test('Guest scheduling readiness arrives before completion and finish must match the same Reader PID', async () => {
  const client = fakeTraceClient();
  const capture = observeGuestSchedulingChild(client);
  let armed = false;
  void capture.armed.then(() => { armed = true; });
  client.stdout.write(readyLine.slice(0, 24));
  await Promise.resolve();
  assert.equal(armed, false);
  client.stdout.write(readyLine.slice(24));
  assert.equal((await capture.armed).readerPid, 3142);
  client.stdout.write(savedLine);
  client.emit('close', 0, null);
  const result = await capture.completed;
  assert.equal(result.captured, true);
  assert.deepEqual(result.savedFile, { readerPid:3142, bytes:9876, sha256:digest });

  for (const finish of [
    { line:savedLine.replace('3142','3143'), code:0, signal:null },
    { line:savedLine, code:1, signal:null },
    { line:'', code:null, signal:'SIGTERM' },
    { line:savedLine, code:0, signal:null, stderr:'unexpected diagnostic' },
  ]) {
    const badClient = fakeTraceClient();
    const badCapture = observeGuestSchedulingChild(badClient);
    badClient.stdout.write(readyLine);
    assert.equal((await badCapture.armed).readerPid, 3142);
    badClient.stdout.write(finish.line);
    if (finish.stderr) badClient.stderr.write(finish.stderr);
    badClient.emit('close', finish.code, finish.signal);
    assert.equal((await badCapture.completed).captured, false);
  }
});

test('Guest scheduling never admits an unproved, delayed, or overlong arm message', async () => {
  for (const output of ['', readyLine.trimEnd(), readyLine + savedLine,
    'READER_GUEST_TRACE_ARMED 0\n', 'x'.repeat(2049)]) {
    const client = fakeTraceClient();
    const capture = observeGuestSchedulingChild(client);
    if (output) client.stdout.write(output);
    client.emit('close', 0, null);
    assert.equal(await capture.armed, undefined);
    assert.equal((await capture.completed).captured, false);
  }
});

test('Guest scheduling binds frame blocks to one Full launch in the same reading instance', () => {
  const frame = { index:0, frameTimeNs:123400000 };
  const effect = (phase, facts, readingId = 'reading-2') => ({kind:'reading.control-effect',
    payload:{kind:'capsule-launch', phase, readingId, facts}});
  const admission = effect('admitted', { type:'tts', source:{module:'tts',form:'full'}, generation:3, startTimeMs:123 });
  const final = { generation:3, blockIndex:0, blockCount:1, finalBlock:true, droppedSamples:0,
    endReason:'visual-settled', frames:[frame] };
  const lastBlock = effect('frame-block', final);
  assert.deepEqual(guestSchedulingActionWindow([admission,lastBlock]), {startTimeMs:123,frames:[frame]});
  for (const unrelated of [[admission, admission, lastBlock],
    [admission, effect('frame-block', final, 'reading-1')],
    [admission, effect('frame-block', {...final, droppedSamples:1})]]) {
    assert.deepEqual(guestSchedulingActionWindow(unrelated), {frames:[]});
  }
});

test('Guest scheduling distinguishes complete matching trace coverage from a late or unrelated capture', () => {
  const firstPts = 1003000000;
  const lastPts = 1018000000;
  const frames = [
    { index:0, frameTimeNs:firstPts, captureStartMs:1004, captureEndMs:1005 },
    { index:1, frameTimeNs:lastPts, captureStartMs:1019, captureEndMs:1020 },
  ];
  const line = (tid, cpu, ms, kind, description) =>
    `task-${tid} (${tid}) [00${cpu}] .... ${(ms/1000).toFixed(6)}: ${kind}: ${description}`;
  const marks = (pts, ms) => [
    line(200, 1, ms, 'tracing_mark_write', `B|200|H:SendVsyncTo conn: WM_3142, now:${pts}, refreshRate:0`),
    line(3142, 0, ms+0.1, 'tracing_mark_write', `B|3142|H:ReceiveVsync name:WM_3142 dataCount: 24bytes now:${pts} expectedEnd: 0`),
  ];
  const events = [
    line(1, 2, 990, 'sched_switch', 'prev_pid=1 next_pid=2'),
    line(1, 3, 1001, 'sched_switch', 'prev_pid=1 next_pid=3142'),
    ...marks(firstPts, 1003),
    ...marks(lastPts, 1018),
    line(1, 2, 1025, 'sched_switch', 'prev_pid=2 next_pid=3'),
  ];
  const trace = '# entries-in-buffer/entries-written: 7/7   #P:4\n' + events.join('\n');
  const covered = guestSchedulingCoverage(trace, 3142, 1000, frames);
  assert.equal(covered.status, 'COVERED');
  assert.equal(covered.clockMatches, 2);
  assert.equal(guestSchedulingCoverage(trace, 3143, 1000, frames).status, 'ACTION_OUTSIDE_TRACE');
  assert.equal(guestSchedulingCoverage(trace, 3142, 900, frames).status, 'ACTION_OUTSIDE_TRACE');
  assert.equal(guestSchedulingCoverage(trace, 3142, 1000,
    [frames[0], {...frames[1],captureEndMs:1050}]).status, 'ACTION_OUTSIDE_TRACE');
  assert.equal(guestSchedulingCoverage(trace.replace('7/7', '7/8'), 3142, 1000, frames).status, 'INCOMPLETE_KERNEL_RING');
  assert.equal(guestSchedulingCoverage(trace, 3142, 1000, frames.slice(0,1)).status, 'NO_ACTION_FRAME_WINDOW');
});
