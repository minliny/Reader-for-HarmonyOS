// Generated copy of Reader-UI/theme/ReaderThemeSelection.ts. Do not edit.
import {
  findReaderTheme, readerThemeDefinition,
  type ReaderThemeId, type ReaderThemeScheme, type ReaderAppThemeMode,
} from './ReaderThemeRegistry.ts';

/** Four choices only. Effective/system colour schemes are runtime observations. */
export interface ReaderThemeSelection {
  appThemeMode: ReaderAppThemeMode;
  readerThemeId: ReaderThemeId;
  defaultDayReaderThemeId: ReaderThemeId;
  defaultNightReaderThemeId: ReaderThemeId;
}
export interface ReaderThemeBackupReader { id: string; scheme: ReaderThemeScheme; }
export interface ReaderThemeSelectionBackup {
  version: 1;
  appMode: ReaderAppThemeMode;
  reader: ReaderThemeBackupReader;
  defaultDayReaderId: string;
  defaultNightReaderId: string;
}
/** Pre-envelope backup contract: exactly the original four logical choices. */
export interface LegacyReaderThemeSelectionBackup {
  appThemeMode: ReaderAppThemeMode;
  readerThemeId: string;
  defaultDayReaderThemeId: string;
  defaultNightReaderThemeId: string;
}
export interface ReaderThemeBackupMigration { backup: ReaderThemeSelectionBackup; fallbackReason: string; }

export function migrateLegacyReaderThemeSelection(
  legacy: LegacyReaderThemeSelectionBackup, systemScheme?: ReaderThemeScheme, currentEffective?: ReaderThemeScheme,
): ReaderThemeBackupMigration {
  if (Object.keys(legacy).some((key: string): boolean =>
    !['appThemeMode', 'readerThemeId', 'defaultDayReaderThemeId', 'defaultNightReaderThemeId'].includes(key))) {
    throw new Error('THEME_SELECTION_INVALID');
  }
  if (legacy.appThemeMode !== 'day' && legacy.appThemeMode !== 'night' && legacy.appThemeMode !== 'system') {
    throw new Error('THEME_SELECTION_INVALID');
  }
  for (const id of [legacy.readerThemeId, legacy.defaultDayReaderThemeId, legacy.defaultNightReaderThemeId]) {
    if (typeof id !== 'string' || id.length === 0 || id.length > 128 || /[\u0000-\u001f\u007f]/.test(id)) {
      throw new Error('THEME_SELECTION_INVALID');
    }
  }
  // Persisted historical IDs, never label substrings or array positions.
  const historical: ReaderThemeScheme | undefined = ['day', 'warm', 'paper', 'green'].includes(legacy.readerThemeId) ? 'day' :
    ['night', 'warmNight', 'paperNight', 'greenNight'].includes(legacy.readerThemeId) ? 'night' : undefined;
  const known = findReaderTheme(legacy.readerThemeId)?.scheme ?? historical;
  const fixed = legacy.appThemeMode === 'system' ? undefined : legacy.appThemeMode;
  const scheme = known ?? fixed ?? systemScheme ?? currentEffective;
  if (scheme === undefined) throw new Error('THEME_LEGACY_SCHEME_UNAVAILABLE');
  return {
    backup: { version: 1, appMode: legacy.appThemeMode, reader: { id: legacy.readerThemeId, scheme },
      defaultDayReaderId: legacy.defaultDayReaderThemeId, defaultNightReaderId: legacy.defaultNightReaderThemeId },
    fallbackReason: known !== undefined ? '' : `legacy-unknown-reader:${fixed !== undefined ? 'fixed-app' : systemScheme !== undefined ? 'system' : 'current'}:${scheme}`,
  };
}
export interface ReaderThemeRestoreResult { selection: ReaderThemeSelection; fallbackReason: string; }
export type ReaderThemeIntent = 'app' | 'reader' | 'system' | 'default';
export function effectiveAppScheme(selection: ReaderThemeSelection, systemScheme: ReaderThemeScheme): ReaderThemeScheme {
  return selection.appThemeMode === 'system' ? systemScheme : selection.appThemeMode;
}
export function validDefaultReaderTheme(id: string, scheme: ReaderThemeScheme): ReaderThemeId {
  const theme = findReaderTheme(id);
  return theme !== undefined && theme.scheme === scheme ? theme.id : scheme;
}
export function reduceReaderThemeSelection(
  current: ReaderThemeSelection, intent: ReaderThemeIntent, value: string, systemScheme: ReaderThemeScheme,
): ReaderThemeSelection {
  const next: ReaderThemeSelection = {
    appThemeMode: current.appThemeMode, readerThemeId: current.readerThemeId,
    defaultDayReaderThemeId: validDefaultReaderTheme(current.defaultDayReaderThemeId, 'day'),
    defaultNightReaderThemeId: validDefaultReaderTheme(current.defaultNightReaderThemeId, 'night'),
  };
  if (intent === 'reader') {
    const theme = findReaderTheme(value);
    if (theme === undefined) return next;
    next.readerThemeId = theme.id;
    // Same scheme preserves system mode and the user's specific reading choice.
    if (theme.scheme !== effectiveAppScheme(current, systemScheme)) next.appThemeMode = theme.scheme;
  } else if (intent === 'default') {
    // The default action belongs to the already selected theme, never a hidden slot.
    const theme = readerThemeDefinition(current.readerThemeId);
    if (theme.scheme === 'day') next.defaultDayReaderThemeId = theme.id;
    else next.defaultNightReaderThemeId = theme.id;
  } else if (intent === 'app' || (intent === 'system' && current.appThemeMode === 'system')) {
    if (intent === 'app') {
      if (value !== 'day' && value !== 'night' && value !== 'system') return next;
      next.appThemeMode = value;
    }
    const scheme = effectiveAppScheme(next, systemScheme);
    next.readerThemeId = scheme === 'day' ? next.defaultDayReaderThemeId : next.defaultNightReaderThemeId;
  }
  return next;
}
export function encodeReaderThemeSelection(value: ReaderThemeSelection): ReaderThemeSelectionBackup {
  return {
    version: 1, appMode: value.appThemeMode,
    reader: { id: value.readerThemeId, scheme: readerThemeDefinition(value.readerThemeId).scheme },
    defaultDayReaderId: value.defaultDayReaderThemeId, defaultNightReaderId: value.defaultNightReaderThemeId,
  };
}
export function restoreReaderThemeSelection(
  input: ReaderThemeSelectionBackup | LegacyReaderThemeSelectionBackup, systemScheme: ReaderThemeScheme,
  currentEffective?: ReaderThemeScheme,
): ReaderThemeRestoreResult {
  const legacy = input as LegacyReaderThemeSelectionBackup;
  const migration = legacy.appThemeMode !== undefined ? migrateLegacyReaderThemeSelection(legacy, systemScheme, currentEffective) : undefined;
  const backup = migration?.backup ?? input as ReaderThemeSelectionBackup;
  if (backup.version !== 1 || !backup.reader ||
      (backup.reader.scheme !== 'day' && backup.reader.scheme !== 'night') ||
      (backup.appMode !== 'system' && backup.appMode !== 'day' && backup.appMode !== 'night')) {
    throw new Error('THEME_SELECTION_INVALID');
  }
  const day = validDefaultReaderTheme(backup.defaultDayReaderId, 'day');
  const night = validDefaultReaderTheme(backup.defaultNightReaderId, 'night');
  const known = findReaderTheme(backup.reader.id);
  if (known !== undefined && known.scheme !== backup.reader.scheme) throw new Error('THEME_SCHEME_MISMATCH');
  const reader = known?.id ?? (backup.reader.scheme === 'day' ? day : night);
  let mode = backup.appMode;
  // A restore is one transaction, so resolve inconsistent legacy selections once.
  const effective = mode === 'system' ? systemScheme : mode;
  const scheme = readerThemeDefinition(reader).scheme;
  if (effective !== scheme) mode = scheme;
  return {
    selection: { appThemeMode: mode, readerThemeId: reader, defaultDayReaderThemeId: day, defaultNightReaderThemeId: night },
    fallbackReason: migration?.fallbackReason || (known === undefined ? 'unknown-reader-id:' + backup.reader.scheme : ''),
  };
}
