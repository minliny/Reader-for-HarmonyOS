import {selectContractCases, recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions = {"finalize-ack-ownership": {"description": "实际Gateway三次finalize重试/lostACK资产归属/精确validator", "resources": []}, "cold-finalize-queue": {"description": "实际Host atomic queue→新Host→新RuntimeOwner恢复/故障", "resources": []}};
for (const id of selectContractCases(definitions)) {
  await runSelectedCase(id);
  recordContractCasePass(id);
}
async function runSelectedCase(selectedCase) {

if(selectedCase==='finalize-ack-ownership') {

const {default: assert} = await import('node:assert/strict');
const { readFileSync } = await import('node:fs');
const { stripTypeScriptTypes } = await import('node:module');
const { localImportFailure } = await import('../entry/src/main/ets/app/LocalImportFailure.ts');


const read = (relative) => readFileSync(new URL(`../${relative}`, import.meta.url), 'utf8');
const host = read('entry/src/main/ets/app/ReaderHostRegistry.ts');
const owner = read('entry/src/main/ets/app/ReaderRuntimeOwner.ts');
const gateway = read('entry/src/main/ets/features/bookshelf/LocalBookImportGateway.ts');

// Execute the real gateway method with a deterministic failing Core request.
// It must retry exactly three times, enqueue the same opaque token, and never
// interpolate token contents into a log argument.
function method(source, name) {
  const start = source.indexOf(`  private ${name}`);
  assert.ok(start >= 0, name);
  const end = source.indexOf('\n  private ', start + 1);
  return source.slice(start, end < 0 ? source.length : end);
}
const finalizeMethod = method(gateway, 'async finalizeCommittedImport(');
const logCalls = [];
const queued = [];
let attempts = 0;
const FinalizeProbe = new Function(
  'hilog',
  'DOMAIN',
  `${stripTypeScriptTypes(`class FinalizeProbe { ${finalizeMethod} }`)};return FinalizeProbe;`,
)({
  warn(...args) { logCalls.push(args); },
  error(...args) { logCalls.push(args); },
}, 0x5244);
const token = {
  kind: 'localBook',
  token: { transactionId: 'local-import-test', journal: { storedLocalBookJournal: 'opaque-ref' } },
};
const probe = new FinalizeProbe();
Object.assign(probe, {
  runtimeOwner: {
    async request() {
      attempts += 1;
      throw new Error('synthetic transport failure');
    },
    async enqueuePendingLocalImportFinalize(value) {
      queued.push(value);
    },
  },
});
assert.equal(await probe.finalizeCommittedImport(token), false);
assert.equal(attempts, 3);
assert.deepEqual(queued, [token]);
assert.equal(logCalls.some((args) => args.some((value) => String(value).includes('opaque-ref'))), false,
  'finalize recovery logs must not contain opaque token data');

// Execute the production queue envelope validators in isolation. This keeps
// the checks runnable on Node while using the exact source methods; Harmony's
// TextEncoder API returns a byte array from encodeInto(value), so the shim
// mirrors that API for the test.
function extractMethod(source, signature) {
  const start = source.indexOf(`  private ${signature}`);
  assert.ok(start >= 0, signature);
  const end = source.indexOf('\n  private ', start + 1);
  return source.slice(start, end < 0 ? source.length : end);
}
const validatorMethods = [
  extractMethod(host, 'decodePendingLocalImportFinalizeDocument(value: unknown)'),
  extractMethod(host, 'decodePendingLocalImportFinalizeToken(value: unknown)'),
  extractMethod(host, 'requirePendingFinalizeTransactionId(value: unknown)'),
  extractMethod(host, 'isJsonObject(value: unknown)'),
].join('\n');
const Validator = new Function(
  'util',
  `${stripTypeScriptTypes(`class ReaderHostRegistry {
    static PendingLocalImportFinalizeFormatVersion = 1;
    static PendingLocalImportFinalizeMaxEntries = 8;
    static PendingLocalImportFinalizeMaxTokenBytes = 256 * 1024;
    ${validatorMethods}
  }`)};return ReaderHostRegistry;`,
)({
  TextEncoder: class {
    encodeInto(value) { return new TextEncoder().encode(value); }
  },
});
const validator = new Validator();
const validToken = {
  kind: 'localBook',
  token: { transactionId: 'tx-1', journal: { storedLocalBookJournal: 'opaque' } },
};
assert.deepEqual(validator.decodePendingLocalImportFinalizeDocument({
  formatVersion: 1,
  entries: [{ transactionId: 'tx-1', rollbackToken: validToken }],
}), [{ transactionId: 'tx-1', rollbackToken: validToken }]);
assert.throws(() => validator.decodePendingLocalImportFinalizeToken({
  kind: 'bookSource',
  token: validToken.token,
}), /kind is invalid/);
assert.throws(() => validator.decodePendingLocalImportFinalizeDocument({
  formatVersion: 1,
  entries: [
    { transactionId: 'tx-1', rollbackToken: validToken },
    { transactionId: 'tx-1', rollbackToken: validToken },
  ],
}), /identity is invalid/);
assert.throws(() => validator.decodePendingLocalImportFinalizeToken({
  kind: 'localBook',
  token: { transactionId: 'tx-2', journal: { content: 'x'.repeat(300 * 1024) } },
}), /size limit/);

// A lost response after Core has already removed its journal must not leave a
// permanent retry loop. The production classifier accepts only the exact
// deterministic local-journal-unavailable error, never a generic validation
// failure.
const staleErrorMethod = method(owner, 'isAlreadyFinalizedLocalImportError(');
const OwnerProbe = new Function(
  `${stripTypeScriptTypes(`class OwnerProbe { ${staleErrorMethod} }`)};return OwnerProbe;`,
)();
const ownerProbe = new OwnerProbe();
assert.equal(ownerProbe.isAlreadyFinalizedLocalImportError({
  event: { error: { code: 'INVALID_PARAMS', message: 'import.finalize local book journal unavailable' } },
}), true);
assert.equal(ownerProbe.isAlreadyFinalizedLocalImportError({
  event: { error: { code: 'INVALID_PARAMS', message: 'import transactionId is invalid' } },
}), false);

// Exercise the complete production import transaction. An old same-identity
// shelf row is not proof that this metadata upsert committed after a timeout.
const importCode = stripTypeScriptTypes(gateway.replace(/^import[\s\S]*?;\n/gm, '').replace(/^export /gm, ''));
const coreCode=stripTypeScriptTypes(read('entry/src/main/ets/app/ReaderCoreGateway.ts').replace(/^import[\s\S]*?from ['"][^'"]+['"];\n/gm,'').replace(/^export /gm,''));
const ReaderCoreGateway=new Function('ReaderRuntimeOwner','isReaderCoreTransactionPendingError',coreCode+';return ReaderCoreGateway;')({},()=>false);
const ImportGateway = new Function('ReaderCoreGateway','ReaderRuntimeOwner', 'hilog', 'errorMessageOf', 'localImportFailure',
  `${importCode}\nreturn LocalBookImportGateway;`)(
  ReaderCoreGateway, {}, { warn() {}, error() {} }, error => error.message, localImportFailure);
const importBook = { bookId: 'same-bytes', title: '新书名', author: '新作者',
  coverUrl: 'cover', intro: '简介', kind: 'txt', lastChapter: '第二章' };
for (const scenario of ['normal', 'committed', 'sourceId', 'bookId', 'title', 'author', 'coverUrl', 'intro', 'kind', 'lastChapter']) {
  const calls = [];
  const owner = {
    async request(name, params) {
      calls.push(name);
      if (name === 'import.parse') return { data: { preview: {
        summary: { integrity: { schemaVersion: 1, readability: 'complete' } },
      } } };
      if (name === 'import.persist') return { data: { rollbackToken: token,
        persisted: { kind: 'localBook', data: { book: importBook } } } };
      if (name === 'bookshelf.add') {
        assert.deepEqual(params, { sourceId: 'local', ...importBook });
        if (scenario === 'normal') return { data: { sourceId:'local',bookId:importBook.bookId,created: false,addedAt:1 } };
        throw Error('lost add response');
      }
      if (name === 'bookshelf.get') {
        const shelf = { sourceId: 'local', ...importBook };
        if (scenario !== 'committed') shelf[scenario] = 'previous value';
        return { data: { book: shelf } };
      }
      if (name === 'import.finalize') return { data: {} };
      assert.fail(`ambiguous upsert must preserve Core journal: ${name}`);
    },
    async commitLocalBookInput() { calls.push('assets.commit'); return { created: false }; },
    async rollbackLocalBookAsset() { assert.fail('possible durable shelf reference must preserve assets'); },
  };
  const result = await new ImportGateway(owner).importPreparedSelections([
    { state: 'ready', input: { bookId: importBook.bookId, fileName: '新书名.txt', stagedPath: '/private/input' } },
  ]);
  if (scenario === 'normal') {
    assert.equal(result.imported, 1); assert.equal(result.failed, 0);
    assert.equal(calls.at(-1), 'import.finalize');
    assert.equal(calls.filter(name => name === 'bookshelf.get').length, 0);
  } else {
    assert.equal(result.failed, 1); assert.equal(result.items[0].failure.code, 'recoveryPending');
    assert.ok(!calls.includes('import.finalize'));
  }
  assert.ok(!calls.some(name => name.includes('progress') || name.includes('chapter.content')),
    'import membership has no reader page preparation or progress side effects');
}

console.log('local import finalize recovery queue and ACK-only confirmation: PASS (identical/old/mismatched reads cannot prove missing ACK)');

}
if(selectedCase==='cold-finalize-queue') {
 const {default:assert}=await import('node:assert/strict');
 const {selectedProductionMethods,selectedProductionValues}=await import('./lib/selected-production-methods.mjs');
 const disk=new Map(),positions=new Map();let nextFd=0,failWrite=false;const commits=[],rollbacks=[];
 const fileIo={OpenMode:{READ_ONLY:1},access:async path=>disk.has(path),mkdir:async path=>disk.set(path,new Uint8Array()),stat:async path=>({size:disk.get(path)?.length??0}),open:async path=>{const fd=++nextFd;positions.set(fd,{path,offset:0});return{fd};},close:async file=>positions.delete(file.fd),read:async(fd,target,options)=>{const p=positions.get(fd),bytes=disk.get(p.path),n=Math.min(options?.length??target.byteLength,bytes.length-p.offset);new Uint8Array(target).set(bytes.subarray(p.offset,p.offset+n));p.offset+=n;return n;},AtomicFile:class {constructor(path){this.path=path;}startWrite(){const self=this;return this.stream={bytesWritten:0,on(){},end(payload,_encoding,done){self.pending=new TextEncoder().encode(payload);this.bytesWritten=self.pending.length-(failWrite?1:0);done();}};}finishWrite(){disk.set(this.path,this.pending);commits.push(this.path);}failWrite(){rollbacks.push(this.path);}}};
 const util={TextEncoder:class{encodeInto(value){return new TextEncoder().encode(value);}},TextDecoder:{create:()=>({decodeToString:bytes=>new TextDecoder('utf-8',{fatal:true}).decode(bytes)})}};
 const Host=selectedProductionMethods(new URL('../entry/src/main/ets/app/ReaderHostRegistry.ts',import.meta.url),'ReaderHostRegistry',[
 'PendingLocalImportFinalizeFormatVersion','PendingLocalImportFinalizeMaxEntries','PendingLocalImportFinalizeMaxTokenBytes','PendingLocalImportFinalizeMaxFileBytes','JsonDocumentReadChunkBytes','pendingFinalizeWriteTail',
 'enqueuePendingLocalImportFinalize','readPendingLocalImportFinalizes','removePendingLocalImportFinalize','pendingLocalImportFinalizeDirectory','pendingLocalImportFinalizePath','readPendingLocalImportFinalizesUnsafe','decodePendingLocalImportFinalizeDocument','decodePendingLocalImportFinalizeToken','requirePendingFinalizeTransactionId','isJsonObject','writePendingLocalImportFinalizesUnsafe','withPendingFinalizeWrite','ensureDirectory','readBoundedUtf8Document'],{fileIo,util,errorMessageOf:error=>error.message});
 const mount=()=>Object.assign(new Host(),{context:{filesDir:'/fake/private'}});const token=id=>({kind:'localBook',token:{transactionId:id,journal:{opaque:'not-logged'}}});
 let first=mount();await Promise.all([first.enqueuePendingLocalImportFinalize(token('one')),first.enqueuePendingLocalImportFinalize(token('two'))]);
 assert.deepEqual((await mount().readPendingLocalImportFinalizes()).map(x=>x.transactionId),['one','two'],'a new Host reads actual atomic queue bytes, not old owner memory');
 await first.enqueuePendingLocalImportFinalize(token('one'));assert.equal((await mount().readPendingLocalImportFinalizes()).length,2,'same identity replaces rather than duplicates');
 const oldBytes=disk.get(first.pendingLocalImportFinalizePath());failWrite=true;await assert.rejects(first.enqueuePendingLocalImportFinalize(token('three')),/incomplete/);failWrite=false;
 assert.equal(disk.get(first.pendingLocalImportFinalizePath()),oldBytes,'failed atomic write preserves committed bytes');assert.equal(rollbacks.length,1);
 const {PENDING_LOCAL_IMPORT_FINALIZE_TIMEOUT_MS}=selectedProductionValues(new URL('../entry/src/main/ets/app/ReaderRuntimeOwner.ts',import.meta.url),['PENDING_LOCAL_IMPORT_FINALIZE_TIMEOUT_MS']);
 const logs=[];const Owner=selectedProductionMethods(new URL('../entry/src/main/ets/app/ReaderRuntimeOwner.ts',import.meta.url),'ReaderRuntimeOwner',['recoverPendingLocalImportFinalizes','isAlreadyFinalizedLocalImportError'],{PENDING_LOCAL_IMPORT_FINALIZE_TIMEOUT_MS,LOG_DOMAIN:0,hilog:{error:(...args)=>logs.push(args),info:(...args)=>logs.push(args)}});
 let response='timeout';const runtime={request:async(name,params)=>{assert.equal(name,'import.finalize');assert.ok(params.rollbackToken.token.journal);if(response==='timeout')throw Error('transport');if(response==='already')throw{event:{error:{code:'INVALID_PARAMS',message:'local book journal unavailable'}}};return{data:{kind:'localBook',data:{finalized:response==='ack'}}};}};
 const recovering=Object.assign(new Owner(),{state:'ready',host:mount()});await recovering.recoverPendingLocalImportFinalizes(runtime);assert.equal((await mount().readPendingLocalImportFinalizes()).length,2,'timeout leaves queue durable');
 response='invalid';await recovering.recoverPendingLocalImportFinalizes(runtime);assert.equal((await mount().readPendingLocalImportFinalizes()).length,2,'non-ack cannot remove intent');
 response='ack';failWrite=true;await recovering.recoverPendingLocalImportFinalizes(runtime);failWrite=false;assert.equal((await mount().readPendingLocalImportFinalizes()).length,2,'Core ACK with failed removal stays durable');
 response='already';await Object.assign(new Owner(),{state:'ready',host:mount()}).recoverPendingLocalImportFinalizes(runtime);assert.deepEqual(await mount().readPendingLocalImportFinalizes(),[],'new owner safely drains deterministic already-finalized reply');
 assert.ok(logs.every(args=>args.every(arg=>!String(arg).includes('not-logged'))),'opaque journal never enters logs');
 await first.enqueuePendingLocalImportFinalize(token('closed'));await Object.assign(new Owner(),{state:'closing',host:mount()}).recoverPendingLocalImportFinalizes(runtime);assert.equal((await mount().readPendingLocalImportFinalizes()).length,1,'retired owner leaves undispatched work');
}

}
