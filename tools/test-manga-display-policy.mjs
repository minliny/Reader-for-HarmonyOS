import assert from 'node:assert/strict';
import {productionMotionMethods} from './lib/reader-motion-method-probe.mjs';
import {normalizeReaderSettingsSnapshot,createDefaultReaderSettingsSnapshot} from '../entry/src/main/ets/features/reading/ReaderSettingsState.ts';
const Surface=productionMotionMethods(new URL('../entry/src/main/ets/features/manga/MangaReadingSurface.ets',import.meta.url),
 ['effectiveFit','rowDisplayWidth','rowDisplayHeight','rowDisplayTop','rowDisplayLeft','visibleX','changeFit','resizeViewport','loginRequired','loginAndRetry','imageError','refreshImages']);
const row={ordinal:8,tileIndex:1,known:true,width:1000,height:1000,sourceHeight:4000,sourceY:1000};
const restored=[],settings=[],retries=[];let fail='READING_IMAGE_AUTH_REQUIRED';
const chapter={manifest:{manifestVersion:1,displayHints:{fit:'contain'}}};
const owner=Object.assign(new Surface(),{viewportWidth:500,viewportHeight:800,zoom:1,fitPreference:'source',horizontalScroller:{currentOffset:()=>({xOffset:150})},
 controller:{setPreviewMode:async()=>{},chapter,displayedOrdinal:8,savedLocation:{pageOrdinalFallback:8,x:0.1,y:0.6},recoveryRequired:false,
  tile:()=>({error:fail}),visiblePages:()=>[],retryTile:async(...args)=>retries.push(args),refreshChapter:async()=>{}},
 saveVisible:async()=>{},rememberVisible:()=>{},visibleAnchor:{ordinal:8,x:0.25,y:0.55},restore:(...args)=>restored.push(args),settingsGateway:{updateMangaFit:async fit=>settings.push(fit)},
 data:{totalCount:()=>10,getData:()=>row},first:1,last:1,opened:true,mounted:true,error:'',loggingIn:false,loginGeneration:0,updateViewport:async()=>{},publish:()=>{}});
assert.equal(owner.rowDisplayWidth(row),200,'SINGLE contain must fit the whole logical image, not each crop');
assert.equal(owner.rowDisplayLeft(row),150);assert.equal(owner.visibleX(row),0);
await owner.changeFit();assert.equal(owner.fitPreference,'width');assert.equal(owner.rowDisplayWidth(row),500);assert.deepEqual(restored.at(-1),[8,0.55,0.25]);
await owner.changeFit();assert.equal(owner.rowDisplayWidth(row),200);assert.deepEqual(settings,['width','contain']);
chapter.manifest.displayHints.fit='width';assert.equal(owner.rowDisplayWidth(row),200,'explicit user preference wins source changes');
await owner.changeFit();assert.equal(owner.rowDisplayWidth(row),500);
chapter.manifest.displayHints={sourceImageStyle:'LEFT'};assert.equal(owner.effectiveFit(),'width','unsupported text style must not invent manga behavior');
owner.resizeViewport(500,600);assert.equal(owner.viewportHeight,600);assert.deepEqual(restored.at(-1),[8,0.55,0.25],'height-only rotation/reflow preserves anchor');
const prefs=normalizeReaderSettingsSnapshot({...createDefaultReaderSettingsSnapshot(),mangaFit:'contain'});assert.equal(prefs.mangaFit,'contain');
assert.equal(normalizeReaderSettingsSnapshot({...prefs,mangaFit:'unknown'}).mangaFit,undefined);
let completeLogin;owner.onLoginSource=()=>new Promise(resolve=>completeLogin=resolve);
assert.equal(owner.loginRequired(),true);const login=owner.loginAndRetry();assert.equal(owner.loggingIn,true);completeLogin();await login;
assert.deepEqual(retries,[[8,1]]);assert.equal(chapter.manifest.manifestVersion,1,'login retry never refreshes the manifest');
for(const reason of ['disposed','moved','manifest']){
 owner.mounted=true;owner.first=1;owner.loggingIn=false;chapter.manifest.manifestVersion=1;
 const pending=owner.loginAndRetry();if(reason==='disposed')owner.mounted=false;else if(reason==='moved')owner.first=2;else chapter.manifest.manifestVersion=2;
 completeLogin();await pending;assert.equal(retries.length,1,reason+' fences late login');
}
owner.mounted=true;owner.first=1;owner.loggingIn=false;fail='READING_IMAGE_SIGNATURE_EXPIRED';assert.equal(owner.loginRequired(),false);
fail='READING_IMAGE_AUTH_REQUIRED';owner.offline=true;assert.equal(owner.loginRequired(),false);owner.offline=false;
await owner.refreshImages();assert.equal(owner.horizontalPage,8);assert.deepEqual(restored.at(-1),[8,0.6,0.1]);
owner.controller.recoveryRequired=true;await owner.refreshImages();assert.equal(owner.recovering,true);assert.deepEqual(restored.at(-1),[8,0,0],'ambiguous recovery preserves the displayed page without adopting old coordinates');
console.log('PASS production imageStyle width/contain, explicit preference priority, whole-image crop geometry, both-axis anchor, height reflow, login one-retry/no-refresh/fences, exact refresh restores global ordinal and ambiguous recovery remains explicit');
