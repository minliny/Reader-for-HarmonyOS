#!/usr/bin/env node
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, parse, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const bundle = 'io.reader.minliny';
const digest = value => createHash('sha256').update(value).digest('hex');
const safeCode = Symbol('diagnostic-safe-error-code');
const fixedError = code => Object.assign(new Error(code), { [safeCode]: code });
const save = (path, value, exclusive = false) => writeFileSync(path, JSON.stringify(value, null, 2) + '\n',
  { mode: 0o600, ...(exclusive ? { flag: 'wx' } : {}) });
const regular = path => {
  const stat = lstatSync(path);
  if (!stat.isFile() || stat.isSymbolicLink()) throw fixedError('input-not-regular-file');
  return stat;
};

export function parseDiagnosticArgs(argv) {
  if (argv.length === 0 || (argv.length === 1 && argv[0] === '--list')) return { list: true };
  const names = new Set(['--run', '--target', '--hdc', '--server-key', '--vm-log', '--manifest',
    '--authorization', '--output-dir', '--include-fallbacks']);
  const flags = new Set(['--run', '--include-fallbacks']);
  const result = {};
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    if (!names.has(key) || Object.hasOwn(result, key)) throw fixedError('invalid-cli-selection');
    if (flags.has(key)) result[key] = true;
    else {
      const value = argv[++i];
      if (!value || value.startsWith('--') || /[\0\r\n]/.test(value)) throw fixedError('invalid-cli-selection');
      result[key] = value;
    }
  }
  if (result['--run'] !== true || [...names].filter(key => !flags.has(key)).some(key => !result[key])) {
    throw fixedError('explicit-run-and-bound-inputs-required');
  }
  for (const key of ['--hdc', '--vm-log', '--manifest', '--authorization', '--output-dir']) {
    if (!isAbsolute(result[key]) || resolve(result[key]) === parse(result[key]).root) throw fixedError('absolute-input-path-required');
  }
  if (/\.(?:[cm]?js|cmd|bat)$/i.test(result['--hdc'])) throw fixedError('native-hdc-binary-required');
  if (!/^(?:127\.0\.0\.1|\[::1\]):[1-9]\d{0,4}$/.test(result['--target']) ||
      Number(result['--target'].split(':').at(-1)) > 65535) throw fixedError('explicit-loopback-vm-target-required');
  if (!/^[A-Za-z0-9.:[\]-]{1,256}$/.test(result['--server-key'])) throw fixedError('invalid-server-key');
  return result;
}

export function validateDiagnosticAuthorization(auth, options, binding, now = Date.now()) {
  const require = (condition, code) => { if (!condition) throw fixedError(code); };
  const reference = value => digest(value).slice(0, 12);
  require(auth?.schema === 'reader.storage-admission-diagnostic-authorization.v1' &&
    auth.status === 'AUTHORIZED' && auth.action === 'READ_ONLY_STORAGE_ADMISSION_DIAGNOSTIC_ONCE' &&
    auth.scopeClosed === false && typeof auth.approvalReference === 'string' && auth.approvalReference.length >= 8,
  'new-explicit-readonly-authorization-required');
  require(auth.bundleName === bundle && auth.targetRef === reference(options['--target']) &&
    auth.serverRef === reference(options['--server-key'].replace(/^::ffff:/, '').replace(/^\[|\]$/g, '')),
  'authorization-target-mismatch');
  require(auth.manifestSha256 === binding.manifestSha256 && auth.hapSha256 === binding.hapSha256 &&
    auth.hdcSha256 === binding.hdcSha256,
    'authorization-candidate-mismatch');
  require(Number.isSafeInteger(auth.incumbent?.uid) && auth.incumbent.uid > 0 &&
    /^\d+\.\d+\.\d+\.(?:DEV|RC|REL)\.[0-9a-f]{12}$/.test(auth.incumbent.appBuildId ?? '') &&
    /^[0-9a-f]{64}$/.test(auth.incumbent.appIdSha256 ?? '') &&
    Number.isSafeInteger(auth.incumbent.updateTime) && auth.incumbent.updateTime > 0,
  'authorization-incumbent-identity-required');
  const limits = auth.limits;
  require(limits?.businessQueries === 9 && limits.preflightQueries === 10 && limits.appStarts === 0 &&
    limits.appStops === 0 && limits.installs === 0 && limits.databaseCopies === 0 && limits.sql === 0 &&
    limits.intentReads === 0, 'authorization-limits-mismatch');
  require(auth.includeFallbacks === (options['--include-fallbacks'] === true), 'authorization-fallback-mismatch');
  const vm = auth.vmConfirmation, time = Date.parse(vm?.confirmedAt);
  require(vm?.vmName && /^[0-9a-f]{64}$/.test(vm.instanceRef ?? '') && vm.targetRef === auth.targetRef &&
    vm.vmLog === options['--vm-log'] && Number.isFinite(time) && time <= now && now - time <= 120_000,
  'fresh-operator-vm-confirmation-required');
}

async function runtimePorts() {
  const [transport, lease, evidence, pipeline, diagnostic] = await Promise.all([
    import('../scripts/lib/harmony-toolchain.mjs'), import('./reader-hdc-lease.mjs'),
    import('../scripts/lib/hap-delivery-evidence.mjs'), import('../scripts/hap-pipeline.mjs'),
    import('../scripts/lib/hap-storage-admission-diagnostics.mjs'),
  ]);
  return { spawn: transport.portableSpawnSync, ...lease, targetReadiness: evidence.targetReadiness,
    parseBundleMetadata: pipeline.parseBundleMetadata, ...diagnostic };
}

// A receipt is a one-use operator guard, not an independent grant of permission.
// The operator must first obtain new user approval and freshly confirm the VM.
export async function runDiagnosticCli(argv, injected = {}) {
  const stdout = injected.stdout ?? (value => process.stdout.write(value + '\n'));
  let options;
  try { options = parseDiagnosticArgs(argv); }
  catch (error) { stdout(JSON.stringify({ status: 'FAIL', reason: error?.[safeCode] ?? 'invalid-cli-selection' })); return 2; }
  if (options.list) {
    stdout(JSON.stringify({ status: 'NOT_RUN', action: 'read-only-storage-admission-diagnostic',
      deviceQueries: 0, requiresNewAuthorization: true, businessQueryMaximum: 9,
      preflightQueryMaximum: 10, installAuthority: false }));
    return 0;
  }
  let claimed = false, outputCreated = false, ports, lease, owner, leaseRoot;
  let preflightQueries = 0, businessQueries = 0;
  const preflight = [];
  const output = resolve(options['--output-dir']);
  const claimPath = options['--authorization'] + '.consumed.json';
  let finalStatus = 'FAIL', finalReason = 'local-input-rejected';
  try {
    const authStat = regular(options['--authorization']);
    if (authStat.size > 64 * 1024 || (authStat.mode & 0o077) !== 0) throw fixedError('authorization-must-be-small-private-file');
    regular(options['--manifest']); regular(options['--hdc']); regular(options['--vm-log']);
    const hdcBytes = readFileSync(options['--hdc']);
    if (!(hdcBytes.subarray(0, 4).equals(Buffer.from([0x7f, 0x45, 0x4c, 0x46])) ||
        hdcBytes.subarray(0, 2).equals(Buffer.from('MZ')))) throw fixedError('native-hdc-binary-required');
    const manifestBytes = readFileSync(options['--manifest']), manifest = JSON.parse(manifestBytes);
    const artifact = manifest.artifacts?.find(row => row.kind === 'signed');
    if (manifest.schemaVersion !== 2 || !artifact?.signature?.verified || !artifact.embeddedCoreNapi?.storageCompatibility ||
      artifact.signature.certificateSha256?.toUpperCase() !== '3A563778E5BF17CD3EAD0218E13B4A5030DE3F5D7D4E21E0336D8EB37B676DC4') {
      throw fixedError('recorded-signed-reader-candidate-required');
    }
    if (typeof artifact.path !== 'string' || isAbsolute(artifact.path) || artifact.path.split(/[\\/]/).some(part => !part || part === '..' || part === '.')) {
      throw fixedError('invalid-recorded-hap-path');
    }
    const hapPath = resolve(dirname(options['--manifest']), artifact.path); regular(hapPath);
    if (digest(readFileSync(hapPath)) !== artifact.sha256) throw fixedError('candidate-hap-content-mismatch');
    const binding = { manifestSha256: digest(manifestBytes), hapSha256: artifact.sha256, hdcSha256: digest(hdcBytes) };
    const auth = JSON.parse(readFileSync(options['--authorization'], 'utf8'));
    validateDiagnosticAuthorization(auth, options, binding, injected.now?.() ?? Date.now());
    if (existsSync(output)) throw fixedError('fresh-output-directory-required');
    const ledgerRoot = resolve(injected.claimLedgerRoot ?? resolve(process.env.READER_LOCK_DIR || tmpdir(),
      'reader-storage-admission-diagnostic-claims'));
    mkdirSync(ledgerRoot, { recursive: true, mode: 0o700 });
    const ledgerStat = lstatSync(ledgerRoot);
    if (!ledgerStat.isDirectory() || ledgerStat.isSymbolicLink() || (ledgerStat.mode & 0o077) !== 0) {
      throw fixedError('private-authorization-ledger-required');
    }
    // The grant identity is independent of filename, JSON whitespace, output
    // directory and refreshed VM confirmation. Copying a receipt is no grant.
    const grantDigest = digest(JSON.stringify([auth.approvalReference, auth.targetRef, auth.serverRef,
      auth.manifestSha256, auth.hapSha256]));
    // Exclusive persistent claim precedes SDK imports, lock discovery and all device IO.
    const claim = { status: 'CONSUMED', startedAt: new Date().toISOString(), grantDigest, ...binding };
    save(resolve(ledgerRoot, grantDigest + '.json'), claim, true); claimed = true;
    save(claimPath, claim, true);
    mkdirSync(output, { mode: 0o700 }); outputCreated = true;
    ports = { ...await runtimePorts(), ...injected };
    const server = ports.canonicalServerKey(options['--server-key']), target = options['--target'];
    leaseRoot = resolve(process.env.READER_HDC_LEASE_ROOT ?? resolve(process.env.READER_LOCK_DIR || tmpdir(), 'reader-hdc-target-leases'));
    owner = { token: randomUUID(), pid: process.pid, ppid: process.ppid, agentId: 'storage-admission-diagnostic',
      serverKey: server, serverRef: ports.targetRef(server), target, targetRef: ports.targetRef(target),
      command: ['read-only-storage-admission-diagnostic'], startedAt: new Date().toISOString() };
    lease = await ports.acquireLease({ root: leaseRoot, target, targetRefValue: ports.targetRef(target),
      lockRefValue: ports.targetRef(server), waitMs: 0, owner });
    const execute = args => {
      try { return ports.spawn(options['--hdc'], ['-s', server, ...args], {
        encoding: null, timeout: 10_000, maxBuffer: 1024 * 1024, killSignal: 'SIGKILL', cwd: repo,
      }); } catch (error) { return { status: null, error, stdout: '', stderr: '' }; }
    };
    const before = (category, args) => {
      if (++preflightQueries > 10) throw fixedError('preflight-query-budget-exceeded');
      const result = execute(args), meta = ports.summarizeProbeResult(result); preflight.push({ category, ...meta });
      if (!['ok', 'empty'].includes(meta.outcome)) throw fixedError('preflight-command-failed');
      return String(result.stdout ?? '').trim();
    };
    const connected = before('target-discovery', ['list', 'targets', '-v']).split(/\r?\n/)
      .filter(line => line.includes('Connected') && line.split(/\s+/)[0] === target);
    if (connected.length !== 1) throw fixedError('target-not-uniquely-connected');
    let readiness;
    try { readiness = ports.targetReadiness({ targetKind: 'vm', targetEndpoint: target, vmLog: options['--vm-log'],
      query: command => before('target-readiness', ['-t', target, 'shell', command]) }); }
    catch { throw fixedError('target-readiness-failed'); }
    if (readiness.status !== 'PASS') throw fixedError('target-readiness-failed');
    const bm = execute(['-t', target, 'shell', `bm dump -n ${bundle}`]); businessQueries++;
    const bmSummary = ports.summarizeProbeResult(bm);
    preflight.push({ category: 'bundle-metadata', ...bmSummary });
    if (bmSummary.outcome !== 'ok') throw fixedError('bundle-metadata-query-failed');
    let installed;
    try { installed = ports.parseBundleMetadata(String(bm.stdout ?? '')); }
    catch { throw fixedError('bundle-metadata-malformed'); }
    if (!installed.bundlePresent || !Number.isSafeInteger(installed.uid) || installed.uid <= 0 || installed.cpuAbi !== manifest.abi) {
      throw fixedError('installed-bundle-or-abi-unresolved');
    }
    if (installed.uid !== auth.incumbent.uid || installed.appVersion?.appBuildId !== auth.incumbent.appBuildId ||
        installed.appIdSha256 !== auth.incumbent.appIdSha256 || installed.updateTime !== auth.incumbent.updateTime) {
      throw fixedError('installed-bundle-identity-changed');
    }
    const report = ports.diagnoseStorageAdmission({ bundleName: bundle, uid: installed.uid,
      candidateStorage: artifact.embeddedCoreNapi.storageCompatibility, includeFallbacks: options['--include-fallbacks'] === true,
      probeQuery: ({ command, sandbox }) => {
        if (++businessQueries > 9) throw fixedError('business-query-budget-exceeded');
        return execute(['-t', target, 'shell', ...(sandbox ? ['-b', bundle] : []), command]);
      } });
    const queryRows = Object.values(report.query).flatMap(group => Object.values(group)).filter(Boolean);
    finalStatus = [...preflight, ...queryRows].some(row => !['ok', 'empty'].includes(row.outcome)) ? 'FAIL_QUERY' : 'DIAGNOSTIC_COMPLETE';
    finalReason = finalStatus === 'FAIL_QUERY' ? 'query-failure-classified' : 'diagnosis-only-not-install-authority';
    save(resolve(output, 'report.json'), { ...report, executionStatus: finalStatus, preflight,
      preflightQueries, businessQueries, candidate: binding, targetRef: ports.targetRef(target),
      readiness: { status: readiness.status, bootIdSha256: readiness.bootIdSha256, sceneBoardPidSha256: readiness.sceneBoardPidSha256 },
      canonicalInspect: 'NOT_RUN', revalidation: 'NOT_RUN', routePredictionScope: 'initial-storage-route-only',
      installAuthority: false, installation: 'NOT_RUN', appStops: 0, appStarts: 0, originalSql: false,
      databaseCopies: 0, intentReads: 0, rawDeviceOutputSaved: false });
  } catch (error) { finalStatus = 'FAIL'; finalReason = error?.[safeCode] ?? 'diagnostic-execution-failed'; }
  finally {
    if (lease) {
      try { ports.releaseLease(leaseRoot, lease.lockDir, owner); }
      catch { finalStatus = 'FAIL'; finalReason = 'lease-release-failed'; }
    }
    if (outputCreated) {
      try { save(resolve(output, 'execution.json'), { status: finalStatus, reason: finalReason,
        authorizationConsumed: claimed, scopeClosed: true, preflightQueries, businessQueries,
        appStops: 0, appStarts: 0, installs: 0, rawDeviceOutputSaved: false }); }
      catch { finalStatus = 'FAIL'; finalReason = 'diagnostic-report-write-failed'; }
    }
  }
  stdout(JSON.stringify({ status: finalStatus, reason: finalReason, authorizationConsumed: claimed,
    scopeClosed: claimed, preflightQueries, businessQueries, installAuthority: false }));
  return finalStatus === 'DIAGNOSTIC_COMPLETE' ? 0 : 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runDiagnosticCli(process.argv.slice(2)).then(code => { process.exitCode = code; }).catch(() => {
    process.stderr.write('storage-admission-diagnostic: execution failed\n'); process.exitCode = 1;
  });
}
