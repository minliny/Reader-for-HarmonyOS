import { resolveEtsLoaderRoot, virtualFilePath } from './lib/tool-environment.mjs';
import { READER_FONT_NOTO_SERIF_SC_BOLD } from '../entry/src/main/ets/features/common/ReaderFontFamilies.ts';
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
const sdk=resolveEtsLoaderRoot();
const ts=require(`${sdk}/node_modules/typescript`);
const tree=ts.createSourceFile(virtualFilePath('MangaNavigationProbe.ets'),surfaceSource,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,require(`${sdk}/lib/ets_checker.js`).compilerOptions);
assert.equal(tree.parseDiagnostics.length,0);
const frame=tree.statements.find(n=>n.name?.getText(tree)==='MangaLayoutFrame');assert.ok(frame);
const MangaLayoutFrame=new Function('FrameCallback',`${stripTypeScriptTypes(frame.getText(tree))};return MangaLayoutFrame`)(class {});
const timers=[],scrolls=[],frames=[],measurements=[];
function flushLayout(width,height) {
  timers.splice(0).forEach(callback=>callback());
  for(let phase=0;phase<2;phase++) {
    const batch=frames.splice(0);
    for(const frame of batch) {
      assert.ok(frame instanceof MangaLayoutFrame,'deliver the actual production callback class');
      frame.onFrame(0);
    }
    nativeWidth=width;nativeHeight=height;
    for(const frame of batch) frame.onIdle(2_000_000);
  }
  assert.equal(frames.length,0,'scroll application and geometry confirmation use two rendered frames');
}
let xOffset=250;let clipped=100;let nativeWidth=1000;let nativeHeight=1000;
const Surface=productionMotionMethods(surfaceURL,
 ['effectiveFit','rowDisplayWidth','rowDisplayHeight','rowDisplayTop','rowDisplayLeft','visibleX','changeFit','loginRequired','loginAndRetry','imageError','refreshImages','publish','requestedLast','measureVisibleWindow','openDirectory','openSourceSwitch','handleBack','positionIdentity','rememberVisible','restore','finishLayout','onViewportScroll','resizeViewport','changeZoom','toggleDirection','turnPage','saveVisible'],
 {setTimeout:callback=>timers.push(callback),ScrollAlign:{START:'start'},LengthMetrics:{vp:value=>({value,unit:'vp'})},MangaLayoutFrame,
  inputMethod:{getController:()=>({hideTextInput:async()=>{}})}, READER_FONT_NOTO_SERIF_SC_BOLD,
  prepareReaderFontFamily:async family=>{assert.equal(family,READER_FONT_NOTO_SERIF_SC_BOLD);},
  prepareMangaSheetFonts:async()=>true});
const saved=[];const settings=[];
const owner=Object.assign(new Surface(),{data:{totalCount:()=>p.totalCount(),getData:i=>p.row(i),projection:p,notify:()=>{}},
 first:150,last:150,viewportWidth:500,viewportHeight:900,zoom:2,scalePolicy:new PhotoViewScaleModel(),horizontal:false,horizontalPage:0,
 opened:true,mounted:true,panel:'',panelPhase:'closed',panelGeneration:0,panelActionGeneration:0,panelFontGeneration:0,panelFontsReady:false,reduceMotion:true,chapterEnd:false,exiting:false,layoutGeneration:0,appliedLayoutGeneration:-1,presentationGeneration:0,recovering:false,
 settingsGateway:{updateMangaDirection:async value=>settings.push(value)},
 horizontalScroller:{currentOffset:()=>({xOffset}),scrollTo:position=>{xOffset=position.xOffset;scrolls.push(['x',position.xOffset]);}},
 getUIContext:()=>({postFrameCallback:frame=>frames.push(frame),getFocusController:()=>({clearFocus(){}})}),
 scroller:{getItemIndex:(x,y)=>{measurements.push([x,y]);return owner.first;},getItemRect:()=>({y:-clipped,width:nativeWidth,height:nativeHeight}),scrollToIndex:(...args)=>{assert.equal(args[3].extraOffset.unit,'vp');clipped=args[3].extraOffset.value;assert.ok(Number.isFinite(clipped));scrolls.push(['index',...args]);},scrollBy:(...args)=>{clipped=args[1];scrolls.push(['y',...args]);}},
 controller:{chapter:{manifest},totalPages:3,pageAt:ordinal=>manifest.pages[ordinal],pageGeometry:geometry,tile:()=>undefined,visiblePages:()=>[],savePosition:async(...args)=>saved.push(args),close:async()=>{}},updateViewport:()=>{},persistentDirectory:()=>false});
owner.rememberVisible();assert.deepEqual(owner.visibleAnchor,{ordinal:1,y:0.501,x:0.25});
owner.changeZoom(99);assert.equal(owner.zoom,3);flushLayout(1500,1500);
assert.ok(scrolls.some(s=>s[0]==='x'&&s[1]===375));
assert.ok(scrolls.some(s=>s[0]==='index'&&s[1]===p.index(1,0.501)&&s[4].extraOffset.value===150&&s[4].extraOffset.unit==='vp'));
assert.equal(scrolls.some(s=>s[0]==='y'),false,'the target row and 150vp offset are consumed in one native request');
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
assert.match(surfaceSource,/iconAction\([\s\S]*?'返回',[\s\S]*?this\.handleBack\(\)/);
console.log('PASS unified system/button back: first leaves zoom, second awaits accepted progress before exit');

assert.equal(mangaUserError('MANGA_SESSION_CONTENT_CHANGED'),'章节内容或书源已更新，请重新打开本章。');
assert.match(mangaUserError('MANGA_REGION_ANIMATION_UNSUPPORTED'),/动画/);
assert.match(mangaUserError('REMOTE_READING_IMAGE_NOT_DOWNLOADED'),/联网/);
assert.equal(mangaUserError('READING_IMAGE_REPROCESS_REQUIRED'),'图片处理规则已更新，需联网重新下载');
assert.match(mangaUserError('Internal error'),/图片服务暂时不可用/);
assert.match(mangaUserError('manga.resource.prepare failed: Internal error'),/图片服务暂时不可用/);
const unknownDiagnostic='UNEXPECTED_DIAGNOSTIC';
const safeUnknown='漫画暂时无法加载，请重试；仍失败时可尝试切换书源。';
assert.equal(mangaUserError(unknownDiagnostic),safeUnknown,'unknown diagnostics have a recoverable public hint');
assert.equal(mangaUserError('upstream /private/book?token=secret'),safeUnknown,'unrecognized upstream details never become public copy');
const diagnostics=[];
const ErrorSurface=productionMotionMethods(surfaceURL,['displayError'],{mangaUserError,hilog:{warn:(...args)=>diagnostics.push(args)}});
const errorSurface=Object.assign(new ErrorSurface(),{reportedErrorCodes:new Set()});
assert.equal(errorSurface.displayError(unknownDiagnostic),safeUnknown);
assert.equal(errorSurface.displayError(unknownDiagnostic),safeUnknown);
assert.deepEqual([...errorSurface.reportedErrorCodes],[unknownDiagnostic],'presentation keeps the original diagnostic identity');
assert.equal(diagnostics.length,1,'repeated rendering does not repeat the same diagnostic');
assert.equal(diagnostics[0].at(-1),unknownDiagnostic,'the actual Surface diagnostic retains the original code');
console.log('PASS targeted manga error messages retain diagnostic facts while exposing safe animation/offline/unknown recovery hints');

let finishSave;const actions=[];
owner.saveVisible=()=>new Promise(resolve=>{finishSave=resolve;});
owner.onDirectory=()=>actions.push('directory');owner.onSwitchSource=()=>actions.push('source');
const directory=owner.openDirectory();assert.deepEqual(actions,[]);await directory;assert.equal(owner.panel,'directory');assert.deepEqual(actions,[]);
finishSave(); // Visual admission does not wait for storage; navigation below still does.
const switching=owner.openSourceSwitch();finishSave();await switching;assert.deepEqual(actions,['source']);
const stale=owner.openDirectory();owner.mounted=false;finishSave();await stale;assert.deepEqual(actions,['source']);
console.log('PASS manga catalog/download and source controls use existing shell routes after position capture; disposed actions cannot navigate');
