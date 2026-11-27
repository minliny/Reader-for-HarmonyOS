import type { ReaderRoute } from './ReaderNavigation';

export interface ReaderSettingsPresentationPlan {
  lane: ReaderRoute;
  primaryFooter: boolean;
  reserveSharedFooter: boolean;
  settingsRoot?: ReaderRoute;
}

export function readerSettingsPresentationPlan(route: ReaderRoute, settingsOwned: boolean, wide: boolean,
  settingsHome: boolean, bottomMode: boolean): ReaderSettingsPresentationPlan {
  return {
    lane: wide && settingsOwned ? 'settings' : route,
    primaryFooter: bottomMode && (route === 'bookshelf' || (wide ? settingsOwned : route === 'settings' && settingsHome)),
    reserveSharedFooter: wide && settingsOwned && bottomMode,
    settingsRoot: settingsOwned ? 'settings' : undefined,
  };
}

export function readerRebaseSettingsViewport(previousWide: boolean, wide: boolean, settingsOwned: boolean): boolean {
  return settingsOwned && previousWide !== wide;
}
