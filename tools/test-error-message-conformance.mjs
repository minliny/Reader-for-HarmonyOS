import {selectContractCases, recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions = {"error-envelope-projection": {"description": "实际错误envelope/code/网络分类与敏感摘要", "resources": []}};
for (const id of selectContractCases(definitions)) {
  await runSelectedCase(id);
  recordContractCasePass(id);
}
async function runSelectedCase(selectedCase) {
const { ShelfBookPresentation } = await import('../entry/src/main/ets/features/bookshelf/ShelfBookPresentation.ts');
const {default: assert} = await import('node:assert/strict');
const { readFileSync, readdirSync, statSync } = await import('node:fs');
const { stripTypeScriptTypes } = await import('node:module');
const { dirname, join, resolve } = await import('node:path');
const { fileURLToPath } = await import('node:url');


const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative) => readFileSync(resolve(repo, relative), 'utf8');

// --- Load the real helper (pure module, no platform imports). --------------
const helperSource = read('entry/src/main/ets/app/ErrorMessage.ts');
const executable = stripTypeScriptTypes(helperSource);
const helperUrl = `data:text/javascript;base64,${Buffer.from(executable).toString('base64')}`;
const { errorMessageOf, localReadFailureSummary, catalogCurrentChapterRecoveryMessage, isDomainResolutionFailure, isNetworkEnvironmentFailure, httpResponseFailureSummary } = await import(helperUrl);

assert.equal(localReadFailureSummary({event:{error:{code:'INVALID_PARAMS',
  message:'source switch transaction state is stale', details:{field:'transaction_state',
  transactionId:'secret-user-transaction'}}}}),
  'code=INVALID_PARAMS category=none cause=source-switch-rollback-conflict field=transaction_state');
assert.equal(localReadFailureSummary(new Error('source switch storage failed: invalid storage snapshot field: sqlite: no such table: private_table')),
  'code=unknown category=none cause=source-switch-sqlite field=none');
assert.equal(localReadFailureSummary(new Error('failed to open Core SQLite database /private/user/books.sqlite: migration backup slots exhausted')),
  'code=unknown category=none cause=migration-backup-slots field=none');
assert.ok(!localReadFailureSummary({event:{error:{code:'INTERNAL',message:'book title secret',
  details:{category:'STORAGE_FAILURE',field:'private-book-title'}}}}).includes('secret'));

const catalogRecoveryCopy='目录更新无法对应当前章节，已保留原目录和阅读进度，可重试或换源';
for(const cause of ['previousChapterMissing','chapterIdentityMissingOrAmbiguous','cachedChapterCoordinateChanged','cachedCatalogCoordinatesChanged']) {
  const failure={code:'INVALID_PARAMS',message:'book.toc cannot safely restore the current chapter; previous catalog preserved',
    details:{reason:'CATALOG_CURRENT_CHAPTER_UNRESOLVED',cause,previousCatalogPreserved:true,recoverable:true}};
  for(const envelope of [failure,{error:failure},{event:{type:'error',requestId:5,error:failure}}]) {
    assert.equal(catalogCurrentChapterRecoveryMessage(envelope),catalogRecoveryCopy);
    assert.equal(errorMessageOf(envelope),catalogRecoveryCopy,'structured preserved-catalog recovery supersedes internal English copy');
  }
  for(const altered of [{...failure,code:'INTERNAL'},
    {...failure,details:{...failure.details,previousCatalogPreserved:false}},
    {...failure,details:{...failure.details,recoverable:false}},
    {...failure,details:{...failure.details,cause:'unrelatedCause'}},
    {...failure,details:{...failure.details,reason:'OTHER_INVALID_PARAMS'}}]) {
    assert.equal(catalogCurrentChapterRecoveryMessage(altered),undefined);
  }
}
assert.equal(catalogCurrentChapterRecoveryMessage({message:'CATALOG_CURRENT_CHAPTER_UNRESOLVED'}),undefined,
  'a marker in source text is not structured recovery evidence');

const responseDetails = { category: 'SOURCE_HTTP_FAILED', stage: 'chapter.content',
  cause: { phase: 'response', httpStatus: 403, requestHost: 'chapter.example',
    url: 'https://chapter.example/private?token=secret', headers: { Cookie: 'private' }, body: 'private body' } };
assert.equal(httpResponseFailureSummary({ event: { error: { details: responseDetails } } }),
  'stage=chapter.content host=chapter.example status=403');
assert.equal(httpResponseFailureSummary({ event: { error: { details: {
  ...responseDetails, stage: 'request.dispatch', outerStage: 'chapter.content',
} } } }), 'stage=chapter.content host=chapter.example status=403',
  'nested java.ajax failures keep Core outerStage without replacing transport evidence');
assert.equal(httpResponseFailureSummary({ details: { ...responseDetails, category: 'SOURCE_RULE_FAILED' } }), undefined);
assert.equal(httpResponseFailureSummary({ body: responseDetails }), undefined);
assert.equal(httpResponseFailureSummary({ details: { ...responseDetails, cause: { ...responseDetails.cause,
  requestHost: 'host/path?token=private' } } }), 'stage=chapter.content host=unknown status=403');

// --- Behavior vectors. ------------------------------------------------------
assert.equal(errorMessageOf(new Error('boom')), 'boom', 'Error keeps its message');
assert.equal(errorMessageOf('plain failure'), 'plain failure', 'string passes through');
assert.equal(errorMessageOf({ message: 'rpc: source dead' }), 'rpc: source dead',
  'object with message field keeps the field');
assert.equal(errorMessageOf({ code: 4005, detail: 'token expired' }),
  '{"code":4005,"detail":"token expired"}', 'message-less object serializes');
assert.equal(errorMessageOf({ status: 1, payload: 'x'.repeat(600) }).length, 500,
  'long JSON truncates to 500 chars');
assert.ok(errorMessageOf({ status: 1, payload: 'x'.repeat(600) }).endsWith('...'),
  'truncated JSON is marked');
assert.equal(errorMessageOf(null), 'null');
assert.equal(errorMessageOf(42), '42');
assert.equal(errorMessageOf(undefined), 'undefined');
const cyclic = {};
cyclic.self = cyclic;
assert.equal(errorMessageOf(cyclic), String(cyclic), 'cyclic object falls back to String()');
assert.equal(errorMessageOf({}), String({}), 'empty object falls back to String()');

for (const phase of ['dns','route','transport',undefined]) {
  const details={category:'NETWORK_ENVIRONMENT',...(phase===undefined?{}:{phase})};
  for (const failure of [{details},{event:{error:{details:{host:{diagnostics:{details}}}}}},
    {event:{error:{details:{category:'NETWORK_ENVIRONMENT',cause:details,
      host:{operationId:1,requestId:2,capability:'http.execute'}}}}}]) {
    assert.equal(isNetworkEnvironmentFailure(failure),true);
    assert.equal(isDomainResolutionFailure(failure),phase==='dns','only structured DNS may be isolated per domain');
  }
}
const causeCycle={};causeCycle.cause=causeCycle;
for (const failure of [{message:'NETWORK_ENVIRONMENT dns'},{body:{category:'NETWORK_ENVIRONMENT',phase:'dns'}},
  {details:{phase:'dns'}},{details:{category:'NETWORK_ENVIRONMENT',cause:{body:{category:'NETWORK_ENVIRONMENT',phase:'dns'}}}},
  cyclic,causeCycle]) assert.equal(isDomainResolutionFailure(failure),false);


}
