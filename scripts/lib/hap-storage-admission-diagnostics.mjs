import {
  readInstalledSqliteVersion,
  readInstalledStorageLineage,
  storageUpdateRoute,
} from './hap-storage-admission.mjs';

// No subprocess, filesystem, device discovery or default invocation lives here.
// Only the supplied synchronous query port may observe an already-bound target.
const MAX_QUERIES = 8;
const CATEGORIES = new Set([
  'header-cwd', 'header-read', 'header-markers',
  'lineage-pid-before', 'lineage-log', 'lineage-pid-after',
  'fallback-ps', 'fallback-log',
]);
const bundleValid = value => typeof value === 'string' && /^[A-Za-z][A-Za-z0-9_.]+$/.test(value);
const uidValid = value => Number.isSafeInteger(value) && value > 0;
const stageEnum = value => value === 'startup.native-open' ? 'native-open' :
  value === 'startup.runtime-published' ? 'runtime-published' : 'other';
const statusEnum = value => ['start', 'ready', 'failed'].includes(value) ? value : 'other';
const bytes = value => typeof value === 'string' ? Buffer.from(value, 'utf8') :
  Buffer.isBuffer(value) || value instanceof Uint8Array ? Buffer.from(value) : Buffer.alloc(0);
const text = value => bytes(value).toString('utf8');

/** Explicit precedence: timeout, output limit, spawn/termination error,
 * nonzero exit, empty trimmed stdout, success. stderr is only counted: the
 * canonical capture accepts status0 stdout even when stderr is nonempty. */
export function summarizeProbeResult(result) {
  const value = result && typeof result === 'object' ? result : {};
  const code = value.error?.code;
  const timedOut = code === 'ETIMEDOUT' || code === 'ERR_CHILD_PROCESS_TIMEOUT';
  const outputLimit = code === 'ENOBUFS' || code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER';
  const exitCode = Number.isInteger(value.status) ? value.status : null;
  const stdout = bytes(value.stdout), stderr = bytes(value.stderr);
  const spawnError = Boolean(value.error) || exitCode === null ||
    (typeof value.signal === 'string' && value.signal.length > 0);
  const outcome = timedOut ? 'timeout' : outputLimit ? 'output-limit' :
    spawnError ? 'spawn-error' : exitCode !== 0 ? 'exit-nonzero' :
      stdout.toString('utf8').trim().length === 0 ? 'empty' : 'ok';
  return { outcome, exitCode, timedOut, stdoutBytes: stdout.length, stderrBytes: stderr.length };
}

const usable = summary => summary?.outcome === 'ok' || summary?.outcome === 'empty';

function sandboxContext(value, bundleName) {
  const match = /^\/mnt\/debug\/(0|[1-9]\d*)\/debug_hap\/([A-Za-z][A-Za-z0-9_.]+)$/.exec(value);
  return match?.[2] === bundleName ? match[1] : null;
}

function classifyHeaderOutput(value, uid, version) {
  if (version !== null) return 'header-valid';
  const lines = value.split(/\r?\n/);
  const metadata = /^(\d+):(\d+):(\d+):(\d+)$/.exec(lines[0] ?? '');
  if (metadata === null) return 'header-output-malformed';
  if (Number(metadata[1]) !== uid) return 'header-uid-mismatch';
  if (Number(metadata[3]) < 100) return 'header-too-small';
  if (lines.length < 2 || lines[0] !== lines.at(-1)) return 'header-stat-unstable';
  const fields = lines.slice(1, -1).join(' ').trim().split(/\s+/);
  if (fields.length !== 100 || fields.some(field => !/^\d{1,3}$/.test(field) || Number(field) > 255))
    return 'header-output-malformed';
  const header = Buffer.from(fields.map(Number));
  if (header.subarray(0, 16).toString('latin1') !== 'SQLite format 3\0') return 'header-magic-invalid';
  const observedVersion = header.readUInt32BE(60);
  return observedVersion <= 0 || observedVersion > 0x7fffffff ?
    'header-version-invalid' : 'header-output-malformed';
}

/** One fixed, SQL-free supplemental observation. Never hash/read a whole DB,
 * follow a DB symlink, inspect an intent, or read header bytes with a live WAL.
 * Marker output stays only in this invocation's memory. */
function headerMarkerCommand(user, bundleName) {
  const directory = `/data/app/el2/${user}/base/${bundleName}/haps/entry/files/reader-core`;
  const db = `${directory}/reader-core.sqlite3`;
  const flag = (name, condition) => `if ${condition}; then echo ${name}=1; else echo ${name}=0; fi`;
  return [
    'echo HSD_HEADER_MARKERS_V1',
    flag('directory-present', `test -d ${directory}`),
    flag('directory-readable', `test -r ${directory}`),
    flag('directory-searchable', `test -x ${directory}`),
    flag('db-present', `test -f ${db}`),
    flag('db-symlink', `test -L ${db}`),
    flag('wal-present', `test -s ${db}-wal`),
    flag('journal-present', `test -s ${db}-journal`),
    `if test -r ${directory} && test -x ${directory} && test -f ${db} && test ! -L ${db} && ` +
      `test ! -s ${db}-wal && test ! -s ${db}-journal; then ` +
      `echo STAT_BEFORE; stat -c '%u:%i:%s:%Y' ${db}; echo HEADER_100; ` +
      `od -An -v -N 100 -t u1 ${db}; echo STAT_AFTER; stat -c '%u:%i:%s:%Y' ${db}; ` +
      'else echo STAT_BEFORE; echo HEADER_100; echo STAT_AFTER; fi',
    'echo END',
  ].join('; ');
}

function classifyMarkers(value, summary, uid) {
  const result = { reason: 'header-markers-failed', walPresent: null, journalPresent: null };
  if (!usable(summary) || value.length === 0) return result;
  const lines = value.split(/\r?\n/);
  const keys = ['directory-present', 'directory-readable', 'directory-searchable', 'db-present',
    'db-symlink', 'wal-present', 'journal-present'];
  if (lines[0] !== 'HSD_HEADER_MARKERS_V1' || lines.at(-1) !== 'END') return result;
  const flags = {};
  for (let index = 0; index < keys.length; index++) {
    const match = new RegExp(`^${keys[index]}=([01])$`).exec(lines[index + 1] ?? '');
    if (match === null) return result;
    flags[keys[index]] = match[1] === '1';
  }
  // A failed test -s below an inaccessible directory says nothing about the
  // companion file. Preserve unknown rather than serializing a false absence.
  if (!flags['directory-present'] || !flags['directory-readable'] || !flags['directory-searchable']) {
    result.reason = 'header-sandbox-unresolved';
    return result;
  }
  result.walPresent = flags['wal-present'];
  result.journalPresent = flags['journal-present'];
  if (!flags['db-present']) result.reason = 'header-db-missing';
  else if (flags['db-symlink']) result.reason = 'header-path-unsafe';
  else if (flags['wal-present']) result.reason = 'header-wal-present';
  else if (flags['journal-present']) result.reason = 'header-journal-present';
  else {
    const before = lines.indexOf('STAT_BEFORE', 8), body = lines.indexOf('HEADER_100', before + 1);
    const after = lines.indexOf('STAT_AFTER', body + 1);
    if (before !== 8 || body <= before || after <= body) return { ...result, reason: 'header-markers-failed' };
    const first = lines.slice(before + 1, body), header = lines.slice(body + 1, after);
    const last = lines.slice(after + 1, -1);
    if (first.length !== 1 || last.length !== 1) return { ...result, reason: 'header-output-malformed' };
    // The supplemental version is deliberately never returned. It cannot fill
    // the canonical null or change the route established before this query.
    const joined = [...first, ...header, ...last].join('\n');
    const observed = readInstalledSqliteVersion({ bundleName: 'io.reader.diagnostic', uid,
      querySandbox: command => command === 'pwd' ? '/mnt/debug/0/debug_hap/io.reader.diagnostic' : joined });
    result.reason = classifyHeaderOutput(joined, uid, observed);
  }
  return result;
}

function validIdentity(value) {
  const storage = value?.storageCompatibility;
  return value?.schemaVersion === 1 && typeof value?.buildId === 'string' && /^[0-9a-f]{64}$/.test(value.buildId) &&
    Number.isSafeInteger(storage?.sqliteMaxUserVersion) && storage.sqliteMaxUserVersion > 0 &&
    storage.sqliteMaxUserVersion <= 0x7fffffff &&
    typeof storage?.sqliteStorageSourceSha256 === 'string' && /^[0-9a-f]{64}$/.test(storage.sqliteStorageSourceSha256);
}

function pidState(value) {
  if (/^[1-9]\d*$/.test(value)) return 'single';
  if (/^[1-9]\d*(?:\s+[1-9]\d*)+$/.test(value)) return 'ambiguous';
  return 'unavailable';
}

/** Count/describe observed records, but never replay them into admission.
 * In particular a historical matching bad JSON remains fatal in the real
 * reader even when this diagnostic can see a later good session. */
function scanLineage(value) {
  const result = { identityCount: 0, readyCount: 0, lastStage: null, lastStatus: null,
    malformedCount: 0, historicalMalformedBeforeLatestOpen: false, warningReasons: [] };
  let firstFatal = null, firstFatalKind = null, latestOpen = -1, latestIdentity = -1;
  let schemaValid = false, latestPublication = null, finalReset = false;
  const lines = value.split(/\r?\n/);
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const identity = /\/Reader: Core build identity: (\{.+\})$/.exec(line);
    const event = /\/Reader: READER_STARTUP (\{.+\})$/.exec(line);
    if (identity === null && event === null) {
      if (line.includes('/Reader: Core build identity:') || line.includes('/Reader: READER_STARTUP')) {
        result.malformedCount++;
        if (!result.warningReasons.includes('lineage-malformed-line')) result.warningReasons.push('lineage-malformed-line');
      }
      continue;
    }
    if (identity !== null) result.identityCount++;
    let data;
    try { data = JSON.parse((identity ?? event)[1]); }
    catch {
      result.malformedCount++;
      if (firstFatal === null) { firstFatal = index; firstFatalKind = identity !== null ? 'identity' : 'startup'; }
      continue;
    }
    if (identity !== null) {
      latestIdentity = index; schemaValid = validIdentity(data); latestPublication = null; finalReset = false;
    } else {
      result.lastStage = stageEnum(data.stage); result.lastStatus = statusEnum(data.status);
      if (data.stage === 'startup.native-open') {
        latestOpen = index; finalReset = latestIdentity >= 0;
        schemaValid = false; latestPublication = null;
      } else if (data.stage === 'startup.runtime-published') {
        latestPublication = data.status === 'ready';
        if (latestPublication) result.readyCount++;
      }
    }
  }
  result.historicalMalformedBeforeLatestOpen = firstFatal !== null && firstFatal < latestOpen;
  const rejection = firstFatal !== null ? firstFatalKind === 'identity' ?
    'lineage-identity-invalid-json' : 'lineage-malformed-line' :
    finalReset && latestOpen > latestIdentity ? 'lineage-session-reset' :
      result.identityCount === 0 ? 'lineage-identity-missing' :
        !schemaValid ? 'lineage-identity-invalid-schema' :
          latestPublication === false ? 'lineage-ready-not-ready' : 'lineage-ready-missing';
  return { facts: result, rejection };
}

function emptyLineage() {
  return { reason: 'lineage-not-queried', pidState: 'not-queried', logBytes: 0,
    identityCount: 0, readyCount: 0, lastStage: null, lastStatus: null,
    malformedCount: 0, historicalMalformedBeforeLatestOpen: false,
    warningReasons: [], canonicalRejected: true };
}

/** Supplemental wide output can describe only records with a recognizable
 * OS timestamp/PID/TID prefix. JSON processId or text embedded in a payload
 * never supplies attribution. Even a numeric PID match is not a process-
 * lifetime proof and cannot replace the earlier PID-filtered canonical query. */
function attributeWideLog(value, requestedPid) {
  const result = { requestedPidIdentityCount: null, requestedPidReadyCount: null,
    unattributedRecordCount: 0, attribution: 'not-requested',
    timeSeparated: true, pidReuseExcluded: false };
  const prefix = /^(?:\d{4}-)?(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])[ \t]+(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d\.\d{3,9}[ \t]+([1-9]\d{0,9})[ \t]+[1-9]\d{0,9}[ \t]+[DIWEF][ \t]+[A-Za-z][A-Fa-f0-9]{3,15}\/Reader:[ \t]+/;
  let reliablePrefixes = 0, identities = 0, ready = 0;
  for (const line of value.split(/\r?\n/)) {
    const owner = prefix.exec(line);
    if (owner !== null) reliablePrefixes++;
    if (!line.includes('/Reader: Core build identity:') && !line.includes('/Reader: READER_STARTUP')) continue;
    if (owner === null) { result.unattributedRecordCount++; continue; }
    if (owner[1] !== requestedPid) continue;
    const body = line.slice(owner[0].length);
    if (/^Core build identity: (\{.+\})$/.test(body)) identities++;
    const event = /^READER_STARTUP (\{.+\})$/.exec(body);
    if (event !== null) {
      try {
        const data = JSON.parse(event[1]);
        if (data.stage === 'startup.runtime-published' && data.status === 'ready') ready++;
      } catch { /* Countable prefix does not make malformed JSON a ready fact. */ }
    }
  }
  if (pidState(requestedPid ?? '') !== 'single') return result;
  if (reliablePrefixes === 0) { result.attribution = 'unavailable'; return result; }
  result.attribution = result.unattributedRecordCount > 0 ? 'partial' : 'complete';
  // Unknown-prefix records might belong to the requested numeric PID. A zero
  // is therefore unknown, while an observed positive count remains a lower
  // bound. Other reliably attributed PIDs are never counted as this one.
  result.requestedPidIdentityCount = result.unattributedRecordCount > 0 && identities === 0 ? null : identities;
  result.requestedPidReadyCount = result.unattributedRecordCount > 0 && ready === 0 ? null : ready;
  return result;
}

function classifyLineage(records, installedStorage) {
  const result = emptyLineage();
  const before = records.get('lineage-pid-before');
  if (before === undefined) return result;
  result.pidState = pidState(before.value);
  const log = records.get('lineage-log'), after = records.get('lineage-pid-after');
  if (log !== undefined) {
    result.logBytes = log.summary.stdoutBytes;
    Object.assign(result, scanLineage(log.value).facts);
  }
  if (!usable(before.summary)) {
    result.pidState = 'unavailable'; result.reason = 'lineage-pid-query-failed';
  } else if (result.pidState !== 'single') {
    result.reason = result.pidState === 'ambiguous' ? 'lineage-pid-ambiguous' : 'lineage-pid-unavailable';
  } else if (!usable(after?.summary)) {
    result.pidState = 'unavailable'; result.reason = 'lineage-pid-query-failed';
  } else if (after.value !== before.value) {
    result.pidState = 'changed'; result.reason = 'lineage-pid-changed';
  } else if (log?.summary.outcome === 'output-limit') result.reason = 'lineage-log-over-limit';
  else if (!usable(log?.summary)) result.reason = 'lineage-log-query-failed';
  else if (log.value.length === 0) result.reason = 'lineage-log-empty';
  else if (installedStorage !== null) {
    result.reason = installedStorage.sqliteUserVersion === null ? 'lineage-version-unresolved' : 'lineage-valid';
  } else result.reason = scanLineage(log.value).rejection;
  result.canonicalRejected = installedStorage === null;
  return result;
}

function classifyPs(record, uid) {
  const result = { reason: 'fallback-query-failed', matchingUidCount: null };
  if (!usable(record.summary)) return result;
  const lines = record.value.split(/\r?\n/);
  if (!/^\s*UID\s+PID\s*$/.test(lines.shift() ?? '') || lines.some(line => !/^\s*\d+\s+\d+\s*$/.test(line)))
    return { ...result, reason: 'fallback-output-malformed' };
  result.reason = 'fallback-observed';
  result.matchingUidCount = lines.filter(line => Number(line.trim().split(/\s+/)[0]) === uid).length;
  return result;
}

/** Predict the unmodified same-source route using exactly the values returned
 * by the real legacy readers. Additional observations are time-separated and
 * diagnostic-only: they never replace a value, PID, log or refusal. */
export function diagnoseStorageAdmission({ bundleName, uid, candidateStorage, probeQuery, includeFallbacks = false } = {}) {
  if (typeof probeQuery !== 'function') throw new TypeError('DIAGNOSTIC_QUERY_REQUIRED');
  const records = new Map();
  const report = {
    schema: 'reader.hap-storage-admission-diagnostic.v1',
    query: { header: { cwd: null, read: null },
      lineage: { pidBefore: null, log: null, pidAfter: null },
      extra: { headerMarkers: null, fallbackPs: null, fallbackLog: null } },
    header: { reason: 'header-input-invalid', canonicalReason: 'header-input-invalid', version: null,
      walPresent: null, journalPresent: null, markerReason: null, markerTimeSeparated: false },
    lineage: emptyLineage(),
    canonical: null, routePrediction: null,
    extra: { fallbackPs: null, fallbackLog: null, admissionUse: 'diagnostic-only' },
    queryCount: 0, queryLimit: MAX_QUERIES,
  };
  const slots = {
    'header-cwd': ['header', 'cwd'], 'header-read': ['header', 'read'],
    'lineage-pid-before': ['lineage', 'pidBefore'], 'lineage-log': ['lineage', 'log'],
    'lineage-pid-after': ['lineage', 'pidAfter'], 'header-markers': ['extra', 'headerMarkers'],
    'fallback-ps': ['extra', 'fallbackPs'], 'fallback-log': ['extra', 'fallbackLog'],
  };
  const observe = (category, command, sandbox) => {
    if (!CATEGORIES.has(category) || records.has(category) || report.queryCount >= MAX_QUERIES)
      throw new Error('DIAGNOSTIC_QUERY_SCOPE_VIOLATION');
    report.queryCount++;
    let result;
    try { result = probeQuery({ category, command, sandbox }); }
    catch { result = { status: null, error: { code: 'DIAGNOSTIC_QUERY_EXCEPTION' }, stdout: '', stderr: '' }; }
    const summary = summarizeProbeResult(result);
    const value = usable(summary) ? text(result?.stdout).trim() : '';
    const record = { summary, value };
    records.set(category, record);
    const [group, name] = slots[category]; report.query[group][name] = summary;
    return value;
  };
  let headerCall = 0, lineageCall = 0;
  const headerVersion = readInstalledSqliteVersion({ bundleName, uid, querySandbox: command =>
    observe(headerCall++ === 0 ? 'header-cwd' : 'header-read', command, true) });
  const installedStorage = candidateStorage && (headerVersion === null ||
    headerVersion <= candidateStorage.sqliteMaxUserVersion) ?
    readInstalledStorageLineage({ bundleName, query: command => observe(
      ['lineage-pid-before', 'lineage-log', 'lineage-pid-after'][lineageCall++], command, false) }) : null;
  const liveVersion = installedStorage?.sqliteUserVersion ?? null;
  const targetSqliteVersion = headerVersion ?? liveVersion;
  const route = storageUpdateRoute({ targetSqliteVersion, installedStorage, candidateStorage });
  report.canonical = { headerVersion, installedStoragePresent: installedStorage !== null,
    targetSqliteVersion, versionSource: headerVersion !== null ? 'stable-sqlite-header' :
      liveVersion !== null ? 'installed-core' : null, route: { ...route } };
  report.routePrediction = { ...route };
  report.lineage = classifyLineage(records, installedStorage);
  const cwd = records.get('header-cwd'), read = records.get('header-read');
  const user = sandboxContext(cwd?.value ?? '', bundleName);
  report.header.version = headerVersion;
  report.header.reason = headerVersion !== null ? 'header-valid' :
    !bundleValid(bundleName) || !uidValid(uid) ? 'header-input-invalid' :
      user === null ? 'header-sandbox-unresolved' :
        !usable(read?.summary) ? 'header-command-failed' : classifyHeaderOutput(read.value, uid, headerVersion);
  report.header.canonicalReason = report.header.reason;
  if (headerVersion === null && user !== null && bundleValid(bundleName) && uidValid(uid)) {
    const value = observe('header-markers', headerMarkerCommand(user, bundleName), true);
    const observed = classifyMarkers(value, records.get('header-markers').summary, uid);
    report.header.markerReason = observed.reason;
    report.header.walPresent = observed.walPresent;
    report.header.journalPresent = observed.journalPresent;
    report.header.markerTimeSeparated = true;
  }
  if (includeFallbacks === true && !route.allowed) {
    const initialPid = records.get('lineage-pid-before');
    if (usable(initialPid?.summary) && pidState(initialPid.value) !== 'single' && uidValid(uid)) {
      observe('fallback-ps', 'ps -A -o UID,PID', false);
      report.extra.fallbackPs = classifyPs(records.get('fallback-ps'), uid);
    }
    if (records.get('lineage-log')?.summary.outcome === 'empty') {
      const value = observe('fallback-log', 'hilog -x -T Reader', false);
      const summary = records.get('fallback-log').summary;
      const reason = summary.outcome === 'output-limit' ? 'fallback-log-over-limit' :
        !usable(summary) ? 'fallback-query-failed' : value.length === 0 ? 'fallback-log-empty' : 'fallback-observed';
      const requestedPid = records.get('lineage-pid-before')?.value;
      report.extra.fallbackLog = { reason, ...scanLineage(value).facts,
        ...attributeWideLog(value, requestedPid), pidBound: false };
    }
  }
  return report;
}
