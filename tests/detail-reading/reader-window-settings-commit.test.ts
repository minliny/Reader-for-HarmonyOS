import assert from 'node:assert/strict';
import test from 'node:test';
import { completeReaderWindowSettingsCommit, type ReaderWindowSettingsCommitPort } from '../../entry/src/main/ets/features/reading/application/ReaderWindowSettingsCommit';
import { createDefaultReaderSettingsSnapshot, safeReaderWindowSettingsFallback, type ReaderSettingsSnapshot } from '../../entry/src/main/ets/features/reading/application/ReaderSettingsState';

const before = createDefaultReaderSettingsSnapshot();
const requested: ReaderSettingsSnapshot = { ...before, hideStatusBar: true };

function recordingPort(events: string[]): ReaderWindowSettingsCommitPort {
  return {
    current: () => true,
    async applyPolicy(settings) { events.push(settings === requested ? 'apply' : 'rollback'); },
    acceptAppliedPolicy() { events.push('accept'); },
    restorePreviousSettings() { events.push('restore'); },
    async save(settings) {
      assert.equal(settings, requested);
      events.push('save');
    },
    notifySavePending(error) { events.push(error.message); },
    notifyPolicyRestored(error) { events.push(error.message); },
    finishPolicyRequest() { events.push('finish'); },
  };
}

test('window settings apply native policy before placing the durable save', async () => {
  const events: string[] = [];
  await completeReaderWindowSettingsCommit(before, requested, recordingPort(events));
  assert.deepEqual(events, ['apply', 'accept', 'save', 'finish']);
});

test('missing save acknowledgement preserves the accepted native policy', async () => {
  const events: string[] = [];
  const port = recordingPort(events);
  port.save = async () => {
    events.push('save');
    throw new Error('missing acknowledgement');
  };
  await completeReaderWindowSettingsCommit(before, requested, port);
  assert.deepEqual(events, ['apply', 'accept', 'save', 'missing acknowledgement', 'finish']);
});

test('native failure starts restoration before reporting and tolerates failed rollback', async () => {
  const events: string[] = [];
  const port = recordingPort(events);
  const apply = port.applyPolicy;
  port.applyPolicy = async settings => {
    await apply(settings);
    throw new Error(settings === requested ? 'window rejected request' : 'window rejected rollback');
  };
  await completeReaderWindowSettingsCommit(before, requested, port);
  assert.deepEqual(events, ['apply', 'restore', 'rollback', 'window rejected request', 'finish']);
});

test('stale requests admit neither native success nor native failure', async () => {
  for (const failure of [false, true]) {
    const events: string[] = [];
    const port = recordingPort(events);
    port.current = () => false;
    port.applyPolicy = async () => {
      events.push('apply');
      if (failure) throw new Error('retired request');
    };
    await completeReaderWindowSettingsCommit(before, requested, port);
    assert.deepEqual(events, ['apply', 'finish']);
  }
});

test('reader window fallback keeps reading choices and resets window-owned fields', () => {
  const selected: ReaderSettingsSnapshot = { ...requested, hideNavigationBar: true, extendIntoCutout: true,
    screenDirection: 'landscape', screenTimeout: 'alwaysOn', navigationMode: 'continuous',
    pageTransition: 'cover', volumeKeysTurnPage: true, widePageLayout: 'single', longPressSelectText: false };
  const fallback = safeReaderWindowSettingsFallback(selected);
  assert.equal(fallback.screenDirection, 'system');
  assert.equal(fallback.screenTimeout, 'system');
  assert.equal(fallback.hideStatusBar, false);
  assert.equal(fallback.hideNavigationBar, false);
  assert.equal(fallback.extendIntoCutout, false);
  assert.equal(fallback.navigationMode, selected.navigationMode);
  assert.equal(fallback.pageTransition, selected.pageTransition);
  assert.equal(fallback.volumeKeysTurnPage, selected.volumeKeysTurnPage);
  assert.equal(fallback.widePageLayout, selected.widePageLayout);
  assert.equal(fallback.longPressSelectText, selected.longPressSelectText);
});
