import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {productionMotionMethods} from './lib/reader-motion-method-probe.mjs';
import {createReaderBuilderProbe} from './lib/reader-control-builder-probe.mjs';
import {boundedSurfaceSdk,boundedMembers} from './lib/bounded-surface-sdk-probe.mjs';
import {readerAppColor} from '../entry/src/main/ets/features/common/ReaderThemeRegistry.ts';
const source=p=>readFileSync(new URL('../entry/src/main/ets/'+p,import.meta.url),'utf8');
const sdk=process.env.READER_ETS_LOADER_ROOT??'/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const builders=createRequire(import.meta.url)(sdk+'/lib/component_map.js').CUSTOM_BUILDER_METHOD;
for(const match of source('features/bookshelf/BookshelfPage.ets').matchAll(/@Builder\s+(?:private\s+)?(\w+)\(/g))builders.add(match[1]);
const path=new URL('../entry/src/main/ets/features/bookshelf/BookshelfPage.ets',import.meta.url);
const names=['presentBookActionSheet','isCurrentBookActionSheet','dismissBookActionSheet','performBookAction','bookActionSheetOptions','bookActionSheetSpec','onBooksChanged','aboutToDisappear'];
const book=(sourceId,bookId)=>({sourceId,bookId,title:bookId,author:'author',kind:'novel',currentChapterTitle:'chapter'});
const A=book('a','same'),B=book('b','same');
function fixture(){
  const p=boundedSurfaceSdk();p.hooks.lifecycleChildren=true;p.hooks.allowEmptyBranchAdmission=true;
  p.hooks.childSources.ReaderSheetActionList=source('features/common/ReaderSheetActionList.ets');
  p.deps.ReaderSheetActionList=createReaderBuilderProbe(p.hooks.childSources.ReaderSheetActionList,boundedMembers(p.hooks.childSources.ReaderSheetActionList),p.deps,p.hooks).Component;
  const leaf=source('features/bookshelf/BookshelfBookActionSheet.ets');p.hooks.childSources.BookshelfBookActionSheet=leaf;
  p.deps.BookshelfBookActionSheet=createReaderBuilderProbe(leaf,boundedMembers(leaf),p.deps,p.hooks).Component;
  const Methods=productionMotionMethods(path,names,{...p.deps,readerAppColor,SheetType:{CENTER:'center'}});
  const {owner}=createReaderBuilderProbe(source('features/bookshelf/BookshelfPage.ets'),['bookshelfTabContent','bookActionSheetContent','bookActionSheetPresentation'],p.deps,p.hooks);
  const calls=[];Object.assign(owner,new Methods(),{books:[A,B],mounted:true,actionSheetId:'',actionSheetRevision:0,actionBook:undefined,appThemeScheme:'day',
    isWideViewport:()=>false,phoneContent(){},tabletContent(){},tabletNavigation(){},bookActionWidth:()=>352,numericAreaLength:Number,
    saveShelfViewport(){},resetViewSwitchMotion(){},queueShelfProjection(){},viewState:{},projectionGeneration:0,viewportRestoreGeneration:0,viewModeRevision:0,
    onBookMultiSelectRequested:book=>calls.push(['multi',book]),onBookInfoRequested:book=>calls.push(['info',book]),onBookGroupRequested:book=>calls.push(['group',book]),onBookRemoveRequested:book=>calls.push(['remove',book]),
  });
  for(const name of names)owner[name]=Methods.prototype[name].bind(owner);
  owner.bookshelfTabContent();const host=[...owner.nodes.values()].find(n=>n.bindSheet);
  const render=()=>{owner.bookActionSheetContent();const leaf=[...owner.children.values()].at(-1),rows=p.walk(leaf).find(c=>c instanceof p.deps.ReaderSheetActionList);return{leaf,rows,buttons:[...rows.nodes.values()].filter(n=>n.onClick)};};
  const options=()=>{owner.replay();return host.bindSheet[2];};
  return{p,owner,calls,render,options,host};
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
  assert.notEqual(freshLeaf,old.leaf,'small native Sheet child actually remounts for a new ID');assert.notEqual(f.owner.actionSheetId,oldId);oldOptions.onDisappear();assert.equal(f.owner.actionBook,B,'late disappear cannot clear newer same-bookId/different-source presentation');
  old.buttons[3].onClick();assert.equal(f.calls.length,0);[...freshRows.nodes.values()].filter(n=>n.onClick)[1].onClick();assert.deepEqual(f.calls,[['info',B]],'fresh regular callback captures new entity');
}
{
  const f=fixture();f.owner.presentBookActionSheet(A);const old=f.render(),oldOptions=f.options();oldOptions.onDisappear();f.owner.presentBookActionSheet(A);f.owner.replay();const id=f.owner.actionSheetId;
  oldOptions.onDisappear();old.buttons[2].onClick();assert.equal(f.owner.actionSheetId,id);assert.equal(f.calls.length,0,'close/reopen of same book rejects prior lease');
  f.owner.aboutToDisappear();oldOptions.onDisappear();old.buttons[0].onClick();assert.equal(f.calls.length,0);assert.equal(f.owner.actionBook,undefined);assert.equal(f.owner.mounted,false);
}
{
  const f=fixture();f.owner.presentBookActionSheet(A);const old=f.render(),o=f.options();f.owner.books=[B];f.owner.onBooksChanged();assert.equal(f.owner.actionBook,undefined,'removing current compound entity dismisses its sheet');o.onDisappear();old.buttons[3].onClick();assert.equal(f.calls.length,0);f.owner.presentBookActionSheet(A);assert.equal(f.owner.actionBook,undefined,'old physical shelf row cannot open missing entity');
}
console.log('PASS actual Bookshelf native bindSheet→identity owner→SDK leaf→shared frame/header/actions: retained host geometry, once-only captured compound entity, new callbacks, close/reopen/late disappear, removed entity and unmount retirement; native scheduling/focus remain target evidence');
