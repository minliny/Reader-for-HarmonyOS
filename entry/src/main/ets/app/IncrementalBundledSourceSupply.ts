import type { JsonObject, ReaderCoreResultEvent } from '@reader/core-harmony';
import { BUNDLED_SOURCE_INDEX_SHA256 } from './BundledSourceIndexIdentity';
import { sha256Hex } from './BundledBookSourceSupply';

type IndexItem = { sourceId: string; itemDigest: string; file: string };
type SupplyIndex = { schemaVersion: number; bundleId: string; digest: string; collectionRecords: number; items: IndexItem[] };
type Receipt = { sourceId: string; itemDigest: string; dirty: boolean };
export type IncrementalSupplySummary = {
  collectionRecords: number; uniqueSourceIds: number; processed: number;
  installedOrUpgraded: number; failed: number; interrupted: boolean;
};
export type SupplyResources = {
  digest: string;
  read: (file: string) => Promise<string>;
  request: (params: JsonObject) => Promise<ReaderCoreResultEvent>;
  legacyIds: () => Promise<string[]>;
  current: () => boolean;
  failure?: (sourceId: string, error: Error) => void;
};

/** Host owns resource I/O only. Core owns rule edits, suppression and receipts. */
export async function supplyBundledSources(resources: SupplyResources): Promise<IncrementalSupplySummary> {
  const bundleId = 'reader-tested-book-sources';
  // A policy/schema change must invalidate an older completed receipt.
  const supplyDigest = `${resources.digest}:supply-v1:storage24`;
  const summary: IncrementalSupplySummary = {
    collectionRecords: 0, uniqueSourceIds: 0, processed: 0, installedOrUpgraded: 0, failed: 0, interrupted: false,
  };
  const status = await resources.request({ operation: 'status', bundleId, digest: supplyDigest });
  if (status.data['complete'] === true) return summary;
  if (!resources.current()) { summary.interrupted = true; return summary; }
  const indexText = await resources.read('bundled-sources/index.json');
  if (await sha256Hex(indexText) !== BUNDLED_SOURCE_INDEX_SHA256) throw new Error('Bundled source index integrity mismatch');
  const index = JSON.parse(indexText) as SupplyIndex;
  if (index.schemaVersion !== 1 || index.bundleId !== bundleId || index.digest !== resources.digest ||
    !Array.isArray(index.items) || index.items.length === 0 || index.items.length > 4096) throw new Error('Invalid bundled source index');
  const seen = new Set<string>();
  for (const item of index.items) {
    if (typeof item.sourceId !== 'string' || item.sourceId.length === 0 || seen.has(item.sourceId) ||
      !/^[0-9a-f]{64}$/.test(item.itemDigest) || !/^bundled-sources\/[0-9a-f]{64}\.json$/.test(item.file)) throw new Error('Invalid bundled source identity');
    seen.add(item.sourceId);
  }
  summary.collectionRecords = index.collectionRecords; summary.uniqueSourceIds = index.items.length;
  const receipts = new Map<string, Receipt>();
  const rawReceipts = status.data['items'];
  if (!Array.isArray(rawReceipts)) throw new Error('Core bundled source status missing receipts');
  for (const raw of rawReceipts) {
    const receipt = raw as Receipt;
    if (typeof receipt.sourceId !== 'string' || typeof receipt.itemDigest !== 'string' || typeof receipt.dirty !== 'boolean') throw new Error('Invalid Core supply receipt');
    receipts.set(receipt.sourceId, receipt);
  }
  const legacy = new Set<string>(await resources.legacyIds());
  const expected: JsonObject[] = [];
  for (const item of index.items) {
    if (!resources.current()) { summary.interrupted = true; return summary; }
    expected.push({ sourceId: item.sourceId, itemDigest: item.itemDigest });
    const receipt = receipts.get(item.sourceId);
    if (receipt?.itemDigest === item.itemDigest && !receipt.dirty) { summary.processed += 1; continue; }
    try {
      const document = await resources.read(item.file);
      if (!resources.current()) { summary.interrupted = true; return summary; }
      const result = await resources.request({ operation: 'apply', bundleId, sourceId: item.sourceId,
        itemDigest: item.itemDigest, document, legacyManaged: legacy.has(item.sourceId) });
      if (result.data['accepted'] !== true) throw new Error('Core rejected bundled source');
      if (result.data['changed'] === true) summary.installedOrUpgraded += 1;
    } catch (error) { summary.failed += 1; resources.failure?.(item.sourceId, error as Error); }
    summary.processed += 1;
    // Each item has its own durable boundary; yield before the next resource.
    await new Promise<void>((resolve: () => void): void => { setTimeout(resolve, 0); });
  }
  const retired = new Set<string>([...receipts.keys(), ...legacy]);
  for (const sourceId of retired) {
    if (seen.has(sourceId)) continue;
    if (!resources.current()) { summary.interrupted = true; return summary; }
    const receipt = receipts.get(sourceId);
    expected.push({ sourceId, itemDigest: 'withdrawn' });
    if (receipt?.itemDigest === 'withdrawn' && !receipt.dirty) continue;
    try {
      const result = await resources.request({ operation: 'withdraw', bundleId, sourceId, legacyManaged: legacy.has(sourceId) });
      if (result.data['accepted'] !== true) throw new Error('Core rejected withdrawal');
      if (result.data['changed'] === true) summary.installedOrUpgraded += 1;
    } catch (error) { summary.failed += 1; resources.failure?.(sourceId, error as Error); }
  }
  if (!resources.current()) { summary.interrupted = true; return summary; }
  if (summary.failed === 0) {
    const finished = await resources.request({ operation: 'finish', bundleId, digest: supplyDigest, expected });
    if (finished.data['complete'] !== true) summary.failed += 1;
  }
  return summary;
}
