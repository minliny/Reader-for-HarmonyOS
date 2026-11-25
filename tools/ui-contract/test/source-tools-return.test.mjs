import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {loadCase} from '../lib/cases.mjs';
import {selectedProductionMethods} from '../../lib/selected-production-methods.mjs';
import {requestedOperation, requireActionDispatch} from '../collectors/harmonyos/records.mjs';
import {normalizeHarmonyLayout, sourceFooterToolsButton, sourceHeaderToolsButton} from '../lib/layout.mjs';
import {sourceFilterNativeDispatch} from '../lib/source-filter-edge.mjs';
import {assertSourceToolsReturnAction,evaluateSource} from '../lib/source.mjs';

const definition = JSON.parse(readFileSync(new URL('../cases/source-management.tool-return-filters.json',import.meta.url)));
const instanceId = 'one-source-session';
const beforeOwner = {mounting:2,generation:17};
const afterOwner = {mounting:2,generation:19};
const toolsHeader = 'reader-source-header-tools';
const sourceBack = 'reader-source-back';
const toolsBack = 'reader-source-tools-back';
const sourceList = 'reader-source-list';
const expectedAnchor = 'reader-source-row-7';
const projection = {
  owner:beforeOwner, filterRevision:5, trigger:'group', category:'novel', status:'unchecked', allGroups:false, groupIndex:1,
  readGeneration:9, readFact:'current', state:'rows', count:18, projected:15, queryLength:12, firstAnchor:1,
};
const scroll = {
  owner:beforeOwner, trigger:'settled', filterRevision:5, anchor:7, itemIndex:7, offsetVp:642.5, itemYVp:-12.25,
  viewportHeightVp:770, viewportWidthVp:366, lastAnchor:15, layoutMatchesSaved:false, filterMatchesSaved:false,
};

const ref = path => ({path,bytes:27,sha256:'a'.repeat(64)});
const treeRef = id => [ref(`raw/${id}.png`),ref(`raw/${id}.json`)];
const proofRef = ref('raw/commands.jsonl');

function node(id, path, type = 'Row', top = 10) {
  const rectPx = {left:10,top,width:30,height:40};
  return {id,path,parentPath:path.slice(0,path.lastIndexOf('/')),type,rectPx,visibleRectPx:{...rectPx},
    visible:true,enabled:true,opacity:1,focused:false};
}

function capture(sampleId, beforeSeq, nodes) {
  return {sampleId, instanceId, beforeSeq, afterSeq:beforeSeq+2, evidenceRefs:treeRef(sampleId),
    nodes, captureComplete:true, window:{id:'1',revision:14,density:3.5,rectPx:{left:0,top:0,width:1280,height:2832},
      keyboard:{visible:false}}};
}

function action(from, beforeSeq, afterSeq, op, fields = {}) {
  return {from,beforeSeq,afterSeq,op,instanceId,evidenceRefs:[proofRef],...fields};
}

function event(eventSeq, kind, payload) {
  return {eventSeq,kind,payload,instanceId,channel:'business',evidenceRefs:[proofRef]};
}

function context() {
  const header = node(toolsHeader,'0/0/1');
  const focusedButton = {...node(null,header.path+'/0/0','Button'),focused:true};
  const mainRoute = [node(sourceBack,'0/0/0'),header,node(sourceList,'0/1','List')];
  const mainRow = node(expectedAnchor,'0/1/2','Column',312);
  return {
    samples:{
      filtered:capture('filtered',18,mainRoute),
      scrolled:capture('scrolled',28,[...mainRoute,mainRow]),
      tools:capture('tools',38,[node(toolsBack,'0/0/0','Button')]),
      restored:capture('restored',57,[...mainRoute,structuredClone(mainRow),focusedButton]),
    },
    actions:{
      'scroll-list':action('filtered',21,26,'swipe',{targetId:sourceList}),
      'open-tools':action('scrolled',31,36,'click',{targetId:toolsHeader}),
      'tools-back':action('tools',41,48,'keyEvent',{key:'Back'}),
    },
    events:[
      event(17,'source.projection',{...projection}),
      event(23,'source.scroll',{...scroll}),
      event(32,'source.scroll',{...scroll,trigger:'tools'}),
      event(33,'source.route',{...beforeOwner,generation:18,previousGeneration:17,action:'tools',from:'source',to:'sourceTools'}),
      event(43,'source.route',{...afterOwner,previousGeneration:18,action:'tools-back',from:'sourceTools',to:'source'}),
      event(47,'source.projection',{...projection,owner:afterOwner,trigger:'owner-update',filterRevision:1,readGeneration:10}),
      event(52,'source.scroll',{...scroll,owner:afterOwner,trigger:'restored',filterRevision:1,
        layoutMatchesSaved:true,filterMatchesSaved:true}),
    ],
  };
}

function evaluate(kind, fixture, current = false) {
  const assertion = definition.assertions.find(item => item.kind === kind);
  const {minimumProjected,entry,...base} = assertion.expected;
  const expected = current ? assertion.expected : kind === 'tool-return-filters' ? {...base,queryLength:12,projected:15} : base;
  return evaluateSource({...assertion,expected,acceptedSources:assertion.sources},fixture);
}

function currentContext() {
  const fixture = context();
  for (const record of [...Object.values(fixture.samples),...Object.values(fixture.actions)]) {
    record.beforeSeq += 100;
    record.afterSeq += 100;
  }
  fixture.events.shift();
  for (const record of fixture.events) {
    record.eventSeq += 100;
    if (record.kind === 'source.projection') {
      Object.assign(record.payload,{count:1007,projected:83,queryLength:3});
    }
  }
  const sourceEditor = (keyboard,typed) => ({
    ...node('reader-source-editor','0/1/1','TextInput'),focused:keyboard,publicSourceToolsQueryMatches:typed,
  });
  const point = (id,seq,nodes,keyboard = false) => {
    const sample = capture(id,seq,nodes);
    sample.window.keyboard.visible = keyboard;
    return sample;
  };
  const first = {...node('reader-source-row-1','0/1/0','Column'),source:'native-tree'};
  const parentList = node(sourceList,'0/1','List');
  const groupPanel = node('reader-source-group-panel','0/2');
  const groupOption = {...node(null,groupPanel.path + '/1','Button'),alias:'reader-source-group-option-1'};
  const groupLabel = {...node(null,groupOption.path + '/0','Text'),publicGroupOptionText:true};
  const backdrop = {...node('reader-source-group-backdrop:source-group:2','0/3'),alias:'reader-source-group-backdrop'};
  const queryMatch = sourceEditor(false,true);
  const basic = [node(sourceBack,'0/0/0'),parentList];
  Object.assign(fixture.samples,{
    'source-ready':point('source-ready',8,[...basic,first]),
    'fixture-query-ime':point('fixture-query-ime',14,[sourceEditor(true,false)],true),
    'fixture-query-edited':point('fixture-query-edited',22,[sourceEditor(true,true)],true),
    'query-ready':point('query-ready',29,[...basic,queryMatch]),
    'unchecked':point('unchecked',37,basic),
    novel:point('novel',45,basic),
    'group-open':point('group-open',53,[groupPanel,groupOption,groupLabel,backdrop,
      {...node(null,groupPanel.path + '/0','Button'),alias:'reader-source-group-selected'}]),
  });
  fixture.samples.filtered.nodes.push(first,queryMatch);
  const header = (focused) => ({
    ...node('source-back:2:tools:header','0/0/1/0','Button'),
    alias:sourceHeaderToolsButton.id,clickable:true,focused,
  });
  fixture.samples.scrolled.nodes.push(header(false));
  fixture.samples.restored.nodes = [
    ...fixture.samples.restored.nodes.filter(item=>!item.focused),header(true),
  ];
  fixture.actions['open-tools'].targetId = sourceHeaderToolsButton.id;
  const settled = {outcomeSettled:true};
  Object.assign(fixture.actions,{
    'open-sources':action('settings',1,6,'click',{...settled,targetId:'reader-settings-source-management'}),
    'select-public-fixture':action('fixture-query-ime',17,20,'inputText',{
      ...settled,targetId:'reader-source-editor',inputRole:'public-source-prefix',inputLength:3,
    }),
    'leave-fixture-ime':action('fixture-query-edited',25,27,'keyEvent',{...settled,key:'Back'}),
    'select-unchecked':action('query-ready',32,35,'click',{...settled,targetId:'reader-source-status-unchecked'}),
    'select-novel':action('unchecked',40,43,'click',{...settled,targetId:'source-category-novel'}),
    'open-group':action('novel',48,51,'click',{...settled,targetId:'reader-source-group-trigger'}),
    'select-group':action('group-open',56,60,'click',{...settled,targetId:'reader-source-group-option-1'}),
  });
  const initial = {
    ...projection,count:1007,projected:1007,category:'all',status:'all',allGroups:true,groupIndex:0,
    queryLength:0,filterRevision:1,trigger:'owner-update',
  };
  const edited = {...initial,projected:620,queryLength:3,filterRevision:2,trigger:'edit'};
  const unchecked = {...edited,status:'unchecked',filterRevision:3,trigger:'status'};
  const novel = {...unchecked,projected:510,category:'novel',filterRevision:4,trigger:'category'};
  const grouped = {...novel,projected:83,allGroups:false,groupIndex:1,filterRevision:5,trigger:'group'};
  const overlay = {owner:beforeOwner,overlay:'group',selectionId:'source-group:2'};
  fixture.events.unshift(
    event(2,'source.route',{...beforeOwner,previousGeneration:16,action:'open',from:'settings',to:'source'}),
    event(3,'source.projection',initial),
    event(19,'source.projection',edited),
    event(34,'source.projection',unchecked),
    event(42,'source.projection',novel),
    event(50,'source.overlay',{...overlay,phase:'open'}),
    event(57,'source.projection',grouped),
    event(58,'source.overlay',{...overlay,phase:'dismiss'}),
  );
  return fixture;
}

test('source Tools return v2 proves four real commits, native header dispatch and return focus on the live catalog',()=>{
  const fixture = currentContext();
  const retention = () => evaluate('tool-return-filters',fixture,true);
  const focus = () => evaluate('tools-return-focus',fixture,true);
  const mark = eventSeq => ({instanceId,eventSeq});
  const guard = id => assertSourceToolsReturnAction(definition,{id},fixture,mark(id === 'scroll-list' ? 121 : 131));
  assert.doesNotThrow(()=>guard('scroll-list'));
  assert.doesNotThrow(()=>guard('open-tools'));
  const dispatch = requestedOperation(definition.steps.find(step=>step.id === 'open-tools'),fixture.samples,definition.fixture);
  assert.deepEqual(dispatch,{op:'click',x:25,y:30});
  const result = retention();
  assert.equal(result.verdict,'PASS',result.reason);
  assert.deepEqual(result.actual.commits.map(item=>item.action),[
    'select-public-fixture','select-unchecked','select-novel','select-group',
  ]);
  assert.equal(result.actual.before.projected,83);
  assert.equal(focus().verdict,'PASS');
  fixture.samples.restored.nodes.at(-1).focused = false;
  assert.equal(focus().verdict,'FAIL');
  fixture.events.at(-1).payload.filterMatchesSaved = false;
  assert.equal(retention().verdict,'FAIL');
  fixture.samples['fixture-query-edited'].nodes[0].publicSourceToolsQueryMatches = false;
  assert.throws(()=>guard('scroll-list'),/select-public-fixture/u);
  fixture.samples['fixture-query-edited'].nodes[0].publicSourceToolsQueryMatches = true;
  fixture.samples['group-open'].nodes.find(node=>node.publicGroupOptionText).publicGroupOptionText = false;
  assert.throws(()=>guard('scroll-list'),/native novel group/u);
  fixture.samples['group-open'].nodes.find(node=>node.type === 'Text').publicGroupOptionText = true;
  fixture.events.find(event=>event.kind === 'source.projection' && event.payload.trigger === 'group').payload.projected = 14;
  assert.throws(()=>guard('scroll-list'),/sufficient stable rows/u);
});

test('source Tools return binds both route generations, the filtered baseline and actual row offset',()=>{
  const fixture = context();
  const result = evaluate('tool-return-filters',fixture);
  assert.equal(result.verdict,'PASS',result.reason);
  assert.equal(result.actual.sampleId,'restored');
  assert.equal(result.actual.nativeAnchorDeltaPx,0);
  for (const sample of ['filtered','scrolled','tools','restored']) {
    assert.ok(result.evidenceRefs.some(ref => ref.path === `raw/${sample}.png`));
  }
  fixture.events.at(-1).payload.offsetVp += 1.1 / 3.5;
  assert.equal(evaluate('tool-return-filters',fixture).verdict,'FAIL');
});

test('source Tools return rejects resetting any active filter and same-length query substitutions',()=>{
  const mutations = [
    {status:'all'},
    {category:'all'},
    {allGroups:true,groupIndex:0},
    {queryLength:0},
    {state:'empty',count:0,projected:0,firstAnchor:0},
  ];
  for (const mutation of mutations) {
    const fixture = context();
    Object.assign(fixture.events.at(-2).payload,mutation);
    assert.equal(evaluate('tool-return-filters',fixture).verdict,'FAIL',JSON.stringify(mutation));
  }
  const fixture = context();
  fixture.events.at(-1).payload.filterMatchesSaved = false;
  assert.equal(evaluate('tool-return-filters',fixture).verdict,'FAIL');
});

test('source Tools return distinguishes trusted anchor loss from missing causal observations',()=>{
  const fixture = context();
  fixture.events.pop();
  assert.equal(evaluate('tool-return-filters',fixture).verdict,'NOT_RUN');
  fixture.samples.restored.nodes = fixture.samples.restored.nodes.filter(node => node.id !== expectedAnchor);
  assert.equal(evaluate('tool-return-filters',fixture).verdict,'FAIL');
  fixture.events.pop();
  assert.equal(evaluate('tool-return-filters',fixture).verdict,'NOT_RUN');
  const duplicate = context();
  duplicate.events.splice(5,0,event(44,'source.route',duplicate.events[4].payload));
  assert.equal(evaluate('tool-return-filters',duplicate).verdict,'FAIL');
  const wrongInput = context();
  wrongInput.actions['open-tools'].targetId = 'reader-source-footer-tools';
  assert.equal(evaluate('tool-return-filters',wrongInput).verdict,'NOT_RUN');
  const stayedInTools = context();
  stayedInTools.events.splice(4);
  stayedInTools.samples.restored.nodes = stayedInTools.samples.tools.nodes;
  assert.equal(evaluate('tool-return-filters',stayedInTools).verdict,'FAIL');
  assert.equal(evaluate('tools-return-focus',stayedInTools).verdict,'FAIL');
  for (const endpoint of ['scrolled','tools','restored']) {
    const menuRetained = context();
    menuRetained.samples[endpoint].nodes.push(node('reader-source-group-panel','0/9'));
    assert.equal(evaluate('tool-return-filters',menuRetained).verdict,'FAIL',endpoint);
  }
});

test('source Tools return admits focus only on the live native button in the original entry',()=>{
  const fixture = context();
  const button = fixture.samples.restored.nodes.at(-1);
  const focus = () => evaluate('tools-return-focus',fixture);
  assert.equal(focus().verdict,'PASS');
  button.focused = false;
  assert.equal(focus().verdict,'FAIL');
  button.focused = null;
  assert.equal(focus().verdict,'NOT_RUN');
  button.focused = true;
  button.path = '0/9/0';
  assert.equal(focus().verdict,'FAIL');
});

test('source Tools return admits restored footer focus only on the dispatched native footer entry',()=>{
  const testCase = JSON.parse(readFileSync(new URL('../cases/source-management.footer-tools-return.json',import.meta.url)));
  const ready = testCase.steps.find(step => step.id === 'source-ready');
  const selection = testCase.steps.find(step => step.id === 'select-novel');
  assert.ok(ready.anchors.includes('reader-source-content'));
  assert.ok(!ready.anchors.includes('reader-source-empty-state'));
  const defaultCatalog = {
    'payload.state':'rows','payload.readFact':'current','payload.status':'all',
    'payload.groupIndex':0,'payload.allGroups':true,'payload.queryLength':0,
  };
  assert.deepEqual(ready.waitFor,[{kind:'source.projection',
    fields:{...defaultCatalog,'payload.category':'all'},channel:'business',match:'latest'}]);
  assert.deepEqual(selection.waitFor,[{kind:'source.projection',
    fields:{...defaultCatalog,'payload.trigger':'category','payload.category':'novel'},channel:'business'}]);
  const category = testCase.assertions.find(assertion => assertion.action === 'select-novel');
  assert.equal(category.expected.nativeSelection,true);
  const categoryClick = {op:'click',x:300,y:500};
  const categoryWitness = {assertionId:category.id,x:300,y:500,probeSeq:12};
  assert.deepEqual(sourceFilterNativeDispatch(testCase,selection,categoryClick,12),categoryWitness);
  const original = {...testCase,version:1,fixture:{...testCase.fixture,id:'public-source-footer-tools-v1'}};
  assert.deepEqual(sourceFilterNativeDispatch(original,selection,categoryClick,12),categoryWitness);
  assert.equal(sourceFilterNativeDispatch({...testCase,fixture:original.fixture},selection,categoryClick,12),undefined);
  const step = testCase.steps.find(step => step.id === 'open-tools');
  const assertion = testCase.assertions.find(assertion => assertion.kind === 'tools-return-focus');
  assert.deepEqual(step.target,sourceFooterToolsButton);
  const frame = '[0,0][1280,2832]';
  const windowRect = {left:0,top:0,width:1280/3.5,height:2832/3.5};
  const rawNode = (id,bounds,type,children = [],attributes = {}) => ({
    attributes:{id,bounds,origBounds:bounds,type,hostWindowId:'1',visible:'true',opacity:'1',enabled:'true',
      clickable:type === 'Button' ? 'true' : 'false',...attributes},children,
  });
  const native = (owner,footerFocused,{headerFocused = false,outside = false,count = 1} = {}) => {
    const footerButtons = Array.from({length:count},(_,index)=>rawNode(`source-back:${owner+index}:tools:footer`,
      '[67,2573][623,2727]','Button',[],{focused:String(footerFocused)}));
    const root = rawNode(null,frame,'root',[
      rawNode(sourceBack,'[70,161][224,315]','Button'),
      rawNode(`source-back:${owner}:tools:header`,'[1056,161][1210,315]','Button',[],{focused:String(headerFocused)}),
      rawNode('reader-source-footer','[0,2524][1280,2832]','Column',outside ? [] : footerButtons),
      ...(outside ? footerButtons : []),
    ],{bundleName:'io.reader.minliny',abilityName:'EntryAbility',pagePath:'pages/Index'});
    return normalizeHarmonyLayout({
      tree:rawNode(null,frame,'Stack',[root]),instanceId,windowId:'1',
      report:{vpPixels:3.5,windowId:'1',metrics:{ready:true,revision:14,densityPixels:3.5,windowRect,globalRect:windowRect,
        keyboardArea:{available:true,visible:false,rects:[]},keyboardInsets:{left:0,top:0,right:0,bottom:0}}},
    });
  };
  const fixture = context();
  const before = fixture.samples.scrolled;
  const positive = native(5,false);
  Object.assign(before,{nodes:positive.nodes,window:positive.window});
  const dispatched = requestedOperation(step,fixture.samples,testCase.fixture);
  assert.deepEqual(dispatched,{op:'click',x:345,y:2650});
  const journal = [{event:'command',ok:true,seq:1,args:['shell','uitest','uiInput','click','345','2650']}];
  assert.equal(requireActionDispatch(journal,1,dispatched).seq,1);
  assert.throws(()=>requestedOperation(step,{scrolled:native(5,false,{outside:true})},testCase.fixture),/missing/u);
  assert.throws(()=>requestedOperation(step,{scrolled:native(5,false,{count:2})},testCase.fixture),/ambiguous/u);
  fixture.actions['open-tools'].targetId = sourceFooterToolsButton.id;
  const evaluateReturn = returned => {
    const after = fixture.samples.restored;
    Object.assign(after,{nodes:returned.nodes,window:returned.window});
    return evaluateSource({...assertion,acceptedSources:assertion.sources},fixture);
  };
  assert.equal(evaluateReturn(native(7,true)).verdict,'PASS');
  assert.equal(evaluateReturn(native(7,false,{headerFocused:true})).verdict,'FAIL');
  assert.equal(evaluateReturn(native(7,true,{count:2})).verdict,'FAIL');
  assert.equal(evaluateReturn(native(7,true,{outside:true})).verdict,'FAIL');
});

function v9Context(view) {
  const fixture = currentContext();
  const groups = view === 'groups';
  const target = groups ? sourceHeaderToolsButton.id : sourceFooterToolsButton.id;
  const button = { ...node(`source-back:2:tools:${groups ? 'header' : 'footer'}`, groups ? '0/0/1/0' : '0/4/0', 'Button'),
    alias:target, clickable:true };
  const restored = fixture.samples.restored;
  fixture.samples.scrolled.nodes = fixture.samples.scrolled.nodes.filter(item=>item.alias !== sourceHeaderToolsButton.id).concat(button);
  restored.nodes = restored.nodes.filter(item=>item.alias !== sourceHeaderToolsButton.id).concat({...button,focused:true});
  if (!groups) for (const sample of [fixture.samples.scrolled,restored]) sample.nodes.push(node('reader-source-footer','0/4'));
  const popup = node('reader-source-v9-more-menu','0/5');
  fixture.samples['more-open'] = capture('more-open',134,[popup,{...node('reader-source-v9-open-groups','0/5/0','Button'),clickable:true}]);
  fixture.samples['v9-child'] = capture('v9-child',142,groups ? [node('reader-source-v9-groups','0/0')] :
    [node(sourceList,'0/1','List'),node('reader-source-v9-batch-dock','0/4')]);
  const settled = {outcomeSettled:true};
  fixture.actions['open-more'] = action('scrolled',131,133,'click',{...settled,targetId:target});
  fixture.actions['open-groups'] = action('more-open',137,140,'click',{...settled,targetId:'reader-source-v9-open-groups'});
  fixture.actions['open-batch'] = action('scrolled',137,140,'click',{...settled,targetId:target});
  fixture.actions['v9-back'] = action('v9-child',147,150,'keyEvent',{...settled,key:'Back'});
  fixture.samples.disabled = fixture.samples.unchecked;
  fixture.actions['select-disabled'] = {...fixture.actions['select-unchecked'],targetId:'reader-source-status-disabled'};
  fixture.actions['select-novel'].from = 'disabled';
  fixture.actions['select-group'].targetId = 'reader-source-group-option-2';
  fixture.actions['select-public-fixture'].inputLength = 12;
  fixture.samples['group-open'].nodes.find(item=>item.alias === 'reader-source-group-option-1').alias = 'reader-source-group-option-2';
  fixture.events = fixture.events.filter(item=>item.eventSeq < 128);
  for (const {kind,payload} of fixture.events) if (kind === 'source.projection') {
    if (payload.status === 'unchecked') payload.status = 'disabled';
    if (payload.groupIndex === 1) payload.groupIndex = 2;
    if (payload.queryLength === 3) payload.queryLength = 12;
  }
  const current = fixture.events.findLast(item=>item.kind === 'source.projection').payload;
  const entry = {owner:beforeOwner,revision:1,view};
  fixture.events.push(
    event(138,'source.scroll',{...scroll,trigger:'v9-list-enter'}),
    event(139,'source.v9-list-transition',{...entry,phase:'enter'}),
    event(148,'source.v9-list-transition',{...entry,phase:'return',filterMatchesDeparture:true}),
    event(149,'source.projection',{...current,trigger:'v9-return'}),
    event(151,'source.scroll',{...scroll,trigger:'v9-list-return',layoutMatchesSaved:true,filterMatchesSaved:true}),
  );
  return fixture;
}

for (const view of ['groups','batch']) test(`v9 ${view} Back requires the same opening, scroll and actual origin focus`,()=>{
  const leaf = view === 'groups' ? 'group' : 'batch';
  const contract = loadCase(`source-management.v9-${leaf}-return`);
  const fixture = v9Context(view);
  const evaluateProof = (proof, context = fixture) => {
    const assertion = contract.assertions.find(item=>item.kind === 'v9-list-return' && item.expected.proof === proof);
    return evaluateSource({...assertion,acceptedSources:assertion.sources},context);
  };
  for (const proof of ['position','focus']) {
    const result = evaluateProof(proof);
    assert.equal(result.verdict,'PASS',result.reason);
  }
  if (view === 'groups') {
    assert.doesNotThrow(()=>assertSourceToolsReturnAction(contract,{id:'open-groups'},fixture,{instanceId,eventSeq:137}));
    const substituted = structuredClone(fixture);
    substituted.samples['fixture-query-edited'].nodes[0].publicSourceToolsQueryMatches = false;
    assert.equal(evaluateProof('position',substituted).verdict,'FAIL');
  }
  const changed = structuredClone(fixture);
  const returned = changed.events.find(item=>item.payload.phase === 'return');
  returned.payload.filterMatchesDeparture = false;
  assert.equal(evaluateProof('position',changed).verdict,'FAIL','same-length filter substitution is rejected');
  returned.payload.filterMatchesDeparture = true;
  returned.payload.owner = afterOwner;
  assert.equal(evaluateProof('focus',changed).verdict,'FAIL','old Tools route remounts are not evidence of same-opening return');
  const unfocused = structuredClone(fixture);
  unfocused.samples.restored.nodes.find(item=>item.focused).focused = false;
  assert.equal(evaluateProof('focus',unfocused).verdict,'FAIL');
  assert.equal(evaluateProof('position',unfocused).verdict,'PASS');
  const offset = structuredClone(fixture);
  const measurement = offset.events.find(item=>item.payload.trigger === 'v9-list-return');
  measurement.payload.offsetVp += 1;
  assert.equal(evaluateProof('position',offset).verdict,'FAIL');
  offset.events = offset.events.filter(item=>item !== measurement);
  assert.equal(evaluateProof('position',offset).verdict,'NOT_RUN');
});

const sourcePage = new URL('../../../entry/src/main/ets/features/source/ui/SourceManagementPage.ets',import.meta.url);

test('v9 Source list focus executes through the production frame guard after child Back',()=>{
  const calls = [];
  const frames = [];
  let verifying = true;
  class Frame { constructor(_context,callback) { frames.push(callback); } }
  const Page = selectedProductionMethods(sourcePage,'SourceManagementPage',[
    'prepareV9ListReturn','onV9PaneChanged','observeV9ListEntry','completeV9ListReturn','endBatch',
    'cancelToolsReturnFocus','scheduleToolsReturnFocus','onToolsEntryFocused','toolsFocusId',
  ],{SourceListLayoutFrame:Frame,ReaderUIVerificationProbe:{enabled:()=>verifying}});
  function actor() {
    return Object.assign(new Page(),{
      mounted:true,appForeground:true,v9Pane:'list',batchMode:false,temporaryBackIdentity:'source-back:9',
      v9ListTransitionRevision:0,toolsFocusRevision:0,managementOpeningIsCurrent:()=>true,
      managementInputIsCurrent:()=>true,managementBackIsCurrent(id) { return this.mounted && id === this.temporaryBackIdentity; },
      readCurrentScroll:()=>({anchorId:'row',firstIndex:1}),currentFilterKey:()=> 'same',traceToolsReturnFocus() {},
      observeVerificationScroll:(trigger,_measure,saved)=>calls.push([trigger,saved?.anchorId]),
      observeV9ListTransition:(view,phase,revision)=>calls.push([view,phase,revision]),observeVerificationProjection() {},
      scheduleImportStatusReadyObservation() {},
      getUIContext:()=>({postFrameCallback() {},getFocusController:()=>({requestFocus:id=>calls.push(['focus',id])})}),
    });
  }
  const flush = () => { while (frames.length) frames.shift()(); };
  const groups = actor();
  groups.prepareV9ListReturn('groups');
  groups.v9Pane = 'groups'; groups.onV9PaneChanged();
  groups.v9Pane = 'group-detail'; groups.onV9PaneChanged();
  groups.v9Pane = 'groups'; groups.onV9PaneChanged();
  assert.deepEqual(calls,[['v9-list-enter',undefined],['groups','enter',1]]);
  groups.v9Pane = 'list'; groups.onV9PaneChanged();
  frames.shift()(); frames.shift()();
  groups.onToolsEntryFocused('source-back:9','header');
  flush();
  assert.deepEqual(calls.slice(2),[['groups','return',1],['v9-list-return','row'],['focus','source-back:9:tools:header']]);
  const batch = actor(); verifying = false;
  batch.prepareV9ListReturn('batch'); batch.batchMode = true; batch.observeV9ListEntry('batch');
  batch.endBatch();
  batch.cancelToolsReturnFocus('touch');
  flush();
  assert.equal(calls.filter(([kind])=>kind === 'focus').length,1,'new user input before the return frame prevents focus stealing');
  batch.prepareV9ListReturn('batch'); batch.batchMode = true; batch.observeV9ListEntry('batch');
  batch.endBatch();
  frames.shift()(); frames.shift()();
  batch.onToolsEntryFocused('source-back:9','footer');
  flush();
  assert.deepEqual(calls.at(-1),['focus','source-back:9:tools:footer']);
  const retired = actor();
  retired.prepareV9ListReturn('batch'); retired.batchMode = true; retired.observeV9ListEntry('batch');
  retired.endBatch(); retired.temporaryBackIdentity = 'source-back:10';
  flush();
  assert.equal(calls.filter(([kind])=>kind === 'focus').length,2,'retired page cannot request native focus');
});
