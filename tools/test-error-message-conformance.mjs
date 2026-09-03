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
const { errorMessageOf } = await import(helperUrl);

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
  'grid and list labels share the basis-point formatter');
assert.ok(bookshelfSource.includes("return '未读';"),
  'list keeps the unread label for zero progress');

// --- Detail intro: HTML line breaks become real breaks, edges trimmed. ------
const detailSource = read('entry/src/main/ets/features/bookshelf/LocalBookDetail.ets');
assert.ok(detailSource.includes("Text(this.displayIntro())"),
  'detail summary renders through the intro cleaner');
assert.ok(detailSource.includes("replace(/<br"), 'intro cleaner matches <br> variants');
assert.ok(detailSource.includes(".replace(/^\\n+|\\n+$/g, '')"),
  'intro cleaner trims leading/trailing breaks');

console.log(`error-message conformance: PASS (${sourceFiles.length} sources swept)`);
