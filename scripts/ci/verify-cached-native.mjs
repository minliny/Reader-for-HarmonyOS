#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { lstatSync, readdirSync, readFileSync } from 'node:fs';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

const REQUIRED_FILES = [
  'core-build-identity.json',
  'core-input-snapshot.json',
  'harmony-package-manifest.sha256',
  'harmony-napi-build-evidence.txt',
];
const ALLOWED_TOP_LEVEL = new Set([...REQUIRED_FILES, 'package']);

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function assertRegularFile(path, label) {
  const stat = lstatSync(path, { throwIfNoEntry: false });
  if (!stat) throw new Error(`Cached Core Native ${label} is missing: ${path}`);
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new Error(`Cached Core Native ${label} must be a regular file: ${path}`);
  }
  return stat;
}

function readRegular(path, label, encoding) {
  assertRegularFile(path, label);
  return readFileSync(path, encoding);
}

function fileRecord(path, label) {
  const bytes = readRegular(path, label);
  return { bytes: bytes.length, sha256: sha256(bytes) };
}

function walkRegularFiles(rootDir) {
  const rootStat = lstatSync(rootDir, { throwIfNoEntry: false });
  if (!rootStat || !rootStat.isDirectory() || rootStat.isSymbolicLink()) {
    throw new Error(`Cached Core Native directory must be a real directory: ${rootDir}`);
  }
  const files = [];
  const visit = (directory) => {
    for (const name of readdirSync(directory).sort()) {
      const entry = join(directory, name);
      const stat = lstatSync(entry);
      if (stat.isSymbolicLink()) {
        throw new Error(`Cached Core Native directory must not contain symbolic links: ${entry}`);
      }
      if (stat.isDirectory()) {
        visit(entry);
      } else if (stat.isFile()) {
        files.push(entry);
      } else {
        throw new Error(`Cached Core Native directory must contain only regular files and directories: ${entry}`);
      }
    }
  };
  visit(rootDir);
  return files;
}

function parsePackageManifest(path) {
  const content = readRegular(path, 'package manifest', 'utf8').trim();
  if (!content) throw new Error('Cached Core Native package manifest is empty');
  const entries = content.split('\n').map((line) => {
    const match = line.match(/^([0-9a-f]{64})  ([0-9]+)  (.+)$/);
    if (!match) throw new Error(`Invalid cached Core Native package manifest line: ${line}`);
    const entryPath = match[3];
    if (!entryPath || isAbsolute(entryPath) || entryPath.split('/').includes('..') || entryPath.startsWith('/')) {
      throw new Error(`Unsafe package manifest path: ${entryPath}`);
    }
    return { sha256: match[1], bytes: Number.parseInt(match[2], 10), path: entryPath };
  });
  return entries;
}

function parseBuildEvidence(path) {
  const content = readRegular(path, 'build evidence', 'utf8').trim();
  if (!content) throw new Error('Cached Core Native build evidence is empty');
  const values = Object.create(null);
  for (const line of content.split('\n')) {
    const separator = line.indexOf('=');
    if (separator <= 0) throw new Error(`Invalid cached Core Native build evidence line: ${line}`);
    values[line.slice(0, separator)] = line.slice(separator + 1);
  }
  return values;
}

export async function verifyCachedNativePackage({ cacheDir, lockPath, abi, rustTarget, coreRepo }) {
  if (!cacheDir) throw new Error('Provide cacheDir');
  if (!lockPath) throw new Error('Provide lockPath');
  if (!abi) throw new Error('Provide abi');
  if (!rustTarget) throw new Error('Provide rustTarget');

  const resolvedCache = resolve(cacheDir);
  walkRegularFiles(resolvedCache);

  const topEntries = readdirSync(resolvedCache).sort();
  for (const required of REQUIRED_FILES) {
    if (!topEntries.includes(required)) {
      throw new Error(`Cached Core Native directory is missing required file: ${required}`);
    }
    assertRegularFile(join(resolvedCache, required), required);
  }
  if (!topEntries.includes('package')) {
    throw new Error('Cached Core Native directory is missing package directory');
  }
  const packageStat = lstatSync(join(resolvedCache, 'package'));
  if (!packageStat.isDirectory() || packageStat.isSymbolicLink()) {
    throw new Error('Cached Core Native package entry must be a real directory');
  }
  for (const entry of topEntries) {
    if (!ALLOWED_TOP_LEVEL.has(entry)) {
      throw new Error(`Unexpected entry in cached Core Native directory: ${entry}`);
    }
  }

  const dependency = JSON.parse(readRegular(resolve(lockPath), 'core-dependency lock', 'utf8'));
  const identityPath = join(resolvedCache, 'core-build-identity.json');
  const snapshotPath = join(resolvedCache, 'core-input-snapshot.json');
  const manifestPath = join(resolvedCache, 'harmony-package-manifest.sha256');
  const evidencePath = join(resolvedCache, 'harmony-napi-build-evidence.txt');
  const packageRoot = join(resolvedCache, 'package');

  const identity = JSON.parse(readRegular(identityPath, 'core-build-identity.json', 'utf8'));
  if (identity?.schemaVersion !== 1 || identity.gitDirty !== false || identity.rustProfile !== 'release') {
    throw new Error('Cached Core build identity has invalid schema, dirty state, or non-release profile');
  }
  if (identity.gitCommit !== dependency.coreCommit) {
    throw new Error(`Cached Core build identity commit ${identity.gitCommit} does not match locked ${dependency.coreCommit}`);
  }

  const snapshot = JSON.parse(readRegular(snapshotPath, 'core-input-snapshot.json', 'utf8'));
  if (snapshot?.schemaVersion !== 1 || !Array.isArray(snapshot.files)) {
    throw new Error('Cached Core input snapshot has invalid schema');
  }
  if (snapshot.fingerprint !== dependency.coreInputFingerprint) {
    throw new Error(
      `Cached Core input fingerprint ${snapshot.fingerprint} does not match locked ${dependency.coreInputFingerprint}`,
    );
  }
  if (coreRepo) {
    const snapshotModule = await import(pathToFileURL(resolve(coreRepo, 'scripts/build-input-snapshot.mjs')).href);
    snapshotModule.verifyCoreBuildSnapshot(resolve(coreRepo), snapshot);
  }

  const manifestEntries = parsePackageManifest(manifestPath);
  const actualPackageFiles = walkRegularFiles(packageRoot).map((file) => relative(packageRoot, file).split(sep).join('/'));
  const expectedSet = new Set(manifestEntries.map((entry) => entry.path));
  if (expectedSet.size !== manifestEntries.length) {
    throw new Error('Cached Core Native package manifest contains duplicate paths');
  }
  if (actualPackageFiles.length !== expectedSet.size || actualPackageFiles.some((path) => !expectedSet.has(path))) {
    throw new Error('Cached Core Native package files do not match package manifest');
  }
  for (const entry of manifestEntries) {
    const actual = fileRecord(join(packageRoot, entry.path), `package/${entry.path}`);
    if (actual.bytes !== entry.bytes || actual.sha256 !== entry.sha256) {
      throw new Error(`Cached Core Native package file mismatch for ${entry.path}`);
    }
  }

  const evidence = parseBuildEvidence(evidencePath);
  if (evidence.ohos_arch !== abi) {
    throw new Error(`Cached Core Native arch ${evidence.ohos_arch} does not match ${abi}`);
  }
  if (evidence.target !== rustTarget) {
    throw new Error(`Cached Core Native target ${evidence.target} does not match ${rustTarget}`);
  }
  if (evidence.rust_profile !== 'release') {
    throw new Error(`Cached Core Native rust_profile ${evidence.rust_profile} must be release`);
  }

  const identityRecord = fileRecord(identityPath, 'core-build-identity.json');
  const snapshotRecord = fileRecord(snapshotPath, 'core-input-snapshot.json');
  const manifestRecord = fileRecord(manifestPath, 'harmony-package-manifest.sha256');
  const nativeSoRel = `libs/${abi}/libreader_core_napi.so`;
  const nativeSoRecord = fileRecord(join(packageRoot, nativeSoRel), nativeSoRel);
  const storageContractRecord = fileRecord(join(packageRoot, 'storage-contract.v1.json'), 'storage-contract.v1.json');

  const checks = [
    ['core_build_identity_sha256', identityRecord.sha256],
    ['core_input_snapshot_sha256', snapshotRecord.sha256],
    ['package_manifest_sha256', manifestRecord.sha256],
    ['artifact_sha256', nativeSoRecord.sha256],
    ['artifact_bytes', String(nativeSoRecord.bytes)],
    ['storage_contract_sha256', storageContractRecord.sha256],
  ];
  for (const [key, expected] of checks) {
    if (evidence[key] !== expected) {
      throw new Error(`Cached Core Native build evidence ${key} mismatch: ${evidence[key]} !== ${expected}`);
    }
  }

  return {
    coreCommit: identity.gitCommit,
    coreInputFingerprint: snapshot.fingerprint,
    nativeSha256: nativeSoRecord.sha256,
    nativeBytes: nativeSoRecord.bytes,
    packageFileCount: manifestEntries.length,
  };
}

async function main() {
  const { values } = parseArgs({
    options: {
      'cache-dir': { type: 'string' },
      lock: { type: 'string' },
      abi: { type: 'string' },
      'rust-target': { type: 'string' },
      'core-repo': { type: 'string' },
      help: { type: 'boolean' },
    },
    allowPositionals: false,
  });
  if (values.help) {
    console.log('Usage: node scripts/ci/verify-cached-native.mjs --cache-dir <dir> --lock <core-dependency.json> --abi <abi> --rust-target <triple> [--core-repo <dir>]');
    return;
  }
  const result = await verifyCachedNativePackage({
    cacheDir: values['cache-dir'],
    lockPath: values.lock,
    abi: values.abi,
    rustTarget: values['rust-target'],
    coreRepo: values['core-repo'],
  });
  console.log(JSON.stringify({ status: 'PASS', ...result }));
}

const isEntry = process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname);
if (isEntry) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
