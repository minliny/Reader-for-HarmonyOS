import type { JsonObject } from '@reader/core-harmony';
import { ReaderRuntimeOwner } from '../../app/ReaderRuntimeOwner';

export type BookSource = {
  sourceId: string;
  name: string;
  baseUrl: string;
  enabled: boolean;
  enabledExplore: boolean;
};

export type SourcePatch = {
  enabled?: boolean;
};

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
      if (sourceId === undefined || name === undefined) {
        continue;
      }
      sources.push({
        sourceId,
        name,
        baseUrl: baseUrl ?? '',
        enabled: source['enabled'] === true,
        enabledExplore: source['enabledExplore'] === true,
      });
    }
    return sources;
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
}