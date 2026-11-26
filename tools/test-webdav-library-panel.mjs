import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ReaderNativeAlertOwner } from './lib/reader-native-alert-sdk-probe.mjs';
import { selectedProductionMethods } from './lib/selected-production-methods.mjs';

const file = new URL('../entry/src/main/ets/features/sync/ui/ReaderWebDavLibraryPanel.ets', import.meta.url);
const Panel = selectedProductionMethods(file, 'ReaderWebDavLibraryPanel', [
  'current', 'canAct', 'readConfiguration', 'refreshLocalCleanup', 'run', 'outcomeMessage',
  'requestArchiveRemoval', 'archiveDate', 'archiveSize', 'archiveLibrary',
], {
  resolveReaderButtonMatrixPaint: () => ({ surface: 'button', ink: 'text' }),
  readerAppColor: () => '#000000',
  DialogButtonStyle: { HIGHLIGHT: 'highlight' },
});

const selected = {
  sha256: 'a'.repeat(64), manifestSha256: 'b'.repeat(64), bytes: 4096, createdAt: 1700000000000,
  latest: false, canDelete: true, library: 'same', providerIdentity: 'current configuration',
};

function setup() {
  const dialogs = [];
  const requests = [];
  const messages = [];
  const panel = Object.assign(new Panel(), {
    mounted: true, revision: 1, loading: false, editing: false, configured: true, cleanupReceipt: '',
    pendingConfigId: '', archives: [selected], isInputAllowed: () => true, alert: new ReaderNativeAlertOwner(),
    feedback: { reset() {} }, readConfiguration: async () => {},
    showMessage(message, current) { if (current()) messages.push(message); },
    getUIContext: () => ({ showAlertDialog(dialog) {
      dialogs.push(dialog);
      dialog.onWillAppear();
      dialog.onDidAppear();
    } }),
    gateway: {
      async removeLibraryArchive(row) { requests.push(['remove', row]); return { state: 'retirementPending' }; },
      async listLibraryArchives() { return { state: 'empty', archives: [] }; },
      async resumeLibraryConfiguration(...args) { requests.push(['resume configuration', ...args]); return true; },
      async saveConfig() { assert.fail('pending original operation must not create a new configuration'); },
    },
  });
  return { panel, dialogs, requests, messages };
}

function decide(dialog, button) {
  dialog[button].action();
  dialog.onWillDisappear();
  dialog.onDidDisappear();
}

const nextTick = () => new Promise(resolve => setImmediate(resolve));

test('only current explicit native confirmation sends the exact selected archive', async () => {
  const { panel, dialogs, requests } = setup();
  panel.requestArchiveRemoval({ ...selected, latest: true, canDelete: false });
  assert.equal(dialogs.length, 0);
  panel.requestArchiveRemoval(selected);
  panel.requestArchiveRemoval(selected);
  assert.equal(dialogs.length, 1);
  assert.match(dialogs[0].message, /本库备份/);
  assert.deepEqual(requests, []);
  decide(dialogs[0], 'primaryButton');
  await nextTick();
  assert.deepEqual(requests, []);

  panel.requestArchiveRemoval(selected);
  decide(dialogs[1], 'secondaryButton');
  await nextTick();
  assert.deepEqual(requests, [['remove', selected]]);
});

test('a replaced WebDAV list or retired page cannot authorize the old selection', async () => {
  const { panel, dialogs, requests } = setup();
  panel.requestArchiveRemoval(selected);
  panel.archives = [{ ...selected, providerIdentity: 'a replacement configuration' }];
  decide(dialogs[0], 'secondaryButton');
  await nextTick();
  assert.deepEqual(requests, []);

  panel.confirmationOpen = false;
  panel.archives = [selected];
  panel.requestArchiveRemoval(selected);
  panel.revision += 1;
  decide(dialogs[1], 'secondaryButton');
  await nextTick();
  assert.deepEqual(requests, []);
});

test('interrupted configuration recovers the original ID and never starts a new save', async () => {
  const { panel, requests, messages } = setup();
  panel.pendingConfigId = 'original-operation';
  panel.configNeedsOriginal = true;
  await panel.run('saveConfig');
  assert.deepEqual(requests, []);

  Object.assign(panel, { editing: true, url: 'https://backup.example.invalid', user: 'user',
    password: 'from original request', backupPassword: 'original archive password', directory: '/ReaderBackups' });
  await panel.run('saveConfig');
  const [method, id, current, url, user, password, archivePassword, directory] = requests[0];
  assert.equal(method, 'resume configuration');
  assert.equal(id, 'original-operation');
  assert.equal(current(), true);
  assert.deepEqual([url, user, password, archivePassword, directory],
    ['https://backup.example.invalid', 'user', 'from original request', 'original archive password', '/ReaderBackups']);
  assert.equal(panel.password, '');
  assert.equal(panel.backupPassword, '');
  assert.deepEqual(messages, ['WebDAV 配置已保存']);
});

const gatewayFile = new URL('../entry/src/main/ets/features/sync/application/SyncGateway.ts', import.meta.url);
const libraryRoot = '/fixture/reader-webdav-library';
const provider = '1'.repeat(36);
const otherProvider = '2'.repeat(36);
const directory = `${libraryRoot}/${provider}`;
const encryptedName = `${'a'.repeat(64)}.readerbackup`;
const fixtureUrl = 'https://dav.example.invalid';

function setupLocalMaintenance(failMethod, failPath) {
  const directories = new Set([libraryRoot, directory]);
  const files = new Map([[`${directory}/${encryptedName}`, 'encrypted scratch']]);
  const removed = [];
  const forbiddenStatus = Object.assign(new Error('local volume permission failure'), { code: 'EACCES' });
  const absent = Object.assign(new Error('absent'), { code: 'ENOENT' });
  let fail = failMethod;
  let saved = { saveOperationId: provider, savePayloadHash: 'b'.repeat(64), config: { url: fixtureUrl } };
  let switchAtDirectoryRead = false;
  let retirementError = false;
  let credentialError = false;
  let payloadStat;
  const stat = (isDirectory, size) => ({ isDirectory: () => isDirectory, isFile: () => !isDirectory, size });
  const SyncGateway = selectedProductionMethods(gatewayFile, 'SyncGateway', [
    'libraryBackupConfiguration', 'sweepLibraryPayloads', 'retireUnusedLibraryPayloads',
    'unlinkUnownedLibraryPayload', 'libraryLocalStat', 'unlinkLibraryFile',
    'libraryProviderIdentity', 'libraryPublication', 'libraryCleanupReceipt', 'libraryDirectory',
    'runLibraryOperation', 'listLibraryArchives', 'previewLibraryBackup', 'restoreLibraryBackup',
    'backupLibrary', 'removeLibraryArchive', 'resumeLibraryRetirement', 'cancelLibraryPreview',
  ], {
    DEFAULT_WEBDAV_DIRECTORY: '/reader',
    LOCAL_RECOVERY_MAX_BYTES: 1024,
    SyncLibraryProviderChanged: class extends Error {},
    WebDavLibraryBackupError: class extends Error {},
    WebDavLibraryBackup: class {
      async listArchives() { return []; }
      async downloadLatest() { return 'downloaded'; }
    },
    fileIo: {
      async lstat(path) {
        if (fail === 'lstat' && path === failPath) throw forbiddenStatus;
        if (payloadStat && path === `${directory}/${encryptedName}`) {
          payloadStat.enter();
          await payloadStat.wait;
        }
        if (directories.has(path)) return stat(true, 0);
        if (files.has(path)) return stat(false, files.get(path).length);
        throw absent;
      },
      async listFile(path) {
        if (fail === 'listFile' && path === failPath) throw forbiddenStatus;
        if (switchAtDirectoryRead && path === directory) {
          saved = { ...saved, saveOperationId: otherProvider };
        }
        return [...directories, ...files.keys()]
          .filter(candidate => candidate.startsWith(`${path}/`))
          .map(candidate => candidate.slice(path.length + 1))
          .filter(candidate => !candidate.includes('/'));
      },
      async readText(path) { return files.get(path); },
      async unlink(path) {
        if (fail === 'unlink' && path === failPath) throw forbiddenStatus;
        if (!files.delete(path)) throw absent;
        removed.push(path);
      },
    },
  });
  SyncGateway.librarySweeps = new Set();
  SyncGateway.libraryOperations = new Set();
  SyncGateway.libraryStaging = new Set();
  const { panel, requests } = setup();
  const uiGateway = panel.gateway;
  const gateway = Object.assign(new SyncGateway(), {
    runtimeOwner: { async readLibraryBackupIdentity() { return undefined; } }, assertOwner() {}, isOwner: () => true,
    assertAdmission(current) { assert.ok(current()); }, authorization: () => undefined,
    async requireStoredConfig(config) { return config; },
    libraryRoot: () => libraryRoot,
    credentials: {
      async reconcileConfigIntent() { return undefined; },
      async loadSerializedState() { if (credentialError) throw forbiddenStatus; return saved; },
      async requireConfigSettled() {},
    },
    async libraryRetirement() { if (retirementError) throw forbiddenStatus; return undefined; },
    listLibraryArchives: async () => { requests.push(['list']); return { state: 'empty', archives: [] }; },
    previewLibraryBackup: async () => { requests.push(['preview']); return { state: 'preview' }; },
    restoreLibraryBackup: async () => { requests.push(['apply']); return { state: 'restored' }; },
    backupLibrary: async () => { requests.push(['backup']); return { state: 'exported' }; },
    removeLibraryArchive: uiGateway.removeLibraryArchive,
  });
  Object.assign(panel, { gateway, onRestoreStateChanged: () => {} });
  delete panel.readConfiguration;
  return { gateway, panel, files, directories, removed, requests,
    useProductionOperations() {
      for (const method of ['listLibraryArchives', 'previewLibraryBackup', 'restoreLibraryBackup',
        'backupLibrary', 'removeLibraryArchive']) delete gateway[method];
    },
    suspendPayloadStat() {
      let enter;
      let release;
      const reached = new Promise(resolve => { enter = resolve; });
      const wait = new Promise(resolve => { release = resolve; });
      payloadStat = { enter, wait };
      return { reached, release };
    },
    clearFault: () => { fail = undefined; },
    faultRetirement: () => { retirementError = true; },
    faultCredentials: () => { credentialError = true; },
    switchProviderOnDirectoryRead: () => { switchAtDirectoryRead = true; },
  };
}

test('a suspended staging sweep keeps remote list and restore usable while preventing shared staging writes', async () => {
  const { gateway, removed, useProductionOperations, suspendPayloadStat } = setupLocalMaintenance();
  useProductionOperations();
  gateway.libraryRetirement = async () => assert.fail('a staging mutation must wait until cleanup releases the path');
  const current = () => true;
  const recovery = {
    clearPreview() {},
    async inspectStagedPackage(_password, receive) {
      assert.equal(await receive('/fixture/recovery/selected.readerbackup'), true);
      return { state: 'preview' };
    },
    async applyPackage(_password, admit) {
      await admit();
      return { state: 'restored' };
    },
  };
  const { reached, release } = suspendPayloadStat();
  const sweep = gateway.sweepLibraryPayloads(provider, current);
  try {
    await reached;
    assert.deepEqual(removed, []);
    assert.equal(await gateway.sweepLibraryPayloads(provider, current), 'cancelled');
    assert.equal((await gateway.listLibraryArchives(current)).state, 'empty');
    assert.equal((await gateway.previewLibraryBackup(recovery, current)).state, 'preview');
    assert.equal((await gateway.restoreLibraryBackup(recovery, current)).state, 'restored');
    assert.equal((await gateway.backupLibrary(recovery, false, current)).state, 'cancelled');
    assert.equal((await gateway.removeLibraryArchive({ ...selected, providerIdentity: provider }, current)).state, 'cancelled');
    assert.equal((await gateway.resumeLibraryRetirement('receipt', current)).state, 'cancelled');
  } finally {
    release();
  }
  assert.equal(await sweep, 'done');
  assert.deepEqual(removed, [`${directory}/${encryptedName}`]);
});

for (const method of ['lstat', 'listFile', 'unlink']) {
  test(`local ${method} failure is retryable without blocking remote list or recovery`, async () => {
    const failurePath = method === 'unlink' ? `${directory}/${encryptedName}` : libraryRoot;
    const { panel, files, removed, requests, clearFault } = setupLocalMaintenance(method, failurePath);
    await panel.readConfiguration(panel.revision);
    await nextTick();
    assert.equal(panel.url, fixtureUrl);
    assert.equal(panel.loadError, false);
    assert.equal(panel.localCleanupPending, true);
    assert.deepEqual(removed, []);

    await panel.run('list');
    await panel.run('inspect');
    await panel.run('apply');
    assert.deepEqual(requests, [['list'], ['preview'], ['apply']]);

    clearFault();
    await panel.refreshLocalCleanup(panel.revision);
    assert.equal(panel.localCleanupPending, false);
    assert.equal(files.has(`${directory}/${encryptedName}`), false);
  });
}

test('unreadable journals pause only their operations and preserve their staging', async () => {
  const { panel, files, requests, removed, faultRetirement } = setupLocalMaintenance();
  files.set(`${directory}/publish.json`, 'malformed JSON');
  await panel.readConfiguration(panel.revision);
  await nextTick();
  assert.equal(panel.publicationUnavailable, true);
  assert.equal(panel.retirementUnavailable, false);
  assert.equal(panel.loadError, false);
  await panel.run('export');
  await panel.run('remove', selected);
  assert.deepEqual(requests, [['remove', selected], ['list']]);
  assert.deepEqual(removed, []);
  assert.equal(files.get(`${directory}/publish.json`), 'malformed JSON');

  files.delete(`${directory}/publish.json`);
  files.set(`${directory}/retirement.json`, 'unreadable journal');
  files.set(`${directory}/verify.readerbackup`, 'retirement staging');
  faultRetirement();
  await panel.readConfiguration(panel.revision);
  await nextTick();
  assert.equal(panel.publicationUnavailable, false);
  assert.equal(panel.retirementUnavailable, true);
  assert.equal(panel.loadError, false);
  await panel.run('remove', selected);
  await panel.run('retireParts');
  await panel.run('export');
  await panel.run('list');
  await panel.run('inspect');
  await panel.run('apply');
  assert.deepEqual(requests, [['remove', selected], ['list'], ['backup'], ['list'], ['preview'], ['apply']]);
  assert.equal(files.get(`${directory}/retirement.json`), 'unreadable journal');
  assert.equal(files.get(`${directory}/verify.readerbackup`), 'retirement staging');
});

test('a provider change during enumeration prevents any local unlink', async () => {
  const { gateway, removed, switchProviderOnDirectoryRead } = setupLocalMaintenance();
  switchProviderOnDirectoryRead();
  assert.equal(await gateway.sweepLibraryPayloads(provider, () => true), 'cancelled');
  assert.deepEqual(removed, []);
});

test('configuration read errors still surface independently of the local sweep', async () => {
  const { panel, faultCredentials } = setupLocalMaintenance();
  faultCredentials();
  await panel.readConfiguration(panel.revision);
  assert.equal(panel.loadError, true);
  assert.equal(panel.loading, false);
});
