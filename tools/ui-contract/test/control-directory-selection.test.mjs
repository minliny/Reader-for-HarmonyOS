import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { requestedOperation } from '../collectors/harmonyos/records.mjs';
import { normalizeHarmonyLayout } from '../lib/layout.mjs';
import { evaluateMotion } from '../lib/motion.mjs';

const contract = JSON.parse(readFileSync(new URL('../cases/reading.control-directory-chapter-select.json',import.meta.url),'utf8'));
const assertion = contract.assertions.at(-1);
const click = contract.steps.find(step=>step.id === assertion.action);
const {nativeId} = assertion.expected;
const instanceId = 'instance';
const readingId = 'reading-1';
const localChapter = {fromChapterIndex:0,chapterIndex:1,selectionToken:4,openRevision:2,epoch:7};

const box = (id,type,bounds,children = [],attrs = {}) => ({
  attributes:{id,type,bounds,origBounds:bounds,hostWindowId:'42',visible:'true',opacity:'1',enabled:'true',
    clickable:'false',...attrs},
  children,
});

function state(sampleId,seq,nodes) {
  const bounds = '[0,0][400,800]';
  const rect = {left:0,top:0,width:400,height:800};
  const root = box('','root',bounds,nodes,{bundleName:'io.reader.minliny',abilityName:'EntryAbility',pagePath:'pages/Index'});
  const sample = normalizeHarmonyLayout({tree:box('','Window',bounds,[root]),report:{windowId:'42',vpPixels:1,
    metrics:{ready:true,revision:2,densityPixels:1,windowRect:rect,globalRect:rect,
      keyboardArea:{available:true,visible:false,rects:[],revision:2},keyboardInsets:{left:0,top:0,right:0,bottom:0}}},
    sampleId,instanceId,evidenceRefs:[{path:sampleId+'.json'}]});
  return {...sample,captureComplete:true,beforeSeq:seq,afterSeq:seq+1};
}

function evidence(options = {}) {
  const stage = box('reader-reading-stage','Stack','[0,0][400,800]');
  const chapter = box(nativeId,options.carrier ?? 'Row','[20,155][300,199]',[],{clickable:'true',...options.row});
  const row = box('','ListItem','[12,150][390,205]',[box('','Row','[12,150][390,205]',[chapter])]);
  const list = box('','List','[12,95][390,725]',options.foreign ? [] : [row]);
  const directory = box('reader-control-module-directory','Stack','[0,70][400,775]',[
    box('reader-control-directory-body-directory','Stack','[0,85][400,740]',[list]),
    ...options.foreign ? [row] : [],
  ]);
  const endpoint = [stage];
  if (options.retained) {
    const dock = box('reader-control-motion-dock','Stack','[0,70][400,775]',
      options.unrelatedDock ? [] : [directory],
      {opacity:'0.000866',enabled:'false',hitTestBehavior:'HitTestMode.None',...options.retained});
    endpoint.push(dock);
  }
  if (options.unclosed || options.unrelatedDock) endpoint.push(directory);
  const event = (eventSeq,kind,payload) => ({kind,eventSeq,instanceId,channel:'business',
    payload:{readingId,...payload},evidenceRefs:[{path:kind+'.json'}]});
  const effect = (eventSeq,phase,facts) => event(eventSeq,'reading.control-effect',{kind:'directory-selection',phase,facts});
  const before = {openRevision:2,epoch:7};
  const accepted = {openRevision:2,epoch:8};
  const source = {level:'secondary',module:'directory',directoryTab:'directory',form:'full'};
  const target = {level:'hidden',module:'directory',directoryTab:'directory',form:'quick'};
  const request = {transitionId:'dismiss-1',direction:'dismiss',origin:'host-dismiss',before,accepted,source,target};
  const finish = {transitionId:'dismiss-1',direction:'dismiss',origin:'host-dismiss',target,state:{...accepted,level:'hidden'}};
  return {
    samples:{
      [assertion.baseline]:state(assertion.baseline,31,[stage,directory]),
      ...(options.noEndpoint ? {} : {[assertion.sample]:state(assertion.sample,60,endpoint)}),
    },
    actions:{
      'enter-reading':{beforeSeq:1,afterSeq:8,instanceId},
      [assertion.action]:{beforeSeq:34,afterSeq:45,instanceId,op:'click',from:assertion.baseline,targetId:nativeId,
        evidenceRefs:[{path:'commands.jsonl'}]},
    },
    events:[
      event(5,'reading.ready',{localBook:true,chapterIndex:options.start ?? 0}),
      event(35,'reading.control-transition-requested',{...request,...options.request}),
      ...options.noAdmission ? [] : [effect(36,'selection-admitted',{...localChapter,...options.admission})],
      ...options.duplicate ? [effect(37,'selection-admitted',localChapter)] : [],
      ...options.noCommit ? [] : [effect(43,'selection-committed',{...localChapter,matchingChapter:true,chapterStart:true,...options.commit})],
      event(49,'reading.control-transition-committed',{...finish,...options.finish}),
    ],
    candidate:{ownerSources:Object.fromEntries(assertion.expected.ownerSources.map(path=>[path,'a'.repeat(64)]))},
  };
}

test('Directory chapter selection binds a native row, its committed chapter and the normal dismissal', () => {
  for (const carrier of ['Row','Text']) {
    const context = evidence({carrier});
    assert.deepEqual(requestedOperation(click,context.samples,contract.fixture),{op:'click',x:160,y:177});
    const result = evaluateMotion(assertion,context);
    assert.equal(result.verdict,'PASS',JSON.stringify(result.actual.findings));
    assert.equal(result.observationsComplete,true);
    assert(result.evidenceRefs.some(ref=>ref.path === 'commands.jsonl'));
    assert(result.evidenceRefs.some(ref=>ref.path === 'reading.ready.json'));
  }
});

test('Directory chapter selection accepts a retained Directory only under its hidden inactive dock', () => {
  const hidden = evaluateMotion(assertion,evidence({retained:{}}));
  assert.equal(hidden.verdict,'PASS',JSON.stringify(hidden.actual.findings));
  assert.equal(hidden.observationsComplete,true);

  for (const options of [
    {retained:{opacity:'0.03'}},
    {retained:{enabled:'true'}},
    {retained:{hitTestBehavior:'HitTestMode.Default'}},
    {retained:{},unrelatedDock:true},
  ]) {
    const result = evaluateMotion(assertion,evidence(options));
    assert.equal(result.verdict,'FAIL',JSON.stringify(result.actual.findings));
    assert(result.actual.findings.some(finding=>finding.field === 'directory-reader-return' && !finding.missing));
  }
  for (const retained of [{opacity:undefined},{enabled:undefined},{hitTestBehavior:undefined}]) {
    const result = evaluateMotion(assertion,evidence({retained}));
    assert.equal(result.verdict,'NOT_RUN',JSON.stringify(result.actual.findings));
    assert(result.actual.findings.some(finding=>finding.field === 'directory-reader-return' && finding.missing));
  }
});

test('Directory chapter selection rejects stale, wrong or incomplete selection evidence', () => {
  for (const [options,field] of [
    [{start:1},'directory-starting-chapter'],
    [{foreign:true},'directory-native-chapter-row'],
    [{carrier:'Button'},'directory-native-chapter-row'],
    [{row:{enabled:'false'}},'directory-native-chapter-row'],
    [{admission:{fromChapterIndex:1}},'directory-chapter-admitted'],
    [{admission:{chapterIndex:2}},'directory-chapter-admitted'],
    [{duplicate:true},'directory-chapter-admitted'],
    [{commit:{selectionToken:3}},'directory-chapter-committed'],
    [{commit:{chapterStart:false},noEndpoint:true},'directory-chapter-committed'],
    [{request:{origin:'system-back'}},'directory-dismissal-request'],
    [{finish:{transitionId:'retired-dismiss'}},'directory-dismissal-commit'],
    [{unclosed:true},'directory-reader-return'],
  ]) {
    const result = evaluateMotion(assertion,evidence(options));
    assert.equal(result.verdict,'FAIL',JSON.stringify(result.actual.findings));
    assert(result.actual.findings.some(finding=>finding.field === field && !finding.missing));
  }
  for (const options of [{noAdmission:true},{noCommit:true},{noEndpoint:true}]) {
    const result = evaluateMotion(assertion,evidence(options));
    assert.equal(result.verdict,'NOT_RUN',JSON.stringify(result.actual.findings));
  }
});
