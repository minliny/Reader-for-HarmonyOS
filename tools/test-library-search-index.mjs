// Explicit Index method and callback probe; no nested suites, build or device.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

const selected = selectContractCases({ 'index-owner-callbacks': { description: 'Actual SDK Index composition and captured callback identity/transition lifecycle with explicit class-only UI and fake Host/model ports', resources: [] } });
for (const id of selected) {
const { createReaderComponentProbe } = await import('./lib/reader-component-probe.mjs');
const { createArkUIPropertyRuntimeProbe } = await import('./lib/arkui-property-runtime-probe.mjs');
const names = ['isCurrentSearchPresentation', 'isCurrentBookshelfPresentation', 'librarySearchSurface', 'searchPageSurface',
  'openSearch', 'performSearch', 'backLibrarySearch', 'editLibrarySearch', 'settleLibrarySearch', 'returnToSearch'];
let props, searchProps, acquisitions;
class SurfacePort { constructor(owner, params, _storage, id) { Object.assign(this, { owner, params, id }); props = params; } }
class SearchPagePort { constructor(owner, params, _storage, id) { Object.assign(this, { owner, params, id }); searchProps = params; } }
const ReaderRuntimeOwner = { current: () => ({ bookAcquisitions: () => acquisitions }) };
const properties = createArkUIPropertyRuntimeProbe();
const { Component: Index } = createReaderComponentProbe(readFileSync(new URL('../entry/src/main/ets/pages/Index.ets', import.meta.url), 'utf8'), names,
  { ...properties.sdk, ReaderLibrarySearchSurface: SurfacePort, SearchPage: SearchPagePort, ReaderRuntimeOwner, LOCAL_SOURCE_ID: 'local' },
  { ...properties.hooks, childSources: { ReaderLibrarySearchSurface: readFileSync(new URL('../entry/src/main/ets/features/search/ReaderLibrarySearchSurface.ets', import.meta.url), 'utf8'), SearchPage: readFileSync(new URL('../entry/src/main/ets/features/search/SearchPage.ets', import.meta.url), 'utf8') } });
function fixture(route = 'search') {
  const calls = [];
  const owner = { setDownloadReadingProtection() {} };
  const host = { prepareEntry: () => calls.push('prepare'), open: () => calls.push('open'),
    search: keyword => calls.push(`search:${keyword}`), resume: () => calls.push('resume'),
    stop: () => calls.push('stop'), refreshHistory: () => calls.push('history') };
  acquisitions = { endSearch: () => calls.push('end') };
  const value = Object.assign(new Index(), {
    route, mountedRuntimeOwner: owner, navigationGeneration: 8, detailShelfAdmissionMount: 4,
    searchHost: host, shelfReceiptRetired: false, librarySearchIdentity: 5,
    librarySearchMode: route === 'search' ? 'results' : 'idle',
    librarySearchModel: { suspend() {}, currentOwner: () => 17, owns: owner => owner === 17, filtersExpanded: false, dispatchToggleFilters: () => calls.push('filters') },
    settingsSnapshot: { reduceMotion: false }, shelfMoreIdentity: 'more-1',
    shelfMoreGeneration: 8, shelfMoreHandler: () => calls.push('more'),
    isCurrentRuntime: candidate => candidate === owner, expandedLayout: () => false,
    nextNavigationGeneration() { this.navigationGeneration++; }, resetSearchDetailWarmups() {},
    refreshSearchShelfMembership() {}, refreshSourceCatalog: () => calls.push('sources'), searchPageContent() {}, installRemoteReadingSession() {},
    returnToBookshelf() { calls.push('bookshelf'); this.route = 'bookshelf'; },
  });
  const bind = () => {
    value.librarySearchSurface(owner, host);
    const children = [...value.children.values()].filter(child => child instanceof SurfacePort);
    assert.equal(children.length, 1, 'the actual lowered Index constructs one class component');
    assert.equal(children[0].params, props);
    return props;
  };
  return { value, host, owner, calls, bind };
}

const pathRun = fixture();
const old = pathRun.bind();
assert.equal(old.queryOwner, undefined, 'surface reads the live model owner instead of a stale prop');
old.onBack(5, 8, 4);
assert.equal(pathRun.value.librarySearchMode, 'idle', 'results back restores the shelf in one leg');
assert.equal(pathRun.value.route, 'search', 'shelf route waits for the reverse');
assert.deepEqual(pathRun.calls, [], 'back does not end or restart the query before settle');
old.onSettled('idle', 4, 8, 4);
assert.deepEqual(pathRun.calls, [], 'stale identity cannot settle');
old.onSettled('idle', 5, 8, 4);
assert.deepEqual(pathRun.calls, ['bookshelf']);
assert.equal(pathRun.value.route, 'bookshelf');

const filters = fixture();
filters.value.librarySearchModel.filtersExpanded = true;
filters.bind().onBack(5, 8, 4);
assert.equal(filters.value.librarySearchMode, 'results');
assert.equal(filters.value.route, 'search');
assert.deepEqual(filters.calls, ['filters'], 'Back first closes the current filter projection without leaving or resetting the query');

const edit = fixture();
const editProps = edit.bind();
editProps.onInputRequested(5, 8, 4);
assert.equal(edit.value.librarySearchMode, 'input', 'field tap hands results back to input');
assert.deepEqual(edit.calls, ['stop', 'history'], 'editing stops the live sweep without resetting the query');
editProps.onSettled('input', 5, 8, 4);
assert.deepEqual(edit.calls, ['stop', 'history'], 'editing keeps the live query and navigation generation');
assert.equal(edit.value.navigationGeneration, 8);
editProps.onBack(5, 8, 4);
assert.equal(edit.value.librarySearchMode, 'idle');
editProps.onSettled('idle', 5, 8, 4);
assert.deepEqual(edit.calls, ['stop', 'history', 'bookshelf']);

for (const change of [
  v => v.librarySearchIdentity++, v => v.navigationGeneration++, v => v.detailShelfAdmissionMount++,
  v => { v.mountedRuntimeOwner = {}; }, v => { v.searchHost = {}; },
  v => { v.shelfReceiptRetired = true; }, v => { v.route = 'detail'; },
]) {
  const item = fixture();
  const captured = item.bind();
  change(item.value);
  captured.onBack(5, 8, 4);
  captured.onInputRequested(5, 8, 4);
  captured.onHeaderBottom(200, 5, 1, 8, 4);
  captured.onSettled('results', 5, 8, 4);
  assert.equal(item.value.librarySearchMode, 'results', 'old callback cannot change mode');
  assert.equal(item.value.librarySearchHeaderBottom, undefined, 'old measurement cannot publish');
  assert.deepEqual(item.calls, [], 'old callback cannot act');
}

const shelf = fixture('bookshelf');
const shelfProps = shelf.bind();
shelfProps.onMore(5, 8, 4, 'more-1');
assert.deepEqual(shelf.calls, ['more']);
shelf.value.shelfMoreIdentity = 'new-more';
shelfProps.onMore(5, 8, 4, 'more-1');
assert.deepEqual(shelf.calls, ['more'], 'old more identity cannot open a successor');
shelf.value.librarySearchIdentity++;
shelfProps.onOpen(5, 8, 4);
assert.equal(shelf.value.route, 'bookshelf', 'old open identity is inert');

const open = fixture('bookshelf');
open.bind().onOpen(5, 8, 4);
assert.equal(open.value.route, 'search');
assert.equal(open.value.librarySearchMode, 'input');
assert.equal(open.value.librarySearchIdentity, 6);
assert.equal(open.value.navigationGeneration, 9);
assert.deepEqual(open.calls, ['prepare', 'sources', 'open'], 'current entry refreshes its source catalog and opens once');

const noRebind = fixture();
const stableCallbacks = noRebind.bind();
noRebind.value.librarySearchIdentity = 6;
noRebind.value.navigationGeneration = 9;
noRebind.value.detailShelfAdmissionMount = 5;
stableCallbacks.onBack(5, 8, 4);
assert.equal(noRebind.value.librarySearchMode, 'results', 'old event arguments cannot act');
stableCallbacks.onBack(6, 9, 5);
assert.equal(noRebind.value.librarySearchMode, 'idle', 'retained callback accepts new event identity without rebinding');

const pageGuard = fixture();
pageGuard.value.searchPageSurface(8, pageGuard.owner, 4, pageGuard.host);
assert.equal(searchProps.isPresentationCurrent(), true);
pageGuard.value.navigationGeneration++;
assert.equal(searchProps.isPresentationCurrent(), false, 'old page cannot mutate query after navigation');

const resume = fixture('detail');
resume.value.librarySearchMode = 'results';
resume.value.detailBook = undefined;
resume.value.returnToSearch();
assert.equal(resume.value.route, 'search');
assert.equal(resume.value.librarySearchMode, 'results');
assert.equal(resume.value.librarySearchAnimateOnAppear, false);
assert.deepEqual(resume.calls, ['resume'], 'detail return resumes without resetting query');
console.log('PASS actual SDK Index class construction and current callback/transition methods; leaf UI/query/Core/native/device NOT_RUN');
recordContractCasePass(id);
}

