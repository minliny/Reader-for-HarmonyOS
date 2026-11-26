import { isReaderProductSurfaceEnabled } from '../../../app/ReaderProductScope.ts';

export type SettingsPane = 'general' | 'bookshelfSettings' | 'source' | 'rulesManagement' |
  'downloads' | 'backup' | 'sync' | 'about';

export const RULES_MANAGEMENT_SETTINGS_ACTION_ID = 'reader-settings-rules-management';

export interface SettingsNavigationItem {
  id: SettingsPane;
  label: string;
  icon: string;
  actionId?: string;
}

export interface SettingsNavigationGroup {
  id: string;
  label: string;
  items: SettingsNavigationItem[];
}

export function settingsNavigationGroups(syncEnabled: boolean = isReaderProductSurfaceEnabled('sync')): SettingsNavigationGroup[] {
  const backup: SettingsNavigationItem = syncEnabled ?
    { id: 'sync', label: '备份与同步', icon: 'settings_row_sync' } :
    { id: 'backup', label: '本地备份与恢复', icon: 'settings_row_sync' };
  return [
    { id: 'interface', label: '通用与界面', items: [
      { id: 'general', label: '通用设置', icon: 'settings_row_general', actionId: 'reader-settings-general' },
      { id: 'bookshelfSettings', label: '书架设置', icon: 'settings_row_shelf_search' },
    ] },
    { id: 'reading', label: '内容与阅读', items: [
      { id: 'source', label: '书源管理', icon: 'settings_row_source', actionId: 'reader-settings-source-management' },
      { id: 'rulesManagement', label: '规则与订阅', icon: 'rss_edit', actionId: RULES_MANAGEMENT_SETTINGS_ACTION_ID },
    ] },
    { id: 'storage', label: '数据与存储', items: [
      { id: 'downloads', label: '下载管理', icon: 'settings_row_download' },
      backup,
    ] },
    { id: 'other', label: '其他', items: [
      { id: 'about', label: '关于 Reader', icon: 'settings_row_about' },
    ] },
  ];
}

export function settingsNavigationItems(): SettingsNavigationItem[] {
  return settingsNavigationGroups().flatMap(group => group.items);
}
