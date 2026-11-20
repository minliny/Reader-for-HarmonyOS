import { TOK_SCREEN_INSET } from '../../entry/src/main/ets/features/common/ReaderLayoutTokens.ts';
import { builderComponentMembers as boundedMembers } from './ets-builder-probe.mjs';
export { boundedMembers };
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { readerAppColor, readerThemeDefinition } from '../../entry/src/main/ets/features/common/ReaderThemeRegistry.ts';
import { readerTypographyRoles } from './reader-typography-probe.mjs';
import { createReaderComponentProbe as createReaderBuilderProbe } from './reader-component-probe.mjs';
import { createArkUIPropertyRuntimeProbe } from './arkui-property-runtime-probe.mjs';
import * as readerFonts from '../../entry/src/main/ets/features/common/ReaderFontFamilies.ts';
import { SOURCE_SWITCH_VISUAL } from '../../entry/src/main/ets/features/source/SourceSwitchVisual.ts';
import { ReaderInsetsVp } from '../../entry/src/main/ets/features/common/ReaderWindowMetrics.ts';
import * as transientFeedback from '../../entry/src/main/ets/features/common/ReaderTransientFeedback.ts';
import * as readerScrollLayout from '../../entry/src/main/ets/features/common/ReaderScrollLayout.ts';
import * as readerSelectGeometry from '../../entry/src/main/ets/features/common/ReaderSelectGeometry.ts';
import * as readerSelectAppearance from '../../entry/src/main/ets/features/common/ReaderSelectAppearanceStyle.ts';
import { MANGA_DIRECTORY_VISUAL } from '../../entry/src/main/ets/features/manga/MangaDirectoryVisual.ts';
const read=name=>readFileSync(new URL(`../../entry/src/main/ets/features/common/${name}.ets`,import.meta.url),'utf8');
const stripped=source=>stripTypeScriptTypes(source).replace(/^export /gm,'');
const tokenSource=read('ReaderTokens'),tokenNames=['TOK_SCREEN_INSET', ...[...tokenSource.matchAll(/^export const (\w+)/gm)].map(m=>m[1])];
const tokens=new Function('TOK_SCREEN_INSET','readerAppColor','readerThemeDefinition',`${stripped(tokenSource.replace(/^export \{[^;]+;\s*/gm,'')).replace(/^import[^;]+;\s*/gm,'')};return{${tokenNames.join(',')}};`)(TOK_SCREEN_INSET,readerAppColor,readerThemeDefinition);
// Keep the actual elevation function and live-density port in each fixture's
// closure. A changed source or another fixture cannot borrow its metrics.
export function readerSurfaceSpecsForProbe(metrics={densityPixels:1}) {
  return new Function('TextAlign','SOURCE_SWITCH_VISUAL','readerAppColor','ReaderWindowCoordinator',`${stripped(read('ReaderSurfaceSpecs')).replace(/^import[^;]+;\s*/gm,'')};return{resolvePopupSpec,resolveSheetSpec,resolveDialogSpec,resolveActionSheetSpec,resolveDrawerSpec,readerSurfaceElevation};`)(
    {Start:'TextAlign.Start',Center:'TextAlign.Center'},SOURCE_SWITCH_VISUAL,readerAppColor,{metrics:()=>metrics});
}
// Finite native color port for the actual per-book SVG stroke actor. Channel
// values come from the registry; this records the native constructor inputs,
// and does not simulate SVG rasterization or claim device pixel acceptance.
const colorRegistry=JSON.parse(readFileSync(new URL('../../../Reader-UI/theme/registry.json',import.meta.url),'utf8'));
const bookIconChannels=new Map(['day','night'].map(scheme=>{
 const c=colorRegistry.appRoles.TOK_DOWNLOAD_GREEN_INK[scheme];
 return[readerAppColor('TOK_DOWNLOAD_GREEN_INK',scheme),{red:c.r,green:c.g,blue:c.b,alpha:Math.round(c.a*255)}];
}));
const boundedColorMetrics={resourceColor:color=>({color,...bookIconChannels.get(color)})};
class BoundedColorFilter {
 constructor(matrix){assert.equal(matrix.length,20);assert.ok(matrix.every(Number.isFinite),'actual SVG color matrix has finite channels');this.matrix=matrix.slice();}
}
function classOf(source,name,deps){let start=source.indexOf(`export class ${name}`);
  if(start<0)start=source.indexOf(`class ${name}`);
  const end=source.indexOf('@Component',start);
  return new Function(...Object.keys(deps),`${stripped(source.slice(start,end))};return ${name};`)(...Object.values(deps));}
/** Test-specific composition: actual SDK emitted children, V1 property classes,
 * shared producer modifiers and mounted slots. Uses the existing compiler helper
 * unchanged. Native scheduling/removal/layout/focus are explicitly outside proof. */
export function boundedSurfaceSdk(options={}){
  const specs=readerSurfaceSpecsForProbe(options.windowMetrics??{densityPixels:1});
  const properties=options.properties??createArkUIPropertyRuntimeProbe();
  // The select family is leaf chrome with its own layout/motion modules. These
  // bounded cases assert host content/budgets, so a prop-compatible stub keeps
  // the tree mountable without importing that unrelated stack.
  const selectStubs={
    ReaderChoiceRow:'@Component\nexport struct ReaderChoiceRow {\n  @Prop specId: string = \'default-option\';\n  @Prop label: string = \'\';\n  @Prop selected: boolean = false;\n  @Prop showDivider: boolean = false;\n  @Prop scheme: string = \'day\';\n  @Prop availableWidth: number = 0;\n  @Prop chevronAngle: number = 0;\n  @Prop actionEnabled: boolean = true;\n  @Prop wrapLabel: boolean = false;\n  build() { Row() {} }\n}',
    ReaderSelect:'@Component\nexport struct ReaderSelect {\n  @Prop value: string = \'\';\n  @Prop options: string[] = [];\n  @Prop isOpen: boolean = false;\n  @Prop variant: string = \'default\';\n  @Prop reduceMotion: boolean = false;\n  @Prop controlWidth: number = 0;\n  onSelect: (index: number, value: string) => void = (): void => {};\n  build() { Row() {} }\n}',
    ReaderSelectPanel:'@Component\nexport struct ReaderSelectPanel {\n  @Prop value: string = \'\';\n  @Prop options: string[] = [];\n  @Prop x: number = 0;\n  @Prop y: number = 0;\n  @Prop variant: string = \'default\';\n  @Prop reduceMotion: boolean = false;\n  @Prop closing: boolean = false;\n  @Prop selectionId: string = \'\';\n  @Prop controlWidth: number = 0;\n  @Prop menuKind: string = \'standard\';\n  @Prop alignRight: boolean = false;\n  onSelect: (index: number, value: string) => void = (): void => {};\n  onDismiss: (identity: string) => void = (): void => {};\n  build() { Column() {} }\n}',
  };
  const childSources=Object.fromEntries(['ReaderRecoveryAction','ReaderRecoveryNotice','ReaderPageState','ReaderBoundedSurface','ReaderBoundedSurfaceHeader','ReaderBoundedSurfaceActions','ReaderActionMenuSurface','ReaderActionSheetContent','ReaderFormField','ReaderChoiceRow','ReaderSelect','ReaderSelectPanel','ReaderInlineSelect'].map(n=>[n,options[n]??selectStubs[n]??read(n)]));
  // Shared short feedback is mounted by an ancestor host; bounded-surface cases
  // only need the component to exist in the tree. A state-free stub avoids
  // binding the probe to AppStorage, which no bounded test owns.
  childSources.ReaderTransientToast=options.ReaderTransientToast??'@Component\nexport struct ReaderTransientToast {\n  @Prop priority: number = 0;\n  @Prop bounded: boolean = false;\n  build() { Column() {} }\n}';
  const typography = {...readerTypographyRoles,...options.typographyRoles};
  const ReaderMenuActionView=classOf(childSources.ReaderActionMenuSurface,'ReaderMenuActionView',{});
  const ReaderActionAccessibility=new Function('AccessibilityRoleType',`${stripped(read('ReaderActionAccessibility'))};return ReaderActionAccessibility;`)(
    {BUTTON:'AccessibilityRoleType.BUTTON'});
  const nativePan = options.panGesture ?? new Proxy({}, {get:()=>()=>{}});
  const nativeGesture = new Proxy({}, {get:()=>()=>{}});
  // ReaderControlSpecs is .ets; these ids describe only form-field chrome.
  const resolveReaderFormFieldSpec=()=>({width:'100%',nativeLayoutWeight:undefined,nativeInsets:undefined,
    transparentSurface:false,caretRole:undefined,placeholderStyle:undefined,allPadding:undefined,
    multiline:false,numberInput:false,text:{fontFamily:'sans-serif',fontWeight:400,fontSizeFp:14,lineHeightFp:20},
    height:42,radius:10,horizontalPadding:12,textRole:'TOK_READ_INK',surfaceRole:'app.surface.readerInput',
    placeholderRole:'app.reader.placeholder',hasBorder:true,borderRole:'app.border.readerConfig',borderWidth:0.5});
  const InputType=properties.sdk.InputType??{Normal:'InputType.Normal',Password:'InputType.Password',Email:'InputType.Email',Number:'InputType.Number'};
  const readerReadableFontScale=(fs)=>Number.isFinite(fs)&&fs>0?Math.max(1,fs):1;
  const readerScaledControlHeight=(base,lh,fs)=>Math.ceil((Number.isFinite(base)?Math.max(0,base):0)+
    (Number.isFinite(lh)?Math.max(0,lh):0)*Math.max(0,readerReadableFontScale(fs)-1));
  const deps={...properties.sdk,...specs,...tokens,...typography,...readerFonts,readerAppColor,ReaderInsetsVp,ReaderMenuActionView,ReaderActionAccessibility,
    ...transientFeedback,...readerScrollLayout,...readerSelectGeometry,...readerSelectAppearance,
    // Same formulas as ReaderSurfaceBudgets/ReaderSurfaceResolvers. That module
    // uses extensionless relative imports Node cannot load directly, so the
    // three console budgets it exposes for this surface are mirrored here.
    readerReadableFontScale,readerScaledControlHeight,InputType,
    readerActionTouchRegion:(width,height)=>({x:0,y:0,width,height}),
    // Module-private constant referenced by ReaderSelectPanel's field init.
    OPTION_H:44,TRIGGER_H:44,CHEVRON_W:12,CHEVRON_H:8,CHEVRON_GAP:8,
    SELECT_PAD:10,SELECT_CHROME:40,
    uiContext:{...(properties.sdk.uiContext??{}),
      px2vp:properties.sdk.uiContext?.px2vp??(v=>v/3),
      getMeasureUtils:properties.sdk.uiContext?.getMeasureUtils??(()=>({
        measureText:({textContent})=>({width:String(textContent).length*14}),
        measureTextSize:()=>({width:0,height:42})}))},
    TransitionEdge:properties.sdk.TransitionEdge??{TOP:'top',BOTTOM:'bottom',START:'start',END:'end'},
    TransitionEffect:properties.sdk.TransitionEffect??{IDENTITY:{animation(){return this;}},OPACITY:{animation(){return this;}},
      move:()=>({animation(){return this;}}),translate:()=>({animation(){return this;}}),
      opacity:()=>({animation(){return this;}}),asymmetric:()=>({animation(){return this;}})},
    registerReaderFonts:()=>undefined,
    readerInteractiveSafeLeft:()=>0,readerInteractiveSafeRight:()=>0,
    readerSurfaceElevation:()=>({radius:0,offsetY:0}),
    readerMotionAnimateParam:()=>({duration:200,curve:'ease-in-out'}),
    Placement:properties.sdk.Placement??{Left:'left',Right:'right',Top:'top',Bottom:'bottom',TopLeft:'top-left',TopRight:'top-right',
      BottomLeft:'bottom-left',BottomRight:'bottom-right',LeftTop:'left-top',LeftBottom:'left-bottom',
      RightTop:'right-top',RightBottom:'right-bottom'},
    resolveReaderFormFieldSpec,
    readerTtsManagerFooterHeight:(fs,lh=20)=>Math.ceil(76+Math.max(0,lh)*Math.max(0,Math.max(1,fs)-1)),
    readerTtsManagerDesignHeight:(fs,lh=20)=>58+Math.ceil(76+Math.max(0,lh)*Math.max(0,Math.max(1,fs)-1))+440,
    readerTtsManagerScrollHeight:(panel,fs,lh=20)=>Math.max(0,panel-(58+Math.ceil(76+Math.max(0,lh)*Math.max(0,Math.max(1,fs)-1)))),
    readerTtsManagerCompactThreshold:(fs,lh=20)=>58+Math.ceil(76+Math.max(0,lh)*Math.max(0,Math.max(1,fs)-1))+32,
    ReaderTransientFeedback:class{show(){return true;}reset(){}},
    // MotionSpec is an .ets registry. Mirror the ids these bounded surfaces use
    // from the same visual constants so duration/curve assertions stay real.
    motionAnimateParam:(id)=>{
      const sourceCurve={kind:'cubic-bezier',values:[SOURCE_SWITCH_VISUAL.easingX1,SOURCE_SWITCH_VISUAL.easingY1,
        SOURCE_SWITCH_VISUAL.easingX2,SOURCE_SWITCH_VISUAL.easingY2]};
      if(id==='source.switch.open')return{duration:SOURCE_SWITCH_VISUAL.openDurationMs,curve:sourceCurve};
      if(id==='source.switch.close')return{duration:SOURCE_SWITCH_VISUAL.closeDurationMs,curve:sourceCurve};
      if(id==='source.switch.row.enter')return{duration:SOURCE_SWITCH_VISUAL.rowEnterDurationMs,curve:sourceCurve};
      if(id==='manga.directory.fold')return{duration:MANGA_DIRECTORY_VISUAL.foldDuration,curve:'ease'};
      return{duration:200,curve:'ease-in-out'};
    },
    ColorMetrics:boundedColorMetrics,ColorFilter:BoundedColorFilter,
    PanGesture:nativePan, PanDirection:{Vertical:'vertical'}, GesturePriority:{Low:'low'},
    globalThis:{Gesture:nativeGesture,PanGesture:nativePan},
    ReaderBoundedFrameModifier:classOf(childSources.ReaderBoundedSurface,'ReaderBoundedFrameModifier',{...specs,readerAppColor,ReaderInsetsVp}),
    ReaderBoundedTitleModifier:classOf(childSources.ReaderBoundedSurfaceHeader,'ReaderBoundedTitleModifier',{readerAppColor,...typography}),
    ReaderBoundedFileActionModifier:classOf(childSources.ReaderBoundedSurfaceActions,'ReaderBoundedFileActionModifier',{}),
    ReaderFormFieldModifier:classOf(childSources.ReaderFormField,'ReaderFormFieldModifier',
      {readerAppColor,resolveReaderFormFieldSpec,readerReadableFontScale,readerScaledControlHeight,InputType}),
    ReaderActionSheetAction:classOf(childSources.ReaderActionSheetContent,'ReaderActionSheetAction',{ReaderMenuActionView}),
  };
  const hooks={...properties.hooks,childSources,mountChildren:true,lifecycleChildren:true,allowEmptyBranchAdmission:options.allowEmptyBranchAdmission===true};
  for(const name of Object.keys(childSources))deps[name]=createReaderBuilderProbe(childSources[name],boundedMembers(childSources[name]),deps,hooks).Component;
  const walk=owner=>[owner,...[...owner.children.values()].flatMap(child=>child.nodes?walk(child):[])];
  return {properties,deps,hooks,childSources,walk,nodes:owner=>walk(owner).flatMap(x=>[...x.nodes.values()]),
    consumer(source,names=boundedMembers(source),extra={},initialParams={},componentName){return createReaderBuilderProbe(source,names,{...deps,...extra},{...hooks,initialParams,componentName}).owner;}};
}
