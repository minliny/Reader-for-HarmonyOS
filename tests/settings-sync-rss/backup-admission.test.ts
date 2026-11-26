import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  READER_SYSTEM_MIGRATION_MAX_BYTES,
  readReaderSystemMigrationManifest,
  sameReaderSystemMigration,
  type ReaderSystemMigrationManifest,
} from '../../entry/src/main/ets/backup/ReaderSystemMigrationPolicy.ts';
import type { LocalRecoveryArchiveProof } from
  '../../entry/src/main/ets/features/bookshelf/application/LocalRecoveryGateway.ts';
import { webDavReplacementAdmission } from
  '../../entry/src/main/ets/features/sync/application/WebDavLibraryBackupPolicy.ts';

const manifest: ReaderSystemMigrationManifest = {
  format: 'reader.system-migration',
  version: 1,
  secret: 'a'.repeat(64),
  packageSha256: 'b'.repeat(64),
  packageBytes: READER_SYSTEM_MIGRATION_MAX_BYTES,
  includeOriginals: false,
};

test('system migration admits only the exact supported manifest and byte limit', () => {
  assert.deepEqual(readReaderSystemMigrationManifest({ ...manifest }), manifest);
  const invalidManifests = [
    { ...manifest, version: 2 },
    { ...manifest, secret: '../unexpected' },
    { ...manifest, packageSha256: 'c'.repeat(63) },
    { ...manifest, packageBytes: 0 },
    { ...manifest, packageBytes: READER_SYSTEM_MIGRATION_MAX_BYTES + 1 },
    { ...manifest, packageBytes: 1.5 },
    { ...manifest, sourcePath: '/unexpected' },
  ];
  for (const invalid of invalidManifests) {
    assert.throws(() => readReaderSystemMigrationManifest(invalid), /SYSTEM_MIGRATION_MANIFEST_INVALID/);
  }
});

test('system migration retries only the exact same staged archive', () => {
  assert.equal(sameReaderSystemMigration(manifest, { ...manifest }), true);
  for (const changed of [
    { ...manifest, secret: 'c'.repeat(64) },
    { ...manifest, packageSha256: 'c'.repeat(64) },
    { ...manifest, packageBytes: manifest.packageBytes - 1 },
    { ...manifest, includeOriginals: true },
  ]) {
    assert.equal(sameReaderSystemMigration(manifest, changed), false);
  }
});

test('WebDAV retirement requires authenticated same-library chronology and retained originals', () => {
  const original: LocalRecoveryArchiveProof = {
    libraryId: 'a'.repeat(32), createdAt: 100, includedOriginals: ['b'.repeat(64), 'c'.repeat(64)],
  };
  const newer: LocalRecoveryArchiveProof = { ...original, createdAt: 200 };
  assert.deepEqual(webDavReplacementAdmission(original, newer), {
    state: 'admitted', libraryId: original.libraryId, createdAt: newer.createdAt,
  });
  for (const unverified of [
    { ...newer, libraryId: 'd'.repeat(32) },
    { ...newer, libraryId: undefined },
    { ...newer, createdAt: undefined },
    { ...newer, createdAt: 99 },
    { ...newer, createdAt: 100 },
    { ...newer, createdAt: Number.NaN },
  ]) {
    assert.deepEqual(webDavReplacementAdmission(original, unverified), { state: 'replacementUnverified' });
  }
  assert.deepEqual(webDavReplacementAdmission({ ...original, libraryId: undefined }, newer), {
    state: 'replacementUnverified',
  });
  assert.deepEqual(webDavReplacementAdmission(original, { ...newer, includedOriginals: ['c'.repeat(64)] }), {
    state: 'replacementMissingOriginals',
  });
});
