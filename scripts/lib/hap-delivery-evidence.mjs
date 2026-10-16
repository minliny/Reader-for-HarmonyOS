import { readFileSync, writeFileSync, mkdirSync, copyFileSync, lstatSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { digest, gateInputs, validateGateReceipt } from '../../../Reader-Core-Native/scripts/lib/gate-receipt.mjs';
import { CORE_GATE_STAGES } from '../../../Reader-Core-Native/scripts/lib/core-gate-stages.mjs';

const configPath = fileURLToPath(new URL('./hap-required-resources.json', import.meta.url));
export function requiredHapResources(repo) {
  const config = JSON.parse(readFileSync(configPath, 'utf8'));
  if (config.schemaVersion !== 1 || !config.paths.length || new Set(config.paths).size !== config.paths.length) throw new Error('Invalid required HAP resources');
  return config.paths.map(path => {
    if (path.startsWith('/') || path.split('/').some(p => !p || p === '..' || p === '.')) throw new Error('Invalid required resource path');
    const sourcePath = `entry/src/main/resources/rawfile/${path}`, file = resolve(repo, sourcePath);
    if (!lstatSync(file).isFile()) throw new Error(`Missing required HAP resource: ${sourcePath}`);
    const bytes = readFileSync(file);
    return { path: `resources/rawfile/${path}`, sourcePath, bytes: bytes.length, sha256: digest(bytes) };
  });
}
export function verifyRequiredHapResources(records, names, readEntry) {
  if (!Array.isArray(records) || !records.length || new Set(records.map(r => r.path)).size !== records.length) throw new Error('Required resource receipt is missing or duplicated');
  for (const expected of records) {
    if (!expected.path.startsWith('resources/rawfile/') || expected.path.split('/').some(p => p === '..' || !p) || names.filter(name => name === expected.path).length !== 1) throw new Error(`Required HAP resource missing/duplicated: ${expected.path}`);
    const bytes = readEntry(expected.path);
    if (bytes.length !== expected.bytes || digest(bytes) !== expected.sha256) throw new Error(`Required HAP resource bytes differ: ${expected.path}`);
  }
  return records;
}
export function currentCoreGate(file, coreRoot) {
  if (!file) throw new Error('acceptance requires --core-gate-receipt from the complete current Core gate; use scripts/check-development.mjs --hap');
  return validateGateReceipt(file, { kind: 'core-development', expectedStages: CORE_GATE_STAGES, snapshot: gateInputs(coreRoot) });
}
export function publishCoreGate(file, directory, coreRoot) {
  const report = currentCoreGate(file, coreRoot), destination = join(directory, 'core-gate');
  mkdirSync(join(destination, 'logs'), { recursive: true });
  for (const row of report.stages) {
    const source = resolve(dirname(file), row.log), local = `logs/${row.id}.log`;
    copyFileSync(source, join(destination, local)); row.log = local;
  }
  const bytes = JSON.stringify(report, null, 2) + '\n';
  writeFileSync(join(destination, 'receipt.json'), bytes);
  return { status: 'PASS', path: 'core-gate/receipt.json', sha256: digest(bytes), inputFingerprint: report.inputFingerprint, runId: report.runId };
}
export function verifyPublishedCoreGate(directory, record) {
  if (record?.status !== 'PASS' || record.path !== 'core-gate/receipt.json') throw new Error('Acceptance Core gate evidence is missing');
  const file = join(directory, record.path);
  if (digest(readFileSync(file)) !== record.sha256) throw new Error('Core gate receipt identity mismatch');
  const report = validateGateReceipt(file, { kind: 'core-development', expectedStages: CORE_GATE_STAGES, requireCurrent: false });
  if (report.inputFingerprint !== record.inputFingerprint || report.runId !== record.runId) throw new Error('Core gate binding mismatch');
  return report;
}

// Only minimal read-only system queries are allowed until this succeeds.
// The caller binds the current confirmed VM's emulator log explicitly.
export function targetReadiness({ targetKind, query, vmLog, now = Date.now, wait = () => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 2000) }) {
  const boot = query('param get bootevent.boot.completed').trim();
  if (boot !== 'true') throw new Error('Target boot is not complete; stopped before Bundle Manager or application operations');
  const bootId = query('cat /proc/sys/kernel/random/boot_id').trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(bootId)) throw new Error('Target boot identity is unavailable');
  const sceneBoard = query('pidof com.ohos.sceneboard').trim();
  if (!/^\d+$/.test(sceneBoard)) throw new Error('SceneBoard is not running as one stable process');
  let logRecord;
  if (targetKind === 'vm') {
    if (!vmLog || !lstatSync(vmLog).isFile()) throw new Error('VM readiness requires --vm-log for the currently confirmed emulator instance');
    const uptime = Number(query('cat /proc/uptime').trim().split(/\s+/)[0]);
    if (!Number.isFinite(uptime) || uptime < 0 || lstatSync(vmLog).mtimeMs < now() - uptime * 1000 - 60_000) throw new Error('VM emulator log predates the current guest boot');
    const bytes = readFileSync(vmLog), text = bytes.toString('utf8');
    const marker = text.lastIndexOf('Guest OS Boot Completed!!');
    if (marker < 0) throw new Error('VM emulator log has no Guest OS Boot Completed marker');
    const tail = text.slice(marker);
    if (/SceneBoard exits|LIFECYCLE_TIMEOUT|guest reset|kernel panic/i.test(tail)) throw new Error('VM system instability detected; stop app operations and preserve system evidence');
    logRecord = { sha256: digest(bytes), bytes: bytes.length, bootMarker: true, instabilityAfterMarker: false };
  }
  wait();
  if (targetKind === 'vm') {
    const current = readFileSync(vmLog, 'utf8');
    const marker = current.lastIndexOf('Guest OS Boot Completed!!');
    if (marker < 0) throw new Error('VM boot marker disappeared during readiness observation');
    if (/SceneBoard exits|LIFECYCLE_TIMEOUT|guest reset|kernel panic/i.test(current.slice(marker))) throw new Error('VM system became unstable during readiness observation');
  }
  if (query('param get bootevent.boot.completed').trim() !== 'true' || query('cat /proc/sys/kernel/random/boot_id').trim() !== bootId || query('pidof com.ohos.sceneboard').trim() !== sceneBoard) throw new Error('Target boot/SceneBoard changed during readiness observation');
  return { status: 'PASS', checkedAt: new Date().toISOString(), bootIdSha256: digest(bootId), sceneBoardPidSha256: digest(sceneBoard), bootCompleted: true, sceneBoardStable: true, emulatorLog: logRecord };
}
