import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions={"root-palette": {"description": "实际Index root背景表达式/共享MainTab failure内容继承当前day/night window palette", "resources": []}, "root-edges": {"description": "当前Index detail/reading/manga edge所有权矩阵与实际root safe-area表达式输出", "resources": []}, "paired-chrome": {"description": "实际Coordinator overlay携带完整underlay/foreground/tone并成对native写", "resources": []}};
for(const id of selectContractCases(definitions)){await runSelectedCase(id);recordContractCasePass(id);}
async function runSelectedCase(selectedCase){
const { resolveEtsLoaderRoot } = await import('./lib/tool-environment.mjs');
const {default: assert} = await import('node:assert/strict');
const { readFileSync } = await import('node:fs');
const { fileURLToPath } = await import('node:url');
const { createRequire, stripTypeScriptTypes } = await import('node:module');
const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
const { readerAppColor } = await import('../entry/src/main/ets/ui/foundation/ReaderThemeRegistry.ts');
const {selectedProductionMethods} = await import('./lib/selected-production-methods.mjs');


const read = (relative) => readFileSync(new URL(`../${relative}`, import.meta.url), 'utf8');

const coordinator = read('entry/src/main/ets/app/ReaderWindowCoordinator.ts');
const index = read('entry/src/main/ets/pages/Index.ets');
const experience = read('entry/src/main/ets/features/reading/ui/LocalReadingExperience.ets');


// Read the actual outer Stack modifier chain. A count over the whole Index
// was accidentally coupled to the old failure branch's duplicate background.
const require = createRequire(import.meta.url);
const sdk = resolveEtsLoaderRoot();
const ts = require(`${sdk}/node_modules/typescript`), options = require(`${sdk}/lib/ets_checker.js`).compilerOptions;
const parse = text => ts.createSourceFile('WindowChromeContract.ets', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
const tree = parse(index);
assert.equal(tree.parseDiagnostics.length, 0);
const indexType = tree.statements.find(node => node.name?.getText(tree) === 'Index');
const build = indexType.members.find(node => node.name?.getText(tree) === 'build');
let rootExpression = build.body.statements[0].expression;
const rootPaints = [];
while (ts.isCallExpression(rootExpression) && ts.isPropertyAccessExpression(rootExpression.expression)) {
  if (rootExpression.expression.name.text === 'backgroundColor') rootPaints.push(rootExpression.arguments[0]);
  rootExpression = rootExpression.expression.expression;
}
assert.equal(rootExpression.expression.getText(tree), 'Stack', 'paint must belong to the actual Index root');
assert.equal(rootPaints.length, 1, 'the app root has one authoritative window fill');
const indexPaint = new Function('readerAppColor', `return ${stripTypeScriptTypes(rootPaints[0].getText(tree))};`);
if(selectedCase==='root-palette'){
const mainShell = read('entry/src/main/ets/features/shell/MainTabShell.ets');
const [{boundedSurfaceSdk, boundedMembers}, {actualReaderPageLayout}, {readerEditingSdk},
  {pureModuleProbe}, {actualReaderPostLayoutFrame}, metrics] = await Promise.all([
  import('./lib/bounded-surface-sdk-probe.mjs'), import('./lib/reader-page-shell-runtime-probe.mjs'),
  import('./lib/reader-editing-sdk-probe.mjs'), import('./lib/ets-pure-module-probe.mjs'),
  import('./lib/reader-post-layout-frame-probe.mjs'), import('../entry/src/main/ets/ui/foundation/ReaderWindowMetrics.ts'),
]);
const surface = boundedSurfaceSdk();
const {ReaderNativeSlotMeasurement} = pureModuleProbe(read('entry/src/main/ets/ui/layout/ReaderNativeSlotMeasurement.ets'),
  'ReaderNativeSlotMeasurement.ets', {ReaderPostLayoutFrame: actualReaderPostLayoutFrame(),
    readerMeasureSurfaceRect: () => undefined}, ['ReaderNativeSlotMeasurement']);
class NavigationChild {
  constructor(owner, params, _storage, id) { Object.assign(this, {owner, params, id}); }
}
surface.childSources.MainNavigationOverlay = read('entry/src/main/ets/features/shell/MainNavigationOverlay.ets');
surface.childSources.ReaderBottomNavigation = read('entry/src/main/ets/app/navigation/ReaderBottomNavigation.ets');
const dependencies = {...surface.deps, ...metrics, ...actualReaderPageLayout(), ...readerEditingSdk(), ReaderNativeSlotMeasurement,
  ReaderWindowCoordinator: {metrics: metrics.createDefaultReaderWindowMetrics}, readerMainNavigationMode: () => 'bottom',
  MainNavigationOverlay: NavigationChild, ReaderBottomNavigation: NavigationChild};
const { owner: sharedShell } = createReaderBuilderProbe(mainShell, boundedMembers(mainShell), dependencies, surface.hooks);
Object.assign(sharedShell, { appThemeScheme: 'day', headerVisible: false, content() {} });
sharedShell.initialRender();
// The app facade delegates paint to the actual shared native frame.
const sharedFrame = [...sharedShell.children.values()].find(child => child.frameStyle && child.geometry);
assert.ok(sharedFrame, 'the app facade mounts the production page frame');
const contentRoot = [...sharedFrame.nodes.values()].find(node => node.type === 'Stack' && node.backgroundColor !== undefined);
assert.ok(contentRoot, 'full-size shared app shell paints beneath failure content');
for (const scheme of ['day','night','day']) {
  sharedShell.appThemeScheme = scheme; sharedShell.replay(); surface.properties.flush();
  const windowPaint = readerAppColor('app.window.background', scheme);
  assert.equal(indexPaint.call({appThemeScheme:scheme}, readerAppColor), windowPaint, 'Index root follows window chrome');
  assert.equal(contentRoot.backgroundColor, windowPaint, 'shared shelf shell, including failure, follows the same live palette');
}
// Verify failure remains inside the common bookshelf content slot, rather than
// silently regaining a separate page root that this palette check would miss.
const shelfSceneTree = parse(read('entry/src/main/ets/features/bookshelf/ui/BookshelfScene.ets'));
const shelfScene = shelfSceneTree.statements.find(node => node.name?.getText(shelfSceneTree) === 'BookshelfScene');
const content = shelfScene.members.find(node => node.name?.getText(shelfSceneTree) === 'shelfContent');
assert.ok(content);
const calls = (node, name, sourceTree = tree) => {
  const result = []; const visit = item => {
    if ((ts.isCallExpression(item) || ts.isEtsComponentExpression(item)) && item.expression.getText(sourceTree) === name) result.push(item);
    ts.forEachChild(item, visit);
  }; visit(node); return result;
};
const shellContent = shelfScene.members.find(node => node.name?.getText(shelfSceneTree) === 'build');
const pageSurfaces = indexType.members.find(node => node.name?.getText(tree) === 'pageSurfaces');
const routeContent = indexType.members.find(node => node.name?.getText(tree) === 'appRouteContent');
const bookshelfRoute = indexType.members.find(node => node.name?.getText(tree) === 'bookshelfRoute');
assert.ok(shellContent);
assert.equal(calls(build, 'this.pageSurfaces').length, 1);
assert.equal(calls(build, 'ArkWebExecutionHost').length, 1);
assert.equal(calls(pageSurfaces, 'ReaderRouteStackSurface').length, 1);
assert.equal(calls(pageSurfaces, 'this.appRouteContent').length, 1);
assert.equal(calls(routeContent, 'this.bookshelfRoute').length, 1);
assert.equal(calls(bookshelfRoute, 'BookshelfScene').length, 1);
assert.equal(calls(shellContent, 'BookshelfShell', shelfSceneTree).length, 1);
assert.equal(calls(shellContent, 'this.shelfContent', shelfSceneTree).length, 1, 'shared shell receives the readiness content slot');
const shelfShellTree = parse(read('entry/src/main/ets/features/bookshelf/ui/BookshelfShell.ets'));
assert.equal(calls(shelfShellTree, 'MainTabShell', shelfShellTree).length, 1, 'bookshelf chrome uses the actual app palette owner');
const failure = calls(content, 'BookshelfStatusContent', shelfSceneTree); assert.equal(failure.length, 1);
const failedProp = failure[0].arguments[0].properties.find(node => node.name?.getText(shelfSceneTree) === 'failed');
assert.equal(failedProp.initializer.getText(shelfSceneTree), 'this.read.failed');
const status = read('entry/src/main/ets/features/bookshelf/ui/BookshelfStatusContent.ets');
const { owner: failureContent } = createReaderBuilderProbe(status, boundedMembers(status), {
  ...dependencies, bookshelfHeaderSpec: () => ({frameHeight: 58}), readerMainViewport: () => ({width: 365}),
  readerFloatingTabContentInset: () => 99,
}, surface.hooks);
failureContent.failed = true;
failureContent.initialRender();
const messageTree = current => [...current.nodes.values(), ...[...current.children.values()].flatMap(child => child.nodes ? messageTree(child) : [])];
assert.ok(messageTree(failureContent).some(node => node.type === 'Text' && node.create === '书架加载失败'));
assert.ok([...failureContent.nodes.values()].every(node => node.backgroundColor === undefined || node.type === 'Text'),
  'failure body inherits shared root paint while retaining the retry button fill');


}

if(selectedCase==='root-edges'){
 const Owner=selectedProductionMethods(new URL('../entry/src/main/ets/pages/Index.ets',import.meta.url),'Index',[
  'readerOwnsWindowEdges','mangaOwnsWindowEdges','isDetailDirectoryRoute','appRouteSafeTop','overlaySafeTop']);
 const cases=[
  {route:'bookshelf', reader:false},
  {route:'settings', reader:false},
  {route:'discover', reader:false},
  {route:'detail', reader:false},
  {route:'detail', book:{contentKind:'text'}, reader:true},
  {route:'directory', book:{contentKind:'manga'}, reader:true},
  {route:'directory', book:{contentKind:'text'}, reader:true},
  {route:'directory', target:'readerControl', active:true, reader:true},
  {route:'reading', active:true, reader:true},
  {route:'reading', active:true, contentKind:'manga', reader:true, manga:true},
  {route:'detail', book:{contentKind:'manga'}, contentKind:'manga', reader:true},
  {route:'detail', book:{contentKind:'manga'}, contentKind:'manga', retainingReader:true, reader:true, manga:true},
  {route:'bookshelf', sourcePicker:true, reader:true, manga:true},
 ];
 const attributes = (expression) => {
  const modifiers=new Map();
  while(ts.isCallExpression(expression)&&ts.isPropertyAccessExpression(expression.expression)){
    modifiers.set(expression.expression.name.text,expression.arguments);
    expression=expression.expression.expression;
  }
  return modifiers;
 };
 const output = member => attributes(member.body.statements[0].expression);
 const modifiers=output(build);
 for(const key of ['expandSafeArea','ignoreLayoutSafeArea'])assert.ok(modifiers.has(key),'actual Index root '+key);
 const enums=Object.fromEntries(['SafeAreaType','SafeAreaEdge','LayoutSafeAreaType','LayoutSafeAreaEdge'].map(name=>[name,new Proxy({},{get:(_,key)=>name+'.'+String(key)})]));
 const evaluate = (key, owner) => new Function(...Object.keys(enums),
  `return [${modifiers.get(key).map(node=>node.getText(tree)).join(',')}];`).call(owner,...Object.values(enums));
 assert.equal(modifiers.get('height')[0].getText(tree), 'LayoutPolicy.matchParent');
 const stackTree=parse(read('entry/src/main/ets/app/navigation/ReaderRouteStackSurface.ets'));
 const stack=stackTree.statements.find(node=>node.name?.getText(stackTree)==='ReaderRouteStackSurface');
 const stackMember=name=>stack.members.find(node=>node.name?.getText(stackTree)===name);
 assert.equal(stackMember('extendsToWindowTop').initializer.getText(stackTree), 'false');
 const appStack=indexType.members.find(node=>node.name?.getText(tree)==='pageSurfaces').getText(tree);
 assert.match(appStack,/ReaderRouteStackSurface\(\{[^}]*?extendsToWindowTop:\s*true,/);
 // Inspect the Navigation and NavDestination themselves, including the embedded settings case.
 const navigation = stackMember('build').body.statements[0].expression;
 let outer = navigation;
 while (ts.isCallExpression(outer) && ts.isPropertyAccessExpression(outer.expression)) outer = outer.expression.expression;
 for (const modifiers of [attributes(outer.body.statements[0].expression),output(stackMember('destination'))]) {
  for (const name of ['hideTitleBar','hideToolBar']) assert.equal(modifiers.get(name)[0].getText(stackTree),'true');
  const args=modifiers.get('ignoreLayoutSafeArea').map(node=>node.getText(stackTree)).join(',');
  const edges=new Function(...Object.keys(enums),`return [${args}];`);
  for (const extendsToWindowTop of [true,false]) {
   assert.deepEqual(edges.call({extendsToWindowTop},...Object.values(enums)),[
    ['LayoutSafeAreaType.SYSTEM'], extendsToWindowTop ? ['LayoutSafeAreaEdge.TOP'] : [],
   ]);
  }
 }
 for(const {route,target='detail',active=false,book,contentKind='text',retainingReader=false,sourcePicker=false,reader,manga=false} of cases){
  const owner=Object.assign(new Owner(),{route,directoryReturnTarget:target,readerDetailCover:retainingReader,
    mangaSourceSwitch:{selectionVisible:sourcePicker},readingEntry:{sessionActive:active,book,contentKind},appContentTopInset:()=>37});
  assert.equal(owner.readerOwnsWindowEdges(),reader);
  assert.equal(owner.mangaOwnsWindowEdges(),manga);
  assert.equal(owner.overlaySafeTop(),reader?0:37);
  const areas=evaluate('expandSafeArea',owner);
  assert.ok(areas[1].includes('SafeAreaEdge.TOP'));
  assert.equal(areas[1].includes('SafeAreaEdge.START'),manga);
  assert.deepEqual(evaluate('ignoreLayoutSafeArea',owner), [
    ['LayoutSafeAreaType.SYSTEM'], [manga ? 'LayoutSafeAreaEdge.ALL' : 'LayoutSafeAreaEdge.TOP'],
  ]);
 }
 const routeContent=indexType.members.find(node=>node.name?.getText(tree)==='appRouteContent');
 const routePadding=output(routeContent).get('padding')[0].getText(tree);
 const evaluatePadding=new Function('route',`return ${routePadding};`);
 const owner=Object.assign(new Owner(),{appContentTopInset:()=>37});
 for(const [route,top] of [['bookshelf',37],['settings',37],['discover',37],['detail',0],['directory',0]]){
  assert.equal(evaluatePadding.call(owner,route).top,top);
 }
}
if(selectedCase==='paired-chrome'){
 const {createWindowCoordinatorFixture}=await import('./lib/reader-window-coordinator-fixture.mjs'),f=await createWindowCoordinatorFixture();try{const w=f.windowPort();await f.C.install(w);for(const [paper,tone,ink]of[['#FFF8F4EC','dark','#FF14110F'],['#FF1C1E1A','light','#FFEAE7DE']]){const style=new f.S(paper,tone,ink);f.C.requestOverlayChrome(style);for(let i=0;i<20;i++)await Promise.resolve();assert.equal(w.properties.statusBarColor,paper);assert.equal(w.properties.navigationBarColor,paper);assert.equal(w.properties.statusBarContentColor,ink);assert.equal(w.properties.navigationBarContentColor,ink);assert.equal(f.app.get('readerWindowChromeOwner'),'overlay');}}finally{f.cleanup();}
}

}
