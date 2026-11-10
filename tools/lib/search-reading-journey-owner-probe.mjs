import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import { installedEtsCompiler } from './ets-compiler-runtime.mjs';
import { selectedProductionMethods } from './selected-production-methods.mjs';
import { pureModuleProbe } from './ets-pure-module-probe.mjs';
import { bookshelfOperationClass } from './bookshelf-operation-owner-probe.mjs';
import { actualReadingEntryPresentation } from './reading-entry-presentation-probe.mjs';
import { actualSourceSwitchPresentation } from './source-switch-presentation-probe.mjs';
import { readerFoundationTokens } from './reader-tokens-probe.mjs';
registerHooks({ resolve(s, c, next) { try { return next(s, c); } catch (e) {
  if (s.startsWith('.') && !s.endsWith('.ts')) return next(s + '.ts', c); throw e;
} } });
const [{ ReaderNavigation }, { ReaderEntryStartupTrace }, { SearchViewState }, { SearchPublication },
  { resolveBookshelfBook }, { searchCandidateRank }, { readerSourceCategoryIsText }, { diagnosticCodeOf },
  { errorMessageOf }, { readingFailureHint }, { readerSurfaceRectValid }, headerMetrics, { readingEntryInputForSearchContext }] = await Promise.all([
  import('../../entry/src/main/ets/app/navigation/ReaderNavigation.ts'),
  import('../../entry/src/main/ets/app/ReaderStartupTrace.ts'),
  import('../../entry/src/main/ets/features/search/presentation/SearchViewState.ts'),
  import('../../entry/src/main/ets/features/search/presentation/SearchPublication.ts'),
  import('../../entry/src/main/ets/features/bookshelf/application/BookshelfBookIdentity.ts'),
  import('../../entry/src/main/ets/features/search/presentation/SearchCandidatePolicy.ts'),
  import('../../entry/src/main/ets/features/source/application/ReaderSourceCategory.ts'),
  import('../../entry/src/main/ets/app/LogPrivacy.ts'), import('../../entry/src/main/ets/app/ErrorMessage.ts'),
  import('../../entry/src/main/ets/features/reading/presentation/ReadingFailurePresentation.ts'),
  import('../../entry/src/main/ets/ui/layout/ReaderSurfaceRect.ts'),
  import('../../entry/src/main/ets/ui/foundation/ReaderHeaderMetrics.ts'),
  import('../../entry/src/main/ets/features/reading/presentation/ReadingEntryDto.ts'),
]);
const root = new URL('../../entry/src/main/ets/', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');
const emit = (path, names, deps = {}) => pureModuleProbe(read(path), path, deps, names);
const { ReaderLibrarySearchModel } = emit('features/search/presentation/ReaderLibrarySearchModel.ets',
  ['ReaderLibrarySearchModel'], { Observed: value => value });
const { SearchHost } = emit('features/search/application/SearchHost.ets', ['SearchHost'], {
  SearchPublication, SearchViewState,
  SearchOrchestrator: class { constructor() { assert.fail('query/network orchestration must be an explicit fixture port'); } },
});
const { readerPageInitialHeaderHeight } = emit('ui/foundation/ReaderHeaderSpecs.ets', ['readerPageInitialHeaderHeight'],
  { ...readerFoundationTokens, ...headerMetrics });
const { LibrarySearchPresentation } = emit('features/search/presentation/LibrarySearchPresentation.ets', ['LibrarySearchPresentation'], {
  ReaderLibrarySearchModel, SearchHost, readerPageInitialHeaderHeight, readerSurfaceRectValid,
  resolveBookshelfBook, searchCandidateRank, readerSourceCategoryIsText, diagnosticCodeOf, errorMessageOf, readingFailureHint,
  Observed: value => value,
});
const { ReaderLibraryJourney } = emit('app/composition/ReaderLibraryJourney.ets', ['ReaderLibraryJourney']);
const { ReaderReadingEntryActions } = emit('app/composition/ReaderReadingEntryActions.ets', ['ReaderReadingEntryActions'],
  { readingEntryInputForSearchContext, Observed: value => value });
const { ReaderSourceSwitchJourney } = emit('app/composition/ReaderSourceSwitchJourney.ets', ['ReaderSourceSwitchJourney']);
const { ReaderExitActions } = emit('app/composition/ReaderExitActions.ets', ['ReaderExitActions']);

/** Execute the actual current Index initializer, not a replacement journey
 * visibility predicate. Normal native/UI and outbound search scheduling are
 * finite controlled ports; entry, return, candidate and switch owners are real. */
function indexLibrary(receiver) {
  const { ts, options } = installedEtsCompiler(), text = read('pages/Index.ets');
  const tree = ts.createSourceFile('Index.ets', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
  assert.deepEqual(tree.parseDiagnostics, []);
  const field = tree.statements.find(n => n.name?.text === 'Index').members.filter(n => n.name?.getText(tree) === 'librarySearch');
  assert.equal(field.length, 1); assert.ok(field[0].initializer);
  const code = ts.transpileModule('const result=' + field[0].initializer.getText(tree) + ';',
    { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return new Function('LibrarySearchPresentation', code + ';return result;').call(receiver, LibrarySearchPresentation);
}

export function searchReadingJourneyFixture({ runtime, ReadingHost, route = 'search', SourceHost,
  failure = () => {}, sourceName = (id, saved) => saved ?? id, onSearch = {}, onEvent = () => {},
  shelfBooks = [], loadLocal = async () => undefined } = {}) {
  const controls = { foreground: true, arkWebCapturesInput: false, retired: false, shelfBooks };
  const navigation = new ReaderNavigation(); navigation.show(route);
  const currentRuntime = () => controls.retired || runtime.closed ? undefined : runtime;
  const receiver = { navigationOwner: navigation, libraryAcquisition: { currentOwner: currentRuntime } };
  Object.defineProperties(receiver, { route: { get: () => navigation.snapshot().route },
    searchAppForeground: { get: () => controls.foreground },
    arkWebCapturesInput: { get: () => controls.arkWebCapturesInput },
    mountedRuntimeOwner: { get: () => runtime }, rssInstanceIdentity: { value: 1 }, detailShelfAdmissionMount: { value: 1 },
    shelfReceiptRetired: { get: () => controls.retired } });
  const library = indexLibrary(receiver);
  const searchHost = library.host;
  searchHost.orchestrator = { visibilityChanged: () => onEvent('search.visibility'),
    resume: () => onEvent('search.resume'), close: () => onEvent('search.close'),
    open: () => onEvent('UNEXPECTED.search.open'), search: () => onEvent('UNEXPECTED.search.search'),
    searchedSourceIds: () => [], ...onSearch };
  library.mode = 'results'; library.mount();
  const Entry = actualReadingEntryPresentation({ ReadingEntryHost: ReadingHost }), entry = new Entry();
  const authority = { current: currentRuntime, isCurrent: owner => owner === currentRuntime() };
  const source = SourceHost ? new (actualSourceSwitchPresentation({ ReaderRuntimeOwner: authority, SourceSwitchHost: SourceHost }))() :
    { visible: false, pending: undefined, failureMessage: '' };
  const entryPorts = owner => {
    const generation = navigation.snapshot().generation;
    return { current: () => owner === currentRuntime() && generation === navigation.snapshot().generation,
      projectionVisible: () => navigation.snapshot().route === 'detail' && !entry.sessionActive && !source.visible,
      membership: () => ({ value: entry.inBookshelf, generation: 0, blocked: false }), cacheDecision: async () => false,
      notice: failure, refreshShelf: () => onEvent('shelf.project') };
  };
  const advance = () => { source.retire?.(); entry.retire(); actions.retirePreparation(); return navigation.advance().generation; };
  const bindReader = () => { if (currentRuntime()) entry.bindReader(runtime, entryPorts(runtime)); };
  const actions = new ReaderReadingEntryActions(navigation, new ReaderEntryStartupTrace(() => {}), {
    runtime: currentRuntime, mounting: () => 1, entry: () => entry, search: () => library, sourceSwitch: () => source,
    shelfBooks: () => controls.shelfBooks, removalPending: () => false, readerExitPending: () => false,
    advance, show: next => navigation.show(next), bindReader, restoreReaderReturn: () => false,
    entryPorts, sourceName, failure, afterOpening: project => project(), postFrame: action => action(), refreshNearEnd() {},
  });
  const IndexPorts = selectedProductionMethods(new URL('pages/Index.ets', root), 'Index', ['libraryJourneyPorts']);
  const actualScope = IndexPorts.prototype.libraryJourneyPorts.call(receiver).scope;
  const journey = new ReaderLibraryJourney(navigation, {
    scope: actualScope,
    runtime: currentRuntime, ownsRuntime: owner => owner === currentRuntime(), search: () => library,
    acquisition: () => ({ currentOwner: currentRuntime, beginSearch: () => true, endSearch: () => runtime.bookAcquisitions().endSearch?.() }),
    reading: () => entry, readingActions: () => actions, shelfBooks: () => controls.shelfBooks,
    loadLocalBook: loadLocal, sourceName: id => sourceName(id), failure, feedback() {}, advance,
    publish: snapshot => assert.equal(navigation.snapshot(), snapshot),
    refreshMembership() {}, refreshShelf: () => onEvent('shelf.project'), readbackOnBookshelf() {}, clearRssSelection() {},
    bookshelfInputAllowed: () => controls.foreground, back() {},
  });
  const exit = new ReaderExitActions(navigation, { entry: () => entry, runtime: currentRuntime, mounting: () => 1,
    foreground: () => controls.foreground, captureReturn: () => navigation.returns.captureReaderReturn(runtime, () => undefined),
    switchBlocked: () => false, fileOpenBlocked: () => false, advance, publish: snapshot => assert.equal(navigation.snapshot(), snapshot),
    bindReader, hydrateMangaPosition() {}, refreshDetail() {}, refreshShelf: () => onEvent('shelf.project'), resumeReturnMotion() {},
    returnToBookshelf: () => journey.returnToBookshelf(), returnFromDetail: () => journey.returnFromDetail(),
    returnToReadingOrigin: () => exit.completeReturn(), showDownloads() { assert.fail('downloads outside this fixture'); },
    showRules() { assert.fail('rules outside this fixture'); }, unavailableDownloads() {}, prepareFileOpen() {},
    openShelfBook: book => actions.resumeShelf(book), resolveFileReaderTransaction: async () => {}, fileNotice() {},
  });
  const switchJourney = new ReaderSourceSwitchJourney(navigation, { scope: () => ({ owner: currentRuntime(), retired: controls.retired, mount: 1 }),
    runtime: currentRuntime, entry: () => entry, entryActions: () => actions, entryPorts, source: () => source,
    manga: () => ({ selectionVisible: false, retire() {} }), search: () => library, shelfBooks: () => controls.shelfBooks,
    removalPending: () => false, captureReturn: () => navigation.returns.captureReaderReturn(runtime, () => undefined),
    restoreReturn: context => { if (!context || context.owner !== currentRuntime()) return false; navigation.returns.restoreReaderReturn(context, () => {}); return true; },
    advance, showReading: () => navigation.show('reading'), leaveReader: () => entry.finishReading(runtime), bindReader,
    sourceName, invalidateDownloads() {}, refreshShelf: () => onEvent('shelf.project'), navigationSettled() {},
  });
  return { entry, actions, navigation, library, journey, exit, source, switchJourney, controls,
    publish: presentation => { searchHost.publication.publish(presentation); searchHost.advanceRevision(); },
    knownCandidates: () => source.workflowContext(switchJourney.workflow()).knownCandidates,
    close: () => { source.retire?.(); entry.retire(); library.dispose(); controls.retired = true; } };
}
