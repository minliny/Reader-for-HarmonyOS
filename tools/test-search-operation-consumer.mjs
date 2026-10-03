import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createReaderBuilderProbe} from './lib/reader-control-builder-probe.mjs';
import {projectOperationFacts} from '../entry/src/main/ets/app/ReaderOperationFacts.ts';
import {searchSharedActionFixture} from './lib/search-shared-action-probe.mjs';
const source=readFileSync(new URL('../entry/src/main/ets/features/search/SearchPage.ets',import.meta.url),'utf8');
const {owner}=createReaderBuilderProbe(source,['operation','retryOperation','isSweeping','isStoppedEmpty']);
let retries=0;owner.onRetry=()=>retries++;
const value={resultCount:1,totalSourceCount:2,completedSourceCount:1,failedSourceCount:0};
for(const [phase,canCancel,canRetry] of [['loading',true,false],['partial',true,false],['partial',false,true],['failed',false,true],['cancelled',false,true],['refreshing',true,false],['succeeded',false,false]]){
 const operation=projectOperationFacts({phase,value,canCancel,canRetry,generation:1});
 owner.presentation={kind:'results',operation,searching:!canCancel,results:[]};assert.equal(owner.operation(),operation);assert.equal(owner.isSweeping(),canCancel,'actual owner capability controls the stop/spinner actor, rather than stale searching boolean');
 const before=retries;owner.retryOperation();assert.equal(retries-before,canRetry?1:0,'read retry admits only the operation capability');
}
owner.presentation={kind:'empty',operation:projectOperationFacts({phase:'cancelled',canRetry:true}),stopped:false};assert.ok(owner.isStoppedEmpty(),'cancelled operation cannot masquerade as completed empty');
owner.presentation={kind:'initial'};assert.equal(owner.operation(),undefined);assert.equal(owner.isSweeping(),false);owner.retryOperation();
for(const [kind,spec,builder] of [['error','search-error-retry',p=>p.errorContent(7)],['results','search-retry-status',p=>p.resultsContent()],['empty','search-secondary',p=>p.emptyContent('原关键词',7)]]){
 for(const canRetry of[false,true]){
  const operation=projectOperationFacts({phase:kind==='error'?'failed':kind==='empty'?'cancelled':'partial',value,canRetry,generation:3});
  const f=searchSharedActionFixture({kind,operation});builder(f.page);const action=f.action(spec,kind==='empty'?'重新搜索':undefined);
  const before=f.calls.filter(c=>c[0]==='retrySearch').length;action.click();
  assert.equal(f.calls.filter(c=>c[0]==='retrySearch').length-before,canRetry?1:0,'actual '+kind+' parent/shared/native retry obeys owner capability');
  if(kind!=='empty')assert.equal(action.native.enabled,canRetry,'disabled retry is published to the actual native component');
  action.actor.aboutToDisappear();action.click();assert.equal(f.calls.filter(c=>c[0]==='retrySearch').length,before+(canRetry?1:0),'retired shared actor cannot retry');
 }
}
{
 const f=searchSharedActionFixture({kind:'results',operation:projectOperationFacts({phase:'cancelled',canRetry:true}),stopped:false});f.page.resultsContent();
 assert.ok(f.controls.nodes(f.page).some(n=>n.type==='Text'&&String(n.create).includes('已停止,已搜索 3/7 个书源')),'actual native result label preserves interrupted progress');
}
{
 const mutant=source.replace('if (operation !== undefined && !operation.canRetry) return;','');assert.notEqual(mutant,source);
 const f=searchSharedActionFixture({kind:'empty',operation:projectOperationFacts({phase:'cancelled',canRetry:false})},{pageDefinition:mutant});
 f.page.emptyContent('原关键词',7);f.action('search-secondary','重新搜索').click();
 assert.equal(f.calls.filter(c=>c[0]==='retrySearch').length,1,'negative control: deleting the real business retry guard makes the same physical empty actor dispatch');
}
assert.match(source,/if \(this\.operation\(\)\?\.fact === 'cancelled'/,'real results actor labels interrupted progress');
console.log('Search actual SDK operation consumer: PASS (loading/partial/read-failure/stopped/refresh/complete/capability/real retry actors).');
