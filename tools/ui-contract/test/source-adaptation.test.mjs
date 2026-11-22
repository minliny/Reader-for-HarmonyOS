import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {READER_EXPANDED_MIN_WIDTH} from '../../../entry/src/main/ets/ui/foundation/ReaderWidthClass.ts';
import {stableNativeFontReadback} from '../collectors/harmonyos/records.mjs';
import {evaluateSourceAdaptationSurface, evaluateSourceAdaptationText} from '../lib/source-adaptation.mjs';
import {evaluateSource} from '../lib/source.mjs';
import {loadCase,phase1CaseIds,planCase} from '../lib/cases.mjs';
import {normalizeHarmonyLayout} from '../lib/layout.mjs';
import {publicReservedSourceHost,sourceReservedTypographyCase,sourceReservedTypographyFixture,
  sourceReservedTypographySample} from '../lib/source-reserved-typography.mjs';
import {SourceVerificationAnchors,sourceVerificationOpening,sourceVerificationReservedTypographyRow}
  from '../../../entry/src/main/ets/features/source/ui/SourceManagementVerification.ts';

function fixture({expanded = false, scale = 1.45} = {}) {
  const owner = {mounting:2,generation:8};
  const instanceId = 'public-source-layout';
  const density = 3.5;
  const widthVp = expanded ? 700 : 1280 / density;
  const revision = 17;
  const event = (kind,eventSeq,payload) => ({kind,eventSeq,payload,instanceId,channel:'business',windowRevision:revision,
    evidenceRefs:[{path:'session/commands.jsonl'}]});
  const node = (id,type,path,left,top,width,height) => {
    const rectPx = {left,top,width,height};
    return {id,type,path,rectPx,visibleRectPx:rectPx,visible:true,opacity:1};
  };
  const statsHeight = Math.round(18*scale*density);
  const statusY = 581 + statsHeight + 28;
  const groupX = expanded ? 680 : 60;
  const groupY = expanded ? statusY : statusY+214;
  const categoryY = expanded ? statusY+214 : groupY+181;
  const blockWidth = expanded ? 1420 : 1155;
  const statusWidth = expanded ? 550 : 1154;
  const groupWidth = expanded ? 790 : 1154;
  const nodes = [
    node('reader-source-filter-block','Column','0/0',60,339,blockWidth,categoryY+186-339),
    node('reader-source-search','Row','0/0/0',60,367,blockWidth,186),
    node('reader-source-editor','TextInput','0/0/0/0',186,371,825,179),
    node('reader-source-stats','Text','0/0/1',60,581,blockWidth,statsHeight),
    node('reader-source-status-filter','Scroll','0/0/2',60,statusY,statusWidth,186),
    node('reader-source-status-all',null,'0/0/2/0',60,statusY+2,294,182),
    node(null,'Button','0/0/2/0/0',60,statusY+2,294,182),
    node(null,'Text','0/0/2/0/0/0',150,statusY+52,112,81),
    node('reader-source-group-filter','Row','0/0/3',groupX,groupY,groupWidth,154),
    node(null,'Text','0/0/3/0',groupX+95,groupY+29,133,96),
    // Real native groups can round the right edge one pixel beyond their row.
    node('reader-source-group-trigger',null,'0/0/3/1',groupX+305,groupY,groupWidth-304,154),
    node(null,'Button','0/0/3/1/0',groupX+305,groupY,groupWidth-304,154),
    node(null,'Text','0/0/3/1/0/0',groupX+355,groupY+35,300,77),
    node('reader-source-category-filter','Scroll','0/0/4',60,categoryY,blockWidth,186),
    node('source-category-all',null,'0/0/4/0',60,categoryY+16,308,154),
    node(null,'Button','0/0/4/0/0',60,categoryY+16,308,154),
    node(null,'Text','0/0/4/0/0/0',60,categoryY+23,308,140),
    {...node('source-category-external','Button','0/0/4/1',1600,categoryY+16,219,154),
      visible:false,visibleRectPx:{left:1600,top:categoryY+16,width:0,height:154}},
  ];
  const context = {
    actions:{open:{op:'click',targetId:'reader-settings-source-management',instanceId,beforeSeq:10,afterSeq:14}},
    samples:{ready:{captureComplete:true,instanceId,beforeSeq:22,nodes,
      window:{density,revision,fontScale:scale,rectPx:{width:widthVp*density},keyboard:{visible:false}},
      evidenceRefs:[{path:'raw/real-screen.png'},{path:'raw/real-tree.json'}]}},
    events:[event('source.route',12,{...owner,previousGeneration:7,action:'open',from:'settings',to:'source'}),
      event('source.projection',15,{owner,state:'rows',readFact:'current',count:18,projected:18,queryLength:0,
        groupIndex:0,allGroups:true,status:'all',category:'all'}),
      event('source.geometry',17,{owner,fontScale:scale,expanded})],
  };
  const assertion = {action:'open',sample:'ready',expected:{expanded,
    minWidthVp:Math.floor(widthVp),maxWidthVp:Math.ceil(widthVp),
    minFontScale:scale-.01,maxFontScale:scale+.01,statsLineHeightFp:18,tolerancePx:1}};
  const find = id => nodes.find(value => value.id === id);
  const evaluate = () => evaluateSourceAdaptationSurface(assertion,context);
  return {evaluate,context,find,nodes,assertion,event};
}

test('source adaptation tolerates only one pixel at the transparent footer window boundary', () => {
  const {context} = fixture();
  const original = loadCase('source-management.layout-font-maximum').assertions
    .find(assertion => assertion.kind === 'adaptation');
  const assertion = {...original, sample:'ready', action:'open', acceptedSources:['native-tree','app-owner']};
  context.events.find(event => event.kind === 'source.projection').payload.firstAnchor = 1;
  const {ready} = context.samples;
  ready.window.visibleRectPx = {left:0,top:137,width:1280,height:2695};
  const node = (id,type,path,parentPath,left,top,width,height,clickable = false) => {
    const rectPx = {left,top,width,height};
    return {id,type,path,parentPath,rectPx,visibleRectPx:{...rectPx},visible:true,opacity:1,enabled:true,clickable};
  };
  const carrier = {...node('reader-source-footer','Column','0/2','0',0,2507,1280,326),
    clip:false,backgroundAlpha:0,hitTestMode:'HitTestMode.Transparent'};
  carrier.visibleRectPx.height -= 1;
  const actionOne = node(null,'Button','0/2/0/0','0/2/0',67,2549,556,186,true);
  ready.nodes.push(node('reader-source-row-1','Column','0/1','0',66,1317,1147,452),
    node(null,'Button','0/1/0','0/1',66,1586,223,154,true),
    node(null,'Toggle','0/1/1','0/1',429,1621,154,84,true),
    carrier, node('reader-source-footer-row','Flex','0/2/0','0/2',67,2549,1147,186),
    actionOne, node(null,'Button','0/2/0/1','0/2/0',658,2549,556,186,true));
  const evaluated = evaluateSource(assertion, context);
  assert.equal(evaluated.verdict,'PASS');
  assert.equal(evaluated.actual.footerCarrierBottomExcessPx,1);
  for (const [label,mutate] of [
    ['two pixels', sample => { sample.nodes.find(n=>n.path===carrier.path).rectPx.height += 1; }],
    ['horizontal clipping', sample => { const box=sample.nodes.find(n=>n.path===carrier.path).rectPx; box.left -= 1; box.width += 1; }],
    ['opaque carrier', sample => { sample.nodes.find(n=>n.path===carrier.path).backgroundAlpha = 1; }],
    ['different window boundary', sample => { sample.window.visibleRectPx.height += 1; }],
    ['child action clipped by one pixel', sample => { sample.nodes.find(n=>n.path===actionOne.path).visibleRectPx.height -= 1; }],
    ['row clipped by one pixel', sample => { sample.nodes.find(n=>n.id==='reader-source-row-1').visibleRectPx.height -= 1; }],
    ['footer action below the existing minimum', sample => {
      const node = sample.nodes.find(n=>n.path===actionOne.path);
      node.rectPx.height = node.visibleRectPx.height = 150;
    }],
  ]) {
    const changed = structuredClone(context);
    mutate(changed.samples.ready);
    assert.equal(evaluateSource(assertion, changed).verdict,'FAIL',label);
  }
});

test('source mount establishes the temporary Back owner before projecting current input', async () => {
  const {selectedProductionMethods} = await import('../../lib/selected-production-methods.mjs');
  const source = new URL('../../../entry/src/main/ets/features/source/ui/SourceManagementPage.ets',import.meta.url);
  const Page = selectedProductionMethods(source,'SourceManagementPage',
    ['aboutToAppear','managementOpeningIsCurrent','managementBackIsCurrent','sourceActionEnabled'],
    {sourceTemporaryGeneration:0,copySourceManagementScroll:()=>undefined,registerReaderFonts:()=>{}});
  for (const inputEnabled of [true,false]) {
    const observations = [];
    const page = new Page();
    Object.assign(page,{
      textLayoutOptions:()=>undefined,temporaryBackIdentity:'',toolsFocusRevision:0,operation:{},
      appForeground:true,inputEnabled,groupOpen:false,
      onGeometryInputsChanged:()=>{},getUIContext:()=>({getFont:()=>undefined}),
      rebuildSourceProjection(trigger) { observations.push({trigger,identity:this.temporaryBackIdentity,ready:this.sourceActionEnabled()}); },
      feedbackIdentity:()=>'',onTemporaryBackBridge(_bridge, identity) { observations.push({bridge:identity}); },
      scheduleImportStatusReadyObservation:()=>{},
    });
    page.aboutToAppear();
    assert.match(page.temporaryBackIdentity,/^source-back:[1-9]\d*$/u);
    assert.deepEqual(observations,[{bridge:page.temporaryBackIdentity},
      {trigger:'mount',identity:page.temporaryBackIdentity,ready:inputEnabled}]);
  }
});

test('source adaptation aligns the authored footer carrier on the physical pixel grid', async () => {
  const {selectedProductionMethods} = await import('../../lib/selected-production-methods.mjs');
  const {pureModuleProbe} = await import('../../lib/ets-pure-module-probe.mjs');
  const {readerFoundationTokens} = await import('../../lib/reader-tokens-probe.mjs');
  const {ReaderRectVp,ReaderWindowMetricsSnapshot,readerInteractiveSafeBottom} =
    await import('../../../entry/src/main/ets/ui/foundation/ReaderWindowMetrics.ts');
  const source = new URL('../../../entry/src/main/ets/features/source/ui/SourceManagementPage.ets',import.meta.url);
  const floatingBar = new URL('../../../entry/src/main/ets/ui/layout/ReaderFloatingBarMetrics.ts',import.meta.url);
  const {readerFloatingBarBottomInset} = pureModuleProbe(readFileSync(floatingBar,'utf8'),
    'ReaderFloatingBarMetrics.ts',{readerInteractiveSafeBottom},['readerFloatingBarBottomInset']);
  const {TOK_SPACE_SM,TOK_SPACE_MD,TOK_SPACE_CONTROL_INLINE} = readerFoundationTokens;
  const density = 3.5;
  const metrics = new ReaderWindowMetricsSnapshot(new ReaderRectVp(0,0,1280/density,2832/density));
  metrics.densityPixels = density;
  metrics.gestureInsets.bottom = 28;
  const Page = selectedProductionMethods(source,'SourceManagementPage',
    ['actionBottomInset','footerActionHeight','footerFallbackHeight'],
    {TOK_SPACE_SM,TOK_SPACE_MD,TOK_SPACE_CONTROL_INLINE,readerFloatingBarBottomInset,
      ReaderWindowCoordinator:{metrics:() => metrics}});
  const page = new Page();
  page.readerWindowMetricsRevision = 1;
  const bottomBuilder = readFileSync(source,'utf8').match(/private bottomActionBar\([\s\S]*?\n  \}/u)?.[0] ?? '';
  assert.match(bottomBuilder,/\.constraintSize\(\{ minHeight: this\.layoutBudget\(\)\.footerHeight \}\)/u);
  assert.match(bottomBuilder,/\.margin\(\{ top: TOK_SPACE_SM, bottom: this\.actionBottomInset\(\) \}\)/u);
  for (const [widthPx,heightPx,controlHeight,stacked,bottomInset,expectedTotalPx] of [
    [1280,2832,50,false,28,315], // Archived 1.30×.
    [1280,2832,53,false,28,326], // Archived 1.45×.
    [1120,2478,48,false,28,308], // Current 320vp base height.
    [1120,2478,53,false,28,326],
    [1120,2478,53,true,28,546], // A stacked footer uses the same margin.
  ]) {
    metrics.windowRect.width = widthPx/density;
    metrics.windowRect.height = heightPx/density;
    metrics.gestureInsets.bottom = bottomInset;
    page.footerControlHeight = () => controlHeight;
    page.footerStacked = () => stacked;
    const actualBottom = page.actionBottomInset();
    const logicalHeight = page.footerActionHeight() + TOK_SPACE_SM + actualBottom;
    assert.ok(actualBottom >= bottomInset && (actualBottom - bottomInset)*density < 1);
    assert.equal(page.footerFallbackHeight(),logicalHeight);
    assert.ok(Math.abs(logicalHeight*density - expectedTotalPx) < 1e-10);
    assert.equal(Math.round(heightPx - logicalHeight*density) + Math.round(logicalHeight*density),heightPx);
  }
  page.footerControlHeight = () => 53;
  page.footerStacked = () => false;
  const nearlyFittedBottom = 326/density - 53 - TOK_SPACE_SM + 5e-14;
  metrics.gestureInsets.bottom = nearlyFittedBottom;
  assert.ok((53 + TOK_SPACE_SM + nearlyFittedBottom)*density > 326);
  assert.equal(page.actionBottomInset(),nearlyFittedBottom);
  for (const unavailableDensity of [0,-1,NaN,Infinity]) {
    metrics.densityPixels = unavailableDensity;
    assert.equal(page.actionBottomInset(),nearlyFittedBottom);
  }
  page.readerWindowMetricsRevision = -1;
  assert.equal(page.actionBottomInset(),TOK_SPACE_MD);
});

test('source adaptation surface keeps measured growth and legal compact/expanded flow with a clipped scroll tail', () => {
  for (const [expanded,scale] of [[false,1],[false,1.3],[false,1.45],[false,1.6],[false,2],[true,1.45]]) {
    const result = fixture({expanded,scale}).evaluate();
    assert.equal(result.verdict,'PASS',result.reason);
    assert.equal(result.actual.expanded,expanded);
    assert.equal(result.actual.statsMinimumVp,18*scale);
    assert.equal(result.actual.witnesses.groupTriggerLabel.fullyVisible,true);
    assert.equal(Object.hasOwn(result.actual.witnesses,'source-category-external'),false);
  }
});

test('source adaptation surface rejects missing, clipped, or overlapping controls and stale statistics scaling', () => {
  const examples = [
    ({nodes,find}) => nodes.splice(nodes.indexOf(find('reader-source-stats')),1),
    ({find}) => {
      const stats = find('reader-source-stats');
      stats.rectPx = stats.visibleRectPx = {...stats.rectPx,height:63};
    },
    ({find}) => {
      const head = find('source-category-all');
      head.visibleRectPx = {...head.rectPx,width:56};
    },
    ({nodes}) => {
      const groupLabel = nodes.find(node => node.path === '0/0/3/0');
      groupLabel.rectPx = groupLabel.visibleRectPx = {...groupLabel.rectPx,width:250};
    },
    ({find}) => { find('reader-source-editor').path = '0/1'; },
    ({find}) => {
      const category = find('reader-source-category-filter');
      category.rectPx = category.visibleRectPx = {...category.rectPx,top:600};
    },
  ];
  for (const mutate of examples) {
    const state = fixture();
    mutate(state);
    assert.equal(state.evaluate().verdict,'FAIL');
  }
});

test('source adaptation surface applies only to a full capture of the current selected width and font', () => {
  const examples = [
    ({context}) => { context.samples.ready.captureComplete = false; },
    ({context}) => { context.samples.ready.window.keyboard.visible = true; },
    ({context}) => { context.samples.ready.window.fontScale = 1.3; },
    ({context}) => { context.samples.ready.window.rectPx.width = 1120; },
    ({context}) => { context.events.at(-1).payload.owner = {mounting:3,generation:8}; },
    ({context}) => { context.events.at(-1).windowRevision = 16; },
    ({context}) => { context.events.at(-1).payload.expanded = true; },
    ({nodes,find}) => { nodes.push({...find('reader-source-stats'),path:'0/0/5'}); },
    ({find}) => { find('reader-source-stats').visibleRectPx = null; },
  ];
  for (const mutate of examples) {
    const state = fixture();
    mutate(state);
    assert.equal(state.evaluate().verdict,'NOT_RUN');
  }
});

test('source adaptation expanded needs the actual native width at the production boundary', () => {
  const contract = JSON.parse(readFileSync(new URL('../cases/source-management.layout-expanded.json',import.meta.url)));
  const widths = contract.assertions.filter(assertion => ['filter-layout','adaptation','adaptation-surface'].includes(assertion.kind));
  const evaluate = (assertion,widthVp) => {
    const {context} = fixture({expanded:true});
    const sample = context.samples.ready;
    sample.window.rectPx = {left:0,top:0,width:widthVp * sample.window.density,height:2832};
    return evaluateSource({...assertion,action:'open',sample:'ready',acceptedSources:assertion.sources},context);
  };
  for (const check of widths) {
    assert.equal(check.expected.minWidthVp,READER_EXPANDED_MIN_WIDTH,check.id);
    if (check.kind === 'adaptation') continue;
    assert.equal(evaluate(check,READER_EXPANDED_MIN_WIDTH-1).verdict,'NOT_RUN','owner expanded flag cannot admit a compact window');
    const boundary = evaluate(check,READER_EXPANDED_MIN_WIDTH);
    assert.equal(boundary.verdict,'PASS',boundary.reason);
  }
});

function textFixture(scale = 1.6) {
  const state = fixture({scale});
  const {context,nodes,event,assertion} = state;
  Object.assign(assertion,{kind:'adaptation-text',acceptedSources:['native-tree','window-metrics','app-owner']});
  const sample = context.samples.ready;
  const window = sample.window;
  window.rectPx = {left:0,top:0,width:1280,height:2832};
  window.visibleRectPx = {...window.rectPx};
  window.source = 'window-metrics';
  const projection = context.events.find(item => item.kind === 'source.projection').payload;
  Object.assign(projection,{readGeneration:4,filterRevision:7,firstAnchor:12,textProjectionRevision:1});
  nodes.find(node => node.path === '0/0/3/0').id = 'reader-source-text-group-label';
  const node = (id,type,path,left,top,width,height) => {
    const rectPx = {left,top,width,height};
    return {id,type,path,rectPx,visibleRectPx:{...rectPx},visible:true,opacity:1};
  };
  nodes.push(node('reader-source-footer','Column','0/1',0,2500,1280,332),
    node('reader-source-text-footer-manage',null,'0/1/0',60,2520,520,200),
    node(null,'Button','0/1/0/0',60,2520,520,200),
    node(null,'Text','0/1/0/0/0',200,2560,200,100),
    node('reader-source-text-footer-add',null,'0/1/1',680,2520,520,200),
    node(null,'Button','0/1/1/0',680,2520,520,200),
    node(null,'Text','0/1/1/0/0',800,2560,200,100));
  const roles = ['stats','status/all','category/all','group/label','footer/manage','footer/add'];
  const byRole = Object.fromEntries(roles.map((role,index) => {
    const utf16Length = [14,2,4,2,4,4][index];
    return [role,{role,utf16Length,startUtf16:0,endUtf16:utf16Length,complete:true,
      lines:[{start:0,end:utf16Length,leftPx:0,topPx:1,widthPx:67,heightPx:78,baselinePx:62}],
      rangeRects:[{leftPx:1,topPx:5,rightPx:65,bottomPx:61}],
      tailRects:[{leftPx:55,topPx:5,rightPx:65,bottomPx:61}]}];
  }));
  const text = event('source.text-layout',19,{owner:projection.owner,windowRevision:window.revision,
    textProjectionRevision:projection.textProjectionRevision,
    readGeneration:projection.readGeneration,filterRevision:projection.filterRevision,rowAnchor:projection.firstAnchor,
    density:window.density,widthVp:window.rectPx.width/window.density,heightVp:window.rectPx.height/window.density,
    fontScale:window.fontScale,systemFontScale:window.fontScale,labels:[...Object.values(byRole),{role:'row/title',complete:false}]});
  context.events.push(text);
  return {...state,text,byRole,evaluate:() => evaluateSourceAdaptationText(assertion,context)};
}

function narrowRowTextFixture(scale = 1.45) {
  const state = textFixture(scale);
  const {assertion,context,text,nodes} = state;
  const window = context.samples.ready.window;
  Object.assign(assertion.expected,{minWidthVp:319.6,maxWidthVp:320.4});
  window.rectPx = {left:0,top:0,width:1120,height:2478};
  window.visibleRectPx = {...window.rectPx};
  text.payload.widthVp = window.rectPx.width / window.density;
  text.payload.heightVp = window.rectPx.height / window.density;
  for (const node of nodes.filter(node => node.path === '0/1' || node.path.startsWith('0/1/'))) {
    const {width,left} = node.rectPx;
    node.rectPx = {...node.rectPx,top:node.rectPx.top-354,width:Math.min(width,1120-left)};
    node.visibleRectPx = {...node.rectPx};
  }
  return withFixedRowText(state);
}

function withFixedRowText(state) {
  const {assertion,text,nodes,byRole} = state;
  assertion.expected.rowLabels = true;
  const node = (id,type,path,left,top,width,height) => {
    const rectPx = {left,top,width,height};
    return {id,type,path,rectPx,visibleRectPx:{...rectPx},visible:true,opacity:1};
  };
  nodes.push(
    node('reader-source-row-12','Column','0/2',60,1360,1000,460),
    node('reader-source-text-row-category','Text','0/2/0',320,1401,120,91),
    node('reader-source-text-row-detect',null,'0/2/1',60,1604,180,154),
    node(null,'Button','0/2/1/0',60,1604,180,154),
    node(null,'Text','0/2/1/0/0',106,1634,116,90),
  );
  for (const role of ['row/category','row/detect']) {
    const label = structuredClone(byRole['status/all']);
    label.role = role;
    byRole[role] = label;
    text.payload.labels.push(label);
  }
  return state;
}

test('source supplemental E3 keeps the default and preserved reserved row separately verified', () => {
  const contract = loadCase(sourceReservedTypographyCase);
  const proof = contract.assertions.find(assertion => assertion.kind === 'reserved-row-typography');
  const check = {...proof,acceptedSources:proof.sources};
  assert.equal(phase1CaseIds.includes(contract.id),false);
  assert.equal(phase1CaseIds.length,136);
  assert.equal(contract.version,2);
  assert.equal(planCase(contract,'harmonyos').steps.filter(step => step.kind === 'sample').length,2);
  assert.equal(loadCase('source-management.layout-font-intermediate').steps.at(-1).waitFor[0].fields['payload.count'],1);

  const toggleKey = `reader-toggle:source-back:9:https://${publicReservedSourceHost}/:0`;
  function fromNativeTree(key, reservedQuery = publicReservedSourceHost) {
    const bounds = '[0,0][1280,2832]';
    const attributes = {hostWindowId:'65',visible:'true',enabled:'true',opacity:'1',bounds,origBounds:bounds};
    const box = {left:0,top:0,width:1280/3.5,height:2832/3.5};
    const tree = {attributes:{bounds},children:[{
      attributes:{...attributes,type:'root',bundleName:'io.reader.minliny',abilityName:'EntryAbility',pagePath:'pages/Index'},
      children:[{attributes:{...attributes,type:'Toggle',id:key,checkable:'true',checked:'false'},children:[]}],
    }]};
    const report = {windowId:'65',vpPixels:3.5,metrics:{ready:true,revision:18,densityPixels:3.5,
      windowRect:box,globalRect:box,keyboardArea:{available:true,visible:false,rects:[],revision:18}}};
    return normalizeHarmonyLayout({tree,report,sampleId:'reserved-row',instanceId:'public-source-layout',
      observeSourceDefaultFontToggle:true,publicReservedSourceQuery:reservedQuery}).nodes.find(node=>node.type === 'Toggle');
  }
  const actualToggle = fromNativeTree(toggleKey);
  assert.equal(actualToggle.id,null,'the normalized receipt never publishes the URL-bearing ID');
  assert.equal(actualToggle.publicReservedSourceNativeToggle,true);
  assert.equal(actualToggle.sourceDefaultFontToggleChecked,false);
  assert.equal(fromNativeTree(toggleKey.replace('01','02')).publicReservedSourceNativeToggle,false);
  assert.equal(Object.hasOwn(fromNativeTree(toggleKey,'ordinary-input'),'publicReservedSourceNativeToggle'),false);
  assert.equal(sourceReservedTypographySample({id:sourceReservedTypographyFixture},{id:'reserved-row'}),true);

  function observations({legacy = false} = {}) {
    const {context,event,text} = withFixedRowText(textFixture(1.3));
    context.fixture = legacy ? {id:sourceReservedTypographyFixture} : contract.fixture;
    const before = context.samples.ready;
    before.afterSeq = 23;
    Object.assign(before.window,{id:'normal-window',orientation:'portrait',
      nativeFont:{followsSystemFontScale:true,effectiveScale:1.3,maxFontScale:2}});
    const {instanceId} = before;
    context.samples['source-ready'] = before;
    const after = structuredClone(before);
    after.beforeSeq = 40;
    after.afterSeq = 41;
    after.window.revision = 18;
    after.nodes.forEach(node => { node.source = 'native-tree'; });
    after.nodes.find(node => node.id === 'reader-source-editor').publicReservedSourceQueryMatches = true;
    after.nodes.find(node => node.path === '0/2/1/0/0').publicReservedSourceIdleDetect = true;
    const nativeToggle = {...actualToggle,path:'0/2/2/0'};
    if (legacy) after.nodes.push(
      {id:'reader-source-public-toggle-fixture',path:'0/2/2',visible:true,opacity:1,source:'native-tree'});
    after.nodes.push(nativeToggle);
    context.samples['reserved-row'] = after;
    context.samples['reserved-query-edited'] = {instanceId,beforeSeq:34,afterSeq:35,
      window:{revision:17,keyboard:{visible:true}}};
    context.actions['open-sources'] = context.actions.open;
    context.actions['select-unchecked'] = {
      instanceId,op:'click',targetId:'reader-source-status-unchecked',from:'source-ready',beforeSeq:24,afterSeq:26,
    };
    context.actions['input-reserved-host'] = {
      instanceId,op:'inputText',targetId:'reader-source-editor',from:'reserved-query-ime',beforeSeq:29,afterSeq:33,
      inputLength:publicReservedSourceHost.length,
    };
    context.actions['hide-reserved-ime'] = {
      instanceId,op:'keyEvent',key:'Back',from:'reserved-query-edited',beforeSeq:36,afterSeq:38,
    };
    const {payload:original} = context.events.find(item=>item.kind === 'source.projection');
    const selected = {...original,status:'unchecked',filterRevision:8};
    const filtered = {...selected,trigger:'edit',projected:1,queryLength:publicReservedSourceHost.length,
      filterRevision:9,textProjectionRevision:3};
    const read = event('source.toggle',32,{owner:filtered.owner,phase:'ready',anchor:filtered.firstAnchor,
      filterRevision:9,readGeneration:filtered.readGeneration,enabled:false});
    const glyphs = event('source.text-layout',39,{...structuredClone(text.payload),filterRevision:9,textProjectionRevision:3,
      windowRevision:18,labels:text.payload.labels.filter(label=>['row/category','row/detect'].includes(label.role))});
    glyphs.windowRevision = 18;
    const geometry = context.events.find(item=>item.kind === 'source.geometry');
    context.events.push(event('source.projection',25,selected),event('source.projection',31,filtered),read,
      {...geometry,eventSeq:38,windowRevision:18},glyphs);
    return {context,read,after,filtered,glyphs,nativeToggle};
  }

  const current = observations();
  const result = evaluateSource(check,current.context);
  assert.equal(result.verdict,'PASS',result.reason);
  assert.deepEqual(Object.keys(result.actual.roles),['row/category','row/detect']);
  assert.deepEqual(result.actual.reservedRow,{catalogCount:18,projected:1,rowAnchor:12,status:'unchecked',checked:false});
  assert.equal(evaluateSource(check,observations({legacy:true}).context).verdict,'PASS');

  for (const [change,expected] of [
    [x => x.read.payload.anchor++, 'NOT_RUN'],
    [x => x.read.payload.enabled = true, 'FAIL'],
    [x => x.after.nodes.find(node => node.type === 'Toggle').sourceDefaultFontToggleChecked = true, 'FAIL'],
    [x => x.nativeToggle.publicReservedSourceNativeToggle = false, 'NOT_RUN'],
    [x => x.nativeToggle.path = '0/3/0', 'NOT_RUN'],
    [x => x.after.nodes.push({...x.nativeToggle,path:'0/2/3/0'}), 'NOT_RUN'],
    [x => x.after.nodes.find(node => node.type === 'TextInput').publicReservedSourceQueryMatches = false, 'FAIL'],
    [x => x.after.nodes.find(node => node.publicReservedSourceIdleDetect).publicReservedSourceIdleDetect = false, 'FAIL'],
    [x => x.filtered.count = 1, 'NOT_RUN'],
    [x => x.filtered.readGeneration++, 'NOT_RUN'],
    [x => x.glyphs.payload.filterRevision--, 'NOT_RUN'],
    [x => x.glyphs.eventSeq = 35, 'NOT_RUN'],
    [x => x.context.samples['reserved-query-edited'].window.revision = 18, 'NOT_RUN'],
    [x => x.context.samples['reserved-query-edited'].window.keyboard.visible = false, 'NOT_RUN'],
    [x => x.context.samples['source-ready'].window.id = 'another-window', 'NOT_RUN'],
  ]) {
    const observation = observations();
    change(observation);
    assert.equal(evaluateSource(check,observation.context).verdict,expected);
  }
});

test('source supplemental E3 production tracks the exact reserved glyphs after IME Back', async () => {
  const {selectedProductionMethods} = await import('../../lib/selected-production-methods.mjs');
  const url = `https://${publicReservedSourceHost}/`;
  const source = {sourceId:url,baseUrl:url,name:'Phase1 Source 01',group:'Phase1 Group A',category:'novel',
    enabled:false,enabledExplore:false,checkState:'unchecked'};
  const filters = [publicReservedSourceHost,'未检测','all','全部分组'];
  const matching = sourceVerificationReservedTypographyRow(1007,[source],...filters);
  assert.equal(matching,url);
  assert.equal(sourceVerificationReservedTypographyRow(1,[source],...filters),'');
  assert.equal(sourceVerificationReservedTypographyRow(1007,[source,source],...filters),'');
  assert.equal(sourceVerificationReservedTypographyRow(1007,[source],'Phase1','未检测','all','全部分组'),'');
  assert.equal(sourceVerificationReservedTypographyRow(1007,[source],publicReservedSourceHost,'全部','all','全部分组'),'');
  for (const wrong of [{baseUrl:'https://different.invalid/'},{enabled:true},{category:'comic'},{checkState:'checking'},
    {checkState:'passed'},{loginUrl:'https://different.invalid/'},{group:'Different'}]) {
    assert.equal(sourceVerificationReservedTypographyRow(1007,[{...source,...wrong}],...filters),'');
  }
  const callbacks = [];
  const observations = [];
  const window = {ready:true,densityPixels:3.5,systemFontScale:1.3,revision:13,
    windowRect:{width:1280/3.5,height:2832/3.5},keyboardArea:{available:true,visible:true}};
  const roles = ['row/category','row/detect'];
  const labels = roles.map(role => ({role,lines:[{}],rangeRects:[{}],tailRects:[{}],complete:true}));
  const Page = selectedProductionMethods(
    new URL('../../../entry/src/main/ets/features/source/ui/SourceManagementPage.ets',import.meta.url),
    'SourceManagementPage',['verificationTextLayoutScope','scheduleVerificationTextLayout',
      'verificationReservedTypographyRow','verificationRowTextId'],{
      SourceListLayoutFrame:class {
        constructor(_context, callback) { this.callback = callback; }
      },
      ReaderWindowCoordinator:{metrics:() => window},
      ReaderUIVerificationProbe:{enabled:() => true,emit:(...args) => observations.push(args)},
      SourceVerificationAnchors,sourceVerificationOpening,sourceVerificationReservedTypographyRow,
      SOURCE_RESERVED_TEXT_ROLES:roles,SOURCE_TEXT_ROLES:[...roles,'stats'],
    });
  const page = Object.assign(new Page(),{
    searchQuery:publicReservedSourceHost,statusValue:'未检测',categoryValue:'all',groupValue:'全部分组',
    verificationOpening:'[0,1,24,"source"]',verificationTextProjectionRevision:37,
    verificationFilterRevision:33,verificationReservedTextRowId:url,verificationTextRowId:'default-row',
    verificationTextFrameKey:'default-only',verificationReservedTextFrameKey:'',
    verificationTextOptions:() => {},verificationReservedTextMetrics:{readTracked:() => labels},
    viewportWidth:365.7,viewportHeight:770.3,groupOpen:false,groupClosing:false,
    operation:{readFacts:{fact:'current',generation:12}},projectedSources:[source],sources:Array(1007).fill(source),
    managementOpeningIsCurrent:() => true,verificationProjectionState:() => 'rows',fontScale:() => 1.3,
    getUIContext:() => ({postFrameCallback: frame => callbacks.push(frame.callback)}),
  });
  assert.equal(page.verificationRowTextId(url,'reader-source-text-row-category'),'reader-source-text-row-category');
  assert.equal(page.verificationRowTextId('other','reader-source-text-row-category'),'');
  assert.equal(page.verificationTextLayoutScope(),undefined,'the normal default probe stays outside the filtered scope');
  page.scheduleVerificationTextLayout(true);
  assert.equal(callbacks.length,0,'the reserved path waits for the current native IME Back');
  window.keyboardArea.visible = false;
  window.revision++;
  page.scheduleVerificationTextLayout(true);
  page.scheduleVerificationTextLayout(true);
  assert.equal(callbacks.length,1);
  callbacks.shift()();
  assert.equal(observations.length,1);
  const [kind,channel,measurement] = observations[0];
  assert.equal(kind,'source.text-layout');
  assert.equal(channel,'business');
  assert.equal(measurement.windowRevision,14);
  assert.equal(measurement.filterRevision,33);
  assert.equal(measurement.readGeneration,12);
  assert.equal(measurement.rowAnchor,SourceVerificationAnchors.identify(url));
  assert.deepEqual(measurement.labels,labels);
  assert.equal(page.verificationTextFrameKey,'default-only');
  window.revision++;
  page.scheduleVerificationTextLayout(true);
  page.searchQuery = '';
  callbacks.shift()();
  assert.equal(observations.length,1,'a retired filtered frame cannot publish stale glyphs');
});

test('source adaptation text binds all fixed labels at exact large scales and leaves row text unclaimed', () => {
  for (const scale of [1.6,2]) {
    const state = textFixture(scale);
    const proof = evaluateSource(state.assertion,state.context);
    assert.equal(proof.verdict,'PASS',proof.reason);
    assert.equal(proof.actual.scale,scale);
    assert.equal(Object.keys(proof.actual.roles).length,6);
    assert.equal(proof.actual.roles['footer/add'].actual.path,'0/1/1/0/0');
    assert.equal(proof.actual.roles['footer/add'].actual.tailCount,1);
    assert.ok(proof.evidenceRefs.some(ref => ref.path === 'session/commands.jsonl'));
  }
  const spare = textFixture();
  const add = spare.nodes.find(node => node.path === '0/1/1/0/0');
  add.visibleRectPx = {...add.rectPx,width:67};
  assert.equal(spare.evaluate().verdict,'PASS','clipped spare Text space does not remove any observed text range');
});

test('source adaptation text binds both fixed first-row labels at the actual 320vp and 1.45 branch', () => {
  const state = narrowRowTextFixture();
  const proof = evaluateSource(state.assertion,state.context);
  assert.equal(proof.verdict,'PASS',proof.reason);
  assert.equal(proof.actual.widthVp,320);
  assert.equal(proof.actual.scale,1.45);
  assert.equal(Object.keys(proof.actual.roles).length,8);
  assert.equal(proof.actual.roles['row/category'].actual.path,'0/2/0');
  assert.equal(proof.actual.roles['row/detect'].actual.path,'0/2/1/0/0');
  assert.equal(Object.hasOwn(proof.actual.roles,'row/title'),false);
});

test('source adaptation text rejects clipped row labels and target reuse under a different row', () => {
  const state = narrowRowTextFixture();
  const detect = state.nodes.at(-1);
  detect.visibleRectPx = {...detect.rectPx,width:61};
  assert.equal(state.evaluate().verdict,'FAIL');
  assert.match(state.evaluate().reason,/row\/detect native text ranges are clipped/u);
  const foreign = narrowRowTextFixture();
  foreign.find('reader-source-text-row-category').path = '0/9/0';
  assert.equal(foreign.evaluate().verdict,'FAIL');
  assert.match(foreign.evaluate().reason,/row\/category is outside its native host/u);
  const missing = narrowRowTextFixture();
  missing.text.payload.labels.pop();
  assert.equal(missing.evaluate().verdict,'NOT_RUN');
  assert.match(missing.evaluate().reason,/row\/detect has no unique/u);
});

test('source adaptation text rejects observed truncation and clipping while keeping geometry independently usable', () => {
  const cut = textFixture();
  const label = cut.byRole['footer/manage'];
  label.lines[0].end = label.endUtf16 = 3;
  label.complete = false;
  assert.match(cut.evaluate().reason,/do not cover the complete label/u);
  assert.equal(cut.evaluate().verdict,'FAIL');
  assert.equal(evaluateSourceAdaptationSurface(cut.assertion,cut.context).verdict,'PASS');

  const clipped = textFixture();
  const text = clipped.nodes.find(node => node.path === '0/1/1/0/0');
  text.visibleRectPx = {...text.rectPx,width:63};
  assert.match(clipped.evaluate().reason,/text ranges are clipped/u);
  assert.equal(clipped.evaluate().verdict,'FAIL');
  clipped.byRole['footer/manage'].tailRects.length = 0;
  assert.equal(clipped.evaluate().verdict,'FAIL');
  assert.equal(clipped.evaluate().observationsComplete,false);

  for (const unavailable of ['rangeRects','tailRects']) {
    const partial = textFixture();
    const add = partial.nodes.find(node => node.path === '0/1/1/0/0');
    add.visibleRectPx = {...add.rectPx,width:63};
    const measured = partial.byRole['footer/add'];
    measured.complete = false;
    measured[unavailable] = [];
    const proof = partial.evaluate();
    assert.equal(proof.verdict,'FAIL',`The other set proves clipping when ${unavailable} is unavailable`);
    assert.match(proof.reason,/footer\/add native text ranges are clipped/u);
    assert.equal(proof.observationsComplete,false);
  }

  const tooShort = textFixture();
  const stats = tooShort.find('reader-source-stats');
  stats.visibleRectPx = stats.rectPx = {...stats.rectPx,height:78};
  assert.match(tooShort.evaluate().reason,/scaled typography height/u);
});

test('source adaptation text keeps missing, duplicate and stale native measurements unverified', () => {
  for (const mutate of [
    ({context}) => { context.events.pop(); },
    ({text}) => { text.eventSeq = 11; },
    ({text}) => { text.windowRevision--; },
    ({text}) => { text.payload.windowRevision--; },
    ({text}) => { text.payload.owner = {...text.payload.owner,mounting:3}; },
    ({text}) => { text.payload.readGeneration--; },
    ({text}) => { text.payload.filterRevision--; },
    ({text}) => { text.payload.rowAnchor++; },
    ({text}) => { text.payload.systemFontScale = 1; },
    ({text}) => { text.payload.heightVp -= 1; },
    ({text,byRole}) => { text.payload.labels.push(byRole.stats); },
    ({byRole}) => { byRole.stats.lines = []; byRole.stats.complete = false; },
    ({byRole}) => { byRole.stats.tailRects = []; byRole.stats.complete = false; },
    ({byRole}) => { byRole.stats.rangeRects = []; byRole.stats.complete = false; },
    ({byRole}) => { byRole.stats.complete = false; },
    ({byRole}) => { byRole.stats.rangeRects[0].leftPx = undefined; },
    ({nodes}) => { nodes.push({...nodes.at(-1),path:'0/1/1/0/1'}); },
    ({find}) => { find('reader-source-stats').visibleRectPx = null; },
  ]) {
    const state = textFixture();
    mutate(state);
    assert.equal(state.evaluate().verdict,'NOT_RUN');
  }
});

test('source adaptation text requires effective system font readback in declared cases', () => {
  for (const [suffix,version,scale,state] of [
    ['font-160',5,1.6,withFixedRowText(textFixture(1.6))],
    ['font-200',5,2,withFixedRowText(textFixture(2))],
    ['width-320-font-maximum',3,1.45,narrowRowTextFixture()],
  ]) {
    const contract = JSON.parse(readFileSync(new URL(`../cases/source-management.layout-${suffix}.json`,import.meta.url)));
    const spec = contract.assertions.find(item => item.kind === 'adaptation-text');
    assert.equal(contract.version,version);
    assert.equal(spec.expected.requireNativeFontReadback,true);
    assert.equal(spec.expected.requireCurrentTextProjection,true);
    const assertion = {...spec,action:'open',sample:'ready',acceptedSources:spec.sources};
    const {context} = state;
    const window = context.samples.ready.window;
    const report = {vpPixels:window.density,fpPixels:window.density*scale,followsSystemFontScale:true,maxFontScale:2};
    const evaluate = (before,after=before) => {
      window.nativeFont = stableNativeFontReadback(before,after);
      return evaluateSource(assertion,context);
    };
    const proof = evaluate(report);
    assert.equal(proof.verdict,'PASS',proof.reason);
    assert.equal(proof.actual.nativeFont.fpPixels,report.fpPixels);
    assert.equal(proof.actual.nativeFont.vpPixels,report.vpPixels);
    assert.equal(proof.actual.nativeFont.followsSystemFontScale,true);
    assert.equal(proof.actual.nativeFont.maxFontScale,2);
    assert.equal(proof.actual.roles['footer/add'].verdict,'PASS');

    const unfollowed = evaluate({...report,followsSystemFontScale:false});
    assert.equal(unfollowed.verdict,'NOT_RUN',unfollowed.reason);
    assert.match(unfollowed.reason,/does not follow the system font/u);
    assert.equal(unfollowed.actual.nativeFont.followsSystemFontScale,false);

    for (const raw of [{...report,fpPixels:report.vpPixels},{...report,maxFontScale:1}]) {
      const mismatch = evaluate(raw);
      assert.equal(mismatch.verdict,'NOT_RUN',mismatch.reason);
      assert.match(mismatch.reason,/effective native font scale does not match/u);
      assert.equal(mismatch.actual.nativeFont.fpPixels,raw.fpPixels);
      assert.equal(mismatch.observationsComplete,false);
      assert.equal(state.evaluate().verdict,'PASS','Archived assertions do not require the new readback');
    }
    for (const after of [{...report,fpPixels:null},{...report,fpPixels:report.vpPixels},
      {...report,followsSystemFontScale:false}]) {
      const unavailable = evaluate(report,after);
      assert.equal(unavailable.verdict,'NOT_RUN',unavailable.reason);
      assert.match(unavailable.reason,/No stable native font readback/u);
      assert.equal(unavailable.actual,null);
    }
    const text = state.nodes.find(node => node.path === '0/1/1/0/0');
    text.visibleRectPx = {...text.rectPx,width:63};
    const clipped = evaluate(report);
    assert.equal(clipped.verdict,'FAIL',clipped.reason);
    assert.match(clipped.reason,/footer\/add native text ranges are clipped/u);
  }
});

test('source adaptation text requires effective readback at 366vp for the intermediate and maximum system settings', () => {
  const cells = [
    ['font-default',1,3,1,1.01],
    ['font-intermediate',1.3,5,1.29,1.31],
    ['font-maximum',1.45,5,1.44,1.46],
    ['font-160',1.6,5,1.59,1.61],
    ['font-200',2,5,1.99,2.01],
  ];
  for (const [suffix,scale,version,min,max] of cells) {
    const contract = JSON.parse(readFileSync(new URL(`../cases/source-management.layout-${suffix}.json`,import.meta.url)));
    const spec = contract.assertions.find(item => item.kind === 'adaptation-text');
    const defaultCell = suffix === 'font-default';
    assert.ok(spec?.required && spec.expected.requireNativeFontReadback && spec.expected.requireCurrentTextProjection &&
      spec.expected.rowLabels,`${contract.id} must require effective font and current first-row text evidence`);
    assert.equal(contract.version,version);
    assert.equal(contract.fixture.id,defaultCell ? 'public-source-default-font-v3' : 'public-source-row-font-boundary-v1');
    for (const assertion of contract.assertions.filter(item => ['adaptation','adaptation-surface','adaptation-text'].includes(item.kind))) {
      assert.deepEqual([assertion.expected.minWidthVp,assertion.expected.maxWidthVp,
        assertion.expected.minFontScale,assertion.expected.maxFontScale],[365.4,366.1,min,max],assertion.id);
    }
    const capture = contract.steps.find(step => step.id === spec.sample);
    assert.ok(capture.waitFor.some(event => event.kind === 'source.text-layout' && event.channel === 'business'));
    assert.equal(capture.afterAction,spec.action);
    assert.ok(['reader-source-text-row-category','reader-source-text-row-detect'].every(id=>capture.anchors.includes(id)));
    const rowReady = capture.waitFor.find(event=>event.kind === 'source.projection');
    const disabledRow = capture.waitFor.find(event=>event.kind === 'source.toggle');
    if (defaultCell) {
      assert.deepEqual(rowReady.fields,{
        'payload.state':'rows','payload.readFact':'current','payload.status':'all','payload.category':'all',
        'payload.allGroups':true,'payload.groupIndex':0,'payload.queryLength':0,
      });
      assert.equal(disabledRow,undefined);
      assert.equal(spec.expected.requireFirstRowToggleOff,true);
    } else {
      assert.equal(rowReady.fields['payload.count'],1);
      assert.equal(rowReady.fields['payload.projected'],1);
      assert.equal(disabledRow.fields['payload.phase'],'ready');
      assert.equal(disabledRow.fields['payload.enabled'],false);
    }

    const {context,nodes,text,byRole} = withFixedRowText(textFixture(scale));
    if (scale === 1) byRole.stats.lines[0].heightPx = 61;
    const assertion = {...spec,action:'open',sample:'ready',acceptedSources:spec.sources};
    const window = context.samples.ready.window;
    const report = {vpPixels:window.density,fpPixels:window.density*scale,followsSystemFontScale:true,maxFontScale:2};
    const wrongScale = {...report,fpPixels:report.vpPixels*(scale === 1 ? 1.3 : 1)};
    const evaluate = () => evaluateSource(assertion,context);
    const firstRow = nodes.find(node=>node.id === 'reader-source-row-12');
    const toggle = {type:'Toggle',source:'native-tree',visible:true,opacity:1,path:'0/2/2',sourceDefaultFontToggleChecked:false};
    if (defaultCell) {
      firstRow.source = 'native-tree';
      nodes.push(toggle);
    }

    for (const [before,after,reason] of [[wrongScale,wrongScale,/effective native font scale does not match/u],
      [report,wrongScale,/No stable native font readback/u],
      [report,{...report,fpPixels:null},/No stable native font readback/u]]) {
      window.nativeFont = stableNativeFontReadback(before,after);
      const result = evaluate();
      assert.equal(result.verdict,'NOT_RUN',result.reason);
      assert.match(result.reason,reason);
    }

    window.nativeFont = stableNativeFontReadback(report,report);
    context.events.pop();
    assert.equal(evaluate().verdict,'NOT_RUN','A window readback alone cannot prove label rendering');
    context.events.push(text);
    const proof = evaluate();
    assert.equal(proof.verdict,'PASS',proof.reason);
    assert.equal(Object.keys(proof.actual.roles).length,8);
    assert.equal(proof.actual.roles['row/category'].actual.path,'0/2/0');
    assert.equal(proof.actual.roles['row/detect'].actual.path,'0/2/1/0/0');
    if (defaultCell) {
      assert.deepEqual(proof.actual.firstRowToggle,{rowAnchor:12,checked:false});
      toggle.sourceDefaultFontToggleChecked = true;
      assert.equal(evaluate().verdict,'FAIL');
      toggle.sourceDefaultFontToggleChecked = null;
      assert.equal(evaluate().verdict,'NOT_RUN');
      toggle.sourceDefaultFontToggleChecked = false;
      toggle.path = '0/3/2';
      assert.equal(evaluate().verdict,'NOT_RUN','A different row’s off switch does not qualify');
      toggle.path = '0/2/2';
    }
    const footerText = nodes.find(node => node.path === '0/1/1/0/0');
    footerText.visibleRectPx = {...footerText.rectPx,width:63};
    const clipped = evaluate();
    assert.equal(clipped.verdict,'FAIL',clipped.reason);
    assert.match(clipped.reason,/footer\/add native text ranges are clipped/u);
  }
});

test('source adaptation text requires effective default system font and fixed labels at 320vp', () => {
  const contract = JSON.parse(readFileSync(new URL('../cases/source-management.layout-width-320.json',import.meta.url)));
  const spec = contract.assertions.find(item => item.kind === 'adaptation-text');
  assert.ok(spec?.required && spec.expected.requireNativeFontReadback && spec.expected.requireCurrentTextProjection && spec.expected.rowLabels,
    'The 320vp default Source case must require actual font and fixed first-row text evidence');
  assert.equal(contract.version,3);
  assert.deepEqual([spec.expected.minWidthVp,spec.expected.maxWidthVp,spec.expected.minFontScale,spec.expected.maxFontScale],
    [319.6,320.4,1,1.01]);
  const step = contract.steps.find(item => item.id === spec.sample);
  assert.equal(step.afterAction,spec.action);
  assert.ok(step.waitFor.some(event => event.kind === 'source.text-layout' && event.channel === 'business'));

  const {context,text,byRole,nodes} = narrowRowTextFixture(1);
  byRole.stats.lines[0].heightPx = 61;
  const assertion = {...spec,action:'open',sample:'ready',acceptedSources:spec.sources};
  const window = context.samples.ready.window;
  const active = {vpPixels:window.density,fpPixels:window.density,followsSystemFontScale:true,maxFontScale:2};
  const evaluate = () => evaluateSource(assertion,context);

  assert.equal(evaluate().verdict,'NOT_RUN');
  const large = {...active,fpPixels:1.3*active.vpPixels};
  window.nativeFont = stableNativeFontReadback(large,large);
  const mismatched = evaluate();
  assert.equal(mismatched.verdict,'NOT_RUN');
  assert.match(mismatched.reason,/effective native font scale does not match/u);
  window.nativeFont = stableNativeFontReadback(active,large);
  assert.equal(evaluate().verdict,'NOT_RUN');

  window.nativeFont = stableNativeFontReadback(active,active);
  const index = text.payload.labels.indexOf(byRole['row/detect']);
  text.payload.labels.splice(index,1);
  const missing = evaluate();
  assert.equal(missing.verdict,'NOT_RUN');
  assert.match(missing.reason,/row\/detect/u);
  text.payload.labels.splice(index,0,byRole['row/detect']);
  const complete = evaluate();
  assert.equal(complete.verdict,'PASS',complete.reason);
  assert.equal(complete.actual.nativeFont.effectiveScale,1);
  assert.equal(complete.actual.roles['row/category'].verdict,'PASS');
  assert.equal(complete.actual.roles['row/detect'].verdict,'PASS');

  const footer = nodes.find(node => node.path === '0/1/1/0/0');
  footer.visibleRectPx = {...footer.rectPx,width:63};
  const clipped = evaluate();
  assert.equal(clipped.verdict,'FAIL');
  assert.match(clipped.reason,/footer\/add native text ranges are clipped/u);
});

test('source adaptation text binds the four remaining normal window matrix cells', () => {
  const cells = [
    ['font-default',366,1,1,1.01],
    ['width-320-font-intermediate',320,1.3,1.29,1.31],
    ['width-320-font-160',320,1.6,1.59,1.61],
    ['width-320-font-200',320,2,1.99,2.01],
  ];
  for (const [suffix,width,scale,minFontScale,maxFontScale] of cells) {
    const contract = JSON.parse(readFileSync(new URL(`../cases/source-management.layout-${suffix}.json`,import.meta.url)));
    const narrow = width === 320;
    const expectedWidth = narrow ? [319.6,320.4] : [365.4,366.1];
    const sizeChecks = contract.assertions.filter(item => ['adaptation','adaptation-surface','adaptation-text'].includes(item.kind));
    assert.deepEqual(sizeChecks.map(item => item.kind),['adaptation','adaptation-surface','adaptation-text']);
    for (const assertion of sizeChecks) {
      const {expected} = assertion;
      assert.equal(assertion.required,true);
      assert.deepEqual([expected.minWidthVp,expected.maxWidthVp,expected.minFontScale,expected.maxFontScale],
        [...expectedWidth,minFontScale,maxFontScale],contract.id);
    }
    const spec = sizeChecks.at(-1);
    assert.equal(spec.expected.requireNativeFontReadback,true);
    assert.equal(spec.expected.requireCurrentTextProjection,true);
    assert.equal(spec.expected.rowLabels,true);
    const capture = contract.steps.find(step => step.id === spec.sample);
    assert.equal(capture.afterAction,spec.action);
    assert.ok(capture.waitFor.some(event => event.kind === 'source.text-layout' && event.channel === 'business'));
    const rowReady = capture.waitFor.find(event => event.kind === 'source.projection');
    assert.equal(rowReady.fields['payload.projected'],1);
    assert.ok(capture.waitFor.some(event => event.kind === 'source.toggle' && event.fields['payload.enabled'] === false));

    const {context,byRole,nodes,text} = narrow ? narrowRowTextFixture(scale) : withFixedRowText(textFixture(scale));
    if (scale === 1) byRole.stats.lines[0].heightPx = 61;
    const assertion = {...spec,action:'open',sample:'ready',acceptedSources:spec.sources};
    const {window} = context.samples.ready;
    const report = {vpPixels:window.density,fpPixels:window.density * scale,followsSystemFontScale:true,maxFontScale:2};
    const wrongEffectiveScale = scale === 1 ? 1.3 : 1;
    const wrongFont = {...report,fpPixels:window.density * wrongEffectiveScale};
    const evaluate = (before,after=before) => {
      window.nativeFont = stableNativeFontReadback(before,after);
      return evaluateSource(assertion,context);
    };
    const expectGap = (result,reason) => {
      assert.equal(result.verdict,'NOT_RUN');
      assert.match(result.reason,reason);
    };
    const measuredWidthPx = window.rectPx.width;
    window.rectPx = {...window.rectPx,width:window.density * (narrow ? 366 : 320)};
    expectGap(evaluate(report),/selected width, font scale and branch/u);
    window.rectPx = {...window.rectPx,width:measuredWidthPx};
    expectGap(evaluate(wrongFont),/effective native font scale does not match/u);
    expectGap(evaluate(report,wrongFont),/No stable native font readback/u);
    expectGap(evaluate({...report,followsSystemFontScale:false}),/does not follow the system font scale/u);

    const measurementRevision = text.payload.textProjectionRevision;
    text.payload.textProjectionRevision += 1;
    expectGap(evaluate(report),/current Source text projection/u);
    text.payload.textProjectionRevision = measurementRevision;
    const complete = evaluate(report);
    assert.equal(complete.verdict,'PASS',complete.reason);
    assert.equal(Object.keys(complete.actual.roles).length,8);

    const clippedRole = 'row/detect';
    const clippedNode = nodes.find(node => node.path === '0/2/1/0/0');
    clippedNode.visibleRectPx = {...clippedNode.rectPx,width:60};
    const clipped = evaluate(report);
    assert.equal(clipped.verdict,'FAIL',clipped.reason);
    assert.equal(clipped.actual.roles[clippedRole].verdict,'FAIL');
  }
});

test('source adaptation expanded proves row and fixed glyphs at its measured native sample', () => {
  const contract = JSON.parse(readFileSync(new URL('../cases/source-management.layout-expanded.json',import.meta.url)));
  const spec = contract.assertions.find(item => item.kind === 'adaptation-text');
  assert.equal(contract.version,4);
  assert.ok(spec.required && spec.expected.expanded && spec.expected.rowLabels &&
    spec.expected.requireNativeFontReadback && spec.expected.requireCurrentTextProjection);
  const capture = contract.steps.find(step => step.id === spec.sample);
  assert.equal(capture.afterAction,spec.action);
  assert.ok(capture.waitFor.some(event => event.kind === 'source.text-layout' && event.channel === 'business'));

  const {context,text,nodes} = withFixedRowText(textFixture(2));
  const sample = context.samples.ready;
  const {window} = sample;
  context.events.find(event => event.kind === 'source.geometry').payload.expanded = true;
  window.rectPx.width = READER_EXPANDED_MIN_WIDTH * window.density;
  window.visibleRectPx.width = window.rectPx.width;
  text.payload.widthVp = READER_EXPANDED_MIN_WIDTH;
  const font = {vpPixels:window.density,fpPixels:window.density*2,followsSystemFontScale:true,maxFontScale:2};
  window.nativeFont = stableNativeFontReadback(font,font);
  const assertion = {...spec,action:'open',sample:'ready',acceptedSources:spec.sources};
  const check = () => evaluateSource(assertion,context);
  const positive = check();
  assert.equal(positive.verdict,'PASS',positive.reason);
  assert.equal(positive.actual.sampleId,'ready');
  assert.equal(positive.actual.widthVp,READER_EXPANDED_MIN_WIDTH);
  assert.equal(positive.actual.nativeFont.effectiveScale,2);
  assert.deepEqual(Object.keys(positive.actual.roles),
    ['stats','status/all','category/all','group/label','footer/manage','footer/add','row/category','row/detect']);

  window.rectPx.width -= 1;
  assert.equal(check().verdict,'NOT_RUN');
  window.rectPx.width += 1;
  const detect = nodes.find(node => node.path === '0/2/1/0/0');
  detect.visibleRectPx = {...detect.rectPx,width:60};
  const clipped = check();
  assert.equal(clipped.verdict,'FAIL');
  assert.equal(clipped.actual.roles['row/detect'].verdict,'FAIL');
});

test('source adaptation text rejects an older sweep after a same-read projection update', () => {
  const state = textFixture();
  const {assertion,context,event,text} = state;
  const projection = context.events.find(item => item.kind === 'source.projection');
  assertion.expected.requireCurrentTextProjection = true;
  const current = event('source.projection',20,{...projection.payload,textProjectionRevision:2});
  context.events.push(current);

  const stale = state.evaluate();
  assert.equal(stale.verdict,'NOT_RUN',stale.reason);
  assert.match(stale.reason,/current Source text projection/u);
  text.payload.textProjectionRevision = 2;
  assert.equal(state.evaluate().verdict,'NOT_RUN','A reused revision cannot authorize a sweep captured before its projection');

  const fresh = event('source.text-layout',21,{...text.payload});
  context.events.push(fresh);
  const verified = state.evaluate();
  assert.equal(verified.verdict,'PASS');
  assert.equal(verified.actual.textProjectionRevision,2);
  delete fresh.payload.textProjectionRevision;
  assert.equal(state.evaluate().verdict,'NOT_RUN');
  fresh.payload.textProjectionRevision = 2;
  delete current.payload.textProjectionRevision;
  assert.equal(state.evaluate().verdict,'NOT_RUN');

  delete assertion.expected.requireCurrentTextProjection;
  delete fresh.payload.textProjectionRevision;
  assert.equal(state.evaluate().verdict,'PASS','Legacy contracts keep their original text measurement scope');
});
