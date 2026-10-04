import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire, stripTypeScriptTypes } from 'node:module';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { readerAppColor } from '../entry/src/main/ets/features/common/ReaderThemeRegistry.ts';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';

const read = (relative) => readFileSync(new URL(`../${relative}`, import.meta.url), 'utf8');

const coordinator = read('entry/src/main/ets/app/ReaderWindowCoordinator.ts');
const index = read('entry/src/main/ets/pages/Index.ets');
const experience = read('entry/src/main/ets/features/reading/LocalReadingExperience.ets');

assert.doesNotMatch(index, /\$r\('app\.color\.reader_surface'\)/,
  'app safe-area root must not paint a fixed day resource behind night window chrome');
// Read the actual outer Stack modifier chain. A count over the whole Index
// was accidentally coupled to the old failure branch's duplicate background.
const require = createRequire(import.meta.url);
const sdk = process.env.READER_ETS_LOADER_ROOT ?? '/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
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
const mainShell = read('entry/src/main/ets/features/shell/MainTabShell.ets');
const syntax = require(`${sdk}/lib/validate_ui_syntax.js`);
syntax.componentCollection.customComponents.add('MainTabBar');
const { owner: sharedShell } = createReaderBuilderProbe(mainShell, ['content','build'], {
  MainTabBar: class { constructor(owner, params, _storage, id) { Object.assign(this, {owner,params,id}); } },
});
Object.assign(sharedShell, { appThemeScheme: 'day', showTabletRail: false, showBottomNav: false, content() {} });
sharedShell.initialRender();
const contentRoot = [...sharedShell.nodes.values()].find(node => node.type === 'Stack' && node.backgroundColor !== undefined);
assert.ok(contentRoot, 'full-size shared app shell paints beneath failure content');
for (const scheme of ['day','night','day']) {
  sharedShell.appThemeScheme = scheme; sharedShell.replay();
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
assert.ok([...failureContent.nodes.values()].some(node => node.type === 'Text' && node.create === '书架加载失败'));
assert.ok([...failureContent.nodes.values()].every(node => node.backgroundColor === undefined || node.type === 'Text'),
  'failure body inherits shared root paint while retaining the retry button fill');

assert.match(coordinator,
  /class ReaderWindowChromeStyle[\s\S]*underlayColor: string;[\s\S]*tone: ReaderWindowChromeTone;/,
  'system-bar underlay and icon tone must be one style value');
assert.match(coordinator,
  /statusBarColor: ReaderWindowCoordinator\.nativeStatusBarColor\(request\),[\s\S]*navigationBarColor: request\.style\.transparentSystemBars \? '#00000000' : request\.style\.underlayColor,[\s\S]*statusBarContentColor: contentColor/,
  'one revision must expose the owned paper while preserving paired navigation base and content ink');
assert.match(coordinator,
  /contentColor: string;[\s\S]*constructor\(underlayColor: string, tone: ReaderWindowChromeTone, contentColor\?: string,[\s\S]*paperThemeId: string = '', transparentSystemBars: boolean = false\)[\s\S]*this\.contentColor = contentColor \?\? /,
  'chrome style must carry an explicit foreground color with a tone fallback');
assert.doesNotMatch(coordinator, /#99000000/, 'system-bar content must not use translucent black');
assert.doesNotMatch(coordinator, /requestOverlayChrome\(tone:/,
  'overlay chrome must not accept an independent tone-only request');
assert.match(coordinator,
  /requestOverlayChrome\(inheritedReaderStyle: ReaderWindowChromeStyle\)[\s\S]*new ReaderWindowChromeRequest\('overlay', inheritedReaderStyle\)/,
  'overlay chrome must inherit the complete reader style');

assert.match(experience,
  /const themeStyle = readerAppearanceThemeStyle\(this\.appearanceSnapshot\.activeTheme\);[\s\S]*new ReaderWindowChromeStyle\([\s\S]*themeStyle\.paperStart,[\s\S]*readerAppearanceChromeTone\(this\.appearanceSnapshot\.activeTheme\),[\s\S]*themeStyle\.ink/,
  'the active reading theme must provide exact underlay, tone, and ink');
assert.match(experience, /requestOverlayChrome\(chromeStyle\)/,
  'reader overlays must inherit the active paired style');

assert.match(index,
  /padding\(\{ top: this\.readerOwnsWindowEdges\(\) \? 0 : this\.appContentTopInset\(\) \}\)/,
  'safe-top removal must depend on visible reader edge ownership');
assert.match(index,
  /expandSafeArea\(this\.mangaOwnsWindowEdges\(\) \? \[SafeAreaType\.SYSTEM, SafeAreaType\.CUTOUT\] : \[SafeAreaType\.SYSTEM\],\s*this\.mangaOwnsWindowEdges\(\) \? \[SafeAreaEdge\.TOP, SafeAreaEdge\.BOTTOM, SafeAreaEdge\.START, SafeAreaEdge\.END\] :\s*this\.readerOwnsWindowEdges\(\) \? \[SafeAreaEdge\.TOP, SafeAreaEdge\.BOTTOM\] : \[SafeAreaEdge\.BOTTOM\]\)/,
  'the root must also grant the reader the full top edge; a child cannot restore an excluded ancestor viewport');
const EdgeOwner = productionMotionMethods(fileURLToPath(new URL('../entry/src/main/ets/pages/Index.ets', import.meta.url)), ['readerOwnsWindowEdges']);
for (const [route, readingSessionActive, directoryReturnTarget, expected] of [
  ['detail', false, 'detail', false], ['detail', true, 'detail', false],
  ['directory', false, 'detail', false], ['directory', true, 'detail', false],
  ['directory', false, 'readerControl', false], ['directory', true, 'readerControl', true],
  ['reading', true, 'detail', true], ['reading', false, 'detail', false],
]) {
  const owner = Object.assign(new EdgeOwner(), { route, readingSessionActive, directoryReturnTarget });
  assert.equal(owner.readerOwnsWindowEdges(), expected,
    'ordinary catalog inherits App safe top; only visible reading control owns window edges');
}
assert.match(experience,
  /applyWindowPolicyForChromeOwner\(\)[\s\S]*?if \(this\.windowChromeActive\)[\s\S]*?applyReaderWindowPolicy[\s\S]*?requestAppWindowPolicy/,
  'a hidden reader warming behind Detail must not hide the app status bar');

console.log('reader window chrome P0 contract: PASS');
