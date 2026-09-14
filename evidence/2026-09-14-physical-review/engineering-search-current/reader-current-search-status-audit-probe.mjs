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



const emitted=[];const o=new SearchOrchestrator(p=>emitted.push(p),()=>{},()=>true,{});
o.presentation={kind:'results',keyword:'目标',results:[],searching:true,totalSourceCount:4,completedSourceCount:1,failedSourceCount:0,localSearchFailed:true,sourceListFailed:false};o.stop();
console.log(JSON.stringify({case:'stop-loses-local-failure',beforeLocalSearchFailed:true,afterLocalSearchFailed:emitted.at(-1).localSearchFailed??null,stopped:emitted.at(-1).stopped}));
const owner={request:async method=>{if(method==='source.list')return{data:{sources:[]}};if(method==='bookshelf.list')throw Error('local shelf failure');if(method==='search.history.list')return{data:{keywords:[],count:0}};return{data:{}};}};
const out=[];const empty=new SearchOrchestrator(p=>out.push(p),()=>{},()=>true,owner);empty.open();empty.search('目标');await new Promise(r=>setTimeout(r,20));console.log(JSON.stringify({case:'local-only-failure',presentation:out.at(-1)}));empty.close();
