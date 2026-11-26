export const READER_SYSTEM_MIGRATION_DIRECTORY = 'reader-system-migration-v1';
export const READER_SYSTEM_MIGRATION_EXPORT_WORK_DIRECTORY = 'reader-system-migration-export-work';
export const READER_SYSTEM_MIGRATION_PENDING_DIRECTORY = 'reader-system-migration-pending-v1';
export const READER_SYSTEM_MIGRATION_PAYLOAD = 'library.readerbackup';
export const READER_SYSTEM_MIGRATION_MANIFEST = 'manifest.json';
export const READER_SYSTEM_MIGRATION_MAX_BYTES = 512 * 1024 * 1024;

export interface ReaderSystemMigrationManifest {
  format: string;
  version: number;
  secret: string;
  packageSha256: string;
  packageBytes: number;
  includeOriginals: boolean;
}

export function readReaderSystemMigrationManifest(value: ReaderSystemMigrationManifest): ReaderSystemMigrationManifest {
  if (value === null || typeof value !== 'object' || Object.keys(value).length !== 6 ||
    value.format !== 'reader.system-migration' || value.version !== 1 ||
    !/^[0-9a-f]{64}$/.test(value.secret) || !/^[0-9a-f]{64}$/.test(value.packageSha256) ||
    !Number.isSafeInteger(value.packageBytes) || value.packageBytes <= 0 ||
    value.packageBytes > READER_SYSTEM_MIGRATION_MAX_BYTES || typeof value.includeOriginals !== 'boolean') {
    throw new Error('SYSTEM_MIGRATION_MANIFEST_INVALID');
  }
  return value;
}

export function sameReaderSystemMigration(left: ReaderSystemMigrationManifest, right: ReaderSystemMigrationManifest): boolean {
  return left.packageSha256 === right.packageSha256 && left.packageBytes === right.packageBytes &&
    left.secret === right.secret && left.includeOriginals === right.includeOriginals;
}
