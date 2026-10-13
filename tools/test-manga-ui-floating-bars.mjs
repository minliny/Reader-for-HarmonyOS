import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, stripTypeScriptTypes } from 'node:module';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import { SurfaceWidthSpec, resolveHorizontalFrame } from '../entry/src/main/ets/features/common/SurfaceHorizontalGeometry.ts';
import { readerInteractiveSafeLeft, readerInteractiveSafeRight, readerInteractiveSafeBottom,
  readerVisualSafeTop } from '../entry/src/main/ets/features/common/ReaderWindowMetrics.ts';
import { readerAppColor } from '../entry/src/main/ets/features/common/ReaderThemeRegistry.ts';
import * as families from '../entry/src/main/ets/features/common/ReaderFontFamilies.ts';
import { loadReaderTypographyRoles } from './lib/reader-typography-probe.mjs';
import { isReaderMainTabEnabled } from '../entry/src/main/ets/app/ReaderProductScope.ts';
import { boundedMembers } from './lib/bounded-surface-sdk-probe.mjs';
import { createArkUIPropertyRuntimeProbe } from './lib/arkui-property-runtime-probe.mjs';
const file = name => new URL(`../entry/src/main/ets/${name}`, import.meta.url);
const read = name => readFileSync(file(name),'utf8');
const roleSource=read('features/common/ReaderTypography.ets');
const floatingSource=read('features/common/ReaderFloatingBarMetrics.ts').replace(/^import\s*[\s\S]*?;\s*/gm,'').replace(/\bexport /g,'');
const {readerFloatingTabBottomInset,readerFloatingTabContentInset}=new Function('readerInteractiveSafeBottom',`${stripTypeScriptTypes(floatingSource)};return {readerFloatingTabBottomInset,readerFloatingTabContentInset};`)(readerInteractiveSafeBottom);
const { TYPE_MAIN_TAB_LABEL, TYPE_PAGE_TITLE, TYPE_APP_HOME_TITLE } = loadReaderTypographyRoles(roleSource);
const roles = { TYPE_MAIN_TAB_LABEL, TYPE_PAGE_TITLE, TYPE_APP_HOME_TITLE };
let metrics={windowRect:{width:390,height:844},systemInsets:{left:0,right:0,top:48,bottom:34},cutoutInsets:{},gestureInsets:{},navigationInsets:{}};
const common={...roles,READER_FONT_NOTO_SANS_SC_UI_BOLD:families.READER_FONT_NOTO_SANS_SC_UI_BOLD,
  SurfaceWidthSpec,resolveHorizontalFrame,readerInteractiveSafeLeft,readerInteractiveSafeRight,
  readerInteractiveSafeBottom,readerVisualSafeTop,readerFloatingTabBottomInset,isReaderMainTabEnabled,
  ReaderWindowCoordinator:{metrics:()=>metrics},TOK_SPACE_CONTROL_INLINE:10,TOK_HOME_TOP_BAR_INSET:20,TOK_SPACE_XS:8,TOK_BORDER_W:0.5};
const tabsFile=file('features/shell/MainTabBar.ets'), tabsSource=readFileSync(tabsFile,'utf8');
for(const count of [2,3,4]) for(const width of [320,390,800]) for(const scheme of ['day','night']) {
  const tabs=[{key:'bookshelf',label:'书架'},...(count>=3?[{key:'rss',label:'RSS'}]:[]),...(count===4?[{key:'discover',label:'发现'}]:[]),{key:'settings',label:'设置'}];
  metrics={...metrics,windowRect:{...metrics.windowRect,width},cutoutInsets:width===800?{left:50,right:0}:{}};
  const dep={...common,MAIN_TABS:tabs};
  const {owner}=createReaderBuilderProbe(tabsSource,['bottomBar','bottomTabItem','tabIcon','tabIconResource','bottomBarFrame','bottomBarTranslateX','bottomInset','liveWindowWidth'],dep);
  const selected=[],currentTaps=[];
  Object.assign(owner,{appThemeScheme:scheme,readerWindowMetricsRevision:1,current:'bookshelf',onSelect:key=>selected.push(key),onCurrentTap:key=>currentTaps.push(key)});
  owner.bottomBar();
  const nodes=[...owner.nodes.values()];
  const bar=nodes.find(n=>n.type==='Row');
  const frame=owner.bottomBarFrame();
  assert.equal(bar.width,Math.min(360,98*count,width-Math.max(32,readerInteractiveSafeLeft(metrics))-Math.max(32,readerInteractiveSafeRight(metrics))));
  assert.equal(bar.height,68);assert.equal(bar.borderRadius,34);assert.equal(bar.padding,8);
  assert.equal(bar.clip,true);assert.equal(bar.hitTestBehavior,'HitTestMode.Transparent','empty painted bounds pass through while real buttons own clicks');
  assert.equal(bar.margin.bottom,34,'navigation avoids the gesture area once');
  const actualLeft=(width-bar.width)/2+bar.translate.x;
  assert.equal(actualLeft,frame.left);assert.ok(actualLeft>=readerInteractiveSafeLeft(metrics));
  assert.ok(actualLeft+bar.width<=width-readerInteractiveSafeRight(metrics));
  const items=nodes.filter(n=>n.type==='Column' && n.onClick);
  assert.equal(items.length,count);assert.ok(items.every(n=>n.layoutWeight===1&&n.height===50));
  assert.equal(items[0].backgroundColor,readerAppColor('TOK_PRIMARY_DARK',scheme));
  assert.ok(items[0].accessibilityText.includes('已选中'));
  assert.equal(nodes.find(n=>n.type==='Image').create,'app.media.bookshelf_library_active','existing white outline resource remains the selected icon');
  items[0].onClick();assert.deepEqual(selected,[],'selected tab does not navigate again');assert.deepEqual(currentTaps,['bookshelf'],'current tab delegates to the existing current-tab action');
  items.at(-1).onClick();assert.deepEqual(selected,['settings']);
  assert.ok(readerFloatingTabContentInset(metrics)>=bar.height+bar.margin.bottom+16,'scroll-end clearance includes the actual bar plus margin');
}
console.log('PASS actual main tab SDK Builder: 2/3/4 items, narrow/equal slots, safe frame, 68/R34 clip, transparent container, outline selection and route callbacks');
const backFile=file('features/common/PageBackBar.ets'),backSource=readFileSync(backFile,'utf8');
for(const trailing of [false,true]) for(const scheme of ['day','night']) {
  metrics={...metrics,windowRect:{width:820,height:420},cutoutInsets:{left:60,right:0}};
  const {owner}=createReaderBuilderProbe(backSource,['trailing','build','leftInset','rightInset'],common);
  let back=0,more=0;
  Object.assign(owner,{appThemeScheme:scheme,readerWindowMetricsRevision:1,title:'书籍详情',centered:true,floating:true,
    titleColor:'',onBack:()=>back++,trailing:trailing?()=>more++:undefined});
  owner.initialRender();
  const nodes=[...owner.nodes.values()],bar=nodes.find(n=>n.type==='Row'),title=nodes.find(n=>n.type==='Text');
  assert.equal(bar.height,52);assert.equal(bar.borderRadius,18);assert.equal(bar.clip,true);
  assert.equal(bar.hitTestBehavior,'HitTestMode.Transparent');assert.equal(bar.padding.left,bar.padding.right,'bar-owned padding preserves title centre after parent safe-frame placement');
  assert.equal(title.textAlign,'TextAlign.Center');assert.equal(title.fontSize,19);assert.equal(title.lineHeight,28);
  const left=nodes.find(n=>n.type==='Stack'&&n.onClick),right=nodes.find(n=>n.type===(trailing?'Stack':'Blank')&&n.id!==left.id);
  assert.equal(left.width,44);assert.equal(left.height,44);assert.equal(right.width,44);assert.equal(right.height,44);
  left.onClick();assert.equal(back,1);assert.equal(more,trailing?1:0);
}
console.log('PASS actual centered header SDK Builder: symmetric 44vp slots, 19/28 title, 52/R18 float, asymmetric parent safe frame and one back dispatch');
const require=createRequire(import.meta.url),sdk=process.env.READER_ETS_LOADER_ROOT??'/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const syntax=require(`${sdk}/lib/validate_ui_syntax.js`);
syntax.componentCollection.customComponents.add('MainTabBar');syntax.propCollection.set('MainTabBar',new Set(['current','vertical']));
const shellSource=read('features/shell/MainTabShell.ets');
function checkMainTabShell(candidate=shellSource){
 const runtime=createArkUIPropertyRuntimeProbe(),hooks={...runtime.hooks,mountChildren:true,childSources:{MainTabBar:tabsSource}};
 const MAIN_TABS=[{key:'bookshelf',label:'书架'},{key:'settings',label:'设置'}];
 const Bar=createReaderBuilderProbe(tabsSource,boundedMembers(tabsSource),{...common,...runtime.sdk,MAIN_TABS,registerReaderShelfFonts(){}},hooks).Component;
 for(const rail of[false,true]){
  const {owner}=createReaderBuilderProbe(candidate,boundedMembers(candidate),{...common,...runtime.sdk,MainTabBar:Bar},hooks),calls=[];
  Object.assign(owner,{appThemeScheme:'day',readerWindowMetricsRevision:1,activeTab:'bookshelf',navigationGeneration:7,showBottomNav:true,showTabletRail:rail,content(){},onMainTab:(key,generation)=>calls.push([key,generation])});
  owner.aboutToAppear();owner.initialRender();
  const walk=parent=>[parent,...[...parent.children.values()].flatMap(child=>child.nodes?walk(child):[])];
  const frame=walk(owner).find(child=>child.params?.variant==='mainTab');assert.ok(frame?.nodes,'actual main shell owns its real public Scaffold');
  const stacks=[...frame.nodes.values()].filter(n=>n.type==='Stack');assert.ok(stacks.length>0);
  assert.ok(stacks.every(n=>n.height==='100%'&&n.width==='100%'),'navigation overlays retain the full content viewport');
  assert.equal([...owner.children.values()].filter(child=>child.params?.variant==='mainTab').length,1,'one actual public frame owns the page');
  assert.equal(walk(owner).filter(child=>child instanceof Bar).length,1,'the initial phone/tablet state has exactly one actual navigation actor');
  const nav=walk(owner).find(child=>child instanceof Bar);assert.ok(nav);assert.equal(nav.vertical,rail);
  const setting=bar=>[...bar.nodes.values()].find(node=>node.type==='Column'&&node.accessibilityText==='设置');
  const old=setting(nav);assert.ok(old?.onClick);old.onClick();assert.deepEqual(calls,[['settings',7]]);
  owner.navigationGeneration=8;runtime.flush();
  assert.equal(walk(owner).find(child=>child.params?.variant==='mainTab'),frame,'scalar navigation publication retains the public frame');
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
