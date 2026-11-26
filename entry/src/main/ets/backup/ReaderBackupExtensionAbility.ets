import { BackupExtensionAbility, type BundleVersion } from '@kit.CoreFileKit';
import fileIo from '@ohos.file.fs';
import lazy { createReaderSystemMigrationArchive } from './ReaderSystemMigrationExport';
import { readerSystemMigrationIncludesOriginals } from '../app/ReaderSystemMigrationPreferences';
import { readSystemMigrationManifest, stageSystemMigration, systemMigrationPayload, systemMigrationPendingDirectory } from
  './ReaderSystemMigrationFiles';
import { READER_SYSTEM_MIGRATION_DIRECTORY, READER_SYSTEM_MIGRATION_MANIFEST } from './ReaderSystemMigrationPolicy';

interface MigrationResult {
  type: string;
  errorCode: number;
  errorInfo: string;
}

function migrationResult(errorInfo: string = ''): string {
  const result: MigrationResult = { type: 'ErrorInfo', errorCode: errorInfo.length === 0 ? 0 : 1, errorInfo };
  return JSON.stringify(result);
}

export default class ReaderBackupExtensionAbility extends BackupExtensionAbility {
  private generation: number = 0;
  private backup: Promise<void> | undefined;

  async onBackupEx(_backupInfo: string): Promise<string> {
    if (this.backup !== undefined) return migrationResult('READER_SYSTEM_MIGRATION_EXPORT_BUSY');
    const generation = ++this.generation;
    try {
      const application = this.context.getApplicationContext();
      const includeOriginals = await readerSystemMigrationIncludesOriginals(application);
      if (this.generation !== generation) return migrationResult('READER_SYSTEM_MIGRATION_EXPORT_CANCELLED');
      const backup = createReaderSystemMigrationArchive(this.context, application.filesDir, includeOriginals,
        (): boolean => this.generation === generation);
      this.backup = backup;
      await backup;
      return migrationResult();
    } catch (_) { return migrationResult('READER_SYSTEM_MIGRATION_EXPORT_FAILED'); }
  }

  async onRestoreEx(_version: BundleVersion, _restoreInfo: string): Promise<string> {
    // fullBackupOnly directs the system restore to its private extraction tree.
    try {
      const application = this.context.getApplicationContext();
      const incoming = `${this.context.backupDir}/restore/data/storage/el2/base/files/${READER_SYSTEM_MIGRATION_DIRECTORY}`;
      if (await readSystemMigrationManifest(incoming) === undefined) {
        return await fileIo.access(systemMigrationPayload(incoming)) ?
          migrationResult('READER_SYSTEM_MIGRATION_MANIFEST_MISSING') : migrationResult();
      }
      await stageSystemMigration(incoming, systemMigrationPendingDirectory(application.filesDir));
      return migrationResult();
    } catch (_) { return migrationResult('READER_SYSTEM_MIGRATION_STAGING_FAILED'); }
  }

  async onRelease(scenario: number): Promise<void> {
    this.generation += 1;
    if (scenario !== 1 || this.backup === undefined) return;
    const released = this.generation;
    await this.backup.catch((): void => {});
    if (released !== this.generation) return;
    this.backup = undefined;
    const directory = `${this.context.getApplicationContext().filesDir}/${READER_SYSTEM_MIGRATION_DIRECTORY}`;
    for (const path of [`${directory}/${READER_SYSTEM_MIGRATION_MANIFEST}`, systemMigrationPayload(directory)]) {
      try { if (await fileIo.access(path)) await fileIo.unlink(path); } catch (_) {}
    }
  }
}
