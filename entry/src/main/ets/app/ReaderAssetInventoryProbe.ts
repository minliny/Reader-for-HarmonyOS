import asset from '@ohos.security.asset';
import util from '@ohos.util';
import type { BusinessError } from '@ohos.base';

export interface ReaderAssetInventorySample {
  status: 'observed' | 'unverified';
  reason: 'metadata' | 'changed' | 'capped' | 'malformed' | 'platform' | 'retired';
  passes: number;
  queries: number;
  readerConfigAliases: number;
  legacyAliases: number;
  immutableAliases: number;
  otherReaderAliases: number;
  aliasMetadataBytes: number;
  secretBytes: 'unknown';
  elapsedMs: number;
  errorCode?: number;
}

interface InventoryPass {
  aliases: Set<string>;
  legacy: number;
  immutable: number;
  other: number;
  bytes: number;
  queries: number;
  malformed: boolean;
  capped: boolean;
  retired: boolean;
}

const PAGE_SIZE = 64;
const MAX_PAGES = 64;
const LEGACY_ALIAS = 'reader.webdav.config.v2';
const IMMUTABLE_PREFIX = 'reader.webdav.config-save.';

/** Read-only metadata observation. Two bounded scans detect changes; they are
 * not an atomic OS snapshot, an orphan classification or a durability receipt.
 * No secret, business intent, credential head, user file or mutation is read.
 * Absence here must never release a pending operation or authorize cleanup. */
export async function probeReaderAssetInventory(debug: boolean, mode: string,
  requested: Object | undefined, current: () => boolean, now: () => number,
  record: (sample: ReaderAssetInventorySample) => void): Promise<void> {
  if (debug !== true || mode !== 'debug' || requested !== true || !isCurrent(current)) return;
  const started = now();
  let passes = 0, queries = 0;
  let value: InventoryPass = emptyPass();
  try {
    value = await observe(current, (): void => { queries += 1; }); passes += 1;
    if (value.retired || !isCurrent(current)) return;
    if (value.capped || value.malformed) {
      report(value, passes, queries, started, value.capped ? 'capped' : 'malformed', now, record);
      return;
    }
    const second = await observe(current, (): void => { queries += 1; }); passes += 1;
    if (second.retired || !isCurrent(current)) return;
    const unchanged = value.aliases.size === second.aliases.size &&
      value.legacy === second.legacy && value.immutable === second.immutable && value.other === second.other &&
      value.bytes === second.bytes && Array.from(value.aliases).every((alias): boolean => second.aliases.has(alias));
    value = second;
    report(value, passes, queries, started, second.capped ? 'capped' : second.malformed ? 'malformed' :
      unchanged ? 'metadata' : 'changed', now, record);
  } catch (error) {
    if (!isCurrent(current)) return;
    const code = (error as BusinessError)?.code;
    report(value, passes, queries, started, 'platform', now, record,
      typeof code === 'number' && Number.isFinite(code) ? code : undefined);
  }
}

async function observe(current: () => boolean, queried: () => void): Promise<InventoryPass> {
  const value = emptyPass();
  for (let page = 0; page < MAX_PAGES; page += 1) {
    if (!isCurrent(current)) { value.retired = true; return value; }
    const query: asset.AssetMap = new Map();
    query.set(asset.Tag.RETURN_TYPE, asset.ReturnType.ATTRIBUTES);
    query.set(asset.Tag.RETURN_LIMIT, PAGE_SIZE);
    query.set(asset.Tag.RETURN_OFFSET, page * PAGE_SIZE);
    value.queries += 1;
    queried();
    let rows: asset.AssetMap[];
    try { rows = await asset.query(query); }
    catch (error) { throw error; }
    if (!isCurrent(current)) { value.retired = true; return value; }
    if (rows.length > PAGE_SIZE) { value.malformed = true; return value; }
    for (const row of rows) {
      const bytes = row.get(asset.Tag.ALIAS);
      if (!(bytes instanceof Uint8Array)) { value.malformed = true; continue; }
      let alias: string;
      try { alias = util.TextDecoder.create('utf-8', { fatal: true }).decodeToString(bytes); }
      catch (_) { value.malformed = true; continue; }
      // Discard unrelated application metadata immediately. Only non-secret
      // Reader aliases remain in memory for the two-scan identity comparison.
      if (alias !== LEGACY_ALIAS && !alias.startsWith(IMMUTABLE_PREFIX)) continue;
      if (value.aliases.has(alias)) { value.malformed = true; continue; }
      value.aliases.add(alias); value.bytes += bytes.byteLength;
      if (alias === LEGACY_ALIAS) value.legacy += 1;
      else if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        alias.substring(IMMUTABLE_PREFIX.length))) value.immutable += 1;
      else value.other += 1;
    }
    if (rows.length < PAGE_SIZE) return value;
  }
  value.capped = true;
  return value;
}

function emptyPass(): InventoryPass {
  return { aliases: new Set<string>(), legacy: 0, immutable: 0, other: 0, bytes: 0,
    queries: 0, malformed: false, capped: false, retired: false };
}
function isCurrent(current: () => boolean): boolean { try { return current(); } catch (_) { return false; } }
function report(value: InventoryPass, passes: number, queries: number, started: number,
  reason: ReaderAssetInventorySample['reason'], now: () => number,
  record: (sample: ReaderAssetInventorySample) => void, errorCode?: number): void {
  try {
    record({ status: reason === 'metadata' ? 'observed' : 'unverified', reason, passes, queries,
      readerConfigAliases: value.aliases.size, legacyAliases: value.legacy, immutableAliases: value.immutable,
      otherReaderAliases: value.other, aliasMetadataBytes: value.bytes, secretBytes: 'unknown',
      elapsedMs: Math.max(0, now() - started), errorCode });
  } catch (_) { /* Logging cannot affect startup, Asset or configuration. */ }
}
