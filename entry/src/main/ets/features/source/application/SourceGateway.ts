import { isReaderCoreTransactionPendingError } from '@reader/core-harmony';
import type { JsonObject } from '@reader/core-harmony';
import { errorMessageOf } from '../../../app/ErrorMessage';
import type { BookRequestOptions } from '../../../app/BookRequestScheduler';
import { httpUrlHostname, isPrivateNetworkTarget } from '../../../platform/network/HttpTransportPolicy';
import { ReaderRuntimeOwner } from '../../../app/ReaderRuntimeOwner';
import type { ReaderWriteEvidence } from '../../../app/ReaderWriteEvidence';
import type { SourceHttpDiagnosticRecord } from '../../../platform/network/HttpExecuteHost';
import { classifyReaderSource, type ReaderSourceCategory } from './ReaderSourceCategory';
import { RulesMutationOwner, type RulesMutationSnapshot } from '../../settings/application/RulesMutationOwner';
import type { RuleSubscriptionStep } from '../../settings/application/RulesMutationIntentStore';
import { ReaderUIVerificationProbe } from '../../../app/diagnostics/ReaderUIVerificationProbe';
import { sourceVerificationOfflineDetectFixture } from '../ui/SourceManagementVerification';

export type BookSource = {
  sourceId: string;
  name: string;
  baseUrl: string;
  enabled: boolean;
  enabledExplore: boolean;
  group?: string;
  sourceVersion?: string;
  /** Stable media category; novel is the only category admitted by the text reader. */
  category: ReaderSourceCategory;
  loginUrl?: string;
  loginState?: 'unknown' | 'verified' | 'expired';
  checkState?: 'unchecked' | 'checking' | 'passed' | 'failed';
  checkLevels?: string[];
  checkMessage?: string;
  checkReports?: SourceCheckHistoryEntry[];
  lastCheckSummary?: string;
  offlineDetectReportVersion?: number;
};

export type SourcePatch = {
  enabled?: boolean;
};

export type SourceImportFailure = {
  /** 0-based position of the item in the import document. */
  index: number;
  /** Best-effort Legado primary key; empty when the item had no usable URL. */
  sourceId: string;
  message: string;
};

export type SourceImportSummary = {
  importedCount: number;
  sourceIds: string[];
  failedCount: number;
  failures: SourceImportFailure[];
};

export interface SourceGroupRecord { groupId: string; name: string }
export interface SourceGroupMembership { sourceId: string; groupId: string; locallyAssigned: boolean }
export interface SourceGroupCatalogData {
  version: number; revision: number; groups: SourceGroupRecord[]; memberships: SourceGroupMembership[];
}
export type SourceGroupAction = 'create' | 'rename' | 'delete' | 'assign';
export interface SourceGroupMutateParams {
  expectedRevision: number; action: SourceGroupAction;
  groupId?: string; name?: string; targetGroupId?: string; sourceIds?: string[];
}
export interface SourceGroupMutateData {
  version: number; revision: number; action: SourceGroupAction; groupId: string; affectedSourceIds: string[];
}
export type SourceImportGroupStrategy = 'preserve' | 'fill' | 'all';
export interface SourceImportGroupTarget { groupId?: string; groupName?: string }
export interface SourceImportCandidate {
  index: number; sourceId: string; bookSource: JsonObject; name: string;
  category: ReaderSourceCategory; supported: boolean;
}
export interface SourceGroupedImportPreview {
  items: SourceImportCandidate[]; failures: SourceImportFailure[]; filteredUnsupportedCount: number;
}
export interface SourceGroupedImportRow {
  index: number; sourceId: string; status: 'imported' | 'failed';
  name?: string; groupId?: string; locallyAssigned?: boolean; error?: string;
}
export interface SourceGroupedImportPlan {
  params: JsonObject;
  items: SourceImportCandidate[];
  existingSourceIds: string[];
}
export interface SourceGroupedImportOutcome {
  revision: number; addedCount: number; updatedCount: number; failedCount: number;
  sourceIds: string[]; results: SourceGroupedImportRow[]; failures: SourceImportFailure[];
}
export interface SourceReportClearOutcome { supported: boolean; clearedCount: number; sourceIds: string[] }

export type SourceCheckOutcome = {
  sourceId: string;
  traceId: string;
  available: boolean;
  levelsPassed: string[];
  failureReason?: string;
  durationMs: number;
  hostEvidenceCount: number;
  logs: SourceDebugLog[];
  mode?: 'search' | 'explore';
  requestedLevels?: string[];
  capabilities?: SourceCapabilityCheck[];
  report?: SourceCheckReport;
  /** Ordered one-candidate Core diagnostic failed before assigning a source identity. */
  oneRowEphemeralL1Failure?: boolean;
};

export type SourceCheckReportStatus = 'pass' | 'fail' | 'not_requested' | 'not_supported' | 'blocked' | 'cancelled';

export type SourceCheckReportStep = {
  level: string;
  requested: boolean;
  executed: boolean;
  status: SourceCheckReportStatus;
  durationMs: number;
  reason?: string;
};

export type SourceCheckReport = {
  version: number;
  mode: 'legacy' | 'search' | 'explore';
  traceId: string;
  ruleDigest?: string;
  inputDigest: string;
  executionOptions?: SourceCheckExecutionOptions;
  executionOptionsDigest?: string;
  steps: SourceCheckReportStep[];
  contentKind?: string;
};

export type SourceCheckExecutionOptions = { timeoutMs: number };

export type SourceCheckHistoryEntry = {
  checkedAtMs: number;
  stale: boolean;
  report: SourceCheckReport;
};

export type SourceCapabilityCheck = {
  level: string;
  state: 'passed' | 'failed' | 'blocked' | 'notRequested' | 'notSupported' | 'cancelled';
};

export type SourceExportResult = {
  data: string;
  count: number;
  format: 'json';
};

export type SourceDeleteOutcome = {
  deletedCount: number;
  cookieCleanupFailures: number;
};

export type SourceDebugLog = {
  state: number;
  message: string;
  timestampMs: number;
  step?: string;
  extractedCount?: number;
  errorKind?: string;
  sourceId?: string;
  traceId?: string;
  requestId?: number;
  method?: string;
  url?: string;
  statusCode?: number;
  durationMs?: number;
};

export type SourceDebugOutcome = {
  logs: SourceDebugLog[];
  finalState: number;
  durationMs: number;
};

/** Source identity with stored raw JSON or a legacy export projection. */
export interface SourceDefinitionSnapshot {
  sourceId: string;
  sourceVersion?: string;
  /** True only when source.list returned the stored raw BookSource object. */
  hasRawBookSource: boolean;
  text: string;
  identity: string;
}

const MAX_BOOK_SOURCE_DOCUMENT_ENTRIES = 5000;

/**
 * Feature-local gateway for Source Management. Owns the `source.list` and
 * `source.update` boundary and validates every JSON envelope before the
 * page sees it.
 */
export class SourceGateway {
  private readonly runtimeOwner: ReaderRuntimeOwner;
  private writeEvidence: ReaderWriteEvidence | undefined;
  private editableSourceId: string = '';
  private editableDefinitionIdentity: string | undefined;
  private editableSourceVersion: string | undefined;
  private editableBookSourceUrl: string | undefined;

  observeWrites(evidence: ReaderWriteEvidence | undefined): void { this.writeEvidence = evidence; }

  constructor(runtimeOwner: ReaderRuntimeOwner = ReaderRuntimeOwner.current()) {
    this.runtimeOwner = runtimeOwner;
  }

  /** Compatibility labels for only the admitted shelf identities. Serial reads
   * avoid flooding the foreground lane; source management retains its full list. */
  async loadSourcesForIds(sourceIds: string[], isCurrent: () => boolean): Promise<BookSource[]> {
    const sources: BookSource[] = [];
    for (const sourceId of new Set(sourceIds)) {
      if (!isCurrent()) return [];
      if (sourceId.trim().length === 0 || sourceId === 'local') continue;
      try {
        const exact = await this.loadSources(sourceId, false, isCurrent);
        if (!isCurrent()) return [];
        for (const source of exact) if (source.sourceId === sourceId) sources.push(source);
      } catch (_) { /* A missing label never erases a valid shelf projection. */ }
    }
    return sources;
  }

  async loadSources(sourceId?: string, includeReports: boolean = false, current?: () => boolean): Promise<BookSource[]> {
    const params: JsonObject = sourceId === undefined ? {} : { sourceId };
    const reportVersion = !includeReports ? undefined :
      this.runtimeOwner.supportsCoreCapability('source.check.report.v2') ? 2 :
      this.runtimeOwner.supportsCoreCapability('source.check.report.v1') ? 1 : undefined;
    const wantsReports = includeReports && reportVersion !== undefined;
    if (wantsReports) {
      params['includeCheckReports'] = true;
      if (reportVersion === 2) params['checkReportVersion'] = 2;
    }
    const result = await this.runtimeOwner.request('source.list', params, { canDispatch: current, canContinue: current });
    const rawSources = result.data['sources'];
    if (!Array.isArray(rawSources)) {
      throw new Error('source.list returned invalid data');
    }
    const sources: BookSource[] = [];
    for (const raw of rawSources) {
      if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
        throw new Error('source.list returned a non-object source');
      }
      const source = raw as JsonObject;
      const sourceId = this.optionalString(source, 'sourceId');
      const name = this.optionalString(source, 'name');
      const baseUrl = this.optionalString(source, 'baseUrl');
      const rawBookSource = source['bookSource'];
      let loginUrl: string | undefined = undefined;
      let group: string | undefined = undefined;
      let bookSourceType: unknown = undefined;
      if (rawBookSource !== null && typeof rawBookSource === 'object' && !Array.isArray(rawBookSource)) {
        const bookSource = rawBookSource as JsonObject;
        loginUrl = this.optionalString(bookSource, 'loginUrl');
        const sourceGroup = this.optionalString(bookSource, 'bookSourceGroup');
        if (sourceGroup !== undefined && sourceGroup.trim().length > 0) {
          group = sourceGroup.trim();
        }
        bookSourceType = bookSource['bookSourceType'];
      }
      if (sourceId === undefined || name === undefined) {
        throw new Error('source.list returned a source without its identity or name');
      }
      const checkReports = wantsReports ? this.readCheckHistory(source['checkReports'], this.optionalString(source, 'sourceVersion'), reportVersion as number) : undefined;
      const latest = checkReports !== undefined && checkReports.length > 0 ? checkReports[0] : undefined;
      let lastCheckSummary: string | undefined = undefined;
      if (latest !== undefined) {
        const selected = latest.report.steps.filter((step: SourceCheckReportStep): boolean => step.requested);
        const levels = selected.map((step: SourceCheckReportStep): string => step.level).join('、');
        const passed = selected.every((step: SourceCheckReportStep): boolean => step.status === 'pass');
        const mode = latest.report.mode === 'explore' ? '发现' : latest.report.mode === 'search' ? '搜索' : '旧版';
        const budget = latest.report.executionOptions === undefined ? '预算未知（旧版记录）' :
          `Core 预算 ${latest.report.executionOptions.timeoutMs}ms`;
        lastCheckSummary = `${latest.stale ? '已过期' : '历史'} · ${mode} ${levels} ${passed ? '通过' : '未通过'} · ${budget} · ` +
          new Date(latest.checkedAtMs).toLocaleString();
      }
      const entry: BookSource = {
        sourceId,
        name,
        baseUrl: baseUrl ?? '',
        enabled: source['enabled'] === true,
        enabledExplore: source['enabledExplore'] === true,
        group,
        category: classifyReaderSource({ bookSourceType, name, group, sourceId, baseUrl }),
        loginUrl,
      };
      const sourceVersion = this.optionalString(source, 'sourceVersion');
      if (sourceVersion !== undefined) entry.sourceVersion = sourceVersion;
      if (sourceId === 'https://offline-detect.reader-phase1.invalid/' && ReaderUIVerificationProbe.enabled() &&
        rawBookSource !== null && typeof rawBookSource === 'object' && !Array.isArray(rawBookSource) &&
        sourceVerificationOfflineDetectFixture(entry, rawBookSource as JsonObject) &&
        this.runtimeOwner.supportsCoreCapability('source.check.mode.v1')) {
        entry.offlineDetectReportVersion = this.runtimeOwner.supportsCoreCapability('source.check.report.v2') ? 2 :
          this.runtimeOwner.supportsCoreCapability('source.check.report.v1') ? 1 : undefined;
      }
      if (checkReports !== undefined) entry.checkReports = checkReports;
      if (lastCheckSummary !== undefined) entry.lastCheckSummary = lastCheckSummary;
      // Current-rule persisted diagnostics drive the unified status filter.
      // Expired/cancelled reports do not make a source look freshly checked.
      if (latest !== undefined && !latest.stale) {
        const requested = latest.report.steps.filter((step: SourceCheckReportStep): boolean => step.requested);
        if (requested.length > 0 && requested.every((step: SourceCheckReportStep): boolean => step.status === 'pass')) entry.checkState = 'passed';
        else if (requested.some((step: SourceCheckReportStep): boolean => step.status === 'fail' || step.status === 'blocked' || step.status === 'not_supported')) entry.checkState = 'failed';
        else entry.checkState = 'unchecked';
      }
      sources.push(entry);
    }
    return sources;
  }

  /**
   * Import a Legado JSON document one source at a time through Rust Core.
   * `bookSourceUrl` is Legado's primary key, so it is forwarded verbatim as
   * Core `sourceId`; the Host must never fall back to request-id identities.
   */
  async importBookSourceDocument(
    text: string,
    shouldContinue: () => boolean = (): boolean => true,
  ): Promise<SourceImportSummary> {
    if (this.supportsOriginalSourceImport()) return this.importOriginalSourceDocument(text,shouldContinue);
    const rawSources = this.parseBookSourceDocument(text);

    // Non-abort item admission: one invalid or failing source must never
    // prevent the remaining items from importing. Each item is validated and
    // persisted independently; failures are collected on the summary so the
    // caller can report exact counts instead of a single aborting error.
    const sourceIds: string[] = [];
    const failures: SourceImportFailure[] = [];
    for (let index = 0; index < rawSources.length; index++) {
      let bookSource: JsonObject;
      let sourceId: string;
      try {
        bookSource = this.requireBookSourceObject(rawSources[index], index);
        sourceId = this.requireBookSourceUrl(bookSource, index);
      } catch (error) {
        const message = errorMessageOf(error);
        failures.push({ index, sourceId: '', message });
        continue;
      }
      this.assertImportCurrent(shouldContinue, sourceIds.length);
      try {
        const result = await this.runtimeOwner.request('source.import', {
          sourceId,
          bookSource,
        }, { canDispatch: shouldContinue, onDispatch: (): void => this.writeEvidence?.dispatched() });
        const imported = result.data['imported'];
        const echoedSourceId = this.optionalString(result.data, 'sourceId');
        const echoedName = this.optionalString(result.data, 'name');
        if (imported !== true || echoedSourceId !== sourceId || echoedName === undefined ||
          echoedName.trim().length === 0) {
          throw new Error('source.import returned invalid or mismatched data');
        }
        sourceIds.push(echoedSourceId);
        this.writeEvidence?.confirmed();
      } catch (error) {
        // An indeterminate dispatched item is a write barrier for this
        // admitted document. Later rows must not hide or overtake that ACK.
        if (this.writeEvidence?.confirmation() === 'unknown') throw error;
        const message = errorMessageOf(error);
        failures.push({ index, sourceId, message });
      }
    }
    return {
      importedCount: sourceIds.length,
      sourceIds,
      failedCount: failures.length,
      failures,
    };
  }

  originalMutationSnapshot(): RulesMutationSnapshot | undefined {
    return this.supportsOriginalSourceImport() ? RulesMutationOwner.forRuntime(this.runtimeOwner).snapshot() : undefined;
  }
  async recoverOriginalSource(current: () => boolean, retryOriginal: boolean = false,
    expectedOperationId?: string): Promise<RulesMutationSnapshot | undefined> {
    if (!this.supportsOriginalSourceImport()) return undefined;
    return RulesMutationOwner.forRuntime(this.runtimeOwner).recoverOriginal(current,
      (method: string, params: JsonObject, data: JsonObject): void => this.qualifyOriginalSource(method,params,data),
      retryOriginal,'source-management',
      (method: string, params: JsonObject): Promise<boolean> => this.finishOriginalSourceCleanup(method,params),
      expectedOperationId);
  }
  handlesSourceCleanup(): boolean { return this.supportsOriginalSourceManagement(); }
  private async finishOriginalSourceCleanup(method: string, params: JsonObject): Promise<boolean> {
    const ids=method==='source.delete' ? params['sourceIds'] as string[] : [params['sourceId'] as string];
    let complete=true;
    for (const id of ids) {
      if (!ReaderRuntimeOwner.isCurrent(this.runtimeOwner)) return false;
      try { await this.runtimeOwner.clearSourceCookieSession(id); } catch (_) { complete=false; }
    }
    return complete;
  }
  private supportsOriginalSourceImport(): boolean {
    return this.runtimeOwner.supportsCoreCapability?.('rules.mutation.exact.v1') === true;
  }
  private supportsOriginalSourceManagement(): boolean {
    return this.supportsOriginalSourceImport() &&
      this.runtimeOwner.supportsCoreCapability?.('rules.mutation.source-management.v1') === true;
  }
  private async importOriginalSourceDocument(text: string, current: () => boolean,
    identifyOriginal?: (operationId: string) => void,
    editedSource?: { sourceId: string; expectedVersion: string }): Promise<SourceImportSummary> {
    const prepared=this.prepareSubscriptionDocument(text),failures: SourceImportFailure[]=prepared.failures.slice();
    const sourceIds: string[]=[];
    if (prepared.items.length===0) return {importedCount:0,sourceIds,failedCount:failures.length,failures};
    const steps: RuleSubscriptionStep[]=prepared.items.map((item): RuleSubscriptionStep => ({
      method:'source.import',sourceIndex:item.index,params:editedSource === undefined ?
        {sourceId:item.sourceId,bookSource:item.bookSource} :
        {sourceId:editedSource.sourceId,bookSource:item.bookSource,expectedVersion:editedSource.expectedVersion} }));
    const result=await RulesMutationOwner.forRuntime(this.runtimeOwner).runSubscription(3,steps,
      prepared.failures.map((failure): {index:number;message:string} => ({index:failure.index,message:failure.message})),
      current,(method: string, params: JsonObject, data: JsonObject): void => {
        this.qualifyOriginalSource(method,params,data);sourceIds.push(data['sourceId'] as string);
      },this.writeEvidence,(step: RuleSubscriptionStep, data: JsonObject): void => {
        const error=data['error'] as JsonObject;
        failures.push({index:step.sourceIndex ?? -1,sourceId:step.params['sourceId'] as string,
          message:typeof error?.['message']==='string' ? error['message'] as string : 'Core 明确拒绝原书源条目'});
      },identifyOriginal);
    return {importedCount:result.subscription?.confirmedParts ?? 0,sourceIds,
      failedCount:result.subscription?.failedParts ?? failures.length,failures};
  }
  private qualifyOriginalSource(method: string, params: JsonObject, data: JsonObject): void {
    if (method==='source.import') {
      if (data['imported']!==true || data['sourceId']!==params['sourceId'] ||
        typeof data['name']!=='string' || (data['name'] as string).trim().length===0)
        throw new Error('source.import original ACK does not match its fixed DTO');
    } else if (method==='source.update') {
      const source=data['source'] as JsonObject;
      if (source===null || typeof source!=='object' || Array.isArray(source) ||
        source['sourceId']!==params['sourceId'] || source['enabled']!==params['enabled'])
        throw new Error('source.update original ACK does not match its fixed DTO');
    } else if (method==='source.delete') {
      const ids=params['sourceIds']; const deleted=data['deleted'];
      if (!Array.isArray(ids) || typeof deleted!=='number' || !Number.isSafeInteger(deleted) || deleted<0 || deleted>ids.length)
        throw new Error('source.delete original ACK does not match its fixed DTO');
    } else if (method==='source.group.mutate') {
      this.readGroupMutation(params, data);
    } else if (method==='source.import.grouped') {
      this.readGroupedImport(params, data);
    } else throw new Error('不能用书源核定器确认另一家族的原操作');
  }

  async loadSourceGroupCatalog(current?: () => boolean): Promise<SourceGroupCatalogData> {
    if (!this.runtimeOwner.supportsCoreCapability('source.group.metadata.v1')) {
      throw new Error('当前 Core 不支持书源分组目录');
    }
    const event = await this.runtimeOwner.request('source.group.catalog', { reportVersion: 1 }, {
      canDispatch: current, canContinue: current,
    });
    const data = event.data;
    const revision = data['revision'];
    const groups: SourceGroupRecord[] = [];
    const memberships: SourceGroupMembership[] = [];
    if (data['version'] !== 1 || !this.isCount(revision) ||
      !Array.isArray(data['groups']) || !Array.isArray(data['memberships'])) {
      throw new Error('书源分组目录结构无效');
    }
    const groupIds = new Set<string>();
    const groupNames = new Set<string>();
    for (const value of data['groups']) {
      const group = this.requireObject(value, '书源分组');
      const groupId = this.optionalString(group, 'groupId');
      const name = this.optionalString(group, 'name');
      if (groupId === undefined || groupId.trim().length === 0 || groupId === '*' ||
        name === undefined || name.length === 0 || name.trim() !== name ||
        groupIds.has(groupId) || groupNames.has(name)) throw new Error('书源分组身份无效或重复');
      groupIds.add(groupId);
      groupNames.add(name);
      groups.push({ groupId, name });
    }
    const sourceIds = new Set<string>();
    for (const value of data['memberships']) {
      const membership = this.requireObject(value, '书源分组成员');
      const sourceId = this.optionalString(membership, 'sourceId');
      const groupId = this.optionalString(membership, 'groupId');
      const locallyAssigned = membership['locallyAssigned'];
      if (sourceId === undefined || sourceId.trim().length === 0 || sourceIds.has(sourceId) ||
        groupId === undefined || (groupId !== '' && !groupIds.has(groupId)) ||
        typeof locallyAssigned !== 'boolean') throw new Error('书源分组成员身份无效或重复');
      sourceIds.add(sourceId);
      memberships.push({ sourceId, groupId, locallyAssigned });
    }
    return { version: 1, revision: revision as number, groups, memberships };
  }

  async mutateSourceGroup(input: SourceGroupMutateParams, current?: () => boolean): Promise<SourceGroupMutateData> {
    if (!this.runtimeOwner.supportsCoreCapability('rules.mutation.source-groups.v1')) {
      throw new Error('当前 Core 不支持书源分组写入');
    }
    const params: JsonObject = { expectedRevision: input.expectedRevision, action: input.action };
    if (input.groupId !== undefined) params['groupId'] = input.groupId;
    if (input.name !== undefined) params['name'] = input.name.trim();
    if (input.sourceIds !== undefined) params['sourceIds'] = input.sourceIds.slice();
    if (input.action === 'delete') params['targetGroupId'] = '';
    else if (input.targetGroupId !== undefined) params['targetGroupId'] = input.targetGroupId;
    return RulesMutationOwner.forRuntime(this.runtimeOwner).run('书源分组',
      current ?? ((): boolean => ReaderRuntimeOwner.isCurrent(this.runtimeOwner)),
      async (request, confirmed): Promise<SourceGroupMutateData> => {
        const result = this.readGroupMutation(params, (await request('source.group.mutate', params)).data);
        confirmed();
        return result;
      }, this.writeEvidence);
  }

  prepareGroupedSourceDocument(text: string): SourceGroupedImportPreview {
    const raw = this.parseBookSourceDocument(text);
    const items: SourceImportCandidate[] = [];
    const failures: SourceImportFailure[] = [];
    let filteredUnsupportedCount = 0;
    for (let index = 0; index < raw.length; index += 1) {
      try {
        const item = this.prepareImportCandidate(raw[index], index);
        items.push(item);
        if (!item.supported) filteredUnsupportedCount += 1;
      } catch (error) {
        failures.push({ index, sourceId: '', message: errorMessageOf(error) });
      }
    }
    return { items, failures, filteredUnsupportedCount };
  }

  async importGroupedSources(items: SourceImportCandidate[], expectedRevision: number, strategy: SourceImportGroupStrategy,
    target?: SourceImportGroupTarget, current?: () => boolean, keepPlan?: (plan: SourceGroupedImportPlan) => void): Promise<SourceGroupedImportOutcome> {
    if (!this.runtimeOwner.supportsCoreCapability('rules.mutation.source-groups.v1')) {
      throw new Error('当前 Core 不支持分组导入');
    }
    // Re-admit the original DTO at the write boundary. UI selection or a prior
    // diagnostics result cannot give an unsupported media type write access.
    const selected = items.filter((item: SourceImportCandidate): boolean => item.supported)
      .map((item: SourceImportCandidate): SourceImportCandidate => {
        const candidate = this.prepareImportCandidate(item.bookSource, item.index);
        if (item.sourceId !== candidate.sourceId || !candidate.supported) throw new Error('书源预检已经变化');
        return candidate;
      });
    if (selected.length === 0) throw new Error('请选择可导入的小说或漫画书源');
    if (selected.length > MAX_BOOK_SOURCE_DOCUMENT_ENTRIES) throw new Error('选中书源超出文档条数上限');
    const catalog = await this.loadSourceGroupCatalog(current);
    if (catalog.revision !== expectedRevision) throw new Error('分组目录已更新，请重新核对导入预览');
    const params: JsonObject = {
      expectedRevision,
      strategy,
      items: selected.map((item: SourceImportCandidate): JsonObject =>
        ({ sourceId: item.sourceId, bookSource: item.bookSource })),
    };
    if (target?.groupId !== undefined) params['targetGroupId'] = target.groupId;
    if (target?.groupName !== undefined) params['targetGroupName'] = target.groupName.trim();
    const plan: SourceGroupedImportPlan = { params, items: selected,
      existingSourceIds: catalog.memberships.map((item: SourceGroupMembership): string => item.sourceId) };
    keepPlan?.(plan);
    return RulesMutationOwner.forRuntime(this.runtimeOwner).run('分组导入书源',
      current ?? ((): boolean => ReaderRuntimeOwner.isCurrent(this.runtimeOwner)),
      async (request, confirmed): Promise<SourceGroupedImportOutcome> => {
        const data = (await request('source.import.grouped', params)).data;
        const outcome = this.groupedImportOutcome(plan, data);
        confirmed();
        return outcome;
      }, this.writeEvidence);
  }

  async recoverOriginalGroupedImport(plan: SourceGroupedImportPlan, operationId: string,
    current: () => boolean, retryOriginal: boolean): Promise<SourceGroupedImportOutcome | undefined> {
    let outcome: SourceGroupedImportOutcome | undefined = undefined;
    const owner = RulesMutationOwner.forRuntime(this.runtimeOwner);
    await owner.recoverOriginal(current, (method: string, params: JsonObject, data: JsonObject): void => {
      this.qualifyOriginalSource(method, params, data);
      outcome = this.groupedImportOutcome(plan, data);
    }, retryOriginal, 'source-management', undefined, operationId,
    (method: string): boolean => method === 'source.import.grouped');
    return owner.snapshot().confirmation === 'confirmed' ? outcome : undefined;
  }

  private groupedImportOutcome(plan: SourceGroupedImportPlan, data: JsonObject): SourceGroupedImportOutcome {
    const existing = new Set(plan.existingSourceIds);
    const results = this.readGroupedImport(plan.params, data)
      .map((row: SourceGroupedImportRow): SourceGroupedImportRow => ({ ...row, index: plan.items[row.index].index }));
    const sourceIds: string[] = [];
    const failures: SourceImportFailure[] = [];
    let addedCount = 0;
    let updatedCount = 0;
    for (const row of results) {
      if (row.status === 'imported') {
        sourceIds.push(row.sourceId);
        if (existing.has(row.sourceId)) updatedCount += 1; else addedCount += 1;
      } else {
        failures.push({ index: row.index, sourceId: row.sourceId, message: row.error as string });
      }
    }
    return { revision: data['revision'] as number, addedCount, updatedCount, failedCount: failures.length,
      sourceIds, results, failures };
  }

  async overwriteSubscriptionSource(sourceId: string, candidate: JsonObject, expectedVersion: string,
    current: () => boolean): Promise<void> {
    const prepared = this.prepareImportCandidate(candidate, 0);
    if (!prepared.supported || prepared.sourceId !== sourceId || !/^[a-f0-9]{64}$/.test(expectedVersion)) {
      throw new Error('订阅冲突书源身份或版本不匹配');
    }
    if (!this.supportsOriginalSourceImport() ||
      !this.runtimeOwner.supportsCoreCapability('source.import.conditional.v1')) {
      throw new Error('当前 Core 不支持按版本覆盖书源');
    }
    const imported = await this.importOriginalSourceDocument(JSON.stringify(candidate), current, undefined,
      { sourceId, expectedVersion });
    if (imported.importedCount !== 1) throw new Error(imported.failures[0]?.message ?? 'Core 未确认覆盖书源');
  }

  private prepareImportCandidate(value: unknown, index: number): SourceImportCandidate {
    const bookSource = this.requireBookSourceObject(value, index);
    const sourceId = this.requireBookSourceUrl(bookSource, index).trim();
    const name = this.optionalString(bookSource, 'bookSourceName')?.trim() ?? '';
    const category = classifyReaderSource({ bookSourceType: bookSource['bookSourceType'], name,
      group: this.optionalString(bookSource, 'bookSourceGroup'), sourceId, baseUrl: sourceId });
    const supported = category === 'novel' || category === 'comic';
    if (supported && name.length === 0) throw new Error(`第 ${index + 1} 项需要书源名称`);
    return { index, sourceId, bookSource, name: name.length > 0 ? name : sourceId, category, supported };
  }

  private readGroupMutation(params: JsonObject, data: JsonObject): SourceGroupMutateData {
    const revision = data['revision'];
    const groupId = this.optionalString(data, 'groupId');
    const action = params['action'] as SourceGroupAction;
    const affectedSourceIds = this.readSourceIds(data['affectedSourceIds'], '分组成员回执');
    const expectedRevision = params['expectedRevision'];
    if (data['version'] !== 1 || !this.isCount(revision) || !this.isCount(expectedRevision) ||
      revision !== (expectedRevision as number) + 1 || data['action'] !== action || groupId === undefined ||
      (action === 'assign' ? groupId !== params['targetGroupId'] : groupId.length === 0) ||
      ((action === 'delete' || action === 'rename') && groupId !== params['groupId']) ||
      ((action === 'create' || action === 'rename') && affectedSourceIds.length > 0)) {
      throw new Error('书源分组原操作回执不匹配');
    }
    if (action === 'assign') {
      const expectedIds = this.readSourceIds(params['sourceIds'], '分组成员请求');
      if (affectedSourceIds.length !== expectedIds.length ||
        expectedIds.some((id: string): boolean => !affectedSourceIds.includes(id))) {
        throw new Error('书源分组成员回执不匹配');
      }
    }
    return { version: 1, revision: revision as number, action, groupId, affectedSourceIds };
  }

  private readGroupedImport(params: JsonObject, data: JsonObject): SourceGroupedImportRow[] {
    const requestItems = params['items'];
    const rows = data['results'];
    const revision = data['revision'];
    const expectedRevision = params['expectedRevision'];
    const imported = data['importedCount'];
    const failed = data['failedCount'];
    if (data['version'] !== 1 || !Array.isArray(requestItems) || !Array.isArray(rows) ||
      rows.length !== requestItems.length || !this.isCount(imported) || !this.isCount(failed) ||
      (imported as number) + (failed as number) !== rows.length || !this.isCount(revision) || !this.isCount(expectedRevision) ||
      revision !== (expectedRevision as number) + ((imported as number) > 0 ? 1 : 0)) {
      throw new Error('分组导入回执数量或版本不匹配');
    }
    const results: SourceGroupedImportRow[] = [];
    const confirmed = new Set<string>();
    for (let index = 0; index < rows.length; index += 1) {
      const request = this.requireObject(requestItems[index], '分组导入请求条目');
      const row = this.requireObject(rows[index], '分组导入回执条目');
      const sourceId = this.optionalString(row, 'sourceId');
      const name = this.optionalString(row, 'name');
      const groupId = this.optionalString(row, 'groupId');
      const locallyAssigned = row['locallyAssigned'];
      const error = this.optionalString(row, 'error');
      if (row['index'] !== index || sourceId === undefined || sourceId !== request['sourceId']) {
        throw new Error('分组导入回执条目身份不匹配');
      }
      if (row['status'] === 'imported') {
        if (name === undefined || name.trim().length === 0 || groupId === undefined ||
          typeof locallyAssigned !== 'boolean' || error !== undefined || confirmed.has(sourceId)) {
          throw new Error('分组导入成功回执缺少确定的结果');
        }
        confirmed.add(sourceId);
        results.push({ index, sourceId, status: 'imported', name, groupId, locallyAssigned });
      } else if (row['status'] === 'failed' && error !== undefined && error.trim().length > 0) {
        results.push({ index, sourceId, status: 'failed', error });
      } else {
        throw new Error('分组导入失败回执缺少原因');
      }
    }
    if (confirmed.size !== imported) throw new Error('分组导入回执计数不一致');
    return results;
  }

  private isCount(value: unknown): boolean {
    return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
  }

  private readSourceIds(value: unknown, label: string): string[] {
    if (!Array.isArray(value)) throw new Error(`${label}结构无效`);
    const ids = new Set<string>();
    for (const id of value) {
      if (typeof id !== 'string' || id.trim().length === 0 || ids.has(id)) throw new Error(`${label}身份无效`);
      ids.add(id);
    }
    return Array.from(ids);
  }

  /** Same original admission, without side effects; subscription freezes these
   * exact DTOs before accepting its first durable operation. */
  prepareSubscriptionDocument(text: string): {
    items: { index: number; sourceId: string; bookSource: JsonObject }[];
    failures: SourceImportFailure[];
  } {
    const rawSources = this.parseBookSourceDocument(text);
    const items: { index: number; sourceId: string; bookSource: JsonObject }[] = [];
    const failures: SourceImportFailure[] = [];
    for (let index = 0; index < rawSources.length; index++) {
      try { const bookSource = this.requireBookSourceObject(rawSources[index],index);
        const sourceId = this.requireBookSourceUrl(bookSource,index);
        items.push({index,sourceId,bookSource});
      } catch (error) { failures.push({index,sourceId:'',message:errorMessageOf(error)}); }
    }
    return {items,failures};
  }
  private parseBookSourceDocument(text: string): unknown[] {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text) as unknown;
    } catch (error) {
      const message = errorMessageOf(error);
      throw new Error(`Book-source document is not valid JSON: ${message}`);
    }
    const rawSources: unknown[] = Array.isArray(parsed) ? parsed : [parsed];
    if (rawSources.length === 0) {
      throw new Error('Book-source document contains no sources');
    }
    if (rawSources.length > MAX_BOOK_SOURCE_DOCUMENT_ENTRIES) {
      throw new Error(
        `Book-source document exceeds ${MAX_BOOK_SOURCE_DOCUMENT_ENTRIES} source limit`,
      );
    }

    return rawSources;
  }

  /** Core exports stored raw BookSource objects or legacy metadata projections. */
  async exportBookSources(sourceIds?: string[], current?: () => boolean): Promise<SourceExportResult> {
    const params: JsonObject = { format: 'json' };
    if (sourceIds !== undefined) {
      if (sourceIds.length === 0) {
        throw new Error('source.export selection must not be empty');
      }
      params['sourceIds'] = sourceIds;
    }
    const result = await this.runtimeOwner.request('source.export', params, {
      canDispatch: current,
      shouldCancel: current === undefined ? undefined : (): boolean => !current(),
    });
    const data = result.data['data'];
    const count = result.data['count'];
    const format = result.data['format'];
    if (typeof data !== 'string' || typeof count !== 'number' || !Number.isSafeInteger(count) ||
      count < 0 || format !== 'json') {
      throw new Error('source.export returned invalid data');
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(data) as unknown;
    } catch (error) {
      throw new Error(`source.export returned invalid JSON: ${(error as Error).message}`);
    }
    if (!Array.isArray(parsed) || parsed.length !== count) {
      throw new Error('source.export count does not match its JSON array');
    }
    return { data, count, format: 'json' };
  }

  async loadEditableSource(sourceId: string, current?: () => boolean): Promise<string> {
    const definition = await this.readSourceDefinition(sourceId, current);
    if (definition === undefined) throw new Error('原始书源已删除，请重新选择');
    if (!definition.hasRawBookSource) {
      throw new Error('当前书源缺少可核对的完整原始 BookSource JSON，无法使用原始 JSON 编辑；现有规则与草稿已保留');
    }
    this.editableSourceId = sourceId;
    this.editableDefinitionIdentity = definition.identity;
    this.editableSourceVersion = definition.sourceVersion;
    this.editableBookSourceUrl = this.optionalString(JSON.parse(definition.text) as JsonObject, 'bookSourceUrl');
    return definition.text;
  }

  async readSourceDefinition(sourceId: string,
    admitted?: () => boolean): Promise<SourceDefinitionSnapshot | undefined> {
    const current = (): boolean => ReaderRuntimeOwner.isCurrent(this.runtimeOwner);
    const active = (): boolean => current() && (admitted?.() ?? true);
    const result = await this.runtimeOwner.request('source.list', { sourceId }, { canDispatch: active, canContinue: active });
    const rows = result.data['sources'];
    if (!Array.isArray(rows) || rows.length > 1 || (rows.length === 1 && (rows[0] === null || typeof rows[0] !== 'object' || Array.isArray(rows[0]))))
      throw new Error('原始书源读取不完整，请重试');
    if (!active()) throw new Error('原始书源身份已变化');
    if (rows.length === 0) return undefined;
    const source = rows[0] as JsonObject;
    if (source['sourceId'] !== sourceId) throw new Error('原始书源身份已变化');
    const raw = source['bookSource'];
    let text: string;
    if (raw !== undefined && raw !== null) {
      if (typeof raw !== 'object' || Array.isArray(raw)) throw new Error('原始书源 JSON 无效');
      text = JSON.stringify(raw, null, 2);
    } else {
      // Legacy diagnostics retain their export projection. V1-only sources
      // export minimal metadata, so this projection cannot admit raw editing.
      const exported = await this.exportBookSources([sourceId], active);
      const entries = JSON.parse(exported.data) as unknown[];
      if (!active() || entries.length !== 1) throw new Error('原始书源读取不完整，请重试');
      text = JSON.stringify(this.requireBookSourceObject(entries[0], 0), null, 2);
    }
    return { sourceId, sourceVersion: this.optionalString(source, 'sourceVersion'),
      hasRawBookSource: raw !== undefined && raw !== null, text,
      identity: JSON.stringify([sourceId, source['sourceVersion'] ?? null, source['name'] ?? null,
        source['baseUrl'] ?? null, source['enabled'] ?? null, source['enabledExplore'] ?? null, text]) };
  }

  /**
   * Persist an edited raw source through the existing Core import command.
   * Primary-key migration is intentionally fail-closed: deleting the old id
   * is a separate destructive action and must not be inferred from an edit.
   *
   * This compatibility API intentionally returns only after source.import has
   * returned a validated identity. It does not expose an ambiguous transport
   * receipt; observed dispatch/ACK evidence therefore retains unknown writes
   * while local parse/identity rejection remains undispatched. The
   * read-only source.list reconciliation belongs to SourceToolsOrchestrator.
   */
  async saveEditableSource(sourceId: string, text: string, identifyOriginal?: (operationId: string) => void): Promise<void> {
    let value: unknown;
    try {
      value = JSON.parse(text) as unknown;
    } catch (error) {
      throw new Error(`Edited book source is not valid JSON: ${(error as Error).message}`);
    }
    const bookSource = this.requireBookSourceObject(value, 0);
    const editedUrl = this.requireBookSourceUrl(bookSource, 0);
    const baseline = this.editableSourceId === sourceId ? this.editableDefinitionIdentity : undefined;
    if (baseline === undefined) throw new Error('请先重新读取书源，再保存编辑');
    if (editedUrl !== this.editableBookSourceUrl) {
      throw new Error('编辑器不允许更改原始书源的 bookSourceUrl；请保留原地址');
    }
    const expectedVersion = this.editableSourceVersion;
    if (!this.supportsOriginalSourceImport() ||
      this.runtimeOwner.supportsCoreCapability?.('source.import.conditional.v1') !== true ||
      expectedVersion === undefined || !/^[0-9a-f]{64}$/.test(expectedVersion)) {
      throw new Error('当前 Core 无法核定编辑前的完整书源版本；草稿保留，请更新 Core 后重新读取');
    }
    const currentDefinition = await this.readSourceDefinition(sourceId);
    if (currentDefinition === undefined || currentDefinition.identity !== baseline) {
      throw new Error('书源已被修改或删除；草稿保留，请重新读取后核对');
    }
    // This early read gives an undispatched conflict. The frozen editor-open
    // SHA is also checked by Core inside the actual original write transaction.
    const document = JSON.stringify(bookSource);
    const summary = await this.importOriginalSourceDocument(document, (): boolean => true,
      identifyOriginal, { sourceId, expectedVersion });
    if (summary.failedCount > 0) {
      throw new Error(`source.import failed: ${summary.failures[0].message}`);
    }
    if (summary.importedCount !== 1 || summary.sourceIds[0] !== sourceId) {
      throw new Error('source.import did not confirm the edited source identity');
    }
    this.editableSourceId = '';
    this.editableDefinitionIdentity = undefined;
    this.editableSourceVersion = undefined;
    this.editableBookSourceUrl = undefined;
  }

  /** Replay-only compatibility API. Product debug uses real `source.check.run` evidence. */
  async debugSource(sourceId: string, key: string): Promise<SourceDebugOutcome> {
    const result = await this.runtimeOwner.request('source.debug', {
      sourceId,
      key,
      responses: {},
    });
    const rawLogs = result.data['logs'];
    const finalState = result.data['finalState'];
    const durationMs = result.data['durationMs'];
    if (!Array.isArray(rawLogs) || typeof finalState !== 'number' ||
      !Number.isSafeInteger(finalState) || typeof durationMs !== 'number' ||
      !Number.isFinite(durationMs) || durationMs < 0) {
      throw new Error('source.debug returned invalid data');
    }
    const logs: SourceDebugLog[] = [];
    for (const raw of rawLogs) {
      const row = this.requireObject(raw, 'source.debug log');
      const state = row['state'];
      const message = row['msg'];
      const timestampMs = row['timestampMs'];
      if (typeof state !== 'number' || !Number.isSafeInteger(state) || typeof message !== 'string' ||
        typeof timestampMs !== 'number' || !Number.isFinite(timestampMs) || timestampMs < 0) {
        throw new Error('source.debug returned an invalid log entry');
      }
      const log: SourceDebugLog = { state, message, timestampMs };
      const step = row['step'];
      const extractedCount = row['extractedCount'];
      const errorKind = row['errorKind'];
      if (typeof step === 'string') {
        log.step = step;
      }
      if (typeof extractedCount === 'number' && Number.isSafeInteger(extractedCount) && extractedCount >= 0) {
        log.extractedCount = extractedCount;
      }
      if (typeof errorKind === 'string') {
        log.errorKind = errorKind;
      }
      logs.push(log);
    }
    if (logs.length === 0 || logs[logs.length - 1].state !== finalState) {
      throw new Error('source.debug final state does not match its log stream');
    }
    return { logs, finalState, durationMs };
  }

  /**
   * Persist a source toggle via the real `source.update` RPC. Only the raw
   * `bookSource.enabled` key is rewritten Core-side (rules and unknown Legado
   * fields are preserved). Rejects when `enabled` is absent, on RPC failure,
   * or when Core echoes a mismatched state — the page keeps a non-optimistic
   * toggle and reloads the list only after a confirmed success.
   */
  async updateSource(sourceId: string, patch: SourcePatch, current?: () => boolean): Promise<void> {
    if (patch.enabled === undefined) {
      throw new Error('source.update requires an enabled flag');
    }
    if (this.supportsOriginalSourceManagement()) {
      const params: JsonObject={sourceId,enabled:patch.enabled};
      await RulesMutationOwner.forRuntime(this.runtimeOwner).run('书源开关',
        current ?? ((): boolean => ReaderRuntimeOwner.isCurrent(this.runtimeOwner)),
        async (request,confirmed): Promise<void> => {
          const event=await request('source.update',params);this.qualifyOriginalSource('source.update',params,event.data);confirmed();
        },this.writeEvidence,patch.enabled===false ?
          (): Promise<boolean> => this.finishOriginalSourceCleanup('source.update',params) : undefined);
      return;
    }
    const result = await this.runtimeOwner.request('source.update', {
      sourceId,
      enabled: patch.enabled,
    }, { canDispatch: current, onDispatch: (): void => this.writeEvidence?.dispatched() }).catch((error: Error) => {
      // Typed Core admission refusal happens before executing this command.
      // Generic transport/echo errors retain the actual dispatched evidence.
      if (isReaderCoreTransactionPendingError(error)) this.writeEvidence?.rejectedBeforeExecution();
      throw error;
    });
    const updated = result.data['source'];
    if (typeof updated !== 'object' || updated === null || Array.isArray(updated)) {
      throw new Error('source.update returned invalid data');
    }
    const source = updated as JsonObject;
    if (source['enabled'] !== patch.enabled) {
      throw new Error(
        `source.update echoed a mismatched enabled state: requested=${patch.enabled} ` +
          `got=${source['enabled']}`,
      );
    }
    this.writeEvidence?.confirmed();
  }

  /** Delete sources in Core, then idempotently remove their Host sessions. */
  async deleteSources(sourceIds: string[]): Promise<SourceDeleteOutcome> {
    if (sourceIds.length === 0) {
      throw new Error('source.delete requires at least one sourceId');
    }
    const params: JsonObject={sourceIds:sourceIds.slice()};
    let data: JsonObject;
    let cookieCleanupFailures = 0;
    if (this.supportsOriginalSourceManagement()) {
      data=await RulesMutationOwner.forRuntime(this.runtimeOwner).run('删除书源',
        (): boolean => ReaderRuntimeOwner.isCurrent(this.runtimeOwner),async (request,confirmed): Promise<JsonObject> => {
          const event=await request('source.delete',params);this.qualifyOriginalSource('source.delete',params,event.data);confirmed();return event.data;
        },this.writeEvidence,async (): Promise<boolean> => {
          for (const id of sourceIds) {
            if (!ReaderRuntimeOwner.isCurrent(this.runtimeOwner)) { cookieCleanupFailures+=1;continue; }
            try { await this.runtimeOwner.clearSourceCookieSession(id); } catch (_) { cookieCleanupFailures+=1; }
          }
          return cookieCleanupFailures===0;
        });
      if (this.originalMutationSnapshot()?.blocked && cookieCleanupFailures===0) cookieCleanupFailures=1;
    } else {
      const result=await this.runtimeOwner.request('source.delete',params,{onDispatch:(): void => this.writeEvidence?.dispatched()});
      data=result.data;
    }
    const deleted = data['deleted'];
    if (typeof deleted !== 'number' || !Number.isInteger(deleted) || deleted < 0 ||
      deleted > sourceIds.length) {
      throw new Error('source.delete returned invalid deleted count');
    }
    if (!this.supportsOriginalSourceManagement()) this.writeEvidence?.confirmed();
    if (!this.supportsOriginalSourceManagement()) for (const sourceId of sourceIds) {
      try {
        await this.runtimeOwner.clearSourceCookieSession(sourceId);
      } catch (_) {
        // Core deletion is already durable. Surface cleanup separately rather
        // than misreporting the whole destructive operation as rolled back.
        cookieCleanupFailures += 1;
      }
    }
    return { deletedCount: deleted, cookieCleanupFailures };
  }

  /**
   * Run selected capabilities through Core's production pipeline. Core
   * resolves `ruleSearch.checkKeyWord` per source (falling back to Legado's
   * global "我的"); the page never owns rule semantics or sample keywords.
   */
  async checkSource(
    sourceId: string,
    shouldContinue: () => boolean = (): boolean => true,
    keyword?: string,
    mode: 'search' | 'explore' = 'search',
    levels: string[] = ['L1', 'L2'],
    timeoutMs: number = 180000,
    onStage?: (stage: string) => void,
  ): Promise<SourceCheckOutcome> {
    if (sourceId.trim().length === 0) {
      throw new Error('source.check.run requires a non-empty sourceId');
    }
    if (!this.runtimeOwner.supportsCoreCapability('source.check.mode.v1')) {
      throw new Error('当前 Core 不支持分项书源检测，请使用配套 Native');
    }
    const selectedLevels = this.admitCheckOptions(levels, timeoutMs);
    const params: JsonObject = { sourceIds: [sourceId], timeoutMs, mode, levels: selectedLevels };
    const reportVersion = this.runtimeOwner.supportsCoreCapability('source.check.report.v2') ? 2 :
      this.runtimeOwner.supportsCoreCapability('source.check.report.v1') ? 1 : undefined;
    if (reportVersion !== undefined) params['reportVersion'] = reportVersion;
    this.applyCheckKeyword(params, keyword, mode);
    const result = await this.runtimeOwner.request('source.check.run', params,
      this.sourceCheckRequestOptions(shouldContinue, timeoutMs, onStage));
    return this.readSourceCheckResults(result.data, result.requestId, [sourceId], mode,
      selectedLevels, timeoutMs, reportVersion)[0];
  }

  supportsEphemeralSourceCheck(): boolean {
    return this.runtimeOwner.supportsCoreCapability('source.check.ephemeral.v1');
  }

  async checkEphemeralSources(
    sources: JsonObject[],
    shouldContinue: () => boolean = (): boolean => true,
    keyword?: string,
    mode: 'search' | 'explore' = 'search',
    levels: string[] = ['L1', 'L2'],
    timeoutMs: number = 180000,
    onStage?: (stage: string) => void,
  ): Promise<SourceCheckOutcome[]> {
    if (!this.supportsEphemeralSourceCheck()) {
      throw new Error('当前 Core 不支持未入库书源检测，可跳过检测后继续');
    }
    if (sources.length < 1 || sources.length > 100) throw new Error('未入库检测支持每批 1–100 条书源');
    const selected = this.admitCheckOptions(levels, timeoutMs);
    const expected = sources.map((source: JsonObject): string =>
      this.optionalString(source, 'bookSourceUrl')?.trim() ?? '');
    const params: JsonObject = { sources, reportVersion: 2, mode, levels: selected, timeoutMs };
    this.applyCheckKeyword(params, keyword, mode);
    const result = await this.runtimeOwner.request('source.check.ephemeral.run', params,
      this.sourceCheckRequestOptions(shouldContinue, timeoutMs, onStage));
    return this.readSourceCheckResults(result.data, result.requestId, expected, mode, selected, timeoutMs, 2, true);
  }

  async clearSourceCheckReports(sourceIds: string[], current?: () => boolean): Promise<SourceReportClearOutcome> {
    if (sourceIds.length === 0 || sourceIds.some((id: string): boolean => id.trim().length === 0)) {
      throw new Error('清除检测报告需要非空书源标识');
    }
    if (!this.runtimeOwner.supportsCoreCapability('source.check.report.clear.v1')) {
      return { supported: false, clearedCount: 0, sourceIds: [] };
    }
    const requested = Array.from(new Set(sourceIds));
    const result = await this.runtimeOwner.request('source.check.report.clear', { sourceIds: requested }, {
      canDispatch: current,
    });
    const clearedCount = result.data['clearedCount'];
    const ids = this.readSourceIds(result.data['sourceIds'], '检测报告清理回执');
    if (typeof clearedCount !== 'number' || !Number.isSafeInteger(clearedCount) || clearedCount < 0 ||
      ids.length > requested.length || ids.some((id: string): boolean =>
        !requested.some((input: string): boolean => id === input || id === input.trim())) ||
      requested.some((id: string): boolean => !ids.includes(id) && !ids.includes(id.trim()))) {
      throw new Error('书源检测报告清理回执不匹配');
    }
    return { supported: true, clearedCount, sourceIds: ids };
  }

  private admitCheckOptions(levels: string[], timeoutMs: number): string[] {
    const selected = Array.from(new Set(levels));
    if (selected.length === 0 || selected.some((level: string): boolean =>
      !['L1', 'L2', 'L3', 'L4', 'L5'].includes(level))) {
      throw new Error('source.check.run requires known selected levels');
    }
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 4294967295) {
      throw new Error('source.check.run requires a positive uint32 Core budget');
    }
    return selected;
  }

  private sourceCheckRequestOptions(current: () => boolean, timeoutMs: number,
    onStage?: (stage: string) => void): BookRequestOptions {
    const options: BookRequestOptions = {
      timeoutMs: timeoutMs + 5000, canDispatch: current, canContinue: current,
      shouldCancel: (): boolean => !current(),
    };
    if (onStage !== undefined) {
      options.onDispatch = (): void => { if (current()) onStage('L1'); };
      options.onSourceCheckStage = (stage: string): void => { if (current()) onStage(stage); };
    }
    return options;
  }

  private applyCheckKeyword(params: JsonObject, keyword: string | undefined, mode: 'search' | 'explore'): void {
    const explicit = mode === 'search' ? keyword?.trim() ?? '' : '';
    if (explicit.length > 0) params['keyword'] = explicit;
    if (this.runtimeOwner.supportsCoreCapability('source.check.keyword_override.v1')) {
      params['keywordOverride'] = explicit.length > 0;
    }
  }

  private readSourceCheckResults(data: JsonObject, requestId: number, expected: string[],
    mode: 'search' | 'explore', selected: string[], timeoutMs: number, reportVersion?: number,
    ephemeral: boolean = false): SourceCheckOutcome[] {
    const diagnostics = this.runtimeOwner.takeSourceHttpDiagnostics(requestId);
    const traceId = this.optionalString(data, 'traceId');
    const rawResults = data['results'];
    if (traceId === undefined || traceId.trim().length === 0 ||
      !Array.isArray(rawResults) || rawResults.length !== expected.length) {
      throw new Error('source check returned invalid result count');
    }
    const correlated = ephemeral ? expected.map((id: string, index: number): string => {
      const row = this.requireObject(rawResults[index], '未入库检测回执');
      const fallbackId = `ephemeral:${index + 1}`;
      if (row['sourceId'] !== fallbackId && id.length > 0) return id;
      const passed = row['levelsPassed'];
      // Core owns URL parsing. Its positional ID represents a real static L1
      // failure, and must never qualify a different candidate's success.
      if (row['sourceId'] !== fallbackId || row['available'] !== false ||
        row['failureReason'] !== 'L1: invalid or missing bookSourceUrl' || !Array.isArray(passed) || passed.length > 0) {
        throw new Error('未入库检测回执缺少可关联的书源身份');
      }
      return fallbackId;
    }) : expected;
    const counts = new Map<string, number>();
    const bySource = new Map<string, SourceHttpDiagnosticRecord[]>();
    for (const sourceId of correlated) counts.set(sourceId, (counts.get(sourceId) ?? 0) + 1);
    for (const diagnostic of diagnostics) {
      if (!counts.has(diagnostic.sourceId) || diagnostic.traceId !== traceId || diagnostic.requestId !== requestId) {
        throw new Error('source.check.run Host evidence correlation mismatch');
      }
      // Repeated candidate identities share the same public Host trace and ID.
      // The ordered Core rows still prove each result. Do not attach transport
      // observations to individual rows when the recorder cannot distinguish them.
      if (counts.get(diagnostic.sourceId) !== 1) continue;
      const records = bySource.get(diagnostic.sourceId) ?? [];
      records.push(diagnostic);
      bySource.set(diagnostic.sourceId, records);
    }
    return rawResults.map((raw: unknown, index: number): SourceCheckOutcome => {
      const outcome = this.readSourceCheckOutcome(raw, correlated[index], traceId, requestId,
        bySource.get(correlated[index]) ?? [], mode, selected, timeoutMs, reportVersion);
      if (ephemeral && expected.length === 1 && outcome.sourceId === 'ephemeral:1' &&
        outcome.report?.steps.some((step: SourceCheckReportStep): boolean =>
          step.level === 'L1' && step.executed && step.status === 'fail') === true) {
        outcome.oneRowEphemeralL1Failure = true;
      }
      return outcome;
    });
  }

  private readSourceCheckOutcome(raw: unknown, sourceId: string, traceId: string, requestId: number,
    diagnostics: SourceHttpDiagnosticRecord[], mode: 'search' | 'explore', selectedLevels: string[],
    timeoutMs: number, reportVersion?: number): SourceCheckOutcome {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
      throw new Error('source.check.run returned a non-object result');
    }
    const outcome = raw as JsonObject;
    const echoedSourceId = this.optionalString(outcome, 'sourceId');
    const available = outcome['available'];
    const rawLevels = outcome['levelsPassed'];
    const failureReason = this.optionalString(outcome, 'failureReason');
    const durationMs = outcome['durationMs'];
    if (echoedSourceId !== sourceId || typeof available !== 'boolean' ||
      !Array.isArray(rawLevels) || typeof durationMs !== 'number' || !Number.isFinite(durationMs)) {
      throw new Error('source.check.run returned invalid or mismatched data');
    }
    const levelsPassed: string[] = [];
    for (const level of rawLevels) {
      if (typeof level !== 'string' || !selectedLevels.includes(level) || levelsPassed.includes(level)) {
        throw new Error('source.check.run returned an invalid level');
      }
      levelsPassed.push(level);
    }
    if (available && selectedLevels.some((level: string): boolean => !levelsPassed.includes(level))) {
      throw new Error('source.check.run marked incomplete selected capabilities available');
    }
    if (!available && (failureReason === undefined || failureReason.trim().length === 0)) {
      throw new Error('source.check.run failed without a failure reason');
    }
    const report = reportVersion === undefined ? undefined : this.readCheckReport(outcome['report'], mode, traceId,
      selectedLevels, levelsPassed, durationMs, reportVersion, timeoutMs);
    const rawCoreLogs = outcome['debugLogs'];
    if (!Array.isArray(rawCoreLogs) || rawCoreLogs.length === 0) {
      throw new Error('source.check.run returned no structured Core debug logs');
    }
    const coreLogs: SourceDebugLog[] = rawCoreLogs.map((rawLog: unknown): SourceDebugLog => {
      const row = this.requireObject(rawLog, 'source.check.run debug log');
      const state = row['state'];
      const message = row['msg'];
      const timestampMs = row['timestampMs'];
      if (typeof state !== 'number' || !Number.isSafeInteger(state) || typeof message !== 'string' ||
        typeof timestampMs !== 'number' || !Number.isFinite(timestampMs) || timestampMs < 0) {
        throw new Error('source.check.run returned an invalid Core debug log');
      }
      const log: SourceDebugLog = {
        state,
        message: `[Core] ${message}`,
        timestampMs,
        sourceId,
        traceId,
        requestId: requestId,
      };
      const step = this.optionalString(row, 'step');
      const errorKind = this.optionalString(row, 'errorKind');
      const extractedCount = row['extractedCount'];
      if (step !== undefined) log.step = step;
      if (errorKind !== undefined) log.errorKind = errorKind;
      if (typeof extractedCount === 'number' && Number.isSafeInteger(extractedCount) && extractedCount >= 0) {
        log.extractedCount = extractedCount;
      }
      return log;
    });
    const hostLogs: SourceDebugLog[] = diagnostics
      .map((record): SourceDebugLog => {
        const status = record.errorMessage === undefined ? record.statusCode : undefined;
        const target = record.finalUrl !== undefined && record.finalUrl !== record.url ?
          `${record.url} → ${record.finalUrl}` : record.url;
        const message = record.errorMessage === undefined ?
          `[Host] ${record.stage} ${record.method} ${target} → HTTP ${status ?? '未知'}（${record.durationMs}ms）` :
          `[Host] ${record.stage} ${record.method} ${target} → ${record.errorMessage}`;
        const log: SourceDebugLog = {
          state: record.errorMessage === undefined ? 1 : -1,
          message,
          timestampMs: record.timestampMs,
          step: record.stage,
          sourceId: record.sourceId,
          traceId: record.traceId,
          requestId: record.requestId,
          method: record.method,
          url: record.url,
          durationMs: record.durationMs,
        };
        if (record.statusCode !== undefined) {
          log.statusCode = record.statusCode;
        }
        if (record.errorMessage !== undefined) {
          log.errorKind = 'HOST_HTTP';
        }
        return log;
      });
    return {
      sourceId,
      traceId,
      available,
      levelsPassed,
      mode,
      requestedLevels: selectedLevels,
      report,
      capabilities: report !== undefined ? report.steps.map((step: SourceCheckReportStep): SourceCapabilityCheck => ({
        level: step.level,
        state: !step.requested ? 'notRequested' : step.status === 'pass' ? 'passed' :
          step.status === 'fail' ? 'failed' : step.status === 'not_supported' ? 'notSupported' :
          step.status === 'cancelled' ? 'cancelled' : 'blocked',
      })) : ['L1', 'L2', 'L3', 'L4', 'L5'].map((level: string): SourceCapabilityCheck => ({
        level,
        state: !selectedLevels.includes(level) ? 'notRequested' :
          levelsPassed.includes(level) ? 'passed' :
          failureReason?.startsWith(`${level}:`) === true ? 'failed' : 'blocked',
      })),
      failureReason,
      durationMs,
      hostEvidenceCount: hostLogs.length,
      logs: coreLogs.concat(hostLogs),
    };
  }

  private readCheckHistory(value: unknown, sourceVersion: string | undefined, maxVersion: number): SourceCheckHistoryEntry[] {
    if (!Array.isArray(value) || value.length > 8) throw new Error('source.list returned invalid checkReports');
    if (sourceVersion === undefined || !/^[a-f0-9]{64}$/.test(sourceVersion)) throw new Error('source.list omitted current rule version');
    return value.map((item: unknown): SourceCheckHistoryEntry => {
      const row = this.requireObject(item, 'source check history');
      const checkedAtMs = row['checkedAtMs'];
      const stale = row['stale'];
      const raw = this.requireObject(row['report'], 'source check history report');
      this.requireKeys(row, ['checkedAtMs', 'stale', 'report'], 'source check history');
      const mode = raw['mode'];
      const trace = this.optionalString(raw, 'traceId');
      const steps = raw['steps'];
      if (typeof checkedAtMs !== 'number' || !Number.isSafeInteger(checkedAtMs) || checkedAtMs < 0 ||
        typeof stale !== 'boolean' || typeof mode !== 'string' || !['legacy', 'search', 'explore'].includes(mode) ||
        trace === undefined || trace.trim().length === 0 || trace.length > 128 || !Array.isArray(steps)) throw new Error('source.list returned invalid check history');
      const selected: string[] = [];
      const passed: string[] = [];
      let duration = 0;
      for (const item of steps) {
        const step = this.requireObject(item, 'source check history step');
        const level = this.optionalString(step, 'level') ?? '';
        if (step['requested'] === true) {
          selected.push(level);
          if (step['status'] === 'pass') passed.push(level);
        }
        if (typeof step['durationMs'] === 'number') duration += step['durationMs'] as number;
      }
      if (selected.length === 0) throw new Error('source.list history has no selected capabilities');
      const version = raw['version'];
      if (typeof version !== 'number' || ![1, 2].includes(version) || version > maxVersion) {
        throw new Error('source.list returned an unrequested report version');
      }
      const report = this.readCheckReport(raw, mode as 'legacy' | 'search' | 'explore', trace, selected, passed, duration, version);
      if (stale !== (report.ruleDigest !== sourceVersion)) throw new Error('source.list history version mismatch');
      return { checkedAtMs, stale, report };
    });
  }

  private readCheckReport(value: unknown, mode: 'legacy' | 'search' | 'explore', traceId: string,
    selected: string[], passed: string[], durationMs: number, version: number, timeoutMs?: number): SourceCheckReport {
    const raw = this.requireObject(value, 'source.check.run report');
    const allowed = ['version', 'mode', 'traceId', 'ruleDigest', 'inputDigest', 'steps', 'contentKind'];
    if (version === 2) allowed.push('executionOptions', 'executionOptionsDigest');
    this.requireKeys(raw, allowed, 'source.check.run report');
    const ruleDigest = this.optionalString(raw, 'ruleDigest');
    const inputDigest = this.optionalString(raw, 'inputDigest');
    const contentKind = this.optionalString(raw, 'contentKind');
    const steps = raw['steps'];
    if (![1, 2].includes(version) || raw['version'] !== version || raw['mode'] !== mode || raw['traceId'] !== traceId ||
      traceId.trim().length === 0 || traceId.length > 128 ||
      inputDigest === undefined || !/^[a-f0-9]{64}$/.test(inputDigest) ||
      raw['ruleDigest'] === null || raw['contentKind'] === null ||
      (ruleDigest !== undefined && !/^[a-f0-9]{64}$/.test(ruleDigest)) ||
      (contentKind !== undefined && !['text', 'url_only', 'image', 'audio', 'empty', 'unsupported'].includes(contentKind)) ||
      !Array.isArray(steps) || steps.length !== 5) {
      throw new Error('source.check.run returned an invalid report');
    }
    let executionOptions: SourceCheckExecutionOptions | undefined = undefined;
    let executionOptionsDigest: string | undefined = undefined;
    if (version === 2) {
      const options = this.requireObject(raw['executionOptions'], 'source.check.run execution options');
      this.requireKeys(options, ['timeoutMs'], 'source.check.run execution options');
      const budget = options['timeoutMs'];
      executionOptionsDigest = this.optionalString(raw, 'executionOptionsDigest');
      if (typeof budget !== 'number' || !Number.isSafeInteger(budget) || budget < 0 || budget > 4294967295 ||
        (timeoutMs !== undefined && budget !== timeoutMs) || executionOptionsDigest === undefined ||
        !/^[a-f0-9]{64}$/.test(executionOptionsDigest)) {
        throw new Error('source.check.run returned invalid or mismatched execution options');
      }
      executionOptions = { timeoutMs: budget };
    }
    let elapsed = 0;
    const parsed = steps.map((value: unknown, index: number): SourceCheckReportStep => {
      const step = this.requireObject(value, 'source.check.run report step');
      this.requireKeys(step, ['level', 'requested', 'executed', 'status', 'durationMs', 'reason'], 'source.check.run report step');
      const level = `L${index + 1}`;
      const requested = step['requested'];
      const executed = step['executed'];
      const status = step['status'];
      const time = step['durationMs'];
      const reason = this.optionalString(step, 'reason');
      if (step['level'] !== level || requested !== selected.includes(level) ||
        typeof executed !== 'boolean' || typeof status !== 'string' ||
        !['pass', 'fail', 'not_requested', 'not_supported', 'blocked', 'cancelled'].includes(status) ||
        typeof time !== 'number' || !Number.isSafeInteger(time) || time < 0 || time > 4294967295 ||
        (requested && (status === 'pass') !== passed.includes(level)) ||
        (status === 'not_requested' && (requested || executed)) ||
        (['pass', 'fail', 'not_supported'].includes(status) && !executed) ||
        (!executed && time !== 0) || step['reason'] === null || (reason !== undefined && reason.length > 128)) {
        throw new Error('source.check.run returned inconsistent report steps');
      }
      elapsed += time;
      return { level, requested, executed, status: status as SourceCheckReportStatus, durationMs: time, reason };
    });
    if (elapsed > durationMs) throw new Error('source.check.run report exceeds total duration');
    if (parsed[0].status === 'pass' && ruleDigest === undefined) {
      throw new Error('source.check.run report omitted frozen rule digest');
    }
    return { version, mode, traceId, ruleDigest, inputDigest, contentKind, steps: parsed,
      executionOptions, executionOptionsDigest };
  }

  private requireKeys(value: JsonObject, allowed: string[], label: string): void {
    if (Object.keys(value).some((key: string): boolean => !allowed.includes(key))) {
      throw new Error(`${label} contains unknown fields`);
    }
  }

  private optionalString(value: JsonObject, key: string): string | undefined {
    const candidate = value[key];
    if (candidate === undefined || candidate === null) {
      return undefined;
    }
    if (typeof candidate !== 'string') {
      throw new Error(`source protocol returned invalid ${key}`);
    }
    return candidate;
  }

  private requireObject(value: unknown, label: string): JsonObject {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error(`${label} must be an object`);
    }
    return value as JsonObject;
  }

  private requireBookSourceObject(value: unknown, index: number): JsonObject {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new Error(`Book-source document item ${index + 1} must be a JSON object`);
    }
    const source = value as JsonObject;
    for (const field of ['bookSourceName', 'searchUrl', 'bookSourceGroup']) {
      if (source[field] !== undefined && source[field] !== null && typeof source[field] !== 'string') {
        throw new Error(`第 ${index + 1} 项的 ${field} 应为文字`);
      }
    }
    for (const field of ['ruleSearch', 'ruleBookInfo', 'ruleToc', 'ruleContent']) {
      let rule: unknown = source[field];
      // Legacy exports encode a rule object as JSON text, or use [] for an
      // absent rule. Validate that envelope without rewriting the source.
      if (typeof rule === 'string') {
        try { rule = JSON.parse(rule) as unknown; } catch (_) {
          throw new Error(`第 ${index + 1} 项的 ${field} 包含无效 JSON`);
        }
      }
      if (Array.isArray(rule) && rule.length === 0) continue;
      if (rule !== undefined && rule !== null &&
        (typeof rule !== 'object' || Array.isArray(rule))) {
        throw new Error(`第 ${index + 1} 项的 ${field} 应为规则对象`);
      }
    }
    return value as JsonObject;
  }

  private requireBookSourceUrl(bookSource: JsonObject, index: number): string {
    const value = bookSource['bookSourceUrl'];
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new Error(
        `Book-source document item ${index + 1} requires a non-empty bookSourceUrl`,
      );
    }
    // Import-time SSRF gate (P1-5): a source primary key must be an http(s)
    // URL on a public host, judged by the shared HttpTransportPolicy byte
    // rules. IP literals (private/loopback/link-local, and non-canonical
    // numeric forms) are rejected here; domains are only shape-checked — the
    // authoritative per-request gate lives in HttpExecuteHost, which resolves
    // DNS before every fetch.
    const hostname = httpUrlHostname(value);
    if (hostname === undefined || isPrivateNetworkTarget(hostname)) {
      throw new Error(
        `Book-source document item ${index + 1} bookSourceUrl must be an http(s) URL on a public host`,
      );
    }
    return value;
  }

  private assertImportCurrent(shouldContinue: () => boolean, importedCount: number): void {
    if (!shouldContinue()) {
      throw new Error(
        `Book-source import cancelled after ${importedCount} successful import(s): page session changed`,
      );
    }
  }
}
