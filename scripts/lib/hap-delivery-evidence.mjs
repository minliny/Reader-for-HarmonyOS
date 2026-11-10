import { readFileSync, writeFileSync, mkdirSync, copyFileSync, lstatSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { digest, gateInputs, validateGateReceipt } from '../../../Reader-Core/scripts/lib/gate-receipt.mjs';
import { CORE_GATE_STAGES } from '../../../Reader-Core/scripts/lib/core-gate-stages.mjs';

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

const BOOT_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SYSTEM_INSTABILITY = /SceneBoard exits|LIFECYCLE_TIMEOUT|guest reset|kernel panic|System is reset|OnSystemReset/i;
const BOOT_MILESTONES = ['kernel', 'init', 'samgr.ready', 'appspawn.started', 'wms.ready', 'boot.completed'];
function procRead(query, path, strict = false) {
  const denied = value => (strict ?
    /^(?:(?:\/bin\/sh|sh):\s*)?cat:\s*(\/proc\/(?:sys\/kernel\/random\/boot_id|uptime)):\s*Permission denied$/i :
    /^(?:(?:\/bin\/sh|sh):\s*)?(?:cat:\s*)?(\/proc\/(?:sys\/kernel\/random\/boot_id|uptime)):\s*Permission denied$/i).exec(value)?.[1] === path;
  let text;
  try { text = String(query(`cat ${path}`)).trim(); }
  catch (error) {
    text = String(error.message).trim();
    if (!denied(text)) throw error;
  }
  return { text, denied: denied(text) };
}
function timestamp(text, utc) {
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d{3})?$/.test(text)) throw new Error('VM startup timestamp is invalid');
  const date = new Date(text.replace(' ', 'T') + (utc ? 'Z' : ''));
  const fields = [date[utc ? 'getUTCFullYear' : 'getFullYear'](), date[utc ? 'getUTCMonth' : 'getMonth']() + 1,
    date[utc ? 'getUTCDate' : 'getDate'](), date[utc ? 'getUTCHours' : 'getHours'](),
    date[utc ? 'getUTCMinutes' : 'getMinutes'](), date[utc ? 'getUTCSeconds' : 'getSeconds']()];
  if (!Number.isFinite(date.getTime()) || fields.join(',') !== text.slice(0, 19).match(/\d+/g).map(Number).join(',')) throw new Error('VM startup timestamp is invalid');
  return date.getTime();
}
function vmBootSample(query, now, monotonicNow) {
  // OpenHarmony Toybox uptime.c uses sysinfo(); init's GetUptimeInMicroSeconds
  // writes CLOCK_MONOTONIC milestones. No procfs permission change is needed.
  const hostStart = now(), monotonicStart = monotonicNow();
  // One remote shell preserves the same nine ordered readings without paying
  // a separate HDC transport/process startup for every field. The complete
  // round trip remains inside the original ten-second sampling budget.
  const command = ['set -e', 'date -u +%s', 'TZ=UTC uptime -s',
    ...BOOT_MILESTONES.map(name => `param get ohos.boot.time.${name}`), 'date -u +%s'].join('\n');
  const response = String(query(command)).replace(/\r\n/g, '\n').replace(/\n$/, '');
  const hostEnd = now(), monotonicEnd = monotonicNow();
  const rows = response.split('\n');
  if (rows.length !== BOOT_MILESTONES.length + 3) throw new Error('VM boot sample must contain exactly nine rows');
  const epoch = value => {
    const text = value.trim();
    if (!/^\d{10,}$/.test(text) || !Number.isSafeInteger(Number(text))) throw new Error('VM guest clock is unavailable');
    return Number(text) * 1000;
  };
  const guestStart = epoch(rows[0]), bootStart = timestamp(rows[1].trim(), true);
  const milestones = rows.slice(2, -1).map(value => {
    const text = value.trim();
    if (!/^\d+$/.test(text) || !Number.isSafeInteger(Number(text)) || Number(text) <= 0) throw new Error('VM boot milestone identity is unavailable');
    return Number(text);
  });
  const guestEnd = epoch(rows.at(-1));
  if (monotonicEnd < monotonicStart || monotonicEnd - monotonicStart > 10_000) throw new Error('VM boot sampling observation budget is invalid');
  if (guestEnd < guestStart ||
    guestStart < hostStart - 1000 || guestStart > hostEnd + 1000 || guestEnd < hostStart - 1000 || guestEnd > hostEnd + 1000 ||
    Math.abs((hostEnd - hostStart) - (monotonicEnd - monotonicStart)) > 1000) throw new Error('VM guest/host clock or observation is inconsistent');
  if (bootStart > guestStart + 1000 || milestones.some(value => value > milestones.at(-1)) ||
    milestones.at(-1) / 1000 > guestEnd - bootStart + 1000) throw new Error('VM boot milestone timing is inconsistent');
  return { bootStart, milestones, guestStart, guestEnd, hostStart, hostEnd, monotonicStart, monotonicEnd };
}
function vmInstance(bytes, sample, { vmLog, targetEndpoint }) {
  const lines = bytes.toString('utf8').split(/\r?\n/);
  let start = -1, marker = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/\[TraceTool\.cpp\([^\]]*InitPipe:\d+\)\].*trace pipe name is:/.test(lines[i])) start = i;
    if (lines[i].includes('Guest OS Boot Completed!!')) marker = i;
  }
  if (start < 0 || marker <= start) throw new Error('VM log has no completed current-instance startup');
  const startTime = timestamp(lines[start].slice(0, 23), false), markerTime = timestamp(lines[marker].slice(0, 23), false);
  // A restored guest keeps its original kernel/milestone clock. Admit it
  // only with this host instance's exact snapshot-boot event and a sibling
  // qemu bridge record bound to the already selected loopback TCP target.
  const snapshotMarkers = [];
  for (let i = start + 1; i < marker; i++) {
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3} \d+ \[Info\] \[QemuManager\.cpp\(OnBootCompleted:\d+\)\]Wake up screen after snapshot boot\.$/.test(lines[i])) snapshotMarkers.push(i);
  }
  if (snapshotMarkers.length) {
    if (snapshotMarkers.length !== 1) throw new Error('VM snapshot boot marker is ambiguous');
    const endpoint = /^(?:127\.0\.0\.1|\[::1\]):([1-9]\d{0,4})$/.exec(targetEndpoint ?? '');
    if (!endpoint || Number(endpoint[1]) > 65535) throw new Error('VM snapshot resume requires the explicit selected loopback TCP target endpoint');
    const wakeLine = lines[snapshotMarkers[0]], wakeTime = timestamp(wakeLine.slice(0, 23), false);
    if (markerTime < startTime || markerTime > sample.hostEnd + 1000 || wakeTime < startTime || wakeTime > markerTime ||
      sample.bootStart + sample.milestones.at(-1) / 1000 > startTime + 1000) throw new Error('VM snapshot startup/boot marker does not match the restored guest boot');
    const file = join(dirname(vmLog), 'qemu.log');
    let stat, qemuBytes;
    try { stat = lstatSync(file); if (!stat.isFile()) throw new Error('not a regular file'); qemuBytes = readFileSync(file); }
    catch { throw new Error('VM snapshot resume requires the current sibling qemu.log'); }
    if (stat.size !== qemuBytes.length) throw new Error('VM snapshot companion log changed while being read');
    const ports = [];
    for (const line of qemuBytes.toString('utf8').split(/\r?\n/)) {
      const port = /^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}) \d+ I \[express_bridge\.c\(load_bridge_thread_context:\d+\)\] load port from snapshot: ([1-9]\d{0,4})$/.exec(line);
      if (!port) continue;
      const time = timestamp(port[1], false);
      if (time < startTime) continue;
      if (time > markerTime) throw new Error('VM snapshot companion log contains a later snapshot instance');
      ports.push({ line, time, port: Number(port[2]) });
    }
    if (ports.length !== 1 || ports[0].port !== Number(endpoint[1]) || ports[0].time > wakeTime) throw new Error('VM snapshot companion port is missing, ambiguous or does not match the selected target');
    if (SYSTEM_INSTABILITY.test(lines.slice(marker).join('\n'))) throw new Error('VM system instability detected; stop app operations and preserve system evidence');
    return { identity: digest(JSON.stringify([lines[start], wakeLine, lines[marker], ports[0].line, sample.milestones])),
      startTime, markerTime, startupMode: 'snapshot-resume', snapshotLog: { file, stat, bytes: qemuBytes, port: ports[0].port } };
  }
  // Host instance initialization precedes the guest kernel; boot completion
  // follows it. Contain the guest boot in that interval, retaining the existing
  // one-second timestamp quantization allowance rather than equating events.
  if (sample.bootStart < startTime - 1000 || sample.bootStart > markerTime + 1000 ||
    markerTime < startTime || markerTime > sample.hostEnd + 1000 ||
    markerTime - sample.bootStart < sample.milestones.at(-1) / 1000 - 1000 ||
    markerTime - sample.bootStart > sample.milestones.at(-1) / 1000 + 5000) throw new Error('VM log startup/boot marker does not match the current guest boot');
  if (SYSTEM_INSTABILITY.test(lines.slice(marker).join('\n'))) throw new Error('VM system instability detected; stop app operations and preserve system evidence');
  return { identity: digest(JSON.stringify([lines[start], lines[marker], sample.milestones])), startTime, markerTime };
}

function physicalBootSample(query, now, monotonicNow) {
  // Toybox uptime uses sysinfo(); init exposes CLOCK_MONOTONIC boot milestones.
  // User-build phones can deny procfs without denying these read-only APIs.
  const hostStart = now(), monotonicStart = monotonicNow();
  const epoch = () => {
    const text = String(query('date -u +%s')).trim();
    if (!/^\d{10,}$/.test(text) || !Number.isSafeInteger(Number(text))) throw new Error('Physical guest clock is unavailable');
    return Number(text) * 1000;
  };
  const guestStart = epoch(), startText = String(query('TZ=UTC uptime -s')).trim();
  const bootStart = Date.parse(startText.replace(' ', 'T') + 'Z');
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(startText) || !Number.isFinite(bootStart) ||
    new Date(bootStart).toISOString().slice(0, 19).replace('T', ' ') !== startText) throw new Error('Physical boot timestamp is invalid');
  const milestones = BOOT_MILESTONES.map(name => {
    const text = String(query(`param get ohos.boot.time.${name}`)).trim();
    if (!/^\d+$/.test(text) || !Number.isSafeInteger(Number(text)) || Number(text) <= 0) throw new Error('Physical boot milestone identity is unavailable');
    return text;
  });
  const guestEnd = epoch(), hostEnd = now(), monotonicEnd = monotonicNow();
  if (monotonicEnd < monotonicStart || monotonicEnd - monotonicStart > 10_000 || guestEnd < guestStart ||
    guestStart < hostStart - 1000 || guestStart > hostEnd + 1000 || guestEnd < hostStart - 1000 || guestEnd > hostEnd + 1000 ||
    Math.abs(hostEnd - hostStart - (monotonicEnd - monotonicStart)) > 1000) throw new Error('Physical guest/host clock or observation is inconsistent');
  if (bootStart > guestStart + 1000 || milestones.some(value => Number(value) > Number(milestones.at(-1))) ||
    milestones.at(-1) / 1000 > guestEnd - bootStart + 1000) throw new Error('Physical boot milestone timing is inconsistent');
  return { bootStart, milestones, guestStart, guestEnd, monotonicStart, monotonicEnd };
}

// Only minimal read-only system queries are allowed until this succeeds.
// The caller binds the current confirmed VM's emulator log explicitly.
export function targetReadiness({ targetKind, query, vmLog, targetEndpoint, now = Date.now, monotonicNow = () => performance.now(), wait = () => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 2000) }) {
  if (!['vm', 'physical'].includes(targetKind)) throw new Error('Invalid target kind');
  const boot = query('param get bootevent.boot.completed').trim();
  if (boot !== 'true') throw new Error('Target boot is not complete; stopped before Bundle Manager or application operations');
  const bootId = procRead(query, '/proc/sys/kernel/random/boot_id', targetKind === 'physical');
  const physicalFallback = targetKind === 'physical' && bootId.denied;
  if (!BOOT_UUID.test(bootId.text) && !bootId.denied) throw new Error('Target boot identity is unavailable');
  const sceneBoard = query('pidof com.ohos.sceneboard').trim();
  if (!/^\d+$/.test(sceneBoard)) throw new Error('SceneBoard is not running as one stable process');
  const physicalSample = physicalFallback ? physicalBootSample(query, now, monotonicNow) : undefined;
  let logRecord, firstBytes, firstStat, fallback, firstSample, instance;
  if (targetKind === 'vm') {
    if (!vmLog || !lstatSync(vmLog).isFile()) throw new Error('VM readiness requires --vm-log for the currently confirmed emulator instance');
    const uptimeResult = procRead(query, '/proc/uptime'), uptime = Number(uptimeResult.text.split(/\s+/)[0]);
    const validUptime = /^\d+(?:\.\d+)?(?:\s+\d+(?:\.\d+)?)?$/.test(uptimeResult.text) && Number.isFinite(uptime) && uptime >= 0;
    if (!validUptime && !uptimeResult.denied) throw new Error('VM uptime is unavailable');
    fallback = bootId.denied || uptimeResult.denied;
    firstStat = lstatSync(vmLog); firstBytes = readFileSync(vmLog);
    if (fallback) { firstSample = vmBootSample(query, now, monotonicNow); instance = vmInstance(firstBytes, firstSample, { vmLog, targetEndpoint }); }
    else if (firstStat.mtimeMs < now() - uptime * 1000 - 60_000) throw new Error('VM emulator log predates the current guest boot');
    const text = firstBytes.toString('utf8');
    const marker = text.lastIndexOf('Guest OS Boot Completed!!');
    if (marker < 0) throw new Error('VM emulator log has no Guest OS Boot Completed marker');
    const tail = text.slice(marker);
    if (SYSTEM_INSTABILITY.test(tail)) throw new Error('VM system instability detected; stop app operations and preserve system evidence');
    logRecord = { sha256: digest(firstBytes), bytes: firstBytes.length, bootMarker: true, instabilityAfterMarker: false };
  }
  const observationStart = monotonicNow(), wallStart = now();
  wait();
  const observationMs = monotonicNow() - observationStart;
  if (physicalFallback && (observationMs < 2000 || observationMs > 10_000 || Math.abs(now() - wallStart - observationMs) > 1000)) throw new Error('Physical readiness observation interval or clock is invalid');
  if (physicalFallback) {
    const second = physicalBootSample(query, now, monotonicNow);
    if (JSON.stringify(second.milestones) !== JSON.stringify(physicalSample.milestones) ||
      Math.abs(second.bootStart - physicalSample.bootStart) > 1000 ||
      second.guestStart <= physicalSample.guestEnd ||
      second.guestStart - physicalSample.guestEnd < observationMs - 2000 ||
      second.guestEnd - physicalSample.guestStart > second.monotonicEnd - physicalSample.monotonicStart + 2000) throw new Error('Physical boot identity or uptime changed during readiness observation');
  }
  if (fallback && (observationMs < (instance.snapshotLog ? 2000 : 1000) || observationMs > 10_000 || Math.abs(now() - wallStart - observationMs) > 1000)) throw new Error('VM readiness observation interval or clock is invalid');
  if (targetKind === 'vm') {
    const bytes = readFileSync(vmLog), current = bytes.toString('utf8');
    const marker = current.lastIndexOf('Guest OS Boot Completed!!');
    if (marker < 0) throw new Error('VM boot marker disappeared during readiness observation');
    if (SYSTEM_INSTABILITY.test(current.slice(marker))) throw new Error('VM system became unstable during readiness observation');
    if (fallback) {
      const second = vmBootSample(query, now, monotonicNow), observedBytes = readFileSync(vmLog), stat = lstatSync(vmLog), latest = vmInstance(observedBytes, second, { vmLog, targetEndpoint });
      if (stat.dev !== firstStat.dev || stat.ino !== firstStat.ino || stat.size !== observedBytes.length || observedBytes.length < firstBytes.length || !observedBytes.subarray(0, firstBytes.length).equals(firstBytes) ||
        latest.identity !== instance.identity || JSON.stringify(second.milestones) !== JSON.stringify(firstSample.milestones) ||
        Math.abs(second.bootStart - firstSample.bootStart) > 1000 ||
        second.guestStart - firstSample.guestEnd < observationMs - 2000 ||
        second.guestEnd - firstSample.guestStart > second.monotonicEnd - firstSample.monotonicStart + 2000) throw new Error('VM boot instance, milestones or uptime changed during readiness observation');
      if (instance.snapshotLog) {
        const first = instance.snapshotLog, current = latest.snapshotLog;
        if (!current || current.stat.dev !== first.stat.dev || current.stat.ino !== first.stat.ino || current.bytes.length < first.bytes.length ||
          !current.bytes.subarray(0, first.bytes.length).equals(first.bytes)) throw new Error('VM snapshot companion log changed during readiness observation');
        logRecord = { ...logRecord, startupMode: 'snapshot-resume', snapshotLog: {
          sha256: digest(current.bytes), bytes: current.bytes.length, restoredPort: current.port } };
      }
      logRecord = { ...logRecord, sha256: digest(observedBytes), bytes: observedBytes.length, instanceSha256: instance.identity };
    }
  }
  const finalBootId = procRead(query, '/proc/sys/kernel/random/boot_id', targetKind === 'physical');
  if (query('param get bootevent.boot.completed').trim() !== 'true' || finalBootId.text !== bootId.text || finalBootId.denied !== bootId.denied || query('pidof com.ohos.sceneboard').trim() !== sceneBoard) throw new Error('Target boot/SceneBoard changed during readiness observation');
  return { status: 'PASS', checkedAt: new Date().toISOString(), bootIdSha256: physicalFallback ? digest(JSON.stringify([physicalSample.bootStart, physicalSample.milestones])) :
      bootId.denied ? instance.identity : digest(bootId.text),
    bootIdentitySource: physicalFallback ? 'physical-boot-milestones-v1' : bootId.denied ? (instance.snapshotLog ? 'vm-snapshot-resume-fingerprint-v1' : 'vm-startup-fingerprint-v1') : 'kernel-boot-id',
    ...(physicalFallback || fallback ? { uptimeSource: 'toybox-sysinfo', observationMs } : {}),
    sceneBoardPidSha256: digest(sceneBoard), bootCompleted: true, sceneBoardStable: true, emulatorLog: logRecord };
}
