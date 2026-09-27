import {mangaUserError} from '../entry/src/main/ets/features/manga/MangaUserError.ts';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire,stripTypeScriptTypes} from 'node:module';
import {productionMotionMethods} from './lib/reader-motion-method-probe.mjs';
import {PhotoViewScaleModel} from '../entry/src/main/ets/features/manga/vendor/photoview/PhotoViewScaleModel.ts';
import {createDefaultReaderSettingsSnapshot,normalizeReaderSettingsSnapshot,setReaderPageTurnStyle} from '../entry/src/main/ets/features/reading/ReaderSettingsState.ts';
const source=readFileSync(new URL('../entry/src/main/ets/features/manga/MangaStripProjection.ts',import.meta.url),'utf8').replace(/^import[^;]+;\n/gm,'').replace(/^export /gm,'');
const Projection=new Function(`${stripTypeScriptTypes(source)};return MangaStripProjection`)();
const p=new Projection();
const manifest={chapter:{sourceId:'s',bookId:'b',chapterId:'/c'},manifestVersion:'navigation-v1',pages:Array.from({length:3},(_,ordinal)=>({ordinal,pageId:`logical-${ordinal}`}))};
const geometry=()=>({width:1000,height:100000,tileHeight:1000});
p.publish(manifest,geometry,1);
assert.equal(p.totalCount(),100,'horizontal page retains every long-image region');
assert.equal(p.row(99).ordinal,1);assert.equal(p.row(99).sourceY,99000);
assert.equal(p.index(1,0.991),99);
assert.throws(()=>p.index(0,0),/ANCHOR_INVALID/);
p.publish(manifest,geometry);
assert.equal(p.index(1,0.991),199,'orientation changes preserve original image identity');
assert.equal(p.position(199,110,1000),0.9911);
assert.equal(p.position(199,330,3000),0.9911,'zoom is presentation only');
const surfaceURL=new URL('../entry/src/main/ets/features/manga/MangaReadingSurface.ets',import.meta.url);
const surfaceSource=readFileSync(surfaceURL,'utf8');
const require=createRequire(import.meta.url);
const sdk=process.env.READER_ETS_LOADER_ROOT??'/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const ts=require(`${sdk}/node_modules/typescript`);
const tree=ts.createSourceFile('/tmp/MangaNavigationProbe.ets',surfaceSource,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,require(`${sdk}/lib/ets_checker.js`).compilerOptions);
assert.equal(tree.parseDiagnostics.length,0);
const frame=tree.statements.find(n=>n.name?.getText(tree)==='MangaLayoutFrame');assert.ok(frame);
const MangaLayoutFrame=new Function('FrameCallback',`${stripTypeScriptTypes(frame.getText(tree))};return MangaLayoutFrame`)(class {});
const timers=[],scrolls=[],frames=[],measurements=[];
function flushLayout(width,height) {
  timers.splice(0).forEach(callback=>callback());
  nativeWidth=width;nativeHeight=height;
  for(const frame of frames.splice(0)) {
    assert.ok(frame instanceof MangaLayoutFrame,'deliver the actual production callback class');
    frame.onFrame(0);
  }
}
let xOffset=250;let clipped=100;let nativeWidth=1000;let nativeHeight=1000;
const Surface=productionMotionMethods(surfaceURL,
 ['effectiveFit','rowDisplayWidth','rowDisplayHeight','rowDisplayTop','rowDisplayLeft','visibleX','changeFit','loginRequired','loginAndRetry','imageError','refreshImages','publish','requestedLast','measureVisibleWindow','openDirectory','openSourceSwitch','handleBack','positionIdentity','rememberVisible','restore','finishLayout','onViewportScroll','resizeViewport','changeZoom','toggleDirection','turnPage','saveVisible'],
 {setTimeout:callback=>timers.push(callback),ScrollAlign:{START:'start'},MangaLayoutFrame});
const saved=[];const settings=[];
const owner=Object.assign(new Surface(),{data:{totalCount:()=>p.totalCount(),getData:i=>p.row(i),projection:p,notify:()=>{}},
 first:150,last:150,viewportWidth:500,viewportHeight:900,zoom:2,scalePolicy:new PhotoViewScaleModel(),horizontal:false,horizontalPage:0,
 opened:true,mounted:true,layoutGeneration:0,appliedLayoutGeneration:-1,presentationGeneration:0,recovering:false,
 settingsGateway:{updateMangaDirection:async value=>settings.push(value)},
 horizontalScroller:{currentOffset:()=>({xOffset}),scrollTo:position=>{xOffset=position.xOffset;scrolls.push(['x',position.xOffset]);}},
 getUIContext:()=>({postFrameCallback:frame=>frames.push(frame)}),
 scroller:{getItemIndex:(x,y)=>{measurements.push([x,y]);return owner.first;},getItemRect:()=>({y:-clipped,width:nativeWidth,height:nativeHeight}),scrollToIndex:(...args)=>{clipped=0;scrolls.push(['index',...args]);},scrollBy:(...args)=>{clipped=args[1];scrolls.push(['y',...args]);}},
 controller:{chapter:{manifest},totalPages:3,pageAt:ordinal=>manifest.pages[ordinal],pageGeometry:geometry,savePosition:async(...args)=>saved.push(args)},updateViewport:()=>{}});
owner.rememberVisible();assert.deepEqual(owner.visibleAnchor,{ordinal:1,y:0.501,x:0.25});
owner.changeZoom(99);assert.equal(owner.zoom,3);flushLayout(1500,1500);
assert.ok(scrolls.some(s=>s[0]==='x'&&s[1]===375));
assert.ok(scrolls.some(s=>s[0]==='y'&&s[2]===150));
assert.deepEqual(measurements,[[0.5,0.5],[0.5,899.5]],'actual frame measures the current platform viewport');
// Gesture updates retain the same original anchor even before native layout catches up.
owner.pinchAnchor={ordinal:1,y:0.75,x:0.2};owner.changeZoom(1.5);owner.changeZoom(2.5);
assert.deepEqual(owner.visibleAnchor,owner.pinchAnchor);flushLayout(1250,1250);
// A later measured native viewport has returned to 200% and this clipped row.
owner.pinchAnchor=undefined;owner.first=p.index(1,0.5);owner.zoom=2;
nativeWidth=1000;nativeHeight=1000;clipped=100;xOffset=250;
await owner.saveVisible();assert.deepEqual(saved.at(-1),[1,0.25,0.501]);
owner.toggleDirection();assert.equal(owner.horizontal,true);assert.equal(owner.horizontalPage,1);
assert.equal(p.totalCount(),100);assert.equal(p.row(0).ordinal,1);assert.deepEqual(settings,[true]);
flushLayout(1000,1000);
await owner.turnPage(1);assert.equal(owner.horizontalPage,2);assert.equal(p.row(0).ordinal,2);
flushLayout(1000,1000);await owner.turnPage(1);assert.equal(owner.horizontalPage,2,'last image cannot escape chapter');
owner.changeZoom(NaN);assert.equal(owner.zoom,2);owner.changeZoom(0.25);assert.equal(owner.zoom,1);
const prefs=normalizeReaderSettingsSnapshot({...createDefaultReaderSettingsSnapshot(),mangaDirection:'horizontal'});
assert.equal(setReaderPageTurnStyle(prefs,'scroll').mangaDirection,'horizontal');
assert.equal(prefs.navigationMode,'paged','manga preference cannot change text mode');
console.log('PASS production long-image horizontal projection, bounded upstream zoom, delayed gesture layout anchor, both-axis save, page boundaries and independent reading preferences');

let backCount=0,saveCount=0,finishBackSave;owner.onBack=()=>backCount++;owner.saveVisible=()=>{saveCount++;return new Promise(resolve=>{finishBackSave=resolve;});};
owner.zoom=2;await owner.handleBack();assert.equal(owner.zoom,1);assert.equal(backCount,0);assert.equal(saveCount,0);
const leaving=owner.handleBack();assert.equal(backCount,0);assert.equal(saveCount,1,'unzoomed back retains the reader until progress settles');
finishBackSave();await leaving;assert.equal(backCount,1);
assert.match(surfaceSource,/onExitRequestHandler\([\s\S]*?this\.handleBack\(\)/);
assert.match(surfaceSource,/Button\('返回'\)\.onClick\([^\n]*this\.handleBack\(\)/);
console.log('PASS unified system/button back: first leaves zoom, second awaits accepted progress before exit');

assert.match(mangaUserError('MANGA_REGION_ANIMATION_UNSUPPORTED'),/动画/);
assert.match(mangaUserError('REMOTE_READING_IMAGE_NOT_DOWNLOADED'),/联网/);
assert.equal(mangaUserError('READING_IMAGE_REPROCESS_REQUIRED'),'图片处理规则已更新，需联网重新下载');
assert.equal(mangaUserError('UNEXPECTED_DIAGNOSTIC'), 'UNEXPECTED_DIAGNOSTIC','unknown failures must remain observable');
console.log('PASS targeted manga error messages preserve unknown failures and explain animation/offline recovery');

let finishSave;const actions=[];
owner.saveVisible=()=>new Promise(resolve=>{finishSave=resolve;});
owner.onDirectory=()=>actions.push('directory');owner.onSwitchSource=()=>actions.push('source');
const directory=owner.openDirectory();assert.deepEqual(actions,[]);finishSave();await directory;assert.deepEqual(actions,['directory']);
const switching=owner.openSourceSwitch();finishSave();await switching;assert.deepEqual(actions,['directory','source']);
const stale=owner.openDirectory();owner.mounted=false;finishSave();await stale;assert.deepEqual(actions,['directory','source']);
console.log('PASS manga catalog/download and source controls use existing shell routes after position capture; disposed actions cannot navigate');
