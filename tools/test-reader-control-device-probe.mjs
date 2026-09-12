import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { EventEmitter } from 'node:events';
import { createHash, randomUUID } from 'node:crypto';
import { basename, isAbsolute, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

// Execute the actual production runtime closures against an in-memory HDC
// transport. No HDC, device, lock, executable or filesystem writes occur.
const source = readFileSync(new URL('./reader-control-device-probe.mjs', import.meta.url), 'utf8');
const guardStart = source.indexOf('const fatalOutput = ');
const guardEnd = source.indexOf('const targetReference = ', guardStart);
assert.ok(guardStart >= 0 && guardEnd > guardStart, 'actual production command guard boundaries');
const guard = new Function(`${source.slice(guardStart, guardEnd)}; return { fatalOutput, commandOK };`)();
const assessStart = source.indexOf('    const assess = (args, result, startedAt, elapsedMs) => {');
const assessEnd = source.indexOf('    const run = plan => {', assessStart);
assert.ok(assessStart >= 0 && assessEnd > assessStart, 'actual production assessment closure boundaries');
const guardRecords = [];
const assessActual = new Function('record', 'redact', 'commandOK', 'fail',
  `${source.slice(assessStart, assessEnd)}; return assess;`)(event => guardRecords.push(event), String,
    guard.commandOK, message => { throw new Error(message); });
for (const message of [
  'Error loading shared library libark_jsruntime.so: (needed by /system/lib64/platformsdk/libace_napi.z.so)',
  'Error relocating /system/lib64/platformsdk/libace_napi.z.so: missing_symbol: symbol not found',
]) {
  for (const channel of ['stdout', 'stderr']) {
    const result = { status: 0, stdout: '', stderr: '', [channel]: message };
    assert.equal(guard.commandOK(result), false, 'loader failure cannot be green just because HDC returned zero');
    assert.throws(() => assessActual(['shell', 'reviewed-elf', '--dry-run'], result, 'test-only', 1),
      /device command failed or stop-condition/, 'actual assessment closure stops before any follow-up command');
    assert.equal(guardRecords.at(-1).ok, false);
    assert.equal(guardRecords.at(-1).status, 0, 'original HDC status remains in the failure receipt');
    assert.equal(guardRecords.at(-1)[channel], message, 'raw loader error retained');
  }
}
const start = source.indexOf('    const touchTickets = new Map();');
const end = source.indexOf('    const sampledDrag = async plan => {', start);
assert.ok(start >= 0 && end > start, 'exact production touch runtime boundaries');
const runtime = source.slice(start, end);
const id = '12345678-1234-4123-8123-123456789abc';
const artifact = name => ({ name, remotePath: `/data/local/tmp/reader-control-input-${id}/${name}`, sha256: name });
const makeTicket = () => ({ id, width: 1320, height: 2856, display: 0, steps: 2, dryRunPassed: false,
  artifacts: [artifact('reader-control-touch-sequence'), artifact('reviewed.plan')] });
const elf = Buffer.alloc(64);
elf.write('7f454c46', 0, 'hex'); elf[4] = 2; elf[5] = 1; elf.writeUInt16LE(183, 18);
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

function fixture({ denied = false, missingRevoke = false, mismatch = false, mkdirCollision = false } = {}) {
  const events = [], commands = [], timers = [];
  const staged = new Map();
  let executionCount = 0;
  const options = { outputDir: '/virtual/evidence', hdc: '/mock/no-device/hdc' };
  const fail = message => { throw new Error(message); };
  const commandOK = guard.commandOK;
  const record = event => events.push({ at: performance.now(), ...event });
  const run = plan => {
    commands.push(plan);
    if (mkdirCollision && plan.args[1] === 'mkdir') throw new Error('exclusive mkdir collision');
    if (plan.artifactSha256 && mismatch) throw new Error('remote touch artifact SHA mismatch; no execution');
    if (plan.args.includes('--dry-run')) return { status: 0, stdout: JSON.stringify({ event: 'validated-plan',
      dryRun: true, steps: 2, width: 1320, height: 2856, display: 0 }) };
    return { status: 0, stdout: '' };
  };
  const spawn = (_binary, args, options) => {
    assert.equal(options.shell, false);
    assert.equal(args.at(-2), '<', 'only fixed stdin redirection joins tool-owned paths');
    assert.ok(args.includes('--request-authorization'));
    executionCount++;
    const child = new EventEmitter();
    child.stdout = new EventEmitter(); child.stderr = new EventEmitter();
    let closed = false;
    const close = (code, signal = null) => {
      if (closed) return; closed = true;
      child.emit('close', code, signal);
    };
    child.kill = signal => { timers.forEach(clearTimeout); queueMicrotask(() => close(4, signal)); };
    const emit = event => child.stdout.emit('data', Buffer.from(`${JSON.stringify(event)}\n`));
    timers.push(setTimeout(() => emit({ event: 'request-authorization', code: denied ? 201 : 0 }), 2));
    if (denied) {
      timers.push(setTimeout(() => close(3), 8));
    } else {
      timers.push(setTimeout(() => {
        emit({ event: 'touch', index: 0, action: 'DOWN', code: 0, scheduledMs: 0, actualMs: .25 });
      }, 25));
      timers.push(setTimeout(() => {
        emit({ event: 'touch', index: 1, action: 'UP', code: 0, scheduledMs: 5, actualMs: 5.25 });
        if (!missingRevoke) emit({ event: 'authorization', phase: 'after-revoke', code: 0, status: 0 });
        emit({ event: 'complete', result: 0 });
        close(0);
      }, 40));
    }
    return child;
  };
  const deps = { options, record, run, spawn, resolve, randomUUID, delay, fail, commandOK,
    sha256, lstatSync: () => ({ isFile: () => true, isSymbolicLink: () => false, size: elf.length }),
    readFileSync: () => Buffer.from(elf),
    writeFileSync: (path, bytes, options) => { assert.equal(options.flag, 'wx'); assert.ok(!staged.has(path)); staged.set(path, Buffer.from(bytes)); },
    prefix: ['-p', '-s', '127.0.0.1:8710', '-t', 'mock-only'],
    TIMEOUT_MS: 30000, MAX_OUTPUT: 4 * 1024 * 1024, fatalOutput: guard.fatalOutput,
    operationPlan: operation => ({ args: ['mock', operation.op, operation.path] }),
    assess: (_args, result) => { if (!commandOK(result)) fail('device command failed'); } };
  const create = new Function('deps', `const { ${Object.keys(deps).join(',')} } = deps;
    let activeChild, stopping = false, frameIndex = 0;
    const frameRunNonce = 'mock-frames';
    const abort = new AbortController();
    const stop = () => { stopping = true; abort.abort(); activeChild?.kill('SIGTERM'); };
    ${runtime}
    return { touchTickets, prepareTouchSequence, dryRunTouchSequence, sampledTouchSequence, touchInvocation };`);
  const actual = create(deps);
  actual.touchTickets.set(id, makeTicket());
  return { ...actual, events, commands, executions: () => executionCount };
}

// Runtime internals receive gateway-validated metadata. Use a synthetic ELF
// with its real SHA here; the separate production self-test tests the reviewed
// binary pin at operationPlan, not an unreviewed public execution interface.
const prepare = { elfPath: '/virtual/reader-control-touch-sequence', elfSha256: sha256(elf),
  width: 1320, height: 2856, display: 0, planText: '0 DOWN 0 100 200\n100 UP 0 100 200\n' };
const prepared = fixture();
prepared.prepareTouchSequence(prepare);
const receipt = prepared.events.find(event => event.event === 'touch-prepared');
assert.ok(receipt);
assert.equal(prepared.commands[0].args[1], 'mkdir');
assert.equal(prepared.commands[0].args.length, 3, 'exclusive mkdir never uses -p');
assert.equal(prepared.commands.filter(command => command.args[0] === 'file' && command.args[1] === 'send').length, 2);
assert.equal(prepared.commands.filter(command => command.artifactSha256).length, 2);
assert.equal(prepared.commands.at(-1).args[1], 'chmod', 'only after both remote byte identities were checked');
assert.equal(prepared.commands.at(-1).args[3], receipt.artifacts[0].remotePath);
assert.equal(prepared.executions(), 0, 'preparation never executes a helper or requests authorization');
const collision = fixture({ mkdirCollision: true });
assert.throws(() => collision.prepareTouchSequence(prepare), /mkdir collision/);
assert.equal(collision.commands.length, 1, 'existing namespace aborts before send/chmod/execute');
assert.ok(!collision.events.some(event => event.event === 'touch-prepared'));
const wrongLocal = fixture();
assert.throws(() => wrongLocal.prepareTouchSequence({ ...prepare, elfSha256: '0'.repeat(64) }), /ELF identity/);
assert.equal(wrongLocal.commands.length, 0, 'local bytes checked before any remote command');
const wrongRemote = fixture({ mismatch: true });
assert.throws(() => wrongRemote.prepareTouchSequence(prepare), /SHA mismatch/);
assert.ok(!wrongRemote.commands.some(command => command.args[1] === 'chmod'));

const f = fixture();
await assert.rejects(f.sampledTouchSequence({ ticket: 'not-owned', sampleDelaysMs: [0] }), /not owned/);
assert.equal(f.commands.length, 0, 'unknown ticket cannot touch any remote path');
await assert.rejects(f.sampledTouchSequence({ ticket: id, sampleDelaysMs: [0] }), /dry-run/);
assert.equal(f.executions(), 0);
f.commands.length = 0;
f.dryRunTouchSequence({ ticket: id });
assert.equal(f.touchTickets.get(id).dryRunPassed, true);
assert.equal(f.commands.filter(command => command.artifactSha256).length, 2);
assert.ok(f.commands.at(-1).args.includes('--dry-run'));
assert.ok(!f.commands.at(-1).args.includes('--request-authorization'));
f.commands.length = 0;
await f.sampledTouchSequence({ ticket: id, sampleDelaysMs: [0, 2] });
assert.equal(f.executions(), 1);
const checks = f.commands.filter(command => command.artifactSha256);
assert.equal(checks.length, 2, 'execution rechecks both remote artifacts despite dry-run success');
assert.notEqual(checks[0].localPath, checks[1].localPath);
const origin = f.events.find(event => event.event === 'touch-sampling-origin');
const admitted = f.events.find(event => event.event === 'touch-execute-admitted');
assert.ok(origin.at - admitted.at >= 15, 'authorization wait precedes the DOWN-based origin');
assert.equal(origin.nativeActualMs, .25);
const samples = f.events.filter(event => event.event === 'sample-trigger');
assert.equal(samples.length, 2);
assert.ok(samples.every(sample => sample.at >= origin.at));
assert.equal(f.commands.filter(command => command.args[1] === 'screenCap').length, 2);
assert.ok(f.events.some(event => event.event === 'touch-execute-completed'));

const denied = fixture({ denied: true });
denied.dryRunTouchSequence({ ticket: id });
await assert.rejects(denied.sampledTouchSequence({ ticket: id, sampleDelaysMs: [0] }), /device command failed/);
assert.equal(denied.events.filter(event => event.event === 'sample-trigger').length, 0,
  'authorization failure without DOWN cannot start gesture captures');
assert.ok(denied.events.some(event => event.native?.code === 201), 'authorization failure return code retained');

const changed = fixture({ mismatch: true });
changed.touchTickets.get(id).dryRunPassed = true;
await assert.rejects(changed.sampledTouchSequence({ ticket: id, sampleDelaysMs: [0] }), /SHA mismatch/);
assert.equal(changed.executions(), 0, 'changed remote artifact cannot reach native execute');

const noRevoke = fixture({ missingRevoke: true });
noRevoke.dryRunTouchSequence({ ticket: id });
await assert.rejects(noRevoke.sampledTouchSequence({ ticket: id, sampleDelaysMs: [0] }), /revoked authorization receipt/);
assert.ok(!noRevoke.events.some(event => event.event === 'touch-execute-completed'));

// The new operations must execute the same real production sampler, not a
// second timing engine. Transport/captures here are in-memory command records.
const planStart = source.indexOf('const BUNDLE = ');
const planEnd = source.indexOf('function ownerMatches(');
assert.ok(planStart >= 0 && planEnd > planStart);
const actualPlan = new Function('basename', 'isAbsolute', 'resolve',
  `${source.slice(planStart, planEnd)}; return operationPlan;`)(basename, isAbsolute, resolve);
const samplerStart = source.indexOf('    const sampledDrag = async plan => {');
const samplerEnd = source.indexOf("    record({ event: 'ready'", samplerStart);
assert.ok(samplerStart >= 0 && samplerEnd > samplerStart);
assert.match(source, /\['sampledDrag', 'sampledClick', 'sampledHeldTouch'\]\.includes\(plan.kind\)\) await sampledDrag\(plan\)/,
  'dispatcher routes all three validated operations to the real shared sampler');
async function runSampler(operation, loaderError = false) {
  const events = [], calls = [];
  const dependencies = {
    options: { hdc: '/mock/no-device/hdc', outputDir: '/virtual/evidence' }, prefix: [],
    TIMEOUT_MS: 30000, MAX_OUTPUT: 4 * 1024 * 1024,
    fatalOutput: guard.fatalOutput, commandOK: guard.commandOK, delay,
    fail: message => { throw new Error(message); },
    operationPlan: actualPlan, evidenceEntryExists: () => false,
    record: event => events.push(event), run: plan => calls.push(plan.args),
    assess: (_args, result) => {
      events.push({ event: 'assessment', result });
      assert.ok(guard.commandOK(result), 'real sampler must stop on HDC-zero loader error');
    },
    spawn: (_hdc, args, options) => {
      assert.equal(options.shell, false); calls.push(args);
      const child = new EventEmitter(); child.stdout = new EventEmitter(); child.stderr = new EventEmitter();
      child.kill = () => {};
      setTimeout(() => {
        if (loaderError) child.stdout.emit('data', Buffer.from('Error relocating test.so: symbol not found'));
        child.emit('close', 0, null);
      }, 0);
      return child;
    },
  };
  const run = new Function('deps', `const { ${Object.keys(dependencies).join(',')} } = deps;
    let activeChild, stopping = false, frameIndex = 0;
    const frameRunNonce = 'mock-sampling'; const abort = new AbortController();
    const stop = () => { stopping = true; abort.abort(); activeChild?.kill('SIGTERM'); };
    ${source.slice(samplerStart, samplerEnd)}
    return sampledDrag;`)(dependencies);
  const plan = actualPlan({ preflightConfirmed: true, ...operation }, '/virtual/evidence');
  if (loaderError) {
    await assert.rejects(run(plan), /HDC-zero loader error/);
    assert.equal(events.filter(event => event.event === 'sample-trigger').length, 0);
  } else {
    await run(plan);
    assert.equal(events.filter(event => event.event === 'sample-trigger').length, 2);
    assert.equal(calls.filter(args => args[0] === 'shell' && args[2] === 'screenCap').length, 2);
    assert.equal(calls.filter(args => args[0] === 'file' && args[1] === 'recv').length, 2);
  }
  assert.deepEqual(calls[0], plan.args, 'spawn receives the exact whitelist argv, not caller shell text');
}
await runSampler({ op: 'sampledClick', x: 100, y: 200, sampleDelaysMs: [0, 2] });
await runSampler({ op: 'heldTouch', x: 100, y: 200, durationMs: 500, sampleDelaysMs: [0, 2] });
await runSampler({ op: 'sampledClick', x: 100, y: 200, sampleDelaysMs: [0, 2] }, true);
console.log('Device probe actual runtime closures: ticket/dry-run/SHA/auth-denial/DOWN-based sampling/revocation PASS (mock transport only; no HDC/device/filesystem writes).');
