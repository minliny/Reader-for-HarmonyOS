import {mangaUserError} from '../entry/src/main/ets/features/manga/MangaUserError.ts';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {productionMotionMethods} from './lib/reader-motion-method-probe.mjs';
import {PhotoViewScaleModel} from '../entry/src/main/ets/features/manga/vendor/photoview/PhotoViewScaleModel.ts';
import {createDefaultReaderSettingsSnapshot,normalizeReaderSettingsSnapshot,setReaderPageTurnStyle} from '../entry/src/main/ets/features/reading/ReaderSettingsState.ts';
const source=readFileSync(new URL('../entry/src/main/ets/features/manga/MangaStripProjection.ts',import.meta.url),'utf8').replace(/^import[^;]+;\n/gm,'').replace(/^export /gm,'');
const Projection=new Function(`${stripTypeScriptTypes(source)};return MangaStripProjection`)();
const p=new Projection();
const manifest={pages:Array.from({length:3},(_,ordinal)=>({ordinal,pageId:`logical-${ordinal}`}))};
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
const timers=[],scrolls=[];
let xOffset=250;let clipped=100;
const Surface=productionMotionMethods(new URL('../entry/src/main/ets/features/manga/MangaReadingSurface.ets',import.meta.url),
 ['effectiveFit','rowDisplayWidth','rowDisplayHeight','rowDisplayTop','rowDisplayLeft','visibleX','changeFit','loginRequired','loginAndRetry','imageError','refreshImages','publish','openDirectory','openSourceSwitch','handleBack','rememberVisible','restore','resizeViewport','changeZoom','toggleDirection','turnPage','saveVisible'],
 {setTimeout:callback=>timers.push(callback),ScrollAlign:{START:'start'}});
const saved=[];const settings=[];
const owner=Object.assign(new Surface(),{data:{totalCount:()=>p.totalCount(),getData:i=>p.row(i),projection:p,notify:()=>{}},
 first:150,last:150,viewportWidth:500,viewportHeight:900,zoom:2,scalePolicy:new PhotoViewScaleModel(),horizontal:false,horizontalPage:0,
 opened:true,mounted:true,layoutGeneration:0,recovering:false,
 settingsGateway:{updateMangaDirection:async value=>settings.push(value)},
 horizontalScroller:{currentOffset:()=>({xOffset}),scrollTo:position=>scrolls.push(['x',position.xOffset])},
 scroller:{getItemRect:()=>({y:-clipped}),scrollToIndex:(...args)=>scrolls.push(['index',...args]),scrollBy:(...args)=>scrolls.push(['y',...args])},
 controller:{chapter:{manifest},totalPages:3,pageAt:ordinal=>manifest.pages[ordinal],pageGeometry:geometry,savePosition:async(...args)=>saved.push(args)},updateViewport:()=>{}});
owner.rememberVisible();assert.deepEqual(owner.visibleAnchor,{ordinal:1,y:0.501,x:0.25});
owner.changeZoom(99);assert.equal(owner.zoom,3);timers.splice(0).forEach(f=>f());
assert.ok(scrolls.some(s=>s[0]==='x'&&s[1]===375));
assert.ok(scrolls.some(s=>s[0]==='y'&&s[2]===150));
// Gesture updates retain the same original anchor even before native layout catches up.
owner.pinchAnchor={ordinal:1,y:0.75,x:0.2};owner.changeZoom(1.5);owner.changeZoom(2.5);
assert.deepEqual(owner.visibleAnchor,owner.pinchAnchor);timers.splice(0).forEach(f=>f());
owner.pinchAnchor=undefined;owner.first=p.index(1,0.5);owner.zoom=2;
await owner.saveVisible();assert.deepEqual(saved.at(-1),[1,0.25,0.501]);
owner.toggleDirection();assert.equal(owner.horizontal,true);assert.equal(owner.horizontalPage,1);
assert.equal(p.totalCount(),100);assert.equal(p.row(0).ordinal,1);assert.deepEqual(settings,[true]);
timers.splice(0).forEach(f=>f());
await owner.turnPage(1);assert.equal(owner.horizontalPage,2);assert.equal(p.row(0).ordinal,2);
timers.splice(0).forEach(f=>f());await owner.turnPage(1);assert.equal(owner.horizontalPage,2,'last image cannot escape chapter');
owner.changeZoom(NaN);assert.equal(owner.zoom,2);owner.changeZoom(0.25);assert.equal(owner.zoom,1);
const prefs=normalizeReaderSettingsSnapshot({...createDefaultReaderSettingsSnapshot(),mangaDirection:'horizontal'});
assert.equal(setReaderPageTurnStyle(prefs,'scroll').mangaDirection,'horizontal');
assert.equal(prefs.navigationMode,'paged','manga preference cannot change text mode');
console.log('PASS production long-image horizontal projection, bounded upstream zoom, delayed gesture layout anchor, both-axis save, page boundaries and independent reading preferences');

let backCount=0,saveCount=0;owner.onBack=()=>backCount++;owner.saveVisible=()=>{saveCount++;return new Promise(()=>{});};
owner.zoom=2;owner.handleBack();assert.equal(owner.zoom,1);assert.equal(backCount,0);assert.equal(saveCount,0);
owner.handleBack();assert.equal(backCount,1);assert.equal(saveCount,1,'unzoomed back must not await network persistence');
const surfaceSource=readFileSync(new URL('../entry/src/main/ets/features/manga/MangaReadingSurface.ets',import.meta.url),'utf8');
assert.match(surfaceSource,/onExitRequestHandler\([\s\S]*?this\.handleBack\(\)/);
assert.match(surfaceSource,/Button\('返回'\)\.onClick\([^\n]*this\.handleBack\(\)/);
console.log('PASS unified system/button back: first leaves zoom, second exits without waiting for progress I/O');

assert.match(mangaUserError('MANGA_REGION_ANIMATION_UNSUPPORTED'),/动画/);
assert.match(mangaUserError('REMOTE_READING_IMAGE_NOT_DOWNLOADED'),/联网/);
assert.equal(mangaUserError('UNEXPECTED_DIAGNOSTIC'), 'UNEXPECTED_DIAGNOSTIC','unknown failures must remain observable');
console.log('PASS targeted manga error messages preserve unknown failures and explain animation/offline recovery');

let finishSave;const actions=[];
owner.saveVisible=()=>new Promise(resolve=>{finishSave=resolve;});
owner.onDirectory=()=>actions.push('directory');owner.onSwitchSource=()=>actions.push('source');
const directory=owner.openDirectory();assert.deepEqual(actions,[]);finishSave();await directory;assert.deepEqual(actions,['directory']);
const switching=owner.openSourceSwitch();finishSave();await switching;assert.deepEqual(actions,['directory','source']);
const stale=owner.openDirectory();owner.mounted=false;finishSave();await stale;assert.deepEqual(actions,['directory','source']);
console.log('PASS manga catalog/download and source controls use existing shell routes after position capture; disposed actions cannot navigate');
