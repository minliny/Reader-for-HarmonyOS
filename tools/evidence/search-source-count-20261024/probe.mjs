// Explicit issue-local comparison. No Core, live network, build or device I/O.
import assert from 'node:assert/strict';
import { registerHooks, stripTypeScriptTypes } from 'node:module';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const phase = process.argv[2];
assert.ok(phase === 'before' || phase === 'after', 'select before or after explicitly');
const root = fileURLToPath(new URL('../../../', import.meta.url));
const currentUrl = new URL('../../../entry/src/main/ets/features/search/SearchResultProjection.ts', import.meta.url).href;
const historicalRef = 'a7ecc652b64362687eeab385ac8afdca05a4f3b5^';
const historicalSource = execFileSync('git', ['show', `${historicalRef}:entry/src/main/ets/features/search/SearchResultProjection.ts`], {cwd: root, encoding: 'utf8'});
registerHooks({
  resolve(s, c, next) { try { return next(s, c); } catch(error) {
    if(error.code === 'ERR_MODULE_NOT_FOUND' && s.startsWith('.') && !/\.[a-z]+$/.test(s)) return next(s + '.ts', c);
    throw error;
  } },
  load(url, context, next) {
    if(url === currentUrl + '?historical') return {format:'module',source:stripTypeScriptTypes(historicalSource),shortCircuit:true};
    return next(url,context);
  },
});
const {SearchResultProjection: Current} = await import(currentUrl);
const {SearchResultProjection: Historical} = await import(currentUrl + '?historical');
const {SearchViewState} = await import('../../../entry/src/main/ets/features/search/SearchViewState.ts');
const now = Date.now();
const keyword = '还不起学贷的我只好兼职猎魔';
const books = Array.from({length:7},(_,i)=>({sourceId:`source-${i}`,sourceName:`source-${i}`,
  bookSourceUrl:`https://source-${i}.invalid`,bookId:'/same-book-id',detailUrl:'/same-book-id',
  searchRequestId:'one-query',sourceRuleVersion:'rules-1',category:'novel',title:keyword,author:'小夕岁',variables:[],admittedOrder:i}));
const failed = (row, stage='catalog', category='SOURCE_TOC_EMPTY', at=now, version='rules-1')=>({...row,acquisition:{
  schemaVersion:2,sourceVersion:version,failureCurrent:true,failureConfirmed:true,
  failure:{schemaVersion:2,stage:'failed',sourceVersion:version,failureStage:stage,checkedAt:at,failureCategory:category},
}});
function observe(Type, input) {
  const navigation = new SearchViewState();navigation.reset(keyword);
  const update = new Type().update(input,[],keyword,navigation);
  assert.equal(update.rows.size,1,'seven same-title/author sources remain one work');
  const group = [...update.rows.values()][0];
  return {sourceCount:group.sourceIds.length,variantCount:group.variants.length,
    ids:group.variants.map(row=>row.sourceId),representative:group.book.sourceId,
    preservedFailures:group.variants.filter(row=>row.acquisition?.failureCurrent === true).length};
}
const confirmed = books.map((row,i)=>i<4?failed(row):row);
const rows = [];
for(const [name,input,expected] of [
  ['plain-seven',books,7],
  ['confirmed-catalog-failures',confirmed,phase==='before'?3:7],
  ['chapter-failures',books.map((row,i)=>i<4?failed(row,'content','SOURCE_CONTENT_EMPTY'):row),7],
  ['transport-attempts',books.map((row,i)=>i<4?failed(row,'catalog','SOURCE_HTTP_FAILED'):row),7],
  ['old-failure-evidence',books.map((row,i)=>i<4?failed(row,'catalog','SOURCE_TOC_EMPTY',now-25*60*60*1000):row),7],
  ['changed-source-version',books.map((row,i)=>i<4?failed(row,'catalog','SOURCE_TOC_EMPTY',now,'old-rules'):row),7],
  ['same-identity-duplicates',[...books,...books],7],
]) {
  const historical=observe(Historical,input),current=observe(Current,input);
  assert.equal(historical.sourceCount,7,`${name}: the exact historical projection retains distinct discovered sources`);
  assert.equal(current.sourceCount,expected,`${name}: expected current source count`);
  assert.equal(current.variantCount,expected);
  if(name==='confirmed-catalog-failures') {
    assert.equal(current.representative,'source-4','confirmed failed sources never become the representative over a nonfailed source');
    if(phase==='after') assert.equal(current.preservedFailures,4,'failure state remains available on all four exact variants');
  }
  rows.push({scenario:name,historical,current});
}
const hash=s=>createHash('sha256').update(s).digest('hex');
console.log(JSON.stringify({status:'PASS',phase,historicalRef,historicalSourceSHA256:hash(historicalSource),
 currentSourceSHA256:hash(readFileSync(fileURLToPath(currentUrl))),evidence:'actual production projection with controlled same-query facts; historical dependencies use current shared pure modules',rows},null,2));
