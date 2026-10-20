import{selectContractCases,recordContractCasePass}from'./lib/contract-case-selection.mjs';
const selected=selectContractCases({geometry:{description:'Actual reading/control safe-frame, explicit inset, font/title and keyboard geometry invariants',resources:[]},'owner-snapshot':{description:'Actual LRE uses coordinator revision cache and preserves frozen/settling layout identity',resources:[]},'sdk-forwarding':{description:'Actual PageTurnSurface SDK build forwards exact layout snapshot and retained update',resources:[]}});
async function run(id){
 const{default:assert}=await import('node:assert/strict');
 const wm=await import('../entry/src/main/ets/features/common/ReaderWindowMetrics.ts');
 const geometry=await import('../entry/src/main/ets/features/reading/ReaderLayoutGeometry.ts');
 const metrics=({top=0,left=0,bottom=0,keyboard=0,font=1}={})=>new wm.ReaderWindowMetricsSnapshot(new wm.ReaderRectVp(0,0,390,844),new wm.ReaderRectVp(0,0,390,844),new wm.ReaderInsetsVp(0,top,0,0),new wm.ReaderInsetsVp(left,0,0,0),new wm.ReaderInsetsVp(0,0,0,bottom),new wm.ReaderInsetsVp(),new wm.ReaderInsetsVp(0,0,0,keyboard),3,font,1,true);
 if(id==='geometry'){
  for(const width of [320,390,599,600,760,1100]){
   const layout=geometry.resolveReaderReadingLayout(width,844,false,metrics({left:40}));
   assert.equal(layout.contentLeft,layout.contentRight,'one-sided cutout keeps centered body');assert.ok(layout.contentLeft>=40);
   assert.equal(layout.bodyWidth(),Math.max(0,width-layout.contentLeft-layout.contentRight));
   assert.ok(layout.contentTop>=0&&layout.contentBottom>=0);
   const panel=geometry.resolveReaderControlLayout(width,844,false,metrics({bottom:24}));
   assert.ok(panel.topBarWidth<=width&&panel.fullPanelWidth<=width);assert.ok(panel.fullPanelHeight>=0);
   assert.ok(panel.fullPanelTop+panel.fullPanelHeight+24<=844+1e-7,'panel stays inside live safe bounds');
  }
  for(const [width,tablet,profile,expected]of [[390,false,{compact:29,expanded:53},29],[760,true,{compact:29,expanded:53},53]]){
   assert.equal(geometry.resolveReaderReadingLayout(width,960,tablet,metrics(),false,profile).contentLeft,expected,'actual configured inset is respected');
  }
  const title=geometry.resolveReaderReadingLayout(390,844,false,metrics({font:1.2}));
  assert.equal(title.bodyHeightAfterTitle(0)-title.bodyHeightAfterTitle(50),50+title.titleToBodySpacingVp,'measured wrapped title consumes its exact lines and one gap');
  const phone=geometry.resolveReaderControlLayout(390,844,false,metrics({keyboard:300}));
  const resized=geometry.resolveReaderControlLayout(390,544,false,metrics({keyboard:300}));
  assert.equal(phone.fullPanelHeight,Math.max(0,844-phone.fullPanelTop-300));
  assert.equal(resized.fullPanelHeight,Math.max(0,544-resized.fullPanelTop-geometry.READER_FULL_PANEL_BOTTOM_GAP),'viewport resize does not subtract keyboard twice');
  assert.equal(geometry.resolveReaderControlLayout(540,700,true,metrics()).widthClass,'compact','window width owns class even on physical tablet');
 }else if(id==='owner-snapshot'){
  const{selectedProductionMethods}=await import('./lib/selected-production-methods.mjs');
  let current=metrics();current.ready=false;current.revision=1;
  const Owner=selectedProductionMethods(new URL('../entry/src/main/ets/features/reading/LocalReadingExperience.ets',import.meta.url),'ReadingExperience',['readingLayout','controlLayout'],{ReaderWindowCoordinator:{metrics:()=>current},...geometry});
  const owner=Object.assign(new Owner(),{readerSettingsSnapshot:{extendIntoCutout:false,hideStatusBar:true,navigationMode:'paged'},isTablet:false,effectiveViewportWidth:()=>390,effectiveViewportHeight:()=>844,getUIContext(){assert.fail('unready metrics do not measure chrome');}});
  const reading=owner.readingLayout(),control=owner.controlLayout(1);assert.equal(owner.readingLayout(),reading);assert.equal(owner.controlLayout(1),control);
  current=metrics({keyboard:300});current.ready=false;current.revision=2;
  assert.notEqual(owner.readingLayout(),reading);assert.notEqual(owner.controlLayout(2),control,'IME/coordinator revision invalidates control snapshot');
  owner.pageTurnFrozenRevision=3;owner.pageTurnRenderRevision=3;owner.pageTurnFrozenLayout=reading;assert.equal(owner.readingLayout(),reading,'active frozen presentation keeps its exact geometry');
  owner.pageTurnSettlementLayout=control;assert.equal(owner.readingLayout(),control,'settling snapshot has first ownership');
 }else{
  const{readFileSync}=await import('node:fs');const{createReaderBuilderProbe}=await import('./lib/reader-control-builder-probe.mjs');
  const source=readFileSync(new URL('../entry/src/main/ets/features/reading/ReaderPageTurnStage.ets',import.meta.url),'utf8');
  const surface=readFileSync(new URL('../entry/src/main/ets/features/reading/ReadingSurface.ets',import.meta.url),'utf8');
  class Child{constructor(owner,params,_storage,id){Object.assign(this,{owner,params,id});}updateStateVars(params){Object.assign(this.params,params);}}
  const owner=createReaderBuilderProbe(source,['build'],{ReadingSurface:Child,COVER_OCCLUSION_RADIUS_VP:0,COVER_OCCLUSION_OFFSET_X_VP:0},{componentName:'ReaderPageTurnSurface',childSources:{ReadingSurface:surface}}).owner;
  const first=geometry.resolveReaderReadingLayout(390,844,false,metrics()),second=geometry.resolveReaderReadingLayout(760,960,true,metrics());
  Object.assign(owner,{layout:first,appearance:{activeTheme:'paper'},pageIdentity:'page',slotIdentity:'slot',pageVisible:true,pageFragmentsProvider:()=>[],shadowStrength:0,shadowColor:()=> '#00000000'});
  owner.initialRender();const child=[...owner.children.values()][0];assert.ok(child);assert.equal(child.params.layout,first,'actual SDK child receives exact owner snapshot');
  owner.layout=second;owner.replay();assert.equal([...owner.children.values()][0],child);assert.equal(child.params.layout,second,'retained child receives replacement exact snapshot');
 }
}
// Async native window writes are independently owned by window-chrome-order cases;
// no regex on while/style spelling and no implicit import/run can establish them here.
for(const id of selected){await run(id);recordContractCasePass(id);}
