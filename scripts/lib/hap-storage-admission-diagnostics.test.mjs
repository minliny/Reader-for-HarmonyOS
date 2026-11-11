import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { summarizeProbeResult, diagnoseStorageAdmission } from './hap-storage-admission-diagnostics.mjs';
import {
  readInstalledSqliteVersion,
  readInstalledStorageLineage,
  storageUpdateRoute,
} from './hap-storage-admission.mjs';

// Explicit local entry: node --test scripts/lib/hap-storage-admission-diagnostics.test.mjs
// All query results below are in-memory spawn-shaped fixtures. No child process,
// device, SDK, SQLite, Native runtime, application file or old private receipt is
// opened. The unchanged production readers/router supply the admission oracle.
const bundleName = 'io.reader.minliny';
const uid = 20020064;
const pid = '71329';
const compatibility = Object.freeze({ sqliteMaxUserVersion: 47, sqliteStorageSourceSha256: 'a'.repeat(64) });
const identity = Object.freeze({ schemaVersion: 1, buildId: 'b'.repeat(64),
  storageCompatibility: compatibility, sqliteUserVersion: 47 });
const prefix = `11-11 12:00:00.000 ${pid} ${pid} I A05244/Reader: `;
const cwd = `/mnt/debug/100/debug_hap/${bundleName}`;
const categories = new Set(['header-cwd', 'header-read', 'lineage-pid-before', 'lineage-log',
  'lineage-pid-after', 'header-markers', 'fallback-ps', 'fallback-log']);

function completed(stdout = '', overrides = {}) {
  return { status: 0, signal: null, stdout, stderr: '', ...overrides };
}

function headerSample(version = 47, { owner = uid, size = 1048576, bytes,
  before = `${owner}:1234:${size}:1794380000`, after = before } = {}) {
  const header = Buffer.alloc(100);
  header.write('SQLite format 3\0', 'latin1');
  header.writeUInt32BE(version, 60);
  return `${before}\n${(bytes ?? [...header]).join(' ')}\n${after}\n`;
}

function markerSample({ wal = false, journal = false, present = true, symlink = false,
  readable = true, searchable = true, header = headerSample() } = {}) {
  const flags = ['HSD_HEADER_MARKERS_V1', 'directory-present=1',
    `directory-readable=${Number(readable)}`, `directory-searchable=${Number(searchable)}`,
    `db-present=${Number(present)}`, `db-symlink=${Number(symlink)}`,
    `wal-present=${Number(wal)}`, `journal-present=${Number(journal)}`];
  if (present && !symlink && readable && searchable && !wal && !journal) {
    const [before, bytes, after] = header.trim().split('\n');
    flags.push('STAT_BEFORE', before, 'HEADER_100', bytes, 'STAT_AFTER', after);
  } else flags.push('STAT_BEFORE', 'HEADER_100', 'STAT_AFTER');
  return [...flags, 'END'].join('\n');
}

const identityLine = (value = identity) => `${prefix}Core build identity: ${JSON.stringify(value)}`;
const eventLine = (stage, status = 'ready') => `${prefix}READER_STARTUP ${JSON.stringify({ stage, status })}`;
const readyLog = (value = identity) => [eventLine('startup.native-open', 'start'),
  eventLine('startup.native-open', 'ready'), identityLine(value), eventLine('startup.runtime-published')].join('\n');

function probeFixture(overrides = {}) {
  const calls = [];
  const outputs = {
    'header-cwd': completed(`${cwd}\n`),
    'header-read': completed(headerSample()),
    'lineage-pid-before': completed(`${pid}\n`),
    'lineage-log': completed(readyLog()),
    'lineage-pid-after': completed(`${pid}\n`),
    'header-markers': completed(markerSample()),
    'fallback-ps': completed(`UID PID\n${uid} ${pid}\n`),
    'fallback-log': completed(readyLog()),
    ...overrides,
  };
  const probeQuery = query => {
    assert.deepEqual(Object.keys(query).sort(), ['category', 'command', 'sandbox']);
    assert.ok(categories.has(query.category), 'only the finite diagnostic query categories are used');
    assert.equal(typeof query.command, 'string');
    assert.equal(typeof query.sandbox, 'boolean');
    calls.push(query);
    assert.ok(calls.length <= 8, 'module maximum8; the CLI BMS query is a separate ninth operation');
    assert.ok(Object.hasOwn(outputs, query.category), `unexpected category ${query.category}`);
    const value = outputs[query.category];
    if (typeof value === 'function') return value(query);
    return value;
  };
  return { outputs, calls, probeQuery };
}

// This does not replay another implementation. It calls the original pure
// readers and router with the same fixture data independently of the report.
function originalDecision(outputs, candidateStorage = compatibility, input = {}) {
  const selectedBundle = input.bundleName ?? bundleName;
  const selectedUid = input.uid ?? uid;
  const text = category => {
    const result = outputs[category];
    if (result.error || result.status !== 0 || result.signal) return '';
    return String(result.stdout ?? '').trim();
  };
  const headerVersion = readInstalledSqliteVersion({ bundleName: selectedBundle, uid: selectedUid,
    querySandbox: command => text(command === 'pwd' ? 'header-cwd' : 'header-read') });
  let pidReads = 0;
  const installedStorage = candidateStorage && (headerVersion === null ||
    headerVersion <= candidateStorage.sqliteMaxUserVersion) ? readInstalledStorageLineage({ bundleName: selectedBundle,
      query: command => text(command.startsWith('pidof ') ?
        pidReads++ === 0 ? 'lineage-pid-before' : 'lineage-pid-after' : 'lineage-log') }) : null;
  const targetSqliteVersion = headerVersion ?? installedStorage?.sqliteUserVersion ?? null;
  return { headerVersion, installedStorage, targetSqliteVersion,
    route: storageUpdateRoute({ targetSqliteVersion, installedStorage, candidateStorage }) };
}

function runFixture(overrides = {}, { candidateStorage = compatibility, includeFallbacks = false, input = {} } = {}) {
  const fixture = probeFixture(overrides);
  const report = diagnoseStorageAdmission({ bundleName, uid, candidateStorage,
    ...input, probeQuery: fixture.probeQuery, includeFallbacks });
  const original = originalDecision(fixture.outputs, candidateStorage, input);
  assert.equal(report.schema, 'reader.hap-storage-admission-diagnostic.v1');
  assert.deepEqual(report.canonical, {
    headerVersion: original.headerVersion,
    installedStoragePresent: original.installedStorage !== null,
    targetSqliteVersion: original.targetSqliteVersion,
    versionSource: original.headerVersion !== null ? 'stable-sqlite-header' :
      original.targetSqliteVersion !== null ? 'installed-core' : null,
    route: original.route,
  }, 'real unchanged readers and router decide canonical admission');
  assert.deepEqual(report.routePrediction, original.route);
  assert.ok(fixture.calls.length <= 8);
  return { ...fixture, report, original };
}

function noRawValues(report, forbidden) {
  const serialized = JSON.stringify(report);
  for (const value of forbidden) assert.ok(!serialized.includes(value), `report exposed fixture-only value ${value}`);
  assert.doesNotMatch(serialized, /\/mnt\/debug\/|\/data\/app\/|https?:\/\//);
}

test('spawn summaries count raw bytes before UTF8 decoding or trim and retain only fixed fields', () => {
  const stdout = Buffer.from([0x20, 0xc3, 0x28, 0xff, 0x20]);
  const stderr = Buffer.from([0xff, 0, 0x61]);
  const summary = summarizeProbeResult(completed(stdout, { stderr }));
  assert.deepEqual(Object.keys(summary).sort(), ['exitCode', 'outcome', 'stderrBytes', 'stdoutBytes', 'timedOut']);
  assert.deepEqual(summary, { outcome: 'ok', exitCode: 0, timedOut: false, stdoutBytes: 5, stderrBytes: 3 });
  const text = ' \n密é💡\t';
  assert.equal(summarizeProbeResult(completed(text)).stdoutBytes, Buffer.byteLength(text, 'utf8'));
  const whitespace = ' \r\n\t';
  assert.deepEqual(summarizeProbeResult(completed(whitespace)), {
    outcome: 'empty', exitCode: 0, timedOut: false, stdoutBytes: Buffer.byteLength(whitespace), stderrBytes: 0,
  });
});

test('spawn summaries distinguish transport outcomes without printing raw errors or guessing signal timeouts', () => {
  const privateMessage = 'SECRET_SPAWN_MESSAGE https://private.invalid/token /data/private/file';
  const samples = [
    [completed('out', { status: null, signal: 'SIGTERM', error: { code: 'ETIMEDOUT', message: privateMessage } }), 'timeout', true],
    [completed('out', { status: null, error: { code: 'ENOBUFS', message: privateMessage } }), 'output-limit', false],
    [completed('out', { status: null, error: { code: 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER', message: privateMessage } }), 'output-limit', false],
    [completed('out', { status: null, error: { code: 'ENOENT', message: privateMessage } }), 'spawn-error', false],
    [completed('out', { status: null, signal: 'SIGTERM' }), 'spawn-error', false],
    [completed('out', { status: undefined }), 'spawn-error', false],
    [completed('out', { status: 7 }), 'exit-nonzero', false],
    [completed(' \n'), 'empty', false],
    [completed('out', { stderr: privateMessage }), 'ok', false],
  ];
  for (const [input, outcome, timedOut] of samples) {
    const summary = summarizeProbeResult(input);
    assert.equal(summary.outcome, outcome);
    assert.equal(summary.timedOut, timedOut);
    assert.equal(summary.stdoutBytes, Buffer.byteLength(input.stdout));
    noRawValues(summary, [privateMessage, 'ETIMEDOUT', 'ENOENT']);
  }
  assert.equal(summarizeProbeResult(completed('out', { status: 3, error: { code: 'ETIMEDOUT' } })).outcome,
    'timeout', 'a timeout has priority over a nonzero exit');
  assert.equal(summarizeProbeResult(completed('out', { status: 3, error: { code: 'ENOBUFS' } })).outcome,
    'output-limit', 'a bounded-output failure has priority over a nonzero exit');
});

test('diagnostic has no implicit device adapter and defaults do not query broad fallback sources', () => {
  // Match a complete command token (optionally an executable path), never a
  // suffix within the legitimate reader-core.sqlite3 file argument.
  const forbiddenCommand = /(?:^|[\s;&|()])(?:[^\s;&|()]*\/)?(?:sqlite3|PRAGMA|aa\s+(?:start|force-stop)|force-stop|install|uninstall|file\s+recv)(?=$|[\s;&|()])/i;
  const assertSafeCommand = command => assert.doesNotMatch(command, forbiddenCommand);
  for (const command of [
    'stat -c %u:%i:%s:%Y /fixture/reader-core.sqlite3',
    'od -An -v -N 100 -t u1 /fixture/reader-core.sqlite3',
    'test ! -s /fixture/reader-core.sqlite3-wal && stat /fixture/reader-core.sqlite3 && od -N 100 /fixture/reader-core.sqlite3',
    'test ! -s /fixture/reader-core.sqlite3-journal',
  ]) assertSafeCommand(command);
  for (const command of [
    'sqlite3 /fixture/reader-core.sqlite3',
    '/system/bin/sqlite3 -readonly /fixture/reader-core.sqlite3',
    'test -f /fixture/reader-core.sqlite3 && sqlite3 /fixture/reader-core.sqlite3',
    'printf sample | sqlite3 :memory:',
    'PRAGMA user_version;',
    'pragma(user_version);',
    'echo safe; PRAGMA user_version;',
    'aa start -a EntryAbility -b io.reader.minliny',
    '/system/bin/aa start -a EntryAbility -b io.reader.minliny',
    'aa force-stop io.reader.minliny',
    'force-stop io.reader.minliny',
    'install -r candidate.hap',
    'uninstall io.reader.minliny',
    'file recv /fixture/private.sqlite3 /fixture/copy',
  ]) assert.throws(() => assertSafeCommand(command), { name: 'AssertionError' });
  assert.throws(() => diagnoseStorageAdmission({ bundleName, uid, candidateStorage: compatibility }));
  const { report, calls } = runFixture();
  assert.equal(report.canonical.route.allowed, true);
  assert.equal(report.lineage.reason, 'lineage-valid');
  assert.deepEqual(calls.map(call => call.category), ['header-cwd', 'header-read',
    'lineage-pid-before', 'lineage-log', 'lineage-pid-after']);
  assert.equal(report.query.extra.fallbackPs, null);
  assert.equal(report.query.extra.fallbackLog, null);
  for (const call of calls) {
    assert.equal(call.sandbox, call.category.startsWith('header-'));
    assertSafeCommand(call.command);
  }
  const invalidBundle = runFixture({}, { input: { bundleName: 'io.reader.minliny;PRIVATE_INVALID_BUNDLE' } });
  assert.equal(invalidBundle.calls.length, 0, 'invalid bundle input never produces a shell query');
  assert.equal(invalidBundle.report.header.reason, 'header-input-invalid');
  assert.equal(invalidBundle.report.canonical.route.allowed, false);
  noRawValues(invalidBundle.report, ['PRIVATE_INVALID_BUNDLE']);
});

test('canonical readers receive UTF8 trim projection while query summaries keep the untrimmed byte count', () => {
  const cwdRaw = Buffer.from(` \t${cwd}\r\n`);
  const pidRaw = Buffer.from(` \n${pid}\t\n`);
  // The malformed UTF8 belongs to an unrelated line, not a matched JSON DTO.
  const logRaw = Buffer.concat([Buffer.from([0xff, 0x0a]), Buffer.from(readyLog()), Buffer.from(' \n\t')]);
  const stderr = Buffer.from('PRIVATE_STDERR_凭据 https://private.invalid/credential');
  const { report } = runFixture({
    'header-cwd': completed(cwdRaw, { stderr }),
    'lineage-pid-before': completed(pidRaw, { stderr }),
    'lineage-pid-after': completed(pidRaw, { stderr }),
    'lineage-log': completed(logRaw, { stderr }),
  });
  assert.equal(report.canonical.route.allowed, true, 'status0stderr does not veto successful original capture stdout');
  assert.equal(report.query.header.cwd.stdoutBytes, cwdRaw.length);
  assert.equal(report.query.lineage.pidBefore.stdoutBytes, pidRaw.length);
  assert.equal(report.query.lineage.log.stdoutBytes, logRaw.length);
  assert.equal(report.query.lineage.log.stderrBytes, stderr.length);
  assert.equal(report.lineage.logBytes, logRaw.length);
  noRawValues(report, [stderr.toString(), pid, cwd, 'PRIVATE_STDERR', '\ufffd']);
});

test('header classifications cover owner, stat stability, numeric bytes, magic and version without replacing the original reader', () => {
  const header = Buffer.alloc(100);
  header.write('SQLite format 3\0', 'latin1'); header.writeUInt32BE(47, 60);
  const badMagic = [...header]; badMagic[0] = 0;
  const invalidByte = [...header]; invalidByte[20] = 256;
  const invalidToken = [...header]; invalidToken[20] = 'not-a-byte';
  const samples = [
    ['valid', headerSample(), 'header-valid', 47],
    ['uid', headerSample(47, { owner: uid + 1 }), 'header-uid-mismatch', null],
    ['small', headerSample(47, { size: 99 }), 'header-too-small', null],
    ['unstable', headerSample(47, { after: `${uid}:1234:1048576:1794380001` }), 'header-stat-unstable', null],
    ['stat malformed', 'PRIVATE_BAD_STAT\n0\nPRIVATE_BAD_STAT\n', 'header-output-malformed', null],
    ['99bytes', headerSample(47, { bytes: [...header].slice(1) }), 'header-output-malformed', null],
    ['invalid byte', headerSample(47, { bytes: invalidByte }), 'header-output-malformed', null],
    ['invalid token', headerSample(47, { bytes: invalidToken }), 'header-output-malformed', null],
    ['wrong magic', headerSample(47, { bytes: badMagic }), 'header-magic-invalid', null],
    ['zero version', headerSample(0), 'header-version-invalid', null],
    ['out of range version', headerSample(0x80000000), 'header-version-invalid', null],
  ];
  for (const [name, sample, reason, version] of samples) {
    const { report } = runFixture({ 'header-read': completed(sample) });
    assert.equal(report.header.reason, reason, name);
    assert.equal(report.header.canonicalReason, reason, name);
    assert.equal(report.header.version, version, name);
    assert.equal(report.canonical.headerVersion, version, name);
    assert.equal(report.canonical.route.allowed, true, 'a failed header can still use valid published same-source47');
    noRawValues(report, [sample, 'PRIVATE_BAD_STAT']);
  }
});

test('header sandbox, input and transport failures stay distinct from later explanatory markers', () => {
  const wrongCwd = runFixture({ 'header-cwd': completed('/mnt/debug/100/debug_hap/other.bundle\n') });
  assert.equal(wrongCwd.report.header.reason, 'header-sandbox-unresolved');
  assert.equal(wrongCwd.report.query.header.read, null);
  assert.ok(!wrongCwd.calls.some(call => call.category === 'header-markers'));
  for (const result of [completed(''), completed('', { status: 3 }),
    completed('', { status: null, error: { code: 'ETIMEDOUT' } })]) {
    const unresolved = runFixture({ 'header-cwd': result });
    assert.equal(unresolved.report.header.reason, 'header-sandbox-unresolved');
    assert.equal(unresolved.report.query.header.cwd.outcome, summarizeProbeResult(result).outcome);
    assert.equal(unresolved.report.query.header.read, null);
    assert.equal(unresolved.report.query.extra.headerMarkers, null);
  }
  const invalidUid = runFixture({}, { input: { uid: 0 } });
  assert.equal(invalidUid.report.header.reason, 'header-input-invalid');
  const failed = runFixture({ 'header-read': completed('', { status: 9, stderr: 'PRIVATE_READ_ERROR' }) });
  assert.equal(failed.report.header.reason, 'header-command-failed');
  assert.equal(failed.report.query.header.read.outcome, 'exit-nonzero');
  assert.equal(failed.report.canonical.headerVersion, null);
  assert.equal(failed.report.canonical.route.allowed, true);
  assert.equal(failed.report.header.markerTimeSeparated, true);
  noRawValues(failed.report, ['PRIVATE_READ_ERROR']);
});

test('resolved header47 does not admit a missing or invalid current runtime lineage', () => {
  for (const log of ['', identityLine(), `${identityLine()}\n${eventLine('startup.runtime-published', 'failed')}`]) {
    const { report } = runFixture({ 'lineage-log': completed(log) });
    assert.equal(report.canonical.headerVersion, 47);
    assert.equal(report.canonical.installedStoragePresent, false);
    assert.deepEqual(report.canonical.route, { allowed: false, reason: 'installed-core-storage-lineage-unresolved' });
  }
});

test('missing header can use a same-source current47 lineage, but header48 is explicitly rejected without querying lineage', () => {
  const missing = runFixture({ 'header-read': completed('') });
  assert.equal(missing.report.canonical.headerVersion, null);
  assert.equal(missing.report.canonical.targetSqliteVersion, 47);
  assert.equal(missing.report.canonical.versionSource, 'installed-core');
  assert.equal(missing.report.canonical.route.allowed, true);
  const incompatible = runFixture({ 'header-read': completed(headerSample(48)) });
  assert.equal(incompatible.report.canonical.targetSqliteVersion, 48);
  assert.deepEqual(incompatible.report.canonical.route, { allowed: false, reason: 'candidate-core-cannot-open-target-sqlite' });
  assert.equal(incompatible.report.lineage.reason, 'lineage-not-queried');
  assert.ok(!incompatible.calls.some(call => call.category.startsWith('lineage-')));
});

test('current lineage source and maximum must match even with a valid47 header', () => {
  for (const changed of [
    { ...compatibility, sqliteStorageSourceSha256: 'c'.repeat(64) },
    { ...compatibility, sqliteMaxUserVersion: 48 },
  ]) {
    const { report } = runFixture({ 'lineage-log': completed(readyLog({ ...identity, storageCompatibility: changed })) });
    assert.equal(report.canonical.installedStoragePresent, true);
    assert.deepEqual(report.canonical.route, { allowed: false, reason: 'core-storage-lineage-changed' });
  }
  const invalidCandidate = runFixture({}, { candidateStorage: null });
  assert.deepEqual(invalidCandidate.report.canonical.route, { allowed: false, reason: 'candidate-native-storage-identity-unresolved' });
  assert.equal(invalidCandidate.report.lineage.reason, 'lineage-not-queried');
});

test('lineage reports unavailable, ambiguous and changed process observations without inventing a stable PID', () => {
  const samples = [
    [{ 'lineage-pid-before': completed('') }, 'lineage-pid-unavailable', 'unavailable'],
    [{ 'lineage-pid-before': completed(`${pid} 81243\n`) }, 'lineage-pid-ambiguous', 'ambiguous'],
    [{ 'lineage-pid-before': completed('0') }, 'lineage-pid-unavailable', 'unavailable'],
    [{ 'lineage-pid-after': completed('81243\n') }, 'lineage-pid-changed', 'changed'],
  ];
  for (const [overrides, reason, pidState] of samples) {
    const { report } = runFixture(overrides);
    assert.equal(report.lineage.reason, reason);
    assert.equal(report.lineage.pidState, pidState);
    assert.equal(report.canonical.installedStoragePresent, false);
    assert.equal(report.canonical.route.allowed, false);
    noRawValues(report, [pid, '81243']);
  }
  for (const category of ['lineage-pid-before', 'lineage-pid-after']) {
    for (const failed of [completed('', { status: 4 }),
      completed('', { status: null, error: { code: 'ETIMEDOUT' } })]) {
      const { report, calls } = runFixture({ [category]: failed }, { includeFallbacks: true });
      assert.equal(report.lineage.reason, 'lineage-pid-query-failed');
      assert.equal(report.lineage.pidState, 'unavailable', 'a failed observation is not an observed PID change');
      assert.equal(report.canonical.route.allowed, false);
      assert.ok(!calls.some(call => call.category.startsWith('fallback-')),
        'a failed PID transport does not justify more ps/log queries');
    }
  }
});

test('lineage distinguishes transport, empty and unmatched logs while preserving canonical refusal', () => {
  const samples = [
    [completed('', { status: null, error: { code: 'ETIMEDOUT' } }), 'lineage-log-query-failed', 'timeout'],
    [completed('truncated PRIVATE_OVER_LIMIT', { status: null, error: { code: 'ENOBUFS' } }), 'lineage-log-over-limit', 'output-limit'],
    [completed('', { status: 4 }), 'lineage-log-query-failed', 'exit-nonzero'],
    [completed(' \n\t'), 'lineage-log-empty', 'empty'],
    [completed(`${prefix}unrelated PRIVATE_UNMATCHED_LOG\n`), 'lineage-identity-missing', 'ok'],
  ];
  for (const [result, reason, outcome] of samples) {
    const { report, calls } = runFixture({ 'lineage-log': result }, { includeFallbacks: true });
    assert.equal(report.lineage.reason, reason);
    assert.equal(report.query.lineage.log.outcome, outcome);
    assert.equal(report.canonical.installedStoragePresent, false);
    assert.equal(report.canonical.route.allowed, false);
    assert.equal(calls.some(call => call.category === 'fallback-log'), outcome === 'empty',
      'only a successful empty filtered log permits the broad log explanation');
    noRawValues(report, ['PRIVATE_OVER_LIMIT', 'PRIVATE_UNMATCHED_LOG']);
  }
});

test('lineage validates identity, publication ordering, ready status and later native resets', () => {
  const malformedIdentity = `${prefix}Core build identity: {PRIVATE_INVALID_IDENTITY_JSON}`;
  const malformedTrace = `${prefix}READER_STARTUP {PRIVATE_INVALID_TRACE_JSON}`;
  const samples = [
    [[malformedIdentity, eventLine('startup.runtime-published')], 'lineage-identity-invalid-json'],
    [[identityLine({ ...identity, schemaVersion: 2 }), eventLine('startup.runtime-published')], 'lineage-identity-invalid-schema'],
    [[identityLine({ ...identity, buildId: 'NOT_A_BUILD_HASH' }), eventLine('startup.runtime-published')], 'lineage-identity-invalid-schema'],
    [[identityLine({ ...identity, storageCompatibility: { ...compatibility, sqliteMaxUserVersion: 0 } }), eventLine('startup.runtime-published')], 'lineage-identity-invalid-schema'],
    [[identityLine()], 'lineage-ready-missing'],
    [[eventLine('startup.runtime-published'), identityLine()], 'lineage-ready-missing'],
    [[identityLine(), eventLine('startup.runtime-published', 'failed')], 'lineage-ready-not-ready'],
    [[identityLine(), eventLine('startup.runtime-published'), eventLine('startup.native-open', 'start')], 'lineage-session-reset'],
    [[identityLine(), eventLine('startup.runtime-published'), eventLine('startup.native-open', 'ready')], 'lineage-session-reset'],
    [[identityLine(), eventLine('startup.runtime-published'), malformedTrace], 'lineage-malformed-line'],
  ];
  for (const [lines, reason] of samples) {
    const { report } = runFixture({ 'lineage-log': completed(lines.join('\n')) });
    assert.equal(report.lineage.reason, reason);
    assert.equal(report.lineage.canonicalRejected, true);
    assert.equal(report.canonical.installedStoragePresent, false);
    assert.equal(report.canonical.route.allowed, false);
    noRawValues(report, ['PRIVATE_INVALID_IDENTITY_JSON', 'PRIVATE_INVALID_TRACE_JSON', 'NOT_A_BUILD_HASH']);
  }
});

test('a missing identity sqlite version is not the same as a missing published lineage', () => {
  const noVersion = { ...identity }; delete noVersion.sqliteUserVersion;
  const log = completed(readyLog(noVersion));
  const withHeader = runFixture({ 'lineage-log': log });
  assert.equal(withHeader.report.canonical.installedStoragePresent, true);
  assert.equal(withHeader.report.canonical.targetSqliteVersion, 47);
  assert.equal(withHeader.report.canonical.route.allowed, true, 'valid header supplies47 while lineage still proves source');
  const withoutHeader = runFixture({ 'header-read': completed(''), 'lineage-log': log });
  assert.equal(withoutHeader.report.canonical.installedStoragePresent, true);
  assert.equal(withoutHeader.report.canonical.targetSqliteVersion, null);
  assert.deepEqual(withoutHeader.report.canonical.route, { allowed: false, reason: 'target-sqlite-version-unresolved' });
  assert.equal(withoutHeader.report.lineage.reason, 'lineage-version-unresolved');
});

test('historical matched malformed JSON before a newer good session remains rejected by the unchanged canonical reader', () => {
  for (const malformed of [
    `${prefix}Core build identity: {PRIVATE_OLD_MALFORMED_JSON}`,
    `${prefix}READER_STARTUP {PRIVATE_OLD_MALFORMED_JSON}`,
  ]) {
    const { report } = runFixture({ 'lineage-log': completed(`${malformed}\n${readyLog()}`) }, { includeFallbacks: true });
    assert.equal(report.lineage.historicalMalformedBeforeLatestOpen, true);
    assert.ok(report.lineage.malformedCount >= 1);
    assert.equal(report.lineage.canonicalRejected, true);
    assert.equal(report.canonical.installedStoragePresent, false);
    assert.deepEqual(report.canonical.route, { allowed: false, reason: 'installed-core-storage-lineage-unresolved' });
    assert.equal(report.query.extra.fallbackPs, null, 'stable numeric PID does not require a broader ps query');
    assert.equal(report.query.extra.fallbackLog, null, 'a known bad JSON does not justify a broader log query');
    assert.equal(report.routePrediction.allowed, false, 'a diagnostic last-session view never replaces canonical history');
    noRawValues(report, ['PRIVATE_OLD_MALFORMED_JSON', pid]);
  }
});

test('unmatched suspicious log text may warn but cannot change the original accepted identity and ready sequence', () => {
  const unmatched = `${prefix}Core build identity: PRIVATE_UNMATCHED_WITHOUT_JSON`;
  const { report } = runFixture({ 'lineage-log': completed(`${unmatched}\n${readyLog()}`) });
  assert.equal(report.canonical.route.allowed, true);
  assert.equal(report.lineage.canonicalRejected, false);
  assert.ok(report.lineage.warningReasons.includes('lineage-malformed-line'));
  noRawValues(report, ['PRIVATE_UNMATCHED_WITHOUT_JSON']);
});

test('later header markers explain WAL or journal observations but never upgrade the original header or admission', () => {
  const rows = [
    [markerSample({ wal: true }), 'header-wal-present', true, false],
    [markerSample({ journal: true }), 'header-journal-present', false, true],
    [markerSample({ present: false }), 'header-db-missing', false, false],
    [markerSample({ symlink: true }), 'header-path-unsafe', false, false],
  ];
  for (const [marker, markerReason, walPresent, journalPresent] of rows) {
    const { report } = runFixture({ 'header-read': completed(''), 'header-markers': completed(marker), 'lineage-log': completed('') });
    assert.equal(report.header.markerReason, markerReason);
    assert.equal(report.header.walPresent, walPresent);
    assert.equal(report.header.journalPresent, journalPresent);
    assert.equal(report.header.markerTimeSeparated, true);
    assert.equal(report.header.version, null);
    assert.equal(report.canonical.headerVersion, null);
    assert.equal(report.canonical.targetSqliteVersion, null);
    assert.equal(report.canonical.route.allowed, false);
    assert.notEqual(report.header.canonicalReason, markerReason, 'later markers are not the original raw-read reason');
  }
  const laterValid = runFixture({ 'header-read': completed(''), 'header-markers': completed(markerSample()), 'lineage-log': completed('') });
  assert.equal(laterValid.report.header.version, null, 'a later valid100-byte observation is explanatory only');
  assert.equal(laterValid.report.canonical.route.allowed, false);
  const markerFailure = runFixture({ 'header-read': completed(''),
    'header-markers': completed('', { status: 6, stderr: 'PRIVATE_MARKER_ERROR' }), 'lineage-log': completed('') });
  assert.equal(markerFailure.report.header.markerReason, 'header-markers-failed');
  assert.equal(markerFailure.report.canonical.route.allowed, false);
  noRawValues(markerFailure.report, ['PRIVATE_MARKER_ERROR']);
});

test('optional fallback probes are narrowly triggered and never substitute for canonical current-process evidence', () => {
  const f = runFixture({ 'header-read': completed(''), 'lineage-log': completed(' \n') }, { includeFallbacks: true });
  assert.equal(f.calls.length, 7, 'five original queries, one separated marker query and one empty-log explanation');
  assert.ok(f.calls.length <= 8);
  assert.equal(f.report.lineage.pidState, 'single');
  assert.equal(f.report.query.extra.fallbackPs, null);
  assert.equal(f.report.extra.fallbackLog.pidBound, false);
  assert.equal(f.report.extra.fallbackLog.timeSeparated, true);
  assert.equal(f.report.extra.fallbackLog.identityCount, 1);
  assert.equal(f.report.extra.fallbackLog.readyCount, 1);
  assert.equal(f.report.extra.fallbackLog.requestedPidIdentityCount, 1);
  assert.equal(f.report.extra.fallbackLog.requestedPidReadyCount, 1);
  assert.equal(f.report.extra.fallbackLog.unattributedRecordCount, 0);
  assert.equal(f.report.extra.fallbackLog.attribution, 'complete');
  assert.equal(f.report.extra.fallbackLog.pidReuseExcluded, false);
  assert.equal(f.report.canonical.targetSqliteVersion, null);
  assert.equal(f.report.canonical.route.allowed, false, 'valid fallback evidence is never a substitute current-PID lineage');
  noRawValues(f.report, [pid, '81243', cwd]);
  for (const before of ['', `${pid} 81243`]) {
    const missingPid = runFixture({ 'lineage-pid-before': completed(before) }, { includeFallbacks: true });
    assert.equal(missingPid.report.extra.fallbackPs.matchingUidCount, 1);
    assert.equal(missingPid.report.query.extra.fallbackLog, null, 'no filtered log was read for an unresolved initial PID');
    assert.equal(missingPid.report.canonical.route.allowed, false);
    assert.ok(missingPid.calls.length <= 8);
  }
  const changed = runFixture({ 'lineage-pid-after': completed('81243\n') }, { includeFallbacks: true });
  assert.equal(changed.report.lineage.reason, 'lineage-pid-changed');
  assert.ok(!changed.calls.some(call => call.category.startsWith('fallback-')),
    'a successfully observed changed PID is already explanatory, not permission to query more');
  const missingReady = runFixture({ 'lineage-log': completed(identityLine()) }, { includeFallbacks: true });
  assert.equal(missingReady.report.lineage.reason, 'lineage-ready-missing');
  assert.equal(missingReady.report.query.extra.fallbackLog, null);
  const alreadyAllowed = runFixture({}, { includeFallbacks: true });
  assert.ok(!alreadyAllowed.calls.some(call => call.category.startsWith('fallback-')),
    'optional broad probes are unnecessary when the real canonical route is already allowed');
});

test('fallback log counts distinguish requested PID, other PID and missing reliable prefix without publishing either PID', () => {
  const otherPid = '81243';
  const otherPrefix = prefix.replace(`${pid} ${pid}`, `${otherPid} ${otherPid}`);
  const noPrefix = 'PRIVATE_UNATTRIBUTED_PREFIX /Reader: ';
  const missingTid = `11-11 12:00:00.000 ${pid} I A05244/Reader: `;
  const pair = selectedPrefix => [
    `${selectedPrefix}Core build identity: ${JSON.stringify(identity)}`,
    `${selectedPrefix}READER_STARTUP ${JSON.stringify({ stage: 'startup.runtime-published', status: 'ready' })}`,
  ];
  const log = [...pair(otherPrefix), ...pair(prefix), ...pair(noPrefix), ...pair(missingTid)].join('\n');
  const { report } = runFixture({ 'lineage-log': completed(''), 'fallback-log': completed(log) }, { includeFallbacks: true });
  const fallback = report.extra.fallbackLog;
  assert.equal(fallback.identityCount, 4, 'aggregate counts still describe the whole broad log');
  assert.equal(fallback.readyCount, 4);
  assert.equal(fallback.requestedPidIdentityCount, 1, 'other PID and incomplete prefixes do not count for requested PID');
  assert.equal(fallback.requestedPidReadyCount, 1);
  assert.equal(fallback.unattributedRecordCount, 4);
  assert.equal(fallback.attribution, 'partial');
  assert.equal(fallback.pidBound, false);
  assert.equal(fallback.timeSeparated, true);
  assert.equal(fallback.pidReuseExcluded, false);
  assert.equal(report.canonical.installedStoragePresent, false);
  assert.equal(report.canonical.route.allowed, false, 'later broad-log counts do not fill the original empty filtered log');
  noRawValues(report, [pid, otherPid, noPrefix, log]);
  const otherOnly = runFixture({ 'lineage-log': completed(''),
    'fallback-log': completed(pair(otherPrefix).join('\n')) }, { includeFallbacks: true });
  assert.equal(otherOnly.report.extra.fallbackLog.requestedPidIdentityCount, 0,
    'fully attributable records for another PID are not requested-PID records');
  assert.equal(otherOnly.report.extra.fallbackLog.requestedPidReadyCount, 0);
  assert.equal(otherOnly.report.extra.fallbackLog.attribution, 'complete');
  assert.equal(otherOnly.report.canonical.route.allowed, false);
  noRawValues(otherOnly.report, [pid, otherPid]);
});

test('fallback attribution never substitutes a payload processId for a missing OS PID/TID prefix', () => {
  const log = [
    `PRIVATE_NO_PREFIX /Reader: Core build identity: ${JSON.stringify({ ...identity, processId: pid })}`,
    `PRIVATE_NO_PREFIX /Reader: READER_STARTUP ${JSON.stringify({
      stage: 'startup.runtime-published', status: 'ready', processId: pid,
    })}`,
  ].join('\n');
  const { report } = runFixture({ 'lineage-log': completed(''), 'fallback-log': completed(log) }, { includeFallbacks: true });
  assert.equal(report.extra.fallbackLog.requestedPidIdentityCount, null,
    'unknown-prefix records cannot establish a negative count for requested PID');
  assert.equal(report.extra.fallbackLog.requestedPidReadyCount, null);
  assert.equal(report.extra.fallbackLog.unattributedRecordCount, 2);
  assert.equal(report.extra.fallbackLog.pidBound, false);
  assert.equal(report.extra.fallbackLog.timeSeparated, true);
  assert.equal(report.extra.fallbackLog.attribution, 'unavailable');
  assert.equal(report.extra.fallbackLog.pidReuseExcluded, false);
  assert.equal(report.canonical.route.allowed, false);
  noRawValues(report, [pid, 'PRIVATE_NO_PREFIX', log]);
});

test('copied identity or startup text inside an ordinary Reader message is not attributed to its outer OS PID', () => {
  const secret = 'PRIVATE_COPIED_READER_BODY_TOKEN';
  const log = [
    `${prefix}ordinary copied /Reader: Core build identity: ${JSON.stringify({ ...identity, secret })}`,
    `${prefix}ordinary copied /Reader: READER_STARTUP ${JSON.stringify({
      stage: 'startup.runtime-published', status: 'ready', secret,
    })}`,
  ].join('\n');
  const { report } = runFixture({ 'lineage-log': completed(''), 'fallback-log': completed(log) }, { includeFallbacks: true });
  const fallback = report.extra.fallbackLog;
  assert.equal(fallback.identityCount, 1, 'the unchanged legacy aggregate regex still sees the embedded text');
  assert.equal(fallback.readyCount, 1);
  assert.equal(fallback.requestedPidIdentityCount, 0, 'only an identity at the actual Reader message body start is attributable');
  assert.equal(fallback.requestedPidReadyCount, 0);
  assert.equal(fallback.unattributedRecordCount, 0, 'these are ordinary copied messages, not unprefixed genuine records');
  assert.equal(fallback.attribution, 'complete');
  assert.equal(fallback.pidBound, false);
  assert.equal(fallback.timeSeparated, true);
  assert.equal(fallback.pidReuseExcluded, false);
  assert.equal(report.canonical.installedStoragePresent, false);
  assert.equal(report.canonical.route.allowed, false);
  noRawValues(report, [pid, secret, log]);
});

test('fallback counts with missing identity or publication fields remain counts rather than usable runtime proof', () => {
  const secret = 'PRIVATE_MISSING_FIELDS_TOKEN';
  const log = [
    `${prefix}Core build identity: ${JSON.stringify({ schemaVersion: 1, secret })}`,
    `${prefix}READER_STARTUP ${JSON.stringify({ stage: 'startup.runtime-published', secret })}`,
    `${prefix}READER_STARTUP ${JSON.stringify({ status: 'ready', secret })}`,
    `${prefix}ordinary business message PRIVATE_ORDINARY_READER_LINE`,
  ].join('\n');
  const { report } = runFixture({ 'lineage-log': completed(''), 'fallback-log': completed(log) }, { includeFallbacks: true });
  const fallback = report.extra.fallbackLog;
  assert.equal(fallback.identityCount, 1, 'the established count is a matched identity line, not schema admission');
  assert.equal(fallback.requestedPidIdentityCount, 1);
  assert.equal(fallback.readyCount, 0, 'both stage and ready status are required to count a publication');
  assert.equal(fallback.requestedPidReadyCount, 0);
  assert.equal(fallback.unattributedRecordCount, 0, 'ordinary Reader messages are not identity/startup records');
  assert.equal(fallback.attribution, 'complete');
  assert.equal(fallback.pidBound, false);
  assert.equal(fallback.timeSeparated, true);
  assert.equal(fallback.pidReuseExcluded, false);
  assert.equal(report.canonical.installedStoragePresent, false);
  assert.equal(report.canonical.route.allowed, false);
  noRawValues(report, [pid, secret, 'PRIVATE_ORDINARY_READER_LINE', log]);
});

test('inaccessible marker directory cannot establish WAL or journal absence', () => {
  for (const markers of [markerSample({ readable: false }), markerSample({ searchable: false }),
    markerSample({ readable: false }).replace('directory-present=1', 'directory-present=0')]) {
    const { report } = runFixture({ 'header-read': completed(''), 'lineage-log': completed(''),
      'header-markers': completed(markers) });
    assert.equal(report.header.markerReason, 'header-sandbox-unresolved');
    assert.equal(report.header.walPresent, null, 'failed accessibility cannot be reported as WAL absence');
    assert.equal(report.header.journalPresent, null);
    assert.equal(report.canonical.route.allowed, false);
  }
});

test('the complete report cannot leak raw headers, paths, PIDs, errors, logs or spread identity extras', () => {
  const privateStorage = 'PRIVATE_STORAGE_EXTRA_TOKEN';
  const privateIdentity = 'PRIVATE_IDENTITY_EXTRA_TOKEN';
  const privateStage = 'PRIVATE_STAGE https://private.invalid/stage';
  const privateStatus = 'PRIVATE_STATUS';
  const sensitiveIdentity = { ...identity, privateIdentity,
    storageCompatibility: { ...compatibility, privateStorage } };
  const log = `${readyLog(sensitiveIdentity)}\n${eventLine(privateStage, privateStatus)}`;
  const f = runFixture({ 'lineage-log': completed(Buffer.from(log), {
    stderr: Buffer.from('PRIVATE_STDERR_TOKEN /data/app/secret/reader-core.sqlite3'),
  }) });
  assert.equal(f.report.canonical.route.allowed, true, 'ignored extras and an unrelated stage do not change canonical admission');
  assert.equal(f.report.lineage.lastStage, 'other');
  assert.equal(f.report.lineage.lastStatus, 'other');
  noRawValues(f.report, [privateStorage, privateIdentity, privateStage, privateStatus,
    'PRIVATE_STDERR_TOKEN', pid, cwd, headerSample(), log, 'b'.repeat(64)]);
  const fallback = runFixture({ 'lineage-log': completed(''),
    'fallback-log': completed(Buffer.from(log), { stderr: 'PRIVATE_FALLBACK_STDERR' }) }, { includeFallbacks: true });
  assert.equal(fallback.report.canonical.route.allowed, false);
  assert.equal(fallback.report.extra.fallbackLog.pidBound, false);
  assert.equal(fallback.report.query.extra.fallbackLog.stdoutBytes, Buffer.byteLength(log));
  noRawValues(fallback.report, [privateStorage, privateIdentity, privateStage, privateStatus,
    'PRIVATE_FALLBACK_STDERR', pid, '81243', log]);
  const error = new Error('PRIVATE_THROWN_MESSAGE https://private.invalid/key /data/app/secret');
  error.code = 'ENOENT';
  const fixture = probeFixture();
  const report = diagnoseStorageAdmission({ bundleName, uid, candidateStorage: compatibility,
    probeQuery: query => { fixture.calls.push(query); throw error; }, includeFallbacks: true });
  assert.equal(report.canonical.route.allowed, false);
  assert.ok(fixture.calls.length <= 8);
  noRawValues(report, [error.message, error.stack, 'PRIVATE_THROWN_MESSAGE']);
});

test('the exact production revalidation fence preserves target-storage-evidence-changed while new reports explain fixture subfailures', () => {
  // This reads one controlled source file, not a device or database. The CLI
  // still performs only its initial diagnosis; this test does not claim it
  // issued a second target query or acquired a revalidation receipt.
  const source = readFileSync(new URL('../hap-pipeline.mjs', import.meta.url), 'utf8');
  const start = '    if (route.allowed && (!installed.updateTime || JSON.stringify(installedMetadata(hdc, target)) !== JSON.stringify(installed) ||';
  assert.equal(source.split(start).length, 2, 'one exact unchanged production revalidation branch');
  const begin = source.indexOf(start);
  const ending = '\n    }';
  const end = source.indexOf(ending, begin);
  assert.ok(begin >= 0 && end > begin);
  const branch = source.slice(begin, end + ending.length);
  assert.ok(branch.includes("route = { allowed: false, reason: 'target-storage-evidence-changed' };"));
  const originalFence = new Function('route', 'installed', 'headerVersion', 'liveVersion',
    'installedStorage', 'targetSqliteVersion', 'installedMetadata', 'hdc', 'target',
    'readVersion', 'readLineage', `${branch}\nreturn route;`);
  const installed = { bundlePresent: true, bundleName, uid, updateTime: 1794380000000,
    appIdSha256: 'd'.repeat(64), appIdentifierSha256: 'e'.repeat(64) };
  const applyFence = (initial, observed, bmsAfter = installed) => {
    assert.equal(initial.report.canonical.route.allowed, true, 'every sample begins with real same-source admission');
    const calls = { bms: 0, header: 0, lineage: 0 };
    const result = originalFence({ ...initial.original.route }, installed,
      initial.original.headerVersion, initial.original.installedStorage?.sqliteUserVersion ?? null,
      initial.original.installedStorage, initial.original.targetSqliteVersion,
      (hdc, target) => {
        assert.equal(hdc, 'FIXTURE_HDC_ONLY'); assert.equal(target, 'FIXTURE_TARGET_ONLY');
        calls.bms++; return bmsAfter;
      }, 'FIXTURE_HDC_ONLY', 'FIXTURE_TARGET_ONLY',
      () => { calls.header++; return observed.original.headerVersion; },
      () => { calls.lineage++; return observed.original.installedStorage; });
    return { result, calls };
  };
  const expectedRefusal = { allowed: false, reason: 'target-storage-evidence-changed' };
  const fromHeader = runFixture();
  const fromLineage = runFixture({ 'header-read': completed('') });
  const stableHeader = applyFence(fromHeader, runFixture());
  assert.deepEqual(stableHeader.result, fromHeader.original.route);
  assert.deepEqual(stableHeader.calls, { bms: 1, header: 1, lineage: 0 });
  const stableLineage = applyFence(fromLineage, runFixture({ 'header-read': completed('') }));
  assert.deepEqual(stableLineage.result, fromLineage.original.route);
  assert.deepEqual(stableLineage.calls, { bms: 1, header: 0, lineage: 1 });

  const headerFailed = runFixture({ 'header-read': completed('', { status: 9 }) });
  assert.equal(headerFailed.report.header.reason, 'header-command-failed');
  assert.deepEqual(applyFence(fromHeader, headerFailed).result, expectedRefusal);
  assert.equal(headerFailed.report.canonical.route.allowed, true,
    'a fresh initial diagnostic may use live lineage; it cannot waive the production repeated-header fence');

  const headerChanged = runFixture({ 'header-read': completed(headerSample(48)) });
  assert.equal(headerChanged.report.header.reason, 'header-valid');
  assert.equal(headerChanged.report.header.version, 48);
  assert.deepEqual(applyFence(fromHeader, headerChanged).result, expectedRefusal);

  const lineageFailed = runFixture({ 'header-read': completed(''),
    'lineage-log': completed('', { status: null, error: { code: 'ETIMEDOUT' } }) });
  assert.equal(lineageFailed.report.lineage.reason, 'lineage-log-query-failed');
  assert.equal(lineageFailed.report.query.lineage.log.outcome, 'timeout');
  assert.deepEqual(applyFence(fromLineage, lineageFailed).result, expectedRefusal);

  const lineageChanged = runFixture({ 'header-read': completed(''), 'lineage-log': completed(readyLog({
    ...identity, storageCompatibility: { ...compatibility, sqliteStorageSourceSha256: 'f'.repeat(64) },
  })) });
  assert.equal(lineageChanged.report.lineage.reason, 'lineage-valid');
  assert.equal(lineageChanged.report.canonical.route.reason, 'core-storage-lineage-changed');
  assert.deepEqual(applyFence(fromLineage, lineageChanged).result, expectedRefusal);

  const badJson = runFixture({ 'header-read': completed(''), 'lineage-log': completed(
    `${prefix}Core build identity: {PRIVATE_REVALIDATION_BAD_JSON}\n${readyLog()}`) });
  assert.equal(badJson.report.lineage.reason, 'lineage-identity-invalid-json');
  assert.deepEqual(applyFence(fromLineage, badJson).result, expectedRefusal);
  noRawValues(badJson.report, ['PRIVATE_REVALIDATION_BAD_JSON']);

  const unchangedDiagnostic = runFixture();
  const changedBms = applyFence(fromHeader, unchangedDiagnostic,
    { ...installed, updateTime: installed.updateTime + 1 });
  assert.deepEqual(changedBms.result, expectedRefusal);
  assert.deepEqual(changedBms.calls, { bms: 1, header: 0, lineage: 0 });
  assert.equal(unchangedDiagnostic.report.canonical.route.allowed, true,
    'the local storage diagnostic makes no claim to classify BMS changes or execute canonical revalidation');
});
