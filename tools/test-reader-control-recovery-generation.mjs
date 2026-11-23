import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { boundedSurfaceSdk, boundedMembers } from './lib/bounded-surface-sdk-probe.mjs';
import { pureModuleProbe } from './lib/ets-pure-module-probe.mjs';
import { selectedProductionClasses } from './lib/selected-production-methods.mjs';
import { sampleReaderControlSearch } from '../entry/src/main/ets/features/reading/ui/ReaderControlSearchGeometry.ts';

const definitions = {
  'retained-recovery': {
    description: 'Actual SDK retained RecoveryAction and PageState instances refresh native generation while preserving ordinary current receivers',
    resources: [],
  },
};
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const directoryPath = 'entry/src/main/ets/features/reading/ui/ReaderControlDirectoryContent.ets';
const searchPath = 'entry/src/main/ets/features/reading/ui/ReaderControlSearchContent.ets';
const pageStatePath = 'entry/src/main/ets/ui/feedback/ReaderPageState.ets';
const searchClasses = selectedProductionClasses(new URL('../' + searchPath, import.meta.url), ['ReaderSearchMeasuredMessageFrame']);
const publicationModule = pureModuleProbe(read('entry/src/main/ets/features/reading/presentation/ReaderContentSearchPublication.ets'),
  'ReaderContentSearchPublication.ets', {}, ['ReaderContentSearchPublication']);
const searchFactsModule = pureModuleProbe(read('entry/src/main/ets/features/reading/ui/ReaderControlSearchMinimum.ets'),
  'ReaderControlSearchMinimum.ets', {}, ['readerControlSearchMinimumFacts']);
const preparedChecks = pureModuleProbe(read('entry/src/main/ets/features/reading/ui/ReaderControlMinimumMeasurement.ets'),
  'ReaderControlMinimumMeasurement.ets', {}, ['readerControlModuleProfileMatches', 'readerControlModuleFactsMatch',
    'readerControlModuleFactsGeometryKey', 'readerControlModuleFactsDisplayEqual']);
const textStyles = selectedProductionClasses(new URL('../entry/src/main/ets/ui/foundation/ReaderTypography.ets', import.meta.url),
  ['ReaderTextStyle', 'ReaderInheritedTextStyle']);
const textMeasurement = pureModuleProbe(read('entry/src/main/ets/features/reading/ui/ReaderControlTextMeasurement.ets'),
  'ReaderControlTextMeasurement.ets', { WordBreak: { BREAK_WORD: 'break' } }, ['measureReaderControlText']);
const measureContext = {
  px2vp: value => value,
  getMeasureUtils: () => ({
    measureText: options => [...options.textContent].length * Number.parseFloat(options.fontSize),
    measureTextSize(options) {
      const width = [...options.textContent].length * Number.parseFloat(options.fontSize);
      const line = Number.parseFloat(options.lineHeight ?? options.fontSize) * (options.lineHeight ? 1 : 1.5);
      return { width: Math.min(width, options.constraintWidth),
        height: line * (options.maxLines === 1 ? 1 : Math.ceil(width / Math.max(1, options.constraintWidth))) };
    },
  }),
};

function actualAction(sdk, owner) {
  const actions = sdk.walk(owner).filter(child => child instanceof sdk.deps.ReaderRecoveryAction);
  assert.equal(actions.length, 1, 'one actual shared RecoveryAction child');
  const child = actions[0];
  const buttons = [...child.nodes.values()].filter(node => node.type === 'Button' && typeof node.onClick === 'function');
  assert.ok(buttons.length > 0, 'actual shared native action is mounted');
  const button = buttons.at(-1);
  return { child, button, nativeId: [...child.nodes.entries()].find(([, node]) => node === button)[0], callback: button.onClick };
}

function resetDirectChild(sdk, owner, child) {
  owner.replayOnly(new Set([child.id]));
  sdk.properties.flush();
  assert.equal(owner.children.get(child.id), child, 'SDK updateStateVars preserves the real child instance');
}

function makeSearch(source = read(searchPath)) {
  const sdk = boundedSurfaceSdk();
  const methods = ['loadMoreAction', 'loadMoreActionEnabled', 'loadMoreActionHandler', 'resultActionCurrent',
    'displayResults', 'displayState', 'displayedResultScope', 'displayedLoadMoreFailure', 'state', 'retainedLoadMoreFailure', 'searchRevision',
    'acceptedSearchState', 'acceptedResultScrollScope', 'acceptSearchPublication', 'onResultDataChanged', 'publishMinimumMeasurer',
    'preparedMinimum', 'minimumIdentity', 'minimumKey', 'adoptedPrepared', 'adoptedPreparedKey',
    'presentationPrepared', 'preparedProfile', 'displayedFacts', 'onPreparedMinimumChanged'];
  if (source.includes('private performLoadMore(')) methods.push('performLoadMore');
  if (source.includes('private currentSearchState(')) methods.push('currentSearchState');
  const owner = createReaderBuilderProbe(source, methods,
    { ...sdk.deps, ...searchClasses, ...searchFactsModule, ...preparedChecks }, sdk.hooks).owner;
  const profileMeasurer = pureModuleProbe(read('entry/src/main/ets/features/reading/ui/ReaderControlSearchMinimum.ets'),
    'ReaderControlSearchMinimum.ets', { ...sdk.deps, ...textStyles, ...textMeasurement, sampleReaderControlSearch },
    ['measureReaderSearchMinimum']);
  const publication = new publicationModule.ReaderContentSearchPublication();
  let calls = 0;
  let revision = 0;
  let latestFacts;
  let profile;
  Object.assign(owner, { searchPublication: publication, queryInputMounted: true, motionProgress: 1,
    currentInputEnabled: () => true, preparedMinimumRequired: true,
    query: '', resultDataSource: { publish: () => 'retain' }, onResultLayoutChanged: () => {},
    onMinimumFactsChanged: (_identity, facts) => { latestFacts = facts.search; },
    frame: () => ({ results: { width: 286, height: 120 }, loadMoreHeightVp: 44, loadMoreWidthVp: 150 }),
    presentation: () => ({ contentOpacity: 1, contentBlur: 0 }), onLoadMore: () => calls++, submit: () => calls++ });
  owner.minimumIdentity = 'actual-state-owner';
  owner.minimumKey = 'stable-geometry-key';
  const adopt = () => {
    if (profile === undefined) {
      profile = profileMeasurer.measureReaderSearchMinimum(measureContext,
        { panelWidthVp: 364, quickContentWidthVp: 286, fullContentWidthVp: 338 }, latestFacts);
      assert.ok(profile, 'actual Search pure measurer supplies the finite prepared profile');
    }
    owner.preparedMinimum = { identity: owner.minimumIdentity, key: owner.minimumKey,
      moduleData: { module: 'search', search: profile }, facts: { module: 'search', search: latestFacts }, ownerCurrent: () => true };
  };
  const publish = (keyword, overrides = {}, adoptView = true) => {
    const previous = publication.stateAt(revision);
    const results = previous.kind === 'results' && previous.keyword === keyword ? previous.results : [];
    const state = { kind: 'results', keyword, results, hasMore: true, loadingMore: false, loadMoreError: 'retry', ...overrides };
    publication.publish(state);
    owner.searchRevision = ++revision;
    assert.notEqual(owner.state, state, 'the real SDK State is an observed proxy');
    assert.equal(owner.acceptedSearchState, state, 'actual acceptSearchPublication retains the raw immutable snapshot');
    assert.equal(latestFacts.readViewState(), state, 'facts factory captures the original raw publication, not the SDK proxy');
    if (adoptView) adopt();
    return state;
  };
  publish('原查询');
  owner.loadMoreAction();
  assert.ok(sdk.properties.reads.some(read => read.owner === owner && read.name === 'state' && read.id >= 0),
    'the real Builder still observes its State while using the raw accepted display snapshot');
  return { sdk, owner, publish, adopt, calls: () => calls };
}

function formalReadonlyWindow() {
  const sample = makeSearch();
  const rawA = sample.owner.searchPublication.stateAt(sample.owner.searchRevision);
  const first = actualAction(sample.sdk, sample.owner);
  const generationA = first.child.generation;
  const receiver = first.child.onReconcile;
  first.callback();
  assert.equal(sample.calls(), 1);
  const rawB = sample.publish('后继查询', {}, false);
  assert.equal(sample.owner.displayState(), rawA, 'formal reader keeps the admitted A view while raw B is ready');
  assert.equal(sample.owner.searchPublication.stateAt(sample.owner.searchRevision), rawB);
  assert.equal(rawB.loadingMore, false, 'the new raw B operation is ready during the unadopted window');
  sample.sdk.properties.flush();
  const intermediate = actualAction(sample.sdk, sample.owner);
  assert.equal(intermediate.child, first.child);
  assert.equal(intermediate.child.generation, generationA, 'unadopted A retains its captured original operation scope');
  assert.equal(intermediate.nativeId, first.nativeId, 'unadopted view does not invent an intermediate native action');
  first.callback();
  intermediate.callback();
  assert.equal(sample.calls(), 1, 'the retained A action cannot operate on unadopted ready B');
  sample.adopt();
  sample.sdk.properties.flush();
  const next = actualAction(sample.sdk, sample.owner);
  assert.equal(next.child, first.child);
  assert.equal(next.child.onReconcile, receiver);
  assert.equal(sample.owner.displayState(), rawB, 'the matching prepared reader atomically adopts raw B');
  assert.ok(next.child.generation > generationA);
  assert.notEqual(next.nativeId, first.nativeId, 'only the actual adopted operation handoff creates a new native generation');
  first.callback();
  intermediate.callback();
  assert.equal(sample.calls(), 1, 'retired A and intermediate native handlers reject final ready B');
  next.callback();
  assert.equal(sample.calls(), 2, 'B native action uses the original ordinary receiver for its own admitted operation');
}

function searchRetention(source) {
  const sample = makeSearch(source);
  const first = actualAction(sample.sdk, sample.owner);
  first.callback();
  assert.equal(sample.calls(), 1, 'current original query recovers');
  const receiver = first.child.onReconcile;
  sample.publish('后继查询');
  resetDirectChild(sample.sdk, sample.owner, first.child);
  const next = actualAction(sample.sdk, sample.owner);
  assert.equal(next.child, first.child);
  assert.equal(next.child.onReconcile, receiver, 'ordinary callback remains the original function during SDK Prop reset');
  first.callback();
  assert.equal(sample.calls(), 1, 'old native query handler rejects the successor operation');
  next.callback();
  assert.equal(sample.calls(), 2, 'updated retained recovery native handler operates the current query');
  sample.publish('后继查询', { loadingMore: true });
  next.callback();
  assert.equal(sample.calls(), 2, 'live raw busy state still rejects recovery');
  sample.sdk.properties.flush();
  assert.equal(actualAction(sample.sdk, sample.owner).nativeId, next.nativeId, 'same-query busy keeps its existing native action');
  sample.publish('后继查询', { loadingMore: false });
  sample.sdk.properties.flush();
  assert.equal(actualAction(sample.sdk, sample.owner).nativeId, next.nativeId, 'same-query ready keeps that same native action');
  next.callback();
  assert.equal(sample.calls(), 3, 'the same query operation resumes through its existing handler after busy clears');
  sample.owner.currentInputEnabled = () => false;
  next.callback();
  assert.equal(sample.calls(), 3, 'live original input admission still rejects recovery');
}

function makeDirectory(builder, source = read(directoryPath)) {
  const sdk = boundedSurfaceSdk();
  const methods = [builder, 'reconcileCatalog', 'currentContent', 'displaySnapshot', 'displayCatalogComplete'];
  const owner = createReaderBuilderProbe(source, methods, sdk.deps, sdk.hooks).owner;
  let calls = 0;
  let catalogState = 'failed';
  Object.assign(owner, { mounted: true, sessionKey: 'first-book', layoutPresentation: 3, tab: 'directory',
    shortContent: false, catalogComplete: false, catalogLoading: false, currentInputEnabled: () => true,
    displayedFacts: () => undefined, snapshot: { rows: builder === 'catalogStatus' ? [{}] : [], catalogState },
    onRequireCompleteCatalog: () => calls++ });
  const setState = state => {
    catalogState = state;
    owner.snapshot = { ...owner.snapshot, catalogState };
  };
  owner[builder](...(builder === 'flatCatalog' ? [false] : []));
  return { sdk, owner, calls: () => calls, setState };
}

function directoryRetention(source) {
  const sample = makeDirectory('catalogStatus', source);
  const first = actualAction(sample.sdk, sample.owner);
  first.callback();
  assert.equal(sample.calls(), 1, 'current original catalog recovery is usable');
  const receiver = first.child.onReconcile;
  sample.owner.layoutPresentation = 4;
  sample.owner.sessionKey = 'successor-book';
  resetDirectChild(sample.sdk, sample.owner, first.child);
  const next = actualAction(sample.sdk, sample.owner);
  assert.equal(next.child.onReconcile, receiver, 'catalog ordinary receiver stays unchanged');
  first.callback();
  assert.equal(sample.calls(), 1, 'old native catalog generation rejects successor presentation');
  next.callback();
  assert.equal(sample.calls(), 2, 'updated retained catalog action remains usable');
  sample.owner.catalogLoading = true;
  next.callback();
  assert.equal(sample.calls(), 2, 'live catalog loading blocks duplicate recovery');
}

function pageStateRetention(source) {
  const sample = makeDirectory('flatCatalog', source);
  const state = [...sample.owner.children.values()].find(child => child instanceof sample.sdk.deps.ReaderPageState);
  assert.ok(state, 'actual shared PageState is mounted by the real flatCatalog Builder');
  const first = actualAction(sample.sdk, sample.owner);
  first.callback();
  assert.equal(sample.calls(), 1);
  const stateReceiver = state.onAction;
  const recoveryReceiver = first.child.onReconcile;
  sample.owner.layoutPresentation = 5;
  sample.owner.sessionKey = 'successor-book';
  resetDirectChild(sample.sdk, sample.owner, state);
  const next = actualAction(sample.sdk, sample.owner);
  assert.equal(next.child, first.child, 'PageState retains its shared RecoveryAction across the new presentation');
  assert.equal(state.onAction, stateReceiver);
  assert.equal(next.child.onReconcile, recoveryReceiver);
  first.callback();
  assert.equal(sample.calls(), 1, 'old nested native state action rejects successor presentation');
  next.callback();
  assert.equal(sample.calls(), 2, 'new nested native state action reaches the current catalog through stable ordinary receivers');
  sample.setState('loading');
  resetDirectChild(sample.sdk, sample.owner, state);
  sample.owner.layoutPresentation = 6;
  sample.setState('failed');
  resetDirectChild(sample.sdk, sample.owner, state);
  const afterLoading = actualAction(sample.sdk, sample.owner);
  next.callback();
  assert.equal(sample.calls(), 2, 'loading-to-failed generation retires the former native action');
  afterLoading.callback();
  assert.equal(sample.calls(), 3, 'the retained PageState recovers after loading-to-failed');
}

function defaultPageStateCompatibility() {
  const sdk = boundedSurfaceSdk();
  let calls = 0;
  const state = sdk.consumer(read(pageStatePath), undefined, {}, { actionLabel: '重试', onAction: () => calls++ });
  state.initialRender();
  sdk.properties.flush();
  const first = actualAction(sdk, state);
  assert.equal(first.child.generation, 0);
  first.callback();
  assert.equal(calls, 1, 'default0 preserves existing no-argument callback callers');
  state.actionEnabled = false;
  sdk.properties.flush();
  first.callback();
  assert.equal(calls, 1);
  state.actionEnabled = true;
  sdk.properties.flush();
  first.callback();
  assert.equal(calls, 2, 'default0 current eligibility remains usable');

  const secondarySdk = boundedSurfaceSdk();
  const generations = [];
  const secondary = secondarySdk.consumer(read(pageStatePath), undefined, {}, {
    secondaryActionLabel: '继续', actionGeneration: 7, onSecondaryAction: expected => generations.push(expected),
  });
  secondary.initialRender();
  secondarySdk.properties.flush();
  const initialSecondary = actualAction(secondarySdk, secondary);
  initialSecondary.callback();
  assert.deepEqual(generations, [7], 'secondary action forwards the same optional generation');
  secondary.actionGeneration = 8;
  secondarySdk.properties.flush();
  initialSecondary.callback();
  assert.deepEqual(generations, [7], 'retired secondary native action cannot pass the new generation');
  actualAction(secondarySdk, secondary).callback();
  assert.deepEqual(generations, [7, 8], 'current secondary handler reaches the unchanged ordinary receiver');
}

function originalWiringNegatives() {
  const currentSearch = read(searchPath);
  const originalSearch = currentSearch
    .replace('            generation: this.displayedResultScope(),\n', '')
    .replace('onReconcile: (expected: number): void => this.performLoadMore(true, expected)',
      'onReconcile: this.loadMoreActionHandler(true)');
  assert.notEqual(originalSearch, currentSearch, 'original captured Search recovery wiring mutant applies');
  assert.throws(() => searchRetention(originalSearch), /updated retained recovery native handler operates the current query/);

  const currentDirectory = read(directoryPath);
  const originalCatalog = currentDirectory
    .replace('private catalogStatus() {', 'private catalogStatus(presentation: number = this.layoutPresentation, sessionKey: string = this.sessionKey) {')
    .replace('generation: this.layoutPresentation, actionEnabled:', 'actionEnabled:')
    .replace('onReconcile: (expected: number): void => this.reconcileCatalog(expected, this.sessionKey)',
      'onReconcile: (): void => this.reconcileCatalog(presentation, sessionKey)');
  assert.notEqual(originalCatalog, currentDirectory, 'original captured catalog recovery wiring mutant applies');
  assert.throws(() => directoryRetention(originalCatalog), /updated retained catalog action remains usable/);

  const originalPageState = currentDirectory
    .replace('private flatCatalog(allowPrefix: boolean = true, presentation: number = this.layoutPresentation ?? 0) {',
      'private flatCatalog(allowPrefix: boolean = true, presentation: number = this.layoutPresentation ?? 0, sessionKey: string = this.sessionKey) {')
    .replace('            actionGeneration: this.layoutPresentation,\n', '')
    .replace('onAction: (expected: number): void => this.reconcileCatalog(expected, this.sessionKey)',
      'onAction: (): void => this.reconcileCatalog(presentation, sessionKey)');
  assert.notEqual(originalPageState, currentDirectory, 'original captured PageState action wiring mutant applies');
  assert.throws(() => pageStateRetention(originalPageState), /new nested native state action reaches the current catalog/);

  const proxyFacts = currentSearch.replace('state: state,\n      resultScope:',
    'state: this.state,\n      resultScope:');
  assert.notEqual(proxyFacts, currentSearch, 'proxy fact-input regression mutant applies');
  assert.throws(() => makeSearch(proxyFacts), /facts factory captures the original raw publication/);
  const proxyScope = currentSearch.replace('this.searchPublication.resultScrollScopeFor(state) === scope',
    'this.searchPublication.resultScrollScopeFor(this.state) === scope');
  assert.notEqual(proxyScope, currentSearch, 'proxy scope-identity regression mutant applies');
  assert.throws(() => searchRetention(proxyScope), /current original query recovers/);
  const missingObservableRead = currentSearch.replace('const observed = this.state;', 'const observed = undefined;');
  assert.notEqual(missingObservableRead, currentSearch, 'observable display read regression mutant applies');
  assert.throws(() => makeSearch(missingObservableRead), /real Builder still observes its State/);
}

function resultScopeMetadata() {
  const publication = new publicationModule.ReaderContentSearchPublication();
  const state = { kind: 'results', keyword: '原对象', results: [], hasMore: true, loadMoreError: 'retry' };
  publication.publish(state);
  const first = { module: 'search', search: searchFactsModule.readerControlSearchMinimumFacts({ query: '', state,
    resultScope: publication.resultScrollScopeFor(state), retainedLoadMoreFailure: true }) };
  publication.cancel();
  publication.publish(state);
  const next = { module: 'search', search: searchFactsModule.readerControlSearchMinimumFacts({ query: '', state,
    resultScope: publication.resultScrollScopeFor(state), retainedLoadMoreFailure: true }) };
  assert.equal(first.search.readViewState(), next.search.readViewState());
  assert.notEqual(first.search.resultScope, next.search.resultScope, 'the original Publication may reuse raw state with a different operation scope');
  assert.equal(preparedChecks.readerControlModuleFactsGeometryKey(first), preparedChecks.readerControlModuleFactsGeometryKey(next),
    'operation metadata stays outside the geometry signature');
  assert.equal(preparedChecks.readerControlModuleFactsDisplayEqual(first, next), false,
    'explicit display equality admits a real scope change even when raw reference is reused');
}

function bookmarkStateReceivers(source = read(directoryPath)) {
  const create = failed => {
    const sdk = boundedSurfaceSdk();
    const errorSource = read('entry/src/main/ets/features/reading/ui/ReaderBookmarkErrorState.ets');
    const emptySource = read('entry/src/main/ets/features/reading/ui/ReaderBookmarkEmptyState.ets');
    const ErrorState = createReaderBuilderProbe(errorSource, boundedMembers(errorSource), sdk.deps, sdk.hooks).Component;
    const EmptyState = createReaderBuilderProbe(emptySource, boundedMembers(emptySource), sdk.deps, sdk.hooks).Component;
    class OutsideBookmarkStateScope {
      constructor() { throw new Error('The selected bookmark error/empty scenario must not mount a loading or tree branch'); }
    }
    const hooks = { ...sdk.hooks, childSources: { ...sdk.childSources,
      ReaderBookmarkErrorState: errorSource, ReaderBookmarkEmptyState: emptySource,
      ReaderBookmarkLoadingState: read('entry/src/main/ets/features/reading/ui/ReaderBookmarkLoadingState.ets'),
      ReaderDirectoryNavigationSurface: read('entry/src/main/ets/features/reading/ui/ReaderDirectoryNavigationSurface.ets') } };
    const owner = createReaderBuilderProbe(source, ['listBody', 'currentInputEnabled',
      'retryCurrentBookmarks', 'returnFromEmptyBookmarks'], {
      ...sdk.deps, ReaderBookmarkErrorState: ErrorState, ReaderBookmarkEmptyState: EmptyState,
      ReaderBookmarkLoadingState: OutsideBookmarkStateScope, ReaderDirectoryNavigationSurface: OutsideBookmarkStateScope,
    }, hooks).owner;
    let scopeCurrent = true;
    let calls = 0;
    Object.assign(owner, { mounted: true, tab: 'bookmarks', shortContent: false, bookmarkLoadFailed: failed,
      snapshot: { rows: [], loading: failed }, interactionEnabled: true, preparedMinimumRequired: true,
      inputCurrent: () => true, presentationPrepared: () => ({ ownerCurrent: () => scopeCurrent }),
      displayBookmarkFailed: () => owner.bookmarkLoadFailed, displayBookmarkMessage: () => '读取失败',
      displaySnapshot: () => owner.snapshot, onRetryBookmarkLoad: () => { calls++; owner.bookmarkLoadFailed = false; },
      onTabChange: tab => { assert.equal(tab, 'directory'); calls++; } });
    owner.listBody(false);
    return { sdk, owner, calls: () => calls, retireScope: () => { scopeCurrent = false; },
      restoreScope: () => { scopeCurrent = true; } };
  };
  for (const failed of [true, false]) {
    const original = create(failed);
    const action = actualAction(original.sdk, original.owner);
    action.callback();
    assert.equal(original.calls(), 1, 'current bookmark state action remains usable');
    if (failed) {
      assert.equal(original.owner.snapshot.loading, true, 'catalog-empty loading coexists with the failure-priority error UI');
      action.callback();
      assert.equal(original.calls(), 1, 'retry no longer marked failed rejects a repeated native callback');
      original.owner.bookmarkLoadFailed = true;
    } else {
      original.owner.snapshot.loading = true;
      action.callback();
      assert.equal(original.calls(), 1, 'raw loading rejects a retained bookmark state action');
    }
    original.owner.snapshot.loading = false;
    original.owner.bookmarkLoadFailed = !failed;
    action.callback();
    assert.equal(original.calls(), 1, 'raw failure/empty condition rejects the former state action');
    original.owner.bookmarkLoadFailed = failed;
    original.owner.tab = 'directory';
    action.callback();
    assert.equal(original.calls(), 1, 'the state action cannot operate in a successor tab');
    original.owner.tab = 'bookmarks';
    if (!failed) {
      original.owner.snapshot.rows = [{}];
      action.callback();
      assert.equal(original.calls(), 1, 'a retained empty action rejects nonempty raw rows');
      original.owner.snapshot.rows = [];
    }
    original.retireScope();
    action.callback();
    assert.equal(original.calls(), 1, 'retired prepared owner cannot qualify a retained bookmark action');
    original.restoreScope();
    original.owner.mounted = false;
    const successor = create(failed);
    actualAction(successor.sdk, successor.owner).callback();
    action.callback();
    assert.equal(original.calls(), 1, 'old parent cannot dispatch after retirement');
    assert.equal(successor.calls(), 1, 'old callback cannot add an operation to the active successor parent');
  }
}

function bookmarkReceiverNegatives() {
  const current = read(directoryPath);
  const directRetry = current.replace('onRetry: (): void => this.retryCurrentBookmarks()',
    'onRetry: (): void => this.onRetryBookmarkLoad()');
  assert.notEqual(directRetry, current);
  assert.throws(() => bookmarkStateReceivers(directRetry), /retry no longer marked failed rejects a repeated native callback/);
  const directEmpty = current.replace('onReturnToDirectory: (): void => this.returnFromEmptyBookmarks()',
    "onReturnToDirectory: (): void => this.onTabChange('directory')");
  assert.notEqual(directEmpty, current);
  assert.throws(() => bookmarkStateReceivers(directEmpty), /raw loading rejects a retained bookmark state action/);
}

for (const id of selectContractCases(definitions)) {
  searchRetention();
  formalReadonlyWindow();
  resultScopeMetadata();
  bookmarkStateReceivers();
  bookmarkReceiverNegatives();
  directoryRetention();
  pageStateRetention();
  defaultPageStateCompatibility();
  originalWiringNegatives();
  console.log('PASS retained actual RecoveryAction/Search/Directory/PageState generation refresh, real State proxy/raw Publication facts and Watch flow, unchanged ordinary callbacks, default0/secondary compatibility,3 original-wiring lock mutants and3 proxy/dependency mutants');
  recordContractCasePass(id);
}
