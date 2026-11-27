import type { BookGroup } from './BookshelfManagementGateway';

export type BookshelfGroupSelection = 'ignore' | 'dismiss' | 'assign';

export function bookshelfGroupSelection(
  selected: string,
  current: string,
  groups: readonly BookGroup[],
  writeBlocked: boolean,
): BookshelfGroupSelection {
  if (writeBlocked) return 'ignore';
  if (selected === current) return 'dismiss';
  if (selected.length === 0 || groups.some(group => group.groupName === selected)) return 'assign';
  return 'ignore';
}
