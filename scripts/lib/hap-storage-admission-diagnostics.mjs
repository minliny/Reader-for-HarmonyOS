import { readInstalledStorageLineage, storageUpdateRoute } from './hap-storage-admission.mjs';

// Observation only. Formal upgrade authority is a bound transition proof.
const MAX_QUERIES = 8;
const CATEGORIES = new Set(['header-cwd', 'header-markers', 'lineage-pid-before', 'lineage-log',
  'lineage-pid-after', 'fallback-ps', 'fallback-log']);
const bundleValid = value => typeof value === 'string' && /^[A-Za-z][A-Za-z0-9_.]+$/.test(value);
const uidValid = value => Number.isSafeInteger(value) && value > 0;
const stageEnum = value => value === 'startup.native-open' ? 'native-open' : value === 'startup.runtime-published' ? 'runtime-published' : 'other';
const statusEnum = value => ['start', 'ready', 'failed'].includes(value) ? value : 'other';
const bytes = value => Buffer.isBuffer(value) ? value : value instanceof Uint8Array ? Buffer.from(value) : Buffer.from(typeof value === 'string' ? value : '');
const observedBytes = (value, fallback) => Number.isSafeInteger(value) && value >= 0 ? value : fallback;
const READER_PREFIX = /^(?:\d{4}-)?(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])[ \t]+(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d\.\d{3,9}[ \t]+([1-9]\d{0,9})[ \t]+[1-9]\d{0,9}[ \t]+[DIWEF][ \t]+[A-Za-z][A-Fa-f0-9]{3,15}\/Reader:[ \t]+/;

export function summarizeProbeResult(result) {
  const value = result && typeof result === 'object' ? result : {};
  const code = value.error?.code;
  const timedOut = code === 'ETIMEDOUT' || code === 'ERR_CHILD_PROCESS_TIMEOUT';
  const outputLimit = code === 'ENOBUFS' || code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER';
  const clientExitCode = Number.isInteger(value.status) ? value.status : null;
  const stdout = bytes(value.stdout), stderr = bytes(value.stderr);
  const clientOutcome = timedOut ? 'timeout' : outputLimit ? 'output-limit' :
    code === 'DIAGNOSTIC_CANCELLED' ? 'cancelled' : value.error || clientExitCode === null || value.signal ? 'spawn-error' :
      clientExitCode !== 0 ? 'exit-nonzero' : stdout.toString('utf8').trim() ? 'ok' : 'empty';
  const remoteState = value.frameRequired ? value.remoteState === 'success' ? 'success' : value.remoteState === 'failure' ? 'failure' : 'unknown' : 'not-observed';
  const outcome = !['ok', 'empty'].includes(clientOutcome) ? clientOutcome : value.frameRequired && remoteState !== 'success' ?
    remoteState === 'failure' ? 'remote-nonzero' : 'remote-unknown' : clientOutcome;
  return { outcome, clientOutcome, clientExitCode, remoteExitCode: value.frameRequired && Number.isInteger(value.remoteExitCode) ? value.remoteExitCode : null,
    remoteState, frameState: value.frameRequired ? value.frameState === 'valid' ? 'valid' : value.frameState === 'client-failed' ? 'client-failed' : 'invalid' : 'not-requested', timedOut,
    stdoutBytes: observedBytes(value.rawStdoutBytes, stdout.length), stderrBytes: observedBytes(value.rawStderrBytes, stderr.length),
    payloadStdoutBytes: observedBytes(value.payloadStdoutBytes, stdout.length) };
}
const usable = summary => ['ok', 'empty'].includes(summary?.outcome) && summary.remoteState === 'success';

// Synthetic metadata parser only. No query API invokes a byte reader.
export function parseSyntheticSqliteHeader(value) {
  if (!Buffer.isBuffer(value) || value.length !== 100 || value.subarray(0, 16).toString('latin1') !== 'SQLite format 3\0') return null;
  const version = value.readUInt32BE(60); return version > 0 && version <= 0x7fffffff ? version : null;
}
function sandboxContext(value, bundleName) {
  const match = /^\/mnt\/debug\/(0|[1-9]\d*)\/debug_hap\/([A-Za-z][A-Za-z0-9_.]+)$/.exec(value);
  return match?.[2] === bundleName ? match[1] : null;
}
function headerMarkerCommand(user, bundleName) {
  const directory = `/data/app/el2/${user}/base/${bundleName}/haps/entry/files/reader-core`, db = `${directory}/reader-core.sqlite3`;
  const flag = (name, condition) => `if ${condition}; then echo ${name}=1; else echo ${name}=0; fi`;
  return ['echo RSD_HEADER_FLAGS_V2', flag('directory-present', `test -d ${directory}`),
    flag('directory-readable', `test -r ${directory}`), flag('directory-searchable', `test -x ${directory}`),
    flag('db-symlink', `test -L ${db}`), flag('db-present', `test ! -L ${db} && test -f ${db}`),
    flag('wal-symlink', `test -L ${db}-wal`), flag('journal-symlink', `test -L ${db}-journal`),
    flag('wal-nonempty', `test ! -L ${db}-wal && test -s ${db}-wal`),
    flag('journal-nonempty', `test ! -L ${db}-journal && test -s ${db}-journal`), 'echo END'].join('; ');
}
function classifyMarkers(value, summary) {
  const result = { reason: 'header-markers-unavailable', walPresent: null, journalPresent: null, dbSymlink: null,
    timeSeparated: true, byteRead: 'NOT_RUN_SAFETY_BOUNDARY' };
  if (!usable(summary)) return result;
  const lines = value.split(/\r?\n/), keys = ['directory-present', 'directory-readable', 'directory-searchable', 'db-symlink',
    'db-present', 'wal-symlink', 'journal-symlink', 'wal-nonempty', 'journal-nonempty'];
  if (lines.length !== keys.length + 2 || lines[0] !== 'RSD_HEADER_FLAGS_V2' || lines.at(-1) !== 'END') return result;
  const flags = {};
  for (let i = 0; i < keys.length; i++) { const m = new RegExp(`^${keys[i]}=([01])$`).exec(lines[i + 1]); if (!m) return result; flags[keys[i]] = m[1] === '1'; }
  if (!flags['directory-present'] || !flags['directory-readable'] || !flags['directory-searchable']) return { ...result, reason: 'header-sandbox-unresolved' };
  result.dbSymlink = flags['db-symlink'];
  if (flags['db-symlink'] || flags['wal-symlink'] || flags['journal-symlink']) return { ...result, reason: 'header-path-unsafe' };
  result.walPresent = flags['wal-nonempty']; result.journalPresent = flags['journal-nonempty'];
  result.reason = !flags['db-present'] ? 'header-db-missing' : flags['wal-nonempty'] ? 'header-wal-present' :
    flags['journal-nonempty'] ? 'header-journal-present' : 'header-flags-observed';
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
function scanLineage(value, requestedPid) {
  const result = { identityCount: 0, readyCount: 0, lastStage: null, lastStatus: null,
    malformedCount: 0, historicalMalformedBeforeLatestOpen: false, warningReasons: [] };
  let firstFatal = null, firstFatalKind = null, latestOpen = -1, latestIdentity = -1;
  let schemaValid = false, latestPublication = null, finalReset = false;
  const lines = value.split(/\r?\n/);
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const metadata = READER_PREFIX.exec(line);
    if (requestedPid !== undefined && metadata?.[1] !== requestedPid) continue;
    const body = metadata === null ? '' : line.slice(metadata[0].length);
    const identity = /^Core build identity: (\{.+\})$/.exec(body);
    const event = /^READER_STARTUP (\{.+\})$/.exec(body);
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
  let reliablePrefixes = 0, identities = 0, ready = 0;
  for (const line of value.split(/\r?\n/)) {
    const owner = READER_PREFIX.exec(line);
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
    result.logBytes = log.summary.payloadStdoutBytes;
    Object.assign(result, scanLineage(log.value, before.value).facts);
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
  } else result.reason = scanLineage(log.value, before.value).rejection;
  result.canonicalRejected = installedStorage === null;
  return result;
}

function classifyPs(record, uid) {
  const result = { reason: 'fallback-query-failed', matchingUidCount: null };
  if (!usable(record.summary)) return result;
  const lines = record.value.split(/\r?\n/);
  if (!/^\s*UID\s+PID\s*$/.test(lines.shift() ?? '') || lines.length === 0 || lines.some(line => !/^\s*\d+\s+\d+\s*$/.test(line)))
    return { ...result, reason: 'fallback-output-malformed' };
  result.reason = 'fallback-observed';
  result.matchingUidCount = lines.filter(line => Number(line.trim().split(/\s+/)[0]) === uid).length;
  return result;
}


// Replay only the pure synchronous lineage reader's already-observed values.
// Each missing ordinal becomes one async query; PID before/after stay distinct.
async function observeLineage(bundleName, observe) {
  const values = [], need = Symbol('next-finite-query');
  for (let step = 0; step <= 3; step++) {
    let cursor = 0;
    try {
      return readInstalledStorageLineage({ bundleName, query: command => {
        const index = cursor++;
        if (index < values.length) { if (values[index].command !== command) throw Error('LINEAGE_QUERY_CHANGED'); return values[index].value; }
        throw { token: need, command, index };
      } });
    } catch (request) {
      if (request?.token !== need || request.index !== values.length || request.index >= 3) throw Error('LINEAGE_OBSERVATION_FAILED');
      const category = ['lineage-pid-before', 'lineage-log', 'lineage-pid-after'][request.index];
      values.push({ command: request.command, value: await observe(category, request.command, false) });
    }
  }
  throw Error('LINEAGE_OBSERVATION_FAILED');
}

export async function diagnoseStorageAdmission({ bundleName, uid, candidateStorage, probeQuery, includeFallbacks = false, lineageOnly = false } = {}) {
  if (typeof probeQuery !== 'function') throw Error('DIAGNOSTIC_QUERY_REQUIRED');
  const records = new Map();
  const report = { schema: 'reader.hap-storage-admission-diagnostic.v2', query: { header: { cwd: null, read: null },
    lineage: { pidBefore: null, log: null, pidAfter: null }, extra: { headerMarkers: null, fallbackPs: null, fallbackLog: null } },
    header: { selected: !lineageOnly, action: 'NOT_RUN_SAFETY_BOUNDARY', status: lineageOnly ? 'NOT_SELECTED' : 'FAIL',
      reason: 'HEADER_READ_AUTHORITY_RETIRED', version: null, markers: null },
    selectedHeader: { status: lineageOnly ? 'NOT_SELECTED' : 'FAIL', action: 'NOT_RUN_SAFETY_BOUNDARY' },
    lineage: emptyLineage(), canonical: { status: 'NOT_RUN', reason: 'LOG_AND_HEADER_AUTHORITY_RETIRED' },
    routePrediction: null, routePredictionScope: 'transition-only-policy-preview', installAuthority: false,
    extra: { fallbackPs: null, fallbackLog: null, admissionUse: 'diagnostic-only' }, queryCount: 0, queryLimit: MAX_QUERIES };
  const slots = { 'header-cwd': ['header', 'cwd'], 'header-markers': ['extra', 'headerMarkers'],
    'lineage-pid-before': ['lineage', 'pidBefore'], 'lineage-log': ['lineage', 'log'], 'lineage-pid-after': ['lineage', 'pidAfter'],
    'fallback-ps': ['extra', 'fallbackPs'], 'fallback-log': ['extra', 'fallbackLog'] };
  const observe = async (category, command, sandbox) => {
    if (!CATEGORIES.has(category) || records.has(category) || report.queryCount >= MAX_QUERIES) throw Error('DIAGNOSTIC_QUERY_SCOPE_VIOLATION');
    report.queryCount++;
    let result; try { result = await probeQuery({ category, command, sandbox }); }
    catch { result = { status: null, error: { code: 'DIAGNOSTIC_QUERY_EXCEPTION' }, frameRequired: true }; }
    const summary = summarizeProbeResult(result);
    const value = usable(summary) ? bytes(result?.stdout).toString('utf8').trim() : '';
    records.set(category, { summary, value }); const [group, name] = slots[category]; report.query[group][name] = summary;
    return value;
  };
  if (!lineageOnly && bundleValid(bundleName) && uidValid(uid)) {
    const cwd = await observe('header-cwd', 'pwd', true), user = sandboxContext(cwd, bundleName);
    if (user !== null) { const value = await observe('header-markers', headerMarkerCommand(user, bundleName), true);
      report.header.markers = classifyMarkers(value, records.get('header-markers').summary); }
  }
  const installedStorage = await observeLineage(bundleName, observe);
  report.lineage = classifyLineage(records, installedStorage);
  report.lineage.observationOnly = true;
  report.lineage.observedVersion = installedStorage?.sqliteUserVersion ?? null;
  const policy = storageUpdateRoute({ targetSqliteVersion: installedStorage?.sqliteUserVersion ?? null, candidateStorage });
  if (policy.allowed) throw Error('DIAGNOSTIC_AUTHORITY_VIOLATION');
  report.routePrediction = { allowed: false, reason: policy.reason };
  if (includeFallbacks) {
    const initial = records.get('lineage-pid-before');
    if (usable(initial?.summary) && pidState(initial.value) !== 'single' && uidValid(uid)) {
      await observe('fallback-ps', 'ps -A -o UID,PID', false); report.extra.fallbackPs = classifyPs(records.get('fallback-ps'), uid);
    }
    if (records.get('lineage-log')?.summary.outcome === 'empty') {
      const value = await observe('fallback-log', 'hilog -x -T Reader', false), summary = records.get('fallback-log').summary;
      report.extra.fallbackLog = { reason: !usable(summary) ? 'fallback-query-failed' : value ? 'fallback-observed' : 'fallback-log-empty',
        ...scanLineage(value).facts, ...attributeWideLog(value, initial?.value), pidBound: false };
    }
  }
  return report;
}
