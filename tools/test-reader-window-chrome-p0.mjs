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
const { readerAppColor } = await import('../entry/src/main/ets/features/common/ReaderThemeRegistry.ts');
const {selectedProductionMethods} = await import('./lib/selected-production-methods.mjs');


const read = (relative) => readFileSync(new URL(`../${relative}`, import.meta.url), 'utf8');

const coordinator = read('entry/src/main/ets/app/ReaderWindowCoordinator.ts');
const index = read('entry/src/main/ets/pages/Index.ets');
const experience = read('entry/src/main/ets/features/reading/LocalReadingExperience.ets');


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
const syntax = require(`${sdk}/lib/validate_ui_syntax.js`);
syntax.componentCollection.customComponents.add('MainTabBar');
const { owner: sharedShell } = createReaderBuilderProbe(mainShell, ['content','build'], {
  MainTabBar: class { constructor(owner, params, _storage, id) { Object.assign(this, {owner,params,id}); } },
});
Object.assign(sharedShell, { appThemeScheme: 'day', showTabletRail: false, showBottomNav: false, content() {} });
sharedShell.initialRender();
// The app facade delegates paint to the actual shared native frame.
const sharedFrame = [...sharedShell.children.values()].find(child => child.variant === 'mainTab');
assert.ok(sharedFrame, 'the app facade mounts the production page frame');
const contentRoot = [...sharedFrame.nodes.values()].find(node => node.type === 'Stack' && node.backgroundColor !== undefined);
assert.ok(contentRoot, 'full-size shared app shell paints beneath failure content');
for (const scheme of ['day','night','day']) {
  sharedFrame.appThemeScheme = scheme; sharedFrame.replay();
  const windowPaint = readerAppColor('app.window.background', scheme);
  assert.equal(indexPaint.call({appThemeScheme:scheme}, readerAppColor), windowPaint, 'Index root follows window chrome');
  assert.equal(contentRoot.backgroundColor, windowPaint, 'shared shelf shell, including failure, follows the same live palette');
}
// Verify failure remains inside the common bookshelf content slot, rather than
// silently regaining a separate page root that this palette check would miss.
const content = indexType.members.find(node => node.name?.getText(tree) === 'bookshelfContent');
assert.ok(content);
const calls = (node, name, sourceTree = tree) => {
  const result = []; const visit = item => {
    if ((ts.isCallExpression(item) || ts.isEtsComponentExpression(item)) && item.expression.getText(sourceTree) === name) result.push(item);
    ts.forEachChild(item, visit);
  }; visit(node); return result;
};
const shellContent = indexType.members.find(node => node.name?.getText(tree) === 'bookshelfShellContent');
assert.ok(shellContent);
assert.equal(calls(build, 'this.bookshelfShellContent').length, 1);
assert.equal(calls(shellContent, 'BookshelfShell').length, 1);
assert.equal(calls(shellContent, 'this.bookshelfContent').length, 1, 'shared shell receives the readiness content slot');
const shelfShellTree = parse(read('entry/src/main/ets/features/bookshelf/BookshelfShell.ets'));
assert.equal(calls(shelfShellTree, 'MainTabShell', shelfShellTree).length, 1, 'bookshelf chrome uses the actual app palette owner');
const failure = calls(content, 'BookshelfStatusContent'); assert.equal(failure.length, 1);
const failedProp = failure[0].arguments[0].properties.find(node => node.name?.getText(tree) === 'failed');
assert.equal(failedProp.initializer.getText(tree), 'this.bookshelfLoadFailed');
const status = read('entry/src/main/ets/features/bookshelf/BookshelfStatusContent.ets');
syntax.componentCollection.customComponents.add('SearchSpinner');
const { owner: failureContent } = createReaderBuilderProbe(status, ['build'], { READER_FLOATING_TOP_BAR_HEIGHT: 58 });
Object.assign(failureContent, { failed:true, appThemeScheme:'night', onRetry() {},
  minimumContentHeight: () => 400, bottomContentInset: () => 99 });
failureContent.initialRender();
const messageTree = current => [...current.nodes.values(), ...[...current.children.values()].flatMap(child => child.nodes ? messageTree(child) : [])];
assert.ok(messageTree(failureContent).some(node => node.type === 'Text' && node.create === '书架加载失败'));
assert.ok([...failureContent.nodes.values()].every(node => node.backgroundColor === undefined || node.type === 'Text'),
  'failure body inherits shared root paint while retaining the retry button fill');


}

if(selectedCase==='root-edges'){
 const Owner=selectedProductionMethods(new URL('../entry/src/main/ets/pages/Index.ets',import.meta.url),'Index',['readerOwnsWindowEdges','mangaOwnsWindowEdges']);
 const cases=[['detail',false,'detail',undefined,false,false],['detail',false,'detail',{contentKind:'text'},true,false],['directory',false,'detail',{contentKind:'manga'},true,false],['directory',false,'detail',{contentKind:'text'},false,false],['directory',true,'readerControl',undefined,true,false],['reading',true,'detail',undefined,true,false],['reading',true,'detail',undefined,true,true]];
 for(const [route,active,target,detail,reader,manga]of cases){const o=Object.assign(new Owner(),{route,readingSessionActive:active,directoryReturnTarget:target,detailBook:detail,readingContentKind:manga?'manga':'text'});assert.equal(o.readerOwnsWindowEdges(),reader);assert.equal(o.mangaOwnsWindowEdges(),manga);}
 const modifiers=new Map();let e=build.body.statements[0].expression;while(ts.isCallExpression(e)&&ts.isPropertyAccessExpression(e.expression)){modifiers.set(e.expression.name.text,e.arguments);e=e.expression.expression;}
 const keys=['padding','expandSafeArea','ignoreLayoutSafeArea'];for(const key of keys)assert.ok(modifiers.has(key),'actual Index root '+key);
 const enums=Object.fromEntries(['SafeAreaType','SafeAreaEdge','LayoutSafeAreaType','LayoutSafeAreaEdge'].map(name=>[name,new Proxy({},{get:(_,key)=>name+'.'+String(key)})]));
 for(const [reader,manga]of[[false,false],[true,false],[true,true]]){const o={readerOwnsWindowEdges:()=>reader,mangaOwnsWindowEdges:()=>manga,appContentTopInset:()=>37};const evaluate=key=>new Function(...Object.keys(enums),'return ['+modifiers.get(key).map(n=>n.getText(tree)).join(',')+'];').call(o,...Object.values(enums));assert.equal(evaluate('padding')[0].top,reader?0:37);const areas=evaluate('expandSafeArea');assert.equal(areas[1].includes('SafeAreaEdge.TOP'),reader||manga);assert.equal(areas[1].includes('SafeAreaEdge.START'),manga);const ignore=evaluate('ignoreLayoutSafeArea');assert.equal(ignore[0].includes('LayoutSafeAreaType.SYSTEM'),manga);}
}
if(selectedCase==='paired-chrome'){
 const {createWindowCoordinatorFixture}=await import('./lib/reader-window-coordinator-fixture.mjs'),f=await createWindowCoordinatorFixture();try{const w=f.windowPort();await f.C.install(w);for(const [paper,tone,ink]of[['#FFF8F4EC','dark','#FF14110F'],['#FF1C1E1A','light','#FFEAE7DE']]){const style=new f.S(paper,tone,ink);f.C.requestOverlayChrome(style);for(let i=0;i<20;i++)await Promise.resolve();assert.equal(w.properties.statusBarColor,paper);assert.equal(w.properties.navigationBarColor,paper);assert.equal(w.properties.statusBarContentColor,ink);assert.equal(w.properties.navigationBarContentColor,ink);assert.equal(f.app.get('readerWindowChromeOwner'),'overlay');}}finally{f.cleanup();}
}

}
