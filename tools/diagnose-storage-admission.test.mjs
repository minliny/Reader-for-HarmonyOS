import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { parseDiagnosticArgs, validateDiagnosticAuthorization, runDiagnosticCli } from './diagnose-storage-admission.mjs';

const hash = value => createHash('sha256').update(value).digest('hex');
const options = {
  '--run': true, '--target': '127.0.0.1:5555', '--server-key': '127.0.0.1:8710',
  '--hdc': '/synthetic/hdc', '--vm-log': '/synthetic/Emulator.log', '--manifest': '/synthetic/manifest.json',
  '--authorization': '/synthetic/authorization.json', '--output-dir': '/synthetic/output',
};
const binding = { manifestSha256: 'a'.repeat(64), hapSha256: 'b'.repeat(64), hdcSha256: 'c'.repeat(64) };
const now = Date.parse('2026-11-11T06:00:00Z');
function authorization() {
  const targetRef = hash(options['--target']).slice(0, 12);
  return { schema: 'reader.storage-admission-diagnostic-authorization.v1', status: 'AUTHORIZED',
    action: 'READ_ONLY_STORAGE_ADMISSION_DIAGNOSTIC_ONCE', scopeClosed: false,
    approvalReference: 'synthetic-explicit-approval', bundleName: 'io.reader.minliny',
    targetRef, serverRef: hash(options['--server-key']).slice(0, 12), ...binding,
    incumbent: { uid: 20020064, appBuildId: '0.2.0.DEV.0123456789ab', appIdSha256: 'd'.repeat(64), updateTime: 1794301959425 },
    limits: { businessQueries: 9, preflightQueries: 10, appStarts: 0, appStops: 0, installs: 0,
      databaseCopies: 0, sql: 0, intentReads: 0 }, includeFallbacks: false,
    vmConfirmation: { vmName: 'Synthetic VM', confirmedAt: new Date(now - 1000).toISOString(),
      targetRef, instanceRef: 'c'.repeat(64), vmLog: options['--vm-log'] } };
}
const argv = object => Object.entries(object).flatMap(([key, value]) => value === true ? [key] : [key, value]);

test('manual diagnostic defaults/list stop before any runtime/device ports', async () => {
  for (const args of [[], ['--list']]) {
    const messages = [];
    const code = await runDiagnosticCli(args, { stdout: message => messages.push(JSON.parse(message)),
      spawn() { assert.fail('default must not run transport'); }, acquireLease() { assert.fail('default must not discover locks'); } });
    assert.equal(code, 0); assert.equal(messages.length, 1); assert.equal(messages[0].status, 'NOT_RUN');
    assert.equal(messages[0].deviceQueries, 0);
  }
});

test('CLI rejects ambiguous selection, missing bound inputs and arbitrary targets without device work', async () => {
  for (const args of [['--run'], ['--list', '--run'], ['--full'], argv({ ...options, '--target': 'other-device' }),
    argv({ ...options, '--output-dir': '/' }), [...argv(options), '--run'],
    ...['.js', '.mjs', '.cjs', '.cmd', '.bat'].map(ext => argv({ ...options, '--hdc': '/synthetic/hdc' + ext }))]) {
    const messages = [];
    assert.equal(await runDiagnosticCli(args, { stdout: message => messages.push(JSON.parse(message)),
      spawn() { assert.fail('invalid args must not run transport'); } }), 2);
    assert.equal(messages[0].status, 'FAIL');
    assert.ok(!JSON.stringify(messages).includes('other-device'));
  }
  assert.deepEqual(parseDiagnosticArgs(argv(options)), options);
});

test('new one-use authorization binds artifact, exact target, limits, fallbacks and fresh operator confirmation', () => {
  validateDiagnosticAuthorization(authorization(), options, binding, now);
  const mutations = [
    a => { a.status = 'DRAFT_NOT_AUTHORIZED'; }, a => { a.scopeClosed = true; },
    a => { a.action = 'INSTALL'; }, a => { a.approvalReference = ''; },
    a => { a.targetRef = 'd'.repeat(12); }, a => { a.serverRef = 'd'.repeat(12); },
    a => { a.manifestSha256 = 'd'.repeat(64); }, a => { a.hapSha256 = 'd'.repeat(64); },
    a => { a.hdcSha256 = 'd'.repeat(64); },
    a => { a.limits.businessQueries = 10; }, a => { a.limits.appStarts = 1; },
    a => { a.limits.intentReads = 1; }, a => { a.includeFallbacks = true; },
    a => { a.vmConfirmation.confirmedAt = new Date(now - 120_001).toISOString(); },
    a => { a.vmConfirmation.confirmedAt = new Date(now + 1).toISOString(); },
    a => { a.vmConfirmation.vmLog = '/other/VM.log'; },
    a => { a.vmConfirmation.instanceRef = ''; },
    a => { a.incumbent.uid = 0; }, a => { a.incumbent.appBuildId = ''; },
  ];
  for (const mutate of mutations) { const value = authorization(); mutate(value);
    assert.throws(() => validateDiagnosticAuthorization(value, options, binding, now)); }
});

test('missing/old authorization cannot import runtime or contact a device and emits no raw error path', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'reader-admission-cli-'));
  try {
    const messages = [], privatePath = join(directory, 'PRIVATE_NO_SUCH_AUTH.json');
    assert.equal(await runDiagnosticCli(argv({ ...options, '--authorization': privatePath }),
      { stdout: message => messages.push(message), spawn() { assert.fail('no authorization transport'); } }), 1);
    assert.ok(!messages.join('').includes('PRIVATE_NO_SUCH_AUTH'));
    const json = JSON.parse(messages[0]); assert.equal(json.authorizationConsumed, false);
    assert.equal(json.preflightQueries, 0); assert.equal(json.businessQueries, 0);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

function executionFixture(directory, logFailure = false) {
  const secret = 'PRIVATE_STDERR_AND_LOG_SENTINEL';
  const local = { ...options, '--hdc': join(directory, 'synthetic-hdc'), '--vm-log': join(directory, 'synthetic-vm.log'),
    '--manifest': join(directory, 'manifest.json'), '--authorization': join(directory, 'authorization.json'),
    '--output-dir': join(directory, 'report') };
  const hap = Buffer.from('synthetic HAP bytes; never deployed');
  const manifest = { schemaVersion: 2, abi: 'x86_64', artifacts: [{ kind: 'signed', path: 'synthetic.hap',
    sha256: hash(hap), signature: { verified: true,
      certificateSha256: '3A563778E5BF17CD3EAD0218E13B4A5030DE3F5D7D4E21E0336D8EB37B676DC4' },
    embeddedCoreNapi: { storageCompatibility: { sqliteMaxUserVersion: 47, sqliteStorageSourceSha256: 'e'.repeat(64) } } }] };
  writeFileSync(join(directory, 'synthetic.hap'), hap);
  const hdc = Buffer.concat([Buffer.from([0x7f, 0x45, 0x4c, 0x46]), Buffer.from('synthetic header; injected transport only')]);
  writeFileSync(local['--hdc'], hdc);
  writeFileSync(local['--vm-log'], secret);
  const manifestBytes = JSON.stringify(manifest); writeFileSync(local['--manifest'], manifestBytes);
  const auth = authorization(); auth.manifestSha256 = hash(manifestBytes); auth.hapSha256 = hash(hap); auth.hdcSha256 = hash(hdc);
  auth.vmConfirmation.vmLog = local['--vm-log'];
  writeFileSync(local['--authorization'], JSON.stringify(auth), { mode: 0o600 });
  const header = Buffer.alloc(100); header.write('SQLite format 3\0', 'latin1'); header.writeUInt32BE(47, 60);
  const stat = '20020064:7:4096:1793836352';
  const identity = '11-11 14:00:00.000 7654 7654 I A05244/Reader: Core build identity: ' +
    JSON.stringify({ schemaVersion: 1, buildId: 'f'.repeat(64), sqliteUserVersion: 47,
      storageCompatibility: manifest.artifacts[0].embeddedCoreNapi.storageCompatibility, privateField: secret });
  const ready = '11-11 14:00:00.001 7654 7654 I A05244/Reader: READER_STARTUP ' +
    JSON.stringify({ stage: 'startup.runtime-published', status: 'ready', privateField: secret });
  const calls = [], messages = []; let released = 0;
  const ok = output => ({ status: 0, stdout: Buffer.from(output), stderr: Buffer.from(secret) });
  const ports = { stdout: message => messages.push(JSON.parse(message)), now: () => now,
    claimLedgerRoot: join(directory, 'claims'),
    acquireLease: async () => ({ lockDir: '/synthetic-held-lease' }), releaseLease: () => { released++; },
    targetReadiness: ({ query }) => { assert.equal(query('param get bootevent.boot.completed'), 'true');
      return { status: 'PASS', bootIdSha256: 'a'.repeat(64), sceneBoardPidSha256: 'b'.repeat(64) }; },
    parseBundleMetadata: () => ({ bundlePresent: true, uid: 20020064, cpuAbi: 'x86_64',
      appVersion: { appBuildId: auth.incumbent.appBuildId }, appIdSha256: auth.incumbent.appIdSha256,
      updateTime: auth.incumbent.updateTime }),
    spawn(binary, args, config) {
      assert.equal(binary, local['--hdc']); assert.equal(config.encoding, null);
      assert.equal(config.timeout, 10_000); assert.equal(config.maxBuffer, 1024 * 1024);
      calls.push(args); assert.ok(!args.includes('install')); const command = args.at(-1);
      if (args.includes('list')) return ok('127.0.0.1:5555\tTCP\tConnected\n');
      if (command === 'param get bootevent.boot.completed') return ok('true\n');
      if (command === 'bm dump -n io.reader.minliny') return ok('synthetic BMS, parsed by controlled port');
      if (command === 'pwd') return ok('/mnt/debug/100/debug_hap/io.reader.minliny\n');
      if (command.startsWith('test -r ')) return ok(`${stat}\n${[...header].join(' ')}\n${stat}\n`);
      if (command === 'pidof io.reader.minliny') return ok('7654\n');
      if (command === 'hilog -x -P 7654 -T Reader') return logFailure ?
        { status: 1, stdout: Buffer.from(identity), stderr: Buffer.from(secret) } : ok(identity + '\n' + ready);
      assert.fail('unexpected device command in injected fixture');
    } };
  return { local, ports, calls, messages, secret, released: () => released };
}

test('explicit synthetic execution uses one lease, exact query bytes and cannot consume authorization twice', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'reader-admission-cli-'));
  try {
    const fixture = executionFixture(directory);
    assert.equal(await runDiagnosticCli(argv(fixture.local), fixture.ports), 0);
    assert.equal(fixture.released(), 1);
    const report = JSON.parse(readFileSync(join(directory, 'report/report.json'), 'utf8'));
    assert.equal(report.routePrediction.allowed, true); assert.equal(report.businessQueries, 6);
    assert.equal(report.preflightQueries, 2); assert.equal(report.installation, 'NOT_RUN');
    assert.equal(report.appStops, 0); assert.equal(report.appStarts, 0);
    assert.ok(!JSON.stringify(report).includes(fixture.secret)); assert.ok(!JSON.stringify(report).includes('7654'));
    const count = fixture.calls.length;
    assert.equal(await runDiagnosticCli(argv({ ...fixture.local, '--output-dir': join(directory, 'second') }), fixture.ports), 1);
    assert.equal(fixture.calls.length, count); assert.equal(fixture.released(), 1);
    const copiedAuth = join(directory, 'copied-authorization.json');
    // Reformatting and refreshing a confirmation do not create another grant.
    const copied = JSON.parse(readFileSync(fixture.local['--authorization'], 'utf8'));
    copied.vmConfirmation.confirmedAt = new Date(now).toISOString();
    writeFileSync(copiedAuth, JSON.stringify(copied, null, 2), { mode: 0o600 });
    assert.equal(await runDiagnosticCli(argv({ ...fixture.local, '--authorization': copiedAuth,
      '--output-dir': join(directory, 'third') }), fixture.ports), 1);
    assert.equal(fixture.calls.length, count); assert.equal(fixture.released(), 1);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('synthetic query failure is a failed execution even when diagnosis classifies it; no raw output is saved', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'reader-admission-cli-'));
  try {
    const fixture = executionFixture(directory, true);
    assert.equal(await runDiagnosticCli(argv(fixture.local), fixture.ports), 1);
    assert.equal(fixture.released(), 1);
    const report = JSON.parse(readFileSync(join(directory, 'report/report.json'), 'utf8'));
    assert.equal(report.executionStatus, 'FAIL_QUERY'); assert.equal(report.routePrediction.allowed, false);
    assert.ok(!JSON.stringify(report).includes(fixture.secret));
    assert.equal(fixture.messages.at(-1).status, 'FAIL_QUERY');
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('readiness failure closes the new scope before BMS/diagnostic queries; exception content is private', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'reader-admission-cli-'));
  try {
    const fixture = executionFixture(directory);
    fixture.ports.targetReadiness = () => { throw Object.assign(new Error(fixture.secret), { diagnosticCode: fixture.secret }); };
    assert.equal(await runDiagnosticCli(argv(fixture.local), fixture.ports), 1);
    assert.equal(fixture.calls.length, 1); assert.equal(fixture.released(), 1);
    assert.equal(fixture.messages.at(-1).reason, 'target-readiness-failed');
    assert.equal(fixture.messages.at(-1).businessQueries, 0);
    assert.ok(!JSON.stringify(fixture.messages).includes(fixture.secret));
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
