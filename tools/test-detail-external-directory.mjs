import { resolveEtsLoaderRoot } from './lib/tool-environment.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, stripTypeScriptTypes, registerHooks } from 'node:module';
import { fileURLToPath } from 'node:url';
registerHooks({resolve(s,c,n){try{return n(s,c);}catch(e){if(s.startsWith('.')&&!s.endsWith('.ts'))return n(s+'.ts',c);throw e;}}});
const {readingDirectoryRecovery,EMPTY_READING_DIRECTORY_RECOVERY}=await import('../entry/src/main/ets/features/reading/ReadingDirectoryRecovery.ts');
import { ProductionHost, setRuntime } from './lib/reading-entry-owner-probe.mjs';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
const file=p=>fileURLToPath(new URL(`../entry/src/main/ets/${p}`,import.meta.url));
const source=readFileSync(file('pages/Index.ets'),'utf8');
const experience=readFileSync(file('features/reading/LocalReadingExperience.ets'),'utf8');
const anchor=experience.slice(experience.indexOf('export class ReaderBookmarkAnchorRequest {'),experience.indexOf('\nclass ReaderDeferredChapterSelection'));
const Anchor=new Function(`${stripTypeScriptTypes(anchor.replace('export class','class'))}; return ReaderBookmarkAnchorRequest;`)();
const Index=productionMotionMethods(file('pages/Index.ets'),['consumeTemporaryBackBridge','isCurrentRuntime','onBackPress','openFullDirectory','closeDirectory','onDirectoryChapterSelected','onDirectoryNavigationTargetSelected','onReaderBookmarkSelected','openReading','presentPreparedReading','openReaderControlDirectory','isKnownDetailChapter','readerOwnsWindowEdges'],{LOCAL_SOURCE_ID:'local',ReaderBookmarkAnchorRequest:Anchor});
function index(sourceId='local'){
 const entries=Array.from({length:25},(_,i)=>({index:i,title:`Chapter ${i+1}`,url:`/${i}`,navigable:true,downloadState:'unknown'}));
 const host=Object.assign(new Index(),{hasVisibleImportDialog:()=>false,route:'detail',readingSessionActive:false,detailBook:{sourceId,bookId:'book',title:'Book',author:'Author'},detailToc:entries,remoteReadingSession:sourceId==='local'?undefined:{identity:{sourceId,bookId:'book'},entries},shelfOperation:{removalKey:'',busy:false,batchRemovalBusy:false},navigationGeneration:1,requestedChapterIndex:undefined,requestedBookmarkAnchor:undefined,directoryCurrentChapterIndex:-1,bookmarkAnchorRequestId:0,preparedReaderRoute:'reading',directoryReturnTarget:'detail',nextNavigationGeneration(){return ++this.navigationGeneration;},returnToReadingOrigin(){this.readingSessionActive=false;this.route='detail';},readingExitRequest:undefined});
 return host;
}
for(const sourceId of ['local','remote']){
 const host=index(sourceId);assert.equal(host.readerOwnsWindowEdges(),true,'detail floating bars and scroll share one edge owner');host.openFullDirectory();
 assert.equal(host.route,'directory');assert.equal(host.readingSessionActive,false);assert.equal(host.navigationGeneration,1,'catalog viewing retains detail admission generation');assert.equal(host.readerOwnsWindowEdges(),false,'ordinary text catalog keeps the existing single App safe-top owner');
 assert.equal(host.onBackPress(),true);assert.equal(host.route,'detail');assert.equal(host.readingSessionActive,false);assert.equal(host.navigationGeneration,1);
 host.openFullDirectory();host.onDirectoryChapterSelected(19);
 assert.equal(host.readingSessionActive,true);assert.equal(host.requestedChapterIndex,19);assert.equal(host.route,'reading','PH116 selection enters the normal reader immediately');
 host.presentPreparedReading(0);assert.equal(host.route,'reading');host.presentPreparedReading(19);assert.equal(host.route,'reading');
 host.directoryCurrentChapterIndex=19;host.openReaderControlDirectory();assert.equal(host.directoryReturnTarget,'readerControl');assert.equal(host.route,'directory');
 host.onDirectoryChapterSelected(19);assert.equal(host.route,'reading','reader current chapter is revealed without a new session');
 host.openReaderControlDirectory();host.closeDirectory();assert.equal(host.route,'reading');assert.equal(host.readingSessionActive,true);
}
// A retained reader must reveal the target immediately. No body, measurement,
// or progress callback participates in navigation to the requested chapter.
for (const sourceId of ['local', 'remote']) for (const kind of ['chapter', 'bookmark']) {
 const host=index(sourceId);
 host.detailToc=Array.from({length:500},(_,index)=>({index,title:`第 ${index+1} 章`,url:`/${index}`,navigable:true}));
 if(host.remoteReadingSession) host.remoteReadingSession.entries=host.detailToc;
 host.readingSessionActive=true;host.directoryCurrentChapterIndex=2;
 host.openReaderControlDirectory();
 if(kind==='chapter') host.onDirectoryChapterSelected(324);
 else host.onReaderBookmarkSelected('325',324,17,{sourceId,bookId:'book',chapterIndex:324,bodyVersion:'v1',processingVersion:'p1'});
 assert.equal(host.route,'reading',`${sourceId}/${kind}: chapter 325 navigation cannot await the body`);
 assert.equal(host.directoryCurrentChapterIndex,2,'navigation does not invent an admitted reading position');
 assert.equal(kind==='chapter'?host.requestedChapterIndex:host.requestedBookmarkAnchor.chapterIndex,324);
 assert.equal(host.readingSessionActive,true);
}
{
 const host=index('remote');host.detailBook.contentKind='manga';host.openFullDirectory();
 assert.equal(host.readerOwnsWindowEdges(),true,'manga external directory applies safe clearance inside its full-viewport list');
 host.closeDirectory();assert.equal(host.readerOwnsWindowEdges(),true,'the retained detail keeps its own single safe inset');
}
const proof={sourceId:'remote',bookId:'book',chapterIndex:19,bodyVersion:'body',processingVersion:'processing'};
const localProof={...proof,sourceId:'local'};
{
 const host=index('local');host.openFullDirectory();host.onDirectoryNavigationTargetSelected(19,37,localProof);
 assert.equal(host.requestedBookmarkAnchor.chapterIndex,19);
 assert.equal(host.requestedBookmarkAnchor.chapterOffset,37,'EPUB chapter-inside target retains its scalar offset');
 assert.equal(host.requestedBookmarkAnchor.positionScope,localProof,'exact target retains Core body and processing versions');
 assert.equal(host.requestedChapterIndex,undefined,'exact target must not race a chapter-start request');
 const ordinary=index('local');ordinary.openFullDirectory();ordinary.onDirectoryNavigationTargetSelected(19,0,localProof);
 assert.equal(ordinary.requestedChapterIndex,undefined,'chapter-start target also uses the scoped anchor route');
 assert.equal(ordinary.requestedBookmarkAnchor.chapterOffset,0);
 assert.equal(ordinary.requestedBookmarkAnchor.positionScope,localProof);
 const stale=index('local');stale.openFullDirectory();stale.onDirectoryNavigationTargetSelected(19,37,{...localProof,bookId:'other'});
 assert.equal(stale.requestedBookmarkAnchor,undefined,'mismatched book scope cannot jump');
 const remote=index('remote');remote.openFullDirectory();remote.onDirectoryNavigationTargetSelected(19,37,localProof);
 assert.equal(remote.requestedBookmarkAnchor,undefined,'EPUB navigation cannot be applied to a remote book');
}
{
 const host=index('remote');host.openFullDirectory();host.onReaderBookmarkSelected('mark',19,37,proof);
 assert.equal(host.readingSessionActive,true);assert.equal(host.requestedBookmarkAnchor.chapterOffset,37);assert.equal(host.requestedBookmarkAnchor.positionScope,proof);
 host.onReaderBookmarkSelected('second',20,5,{...proof,chapterIndex:20});assert.equal(host.requestedChapterIndex,undefined);
 host.presentPreparedReading(19);assert.equal(host.route,'reading');host.presentPreparedReading(20);assert.equal(host.route,'reading');
 host.readingSessionActive=false;host.route='detail';host.openReading(undefined);assert.equal(host.requestedBookmarkAnchor,undefined,'a new ordinary open cannot replay an old mark');
}
const Initial=productionMotionMethods(file('features/reading/LocalReadingExperience.ets'),['loadInitialChapter','normalizedRequestedChapter','positionContextForScope','onRequestedBookmarkAnchorChanged'],{LOCAL_READING_SOURCE_ID:'local'});
function initial(sourceId='remote'){
 const host=Object.assign(new Initial(),{sourceId,bookId:'book',sessionGateway:{remoteSession:()=>undefined},chapterSelectionToken:1,requestedChapterIndex:19,requestedBookmarkAnchor:new Anchor(1,19,37,proof),consumedBookmarkAnchorRequestId:-1,mounted:true,opens:[],failures:[],selections:[],isSelectionActive(_life,token){return this.chapterSelectionToken===token;},loadInitialToc:async()=>({entries:[{index:0},{index:19},{index:20}]}),activeGateway:()=>({loadProgress:async()=>({kind:'restored',progress:{chapterIndex:0,chapterOffset:888}})}),onDirectoryProjectionChanged(){},admitTocEntries(entries){this.tocEntries=entries;},readingTocEntries(){return this.tocEntries;},chapterWindow:{configure(){}},requireKnownChapter(index){assert.ok([0,19,20].includes(index));return index;},async openChapter(...args){await args[8];if(this.isSelectionActive(args[2],args[3]))this.opens.push(args);},fail(error){this.failures.push(error.message);},selectBookmarkAnchor(...args){this.selections.push(args);this.chapterSelectionToken++;}});
 return host;
}
for(const sourceId of ['local','remote']){
 const host=initial(sourceId);if(sourceId==='local')host.requestedBookmarkAnchor=new Anchor(1,19,37);
 await host.loadInitialChapter(1,Promise.resolve([]));assert.equal(host.opens.length,1);assert.equal(host.opens[0][0],19);assert.equal(host.opens[0][4],37);assert.equal(host.restoredProgress,undefined);
 if(sourceId==='remote')assert.deepEqual(host.opens[0][7],{bodyVersion:'body',processingVersion:'processing',anchors:[{id:'requested',offset:37}]});
 host.onRequestedBookmarkAnchorChanged();assert.equal(host.selections.length,0,'same initial request is not replayed by a late watch');
 host.requestedBookmarkAnchor=new Anchor(2,19,37,sourceId==='local'?undefined:proof);host.onRequestedBookmarkAnchorChanged();assert.equal(host.selections.length,1,'a real second click remains actionable');
}
{
 const host=initial('local');host.requestedBookmarkAnchor=new Anchor(1,19,37,localProof);
 await host.loadInitialChapter(1,Promise.resolve([]));
 assert.deepEqual(host.opens[0][7],{bodyVersion:'body',processingVersion:'processing',anchors:[{id:'requested',offset:37}]},
  'EPUB target carries its Core body and processing proof into first chapter admission');
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
const require=createRequire(import.meta.url);const sdk=resolveEtsLoaderRoot();
const syntax=require(`${sdk}/lib/validate_ui_syntax.js`);
syntax.componentCollection.customComponents.add('BookDirectoryPage');syntax.propCollection.set('BookDirectoryPage',new Set(['sourceId','bookId','bookKind','contentKind','entries','catalogMessage','chapterStartBookmarkCreationEnabled']));
syntax.componentCollection.customComponents.add('ReaderFullDirectory');syntax.propCollection.set('ReaderFullDirectory',new Set(['catalogContext','bookTitle','chapterTitle','entries','catalogMessage','directoryRecovery','currentChapterIndex','sourceId','mangaSearch','reduceMotion','offlineBookOperationActive','onSelectChapter','onSelectNavigationTarget','onSelectBookmark','bookmarkIdentity','onDownloadChapter','onDownloadBook','onClearBookOffline','onDeleteBookmarks','chapterStartBookmarkCreationEnabled','onCreateChapterStartBookmark','onSwitchSource','onExit','onReconcileBookmarks','onContinueBookmarks','onReconcileOffline','onContinueOffline']));
syntax.componentCollection.customComponents.add('LocalBookDetail');syntax.propCollection.set('LocalBookDetail',new Set(['book','toc','sourceSwitchEnabled','readingEnabled','readingBlockedReason','inBookshelf','loadingMessage','removalEnabled','removing']));
class DirectoryChild{constructor(owner,params,_storage,id){Object.assign(this,{owner,params,id});}}
const enums=Object.fromEntries(['SafeAreaType','SafeAreaEdge'].map(name=>[name,new Proxy({},{get:(_,key)=>`${name}.${String(key)}`})]));
for(const sourceId of ['local','remote']){
 const {owner,output}=createReaderBuilderProbe(source,['externalDirectory','directoryRecovery','directoryOperationPresentationId','directoryOperationBindingId'],{BookDirectoryPage:DirectoryChild,ReaderFullDirectory:DirectoryChild,readingDirectoryRecovery,ReaderRuntimeOwner:{current:()=>({supportsCoreCapability:()=>true})},...enums});
 const host=index(sourceId);host.detailBook.contentKind = sourceId === 'remote' ? 'manga' : 'text';
 Object.assign(owner,host,{settingsSnapshot:{reduceMotion:false},offlineMutationActiveKey:'',detailBookmarkIdentity:()=>({sourceId,bookId:'book'}),appThemeScheme:'day'});
 owner.onDirectoryChapterSelected=host.onDirectoryChapterSelected.bind(host);owner.onDirectoryNavigationTargetSelected=host.onDirectoryNavigationTargetSelected.bind(host);owner.closeDirectory=host.closeDirectory.bind(host);
 owner.externalDirectory();assert.equal(owner.children.size,1);const props=[...owner.children.values()][0].params;
 props.onSelectChapter(19);assert.equal(host.requestedChapterIndex,19);host.route='directory';(props.onBack ?? props.onExit)();assert.equal(host.route,'detail');
 if(sourceId==='local'){
  host.openFullDirectory();props.onSelectNavigationTarget(20,7,{...localProof,chapterIndex:20});
  assert.equal(host.requestedBookmarkAnchor.chapterOffset,7,'detail directory target uses exact-position admission');
 }
 assert.equal(props.entries,host.detailToc);assert.equal(props.sourceId,sourceId);
 if(sourceId==='remote') assert.equal(props.contentKind,'manga','detail directory preserves the admitted manga content kind');
 else { assert.equal(props.catalogContext,'detail','actual novel detail caller owns standalone browse without a second safe-top'); assert.equal(props.onSwitchSource instanceof Function,true); assert.equal(props.onDownloadBook instanceof Function,true); }
 assert.doesNotMatch(output,/new ReaderShell|new ReadingExperience/);
 assert.match(source,/if \(this\.route === 'directory' && this\.directoryReturnTarget === 'detail'\) (?:\{\s*)?this\.externalDirectory\(\)/,'detail content mounts the independent page');
 assert.match(source,/visible: this\.route === 'reading' \|\|\s*\(this\.route === 'directory' && this\.directoryReturnTarget === 'readerControl'\)/,'a preparing external selection cannot expose the reading control directory');
}
// The real retained detail observer keeps the same child ID through catalog/back.
{
 const {owner}=createReaderBuilderProbe(source,['detailContent','detailSurface','externalDirectory','detailBookKey','isCurrentRuntime','hasUnknownShelfWrite','detailReadableAdmission','detailShelfMessage','detailShelfAdmissionIdentity','isCurrentDetailShelfAdmission','isCurrentDetailPresentation','directoryRecovery','directoryOperationPresentationId','directoryOperationBindingId'],{readingDirectoryRecovery,BookDirectoryPage:DirectoryChild,ReaderFullDirectory:DirectoryChild,LocalBookDetail:DirectoryChild,ReaderRuntimeOwner:{current:()=>undefined},LOCAL_SOURCE_ID:'local',EMPTY_READABLE_ADMISSION:{adding:false,cancelling:false,message:''},...enums});
 const host=index();host.openFullDirectory();Object.assign(owner,host,{readableAdmissions:[],detailShelfAdmissionMount:1,offlineMutationActiveKey:'',remoteContentVerdict:'readable',remoteContentVerdictLabel:()=>'',appThemeScheme:'day'});
 owner.detailContent();
 const detail=[...owner.children.values()].find(child=>child.params.book);
 const directory=[...owner.children.values()].find(child=>child.params.entries);
 assert.ok(detail);assert.ok(directory);assert.notEqual(detail.id,directory.id);
 const wrapper=[...owner.nodes.values()].find(node=>node.visibility==='Visibility.Hidden');
 assert.equal(wrapper.hitTestBehavior,'HitTestMode.None');assert.equal(wrapper.enabled,false);assert.equal(wrapper.focusable,false);assert.equal(wrapper.accessibilityLevel,'no-hide-descendants');
 const original=detail;owner.route='detail';owner.replayOnly([wrapper.id,detail.id]);
 assert.equal(owner.children.get(detail.id),original,'return reveals the same native detail/scroll owner');
 assert.equal(wrapper.visibility,'Visibility.Visible');assert.equal(wrapper.enabled,true);assert.equal(wrapper.focusable,true);
 assert.equal(wrapper.hitTestBehavior,'HitTestMode.Default');
 assert.match(source,/this\.detailContent\(\);/);
}
console.log('PH119 independent catalog routing, retained detail Builder and exact initial bookmark lifecycle: PASS');

{
 const {owner}=createReaderBuilderProbe(source,['externalDirectory','directoryRecovery','directoryOperationPresentationId','directoryOperationBindingId'],{BookDirectoryPage:DirectoryChild,ReaderFullDirectory:DirectoryChild,readingDirectoryRecovery,ReaderRuntimeOwner:{current:()=>({supportsCoreCapability:()=>true})},...enums});
 const host=index('local');host.detailBook.kind='EPUB';Object.assign(owner,host);
 owner.externalDirectory();const child=[...owner.children.values()][0];
 assert.equal(child.params.bookTitle,'Book','text detail uses the complete ReaderFullDirectory surface');
 assert.equal(child.params.entries,host.detailToc);
 owner.detailBook={...host.detailBook,bookId:'plain-text.epub',title:'Renamed'};
 owner.replayOnly([child.id]);
 assert.equal(child.params.bookTitle,'Renamed','retained child receives the updated detail identity');
}

// A standalone novel directory has no mounted reader to publish its chapter.
// Execute the actual Index opener, both strict progress gateways, SDK-emitted
// Index -> ReaderFullDirectory -> FullDirectoryPanel builders and panel footer.
const fullSource=readFileSync(file('features/reading/ReaderFullDirectory.ets'),'utf8');
syntax.componentCollection.customComponents.add('FullDirectoryPanel');
syntax.propCollection.set('FullDirectoryPanel',new Set(['entries','catalogMessage','onRetryCatalog','currentChapterIndex','allowUnanchoredBrowse','chapterDownloadEnabled','mangaSearch','isTablet','panelWidthOverride','panelHeightOverride','onSelectChapter','onSelectNavigationTarget','onSelectBookmark','bookmarkIdentity','onDownloadChapter','onDeleteBookmarks','chapterStartBookmarkCreationEnabled','onCreateChapterStartBookmark','onExit']));
const Footer=productionMotionMethods(file('features/reading/FullDirectoryPanel.ets'),['currentEntry','isCurrent','currentTitle','currentPosition']);
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const projectionStart=source.indexOf("    if (this.detailBook.contentKind === 'manga') return;\n    // Text detail");
const projectionEnd=source.indexOf('\n  }\n\n  private openReaderControlDirectory',projectionStart);
assert.ok(projectionStart>0&&projectionEnd>projectionStart);
const oldSource=source.slice(0,projectionStart)+source.slice(projectionEnd);
function standalone(sourceId='local',{legacy=false,shelfIndex=19,shelfSource=sourceId,contentKind='text',emptyToc=false}={}){
 let resolve,live=true;const result=new Promise(done=>{resolve=done;});const calls=[];
 const runtime={supportsCoreCapability:()=>true,bookAcquisitions:()=>({setPreparationVisible(){}}),async request(method,params,options){
  calls.push({method,params,options});assert.equal(method,'reading.progress.get','directory viewing cannot acquire a body or save progress');
  return {data:await result};
 }};
 const {owner}=createReaderBuilderProbe(legacy?oldSource:source,['openFullDirectory','closeDirectory','getReadingEntryHost','externalDirectory','directoryRecovery','directoryOperationPresentationId','directoryOperationBindingId'],{
  BookDirectoryPage:DirectoryChild,ReaderFullDirectory:DirectoryChild,readingDirectoryRecovery,ReadingEntryHost:ProductionHost,LOCAL_SOURCE_ID:'local',
  ReaderRuntimeOwner:{current:()=>runtime},...enums});
 Object.assign(owner,index(sourceId),{mountedRuntimeOwner:runtime,shelfReceiptRetired:false,detailShelfAdmissionMount:2,directoryPresentationGeneration:1,
  settingsSnapshot:{reduceMotion:false},offlineMutationActiveKey:'',appThemeScheme:'day',loadDirectoryOperationProjections(){},isCurrentRuntime:value=>value===runtime&&live,
  shelfBooks:shelfIndex===undefined?[]:[{sourceId:shelfSource,bookId:'book',currentChapterIndex:shelfIndex,currentChapterTitle:'untrusted display alias',addedAt:1}],
  detailBookmarkIdentity:()=>({sourceId,bookId:'book'})});
 owner.detailBook.contentKind=contentKind;if(contentKind==='manga')owner.detailBook.mangaPosition={chapterIndex:2,chapterTitle:'Manga chapter',pageOrdinal:0};
 if(emptyToc)owner.detailToc=[];
 setRuntime(runtime);const entry=ProductionHost.forRuntime(runtime);
 const lease={isCurrent:()=>live&&owner.mountedRuntimeOwner===runtime,projectionAllowed:()=>false,currentDirectory:()=>owner.detailToc,
  offlineGeneration:()=>0,membership:()=>({generation:0,blocked:false,value:true}),changed(){},cacheDecision:async()=>false,notice(){},refreshShelf(){},diagnostic(){}};
 entry.bindReader(owner.detailBook,undefined,owner.detailToc,true,lease);
 return {owner,entry,lease,calls,release({found=true,index=19,source=sourceId,bookId='book'}={}){resolve({found,progressRevision:'cas-7',progress:found?{sourceId:source,bookId,chapterIndex:index,chapterOffset:37,chapterProgress:.02,updatedAt:7}:null});},retireRuntime(){live=false;}};
}
function footer(owner){
 let detail=[...owner.children.values()].find(child=>child.params.catalogContext==='detail');
 if(detail)owner.replayOnly([detail.id]);else{owner.externalDirectory();detail=[...owner.children.values()].find(child=>child.params.catalogContext==='detail');}
 assert.ok(detail,'text keeps the standalone complete directory route');
 const {owner:full}=createReaderBuilderProbe(fullSource,['directoryContent'],{FullDirectoryPanel:DirectoryChild});
 Object.assign(full,detail.params,{directoryRecovery:EMPTY_READING_DIRECTORY_RECOVERY,panelWidth:()=>364,panelLeft:()=>12,panelTop:()=>88,fullPanelHeight:()=>736,activeRecoveryHeight:()=>0,panelViewportHeight:()=>736,usesExpandedLayout:()=>false,shouldAnimatePanel:()=>false});
 full.directoryContent();const panel=[...full.children.values()][0];assert.ok(panel);assert.equal(panel.params.currentChapterIndex,owner.directoryCurrentChapterIndex,'wrapper forwards the exact Core anchor');
 const display=Object.assign(new Footer(),panel.params,{admittedEntries:panel.params.entries});
 return [display.currentTitle(),display.currentPosition()];
}
for(const sourceId of ['local','remote']){
 const f=standalone(sourceId);f.owner.openFullDirectory();
 assert.deepEqual(footer(f.owner),['Chapter 20','20 / 25'],'exact shelf progress is visible before the read settles');
 assert.equal(f.owner.route,'directory');assert.equal(f.owner.readingSessionActive,false);assert.equal(f.owner.requestedChapterIndex,undefined);
 assert.deepEqual(f.calls.map(call=>[call.method,call.params.sourceId,call.params.bookId]),[['reading.progress.get',sourceId,'book']]);
 assert.equal(f.calls[0].options.shouldCancel(),false);f.release({index:2});await tick();
 assert.deepEqual(footer(f.owner),['Chapter 3','3 / 25'],'canonical read refreshes only the directory display');
 assert.equal(f.owner.requestedChapterIndex,undefined);assert.equal(f.owner.readingSessionActive,false);assert.equal(f.calls.length,1);
 const old=standalone(sourceId,{legacy:true});old.owner.openFullDirectory();
 assert.deepEqual(footer(old.owner),['尚未开始阅读','—'],'negative control reproduces the old already-read novel footer');assert.equal(old.calls.length,0);
 const hidden=standalone(sourceId,{shelfSource:'another-source'});hidden.owner.openFullDirectory();assert.deepEqual(footer(hidden.owner),['尚未开始阅读','—']);
 hidden.release();await tick();assert.deepEqual(footer(hidden.owner),['Chapter 20','20 / 25'],'same bookId in another source cannot supply progress; canonical identity can');
 const missing=standalone(sourceId);missing.owner.openFullDirectory();missing.release({found:false});await tick();assert.deepEqual(footer(missing.owner),['尚未开始阅读','—']);
 const wrong=standalone(sourceId,{shelfIndex:undefined});wrong.owner.shelfBooks=[];wrong.owner.openFullDirectory();wrong.release({source:'another-source'});await tick();assert.deepEqual(footer(wrong.owner),['尚未开始阅读','—'],'gateway rejects mismatched Core progress identity');
 const unknown=standalone(sourceId);unknown.owner.openFullDirectory();unknown.release({index:999});await tick();assert.deepEqual(footer(unknown.owner),['尚未开始阅读','—'],'an absent chapter is never clamped to a known row');
 const delayed=standalone(sourceId,{emptyToc:true});delayed.owner.openFullDirectory();delayed.release();await tick();assert.deepEqual(footer(delayed.owner),['尚未开始阅读','—']);
 delayed.owner.detailToc=index(sourceId).detailToc;assert.deepEqual(footer(delayed.owner),['Chapter 20','20 / 25'],'late admitted TOC resolves the retained canonical index');
 for(const [name,retire] of [['close',f=>f.owner.closeDirectory()],['navigation',f=>f.owner.navigationGeneration++],['mount',f=>f.owner.detailShelfAdmissionMount++],['directory',f=>f.owner.directoryPresentationGeneration++],['owner',f=>f.owner.mountedRuntimeOwner={}],['runtime',f=>f.retireRuntime()],['reader',f=>f.owner.readingSessionActive=true],['identity',f=>f.owner.detailBook={...f.owner.detailBook,bookId:'other'}],['entry-scope',f=>f.entry.retire()],['entry-book',f=>f.entry.bindReader({...f.owner.detailBook,bookId:'other'},undefined,[],true,f.lease)]]){
  const stale=standalone(sourceId,{shelfIndex:1});stale.owner.openFullDirectory();retire(stale);assert.equal(stale.calls[0].options.shouldCancel(),true,`${sourceId}/${name}: RPC receives the presentation fence`);
  stale.release({index:19});await tick();assert.equal(stale.owner.directoryCurrentChapterIndex,1,`${sourceId}/${name}: late progress cannot publish`);
 }
}
const manga=standalone('remote',{contentKind:'manga'});manga.owner.openFullDirectory();assert.equal(manga.calls.length,0);assert.equal(manga.owner.directoryCurrentChapterIndex,2);
console.log('PASS actual standalone novel directory: exact shelf/canonical progress through both SDK builders and footer, missing/foreign/late TOC and all presentation fences; old-code negative and manga exclusion');
