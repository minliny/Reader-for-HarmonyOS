import { common } from '@kit.AbilityKit';
import preferences from '@ohos.data.preferences';

const NAME = 'reader_system_migration_v1';
const KEY = 'include_originals';

export async function readerSystemMigrationIncludesOriginals(context: common.Context): Promise<boolean> {
  const store = await preferences.getPreferences(context, NAME);
  return (await store.get(KEY, false)) === true;
}

export async function setReaderSystemMigrationIncludesOriginals(context: common.Context, included: boolean): Promise<void> {
  const store = await preferences.getPreferences(context, NAME);
  await store.put(KEY, included);
  await store.flush();
  if ((await store.get(KEY, false)) !== included) throw new Error('SYSTEM_MIGRATION_PREFERENCE_UNCONFIRMED');
  AppStorage.setOrCreate('readerSystemMigrationOriginals', included);
}
