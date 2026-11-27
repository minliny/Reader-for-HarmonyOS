import { createHash } from 'node:crypto';
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { basename, dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { contentSnapshot } from '../../../Reader-Core/scripts/build-input-snapshot.mjs';
import { APP_RELEASE_LEDGER } from '../lib/app-build-identity.mjs';
import { regularInputSnapshot, snapshotFileRecords as snapshottedFiles } from '../lib/regular-input-snapshot.mjs';

// The canonical CLI also hosts the Native preflight worker.
export const HAP_PIPELINE_ENTRY = new URL('../hap-pipeline.mjs', import.meta.url);
const SCRIPT_PATH = fileURLToPath(HAP_PIPELINE_ENTRY);
export const REPO_ROOT = resolve(dirname(SCRIPT_PATH), '..');
export const WORKSPACE_ROOT = resolve(REPO_ROOT, '..');
export const CORE_ROOT = resolve(WORKSPACE_ROOT, 'Reader-Core');

export const BUILD_INPUTS = [
  'AppScope',
  APP_RELEASE_LEDGER,
  'entry/src',
  'entry/libs',
  'entry/vendor/core-harmony',
  'build-profile.json5',
  'entry/build-profile.json5',
  'hvigor-config.json5',
  'hvigor',
  'hvigorfile.ts',
  'oh-package.json5',
  'oh-package-lock.json5',
  'entry/hvigorfile.ts',
  'entry/oh-package.json5',
  'entry/oh-package-lock.json5',
];
export const DEPENDENCY_INPUTS = BUILD_INPUTS.filter(path => /(?:^|\/)oh-package(?:-lock)?\.json5$/.test(path) ||
  path === 'entry/vendor/core-harmony');
// App identity, controller snapshots and storage proofs bind the same implementation files.
export const HAP_PIPELINE_INPUTS = [
  'scripts/hap-pipeline.mjs',
  'scripts/hap-pipeline/locks-and-retention.mjs',
  'scripts/hap-pipeline/workspace-fingerprint.mjs',
  'scripts/hap-pipeline/build-and-sign.mjs',
  'scripts/hap-pipeline/deploy-and-verify.mjs',
];

// Identity-generation/build code is an effective input, but the ledger's
// assigned version fields are deliberately outside the app content domain.
export const APP_CONTENT_INPUTS = [...BUILD_INPUTS, ...HAP_PIPELINE_INPUTS,
  'scripts/lib/app-build-identity.mjs', 'scripts/lib/app-build-context.mjs', 'scripts/lib/harmony-toolchain.mjs'];
const HARMONY_GATE_INPUTS = [
  'scripts/test-host.mjs',
  'scripts/reader-ts-module-loader.mjs',
  'scripts/vm-journeys.mjs',
  'scripts/check-hap-provenance.mjs',
  'tests',
  'scripts/lib',
  ...HAP_PIPELINE_INPUTS,
  'tools',
];

export const CONTRACT_EVIDENCE_POLICY_INPUT = 'tools/hap-contract-evidence-policy.json';
const WORKSPACE_CONTRACT_INPUTS = [
  'Reader-Core/governance/workspace',
  'Reader-Core/scripts/sync-workspace.mjs',
  'Reader-Core/scripts/validate-workspace.py',
  'Reader-Core/scripts/lib',
  'Reader-Core/scripts/check-local.mjs',
  'README.md',
  'ARCHITECTURE.md',
  'HAP_BUILD_SYSTEM.md',
  'scripts/check-development.sh',
  'scripts/check-hap-build-system.mjs',
  '.agents/skills/reader-harmonyos-hap-pipeline',
  '.agents/skills/reader-cross-platform-delivery',
];

export function fail(message, code = 1) {
  const error = new Error(message);
  error.exitCode = code;
  throw error;
}

export function sha256Bytes(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

export function fileRecord(path, publicPath = basename(path)) {
  const bytes = readFileSync(path);
  return {
    path: publicPath,
    bytes: bytes.length,
    sha256: sha256Bytes(bytes),
  };
}

export function sourceSnapshot(repo = REPO_ROOT) {
  return regularInputSnapshot(repo, BUILD_INPUTS, 'Host build inputs');
}

export function controllerSnapshot(repo = REPO_ROOT) {
  return regularInputSnapshot(repo, HARMONY_GATE_INPUTS, 'Host controller inputs');
}

export function workspaceContractSnapshot(workspace = WORKSPACE_ROOT) {
  return regularInputSnapshot(workspace, WORKSPACE_CONTRACT_INPUTS, 'Workspace contract inputs');
}

export function assertResolvedCorePackage(sandboxRepo, expectedVendor) {
  const modules = realpathSync(resolve(sandboxRepo, 'entry/oh_modules'));
  const installed = realpathSync(resolve(modules, '@reader/core-harmony'));
  // In a full Hvigor project OHPM hoists local packages to root/oh_modules;
  // standalone entry fixtures use entry/oh_modules. Both are freshly created
  // in this build sandbox, and neither may resolve into another checkout.
  const roots = [modules];
  const hoisted = resolve(sandboxRepo, 'oh_modules');
  if (existsSync(hoisted)) roots.push(realpathSync(hoisted));
  const sandbox = realpathSync(sandboxRepo);
  for (const root of roots) {
    const within = relative(sandbox, root);
    if (!within || within === '..' || within.startsWith(`..${sep}`) || isAbsolute(within)) {
      fail('resolved Core package escapes the isolated dependency directory');
    }
  }
  const contained = roots.some(root => {
    const within = relative(root, installed);
    return within !== '..' && !within.startsWith(`..${sep}`) && !isAbsolute(within);
  });
  if (!contained) {
    fail('resolved Core package escapes the isolated dependency directory');
  }
  const vendor = expectedVendor ?? contentSnapshot(resolve(sandboxRepo, 'entry/vendor/core-harmony'), ['.']);
  const resolvedPackage = contentSnapshot(installed, ['.']);
  if ([...vendor.files, ...resolvedPackage.files].some(file => file.type !== 'file')) {
    fail('resolved Core package must contain regular files, not unbound symlink targets');
  }
  assertSnapshotUnchanged(vendor, resolvedPackage, 'resolved Core package');
}

export function snapshotSubset(snapshot, inputs, prefix = '') {
  const files = snapshot.files.filter(file => inputs.some(input => file.path === input || file.path.startsWith(`${input}${sep}`)))
    .map(file => prefix ? { ...file, path: file.path.slice(prefix.length + 1) } : file);
  return snapshottedFiles(files, prefix ? ['.'] : inputs);
}

export function appContentRecords(source, controller) {
  return new Map([source, controller].flatMap(snapshot =>
    snapshot.files.map(record => [record.path.split(sep).join('/'), record])));
}

export function assertSnapshotUnchanged(before, after, label) {
  if (before.fingerprint !== after.fingerprint) {
    fail(`${label} changed during the HAP build: ${before.fingerprint} -> ${after.fingerprint}`);
  }
}

export function assertGitRecordUnchanged(before, after, label) {
  if (before.commit !== after.commit || before.mainCommit !== after.mainCommit || before.dirty !== after.dirty ||
      JSON.stringify(before.status) !== JSON.stringify(after.status)) {
    fail(`${label} Git identity changed during the HAP build`);
  }
}

export function snapshotDescriptor(snapshot, name) {
  return { fingerprint: snapshot.fingerprint, fileCount: snapshot.fileCount, snapshot: name };
}

export function controllerRequiresContractEvidence(controller) {
  const policies = controller.files.filter(file => file.path === CONTRACT_EVIDENCE_POLICY_INPUT);
  if (policies.length === 0) {
    if (!controller.files.some(file => file.path === 'scripts/hap-pipeline.mjs' && file.type === 'file')) {
      fail('legacy contract controller identity is missing');
    }
    return false;
  }
  if (policies.length !== 1 || policies[0].type !== 'file' || !/^[0-9a-f]{64}$/.test(policies[0].sha256 ?? '') ||
      !Number.isInteger(policies[0].bytes) || policies[0].bytes <= 0) fail('contract controller policy identity is invalid');
  return true;
}

export function verifySnapshotIdentity(directory, descriptor, expectedName, label) {
  if (descriptor?.snapshot !== expectedName) fail(`${label} snapshot path is invalid`);
  const snapshot = JSON.parse(readFileSync(resolve(directory, expectedName), 'utf8'));
  if (snapshot.schemaVersion !== 1 || !Array.isArray(snapshot.files)) {
    fail(`${label} snapshot schema is invalid`);
  }
  const snapshotHash = createHash('sha256');
  for (const record of snapshot.files) {
    snapshotHash.update(JSON.stringify(record));
    snapshotHash.update('\n');
  }
  const computedFingerprint = snapshotHash.digest('hex');
  if (computedFingerprint !== snapshot.fingerprint ||
      snapshot.fingerprint !== descriptor.fingerprint ||
      snapshot.files.length !== descriptor.fileCount) {
    fail(`${label} snapshot identity mismatch`);
  }
  return snapshot;
}
