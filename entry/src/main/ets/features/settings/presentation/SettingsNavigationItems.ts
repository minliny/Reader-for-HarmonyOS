import { isReaderProductSurfaceEnabled } from '../../../app/ReaderProductScope.ts';

export type SettingsPane = 'general' | 'source' | 'sync' | 'bookshelfSettings' | 'downloads' | 'about';

export interface SettingsNavigationItem {
  id: SettingsPane;
  label: string;
  icon: string;
  actionId?: string;
}

export function settingsNavigationItems(): SettingsNavigationItem[] {
  const items: SettingsNavigationItem[] = [
    { id: 'general', label: '通用设置', icon: 'settings_row_general' },
    { id: 'source', label: '书源管理', icon: 'settings_row_source', actionId: 'reader-settings-source-management' },
  ];
  if (isReaderProductSurfaceEnabled('sync')) {
    items.push({ id: 'sync', label: '同步与备份', icon: 'settings_row_sync' });
  }
  items.push(
    { id: 'bookshelfSettings', label: '书架设置', icon: 'settings_row_shelf_search' },
    { id: 'downloads', label: '下载管理', icon: 'settings_row_download' },
    { id: 'about', label: '关于 Reader', icon: 'settings_row_about' },
  );
  return items;
}
