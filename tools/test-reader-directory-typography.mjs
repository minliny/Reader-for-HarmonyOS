import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
const selected=selectContractCases({'panel-roles':{description:'Actual SDK current FullDirectory header/tab semantic typography and callbacks',resources:[]}});
async function runCase(){
const {default:assert}=await import('node:assert/strict');const {readFileSync}=await import('node:fs');
const {createReaderBuilderProbe}=await import('./lib/reader-control-builder-probe.mjs');
const {readerTypographyRoles}=await import('./lib/reader-typography-probe.mjs');
const source = readFileSync(new URL('../entry/src/main/ets/features/reading/ui/FullDirectoryPanel.ets', import.meta.url), 'utf8');
const toolbarSource=readFileSync(new URL('../entry/src/main/ets/features/reading/ui/ReaderDirectoryToolbar.ets', import.meta.url),'utf8');
class ToolbarChild { constructor(owner,params,_storage,id){this.owner=owner;this.params=params;this.id=id;} updateStateVars(next){Object.assign(this.params,next);} }
const { owner } = createReaderBuilderProbe(source, ['panelHeader', 'collapseLabel', 'directoryTab', 'directoryTabContent',
  'bookmarkTab', 'bookmarkTabContent', 'choosePanelTab', 'statusFooter', 'currentTitle', 'currentPosition',
  'searchControls', 'searchPlaceholder'], {ReaderDirectoryToolbar:ToolbarChild}, {childSources:{ReaderDirectoryToolbar:toolbarSource}});
let close = 0, directory = 0, bookmarks = 0;
const toolIntents = [];
Object.assign(owner, { appThemeScheme: 'day', expandedLayout:false, activeTab: 'directory', currentChapterIndex: 2, chapters: [{title:'一'}, {title:'二'}, {title:'三'}],
  totalChapters: 3, innerWidth: () => 328, tabHeight: () => 32, activeTabLineWidth: () => 38,
  ascending: true, handleControl: kind => toolIntents.push(kind),
  onExit: () => close++, switchTab: tab => tab === 'directory' ? directory++ : bookmarks++,
  cancelProjectionTopScroll: () => {}, listScroller: { scrollEdge() {} } });
owner.panelHeader(); owner.directoryTab(); owner.bookmarkTab(); owner.searchControls();
const text = [...owner.nodes.values()].filter(node=>node.type==='Text');
assert.equal(text.find(node=>node.create==='目录').fontSize,readerTypographyRoles.TYPE_READER_DIRECTORY_HEADING.fontSizeFp);
const collapse=text.find(node=>node.create==='收起');assert.ok(collapse);
assert.equal(collapse.fontSize,readerTypographyRoles.TYPE_READER_DIRECTORY_COLLAPSE.fontSizeFp);assert.equal(collapse.lineHeight,readerTypographyRoles.TYPE_READER_DIRECTORY_COLLAPSE.lineHeightFp);
const nodes = [...owner.nodes.values()];
nodes.find(node=>node.accessibilityText==='收起目录').onClick();
nodes.find(node=>node.accessibilityText==='书签').onClick();
assert.equal(close,1); assert.equal(bookmarks,1);
assert.equal(nodes.find(node=>node.accessibilityText==='收起目录').type,'Button');
assert.equal(nodes.find(node=>node.accessibilityText==='目录').type,'Button');
assert.equal(nodes.find(node=>node.accessibilityText==='书签').type,'Button');
const toolbarParams=[...owner.children.values()].find(child=>child instanceof ToolbarChild).params;
assert.equal(toolbarParams.variant,'full-directory');
const toolbar=createReaderBuilderProbe(toolbarSource,['tool','toolLabel','iconSize']).owner;
Object.assign(toolbar,{appThemeScheme:'day',...toolbarParams});
for(const [kind,label] of [['search','搜索章节'],['top','回到目录顶部'],['bottom','前往目录底部'],['sort','按章节倒序排列']]){
  toolbar.tool(kind,toolbarParams[{search:'onSearch',top:'onTop',bottom:'onBottom',sort:'onToggleSort'}[kind]]);
  const tool = [...toolbar.nodes.values()].find(node => node.accessibilityText === label);
  assert.equal(tool?.type,'Button');
  assert.equal(tool?.accessibilityRole,'AccessibilityRoleType.BUTTON');
  assert.equal(tool.focusable,true);
  assert.equal(tool.width,32);assert.equal(tool.height,32);
  tool.onClick();
}
assert.deepEqual(toolIntents,['search','top','bottom','sort']);
const fullSource = readFileSync(new URL('../entry/src/main/ets/features/reading/ui/ReaderFullDirectory.ets', import.meta.url), 'utf8');
const full = createReaderBuilderProbe(fullSource, ['headerSpec', 'topBar', 'topBarBack', 'topBarBackIcon', 'topBarActions',
  'topBarSourceContent', 'topBarMoreIcon', 'switchDirectorySource', 'topBarMoreLabel', 'topBarMoreEnabled',
  'toggleTopBarMore', 'offlineBookMenu', 'offlineBookMenuRow', 'offlineBookAction', 'consumeBack', 'directoryRulesCurrent'],
  {Divider:{create(){},pop(){},color(){},strokeWidth(){}}}).owner;
let switches=0, downloads=0, clears=0, collapses=0;
Object.assign(full, { appThemeScheme:'day', bookTitle:'书名', bookId:'book', usesExpandedLayout:()=>false,
  topBarLeft:()=>0, topBarRight:()=>0, isLocalBook:()=>false, offlineBookOperationActive:false,
  directoryRulesAvailable:()=>false, mounted:true, collapseStarted:false, offlineMenuGeneration:0,
  directoryRulesVisible:false, directoryRecovery:{offlineBlocked:true}, offlineMenuVisible:false,
  temporaryBackIdentity:'opening', interactive:true, isOpeningCurrent:()=>true,
  dismissDirectoryKeyboard:()=>false, requestCollapse:()=>collapses++,
  onSwitchSource:()=>switches++, onDownloadBook:()=>downloads++, onClearBookOffline:()=>clears++,
  offlineMenuLeft:()=>0, geometry:{header:{bottom:54}} });
full.topBar('opening','book');
const offline = [...full.nodes.values()].find(node=>node.accessibilityText==='离线管理');
const back = [...full.nodes.values()].find(node=>node.accessibilityText==='收起目录');
const sourceAction = [...full.nodes.values()].find(node=>node.accessibilityText==='换源');
for(const [node,width] of [[back,44],[sourceAction,62],[offline,34]]){
  assert.equal(node?.type,'Button','the real phone top-bar action is native');
  assert.equal(node.height,full.headerSpec.controlHeight);assert.equal(node.width,width);
  assert.equal(node.padding,0);assert.equal(node.borderRadius,0);
  assert.equal(node.accessibilityRole,'AccessibilityRoleType.BUTTON');
}
sourceAction.onClick();assert.equal(switches,1,'one native activation emits one original switch intent');
full.mounted=false;sourceAction.onClick();assert.equal(switches,1);
full.mounted=true;full.collapseStarted=true;sourceAction.onClick();assert.equal(switches,1);
full.collapseStarted=false;full.isLocalBook=()=>true;sourceAction.onClick();assert.equal(switches,1);
full.isLocalBook=()=>false;
assert.equal(offline?.enabled,false);assert.equal(offline.focusable,false);offline.onClick();
assert.equal(full.offlineMenuVisible,false);
full.directoryRecovery={offlineBlocked:false};full.replay();
assert.equal(offline.enabled,true);offline.onClick();assert.equal(full.offlineMenuVisible,true);
full.offlineBookMenu();
const download = [...full.nodes.values()].find(node=>node.accessibilityText==='下载整书');
const clear = [...full.nodes.values()].find(node=>node.accessibilityText==='清除本书离线内容');
for(const node of [download,clear]){
  assert.equal(node?.type,'Button');assert.equal(node.width,'100%');
  assert.equal(node.height,full.headerSpec.menuRowHeight);assert.equal(node.padding,0);
}
const downloadLabel=[...full.nodes.values()].find(node=>node.type==='Text'&&node.create==='下载整书');
assert.equal(downloadLabel.fontSize,readerTypographyRoles.TYPE_READER_DIRECTORY_OFFLINE_ACTION.fontSizeFp);
assert.deepEqual(downloadLabel.padding,{left:16});
download.onClick();assert.equal(downloads,1);assert.equal(full.offlineMenuVisible,false);
clear.onClick();assert.equal(clears,0,'the closed opening cannot dispatch a second offline action');
offline.onClick();assert.equal(full.offlineMenuVisible,true);
download.onClick();assert.equal(downloads,1,'an old menu callback cannot act on a newer opening');
back.onClick();assert.equal(full.offlineMenuVisible,false,'Back closes the active temporary menu first');
full.temporaryBackIdentity='next-opening';back.onClick();assert.equal(collapses,0,'old top-bar Back cannot collapse a new directory opening');
full.temporaryBackIdentity='opening';full.isOpeningCurrent=()=>false;back.onClick();assert.equal(collapses,0);
full.isOpeningCurrent=()=>true;back.onClick();assert.equal(collapses,1);
// Content/keyboard/selection interaction probes are already covered by the
// production directory/bookmark suites; historical migration options are withdrawn.
console.log('PASS actual current directory header/tab role propagation and callbacks; design tuple validity is not asserted');

}
for(const id of selected){await runCase();recordContractCasePass(id);}
