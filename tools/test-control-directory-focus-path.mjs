import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire,registerHooks} from 'node:module';
import {fileURLToPath} from 'node:url';
import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
const selected=selectContractCases({'toolbar-focus-path':'Actual SDK Content/Toolbar/Field native ancestry: old fixed ancestor false rejects declared focus path, repair/short prefix have no blocker, fixed noninteractive still disabled. This is not a Native focus engine or physical touch proof.'});
if(selected.length){
 registerHooks({resolve(s,c,n){if(s.startsWith('.')&&!/\.[a-z]+$/i.test(s)){const u=new URL(s+'.ts',c.parentURL);if(new URL(u).protocol==='file:'){try{return n(u.href,c);}catch{}}}return n(s,c);}});
 const {createReaderBuilderProbe}=await import('./lib/reader-control-builder-probe.mjs');
 const {boundedSurfaceSdk,boundedMembers}=await import('./lib/bounded-surface-sdk-probe.mjs');
 const {pureModuleProbe}=await import('./lib/ets-pure-module-probe.mjs');
 const {resolveEtsLoaderRoot}=await import('./lib/tool-environment.mjs');
 const {readerControlDirectorySnapshot,ReaderControlDirectoryPosition}=await import('../entry/src/main/ets/features/reading/ui/ReaderControlDirectoryModel.ts');
 const {resolveReaderControlDirectoryGeometry}=await import('../entry/src/main/ets/features/reading/ui/ReaderControlDirectoryGeometry.ts');
 const {sampleReaderControlMotionPresentation}=await import('../entry/src/main/ets/features/reading/ui/ReaderControlMotionPresentation.ts');
 const {sampleReaderControlBookmark}=await import('../entry/src/main/ets/features/reading/ui/ReaderControlBookmarkGeometry.ts');
 const {readerPageAreaLength}=await import('../entry/src/main/ets/ui/layout/ReaderPageShell.ts');
 const {ReaderScrollLayout,readerScrollStartOffset,readerScrollEndOffset}=await import('../entry/src/main/ets/ui/layout/ReaderScrollLayout.ts');
 const read=n=>readFileSync(new URL('../entry/src/main/ets/features/'+n,import.meta.url),'utf8');
 const source=read('reading/ui/ReaderControlDirectoryContent.ets'),toolbar=read('reading/ui/ReaderDirectoryToolbar.ets'),field=read('../ui/controls/ReaderSearchField.ets'),navSource=read('reading/ui/ReaderDirectoryNavigationList.ets');
 const scale=pureModuleProbe(read('../ui/foundation/ReaderSurfaceResolvers.ts'),'ReaderSurfaceResolvers.ts',{},['readerReadableFontScale','readerScaledControlHeight']);
 const a11y=pureModuleProbe(read('../ui/controls/ReaderActionAccessibility.ets'),'ReaderActionAccessibility.ets',{AccessibilityRoleType:{BUTTON:'button'}},['readerActionTouchRegion','ReaderActionAccessibility']);
 const classes=pureModuleProbe(source.slice(0,source.indexOf('@Component')),'ReaderControlDirectoryContent.ets',{FrameCallback:class{}},['ControlDirectoryDataSource','ControlDirectoryFrame']);
 const fieldClasses=pureModuleProbe(field.slice(0,field.indexOf('@Component')),'ReaderSearchField.ets',{FrameCallback:class{},...a11y},['ReaderSearchInputTarget','ReaderSearchFocusFrame']);
 const toolbarValues=pureModuleProbe(toolbar.slice(0,toolbar.indexOf('@Component')),'ReaderDirectoryToolbar.ets',{},['READER_DIRECTORY_TOOLBAR_HEIGHT']);
 const require=createRequire(import.meta.url),map=require(resolveEtsLoaderRoot()+'/lib/component_map.js');
 function compile(action){const old=new Map(map.ID_ATTRS);map.ID_ATTRS.clear();try{return action();}finally{map.ID_ATTRS.clear();for(const[k,v]of old)map.ID_ATTRS.set(k,v);}}
 // Native-call parentage only. Cross-component object identity is recorded;
 // focus eligibility below consumes actual emitted attributes and the SDK's
 // documented TextInput default, never calls or simulates native requestFocus.
 function recorder(){let active;const observers=[],stack=[],nodes=[];const containers=new Set(['Stack','Row','Column','Flex','List','ListItem','__Common__']);
  const hooks={onObserverEnter(owner,id){observers.push(active);active={owner,id};},onObserverExit(){active=observers.pop();}};
  const dependencies=Object.fromEntries([...containers,'TextInput','Text','Image','Divider','Blank','LoadingProgress'].map(type=>{let native;native=new Proxy({name:type},{get(_t,key){if(key==='name')return type;if(key==='canRetake')return()=>false;if(key==='pop')return()=>{if(containers.has(type)){const top=stack.pop();assert.equal(top?.type,type,'actual SDK create/pop nesting');}};return(...args)=>{assert(active,'SDK attribute observer required');const node=active.owner.nodes.get(active.id);if(key==='create'&&!nodes.includes(node)){node.type=type;node.focusParent=stack.at(-1);node.focusRecord=nodes.length;nodes.push(node);if(containers.has(type))stack.push(node);}node[key==='type'?'nativeInputType':key]=args.length===1?args[0]:args;if(key==='attributeModifier')args[0]?.applyNormalAttribute?.(native);return native;};}});return[type,native];}));
  return{hooks,dependencies,nodes,withParent(parent,action){const saved=stack.slice();stack.length=0;let chain=[];for(let n=parent;n;n=n.focusParent)chain.push(n);stack.push(...chain.reverse());try{action();}finally{stack.length=0;stack.push(...saved);}}};
 }
 function render(candidate,{height=320,progress=1,interactive=true}={}){
  const sdk=boundedSurfaceSdk(),tree=recorder(),frames=[],metrics={systemFontScale:1.45,keyboardInsets:{bottom:0}};
  const hooks={...sdk.hooks,onObserverEnter(o,i){sdk.hooks.onObserverEnter?.(o,i);tree.hooks.onObserverEnter(o,i);},onObserverExit(){tree.hooks.onObserverExit();sdk.hooks.onObserverExit?.();}};
  const common={...sdk.deps,...tree.dependencies,...scale,...a11y,...classes,...fieldClasses,...toolbarValues,readerPageAreaLength,readerWindowMetrics:()=>metrics,
   uiContext:{getFont:()=>({}),postFrameCallback:f=>frames.push(f),getFocusController:()=>({requestFocus(){assert.fail('path probe must not manufacture Native focus');}})},TextInputController:class{},Scroller:class{},
   readerControlDirectorySnapshot,ReaderControlDirectoryPosition,resolveReaderControlDirectoryGeometry,sampleReaderControlMotionPresentation,sampleReaderControlBookmark,
   readerScrollStartOffset,readerScrollEndOffset,ViewStackProcessor:{StartGetAccessRecordingFor(){},StopGetAccessRecording(){}},ScrollAlign:{START:'start',CENTER:'center'},Edge:{Top:'top',Bottom:'bottom'}};
  const Field=compile(()=>createReaderBuilderProbe(field,boundedMembers(field),common,hooks)).Component;
  const Toolbar=compile(()=>createReaderBuilderProbe(toolbar,boundedMembers(toolbar),{...common,ReaderSearchField:Field}, {...hooks,childSources:{...sdk.childSources,ReaderSearchField:field}})).Component;
  const navNames=['build','emptyPrefix','nativeHeaderCount','nativeDisplayIndex','dataIndex','prefixBuilder','emptyBuilder','headerCount'];
  const Nav=compile(()=>createReaderBuilderProbe(navSource,navNames,common,hooks)).Component;
  class Child{constructor(owner,params,_store,id){Object.assign(this,{owner,params,id,children:new Map(),nodes:new Map()});}updateStateVars(p){Object.assign(this.params,p);}initialRender(){}}
  // The Core/Surface port is finite, but its prefix uses the actual shipping
  // NavigationList Builder. No alternate flat renderer or Core algorithm is used.
  class TreePort extends Child{initialRender(){const n=new Nav(this,{});Object.assign(n,{...this.params,mangaDisplay:false,view:{visibleTotal:1},dataSource:{totalCount:()=>0},prefixBuilder:this.params.prefixBuilder,emptyBuilder(){},scrollLayout:new ReaderScrollLayout(0,0,'contentOffset'),listPaddingX:0,listPaddingRight:0,listPaddingY:0,listPaddingTop:0,listPaddingBottom:0,scroller:{},onFirstLayout(){},onUserScrollIntent(){},onScrollSettled(){}});this.children.set('list',n);n.initialRender();for(const node of n.nodes.values())if(node.type==='ListItem'&&typeof node.create?.[0]==='function')tree.withParent(node,()=>node.create[0](node.id,true));}}
  const childSources={ReaderSearchField:field,ReaderDirectoryToolbar:toolbar,ReaderDirectoryNavigationSurface:read('reading/ui/ReaderDirectoryNavigationSurface.ets'),ReaderDirectoryChapterRow:read('reading/ui/ReaderDirectoryChapterRow.ets'),ReaderBookmarkRow:read('reading/ui/ReaderBookmarkRow.ets'),ReaderBookmarkEmptyState:read('reading/ui/ReaderBookmarkEmptyState.ets'),ReaderBookmarkLoadingState:read('reading/ui/ReaderBookmarkLoadingState.ets'),ReaderBookmarkErrorState:read('reading/ui/ReaderBookmarkErrorState.ets')};
  const deps={...common,ReaderSearchField:Field,ReaderDirectoryToolbar:Toolbar,ReaderDirectoryNavigationSurface:TreePort,ReaderDirectoryChapterRow:Child,ReaderBookmarkRow:Child,ReaderBookmarkEmptyState:Child,ReaderBookmarkLoadingState:Child,ReaderBookmarkErrorState:Child};
  const owner=compile(()=>createReaderBuilderProbe(candidate,boundedMembers(candidate),deps,{...hooks,childSources:{...sdk.childSources,...childSources}})).owner;
  Object.assign(owner,{availableHeight:height,availableWidth:314,progress,interactionEnabled:interactive,readerWindowMetricsRevision:1,entries:Array.from({length:4},(_,i)=>({index:i,title:'Chapter '+i,navigable:true})),tab:'directory',sessionKey:'focus-path',currentChapterIndex:1,bookmarkIdentity:{sourceId:'fixture',bookId:'book',libraryBookId:'fixture:book',bookName:'Fixture'},navigationPortFactory:()=>({}),scroller:{currentOffset:()=>({yOffset:0}),getItemIndex:()=>0,getItemRect:()=>({y:0,height:53})}});
  owner.aboutToAppear();owner.initialRender();const input=tree.nodes.find(n=>n.type==='TextInput');assert(input,'actual Field reaches native TextInput');const path=[];for(let n=input;n;n=n.focusParent)path.push(n);assert(path.length>=4);return{owner,input,path,tree};
 }
 function declaredFocusPath(result){const blockers=result.path.filter(n=>n.focusable===false||n.enabled===false);return{eligible:blockers.length===0,blockers};}
 const fixed=render(source);assert.equal(fixed.owner.shortContent,false);const fixedResult=declaredFocusPath(fixed);assert.equal(fixedResult.eligible,true,'actual fixed TextInput ancestor declarations must admit focus');assert.equal(fixed.input.focusable,undefined,'native TextInput keeps its documented default; no forced focus setter');
 const before=readFileSync(new URL('./fixtures/design/directory-confluence-before/focus-ancestor.ets.txt',import.meta.url),'utf8');
 const old=render(before),oldResult=declaredFocusPath(old);assert.equal(oldResult.eligible,false,'real SDK old ancestor blocks the path');assert(oldResult.blockers.some(n=>n.type==='Stack'&&n.focusable===false&&n.enabled===true));
 const short=render(source,{height:122});assert.equal(short.owner.shortContent,true);assert(short.path.some(n=>n.type==='ListItem'),'short query follows actual Native List prefix ancestry');assert.equal(declaredFocusPath(short).eligible,true);
 for(const opts of[{progress:.5},{interactive:false}]){const inactive=render(source,opts),blocked=declaredFocusPath(inactive);assert.equal(blocked.eligible,false);assert(blocked.blockers.some(n=>n.enabled===false&&n.hitTestBehavior==='HitTestMode.None'&&n.accessibilityLevel==='no-hide-descendants'),'existing noninteractive native enabled/hitTest/a11y guard remains');}
 console.log(JSON.stringify({kind:'declared-native-focus-path',normal:fixed.path.map(n=>({type:n.type,focusable:n.focusable,enabled:n.enabled})),oldBlockers:oldResult.blockers.map(n=>({type:n.type,focusable:n.focusable,enabled:n.enabled})),shortPrefix:true,noninteractiveBlocked:true,boundary:'Actual SDK emitted ancestry/default declarations only; no Native focus/touch/IME/layout engine was run.'}));
 recordContractCasePass('toolbar-focus-path');
}
