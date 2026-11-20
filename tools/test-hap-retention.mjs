import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, readdirSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { planHapRetention, applyHapRetention, publishRetainedHapRun } from '../scripts/hap-pipeline.mjs';

const root = mkdtempSync(join(tmpdir(), 'reader-hap-retention-'));
const outside = mkdtempSync(join(tmpdir(), 'reader-hap-unowned-'));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const json = (path, value) => writeFileSync(path, JSON.stringify(value));
function fixture(name, day, target = undefined) {
  const dir = join(root, name);
  mkdirSync(dir);
  const bytes = `synthetic package ${name}`;
  writeFileSync(join(dir, 'entry-default-signed.hap'), bytes);
  json(join(dir, 'manifest.json'), { schemaVersion: 2, name: 'reader-harmonyos-hap-run', runId: name,
    finishedAt: `2026-09-${String(day).padStart(2, '0')}T12:00:00Z`,
    artifacts: [{ path: 'entry-default-signed.hap', sha256: sha(bytes) }] });
  writeFileSync(join(dir, 'source-snapshot.json'), 'preserve evidence');
  if (target) json(join(dir, 'deploy-fixture.json'), { name: 'reader-harmonyos-deployment-receipt', runId: name,
    install: 'PASS', targetKind: 'vm', targetRef: target, completedAt: `2026-09-${String(day).padStart(2, '0')}T13:00:00Z` });
  return dir;
}
try {
  for (let day = 1; day <= 12; day++) fixture(`run-${day}`, day, day <= 3 ? 'one' : undefined);
  json(join(root, 'retention-pins.json'), { runIds: ['run-1'] });
  let plan = planHapRetention(root);
  assert.equal(plan.keepRuns, 10);
  assert.equal(plan.retained.length, 10);
  assert.ok(plan.retained.includes('run-1'));
  assert.ok(!plan.retained.includes('run-2'), 'deployment history does not pin packages');
  assert.deepEqual(plan.remove.map(run => run.runId).sort(), ['run-2', 'run-3']);
  assert.equal(existsSync(join(root, 'run-2/entry-default-signed.hap')), true, 'planning is read only');
  const result = applyHapRetention(plan);
  assert.equal(result.removedRuns.length, 2);
  assert.equal(existsSync(join(root, 'run-2/entry-default-signed.hap')), false);
  assert.equal(readFileSync(join(root, 'run-2/source-snapshot.json'), 'utf8'), 'preserve evidence');
  assert.equal(JSON.parse(readFileSync(join(root, 'run-2/retention-receipt.json'))).packageAvailable, false);
  assert.equal(planHapRetention(root).remove.length, 0, 'cleanup is idempotent');
  json(join(root, 'run-6/retention-install-vm-incomplete.json'), {
    name: 'reader-hap-install-protection', runId: 'run-6',
  });
  assert.ok(!planHapRetention(root, 5).retained.includes('run-6'), 'orphan install marker is not a pin');
  assert.equal(planHapRetention(root).staleInstallMarkers.length, 1);
  const resolved = applyHapRetention(planHapRetention(root));
  assert.equal(resolved.resolvedInstallMarkers.length, 1);
  assert.ok(readdirSync(join(root, 'run-6')).some(name => name.startsWith('resolved-retention-install-')));
  assert.equal(planHapRetention(root).staleInstallMarkers.length, 0);
  assert.ok(planHapRetention(root, 5).retained.includes('run-12'));
  json(join(root, 'retention-pins.json'), { runIds: ['run-1', 'run-6', 'run-12'] });
  assert.throws(() => planHapRetention(root, 3, 1), /release 1 slot.*explicit-pin/);
  json(join(root, 'retention-pins.json'), { runIds: ['run-1'] });
  plan = planHapRetention(root, 10, 1);
  assert.equal(plan.retained.length, 9, 'reserve only for a verified candidate publication');
  assert.throws(() => planHapRetention(root, 0), /budget/);
  const candidate = plan.remove[0].files[0].path;
  writeFileSync(candidate, 'tampered synthetic package');
  assert.throws(() => applyHapRetention(plan), /inventory changed|hash changed/);
  assert.ok(existsSync(candidate), 'tampering must not delete any candidate');
  json(join(root, 'retention-pins.json'), { runIds: ['missing-recovery'] });
  assert.throws(() => planHapRetention(root), /pinned recovery package is missing/);
  json(join(root, 'retention-pins.json'), { runIds: [] });
  symlinkSync(outside, join(root, 'unowned-run'));
  assert.throws(() => planHapRetention(root), /unrecognized artifact-root entry/);
  rmSync(join(root, 'unowned-run'));
  writeFileSync(join(root, 'run-12/unknown.hap'), 'not manifest owned');
  assert.throws(() => planHapRetention(root), /unowned HAP/);
  rmSync(join(root, 'run-12/unknown.hap'));
  const link = join(outside, 'artifact-root-link');
  symlinkSync(root, link);
  assert.throws(() => planHapRetention(link), /real directory/);
  // A failed/incomplete staged build cannot remove any old HAP.
  const staged = join(root, '.staging-new'); mkdirSync(staged);
  const before = planHapRetention(root).retained;
  assert.throws(() => publishRetainedHapRun(staged, join(root, 'new'), 10));
  assert.deepEqual(planHapRetention(root).retained, before);
  // Restore the intentionally corrupted old package before successful publication.
  const original = 'synthetic package ' + candidate.split('/').at(-2);
  writeFileSync(candidate, original);
  const bytes = 'new synthetic candidate'; writeFileSync(join(staged, 'entry-default-signed.hap'), bytes);
  json(join(staged, 'manifest.json'), { schemaVersion: 2, name: 'reader-harmonyos-hap-run', runId: 'new',
    finishedAt: '2026-10-01T00:00:00Z', artifacts: [{ path: 'entry-default-signed.hap', sha256: sha(bytes) }] });
  const published = publishRetainedHapRun(staged, join(root, 'new'), 10);
  assert.equal(published.removedRuns.length, 1); assert.equal(planHapRetention(root).retained.length, 10);
  assert.ok(planHapRetention(root).retained.includes('new')); assert.ok(!existsSync(staged));
  console.log('PASS HAP retention: rolling cap, explicit pins, orphan resolution, verified publication, evidence, tampering and symlinks');
} finally {
  rmSync(root, { recursive: true, force: true });
  rmSync(outside, { recursive: true, force: true });
}
