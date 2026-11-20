import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire, registerHooks } from 'node:module';
import { fileURLToPath } from 'node:url';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

const selected=selectContractCases({
  'sdk-budget':'Actual SDK Tab/native text, toolbar/list/footer parent viewports at 320/366 x 1/1.3/1.6/2, Quick/Full and intermediate p. The extra 3.2 point exceeds the 44vp line box. No native rendering proof.',
  'short-slots':'Authored fixed-branch geometry under short upstream slots reports geometric insufficiency and rejects incomplete toolbar actions. Actual short composition is separately exercised by short-sdk; no native rendering.',
  'negative-budget':'Actual SDK negative controls reject old overlapping coordinates, missing parent clips, active partial toolbar, unguarded callbacks, inconsistent list reservation and missing text growth.',
});
if(selected.length){
  const productionRoot=new URL('../entry/src/main/ets/',import.meta.url).href;
 const resolver=registerHooks({resolve(specifier,context,next){if(context.parentURL?.startsWith(productionRoot)&&specifier.startsWith('.')&&!/\.[a-z]+$/i.test(specifier))return next(specifier+'.ts',context);return next(specifier,context);}});
 try {
 const {resolveEtsLoaderRoot}=await import('./lib/tool-environment.mjs');
  const {createReaderComponentProbe}=await import('./lib/reader-component-probe.mjs');
  const {directoryControlSdk,directorySdkDeclarations,directoryControlFault}=await import('./lib/directory-control-sdk-probe.mjs');
  const {pureModuleProbe}=await import('./lib/ets-pure-module-probe.mjs');
  const {readerControlNativeTree}=await import('./fixtures/reader-control-native-tree.mjs');
  const {sampleReaderControlMotionPresentation}=await import('../entry/src/main/ets/features/reading/ReaderControlMotionPresentation.ts');
  const {sampleReaderControlBookmark}=await import('../entry/src/main/ets/features/reading/ReaderControlBookmarkGeometry.ts');
  const {resolveReaderControlDirectoryGeometry}=await import('../entry/src/main/ets/features/reading/ReaderControlDirectoryGeometry.ts');
  const windowMetrics=await import('../entry/src/main/ets/features/common/ReaderWindowMetrics.ts');
  const widthClass=await import('../entry/src/main/ets/features/common/ReaderWidthClass.ts');
  const {resolveReaderControlLayout}=pureModuleProbe(readFileSync(new URL('../entry/src/main/ets/features/reading/ReaderLayoutGeometry.ts',import.meta.url),'utf8'),
    'ReaderLayoutGeometry.ts',{...windowMetrics,...widthClass},['resolveReaderControlLayout']);
  const {readerControlMotionBounds,sampleReaderControlMotionComposition}=await import('../entry/src/main/ets/features/reading/ReaderControlMotionGeometry.ts');
  const {readerControlDirectoryFrame}=await import('../entry/src/main/ets/features/reading/ReaderControlHeaderGeometry.ts');
  const {createDefaultReaderWindowMetrics}=await import('../entry/src/main/ets/features/common/ReaderWindowMetrics.ts');
  const read=name=>readFileSync(new URL('../entry/src/main/ets/features/'+name,import.meta.url),'utf8');
  const source=read('reading/ReaderControlDirectoryContent.ets'),toolbarSource=read('reading/ReaderDirectoryToolbar.ets'),fieldSource=read('common/ReaderSearchField.ets');
  const {readerReadableFontScale,readerScaledControlHeight}=pureModuleProbe(read('common/ReaderSurfaceResolvers.ts'),'ReaderSurfaceResolvers.ts',{},['readerReadableFontScale','readerScaledControlHeight']);
  const {READER_DIRECTORY_TOOLBAR_HEIGHT}=directorySdkDeclarations(toolbarSource,'ReaderDirectoryToolbar.ets');
  const require=createRequire(import.meta.url),componentMap=require(resolveEtsLoaderRoot()+'/lib/component_map.js');
  const compile=body=>{const ids=componentMap.ID_ATTRS,saved=new Map(ids);ids.clear();try{return body();}finally{ids.clear();for(const[key,value]of saved)ids.set(key,value);}};
  const near=(actual,expected,message)=>assert(Math.abs(actual-expected)<1e-8,`${message}: ${actual} vs ${expected}`);
  const members=['build','directoryToolbar','tabButton','value','fontScale','queryGrowth','tabHeight','contentGeometry','toolbarInteractive','tabsInteractive','rowHeight','rowWidth','rowPadding','listTop','listHeight','presentation','tabWidth','currentContent','directoryFocusId','onDirectoryFocus'];
  function setup({width=320,scale=1,progress=1,tab='directory',height=190+476*progress,interaction=true,text=source}={}){
    const sdk=directoryControlSdk(),tree=readerControlNativeTree(['Stack','Row','Column','Text']),children=[],calls=[];
    class Toolbar{constructor(owner,params,_storage,id){Object.assign(this,{owner,params,id});children.push(this);}initialRender(){}updateStateVars(next){Object.assign(this.params,next);}}
    const accessibility=pureModuleProbe(read('common/ReaderActionAccessibility.ets'),'ReaderActionAccessibility.ets',{AccessibilityRoleType:{BUTTON:'button'}},['readerActionTouchRegion','ReaderActionAccessibility']);
    const deps={...sdk.deps,...tree.dependencies,...accessibility,HitTestMode:{Default:'HitTestMode.Default',None:'HitTestMode.None'},readerReadableFontScale,readerScaledControlHeight,resolveReaderControlDirectoryGeometry,
      sampleReaderControlBookmark,sampleReaderControlMotionPresentation,ReaderDirectoryToolbar:Toolbar,ReaderWindowCoordinator:{metrics:()=>({systemFontScale:scale})}};
    const {owner}=compile(()=>createReaderComponentProbe(text,members,deps,{...sdk.hooks,...tree.hooks,childSources:{ReaderDirectoryToolbar:toolbarSource}}));
    Object.assign(owner,{readerWindowMetricsRevision:1,availableWidth:width-40,availableHeight:height,progress,tab,mounted:true,
      interactionEnabled:interaction,shortContent:false,layoutPresentation:0,sessionKey:'budget',directoryInputFocused:false,directoryFocusRevision:0,directoryRestoreKeyboard:true,appThemeScheme:'day',cachedPaint:undefined,paintProgress:-1,draft:'',ascending:true,
      snapshot:{currentTitle:'当前章',currentPosition:'21/60'},listBody(){},placeholder:()=>tab==='directory'?'搜索章节名称':'搜索书签内容',
      onTabChange:value=>calls.push('tab-'+value),search:()=>calls.push('search'),sort:()=>calls.push('sort'),scrollCatalogEdge:bottom=>calls.push(bottom?'bottom':'top')});
    owner.initialRender();assert.equal(tree.remaining(),0,'real SDK parent create/pop are balanced');
    return{owner,sdk,tree,children,calls,deps,nodes:[...owner.nodes.values()]};
  }
  function budget(view){
    const{owner,nodes}=view,g=owner.contentGeometry(),h=owner.availableHeight,p=owner.progress;
    const root=nodes.find(n=>n.type==='Stack'&&n.parentId===undefined),toolbar=nodes.find(n=>n.type==='Stack'&&n.enabled!==undefined&&n.position?.y===g.toolbarTop),
      list=nodes.find(n=>n.type==='Stack'&&n.clip===true&&n.position?.x===1&&n.opacity!==undefined&&n.hitTestBehavior===undefined),
      footer=nodes.find(n=>n.type==='Stack'&&n.clip===true&&n.position?.x===1&&n.hitTestBehavior===view.deps.HitTestMode.None&&n.enabled===undefined);
    assert(root&&toolbar&&list,'actual production root, toolbar reveal and List viewport exist');
    near(root.height,h,'root height');near(list.position.y,g.listTop,'actual List top');near(list.height,g.listHeight,'actual List height');
    near(list.position.y+list.height+g.footerReservation,h,'parent exact sum');
    assert.equal(toolbar.clip,true,'toolbar child must be clipped to its real reveal viewport');
    near(toolbar.position.y,g.toolbarTop,'toolbar source path with necessary clearance');near(toolbar.height,g.toolbarViewportHeight,'toolbar actual visible extent');
    if(toolbar.height>0)assert(toolbar.position.y+toolbar.height<=list.position.y+1e-8,'toolbar visible extent does not cover List');
    else {assert.equal(toolbar.height,0);assert.equal(toolbar.enabled,false,'zero reveal has no interaction or occupied visible extent');}
    assert.equal(toolbar.enabled,owner.toolbarInteractive());assert.equal(toolbar.hitTestBehavior,owner.toolbarInteractive()?view.deps.HitTestMode.Default:view.deps.HitTestMode.None);
    assert.equal(toolbar.accessibilityLevel,owner.toolbarInteractive()?'auto':'no-hide-descendants','partial/disabled toolbar cannot expose descendants through accessibility');
    const controls=nodes.filter(n=>n.type==='Stack'&&(n.accessibilityText==='章节'||n.accessibilityText==='书签'));
    assert.equal(controls.length,2);
    for(const control of controls){const parent=owner.nodes.get(control.parentId);near(parent.position.y,g.tabTop,'tab original y path');near(control.height,g.tabHeight,'actual tab target height');near(control.responseRegion.height,control.height,'no external hit expansion');
      const actualBottom=parent.position.y+control.height;assert(Math.min(h,actualBottom)<=list.position.y+1e-8,'Tab visible bottom is before List');
      if(toolbar.height>0)assert(actualBottom<=toolbar.position.y+1e-8,'Tab and Toolbar viewports do not overlap');
    }
    const labels=nodes.filter(n=>n.type==='Text'&&(n.create==='章节'||n.create==='书签'));
    assert.equal(labels.length,2);for(const label of labels){assert.equal(label.maxFontScale,owner.fontScale());assert.equal(label.lineHeight,view.deps.TYPE_READER_DIRECTORY_TAB_COMPACT.lineHeightFp);assert(label.lineHeight*owner.fontScale()<=g.tabHeight);}
    const mainDivider=nodes.find(n=>n.type==='Row'&&n.position?.y===g.dividerTop);assert(mainDivider,'main divider follows actual Tab bottom');
    if(g.footerViewportHeight>0){assert(footer,'informational summary has its actual bounded parent');near(footer.height,g.footerViewportHeight,'summary reveal height');near(footer.position.y,list.position.y+list.height,'summary starts at List end');assert.equal(footer.clip,true);assert.equal(footer.hitTestBehavior,view.deps.HitTestMode.None);
      const content=nodes.find(n=>n.type==='Column'&&n.parentId===footer.id);assert(content);near(content.height,48,'original summary actor height');near(footer.position.y+content.position.y,h-49+24*(1-p),'summary glyph absolute source trajectory retained');near(footer.position.y+footer.height,h-1,'summary bottom inset');
    }else assert.equal(footer,undefined,'no hidden summary still paints over a short List');
    return{g,toolbar,list,footer};
  }
  function childToolbar(scale){
    const sdk=directoryControlSdk(),tree=readerControlNativeTree(['Row','Stack']);
    class Query{constructor(owner,params){Object.assign(this,{owner,params});}initialRender(){}updateStateVars(next){Object.assign(this.params,next);}}
    const{owner}=compile(()=>createReaderComponentProbe(toolbarSource,['build','tool','queryHeight','toolbarBody','currentDirectoryInput','directoryMounted','directoryFocusId','directoryFocusAllowed','directoryFocusRevision','directoryFocusCurrent','directoryKeyboardOnFocus','onDirectoryFocusChanged'],{...sdk.deps,...tree.dependencies,READER_DIRECTORY_TOOLBAR_HEIGHT,
      ReaderSearchField:Query,readerReadableFontScale,readerScaledControlHeight,ReaderWindowCoordinator:{metrics:()=>({systemFontScale:scale})}},
      {...sdk.hooks,...tree.hooks,childSources:{ReaderSearchField:fieldSource}}));
    Object.assign(owner,{readerWindowMetricsRevision:1,showChapterTools:true,appThemeScheme:'day',ascending:true,onTextChange(){},onSearch(){},onTop(){},onBottom(){},onToggleSort(){}});owner.initialRender();
    const root=[...owner.nodes.values()].find(n=>n.type==='Row'&&n.parentId===undefined);assert(root);near(root.height,50+readerScaledControlHeight(44,24,scale)-44,'real shared toolbar child height');return root.height;
  }
  async function sdkBudget(){
    let samples=0;for(const width of[320,366])for(const scale of[1,1.3,1.6,2,3.2])for(const tab of['directory','bookmarks']){
      const realChildHeight=childToolbar(scale);let previous;
      for(const progress of[0,.125,.25,.5,.75,.875,1]){const v=setup({width,scale,tab,progress});const {g}=budget(v);samples++;
        near(g.toolbarHeight,realChildHeight+2,'actual toolbar child fits retained 52vp local actor');
        near(g.toolbarTop,61-18*progress+7*progress+v.owner.tabHeight()-44,'preserve authored toolbar path plus real clearance');
        if(previous){assert(g.nominalListTop>previous.nominalListTop,'List path remains continuous and monotone');}
        previous=g;
        if(progress===0){near(g.tabTop,tab==='directory'?13:12,'original Quick tab y');near(g.listTop,(tab==='directory'?62:61)+v.owner.tabHeight()-44,'corrected Quick List');assert.equal(g.toolbarViewportHeight,0);assert.equal(v.owner.toolbarInteractive(),false);}
        if(progress===1){near(g.tabTop,6,'original Full tab y');near(g.listTop,106+v.owner.queryGrowth()+v.owner.tabHeight()-44,'corrected Full List');assert.equal(v.owner.toolbarInteractive(),true);}
        const callbacks=v.children[0].params;callbacks.onTextChange('updated');callbacks.onSearch();callbacks.onTop();callbacks.onBottom();callbacks.onToggleSort();
        assert.deepEqual(v.calls,progress===1?['search','top','bottom','sort']:[]);assert.equal(v.owner.draft,progress===1?'updated':'');
        v.owner.interactionEnabled=false;callbacks.onSearch();assert.equal(v.calls.length,progress===1?4:0,'old callback obeys current motion/input owner');v.owner.interactionEnabled=true;v.owner.mounted=false;callbacks.onSearch();assert.equal(v.calls.length,progress===1?4:0);
      }
      for(let p=0;p<=1;p+=.01){const a=resolveReaderControlDirectoryGeometry(p,tab,190+476*p,readerScaledControlHeight(44,16,scale),readerScaledControlHeight(44,24,scale)-44,44),b=resolveReaderControlDirectoryGeometry(p+1e-7,tab,190+476*(p+1e-7),readerScaledControlHeight(44,16,scale),readerScaledControlHeight(44,24,scale)-44,44);assert(Math.abs(a.listTop-b.listTop)<.001);assert(Math.abs(a.toolbarTop-b.toolbarTop)<.001);}
    }console.log(JSON.stringify({kind:'control-directory-budget-samples',samples,scope:'SDK declared geometry; no native paint/focus/touch'}));
  }
  async function shortSlots(){
    for(const width of[320,366])for(const tab of['directory','bookmarks'])for(const height of[190,120,80,0]){
      const view=setup({width,tab,height,progress:1,scale:2});const{g,toolbar}=budget(view);
      if(tab==='directory'&&height===190){assert.equal(g.listHeight,44);assert.equal(g.rowShortfall,20);assert.equal(g.wholeRowFits,false);assert.equal(g.footerReservation,0);assert.equal(g.footerViewportHeight,0);}
      if(height<g.toolbarTop+g.toolbarHeight){assert.equal(toolbar.enabled,false);assert.equal(g.toolbarComplete,false);view.children[0].params.onSearch();assert.deepEqual(view.calls,[]);}
      if(height<g.nominalListTop){assert(g.headerShortfall>0);assert.equal(g.listHeight,0);assert.equal(g.wholeRowFits,false);}
    }
    // The same production layout/motion/header adapter used by Panel and the
    // native fixture, including a real short landscape window. No min-height
    // guarantee is invented for the full slot.
    for(const[windowWidth,windowHeight]of[[320,366],[366,320],[320,844],[366,844]]){
      const metrics=createDefaultReaderWindowMetrics();metrics.systemFontScale=2;metrics.windowRect.width=windowWidth;metrics.windowRect.height=windowHeight;
      const layout=resolveReaderControlLayout(windowWidth,windowHeight,false,metrics),full=Math.min(layout.fullPanelHeight,736),bounds=readerControlMotionBounds(layout.fullPanelWidth,full,layout.dockBottomGap,Math.min(full,330));
      const frame=readerControlDirectoryFrame(sampleReaderControlMotionComposition({visibilityProgress:1,expansionProgress:1},bounds),2);
      const v=setup({width:windowWidth,scale:2,progress:1,height:frame.content.height});const{g}=budget(v);assert.equal(v.owner.availableHeight,frame.content.height);
      if(windowHeight<400)assert.equal(g.wholeRowFits,false,'real short Full input is an explicit row shortfall, not whole-page PASS');
      console.log(JSON.stringify({kind:'control-directory-upstream-slot',windowWidth,windowHeight,height:frame.content.height,listHeight:g.listHeight,rowShortfall:g.rowShortfall,wholeRowFits:g.wholeRowFits}));
    }
  }
  async function negativeBudget(){
    const fault=kind=>directoryControlFault(source,kind);
    assert.throws(()=>budget(setup({text:fault('old-list-top'),progress:0})),/List|Tab/);
    assert.throws(()=>budget(setup({text:fault('old-toolbar-top'),progress:1})),/toolbar|Tab/);
    assert.throws(()=>budget(setup({text:fault('missing-toolbar-clip'),progress:.5})),/clipped/);
    assert.throws(()=>budget(setup({text:fault('active-partial-toolbar'),progress:.5})),/false|equal/);
    const v=setup({text:fault('unguarded-search-callback'),progress:.5});v.children[0].params.onSearch();assert.notDeepEqual(v.calls,[],'unguarded callback remains observable');
    assert.throws(()=>budget(setup({text:fault('wrong-list-reservation'),progress:.5})),/List height|exact sum/);
    assert.throws(()=>budget(setup({text:fault('missing-tab-growth'),scale:3.2,progress:1})),/assert|false|expression/);
    assert.throws(()=>budget(setup({text:fault('missing-footer-clip'),progress:.5})),/summary|clipped|bounded/);
  }
  const cases={'sdk-budget':sdkBudget,'short-slots':shortSlots,'negative-budget':negativeBudget};for(const id of selected){await cases[id]();recordContractCasePass(id);}
 } finally { resolver.deregister(); }
}
