import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { actionArgs, requestedOperation } from '../collectors/harmonyos/records.mjs';
import { evaluateSearch } from '../lib/search.mjs';
import { searchEmptyBookshelfSteps } from '../lib/search-empty-bookshelf-entry.mjs';

const contract = JSON.parse(readFileSync(new URL('../cases/bookshelf.search-empty-bookshelf-entry.json',import.meta.url)));
const entry = 'reader-bookshelf-empty-search-entry';
const empty = 'reader-bookshelf-empty-scroll';
const editor = 'reader-book-search-input';
const identity = {identity:6,navigation:9,mounting:2};
const owner = {...identity,owner:7,queryRevision:12};
const instanceId = 'reader';
const rect = {left:10,top:20,width:90,height:44};

function node(id,type,path,parentPath,extra = {}) {
  return {id,type,path,parentPath,source:'native-tree',visible:true,opacity:1,enabled:true,clickable:type === 'Button',
    visibleRectPx:rect,rectPx:rect,...extra};
}

function emptyNodes() {
  return [
    node(empty,'Scroll','0/0','0'),
    node('reader-bookshelf-empty-title','Text','0/0/0','0/0'),
    node('reader-bookshelf-import-entry','Button','0/0/1','0/0'),
    node(entry,'Button','0/0/2','0/0'),
    node('reader-bookshelf-search-bar','Row','0/1','0'),
    node('reader-bookshelf-search-entry','Button','0/1/0','0/1'),
  ];
}

function inputNodes() {
  return [
    ...emptyNodes().slice(0,4),
    node('reader-bookshelf-search-bar','Row','0/1','0'),
    node('reader-library-search-back','Button','0/1/0','0/1'),
    node('reader-bookshelf-search-field','Row','0/1/1','0/1'),
    node(editor,'TextInput','0/1/1/0','0/1/1',{key:'31',focused:true}),
  ];
}

function sample(state,beforeSeq,visible,nodes) {
  return {state,sampleId:state,instanceId,beforeSeq,afterSeq:beforeSeq+1,hostBeginMs:beforeSeq*10,hostEndMs:beforeSeq*10+2,
    captureComplete:true,evidenceRefs:[state+'.json',state+'.png'],nodes,
    window:{id:'72',source:'window-metrics',revision:3,keyboard:{visible,revision:3,source:'window-metrics',
      rectsVp:visible ? [{left:0,top:410,width:320,height:298}] : []}}};
}

function journey() {
  const actions = Object.fromEntries([[1,4,6],[3,13,15],[5,22,25]].map(([index,beforeSeq,afterSeq])=>{
    const step = contract.steps[index];
    return [step.id,{instanceId,op:step.op,from:step.from,targetId:step.target?.id,key:step.key,
      beforeSeq,afterSeq,hostBeginMs:beforeSeq*10,hostEndMs:afterSeq*10,evidenceRefs:['commands.jsonl']}];
  }));
  const event = (eventSeq,kind,payload,channel = 'business') => ({
    eventSeq,kind,payload,channel,instanceId,evidenceRefs:[kind+'.jsonl'],
  });
  return {actions,samples:{
    'empty-shelf-before':sample('empty-shelf-before',2,false,emptyNodes()),
    'entry-projection':sample('entry-projection',11,true,inputNodes()),
    'input-ime-hidden':sample('input-ime-hidden',17,false,inputNodes()),
    'empty-shelf-returned':sample('empty-shelf-returned',29,false,emptyNodes()),
  },events:[
    event(5,'search-open-accepted',{...identity,queryRevision:12,entry:'empty-shelf'}),
    event(7,'search-surface-settled',{...owner,mode:'input'}),
    event(8,'search-page-projection',{...owner,page:3,publicationRevision:4,resultCount:0,projection:'initial',searchActive:false}),
    event(9,'search-editor-focus',{...owner,editorId:'[6,9,2,7]',focused:true},'input'),
    event(23,'search-back-consumed',{...owner,consumer:'route',route:'search',mode:'input'}),
    event(24,'search-route-released',{...owner,navigation:10,previousNavigation:9,route:'bookshelf',mode:'idle',
      writeLease:{generation:2,session:3,active:false}}),
    event(25,'search-page-owner-released',{owner:7,page:3,queryRevision:12,released:true}),
  ]};
}

function verdict(index,context) {
  const definition = contract.assertions[index];
  return evaluateSearch({...definition,acceptedSources:definition.sources},context);
}

test('empty bookshelf Search dispatch accepts only the scoped empty native Scroll and its actual Search Button',()=>{
  const open = contract.steps[1];
  const {samples} = journey();
  assert.deepEqual(actionArgs(requestedOperation(open,samples,contract.fixture)),['shell','uitest','uiInput','click','55','42']);
  assert.throws(()=>requestedOperation(open,samples,{id:'ordinary-fixture'}),/genuinely empty bookshelf/u);
  for (const bad of [
    [node(entry,'Button','0/2','0')],
    [...emptyNodes().slice(0,3),node(entry,'Button','0/2','0')],
    [...emptyNodes(),node('reader.bookshelf.viewport:8','List','0/3','0')],
    [...emptyNodes(),node('reader-shelf-book-id','Button','0/3','0',{bookCard:true})],
    [...emptyNodes(),node(entry,'Button','0/0/3','0/0')],
  ]) {
    samples['empty-shelf-before'].nodes = bad;
    assert.throws(()=>requestedOperation(open,samples,contract.fixture),/genuinely empty bookshelf/u);
  }
  assert(searchEmptyBookshelfSteps(contract.steps,contract.assertions));
  const altered = structuredClone(contract);
  altered.steps[1].target.ancestors = ['reader-bookshelf-search-bar'];
  assert(!searchEmptyBookshelfSteps(altered.steps,altered.assertions));
});

test('empty bookshelf Search requires exactly one action-bound empty-origin acceptance and same-query projection',()=>{
  const current = journey();
  assert.equal(verdict(0,current).verdict,'PASS');
  current.events[0].payload.entry = 'header';
  assert.equal(verdict(0,current).verdict,'NOT_RUN');
  current.events[0].payload.entry = 'empty-shelf';
  current.actions['open-search'].targetId = 'reader-bookshelf-search-entry';
  assert.equal(verdict(0,current).verdict,'NOT_RUN');
  current.actions['open-search'].targetId = entry;
  current.events.splice(1,0,{...current.events[0],eventSeq:6});
  assert.equal(verdict(0,current).verdict,'NOT_RUN');
  current.events.splice(1,1);
  current.events[2].payload.queryRevision++;
  assert.equal(verdict(0,current).verdict,'FAIL');
});

test('empty bookshelf Search Back preserves the native editor then releases the existing owner on the empty shelf',()=>{
  const current = journey();
  for (const index of [1,2]) {
    const result = verdict(index,current);
    assert.equal(result.verdict,'PASS',result.reason);
  }
  assert.equal(verdict(1,current).actual.sameNativeEditor,true);
  assert.equal(verdict(2,current).actual.previousOwner,7);
  current.samples['input-ime-hidden'].nodes.find(item=>item.id === editor).key = '32';
  assert.equal(verdict(1,current).verdict,'FAIL');
  current.events.at(-1).payload.released = false;
  assert.equal(verdict(2,current).verdict,'FAIL');
});
