import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, stripTypeScriptTypes } from 'node:module';
import { fileURLToPath } from 'node:url';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
const file=p=>fileURLToPath(new URL(`../entry/src/main/ets/${p}`,import.meta.url));
const source=readFileSync(file('pages/Index.ets'),'utf8');
const experience=readFileSync(file('features/reading/LocalReadingExperience.ets'),'utf8');
const anchor=experience.slice(experience.indexOf('export class ReaderBookmarkAnchorRequest {'),experience.indexOf('\nclass ReaderDeferredChapterSelection'));
const Anchor=new Function(`${stripTypeScriptTypes(anchor.replace('export class','class'))}; return ReaderBookmarkAnchorRequest;`)();
const Index=productionMotionMethods(file('pages/Index.ets'),['onBackPress','openFullDirectory','closeDirectory','onDirectoryChapterSelected','onReaderBookmarkSelected','openReading','presentPreparedReading','openReaderControlDirectory','isKnownDetailChapter','readerOwnsWindowEdges'],{LOCAL_SOURCE_ID:'local',ReaderBookmarkAnchorRequest:Anchor});
function index(sourceId='local'){
 const entries=Array.from({length:25},(_,i)=>({index:i,title:`Chapter ${i+1}`,url:`/${i}`,navigable:true,downloadState:'unknown'}));
 const host=Object.assign(new Index(),{route:'detail',readingSessionActive:false,detailBook:{sourceId,bookId:'book',title:'Book',author:'Author'},detailToc:entries,remoteReadingSession:sourceId==='local'?undefined:{identity:{sourceId,bookId:'book'},entries},bookshelfRemovalActiveKey:'',navigationGeneration:1,requestedChapterIndex:undefined,requestedBookmarkAnchor:undefined,directoryCurrentChapterIndex:-1,bookmarkAnchorRequestId:0,preparedReaderRoute:'reading',directoryReturnTarget:'detail',nextNavigationGeneration(){return ++this.navigationGeneration;},returnToReadingOrigin(){this.readingSessionActive=false;this.route='detail';},readingExitRequest:undefined});
 return host;
}
for(const sourceId of ['local','remote']){
 const host=index(sourceId);host.openFullDirectory();
 assert.equal(host.route,'directory');assert.equal(host.readingSessionActive,false);assert.equal(host.navigationGeneration,1,'catalog viewing retains detail admission generation');assert.equal(host.readerOwnsWindowEdges(),true);
 assert.equal(host.onBackPress(),true);assert.equal(host.route,'detail');assert.equal(host.readingSessionActive,false);assert.equal(host.navigationGeneration,1);
 host.openFullDirectory();host.onDirectoryChapterSelected(19);
 assert.equal(host.readingSessionActive,true);assert.equal(host.requestedChapterIndex,19);assert.equal(host.route,'directory','external catalog remains while exact selection prepares');
 host.presentPreparedReading(0);assert.equal(host.route,'directory');host.presentPreparedReading(19);assert.equal(host.route,'reading');
 host.directoryCurrentChapterIndex=19;host.openReaderControlDirectory();assert.equal(host.directoryReturnTarget,'readerControl');assert.equal(host.route,'directory');
 host.onDirectoryChapterSelected(19);assert.equal(host.route,'reading','reader current chapter is revealed without a new session');
 host.openReaderControlDirectory();host.closeDirectory();assert.equal(host.route,'reading');assert.equal(host.readingSessionActive,true);
}
const proof={sourceId:'remote',bookId:'book',chapterIndex:19,bodyVersion:'body',processingVersion:'processing'};
{
 const host=index('remote');host.openFullDirectory();host.onReaderBookmarkSelected('mark',19,37,proof);
 assert.equal(host.readingSessionActive,true);assert.equal(host.requestedBookmarkAnchor.chapterOffset,37);assert.equal(host.requestedBookmarkAnchor.positionScope,proof);
 host.onReaderBookmarkSelected('second',20,5,{...proof,chapterIndex:20});assert.equal(host.requestedChapterIndex,undefined);
 host.presentPreparedReading(19);assert.equal(host.route,'directory');host.presentPreparedReading(20);assert.equal(host.route,'reading');
 host.readingSessionActive=false;host.route='detail';host.openReading(undefined);assert.equal(host.requestedBookmarkAnchor,undefined,'a new ordinary open cannot replay an old mark');
}
const Initial=productionMotionMethods(file('features/reading/LocalReadingExperience.ets'),['loadInitialChapter','normalizedRequestedChapter','positionContextForScope','onRequestedBookmarkAnchorChanged'],{LOCAL_READING_SOURCE_ID:'local'});
function initial(sourceId='remote'){
 const host=Object.assign(new Initial(),{sourceId,bookId:'book',chapterSelectionToken:1,requestedChapterIndex:19,requestedBookmarkAnchor:new Anchor(1,19,37,proof),consumedBookmarkAnchorRequestId:-1,mounted:true,opens:[],failures:[],selections:[],isSelectionActive(_life,token){return this.chapterSelectionToken===token;},loadInitialToc:async()=>({entries:[{index:0},{index:19},{index:20}]}),activeGateway:()=>({loadProgress:async()=>({kind:'restored',progress:{chapterIndex:0,chapterOffset:888}})}),admitTocEntries(entries){this.tocEntries=entries;},readingTocEntries(){return this.tocEntries;},chapterWindow:{configure(){}},requireKnownChapter(index){assert.ok([0,19,20].includes(index));return index;},async openChapter(...args){this.opens.push(args);},fail(error){this.failures.push(error.message);},selectBookmarkAnchor(...args){this.selections.push(args);this.chapterSelectionToken++;}});
 return host;
}
for(const sourceId of ['local','remote']){
 const host=initial(sourceId);if(sourceId==='local')host.requestedBookmarkAnchor=new Anchor(1,19,37);
 await host.loadInitialChapter(1,Promise.resolve([]));assert.equal(host.opens.length,1);assert.equal(host.opens[0][0],19);assert.equal(host.opens[0][4],37);assert.equal(host.restoredProgress,undefined);
 if(sourceId==='remote')assert.deepEqual(host.opens[0][7],{bodyVersion:'body',processingVersion:'processing',anchors:[{id:'requested',offset:37}]});
 host.onRequestedBookmarkAnchorChanged();assert.equal(host.selections.length,0,'same initial request is not replayed by a late watch');
 host.requestedBookmarkAnchor=new Anchor(2,19,37,sourceId==='local'?undefined:proof);host.onRequestedBookmarkAnchorChanged();assert.equal(host.selections.length,1,'a real second click remains actionable');
}
for(const mutate of [h=>{h.requestedBookmarkAnchor.positionScope=undefined;},h=>{h.requestedBookmarkAnchor.positionScope={...proof,bookId:'another'};},h=>{h.requestedBookmarkAnchor.chapterIndex=20;}]){
 const host=initial();mutate(host);await host.loadInitialChapter(1,Promise.resolve([]));assert.equal(host.opens.length,0);assert.equal(host.failures.length,1);
}
{
 const host=initial('local');host.requestedBookmarkAnchor=undefined;
 await host.loadInitialChapter(1,Promise.resolve([]));assert.equal(host.opens[0][0],19);assert.equal(host.restoredProgress,undefined,'explicit chapter start cannot borrow old resume offset');
 const resumed=initial('local');resumed.requestedBookmarkAnchor=undefined;resumed.requestedChapterIndex=undefined;
 await resumed.loadInitialChapter(1,Promise.resolve([]));assert.equal(resumed.opens[0][0],0);assert.equal(resumed.restoredProgress.progress.chapterOffset,888);
}
{
 const host=initial();let release;const layout=new Promise(resolve=>{release=resolve;});const pending=host.loadInitialChapter(1,layout);await new Promise(resolve=>setImmediate(resolve));
 host.requestedBookmarkAnchor=new Anchor(2,20,5,{...proof,chapterIndex:20});host.onRequestedBookmarkAnchorChanged();release([]);await pending;
 assert.equal(host.opens.length,0,'late initial restore cannot duplicate a newer bookmark selection');assert.equal(host.selections.length,1);
}
{
 const host=index();host.openFullDirectory();host.onDirectoryChapterSelected(99);assert.equal(host.readingSessionActive,false);
 host.detailToc[19].navigable=false;host.onDirectoryChapterSelected(19);assert.equal(host.readingSessionActive,false);
 host.detailToc[19].navigable=true;host.onDirectoryChapterSelected(19);let exits=0;host.readingExitRequest=()=>{exits++;host.readingSessionActive=false;host.route='detail';};host.onBackPress();assert.equal(exits,1);assert.equal(host.route,'detail');
}
// Actual SDK-generated external Builder: no reader child may be constructed.
const require=createRequire(import.meta.url);const sdk=process.env.READER_ETS_LOADER_ROOT??'/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const syntax=require(`${sdk}/lib/validate_ui_syntax.js`);
syntax.componentCollection.customComponents.add('ReaderFullDirectory');syntax.propCollection.set('ReaderFullDirectory',new Set(['bookTitle','chapterTitle','entries','currentChapterIndex','sourceId','animateFromControl','reduceMotion','offlineBookOperationActive','chapterStartBookmarkCreationEnabled']));
class DirectoryChild{constructor(owner,params,_storage,id){Object.assign(this,{owner,params,id});}}
const enums=Object.fromEntries(['SafeAreaType','SafeAreaEdge'].map(name=>[name,new Proxy({},{get:(_,key)=>`${name}.${String(key)}`})]));
for(const sourceId of ['local','remote']){
 const {owner,output}=createReaderBuilderProbe(source,['externalDirectory'],{ReaderFullDirectory:DirectoryChild,...enums});
 const host=index(sourceId);Object.assign(owner,host,{settingsSnapshot:{reduceMotion:false},offlineMutationActiveKey:'',detailBookmarkIdentity:()=>({sourceId,bookId:'book'}),appThemeScheme:'day'});
 owner.onDirectoryChapterSelected=host.onDirectoryChapterSelected.bind(host);owner.closeDirectory=host.closeDirectory.bind(host);
 owner.externalDirectory();assert.equal(owner.children.size,1);const props=[...owner.children.values()][0].params;
 props.onSelectChapter(19);assert.equal(host.requestedChapterIndex,19);props.onExit();assert.equal(host.route,'detail');
 assert.equal(props.animateFromControl,false);assert.equal(props.entries,host.detailToc);assert.equal(props.sourceId,sourceId);assert.doesNotMatch(output,/new ReaderShell|new ReadingExperience/);
 assert.match(source,/this\.route === 'directory' && this\.directoryReturnTarget === 'detail' &&\s*this\.detailBook !== undefined\) \{\s*this\.externalDirectory\(\)/,'actual Index route mounts this Builder');
 assert.match(source,/visible: this\.route === 'reading' \|\|\s*\(this\.route === 'directory' && this\.directoryReturnTarget === 'readerControl'\)/,'a preparing external selection cannot expose the reading control directory');
}
console.log('PH84 actual external directory routing, Builder and exact initial bookmark lifecycle: PASS');
