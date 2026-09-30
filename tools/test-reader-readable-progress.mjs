import assert from 'node:assert/strict';
import {readerControlDirectorySnapshot as project} from '../entry/src/main/ets/features/reading/ReaderControlDirectoryModel.ts';
import {productionMotionMethods} from './lib/reader-motion-method-probe.mjs';
const entries=[{index:0,title:'卷',navigable:false},{index:7,title:'甲',navigable:true},{index:8,title:'禁用',navigable:false},{index:42,title:'乙',navigable:true}];
for(const ascending of [true,false]) for(const query of ['', '甲']) {
 const result=project(entries,'directory',query,ascending,7);
 assert.equal(result.currentPosition,'1 / 2');
 assert.equal(result.rows.find(r=>r.chapter.index===7).chapter.index,7);
}
assert.equal(project(entries,'directory','',true,0).currentPosition,'','historical group has no invented readable ordinal');
assert.equal(project(entries.slice(1,2),'directory','',true,7,undefined,{complete:false,chapterCount:54,currentPosition:1,readableChapterCount:53,readablePosition:0}).currentPosition,'1 / 53');
assert.equal(project(entries.slice(0,1),'directory','',true,0,undefined,{complete:false,chapterCount:54,currentPosition:0,readableChapterCount:53}).currentPosition,'');
const Full=productionMotionMethods(new URL('../entry/src/main/ets/features/reading/FullDirectoryPanel.ets',import.meta.url),['currentPosition']);
const full=Object.assign(new Full(),{admittedEntries:entries,currentEntry:()=>entries[1]});assert.equal(full.currentPosition(),'1 / 2');
full.currentEntry=()=>entries[0];assert.equal(full.currentPosition(),'');
const Panel=productionMotionMethods(new URL('../entry/src/main/ets/features/reading/ReaderControlPanel.ets',import.meta.url),['canStepChapter']);
const panel=Object.assign(new Panel(),{tocEntries:entries,currentChapterIndex:7,readableChapterPosition:0,totalChapters:2});
assert.equal(panel.canStepChapter(-1),false);assert.equal(panel.canStepChapter(1),true);
panel.currentChapterIndex=42;panel.readableChapterPosition=1;assert.equal(panel.canStepChapter(1),false);assert.equal(panel.canStepChapter(-1),true);
panel.readableChapterPosition=-1;assert.equal(panel.canStepChapter(1),false,'disabled/group tail cannot enable next');
const Reader=productionMotionMethods(new URL('../entry/src/main/ets/features/reading/LocalReadingExperience.ets',import.meta.url),['readingTocEntries','readableChapterPosition','entryChapterPosition','controlProgress','pageChromeProgress','seekControlProgress'],{READER_CONTROL_PROGRESS_MIN:0,READER_CONTROL_PROGRESS_MAX:100});
const selected=[];const reader=Object.assign(new Reader(),{tocEntries:entries,mounted:true,entryCatalogPending:false,desiredChapterProgress:.5,desiredChapterOffset:5,currentChapterIndex:()=>7,normalizedProgress:x=>x,clearTtsChapterEndTimer(){},selectChapterAnchor:(...args)=>selected.push(args),chapterWindow:{position(){throw Error('resumeOnly order must not define readable percentage');}}});
assert.equal(reader.controlProgress(),25);assert.equal(reader.pageChromeProgress(42,5,10),75);assert.equal(reader.readableChapterPosition(0),-1);
const ranks=reader.readingTocRanks;reader.controlProgress();assert.equal(reader.readingTocRanks,ranks,'reuse rank map while catalog identity unchanged');
reader.seekControlProgress(0);reader.seekControlProgress(75);reader.seekControlProgress(100);assert.deepEqual(selected.map(x=>[x[0],x[4]]),[[7,0],[42,.5],[42,1]],'slider resolves readable rank back to unchanged canonical ID');
reader.entryCatalogPending=true;reader.entryCatalogNavigation={readableChapterCount:53,current:{index:7,readablePosition:0},before:[],after:[]};reader.tocEntries=[];
assert.equal(reader.controlProgress(),.5/53*100,'bounded snapshot paints global readable percentage without full catalog');
assert.equal(reader.readableChapterPosition(0),-1);
console.log('PASS readable rank/count across Quick/Full, boundary controls, percent/slider, sparse IDs, resumeOnly and bounded entry; raw list positions unchanged');
