import assert from 'node:assert/strict';
import { resetVmReaderData } from '../scripts/lib/hap-vm-reset.mjs';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';
const definitions = { 'vm-reset': { description: 'VM-only Reader uninstall reset acknowledgement, absence, boot stability and failure stop', resources: [] } };
for (const id of selectContractCases(definitions)) {
  const readiness = { status: 'PASS', bootCompleted: true, sceneBoardStable: true,
    bootIdentitySource: 'kernel-boot-id', bootIdSha256: 'boot-a', sceneBoardPidSha256: 'scene-a' };
  const installed = { bundlePresent: true, bundleName: 'io.reader.minliny' };
  const artifact = { kind: 'signed', signature: { status: 'signed', verified: true } };
  function fixture(patch = {}) {
    const events = []; let observations = 0;
    return { events, args: { targetKind: 'vm', installed, artifact, readiness,
      observeReadiness() { events.push('readiness'); return readiness; },
      query(command) { events.push(command); return { status: 0, stdout: 'uninstall bundle successfully.\n', stderr: '' }; },
      observeInstalled() { events.push('installed'); return ++observations === 1 ? installed : { bundlePresent: false }; }, ...patch } };
  }
  for (const patch of [{ targetKind: 'physical' }, { targetKind: undefined }, { installed: undefined },
    { installed: { bundlePresent: false, bundleName: 'io.reader.minliny' } },
    { installed: { bundlePresent: true, bundleName: 'other.app' } },
    { artifact: { kind: 'unsigned', signature: { status: 'unsigned', verified: false } } },
    { artifact: { kind: 'signed', signature: { status: 'signed', verified: false } } }]) {
    const f = fixture(patch); assert.throws(() => resetVmReaderData(f.args)); assert.deepEqual(f.events, [], 'invalid input has no destructive call');
  }
  for (const reply of [{ status: 1, stdout: 'uninstall bundle successfully.', stderr: '' },
    { status: 0, stdout: 'error: uninstall failed', stderr: '' },
    { status: 0, stdout: 'uninstall bundle successfully.', stderr: 'transport error' },
    { status: 0, stdout: '', stderr: '' }]) {
    const f = fixture({ query() { return reply; } });
    assert.throws(() => resetVmReaderData(f.args), /acknowledgement/); assert.deepEqual(f.events, ['readiness', 'installed']);
  }
  for (const observed of [{ bundlePresent: true }, {}, undefined]) {
    let observations = 0; const f = fixture({ observeInstalled() { return ++observations === 1 ? installed : observed; } }); assert.throws(() => resetVmReaderData(f.args), /absence|present/);
  }
  for (const when of ['before', 'after']) {
    let calls = 0; const f = fixture({ observeReadiness() { calls++; return calls === (when === 'before' ? 1 : 2) ? { ...readiness, bootIdSha256: 'changed' } : readiness; } });
    assert.throws(() => resetVmReaderData(f.args), /boot changed/);
    assert.equal(f.events.includes('bm uninstall -n io.reader.minliny'), when === 'after');
  }
  const drift = fixture({ observeInstalled() { return { ...installed, versionCode: 2 }; } });
  assert.throws(() => resetVmReaderData(drift.args), /identity changed/);
  assert.deepEqual(drift.events, ['readiness'], 'identity drift never issues uninstall');
  const f = fixture(), result = resetVmReaderData(f.args);
  assert.deepEqual(f.events, ['readiness', 'installed', 'bm uninstall -n io.reader.minliny', 'installed', 'readiness']);
  assert.equal(result.dataPolicy, 'reset'); assert.equal(result.dataPreserved, false);
  assert.equal(result.dataReset.method, 'uninstallWithoutKeepData'); assert.equal(result.dataReset.bundleAbsent, true);
  assert.equal(result.dataReset.acknowledged, true); assert.equal(Object.hasOwn(result, 'freshStorage'), false);
  assert.equal(Object.hasOwn(result, 'storageAdmission'), false);
  recordContractCasePass(id);
}
