import type { ReaderRuntimeOwner } from '../app/ReaderRuntimeOwner';
import { LocalRecoveryGateway } from '../features/bookshelf/application/LocalRecoveryGateway';
import {
  copySystemMigrationPayload, finishSystemMigration, readSystemMigrationManifest,
  systemMigrationPendingDirectory, systemMigrationPendingPayload,
} from './ReaderSystemMigrationFiles';

export type ReaderSystemMigrationStartupResult = 'none' | 'restored' | 'interrupted';

// Keep new replacements blocked even when an earlier startup recovery fails.
export async function readerSystemMigrationNeedsRecovery(applicationFilesDir: string): Promise<boolean> {
  try {
    return await readSystemMigrationManifest(systemMigrationPendingDirectory(applicationFilesDir)) !== undefined;
  } catch (_) {
    return true;
  }
}

/** Called after the app's storage admission, before publishing reading settings. */
export async function resumeReaderSystemMigration(applicationFilesDir: string, owner: ReaderRuntimeOwner,
  current: () => boolean): Promise<ReaderSystemMigrationStartupResult> {
  const directory = systemMigrationPendingDirectory(applicationFilesDir);
  try {
    const manifest = await readSystemMigrationManifest(directory);
    if (manifest === undefined) return 'none';
    if (!current()) return 'interrupted';
    const outcome = await new LocalRecoveryGateway(owner).restoreSystemStagedPackage(
      manifest.secret, manifest.packageSha256, async (dest: string): Promise<boolean> => {
        await copySystemMigrationPayload(systemMigrationPendingPayload(directory, manifest), dest, manifest, current);
        return current();
      }, current);
    if (outcome.state !== 'restored' || !current()) return 'interrupted';
    await finishSystemMigration(directory, manifest);
    return 'restored';
  } catch (_) { return 'interrupted'; }
}
