import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createRequire,registerHooks} from 'node:module';
import {fileURLToPath} from 'node:url';
import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
const selected=selectContractCases({
 'short-sdk':'Actual SDK short prefix/flat List and normal defaults at 122/168/190 x2: one primary List, real declared64 row,44 actions/query/clear and state headers. Finite native/Scroller ports, no physical scroll claim.',
 'prefix-anchors':'Actual owner methods and SDK retained Surface reference across authored/short: Native/data index, header-not-chapter, Tree anchor delegation, retired idle/focus and actual current action callbacks.',
 'directory-focus':'Actual SearchField opt-in modifier and finite after-layout focus, current id/revision/mounted guards, cancel/old callback and default disabled/no setter negative controls; Toolbar local opt-in lifetime.',
 'keyboard-observation':'Actual SDK Content and Field modifier distinguish fresh unknown keyboard inset0 from observed-visible then hidden, retain policy across same-instance layout migration and retire old opening callbacks/frames. No Native keyboard service or IME claim.',
});
if(selected.length){
 const productionRoot=new URL('../entry/src/main/ets/',import.meta.url).href;
 const resolver=registerHooks({resolve(specifier,context,next){if(context.parentURL?.startsWith(productionRoot)&&specifier.startsWith('.')&&!/\.[a-z]+$/i.test(specifier))return next(specifier+'.ts',context);return next(specifier,context);}});
 try {
 const {createReaderComponentProbe}=await import('./lib/reader-component-probe.mjs');
 const {builderComponentMembers}=await import('./lib/ets-builder-probe.mjs');
 const {directoryControlSdk,directorySdkDeclarations,directoryControlFault}=await import('./lib/directory-control-sdk-probe.mjs');
 const {pureModuleProbe}=await import('./lib/ets-pure-module-probe.mjs');
 const {resolveEtsLoaderRoot}=await import('./lib/tool-environment.mjs');
 const {readerControlDirectorySnapshot,ReaderControlDirectoryPosition}=await import('../entry/src/main/ets/features/reading/ReaderControlDirectoryModel.ts');
 const {resolveReaderControlDirectoryGeometry}=await import('../entry/src/main/ets/features/reading/ReaderControlDirectoryGeometry.ts');
 const {sampleReaderControlMotionPresentation}=await import('../entry/src/main/ets/features/reading/ReaderControlMotionPresentation.ts');
 const {sampleReaderControlBookmark}=await import('../entry/src/main/ets/features/reading/ReaderControlBookmarkGeometry.ts');
 const {readerPageAreaLength}=await import('../entry/src/main/ets/features/common/ReaderPageShell.ts');
 const read=n=>readFileSync(new URL('../entry/src/main/ets/features/'+n,import.meta.url),'utf8');
 const content=read('reading/ReaderControlDirectoryContent.ets'),field=read('common/ReaderSearchField.ets'),toolbar=read('reading/ReaderDirectoryToolbar.ets');
 const {readerReadableFontScale,readerScaledControlHeight}=pureModuleProbe(read('common/ReaderSurfaceResolvers.ts'),'ReaderSurfaceResolvers.ts',{},['readerReadableFontScale','readerScaledControlHeight']);
 const accessibility=pureModuleProbe(read('common/ReaderActionAccessibility.ets'),'ReaderActionAccessibility.ets',{AccessibilityRoleType:{BUTTON:'button'}},['readerActionTouchRegion','ReaderActionAccessibility']);
 const require=createRequire(import.meta.url),map=require(resolveEtsLoaderRoot()+'/lib/component_map.js');
 const compile=f=>{const ids=map.ID_ATTRS,saved=new Map(ids);ids.clear();try{return f();}finally{ids.clear();for(const[k,v]of saved)ids.set(k,v);}};
 const frameDeps={FrameCallback:class{}};
 const classes=directorySdkDeclarations(content,'ReaderControlDirectoryContent.ets',frameDeps);
 const fieldClasses=directorySdkDeclarations(field,'ReaderSearchField.ets',{...frameDeps,...accessibility});
 const toolbarValues=directorySdkDeclarations(toolbar,'ReaderDirectoryToolbar.ets');
 const entries=()=>Array.from({length:60},(_,i)=>({index:i,title:'第'+i+'章 长章节标题',navigable:true,bookmarks:[{time:i+1,chapterIndex:i,chapterOffset:0,chapterTitle:'第'+i+'章',content:'完整书签正文与长内容',bookText:'正文'}]}));
 const identity={sourceId:'fixture',bookId:'book',libraryBookId:'fixture:book',bookName:'Fixture',bookAuthor:'Author'};
 function actor({height=168,width=268,scale=2,tab='directory',tree=false,source=content}={}){
  const sdk=directoryControlSdk(),frames=[],children=[],calls=[],scroll=[],port={kind:'existing-business-port'},metrics={systemFontScale:scale,keyboardInsets:{bottom:0}};let portCreations=0;
  class Child{constructor(owner,params,_storage,id){Object.assign(this,{owner,params,id});children.push(this);}updateStateVars(next){Object.assign(this.params,next);}}
  class Surface extends Child{constructor(...args){super(...args);this.port=this.params.navigationPortFactory?.();}}
  const childSources={ReaderSearchField:field,ReaderDirectoryToolbar:toolbar,ReaderDirectoryNavigationSurface:read('reading/ReaderDirectoryNavigationSurface.ets'),ReaderDirectoryChapterRow:read('reading/ReaderDirectoryChapterRow.ets'),ReaderBookmarkRow:read('reading/ReaderBookmarkRow.ets'),ReaderBookmarkEmptyState:read('reading/ReaderBookmarkEmptyState.ets'),ReaderBookmarkLoadingState:read('reading/ReaderBookmarkLoadingState.ets'),ReaderBookmarkErrorState:read('reading/ReaderBookmarkErrorState.ets'),ReaderPageState:read('common/ReaderPageState.ets'),ReaderRecoveryAction:read('common/ReaderRecoveryAction.ets')};
  const scroller={offset:0,index:1,rect:{y:0,height:64},scrollToIndex(...v){scroll.push(['index',...v]);},scrollTo(v){scroll.push(['offset',v]);},scrollEdge(v){scroll.push(['edge',v]);},currentOffset(){return{yOffset:this.offset};},getItemIndex(){return this.index;},getItemRect(){return this.rect;}};
  const deps={...sdk.deps,...classes,...accessibility,readerControlDirectorySnapshot,ReaderControlDirectoryPosition,resolveReaderControlDirectoryGeometry,readerReadableFontScale,readerScaledControlHeight,readerPageAreaLength,
   sampleReaderControlBookmark,sampleReaderControlMotionPresentation,ReaderWindowCoordinator:{metrics:()=>metrics},
   ReaderSearchField:Child,ReaderDirectoryToolbar:Child,ReaderDirectoryNavigationSurface:Surface,ReaderDirectoryChapterRow:Child,ReaderBookmarkRow:Child,
   ReaderBookmarkEmptyState:Child,ReaderBookmarkLoadingState:Child,ReaderBookmarkErrorState:Child,ReaderPageState:Child,ReaderRecoveryAction:Child,
   uiContext:{getFont:()=>({}),postFrameCallback:f=>frames.push(f)},Scroller:class{},ViewStackProcessor:{StartGetAccessRecordingFor(){},StopGetAccessRecording(){}},
   Edge:{Top:'Edge.Top',Bottom:'Edge.Bottom'},ScrollAlign:{START:'ScrollAlign.START',CENTER:'ScrollAlign.CENTER'},ScrollSource:{SCROLLER:'ScrollSource.SCROLLER'},
   LazyForEach:{name:'LazyForEach',create(_id,_owner,data,generator){for(let i=0;i<data.totalCount();i++)generator(data.getData(i),i);},pop(){}},
   readerDirectoryScopeKey:()=> 'fixture:book',readerDirectorySignalScrollIntent(){},readerDirectorySignalScrollCommand(){},
  };
  const {owner}=compile(()=>createReaderComponentProbe(source,builderComponentMembers(source),deps,{...sdk.hooks,childSources:{...childSources}}));
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
   const tools=nodes.filter(n=>n.type==='Stack'&&['搜索','到顶部','到底部','切换排序','清除搜索'].includes(n.accessibilityText));
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
   const n=x.sdk.nodes(x.owner);assert.equal(n.filter(v=>v.type==='List').length,1);assert(n.some(v=>v.type==='Stack'&&v.accessibilityText==='清除搜索'),'state does not remove clear/header');assert(n.filter(v=>v.type==='ListItem').length>=2);
  }
  for(const height of[190,646]){const x=actor({height});x.owner.progress=height===190?0:1;x.owner.syncContentLayout();assert.equal(x.owner.shortContent,false,'Quick/portrait remains authored');}
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
 function focusField({variant='readerDirectory',id='directory:current',allowed=true,revision=1,keyboard=true,current=()=>true}={}){
  const sdk=directoryControlSdk(),frames=[],focus=[],events=[];
  const deps={...sdk.deps,...fieldClasses,...accessibility,readerPageAreaLength,readerReadableFontScale,readerScaledControlHeight,
   ReaderWindowCoordinator:{metrics:()=>({systemFontScale:2})},TextInputController:class{},
   uiContext:{getFont:()=>({}),postFrameCallback:f=>frames.push(f),getFocusController:()=>({requestFocus:id=>focus.push(id)})}};
  const{owner}=compile(()=>createReaderComponentProbe(field,builderComponentMembers(field),deps,sdk.hooks));
  Object.assign(owner,{variant,mode:'submit',readerWindowMetricsRevision:1,directoryFocusId:id,directoryFocusAllowed:allowed,directoryFocusRevision:revision,directoryKeyboardOnFocus:keyboard,directoryFocusCurrent:current,onDirectoryFocusChanged:(id,value)=>events.push([id,value]),onTextChange(){},onSubmit(){}});owner.aboutToAppear();owner.initialRender();
  const inputEntry=[...owner.nodes.entries()].find(([,n])=>n.type==='TextInput');
  return{owner,sdk,frames,focus,events,input:inputEntry?.[1],updateKeyboard(value){owner.directoryKeyboardOnFocus=value;owner.replayOnly([inputEntry[0]]);},flush(){while(frames.length){const f=frames.shift();f.onIdle?.(0);}}};
 }

 function toolbarSdk({id='toolbar:current',current=()=>true}={}){
  const sdk=directoryControlSdk(),children=[],events=[];
  class Child{constructor(owner,params,_storage,id){Object.assign(this,{owner,params,id});children.push(this);}updateStateVars(next){Object.assign(this.params,next);}}
  const deps={...sdk.deps,ReaderSearchField:Child,...toolbarValues,readerReadableFontScale,readerScaledControlHeight,ReaderWindowCoordinator:{metrics:()=>({systemFontScale:2})}};
  const{owner}=compile(()=>createReaderComponentProbe(toolbar,builderComponentMembers(toolbar),deps,{...sdk.hooks,childSources:{ReaderSearchField:field}}));
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
  const shortId=ime.owner.directoryFocusId();ime.metrics.keyboardInsets.bottom=0;ime.owner.availableHeight=646;ime.owner.syncContentLayout();assert.equal(ime.owner.shortContent,false);assert.equal(ime.owner.directoryRestoreKeyboard,false,'Back-hidden IME is not re-opened by programmatic focus');assert.notEqual(ime.owner.directoryFocusId(),shortId);
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
  const before=directoryControlFault(content,'unknown-keyboard-is-hidden');
  const old=focusedActor(before);old.owner.syncContentLayout();assert.equal(old.owner.directoryRestoreKeyboard,false,'targeted old-policy fault incorrectly converts fresh same-key0 to hidden');
  old.field.updateKeyboard(old.owner.directoryRestoreKeyboard);assert.equal(old.field.input.enableKeyboardOnFocus,false,'negative reaches actual Native modifier, not only a private flag');
  current.metrics.keyboardInsets.bottom=200;current.owner.syncContentLayout();assert.equal(current.owner.directoryKeyboardWasVisible,true);assert.equal(current.owner.directoryRestoreKeyboard,true);
  current.owner.availableHeight=168;current.owner.syncContentLayout();current.owner.onListLayout();current.flush();assert.equal(current.owner.shortContent,true);assert(current.owner.directoryFocusRevision>0);assert(current.scroll.some(v=>v[0]==='index'&&v[1]===0),'focused authored→prefix keeps header reveal after real List layout');
  current.metrics.keyboardInsets.bottom=0;current.owner.syncContentLayout();assert.equal(current.owner.directoryRestoreKeyboard,false,'observed-visible then0 preserves Back-hidden policy even with identical layout key');
  current.field.updateKeyboard(current.owner.directoryRestoreKeyboard);assert.equal(current.field.input.enableKeyboardOnFocus,false);
  current.owner.availableHeight=646;current.owner.syncContentLayout();current.owner.onListLayout();current.flush();assert.equal(current.owner.shortContent,false);assert.equal(current.owner.directoryRestoreKeyboard,false,'prefix→authored restore does not reopen known-hidden keyboard');
  const oldRevision=current.owner.directoryFocusRevision,oldId=current.id,oldPresentation=current.presentation;
  current.owner.layoutRestorePending=true;current.owner.queueLayoutRestore();const staleFrame=current.frames.shift();
  current.owner.tab='bookmarks';current.owner.openList();assert.equal(current.owner.directoryInputFocused,false);assert.equal(current.owner.directoryKeyboardWasVisible,false);assert.equal(current.owner.directoryRestoreKeyboard,true,'new tab/opening does not inherit old hidden state');
  current.owner.onDirectoryFocus(oldPresentation,oldId,true);assert.equal(current.owner.directoryInputFocused,false,'old input cannot focus new opening');staleFrame.onFrame(0);assert.equal(current.owner.directoryFocusRevision,oldRevision,'old queued restoration cannot mutate successor');
  current.owner.onDirectoryFocus(current.owner.layoutPresentation,current.owner.directoryFocusId(),true);current.owner.syncContentLayout();assert.equal(current.owner.directoryRestoreKeyboard,true,'new opening inset0 remains unknown');
  current.metrics.keyboardInsets.bottom=200;current.owner.syncContentLayout();assert.equal(current.owner.directoryKeyboardWasVisible,true);
  current.owner.aboutToDisappear();assert.equal(current.owner.directoryKeyboardWasVisible,false);assert.equal(current.owner.directoryRestoreKeyboard,true);current.owner.syncContentLayout();assert.equal(current.owner.directoryKeyboardWasVisible,false,'retired owner cannot observe a keyboard for successor');
  console.log(JSON.stringify({kind:'keyboard-observation-policy',freshZero:'unknown-preserves-true',oldPolicyFault:'false-negative-reproduced',visibleThenZero:'hidden-preserves-false',sameInstanceMigration:true,retiredOpening:true,boundary:'Actual SDK Content/Field callbacks and emitted modifier only; no Native IME service or physical keyboard was run.'}));
 }
 for(const id of selected){await ({'short-sdk':shortSdk,'prefix-anchors':prefixAnchors,'directory-focus':directoryFocus,'keyboard-observation':keyboardObservation})[id]();recordContractCasePass(id);}
 } finally { resolver.deregister(); }
}
