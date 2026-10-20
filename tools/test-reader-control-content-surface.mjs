import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions={
 'sampler':{description:'Production composition sampler fixed Full surface geometry',resources:[]},
 'stage-surface':{description:'Actual SDK Stage surface identity, opacity, order and transparent viewport seam',resources:[]},
 'tts-backdrop':{description:'Actual SDK Quick TTS backdrop retires on shared progress and cannot receive input',resources:[]}
};
const selected=selectContractCases(definitions);
async function runCase(selectedCase){
 const {default:assert}=await import('node:assert/strict');
 const motion=await import('../entry/src/main/ets/features/reading/ReaderControlMotionGeometry.ts');
 const bounds=motion.readerControlMotionBounds(364,736,19);
 if(selectedCase==='sampler'){
  for(const p of [0,.2,.5,.8,1,.8,.5,.2,0])for(const v of [1,.5,0]){
   const frame=motion.sampleReaderControlMotionComposition({expansionProgress:p,visibilityProgress:v},bounds);
   assert.deepEqual(frame.contentSurface,{x:13,y:frame.shell.y+57,width:338,height:666,opacity:p});
   assert.ok(Math.abs(frame.contentSurface.y-frame.content.y-28*(1-p))<1e-8);
  }
  return;
 }
 const {readFileSync}=await import('node:fs');
 const {createReaderBuilderProbe}=await import('./lib/reader-control-builder-probe.mjs');
 if(selectedCase==='tts-backdrop'){
  const source=readFileSync(new URL('../entry/src/main/ets/features/reading/ReaderControlTtsContent.ets',import.meta.url),'utf8');
  const {owner}=createReaderBuilderProbe(source,['quickBackdrop']);
  Object.assign(owner,{availableWidth:286,availableHeight:190,appScheme:'day',p:()=>0});owner.quickBackdrop();
  assert.equal(owner.nodes.size,1,'one authored backdrop');const node=[...owner.nodes.values()][0];
  for(const p of [0,.3,1,.7,0]){owner.p=()=>p;owner.replay();assert.equal(node.opacity,1-p);assert.equal(node.hitTestBehavior,'HitTestMode.None');}
  return;
 }
 const source=readFileSync(new URL('../entry/src/main/ets/features/reading/ReaderControlMotionStage.ets',import.meta.url),'utf8');
 const {readerControlNativeTree}=await import('./fixtures/reader-control-native-tree.mjs');
 for(const module of ['directory','tts','appearance','settings','search','autoPage','replace']){
  const tree=readerControlNativeTree();
  const {owner}=createReaderBuilderProbe(source,['build','topBarContent','moduleContent','fullHeaderContent','brightnessContent','navigationContent'],{...tree.dependencies,readerControlHasFullContentSurface:motion.readerControlHasFullContentSurface,
   readerControlContentLocation:()=>({level:'secondary'})},tree.hooks);
  let frame=motion.sampleReaderControlMotionComposition({expansionProgress:0,visibilityProgress:1},bounds),contentOrder;
  Object.assign(owner,{frame:()=>frame,bounds:()=>bounds,contentModule:()=>module,visualSession:{heldPointerId:-1},inputEnabled:true,
   topBarContent(){},topBarWidthValue:()=>364,viewportWidthValue:()=>390,viewportHeightValue:()=>844,topBarTopValue:()=>19,
   topBarFrame:()=>({opacity:1,translateY:0}),dockLeftValue:()=>13,dockTopValue:()=>88,
   fullContentMountWidth:()=>338,fullContentMountHeight:()=>666,
   moduleContent(){contentOrder=owner.nodes.size;},fullHeaderContent(){},brightnessContent(){},navigationContent(){},accessibleControlActions(){}});
  owner.initialRender();assert.equal(tree.remaining(),0);
  const surfaces=[...owner.nodes.values()].filter(n=>n.id==='reader-control-verification-content-surface');assert.equal(surfaces.length,1);
  const surface=surfaces[0],identity=surface;
  assert.ok(surface.creationOrder<contentOrder,'fixed surface is authored before module viewport');
  for(const p of [0,.2,.5,1,.5,0]){
   frame=motion.sampleReaderControlMotionComposition({expansionProgress:p,visibilityProgress:1},bounds);owner.replay();
   assert.equal([...owner.nodes.values()].find(n=>n.id==='reader-control-verification-content-surface'),identity);
   assert.equal(surface.width,338);assert.equal(surface.height,666);assert.equal(surface.opacity,motion.readerControlHasFullContentSurface(module)?p:0);
   assert.equal(surface.visibility,'Visibility.Visible');assert.equal(surface.enabled,false);assert.equal(surface.hitTestBehavior,'HitTestMode.None');
   const mount=[...owner.nodes.values()].find(n=>n.type==='Stack'&&n.width===338&&n.height===666&&n.clip===true);
   assert.ok(mount,'module mount retains Full dimensions');assert.equal(mount.backgroundColor,undefined,'module viewport does not paint second Full fill');
  }
 }
}
for(const id of selected){await runCase(id);recordContractCasePass(id);}
