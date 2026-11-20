import type { SourceGroupCatalog } from '../source/SourceGroupTypes';
import type { SearchBook } from './SearchGateway';
import type { SearchContentType } from './SearchViewState';

export type SearchFilterStep = 'filter' | 'groups';
export type SearchSourceGroupLoadState = 'loading' | 'ready' | 'error';
export type SearchSourceGroupSelection = {
  kind: 'all' | 'ungrouped' | 'group';
  groupId: string;
  name: string;
};
export const ALL_SEARCH_SOURCE_GROUP: SearchSourceGroupSelection = { kind: 'all', groupId: '', name: '全部分组' };

export class SearchSourceGroupOption {
  readonly key: string;
  readonly selection: SearchSourceGroupSelection;
  readonly count: number;
  readonly label: string;
  constructor(selection: SearchSourceGroupSelection, count: number) {
    this.selection = selection;
    this.key = searchSourceGroupKey(selection);
    this.count = count;
    this.label = selection.kind === 'group' && ['全部分组', '未分组'].includes(selection.name) ? `${selection.name}（同名分组）` : selection.name;
  }
}

export function searchSourceGroupKey(selection: SearchSourceGroupSelection): string {
  return selection.kind === 'group' ? `group:${selection.groupId}` : selection.kind;
}

/** The complete Core-owned membership snapshot includes disabled sources.
 * Missing membership is unknown, never evidence that a source is ungrouped. */
export class SearchSourceGroupDirectory {
  readonly revision: number;
  readonly options: SearchSourceGroupOption[] = [];
  private names: Map<string, string> = new Map();
  private memberships: Map<string, string> = new Map();

  constructor(catalog: SourceGroupCatalog) {
    this.revision = catalog.revision;
    for (const group of catalog.groups) this.names.set(group.groupId, group.name);
    for (const member of catalog.memberships) {
      if (member.sourceId !== 'local') this.memberships.set(member.sourceId, member.groupId);
    }
    this.options.push(new SearchSourceGroupOption(ALL_SEARCH_SOURCE_GROUP, this.memberships.size));
    this.options.push(new SearchSourceGroupOption({ kind: 'ungrouped', groupId: '', name: '未分组' }, this.count('')));
    for (const group of catalog.groups) this.options.push(new SearchSourceGroupOption({
      kind: 'group', groupId: group.groupId, name: group.name,
    }, this.count(group.groupId)));
  }

  private count(groupId: string): number {
    let count = 0;
    for (const value of this.memberships.values()) if (value === groupId) count += 1;
    return count;
  }
  valid(selection: SearchSourceGroupSelection): boolean {
    return selection.kind !== 'group' || this.names.has(selection.groupId);
  }
  label(selection: SearchSourceGroupSelection): string {
    if (selection.kind === 'all') return '全部分组';
    if (selection.kind === 'ungrouped') return '未分组';
    const name = this.names.get(selection.groupId);
    if (name === undefined) return `${selection.name}（已失效）`;
    return ['全部分组', '未分组'].includes(name) ? `${name}（同名分组）` : name;
  }
  matching(query: string): SearchSourceGroupOption[] {
    const normalized = query.trim().toLocaleLowerCase();
    return normalized.length === 0 ? this.options : this.options.filter((option: SearchSourceGroupOption): boolean =>
      option.selection.name.toLocaleLowerCase().includes(normalized));
  }
  selectionFor(key: string): SearchSourceGroupSelection | undefined {
    return this.options.find((option: SearchSourceGroupOption): boolean => option.key === key)?.selection;
  }
  matches(sourceId: string, selection: SearchSourceGroupSelection): boolean {
    if (selection.kind === 'all') return true;
    if (sourceId === 'local' || !this.valid(selection) || !this.memberships.has(sourceId)) return false;
    return this.memberships.get(sourceId) === (selection.kind === 'ungrouped' ? '' : selection.groupId);
  }
}

/** One presentation filter; this never mutates the query's original variants. */
export class SearchResultFilter {
  readonly key: string;
  private readonly origin: string;
  private readonly content: SearchContentType;
  private readonly selection: SearchSourceGroupSelection;
  private readonly directory: SearchSourceGroupDirectory;
  constructor(origin: string, content: SearchContentType, selection: SearchSourceGroupSelection,
    directory: SearchSourceGroupDirectory, displayRevision: number) {
    this.origin = origin; this.content = content; this.selection = selection; this.directory = directory;
    this.key = `${displayRevision}:${directory.revision}:${origin}:${content}:${searchSourceGroupKey(selection)}`;
  }
  matches(book: SearchBook): boolean {
    if ((this.origin === '本地' && book.sourceId !== 'local') ||
      (this.origin === '在线' && book.sourceId === 'local')) return false;
    if (this.content === '漫画' && book.category !== 'comic') return false;
    if (this.content === '小说' && book.category !== 'novel' &&
      !(book.sourceId === 'local' && book.category === undefined)) return false;
    return this.directory.matches(book.sourceId, this.selection);
  }
}
