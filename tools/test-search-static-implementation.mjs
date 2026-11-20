// Explicit actual SDK composition only: no network, HAP, HDC or implicit suite.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';
const definitions={
  'result-card':{description:'Actual retained result SDK card uses source-first quiet footer, title/author roles and exclusive intro/chapter budget without losing selected book facts',resources:[]},
  'compact-sheet':{description:'Actual compact shared header and native task/filter Builders retain one host, measured roles, atomic reset and retired identity/retry rejection',resources:[]},
};
const selectedCases=selectContractCases(definitions);
if(selectedCases.length){
const productionRoot=new URL('../entry/src/main/ets/',import.meta.url).href;
const resolver=registerHooks({resolve(specifier,context,next){
  if(context.parentURL?.startsWith(productionRoot)&&specifier.startsWith('.')&&!/\.[a-z]+$/i.test(specifier))return next(specifier+'.ts',context);
  return next(specifier,context);
}});
try {
const root=new URL('../entry/src/main/ets/',import.meta.url);
const file=path=>new URL(path,root),read=path=>readFileSync(file(path),'utf8');
for (const selected of selectedCases){
  const {readerTypographyRoles,readerMessageStyles}=await import('./lib/reader-typography-probe.mjs');
  const {readerAppColor}=await import('../entry/src/main/ets/features/common/ReaderThemeRegistry.ts');
  const {SEARCH_RESULT_GEOMETRY}=await import('../entry/src/main/ets/features/search/SearchResultGeometry.ts');
  const {SearchViewState}=await import('../entry/src/main/ets/features/search/SearchViewState.ts');
  const {bookIntroText}=await import('../entry/src/main/ets/features/common/BookIntroText.ts');
  const {bookAuthorLabel}=await import('../entry/src/main/ets/features/common/BookAuthorMetadata.ts');
  const {searchBookSnapshot}=await import('../entry/src/main/ets/features/search/SearchBookSnapshot.ts');
  const {createReaderComponentProbe}=await import('./lib/reader-component-probe.mjs');
  const {builderComponentMembers}=await import('./lib/ets-builder-probe.mjs');
  const {readerSurfaceSpecsForProbe}=await import('./lib/bounded-surface-sdk-probe.mjs');
  const {searchBoundedSdk,searchSheetSdkInputs,searchFilterSdkDeclarations}=await import('./lib/search-sheet-sdk-probe.mjs');
  const {selectedProductionClasses,selectedProductionMethods,selectedProductionValues}=await import('./lib/selected-production-methods.mjs');
  if(selected==='result-card'){
    const {createArkUIPropertyRuntimeProbe}=await import('./lib/arkui-property-runtime-probe.mjs');
    const {readerFoundationTokens}=await import('./lib/reader-foundation-control-probe.mjs');
    const {installedEtsCompiler}=await import('./lib/ets-compiler-runtime.mjs');
    const {root:sdkRoot,require:sdkRequire}=installedEtsCompiler();
    sdkRequire(sdkRoot+'/lib/validate_ui_syntax.js').observedClassCollection.add('SearchBookGroup');
    const properties=createArkUIPropertyRuntimeProbe();
    const source=read('features/search/SearchPage.ets');
    const card=source;
    for(const input of [
      {category:'novel',sourceId:'online',intro:'真实输入的简介',latestChapterTitle:'第21章 尾声·2026/01/15 10:06'},
      {category:'novel',sourceId:'online',intro:'',latestChapterTitle:'第21章 尾声·2026/01/15 10:06'},
      {category:'comic',sourceId:'online',intro:'漫画不以小说简介占行',latestChapterTitle:'第12话'},
      {category:'novel',sourceId:'local',intro:'本地简介',latestChapterTitle:'第1章'},
    ]){
      const book={bookId:'actual-input',title:'两行书名与长作者的实际排版输入',author:'作者',sourceName:'🌸实际书源',coverUrl:'',searchRequestId:'query-a',...input};
      const group=properties.sdk.ObservedObject.createNew({book,sourceCount:5,inBookshelf:true,coverUrl:'fixture-cover.jpg',variants:[book]},undefined);
      // Only this actual row is mounted. Unchanged page/toolbar/icon controls
      // are outside this case and are not initialized through a broad fixture.
      const {owner}=createReaderComponentProbe(card,builderComponentMembers(card,'SearchResultCard'),{...properties.sdk,...readerTypographyRoles,...readerFoundationTokens,readerAppColor,
        SynchedPropertyNesedObjectPU:properties.sdk.SynchedPropertyNestedObjectPU,SEARCH_RESULT_GEOMETRY,
        bookIntroText,bookAuthorLabel,searchBookSnapshot,SearchViewState,ImageFit:{Cover:'Cover'},LengthMetrics:{vp:value=>value},
        SourceType:{TouchScreen:'touch',Keyboard:'keyboard'},
        ReaderWindowCoordinator:{metrics:()=>({systemFontScale:1.6})}},{...properties.hooks,componentName:'SearchResultCard'});
      owner.updateStateVars({group,cardWidth:326,queryRevision:0});owner.appThemeScheme='day';owner.aboutToAppear();owner.initialRender();
      const nodes=()=>[...owner.nodes.values()];
      const texts=()=>nodes().filter(node=>node.type==='Text');
      const title=texts().find(node=>node.create===book.title);
      assert.equal(title.fontFamily,readerTypographyRoles.TYPE_SEARCH_RESULT_TITLE.fontFamily);
      assert.equal(title.fontSize,16);assert.equal(title.lineHeight,24);assert.equal(title.maxLines,2);
      const author=texts().find(node=>String(node.create).startsWith('作者'));
      assert.equal(author.fontFamily,readerTypographyRoles.TYPE_SEARCH_RESULT_AUTHOR.fontFamily);
      assert.equal(author.fontSize,10.5);
      const intro=texts().find(node=>node.create===book.intro),chapter=texts().find(node=>String(node.create).includes(book.latestChapterTitle));
      if(input.category==='novel'&&input.intro){assert.ok(intro);assert.equal(intro.maxLines,2);assert.equal(chapter,undefined);}
      else{assert.ok(chapter);assert.equal(chapter.maxLines,1);if(input.intro)assert.equal(intro,undefined);}
      const footer=nodes().find(node=>node.type==='Flex');assert.equal(footer.create.wrap,'FlexWrap.Wrap');
      const info=nodes().find(node=>node.type==='Column'&&node.layoutWeight===1);
      assert.equal(info.justifyContent,'FlexAlign.SpaceBetween');assert.equal(info.height,undefined);
      assert.equal(info.constraintSize.minHeight,SEARCH_RESULT_GEOMETRY.coverWidth(326,false)*1.5);
      if(input.sourceId!=='local'){
        const name=texts().find(node=>node.create===book.sourceName),count=texts().find(node=>node.create==='发现 5 个来源');
        assert.ok(name&&count);assert.ok(texts().indexOf(name)<texts().indexOf(count));
        assert.equal(count.border,undefined);assert.equal(count.padding,undefined);assert.equal(count.fontWeight,400);
        assert.equal(count.fontFamily,readerTypographyRoles.TYPE_SEARCH_RESULT_TAG.fontFamily);
        assert.equal(count.fontColor,readerAppColor('app.search.discoveredSource','day'));
      }else assert.ok(texts().some(node=>node.create==='本地书籍'));
      let chosen;owner.onSelectResult=(selected,variants)=>{chosen={selected,variants};};
      nodes().find(node=>node.type==='Row'&&node.onClick).onClick({source:'keyboard'});
      assert.equal(chosen.selected.latestChapterTitle,book.latestChapterTitle,'list budget never strips detail metadata');
      assert.equal(chosen.selected.intro,book.intro);assert.notEqual(chosen.variants[0],book);
      assert.deepEqual(chosen.variants[0],searchBookSnapshot(book),'selection preserves a copied business snapshot');
    }
  }else{
    const {ReaderMeasurementStore}=await import('../entry/src/main/ets/features/common/ReaderMeasurements.ts');
    const {readerScaledControlHeight}=await import('../entry/src/main/ets/features/common/ReaderSurfaceResolvers.ts');
    const {createArkUIPropertyRuntimeProbe}=await import('./lib/arkui-property-runtime-probe.mjs');
    const {SurfaceWidthSpec,resolveHorizontalFrame}=await import('../entry/src/main/ets/features/common/SurfaceHorizontalGeometry.ts');
    const {foundationSpecs}=await import('./lib/reader-foundation-control-probe.mjs');
    const {pureModuleProbe}=await import('./lib/ets-pure-module-probe.mjs');
    const metrics={windowRect:{width:390,height:844},systemFontScale:1,densityPixels:3.5};
    const specs=readerSurfaceSpecsForProbe(metrics),controls=foundationSpecs();
    const sheetChrome=pureModuleProbe(read('features/common/ReaderSheetChrome.ets'),'ReaderSheetChrome.ets',{...specs,readerAppColor,SurfaceWidthSpec,resolveHorizontalFrame},['readerSheetWidth','readerSheetChrome']);
    const action=pureModuleProbe(read('features/common/ReaderActionAccessibility.ets'),'ReaderActionAccessibility.ets',{},['READER_ACTION_MIN_TARGET','readerActionTouchRegion']);
    const budgets=pureModuleProbe(read('features/common/ReaderSurfaceBudgets.ts'),'ReaderSurfaceBudgets.ts',{},['readerSheetBodyBudget']);
    const sdk=searchBoundedSdk(metrics);let closed=0;
    const header=sdk.consumer('ReaderBoundedSurfaceHeader',
      {specId:'search-result-filter',title:'筛选',onClose:()=>closed++});
    header.initialRender();const hnodes=sdk.nodes(header),hTitle=hnodes.find(node=>node.type==='Text'&&node.create==='筛选');
    assert.equal(hTitle.fontSize,16);assert.equal(hTitle.lineHeight,24);assert.equal(hTitle.fontFamily,'ReaderNotoSansSCUIMedium');
    const close=hnodes.find(node=>node.type==='Row'&&node.width===44&&node.height===44&&node.onClick);
    assert.ok(close);close.onClick();assert.equal(closed,1);header.actionEnabled=false;header.replay();close.onClick();assert.equal(closed,1);
    for(const specId of ['search-result-filter','search-task-status']){
      const content=sdk.consumer('ReaderBoundedSurface', {specId});
      content.initialRender();
      const frame=sdk.nodes(content).find(node=>node.type==='Column'&&node.width==='100%');
      assert.ok(frame);
      for(const prop of ['backgroundColor','border','borderRadius','shadow'])assert.equal(frame[prop],undefined,
        'native sheet alone owns '+prop+'; content cannot add a second frame');
    }
    class Port{constructor(owner,params,_storage,id){Object.assign(this,{owner,params,id});}}
    class Chrome{constructor(paper,tone,ink){Object.assign(this,{underlayColor:paper,tone,contentColor:ink});}}
    const taskSource=read('features/search/ReaderSearchTaskPanel.ets');
    const properties=createArkUIPropertyRuntimeProbe(),chrome=[],dismissed=[];
    const taskFixture=createReaderComponentProbe(taskSource,builderComponentMembers(taskSource),{...searchSheetSdkInputs(metrics),...properties.sdk,...specs,...action,...sheetChrome,...budgets,
      ...readerMessageStyles,readerAppColor,ReaderButton:Port,ReaderBoundedSurface:Port,ReaderBoundedSurfaceHeader:Port,
      SurfaceWidthSpec,resolveHorizontalFrame,ReaderWindowChromeStyle:Chrome,readerPageAreaLength:Number,
      ReaderWindowCoordinator:{metrics:()=>metrics,requestOverlayChrome:value=>chrome.push(value),requestAppChrome:()=>chrome.push('app')},
      readerVisualSafeLeft:()=>0,readerVisualSafeRight:()=>0,readerVisualSafeTop:()=>24,readerVisualSafeBottom:()=>20,
      readerScrimmedOpaqueColor:(paper,mask)=>`${paper}+${mask}`,SheetSize:{FIT_CONTENT:'FIT_CONTENT'},SheetType:{BOTTOM:'BOTTOM'},DismissReason:{PRESS_BACK:'BACK'},
    },{...properties.hooks,childSources:{ReaderButton:read('features/common/ReaderButton.ets'),ReaderBoundedSurface:read('features/common/ReaderBoundedSurface.ets'),ReaderBoundedSurfaceHeader:read('features/common/ReaderBoundedSurfaceHeader.ets')}});
    const task=taskFixture.owner;Object.assign(task,{expanded:true,presentationIdentity:'page:query:1',retryIdentity:'operation:1',triggerWidth:274,
      progressText:'已处理 6/10 个书源',statusLabel:'',searching:true,failed:2,skipped:3,failedText:'2 个书源本次搜索失败。',skippedText:'已跳过 3 个暂不可用的书源。',canRetry:false,onDismiss:id=>dismissed.push(id)});
    task.aboutToAppear();task.initialRender();
    let nodes=[...task.nodes.values()];const trigger=nodes.find(node=>node.type==='Row'&&node.bindSheet);
    assert.ok(trigger);assert.equal(typeof trigger.bindSheet[1],'object');assert.equal(trigger.bindSheet[2].preferType,'BOTTOM');
    assert.deepEqual(trigger.bindSheet[2].shadow,specs.readerSurfaceElevation('sheet','day'));
    assert.equal(trigger.bindSheet[2].enableOutsideInteractive,false);
    const options=trigger.bindSheet[2];options.onWillAppear();assert.equal(chrome[0].tone,'dark');assert.ok(chrome[0].navigationUnderlayColor);
    task.sheetContent();const surface=[...task.children.values()].find(child=>child.params.specId==='search-task-status');assert.ok(surface);
    task.details('page:query:1');assert.ok([...task.nodes.values()].some(node=>node.type==='Text'&&node.create==='2 个书源本次搜索失败。'));
    assert.ok(![...task.children.values()].some(child=>child.params.specId==='search-retry-progress'),'active task does not mount disabled retry');
    task.failed=8;task.failedText='8 个书源本次搜索失败。';task.replay();
    assert.ok([...task.nodes.values()].some(node=>node.type==='Text'&&node.create==='8 个书源本次搜索失败。'),'mounted details read latest Prop facts');
    let retries=0;task.searching=false;task.canRetry=true;const retired=task.retryAction('page:query:1','operation:1',()=>retries++);
    retired();assert.equal(retries,1);task.retryIdentity='operation:2';retired();assert.equal(retries,1);
    task.retryIdentity='operation:1';task.canRetry=false;retired();assert.equal(retries,1);
    task.presentationIdentity='page:query:2';options.onWillDismiss({reason:'BACK',dismiss:()=>{throw Error('retired native callback');}});assert.deepEqual(dismissed,[]);
    task.presentationIdentity='page:query:1';options.onAppear();options.onWillDismiss({reason:'BACK',dismiss:()=>{}});assert.deepEqual(dismissed,['page:query:1']);
    const {ALL_SEARCH_SOURCE_GROUP,searchSourceGroupKey}=await import('../entry/src/main/ets/features/search/SearchSourceGroups.ts');
    const Page=selectedProductionMethods(file('features/search/SearchPage.ets'),'SearchPage',
      ['acceptsFilterAction','filterActionIdentity','filterPresentationIdentity','applySearchFilters'],{ALL_SEARCH_SOURCE_GROUP,searchSourceGroupKey});
    const owner=new Page();let reset=0,publish=0;Object.assign(owner,{ownsPageQuery:()=>true,filtersExpanded:true,pageEpoch:1,filterGeneration:2,filterStepGeneration:0,
      viewState:new SearchViewState(),filterStep:'filter',hasSourceGroupCatalog:true,
      sourceGroupDirectory:()=>({valid:()=>true}),resetFilteredResults:()=>reset++,publishSurface:()=>publish++,
      getUIContext:()=>({getFocusController:()=>({clearFocus(){}})})});
    owner.applySearchFilters('在线','漫画',ALL_SEARCH_SOURCE_GROUP,owner.filterActionIdentity());
    assert.equal(reset,1);assert.equal(publish,1);assert.equal(owner.filtersExpanded,false);assert.equal(owner.viewState.filtersExpanded,false);
    assert.equal(owner.selectedGroupName,'在线');assert.equal(owner.selectedContentType,'漫画');
    owner.applySearchFilters('全部','小说',ALL_SEARCH_SOURCE_GROUP,owner.filterActionIdentity());assert.equal(reset,1,'closed presentation cannot commit twice');
    const filterSource=read('features/search/ReaderSearchFilterPanel.ets'),filterProps=createArkUIPropertyRuntimeProbe();
    const shared=read('features/common/ReaderFilterControls.ets');
    const focusFrame=searchFilterSdkDeclarations(filterSource);
    const filter=createReaderComponentProbe(filterSource,builderComponentMembers(filterSource),{...searchSheetSdkInputs(metrics),...filterProps.sdk,...specs,...controls,...sheetChrome,
      ...readerTypographyRoles,ReaderMeasurementStore,readerScaledControlHeight,ALL_SEARCH_SOURCE_GROUP,searchSourceGroupKey,ReaderButton:Port,ReaderIconButton:Port,ReaderSearchField:Port,ReaderPageState:Port,ReaderFilterTrigger:Port,ReaderFilterGroupRow:Port,ReaderFilterFooter:Port,
      ReaderBoundedSurface:Port,ReaderBoundedSurfaceHeader:Port,...focusFrame,
      ReaderWindowChromeStyle:Chrome,ReaderWindowCoordinator:{metrics:()=>metrics},
      readerVisualSafeLeft:()=>0,readerVisualSafeRight:()=>0,readerVisualSafeTop:()=>24,readerVisualSafeBottom:()=>20,readerPageAreaLength:Number,
      readerAppColor,SheetSize:{FIT_CONTENT:'FIT_CONTENT'},SheetType:{BOTTOM:'BOTTOM'},DismissReason:{PRESS_BACK:'BACK'},
    },{...filterProps.hooks,childSources:{ReaderButton:read('features/common/ReaderButton.ets'),ReaderFilterTrigger:shared,ReaderFilterGroupRow:shared,
      ReaderFilterFooter:shared,ReaderIconButton:read('features/common/ReaderIconButton.ets'),ReaderSearchField:read('features/common/ReaderSearchField.ets'),ReaderPageState:read('features/common/ReaderPageState.ets'),ReaderBoundedSurface:read('features/common/ReaderBoundedSurface.ets'),ReaderBoundedSurfaceHeader:read('features/common/ReaderBoundedSurfaceHeader.ets')}}).owner;
    filter.getUIContext=()=>({postFrameCallback:frame=>frame.onFrame(0)});
    const applied=[];Object.assign(filter,{expanded:true,presentationIdentity:'filter:1',actionIdentity:'filter:1:step',appliedGroup:'在线',
      onApply:(...args)=>{applied.push(args);filter.expanded=false;},getUIContext:()=>({postFrameCallback:frame=>frame.onFrame(0)})});
    filter.aboutToAppear();filter.beginDraft('filter:1');filter.filterFooter('filter:1:step');
    metrics.systemFontScale=1.6;filter.groupValue('filter:1:step');
    const valueText=[...filter.nodes.values()].find(node=>node.type==='Text'&&node.create==='全部分组');
    assert.ok(valueText);assert.equal(valueText.fontSize,14);assert.equal(valueText.lineHeight,21);assert.equal(valueText.fontWeight,400);assert.equal(valueText.maxFontScale,1.6);
    metrics.systemFontScale=2;assert.equal(filter.headerHeight(),48+12,'header fallback follows the current system scale');metrics.systemFontScale=1;
    const filterOptions=filter.sheetOptions('filter:1'),filterSpec=specs.resolveSheetSpec('search-result-filter');
    assert.equal(filterOptions.preferType,'BOTTOM');assert.equal(filterOptions.enableOutsideInteractive,false);
    assert.deepEqual(filterOptions.shadow,specs.readerSurfaceElevation('sheet','day'));
    assert.equal(filterOptions.backgroundColor,readerAppColor(filterSpec.hostBackgroundRole,'day'));
    assert.equal(filterOptions.maskColor,readerAppColor(filterSpec.hostMaskRole,'day'));
    assert.deepEqual(filterOptions.borderWidth,{top:filterSpec.hostBorderWidth});
    const footer=[...filter.children.values()].find(child=>child.params.onApply);assert.ok(footer);assert.equal(footer.params.resetEnabled,true);
    footer.params.onReset();assert.equal(filter.draftGroup,'全部');assert.deepEqual(applied,[],'reset remains local');
    footer.params.onApply();footer.params.onApply();assert.equal(applied.length,1,'parent success closes the presentation before another apply');
    filter.presentationIdentity='filter:2';footer.params.onApply();assert.equal(applied.length,1,'old footer cannot apply a new presentation');
  }
  recordContractCasePass(selected);
}
} finally { resolver.deregister(); }
}
