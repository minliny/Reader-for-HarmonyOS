import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';
import { boundedSurfaceSdk } from './lib/bounded-surface-sdk-probe.mjs';
const selected = selectContractCases({ 'history-integrity': { description: 'Actual Sync history section retains every owner-provided row without an unsupported Expand action', resources: [] } });
for (const id of selected) {
  const source = readFileSync(new URL('../entry/src/main/ets/features/sync/ui/SyncPage.ets', import.meta.url), 'utf8');
  const sdk = boundedSurfaceSdk(), rows = [];
  const owner = sdk.consumer(source, ['historySection']);
  Object.assign(owner, { snapshot: { history: [{timestamp:'a'},{timestamp:'b'},{timestamp:'c'}] },
    sectionHeadingMuted() {}, historyRow: row => rows.push(row.timestamp), emptyState() {} });
  owner.historySection(); assert.deepEqual(rows, ['a','b','c']);
  assert.doesNotMatch(source, /expandRow\(|Text\('展开'\)/, 'a complete history has no decorative nonfunctional expansion affordance');
  assert.doesNotMatch(source, /onExpand|hasMoreHistory/, 'this page has no omitted business expansion intent');
  console.log('PASS Sync complete history content and supported affordance boundary; no native execution');
  recordContractCasePass(id);
}
