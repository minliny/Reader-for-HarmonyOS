import assert from 'node:assert/strict';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
const file=new URL('../entry/src/main/ets/features/reading/LocalReadingExperience.ets',import.meta.url);
class ReaderMaterializedChapterContext {
  constructor(chapter,layoutMap,contentVersion,paragraphRanges,paginationDraft,desiredChapterOffset,desiredChapterProgress,measurementRequestedAnchorScalar){Object.assign(this,{chapter,layoutMap,contentVersion,paragraphRanges,paginationDraft,desiredChapterOffset,desiredChapterProgress,measurementRequestedAnchorScalar});}
}
class ReaderPageTurnPreparation {constructor(direction,origin,originChapterIndex,originPageStartScalar,generation){Object.assign(this,{direction,origin,originChapterIndex,originPageStartScalar,generation});}}
class ReadingSurfaceLayoutMap {constructor(content){this.content=content;}scalarCount(){return this.content.length;}}
const Owner=productionMotionMethods(file,['beginPageTurnPreparation','captureMaterializedChapterContext','measuringChapter','measuringOffset','measuringProgress','measuringRanges','measuringDraft','measuringRequestedAnchor','setMeasuringOffset','setMeasuringProgress','setMeasuringDraft','setMeasuringRequestedAnchor','suspendAdjacentMeasurement','finishAdjacentMeasurementContext'],{ReaderMaterializedChapterContext,ReaderPageTurnPreparation,ReadingSurfaceLayoutMap});
const origin={chapterIndex:1,content:'old chapter text',contentVersion:'v1'};
const target={chapterIndex:2,content:'new adjacent chapter text',contentVersion:'v2'};
const map=new ReadingSurfaceLayoutMap(origin.content);const ranges=[{startScalar:0,endScalar:16}];
const owner=Object.assign(new Owner(),{mounted:true,chapter:origin,chapterLayoutMap:map,materializedContentVersion:'v1',paragraphRanges:ranges,desiredChapterOffset:3,desiredChapterProgress:.2,measurementRequestedAnchorScalar:3,visiblePage:{startScalar:3},pageTurnGeneration:7,
 canTurnPage:()=>true,chapterWindow:{get:()=>target},requireChapter:()=>origin,requireChapterLayoutMap:()=>map,copyParagraphRanges:r=>r.slice(),admitChapterContentVersion(){},lastVisibleScalar:c=>c.length-1,
 beginMeasurement(){this.phase='measuring';this.setMeasuringOffset(8);this.measuringRanges().push({startScalar:8,endScalar:20});},
 measurementGeneration:1,measurementEpoch:1,measurementBatch:[{}],pageTurnPreparationQueue:[],resetPendingPage(){},cancelMeasurementDeadline(){},currentPaginationKey:()=>({}),
});
assert.equal(owner.beginPageTurnPreparation('next',{chapterIndex:2,chapterOffset:4}),'begun');
assert.equal(owner.measuringChapter(),target);assert.equal(owner.measuringOffset(),8);
assert.equal(owner.chapter,origin);assert.equal(owner.chapterLayoutMap,map);assert.equal(owner.desiredChapterOffset,3);assert.equal(owner.paragraphRanges,ranges);assert.equal(ranges.length,1,'adjacent range construction cannot mutate visible ranges');
owner.suspendAdjacentMeasurement();assert.equal(owner.phase,'ready');assert.equal(owner.adjacentMeasurementContext,undefined);assert.equal(owner.chapter,origin);assert.equal(owner.desiredChapterOffset,3);assert.deepEqual(owner.pageTurnPreparationQueue,['next']);assert.equal(owner.measurementGeneration,2,'late image/layout replies lose their generation');
owner.beginMeasurement=()=>{owner.phase='ready';};
assert.equal(owner.beginPageTurnPreparation('previous',{chapterIndex:2,chapterOffset:0}),'retry');assert.equal(owner.adjacentMeasurementContext,undefined);assert.equal(owner.chapter,origin);
console.log('production adjacent measurement isolation, cancellation and rejected admission: PASS');

const draft={matches:()=>true};owner.adjacentMeasurementContext={chapter:origin,paginationDraft:draft};owner.finishAdjacentMeasurementContext();assert.equal(owner.paginationDraft,draft,'normal discovery completion keeps observed head prefix for next reverse lookup');assert.equal(owner.adjacentMeasurementContext,undefined);

// A clock-only refresh after promotion must read the physical current subtree,
// never the stale role ID registered on the now-empty reserve subtree.
class PendingSnapshot { constructor(identity,pageGeneration,pixelMap){Object.assign(this,{identity,pageGeneration,pixelMap});} }
const Capture = productionMotionMethods(file, ['captureBookTurnTexture','takeBookTurnPendingSnapshot','releaseBookTurnPendingSnapshot'], {
  ReaderBookTurnSnapshot:PendingSnapshot,
  BOOK_TURN_TEXTURE_CURRENT: 0, READER_BOOK_TURN_CURRENT_PAGE_SNAPSHOT_ID: 'native-current',
  errorMessageOf: e => String(e),
});
const reads = [], uploads = [];
const capture = Object.assign(new Capture(), {
  mounted: true, phase: 'ready', pageTurnGeneration:1, bookTurnRuntimeFailed: false, bookTurnTextureCaptureGeneration: 9,
  usesBookTurnSimulation: () => true, controlVisible: () => false, pageTurnInputPhase: () => 'idle',
  bookTurnCapturedIdentity: () => '', bookTurnTextureSnapshotScale: () => 1,
  setBookTurnCapturedIdentity: () => {}, failBookTurnTextureCapture: (_s,_g,m) => { throw Error(m); },
  bookTurnSession: { uploadTexture: (slot, pixels) => { uploads.push(pixels.id); return true; } },
  getUIContext: () => ({getComponentSnapshot: () => ({get: async (id, opts) => {
    assert.equal(opts.waitUntilRenderFinished, true); reads.push(id);
    assert.equal(id, `native-current-${capture.pageTurnCurrentSlot}`);
    return {id, release() {}};
  }})}),
});
for (const physical of ['a', 'b', 'a']) {
  capture.pageTurnCurrentSlot = physical;
  assert.equal(await capture.captureBookTurnTexture(0, {textureIdentity:`page-${physical}-new-minute`,fragments:[]}, 9), true);
}
assert.deepEqual(reads, ['native-current-a','native-current-b','native-current-a']);
assert.deepEqual(uploads, reads);
console.log('production current snapshot remains bound to physical slot after promotion: PASS');

// A late worker completion cannot enqueue pixels or disable the capability.
let finishCopy;
let released = 0;
capture.getUIContext = () => ({getComponentSnapshot: () => ({get: async () => ({release() { released++; }})})});
capture.bookTurnSession.uploadTexture = (_slot, _map, _identity, canPublish) =>
  new Promise(resolve => { finishCopy = () => resolve(canPublish()); });
const lateCopy = capture.captureBookTurnTexture(0, {textureIdentity:'old-clock',fragments:[]}, 9);
await Promise.resolve();
assert.equal(released, 0, 'PixelMap remains alive while the native worker reads it');
capture.bookTurnTextureCaptureGeneration = 10;
capture.pageTurnGeneration++;
finishCopy();
assert.equal(await lateCopy, false);
assert.equal(released, 1, 'stale copied pixels still release their PixelMap');
console.log('async texture copy preserves lifetime and rejects superseded capture: PASS');

// Reproduce eviction after walking forward across many chapters, then coming
// back two chapter boundaries: a pagination target is not a materialized body.
const { ReadingChapterWindow } = await import('../entry/src/main/ets/features/reading/ReadingChapterWindow.ts');
const Demand = productionMotionMethods(file,
  ['requestPageTurnChapter', 'isStableVisiblePageOwner', 'startPreviousPagePreparationDiscovery', 'beginPageTurnPreparation'],
  { readerRapidPageTurnDirection: state => state.direction });
const makeChapter = index => ({ sourceId:'s', bookId:'b', chapterIndex:index, chapterTitle:`Chapter ${index}`,
  content:`body ${index}`, contentVersion:`version ${index}`, images:[], extractionVia:'local' });
for (const outcome of ['success', 'generation', 'page', 'exit', 'failure', 'wrong-identity']) {
  const window = new ReadingChapterWindow(); window.configure('s','b',Array.from({length:30},(_,i)=>i));
  for (let i=0;i<27;i++) window.setCurrent(makeChapter(i));
  const current = makeChapter(25); window.setCurrent(current);
  assert.equal(window.get(24), undefined, 'previous body really was pruned during forward traversal');
  let resolve, reject, loads=0; const queued=[], messages=[], admitted=[];
  const subject = Object.assign(new Demand(), { mounted:true, exitRequested:false, sourceId:'s', bookId:'b',
    chapter:current, visiblePage:{startScalar:0}, pageTurnGeneration:10, lifecycleToken:3, chapterSelectionToken:5,
    visiblePageSelectionToken:5, pageTurnChapterLoads:new Set(), chapterWindow:window,
    isMountedToken: token=>subject.mounted && token===subject.lifecycleToken,
    isSelectionCurrent: token=>token===subject.chapterSelectionToken, isKnownControlChapter: index=>window.contains(index),
    canTurnPage:()=>true, paragraphRanges:[{startScalar:0}], adjacentChapterIndex: (i,d)=>window.adjacentChapterIndex(i,d),
    activeGateway:()=>({loadChapter:(_book,index,isCurrent)=>{loads++;assert.equal(index,24);assert.equal(isCurrent(),true);
      return new Promise((yes,no)=>{resolve=yes;reject=no;});}}),
    admitChapterContentVersion:(index,version)=>admitted.push([index,version]), retainCurrentChapterWindow(){},
    queuePageTurnPreparation: direction=>queued.push(direction), drainPageTurnPreparationQueue(){},
    rapidPageTurnState:{direction:'previous'},activePagePointerId:-1,
    getUIContext:()=>({getPromptAction:()=>({showToast:value=>messages.push(value)})}),
  });
  assert.equal(subject.startPreviousPagePreparationDiscovery(), true, 'missing predecessor starts bounded acquisition, not dead-end measurement');
  assert.equal(subject.beginPageTurnPreparation('previous',{chapterIndex:24,chapterOffset:5}), 'abandon');
  subject.requestPageTurnChapter('previous',24); assert.equal(loads,1,'same generation shares one load');
  assert.equal(subject.chapter,current);assert.deepEqual(queued,[]);
  if (outcome==='generation') subject.pageTurnGeneration++;
  if (outcome==='page') subject.visiblePage={startScalar:3};
  if (outcome==='exit') subject.exitRequested=true;
  if (outcome==='failure') reject(Error('read unavailable'));
  else resolve(makeChapter(outcome==='wrong-identity'?23:24));
  await new Promise(r=>setImmediate(r));
  assert.equal(subject.pageTurnChapterLoads.size,0);
  assert.deepEqual(queued,outcome==='success'?['previous']:[], 'only a current exact neighbour resumes its preparation');
  assert.equal(window.get(24)!==undefined,outcome==='success');
  assert.equal(admitted.length,outcome==='success'?1:0);
  assert.equal(messages.length,['failure','wrong-identity'].includes(outcome)?1:0);
  assert.equal(subject.chapter,current,'acquisition never swaps the visible chapter or writes progress');
  if (outcome==='failure') {
    subject.requestPageTurnChapter('previous',24); assert.equal(loads,2,'a later explicit request can retry once');
    resolve(makeChapter(24));await new Promise(r=>setImmediate(r));assert.deepEqual(queued,['previous']);
  }
}
console.log('production evicted previous chapter: demand refill, coalescing, stale/failed replies and explicit retry: PASS');

const nextTasks=[];
const PreparationOrder=productionMotionMethods(file,['schedulePageTurnPreparation'], {
  readerPageTransitionUsesPreparedPages:()=>true, setTimeout:callback=>nextTasks.push(callback),
});
const orderOwner=Object.assign(new PreparationOrder(), {pageTurnGeneration:0,pageTurnRenderRevision:0,
  preferredPageTextureDirection:'previous',drains:0,drainPageTurnPreparationQueue(){this.drains++;}});
orderOwner.schedulePageTurnPreparation();
assert.deepEqual(orderOwner.pageTurnPreparationQueue,['previous','next']);
orderOwner.preferredPageTextureDirection='next'; orderOwner.schedulePageTurnPreparation();
assert.deepEqual(orderOwner.pageTurnPreparationQueue,['next','previous']);
nextTasks[0]();assert.equal(orderOwner.drains,0,'obsolete preparation epoch cannot restart work');
nextTasks[1]();assert.equal(orderOwner.drains,1);
console.log('production promotion preparation honors requested direction and stale callback guard: PASS');

// A successful layout-only bitmap can still omit a file image. Exercise the
// production checked capture and publication path with cold decoder replies.
const bodyCaptures=[];
class ImageContent { constructor(_ui,_builder,input){this.input=input;this.disposed=0;bodyCaptures.push(this);} update(input){this.input=input;} dispose(){this.disposed++;} }
class TextureInput {constructor(page){this.page=page;}}
const ImageCapture=productionMotionMethods(file,['captureBookTurnTexture','captureDecodedBookTurnPage','releaseBookTurnTextureContent','takeBookTurnPendingSnapshot','releaseBookTurnPendingSnapshot'], {
  ReaderBookTurnSnapshot:PendingSnapshot,
  BOOK_TURN_TEXTURE_CURRENT:0, READER_BOOK_TURN_CURRENT_PAGE_SNAPSHOT_ID:'native-current',
  ComponentContent:ImageContent, BookTurnTextureBuildInput:TextureInput, BookTurnTextureBuilder:()=>{},
  wrapBuilder: value=>value, errorMessageOf:e=>String(e),
});
for (const scenario of ['ready','cold','exhausted','other-error','stale','held']) {
  let attempts=0,released=0; const calls=[],published=[],failures=[];
  const subject=Object.assign(new ImageCapture(), {
    mounted:true,phase:'ready',bookTurnTextureCaptureGeneration:3,bookTurnRuntimeFailed:false,
    usesBookTurnSimulation:()=>true,controlVisible:()=>false,inputPhase:'idle',
    pageTurnInputPhase(){return this.inputPhase;},readingLayout:()=>({}),bookTurnTextureSnapshotScale:()=>1,
    bookTurnCapturedIdentity:()=>'',setBookTurnCapturedIdentity:(...v)=>published.push(v),
    failBookTurnTextureCapture:(...v)=>failures.push(v),
    bookTurnSession:{uploadTexture:async(_slot,_map,_identity,admit)=>admit()},
    getUIContext:()=>({getComponentSnapshot:()=>({
      get:()=>{throw Error('image-bearing current must not bypass image readiness');},
      createFromComponent:async(content,delay,checked,opts)=>{
        calls.push({content,delay,checked});assert.equal(checked,true);assert.equal(opts.waitUntilRenderFinished,true);attempts++;
        if(scenario==='stale')subject.bookTurnTextureCaptureGeneration++;
        if(scenario==='held')subject.inputPhase='tracking';
        if(scenario==='other-error')throw Object.assign(Error('bad surface'),{code:100001});
        if(scenario==='exhausted' || scenario==='stale' || scenario==='held' || (scenario==='cold' && attempts<3))
          throw Object.assign(Error('image decode pending'),{code:160001});
        return {release(){released++;}};
      },
    })}),
  });
  const result=await subject.captureBookTurnTexture(0,{textureIdentity:'image-page',fragments:[{fileUri:'file:///cache/admitted.png',imageHeight:300}]},3);
  assert.equal(result,['ready','cold'].includes(scenario));
  assert.equal(published.length,result?1:0,'no placeholder bitmap receives a valid texture identity');
  assert.equal(released,result?1:0);
  assert.equal(failures.length,['exhausted','other-error'].includes(scenario)?1:0);
  assert.deepEqual(calls.map(c=>c.delay),scenario==='cold'?[0,16,64]:scenario==='exhausted'?[0,16,64,128]:[0]);
  assert.ok(calls.every(c=>c.content===calls[0].content),'decoder retries retain one tree');
  assert.equal(calls[0].content.disposed,0,'idle tree remains bounded and reusable until invalidation');
  if (scenario === 'ready') {
    const firstTree = calls[0].content;
    const nextPage = {textureIdentity:'new-image-page',renderRevision:2,fragments:[{fileUri:'file:///cache/other.png',imageHeight:220}]};
    assert.equal(await subject.captureBookTurnTexture(0,nextPage,3),true);
    assert.equal(calls.at(-1).content,firstTree,'successive pages update one tree instead of building a new tree');
    assert.equal(firstTree.input.page,nextPage,'updated builder argument owns the new page');
    assert.equal(subject.bookTurnTextureBuildPage,nextPage,'stable fragment provider reads the latest capture page');
  }
  subject.releaseBookTurnTextureContent();
  subject.releaseBookTurnTextureContent();
  assert.equal(calls[0].content.disposed,1,'same offscreen owner is disposed once on invalidation');
}
console.log('production image snapshot admission: cold decode, no blank publication, bounded retry, stale/held cancellation and one disposal: PASS');

const Reused = productionMotionMethods(file, ['releaseBookTurnTextureContent']);
let done;const active = new Promise(resolve => done = resolve);let disposals=0;
const reused = Object.assign(new Reused(), { bookTurnTextureContent: { dispose(){disposals++;} },
  bookTurnTextureBuildPage: {}, bookTurnTextureRefreshInFlight: active });
reused.releaseBookTurnTextureContent();reused.releaseBookTurnTextureContent();
assert.equal(disposals,0,'invalidation cannot dispose a platform-owned pending snapshot tree');
assert.equal(reused.bookTurnTextureContent,undefined);assert.equal(reused.bookTurnTextureBuildPage,undefined);
done();await active;assert.equal(disposals,1);
console.log('single offscreen snapshot tree: detach immediately, dispose once after outstanding capture: PASS');

// A brief new DOWN cancels publication, not the identity of already-painted
// pixels. Reusing them after UP must still obey the new publication gate.
for (const invalidation of ['pointer','page','exit']) {
 let reads=0,releaseCount=0,uploads=0;
 const o=Object.assign(new Capture(), { mounted:true,exitRequested:false,phase:'ready',pageTurnGeneration:7,
  bookTurnRuntimeFailed:false,bookTurnTextureCaptureGeneration:1,pageTurnCurrentSlot:'a',
  usesBookTurnSimulation:()=>true,controlVisible:()=>false,pageTurnInputPhase:()=> 'idle',
  bookTurnCapturedIdentity:()=>'',setBookTurnCapturedIdentity(){},bookTurnTextureSnapshotScale:()=>1,
  getUIContext:()=>({getComponentSnapshot:()=>({get:async()=>{reads++;return {release(){releaseCount++;}};}})}),
  failBookTurnTextureCapture(){throw Error('unexpected failure');},
  bookTurnSession:{uploadTexture:async(_s,_p,_i,admit)=>{uploads++; if(uploads===1){o.bookTurnTextureCaptureGeneration++;if(invalidation==='page')o.pageTurnGeneration++;if(invalidation==='exit')o.exitRequested=true;}return admit();}},
 });
 const page={textureIdentity:'exact-page-layout-chrome',fragments:[]};
 assert.equal(await o.captureBookTurnTexture(0,page,1),false);
 assert.equal(releaseCount,invalidation==='pointer'?0:1);
 if(invalidation==='pointer') {
  assert.equal(await o.captureBookTurnTexture(0,page,2),true);
  assert.equal(reads,1,'new pointer does not force another platform snapshot of unchanged pixels');
  assert.equal(uploads,2);assert.equal(releaseCount,1);
 }
 o.releaseBookTurnPendingSnapshot();assert.equal(releaseCount,1,'retained CPU pixels released exactly once');
}
console.log('snapshot publication interruption: pointer retains exact pixels; new page/exit drops them; UP revalidates upload: PASS');
