import {selectContractCases, recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions = {"button": {"description": "实际管理按钮到当前producer公开输入", "resources": []}, "choice": {"description": "实际选择器到当前producer公开输入", "resources": []}, "icon": {"description": "实际漫画icon到当前producer公开输入", "resources": []}};
for (const id of selectContractCases(definitions)) {
  await runSelectedCase(id);
  recordContractCasePass(id);
}
async function runSelectedCase(selectedCase) {
const {default: assert} = await import('node:assert/strict');
const {readFileSync} = await import('node:fs');
const {verifySharedProducerInputCalls} = await import('./lib/shared-producer-inputs.mjs');

const pairs={button:['ReaderButton','features/bookshelf/BookshelfManagementPage.ets'],choice:['ReaderChoiceRow','features/common/ReaderSelectPanel.ets'],icon:['ReaderIconButton','features/manga/MangaReadingSurface.ets']};
const [component,consumerFile]=pairs[selectedCase],producerFile='features/common/'+component+'.ets';
const read=file=>readFileSync(new URL('../entry/src/main/ets/'+file,import.meta.url),'utf8'),source=read(consumerFile),producer=read(producerFile);
const options={component,producerFile,consumerFile};
const actual=verifySharedProducerInputCalls(producer,source,options);assert.ok(actual.length>0);
const bad=source.replace(component+'({',component+'({ __privateStyleBag: 99,');assert.notEqual(bad,source);
assert.throws(()=>verifySharedProducerInputCalls(producer,bad,options),/illegal shared input/,'actual consumer unknown Prop fails without comparing entire implementation bytes');
const removed=source.replaceAll(component+'({','RetiredUnregisteredControl({');assert.notEqual(removed,source);
assert.throws(()=>verifySharedProducerInputCalls(producer,removed,options),/edge missing/,'selected actual producer edge cannot disappear');

}
