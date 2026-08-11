import type { JsonObject } from '@reader/core-harmony';
import url from '@ohos.url';
import { ReaderRuntimeOwner } from '../../app/ReaderRuntimeOwner';

export type BookSource = {
  sourceId: string;
  name: string;
  baseUrl: string;
  enabled: boolean;
  enabledExplore: boolean;
  loginUrl?: string;
  checkState?: 'unchecked' | 'checking' | 'passed' | 'failed';
  checkLevels?: string[];
  checkMessage?: string;
};

export type SourcePatch = {
  enabled?: boolean;
};

export type SourceImportSummary = {
  importedCount: number;
  sourceIds: string[];
};

export type SourceCheckOutcome = {
  sourceId: string;
  available: boolean;
  levelsPassed: string[];
  failureReason?: string;
  durationMs: number;
};

export type SourceExportResult = {
  data: string;
  count: number;
  format: 'json';
};

export type SourceDebugLog = {
  state: number;
  message: string;
  timestampMs: number;
  step?: string;
  extractedCount?: number;
  errorKind?: string;
};

export type SourceDebugOutcome = {
  logs: SourceDebugLog[];
  finalState: number;
  durationMs: number;
};

export type RuleSubscription = {
  id: number;
  name: string;
  url: string;
  type: number;
  customOrder: number;
  autoUpdate: boolean;
  update: number;
};

const MAX_BOOK_SOURCE_DOCUMENT_ENTRIES = 5000;

/**
 * Feature-local gateway for Source Management. Owns the `source.list` and
 * `source.update` boundary and validates every JSON envelope before the
 * page sees it.
 */
export class SourceGateway {
  private readonly runtimeOwner: ReaderRuntimeOwner;

  constructor(runtimeOwner: ReaderRuntimeOwner = ReaderRuntimeOwner.current()) {
    this.runtimeOwner = runtimeOwner;
  }

  async loadSources(): Promise<BookSource[]> {
    const result = await this.runtimeOwner.request('source.list', {});
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
      if (rawBookSource !== null && typeof rawBookSource === 'object' && !Array.isArray(rawBookSource)) {
        loginUrl = this.optionalString(rawBookSource as JsonObject, 'loginUrl');
      }
      if (sourceId === undefined || name === undefined) {
        continue;
      }
      sources.push({
        sourceId,
        name,
        baseUrl: baseUrl ?? '',
        enabled: source['enabled'] === true,
        enabledExplore: source['enabledExplore'] === true,
        loginUrl,
      });
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
    let parsed: unknown;
    try {
      parsed = JSON.parse(text) as unknown;
    } catch (error) {
      const message = error instanceof Error ? error.message : `${error}`;
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

    // Validate the whole local envelope before the first durable Core write.
    // Core still owns BookSource field semantics; this pass only establishes
    // object shape and Legado's stable primary key for safe addressing.
    const bookSources: JsonObject[] = [];
    const stableSourceIds: string[] = [];
    for (let index = 0; index < rawSources.length; index++) {
      const bookSource = this.requireBookSourceObject(rawSources[index], index);
      bookSources.push(bookSource);
      stableSourceIds.push(this.requireBookSourceUrl(bookSource, index));
    }

    const sourceIds: string[] = [];
    for (let index = 0; index < bookSources.length; index++) {
      this.assertImportCurrent(shouldContinue, sourceIds.length);
      const bookSource = bookSources[index];
      const sourceId = stableSourceIds[index];
      try {
        const result = await this.runtimeOwner.request('source.import', {
          sourceId,
          bookSource,
        });
        const imported = result.data['imported'];
        const echoedSourceId = this.optionalString(result.data, 'sourceId');
        const echoedName = this.optionalString(result.data, 'name');
        if (imported !== true || echoedSourceId !== sourceId || echoedName === undefined ||
          echoedName.trim().length === 0) {
          throw new Error('source.import returned invalid or mismatched data');
        }
        sourceIds.push(echoedSourceId);
      } catch (error) {
        const message = error instanceof Error ? error.message : `${error}`;
        throw new Error(
          `source.import failed at item ${index + 1}/${rawSources.length} ` +
            `after ${sourceIds.length} successful import(s): ${message}`,
        );
      }
      this.assertImportCurrent(shouldContinue, sourceIds.length);
    }
    return { importedCount: sourceIds.length, sourceIds };
  }

  /** Core serializes the exact persisted raw BookSource objects. */
  async exportBookSources(sourceIds?: string[]): Promise<SourceExportResult> {
    const params: JsonObject = { format: 'json' };
    if (sourceIds !== undefined) {
      if (sourceIds.length === 0) {
        throw new Error('source.export selection must not be empty');
      }
      params['sourceIds'] = sourceIds;
    }
    const result = await this.runtimeOwner.request('source.export', params);
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

  async loadEditableSource(sourceId: string): Promise<string> {
    const exported = await this.exportBookSources([sourceId]);
    const parsed = JSON.parse(exported.data) as unknown[];
    if (parsed.length !== 1) {
      throw new Error('source.export did not return exactly one source for editing');
    }
    return JSON.stringify(parsed[0], null, 2);
  }

  /**
   * Persist an edited raw source through the existing Core import command.
   * Primary-key migration is intentionally fail-closed: deleting the old id
   * is a separate destructive action and must not be inferred from an edit.
   */
  async saveEditableSource(sourceId: string, text: string): Promise<void> {
    let value: unknown;
    try {
      value = JSON.parse(text) as unknown;
    } catch (error) {
      throw new Error(`Edited book source is not valid JSON: ${(error as Error).message}`);
    }
    const bookSource = this.requireBookSourceObject(value, 0);
    const editedId = this.requireBookSourceUrl(bookSource, 0);
    if (editedId !== sourceId) {
      throw new Error('书源地址是主键；编辑器不允许隐式迁移 bookSourceUrl');
    }
    const summary = await this.importBookSourceDocument(JSON.stringify(bookSource));
    if (summary.importedCount !== 1 || summary.sourceIds[0] !== sourceId) {
      throw new Error('source.import did not confirm the edited source identity');
    }
  }

  /** Core-owned structured debug log projection; network health remains source.check.run. */
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

  async listRuleSubscriptions(): Promise<RuleSubscription[]> {
    const result = await this.runtimeOwner.request('rule-sub.list', {});
    const rawSubs = result.data['subs'];
    if (!Array.isArray(rawSubs)) {
      throw new Error('rule-sub.list returned invalid data');
    }
    return rawSubs.map((raw: unknown): RuleSubscription => this.decodeRuleSubscription(raw));
  }

  async putRuleSubscription(subscription: RuleSubscription): Promise<RuleSubscription> {
    this.validateRuleSubscription(subscription);
    const result = await this.runtimeOwner.request('rule-sub.put', {
      id: subscription.id,
      name: subscription.name,
      url: subscription.url,
      type: subscription.type,
      customOrder: subscription.customOrder,
      autoUpdate: subscription.autoUpdate,
      update: subscription.update,
    });
    return this.decodeRuleSubscription(result.data['sub']);
  }

  async deleteRuleSubscription(id: number): Promise<boolean> {
    if (!Number.isSafeInteger(id)) {
      throw new Error('rule-sub.delete requires a safe integer id');
    }
    const result = await this.runtimeOwner.request('rule-sub.delete', { id });
    if (result.data['id'] !== id || typeof result.data['deleted'] !== 'boolean') {
      throw new Error('rule-sub.delete returned invalid data');
    }
    return result.data['deleted'] as boolean;
  }

  /**
   * Persist a source toggle via the real `source.update` RPC. Only the raw
   * `bookSource.enabled` key is rewritten Core-side (rules and unknown Legado
   * fields are preserved). Rejects when `enabled` is absent, on RPC failure,
   * or when Core echoes a mismatched state — the page keeps a non-optimistic
   * toggle and reloads the list only after a confirmed success.
   */
  async updateSource(sourceId: string, patch: SourcePatch): Promise<void> {
    if (patch.enabled === undefined) {
      throw new Error('source.update requires an enabled flag');
    }
    const result = await this.runtimeOwner.request('source.update', {
      sourceId,
      enabled: patch.enabled,
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
  }

  /** Delete sources in Core, then idempotently remove their Host sessions. */
  async deleteSources(sourceIds: string[]): Promise<number> {
    if (sourceIds.length === 0) {
      throw new Error('source.delete requires at least one sourceId');
    }
    const result = await this.runtimeOwner.request('source.delete', { sourceIds });
    const deleted = result.data['deleted'];
    if (typeof deleted !== 'number' || !Number.isInteger(deleted) || deleted < 0 ||
      deleted > sourceIds.length) {
      throw new Error('source.delete returned invalid deleted count');
    }
    for (const sourceId of sourceIds) {
      await this.runtimeOwner.clearSourceCookieSession(sourceId);
    }
    return deleted;
  }

  /**
   * Run the persisted source through Core's production L1-L5 pipeline. Core
   * resolves `ruleSearch.checkKeyWord` per source (falling back to Legado's
   * global "我的"); the page never owns rule semantics or sample keywords.
   */
  async checkSource(
    sourceId: string,
    shouldContinue: () => boolean = (): boolean => true,
  ): Promise<SourceCheckOutcome> {
    if (sourceId.trim().length === 0) {
      throw new Error('source.check.run requires a non-empty sourceId');
    }
    const result = await this.runtimeOwner.request('source.check.run', {
      sourceIds: [sourceId],
      timeoutMs: 180000,
      levels: ['L1', 'L2', 'L3', 'L4', 'L5'],
    }, {
      timeoutMs: 185000,
      shouldCancel: (): boolean => !shouldContinue(),
    });
    const rawResults = result.data['results'];
    if (!Array.isArray(rawResults) || rawResults.length !== 1) {
      throw new Error('source.check.run returned invalid result count');
    }
    const raw = rawResults[0];
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
      throw new Error('source.check.run returned a non-object result');
    }
    const outcome = raw as JsonObject;
    const echoedSourceId = this.optionalString(outcome, 'sourceId');
    const available = outcome['available'];
    const levels = outcome['levelsPassed'];
    const failureReason = this.optionalString(outcome, 'failureReason');
    const durationMs = outcome['durationMs'];
    if (echoedSourceId !== sourceId || typeof available !== 'boolean' ||
      !Array.isArray(levels) || typeof durationMs !== 'number' || !Number.isFinite(durationMs)) {
      throw new Error('source.check.run returned invalid or mismatched data');
    }
    const levelsPassed: string[] = [];
    for (const level of levels) {
      if (typeof level !== 'string') {
        throw new Error('source.check.run returned an invalid level');
      }
      levelsPassed.push(level);
    }
    if (available && levelsPassed.length !== 5) {
      throw new Error('source.check.run marked an incomplete L1-L5 result available');
    }
    if (!available && (failureReason === undefined || failureReason.trim().length === 0)) {
      throw new Error('source.check.run failed without a failure reason');
    }
    return {
      sourceId,
      available,
      levelsPassed,
      failureReason,
      durationMs,
    };
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

  private decodeRuleSubscription(value: unknown): RuleSubscription {
    const raw = this.requireObject(value, 'rule subscription');
    const subscription: RuleSubscription = {
      id: this.requireSafeInteger(raw['id'], 'rule subscription id'),
      name: this.requireString(raw['name'], 'rule subscription name'),
      url: this.requireString(raw['url'], 'rule subscription URL'),
      type: this.requireSafeInteger(raw['type'], 'rule subscription type'),
      customOrder: this.requireSafeInteger(raw['customOrder'], 'rule subscription customOrder'),
      autoUpdate: raw['autoUpdate'] === true,
      update: this.requireSafeInteger(raw['update'], 'rule subscription update'),
    };
    if (typeof raw['autoUpdate'] !== 'boolean') {
      throw new Error('rule subscription autoUpdate must be boolean');
    }
    this.validateRuleSubscription(subscription);
    return subscription;
  }

  private validateRuleSubscription(subscription: RuleSubscription): void {
    if (!Number.isSafeInteger(subscription.id) || !Number.isSafeInteger(subscription.type) ||
      !Number.isSafeInteger(subscription.customOrder) || !Number.isSafeInteger(subscription.update)) {
      throw new Error('rule subscription numeric fields must be safe integers');
    }
    if (subscription.name.trim().length === 0 || subscription.url.trim().length === 0) {
      throw new Error('规则订阅名称和 URL 不能为空');
    }
    let parsed: url.URL;
    try {
      parsed = new url.URL(subscription.url.trim());
    } catch (_) {
      throw new Error('规则订阅 URL 无效');
    }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      throw new Error('规则订阅 URL 仅支持 HTTP/HTTPS');
    }
  }

  private requireSafeInteger(value: unknown, label: string): number {
    if (typeof value !== 'number' || !Number.isSafeInteger(value)) {
      throw new Error(`${label} must be a safe integer`);
    }
    return value;
  }

  private requireString(value: unknown, label: string): string {
    if (typeof value !== 'string') {
      throw new Error(`${label} must be a string`);
    }
    return value;
  }

  private requireBookSourceObject(value: unknown, index: number): JsonObject {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new Error(`Book-source document item ${index + 1} must be a JSON object`);
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
