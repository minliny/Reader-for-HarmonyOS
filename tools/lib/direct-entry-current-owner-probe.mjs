import assert from 'node:assert/strict';
import { pureModuleProbe } from './ets-pure-module-probe.mjs';
import { actualReaderDirectoryJourney } from './reader-directory-operations-probe.mjs';
import { read } from './reading-entry-owner-probe.mjs';
import { searchReadingJourneyFixture } from './search-reading-journey-owner-probe.mjs';
import { sameRemoteSessionEvidence } from '../../entry/src/main/ets/features/reading/application/RemoteReadingEvidence.ts';
import { SourceSwitchCompletionPresentation } from '../../entry/src/main/ets/features/source/presentation/SourceSwitchCompletionPresentation.ts';

// Whole current owner declarations compile once; all Runtime, presentation,
// return, callback and transaction fixtures are fresh on each invocation.
const Directory = actualReaderDirectoryJourney();
const { ReadingCommitPresentation } = pureModuleProbe(read('features/reading/presentation/ReadingCommitPresentation.ets'),
  'ReadingCommitPresentation.ets', { Observed: value => value, sameRemoteSessionEvidence, SourceSwitchCompletionPresentation,
    ReadingPrefetchHost: { forRuntime() { assert.fail('prefetch is outside this exact transaction-finalization probe'); } } },
  ['ReadingCommitPresentation']);

export function directEntryCurrentOwnerFixture(f, ReadingHost, initialBook, loadLocal) {
  const x = searchReadingJourneyFixture({ runtime: f.runtime, ReadingHost, SourceHost: f.Constructor, route: 'detail',
    loadLocal, sourceName: (id, name) => name ?? id,
    failure() { assert.fail('must not trap body failures in a modal'); } });
  x.navigation.returns.completeDetailEntry('search', 'search', false);
  x.entry.book = { ...initialBook }; x.entry.inBookshelf = true;
  const bindReader = () => x.entry.bindReader(f.runtime, x.actions.ports.entryPorts(f.runtime));
  bindReader();
  const current = () => !x.controls.retired && !f.runtime.closed;
  const directory = new Directory(x.navigation, {
    scope: () => ({ owner: f.runtime, mount: 1, retired: x.controls.retired,
      foreground: x.controls.foreground, covered: x.source.visible }),
    ownsRuntime: owner => owner === f.runtime && current(), runtime: () => current() ? f.runtime : undefined,
    entry: () => x.entry, shelfBooks: () => x.controls.shelfBooks, removalPending: () => false,
    publish: snapshot => assert.equal(x.navigation.snapshot(), snapshot),
    advance: () => x.actions.ports.advance(), openReading: (chapter, proof) => x.actions.openReading(chapter, proof),
    bindReader, requestExit: () => x.exit.requestExit(), showDownloads() { assert.fail('downloads outside this probe'); },
    afterReaderExitInDetail() { assert.fail('offline cleanup outside this probe'); },
    confirmOfflineClear() { assert.fail('cache mutation outside this probe'); }, feedback() {}, bookmarkFeedback() {},
  });
  const cleanup = [];
  const commits = new ReadingCommitPresentation({ entry: () => x.entry,
    scene: () => ({ owner: f.runtime, retired: x.controls.retired, navigation: x.navigation.snapshot().generation,
      mounting: 1, active: x.entry.sessionActive, readyGeneration: x.entry.readyGeneration }),
    ownsRuntime: owner => owner === f.runtime && current(),
    finalize: (sourceId, bookId, tx) => x.source.finalizeTarget(x.switchJourney.scene(), { sourceId, bookId }, tx),
    cleanup: (sourceId, bookId) => cleanup.push([sourceId, bookId]), sourceName: (id, name) => name || id,
    applyRefreshedSession: session => x.actions.acceptReaderSession(session), refreshShelf() {}, notifyFileNavigation() {},
    diagnostic() {},
  });
  const bindSource = () => {
    const host = x.source.acquire(x.switchJourney.scene());
    assert.equal(host, f.host, 'the current presentation owns this fixture original SourceSwitchHost');
    host.context = x.source.workflowContext(x.switchJourney.workflow());
    host.lease = x.source.workflowLease(host, x.switchJourney.workflow());
  };
  return { ...x, directory, commits, cleanup, bindReader, bindSource };
}
