import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripTypeScriptTypes } from 'node:module';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fixture = JSON.parse(readFileSync(resolve(repo, '../Reader-UI/contracts/fixtures/manga-pages-extract.json'), 'utf8'));
assert.deepEqual(fixture, JSON.parse(readFileSync(resolve(repo,
  '../Reader-Core-Native/crates/reader-contract/fixtures/manga-pages-extract.json'), 'utf8')));
const source = readFileSync(resolve(repo, 'entry/src/main/ets/features/manga/MangaResourceGateway.ts'), 'utf8');
const executable = stripTypeScriptTypes(source.replace(/^import[\s\S]*?;\n/gm, '').replace(/^export /gm, ''));
const Gateway = new Function(`${executable}\nreturn MangaResourceGateway;`)();
const manifest = { chapter: {sourceId:fixture.sourceId,bookId:fixture.bookId,chapterId:'https://books.example.test/chapter/1'},
  sourceRuleVersion:'source-version-1',manifestVersion:'manifest-1',decodeRevision:'identity-v1',pages:fixture.pages };
const scope = { sourceId: fixture.sourceId, bookId: fixture.bookId, chapterIndex: 2,
  sourceRuleVersion: manifest.sourceRuleVersion, decodeRevision: manifest.decodeRevision,
  contentVersion: 'manifest-1', chapterUrl: 'https://books.example.test/chapter/1' };
const image = { fileUri: 'file://owned-image', width: 900, height: 1200, revision: 'pixels-1' };
const calls = [], released = [];
let current = true;
let load = async (...args) => { calls.push(args); return image; };
const gateway = new Gateway({ loadReadingImage: (...args) => load(...args),
  releaseReadingImage: (...args) => released.push(args) });
const valid = () => current;
assert.equal(await gateway.loadPage(scope, fixture.pages[0], true, valid), image);
assert.equal(calls[0][4], fixture.pages[0].requestRule);
assert.equal(calls[0][3], 'manifest-1');
assert.equal(calls[0][5], scope.chapterUrl);
assert.equal(calls[0][10], scope.sourceRuleVersion);
assert.equal(calls[0][12], manifest.decodeRevision, 'the cache receives the manifest decode fact');
for(const revision of [undefined,'','unknown-profile']) await assert.rejects(
  gateway.loadPage({...scope,decodeRevision:revision},fixture.pages[0],true,valid),/MANGA_CACHE_PROFILE_REQUIRED/);
assert.equal(calls.length,1,'missing or unknown decode fact cannot reach image I/O');
await assert.rejects(gateway.loadPage({ ...scope, sourceRuleVersion: '' }, fixture.pages[1], true, valid), /IDENTITY_INVALID/);
assert.equal(calls[0][7], valid);
await gateway.loadPage(scope, fixture.pages[1], false, valid);
assert.equal(calls[1][6], false, 'offline read must not authorize network');
await gateway.loadPage(scope, fixture.pages[2], false, valid);
assert.equal(calls.length, 3, 'repeated logical pages are not dropped');
await assert.rejects(gateway.loadPage({ ...scope, contentVersion: '' }, fixture.pages[1], true, valid), /IDENTITY_INVALID/);
await assert.rejects(gateway.loadPage(scope, { url: fixture.pages[0].url, headers: fixture.pages[0].headers }, true, valid), /RULE_REQUIRED/);
assert.equal(calls.length, 3, 'invalid descriptors never begin I\/O');
current = false;
await assert.rejects(gateway.loadPage(scope, fixture.pages[1], true, valid), /CANCELLED/);
assert.equal(calls.length, 3);
current = true;
load = async () => { current = false; return image; };
await assert.rejects(gateway.loadPage(scope, fixture.pages[1], true, valid), /CANCELLED/);
assert.deepEqual(released, [['file://owned-image', undefined]], 'late display lease must be released');
current = true;
load = async () => ({ ...image, width: NaN });
await assert.rejects(gateway.loadPage(scope, fixture.pages[1], true, valid), /INVALID_IMAGE/);
assert.equal(released.length, 2);
const failure = new Error('source HTTP 403');
load = async () => { throw failure; };
await assert.rejects(gateway.loadPage(scope, fixture.pages[1], true, valid), error => error === failure);
console.log('PASS manga resource gateway: contract parity, request semantics, offline, duplicate pages, identity, cancellation, lease release, invalid image and error propagation');

const profiledCalls=[];const profiled=new Gateway({loadReadingImage:async(...args)=>{profiledCalls.push(args);return image;},releaseReadingImage(){},prefetchReadingImage:async identity=>{profiledCalls.push(identity);}});
for(const decodeRevision of ['identity-v1','bytes-v1']){const currentScope={...scope,decodeRevision};await profiled.loadPage(currentScope,fixture.pages[0],false,()=>true);assert.equal(profiledCalls.at(-1)[12],decodeRevision);await profiled.prefetchPage(currentScope,{...fixture.pages[0],resourceRef:'manga:mp1:'+ 'a'.repeat(64)},()=>true);assert.equal(profiledCalls.at(-1).mangaDecodeRevision,decodeRevision);}
console.log('PASS manifest decode revision reaches foreground/cache-only and adjacent prefetch; missing and unknown revisions reject before I/O');
