import { resolveEtsLoaderRoot } from './lib/tool-environment.mjs';
import { themeDayDesignSource } from './lib/reader-theme-design-source.mjs';
import assert from 'node:assert/strict';
import {createRequire, registerHooks, stripTypeScriptTypes} from 'node:module';
import {createReaderBuilderProbe} from './lib/reader-control-builder-probe.mjs';
import { readFileSync } from 'node:fs';
import {searchSharedActionFixture,updateActualReaderButton} from './lib/search-shared-action-probe.mjs';
import {projectOperationFacts} from '../entry/src/main/ets/app/ReaderOperationFacts.ts';
import {readerAppColor} from '../entry/src/main/ets/features/common/ReaderThemeRegistry.ts';
import {sharedActionFeedbackReset} from './lib/shared-action-feedback-state-probe.mjs';
import {SOURCE_SWITCH_VISUAL} from '../entry/src/main/ets/features/source/SourceSwitchVisual.ts';
import {productionMotionMethods} from './lib/reader-motion-method-probe.mjs';
import {createArkUIPropertyRuntimeProbe} from './lib/arkui-property-runtime-probe.mjs';
import {ReaderWindowMetricsSnapshot, ReaderRectVp, ReaderInsetsVp} from '../entry/src/main/ets/features/common/ReaderWindowMetrics.ts';
registerHooks({resolve(specifier, context, next) {
  try { return next(specifier, context); }
  catch (error) { if (specifier.startsWith('.') && !specifier.endsWith('.ts')) return next(`${specifier}.ts`, context); throw error; }
}});
const {readerFloatingTabContentInset, readerFloatingTabBottomInset, READER_FLOATING_TAB_BAR_HEIGHT} =
  await import('../entry/src/main/ets/features/common/ReaderFloatingBarMetrics.ts');

const read = (relative) => themeDayDesignSource(readFileSync(new URL(`../${relative}`, import.meta.url), 'utf8'));
const tabs = read('entry/src/main/ets/features/shell/MainTabBar.ets');
const settingsShell = read('entry/src/main/ets/features/shell/SettingsShell.ets');
const standardPage = read('entry/src/main/ets/features/common/ReaderStandardPage.ets');
const mainShell = read('entry/src/main/ets/features/shell/MainTabShell.ets');
const bookshelfShell = read('entry/src/main/ets/features/bookshelf/BookshelfShell.ets');
const settingsPage = read('entry/src/main/ets/features/settings/SettingsPage.ets');
const shelf = read('entry/src/main/ets/features/bookshelf/BookshelfPage.ets');
const search = read('entry/src/main/ets/features/search/SearchPage.ets');
const searchField = read('entry/src/main/ets/features/common/ReaderSearchField.ets');
const detail = read('entry/src/main/ets/features/bookshelf/LocalBookDetail.ets');
const switchWindow = read('entry/src/main/ets/features/source/SourceSwitchWindow.ets');
const discover = read('entry/src/main/ets/features/discover/DiscoverPage.ets');
const rss = read('entry/src/main/ets/features/rss/RssPage.ets');

assert.match(tabs,
  /private bottomBarFrame\(\): SurfaceHorizontalFrame[\s\S]*new SurfaceWidthSpec\(Math\.min\(360, 98 \* MAIN_TABS\.length\), 32, 32, 'center'\)/,
  'Phone main tabs preserve count-adaptive narrow width and 32vp edge clearance');
assert.match(tabs, /private verticalRail\(\)[\s\S]*Column\(\{ space: 6 \}\)[\s\S]*\.height\(332\)/,
  'Tablet main tabs must keep the canonical 82x332 geometry');
assert.match(tabs, /private railTabItem[\s\S]*\.width\(66\)[\s\S]*\.height\(58\)/,
  'Tablet tab items must keep the canonical 66x58 geometry');
assert.equal((tabs.match(/\.fontFamily\(TYPE_MAIN_TAB_LABEL\.fontFamily\)/g) ?? []).length, 2,
  'both shared tab labels must consume one semantic role');
assert.match(tabs, /onCurrentTap: \(key: string\) => void/,
  'shared tab bar exposes an optional current-tab action for page-owned scroll-to-top');
assert.match(tabs,
  /if \(!active\) \{[\s\S]*?this\.onSelect\(tab\.key\);[\s\S]*?\} else \{[\s\S]*?this\.onCurrentTap\(tab\.key\);/,
  'active bottom and rail tabs route the current-tab action without changing navigation');
assert.match(settingsShell, /private readonly homeScroller: Scroller = new Scroller\(\);/,
  'SettingsShell owns the home scroll controller');
assert.match(settingsShell, /variant: 'settingsHome',[\s\S]*scroller: this\.homeScroller/,
  'Settings home delegates its original current-tab scroll controller to the public page');
assert.match(standardPage, /Scroll\(this\.scroller\)/,
  'the actual public page binds the caller-owned scroll controller');
assert.match(settingsShell,
  /onCurrentTap: \(_key: string\): void => this\.scrollHomeToTop\(\)/,
  'Settings home forwards the active-tab tap to its scroll owner');
assert.match(settingsShell,
  /private scrollHomeToTop\(\): void \{[\s\S]*?if \(!this\.tapBottomScrollTop \|\| this\.activeSection !== 'home'\) return;[\s\S]*?homeScroller\.scrollTo\(\{ xOffset: 0, yOffset: 0, animation: true \}\)/,
  'current-tab scrolling is gated by the persisted setting and home section');
assert.match(settingsPage, /tapBottomScrollTop: this\.tapBottomScrollTopValue,/,
  'SettingsPage passes the confirmed tap-to-top setting to the shell');
assert.match(bookshelfShell, /MainTabShell\(\{[\s\S]*railVariant: 'bookshelf'/,
  'Bookshelf delegates the preserved rail appearance to an explicit public variant');
assert.match(mainShell, /MainTabBar\(\{[^}]*vertical: true, railVariant: this\.railVariant/,
  'the actual main shell forwards the finite rail variant to the one navigation actor');
assert.match(tabs, /\.borderRadius\(this\.railVariant === 'bookshelf' \? 24 : 25\)/,
  'the shared actor preserves the original bookshelf selection radius');
assert.doesNotMatch(shelf, /private tabletNavigation(?:Item)?\(/,
  'bookshelf content no longer owns a parallel private navigation rail');

assert.match(search, /ReaderSearchField\(\{[\s\S]*variant: 'bookPage'[\s\S]*mode: 'submit'/,
  'book search must use the shared field with its explicit page variant');
assert.match(searchField, /private fixedLineHeightField\(\)[\s\S]*?\.height\(this\.inputHeight\(\)\)\s*\.padding\(0\)[\s\S]*?\.lineHeight\(TYPE_SEARCH_BOOK_INPUT\.lineHeightFp as number\)/,
  'search text must use the full field height without ArkUI internal clipping');
assert.match(searchField, /\.enterKeyType\(EnterKeyType\.Search\)\s*\.onSubmit\(\(_enterKey: EnterKeyType\): void => this\.submit\(\)\)/,
  'the IME search action must use the same search submission path as the button');
assert.match(search,
  /private canSubmit\(\): boolean \{[\s\S]*return scope === undefined \|\| scope\.length > 0;/,
  'the default all-source scope must keep the search action enabled before the first search');
for(const isTablet of[false,true])for(const busy of[false,true]){
 const f=searchSharedActionFixture(busy?{kind:'results',operation:projectOperationFacts({phase:'partial',canCancel:true,canRetry:false})}:{kind:'initial'});
 f.page.isTablet=isTablet;
 f.page.searchBar();const action=f.action(isTablet?'search-field-wide':'search-field-phone',busy?'停止':'搜索');
 assert.equal(action.native.backgroundColor,readerAppColor('app.action.fill','day'),'actual shared search action keeps the original dark fill');
 assert.equal(action.native.opacity,1);assert.equal(action.native.enabled,true);
 const label=f.controls.nodes(action.actor).find(n=>n.type==='Text'&&n.create===(busy?'停止':'搜索'));
 assert.ok(label,'actual shared search action mounts its native label');
 assert.equal(label.fontSize,isTablet?14:13,'phone and wide search actions retain their original type sizes');
 assert.equal(label.lineHeight,isTablet?22:20,'search action line box accommodates the actual CJK fallback metrics');
 assert.equal(label.halfLeading,true,'search and stop labels distribute line leading symmetrically');
 sharedActionFeedbackReset(action.actor,action.native);assert.equal(f.calls.filter(c=>c[0]===(busy?'stopSearch':'performSearch')).length,0,'press and cancel-reset alone never submit or stop');
 action.click();assert.equal(f.calls.filter(c=>c[0]===(busy?'stopSearch':'performSearch')).length,1,'actual native search action submits or stops the live sweep');
 if(busy){
  const spinner=[...f.page.children.values()].findLast(c=>c instanceof f.controls.dependencies.SearchSpinner&&c.active&&c.light);
  assert.ok(spinner,'busy action executes its actual lexical leading Builder and mounts the shared spinner');
  const progress=f.controls.nodes(spinner).find(n=>n.type==='LoadingProgress');
  assert.ok(progress,'actual leading spinner mounts the native loading indicator');
  assert.equal(progress.width,28);assert.equal(progress.height,28);
  assert.equal(progress.enableLoading,true,'actual leading spinner enables native loading');
  const row=f.controls.nodes(action.actor).find(n=>n.type==='Row');
  assert.equal(row.alignItems,'VerticalAlign.Center','native spinner and label share the centered action row');
 }
 updateActualReaderButton(f,action.actor,{actionEnabled:false});assert.equal(action.native.enabled,false);assert.equal(action.native.opacity,0.4);
 action.click();assert.equal(f.calls.filter(c=>c[0]===(busy?'stopSearch':'performSearch')).length,1,'disabled real shared actor does not submit or stop');
 updateActualReaderButton(f,action.actor,{actionEnabled:true});action.actor.aboutToDisappear();action.click();
 assert.equal(f.calls.filter(c=>c[0]===(busy?'stopSearch':'performSearch')).length,1,'retired actual shared actor cannot dispatch');
}
assert.doesNotMatch(search, /SEARCH_BTN_BG/,
  'the initial search action must not fall back to the misleading pale disabled treatment');
assert.equal((search.match(/SearchSpinner\(\{/g) ?? []).length, 2,
  'search loading affordances must share one mounted indicator per active surface without duplicate loading nodes');
assert.doesNotMatch(search, /importing_spinner_(track|arc)/,
  'search must not present a static spinner as active work');

assert.match(detail, /private readingActionLabel\(\): string \{[\s\S]*return this\.inBookshelf \? '继续阅读' : '开始阅读';/,
  'a search preview must say start reading until it joins the shelf');
assert.ok((detail.match(/this\.readingActionLabel\(\)/g) ?? []).length >= 1,
  'the actionable label consumes the shared shelf/content-aware projection');

assert.match(shelf, /return \/\^\(https\?:\\\/\\\/\|data:image/,
  'bookshelf cards must admit the same remote cover URLs as detail');
// Execute the SDK-emitted List modifier used by both layouts. The old
// shelfBottomContentInset(isTablet) method is no longer mounted, so a regex
// on that dead method cannot establish clearance of the actual scroll surface.
const shelfBreakpoint = Number(read('entry/src/main/ets/features/bookshelf/BookshelfShell.ets')
  .match(/export const BOOKSHELF_WIDE_BREAKPOINT = (\d+);/)[1]);
let shelfMetrics = new ReaderWindowMetricsSnapshot(new ReaderRectVp(0, 0, 390, 844));
const builderMethods = createRequire(import.meta.url)(`${resolveEtsLoaderRoot()}/lib/component_map.js`).CUSTOM_BUILDER_METHOD;
for (const name of ['continueReadingCard', 'sectionAction', 'filterRow', 'projectionRow']) builderMethods.add(name);
const shelfProperties = createArkUIPropertyRuntimeProbe();
const {owner: shelfLayout} = createReaderBuilderProbe(shelf,
  ['bookshelfList', 'isWideViewport', 'effectiveViewportWidth', 'headerClearance'], {
    ...shelfProperties.sdk,
    BOOKSHELF_WIDE_BREAKPOINT: shelfBreakpoint,
    ReaderWindowCoordinator: {metrics: () => shelfMetrics}, readerFloatingTabContentInset,
    LazyForEach: {create() {}, pop() {}},
  }, shelfProperties.hooks);
Object.assign(shelfLayout, {readerWindowMetricsRevision: 0, viewportWidth: 0,
  continueReading: undefined, filterRowVisible: false, viewModeError: '', visibleBookCount: 1,
  rowDataSource: {totalCount: () => 0}, shelfContentWidth: () => 300,
  sectionAction() {}, sectionActionAsset: () => '',
  shelfScrollHandler: () => () => {}, shelfPageHandler: () => () => {},
  saveShelfViewport() {}, restoreShelfViewport() {},
});
const ShelfShell = productionMotionMethods(new URL('../entry/src/main/ets/features/bookshelf/BookshelfShell.ets', import.meta.url),
  ['showBottomNav'], {BOOKSHELF_WIDE_BREAKPOINT: shelfBreakpoint, ReaderWindowCoordinator: {metrics: () => shelfMetrics}});
const shelfShellLayout = Object.assign(new ShelfShell(), {populated: true, readerWindowMetricsRevision: 0, viewportWidth: 0});
shelfLayout.bookshelfList(false);
const shelfListNode = [...shelfLayout.nodes.values()].find(n => n.type === 'List');
assert.ok(shelfListNode, 'the actual shared shelf mounts its native List');
for (const [width, safeBottom] of [[390, 0], [390, 34], [599, 48], [600, 34], [1024, 48]]) {
  shelfMetrics = new ReaderWindowMetricsSnapshot(new ReaderRectVp(0, 0, width, 900),
    undefined, new ReaderInsetsVp(0, 0, 0, safeBottom));
  shelfLayout.replay();
  assert.equal(shelfShellLayout.showBottomNav(), width < shelfBreakpoint,
    'the populated shelf shell mounts a bottom overlay only in the phone layout');
  assert.equal(shelfListNode.height, '100%', 'floating bars do not shrink the actual List viewport');
  assert.equal(shelfListNode.contentStartOffset, 74, 'the shared floating title clearance remains in scroll content');
  if (width < shelfBreakpoint) {
    assert.equal(shelfListNode.contentEndOffset, READER_FLOATING_TAB_BAR_HEIGHT + Math.max(15, safeBottom) + 16,
      'Phone last row clears the 68vp floating tab and its live interactive-safe bottom plus 16vp gap');
    assert.equal(shelfListNode.contentEndOffset - READER_FLOATING_TAB_BAR_HEIGHT - readerFloatingTabBottomInset(shelfMetrics), 16);
  } else {
    assert.equal(shelfListNode.contentEndOffset, 24,
      'Tablet uses the left navigation rail and keeps only the approved bounded 24vp trailing gap');
  }
}
assert.match(tabs, /\.height\(68\)/, 'the live phone navigation retains the height used by content clearance');
assert.match(tabs, /\.margin\(\{ bottom: this\.bottomInset\(\) \}\)/);
assert.match(tabs, /return readerFloatingTabBottomInset\(ReaderWindowCoordinator\.metrics\(\)\);/,
  'the actual tab shares the same live safe-bottom projection as the shelf');
assert.match(shelf, /if \(this\.isWideViewport\(\)\) \{[\s\S]*?this\.tabletContent\(\);/,
  'wide shelf renders its actual tablet content');
assert.match(mainShell, /if \(this\.showTabletRail\) \{[\s\S]*?MainTabBar\(\{[^}]*vertical: true/,
  'the actual public shell owns the approved left rail as a separate overlay');
assert.match(read('entry/src/main/ets/features/bookshelf/BookshelfShell.ets'), /showBottomNav: this\.showBottomNav\(\),/,
  'the mounted shell consumes the live layout decision verified above');
assert.doesNotMatch(shelf, /\.padding\(\{ top: TOK_SPACE_XS, bottom: TOK_SPACE_MD \}\)/,
  'floating bars must not shrink the List viewport with vertical padding');
assert.doesNotMatch(shelf, /bottom: (628|744)/,
  'bookshelf scrolling must not include fixed-canvas blank space below the last book');
assert.equal((shelf.match(/this\.bookshelfList\((false|true)\)/g) ?? []).length, 2,
  'Phone and Tablet must both use the same top-origin lazy shelf viewport');
assert.match(shelf,
  /private phoneContentFrame\(\): SurfaceHorizontalFrame[\s\S]*new SurfaceWidthSpec\(TOK_CONTENT_MAX_W_PHONE, TOK_SCREEN_INSET, TOK_SCREEN_INSET\)/,
  'phone shelf width must be derived from the shared live safe frame');
assert.match(shelf,
  /private projectionBookTranslateX[\s\S]*this\.bookRowSpace\(this\.shelfContentWidth\(isTablet\), isTablet\)/,
  'the persistent three-column shelf projection must shrink its gap or cards on a narrow physical screen');
assert.match(discover, /private discoverContent\(\)[\s\S]*\.width\('100%'\)\s*\.constraintSize\(\{ maxWidth: this\.contentFrame\(\)\.width \}\)/,
  'Discover content must fill a narrow viewport and only cap its width on larger screens');
assert.match(rss,
  /private contentFrame\(\): SurfaceHorizontalFrame[\s\S]*readerVisualSafeLeft\(metrics\) - railWidth[\s\S]*new SurfaceWidthSpec\(TOK_CONTENT_RAIL_W_TABLET, TOK_SCREEN_INSET, TOK_SCREEN_INSET\)/,
  'RSS content width must be bounded by the live viewport after horizontal insets');

// The approved source view keeps discovery in a small live status row. Run
// its SDK-emitted child update rather than asserting the removed loading body.
const require=createRequire(import.meta.url),sdk=resolveEtsLoaderRoot();
const syntax=require(`${sdk}/lib/validate_ui_syntax.js`);
syntax.componentCollection.customComponents.add('SourceSwitchSpinner');syntax.propCollection.set('SourceSwitchSpinner',new Set(['active','diameter','strokeWidth','durationMs','reduceMotion']));
class SpinnerChild{constructor(owner,params,_storage,id){Object.assign(this,{owner,params,id});}}
const switchSource=readFileSync(new URL('../entry/src/main/ets/features/source/SourceSwitchWindow.ets',import.meta.url),'utf8');
const windowStruct=switchSource.slice(switchSource.indexOf('@Component\nexport struct SourceSwitchWindow'));
const gatewaySource=readFileSync(new URL('../entry/src/main/ets/features/source/SourceSwitchGateway.ts',import.meta.url),'utf8');
const countStart=gatewaySource.indexOf('export function sourceSwitchSourceCount'),countEnd=gatewaySource.indexOf('\nfunction deduplicateSourceSwitchCandidates',countStart);
assert.ok(countStart>=0&&countEnd>countStart,'actual distinct-source count remains bound to production');
const sourceSwitchSourceCount=new Function(stripTypeScriptTypes(gatewaySource.slice(countStart,countEnd)).replace(/^export /gm,'')+';return sourceSwitchSourceCount;')();
const makeStatus=(sweeping=true)=>{
 const {owner:status}=createReaderBuilderProbe(windowStruct,['novelDiscovery'],{SourceSwitchSpinner:SpinnerChild,SOURCE_SWITCH_VISUAL,sourceSwitchSourceCount,ButtonType:{Normal:'ButtonType.Normal'}});
 Object.assign(status,{appThemeScheme:'day',foreground:true,reduceMotion:false,displayedCandidates:[],isSweeping:()=>sweeping,
  statusText:()=>'',novelDiscoveryPhase:()=>sweeping?'正在查找':'已停止',narrowWindow:()=>false,discoveryPrefixVisible:()=>true,
  compactDiscoveryAction:()=>false,discoveryActionVisibleHeight:()=>SOURCE_SWITCH_VISUAL.discoveryActionVisibleHeight,
  discoveryActionBackgroundColor:()=>readerAppColor('TOK_PRIMARY_SOFT','day'),discoveryActionWidth:()=>SOURCE_SWITCH_VISUAL.discoveryActionWidth,
  discoveryActionHitHeight:()=>SOURCE_SWITCH_VISUAL.discoveryActionMinHeight,discoveryToolbarHeight:()=>SOURCE_SWITCH_VISUAL.discoveryHeight,
  busy:()=>false,rollbackRequired:()=>false,discoveryActionTouch:()=>{},requestRefresh:()=>{}});
 status.novelDiscovery();return status;
};
const status=makeStatus();
const spinner=[...status.children.values()][0];assert.equal(spinner.params.active,true);assert.equal(spinner.params.diameter,SOURCE_SWITCH_VISUAL.discoverySpinnerSize);
assert.equal(spinner.params.strokeWidth,SOURCE_SWITCH_VISUAL.discoverySpinnerStrokeWidth);assert.equal(spinner.params.durationMs,SOURCE_SWITCH_VISUAL.discoverySpinnerDurationMs);
status.foreground=false;status.replay();assert.equal(spinner.params.active,false,'background discovery does not animate');
status.foreground=true;status.reduceMotion=true;status.replay();assert.equal(spinner.params.active,true);assert.equal(spinner.params.reduceMotion,true);
const stopped=makeStatus(false);assert.equal(stopped.children.size,0,'stopped discovery replaces the animation with its selected static search glyph');
assert.ok([...stopped.nodes.values()].some(node=>node.type==='Image'&&node.create==='app.media.search_mag'));
assert.doesNotMatch(switchWindow, /importing_spinner_(track|arc)/,
  'source-switch loading must not stack two spinner circles');

// The quick directory's List frame moved into the shared ReaderDirectoryList;
// the no-recycle policy is asserted there.
const directoryList = read('entry/src/main/ets/features/reading/ReaderDirectoryList.ets');
assert.match(directoryList,
  /LazyForEach\(this\.dataSource/,
  'the quick directory must not recycle a small visible row pool across a long TOC');
assert.doesNotMatch(directoryList, /virtualScroll\(\{ reusable: true \}\)/,
  'the phone runtime regression must not be reintroduced');

console.log('reader reported feedback regressions: PASS');
