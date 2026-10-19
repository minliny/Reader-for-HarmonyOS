import{selectContractCases,recordContractCasePass}from'./lib/contract-case-selection.mjs';
const selected=selectContractCases({'search-action':{description:'Actual shared search/stop action admission, feedback and retirement',resources:[]},'shelf-clearance':{description:'Actual SDK native shelf List consumes live header/bottom policy without viewport shrink',resources:[]},'source-status':{description:'Actual SDK source discovery spinner props, foreground and reduced motion',resources:[]}});
async function run(id){
 const {default:assert}=await import('node:assert/strict');const{readFileSync}=await import('node:fs');
 const{createRequire,registerHooks,stripTypeScriptTypes}=await import('node:module');
 const hooks=registerHooks({resolve(s,c,next){try{return next(s,c);}catch(e){if(s.startsWith('.')&&!s.endsWith('.ts'))return next(s+'.ts',c);throw e;}}});
 try{
 const{resolveEtsLoaderRoot}=await import('./lib/tool-environment.mjs');
 const{readerAppColor}=await import('../entry/src/main/ets/features/common/ReaderThemeRegistry.ts');
 const{createReaderBuilderProbe}=await import('./lib/reader-control-builder-probe.mjs');
 const read=relative=>readFileSync(new URL('../'+relative,import.meta.url),'utf8');
 if(id==='search-action'){
 const{searchSharedActionFixture,updateActualReaderButton}=await import('./lib/search-shared-action-probe.mjs');
 const{projectOperationFacts}=await import('../entry/src/main/ets/app/ReaderOperationFacts.ts');
 const{sharedActionFeedbackReset}=await import('./lib/shared-action-feedback-state-probe.mjs');
 const{readerTypographyRoles}=await import('./lib/reader-typography-probe.mjs');
for(const isTablet of[false,true])for(const busy of[false,true]){
 const f=searchSharedActionFixture(busy?{kind:'results',operation:projectOperationFacts({phase:'partial',canCancel:true,canRetry:false})}:{kind:'initial'});
 f.page.isTablet=isTablet;
 f.page.searchBar();const action=f.action(isTablet?'search-field-wide':'search-field-phone',busy?'停止':'搜索');
 assert.equal(action.native.backgroundColor,readerAppColor('app.action.fill','day'),'actual shared search action keeps the original dark fill');
 assert.equal(action.native.opacity,1);assert.equal(action.native.enabled,true);
 const label=f.controls.nodes(action.actor).find(n=>n.type==='Text'&&n.create===(busy?'停止':'搜索'));
 assert.ok(label,'actual shared search action mounts its native label');
 const role=readerTypographyRoles[isTablet?'TYPE_SEARCH_FIELD_ACTION_WIDE':'TYPE_SEARCH_FIELD_ACTION'];
 assert.equal(label.fontSize,role.fontSizeFp,'actual action consumes current public size role');
 assert.equal(label.lineHeight,role.lineHeightFp,'actual action consumes current public line-height role');
 assert.equal(label.halfLeading,true,'search and stop labels distribute line leading symmetrically');
 sharedActionFeedbackReset(action.actor,action.native);assert.equal(f.calls.filter(c=>c[0]===(busy?'stopSearch':'performSearch')).length,0,'press and cancel-reset alone never submit or stop');
 action.click();assert.equal(f.calls.filter(c=>c[0]===(busy?'stopSearch':'performSearch')).length,1,'actual native search action submits or stops the live sweep');
 if(busy){
  const spinner=[...f.page.children.values()].findLast(c=>c instanceof f.controls.dependencies.SearchSpinner&&c.active&&c.light);
  assert.ok(spinner,'busy action executes its actual lexical leading Builder and mounts the shared spinner');
  const progress=f.controls.nodes(spinner).find(n=>n.type==='LoadingProgress');
  assert.ok(progress,'actual leading spinner mounts the native loading indicator');
  assert.ok(progress.width>0);assert.equal(progress.height,progress.width,'actual loading affordance is bounded square');
  assert.equal(progress.enableLoading,true,'actual leading spinner enables native loading');
  const row=f.controls.nodes(action.actor).find(n=>n.type==='Row');
  assert.equal(row.alignItems,'VerticalAlign.Center','native spinner and label share the centered action row');
 }
 updateActualReaderButton(f,action.actor,{actionEnabled:false});assert.equal(action.native.enabled,false);assert.equal(action.native.opacity,0.4);
 action.click();assert.equal(f.calls.filter(c=>c[0]===(busy?'stopSearch':'performSearch')).length,1,'disabled real shared actor does not submit or stop');
 updateActualReaderButton(f,action.actor,{actionEnabled:true});action.actor.aboutToDisappear();action.click();
 assert.equal(f.calls.filter(c=>c[0]===(busy?'stopSearch':'performSearch')).length,1,'retired actual shared actor cannot dispatch');
}

 }else if(id==='shelf-clearance'){
 const{productionMotionMethods}=await import('./lib/reader-motion-method-probe.mjs');
 const{createArkUIPropertyRuntimeProbe}=await import('./lib/arkui-property-runtime-probe.mjs');
 const{ReaderWindowMetricsSnapshot,ReaderRectVp,ReaderInsetsVp}=await import('../entry/src/main/ets/features/common/ReaderWindowMetrics.ts');
 const{readerFloatingTabContentInset}=await import('../entry/src/main/ets/features/common/ReaderFloatingBarMetrics.ts');
 const shelf=read('entry/src/main/ets/features/bookshelf/BookshelfPage.ets');
const shelfBreakpoint = Number(read('entry/src/main/ets/features/bookshelf/BookshelfShell.ets')
  .match(/export const BOOKSHELF_WIDE_BREAKPOINT = (\d+);/)[1]);
let shelfMetrics = new ReaderWindowMetricsSnapshot(new ReaderRectVp(0, 0, 390, 844));
const builderMethods = createRequire(import.meta.url)(`${resolveEtsLoaderRoot()}/lib/component_map.js`).CUSTOM_BUILDER_METHOD;
for (const name of ['continueReadingCard', 'sectionAction', 'filterRow', 'projectionRow']) builderMethods.add(name);
const shelfProperties = createArkUIPropertyRuntimeProbe();
const {owner: shelfLayout} = createReaderBuilderProbe(shelf,
  ['bookshelfList', 'isWideViewport', 'effectiveViewportWidth', 'headerClearance'], {
    ...shelfProperties.sdk,
    BOOKSHELF_WIDE_BREAKPOINT: shelfBreakpoint,
    ReaderWindowCoordinator: {metrics: () => shelfMetrics}, readerFloatingTabContentInset,
    LazyForEach: {create() {}, pop() {}},
  }, shelfProperties.hooks);
Object.assign(shelfLayout, {readerWindowMetricsRevision: 0, viewportWidth: 0,
  continueReading: undefined, filterRowVisible: false, viewModeError: '', visibleBookCount: 1,
  rowDataSource: {totalCount: () => 0}, shelfContentWidth: () => 300,
  sectionAction() {}, sectionActionAsset: () => '',
  shelfScrollHandler: () => () => {}, shelfPageHandler: () => () => {},
  saveShelfViewport() {}, restoreShelfViewport() {},
});
const ShelfShell = productionMotionMethods(new URL('../entry/src/main/ets/features/bookshelf/BookshelfShell.ets', import.meta.url),
  ['showBottomNav'], {BOOKSHELF_WIDE_BREAKPOINT: shelfBreakpoint, ReaderWindowCoordinator: {metrics: () => shelfMetrics}});
const shelfShellLayout = Object.assign(new ShelfShell(), {populated: true, readerWindowMetricsRevision: 0, viewportWidth: 0});
shelfLayout.bookshelfList(false);
const shelfListNode = [...shelfLayout.nodes.values()].find(n => n.type === 'List');
assert.ok(shelfListNode, 'the actual shared shelf mounts its native List');
for (const [width, safeBottom] of [[390, 0], [390, 34], [599, 48], [600, 34], [1024, 48]]) {
  shelfMetrics = new ReaderWindowMetricsSnapshot(new ReaderRectVp(0, 0, width, 900),
    undefined, new ReaderInsetsVp(0, 0, 0, safeBottom));
  shelfLayout.replay();
  assert.equal(shelfShellLayout.showBottomNav(), width < shelfBreakpoint,
    'the populated shelf shell mounts a bottom overlay only in the phone layout');
  assert.equal(shelfListNode.height, '100%', 'floating bars do not shrink the actual List viewport');
  assert.equal(shelfListNode.contentStartOffset,shelfLayout.headerClearance,'actual current header clearance remains in scroll content');
  if (width < shelfBreakpoint) {
    assert.equal(shelfListNode.contentEndOffset,readerFloatingTabContentInset(shelfMetrics),'SDK List consumes the actual live floating-tab policy');
  } else {
    assert.ok(shelfListNode.contentEndOffset>=0&&shelfListNode.contentEndOffset<readerFloatingTabContentInset(shelfMetrics),'rail layout has bounded trailing content clearance without phone-tab reservation');
  }
}

 }else{
 const{SOURCE_SWITCH_VISUAL}=await import('../entry/src/main/ets/features/source/SourceSwitchVisual.ts');
const require=createRequire(import.meta.url),sdk=resolveEtsLoaderRoot();
const syntax=require(`${sdk}/lib/validate_ui_syntax.js`);
syntax.componentCollection.customComponents.add('SourceSwitchSpinner');syntax.propCollection.set('SourceSwitchSpinner',new Set(['active','diameter','reduceMotion']));
class SpinnerChild{constructor(owner,params,_storage,id){Object.assign(this,{owner,params,id});}}
const switchSource=readFileSync(new URL('../entry/src/main/ets/features/source/SourceSwitchWindow.ets',import.meta.url),'utf8');
const windowStruct=switchSource.slice(switchSource.indexOf('@Component\nexport struct SourceSwitchWindow'));
const gatewaySource=readFileSync(new URL('../entry/src/main/ets/features/source/SourceSwitchGateway.ts',import.meta.url),'utf8');
const countStart=gatewaySource.indexOf('export function sourceSwitchSourceCount'),countEnd=gatewaySource.indexOf('\nfunction deduplicateSourceSwitchCandidates',countStart);
assert.ok(countStart>=0&&countEnd>countStart,'actual distinct-source count remains bound to production');
const sourceSwitchSourceCount=new Function(stripTypeScriptTypes(gatewaySource.slice(countStart,countEnd)).replace(/^export /gm,'')+';return sourceSwitchSourceCount;')();
const makeStatus=(sweeping=true)=>{
 const {owner:status}=createReaderBuilderProbe(windowStruct,['novelDiscovery'],{SourceSwitchSpinner:SpinnerChild,SOURCE_SWITCH_VISUAL,sourceSwitchSourceCount,ButtonType:{Normal:'ButtonType.Normal'}});
 Object.assign(status,{appThemeScheme:'day',foreground:true,reduceMotion:false,displayedCandidates:[],isSweeping:()=>sweeping,
  statusText:()=>'',novelDiscoveryPhase:()=>sweeping?'正在查找':'已停止',narrowWindow:()=>false,discoveryPrefixVisible:()=>true,
  compactDiscoveryAction:()=>false,discoveryActionVisibleHeight:()=>SOURCE_SWITCH_VISUAL.discoveryActionVisibleHeight,
  discoveryActionBackgroundColor:()=>readerAppColor('TOK_PRIMARY_SOFT','day'),discoveryActionWidth:()=>SOURCE_SWITCH_VISUAL.discoveryActionWidth,
  discoveryActionHitHeight:()=>SOURCE_SWITCH_VISUAL.discoveryActionMinHeight,discoveryToolbarHeight:()=>SOURCE_SWITCH_VISUAL.discoveryHeight,
  busy:()=>false,rollbackRequired:()=>false,discoveryActionTouch:()=>{},requestRefresh:()=>{}});
 status.novelDiscovery();return status;
};
const status=makeStatus();
const spinner=[...status.children.values()][0];assert.equal(spinner.params.active,true);assert.equal(spinner.params.diameter,SOURCE_SWITCH_VISUAL.discoverySpinnerSize);
assert.equal(spinner.params.strokeWidth,undefined);assert.equal(spinner.params.durationMs,undefined,'native LoadingProgress owns stroke and animation timing');
status.foreground=false;status.replay();assert.equal(spinner.params.active,false,'background discovery does not animate');
status.foreground=true;status.reduceMotion=true;status.replay();assert.equal(spinner.params.active,true);assert.equal(spinner.params.reduceMotion,true);
const stopped=makeStatus(false);assert.equal(stopped.children.size,0,'stopped discovery replaces the animation with its selected static search glyph');
assert.ok([...stopped.nodes.values()].some(node=>node.type==='Image'&&node.create==='app.media.search_mag'));

}
}finally{hooks.deregister();}
}
// Broad historical tab, Discover, RSS and Directory source-shape checks are withdrawn.
for(const id of selected){await run(id);recordContractCasePass(id);}
