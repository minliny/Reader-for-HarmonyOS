#!/usr/bin/env node
import { resolveHostTool } from './lib/tool-environment.mjs';

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  lstatSync,
  realpathSync,
  renameSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { verifyCoreBuildSnapshot } from '../../Reader-Core/scripts/build-input-snapshot.mjs';

function parseArgs(argv) {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const name = argv[index];
    if (name === '--allow-dirty' || name === '--preflight') {
      values.set(name, true);
      continue;
    }
    if (!name.startsWith('--') || index + 1 >= argv.length) {
      throw new Error(`invalid argument: ${name}`);
    }
    values.set(name, argv[index + 1]);
    index += 1;
  }
  return values;
}

function requireArg(args, name) {
  const value = args.get(name);
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`missing ${name}`);
  }
  return resolve(value);
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function assertRegularFile(path) {
  if (!lstatSync(path).isFile()) throw new Error(`build input must be a regular file: ${path}`);
}

function readRegular(path, encoding) {
  assertRegularFile(path);
  return readFileSync(path, encoding);
}

function fileRecord(path, recordedPath = path) {
  const bytes = readRegular(path);
  return { path: recordedPath, bytes: bytes.length, sha256: sha256(bytes) };
}

function writeJsonAtomic(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  const staging = mkdtempSync(join(dirname(path), '.reader-provenance-'));
  try {
    const temporary = join(staging, 'manifest.json');
    writeFileSync(temporary, JSON.stringify(value, null, 2) + '\n', { flag: 'wx', mode: 0o644 });
    renameSync(temporary, path);
  } finally { rmSync(staging, { recursive: true, force: true }); }
}

function canonicalPath(path) {
  let ancestor = resolve(path);
  const missing = [];
  // Resolve the nearest existing ancestor, including distant linked parents.
  // A dangling ancestor link fails realpath rather than creating new inputs.
  while (!lstatSync(ancestor, { throwIfNoEntry: false })) {
    missing.unshift(basename(ancestor));
    const parent = dirname(ancestor);
    if (parent === ancestor) throw new Error('cannot resolve provenance output ancestor');
    ancestor = parent;
  }
  return resolve(realpathSync(ancestor), ...missing);
}

function containsPath(root, path) {
  const within = relative(root, path);
  return within !== '..' && !within.startsWith(`..${sep}`) && !isAbsolute(within);
}

function gitMetadataDirectories(repo) {
  const git = (...args) => execFileSync('git', ['-C', repo, 'rev-parse', ...args], { encoding: 'utf8' }).trim();
  return [git('--absolute-git-dir'), resolve(repo, git('--git-common-dir'))].map(canonicalPath);
}

function gitRecord(repo) {
  const commit = execFileSync('git', ['-C', repo, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const status = execFileSync('git', ['-C', repo, 'status', '--porcelain', '--untracked-files=normal'], {
    encoding: 'utf8',
  }).trim();
  return { repo, commit, dirty: status.length > 0, status: status.length > 0 ? status.split('\n') : [] };
}

function requireSha(value, field) {
  if (typeof value !== 'string' || !/^[0-9a-f]{64}$/.test(value)) {
    throw new Error(`${field} must be a lowercase SHA-256`);
  }
}

function validateCoreIdentity(identity) {
  if (identity === null || typeof identity !== 'object' || Array.isArray(identity)) {
    throw new Error('Core build identity must be an object');
  }
  if (identity.schemaVersion !== 1 || typeof identity.gitDirty !== 'boolean' ||
      typeof identity.rustProfile !== 'string' || identity.rustProfile.trim().length === 0) {
    throw new Error('Core build identity has an invalid shape');
  }
  requireSha(identity.buildId, 'buildId');
  requireSha(identity.cargoLockSha256, 'cargoLockSha256');
  requireSha(identity.protocolSha256, 'protocolSha256');
  if (typeof identity.gitCommit !== 'string' ||
      !(identity.gitCommit === 'unknown' || /^[0-9a-f]{40,64}$/.test(identity.gitCommit))) {
    throw new Error('gitCommit is invalid');
  }
}

function parsePackageManifest(path) {
  const entries = readRegular(path, 'utf8').trim().split('\n').map((line) => {
    const match = line.match(/^([0-9a-f]{64})  ([0-9]+)  (.+)$/);
    if (match === null) {
      throw new Error(`invalid NAPI package manifest line: ${line}`);
    }
    return { sha256: match[1], bytes: Number.parseInt(match[2], 10), path: match[3] };
  });
  return { ...fileRecord(path), entries };
}

function parseBuildEvidence(path) {
  const values = {};
  for (const line of readRegular(path, 'utf8').trim().split('\n')) {
    const separator = line.indexOf('=');
    if (separator <= 0) {
      throw new Error(`invalid Core build evidence line: ${line}`);
    }
    values[line.slice(0, separator)] = line.slice(separator + 1);
  }
  return { ...fileRecord(path), values };
}

function treeRecord(root) {
  if (!lstatSync(root).isDirectory()) throw new Error('vendored SDK root must be a real directory');
  const files = [];
  function visit(directory) {
    for (const name of readdirSync(directory).sort()) {
      const path = resolve(directory, name);
      const stat = lstatSync(path);
      if (stat.isSymbolicLink()) throw new Error('vendored SDK must not contain symbolic links');
      if (stat.isDirectory()) {
        visit(path);
      } else if (stat.isFile()) {
        files.push(path);
      } else {
        throw new Error('vendored SDK must contain only regular files and directories');
      }
    }
  }
  visit(root);
  const hash = createHash('sha256');
  const entries = files.map((path) => {
    const bytes = readRegular(path);
    const relativePath = relative(root, path);
    hash.update(relativePath);
    hash.update(Buffer.from([0]));
    hash.update(bytes);
    hash.update(Buffer.from([0]));
    return { path: relativePath, bytes: bytes.length, sha256: sha256(bytes) };
  });
  return { root, sha256: hash.digest('hex'), entries };
}

function archiveEntryRecord(hap, entryPath) {
  assertRegularFile(hap);
  const names = execFileSync(resolveHostTool('unzip'), ['-Z1', hap], { encoding: 'utf8' }).trim().split('\n');
  if (!names.includes(entryPath)) {
    throw new Error(`HAP does not contain ${entryPath}`);
  }
  const bytes = execFileSync(resolveHostTool('unzip'), ['-p', hap, entryPath], {
    encoding: null,
    maxBuffer: 128 * 1024 * 1024,
  });
  return { path: entryPath, bytes: bytes.length, sha256: sha256(bytes) };
}

function stripAllRecord(inputPath, stripToolPath) {
  assertRegularFile(inputPath);
  assertRegularFile(stripToolPath);
  const temporaryRoot = mkdtempSync(join(tmpdir(), 'reader-hap-native-strip-'));
  const outputPath = join(temporaryRoot, 'libreader_core_napi.so');
  try {
    copyFileSync(inputPath, outputPath);
    execFileSync(stripToolPath, ['--strip-all', outputPath], { encoding: 'utf8' });
    const output = fileRecord(outputPath);
    return { bytes: output.bytes, sha256: output.sha256 };
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
}

const args = parseArgs(process.argv.slice(2));
const coreRepo = requireArg(args, '--core-repo');
const harmonyRepo = requireArg(args, '--harmony-repo');
const identityPath = requireArg(args, '--core-identity');
const napiManifestPath = requireArg(args, '--napi-manifest');
const nativeSoPath = requireArg(args, '--native-so');
const appNativeSoPath = requireArg(args, '--app-native-so');
const vendorRoot = requireArg(args, '--harmony-vendor');
const preflight = args.get('--preflight') === true;
const hapPath = preflight ? undefined : requireArg(args, '--hap');
const outputPath = requireArg(args, '--output');
const buildEvidencePath = requireArg(args, '--core-build-evidence');
const nativeStripToolPath = preflight ? undefined : requireArg(args, '--native-strip-tool');
const coreInputPath = requireArg(args, '--core-input-snapshot');
const allowDirty = args.get('--allow-dirty') === true;

// All argv file inputs are static files, including preflight's ignored SOs.
// Check type before JSON parsing, hashing, unzip, copy or tool execution: a
// FIFO must fail promptly instead of blocking before the Host source gate.
const staticFileInputs = [identityPath, napiManifestPath, nativeSoPath, appNativeSoPath,
  buildEvidencePath, coreInputPath, hapPath, nativeStripToolPath].filter(Boolean);
for (const path of staticFileInputs) assertRegularFile(path);
const outputCanonical = canonicalPath(outputPath);
const protectedInputs = [...staticFileInputs, join(coreRepo, '.git'), join(harmonyRepo, '.git')];
const gitMetadata = [coreRepo, harmonyRepo].flatMap(gitMetadataDirectories);
if (protectedInputs.some(path => canonicalPath(path) === outputCanonical) ||
    containsPath(canonicalPath(vendorRoot), outputCanonical) ||
    gitMetadata.some(directory => containsPath(directory, outputCanonical))) {
  throw new Error('provenance output must not replace a build input or Git identity input');
}

const coreIdentity = JSON.parse(readRegular(identityPath, 'utf8'));
validateCoreIdentity(coreIdentity);
const coreGit = gitRecord(coreRepo);
const harmonyGit = gitRecord(harmonyRepo);
if (coreIdentity.gitCommit !== coreGit.commit || coreIdentity.gitDirty !== coreGit.dirty) {
  throw new Error('Core build identity does not match the Core worktree used for the manifest');
}
if (!allowDirty && (coreGit.dirty || harmonyGit.dirty || coreIdentity.gitDirty)) {
  throw new Error('acceptance manifest refuses a dirty Core or Harmony worktree');
}

const nativeSo = fileRecord(nativeSoPath);
const appNativeSo = fileRecord(appNativeSoPath);
const identityArtifact = fileRecord(identityPath);
const buildEvidence = parseBuildEvidence(buildEvidencePath);
const coreInputArtifact = fileRecord(coreInputPath);
const coreInputSnapshot = JSON.parse(readRegular(coreInputPath, 'utf8'));
verifyCoreBuildSnapshot(coreRepo, coreInputSnapshot);
const hostTrackedInputs = execFileSync('git', ['-C', harmonyRepo, 'ls-files', '--cached', '-z'], {
  encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
}).split('\0').filter(path => path && !path.startsWith('.reader-artifacts/') && !path.startsWith('.reader-local/'));
const sourceInputs = [...coreInputSnapshot.files.map(file => resolve(coreRepo, file.path)),
  ...hostTrackedInputs.map(path => resolve(harmonyRepo, path))];
if (sourceInputs.some(path => canonicalPath(path) === outputCanonical)) {
  throw new Error('provenance output must not replace a Core/Host source input');
}
if (buildEvidence.values['core_input_snapshot_sha256'] !== coreInputArtifact.sha256) {
  throw new Error('Core build evidence does not bind the actual source input snapshot');
}
if (buildEvidence.values['sdk_smoke'] !== 'pass') {
  throw new Error('Native SDK smoke must pass; missing or skipped is not compatible evidence');
}
if (buildEvidence.values['artifact_sha256'] !== nativeSo.sha256 ||
    buildEvidence.values['artifact_bytes'] !== String(nativeSo.bytes) ||
    buildEvidence.values['core_build_identity_sha256'] !== identityArtifact.sha256) {
  throw new Error('Core build evidence does not bind the identity and native library inputs');
}
if (nativeSo.sha256 !== appNativeSo.sha256 || nativeSo.bytes !== appNativeSo.bytes) {
  throw new Error('Harmony app native input does not match the NAPI package native library');
}
const napiPackage = parsePackageManifest(napiManifestPath);
if (fileRecord(napiManifestPath).sha256 !== buildEvidence.values['package_manifest_sha256']) {
  throw new Error('Core build evidence does not bind the NAPI package manifest');
}
const vendor = treeRecord(vendorRoot);
const packageSdk = napiPackage.entries.filter(entry => !entry.path.startsWith('libs/'));
if (new Set(packageSdk.map(entry => entry.path)).size !== packageSdk.length ||
    packageSdk.length !== vendor.entries.length || vendor.entries.some(entry => !packageSdk.some(expected =>
      entry.path === expected.path && entry.sha256 === expected.sha256 && entry.bytes === expected.bytes))) {
  throw new Error('Harmony vendored SDK does not match the NAPI package manifest');
}
const packageNative = napiPackage.entries.find((entry) => entry.path === 'libs/arm64-v8a/libreader_core_napi.so');
if (packageNative === undefined || packageNative.sha256 !== nativeSo.sha256 || packageNative.bytes !== nativeSo.bytes) {
  throw new Error('NAPI package manifest does not bind the supplied native library');
}
if (preflight) {
  writeJsonAtomic(outputPath, { schemaVersion: 1, name: 'reader-native-preflight',
    coreGit, harmonyGit, coreInputArtifact, coreInputFingerprint: coreInputSnapshot.fingerprint,
    buildId: coreIdentity.buildId, nativeSo, vendor, napiPackage });
  console.log(JSON.stringify({ status: 'PASS', output: outputPath, nativeInputSha256: nativeSo.sha256 }));
  process.exit(0);
}
const embeddedNative = archiveEntryRecord(hapPath, 'libs/arm64-v8a/libreader_core_napi.so');
const packagedNative = stripAllRecord(appNativeSoPath, nativeStripToolPath);
if (embeddedNative.sha256 !== packagedNative.sha256 || embeddedNative.bytes !== packagedNative.bytes) {
  throw new Error('HAP embedded NAPI does not match the reproducibly stripped Harmony app native input');
}

const manifest = {
  schemaVersion: 1,
  name: 'reader-harmonyos-build-provenance',
  generatedAt: new Date().toISOString(),
  acceptanceEligible: !coreGit.dirty && !harmonyGit.dirty && !coreIdentity.gitDirty,
  core: {
    git: coreGit,
    buildIdentity: coreIdentity,
    buildIdentityArtifact: identityArtifact,
    buildInputSnapshot: coreInputArtifact,
    buildInputFingerprint: coreInputSnapshot.fingerprint,
    buildEvidence,
  },
  napi: {
    packageManifest: napiPackage,
    nativeInput: nativeSo,
  },
  harmony: {
    git: harmonyGit,
    vendor,
    nativeInput: appNativeSo,
    nativePackaging: {
      tool: fileRecord(nativeStripToolPath),
      arguments: ['--strip-all'],
      output: packagedNative,
    },
    buildCommand: args.get('--build-command') ?? '<unspecified>',
    hvigorVersion: args.get('--hvigor-version') ?? '<unspecified>',
    sdkVersion: args.get('--sdk-version') ?? '<unspecified>',
  },
  hap: {
    // The build directory is atomically renamed after this manifest is
    // generated. Keep the provenance portable by recording the published
    // artifact name instead of the ephemeral staging path.
    ...fileRecord(hapPath, basename(hapPath)),
    embeddedNative,
  },
  generator: {
    node: process.version,
    command: process.argv.join(' '),
  },
};

writeJsonAtomic(outputPath, manifest);
console.log(JSON.stringify({
  output: outputPath,
  acceptanceEligible: manifest.acceptanceEligible,
  buildId: coreIdentity.buildId,
  hapSha256: manifest.hap.sha256,
  nativeInputSha256: nativeSo.sha256,
  embeddedNativeSha256: manifest.hap.embeddedNative.sha256,
}));
