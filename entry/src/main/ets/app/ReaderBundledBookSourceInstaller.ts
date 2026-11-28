import type { JsonObject, ReaderCoreResultEvent, ReaderCoreRuntime } from '@reader/core-harmony';
import { hilog } from '@kit.PerformanceAnalysisKit';
import type { ReaderHostRegistry } from './ReaderHostRegistry';
import type { BookRequestOptions } from './BookRequestScheduler';
import { errorMessageOf } from './ErrorMessage';
import { supplyBundledSources } from './IncrementalBundledSourceSupply';
import {
  BundledSourceLedger,
  canonicalRulePayloadJson,
  decideBundledUpgrade,
  hasBuiltinMarker,
  isUserModifiedBuiltinCopy,
  mergeBundledDefaultStateCorrection,
  sha256Hex,
} from './BundledBookSourceSupply';

const LOG_DOMAIN = 0x5244;
const BUNDLED_BOOK_SOURCE_COLLECTION_RAW_FILE = 'reader-tested-book-source-collection.json';

interface BundledBookSourceInstallerPorts {
  readonly request: (method: string, params: JsonObject, options?: BookRequestOptions) => Promise<ReaderCoreResultEvent>;
  readonly supportsCapability: (capability: string) => boolean;
  readonly ready: () => boolean;
  readonly retired: () => boolean;
}

export type BundledSourceInstallSummary = {
  collectionRecords: number;
  uniqueSourceIds: number;
  processed: number;
  installedOrUpgraded: number;
  failed: number;
  interrupted: boolean;
};

/** Reconciles the shipped sources against Core and the legacy managed-copy ledger. */
export class ReaderBundledBookSourceInstaller {
  private readonly host: ReaderHostRegistry;
  private readonly ports: BundledBookSourceInstallerPorts;
  private readonly digest: string;

  constructor(host: ReaderHostRegistry, ports: BundledBookSourceInstallerPorts, digest: string) {
    this.host = host;
    this.ports = ports;
    this.digest = digest;
  }

  /**
   * Every install ships the complete recorded source collection as a normal
   * app-importable JSON array. Seeding runs after Core becomes observable so a
   * large collection or one bad item can never blank the application. Matching
   * versions are read-only on later launches; upgrades preserve the user's
   * enabled/explore choices; user-modified copies are never force-overwritten;
   * identities removed from a later collection are retired, never deleted.
   */
  async install(
    runtime: ReaderCoreRuntime,
  ): Promise<BundledSourceInstallSummary> {
    if (this.ports.supportsCapability('source.supply.v1')) {
      return supplyBundledSources({
        digest: this.digest,
        read: (file: string): Promise<string> => this.host.readBundledRawFileText(file),
        request: (params: JsonObject): Promise<ReaderCoreResultEvent> => this.ports.request('source.supply', params, { timeoutMs: 30000 }),
        legacyIds: async (): Promise<string[]> => (await BundledSourceLedger.load(this.host.getContext())).persistedSourceIds(),
        current: (): boolean => this.ports.ready(),
        failure: (sourceId: string, error: Error): void => {
          hilog.error(LOG_DOMAIN, 'Reader', 'Incremental bundled source failed: %{private}s %{private}s', sourceId, errorMessageOf(error));
        },
      });
    }
    const document = await this.host.readBundledRawFileText(BUNDLED_BOOK_SOURCE_COLLECTION_RAW_FILE);
    const fileDigest = await sha256Hex(document);
    if (fileDigest !== this.digest) {
      throw new Error(`Bundled book-source collection failed integrity verification: ` +
        `expected ${this.digest}, got ${fileDigest}`);
    }
    const bundledSources = this.requireBundledBookSourceCollection(document);
    // Per-source integrity: the embedded fingerprint must match the rules it
    // certifies. A mismatched source is rejected loudly, never silently skipped.
    const admittedBySourceId = new Map<string, JsonObject>();
    for (const bundled of bundledSources) {
      const digest = await sha256Hex(canonicalRulePayloadJson(bundled));
      if (digest !== bundled['ruleFingerprint']) {
        hilog.error(LOG_DOMAIN, 'Reader',
          'Bundled book source rejected, rule fingerprint mismatch: %{private}s',
          bundled['bookSourceName'] as string);
        continue;
      }
      // The portable collection retains every tested rule variant. Core uses
      // bookSourceUrl as its primary key, so the last (preferred) variant is
      // the one installed for duplicate identities.
      admittedBySourceId.set(bundled['bookSourceUrl'] as string, bundled);
    }
    const admitted = Array.from(admittedBySourceId.values());
    if (admitted.length === 0) {
      throw new Error('Bundled book-source collection admitted no sources');
    }
    const existingSources = await this.loadExistingBundledSources(runtime);
    const ledger = await BundledSourceLedger.load(this.host.getContext());
    let installedCount = 0;
    let failedCount = 0;
    let processedCount = 0;
    let interrupted = false;
    const managedCurrent: JsonObject[] = [];
    for (const bundled of admitted) {
      if (this.ports.retired()) {
        interrupted = true;
        break;
      }
      const sourceId = bundled['bookSourceUrl'] as string;
      const bundledVersion = bundled['builtinVersion'] as number;
      const bundledFingerprint = bundled['ruleFingerprint'] as string;
      try {
        const existing = existingSources.get(sourceId);
        if (existing === undefined) {
          await this.importBundledSource(sourceId, bundled);
          installedCount += 1;
          processedCount += 1;
          managedCurrent.push(bundled);
          continue;
        }
        if (!hasBuiltinMarker(existing)) {
          // The user imported their own copy over the same identity: preserve
          // it and ensure the withdrawal ledger never claims that user object.
          ledger.remove(sourceId);
          processedCount += 1;
          continue;
        }
        const storedActualFingerprint = await sha256Hex(canonicalRulePayloadJson(existing));
        const reBundled = existing['readerBuiltinWithdrawn'] === true ||
          existing['readerTestBuiltinWithdrawn'] === true;
        if (reBundled && isUserModifiedBuiltinCopy(existing, storedActualFingerprint)) {
          ledger.remove(sourceId);
          processedCount += 1;
          continue;
        }
        const decision = decideBundledUpgrade(
          bundledVersion, bundledFingerprint, existing, storedActualFingerprint, bundled);
        if (decision === 'userCopy') {
          ledger.remove(sourceId);
          processedCount += 1;
          continue;
        }
        if (decision === 'unchanged' && !reBundled) {
          processedCount += 1;
          managedCurrent.push(bundled);
          continue;
        }
        const importedSource: JsonObject =
          mergeBundledDefaultStateCorrection(bundled, existing, storedActualFingerprint) ?? { ...bundled };
        delete importedSource['readerBuiltinWithdrawn'];
        delete importedSource['readerTestBuiltinWithdrawn'];
        const metadataCorrection = (bundled['provenance'] as JsonObject | undefined)?.['metadataCorrection'] as JsonObject | undefined;
        const contentCorrection = (bundled['provenance'] as JsonObject | undefined)?.['contentCorrection'] as JsonObject | undefined;
        if (metadataCorrection?.['preserveExploreRules'] === true || contentCorrection?.['preserveExploreRules'] === true) {
          // These targeted revisions do not own discovery rules. They are
          // outside the legacy fingerprint, so retain existing edits/deletions;
          // a future discovery upgrade requires a separate explicit migration.
          for (const field of ['exploreUrl', 'ruleExplore']) {
            if (Object.prototype.hasOwnProperty.call(existing, field)) importedSource[field] = existing[field];
            else delete importedSource[field];
          }
        }
        if (!reBundled) {
          if (typeof existing['enabled'] === 'boolean') {
            importedSource['enabled'] = existing['enabled'];
          }
          if (typeof existing['enabledExplore'] === 'boolean') {
            importedSource['enabledExplore'] = existing['enabledExplore'];
          }
        }
        await this.importBundledSource(sourceId, importedSource);
        installedCount += 1;
        processedCount += 1;
        managedCurrent.push(bundled);
      } catch (error) {
        failedCount += 1;
        processedCount += 1;
        hilog.error(LOG_DOMAIN, 'Reader',
          'Bundled source item failed and was isolated: %{private}s %{private}s',
          sourceId, errorMessageOf(error));
      }
    }
    if (interrupted) {
      return {
        collectionRecords: bundledSources.length,
        uniqueSourceIds: admitted.length,
        processed: processedCount,
        installedOrUpgraded: installedCount,
        failed: failedCount,
        interrupted: true,
      };
    }
    const bundledIds = new Set<string>(admitted.map(source => source['bookSourceUrl'] as string));
    for (const entry of ledger.all()) {
      if (bundledIds.has(entry.sourceId)) {
        continue;
      }
      const stored = existingSources.get(entry.sourceId);
      if (stored === undefined) {
        ledger.remove(entry.sourceId);
        continue;
      }
      if (stored['readerBuiltinWithdrawn'] === true || stored['readerTestBuiltinWithdrawn'] === true) {
        continue;
      }
      const storedActualFingerprint = await sha256Hex(canonicalRulePayloadJson(stored));
      const userModified = isUserModifiedBuiltinCopy(stored, storedActualFingerprint);
      const retired: JsonObject = { ...stored };
      retired['readerBuiltinWithdrawn'] = true;
      delete retired['readerTestBuiltinWithdrawn'];
      if (!userModified) {
        retired['enabled'] = false;
      }
      await this.importBundledSource(entry.sourceId, retired);
      hilog.warn(LOG_DOMAIN, 'Reader',
        'Bundled source withdrawn from collection, marked retired (enabled=%{private}s): %{private}s',
        String(retired['enabled']), entry.sourceId);
    }
    ledger.syncCurrentBundle(managedCurrent);
    await ledger.save(this.host.getContext());
    return {
      collectionRecords: bundledSources.length,
      uniqueSourceIds: admitted.length,
      processed: processedCount,
      installedOrUpgraded: installedCount,
      failed: failedCount,
      interrupted: false,
    };
  }

  private async importBundledSource(
    sourceId: string,
    bookSource: JsonObject,
  ): Promise<void> {
    // Supply runs after ready and can overlap the shelf. Use the same source
    // registry/projection and reading-entry fences as a user source import.
    const imported = await this.ports.request('source.import', {
      sourceId,
      bookSource,
    }, { timeoutMs: 30000 });
    if (imported.data['imported'] !== true || imported.data['sourceId'] !== sourceId) {
      throw new Error(`source.import did not confirm bundled source ${sourceId}`);
    }
  }

  private async loadExistingBundledSources(
    runtime: ReaderCoreRuntime,
  ): Promise<Map<string, JsonObject>> {
    const exported = await runtime.request('source.export', {
      format: 'json',
    }, { timeoutMs: 30000 });
    const data = exported.data['data'];
    const count = exported.data['count'];
    if (typeof data !== 'string' || typeof count !== 'number' || !Number.isSafeInteger(count)) {
      throw new Error('source.export returned invalid bundled source data');
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(data) as unknown;
    } catch (error) {
      throw new Error(`source.export returned invalid JSON: ${(error as Error).message}`);
    }
    if (!Array.isArray(parsed) || parsed.length !== count) {
      throw new Error('source.export returned invalid source collection shape');
    }
    const sources = new Map<string, JsonObject>();
    for (const raw of parsed) {
      if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
        continue;
      }
      const source = raw as JsonObject;
      const sourceId = source['bookSourceUrl'];
      if (typeof sourceId === 'string' && sourceId.trim().length > 0) {
        sources.set(sourceId, source);
      }
    }
    return sources;
  }

  private requireBundledBookSourceCollection(document: string): JsonObject[] {
    let parsed: unknown;
    try {
      parsed = JSON.parse(document) as unknown;
    } catch (error) {
      throw new Error(`Bundled book-source collection JSON is invalid: ${(error as Error).message}`);
    }
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error('Bundled book-source collection must contain at least one source');
    }
    const sources: JsonObject[] = [];
    const builtinIds = new Set<string>();
    for (let index = 0; index < parsed.length; index += 1) {
      const raw = parsed[index];
      if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
        throw new Error(`Bundled book source ${index + 1} must be an object`);
      }
      const source = raw as JsonObject;
      const sourceId = source['bookSourceUrl'];
      const name = source['bookSourceName'];
      const builtinVersion = source['builtinVersion'];
      const enabled = source['enabled'];
      const defaultEnabled = source['defaultEnabled'];
      const builtinId = source['builtinId'];
      if (typeof sourceId !== 'string' || !/^https?:\/\//.test(sourceId) ||
        typeof name !== 'string' || name.trim().length === 0 ||
        typeof enabled !== 'boolean' || typeof defaultEnabled !== 'boolean' ||
        enabled !== defaultEnabled ||
        typeof builtinVersion !== 'number' || !Number.isSafeInteger(builtinVersion) ||
        builtinVersion < 1 ||
        typeof builtinId !== 'string' || builtinId.trim().length === 0 ||
        typeof source['ruleFingerprint'] !== 'string' ||
        !/^[0-9a-f]{64}$/.test(source['ruleFingerprint'] as string) ||
        typeof source['verifiedAt'] !== 'string' ||
        Number.isNaN(Date.parse(source['verifiedAt'] as string)) ||
        typeof source['verificationSuiteVersion'] !== 'string' ||
        (source['verificationSuiteVersion'] as string).trim().length === 0 ||
        !Array.isArray(source['capabilities']) || (source['capabilities'] as unknown[]).length === 0 ||
        !(source['capabilities'] as unknown[]).includes('import') ||
        typeof source['provenance'] !== 'object' || source['provenance'] === null ||
        typeof (source['provenance'] as JsonObject)['origin'] !== 'string' ||
        typeof source['readerHistoricalTest'] !== 'object' || source['readerHistoricalTest'] === null ||
        builtinIds.has(builtinId)) {
        hilog.error(LOG_DOMAIN, 'Reader',
          'Bundled source record skipped, invalid collection contract at index %{public}d', index + 1);
        continue;
      }
      builtinIds.add(builtinId);
      sources.push(source);
    }
    if (sources.length === 0) {
      throw new Error('Bundled book-source collection contains no valid source records');
    }
    return sources;
  }
}
