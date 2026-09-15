import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks, stripTypeScriptTypes } from 'node:module';
import { resolve } from 'node:path';
registerHooks({resolve(s,c,n){try{return n(s,c);}catch(e){if(s.startsWith('.')&&!s.endsWith('.ts'))return n(`${s}.ts`,c);throw e;}}});
const {bookAuthorLabel,bookAuthorIdentity,bookTitleAuthorKey}=await import('../entry/src/main/ets/features/common/BookAuthorMetadata.ts');
const {CachedBookIdentityResolver}=await import('../entry/src/main/ets/features/common/CachedBookIdentity.ts');
const {SearchResultProjection}=await import('../entry/src/main/ets/features/search/SearchResultProjection.ts');
const {SearchViewState}=await import('../entry/src/main/ets/features/search/SearchViewState.ts');
const {searchResultRelevance}=await import('../entry/src/main/ets/features/search/SearchResultRelevance.ts');
const read=name=>readFileSync(new URL(`../entry/src/main/ets/${name}`,import.meta.url),'utf8');
const clean=source=>source.replace(/^import[\s\S]*?;\n/gm,'');
const combined=['features/common/BookAuthorMetadata.ts','features/source/ReaderSourceCategory.ts','app/ErrorMessage.ts',
  'features/search/SearchBookProjection.ts','features/search/SearchGateway.ts','app/BookRequestScheduler.ts',
  'features/common/BookAcquisitionPresentation.ts','features/source/SourceSwitchGateway.ts'].map(n=>clean(read(n))).join('\n');
const {SearchGateway,SourceSwitchGateway}=await import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(combined)).toString('base64')}`);

// Core executes these same expectations against its actual SQLite alias key,
// including old-index migration. Keep both platform adapters on one corpus.
const coreRoot=process.env.READER_CORE_ROOT??new URL('../../Reader-Core-Native/',import.meta.url).pathname;
const fixture=JSON.parse(readFileSync(resolve(coreRoot,'fixtures/metadata/book-author-labels.json'),'utf8'));
assert.equal(fixture.version,1);
for(const row of fixture.cases){
  assert.equal(bookAuthorLabel(row.input),row.expected,row.id);
  assert.equal(bookAuthorIdentity(row.input),row.expected.trim().replace(/\s+/g,' ').toLowerCase(),row.id);
}

const rawAuthors=['关关公子','作者：关关公子',' 作 者 : 关关公子 ',
  '浅草茉莉','浅草茉莉\n进入作者主页 →','作者关关公子','关关公子（笔名）','','作者：'];
const source={sourceId:'s',name:'源',enabled:true,category:'novel',sourceVersion:'v1'};
const rawBooks=rawAuthors.map((author,i)=>({bookId:`/b${i}`,title:'鸣龙',author,variables:{rawAuthor:author}}));
const snapshot=JSON.stringify(rawBooks);
const result=await new SearchGateway({request:async()=>({data:{sourceId:'s',books:rawBooks}})}).searchBySource(source,'鸣龙');
assert.equal(result.ok,true);
assert.equal(JSON.stringify(rawBooks),snapshot);
for(let i=0;i<rawBooks.length;i++){
  assert.equal(result.results[i].author,rawAuthors[i],'metadata remains raw for rule and cache context');
  assert.deepEqual(result.results[i].variables,[{name:'rawAuthor',value:rawAuthors[i]}]);
  assert.equal(result.results[i].groupKey,bookTitleAuthorKey('鸣龙',rawAuthors[i]));
}
const grouped=new SearchResultProjection().update(result.results,[],'鸣龙',new SearchViewState());
assert.equal(grouped.rows.size,5,'only exact author label variants merge; real pen names and missing author stay separate');
assert.deepEqual([...grouped.rows.values()].map(row=>row.variants.length),[3,2,1,1,2]);
const prefixedOnly=[{...result.results[1],sourceId:'other'}];
const shelf=[{sourceId:'shelf-source',bookId:'shelf-book',title:'鸣龙',author:'关关公子'}];
assert.equal([...new SearchResultProjection().update(prefixedOnly,shelf,'鸣龙',new SearchViewState()).rows.values()][0].inBookshelf,true);
assert.equal(searchResultRelevance('鸣龙','作者：关关公子','关关公子'),1);
assert.equal(searchResultRelevance('鸣龙','浅草茉莉\n进入作者主页 →','浅草茉莉'),1);

const resolver=new CachedBookIdentityResolver();
const cached=rawBooks.map(book=>({origin:'s',bookUrl:book.bookId,name:book.title,author:book.author,variable:book.variables}));
const index=await resolver.build(cached,new Set(['s']));
assert.equal(index.groupFor('s','/b0'),index.groupFor('s','/b1'));
assert.equal(index.groupFor('s','/b3'),index.groupFor('s','/b4'));
for(const i of [3,5,6,7])assert.notEqual(index.groupFor('s','/b0'),index.groupFor('s',`/b${i}`));
assert.equal(JSON.stringify(rawBooks),snapshot);
const switchGateway=new SourceSwitchGateway({});
for(const author of ['关关公子','作者：关关公子','作 者 : 关关公子']){
  assert.equal(switchGateway.matchesCandidateBook({bookName:'鸣龙',author},{bookName:'鸣龙',author:'关关公子'}),true);
}
for(const author of ['浅草茉莉','作者关关公子','关关公子（笔名）','']){
  assert.equal(switchGateway.matchesCandidateBook({bookName:'鸣龙',author},{bookName:'鸣龙',author:'关关公子'}),false);
}
console.log(`author metadata: ${fixture.cases.length} shared Core/Host cases, actual search decode/group/shelf/alias/source-switch chains PASS`);
