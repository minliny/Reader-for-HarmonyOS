import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

export const CONTRACT_CASES = {
  "paper-status-composition": {
    "description": "Actual SDK paper/status/Shell window and theme composition; native raster/crop pixels unverified",
    "resources": []
  },
  "continuous-fixed-chrome": {
    "description": "Actual selected production stage composition, header-only update dependencies and omitted-call negative control; fake stage",
    "resources": []
  }
};

async function case_paper_status_composition() {
const { resolveEtsLoaderRoot } = await import('./lib/tool-environment.mjs');
const { default: assert } = await import('node:assert/strict');
const { readFileSync } = await import('node:fs');
const { createRequire, registerHooks, stripTypeScriptTypes } = await import('node:module');
const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
const { findReaderTheme, readerThemeDefinition, READER_THEME_DEFINITIONS } = await import('../entry/src/main/ets/features/common/ReaderThemeRegistry.ts');
const { ReaderRectVp } = await import('../entry/src/main/ets/features/common/ReaderWindowMetrics.ts');
const { readerAppearanceThemeStyle } = await import('../entry/src/main/ets/features/reading/ReaderAppearanceRenderStyle.ts');
const { readerWidthClass } = await import('../entry/src/main/ets/features/reading/ReaderLayoutGeometry.ts');
const { createArkUIPropertyRuntimeProbe } = await import('./lib/arkui-property-runtime-probe.mjs');
const { boundedMembers } = await import('./lib/bounded-surface-sdk-probe.mjs');
const { measureReaderPageChromeText, readerPageChromeTextMeasurements, readerPageChromeTopTextStyle } = await import('./lib/reader-page-chrome-measurement-probe.mjs');
const { ReaderPageChromeMeasurements, READER_PAGE_CHROME_BOOKMARK_SIZE, resolveReaderPageChromeLayout } = await import('../entry/src/main/ets/features/reading/ReaderPageChromeLayout.ts');
const { ReaderPageChromeSnapshot, formatReaderPageOrdinal, formatReaderPageProgress } = await import('../entry/src/main/ets/features/reading/ReaderPageChromeModel.ts');
const { READER_CONTROL_PROGRESS_MAX } = await import('../entry/src/main/ets/features/reading/ReaderControlGeometry.ts');
registerHooks({resolve(specifier,context,next){try{return next(specifier,context);}catch(error){
  if(specifier.startsWith('.')&&!specifier.endsWith('.ts'))return next(specifier+'.ts',context);throw error;
}}});
const { createDefaultReaderReadingLayout, resolveReaderReadingLayout } = await import('../entry/src/main/ets/features/reading/ReaderLayoutGeometry.ts');
const { createDefaultReaderAppearanceSnapshot } = await import('../entry/src/main/ets/features/reading/ReaderAppearanceState.ts');
const { createDefaultReaderSettingsSnapshot } = await import('../entry/src/main/ets/features/reading/ReaderSettingsState.ts');
const { readerRenderStageKind } = await import('../entry/src/main/ets/features/reading/ReaderRenderStageSpec.ts');
const { ReaderWindowMetricsSnapshot, ReaderInsetsVp } = await import('../entry/src/main/ets/features/common/ReaderWindowMetrics.ts');

const read = file => readFileSync(new URL(`../entry/src/main/ets/${file}`, import.meta.url), 'utf8');
const paperSource = read('features/reading/ReaderPaperBackground.ets');
const statusSource = read('features/reading/ReaderStatusBarPaper.ets');
const surfaceSource = read('features/reading/ReadingSurface.ets');
const shellSource = read('features/shell/ReaderShell.ets');
const lreSource = read('features/reading/LocalReadingExperience.ets');
const require = createRequire(import.meta.url);
const sdkRoot = resolveEtsLoaderRoot();
const syntax = require(`${sdkRoot}/lib/validate_ui_syntax.js`);
function register(name, source) {
  syntax.componentCollection.customComponents.add(name);
  syntax.propCollection.set(name, new Set([...source.matchAll(/@Prop\s+(\w+)\s*:/g)].map(m => m[1])));
}
register('ReaderPaperBackground', paperSource);
register('ReaderStatusBarPaper', statusSource);
class Child { constructor(owner, params, _storage, id) { Object.assign(this, { owner, params, id }); } }
const enums = Object.fromEntries(['GradientDirection', 'ImageFit', 'ImageInterpolation', 'ImageRepeat'].map(name =>
  [name, new Proxy({}, { get: (_target, key) => `${name}.${key}` })]));
function paper(params) {
  const owner = createReaderBuilderProbe(paperSource, ['build', 'themeStyle', 'paperTexture', 'paperHighlight', 'paperShade'], {
    readerAppearanceThemeStyle, ...enums,
  }).owner;
  Object.assign(owner, { synchronousImages: false, ...params }); owner.initialRender(); return owner;
}
function status(params) {
  const owner = createReaderBuilderProbe(statusSource, ['build'], {
    findReaderTheme, readerThemeDefinition, ReaderPaperBackground: Child,
  }).owner;
  Object.assign(owner, params); owner.initialRender(); return owner;
}
function statusGeometry(owner, rect, viewport) {
  const nodes = [...owner.nodes.values()];
  const crop = nodes.find(n => n.clip === true);
  const background = nodes.find(n => n.type === '__Common__');
  assert.deepEqual([crop.width, crop.height, crop.position], [rect.width, rect.height, { x: rect.left, y: rect.top }]);
  assert.equal(crop.hitTestBehavior, 'HitTestMode.None');
  assert.deepEqual([background.width, background.height], viewport);
  assert.equal(crop.position.x + background.position.x, 0, 'texture origin stays in window coordinates');
  assert.equal(crop.position.y + background.position.y, 0, 'status crop never restarts or scales the paper texture');
}
let cases = 0;
for (const theme of READER_THEME_DEFINITIONS) for (const expanded of [false, true]) {
  const viewport = expanded ? [760, 960] : [390, 844];
  const page = paper({ theme: theme.id, expanded, synchronousImages: true });
  const rect = new ReaderRectVp(3, 2, viewport[0] - 6, 48);
  const band = status({ theme: theme.id, expanded, viewportWidth: viewport[0], viewportHeight: viewport[1], statusRect: rect,
    fallbackColor: theme.paperStart });
  statusGeometry(band, rect, viewport);
  const bandProps = [...band.children.values()][0].params;
  assert.deepEqual(bandProps, { theme: theme.id, expanded });
  const stripe = paper(bandProps);
  function signature(owner) {
    return [...owner.nodes.values()].filter(n => n.type !== 'If').map(n => ({
      type: n.type, create: n.create, linearGradient: n.linearGradient,
      backgroundColor: n.backgroundColor, backgroundImage: n.backgroundImage,
      backgroundImageSize: n.backgroundImageSize, backgroundImagePosition: n.backgroundImagePosition,
      width: n.width, height: n.height,
    }));
  }
  assert.deepEqual(signature(stripe), signature(page), `${theme.id}: page and status use identical SDK-emitted paper nodes`);
  const texture = [...page.nodes.values()].filter(n => n.backgroundImage);
  assert.equal(texture.length, theme.paperTexture ? 1 : 0);
  if (texture.length) {
    assert.deepEqual(texture[0].backgroundImage, [`app.media.reading_paper_${expanded ? 'tablet' : 'phone'}`, 'ImageRepeat.XY']);
    assert.deepEqual(texture[0].backgroundImageSize, { width: 100, height: 100 });
    assert.equal(texture[0].backgroundImagePosition, 'Alignment.TopStart');
  }
  const images = [...page.nodes.values()].filter(n => n.type === 'Image');
  assert.equal(images.length, theme.sourcePaperLighting ? 2 : 0);
  for (const image of images) assert.equal(image.syncLoad, true, 'synchronous page raster still forwards image admission');
  const paintNodes = [...page.nodes.values()];
  const baseIndex = paintNodes.findIndex(node => node.linearGradient);
  const textureIndex = paintNodes.findIndex(node => node.backgroundImage);
  assert.ok(baseIndex >= 0, 'every paper theme retains an opaque color base');
  for (const image of images) {
    assert.ok(baseIndex < paintNodes.indexOf(image), 'translucent lighting must be above the opaque paper base');
    if (textureIndex >= 0) assert.ok(paintNodes.indexOf(image) < textureIndex,
      'paper grain remains above lighting');
  }
  cases++;
}

const moving = status({ theme: 'paper', expanded: false, viewportWidth: 390, viewportHeight: 844,
  statusRect: new ReaderRectVp(), fallbackColor: '#FFEEE4D0' });
const count = moving.observers.length;
Object.assign(moving, { statusRect: new ReaderRectVp(4, 3, 382, 52), viewportWidth: 760, viewportHeight: 960,
  theme: 'paperNight', expanded: true });
moving.replay();
assert.equal(moving.observers.length, count, 'late geometry and theme changes retain the status composition');
statusGeometry(moving, moving.statusRect, [760, 960]);
assert.deepEqual([...moving.children.values()][0].params, { theme: 'paperNight', expanded: true });
for (const theme of ['', 'missing-theme']) {
  const fallback = status({ theme, expanded: false, viewportWidth: 390, viewportHeight: 844,
    statusRect: new ReaderRectVp(0, 0, 390, 48), fallbackColor: '#FF413020' });
  assert.equal(fallback.children.size, 0);
  assert.equal([...fallback.nodes.values()].find(n => n.clip).backgroundColor, '#FF413020',
    'unknown owner theme keeps the requested opaque underlay; never replaces it with default day paper');
}

for (const theme of READER_THEME_DEFINITIONS) for (const route of ['directory', 'reading']) {
  let metrics = { windowRect: new ReaderRectVp(0, 0, 390, 844), statusBarRect: new ReaderRectVp(2, 1, 386, 48) };
  const shell = createReaderBuilderProbe(shellSource, ['overlayStatusBarUnderlay', 'chromeMetrics'], {
    ReaderStatusBarPaper: Child, readerWidthClass, ReaderWindowCoordinator: { metrics: () => metrics },
  }).owner;
  Object.assign(shell, { visible: true, route, sourceSwitchVisible: route === 'reading', isTablet: false,
    chromePaperThemeId: theme.id, chromeUnderlayColor: theme.paperStart, windowMetricsRevision: 1 });
  shell.overlayStatusBarUnderlay();
  const wrapper = [...shell.nodes.values()].find(n => n.id === 'reader-overlay-status-bar-underlay');
  assert.equal(wrapper.zIndex, 10); assert.equal(wrapper.hitTestBehavior, 'HitTestMode.None');
  const props = [...shell.children.values()][0].params;
  assert.equal(props.theme, theme.id); assert.deepEqual(props.statusRect, metrics.statusBarRect);
  statusGeometry(status(props), metrics.statusBarRect, [390, 844]);
  metrics = { windowRect: new ReaderRectVp(0, 0, 760, 960), statusBarRect: new ReaderRectVp(1, 2, 758, 50) };
  shell.chromePaperThemeId = 'paperNight'; shell.windowMetricsRevision++;
  shell.replay();
  const updated = [...shell.children.values()][0].params;
  assert.equal(updated.theme, 'paperNight'); assert.equal(updated.expanded, true);
  statusGeometry(status(updated), metrics.statusBarRect, [760, 960]);
}

for (const extend of [false, true]) for (const controls of [false, true]) for (const hideStatusBar of [false, true]) {
  const owner = createReaderBuilderProbe(lreSource, ['readerStatusBarUnderlay', 'readerStatusBarMetrics'], {
    ReaderStatusBarPaper: Child, readerAppearanceThemeStyle,
    ReaderWindowCoordinator: { metrics: () => ({ statusBarRect: new ReaderRectVp(0, 0, 390, 48) }) },
  }).owner;
  Object.assign(owner, { windowChromeActive: true, readerSettingsSnapshot: { extendIntoCutout: extend, hideStatusBar },
    windowControlsPresented: controls, readerWindowMetricsRevision: 1, appearanceSnapshot: { activeTheme: 'paper' },
    readingLayout: () => ({ viewportWidth: 390, viewportHeight: 844, widthClass: 'compact' }) });
  owner.readerStatusBarUnderlay();
  assert.equal(owner.children.size, controls || !hideStatusBar ? 1 : 0,
    'both extension modes cover page information exactly when the native status bar is visible');
  if (owner.children.size) {
    const wrapper = [...owner.nodes.values()].find(n => n.id === 'reader-status-bar-underlay');
    assert.equal(wrapper.zIndex, 10, 'visible native status owns stationary paper above page information');
    statusGeometry(status([...owner.children.values()][0].params), new ReaderRectVp(0, 0, 390, 48), [390, 844]);
  }
}


}

async function case_continuous_fixed_chrome() {
const { resolveEtsLoaderRoot } = await import('./lib/tool-environment.mjs');
const { default: assert } = await import('node:assert/strict');
const { readFileSync } = await import('node:fs');
const { createRequire, registerHooks, stripTypeScriptTypes } = await import('node:module');
const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
const { findReaderTheme, readerThemeDefinition, READER_THEME_DEFINITIONS } = await import('../entry/src/main/ets/features/common/ReaderThemeRegistry.ts');
const { ReaderRectVp } = await import('../entry/src/main/ets/features/common/ReaderWindowMetrics.ts');
const { readerAppearanceThemeStyle } = await import('../entry/src/main/ets/features/reading/ReaderAppearanceRenderStyle.ts');
const { readerWidthClass } = await import('../entry/src/main/ets/features/reading/ReaderLayoutGeometry.ts');
const { createArkUIPropertyRuntimeProbe } = await import('./lib/arkui-property-runtime-probe.mjs');
const { boundedMembers } = await import('./lib/bounded-surface-sdk-probe.mjs');
const { measureReaderPageChromeText, readerPageChromeTextMeasurements, readerPageChromeTopTextStyle } = await import('./lib/reader-page-chrome-measurement-probe.mjs');
const { ReaderPageChromeMeasurements, READER_PAGE_CHROME_BOOKMARK_SIZE, resolveReaderPageChromeLayout } = await import('../entry/src/main/ets/features/reading/ReaderPageChromeLayout.ts');
const { ReaderPageChromeSnapshot, formatReaderPageOrdinal, formatReaderPageProgress } = await import('../entry/src/main/ets/features/reading/ReaderPageChromeModel.ts');
const { READER_CONTROL_PROGRESS_MAX } = await import('../entry/src/main/ets/features/reading/ReaderControlGeometry.ts');
registerHooks({resolve(specifier,context,next){try{return next(specifier,context);}catch(error){
  if(specifier.startsWith('.')&&!specifier.endsWith('.ts'))return next(specifier+'.ts',context);throw error;
}}});
const { createDefaultReaderReadingLayout, resolveReaderReadingLayout } = await import('../entry/src/main/ets/features/reading/ReaderLayoutGeometry.ts');
const { createDefaultReaderAppearanceSnapshot } = await import('../entry/src/main/ets/features/reading/ReaderAppearanceState.ts');
const { createDefaultReaderSettingsSnapshot } = await import('../entry/src/main/ets/features/reading/ReaderSettingsState.ts');
const { readerRenderStageKind } = await import('../entry/src/main/ets/features/reading/ReaderRenderStageSpec.ts');
const { ReaderWindowMetricsSnapshot, ReaderInsetsVp } = await import('../entry/src/main/ets/features/common/ReaderWindowMetrics.ts');

const read = file => readFileSync(new URL(`../entry/src/main/ets/${file}`, import.meta.url), 'utf8');
const paperSource = read('features/reading/ReaderPaperBackground.ets');
const statusSource = read('features/reading/ReaderStatusBarPaper.ets');
const surfaceSource = read('features/reading/ReadingSurface.ets');
const shellSource = read('features/shell/ReaderShell.ets');
const lreSource = read('features/reading/LocalReadingExperience.ets');
const require = createRequire(import.meta.url);
const sdkRoot = resolveEtsLoaderRoot();
const syntax = require(`${sdkRoot}/lib/validate_ui_syntax.js`);
function register(name, source) {
  syntax.componentCollection.customComponents.add(name);
  syntax.propCollection.set(name, new Set([...source.matchAll(/@Prop\s+(\w+)\s*:/g)].map(m => m[1])));
}
register('ReaderPaperBackground', paperSource);
register('ReaderStatusBarPaper', statusSource);
class Child { constructor(owner, params, _storage, id) { Object.assign(this, { owner, params, id }); } }
const enums = Object.fromEntries(['GradientDirection', 'ImageFit', 'ImageInterpolation', 'ImageRepeat'].map(name =>
  [name, new Proxy({}, { get: (_target, key) => `${name}.${key}` })]));
function paper(params) {
  const owner = createReaderBuilderProbe(paperSource, ['build', 'themeStyle', 'paperTexture', 'paperHighlight', 'paperShade'], {
    readerAppearanceThemeStyle, ...enums,
  }).owner;
  Object.assign(owner, { synchronousImages: false, ...params }); owner.initialRender(); return owner;
}
function status(params) {
  const owner = createReaderBuilderProbe(statusSource, ['build'], {
    findReaderTheme, readerThemeDefinition, ReaderPaperBackground: Child,
  }).owner;
  Object.assign(owner, params); owner.initialRender(); return owner;
}
function statusGeometry(owner, rect, viewport) {
  const nodes = [...owner.nodes.values()];
  const crop = nodes.find(n => n.clip === true);
  const background = nodes.find(n => n.type === '__Common__');
  assert.deepEqual([crop.width, crop.height, crop.position], [rect.width, rect.height, { x: rect.left, y: rect.top }]);
  assert.equal(crop.hitTestBehavior, 'HitTestMode.None');
  assert.deepEqual([background.width, background.height], viewport);
  assert.equal(crop.position.x + background.position.x, 0, 'texture origin stays in window coordinates');
  assert.equal(crop.position.y + background.position.y, 0, 'status crop never restarts or scales the paper texture');
}
let cases = 0;
// Compile the production stage-selection block verbatim, excluding only the
// unrelated controls/input overlays. Real SDK properties track which observer
// consumes the new display value; a progress update must leave the stage alone.
{
  const ts=require(`${sdkRoot}/node_modules/typescript`),opts=require(`${sdkRoot}/lib/ets_checker.js`).compilerOptions;
  const parse=(text,file)=>ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,opts);
  const tree=parse(lreSource,'ContinuousChrome.ets'),component=tree.statements.find(n=>n.name?.text==='ReadingExperience');
  const member=name=>{const value=component.members.find(m=>m.name?.getText(tree)===name);assert.ok(value,name);return value.getText(tree);};
  const start=lreSource.indexOf('      if (readerRenderStageKind('),end=lreSource.indexOf('      this.sourceSwitchCompletionWash();',start);
  assert.ok(start>0&&end>start);
  const stageBlock=lreSource.slice(start,end);
  const continuousSource=read('features/reading/ReaderContinuousReadingStage.ets');
  const continuousTree=parse(continuousSource,'ContinuousStage.ets');
  const dataClass=continuousTree.statements.find(n=>n.name?.text==='ContinuousFragmentDataSource');
  const DataSource=new Function(stripTypeScriptTypes(dataClass.getText(continuousTree))+';return ContinuousFragmentDataSource;')();
  const pageTree=parse(read('features/reading/ReaderPageTurnStage.ets'),'PageTurnStage.ets');
  const renderClass=pageTree.statements.find(n=>n.name?.text==='ReaderPageTurnRenderPage');
  const RenderPage=new Function('ReaderPageChromeSnapshot',stripTypeScriptTypes(renderClass.getText(pageTree)).replace(/^export /,'')+
    ';return ReaderPageTurnRenderPage;')(ReaderPageChromeSnapshot);
  const selected=['continuousPageChromeContent','continuousPageChromeSnapshot','continuousChromeProgressText',
    'continuousRenderRevision','sessionLaunch','pageChromeClockText','pageChromeSnapshot','pageChromeProgress',
    'pageChromeChapterTitle','currentChapterIndex','normalizedProgress','pageChromeOrdinal','onContinuousVisibleRangeChanged',
    'currentPageTurnRenderPage','pageChromePaginationKey','bookTurnTextureIdentity','bookTurnSurfaceIdentity'];
  const scene='@Component struct ReadingExperience {\n'+selected.map(member).join('\n')+
    '\nbuild(){Stack({alignContent:Alignment.TopStart}){\n'+stageBlock+'\n}}\n}';
  let continuousCases=0;
  function fixture(cold=false,launch=false,definition=scene,suppressed=false){
    const properties=createArkUIPropertyRuntimeProbe(),appearance=createDefaultReaderAppearanceSnapshot();
    const window=new ReaderWindowMetricsSnapshot();Object.assign(window,{ready:true,statusBarHeight:48,
      statusBarRect:new ReaderRectVp(0,0,390,48),systemInsets:new ReaderInsetsVp()});
    const layout=resolveReaderReadingLayout(390,844,false,window,false),stageUpdates=[];
    const uiContext={px2vp:value=>value/3,fp2px:value=>value*3,px2fp:value=>value/3,
      getHostContext:()=>({resourceManager:{getNumber:()=>48}}),getMeasureUtils:()=>({
        measureTextSize:({textContent})=>({width:textContent.length*21,height:60}),
        measureText:({textContent})=>textContent.length*21})};
    const chromeSource=read('features/reading/ReaderPageChrome.ets');
    const deps={...properties.sdk,uiContext,createDefaultReaderReadingLayout,createDefaultReaderAppearanceSnapshot,
      ReaderPageChromeMeasurements,READER_PAGE_CHROME_BOOKMARK_SIZE,resolveReaderPageChromeLayout,
      measureReaderPageChromeText,readerPageChromeTextMeasurements,readerPageChromeTopTextStyle};
    const hooks={...properties.hooks,childSources:{ReaderPageChrome:chromeSource},mountChildren:true,allowEmptyBranchAdmission:true};
    const ChromeBase=createReaderBuilderProbe(chromeSource,boundedMembers(chromeSource),deps,hooks).Component;
    // Native StorageLink delivery is the explicit seam; the linked property's
    // SDK class, actual conditional Builders and retained Text are unmodified.
    class Chrome extends ChromeBase{
      constructor(owner,params,storage,id){super(owner,params,storage,id);this.topInfoSuppressed=suppressed;}
    }
    class ContinuousPort{
      constructor(owner,params,_storage,id){Object.assign(this,{owner,params,id,children:new Map(),nodes:new Map()});
        this.dataSource=new DataSource();this.dataSource.replace(params.fragmentsProvider());}
      updateStateVars(params){stageUpdates.push(params);Object.assign(this.params,params);}
    }
    class PagedPort{
      constructor(owner,params,_storage,id){Object.assign(this,{owner,params,id,children:new Map(),nodes:new Map()});
        const page=params.currentPageProvider();
        this.header=new Chrome(this,{topStartText:page.chromeTopStartText,topEndText:page.chromeTopEndText,
          bottomStartText:page.chromeBottomStartText,bottomEndText:page.chromeBottomEndText,
          layout:params.layout,appearance:params.appearance},undefined,-1);
        this.children.set(-1,this.header);this.header.initialRender();}
      updateStateVars(params){stageUpdates.push(params);Object.assign(this.params,params);}
    }
    const {owner}=createReaderBuilderProbe(definition,['build',...selected],{
      ...deps,ReaderPageChrome:Chrome,ReaderContinuousReadingStage:ContinuousPort,ReaderPageTurnStage:PagedPort,
      ReaderBookTurnSurface:Child,
      ReaderPageTurnRenderPage:RenderPage,ReaderPageChromeSnapshot,formatReaderPageOrdinal,formatReaderPageProgress,
      readerRenderStageKind,READER_CONTROL_PROGRESS_MAX,formatReaderPageClock:()=> '12:30',
    },{...hooks,childSources:{...hooks.childSources,ReaderContinuousReadingStage:continuousSource,
      ReaderPageTurnStage:read('features/reading/ReaderPageTurnStage.ets'),
      ReaderBookTurnSurface:read('features/reading/ReaderBookTurnSurface.ets')}});
    const fragments=[{id:'visible-first',startScalar:0,endScalar:1000,text:'正文',imageHeight:0}];
    Object.assign(owner,{bookTitle:'连续书名',sourceId:'s',bookId:'b',readerSettingsSnapshot:{navigationMode:'continuous'},
      chapter:cold?undefined:{chapterIndex:2,chapterTitle:'当前章'},chapterLayoutMap:{scalarCount:()=>1000},
      continuousFragments:fragments,continuousVisibleScalar:cold?0:250,continuousProgressRevision:0,
      continuousRenderChapterIdentity:'s:b:2',continuousRenderChapterTitle:'当前章',continuousRenderGeometryKey:'geometry',
      entryCatalogPending:cold,entryCatalogNavigation:cold?undefined:{readableChapterCount:10},contentMetrics:undefined,
      physicalPagination:{draft:undefined},materializedContentVersion:'',pageTurnFrozenRevision:-1,pageTurnRenderRevision:0,
      visiblePage:undefined,visibleFragments:[],appearanceSnapshot:appearance,
      hasContinuousRenderContent:()=>!cold,readingLayout:()=>layout,visibleReadingAppearance:()=>appearance,
      readingTocEntries:()=>[],readableChapterPosition:index=>index,shouldShowSessionCapsule:()=>false,
      activeSessionCapsuleWidth:()=>0,activeSessionCapsuleHeight:()=>0,
      autoPageHighlightStart:()=>undefined,autoPageHighlightEnd:()=>undefined,readerTextSelectionEnabled:()=>false,
      isReaderPageInteractionEnabled:()=>true,sourceSwitchContinuousRangeObserver:()=>()=>{},
      usesBookTurnSimulation:()=>false,effectivePageTurnStyle:()=> 'none',pageTurnStageViewportWidth:()=>390,
      shouldMountBookTurnSurface:()=>false,resolveVisibleContinuousImages(){},hasPartialEntryWindow:()=>false,
    });
    owner.pageChromeClockText='12:30';owner.sessionLaunch=launch?{ownership:'stage'}:undefined;
    owner.initialRender();properties.flush();
    const walk=value=>[value,...[...(value.children?.values()??[])].flatMap(walk)];
    const header=()=>walk(owner).filter(child=>child instanceof Chrome);
    const labels=()=>header().flatMap(child=>[...child.nodes.values()].filter(node=>node.type==='Text').map(node=>node.create));
    return{owner,properties,fragments,stageUpdates,header,labels,
      stage:[...owner.children.values()].find(child=>child instanceof ContinuousPort||child instanceof PagedPort)};
  }
  for(const cold of[false,true])for(const controls of[false,true]){
    const f=fixture(cold,false,scene,controls);assert.equal(f.header().length,1,'cold fallback and ready continuous each own exactly one normal header');
    assert.equal(f.labels().includes('连续书名'),!controls);assert.equal(f.labels().includes('12:30'),!controls);
    assert.ok(f.labels().includes(cold?'—':'23%'),'progress comes from the existing exact chapter/scalar projection');
    const header=f.header()[0];
    if(controls){
      header.topInfoSuppressed=false;f.properties.flush();
      assert.ok(f.labels().includes('连续书名')&&f.labels().includes('12:30'),'closing controls restores the same retained information layer');
    }
    assert.equal(f.header().length,1);continuousCases++;
  }
  const running=fixture(),stage=running.stage,source=stage.dataSource,fragment=source.getData(0);
  const header=running.header()[0];running.stageUpdates.length=0;
  running.owner.onContinuousVisibleRangeChanged(0,0,.6);running.properties.flush();
  assert.ok(running.labels().includes('26%'),'visible scalar changes update the actual stationary progress Text');
  assert.equal(running.stage,stage);assert.equal(stage.dataSource,source);assert.equal(source.getData(0),fragment);
  assert.equal(running.owner.continuousFragments,running.fragments);assert.equal(stage.params.fragmentsProvider(),running.fragments);
  assert.equal(running.stageUpdates.length,0,'header display updates cannot schedule a continuous-stage Prop refresh or replace its data source');
  assert.equal(running.header()[0],header);
  const display=running.owner.continuousChromeProgressText;
  running.owner.onContinuousVisibleRangeChanged(0,0,.601);running.properties.flush();
  assert.equal(running.owner.continuousChromeProgressText,display,'a scalar change within the same displayed percentage has no new chrome display value');
  assert.equal(running.stageUpdates.length,0);
  assert.equal(fixture(false,true).header().length,0,'the existing session-launch overlay exclusively owns chrome during launch');
  const omitted=scene.replace('this.continuousPageChromeContent();','');
  assert.notEqual(omitted,scene,'negative control removes only the newly connected production call');
  assert.throws(()=>assert.equal(fixture(false,false,omitted).header().length,1,'continuous must mount its one shared header'),
    /continuous must mount its one shared header/,'the original missing call fails the same actual SDK composition');
  console.log(`PASS continuous chrome: ${continuousCases} real SDK cold/ready Text, control suppression, one header, launch exclusion and header-only progress dependency; stage/list paint and native StorageLink delivery are controlled boundaries.`);
}


}

const implementations = {'paper-status-composition':case_paper_status_composition,'continuous-fixed-chrome':case_continuous_fixed_chrome};
for (const id of selectContractCases(CONTRACT_CASES)) {
  await implementations[id]();
  recordContractCasePass(id);
}
