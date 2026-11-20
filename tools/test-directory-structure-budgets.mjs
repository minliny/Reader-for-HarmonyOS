import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';
const selected = selectContractCases({ 'scale-targets': 'Actual SDK directory field/bookmark/collapse carriers and real parent budgets at 320/366 x 1/1.3/1.6/2; no native glyph/hit evidence.' });
if (selected.length) {
 const {registerHooks}=await import('node:module');
 const productionRoot=new URL('../entry/src/main/ets/',import.meta.url).href;
 const resolver=registerHooks({resolve(specifier,context,next){if(context.parentURL?.startsWith(productionRoot)&&specifier.startsWith('.')&&!/\.[a-z]+$/i.test(specifier))return next(specifier+'.ts',context);return next(specifier,context);}});
 try {
 const {createReaderComponentProbe}=await import('./lib/reader-component-probe.mjs');
 const {builderComponentMembers}=await import('./lib/ets-builder-probe.mjs');
 const {directoryControlSdk,directorySdkDeclarations}=await import('./lib/directory-control-sdk-probe.mjs');
 const {pureModuleProbe}=await import('./lib/ets-pure-module-probe.mjs');
 const {selectedProductionMethods,selectedProductionValues}=await import('./lib/selected-production-methods.mjs');
 const {sampleReaderControlBookmark}=await import('../entry/src/main/ets/features/reading/ReaderControlBookmarkGeometry.ts');
 const {readerControlDirectoryFrame,readerControlHeaderFrame}=await import('../entry/src/main/ets/features/reading/ReaderControlHeaderGeometry.ts');
 const {resolveReaderControlDirectoryGeometry}=await import('../entry/src/main/ets/features/reading/ReaderControlDirectoryGeometry.ts');
 const headerMetrics=await import('../entry/src/main/ets/features/common/ReaderHeaderMetrics.ts');
 const {ReaderMeasurementStore}=await import('../entry/src/main/ets/features/common/ReaderMeasurements.ts');
 const read = name => readFileSync(new URL('../entry/src/main/ets/features/' + name, import.meta.url), 'utf8');
  const {readerReadableFontScale,readerScaledControlHeight}=pureModuleProbe(read('common/ReaderSurfaceResolvers.ts'), 'ReaderSurfaceResolvers.ts', {}, ['readerReadableFontScale','readerScaledControlHeight']);
  const rowSource = read('reading/ReaderBookmarkRow.ets'), fieldSource = read('common/ReaderSearchField.ets');
  const toolbarSource = read('reading/ReaderDirectoryToolbar.ets'), chromeSource = read('reading/ReaderPanelChrome.ets');
  const controlSource = read('reading/ReaderControlDirectoryContent.ets');
  const controlFile = new URL('../entry/src/main/ets/features/reading/ReaderControlDirectoryContent.ets', import.meta.url);
  let samples = 0;
  for (const width of [320, 366]) for (const scale of [1, 1.3, 1.6, 2]) {
    const sdk = directoryControlSdk();
    const accessibility = pureModuleProbe(read('common/ReaderActionAccessibility.ets'), 'ReaderActionAccessibility.ets',
      {AccessibilityRoleType:{BUTTON:'button'}}, ['readerActionTouchRegion','ReaderActionAccessibility']);
    const metrics = { systemFontScale: scale };
    const toolbarValues=selectedProductionValues(new URL('../entry/src/main/ets/features/reading/ReaderDirectoryToolbar.ets',import.meta.url),['READER_DIRECTORY_TOOLBAR_HEIGHT']);
    const deps = {...sdk.deps,...toolbarValues, ...accessibility, readerScaledControlHeight, readerReadableFontScale,resolveReaderControlDirectoryGeometry,
      ReaderWindowCoordinator:{metrics:()=>metrics}, sampleReaderControlBookmark, ...selectedProductionValues(new URL('../entry/src/main/ets/features/reading/ReaderBookmarkRow.ets',import.meta.url),['BOOKMARK_PENDING_LABEL','BOOKMARK_ROW_HEIGHT'])};
    const target = directorySdkDeclarations(fieldSource,'ReaderSearchField.ets',{...accessibility,FrameCallback:class {}});
    const fieldNames = ['autoLineHeightField','directoryFontScale','directoryFocusId','directoryFocusAllowed','directoryFocusCurrent','nativeInputBackground','nativeFieldBackground',
      'fieldHeight','inputHeight','textStyle','searchIcon','iconSize','iconGap','horizontalPadding','fieldBackgroundColor',
      'fieldBorderWidth','fieldBorderColor','cornerRadius','inputColor','caretColor','placeholderColor',
      'resolvedAccessibilityLabel','changeText','submit','isBookField'];
    const field = createReaderComponentProbe(fieldSource,fieldNames,{...deps,...target},sdk.hooks).owner;
    const edits=[];
    Object.assign(field,{variant:'readerDirectory',mode:'submit',mounted:true,readerWindowMetricsRevision:1,
      appThemeScheme:'day',placeholder:'搜索章节',accessibilityLabel:'搜索章节',text:'',onTextChange:v=>edits.push(v),onSubmit() {},submitEnabled:true});
    field.autoLineHeightField();
    const input=[...field.nodes.values()].find(n=>n.type==='TextInput');
    assert(input.height>=44);assert.equal(input.height,readerScaledControlHeight(44,24,scale));
    assert(input.responseRegion.height>=44);assert.equal(input.maxFontScale,scale);input.onChange('目录');assert.deepEqual(edits,['目录']);
    const fieldHeight=field.fieldHeight();
    class Query {constructor(owner,params,_storage,id){Object.assign(this,{owner,params,id});}initialRender(){}updateStateVars(next){Object.assign(this.params,next);}}
    const toolbar=createReaderComponentProbe(toolbarSource,['build','toolbarBody','currentDirectoryInput','tool','queryHeight','directoryFocusId','directoryFocusAllowed','directoryFocusRevision','directoryFocusCurrent','directoryMounted','onDirectoryFocusChanged'],{...deps,ReaderSearchField:Query},
      {...sdk.hooks,childSources:{ReaderSearchField:fieldSource}}).owner;
    Object.assign(toolbar,{readerWindowMetricsRevision:1,appThemeScheme:'day',showChapterTools:true,ascending:true,onSearch(){},onTop(){},onBottom(){},onToggleSort(){}});
    toolbar.initialRender();
    assert.equal(toolbar.queryHeight(),fieldHeight);
    const toolbarParent=[...toolbar.nodes.values()].find(n=>n.type==='Row'&&n.height===fieldHeight+6);
    assert(toolbarParent,'toolbar reserves child height plus both 3vp padding edges');
    const {readerFullDirectoryHeights}=pureModuleProbe(read('common/ReaderSurfaceBudgets.ts'),'ReaderSurfaceBudgets.ts',{readerScaledControlHeight},['readerFullDirectoryHeights']);
    const Panel=selectedProductionMethods(new URL('../entry/src/main/ets/features/reading/FullDirectoryPanel.ets',import.meta.url),
      'FullDirectoryPanel',['heights','panelHeight','fontScale','panelHeaderHeight','queryHeight','searchControlsHeight','queryStacked','innerWidth','panelWidth','tabStripHeight','tabHeight'],{...deps,readerFullDirectoryHeights});
    const panel=new Panel();Object.assign(panel,{readerWindowMetricsRevision:1,panelHeightOverride:640,panelWidthOverride:width-28,activeTab:'directory',embeddedInControl:false});
    const allocation=panel.heights();
    assert.equal(panel.queryHeight(),fieldHeight);
    assert.equal(allocation.body+panel.panelHeaderHeight()+8,allocation.content);
    assert(allocation.chapterList+panel.tabStripHeight()+panel.searchControlsHeight()+48<=allocation.body,'full directory row/tabs/query/footer all fit the one body');
    assert(allocation.bookmarkList+panel.tabStripHeight()+panel.searchControlsHeight()<=allocation.body,'bookmark body reserves the same query and tabs');
    const Control=selectedProductionMethods(controlFile,'ReaderControlDirectoryContent', ['fontScale','queryGrowth','rowHeight','rowWidth','rowPadding','listTop','listHeight','value','contentGeometry','tabHeight'],deps);
    const control=new Control();Object.assign(control,{readerWindowMetricsRevision:1,availableWidth:width-40,availableHeight:500,progress:1,tab:'directory'});
    assert(control.rowHeight()>=44);assert.equal(control.listTop(),106+fieldHeight-44+control.tabHeight()-44);
    for (const progress of [0,.5,1]) {
      control.progress=progress;
      assert(control.rowHeight()>=44);
      control.tab='bookmarks';
      const f=sampleReaderControlBookmark(progress,control.rowWidth(),scale);
      assert.equal(control.rowHeight(),f.card.height,'ListItem and bookmark actor share one real row extent');
      assert(f.excerpt.y+Math.max(f.excerpt.height,28*scale)<=f.divider.y,'two excerpt lines fit before divider');
      assert(f.divider.y+f.divider.height<=f.card.height);
      const row=createReaderComponentProbe(rowSource,['frame','fontScale','rowHeight','motionBody'],deps,sdk.hooks).owner;
      Object.assign(row,{readerWindowMetricsRevision:1,motionProgress:progress,availableWidth:control.rowWidth(),appThemeScheme:'day',
        row:{chapterTitle:'章节标题',excerpt:'书签正文',positionLabel:'50%',timeLabel:'今天',identityStatus:'pendingConfirmation'},onSelectBookmark(){}});
      row.motionBody();
      const nodes=[...row.nodes.values()];
      const card=nodes.find(n=>n.type==='Stack'&&n.onClick);
      assert.equal(card.height,control.rowHeight());
      for (const label of ['章节标题','书签正文','50%','今天']) assert.equal(nodes.find(n=>n.create===label).maxFontScale,scale);
      if(scale>1.3) {
        assert(nodes.some(n=>n.type==='Row'&&n.position?.y===f.metadata.y&&n.constraintSize?.minHeight===f.metadata.height),'large metadata owns a separate positioned row below title');
        for(const label of ['章节标题','50%','今天'])assert.equal(nodes.filter(n=>n.create===label).length,1);
      }
      control.tab='directory';
    }
    const legacy=createReaderComponentProbe(rowSource,['fontScale','rowHeight','legacyBody'],deps,sdk.hooks).owner;
    Object.assign(legacy,{readerWindowMetricsRevision:1,availableWidth:width-60,appThemeScheme:'day',row:{chapterTitle:'章节标题',excerpt:'书签正文',positionLabel:'50%',timeLabel:'今天',identityStatus:'pendingConfirmation'},onSelectBookmark(){}});
    legacy.legacyBody();
    const legacyNodes=[...legacy.nodes.values()];
    assert.equal(legacyNodes.find(n=>n.onClick).height,sampleReaderControlBookmark(1,width-60,scale).card.height);
    if(scale>1.3)assert.equal(legacyNodes.filter(n=>n.type==='Row').length,3,'full text bookmark also moves metadata off the enlarged title row');
    for(const label of ['章节标题','书签正文','50%','今天'])assert.equal(legacyNodes.filter(n=>n.create===label).length,1);
    const specs=directorySdkDeclarations(chromeSource,'ReaderPanelChrome.ets',sdk.deps);
    const collapse=createReaderComponentProbe(chromeSource,builderComponentMembers(chromeSource,'ReaderPanelCollapseButton'),
      {...deps,...specs,...directorySdkDeclarations(read('common/ReaderPressFeedback.ets'),'ReaderPressFeedback.ets',{readerAppColor:sdk.deps.readerAppColor,Color:{Transparent:'#00000000'}})},{...sdk.hooks,componentName:'ReaderPanelCollapseButton'}).owner;
    let closes=0;Object.assign(collapse,{specId:'control-ui',fontScale:scale,minimumTarget:44,label:'收起',accessibilityLabel:'收起目录',actionEnabled:true,onCollapse:()=>closes++});
    collapse.initialRender();
    const hit=[...collapse.nodes.values()].find(n=>n.onClick);
    assert(hit.width>=44&&hit.height>=44);hit.onClick();assert.equal(closes,1);
    const frame={progress:1,header:{x:13,y:19,width:width-26,height:30},content:{x:13,y:57,width:width-26,height:666},contentSurface:{x:13,y:57,width:width-26,height:666}};
    const adapted=readerControlDirectoryFrame(frame,scale);
    assert.equal(adapted.header.y+14,26,'default icon source ink coordinate remains unchanged');
    assert(adapted.header.y+adapted.header.height<=adapted.content.y);
    assert.equal(frame.header.height,30,'cached source frame is not mutated');
    assert(readerControlHeaderFrame('directory',1,width-26,scale).height>=hit.height);
    assert.equal(readerControlHeaderFrame('search',1,width-26,scale).height,30,'other module header is unchanged');
    const fullSource=read('reading/ReaderFullDirectory.ets');
    const {directoryHeaderSpec}=pureModuleProbe(read('common/ReaderHeaderSpecs.ets'),'ReaderHeaderSpecs.ets',{...sdk.deps,...headerMetrics},['directoryHeaderSpec']);
    const full=createReaderComponentProbe(fullSource,['topBar','fontScale','headerHeight','headerControlHeight','headerMeasurementKey'],deps,sdk.hooks).owner;
    Object.assign(full,{readerWindowMetricsRevision:1,headerSpec:directoryHeaderSpec(),appThemeScheme:'day',bookTitle:'书名',chapterTitle:'当前章节',offlineBookOperationActive:false,directoryRecovery:{offlineBlocked:false},
      isLocalBook:()=>false,topBarLeft:()=>14,topBarRight:()=>16,topBarTop:()=>18,liveContainerWidth:()=>width,requestCollapse(){},onSwitchSource(){}});
    full.topBar();
    const fullNodes=[...full.nodes.values()];
    for(const label of ['收起目录','换源','离线管理']) {
      const action=fullNodes.find(n=>n.accessibilityText===label);assert(action.width>=44&&action.height>=44,label+' real target');
    }
    assert.equal(fullNodes.find(n=>n.create==='书名').height,22*scale);
    assert.equal(fullNodes.find(n=>n.create==='当前章节').height,17*scale);
    assert(full.headerHeight()>=22*scale+6+17*scale);
    const dividerWidths=[];const dividerPort={name:'Divider',create(){},color(){},strokeWidth:v=>dividerWidths.push(v),pop(){}};
    const menu=createReaderComponentProbe(fullSource,['offlineBookMenu','fontScale','headerHeight','menuRowHeight','offlineMenuWidth'],{...deps,Divider:dividerPort},sdk.hooks).owner;
    let downloads=0,clears=0;
    Object.assign(menu,{readerWindowMetricsRevision:1,headerSpec:directoryHeaderSpec(),appThemeScheme:'day',mounted:true,offlineMenuVisible:true,offlineBookOperationActive:false,directoryRecovery:{offlineBlocked:false},
      isLocalBook:()=>false,topBarLeft:()=>14,topBarRight:()=>16,topBarTop:()=>18,liveContainerWidth:()=>width,offlineMenuLeft:()=>0,onDownloadBook:()=>downloads++,onClearBookOffline:()=>clears++});
    menu.offlineBookMenu();
    const menuNodes=[...menu.nodes.values()],download=menuNodes.find(n=>n.accessibilityText==='下载整书'),clear=menuNodes.find(n=>n.accessibilityText==='清除本书离线内容');
    assert(download.height>=44&&clear.height>=44);
    assert(menuNodes.some(n=>n.type==='Column'&&n.height===download.height+clear.height+1));assert.equal(dividerWidths[0],1);
    menu.offlineBookOperationActive=true;download.onClick();assert.equal(downloads,0);
    menu.offlineBookOperationActive=false;menu.directoryRecovery.offlineBlocked=true;clear.onClick();assert.equal(clears,0);
    menu.directoryRecovery.offlineBlocked=false;download.onClick();assert.equal(downloads,1);
    menu.mounted=false;clear.onClick();assert.equal(clears,0,'retired menu callback cannot dispatch');
    const oldKey=full.headerMeasurementKey();full.liveContainerWidth=()=>width+8;
    assert.notEqual(full.headerMeasurementKey(),oldKey,'header native width is in the measurement key');
    const measure=createReaderComponentProbe(fullSource,['build','headerMeasurementKey','fontScale','headerHeight'],
      {...deps,ReaderPageScaffold:Query,FullDirectoryPanel:Query,ReaderDirectoryRecoverySurface:Query},{...sdk.hooks,childSources:{ReaderPageScaffold:read('common/ReaderPageScaffold.ets'),FullDirectoryPanel:read('reading/FullDirectoryPanel.ets'),ReaderDirectoryRecoverySurface:read('reading/ReaderDirectoryRecoverySurface.ets')}}).owner;
    Object.assign(measure,{readerWindowMetricsRevision:1,headerMeasurements:new ReaderMeasurementStore(),headerMeasurementRevision:0,mounted:true,
      headerSpec:directoryHeaderSpec(),topBarTop:()=>18,liveContainerWidth:()=>width,frameStyle:()=>({}),pageGeometry:()=>({}),topBar(){},directoryContent(){},directoryOverlay(){}});
    measure.initialRender();
    const receipt=[...measure.children.values()].find(c=>c instanceof Query).params.onHeaderHeightChange;
    const key=measure.headerMeasurementKey();receipt(full.headerHeight(),1);
    assert.equal(measure.headerMeasurements.readForGeneration(key,1,-1),full.headerHeight());
    measure.readerWindowMetricsRevision=2;receipt(999,1);
    assert.equal(measure.headerMeasurements.readForGeneration(key,2,-1),-1,'old font/window receipt cannot seed a new layout generation');
    receipt(full.headerHeight(),2);assert.equal(measure.headerMeasurements.readForGeneration(key,2,-1),full.headerHeight());
    samples++;
  }
  console.log(JSON.stringify({contexts:samples,widths:[320,366],scales:[1,1.3,1.6,2],boundary:'SDK carriers and parent/actor budget only; native glyphs, clipping, focus and pointer delivery not proved'}));
  recordContractCasePass('scale-targets');
 } finally { resolver.deregister(); }
}
