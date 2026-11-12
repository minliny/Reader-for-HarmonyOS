import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pureModuleProbe } from './ets-pure-module-probe.mjs';
import { compileHost, setRuntime } from './reading-entry-owner-probe.mjs';
import { readingPrefetchOwnerProbe } from './reading-prefetch-owner-probe.mjs';
import { searchReadingJourneyFixture } from './search-reading-journey-owner-probe.mjs';
import { sameRemoteSessionEvidence } from '../../entry/src/main/ets/features/reading/application/RemoteReadingEvidence.ts';
import { SourceSwitchCompletionPresentation } from '../../entry/src/main/ets/features/source/presentation/SourceSwitchCompletionPresentation.ts';

/** Catalog-only owner assembly. No legacy Index fields or callback aliases.
 * The source transaction is already admitted before this seam. Opening another
 * transaction and rolling body prefetch remain explicit out-of-scope ports,
 * matching the original catalog fixture's prefetchReadingWindow boundary. */
export function sourceSwitchCatalogCurrentOwners(runtime) {
  setRuntime(runtime);
  let owners;
  const current = () => owners?.controls.retired ? undefined : runtime;
  const { ReadingPrefetchHost } = readingPrefetchOwnerProbe(current);
  const ReadingHost = compileHost(undefined, { ReadingPrefetchHost });
  const events = [], diagnostics = [];
  owners = searchReadingJourneyFixture({ runtime, ReadingHost, route: 'reading',
    SourceHost: { forRuntime() { assert.fail('catalog adoption must not open another source transaction'); } },
    sourceName: () => 'new', onEvent: event => events.push(event),
    failure: (...args) => assert.fail('unexpected reader admission failure: ' + JSON.stringify(args)),
  });
  Object.assign(owners.entry, {
    book: { sourceId: 'old', bookId: 'old-book', title: '终宋', author: '作者', contentKind: 'text' },
    sessionActive: true, contentKind: 'text', inBookshelf: true,
    toc: [], directoryCurrentChapterIndex: 988, directoryChapterTitle: '第982章 国号',
  });
  const { ReadingCommitPresentation } = pureModuleProbe(readFileSync(new URL(
    '../../entry/src/main/ets/features/reading/presentation/ReadingCommitPresentation.ets', import.meta.url), 'utf8'),
  'ReadingCommitPresentation.ets', { Observed: value => value, ReadingPrefetchHost,
    sameRemoteSessionEvidence, SourceSwitchCompletionPresentation }, ['ReadingCommitPresentation']);
  const commits = new ReadingCommitPresentation({
    entry: () => owners.entry,
    scene: () => ({ owner: current(), retired: owners.controls.retired,
      navigation: owners.navigation.snapshot().generation, mounting: 1,
      active: owners.entry.sessionActive, readyGeneration: owners.entry.readyGeneration }),
    ownsRuntime: owner => owner === current(),
    finalize() { assert.fail('catalog refresh cannot finalize a source transaction'); },
    cleanup() { assert.fail('catalog refresh cannot clear source caches'); },
    sourceName: () => 'new', applyRefreshedSession: session => owners.actions.acceptReaderSession(session),
    refreshShelf: () => events.push('shelf.project'), notifyFileNavigation: () => events.push('file.consume'),
    diagnostic: (stage, message) => diagnostics.push({ stage, message }),
  });
  commits.prefetch = async (session, chapterIndex) => {
    events.push({ kind: 'rolling-prefetch-port', session, chapterIndex });
  };
  owners.actions.ports.refreshNearEnd = (session, chapterIndex) => commits.refreshNearEnd(session, chapterIndex);
  owners.actions.openShelfEntry = () => assert.fail('the admitted target session must be reused');
  const close = owners.close;
  const prefetch = ReadingPrefetchHost.forRuntime(runtime);
  return { ...owners, commits, events, diagnostics,
    prefetch,
    close() { commits.retire(); prefetch.retire(); close(); setRuntime(undefined); },
  };
}
