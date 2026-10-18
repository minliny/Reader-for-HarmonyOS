#!/usr/bin/env node
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, realpathSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
const { isBuildResourceTask, isPackageTask, beginIdeBuild, finishIdeBuild } = createRequire(import.meta.url)('../hvigor/reader-hap-guard.cjs');
import { requiredHapResources, verifyRequiredHapResources, currentCoreGate, verifyPublishedCoreGate, targetReadiness } from '../scripts/lib/hap-delivery-evidence.mjs';
import { contractToolchainLoaders, buildContractScope, releaseContractBuildWorkspace } from '../scripts/hap-pipeline.mjs';
import { hapStageReceipt } from '../scripts/lib/hap-stage-receipt.mjs';
import { contentSnapshot } from '../../Reader-Core-Native/scripts/build-input-snapshot.mjs';
import { createGateReceipt, gateInputs, digest } from '../../Reader-Core-Native/scripts/lib/gate-receipt.mjs';
import { CORE_GATE_STAGES } from '../../Reader-Core-Native/scripts/lib/core-gate-stages.mjs';

const root = realpathSync(mkdtempSync(join(tmpdir(), 'reader-delivery-admission-')));
const put = (path, value = '') => { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, value); return path; };
try {
  assert.equal(buildContractScope(new Map([['--class', 'acceptance'], ['--core-gate-receipt', 'fixture-receipt.json']])), undefined);
  for (const task of ['compileNative', ':entry:default@ConfigureCmake', 'default@BuildNativeWithNinja', 'BuildNativeWithCmake', 'clean', 'assembleHap']) assert.equal(isBuildResourceTask(task), true);
  assert.equal(isPackageTask('compileNative'), false); assert.equal(isBuildResourceTask('PreviewArkTS'), false);
  const oldLockRoot = process.env.READER_LOCK_DIR;
  const oldLeaseToken = process.env.READER_BUILD_LEASE_TOKEN;
  try {
    process.env.READER_LOCK_DIR = join(root, 'ide-locks');
    // This tests an independent IDE owner, not a different root with the
    // canonical dispatcher's inherited token.
    delete process.env.READER_BUILD_LEASE_TOKEN;
    const retired = beginIdeBuild({});
    finishIdeBuild();
    await assert.rejects(retired, /ended before resource admission/);
    assert.equal(existsSync(join(process.env.READER_LOCK_DIR, 'reader-harmony-hap-build.lock')), false,
      'a late dynamic import cannot acquire a lease after buildFinished');
    await Promise.all([beginIdeBuild({}), beginIdeBuild({})]);
    assert.ok(readFileSync(join(process.env.READER_LOCK_DIR, 'reader-harmony-hap-build.lock/owner.json')));
    finishIdeBuild();
    assert.equal(process.env.READER_BUILD_LEASE_TOKEN, undefined, 'finished IDE invocation retires its token');
    await beginIdeBuild({}); finishIdeBuild();
  } finally {
    finishIdeBuild();
    if (oldLockRoot === undefined) delete process.env.READER_LOCK_DIR; else process.env.READER_LOCK_DIR = oldLockRoot;
    if (oldLeaseToken === undefined) delete process.env.READER_BUILD_LEASE_TOKEN; else process.env.READER_BUILD_LEASE_TOKEN = oldLeaseToken;
  }
  const paths = JSON.parse(readFileSync(fileURLToPath(new URL('../scripts/lib/hap-required-resources.json', import.meta.url)))).paths;
  const processReport = join(root, 'owned-process-results.json');
  let releaseCount = 0;
  const retainedLease = { release() { releaseCount++; } };
  assert.equal(releaseContractBuildWorkspace(retainedLease, processReport, { dispatched: true }), false);
  assert.equal(releaseCount, 0, 'killed dispatcher without its receipt cannot authorize parent release');
  for (const report of [{ treeSettled: false }, { treeSettled: true, treeRecoveryBlocked: true }]) {
    put(processReport, JSON.stringify(report));
    assert.equal(releaseContractBuildWorkspace(retainedLease, processReport), false);
    assert.equal(releaseCount, 0, 'canonical parent must retain its lease while a nested process group survives');
  }
  put(processReport, JSON.stringify({ treeSettled: true, treeRecoveryBlocked: false }));
  assert.equal(releaseContractBuildWorkspace(retainedLease, processReport), true);
  assert.equal(releaseCount, 1);
  put(processReport, '{invalid');
  assert.throws(() => releaseContractBuildWorkspace(retainedLease, processReport), SyntaxError);
  assert.equal(releaseCount, 1, 'unreadable process settlement evidence cannot authorize release');
  for (const path of paths) put(join(root, 'entry/src/main/resources/rawfile', path), `fixture:${path}`);
  const records = requiredHapResources(root), names = records.map(r => r.path);
  const entry = path => readFileSync(join(root, 'entry/src/main', path));
  verifyRequiredHapResources(records, names, entry);
  assert.throws(() => verifyRequiredHapResources(records, names.slice(1), entry), /missing/);
  assert.throws(() => verifyRequiredHapResources(records, [...names, names[0]], entry), /duplicated/);
  assert.throws(() => verifyRequiredHapResources(records, names, () => Buffer.from('wrong')), /bytes differ/);
  assert.throws(() => currentCoreGate(undefined, root), /complete current Core gate/);

  // Receipt protocol fixture: these tiny processes do not claim a Core test run.
  put(join(root, 'input.txt'), 'fixture');
  const snapshot = contentSnapshot(root, ['input.txt']);
  const receipt = createGateReceipt({ kind: 'core-development', root, output: join(root, 'core-gate/receipt.json'), snapshot, expectedStages: CORE_GATE_STAGES });
  for (const id of CORE_GATE_STAGES) receipt.stage(id, process.execPath, ['-e', '']);
  receipt.finish(snapshot);
  const descriptor = { status: 'PASS', path: 'core-gate/receipt.json', sha256: digest(readFileSync(receipt.file)), inputFingerprint: snapshot.fingerprint, runId: receipt.report.runId };
  verifyPublishedCoreGate(root, descriptor);
  const data = JSON.parse(readFileSync(receipt.file)); data.stages.pop(); writeFileSync(receipt.file, JSON.stringify(data));
  assert.throws(() => verifyPublishedCoreGate(root, descriptor), /identity mismatch/);
  descriptor.sha256 = digest(readFileSync(receipt.file));
  assert.throws(() => verifyPublishedCoreGate(root, descriptor), /invalid/);

  const checkout = join(root, 'temporary core'); mkdirSync(checkout);
  const git = (...args) => execFileSync('git', ['-C', checkout, ...args], { stdio: 'pipe' });
  put(join(checkout, '.gitignore'), '.reader-artifacts/\n'); put(join(checkout, 'tracked.txt'), 'before');
  git('init', '-q'); git('add', '.'); git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@invalid', '-c', 'commit.gpgsign=false', 'commit', '-qm', 'temporary fixture');
  const realInputs = gateInputs(checkout);
  const current = createGateReceipt({ kind: 'core-development', root: checkout, expectedStages: CORE_GATE_STAGES });
  for (const id of CORE_GATE_STAGES) current.stage(id, process.execPath, ['-e', '']);
  current.finish(); currentCoreGate(current.file, checkout);
  put(join(checkout, '.reader-artifacts', 'extra.log'), 'ignored output');
  assert.deepEqual(gateInputs(checkout), realInputs); currentCoreGate(current.file, checkout);
  put(join(checkout, 'tracked.txt'), 'changed'); assert.throws(() => currentCoreGate(current.file, checkout), /current inputs/);
  put(join(checkout, 'tracked.txt'), 'before'); put(join(checkout, 'untracked.txt'), 'new input');
  assert.throws(() => currentCoreGate(current.file, checkout), /current inputs/);
  let pid = '123', boot = 'true', calls = [];
  const query = command => { calls.push(command); return command.includes('completed') ? boot : command.includes('boot_id') ? '12345678-1234-1234-1234-123456789abc' : command.includes('uptime') ? '100 200' : pid; };
  const vmLog = put(join(root, 'emulator.log'), 'Guest OS Boot Completed!!\n');
  const ready = targetReadiness({ targetKind: 'vm', query, vmLog, wait() {} });
  assert.equal(ready.sceneBoardStable, true); assert.equal(ready.emulatorLog.bootMarker, true);
  boot = 'false'; calls = [];
  assert.throws(() => targetReadiness({ targetKind: 'vm', query, vmLog, wait() {} }), /boot is not complete/); assert.equal(calls.length, 1);
  boot = 'true';
  assert.throws(() => targetReadiness({ targetKind: 'vm', query, wait() {} }), /vm-log/);
  put(vmLog, 'Guest OS Boot Completed!!\nLIFECYCLE_TIMEOUT\n');
  assert.throws(() => targetReadiness({ targetKind: 'vm', query, vmLog, wait() {} }), /instability/);
  put(vmLog, 'Guest OS Boot Completed!!\n');
  assert.throws(() => targetReadiness({ targetKind: 'physical', query, wait() { pid = '124'; } }), /changed/);
  assert.equal(calls.some(s => s.includes('bm ') || s.includes('aa ') || s.includes('install')), false);
  // Restricted VM shells deny procfs, while Toybox uptime uses sysinfo(). Run
  // the actual admission function with controlled read-only query/log ports.
  const milestoneValues = { kernel: 881433, init: 7026507, 'samgr.ready': 7156994,
    'appspawn.started': 7756549, 'wms.ready': 14402801, 'boot.completed': 17482085 };
  const utcStamp = value => new Date(value).toISOString().slice(0, 19).replace('T', ' ');
  const localStamp = value => { const d = new Date(value), pad = (n, width = 2) => String(n).padStart(width, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`; };
  const bootEpoch = Date.UTC(2026, 9, 16, 10, 29, 23), checkEpoch = bootEpoch + 155_000;
  const startLine = `${localStamp(bootEpoch + 491)} 8643510144 [Info] [TraceTool.cpp(InitPipe:27)][TraceTool] trace pipe name is: "fixture"`;
  const resetLine = `${localStamp(bootEpoch + 1348)} 6182121472 [Info] [QemuManager.cpp(OnSystemReset:640)]System is reset`;
  const markerLine = `${localStamp(bootEpoch + 19036)} 6286782464 [Info] [QemuManager.cpp(EmitGuestOSBootComplete:131)]Guest OS Boot Completed!!`;
  const instanceLog = `${startLine}\n${resetLine}\n${markerLine}\n`;
  let restrictedCase = 0;
  function restricted(options = {}) {
    const log = put(join(root, `restricted-${++restrictedCase}.log`), options.log ?? instanceLog), commands = [];
    const sampleBootEpoch = options.bootEpoch ?? bootEpoch, sampleCheckEpoch = options.checkEpoch ?? checkEpoch;
    let elapsed = 0, second = false;
    const guestQuery = command => {
      commands.push(command);
      if (command === 'cat /proc/sys/kernel/random/boot_id') {
        if (options.throwProc) throw new Error('/proc/sys/kernel/random/boot_id: Permission denied');
        return options.bootId ?? '/bin/sh: cat: /proc/sys/kernel/random/boot_id: Permission denied';
      }
      if (command === 'cat /proc/uptime') return options.procUptime ?? '/bin/sh: cat: /proc/uptime: Permission denied';
      if (command === 'param get bootevent.boot.completed') return second ? options.finalComplete ?? 'true' : 'true';
      if (command === 'pidof com.ohos.sceneboard') return second ? options.finalPid ?? '1643' : '1643';
      if (command === 'date -u +%s') return options.guestDate ?? String(Math.floor((sampleCheckEpoch + elapsed + (second ? options.secondClockOffset ?? 0 : 0)) / 1000));
      if (command === 'TZ=UTC uptime -s') return options.bootTimestamp ?? utcStamp(sampleBootEpoch + (second ? options.secondBootOffset ?? 1000 : 0));
      const name = command.replace('param get ohos.boot.time.', '');
      if (Object.hasOwn(milestoneValues, name)) return String((second ? options.secondMilestones ?? options.milestones : options.milestones)?.[name] ?? milestoneValues[name]);
      throw new Error(`Unexpected readiness query: ${command}`);
    };
    return { log, commands, run: () => targetReadiness({ targetKind: options.targetKind ?? 'vm', query: guestQuery, vmLog: log,
      now: () => sampleCheckEpoch + elapsed, monotonicNow: () => elapsed,
      wait() { elapsed += options.waitMs ?? 2000; second = true; options.changeLog?.(log); } }) };
  }
  const restrictedReady = restricted(), fallbackReady = restrictedReady.run();
  assert.equal(fallbackReady.status, 'PASS'); assert.equal(fallbackReady.bootIdentitySource, 'vm-startup-fingerprint-v1');
  assert.equal(fallbackReady.uptimeSource, 'toybox-sysinfo'); assert.equal(fallbackReady.observationMs, 2000);
  assert.match(fallbackReady.bootIdSha256, /^[a-f0-9]{64}$/); assert.equal(fallbackReady.emulatorLog.instanceSha256, fallbackReady.bootIdSha256);
  assert.equal(restricted({ throwProc: true }).run().status, 'PASS', 'a genuine procfs permission error can use the same VM-only evidence');
  const uuidWithRestrictedUptime = restricted({ bootId: '12345678-1234-1234-1234-123456789abc' }).run();
  assert.equal(uuidWithRestrictedUptime.bootIdentitySource, 'kernel-boot-id', 'available real UUID remains authoritative');
  assert.equal(uuidWithRestrictedUptime.uptimeSource, 'toybox-sysinfo');
  // Recorded original VM startup: host TraceTool starts before the guest
  // kernel. These are actual event offsets and read-only guest milestones,
  // rendered in the test process's local timezone like the host log parser.
  const delayedBootEpoch = Date.UTC(2026, 9, 16, 14, 25, 4);
  const delayedStart = `${localStamp(delayedBootEpoch - 1643)} 8643510144 [Info] [TraceTool.cpp(InitPipe:27)][TraceTool] trace pipe name is: "fixture-delayed"`;
  const delayedReset = `${localStamp(delayedBootEpoch + 413)} 481606922240 [Info] [QemuManager.cpp(OnSystemReset:640)]System is reset`;
  const delayedMarker = `${localStamp(delayedBootEpoch + 55588)} 486059421696 [Info] [QemuManager.cpp(EmitGuestOSBootComplete:131)]Guest OS Boot Completed!!`;
  const delayed = restricted({ bootEpoch: delayedBootEpoch, checkEpoch: Date.UTC(2026, 9, 16, 16, 42, 12),
    log: `${delayedStart}\n${delayedReset}\n${delayedMarker}\n`,
    milestones: { kernel: 3115150, init: 15495746, 'samgr.ready': 15960417,
      'appspawn.started': 22674576, 'wms.ready': 42897755, 'boot.completed': 53561651 } });
  assert.equal(delayed.run().status, 'PASS', 'a real host-initialization delay is not a guest boot identity mismatch');
  for (const [label, options, expected] of [
    ['physical procfs denial', { targetKind: 'physical' }, /boot identity is unavailable/],
    ['missing procfs identity', { bootId: '' }, /boot identity is unavailable/],
    ['malformed procfs identity', { bootId: 'not-a-uuid' }, /boot identity is unavailable/],
    ['missing procfs uptime', { procUptime: '' }, /uptime is unavailable/],
    ['malformed UTC startup', { bootTimestamp: '2026-02-30 10:29:23' }, /timestamp is invalid/],
    ['guest date unavailable', { guestDate: 'Permission denied' }, /guest clock is unavailable/],
    ['missing milestone', { milestones: { init: 0 } }, /milestone identity is unavailable/],
    ['future milestone', { milestones: { kernel: 99_000_000 } }, /milestone timing is inconsistent/],
    ['guest boot before host instance interval', { bootTimestamp: utcStamp(bootEpoch - 2000) }, /does not match/],
    ['guest boot after completed host interval', { bootTimestamp: utcStamp(bootEpoch + 21000) }, /does not match/],
    ['completion marker before guest milestone', { log: instanceLog.replace(markerLine, markerLine.replace(localStamp(bootEpoch + 19036), localStamp(bootEpoch + 14036))) }, /does not match/],
    ['completion marker exceeds existing milestone delay bound', { log: instanceLog.replace(markerLine, markerLine.replace(localStamp(bootEpoch + 19036), localStamp(bootEpoch + 25036))) }, /does not match/],
    ['milestone replacement', { secondMilestones: { kernel: 881434 } }, /changed during readiness/],
    ['boot time replacement', { secondBootOffset: 120_000 }, /does not match/],
    ['guest clock jump', { secondClockOffset: 5000 }, /clock or observation is inconsistent/],
    ['no observation', { waitMs: 0 }, /observation interval/],
    ['unbounded observation', { waitMs: 11_000 }, /observation interval/],
    ['SceneBoard replacement', { finalPid: '1644' }, /boot\/SceneBoard changed/],
    ['boot becomes incomplete', { finalComplete: 'false' }, /boot\/SceneBoard changed/],
    ['no instance start', { log: `${markerLine}\n` }, /no completed current-instance/],
    ['stale log despite current mtime', { log: instanceLog.replaceAll(localStamp(bootEpoch).slice(0, 10), localStamp(bootEpoch - 86_400_000).slice(0, 10)) }, /does not match/],
    ['startup without completion', { log: `${instanceLog}${startLine}\n` }, /no completed current-instance/],
    ['post-boot reset', { log: `${instanceLog}${resetLine}\n` }, /instability/],
    ['reset during observation', { changeLog: file => writeFileSync(file, `${instanceLog}${resetLine}\n`) }, /unstable/],
    ['log prefix replacement', { changeLog: file => writeFileSync(file, `changed prefix\n${instanceLog}`) }, /changed during readiness/],
    ['new startup during observation', { changeLog: file => writeFileSync(file, `${instanceLog}${startLine}\n`) }, /no completed current-instance/],
  ]) assert.throws(() => restricted(options).run(), expected, label);
  const appended = restricted({ changeLog: file => writeFileSync(file, `${instanceLog}benign emulator observation\n`) });
  const appendResult = appended.run(); assert.equal(appendResult.emulatorLog.sha256, digest(readFileSync(appended.log)), 'receipt binds the fully observed append-only log');
  assert.equal(restrictedReady.commands.some(command => /\bbm\b|\baa\b|install|\bsu\b|chmod|param set/.test(command)), false,
    'readiness never invokes application operations, privilege changes or parameter writes');
  const sdk = join(root, 'sdk'), normal = join(sdk, 'ets/build-tools/ets-loader'), overridden = join(root, 'override loader');
  mkdirSync(normal, { recursive: true }); mkdirSync(join(sdk, 'toolchains')); mkdirSync(overridden);
  assert.deepEqual(contractToolchainLoaders({ READER_HARMONY_SDK_HOME: sdk, READER_ETS_LOADER_ROOT: overridden, PATH: '' }), [normal, overridden]);
  const attempt = hapStageReceipt(join(root, 'attempts'), { source: 'fixture' }); attempt.protect({ password: 'private-test-value' });
  const row = attempt.begin('hvigor', ['assembleHap']); attempt.end(row, { status: 7, stderr: 'storePassword=private-test-value\ncompile failed' }, 2); attempt.finish(new Error('compile failed'));
  const log = readFileSync(join(dirname(attempt.file), '1.log'), 'utf8'); assert.doesNotMatch(log, /private-test-value/); assert.match(log, /compile failed/);
  assert.equal(JSON.parse(readFileSync(attempt.file)).status, 'FAIL');
  console.log('Delivery admission fixtures PASS: resources, complete receipt, readiness, loader inputs and failure logs; no device/build run.');
} finally { rmSync(root, { recursive: true, force: true }); }
