import { resolveEtsLoaderRoot } from './lib/tool-environment.mjs';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {createReaderBuilderProbe} from './lib/reader-control-builder-probe.mjs';
import {boundedSurfaceSdk,boundedMembers} from './lib/bounded-surface-sdk-probe.mjs';
import {admitBookshelfSdkCarrier,mountBookshelfSceneProbe} from './lib/bookshelf-projection-owner-probe.mjs';
import {productionMotionMethods} from './lib/reader-motion-method-probe.mjs';
import {pureModuleProbe} from './lib/ets-pure-module-probe.mjs';
import {ReaderNavigation} from '../entry/src/main/ets/app/navigation/ReaderNavigation.ts';
import {readerAppColor} from '../entry/src/main/ets/ui/foundation/ReaderThemeRegistry.ts';
import * as metricsApi from '../entry/src/main/ets/ui/foundation/ReaderWindowMetrics.ts';
import * as geometryApi from '../entry/src/main/ets/ui/layout/SurfaceHorizontalGeometry.ts';
import { ShelfBookPresentation } from '../entry/src/main/ets/features/bookshelf/presentation/ShelfBookPresentation.ts';
import {READER_REDUCED_FADE_MS, READER_SHEET_OPEN_MS, READER_SHEET_CLOSE_MS,
  READER_SHEET_SCRIM_MS} from '../entry/src/main/ets/ui/foundation/ProductMotionTiming.ts';
const source=p=>readFileSync(new URL('../entry/src/main/ets/'+p,import.meta.url),'utf8');
const sdk=resolveEtsLoaderRoot();
const builders=createRequire(import.meta.url)(sdk+'/lib/component_map.js').CUSTOM_BUILDER_METHOD;
for(const match of source('features/bookshelf/ui/BookshelfPage.ets').matchAll(/@Builder\s+(?:private\s+)?(\w+)\(/g))builders.add(match[1]);
const pageSource=source('features/bookshelf/ui/BookshelfPage.ets');
const {readerActionIcon}=pureModuleProbe(source('ui/foundation/ReaderActionIconResources.ets'),
  'ReaderActionIconResources.ets',{$r:value=>value},['readerActionIcon']);
const names=['presentBookActionSheet','isCurrentBookActionSheet','dismissBookActionSheet','performBookAction','finishBookActionSheet',
  'claimBookActionChrome','bookActionSheetSpec','onBooksChanged','aboutToDisappear','resetShelfPress','shelfPressKey','shelfPressPointer',
  'cancelBookActionFocus','bookActionFocusRevision','bookActionFocusKey',
  'currentVisibleBook','projectedBooks','isShelfPresentationCurrent'];
const book=(sourceId,bookId)=>({sourceId,bookId,title:bookId,author:'author',kind:'novel',currentChapterTitle:'chapter'});
const A=book('a','same'),B=book('b','same');
function fixture(definition=pageSource,{width=390,left=0,right=0,reduceMotion=false}={}){
  const metrics=new metricsApi.ReaderWindowMetricsSnapshot(new metricsApi.ReaderRectVp(0,0,width,844),undefined,new metricsApi.ReaderInsetsVp(left,0,right,16));
  const p=boundedSurfaceSdk();
  p.hooks.allowEmptyBranchAdmission=true;
  p.hooks.allowEmptyBranchRemoval=true;
  p.deps.readerActionIcon=readerActionIcon;
  p.hooks.childSources.ReaderSheetActionList=source('features/bookshelf/ui/ReaderSheetActionList.ets');
  p.deps.ReaderSheetActionList=createReaderBuilderProbe(p.hooks.childSources.ReaderSheetActionList,boundedMembers(p.hooks.childSources.ReaderSheetActionList),p.deps,p.hooks).Component;
  const leaf=source('features/bookshelf/ui/BookshelfBookActionSheet.ets');p.hooks.childSources.BookshelfBookActionSheet=leaf;
  p.deps.BookshelfBookActionSheet=createReaderBuilderProbe(leaf,boundedMembers(leaf),p.deps,p.hooks).Component;
  const hostSource=source('ui/surfaces/ReaderBottomSheet.ets');
  p.hooks.childSources.ReaderBottomSheet=hostSource;
  const transition=(type)=>({animation:({duration})=>({type,duration})});
  const hostDeps={...p.deps,...metricsApi,readerWindowMetrics:()=>metrics,
    ModalTransition:{NONE:'none'},TransitionEdge:{BOTTOM:'bottom'},
    TransitionEffect:{OPACITY:transition('opacity'),move:edge=>transition(edge),asymmetric:(enter,exit)=>({enter,exit})},
    readerMotionReducedFadeParam:()=>({duration:READER_REDUCED_FADE_MS}),
    readerMotionAnimateParam:id=>({duration:{'app.sheet.open':READER_SHEET_OPEN_MS,'app.sheet.close':READER_SHEET_CLOSE_MS,
      'app.sheet.scrim':READER_SHEET_SCRIM_MS}[id]}),
  };
  p.deps.ReaderBottomSheet=createReaderBuilderProbe(hostSource,boundedMembers(hostSource),hostDeps,p.hooks).Component;
  const probe=createReaderBuilderProbe(definition,['books','navigationGeneration','reduceMotion','actionBook','actionSheetId','actionSheetRevision','actionSheetNavigation',
    'actionSheetChromeId','bookActionSheetVisible','actionSheetFocusTarget','pendingBookAction','mounted','appThemeScheme',...names,
    'readerWindowMetricsRevision','paneWidth','mainViewportRevision','bookActionWidth','resolveContentFrame','effectiveViewportWidth',
    'onShelfPresentationChanged','bookshelfTabContent','bookActionSheetHost','bookActionSheetPresentation'],
    {...p.deps,...metricsApi,...geometryApi,readerAppColor,ShelfBookPresentation,readerMainViewport:()=>({width}),
      ReaderWindowCoordinator:{metrics:()=>metrics,requestAppChrome() {}}},
    {...p.hooks,initialParams:{books:[A,B],navigationGeneration:7,reduceMotion}});
  const {owner}=probe;
  assert.match(probe.output,/bookActionSheetHost[^\n]*ObservedObject\.GetRawObject\(this\.actionBook\)/,'actual SDK unwraps the State value at the Builder call');
  const calls=[];Object.assign(owner,{mounted:true,isCurrentShelfInput:()=>true,appThemeScheme:'day',
    readerWindowMetricsRevision:0,paneWidth:0,
    viewModePending:()=>false,shelfPane(){},numericAreaLength:Number,isCurrentChromeHost:()=>false,
    shelfContentWidth:()=>assert.fail('book actions must not use the shelf cover frame'),
    saveShelfViewport(){},resetViewSwitchMotion(){},queueShelfProjection(){},publishVisibleReadingBooks(){},viewState:{},projectionGeneration:0,viewportRestoreGeneration:0,viewModeRevision:0,
    publishContinueCardRect(){},scheduleReturnMotionOrigin(){},scheduleContinueCardMeasurement(){},transientFeedback:{reset(){}},
    onBookMultiSelectRequested:book=>calls.push(['multi',book]),onBookInfoRequested:book=>calls.push(['info',book]),onBookGroupRequested:book=>calls.push(['group',book]),onBookRemoveRequested:book=>calls.push(['remove',book]),
  });
  owner.bookshelfTabContent();
  const openCover=()=>{
    p.properties.flush();
    const sheet=p.walk(owner).findLast(c=>c instanceof p.deps.ReaderBottomSheet);
    const anchor=[...sheet.nodes.values()].find(node=>node.bindContentCover);
    assert.equal(anchor.bindContentCover[0],true,'State opens the native modal cover');
    anchor.bindContentCover[1].builder();
    const options=anchor.bindContentCover[2];
    options.onWillAppear();options.onAppear();
    assert.equal(sheet.frameVisible,false,'cover appearance leaves render-time State untouched');
    return {sheet,anchor,options};
  };
  const render=async()=>{
    const {sheet,anchor,options}=openCover();
    await Promise.resolve();
    p.properties.flush();
    const frame=[...sheet.nodes.values()].find(node=>node.id==='reader-bookshelf-book-action-sheet');
    const mask=[...sheet.nodes.values()].find(node=>node.type==='Rect');
    frame.onAppear();
    const leaf=p.walk(owner).find(c=>c instanceof p.deps.BookshelfBookActionSheet && c.presentationId===owner.actionSheetId);
    const rows=p.walk(leaf).find(c=>c instanceof p.deps.ReaderSheetActionList);
    const buttons=p.walk(rows).flatMap(child=>[...child.nodes.values()]).filter(n=>n.onClick);
    const finish=()=>{
      p.properties.flush();
      assert.equal(anchor.bindContentCover[0],true,'cover blocks the underlying page until the app exit ends');
      frame.transition[1](false);
      p.properties.flush();
      assert.equal(anchor.bindContentCover[0],false);
      options.onDisappear();p.properties.flush();
    };
    return{sheet,frame,mask,leaf,buttons,options,finish};
  };
  return{p,owner,calls,openCover,render};
}
{
  const f=fixture();f.owner.presentBookActionSheet(A);
  const {sheet,options}=f.openCover();
  options.onWillDismiss({reason:'PRESS_BACK'});f.p.properties.flush();
  await Promise.resolve();f.p.properties.flush();
  assert.equal(sheet.frameVisible,false,'Back before deferred appearance suppresses the frame');
  assert.equal(sheet.coverVisible,false,'a close before attachment releases the empty cover');
  options.onDisappear();assert.equal(f.owner.actionBook,undefined);
}
for(const [width,left,right] of [[270,0,0],[390,0,0],[720,0,0],[1024,28,13],[320,24,18],[240,100,80]]){
 const f=fixture(pageSource,{width,left,right});f.owner.presentBookActionSheet(A);const current=await f.render();
 assert.equal(current.frame.width,Math.min(390,Math.max(0,width-left-right)),'sheet uses safe width with the source drawer cap');
 assert.equal(current.frame.translate.x,(left-right)/2);
 f.owner.paneWidth=300;
 f.p.properties.flush();
 assert.equal(current.frame.width,Math.min(390,Math.max(0,300-left-right)),'viewport updates reach the real frame');
 f.owner.appThemeScheme='night';f.p.properties.flush();
 assert.equal(current.frame.backgroundColor,readerAppColor('app.bookshelf.sheetSurface','night'));
 assert.equal(current.mask.fill,readerAppColor('TOK_SS_DRAWER_SCRIM','night'));
 assert.deepEqual(current.frame.borderRadius,{topLeft:24,topRight:24});
 assert.equal(current.frame.padding.bottom,16);
}
for(const [index,name]of[['0','multi'],['1','info'],['2','group'],['3','remove']]){
  const f=fixture();f.owner.presentBookActionSheet(A);const current=await f.render();
  assert.equal(current.frame.height,undefined,'sheet follows measured content');
  assert.equal(current.options.modalTransition,'none');
  assert.equal(current.frame.backgroundColor,readerAppColor('app.bookshelf.sheetSurface','day'));
  assert.equal(current.mask.fill,readerAppColor('TOK_SS_DRAWER_SCRIM','day'));
  assert.deepEqual(current.frame.transition[0],{enter:{type:'bottom',duration:260},exit:{type:'bottom',duration:210}});
  assert.deepEqual(current.mask.transition,{type:'opacity',duration:160});
  current.buttons[Number(index)].onClick();current.buttons[Number(index)].onClick();
  assert.deepEqual(f.calls,[],'business dispatch waits for the cover exit');
  current.finish();
  assert.deepEqual(f.calls,[[name,A]],'actual native row dispatches the captured book once');
  assert.equal(f.owner.actionBook,undefined);
}
{
  const f=fixture(pageSource,{reduceMotion:true});f.owner.presentBookActionSheet(A);const current=await f.render();
  assert.deepEqual(current.frame.transition[0],{type:'opacity',duration:120});
  current.mask.onClick();
  assert.equal(f.owner.bookActionSheetVisible,true,'opening gesture cannot dismiss through the scrim');
  current.options.onWillDismiss({reason:'PRESS_BACK'});
  assert.equal(f.owner.bookActionSheetVisible,false,'system Back closes during entrance');
  current.finish();assert.deepEqual(f.calls,[]);
}
{
  const f=fixture();f.owner.presentBookActionSheet(A);const old=await f.render(),oldId=f.owner.actionSheetId;
  old.frame.transition[1](true);old.mask.onClick();old.finish();
  f.owner.presentBookActionSheet(B);const fresh=await f.render();
  assert.notEqual(fresh.leaf,old.leaf,'sheet content remounts for a new presentation');
  assert.notEqual(f.owner.actionSheetId,oldId);
  old.options.onDisappear();assert.equal(f.owner.actionBook.sourceId,B.sourceId,'late disappearance cannot clear a newer presentation');
  old.buttons[3].onClick();assert.deepEqual(f.calls,[]);
  fresh.buttons[1].onClick();fresh.finish();assert.deepEqual(f.calls,[['info',B]]);
}
{
  const f=fixture();f.owner.presentBookActionSheet(A);const old=await f.render();
  old.options.onWillDismiss({reason:'PRESS_BACK'});old.finish();
  f.owner.presentBookActionSheet(A);const fresh=await f.render(),id=f.owner.actionSheetId;
  old.options.onDisappear();old.buttons[2].onClick();assert.equal(f.owner.actionSheetId,id);assert.deepEqual(f.calls,[]);
  f.owner.aboutToDisappear();fresh.options.onDisappear();fresh.buttons[0].onClick();
  assert.deepEqual(f.calls,[]);assert.equal(f.owner.actionBook,undefined);assert.equal(f.owner.mounted,false);
}
{
  const f=fixture();f.owner.presentBookActionSheet(A);const old=await f.render();
  f.owner.books=[B];f.owner.onBooksChanged();assert.equal(f.owner.bookActionSheetVisible,false,'removing current entity initiates exit');
  old.finish();old.buttons[3].onClick();assert.deepEqual(f.calls,[]);
  f.owner.presentBookActionSheet(A);assert.equal(f.owner.actionBook,undefined,'old shelf row cannot reopen a missing entity');
}
{
  const f=fixture();f.owner.presentBookActionSheet(f.owner.books[0]);const physical=await f.render(),id=f.owner.actionSheetId;
  const raw=f.p.deps.ObservedObject.GetRawObject(f.owner.actionBook);
  assert.notEqual(f.owner.actionBook,raw,'actual State getter exposes a Proxy while the Builder captures its raw entity');
  assert.notEqual(raw,A,'actual one-way books Prop owns its copy of the row');
  assert.equal(f.owner.isCurrentBookActionSheet(id,raw),true,'the current compound identity survives the SDK unwrap');
  f.owner.books=[{...A,title:'refreshed row object'},B];f.p.properties.flush();
  assert.equal(f.owner.actionSheetId,id,'same-book projection refresh preserves the current opening');
  assert.notEqual(f.owner.books[0],raw,'projection refresh replaces the row object');
  physical.buttons[3].onClick();physical.buttons[3].onClick();
  physical.finish();
  assert.deepEqual(f.calls.map(([action,book])=>[action,book.sourceId,book.bookId]),[['remove',A.sourceId,A.bookId]],'refreshed row dispatches exactly once to its captured compound book');
}
{
  const f=fixture();f.owner.presentBookActionSheet(A);const physical=await f.render(),id=f.owner.actionSheetId;
  f.owner.performBookAction(id,B,f.owner.onBookRemoveRequested);f.owner.dismissBookActionSheet(id,B);
  assert.equal(f.owner.actionSheetId,id,'same bookId from another source cannot act on or dismiss this opening');assert.equal(f.calls.length,0);
  const raw=f.p.deps.ObservedObject.GetRawObject(f.owner.actionBook);
  f.owner.dismissBookActionSheet(id,raw);
  assert.equal(f.owner.bookActionSheetVisible,false,'raw current Builder entity can cancel its opening');
  for(const button of physical.buttons)button.onClick();assert.equal(f.calls.length,0,'dismissal retires all four physical handlers');
  physical.finish();
}
{
  const f=fixture();f.owner.presentBookActionSheet(A);const old=await f.render();
  f.owner.navigationGeneration+=1;f.p.properties.flush();
  assert.equal(f.owner.bookActionSheetVisible,false,'navigation Prop watcher dismisses the temporary sheet');
  for(const button of old.buttons)button.onClick();assert.equal(f.calls.length,0,'old physical handlers cannot borrow a new navigation');
  old.finish();f.owner.presentBookActionSheet(B);const fresh=await f.render();old.options.onDisappear();
  fresh.buttons[2].onClick();fresh.finish();assert.deepEqual(f.calls,[['group',B]],'fresh navigation can present and dispatch normally');
}
{
  const f=fixture();f.owner.presentBookActionSheet(A);const old=await f.render();
  f.owner.aboutToDisappear();for(const button of old.buttons)button.onClick();assert.equal(f.calls.length,0,'retired page refuses all former actions');
  f.owner.mounted=true;f.owner.presentBookActionSheet(A);const fresh=await f.render();old.options.onDisappear();
  for(const button of old.buttons)button.onClick();assert.equal(f.calls.length,0,'retired physical handlers cannot target the same book on a later mount');
  fresh.buttons[1].onClick();fresh.finish();assert.deepEqual(f.calls,[['info',A]]);
}
const IndexShelfPorts=productionMotionMethods(new URL('../entry/src/main/ets/pages/Index.ets',import.meta.url),['bookshelfScenePorts']);
for(const retirement of ['current','runtime','route','mount'])for(const actionIndex of [0,1,2,3]){
  const f=fixture(),runtime={};let installed=runtime;
  class Child{constructor(owner,params,_storage,id){Object.assign(this,{owner,params,id});}}
  const index=new IndexShelfPorts();
  const dispatched=[];
  Object.assign(index,{navigationGeneration:7,shelfReadingPreparation:false,navigationOwner:new ReaderNavigation(),
    sourceSwitchPresentation:{isSurfacePresented:()=>false},mangaSourceSwitch:{selectionVisible:false},
    readingEntry:{sessionActive:false,endReading(){}},
    nextNavigationGeneration(){this.navigationOwner.advance();return ++this.navigationGeneration;},
    publishNavigation(snapshot){this.route=snapshot.route;},
    openShelfBookInfo:book=>dispatched.push(['info',book]),
    shelfGroupPresentation:{identity:'',open:(_owner,book)=>dispatched.push(['group',book])},
  });
  admitBookshelfSdkCarrier(index,runtime,()=>installed);
  index.shelfRead.attach=()=>{};
  Object.assign(index.shelfRead.snapshot,{visualAdmitted:true,books:[A,B],revision:'revision'});
  Object.assign(index.shelfMutations,{recovery:()=>({visible:false}),canContinueRemoval:()=>false,
    openSelection:book=>dispatched.push(['multi',book]),
    requestSingleRemoval:book=>dispatched.push(['remove',book])});
  const scene=mountBookshelfSceneProbe({
    read:index.shelfRead,mutations:index.shelfMutations,catalog:{snapshot:{}},motion:{},
    navigation:index.navigationGeneration,feedbackEnabled:true,reduceMotion:false,continueCardSuppressed:false,
    ports:index.bookshelfScenePorts(runtime,index.detailShelfAdmissionMount),
  },{BookshelfShell:Child,BookshelfPage:Child,BookshelfEmptyPage:Child,BookshelfStatusContent:Child});
  [...scene.children.values()].at(-1).params.content(()=>0);
  const props=[...scene.children.values()].find(child=>child.params.books).params;
  for(const name of ['onBookMultiSelectRequested','onBookInfoRequested','onBookGroupRequested','onBookRemoveRequested'])f.owner[name]=props[name];
  f.owner.presentBookActionSheet(A);const physical=await f.render();
  if(retirement==='runtime')installed={};else if(retirement==='route')index.route='detail';else if(retirement==='mount')index.detailShelfAdmissionMount+=1;
  physical.buttons[actionIndex].onClick();
  physical.finish();
  assert.deepEqual(dispatched,retirement==='current'?[[['multi','info','group','remove'][actionIndex],A]]:[],
    `actual Index callback admits current owner and refuses ${retirement} retirement after native row claim`);
}
// Restore only the original guards inside an isolated SDK compilation. The
// genuine State/Prop runtime and native registered Builder remain unchanged.
const originalGuard=pageSource
  .replace(/book !== undefined && this\.actionBook !== undefined && this\.actionBook\.sourceId === book\.sourceId &&\s*this\.actionBook\.bookId === book\.bookId && this\.currentVisibleBook\(book\) !== undefined;/,
    'book !== undefined && this.actionBook === book && this.currentVisibleBook(book) !== undefined;')
  .replace('book === undefined || this.actionBook === undefined || this.actionBook.sourceId !== book.sourceId || this.actionBook.bookId !== book.bookId) return;',
    'book === undefined || this.actionBook !== book) return;');
assert.notEqual(originalGuard,pageSource);
for(const index of [0,1,2,3]){
  const f=fixture(originalGuard);f.owner.presentBookActionSheet(f.owner.books[0]);const physical=await f.render(),id=f.owner.actionSheetId;
  const raw=f.p.deps.ObservedObject.GetRawObject(f.owner.actionBook);
  assert.equal(f.owner.isCurrentBookActionSheet(id,raw),false,'negative control reproduces the raw/proxy guard rejection');
  physical.buttons[index].onClick();assert.equal(f.calls.length,0,'original guard blocks every native physical action');
  f.owner.dismissBookActionSheet(id,raw);assert.equal(f.owner.actionSheetId,id,'original dismiss guard also rejects the current raw entity');
}
console.log('PASS actual Bookshelf State/Prop→ReaderBottomSheet→SDK content cover/row→Index callback: motion and safe width, four once-only actions, raw/proxy and refreshed rows, Back and scrim, same/different-book reopening, removed entity/navigation/unmount and runtime/route/mount retirement, and original-guard negative control; native scheduling/focus remain target evidence');
