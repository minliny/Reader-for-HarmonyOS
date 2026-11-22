import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateLayout, normalizeHarmonyLayout } from '../lib/layout.mjs';
import { evaluateMotion } from '../lib/motion.mjs';
import { evaluateSource } from '../lib/source.mjs';
import { loadStructureDefinition, structureRuleOrder } from '../lib/structure-contract.mjs';
import { evaluateStructure } from '../lib/structure.mjs';
import { sampleReadiness } from '../collectors/harmonyos/records.mjs';

const full = '[0,0][360,800]';
const panelBox = '[10,0][350,280]';
const noPaint = '#00000000';

test('Source structure requires fixed carriers in front of the scrolled list', () => {
  const definition = loadStructureDefinition();
  const obligation = definition.scenarioObligations.find(item => item.caseId === 'source-management.scroll-return');
  const rule = definition.structureRules.find(item => item.id === obligation.states.shallow);
  const treeNode = (path,parentPath,id,zIndex,rectPx) => ({
    path,parentPath,id,zIndex,rectPx,visibleRectPx:rectPx,visible:true,opacity:1,
  });
  const viewport = {left:0,top:136,width:1280,height:2696};
  const header = {left:70,top:161,width:154,height:154};
  const footer = {left:0,top:2524,width:1280,height:308};
  const evaluate = zIndex => evaluateStructure(rule,{
    nodes:[
      treeNode('0',null,null,0,viewport),
      treeNode('0/0','0',null,zIndex,viewport),
      treeNode('0/0/0','0/0','reader-source-content',0,viewport),
      treeNode('0/0/0/0','0/0/0','reader-source-list',0,viewport),
      treeNode('0/1','0',null,10,header),
      treeNode('0/1/0','0/1','reader-source-back',0,header),
      treeNode('0/2','0',null,20,footer),
      treeNode('0/2/0','0/2','reader-source-footer',0,footer),
    ],
    window:{source:'window-metrics'},captureComplete:true,
  },definition.structureSelectors);
  assert.equal(evaluate(0).verdict,'PASS');
  assert.equal(evaluate(30).verdict,'FAIL','a native content branch drawn above both fixed carriers is a violation');
  assert.equal(evaluate(10).verdict,'NOT_RUN','matching z-indices do not establish paint order');
  assert.equal(evaluate(null).verdict,'NOT_RUN','missing z-index is missing evidence');
});

test('TTS overlay structure requires the Scroll and overlay under one native TTS viewport', () => {
  const definition = loadStructureDefinition();
  const obligation = definition.scenarioObligations.find(item=>item.caseId === 'reading.control-tts-temporary');
  const rule = definition.structureRules.find(item=>item.id === obligation.states['open-layer-state']);
  const rect = {left:10,top:100,width:340,height:650};
  const treeNode = (id,path,parentPath,fields = {}) => ({
    id,path,parentPath,visibleRectPx:rect,visible:true,opacity:1,enabled:true,...fields,
  });
  const viewport = treeNode('reader-control-tts-viewport','0/0','0',{type:'Stack',clip:true});
  const scroll = treeNode('reader-control-module-tts','0/0/0','0/0',{type:'Scroll',enabled:false});
  const wrapper = treeNode(null,'0/0/1','0/0');
  const overlay = treeNode('reader-control-tts-overlay','0/0/1/0','0/0/1');
  const collapse = treeNode('reader-control-collapse','0/1','0',{enabled:false});
  const root = treeNode(null,'0',null);
  const evaluate = (variants = {}) => evaluateStructure(rule,{
    nodes:[root,viewport,variants.scroll ?? scroll,wrapper,variants.overlay ?? overlay,
      variants.collapse ?? collapse,...(variants.extra ?? [])],
    window:{source:'window-metrics'},captureComplete:true,
  },definition.structureSelectors);

  assert.equal(evaluate().verdict,'PASS');
  assert.equal(evaluate({overlay:{...overlay,path:'0/2',parentPath:'0'}}).verdict,'FAIL');
  assert.equal(evaluate({scroll:{...scroll,path:'0/2',parentPath:'0'}}).verdict,'FAIL');
  assert.equal(evaluate({collapse:{...collapse,enabled:true}}).verdict,'FAIL');
  assert.equal(evaluate({extra:[{...viewport,path:'0/2'}]}).verdict,'NOT_RUN');
});

function node(id, bounds, children = [], attributes = {}) {
  return {attributes: {
    id, bounds, origBounds:bounds, visible:'true', opacity:'1', zIndex:'0', hostWindowId:'8',
    backgroundColor:noPaint, hitTestBehavior:'HitTestMode.Transparent', type:'Stack', ...attributes,
  }, children};
}

function searchSample({
  keyboard = false, refactor = false, editor = true, paintedAlpha = '#FFFFFFFF', scrimAlpha = '#50000000',
  sourceRecovery = null, outsidePopup = false, popupOpacity = '1', captureComplete = true, enabled = 'true',
  popupClip = 'true', wrapperClip = 'false', wrapperPaint = noPaint,
  recoveryId = 'search-source-recovery', recoveryPaint = [],
} = {}) {
  const viewport = keyboard ? '[0,0][360,500]' : full;
  const shelf = node('shelf-list', viewport);
  const input = node(refactor ? 'search-editor-renamed' : 'search-editor', '[38,10][290,60]', [], {enabled});
  const bar = node('search-bar', '[16,4][344,72]', editor && !outsidePopup ? [input] : []);
  const panel = node('', panelBox, [bar], {backgroundColor:paintedAlpha, clip:popupClip});
  const front = node('', panelBox, refactor ? [node('', panelBox, [panel], {clip:'false'})] : [panel],
    {zIndex:'4', opacity:popupOpacity, clip:wrapperClip, backgroundColor:wrapperPaint});
  const shade = node('', viewport, [], {backgroundColor:scrimAlpha, hitTestBehavior:'HitTestMode.Default', zIndex:'1'});
  const source = sourceRecovery === null ? [] : [node('', viewport, [
    node(recoveryId, viewport),
  ], {zIndex:String(sourceRecovery)})];
  const paint = recoveryPaint.map(attributes => node('reader-library-search-recovery-scrim', viewport, [], {
    backgroundColor:'#50000000', hitTestBehavior:'HitTestMode.None', zIndex:'3', ...attributes,
  }));
  const surface = node('search-surface', viewport,
    [...source, refactor ? node('', viewport, [shade], {zIndex:'1'}) : shade, ...paint, front,
      ...(editor && outsidePopup ? [input] : [])]);
  const root = node('', full, [shelf, surface], {
    type:'root', bundleName:'io.reader.minliny', abilityName:'EntryAbility', pagePath:'pages/Index',
  });
  const dimensions = {left:0, top:0, width:360, height:800};
  const sample = normalizeHarmonyLayout({
    tree:node('', full, [root]), sampleId:keyboard ? 'ime-visible' : 'ime-hidden',
    instanceId:'current', windowId:'8', report:{
      vpPixels:1, windowId:'8', metrics:{
        ready:true, revision:1, windowRect:dimensions, globalRect:dimensions, densityPixels:1,
        keyboardArea:{available:true, visible:keyboard,
          rects:keyboard ? [{left:0, top:500, width:360, height:300}] : []},
        keyboardInsets:{top:0, left:0, right:0, bottom:keyboard ? 300 : 0},
      },
    }, evidenceRefs:[{path:'native-capture'}],
  });
  return {...sample, captureComplete};
}

const selectors = {
  shelf:{ids:['shelf-list']}, surface:{ids:['search-surface']},
  bar:{ids:['search-bar']}, editor:{ids:['search-editor']}, recovery:{ids:['search-source-recovery']},
  scrim:{under:'surface', role:'scrim'}, popup:{ancestorOf:'bar', role:'opaqueSurface'},
};
const rule = {id:'test.search-input', checks:[
  {kind:'present', node:'shelf'},
  {kind:'present', node:'editor'},
  {kind:'descendant', node:'editor', ancestor:'popup'},
  {kind:'backgroundAlpha', node:'popup', min:.98, max:1},
  {kind:'backgroundAlpha', node:'scrim', min:.2, max:.5},
  {kind:'inFrontOf', node:'popup', behind:'scrim'},
  {kind:'inFrontOf', node:'scrim', behind:'recovery', optionalBehind:true},
]};

test('V2 structure accepts IME window clipping and equivalent internal wrappers', () => {
  for (const keyboard of [true, false]) {
    assert.equal(evaluateStructure(rule, searchSample({keyboard}), selectors).verdict, 'PASS');
    const mapped = {...selectors, editor:{ids:['search-editor-renamed']}};
    const revised = evaluateStructure(rule, searchSample({keyboard, refactor:true}), mapped);
    assert.equal(revised.verdict, 'PASS');
    assert.equal(revised.observationsComplete, true);
  }
});

test('Empty bookshelf Search requires the real empty content and the shared input overlay', () => {
  const {structureRules,structureSelectors} = loadStructureDefinition();
  const rules = new Map(structureRules.map(rule=>[rule.id,rule]));
  const closure = structureRuleOrder('search.input-over-empty-bookshelf',rules);
  assert.deepEqual(closure.map(rule=>rule.id),[
    'bookshelf.empty-content','search.input-overlay','search.input-over-empty-bookshelf',
  ]);
  function fixture(keyboard) {
    const sample = searchSample({keyboard});
    const shelf = sample.nodes.find(node=>node.id === 'shelf-list');
    shelf.id = 'reader-bookshelf-empty-scroll';
    const bar = sample.nodes.find(node=>node.id === 'search-bar');
    bar.id = 'reader-bookshelf-search-bar';
    sample.nodes.find(node=>node.id === 'search-editor').id = 'reader-book-search-input';
    sample.nodes.find(node=>node.id === 'search-surface').id = 'reader-library-search-surface';
    function add(parent,id) {
      const path = `${parent.path}/${sample.nodes.filter(node=>node.parentPath === parent.path).length}`;
      sample.nodes.push({...parent,id,path,parentPath:parent.path,enabled:true});
    }
    add(bar,'reader-library-search-back');
    add(shelf,'reader-bookshelf-empty-title');
    add(shelf,'reader-bookshelf-import-entry');
    add(shelf,'reader-bookshelf-empty-search-entry');
    return sample;
  }
  const verdicts = sample => closure.map(rule=>evaluateStructure(rule,sample,structureSelectors).verdict);
  assert.deepEqual(verdicts(fixture(true)),['PASS','PASS','PASS']);
  assert.deepEqual(verdicts(fixture(false)),['PASS','PASS','PASS']);
  const detached = fixture(true);
  const searchAction = detached.nodes.find(node=>node.id === 'reader-bookshelf-empty-search-entry');
  searchAction.parentPath = detached.nodes.find(node=>node.id === 'reader-bookshelf-search-bar').path;
  assert.deepEqual(verdicts(detached),['FAIL','PASS','PASS']);
  const stillHasBook = fixture(false);
  stillHasBook.nodes.find(node=>node.id === 'reader-bookshelf-empty-title').bookCard = true;
  assert.deepEqual(verdicts(stillHasBook),['FAIL','PASS','PASS']);
  const overlayLost = fixture(true);
  overlayLost.nodes = overlayLost.nodes.filter(node=>node.id !== 'reader-book-search-input');
  assert.deepEqual(verdicts(overlayLost),['PASS','FAIL','PASS']);
});

test('V5 structure separates present-but-wrong content from missing capture and readback', () => {
  const examples = [
    [{editor:false}, 'FAIL', 'present'],
    [{outsidePopup:true}, 'FAIL', 'descendant'],
    [{sourceRecovery:3}, 'FAIL', 'inFrontOf'],
    [{sourceRecovery:0}, 'PASS', undefined],
    [{paintedAlpha:'#7FFFFFFF'}, 'FAIL', 'backgroundAlpha'],
    [{paintedAlpha:noPaint}, 'FAIL', 'backgroundAlpha'],
    [{paintedAlpha:noPaint, wrapperPaint:'#FFFFFFFF'}, 'FAIL', 'backgroundAlpha'],
    [{scrimAlpha:noPaint}, 'FAIL', 'backgroundAlpha'],
    [{popupOpacity:'0'}, 'FAIL', 'present'],
    [{scrimAlpha:''}, 'NOT_RUN', 'backgroundAlpha'],
  ];
  for (const [options, verdict, kind] of examples) {
    const actual = evaluateStructure(rule, searchSample(options), selectors);
    assert.equal(actual.verdict, verdict, `${JSON.stringify(options)}: ${actual.reason}`);
    assert.equal(actual.actual.checks.find(check => check.verdict !== 'PASS')?.specification.kind, kind);
  }
  const unavailable = evaluateStructure(rule, searchSample({captureComplete:false, editor:false}), selectors);
  assert.equal(unavailable.verdict, 'NOT_RUN');
  assert.equal(unavailable.observationsComplete, false);

  const wrongAndMissing = evaluateStructure(rule, searchSample({outsidePopup:true, scrimAlpha:''}), selectors);
  assert.equal(wrongAndMissing.verdict, 'FAIL');
  assert.equal(wrongAndMissing.observationsComplete, false);

  for (const options of [{paintedAlpha:''}, {popupClip:''}, {wrapperClip:'true'}]) {
    const assessment = evaluateStructure(rule, searchSample(options), selectors);
    assert.equal(assessment.verdict, 'NOT_RUN', `${JSON.stringify(options)}: ${assessment.reason}`);
    assert.equal(assessment.observationsComplete, false);
  }
});

test('Search structure reads separate recovery scrim paint without accepting ambiguous evidence', () => {
  const {structureSelectors} = loadStructureDefinition();
  const mapped = {...selectors, scrim:{...structureSelectors['search.scrim'], under:'surface'},
    recovery:structureSelectors['search.source-required']};
  const assess = options => evaluateStructure(rule, searchSample(options), mapped);
  const split = {sourceRecovery:2, recoveryId:'reader-bookshelf-search-sourceRequired',
    scrimAlpha:noPaint, recoveryPaint:[{}]};
  for (const recoveryId of ['reader-bookshelf-search-sourceRequired', 'reader-bookshelf-search-sourceLoadError']) {
    for (const keyboard of [false, true]) {
      assert.equal(assess({...split, recoveryId, keyboard}).verdict, 'PASS');
    }
    assert.equal(assess({...split, recoveryId, recoveryPaint:[{zIndex:'1'}]}).verdict, 'FAIL');
    assert.equal(assess({recoveryId, sourceRecovery:3}).verdict, 'FAIL');
  }
  assert.equal(assess({}).verdict, 'PASS');
  assert.equal(assess({...split, recoveryPaint:[{}, {}]}).verdict, 'NOT_RUN');
  assert.equal(assess({...split, recoveryPaint:[{backgroundColor:''}]}).verdict, 'NOT_RUN');
  assert.equal(assess({...split, recoveryPaint:[{hitTestBehavior:'HitTestMode.Default'}]}).verdict, 'NOT_RUN');
  assert.equal(assess({...split, scrimAlpha:'#50000000'}).verdict, 'NOT_RUN');
});

test('V5 structure keeps trustworthy nodes distinct from readiness for the next action', () => {
  const sample = searchSample({editor:false});
  const step = {anchors:['search-editor']};
  assert.match(sampleReadiness(step, sample), /anchors/u);
  assert.equal(sample.captureComplete, true);
  assert.equal(evaluateStructure(rule, sample, selectors).verdict, 'FAIL');
  assert.equal(sampleReadiness(step, searchSample()), null);
});

test('V5 structure requires the visible pending result region and its hosted list', () => {
  const {structureSelectors, structureRules} = loadStructureDefinition();
  const pending = structureRules.find(rule => rule.id === 'search.results-pending-region');
  const box = {left:14,top:80,width:330,height:420};
  const nativeNode = (id, path, parentPath, options = {}) => ({
    id,path,parentPath,visibleRectPx:box,visible:true,opacity:1,...options,
  });
  const surface = nativeNode('reader-library-search-surface','/surface',null);
  const region = nativeNode('reader-bookshelf-search-pending','/surface/pending',surface.path);
  const list = nativeNode('reader-search-result-list:1:1','/surface/pending/list',region.path);
  const sample = {captureComplete:true,window:{source:'window-metrics'}};
  const assess = nodes => evaluateStructure(pending,{...sample,nodes},structureSelectors);
  assert.equal(assess([surface,region,list]).verdict,'PASS');
  assert.equal(assess([surface]).verdict,'FAIL');
  assert.equal(assess([surface,{...region,visible:false},list]).verdict,'FAIL');
  assert.equal(assess([surface,region,{...list,parentPath:surface.path}]).verdict,'FAIL');
  assert.equal(assess([surface,{...region,opacity:null},list]).verdict,'NOT_RUN');
});

test('V5 structure requires the confirmed-empty heading inside the actual result list', () => {
  const {structureSelectors, structureRules} = loadStructureDefinition();
  const rule = structureRules.find(rule => rule.id === 'search.results-confirmed-empty');
  const box = {left:14,top:80,width:330,height:420};
  const nativeNode = (id, path, parentPath, properties = {}) => ({
    id,path,parentPath,visibleRectPx:box,visible:true,opacity:1,...properties,
  });
  const surface = nativeNode('reader-library-search-surface','/surface',null);
  const empty = nativeNode('reader-bookshelf-search-empty','/surface/empty',surface.path);
  const list = nativeNode('reader-search-result-list:1:2','/surface/empty/list',empty.path);
  const heading = nativeNode(null,'/surface/empty/list/heading',list.path,{alias:'reader-search-confirmed-empty-heading'});
  const assess = nodes => evaluateStructure(rule,{
    captureComplete:true,window:{source:'window-metrics'},nodes,
  },structureSelectors).verdict;
  assert.equal(assess([surface,empty]),'FAIL','the wrapper cannot establish rendered content');
  assert.equal(assess([surface,empty,list,heading]),'PASS');
  assert.equal(assess([surface,empty,list]),'FAIL');
  assert.equal(assess([surface,empty,list,{...heading,parentPath:empty.path}]),'FAIL');
  assert.equal(assess([surface,empty,{...list,parentPath:surface.path},heading]),'FAIL');
  assert.equal(assess([surface,empty,list,{...heading,visible:false}]),'FAIL');
  assert.equal(assess([surface,empty,list,{...heading,opacity:null}]),'NOT_RUN');
});

test('V5 structure distinguishes disabled, invisible and unknown interactive regions', () => {
  function acceptsEnabled(options, expectEnabled) {
    const checks = [{kind:'enabled', node:'editor', value:expectEnabled}];
    return evaluateStructure({...rule, checks}, searchSample(options), selectors);
  }
  assert.equal(acceptsEnabled({enabled:'true'}, true).verdict, 'PASS');
  assert.equal(acceptsEnabled({enabled:'false'}, false).verdict, 'PASS');
  assert.equal(acceptsEnabled({popupOpacity:'0'}, false).verdict, 'PASS');
  assert.equal(acceptsEnabled({editor:false}, false).verdict, 'PASS');
  assert.equal(acceptsEnabled({editor:false}, true).verdict, 'FAIL');
  assert.equal(acceptsEnabled({enabled:''}, false).verdict, 'NOT_RUN');
});

test('V6 structure and existing evaluators let definition errors escape', () => {
  const sample = searchSample();
  for (const check of [
    {kind:'inFront', node:'shelf'},
    {kind:'descendant', node:'bar', ancestor:'unknown'},
    {kind:'opacity', node:'scrim', min:.2, max:0},
  ]) {
    assert.throws(() => evaluateStructure({...rule, checks:[check]}, sample, selectors), /Unknown|Invalid/u);
  }
  assert.throws(() => evaluateLayout({kind:'visibleFractionTypo'}, {before:sample}), /Unknown layout relationship/u);
  const context = {actions:{}, samples:{}, events:[]};
  assert.throws(() => evaluateMotion({kind:'control-clsoe'}, context), /Unknown reading motion assertion/u);
  assert.throws(() => evaluateMotion({kind:'control-effect', expected:{effect:'keyboard-return'}}, context), /Unknown reading control effect/u);
  assert.throws(() => evaluateSource({kind:'routing', acceptedSources:['native-tree','app-owner']}, context),
    /Unknown source-management assertion/u);
});
