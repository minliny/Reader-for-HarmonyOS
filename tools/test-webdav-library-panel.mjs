import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ReaderNativeAlertOwner } from './lib/reader-native-alert-sdk-probe.mjs';
import { selectedProductionMethods } from './lib/selected-production-methods.mjs';

const file = new URL('../entry/src/main/ets/features/sync/ui/ReaderWebDavLibraryPanel.ets', import.meta.url);
const Panel = selectedProductionMethods(file, 'ReaderWebDavLibraryPanel', [
  'current', 'canAct', 'run', 'outcomeMessage', 'requestArchiveRemoval', 'archiveDate', 'archiveSize', 'archiveLibrary',
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
