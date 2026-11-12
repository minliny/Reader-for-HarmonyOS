import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { selectedProductionMethods } from './lib/selected-production-methods.mjs';
import { ReaderNavigation } from '../entry/src/main/ets/app/navigation/ReaderNavigation.ts';
import { readerDirectoryNoteMissingNavigation } from '../entry/src/main/ets/features/reading/application/ReaderDirectoryNavigation.ts';

import { ReaderDirectoryBackfill } from '../entry/src/main/ets/features/reading/application/ReaderDirectoryBackfill.ts';
import { actualReadingEntryPresentation } from './lib/reading-entry-presentation-probe.mjs';

const indexPath = fileURLToPath(new URL('../entry/src/main/ets/pages/Index.ets', import.meta.url));
const owner = {
  supportsCoreCapability: capability => capability === 'reading.directory.view.v2',
  retainedLocalBookSourcePath: async bookId => bookId,
  request: async (method, { bookId }) => {
    repairs.push(bookId);
    return { data: { status: 'ready', navigationRevision: 'fixture' } };
  },
};
const repairs = [];
const frames = [];
const ReadingEntry = actualReadingEntryPresentation();
const Index = selectedProductionMethods(indexPath, 'Index',
  ['readingEntryActionPorts', 'currentReadingRuntime', 'isCurrentRuntime'], {
    LOCAL_SOURCE_ID: 'local', DOMAIN: 0x5244, hilog: { info() {}, warn() {} },
    ReaderRuntimeOwner: { isCurrent: candidate => candidate === owner },
    ReaderNavigationBackfillFrame: class { constructor(action) { this.action = action; } onFrame() { this.action(); } },

  });
const EntryActions = selectedProductionMethods(
  new URL('../entry/src/main/ets/app/composition/ReaderReadingEntryActions.ets', import.meta.url),
  'ReaderReadingEntryActions', ['readingReadyCallback', 'scheduleNavigationBackfillAfterReady']);

function reader(bookId, kind = 'epub') {
  const presented = [];
  const navigation = new ReaderNavigation();
  navigation.show('reading');
  const page = Object.assign(new Index(), {
    shelfReceiptRetired: false, shelfMotion: { pendingExitId: -1 }, route: 'reading',
    readingEntry: Object.assign(new ReadingEntry(), { book: { sourceId: 'local', bookId, kind }, sessionActive: true, readyGeneration: 7 }),
    mountedRuntimeOwner: owner, detailShelfAdmissionMount: 1, navigationGeneration: navigation.snapshot().generation,
    navigationOwner: navigation, libraryAcquisition: { currentOwner: () => owner },
    getUIContext: () => ({ postFrameCallback: frame => frames.push(frame) }),
  });
  // Execute the unchanged production ready/backfill methods through the real
  // root ports. Keep the existing page-presentation observation seam.
  page.readingEntryActions = Object.assign(new EntryActions(), {
    navigation, ports: page.readingEntryActionPorts(),
    presentPreparedReading: chapterIndex => presented.push(chapterIndex),
  });
  return { page, presented };
}

{
  const { page, presented } = reader('old-epub');
  readerDirectoryNoteMissingNavigation('old-epub', 'navigationMissingOrStale');
  page.readingEntryActions.readingReadyCallback('local', 'old-epub', 7)(2);
  assert.deepEqual(presented, [2]);
  assert.deepEqual(repairs, [], 'a directory miss cannot reparse before readable frame');
  frames.shift().onFrame();
  await Promise.resolve();
  await Promise.resolve();
  assert.deepEqual(repairs, ['old-epub'], 'prior detail miss starts one repair after readable frame');
  page.readingEntryActions.readingReadyCallback('local', 'old-epub', 7)(2);
  readerDirectoryNoteMissingNavigation('old-epub', 'navigationMissingOrStale');
  assert.deepEqual(repairs, ['old-epub'], 'one session never repeats archive reparsing');
  page.readingEntry.endReading(owner);
}
{
  const { page } = reader('late-epub');
  page.readingEntryActions.readingReadyCallback('local', 'late-epub', 7)(0);
  frames.shift().onFrame();
  await Promise.resolve();
  await Promise.resolve();
  assert.deepEqual(repairs, ['old-epub'], 'reading ready alone performs no Core navigation work');
  await readerDirectoryNoteMissingNavigation('late-epub', 'navigationMissingOrStale');
  assert.deepEqual(repairs, ['old-epub', 'late-epub'], 'later directory miss is repaired after already readable frame');
  page.readingEntry.endReading(owner);
}
{
  const { page } = reader('stale-epub');
  readerDirectoryNoteMissingNavigation('stale-epub', 'navigationMissingOrStale');
  page.readingEntryActions.readingReadyCallback('local', 'stale-epub', 7)(0);
  page.navigationGeneration = page.navigationOwner.advance().generation;
  frames.shift().onFrame();
  await Promise.resolve();
  await Promise.resolve();
  assert.deepEqual(repairs, ['old-epub', 'late-epub'], 'stale reading session cannot backfill');
}
{
  const { page } = reader('local-txt', 'txt');
  readerDirectoryNoteMissingNavigation('local-txt', 'navigationMissingOrStale');
  page.readingEntryActions.readingReadyCallback('local', 'local-txt', 7)(0);
  assert.equal(frames.length, 1, 'TXT preparation is deferred until a readable frame');
  assert.deepEqual(repairs, ['old-epub', 'late-epub']);
  frames.shift().onFrame();
  await Promise.resolve();
  await Promise.resolve();
  assert.deepEqual(repairs, ['old-epub', 'late-epub', 'local-txt']);
  page.readingEntry.endReading(owner);
}

console.log('PH42 retained EPUB backfill only after directory miss and readable frame: PASS');

for (const kind of ['local', ' LOCAL ', ' TxT ']) {
  const bookId = `production-txt-${kind}`;
  const { page } = reader(bookId, kind);
  const before = repairs.length;
  readerDirectoryNoteMissingNavigation(bookId, 'navigationMissingOrStale');
  page.readingEntryActions.readingReadyCallback('local', bookId, 7)(0);
  assert.equal(repairs.length, before, 'production TXT aliases never prepare before visible frame');
  assert.equal(frames.length, 1);
  frames.shift().onFrame();
  await Promise.resolve();
  await Promise.resolve();
  assert.deepEqual(repairs.slice(before), [bookId]);
  page.readingEntry.endReading(owner);
  const staleId = `${bookId}-stale`, stale = reader(staleId, kind).page;
  readerDirectoryNoteMissingNavigation(staleId, 'navigationMissingOrStale');
  stale.readingEntryActions.readingReadyCallback('local', staleId, 7)(0);
  stale.navigationGeneration = stale.navigationOwner.advance().generation;
  frames.shift().onFrame();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(repairs.length, before + 1, 'stale alias session cannot prepare');
}
{
  const { page } = reader('unsupported-local-pdf', 'pdf');
  readerDirectoryNoteMissingNavigation('unsupported-local-pdf', 'navigationMissingOrStale');
  page.readingEntryActions.readingReadyCallback('local', 'unsupported-local-pdf', 7)(0);
  assert.equal(frames.length, 0, 'unsupported formats do not enter TXT preparation');
}
console.log('PASS production TXT local/TXT tags, case/whitespace normalization, visible-frame admission and stale-session rejection');

{
  const { page } = reader('chapter-navigation-generation', 'local');
  page.readingEntryActions.readingReadyCallback('local', 'chapter-navigation-generation', 7)(0);
  frames.shift().onFrame();
  await Promise.resolve();
  await Promise.resolve();
  const before = repairs.length;
  // A manual chapter selection advances navigationGeneration while retaining
  // the same reading entry, book, and readingReadyGeneration.
  page.navigationGeneration = page.navigationOwner.advance().generation;
  page.readingEntryActions.readingReadyCallback('local', 'chapter-navigation-generation', 7)(1);
  assert.equal(frames.length, 1, 'new committed chapter must rearm a stale observer');
  frames.shift().onFrame();
  await Promise.resolve();
  await Promise.resolve();
  await readerDirectoryNoteMissingNavigation('chapter-navigation-generation', 'navigationMissingOrStale');
  assert.deepEqual(repairs.slice(before), ['chapter-navigation-generation']);
  page.readingEntryActions.readingReadyCallback('local', 'chapter-navigation-generation', 7)(1);
  assert.equal(frames.length, 0, 'same committed generation does not repeat preparation');
  page.readingEntry.endReading(owner);
}
console.log('PASS same-book manual chapter generation rearms navigation backfill');

{
  const coordinator = new ReaderDirectoryBackfill();
  const attempts = [];
  const runtime = {
    supportsCoreCapability: () => true,
    request: () => new Promise(resolve => attempts.push(resolve)),
  };
  coordinator.arm({ key: 'shared', bookId: 'shared-txt', format: 'txt', runtime,
    current: () => true, postFrame: callback => callback() });
  const notify = (retry = false) => readerDirectoryNoteMissingNavigation('shared-txt', 'navigationMissingOrStale', retry);
  const first = notify();
  assert.equal(notify(), first, 'directory surfaces await the same pending preparation');
  assert.equal(notify(true), first, 'explicit retry does not fork pending work');
  attempts[0]({ data: { status: 'unavailable', reason: 'bodyMissingOrBudget' } });
  assert.equal((await first).reason, 'bodyMissingOrBudget');
  assert.equal(notify(), first, 'automatic reopen does not loop on transient failure');
  const retry = notify(true);
  assert.notEqual(retry, first, 'a deliberate retry can recover a real failure');
  assert.equal(notify(true), retry);
  attempts[1]({ data: { status: 'unavailable', reason: 'NoStructure' } });
  assert.equal((await retry).reason, 'NoStructure');
  assert.equal(notify(true), retry, 'a definitive flat catalog does not repeat work in the same session');
  coordinator.retire();
}
console.log('PASS directory surfaces share one preparation and retry only genuine failure');
