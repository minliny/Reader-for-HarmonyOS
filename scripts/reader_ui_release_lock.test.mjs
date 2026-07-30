import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  assertReaderUiReleaseBumpPaths,
  assertReaderUiPackageLockVersionUpdate,
  assertReaderUiReleaseLocksSynchronized,
  READER_UI_CONSUMER_LOCK_PATH,
  READER_UI_PACKAGE_LOCK_PATH,
  READER_UI_RELEASE_BUMP_PATHS,
  updateReaderUiRuntimePackageVersion,
} from './reader_ui_release_lock_lib.mjs';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const consumer = JSON.parse(fs.readFileSync(path.join(repo, READER_UI_CONSUMER_LOCK_PATH), 'utf8'));
const packageLock = JSON.parse(fs.readFileSync(path.join(repo, READER_UI_PACKAGE_LOCK_PATH), 'utf8'));

test('current Reader UI consumer and HarmonyOS package locks have one version authority', () => {
  const version = assertReaderUiReleaseLocksSynchronized(consumer, packageLock);
  assert.equal(version, consumer.readerUiVersion);
  assert.match(version, /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)/);
});

test('future package bump changes only reader_ui_runtime.version', () => {
  const updated = updateReaderUiRuntimePackageVersion(packageLock, '3.0.0');
  assertReaderUiPackageLockVersionUpdate(packageLock, updated, '3.0.0');
  assert.equal(updated.packages[
    'reader_ui_runtime@../../Reader-UI/packages/arkts/reader-ui-runtime'
  ].version, '3.0.0');
  const tampered = structuredClone(updated);
  tampered.lockfileVersion = 4;
  assert.throws(
    () => assertReaderUiPackageLockVersionUpdate(packageLock, tampered, '3.0.0'),
    /may only set reader_ui_runtime\.version/,
  );
});

test('package lock updater consumes an already verified consumer identity atomically', () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'reader-ui-harmony-lock-'));
  try {
    const nextConsumer = structuredClone(consumer);
    nextConsumer.schemaVersion = 3;
    nextConsumer.readerUiVersion = '3.0.0';
    nextConsumer.runtimePayloadContractsSchemaVersion = 4;
    nextConsumer.runtimePayloadContractsSha256 = 'd'.repeat(64);
    nextConsumer.releaseIdentity = {
      releaseId: `${'a'.repeat(40)}:${'b'.repeat(64)}`,
      sourceSha: 'a'.repeat(40),
      manifestSha256: 'b'.repeat(64),
      targetConfigSha256: 'c'.repeat(64),
    };
    const verified = {
      schemaVersion: 2,
      host: 'harmonyos',
      hostRepository: 'minliny/Reader-for-HarmonyOS',
      readerUiVersion: '3.0.0',
      tag: 'v3.0.0',
      sourceSha: 'a'.repeat(40),
      manifestSha256: 'b'.repeat(64),
      targetConfigSha256: 'c'.repeat(64),
      runtimeActionsSha256: nextConsumer.runtimeActionsSha256,
      runtimeActionsSchemaVersion: nextConsumer.runtimeActionsSchemaVersion,
      runtimePayloadContractsSchemaVersion: nextConsumer.runtimePayloadContractsSchemaVersion,
      runtimePayloadContractsSha256: nextConsumer.runtimePayloadContractsSha256,
      hostRequestSchemaVersion: nextConsumer.hostRequestSchemaVersion,
      releaseId: nextConsumer.releaseIdentity.releaseId,
    };
    const consumerPath = path.join(temporary, 'READER_UI_CONSUMER.json');
    const packagePath = path.join(temporary, 'oh-package-lock.json5');
    const verifiedPath = path.join(temporary, 'verified.json');
    fs.writeFileSync(consumerPath, `${JSON.stringify(nextConsumer, null, 2)}\n`);
    fs.writeFileSync(packagePath, `${JSON.stringify(packageLock, null, 2)}\n`);
    fs.writeFileSync(verifiedPath, `${JSON.stringify(verified, null, 2)}\n`);
    const result = spawnSync(process.execPath, [
      path.join(repo, 'scripts/update_reader_ui_package_lock.mjs'),
      '--consumer-lock', consumerPath,
      '--package-lock', packagePath,
      '--verified-release', verifiedPath,
    ], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.deepEqual(JSON.parse(fs.readFileSync(consumerPath, 'utf8')), nextConsumer,
      'package updater must not rewrite the consumer lock');
    const updated = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    assertReaderUiPackageLockVersionUpdate(packageLock, updated, '3.0.0');
    assertReaderUiReleaseLocksSynchronized(nextConsumer, updated);
    assert.deepEqual(fs.readdirSync(temporary).sort(), [
      'READER_UI_CONSUMER.json',
      'oh-package-lock.json5',
      'verified.json',
    ], 'atomic updater must not leave temporary files');
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
});

test('release bump scope permits only a non-empty subset of the two lock files', () => {
  assert.deepEqual(READER_UI_RELEASE_BUMP_PATHS, [
    READER_UI_CONSUMER_LOCK_PATH,
    READER_UI_PACKAGE_LOCK_PATH,
  ]);
  assert.doesNotThrow(() => assertReaderUiReleaseBumpPaths([
    READER_UI_PACKAGE_LOCK_PATH,
    READER_UI_CONSUMER_LOCK_PATH,
  ]));
  assert.doesNotThrow(() => assertReaderUiReleaseBumpPaths([READER_UI_CONSUMER_LOCK_PATH]));
  assert.doesNotThrow(() => assertReaderUiReleaseBumpPaths([READER_UI_PACKAGE_LOCK_PATH]));
  assert.throws(() => assertReaderUiReleaseBumpPaths([]), /must change at least one/);
  assert.doesNotThrow(() => assertReaderUiReleaseBumpPaths([], 'idempotent release', {
    allowEmpty: true,
  }));
  assert.throws(
    () => assertReaderUiReleaseBumpPaths([
      READER_UI_CONSUMER_LOCK_PATH,
      READER_UI_PACKAGE_LOCK_PATH,
      'entry/oh-package.json5',
    ]),
    /may contain only/,
  );
  assert.throws(
    () => assertReaderUiReleaseBumpPaths([
      READER_UI_CONSUMER_LOCK_PATH,
      READER_UI_CONSUMER_LOCK_PATH,
    ]),
    /must be unique/,
  );
});

test('workflow binds typed payload identity and publishes only the allowed lock subset', () => {
  const workflow = fs.readFileSync(
    path.join(repo, '.github/workflows/reader-ui-consumer.yml'),
    'utf8',
  );
  assert.match(workflow, /update_reader_ui_package_lock\.mjs/);
  assert.match(workflow, /assertReaderUiReleaseBumpPaths/);
  assert.match(workflow, /assertReaderUiPackageLockVersionUpdate/);
  assert.match(workflow, /runtimePayloadContractsSchemaVersion/);
  assert.match(workflow, /runtimePayloadContractsSha256/);
  assert.match(workflow, /after\.schemaVersion !== 3/);
  assert.match(workflow, /allowEmpty: true/);
  assert.doesNotMatch(workflow, /lock v2 contract/);
  assert.match(workflow, /Reader-for-HarmonyOS\/scripts\/publish-host-bump-pr\.mjs/);
  assert.doesNotMatch(workflow, /Reader-UI\/tools\/release\/publish-host-bump-pr\.mjs/);
  const publisher = fs.readFileSync(path.join(repo, 'scripts/publish-host-bump-pr.mjs'), 'utf8');
  assert.ok([...publisher.matchAll(/assertReaderUiReleaseBumpPaths/g)].length >= 4,
    'publisher must protect working, status, existing-commit, and staged scopes');
  assert.match(publisher, /\['add', '--', \.\.\.READER_UI_RELEASE_BUMP_PATHS\]/);
  assert.doesNotMatch(publisher, /git[^\n]+add[^\n]+READER_UI_CONSUMER\.json/,
    'publisher must not fall back to staging only the consumer lock');
});
