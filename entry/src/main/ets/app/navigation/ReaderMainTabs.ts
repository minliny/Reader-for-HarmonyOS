import { isReaderMainTabEnabled } from '../ReaderProductScope';

export interface MainTabDef {
  key: string;
  label: string;
}

const ALL_MAIN_TABS: MainTabDef[] = [
  { key: 'bookshelf', label: '书架' },
  { key: 'discover', label: '发现' },
  { key: 'rss', label: 'RSS' },
  { key: 'settings', label: '设置' },
];

export const MAIN_TABS: MainTabDef[] = ALL_MAIN_TABS.filter(
  (tab: MainTabDef): boolean => isReaderMainTabEnabled(tab.key),
);

export function readerMainTabIconResource(key: string, active: boolean, scheme: string): string {
  const night = scheme === 'night';
  if (key === 'bookshelf') {
    return active ? 'bookshelf_library_active' :
      (night ? 'bookshelf_library_outline_theme_night' : 'bookshelf_library_outline');
  }
  if (key === 'discover') {
    return active ? 'bookshelf_compass_active' :
      (night ? 'bookshelf_compass_outline_theme_night' : 'bookshelf_compass_outline');
  }
  if (key === 'rss') {
    return active ? 'bookshelf_rss_active' :
      (night ? 'bookshelf_rss_outline_theme_night' : 'bookshelf_rss_outline');
  }
  return active ? 'bookshelf_settings_active' :
    (night ? 'bookshelf_settings_outline_theme_night' : 'bookshelf_settings_outline');
}
