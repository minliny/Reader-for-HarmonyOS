import assert from 'node:assert/strict';
import { readerControlDirectorySnapshot, ReaderControlDirectoryPosition } from '../entry/src/main/ets/features/reading/ReaderControlDirectoryModel.ts';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
const source=new URL('../entry/src/main/ets/features/reading/ReaderControlDirectoryContent.ets',import.meta.url);
const Owner=productionMotionMethods(source,['refreshData','search','sort','deferCatalogAction','scrollCatalogEdge','cancelPendingPlacement','userScroll'],{
 readerControlDirectorySnapshot,ControlDirectoryFrame:class{constructor(action){this.action=action;}},Edge:{Top:'top',Bottom:'bottom'},
});
const entries=Array.from({length:1368},(_,index)=>({index,title:`第${index+1}章`,downloadState:'cached'}));
function owner(){const callbacks=[],scrolls=[];let requests=0;const o=Object.assign(new Owner(),{
 entries:entries.slice(697,704),catalogComplete:false,catalogChapterCount:1368,catalogCurrentPosition:700,catalogReadableChapterCount:1368,catalogReadablePosition:700,
 currentChapterIndex:700,tab:'directory',query:'',draft:'',ascending:true,sessionKey:'book:1',lifecycle:1,mounted:true,
 navigationActive:false,navigationInteracted:false,
 pendingCatalogAction:'',dataSource:{replace(rows){o.rows=rows;}},scroller:{scrollEdge(edge){scrolls.push(edge);}},
 getUIContext:()=>({postFrameCallback(frame){callbacks.push(frame.action);}}),queuePosition(){},queueLeadingCorrection(){},placement:new ReaderControlDirectoryPosition(),
 onRequireCompleteCatalog(){requests++;},
 });return {o,scrolls,callbacks,requests:()=>requests,flush(){while(callbacks.length)callbacks.shift()();}};}
const h=owner();h.o.refreshData();
assert.equal(h.o.snapshot.currentPosition,'701 / 1368');assert.equal(h.o.snapshot.loading,false);assert.equal(h.o.rows.length,7);
assert.equal(h.o.snapshot.catalogState,'partial','a nonempty entry window is not a complete directory');
h.o.catalogLoading=true;h.o.refreshData();assert.equal(h.o.snapshot.catalogState,'loading');
h.o.catalogLoading=false;h.o.catalogLoadFailed=true;h.o.refreshData();
assert.equal(h.o.snapshot.catalogState,'failed','failed hydration must remain visible beside retained rows');
assert.equal(h.o.rows.length,7,'a failed complete-catalog read cannot clear visible neighbours');
h.o.catalogLoadFailed=false;
h.o.draft='第1368章';h.o.search();assert.equal(h.requests(),1);assert.equal(h.o.query,'');assert.equal(h.o.rows.length,7);
h.o.entries=entries;h.o.catalogComplete=true;h.o.refreshData();h.flush();
assert.equal(h.o.snapshot.catalogState,'ready');
assert.equal(h.o.query,'第1368章');assert.equal(h.o.rows.length,1);assert.equal(h.o.rows[0].chapter.index,1367);
assert.deepEqual(h.scrolls,['top']);
for(const action of ['top','bottom','sort']){const x=owner();x.o.refreshData();if(action==='sort')x.o.sort();else x.o.scrollCatalogEdge(action==='bottom');
 assert.equal(x.requests(),1);assert.deepEqual(x.scrolls,[]);assert.equal(x.o.ascending,true);
 x.o.entries=entries;x.o.catalogComplete=true;x.o.refreshData();x.flush();
 assert.deepEqual(x.scrolls,[action==='bottom'?'bottom':'top']);if(action==='sort'){assert.equal(x.o.rows[0].chapter.index,1367);assert.equal(x.o.rows.length,1368);}
 else assert.equal(x.o.navigationInteracted,true,'edge navigation runs the production user-scroll intent method');
}
const cancelled=owner();cancelled.o.draft='第1368章';cancelled.o.search();cancelled.o.entries=entries;cancelled.o.catalogComplete=true;cancelled.o.refreshData();cancelled.o.lifecycle++;cancelled.flush();assert.equal(cancelled.o.query,'');
assert.equal(readerControlDirectorySnapshot(entries.slice(697,704),'directory','',true,700,undefined,
 {complete:false,chapterCount:1368,currentPosition:-1}).currentPosition,'');
console.log('PASS production directory: immediate 7-row window, true 1368 total/global position; full search/sort/edges deferred; old lifecycle rejected');

const Reader=productionMotionMethods(new URL('../entry/src/main/ets/features/reading/LocalReadingExperience.ets',import.meta.url),
 ['hydrateEntryCatalog','admitTocEntries'],{hilog:{warn(){}}});
function hydrationOwner(){
 const requests=[],published=[];const window=entries.slice(697,704);const chapter={chapterIndex:700};
 const o=Object.assign(new Reader(),{
  mounted:true,lifecycleToken:1,sourceId:'local',bookId:'fixture',remoteCatalogAdmissionRevision:0,
  entryCatalogPending:true,entryCatalogLoading:false,entryCatalogLoadFailed:false,
  tocEntries:window,chapter,entryCatalogHydration:undefined,
  isSessionActive(token){return this.mounted&&token===this.lifecycleToken;},
  activeGateway(){return {loadToc(){return new Promise((resolve,reject)=>requests.push({resolve,reject}));}};},
  chapterWindow:{retainedChapterIndexes:()=>[700],get:()=>chapter},
  configureReadingChapterWindow(){},setCurrentReadingChapter(){},releaseUnretainedReadingImages(){},
  onDirectoryProjectionChanged(toc){published.push(toc);},prepareRemoteCatalogNearEnd(){},
  queuePageTurnPreparation(){},drainRapidPageTurn(){},resumePendingAutoPageTurn(){},
  autoPageCoordinator:{catalogLoadFailed:()=>false},
 });return {o,requests,published,window};
}
{
 const h=hydrationOwner();const first=h.o.hydrateEntryCatalog();
 assert.equal(h.o.entryCatalogLoading,true);assert.equal(h.o.entryCatalogLoadFailed,false);
 h.requests[0].reject(new Error('BUSY'));await assert.rejects(first,/BUSY/);
 assert.equal(h.o.entryCatalogPending,true);assert.equal(h.o.entryCatalogLoading,false);
 assert.equal(h.o.entryCatalogLoadFailed,true);assert.equal(h.o.tocEntries,h.window);
 const retry=h.o.hydrateEntryCatalog();assert.equal(h.o.entryCatalogLoadFailed,false);
 h.requests[1].resolve({bookId:'fixture',entries});await retry;
 assert.equal(h.o.entryCatalogPending,false);assert.equal(h.o.entryCatalogLoading,false);
 assert.equal(h.o.entryCatalogLoadFailed,false);assert.equal(h.o.tocEntries,entries);
 assert.deepEqual(h.published,[entries]);
}
{
 const h=hydrationOwner();const old=h.o.hydrateEntryCatalog();h.o.lifecycleToken++;
 h.requests[0].reject(new Error('old cancelled failure'));await assert.rejects(old);
 assert.equal(h.o.entryCatalogLoadFailed,false,'a retired catalog failure cannot mark the current reader failed');
 assert.equal(h.o.entryCatalogLoading,false);assert.equal(h.o.tocEntries,h.window);
 assert.deepEqual(h.published,[]);
}
{
 const h=hydrationOwner();const invalid=h.o.hydrateEntryCatalog();
 h.requests[0].resolve({bookId:'fixture',entries:entries.slice(0,20)});
 await assert.rejects(invalid,/CURRENT_CHAPTER_MISSING/);
 assert.equal(h.o.entryCatalogPending,true);assert.equal(h.o.entryCatalogLoadFailed,true);
 assert.equal(h.o.tocEntries,h.window,'an invalid replacement cannot erase the admitted neighbourhood');
}
console.log('PASS production reader catalog: BUSY preserves visible window and exposes failure; retry publishes full catalog; stale/invalid reads cannot replace it');
