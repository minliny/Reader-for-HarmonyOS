import { basename, dirname } from 'node:path';

export const guestSchedulingCase = 'reading.control-tts-capsule-handoff-full';
const originalVm = 'Mate 90 Pro';
export const guestSchedulingReceipt = 'guest-scheduling.json';
export const guestSchedulingTraceFile = 'guest-scheduling.ftrace';
export const guestSchedulingClientTimeoutMs = 12000;
export const guestSchedulingCloseTimeoutMs = 31000;
const maximumTraceBytes = 64 * 1024 * 1024;

export function guestSchedulingVmLog(path, vmName = originalVm) {
  return typeof path === 'string' && basename(path) === 'Emulator.log' && basename(dirname(path)) === 'Log' &&
    basename(dirname(dirname(path))) === originalVm && vmName === originalVm;
}

export function guestSchedulingLocalTarget(server, target) {
  return server === '127.0.0.1:8710' && /^(?:127\.0\.0\.1|\[::1\]):\d{1,5}$/u.test(target);
}

export function guestSchedulingClick(contract, step, operation) {
  return contract.id === guestSchedulingCase && step.kind === 'action' &&
    step.id === 'playback-launch' && step.target === 'reader-control-tts-transport-toggle' && operation.op === 'click';
}

export function guestSchedulingActionWindow(events) {
  const capsule = events.filter(event => event.kind === 'reading.control-effect' &&
    event.payload.kind === 'capsule-launch');
  const starts = capsule.filter(event => event.payload.phase === 'admitted' &&
    event.payload.facts.type === 'tts' && event.payload.facts.source?.form === 'full' &&
    event.payload.facts.source?.module === 'tts');
  if (starts.length !== 1) return {frames:[]};
  const { readingId, facts:admission } = starts[0].payload;
  const blocks = capsule.filter(event => event.payload.phase === 'frame-block' && event.payload.readingId === readingId &&
    event.payload.facts.generation === admission.generation).map(event => event.payload.facts);
  const final = blocks.at(-1);
  if (final?.finalBlock !== true || final.endReason !== 'visual-settled' || final.blockCount !== blocks.length ||
    !blocks.every((block, index) => block.blockIndex === index && block.droppedSamples === 0 &&
      block.blockCount === blocks.length)) return {frames:[]};
  return {startTimeMs:admission.startTimeMs, frames:blocks.flatMap(block => block.frames)};
}

export function guestSchedulingCommands(nonce, bundle) {
  if (!/^[a-f0-9-]{36}$/u.test(nonce) || bundle !== 'io.reader.minliny') {
    throw new Error('Guest scheduler capture needs a private nonce and the Reader bundle');
  }
  const directory = '/data/local/tmp/reader-control-schedule-' + nonce;
  const remote = directory + '/raw.ftrace';
  const script = [
    'set -eu',
    'umask 077',
    'if pidof hitrace >/dev/null 2>&1; then exit 20; fi',
    'reader=$(pidof ' + bundle + ')',
    'case "$reader" in ""|*[!0-9]*) exit 21 ;; esac',
    'mkdir ' + directory,
    'cd ' + directory,
    'collector=; keep=0',
    'cleanup() {',
    '  if [ -n "$collector" ]; then wait "$collector" || true; fi',
    '  rm -f armed.ftrace trace.log',
    '  if [ "$keep" = 0 ]; then rm -f raw.ftrace; rmdir ' + directory + '; fi',
    '}',
    'trap cleanup EXIT',
    'trap "exit 22" HUP INT TERM',
    'closed=$(/bin/hitrace --trace_dump -o ' + directory + '/armed.ftrace 2>&1) || true',
    'case "$closed" in *"tracing on is closed, no trace can be read"*) ;; *) exit 20 ;; esac',
    'test ! -e armed.ftrace',
    '/bin/hitrace --trace_clock mono -b 18432 -t 5 -o ' + remote + ' sched ace graphic >trace.log 2>&1 &',
    'collector=$!',
    'trace_waiting() {',
    '  [ "$(cat /proc/$collector/comm 2>/dev/null)" = hitrace ] || return 1',
    '  case "$(cat /proc/$collector/wchan 2>/dev/null)" in',
    '    __arm64_sys_nanosleep|poll_schedule_timeout|hrtimer_nanosleep|do_nanosleep) return 0 ;;',
    '    *) return 1 ;;',
    '  esac',
    '}',
    'ready=0; i=0',
    'while [ "$i" -lt 20 ] && [ -d "/proc/$collector" ]; do',
    '  if trace_waiting; then sleep 0.05; if trace_waiting; then ready=1; break; fi; fi',
    '  i=$((i + 1)); sleep 0.05',
    'done',
    'test "$ready" = 1',
    '/bin/hitrace --trace_dump -o ' + directory + '/armed.ftrace >/dev/null 2>&1',
    'test -s armed.ftrace',
    'grep -qm 1 "sched_switch:" armed.ftrace',
    'trace_waiting',
    'test "$(pidof ' + bundle + ')" = "$reader"',
    'printf "READER_GUEST_TRACE_ARMED %s\n" "$reader"',
    'wait "$collector"; collector=',
    'grep -q "TraceFinish done" trace.log',
    'test -s raw.ftrace',
    'test "$(pidof ' + bundle + ')" = "$reader"',
    'bytes=$(stat -c %s raw.ftrace)',
    'test "$bytes" -le ' + maximumTraceBytes,
    'digest=$(sha256sum raw.ftrace)',
    'set -- $digest',
    'keep=1',
    'printf "READER_GUEST_TRACE_SAVED %s %s %s\n" "$reader" "$bytes" "$1"',
  ].join('\n');
  return {
    armArgs: ['shell', script],
    remote,
    cleanupArgs: ['shell', 'rm -f ' + remote + ' && rmdir ' + directory],
  };
}

// The caller supplies the already-leased exact-target HDC client. There is no
// device input in this auxiliary process and it always runs a finite trace.
export function observeGuestSchedulingChild(child) {
  const armed = Promise.withResolvers();
  const completed = Promise.withResolvers();
  let stdout = '';
  let stderr = '';
  let arming;
  let invalid = false;
  const armedLine = /^READER_GUEST_TRACE_ARMED ([1-9]\d{0,8})\r?$/u;
  const savedLine = /^READER_GUEST_TRACE_SAVED ([1-9]\d{0,8}) ([1-9]\d{0,8}) ([a-f0-9]{64})\r?$/u;
  function enforceLimit() {
    if (stdout.length <= 2048 && stderr.length <= 2048) return;
    invalid = true;
    stdout = '';
    stderr = '';
    child.kill('SIGTERM');
  }
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', chunk => {
    if (invalid) return;
    stdout += chunk;
    enforceLimit();
    const firstNewline = stdout.indexOf('\n');
    if (arming || firstNewline === -1) return;
    const match = armedLine.exec(stdout.slice(0, firstNewline));
    if (!match) {
      invalid = true;
      child.kill('SIGTERM');
      return;
    }
    // If stdout already includes the finish marker, the arm was delivered too
    // late to bind a new action to the trace window.
    if (stdout.length > firstNewline + 1 || stderr.trim()) return;
    arming = {readerPid:Number(match[1]), armedAt:new Date().toISOString(), hostArmedMs:performance.now()};
    armed.resolve(arming);
  });
  child.stderr.on('data', chunk => {
    if (invalid) return;
    stderr += chunk;
    enforceLimit();
  });
  child.on('error', () => { invalid = true; });
  child.on('close', (status, signal) => {
    armed.resolve(undefined);
    const lines = stdout.split('\n');
    const [, saved, tail] = lines;
    const match = savedLine.exec(saved ?? '');
    const savedFile = match && Number(match[2]) <= maximumTraceBytes ?
      {readerPid:Number(match[1]), bytes:Number(match[2]), sha256:match[3]} : undefined;
    const captured = !invalid && status === 0 && signal === null && !stderr.trim() && tail === '' &&
      lines.length === 3 && arming !== undefined && savedFile?.readerPid === arming.readerPid;
    completed.resolve({
      arming,
      // Only a well-formed finish marker names an owned file to clean up.
      savedFile,
      captured,
      finishedAt: new Date().toISOString(),
    });
  });
  return {armed:armed.promise, completed:completed.promise};
}

// App frame timestamps share exact VSync payloads with RenderService and
// Reader. Host ARM/dispatch timing alone cannot establish Guest coverage.
export function guestSchedulingCoverage(trace, readerPid, startTimeMs, frames) {
  if (!Number.isSafeInteger(readerPid) || readerPid <= 0 || !Number.isSafeInteger(startTimeMs) ||
    frames.length < 2 || !frames.every((frame, index) =>
      frame.index === index && Number.isSafeInteger(frame.frameTimeNs) &&
      Number.isSafeInteger(frame.captureStartMs) && Number.isSafeInteger(frame.captureEndMs) &&
      frame.captureEndMs >= frame.captureStartMs &&
      (index === 0 || frame.frameTimeNs > frames[index - 1].frameTimeNs))) return { status:'NO_ACTION_FRAME_WINDOW' };

  const ring = /^# entries-in-buffer\/entries-written:\s*(\d+)\/(\d+)\s+#P:(\d+)\r?$/mu.exec(trace);
  if (!ring || ring[1] !== ring[2] || Number(ring[3]) !== 4) return { status:'INCOMPLETE_KERNEL_RING' };
  const firstFrame = frames[0];
  const lastFrame = frames.at(-1);
  const endpoints = new Set([String(firstFrame.frameTimeNs), String(lastFrame.frameTimeNs)]);
  const sent = new Map();
  const received = new Map();
  const cpus = new Set();
  const send = new RegExp(String.raw`^B\|\d+\|H:SendVsyncTo conn: WM_${readerPid}, now:(\d+)\b`, 'u');
  const receive = new RegExp(String.raw`^B\|${readerPid}\|H:ReceiveVsync name:WM_${readerPid} .*?\bnow:(\d+)\b`, 'u');
  const eventLine = /^.*?-(\d+)\s+\(\s*([0-9-]+)\)\s+\[(\d+)\]\s+\S+\s+(\d+\.\d+): (\w+): (.*)$/gmu;
  const scheduledTid = new RegExp(String.raw`\b(?:prev_pid|next_pid)=${readerPid}\b`, 'u');
  let entries = 0;
  let switches = 0;
  let traceStart = Infinity;
  let traceEnd = -Infinity;
  for (const [, tid, tgid, cpu, seconds, kind, payload] of trace.matchAll(eventLine)) {
    entries += 1;
    cpus.add(Number(cpu));
    const timestampMs = Number(seconds) * 1000;
    traceStart = Math.min(traceStart, timestampMs);
    traceEnd = Math.max(traceEnd, timestampMs);
    if (kind === 'sched_switch' && scheduledTid.test(payload) &&
      timestampMs >= startTimeMs && timestampMs <= lastFrame.captureEndMs + 1) switches += 1;
    if (kind !== 'tracing_mark_write') continue;
    const sentPts = send.exec(payload)?.[1];
    if (endpoints.has(sentPts)) sent.set(sentPts, Math.min(sent.get(sentPts) ?? Infinity, timestampMs));
    if (Number(tid) !== readerPid || Number(tgid) !== readerPid) continue;
    const receivedPts = receive.exec(payload)?.[1];
    if (endpoints.has(receivedPts)) received.set(receivedPts, Math.min(received.get(receivedPts) ?? Infinity, timestampMs));
  }
  if (entries !== Number(ring[1]) || cpus.size !== 4) return {status:'INCOMPLETE_KERNEL_RING'};
  const clockMatches = [firstFrame, lastFrame].filter(frame => {
    const pts = String(frame.frameTimeNs);
    return sent.get(pts) <= received.get(pts) && received.get(pts) < frame.captureStartMs + 1;
  }).length;
  const windowCovered = traceStart <= startTimeMs && traceEnd >= lastFrame.captureEndMs + 1 &&
    startTimeMs <= firstFrame.captureStartMs;
  return {
    status:clockMatches === 2 && windowCovered && switches > 0 ? 'COVERED' : 'ACTION_OUTSIDE_TRACE',
    clockMatches, entries, mainThreadSwitches:switches, frames:frames.length,
  };
}
