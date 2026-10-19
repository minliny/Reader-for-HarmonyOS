import {selectContractCases, recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions = {"import-feedback": {"description": "当前真实picker18vp busy与结果消息测量", "resources": []}};
for (const id of selectContractCases(definitions)) {
  await runSelectedCase(id);
  recordContractCasePass(id);
}
async function runSelectedCase(selectedCase) {
const {createHash} = await import('node:crypto');
const {boundedSurfaceSdk} = await import('./lib/bounded-surface-sdk-probe.mjs');
const {default: assert} = await import('node:assert/strict');
const {readFileSync,writeFileSync,existsSync} = await import('node:fs');
const {createReaderBuilderProbe} = await import('./lib/reader-control-builder-probe.mjs');

const root=new URL('../',import.meta.url);
const source=readFileSync(new URL('entry/src/main/ets/features/bookshelf/LocalImportDialog.ets',root),'utf8');
const {owner}=createReaderBuilderProbe(source,['resultSummary']);
Object.assign(owner,{appThemeScheme:'day',summaryIcon:()=> 'app.media.import_success',allSucceeded:()=>true,
  summaryTitle:()=> '导入完成',resultCountText:()=> '1本已在书架'});
owner.resultSummary();const records=[];
// The actual current file-picker action owns native 18vp busy feedback.
const sdk=boundedSurfaceSdk(),picker=sdk.consumer(source,['fileSelectionActions'],{}, {state:'pickerOpening',selectionEnabled:true});
Object.assign(picker,{state:'pickerOpening',selectionEnabled:true});picker.fileSelectionActions();const choose=sdk.walk(picker).find(actor=>actor instanceof sdk.deps.ReaderRecoveryAction&&actor.label==='选择文件');
assert.ok(choose);const pickerNodes=sdk.nodes(choose),loader=pickerNodes.find(node=>node.type==='LoadingProgress');
assert.deepEqual([loader.width,loader.height],[18,18]);assert.equal(pickerNodes.find(node=>node.type==='Text').opacity,0);
assert.equal(pickerNodes.find(node=>node.type==='Stack'&&node.onClick).enabled,false);
// The historical SVG remains provenance, but approved result feedback is now
// a plain, measured message count; its old decorative arc is not rendered.
for(const scheme of ['day','night','day']){
  owner.appThemeScheme=scheme;owner.replay();
  const nodes=[...owner.nodes.values()],n=nodes.find(n=>n.type==='Text'&&n.create==='1本已在书架');
  assert.ok(n,'the current result summary renders its real count');
  assert.deepEqual([n.fontSize,n.lineHeight,n.width],[13,21,'100%']);
  assert.equal(n.maxLines,undefined,'count remains available at large font scales');
  assert.equal(nodes.some(n=>n.type==='Image'),false,'decorative refresh image was removed from this message');
  assert.equal(typeof n.onAreaChange,'function','native summary measurement still feeds the bounded result geometry');
  records.push({scheme,text:n.create,fontSize:n.fontSize,lineHeight:n.lineHeight,decorativeImage:false});
}

}
