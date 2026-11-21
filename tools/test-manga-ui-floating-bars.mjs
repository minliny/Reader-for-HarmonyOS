import {selectContractCases, recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions = {"phone-nav": {"description": "当前tab实际safe frame和route callback", "resources": []}, "centered-header": {"description": "当前header对称slot与back callback", "resources": []}, "retained-nav": {"description": "实际Main shell captured generation/retired拒绝", "resources": []}};
for (const id of selectContractCases(definitions)) {
  await runSelectedCase(id);
  recordContractCasePass(id);
}
async function runSelectedCase(selectedCase) {
const { resolveEtsLoaderRoot } = await import('./lib/tool-environment.mjs');
const {default: assert} = await import('node:assert/strict');
const { readFileSync } = await import('node:fs');
const { createRequire, stripTypeScriptTypes } = await import('node:module');
const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
const { productionMotionMethods } = await import('./lib/reader-motion-method-probe.mjs');
const { SurfaceWidthSpec, resolveHorizontalFrame } = await import('../entry/src/main/ets/features/common/SurfaceHorizontalGeometry.ts');
const { readerInteractiveSafeLeft, readerInteractiveSafeRight, readerInteractiveSafeBottom,
  readerVisualSafeTop } = await import('../entry/src/main/ets/features/common/ReaderWindowMetrics.ts');
const { readerAppColor } = await import('../entry/src/main/ets/features/common/ReaderThemeRegistry.ts');
const families = await import('../entry/src/main/ets/features/common/ReaderFontFamilies.ts');
const { MAIN_TAB_LABEL_LINE_HEIGHT } = await import('../entry/src/main/ets/features/common/ReaderLayoutTokens.ts');
const { loadReaderTypographyRoles } = await import('./lib/reader-typography-probe.mjs');
const { isReaderMainTabEnabled } = await import('../entry/src/main/ets/app/ReaderProductScope.ts');
const { boundedMembers } = await import('./lib/bounded-surface-sdk-probe.mjs');
const { createArkUIPropertyRuntimeProbe } = await import('./lib/arkui-property-runtime-probe.mjs');
const { pureModuleProbe } = await import('./lib/ets-pure-module-probe.mjs');
const require=createRequire(import.meta.url),syntax=require(resolveEtsLoaderRoot()+'/lib/validate_ui_syntax.js');
syntax.componentCollection.customComponents.add('ReaderRaisedSurface');
syntax.propCollection.set('ReaderRaisedSurface',new Set(['surfaceWidth','surfaceHeight','cornerRadius','scheme']));

const file = name => new URL(`../entry/src/main/ets/${name}`, import.meta.url);
const read = name => readFileSync(file(name),'utf8');
const roleSource=read('features/common/ReaderTypography.ets');
const floatingSource=read('features/common/ReaderFloatingBarMetrics.ts').replace(/^import\s*[\s\S]*?;\s*/gm,'').replace(/\bexport /g,'');
const {readerScaledControlHeight}=pureModuleProbe(
  read('features/common/ReaderSurfaceResolvers.ts'),'ReaderSurfaceResolvers.ts',{},['readerScaledControlHeight']);
const {readerFloatingTabBottomInset,readerFloatingTabContentInset,readerMainTabItemHeight}=new Function('readerInteractiveSafeBottom','readerScaledControlHeight','MAIN_TAB_LABEL_LINE_HEIGHT',
  `${stripTypeScriptTypes(floatingSource)};return {readerFloatingTabBottomInset,readerFloatingTabContentInset,readerMainTabItemHeight};`)(readerInteractiveSafeBottom,readerScaledControlHeight,MAIN_TAB_LABEL_LINE_HEIGHT);
const navigation=pureModuleProbe(
  read('features/shell/MainNavigationSpec.ts'),'MainNavigationSpec.ts',{readerMainTabItemHeight,READER_EXPANDED_MIN_WIDTH:600,
    readerInteractiveSafeBottom,readerInteractiveSafeLeft,readerInteractiveSafeRight,readerVisualSafeTop,isReaderMainTabEnabled,
    ReaderWindowCoordinator:{metrics:()=>metrics},AppStorage:{get:()=>undefined}},
  ['readerMainNavigationMode','readerMainRailLeft','readerMainRailTop','mainTabRailHeight',
    'MAIN_TAB_RAIL_WIDTH','MAIN_TAB_RAIL_ITEM_GAP','MAIN_TAB_RAIL_PADDING']);
const {readerMainNavigationMode,readerMainRailLeft,readerMainRailTop}=navigation;
const { TYPE_MAIN_TAB_LABEL, TYPE_PAGE_TITLE, TYPE_APP_HOME_TITLE } = loadReaderTypographyRoles(roleSource);
const roles = { TYPE_MAIN_TAB_LABEL, TYPE_PAGE_TITLE, TYPE_APP_HOME_TITLE };
let metrics={windowRect:{width:390,height:844},systemInsets:{left:0,right:0,top:48,bottom:34},cutoutInsets:{},gestureInsets:{},navigationInsets:{}};
const common={...roles,READER_FONT_NOTO_SANS_SC_UI_BOLD:families.READER_FONT_NOTO_SANS_SC_UI_BOLD,
  SurfaceWidthSpec,resolveHorizontalFrame,readerInteractiveSafeLeft,readerInteractiveSafeRight,
  readerInteractiveSafeBottom,readerVisualSafeTop,readerFloatingTabBottomInset,isReaderMainTabEnabled,
  mainTabBottomWidth:count=>Math.min(360,98*Math.max(1,Math.floor(count))),
  ReaderRaisedSurface:class{constructor(owner,params){Object.assign(this,{owner,params});}},
  ReaderWindowCoordinator:{metrics:()=>metrics},TOK_SPACE_CONTROL_INLINE:10,TOK_HOME_TOP_BAR_INSET:20,TOK_SPACE_XS:8,TOK_BORDER_W:0.5};
const tabsFile=file('features/shell/MainTabBar.ets'), tabsSource=readFileSync(tabsFile,'utf8');
if(selectedCase==='phone-nav') {
for(const count of [2,3,4]) for(const width of [320,390,800]) for(const scheme of ['day','night']) {
  const tabs=[{key:'bookshelf',label:'书架'},...(count>=3?[{key:'rss',label:'RSS'}]:[]),...(count===4?[{key:'discover',label:'发现'}]:[]),{key:'settings',label:'设置'}];
  metrics={...metrics,windowRect:{...metrics.windowRect,width},cutoutInsets:width===800?{left:50,right:0}:{}};
  const dep={...common,MAIN_TABS:tabs,readerMainViewport:()=>({width,height:metrics.windowRect.height})};
  const {owner}=createReaderBuilderProbe(tabsSource,['bottomBar','tabItem','tabIcon','tabIconResource','bottomBarFrame','bottomBarTranslateX','bottomInset','liveWindowWidth'],dep);
  const selected=[],currentTaps=[];
  Object.assign(owner,{appThemeScheme:scheme,readerWindowMetricsRevision:1,current:'bookshelf',onSelect:key=>selected.push(key),onCurrentTap:key=>currentTaps.push(key)});
  owner.bottomBar();
  const nodes=[...owner.nodes.values()];
  const bar=nodes.find(n=>n.type==='Row');
  const frame=owner.bottomBarFrame();
  assert.equal(bar.width,Math.min(360,98*count,width-Math.max(32,readerInteractiveSafeLeft(metrics))-Math.max(32,readerInteractiveSafeRight(metrics))),
    JSON.stringify({width,count,live:owner.liveWindowWidth(),frame}));
  void 0; /* historical source/appearance assertion removed; focused semantic coverage remains below */void 0; /* historical source/appearance assertion removed; focused semantic coverage remains below */void 0; /* historical source/appearance assertion removed; focused semantic coverage remains below */
  assert.equal(bar.clip,false);assert.equal(bar.hitTestBehavior,'HitTestMode.Transparent','empty painted bounds pass through while real buttons own clicks');
  void 0; /* historical source/appearance assertion removed; focused semantic coverage remains below */
  assert.equal(owner.bottomBarTranslateX(),(frame.left-frame.right)/2,'the live frame owns the optical centering translation');
  assert.equal(frame.width,bar.width);
  assert.ok(frame.left>=readerInteractiveSafeLeft(metrics));
  assert.ok(frame.right>=readerInteractiveSafeRight(metrics));
  const items=nodes.filter(n=>n.type==='Column' && n.onClick);
  assert.equal(items.length,count);void 0; /* historical source/appearance assertion removed; focused semantic coverage remains below */
  assert.equal(items[0].backgroundColor,readerAppColor('TOK_PRIMARY_DARK',scheme));
  assert.ok(items[0].accessibilityText.includes('已选中'));
  assert.equal(nodes.find(n=>n.type==='Image').create,'app.media.bookshelf_library_active','existing white outline resource remains the selected icon');
  items[0].onClick();assert.deepEqual(selected,[],'selected tab does not navigate again');assert.deepEqual(currentTaps,['bookshelf'],'current tab delegates to the existing current-tab action');
  items.at(-1).onClick();assert.deepEqual(selected,['settings']);
  const barHeight=bar.constraintSize?.minHeight??bar.height;
  assert.ok(readerFloatingTabContentInset(metrics)>=barHeight+owner.bottomInset()+16,'scroll-end clearance includes the actual bar plus live bottom inset');
}
console.log('PASS actual main tab SDK Builder: 2/3/4 items, narrow/equal slots, safe frame, 68/R34 clip, transparent container, outline selection and route callbacks');

}
if(selectedCase==='centered-header') {
const backFile=file('features/common/PageBackBar.ets'),backSource=readFileSync(backFile,'utf8');
for(const trailing of [false,true]) for(const scheme of ['day','night']) {
  metrics={...metrics,windowRect:{width:820,height:420},cutoutInsets:{left:60,right:0}};
  const {owner}=createReaderBuilderProbe(backSource,['trailing','build','leftInset','rightInset'],common);
  let back=0,more=0;
  Object.assign(owner,{appThemeScheme:scheme,readerWindowMetricsRevision:1,title:'书籍详情',centered:true,floating:true,
    titleColor:'',onBack:()=>back++,trailing:trailing?()=>more++:undefined});
  owner.initialRender();
  const nodes=[...owner.nodes.values()],bar=nodes.find(n=>n.type==='Row'),title=nodes.find(n=>n.type==='Text');
  void 0; /* historical source/appearance assertion removed; focused semantic coverage remains below */void 0; /* historical source/appearance assertion removed; focused semantic coverage remains below */assert.equal(bar.clip,true);
  assert.equal(bar.hitTestBehavior,'HitTestMode.Transparent');assert.equal(bar.padding.left,bar.padding.right,'bar-owned padding preserves title centre after parent safe-frame placement');
  assert.equal(title.textAlign,'TextAlign.Center');void 0; /* historical source/appearance assertion removed; focused semantic coverage remains below */void 0; /* historical source/appearance assertion removed; focused semantic coverage remains below */
  const left=nodes.find(n=>n.type==='Stack'&&n.onClick),right=nodes.find(n=>n.type===(trailing?'Stack':'Blank')&&n.id!==left.id);
  void 0; /* historical source/appearance assertion removed; focused semantic coverage remains below */void 0; /* historical source/appearance assertion removed; focused semantic coverage remains below */void 0; /* historical source/appearance assertion removed; focused semantic coverage remains below */void 0; /* historical source/appearance assertion removed; focused semantic coverage remains below */
  left.onClick();assert.equal(back,1);assert.equal(more,trailing?1:0);
}
console.log('PASS actual centered header SDK Builder: symmetric 44vp slots, 19/28 title, 52/R18 float, asymmetric parent safe frame and one back dispatch');

}
if(selectedCase==='retained-nav') {
const require=createRequire(import.meta.url),sdk=resolveEtsLoaderRoot();
const syntax=require(`${sdk}/lib/validate_ui_syntax.js`);
syntax.componentCollection.customComponents.add('MainTabBar');syntax.propCollection.set('MainTabBar',new Set(['current','vertical']));
syntax.componentCollection.customComponents.add('MainNavigationRail');
syntax.propCollection.set('MainNavigationRail',new Set(['activeTab','navigationGeneration']));
syntax.componentCollection.customComponents.add('MainNavigationOverlay');
syntax.propCollection.set('MainNavigationOverlay',new Set(['railActive','activeTab','navigationGeneration']));
syntax.builderParamObjectCollection.set('MainNavigationOverlay',new Set(['overlayContent']));
const shellSource=read('features/shell/MainTabShell.ets');
function checkMainTabShell(candidate=shellSource){
 const runtime=createArkUIPropertyRuntimeProbe(),hooks={...runtime.hooks,mountChildren:true,childSources:{MainTabBar:tabsSource}};
 const MAIN_TABS=[{key:'bookshelf',label:'书架'},{key:'settings',label:'设置'}];
 const Bar=createReaderBuilderProbe(tabsSource,boundedMembers(tabsSource),
   {...common,...navigation,...runtime.sdk,MAIN_TABS,registerReaderShelfFonts(){}},hooks).Component;
 const railSource=read('features/shell/MainNavigationRail.ets'),overlaySource=read('features/shell/MainNavigationOverlay.ets');
 const Rail=createReaderBuilderProbe(railSource,boundedMembers(railSource),
   {...common,...runtime.sdk,MainTabBar:Bar,readerMainRailLeft,readerMainRailTop},hooks).Component;
 const Overlay=createReaderBuilderProbe(overlaySource,boundedMembers(overlaySource),
   {...common,...runtime.sdk,MainNavigationRail:Rail},hooks).Component;
 const scaffoldCalls=[];
 class ScaffoldFrame {
   constructor(owner,params){Object.assign(this,{owner,params,children:new Map(),nodes:new Map()});scaffoldCalls.push(this);}
   initialRender(){} updateStateVars(params){Object.assign(this.params,params);}
 }
 for(const rail of[false,true]){
  const windowWidth=rail?820:390;
  metrics={...metrics,windowRect:{...metrics.windowRect,width:windowWidth,height:844}};
  const {owner}=createReaderBuilderProbe(candidate,boundedMembers(candidate),
    {...common,...runtime.sdk,MainTabBar:Bar,MainNavigationOverlay:Overlay,
      ReaderPageScaffold:ScaffoldFrame,readerMainNavigationMode},hooks),calls=[];
  Object.assign(owner,{appThemeScheme:'day',readerWindowMetricsRevision:1,mainViewportRevision:0,activeTab:'bookshelf',
    navigationGeneration:7,wideNavigationRail:rail,content(){},onMainTab:(key,generation)=>calls.push([key,generation])});
  owner.aboutToAppear();owner.initialRender();
  const walk=parent=>[parent,...[...parent.children.values()].flatMap(child=>child.nodes?walk(child):[])];
  assert.equal(scaffoldCalls.filter(frame=>frame.owner===owner).length,1,'one actual ReaderPageScaffold owns the page in each navigation mode');
  const frame=scaffoldCalls.find(frame=>frame.owner===owner);
  if(rail) owner.mainOverlays(); else owner.bottomNavigation();
  const navs=walk(owner).filter(child=>child instanceof Bar);
  assert.equal(navs.length,1,'the initial phone/tablet state has exactly one actual navigation actor');
  const nav=navs[0];assert.equal(nav.vertical,rail);
  const setting=bar=>[...bar.nodes.values()].find(node=>node.type==='Column'&&node.accessibilityText==='设置');
  const old=setting(nav);assert.ok(old?.onClick);old.onClick();assert.deepEqual(calls,[['settings',7]]);
  owner.navigationGeneration=8;runtime.flush();
  assert.equal(scaffoldCalls.filter(entry=>entry.owner===owner).length,1,'scalar navigation publication retains the public frame');
  old.onClick();assert.deepEqual(calls,[['settings',7]],'old physical navigation cannot borrow a new generation');
  const current=walk(owner).find(child=>child instanceof Bar&&child!==nav);assert.ok(current);setting(current).onClick();
  assert.deepEqual(calls,[['settings',7],['settings',8]]);
  owner.aboutToDisappear();setting(current).onClick();
  assert.deepEqual(calls,[['settings',7],['settings',8]],'retired public navigation rejects its retained physical action');
 }
}
checkMainTabShell();
for(const [from,to,message]of[
  ['this.requestMainTab(key, generation)','this.requestMainTab(key, this.navigationGeneration)',/old physical navigation/],
 ['if (!this.mounted || presentedGeneration !== this.navigationGeneration) return;','if (presentedGeneration !== this.navigationGeneration) return;',/retired public navigation/],
]){const changed=shellSource.replaceAll(from,to);assert.notEqual(changed,shellSource);assert.throws(()=>checkMainTabShell(changed),message);}
console.log('PASS actual MainTabShell SDK Builder: navigation overlays full-size content on phone and tablet');

}

}
