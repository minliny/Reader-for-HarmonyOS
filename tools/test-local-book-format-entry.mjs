import {selectContractCases, recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions = {"format-admission": {"description": "实际格式registry准入与suffix filter集合", "resources": []}, "picker-binding": {"description": "实际Host picker filter消费/不合格式先于staging拒绝", "resources": []}};
for (const id of selectContractCases(definitions)) {
  await runSelectedCase(id);
  recordContractCasePass(id);
}
async function runSelectedCase(selectedCase) {


const {default: assert} = await import('node:assert/strict');
const {READER_LOCAL_BOOK_FORMAT_ADMISSIONS: admissions,READER_LOCAL_BOOK_PICKER_FILTER: filter,isReaderLocalBookFileName} = await import('../entry/src/main/ets/app/ReaderLocalBookFormatAdmission.ts');

if(selectedCase==='format-admission') {
assert.equal(new Set(admissions.map(a=>a.family)).size,admissions.length,'one family admission authority');
const pickerSuffixes=filter.split('|')[1].split(',');
assert.deepEqual(new Set(pickerSuffixes),new Set(admissions.filter(a=>a.state==='l0').flatMap(a=>a.suffixes)),'picker admits exactly current fully admitted family suffixes');
for(const admission of admissions)for(const suffix of admission.suffixes) {
 assert.equal(isReaderLocalBookFileName('任意书'+suffix),admission.state==='l0');
 assert.equal(isReaderLocalBookFileName('任意书'+suffix.toUpperCase()),admission.state==='l0');
 assert.equal(isReaderLocalBookFileName('任意书'+suffix+'.exe'),false,'substring suffix is not admission');
}
for(const name of ['', 'txt','book','https://server/book','book.zip'])assert.equal(isReaderLocalBookFileName(name),false);

}
if(selectedCase==='picker-binding') {
 const {selectedProductionMethods}=await import('./lib/selected-production-methods.mjs');const {localImportFailure}=await import('../entry/src/main/ets/app/LocalImportFailure.ts');let received;const staged=[];
 const picker={DocumentSelectOptions:class{},DocumentViewPicker:class{async select(options){received=options;return['file:///valid.TXT','file:///rejected.zip'];}}};
 const Host=selectedProductionMethods(new URL('../entry/src/main/ets/app/ReaderHostRegistry.ts',import.meta.url),'ReaderHostRegistry',['LocalBookSelectionLimit','LocalBookStagingConcurrency','selectLocalBookInputs'],{picker,READER_LOCAL_BOOK_PICKER_FILTER:filter,isReaderLocalBookFileName,errorMessageOf:error=>error.message,localImportFailure,LOG_DOMAIN:0,hilog:{error(){},warn(){}}});
 const host=Object.assign(new Host(),{context:{},ensureStageRecovery:async()=>{},requireSelectedFileName:uri=>uri.split('/').at(-1),stageLocalBook:async(uri,fileName)=>{staged.push(uri);return{uri,fileName};}});const result=await host.selectLocalBookInputs();
 assert.deepEqual(received.fileSuffixFilters,[filter],'actual picker receives current shared admission filter');assert.ok(Number.isSafeInteger(received.maxSelectNumber)&&received.maxSelectNumber>0);assert.deepEqual(staged,['file:///valid.TXT'],'provider ignored suffix filter cannot send unsupported data to staging');assert.deepEqual(result.map(x=>x.state),['ready','failed']);
}

}
