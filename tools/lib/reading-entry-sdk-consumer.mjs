import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createReaderBuilderProbe} from './reader-control-builder-probe.mjs';
import {boundedSurfaceSdk} from './bounded-surface-sdk-probe.mjs';
import {fixture,seed,book,session,deferred,until,tick} from './reading-entry-index-fixture.mjs';
import {ProductionHost,read,setRuntime,readingEvidence as evidence} from './reading-entry-owner-probe.mjs';
import * as geometry from '../../entry/src/main/ets/features/common/SurfaceHorizontalGeometry.ts';
import * as metricsApi from '../../entry/src/main/ets/features/common/ReaderWindowMetrics.ts';
import {ReaderNativeAlertOwner} from '../../entry/src/main/ets/app/ReaderNativeAlertOwner.ts';
const sdk=process.env.READER_ETS_LOADER_ROOT??'/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const require=createRequire(import.meta.url),ts=require(sdk+'/node_modules/typescript');
const parsed=(source)=>ts.createSourceFile('/tmp/EntryConsumer.ets',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,require(sdk+'/lib/ets_checker.js').compilerOptions);
const properties=source=>parsed(source).statements.find(n=>n.members&&n.members.some(m=>m.name?.getText()==='build')).members.filter(m=>ts.isPropertyDeclaration(m)&&ts.getAllDecorators(m).length>0).map(m=>m.name.getText());
const methods=['getReadingEntryHost','readingEntryLease','applyReadingEntrySnapshot','bindReadingEntryReader','retireReadingEntryPresentation',
 'readingPreparationContext','sharedReadingPreparationSeeds','preparePersistedShelfBooks','prepareVisibleReadingBooks','onSearchVisibilityChanged',
 'openLocalBookDetail','openRemoteBookDetail','onRemoteSessionReady','installRemoteReadingSession','probeRemoteContentVerdict','refreshCachedChapterFromPrompt','chooseCachedChapterRefresh',
 'refreshDetailAcquisitionProjection','openReading','isKnownDetailChapter','presentPreparedReading','returnToReadingOrigin','applyReaderDirectoryProjection',
 'nextNavigationGeneration','retireSourceSwitchPresentation','retireRssPresentation','isCurrentRuntime','showIndexAlert','showReadingFailure',
 'externalDirectory','detailContent','detailSurface','isCurrentDetailPresentation','detailShelfAdmissionIdentity','isCurrentDetailShelfAdmission','detailReadableAdmission','detailBookKey','remoteContentVerdictLabel'];
const Runtime={current:()=>{throw Error('consumer must use captured mounted Runtime');},isCurrent:owner=>ProductionHost.forRuntime(owner).owns(owner)};
const emptyAdmission={key:'',generation:0,adding:false,cancelling:false,message:'',confirmation:'none'};
export function makeIndex(f,{route='search',mount=1,indexSource=read('pages/Index.ets')}={}){
 const p=boundedSurfaceSdk({allowEmptyBranchAdmission:true});
 const metrics=metricsApi.createDefaultReaderWindowMetrics();metrics.windowRect=new metricsApi.ReaderRectVp(0,0,390,844);
 const src=read('features/bookshelf/LocalBookDetail.ets');
 const leafNames=[...properties(src),'onContinue','onSelectChapter','onOpenDirectory','onSwitchSource','onRemove','onCancelAdd','onBack','actionArea','actionButtonWidth','contentWidth','contentFrame','liveViewportWidth','usesWideContent','numericAreaLength',
  'readingActionLabel','shelfActionLabel','chapterEmptyMessage'];
 const leafDeps={...p.deps,...geometry,...metricsApi,ReaderWindowCoordinator:{metrics:()=>metrics},
  DETAIL_ACTION_AREA_HEIGHT:77,TOK_CONTENT_MAX_W_TABLET:640,BookDirectoryPage:class {}};
 p.hooks.childSources.LocalBookDetail=src;
 p.hooks.childSources.BookDirectoryPage=read('features/bookshelf/BookDirectoryPage.ets');
 const leaf=createReaderBuilderProbe(src,leafNames,leafDeps,p.hooks).Component;
 const idx=p.consumer(indexSource,[...properties(indexSource).filter(n=>[
  'detailBook','detailToc','detailInBookshelf','detailLoadingMessage','remoteReadingSession','remoteReadingSeed','remoteContentVerdict'].includes(n)),...methods],
  {...leafDeps,LocalBookDetail:leaf,ReadingEntryHost:ProductionHost,ReaderRuntimeOwner:{current:()=>{if(f.runtime.closed)throw Error('Runtime unavailable');return f.runtime;},isCurrent:owner=>owner===f.runtime&&!owner.closed},
   ...evidence,ReaderNativeAlertOwner,EMPTY_READABLE_ADMISSION:emptyAdmission,LOCAL_SOURCE_ID:'local',DOMAIN:0,hilog:{info(){},warn(){},error(){}}});
 Object.assign(idx,{mountedRuntimeOwner:f.runtime,shelfReceiptRetired:false,detailShelfAdmissionMount:mount,navigationGeneration:0,
   route,readingOriginRoute:'detail',readingSessionActive:false,sourceSwitchVisible:false,sourceSwitchScopeId:0,
   readingEntryScopeId:-1,remoteSessionGeneration:0,offlineMutationGeneration:0,offlineMutationActiveKey:'',
   shelfOperation:{generation:0,removalKey:'',busy:false},readableAdmissions:[],shelfBooks:[],searchDetailCandidates:[],detailToc:[],detailInBookshelf:false,
   shelfReadingPreparation:false,shelfProjectionRevision:'r1',searchAppForeground:true,applicationSettingsSnapshot:{},
   bookshelfCatalogEpoch:0,bookshelfBackgroundEpoch:0,readingReadyGeneration:1,nativeAlertOwner:new ReaderNativeAlertOwner(),
   searchHost:{visibilityChanged(){},close(){},resume(){}},hasUnknownShelfWrite:()=>false,refreshBookshelf(){this.refreshCount=(this.refreshCount??0)+1;},
   consumeSystemFileOpen(){},isRemoteCatalogNearEnd:()=>false,refreshRemoteCatalogNearEnd(){},
   getUIContext:()=>({showAlertDialog(options){f.notices.push(options);f.nativeAlert=options;}}),
   searchAcquisitionCandidate:row=>({seed:row,catalogReady:false,failed:false})});
 const owner=()=>ProductionHost.forRuntime(f.runtime);
 const render=()=>{idx.detailContent();return p.walk(idx).filter(c=>c instanceof leaf).at(-1);};
 return{p,idx,owner,render,leaf};
}
