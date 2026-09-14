import { productionMotionMethods } from '/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/tools/lib/reader-motion-method-probe.mjs';
import { searchResultRelevance } from '/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/search/SearchResultRelevance.ts';
import { searchCandidateRank } from '/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/search/SearchCandidatePolicy.ts';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = '/Users/minliny/Documents/Reader/Reader-for-HarmonyOS';
const read = path => readFileSync(resolve(repo, path), 'utf8');
const page = read('entry/src/main/ets/features/search/SearchPage.ets');
const classes = page.slice(page.indexOf('@Observed\nclass SearchBookGroup'), page.indexOf('/**\n * Figma-backed Book Search'))
  .replace('@Observed\n', '');
const source = stripTypeScriptTypes(`${read('entry/src/main/ets/features/search/SearchViewState.ts')}\n${classes}\nexport { SearchBookGroup, SearchResultDataSource };`);
const { SearchBookGroup, SearchResultDataSource, SearchViewState } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

let allocatedGroups=0;
class CountedGroup extends SearchBookGroup {constructor(...args){super(...args);allocatedGroups++;}}
const Page=productionMotionMethods(repo+'/entry/src/main/ets/features/search/SearchPage.ets',['groupResults','normalizedBookKey'],{SearchBookGroup:CountedGroup,searchResultRelevance,searchCandidateRank});
const books=Array.from({length:1000},(_,i)=>({sourceId:'s',sourceName:'源',bookSourceUrl:'s',bookId:'/b'+i,detailUrl:'/b'+i,searchRequestId:'q',sourceRuleVersion:'v',category:'novel',title:'目标'+i,author:'作者',groupKey:'g'+i,variables:[]}));
const p=Object.assign(new Page(),{presentation:{kind:'results',keyword:'目标'},viewState:new SearchViewState(),shelfBooks:[],selectedGroupName:'全部'});
p.groupResults(books);allocatedGroups=0;const next=books.slice();next[0]={...books[0],intro:'新增简介'};
p.groupResults(next);console.log(JSON.stringify({case:'grouping-one-book-delta',queryBooks:books.length,changedBooks:1,newGroupObjects:allocatedGroups}));
for(const n of [1000,2000,4000]){
 const ds=new SearchResultDataSource();const make=i=>new SearchBookGroup({sourceId:'s',bookId:'/b'+i,title:'书'+i,author:'作者',groupKey:'g'+i},1,false);
 ds.replace(Array.from({length:n},(_,i)=>make(i)));
 let scans=0,scannedPrefix=0,notifications=0;ds.registerDataChangeListener({onDataAdd(){notifications++;},onDataDelete(){notifications++;},onDataChange(){notifications++;}});
 const before=Array.prototype.indexOf;Array.prototype.indexOf=function(...args){const result=before.apply(this,args);scans++;scannedPrefix+=result<0?this.length:result+1;return result;};
 try{ds.replace(Array.from({length:n},(_,i)=>make(n-i-1)));}finally{Array.prototype.indexOf=before;}
 console.log(JSON.stringify({case:'existing-rows-reverse-relevance',rows:n,indexOfCalls:scans,scannedPrefix,notifications}));
}
