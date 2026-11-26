import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertCleanMainline, assertInstallReceipt, assertMainlineHap, latestSignedRun,
} from '../../scripts/lib/hap-mainline-provenance.mjs';

const harmony = { commit: 'a'.repeat(40), mainCommit: 'a'.repeat(40), dirty: false };
const core = { commit: 'b'.repeat(40), mainCommit: 'b'.repeat(40), dirty: false };
const expectedVersion = {
  schema: 'reader-app-build-v1', versionName: '0.2.0', versionCode: 420, channel: 'DEV',
  contentId: '123456789abc', appContentHash: '123456789abc' + 'f'.repeat(52),
  appBuildId: '0.2.0.DEV.123456789abc',
};
const artifact = { kind: 'signed', sha256: 'c'.repeat(64), signature: { status: 'signed', verified: true,
  certificateSha256: 'f'.repeat(64), profileType: 'debug', appIdSha256: 'd'.repeat(64), appIdentifierSha256: '' } };
const manifest = {
  runId: 'new-run', source: { harmony, core }, abi: 'x86_64', expectedVersion, artifacts: [artifact],
  finishedAt: '2026-11-27T01:00:00Z',
};
const verified = { manifest, artifacts: [artifact] };
const observed = { targetKind: 'vm', targetRef: '42acba46aa37', hdcServer: '192.168.1.10:8710', vmLocation: 'remote',
  installed: { bundlePresent: true, bundleName: 'io.reader.minliny', versionName: '0.2.0', versionCode: 420,
    appVersion: expectedVersion, cpuAbi: 'x86_64', uid: 20001, updateTime: 1795736621000,
    appSignType: 'enterprise', appProvisionType: 'debug', appIdSha256: 'd'.repeat(64), appIdentifierSha256: '' },
};
const receipt = { schemaVersion: 1, name: 'reader-harmonyos-deployment-receipt',
  runId: manifest.runId, install: 'PASS', dataPolicy: 'preserve', appVersionCheck: 'PASS', expectedVersion,
  targetKind: observed.targetKind, targetRef: observed.targetRef, hdcServer: observed.hdcServer, vmLocation: observed.vmLocation,
  postInstall: observed.installed, artifact, completedAt: '2026-11-27T01:01:00Z',
};

test('acceptance admits clean exact mainline and newest signed ABI even when an older candidate is present', () => {
  const older = { ...manifest, runId: 'older-run', finishedAt: '2026-11-26T01:00:00Z' };
  const arm = { ...manifest, runId: 'arm-run', abi: 'arm64-v8a' };
  const unsigned = { ...manifest, runId: 'unsigned-run', finishedAt: '2026-11-27T02:00:00Z',
    artifacts: [{ ...artifact, kind: 'unsigned' }] };
  assert.equal(latestSignedRun([older, unsigned, arm, manifest], 'x86_64'), manifest);
  assert.equal(latestSignedRun([older, unsigned, arm, manifest], 'arm64-v8a'), arm);
  assert.throws(() => latestSignedRun([manifest, { ...manifest, runId: 'ambiguous' }], 'x86_64'), /ambiguous/);
  assert.equal(assertMainlineHap(verified, { harmony, core }, 'x86_64'), artifact);
  assert.doesNotThrow(() => assertInstallReceipt({ receipt, manifest, artifact, observed }));
});

test('acceptance blocks dirty working trees, detached feature commits, stale mainline and unverifiable packages', () => {
  assert.throws(() => assertCleanMainline({ ...harmony, dirty: true }, core), /clean Harmony/);
  assert.throws(() => assertCleanMainline(harmony, { ...core, dirty: true }), /clean Core/);
  assert.throws(() => assertCleanMainline({ ...harmony, commit: 'e'.repeat(40) }, core), /HEAD at refs\/heads\/main/);
  assert.throws(() => assertMainlineHap({ ...verified, manifest: { ...manifest, source: {
    harmony, core: { ...core, commit: '3'.repeat(40) },
  } } }, { harmony, core }, 'x86_64'), /clean Core main/);
  assert.throws(() => assertMainlineHap(verified, { harmony, core }, 'arm64-v8a'), /ABI mismatch/);
  assert.throws(() => assertMainlineHap({ ...verified, artifacts: [{ ...artifact, signature: { status: 'signed', verified: false } }] },
    { harmony, core }, 'x86_64'), /verified signature/);
});

test('install proof rejects wrong server, target, HAP bytes, stale replacement and wrong embedded identity', () => {
  for (const patch of [{ hdcServer: '127.0.0.1:8710' }, { targetRef: 'a'.repeat(12) },
    { artifact: { ...artifact, sha256: 'e'.repeat(64) } }]) {
    assert.throws(() => assertInstallReceipt({ receipt: { ...receipt, ...patch }, manifest, artifact, observed }), /does not bind/);
  }
  assert.throws(() => assertInstallReceipt({ receipt: { ...receipt, artifact: { ...artifact,
    signature: { ...artifact.signature, certificateSha256: '0'.repeat(64) } } }, manifest, artifact, observed }),
  /signing identity differs: certificateSha256/);
  assert.throws(() => assertInstallReceipt({ receipt, manifest, artifact,
    observed: { ...observed, installed: { ...observed.installed, updateTime: observed.installed.updateTime + 1 } } }), /updateTime/);
  const appVersion = { ...expectedVersion, contentId: '0'.repeat(12), appContentHash: '0'.repeat(64),
    appBuildId: '0.2.0.DEV.' + '0'.repeat(12) };
  assert.throws(() => assertInstallReceipt({ receipt, manifest, artifact,
    observed: { ...observed, installed: { ...observed.installed, appVersion } } }), /Live installed bundle/);
});
