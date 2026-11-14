import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createRequire,registerHooks} from 'node:module';
import {fileURLToPath} from 'node:url';
import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
const selected=selectContractCases({
 'short-sdk':'Actual SDK short prefix/flat List and normal defaults at 122/168/190 x2: one primary List, real declared64 row,44 actions/query/clear and state headers. Finite native/Scroller ports, no physical scroll claim.',
 'prefix-anchors':'Actual owner methods and SDK retained Surface reference across authored/short: Native/data index, header-not-chapter, Tree anchor delegation, retired idle/focus and actual current action callbacks.',
 'directory-focus':'Actual SearchField opt-in modifier and finite after-layout focus, current id/revision/mounted guards, cancel/old callback and default disabled/no setter negative controls; Toolbar local opt-in lifetime.',
 'measured-profile':'Actual shipping minimum producer and current Content profile consume one measured layout; short prefix/focus stays local, and retired providers cannot publish.',
 'keyboard-ack-delay':'Actual SDK before-source delayed Native focus ACK loses one-shot keyboard restore, while current pending request schedules once only after acknowledged focus; finite current/retired/repeated ACK ports.',
 'keyboard-transfer':'Actual shipping Content/Field/Toolbar callbacks preserve visible editing through a retiring input inset0, request public showTextInput once after new Native focus, and reject explicit Back/stale/disabled/failed restore. Finite Native API ports only.',
 'keyboard-observation':'Actual SDK Content and Field modifier distinguish fresh unknown keyboard inset0 from observed-visible then hidden, retain policy across same-instance layout migration and retire old opening callbacks/frames. No Native keyboard service or IME claim.',
});
if(selected.length){
 registerHooks({resolve(s,c,n){if(s.startsWith('.')&&!/\.[a-z]+$/i.test(s)){const u=new URL(s+'.ts',c.parentURL);if(existsSync(fileURLToPath(u)))return n(u.href,c);}return n(s,c);}});
 const {createReaderBuilderProbe}=await import('./lib/reader-control-builder-probe.mjs');
 const {boundedSurfaceSdk,boundedMembers}=await import('./lib/bounded-surface-sdk-probe.mjs');
 const {pureModuleProbe}=await import('./lib/ets-pure-module-probe.mjs');
 const {resolveEtsLoaderRoot}=await import('./lib/tool-environment.mjs');
 const {readerControlDirectorySnapshot,ReaderControlDirectoryPosition}=await import('../entry/src/main/ets/features/reading/ui/ReaderControlDirectoryModel.ts');
 const {resolveReaderControlDirectoryGeometry}=await import('../entry/src/main/ets/features/reading/ui/ReaderControlDirectoryGeometry.ts');
 const {sampleReaderControlMotionPresentation}=await import('../entry/src/main/ets/features/reading/ui/ReaderControlMotionPresentation.ts');
 const {sampleReaderControlBookmark}=await import('../entry/src/main/ets/features/reading/ui/ReaderControlBookmarkGeometry.ts');
 const {EMPTY_READING_DIRECTORY_RECOVERY}=await import('../entry/src/main/ets/features/reading/presentation/ReadingDirectoryRecovery.ts');
 const {readerPageAreaLength}=await import('../entry/src/main/ets/ui/layout/ReaderPageShell.ts');
 const read=n=>readFileSync(new URL('../entry/src/main/ets/features/'+n,import.meta.url),'utf8');
 const content=read('reading/ui/ReaderControlDirectoryContent.ets'),field=read('../ui/controls/ReaderSearchField.ets'),toolbar=read('reading/ui/ReaderDirectoryToolbar.ets');
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
  const sdk=boundedSurfaceSdk(),frames=[],children=[],calls=[],scroll=[],port={kind:'existing-business-port'},metrics={systemFontScale:scale,keyboardInsets:{bottom:0}};let portCreations=0;
  class Child{constructor(owner,params,_storage,id){Object.assign(this,{owner,params,id});children.push(this);}updateStateVars(next){Object.assign(this.params,next);}}
  class Surface extends Child{constructor(...args){super(...args);this.port=this.params.navigationPortFactory?.();}}
  const childSources={ReaderSearchField:field,ReaderDirectoryToolbar:toolbar,ReaderDirectoryNavigationSurface:read('reading/ui/ReaderDirectoryNavigationSurface.ets'),ReaderDirectoryChapterRow:read('reading/ui/ReaderDirectoryChapterRow.ets'),ReaderBookmarkRow:read('reading/ui/ReaderBookmarkRow.ets'),ReaderBookmarkEmptyState:read('reading/ui/ReaderBookmarkEmptyState.ets'),ReaderBookmarkLoadingState:read('reading/ui/ReaderBookmarkLoadingState.ets'),ReaderBookmarkErrorState:read('reading/ui/ReaderBookmarkErrorState.ets')};
  const scroller={offset:0,index:1,rect:{y:0,height:64},scrollToIndex(...v){scroll.push(['index',...v]);},scrollTo(v){scroll.push(['offset',v]);},scrollEdge(v){scroll.push(['edge',v]);},currentOffset(){return{yOffset:this.offset};},getItemIndex(){return this.index;},getItemRect(){return this.rect;}};
  const deps={...sdk.deps,...classes,...accessibility,EMPTY_READING_DIRECTORY_RECOVERY,readerControlDirectorySnapshot,ReaderControlDirectoryPosition,resolveReaderControlDirectoryGeometry,readerReadableFontScale,readerScaledControlHeight,readerPageAreaLength,
   measureReaderDirectoryMinimum:(...args)=>minimumMeasure(...args),sampleReaderControlBookmark,sampleReaderControlMotionPresentation,readerWindowMetrics:()=>metrics,ReaderWindowCoordinator:{metrics:()=>metrics},
   ReaderSearchField:Child,ReaderDirectoryToolbar:Child,ReaderDirectoryNavigationSurface:Surface,ReaderDirectoryChapterRow:Child,ReaderBookmarkRow:Child,
   ReaderBookmarkEmptyState:Child,ReaderBookmarkLoadingState:Child,ReaderBookmarkErrorState:Child,
   uiContext:{getFont:()=>({}),postFrameCallback:f=>frames.push(f)},Scroller:class{},ViewStackProcessor:{StartGetAccessRecordingFor(){},StopGetAccessRecording(){}},
   Edge:{Top:'Edge.Top',Bottom:'Edge.Bottom'},ScrollAlign:{START:'ScrollAlign.START',CENTER:'ScrollAlign.CENTER'},ScrollSource:{SCROLLER:'ScrollSource.SCROLLER'},
   LazyForEach:{name:'LazyForEach',create(_id,_owner,data,generator){for(let i=0;i<data.totalCount();i++)generator(data.getData(i),i);},pop(){}},
   readerDirectoryScopeKey:()=> 'fixture:book',readerDirectorySignalScrollIntent(){},readerDirectorySignalScrollCommand(){},
  };
  const {owner}=compile(()=>createReaderBuilderProbe(source,boundedMembers(source),deps,{...sdk.hooks,childSources:{...sdk.childSources,...childSources}}));
  Object.assign(owner,{availableHeight:height,availableWidth:width,progress:1,interactionEnabled:true,readerWindowMetricsRevision:1,entries:entries(),tab,sessionKey:'fixture-book',currentChapterIndex:21,
   bookmarkIdentity:tree||tab==='bookmarks'?identity:undefined,navigationPortFactory:()=>{portCreations++;return port;},
   scroller,onTabChange:t=>calls.push('tab:'+t),onSelectChapter:i=>calls.push('chapter:'+i),onRequireCompleteCatalog:()=>calls.push('require-catalog')});
  owner.aboutToAppear();
  const rendered=new Set();
  return{owner,sdk,frames,children,calls,scroll,scroller,deps,metrics,Surface,port,portCreations:()=>portCreations,
   render(){owner.initialRender();for(const node of owner.nodes.values()){if(node.type!=='ListItem'||rendered.has(node.id))continue;const body=Array.isArray(node.create)?node.create[0]:node.create;if(typeof body==='function'){rendered.add(node.id);body(node.id,true);}}},
   flush(){while(frames.length){const f=frames.shift();f.onFrame?.(0);f.onIdle?.(0);}}};
 }
 async function shortSdk(){
  for(const width of[268,314])for(const height of[122,168,190])for(const tab of['directory','bookmarks']){
   const x=actor({height,tab,width});assert.equal(x.owner.shortContent,true);x.render();
   const nodes=x.sdk.nodes(x.owner),lists=nodes.filter(n=>n.type==='List');assert.equal(lists.length,1,'prefix and results/state share exactly one native List');
   assert.equal(x.owner.listHeight(),height);assert.equal(x.owner.listTop(),0);assert.equal(x.owner.headerCount(),1);
   const items=nodes.filter(n=>n.type==='ListItem');assert.equal(items.length,x.owner.snapshot.rows.length+1);assert.equal(items[0].height,x.owner.prefixHeight());assert(items[0].height>0);
   if(tab==='directory'){const summary=nodes.find(n=>n.type==='Text'&&typeof n.create==='string'&&n.create.startsWith('当前章节 '));assert(summary);assert.deepEqual(summary.textOverflow,{overflow:'TextOverflow.Ellipsis'},'actual summary uses SDK TextOverflowOptions object');for(const item of items.slice(1))assert.equal(item.height,64);assert(height>=items[1].height,'after prefix scrolls away a real SDK-declared64 row fits');}
   else assert(items.slice(1).every(n=>n.height>=44),'large bookmark cards keep their full declared content, no shrink');
   const tools=nodes.filter(n=>n.type==='Button'&&['搜索','到顶部','到底部','切换排序','清除搜索'].includes(n.accessibilityText));
   assert.equal(tools.length,tab==='directory'?5:2);for(const tool of tools){assert.equal(tool.width,44);assert.equal(tool.height,44);assert(height>=tool.height,'every declared action fits the sole scrolling viewport');}
   if(tab==='directory'){const ascending=x.owner.ascending;tools.find(n=>n.accessibilityText==='到顶部').onClick();tools.find(n=>n.accessibilityText==='到底部').onClick();tools.find(n=>n.accessibilityText==='切换排序').onClick();assert.notEqual(x.owner.ascending,ascending);assert(x.scroll.some(n=>n[0]==='edge'&&n[1]==='Edge.Bottom'));}
   const query=x.children.find(c=>c.params.variant==='readerDirectory');assert(query);query.params.onTextChange('第1');query.params.onSubmit();assert.equal(x.owner.query,'第1');
   const clear=tools.find(n=>n.accessibilityText==='清除搜索');clear.onClick();assert.equal(x.owner.query,'');assert.equal(x.owner.draft,'');assert(x.scroll.some(n=>n[0]==='index'&&n[1]===0));
   const old=tools[0].onClick;x.owner.layoutPresentation++;const oldQuery=x.owner.query;old();query.params.onTextChange('stale');assert.equal(x.owner.query,oldQuery);assert.equal(x.owner.draft,'');
  }
  const incomplete=actor({height:122});incomplete.owner.catalogComplete=false;incomplete.render();const load=incomplete.sdk.nodes(incomplete.owner).find(n=>n.accessibilityText==='加载完整目录');assert(load);assert.equal(load.height,44);load.onClick();assert.deepEqual(incomplete.calls,['require-catalog']);
  for(const tab of['directory','bookmarks'])for(const state of['empty','loading','error']){
   const x=actor({tab});x.owner.snapshot={...x.owner.snapshot,rows:[],loading:state==='loading',catalogState:state==='error'?'failed':'ready'};
   x.owner.dataSource.replace([]);x.owner.bookmarkLoadFailed=tab==='bookmarks'&&state==='error';x.render();
   const n=x.sdk.nodes(x.owner);assert.equal(n.filter(v=>v.type==='List').length,1);assert(n.some(v=>v.type==='Button'&&v.accessibilityText==='清除搜索'),'state does not remove clear/header');assert(n.filter(v=>v.type==='ListItem').length>=2);
  }
  for(const height of[190,646]){const x=actor({height});x.owner.progress=height===190?0:1;x.owner.syncContentLayout();assert.equal(x.owner.shortContent,false,'Quick/portrait remains authored');}
  const witnesses=[];
  for(const tab of['directory','bookmarks'])for(const height of[122,168,190]){
   const x=actor({height,tab,scale:2}),geometry=x.owner.contentGeometry();
   witnesses.push({tab,fontScale:2,availableHeight:height,fixedChromeHeight:geometry.fixedChromeHeight,
    minimumContentHeight:geometry.minUnitHeight,profile:'unmeasured-conservative-fallback',shortContent:x.owner.shortContent});
  }
  console.log(JSON.stringify({kind:'directory-fallback-query-viewport-witnesses',witnesses,boundary:'Actual SDK owner/helper declarations before a current measured profile; Native geometry and text remain separate.'}));
 }
 async function prefixAnchors(){
  const x=actor();x.scroller.index=6;x.scroller.rect={y:-16,height:64};x.owner.captureLeadingRow();assert.equal(x.owner.leadingRow,5.25);x.owner.leadingRow=5.25;x.owner.leadingFraction=.25;
  x.owner.availableHeight=646;x.owner.syncContentLayout();x.owner.onListLayout();x.flush();assert(x.scroll.some(v=>v[0]==='index'&&v[1]===5),'short data native6 restores authored data5');
  x.scroller.index=5;x.owner.availableHeight=168;x.owner.syncContentLayout();x.owner.onListLayout();x.flush();assert(x.scroll.some(v=>v[0]==='index'&&v[1]===6),'authored data5 restores short native6');
  x.scroller.index=0;x.scroller.offset=27;x.owner.captureLeadingRow();assert.equal(x.owner.leadingRow,undefined);assert.equal(x.owner.leadingKey,undefined);assert.equal(x.owner.leadingPrefixOffset,27,'header is never chapter zero');
  x.owner.queueLayoutRestore();const before=x.scroll.length;x.owner.userScroll();x.flush();assert.equal(x.scroll.length,before,'real user intent retires queued restore');
  x.owner.layoutRestorePending=true;x.owner.queueLayoutRestore();const old=x.frames.shift();x.owner.availableWidth+=10;x.owner.syncContentLayout();old.onFrame(0);assert.equal(x.scroll.length,before,'old layout frame cannot restore new width');
  const t=actor({height:646,tree:true});t.owner.initialRender();const child=[...t.owner.children.values()].find(c=>c instanceof t.Surface);assert(child);assert.equal(child.port,t.port);assert.equal(t.portCreations(),1);
  child.params.onTreeStateChange(true);const key=child.id;t.scroller.index=37;t.owner.captureLeadingRow();assert.equal(t.owner.leadingRow,undefined,'Tree Core rank is never flat snapshot index');
  const noReveal=t.owner.prefixRevealRevision;t.owner.availableHeight=168;t.owner.syncContentLayout();assert.equal(t.owner.prefixRevealRevision,noReveal,'ordinary layout does not become explicit prefix focus intent');t.owner.replayOnly([key]);assert.equal(t.owner.children.get(key),child);assert.equal(child.params.headerCount,1);assert.equal(child.port,t.port);assert.equal(t.portCreations(),1,'same SDK Surface and business port across prefix change');
  t.owner.onListLayout();t.flush();assert.equal(t.scroll.length,0,'Content does not override NavigationList node/rank anchor');
  child.params.prefixBuilder();assert(t.sdk.nodes(t.owner).some(n=>n.accessibilityText==='清除搜索'),'ctor-only builder dynamically sees current short state');
  const p=t.owner.layoutPresentation,id=t.owner.directoryFocusId();t.owner.onDirectoryFocus(p,id,true);t.owner.layoutRestorePending=true;t.owner.onListLayout();t.flush();assert(t.scroll.some(v=>v[0]==='index'&&v[1]===0));assert(t.owner.directoryFocusRevision>0);
  t.owner.availableHeight=646;t.owner.syncContentLayout();t.owner.replayOnly([key]);assert.equal(t.owner.children.get(key),child);assert.equal(child.params.headerCount,0);assert.equal(t.portCreations(),1);const count=t.scroll.length;t.owner.onDirectoryFocus(p,id,false);assert.equal(t.owner.directoryInputFocused,true,'old removed input cannot blur successor epoch');
  t.owner.onInputChanged();t.owner.interactionEnabled=false;t.owner.onInputChanged();assert.equal(t.owner.directoryInputFocused,false);t.flush();assert.equal(t.scroll.length,count);
 }
 function focusField({variant='readerDirectory',id='directory:current',allowed=true,revision=1,keyboard=true,current=()=>true,source=field,ackFocus=false,show=()=>Promise.resolve()}={}){
  const sdk=boundedSurfaceSdk(),frames=[],focus=[],events=[],keyboardRequests=[],keyboardSettled=[];
  const deps={...sdk.deps,...fieldClasses,...accessibility,readerPageAreaLength,readerReadableFontScale,readerScaledControlHeight,
   ReaderWindowCoordinator:{metrics:()=>({systemFontScale:2})},TextInputController:class{},
   uiContext:{getFont:()=>({}),postFrameCallback:f=>frames.push(f),getFocusController:()=>({requestFocus:id=>{focus.push(id);if(ackFocus)owner.onDirectoryInputFocus(id,true);}})},
   inputMethod:{getController:()=>({showTextInput:()=>{keyboardRequests.push(id);return show();}})},
   hilog:{warn(){}},KeyCode:{KEYCODE_BACK:2},KeyType:{Down:0,Up:1}};
  const{owner}=compile(()=>createReaderBuilderProbe(source,boundedMembers(source),deps,sdk.hooks));
  Object.assign(owner,{variant,mode:'submit',readerWindowMetricsRevision:1,directoryFocusId:id,directoryFocusAllowed:allowed,directoryFocusRevision:revision,directoryKeyboardOnFocus:keyboard,directoryFocusCurrent:current,onDirectoryFocusChanged:(id,value)=>events.push([id,value]),onDirectoryKeyboardRestoreSettled:(id,value)=>keyboardSettled.push([id,value]),onTextChange(){},onSubmit(){}});owner.aboutToAppear();owner.initialRender();
  const inputEntry=[...owner.nodes.entries()].find(([,n])=>n.type==='TextInput');
  return{owner,sdk,frames,focus,events,keyboardRequests,keyboardSettled,input:inputEntry?.[1],updateKeyboard(value){owner.directoryKeyboardOnFocus=value;owner.replayOnly([inputEntry[0]]);},flush(){while(frames.length){const f=frames.shift();f.onFrame?.(0);f.onIdle?.(0);}}};
 }

 function toolbarSdk({id='toolbar:current',current=()=>true}={}){
  const sdk=boundedSurfaceSdk(),children=[],events=[];
  class Child{constructor(owner,params,_storage,id){Object.assign(this,{owner,params,id});children.push(this);}updateStateVars(next){Object.assign(this.params,next);}}
  const deps={...sdk.deps,ReaderSearchField:Child,READER_DIRECTORY_TOOLBAR_HEIGHT:50,readerReadableFontScale,readerScaledControlHeight,ReaderWindowCoordinator:{metrics:()=>({systemFontScale:2})}};
  const{owner}=compile(()=>createReaderBuilderProbe(toolbar,boundedMembers(toolbar),deps,{...sdk.hooks,childSources:{...sdk.childSources,ReaderSearchField:field}}));
  Object.assign(owner,{directoryFocusId:id,directoryFocusAllowed:id.length>0,directoryFocusRevision:1,directoryKeyboardOnFocus:false,directoryFocusCurrent:current,onTextChange:v=>events.push(['text',v]),onSearch:()=>events.push(['search']),onDirectoryFocusChanged:(id,value)=>events.push(['focus',id,value])});owner.aboutToAppear();owner.initialRender();
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
  for(const variant of['sourceManagement','rssPassive','readerDirectory']){const v=focusField({variant,id:'',allowed:false,revision:0});assert.equal(v.owner.attributeCalls.some(c=>c.property==='id'),false);for(const property of['onFocus','onBlur','onAreaChange','enableKeyboardOnFocus'])assert.equal(v.owner.attributeCalls.some(c=>c.property===property),false);v.owner.onDirectoryFocusRequest();v.flush();assert.deepEqual(v.focus,[],'defaults never request directory focus');}
  const wrong=focusField({variant:'sourceManagement',id:'wrong',allowed:true});assert.equal(wrong.owner.attributeCalls.some(c=>c.property==='id'),false);wrong.owner.onDirectoryFocusRequest();wrong.flush();assert.deepEqual(wrong.focus,[]);
  const ime=actor({height:646});ime.owner.onDirectoryFocus(ime.owner.layoutPresentation,ime.owner.directoryFocusId(),true);ime.metrics.keyboardInsets.bottom=200;ime.owner.availableHeight=168;ime.owner.syncContentLayout();assert.equal(ime.owner.shortContent,true);assert.equal(ime.owner.directoryRestoreKeyboard,true,'visible IME editing migration may preserve keyboard');
  const shortId=ime.owner.directoryFocusId();ime.owner.onDirectoryKeyboardRestoreSettled(ime.owner.layoutPresentation,shortId,true);ime.metrics.keyboardInsets.bottom=0;ime.owner.availableHeight=646;ime.owner.syncContentLayout();assert.equal(ime.owner.shortContent,false);assert.equal(ime.owner.directoryRestoreKeyboard,false,'Back-hidden IME is not re-opened by programmatic focus');assert.notEqual(ime.owner.directoryFocusId(),shortId);
  const hidden=focusField({id:ime.owner.directoryFocusId(),keyboard:ime.owner.directoryRestoreKeyboard});assert.equal(hidden.input.enableKeyboardOnFocus,false);hidden.input.onAreaChange({}, {width:200,height:68});hidden.flush();assert.equal(hidden.focus.length,1);hidden.input.onAreaChange({}, {width:200,height:68});hidden.owner.onDirectoryFocusRequest();hidden.flush();assert.equal(hidden.focus.length,1,'unchanged replay does not issue another focus/IME cycle');
 }
 async function keyboardObservation(){
  function focusedActor(source=content){const x=actor({height:646,source}),presentation=x.owner.layoutPresentation,id=x.owner.directoryFocusId();
   const f=focusField({id,revision:0});f.owner.onDirectoryFocusChanged=(inputId,value)=>x.owner.onDirectoryFocus(presentation,inputId,value);
   f.input.onAreaChange({}, {width:200,height:68});f.input.onFocus();assert.equal(x.owner.directoryInputFocused,true,'actual Field Native focus callback reaches current Content owner');return{...x,field:f,presentation,id};}
  const current=focusedActor(),key=current.owner.layoutKey;
  assert.equal(current.owner.directoryRestoreKeyboard,true);current.owner.syncContentLayout();
  assert.equal(current.owner.layoutKey,key);assert.equal(current.owner.directoryRestoreKeyboard,true,'fresh focused inset0 is unknown, not evidence user hid keyboard');
  current.field.updateKeyboard(current.owner.directoryRestoreKeyboard);assert.equal(current.field.input.enableKeyboardOnFocus,true,'actual SDK Native modifier retains pending keyboard policy');
  const before=readFileSync(new URL('./fixtures/design/directory-confluence-before/keyboard-observation.ets.txt',import.meta.url),'utf8');
  const old=focusedActor(before);old.owner.syncContentLayout();assert.equal(old.owner.directoryRestoreKeyboard,false,'compiled real before-source incorrectly converts fresh same-key0 to hidden');
  old.field.updateKeyboard(old.owner.directoryRestoreKeyboard);assert.equal(old.field.input.enableKeyboardOnFocus,false,'negative reaches actual Native modifier, not only a private flag');
  current.metrics.keyboardInsets.bottom=200;current.owner.syncContentLayout();assert.equal(current.owner.directoryKeyboardWasVisible,true);assert.equal(current.owner.directoryRestoreKeyboard,true);
  current.owner.availableHeight=168;current.owner.syncContentLayout();current.owner.onListLayout();current.flush();assert.equal(current.owner.shortContent,true);assert(current.owner.directoryFocusRevision>0);assert(current.scroll.some(v=>v[0]==='index'&&v[1]===0),'focused authored→prefix keeps header reveal after real List layout');
  current.owner.onDirectoryKeyboardRestoreSettled(current.owner.layoutPresentation,current.owner.directoryFocusId(),true);current.metrics.keyboardInsets.bottom=0;current.owner.syncContentLayout();assert.equal(current.owner.directoryRestoreKeyboard,false,'observed-visible then0 preserves Back-hidden policy even with identical layout key');
  current.field.updateKeyboard(current.owner.directoryRestoreKeyboard);assert.equal(current.field.input.enableKeyboardOnFocus,false);
  current.owner.availableHeight=646;current.owner.syncContentLayout();current.owner.onListLayout();current.flush();assert.equal(current.owner.shortContent,false);assert.equal(current.owner.directoryRestoreKeyboard,false,'prefix→authored restore does not reopen known-hidden keyboard');
  const oldRevision=current.owner.directoryFocusRevision,oldId=current.id,oldPresentation=current.presentation;
  current.owner.layoutRestorePending=true;current.owner.queueLayoutRestore();const staleFrame=current.frames.shift();
  current.owner.tab='bookmarks';current.owner.openList();assert.equal(current.owner.directoryInputFocused,false);assert.equal(current.owner.directoryKeyboardWasVisible,false);assert.equal(current.owner.directoryRestoreKeyboard,true,'new tab/opening does not inherit old hidden state');
  current.owner.onDirectoryFocus(oldPresentation,oldId,true);assert.equal(current.owner.directoryInputFocused,false,'old input cannot focus new opening');staleFrame.onFrame(0);assert.equal(current.owner.directoryFocusRevision,oldRevision,'old queued restoration cannot mutate successor');
  current.owner.onDirectoryFocus(current.owner.layoutPresentation,current.owner.directoryFocusId(),true);current.owner.syncContentLayout();assert.equal(current.owner.directoryRestoreKeyboard,true,'new opening inset0 remains unknown');
  current.metrics.keyboardInsets.bottom=200;current.owner.syncContentLayout();assert.equal(current.owner.directoryKeyboardWasVisible,true);
  current.owner.aboutToDisappear();assert.equal(current.owner.directoryKeyboardWasVisible,false);assert.equal(current.owner.directoryRestoreKeyboard,true);current.owner.syncContentLayout();assert.equal(current.owner.directoryKeyboardWasVisible,false,'retired owner cannot observe a keyboard for successor');
  console.log(JSON.stringify({kind:'keyboard-observation-policy',freshZero:'unknown-preserves-true',beforeSource:'false-negative-reproduced',visibleThenZero:'hidden-preserves-false',sameInstanceMigration:true,retiredOpening:true,boundary:'Actual SDK Content/Field callbacks and emitted modifier only; no Native IME service or physical keyboard was run.'}));
 }
 async function keyboardAckDelay(){
  const before=readFileSync(new URL('./fixtures/design/directory-confluence-before/keyboard-ack-delay-field.ets.txt',import.meta.url),'utf8');
  function migration(){
   const x=actor({height:646,scale:1});
   x.owner.onDirectoryFocus(x.owner.layoutPresentation,x.owner.directoryFocusId(),true);
   x.metrics.keyboardInsets.bottom=300;x.owner.syncContentLayout();
   x.owner.availableHeight=122;x.owner.syncContentLayout();x.owner.onListLayout();x.flush();
   x.metrics.keyboardInsets.bottom=0;x.owner.syncContentLayout();
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
 async function keyboardTransfer(){
  const beforeContent=readFileSync(new URL('./fixtures/design/directory-confluence-before/keyboard-transfer-content.ets.txt',import.meta.url),'utf8');
  const beforeField=readFileSync(new URL('./fixtures/design/directory-confluence-before/keyboard-transfer-field.ets.txt',import.meta.url),'utf8');
  function migration(source=content){
   const x=actor({height:646,scale:1,source});
   x.owner.onDirectoryFocus(x.owner.layoutPresentation,x.owner.directoryFocusId(),true);
   x.metrics.keyboardInsets.bottom=300;x.owner.syncContentLayout();
   x.owner.availableHeight=122;x.owner.syncContentLayout();x.owner.onListLayout();x.flush();
   const presentation=x.owner.layoutPresentation,id=x.owner.directoryFocusId();
   x.metrics.keyboardInsets.bottom=0;x.owner.syncContentLayout();
   return{...x,presentation,id};
  }
  const old=migration(beforeContent);
  assert.equal(old.owner.directoryRestoreKeyboard,false,'actual pre-fix retiring-input inset0 is misclassified as Back');
  const oldInput=focusField({id:old.id,keyboard:old.owner.directoryRestoreKeyboard,source:beforeField,ackFocus:true});
  oldInput.input.onAreaChange({}, {width:200,height:44});oldInput.flush();
  assert.equal(oldInput.input.enableKeyboardOnFocus,false);assert.equal(oldInput.keyboardRequests.length,0,'old Field only requests focus and never resumes editing');
  const x=migration();assert.equal(x.owner.directoryKeyboardTransferPending,true);assert.equal(x.owner.directoryRestoreKeyboard,true,'retiring input does not revoke transfer intent');
  const f=focusField({id:x.id,revision:x.owner.directoryFocusRevision,keyboard:x.owner.directoryRestoreKeyboard,ackFocus:true});
  f.owner.onDirectoryFocusChanged=(id,value)=>x.owner.onDirectoryFocus(x.presentation,id,value);
  f.owner.onDirectoryKeyboardRestoreSettled=(id,value)=>{f.keyboardSettled.push([id,value]);x.owner.onDirectoryKeyboardRestoreSettled(x.presentation,id,value);};
  f.input.onAreaChange({}, {width:200,height:44});
  const focusFrame=f.frames.shift();focusFrame.onFrame(0);
  assert.equal(f.owner.directoryNativeFocused,true,'actual Field receives current Native focus callback before keyboard request');
  assert.equal(f.keyboardRequests.length,0,'native focus is not a keyboard visibility receipt');
  x.owner.syncContentLayout();f.updateKeyboard(x.owner.directoryRestoreKeyboard);assert.equal(f.input.enableKeyboardOnFocus,true);
  f.flush();await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(f.keyboardRequests,[x.id]);assert.equal(x.owner.directoryKeyboardTransferPending,false);
  assert.equal(x.owner.directoryRestoreKeyboard,true);assert.equal(x.metrics.keyboardInsets.bottom,0,'finite successful request does not manufacture a visible native inset');
  x.owner.syncContentLayout();assert.equal(x.owner.directoryRestoreKeyboard,true,'same observed zero after transfer completion remains unknown until new keyboard geometry');
  f.input.onAreaChange({}, {width:200,height:44});f.owner.onDirectoryFocusRequest();f.flush();
  assert.equal(f.keyboardRequests.length,1,'same revision does not repeat native keyboard request');
  x.metrics.keyboardInsets.bottom=300;x.owner.syncContentLayout();
  assert.equal(f.input.onKeyPreIme({type:0,keyCode:2}),false,'explicit Back remains native/unconsumed');
  assert.equal(x.owner.directoryRestoreKeyboard,false,'explicit Back cancels pending restore intent immediately');
  x.owner.syncContentLayout();assert.equal(x.owner.directoryRestoreKeyboard,false,'unchanged positive inset cannot revoke explicit Back');
  x.metrics.keyboardInsets.bottom=0;x.owner.syncContentLayout();
  x.owner.availableHeight=646;x.owner.syncContentLayout();assert.equal(x.owner.directoryKeyboardTransferPending,false,'known hidden input does not acquire a restore transfer');
  const dismissed=focusField({id:x.owner.directoryFocusId(),keyboard:false,ackFocus:true});dismissed.input.onAreaChange({}, {width:200,height:44});dismissed.flush();await new Promise(resolve=>setImmediate(resolve));assert.equal(dismissed.keyboardRequests.length,0);
  for(const invalidate of[
   z=>z.input.onKeyPreIme({type:0,keyCode:2}),
   z=>{z.owner.directoryFocusAllowed=false;z.owner.onDirectoryFocusRequest();},
   z=>z.owner.aboutToDisappear(),
   z=>{z.owner.directoryFocusId='next';z.owner.onDirectoryFocusRequest();},
   z=>z.input.onBlur(),
  ]){
   const z=focusField({ackFocus:true});z.input.onAreaChange({}, {width:200,height:44});z.frames.shift().onFrame(0);invalidate(z);z.flush();await new Promise(resolve=>setImmediate(resolve));assert.equal(z.keyboardRequests.length,0,'retired/Back/disabled/blurred input cannot issue queued keyboard request');
  }
  const failed=focusField({ackFocus:true,show:()=>Promise.reject(Error('detached'))});failed.input.onAreaChange({}, {width:200,height:44});failed.flush();await new Promise(resolve=>setImmediate(resolve));assert.equal(failed.keyboardRequests.length,1);assert.deepEqual(failed.keyboardSettled,[['directory:current',false]]);
  let finish;const stale=focusField({ackFocus:true,show:()=>new Promise(resolve=>{finish=resolve;})});stale.input.onAreaChange({}, {width:200,height:44});stale.flush();stale.owner.aboutToDisappear();finish();await new Promise(resolve=>setImmediate(resolve));assert.equal(stale.keyboardSettled.length,0,'late keyboard Promise does not settle successor');
  const tool=toolbarSdk();const child=tool.children[0];const settles=[];tool.owner.onDirectoryKeyboardRestoreSettled=(id,value)=>settles.push([id,value]);child.params.onDirectoryKeyboardRestoreSettled('toolbar:current',true);assert.deepEqual(settles,[['toolbar:current',true]]);tool.owner.directoryFocusId='toolbar:next';child.params.onDirectoryKeyboardRestoreSettled('toolbar:current',true);assert.equal(settles.length,1,'actual Toolbar rejects old restore callback');
  const revision=x.owner.directoryRestoreKeyboard;x.owner.onDirectoryKeyboardRestoreSettled(x.presentation,x.id,true);assert.equal(x.owner.directoryRestoreKeyboard,revision,'retired Content presentation cannot settle successor');
  console.log(JSON.stringify({kind:'directory-native-ime-transfer-policy',beforeSourceNegative:true,afterRealNativeFocus:true,singlePublicShowRequest:true,explicitBackCancels:true,oldCallbacksRejected:true,boundary:'Actual shipping Content/Field/Toolbar SDK and finite native API port. Physical IME geometry remains Root Native verification.'}));
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
    ...sdk.deps,ReaderInheritedTextStyle,measureReaderControlText,readerReadableFontScale,readerScaledControlHeight,
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
   assert(profile.full.rowHeightVp>=44);assert(profile.full.fieldHeightVp>=44);assert(profile.full.tabHeightVp>=44);
   x.owner.availableHeight=profile.full.minimum.heightVp+16;x.owner.syncContentLayout();
   assert.equal(x.owner.shortContent,!profile.full.minimum.fits,'height sufficiency and width admission consume the same profile');
   x.owner.availableHeight=122;x.owner.syncContentLayout();assert.equal(x.owner.shortContent,true);
   x.owner.minimumIdentity='successor';assert.equal(provider({quickContentWidthVp:width,fullContentWidthVp:width},'stale|'+width),undefined,'old minimum opening cannot publish into successor');
   x.owner.aboutToDisappear();assert.equal(provider({quickContentWidthVp:width,fullContentWidthVp:width},key),undefined);
   profiles.push({width,scale,tab,row:profile.full.rowHeightVp,field:profile.full.fieldHeightVp,toolbar:profile.full.toolbarHeightVp,minimum:profile.full.minimum.heightVp,widthFits:profile.full.minimum.fits});
  }
  console.log(JSON.stringify({kind:'directory-current-minimum-profile-bridge',profiles,boundary:'Production measurer/SDK owner with finite native text metrics; no glyph, focus or physical layout engine claim.'}));
 }
 for(const id of selected){await ({'short-sdk':shortSdk,'prefix-anchors':prefixAnchors,'directory-focus':directoryFocus,'keyboard-observation':keyboardObservation,'keyboard-transfer':keyboardTransfer,'keyboard-ack-delay':keyboardAckDelay,'measured-profile':measuredProfile})[id]();recordContractCasePass(id);}
}
