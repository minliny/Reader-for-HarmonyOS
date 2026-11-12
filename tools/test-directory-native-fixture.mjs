import assert from 'node:assert/strict';
import { readFileSync,existsSync } from 'node:fs';
import { createRequire,registerHooks } from 'node:module';
import { fileURLToPath } from 'node:url';
import { selectContractCases,recordContractCasePass } from './lib/contract-case-selection.mjs';

const selected=selectContractCases({
  'initializer-safety':'Actual SDK fixture admission/production initializers and exact control parent geometry; no native child rendering.',
  'default-vs-fixture':'Actual default Gateway creation remains and injected factories preserve their captured typed port.',
  'no-runtime':'Actual Surface opening and List initializer use injected public API without obtaining Runtime/Core; same renderer route.',
  'captured-retire':'Actual async Tree/target callbacks and captured port factories reject retired component openings.',
  'memory-actions':'Memory-only samples/actions and captured presentation retirement; native intent is not a Core receipt.',
  'short-control-viewport':'Actual debug initializer applies only explicit 122/168/190 inner viewports, reports measured area separately and keeps default production Frame; no native glyph/scale claim.',
  'dynamic-control-viewport':'Actual same-instance SDK child/port/session with non-focusable local viewport HUD, real parent-budget endpoints and retired HUD rejection; no Native focus or IME claim.',
});
if(selected.length){
  registerHooks({resolve(specifier,context,next){
    if(specifier.startsWith('.')&&!/\.[a-z]+$/i.test(specifier)){
      const url=new URL(specifier+'.ts',context.parentURL);if(existsSync(fileURLToPath(url)))return next(url.href,context);
    }return next(specifier,context);
  }});
  const {createReaderBuilderProbe}=await import('./lib/reader-control-builder-probe.mjs');
  const {boundedSurfaceSdk,boundedMembers}=await import('./lib/bounded-surface-sdk-probe.mjs');
  const {selectedProductionMethods}=await import('./lib/selected-production-methods.mjs');
  const {productionMangaDirectoryNavigationDataSource}=await import('./lib/manga-directory-navigation-data-source-probe.mjs');
  const navigation=await import('../entry/src/main/ets/features/reading/application/ReaderDirectoryNavigation.ts');
  const navigationSession=await import('../entry/src/main/ets/features/reading/presentation/ReaderDirectoryNavigationSession.ts');
  const {ReaderDirectoryTrace}=await import('../entry/src/main/ets/features/reading/ui/ReaderDirectoryTrace.ts');
  const {pureModuleProbe}=await import('./lib/ets-pure-module-probe.mjs');
  const {installedEtsCompiler}=await import('./lib/ets-compiler-runtime.mjs');
  const {resolveEtsLoaderRoot}=await import('./lib/tool-environment.mjs');
  const {createDefaultReaderWindowMetrics}=await import('../entry/src/main/ets/ui/foundation/ReaderWindowMetrics.ts');
  const {resolveReaderControlLayout}=await import('../entry/src/main/ets/features/reading/ui/ReaderLayoutGeometry.ts');
  const {ReaderControlGeometry}=await import('../entry/src/main/ets/features/reading/ui/ReaderControlGeometry.ts');
  const {readerControlMotionBounds,sampleReaderControlMotionComposition}=await import('../entry/src/main/ets/features/reading/ui/ReaderControlMotionGeometry.ts');
  const {readerPageAreaLength}=await import('../entry/src/main/ets/ui/layout/ReaderPageShell.ts');
  const file=new URL('../entry/src/main/ets/pages/ReaderDirectoryStructureFixture.ets',import.meta.url),source=readFileSync(file,'utf8');
  const dataFile=new URL('../entry/src/main/ets/pages/ReaderDirectoryStructureFixtureData.ts',import.meta.url),dataSource=readFileSync(dataFile,'utf8');
  const {readerDirectoryFixtureEntries,ReaderDirectoryFixturePort,readerDirectoryFixtureCopyEntry}=pureModuleProbe(dataSource,'ReaderDirectoryStructureFixtureData.ts',{},['readerDirectoryFixtureEntries','ReaderDirectoryFixturePort','readerDirectoryFixtureCopyEntry']);
  const {readerReadableFontScale,readerScaledControlHeight}=pureModuleProbe(readFileSync(new URL('../entry/src/main/ets/ui/foundation/ReaderSurfaceResolvers.ts',import.meta.url),'utf8'),'ReaderSurfaceResolvers.ts',{},['readerReadableFontScale','readerScaledControlHeight']);
  const childSources=Object.fromEntries([
    ['ReaderFullDirectory','reading/ui/ReaderFullDirectory'],['BookDirectoryPage','reading/ui/BookDirectoryPage'],
    ['ReaderControlDirectoryContent','reading/ui/ReaderControlDirectoryContent'],
  ].map(([name,path])=>[name,readFileSync(new URL('../entry/src/main/ets/features/'+path+'.ets',import.meta.url),'utf8')]));
  const require=createRequire(import.meta.url),componentMap=require(resolveEtsLoaderRoot()+'/lib/component_map.js');
  function fixture({debug=true,build='debug',ready=true,mode='text',expanded=true,scale=1.6,controlHeight=0}={}){
    const sdk=boundedSurfaceSdk(),children=[],events=[],actions=[],back=[];
    const metrics=createDefaultReaderWindowMetrics();metrics.windowRect.width=366;metrics.windowRect.height=844;metrics.systemFontScale=scale;
    const deps={...sdk.deps,DEBUG:debug,BUILD_MODE_NAME:build,readerDirectoryFixtureEntries,ReaderDirectoryFixturePort,readerDirectoryFixtureCopyEntry,
      resolveReaderControlLayout,ReaderControlGeometry,readerControlMotionBounds,sampleReaderControlMotionComposition,
      readerReadableFontScale,readerPageAreaLength,readerWindowMetrics:()=>metrics,
      hilog:{info(_domain,_tag,_format,payload){events.push(JSON.parse(payload));}}};
    for(const name of Object.keys(childSources))deps[name]=class{constructor(owner,params,_storage,id){Object.assign(this,{owner,params,id,name});children.push(this);}updateStateVars(params){Object.assign(this.params,params);}};
    const saved=new Map(componentMap.ID_ATTRS);componentMap.ID_ATTRS.clear();let page;
    try{({owner:page}=createReaderBuilderProbe(source,boundedMembers(source),deps,{...sdk.hooks,childSources}));}
    finally{componentMap.ID_ATTRS.clear();for(const [k,v]of saved)componentMap.ID_ATTRS.set(k,v);}
    Object.assign(page,{fontsReady:ready,mode,controlExpanded:expanded,controlViewportHeight:controlHeight,onAction:(kind,index)=>actions.push([kind,index]),onBack:()=>back.push(true)});
    page.aboutToAppear();return{page,sdk,children,events,actions,back,metrics};
  }
  async function initializerSafety(){
    for(const debug of [true,false])for(const build of ['debug','release'])for(const ready of [true,false]){
      const f=fixture({debug,build,ready});f.page.initialRender();
      const admitted=debug&&build==='debug'&&ready;assert.equal(f.page.admitted(),admitted);
      assert.equal(f.page.entries.length,admitted?60:0);assert.equal(f.children.length,admitted?1:0);
    }
    for(const mode of ['text','manga','control']){
      const f=fixture({mode});f.page.measure({width:'320vp',height:'700vp'});f.page.initialRender();
      const child=f.children.at(-1);assert.equal(child.name,mode==='text'?'ReaderFullDirectory':mode==='manga'?'BookDirectoryPage':'ReaderControlDirectoryContent');
      assert.equal(typeof child.params.navigationPortFactory,'function');
      if(mode!=='manga')assert.equal(child.params.bookmarkIdentity.bookId,f.page.identity().bookId);
      assert.equal(child.params.entries.length,60);
      if(mode==='control'){
        assert.equal(child.params.availableWidth,f.page.controlFrame().content.width);assert.equal(child.params.availableHeight,f.page.controlFrame().content.height);
        assert.equal(child.params.progress,1);assert.equal(child.params.interactionEnabled,true);
      }
      const event=f.events.findLast(e=>e.kind==='actual-area');assert.equal(event.actualWidthVp,320);assert.equal(event.systemFontScale,1.6);
    }
    const {ts,options}=installedEtsCompiler();
    for(const [path,text]of[[String(file),source],[String(dataFile),dataSource]]){
      const tree=ts.createSourceFile(path,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,options);assert.deepEqual(tree.parseDiagnostics,[]);
      const imports=tree.statements.filter(ts.isImportDeclaration).filter(n=>n.importClause?.isTypeOnly!==true).map(n=>n.moduleSpecifier.text);
      assert(!imports.some(value=>/RuntimeOwner|Gateway|Host|Core|Network|HTTP/.test(value)),imports.join(','));
    }
    assert(!source.includes('@Entry'));assert(!source.includes('AppStorage.set'));assert(!source.includes('registerFont('));
  }
  async function memoryActions(){
    const f=fixture(),p=f.page.presentation;f.page.initialRender();const old=f.children.at(-1).params;
    const entry=f.page.entries[1];old.onDownloadChapter(entry.index);assert.equal(f.page.entries[1].downloadState,'queued');
    old.onSelectChapter(35);assert.equal(f.page.currentChapterIndex,35);
    old.onClearBookOffline();assert(f.page.entries.every(e=>e.downloadState==='missing'));
    old.onCreateChapterStartBookmark({chapterIndex:1,chapterTitle:entry.title});assert.equal(f.page.entries[1].bookmarks.length,1);
    old.onDeleteBookmarks([f.page.entries[1].bookmarks[0].time]);assert.equal(f.page.entries[1].bookmarks.length,0);
    f.page.resetFixture();assert.notEqual(f.page.presentation,p);const count=f.page.intentCount;
    old.onSelectChapter(3);old.onExit();assert.equal(f.page.intentCount,count);assert.equal(f.back.length,0);
    f.page.aboutToDisappear();f.page.intent(f.page.presentation,'download-book');assert.equal(f.page.intentCount,count);
    let active=true;const reads=[],port=new ReaderDirectoryFixturePort('fixture','book','view',()=>readerDirectoryFixtureEntries(false),()=>active,(k,i)=>reads.push([k,i]));
    const view=await port.open({sourceId:'fixture',bookId:'book',chapterIndex:21});assert.equal(view.status,'ready');assert(view.nodes.some(n=>n.kind==='group'));assert(view.nodes.some(n=>n.kind==='target'));
    assert.deepEqual(await port.resolveTarget('book','view','fixture-chapter-21'),{kind:'chapterStart',chapterIndex:21,chapterOffsetScalar:0});
    active=false;await assert.rejects(()=>port.open({sourceId:'fixture',bookId:'book'}),/retired/);await assert.rejects(()=>port.resolveTarget('book','view','fixture-chapter-21'),/retired/);
  }
  async function shortControlViewport(){
    for(const height of [0,122,168,190,-1,123,NaN,Infinity]){
      const f=fixture({mode:'control',scale:2,controlHeight:height});
      f.page.measure({width:'320vp',height:'844vp'});f.page.initialRender();
      const allowed=[122,168,190].includes(height),actual=f.children.at(-1).params;
      assert.equal(actual.availableHeight,allowed?height:f.page.controlFrame().content.height);
      assert.equal(f.page.requestedControlHeight(),allowed?height:0);
      assert.equal(actual.availableWidth,f.page.controlFrame().content.width);
      f.page.measureControl(f.page.presentation,{width:'286vp',height:'118vp'});
      const measured=f.events.findLast(e=>e.kind==='actual-control-area');
      assert.equal(measured.actualControlWidthVp,286);assert.equal(measured.actualControlHeightVp,118);
      assert.equal(measured.requestedControlHeightVp,allowed?height:0);
      assert.equal(measured.initialRequestedControlHeightVp,allowed?height:0);
      assert.equal(measured.systemFontScale,2,'Reads the metrics provider; does not write an injected AppStorage scale');
      const epoch=f.page.presentation;f.page.aboutToDisappear();f.page.measureControl(epoch,{width:'2vp',height:'2vp'});
      assert.equal(f.page.actualControlHeight,118,'Retired Area cannot change the last real observation');
    }
    for(const props of [{debug:false},{build:'release'},{ready:false}]){
      const f=fixture({...props,mode:'control',controlHeight:122});f.page.initialRender();
      assert.equal(f.children.length,0);assert.equal(f.page.requestedControlHeight(),0);
    }
    for(const props of [{mode:'text'},{mode:'manga'},{mode:'control',expanded:false}]){
      const f=fixture({...props,controlHeight:122});assert.equal(f.page.requestedControlHeight(),0);
    }
  }
  async function dynamicControlViewport(){
    const {resolveReaderControlDirectoryGeometry}=await import('../entry/src/main/ets/features/reading/ui/ReaderControlDirectoryGeometry.ts');
    const {sampleReaderControlBookmark}=await import('../entry/src/main/ets/features/reading/ui/ReaderControlBookmarkGeometry.ts');
    const controlFile=new URL('../entry/src/main/ets/features/reading/ui/ReaderControlDirectoryContent.ets',import.meta.url);
    for(const width of [320,366])for(const scale of [1.45,2]){
      const f=fixture({mode:'control',scale,controlHeight:122}),p=f.page;
      f.metrics.statusBarHeight=39;
      p.measure({width:width+'vp',height:'844vp'});p.initialRender();
      const child=f.children.at(-1),factory=p.navigationFactory,port=factory(),presentation=p.presentation;
      const session=child.params.sessionKey,book=p.identity().bookId,actors=f.children.length;
      const hud=[...p.nodes.values()].filter(n=>n.type==='Text'&&/^reader-directory-viewport-/.test(n.id??''));
      assert.equal(hud.length,4);assert.equal(p.viewportHudVisible(),true);
      for(const node of hud){assert.equal(node.focusable,false);assert.equal(node.focusOnTouch,false);assert.equal(node.width,p.viewportHudButtonWidth());assert.equal(node.height,p.viewportHudHeight());}
      const row=[...p.nodes.values()].find(n=>n.type==='Row'&&n.width===p.viewportHudWidth()&&n.position?.y===p.controlLayout().topBarTop);
      assert(row);assert.equal(row.focusable,false);assert.equal(row.focusOnTouch,false);
      assert(row.position.y>=39);assert(row.position.y+row.height+8<=p.controlTop());
      assert(row.position.y+row.height<=p.controlLayout().viewportHeight-p.controlLayout().dockBottomGap);
      const byHeight=h=>hud.find(n=>n.create===String(h));
      for(const h of [320,168,190,122,320]){
        byHeight(h).onClick();p.replay();
        assert.equal(p.requestedControlHeight(),h);assert.equal(p.controlHeight(),h);assert.equal(child.params.availableHeight,h,'HUD height is not subtracted from the actor');
        const nativeActor=[...p.nodes.values()].find(n=>n.type==='__Common__'&&n.height===h&&n.position?.y===p.controlTop());
        assert(nativeActor,'native child modifier reserves exact requested height');
        assert.equal(f.children.length,actors);assert.equal(f.children.at(-1),child,'SDK updates the same Content child');
        assert.equal(p.navigationFactory,factory);assert.equal(factory(),port);assert.equal(child.params.navigationPortFactory,factory);
        assert.equal(p.presentation,presentation);assert.equal(child.params.sessionKey,session);assert.equal(p.identity().bookId,book);assert.equal(p.intentCount,0);assert.deepEqual(f.actions,[]);
      }
      const revisionSubscribers=f.sdk.properties.dependencies.get(p)?.get('windowMetricsRevision');
      for(const node of hud){const nativeId=[...p.nodes.entries()].find(([_id,value])=>value===node)?.[0];assert(revisionSubscribers?.has(nativeId),'HUD budgets subscribe through the existing metrics revision');}
      const updatedScale=scale===1.45?2:1.45;
      f.metrics.systemFontScale=updatedScale;p.windowMetricsRevision+=1;f.sdk.properties.flush(owner=>owner===p);
      for(const node of hud)assert.equal(node.width,Math.max(56,24*updatedScale+12),'published metrics update replays actual SDK width observers without Area or manual replay');
      assert.equal(row.width,p.viewportHudWidth());assert.equal(f.children.at(-1),child);assert.equal(p.presentation,presentation);assert.equal(factory(),port);
      f.metrics.systemFontScale=scale;p.windowMetricsRevision+=1;f.sdk.properties.flush(owner=>owner===p);
      for(const node of hud)assert.equal(node.width,p.viewportHudButtonWidth());
      p.measureControl(presentation,{width:child.params.availableWidth+'vp',height:'319vp'});
      const observation=f.events.at(-1);assert.equal(observation.initialRequestedControlHeightVp,122);assert.equal(observation.requestedControlHeightVp,320);assert.equal(observation.actualControlHeightVp,319,'request and measured receipt are independent');
      const providerCalls=[];
      child.params.onMinimumMeasurerReady(`directory-fixture:${presentation}:${p.controlTab}`,(widths,key)=>{
        providerCalls.push({widths,key});
        return{module:'directory',quick:{heightVp:100,minWidthVp:44,fits:true},full:{heightVp:220,minWidthVp:44,fits:true}};
      });
      p.replay();assert.equal(providerCalls.length,1,'actual fixture calls its current child minimum provider once');
      assert.equal(providerCalls[0].widths.fullContentWidthVp,child.params.availableWidth);
      assert.equal(child.params.minimumKey,providerCalls[0].key,'same retained child receives the resulting profile key');
      f.metrics.keyboardInsets.bottom=830;assert.equal(p.viewportHudVisible(),false,'insufficient clear space above IME hides HUD');
      const prior=p.requestedControlHeight();byHeight(122).onClick();assert.equal(p.requestedControlHeight(),prior,'hidden HUD callback cannot change the fixture');
      f.metrics.keyboardInsets.bottom=0;p.measure({width:'240vp',height:'844vp'});assert.equal(p.viewportHudVisible(),false,'HUD never overflows insufficient actual width');
      p.measure({width:width+'vp',height:'844vp'});assert.equal(p.viewportHudVisible(),true);
      f.metrics.systemFontScale=3.2;assert(p.viewportHudButtonWidth()>56);assert(p.viewportHudHeight()>44);assert.equal(p.viewportHudVisible(),false,'larger type grows its budget; no cap or forced overlay');f.metrics.systemFontScale=scale;
      const oldHud=byHeight(168).onClick;p.resetFixture();const resetPresentation=p.presentation,resetFactory=p.navigationFactory;oldHud();assert.equal(p.requestedControlHeight(),122);assert.equal(p.presentation,resetPresentation);assert.equal(p.navigationFactory,resetFactory);assert.notEqual(resetFactory,factory);
      p.aboutToDisappear();oldHud();assert.equal(p.localControlViewportHeight,122,'retired HUD cannot edit local state');
    }
    for(const props of [{mode:'text'},{mode:'manga'},{mode:'control',controlHeight:0},{mode:'control',expanded:false},{mode:'control',debug:false},{mode:'control',ready:false},{mode:'control',build:'release'},{mode:'control',controlHeight:320}]){
      const f=fixture({mode:'control',controlHeight:122,...props});f.page.measure({width:'366vp',height:'844vp'});f.page.initialRender();
      assert.equal(f.page.viewportHudVisible(),false);assert(![...f.page.nodes.values()].some(n=>/^reader-directory-viewport-/.test(n.id??'')));
    }
  }
  const surfaceFile=new URL('../entry/src/main/ets/features/reading/ui/ReaderDirectoryNavigationSurface.ets',import.meta.url);
  const listFile=new URL('../entry/src/main/ets/features/reading/ui/ReaderDirectoryNavigationList.ets',import.meta.url);
  const productionData=productionMangaDirectoryNavigationDataSource();
  const tick=()=>new Promise(resolve=>setImmediate(resolve));
  function surface({factory,runtimeAllowed=false,open}={}){
    let runtimeCalls=0,gatewayCalls=0;
    const runtime={supportsCoreCapability(){return false;}};
    const Surface=selectedProductionMethods(surfaceFile,'ReaderDirectoryNavigationSurface',
      ['aboutToAppear','aboutToDisappear','openTree','prepareVisiblePages','cancelQueryTimer'],{
        ...navigation,...navigationSession,ReaderDirectoryTrace,
        ReaderRuntimeOwner:{current(){runtimeCalls++;assert(runtimeAllowed,'fixture cannot obtain RuntimeOwner');return runtime;}},
        ReaderDirectoryNavigationGateway:class{constructor(owner){assert.equal(owner,runtime);gatewayCalls++;}},
        readerDirectoryObserveScrollIntent:()=>()=>{},readerDirectoryViewportAnchor:()=>undefined,
        cacheReaderDirectoryNavigationPage:productionData.cacheReaderDirectoryNavigationPage,
      });
    const owner=Object.assign(new Surface(),{navigationPortFactory:factory,mangaDisplay:false,query:'',ascending:true,
      currentChapterIndex:21,sourceId:'directory-native-fixture',bookId:'text:1',generation:0,
      mounted:false,interactionEnabled:true,interacted:false,settledFlat:false,queryTimer:-1,
      mangaFontGeneration:0,feedback:{reset(){}},onTreeStateChange(){},
      notifyReadFailure(){assert.fail('valid typed static view must not fail');},
      ...(open?{openTree:open}:{})});
    return {owner,runtimeCalls:()=>runtimeCalls,gatewayCalls:()=>gatewayCalls};
  }
  function listInitial(factory,runtimeAllowed=false){
    let calls=0;const nativeRuntime={};
    const List=selectedProductionMethods(listFile,'ReaderDirectoryNavigationList',['aboutToAppear','nativeHeaderCount','bindPrefixScrollIntent'],{
      ReaderRuntimeOwner:{current(){calls++;assert(runtimeAllowed,'fixture List cannot obtain RuntimeOwner');return nativeRuntime;}},
      ReaderDirectoryNavigationGateway:class{constructor(owner){assert.equal(owner,nativeRuntime);}},
      readerDirectoryObserveScrollCommand:()=>()=>{},readerDirectoryScopeKey:navigation.readerDirectoryScopeKey,
    });
    const owner=Object.assign(new List(),{navigationPortFactory:factory,generation:0,mangaPresentationRevision:0,
      sourceId:'directory-native-fixture',bookId:'text:1',view:{viewId:'injected'},
      dataSource:{replace(){}},planPosition:()=>undefined,onChapterEntriesChanged(){}});
    owner.aboutToAppear();return {owner,calls};
  }
  async function defaultVsFixture(){
    const original=surface({runtimeAllowed:true,open(){}});original.owner.aboutToAppear();
    assert.equal(original.runtimeCalls(),1);assert.equal(original.gatewayCalls(),1);assert(original.owner.runtimeOwner);
    assert.equal(listInitial(undefined,true).calls,1);
    const port={},injected=surface({factory:()=>port,open(){}});injected.owner.aboutToAppear();
    assert.equal(injected.owner.gateway,port);assert.equal(injected.owner.runtimeOwner,undefined);assert.equal(injected.runtimeCalls(),0);assert.equal(injected.gatewayCalls(),0);
    const list=listInitial(()=>port);assert.equal(list.owner.gateway,port);assert.equal(list.calls,0);
  }
  async function noRuntime(){
    const f=fixture(),port=f.page.navigationFactory();
    const s=surface({factory:()=>port});s.owner.bookId=f.page.identity().bookId;s.owner.aboutToAppear();await tick();
    assert.equal(s.runtimeCalls(),0);assert.equal(s.owner.view.visibleTotal,64);assert.equal(s.owner.view.identity.bookId,f.page.identity().bookId);
    assert.equal(s.owner.view.nodes.length,0,'real production cache owns the prepared nodes');
    const data=new productionData.ReaderDirectoryNavigationDataSource(()=>assert.fail('one bounded static view is resident'));
    data.replace(s.owner.view);assert.equal(data.getData(0).node.kind,'group');assert.equal(data.getData(1).node.kind,'target');
    const l=listInitial(()=>port);assert.equal(l.calls,0);
    s.owner.aboutToDisappear();
  }
  async function capturedRetire(){
    const f=fixture(),oldFactory=f.page.navigationFactory,oldPort=oldFactory();
    f.page.resetFixture();assert.throws(()=>oldFactory(),/retired/);
    await assert.rejects(()=>oldPort.open({sourceId:'directory-native-fixture',bookId:'text:1'}),/retired/);
    let complete;const port={open:()=>new Promise(resolve=>{complete=resolve;}),page(){assert.fail('no next page');}};
    const s=surface({factory:()=>port});s.owner.aboutToAppear();s.owner.aboutToDisappear();
    complete({status:'ready',viewId:'retired',navigationRevision:'retired',visibleTotal:0,nodes:[]});await tick();
    assert.equal(s.owner.view,undefined,'retired opening cannot publish into disposed Surface');
    let resolveTarget,guard;const selections=[];
    const List=selectedProductionMethods(listFile,'ReaderDirectoryNavigationList',['selectTarget'],{});
    const list=Object.assign(new List(),{mounted:true,interactionEnabled:true,generation:1,selectionGeneration:0,
      bookId:'fixture-book',view:{viewId:'fixture-view'},gateway:{resolveTarget(_book,_view,_node,current){guard=current;return new Promise(resolve=>{resolveTarget=resolve;});}},
      onSelectTarget:(...args)=>selections.push(args),onInvalidated(){assert.fail('retired rejection is quiet');}});
    list.selectTarget({kind:'target',nodeId:'n1',chapterIndex:1});assert.equal(guard(),true);
    list.mounted=false;list.generation+=1;assert.equal(guard(),false);resolveTarget({chapterIndex:1,chapterOffsetScalar:0});await tick();assert.deepEqual(selections,[]);
  }
  const cases={'initializer-safety':initializerSafety,'memory-actions':memoryActions,'default-vs-fixture':defaultVsFixture,'no-runtime':noRuntime,'captured-retire':capturedRetire,'short-control-viewport':shortControlViewport,'dynamic-control-viewport':dynamicControlViewport};
  for(const id of selected){await cases[id]();recordContractCasePass(id);}
}
