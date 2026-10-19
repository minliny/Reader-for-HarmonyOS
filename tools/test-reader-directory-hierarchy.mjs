import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions={
 'model':{description:'Hierarchy normalization/bounded indent/accessibility and preserved Core depth',resources:[]},
 'chapter-row':{description:'Actual SDK shared chapter row consumes indent/depth and navigability admission',resources:[]}
};
const selected=selectContractCases(definitions);
async function runCase(selectedCase){
const {default:assert}=await import('node:assert/strict');
const { readFileSync }=await import('node:fs');
const { readerDirectoryAccessibilityText, readerDirectoryIndentVp, readerDirectoryLevel }=await import('../entry/src/main/ets/features/reading/ReaderDirectoryHierarchy.ts');
const { readerControlDirectorySnapshot }=await import('../entry/src/main/ets/features/reading/ReaderControlDirectoryModel.ts');

if(selectedCase==='model'){
const chapter = { index: 4, title: '一节', downloadState: 'unknown', navigable: true };
assert.equal(readerDirectoryLevel(chapter), 1);
assert.equal(readerDirectoryIndentVp(chapter), 0);
assert.equal(readerDirectoryAccessibilityText(chapter), '打开章节：一节',
  'TXT and remote entries without Core depth retain their old label');
for (const level of [0, -2, 1.5, NaN, Infinity]) {
  assert.equal(readerDirectoryLevel({ ...chapter, level }), 1);
}
assert.equal(readerDirectoryIndentVp({ ...chapter, level: 2 }), 12);
assert.equal(readerDirectoryIndentVp({ ...chapter, level: 4 }), 36);
assert.equal(readerDirectoryIndentVp({ ...chapter, level: 20 }), 36);
assert.equal(readerDirectoryAccessibilityText({ ...chapter, level: 20, navigable: false }),
  '第20级，卷标题：一节', 'visual indentation is bounded but accessibility retains source depth');

const entries = [{ ...chapter, index: 0, title: '卷', level: 1, navigable: false },
  { ...chapter, index: 1, title: '章', level: 2 },
  { ...chapter, index: 2, title: '节', level: 3 }];
const snapshot = readerControlDirectorySnapshot(entries, 'directory', '', true, 2);
assert.deepEqual(snapshot.rows.map(row => row.chapter?.level), [1, 2, 3],
  'control directory keeps Core depth through its projection');

return;
}
const {createReaderBuilderProbe}=await import('./lib/reader-control-builder-probe.mjs');
const source=readFileSync(new URL('../entry/src/main/ets/features/reading/ReaderDirectoryChapterRow.ets',import.meta.url),'utf8');
for(const [level,navigable] of [[1,true],[2,true],[20,true],[3,false]]){
 const {owner}=createReaderBuilderProbe(source,['build'],{readerDirectoryIndentVp,readerDirectoryAccessibilityText});
 const entry={index:4,title:'一节',level,navigable,downloadState:'unknown'},selected=[];
 Object.assign(owner,{entry,rowHeight:40,currentChapterIndex:-1,chapterDownloadEnabled:false,onSelectChapter:index=>selected.push(index)});
 owner.initialRender();const title=[...owner.nodes.values()].find(n=>n.type==='Text'&&n.create===entry.title);
 assert.equal(title.padding.left,9+readerDirectoryIndentVp(entry));
 const action=[...owner.nodes.values()].find(n=>n.accessibilityText===readerDirectoryAccessibilityText(entry));assert.ok(action);assert.equal(action.enabled,navigable);
 action.onClick();assert.deepEqual(selected,navigable?[4]:[]);
}
}
for(const id of selected){await runCase(id);recordContractCasePass(id);}
