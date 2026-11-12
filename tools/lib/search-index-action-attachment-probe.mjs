import { resolveEtsLoaderRoot, virtualFilePath } from './tool-environment.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, registerHooks, stripTypeScriptTypes } from 'node:module';
import { tailControls, compileTailConsumer } from './foundation-tail-consumer-probe.mjs';
import { boundedMembers, boundedSurfaceSdk } from './bounded-surface-sdk-probe.mjs';
import { pureModuleProbe } from './ets-pure-module-probe.mjs';
import { actualReadingEntryPresentation } from './reading-entry-presentation-probe.mjs';
import { projectOperationFacts } from '../../entry/src/main/ets/app/ReaderOperationFacts.ts';
import * as headerMetrics from '../../entry/src/main/ets/ui/foundation/ReaderHeaderMetrics.ts';
registerHooks({ resolve(specifier, context, next) { try { return next(specifier, context); }
  catch (error) { if (specifier.startsWith('.') && !specifier.endsWith('.ts')) return next(`${specifier}.ts`, context); throw error; } } });
const { resolveBookshelfBook } = await import('../../entry/src/main/ets/features/bookshelf/application/BookshelfBookIdentity.ts');
const root = new URL('../../entry/src/main/ets/', import.meta.url);
const read = name => readFileSync(new URL(name, root), 'utf8');
const req = createRequire(import.meta.url), sdk = resolveEtsLoaderRoot();
const ts = req(sdk + '/node_modules/typescript'), options = req(sdk + '/lib/ets_checker.js').compilerOptions;
const pageSource = read('features/search/ui/SearchPage.ets');
export const searchIndexSource = read('pages/Index.ets');
const parse = source => ts.createSourceFile(virtualFilePath('SearchAttachment.ets'), source, ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
const pageTree = parse(pageSource);
const scopeConstants = Object.fromEntries(['SEARCH_LOCAL_SCOPE','nextSearchSurfaceOwner'].map(name => {
  const declaration = pageTree.statements.filter(ts.isVariableStatement)
    .flatMap(statement => [...statement.declarationList.declarations])
    .find(value => value.name.getText(pageTree) === name);
  assert.ok(declaration && (ts.isStringLiteral(declaration.initializer)||ts.isNumericLiteral(declaration.initializer)),
    name + ' is the actual production scope label/owner seed');
  return [name, ts.isNumericLiteral(declaration.initializer)?Number(declaration.initializer.text):declaration.initializer.text];
}));
const member = (source, name) => { const tree = parse(source), component = tree.statements.find(n => n.name?.text === 'Index');
  const value = component.members.find(n => n.name?.getText(tree) === name); assert.ok(value, name); return value.getText(tree); };
const [{ SearchPublication }, { SearchViewState }, { SearchResultProjection }, geometry, metrics, floating, author] = await Promise.all([
  import('../../entry/src/main/ets/features/search/presentation/SearchPublication.ts'), import('../../entry/src/main/ets/features/search/presentation/SearchViewState.ts'),
  import('../../entry/src/main/ets/features/search/presentation/SearchResultProjection.ts'), import('../../entry/src/main/ets/ui/layout/SurfaceHorizontalGeometry.ts'),
  import('../../entry/src/main/ets/ui/foundation/ReaderWindowMetrics.ts'), import('./reader-floating-bar-metrics-probe.mjs'),
  import('../../entry/src/main/ets/app/library/BookAuthorMetadata.ts')]);
const classes = pageSource.slice(pageSource.indexOf('@Observed\nclass SearchBookGroup'), pageSource.indexOf('/**\n * Figma-backed Book Search')).replace('@Observed\n', '');
const classDeps = { ...author, DataOperationType: { ADD: 'add', DELETE: 'delete', CHANGE: 'change', RELOAD: 'reload', MOVE: 'move' } };
const { SearchBookGroup, SearchResultDataSource } = new Function(...Object.keys(classDeps), stripTypeScriptTypes(classes) + ';return {SearchBookGroup,SearchResultDataSource};')(...Object.values(classDeps));
const hostText = read('features/search/application/SearchHost.ets').replace(/^import[^;]+;\s*/gm, '').replace(/^export /gm, '');
// The actual Host owns publication/view state. Native Core/network is not a
// dependency of this surface-attachment proof; its unused constructor seam
// throws if the test accidentally attempts a query or creates another owner.
const SearchHost = new Function('SearchPublication', 'SearchViewState', 'SearchOrchestrator', stripTypeScriptTypes(hostText) + ';return SearchHost;')(
  SearchPublication, SearchViewState, class { constructor() { assert.fail('Surface test must not dispatch Core/network'); } });
// The default and operation-consumer entries share the current Index/Results/
// journey/Host path. Native window and outbound operations remain finite seams.
export function searchAttachmentFixture({ mutatePredicate, pageDefinition = pageSource } = {}) {
  const controls = tailControls(), surfaces = boundedSurfaceSdk({ properties: controls.properties }), calls = [];
  const native = {}, navigation = pureModuleProbe(read('app/navigation/ReaderNavigation.ts'),
    'ReaderNavigation.ts', {}, ['ReaderNavigation']);
  let journeySource = read('app/composition/ReaderLibraryJourney.ets');
  if (mutatePredicate) {
    const journeyTree = parse(journeySource), journey = journeyTree.statements.find(node => node.name?.text === 'ReaderLibraryJourney');
    const predicate = journey.members.find(node => node.name?.getText(journeyTree) === 'isCurrentSearch');
    journeySource = journeySource.slice(0, predicate.getStart(journeyTree)) + mutatePredicate(predicate.getText(journeyTree)) + journeySource.slice(predicate.end);
  }
  const { ReaderLibraryJourney } = pureModuleProbe(journeySource,
    'ReaderLibraryJourney.ets', {}, ['ReaderLibraryJourney']);
  const route = new navigation.ReaderNavigation(); route.show('search');
  let currentRuntime = native;
  const headers = pureModuleProbe(read('ui/foundation/ReaderHeaderSpecs.ets'), 'ReaderHeaderSpecs.ets',
    { ...controls.dependencies, ...headerMetrics }, ['readerPageInitialHeaderHeight']);
  const actionTargets = pureModuleProbe(read('ui/controls/ReaderActionAccessibility.ets'),
    'ReaderActionAccessibility.ets',{},['READER_ACTION_MIN_TARGET']);
  const { ReaderLibrarySearchModel } = pureModuleProbe(read('features/search/presentation/ReaderLibrarySearchModel.ets'),
    'ReaderLibrarySearchModel.ets', { Observed: value => value }, ['ReaderLibrarySearchModel']);
  const { LibrarySearchPresentation } = pureModuleProbe(read('features/search/presentation/LibrarySearchPresentation.ets'),
    'LibrarySearchPresentation.ets', { ...headers, ReaderLibrarySearchModel, SearchHost, resolveBookshelfBook,
      Observed: value => value }, ['LibrarySearchPresentation']);
  for(const name of ['ReaderLibrarySearchModel','LibrarySearchPresentation']){
    assert.match(read(`features/search/presentation/${name}.ets`),new RegExp(`@Observed\\s+export class ${name}`));
    req(sdk+'/lib/validate_ui_syntax.js').observedClassCollection.add(name);
  }
  const taskSource = read('features/search/ui/ReaderSearchTaskPanel.ets');
  const filterSource = read('features/search/ui/ReaderSearchFilterPanel.ets');
  const resultsSource = read('features/search/ui/LibrarySearchResults.ets');
  const resultGeometry = pureModuleProbe(read('features/search/ui/SearchResultGeometry.ts'),
    'SearchResultGeometry.ts', {}, ['SEARCH_RESULT_GEOMETRY']);
  const dependencies = { ...surfaces.deps, ...controls.dependencies, ...scopeConstants, ...resultGeometry, ...actionTargets,
    SearchPublication, SearchViewState, SearchResultProjection, SearchBookGroup, SearchResultDataSource,
    ...geometry, ...metrics, ...floating, ...author,
    ReaderWindowCoordinator: { metrics: () => metrics.createDefaultReaderWindowMetrics() },
    Scroller: class { scrollEdge() {} },
    SheetSize: { FIT_CONTENT: 'fit' }, SheetType: { BOTTOM: 'bottom' }, DismissReason: { PRESS_BACK: 'back' } };
  const { SearchResultSheetBinding } = pureModuleProbe(read('features/search/ui/SearchResultSheetBinding.ets'),
    'SearchResultSheetBinding.ets', dependencies, ['SearchResultSheetBinding']);
  dependencies.SearchResultSheetBinding = SearchResultSheetBinding;
  Object.assign(dependencies,pureModuleProbe(read('features/search/ui/SearchFilterGeometry.ts'),
    'SearchFilterGeometry.ts',{},['SearchFilterGeometry']));
  const hooks = { ...controls.hooks, childSources: { ...surfaces.childSources, ...controls.hooks.childSources,
    SearchPage: pageDefinition, ReaderSearchTaskPanel: taskSource, ReaderSearchFilterPanel: filterSource, LibrarySearchResults: resultsSource } };
  dependencies.ReaderSearchFilterPanel = compileTailConsumer(filterSource, boundedMembers(filterSource), dependencies, hooks).Component;
  const Task = compileTailConsumer(taskSource, boundedMembers(taskSource), dependencies, hooks).Component;
  dependencies.ReaderSearchTaskPanel = Task;
  // Select actual page methods and the finite state consumed by these existing
  // Builders. The unrelated page Scaffold/native result list is outside this
  // operation action contract; no replacement retry or eligibility is supplied.
  const tree = parse(pageDefinition), component = tree.statements.find(node => node.name?.text === 'SearchPage');
  const methods = component.members.filter(ts.isMethodDeclaration).map(node => node.name.getText(tree))
    .filter(name => !['build', 'aboutToAppear', 'aboutToDisappear'].includes(name));
  const fields = ['appThemeScheme', 'readerWindowMetricsRevision', 'presentation', 'publication', 'viewState',
    'expandedLayout', 'reduceMotion', 'externalHeaderHeight', 'surfaceModel', 'isPresentationCurrent', 'isPresentationVisible',
    'onBack', 'onSearch', 'onStop', 'onClearHistory', 'onRetryHistory', 'onSelectResult', 'onVisibleGroups', 'onRetry',
    'onManageSources', 'pageEpoch', 'pageMounted', 'queryAtMount', 'surfaceOwner', 'taskStatusExpanded', 'taskStatusGeneration',
    'resultNoticeFacts', 'retainedViewportPending', 'listMounted'];
  const page = compileTailConsumer(pageDefinition, [...fields, ...methods], dependencies, hooks);
  dependencies.SearchPage = page.Component;
  const Results = compileTailConsumer(resultsSource, boundedMembers(resultsSource), dependencies, hooks).Component;
  const names = ['searchPageContent', 'searchPageSurface', 'isCurrentSearchPresentation'];
  const currentIndex = `@Component struct Index {\n${names.map(name => member(searchIndexSource, name)).join('\n')}\nbuild(){this.searchPageContent();}\n}`;
  const composition = compileTailConsumer(currentIndex, [...names, 'build'],
    { ...dependencies, LibrarySearchResults: Results }, hooks);
  const index = composition.owner, library = controls.properties.sdk.ObservedObject.createNew(
    new LibrarySearchPresentation(() => route.snapshot().route === 'search', () => false), undefined);
  library.mode = 'results';
  const host = library.host;
  host.viewState.keywordDraft = '原草稿';
  host.orchestrator = Object.fromEntries(['search','stop','clearHistory','retryHistory','retry','close']
    .map((name, ordinal) => [name, (...args) => calls.push([['performSearch','stopSearch','clearSearchHistory','retryHistory','retrySearch','closeSearch'][ordinal], ...args])]));
  const coordinator = { beginSearch() { calls.push(['beginSearch']); return true; }, endSearch() { calls.push(['endSearch']); },
    setPreparationVisible() {}, prepareGroups(groups) { calls.push(['scheduleSearchDetailWarmups', groups]); } };
  const Reading = actualReadingEntryPresentation(), reading = new Reading();
  reading.book = { sourceId: 's', bookId: 'current-detail' }; reading.toc = ['kept'];
  Object.defineProperties(index, { route: { get: () => route.snapshot().route },
    navigationGeneration: { get: () => route.snapshot().generation } });
  Object.assign(index, {
    mountedRuntimeOwner: native, detailShelfAdmissionMount: 1, shelfReceiptRetired: false,
    searchAppForeground: true, arkWebCapturesInput: false, librarySearch: library,
    libraryAcquisition: { coordinator: () => coordinator, currentOwner: () => currentRuntime,
      beginSearch: () => coordinator.beginSearch(), endSearch: () => coordinator.endSearch() },
    settingsPresentation: { snapshot: { reduceMotion: false } }, expandedLayout: () => false,
    sourceNavigation: { manageFromSearch() { calls.push(['manageSourcesFromSearch']); } } });
  index.libraryJourney = new ReaderLibraryJourney(route, {
    scope: () => ({ owner: index.mountedRuntimeOwner, instance: 1, mounting: index.detailShelfAdmissionMount,
      retired: index.shelfReceiptRetired, inputAllowed: index.searchAppForeground && !index.arkWebCapturesInput }),
    acquisition: () => index.libraryAcquisition, search: () => library, runtime: () => currentRuntime,
    ownsRuntime: owner => owner !== undefined && owner === currentRuntime,
    advance: () => { const next = route.advance(); calls.push(['nextNavigation']); return next.generation; },
    publish() {}, reading: () => reading, clearRssSelection() { calls.push(['clearRssSelection']); },
    refreshShelf() { calls.push(['refreshBookshelf']); }, readbackOnBookshelf() { calls.push(['readbackOnBookshelf']); },
    shelfBooks: () => [], sourceName: () => '来源', readingActions: () => ({
      openRemoteDetail(input) { calls.push(['onSearchResultSelected', input]); },
    }),
  });
  index.onBackPress = () => index.libraryJourney.back();
  const walk = owner => [owner, ...[...(owner.children?.values() ?? [])].flatMap(walk)];
  function mount() {
    const prior = new Set(walk(index)); index.initialRender();
    const child = walk(index).find(item => item instanceof page.Component && !prior.has(item));
    assert.ok(child, 'actual current Index -> LibrarySearchResults -> SearchPage mounted');
    Object.assign(child, { pageMounted: true, pageEpoch: ++library.host.viewState.pageRevision,
      queryAtMount: library.host.viewState.revision, taskStatusExpanded: true, keyword: '原草稿' });
    child.contentFrame = () => ({ width: 330, left: 16, right: 16 });
    child.searchBottomInset = minimum => minimum ?? 24;
    child.bindSurface();
    return child;
  }
  const first = mount();
  function physical(child) {
    child.presentation = { kind: 'error', operation: projectOperationFacts({ phase: 'failed', canRetry: true }),
      localSearchFailed: false, sourceListFailed: false, failedSourceCount: 0 };
    child.searchErrorActions();
    const button = walk(child).findLast(actor => actor.specId === 'search-error-retry');
    assert.ok(button instanceof controls.dependencies.ReaderButton, 'actual current shared retry actor');
    const nativeAction = controls.nodes(button).find(node => typeof node.onClick === 'function');
    assert.ok(nativeAction, 'actual current native retry click');
    return { retry: nativeAction.onClick, button, native: nativeAction };
  }
  return { index, first, native, host, library, reading, navigation: route, calls, controls, SearchHost, mount, physical,
    setRuntime: value => { currentRuntime = value; },
    taskPanel: () => walk(first).find(child => child instanceof Task),
    actors: spec => walk(first).filter(child => child.specId === spec) };
}
