import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { actionArgs, requestedOperation, requireActionDispatch } from '../collectors/harmonyos/records.mjs';
import { sourceFilterScrollLanes, sourceFilterSwipeDispatch } from '../lib/source-filter-scroll.mjs';
import { evaluateSource } from '../lib/source.mjs';

const contract = JSON.parse(readFileSync(new URL('../cases/source-management.filter-selections.json',import.meta.url),'utf8'));
const window = {id:'sample-window',revision:4,source:'window-metrics',density:2,
  visibleRectPx:{left:0,top:0,width:400,height:700},keyboard:{visible:false}};
const evidenceRefs = [{path:'native.png'},{path:'native.json'}];
const owner = {mounting:1,generation:2};
const box = (left,top,width,height = 88) => ({left,top,width,height});
const native = (type,key,path,parentPath,rectPx,visibleRectPx = rectPx,properties = {}) => ({
  type,key,path,parentPath,rectPx,visibleRectPx,visible:true,enabled:true,opacity:1, ...properties,
});

function filterSample(lane, side) {
  const moved = side === 'after' ? lane : undefined;
  const status = moved === 'status' ? -44 : 0;
  const category = moved === 'category' ? -134 : 0;
  const statusTop = 100;
  const categoryTop = 208;
  const statusFrame = box(30,statusTop,330);
  const categoryFrame = box(30,categoryTop,330);
  function chip(prefix,id,path,key,left,top,width,scrollOffset,enabled = true) {
    const original = box(left + scrollOffset,top,width);
    const visibleLeft = Math.max(30,original.left);
    const visibleRight = Math.min(360,original.left + original.width);
    if (visibleRight <= visibleLeft) return [];
    const visible = box(visibleLeft,top,visibleRight - visibleLeft);
    const rowPath = path.slice(0,path.lastIndexOf('/'));
    return [native('__Common__',key + '0',path,rowPath,original,visible,{id:prefix + id}),
      native('Button',key + '1',path + '/0',path,original,visible,{enabled,clickable:enabled})];
  }
  const statusPrefix = 'reader-source-status-';
  const categoryPrefix = 'source-category-';
  const nodes = [
    native('Scroll','1','0/0','0',statusFrame,statusFrame,{id:'reader-source-status-filter',clip:true}),
    native('Row','2','0/0/0','0/0',box(30 + status,statusTop,374),statusFrame),
    ...chip(statusPrefix,'error','0/0/0/0','3',100,statusTop,100,status),
    ...chip(statusPrefix,'custom','0/0/0/1','4',290,statusTop,114,status,false),
    native('Scroll','5','0/1','0',categoryFrame,categoryFrame,{id:'reader-source-category-filter',clip:true}),
    native('Row','6','0/1/0','0/1',box(30 + category,categoryTop,464),categoryFrame),
    ...chip(categoryPrefix,'music','0/1/0/0','7',190,categoryTop,90,category),
    ...chip(categoryPrefix,'download','0/1/0/1','8',290,categoryTop,90,category),
    ...chip(categoryPrefix,'other','0/1/0/2','9',395,categoryTop,99,category),
  ];
  const before = side === 'before';
  return {sampleId:sourceFilterScrollLanes[lane][before ? 'baseline' : 'sample'],
    instanceId:'current',beforeSeq:before ? 4 : 10,afterSeq:before ? 5 : 11,
    captureComplete:true,window:structuredClone(window),evidenceRefs,nodes};
}

function fixture(lane) {
  const scope = sourceFilterScrollLanes[lane];
  const assertion = contract.assertions.find(row=>row.kind === 'filter-scroll' && row.expected.lane === lane);
  const before = filterSample(lane,'before');
  const after = filterSample(lane,'after');
  const step = contract.steps.find(row=>row.id === scope.action);
  const operation = requestedOperation(step,{[scope.baseline]:before},contract.fixture);
  const journal = [{event:'command',ok:true,seq:1,args:actionArgs(operation)}];
  const command = requireActionDispatch(journal,1,operation);
  const action = {op:'swipe',from:scope.baseline,targetId:scope.viewport,instanceId:'current',beforeSeq:5,afterSeq:8,
    filterLaneSwipe:sourceFilterSwipeDispatch(step,operation,command.seq)};
  const projection = {kind:'source.projection',channel:'business',instanceId:'current',eventSeq:3,
    payload:{owner,readFact:'current',readGeneration:2,count:107,projected:lane === 'status' ? 99 : 0,
      firstAnchor:lane === 'status' ? 2 : 0,filterRevision:4,groupIndex:0,queryLength:0,
      status:lane === 'status' ? 'unchecked' : 'error',category:'all',allGroups:true,
      state:lane === 'status' ? 'rows' : 'filteredEmpty'}};
  const context = {events:[projection],samples:{[scope.baseline]:before,[scope.sample]:after},actions:{[scope.action]:action}};
  return {journal,operation,before,after,context,action,projection,
    evaluate:()=>evaluateSource({...assertion,acceptedSources:assertion.sources},context)};
}

test('source filter horizontal swipe moves native chips within the same lane', () => {
  for (const [lane,distance,tail] of [['status',44,'reader-source-status-custom'],['category',134,'source-category-other']]) {
    const observed = fixture(lane).evaluate();
    assert.equal(observed.verdict,'PASS',observed.reason);
    assert.equal(observed.actual.distancePx,distance);
    assert.equal(observed.actual.gestureId,`${lane}-scroll`);
    assert.equal(observed.actual.gestureSampleId,sourceFilterScrollLanes[lane].sample);
    assert.equal(observed.actual.baselineSampleId,sourceFilterScrollLanes[lane].baseline);
    assert.equal(observed.actual.actionId,sourceFilterScrollLanes[lane].action);
    assert.equal(observed.actual.tail.id,tail);
    assert.equal(observed.actual.matchingChips.length,2);
    assert.equal(observed.actual.tail.before === null,lane === 'category');
  }
});

test('source filter horizontal swipe rejects visible tails without corresponding native translation', () => {
  const staticRow = fixture('status');
  staticRow.after.nodes.find(node=>node.key === '2').rectPx = staticRow.before.nodes.find(node=>node.key === '2').rectPx;
  assert.equal(staticRow.evaluate().verdict,'FAIL');
  const movingViewport = fixture('category');
  const viewport = movingViewport.after.nodes.find(node=>node.id === 'reader-source-category-filter');
  viewport.rectPx = viewport.visibleRectPx = box(30,210,330);
  assert.equal(movingViewport.evaluate().verdict,'FAIL');
  const wrongLane = fixture('category');
  wrongLane.after.nodes.find(node=>node.key === '2').rectPx.left += 10;
  assert.equal(wrongLane.evaluate().verdict,'FAIL');
  const stillClipped = fixture('category');
  stillClipped.after.nodes.find(node=>node.key === '91').visibleRectPx = box(261,208,88);
  assert.equal(stillClipped.evaluate().verdict,'FAIL');
  const unrelatedRow = fixture('status');
  unrelatedRow.after.nodes.find(node=>node.key === '31').rectPx.left += 6;
  assert.equal(unrelatedRow.evaluate().verdict,'FAIL');
});

test('source filter horizontal swipe requires the bound native action and current Source owner', () => {
  const wrongCommand = fixture('status');
  wrongCommand.journal[0].args[5] = '500';
  assert.throws(()=>requireActionDispatch(wrongCommand.journal,1,wrongCommand.operation),/Unexpected command/u);
  wrongCommand.action.filterLaneSwipe.toY += 3;
  assert.equal(wrongCommand.evaluate().verdict,'NOT_RUN');
  const mismatchedWindow = fixture('category');
  mismatchedWindow.after.window.revision += 1;
  assert.equal(mismatchedWindow.evaluate().verdict,'NOT_RUN');
  const fits = fixture('status');
  fits.before.nodes.find(node=>node.key === '2').rectPx.width = 330;
  assert.equal(fits.evaluate().verdict,'NOT_RUN');
  const wrongProjection = fixture('category');
  wrongProjection.context.events.push({...wrongProjection.projection,eventSeq:6,
    payload:{...wrongProjection.projection.payload,filterRevision:5,category:'music'}});
  assert.equal(wrongProjection.evaluate().verdict,'FAIL');
  const refreshed = fixture('category');
  refreshed.context.events.push({...refreshed.projection,eventSeq:6,
    payload:{...refreshed.projection.payload,readGeneration:3}});
  assert.equal(refreshed.evaluate().verdict,'NOT_RUN');
});
