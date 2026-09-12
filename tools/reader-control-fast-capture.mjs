#!/usr/bin/env node
/**
 * Preserve-data, single-target diagnostic capture for short control-bar
 * transitions.  It deliberately uses snapshot_display (JPEG) instead of the
 * slower uitest screenCap path so a host-timestamped burst can cover a
 * transition window.  These timestamps are host-relative and are not VSync
 * proof.
 *
 * Example:
 *   node tools/reader-control-fast-capture.mjs \
 *     --target 127.0.0.1:5555 \
 *     --hdc /absolute/path/to/hdc \
 *     --output-dir /absolute/evidence/dir \
 *     --action collapse --x 1160 --y 1785
 */
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { isAbsolute, parse, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const args = process.argv.slice(2);
const value = name => {
  const index = args.indexOf(name);
  if (index < 0 || index + 1 >= args.length) throw new Error(`missing ${name}`);
  return args[index + 1];
};
const optionalValue = (name, fallback) => {
  const index = args.indexOf(name);
  return index < 0 ? fallback : (index + 1 < args.length ? args[index + 1] : (() => { throw new Error(`missing ${name}`); })());
};
const target = value('--target');
const hdc = value('--hdc');
const outputDir = resolve(value('--output-dir'));
const action = value('--action');
const x = Number(value('--x'));
const y = Number(value('--y'));
const count = Number(optionalValue('--count', '16'));
const intervalMs = Number(optionalValue('--interval-ms', '80'));
const display = Number(optionalValue('--display', '0'));
const serial = args.includes('--serial');
if (!/^[A-Za-z0-9._:\[\]-]{1,256}$/.test(target) || target.startsWith('-')) throw new Error('invalid exact target');
if (!isAbsolute(hdc) || !isAbsolute(outputDir) || outputDir === parse(outputDir).root) throw new Error('absolute non-root paths required');
if (!['collapse', 'open', 'custom'].includes(action)) throw new Error('invalid action');
for (const [n, v, max] of [['x', x, 16384], ['y', y, 16384], ['count', count, 64], ['interval-ms', intervalMs, 2000], ['display', display, 15]]) {
  if (!Number.isInteger(v) || v < 0 || v > max) throw new Error(`invalid ${n}`);
}
mkdirSync(outputDir, { recursive: true });

const targetRef = createHash('sha256').update(target).digest('hex').slice(0, 12);
const startedAt = new Date().toISOString();
const runId = `${Date.now()}-${targetRef}`;
const records = [];
function run(argv) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(hdc, ['-t', target, ...argv], { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk.toString(); });
    child.stderr.on('data', chunk => { stderr += chunk.toString(); });
    child.on('error', rejectRun);
    child.on('close', code => resolveRun({ code, stdout, stderr }));
  });
}
async function capture(index, scheduledMs) {
  const remote = `/data/local/tmp/reader-control-fast-${runId}-${index}.jpeg`;
  const local = resolve(outputDir, `frame-${String(index).padStart(2, '0')}.jpeg`);
  const triggerMs = Date.now();
  const snap = await run(['shell', 'snapshot_display', '-i', String(display), '-f', remote, '-t', 'jpeg']);
  const snapDoneMs = Date.now();
  const recv = snap.code === 0 ? await run(['file', 'recv', remote, local]) : { code: -1, stdout: '', stderr: 'snapshot failed' };
  const doneMs = Date.now();
  records.push({ index, scheduledMs, triggerMs, snapDoneMs, doneMs, remote, local,
    snapshotExit: snap.code, receiveExit: recv.code,
    snapshotStdout: snap.stdout.slice(-1200), snapshotStderr: snap.stderr.slice(-1200),
    receiveStdout: recv.stdout.slice(-1200), receiveStderr: recv.stderr.slice(-1200) });
}

const clickStartedMs = Date.now();
const clickPromise = action === 'custom'
  ? Promise.resolve({ code: 0, stdout: '', stderr: '' })
  : run(['shell', 'uitest', 'uiInput', 'click', String(x), String(y)]);
const burstStart = Date.now();
if (serial) {
  // A serialized burst is intentionally slower than the historical parallel
  // sampler, but every JPEG is requested only after the previous request and
  // readback completed. Parallel snapshot_display calls can finish out of
  // order and create an apparent brightness “flicker” when sorted by index.
  for (let index = 0; index < count; index += 1) {
    const scheduledMs = index * intervalMs;
    const waitMs = burstStart + scheduledMs - Date.now();
    if (waitMs > 0) await delay(waitMs);
    await capture(index, scheduledMs);
  }
} else {
  const capturePromises = [];
  for (let index = 0; index < count; index += 1) {
    const scheduledMs = index * intervalMs;
    const waitMs = burstStart + scheduledMs - Date.now();
    if (waitMs > 0) await delay(waitMs);
    capturePromises.push(capture(index, scheduledMs));
  }
  await Promise.all(capturePromises);
}
const click = await clickPromise;
const finishedAt = new Date().toISOString();
records.sort((a, b) => (a.snapDoneMs - b.snapDoneMs) || (a.index - b.index));
const metadata = { version: 2, target, targetRef, hdc, action, x, y, display, count, intervalMs, serial,
  startedAt, finishedAt, clickStartedMs, clickExit: click.code,
  clickStdout: click.stdout?.slice(-1200), clickStderr: click.stderr?.slice(-1200), records };
writeFileSync(resolve(outputDir, 'capture-metadata.json'), `${JSON.stringify(metadata, null, 2)}\n`);
if (click.code !== 0 || records.some(record => record.snapshotExit !== 0 || record.receiveExit !== 0)) process.exitCode = 1;
