import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

export const CONTRACT_CASES = {
  'phone-first-measurement': { description: 'Unavailable initial viewport emits no native Tab material; the real navigation frame admits the first finite positive material. Native fan causality remains open.', resources: [] },
  'phone-child-containment': { description: 'Actual paid phone-tab geometry disables redundant parent clipping, narrow valid surfaces retain it and unavailable geometry emits no native material; no native raster claim.', resources: [] },
  'current-phone-shape': { description: 'Current phone Tab and six exact callers have a single measured material and outer shadow with bounded inner clipping, reject stale geometry and cannot restore phone Canvas; no Native raster claim.', resources: [] },
  'measurement-identity': { description: 'Actual phone shape and footer handlers retain accepted geometry while rejecting retired measurement callbacks.', resources: [] },
  'footer-propagation': { description: 'Actual nonstandard bookshelf and standard settings consume measured occupied footer extent, including all three bookshelf states.', resources: [] },
};

let contextPromise;
async function context() {
  if (contextPromise) return contextPromise;
  contextPromise = (async () => {
    const { default: assert } = await import('node:assert/strict');
    const { readFileSync, existsSync } = await import('node:fs');
    const { fileURLToPath } = await import('node:url');
    const { installedEtsCompiler } = await import('./lib/ets-compiler-runtime.mjs');
    const { selectedProductionMethods } = await import('./lib/selected-production-methods.mjs');
    const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
    const { createArkUIPropertyRuntimeProbe } = await import('./lib/arkui-property-runtime-probe.mjs');
    const { actualReaderPageShell, actualReaderFloatingBarMetrics, actualReaderPageLayout } = await import('./lib/reader-page-shell-runtime-probe.mjs');
    const { actualReaderMainTabs, actualReaderPhoneNavigationGeometry } = await import('./lib/reader-phone-navigation-source.mjs');
    const { ts, options } = installedEtsCompiler();
    const root = new URL('../entry/src/main/ets/', import.meta.url);
    const file = path => new URL(path, root);
    const read = path => readFileSync(file(path), 'utf8');
    const metrics = { ready: true, densityPixels: 1, systemFontScale: 1,
      windowRect: { width: 390, height: 844 },
      systemInsets: { top: 39, bottom: 0, left: 0, right: 0 }, cutoutInsets: { top: 0, bottom: 0, left: 0, right: 0 },
      navigationInsets: { top: 0, bottom: 0, left: 0, right: 0 }, gestureInsets: { top: 0, bottom: 0, left: 0, right: 0 },
      keyboardInsets: { top: 0, bottom: 0, left: 0, right: 0 } };
    const values = new Map([['readerMainViewport', { width: 390, height: 844 }]]);
    const AppStorage = { get: key => values.get(key), setOrCreate: (key, value) => values.set(key, value) };
    const coordinator = { metrics: () => metrics };
    const modules = new Map();
    const enums = Object.fromEntries(['TextAlign', 'FontWeight', 'Color', 'BlurStyle', 'ThemeColorMode', 'ShadowType']
      .map(name => [name, new Proxy({}, { get: (_, key) => `${name}.${String(key)}` })]));
    function load(path) {
      let url = file(path);
      if (!existsSync(url)) url = file(path + (existsSync(file(path + '.ts')) ? '.ts' : '.ets'));
      if (modules.has(url.href)) return modules.get(url.href);
      const source = readFileSync(url, 'utf8');
      const emitted = ts.transpileModule(source, { fileName: fileURLToPath(url), reportDiagnostics: true,
        compilerOptions: { target: ts.ScriptTarget.ES2021, module: ts.ModuleKind.CommonJS } });
      assert.deepEqual(emitted.diagnostics, [], `actual ordinary module emits: ${url.pathname}`);
      const result = {}; modules.set(url.href, result);
      new Function('exports', 'require', 'AppStorage', ...Object.keys(enums), emitted.outputText)(result, name => {
        if (name.endsWith('/ReaderWindowCoordinator')) return { ReaderWindowCoordinator: coordinator };
        assert.ok(name.startsWith('.'), `unlisted platform module: ${name}`);
        const target = new URL(name, url);
        return load(fileURLToPath(target).slice(fileURLToPath(root).length));
      }, AppStorage, ...Object.values(enums));
      return result;
    }
    load('ui/foundation/ReaderWindowEnvironment.ts').bindReaderWindowMetricsSource(() => metrics);
    const properties = createArkUIPropertyRuntimeProbe();
    const page = actualReaderPageShell(), floating = actualReaderFloatingBarMetrics(), layout = actualReaderPageLayout();
    const deps = { ...properties.sdk, ...page, ...floating, ...layout,
      ...load('ui/foundation/ReaderTokens.ets'), ...load('ui/foundation/ReaderTypography.ets'),
      ...load('ui/foundation/ReaderWindowMetrics.ts'), ...load('ui/layout/ReaderRaisedShape.ts'),
      ...load('app/ReaderStartupTrace.ts'),
      ...load('ui/surfaces/ReaderSurfaceSpecs.ets'), ...load('ui/layout/ReaderFrameStyle.ts'),
      ...actualReaderMainTabs(), ReaderWindowCoordinator: coordinator, AppStorage };
    Object.assign(deps, actualReaderPhoneNavigationGeometry({ ...deps, readerVisualSafeTop: deps.readerVisualSafeTop }));
    Object.assign(deps, load('features/shell/MainNavigationSpec.ts'));
    deps.publishReaderMainViewport(390,844);
    class Child {
      constructor(owner, params, _storage, id) { Object.assign(this, { owner, params, id }); }
      updateStateVars(params) { Object.assign(this.params, params); }
    }
    const childSources = {};
    const childFiles = {
      ReaderBottomTabBar: 'ui/patterns/ReaderBottomTabBar.ets',
      ReaderBottomNavigation: 'app/navigation/ReaderBottomNavigation.ets', MainTabShell: 'features/shell/MainTabShell.ets',
      ReaderPageScaffold: 'ui/layout/ReaderPageScaffold.ets', BookshelfShell: 'features/bookshelf/ui/BookshelfShell.ets',
      BookshelfPage: 'features/bookshelf/ui/BookshelfPage.ets', BookshelfEmptyPage: 'features/bookshelf/ui/BookshelfEmptyPage.ets',
      BookshelfStatusContent: 'features/bookshelf/ui/BookshelfStatusContent.ets', ReaderStandardPage: 'ui/layout/ReaderStandardPage.ets',
      MainNavigationOverlay: 'features/shell/MainNavigationOverlay.ets', ReaderFixedHeaderHost: 'ui/layout/ReaderFixedHeaderHost.ets',
      BookshelfMoreActionSheet: 'features/bookshelf/ui/BookshelfMoreActionSheet.ets',
      ReaderPageScrollHost: 'ui/layout/ReaderPageScrollHost.ets',
    };
    for (const [name, path] of Object.entries(childFiles)) { deps[name] = class extends Child {}; childSources[name] = read(path); }
    function methods(path, extras = []) {
      const tree = ts.createSourceFile(path, read(path), ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
      const struct = tree.statements.find(n => n.members?.some(m => m.name?.getText(tree) === 'build'));
      assert.ok(struct, `actual component: ${path}`);
      return [...struct.members.filter(m => ts.isMethodDeclaration(m) ||
        (ts.isPropertyDeclaration(m) && ts.getAllDecorators(m).some(d=>d.getText(tree)==='@BuilderParam')))
        .map(m => m.name.getText(tree)), ...extras];
    }
    function builder(path, names = methods(path), extra = {}, source = read(path)) {
      return createReaderBuilderProbe(source, names, { ...deps, ...extra },
        { ...properties.hooks, mountChildren: true, childSources });
    }
    function unifiedNav() {
      const path = 'app/navigation/ReaderBottomNavigation.ets';
      // The ordinary custom renderer is the scope here. HDS has its own SDK probe.
      return builder(path, methods(path).filter(name => name !== 'build' && name !== 'nativeTabBar')).owner;
    }
    const children = owner => [...owner.children.values()];
    const nodes = (owner, type) => [...owner.nodes.values()].filter(n => !type || n.type === type);
    const ordinary = (path, names, extra = {}) => {
      const name=path.split('/').at(-1).replace(/\.(ets|ts)$/, ''),bindings={...deps,...extra};
      delete bindings[name];
      return selectedProductionMethods(file(path),name,names,bindings);
    };
    return { assert, ts, options, file, read, load, metrics, deps, builder, methods, ordinary, children, nodes, properties, Child, unifiedNav,
      pagePolicy: actualReaderPageShell };
  })();
  return contextPromise;
}

function replaceOnce(c, source, before, after) {
  c.assert.equal(source.split(before).length-1,1,`negative injection matches exactly once: ${before}`);
  return source.replace(before,after);
}

async function rejected(c,name,run,expected) {
  let caught;
  try { await run(); } catch(error) { caught=error; }
  c.assert.ok(caught,`${name}: injected regression must actually fail`);
  c.assert.match(caught.message,expected,`${name}: the intended contract rejects the injected regression`);
  console.log(JSON.stringify({kind:'reader-phone-shape-negative',name,status:'REJECTED',reason:caught.message}));
}

async function currentPhoneShape(sources={}) {
  const c = await context(), { assert, deps, builder, children, nodes, metrics } = c;
  const { resolveReaderRaisedShape } = deps;
  for (const bad of [[0,68],[-1,68],[196,0],[NaN,68],[196,Infinity]])
    assert.equal(resolveReaderRaisedShape('phone', ...bad, 999), undefined, 'unmeasured/invalid box has no drawing shape');
  for (const [width,height,requested] of [[196,68,999],[170,104,999],[320,52,24],[300,88,18]]) {
    const shape = resolveReaderRaisedShape('phone', width, height, requested);
    assert.equal(shape.radius, Math.min(requested, width/2, height/2), 'effective radius respects both actual axes');
    assert.equal(shape.width,width); assert.equal(shape.height,height);
  }
  assertPhoneMaterialOwners(c,sources);
  const tabPath = 'ui/patterns/ReaderBottomTabBar.ets';
  const { owner: tab } = builder(tabPath,undefined,{},sources[tabPath]??c.read(tabPath));
  Object.assign(tab, { mounted:true, appearanceEpoch:1, metricsRevision:0, items:deps.MAIN_TABS.map(t=>({...t,icon:{id:t.key}})),
    current:'bookshelf',scheme:'day',surfaceWidth:196,fontScale:1,inputEnabled:true,bottomInset:15,translateX:0,raisedShape:undefined });
  const nav = c.unifiedNav();
  Object.assign(nav,{mounted:true,foreground:true,inputEnabled:true,current:'bookshelf',appThemeScheme:'day',
    mainViewportRevision:0,readerWindowMetricsRevision:0});
  nav.unifiedTabBar();
  const tabInput=children(nav).find(child=>Array.isArray(child.params?.items));
  assert.ok(tabInput,'current production navigation constructs the real phone tab input');
  Object.assign(tab,tabInput.params);
  assert.equal(tab.items.length,2,'actual L0 tab admission is used');
  const area={width:tab.surfaceWidth,height:68};
  tab.measurementHandler(tab.surfaceWidth,tab.fontScale)({},area);
  tab.initialRender();
  const material=nodes(tab,'Stack').find(n=>n.width===tab.surfaceWidth && n.border);
  assert.ok(material,'actual Tab builder emits the measured Native material');
  assert.equal(children(tab).filter(child=>child.params?.resolvedShape!==undefined).length,0,'phone Tab has no second painter or geometry output');
  assert.equal(material.borderRadius,tab.currentRaisedShape().radius,'Native material consumes its accepted effective radius');
  assert.equal(material.clip,false,'the shadow on the native material can extend outside its bounds');
  const contents=nodes(tab,'Stack').find(n=>n.width==='100%' && n.borderRadius!==undefined);
  assert.ok(contents,'the inner content has a separate clip carrier');
  assert.equal(contents.clip,false,'paid native phone buttons need no rounded clip');
  assert.equal(contents.borderRadius,material.borderRadius-9,'the inner clip consumes the same effective material shape and inset');
  assert.deepEqual(material.shadow,deps.readerSurfaceElevation('raised','day'),'the actual Native material owns its shared raised shadow');
  assert.equal(material.shadow.fill,false,'the rejected opaque-shadow experiment restores the original shadow path');
  assert.equal(material.shadow.type,'ShadowType.COLOR','actual Native shadow uses the SDK color kind');
  const tabButtons=nodes(tab,'Button');
  assert.equal(tabButtons.length,2,'both admitted tabs use the real native Button');
  for(const button of tabButtons){
    assert.equal(button.createWithChild.type,'ButtonType.Capsule','native tab capsule owns half-minimum actual corners');
    assert.equal(button.borderRadius,undefined,'the tab never sends the unbounded pill token to native Button corners');
  }
  assert.equal(metrics.systemFontScale,1);
  const savedDensity=metrics.densityPixels;
  try {
    metrics.densityPixels=3.5;
    for (const kind of ['raised','floating']) {
      const shadow=deps.readerSurfaceElevation(kind,'day');
      assert.equal(shadow.radius,38.5,'shared chrome blur is converted from 11vp once');
      assert.equal(shadow.offsetY,10.5,'shared chrome offset is converted from 3vp once');
    }
  } finally { metrics.densityPixels=savedDensity; }
  if(!sources.negative){
    for(const [name,before,after,expected] of [
      ['tab-Normal-sentinel-restored','ButtonType.Capsule','ButtonType.Normal',/native tab capsule owns/],
      ['Native-radius-diverges','.borderRadius(this.materialRadius())','.borderRadius(0)',/Native material consumes|effective radius owner/],
      ['outer-shadow-clip-restored',".shadow(readerSurfaceElevation('raised', this.scheme))\n        .clip(false)",".shadow(readerSurfaceElevation('raised', this.scheme))\n        .clip(true)",/unclipped shadow carrier/],
      ['paid-inner-clip-restored','.clip(this.requiresChildClip())','.clip(true)',/paid native phone buttons/],
      ['Native-shadow-detached',".shadow(readerSurfaceElevation('raised', this.scheme))",'',/owns its shared raised shadow|shared elevation owner|one shadow modifier/],
    ]){
      const mutant=replaceOnce(c,c.read(tabPath),before,after);
      await rejected(c,name,()=>currentPhoneShape({negative:true,[tabPath]:mutant}),expected);
    }
    const canvas=replaceOnce(c,c.read(tabPath),'this.activePill();','Canvas({});\n            this.activePill();');
    await rejected(c,'phone-Canvas-restored',()=>currentPhoneShape({negative:true,[tabPath]:canvas}),/phone cannot restore a second Canvas/);
    const double=replaceOnce(c,c.read(tabPath),".shadow(readerSurfaceElevation('raised', this.scheme))", ".shadow(readerSurfaceElevation('raised', this.scheme)).shadow(readerSurfaceElevation('raised', this.scheme))");
    await rejected(c,'duplicate-material-shadow',()=>currentPhoneShape({negative:true,[tabPath]:double}),/one shadow modifier/);
  }
}

// Mechanical ownership is checked on the actual SDK AST. All physical inputs
// remain on the same material expression; the detail modifier is followed to
// its finite production case. This does not model Native layout or pixels.
function assertPhoneMaterialOwners(c,sources){
  const {assert,ts,options}=c;
  function tree(path){
    const parsed=ts.createSourceFile(path,sources[path]??c.read(path),ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,options);
    assert.deepEqual(parsed.parseDiagnostics,[],`${path}: actual SDK source parses`);
    function noPainter(n){
      if(ts.isImportDeclaration(n))assert.ok(!n.moduleSpecifier.text.endsWith('/ReaderRaisedSurface'),`${path}: phone cannot restore a second Canvas painter import`);
      if((ts.isCallExpression(n)||ts.isEtsComponentExpression(n))&&['Canvas','ReaderRaisedSurface'].includes(n.expression?.getText(parsed)))
        assert.fail(`${path}: phone cannot restore a second Canvas painter`);
      ts.forEachChild(n,noPainter);
    }
    noPainter(parsed);return parsed;
  }
  function chains(node,parsed){
    const rows=[];
    function visit(n){
      if(ts.isCallExpression(n)&&ts.isPropertyAccessExpression(n.expression)&&
        !(ts.isPropertyAccessExpression(n.parent)&&n.parent.expression===n&&ts.isCallExpression(n.parent.parent))){
        const modifiers=[];let base=n;
        while(ts.isCallExpression(base)&&ts.isPropertyAccessExpression(base.expression)){
          modifiers.unshift({name:base.expression.name.text,args:base.arguments.map(a=>a.getText(parsed))});base=base.expression.expression;
        }
        rows.push({base,modifiers});
      }
      ts.forEachChild(n,visit);
    }
    visit(node);return rows;
  }
  const roles=[
    ['ui/patterns/ReaderBottomTabBar.ets','build','this.materialRadius()','false',"readerSurfaceElevation('raised', this.scheme)",'this.measurementHandler(this.surfaceWidth, this.fontScale)'],
    ['ui/chrome/PageBackBar.ets','panel','this.panelRadius()',"this.variant === 'download' && this.elevation === 'fixed' && !this.veil()","readerSurfaceElevation(this.raised() ? 'raised' : this.elevation === 'floating' ? 'floating' : 'fixed', this.appThemeScheme)",'this.panelAreaChangeHandler()'],
    ['features/search/ui/ReaderLibrarySearchSurface.ets','header','this.headerMaterialRadius()','false','this.headerStackShadow()','this.headerSurfaceAreaChange()'],
    ['features/downloads/ui/SharedDownloadPage.ets','storageDock','this.dockMaterialRadius(false)','false',"readerSurfaceElevation('raised', this.appThemeScheme)",'this.raisedDockAreaChangeHandler(false)'],
    ['features/downloads/ui/SharedDownloadPage.ets','selectionDock','this.dockMaterialRadius(true)','false',"readerSurfaceElevation('raised', this.appThemeScheme)",'this.raisedDockAreaChangeHandler(true)'],
  ];
  for(const[path,method,radius,clip,shadow,measurement]of roles){
    const parsed=tree(path),component=parsed.statements.find(n=>n.members?.some(m=>m.name?.getText(parsed)===method));
    assert.ok(component,`${path}: real material component exists`);
    const body=component.members.find(m=>m.name?.getText(parsed)===method);
    const all=chains(body,parsed),owned=all.filter(row=>row.modifiers.some(m=>m.name==='onAreaChange'&&m.args[0]===measurement));
    assert.equal(owned.length,1,`${path}#${method}: one measured Native material owner`);
    const attributes=name=>owned[0].modifiers.filter(m=>m.name===name);
    for(const name of ['border','borderRadius','clip','shadow','onAreaChange'])assert.equal(attributes(name).length,1,`${path}#${method}: one ${name} modifier`);
    assert.equal(attributes('borderRadius')[0].args[0],radius,`${path}#${method}: effective radius owner`);
    assert.equal(attributes('clip')[0].args[0],clip,`${path}#${method}: unclipped shadow carrier`);
    assert.equal(attributes('shadow')[0].args[0],shadow,`${path}#${method}: shared elevation owner`);
    assert.equal(all.filter(row=>row.modifiers.some(m=>m.name==='shadow')).length,1,`${path}#${method}: no second raised shadow owner`);
  }
  const detail='features/reading/ui/LocalBookDetail.ets',parsed=tree(detail);
  const component=parsed.statements.find(n=>n.name?.text==='LocalBookDetail');
  const body=component.members.find(m=>m.name?.getText(parsed)==='actionSurface');
  const dock=chains(body,parsed).filter(row=>row.modifiers.some(m=>m.name==='attributeModifier'&&m.args[0]?.startsWith('new ReaderPanelFrame(')));
  assert.equal(dock.length,1,'detail dock has one production frame owner');
  assert.equal(dock[0].modifiers.find(m=>m.name==='attributeModifier').args[0],"new ReaderPanelFrame('floating-action-dock', this.appThemeScheme, false, this.dockNativeShape())",'detail passes its measured resolved shape to the frame');
  assert.equal(dock[0].modifiers.find(m=>m.name==='onAreaChange')?.args[0],'this.dockAreaChangeHandler(this.footerMeasurementKey)','detail frame owns its same measurement receipt');
  assert.equal(dock[0].modifiers.filter(m=>['shadow','border','borderRadius','clip'].includes(m.name)).length,0,'detail caller does not duplicate its modifier physical surface');
  const frame=tree('ui/surfaces/ReaderPanelFrame.ets');let dockCase;
  function find(n){if(ts.isCaseClause(n)&&n.expression.getText(frame)==="'floating-action-dock'")dockCase=n;ts.forEachChild(n,find);}find(frame);
  assert.ok(dockCase,'actual floating dock modifier case exists');
  const frameChains=chains(dockCase,frame).filter(row=>row.modifiers.some(m=>m.name==='backgroundColor'));
  assert.equal(frameChains.length,1,'detail modifier has one Native paint owner');
  for(const[name,value]of [['borderRadius','this.raisedShape?.radius ?? TOK_RADIUS_XL'],['clip','false'],['shadow',"readerSurfaceElevation('raised', this.scheme)"]]){
    const modifiers=frameChains[0].modifiers.filter(m=>m.name===name);
    assert.equal(modifiers.length,1,`detail modifier: one ${name} modifier`);assert.equal(modifiers[0].args[0],value,`detail modifier: current ${name} owner`);
  }
}

async function measurementIdentity(sourceOverride) {
  const c=await context(),{assert,builder,load}=c;
  const path='ui/patterns/ReaderBottomTabBar.ets';
  const tab=builder(path,undefined,{},sourceOverride??c.read(path)).owner;
  Object.assign(tab,{mounted:true,appearanceEpoch:1,metricsRevision:0,surfaceWidth:196,fontScale:1,raisedShape:undefined});
  const old=tab.measurementHandler(196,1);old({},{width:196,height:68});
  const accepted=tab.currentRaisedShape();assert.ok(accepted);
  tab.metricsRevision++;
  assert.ok(tab.currentRaisedShape(),'accepted actual geometry remains available when no new area is delivered');
  old({},{width:999,height:999});
  assert.equal(tab.currentRaisedShape().height,68,'old layout receipt cannot overwrite retained current paint geometry');
  tab.surfaceWidth=200;
  tab.measurementHandler(200,1)({},{width:200,height:72});
  old({},{width:999,height:999});assert.equal(tab.currentRaisedShape().width,200,'successor box defeats the old callback');
  tab.mounted=false;const retained=tab.raisedShape;old({},{width:1,height:1});assert.equal(tab.raisedShape,retained,'retired owner rejects old receipt');
  const Type=c.ordinary('features/bookshelf/ui/BookshelfShell.ets',['onFooterLayoutChanged','recordFooterHeight']);
  const shelf=Object.assign(new Type(),{mounted:true,footerMeasurementKey:10,measuredFooterHeight:0,
    footerMeasurements:new (load('ui/layout/ReaderMeasurements.ts').ReaderMeasurementStore)()});
  shelf.recordFooterHeight(120,10);shelf.onFooterLayoutChanged();
  assert.equal(shelf.measuredFooterHeight,120,'layout generation preserves adopted occupied height until replaced');
  shelf.recordFooterHeight(999,10);assert.equal(shelf.measuredFooterHeight,120,'old footer key cannot replace current accepted extent');
  shelf.recordFooterHeight(130,11);assert.equal(shelf.measuredFooterHeight,130);
  shelf.mounted=false;shelf.recordFooterHeight(999,11);assert.equal(shelf.measuredFooterHeight,130,'unmounted footer owner is inert');
  if(sourceOverride===undefined){
    const source=c.read(path),needle='identity !== this.raisedShapeIdentity()';
    assert.ok(source.includes(needle),'actual current measurement has identity guards');
    const mutant=source.replaceAll(needle,'false');
    assert.notEqual(mutant,source,'identity regression was injected');
    await rejected(c,'old-measurement-overwrites-successor',()=>measurementIdentity(mutant),/old layout receipt|successor box/);
  }
}

async function footerPropagation(overrides={}) {
  const c=await context(),{assert,builder,children,load,deps}=c;
  const Store=load('ui/layout/ReaderMeasurements.ts').ReaderMeasurementStore;
  const recovery=load('app/ReaderRecoveryProjection.ts').readerRecoveryView(undefined);
  const occupied=137;
  const variants=[['populated','BookshelfPage','shelfContentEndValue'],['empty','BookshelfEmptyPage','bottomContentInset'],['status','BookshelfStatusContent','bottomContentInset']];
  for(const [state,name,method]of variants){
    const scenePath='features/bookshelf/ui/BookshelfScene.ets';
    const scene=builder(scenePath,['build','shelfContent','isCurrent','isInteractive','open'],{},overrides.sceneSource??c.read(scenePath)).owner;
    Object.assign(scene,{navigation:5,feedbackEnabled:true,read:{snapshot:{visualAdmitted:state==='populated',coreEmpty:state==='empty',books:[],revision:''},
      noticeTopInset:()=>0,headerBottom:100,viewState:{},scrollTopToken:0,recovery:()=>recovery,canCheckUpdates:()=>false},
      mutations:{snapshot:{},recovery:()=>recovery,canContinueRemoval:()=>false},catalog:{snapshot:{manualRunning:false,automaticRunning:false}},
      ports:{isCurrent:n=>n===5,isInteractive:n=>n===5},motion:{returnBookKey:''}});
    scene.initialRender();
    const shellParams=children(scene).find(child=>typeof child.params?.content==='function')?.params;
    assert.ok(shellParams,`${state}: actual Scene.build constructs BookshelfShell and its content closure`);
    const shellPath='features/bookshelf/ui/BookshelfShell.ets';
    const shell=builder(shellPath,undefined,{SheetSize:{FIT_CONTENT:'SheetSize.FIT_CONTENT'},SheetType:{BOTTOM:'SheetType.BOTTOM'}},
      overrides.shellSource??c.read(shellPath)).owner;
    Object.assign(shell,{...shellParams,mounted:true,footerMeasurementKey:3,measuredFooterHeight:0,footerMeasurements:new Store(),
      appThemeScheme:'day',moreMenuVisible:false,moreSelectionId:'',moreSheetCurrentId:''});
    shell.initialRender();
    const mainParams=children(shell).find(child=>child.params?.activeTab==='bookshelf')?.params;
    assert.ok(mainParams,'actual bookshelf constructs current MainTabShell');
    const main=builder('features/shell/MainTabShell.ets').owner;
    Object.assign(main,{...mainParams,mounted:true,readerWindowMetricsRevision:0,mainViewportRevision:0,wideNavigationRail:false,
      appThemeScheme:'day',headerTop:0,headerMeasurementKey:0,viewportWidth:390,viewportHeight:844});
    main.initialRender();
    const scaffoldParams=children(main).find(child=>child.params?.onFooterHeightChange)?.params;
    assert.ok(scaffoldParams,'actual nonstandard shell forwards footer measurement');
    const scaffold=builder('ui/layout/ReaderPageScaffold.ets',['footerAreaChangeHandler']).owner;
    Object.assign(scaffold,scaffoldParams);
    scaffoldParams.content();
    const initialPageChild=children(scene).find(child=>Object.hasOwn(child.params??{},'measuredFooterHeight'));
    assert.ok(initialPageChild, 'actual shelf state mounts before its first footer receipt');
    assert.equal(initialPageChild.params.measuredFooterHeight,0);
    scaffold.footerAreaChangeHandler(scaffold.footerMeasurementKey)({},{height:`${occupied}vp`});
    assert.equal(shell.measuredFooterHeight,occupied,'actual Scaffold→MainTabShell→BookshelfShell callback chain accepts occupied footer');
    // Invoke the real source closures, rather than hand-forwarding the value:
    // Scaffold -> MainTabShell.content -> BookshelfShell.content -> Scene -> state page.
    scene.replay();
    const pageChild=children(scene).find(child=>Object.hasOwn(child.params??{},'measuredFooterHeight'));
    assert.ok(pageChild instanceof deps[name],`${state}: actual scene instantiates the matching bookshelf state consumer`);
    const pageParams=pageChild.params;
    assert.equal(pageChild,initialPageChild, 'footer receipt keeps the same state child');
    assert.equal(pageParams.measuredFooterHeight,occupied,`${state}: retained occupied budget reaches actual state consumer`);
    scaffold.footerAreaChangeHandler(scaffold.footerMeasurementKey)({},{height:`${occupied+16}vp`});
    scene.replay();
    assert.equal(pageParams.measuredFooterHeight,occupied+16,`${state}: later footer receipt updates the retained consumer`);
    scaffold.footerAreaChangeHandler(scaffold.footerMeasurementKey)({},{height:`${occupied}vp`});
    scene.replay();
    const path=`features/bookshelf/ui/${name}.ets`,Type=c.ordinary(path,[method]);
    const page=Object.assign(new Type(),{...pageParams,readerWindowMetricsRevision:0,isWideViewport:()=>false,railActive:()=>false});
    assert.equal(page[method](),occupied+16,`${state}: actual consumer replaces fallback and does not double bottom margin`);
    main.navigationGeneration++;
    scaffoldParams.onFooterHeightChange(999,3);
    assert.equal(shell.measuredFooterHeight,occupied,'old MainTabShell navigation callback cannot deliver');
  }
  const standard=builder('ui/layout/ReaderStandardPage.ets',undefined,overrides.pagePolicy??{}).owner;
  Object.assign(standard,{mounted:true,variant:'settingsHome',appThemeScheme:'day',measurements:new Store(),
    measurementKey:4,footerMeasurementKey:4,geometryRevision:0,viewportWidth:390,viewportHeight:844,contentLeadingRail:0,contentEndInset:-1});
  standard.refreshGeometry();standard.initialRender();
  const standardInput=children(standard).find(child=>child.params?.onFooterHeightChange)?.params;
  assert.ok(standardInput,'actual standard settings surface publishes footer callback');
  standardInput.onFooterHeightChange(occupied,standardInput.footerMeasurementKey);
  assert.equal(standard.geometry.content.endInset,occupied+16,'actual standard settings uses measured footer extent through PageShell');
  standardInput.content();
  const scrollParams=children(standard).find(child=>child.params?.layout)?.params;
  assert.ok(scrollParams,'actual standard content forwards resolved layout to its native scroll host');
  const scroll=builder('ui/layout/ReaderPageScrollHost.ets').owner;
  Object.assign(scroll,scrollParams);scroll.initialRender();
  assert.ok(c.nodes(scroll,'Column').some(n=>n.padding?.bottom===occupied+16),'actual native scroll content consumes the adopted footer budget');
  for(const bad of [0,NaN,Infinity,-1])assert.equal(deps.readerFloatingTabContentInset(c.metrics,bad),deps.readerFloatingTabContentInset(c.metrics),'invalid/unmeasured receipt keeps authored fallback');
  if(!overrides.negative){
    const scene=c.read('features/bookshelf/ui/BookshelfScene.ets'),needle='measuredFooterHeight: measuredFooterHeight(),';
    assert.equal(scene.split(needle).length-1,3,'three actual bookshelf rendering states forward the budget');
    for(let target=0;target<3;target++){
      let index=0;const mutant=scene.replaceAll(needle,match=>index++===target?'measuredFooterHeight: 0,':match);
      await rejected(c,`bookshelf-state-${target}-drops-footer`,()=>footerPropagation({negative:true,sceneSource:mutant}),/occupied budget reaches actual state consumer/);
    }
    const shell=c.read('features/bookshelf/ui/BookshelfShell.ets');
    const capturedScene=scene.replaceAll('measuredFooterHeight: () => number', 'measuredFooterHeight: number')
      .replaceAll('measuredFooterHeight()', 'measuredFooterHeight');
    const capturedShell=c.read('features/bookshelf/ui/BookshelfShell.ets')
      .replace('content: (measuredFooterHeight: () => number)', 'content: (measuredFooterHeight: number)')
      .replace('this.content((): number => this.measuredFooterHeight)', 'this.content(this.measuredFooterHeight)');
    await rejected(c,'shelf-footer-old-value-capture',()=>footerPropagation({negative:true,sceneSource:capturedScene,shellSource:capturedShell}),/retained occupied budget reaches actual state consumer/);
    const noShell=replaceOnce(c,shell,'this.content((): number => this.measuredFooterHeight);','this.content((): number => 0);');
    await rejected(c,'bookshelf-shell-drops-footer',()=>footerPropagation({negative:true,shellSource:noShell}),/occupied budget reaches actual state consumer/);
    const noScene=replaceOnce(c,scene,'this.shelfContent(measuredFooterHeight);','this.shelfContent((): number => 0);');
    await rejected(c,'bookshelf-scene-closure-drops-footer',()=>footerPropagation({negative:true,sceneSource:noScene}),/occupied budget reaches actual state consumer/);
    const wrongConsumer=replaceOnce(c,scene,'BookshelfEmptyPage({','BookshelfStatusContent({');
    await rejected(c,'bookshelf-empty-mounts-status-consumer',()=>footerPropagation({negative:true,sceneSource:wrongConsumer}),/empty: actual scene instantiates the matching bookshelf state consumer/);
    const source=c.read('ui/layout/ReaderPageShell.ts');
    const mutant=replaceOnce(c,source,"if (variant === 'settingsHome') return readerFloatingTabContentInset(metrics, footerHeight);",
      "if (variant === 'settingsHome') return readerFloatingTabContentInset(metrics);");
    await rejected(c,'settings-ignores-adopted-footer',()=>footerPropagation({negative:true,pagePolicy:c.pagePolicy(mutant)}),/actual standard settings uses measured footer/);
  }
}

async function phoneChildContainment(overrides={}) {
  const c=await context(),{assert,deps,builder,nodes,children,metrics}=c;
  const path='ui/patterns/ReaderBottomTabBar.ets';
  const source=overrides.source??c.read(path);
  const items=deps.MAIN_TABS.map(tab=>({...tab,icon:{id:tab.key}}));
  assert.equal(items.length,2,'the paid geometry uses the actual two admitted product tabs');
  assert.deepEqual(items.map(item=>item.label),['书架','设置'],'approved two-character labels retain the independently measured22vp ink budget');
  assert.equal(deps.TYPE_MAIN_TAB_LABEL.fontFamily,'ReaderNotoSansSCUIBold');
  assert.equal(deps.TYPE_MAIN_TAB_LABEL.fontSizeFp,11);
  const scales=[1,1.3,1.6,2];
  const frames=[[320,0,0],[366,0,0],[320,48,32],[366,90,90],[320,90,90],[320,200,200],[0,0,0]];
  const originalMetrics={width:metrics.windowRect.width,left:metrics.systemInsets.left,right:metrics.systemInsets.right};
  let composed=0,contained=0,clipped=0,unavailable=0,arcPoints=0;
  function createTab(width,scale) {
    const tab=builder(path,c.methods(path,['surfaceWidth','fontScale','raisedShape','itemGap']),{},source).owner;
    Object.assign(tab,{mounted:true,appearanceEpoch:1,metricsRevision:0,items,current:'bookshelf',scheme:'day',
      surfaceWidth:width,fontScale:scale,inputEnabled:true,bottomInset:15,translateX:0,raisedShape:undefined});
    tab.initialRender();
    const row=nodes(tab,'Stack').find(node=>Object.is(node.width,width)&&node.border);
    const contents=nodes(tab,'Stack').find(node=>node.width==='100%' && node.borderRadius!==undefined);
    const itemRow=nodes(tab,'Row').find(node=>node.width==='100%');
    if (Number.isFinite(width) && width > 0) assert.ok(row,'actual phone builder emits its valid material owner');
    else assert.equal(row, undefined, 'unavailable geometry has no native material owner');
    return {tab,row,contents,itemRow};
  }
  function checkComposition(width,scale,expectedClip) {
    const {tab,row,contents,itemRow}=createTab(width,scale);
    if (!Number.isFinite(width) || width <= 0) {
      assert.equal(row, undefined);
      assert.equal(nodes(tab, 'Button').length, 0);
      unavailable++;
      return;
    }
    assert.equal(row.clip,false,'the outer native shadow remains unclipped at every admitted width');
    assert.equal(contents.clip,expectedClip,'paid containment domain controls the inner content clip');
    assert.equal(row.padding,8,'actual parent pays the approved8vp inset');
    assert.equal(row.border.width,1,'actual border pays1vp');
    assert.equal(itemRow.create.space,6,'the actual item row pays the 6vp inter-item gap');
    const itemHeight=Math.ceil(50+18*(scale-1)),outerHeight=Math.ceil(68+18*(scale-1));
    assert.deepEqual(row.constraintSize,{minHeight:outerHeight},'actual parent height follows its18fp label growth');
    const buttons=nodes(tab,'Button');
    assert.equal(buttons.length,2);
    for(const button of buttons){
      assert.equal(button.createWithChild.type,'ButtonType.Capsule');
      assert.equal(button.layoutWeight,1,'equal native flex payment remains the width owner');
      assert.equal(button.padding,0);
      assert.deepEqual(button.constraintSize,{minHeight:itemHeight});
    }
    const columns=nodes(tab,'Column');
    assert.equal(columns.length,2);
    for(const column of columns){assert.equal(column.width,'100%');assert.equal(column.create.space,2);}
    const labels=nodes(tab,'Text');
    assert.equal(labels.length,2);
    for(const label of labels){
      assert.equal(label.width,'100%');assert.equal(label.maxLines,1);
      assert.equal(label.textOverflow.overflow,'TextOverflow.Ellipsis');
      assert.equal(label.lineHeight,'18fp');
    }
    for(const image of nodes(tab,'Image')){assert.equal(image.width,21);assert.equal(image.height,21);}
    for(const stack of nodes(tab,'Stack').filter(node=>node.width===30))assert.equal(stack.height,30);
    assert.equal(30+2+18*scale<=itemHeight,true,'real single-line column paint fits the admitted item minimum');
    assert.deepEqual(row.shadow,deps.readerSurfaceElevation('raised','day'),'all original shadow parameters are restored');
    assert.equal(row.shadow.fill,false);
    composed++;
    if(expectedClip){clipped++;return;}
    const inset=row.padding+row.border.width,gap=itemRow.create.space;
    const childWidth=(width-2*inset-gap)/buttons.length;
    assert.ok(childWidth>=Math.max(44,itemHeight),'admitted flex slot pays both the hit target and horizontal capsule');
    assert.equal(outerHeight-itemHeight,2*inset,'child and parent end-cap centers use the same paid vertical inset');
    const parentRadius=outerHeight/2,childRadius=itemHeight/2;
    assert.equal(inset+childRadius,parentRadius,'the left outside cap is exactly concentric with the parent cap');
    assert.equal(width-inset-childRadius,width-parentRadius,'the right outside cap is exactly concentric with the parent cap');
    assert.equal(parentRadius-childRadius,inset,'the entire child circle pays the same9vp clearance');
    function inside(x,y){
      const dx=Math.max(parentRadius-x,0,x-(width-parentRadius));
      const dy=Math.max(parentRadius-y,0,y-(outerHeight-parentRadius));
      return dx*dx+dy*dy<=parentRadius*parentRadius+1e-8;
    }
    for(let index=0;index<buttons.length;index++){
      const left=inset+index*(childWidth+gap),top=inset;
      for(const [centerX,centerY]of [[left+childRadius,top+childRadius],[left+childWidth-childRadius,top+childRadius]]){
        for(let degree=0;degree<360;degree+=3){
          const radians=degree*Math.PI/180;
          assert.ok(inside(centerX+childRadius*Math.cos(radians),centerY+childRadius*Math.sin(radians)),
            'the paid mathematical child Capsule boundary is inside its parent capsule');
          arcPoints++;
        }
      }
    }
    // The same source callbacks remain the sole business dispatch owners.
    const selected=[],current=[];tab.onSelect=key=>selected.push(key);tab.onCurrentTap=key=>current.push(key);
    buttons[0].onClick();buttons[1].onClick();
    assert.deepEqual(current,['bookshelf']);assert.deepEqual(selected,[items[1].key]);
    tab.inputEnabled=false;buttons[0].onClick();buttons[1].onClick();
    assert.deepEqual(current,['bookshelf']);assert.deepEqual(selected,[items[1].key]);
    contained++;
  }
  try {
    for(const [viewport,left,right]of frames){
      deps.AppStorage.setOrCreate('readerMainViewport',undefined);
      metrics.windowRect.width=viewport;metrics.systemInsets.left=left;metrics.systemInsets.right=right;
      for(const scale of scales){
        metrics.systemFontScale=scale;
        const nav=c.unifiedNav();
        Object.assign(nav,{mounted:true,foreground:true,inputEnabled:true,current:'bookshelf',appThemeScheme:'day',
          mainViewportRevision:0,readerWindowMetricsRevision:0});
        nav.unifiedTabBar();
        const input=children(nav).find(child=>Array.isArray(child.params?.items))?.params;
        assert.ok(input,'actual navigation passes a frame even before the first viewport Area receipt');
        const expectedWidth=Math.min(196,Math.max(0,viewport-Math.max(32,left)-Math.max(32,right)));
        assert.equal(input.surfaceWidth,expectedWidth,'actual live viewport/safe-frame width is the paid geometry input');
        const threshold=2*Math.max(44,Math.ceil(50+18*(scale-1)))+24;
        checkComposition(input.surfaceWidth,scale,input.surfaceWidth<threshold);
      }
    }
    for(const scale of scales){
      const threshold=2*Math.ceil(50+18*(scale-1))+24;
      checkComposition(threshold,scale,false);
      checkComposition(threshold-.01,scale,true);
      for(const width of [-1,NaN,Infinity]) {
        const invalid = createTab(width,scale);
        assert.equal(invalid.row,undefined,'invalid width has no native material');
      }
    }
    const retained=createTab(196,1),retainedId=retained.row.id;
    assert.equal(retained.contents.clip,false);
    for(const [width,scale,expectedClip]of [[196,1,false],[150,2,true],[162,2,false]]){
      retained.tab.updateStateVars({surfaceWidth:width,fontScale:scale});c.properties.flush();
      assert.equal(nodes(retained.tab,'Stack').find(node=>node.border),retained.row,'responsive input updates keep the actual Row identity');
      assert.equal(retained.row.id,retainedId);
      assert.equal(retained.row.width,width,'the retained native Row receives the changed paid width');
      assert.equal(retained.contents.clip,expectedClip,'retained content clipping reacts to width and font-scale input changes');
    }
    const shrinking=createTab(196,2),shrinkingRow=shrinking.row;
    const oldArea=shrinking.tab.measurementHandler(196,2);
    oldArea({},{width:196,height:86});c.properties.flush();
    assert.equal(shrinkingRow.borderRadius,43);
    shrinking.tab.updateStateVars({surfaceWidth:196,fontScale:1});c.properties.flush();
    assert.equal(shrinkingRow.borderRadius,43,'the experiment preserves the existing adopted radius until a current Area arrives');
    assert.equal(shrinking.contents.clip,true,'font shrink retains the old clip while adopted radius exceeds the new minimum box');
    oldArea({},{width:196,height:999});c.properties.flush();
    assert.equal(shrinkingRow.borderRadius,43,'a retired font generation cannot replace the adopted shape');
    shrinking.tab.measurementHandler(196,1)({},{width:196,height:68});c.properties.flush();
    assert.equal(nodes(shrinking.tab,'Stack').find(node=>node.border),shrinkingRow);
    assert.equal(shrinkingRow.borderRadius,34,'a current real Area replaces the adopted geometry');
    assert.equal(shrinking.contents.clip,false,'real State dependency delivery disables clipping after current geometry arrives');
    const empty=builder(path,undefined,{},source).owner;
    Object.assign(empty,{items:[],surfaceWidth:196,fontScale:1});
    assert.equal(empty.requiresChildClip(),true,'an empty/unpaid item set retains clipping');
  } finally {
    metrics.windowRect.width=originalMetrics.width;metrics.systemInsets.left=originalMetrics.left;metrics.systemInsets.right=originalMetrics.right;
    metrics.systemFontScale=1;deps.publishReaderMainViewport(390,844);
  }
  const surface=c.read('ui/surfaces/ReaderSurfaceSpecs.ets');
  assert.equal(surface.includes('opaqueMaterial'),false,'rejected experiment introduces no surviving helper option');
  assert.equal(deps.readerSurfaceElevation.length,2,'actual helper has the original two-argument API');
  assertPhoneMaterialOwners(c,{[path]:source});
  await currentPhoneShape({negative:true,[path]:source});
  if(!overrides.negative){
    for(const [name,before,after]of [
      ['paid-phone-clip-restored','.clip(this.requiresChildClip())','.clip(true)'],
      ['unpaid-positive-width-unclipped','.clip(this.requiresChildClip())','.clip(false)'],
      ['unpaid-width-admitted','count * Math.max(44, itemHeight)','count * 44'],
      ['font-shrink-radius-guard-removed','radius - Math.min(width, height) / 2 > precision','false'],
    ]){
      const mutant=replaceOnce(c,source,before,after);
      await rejected(c,name,()=>phoneChildContainment({negative:true,source:mutant}),/paid containment domain|font shrink retains/);
    }
  }
  console.log(JSON.stringify({case:'phone-child-containment',status:'PASS',composed,contained,clipped,unavailable,arcPoints,
    nativeRaster:'NOT_RUN',hypothesis:'OPEN',rejectedHypothesis:'opaque-shadow-fill'}));
}

async function phoneFirstMeasurement(overrides = {}) {
  const c = await context();
  const { assert, deps, builder, children, nodes, metrics } = c;
  const path = 'ui/patterns/ReaderBottomTabBar.ets';
  const source = overrides.source ?? c.read(path);
  const previousWidth = metrics.windowRect.width;
  const traceSamples = [];
  if (!overrides.negative) deps.ReaderStartupTrace.install(() => 0, sample => traceSamples.push(sample), true);
  const items = deps.MAIN_TABS.map(tab => ({ ...tab, icon: { id: tab.key } }));
  const createTab = (width, onGeometryTrace = () => {}) => {
    const tab = builder(path, undefined, {}, source).owner;
    Object.assign(tab, { mounted: true, appearanceEpoch: 1, metricsRevision: 0, items,
      current: 'bookshelf', scheme: 'day', surfaceWidth: width, fontScale: 1,
      inputEnabled: true, bottomInset: 15, translateX: 0, raisedShape: undefined, onGeometryTrace });
    tab.aboutToAppear();
    tab.initialRender();
    return tab;
  };
  try {
    deps.AppStorage.setOrCreate('readerMainViewport', undefined);
    metrics.windowRect.width = 0;
    const navigation = c.unifiedNav();
    Object.assign(navigation, { mounted: true, foreground: true, inputEnabled: true,
      current: 'bookshelf', appThemeScheme: 'day', mainViewportRevision: 0, readerWindowMetricsRevision: 0 });
    navigation.unifiedTabBar();
    const initialInput = children(navigation).find(child => Array.isArray(child.params?.items))?.params;
    assert.ok(initialInput, 'actual navigation constructs its initial input');
    assert.equal(initialInput.surfaceWidth, 0, 'unavailable real viewport reaches the initial Tab input');
    const initial = createTab(initialInput.surfaceWidth, initialInput.onGeometryTrace);
    assert.equal(nodes(initial, 'Stack').filter(node => node.border).length, 0,
      'unavailable initial geometry emits no native material');
    assert.equal(nodes(initial, 'Button').length, 0, 'initial unavailable surface emits no Tab targets');
    assert.deepEqual(nodes(initial, 'Stack')[0].constraintSize, { minHeight: 68 },
      'the existing footer slot retains its height while native paint waits for width');
    const oldArea = initial.measurementHandler(0, 1);
    metrics.windowRect.width = 390;
    deps.publishReaderMainViewport(390, 844);
    assert.equal(navigation.bottomBarFrame().width, 196, 'the production geometry reads the newly published viewport');
    const measuredNavigation = c.unifiedNav();
    Object.assign(measuredNavigation, { mounted: true, foreground: true, inputEnabled: true,
      current: 'bookshelf', appThemeScheme: 'day', mainViewportRevision: 1, readerWindowMetricsRevision: 0 });
    measuredNavigation.unifiedTabBar();
    const measuredInput = children(measuredNavigation).find(child => Array.isArray(child.params?.items))?.params;
    assert.equal(measuredInput.surfaceWidth, 196, 'actual measured frame admits the ordinary Tab width');
    const measured = createTab(measuredInput.surfaceWidth, measuredInput.onGeometryTrace);
    const material = nodes(measured, 'Stack').find(node => node.border);
    assert.ok(material, 'first valid material is emitted');
    assert.equal(material.width, 196);
    assert.equal(material.border.width, 1);
    assert.equal(material.borderRadius, 34);
    assert.equal(material.clip, false);
    assert.deepEqual(material.shadow, deps.readerSurfaceElevation('raised', 'day'));
    initial.surfaceWidth = 196;
    oldArea({}, { width: 0, height: 68 });
    assert.equal(initial.raisedShape, undefined, 'old unavailable Area cannot publish a shape after width changes');
    for (const width of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      const invalid = createTab(width);
      assert.equal(nodes(invalid, 'Stack').filter(node => node.border).length, 0,
        'invalid geometry emits no native material');
      assert.equal(nodes(invalid, 'Stack')[0].width, 0, 'outer frame resolves unavailable width to finite zero');
    }
    if (!overrides.negative) {
      assert.ok(traceSamples.some(sample => sample.stage === 'main-tab.geometry' && sample.status === 'width=0,paint=false'));
      assert.ok(traceSamples.some(sample => sample.stage === 'main-tab.geometry' && sample.status === 'width=196,paint=true'));
    }
    const observerFailure = createTab(196, () => { throw new Error('synthetic diagnostic observer failure'); });
    assert.ok(nodes(observerFailure, 'Stack').find(node => node.border), 'diagnostic observer failure preserves valid material admission');
  } finally {
    metrics.windowRect.width = previousWidth;
    deps.publishReaderMainViewport(390, 844);
  }
  if (!overrides.negative) {
    const mutant = replaceOnce(c, source, 'if (this.hasPaintGeometry()) {', 'if (true) {');
    await rejected(c, 'unconditional-zero-width-material',
      () => phoneFirstMeasurement({ negative: true, source: mutant }), /unavailable initial geometry emits no native material/);
    const missingSlot = replaceOnce(c, source,
      '.constraintSize({ minHeight: readerFloatingTabBarHeight(this.fontScale) }).clip(false)', '.clip(false)');
    await rejected(c, 'unavailable-footer-slot-shrinks',
      () => phoneFirstMeasurement({ negative: true, source: missingSlot }), /existing footer slot retains its height/);
  }
  console.log(JSON.stringify({ case: 'phone-first-measurement', status: 'PASS',
    actualNavigationWidths: [0, 196], invalidInputs: 4, nativeRaster: 'NOT_RUN',
    storageLinkDelivery: 'FINITE_PORT_NOT_SIMULATED',
    zeroToPositiveNativeInstance: 'NOT_SIMULATED', fanCausality: 'OPEN' }));
}

const implementations={'phone-first-measurement':phoneFirstMeasurement,'phone-child-containment':phoneChildContainment,'current-phone-shape':currentPhoneShape,'measurement-identity':measurementIdentity,'footer-propagation':footerPropagation};
for(const id of selectContractCases(CONTRACT_CASES)){await implementations[id]();recordContractCasePass(id);}
