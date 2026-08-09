import type { JsonObject } from '@reader/core-harmony';
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
