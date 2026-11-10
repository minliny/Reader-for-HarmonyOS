import assert from 'node:assert/strict';
import { bookshelfOperationClass } from './bookshelf-operation-owner-probe.mjs';
import { searchReadingJourneyFixture } from './search-reading-journey-owner-probe.mjs';
import { ProductionHost, setRuntime } from './reading-entry-owner-probe.mjs';
import { fixture as sourceFixture, setCurrentRuntime, gatewayExports } from './source-switch-owner-probe.mjs';
import { sourceSwitchProbeQuery } from './source-switch-presentation-probe.mjs';
import { errorMessageOf } from '../../entry/src/main/ets/app/ErrorMessage.ts';
const { sourceSwitchCandidateKey } = gatewayExports;
import { RemoteReadingFlowGateway } from '../../entry/src/main/ets/features/reading/application/RemoteReadingFlowGateway.ts';
import { remoteReadingSeedForSession } from '../../entry/src/main/ets/features/reading/presentation/ReadingBookDetail.ts';
import { MangaSessionGateway } from '../../entry/src/main/ets/features/manga/application/MangaSessionGateway.ts';
import { MangaSourceSwitchGateway, MangaSwitchChapterSelectionRequired } from '../../entry/src/main/ets/features/manga/application/MangaSourceSwitchGateway.ts';
import { readFileSync } from 'node:fs';
import { pureModuleProbe } from './ets-pure-module-probe.mjs';
import { selectedProductionMethods } from './selected-production-methods.mjs';
const RootCallbacks=selectedProductionMethods(new URL('../../entry/src/main/ets/pages/Index.ets',import.meta.url), 'Index', ['onBackPress','readerOwnsWindowEdges','mangaOwnsWindowEdges']);
const { readerSourceSwitchActions } = pureModuleProbe(readFileSync(new URL('../../entry/src/main/ets/app/composition/ReaderSourceSwitchActions.ets', import.meta.url),'utf8'), 'ReaderSourceSwitchActions.ets', {}, ['readerSourceSwitchActions']);
const mangaClass = MangaSwitchRecoveryError => bookshelfOperationClass('features/manga/presentation/MangaSourceSwitchPresentation.ets', 'MangaSourceSwitchPresentation', {
  Observed: value => value, errorMessageOf, sourceSwitchCandidateKey, RemoteReadingFlowGateway,
  remoteReadingSeedForSession, MangaSessionGateway, MangaSourceSwitchGateway, MangaSwitchChapterSelectionRequired, MangaSwitchRecoveryError,
});
/** All navigation, entry, candidate, manga and source-switch logic is the actual
 * current owner. Transport, image I/O, frames and recovery rendering are ports.
 * Wrappers record calls and still execute the original method. */
export function mangaCurrentJourney({ runtime, book, session, toc = [], candidate, reading = true, inShelf = true,
  route = reading ? 'reading' : 'detail', onRefresh = () => {}, messages = [] } = {}) {
  const { Constructor: SourceHost, MangaSwitchRecoveryError } = sourceFixture({ open: false });
  const Manga = mangaClass(MangaSwitchRecoveryError);
  setRuntime(runtime); setCurrentRuntime(runtime);
  const x = searchReadingJourneyFixture({ runtime, ReadingHost: ProductionHost, SourceHost, route,
    onEvent: event => { if (event === 'shelf.project') onRefresh(); },
    failure: (title, message) => messages.push(`${title}: ${message}`), sourceName: (id, name) => name ?? id });
  x.navigation.returns.completeDetailEntry('search', 'search', false);
  Object.assign(x.entry, { book, session, toc, inBookshelf: inShelf, contentKind: book.contentKind, sessionActive: reading });
  const host = x.switchJourney.host(); assert.ok(host);
  x.source.visible = true; x.source.state = { kind: 'candidates', candidates: [candidate] };
  const opened = [], installed = [], recoveries = [], saved = [], starts = [], failures = [], recoveryErrors = [];
  const open = x.actions.openRemoteDetail.bind(x.actions);
  x.actions.openRemoteDetail = (...args) => { opened.push({ input: args[0], retainedParent: args[1] }); return open(...args); };
  const commit = x.switchJourney.commit.bind(x.switchJourney);
  x.switchJourney.commit = (...args) => { const result = commit(...args); installed.push(x.entry.session); return result; };
  const manga = new Manga({ scene: () => x.switchJourney.mangaScene(), entry: () => x.entry, source: () => x.source,
    sourceHost: () => x.switchJourney.host(), query: () => sourceSwitchProbeQuery(x.entry),
    ownsRuntime: owner => owner === runtime && !runtime.closed && !x.controls.retired,
    preview: (...args) => x.switchJourney.preview(...args), committed: (...args) => x.switchJourney.commit(...args),
    chapterStartFeedback: current => assert.equal(current(), true), refreshShelf: onRefresh,
    showReaderFailure: () => x.switchJourney.presentReaderFailure(),
    savedRecovery: (message, current) => { saved.push({ message, current }); messages.push(message); },
    recovery: (message, label, action, current) => recoveries.push({ message, label, action, current }), consumeFileOpen() {},
  });
  x.switchJourney.ports.manga = () => manga;
  const switchActions = readerSourceSwitchActions(() => x.source, () => manga, () => x.entry.book?.contentKind === 'manga', () => x.switchJourney.workflow());
  // Execute the shipping root callbacks against actual owners. Closed,
  // unrelated native/import/group surfaces are explicit UI admission ports.
  const callbacks=Object.assign(new RootCallbacks(),{currentReadingRuntime:()=>x.controls.retired?undefined:runtime,
    navigationOwner:x.navigation,mangaSourceSwitch:manga,readingEntry:x.entry,sourceSwitchPresentation:x.source,
    sourceSwitchActions:switchActions,readingEntryActions:x.actions,bookRemovalConfirmation:{isOpen:()=>false},
    jsonImportPresentation:{opening:undefined},shelfMutations:{snapshot:{}},shelfGroupPresentation:{back:()=>false},
    dispatchBackDestination:()=>assert.fail('a manga picker/catalog Back cannot navigate the underlying route')});
  Object.defineProperties(callbacks,{route:{get:()=>x.navigation.snapshot().route},
    directoryReturnTarget:{get:()=>x.navigation.snapshot().directoryReturnTarget}});
  const start = manga.switchMangaSource.bind(manga);
  manga.switchMangaSource = (...args) => { const task = start(...args); starts.push(task); return task; };
  const fail = manga.presentMangaSourceSwitchAcquisitionFailure.bind(manga);
  manga.presentMangaSourceSwitchAcquisitionFailure = (...args) => { failures.push(args[2]); return fail(...args); };
  const recover = manga.presentMangaSourceSwitchCommitRecovery.bind(manga);
  manga.presentMangaSourceSwitchCommitRecovery = (...args) => { try { return recover(...args); } catch (error) { recoveryErrors.push(String(error.stack)); throw error; } };
  const oldClose = x.close;
  return { ...x, manga, switchActions, callbacks, host, opened, installed, recoveries, saved, starts, failures, recoveryErrors, messages,
    begin: (selected = candidate) => { switchActions.select(selected, x.source.scopeId); return starts.at(-1); }, latest: () => starts.at(-1),
    close: () => { manga.retire(); oldClose(); } };
}
