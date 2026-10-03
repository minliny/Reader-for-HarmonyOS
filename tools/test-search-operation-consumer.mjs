import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createReaderBuilderProbe} from './lib/reader-control-builder-probe.mjs';
import {projectOperationFacts} from '../entry/src/main/ets/app/ReaderOperationFacts.ts';
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
assert.match(source,/\.onClick\(\(\): void => this\.retryOperation\(\)\)/,'real error/partial/empty actors consume the operation guard');
assert.match(source,/if \(this\.operation\(\)\?\.fact === 'cancelled'/,'real results actor labels interrupted progress');
console.log('Search actual SDK operation consumer: PASS (loading/partial/read-failure/stopped/refresh/complete/capability/real retry actors).');
