import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { actionArgs, requestedOperation } from '../collectors/harmonyos/records.mjs';
import { publicAssertionDefinition } from '../lib/assertion-contract.mjs';
import { normalizeHarmonyLayout } from '../lib/layout.mjs';
import { evaluateSource } from '../lib/source.mjs';
import { sourceNativeFocusFixture, sourceNativeFocusSteps } from '../lib/source-native-focus.mjs';

const contract = JSON.parse(readFileSync(new URL('../cases/source-management.native-focus-and-semantics.json',import.meta.url)));
const owner = {generation:8,mounting:2};
const windowId = '42';
const groupTrigger = 'source-back:18:group-trigger';
const fixtures = new Set(['group-open','group-key-open']);
const actionWindows = {
  'open-sources':[1,4], 'focus-query':[7,8], 'hide-query-keyboard':[11,12],
  'open-group':[15,16], 'close-group':[19,20], 'reopen-group-key':[24,25],
};
const focus = (step, changes) => {
  const assertion = contract.assertions.find(item=>item.id === step);
  publicAssertionDefinition(assertion);
  return evaluateSource({...assertion,acceptedSources:assertion.sources},changes);
};
const pixelBox = {left:0,top:0,width:320,height:708};

function node(id,type,attributes = {},children = []) {
  return {attributes:{id,type,hostWindowId:windowId,bounds:'[0,0][300,260]',
    origBounds:'[0,0][300,260]',visible:'true',focused:'false',enabled:'true',selected:'false',
    clickable:'true',opacity:'1.0',...attributes},children};
}

function sample(id,beforeSeq,options = {}) {
  const keyboard = id === 'query-ime';
  const open = options.noPanel !== true && fixtures.has(id);
  const generation = id === 'group-key-open' ? 24 : 21;
  const description = options.description ?? (open ? '已展开' : '已收起');
  const editor = node('reader-source-editor','TextInput',{
    focused:String(options.editorFocused ?? keyboard),...options.editorFields,
  });
  const group = node(groupTrigger,'Button',{
    description,focused:String(options.triggerFocused ?? (id === 'group-restored')),enabled:String(!open),
  });
  const other = options.otherFocus ? [node('reader-other-action','Button',{focused:'true'})] : [];
  const list = node('reader-source-list','List',{},[node('reader-source-search','Row',{},[editor]),
    node('reader-source-group-trigger','Row',{},[group]),...other]);
  const panel = node('reader-source-group-panel','__Common__',{},[
    node('','Column',{zIndex:'10'},[node('','Column',{clip:'true',zIndex:'10'},[
      node('','Scroll',{},[node(`source-group:${options.selection ?? generation}:focus:selected`,'Button',{
        focused:String(options.selectedFocused ?? true),selected:String(options.selected ?? true),
        originalText:'public visible option name',
      })]),
    ])]),
  ]);
  const tree = {attributes:{bounds:'[0,0][320,708]'},children:[node('','root',{
    bundleName:'io.reader.minliny',abilityName:'EntryAbility',pagePath:'pages/Index',
    bounds:'[0,0][320,708]',origBounds:'[0,0][320,708]',
  },[list,...(open?[panel]:[])])]};
  const report = {windowId,vpPixels:1,metrics:{ready:true,revision:3,densityPixels:1,globalRect:pixelBox,windowRect:pixelBox,
    keyboardArea:{available:true,visible:keyboard,revision:3,rects:keyboard?[{left:0,top:440,width:320,height:268}]:[]},
    keyboardInsets:{left:0,right:0,top:0,bottom:keyboard?268:0}}};
  return {...normalizeHarmonyLayout({tree,report,sampleId:id,instanceId:'reader',observeSourceNativeFocus:options.observe ?? true,
    evidenceRefs:[{path:id+'.json'},{path:id+'.png'}]}),captureComplete:true,beforeSeq,afterSeq:beforeSeq+1};
}

function journey() {
  const samples = Object.fromEntries([
    ['source-ready',5],['query-ime',9],['query-back',13],['group-open',17],
    ['group-restored',22],['group-key-open',27],
  ].map(([id,seq])=>[id,sample(id,seq)]));
  const actions = Object.fromEntries(contract.steps.filter(step=>Object.hasOwn(actionWindows,step.id)).map(step=>{
    const [beforeSeq,afterSeq] = actionWindows[step.id];
    return [step.id,{from:step.from,op:step.op,targetId:step.target,key:step.key,beforeSeq,afterSeq,
      instanceId:'reader',evidenceRefs:[{path:'commands.jsonl'}]}];
  }));
  const event = (seq,kind,payload) => ({kind:'source.'+kind,channel:'business',instanceId:'reader',eventSeq:seq,payload,
    evidenceRefs:[{path:'events.jsonl'}]});
  const events = [
    event(2,'route',{action:'open',from:'settings',to:'source',...owner,previousGeneration:7}),
    event(3,'projection',{owner,state:'rows',readFact:'current',readGeneration:4,filterRevision:3,groupIndex:0,queryLength:0,
      count:2,projected:2,status:'all',category:'all'}),
    event(16,'overlay',{owner,overlay:'group',phase:'open',selectionId:'source-group:21'}),
    event(20,'overlay',{owner,overlay:'group',phase:'back'}),
    event(21,'overlay',{owner,overlay:'group',phase:'dismiss',selectionId:'source-group:21'}),
    event(25,'overlay',{owner,overlay:'group',phase:'open',selectionId:'source-group:24'}),
  ];
  return {samples,actions,events};
}

test('Source native editor and group focus prove actual native endpoints and preserve label and utterance gaps',()=>{
  const current = journey();
  const query = focus('source.focus.query',current);
  assert.equal(query.verdict,'PASS');
  assert.equal(query.actual.nativeDeclaredName,'NOT_RUN');
  assert.equal(query.actual.screenReaderUtterance,'NOT_RUN');
  for (const key of ['group-selected','group-restored','group-enter']) {
    const observed = focus('source.focus.'+key,current);
    assert.equal(observed.verdict,'PASS',observed.reason);
    assert(observed.evidenceRefs.some(ref=>ref.path === 'commands.jsonl'));
  }
  for (const key of ['group-selected','group-expanded','group-collapsed']) {
    const observed = focus('source.accessibility.'+key,current);
    assert.equal(observed.verdict,'PASS',observed.reason);
    assert.equal(observed.actual.screenReaderUtterance,'NOT_RUN');
  }
  current.samples['query-ime'] = sample('query-ime',9,{editorFields:{accessibilityText:'搜索书源名称或域名'}});
  assert.equal(focus('source.focus.query',current).actual.nativeDeclaredName,'PASS');
  current.samples['query-ime'] = sample('query-ime',9,{editorFields:{accessibilityText:'another private label'}});
  const mismatched = focus('source.focus.query',current);
  assert.equal(mismatched.actual.nativeDeclaredName,'FAIL');
  assert(!JSON.stringify(mismatched).includes('another private label'));
});

test('Source native keyboard dispatch protects the current focus and rejects stale or missing group outcomes',()=>{
  const current = journey();
  const reopen = contract.steps.find(step=>step.id === 'reopen-group-key');
  const open = contract.steps.find(step=>step.id === 'open-group');
  const finish = contract.steps.find(step=>step.id === 'close-key-group');
  const fixture = {id:sourceNativeFocusFixture};
  assert.deepEqual(actionArgs(requestedOperation(open,current.samples,fixture)),['shell','uitest','uiInput','click','150','130']);
  assert.deepEqual(actionArgs(requestedOperation(reopen,current.samples,fixture)),['shell','uitest','uiInput','keyEvent','2054']);
  assert.deepEqual(actionArgs(requestedOperation(finish,current.samples,fixture)),['shell','uitest','uiInput','keyEvent','Back']);
  current.samples['group-restored'] = sample('group-restored',22,{otherFocus:true});
  assert.throws(()=>requestedOperation(reopen,current.samples,fixture),/verified native control/);
  assert.equal(focus('source.focus.group-restored',current).verdict,'FAIL');
  current.samples['group-restored'] = sample('group-restored',22);
  current.samples['group-key-open'] = sample('group-key-open',27,{selection:21});
  assert.equal(focus('source.focus.group-enter',current).verdict,'NOT_RUN');
  current.samples['group-key-open'] = sample('group-key-open',27,{noPanel:true});
  current.events.pop();
  assert.equal(focus('source.focus.group-enter',current).verdict,'FAIL');
  assert.throws(()=>requestedOperation(finish,current.samples,fixture),/current open panel/);
  const wrongWindow = journey();
  wrongWindow.samples['group-key-open'].window.id = 'another-window';
  assert.equal(focus('source.focus.group-enter',wrongWindow).verdict,'NOT_RUN');
});

test('Source native semantic states distinguish explicit mismatch, absent field, and unrelated cases',()=>{
  assert(sourceNativeFocusSteps(contract.steps,contract.assertions));
  const alternative = structuredClone(contract);
  alternative.steps.find(step=>step.id === 'reopen-group-key').key = 'Back';
  assert(!sourceNativeFocusSteps(alternative.steps,alternative.assertions));
  const current = journey();
  current.samples['group-open'] = sample('group-open',17,{description:'已收起',selected:false});
  assert.equal(focus('source.accessibility.group-expanded',current).verdict,'FAIL');
  assert.equal(focus('source.accessibility.group-selected',current).verdict,'FAIL');
  assert.equal(focus('source.focus.group-selected',current).verdict,'PASS');
  current.samples['group-open'] = sample('group-open',17,{description:''});
  assert.equal(focus('source.accessibility.group-expanded',current).verdict,'NOT_RUN');
  const ordinary = sample('group-open',17,{observe:false});
  assert(!ordinary.nodes.some(node=>Object.hasOwn(node,'sourceFocusSelection') ||
    Object.hasOwn(node,'sourceFocusExpansion') || Object.hasOwn(node,'sourceFocusQueryName')));
});
