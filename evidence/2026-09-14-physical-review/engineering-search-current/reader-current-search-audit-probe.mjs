import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = '/Users/minliny/Documents/Reader/Reader-for-HarmonyOS';
const read = (rel) => readFileSync(resolve(repo, rel), 'utf8');

// SearchOrchestrator imports SearchGateway by value and ReaderRuntimeOwner /
// hilog from Harmony-only modules. Strip the runtime imports, concatenate the
// two sources into one module, and stub hilog globally so the real orchestrator
// (including its bounded-concurrency loop) runs on plain Node. The error
// message helper is inlined once because data-URL loads cannot resolve
// relative specifiers like '../../app/ErrorMessage'.
const errorMessageModule = stripTypeScriptTypes(read('entry/src/main/ets/app/ErrorMessage.ts'))
  .replace('export function errorMessageOf', 'function errorMessageOf');
const errorMessageImport =
  /^import \{ errorMessageOf \} from ['"][^'"]*ErrorMessage(\.ts)?['"];\n/m;
const sourceCategoryModule = stripTypeScriptTypes(
  read('entry/src/main/ets/features/source/ReaderSourceCategory.ts'),
).replace(/^export /gm, '');
const sourceCategoryImport =
  /^import \{\n(?:  [^\n]+\n)+\} from ['"][^'"]*ReaderSourceCategory['"];\n/m;
const sourceCategorySingleImport =
  /^import \{ readerSourceCategoryIsText \} from ['"][^'"]*ReaderSourceCategory['"];\n/m;
const gatewaySource = read('entry/src/main/ets/features/search/SearchGateway.ts')
  .replace(/^import \{ CachedBookIdentityResolver \} from .*;$/m, () =>
    read('entry/src/main/ets/features/common/CachedBookIdentity.ts').replace(/^import type .*;$/m, ''))
  .replace(errorMessageImport, '')
  .replace(sourceCategoryImport, '')
  .replace(/^import \{ ReaderRuntimeOwner \} from ['"][^'"]*ReaderRuntimeOwner['"];\n/m, '');
const orchestratorSource = read('entry/src/main/ets/features/search/SearchOrchestrator.ets')
  .replace(/^import \{[\s\S]*?from '\.\/SearchGateway';\n/m, '')
  .replace(errorMessageImport, '')
  .replace(sourceCategorySingleImport, '')
  .replace(/^import \{ ReaderRuntimeOwner \} from ['"][^'"]*ReaderRuntimeOwner['"];\n/m, '')
  .replace(/^import \{ hilog \} from ['"]@kit\.PerformanceAnalysisKit['"];\n/m, '');
const combined = stripTypeScriptTypes(
  `${sourceCategoryModule}\n${errorMessageModule}\n${gatewaySource}\n${orchestratorSource}`,
);
const moduleUrl = `data:text/javascript;base64,${Buffer.from(combined).toString('base64')}`;

globalThis.hilog = {
  warn() {}, error() {}, info() {}, debug() {}, fatal() {},
};

const { SearchOrchestrator, SearchGateway } = await import(moduleUrl);


const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const source={sourceId:'s',name:'源',enabled:true,category:'novel',sourceVersion:'v'};
const local={sourceId:'local',bookId:'local-book',title:'目标',author:'作者'};
const remote={bookId:'/remote',title:'目标',author:'作者'};
for(const blocked of ['bookshelf.list','source.list']){
  let release; const gate=new Promise(r=>release=r);const calls=[];const published=[];
  const owner={request:async(method)=>{calls.push(method);if(method===blocked)await gate;
    if(method==='source.list')return{data:{sources:[source]}};
    if(method==='bookshelf.list')return{data:{books:[local]}};
    if(method==='search.history.list')return{data:{keywords:[],count:0}};
    if(method==='search.history.add')return{data:{}};
    if(method==='book.search')return{data:{sourceId:'s',sourceVersion:'v',books:[remote]}};
    throw Error(method);
  }};
  const o=new SearchOrchestrator(p=>published.push(p),()=>{},()=>true,owner);
  o.open();o.search('目标');await sleep(30);
  const before={onlineCalls:calls.filter(x=>x==='book.search').length,localVisible:published.some(p=>p.kind==='results'&&p.results.some(b=>b.sourceId==='local'))};
  release();await sleep(50);
  console.log(JSON.stringify({case:'barrier',blocked,before,after:{onlineCalls:calls.filter(x=>x==='book.search').length,finalKind:published.at(-1).kind,results:published.at(-1).results?.length}}));o.close();
}
const N=2000;
const rows=new Map(Array.from({length:N},(_,i)=>{const row={origin:'s',bookUrl:'/b'+i,name:'目标'+i,author:'作者',acquisition:{sourceVersion:'v',detailAt:1}};return [JSON.stringify(['s','/b'+i]),row];}));
const calls=[];
const g=new SearchGateway({bookAcquisitions:()=>({sourceRegistryRevision:()=>1}),request:async(method,params)=>{calls.push(method);
 if(method==='source.list')return{data:{sources:[source]}};
 if(method==='search-book.list')return{data:{books:structuredClone([...rows.values()])}};
 if(method==='search-book.get')return{data:{book:structuredClone(rows.get(JSON.stringify([params.origin,params.bookUrl])))}};
 throw Error(method);
}});
let books=Array.from({length:1000},(_,i)=>({sourceId:'s',sourceName:'源',bookSourceUrl:'s',bookId:'/b'+i,detailUrl:'/b'+i,searchRequestId:'q',sourceRuleVersion:'v',category:'novel',title:'目标'+i,author:'作者',variables:[]}));
books=await g.refreshBooks(books,{reset:false,identities:books.map(b=>({sourceId:b.sourceId,bookId:b.bookId}))});
let mapEntries=0,identityLookups=0;const index=g.projectedIdentityIndex;const originalGroup=index.groupFor.bind(index);index.groupFor=(...args)=>{identityLookups++;return originalGroup(...args);};
const originalRows=g.projectedBookRows;
g.projectedBookRows={*[Symbol.iterator](){for(const pair of originalRows){mapEntries++;yield pair;}}};
rows.get(JSON.stringify(['s','/b0'])).acquisition.detailAt=2;calls.length=0;
const updated=await g.refreshBooks(books,{reset:false,identities:[{sourceId:'s',bookId:'/b0'}]});
console.log(JSON.stringify({case:'one-book-delta',cacheRows:N,queryBooks:books.length,rpc:calls,clonedMapEntries:mapEntries,identityLookups,replacedBooks:updated.filter((b,i)=>b!==books[i]).length}));
