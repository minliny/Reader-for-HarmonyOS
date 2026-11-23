import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { normalizeHarmonyLayout } from '../lib/layout.mjs';
import { sourceUnknownExpandSteps } from '../lib/source-unknown-expand.mjs';
import { conditionApplicability } from '../lib/receipt-conditions.mjs';
import { evaluateSource } from '../lib/source.mjs';

const roles = ['original-reconcile','original-continue','original-expand','unknown-reconcile','unknown-expand'];
const contracts = new Map(roles.map(role=>[role,JSON.parse(readFileSync(
  new URL(`../cases/source-management.${role}-target.json`,import.meta.url),'utf8'))]));
const owner = {mounting:1,generation:2};
const recovery = branch => ({branch,generation:7,busy:false,canReconcile:true,canContinue:branch === 'original'});

function box(id,bounds,children = [],type = 'Column',attributes = {}) {
  return {attributes:{id,bounds,origBounds:bounds,type,hostWindowId:'42',
    visible:'true',opacity:'1',enabled:'true',clickable:type === 'Button' ? 'true' : 'false',...attributes},children};
}

function assess(role,options = {}) {
  const contract = contracts.get(role);
  const [assertion,glyphAssertion] = contract.assertions;
  const branch = role.split('-')[0];
  const id = assertion.expected.target;
  const frame = {left:0,top:0,width:400,height:800};
  const text = box('','[266,211][298,229]',[],'Text');
  const control = box(id,'[260,200][304,244]',options.noGlyphNode ? [] : [text],'Button',options.control);
  const controls = options.absent ? [] : options.duplicate ? [control,structuredClone(control)] : [control];
  const tree = box('','[0,0][400,800]',[
    box('','[0,0][400,800]',[
      box('reader-source-back','[10,10][54,54]',[],'Button'),
      box('reader-source-list','[0,60][400,730]',[],'List'),
      box('reader-source-footer','[0,730][400,800]'),
      box('reader-source-pending-recovery','[12,100][388,300]',[
        box(`reader-source-${options.nativeBranch ?? branch}-recovery`,'[12,100][388,300]',controls,'Stack'),
      ],'Scroll'),
    ],'root',{bundleName:'io.reader.minliny',abilityName:'EntryAbility',pagePath:'pages/Index'}),
  ]);
  const sample = normalizeHarmonyLayout({tree,report:{windowId:'42',vpPixels:1,metrics:{
    ready:true,revision:2,densityPixels:1,systemFontScale:1,windowRect:frame,globalRect:frame,
    keyboardArea:{available:true,visible:false,rects:[],revision:2},keyboardInsets:{left:0,top:0,right:0,bottom:0},
  }},sampleId:assertion.sample,instanceId:'current',evidenceRefs:[{path:'native.json'},{path:'native.png'}]});
  Object.assign(sample.window,{fontScale:1,nativeFont:{followsSystemFontScale:true,effectiveScale:1,fpPixels:1,vpPixels:1,maxFontScale:2}});
  Object.assign(sample,{beforeSeq:10,afterSeq:11,captureComplete:options.complete ?? true});
  const event = (kind,eventSeq,payload,windowRevision = 2) => ({kind,eventSeq,payload,channel:'business',
    instanceId:'current',windowRevision,evidenceRefs:[{path:kind + '.json'}]});
  const label = {role:`recovery/${branch}/${role.split('-')[1]}`,utf16Length:2,startUtf16:0,endUtf16:2,complete:true,
    lines:[{start:0,end:2,leftPx:0,topPx:0,widthPx:25,heightPx:18,baselinePx:14}],
    rangeRects:[{leftPx:0,topPx:0,rightPx:25,bottomPx:18}],
    tailRects:[{leftPx:12,topPx:0,rightPx:options.clippedGlyph ? 36 : 25,bottomPx:18}]};
  const context = {
    samples:{[assertion.sample]:sample},
    actions:{[assertion.action]:{op:'click',targetId:'reader-settings-source-management',beforeSeq:1,afterSeq:3,
      instanceId:'current',evidenceRefs:[{path:'route-action.json'}]}},
    events:[
      event('source.route',2,{action:'open',from:'settings',to:'source',...owner,previousGeneration:1}),
      event('source.projection',4,{owner,readFact:'current',state:'recovery',recovery:recovery(branch),
        textProjectionRevision:3,readGeneration:2,filterRevision:1,...options.projection}),
      ...(options.noTitle ? [] : [event('source.recovery-title',5,{owner,branch,generation:7,title:'clipped',
        ...options.title},options.titleRevision)]),
      ...(options.noGlyph ? [] : [event('source.surface-text-layout',6,{scope:'operation-recovery',owner,
        branch,generation:7,textProjectionRevision:3,readGeneration:2,filterRevision:1,windowRevision:2,
        widthVp:400,heightVp:800,density:1,systemFontScale:1,fontScale:1,labels:[label],...options.glyph})]),
    ],
  };
  const result = evaluateSource({...assertion,acceptedSources:assertion.sources},context);
  const applicability = conditionApplicability(assertion,context,result,contract);
  const glyph = evaluateSource({...glyphAssertion,acceptedSources:glyphAssertion.sources},context);
  return {result,applicability,glyph,glyphAssertion,context,contract};
}

test('Source recovery controls bind the current exact notice and native Button', () => {
  for (const role of roles) {
    const {result,applicability,glyph} = assess(role);
    assert.equal(result.verdict,'PASS',result.reason);
    assert.equal(result.actual.nativeTouchTarget.heightVp,44);
    assert.equal(applicability.status,'APPLIES');
    assert.equal(applicability.sampleApplies,true);
    assert.equal(glyph.verdict,'PASS',glyph.reason);
    assert.equal(glyph.actual.textScope,'operation-recovery');
    assert.equal(Object.values(glyph.actual.roles)[0].actual.tailCount,1);
    assert(result.evidenceRefs.some(({path})=>path === 'source.projection.json'));
    assert.equal(result.evidenceRefs.some(({path})=>path === 'source.recovery-title.json'),role.endsWith('expand'));
    const contract = contracts.get(role);
    if (role === 'unknown-expand') {
      assert.deepEqual(contract.steps,sourceUnknownExpandSteps);
    } else {
      assert.deepEqual(contract.steps.filter(({kind})=>kind === 'action').map(({target})=>target),
        ['reader-main-tab-settings','reader-settings-source-management']);
    }
  }
  for (const options of [
    {control:{bounds:'[260,200][304,243]'}},
    {control:{bounds:'[260,200][302,242]',origBounds:'[260,200][302,242]'}},
    {control:{enabled:'false'}},
    {control:{type:'Text'}},
    {absent:true},
    {duplicate:true},
    {nativeBranch:'unknown'},
  ]) {
    const {result,applicability} = assess('original-reconcile',options);
    assert.equal(result.verdict,'FAIL',result.reason);
    assert.equal(applicability.status,'APPLIES');
  }
});

test('Source recovery glyphs retain ineligible openings and reject stale owner, missing and clipped evidence', () => {
  for (const options of [{noGlyph:true},{glyph:{generation:8}},{glyph:{textProjectionRevision:2}}]) {
    const {result,applicability,glyph} = assess('original-reconcile',options);
    assert.equal(result.verdict,'PASS',result.reason);
    assert.equal(glyph.verdict,'NOT_RUN',glyph.reason);
    assert.equal(applicability.status,'APPLIES');
  }
  for (const options of [{noGlyphNode:true},{clippedGlyph:true}]) {
    const {result,applicability,glyph} = assess('unknown-reconcile',options);
    assert.equal(result.verdict,'PASS',result.reason);
    assert.equal(glyph.verdict,'FAIL',glyph.reason);
    assert.equal(applicability.status,'APPLIES');
  }
  const absent = assess('original-continue',{noGlyph:true,absent:true,
    projection:{recovery:{...recovery('original'),canContinue:false}}});
  assert.equal(absent.result.verdict,'NOT_RUN');
  assert.equal(absent.applicability.status,'DOES_NOT_APPLY');
});

test('Source recovery controls distinguish owner ineligibility from unavailable observations', () => {
  for (const [role,options] of [
    ['original-continue',{absent:true,projection:{recovery:{...recovery('original'),canContinue:false}}}],
    ['unknown-reconcile',{absent:true,projection:{recovery:{...recovery('unknown'),canReconcile:false}}}],
    ['original-reconcile',{control:{enabled:'false'},projection:{recovery:{...recovery('original'),busy:true}}}],
    ['unknown-expand',{absent:true,title:{title:'fits'}}],
    ['unknown-reconcile',{absent:true,projection:{recovery:recovery('original')}}],
    ['original-reconcile',{absent:true,projection:{state:'rows',recovery:undefined}}],
  ]) {
    const {result,applicability} = assess(role,options);
    assert.equal(result.verdict,'NOT_RUN',result.reason);
    assert.equal(applicability.status,'DOES_NOT_APPLY');
  }
  for (const [role,options] of [
    ['original-continue',{projection:{recovery:{...recovery('original'),canContinue:false}}}],
    ['unknown-expand',{title:{title:'fits'}}],
    ['unknown-reconcile',{projection:{recovery:{...recovery('unknown'),busy:true}}}],
    ['unknown-reconcile',{projection:{recovery:recovery('original')}}],
  ]) {
    const {result,applicability} = assess(role,options);
    assert.equal(result.verdict,'FAIL',result.reason);
    assert.equal(applicability.status,'APPLIES');
  }
  for (const options of [
    {complete:false},
    {noTitle:true},
    {titleRevision:1},
    {title:{owner:{...owner,generation:3}}},
    {title:{generation:6}},
    {title:{title:'unmeasured'}},
    {projection:{owner:{...owner,generation:3}}},
    {projection:{recovery:undefined}},
    {projection:{state:'loading',recovery:undefined}},
  ]) {
    const {result,applicability} = assess('original-expand',options);
    assert.equal(result.verdict,'NOT_RUN',result.reason);
    assert.equal(applicability.status,'UNKNOWN');
  }
});
