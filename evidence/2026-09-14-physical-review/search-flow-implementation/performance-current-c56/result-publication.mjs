import { readFileSync,writeFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import {performance} from 'node:perf_hooks';
const root='/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/';
const read=p=>readFileSync(root+p,'utf8');const clean=s=>s.replace(/^import[\s\S]*?;\n/gm,'');
const m=await import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes([
'features/common/BookAuthorMetadata.ts','app/BookRequestScheduler.ts','features/source/ReaderSourceCategory.ts','app/ErrorMessage.ts','features/search/SearchBookProjection.ts','features/search/SearchGateway.ts','features/search/SearchOrchestrator.ets','features/search/SearchViewState.ts','features/search/SearchResultRelevance.ts','features/common/BookAcquisitionPresentation.ts','features/search/SearchCandidatePolicy.ts','features/search/SearchResultProjection.ts'].map(p=>clean(read(p))).join('\n')+'\nexport { SearchQueryRun };')).toString('base64')}`);
const page=read('features/search/SearchPage.ets');
const classes=page.slice(page.indexOf('@Observed\nclass SearchBookGroup'),page.indexOf('/**\n * Figma-backed Book Search')).replace('@Observed\n','');
const data=await import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(read('features/common/BookAuthorMetadata.ts')+'\nconst DataOperationType={ADD:"add",DELETE:"delete",CHANGE:"change",RELOAD:"reload",MOVE:"move"};\n'+classes+'\nexport {SearchBookGroup,SearchResultDataSource};')).toString('base64')}`);
const groupMethod=page.slice(page.indexOf('  private groupResults('),page.indexOf('  private saveScrollAnchor('));
const C=(new Function('SearchResultProjection','SearchBookGroup',stripTypeScriptTypes(`class Page {${groupMethod}}`)+";return Page;"))(m.SearchResultProjection,data.SearchBookGroup);
const samples=[];
for(const count of [682,1000,5000,10000])for(let sample=0;sample<3;sample++){
 const pg=new C();Object.assign(pg,{viewState:new m.SearchViewState(),shelfBooks:[],selectedGroupName:'全部',projectedGroups:new Map()});
 const ds=new data.SearchResultDataSource();ds.registerDataChangeListener({onDatasetChange(){}});
 let last;
 const orchestrator=new m.SearchOrchestrator(p=>{pg.presentation=p;if(p.kind==='results'){const groups=pg.groupResults(p.results);ds.replace(groups,pg.changedGroupKeys)}last=p},()=>{},()=>true,{request(){throw Error('unexpected request')}});
 orchestrator.sessionOpen=true;
 const run=new m.SearchQueryRun('鸣龙','probe');orchestrator.run=run;
 const rows=Array.from({length:count},(_,i)=>({sourceId:`s${i%109}`,bookId:`/book${i}`,sourceName:'受控书源',bookSourceUrl:`https://s${i%109}.invalid`,title:`鸣龙 ${i}`,author:'关关公子',intro:'“事情是这样的，我当初身陷绝境，意外遇见了一条龙。”'.repeat(15),sourceRuleVersion:'v',searchRequestId:'probe',category:'novel',variables:[]}));
 run.localResults=run.admit(rows);
 let t=performance.now();orchestrator.publishRun(run);const first=performance.now()-t;
 t=performance.now();orchestrator.publishRun(run);const unchanged=performance.now()-t;
 const added=rows.slice(0,32).map((b,i)=>({...b,bookId:`/new${i}`,title:`鸣龙 新${i}`}));
 run.localResults.push(...run.admit(added));
 t=performance.now();orchestrator.publishRun(run);const plus32=performance.now()-t;
 samples.push({count,sample,firstMs:first,unchangedMs:unchanged,plus32Ms:plus32,finalGroups:ds.totalCount()});
}
const result={evidence:'macOS Node, production QueryRun/present/SearchResultProjection/Page.groupResults/DataSource methods; no ArkUI native layout or device timing, no deep copy emulation',samples};
writeFileSync('/private/tmp/ml-c56-search-perf/result-publication.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
