import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import * as selection from '../entry/src/main/ets/features/reading/ReaderControlSelectionTransaction.ts';
const file = process.env.READER_LRE_SOURCE ?? new URL('../entry/src/main/ets/features/reading/LocalReadingExperience.ets', import.meta.url);
const source = readFileSync(file, 'utf8');
const declaration = source.match(/class ReaderDeferredChapterSelection[\s\S]*?\n}/)[0];
const ReaderDeferredChapterSelection = new Function(`${stripTypeScriptTypes(declaration)};return ReaderDeferredChapterSelection;`)();
const methods = ['reconcileFailedControlSelection', 'selectionDisplayAnchor',
  ...(source.includes('private async recoverRefreshedChapterDisplay(') ? ['recoverRefreshedChapterDisplay'] : [])];
const Reader = productionMotionMethods(file, methods, { ...selection, ReaderDeferredChapterSelection });
const ticket = { sourceId: 's', bookId: 'b', lifecycleToken: 1, selectionToken: 3, controlOpenRevision: 2,
  targetChapterIndex: 4, closeOnCommit: false, refreshContent: true };
const owner = { ...ticket, mounted: true, exitRequested: false, controlVisible: true, controlClosing: false };
const stored = { bookId: 'b', chapterIndex: 4, chapterOffset: 0, chapterProgress: 0, updatedAt: 3,
  bodyVersion: 'new', processingVersion: 'new-p' };
const oldContext = { bodyVersion: 'old', processingVersion: 'old-p', anchors: [{ id: 'requested', offset: 120 }] };
for (const scenario of ['published', 'unchanged', 'no-proof', 'other-chapter', 'obsolete', 'read-failed']) {
  const calls = [], notices = [];
  const progress = { ...stored, ...(scenario === 'unchanged' ? { bodyVersion: 'old', processingVersion: 'old-p' } : {}),
    ...(scenario === 'other-chapter' ? { chapterIndex: 8 } : {}), ...(scenario === 'no-proof' ? { bodyVersion: undefined } : {}) };
  const p = Object.assign(new Reader(), {
    pendingControlSelection: ticket, pendingControlSelectionOrigin: undefined, pendingControlSelectionCandidate: undefined,
    pendingControlSelectionRetry: new ReaderDeferredChapterSelection(4, 120, false, true, undefined, 2, false, true, oldContext),
    controlSelectionOwner: () => ({ ...owner, mounted: scenario !== 'obsolete' }),
    paginationLayoutSignature: () => 'layout', readerSettingsSnapshot: { navigationMode: 'paged' },
    activeGateway: () => ({ runProgressCommitSerial: async work => { calls.push('serial'); await work(); },
      loadProgress: async () => { calls.push('read'); if (scenario === 'read-failed') throw Error('storage unavailable');
        return { kind: 'restored', progress }; } }),
    openChapter: async (...args) => { calls.push(args); },
    showControlSelectionFailure: (...args) => notices.push(args),
  });
  await p.reconcileFailedControlSelection(ticket, Error('page completion failed after Core publication'));
  const opens = calls.filter(Array.isArray);
  if (scenario === 'published') {
    assert.equal(opens.length, 1, 'a proven new persisted body must be rematerialized instead of retrying old scope');
    assert.deepEqual(opens[0], [4, false, 1, 3, 0, undefined, false,
      { bodyVersion: 'new', processingVersion: 'new-p', anchors: [{ id: 'requested', offset: 0 }] }]);
    assert.equal(p.pendingControlSelectionRetry.refreshContent, false, 'recovery uses cached committed body, no repeated HTTP replacement');
    assert.equal(p.pendingControlSelectionRetry.closeControlOnCommit, false);
    assert.equal(notices.length, 0);
    await p.reconcileFailedControlSelection(ticket, Error('repeated layout failure'));
    assert.equal(calls.filter(Array.isArray).length, 1, 'automatic rematerialization is bounded to one attempt');
    assert.equal(notices.length, 1, 'a repeated failure remains visible and manually retryable');
  } else {
    assert.equal(opens.length, 0, `${scenario}: never guess new positions`);
    assert.equal(notices.length, scenario === 'obsolete' ? 0 : 1);
  }
}
console.log('PH95 production serialized recovery: publish-before-layout failure, cache-only retry, one-attempt bound, stale/missing/conflicting evidence PASS');
