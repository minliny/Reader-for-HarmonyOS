import { BackupExtensionAbility, type BundleVersion } from '@kit.CoreFileKit';
import fileIo from '@ohos.file.fs';
import lazy { createReaderSystemMigrationArchive } from './ReaderSystemMigrationExport';
import { readerSystemMigrationIncludesOriginals } from '../app/ReaderSystemMigrationPreferences';
import { readSystemMigrationManifest, stageSystemMigration, systemMigrationPayload, systemMigrationPendingDirectory } from
  './ReaderSystemMigrationFiles';
import { READER_SYSTEM_MIGRATION_DIRECTORY, READER_SYSTEM_MIGRATION_EXPORT_WORK_DIRECTORY,
  READER_SYSTEM_MIGRATION_MANIFEST } from './ReaderSystemMigrationPolicy';

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
  private releaseTask: Promise<void> | undefined;

  async onBackupEx(_backupInfo: string): Promise<string> {
    if (this.backup !== undefined || this.releaseTask !== undefined) return migrationResult('READER_SYSTEM_MIGRATION_EXPORT_BUSY');
    const generation = ++this.generation;
    const backup = this.prepareBackup(generation);
    this.backup = backup;
    try {
      await backup;
      return this.generation === generation ? migrationResult() : migrationResult('READER_SYSTEM_MIGRATION_EXPORT_CANCELLED');
    } catch (_) {
      return this.generation === generation ? migrationResult('READER_SYSTEM_MIGRATION_EXPORT_FAILED') :
        migrationResult('READER_SYSTEM_MIGRATION_EXPORT_CANCELLED');
    } finally {
      if (this.backup === backup) this.backup = undefined;
    }
  }

  private async prepareBackup(generation: number): Promise<void> {
    const application = this.context.getApplicationContext();
    const includeOriginals = await readerSystemMigrationIncludesOriginals(application);
    if (this.generation !== generation) return;
    await createReaderSystemMigrationArchive(this.context, application.filesDir, includeOriginals,
      (): boolean => this.generation === generation);
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
    const generation = ++this.generation;
    if (scenario !== 1) return;
    const release = this.clearReleasedArchive(generation, this.backup ?? this.releaseTask);
    this.releaseTask = release;
    try { await release; }
    finally { if (this.releaseTask === release) this.releaseTask = undefined; }
  }

  private async clearReleasedArchive(generation: number, pending?: Promise<void>): Promise<void> {
    await pending?.catch((): void => {});
    if (generation !== this.generation) return;
    const work = `${this.context.filesDir}/${READER_SYSTEM_MIGRATION_EXPORT_WORK_DIRECTORY}`;
    try {
      if ((await fileIo.lstat(work)).isDirectory() && generation === this.generation) await fileIo.rmdir(work);
    } catch (_) {}
    if (generation !== this.generation) return;
    const directory = `${this.context.getApplicationContext().filesDir}/${READER_SYSTEM_MIGRATION_DIRECTORY}`;
    try { if (!(await fileIo.lstat(directory)).isDirectory()) return; }
    catch (_) { return; }
    let stages: string[] = [];
    try { stages = (await fileIo.listFile(directory)).filter((name: string): boolean => /^library-[a-zA-Z0-9-]{1,64}\.stage$/.test(name)); }
    catch (_) {}
    const paths = [`${directory}/${READER_SYSTEM_MIGRATION_MANIFEST}`, systemMigrationPayload(directory),
      ...stages.map((name: string): string => `${directory}/${name}`)];
    for (const path of paths) {
      if (generation !== this.generation) return;
      try { if ((await fileIo.lstat(path)).isFile() && generation === this.generation) await fileIo.unlink(path); } catch (_) {}
    }
  }
}
