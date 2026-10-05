import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {foundationControls,foundationSpecs,readerFoundationTokens} from './reader-foundation-control-probe.mjs';
import {labeledIconControls,labeledIconSpecs} from './reader-labeled-icon-action-probe.mjs';
import {readerTypographyRoles} from './reader-typography-probe.mjs';
import {productionReaderPressFeedback} from './reader-press-feedback-probe.mjs';
import {readerAppColor} from '../../entry/src/main/ets/features/common/ReaderThemeRegistry.ts';
import {SearchViewState} from '../../entry/src/main/ets/features/search/SearchViewState.ts';
import {boundedMembers} from './bounded-surface-sdk-probe.mjs';
import {createReaderBuilderProbe} from './reader-control-builder-probe.mjs';
import {compileCardSpecs} from './reader-card-probe.mjs';
import {compileIconButtonSpecs} from './reader-icon-button-probe.mjs';
const req=createRequire(import.meta.url),sdk=process.env.READER_ETS_LOADER_ROOT??'/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const map=req(sdk+'/lib/component_map.js');
export function compileTailConsumer(source,names,deps,hooks){const saved=new Map(map.ID_ATTRS);map.ID_ATTRS.clear();try{return createReaderBuilderProbe(source,names,deps,hooks);}finally{map.ID_ATTRS.clear();for(const[k,v]of saved)map.ID_ATTRS.set(k,v);}}
/** Composition of actual production shared classes with the same V1 property
 * runtime. No replacement business owner or dummy control is supplied. Native
 * focus/layout/scheduling remain platform seams outside this source SDK proof. */
export function tailControls(options={}){
 const roles={...readerTypographyRoles,...options.roles};
 const foundation=options.foundation??foundationControls({specs:foundationSpecs(roles)});
 const shared=labeledIconControls({foundation,specs:labeledIconSpecs(roles),ColorMetrics:options.ColorMetrics});
 const paths={ReaderIconButton:'common/ReaderIconButton',ReaderSearchField:'common/ReaderSearchField',ReaderCard:'common/ReaderCard',SearchSpinner:'search/SearchSpinner'};
 const childSources=Object.fromEntries(Object.entries(paths).map(([name,path])=>[name,readFileSync(new URL('../../entry/src/main/ets/features/'+path+'.ets',import.meta.url),'utf8')]));
 const page=readFileSync(new URL('../../entry/src/main/ets/features/search/SearchPage.ets',import.meta.url),'utf8');
 childSources.SearchResultCard=page.slice(page.lastIndexOf('@Component',page.indexOf('struct SearchResultCard')));
 const hooks={...shared.hooks,childSources:{...shared.hooks.childSources,...childSources}};
 const enumValues=name=>new Proxy({},{get:(_,key)=>`${name}.${String(key)}`});
 const dependencies={...shared.dependencies,...readerFoundationTokens,...roles,readerAppColor,SearchViewState,resolveReaderCardSpec:compileCardSpecs(),resolveReaderIconButtonSpec:compileIconButtonSpecs(),
  LazyForEach:{create(_id,_owner,data){assert.equal(data.totalCount(),0,'tail parent fixture mounts original empty native lazy list; results row algorithms are separate contracts');},pop(){}},SynchedPropertyNesedObjectPU:shared.properties.sdk.SynchedPropertyNestedObjectPU,ReaderPressFeedback:productionReaderPressFeedback({}),Edge:enumValues('Edge'),ScrollDirection:enumValues('ScrollDirection'),TouchType:enumValues('TouchType')};
 const syntax=req(sdk+'/lib/validate_ui_syntax.js');syntax.builderParamObjectCollection.set('ReaderCard',new Set(['content']));
 assert.match(page,/@Observed\s+(?:export )?class SearchBookGroup/);syntax.observedClassCollection.add('SearchBookGroup');
 for(const[name,source]of Object.entries(childSources))dependencies[name]=compileTailConsumer(source,boundedMembers(source),dependencies,hooks).Component;
 return{...shared,dependencies,hooks,childSources};
}
// Actual business methods are selected verbatim from the production component.
// Only outer geometry/window metrics and the native empty data source are seams.
export const searchActionMethods=['searchFailureTitle','searchFailureMessage','isStoppedEmpty','searchActionLeading','operation','retryOperation','isSweeping','canSubmit','submitSearch','scopeSourceIds','selectGroup','refreshVisibleResults','publishVisibleGroups','groupNames','groupScopeRow','groupScopeChip','searchHeaderHeight','searchBottomInset','partialSearchFailure','primaryPill','secondaryPill','suggestion'];
export function seedTailOwner(owner,{scheme='day',tablet=false,busy=false,kind='initial',history=['原历史'],operation}={}){
 const viewState=new SearchViewState();viewState.keywordDraft='原关键词';
 Object.assign(owner,{appThemeScheme:scheme,scheme,isTablet:tablet,reduceMotion:false,keyword:'原关键词',focusInputOnAppear:false,historyWidth:204,selectedGroupName:'在线',viewState,viewStateRevision:viewState.revision,spinnerRunKey:3,
  presentation:{kind,history,historyStatus:'ready',keyword:'原关键词',results:[],searching:busy,stopped:false,completedSourceCount:3,totalSourceCount:7,failedSourceCount:2,searchedSourceCount:7,localSearchFailed:true,sourceListFailed:false,localSearchError:'原本地失败',operation:operation??{canCancel:busy,canRetry:true}},
  visibleGroups:[],warmupGroups:[],visibleStart:0,visibleEnd:0,resultStatsHeight:28.5,resultDataSource:{totalCount:()=>0,registerDataChangeListener(){},replace(){return false;}},resultScroller:{scrollEdge(){}},pageEpoch:1,listEpoch:1,restoreEpoch:0,listMounted:false,scrollRestored:false,readerWindowMetricsRevision:0,
  snapshot:{busy,records:[],facts:{canMutate:!busy},restoreStatus:'idle'},
  onSearch(){},onStop(){},onBack(){},onRetry(){},onManageSources(){},onClearHistory(){},onRetryHistory(){},onVisibleGroups(){},onTriggerBackup(){},onRefresh(){},onSelectKind(){},
 });
 owner.contentFrame=()=>({width:330,left:16});owner.searchBottomInset=()=>24;
 return owner;
}
