import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeHarmonyLayout } from '../lib/layout.mjs';
import { evaluateSource } from '../lib/source.mjs';

const box = (id,rect,children = [],type = 'Column',props = {}) => {
  const bounds = '[' + rect.slice(0,2).join(',') + '][' + rect.slice(2).join(',') + ']';
  return {attributes:{id,type,bounds,origBounds:bounds,hostWindowId:'42',opacity:'1',visible:'true',
    enabled:'true',clickable:type === 'Column' ? 'false' : 'true',...props},children};
};

test('Source native control evidence binds real chrome and distinguishes an unmeasured response extension', () => {
  const frame = [0,0,1280,2400];
  const back = box('reader-source-back',[60,80,214,234],[],'Button');
  const tools = box('source-back:2:tools:header',[1056,80,1210,234],[],'Button');
  const editor = box('reader-source-editor',[186,371,988,518],[],'TextInput');
  const inline = box('source-back:2:import:header',[1067,374,1207,514],[],'Button');
  const manage = box('source-back:2:tools:footer',[67,2173,623,2327],[],'Button');
  const add = box('source-back:2:import:footer',[658,2173,1214,2327],[],'Button');
  const window = box('',frame,[
    box('reader-native-slot:1',[0,0,1280,240],[back,box('reader-source-header-tools',[1056,80,1210,234],[tools])]),
    box('reader-source-list',[0,240,1280,2400],[box('reader-source-search',[67,367,1214,521],[editor,inline])],'List'),
    box('reader-source-footer',[0,2100,1280,2400],[manage,add]),
  ],'root',{bundleName:'io.reader.minliny',abilityName:'EntryAbility',pagePath:'pages/Index'});
  const owner = {generation:2,mounting:1};
  const route = {action:'open',from:'settings',to:'source',previousGeneration:1,...owner};
  const projection = {owner,readFact:'current',state:'rows',readGeneration:1,count:1,projected:1,
    filterRevision:1,groupIndex:0,queryLength:0,allGroups:true,status:'all',category:'all'};
  const event = (kind,eventSeq,payload) => ({kind,eventSeq,payload,channel:'business',instanceId:'current'});
  const evaluate = target => {
    const rect = {left:0,top:0,width:1280/3.5,height:2400/3.5};
    const sample = normalizeHarmonyLayout({
      tree:{attributes:{bounds:window.attributes.bounds},children:[window]},
      report:{windowId:'42',vpPixels:3.5,metrics:{ready:true,revision:1,densityPixels:3.5,windowRect:rect,globalRect:rect,
        keyboardArea:{available:true,visible:false,rects:[],revision:1},keyboardInsets:{left:0,top:0,right:0,bottom:0}}},
      sampleId:'source-ready',instanceId:'current',evidenceRefs:[{path:'test.json'},{path:'test.png'}],
    });
    Object.assign(sample,{beforeSeq:5,afterSeq:6,captureComplete:true});
    return evaluateSource({
      kind:'native-control-target',action:'open-sources',sample:'source-ready',expected:{target},
      acceptedSources:['native-tree','window-metrics','app-owner'],
    },{
      samples:{'source-ready':sample},actions:{'open-sources':{op:'click',
        targetId:'reader-settings-source-management',beforeSeq:1,afterSeq:3,instanceId:'current'}},
      events:[event('source.route',2,route),event('source.projection',4,projection)],
    });
  };
  for (const target of ['reader-source-back','reader-source-header-tools-button',
    'reader-source-footer-tools-button','reader-source-footer-add-button']) {
    const result = evaluate(target);
    assert.equal(result.verdict,'PASS',result.reason);
    assert.equal(result.actual.heightVp,44);
  }
  for (const [target,height] of [['reader-source-editor',42],['reader-source-search-import-button',40]]) {
    const result = evaluate(target);
    assert.equal(result.verdict,'NOT_RUN',result.reason);
    assert.equal(result.actual.heightVp,height);
    assert.match(result.reason,/extended response/u);
  }
  manage.attributes.bounds = '[67,2173][623,2326]';
  assert.equal(evaluate('reader-source-footer-tools-button').verdict,'FAIL');
  manage.attributes.bounds = manage.attributes.origBounds;
  window.children[2].attributes.opacity = '0';
  assert.equal(evaluate('reader-source-footer-add-button').verdict,'FAIL');
  window.children[2].attributes.opacity = '1';
  projection.owner = {...owner,generation:3};
  assert.equal(evaluate('reader-source-back').verdict,'NOT_RUN');
});
