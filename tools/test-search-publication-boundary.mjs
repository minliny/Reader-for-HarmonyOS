import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire, stripTypeScriptTypes } from 'node:module';
import { createHash } from 'node:crypto';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { createArkUIPropertyRuntimeProbe } from './lib/arkui-property-runtime-probe.mjs';

const prefix = new URL('../entry/src/main/ets/', import.meta.url);
const read = name => readFileSync(new URL(name, prefix), 'utf8');
const clean = text => text.replace(/^import[\s\S]*?;\n/gm, '');
const evaluate = async text => import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(text)).toString('base64')}`);
const require = createRequire(import.meta.url);
const sdkRoot = process.env.READER_ETS_LOADER_ROOT ??
  '/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const ts = require(`${sdkRoot}/node_modules/typescript`);
const compilerOptions = require(`${sdkRoot}/lib/ets_checker.js`).compilerOptions;
const syntax = require(`${sdkRoot}/lib/validate_ui_syntax.js`);
const parse = source => ts.createSourceFile('/tmp/SearchPublicationBoundary.ets', source,
  ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, compilerOptions);
const pageSource = read('features/search/SearchPage.ets'), indexSource = read('pages/Index.ets');
const pageTree = parse(pageSource), indexTree = parse(indexSource);
const pageStruct = pageTree.statements.find(node => node.name?.getText(pageTree) === 'SearchPage');
const indexStruct = indexTree.statements.find(node => node.name?.getText(indexTree) === 'Index');
assert.ok(pageStruct && indexStruct);
const member = (struct, tree, name) => {
  const value = struct.members.find(node => node.name?.getText(tree) === name);
  assert.ok(value, `production member ${name}`); return value.getText(tree);
};
const runtime = createArkUIPropertyRuntimeProbe();
const nativeRequests = [];
globalThis.ReaderRuntimeOwner = { current: () => ({ request: async method => {
  nativeRequests.push(method); assert.fail(`This boundary test must not request Core/network: ${method}`);
} }) };
globalThis.hilog = { warn() {}, error() {}, info() {}, debug() {} };
const { SearchOrchestrator, SearchQueryRun } = await evaluate([
  'features/source/ReaderSourceCategory.ts', 'app/ErrorMessage.ts', 'features/search/SearchBookProjection.ts',
  'features/search/SearchGateway.ts', 'features/search/SearchOrchestrator.ets',
].map(name => clean(read(name))).join('\n') + '\nexport { SearchQueryRun };');
const { SearchPublication, SearchViewState, SearchResultProjection } = await evaluate([
  'features/search/SearchPublication.ts', 'features/search/SearchViewState.ts',
  'features/search/SearchResultRelevance.ts', 'features/common/BookAcquisitionPresentation.ts',
  'features/search/SearchCandidatePolicy.ts', 'features/search/SearchResultProjection.ts',
].map(name => clean(read(name))).join('\n'));
const classes = pageSource.slice(pageSource.indexOf('@Observed\nclass SearchBookGroup'),
  pageSource.indexOf('/**\n * Figma-backed Book Search')).replace('@Observed\n', '');
const { SearchBookGroup, SearchResultDataSource } = await evaluate(`
const DataOperationType = { ADD:'add', DELETE:'delete', CHANGE:'change', RELOAD:'reload', MOVE:'move' };
${classes}\nexport { SearchBookGroup, SearchResultDataSource };`);
let constructedGroups = 0;
class CountedGroup extends SearchBookGroup {
  constructor(...args) { super(...args); constructedGroups++; }
}
const nativeStub = name => new Proxy({ name }, { get: (_, key) => key === 'name' ? name : () => {} });
syntax.componentCollection.customComponents.add('SearchResultCard');
const childMembers = ['publicationRevision', 'publication', 'presentation', 'shelfBooks', 'viewState',
  'selectedGroupName', 'visibleGroups', 'acceptedVisibleGroups', 'resultDataSource', 'groupedCategory', 'groupedResultsCache',
  'resultProjection', 'projectedGroups', 'projectedGroupKeys', 'projectedGroupIndexes', 'changedGroupKeys',
  'warmupGroups', 'visibleStart', 'visibleEnd', 'viewStateRevision', 'listEpoch', 'restoreEpoch',
  'groupResults', 'acceptPublication', 'refreshVisibleResults', 'publishVisibleGroups', 'resultsContent'];
const childProbe = createReaderBuilderProbe(pageSource, childMembers, {
  ...runtime.sdk, SearchPublication, SearchViewState, SearchResultProjection,
  SearchBookGroup: CountedGroup, SearchResultDataSource, List: nativeStub('List'), LazyForEach: nativeStub('LazyForEach'),
  SearchResultCard: class {},
}, runtime.hooks);
// The parent call is extracted as an actual ArkUI AST expression; argument names
// and lambdas are never reconstructed in the fixture.
let searchEntry;
function visit(node) {
  if (node.expression?.getText?.(indexTree) === 'SearchPage' && node.arguments?.length) searchEntry = node.getText(indexTree);
  ts.forEachChild(node, visit);
}
visit(indexTree); assert.ok(searchEntry, 'actual Index SearchPage call');
const propNames = pageStruct.members.filter(node => node.getText(pageTree).includes('@Prop'))
  .map(node => node.name?.getText(pageTree)).filter(Boolean);
syntax.componentCollection.customComponents.add('SearchPage');
syntax.propCollection.set('SearchPage', new Set(propNames));
let initialParams;
class ActualSearchPage extends childProbe.Component {
  constructor(...args) { initialParams = args[1]; super(...args); }
}
const indexMembers = ['searchPresentation', 'searchPublication', 'searchPublicationRevision',
  'searchOrchestrator', 'getSearchOrchestrator', 'applyBookshelfState', 'copyShelfBookWithSourceName'];
const parentSource = `@Component struct Index {\n${indexMembers.map(name => member(indexStruct, indexTree, name)).join('\n')}
build() { ${searchEntry}; }\n}`;
const { owner: host, output: parentOutput } = createReaderBuilderProbe(parentSource,
  [...indexMembers, 'build'], { ...runtime.sdk, SearchPage: ActualSearchPage, SearchPublication,
    SearchOrchestrator, deviceInfo: { deviceType: 'phone' } }, runtime.hooks);
Object.assign(host, { searchViewState: new SearchViewState(), settingsSnapshot: { reduceMotion: false },
  route: 'search', searchAppForeground: true, shelfBooks: [], bookshelfLoadGeneration: 1,
  hydrateShelfSourceNames() {}, scheduleBookshelfBackgroundRefresh() {}, sourceDisplayName: () => '源甲' });
host.initialRender();
const page = [...host.children.values()][0];
assert.ok(page instanceof childProbe.Component, 'actual compiled child constructor ran');
Object.assign(page, { appThemeScheme: 'day', contentFrame: () => ({ width: 390 }), isTablet: false,
  onVisibleGroups() {}, listMounted: false, pageMounted: true, scrollRestored: true,
  resultScroller: {}, userInteracting: false, userScrolling: false });
page.acceptPublication();
assert.equal(page.publication, host.searchPublication);
assert.ok(!('presentation' in initialParams) && !('shelfBooks' in initialParams) && !('sources' in initialParams),
  'initial component arguments carry no full DTO/list payload');
assert.equal(initialParams.publicationRevision, 0);
const orchestrator = host.getSearchOrchestrator(); orchestrator.sessionOpen = true;
function startRun(keyword, count, suffix) {
  const run = new SearchQueryRun(keyword, `request-${suffix}`);
  run.sources = ['source-a', 'empty-a', 'empty-b'].map(sourceId => ({ sourceId, name: sourceId, enabled: true }));
  run.localStatus = 'done'; run.completed.add('source-a');
  const books = Array.from({ length: count }, (_, index) => ({ sourceId: 'source-a', bookId: `${suffix}-${index}`,
    sourceName: '源甲', bookSourceUrl: 'source-a', detailUrl: `${suffix}-${index}`, category: 'novel',
    title: `${keyword}${index}`, author: '作者', groupKey: `${suffix}-group-${index}`,
    searchRequestId: run.requestId, sourceRuleVersion: 'v1', variables: [],
    acquisition: { schemaVersion: 2, sourceVersion: 'v1' } }));
  run.sourceResults.set('source-a', run.admit(books)); orchestrator.run = run;
  orchestrator.publishRun(run); runtime.flush(); return run;
}
const first = startRun('当前查询', 1000, 'first');
assert.equal(page.visibleGroups.length, 1000);
assert.equal(runtime.sdk.ObservedObject.GetRawObject(page.presentation), orchestrator.presentation);
assert.equal(page.presentation.results, orchestrator.presentation.results);
page.resultsContent();
const texts = () => [...page.nodes.values()].filter(node => node.type === 'Text');
const status = texts().find(node => String(node.create).includes('正在搜索 1/3'));
assert.ok(status, 'production progress Text was actually emitted');
const statusDependencies = runtime.dependencies.get(page).get('presentation');
assert.ok(statusDependencies.has(status.id), 'actual accepted State.get registers the status observer dependency');
const retained = page.presentation.results, retainedGroups = page.visibleGroups;
let listReplacements = 0, listOperations = 0;
const replace = page.resultDataSource.replace;
page.resultDataSource.replace = function(...args) { listReplacements++; return replace.apply(this, args); };
page.resultDataSource.registerDataChangeListener({ onDatasetChange: operations => { listOperations += operations.length; } });
constructedGroups = 0; const copiesBefore = runtime.copies.length, updatesBefore = runtime.updates.length;
first.sourceResults.set('empty-a', first.admit([])); first.completed.add('empty-a');
orchestrator.publishRun(first); runtime.flush();
assert.equal(runtime.sdk.ObservedObject.GetRawObject(page.presentation), host.searchPresentation);
assert.equal(page.presentation.results, retained);
assert.ok(page.presentation.results.every((book, index) => book === retained[index]));
assert.ok(page.visibleGroups === retainedGroups, 'progress retains the existing State proxy and visible rows');
assert.equal(constructedGroups, 0); assert.equal(page.changedGroupKeys.size, 0);
assert.deepEqual([listReplacements, listOperations], [0, 0], 'progress does not notify the native data source');
assert.equal(status.create, ' · 正在搜索 2/3 个书源,已返回 1000 个',
  'only subscribed observers rerun; there is no unconditional page.replay in this test');
const progressCopies = runtime.copies.slice(copiesBefore);
assert.ok(progressCopies.length > 0 && progressCopies.every(copy => !copy.object), 'SDK boundary copies scalars only');
const progressUpdates = runtime.updates.slice(updatesBefore);
assert.equal(progressUpdates.length, 1);
assert.deepEqual(Object.keys(progressUpdates[0].params).sort(), ['isTablet', 'publicationRevision', 'reduceMotion']);
assert.equal(progressUpdates[0].params.publicationRevision, host.searchPublicationRevision);

const beforeShelf = page.presentation;
host.applyBookshelfState({ kind: 'populated', shelf: { books: [retained[0]] } }); runtime.flush();
assert.equal(runtime.sdk.ObservedObject.GetRawObject(page.presentation), runtime.sdk.ObservedObject.GetRawObject(beforeShelf),
  'shelf notification retains the raw query payload; State may renew its shallow proxy');
assert.equal(runtime.sdk.ObservedObject.GetRawObject(page.shelfBooks), host.shelfBooks);
assert.ok(page.visibleGroups.find(group => group.book.bookId === retained[0].bookId).inBookshelf);
assert.equal(page.changedGroupKeys.size, 1);
host.applyBookshelfState({ kind: 'empty', shelf: { books: [] } }); runtime.flush();
assert.ok(page.visibleGroups.every(group => !group.inBookshelf));

// Preserve the pre-fix counterexample using the same SDK recursive copy and
// production grouping, not an invented copy/diff algorithm.
const originalKeys = Object.keys; let copiedObjects = 0, copiedSlots = 0, copied;
Object.keys = value => { const keys = originalKeys(value); copiedObjects++; copiedSlots += keys.length; return keys; };
try { copied = runtime.deepCopy(page.presentation); } finally { Object.keys = originalKeys; }
assert.notEqual(copied.results, page.presentation.results);
assert.ok(copiedObjects >= 3000); constructedGroups = 0;
host.searchPublication.publish(copied); host.searchPublicationRevision += 1; runtime.flush();
const legacyNewGroups = constructedGroups;
assert.equal(legacyNewGroups, 1000); assert.equal(page.changedGroupKeys.size, 1000);

host.searchViewState.reset('下一查询');
const second = startRun('下一查询', 2, 'second');
assert.equal(page.presentation.keyword, '下一查询');
assert.equal(page.visibleGroups.length, 2);
assert.ok(page.visibleGroups.every(group => group.book.bookId.startsWith('second-')));
// A real compiled child re-created with current parent arguments reads the
// stable owner, not a payload captured by the old component constructor.
const remounted = new childProbe.Component(host, { ...initialParams,
  publicationRevision: host.searchPublicationRevision, publication: host.searchPublication, viewState: host.searchViewState });
Object.assign(remounted, { onVisibleGroups() {}, listMounted: false, pageMounted: true });
remounted.acceptPublication();
assert.equal(runtime.sdk.ObservedObject.GetRawObject(remounted.presentation), orchestrator.presentation);
assert.equal(runtime.sdk.ObservedObject.GetRawObject(remounted.shelfBooks), host.shelfBooks);
assert.equal(remounted.presentation.results.length, 2);
assert.ok(remounted.presentation.results.every(book => book.searchRequestId === second.requestId));
assert.deepEqual(nativeRequests, []);
const report = {
  scope: runtime.source,
  sourceSha256: Object.fromEntries(['features/search/SearchPublication.ts', 'features/search/SearchPage.ets',
    'features/search/SearchOrchestrator.ets', 'pages/Index.ets'].map(name => [name, createHash('sha256').update(read(name)).digest('hex')])),
  queryBooks: 1000, progressOnly: { retainedBookReferences: 1000, newGroups: 0, changedGroups: 0,
    parentUpdates: progressUpdates.length, copiedObjectProps: progressCopies.filter(copy => copy.object).length,
    listReplacements: 0, listOperations: 0,
    status: ' · 正在搜索 2/3 个书源,已返回 1000 个', acceptedStateReadDependencyTracked: true },
  compiledParentSha256: createHash('sha256').update(parentOutput).digest('hex'),
  compiledChildSha256: createHash('sha256').update(childProbe.output).digest('hex'),
  legacyCounterexample: { copiedObjects, copiedSlots, newGroups: legacyNewGroups },
  shelfPublication: 'add/remove reflected through scalar', newQueryAndRemount: 'current exact payload',
  nativeFrameStability: 'NOT MEASURED',
};
if (process.argv.includes('--record')) writeFileSync(process.argv[process.argv.indexOf('--record') + 1], JSON.stringify(report, null, 2) + '\n');
console.log('PASS PH77/79 actual SDK Index→SearchPage scalar reset→Watch→grouping→tracked status Text: 1000 refs, 0 new/change groups, 0 copied DTO Props');
console.log(`PASS legacy SDK deep-copy counterexample: ${copiedObjects} objects/${copiedSlots} slots, ${legacyNewGroups} new groups`);
console.log('PASS actual shelf callback, fresh query and compiled remount retain current payload; native frames are not measured');
