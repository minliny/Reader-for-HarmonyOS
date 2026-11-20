import { virtualFilePath } from './lib/tool-environment.mjs';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {installedEtsCompiler} from './lib/ets-compiler-runtime.mjs';
import {createReaderBuilderProbe} from './lib/reader-control-builder-probe.mjs';
import {boundedSurfaceSdk,boundedMembers,readerSurfaceSpecsForProbe} from './lib/bounded-surface-sdk-probe.mjs';
import {pureModuleProbe} from './lib/ets-pure-module-probe.mjs';
import {admitBookshelfSdkCarrier} from './lib/bookshelf-projection-owner-probe.mjs';
import {readerAppColor} from '../entry/src/main/ets/features/common/ReaderThemeRegistry.ts';
import * as metricsApi from '../entry/src/main/ets/features/common/ReaderWindowMetrics.ts';
import * as geometryApi from '../entry/src/main/ets/features/common/SurfaceHorizontalGeometry.ts';
const source=p=>readFileSync(new URL('../entry/src/main/ets/'+p,import.meta.url),'utf8');
const {root:sdk,require,ts,options}=installedEtsCompiler();
const builders=require(sdk+'/lib/component_map.js').CUSTOM_BUILDER_METHOD;
for (const name of ['BookshelfPage', 'BookshelfShell']) {
 const file = name + '.ets';
 const tree = ts.createSourceFile(virtualFilePath(file), source('features/bookshelf/' + file),
  ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
 assert.deepEqual(tree.parseDiagnostics, []);
 const component = tree.statements.find(node => node.name?.text === name);
 assert.ok(component, name);
 for (const member of component.members) {
  if (ts.isMethodDeclaration(member) && ts.getAllDecorators(member).some(({expression}) =>
   ts.isIdentifier(expression) && expression.text === 'Builder')) builders.add(member.name.getText(tree));
 }
}
const pageSource=source('features/bookshelf/BookshelfPage.ets');
const actionIconApi=pureModuleProbe(source('features/common/ReaderActionIconResources.ets'),'ReaderActionIconResources.ets',{$r:value=>value},['readerActionIcon']);
const scaleApi=pureModuleProbe(source('features/common/ReaderSurfaceResolvers.ts'),'ReaderSurfaceResolvers.ts',{},['readerReadableFontScale','readerScaledControlHeight']);
const touchApi=pureModuleProbe(source('features/common/ReaderActionAccessibility.ets'),'ReaderActionAccessibility.ets',{},['readerActionTouchRegion']);
const names=['presentBookActionSheet','isCurrentBookActionSheet','dismissBookActionSheet','finishBookActionSheet','performBookAction',
 'bookActionSheetOptions','bookActionSheetSpec','onBooksChanged','aboutToDisappear','actionSheetAppearedId','actionSheetChromeId','pendingBookAction',
 'bookActionSheetVisible','readerWindowMetricsRevision','mainViewportRevision','bookActionWidth','effectiveViewportWidth',
 'onShelfPresentationChanged','bookshelfTabContent','bookActionSheetContent','bookActionSheetPresentation'];
const book=(sourceId,bookId)=>({sourceId,bookId,title:bookId,author:'author',kind:'novel',currentChapterTitle:'chapter'});
const A=book('a','same'),B=book('b','same');
// Message rendering/timers are outside this sheet-admission contract. Keep
// the real toast source registered for SDK Component/Prop syntax validation,
// while this explicit port carries priority/bounded through unchanged.
class ToastPort {
  constructor(owner,params,_storage,id){Object.assign(this,{owner,params,id,nodes:new Map(),children:new Map()});}
  initialRender(){} aboutToAppear(){} aboutToDisappear(){}
  updateStateVars(next){Object.assign(this.params,next);}
}
function ports(metrics){
 const p=boundedSurfaceSdk({windowMetrics:metrics});p.hooks.lifecycleChildren=true;p.hooks.allowEmptyBranchAdmission=true;
 p.hooks.childSources.ReaderTransientToast=source('features/common/ReaderTransientToast.ets');p.deps.ReaderTransientToast=ToastPort;
 Object.assign(p.deps,actionIconApi,scaleApi,touchApi,{ReaderWindowCoordinator:{metrics:()=>metrics,requestAppChrome(){},requestOverlayChrome(){}}});
 Object.assign(p.deps,pureModuleProbe(source('features/common/ReaderSheetChrome.ets'),'ReaderSheetChrome.ets',
  {...readerSurfaceSpecsForProbe(metrics),...geometryApi,readerAppColor},['readerSheetWidth','readerSheetChrome']));
 // Rebind actual renderer children to their current production imports. No
 // test suite is imported, and no SDK build/HAP/device operation is nested.
 for(const name of ['ReaderActionMenuSurface','ReaderActionSheetContent','ReaderSheetActionList','BookshelfBookActionSheet','BookshelfMoreActionSheet']){
  const file=(name.startsWith('Bookshelf')?'features/bookshelf/':'features/common/')+name+'.ets';
  const input=source(file);p.hooks.childSources[name]=input;
  p.deps[name]=createReaderBuilderProbe(input,boundedMembers(input),p.deps,p.hooks).Component;
 }
 return p;
}
function fixture(definition=pageSource,{width=390,left=0,right=0}={}){
 const metrics=new metricsApi.ReaderWindowMetricsSnapshot(new metricsApi.ReaderRectVp(0,0,width,844),undefined,new metricsApi.ReaderInsetsVp(left,0,right,0));
 const p=ports(metrics);let mainWidth=width;
 const probe=createReaderBuilderProbe(definition,['books','navigationGeneration','actionBook','actionSheetId','actionSheetRevision','actionSheetNavigation','mounted',...names],
  {...p.deps,...metricsApi,...geometryApi,readerAppColor,readerMainViewport:()=>({width:mainWidth}),SheetType:{BOTTOM:'bottom'},SheetSize:{FIT_CONTENT:'fit-content'},DismissReason:{PRESS_BACK:'back'}},
  {...p.hooks,initialParams:{books:[A,B],navigationGeneration:7}});
 const {owner}=probe;
 assert.match(probe.output,/bookActionSheetPresentation[^\n]*ObservedObject\.GetRawObject\(this\.actionBook\)/,'actual SDK unwraps State at the native Builder call');
 const calls=[];Object.assign(owner,{mounted:true,appThemeScheme:'day',readerWindowMetricsRevision:0,mainViewportRevision:0,
  viewModePending:()=>false,isWideViewport:()=>false,phoneContent(){},tabletContent(){},tabletNavigation(){},numericAreaLength:Number,
  shelfContentWidth:()=>assert.fail('native book actions must not use the old cover frame'),
  transientFeedback:{reset(){}},publishContinueCardRect(){},isCurrentChromeHost:()=>false,scheduleReturnMotionOrigin(){},scheduleContinueCardMeasurement(){},
  saveShelfViewport(){},resetViewSwitchMotion(){},queueShelfProjection(){},publishVisibleReadingBooks(){},viewState:{},projectionGeneration:0,viewportRestoreGeneration:0,viewModeRevision:0,
  onBookMultiSelectRequested:book=>calls.push(['multi',book]),onBookInfoRequested:book=>calls.push(['info',book]),onBookGroupRequested:book=>calls.push(['group',book]),onBookRemoveRequested:book=>calls.push(['remove',book]),
 });
 owner.bookshelfTabContent();const host=[...owner.nodes.values()].find(n=>n.bindSheet);
 const render=()=>{
  p.properties.flush();assert.equal(host.bindSheet[0],true,'State opens the registered native Sheet');host.bindSheet[1].builder();
  const leaf=[...owner.children.values()].at(-1),rows=p.walk(leaf).find(c=>c instanceof p.deps.ReaderSheetActionList);
  const header=p.walk(leaf).find(c=>c instanceof p.deps.ReaderBoundedSurfaceHeader);
  return{leaf,rows,buttons:p.walk(rows).flatMap(child=>[...child.nodes.values()]).filter(n=>n.onClick),close:[...header.nodes.values()].find(n=>n.onClick).onClick};
 };
 const options=()=>{owner.replay();return host.bindSheet[2];};
 return{p,owner,calls,render,options,host,output:probe.output,viewport:width=>{mainWidth=width;}};
}
function assertChrome(options,scheme,p){
 assert.equal(options.backgroundColor,readerAppColor('app.bookshelf.sheetSurface',scheme));
 assert.equal(options.maskColor,readerAppColor('TOK_SS_DRAWER_SCRIM',scheme));
 assert.deepEqual(options.radius,{topLeft:22,topRight:22,bottomLeft:0,bottomRight:0});
 assert.deepEqual(options.shadow,p.deps.readerSurfaceElevation('sheet',scheme));
 assert.deepEqual(options.borderWidth,{top:1});assert.equal(options.borderColor,readerAppColor('app.border.modalHighlight',scheme));
}
for(const [width,left,right] of [[270,0,0],[390,0,0],[720,0,0],[1024,28,13],[320,24,18],[240,100,80]]){
 const f=fixture(pageSource,{width,left,right});f.owner.presentBookActionSheet(A);f.render();
 assert.equal(f.options().width,Math.min(390,Math.max(0,width-left-right)),'safe effective viewport retains the 390 cap');
 f.viewport(300);assert.equal(f.options().width,Math.min(390,Math.max(0,300-left-right)),'actual effectiveViewportWidth reads the live main viewport port');
 f.owner.appThemeScheme='night';assertChrome(f.options(),'night',f.p);
}
for(const [index,name]of[['0','multi'],['1','info'],['2','group'],['3','remove']]){
 const f=fixture();f.owner.presentBookActionSheet(A);const current=f.render(),o=f.options();
 assert.equal(o.height,'fit-content');assert.equal(o.width,390);assert.equal(o.preferType,'bottom');assert.equal(o.dragBar,false);assert.equal(o.showClose,false);assert.equal(o.enableOutsideInteractive,false);assertChrome(o,'day',f.p);
 current.buttons[Number(index)].onClick();for(const button of current.buttons)button.onClick();
 assert.deepEqual(f.calls,[],'action remains pending during native dismissal');assert.equal(f.owner.bookActionSheetVisible,false);assert.ok(f.owner.actionBook);
 o.onDisappear();o.onDisappear();assert.deepEqual(f.calls,[[name,A]],'native onDisappear commits one captured action');assert.equal(f.owner.actionBook,undefined);
}
{
 const f=fixture();f.owner.presentBookActionSheet(A);const physical=f.render(),o=f.options();
 physical.close();assert.equal(f.owner.bookActionSheetVisible,false);assert.deepEqual(f.calls,[],'header close schedules no business action');
 for(const button of physical.buttons)button.onClick();o.onDisappear();assert.equal(f.owner.actionBook,undefined);assert.deepEqual(f.calls,[]);
}
{
 const f=fixture();f.owner.presentBookActionSheet(A);const old=f.render(),oldOptions=f.options(),oldId=f.owner.actionSheetId;
 f.owner.presentBookActionSheet(B);assert.equal(f.owner.actionSheetId,oldId,'an active opening refuses replacement');
 old.close();oldOptions.onDisappear();f.owner.presentBookActionSheet(B);const fresh=f.render(),freshOptions=f.options();
 assert.notEqual(fresh.leaf,old.leaf);assert.notEqual(f.owner.actionSheetId,oldId);oldOptions.onDisappear();old.close();
 assert.equal(f.owner.actionBook.sourceId,B.sourceId,'old close/disappear cannot clear newer same-bookId/different-source presentation');
 old.buttons[3].onClick();assert.equal(f.calls.length,0);fresh.buttons[1].onClick();freshOptions.onDisappear();assert.deepEqual(f.calls,[['info',B]]);
}
{
 const f=fixture();f.owner.presentBookActionSheet(A);const old=f.render(),oldOptions=f.options();old.close();oldOptions.onDisappear();
 f.owner.presentBookActionSheet(A);f.render();const id=f.owner.actionSheetId;
 oldOptions.onDisappear();old.close();old.buttons[2].onClick();assert.equal(f.owner.actionSheetId,id);assert.equal(f.calls.length,0,'same-book reopen rejects the prior physical lease');
 f.owner.aboutToDisappear();oldOptions.onDisappear();old.buttons[0].onClick();assert.equal(f.calls.length,0);assert.equal(f.owner.actionBook,undefined);assert.equal(f.owner.mounted,false);
}
{
 const f=fixture();f.owner.presentBookActionSheet(A);const old=f.render(),o=f.options();f.owner.books=[B];f.owner.onBooksChanged();
 assert.equal(f.owner.bookActionSheetVisible,false,'removing compound entity starts dismissal');o.onDisappear();old.buttons[3].onClick();old.close();assert.equal(f.calls.length,0);
 f.owner.presentBookActionSheet(A);assert.equal(f.owner.actionBook,undefined,'stale shelf row cannot open a missing entity');
}
{
 const f=fixture();f.owner.presentBookActionSheet(f.owner.books[0]);const physical=f.render(),id=f.owner.actionSheetId,o=f.options();
 const raw=f.p.deps.ObservedObject.GetRawObject(f.owner.actionBook);
 assert.notEqual(f.owner.actionBook,raw);assert.notEqual(raw,A);assert.equal(f.owner.isCurrentBookActionSheet(id,raw),true,'current compound identity survives SDK unwrap');
 f.owner.books=[{...A,title:'refreshed row object'},B];f.p.properties.flush();assert.equal(f.owner.actionSheetId,id);assert.notEqual(f.owner.books[0],raw);
 physical.buttons[3].onClick();physical.buttons[3].onClick();o.onDisappear();
 assert.deepEqual(f.calls.map(([action,book])=>[action,book.sourceId,book.bookId]),[['remove',A.sourceId,A.bookId]],'refreshed row keeps exactly one captured compound book');
}
{
 const f=fixture();f.owner.presentBookActionSheet(A);const physical=f.render(),id=f.owner.actionSheetId,o=f.options();
 f.owner.performBookAction(id,B,f.owner.onBookRemoveRequested);f.owner.dismissBookActionSheet(id,B);
 assert.equal(f.owner.actionSheetId,id);assert.equal(f.owner.bookActionSheetVisible,true,'same bookId from another source cannot dismiss this opening');assert.equal(f.calls.length,0);
 f.owner.dismissBookActionSheet(id,f.p.deps.ObservedObject.GetRawObject(f.owner.actionBook));assert.equal(f.owner.bookActionSheetVisible,false);
 for(const button of physical.buttons)button.onClick();o.onDisappear();assert.equal(f.owner.actionBook,undefined);assert.equal(f.calls.length,0);
}
{
 const f=fixture();f.owner.presentBookActionSheet(A);const old=f.render(),oldOptions=f.options();
 f.owner.navigationGeneration+=1;f.p.properties.flush();assert.equal(f.owner.bookActionSheetVisible,false);
 for(const button of old.buttons)button.onClick();old.close();assert.equal(f.calls.length,0);oldOptions.onDisappear();
 f.owner.presentBookActionSheet(B);const fresh=f.render(),freshOptions=f.options();oldOptions.onDisappear();
 fresh.buttons[2].onClick();freshOptions.onDisappear();assert.deepEqual(f.calls,[['group',B]],'fresh navigation remains usable');
}
{
 const f=fixture();f.owner.presentBookActionSheet(A);const old=f.render(),oldOptions=f.options();f.owner.aboutToDisappear();
 for(const button of old.buttons)button.onClick();old.close();assert.equal(f.calls.length,0);
 f.owner.mounted=true;f.owner.presentBookActionSheet(A);const fresh=f.render(),freshOptions=f.options();oldOptions.onDisappear();
 for(const button of old.buttons)button.onClick();old.close();assert.equal(f.calls.length,0);fresh.buttons[1].onClick();freshOptions.onDisappear();assert.deepEqual(f.calls,[['info',A]]);
}
for(const retirement of ['current','runtime','route','mount'])for(const actionIndex of [0,1,2,3]){
 const f=fixture(),runtime={};let installed=runtime;
 class Child{constructor(owner,params,_storage,id){Object.assign(this,{owner,params,id});}}
 const {owner:index}=createReaderBuilderProbe(source('pages/Index.ets'),['bookshelfContent'],
  {...f.p.deps,BookshelfPage:Child,BookshelfEmptyPage:Child,BookshelfStatusContent:Child},
  {...f.p.hooks,childSources:{...f.p.hooks.childSources,BookshelfPage:pageSource,BookshelfEmptyPage:source('features/bookshelf/BookshelfEmptyPage.ets'),BookshelfStatusContent:source('features/bookshelf/BookshelfStatusContent.ets')}});
 const dispatched=[];Object.assign(index,{navigationGeneration:7,isBookshelfVisualAdmitted:true,shelfBooks:[A,B],shelfProjectionRevision:'revision',bookshelfViewState:{},settingsSnapshot:{reduceMotion:false},readingSessionActive:false,shelfReadingPreparation:false,
  openBookshelfMultiSelect:book=>dispatched.push(['multi',book]),openShelfBookInfo:book=>dispatched.push(['info',book]),openShelfGroup:book=>dispatched.push(['group',book]),requestRemoveShelfBook:book=>dispatched.push(['remove',book])});
 admitBookshelfSdkCarrier(index,runtime,()=>installed);index.bookshelfContent();const props=[...index.children.values()].find(child=>child.params.books).params;
 for(const name of ['onBookMultiSelectRequested','onBookInfoRequested','onBookGroupRequested','onBookRemoveRequested'])f.owner[name]=props[name];
 f.owner.presentBookActionSheet(A);const physical=f.render(),o=f.options();
 if(retirement==='runtime')installed={};else if(retirement==='route')index.route='detail';else if(retirement==='mount')index.detailShelfAdmissionMount+=1;
 physical.buttons[actionIndex].onClick();o.onDisappear();
 assert.deepEqual(dispatched,retirement==='current'?[[['multi','info','group','remove'][actionIndex],A]]:[],`Index callback refuses ${retirement} retirement after native dismissal`);
}
// Keep the original raw/proxy identity bug as a negative control, with the
// genuine current State/Prop runtime and native Builder unchanged.
const originalGuard=pageSource
 .replace('book !== undefined && this.actionBook !== undefined && this.actionBook.sourceId === book.sourceId && this.actionBook.bookId === book.bookId && this.books.some(', 'book !== undefined && this.actionBook === book && this.books.some(')
 .replace('book === undefined || this.actionBook === undefined || this.actionBook.sourceId !== book.sourceId || this.actionBook.bookId !== book.bookId) return;', 'book === undefined || this.actionBook !== book) return;');
assert.notEqual(originalGuard,pageSource);
for(const actionIndex of [0,1,2,3]){
 const f=fixture(originalGuard);f.owner.presentBookActionSheet(f.owner.books[0]);const physical=f.render(),id=f.owner.actionSheetId;
 const raw=f.p.deps.ObservedObject.GetRawObject(f.owner.actionBook);assert.equal(f.owner.isCurrentBookActionSheet(id,raw),false);
 physical.buttons[actionIndex].onClick();assert.equal(f.calls.length,0);f.owner.dismissBookActionSheet(id,raw);assert.equal(f.owner.actionSheetId,id);assert.equal(f.owner.bookActionSheetVisible,true,'original cancel guard rejects the current raw entity');
}
// Exercise More's real host close wiring as well as the leaf-only callbacks.
for(const scheme of ['day','night']){
 const metrics=new metricsApi.ReaderWindowMetricsSnapshot(new metricsApi.ReaderRectVp(0,0,366,844));const p=ports(metrics),calls=[];
 const input=source('features/bookshelf/BookshelfShell.ets');
 const owner=p.consumer(input,['moreMenuVisible','moreSheetCurrentId','moreSelectionId','moreSheetNavigation','moreSheetChromeId','moreSheetAppearedId','navigationGeneration','mounted',
  'moreSheetSpec','moreSheetWidth','moreSheetOptions','isCurrentMoreSheet','dismissMoreMenu','releaseMoreSheetChrome','finishMoreSheet','moreSheetContent','moreIntentAction'],
  {...metricsApi,SheetSize:{FIT_CONTENT:'fit-content'},SheetType:{BOTTOM:'bottom'},DismissReason:{PRESS_BACK:'back'}},
  {navigationGeneration:7,onBatchManageRequested:()=>calls.push('batch'),onImportRequested:()=>calls.push('import'),onDownloadsRequested:()=>calls.push('downloads'),onBookshelfSettingsRequested:()=>calls.push('settings')});
 Object.assign(owner,{mounted:true,appThemeScheme:scheme,moreMenuVisible:true,moreSheetCurrentId:'more:1',moreSelectionId:'more:1',moreSheetNavigation:7});
 owner.moreSheetContent();const leaf=[...owner.children.values()].at(-1),header=p.walk(leaf).find(child=>child instanceof p.deps.ReaderBoundedSurfaceHeader);
 const close=[...header.nodes.values()].find(node=>node.onClick).onClick,options=owner.moreSheetOptions();assertChrome(options,scheme,p);assert.equal(options.width,366);
 close();assert.equal(owner.moreMenuVisible,false);assert.deepEqual(calls,[]);options.onDisappear();assert.equal(owner.moreSheetCurrentId,'');
 Object.assign(owner,{moreMenuVisible:true,moreSheetCurrentId:'more:2',moreSelectionId:'more:2',moreSheetNavigation:7});
 close();options.onDisappear();assert.equal(owner.moreMenuVisible,true);assert.equal(owner.moreSheetCurrentId,'more:2','stale More close/disappear does not retire a newer opening');assert.deepEqual(calls,[]);
}
console.log('PASS actual native Sheet helper options, Book/More close admission, four once-only pending actions, raw/proxy/refreshed rows, cancel/onDisappear, same/different-book reopening, entity/navigation/unmount/runtime retirement and original-guard negative control; native scheduling/focus remain target evidence');
