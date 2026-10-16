import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import { readingFailureHint } from '../entry/src/main/ets/features/reading/ReadingFailurePresentation.ts';
import { mangaUserError } from '../entry/src/main/ets/features/manga/MangaUserError.ts';

const file = new URL('../entry/src/main/ets/features/reading/LocalReadingExperience.ets', import.meta.url);
const Reader = productionMotionMethods(file, ['showReaderRecovery', 'settleReaderRecovery',
  'setReaderPreferenceNotice', 'settleReaderPreferenceNotice', 'retryReaderPreferenceNotice',
  'admitCommittedProgress', 'onBookTurnArkUIContentReady'], {
  ReadingCommit: class { constructor(...values) { this.progressRevision = values[10]; } },
});
function fixture() {
  return Object.assign(new Reader(), { sourceId: 'source', bookId: 'book', lifecycleToken: 3,
    chapterSelectionToken: 7, mounted: true, exitRequested: false,
    lastCommittedProgress: { progressRevision: 'revision:4' }, readerRecoveryView: { generation: 0 },
    readerSettingsRecovery: { generation: 0 }, ttsPreferencesRecovery: { generation: 0 },
    onReadingCommitted() {}, pageTurnRenderRevision: 19, bookTurn2DFallbackPending: false });
}
{
  const r = fixture(); r.showReaderRecovery('pending progress', '', undefined, 'progress');
  r.admitCommittedProgress({ progressRevision: 'revision:4' });
  assert.equal(r.readerRecoveryView.visible, true, 'same receipt is not new confirmation');
  r.admitCommittedProgress({ progressRevision: 'revision:5' });
  assert.equal(r.readerRecoveryView.visible, false, 'new admitted same-owner commit retires pending progress');
  r.showReaderRecovery('refresh body', 'retry', () => {});
  r.admitCommittedProgress({ progressRevision: 'revision:6' });
  assert.equal(r.readerRecoveryView.message, 'refresh body', 'progress cannot settle an unrelated recovery');
}
for (const field of ['sourceId', 'bookId', 'lifecycleToken', 'chapterSelectionToken']) {
  const r = fixture(); r.showReaderRecovery('pending', '', undefined, 'progress'); r[field] += '-new';
  r.settleReaderRecovery('progress', 'revision:5');
  assert.equal(r.readerRecoveryView.visible, true, `${field}: other owner cannot settle old operation`);
}
{
  const r = fixture(); r.showReaderRecovery('recovering frame', '', undefined, 'presentation');
  r.onBookTurnArkUIContentReady(18); assert.equal(r.readerRecoveryView.visible, true);
  r.onBookTurnArkUIContentReady(19); assert.equal(r.readerRecoveryView.visible, false);
  r.showReaderRecovery('pending progress', '', undefined, 'progress');
  r.onBookTurnArkUIContentReady(19); assert.equal(r.readerRecoveryView.visible, true, 'pixels are not durable ACK');
}
{
  const r = fixture(); let pending = true, retries = 0;
  r.readerSettingsGateway = { writeFacts: () => ({ pendingReconciliation: pending }) };
  r.settleReaderPreferenceNotice('settings', () => true);
  const old = r.readerSettingsRecovery.generation;
  assert.equal(r.readerSettingsRecovery.canRetry, true);
  r.setReaderPreferenceNotice('tts', 'tts pending', true);
  r.settleReaderPreferenceNotice('settings', () => false);
  assert.equal(r.readerSettingsRecovery.generation, old, 'retired completion cannot change current UI');
  pending = false; r.settleReaderPreferenceNotice('settings', () => true);
  assert.equal(r.readerSettingsRecovery.visible, false); assert.equal(r.ttsPreferencesRecovery.visible, true);
  r.setReaderPreferenceNotice('settings', 'new pending', true);
  r.isSessionActive = () => true; r.retryPendingReaderSettings = () => retries++;
  r.captureReaderSettingsAdmission = () => () => true; pending = true;
  r.retryReaderPreferenceNotice('settings', old); assert.equal(retries, 0, 'stale visible action is rejected');
  r.retryReaderPreferenceNotice('settings', r.readerSettingsRecovery.generation); assert.equal(retries, 1);
}
for (const raw of ['SQL failure /private/path secret', 'https://example.invalid/?token=private',
  'MANGA_SESSION_IDENTITY_MISMATCH', 'MANGA_CATALOG_REQUIRED', '无类型的上游私有正文', '']) {
  assert.ok(readingFailureHint(raw).length > 0); assert.ok(mangaUserError(raw).length > 0);
  if (raw) { assert.ok(!readingFailureHint(raw).includes(raw)); assert.ok(!mangaUserError(raw).includes(raw)); }
}
assert.match(readingFailureHint('private body', 'SOURCE_AUTH_REQUIRED'), /登录/);
assert.match(readingFailureHint('NO_SPACE'), /空间不足/);
const source = readFileSync(file, 'utf8');
assert.match(source, /this\.sourceSwitchFailureMessage : this\.failureHint/);
assert.match(source, /retryReaderPreferenceNotice\('settings', generation\)/);
assert.match(source, /retryReaderPreferenceNotice\('tts', generation\)/);
console.log('PASS production reader notice ownership, terminal receipts, presentation acknowledgement, independent preference facts, stale actions and fixed public failure copy');
