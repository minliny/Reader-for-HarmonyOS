import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
const selected=selectContractCases({'panel-roles':{description:'Actual SDK current FullDirectory header/tab semantic typography and callbacks',resources:[]}});
async function runCase(){
const {default:assert}=await import('node:assert/strict');const {readFileSync}=await import('node:fs');
const {createReaderBuilderProbe}=await import('./lib/reader-control-builder-probe.mjs');
const {readerTypographyRoles}=await import('./lib/reader-typography-probe.mjs');
const source = readFileSync(new URL('../entry/src/main/ets/features/reading/FullDirectoryPanel.ets', import.meta.url), 'utf8');
const { owner } = createReaderBuilderProbe(source, ['panelHeader', 'directoryTab', 'bookmarkTab', 'statusFooter', 'currentTitle', 'currentPosition']);
let close = 0, directory = 0, bookmarks = 0;
Object.assign(owner, { appThemeScheme: 'day', activeTab: 'directory', currentChapterIndex: 2, chapters: [{title:'一'}, {title:'二'}, {title:'三'}],
  totalChapters: 3, innerWidth: () => 328, tabHeight: () => 32, activeTabLineWidth: () => 38,
  onExit: () => close++, switchTab: tab => tab === 'directory' ? directory++ : bookmarks++,
  cancelProjectionTopScroll: () => {}, listScroller: { scrollEdge() {} } });
owner.panelHeader(); owner.directoryTab(); owner.bookmarkTab();
const text = [...owner.nodes.values()].filter(node=>node.type==='Text');
assert.equal(text.find(node=>node.create==='目录').fontSize,readerTypographyRoles.TYPE_READER_DIRECTORY_HEADING.fontSizeFp);
const collapse=text.find(node=>node.create==='收起');assert.ok(collapse);
assert.equal(collapse.fontSize,readerTypographyRoles.TYPE_READER_DIRECTORY_COLLAPSE.fontSizeFp);assert.equal(collapse.lineHeight,readerTypographyRoles.TYPE_READER_DIRECTORY_COLLAPSE.lineHeightFp);
const nodes = [...owner.nodes.values()];
nodes.find(node=>node.accessibilityText==='收起目录').onClick();
nodes.find(node=>node.accessibilityText==='书签').onClick();
assert.equal(close,1); assert.equal(bookmarks,1);
// Content/keyboard/selection interaction probes are already covered by the
// production directory/bookmark suites; historical migration options are withdrawn.
console.log('PASS actual current directory header/tab role propagation and callbacks; design tuple validity is not asserted');

}
for(const id of selected){await runCase();recordContractCasePass(id);}
