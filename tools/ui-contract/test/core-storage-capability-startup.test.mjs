import assert from 'node:assert/strict';
import { test } from 'node:test';
import { selectedProductionMethods } from '../../lib/selected-production-methods.mjs';

const production = new URL('../../../entry/src/main/ets/app/ReaderRuntimeOwner.ts', import.meta.url);
const StorageDecoder = selectedProductionMethods(production, 'ReaderRuntimeOwner',
  ['requireCoreStorageFormat', 'requireCoreStorageCapabilities']);
const owner = new StorageDecoder();

function storageFormat(format, completeCoverage = format === 'library47') {
  const physical = format === 'library47';
  return {
    format,
    portableSnapshotSupported: true,
    capabilities: {
      logicalExport: true,
      logicalRestore: true,
      legacyHostImport: true,
      physicalBackup: physical,
      physicalRestore: physical,
      webdavConfigRestore: true,
      activeLibrarySync: false,
      logicalExportRequiresDataPreflight: true,
      logicalRestoreRequiresCompleteCoverage: completeCoverage,
      resourceEvidenceOnly: true,
      externalFilesIncluded: false,
    },
  };
}

test('startup admits the Core legacy layout capability matrix and keeps its original coverage fact', () => {
  for (const completeCoverage of [false, true]) {
    const legacy = storageFormat('legacy', completeCoverage);
    assert.deepEqual(owner.requireCoreStorageFormat(legacy), legacy);
  }
  const library47 = storageFormat('library47');
  assert.deepEqual(owner.requireCoreStorageFormat(library47), library47);
  assert.deepEqual(owner.requireCoreStorageFormat({ format: 'legacy', portableSnapshotSupported: true }),
    { format: 'legacy', portableSnapshotSupported: true });
});

test('startup rejects contradictory, unknown or non-boolean storage declarations', () => {
  const invalidPhysical = storageFormat('legacy');
  invalidPhysical.capabilities.physicalRestore = true;
  const invalidCoverage = storageFormat('legacy');
  invalidCoverage.capabilities.logicalRestoreRequiresCompleteCoverage = 'false';
  const invalidSync = storageFormat('legacy');
  invalidSync.capabilities.activeLibrarySync = true;
  const invalidPortability = { ...storageFormat('legacy'), portableSnapshotSupported: false };
  for (const invalid of [storageFormat('library47', false), invalidPhysical, invalidCoverage, invalidSync,
    invalidPortability, { ...storageFormat('legacy'), unknownFact: true }]) {
    assert.throws(() => owner.requireCoreStorageFormat(invalid), /invalid storage format capability/);
  }
});
