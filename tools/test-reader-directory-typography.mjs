import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
const selected=selectContractCases({'panel-roles':{description:'Actual SDK current FullDirectory header/tab semantic typography and callbacks',resources:[]}});
async function runCase(){
const {default:assert}=await import('node:assert/strict');const {readFileSync}=await import('node:fs');
const {createReaderBuilderProbe}=await import('./lib/reader-control-builder-probe.mjs');
const {readerTypographyRoles}=await import('./lib/reader-typography-probe.mjs');
const source = readFileSync(new URL('../entry/src/main/ets/features/reading/FullDirectoryPanel.ets', import.meta.url), 'utf8');
const { boundedMembers } = await import('./lib/bounded-surface-sdk-probe.mjs');
const { pureModuleProbe } = await import('./lib/ets-pure-module-probe.mjs');
const scaleSource = readFileSync(new URL('../entry/src/main/ets/features/common/ReaderSurfaceResolvers.ts', import.meta.url), 'utf8');
const scales = pureModuleProbe(scaleSource, 'ReaderSurfaceResolvers.ts', {}, ['readerScaledControlHeight', 'readerReadableFontScale']);
const { productionReaderPressFeedback } = await import('./lib/reader-press-feedback-probe.mjs');
const chrome = readFileSync(new URL('../entry/src/main/ets/features/reading/ReaderPanelChrome.ets', import.meta.url), 'utf8');
const specs = pureModuleProbe(chrome.slice(0, chrome.indexOf('@Component')), 'ReaderPanelChrome.ets', readerTypographyRoles, ['resolveReaderPanelCollapseSpec']);
const { createArkUIPropertyRuntimeProbe } = await import('./lib/arkui-property-runtime-probe.mjs');
const properties = createArkUIPropertyRuntimeProbe();
const accessibility=pureModuleProbe(readFileSync(new URL('../entry/src/main/ets/features/common/ReaderActionAccessibility.ets',import.meta.url),'utf8'),'ReaderActionAccessibility.ets',{AccessibilityRoleType:{BUTTON:'button'}},['readerActionTouchRegion','ReaderActionAccessibility']);
const Collapse = createReaderBuilderProbe(chrome, boundedMembers(chrome, 'ReaderPanelCollapseButton'),
 { ...properties.sdk, ...specs, ReaderPressFeedback: productionReaderPressFeedback() }, { ...properties.hooks, componentName: 'ReaderPanelCollapseButton' }).Component;
const { owner } = createReaderBuilderProbe(source,
 ['panelHeader', 'panelHeaderHeight', 'fontScale', 'directoryTab', 'bookmarkTab', 'statusFooter', 'currentTitle', 'currentPosition'],
 { ...scales, ...accessibility, ReaderPanelCollapseButton: Collapse }, { childSources: { ReaderPanelCollapseButton: chrome }, mountChildren: true });
let close = 0, directory = 0, bookmarks = 0;
Object.assign(owner, { appThemeScheme: 'day', activeTab: 'directory', currentChapterIndex: 2, chapters: [{title:'一'}, {title:'二'}, {title:'三'}],
  totalChapters: 3, innerWidth: () => 328, tabHeight: () => 32, activeTabLineWidth: () => 38,
  onExit: () => close++, switchTab: tab => tab === 'directory' ? directory++ : bookmarks++,
  cancelProjectionTopScroll: () => {}, listScroller: { scrollEdge() {} } });
owner.panelHeader(); owner.directoryTab(); owner.bookmarkTab();
const allNodes = node => [...node.nodes.values(), ...[...(node.children?.values() ?? [])].flatMap(allNodes)];
const text = allNodes(owner).filter(node=>node.type==='Text');
assert.equal(text.find(node=>node.create==='目录').fontSize,readerTypographyRoles.TYPE_READER_DIRECTORY_HEADING.fontSizeFp);
const collapse=text.find(node=>node.create==='收起');assert.ok(collapse);
assert.equal(collapse.fontSize,readerTypographyRoles.TYPE_READER_DIRECTORY_COLLAPSE.fontSizeFp);assert.equal(collapse.lineHeight,readerTypographyRoles.TYPE_READER_DIRECTORY_COLLAPSE.lineHeightFp);
const nodes = allNodes(owner);
nodes.find(node=>node.accessibilityText==='收起目录').onClick();
nodes.find(node=>node.accessibilityText==='书签').onClick();
assert.equal(close,1); assert.equal(bookmarks,1);
// Content/keyboard/selection interaction probes are already covered by the
// production directory/bookmark suites; historical migration options are withdrawn.
console.log('PASS actual current directory header/tab role propagation and callbacks; design tuple validity is not asserted');

}
for(const id of selected){await runCase();recordContractCasePass(id);}
