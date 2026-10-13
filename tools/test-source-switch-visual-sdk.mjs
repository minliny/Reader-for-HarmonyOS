import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {stripTypeScriptTypes} from 'node:module';
import {boundedSurfaceSdk} from './lib/bounded-surface-sdk-probe.mjs';
import {sourceSwitchLiveSdk,sourceSwitchFontSdk} from './lib/source-switch-sdk-consumer.mjs';
import * as metricsApi from '../entry/src/main/ets/features/common/ReaderWindowMetrics.ts';
import * as families from '../entry/src/main/ets/features/common/ReaderFontFamilies.ts';
import {SOURCE_SWITCH_VISUAL,SOURCE_SWITCH_VISUAL_SHA256} from '../entry/src/main/ets/features/source/SourceSwitchVisual.ts';
import {readerAppColor} from '../entry/src/main/ets/features/common/ReaderThemeRegistry.ts';
import {readerAppearanceThemeStyle} from '../entry/src/main/ets/features/reading/ReaderAppearanceRenderStyle.ts';

const designBytes=readFileSync(new URL('../../Reader-UI/design/source-switch/source-switch.visual.json',import.meta.url));
const design=JSON.parse(designBytes),v=design.numbers;
assert.equal(SOURCE_SWITCH_VISUAL_SHA256,createHash('sha256').update(designBytes).digest('hex'));
assert.deepEqual(SOURCE_SWITCH_VISUAL,{...v,...design.strings},'generated spec binds the independent selected design');
const tick=async()=>{await new Promise(setImmediate);};
const candidate=(id,url='/book')=>({sourceId:id,bookUrl:url,sourceName:'书源 '+id,bookName:'书名',category:'novel',latestChapterTitle:'最新章节 '+id,latencyKind:'search',latencyMs:38,acquisitionState:'discovered'});
const p=boundedSurfaceSdk({allowEmptyBranchAdmission:true});
let metrics,serial=1000;
const animations=[];
const uiContext={getFont:()=>({}),animateTo(_options,action){action();},postFrameCallback(){},createAnimator(options){
 const a={options,onFrame:()=>{},played:0,cancelled:0,play(){this.played++;},cancel(){this.cancelled++;this.onFrame(360);}};
 animations.push(a);return a;
}};
const deps=sourceSwitchLiveSdk(p,{ReaderWindowCoordinator:{metrics:()=>metrics},uiContext,setTimeout(){return 1;},clearTimeout(){}});
function scene(width,height,scale,state={kind:'candidates',candidates:[candidate('a'),candidate('a','/alternate'),candidate('b')],refreshing:true},contentKind='text',scheme='day',extra={}){
 metrics=metricsApi.createDefaultReaderWindowMetrics();metrics.windowRect=new metricsApi.ReaderRectVp(0,0,width,height);
 metrics.systemFontScale=scale;metrics.systemInsets=new metricsApi.ReaderInsetsVp(0,24,0,24);
 const selected=[];
 const o=new deps.SourceSwitchPanel(undefined,{contentKind,readerWindowMetricsRevision:1,bookTitle:'书名',author:'作者',coverUrl:'owned-cover',currentSourceName:'当前书源',latestChapterTitle:'第 20 章',
  state,onSelectCandidate:c=>selected.push(c),...extra},undefined,++serial);
 o.containerWidth=width;o.containerHeight=height;o.appThemeScheme=scheme;o.aboutToAppear();o.initialRender();
 // Request the real SDK-emitted static ListItem deep-render callbacks. This
 // is explicit range admission, not a replacement for Ace's viewport choice.
 const items=p.nodes(o).filter(n=>n.type==='ListItem');
 for(const header of items.slice(0,o.listHeaderCount()))header.create[0](header.id,true);
 if(o.flowChrome()&&items.length>0){const footer=items.at(-1);footer.create[0](footer.id,true);}
 for(const child of p.walk(o))if('appThemeScheme' in child)child.appThemeScheme=scheme;
 p.properties.flush();
 return{o,selected,scheme,nodes:p.nodes(o),rows:p.walk(o).filter(child=>child instanceof deps.SourceSwitchNovelRow)};
}
function expected(width,height,s){
 // Formulas are the explicit design policy, independent of native helpers.
 const drawerWidth=Math.min(v.drawerMaxWidth,width),narrow=drawerWidth<v.narrowWidthThreshold,short=height<v.shortHeightThreshold;
 const drawer=height-Math.max(24,short?0:v.drawerTopReserve),row=v.rowHeight*s;
 const heading=Math.max(v.headingHeight,v.titleLineHeight*s);
 const compactAction=drawerWidth/Math.max(1,s)<=v.discoveryCompactWidthThreshold;
 const prefix=drawerWidth/Math.max(1,s)>v.discoveryPrefixWidthThreshold;
 const actionFont=compactAction?v.compactDiscoveryActionFontSize:v.discoveryActionFontSize;
 const actionPadding=compactAction?v.compactDiscoveryActionPaddingX:v.discoveryActionPaddingX;
 const actionWidth=Math.max(compactAction?v.compactDiscoveryActionWidth:v.discoveryActionWidth,
  4*actionFont*s+v.discoveryActionIconSize+v.discoveryActionGap+2*actionPadding);
 const actionVisible=Math.max(v.discoveryActionVisibleHeight,v.discoveryActionLineHeight*s+2*v.discoveryActionPaddingY);
 const actionHit=Math.max(v.discoveryActionMinHeight,actionVisible+2*v.discoveryActionInsetY);
 const toolbar=Math.max(v.discoveryHeight,(Math.max(v.discoveryCountLineHeight,narrow?v.narrowDiscoveryStatusLineHeight:v.discoveryStatusLineHeight)+v.discoveryPhaseLineHeight)*s,actionHit);
 const discovery=toolbar+v.discoveryBottomGap;
 const columns=Math.max(short?v.compactColumnHeight:v.columnHeight,v.columnLineHeight*s+v.columnTextPaddingY);
 const footer=Math.max(short?v.compactFooterHeight:v.footerHeight,v.footerLineHeight*s+v.footerTextPaddingY);
 const grip=short?0:v.gripMarginTop+v.gripHeight+v.gripMarginBottom;
 const flow=drawer-24<heading+discovery+columns+footer+grip+row;
 const book=s===1?v.bookHeight:Math.max(v.bookHeight,2*v.bookPaddingY+v.bookMetadataLineBoxes*s);
 const scrollBook=flow||short||s!==1;
 return{drawerWidth,narrow,short,drawer,row,heading,discovery,toolbar,compactAction,prefix,actionFont,actionWidth,actionVisible,actionHit,columns,footer,grip,flow,book,scrollBook,timing:(narrow?v.narrowTimingColumnWidth:v.timingColumnWidth)*Math.max(1,s)};
}
function assertScene(x,width,height,s){
 const e=expected(width,height,s),o=x.o,scheme=x.scheme;
 for(const [method,value] of Object.entries({drawerWidth:e.drawerWidth,narrowWindow:e.narrow,compactWindow:e.short,drawerHeight:e.drawer,rowHeight:e.row,headingHeight:e.heading,discoveryHeight:e.discovery,discoveryToolbarHeight:e.toolbar,compactDiscoveryAction:e.compactAction,discoveryPrefixVisible:e.prefix,discoveryActionWidth:e.actionWidth,discoveryActionVisibleHeight:e.actionVisible,discoveryActionHitHeight:e.actionHit,columnsHeight:e.columns,footerHeight:e.footer,flowChrome:e.flow,bookHeight:e.book,scrollBook:e.scrollBook,timingWidth:e.timing}))assert.equal(o[method](),value,`${width}x${height}@${s} actual ${method}`);
 const list=x.nodes.find(n=>n.type==='List');assert.ok(list);assert.equal(list.height,'100%');assert.equal(list.scrollBar,'BarState.Auto');assert.equal(list.scrollBarWidth,v.scrollbarWidth);
 assert.equal(list.scrollBarColor,readerAppColor('TOK_SS_SCROLLBAR',scheme));
 const drawer=x.nodes.find(n=>n.constraintSize?.maxWidth===v.drawerMaxWidth);assert.equal(drawer.height,e.drawer);assert.equal(drawer.clip,true);
 const chrome=[...o.nodes.values()].filter(n=>n.type==='Row'&&typeof n.create?.space==='number');
 assert.equal(chrome.length,5,'only one bounded action-content row joins the existing four chrome rows');
 assert.deepEqual(chrome.filter(n=>n.create.space===v.headingGap).map(n=>n.height),[e.heading,e.columns],'actual SDK heading and column heights consume selected dimensions');
 const columns=chrome.find(n=>n.height===e.columns);
 assert.equal(columns.width,'100%');assert.deepEqual(columns.padding,{right:8},'native overlay-scrollbar track reserves the same trailing space for the column heading');
 assert.equal(chrome.find(n=>n.create.space===(e.narrow?v.narrowBookGap:v.bookGap)).height,e.book,'actual book row consumes the selected height');
 const discovery=chrome.find(n=>n.create.space===(e.narrow?v.narrowDiscoveryGap:v.discoveryGap));
 assert.equal(discovery.height,e.toolbar,'actual discovery row consumes its two-line toolbar height');
 assert.deepEqual(discovery.margin,{bottom:v.discoveryBottomGap});assert.equal(discovery.border,undefined,'selected toolbar has no outer card or divider');
 const actionChrome=chrome.find(n=>n.create.space===v.discoveryActionGap);
 assert.equal(actionChrome.height,e.actionVisible);assert.equal(actionChrome.backgroundColor,readerAppColor(design.strings.discoveryActionBackgroundRole,scheme));
 assert.equal(actionChrome.borderRadius,v.discoveryActionRadius);
 const actionButton=x.nodes.find(n=>n.type==='Button'&&n.width===e.actionWidth);
 assert.equal(actionButton.height,e.actionHit);assert.equal(actionButton.stateEffect,false);assert.equal(actionButton.backgroundColor,'Color.Transparent');
 const cover=x.nodes.find(n=>n.type==='Image'&&n.create==='owned-cover');
 assert.deepEqual([cover.width,cover.height],[e.short?v.compactCoverWidth:v.coverWidth,e.short?v.compactCoverHeight:v.coverHeight]);
 assert.equal(x.nodes.find(n=>n.create==='点击书源切换').height,e.footer);
 if(e.flow){const headers=x.nodes.filter(n=>n.type==='ListItem').slice(0,4);assert.deepEqual(headers.map(n=>n.height),[e.heading,undefined,e.discovery,e.columns],'actual flow header extents and intrinsic book content');}
 const padding=x.nodes.find(n=>n.type==='Column'&&n.layoutWeight===1&&n.padding?.bottom===24).padding;
 assert.deepEqual(padding,{left:e.narrow?v.narrowSideInset:v.normalSideInset,right:e.narrow?v.narrowSideInset:v.normalSideInset,bottom:24});
 const usable=e.drawer-24-(e.flow?0:e.heading+e.discovery+e.columns+e.footer+e.grip+(e.scrollBook?0:e.book));
 assert.ok(usable>=e.row,`${width}x${height}@${s} leaves an operable result range`);
 assert.equal(o.listHeaderCount(),e.flow?4:e.scrollBook?1:0);
 assert.equal(o.listHeaderHeight(),e.flow?e.heading+e.book+e.discovery+e.columns:e.scrollBook?e.book:0);
 assert.equal(x.rows.length,3);assert.equal(x.nodes.filter(n=>n.type==='ListItem'&&n.height===e.row).length,3);
 for(const row of x.rows){
  assert.equal(row.rowHeight,e.row);assert.equal(row.timingColumnWidth,e.timing);
  const native=p.nodes(row),box=native.find(n=>n.type==='Row');assert.equal(box.height,e.row);
  assert.equal(box.width,'100%');assert.deepEqual(box.padding,{top:v.rowPaddingY,bottom:v.rowPaddingY,right:8},'8vp platform reserve keeps latency clear of the overlay thumb while preserving row/divider width');
  assert.ok(e.row >= (v.sourceNameLineHeight+v.latestChapterLineHeight+v.rowTextGap)*s+2*v.rowPaddingY,'scaled two-line content fits the selected row extent');
  assert.equal(native.find(n=>n.type==='Flex').width,e.timing);
  assert.equal(native.find(n=>n.create==='38').fontFeature,'"tnum" 1');
  assert.equal(native.find(n=>n.create===' ms').margin.left,v.timingUnitGap);
  assert.equal(native.find(n=>n.create===' ms').fontSize,v.timingUnitFontSize);
  assert.equal(native.find(n=>n.create===' ms').fontColor,readerAppColor(design.strings.timingUnitInkRole,scheme));
  const color=deps.ColorMetrics.resourceColor(readerAppColor('TOK_ROW_DIVIDER',scheme));
  assert.equal(box.border.color,deps.ColorMetrics.rgba(color.red,color.green,color.blue,color.alpha/255*v.rowDividerOpacity).color,'only the existing divider alpha is reduced');
  assert.equal(box.opacity,undefined,'candidate content is never dimmed with its border');
 }
 for(const text of x.nodes.filter(n=>n.type==='Text'))assert.equal(text.halfLeading,true,'every selected novel text uses symmetric leading: '+text.create);
 const tuple=(text,key,cssFamily=design.strings.bodyFontFamilyCss,size=v[key+'FontSize'])=>{
  const weight=v[key+'FontWeight']??v.discoveryStatusFontWeight;
  const face=design.fontAssets.find(asset=>asset.cssFamily===cssFamily&&
   (asset.weight===weight||(key==='discoveryCount'&&asset.supportedWeights?.includes(weight))));
  assert.ok(face,'the approved physical face exists: '+key);
  const nativeWeight=key==='discoveryCount'?[weight,{enableVariableFontWeight:true}]:weight;
  assert.deepEqual([text.fontFamily,text.fontWeight,text.fontSize,text.lineHeight],[families[face.nativeFamilyConstant],nativeWeight,size,v[key+'LineHeight']],'actual native text consumes selected tuple: '+key);
 };
 tuple(x.nodes.find(n=>n.create==='更换书源'),'title',design.strings.titleFontFamilyCss);
 tuple(x.nodes.find(n=>n.create==='书名'),'bookTitle',design.strings.titleFontFamilyCss);
 tuple(x.nodes.find(n=>n.create==='作者'),'author');
 tuple(x.nodes.find(n=>n.create==='最新章节：第 20 章'),'metadata');
 tuple(x.nodes.find(n=>n.create==='当前书源：当前书源'),'currentSource');
 assert.equal(x.nodes.find(n=>n.create==='当前书源：当前书源').fontColor,readerAppColor('TOK_GREEN',scheme));
 tuple(x.nodes.find(n=>n.create==='停止'),'discoveryAction',design.strings.bodyFontFamilyCss,e.actionFont);
 tuple(x.nodes.find(n=>n.create==='个书源'),e.narrow?'narrowDiscoveryStatus':'discoveryStatus');
 if(e.prefix)tuple(x.nodes.find(n=>n.create==='已找到'),e.narrow?'narrowDiscoveryStatus':'discoveryStatus');
 else assert.equal(x.nodes.filter(n=>n.create==='已找到').length,0,'narrow/large-font layout drops only the gray prefix');
 tuple(x.nodes.find(n=>n.create==='2'),'discoveryCount',design.strings.timingFontFamilyCss);
 assert.equal(x.nodes.find(n=>n.create==='2').fontFeature,'"tnum" 1');
 assert.equal(x.nodes.find(n=>n.create==='2').flexShrink,0,'core source count is never collapsed');
 tuple(x.nodes.find(n=>n.create==='正在查找'),'discoveryPhase');
 assert.equal(x.nodes.find(n=>n.create==='搜索耗时').width,e.timing);
 assert.equal(x.nodes.find(n=>n.create==='停止').lineHeight,v.discoveryActionLineHeight);
 const transition=drawer.transition;assert.equal(transition.kind,'asymmetric');
 assert.equal(transition.parameters.appear.options.duration,v.openDurationMs);assert.equal(transition.parameters.disappear.options.duration,v.closeDurationMs);
 assert.deepEqual(transition.parameters.appear.options.curve.values,[v.easingX1,v.easingY1,v.easingX2,v.easingY2]);
 const latest={...candidate('a','/alternate'),latencyMs:1,latestChapterTitle:'更新章节'};
 o.state={kind:'candidates',candidates:[candidate('a'),latest,candidate('b')],refreshing:true};o.acceptState();
 const hit=p.nodes(x.rows[1]).find(n=>n.type==='Row');
 hit.onTouch({type:deps.TouchType.Down});p.properties.flush();assert.equal(hit.backgroundColor,readerAppColor(design.strings.selectedRowRole,scheme));
 hit.onTouch({type:deps.TouchType.Up});p.properties.flush();hit.onClick();
 assert.equal(x.selected[0],latest,'actual native row callbacks select the latest composite identity, including alternate URL');
 p.properties.flush();
 o.aboutToDisappear();
}
for(const contentKind of ['text','manga'])for(const width of [400,365,320,270])for(const height of [844,640,480])for(const scale of [.85,1,1.5,2])assertScene(scene(width,height,scale,undefined,contentKind),width,height,scale);
for(const contentKind of ['text','manga'])for(const scheme of ['day','night'])for(const [w,h,s] of [[390,844,1],[320,480,2],[270,180,2]])assertScene(scene(w,h,s,undefined,contentKind,scheme),w,h,s);
assertScene(scene(390,844,1),390,844,1);
assertScene(scene(270,180,2),270,180,2);
for(const width of [310,265])assertScene(scene(width,844,1),width,844,1);
// Same-provider rule variants remain separate presentation rows. A shared
// provider family is display metadata only; every sourceId/bookUrl remains
// independently selectable.
{
 const familyScene=scene(390,844,1,{kind:'candidates',refreshing:false,candidates:[
   {...candidate('qimao-md'),sourceName:'七猫小说（优++）',providerFamily:'qimao',bookUrl:'/md'},
   {...candidate('qimao-yc'),sourceName:'七猫小说（优+）',providerFamily:'qimao',bookUrl:'/yc'},
   {...candidate('other'),sourceName:'其他书源',providerFamily:'other',bookUrl:'/other'},
 ]});
 assert.equal(familyScene.rows.length,3,'same provider family keeps every rule selectable');
 assert.equal(familyScene.rows[0].candidate.sourceId,'qimao-md');
 assert.equal(familyScene.rows[1].candidate.sourceId,'qimao-yc');
 assert.equal(familyScene.rows[2].candidate.sourceId,'other');
 assert.equal(familyScene.rows[0].candidate.bookUrl,'/md');
 assert.equal(familyScene.rows[1].candidate.bookUrl,'/yc');
 familyScene.o.aboutToDisappear();
}
// The same native track remains reserved before remeasurement supplies a
// latency. Only content is inset; the row's border and hit extent stay full width.
{
 const cached={...candidate('cached'),latencyKind:undefined,latencyMs:undefined};
 const row=new deps.SourceSwitchNovelRow(undefined,{candidate:cached,timingColumnWidth:v.narrowTimingColumnWidth},undefined,++serial);row.initialRender();
 const native=p.nodes(row),box=native.find(n=>n.type==='Row'),dash=native.find(n=>n.create==='—');
 assert.equal(box.width,'100%');assert.equal(box.height,50);assert.equal(box.padding.right,8);
 assert.equal(dash.width,v.narrowTimingColumnWidth);assert.equal(dash.textAlign,'TextAlign.End');
}
// The selected CSS :active state follows the actual row event and property
// lifecycle. Native disabled hit dispatch remains the platform boundary.
{
 let presses=0,clicks=0;
 const row=new deps.SourceSwitchNovelRow(undefined,{candidate:candidate('press'),onPress:()=>presses++,onSelect:()=>clicks++},undefined,++serial);row.initialRender();
 const hit=p.nodes(row).find(n=>n.type==='Row'),soft=readerAppColor(design.strings.selectedRowRole,'day');
 assert.equal(hit.backgroundColor,'Color.Transparent');assert.equal(hit.enabled,true);
 for(const end of [deps.TouchType.Move,deps.TouchType.Up,deps.TouchType.Cancel]){
  const before=presses;hit.onTouch({type:deps.TouchType.Down});p.properties.flush();assert.equal(row.pressed,true);assert.equal(hit.backgroundColor,soft);assert.equal(presses,before+1);
  hit.onTouch({type:end});p.properties.flush();assert.equal(row.pressed,false);assert.equal(hit.backgroundColor,'Color.Transparent');assert.equal(presses,before+1);
 }
 hit.onTouch({type:deps.TouchType.Down});p.properties.flush();
 row.updateStateVars({candidate:row.candidate,rowEnabled:false,selected:false});p.properties.flush();
 assert.equal(row.pressed,false,'disabling a retained row clears active feedback');assert.equal(hit.enabled,false);assert.equal(hit.backgroundColor,'Color.Transparent');
 let before=presses;hit.onTouch({type:deps.TouchType.Down});p.properties.flush();assert.equal(row.pressed,false);assert.equal(presses,before,'disabled rows cannot emit a press identity');
 row.updateStateVars({candidate:{...candidate('current'),isCurrent:true},rowEnabled:true,selected:false});p.properties.flush();
 assert.equal(hit.enabled,false);hit.onTouch({type:deps.TouchType.Down});p.properties.flush();assert.equal(row.pressed,false);assert.equal(presses,before,'current source cannot enter the active state');assert.equal(hit.backgroundColor,'Color.Transparent');
 row.updateStateVars({candidate:candidate('press'),rowEnabled:true,selected:true});p.properties.flush();assert.equal(hit.enabled,true);assert.equal(hit.backgroundColor,soft);
 hit.onTouch({type:deps.TouchType.Cancel});p.properties.flush();assert.equal(hit.backgroundColor,soft,'selection feedback is retained independently of a cancelled press');
 row.updateStateVars({candidate:row.candidate,rowEnabled:true,selected:false});p.properties.flush();hit.onClick();assert.equal(clicks,1,'enabled native row retains its original selection callback');
}
// Actual action hit callbacks retain the pressed recipe independently of
// candidate enrichment, and restore it on pointer/cancellation/state changes.
for(const contentKind of ['text','manga'])for(const scheme of ['day','night'])for(const running of [false,true]){
 const rows=[candidate('a'),candidate('a','/alternate'),candidate('b')];
 const state={kind:'candidates',candidates:rows,refreshing:running};
 const x=scene(390,844,1,state,contentKind,scheme),o=x.o;
 const button=()=>p.nodes(o).find(n=>n.type==='Button'&&typeof n.onTouch==='function');
 const fill=()=>p.nodes(o).find(n=>n.type==='Row'&&n.create?.space===v.discoveryActionGap);
 const normal=readerAppColor(design.strings.discoveryActionBackgroundRole,scheme);
 const color=deps.ColorMetrics.resourceColor(readerAppColor('TOK_GREEN',scheme));
 const pressed=deps.ColorMetrics.rgba(color.red,color.green,color.blue,v.discoveryActionPressedOpacity).color;
 assert.equal(fill().backgroundColor,normal);assert.equal(button().stateEffect,false);
 const actionWidth=button().width;
 const icon=scheme==='night'?'app.media.settings_gen_refresh_theme_night':'app.media.settings_gen_refresh';
 assert.equal(p.nodes(o).filter(n=>n.type==='Image'&&n.create===icon).length,running?0:1,'only the idle action displays the static refresh icon');
 for(const end of [deps.TouchType.Up,deps.TouchType.Move,deps.TouchType.Cancel]){
  button().onTouch({type:deps.TouchType.Down});p.properties.flush();
  assert.equal(o.discoveryActionPressed,true);assert.equal(fill().backgroundColor,pressed,'press replaces the normal fill with exact14percent green');
  button().onTouch({type:end});p.properties.flush();assert.equal(o.discoveryActionPressed,false);assert.equal(fill().backgroundColor,normal);
 }
 button().onTouch({type:deps.TouchType.Down});p.properties.flush();
 o.state={...state,candidates:rows.map(c=>({...c,latestChapterTitle:'异步更新'}))};o.acceptState();p.properties.flush();
 assert.equal(o.discoveryActionPressed,true,'same-phase candidate enrichment cannot flash the action fill');assert.equal(fill().backgroundColor,pressed);
 // This controlled builder probe admits additions, but deliberately rejects
 // retiring a populated branch. Exercise the real owner transition before
 // painting, then restore this scene; independent idle/running scenes above
 // verify each emitted branch without weakening that probe boundary.
 o.state={kind:'candidates',candidates:rows,refreshing:!running,stopped:running};o.acceptState();
 assert.equal(o.discoveryActionPressed,false,'a real running-state change clears the prior action press');
 assert.equal(o.discoveryActionBackgroundColor(),normal);
 const phase=running?'已停止':'正在查找';
 assert.equal(o.novelDiscoveryPhase(),phase,'the actual owner supplies the next phase');
 o.state=state;o.acceptState();p.properties.flush();
 assert.equal(fill().backgroundColor,normal);
 assert.equal(button().width,actionWidth,'the restored action retains its same hit extent');
 button().onTouch({type:deps.TouchType.Down});p.properties.flush();assert.equal(o.discoveryActionPressed,true);
 o.cancelPresentation();p.properties.flush();assert.equal(o.discoveryActionPressed,false,'retiring/cancelling this presentation restores the action');
 const retainedTouch=button().onTouch;
 o.state={kind:'failure',transactionId:'held',confirmation:'known',message:'保留原阅读位置'};o.acceptState();
 retainedTouch({type:deps.TouchType.Down});assert.equal(o.discoveryActionPressed,false,'disabled rollback state cannot admit a new press');
 assert.equal(o.discoveryActionBackgroundColor(),normal);
 o.state=state;o.acceptState();p.properties.flush();assert.equal(fill().backgroundColor,normal);
 o.aboutToDisappear();
}
// Measured container bounds override the outer window, so narrow popovers
// cannot take a wide timing column from a large parent window.
const measured=scene(400,844,1);measured.o.containerWidth=320;assert.equal(measured.o.timingWidth(),v.narrowTimingColumnWidth);measured.o.aboutToDisappear();
for(const contentKind of ['text','manga'])for(const [w,h,s] of [[390,844,1],[320,480,2],[270,180,2]]){
 const empty=scene(w,h,s,{kind:'discovering'},contentKind),items=p.nodes(empty.o).filter(n=>n.type==='ListItem');
 if(empty.o.scrollBook()){
  const e=expected(w,h,s),fixed=e.flow?0:e.heading+e.discovery+e.columns+e.footer+e.grip;
  const header=e.flow?e.heading+e.book+e.discovery+e.columns:e.book;
  const emptyItem=items[empty.o.listHeaderCount()];assert.equal(emptyItem.height,Math.max(e.row,e.drawer-24-fixed-header));emptyItem.create[0](emptyItem.id,true);
 }
 assert.equal(p.nodes(empty.o).filter(n=>n.create==='正在查找其他书源…').length,1,'one real empty status remains reachable');
 assert.equal(p.nodes(empty.o).filter(n=>n.create==='书名').length,1,'empty stream keeps its book context in the correct fixed or scroll header');
 empty.o.aboutToDisappear();
}

// Render the actual shared progress child through its Window parent. The
// cancellation flag comes from the existing owner; the visual migration must
// neither lose an allowed cancellation nor invent one during a durable commit.
for(const contentKind of ['text','manga'])for(const allowCancel of [false,true])for(const scheme of ['day','night']){
 let closes=0;
 const x=scene(320,480,2,{kind:'switching',targetSourceId:'target'},contentKind,scheme,
  {allowCancelWhileSwitching:allowCancel,onClose:()=>closes++});
 const progress=p.walk(x.o).find(child=>child instanceof deps.SourceSwitchProgress);
 assert.ok(progress,'both formats mount the selected shared preparation surface');
 assert.equal(progress.allowCancel,allowCancel,'the unchanged owner gate reaches the real progress child');
 const buttons=p.nodes(progress).filter(n=>n.type==='Button'&&n.accessibilityText==='取消切换书源');
 assert.equal(buttons.length,allowCancel?1:0,'only an admitted cancellation emits a native hit target');
 if(allowCancel){
  const button=buttons[0];assert.deepEqual([button.width,button.height],[44,44]);
  const icon=p.nodes(progress).find(n=>n.type==='Image'&&n.create===(scheme==='night'?'app.media.source_switch_close_theme_night':'app.media.source_switch_close'));
  assert.deepEqual([icon.width,icon.height],[v.closeIconSize,v.closeIconSize]);
  button.onClick();assert.equal(closes,1,'the actual emitted cancellation calls the original Window close owner');
 }else assert.equal(closes,0);
 assert.equal(x.rows.length,0,'switch preparation cannot leak candidate hit targets');
 x.o.aboutToDisappear();
}
for(const contentKind of ['text','manga']){
 let closes=0;
 const x=scene(390,844,1,undefined,contentKind,'day',{onClose:()=>closes++});
 const close=p.nodes(x.o).find(n=>n.type==='Button'&&n.accessibilityText==='关闭更换书源');
 assert.equal(close.enabled,true);close.onClick();assert.equal(closes,1,'both drawers retain their original close callback');
 x.o.selectionPending=true;p.properties.flush();assert.equal(close.enabled,false,'pending selection keeps the existing close gate');
 x.o.allowCancelWhileSwitching=true;p.properties.flush();assert.equal(close.enabled,true,'the existing permitted preparation cancellation remains operable');
 x.o.aboutToDisappear();
 const rollback=scene(390,844,1,{kind:'failure',transactionId:'held',confirmation:'known',message:'回滚'},contentKind);
 assert.equal(p.nodes(rollback.o).find(n=>n.type==='Button'&&n.accessibilityText==='关闭更换书源').enabled,false,
  'an unresolved durable transaction keeps the original rollback close gate');
 rollback.o.aboutToDisappear();
}

// The installed SDK permits currentOffset() to return void even when the
// component's lifecycle marker has already admitted an attached List.
{
 const x=scene(390,844,1),o=x.o,originalState=o.state,original=originalState.candidates;
 let offsetReads=0;
 o.listMounted=true;o.firstVisibleIndex=1;o.firstVisibleListIndex=1;
 o.candidateScroller={currentOffset(){offsetReads++;return undefined;},getItemRect(){assert.fail('void offset cannot admit an anchor read');}};
 o.touching=true;o.state={kind:'candidates',candidates:[original.at(-1)]};o.acceptState();o.touching=false;
 assert.doesNotThrow(()=>o.publishOrder(),'mounted List with an unbound controller still publishes the current candidates');
 assert.equal(offsetReads,1);assert.equal(o.displayedCandidates.length,1);
 assert.equal(o.candidateKey(o.displayedCandidates[0]),o.candidateKey(original.at(-1)));
 assert.equal(o.candidateDataSource.totalCount(),1);assert.equal(o.candidateKey(o.candidateDataSource.getData(0)),o.candidateKey(original.at(-1)));
 assert.equal(o.firstVisibleIndex,1);assert.equal(o.restoringAnchor,false);
 // This controlled builder probe does not model non-empty branch removal.
 // Restore the original range before flushing; native removal remains VM evidence.
 o.state=originalState;o.latestCandidates=original;o.publishCandidates(original);p.properties.flush();o.aboutToDisappear();
}
{
 const x=scene(390,844,1),o=x.o,frames=[],scrolls=[];
 let offsetReads=0,rectReads=0;
 o.listMounted=true;o.firstVisibleIndex=1;o.firstVisibleListIndex=1;
 o.getUIContext=()=>({...uiContext,postFrameCallback(frame){frames.push(frame);}});
 o.candidateScroller={currentOffset(){offsetReads++;return undefined;},
  getItemRect(){rectReads++;throw Error('controller not bound');},
  scrollToIndex(index){scrolls.push(['index',index]);},scrollBy(){assert.fail('unavailable rect cannot supply a scroll delta');},
  scrollTo(options){scrolls.push(['offset',options.yOffset]);}};
 assert.doesNotThrow(()=>{
  o.restoreAnchor(o.candidateKey(o.displayedCandidates[1]),-3);
  let delivered=0;
  while(frames.length>0){assert.ok(++delivered<=6,'anchor restoration remains bounded to the original three two-frame attempts');frames.shift().onIdle(0);}
 },'unavailable anchor rect plus void final offset cannot escape the real frame callbacks');
 assert.equal(rectReads,3,'the existing bounded two retries are retained');assert.equal(offsetReads,1);
 assert.deepEqual(scrolls,[['index',1],['index',1],['index',1],['offset',53]]);
 assert.equal(o.firstVisibleIndex,1,'void final offset preserves the last known visible index');
 assert.equal(o.restoringAnchor,false,'the real restoration finishes after its bounded fallback');o.aboutToDisappear();
}

// Native animator scheduling is a controlled boundary. The actual component
// owns every lifecycle guard, SVG command and SDK-emitted Shape modifier.
const spin=new deps.SourceSwitchSpinner(undefined,{active:true,diameter:v.discoverySpinnerSize,strokeWidth:v.discoverySpinnerStrokeWidth,durationMs:v.discoverySpinnerDurationMs},undefined,++serial);
spin.aboutToAppear();spin.initialRender();let a=animations.at(-1);
assert.deepEqual(a.options,{duration:1000,easing:'linear',delay:0,fill:'forwards',direction:'normal',iterations:-1,begin:0,end:360});
const ring=p.nodes(spin).find(n=>n.type==='Shape');assert.equal(ring.width,18);assert.equal(ring.antiAlias,true);
assert.deepEqual(ring.viewPort,{x:'0px',y:'0px',width:'36px',height:'36px'});
const paths=p.nodes(spin).filter(n=>n.type==='Path');assert.equal(paths.length,2);
assert.equal(paths[0].fill,readerAppColor(design.strings.spinnerTrackRole,'day'));assert.equal(paths[1].fill,readerAppColor(design.strings.spinnerActiveRole,'day'));
assert.ok(paths.every(path=>path.strokeWidth===0&&path.commands.includes('A18 18')));
a.onFrame(45);p.properties.flush();assert.equal(ring.rotate.angle,45);
const before=animations.length;spin.updateStateVars({active:true,diameter:18,strokeWidth:1.5,durationMs:1000});p.properties.flush();assert.equal(animations.length,before,'streaming metadata cannot restart the spinner');
const stale=a.onFrame;spin.foreground=false;p.properties.flush();assert.equal(a.cancelled,1);assert.equal(spin.angle,0);stale(315);p.properties.flush();assert.equal(spin.angle,0,'queued cancelled animation frame is rejected');
spin.foreground=true;p.properties.flush();a=animations.at(-1);assert.equal(a.played,1);
spin.reduceMotion=true;p.properties.flush();assert.equal(spin.angle,0);assert.equal(a.cancelled,1);
spin.reduceMotion=false;p.properties.flush();a=animations.at(-1);a.onFrame(90);p.properties.flush();assert.equal(spin.angle,90);
const departing=a.onFrame;spin.aboutToDisappear();p.properties.flush();assert.equal(a.cancelled,1);assert.equal(spin.angle,0);
departing(270);p.properties.flush();assert.equal(spin.angle,0,'active disappearance cancels and rejects a retained native frame');

const progress=new deps.SourceSwitchProgress(undefined,{sourceName:'新书源',chapterTitle:'第 20 章',statusText:'正在载入章节…',topInset:24,bottomInset:24},undefined,++serial);
progress.aboutToAppear();progress.initialRender();const progressNodes=p.nodes(progress);
assert.equal(progressNodes.find(n=>n.type==='Scroll').backgroundColor,readerAppColor('TOK_SS_PROGRESS_BG','day'));
assert.equal(progressNodes.find(n=>n.constraintSize?.maxWidth===v.switchContentMaxWidth).constraintSize.maxWidth,290);
const slot=progressNodes.find(n=>n.type==='Row'&&n.width===v.switchSpinnerSlotSize);assert.equal(slot.height,48);assert.equal(slot.margin.bottom,15);
const progressSpin=p.walk(progress).find(c=>c instanceof deps.SourceSwitchSpinner);assert.equal(progressSpin.diameter,36);assert.equal(progressSpin.strokeWidth,3);assert.equal(progressSpin.durationMs,1800);
assert.ok(progressNodes.filter(n=>n.type==='Text').every(n=>n.halfLeading===true));
assert.deepEqual(progressNodes.find(n=>n.create==='正在载入章节…').margin,{top:17,bottom:5});progress.aboutToDisappear();
for(const scheme of ['day','night']){
 const toast=new deps.SourceSwitchCompletionOverlay(undefined,{mode:'toast',toastText:'已切换到新书源',safeLeft:7,safeRight:11,safeBottom:80},undefined,++serial);toast.appThemeScheme=scheme;toast.initialRender();
 const text=p.nodes(toast).find(n=>n.type==='Text');
 assert.deepEqual([text.fontFamily,text.fontWeight,text.fontSize,text.lineHeight,text.halfLeading],
  [families.READER_FONT_NOTO_SANS_SC_UI_REGULAR,v.toastFontWeight,v.toastFontSize,v.toastLineHeight,true]);
 assert.deepEqual(text.padding,{top:v.toastPaddingY,bottom:v.toastPaddingY,left:v.toastPaddingX,right:v.toastPaddingX});assert.equal(text.borderRadius,v.toastRadius);
 assert.equal(text.backgroundColor,readerAppColor('TOK_PRIMARY_DARK',scheme));assert.equal(text.fontColor,readerAppColor('TOK_ON_PRIMARY',scheme));
 assert.deepEqual(p.nodes(toast).find(n=>n.type==='Stack').padding,{left:7+v.toastSideInset,right:11+v.toastSideInset,bottom:80+v.toastSideInset});
 assert.deepEqual(text.constraintSize,{maxWidth:'100%'});
}
for(const theme of ['day','night'])for(const expanded of [false,true]){
 const wash=new deps.SourceSwitchCompletionOverlay(undefined,{mode:'wash',washOpacity:v.readerEnterFromOpacity,paperTheme:theme,expanded},undefined,++serial);wash.initialRender();
 const actualPaper=p.walk(wash).find(c=>c instanceof deps.ReaderPaperBackground);assert.ok(actualPaper,'completion wash renders the actual existing paper producer');
 const style=readerAppearanceThemeStyle(theme),paperNodes=p.nodes(actualPaper),suffix=expanded?'tablet':'phone';
 assert.equal(actualPaper.synchronousImages,true);assert.equal(p.nodes(wash).filter(n=>n.type==='Text').length,0);
 assert.ok(p.nodes(wash).some(n=>n.opacity===v.readerEnterFromOpacity&&n.hitTestBehavior==='HitTestMode.None'));
 assert.equal(paperNodes.find(n=>n.backgroundColor!==undefined).backgroundColor,style.paperStart,'actual wash paper retains the requested theme');
 assert.deepEqual(paperNodes.find(n=>n.linearGradient).linearGradient,{direction:'GradientDirection.Bottom',colors:[[style.paperStart,0],[style.paperEnd,1]]});
 const images=paperNodes.filter(n=>n.type==='Image');
 assert.deepEqual(images.map(n=>n.create),style.sourcePaperLighting?['app.media.reading_paper_'+suffix+'_shade','app.media.reading_paper_'+suffix+'_highlight']:[]);
 assert.ok(images.every(n=>n.syncLoad===true));
 assert.equal(paperNodes.find(n=>n.backgroundImage)?.backgroundImage[0],style.paperTexture?'app.media.reading_paper_'+suffix:undefined);
}

// The actual ReaderFonts functions determine four checked physical receipts.
// Neither submitted loads nor a failed face authorize initial native text.
const expectedFaces=design.fontAssets.map(asset=>families[asset.nativeFamilyConstant]);
for(const outcome of ['ready','reject','retired']){
 metrics=metricsApi.createDefaultReaderWindowMetrics();metrics.windowRect=new metricsApi.ReaderRectVp(0,0,390,844);
 const pending=new Map(),calls=[];
 const loaderSource=readFileSync(new URL('../entry/src/main/ets/app/ReaderFontLoadHost.ts',import.meta.url),'utf8').replace(/^import.*$/gm,'').replace(/^export /gm,'');
 const loader=new Function('text',stripTypeScriptTypes(loaderSource)+';return{loadReaderFontChecked,readerFontLoadReady};')({FontCollection:{getGlobalInstance:()=>({loadFontWithCheck(family,asset){
  calls.push({family,asset});return new Promise((resolve,reject)=>pending.set(family,{resolve,reject}));
 }})}});
 const fonts=sourceSwitchFontSdk({ready:loader.readerFontLoadReady,load:loader.loadReaderFontChecked});
 const fp=boundedSurfaceSdk({allowEmptyBranchAdmission:true}),fd=sourceSwitchLiveSdk(fp,{...fonts,ReaderWindowCoordinator:{metrics:()=>metrics},uiContext,setTimeout(){return 1;},clearTimeout(){}});
 const owner=new fd.SourceSwitchPanel(undefined,{contentKind:'text',state:{kind:'discovering'}},undefined,++serial);
 const manga=new fd.SourceSwitchPanel(undefined,{contentKind:'manga',state:{kind:'discovering'}},undefined,++serial);
 const preparation=new fd.SourceSwitchProgress(undefined,{sourceName:'新书源'},undefined,++serial);
 owner.aboutToAppear();owner.initialRender();manga.aboutToAppear();manga.initialRender();preparation.aboutToAppear();preparation.initialRender();
 assert.equal(fonts.sourceSwitchNovelFontsReady(),false);assert.equal(fp.nodes(owner).filter(n=>n.type==='Text').length,0);assert.equal(fp.nodes(preparation).filter(n=>n.type==='Text').length,0);assert.equal(fp.nodes(manga).filter(n=>n.type==='Text').length,0,'manga shares pending checked-font admission');
 for(const asset of design.fontAssets)assert.ok(calls.some(call=>call.family===families[asset.nativeFamilyConstant]&&call.asset===asset.file),'actual registrar loads the exact selected physical asset');
 if(outcome==='retired'){owner.aboutToDisappear();manga.aboutToDisappear();preparation.aboutToDisappear();}
 const medium=families.READER_FONT_NOTO_SANS_SC_UI_MEDIUM;
 for(const [family,load] of pending)if(family!==medium)load.resolve();
 await tick();assert.equal(owner.novelFontsReady,false,'three ready selected faces cannot authorize the fourth');assert.equal(manga.novelFontsReady,false);
 if(outcome==='reject')pending.get(medium).reject(Error('controlled checked face failure'));else pending.get(medium).resolve();
 await tick();fp.properties.flush();
 assert.equal(owner.novelFontsReady,outcome==='ready');assert.equal(preparation.novelFontsReady,outcome==='ready');assert.equal(manga.novelFontsReady,outcome==='ready');
 assert.equal(fp.nodes(owner).some(n=>n.type==='Text'),outcome==='ready');assert.equal(fp.nodes(preparation).some(n=>n.type==='Text'),outcome==='ready');assert.equal(fp.nodes(manga).some(n=>n.type==='Text'),outcome==='ready','manga shares checked ready/reject/retired font delivery');
 if(outcome!=='retired'){owner.aboutToDisappear();manga.aboutToDisappear();preparation.aboutToDisappear();}
 assert.equal(expectedFaces.filter(loader.readerFontLoadReady).length,outcome==='reject'?3:4,'only actual checked-load receipts mark physical faces ready');
}
// Actual-source negative controls prove these checks observe emitted native
// attributes rather than merely agreeing with a duplicated test-side formula.
const windowSource=readFileSync(new URL('../entry/src/main/ets/features/source/SourceSwitchWindow.ets',import.meta.url),'utf8');
for(const [from,to,property,expectedValue] of [
 ['.halfLeading(true)','.halfLeading(false)','halfLeading',true],
 ['.height(this.rowHeight).padding(','.height(this.rowHeight + 1).padding(','height',v.rowHeight],
]){
 const changed=windowSource.replace(from,to);assert.notEqual(changed,windowSource,'negative control mutates an actual selected row');
 const np=boundedSurfaceSdk(),nd=sourceSwitchLiveSdk(np,{ReaderWindowCoordinator:{metrics:()=>metrics},uiContext,setTimeout(){return 1;},clearTimeout(){}},{SourceSwitchPanel:changed});
 const no=new nd.SourceSwitchPanel(undefined,{contentKind:'text',state:{kind:'candidates',candidates:[candidate('negative')]}},undefined,++serial);no.aboutToAppear();no.initialRender();
 const row=np.walk(no).find(child=>child instanceof nd.SourceSwitchNovelRow);
 const node=np.nodes(row).find(n=>n.type===(property==='height'?'Row':'Text'));
 assert.throws(()=>assert.equal(node[property],expectedValue),'actual native '+property+' drift must be rejected');no.aboutToDisappear();
}
{
 const changed=windowSource.replace(".width('100%').height(this.headingHeight());",".width('100%').height(1);");assert.notEqual(changed,windowSource);
 const np=boundedSurfaceSdk(),nd=sourceSwitchLiveSdk(np,{ReaderWindowCoordinator:{metrics:()=>metrics},uiContext,setTimeout(){return 1;},clearTimeout(){}},{SourceSwitchPanel:changed});
 const no=new nd.SourceSwitchPanel(undefined,{contentKind:'text',state:{kind:'discovering'}},undefined,++serial);no.aboutToAppear();no.initialRender();
 const heading=[...no.nodes.values()].find(n=>n.type==='Row'&&n.create?.space===v.headingGap);
 assert.throws(()=>assert.equal(heading.height,v.headingHeight),'actual heading wiring drift is rejected');no.aboutToDisappear();
}
{
 const source=readFileSync(new URL('../entry/src/main/ets/features/source/SourceSwitchSpinner.ets',import.meta.url),'utf8');
 const changed=source.replace('this.mounted = false;\n    this.stopAnimation();','this.mounted = false;');assert.notEqual(changed,source);
 const np=boundedSurfaceSdk(),nd=sourceSwitchLiveSdk(np,{uiContext},{SourceSwitchSpinner:changed});
 const no=new nd.SourceSwitchSpinner(undefined,{active:true},undefined,++serial);no.aboutToAppear();no.initialRender();const animator=animations.at(-1);no.aboutToDisappear();
 assert.throws(()=>assert.equal(animator.cancelled,1),'active exit must cancel the actual animator');animator.cancel();
}
{
 const source=readFileSync(new URL('../entry/src/main/ets/features/reading/ReaderPaperBackground.ets',import.meta.url),'utf8');
 const changed=source.replace('readerAppearanceThemeStyle(this.theme)',"readerAppearanceThemeStyle('night')");assert.notEqual(changed,source);
 const np=boundedSurfaceSdk(),nd=sourceSwitchLiveSdk(np,{}, {ReaderPaperBackground:changed});
 const no=new nd.SourceSwitchCompletionOverlay(undefined,{mode:'wash',paperTheme:'day'},undefined,++serial);no.initialRender();
 const paper=np.walk(no).find(c=>c instanceof nd.ReaderPaperBackground),background=np.nodes(paper).find(n=>n.backgroundColor!==undefined);
 assert.throws(()=>assert.equal(background.backgroundColor,readerAppearanceThemeStyle('day').paperStart),'actual paper theme drift is rejected');
}
console.log('PASS source-switch actual SDK: 96 adaptive manga/text profiles + day/night short/large-font parity + baseline/extreme short +310/265 boundaries, count VF axis and static action glyph, independent click/visible geometry, exact day/night press cancellation, halfLeading, exact row identity, SVG animator lifecycle, actual permitted/blocked cancellation, and pending/reject/retired checked-font admission for both formats. Ace pixel layout and native frame timings remain VM evidence.');
