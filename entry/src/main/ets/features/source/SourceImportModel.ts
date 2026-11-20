import type { JsonObject } from '@reader/core-harmony';
import type { RulesMutationSnapshot } from '../settings/RulesMutationOwner';
import { EMPTY_SOURCE_GROUP_CATALOG, type SourceGroupCatalog, type SourceGroupedImportReceipt,
  type SourceImportGroupStrategy, type SourceGroupMembership } from './SourceGroupTypes';
import type { SourceGroupedImportParams } from './SourceGroupGateway';
import { sourceGroupNameError } from './SourceGroupManagementModel';

export type SourceImportMethod = 'local' | 'url' | 'paste' | 'subscription';
export type SourceImportStage = 'input' | 'preview' | 'submitting' | 'results';
export type SourceImportIntent =
  { kind: 'method'; value: SourceImportMethod } | { kind: 'url' | 'text'; value: string } |
  { kind: 'acquire' | 'refresh' | 'retryFailed' | 'reconcile' | 'continueOriginal' | 'newDocument' | 'subscriptions' } |
  { kind: 'select'; index: number; selected: boolean } | { kind: 'selectAll'; selected: boolean } |
  { kind: 'strategy'; value: SourceImportGroupStrategy } |
  { kind: 'target'; targetKind: 'existing' | 'new'; groupId: string; name: string } |
  { kind: 'confirm'; scope: string; checked: boolean } | { kind: 'submit'; scope: string };

export interface SourceImportPreparedItem { index: number; sourceId: string; bookSource: JsonObject; }
export interface SourceImportPrepared {
  items: SourceImportPreparedItem[];
  failures: { index: number; sourceId: string; message: string }[];
}
interface SourceImportPrivateRow {
  index: number; sourceId: string; name: string; documentGroup: string; bookSource?: JsonObject;
  error: string; selected: boolean; status: 'ready' | 'imported' | 'failed' | 'invalid' | 'unknown';
  acknowledgedGroup?: string;
}
export interface SourceImportRow {
  index: number; sourceId: string; name: string; documentGroup: string; error: string;
  valid: boolean; selected: boolean; status: 'ready' | 'imported' | 'failed' | 'invalid' | 'unknown';
  existing: boolean; beforeGroup: string; finalGroup: string;
}
export interface SourceImportPlan {
  params: SourceGroupedImportParams;
  /** The Core receipt indexes the fixed selected array, not the document. */
  documentIndexes: number[];
  scope: string;
}
export interface SourceImportSnapshot {
  generation: number; stage: SourceImportStage; busy: boolean; method: SourceImportMethod;
  url: string; text: string; documentName: string; catalog: SourceGroupCatalog;
  catalogState: 'loading' | 'ready' | 'error'; error: string;
  strategy: SourceImportGroupStrategy; targetKind: 'existing' | 'new'; targetGroupId: string; targetGroupName: string;
  rows: SourceImportRow[]; selectedCount: number; updatedCount: number; needsTarget: boolean;
  confirmationRequired: boolean; confirmationScope: string; overwriteConfirmed: boolean; canSubmit: boolean;
  blockingMessage: string; original?: RulesMutationSnapshot;
  receipt?: SourceGroupedImportReceipt; receiptGeneration: number; confirmedImported: number; refreshRequired: boolean;
}

function sourceImportNamedGroupLabel(name: string | undefined): string {
  if (name === undefined) return '原分组已删除';
  return name === '全部分组' || name === '未分组' ? `${name}（同名分组）` : name;
}
export function sourceImportGroupLabel(catalog: SourceGroupCatalog, groupId: string): string {
  return groupId === '' ? '未分组' : sourceImportNamedGroupLabel(catalog.groups.find(group => group.groupId === groupId)?.name);
}

/** Pure Reader import policy. Raw accepted DTOs stay private; the UI receives
 * only metadata and can never edit the submitted payload through a snapshot. */
export class SourceImportModel {
  private generation: number = 0;
  private documentRevision: number = 0;
  private stage: SourceImportStage = 'input';
  private busy: boolean = false;
  private method: SourceImportMethod = 'local';
  private url: string = '';
  private text: string = '';
  private documentName: string = '';
  private catalog: SourceGroupCatalog = EMPTY_SOURCE_GROUP_CATALOG;
  private memberships: Map<string, SourceGroupMembership> = new Map();
  private groupNames: Map<string, string> = new Map();
  private catalogState: 'loading' | 'ready' | 'error' = 'loading';
  private error: string = '';
  private strategy: SourceImportGroupStrategy = 'preserve';
  private targetKind: 'existing' | 'new' = 'existing';
  private targetGroupId: string = '';
  private targetGroupName: string = '';
  private confirmedScope: string = '';
  private rows: SourceImportPrivateRow[] = [];
  private original: RulesMutationSnapshot | undefined = undefined;
  private receipt: SourceGroupedImportReceipt | undefined = undefined;
  private receiptGeneration: number = 0;

  private changed(): void { this.generation += 1; }
  private invalidateConfirmation(): void { this.confirmedScope = ''; }
  private groupMembership(sourceId: string): SourceGroupMembership | undefined {
    return this.memberships.get(sourceId);
  }
  private groupLabel(groupId: string): string { return groupId === '' ? '未分组' : sourceImportNamedGroupLabel(this.groupNames.get(groupId)); }
  private selectedRows(): SourceImportPrivateRow[] {
    return this.rows.filter(row => row.selected && row.bookSource !== undefined && row.status !== 'imported' && row.status !== 'invalid');
  }
  private targetValid(): boolean {
    if (this.targetKind === 'existing') return this.targetGroupId === '' || this.catalog.groups.some(group => group.groupId === this.targetGroupId);
    const name = this.targetGroupName.trim();
    return sourceGroupNameError(this.catalog, name).length === 0;
  }
  private targetLabel(): string {
    return this.targetKind === 'new' ? this.targetGroupName.trim() || '未指定新分组' : this.groupLabel(this.targetGroupId);
  }
  private finalGroup(row: SourceImportPrivateRow): string {
    if (row.acknowledgedGroup !== undefined) return row.acknowledgedGroup;
    const existing = this.groupMembership(row.sourceId);
    if (this.strategy === 'all') return this.targetLabel();
    if (existing !== undefined) return this.groupLabel(existing.groupId);
    if (this.strategy === 'fill' && row.documentGroup.length === 0) return this.targetLabel();
    return row.documentGroup || '未分组';
  }
  private confirmationScope(): string {
    return JSON.stringify({ input: this.documentRevision, catalogRevision: this.catalog.revision, strategy: this.strategy,
      targetKind: this.targetKind, targetGroupId: this.targetGroupId, targetGroupName: this.targetGroupName.trim(),
      selected: this.selectedRows().map(row => { const previous = this.groupMembership(row.sourceId);
        return { index: row.index, sourceId: row.sourceId, existed: previous !== undefined,
          groupId: previous?.groupId, locallyAssigned: previous?.locallyAssigned }; }) });
  }
  editable(): boolean { return !this.busy && this.original?.busy !== true && this.original?.blocked !== true && this.original?.confirmation !== 'unknown'; }
  setCatalog(catalog: SourceGroupCatalog): void {
    if (catalog.revision < this.catalog.revision) return;
    if (catalog.revision !== this.catalog.revision) this.invalidateConfirmation();
    this.catalog = catalog;
    this.memberships = new Map(); for (const member of catalog.memberships) this.memberships.set(member.sourceId, member);
    this.groupNames = new Map(); for (const group of catalog.groups) this.groupNames.set(group.groupId, group.name);
    this.catalogState = 'ready'; this.changed();
  }
  setCatalogState(state: 'loading' | 'ready' | 'error', message: string = ''): void {
    this.catalogState = state;
    if (message.length > 0) this.error = message;
    this.changed();
  }
  setBusy(busy: boolean, stage?: SourceImportStage): void {
    this.busy = busy; if (stage !== undefined) this.stage = stage; this.changed();
  }
  setError(message: string): void { this.error = message; this.changed(); }
  setOriginal(original: RulesMutationSnapshot | undefined): void { this.original = original; this.changed(); }

  editInput(kind: 'method' | 'url' | 'text', value: string): void {
    if (!this.editable()) return;
    if (kind === 'method') this.method = value as SourceImportMethod;
    else if (kind === 'url') this.url = value;
    else this.text = value;
    this.documentRevision += 1; this.rows = []; this.stage = 'input'; this.error = '';
    this.receipt = undefined; this.invalidateConfirmation(); this.changed();
  }
  newDocument(): void {
    if (!this.editable()) return;
    this.rows = []; this.stage = 'input'; this.documentName = ''; this.receipt = undefined;
    this.error = ''; this.documentRevision += 1; this.invalidateConfirmation(); this.changed();
  }
  acceptDocument(name: string, text: string, prepared: SourceImportPrepared): void {
    const duplicates = new Map<string, number>();
    for (const item of prepared.items) duplicates.set(item.sourceId, (duplicates.get(item.sourceId) ?? 0) + 1);
    this.rows = prepared.items.map((item): SourceImportPrivateRow => {
      const duplicate = (duplicates.get(item.sourceId) ?? 0) > 1;
      const raw = JSON.parse(JSON.stringify(item.bookSource)) as JsonObject;
      const group = raw['bookSourceGroup']; const name = raw['bookSourceName'];
      return { index: item.index, sourceId: item.sourceId, name: typeof name === 'string' ? name : item.sourceId,
        documentGroup: typeof group === 'string' ? group.trim() : '', bookSource: duplicate ? undefined : raw,
        error: duplicate ? '文件内存在重复地址，请整理后重新预览。' : '', selected: !duplicate, status: duplicate ? 'invalid' : 'ready' };
    });
    for (const failure of prepared.failures) this.rows.push({ index: failure.index, sourceId: failure.sourceId,
      name: `第 ${failure.index + 1} 项`, documentGroup: '', error: '缺少有效书源地址或书源内容。', selected: false, status: 'invalid' });
    this.rows.sort((left, right): number => left.index - right.index);
    this.documentName = name; this.text = this.method === 'paste' ? text : this.text;
    this.documentRevision += 1; this.stage = 'preview'; this.strategy = 'preserve';
    this.targetKind = 'existing'; this.targetGroupId = ''; this.targetGroupName = '';
    this.receipt = undefined; this.error = ''; this.invalidateConfirmation(); this.changed();
  }
  select(index: number, selected: boolean): void {
    if (!this.editable()) return;
    const row = this.rows.find(item => item.index === index);
    if (row === undefined || row.bookSource === undefined || row.status === 'imported') return;
    row.selected = selected; this.invalidateConfirmation(); this.changed();
  }
  selectAll(selected: boolean): void {
    if (!this.editable()) return;
    for (const row of this.rows) if (row.bookSource !== undefined && row.status !== 'imported') row.selected = selected;
    this.invalidateConfirmation(); this.changed();
  }
  setStrategy(strategy: SourceImportGroupStrategy): void {
    if (!this.editable()) return;
    this.strategy = strategy; this.invalidateConfirmation(); this.changed();
  }
  setTarget(kind: 'existing' | 'new', groupId: string, name: string): void {
    if (!this.editable()) return;
    this.targetKind = kind; this.targetGroupId = groupId; this.targetGroupName = name;
    this.invalidateConfirmation(); this.changed();
  }
  confirm(scope: string, checked: boolean): void {
    if (!this.editable() || scope !== this.confirmationScope()) return;
    this.confirmedScope = checked ? scope : ''; this.changed();
  }
  retryFailed(): void {
    if (!this.editable()) return;
    for (const row of this.rows) row.selected = row.status === 'failed' && row.bookSource !== undefined;
    this.stage = 'preview'; this.error = ''; this.invalidateConfirmation(); this.changed();
  }
  plan(scope: string): SourceImportPlan | undefined {
    const snapshot = this.snapshot();
    if (!snapshot.canSubmit || scope !== snapshot.confirmationScope) return undefined;
    const selected = this.selectedRows();
    const params: SourceGroupedImportParams = { expectedRevision: this.catalog.revision, strategy: this.strategy,
      items: selected.map(row => ({ sourceId: row.sourceId, bookSource: JSON.parse(JSON.stringify(row.bookSource)) as JsonObject })) };
    if (snapshot.needsTarget) {
      if (this.targetKind === 'new') params.targetGroupName = this.targetGroupName.trim();
      else params.targetGroupId = this.targetGroupId;
    }
    return { params, documentIndexes: selected.map(row => row.index), scope };
  }
  markUnknown(plan: SourceImportPlan): void {
    for (const index of plan.documentIndexes) {
      const row = this.rows.find(item => item.index === index);
      if (row !== undefined && row.status !== 'imported') { row.status = 'unknown'; row.error = ''; }
    }
    this.stage = 'results'; this.changed();
  }
  applyReceipt(receipt: SourceGroupedImportReceipt, plan: SourceImportPlan): void {
    for (const result of receipt.results) {
      const index = plan.documentIndexes[result.index]; const row = this.rows.find(item => item.index === index);
      if (row === undefined || row.sourceId !== result.sourceId) continue;
      const expectedLabel = this.finalGroup(row);
      row.status = result.status === 'imported' ? 'imported' : 'failed'; row.selected = result.status !== 'imported';
      row.error = result.status === 'failed' ? '未通过导入校验，请检查书源内容后重试。' : '';
      if (result.status === 'imported') row.acknowledgedGroup = result.groupId === '' ? '未分组' :
        (this.groupNames.has(result.groupId as string) ? this.groupLabel(result.groupId as string) : expectedLabel);
    }
    this.receipt = receipt; this.receiptGeneration += 1; this.stage = 'results'; this.busy = false;
    this.error = ''; this.invalidateConfirmation(); this.changed();
  }
  restoreOriginal(params: JsonObject): SourceImportPlan | undefined {
    if (!Array.isArray(params['items'])) return undefined;
    const prepared: SourceImportPrepared = { items: [], failures: [] };
    for (let index = 0; index < (params['items'] as JsonObject[]).length; index++) {
      const item = (params['items'] as JsonObject[])[index];
      if (typeof item['sourceId'] !== 'string' || item['bookSource'] === null || typeof item['bookSource'] !== 'object' || Array.isArray(item['bookSource'])) return undefined;
      prepared.items.push({ index, sourceId: item['sourceId'] as string, bookSource: item['bookSource'] as JsonObject });
    }
    this.acceptDocument('原导入操作', '', prepared);
    this.strategy = params['strategy'] as SourceImportGroupStrategy;
    this.targetKind = typeof params['targetGroupName'] === 'string' ? 'new' : 'existing';
    this.targetGroupId = typeof params['targetGroupId'] === 'string' ? params['targetGroupId'] as string : '';
    this.targetGroupName = typeof params['targetGroupName'] === 'string' ? params['targetGroupName'] as string : '';
    for (const row of this.rows) { row.status = 'unknown'; row.selected = true; }
    this.stage = 'results'; this.changed();
    return { params: JSON.parse(JSON.stringify(params)) as SourceGroupedImportParams,
      documentIndexes: prepared.items.map(item => item.index), scope: this.confirmationScope() };
  }
  snapshot(): SourceImportSnapshot {
    const selected = this.selectedRows();
    const updatedCount = selected.filter(row => this.groupMembership(row.sourceId) !== undefined).length;
    const needsTarget = this.strategy === 'all' || (this.strategy === 'fill' && selected.some(row =>
      this.groupMembership(row.sourceId) === undefined && row.documentGroup.length === 0));
    const required = this.strategy === 'all' && updatedCount > 0;
    const scope = this.confirmationScope();
    const staleCatalog = this.receipt !== undefined && this.catalog.revision < this.receipt.revision;
    let blocking = this.catalogState !== 'ready' || staleCatalog ? '请先刷新分组目录。' : '';
    if (blocking.length === 0 && selected.length === 0) blocking = '请选择要导入的书源。';
    if (blocking.length === 0 && needsTarget && !this.targetValid()) blocking = this.targetKind === 'new' ? sourceGroupNameError(this.catalog, this.targetGroupName) : '目标分组已变化，请重新选择。';
    if (blocking.length === 0 && required && this.confirmedScope !== scope) blocking = '请确认覆盖所选已有书源的分组归属。';
    if (blocking.length === 0 && !this.editable()) blocking = this.busy ? '正在处理…' : '请先核对原导入操作。';
    return { generation: this.generation, stage: this.stage, busy: this.busy, method: this.method, url: this.url, text: this.text,
      documentName: this.documentName, catalog: this.catalog, catalogState: this.catalogState, error: this.error,
      strategy: this.strategy, targetKind: this.targetKind, targetGroupId: this.targetGroupId, targetGroupName: this.targetGroupName,
      rows: this.rows.map((row): SourceImportRow => { const previous = this.groupMembership(row.sourceId);
        return { index: row.index, sourceId: row.sourceId, name: row.name, documentGroup: row.documentGroup, error: row.error,
          valid: row.bookSource !== undefined, selected: row.selected, status: row.status, existing: previous !== undefined,
          beforeGroup: previous === undefined ? '新增书源' : this.groupLabel(previous.groupId), finalGroup: this.finalGroup(row) }; }),
      selectedCount: selected.length, updatedCount, needsTarget, confirmationRequired: required, confirmationScope: scope,
      overwriteConfirmed: this.confirmedScope === scope, canSubmit: blocking.length === 0 && (this.stage === 'preview' || this.stage === 'results'),
      blockingMessage: blocking, original: this.original, receipt: this.receipt, receiptGeneration: this.receiptGeneration,
      confirmedImported: this.receipt?.importedCount ?? 0, refreshRequired: staleCatalog };
  }
}

export function emptySourceImportSnapshot(): SourceImportSnapshot { return new SourceImportModel().snapshot(); }
export const EMPTY_SOURCE_IMPORT_SNAPSHOT: SourceImportSnapshot = emptySourceImportSnapshot();
