import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
registerHooks({resolve(s,c,n){try{return n(s,c);}catch(e){if(s.startsWith('.')&&!s.endsWith('.ts'))return n(s+'.ts',c);throw e;}}});
async function contract(){
const {
  assertRemoteReadingHostRequirements,
  classifyRemoteReadingCommandFailure,
  createRemoteReadingIdentity,
  decodeRemoteReadingVariables,
  encodeRemoteReadingVariables,
  mergeRemoteReadingVariables,
  RemoteReadingGatewayError,
  remoteReadingHostCapabilitySnapshot,
  isRemoteReadingCacheFallbackEligible,
}=await import('../entry/src/main/ets/features/reading/RemoteReadingContract.ts');

assert.deepEqual(createRemoteReadingIdentity('source-a', '/book/42'), {
  sourceId: 'source-a',
  bookId: '/book/42',
});
assert.throws(
  () => createRemoteReadingIdentity('local', 'book-42'),
  (error) => error instanceof RemoteReadingGatewayError && error.code === 'invalidInput',
  'the remote gateway must never absorb local-book identities',
);

const capabilityById = new Map(
  remoteReadingHostCapabilitySnapshot().map((fact) => [fact.id, fact]),
);
for (const capability of [
  'httpExecute',
  'responseCharsetDecoding',
  'platformCookieJar',
  'session',
  'nonUtf8RequestBody',
  'redirectFinalUrl',
]) {
  const fact = capabilityById.get(capability);
  assert.equal(fact?.status, 'attemptable', `${capability} must expose source-grounded availability`);
  assert.doesNotMatch(fact?.reason ?? '', /\b(?:VM|verified|journey)\b/i,
    `${capability} must not embed acceptance evidence in the runtime contract`);
}
assert.doesNotThrow(() => assertRemoteReadingHostRequirements(['httpExecute']));
assert.doesNotThrow(() => assertRemoteReadingHostRequirements([
  'platformCookieJar', 'session', 'nonUtf8RequestBody', 'redirectFinalUrl',
]));

assert.deepEqual(decodeRemoteReadingVariables(undefined, 'optional', true), []);
assert.deepEqual(decodeRemoteReadingVariables({ token: 'old', page: '1' }, 'detail'), [
  { name: 'page', value: '1' },
  { name: 'token', value: 'old' },
]);
assert.throws(
  () => decodeRemoteReadingVariables({ token: 42 }, 'detail'),
  (error) => error instanceof RemoteReadingGatewayError && error.code === 'invalidResponse',
);
const merged = mergeRemoteReadingVariables(
  [{ name: 'token', value: 'search' }, { name: 'book', value: '42' }],
  [{ name: 'token', value: 'chapter' }, { name: 'chapter', value: '7' }],
);
assert.deepEqual(merged, [
  { name: 'book', value: '42' },
  { name: 'chapter', value: '7' },
  { name: 'token', value: 'chapter' },
]);
assert.deepEqual(encodeRemoteReadingVariables(merged), {
  book: '42',
  chapter: '7',
  token: 'chapter',
});

for (const [message, capability] of [
  ['http.execute: usePlatformCookieJar is not supported by this Host', 'platformCookieJar'],
  ['http.execute: session is not supported by this Host', 'session'],
  ['http.execute: non-UTF-8 request charset is not supported: GBK', 'nonUtf8RequestBody'],
]) {
  const error = classifyRemoteReadingCommandFailure('chapter.content', new Error(message));
  assert.equal(error.code, 'unsupportedHostCapability');
  assert.equal(error.command, 'chapter.content');
  assert.equal(error.capability, capability);
}
const transportError = classifyRemoteReadingCommandFailure('book.toc', new Error('network down'));
assert.equal(transportError.code, 'commandFailed');
assert.equal(transportError.command, 'book.toc');
assert.equal(isRemoteReadingCacheFallbackEligible(transportError), true);
assert.equal(isRemoteReadingCacheFallbackEligible(new RemoteReadingGatewayError(
  'unsupportedHostCapability', 'host unavailable', 'book.toc')),
true);
for (const code of ['invalidInput', 'invalidResponse', 'identityMismatch', 'missingTocUrl', 'emptyToc']) {
  assert.equal(isRemoteReadingCacheFallbackEligible(new RemoteReadingGatewayError(
    code, code, 'book.toc')),
  false, `${code} must not be hidden behind stale cached detail data`);
}


}
async function rpcContract(){
 const {RemoteReadingFlowGateway}=await import('../entry/src/main/ets/features/reading/RemoteReadingFlowGateway.ts');
 const seed={sourceId:'s',bookId:'b',detailUrl:'https://remote.test/b',title:'书',author:'作者',searchVariables:[{name:'token',value:'search'},{name:'search',value:'kept'}]};
 function fixture(fault){const calls=[];return{calls,gateway:new RemoteReadingFlowGateway({async request(method,p){calls.push({method,p});
  if(method==='book.detail')return {data:{sourceId:fault==='detail-source'?'other':'s',sourceVersion:'v1',book:{bookId:fault==='detail-book'?'other':'b',title:'书',author:'作者'},tocUrl:'https://remote.test/toc',variables:{token:'detail'}}};
  if(method==='book.toc')return {data:{sourceId:'s',bookId:fault==='toc-book'?'other':'b',sourceVersion:'v1',toc:[{index:0,title:'章节',url:'https://remote.test/c',variables:{token:'chapter'}}]}};
  if(method==='chapter.content')return {data:{sourceId:'s',bookId:fault==='body-book'?'other':'b',chapterTitle:'章节',content:fault==='body-structured'?{}:'章节正文的故事内容。'.repeat(30),via:'rule'}};
  assert.fail('malformed responses must not request fallback IO: '+method);
 }})};}
 for(const fault of ['detail-source','detail-book','toc-book']){const f=fixture(fault);await assert.rejects(f.gateway.openSession(seed),e=>e.code==='identityMismatch');assert.ok(f.calls.every(c=>['book.detail','book.toc'].includes(c.method)));if(fault.startsWith('detail-'))assert.deepEqual(f.calls.map(c=>c.method),['book.detail']);}
 const ok=fixture();const session=await ok.gateway.openSession(seed);assert.deepEqual(ok.calls.map(c=>c.method),['book.detail','book.toc']);assert.equal(ok.calls[0].p.bookUrl,seed.detailUrl);assert.deepEqual(ok.calls[1].p.variables,{search:'kept',token:'detail'});
 await ok.gateway.loadChapter(session,0);assert.deepEqual(ok.calls.at(-1).p.variables,{search:'kept',token:'chapter'});
 for(const fault of ['body-book','body-structured']){const f=fixture(fault);await assert.rejects(f.gateway.loadChapter(session,0),e=>e.code===(fault==='body-book'?'identityMismatch':'nonTextChapter'));assert.deepEqual(f.calls.map(c=>c.method),['chapter.content']);}
}
const cases={contract,'rpc-contract':rpcContract};
for(const id of selectContractCases({contract:'Pure remote identity/variables/capability/error fallback contract','rpc-contract':'Actual Gateway rejects wrong identities/structured bodies and propagates continuation variables'})){await cases[id]();recordContractCasePass(id);}
