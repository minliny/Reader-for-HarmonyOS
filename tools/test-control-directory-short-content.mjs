import { readerEditingSdk } from './lib/reader-editing-sdk-probe.mjs';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createRequire,registerHooks} from 'node:module';
import {fileURLToPath} from 'node:url';
import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
const selected=selectContractCases({
 'short-sdk':'Actual SDK persistent editing Scroll plus one result List at 122/168/190 x2; real query/clear/sort actions and stale callback rejection. No native layout claim.',
 'prefix-anchors':'Actual owner methods and SDK retained Surface reference across authored/short: Native/data index, header-not-chapter, Tree anchor delegation, retired idle/focus and actual current action callbacks.',
 'bookmark-branch-admission':'Actual flat bookmark row accepts its current opening from a retained parent Builder, and rejects the retired row after the tab is reopened.',
 'directory-focus':'Actual SearchField opt-in modifier and finite after-layout focus, current id/revision/mounted guards, cancel/old callback and default disabled/no setter negative controls; Toolbar local opt-in lifetime.',
 'measured-profile':'Actual shipping minimum producer and current Content profile consume one measured layout; short prefix/focus stays local, and retired providers cannot publish.',
 'keyboard-ack-delay':'Retained opt-in Field API with an explicit positive focus revision: delayed Native ACK admits one show and rejects old/repeated ACKs. Normal geometry does not issue that revision; finite API ports only.',
 'keyboard-transfer':'Actual owner and SDK Toolbar instance/id survive height thresholds without a manufactured focus request; old business opening callbacks remain fenced. Native composition remains unproved.',
 'keyboard-observation':'Actual SDK Content and Field modifier distinguish fresh unknown keyboard inset0 from observed-visible then hidden, retain policy across same-instance layout migration and retire old opening callbacks/frames. No Native keyboard service or IME claim.',
 'foreground-recovery':'Actual stable Full toolbar ancestor retains its enabled, accessibility and hit-test dependency through a background-created actor and foreground delivery, with original temporary-editor admission.',
});
if(selected.length){
 const editingSdk=readerEditingSdk();
 registerHooks({resolve(s,c,n){if(s.startsWith('.')&&!/\.[a-z]+$/i.test(s)){const u=new URL(s+'.ts',c.parentURL);if(existsSync(fileURLToPath(u)))return n(u.href,c);}return n(s,c);}});
 const {readerControlKeyboardVisible}=await import('../entry/src/main/ets/ui/foundation/ReaderKeyboardBack.ts');
 const {createReaderBuilderProbe}=await import('./lib/reader-control-builder-probe.mjs');
 const {boundedSurfaceSdk,boundedMembers}=await import('./lib/bounded-surface-sdk-probe.mjs');
 const {pureModuleProbe}=await import('./lib/ets-pure-module-probe.mjs');
 const {resolveEtsLoaderRoot}=await import('./lib/tool-environment.mjs');
 const {readerControlDirectorySnapshot,ReaderControlDirectoryPosition}=await import('../entry/src/main/ets/features/reading/ui/ReaderControlDirectoryModel.ts');
 const {readerBookmarkEmptyCopy}=await import('../entry/src/main/ets/features/reading/presentation/ReaderBookmarkProjection.ts');
 const {resolveReaderControlDirectoryGeometry}=await import('../entry/src/main/ets/features/reading/ui/ReaderControlDirectoryGeometry.ts');
 const {sampleReaderControlMotionPresentation}=await import('../entry/src/main/ets/features/reading/ui/ReaderControlMotionPresentation.ts');
 const {sampleReaderControlBookmark}=await import('../entry/src/main/ets/features/reading/ui/ReaderControlBookmarkGeometry.ts');
 const {EMPTY_READING_DIRECTORY_RECOVERY}=await import('../entry/src/main/ets/features/reading/presentation/ReadingDirectoryRecovery.ts');
 const {ReaderDirectoryDataPublication}=await import('../entry/src/main/ets/features/reading/presentation/ReaderDirectoryDataSnapshot.ts');
 const {readerPageAreaLength}=await import('../entry/src/main/ets/ui/layout/ReaderPageShell.ts');
 const read=n=>readFileSync(new URL('../entry/src/main/ets/features/'+n,import.meta.url),'utf8');
 const content=read('reading/ui/ReaderControlDirectoryContent.ets'),field=read('../ui/controls/ReaderSearchField.ets'),toolbar=read('reading/ui/ReaderDirectoryToolbar.ets');
 const directoryFacts=pureModuleProbe(read('reading/ui/ReaderControlDirectoryMinimum.ets'),'ReaderControlDirectoryMinimum.ets',{readerBookmarkEmptyCopy},['readerControlDirectoryMinimumFacts']);
 const factsProtocol=pureModuleProbe(read('reading/ui/ReaderControlMinimumMeasurement.ets'),'ReaderControlMinimumMeasurement.ets',{},['readerControlModuleFactsGeometryKey','readerControlModuleFactsMatch','readerControlModuleProfileMatches']);
 const {readerDirectoryToolbarBudget}=await import('../entry/src/main/ets/features/reading/presentation/ReaderFullDirectoryBudget.ts');
 const {readerReadableFontScale,readerScaledControlHeight}=pureModuleProbe(read('../ui/foundation/ReaderSurfaceResolvers.ts'),'ReaderSurfaceResolvers.ts',{},['readerReadableFontScale','readerScaledControlHeight']);
 const accessibility=pureModuleProbe(read('../ui/controls/ReaderActionAccessibility.ets'),'ReaderActionAccessibility.ets',{AccessibilityRoleType:{BUTTON:'button'}},['readerActionTouchRegion','ReaderActionAccessibility']);
 const require=createRequire(import.meta.url),map=require(resolveEtsLoaderRoot()+'/lib/component_map.js');
 const compile=f=>{const ids=map.ID_ATTRS,saved=new Map(ids);ids.clear();try{return f();}finally{ids.clear();for(const[k,v]of saved)ids.set(k,v);}};
 const frameDeps={FrameCallback:class{}};
 const classes=pureModuleProbe(content.slice(0,content.indexOf('@Component')),'ReaderControlDirectoryContent.ets',frameDeps,['ControlDirectoryDataSource','ControlDirectoryFrame']);
 const fieldClasses=pureModuleProbe(field.slice(0,field.indexOf('@Component')),'ReaderSearchField.ets',{...frameDeps,...accessibility},['ReaderSearchInputTarget','ReaderSearchFocusFrame']);
 let minimumMeasure;
 const entries=()=>Array.from({length:60},(_,i)=>({index:i,title:'第'+i+'章 长章节标题',navigable:true,bookmarks:[{time:i+1,chapterIndex:i,chapterOffset:0,chapterTitle:'第'+i+'章',content:'完整书签正文与长内容',bookText:'正文'}]}));
 const identity={sourceId:'fixture',bookId:'book',libraryBookId:'fixture:book',bookName:'Fixture',bookAuthor:'Author'};
 function actor({height=168,width=268,scale=2,tab='directory',tree=false,source=content}={}){
  const sdk=boundedSurfaceSdk(),frames=[],children=[],calls=[],scroll=[],port={kind:'existing-business-port'},metrics={ready:true,systemFontScale:scale,keyboardInsets:{bottom:0}};let portCreations=0;
  class Child{constructor(owner,params,_storage,id){Object.assign(this,{owner,params,id});children.push(this);}updateStateVars(next){Object.assign(this.params,next);}}
  class Surface extends Child{constructor(...args){super(...args);this.port=this.params.navigationPortFactory?.();}}
  const childSources={ReaderSearchField:field,ReaderDirectoryToolbar:toolbar,ReaderDirectoryNavigationSurface:read('reading/ui/ReaderDirectoryNavigationSurface.ets'),ReaderDirectoryChapterRow:read('reading/ui/ReaderDirectoryChapterRow.ets'),ReaderBookmarkRow:read('reading/ui/ReaderBookmarkRow.ets'),ReaderBookmarkEmptyState:read('reading/ui/ReaderBookmarkEmptyState.ets'),ReaderBookmarkLoadingState:read('reading/ui/ReaderBookmarkLoadingState.ets'),ReaderBookmarkErrorState:read('reading/ui/ReaderBookmarkErrorState.ets')};
  const scroller={offset:0,index:1,rect:{y:0,height:64},scrollToIndex(...v){scroll.push(['index',...v]);},scrollTo(v){scroll.push(['offset',v]);},scrollEdge(v){scroll.push(['edge',v]);},currentOffset(){return{yOffset:this.offset};},getItemIndex(){return this.index;},getItemRect(){return this.rect;}};
  const deps={...sdk.deps,...editingSdk,readerControlKeyboardVisible,...directoryFacts,...factsProtocol,...classes,...accessibility,EMPTY_READING_DIRECTORY_RECOVERY,readerControlDirectorySnapshot,ReaderControlDirectoryPosition,resolveReaderControlDirectoryGeometry,readerReadableFontScale,readerScaledControlHeight,readerPageAreaLength,
   measureReaderDirectoryMinimum:(...args)=>minimumMeasure(...args),sampleReaderControlBookmark,sampleReaderControlMotionPresentation,readerWindowMetrics:()=>metrics,ReaderWindowCoordinator:{metrics:()=>metrics},
   ReaderSearchField:Child,ReaderDirectoryToolbar:Child,ReaderDirectoryNavigationSurface:Surface,ReaderDirectoryChapterRow:Child,ReaderBookmarkRow:Child,
   ReaderBookmarkEmptyState:Child,ReaderBookmarkLoadingState:Child,ReaderBookmarkErrorState:Child,
   uiContext:{getFont:()=>({}),postFrameCallback:f=>frames.push(f)},Scroller:class{},ViewStackProcessor:{StartGetAccessRecordingFor(){},StopGetAccessRecording(){}},
   Edge:{Top:'Edge.Top',Bottom:'Edge.Bottom'},ScrollAlign:{START:'ScrollAlign.START',CENTER:'ScrollAlign.CENTER'},ScrollSource:{SCROLLER:'ScrollSource.SCROLLER'},
   LazyForEach:{name:'LazyForEach',create(_id,_owner,data,generator){for(let i=0;i<data.totalCount();i++)generator(data.getData(i),i);},pop(){}},
   readerDirectoryScopeKey:()=> 'fixture:book',readerDirectorySignalScrollIntent(){},readerDirectorySignalScrollCommand(){},
  };
  const {owner}=compile(()=>createReaderBuilderProbe(source,boundedMembers(source),deps,{...sdk.hooks,childSources:{...sdk.childSources,...childSources}}));
  const data=entries(),publication=new ReaderDirectoryDataPublication(),revision=publication.publish(data);
  Object.assign(owner,{availableHeight:height,availableWidth:width,progress:1,interactionEnabled:true,readerWindowMetricsRevision:1,entries:data,directoryPublication:publication,directoryEntriesRevision:revision,tab,sessionKey:'fixture-book',currentChapterIndex:21,
   bookmarkIdentity:tree||tab==='bookmarks'?identity:undefined,navigationPortFactory:()=>{portCreations++;return port;},
   scroller,onTabChange:t=>calls.push('tab:'+t),onSelectChapter:i=>calls.push('chapter:'+i),onRequireCompleteCatalog:()=>calls.push('require-catalog')});
  owner.aboutToAppear();
  const rendered=new Set();
  function renderListItems(){
   for(const node of owner.nodes.values()){
    if(node.type!=='ListItem'||rendered.has(node.id))continue;
    const body=Array.isArray(node.create)?node.create[0]:node.create;
    if(typeof body==='function'){rendered.add(node.id);body(node.id,true);}
   }
  }
  return{owner,sdk,frames,children,calls,scroll,scroller,deps,metrics,Surface,port,portCreations:()=>portCreations,
   render(){owner.initialRender();renderListItems();},renderListItems,
   flush(){while(frames.length){const f=frames.shift();f.onFrame?.(0);f.onIdle?.(0);}}};
 }
 async function shortSdk(){
  for(const width of[268,314])for(const height of[122,168,190])for(const tab of['directory','bookmarks']){
   const x=actor({height,tab,width});assert.equal(x.owner.shortContent,true);x.render();
   const nodes=x.sdk.nodes(x.owner),lists=nodes.filter(n=>n.type==='List');assert.equal(lists.length,1,'one result List; the persistent editor has its own Scroll');
   assert.equal(x.owner.headerCount(),0);assert(x.owner.listTop()>0);assert.equal(x.owner.listHeight()+x.owner.listTop(),height);
   const items=nodes.filter(n=>n.type==='ListItem');assert.equal(items.length,x.owner.snapshot.rows.length);
   assert(items.every(n=>n.height>=44),'existing row size is retained');
   const toolbar=x.children.find(c=>c.params.variant==='full-directory');assert(toolbar,'same shipping toolbar owns the only query');
   toolbar.params.onTextChange('第1');toolbar.params.onSearch();assert.equal(x.owner.query,'第1');
   const clear=nodes.find(n=>n.type==='Button'&&n.accessibilityText==='清除搜索');assert(clear);clear.onClick();assert.equal(x.owner.query,'');
   if(tab==='directory'){
    const ascending=x.owner.ascending;toolbar.params.onTop();toolbar.params.onBottom();toolbar.params.onToggleSort();
    assert.notEqual(x.owner.ascending,ascending);assert(x.scroll.some(n=>n[0]==='edge'&&n[1]==='Edge.Bottom'));
   }
   const old=toolbar.params.onTextChange;x.owner.layoutPresentation++;old('retired');assert.equal(x.owner.draft,'','retired editor callback cannot write successor draft');
  }
  const incomplete=actor({height:122});incomplete.owner.catalogComplete=false;incomplete.render();
  const load=incomplete.sdk.nodes(incomplete.owner).find(n=>n.accessibilityText==='加载完整目录');assert(load);load.onClick();assert.deepEqual(incomplete.calls,['require-catalog']);
  const filtered=actor({height:122,tab:'bookmarks'});
  filtered.render();
  const bookmarkToolbar=filtered.children.find(child=>child.params.variant==='full-directory');
  bookmarkToolbar.params.onTextChange('unmatched query');
  bookmarkToolbar.params.onSearch();
  assert.equal(filtered.owner.snapshot.rows.length,0);
  assert.equal(filtered.owner.snapshot.bookmarkFilteredEmpty,true);
  filtered.render();
  const filteredState=filtered.children.find(child=>child.params.filtered===true);
  assert(filteredState,'the shipping bookmark body selects the filtered-empty variant');
  assert.equal(filteredState.params.compact,true);
  const {actionGeneration,onAction}=filteredState.params;
  onAction(actionGeneration-1,true);
  assert.equal(filtered.owner.query,'unmatched query','retired opening cannot reset the filter');
  onAction(actionGeneration,true);
  assert.equal(filtered.owner.query,'');
  assert.equal(filtered.owner.draft,'');
  assert.equal(filtered.owner.snapshot.rows.length,60);
  assert.deepEqual(filtered.calls,[],'clearing a filter stays on the bookmarks tab');
  for(const tab of['directory','bookmarks'])for(const state of['empty','loading','error']){
   const x=actor({tab});x.owner.snapshot={...x.owner.snapshot,rows:[],loading:state==='loading',catalogState:state==='error'?'failed':'ready'};
   x.owner.dataSource.replace([]);x.owner.bookmarkLoadFailed=tab==='bookmarks'&&state==='error';x.render();
   assert(x.sdk.nodes(x.owner).some(n=>n.type==='Button'&&n.accessibilityText==='清除搜索'),'state retains editor and clear');
   assert(x.children.some(c=>c.params.variant==='full-directory'));
   if(tab==='bookmarks'&&state==='empty'){
    const empty=x.children.find(child=>child.params.filtered===false);
    assert(empty,'genuine no-bookmark state is retained');
    empty.params.onAction(empty.params.actionGeneration,true);
    assert.deepEqual(x.calls,[],'stale clear cannot become a return-to-directory action');
    empty.params.onAction(empty.params.actionGeneration,false);
    assert.deepEqual(x.calls,['tab:directory']);
   }
  }
  console.log('Actual SDK: persistent editor Scroll, one result List, authored rows/actions, actual query/clear/sort and stale callback rejection. No native layout engine.');
 }
 async function prefixAnchors(){
  const x=actor();x.scroller.index=6;x.scroller.rect={y:-16,height:64};x.owner.captureLeadingRow();assert.equal(x.owner.leadingRow,6.25);
  x.owner.availableHeight=646;x.owner.syncContentLayout();x.owner.onListLayout();x.flush();assert(x.scroll.some(v=>v[0]==='index'&&v[1]===6),'data index is identical across editor capacity changes');
  x.scroller.index=0;x.scroller.rect={y:0,height:64};x.owner.captureLeadingRow();assert.equal(x.owner.leadingRow,0,'chapter zero is no longer a List prefix');
  x.owner.layoutRestorePending=true;x.owner.queueLayoutRestore();const before=x.scroll.length;x.owner.userScroll();x.flush();assert.equal(x.scroll.length,before,'user scroll retires queued correction');
  const t=actor({height:646,tree:true});t.owner.initialRender();const child=[...t.owner.children.values()].find(c=>c instanceof t.Surface);assert(child);const key=child.id;
  child.params.onTreeStateChange(true);t.scroller.index=37;t.owner.captureLeadingRow();assert.equal(t.owner.leadingRow,undefined,'Core tree rank never becomes a flat index');
  t.owner.availableHeight=122;t.owner.syncContentLayout();t.owner.replayOnly([key]);assert.equal(t.owner.children.get(key),child);assert.equal(child.params.headerCount,0);assert.equal(child.port,t.port);assert.equal(t.portCreations(),1);
  t.owner.onListLayout();t.flush();assert.equal(t.scroll.length,0,'editor geometry never overwrites the existing NavigationList anchor');
 }
 function focusField({variant='readerDirectory',id='directory:current',allowed=true,revision=1,keyboard=true,current=()=>true,source=field,ackFocus=false,show=()=>Promise.resolve(),initial={},rectangle}={}){
  const sdk=boundedSurfaceSdk(),frames=[],focus=[],events=[],keyboardRequests=[],keyboardSettled=[];
  const deps={...sdk.deps,...editingSdk,readerControlKeyboardVisible,...fieldClasses,...accessibility,readerPageAreaLength,readerReadableFontScale,readerScaledControlHeight,
   ReaderWindowCoordinator:{metrics:()=>({systemFontScale:2})},TextInputController:class{},
   DEBUG:false,
   uiContext:{getFont:()=>({}),postFrameCallback:f=>frames.push(f),getComponentUtils:()=>({getRectangleById:()=>rectangle}),px2vp:value=>value/3.5,getFocusController:()=>({requestFocus:id=>{focus.push(id);if(ackFocus)owner.onDirectoryInputFocus(id,true);}})},
   inputMethod:{getController:()=>({showTextInput:()=>{keyboardRequests.push(id);return show();}})},
   hilog:{warn(){}},KeyCode:{KEYCODE_BACK:2},KeyType:{Down:0,Up:1}};
  const{owner}=compile(()=>createReaderBuilderProbe(source,boundedMembers(source),deps,sdk.hooks));
  Object.assign(owner,{variant,mode:'submit',readerWindowMetricsRevision:1,directoryFocusId:id,directoryFocusAllowed:allowed,directoryFocusRevision:revision,directoryKeyboardOnFocus:keyboard,directoryFocusCurrent:current,onDirectoryFocusChanged:(id,value)=>events.push([id,value]),onDirectoryKeyboardRestoreSettled:(id,value)=>keyboardSettled.push([id,value]),onTextChange(){},onSubmit(){}},initial);owner.aboutToAppear();owner.initialRender();
  const inputEntry=[...owner.nodes.entries()].find(([,n])=>n.type==='TextInput');
  return{owner,sdk,frames,focus,events,keyboardRequests,keyboardSettled,input:inputEntry?.[1],updateKeyboard(value){owner.directoryKeyboardOnFocus=value;owner.replayOnly([inputEntry[0]]);},flush(){while(frames.length){const f=frames.shift();f.onFrame?.(0);f.onIdle?.(0);}}};
 }

 function toolbarSdk({id='toolbar:current',current=()=>true,initial={}}={}){
  const sdk=boundedSurfaceSdk(),children=[],events=[];
  class Child{constructor(owner,params,_storage,id){Object.assign(this,{owner,params,id});children.push(this);}updateStateVars(next){Object.assign(this.params,next);}}
  const deps={...sdk.deps,...editingSdk,readerControlKeyboardVisible,ReaderSearchField:Child,READER_DIRECTORY_TOOLBAR_HEIGHT:50,readerReadableFontScale,readerScaledControlHeight,ReaderWindowCoordinator:{metrics:()=>({systemFontScale:2})}};
  const{owner}=compile(()=>createReaderBuilderProbe(toolbar,boundedMembers(toolbar),deps,{...sdk.hooks,childSources:{...sdk.childSources,ReaderSearchField:field}}));
  Object.assign(owner,{directoryFocusId:id,directoryFocusAllowed:id.length>0,directoryFocusRevision:1,directoryKeyboardOnFocus:false,directoryFocusCurrent:current,onTextChange:v=>events.push(['text',v]),onSearch:()=>events.push(['search']),onDirectoryFocusChanged:(id,value)=>events.push(['focus',id,value])},initial);owner.aboutToAppear();owner.initialRender();
  return{owner,sdk,children,events};
 }
 async function directoryFocus(){
  const tool=toolbarSdk();const tf=tool.children[0];assert.equal(tf.params.directoryFocusId,'toolbar:current');assert.equal(tf.params.directoryKeyboardOnFocus,false);tf.params.onTextChange('live');tf.params.onSubmit();assert.equal(tool.events.length,2);tool.owner.directoryFocusId='toolbar:next';tf.params.onTextChange('old');tf.params.onSubmit();assert.equal(tool.events.length,2,'actual Toolbar callbacks reject previous input id');
  const retiredTool=toolbarSdk();const oldTool=retiredTool.children[0];retiredTool.owner.aboutToDisappear();oldTool.params.onSubmit();assert.equal(retiredTool.events.length,0);
  let currentTool=true;const delayedTool=toolbarSdk({current:()=>currentTool});currentTool=false;assert.equal(delayedTool.children[0].params.directoryFocusCurrent('toolbar:current'),false);delayedTool.children[0].params.onSubmit();assert.equal(delayedTool.events.length,0);
  const defaultTool=toolbarSdk({id:''});defaultTool.children[0].params.onTextChange('default');defaultTool.children[0].params.onSubmit();assert.equal(defaultTool.events.length,2,'default Toolbar natural input/actions retain behavior');
  const f=focusField();assert.equal(f.input.id,'directory:current');assert.equal(f.input.enableKeyboardOnFocus,true);assert.equal(f.focus.length,0);f.input.onAreaChange({}, {width:200,height:68});assert.equal(f.frames.length,1);f.flush();assert.deepEqual(f.focus,['directory:current']);f.input.onAreaChange({}, {width:200,height:68});f.flush();assert.equal(f.focus.length,1,'one actual layout/revision request only');
  f.input.onFocus();assert.deepEqual(f.events.at(-1),['directory:current',true]);
  const oldFocus=f.input.onFocus,oldArea=f.input.onAreaChange;f.owner.directoryFocusId='directory:successor';f.owner.onDirectoryFocusRequest();oldFocus();oldArea({}, {width:200,height:68});f.flush();assert.equal(f.events.length,1);assert.equal(f.focus.length,1,'old native input id cannot own successor');
  const pending=focusField();pending.input.onAreaChange({}, {width:200,height:68});pending.owner.directoryFocusAllowed=false;pending.owner.onDirectoryFocusRequest();pending.flush();assert.deepEqual(pending.focus,[],'cancel retires one queued idle');
  let currentOwner=true;const retiredOwner=focusField({current:()=>currentOwner});retiredOwner.input.onAreaChange({}, {width:200,height:68});currentOwner=false;retiredOwner.flush();assert.deepEqual(retiredOwner.focus,[],'live owner rejects old idle even before props/unmount reconcile');
  const gone=focusField();gone.input.onAreaChange({}, {width:200,height:68});gone.owner.aboutToDisappear();gone.flush();assert.deepEqual(gone.focus,[]);
  for(const variant of['sourceManagement','rssPassive','readerDirectory']){const v=focusField({variant,id:'',allowed:false,revision:0});for(const property of['onFocus','onBlur','enableKeyboardOnFocus'])assert.equal(v.owner.attributeCalls.some(c=>c.property===property),false);v.owner.onDirectoryFocusRequest();v.flush();assert.deepEqual(v.focus,[],'defaults never request directory focus');}
  const wrong=focusField({variant:'sourceManagement',id:'wrong',allowed:true});wrong.owner.onDirectoryFocusRequest();wrong.flush();assert.deepEqual(wrong.focus,[]);
  const ime=actor({height:646});ime.owner.onDirectoryFocus(ime.owner.layoutPresentation,ime.owner.directoryFocusId(),true);ime.metrics.keyboardInsets.bottom=200;ime.owner.availableHeight=168;ime.owner.syncContentLayout();assert.equal(ime.owner.shortContent,true);assert.equal(ime.owner.directoryRestoreKeyboard,true,'visible IME editing migration may preserve keyboard');
  const shortId=ime.owner.directoryFocusId();ime.owner.onDirectoryKeyboardRestoreSettled(ime.owner.layoutPresentation,shortId,true);ime.metrics.keyboardInsets.bottom=0;ime.owner.availableHeight=646;ime.owner.syncContentLayout();assert.equal(ime.owner.shortContent,false);assert.equal(ime.owner.directoryRestoreKeyboard,false,'Back-hidden IME is not re-opened by programmatic focus');assert.equal(ime.owner.directoryFocusId(),shortId,'height change preserves field identity');
  const hidden=focusField({id:ime.owner.directoryFocusId(),keyboard:ime.owner.directoryRestoreKeyboard});assert.equal(hidden.input.enableKeyboardOnFocus,false);hidden.input.onAreaChange({}, {width:200,height:68});hidden.flush();assert.equal(hidden.focus.length,1);hidden.input.onAreaChange({}, {width:200,height:68});hidden.owner.onDirectoryFocusRequest();hidden.flush();assert.equal(hidden.focus.length,1,'unchanged replay does not issue another focus/IME cycle');
 }
 async function keyboardObservation(){
  const x=actor({height:646});x.owner.initialRender();const toolbar=x.children.find(c=>c.params.variant==='full-directory');const id=toolbar.params.directoryFocusId,p=x.owner.layoutPresentation;
  x.owner.onDirectoryFocus(p,id,true);x.owner.syncContentLayout();assert.equal(x.owner.directoryRestoreKeyboard,true,'unknown initial zero is not Back');
  x.metrics.keyboardInsets.bottom=314;x.owner.availableHeight=122;x.owner.syncContentLayout();assert.equal(x.owner.directoryRestoreKeyboard,true);
  x.metrics.keyboardInsets.bottom=0;x.owner.syncContentLayout();assert.equal(x.owner.directoryRestoreKeyboard,false,'observed hidden edge preserves Back');
  x.owner.availableHeight=646;x.owner.syncContentLayout();assert.equal(x.owner.directoryRestoreKeyboard,false);assert.equal(x.owner.directoryFocusId(),id);
  x.owner.onDirectoryEditingRequested(p,id);assert.equal(x.owner.directoryRestoreKeyboard,true,'only explicit editing can request keyboard again');
  x.owner.onDirectoryKeyboardRestoreSettled(p,id,false);assert.equal(x.owner.directoryInputFocused,false);
 }
 async function keyboardAckDelay(){
  const before=readFileSync(new URL('./fixtures/design/directory-confluence-before/keyboard-ack-delay-field.ets.txt',import.meta.url),'utf8');
  function migration(){
   const x=actor({height:646,scale:1});
   x.owner.onDirectoryFocus(x.owner.layoutPresentation,x.owner.directoryFocusId(),true);
   // Retained opt-in focus API, not the normal geometry path: the new normal
   // path never manufactures this revision or replaces the native editor.
   x.owner.directoryFocusRevision=1;x.owner.directoryKeyboardTransferPending=true;
   return x;
  }
  function boundField(x,source=field){
   const id=x.owner.directoryFocusId(),presentation=x.owner.layoutPresentation;
   const f=focusField({id,source,revision:x.owner.directoryFocusRevision,keyboard:x.owner.directoryRestoreKeyboard});
   f.owner.onDirectoryFocusChanged=(id,value)=>x.owner.onDirectoryFocus(presentation,id,value);
   f.owner.onDirectoryKeyboardRestoreSettled=(id,value)=>{f.keyboardSettled.push([id,value]);x.owner.onDirectoryKeyboardRestoreSettled(presentation,id,value);};
   return f;
  }
  const oldOwner=migration(),old=boundField(oldOwner,before);
  old.input.onAreaChange({}, {width:200,height:44});old.flush();
  assert.equal(old.focus.length,1);assert.equal(old.keyboardRequests.length,0);
  old.input.onFocus();old.flush();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(old.keyboardRequests.length,0,'exact24fe before-source loses the late Native focus ACK');
  assert.equal(old.keyboardSettled.length,0);assert.equal(oldOwner.owner.directoryKeyboardTransferPending,true,'exact old scheduler leaves parent migration pending');
  const currentOwner=migration(),current=boundField(currentOwner);
  current.input.onAreaChange({}, {width:200,height:44});current.flush();
  assert.equal(current.focus.length,1);assert.equal(current.keyboardRequests.length,0,'no show is issued before Native ACK');
  assert.equal(current.frames.length,0,'no polling frames while Native focus ACK is absent');
  current.input.onFocus();assert.equal(current.frames.length,1,'actual Native focus ACK queues the single restore frame');
  assert.equal(current.keyboardRequests.length,0,'show waits one frame after ACK');
  current.flush();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(current.keyboardRequests.length,1);assert.equal(currentOwner.owner.directoryKeyboardTransferPending,false,'current scheduler settles parent migration after delayed ACK');
  current.input.onFocus();current.flush();await new Promise(resolve=>setImmediate(resolve));assert.equal(current.keyboardRequests.length,1,'repeated Native ACK cannot repeat the same restore');
  const early=focusField();early.input.onFocus();early.input.onAreaChange({}, {width:200,height:44});early.flush();await new Promise(resolve=>setImmediate(resolve));assert.equal(early.keyboardRequests.length,1,'already acknowledged current input before Area also restores once');
  const retired=focusField();retired.input.onAreaChange({}, {width:200,height:44});retired.flush();retired.owner.directoryFocusId='next';retired.owner.onDirectoryFocusRequest();retired.input.onFocus();retired.flush();await new Promise(resolve=>setImmediate(resolve));assert.equal(retired.keyboardRequests.length,0,'late old-id ACK cannot restore a successor keyboard');
  console.log(JSON.stringify({kind:'directory-delayed-native-focus-ack',beforeSourceLostRequest:true,beforeParentTicketStranded:true,currentLateAckSingleShow:true,afterAckFrame:true,repeatAckRejected:true,earlyAck:true,boundary:'Actual shipping SDK callbacks with delayed finite Native focus port; no physical IME visibility claim.'}));
 }
 async function directoryEditorReflow(){
  const {selectedProductionMethods}=await import('./lib/selected-production-methods.mjs');
  const panelSource=read('reading/ui/ReaderControlPanel.ets');
  const panelMethods=['contentInputEnabled','currentTemporaryInputScope','hasCurrentTemporaryInput',
   'moduleTemporaryLayerHandler','moduleEditorInputEnabled','secondaryModuleInputEnabled'];
  const Panel=selectedProductionMethods(new URL('../entry/src/main/ets/features/reading/ui/ReaderControlPanel.ets',import.meta.url),
   'ReaderControlPanel',panelMethods);
  const directoryMethods=['currentInputEnabled','currentEditorInputEnabled','toolbarInteractive','queryInteractive',
   'currentContent','directoryFocusId','onDirectoryFocus','onInputChanged','onDirectoryKeyboardRestoreSettled','dismissDirectoryEditing'];
  const Directory=selectedProductionMethods(new URL('../entry/src/main/ets/features/reading/ui/ReaderControlDirectoryContent.ets',import.meta.url),
   'ReaderControlDirectoryContent',directoryMethods,{readerWindowMetrics:()=>({keyboardInsets:{bottom:0}})});
  const Before=selectedProductionMethods(new URL('./fixtures/design/directory-confluence-before/editor-reflow-methods.ets.txt',import.meta.url),
   'ReaderControlDirectoryContent',['currentInputEnabled','toolbarInteractive','currentContent','directoryFocusId','onDirectoryFocus','onInputChanged']);
  for(const Constructor of [Before,Directory]){
   let ready=true,live=true,identity='opening-1';
   const panel=new Panel(),reports=[];
   Object.assign(panel,{preparedMinimumRequired:true,runtimeMounted:true,inputEnabled:true,controlObscured:false,
    visualVisibilityProgress:1,visualTransitionKind:'',visualHeldPointerId:-1,moreMenuVisible:false,
    temporaryInputActive:false,temporaryLayerActive:false,temporaryInputScope:'',sourceId:'fixture',
    bookmarkIdentity:{bookId:'book',libraryBookId:'fixture:book'},controlOpenRevision:1,
    currentMinimumIdentity:()=>identity,committedMinimumIdentity:()=>identity,minimumInputReady:()=>ready,
    contentLocation:()=>({level:'secondary',module:'directory',form:'full',directoryTab:'directory'}),
    onTemporaryLayerChange:value=>reports.push(value)});
   const prepared={ownerCurrent:()=>live};
   const sdk=boundedSurfaceSdk();
   class Child{constructor(owner,params,_storage,id){Object.assign(this,{owner,params,id});}updateStateVars(params){Object.assign(this.params,params);}}
   const assembly=compile(()=>createReaderBuilderProbe(panelSource,['controlContent'],
    {...sdk.deps,DEBUG:false,ReaderControlDirectoryContent:Child},
    {...sdk.hooks,childSources:{...sdk.childSources,ReaderControlDirectoryContent:content}})).owner;
   Object.assign(assembly,panel,{minimumPresentationAvailable:()=>true,currentMinimumKey:()=>identity+'|geometry',
    preparedMinimum:()=>prepared,frame:()=>({content:{width:338,height:646}}),contentMotionWidth:338,contentMotionHeight:646,
    contentMotionProgress:1,listSessionKey:()=> 'fixture-book',dismissTemporaryRevision:0,
    moduleEditorInputEnabled:module=>panel.moduleEditorInputEnabled(module),
    secondaryModuleInputEnabled:module=>panel.secondaryModuleInputEnabled(module),
    moduleTemporaryLayerHandler:module=>panel.moduleTemporaryLayerHandler(module)});
   assembly.controlContent();
   const child=[...assembly.children.values()].find(child=>child instanceof Child);
   assert(child,'actual normal Panel directory branch mounts its child');
   assert.equal(typeof child.params.editorInputCurrent,'function');
   assert.equal(typeof child.params.onTemporaryLayerChange,'function');
   assert.equal(child.params.dismissTemporaryRevision,0);
   const directory=new Constructor();
   Object.assign(directory,{mounted:true,preparedMinimumRequired:true,presentationPrepared:()=>prepared,
    interactionEnabled:child.params.interactionEnabled,inputCurrent:child.params.inputCurrent,
    editorInputCurrent:child.params.editorInputCurrent,onTemporaryLayerChange:child.params.onTemporaryLayerChange,
    progress:1,shortContent:false,layoutPresentation:2,sessionKey:'fixture-book',tab:'directory',
    directoryInputFocused:false,directoryRestoreKeyboard:true,layoutRestoreTicket:0,
    syncContentLayout(){},displaySnapshot:()=>({rows:[]}),contentGeometry:()=>({toolbarComplete:true})});
   const id=directory.directoryFocusId();
   directory.onDirectoryFocus(2,id,true);
   assert.equal(directory.directoryInputFocused,true);
   ready=false;
   assembly.replayOnly([child.id]);
   directory.interactionEnabled=child.params.interactionEnabled;
   directory.onInputChanged();
   if(Constructor===Before){
    assert.equal(panel.hasCurrentTemporaryInput(),false,'exact old directory focus has no current editor publication');
    assert.equal(directory.directoryInputFocused,false,'exact old input change retires focused directory during pending reflow');
    assert.equal(directory.toolbarInteractive(),false);
    continue;
   }
   assert.equal(panel.hasCurrentTemporaryInput(),true,'current actual focus callback reaches the normal parent scope');
   assert.equal(directory.directoryInputFocused,true,'current editor retains its acknowledged focus across the observed ready-to-pending edge');
   assert.equal(directory.queryInteractive(),true);
   assert.equal(directory.toolbarInteractive(),false,'ordinary actions still require current geometry');
   const view=actor({height:646});
   view.owner.editorInputCurrent=child.params.editorInputCurrent;
   view.owner.onTemporaryLayerChange=child.params.onTemporaryLayerChange;
   view.owner.interactionEnabled=false;
   view.render();
   const toolbarParams=view.children.find(child=>child.params.variant==='full-directory')?.params;
   assert.equal(toolbarParams.directoryFocusAllowed,true,'actual Content SDK keeps the current input admitted');
   assert.equal(toolbarParams.actionEnabled,false,'actual Content SDK separately disables ordinary toolbar tools');
   const tools=toolbarSdk({initial:toolbarParams});
   const buttons=tools.sdk.nodes(tools.owner).filter(node=>node.type==='Button');
   assert.equal(buttons.length,4);
   const callsBeforeDisabledTools=view.calls.slice();
   for(const button of buttons){
    assert.equal(button.enabled,false);
    assert.equal(button.focusable,undefined,'Native Button keeps its platform focus dependency');
    button.onClick();
   }
   assert.deepEqual(view.calls,callsBeforeDisabledTools,'disabled Native tool callbacks cannot dispatch an action');
   toolbarParams.onTextChange('晋江');
   assert.equal(view.owner.draft,'晋江','current drafting remains editable during a pending geometry receipt');
   toolbarParams.onSearch();
   assert.equal(view.owner.query,'','pending ordinary search cannot borrow editor admission');
   view.owner.directoryInputFocused=true;
   view.owner.dismissTemporaryRevision++;
   assert.equal(view.owner.directoryInputFocused,false,'actual SDK dismiss revision retires current editing');
   assert.equal(panel.hasCurrentTemporaryInput(),false);
   ready=true;
   directory.interactionEnabled=true;
   directory.onDirectoryFocus(2,id,true);
   view.owner.openList();
   assert.equal(panel.hasCurrentTemporaryInput(),false,'new list opening releases the previous editor scope');
   directory.onDirectoryFocus(2,id,true);
   directory.onDirectoryKeyboardRestoreSettled(2,id,false);
   assert.equal(panel.hasCurrentTemporaryInput(),false,'Back or failed editing request releases the current editor scope');
   assert.equal(directory.directoryInputFocused,false);
   assert.equal(directory.directoryRestoreKeyboard,false);
   ready=true;
   directory.interactionEnabled=true;
   directory.onDirectoryFocus(2,id,true);
   assert.equal(panel.hasCurrentTemporaryInput(),true);
   directory.dismissDirectoryEditing();
   assert.equal(panel.hasCurrentTemporaryInput(),false,'normal dismiss revision can release a retained native focus without trapping Back');
   directory.onDirectoryFocus(2,id,true);
   const oldReport=child.params.onTemporaryLayerChange;
   identity='opening-2';panel.controlOpenRevision++;
   ready=false;
   oldReport(false);
   assert.equal(panel.temporaryInputActive,true,'old callback cannot release successor state');
   assert.equal(panel.hasCurrentTemporaryInput(),false,'new opening cannot borrow the old editor scope');
   directory.onInputChanged();
   assert.equal(directory.directoryInputFocused,false);
   live=false;
   ready=true;
   directory.onDirectoryFocus(2,id,true);
   assert.equal(directory.directoryInputFocused,false,'retired formal owner cannot reacquire query focus');
  }
  console.log(JSON.stringify({kind:'directory-normal-editor-reflow-admission',exact609Negative:true,
   normalPanelBinding:true,acknowledgedEditorRetained:true,nativeToolsDisabled:true,ordinarySearchRejected:true,
   currentDismissAndBack:true,successorRejected:true,
   boundary:'Actual current Panel/Directory methods and SDK child/toolbar bindings with finite readiness and geometry ports. Native focus/keyboard reflow remains separately verified.'}));
 }
 async function foregroundRecovery(){
  const {selectedProductionMethods,selectedProductionComponentCallback}=await import('./lib/selected-production-methods.mjs');
  const panelFile=new URL('../entry/src/main/ets/features/reading/ui/ReaderControlPanel.ets',import.meta.url);
  const Panel=selectedProductionMethods(panelFile,'ReaderControlPanel',
   ['contentInputEnabled','moduleEditorInputEnabled','secondaryModuleInputEnabled']);
  function exercise(source){
   const view=actor({height:646,width:338,scale:1,source});
   let foreground=true;
   const panel=Object.assign(new Panel(),{runtimeMounted:true,preparedMinimumRequired:false,inputEnabled:true,
    controlObscured:false,visualVisibilityProgress:1,visualTransitionKind:'',visualHeldPointerId:-1,moreMenuVisible:false,
    inputCurrent:()=>foreground,contentLocation:()=>({level:'secondary',module:'directory'}),
    minimumInputReady:()=>true,hasCurrentTemporaryInput:()=>false});
   view.owner.editorInputCurrent=selectedProductionComponentCallback(panelFile,'ReaderControlDirectoryContent','editorInputCurrent',panel);
   view.owner.inputCurrent=selectedProductionComponentCallback(panelFile,'ReaderControlDirectoryContent','inputCurrent',panel);
   const layoutKey=view.owner.layoutKey;
   assert.ok(layoutKey,'the retained owner has already established its stable Full layout');
   foreground=false;panel.inputEnabled=false;view.owner.interactionEnabled=false;
   view.sdk.properties.flush();view.render();
   const targets=view.sdk.nodes(view.owner).filter(node=>node.type==='Stack'&&node.position?.x===1&&
    typeof node.enabled==='boolean'&&node.accessibilityLevel!==undefined);
   assert.equal(targets.length,1,'one actual Full toolbar ancestor native declaration');
   const target=targets[0];assert.equal(target.enabled,false);
   foreground=true;panel.inputEnabled=true;view.owner.interactionEnabled=true;
   view.sdk.properties.flush();
   assert.equal(view.owner.layoutKey,layoutKey,'foreground recovery does not require a new layout');
   assert.equal(view.owner.queryInteractive(),true);
   assert.equal(target.enabled,true,'same native toolbar ancestor recovers enabled on foreground delivery');
   assert.equal(target.accessibilityLevel,'auto');
   assert.equal(target.hitTestBehavior,'HitTestMode.Default');
   assert.equal(view.sdk.nodes(view.owner).find(node=>node.id===target.id),target);
   foreground=false;
   assert.equal(view.owner.queryInteractive(),false,'original live callback still rejects before local Prop delivery');
   foreground=true;
   view.owner.aboutToDisappear();
   assert.equal(view.owner.queryInteractive(),false,'retired owner cannot reacquire query input');
  }
  exercise(content);
  const old=content.replace('    const inputEnabled = this.currentInputEnabled();\n','')
   .replace('(this.editorInputCurrent?.() ?? inputEnabled)','(this.editorInputCurrent?.() ?? this.currentInputEnabled())');
  assert.notEqual(old,content);
  assert.throws(()=>exercise(old),/same native toolbar ancestor recovers enabled/);
  console.log(JSON.stringify({kind:'directory-native-ancestor-foreground-recovery',sameActor:true,stableLayout:true,
   finalEnabled:true,finalAccessibility:true,finalHitTest:true,oldPredicateRejected:true,
   boundary:'Actual SDK native ancestor and current Panel callback assembly. Finite geometry and Root foreground port; no native event delivery.'}));
 }
 async function keyboardTransfer(){
  const x=actor({height:646,tree:true});x.owner.initialRender();const toolbar=x.children.find(c=>c.params.variant==='full-directory');assert(toolbar);
  const key=toolbar.id,id=toolbar.params.directoryFocusId,presentation=x.owner.layoutPresentation;
  toolbar.params.onTextChange('retained draft');x.owner.onDirectoryFocus(presentation,id,true);
  for(const height of[122,168,646]){
   x.owner.availableHeight=height;x.owner.syncContentLayout();x.owner.replayOnly([key]);
   assert.equal(x.owner.children.get(key),toolbar,'same SDK Toolbar instance');assert.equal(toolbar.params.directoryFocusId,id,'same native field id');
   assert.equal(x.owner.layoutPresentation,presentation,'geometry does not retire editor');assert.equal(x.owner.draft,'retained draft');
  }
  const old=toolbar.params.onTextChange;x.owner.openList();old('late');assert.equal(x.owner.draft,'retained draft','old business-opening callbacks remain fenced');
  assert.equal(x.owner.directoryFocusRevision,0,'geometry never manufactures a focus request');
  console.log('Actual owner and SDK instance continuity; actual native composing text remains a separate gate.');
 }
 async function measuredProfile(){
  const {selectedProductionClasses}=await import('./lib/selected-production-methods.mjs');
  const {ReaderInheritedTextStyle}=selectedProductionClasses(new URL('../entry/src/main/ets/ui/foundation/ReaderTypography.ets',import.meta.url),['ReaderInheritedTextStyle']);
  const textModule=read('reading/ui/ReaderControlTextMeasurement.ets');
  const {measureReaderControlText}=pureModuleProbe(textModule,'ReaderControlTextMeasurement.ets',{WordBreak:{BREAK_WORD:'break'}},['measureReaderControlText']);
  const profiles=[];
  for(const width of[268,314])for(const scale of[1,2])for(const tab of['directory','bookmarks']){
   const sdk=boundedSurfaceSdk(),measureCalls=[];
   const context={px2vp:value=>value,getMeasureUtils:()=>({
    measureTextSize(options){measureCalls.push(options);return{width:Math.min(options.constraintWidth,options.fontSize*scale),height:options.fontSize*scale*1.5};},
    measureText(options){return Math.max(1,options.textContent.length)*options.fontSize*scale*.5;}
   })};
   minimumMeasure=pureModuleProbe(read('reading/ui/ReaderControlDirectoryMinimum.ets'),'ReaderControlDirectoryMinimum.ets',{
    ...sdk.deps,ReaderInheritedTextStyle,measureReaderControlText,readerReadableFontScale,readerScaledControlHeight,readerDirectoryToolbarBudget,
    readerWindowMetrics:()=>({systemFontScale:scale})},['measureReaderDirectoryMinimum']).measureReaderDirectoryMinimum;
   const x=actor({width,height:168,scale,tab});
   x.owner.getUIContext=()=>({...context,postFrameCallback:frame=>x.frames.push(frame)});
   const published=[];x.owner.onMinimumMeasurerReady=(identity,provider)=>published.push({identity,provider});x.owner.minimumIdentity='profile-opening';
   x.owner.publishMinimumMeasurer();const provider=published.at(-1).provider;
   assert.equal(typeof provider,'function');
   const key='layout|'+width;x.owner.minimumKey=key;
   const result=provider({quickContentWidthVp:width,fullContentWidthVp:width},key);
   assert(result);const profile=x.owner.selectedMinimum();assert(profile);assert(measureCalls.length>0,'shipping text-measure adapter consumed finite native metrics');
   assert.equal(result.full,profile.full.minimum);assert.equal(x.owner.rowHeight(),profile.full.rowHeightVp);
   assert.equal(x.owner.contentGeometry().nominalListTop,profile.full.listTopVp);
   assert.equal(x.owner.contentGeometry().toolbarHeight,profile.full.toolbarHeightVp);
   assert.equal(x.owner.contentGeometry().minUnitHeight,profile.full.rowHeightVp);
   assert(profile.full.rowHeightVp >= (tab==='directory' ? readerScaledControlHeight(40,20,scale) : 74));assert(profile.full.fieldHeightVp>=readerScaledControlHeight(32,24,scale));assert(profile.full.tabHeightVp>=36);
   if(scale===1&&tab==='directory'){assert.equal(profile.full.rowHeightVp,40,'retain approved compact Full rows');assert.equal(profile.full.fieldHeightVp,32,'retain approved visual field height');}
   x.owner.availableHeight=profile.full.minimum.heightVp+16;x.owner.syncContentLayout();
   assert.equal(x.owner.shortContent,!profile.full.minimum.fits,'height sufficiency and width admission consume the same profile');
   x.owner.availableHeight=122;x.owner.syncContentLayout();assert.equal(x.owner.shortContent,true);
   x.owner.minimumIdentity='successor';assert.equal(provider({quickContentWidthVp:width,fullContentWidthVp:width},'stale|'+width),undefined,'old minimum opening cannot publish into successor');
   x.owner.aboutToDisappear();assert.equal(provider({quickContentWidthVp:width,fullContentWidthVp:width},key),undefined);
   profiles.push({width,scale,tab,row:profile.full.rowHeightVp,field:profile.full.fieldHeightVp,toolbar:profile.full.toolbarHeightVp,minimum:profile.full.minimum.heightVp,widthFits:profile.full.minimum.fits});
  }
  console.log(JSON.stringify({kind:'directory-current-minimum-profile-bridge',profiles,boundary:'Production measurer/SDK owner with finite native text metrics; no glyph, focus or physical layout engine claim.'}));
 }
 async function bookmarkBranchAdmission(){
  const fixture=actor({height:122,tab:'bookmarks'});
  const {owner,children,calls}=fixture;
  owner.onSelectBookmark=(id,index,offset)=>calls.push({id,index,offset});
  const retainedBuilderOpening=owner.layoutPresentation;
  owner.tab='directory';
  owner.openList();
  owner.tab='bookmarks';
  owner.openList();
  owner.flatList(retainedBuilderOpening);
  fixture.renderListItems();
  const child=children.find(item=>item.params.row?.bookmarkId);
  assert.ok(child,'actual flat result Builder mounts a bookmark row');
  const {bookmarkId,chapterIndex,chapterOffset}=child.params.row;
  child.params.onSelectBookmark(bookmarkId,chapterIndex,chapterOffset);
  assert.deepEqual(calls,[{id:bookmarkId,index:chapterIndex,offset:chapterOffset}],
   'a newly mounted bookmark must use the current result opening even when the parent Builder retained its earlier argument');
  owner.tab='directory';
  owner.openList();
  owner.tab='bookmarks';
  owner.openList();
  child.params.onSelectBookmark(bookmarkId,chapterIndex,chapterOffset);
  assert.equal(calls.length,1,'an old row cannot enter another opening for the same bookmark');
 }
 for(const id of selected){await ({'short-sdk':shortSdk,'prefix-anchors':prefixAnchors,'bookmark-branch-admission':bookmarkBranchAdmission,'directory-focus':directoryFocus,'keyboard-observation':keyboardObservation,'keyboard-transfer':keyboardTransfer,'keyboard-ack-delay':keyboardAckDelay,'measured-profile':measuredProfile,'foreground-recovery':foregroundRecovery})[id]();recordContractCasePass(id);}
}
