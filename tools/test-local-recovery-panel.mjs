import assert from 'node:assert/strict';
import { selectedProductionMethods } from './lib/selected-production-methods.mjs';
import { ReaderNativeAlertOwner } from './lib/reader-native-alert-sdk-probe.mjs';

const file = new URL('../entry/src/main/ets/features/bookshelf/ui/LocalRecoveryPanel.ets', import.meta.url);
const Panel = selectedProductionMethods(file, 'LocalRecoveryPanel', [
  'aboutToAppear', 'aboutToDisappear', 'retireOpening', 'refreshOpening', 'current', 'readPending',
  'canStart', 'clearPreview', 'requestRestore', 'perform', 'originalCounts', 'showOutcome',
], { readerAppColor: () => '#cc0000', resolveReaderButtonMatrixPaint: () => ({ surface: 'button', ink: 'text' }),
  DialogButtonStyle: { HIGHLIGHT: 'highlight' } });
const tick = () => new Promise(resolve => setImmediate(resolve));

function fixture(overrides = {}) {
  const events = [], notices = [], dialogs = [];
  const gateway = {
    pendingAction: async () => undefined,
    clearPreview() { events.push('clearPreview'); },
    async inspectPackage() { events.push('inspect'); return { state: 'preview', included: 2, missing: 1 }; },
    async applyPackage() { events.push('apply'); return { state: 'restored', included: 2, missing: 1 }; },
    async exportPackage() { events.push('export'); return { state: 'exported', included: 2, missing: 1 }; },
    async resumePackage() { events.push('resume'); return { state: 'restored' }; },
    ...overrides,
  };
  const panel = Object.assign(new Panel(), {
    revision: 0, navigationGeneration: 1, passphrase: '', isInputAllowed: () => true,
    gateway, alert: new ReaderNativeAlertOwner(),
    feedback: { reset() {}, show(_context, options, current) { if (current()) notices.push(options.message); } },
    getUIContext: () => ({ showAlertDialog(dialog) {
      dialogs.push(dialog); dialog.onWillAppear(); dialog.onDidAppear();
    } }),
  });
  return { panel, events, notices, dialogs };
}

function decide(dialog, button) {
  dialog[button].action();
  dialog.onWillDisappear(); dialog.onDidDisappear();
}

{
  const { panel, events, notices, dialogs } = fixture();
  panel.aboutToAppear(); await tick();
  await panel.perform('inspect', panel.revision);
  assert.deepEqual(events, ['clearPreview']);
  panel.passphrase = 'fixture passphrase';
  await panel.perform('inspect', panel.revision);
  assert.deepEqual(events, ['clearPreview', 'inspect']);
  assert.equal(panel.originalCounts(panel.preview), '包含原书 2 本，缺少原书 1 本。');
  panel.requestRestore(panel.revision); panel.requestRestore(panel.revision);
  assert.equal(dialogs.length, 1);
  decide(dialogs[0], 'primaryButton'); await tick();
  assert.deepEqual(events, ['clearPreview', 'inspect']);
  panel.requestRestore(panel.revision);
  assert.equal(dialogs.length, 2);
  decide(dialogs[1], 'secondaryButton'); await tick();
  assert.deepEqual(events, ['clearPreview', 'inspect', 'apply']);
  assert.equal(panel.passphrase, '');
  assert.deepEqual(notices, ['阅读库已恢复。包含原书 2 本，缺少原书 1 本。']);
  panel.aboutToDisappear();
}
console.log('PASS local recovery previews original counts and applies only after one current native confirmation');

{
  let pending = true;
  const { panel, events, notices } = fixture({
    pendingAction: async () => pending ? 'restore' : undefined,
    async resumePackage(passphrase) {
      assert.equal(passphrase, 'fixture passphrase');
      events.push('resume');
      if (!pending) return { state: 'failed' };
      if (events.filter(event => event === 'resume').length === 1) return { state: 'interrupted' };
      pending = false;
      return { state: 'restored' };
    },
  });
  panel.aboutToAppear(); await tick();
  assert.equal(panel.pendingRestore, true);
  panel.passphrase = 'fixture passphrase';
  await panel.perform('export', panel.revision);
  await panel.perform('resume', panel.revision);
  assert.equal(panel.pendingRestore, true);
  assert.equal(panel.passphrase, '');
  assert.deepEqual(events, ['clearPreview', 'resume']);
  assert.deepEqual(notices, []);
  panel.aboutToDisappear(); panel.aboutToAppear(); await tick();
  assert.equal(panel.pendingRestore, true);
  panel.passphrase = 'fixture passphrase';
  await panel.perform('resume', panel.revision);
  assert.equal(panel.pendingRestore, false);
  assert.deepEqual(notices, ['阅读库已恢复。']);
  panel.aboutToDisappear();
}
console.log('PASS interrupted local recovery survives re-entry and only then resumes with a newly supplied passphrase');

{
  let deliver;
  const pendingResult = new Promise(resolve => { deliver = resolve; });
  const { panel, dialogs, events, notices } = fixture({ inspectPackage: () => pendingResult });
  panel.aboutToAppear(); await tick();
  panel.passphrase = 'fixture passphrase';
  const reading = panel.perform('inspect', panel.revision);
  panel.navigationGeneration++;
  panel.refreshOpening(); await tick();
  deliver({ state: 'preview', included: 2, missing: 1 });
  await reading;
  assert.equal(panel.preview, undefined);
  assert.equal(panel.passphrase, '');
  assert.deepEqual(notices, []);
  panel.passphrase = 'fixture passphrase';
  await panel.perform('inspect', panel.revision);
  panel.requestRestore(panel.revision);
  panel.aboutToDisappear();
  decide(dialogs[0], 'secondaryButton'); await tick();
  assert.equal(events.includes('apply'), false, 'retired native callback cannot start a restore');
}
console.log('PASS late picker and native confirmation callbacks cannot apply against a retired settings opening');

{
  let pending = 'restore';
  const { panel, events, notices, dialogs } = fixture({
    pendingAction: async () => pending,
    async rollbackPackage(passphrase) {
      assert.equal(passphrase, 'fixture passphrase');
      events.push('rollback');
      pending = 'rollback';
      return { state: 'interrupted' };
    },
    async resumePackage(passphrase) {
      assert.equal(passphrase, 'fixture passphrase');
      events.push('resume-rollback');
      pending = undefined;
      return { state: 'rolledBack' };
    },
  });
  panel.aboutToAppear(); await tick();
  panel.passphrase = 'fixture passphrase';
  panel.requestRestore(panel.revision, 'rollback'); await tick();
  assert.equal(dialogs[0].title, '回退未完成的恢复');
  decide(dialogs[0], 'primaryButton'); await tick();
  assert.deepEqual(events, ['clearPreview']);
  panel.requestRestore(panel.revision, 'rollback');
  decide(dialogs[1], 'secondaryButton'); await tick();
  assert.equal(panel.rollbackPending, true);
  panel.aboutToDisappear(); panel.aboutToAppear(); await tick();
  assert.equal(panel.rollbackPending, true);
  assert.equal(panel.passphrase, '');
  panel.passphrase = 'fixture passphrase';
  await panel.perform('resume', panel.revision);
  assert.deepEqual(events.filter(event => event !== 'clearPreview'), ['rollback', 'resume-rollback']);
  assert.deepEqual(notices, ['已回退到恢复前的阅读库']);
  assert.equal(panel.pendingRestore, false);
}
console.log('PASS rollback requires confirmation and resumes the already accepted rollback after opening retirement');
