import { ShelfBookPresentation } from '../entry/src/main/ets/features/bookshelf/ShelfBookPresentation.ts';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative) => readFileSync(resolve(repo, relative), 'utf8');

// --- Load the real helper (pure module, no platform imports). --------------
const helperSource = read('entry/src/main/ets/app/ErrorMessage.ts');
const executable = stripTypeScriptTypes(helperSource);
const helperUrl = `data:text/javascript;base64,${Buffer.from(executable).toString('base64')}`;
const { errorMessageOf, isDomainResolutionFailure, isNetworkEnvironmentFailure, httpResponseFailureSummary } = await import(helperUrl);

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
  for (const failure of [{details},{event:{error:{details:{host:{diagnostics:{details}}}}}}]) {
    assert.equal(isNetworkEnvironmentFailure(failure),true);
    assert.equal(isDomainResolutionFailure(failure),phase==='dns','only structured DNS may be isolated per domain');
  }
}
for (const failure of [{message:'NETWORK_ENVIRONMENT dns'},{body:{category:'NETWORK_ENVIRONMENT',phase:'dns'}},
  {details:{phase:'dns'}},cyclic]) assert.equal(isDomainResolutionFailure(failure),false);

// --- Repo-wide sweep: the "[object Object]" flattening patterns are gone. ---
const etsRoot = resolve(repo, 'entry/src/main/ets');
const sourceFiles = [];
(function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full);
    } else if (/\.ets?$/.test(entry)) {
      sourceFiles.push(full);
    }
  }
})(etsRoot);
assert.ok(sourceFiles.length > 50, 'sweep found the Harmony sources');

const flatteningPatterns = [
  /instanceof Error \? error\.message : `\$\{error\}`/,
  /instanceof Error \? error\.message : String\(error\)/,
  /new Error\(`\$\{error\}`\)/,
];
let sweepBlocked = false;
for (const file of sourceFiles) {
  const source = readFileSync(file, 'utf8');
  // The helper's doc comment quotes the historical pattern verbatim; skip it.
  if (file.endsWith('ErrorMessage.ts')) {
    assert.ok(source.includes('export function errorMessageOf'), 'helper module intact');
    continue;
  }
  for (const pattern of flatteningPatterns) {
    if (pattern.test(source)) {
      console.error(`${file.replace(etsRoot + '/', '')} still flattens unknown throws (${pattern})`);
      sweepBlocked = true;
    }
  }
}
assert.ok(!sweepBlocked, 'no catch site flattens unknown throws to "[object Object]"');

// --- The search-chain fix site still routes through the helper. -------------
const httpHostSource = read('entry/src/main/ets/app/HttpExecuteHost.ts');
assert.ok(httpHostSource.includes('lastError = error instanceof Error ? error : new Error(errorMessageOf(error));'),
  'HttpExecuteHost retry loop keeps object messages');
assert.ok(httpHostSource.includes("import { errorMessageOf } from './ErrorMessage';"),
  'HttpExecuteHost imports the helper');

// --- Bookshelf progress: basis-point semantics, sub-1% state visible. -------
const bookshelfSource = read('entry/src/main/ets/features/bookshelf/BookshelfPage.ets');
assert.ok(bookshelfSource.includes('已读 <1%'), 'sub-1% progress renders as <1%');
assert.ok(bookshelfSource.includes('shelfProgressText(book.readProgress ?? 0)'),
  'grid labels retain their basis-point formatter');
assert.equal(ShelfBookPresentation.progress({ readProgress: 0 }), '未读',
  'shared ordinary and batch list projection keeps zero progress unread');
assert.equal(ShelfBookPresentation.progress({ readProgress: 1 }), '已读 <1%');
assert.equal(ShelfBookPresentation.progress({ readProgress: 8765 }), '已读 87%');

// --- Detail intro: HTML line breaks become real breaks, edges trimmed. ------
const detailSource = read('entry/src/main/ets/features/bookshelf/LocalBookDetail.ets');
assert.ok(detailSource.includes("Text(this.displayIntro().length > 0 ? this.displayIntro() : '暂无简介')"),
  'detail summary retains the intro cleaner and distinguishes absent metadata');
assert.ok(detailSource.includes('bookIntroText(this.book.intro)'),
  'detail uses the same display-only synopsis projection as search');

console.log(`error-message conformance: PASS (${sourceFiles.length} sources swept)`);
