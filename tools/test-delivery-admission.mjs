#!/usr/bin/env node
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
const { isBuildResourceTask, isPackageTask, beginIdeBuild, finishIdeBuild } = createRequire(import.meta.url)('../hvigor/reader-hap-guard.cjs');
import { requiredHapResources, verifyRequiredHapResources, currentCoreGate, verifyPublishedCoreGate, targetReadiness } from '../scripts/lib/hap-delivery-evidence.mjs';
import { contractToolchainLoaders, buildContractScope } from '../scripts/hap-pipeline.mjs';
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
  try {
    process.env.READER_LOCK_DIR = join(root, 'ide-locks');
    await Promise.all([beginIdeBuild({}), beginIdeBuild({})]);
    assert.ok(readFileSync(join(process.env.READER_LOCK_DIR, 'reader-harmony-hap-build.lock/owner.json')));
    finishIdeBuild(); await beginIdeBuild({}); finishIdeBuild();
  } finally { finishIdeBuild(); if (oldLockRoot === undefined) delete process.env.READER_LOCK_DIR; else process.env.READER_LOCK_DIR = oldLockRoot; }
  const paths = JSON.parse(readFileSync(fileURLToPath(new URL('../scripts/lib/hap-required-resources.json', import.meta.url)))).paths;
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
  const sdk = join(root, 'sdk'), normal = join(sdk, 'ets/build-tools/ets-loader'), overridden = join(root, 'override loader');
  mkdirSync(normal, { recursive: true }); mkdirSync(join(sdk, 'toolchains')); mkdirSync(overridden);
  assert.deepEqual(contractToolchainLoaders({ READER_HARMONY_SDK_HOME: sdk, READER_ETS_LOADER_ROOT: overridden, PATH: '' }), [normal, overridden]);
  const attempt = hapStageReceipt(join(root, 'attempts'), { source: 'fixture' }); attempt.protect({ password: 'private-test-value' });
  const row = attempt.begin('hvigor', ['assembleHap']); attempt.end(row, { status: 7, stderr: 'storePassword=private-test-value\ncompile failed' }, 2); attempt.finish(new Error('compile failed'));
  const log = readFileSync(join(dirname(attempt.file), '1.log'), 'utf8'); assert.doesNotMatch(log, /private-test-value/); assert.match(log, /compile failed/);
  assert.equal(JSON.parse(readFileSync(attempt.file)).status, 'FAIL');
  console.log('Delivery admission fixtures PASS: resources, complete receipt, readiness, loader inputs and failure logs; no device/build run.');
} finally { rmSync(root, { recursive: true, force: true }); }
