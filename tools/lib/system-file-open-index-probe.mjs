import { resolveEtsLoaderRoot, virtualFilePath } from './tool-environment.mjs';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes,createRequire} from 'node:module';
import {ReaderSystemFileOpenQueue} from '../../entry/src/main/ets/app/composition/system-open/ReaderSystemFileOpenQueue.ts';
import {ReaderNavigation} from '../../entry/src/main/ets/app/navigation/ReaderNavigation.ts';
import {runtimeOwnerIdentityProbe} from './reader-runtime-admission-probe.mjs';
import {productionMotionMethods} from './reader-motion-method-probe.mjs';
import {createReaderBuilderProbe} from './reader-control-builder-probe.mjs';
import {selectedProductionMethods} from './selected-production-methods.mjs';
import {actualReadingEntryPresentation,bindReadingEntryFixtureFields} from './reading-entry-presentation-probe.mjs';
import {bookshelfOperationClass} from './bookshelf-operation-owner-probe.mjs';
import {ReaderNativeAlertWindow} from '../../entry/src/main/ets/ui/platform/ReaderNativeAlertWindow.ts';
import {ReaderDocumentPickerActivity} from '../../entry/src/main/ets/platform/ReaderDocumentPickerActivity.ts';
export const systemFileSource=p=>readFileSync(new URL('../../entry/src/main/ets/'+p,import.meta.url),'utf8');
export const systemFileTick=()=>new Promise(resolve=>setImmediate(resolve));
export function systemFileIndexFixture({bridge,book={sourceId:'local',bookId:'local:fixture',title:'本地书',author:'作者',addedAt:1,readingPosition:{chapterIndex:4,chapterOffset:217,updatedAt:5}},owner={},indexSource=new URL('../../entry/src/main/ets/pages/Index.ets',import.meta.url)}={}){
 let installed=owner,outcome={book},activePage;const events=[];
 const queue=bridge===undefined?new ReaderSystemFileOpenQueue(async()=>outcome):undefined;
 bridge??={peek:()=>queue.peek(),subscribe:cb=>queue.subscribe(cb),acknowledge:id=>{events.push(['ack',id]);queue.acknowledge(id);}};
 const ReaderRuntimeOwner=runtimeOwnerIdentityProbe(()=>installed);
 const Navigation=new Function('ReaderRuntimeOwner','ReaderSystemFileOpenHost',stripTypeScriptTypes(systemFileSource('app/navigation/ReaderSystemFileOpenNavigationHost.ts').replace(/^import[\s\S]*?;\n/gm,'').replace(/^export /gm,''))+';return ReaderSystemFileOpenNavigationHost;')(ReaderRuntimeOwner,bridge);
 const Entry=actualReadingEntryPresentation();
 const ExitActions=bookshelfOperationClass('app/composition/ReaderExitActions.ets','ReaderExitActions',
  {ReaderSystemFileOpenNavigationHost:Navigation});
 const Index=selectedProductionMethods(indexSource,'Index',
  ['mountSystemFileOpenNavigation','consumeSystemFileOpen','cancelReaderExitDestination','onReaderExited',
   'currentReaderPresentationIdentity','registerReadingExitRequest','readingExitActionPorts','currentReadingRuntime'],
  {ReaderNativeAlertWindow,ReaderDocumentPickerActivity});
 bindReadingEntryFixtureFields(Index.prototype);
 const Switch=productionMotionMethods(new URL('../../entry/src/main/ets/features/source/application/SourceSwitchHost.ts',import.meta.url),
  ['current','blocksExit','currentTransactionId','busyOrUnknown','retire','stopDiscovery']);
 const admitBook=(page,selected)=>{
  page.readingEntry.book=selected;
  page.readingEntry.beginReaderPresentation();
  page.readingEntry.startReading(owner);
  page.navigationGeneration++;
  page.route='reading';
 };
 const make=()=>{
  const navigationOwner=new ReaderNavigation();
  navigationOwner.show('detail');navigationOwner.advance();
  const page=Object.assign(new Index(),{navigationOwner,readingEntry:new Entry(),mountedRuntimeOwner:owner,
   shelfReceiptRetired:false,detailShelfAdmissionMount:1,searchAppForeground:true,readingSessionActive:false,readingReadyGeneration:1,
   sourceSwitchVisible:false,sourceSwitchState:{kind:'discovering'},sourceSwitchRollbackInFlight:false,settingsSnapshot:{reduceMotion:false},detailToc:[],detailBook:{...book},
   getUIContext:()=>({getPromptAction:()=>({showToast:params=>events.push(['toast',params.message])})}),
   resolveReaderSourceSwitchTransaction:async()=>{},
   returnToBookshelf(){events.push(['shelf']);this.readingEntry.endReading();this.route='bookshelf';this.navigationGeneration++;},
   openShelfBook(selected){events.push(['open',selected]);admitBook(this,selected);},
   closeImportDialog:()=>events.push(['close-import']),
   dismissJsonImport(){},
   returnToReadingOrigin:()=>events.push(['origin']),presentRulesManagementFromReader:()=>events.push(['rules']),returnFromDetail:()=>events.push(['detail'])});
  const switchOwner=Object.assign(new Switch(),{generation:0,reconciliationGeneration:0,snapshot:{scopeId:0,visible:false,state:{kind:'discovering'},failureMessage:'',rollbackInFlight:false}});
  Object.defineProperties(page,{
   route:{get:()=>navigationOwner.snapshot().route,set:route=>navigationOwner.show(route)},
   navigationGeneration:{get:()=>navigationOwner.snapshot().generation,set:value=>{
    while(navigationOwner.snapshot().generation<value)navigationOwner.advance();
   }},
   systemFileOpenNavigation:{get:()=>page.readingExitActions.systemFile},
  });
  const mount=page.mountSystemFileOpenNavigation.bind(page);
  page.libraryAcquisition={currentOwner:()=>activePage===page&&installed===owner?owner:undefined};
  page.mountSystemFileOpenNavigation=(candidate)=>{activePage=page;mount(candidate);};
  page.sourceSwitchPresentation={host:()=>switchOwner};
  // Bind the current Index forwarding port to the fixture's existing,
  // explicitly controlled navigation destination (no Core/import ACK here).
  page.libraryJourney={returnToBookshelf:()=>page.returnToBookshelf()};
  page.retireSourceSwitchPresentation=()=>switchOwner.retire();
  page.shelfMutations={snapshot:{removalKey:''},closeImport:()=>page.closeImportDialog()};
  page.transientFeedback={show:(context,options,isCurrent)=>{
   if(isCurrent())context().getPromptAction().showToast(options);
  }};
  // Old queue fixtures assign controlled domain facts through these aliases;
  // the actual shipped bounded owner methods decide blocking/retirement.
  for(const [alias,field] of [['pendingSourceSwitch','pending'],['sourceSwitchVisible','visible'],['sourceSwitchState','state']])
   Object.defineProperty(page,alias,{get:()=>switchOwner.snapshot[field],set:value=>{switchOwner.snapshot={...switchOwner.snapshot,[field]:value};},configurable:true});
  page.readingExitActions=new ExitActions(navigationOwner,page.readingExitActionPorts());
  return page;
 };
 const page=make();return {page,owner,book,events,ReaderRuntimeOwner,Navigation,bridge,queue,make,admitBook,
  setRuntime:value=>{installed=value;},mount:()=>page.mountSystemFileOpenNavigation(owner),dispose:()=>{page.shelfReceiptRetired=true;page.nativeAlertWindowUnsubscribe?.();page.documentPickerUnsubscribe?.();page.readingExitActions.dispose();queue?.dispose();},
  enqueue:async(value={book},uri='file://provider/book.txt')=>{outcome=value;queue.enqueue(uri);await systemFileTick();return queue.peek();}};
}
/** Lift only the exact three shipped ReaderShell callback assignments into a
 * minimal SDK child payload. This verifies actual V1 ordinary callback emission,
 * not native ReaderShell mounting or complete application compilation. */
export function systemReaderExitSdk(page){
 const sdk=resolveEtsLoaderRoot();
 const require=createRequire(import.meta.url),ts=require(sdk+'/node_modules/typescript'),text=systemFileSource('app/composition/RetainedReaderScene.ets');
 const tree=ts.createSourceFile(virtualFilePath('FileOpenReaderConsumer.ets'),text,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,require(sdk+'/lib/ets_checker.js').compilerOptions);
 let shell;
 const walk=n=>{if(ts.isCallExpression(n)&&n.expression.getText(tree)==='ReaderShell')shell=n;ts.forEachChild(n,walk);};walk(tree);
 const names=new Set(['onExitRequestHandler','onExit','onExitCancelled']);
 const props=shell.arguments[0].properties.filter(p=>names.has(p.name?.getText(tree))).map(p=>p.getText(tree));
 if(props.length!==3)throw Error('actual ReaderShell exit callback source changed');
 const lifted='@Component struct ReaderFileExitBridge { @Builder readerLifecyclePayload() { ReaderShell({'+props.join(',')+'}); } build(){Column(){}} }';
 class Child{constructor(owner,params,_storage,id){Object.assign(this,{owner,params,id});}updateStateVars(){}}
 const probe=createReaderBuilderProbe(lifted,['readerLifecyclePayload'],{ReaderShell:Child},{childSources:{ReaderShell:systemFileSource('features/reading/ui/ReaderShell.ets')}}).owner;
 probe.ports={attachExit:(...args)=>page.registerReadingExitRequest(...args),
  exit:identity=>page.onReaderExited(identity),cancelExit:identity=>page.cancelReaderExitDestination(identity)};
 probe.readerLifecyclePayload();return [...probe.children.values()][0].params;
}

/** Compile the actual retained ReaderShell→ReadingExperience ForEach and attach
 * the actual Index exit payload above. No native scheduling is simulated. */
export function systemReaderShellExitSdk(page){
 const raw=systemFileSource('features/reading/ui/ReaderShell.ets');
 const start=raw.indexOf('        ForEach([this.readingIdentityKey()]');
 const tail='        }, (identity: string): string => identity);';
 const end=raw.indexOf(tail,start)+tail.length;
 if(start<0||end<start)throw Error('actual ReaderShell identity subtree changed');
 const wrapper='@Component struct ReaderFileOwnerProbe { @Builder readingOwner() { '+raw.slice(start,end)+' } build(){Column(){}} }';
 class Child{constructor(owner,params,_storage,id){Object.assign(this,{owner,params,id});}updateStateVars(){}}
 const probe=createReaderBuilderProbe(wrapper,['readingOwner'],{ReadingExperience:Child},{childSources:{ReadingExperience:systemFileSource('features/reading/ui/LocalReadingExperience.ets')}}).owner;
 const Shell=productionMotionMethods(new URL('../../entry/src/main/ets/features/reading/ui/ReaderShell.ets',import.meta.url),['readingIdentityKey']);
 Object.assign(probe,systemReaderExitSdk(page),{route:'reading',visible:true,readingIdentityKey:Shell.prototype.readingIdentityKey});
 for(const name of ['sourceId','bookId','readingReadyGeneration'])Object.defineProperty(probe,name,{get:()=>name==='readingReadyGeneration'?page[name]:page.detailBook?.[name]});
 const render=()=>{probe.readingOwner();return [...probe.children.values()].at(-1).params;};
 return {probe,render};
}
