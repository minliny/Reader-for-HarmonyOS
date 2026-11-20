import type { JsonObject } from '@reader/core-harmony';
import { ReaderRuntimeOwner } from '../../app/ReaderRuntimeOwner';
import type { ReaderWriteEvidence } from '../../app/ReaderWriteEvidence';
import { RulesMutationOwner, type RulesMutationSnapshot } from '../settings/RulesMutationOwner';
import type { SourceGroupCatalog, SourceGroupMutation, SourceGroupReceipt,
  SourceGroupedImportReceipt, SourceGroupedImportResult, SourceImportGroupStrategy } from './SourceGroupTypes';

export type SourceGroupedImportParams = {
  expectedRevision: number;
  strategy: SourceImportGroupStrategy;
  targetGroupId?: string;
  targetGroupName?: string;
  items: JsonObject[];
};

function groupObject(value: unknown, fact: string): JsonObject {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${fact}数据无效，请重新核对`);
  return value as JsonObject;
}
function groupInteger(value: unknown): boolean { return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0; }
function groupStrings(value: unknown): string[] {
  if (!Array.isArray(value) || value.some((item: unknown): boolean => typeof item !== 'string' || item.trim().length === 0))
    throw new Error('分组回执的书源范围无效');
  const ids = value as string[];
  if (new Set(ids).size !== ids.length) throw new Error('分组回执包含重复书源');
  return ids.slice();
}
export function decodeSourceGroupCatalog(data: JsonObject): SourceGroupCatalog {
  if (data['version'] !== 1 || !groupInteger(data['revision']) || !Array.isArray(data['groups']) || !Array.isArray(data['memberships']))
    throw new Error('书源分组目录无效，请重新读取');
  const groups: SourceGroupCatalog['groups'] = [], memberships: SourceGroupCatalog['memberships'] = [];
  const groupIds = new Set<string>(), names = new Set<string>(), sourceIds = new Set<string>();
  for (const raw of data['groups'] as unknown[]) {
    const group = groupObject(raw, '分组');
    const id = group['groupId'], name = group['name'];
    if (typeof id !== 'string' || id.length === 0 || id === '*' || typeof name !== 'string' ||
      name.trim().length === 0 || name !== name.trim() || groupIds.has(id) || names.has(name))
      throw new Error('书源分组身份或名称不唯一');
    groups.push({ groupId: id, name }); groupIds.add(id); names.add(name);
  }
  for (const raw of data['memberships'] as unknown[]) {
    const member = groupObject(raw, '书源归属');
    const sourceId = member['sourceId'], groupId = member['groupId'], locallyAssigned = member['locallyAssigned'];
    if (typeof sourceId !== 'string' || sourceId.trim().length === 0 || sourceIds.has(sourceId) ||
      typeof groupId !== 'string' || (groupId !== '' && !groupIds.has(groupId)) || typeof locallyAssigned !== 'boolean')
      throw new Error('书源归属与分组目录不一致');
    memberships.push({ sourceId, groupId, locallyAssigned }); sourceIds.add(sourceId);
  }
  return { version: 1, revision: data['revision'] as number, groups, memberships };
}

export function qualifySourceGroupReceipt(params: JsonObject, data: JsonObject): SourceGroupReceipt {
  const action = params['action'];
  if (data['version'] !== 1 || !groupInteger(data['revision']) ||
    (data['revision'] as number) < (params['expectedRevision'] as number) || data['action'] !== action ||
    !['create','rename','delete','assign'].includes(action as string) || typeof data['groupId'] !== 'string')
    throw new Error('分组操作回执与原操作不一致');
  const groupId = data['groupId'] as string, affected = groupStrings(data['affectedSourceIds']);
  if (action === 'create' ? groupId.length === 0 : action === 'assign' ? groupId !== params['targetGroupId'] : groupId !== params['groupId'])
    throw new Error('分组操作回执的目标不一致');
  if (action === 'assign') {
    const expected = groupStrings(params['sourceIds']);
    if (expected.length !== affected.length || expected.some(id => !affected.includes(id)))
      throw new Error('改组回执没有覆盖原先选中的书源');
  }
  return { version: 1, revision: data['revision'] as number, action: action as SourceGroupReceipt['action'], groupId, affectedSourceIds: affected };
}

export function qualifySourceGroupedImport(params: JsonObject, data: JsonObject): SourceGroupedImportReceipt {
  const items = params['items'];
  if (!Array.isArray(items) || data['version'] !== 1 || !groupInteger(data['revision']) ||
    (data['revision'] as number) < (params['expectedRevision'] as number) || !groupInteger(data['importedCount']) ||
    !groupInteger(data['failedCount']) || !Array.isArray(data['results'])) throw new Error('导入分组回执无效');
  const results: SourceGroupedImportResult[] = [], seen = new Set<number>();
  for (const raw of data['results'] as unknown[]) {
    const row = groupObject(raw, '导入结果');
    const index = row['index'], sourceId = row['sourceId'], status = row['status'];
    if (!groupInteger(index) || (index as number) >= items.length || seen.has(index as number) ||
      sourceId !== groupObject(items[index as number], '原导入条目')['sourceId'] ||
      (status !== 'imported' && status !== 'failed')) throw new Error('导入结果与原先选中的条目不一致');
    if (status === 'imported' && (typeof row['name'] !== 'string' || (row['name'] as string).trim().length === 0 ||
      typeof row['groupId'] !== 'string' || typeof row['locallyAssigned'] !== 'boolean')) throw new Error('导入成功回执缺少最终分组');
    if (status === 'failed' && (typeof row['error'] !== 'string' || (row['error'] as string).length === 0))
      throw new Error('导入失败回执缺少原因');
    results.push({ index: index as number, sourceId: sourceId as string, status, name: row['name'] as string | undefined,
      groupId: row['groupId'] as string | undefined, locallyAssigned: row['locallyAssigned'] as boolean | undefined,
      error: row['error'] as string | undefined });
    seen.add(index as number);
  }
  const importedCount = results.filter(row => row.status === 'imported').length;
  if (results.length !== items.length || importedCount !== data['importedCount'] ||
    results.length - importedCount !== data['failedCount']) throw new Error('导入结果数量不完整，需核对原操作');
  return { version: 1, revision: data['revision'] as number, importedCount, failedCount: results.length - importedCount, results };
}

/** Metadata reads and finite commands share the existing exact write owner. */
export class SourceGroupGateway {
  private static readonly catalogs: WeakMap<ReaderRuntimeOwner, SourceGroupCatalog> = new WeakMap();
  private readonly runtime: ReaderRuntimeOwner;
  constructor(runtime: ReaderRuntimeOwner) { this.runtime = runtime; }
  static catalogSnapshot(runtime: ReaderRuntimeOwner): SourceGroupCatalog | undefined { return SourceGroupGateway.catalogs.get(runtime); }
  supportsGroups(): boolean { return this.runtime.supportsCoreCapability('source.group.metadata.v1') &&
    this.runtime.supportsCoreCapability('rules.mutation.source-groups.v1'); }
  snapshot(): RulesMutationSnapshot { return RulesMutationOwner.forRuntime(this.runtime).snapshot(); }
  async loadCatalog(current: () => boolean): Promise<SourceGroupCatalog> {
    if (!this.runtime.supportsCoreCapability('source.group.metadata.v1')) throw new Error('当前 Core 尚未接入书源分组');
    const event = await this.runtime.request('source.group.catalog', { reportVersion: 1 }, { canDispatch: current, canContinue: current });
    const catalog = decodeSourceGroupCatalog(event.data);
    if (!current()) throw new Error('书源分组页面已退役');
    const previous = SourceGroupGateway.catalogs.get(this.runtime);
    if (previous === undefined || catalog.revision >= previous.revision) SourceGroupGateway.catalogs.set(this.runtime, catalog);
    return SourceGroupGateway.catalogs.get(this.runtime) ?? catalog;
  }
  async mutate(params: SourceGroupMutation, label: string, current: () => boolean, evidence?: ReaderWriteEvidence): Promise<SourceGroupReceipt> {
    const fixed: JsonObject = { expectedRevision: params.expectedRevision, action: params.action };
    if (params.groupId !== undefined) fixed['groupId'] = params.groupId;
    if (params.name !== undefined) fixed['name'] = params.name;
    if (params.targetGroupId !== undefined) fixed['targetGroupId'] = params.targetGroupId;
    if (params.sourceIds !== undefined) fixed['sourceIds'] = params.sourceIds.slice();
    return RulesMutationOwner.forRuntime(this.runtime).run(label, current, async (request, confirmed): Promise<SourceGroupReceipt> => {
      const event = await request('source.group.mutate', fixed);
      const receipt = qualifySourceGroupReceipt(fixed, event.data); confirmed(); return receipt;
    }, evidence);
  }
  async importGrouped(params: SourceGroupedImportParams, current: () => boolean, evidence?: ReaderWriteEvidence): Promise<SourceGroupedImportReceipt> {
    const fixed: JsonObject = { expectedRevision: params.expectedRevision, strategy: params.strategy, items: params.items };
    if (params.targetGroupId !== undefined) fixed['targetGroupId'] = params.targetGroupId;
    if (params.targetGroupName !== undefined) fixed['targetGroupName'] = params.targetGroupName;
    return RulesMutationOwner.forRuntime(this.runtime).run('导入书源', current, async (request, confirmed): Promise<SourceGroupedImportReceipt> => {
      const event = await request('source.import.grouped', fixed);
      const receipt = qualifySourceGroupedImport(fixed, event.data); confirmed(); return receipt;
    }, evidence);
  }
  async recover(current: () => boolean, retryOriginal: boolean = false, expectedOperationId?: string,
    onImportReceipt?: (receipt: SourceGroupedImportReceipt) => void,
    onGroupReceipt?: (receipt: SourceGroupReceipt) => void): Promise<RulesMutationSnapshot> {
    return RulesMutationOwner.forRuntime(this.runtime).recoverOriginal(current, (method, params, data): void => {
      if (method === 'source.group.mutate') { const receipt = qualifySourceGroupReceipt(params, data); onGroupReceipt?.(receipt); }
      else if (method === 'source.import.grouped') { const receipt = qualifySourceGroupedImport(params, data); onImportReceipt?.(receipt); }
      else throw new Error('当前分组入口不能确认另一原操作');
    }, retryOriginal, 'source-management', undefined, expectedOperationId,
    (method: string): boolean => (method === 'source.group.mutate' && onGroupReceipt !== undefined) ||
      (method === 'source.import.grouped' && onImportReceipt !== undefined));
  }
}
