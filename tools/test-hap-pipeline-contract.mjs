import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { readFileSync } from 'node:fs';

import {
  deploymentRoute,
  sourceSnapshot,
} from '../scripts/hap-pipeline.mjs';

const fixture = mkdtempSync(join(tmpdir(), 'reader-hap-pipeline-test-'));
try {
  mkdirSync(resolve(fixture, 'entry/src'), { recursive: true });
  writeFileSync(resolve(fixture, 'entry/src/main.ets'), 'first\n');
  writeFileSync(resolve(fixture, 'build-profile.json5'), '{ "app": {} }\n');
  const first = sourceSnapshot(fixture);
  writeFileSync(resolve(fixture, 'entry/src/main.ets'), 'second\n');
  const second = sourceSnapshot(fixture);
  assert.notEqual(first.fingerprint, second.fingerprint,
    'a build-input mutation must change the source fingerprint');
  assert.equal(first.files.some((entry) => entry.path === 'entry/src/main.ets'), true);
} finally {
  rmSync(fixture, { recursive: true, force: true });
}

const signedDebug = {
  signature: { status: 'signed', verified: true, profileType: 'debug' },
};
const unsigned = {
  signature: { status: 'unsigned', verified: false, profileType: 'none' },
};
const installedDebugNone = {
  bundlePresent: true,
  appProvisionType: 'debug',
  appSignType: 'none',
};
assert.deepEqual(
  deploymentRoute({ targetKind: 'vm', installed: installedDebugNone, artifact: signedDebug }),
  { allowed: true, reason: 'matching-provision-signed-update-candidate', preservesData: true },
  'appSignType=none must not override a matching debug provision and signed artifact',
);
assert.deepEqual(
  deploymentRoute({ targetKind: 'vm', installed: installedDebugNone, artifact: unsigned }),
  { allowed: false, reason: 'installed-bundle-rejects-unsigned-preserve-data-route' },
  'an installed debug provision must reject the unsigned preserve-data route',
);
assert.deepEqual(
  deploymentRoute({
    targetKind: 'physical',
    installed: { bundlePresent: false, appProvisionType: '', appSignType: '' },
    artifact: unsigned,
  }),
  { allowed: false, reason: 'physical-device-requires-signed-hap' },
);

const pipeline = readFileSync(new URL('../scripts/hap-pipeline.mjs', import.meta.url), 'utf8');
assert.doesNotMatch(pipeline, /sourceNewerThanArtifact|\$HOME\/\.claude/,
  'the new pipeline must not use mtime freshness or obsolete user-specific skill paths');
assert.match(pipeline, /mkdtempSync\(join\(tmpdir\(\), 'reader-hap-build-'\)\)/,
  'every build must use an isolated temporary source/output sandbox');
assert.match(pipeline, /assertSnapshotUnchanged\(sourceBefore, sourceAfter/,
  'source build inputs must be fingerprinted before and after the isolated build');
assert.match(pipeline, /controller-snapshot\.json/,
  'the exact build controller and tests must be bound to the artifact manifest');
assert.match(pipeline, /workspace-contract-snapshot\.json/,
  'the exact workspace contract and project skills must be bound to the artifact manifest');

const trackedBuildProfile = readFileSync(new URL('../build-profile.json5', import.meta.url), 'utf8');
assert.doesNotMatch(
  trackedBuildProfile,
  /signingConfigs|storePassword|keyPassword|certpath|profile|storeFile|keyAlias/,
  'the tracked build profile must not contain signing configuration or secret-bearing paths',
);
const gitignore = readFileSync(new URL('../.gitignore', import.meta.url), 'utf8');
assert.match(gitignore, /^\.reader-artifacts\/$/m);
assert.match(gitignore, /^\.reader-local\/$/m);

const harmonyReadme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');
assert.doesNotMatch(harmonyReadme, /\.\/scripts\/check-local\.sh --hap/,
  'the retired check-local HAP entry must not return');

console.log('HarmonyOS HAP pipeline contract: PASS');
