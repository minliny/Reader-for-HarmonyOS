import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {boundedSurfaceSdk} from './bounded-surface-sdk-probe.mjs';
import {createReaderBuilderProbe} from './reader-control-builder-probe.mjs';
import {bookshelfOperationClass} from './bookshelf-operation-owner-probe.mjs';
import {BookshelfReadOwner} from '../../entry/src/main/ets/features/bookshelf/BookshelfReadOwner.ts';
import {projectOperationFacts} from '../../entry/src/main/ets/app/ReaderOperationFacts.ts';
import {classifyReaderSource} from '../../entry/src/main/ets/features/source/ReaderSourceCategory.ts';
import * as names from '../../entry/src/main/ets/features/bookshelf/BookshelfSourceNameProjection.ts';
import {runtimeOwnerIdentityProbe} from './reader-runtime-admission-probe.mjs';
import {productionMotionMethods} from './reader-motion-method-probe.mjs';
import {readerRecoveryView} from '../../entry/src/main/ets/app/ReaderRecoveryProjection.ts';
export function actualProjectionTypes(readRuntime) {
 const ReaderRuntimeOwner=runtimeOwnerIdentityProbe(readRuntime);
 const ReaderCoreGateway=bookshelfOperationClass('app/ReaderCoreGateway.ts','ReaderCoreGateway');
 const BookshelfFlowGateway=bookshelfOperationClass('features/bookshelf/BookshelfFlowGateway.ts','BookshelfFlowGateway',{ReaderCoreGateway,LocalBookImportGateway:class{}});
 const SourceGateway=bookshelfOperationClass('features/source/SourceGateway.ts','SourceGateway',{ReaderRuntimeOwner,classifyReaderSource});
 const BookshelfProjectionOwner=bookshelfOperationClass('features/bookshelf/BookshelfProjectionOwner.ts','BookshelfProjectionOwner',{projectOperationFacts,BookshelfReadOwner,...names});
 const Host=bookshelfOperationClass('features/bookshelf/BookshelfHost.ets','BookshelfHost',{ReaderRuntimeOwner,BookshelfFlowGateway,BookshelfProjectionOwner,SourceGateway});
 return {ReaderRuntimeOwner,ReaderCoreGateway,BookshelfFlowGateway,SourceGateway,BookshelfProjectionOwner,Host,...names};
}
export const projectionIndexMethods=['getBookshelfProjection','applyBookshelfProjection','invalidateBookshelfProjection','isCurrentRuntime',
 'isCurrentBookshelfPresentation','shelfFilter','refreshBookshelf','applyBookshelfState','loadShelfWindowPage','loadNextShelfPage','loadPreviousShelfPage',
 'shelfReadRecovery','retryBookshelfRead','emptyShelfRecovery','refreshSearchShelfMembership','sourceDisplayName'];
let mount=0;
export function actualProjectionIndex(runtime,types,{filter={readingState:'all',sourceKind:'all'},initial,identity}={}) {
 const Index=productionMotionMethods(new URL('../../entry/src/main/ets/pages/Index.ets',import.meta.url),projectionIndexMethods,
  {...types,readerRecoveryView,DOMAIN:0,hilog:{warn(){}}});
 const member=[],accepted=[],faults=[];
 const idx=Object.assign(new Index(),{mountedRuntimeOwner:runtime,shelfReceiptRetired:false,detailShelfAdmissionMount:1,navigationGeneration:1,
  rssInstanceIdentity:identity??++mount,route:'bookshelf',shelfReadingFilter:filter.readingState,shelfSourceFilter:filter.sourceKind,
  bookshelfViewState:{anchorKey:'',anchorOffset:0},sourceSources:[],sourceToolsSnapshot:{sources:[]},
  searchHost:{sources:()=>[],updateShelf:books=>member.push(books)},
  scheduleBookshelfBackgroundRefresh:state=>accepted.push(state),preparePersistedShelfBooks(){},traceStartupStage(){},beginStartupStage:()=>0,endStartupStage(){},
  bookshelfLoadGeneration:0,shelfBooks:[],shelfProjectionRevision:'',shelfMatchedTotal:0,shelfWindowOffset:0,
  shelfHasOnlineBooks:false,isBookshelfVisualAdmitted:false,isCoreShelfEmpty:false,bookshelfLoadFailed:false,
  settingsSnapshot:{reduceMotion:false},shelfPageLoading:false});
 idx.bookshelfHost=new types.Host(()=>{},()=>true,()=>runtime);
 const owner=idx.getBookshelfProjection();
 if(initial!==undefined)idx.applyBookshelfState(initial);
 return {idx,owner,member,accepted,faults};
}

export function actualProjectionSdkFeedback(f) {
  const read=path=>readFileSync(new URL('../../entry/src/main/ets/'+path,import.meta.url),'utf8');
  class Child{constructor(owner,params,_storage,id){Object.assign(this,{owner,params,id});}updateStateVars(params){Object.assign(this.params,params);}}
  const index=read('pages/Index.ets'),shellText=read('features/bookshelf/BookshelfShell.ets');
  const sdk=boundedSurfaceSdk({allowEmptyBranchAdmission:true});
  sdk.childSources.BookshelfMoreMenu=read('features/bookshelf/BookshelfMoreMenu.ets');
  const loader=process.env.READER_ETS_LOADER_ROOT??'/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
  const require=createRequire(import.meta.url),syntax=require(loader+'/lib/validate_ui_syntax.js'),builders=require(loader+'/lib/component_map.js').CUSTOM_BUILDER_METHOD;
  syntax.builderParamObjectCollection.set('BookshelfShell',new Set(['content']));
  for(const match of shellText.matchAll(/@Builder\s+(?:private\s+)?(\w+)\s*\(/g))builders.add(match[1]);builders.add('bookshelfContent');
  const parent=createReaderBuilderProbe(index,['bookshelfShellContent','bookshelfContent'],{BookshelfShell:Child,BookshelfPage:Child,BookshelfStatusContent:Child,BookshelfEmptyPage:Child},
    {allowEmptyBranchAdmission:true,childSources:{BookshelfShell:shellText,BookshelfPage:read('features/bookshelf/BookshelfPage.ets'),BookshelfStatusContent:read('features/bookshelf/BookshelfStatusContent.ets'),BookshelfEmptyPage:read('features/bookshelf/BookshelfEmptyPage.ets')}}).owner;
  const project=()=>{
    Object.assign(parent,f.idx,{shelfRecovery:()=>({visible:false,canRetry:false,message:'',generation:0}),shelfReadRecovery:()=>f.idx.shelfReadRecovery()});
    for(const name of ['isCurrentBookshelfPresentation','loadNextShelfPage','loadPreviousShelfPage','refreshBookshelf','retryBookshelfRead','prepareVisibleReadingBooks'])
      if(typeof f.idx[name]==='function')parent[name]=f.idx[name].bind(f.idx);
    parent.bookshelfContent();parent.bookshelfShellContent();
    const shelf=[...parent.children.values()].find(child=>child.params.books),props=[...parent.children.values()].find(child=>child.params.readRecovery).params;
    const shell=sdk.consumer(shellText,['shellContent','content','recoveryNoticeContent'],{BookshelfMoreMenu:Child,READER_FLOATING_TOP_BAR_HEIGHT:56});
    Object.assign(shell,props,{content(){},topBar(){},moreMenuVisible:false});shell.shellContent();
    const notice=sdk.walk(shell).find(owner=>owner instanceof sdk.deps.ReaderRecoveryNotice);
    const action=sdk.nodes(shell).find(node=>node.height===36&&node.onClick);
    return {props,shelf,notice,action,shell};
  };
  return {project,parent};
}

/** Bind the actual Index admission methods to a SDK-only carrier. The opaque
 * Runtime is the instance-storage seam; no guard or navigation logic is mocked. */
export function admitBookshelfSdkCarrier(carrier, runtime = {}, readRuntime = () => runtime) {
  const Guard=productionMotionMethods(new URL('../../entry/src/main/ets/pages/Index.ets',import.meta.url),
    ['isCurrentBookshelfPresentation'],{ReaderRuntimeOwner:runtimeOwnerIdentityProbe(readRuntime)});
  carrier.mountedRuntimeOwner ??= runtime;carrier.navigationGeneration ??= 1;
  carrier.detailShelfAdmissionMount ??= 1;carrier.shelfReceiptRetired ??= false;carrier.route ??= 'bookshelf';
  carrier.isCurrentRuntime=Guard.prototype.isCurrentRuntime.bind(carrier);
  carrier.isCurrentBookshelfPresentation=Guard.prototype.isCurrentBookshelfPresentation.bind(carrier);
  return carrier;
}
