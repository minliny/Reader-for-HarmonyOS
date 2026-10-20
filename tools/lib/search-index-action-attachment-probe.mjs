import { resolveEtsLoaderRoot, virtualFilePath } from './tool-environment.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, registerHooks, stripTypeScriptTypes } from 'node:module';
import { tailControls, compileTailConsumer } from './foundation-tail-consumer-probe.mjs';
import { boundedMembers } from './bounded-surface-sdk-probe.mjs';
import { runtimeOwnerIdentityProbe } from './reader-runtime-admission-probe.mjs';
registerHooks({ resolve(specifier, context, next) { try { return next(specifier, context); }
  catch (error) { if (specifier.startsWith('.') && !specifier.endsWith('.ts')) return next(`${specifier}.ts`, context); throw error; } } });
const root = new URL('../../entry/src/main/ets/', import.meta.url);
const read = name => readFileSync(new URL(name, root), 'utf8');
const req = createRequire(import.meta.url), sdk = resolveEtsLoaderRoot();
const ts = req(sdk + '/node_modules/typescript'), options = req(sdk + '/lib/ets_checker.js').compilerOptions;
const pageSource = read('features/search/SearchPage.ets');
export const searchIndexSource = read('pages/Index.ets');
const parse = source => ts.createSourceFile(virtualFilePath('SearchAttachment.ets'), source, ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
const pageTree = parse(pageSource);
const scopeConstants = Object.fromEntries(['SEARCH_LOCAL_SCOPE', 'SEARCH_ONLINE_SCOPE'].map(name => {
  const declaration = pageTree.statements.filter(ts.isVariableStatement)
    .flatMap(statement => [...statement.declarationList.declarations])
    .find(value => value.name.getText(pageTree) === name);
  assert.ok(declaration && ts.isStringLiteral(declaration.initializer), name + ' is the actual production scope label');
  return [name, declaration.initializer.text];
}));
const member = (source, name) => { const tree = parse(source), component = tree.statements.find(n => n.name?.text === 'Index');
  const value = component.members.find(n => n.name?.getText(tree) === name); assert.ok(value, name); return value.getText(tree); };
const [{ SearchPublication }, { SearchViewState }, { SearchResultProjection }, geometry, metrics, floating, author] = await Promise.all([
  import('../../entry/src/main/ets/features/search/SearchPublication.ts'), import('../../entry/src/main/ets/features/search/SearchViewState.ts'),
  import('../../entry/src/main/ets/features/search/SearchResultProjection.ts'), import('../../entry/src/main/ets/features/common/SurfaceHorizontalGeometry.ts'),
  import('../../entry/src/main/ets/features/common/ReaderWindowMetrics.ts'), import('../../entry/src/main/ets/features/common/ReaderFloatingBarMetrics.ts'),
  import('../../entry/src/main/ets/features/common/BookAuthorMetadata.ts')]);
const classes = pageSource.slice(pageSource.indexOf('@Observed\nclass SearchBookGroup'), pageSource.indexOf('/**\n * Figma-backed Book Search')).replace('@Observed\n', '');
const classDeps = { ...author, DataOperationType: { ADD: 'add', DELETE: 'delete', CHANGE: 'change', RELOAD: 'reload', MOVE: 'move' } };
const { SearchBookGroup, SearchResultDataSource } = new Function(...Object.keys(classDeps), stripTypeScriptTypes(classes) + ';return {SearchBookGroup,SearchResultDataSource};')(...Object.values(classDeps));
const hostText = read('features/search/SearchHost.ets').replace(/^import[^;]+;\s*/gm, '').replace(/^export /gm, '');
// The actual Host owns publication/view state. Native Core/network is not a
// dependency of this surface-attachment proof; its unused constructor seam
// throws if the test accidentally attempts a query or creates another owner.
const SearchHost = new Function('SearchPublication', 'SearchViewState', 'SearchOrchestrator', stripTypeScriptTypes(hostText) + ';return SearchHost;')(
  SearchPublication, SearchViewState, class { constructor() { assert.fail('Surface test must not dispatch Core/network'); } });
export function searchAttachmentFixture({ mutatePredicate, pageDefinition = pageSource } = {}) {
  const controls = tailControls(), calls = [], native = { bookAcquisitions: () => ({ endSearch() { calls.push(['endSearch']); } }) };
  let currentRuntime = native;
  const dependencies = { ...controls.dependencies, ...scopeConstants, SearchPublication, SearchViewState, SearchResultProjection, SearchBookGroup, SearchResultDataSource,
    ...geometry, ...metrics, ...floating, ...author, registerReaderFonts() {},
    ReaderWindowCoordinator: { metrics: () => metrics.createDefaultReaderWindowMetrics() },
    Scroller: class { scrollEdge() {} }, uiContext: { getFont: () => ({}), postFrameCallback() {} } };
  const hooks = { ...controls.hooks, childSources: { ...controls.hooks.childSources, SearchPage: pageDefinition } };
  const page = compileTailConsumer(pageDefinition, boundedMembers(pageDefinition), dependencies, hooks);
  const names = ['searchPageContent', 'searchPageSurface', 'isCurrentSearchPresentation', 'isCurrentRuntime', 'returnToBookshelf'];
  const selected = names.map(name => { let text = member(searchIndexSource, name); return name === 'isCurrentSearchPresentation' && mutatePredicate ? mutatePredicate(text) : text; });
  // The production Index Builders, callback lambdas, predicate, and complete
  // returnToBookshelf implementation are extracted verbatim. Domain intents
  // other than Back are outbound observers, not replacement business owners.
  const source = `@Component struct Index {\n${selected.join('\n')}\nbuild(){this.searchPageContent();}\n}`;
  const result = compileTailConsumer(source, [...names, 'build'], { ...dependencies, SearchPage: page.Component,
    SearchHost, LOCAL_SOURCE_ID: 'local', deviceInfo: { deviceType: 'phone' }, ReaderRuntimeOwner: runtimeOwnerIdentityProbe(() => currentRuntime) }, hooks);
  const index = result.owner, host = new SearchHost(() => {}, () => index.route === 'search');
  host.viewState.keywordDraft = '原草稿';
  host.orchestrator = { close() { calls.push(['closeSearch']); }, retryHistory() { calls.push(['retryHistory']); } };
  Object.assign(index, { route: 'search', navigationGeneration: 1, mountedRuntimeOwner: native, detailShelfAdmissionMount: 1,
    shelfReceiptRetired: false, searchHost: host, searchPublicationRevision: 0, settingsSnapshot: { reduceMotion: false },
    pendingShelfReadbackKey: '',
    detailBook: { sourceId: 's', bookId: 'current-detail' }, detailToc: ['kept'], remoteReadingSession: undefined,
    nextNavigationGeneration() { this.navigationGeneration++; calls.push(['nextNavigation']); },
    installRemoteReadingSession(value) { this.remoteReadingSession = value; calls.push(['installSession', value]); },
    refreshBookshelf() { calls.push(['refreshBookshelf']); },
    ...Object.fromEntries(['performSearch','stopSearch','clearSearchHistory','onSearchResultSelected','scheduleSearchDetailWarmups','retrySearch','manageSourcesFromSearch']
      .map(name => [name, (...args) => calls.push([name, ...args])])) });
  function mount() { const prior = new Set(index.children.values()); index.initialRender();
    const child = [...index.children.values()].find(c => !prior.has(c)); assert.ok(child instanceof page.Component, 'actual complete SearchPage constructed');
    // Window dimensions are the native platform seam; all page Builders,
    // regular callbacks, decorated Props, and shared controls remain actual.
    child.contentFrame = () => ({ width: 330, left: 16, right: 16 });
    child.searchBottomInset = minimum => minimum ?? 24;
    return child; }
  const first = mount();
  function physical(child) {
    const icon = [...child.children.values()].find(c => c.icon === 'app.media.search_back'); assert.ok(icon, 'actual ReaderIconButton');
    const back = controls.nodes(icon).find(n => typeof n.onClick === 'function'); assert.ok(back, 'actual native Back click');
    const button = [...child.children.values()].find(c => c.specId?.startsWith('search-field-')); assert.ok(button, 'actual ReaderButton');
    const search = controls.nodes(button).find(n => typeof n.onClick === 'function'); assert.ok(search, 'actual native Search click');
    return { back: back.onClick, search: search.onClick, icon, button };
  }
  return { index, first, native, host, calls, controls, mount, physical, setRuntime: value => { currentRuntime = value; }, SearchHost };
}
