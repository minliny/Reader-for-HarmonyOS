#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';

function parseArgs(argv) {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const name = argv[index];
    if (name === '--allow-dirty') {
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

function fileRecord(path) {
  const bytes = readFileSync(path);
  return { path, bytes: bytes.length, sha256: sha256(bytes) };
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
  const entries = readFileSync(path, 'utf8').trim().split('\n').map((line) => {
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
  for (const line of readFileSync(path, 'utf8').trim().split('\n')) {
    const separator = line.indexOf('=');
    if (separator <= 0) {
      throw new Error(`invalid Core build evidence line: ${line}`);
    }
    values[line.slice(0, separator)] = line.slice(separator + 1);
  }
  return { ...fileRecord(path), values };
}

function treeRecord(root) {
  const files = [];
  function visit(directory) {
    for (const name of readdirSync(directory).sort()) {
      const path = resolve(directory, name);
      const stat = statSync(path);
      if (stat.isDirectory()) {
        visit(path);
      } else if (stat.isFile()) {
        files.push(path);
      }
    }
  }
  visit(root);
  const hash = createHash('sha256');
  const entries = files.map((path) => {
    const bytes = readFileSync(path);
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
  const names = execFileSync('unzip', ['-Z1', hap], { encoding: 'utf8' }).trim().split('\n');
  if (!names.includes(entryPath)) {
    throw new Error(`HAP does not contain ${entryPath}`);
  }
  const bytes = execFileSync('unzip', ['-p', hap, entryPath], {
    encoding: null,
    maxBuffer: 128 * 1024 * 1024,
  });
  return { path: entryPath, bytes: bytes.length, sha256: sha256(bytes) };
}

const args = parseArgs(process.argv.slice(2));
const coreRepo = requireArg(args, '--core-repo');
const harmonyRepo = requireArg(args, '--harmony-repo');
const identityPath = requireArg(args, '--core-identity');
const napiManifestPath = requireArg(args, '--napi-manifest');
const nativeSoPath = requireArg(args, '--native-so');
const appNativeSoPath = requireArg(args, '--app-native-so');
const vendorRoot = requireArg(args, '--harmony-vendor');
const hapPath = requireArg(args, '--hap');
const outputPath = requireArg(args, '--output');
const buildEvidencePath = requireArg(args, '--core-build-evidence');
const allowDirty = args.get('--allow-dirty') === true;

const coreIdentity = JSON.parse(readFileSync(identityPath, 'utf8'));
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
if (buildEvidence.values['artifact_sha256'] !== nativeSo.sha256 ||
    buildEvidence.values['artifact_bytes'] !== String(nativeSo.bytes) ||
    buildEvidence.values['core_build_identity_sha256'] !== identityArtifact.sha256) {
  throw new Error('Core build evidence does not bind the identity and native library inputs');
}
if (nativeSo.sha256 !== appNativeSo.sha256 || nativeSo.bytes !== appNativeSo.bytes) {
  throw new Error('Harmony app native input does not match the NAPI package native library');
}
const napiPackage = parsePackageManifest(napiManifestPath);
const packageNative = napiPackage.entries.find((entry) => entry.path === 'libs/arm64-v8a/libreader_core_napi.so');
if (packageNative === undefined || packageNative.sha256 !== nativeSo.sha256 || packageNative.bytes !== nativeSo.bytes) {
  throw new Error('NAPI package manifest does not bind the supplied native library');
}
const embeddedNative = archiveEntryRecord(hapPath, 'libs/arm64-v8a/libreader_core_napi.so');
if (embeddedNative.sha256 !== appNativeSo.sha256 || embeddedNative.bytes !== appNativeSo.bytes) {
  throw new Error('HAP embedded NAPI does not match the Harmony app native input');
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
    buildEvidence,
  },
  napi: {
    packageManifest: napiPackage,
    nativeInput: nativeSo,
  },
  harmony: {
    git: harmonyGit,
    vendor: treeRecord(vendorRoot),
    nativeInput: appNativeSo,
    buildCommand: args.get('--build-command') ?? '<unspecified>',
    hvigorVersion: args.get('--hvigor-version') ?? '<unspecified>',
    sdkVersion: args.get('--sdk-version') ?? '<unspecified>',
  },
  hap: {
    ...fileRecord(hapPath),
    embeddedNative,
  },
  generator: {
    node: process.version,
    command: process.argv.join(' '),
  },
};

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({
  output: outputPath,
  acceptanceEligible: manifest.acceptanceEligible,
  buildId: coreIdentity.buildId,
  hapSha256: manifest.hap.sha256,
  nativeInputSha256: nativeSo.sha256,
  embeddedNativeSha256: manifest.hap.embeddedNative.sha256,
}));
