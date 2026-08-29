import type { JsonObject } from '@reader/core-harmony';
import { ReaderRuntimeOwner } from '../../app/ReaderRuntimeOwner';

export type BookSource = {
  sourceId: string;
  name: string;
  baseUrl: string;
  enabled: boolean;
  enabledExplore: boolean;
  group?: string;
  loginUrl?: string;
  checkState?: 'unchecked' | 'checking' | 'passed' | 'failed';
  checkLevels?: string[];
  checkMessage?: string;
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

export type SourceCheckOutcome = {
  sourceId: string;
  traceId: string;
  available: boolean;
  levelsPassed: string[];
  failureReason?: string;
  durationMs: number;
  hostEvidenceCount: number;
  logs: SourceDebugLog[];
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
      let group: string | undefined = undefined;
      if (rawBookSource !== null && typeof rawBookSource === 'object' && !Array.isArray(rawBookSource)) {
        const bookSource = rawBookSource as JsonObject;
        loginUrl = this.optionalString(bookSource, 'loginUrl');
        const sourceGroup = this.optionalString(bookSource, 'bookSourceGroup');
        if (sourceGroup !== undefined && sourceGroup.trim().length > 0) {
          group = sourceGroup.trim();
        }
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
        group,
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
        const message = error instanceof Error ? error.message : `${error}`;
        failures.push({ index, sourceId: '', message });
        continue;
      }
      this.assertImportCurrent(shouldContinue, sourceIds.length);
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
    if (summary.failedCount > 0) {
      throw new Error(`source.import failed: ${summary.failures[0].message}`);
    }
    if (summary.importedCount !== 1 || summary.sourceIds[0] !== sourceId) {
      throw new Error('source.import did not confirm the edited source identity');
    }
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
  async deleteSources(sourceIds: string[]): Promise<SourceDeleteOutcome> {
    if (sourceIds.length === 0) {
      throw new Error('source.delete requires at least one sourceId');
    }
    const result = await this.runtimeOwner.request('source.delete', { sourceIds });
    const deleted = result.data['deleted'];
    if (typeof deleted !== 'number' || !Number.isInteger(deleted) || deleted < 0 ||
      deleted > sourceIds.length) {
      throw new Error('source.delete returned invalid deleted count');
    }
    let cookieCleanupFailures = 0;
    for (const sourceId of sourceIds) {
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
   * Run the persisted source through Core's production L1-L5 pipeline. Core
   * resolves `ruleSearch.checkKeyWord` per source (falling back to Legado's
   * global "我的"); the page never owns rule semantics or sample keywords.
   */
  async checkSource(
    sourceId: string,
    shouldContinue: () => boolean = (): boolean => true,
    keyword?: string,
  ): Promise<SourceCheckOutcome> {
    if (sourceId.trim().length === 0) {
      throw new Error('source.check.run requires a non-empty sourceId');
    }
    const params: JsonObject = {
      sourceIds: [sourceId],
      timeoutMs: 180000,
      levels: ['L1', 'L2', 'L3', 'L4', 'L5'],
    };
    const normalizedKeyword = keyword?.trim();
    if (normalizedKeyword !== undefined && normalizedKeyword.length > 0) {
      params['keyword'] = normalizedKeyword;
    }
    const result = await this.runtimeOwner.request('source.check.run', params, {
      timeoutMs: 185000,
      shouldCancel: (): boolean => !shouldContinue(),
    });
    const diagnostics = this.runtimeOwner.takeSourceHttpDiagnostics(result.requestId);
    const traceId = this.optionalString(result.data, 'traceId');
    const rawResults = result.data['results'];
    if (traceId === undefined || traceId.trim().length === 0 ||
      !Array.isArray(rawResults) || rawResults.length !== 1) {
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
        requestId: result.requestId,
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
        if (record.sourceId !== sourceId || record.traceId !== traceId ||
          record.requestId !== result.requestId) {
          throw new Error('source.check.run Host evidence correlation mismatch');
        }
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
      failureReason,
      durationMs,
      hostEvidenceCount: hostLogs.length,
      logs: coreLogs.concat(hostLogs),
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
