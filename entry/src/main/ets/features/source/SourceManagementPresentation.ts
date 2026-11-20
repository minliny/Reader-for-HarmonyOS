import type { BookSource } from './SourceGateway';
import type { SourceGroupCatalog } from './SourceGroupTypes';
import type { ReaderSourceCategory } from './ReaderSourceCategory';

/** Retained group-ID based presentation. The currently mounted legacy source
 * page uses SourceManagementFilterState below; this type is not its state owner. */
export type SourceManagementStatus = 'all' | 'enabled' | 'failed' | 'unchecked';
export type SourceManagementKind = 'all' | 'novel' | 'comic' | 'other-sources';
export interface SourceManagementViewState {
  query: string;
  status: SourceManagementStatus;
  kind: SourceManagementKind;
  /** '*' is all, '' is explicitly ungrouped. Undefined source membership is unknown. */
  groupId: string;
}
export interface SourceManagementViewPatch {
  query?: string;
  status?: SourceManagementStatus;
  kind?: SourceManagementKind;
  groupId?: string;
}

export type SourceManagementFilterStatus = '全部' | '启用' | '异常' | '未检测';
export interface SourceManagementFilterInput {
  searchQuery: string;
  statusValue: string;
  categoryValue: string;
  groupValue: string;
}
/** Current SourceManagementPage view only. Group is its displayed normalized
 * name, not the retained catalog groupId. No source records or scroll live here. */
export interface SourceManagementFilterState extends SourceManagementFilterInput {
  statusValue: SourceManagementFilterStatus;
  categoryValue: ReaderSourceCategory | 'all';
}
export function defaultSourceManagementFilters(): SourceManagementFilterState {
  return { searchQuery: '', statusValue: '全部', categoryValue: 'all', groupValue: '全部分组' };
}
export function copySourceManagementFilters(input: SourceManagementFilterInput = defaultSourceManagementFilters()): SourceManagementFilterState {
  const statusValue: SourceManagementFilterStatus = input.statusValue === '启用' || input.statusValue === '异常' || input.statusValue === '未检测' ? input.statusValue : '全部';
  const categoryValue: ReaderSourceCategory | 'all' = input.categoryValue === 'novel' || input.categoryValue === 'comic' ||
    input.categoryValue === 'music' || input.categoryValue === 'download' || input.categoryValue === 'external' ||
    input.categoryValue === 'other' ? input.categoryValue : 'all';
  return { searchQuery: input.searchQuery, statusValue, categoryValue, groupValue: input.groupValue };
}
export function sourceManagementFilterKey(filters: SourceManagementFilterInput): string {
  return JSON.stringify([filters.searchQuery, filters.statusValue, filters.categoryValue, filters.groupValue]);
}
export interface SourceManagementScrollState {
  anchorId: string;
  firstIndex: number;
  itemY: number;
  /** Raw signed Native List coordinate; its top includes -contentStartOffset. */
  offset: number;
  filterKey: string;
  layoutKey: string;
}
export function copySourceManagementScroll(value: SourceManagementScrollState | undefined): SourceManagementScrollState | undefined {
  if (value === undefined || !Number.isFinite(value.firstIndex) || value.firstIndex < 0 ||
    !Number.isFinite(value.itemY) || !Number.isFinite(value.offset)) return undefined;
  return { anchorId: value.anchorId, firstIndex: Math.floor(value.firstIndex), itemY: value.itemY,
    offset: value.offset, filterKey: value.filterKey, layoutKey: value.layoutKey };
}
export type SourceToolsSurface = 'list' | 'editor' | 'checkSettings' | 'results';
export interface SourceToolsPresentationState {
  scope?: SourceManagementViewState;
  scopeMode: 'current' | 'all';
  query: string;
  surface: SourceToolsSurface;
  checkIds: string[];
  checkLabel: string;
  checkTarget: 'defaults' | 'batch' | 'single';
}
export interface SourceToolsPresentationPatch {
  scope?: SourceManagementViewState;
  scopeMode?: 'current' | 'all';
  query?: string;
  surface?: SourceToolsSurface;
  checkIds?: string[];
  checkLabel?: string;
  checkTarget?: 'defaults' | 'batch' | 'single';
}
export interface SourceManagementGroupOption { groupId: string; name: string; }

export function defaultSourceManagementView(groupId: string = '*'): SourceManagementViewState {
  return { query: '', status: 'all', kind: 'all', groupId };
}
export function emptySourceManagementCatalog(): SourceGroupCatalog {
  return { version: 1, revision: 0, groups: [], memberships: [] };
}
export function patchSourceManagementView(view: SourceManagementViewState,
  patch: SourceManagementViewPatch): SourceManagementViewState {
  return { query: patch.query ?? view.query, status: patch.status ?? view.status,
    kind: patch.kind ?? view.kind, groupId: patch.groupId ?? view.groupId };
}
export function defaultSourceToolsPresentation(): SourceToolsPresentationState {
  return { scopeMode: 'all', query: '', surface: 'list', checkIds: [], checkLabel: '', checkTarget: 'defaults' };
}
export function patchSourceToolsPresentation(view: SourceToolsPresentationState,
  patch: SourceToolsPresentationPatch): SourceToolsPresentationState {
  return { scope: patch.scope ?? view.scope, scopeMode: patch.scopeMode ?? view.scopeMode,
    query: patch.query ?? view.query, surface: patch.surface ?? view.surface,
    checkIds: patch.checkIds?.slice() ?? view.checkIds.slice(), checkLabel: patch.checkLabel ?? view.checkLabel, checkTarget: patch.checkTarget ?? view.checkTarget };
}
export function sourceManagementGroupId(source: BookSource, catalog: SourceGroupCatalog): string | undefined {
  if (source.groupId !== undefined) return source.groupId;
  return catalog.memberships.find(member => member.sourceId === source.sourceId)?.groupId;
}
export function sourceManagementGroupName(groupId: string | undefined, catalog: SourceGroupCatalog): string {
  if (groupId === '*') return '全部分组';
  if (groupId === '') return '未分组';
  if (groupId === undefined) return '分组待确认';
  const name = catalog.groups.find(group => group.groupId === groupId)?.name;
  return name === undefined ? '原分组已删除' : name === '全部分组' || name === '未分组' ? `${name}（同名分组）` : name;
}
export function sourceManagementGroupValid(groupId: string, catalog: SourceGroupCatalog): boolean {
  return groupId === '*' || groupId === '' || catalog.groups.some(group => group.groupId === groupId);
}
export function sourceManagementGroupOptions(catalog: SourceGroupCatalog): SourceManagementGroupOption[] {
  return [{ groupId: '*', name: '全部分组' }, { groupId: '', name: '未分组' },
    ...catalog.groups.map(group => ({ groupId: group.groupId, name: sourceManagementGroupName(group.groupId, catalog) }))];
}
export function filterManagementSources(sources: BookSource[], view: SourceManagementViewState,
  catalog: SourceGroupCatalog): BookSource[] {
  const query = view.query.trim().toLowerCase();
  // An invalid identity stays invalid: never widen to the full library.
  if (!sourceManagementGroupValid(view.groupId, catalog)) return [];
  return sources.filter(source =>
    (view.groupId === '*' || sourceManagementGroupId(source, catalog) === view.groupId) &&
    (view.kind === 'all' || (view.kind === 'other-sources' ?
      source.category !== 'novel' && source.category !== 'comic' : source.category === view.kind)) &&
    (view.status === 'all' || (view.status === 'enabled' ? source.enabled : view.status === 'failed' ?
      source.checkState === 'failed' : source.checkState === undefined || source.checkState === 'unchecked')) &&
    (query.length === 0 || source.name.toLowerCase().includes(query) || source.baseUrl.toLowerCase().includes(query)));
}
export function sourceManagementFilterCount(view: SourceManagementViewState, lockedGroupId?: string): number {
  return Number(view.status !== 'all') + Number(view.kind !== 'all') + Number(lockedGroupId === undefined && view.groupId !== '*');
}
export function sourceManagementFilterLabels(view: SourceManagementViewState, catalog: SourceGroupCatalog,
  lockedGroupId?: string): string[] {
  const labels: string[] = [];
  if (view.status !== 'all') labels.push(view.status === 'enabled' ? '启用' : view.status === 'failed' ? '异常' : '未检测');
  if (view.kind !== 'all') labels.push(view.kind === 'novel' ? '小说' : view.kind === 'comic' ? '漫画' : '其他书源');
  if (lockedGroupId === undefined && view.groupId !== '*') labels.push(sourceManagementGroupName(view.groupId, catalog));
  return labels;
}
export function sourceToolsVisibleSources(sources: BookSource[], view: SourceToolsPresentationState,
  catalog: SourceGroupCatalog): BookSource[] {
  const scope = view.scopeMode === 'current' && view.scope !== undefined ?
    filterManagementSources(sources, view.scope, catalog) : sources;
  const query = view.query.trim().toLowerCase();
  return scope.filter(source => query.length === 0 || source.name.toLowerCase().includes(query) || source.baseUrl.toLowerCase().includes(query));
}
