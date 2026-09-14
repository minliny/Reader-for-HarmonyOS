import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { createArkUIPropertyRuntimeProbe } from './lib/arkui-property-runtime-probe.mjs';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import * as geometry from '../entry/src/main/ets/features/reading/ReaderControlSearchGeometry.ts';
import * as scroll from '../entry/src/main/ets/features/reading/ReaderControlSearchScroll.ts';
import * as motion from '../entry/src/main/ets/features/reading/ReaderControlMotionPresentation.ts';
import { splitReaderSearchSnippet } from '../entry/src/main/ets/features/reading/ReaderSearchHighlight.ts';
import { ReaderContentSearchPublication } from '../entry/src/main/ets/features/reading/ReaderContentSearchPublication.ts';
import { searchListDependencies, searchListMethods, searchListRowMembers, searchListLazyRequests } from './lib/reader-content-search-list-probe.mjs';

const file=new URL('../entry/src/main/ets/features/reading/ReaderControlSearchContent.ets',import.meta.url);
const baseline=process.argv.includes('--baseline');
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
// Entry and typing execute the actual LRE methods without searching Core.
const Lre=productionMotionMethods(new URL('../entry/src/main/ets/features/reading/LocalReadingExperience.ets',import.meta.url),
  ['prepareControlPage','updateQuickSearchQuery','publishQuickSearchState','runQuickSearch','loadMoreQuickSearch'],
  {READER_CONTENT_SEARCH_PAGE_SIZE:50});
const entry=Object.assign(new Lre(),{lifecycleToken:1,searchGeneration:0,quickSearchQuery:'',quickSearchState:{kind:'idle'},
  quickSearchPublication:new ReaderContentSearchPublication(),quickSearchRevision:0,
  activeGateway(){throw Error('opening and typing must not call Core');}});
for(const page of ['quickSearch','fullSearch'])entry.prepareControlPage(page);
entry.updateQuickSearchQuery('新关键词');assert.deepEqual(entry.quickSearchState,{kind:'idle'});
const all=rows(2000),requests=[];
const search=Object.assign(new Lre(),{lifecycleToken:1,bookId:'b',searchGeneration:0,quickSearchQuery:'关键词',quickSearchState:{kind:'idle'},
  quickSearchPublication:new ReaderContentSearchPublication(),quickSearchRevision:0,controlVisible:()=>true,
  controlPage:()=> 'fullSearch',isSessionActive:()=>true,
  activeGateway:()=>({searchContentPage:async(book,keyword,limit,offset)=>{
    requests.push({book,keyword,limit,offset});return{results:all.slice(offset,offset+limit),offset,hasMore:offset+limit<all.length};
  }})});
const turn=()=>new Promise(resolve=>setImmediate(resolve));
search.runQuickSearch();await turn();assert.equal(search.quickSearchState.results.length,50);
assert.equal(search.quickSearchRevision,2,'one loading and one terminal publication per initial search');
for(let count=50;count<2000;count+=50){search.loadMoreQuickSearch();await turn();assert.equal(search.quickSearchState.results.length,count+50);}
assert.equal(requests.length,40);assert.ok(requests.every(request=>request.limit===50));
assert.equal(search.quickSearchState.hasMore,false);search.loadMoreQuickSearch();await turn();assert.equal(requests.length,40);
let release;search.activeGateway=()=>({searchContentPage:()=>new Promise(resolve=>release=resolve)});
search.runQuickSearch();search.updateQuickSearchQuery('另一个关键词');release({results:all.slice(0,50),offset:0,hasMore:true});await turn();
assert.deepEqual(search.quickSearchState,{kind:'idle'},'late result cannot overwrite the new input intent');
console.log(JSON.stringify({baseline,sdk:property.source,componentSha256:createHash('sha256').update(source).digest('hex'),scenarios:report,emptyEntryAndTypingCoreCalls:0,
  cumulativePagination:{pages:40,pageSize:50,results:2000,lateGenerationRejected:true},
  boundary:baseline?'Archived full ForEach Builder and legacy double SDK copy; no native layout, IME or device frame-time claim':
    'Actual SDK row generation follows explicit requests at the native LazyForEach boundary; the full source is unsliced. No native range-selection, same-frame paint, IME or device frame-time claim'}));
