import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolveEtsLoaderRoot, virtualFilePath } from './tool-environment.mjs';
import { bookshelfOperationClass, actualBookshelfOperationTypes, actualBookshelfHostField } from './bookshelf-operation-owner-probe.mjs';
import { createReaderBuilderProbe } from './reader-control-builder-probe.mjs';
import { boundedSurfaceSdk, boundedMembers } from './bounded-surface-sdk-probe.mjs';
import { ProductionHost, read } from './reading-entry-owner-probe.mjs';
import { localBookDetailSdk } from './local-book-detail-sdk-probe.mjs';
import { actualReaderPageLayout } from './reader-page-shell-runtime-probe.mjs';
import { actualReadingEntryPresentation } from './reading-entry-presentation-probe.mjs';
import { ReaderNavigation } from '../../entry/src/main/ets/app/navigation/ReaderNavigation.ts';
import { ReaderEntryStartupTrace } from '../../entry/src/main/ets/app/ReaderStartupTrace.ts';
import { ReaderCoreRequestError } from '../../entry/vendor/core-harmony/sdk/reader_core.ts';
import { readerRecoveryView } from '../../entry/src/main/ets/app/ReaderRecoveryProjection.ts';
import { readingEntryInputForSearchContext } from '../../entry/src/main/ets/features/reading/presentation/ReadingEntryDto.ts';
import * as headerMetrics from '../../entry/src/main/ets/ui/foundation/ReaderHeaderMetrics.ts';
import * as geometry from '../../entry/src/main/ets/ui/layout/SurfaceHorizontalGeometry.ts';
import * as metricsApi from '../../entry/src/main/ets/ui/foundation/ReaderWindowMetrics.ts';

const sdk = resolveEtsLoaderRoot(), require = createRequire(import.meta.url);
const ts = require(sdk + '/node_modules/typescript');
const options = require(sdk + '/lib/ets_checker.js').compilerOptions;
const parse = source => ts.createSourceFile(virtualFilePath('EntryConsumer.ets'), source, ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
function indexDeclarations(source, methods, dependencies, className = 'Index') {
  const tree = parse(source);
  assert.deepEqual(tree.parseDiagnostics, []);
  const declaration = tree.statements.find(node => node.name?.text === className);
  const selected = methods.map(name => {
    const nodes = declaration.members.filter(node => node.name?.getText(tree) === name);
    assert.equal(nodes.length, 1, `current Index declaration ${name}`);
    assert.ok(ts.isMethodDeclaration(nodes[0]) && !ts.getAllDecorators(nodes[0]).length, 'ordinary current Index ports only');
    return nodes[0].getText(tree);
  });
  const code = ts.transpileModule(`class IndexPorts {${selected.join('\n')}}`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return new Function(...Object.keys(dependencies), code + ';return IndexPorts;')(...Object.values(dependencies));
}
function indexInitializer(source, field, receiver, dependencies) {
  const tree = parse(source), declaration = tree.statements.find(node => node.name?.text === 'Index');
  const nodes = declaration.members.filter(node => node.name?.getText(tree) === field);
  assert.equal(nodes.length, 1, `current Index initializer ${field}`);
  assert.ok(nodes[0].initializer);
  const code = ts.transpileModule(`const value=${nodes[0].initializer.getText(tree)};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return new Function(...Object.keys(dependencies), code + ';return value;').call(receiver, ...Object.values(dependencies));
}

/** Current real owners + current ordinary Index wiring + real SDK detail scene.
 * External window/layout/notice/frame delivery are controlled ports. No retired
 * Index operation or mirrored field is reconstructed. */
export function makeIndex(f, { route = 'search', mount = 1, indexSource = read('pages/Index.ets'),
  entrySource, sceneSource, domain = 'all' } = {}) {
  assert.ok(['all', 'entry'].includes(domain));
  const p = boundedSurfaceSdk({ allowEmptyBranchAdmission: true });
  const Runtime = { isCurrent: owner => owner === f.runtime && !owner.closed };
  const types = actualBookshelfOperationTypes({ ReaderRuntimeOwner: Runtime, ReaderCoreRequestError });
  const observe = value => p.properties.sdk.ObservedObject.createNew(value, undefined);
  const Entry = actualReadingEntryPresentation({ ReadingEntryHost: f.host.constructor });
  if (entrySource !== undefined) {
    const changed = indexDeclarations(entrySource, ['installSession', 'publish'], { LOCAL_SOURCE_ID: 'local' }, 'ReadingEntryPresentation');
    for (const name of ['installSession', 'publish']) Entry.prototype[name] = changed.prototype[name];
  }
  const Actions = bookshelfOperationClass('app/composition/ReaderReadingEntryActions.ets', 'ReaderReadingEntryActions', {
    Observed: value => value, readingEntryInputForSearchContext,
  });
  const Detail = bookshelfOperationClass('features/bookshelf/presentation/BookshelfDetailPresentation.ets', 'BookshelfDetailPresentation', {
    Observed: value => value, EMPTY_READABLE_ADMISSION: types.EMPTY_READABLE_ADMISSION,
  });
  const Mutations = bookshelfOperationClass('features/bookshelf/presentation/BookshelfMutationPresentation.ets', 'BookshelfMutationPresentation', {
    Observed: value => value, EMPTY_BOOKSHELF_OPERATION_SNAPSHOT: types.EMPTY_BOOKSHELF_OPERATION_SNAPSHOT,
    readerRecoveryView, AppStorage: { setOrCreate() {} },
  });
  const Index = indexDeclarations(indexSource, ['readingEntryActionPorts', 'readingEntryPorts', 'bindReadingEntryReader',
    'currentReadingRuntime', 'isCurrentRuntime', 'detailScenePorts', 'detailContentIsForeground', 'isCurrentDetailPresentation',
    'isDetailDirectoryRoute', 'readingShelfPreparationScene', 'preparePersistedShelfBooks', 'prepareVisibleReadingBooks',
    'onSearchVisibilityChanged', 'openReading'], { ReaderRuntimeOwner: Runtime, ReaderNavigationBackfillFrame: class { constructor(action) { this.onFrame = action; } } });
  const idx = new Index();
  const navigation = new ReaderNavigation();
  navigation.show(route);
  const entry = observe(new Entry());
  const source = { visible: false, pending: undefined, failureMessage: '', host: () => undefined };
  const emptyPresentation = { retire() {} };
  Object.assign(idx, {
    navigationOwner: navigation, mountedRuntimeOwner: f.runtime, rssInstanceIdentity: 1,
    detailShelfAdmissionMount: mount, shelfReceiptRetired: false,
    readingEntry: entry, sourceSwitchPresentation: source, mangaSourceSwitch: { selectionVisible: false },
    searchAppForeground: true, arkWebCapturesInput: false,
    libraryAcquisition: { currentOwner: () => f.runtime.closed ? undefined : f.runtime, visibilityChanged() {} },
    shelfRead: { snapshot: { books: [], revision: 'r1' } }, shelfCatalog: { snapshot: { seeds: undefined } },
    settingsPresentation: { ready: () => true }, shelfMotion: { pendingExitId: -1, visibilityChanged() {}, projectAfterOpening: project => project() },
    readingCommits: { refreshNearEnd() {} }, downloadNavigation: { restoreReaderReturn: () => false },
    readingExitActions: { navigationSettled() {} }, transientFeedback: { reset() {} },
    librarySearch: { host: { visibilityChanged() {} }, admissionCandidates: () => [] },
    sourceDisplayName: (_id, name) => name ?? 'Named Source',
    sourceJourney: emptyPresentation,
    shelfFilter: () => ({ reading: 'all', sourceKind: 'all', contentKind: 'all' }),
    refreshBookshelf() { this.refreshCount = (this.refreshCount ?? 0) + 1; },
    refreshSearchShelfMembership() { this.membershipRefreshCount = (this.membershipRefreshCount ?? 0) + 1; },
    invalidateBookshelfProjection() { this.invalidationCount = (this.invalidationCount ?? 0) + 1; },
    applyBookshelfState(state) { this.acceptedShelf = state; },
    showReadingFailure: f.lease.notice,
    openBookRemovalDialog: (message, action) => { f.removalDialog = { message, cancel() {}, accept: action }; },
    getUIContext: () => ({ postFrameCallback: frame => frame.onFrame(0) }),
    chooseCachedChapterRefresh: (error, current) => entry.chooseCachedChapterRefresh(error, current, {
      runtime: () => idx.currentReadingRuntime(), notice: (...args) => entry.showRecoveryNotice(...args), feedback() {},
    }),
    hydrateMangaPositions(books) { assert.ok(books.every(book => book.contentKind !== 'manga'), 'manga hydration outside this text entry fixture'); },
    openFullDirectory() { throw Error('directory journey requires its own fixture'); },
    openDetailSourceSwitch() { throw Error('source switch outside entry fixture'); },
    onBackPress() { navigation.advance(); navigation.show('search'); },
  });
  Object.defineProperties(idx, {
    route: { get: () => navigation.snapshot().route, set: next => navigation.show(next) },
    navigationGeneration: { get: () => navigation.snapshot().generation },
    directoryReturnTarget: { get: () => navigation.snapshot().directoryReturnTarget },
  });
  // Current action owner is the behavior under test; unrelated presentation
  // retirement and UI-frame delivery are explicit ports, not old Index copies.
  idx.nextNavigationGeneration = () => { entry.retire(); idx.readingEntryActions.retirePreparation(); return navigation.advance().generation; };
  idx.navigateTo = next => navigation.show(next);
  idx.shelfMutations = observe(indexInitializer(indexSource, 'shelfMutations', idx, { BookshelfMutationPresentation: Mutations }));
  idx.detailShelf = observe(indexInitializer(indexSource, 'detailShelf', idx, { BookshelfDetailPresentation: Detail }));
  idx.bookshelfHost = actualBookshelfHostField(idx, types.Host, { setOrCreate() {} });
  idx.readingEntryActions = new Actions(navigation, new ReaderEntryStartupTrace(() => {}), idx.readingEntryActionPorts());
  idx.detailShelf.mount(f.runtime);

  const metrics = metricsApi.createDefaultReaderWindowMetrics();
  metrics.windowRect = new metricsApi.ReaderRectVp(0, 0, 390, 844);
  const resolvers = bookshelfOperationClass('ui/foundation/ReaderSurfaceResolvers.ts', '({readerScaledBarHeight,readerScaledControlHeight,readerReadableFontScale})', metricsApi);
  const headers = bookshelfOperationClass('ui/foundation/ReaderHeaderSpecs.ets', '({DetailHeaderSpec,detailHeaderSpec})', { ...p.deps, ...headerMetrics });
  const leafDeps = { ...p.deps, ...headerMetrics, ...resolvers, ...headers, ...actualReaderPageLayout(), ...geometry, ...metricsApi, ReaderWindowCoordinator: { metrics: () => metrics }, BookDirectoryPage: class {} };
  // Shadow painting is not entry behavior. Register the exact shipping child
  // properties; its native Canvas/layout/raster output remains an explicit port.
  class ShadowCanvasPort { constructor(owner, params, _storage, id) { Object.assign(this, { owner, params, id }); } initialRender() {} updateStateVars(next) { Object.assign(this.params, next); } }
  p.hooks.childSources.ReaderRaisedSurface = read('ui/surfaces/ReaderRaisedSurface.ets');
  leafDeps.ReaderRaisedSurface = ShadowCanvasPort;
  p.hooks.childSources.LocalBookDetail = read('features/reading/ui/LocalBookDetail.ets');
  p.hooks.childSources.BookDirectoryPage = read('features/reading/ui/BookDirectoryPage.ets');
  const leaf = localBookDetailSdk(leafDeps, p.hooks, p.properties).Component;
  const label = bookshelfOperationClass('features/reading/presentation/ReadingEntryPresentation.ets', 'remoteContentVerdictLabel', { Observed: value => value });
  // The full frontend collects imported @Observed declarations before lowering
  // @ObjectLink. Perform that exact finite metadata prepass for current owners.
  const syntax = require(sdk + '/lib/validate_ui_syntax.js');
  for (const [path, name] of [
    ['features/reading/presentation/ReadingEntryPresentation.ets', 'ReadingEntryPresentation'],
    ['features/bookshelf/presentation/BookshelfDetailPresentation.ets', 'BookshelfDetailPresentation'],
    ['features/bookshelf/presentation/BookshelfMutationPresentation.ets', 'BookshelfMutationPresentation'],
  ]) {
    const tree = parse(read(path)), declaration = tree.statements.find(node => node.name?.text === name);
    assert.ok(ts.getAllDecorators(declaration).some(decorator => decorator.getText(tree) === '@Observed'));
    syntax.observedClassCollection.add(name);
  }
  const scene = p.consumer(sceneSource ?? read('features/bookshelf/ui/BookshelfDetailScene.ets'), undefined,
    { ...leafDeps, SynchedPropertyNesedObjectPU: p.properties.sdk.SynchedPropertyNestedObjectPU, LocalBookDetail: leaf, remoteContentVerdictLabel: label },
    { entry, detail: idx.detailShelf, mutations: idx.shelfMutations });
  Object.assign(scene, { ports: idx.detailScenePorts() });
  const render = () => {
    Object.assign(scene, { identity: idx.detailShelf.identity(), foreground: idx.detailContentIsForeground(),
      directoryRetained: idx.isDetailDirectoryRoute(), mutationEnabled: entry.book !== undefined && idx.detailShelf.mutationEnabled(entry.book) });
    if (!scene.rendered) { scene.aboutToAppear?.(); scene.initialRender(); scene.rendered = true; } else scene.replay();
    return p.walk(scene).filter(child => child instanceof leaf).at(-1);
  };
  const notice = () => {
    const component = p.consumer(read('features/bookshelf/ui/BookshelfDetailNotice.ets'), undefined, { SynchedPropertyNesedObjectPU: p.properties.sdk.SynchedPropertyNestedObjectPU }, { presentation: idx.detailShelf });
    component.initialRender(); return component;
  };
  return { p, idx, entry, entryActions: idx.readingEntryActions, navigation, scene, owner: () => f.host.constructor.forRuntime(f.runtime), render, leaf, notice };
}

