import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(repo, path), 'utf8');

const store = read('entry/src/main/ets/features/sync/WebDavCredentialStore.ts');
const gateway = read('entry/src/main/ets/features/sync/SyncGateway.ts');
const orchestrator = read('entry/src/main/ets/features/sync/SyncOrchestrator.ets');
const page = read('entry/src/main/ets/features/sync/SyncPage.ets');
const index = read('entry/src/main/ets/pages/Index.ets');
const ability = read('entry/src/main/ets/entryability/EntryAbility.ets');

assert.match(store, /import asset from '@ohos\.security\.asset'/);
assert.match(store, /backupPassword:\s*string/);
assert.match(store, /bookshelfViewMode\?:\s*'cover' \| 'list'/,
  'legacy Asset mode remains readable only for one-time migration');
assert.match(store, /loadBookshelfViewMode\(\)/);
assert.match(store, /saveBookshelfViewMode\(mode: 'cover' \| 'list', restoreOperationId\?: string\)/);
assert.match(store, /ensureLocalPreferences\(\)/,
  'bookshelf mode must have one durable local Preferences authority');
assert.match(store, /localModeWriteTail[\s\S]*readOrMigrateViewMode\(\)/,
  'all local mode reads and writes must share the serialized Preferences authority');
assert.doesNotMatch(store, /await this\.save\(\{ \.\.\.existing, bookshelfViewMode/,
  'mode must never be mirrored into a racing credential write');
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
const restoreLatest = gateway.slice(
  gateway.indexOf('async restoreLatest()'),
  gateway.indexOf('async resolveRestore()', gateway.indexOf('async restoreLatest()')),
);
assert.match(restoreLatest, /const stalePendingTransactionId = this\.pendingRestoreTransactionId/,
  'a new restore must account for a previously unresolved conflict');
assert.match(restoreLatest, /await this\.abortBestEffort\(stalePendingTransactionId\)/,
  'a repeated restore must abort the stale Core transaction before starting another');
assert.ok(
  restoreLatest.indexOf('abortBestEffort(stalePendingTransactionId)') <
    restoreLatest.indexOf("this.startTransaction('restore'"),
  'stale restore cleanup must happen before the new transaction starts',
);
assert.match(gateway, /isAlreadyClosedTransactionError\(error\)/,
  'an already-completed Core transaction must be an idempotent abort outcome');
assert.match(gateway, /MAX_WEBDAV_DIRECTORY_LENGTH/,
  'WebDAV directory input must have a bounded Host-side length');
assert.match(gateway, /normalized\.toLowerCase\(\)\.includes\('%2e'\)/,
  'WebDAV directory input must reject encoded dot traversal before persistence');
assert.match(gateway, /\\u0000-\\u001f\\u007f/,
  'WebDAV directory input must reject control characters before persistence');
assert.match(gateway, /assertTransactionIdentity\(current\.transactionId, advanced\.transactionId/,
  'every Core WebDAV advance response must remain bound to the transaction being driven');
assert.match(gateway, /assertTransactionIdentity\(current\.transactionId, completed\.transactionId/,
  'every Core WebDAV commit response must remain bound to the transaction being driven');
assert.match(gateway, /assertTransactionIdentity\(transactionId, resolved\.transactionId/,
  'a restore resolution response must not switch to another transaction');
assert.match(gateway, /MAX_TRANSACTION_REQUESTS = 100/,
  'Host must bound the number of Core-emitted WebDAV requests per phase');

// A lost resolve/commit response can leave the Core row already removed. The
// next abort then returns the structured INVALID_PARAMS error below; verify
// the production classifier accepts only that exact deterministic condition,
// not arbitrary validation or transport failures.
const classifierStart = gateway.indexOf('  private isAlreadyClosedTransactionError(error: unknown)');
assert.ok(classifierStart >= 0, 'SyncGateway must expose the closed-transaction classifier');
const classifierEnd = gateway.indexOf('\n  private ', classifierStart + 1);
const classifierMethod = gateway.slice(classifierStart, classifierEnd < 0 ? gateway.length : classifierEnd);
const ClassifierProbe = new Function(
  `${stripTypeScriptTypes(`class Probe { ${classifierMethod} }`)}; return Probe;`,
)();
const classifier = new ClassifierProbe();
assert.equal(classifier.isAlreadyClosedTransactionError({
  event: { error: { code: 'INVALID_PARAMS', message: 'unknown or completed WebDAV transaction' } },
}), true);
assert.equal(classifier.isAlreadyClosedTransactionError({
  event: { error: { code: 'INVALID_PARAMS', message: 'transaction id is invalid' } },
}), false);
assert.equal(classifier.isAlreadyClosedTransactionError(new Error('network timeout')), false);

assert.doesNotMatch(orchestrator, /hilog|console\./,
  'orchestration statuses must be user-safe and must not log secrets');
assert.match(orchestrator, /operationInFlight/);
assert.match(orchestrator, /saveConfig\(url, user, pass, backupPass, directory\)/);

assert.match(page, /onSaveConfig/);
assert.match(page, /aboutToAppear\(\)[\s\S]*this\.appliedSnapshotIdentity\s*=\s*'';[\s\S]*this\.syncSnapshotInputs\(\)/,
  'mount must re-project secure-loaded non-secret identity after an early @Watch');
for (const field of ['Url', 'User', 'Path']) {
  assert.match(page, new RegExp(`private effectiveWebdav${field}\\(\\): string`));
  assert.match(page, new RegExp(`this\\.effectiveWebdav${field}\\(\\)`));
}
assert.match(page, /return this\.webdavUrlEdited \? this\.webdavUrl : this\.snapshot\.webdavUrl/);
assert.match(page, /return this\.webdavUserEdited \? this\.webdavUser : this\.snapshot\.webdavUser/);
assert.match(page, /return this\.webdavPathEdited \? this\.webdavPath : this\.snapshot\.webdavPath/);
assert.match(page, /备份加密密码/);
for (const asset of ['sync_server', 'sync_account', 'sync_password', 'sync_backup_password', 'sync_folder']) {
  assert.ok(page.includes(`app.media.${asset}`), `WebDAV field must use semantic icon ${asset}`);
}
for (const alias of ['bookshelf_rss', 'directory_bookmark', 'directory_bookmark_on',
  'reader_directory_directory']) {
  assert.ok(!page.includes(`app.media.${alias}`), `WebDAV must not reuse unrelated icon ${alias}`);
}
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
assert.match(index, /this\.shelfBooks = state\.shelf\.books\.map[\s\S]*copyShelfBookWithSourceName\(book, name\)/,
  'source display names must be an immutable projection of the Core shelf');
assert.match(ability, /loadBookshelfViewMode\(\)[\s\S]*AppStorage\.setOrCreate\('readerBookshelfViewMode', mode\)/,
  'cold start must hydrate the projection before the first page is mounted');

console.log('WebDAV product boundary/static contract: PASS');
