import { resolveEtsLoaderRoot, virtualFilePath } from './tool-environment.mjs';
import {actualGeneralSettingsTypes,actualGeneralSettingsHostField} from './general-settings-owner-probe.mjs';
import {actualSourceManagementTypes,actualSourceManagementHostField} from './source-management-owner-probe.mjs';
import {actualBookshelfOperationTypes,actualBookshelfHostField} from './bookshelf-operation-owner-probe.mjs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createReaderBuilderProbe} from './reader-control-builder-probe.mjs';
import {boundedSurfaceSdk} from './bounded-surface-sdk-probe.mjs';
import {fixture,seed,book,session,deferred,until,tick} from './reading-entry-index-fixture.mjs';
import {ProductionHost,read,setRuntime,readingEvidence as evidence} from './reading-entry-owner-probe.mjs';
import * as geometry from '../../entry/src/main/ets/features/common/SurfaceHorizontalGeometry.ts';
import * as metricsApi from '../../entry/src/main/ets/features/common/ReaderWindowMetrics.ts';
import {ReaderNativeAlertOwner} from './reader-native-alert-sdk-probe.mjs';
import {localBookDetailSdk} from './local-book-detail-sdk-probe.mjs';
import {MangaBookPresentation} from '../../entry/src/main/ets/features/manga/MangaBookPresentation.ts';
import {MangaSessionGateway} from '../../entry/src/main/ets/features/manga/MangaSessionGateway.ts';
import {readerRecoveryView} from '../../entry/src/main/ets/app/ReaderRecoveryProjection.ts';
import {ReaderCoreRequestError} from '../../entry/vendor/core-harmony/sdk/reader_core.ts';
const sdk=resolveEtsLoaderRoot();
const require=createRequire(import.meta.url),ts=require(sdk+'/node_modules/typescript');
const parsed=(source)=>ts.createSourceFile(virtualFilePath('EntryConsumer.ets'),source,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,require(sdk+'/lib/ets_checker.js').compilerOptions);
const properties=source=>parsed(source).statements.find(n=>n.members&&n.members.some(m=>m.name?.getText()==='build')).members.filter(m=>ts.isPropertyDeclaration(m)&&ts.getAllDecorators(m).length>0).map(m=>m.name.getText());
const methods=['getReadingEntryHost','readingEntryLease','applyReadingEntrySnapshot','bindReadingEntryReader','retireReadingEntryPresentation',
 'readingPreparationContext','sharedReadingPreparationSeeds','preparePersistedShelfBooks','prepareVisibleReadingBooks','onSearchVisibilityChanged',
 'hydrateMangaPositions','refreshDetailMangaPosition','pumpMangaPositionProjections','mangaPositionProjectionCurrent','projectMangaPosition',
 'openLocalBookDetail','openRemoteBookDetail','onRemoteSessionReady','installRemoteReadingSession','probeRemoteContentVerdict','refreshCachedChapterFromPrompt','chooseCachedChapterRefresh',
 'refreshDetailAcquisitionProjection','openReading','isKnownDetailChapter','presentPreparedReading','returnToReadingOrigin','applyReaderDirectoryProjection',
 'retireSettingsPresentation','retireSourceManagementPresentation','nextNavigationGeneration','retireSourceSwitchPresentation','retireRssPresentation','retireRssEditorPresentation','isCurrentRuntime','showIndexAlert','showReadingFailure','runIndexRecoveryAction',
 'externalDirectory','detailContent','detailSurface','isCurrentDetailPresentation','detailShelfAdmissionIdentity','isCurrentDetailShelfAdmission','detailReadableAdmission','detailShelfMessage','detailBookKey','remoteContentVerdictLabel',
 'requestDetailShelfMutation','addDetailBook','cancelDetailBookAddition','readableAdmissionCurrent','publishReadableAdmission',
 'isSameDetailBook','canRemoveDetailBook','removeDetailBook','applyDetailBookRemoval','shelfFilter','shelfRecovery','emptyShelfRecovery',
 'requestRemoveDetailBook','openBookRemovalDialog','dismissBookRemovalDialog','confirmBookRemovalDialog','isCurrentBookRemoval'];
const Runtime={current:()=>{throw Error('consumer must use captured mounted Runtime');},isCurrent:owner=>ProductionHost.forRuntime(owner).owns(owner)};
const emptyAdmission={key:'',generation:0,adding:false,cancelling:false,message:'',confirmation:'none'};
export function makeIndex(f,{route='search',mount=1,indexSource=read('pages/Index.ets')}={}){
 const EntryHost=f.host.constructor;
 const p=boundedSurfaceSdk({allowEmptyBranchAdmission:true});
 const metrics=metricsApi.createDefaultReaderWindowMetrics();metrics.windowRect=new metricsApi.ReaderRectVp(0,0,390,844);
 const src=read('features/bookshelf/LocalBookDetail.ets');
 const leafDeps={...p.deps,...geometry,...metricsApi,ReaderWindowCoordinator:{metrics:()=>metrics},
  BookDirectoryPage:class {}};
 p.hooks.childSources.LocalBookDetail=src;
 p.hooks.childSources.BookDirectoryPage=read('features/bookshelf/BookDirectoryPage.ets');
 const leaf=localBookDetailSdk(leafDeps,p.hooks,p.properties).Component;
 const shelfRuntime={current:()=>f.runtime,isCurrent:owner=>owner===f.runtime&&!f.runtime.closed};
 const shelfTypes=actualBookshelfOperationTypes({ReaderRuntimeOwner:shelfRuntime,ReaderCoreRequestError});
 const idx=p.consumer(indexSource,[...properties(indexSource).filter(n=>[
  'detailBook','detailToc','detailInBookshelf','detailLoadingMessage','remoteReadingSession','remoteReadingSeed','remoteContentVerdict',
  'readableAdmissions','shelfOperation'].includes(n)),...methods,
  ...(indexSource.includes('private retireBookshelfCatalogPresentation(') ? ['retireBookshelfCatalogPresentation'] : [])],
  {...leafDeps,LocalBookDetail:leaf,ReadingEntryHost:EntryHost,ReaderRuntimeOwner:{current:()=>{if(f.runtime.closed)throw Error('Runtime unavailable');return f.runtime;},isCurrent:owner=>owner===f.runtime&&!owner.closed},
   ...evidence,ReaderNativeAlertOwner,MangaBookPresentation,MangaSessionGateway,readerRecoveryView,AppStorage:{setOrCreate(){}},EMPTY_READABLE_ADMISSION:emptyAdmission,
   EMPTY_BOOKSHELF_OPERATION_SNAPSHOT:shelfTypes.EMPTY_BOOKSHELF_OPERATION_SNAPSHOT,LOCAL_SOURCE_ID:'local',DOMAIN:0,hilog:{info(){},warn(){},error(){}},
   CustomDialogController:class{constructor(options){this.options=options;f.removalDialog=options;}open(){}close(){}},DialogAlignment:{Center:'Center'}});
 Object.assign(idx,{mountedRuntimeOwner:f.runtime,shelfReceiptRetired:false,detailShelfAdmissionMount:mount,navigationGeneration:0,
   route,readingOriginRoute:'detail',readingSessionActive:false,sourceSwitchVisible:false,sourceSwitchScopeId:0,
   readingEntryScopeId:-1,readingPresentedScopeId:-1,remoteSessionGeneration:0,offlineMutationGeneration:0,offlineMutationActiveKey:'',
   shelfOperation:{generation:0,action:'remove',removalKey:'',busy:false,cleanupWarning:''},readableAdmissions:[],shelfBooks:[],searchDetailCandidates:[],detailToc:[],detailInBookshelf:false,
   shelfReadingFilter:'all',shelfSourceFilter:'all',shelfContentFilter:'all',bookRemovalPresentation:0,bookRemovalDialogOpen:false,
   shelfReadingPreparation:false,shelfProjectionRevision:'r1',searchAppForeground:true,applicationSettingsSnapshot:{},
   bookshelfLoadGeneration:0,mangaProjectionSignature:'',mangaProjectionGeneration:0,mangaProjectionWorkers:0,mangaProjectionQueue:[],
   bookshelfCatalogEpoch:0,bookshelfBackgroundEpoch:0,readingReadyGeneration:1,nativeAlertOwner:new ReaderNativeAlertOwner(),
   searchHost:{visibilityChanged(){},close(){},resume(){}},hasUnknownShelfWrite:()=>false,refreshSearchShelfMembership(){this.membershipRefreshCount=(this.membershipRefreshCount??0)+1;},
   invalidateBookshelfProjection(){this.invalidationCount=(this.invalidationCount??0)+1;},applyBookshelfState(state){this.acceptedShelf=state;},
   refreshBookshelf(){this.refreshCount=(this.refreshCount??0)+1;},
   consumeSystemFileOpen(){},isRemoteCatalogNearEnd:()=>false,refreshRemoteCatalogNearEnd(){},
   getUIContext:()=>({showAlertDialog(options){f.notices.push(options);f.nativeAlert=options;}}),
   searchAcquisitionCandidate:row=>({seed:row,catalogReady:false,failed:false})});
 idx.bookshelfHost=actualBookshelfHostField(idx,shelfTypes.Host,{setOrCreate(){}});
 const sourceTypes=actualSourceManagementTypes({ReaderRuntimeOwner:shelfRuntime});
 idx.sourcePresentationIdentity='';
 idx.sourceHost=actualSourceManagementHostField(idx,sourceTypes.SourceHost);
 const settingsTypes=actualGeneralSettingsTypes({ReaderRuntimeOwner:shelfRuntime});
 idx.settingsPresentationIdentity='';
 idx.settingsHost=actualGeneralSettingsHostField(idx,settingsTypes.SettingsHost);
 const owner=()=>EntryHost.forRuntime(f.runtime);
 const render=()=>{idx.detailContent();return p.walk(idx).filter(c=>c instanceof leaf).at(-1);};
 return{p,idx,owner,render,leaf};
}
