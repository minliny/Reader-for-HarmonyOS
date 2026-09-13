import preferences from '@ohos.data.preferences';
import { ReaderRuntimeOwner } from '../../app/ReaderRuntimeOwner';
import { ReaderThemeHost } from '../../app/ReaderThemeHost';
import { SettingsGateway, createDefaultSettingsSnapshot } from './SettingsGateway';
import { ReaderSettingsGateway } from '../reading/ReaderSettingsGateway';
import { createDefaultReaderSettingsSnapshot } from '../reading/ReaderSettingsState';
import { ReaderTtsPreferencesGateway } from '../reading/ReaderTtsPreferencesGateway';
import { createDefaultReaderTtsPreferencesSnapshot } from '../reading/ReaderTtsPreferencesState';
import { WebDavCredentialStore } from '../sync/WebDavCredentialStore';

const RESET_PREFERENCES = 'reader_configuration_reset_v1';
const RESET_INTENT_KEY = 'pending';
const RESET_INTENT = 'interface-and-reading-settings-v1';

/** User-approved, non-destructive configuration reset. The durable intent is
 * recorded before touching any setting, and removed only after all writes
 * acknowledge. Startup and later user intents resume the same forward-only
 * operation; no clock-based overwrite or user-data storage.clear is involved. */
export class LocalConfigurationReset {
  private static operations: Map<ReaderRuntimeOwner, Promise<boolean>> = new Map();
  private static requests: Map<ReaderRuntimeOwner, Promise<boolean>> = new Map();

  static request(owner: ReaderRuntimeOwner): Promise<boolean> {
    const existing = LocalConfigurationReset.requests.get(owner);
    if (existing !== undefined) return existing;
    const requested = LocalConfigurationReset.prepareAndRequest(owner);
    LocalConfigurationReset.requests.set(owner, requested);
    void requested.finally((): void => {
      if (LocalConfigurationReset.requests.get(owner) === requested) LocalConfigurationReset.requests.delete(owner);
    }).catch((): void => {});
    return requested;
  }

  private static async prepareAndRequest(owner: ReaderRuntimeOwner): Promise<boolean> {
    // Enter before registering our own operation, otherwise the central
    // recovery callback would join this operation and await itself.
    await ReaderThemeHost.prepareUserChange();
    return LocalConfigurationReset.runShared(owner, true);
  }

  static recover(owner: ReaderRuntimeOwner): Promise<boolean> {
    return LocalConfigurationReset.runShared(owner, false);
  }

  private static runShared(owner: ReaderRuntimeOwner, requested: boolean): Promise<boolean> {
    const active = LocalConfigurationReset.operations.get(owner);
    if (active !== undefined) {
      if (!requested) return active;
      // A concurrent startup probe can complete without finding an intent.
      // Its false result must not swallow this explicit user request.
      return active.then((applied: boolean): boolean | Promise<boolean> =>
        applied ? true : LocalConfigurationReset.runShared(owner, true));
    }
    const operation = LocalConfigurationReset.apply(owner, requested);
    LocalConfigurationReset.operations.set(owner, operation);
    void operation.finally((): void => {
      if (LocalConfigurationReset.operations.get(owner) === operation) LocalConfigurationReset.operations.delete(owner);
    }).catch((): void => {});
    return operation;
  }

  private static assertOwner(owner: ReaderRuntimeOwner): void {
    if (ReaderRuntimeOwner.current() !== owner) throw new Error('CONFIGURATION_OWNER_CHANGED');
  }

  private static async apply(owner: ReaderRuntimeOwner, requested: boolean): Promise<boolean> {
    LocalConfigurationReset.assertOwner(owner);
    const store = await preferences.getPreferences(owner.getUIAbilityContext(), RESET_PREFERENCES);
    const pending = await store.get(RESET_INTENT_KEY, '');
    if (pending !== '' && pending !== RESET_INTENT) throw new Error('CONFIGURATION_RESET_INTENT_INVALID');
    if (pending === '' && !requested) return false;
    LocalConfigurationReset.assertOwner(owner);
    if (pending === '') {
      await store.put(RESET_INTENT_KEY, RESET_INTENT);
      try { await store.flush(); }
      catch (error) { await store.delete(RESET_INTENT_KEY); throw error; }
    }
    // Each operation uses the existing owner/serialized platform adapter.
    // No WebDAV credential, Core preference, book/source/position, imported
    // font file, reading-device identity or engine secret is removed.
    LocalConfigurationReset.assertOwner(owner);
    await new SettingsGateway(owner.getUIAbilityContext()).update(createDefaultSettingsSnapshot(), true);
    LocalConfigurationReset.assertOwner(owner);
    await new ReaderSettingsGateway(owner).update(createDefaultReaderSettingsSnapshot(), true);
    LocalConfigurationReset.assertOwner(owner);
    await new ReaderTtsPreferencesGateway(owner).update(createDefaultReaderTtsPreferencesSnapshot(), true);
    LocalConfigurationReset.assertOwner(owner);
    await WebDavCredentialStore.instance.saveBookshelfViewMode('cover');
    LocalConfigurationReset.assertOwner(owner);
    await ReaderThemeHost.resetAppearanceDefaults();
    LocalConfigurationReset.assertOwner(owner);
    AppStorage.setOrCreate('readerBookshelfViewMode', 'cover');
    AppStorage.setOrCreate('readerBookshelfSelectedGroup', '');
    await store.delete(RESET_INTENT_KEY);
    try { await store.flush(); }
    catch (error) { await store.put(RESET_INTENT_KEY, RESET_INTENT); throw error; }
    return true;
  }
}
