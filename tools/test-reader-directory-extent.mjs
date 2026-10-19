import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
const selected=selectContractCases({lifecycle:{description:'Actual deferred fractional extent/data admission and two source-mutation negatives',resources:[]},'sdk-bindings':{description:'Actual SDK fixed/natural List extent, row height and content offsets',resources:[]}});
async function run(id){
const {default:assert}=await import('node:assert/strict');
const {readFileSync}=await import('node:fs');
const {stripTypeScriptTypes}=await import('node:module');
const {installedEtsCompiler}=await import('./lib/ets-compiler-runtime.mjs');
if(id==='lifecycle'){
const source = readFileSync(new URL(
  '../entry/src/main/ets/features/reading/ReaderDirectoryList.ets', import.meta.url), 'utf8');
const snapshotSource = readFileSync(new URL(
  '../entry/src/main/ets/features/reading/ReaderDirectoryDataSnapshot.ts', import.meta.url), 'utf8');
const { sameReaderDirectoryData, snapshotReaderDirectoryData } = await import(
  `data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(snapshotSource)).toString('base64')}`);

// Run the real lifecycle/watch methods with only the platform size container
// mocked. This checks propagation, not native virtual List measurement/reflow.
function loadList(text = source) {
  const {ts,options}=installedEtsCompiler();
  const tree=ts.createSourceFile('ReaderDirectoryList.ets',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,options);
  assert.deepEqual(tree.parseDiagnostics,[]);
  const list=tree.statements.find(n=>n.name?.text==='ReaderDirectoryList');
  const data=tree.statements.find(n=>n.name?.text==='DirectoryListDataSource');
  assert.ok(list&&data,'actual list and data source owners');
  const methods = `${data.getText(tree)}\nclass ReaderDirectoryList {${list.members.filter(n=>n.name?.getText(tree)!=='build').map(n=>n.getText(tree)).join('\n')}}` 
    .replace(/^import[\s\S]*?;\s*/gm, '')
    .replace(/@(?:Component|Prop|State|BuilderParam|Builder)\b\s*/g, '')
    .replace(/@Watch\('[^']+'\)\s*/g, '')
    .replace('export struct ReaderDirectoryList', 'class ReaderDirectoryList');
  class ChildrenMainSize {
    constructor(size) { this.childDefaultSize = size; }
  }
  const pending = [];
  const List = new Function('ChildrenMainSize', 'EdgeEffect', 'setTimeout',
    'sameReaderDirectoryData', 'snapshotReaderDirectoryData',
    `${stripTypeScriptTypes(methods)}\nreturn ReaderDirectoryList;`)(ChildrenMainSize, { None: 0 },
    callback => pending.push(callback), sameReaderDirectoryData, snapshotReaderDirectoryData);
  List.pending = pending;
  return List;
}

function flush(list) {
  while (list.constructor.pending.length > 0) list.constructor.pending.shift()();
}

function checkLifecycle(List) {
  const list = new List();
  const stableSizes = list.itemSizes;
  list.rowHeight = 32;
  list.aboutToAppear();
  assert.equal(list.itemSizes.childDefaultSize, 32, 'first Quick layout cannot keep the Full 40vp extent');
  flush(list);
  for (const height of [32.5, 34.072, 36, 39.999, 40, 37, 32]) {
    list.rowHeight = height;
    list.onRowHeightChanged();
    assert.equal(list.itemSizes, stableSizes, 'a morph updates the existing size container');
    assert.notEqual(list.itemSizes.childDefaultSize, height,
      'the @Watch callback must not mutate ChildrenMainSize during reconciliation');
    flush(list);
    assert.equal(list.itemSizes.childDefaultSize, height,
      'the deferred flush gives every virtual row the same fractional height as the materialized row');
  }
}

checkLifecycle(loadList());
{
  const list = new (loadList())();
  list.aboutToAppear();
  let reloads = 0;
  list.dataSource.registerDataChangeListener({ onDataReloaded() { reloads++; } });
  list.entries = [{ index: 0, title: '第一章', downloadState: 'unknown' }];
  list.onEntriesChanged();
  assert.equal(list.dataSource.totalCount(), 1, 'hidden empty mount admits later TOC');
  assert.equal(list.dataSource.getData(0).title, '第一章');
  assert.equal(reloads, 1);
  list.onEntriesChanged();
  assert.equal(reloads, 1, 'identical motion prop delivery cannot reload native rows');
  list.entries[0].title = '新章节标题';
  list.onEntriesChanged();
  assert.equal(reloads, 2, 'same-reference business edits notify native data source');
  list.deferEntriesDuringMotion = true;
  list.entries[0].title = '稳定端点才发布';
  list.onEntriesChanged();
  assert.equal(reloads, 2, 'motion frames do not compare or reload directory data');
  list.deferEntriesDuringMotion = false;
  list.onEntriesChanged();
  assert.equal(reloads, 3, 'the endpoint admits the same-reference edit');
  list.entries = [];
  list.onEntriesChanged();
  assert.equal(list.dataSource.totalCount(), 0, 'intentional empty filter is retained');
}

assert.throws(() => checkLifecycle(loadList(source.replace(
  'if (nextSize !== undefined && this.itemSizes.childDefaultSize !== nextSize) {\n        this.itemSizes.childDefaultSize = nextSize;\n      }',
  'this.itemSizes.childDefaultSize = 40;'))),
  'fixed Full extent regression is detected');
assert.throws(() => checkLifecycle(loadList(source.replace(
  'this.itemSizes.childDefaultSize = initialSize;', 'this.itemSizes.childDefaultSize = 40;'))),
  'missing initial Quick extent synchronization is detected');


}else{
 const {createReaderBuilderProbe}=await import('./lib/reader-control-builder-probe.mjs');
 const source=readFileSync(new URL('../entry/src/main/ets/features/reading/ReaderDirectoryList.ets',import.meta.url),'utf8');
 for(const natural of [false,true])for(const rowHeight of [32,34.072,40]){
  const entry={index:21,title:'章节'},lazy={create(_id,_owner,data,generate){assert.equal(data.totalCount(),1);generate(data.getData(0),0);},pop(){}};
  const owner=createReaderBuilderProbe(source,['build','rowBuilder','emptyBuilder','emptyContent'],{LazyForEach:lazy,makeBuilderParameterProxy:(_name,values)=>Object.fromEntries(Object.entries(values).map(([key,get])=>[key,get()])),BarState:{Auto:'auto',Off:'off'}}).owner;
  const itemSizes={childDefaultSize:rowHeight};const forwarded=[];
  Object.assign(owner,{naturalRowHeight:natural,entries:[entry],dataSource:{totalCount:()=>1,getData:()=>entry},rowHeight,itemSizes,
   listPaddingX:3,listPaddingRight:7,listPaddingTop:19,listPaddingBottom:23,listPaddingY:11,contentStartInset:5,contentEndInset:9,
   rowBuilder:arg=>forwarded.push(arg),emptyBuilder(){},onUserScrollIntent(){},probeGeometry(){}});
  owner.initialRender();const nodes=[...owner.nodes.values()],list=nodes.find(n=>n.type==='List'),items=nodes.filter(n=>n.type==='ListItem');
  assert.ok(list&&items.length===1);assert.equal(list.childrenMainSize,natural?undefined:itemSizes);assert.equal(items[0].height,natural?undefined:rowHeight);
  assert.deepEqual(list.padding,{left:3,right:7,top:natural?0:19,bottom:natural?0:23});
  assert.equal(list.contentStartOffset,natural?19:5);assert.equal(list.contentEndOffset,natural?23:9);
  assert.deepEqual(forwarded,[{item:entry,index:0}]);
 }
}
}
for(const id of selected){await run(id);recordContractCasePass(id);}
