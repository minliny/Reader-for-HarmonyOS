import assert from 'node:assert/strict';
import { readerControlDirectorySnapshot } from '../entry/src/main/ets/features/reading/ReaderControlDirectoryModel.ts';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
const source=new URL('../entry/src/main/ets/features/reading/ReaderControlDirectoryContent.ets',import.meta.url);
const Owner=productionMotionMethods(source,['refreshData','search','sort','deferCatalogAction','scrollCatalogEdge'],{
 readerControlDirectorySnapshot,ControlDirectoryFrame:class{constructor(action){this.action=action;}},Edge:{Top:'top',Bottom:'bottom'},
});
const entries=Array.from({length:1368},(_,index)=>({index,title:`第${index+1}章`,downloadState:'cached'}));
function owner(){const callbacks=[],scrolls=[];let requests=0;const o=Object.assign(new Owner(),{
 entries:entries.slice(697,704),catalogComplete:false,catalogChapterCount:1368,catalogCurrentPosition:700,
 currentChapterIndex:700,tab:'directory',query:'',draft:'',ascending:true,sessionKey:'book:1',lifecycle:1,mounted:true,
 pendingCatalogAction:'',dataSource:{replace(rows){o.rows=rows;}},scroller:{scrollEdge(edge){scrolls.push(edge);}},
 getUIContext:()=>({postFrameCallback(frame){callbacks.push(frame.action);}}),queuePosition(){},queueLeadingCorrection(){},userScroll(){},
 onRequireCompleteCatalog(){requests++;},
 });return {o,scrolls,callbacks,requests:()=>requests,flush(){while(callbacks.length)callbacks.shift()();}};}
const h=owner();h.o.refreshData();
assert.equal(h.o.snapshot.currentPosition,'701 / 1368');assert.equal(h.o.snapshot.loading,false);assert.equal(h.o.rows.length,7);
h.o.draft='第1368章';h.o.search();assert.equal(h.requests(),1);assert.equal(h.o.query,'');assert.equal(h.o.rows.length,7);
h.o.entries=entries;h.o.catalogComplete=true;h.o.refreshData();h.flush();
assert.equal(h.o.query,'第1368章');assert.equal(h.o.rows.length,1);assert.equal(h.o.rows[0].chapter.index,1367);
assert.deepEqual(h.scrolls,['top']);
for(const action of ['top','bottom','sort']){const x=owner();x.o.refreshData();if(action==='sort')x.o.sort();else x.o.scrollCatalogEdge(action==='bottom');
 assert.equal(x.requests(),1);assert.deepEqual(x.scrolls,[]);assert.equal(x.o.ascending,true);
 x.o.entries=entries;x.o.catalogComplete=true;x.o.refreshData();x.flush();
 assert.deepEqual(x.scrolls,[action==='bottom'?'bottom':'top']);if(action==='sort'){assert.equal(x.o.rows[0].chapter.index,1367);assert.equal(x.o.rows.length,1368);}
}
const cancelled=owner();cancelled.o.draft='第1368章';cancelled.o.search();cancelled.o.entries=entries;cancelled.o.catalogComplete=true;cancelled.o.refreshData();cancelled.o.lifecycle++;cancelled.flush();assert.equal(cancelled.o.query,'');
assert.equal(readerControlDirectorySnapshot(entries.slice(697,704),'directory','',true,700,undefined,
 {complete:false,chapterCount:1368,currentPosition:-1}).currentPosition,'');
console.log('PASS production directory: immediate 7-row window, true 1368 total/global position; full search/sort/edges deferred; old lifecycle rejected');
