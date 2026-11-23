export interface SourceManagementFilterValues {
  searchQuery: string;
  status: string;
  category: string;
  group: string;
}

export interface SourceManagementScrollState {
  anchorId: string;
  firstIndex: number;
  itemY: number;
  /** Native signed offset includes the negative contentStartOffset at the top. */
  offset: number;
  filterKey: string;
  layoutKey: string;
}

export function sourceManagementFilterKey(filters: SourceManagementFilterValues): string {
  return JSON.stringify([filters.searchQuery, filters.status, filters.category, filters.group]);
}

export function copySourceManagementScroll(value: SourceManagementScrollState | undefined): SourceManagementScrollState | undefined {
  if (value === undefined || !Number.isFinite(value.firstIndex) || value.firstIndex < 0 ||
    !Number.isFinite(value.itemY) || !Number.isFinite(value.offset)) return undefined;
  return { anchorId: value.anchorId, firstIndex: Math.floor(value.firstIndex), itemY: value.itemY,
    offset: value.offset, filterKey: value.filterKey, layoutKey: value.layoutKey };
}
