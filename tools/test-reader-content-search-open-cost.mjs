import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions={
 'entry-zero-core':{description:'Actual LRE entry and typing issue no Core request; publication matrix owned separately',resources:[]},
 'render-budget':{description:'Actual SDK full DataSource and explicitly requested rows operation count budget',resources:[]},
 'historical-benchmark':{description:'Explicit archived Builder/copy diagnostic; no release wall-clock threshold',resources:[]}
};
const selected=selectContractCases(definitions);
async function runCase(selectedCase){
const { installContentSearchOwnerProbe }=await import('./lib/reader-content-search-owner-probe.mjs');
const {default:assert}=await import('node:assert/strict');
const { createHash }=await import('node:crypto');
const { readFileSync }=await import('node:fs');
const { performance }=await import('node:perf_hooks');
const { stripTypeScriptTypes }=await import('node:module');
const { createReaderBuilderProbe }=await import('./lib/reader-control-builder-probe.mjs');
const { createArkUIPropertyRuntimeProbe }=await import('./lib/arkui-property-runtime-probe.mjs');
const { productionMotionMethods }=await import('./lib/reader-motion-method-probe.mjs');
const geometry=await import('../entry/src/main/ets/features/reading/ReaderControlSearchGeometry.ts');
const scroll=await import('../entry/src/main/ets/features/reading/ReaderControlSearchScroll.ts');
const motion=await import('../entry/src/main/ets/features/reading/ReaderControlMotionPresentation.ts');
const { splitReaderSearchSnippet }=await import('../entry/src/main/ets/features/reading/ReaderSearchHighlight.ts');
// This exact platform module contains only type imports; execute its real body.
const { ReaderContentSearchPublication } = await import('data:text/javascript,' + encodeURIComponent(stripTypeScriptTypes(
  readFileSync(new URL('../entry/src/main/ets/features/reading/ReaderContentSearchPublication.ets', import.meta.url), 'utf8'))));
const { searchListDependencies, searchListMethods, searchListRowMembers, searchListLazyRequests }=await import('./lib/reader-content-search-list-probe.mjs');

const file=new URL('../entry/src/main/ets/features/reading/ReaderControlSearchContent.ets',import.meta.url);
const baseline=selectedCase==='historical-benchmark';
const source=readFileSync(baseline?new URL('../evidence/2026-09-14-physical-review/search-flow-implementation/ph90-search-content-before.ets',import.meta.url):file,'utf8');
const legacyMembers=['resultsBody','loadMoreAction','resultRow','resultSnippet','resultTitle','currentResult','currentSnippet',
  'selectCurrentResult','statusText','presentation','resultClip','resultScrollFrame','resultLayout','resultRowsHeight','frame'];
const dependencies={...geometry,...scroll,...motion,splitReaderSearchSnippet,
  PathShape:class{commands(value){this.value=value;return this;}}};
const property=createArkUIPropertyRuntimeProbe();
const rows=count=>Array.from({length:count},(_,chapterIndex)=>({sourceId:'s',bookId:'b',chapterIndex,chapterOffset:2,
  chapterTitle:`第${chapterIndex}章`,snippet:'甲乙关键词之后正文',snippetStart:0,matchLength:3}));
// These are explicitly supplied native requests, not a Reader viewport/window
// algorithm. Ace's actual selected range and same-frame paint require VM proof.
const requestedIndices=count=>Array.from({length:Math.min(count,8)},(_,i)=>i);
function createOwner(state,indices){
  const lazy=searchListLazyRequests(indices),sourceCounts=[];
  const lazyBoundary={create(id,owner,data,generate,key){
    assert.equal(data,owner.resultDataSource,'SDK receives the production full data source');
    sourceCounts.push(data.totalCount());lazy.LazyForEach.create(id,owner,data,generate,key);
  },pop(){}};
  const members=baseline?legacyMembers:[...searchListMethods,...searchListRowMembers];
  const {Component}=createReaderBuilderProbe(source,members,baseline?dependencies:{...searchListDependencies,LazyForEach:lazyBoundary});
  const page=Object.assign(new Component(undefined,{}),{state,motionProgress:0,availableWidth:286,availableHeight:190,
    fullContentHeight:666,quickContentHeight:190,interactionEnabled:true,resultScrollPosition:scroll.createReaderControlSearchScroll(),
    resultRowIndexes:new Map(),resultScrollMounted:false,resultNativeFollowTimer:-1,resultNativeFollowLifecycle:0,
    resultNativeRawBase:0,resultItemSizes:{childDefaultSize:72},
    getUIContext:()=>({vp2px:value=>value}),onSelectResult(){},onLoadMore(){}});
  if(!baseline)page.resultDataSource=new searchListDependencies.ReaderContentSearchDataSource();
  return{page,lazy,sourceCounts};
}
const report=[];
if(selectedCase!=='entry-zero-core'){
for(const count of [0,50,500,2000]){
  const input=count?{kind:'results',keyword:'关键词',results:rows(count)}:{kind:'idle'};
  const started=performance.now();const copied=baseline?property.deepCopy(property.deepCopy(input)):input;
  const copyMs=performance.now()-started,indices=requestedIndices(count);
  // Compile the real SDK component before counting production result lookups.
  const {page:p,lazy,sourceCounts}=createOwner(copied,indices);
  let visits=0;const find=Array.prototype.find,findIndex=Array.prototype.findIndex;
  Array.prototype.find=function(callback,...rest){return find.call(this,(...args)=>{visits++;return callback(...args);},...rest);};
  Array.prototype.findIndex=function(callback,...rest){return findIndex.call(this,(...args)=>{visits++;return callback(...args);},...rest);};
  let publishMs=0,buildMs,replayMs;
  try{
    if(!baseline){const begin=performance.now();p.onResultDataChanged();publishMs=performance.now()-begin;}
    let begin=performance.now();p.resultsBody();buildMs=performance.now()-begin;
    begin=performance.now();p.motionProgress=.5;p.replay();replayMs=performance.now()-begin;
  }finally{Array.prototype.find=find;Array.prototype.findIndex=findIndex;}
  const titles=[...p.nodes.values()].filter(node=>node.type==='Text' && String(node.create).startsWith('第'));
  assert.equal(titles.length,baseline?count:indices.length);
  if(!baseline){
    assert.equal(visits,0,'rendering and morph cannot repeatedly scan the result array');
    assert.equal(p.resultDataSource.totalCount(),count,'full accumulated results remain available');
    assert.deepEqual(lazy.calls.map(call=>call.index),indices,'only native-requested indices invoke the emitted row generator');
    assert.deepEqual(sourceCounts,count?[count]:[],'the SDK receives one unsliced source');
    assert.deepEqual(titles.map(node=>node.create),indices.map(index=>input.results[index].chapterTitle));
    assert.equal(p.resultNativeFollowTimer,-1,'unmounted creation cannot leave a follow timer');
    // Native may request a distant range without Reader rebuilding a window.
    if(count){
      const tail=[count-2,count-1],far=createOwner(input,tail);
      far.page.onResultDataChanged();far.page.resultsBody();
      assert.equal(far.page.resultDataSource.totalCount(),count);
      assert.deepEqual(far.lazy.calls.map(call=>call.index),tail);
      assert.deepEqual([...far.page.nodes.values()].filter(node=>node.type==='Text' && String(node.create).startsWith('第'))
        .map(node=>node.create),tail.map(index=>input.results[index].chapterTitle));
    }
  }
  report.push({count,payloadHandoffMs:copyMs,legacyDeepCopies:baseline?2:0,dataPublishMs:publishMs,buildMs,replayMs,
    linearFindVisits:visits,mountedRows:titles.length,...(!baseline?{nativeRequestedIndices:indices,providerTotalCount:count}: {})});
}
}
if(selectedCase==='entry-zero-core'){
// Entry and typing execute the actual LRE methods without searching Core.
const Lre=productionMotionMethods(new URL('../entry/src/main/ets/features/reading/LocalReadingExperience.ets',import.meta.url),
  ['prepareControlPage','updateQuickSearchQuery','publishQuickSearchState','runQuickSearch','loadMoreQuickSearch'],
  {READER_CONTENT_SEARCH_PAGE_SIZE:50});
const entry=Object.assign(new Lre(),{lifecycleToken:1,searchGeneration:0,quickSearchQuery:'',quickSearchState:{kind:'idle'},
  quickSearchPublication:new ReaderContentSearchPublication(),quickSearchRevision:0,
  activeGateway(){throw Error('opening and typing must not call Core');}});
installContentSearchOwnerProbe(entry);
for(const page of ['quickSearch','fullSearch'])entry.prepareControlPage(page);
entry.updateQuickSearchQuery('新关键词');assert.deepEqual(entry.quickSearchState,{kind:'idle'});
}
console.log(JSON.stringify({baseline,sdk:property.source,componentSha256:createHash('sha256').update(source).digest('hex'),scenarios:report,emptyEntryAndTypingCoreCalls:0,
  case:selectedCase, costEvidence:'operation counts; recorded milliseconds are diagnostic only, not thresholds',
  boundary:baseline?'Archived full ForEach Builder and legacy double SDK copy; no native layout, IME or device frame-time claim':
    'Actual SDK row generation follows explicit requests at the native LazyForEach boundary; the full source is unsliced. No native range-selection, same-frame paint, IME or device frame-time claim'}));

}
for(const id of selected){await runCase(id);recordContractCasePass(id);}
