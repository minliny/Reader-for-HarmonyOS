/** Core-owned source-group metadata; independent of source execution rules. */
export type SourceGroupRecord = { groupId: string; name: string };
export type SourceGroupMembership = { sourceId: string; groupId: string; locallyAssigned: boolean };
export type SourceGroupCatalog = {
  version: 1;
  revision: number;
  groups: SourceGroupRecord[];
  memberships: SourceGroupMembership[];
};
export const EMPTY_SOURCE_GROUP_CATALOG: SourceGroupCatalog = { version: 1, revision: 0, groups: [], memberships: [] };
export type SourceGroupAction = 'create' | 'rename' | 'delete' | 'assign';
export type SourceGroupMutation = {
  expectedRevision: number;
  action: SourceGroupAction;
  groupId?: string;
  name?: string;
  targetGroupId?: string;
  sourceIds?: string[];
};
export type SourceGroupReceipt = {
  version: 1;
  revision: number;
  action: SourceGroupAction;
  groupId: string;
  affectedSourceIds: string[];
};
export type SourceImportGroupStrategy = 'preserve' | 'fill' | 'all';
export type SourceGroupedImportResult = {
  index: number;
  sourceId: string;
  status: 'imported' | 'failed';
  name?: string;
  groupId?: string;
  locallyAssigned?: boolean;
  error?: string;
};
export type SourceGroupedImportReceipt = {
  version: 1;
  revision: number;
  importedCount: number;
  failedCount: number;
  results: SourceGroupedImportResult[];
};
