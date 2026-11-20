import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

const selected=selectContractCases({'presentation-owner':{description:'Actual search page and surface owner admission before stale draft/reset/suspend mutations',resources:[]}});
for(const id of selected){
// Search page ownership before local draft/reset mutations; no build or device.
const { default: assert } = await import('node:assert/strict');
const { readFileSync } = await import('node:fs');
const { selectedProductionMethods } = await import('./lib/selected-production-methods.mjs');
const { pureModuleProbe } = await import('./lib/ets-pure-module-probe.mjs');
const sourceGroups = await import('../entry/src/main/ets/features/search/SearchSourceGroups.ts');
const stateUrl = new URL('../entry/src/main/ets/features/search/SearchViewState.ts', import.meta.url);
const { SearchViewState } = pureModuleProbe(readFileSync(stateUrl,'utf8'),'SearchViewState.ts',sourceGroups,['SearchViewState']);
const Page = selectedProductionMethods(new URL('../entry/src/main/ets/features/search/SearchPage.ets',import.meta.url),'SearchPage',
 ['ownsPageQuery','ownsSurface','submitFromSurface','bindSurface','submitSearch'],{nextSearchSurfaceOwner:0,ALL_SEARCH_SOURCE_GROUP:sourceGroups.ALL_SEARCH_SOURCE_GROUP});

function fixture() {
  let current = true;
  const events = [];
  const viewState = new SearchViewState();
  viewState.pageRevision = 2; viewState.revision = 4; viewState.keywordDraft = 'original';
  const model = { owner: 0, interactive: false, claim(id) { this.owner = id; },
    owns(id) { return this.owner === id; }, activate(id) { if (this.owns(id)) this.interactive = true; },
    suspend() { this.interactive = false; } };
  const page = Object.assign(new Page(), { pageMounted: true, pageEpoch: 2, queryAtMount: 4,
    isPresentationCurrent: () => current, viewState, surfaceModel: model, surfaceOwner: 0,
    keyword: 'new', presentation: { kind: 'initial' },
    canSubmit: () => true, isSweeping: () => false, scopeSourceIds: () => undefined,
    publishSurface() {}, onSearch: keyword => events.push(keyword), onBack() {}, onStop() {},
    onClearHistory() {}, onRetryHistory() {}, toggleSearchFilters() {}, selectGroup() {}, selectContentType() {} });
  page.bindSurface();
  return { page, model, viewState, events, retire: () => { current = false; } };
}

const stale = fixture();
stale.retire();
stale.model.onText('stale');
stale.model.onSubmit();
stale.model.onHistory('old-history');
assert.equal(stale.viewState.revision, 4);
assert.equal(stale.viewState.keywordDraft, 'original');
assert.equal(stale.page.keyword, 'new');
assert.equal(stale.model.interactive, true, 'stale submit must not suspend the current model');
assert.deepEqual(stale.events, []);

const active = fixture();
active.model.onText('new query');
assert.equal(active.viewState.keywordDraft, 'new query');
active.model.onSubmit();
assert.equal(active.viewState.revision, 5);
assert.equal(active.viewState.keywordDraft, 'new query');
assert.deepEqual(active.events, ['new query']);
assert.equal(active.model.interactive, false);
console.log('PASS library search page presentation owner');

recordContractCasePass(id);
}
