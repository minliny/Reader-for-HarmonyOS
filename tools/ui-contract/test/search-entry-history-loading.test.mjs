import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { normalizeHarmonyLayout } from '../lib/layout.mjs';
import { conditionApplicability } from '../lib/receipt-conditions.mjs';
import { evaluateSearch } from '../lib/search.mjs';
import { searchHistoryLoadingWatchEnded } from '../lib/search-entry-history-loading.mjs';

const definition = JSON.parse(readFileSync(new URL('../cases/bookshelf.search-entry-history-loading.json',import.meta.url)));
const [assertion] = definition.assertions;
const instanceId = 'normal-search-history';
const route = {identity:3,navigation:4,mounting:5,queryRevision:6};
const owner = {owner:7,page:8,queryRevision:route.queryRevision};
const field = 'reader-book-search-input';
const panel = 'reader-search-history-viewport';
const marker = 'reader-search-history-loading';
const opening = 'search-open-accepted';
const settled = 'search-surface-settled';
const state = 'search-entry-history-state';
const projection = 'search-page-projection';
const appEvent = (eventSeq,kind,payload) => ({eventSeq,kind,payload,instanceId,channel:'business'});
const history = (eventSeq,stage = 'opening-end',status = 'loading',eligible = true) =>
  appEvent(eventSeq,state,{...route,...owner,mode:'input',editorId:'[3,4,5,7]',stage,historyStatus:status,
    feedbackEligible:eligible,length:0});
const projected = (eventSeq, historyStatus='loading') =>
  appEvent(eventSeq,projection,{...owner,historyStatus,projection:'initial',searchActive:false});

function nativeNode(type,id,rect,props={},children=[]) {
  const bounds = `[${rect.slice(0,2)}][${rect.slice(2)}]`;
  return {attributes:{type,id,bounds,origBounds:bounds,hostWindowId:'42',visible:'true',opacity:'1',
    enabled:'true',...props},children};
}

function capture(beforeSeq,children,keyboardRect) {
  const cover = [0,0,430,800];
  const area = {left:0,top:0,width:430,height:800};
  const root = nativeNode('root','',cover,{bundleName:'io.reader.minliny',abilityName:'EntryAbility',pagePath:'pages/Index'},children);
  const report = {windowId:'42',vpPixels:1,metrics:{ready:true,revision:7,densityPixels:1,windowRect:area,globalRect:area,
    keyboardArea:{available:true,visible:Boolean(keyboardRect),rects:keyboardRect ? [keyboardRect] : [],revision:7},
    keyboardInsets:{left:0,top:0,right:0,bottom:keyboardRect ? 800-keyboardRect.top : 0}}};
  return {...normalizeHarmonyLayout({tree:{attributes:{bounds:root.attributes.bounds},children:[root]},report,
    sampleId:'search-history',instanceId,observeSearchHistoryLoading:true,
    evidenceRefs:[{path:'sample.png'},{path:'sample.json'}]}),
    captureComplete:true,beforeSeq,afterSeq:beforeSeq+1};
}

function viewport({selectedMarker = true, feedbackRect = [35,180,395,260], keyboardTop = 520, wrongOwner = false,
  spinnerVisible = true, editorEnabled = true, labelText = '正在读取搜索历史'} = {}) {
  const editor = nativeNode('TextInput',field,[32,78,397,135],{enabled:String(editorEnabled)});
  const spinner = nativeNode('LoadingProgress','',[195,195,230,228],{visible:String(spinnerVisible)});
  const label = nativeNode('Text','',[100,232,330,250],{text:labelText});
  const feedback = nativeNode('Column',marker,feedbackRect,{},[spinner,label]);
  const viewport = nativeNode('Stack',panel,[20,140,410,340],{clip:'true'},selectedMarker && !wrongOwner ? [feedback] : []);
  const nodes = [editor,viewport];
  if (wrongOwner) nodes.push(feedback);
  return capture(12,nodes,{left:0,top:keyboardTop,width:430,height:800-keyboardTop});
}

function context(sample = viewport()) {
  return {
    actions:{'open-search':{beforeSeq:4,afterSeq:8,instanceId,op:'click',targetId:'reader-bookshelf-search-entry',outcomeSettled:true}},
    samples:{before:capture(1,[nativeNode('Button','reader-bookshelf-search-entry',[15,15,90,70])]),'history-loading':sample},
    events:[appEvent(5,opening,route),projected(6),appEvent(7,settled,{...route,...owner,mode:'input'}),history(9)],
  };
}

function verdict(context) {
  const result = evaluateSearch({...assertion,acceptedSources:assertion.sources},context);
  const condition = conditionApplicability(assertion,context,result,definition);
  return [result.verdict,condition.status,condition.sampleApplies];
}

test('search entry history loading accepts the same interactive editor and native pending feedback', () => {
  assert.deepEqual(verdict(context()),['PASS','APPLIES',true]);
});

test('search entry history loading detects absent, misplaced or IME-covered feedback', () => {
  for (const options of [{selectedMarker:false},{spinnerVisible:false},{wrongOwner:true},
    {feedbackRect:[35,128,395,260]},{keyboardTop:224},{editorEnabled:false},{labelText:'其他文本'}]) {
    assert.deepEqual(verdict(context(viewport(options))),['FAIL','APPLIES',true],JSON.stringify(options));
  }
  const input = context();
  input.events.at(-1).payload.length = 4;
  assert.deepEqual(verdict(input),['FAIL','APPLIES',true]);
  assert.deepEqual(verdict(context(viewport({labelText:''}))),['NOT_RUN','APPLIES',true]);
  assert(!JSON.stringify(viewport({labelText:'私有历史内容'})).includes('私有历史内容'));
});

test('search entry history loading keeps a missed eligible interval required', () => {
  const missed = context();
  delete missed.samples['history-loading'];
  assert.deepEqual(verdict(missed),['NOT_RUN','APPLIES',false]);
  const settledLater = context(viewport({selectedMarker:false}));
  settledLater.events.push(projected(11,'ready'));
  assert.deepEqual(verdict(settledLater),['NOT_RUN','APPLIES',false]);
  assert.equal(searchHistoryLoadingWatchEnded(settledLater.events,settledLater.actions['open-search']),true);
  const changedDuringCapture = context();
  changedDuringCapture.events.push(projected(13,'ready'));
  assert.deepEqual(verdict(changedDuringCapture),['NOT_RUN','APPLIES',false]);
});

test('search entry history loading excludes only a positively completed initial read before the open viewport', () => {
  const ready = context(viewport({selectedMarker:false}));
  ready.events[1] = projected(6,'ready');
  ready.events[3] = history(9,'opening-end','ready',false);
  assert.deepEqual(verdict(ready),['NOT_RUN','DOES_NOT_APPLY',undefined]);
  assert.equal(searchHistoryLoadingWatchEnded(ready.events,ready.actions['open-search']),true);
  ready.events[3].payload.stage = 'viewport';
  assert.deepEqual(verdict(ready),['NOT_RUN','UNKNOWN',undefined]);
  ready.events[3].payload.stage = 'opening-end';
  ready.events[3].payload.editorId = '[3,4,5,9]';
  assert.deepEqual(verdict(ready),['NOT_RUN','UNKNOWN',undefined]);
});

test('search entry history loading rejects stale owners and incomplete native intervals', () => {
  const stale = context();
  stale.events[3].payload.owner = 9;
  assert.deepEqual(verdict(stale),['NOT_RUN','UNKNOWN',undefined]);
  assert.equal(searchHistoryLoadingWatchEnded(stale.events,stale.actions['open-search']),false);
  const unrelated = context();
  unrelated.events[3].instanceId = 'former-instance';
  assert.deepEqual(verdict(unrelated),['NOT_RUN','UNKNOWN',undefined]);
  const wrongWindow = context();
  wrongWindow.samples['history-loading'].window.id = '43';
  assert.deepEqual(verdict(wrongWindow),['NOT_RUN','APPLIES',false]);
});
