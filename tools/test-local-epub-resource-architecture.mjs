import {selectContractCases, recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions = {"local-resource-host": {"description": "实际EPUB locator路径准入/单entry读取与取消", "resources": []}};
for (const id of selectContractCases(definitions)) {
  await runSelectedCase(id);
  recordContractCasePass(id);
}
async function runSelectedCase(selectedCase) {
const {default: assert} = await import('node:assert/strict');
const {selectedProductionMethods,selectedProductionValues} = await import('./lib/selected-production-methods.mjs');

const file=new URL('../entry/src/main/ets/app/LocalEpubResourceHost.ts',import.meta.url);
const values=selectedProductionValues(file,['LOCAL_EPUB_SCHEME','LOCAL_MOBI_SCHEME','MAX_READING_IMAGE_BYTES','MAX_LOCAL_IMAGE_BOOK_ID_BASE64_CHARS','MAX_LOCAL_IMAGE_PATH_BASE64_CHARS','MAX_LOCAL_IMAGE_LOCATOR_CHARS']);
const decoder={create:(_encoding,options)=>({decodeToString:bytes=>new TextDecoder('utf-8',options).decode(bytes)})};
const util={TextDecoder:decoder,Type:{BASIC_URL_SAFE:'url'},Base64Helper:class{decodeSync(value){return new Uint8Array(Buffer.from(value,'base64url'));}}};
let current=true;const reads=[],accesses=[];let accessCount=0;
const Owner=selectedProductionMethods(file,'LocalEpubResourceHost',['parseLocator','assertSafeArchivePath','assertCurrent','readResource','load'],{...values,util,
 fileIo:{access:async path=>{accesses.push(path);return ++accessCount!==1;}},readLocalEpubEntryAsync:async(...args)=>{reads.push(args);return new Uint8Array([1,2]);},
 ReadingBodyImageHost:{instance:{loadResource:async(_key,read,admitted)=>{assert.equal(admitted(),true);return read(()=>current);}}}});
const owner=Object.assign(new Owner(),{context:{filesDir:'/private-fixture'}}),hash='a'.repeat(64),encode=text=>Buffer.from(text).toString('base64url'),locator=path=>'reader-local-epub://'+encode('local:'+hash)+'/'+encode(path);
assert.deepEqual(owner.parseLocator(locator('images/a.png')),{hash,archivePath:'images/a.png'});
for(const path of ['../secret','images/../secret','./a','a//b','/root','a\\b','a\0b','']) assert.throws(()=>owner.parseLocator(locator(path)));
await owner.load(locator('images/a.png'),()=>current);assert.equal(reads.length,1);assert.equal(reads[0][0],'/private-fixture/reader-import/books/'+hash+'.epub');assert.equal(reads[0][1],'images/a.png');assert.equal(reads[0][2],values.MAX_READING_IMAGE_BYTES);
current=false;const before=reads.length;await assert.rejects(()=>owner.load(locator('images/a.png'),()=>current),/cancelled/);assert.equal(reads.length,before);

}
