import url from '@ohos.url';
import type { JsonObject } from '@reader/core-harmony';
import { errorMessageOf } from '../../../app/ErrorMessage';
import { ReaderRuntimeOwner } from '../../../app/ReaderRuntimeOwner';
import { isPrivateNetworkTarget } from '../../../platform/network/HttpTransportPolicy';
import { RulesManagementGateway, type ManagedRuleSubscription, type RuleSourceChange, type RuleSourceSubscriptionPreview,
  type RuleSubscriptionDraft } from '../../settings/application/RulesManagementGateway';
import { SourceGateway, type BookSource, type SourceCheckOutcome, type SourceGroupMembership, type SourceGroupRecord, type SourceGroupedImportOutcome, type SourceGroupedImportPlan, type SourceGroupedImportPreview, type SourceImportCandidate, type SourceImportFailure, type SourceImportGroupTarget, type SourceGroupedImportRow } from './SourceGateway';
import { applyV9ImportReport, assignV9ImportSelection, buildV9ImportRows, chooseV9ImportRow,
  runV9CandidateChecks, sourceV9CanonicalDocument, sourceV9ChangesToApply, sourceV9ImportedReports, sourceV9ReplaceRuleComparable,
  sourceV9Levels, sourceV9SelectedImportRows, type SourceV9Change, type SourceV9Depth, type SourceV9GroupStrategy,
  type SourceV9ImportedReport, type SourceV9ImportOrigin, type SourceV9ImportRow, type SourceV9Mode } from './SourceV9TransferState';

export interface SourceV9ImportDraft {
  origin: SourceV9ImportOrigin;
  url: string;
  paste: string;
}

export interface SourceV9ImportSave {
  strategy: SourceV9GroupStrategy;
  target?: SourceImportGroupTarget;
  subscriptionName?: string;
  subscriptionUrl?: string;
}

export interface SourceV9CheckOptions {
  mode: SourceV9Mode;
  depth: SourceV9Depth;
  keyword: string;
}

export interface SourceV9TransferItemResult {
  index: number;
  name: string;
  outcome: string;
}
export interface SourceV9ImportResult {
  addedCount: number;
  updatedCount: number;
  unsupportedCount: number;
  invalidCount: number;
  failedCount: number;
  details: SourceV9TransferItemResult[];
}
export interface SourceV9ConfirmedImport {
  sourceIds: string[];
  result: SourceV9ImportResult;
}
interface SourceV9PendingImport {
  operationId: string;
  plan: SourceGroupedImportPlan;
  rows: SourceV9ImportRow[];
  save: SourceV9ImportSave;
}
export interface SourceV9SubscriptionReview {
  subscription: ManagedRuleSubscription;
  sourcePlan?: RuleSourceSubscriptionPreview;
  remoteDocument?: string;
  ruleBaseline?: string;
  rows: SourceV9Change[];
}
export interface SourceV9TransferSnapshot {
  importStep: 1 | 2 | 3;
  fileName: string;
  rows: SourceV9ImportRow[];
  importResult?: SourceV9ImportResult;
  groups: SourceGroupRecord[];
  groupRevision?: number;
  knownSourceIds: string[];
  subscriptions: ManagedRuleSubscription[];
  reviews: SourceV9SubscriptionReview[];
  busy: boolean;
  runningCheck: boolean;
  completedChecks: number;
  totalChecks: number;
  checkFailures: number;
  checkingName: string;
  checkingStage: string;
  unavailableChecks: number;
  checkSupported: boolean;
  checkIssue: string;
  error: string;
  writePending: boolean;
  pendingGeneration: number;
  canContinueOriginal: boolean;
  status: string;
}

interface SourceV9RuleRow { id: number; body: JsonObject; }

export const EMPTY_SOURCE_V9_TRANSFER: SourceV9TransferSnapshot = {
  importStep: 1, fileName: '', rows: [], groups: [], knownSourceIds: [], subscriptions: [], reviews: [],
  busy: false, runningCheck: false, completedChecks: 0, totalChecks: 0, checkFailures: 0,
  checkingName: '', checkingStage: '', unavailableChecks: 0, checkSupported: false, checkIssue: '', error: '', writePending: false, pendingGeneration: 0, canContinueOriginal: false, status: '',
};

export function requireSourceV9OnlineUrl(value: string): string {
  const text = value.trim();
  const invalid = '请输入有效的公网 HTTP 或 HTTPS 链接';
  const authority = /^https?:\/\/[^/?#]+/i.exec(text);
  if (authority === null || authority[0].includes('@') || /[\s\\]/.test(text)) throw new Error(invalid);
  let parsed: url.URL;
  try { parsed = url.URL.parseURL(text); } catch (_) { throw new Error(invalid); }
  if (parsed.hostname.length === 0 || isPrivateNetworkTarget(parsed.hostname)) throw new Error(invalid);
  return text;
}

export class SourceV9TransferOwner {
  private readonly gateway: SourceGateway;
  private readonly rules: RulesManagementGateway;
  private snapshot: SourceV9TransferSnapshot = EMPTY_SOURCE_V9_TRANSFER;
  private fileText: string = '';
  private generation: number = 0;
  private checkEpoch: number = 0;
  private acceptedImportUrl: string = '';
  private disposed: boolean = false;
  private pendingImport: SourceV9PendingImport | undefined = undefined;

  constructor(private readonly runtime: ReaderRuntimeOwner,
    private readonly emit: (state: SourceV9TransferSnapshot) => void,
    private readonly inputAllowed: () => boolean,
    private readonly readBack: (reports: SourceV9ImportedReport[], imported?: SourceV9ConfirmedImport) => void) {
    this.gateway = new SourceGateway(runtime);
    this.rules = new RulesManagementGateway(runtime);
    this.rules.observeWrites(undefined, (): boolean => this.current(this.generation) && this.inputAllowed());
    this.patch({ checkSupported: this.gateway.supportsEphemeralSourceCheck() });
    this.refreshPending();
  }

  private current(generation: number): boolean {
    return !this.disposed && this.generation === generation && ReaderRuntimeOwner.isCurrent(this.runtime);
  }

  private canStart(): boolean {
    return this.current(this.generation) && this.inputAllowed() && !this.snapshot.busy && !this.snapshot.runningCheck;
  }

  private patch(patch: Partial<SourceV9TransferSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch };
    this.emit(this.snapshot);
  }

  private async operation(work: (current: () => boolean) => Promise<void>): Promise<void> {
    if (!this.canStart()) return;
    const generation = ++this.generation;
    const current = (): boolean => this.current(generation);
    this.patch({ busy: true, error: '', status: '' });
    try { await work(current); } catch (error) {
      if (current()) this.publishOperationError(errorMessageOf(error));
    } finally {
      if (current()) { this.refreshPending(); this.patch({ busy: false }); }
    }
  }

  private publishOperationError(error: string): void {
    this.patch({ error });
    this.refreshPending();
  }

  private refreshPending(): void {
    const pending = this.rules.mutationSnapshot();
    this.patch({ writePending: pending.blocked, pendingGeneration: pending.generation,
      canContinueOriginal: pending.canRetryOriginal });
  }

  retire(): void {
    this.disposed = true;
    this.generation++;
    this.checkEpoch++;
  }

  resetImport(): void {
    if (!this.canStart()) return;
    this.fileText = '';
    this.acceptedImportUrl = '';
    this.patch({ importStep: 1, fileName: '', rows: [], importResult: undefined,
      checkingName: '', completedChecks: 0, totalChecks: 0, checkFailures: 0, unavailableChecks: 0, checkingStage: '', checkIssue: '', error: '', status: '' });
  }

  backToImportSource(): boolean {
    if (this.snapshot.busy) return true;
    if (this.snapshot.importStep !== 2) return false;
    this.stopChecks();
    this.patch({ importStep: 1, rows: [], error: '', checkIssue: '', completedChecks: 0,
      totalChecks: 0, checkFailures: 0, unavailableChecks: 0, checkingName: '', checkingStage: '' });
    return true;
  }

  closeReviews(): void {
    if (this.snapshot.busy) return;
    this.stopChecks();
    this.patch({ reviews: [], error: '', checkIssue: '', completedChecks: 0, totalChecks: 0,
      checkFailures: 0, unavailableChecks: 0, checkingName: '', checkingStage: '' });
  }

  loadSubscriptions(): Promise<void> {
    return this.operation(async (current: () => boolean): Promise<void> => {
      await this.readSubscriptions(current);
    });
  }

  private async readSubscriptions(current: () => boolean): Promise<void> {
    const rows = await this.rules.listRuleSubscriptions(current);
    if (current()) this.patch({ subscriptions: rows.filter((row: ManagedRuleSubscription): boolean => row.type === 0 || row.type === 2) });
  }

  chooseFile(): Promise<void> {
    return this.operation(async (current: () => boolean): Promise<void> => {
      const selection = await this.runtime.selectBookSourceJson();
      if (!current() || selection === undefined) return;
      this.fileText = selection.text;
      this.patch({ fileName: selection.fileName });
    });
  }

  parseImport(draft: SourceV9ImportDraft): Promise<void> {
    return this.operation(async (current: () => boolean): Promise<void> => {
      let text = draft.paste;
      let onlineUrl = '';
      if (draft.origin === 'file') text = this.fileText;
      if (draft.origin === 'url') {
        onlineUrl = requireSourceV9OnlineUrl(draft.url);
        text = (await this.runtime.loadOnlineJsonDocument(onlineUrl)).text;
      }
      if (!current()) return;
      if (!text.trim()) throw new Error('请选择文件或提供书源 JSON');
      const prepared = this.gateway.prepareGroupedSourceDocument(text);
      const catalog = await this.gateway.loadSourceGroupCatalog(current);
      if (!current()) return;
      this.acceptedImportUrl = onlineUrl;
      this.patch({ importStep: 2, rows: buildV9ImportRows(prepared.items, prepared.failures),
        groups: catalog.groups, groupRevision: catalog.revision, knownSourceIds: catalog.memberships.map((row: SourceGroupMembership): string => row.sourceId),
        checkIssue: this.gateway.supportsEphemeralSourceCheck() ? '' : '当前 Core 不支持导入前可用性检测，可跳过检测后导入' });
    });
  }

  chooseImportRow(index: number, selected: boolean): void {
    if (this.canStart()) this.patch({ rows: chooseV9ImportRow(this.snapshot.rows, index, selected) });
  }

  chooseImportRows(selected: boolean, passedOnly: boolean = false): void {
    if (this.canStart()) this.patch({ rows: assignV9ImportSelection(this.snapshot.rows, selected, passedOnly) });
  }

  stopChecks(): void {
    this.checkEpoch++;
    if (this.snapshot.runningCheck) {
      this.patch({ runningCheck: false, checkingName: '', checkingStage: '', status: '检测已停止，已完成的报告已保留' });
    }
  }

  checkImport(options: SourceV9CheckOptions): Promise<void> {
    const selected = sourceV9SelectedImportRows(this.snapshot.rows);
    return this.check(selected, options, (item: SourceImportCandidate): JsonObject => item.bookSource,
      (item: SourceImportCandidate): string => item.name,
      (item: SourceImportCandidate, result: SourceCheckOutcome): void => {
        this.patch({ rows: applyV9ImportReport(this.snapshot.rows, item.index, result, Date.now()) });
      });
  }

  private async check<T>(items: T[], options: SourceV9CheckOptions,
    raw: (item: T) => JsonObject, label: (item: T) => string,
    accept: (item: T, report: SourceCheckOutcome) => void): Promise<void> {
    if (!this.canStart() || items.length === 0) return;
    if (!this.gateway.supportsEphemeralSourceCheck()) {
      this.patch({ checkIssue: '当前 Core 不支持临时书源检测，可跳过检测' });
      return;
    }
    const generation = this.generation;
    const epoch = ++this.checkEpoch;
    const current = (): boolean => this.current(generation) && this.checkEpoch === epoch;
    this.patch({ runningCheck: true, checkIssue: '', error: '', status: '', completedChecks: 0,
      totalChecks: items.length, checkFailures: 0, unavailableChecks: 0, checkingName: '', checkingStage: '' });
    await runV9CandidateChecks(items, current, async (item: T): Promise<SourceCheckOutcome> => {
      const reports = await this.gateway.checkEphemeralSources([raw(item)], current, options.keyword,
        options.mode, sourceV9Levels(options.depth), undefined, (stage: string): void => {
          if (current()) this.patch({ checkingStage: stage });
        });
      if (reports.length !== 1) throw new Error('Core 返回的临时检测报告数量不匹配');
      return reports[0];
    }, (item: T): void => this.patch({ checkingName: label(item), checkingStage: '' }),
    (item: T, report: SourceCheckOutcome): void => {
      accept(item, report);
      this.patch({ completedChecks: this.snapshot.completedChecks + 1,
        checkFailures: this.snapshot.checkFailures + (report.available ? 0 : 1) });
    }, (_item: T): void => this.patch({ completedChecks: this.snapshot.completedChecks + 1,
      unavailableChecks: this.snapshot.unavailableChecks + 1, checkIssue: '部分书源未取得 Core 检测报告' }));
    if (current()) this.patch({ runningCheck: false, checkingName: '', checkingStage: '' });
  }

  importSelected(save: SourceV9ImportSave): Promise<void> {
    if (this.snapshot.importStep !== 2 || this.snapshot.writePending) return Promise.resolve();
    return this.operation(async (current: () => boolean): Promise<void> => {
      const revision = this.snapshot.groupRevision;
      const rows = this.snapshot.rows;
      const selected = sourceV9SelectedImportRows(rows);
      if (selected.length === 0 || revision === undefined) return;
      let result: SourceGroupedImportOutcome;
      let recoveryPlan: SourceGroupedImportPlan | undefined = undefined;
      try {
        result = await this.gateway.importGroupedSources(selected, revision, save.strategy, save.target, current,
          (plan: SourceGroupedImportPlan): void => { recoveryPlan = plan; });
      } catch (error) {
        if (current()) {
          this.keepPendingImport(recoveryPlan, rows, save);
          if (!this.rules.mutationSnapshot().blocked) await this.refreshImportCatalog(current);
        }
        throw error;
      }
      if (!current()) return;
      if (this.keepPendingImport(recoveryPlan, rows, save)) {
        throw new Error('书源写入已确认，请先核对原操作记录');
      }
      await this.finishImport(result, rows, save, this.snapshot.knownSourceIds, current);
    });
  }

  private keepPendingImport(plan: SourceGroupedImportPlan | undefined,
    rows: SourceV9ImportRow[], save: SourceV9ImportSave): boolean {
    if (plan === undefined) return false;
    const pending = this.rules.mutationSnapshot();
    if (!pending.blocked || pending.operationId === undefined || pending.original?.method !== 'source.import.grouped' ||
      sourceV9CanonicalDocument(pending.original.params) !== sourceV9CanonicalDocument(plan.params)) return false;
    this.pendingImport = { operationId: pending.operationId, plan, rows, save };
    return true;
  }

  private async refreshImportCatalog(current: () => boolean): Promise<void> {
    try {
      const catalog = await this.gateway.loadSourceGroupCatalog(current);
      if (current()) this.patch({ groups: catalog.groups, groupRevision: catalog.revision,
        knownSourceIds: catalog.memberships.map((row: SourceGroupMembership): string => row.sourceId) });
    } catch (_) { /* Preserve the original failure and do not infer a revision. */ }
  }

  private async finishImport(result: SourceGroupedImportOutcome, rows: SourceV9ImportRow[],
    save: SourceV9ImportSave, existingSourceIds: string[], current: () => boolean): Promise<void> {
    const selected = sourceV9SelectedImportRows(rows);
    const existing = new Set(existingSourceIds);
    const details: SourceV9TransferItemResult[] = selected.map((item: SourceImportCandidate): SourceV9TransferItemResult => {
      const receipt = result.results.find((row: SourceGroupedImportRow): boolean => row.index === item.index);
      const rejected = result.failures.find((failure: SourceImportFailure): boolean => failure.index === item.index);
      return { index: item.index, name: item.name, outcome: receipt?.status === 'imported' ?
        (existing.has(item.sourceId) ? '更新' : '新增') : (rejected?.message ?? '导入失败') };
    });
    const summary: SourceV9ImportResult = { addedCount: result.addedCount, updatedCount: result.updatedCount,
      failedCount: result.failedCount, unsupportedCount: rows.filter((row: SourceV9ImportRow): boolean => row.candidate?.supported === false).length,
      invalidCount: rows.filter((row: SourceV9ImportRow): boolean => row.problem !== undefined).length, details };
    if (!current()) return;
    this.pendingImport = undefined;
    this.patch({ importResult: summary, importStep: 3 });
    const reports = await this.qualifyTransferredReports(sourceV9ImportedReports(rows, result.sourceIds), current);
    if (!current()) return;
    this.readBack(reports, { sourceIds: result.sourceIds, result: summary });
    if (result.sourceIds.length > 0 && save.subscriptionUrl !== undefined &&
      save.subscriptionUrl === this.acceptedImportUrl && current()) {
      let subscription: ManagedRuleSubscription;
      try {
        subscription = await this.rules.saveRuleSubscription({ name: save.subscriptionName?.trim() || '在线书源订阅',
          url: save.subscriptionUrl, type: 0, customOrder: 0, autoUpdate: true });
      } catch (_) {
        if (current()) this.publishOperationError('书源已导入，订阅保存未确认');
        return;
      }
      if (!current()) return;
      this.patch({ status: '已保存为书源订阅' });
      await this.captureImportedSubscriptionBaseline(subscription, selected, result.sourceIds, current);
    }
  }

  private async captureImportedSubscriptionBaseline(subscription: ManagedRuleSubscription, selected: SourceImportCandidate[],
    sourceIds: string[], current: () => boolean): Promise<void> {
    try {
      const imported = new Set(sourceIds);
      const document = JSON.stringify(selected.filter((row: SourceImportCandidate): boolean => imported.has(row.sourceId))
        .map((row: SourceImportCandidate): JsonObject => row.bookSource));
      const expected = await this.rules.captureSourceSubscription(subscription, current);
      const plan = await this.rules.previewSourceSubscription(subscription.id, document, expected, current);
      if (!current()) return;
      const matched = plan.changes.filter((change: RuleSourceChange): boolean =>
        imported.has(change.sourceId) && change.kind === 'unchanged').length;
      // Core only records unchanged fingerprints in an empty selection.
      if (matched > 0) await this.rules.applySourceSubscription(plan, [], current);
      if (current() && matched !== imported.size) this.publishOperationError('部分已导入书源的订阅基线未确认');
    } catch (_) {
      if (current()) this.publishOperationError('已导入书源的订阅基线未确认');
    }
  }

  private async qualifyTransferredReports(reports: SourceV9ImportedReport[],
    current: () => boolean): Promise<SourceV9ImportedReport[]> {
    const verified: SourceV9ImportedReport[] = [];
    for (const report of reports) {
      if (!current()) return verified;
      if (report.report.sourceId !== report.sourceId) continue;
      try {
        const stored = await this.gateway.readSourceDefinition(report.sourceId, current);
        if (stored?.hasRawBookSource === true && stored.sourceVersion !== undefined &&
          sourceV9CanonicalDocument(JSON.parse(stored.text)) === sourceV9CanonicalDocument(report.candidate)) {
          verified.push({ ...report, sourceVersion: stored.sourceVersion });
        }
      } catch (_) { /* Matching the original rule digest still requires a current Core readback. */ }
    }
    return verified;
  }

  saveSubscription(draft: RuleSubscriptionDraft): Promise<void> {
    return this.operation(async (current: () => boolean): Promise<void> => {
      const url = requireSourceV9OnlineUrl(draft.url);
      await this.rules.saveRuleSubscription({ ...draft, url });
      if (!current()) return;
      this.patch({ status: '订阅已保存' });
      await this.readSubscriptions(current);
    });
  }

  deleteSubscription(id: number): Promise<void> {
    return this.operation(async (current: () => boolean): Promise<void> => {
      await this.rules.deleteRuleSubscription(id);
      if (!current()) return;
      this.patch({ status: '订阅已删除' });
      await this.readSubscriptions(current);
    });
  }

  previewSubscriptions(ids: number[]): Promise<void> {
    return this.operation(async (current: () => boolean): Promise<void> => {
      const subs = this.snapshot.subscriptions.filter((item: ManagedRuleSubscription): boolean =>
        item.autoUpdate && ids.includes(item.id));
      const reviews: SourceV9SubscriptionReview[] = [];
      const failures: string[] = [];
      for (const subscription of subs) {
        if (!current()) return;
        try {
          reviews.push(await this.previewSubscription(subscription, current));
        } catch (_) {
          if (!current()) return;
          failures.push(subscription.name);
        }
      }
      if (current()) this.patch({ reviews, status: reviews.length > 0 ? '' : '没有可展示的订阅差异',
        error: failures.length > 0 ? `未能检查订阅 · ${failures.join('、')}` : '' });
    });
  }

  private async previewSubscription(subscription: ManagedRuleSubscription,
    current: () => boolean): Promise<SourceV9SubscriptionReview> {
    const provider = requireSourceV9OnlineUrl(subscription.url);
    if (subscription.type === 2) {
      const stored = await this.storedReplaceRules(current);
      if (!current()) throw new Error('订阅检查已取消');
      const document = (await this.runtime.loadOnlineJsonDocument(provider)).text;
      const remote = this.decodeRuleRows(JSON.parse(document));
      const local = new Map(stored.map((row: SourceV9RuleRow): [number, JsonObject] => [row.id, row.body]));
      const rows = remote.map((row: SourceV9RuleRow): SourceV9Change => {
        const previous = local.get(row.id);
        const identical = previous !== undefined && sourceV9ReplaceRuleComparable(previous) === sourceV9ReplaceRuleComparable(row.body);
        return { key: `${subscription.id}:rule:${row.id}`, name: row.body['name'] as string,
          kind: previous === undefined ? 'added' : identical ? 'unchanged' : 'conflict',
          selectable: !identical, selected: previous === undefined, overwrite: false, rule: row.body };
      });
      return { subscription, rows, ruleBaseline: sourceV9CanonicalDocument(stored) };
    }

    const expected = await this.rules.captureSourceSubscription(subscription, current);
    const conditionalOverwrite = this.runtime.supportsCoreCapability('source.import.conditional.v1');
    const sourcesBefore = conditionalOverwrite ? await this.gateway.loadSources(undefined, false, current) : [];
    if (!current()) throw new Error('订阅检查已取消');
    const document = (await this.runtime.loadOnlineJsonDocument(provider)).text;
    if (!current()) throw new Error('订阅检查已取消');
    const parsed: unknown = JSON.parse(document);
    const prepared = Array.isArray(parsed) && parsed.length === 0 ?
      { items: [], failures: [], filteredUnsupportedCount: 0 } as SourceGroupedImportPreview :
      this.gateway.prepareGroupedSourceDocument(document);
    const supported = prepared.items.filter((item: SourceImportCandidate): boolean => item.supported);
    if (supported.length === 0 && prepared.items.length + prepared.failures.length > 0) {
      throw new Error('订阅文档没有受支持的书源');
    }
    const remote = JSON.stringify(supported.map((item: SourceImportCandidate): JsonObject => item.bookSource));
    const plan = await this.rules.previewSourceSubscription(subscription.id, remote, expected, current);
    const candidates = new Map(supported.map((item: SourceImportCandidate): [string, JsonObject] =>
      [item.sourceId, item.bookSource]));
    const versions = new Map(sourcesBefore.map((row: BookSource): [string, string | undefined] => [row.sourceId, row.sourceVersion]));
    const rows = plan.changes.map((change): SourceV9Change => {
      const candidate = candidates.get(change.sourceId);
      const expectedVersion = versions.get(change.sourceId);
      const normalApply = change.kind === 'added' || change.kind === 'update';
      const overwriteSupported = change.kind === 'conflict' && expectedVersion !== undefined &&
        /^[a-f0-9]{64}$/.test(expectedVersion);
      return { key: `${subscription.id}:${change.sourceId}`, name: change.name, kind: change.kind,
        candidate, sourceId: change.sourceId, expectedVersion, overwrite: false,
        selectable: candidate !== undefined && (normalApply || overwriteSupported),
        selected: candidate !== undefined && normalApply };
    });
    const skipped = prepared.filteredUnsupportedCount + prepared.failures.length;
    if (current() && skipped > 0) this.patch({ checkIssue: `订阅文档已过滤 ${skipped} 项不支持或无效的书源` });
    return { subscription, sourcePlan: plan, remoteDocument: remote, rows };
  }

  private async storedReplaceRules(current: () => boolean): Promise<SourceV9RuleRow[]> {
    const bundle = await this.rules.exportBundle(current);
    const parsed = JSON.parse(bundle.json) as JsonObject;
    return this.decodeRuleRows(parsed['replaceRules']);
  }

  private decodeRuleRows(document: unknown): SourceV9RuleRow[] {
    const items: unknown[] = Array.isArray(document) ? document : [document];
    const found = new Set<number>();
    return items.map((item: unknown): SourceV9RuleRow => {
      if (item === null || typeof item !== 'object' || Array.isArray(item)) throw new Error('净化规则文档包含无效条目');
      const row = item as JsonObject;
      const id = row['id'];
      const name = row['name'];
      if (typeof id !== 'number' || !Number.isSafeInteger(id) || found.has(id) ||
        typeof name !== 'string' || !name.trim()) throw new Error('净化规则文档包含重复或无效身份');
      found.add(id);
      return { id, body: row };
    });
  }

  selectReviewRow(key: string, selected: boolean): void {
    if (!this.canStart()) return;
    this.updateReviewRow(key, (row: SourceV9Change): SourceV9Change => {
      if (!row.selectable || row.kind === 'conflict' && !row.overwrite) return row;
      return { ...row, selected };
    });
  }

  resolveReviewConflict(key: string, overwrite: boolean): void {
    if (!this.canStart()) return;
    this.updateReviewRow(key, (row: SourceV9Change): SourceV9Change =>
      row.kind === 'conflict' && row.selectable ? { ...row, overwrite, selected: overwrite } : row);
  }

  private updateReviewRow(key: string, apply: (row: SourceV9Change) => SourceV9Change): void {
    this.patch({ reviews: this.snapshot.reviews.map((review: SourceV9SubscriptionReview): SourceV9SubscriptionReview => ({
      ...review, rows: review.rows.map((row: SourceV9Change): SourceV9Change => row.key === key ? apply(row) : row),
    })) });
  }

  choosePassingReviewRows(): void {
    if (!this.canStart()) return;
    this.patch({ reviews: this.snapshot.reviews.map((review: SourceV9SubscriptionReview): SourceV9SubscriptionReview => ({
      ...review, rows: review.rows.map((row: SourceV9Change): SourceV9Change => ({
        ...row, selected: row.rule !== undefined ? row.selected :
          row.selectable && row.report?.available === true && (row.kind !== 'conflict' || row.overwrite),
      })),
    })) });
  }

  checkReviews(options: SourceV9CheckOptions): Promise<void> {
    const rows: SourceV9Change[] = [];
    for (const review of this.snapshot.reviews) {
      rows.push(...review.rows.filter((row: SourceV9Change): boolean =>
        row.candidate !== undefined && row.kind !== 'removedRemote' && row.kind !== 'unchanged' && row.kind !== 'localOnly'));
    }
    return this.check(rows, options, (row: SourceV9Change): JsonObject => row.candidate as JsonObject,
      (row: SourceV9Change): string => row.name,
      (row: SourceV9Change, report: SourceCheckOutcome): void =>
        this.updateReviewRow(row.key, (current: SourceV9Change): SourceV9Change =>
          ({ ...current, report, observedAtMs: Date.now(), selected: current.selected && report.available })));
  }

  applyReviews(): Promise<void> {
    return this.operation(async (current: () => boolean): Promise<void> => {
      let appliedCount = 0;
      const failures: string[] = [];
      const reports: SourceV9ImportedReport[] = [];
      const reviews = this.snapshot.reviews;
      if (reviews.some((review: SourceV9SubscriptionReview): boolean =>
        review.sourcePlan !== undefined && review.sourcePlan.expiresAt <= Date.now() &&
        sourceV9ChangesToApply(review.rows).length > 0)) {
        this.patch({ error: '订阅预览已过期，请保留当前明细并重新检查更新' });
        return;
      }
      // A settled or uncertain plan must be checked afresh before reapplying it.
      this.patch({ reviews: [] });
      for (const review of reviews) {
        if (!current()) return;
        const chosen = sourceV9ChangesToApply(review.rows);
        if (chosen.length === 0) continue;
        try {
          if (review.sourcePlan === undefined) {
            const rules = chosen.map((row: SourceV9Change): JsonObject => row.rule as JsonObject);
            await this.rules.refreshSubscription(review.subscription, JSON.stringify(rules), undefined, current,
              (count: number): void => { appliedCount += count; }, async (): Promise<void> => {
                const subscriptions = await this.rules.listRuleSubscriptions(current);
                const latest = subscriptions.find((row: ManagedRuleSubscription): boolean => row.id === review.subscription.id);
                const stored = await this.storedReplaceRules(current);
                if (!current() || sourceV9CanonicalDocument(latest) !== sourceV9CanonicalDocument(review.subscription) ||
                  sourceV9CanonicalDocument(stored) !== review.ruleBaseline) {
                  throw new Error('订阅或净化规则已变化，请重新检查');
                }
              });
            continue;
          }
          const normal = chosen.filter((row: SourceV9Change): boolean => row.kind !== 'conflict')
            .map((row: SourceV9Change): string => row.sourceId as string);
          const conflicts = chosen.filter((row: SourceV9Change): boolean => row.kind === 'conflict');
          if (normal.length === 0) await this.readReviewSubscription(review.subscription, true, current);
          const applied = normal.length > 0 ? await this.rules.applySourceSubscription(review.sourcePlan, normal, current) : [];
          appliedCount += applied.length;
          for (const row of chosen) {
            if (row.sourceId !== undefined && applied.includes(row.sourceId)) this.collectReviewReport(row, reports);
          }
          const overwritten: string[] = [];
          for (const row of conflicts) {
            if (!current()) return;
            if (row.expectedVersion === undefined || row.sourceId === undefined || row.candidate === undefined) continue;
            try {
              await this.gateway.overwriteSubscriptionSource(row.sourceId, row.candidate, row.expectedVersion, current);
              appliedCount++;
              overwritten.push(row.sourceId);
              this.collectReviewReport(row, reports);
            } catch (_) {
              failures.push(row.name);
              if (this.rules.mutationSnapshot().blocked) break;
            }
          }
          if (this.rules.mutationSnapshot().blocked) break;
          if (overwritten.length > 0 && current()) {
            try {
              await this.reconcileOverwriteBaseline(review, overwritten, normal.length === 0, current);
            } catch (_) {
              failures.push(review.subscription.name + '（订阅基线）');
              if (this.rules.mutationSnapshot().blocked) break;
            }
          }
        } catch (_) {
          failures.push(review.subscription.name);
          if (this.rules.mutationSnapshot().blocked) break;
        }
      }
      if (!current()) return;
      this.patch({ status: `已确认应用 ${appliedCount} 项`, writePending: this.rules.mutationSnapshot().blocked,
        error: failures.length ? `未确认全部更新 · ${failures.join('、')}` : '' });
      const transferred = await this.qualifyTransferredReports(reports, current);
      if (!current()) return;
      if (appliedCount > 0) this.readBack(transferred);
      await this.readSubscriptions(current);
    });
  }

  private async readReviewSubscription(original: ManagedRuleSubscription, requireOriginalUpdate: boolean,
    current: () => boolean): Promise<ManagedRuleSubscription> {
    const subscriptions = await this.rules.listRuleSubscriptions(current);
    const now = subscriptions.find((row: ManagedRuleSubscription): boolean => row.id === original.id);
    if (!current() || now === undefined || (requireOriginalUpdate && now.update !== original.update) ||
      sourceV9CanonicalDocument({ ...now, update: original.update }) !== sourceV9CanonicalDocument(original)) {
      throw new Error('订阅身份已变化，请重新检查');
    }
    return now;
  }

  private async reconcileOverwriteBaseline(review: SourceV9SubscriptionReview, overwritten: string[],
    requireOriginalUpdate: boolean, current: () => boolean): Promise<void> {
    const document = review.remoteDocument;
    if (document === undefined || review.sourcePlan === undefined) throw new Error('订阅预览缺少原文档');
    const latest = await this.readReviewSubscription(review.subscription, requireOriginalUpdate, current);
    const expected = await this.rules.captureSourceSubscription(latest, current);
    const refreshed = await this.rules.previewSourceSubscription(latest.id, document, expected, current);
    if (!current() || refreshed.remoteDigest !== review.sourcePlan.remoteDigest ||
      !overwritten.every((id: string): boolean =>
        refreshed.changes.some((change: RuleSourceChange): boolean => change.sourceId === id && change.kind === 'unchanged'))) {
      throw new Error('Core 未能确认已覆盖书源与订阅原文档一致');
    }
    // Unchanged fingerprints join the Core baseline without another source write.
    await this.rules.applySourceSubscription(refreshed, [], current);
  }

  private collectReviewReport(row: SourceV9Change, reports: SourceV9ImportedReport[]): void {
    if (row.sourceId !== undefined && row.candidate !== undefined && row.report?.sourceId === row.sourceId) {
      reports.push({ sourceId: row.sourceId, candidate: row.candidate, report: row.report, observedAtMs: row.observedAtMs });
    }
  }

  recoverPending(expected: number, retry: boolean): Promise<void> {
    return this.operation(async (current: () => boolean): Promise<void> => {
      const original = this.rules.mutationSnapshot();
      if (!original.blocked || original.generation !== expected || (retry && !original.canRetryOriginal)) return;
      const method = original.method;
      const captured = this.pendingImport;
      if (method === 'source.import.grouped' && captured !== undefined && captured.operationId === original.operationId) {
        const result = await this.gateway.recoverOriginalGroupedImport(captured.plan, captured.operationId, current, retry);
        if (!current()) return;
        const pending = this.rules.mutationSnapshot();
        this.patch({ status: pending.message || '原操作已核对' });
        if (pending.blocked) return;
        if (result !== undefined) {
          await this.finishImport(result, captured.rows, captured.save, captured.plan.existingSourceIds, current);
          return;
        }
        this.pendingImport = undefined;
        if (pending.confirmation !== 'undispatched') {
          this.patch({ importStep: 1, rows: [], importResult: undefined, error: '原导入结果无法显示，请核对当前书源列表' });
        } else await this.refreshImportCatalog(current);
        this.readBack([]);
        return;
      }
      if (original.subscription?.kind === 3 || method === 'source.import.grouped' ||
        method === 'source.update' || method === 'source.delete' || method === 'source.group.mutate') {
        await this.gateway.recoverOriginalSource(current, retry, original.operationId);
      } else {
        await this.rules.recoverMutation(current, retry, original.operationId);
      }
      if (!current()) return;
      const pending = this.rules.mutationSnapshot();
      this.patch({ status: pending.message || '原操作已核对' });
      if (!pending.blocked) {
        if (this.snapshot.importStep === 2) await this.refreshImportCatalog(current);
        if (!current()) return;
        this.readBack([]);
        await this.readSubscriptions(current);
      }
    });
  }
}
