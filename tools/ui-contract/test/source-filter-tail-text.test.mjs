import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {selectedProductionMethods} from '../../lib/selected-production-methods.mjs';
import {actionArgs, requestedOperation, requireActionDispatch} from '../collectors/harmonyos/records.mjs';
import {sourceFilterTextCases, sourceFilterTextDragDispatch, sourceFilterTextLanes} from '../lib/source-filter-tail-text.mjs';
import {evaluateSource} from '../lib/source.mjs';

const owner = {mounting:1,generation:2};
const evidenceRefs = [{path:'raw/window.png'},{path:'raw/window.json'}];
const box = (left,top,width,height)=>({left,top,width,height});
const node = (type,key,path,parentPath,rectPx,visibleRectPx = rectPx,properties = {})=>({
  type,key,path,parentPath,rectPx,visibleRectPx,visible:true,opacity:1,enabled:true,...properties,
});
const roleNames = ['all','enabled','error','unchecked','custom'];
const lengths = [2,2,2,3,3];
const categoryRoles = ['all','novel','comic','music','download','external','other'];
const categoryLengths = [4,2,2,5,5,7,5];

function nativeCapture(width,offset,lane,rowWidth,oversized) {
  const viewport = box(67,500,width,217);
  const row = box(67-offset,500,rowWidth,217);
  const nodes = [node('Scroll','1','0/0','0',viewport,viewport,{id:`reader-source-${lane}-filter`,clip:true}),
    node('Row','2','0/0/0','0/0',row,viewport)];
  const scopeLeft = viewport.left;
  const scopeRight = viewport.left + width;
  const intersect = value=>{
    const left = Math.max(scopeLeft,value.left);
    return {...value,left,width:Math.max(0,Math.min(scopeRight,value.left+value.width)-left)};
  };
  const category = lane === 'category';
  const roles = category ? categoryRoles : roleNames;
  const units = category ? categoryLengths : lengths;
  for (const [index,role] of roles.entries()) {
    const left = row.left + (category ? [0,422,690,958,1410,1862,2468] : [0,434,868,1302,1834])[index];
    const nativeWidth = category ? [394,240,240,424,424,578,424][index] : index >= 3 ? 504 : 406;
    const width = role === oversized ? 1100 : nativeWidth;
    const carrier = box(left,502,width,214);
    const clipped = intersect(carrier);
    if (!clipped.width) continue;
    const textWidth = role === oversized ? 1010 : units[index]*(category ? 66 : 77);
    const text = box(left+Math.floor((width-textWidth)/2),551,textWidth,111);
    const wrapPath = '0/0/0/' + index;
    const carrierPath = wrapPath + '/0';
    const id = (category ? 'source-category-' : 'reader-source-status-') + role;
    nodes.push(node('__Common__',String(10+index),wrapPath,'0/0/0',carrier,clipped,{id}),
      node('Button',String(20+index),carrierPath,wrapPath,carrier,clipped,{enabled:role !== 'custom'}),
      node('Text',String(30+index),carrierPath+'/0',carrierPath,text,intersect(text)));
  }
  return nodes;
}

function label(index,lane = 'status',width) {
  const category = lane === 'category';
  const role = (category ? categoryRoles : roleNames)[index];
  const length = (category ? categoryLengths : lengths)[index];
  const end = width ?? length * (category ? 66 : 77);
  const range = (start,end)=>({leftPx:start,topPx:0,rightPx:end,bottomPx:108});
  return {role:lane + '/' + role,utf16Length:length,startUtf16:0,endUtf16:length,complete:true,
    lines:[{start:0,end:length,leftPx:0,topPx:0,widthPx:end,heightPx:111,baselinePx:88}],
    rangeRects:[range(0,end)],tailRects:[range(end-66,end)]};
}

function fixture(width, options = {}) {
  const lane = options.lane ?? 'status';
  const category = lane === 'category';
  const id = Object.entries(sourceFilterTextCases).find(([,value])=>value.widthVp === width && value.lane === lane)[0];
  const contract = JSON.parse(readFileSync(new URL(`../cases/${id}.json`,import.meta.url),'utf8'));
  const [assertion] = contract.assertions;
  const actualWidth = width === 320 ? 1120 : 1280;
  const viewportWidth = actualWidth-133;
  const layout = box(0,0,actualWidth,2478);
  const window = {id:'current-window',revision:11,density:3.5,source:'window-metrics',orientation:'portrait',
    fontScale:2,nativeFont:{effectiveScale:2,followsSystemFontScale:true,maxFontScale:2},keyboard:{visible:false},
    rectPx:layout,visibleRectPx:layout};
  const scope = {owner,readGeneration:3,filterRevision:5,textProjectionRevision:9,rowAnchor:12,windowRevision:11,
    density:3.5,systemFontScale:2,fontScale:2,widthVp:actualWidth/3.5,heightVp:2478/3.5};
  const projection = {owner,readGeneration:3,filterRevision:5,textProjectionRevision:9,state:'rows',readFact:'current',
    firstAnchor:12,count:18,projected:18,queryLength:0,groupIndex:0,allGroups:true,status:'all',category:'all'};
  const event = (kind,eventSeq,payload)=>({kind,eventSeq,payload,instanceId:'current',channel:'business',windowRevision:11,evidenceRefs});
  const events = [event('source.route',3,{...owner,action:'open',from:'settings',to:'source',previousGeneration:1}),
    event('source.projection',4,projection),event('source.text-layout',5,{...scope,labels:[label(0,lane)]})];
  const samples = {};
  const actions = {'open-sources':{op:'click',targetId:'reader-settings-source-management',instanceId:'current',beforeSeq:2,afterSeq:6}};
  const rowWidth = category ? 2892 : 2338;
  const {slices,endpoints} = sourceFilterTextLanes[lane];
  const travel = Math.floor((.85-endpoints[width])*viewportWidth);
  const offsets = options.offsets ?? slices.map((_,index)=>Math.min(index*travel,rowWidth-viewportWidth));
  const journals = [];
  const roles = category ? categoryRoles : roleNames;
  for (const [index,{sample,action}] of slices.entries()) {
    const sequence = 10+index*10;
    samples[sample] = {instanceId:'current',beforeSeq:sequence,afterSeq:sequence+1,captureComplete:true,
      window:structuredClone(window),nodes:nativeCapture(viewportWidth,offsets[index],lane,rowWidth,options.oversized),evidenceRefs};
    const labels = roles.slice(1).map((role,index)=>label(index+1,lane,role === options.oversized ? 1010 : undefined));
    events.push(event('source.filter-text-layout',sequence-2,{...scope,lane,phase:index ? 'settled' : 'initial',
      revision:index+1,labels}));
    if (!index) continue;
    const step = contract.steps.find(item=>item.id === action);
    const operation = requestedOperation(step,samples,contract.fixture);
    const journal = [{seq:1,ok:true,event:'command',args:actionArgs(operation)}];
    const dispatch = requireActionDispatch(journal,1,operation);
    journals.push({journal,operation});
    actions[action] = {op:'drag',from:step.from,targetId:step.target,instanceId:'current',beforeSeq:sequence-7,
      afterSeq:sequence-2,filterTextDrag:sourceFilterTextDragDispatch(step,operation,dispatch.seq),evidenceRefs};
  }
  const context = {samples,actions,events};
  return {context,journals,evaluate:()=>evaluateSource({...assertion,acceptedSources:assertion.sources},context)};
}

test('source status tail text proves each fully visible label through real drag witnesses at both measured boundaries',()=>{
  for (const width of [320,366]) {
    const result = fixture(width).evaluate();
    assert.equal(result.verdict,'PASS',result.reason);
    assert.deepEqual(Object.keys(result.actual.roles),roleNames.map(role=>'status/'+role));
    assert.equal(result.actual.roles['status/error'].sample,'status-middle-first');
    assert.equal(result.actual.roles['status/unchecked'].sample,'status-middle-last');
    assert.equal(result.actual.roles['status/custom'].sample,'status-tail');
  }
});

test('source status tail text preserves glyph failures and keeps unobserved middle roles incomplete',()=>{
  const clipped = fixture(320);
  clipped.context.events.find(event=>event.eventSeq === 38).payload.labels.find(label=>label.role === 'status/custom')
    .tailRects[0].rightPx += 2;
  assert.equal(clipped.evaluate().verdict,'FAIL');
  const truncated = fixture(320);
  const error = truncated.context.events.find(event=>event.eventSeq === 18).payload.labels.find(label=>label.role === 'status/error');
  error.lines[0].end = error.endUtf16 = 1;
  assert.equal(truncated.evaluate().verdict,'FAIL');
  const onlyTail = fixture(320,{offsets:[0,1351,1351,1351]});
  const incomplete = onlyTail.evaluate();
  assert.equal(incomplete.verdict,'NOT_RUN');
  assert.ok(!Object.hasOwn(incomplete.actual.roles,'status/error'));
  const missingMiddle = fixture(320);
  missingMiddle.context.events.find(event=>event.eventSeq === 28).payload.labels =
    [1,2,4].map(index=>label(index));
  const result = missingMiddle.evaluate();
  assert.equal(result.verdict,'NOT_RUN');
  assert.equal(result.actual.roles['status/custom'].verdict,'PASS');
  assert.match(result.reason,/status\/unchecked/u);
});

test('source status tail text requires the current projection, true system font and exact original drag',()=>{
  const projection = fixture(366);
  projection.context.events.find(event=>event.eventSeq === 28).payload.textProjectionRevision -= 1;
  assert.equal(projection.evaluate().verdict,'NOT_RUN');
  const window = fixture(366);
  window.context.samples['status-middle-first'].window.nativeFont.followsSystemFontScale = false;
  assert.equal(window.evaluate().verdict,'NOT_RUN');
  const fixed = fixture(366);
  fixed.context.actions['scroll-status-third'].filterTextDrag.toX -= 3;
  assert.equal(fixed.evaluate().verdict,'NOT_RUN');
  const {journal,operation} = fixed.journals[0];
  journal[0].args[3] = 'swipe';
  assert.throws(()=>requireActionDispatch(journal,1,operation),/Unexpected command/u);
});

test('source status tail text producer scopes post-layout reads to the current opening and latest settle',()=>{
  const path = new URL('../../../entry/src/main/ets/features/source/ui/SourceManagementPage.ets',import.meta.url);
  const frames = [];
  const events = [];
  class SourceListLayoutFrame { constructor(_context,read) { this.read = read; } }
  const Page = selectedProductionMethods(path,'SourceManagementPage',[
    'filterTextLayoutOptions','scheduleVerificationFilterText',
  ],{SourceListLayoutFrame,ReaderUIVerificationProbe:{emit:(kind,_channel,data)=>events.push({kind,data})}});
  let projection = {owner,fontScale:2,widthVp:320,readGeneration:3,textProjectionRevision:1};
  let labels = [];
  const metrics = {readTracked:()=>labels,track:(role,text)=>({role,length:text.length})};
  const categoryMetrics = {readTracked:()=>[1,2,3,4,5,6].map(index=>label(index,'category'))};
  const page = Object.assign(new Page(),{verificationFilterTextMetrics:new Map([['status',metrics],['category',categoryMetrics]]),
    verificationFilterTextRevisions:new Map(),
    verificationTextLayoutScope:()=>projection,getUIContext:()=>({postFrameCallback:frame=>frames.push(frame)})});
  assert.deepEqual(page.filterTextLayoutOptions('status','unchecked','未检测'),{role:'status/unchecked',length:3});
  page.scheduleVerificationFilterText('status','initial');
  frames.shift().read();
  assert.equal(events.length,0);
  labels = [1,2,3,4].map(index=>label(index));
  frames.shift().read();
  assert.equal(events[0].data.phase,'initial');
  page.scheduleVerificationFilterText('status','settled');
  page.scheduleVerificationFilterText('status','settled');
  page.scheduleVerificationFilterText('category','settled');
  frames.shift().read();
  assert.equal(events.length,1);
  frames.shift().read();
  assert.equal(events[1].data.revision,3);
  assert.equal(events[1].kind,'source.filter-text-layout');
  frames.shift().read();
  assert.equal(events[2].data.lane,'category');
  assert.equal(events[2].data.revision,1);
  page.scheduleVerificationFilterText('status','settled');
  projection = {...projection,textProjectionRevision:2};
  frames.shift().read();
  assert.equal(events.length,3);
  projection = {...projection,fontScale:1.45};
  page.scheduleVerificationFilterText('status','initial');
  assert.equal(frames.length,0);
});

test('source category tail text proves all seven labels in the measured lane and terminal matrix sample',()=>{
  for (const width of [320,366]) {
    const result = fixture(width,{lane:'category'}).evaluate();
    assert.equal(result.verdict,'PASS',result.reason);
    assert.equal(result.actual.sampleId,'category-tail');
    assert.equal(result.actual.textScope,'category-filter');
    assert.equal(result.actual.nativeFont.followsSystemFontScale,true);
    assert.equal(result.actual.textProjectionRevision,9);
    assert.equal(result.actual.scale,2);
    assert.equal(result.actual.roles['category/other'].sample,'category-tail');
    assert.equal(result.actual.roles['category/other'].actual.sampleId,'category-tail');
    assert.equal(Object.keys(result.actual.roles).length,7);
    assert.equal(Object.keys(result.actual.sampleProofs).length,7);
    assert.ok(result.actual.roles['category/external'].actual.sampleId.startsWith('category-shift-'));
    assert.ok(result.actual.sampleProofs[result.actual.roles['category/external'].actual.sampleId]);
  }
});

test('source category tail text distinguishes a too-wide glyph range from an unobserved role',()=>{
  const oversized = fixture(320,{lane:'category',oversized:'external'});
  assert.equal(oversized.evaluate().verdict,'FAIL');
  assert.match(oversized.evaluate().reason,/wider than its entire native viewport/u);
  const absent = fixture(320,{lane:'category'});
  for (const event of absent.context.events.filter(event=>event.kind === 'source.filter-text-layout')) {
    event.payload.labels = event.payload.labels.filter(label=>label.role !== 'category/external');
  }
  assert.equal(absent.evaluate().verdict,'NOT_RUN');
  assert.match(absent.evaluate().reason,/category\/external/u);
});
