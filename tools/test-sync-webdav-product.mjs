import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(repo, path), 'utf8');

const store = read('entry/src/main/ets/features/sync/WebDavCredentialStore.ts');
const gateway = read('entry/src/main/ets/features/sync/SyncGateway.ts');
const orchestrator = read('entry/src/main/ets/features/sync/SyncOrchestrator.ets');
const page = read('entry/src/main/ets/features/sync/SyncPage.ets');
const index = read('entry/src/main/ets/pages/Index.ets');

assert.match(store, /import asset from '@ohos\.security\.asset'/);
assert.match(store, /backupPassword:\s*string/);
assert.match(store, /ASSET_ALIAS\s*=\s*'reader\.webdav\.config\.v2'/);
assert.match(store, /FORMAT_VERSION\s*=\s*2/);
assert.match(store, /asset\.Tag\.SECRET/);
assert.match(store, /asset\.Accessibility\.DEVICE_POWERED_ON/);
assert.doesNotMatch(store, /IS_PERSISTENT|UNINSTALL/,
  'WebDAV credentials must be removed with the application');
assert.doesNotMatch(store, /hilog|console\.|logger/i,
  'the sole secret store must not log credentials or payloads');

for (const method of [
  'sync.webdav.transaction.start',
  'sync.webdav.transaction.advance',
  'sync.webdav.transaction.resolve',
  'sync.webdav.transaction.commit',
  'sync.webdav.transaction.abort',
]) {
  assert.ok(gateway.includes(method), `SyncGateway must drive Core method ${method}`);
}
assert.match(gateway, /HttpExecuteHost\.instance\.execute\(current\.requests\[index\]\)/);
assert.match(gateway, /runtime\.storage\.apply/);
assert.match(gateway, /runtime\.storage\.flush/);
assert.doesNotMatch(gateway, /sync\.webdav\.plan|sync\.webdav\.directory\.list\.plan|sync\.webdav\.multistatus\.parse/,
  'the product gateway must not reconstruct generic WebDAV algorithms');
assert.doesNotMatch(gateway, /\.sort\(|localeCompare|endsWith\(.*reader-backup/,
  'latest-backup selection and retention sorting belong to Core');
assert.doesNotMatch(gateway,
  /(localChecksum|remoteChecksum)\s*[!=]==?\s*(localChecksum|remoteChecksum)/,
  'the Host must render Core conflict summaries, not decide conflicts');
assert.match(gateway, /webdavPass:\s*''/);
assert.match(gateway, /backupPass:\s*''/);
assert.match(gateway, /params\['encryptionKey'\]\s*=\s*config\.backupPassword/);

assert.doesNotMatch(orchestrator, /hilog|console\./,
  'orchestration statuses must be user-safe and must not log secrets');
assert.match(orchestrator, /operationInFlight/);
assert.match(orchestrator, /saveConfig\(url, user, pass, backupPass, directory\)/);

assert.match(page, /onSaveConfig/);
assert.match(page, /aboutToAppear\(\)[\s\S]*this\.appliedSnapshotIdentity\s*=\s*'';[\s\S]*this\.syncSnapshotInputs\(\)/,
  'mount must re-project secure-loaded non-secret identity after an early @Watch');
assert.match(page, /备份加密密码/);
assert.match(page, /恢复最新备份/);
assert.match(page, /覆盖本机/);
assert.match(page, /自动备份（尚未启用）/);
assert.match(page, /this\.gatedRow\('备份频率', this\.snapshot\.backupFrequency\)/);
const autoSection = page.slice(page.indexOf('private autoBackupSection()'), page.indexOf('private gatedRow('));
assert.doesNotMatch(autoSection, /ReaderSelect|onToggle|onSelect/,
  'automatic backup must stay visibly gated until the foreground journey passes');
assert.doesNotMatch(page, /private autoRow\(|private buildOverlay\(/,
  'dormant automatic backup controls must not remain callable');

assert.match(index, /this\.getSyncOrchestrator\(\)\.open\(\)/);
assert.match(index, /onSyncSaveConfig/);
assert.match(index, /onSyncRestoreLatest/);
assert.match(index, /onSyncResolveRestore/);

console.log('WebDAV product boundary/static contract: PASS');
