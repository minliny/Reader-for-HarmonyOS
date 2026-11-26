import { readerHostPreferencesName } from '../../../app/diagnostics/ReaderPublicFixtureScope';
import preferences from '@ohos.data.preferences';
import { ReaderRuntimeOwner } from '../../../app/ReaderRuntimeOwner';
import { ReaderWriteEvidence } from '../../../app/ReaderWriteEvidence';
import { ReaderThemeHost } from '../../../app/ReaderThemeHost';
import { ReaderNavigationAppearancePreferences } from '../../../app/ReaderNavigationAppearancePreferences';
import { ReaderControlPlacementPreferences } from '../../../app/ReaderControlPlacementPreferences';
import { ReaderSmartGesturePreferences } from '../../../app/ReaderSmartGesturePreferences';
import { SettingsGateway, createDefaultSettingsSnapshot } from './SettingsGateway';
import { ReaderSettingsGateway } from '../../reading/application/ReaderSettingsGateway';
import { createDefaultReaderSettingsSnapshot } from '../../reading/application/ReaderSettingsState';
import { ReaderTtsPreferencesGateway } from '../../reading/application/ReaderTtsPreferencesGateway';
import { createDefaultReaderTtsPreferencesSnapshot } from '../../reading/application/ReaderTtsPreferencesState';
import { BookshelfViewModeHost } from '../../bookshelf/application/BookshelfViewModeHost';

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
  private static evidence: WeakMap<ReaderRuntimeOwner, ReaderWriteEvidence> = new WeakMap();
  private static operationTail: Promise<void> = Promise.resolve();
  // A failed flush may leave a changed cached marker. Requalify the exact
  // accepted reset before replaying its idempotent writes in this process.
  private static unconfirmedIntents: Set<string> = new Set();

  static writeEvidence(owner: ReaderRuntimeOwner): ReaderWriteEvidence | undefined {
    return LocalConfigurationReset.evidence.get(owner);
  }

  static request(owner: ReaderRuntimeOwner): Promise<boolean> {
    const existing = LocalConfigurationReset.requests.get(owner);
    if (existing !== undefined) return existing;
    LocalConfigurationReset.evidence.set(owner, new ReaderWriteEvidence());
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
    if (LocalConfigurationReset.evidence.get(owner)?.confirmation() === 'confirmed') return true;
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
    const operation = LocalConfigurationReset.operationTail.then((): Promise<boolean> =>
      LocalConfigurationReset.apply(owner, requested));
    LocalConfigurationReset.operationTail = operation.then((): void => {}, (): void => {});
    LocalConfigurationReset.operations.set(owner, operation);
    void operation.finally((): void => {
      if (LocalConfigurationReset.operations.get(owner) === operation) LocalConfigurationReset.operations.delete(owner);
    }).catch((): void => {});
    return operation;
  }

  private static assertOwner(owner: ReaderRuntimeOwner): void {
    if (!ReaderRuntimeOwner.isCurrent(owner)) throw new Error('CONFIGURATION_OWNER_CHANGED');
  }

  private static async apply(owner: ReaderRuntimeOwner, requested: boolean): Promise<boolean> {
    LocalConfigurationReset.assertOwner(owner);
    const context = owner.getUIAbilityContext();
    const filesDir = context.filesDir;
    const store = await preferences.getPreferences(context, readerHostPreferencesName(filesDir, RESET_PREFERENCES));
    const pending = await store.get(RESET_INTENT_KEY, '');
    if (pending !== '' && pending !== RESET_INTENT) throw new Error('CONFIGURATION_RESET_INTENT_INVALID');
    const unconfirmed = LocalConfigurationReset.unconfirmedIntents.has(filesDir);
    if (pending === '' && !requested && !unconfirmed) return false;
    const evidence = LocalConfigurationReset.evidence.get(owner) ?? new ReaderWriteEvidence();
    LocalConfigurationReset.evidence.set(owner, evidence);
    LocalConfigurationReset.assertOwner(owner);
    if (evidence.dispatchedCount === 0) evidence.dispatched();
    if (pending === '' || unconfirmed) {
      LocalConfigurationReset.unconfirmedIntents.add(filesDir);
      await store.put(RESET_INTENT_KEY, RESET_INTENT);
      await store.flush();
      LocalConfigurationReset.unconfirmedIntents.delete(filesDir);
    }
    // Each operation uses the existing owner/serialized platform adapter.
    // No WebDAV credential, Core preference, book/source/position, imported
    // font file, reading-device identity or engine secret is removed.
    LocalConfigurationReset.assertOwner(owner);
    await new SettingsGateway(owner.getUIAbilityContext()).update(createDefaultSettingsSnapshot(), true, undefined, undefined,
      (): boolean => ReaderRuntimeOwner.isCurrent(owner));
    LocalConfigurationReset.assertOwner(owner);
    await new ReaderSettingsGateway(owner).update(createDefaultReaderSettingsSnapshot(), true);
    LocalConfigurationReset.assertOwner(owner);
    await new ReaderTtsPreferencesGateway(owner).update(createDefaultReaderTtsPreferencesSnapshot(), true);
    LocalConfigurationReset.assertOwner(owner);
    await BookshelfViewModeHost.instance.resetDefaults(owner);
    LocalConfigurationReset.assertOwner(owner);
    await ReaderThemeHost.resetAppearanceDefaults();
    LocalConfigurationReset.assertOwner(owner);
    await ReaderNavigationAppearancePreferences.resetDefaults((): boolean => ReaderRuntimeOwner.isCurrent(owner));
    LocalConfigurationReset.assertOwner(owner);
    await ReaderControlPlacementPreferences.resetDefaults();
    LocalConfigurationReset.assertOwner(owner);
    await ReaderSmartGesturePreferences.resetDefaults((): boolean => ReaderRuntimeOwner.isCurrent(owner));
    LocalConfigurationReset.assertOwner(owner);
    AppStorage.setOrCreate('readerBookshelfSelectedGroup', '');
    AppStorage.setOrCreate('readerBookshelfReadingFilter', 'all');
    AppStorage.setOrCreate('readerBookshelfSourceFilter', 'all');
    AppStorage.setOrCreate('readerBookshelfContentFilter', 'all');
    LocalConfigurationReset.unconfirmedIntents.add(filesDir);
    await store.delete(RESET_INTENT_KEY);
    await store.flush();
    LocalConfigurationReset.unconfirmedIntents.delete(filesDir);
    evidence.confirmed();
    return true;
  }
}
