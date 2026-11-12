import { resolveEtsLoaderRoot } from './lib/tool-environment.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { runtimeOwnerIdentityProbe } from './lib/reader-runtime-admission-probe.mjs';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { createArkUIPropertyRuntimeProbe } from './lib/arkui-property-runtime-probe.mjs';
import { selectedProductionMethods } from './lib/selected-production-methods.mjs';
import { pureModuleProbe } from './lib/ets-pure-module-probe.mjs';
import { actualReadingEntryPresentation } from './lib/reading-entry-presentation-probe.mjs';
import { SearchViewState } from '../entry/src/main/ets/features/search/presentation/SearchViewState.ts';
import { SearchPublication } from '../entry/src/main/ets/features/search/presentation/SearchPublication.ts';
import { ReaderNavigation } from '../entry/src/main/ets/app/navigation/ReaderNavigation.ts';
import { ReaderLibraryAcquisitionBinding } from '../entry/src/main/ets/app/composition/ReaderLibraryAcquisitionBinding.ts';
import * as headerMetrics from '../entry/src/main/ets/ui/foundation/ReaderHeaderMetrics.ts';
import { readerFoundationTokens } from './lib/reader-tokens-probe.mjs';

const root = new URL('../entry/src/main/ets/', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');
const originalIndexProof = JSON.parse(readFileSync(new URL('./fixtures/icon-button-family/bookshelf-search-owner-before.json', import.meta.url), 'utf8'));
const originalIndexFixture = readFileSync(new URL('./fixtures/icon-button-family/bookshelfShellContent.before.ets', import.meta.url), 'utf8');
assert.equal(createHash('sha256').update(originalIndexFixture).digest('hex'), originalIndexProof.fixtureSha256,
  'frozen actual original Index member cannot drift');
const indexFile = process.env.READER_SHELF_SEARCH_INDEX_SOURCE ?? new URL('pages/Index.ets', root);
const indexSource = readFileSync(indexFile, 'utf8');
const journeySource = read('app/composition/ReaderLibraryJourney.ets');
const require = createRequire(import.meta.url), sdk = resolveEtsLoaderRoot();
const syntax = require(sdk + '/lib/validate_ui_syntax.js');
syntax.builderParamObjectCollection.set('ReaderLibrarySearchSurface', new Set(['results']));
const header = pureModuleProbe(read('ui/foundation/ReaderHeaderSpecs.ets'), 'ReaderHeaderSpecs.ets',
  { ...headerMetrics, TOK_BORDER_W: readerFoundationTokens.TOK_BORDER_W }, ['bookshelfHeaderSpec', 'readerPageInitialHeaderHeight']);
const model = pureModuleProbe(read('features/search/presentation/ReaderLibrarySearchModel.ets'), 'ReaderLibrarySearchModel.ets',
  { Observed: value => value }, ['ReaderLibrarySearchModel', 'READER_LIBRARY_SEARCH_BACK_FOCUS_ID']);
const { SearchHost } = pureModuleProbe(read('features/search/application/SearchHost.ets'), 'SearchHost.ets',
  { SearchViewState, SearchPublication, SearchOrchestrator: class {
    constructor() { assert.fail('Search action proof must not dispatch native Core/network'); }
  } }, ['SearchHost']);
const { LibrarySearchPresentation } = pureModuleProbe(read('features/search/presentation/LibrarySearchPresentation.ets'),
  'LibrarySearchPresentation.ets', { Observed: value => value, ...header, ...model, SearchHost }, ['LibrarySearchPresentation']);
const ReadingEntryPresentation = actualReadingEntryPresentation();
class SurfaceCarrier {
  constructor(owner, params, _storage, id) { Object.assign(this, { owner, params, id }); }
}
class EmptyCarrier extends SurfaceCarrier {}
class SearchField {}

// The shared header and BookshelfScene are retained siblings in Index.
// Exercise the physical header and actual empty-shelf entry separately.
function fixture(source = journeySource) {
  const calls = [], coordinator = {
    subscribe: () => () => {}, beginSearch: () => calls.push('warmup'), endSearch() {},
  };
  const runtime = { bookAcquisitions: () => coordinator, readingEntryPreparations: () => ({ setPaused() {} }),
    setDownloadReadingProtection() {} };
  let current = runtime;
  const ReaderRuntimeOwner = runtimeOwnerIdentityProbe(() => current);
  const methods = ['libraryJourneyPorts', 'bookshelfScenePorts', 'isCurrentRuntime', 'currentReadingRuntime',
    'isCurrentBookshelfPresentation', 'isInteractiveBookshelfPresentation', 'bookshelfContentAcceptsInput',
    'bookshelfModalVisible', 'publishNavigation'];
  const Index = selectedProductionMethods(indexFile, 'Index', methods, { ReaderRuntimeOwner });
  const index = Object.assign(new Index(), {
    mountedRuntimeOwner: runtime, rssInstanceIdentity: 1, shelfReceiptRetired: false,
    route: 'bookshelf', navigationGeneration: 7, detailShelfAdmissionMount: 3,
    searchAppForeground: true, arkWebCapturesInput: false,
    readingEntry: new ReadingEntryPresentation(), readingEntryActions: { shelfPreparing: false },
    shelfMutations: { snapshot: {} }, shelfGroupPresentation: { identity: '' },
    shelfRead: { snapshot: { visualAdmitted: true }, headerScrolled: false },
    settingsPresentation: { snapshot: { reduceMotion: false } }, expandedLayout: () => false,
    bookRemovalConfirmation: { dismiss() {} }, jsonImportPresentation: { dismiss() {} },
    refreshSearchShelfMembership: () => calls.push('membership'), librarySearchResults() {},
    onBackPress: () => calls.push('back'),
  });
  index.navigationOwner = new ReaderNavigation();
  while (index.navigationOwner.snapshot().generation < 7) index.navigationOwner.advance();
  index.libraryAcquisition = new ReaderLibraryAcquisitionBinding();
  index.libraryAcquisition.mount(runtime, {
    ownsRuntime: owner => index.isCurrentRuntime(owner), detailBook: () => index.readingEntry.book,
    refreshShelf() {}, refreshMembership: index.refreshSearchShelfMembership, refreshDetail() {},
  });
  index.librarySearch = new LibrarySearchPresentation(() => index.route === 'search', () => false);
  const host = index.librarySearch.host, prepareEntry = host.prepareEntry.bind(host);
  host.prepareEntry = () => { calls.push('prepare'); prepareEntry(); };
  // Outbound scheduling/query and root retirement are finite seams. Real
  // Journey/Navigation/Host draft reset/reading release execute unchanged.
  host.orchestrator = { open: () => calls.push('open') };
  index.nextNavigationGeneration = () => {
    calls.push('navigation'); index.publishNavigation(index.navigationOwner.advance());
    return index.navigationGeneration;
  };
  const { ReaderLibraryJourney } = pureModuleProbe(source, 'ReaderLibraryJourney.ets', {}, ['ReaderLibraryJourney']);
  index.libraryJourney = new ReaderLibraryJourney(index.navigationOwner, index.libraryJourneyPorts());
  index.readingEntry.attachExitRequest(() => {}, () => true);
  const properties = createArkUIPropertyRuntimeProbe();
  const parent = createReaderBuilderProbe(indexSource, ['librarySearchSurface'],
    { ...properties.sdk, ReaderLibrarySearchSurface: SurfaceCarrier },
    { ...properties.hooks, childSources: { ReaderLibrarySearchSurface: read('features/search/ui/ReaderLibrarySearchSurface.ets') } }).owner;
  Object.assign(parent, index);
  parent.bookshelfContentAcceptsInput = index.bookshelfContentAcceptsInput.bind(index);
  parent.librarySearchSurface(runtime, host);
  const carrier = [...parent.children.values()].find(child => child instanceof SurfaceCarrier);
  assert.ok(carrier, 'actual Index mounts its persistent search surface');
  const surface = createReaderBuilderProbe(read('features/search/ui/ReaderLibrarySearchSurface.ets'),
    ['bar', 'headerActionGlyph', 'headerActionFrame', 'headerActionTop', 'moreInteractive', 'leadingAction',
      'moreAction', 'presentedSearch', 'blend'],
    { ...header, ...model, ReaderSearchField: SearchField, READER_FONT_NOTO_SANS_SC_UI_BOLD: 'ReaderNotoSansSCUIBold' },
    { childSources: { ReaderSearchField: read('ui/controls/ReaderSearchField.ets') } }).owner;
  Object.assign(surface, carrier.params, { mounted: true, transitionKind: 'none', scheme: 'day', searchMounted: false,
    cardContentWidth: () => 352, barHeight: () => 52, titleOpacity: () => 1, surfaceValue: () => 0 });
  surface.bar();
  const button = () => {
    const focus = surface.mode === 'idle' ? 'reader-bookshelf-search-entry' : model.READER_LIBRARY_SEARCH_BACK_FOCUS_ID;
    const node = [...surface.nodes.values()].find(node => node.id === focus);
    assert.ok(node && node.type === 'Button' && node.width === 44 && node.height === 44 && node.onClick,
      'actual shared surface owns the original 44x44 native Search Button');
    return node;
  };
  const render = () => {
    Object.assign(parent, index); parent.replay();
    // Actual SDK parent child-update props, with delivery instrumented. Native
    // scheduling/layout are separate; the same surface runs its real Builder.
    Object.assign(surface, carrier.params); surface.replay();
  };
  const move = (route, advance = false) => {
    if (advance) index.navigationOwner.advance();
    index.publishNavigation(index.navigationOwner.show(route));
  };
  const emptyScene = () => {
    const scene = createReaderBuilderProbe(read('features/bookshelf/ui/BookshelfScene.ets'),
      ['shelfContent', 'isCurrent', 'isInteractive', 'open'],
      { BookshelfPage: EmptyCarrier, BookshelfEmptyPage: EmptyCarrier, BookshelfStatusContent: EmptyCarrier },
      { childSources: Object.fromEntries(['BookshelfPage', 'BookshelfEmptyPage', 'BookshelfStatusContent']
        .map(name => [name, read('features/bookshelf/ui/' + name + '.ets')])) }).owner;
    Object.assign(scene, { navigation: index.navigationGeneration, read: { snapshot: { coreEmpty: true } },
      ports: index.bookshelfScenePorts(runtime, index.detailShelfAdmissionMount) });
    scene.shelfContent();
    const child = [...scene.children.values()].find(child => child.params.onSearchRequested);
    assert.ok(child, 'actual empty-shelf scene binds its search intent');
    return child.params.onSearchRequested;
  };
  return { index, parent, surface, carrier, button, render, move, emptyScene, calls,
    setRuntime(value) { current = value; } };
}

let cases = 0;
{
  const f = fixture(), click = f.button().onClick;
  click();
  assert.deepEqual(f.calls, ['prepare', 'navigation', 'warmup', 'membership', 'open']);
  assert.equal(f.index.route, 'search'); assert.equal(f.index.readingEntry.sessionActive, false);
  assert.equal(f.index.readingEntry.currentExitRequest(), undefined, 'actual reading owner clears the prior exit lease');
  assert.equal(f.index.librarySearch.mode, 'input');
  assert.equal(f.index.librarySearch.host.viewState.consumeInputFocusRequest(), true, 'actual Host requests input focus');
  click(); assert.equal(f.calls.length, 5, 'retained physical click cannot open search twice after navigation'); cases++;
}
for (const retirement of ['route', 'navigation', 'mount', 'retired', 'runtime', 'mounted-owner']) {
  const f = fixture(), click = f.button().onClick;
  if (retirement === 'route') f.move('reading');
  if (retirement === 'navigation') f.move('bookshelf', true);
  if (retirement === 'mount') f.index.detailShelfAdmissionMount++;
  if (retirement === 'retired') f.index.shelfReceiptRetired = true;
  if (retirement === 'runtime') f.setRuntime({});
  if (retirement === 'mounted-owner') f.index.mountedRuntimeOwner = {};
  const before = { route: f.index.route, navigation: f.index.navigationGeneration,
    exit: f.index.readingEntry.currentExitRequest() };
  click();
  // A leaf guard cannot conceal missing root owner admission.
  f.carrier.params.onOpen(0, 7, 3);
  assert.deepEqual(f.calls, [], retirement + ': no Host/navigation side effect');
  // First test retirement with an otherwise interactive shelf. An active
  // reader's independent input guard must not conceal a missing identity guard.
  f.index.readingEntry.sessionActive = true;
  click(); f.carrier.params.onOpen(0, 7, 3);
  assert.equal(f.index.readingEntry.sessionActive, true, retirement + ': preserve active reader');
  assert.deepEqual({ route: f.index.route, navigation: f.index.navigationGeneration,
    exit: f.index.readingEntry.currentExitRequest() }, before); cases++;
}
{
  const f = fixture(), oldClick = f.button().onClick, surface = f.surface, carrier = f.carrier;
  f.move('bookshelf', true); f.render();
  oldClick(); assert.deepEqual(f.calls, [], 'old physical generation cannot be upgraded by a Prop update');
  assert.equal(f.surface, surface, 'the actual search surface remains mounted');
  assert.equal([...f.parent.children.values()][0], carrier, 'Index keeps the same child actor');
  f.button().onClick(); assert.equal(f.index.route, 'search'); assert.equal(f.calls.at(-1), 'open'); cases++;
}
for (const disabled of ['panel', 'background', 'web', 'import', 'group', 'preparing']) {
  const f = fixture(), click = f.button().onClick;
  if (disabled === 'panel') f.surface.model.panelOwnsInput = true;
  if (disabled === 'background') f.index.searchAppForeground = false;
  if (disabled === 'web') f.index.arkWebCapturesInput = true;
  if (disabled === 'import') f.index.shelfMutations.snapshot.importPresentation = {};
  if (disabled === 'group') f.index.shelfGroupPresentation.identity = 'group-opening';
  if (disabled === 'preparing') f.index.readingEntryActions.shelfPreparing = true;
  f.surface.replay();
  if (disabled === 'panel') assert.deepEqual([f.button().enabled, f.button().focusable, f.button().accessibilityLevel],
    [false, false, 'no-hide-descendants'], 'native Search Button projects panel input isolation');
  click(); assert.deepEqual(f.calls, [], disabled + ': native callback cannot dispatch'); cases++;
}
{
  const f = fixture(), click = f.emptyScene();
  click(); assert.deepEqual(f.calls, ['prepare', 'navigation', 'warmup', 'membership', 'open']);
  click(); assert.equal(f.calls.length, 5, 'retained empty-shelf intent cannot dispatch twice'); cases++;
}
{
  const f = fixture(), click = f.emptyScene();
  f.move('bookshelf', true); click();
  assert.deepEqual(f.calls, [], 'stale empty-shelf scene cannot dispatch current navigation'); cases++;
}
{
  const f = fixture();
  f.move('search'); f.index.librarySearch.mode = 'input'; f.render();
  const click = f.button().onClick;
  click(); assert.deepEqual(f.calls, ['back'], 'current retained Search Button delivers Back once');
  f.index.mountedRuntimeOwner = {};
  click(); f.carrier.params.onBack(0, 7, 3);
  assert.deepEqual(f.calls, ['back'], 'retained search Back rejects a replaced mounted owner'); cases++;
}
// Remove only the newly restored scope-owner conjunct in each actual method.
// Keep global Runtime/acquisition admission so each negative isolates the
// mounted-root gap rather than relying on a second, unrelated retirement.
const ts = require(sdk + '/node_modules/typescript');
for (const name of ['isCurrentBookshelf', 'isCurrentSearch']) {
  const tree = ts.createSourceFile('ReaderLibraryJourney.ets', journeySource, ts.ScriptTarget.Latest, true,
    ts.ScriptKind.ETS, require(sdk + '/lib/ets_checker.js').compilerOptions);
  const declaration = tree.statements.find(node => node.name?.text === 'ReaderLibraryJourney');
  const method = declaration.members.find(node => node.name?.getText(tree) === name);
  assert.ok(method, name + ': actual guard exists');
  const original = method.getText(tree), changed = original.replace('scope.owner === owner && ', '');
  assert.notEqual(changed, original, name + ': finite negative removes only the mounted-owner guard');
  const source = journeySource.slice(0, method.getStart(tree)) + changed + journeySource.slice(method.end);
  assert.throws(() => {
    const f = fixture(source);
    if (name === 'isCurrentSearch') { f.move('search'); f.index.librarySearch.mode = 'input'; f.render(); }
    const click = f.button().onClick;
    f.index.mountedRuntimeOwner = {};
    click();
    assert.deepEqual(f.calls, [], name + ': reject old mounted owner');
  }, /reject old mounted owner/, name + ': the actual old guard admits a stale action and must be rejected');
  cases++;
}
console.log(`PASS ${cases} actual Index/BookshelfScene→ReaderLibrarySearchSurface/ReaderLibraryJourney SDK search admission groups: single dispatch, disabled input, route/navigation/mount/runtime retirement, reader preservation and retained-surface rebind. Native dispatch/layout remain separate.`);
