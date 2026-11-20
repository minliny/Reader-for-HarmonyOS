import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

const definitions = {
  'recovery-actions': { description: '官方AST当前ReaderRecoveryAction真实入口及公共桥、缺登记/缺原生bridge/游离callback负例', resources: [] },
};
for (const id of selectContractCases(definitions)) {
  const {default:assert}=await import('node:assert/strict');
  const {readFileSync}=await import('node:fs');
  const {inventoryMessageEntrypoints,compareMessageEntrypoints}=await import('./check-message-entrypoints.mjs');
  const files = [
    'entry/src/main/ets/features/settings/ReaderLibrarySyncRecoveryDialog.ets',
    'entry/src/main/ets/features/common/ReaderRecoveryAction.ets',
    'entry/src/main/ets/features/common/ReaderRecoveryNotice.ets',
    'entry/src/main/ets/features/common/ReaderPageState.ets',
  ];
  const registry = JSON.parse(readFileSync(new URL('./message-entrypoints.json', import.meta.url), 'utf8'));
  const inventory = inventoryMessageEntrypoints({ files });
  assert.deepEqual(inventory.parseErrors, []);
  const recovery = inventory.entries.filter(row => row.family === 'shared.recovery-action');
  assert.deepEqual([...new Set(recovery.map(row=>row.file))].sort(),files.filter(file=>!file.endsWith('/ReaderRecoveryAction.ets')).sort(),
    'each actual registered recovery consumer is discovered independently of private Builder names or occurrence counts');
  assert.ok(recovery.every(row=>row.occurrences.length>0));
  assert.ok(!recovery.some(row => row.file.endsWith('/ReaderRecoveryAction.ets')),
    'component declaration/import/label text without an invocation never invents a business entry');
  const alerts = inventory.entries.filter(row => row.family === 'native.alert');
  assert.ok(alerts.length > 0);
  assert.ok(alerts.every(row => row.nativeOwnerCallback === true),
    'actual native calls are inside the real owner presentation callback');
  assert.equal(compareMessageEntrypoints(inventory, registry).status, 'PASS');

  const omitted = structuredClone(registry);
  omitted.entries = omitted.entries.filter(row => row.id !== recovery[0].id);
  assert.ok(compareMessageEntrypoints(inventory, omitted).failures.some(row =>
    row.kind === 'unregistered-entry' && row.id === recovery[0].id));
  const stale = structuredClone(inventory);
  stale.entries = stale.entries.filter(row => row.id !== recovery[0].id);
  assert.ok(compareMessageEntrypoints(stale, registry).failures.some(row =>
    row.kind === 'stale-registration' && row.id === recovery[0].id));
  const missingBridge = structuredClone(registry);
  delete missingBridge.entries.find(row => row.id === alerts[0].id).bridge;
  assert.ok(compareMessageEntrypoints(inventory, missingBridge).failures.some(row =>
    row.kind === 'alert-bypasses-owner' && row.id === alerts[0].id));
  const unowned = structuredClone(inventory);
  unowned.entries.find(row => row.id === alerts[0].id).nativeOwnerCallback = false;
  assert.ok(compareMessageEntrypoints(unowned, registry).failures.some(row =>
    row.kind === 'alert-bypasses-owner' && row.id === alerts[0].id));
  console.log(`PASS official SDK AST: ${recovery.length} recovery groups / ${recovery.reduce((n,row)=>n+row.occurrences.length,0)} actual calls, ${alerts.length} owned native callbacks; missing, stale, missing bridge and unowned callback rejected`);
  recordContractCasePass(id);
}
