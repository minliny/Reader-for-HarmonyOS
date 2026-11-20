// Explicit production-method/SDK-boundary cases. No device, network, build or implicit suite.
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
const definitions = {
  'filter-action-slot-current': { description: 'Actual SDK retained native host rebuilds step-keyed Surface/Header with current actions; real parent waits for closed before one navigation', resources: [] },
  'filter-native-closing': { description: 'Actual native dismissal can complete the current closing presentation without reopening business actions or notifying navigation early', resources: [] },
  'filter-group-layout-budget': { description: 'Actual group sheet budgets include the measured header frame plus external margin at 1.0/1.6 font scales', resources: [] },
  'filter-management-exit': { description: 'Actual SearchPage defers management navigation until matching native closed fact and retires cancelled, stale, reset and unmounted intents', resources: [] },
  'query-actions': { description: 'Actual page submit/filter methods reject empty/stale actions and separate next-query scope', resources: [] },
  relevance: { description: 'Actual incremental projection promotes late exact matches only at the admitted idle top boundary', resources: [] },
  'header-facts': { description: 'Actual progress and retry-reason publication captures the old anchor before a header reflow', resources: [] },
  'filter-sheet-opening': { description: 'Actual native sheet false-to-true Prop update, entry-time metrics broadcast and built six-choice body retain the open owner; style, header and teardown stay in filter-popup', resources: [] },
  'filter-popup': { description: 'Actual native bottom-sheet binding keeps shared surface styling and mask-click area, header/body content, six responsive choices and identity-safe dismissal/chrome lifetime', resources: [] },
};
const selectedCases=selectContractCases(definitions);
if(selectedCases.length){
const productionRoot=new URL('../entry/src/main/ets/',import.meta.url).href;
const resolver=registerHooks({resolve(specifier,context,next){
  if(context.parentURL?.startsWith(productionRoot)&&specifier.startsWith('.')&&!/\.[a-z]+$/i.test(specifier))return next(specifier+'.ts',context);
  return next(specifier,context);
}});
try {
const root = new URL('../entry/src/main/ets/', import.meta.url);
for (const selected of selectedCases) {
  if (selected === 'filter-action-slot-current') {
    const { createReaderComponentProbe } = await import('./lib/reader-component-probe.mjs');
    const { createArkUIPropertyRuntimeProbe } = await import('./lib/arkui-property-runtime-probe.mjs');
    const { builderComponentMembers } = await import('./lib/ets-builder-probe.mjs');
    const { readerSurfaceSpecsForProbe } = await import('./lib/bounded-surface-sdk-probe.mjs');
    const { searchSheetSdkInputs, searchFilterSdkDeclarations } = await import('./lib/search-sheet-sdk-probe.mjs');
    const { selectedProductionClasses, selectedProductionMethods } = await import('./lib/selected-production-methods.mjs');
    const { pureModuleProbe } = await import('./lib/ets-pure-module-probe.mjs');
    const { readerTypographyRoles } = await import('./lib/reader-typography-probe.mjs');
    const { foundationSpecs } = await import('./lib/reader-foundation-control-probe.mjs');
    const { ReaderInsetsVp } = await import('../entry/src/main/ets/features/common/ReaderWindowMetrics.ts');
    const { SearchViewState } = await import('../entry/src/main/ets/features/search/SearchViewState.ts');
    const geometry = await import('../entry/src/main/ets/features/common/SurfaceHorizontalGeometry.ts');
    const groups = await import('../entry/src/main/ets/features/search/SearchSourceGroups.ts');
    const { readerAppColor } = await import('../entry/src/main/ets/features/common/ReaderThemeRegistry.ts');
    const read=name=>readFileSync(new URL('features/'+name+'.ets',root),'utf8');
    const source=read('search/ReaderSearchFilterPanel'),surfaceSource=read('common/ReaderBoundedSurface'),
      headerSource=read('common/ReaderBoundedSurfaceHeader'),shared=read('common/ReaderFilterControls');
    class Port { constructor(owner,params,_storage,id){Object.assign(this,{owner,params,id});} }
    const childSources={ReaderBoundedSurface:surfaceSource,ReaderBoundedSurfaceHeader:headerSource,
      ReaderFilterTrigger:shared,ReaderFilterFooter:shared,ReaderFilterGroupRow:shared,
      ...Object.fromEntries(['ReaderButton','ReaderIconButton','ReaderSearchField','ReaderPageState'].map(n=>[n,read('common/'+n)]))};
    const properties=createArkUIPropertyRuntimeProbe(),metrics={systemFontScale:1,densityPixels:1,windowRect:{width:366,height:844}},
      specs=readerSurfaceSpecsForProbe(metrics),events=[],frames=[];
    const chrome=pureModuleProbe(read('common/ReaderSheetChrome'),'ReaderSheetChrome.ets',{...specs,...geometry,readerAppColor},['readerSheetWidth','readerSheetChrome']);
    const frame=searchFilterSdkDeclarations(source);
    const accessibility=pureModuleProbe(read('common/ReaderActionAccessibility'),'ReaderActionAccessibility.ets',{AccessibilityRoleType:{BUTTON:'button'}},['ReaderActionAccessibility']);
    const modifiers={...selectedProductionClasses(new URL('features/common/ReaderBoundedSurface.ets',root),['ReaderBoundedFrameModifier'],{...specs,readerAppColor,ReaderInsetsVp}),
      ...selectedProductionClasses(new URL('features/common/ReaderBoundedSurfaceHeader.ets',root),['ReaderBoundedTitleModifier'],{...readerTypographyRoles,readerAppColor})};
    const Divider=new Proxy({},{get:(_target,name)=>name==='name'?'Divider':()=>name==='canRetake'?false:undefined});
    class ChromeStyle { constructor(...args){this.args=args;} }
    const deps={...foundationSpecs(),...searchSheetSdkInputs(metrics),...properties.sdk,...specs,...chrome,...frame,...accessibility,...modifiers,...readerTypographyRoles,...groups,ReaderInsetsVp,Divider,
      ...Object.fromEntries(Object.keys(childSources).filter(n=>!['ReaderBoundedSurface','ReaderBoundedSurfaceHeader'].includes(n)).map(n=>[n,Port])),
      ReaderWindowChromeStyle:ChromeStyle,ReaderWindowCoordinator:{metrics:()=>metrics,requestOverlayChrome(){},requestAppChrome(){}},
      readerVisualSafeLeft:()=>0,readerVisualSafeRight:()=>0,readerVisualSafeTop:()=>24,readerVisualSafeBottom:()=>20,
      readerScrimmedOpaqueColor:(paper,mask)=>paper+mask,readerPageAreaLength:Number,
      SheetSize:{FIT_CONTENT:'fit'},SheetType:{BOTTOM:'bottom'},DismissReason:{PRESS_BACK:'back'}};
    const hooks={...properties.hooks,childSources,mountChildren:true,lifecycleChildren:true};
    const header=createReaderComponentProbe(headerSource,builderComponentMembers(headerSource),deps,hooks);deps.ReaderBoundedSurfaceHeader=header.Component;
    const surface=createReaderComponentProbe(surfaceSource,builderComponentMembers(surfaceSource),deps,hooks);deps.ReaderBoundedSurface=surface.Component;
    const Parent=selectedProductionMethods(new URL('features/search/SearchPage.ets',root),'SearchPage',
      ['ownsPageQuery','filterPresentationIdentity','filterActionIdentity','acceptsFilterAction','acceptsFilter',
        'switchSearchFilterStep','manageSourcesFromFilters','dismissSearchFilters','finishSearchFilterDismissal'],{Curve:{EaseInOut:'ease'}});
    const state=new SearchViewState();state.pageRevision=1;
    const parent=Object.assign(new Parent(),{viewState:state,pageMounted:true,pageEpoch:1,queryAtMount:state.revision,
      isPresentationCurrent:()=>true,filtersExpanded:true,filterGeneration:1,filterStepGeneration:1,filterStep:'filter',reduceMotion:true,
      pendingSourceManagementPresentation:'',getUIContext:()=>({getFocusController:()=>({clearFocus(){}}),animateTo:(_options,action)=>action()})});
    const novel={kind:'group',groupId:'novel',name:'小说组'},groupOptions=[new groups.SearchSourceGroupOption(groups.ALL_SEARCH_SOURCE_GROUP,12),new groups.SearchSourceGroupOption(novel,7)];
    const params=()=>({expanded:parent.filtersExpanded,presentationIdentity:parent.filterPresentationIdentity(),actionIdentity:parent.filterActionIdentity(),
      step:parent.filterStep,appliedGroup:state.category,appliedType:state.contentType,appliedSourceGroup:state.sourceGroup,
      appliedSourceGroupLabel:'全部分组',appliedSourceGroupValid:true,initialGroupQuery:'',sourceGroupOptions:groupOptions,groupLoadState:'ready',hasGroupCatalog:true});
    const probe=createReaderComponentProbe(source,builderComponentMembers(source),deps,{...hooks,initialParams:params()}),panel=probe.owner;
    const sync=()=>{panel.updateStateVars(params());properties.flush();};
    parent.publishSurface=sync;
    parent.onManageSources=()=>{events.push(['navigate']);parent.pageMounted=false;panel.aboutToDisappear();};
    panel.getUIContext=()=>({postFrameCallback:callback=>frames.push(callback),getFocusController:()=>({requestFocus(){},clearFocus(){}}),vp2px:value=>value});
    panel.onStep=(step,identity)=>{parent.switchSearchFilterStep(step,identity);sync();};
    panel.onManageSources=identity=>{events.push(['manage',identity]);parent.manageSourcesFromFilters(identity);};
    panel.onDismiss=identity=>parent.dismissSearchFilters(identity);
    panel.onClosed=identity=>{events.push(['closed',identity]);parent.finishSearchFilterDismissal(identity);};
    panel.aboutToAppear();panel.initialRender();
    const binding=[...panel.nodes.values()].find(node=>node.bindSheet).bindSheet,native=binding[2],opening=parent.filterPresentationIdentity();
    native.onWillAppear();native.onAppear();binding[1].builder();
    // Only this first native builder call is permitted. Every later step is
    // driven by actual callbacks, complete parent Props and dependency flush.
    const walk=owner=>[owner,...[...(owner.children?.values()??[])].flatMap(child=>walk(child))];
    const actors=()=>walk(panel),nodes=()=>actors().flatMap(actor=>[...(actor.nodes?.values()??[])]);
    const lastActor=predicate=>actors().findLast(predicate);
    assert.ok(actors().some(actor=>actor instanceof surface.Component));assert.ok(actors().some(actor=>actor instanceof header.Component));
    const oldNovelButton=lastActor(actor=>actor.params?.specId==='source-filter-option'&&actor.params?.label==='小说');
    lastActor(actor=>actor.params?.specId==='source-filter-option'&&actor.params?.label==='漫画').params.onAction();
    assert.equal(panel.draftType,'漫画');assert.equal(state.contentType,'全部类型');
    nodes().findLast(node=>node.id==='reader-search-source-group-trigger').onClick();
    assert.equal(parent.filterStep,'groups');assert.equal(parent.filterStepGeneration,2);assert.equal(parent.filterPresentationIdentity(),opening);
    const firstManage=lastActor(actor=>actor.params?.label==='前往书源管理');assert.ok(firstManage,'actual keyed update materializes the management action without manual slot rebuild');
    const oldGroupAll=lastActor(actor=>actor.params?.label==='全部分组'&&typeof actor.params?.count==='number');
    oldNovelButton.params.onAction();assert.equal(panel.draftType,'漫画','old filter callback cannot edit the current group step');
    lastActor(actor=>actor.params?.label==='小说组'&&typeof actor.params?.count==='number').params.onAction();
    assert.equal(panel.draftSourceGroup.groupId,'novel');assert.equal(parent.filterStep,'filter');assert.equal(parent.filterStepGeneration,3);
    firstManage.params.onAction();assert.equal(parent.pendingSourceManagementPresentation,'','retired group action cannot request management from filter');
    nodes().findLast(node=>node.id==='reader-search-source-group-trigger').onClick();
    assert.equal(parent.filterStep,'groups');assert.equal(parent.filterStepGeneration,4);
    assert.equal(panel.draftType,'漫画');assert.equal(panel.draftSourceGroup.groupId,'novel','ordinary keyed content replacement preserves Panel draft');
    oldGroupAll.params.onAction();assert.equal(panel.draftSourceGroup.groupId,'novel','old group row cannot modify the later groups generation');
    firstManage.params.onAction();assert.equal(parent.pendingSourceManagementPresentation,'','old management button remains retired even when the step name matches again');
    const currentManage=lastActor(actor=>actor.params?.label==='前往书源管理');assert.notEqual(currentManage,firstManage);
    const currentAction=parent.filterActionIdentity();currentManage.params.onAction();
    assert.equal(events.filter(event=>event[0]==='manage').at(-1)[1],currentAction);
    assert.equal(parent.filtersExpanded,false);assert.equal(panel.expanded,false);assert.equal(parent.pendingSourceManagementPresentation,opening);
    assert.equal([...panel.nodes.values()].find(node=>node.bindSheet).bindSheet[0],false,'current action closes the same retained native host');
    assert.equal(events.filter(event=>event[0]==='navigate').length,0,'management cannot navigate before actual native closed');
    native.onDisappear();native.onDisappear();
    assert.equal(events.filter(event=>event[0]==='closed').length,1);assert.equal(events.filter(event=>event[0]==='navigate').length,1);
    assert.equal(parent.pendingSourceManagementPresentation,'');assert.equal(state.consumeSourceManagementReturn(),'groups');
    assert.equal(state.contentType,'全部类型');assert.equal(state.sourceGroup.kind,'all','management exit does not commit un-applied draft values');
  } else if (selected === 'filter-native-closing') {
    const { selectedProductionMethods } = await import('./lib/selected-production-methods.mjs');
    const Panel=selectedProductionMethods(new URL('features/search/ReaderSearchFilterPanel.ets',root),'ReaderSearchFilterPanel',
      ['accepts','acceptsAction','acceptsDraftAction','retainsPresentation','sheetOptions','manageSources','dismissDraft','finishSheet'],{
        readerSheetChrome:()=>({}),SheetSize:{FIT_CONTENT:'fit'},SheetType:{BOTTOM:'bottom'},DismissReason:{PRESS_BACK:'back'},
      });
    const make=()=>{
      const events=[];let nativeDismissals=0;
      const panel=new Panel();
      Object.assign(panel,{mounted:true,expanded:true,presentationIdentity:'closing:1',actionIdentity:'closing:1:groups',step:'groups',
        draftPresentationIdentity:'closing:1',closedPresentationIdentity:'',appearedIdentity:'',scheme:'day',
        sheetWidth:()=>366,groupSheetHeight:()=>600,stepChanged(){},releaseSheetChrome:id=>events.push(['release',id]),
        onApply:()=>events.push(['apply']),onManageSources(){events.push(['manage']);panel.expanded=false;},
        onDismiss:()=>events.push(['dismiss']),onClosed:id=>events.push(['closed',id])});
      const options=panel.sheetOptions(panel.presentationIdentity);
      return {panel,options,events,dismiss(){nativeDismissals++;},get dismissed(){return nativeDismissals;}};
    };
    const closing=make();closing.options.onAppear();assert.equal(closing.panel.appearedIdentity,'closing:1');
    closing.panel.manageSources(closing.panel.actionIdentity);assert.equal(closing.panel.expanded,false);
    closing.panel.manageSources(closing.panel.actionIdentity);
    assert.equal(closing.events.filter(x=>x[0]==='manage').length,1,'closed business state rejects another management action');
    closing.options.onWillDismiss({reason:'back',dismiss:()=>closing.dismiss()});
    assert.equal(closing.dismissed,1,'native back can complete the current visible closing sheet');
    assert.equal(closing.events.filter(x=>x[0]==='apply'||x[0]==='closed').length,0,'native dismissal request cannot apply or report navigation before disappearance');
    assert.equal(closing.events.filter(x=>x[0]==='manage').length,1);
    closing.options.onDisappear();closing.options.onDisappear();
    assert.deepEqual(closing.events.filter(x=>x[0]==='closed'),[['closed','closing:1']],'closed fact remains tied to actual native disappearance and is once-only');
    closing.options.onWillDismiss({reason:'back',dismiss:()=>closing.dismiss()});assert.equal(closing.dismissed,1,'finished opening rejects native dismiss duplicates');
    const old=make();old.options.onAppear();old.panel.expanded=false;old.panel.presentationIdentity='closing:2';
    old.options.onWillDismiss({reason:'back',dismiss:()=>old.dismiss()});assert.equal(old.dismissed,0,'old opening cannot dismiss a newer target');assert.deepEqual(old.events,[]);
    const unmounted=make();unmounted.options.onAppear();unmounted.panel.expanded=false;unmounted.panel.mounted=false;
    Object.defineProperty(unmounted.panel,'presentationIdentity',{get(){throw new Error('disposed Prop read');}});
    assert.doesNotThrow(()=>unmounted.options.onWillDismiss({reason:'back',dismiss:()=>unmounted.dismiss()}));
    assert.equal(unmounted.dismissed,0);assert.deepEqual(unmounted.events,[],'unmounted owner short-circuits before any target or Prop access');
    const entry=make();entry.options.onWillDismiss({reason:'drag',dismiss:()=>entry.dismiss()});
    assert.equal(entry.dismissed,0);assert.deepEqual(entry.events,[],'entry-time non-user dismissal remains rejected while opening is not yet visible');
    entry.options.onAppear();entry.options.onWillDismiss({reason:'drag',dismiss:()=>entry.dismiss()});
    assert.equal(entry.dismissed,1);assert.equal(entry.events.filter(x=>x[0]==='dismiss').length,1,'normal appeared user dismissal retains the original close path');
  } else if (selected === 'filter-group-layout-budget') {
    const { selectedProductionMethods } = await import('./lib/selected-production-methods.mjs');
    const { readerSurfaceSpecsForProbe } = await import('./lib/bounded-surface-sdk-probe.mjs');
    const { foundationSpecs } = await import('./lib/reader-foundation-control-probe.mjs');
    const { readerScaledControlHeight } = await import('../entry/src/main/ets/features/common/ReaderSurfaceResolvers.ts');
    const { ReaderMeasurementStore } = await import('../entry/src/main/ets/features/common/ReaderMeasurements.ts');
    const { readerPageAreaLength } = await import('../entry/src/main/ets/features/common/ReaderPageShell.ts');
    const { readerSheetWidth } = await import('./lib/search-sheet-sdk-probe.mjs').then(module=>module.searchSheetSdkInputs({densityPixels:1}));
    const metrics={systemFontScale:1,windowRect:{width:366,height:844}};
    const surface=readerSurfaceSpecsForProbe(metrics),button=foundationSpecs().resolveReaderButtonSpec('filter-action');
    const Panel=selectedProductionMethods(new URL('features/search/ReaderSearchFilterPanel.ets',root),'ReaderSearchFilterPanel',
      ['systemFontScale','filterFontScale','sheetSpec','sheetWidth','groupSheetHeight','headerHeight','groupListHeight','filterActionHeight','accepts','acceptsAction','headerMeasurement','measurePart','layoutSignature','measurementGeneration','measuredHeight'],
      {...surface,resolveReaderButtonSpec:foundationSpecs().resolveReaderButtonSpec,readerScaledControlHeight,readerSheetWidth,ReaderWindowCoordinator:{metrics:()=>metrics},readerVisualSafeTop:()=>24,readerVisualSafeBottom:()=>20,readerVisualSafeLeft:()=>0,readerVisualSafeRight:()=>0,readerPageAreaLength});
    const near=(actual,expected,message)=>assert.ok(Math.abs(actual-expected)<.000001,message+`: ${actual} vs ${expected}`);
    for(const scale of [1,1.6]){
      metrics.systemFontScale=scale;
      const panel=Object.assign(new Panel(),{mounted:true,expanded:true,presentationIdentity:'layout:'+scale,actionIdentity:'layout:'+scale+':groups',
        metricsRevision:0,measurementRevision:0,step:'groups',measurements:new ReaderMeasurementStore(),groupLoadState:'ready'});
      const spec=panel.sheetSpec(),sheet=panel.groupSheetHeight();
      // Native measurement facts: the header frame excludes its external
      // titleBottom margin; source-management search fields measure 44vp.
      const headerFrame=Math.max(spec.titleHeight,spec.titleLineHeight*scale);
      const fallbackList=panel.groupListHeight();
      panel.headerMeasurement(panel.presentationIdentity)({}, {height:headerFrame});
      assert.equal(panel.measuredHeight('header'),headerFrame);
      near(panel.headerHeight(),headerFrame+spec.titleBottom,'measured header preserves the external title margin');
      near(panel.groupListHeight(),fallbackList,'header measurement cannot grow the list by the missing 12vp');
      const searchFrame=44,manageFrame=readerScaledControlHeight(button.height,button.text.lineHeightFp,scale);
      panel.measurePart('search',panel.actionIdentity,{height:searchFrame});
      panel.measurePart('manage',panel.actionIdentity,{height:manageFrame});
      const total=()=>headerFrame+spec.titleBottom+searchFrame+panel.groupListHeight()+manageFrame+12*2+spec.contentBottom+
        (panel.groupLoadState==='error'?panel.measuredHeight('notice'):0);
      near(total(),sheet,'measured header/search/list/manage/gaps/bottom fit the declared native sheet at scale '+scale);
      const stableList=panel.groupListHeight();
      panel.headerMeasurement(panel.presentationIdentity)({}, {height:headerFrame});
      near(panel.groupListHeight(),stableList,'repeated measurement cannot accumulate margin error');
      panel.groupLoadState='error';panel.measurePart('notice',panel.actionIdentity,{height:38.4});
      near(total(),sheet,'measured catalog notice is deducted once from the same group sheet budget');
    }
  } else if (selected === 'filter-management-exit') {
    const { selectedProductionMethods } = await import('./lib/selected-production-methods.mjs');
    const { SearchViewState } = await import('../entry/src/main/ets/features/search/SearchViewState.ts');
    const { ALL_SEARCH_SOURCE_GROUP } = await import('../entry/src/main/ets/features/search/SearchSourceGroups.ts');
    const Page=selectedProductionMethods(new URL('features/search/SearchPage.ets',root),'SearchPage',
      ['ownsPageQuery','filterPresentationIdentity','filterActionIdentity','acceptsFilterAction','acceptsFilter','dismissSearchFilters',
        'toggleSearchFilters','manageSourcesFromFilters','finishSearchFilterDismissal','submitSearch','aboutToDisappear'],{ALL_SEARCH_SOURCE_GROUP});
    const make=()=>{
      const state=new SearchViewState(),events=[];state.pageRevision=1;
      state.category='在线';state.contentType='漫画';state.sourceGroup={kind:'group',groupId:'kept',name:'保留组'};state.sourceGroupQuery='保留查找';
      const page=new Page();
      Object.assign(page,{viewState:state,pageMounted:true,isPresentationCurrent:()=>true,pageEpoch:1,queryAtMount:state.revision,
        filterGeneration:1,filterStepGeneration:1,filterStep:'groups',filtersExpanded:true,pendingSourceManagementPresentation:'',
        sourceGroupQuery:state.sourceGroupQuery,keyword:'新查询',presentation:{kind:'results'},
        publishSurface(){events.push('hide-requested');},rememberAnchorNeighbors(){},onVisibleGroups(){},onSearch(){events.push('search');},
        onManageSources(){events.push('navigate');page.pageMounted=false;}});
      return {page,state,events};
    };
    {
      const {page,state,events}=make(),identity=page.filterPresentationIdentity(),applied=state.sourceGroup;
      page.manageSourcesFromFilters(page.filterActionIdentity());
      assert.deepEqual(events,['hide-requested'],'requesting native close cannot navigate in the click stack');
      assert.equal(page.filtersExpanded,false);
      assert.equal(page.pendingSourceManagementPresentation,identity);assert.equal(state.consumeSourceManagementReturn(),undefined,'return intent starts only after native close');
      assert.equal(state.sourceGroupQuery,'保留查找');assert.equal(state.sourceGroup,applied);
      page.finishSearchFilterDismissal(identity+'retired');assert.deepEqual(events,['hide-requested']);
      page.finishSearchFilterDismissal(identity);assert.deepEqual(events,['hide-requested','navigate']);
      assert.equal(page.pendingSourceManagementPresentation,'');assert.equal(state.consumeSourceManagementReturn(),'groups');
      page.finishSearchFilterDismissal(identity);assert.deepEqual(events,['hide-requested','navigate'],'native duplicate cannot navigate twice');
    }
    {
      const {page,events}=make(),old=page.filterPresentationIdentity();page.manageSourcesFromFilters(page.filterActionIdentity());
      page.toggleSearchFilters();assert.equal(page.pendingSourceManagementPresentation,'','new opening cancels pending navigation');
      const next=page.filterPresentationIdentity();assert.notEqual(next,old);
      page.finishSearchFilterDismissal(old);page.dismissSearchFilters(next);page.finishSearchFilterDismissal(next);
      assert.ok(!events.includes('navigate'),'cancel/reopen/ordinary close cannot consume the retired manage intent');
    }
    {
      const {page,events}=make(),old=page.filterPresentationIdentity();page.manageSourcesFromFilters(page.filterActionIdentity());
      page.submitSearch();assert.equal(page.pendingSourceManagementPresentation,'','new query retires the pending exit');
      page.finishSearchFilterDismissal(old);assert.ok(!events.includes('navigate'));
    }
    {
      const {page,events}=make(),identity=page.filterPresentationIdentity();page.manageSourcesFromFilters(page.filterActionIdentity());
      page.aboutToDisappear();assert.equal(page.pendingSourceManagementPresentation,'');
      page.finishSearchFilterDismissal(identity);assert.ok(!events.includes('navigate'),'unmounted page cannot navigate from late closed');
    }
    {
      const {page,events}=make(),identity=page.filterPresentationIdentity();
      page.pendingSourceManagementPresentation=identity;
      page.finishSearchFilterDismissal(identity);assert.deepEqual(events,[],'closed fact cannot admit navigation while presentation is still visible');
      page.filterStep='filter';page.manageSourcesFromFilters(page.filterActionIdentity());assert.deepEqual(events,[],'management remains a groups-step intent');
    }
  } else if (selected === 'query-actions') {
    const { selectedProductionMethods, selectedProductionValues } = await import('./lib/selected-production-methods.mjs');
    const { SearchViewState } = await import('../entry/src/main/ets/features/search/SearchViewState.ts');
    const { ALL_SEARCH_SOURCE_GROUP, searchSourceGroupKey } = await import('../entry/src/main/ets/features/search/SearchSourceGroups.ts');
    const { ReaderPageGeometryInput, resolveReaderPageGeometry } = await import('../entry/src/main/ets/features/common/ReaderPageGeometry.ts');
    const { createDefaultReaderWindowMetrics } = await import('../entry/src/main/ets/features/common/ReaderWindowMetrics.ts');
    const { readerScrollLayout } = await import('../entry/src/main/ets/features/common/ReaderScrollLayout.ts');
    const { TOK_CONTENT_RAIL_W_TABLET } = selectedProductionValues(new URL('features/common/ReaderTokens.ets', root), ['TOK_CONTENT_RAIL_W_TABLET']);
    const metrics = createDefaultReaderWindowMetrics();
    metrics.windowRect.width = 390;
    const Page = selectedProductionMethods(new URL('features/search/SearchPage.ets', root), 'SearchPage',
      ['canSubmit', 'submitSearch', 'filterPresentationIdentity', 'filterActionIdentity', 'acceptsFilterAction', 'acceptsFilter',
        'dismissSearchFilters', 'toggleSearchFilters', 'applySearchFilters', 'pageGeometry', 'scrollLayout', 'searchContentStartInset'],
      { ALL_SEARCH_SOURCE_GROUP, searchSourceGroupKey, ReaderPageGeometryInput, resolveReaderPageGeometry,
        ReaderWindowCoordinator: { metrics: () => metrics }, readerScrollLayout, TOK_CONTENT_RAIL_W_TABLET });
    const page = new Page(); const requests = [];
    Object.assign(page, { ownsPageQuery: () => true, isSweeping: () => false, presentation: { kind: 'results' },
      keyword: '   ', viewState: new SearchViewState(), selectedGroupName: '本地', selectedContentType: '漫画',
      filtersExpanded: false, filterGeneration: 0, filterStepGeneration: 0, pageEpoch: 4, publishSurface() {},
      measurementRevision: 1, resolvedHeaderHeight: () => 96, searchBottomInset: () => 0,
      scopeSourceIds: () => assert.fail('result filters may not supply the next request scope'),
      onSearch: (...args) => requests.push(args) });
    assert.equal(page.canSubmit(), false); page.submitSearch(); assert.equal(requests.length, 0);
    page.isSweeping = () => true; assert.equal(page.canSubmit(), true, 'empty draft cannot disable Stop');
    page.isSweeping = () => false; page.keyword = ' 新查询 '; page.submitSearch();
    assert.deepEqual(requests, [['新查询']]);
    assert.equal(page.selectedGroupName, '全部'); assert.equal(page.selectedContentType, '全部类型');
    page.sourceGroupQuery='old'; page.viewState.sourceGroupQuery='old';
    const closedInset = page.searchContentStartInset();
    assert.equal(closedInset, 96, 'fixture supplies a real header clearance to the list');
    page.toggleSearchFilters(); assert.equal(page.sourceGroupQuery,''); assert.equal(page.viewState.sourceGroupQuery,''); const retired = page.filterPresentationIdentity();
    assert.equal(page.searchContentStartInset(), closedInset, 'native filter overlay does not reserve list space');
    page.dismissSearchFilters(retired); assert.equal(page.filtersExpanded, false);
    assert.equal(page.searchContentStartInset(), closedInset, 'dismissing the overlay does not reposition the list');
    page.toggleSearchFilters(); const current = page.filterPresentationIdentity();
    assert.notEqual(current, retired);
    page.dismissSearchFilters(retired); assert.equal(page.filtersExpanded, true, 'late close cannot dismiss a reopened popup');
    page.viewState.revision++; page.dismissSearchFilters(current);
    assert.equal(page.filtersExpanded, true, 'old query callback rejected');
    page.dismissSearchFilters(page.filterPresentationIdentity()); assert.equal(page.filtersExpanded, false);
    let resets=0,publishes=0,cleared=0;
    Object.assign(page,{hasSourceGroupCatalog:true,sourceGroupDirectory:()=>({valid:selection=>selection.groupId!=='deleted'}),
      getUIContext:()=>({getFocusController:()=>({clearFocus(){cleared++;}})}),resetFilteredResults(){resets++;},publishSurface(){publishes++;}});
    page.toggleSearchFilters(); const action=page.filterActionIdentity(); const revision=page.viewState.filterRevision;
    page.applySearchFilters('在线','漫画',ALL_SEARCH_SOURCE_GROUP,action+'old');assert.equal(resets,0);
    page.applySearchFilters('在线','漫画',{kind:'group',groupId:'deleted',name:'旧组'},action);assert.equal(resets,0);assert.equal(page.filtersExpanded,true);
    page.applySearchFilters('在线','漫画',ALL_SEARCH_SOURCE_GROUP,action);
    assert.equal(resets,1);assert.equal(page.viewState.filterRevision,revision+1);assert.equal(page.filtersExpanded,false);assert.equal(cleared,1);
    page.applySearchFilters('全部','小说',ALL_SEARCH_SOURCE_GROUP,action);assert.equal(resets,1,'closed callback cannot apply twice');
    page.toggleSearchFilters();page.applySearchFilters('在线','漫画',ALL_SEARCH_SOURCE_GROUP,page.filterActionIdentity());assert.equal(resets,1,'no-op apply closes without resetting results');
    page.toggleSearchFilters();page.applySearchFilters('本地','小说',{kind:'group',groupId:'deleted',name:'旧组'},page.filterActionIdentity());
    assert.equal(page.viewState.sourceGroup.kind,'all','local normalization precedes catalog validation');assert.equal(resets,2);
    page.hasSourceGroupCatalog=false;page.selectedSourceGroup={kind:'group',groupId:'kept',name:'原组'};page.viewState.sourceGroup=page.selectedSourceGroup;
    page.toggleSearchFilters();page.applySearchFilters('在线','小说',{...page.selectedSourceGroup},page.filterActionIdentity());assert.equal(page.filtersExpanded,false,'catalog absence allows the original applied group');
    page.toggleSearchFilters();page.applySearchFilters('在线','小说',{kind:'group',groupId:'new',name:'其他'},page.filterActionIdentity());assert.equal(page.filtersExpanded,true,'catalog absence cannot introduce another named group');
    page.filterStep='groups';page.dismissSearchFilters(page.filterPresentationIdentity());assert.equal(page.filtersExpanded,false,'system back closes the group step too');

  } else if (selected === 'relevance') {
    const { SearchResultProjection } = await import('../entry/src/main/ets/features/search/SearchResultProjection.ts');
    const { SearchViewState } = await import('../entry/src/main/ets/features/search/SearchViewState.ts');
    const state = new SearchViewState(); state.reset('目标书');
    const book = (key, title, admittedOrder) => ({ sourceId: key, sourceName: key, bookId: key,
      groupKey: key, title, author: '作者', category: 'novel', admittedOrder });
    const other = book('other', '其他返回', 0), exact = book('exact', '目标书', 1),
      same = book('same', '目标书', 2);
    const projection = new SearchResultProjection();
    const names = update => update.orderedKeys.map(key => update.rows.get(key).book.bookId);
    assert.deepEqual(names(projection.update([other], [], '目标书', state, undefined, true)), ['other']);
    const all = [other, exact, same];
    assert.deepEqual(names(projection.update(all, [], '目标书', state, undefined, false)), ['other', 'exact', 'same'],
      'reading boundary preserves previous row and appends new matches');
    assert.deepEqual(names(projection.update(all, [], '目标书', state, undefined, true)), ['exact', 'same', 'other'],
      'idle top promotes the late exact books without dropping other real returns');
    assert.deepEqual(names(projection.update(all, [], '目标书', state, undefined, false)), ['exact', 'same', 'other']);
    const resumed = new SearchResultProjection();
    assert.deepEqual(names(resumed.update(all, [], '目标书', state)), ['exact', 'same', 'other'],
      'detail round trip preserves published order');
  } else if (selected === 'header-facts') {
    const { selectedProductionMethods } = await import('./lib/selected-production-methods.mjs');
    const Page = selectedProductionMethods(new URL('features/search/SearchPage.ets', root), 'SearchPage',
      ['captureSearchNoticeFacts', 'displayedSearchNoticeFacts', 'acceptResultNoticeFacts', 'searchNoticeText']);
    const page = new Page(); const anchored = [];
    Object.assign(page, { viewState: { revision: 2 }, presentation: { kind: 'results', failedSourceCount: 40 },
      progress: '已处理 88/113 个书源', sweeping: true,
      searchProgressText: () => page.progress, isSweeping: () => page.sweeping,
      operation: () => ({ generation: 1, canRetry: true }),
      onCardDisplayFactsChange: () => anchored.push(page.resultNoticeFacts.progressText) });
    page.acceptResultNoticeFacts(); assert.deepEqual(anchored, []);
    page.progress = '已处理 113/113 个书源'; page.sweeping = false;
    assert.equal(page.displayedSearchNoticeFacts().progressText, '已处理 88/113 个书源');
    assert.equal(page.displayedSearchNoticeFacts().failed, 40, 'retained facts do not reflow behind the interaction freeze');
    page.acceptResultNoticeFacts();
    assert.deepEqual(anchored, ['已处理 88/113 个书源'], 'capture uses the previous geometry before swapping the text');
    assert.equal(page.searchNoticeText('failed'), '40 个书源本次搜索失败。');
    page.acceptResultNoticeFacts(); assert.equal(anchored.length, 1, 'same facts do not repeat anchor work');
  } else if (selected === 'filter-popup' || selected === 'filter-sheet-opening') {
    const openingRegression = selected === 'filter-sheet-opening';
    const { createReaderComponentProbe } = await import('./lib/reader-component-probe.mjs');
    const { foundationSpecs } = await import('./lib/reader-foundation-control-probe.mjs');
    const { readerTypographyRoles } = await import('./lib/reader-typography-probe.mjs');
    const { pureModuleProbe } = await import('./lib/ets-pure-module-probe.mjs');
    const { SurfaceWidthSpec, resolveHorizontalFrame } = await import('../entry/src/main/ets/features/common/SurfaceHorizontalGeometry.ts');
    const { ALL_SEARCH_SOURCE_GROUP, searchSourceGroupKey } = await import('../entry/src/main/ets/features/search/SearchSourceGroups.ts');
    const { readerAppColor } = await import('../entry/src/main/ets/features/common/ReaderThemeRegistry.ts');
    const { builderComponentMembers } = await import('./lib/ets-builder-probe.mjs');
    const { readerSurfaceSpecsForProbe } = await import('./lib/bounded-surface-sdk-probe.mjs');
    const { searchSheetSdkInputs, searchFilterSdkDeclarations } = await import('./lib/search-sheet-sdk-probe.mjs');
    const { selectedProductionClasses } = await import('./lib/selected-production-methods.mjs');
    const { createArkUIPropertyRuntimeProbe } = await import('./lib/arkui-property-runtime-probe.mjs');
    const metrics = { systemFontScale: 1, windowRect: { width: 390, height: 844 } };
    const specs=foundationSpecs(),surface=readerSurfaceSpecsForProbe(metrics);
    const filterSpec=specs.resolveReaderButtonSpec('source-filter-option');
    assert.equal(filterSpec.primarySurface,'TOK_PRIMARY_SOFT');assert.equal(filterSpec.primaryText,'TOK_GREEN');assert.equal(filterSpec.primaryBorder,'TOK_GREEN');
    const read=name=>readFileSync(new URL('features/'+name,root),'utf8');
    const source=read('search/ReaderSearchFilterPanel.ets'),shared=read('common/ReaderFilterControls.ets');
    const sheetChrome=pureModuleProbe(read('common/ReaderSheetChrome.ets'),'ReaderSheetChrome.ets',
      {...surface,readerAppColor,SurfaceWidthSpec,resolveHorizontalFrame},['readerSheetWidth','readerSheetChrome']);
    const focus=searchFilterSdkDeclarations(source);
    const properties=createArkUIPropertyRuntimeProbe(),changes=[],chrome=[],dividerCalls=[];
    // Explicit native Divider call recording for the stroke/color assertions;
    // this port executes no layout or renderer.
    const Divider=new Proxy({},{get:(_target,name)=>name==='name'?'Divider':(...args)=>{dividerCalls.push([name,...args]);if(name==='canRetake')return false;}});
    class Port{constructor(owner,params,_storage,id){Object.assign(this,{owner,params,id});}}
    class TriggerPort extends Port {}
    class ChromeStyle{constructor(...args){this.args=args;}}
    const fixture=createReaderComponentProbe(source,builderComponentMembers(source),{
      ...searchSheetSdkInputs(metrics),...properties.sdk,...specs,...surface,...sheetChrome,...focus,...readerTypographyRoles,ALL_SEARCH_SOURCE_GROUP,searchSourceGroupKey,Divider,
      ReaderButton:Port,ReaderIconButton:Port,ReaderSearchField:Port,ReaderPageState:Port,ReaderFilterTrigger:TriggerPort,ReaderFilterFooter:Port,ReaderFilterGroupRow:Port,ReaderBoundedSurface:Port,ReaderBoundedSurfaceHeader:Port,
      ReaderWindowChromeStyle:ChromeStyle,SheetSize:{FIT_CONTENT:'FIT_CONTENT'},SheetType:{BOTTOM:'BOTTOM'},DismissReason:{PRESS_BACK:'BACK'},
      readerVisualSafeLeft:()=>0,readerVisualSafeRight:()=>0,readerVisualSafeTop:()=>24,readerVisualSafeBottom:()=>20,
      readerScrimmedOpaqueColor:(paper,mask)=>`${paper}+${mask}`,readerPageAreaLength:Number,
      ReaderWindowCoordinator:{metrics:()=>metrics,requestOverlayChrome:style=>{chrome.push(style);if(openingRegression)panel.metricsRevision++;},requestAppChrome:()=>chrome.push('app')},
    },{...properties.hooks,childSources:{ReaderButton:read('common/ReaderButton.ets'),ReaderFilterTrigger:shared,ReaderFilterFooter:shared,ReaderFilterGroupRow:shared,
      ReaderIconButton:read('common/ReaderIconButton.ets'),ReaderSearchField:read('common/ReaderSearchField.ets'),ReaderPageState:read('common/ReaderPageState.ets'),ReaderBoundedSurface:read('common/ReaderBoundedSurface.ets'),ReaderBoundedSurfaceHeader:read('common/ReaderBoundedSurfaceHeader.ets')}});
    const panel=fixture.owner;
    // Native parent updates provide every declared Prop. Partial payloads
    // would reset absent one-way Props to undefined in the real SDK runtime.
    const panelParams=overrides=>Object.assign(Object.fromEntries(['expanded','presentationIdentity','actionIdentity','step','appliedGroup','appliedType',
      'appliedSourceGroup','appliedSourceGroupLabel','appliedSourceGroupValid','initialGroupQuery','sourceGroupOptions','groupLoadState','hasGroupCatalog']
      .map(key=>[key,panel[key]])),overrides);
    panel.getUIContext=()=>({postFrameCallback:frame=>frame.onFrame(0),getFocusController:()=>({requestFocus(){}})});
    Object.assign(panel,{expanded:!openingRegression,presentationIdentity:openingRegression?'query:closed':'query:one',actionIdentity:'query:one:filter',
      appliedGroup:'全部',appliedType:'全部类型',scheme:'day',metricsRevision:0,
      onApply:(...args)=>changes.push(['apply',...args]),getUIContext:()=>({postFrameCallback:frame=>frame.onFrame(0),getFocusController:()=>({requestFocus(){}})}),
      onToggle:()=>panel.updateStateVars(panelParams({expanded:true,presentationIdentity:'query:one',actionIdentity:'query:one:filter',appliedGroup:'全部',appliedType:'全部类型'})),
      onDismiss:identity=>{changes.push(['dismiss',identity]);if(openingRegression)panel.updateStateVars(panelParams({expanded:false}));}});
    panel.aboutToAppear();panel.initialRender();
    let trigger=[...panel.nodes.values()].find(node=>node.bindSheet);assert.ok(trigger,'custom shared trigger retains one native binding');
    assert.ok(![...panel.nodes.values()].some(node=>node.bindPopup));
    if(openingRegression){
      assert.equal(trigger.bindSheet[0],false);const button=[...panel.children.values()].find(child=>child.params.onAction);button.params.onAction();
      properties.flush();assert.equal(panel.expanded,true);trigger=[...panel.nodes.values()].find(node=>node.bindSheet);
      assert.equal(trigger.bindSheet[0],true,'actual Prop update opens the retained bindSheet');
    }
    const [visible,content,options]=trigger.bindSheet;
    assert.equal(visible,true);assert.equal(typeof content,'object');assert.equal(typeof content.builder,'function');
    if(!openingRegression){
      assert.equal(options.preferType,'BOTTOM');assert.equal(options.height,'FIT_CONTENT');assert.equal(options.width,390);assert.equal(options.enableOutsideInteractive,false);
      assert.equal(options.backgroundColor,readerAppColor(surface.resolveSheetSpec('search-result-filter').hostBackgroundRole,'day'));
    }
    options.onWillAppear();assert.equal(chrome.length,1);properties.flush();assert.equal(panel.expanded,true);assert.deepEqual(changes,[],'entry metrics never manufacture dismissal');
    options.onAppear();content.builder();
    const body=[...panel.children.values()].find(child=>child.params.specId==='search-result-filter');assert.ok(body);
    if(openingRegression){
      body.params.body();
      const choices=[...panel.children.values()].filter(child=>child.params.specId==='source-filter-option');
      assert.deepEqual(choices.map(child=>child.params.label),['全部','小说','漫画','全部','本地','在线']);
      recordContractCasePass(selected);
      continue;
    }
    body.params.header();const header=[...panel.children.values()].find(child=>child.params.title==='筛选搜索结果');assert.ok(header);
    assert.equal(header.params.accessory,undefined,'reset is absent from the header');
    const before=panel.bodyHeightLimit();header.params.onAreaChanged({}, {height:93});assert.equal(panel.measuredHeight('header'),93);assert.ok(panel.bodyHeightLimit()<=before);
    body.params.body();body.params.actions();
    assert.ok(dividerCalls.some(([name,value])=>name==='strokeWidth'&&value===1),'actual option sections emit their one-vp native dividers');
    assert.ok(dividerCalls.some(([name,value])=>name==='color'&&value===readerAppColor('TOK_ROW_DIVIDER','day')),'actual dividers use the registered row role');
    assert.ok([...panel.nodes.values()].some(node=>node.type==='Scroll'),'filter step always owns a bounded scroll');
    const buttons=[...panel.children.values()].filter(child=>child.params.specId==='source-filter-option');
    assert.deepEqual(buttons.map(button=>button.params.label),['全部','小说','漫画','全部','本地','在线']);
    buttons[1].params.onAction();assert.equal(panel.draftType,'小说');assert.deepEqual(changes,[],'type choice only changes the draft');
    const footer=[...panel.children.values()].find(child=>child.params.onApply);assert.ok(footer);assert.equal(typeof footer.params.onReset,'function');
    panel.step='groups';panel.actionIdentity='query:one:groups';
    let dismissed=0;options.onWillDismiss({reason:'BACK',dismiss:()=>dismissed++});
    assert.equal(dismissed,1);assert.deepEqual(changes.at(-1),['dismiss','query:one'],'native back discards group draft instead of returning to filter');
    panel.updateStateVars(panelParams({expanded:true,presentationIdentity:'query:two',actionIdentity:'query:two:filter',step:'filter'}));properties.flush();
    const fresh=panel.sheetOptions('query:two');fresh.onWillAppear();fresh.onAppear();assert.equal(panel.draftType,'全部类型','reopening restores applied values');
    const n=changes.length;buttons[1].params.onAction();options.onWillDismiss({reason:'BACK',dismiss:()=>assert.fail('retired native callback')});assert.equal(changes.length,n);
    body.params.body();options.onDisappear();assert.notEqual(chrome.at(-1),'app','old disappearance cannot release new chrome');
    panel.mounted=false;fresh.onDisappear();assert.equal(changes.length,n);
    metrics.systemFontScale=1.6;metrics.windowRect={width:240,height:260};panel.metricsRevision++;
    assert.ok(panel.bodyHeightLimit()>=0&&panel.bodyHeightLimit()<260-44);
    assert.ok([...panel.children.values()].some(child=>child instanceof TriggerPort),'actual SDK Builder mounts the shared trigger parameter port');
  }
  recordContractCasePass(selected);
}
} finally { resolver.deregister(); }
}
