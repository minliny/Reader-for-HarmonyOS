import type { BookSource } from './SourceGateway';
import type { SourceGroupCatalog, SourceGroupMutation, SourceGroupReceipt } from './SourceGroupTypes';
import { EMPTY_SOURCE_GROUP_CATALOG } from './SourceGroupTypes';
import type { RulesMutationSnapshot } from '../settings/RulesMutationOwner';

export type SourceGroupMode = 'directory' | 'create' | 'rename' | 'delete' | 'assign' | 'addMembers' | 'result';
export type SourceGroupManagementSnapshot = {
  revision: number;
  catalog: SourceGroupCatalog;
  sources: BookSource[];
  read: 'idle' | 'loading' | 'ready' | 'error';
  readError: string;
  view: SourceGroupMode;
  query: string;
  groupId: string;
  name: string;
  targetGroupId: string;
  sourceIds: string[];
  busy: boolean;
  error: string;
  receipt?: SourceGroupReceipt;
  receiptGeneration: number;
  original?: RulesMutationSnapshot;
};
export function emptySourceGroupManagement(): SourceGroupManagementSnapshot {
  return { revision: 0, catalog: EMPTY_SOURCE_GROUP_CATALOG, sources: [], read: 'idle', readError: '',
    view: 'directory', query: '', groupId: '', name: '', targetGroupId: '', sourceIds: [],
    busy: false, error: '', receiptGeneration: 0 };
}
export type SourceGroupIntent =
  { type: 'refresh' | 'create' | 'back' | 'submit' } |
  { type: 'rename' | 'delete' | 'openMembers' | 'addMembers'; groupId: string } |
  { type: 'query' | 'name'; value: string } |
  { type: 'target'; groupId: string } |
  { type: 'toggleSource'; sourceId: string } |
  { type: 'reconcile'; generation: number; continueOriginal: boolean } |
  { type: 'deleteConfirmed'; groupId: string; targetGroupId: string; expectedRevision: number };

export function sourceGroupName(catalog: SourceGroupCatalog, groupId: string): string {
  return groupId === '' ? '未分组' : catalog.groups.find(group => group.groupId === groupId)?.name ?? '原分组已删除';
}
export function sourceGroupMemberIds(catalog: SourceGroupCatalog, groupId: string, liveSources?: BookSource[]): string[] {
  return catalog.memberships.filter(member => member.groupId === groupId &&
    (liveSources === undefined || liveSources.some(source => source.sourceId === member.sourceId))).map(member => member.sourceId);
}
export function sourceGroupNameError(catalog: SourceGroupCatalog, name: string, exceptId?: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0) return '请输入分组名称';
  if (Array.from(trimmed).length > 32) return '分组名称最多 32 个字';
  if (trimmed === '全部分组' || trimmed === '未分组') return '分组名称与默认选项冲突，请换一个名称';
  if (catalog.groups.some(group => group.groupId !== exceptId && group.name === trimmed)) return '已有同名分组，请换一个名称';
  return '';
}
export function sourceGroupCommand(snapshot: SourceGroupManagementSnapshot): SourceGroupMutation | undefined {
  if (snapshot.busy || snapshot.read !== 'ready' || snapshot.original?.blocked) return undefined;
  if (snapshot.view === 'create' || snapshot.view === 'rename') {
    if (sourceGroupNameError(snapshot.catalog, snapshot.name, snapshot.view === 'rename' ? snapshot.groupId : undefined)) return undefined;
    if (snapshot.view === 'rename' && !snapshot.catalog.groups.some(group => group.groupId === snapshot.groupId)) return undefined;
    return { expectedRevision: snapshot.catalog.revision, action: snapshot.view, name: snapshot.name.trim(),
      ...(snapshot.view === 'rename' ? { groupId: snapshot.groupId } : {}) };
  }
  if (snapshot.targetGroupId !== '' && !snapshot.catalog.groups.some(group => group.groupId === snapshot.targetGroupId)) return undefined;
  if (snapshot.view === 'delete') {
    if (snapshot.groupId === '' || snapshot.groupId === snapshot.targetGroupId || !snapshot.catalog.groups.some(group => group.groupId === snapshot.groupId)) return undefined;
    return { expectedRevision: snapshot.catalog.revision, action: 'delete', groupId: snapshot.groupId, targetGroupId: snapshot.targetGroupId };
  }
  if (snapshot.view === 'assign' || snapshot.view === 'addMembers') {
    const ids = [...new Set(snapshot.sourceIds)];
    // Membership may be absent in an explicit empty catalog or after a legacy
    // writer adds a source. The current source-list owner admits selection;
    // Core rechecks live identities and the catalog revision at commit time.
    if (ids.length === 0 || ids.some(id => !snapshot.sources.some(source => source.sourceId === id))) return undefined;
    return { expectedRevision: snapshot.catalog.revision, action: 'assign', sourceIds: ids, targetGroupId: snapshot.targetGroupId };
  }
  return undefined;
}
