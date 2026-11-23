import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';
import { inventoryMessageEntrypoints, compareMessageEntrypoints } from './check-message-entrypoints.mjs';

const definitions = {
  'recovery-actions': { description: '官方AST当前ReaderRecoveryAction真实入口及公共桥、缺登记/缺原生bridge/游离callback负例', resources: [] },
};
for (const id of selectContractCases(definitions)) {
  const files = [
    'entry/src/main/ets/features/settings/ui/SettingsPage.ets',
    'entry/src/main/ets/features/source/ui/SourceToolsPage.ets',
    'entry/src/main/ets/ui/feedback/ReaderRecoveryAction.ets',
    'entry/src/main/ets/ui/feedback/ReaderRecoveryNotice.ets',
    'entry/src/main/ets/ui/feedback/ReaderPageState.ets',
  ];
  const registry = JSON.parse(readFileSync(new URL('./message-entrypoints.json', import.meta.url), 'utf8'));
  const inventory = inventoryMessageEntrypoints({ files });
  assert.deepEqual(inventory.parseErrors, []);
  const recovery = inventory.entries.filter(row => row.family === 'shared.recovery-action');
  assert.deepEqual(recovery.map(row => `${row.owner}.${row.member}`), [
    'SettingsPage.operationFeedback', 'SourceToolsPage.recoveryAction',
    'ReaderPageState.build', 'ReaderRecoveryNotice.build',
  ]);
  assert.deepEqual(recovery.map(row => row.occurrences.length), [1, 1, 2, 3]);
  assert.ok(!recovery.some(row => row.file.endsWith('/ReaderRecoveryAction.ets')),
    'component declaration/import/label text without an invocation never invents a business entry');
  const alerts = inventory.entries.filter(row => row.family === 'native.alert');
  assert.equal(alerts.length, 3);
  assert.ok(alerts.every(row => row.nativeOwnerCallback === true),
    'all three actual native calls are inside the real owner presentation callback');
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
  console.log('PASS official SDK AST: 4 recovery-action groups / 7 calls, 3 owned native callbacks; missing, stale, missing bridge and unowned callback rejected');
  recordContractCasePass(id);
}
