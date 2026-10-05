import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { MangaBookPresentation } from '../entry/src/main/ets/features/manga/MangaBookPresentation.ts';
import {ProductionHost:ReadingEntryHost,setRuntime:setEntryRuntime} from './lib/reading-entry-owner-probe.mjs';
import {localBookDetailSdk} from './lib/local-book-detail-sdk-probe.mjs';
import {EMPTY_READING_DIRECTORY_RECOVERY,readingDirectoryRecovery} from '../entry/src/main/ets/features/reading/ReadingDirectoryRecovery.ts';
const EMPTY_READABLE_ADMISSION={generation:0,adding:false,cancelling:false,confirmation:'none'};
const file=new URL('../entry/src/main/ets/pages/Index.ets',import.meta.url);
let runtime={},pending=[],writes=[],nullEntryBooks=new Set();
class Gateway {
  constructor(owner){this.owner=owner;}
  entry(sourceId,bookId,_index,current){return new Promise(resolve=>pending.push({owner:this.owner,sourceId,bookId,current,resolve,kind:'entry',entryNull:nullEntryBooks.has(bookId)}));}
  progress(sourceId,bookId,current){return new Promise(resolve=>pending.push({owner:this.owner,sourceId,bookId,current,resolve,kind:'progress'}));}
}
const Host=productionMotionMethods(file,['hydrateMangaPositions','mangaPositionProjectionCurrent','pumpMangaPositionProjections','projectMangaPosition',
  'refreshDetailMangaPosition','refreshDetailAcquisitionProjection','returnToReadingOrigin','onReaderExited','currentReaderPresentationIdentity'],{
  ReaderRuntimeOwner:{current:()=>runtime},MangaSessionGateway:Gateway,MangaBookPresentation,
  AppStorage:{setOrCreate:(_key,value)=>writes.push(value)},LOCAL_SOURCE_ID:'local',
  ReadingEntryHost,EMPTY_READABLE_ADMISSION,hilog:{warn(){}},DOMAIN:0,
  copyRemoteReadingSession:session=>({...session}) });
const books=Array.from({length:180},(_,i)=>({sourceId:'source',bookId:`book-${i}`,contentKind:'manga',title:`Book ${i}`,author:'',addedAt:1}));
const tick=async()=>{for(let i=0;i<20;i++)await Promise.resolve();};
const fixture=()=>{
  runtime={};pending=[];writes=[];nullEntryBooks=new Set();
  return Object.assign(new Host(),{route:'bookshelf',readingSessionActive:false,sourceSwitchVisible:false,
    mountedRuntimeOwner:runtime,shelfReceiptRetired:false,readingReadyGeneration:0,bindReadingEntryReader(){},
    detailShelfAdmissionMount:1,readingEntryScopeId:-1,readableAdmissions:[],shelfOperation:{generation:0,busy:false,removalKey:''},
    shelfBooks:books,navigationGeneration:1,bookshelfLoadGeneration:1,detailBook:undefined,
    mangaProjectionSignature:'',mangaProjectionGeneration:0,mangaProjectionQueue:[],mangaProjectionWorkers:0,
    readingOriginRoute:'detail',nextNavigationGeneration(){return ++this.navigationGeneration;},
    refreshDetailAcquisitionProjection:async()=>{},refreshBookshelf(){this.shelfRefreshes=(this.shelfRefreshes??0)+1;}});
};
function entry(request,{revision=3,pageOrdinal=7,noProgress=false,epoch=1}={}) {
  const chapterIdentity={sourceId:request.sourceId,bookId:request.bookId,chapterId:'chapter-4'};
  const location=noProgress?null:{kind:'manga',chapter:chapterIdentity,manifestVersion:'m1',pageId:`page-${pageOrdinal}`,pageOrdinalFallback:pageOrdinal,x:0,y:0,progressRevision:revision};
  return {chapter:{chapterIndex:4,chapterTitle:'来源原始卷名',totalPages:24,manifest:{chapter:chapterIdentity,manifestVersion:'m1',pages:[{pageId:`page-${pageOrdinal}`,ordinal:pageOrdinal}]}},
    progress:{token:{epoch,revision},location},targetOrdinal:pageOrdinal};
}
async function drain(){
  let safety=0;
  while(pending.length&&safety++<300){const next=pending.shift();next.resolve(next.kind==='entry' ? (next.entryNull ? null : entry(next)) : entry(next).progress);await tick();}
  assert.ok(safety<300,'bounded queue terminates');
}
{
  const host=fixture();host.hydrateMangaPositions(books.slice(0,30));
  assert.equal(pending.length,2);assert.equal(host.mangaProjectionWorkers,2);assert.equal(host.mangaProjectionQueue.length,22,'one batch retains only the latest 24 visible candidates');
  host.hydrateMangaPositions(books.slice(0,30));assert.equal(pending.length,2,'identical visible callback does not fetch the same batch again');
  const old=pending.splice(0);host.hydrateMangaPositions(books.slice(30,70));
  assert.equal(host.mangaProjectionWorkers,2);assert.equal(pending.length,0,'latest batch waits for the global worker budget');assert.equal(host.mangaProjectionQueue.length,24);
  old.forEach(request=>request.resolve(entry(request)));await tick();
  assert.equal(MangaBookPresentation.get('source','book-0'),undefined,'canceled old entry cannot publish');
  assert.equal(pending.length,2,'old completion pumps the latest queue without a skipped-key gap');
  await drain();assert.equal(host.mangaProjectionWorkers,0);assert.equal(host.mangaProjectionQueue.length,0);
  assert.equal(MangaBookPresentation.get('source','book-30').pageOrdinal,7);
}
{
  const host=fixture();host.hydrateMangaPositions([books[0]]);const old=pending.shift();
  host.route='reading';host.readingSessionActive=true;host.navigationGeneration++;
  old.resolve(entry(old));await tick();assert.equal(MangaBookPresentation.get('source','book-0'),undefined,'reader navigation revokes the old shelf projection');
  assert.equal(host.mangaProjectionWorkers,0);
}
{
  const host=fixture();host.route='detail';host.detailBook={...books[0]};host.hydrateMangaPositions([books[0]]);const old=pending.shift();
  host.detailBook={...books[0],sourceId:'source-b'};host.hydrateMangaPositions([{...books[0],sourceId:'source-b'}]);
  old.resolve(entry(old));await tick();assert.equal(MangaBookPresentation.get('source','book-0'),undefined,'equal bookId under a different source does not receive the old detail');
  await drain();assert.equal(host.detailBook.mangaPosition.pageOrdinal,7);
}
{
  // The reader already published CAS-confirmed chapter 02 before ordinary Back.
  // Re-reading the same entry does not advance the shared revision; the retained
  // detail snapshot still must receive the new chapter and page count.
  for (const bookInfo of [false,true]) {
    const host=fixture();host.route='detail';host.detailBook={...books[0],sourceName:'腾讯漫画',intro:'保留简介'};
    host.hydrateMangaPositions([books[0]]);
    const first=pending.shift(),initial=entry(first,{pageOrdinal:1});
    initial.chapter.chapterTitle='01';initial.chapter.totalPages=36;first.resolve(initial);await tick();
    const old=host.detailBook.mangaPosition;
    assert.equal(old.chapterTitle,'01');assert.equal(old.totalPages,36);
    host.route='reading';host.readingSessionActive=true;
    const next=entry(books[0],{revision:4,pageOrdinal:1});
    next.progress.location.chapter.chapterId='chapter-5';
    next.chapter.chapterIndex=5;next.chapter.chapterTitle='02';next.chapter.totalPages=24;
    MangaBookPresentation.admitEntry('source','book-0',next);
    const before=MangaBookPresentation.revision;
    assert.notEqual(MangaBookPresentation.get('source','book-0'),old);
    if(bookInfo)host.bookInfoAfterReaderExit='source\u0000book-0';
    host.onReaderExited(host.currentReaderPresentationIdentity());
    assert.equal(host.route,'detail');assert.equal(host.readingSessionActive,false);
    assert.equal(host.detailBook.mangaPosition.chapterTitle,'02','both ordinary and book-info exits refresh the retained detail immediately');
    assert.equal(host.detailBook.mangaPosition.pageOrdinal,1);assert.equal(host.detailBook.mangaPosition.totalPages,24);
    assert.equal(host.detailBook.sourceName,'腾讯漫画');assert.equal(host.detailBook.intro,'保留简介');
    const pendingEntry=pending.shift();pendingEntry.resolve(next);await tick();
    assert.equal(MangaBookPresentation.revision,before,'same Core facts keep the shared row revision stable');
    assert.equal(host.detailBook.mangaPosition,MangaBookPresentation.get('source','book-0'));
    // A still-mounted old snapshot must also refresh on unchanged entry facts.
    host.detailBook={...host.detailBook,mangaPosition:old};host.bookshelfLoadGeneration++;
    host.hydrateMangaPositions([books[0]]);
    host.detailBook={...host.detailBook,mangaPosition:old};
    pending.shift().resolve(next);await tick();
    assert.equal(host.detailBook.mangaPosition.chapterTitle,'02','entry projection does not depend on a global revision change');
  }
}
{
  const host=fixture();host.route='detail';host.detailBook={...books[0]};host.hydrateMangaPositions([books[0]]);await drain();
  const before=MangaBookPresentation.revision,displayWrites=writes.length;
  host.bookshelfLoadGeneration++;host.hydrateMangaPositions([books[0]]);await drain();
  assert.equal(MangaBookPresentation.revision,before,'unchanged admitted facts do not invalidate rows');assert.equal(writes.length,displayWrites);
  host.bookshelfLoadGeneration++;host.hydrateMangaPositions([books[0]]);const cleared=pending.shift();cleared.resolve(entry(cleared,{noProgress:true,revision:4}));await tick();
  assert.equal(MangaBookPresentation.get('source','book-0'),undefined);assert.equal(host.detailBook.mangaPosition,undefined,'Core-confirmed absent progress clears the actual mounted detail projection');
  // An obsolete response is valid wire data but cannot resurrect a cleared location.
  assert.equal(MangaBookPresentation.admitEntry('source','book-0',entry(cleared,{revision:3})),false);
}
{
  const host=fixture();host.hydrateMangaPositions([books[0]]);const old=pending.shift();
  runtime={};host.hydrateMangaPositions([books[1]]);old.resolve(entry(old));await tick();
  assert.equal(MangaBookPresentation.get('source','book-0'),undefined,'new Runtime owner cannot borrow or revive old display facts');await drain();
  // Business retention prunes known facts to the admitted shelf window plus current detail.
  host.shelfBooks=[books[1]];host.hydrateMangaPositions([books[1]]);assert.equal(MangaBookPresentation.get('source','book-30'),undefined);
}
{
  // The global card can be outside a filtered/paged shelf, even on a cold home
  // without a detail. Repeated visible callbacks must not evict its known facts.
  for(const reason of ['filtered','paged']) {
    const host=fixture();host.shelfBooks=[books[1]];host.continueReading=books[0];
    host.shelfContentFilter=reason==='filtered'?'text':'all';host.shelfWindowOffset=reason==='paged'?48:0;
    host.hydrateMangaPositions([books[0]]);
    const next=pending.shift();next.resolve(entry(next,{pageOrdinal:2}));await tick();
    const known=MangaBookPresentation.get('source','book-0');
    assert.equal(known.pageOrdinal,2);
    host.hydrateMangaPositions([books[0]]);
    assert.equal(MangaBookPresentation.get('source','book-0'),known,`${reason}: unchanged visible card retains its confirmed position`);
    assert.equal(pending.length,0,'retention does not bypass the existing batch deduplication');
    host.hydrateMangaPositions([]);
    assert.equal(MangaBookPresentation.get('source','book-0'),known,'an offscreen card retains facts without acquiring resources');
    assert.equal(pending.length,0,'adding a retained identity never adds a request candidate');
    host.continueReading=undefined;host.hydrateMangaPositions([]);
    assert.equal(MangaBookPresentation.get('source','book-0'),undefined,'removed global card outside shelf/detail is reclaimed');
  }
  {
    const host=fixture();host.shelfBooks=[books[1]];host.continueReading=books[0];
    host.hydrateMangaPositions([books[0]]);const next=pending.shift();next.resolve(entry(next));await tick();
    const other={...books[0],sourceId:'other-source'};
    MangaBookPresentation.admitEntry(other.sourceId,other.bookId,entry(other));
    host.continueReading=other;
    host.hydrateMangaPositions([]);
    assert.equal(MangaBookPresentation.get('source','book-0'),undefined,'equal bookId on another source cannot retain the old manga identity');
    assert.equal(MangaBookPresentation.get('other-source','book-0').pageOrdinal,7);
    host.continueReading={...other,contentKind:'text'};host.hydrateMangaPositions([]);
    assert.equal(MangaBookPresentation.get('other-source','book-0'),undefined,'a novel card cannot retain manga display facts');
    assert.equal(pending.length,0);
  }
  {
    const host=fixture();host.shelfBooks=[books[1]];host.continueReading=books[0];
    host.hydrateMangaPositions([books[0]]);const first=pending.shift();first.resolve(entry(first));await tick();
    assert.notEqual(MangaBookPresentation.get('source','book-0'),undefined);
    host.bookshelfLoadGeneration++;host.hydrateMangaPositions([books[0]]);const old=pending.shift();
    runtime={};host.hydrateMangaPositions([]);old.resolve(entry(old));await tick();
    assert.equal(MangaBookPresentation.get('source','book-0'),undefined,'new Runtime owner cannot retain or revive the old card position');
    assert.equal(host.mangaProjectionWorkers,0);assert.equal(pending.length,0);
  }
}
{
  const host=fixture(); nullEntryBooks.add('book-0'); host.hydrateMangaPositions([books[0]]);
  const first=pending.shift(); first.resolve(null); await tick();
  assert.equal(pending.length,1,'missing prepared entry falls back to the existing Core progress read');
  const fallback=pending.shift(); host.sourceSwitchVisible=true;
  fallback.resolve(entry(fallback).progress); await tick();
  assert.equal(MangaBookPresentation.get('source','book-0'),undefined,
    'a source switch cancels a pending fallback progress projection before it reaches the shelf');
  assert.equal(host.mangaProjectionWorkers,0);
}
{
  const host=fixture(); host.sourceSwitchVisible=true; host.hydrateMangaPositions([books[0]]);
  assert.equal(pending.length,0,'source-switch presentation owns the window and does not start shelf manga hydration');
}
{
  // Both requests belong to the same mounted detail. A late metadata result
  // must preserve the newer confirmed entry facts, including explicit clearing.
  const metadataFixture=()=>{
    const host=fixture();
    let resolveMetadata;
    runtime={bookAcquisitions:()=>({readingProjectionRevision:()=>7,setPreparationVisible(){}}),
      request:async(method,params,options)=>{
        assert.equal(method,'search-book.get');
        assert.deepEqual(params,{origin:'source',bookUrl:'book-0'});assert.equal(options.canDispatch(),true);
        return await new Promise(resolve=>{resolveMetadata=resolve;});
      }};
    setEntryRuntime(runtime);
    Object.assign(host,{route:'detail',detailBook:{...books[0],sourceName:'腾讯漫画',intro:'保留简介'},
      mountedRuntimeOwner:runtime,readingEntryScopeId:-1,detailInBookshelf:true,
      remoteSessionGeneration:1,candidateAdmissionGeneration:-1,candidateAdmissionFailedGeneration:-1,
      bookProjectionLoading:false,bookProjectionAgain:false,remoteContentVerdict:'readable',
      remoteReadingSession:{contentKind:'manga',identity:{sourceId:'source',bookId:'book-0'},book:{title:'Book 0',author:''},
        entries:[{index:4,title:'01',url:'/4',variables:[]}],continuationVariables:[],sourceVersion:'v1',catalogVersion:'c1',contextVersion:'x1'}});
    delete host.refreshDetailAcquisitionProjection;
    delete host.bindReadingEntryReader;
    return {host,finish:()=>{assert.equal(typeof resolveMetadata,'function','actual owner dispatched cached metadata IO');
      resolveMetadata({data:{book:{origin:'source',bookUrl:'book-0',name:'已更新标题',acquisition:{
      sourceVersion:'v1',catalogVersion:'c1',contextVersion:'x1',schemaVersion:2,verificationCurrent:true}}}});}};
  };
  for(const mode of ['cold','updated','cleared']) {
    const {host,finish}=metadataFixture();
    MangaBookPresentation.useOwner(runtime);
    if(mode!=='cold') MangaBookPresentation.admitEntry('source','book-0',entry(books[0],{revision:3,pageOrdinal:0}));
    host.hydrateMangaPositions([books[0]]);
    const metadata=host.refreshDetailAcquisitionProjection();
    const next=entry(books[0],{revision:4,pageOrdinal:1,noProgress:mode==='cleared'});
    next.chapter.chapterTitle='02';next.chapter.totalPages=24;next.chapter.chapterIndex=5;
    if(next.progress.location!==null) {
      next.progress.location.chapter.chapterId='chapter-5';
      next.chapter.manifest.chapter.chapterId='chapter-5';
    }
    pending.shift().resolve(next);await tick();
    const confirmed=MangaBookPresentation.get('source','book-0');
    assert.equal(host.detailBook.mangaPosition,confirmed);
    if(mode==='cleared')assert.equal(confirmed,undefined);else assert.equal(confirmed.pageOrdinal,1);
    finish();await metadata;
    assert.equal(host.detailBook.mangaPosition,confirmed,`${mode}: late metadata cannot overwrite newer entry facts`);
    assert.equal(host.detailBook.title,'已更新标题');assert.equal(host.detailBook.intro,'保留简介');
    assert.equal(host.getReadingEntryHost().snapshot().book,host.detailBook);
    assert.equal(host.remoteReadingSession.book.title,'已更新标题');
    assert.equal(host.detailBook.contentKind,'manga','cache metadata preserves the admitted manga type');
  }
  for(const revoke of ['source','route','navigation','reading','unset','replacement']) {
    const {host,finish}=metadataFixture();
    const metadata=host.refreshDetailAcquisitionProjection();
    if(revoke==='source')host.detailBook={...host.detailBook,sourceId:'other-source'};
    else if(revoke==='route')host.route='bookshelf';
    else if(revoke==='navigation')host.navigationGeneration++;
    else if(revoke==='reading')host.readingSessionActive=true;
    else {runtime=revoke==='unset'?undefined:{};setEntryRuntime(runtime);}
    const retained=host.detailBook;
    finish();await metadata;
    assert.equal(host.detailBook,retained,`${revoke}: revoked metadata cannot replace the current detail`);
    assert.notEqual(host.detailBook.title,'已更新标题');
  }
  {
    const {host,finish}=metadataFixture();
    host.detailBook={...host.detailBook,contentKind:'text',mangaPosition:undefined};
    host.remoteReadingSession={...host.remoteReadingSession,contentKind:'text'};
    const metadata=host.refreshDetailAcquisitionProjection();finish();await metadata;
    assert.equal(host.detailBook.contentKind,'text','metadata cannot re-admit a novel as manga');
    assert.equal(host.detailBook.mangaPosition,undefined,'novel metadata does not fabricate manga position');
  }
}
{
  // Real installed SDK closures pass the replaced snapshot into the retained
  // detail and external catalog, then render the existing detail facts Builder.
  const require=createRequire(import.meta.url);
  const sdk=process.env.READER_ETS_LOADER_ROOT??'/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
  const syntax=require(`${sdk}/lib/validate_ui_syntax.js`);
  const ts=require(`${sdk}/node_modules/typescript`);
  const options=require(`${sdk}/lib/ets_checker.js`).compilerOptions;
  const detailFile=new URL('../entry/src/main/ets/features/bookshelf/LocalBookDetail.ets',import.meta.url);
  const detailSource=readFileSync(detailFile,'utf8');
  const directorySource=readFileSync(new URL('../entry/src/main/ets/features/bookshelf/BookDirectoryPage.ets',import.meta.url),'utf8');
  for(const [name,source] of [['LocalBookDetail',detailSource],['BookDirectoryPage',directorySource]]) {
    syntax.componentCollection.customComponents.add(name);
    // Match the installed frontend's decorator prepass. @Watch between @Prop
    // and a field name must not erase that field from retained-child updates.
    const tree=ts.createSourceFile(`/tmp/${name}PositionHydration.ets`,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,options);
    assert.deepEqual(tree.parseDiagnostics,[]);
    const component=tree.statements.find(node=>node.name?.getText(tree)===name);
    assert.ok(component);
    const props=component.members.filter(ts.isPropertyDeclaration).filter(member=>
      ts.getAllDecorators(member).some(decorator=>
        (ts.isCallExpression(decorator.expression)?decorator.expression.expression:decorator.expression).getText(tree)==='Prop'));
    syntax.propCollection.set(name,new Set(props.map(member=>member.name.getText(tree))));
  }
  assert.ok(syntax.propCollection.get('LocalBookDetail').has('book'),'actual @Prop @Watch book is registered');
  assert.ok(syntax.propCollection.get('LocalBookDetail').has('toc'),'actual @Prop @Watch toc is registered');
  class Child {constructor(owner,params,_storage,id){Object.assign(this,{owner,params,id});}}
  const f=fixture();f.route='detail';f.detailBook={...books[0],sourceName:'腾讯漫画'};
  runtime.supportsCoreCapability=capability=>{assert.equal(capability,'manga.offline.v1');return false;};
  f.hydrateMangaPositions([books[0]]);
  const first=pending.shift(),initial=entry(first,{pageOrdinal:1});
  initial.chapter.chapterTitle='01';initial.chapter.totalPages=36;first.resolve(initial);await tick();
  const {owner,output}=createReaderBuilderProbe(readFileSync(file,'utf8'),['detailContent','detailSurface','externalDirectory','detailBookKey',
    'hydrateMangaPositions','mangaPositionProjectionCurrent','pumpMangaPositionProjections','projectMangaPosition',
    'refreshDetailMangaPosition','returnToReadingOrigin','onReaderExited','currentReaderPresentationIdentity','directoryRecovery'],{
      LocalBookDetail:Child,BookDirectoryPage:Child,LOCAL_SOURCE_ID:'local',MangaBookPresentation,
      EMPTY_READABLE_ADMISSION,EMPTY_READING_DIRECTORY_RECOVERY,readingDirectoryRecovery,
      ReaderRuntimeOwner:{current:()=>runtime},MangaSessionGateway:Gateway,
      AppStorage:{setOrCreate:(_key,value)=>writes.push(value)},
    },{childSources:{LocalBookDetail:detailSource,BookDirectoryPage:directorySource}});
  const emitted=ts.createSourceFile('/tmp/IndexPositionHydrationEmission.ts',output,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS,options);
  const updatePayloads=[];
  const inspect=node=>{
    if(ts.isCallExpression(node)&&ts.isPropertyAccessExpression(node.expression)&&
      node.expression.name.getText(emitted)==='updateStateVarsOfChildByElmtId'&&
      ts.isObjectLiteralExpression(node.arguments[1]))updatePayloads.push(node.arguments[1]);
    ts.forEachChild(node,inspect);
  };
  inspect(emitted);
  const detailUpdate=updatePayloads.find(payload=>payload.properties.some(prop=>prop.name?.getText(emitted)==='book'));
  assert.ok(detailUpdate,'the real SDK emits retained detail book updates');
  assert.equal(detailUpdate.properties.find(prop=>prop.name?.getText(emitted)==='book').initializer.getText(emitted),'this.detailBook');
  assert.equal(detailUpdate.properties.find(prop=>prop.name?.getText(emitted)==='toc').initializer.getText(emitted),'this.detailToc');
  Object.assign(owner,f,{route:'directory',directoryReturnTarget:'detail',bookshelfRemovalActiveKey:'',
    bookshelfAdditionActiveKey:'',bookshelfAdditionCancellingKey:'',bookshelfAdditionErrorKey:'',offlineMutationActiveKey:'',
    detailToc:[{index:4,title:'01'},{index:5,title:'02'}],
    detailInBookshelf:true,pendingSourceSwitch:undefined,offlineOperationActive:false,
    hasUnknownShelfWrite:()=>false,directoryOperationPresentationId:()=>'',
    detailReadableAdmission:()=>EMPTY_READABLE_ADMISSION,
    detailShelfAdmissionIdentity:()=>JSON.stringify([owner.detailShelfAdmissionMount,owner.navigationGeneration,owner.detailBook.sourceId,owner.detailBook.bookId]),
    remoteContentVerdict:'readable',remoteContentVerdictLabel:()=>'',appThemeScheme:'day'});
  owner.detailContent();
  const detail=[...owner.children.values()].find(child=>child.params.book);
  const directory=[...owner.children.values()].find(child=>child.params.entries);
  assert.ok(detail);assert.ok(directory);
  const {owner:facts}=localBookDetailSdk({}, {initialParams:detail.params});
  Object.assign(facts,{book:detail.params.book,appThemeScheme:'day'});facts.readingFacts();
  const updated=entry(books[0],{revision:4,pageOrdinal:1});
  updated.progress.location.chapter.chapterId='chapter-5';
  updated.chapter.chapterIndex=5;updated.chapter.chapterTitle='02';updated.chapter.totalPages=24;
  MangaBookPresentation.admitEntry('source','book-0',updated);
  owner.route='reading';owner.readingSessionActive=true;owner.onReaderExited(owner.currentReaderPresentationIdentity());
  owner.replayOnly([detail.id,directory.id]);
  assert.equal(owner.children.get(detail.id),detail,'confirmed return retains the actual detail child');
  assert.equal(detail.params.book.mangaPosition.chapterTitle,'02');
  assert.equal(directory.params.currentChapterIndex,5,'full catalog receives the saved chapter highlight');
  assert.equal(directory.params.currentPageOrdinal,1);assert.equal(directory.params.currentPageTotal,24);
  facts.book=detail.params.book;facts.replay();
  const rendered=[...facts.nodes.values()].filter(node=>node.type==='Text').map(node=>node.create);
  assert.ok(rendered.includes('02'));assert.ok(rendered.includes('2 / 24 页'),'existing reading facts render new page count');
  const Detail=productionMotionMethods(detailFile,['isCurrentChapter']);
  const mounted=Object.assign(new Detail(),{book:detail.params.book});
  assert.equal(mounted.isCurrentChapter({index:4}),false);assert.equal(mounted.isCurrentChapter({index:5}),true);
  pending.shift().resolve(updated);await tick();
}
console.log('PASS actual Index manga position projection: bounded queue, route/source/owner fencing, ordinary/Info return, unchanged revision detail refresh, clearing, concurrent metadata/hydration, filtered/paged global card retention; real SDK retained detail/catalog props and reading facts/highlight');
