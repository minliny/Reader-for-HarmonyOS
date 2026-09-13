import type { JsonObject } from '@reader/core-harmony';
import { ReaderThemeHost } from '../../app/ReaderThemeHost';
import { migrateLegacyReaderThemeSelection, restoreReaderThemeSelection,
  type ReaderThemeSelectionBackup } from '../common/ReaderThemeSelection';
import { WebDavCredentialStore } from './WebDavCredentialStore';

export interface SyncHostConfiguration {
  version: number;
  bookshelfViewMode: 'cover' | 'list';
  themeSelection: ReaderThemeSelectionBackup;
}

/** Only named non-secret choices cross the backup boundary. No RGB, recipes,
 * access tokens, device observation, or second persistent authority. */
export class SyncHostConfigurationGateway {
  async capture(): Promise<SyncHostConfiguration> {
    return { version: 1, bookshelfViewMode: await WebDavCredentialStore.instance.loadBookshelfViewMode(),
      themeSelection: await ReaderThemeHost.durableBackup() };
  }

  encode(value: SyncHostConfiguration): JsonObject {
    return { version: 1, bookshelfViewMode: value.bookshelfViewMode, themeSelection: {
      version: 1, appMode: value.themeSelection.appMode,
      reader: { id: value.themeSelection.reader.id, scheme: value.themeSelection.reader.scheme },
      defaultDayReaderId: value.themeSelection.defaultDayReaderId,
      defaultNightReaderId: value.themeSelection.defaultNightReaderId,
    } };
  }

  decode(value: JsonObject): SyncHostConfiguration {
    let theme = value['themeSelection'] as JsonObject;
    if (theme !== undefined && theme['appThemeMode'] !== undefined && theme['version'] === undefined) {
      if (Object.keys(theme).some((key: string): boolean =>
        !['appThemeMode', 'readerThemeId', 'defaultDayReaderThemeId', 'defaultNightReaderThemeId'].includes(key))) {
        throw new Error('备份的旧主题配置包含未知字段');
      }
      const system = AppStorage.get<string>('readerSystemScheme');
      const current = AppStorage.get<string>('readerAppScheme');
      const migrated = migrateLegacyReaderThemeSelection({
        appThemeMode: theme['appThemeMode'] as 'day' | 'night' | 'system',
        readerThemeId: theme['readerThemeId'] as string,
        defaultDayReaderThemeId: theme['defaultDayReaderThemeId'] as string,
        defaultNightReaderThemeId: theme['defaultNightReaderThemeId'] as string,
      }, system === 'day' || system === 'night' ? system : undefined,
      current === 'day' || current === 'night' ? current : undefined);
      const canonical = migrated.backup;
      theme = { version: canonical.version, appMode: canonical.appMode,
        reader: { id: canonical.reader.id, scheme: canonical.reader.scheme },
        defaultDayReaderId: canonical.defaultDayReaderId, defaultNightReaderId: canonical.defaultNightReaderId };
      if (migrated.fallbackReason.length > 0) AppStorage.setOrCreate('readerThemeRestoreFallback', migrated.fallbackReason);
    }
    const reader = theme?.['reader'] as JsonObject;
    if (value['version'] !== 1 || (value['bookshelfViewMode'] !== 'list' && value['bookshelfViewMode'] !== 'cover') ||
      theme?.['version'] !== 1 || !['day', 'night', 'system'].includes(theme?.['appMode'] as string) ||
      !['day', 'night'].includes(reader?.['scheme'] as string)) throw new Error('备份的本机配置无效');
    for (const id of [reader['id'], theme['defaultDayReaderId'], theme['defaultNightReaderId']]) {
      if (typeof id !== 'string' || id.length === 0 || id.length > 128 || /[\u0000-\u001f\u007f]/.test(id)) {
        throw new Error('备份的主题选择无效');
      }
    }
    const decoded: SyncHostConfiguration = { version: 1, bookshelfViewMode: value['bookshelfViewMode'] as 'cover' | 'list', themeSelection: {
      version: 1, appMode: theme['appMode'] as 'day' | 'night' | 'system',
      reader: { id: reader['id'] as string, scheme: reader['scheme'] as 'day' | 'night' },
      defaultDayReaderId: theme['defaultDayReaderId'] as string,
      defaultNightReaderId: theme['defaultNightReaderId'] as string,
    } };
    // Validate against the shared catalog before any Core apply can commit a
    // receipt. Unknown IDs keep the supported default fallback; forged schemes fail.
    restoreReaderThemeSelection(decoded.themeSelection, 'day');
    return decoded;
  }

  /** Called only after Core's manual conflict resolution. A failed second
   * store write restores the confirmed first value; it cannot report success. */
  async apply(value: SyncHostConfiguration, restoreOperationId?: string): Promise<string> {
    const previous = await this.capture();
    try {
      await WebDavCredentialStore.instance.saveBookshelfViewMode(value.bookshelfViewMode, restoreOperationId);
      const fallback = await ReaderThemeHost.restore(value.themeSelection);
      AppStorage.setOrCreate('readerBookshelfViewMode', value.bookshelfViewMode);
      return fallback;
    } catch (_) {
      try {
        await WebDavCredentialStore.instance.saveBookshelfViewMode(previous.bookshelfViewMode, restoreOperationId);
        await ReaderThemeHost.restore(previous.themeSelection);
        AppStorage.setOrCreate('readerBookshelfViewMode', previous.bookshelfViewMode);
      } catch (_) { throw new Error('本机配置恢复未完成，回退失败，请保留当前数据并重试恢复'); }
      throw new Error('本机配置恢复失败，已恢复原选择，请重试');
    }
  }
}
