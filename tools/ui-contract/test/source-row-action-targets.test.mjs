import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {normalizeHarmonyLayout, selectLayoutNode} from '../lib/layout.mjs';
import {evaluateSource} from '../lib/source.mjs';
import {sourceVerificationRowActions} from '../../../entry/src/main/ets/features/source/ui/SourceManagementVerification.ts';

const [fixture] = JSON.parse(readFileSync(new URL(
  '../fixtures/source-row-actions/public-source.json', import.meta.url), 'utf8'));
const listId = 'reader-source-list';
const rowId = 'reader-source-row-7';
const detect = 'reader-source-row-detect-control';
const login = 'reader-source-row-login-control';
const readerWindow = '42';
const dimensions = '[0,0][1280,2832]';
const definition = JSON.parse(readFileSync(new URL('../cases/source-management.row-action-targets.json',import.meta.url),'utf8'));
const categoryId = 'reader-source-text-row-category';
const badgeId = 'reader-source-row-status-unchecked';

function actor(type, id, bounds, children = [], attributes = {}) {
  return {
    attributes:{type,id,hostWindowId:readerWindow,visible:'true',opacity:'1',enabled:'true',
      bounds,origBounds:bounds,...attributes},
    children,
  };
}

function caption(text) {
  return actor('Text','', '[180,390][440,530]', [], {originalText:text});
}

function sourceRow(id = rowId) {
  const button = (label, bounds) => actor('Button','',bounds,[
    actor('Text','',bounds,[],{originalText:label}),
  ],{clickable:'true'});
  return actor('Column',id,'[140,350][1130,760]',[
    caption(fixture.bookSourceName),
    caption(fixture.bookSourceUrl),
    button('检测','[690,550][844,704]'),
    button('登录','[870,550][1024,704]'),
  ]);
}

function observe({row = sourceRow(), rows = [row], list = listId, enabled = true, other = []} = {}) {
  const content = actor('List',list,'[100,220][1180,2550]',rows);
  const tree = {attributes:{bounds:dimensions},children:[
    actor('root','',dimensions,[content,...other],{bundleName:'io.reader.minliny',
      pagePath:'pages/Index',abilityName:'EntryAbility'}),
  ]};
  const report = {windowId:readerWindow,vpPixels:3.5,metrics:{ready:true,revision:1,densityPixels:3.5,
    windowRect:{left:0,top:0,width:1280/3.5,height:2832/3.5},
    globalRect:{left:0,top:0,width:1280/3.5,height:2832/3.5},
    keyboardArea:{available:true,visible:false,rects:[],revision:1},
    keyboardInsets:{left:0,top:0,right:0,bottom:0}}};
  return normalizeHarmonyLayout({tree,report,observeSourceRowActions:enabled});
}

test('source row actions alias only real buttons from the current public fixture row', () => {
  assert.equal(fixture.enabled,false);
  assert.equal(fixture.enabledExplore,false);
  assert.equal(fixture.loginUrl,fixture.bookSourceUrl+'login');
  assert.match(new URL(fixture.bookSourceUrl).hostname,/\.invalid$/u);
  const scope = {ancestors:[listId,rowId]};
  const measured = observe();
  for (const [id,left] of [[detect,690],[login,870]]) {
    const selected = selectLayoutNode(measured,{id,...scope});
    assert.equal(selected.type,'Button');
    assert.equal(selected.id,null);
    assert.equal(selected.enabled,true);
    assert.equal(selected.clickable,true);
    assert.deepEqual(selected.visibleRectPx,{left,top:550,width:154,height:154});
  }
  const normalized = JSON.stringify(measured);
  for (const caption of [fixture.bookSourceName, fixture.bookSourceUrl, fixture.loginUrl, '检测', '登录']) {
    assert.equal(normalized.includes(caption),false);
  }

  function hasNoAction(sample) {
    assert.equal(sample.nodes.some(node=>node.alias===detect || node.alias===login),false);
  }
  hasNoAction(observe({enabled:false}));
  hasNoAction(observe({list:'reader-other-list'}));
  hasNoAction(observe({row:sourceRow('reader-source-row-0')}));
  hasNoAction(observe({rows:[sourceRow(),sourceRow('reader-source-row-8')]}));
  const wrongSource = sourceRow();
  wrongSource.children[1].attributes.originalText = 'https://unrelated.invalid/';
  hasNoAction(observe({row:wrongSource}));
  const wrongWindow = sourceRow();
  wrongWindow.children[0].attributes.hostWindowId = '430';
  hasNoAction(observe({row:wrongWindow}));
  const otherRow = sourceRow();
  otherRow.children[0].attributes.originalText = fixture.bookSourceName+' different';
  const foreignFixture = actor('List','reader-other-list','[100,220][1180,2550]',[sourceRow('reader-source-row-10')]);
  hasNoAction(observe({row:otherRow,other:[foreignFixture]}));

  const notButton = sourceRow();
  notButton.children[3].attributes.type = 'Row';
  assert.throws(() => selectLayoutNode(observe({row:notButton}),{id:login,...scope}),/missing/u);
  const foreignLabel = sourceRow();
  foreignLabel.children[2].children[0].attributes.hostWindowId = 'other';
  assert.throws(() => selectLayoutNode(observe({row:foreignLabel}),{id:detect,...scope}),/missing/u);
  const ambiguous = sourceRow();
  ambiguous.children.push(structuredClone(ambiguous.children[2]));
  assert.throws(() => selectLayoutNode(observe({row:ambiguous}),{id:detect,...scope}),/ambiguous/u);

  const clipped = sourceRow();
  Object.assign(clipped.children[3].attributes,{bounds:'[870,550][1024,671]',enabled:'false'});
  const loginCarrier = selectLayoutNode(observe({row:clipped}),{id:login,...scope});
  assert.equal(loginCarrier.enabled,false);
  assert.equal(loginCarrier.rectPx.height,154);
  assert.equal(loginCarrier.visibleRectPx.height,121);
});

test('source row actions admit only the exact disabled public production row', ()=>{
  const source = {sourceId:fixture.bookSourceUrl,baseUrl:fixture.bookSourceUrl,name:fixture.bookSourceName,
    group:fixture.bookSourceGroup,category:'novel',loginUrl:fixture.loginUrl,
    enabled:fixture.enabled,enabledExplore:fixture.enabledExplore};
  const ready = sourceVerificationRowActions(source);
  assert.ok(Number.isSafeInteger(ready.anchor) && ready.anchor > 0);
  assert.equal(ready.checkState,'unchecked');
  assert.deepEqual(sourceVerificationRowActions({...source,checkState:'checking'}),
    {...ready,checkState:'checking'});
  for (const change of [{enabled:true},{enabledExplore:true},{category:'comic'},{loginUrl:undefined},{name:'Other'}]) {
    assert.equal(sourceVerificationRowActions({...source,...change}),undefined);
  }
});

function rowActionEvidence(description = '') {
  const row = sourceRow();
  row.children[3].attributes.id = 'reader-source-text-row-login';
  row.children.push(actor('Text',categoryId,'[180,570][300,700]',[],{originalText:'小说'}));
  row.children.push(actor('Stack',badgeId,'[520,580][604,643]',[
    actor('Path','','[541,590][583,632]'),
  ],{description}));
  const sample = {...observe({row}),captureComplete:true,beforeSeq:21,afterSeq:22,instanceId:'public-source-actions',
    evidenceRefs:[{path:'raw/current.png'},{path:'raw/current.json'}]};
  sample.window.fontScale = 1;
  sample.window.nativeFont = {effectiveScale:1,followsSystemFontScale:true,fpPixels:3.5,vpPixels:3.5,maxFontScale:2};
  const owner = {mounting:2,generation:4};
  const app = (kind,eventSeq,payload)=>({kind,eventSeq,instanceId:sample.instanceId,channel:'business',windowRevision:1,payload});
  const state = {owner,state:'rows',readFact:'current',count:1,projected:1,firstAnchor:7,rowActions:{anchor:7,checkState:'unchecked'},
    queryLength:0,groupIndex:0,allGroups:true,status:'all',category:'all',readGeneration:2,filterRevision:3,textProjectionRevision:4};
  const text = {owner,rowAnchor:7,windowRevision:1,density:3.5,systemFontScale:1,fontScale:1,
    readGeneration:2,filterRevision:3,textProjectionRevision:4,
    widthVp:1280/3.5,heightVp:2832/3.5,labels:['row/category','row/detect','row/login'].map(role=>({
      role,utf16Length:2,startUtf16:0,endUtf16:2,complete:true,
      lines:[{start:0,end:2,leftPx:2,topPx:2,widthPx:52,heightPx:70,baselinePx:62}],
      rangeRects:[{leftPx:2,topPx:2,rightPx:52,bottomPx:64}],
      tailRects:[{leftPx:34,topPx:2,rightPx:52,bottomPx:64}],
    }))};
  const context = {samples:{'source-ready':sample},
    actions:{'open-sources':{op:'click',targetId:'reader-settings-source-management',instanceId:sample.instanceId,
      beforeSeq:3,afterSeq:8}},events:[
      app('source.route',5,{...owner,previousGeneration:3,action:'open',from:'settings',to:'source'}),
      app('source.geometry',10,{owner,fontScale:1,expanded:false}),
      app('source.projection',12,state),
      app('source.text-layout',14,text),
    ]};
  const evaluate = kind => {
    const assertion = definition.assertions.find(item=>item.kind === kind);
    return evaluateSource({...assertion,acceptedSources:assertion.sources},context);
  };
  return {sample,text,state,evaluate};
}

test('source row actions bind native Login, Detect and category text to the exact unchecked public row', ()=>{
  assert.equal(definition.version,2);
  assert.deepEqual(definition.steps.filter(step=>step.kind === 'action').map(item=>item.target),
    ['reader-main-tab-settings','reader-settings-source-management']);
  const {sample,text,state,evaluate} = rowActionEvidence();
  const proof = evaluate('adaptation-text');
  assert.equal(proof.verdict,'PASS',proof.reason);
  assert.equal(proof.actual.sampleId,'source-ready');
  assert.equal(proof.actual.rowAnchor,7);
  assert.equal(proof.actual.textScope,'row-actions');
  assert.deepEqual(Object.keys(proof.actual.roles),['row/category','row/detect','row/login']);
  assert.ok(Object.values(proof.actual.roles).every(role=>role.actual.sampleId === 'source-ready' && role.actual.tailCount === 1));
  const loginPath = proof.actual.roles['row/login'].actual.path;
  const label = sample.nodes.find(node=>node.path === loginPath);
  const retained = label.visibleRectPx;
  label.visibleRectPx = {...retained,width:46};
  assert.equal(evaluate('adaptation-text').verdict,'FAIL');
  label.visibleRectPx = retained;
  const login = sample.nodes.find(node=>node.alias === 'reader-source-row-login-control');
  const originalPath = login.path;
  login.path = '0/9/1';
  assert.match(evaluate('adaptation-text').reason,/row\/login is outside/u);
  login.path = originalPath;
  text.labels.pop();
  assert.equal(evaluate('adaptation-text').verdict,'NOT_RUN');
  state.rowActions.checkState = 'checking';
  assert.equal(evaluate('adaptation-text').verdict,'NOT_RUN');
  assert.equal(evaluate('row-status-badge').verdict,'NOT_RUN');
});

test('source row actions measure the actual bounded status vector and keep accessibility readback distinct', ()=>{
  const {sample,state,evaluate} = rowActionEvidence();
  const badge = evaluate('row-status-badge');
  assert.equal(badge.verdict,'PASS',badge.reason);
  assert.equal(badge.actual.rowAnchor,7);
  assert.equal(badge.actual.sampleId,'source-ready');
  assert.equal(badge.actual.nativeAccessibilityState,null);
  const status = sample.nodes.find(node=>node.path === badge.actual.carrierPath);
  const vector = sample.nodes.find(node=>node.path === badge.actual.vectorPath);
  assert.equal(status.id,badgeId);
  assert.deepEqual([badge.actual.carrierPx.width,badge.actual.vectorPx.width],[84,42]);
  assert.equal(rowActionEvidence('未检查').evaluate('row-status-badge').actual.nativeAccessibilityState,'unchecked');
  const other = rowActionEvidence('检查失败');
  assert(!JSON.stringify(other.sample).includes('检查失败'));
  assert.equal(other.evaluate('row-status-badge').verdict,'FAIL');
  vector.visibleRectPx = {...vector.visibleRectPx,width:34};
  assert.equal(evaluate('row-status-badge').verdict,'FAIL');
  assert.equal(evaluate('adaptation-text').verdict,'PASS','Text proof and vector evidence remain independent');
  sample.nodes.splice(sample.nodes.indexOf(vector),1);
  assert.match(evaluate('row-status-badge').reason,/does not contain one native vector/u);
  state.rowActions.anchor = 8;
  assert.equal(evaluate('row-status-badge').verdict,'NOT_RUN');
});
