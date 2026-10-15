import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {createReaderBuilderProbe} from './lib/reader-control-builder-probe.mjs';
import {boundedSurfaceSdk,boundedMembers} from './lib/bounded-surface-sdk-probe.mjs';
import {admitBookshelfSdkCarrier} from './lib/bookshelf-projection-owner-probe.mjs';
import {readerAppColor} from '../entry/src/main/ets/features/common/ReaderThemeRegistry.ts';
const source=p=>readFileSync(new URL('../entry/src/main/ets/'+p,import.meta.url),'utf8');
const sdk=process.env.READER_ETS_LOADER_ROOT??'/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const builders=createRequire(import.meta.url)(sdk+'/lib/component_map.js').CUSTOM_BUILDER_METHOD;
for(const match of source('features/bookshelf/BookshelfPage.ets').matchAll(/@Builder\s+(?:private\s+)?(\w+)\(/g))builders.add(match[1]);
const pageSource=source('features/bookshelf/BookshelfPage.ets');
const names=['presentBookActionSheet','isCurrentBookActionSheet','dismissBookActionSheet','performBookAction','bookActionSheetOptions','bookActionSheetSpec','onBooksChanged','aboutToDisappear'];
const book=(sourceId,bookId)=>({sourceId,bookId,title:bookId,author:'author',kind:'novel',currentChapterTitle:'chapter'});
const A=book('a','same'),B=book('b','same');
function fixture(definition=pageSource){
  const p=boundedSurfaceSdk();p.hooks.lifecycleChildren=true;p.hooks.allowEmptyBranchAdmission=true;
  p.hooks.childSources.ReaderSheetActionList=source('features/common/ReaderSheetActionList.ets');
  p.deps.ReaderSheetActionList=createReaderBuilderProbe(p.hooks.childSources.ReaderSheetActionList,boundedMembers(p.hooks.childSources.ReaderSheetActionList),p.deps,p.hooks).Component;
  const leaf=source('features/bookshelf/BookshelfBookActionSheet.ets');p.hooks.childSources.BookshelfBookActionSheet=leaf;
  p.deps.BookshelfBookActionSheet=createReaderBuilderProbe(leaf,boundedMembers(leaf),p.deps,p.hooks).Component;
  const probe=createReaderBuilderProbe(definition,['books','navigationGeneration','actionBook','actionSheetId','actionSheetRevision','actionSheetNavigation','mounted',...names,'onShelfPresentationChanged','bookshelfTabContent','bookActionSheetContent','bookActionSheetPresentation'],
    {...p.deps,readerAppColor,SheetType:{CENTER:'center'}},{...p.hooks,initialParams:{books:[A,B],navigationGeneration:7}});
  const {owner}=probe;
  assert.match(probe.output,/bookActionSheetPresentation[^\n]*ObservedObject\.GetRawObject\(this\.actionBook\)/,'actual SDK unwraps the State value at the Builder call');
  const calls=[];Object.assign(owner,{mounted:true,appThemeScheme:'day',
    isWideViewport:()=>false,phoneContent(){},tabletContent(){},tabletNavigation(){},bookActionWidth:()=>352,numericAreaLength:Number,
    saveShelfViewport(){},resetViewSwitchMotion(){},queueShelfProjection(){},publishVisibleReadingBooks(){},viewState:{},projectionGeneration:0,viewportRestoreGeneration:0,viewModeRevision:0,
    onBookMultiSelectRequested:book=>calls.push(['multi',book]),onBookInfoRequested:book=>calls.push(['info',book]),onBookGroupRequested:book=>calls.push(['group',book]),onBookRemoveRequested:book=>calls.push(['remove',book]),
  });
  owner.bookshelfTabContent();const host=[...owner.nodes.values()].find(n=>n.bindSheet);
  const render=()=>{p.properties.flush();assert.equal(host.bindSheet[0],true,'actual State update opens the registered native Sheet');host.bindSheet[1].builder();const leaf=[...owner.children.values()].at(-1),rows=p.walk(leaf).find(c=>c instanceof p.deps.ReaderSheetActionList);return{leaf,rows,buttons:p.walk(rows).flatMap(child=>[...child.nodes.values()]).filter(n=>n.onClick)};};
  const options=()=>{owner.replay();return host.bindSheet[2];};
  return{p,owner,calls,render,options,host,output:probe.output};
}
for(const [index,name]of[['0','multi'],['1','info'],['2','group'],['3','remove']]){
  const f=fixture();f.owner.presentBookActionSheet(A);const current=f.render(),o=f.options();
  assert.equal(o.height,270);assert.equal(o.width,352);assert.equal(o.preferType,'center');assert.equal(o.dragBar,false);assert.equal(o.showClose,false);assert.equal(o.enableOutsideInteractive,false);
  assert.deepEqual(o.radius,{topLeft:24,topRight:24,bottomLeft:0,bottomRight:0});current.buttons[Number(index)].onClick();current.buttons[Number(index)].onClick();
  assert.deepEqual(f.calls,[[name,A]],'actual native row has one dispatch to captured book');assert.equal(f.owner.actionBook,undefined);o.onDisappear();assert.equal(f.owner.actionBook,undefined);
}
{
  const f=fixture();f.owner.presentBookActionSheet(A);const old=f.render(),oldOptions=f.options(),oldId=f.owner.actionSheetId;
  f.owner.presentBookActionSheet(B);f.owner.replay();const freshLeaf=[...f.owner.children.values()].at(-1),freshRows=f.p.walk(freshLeaf).find(c=>c instanceof f.p.deps.ReaderSheetActionList);
  assert.notEqual(freshLeaf,old.leaf,'small native Sheet child actually remounts for a new ID');assert.notEqual(f.owner.actionSheetId,oldId);oldOptions.onDisappear();assert.equal(f.owner.actionBook.sourceId,B.sourceId,'late disappear cannot clear newer same-bookId/different-source presentation');
  old.buttons[3].onClick();assert.equal(f.calls.length,0);f.p.walk(freshRows).flatMap(child=>[...child.nodes.values()]).filter(n=>n.onClick)[1].onClick();assert.deepEqual(f.calls,[['info',B]],'fresh regular callback captures new entity');
}
{
  const f=fixture();f.owner.presentBookActionSheet(A);const old=f.render(),oldOptions=f.options();oldOptions.onDisappear();f.owner.presentBookActionSheet(A);f.owner.replay();const id=f.owner.actionSheetId;
  oldOptions.onDisappear();old.buttons[2].onClick();assert.equal(f.owner.actionSheetId,id);assert.equal(f.calls.length,0,'close/reopen of same book rejects prior lease');
  f.owner.aboutToDisappear();oldOptions.onDisappear();old.buttons[0].onClick();assert.equal(f.calls.length,0);assert.equal(f.owner.actionBook,undefined);assert.equal(f.owner.mounted,false);
}
{
  const f=fixture();f.owner.presentBookActionSheet(A);const old=f.render(),o=f.options();f.owner.books=[B];f.owner.onBooksChanged();assert.equal(f.owner.actionBook,undefined,'removing current compound entity dismisses its sheet');o.onDisappear();old.buttons[3].onClick();assert.equal(f.calls.length,0);f.owner.presentBookActionSheet(A);assert.equal(f.owner.actionBook,undefined,'old physical shelf row cannot open missing entity');
}
{
  const f=fixture();f.owner.presentBookActionSheet(f.owner.books[0]);const physical=f.render(),id=f.owner.actionSheetId;
  const raw=f.p.deps.ObservedObject.GetRawObject(f.owner.actionBook);
  assert.notEqual(f.owner.actionBook,raw,'actual State getter exposes a Proxy while the Builder captures its raw entity');
  assert.notEqual(raw,A,'actual one-way books Prop owns its copy of the row');
  assert.equal(f.owner.isCurrentBookActionSheet(id,raw),true,'the current compound identity survives the SDK unwrap');
  f.owner.books=[{...A,title:'refreshed row object'},B];f.p.properties.flush();
  assert.equal(f.owner.actionSheetId,id,'same-book projection refresh preserves the current opening');
  assert.notEqual(f.owner.books[0],raw,'projection refresh replaces the row object');
  physical.buttons[3].onClick();physical.buttons[3].onClick();
  assert.deepEqual(f.calls.map(([action,book])=>[action,book.sourceId,book.bookId]),[['remove',A.sourceId,A.bookId]],'refreshed row dispatches exactly once to its captured compound book');
}
{
  const f=fixture();f.owner.presentBookActionSheet(A);const physical=f.render(),id=f.owner.actionSheetId;
  f.owner.performBookAction(id,B,f.owner.onBookRemoveRequested);f.owner.dismissBookActionSheet(id,B);
  assert.equal(f.owner.actionSheetId,id,'same bookId from another source cannot act on or dismiss this opening');assert.equal(f.calls.length,0);
  const raw=f.p.deps.ObservedObject.GetRawObject(f.owner.actionBook);
  f.owner.dismissBookActionSheet(id,raw);assert.equal(f.owner.actionBook,undefined,'raw current Builder entity can cancel its opening');
  for(const button of physical.buttons)button.onClick();assert.equal(f.calls.length,0,'dismissal retires all four physical handlers');
}
{
  const f=fixture();f.owner.presentBookActionSheet(A);const old=f.render(),oldOptions=f.options();
  f.owner.navigationGeneration+=1;f.p.properties.flush();
  assert.equal(f.owner.actionBook,undefined,'actual navigation Prop watcher dismisses the temporary Sheet');
  for(const button of old.buttons)button.onClick();assert.equal(f.calls.length,0,'old physical handlers cannot borrow a new navigation');
  f.owner.presentBookActionSheet(B);const fresh=f.render();oldOptions.onDisappear();
  fresh.buttons[2].onClick();assert.deepEqual(f.calls,[['group',B]],'fresh navigation can present and dispatch normally');
}
{
  const f=fixture();f.owner.presentBookActionSheet(A);const old=f.render(),oldOptions=f.options();
  f.owner.aboutToDisappear();for(const button of old.buttons)button.onClick();assert.equal(f.calls.length,0,'retired page refuses all former actions');
  f.owner.mounted=true;f.owner.presentBookActionSheet(A);const fresh=f.render();oldOptions.onDisappear();
  for(const button of old.buttons)button.onClick();assert.equal(f.calls.length,0,'retired physical handlers cannot target the same book on a later mount');
  fresh.buttons[1].onClick();assert.deepEqual(f.calls,[['info',A]]);
}
for(const retirement of ['current','runtime','route','mount'])for(const actionIndex of [0,1,2,3]){
  const f=fixture(),runtime={};let installed=runtime;
  class Child{constructor(owner,params,_storage,id){Object.assign(this,{owner,params,id});}}
  const {owner:index}=createReaderBuilderProbe(source('pages/Index.ets'),['bookshelfContent'],
    {...f.p.deps,BookshelfPage:Child,BookshelfEmptyPage:Child,BookshelfStatusContent:Child},
    {...f.p.hooks,childSources:{...f.p.hooks.childSources,BookshelfPage:pageSource,
      BookshelfEmptyPage:source('features/bookshelf/BookshelfEmptyPage.ets'),BookshelfStatusContent:source('features/bookshelf/BookshelfStatusContent.ets')}});
  const dispatched=[];
  Object.assign(index,{navigationGeneration:7,isBookshelfVisualAdmitted:true,shelfBooks:[A,B],shelfProjectionRevision:'revision',
    bookshelfViewState:{},settingsSnapshot:{reduceMotion:false},readingSessionActive:false,shelfReadingPreparation:false,
    openBookshelfMultiSelect:book=>dispatched.push(['multi',book]),openShelfBookInfo:book=>dispatched.push(['info',book]),
    openShelfGroup:book=>dispatched.push(['group',book]),requestRemoveShelfBook:book=>dispatched.push(['remove',book])});
  admitBookshelfSdkCarrier(index,runtime,()=>installed);index.bookshelfContent();
  const props=[...index.children.values()].find(child=>child.params.books).params;
  for(const name of ['onBookMultiSelectRequested','onBookInfoRequested','onBookGroupRequested','onBookRemoveRequested'])f.owner[name]=props[name];
  f.owner.presentBookActionSheet(A);const physical=f.render();
  if(retirement==='runtime')installed={};else if(retirement==='route')index.route='detail';else if(retirement==='mount')index.detailShelfAdmissionMount+=1;
  physical.buttons[actionIndex].onClick();
  assert.deepEqual(dispatched,retirement==='current'?[[['multi','info','group','remove'][actionIndex],A]]:[],
    `actual Index callback admits current owner and refuses ${retirement} retirement after native row claim`);
}
// Restore only the original guards inside an isolated SDK compilation. The
// genuine State/Prop runtime and native registered Builder remain unchanged.
const originalGuard=pageSource
  .replace('book !== undefined && this.actionBook !== undefined && this.actionBook.sourceId === book.sourceId && this.actionBook.bookId === book.bookId && this.books.some(',
    'book !== undefined && this.actionBook === book && this.books.some(')
  .replace('book === undefined || this.actionBook === undefined || this.actionBook.sourceId !== book.sourceId || this.actionBook.bookId !== book.bookId) return;',
    'book === undefined || this.actionBook !== book) return;');
assert.notEqual(originalGuard,pageSource);
for(const index of [0,1,2,3]){
  const f=fixture(originalGuard);f.owner.presentBookActionSheet(f.owner.books[0]);const physical=f.render(),id=f.owner.actionSheetId;
  const raw=f.p.deps.ObservedObject.GetRawObject(f.owner.actionBook);
  assert.equal(f.owner.isCurrentBookActionSheet(id,raw),false,'negative control reproduces the raw/proxy guard rejection');
  physical.buttons[index].onClick();assert.equal(f.calls.length,0,'original guard blocks every native physical action');
  f.owner.dismissBookActionSheet(id,raw);assert.equal(f.owner.actionSheetId,id,'original dismiss guard also rejects the current raw entity');
}
console.log('PASS actual Bookshelf State/Prop→native bindSheet registered Builder/GetRawObject→identity owner→SDK leaf/shared actions→Index callback: four once-only actions, raw/proxy and refreshed rows, current cancel/onDisappear, same/different-book reopening, removed entity/navigation/unmount and runtime/route/mount retirement, and original-guard negative control; native scheduling/focus remain target evidence');
