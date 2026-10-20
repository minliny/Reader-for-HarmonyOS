import {selectContractCases, recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions = {"safe-frame": {"description": "真实栏inset、nav frame与宿主局部rail坐标", "resources": []}};
for (const id of selectContractCases(definitions)) {
  await runSelectedCase();
  recordContractCasePass(id);
}
async function runSelectedCase() {


const {default: assert} = await import('node:assert/strict');
const {selectedProductionMethods} = await import('./lib/selected-production-methods.mjs');
const {resolveHorizontalFrame,SurfaceWidthSpec} = await import('../entry/src/main/ets/features/common/SurfaceHorizontalGeometry.ts');
const base=new URL('../entry/src/main/ets/',import.meta.url);
let metrics={windowRect:{width:410,height:800},left:51,right:7,top:30,bottom:20};
const dependencies={ReaderWindowCoordinator:{metrics:()=>metrics},readerInteractiveSafeLeft:m=>m.left,
 readerInteractiveSafeRight:m=>m.right,readerVisualSafeTop:m=>m.top,readerInteractiveSafeBottom:m=>m.bottom,
 TOK_HOME_TOP_BAR_INSET:17,TOK_SPACE_CONTROL_INLINE:20,resolveHorizontalFrame,SurfaceWidthSpec,MAIN_TABS:[{}, {}, {}]};
for(const [file,name] of [['features/common/AppTopBar.ets','AppTopBar'],['features/common/PageBackBar.ets','PageBackBar']]) {
 const Owner=selectedProductionMethods(new URL(file,base),name,['leftInset','rightInset'],dependencies);
 const owner=Object.assign(new Owner(),{floating:false,readerWindowMetricsRevision:0,variant:'standard'});
 const left=owner.leftInset(),right=owner.rightInset();
 assert.ok(left>=metrics.left && right>=metrics.right,'independent actual safe boundaries');
 metrics={...metrics,left:7,right:51};
 assert.equal(owner.leftInset(),right);assert.equal(owner.rightInset(),left,'asymmetric edges mirror independently');
 metrics={...metrics,left:51,right:7};
}
const Bar=selectedProductionMethods(new URL('features/shell/MainTabBar.ets',base),'MainTabBar',['bottomBarFrame','liveWindowWidth'],dependencies);
const bar=Object.assign(new Bar(),{readerWindowMetricsRevision:0});
for(const [width,left,right] of [[410,51,7],[250,3,49],[0,10,20],[NaN,10,20],[90,120,6]]) {
 metrics={...metrics,windowRect:{...metrics.windowRect,width},left,right};
 const frame=bar.bottomBarFrame();const w=Number.isFinite(width)?Math.max(0,width):0;
 assert.ok(Number.isFinite(frame.width)&&frame.width>=0&&frame.left>=0&&frame.right>=0);
 assert.ok(frame.left+frame.width<=w && frame.right+frame.width<=w,'actual nav frame remains inside live width');
 if(w>=left+right) {assert.ok(frame.left>=left);assert.ok(frame.right>=right);}
}
const Shell=selectedProductionMethods(new URL('features/shell/MainTabShell.ets',base),'MainTabShell',['railTop'],dependencies),shell=new Shell();
metrics={...metrics,windowRect:{width:410,height:800},top:30,bottom:20};const original=shell.railTop();
metrics={...metrics,windowRect:{width:410,height:780},top:10};assert.equal(shell.railTop(),original,'same available host span cannot apply safeTop twice');
metrics={...metrics,windowRect:{width:410,height:0}};assert.equal(shell.railTop(),0);

}
