import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fixture,seedEntry,draft} from './lib/rss-management-durable-probe.mjs';
import {boundedSurfaceSdk,boundedMembers} from './lib/bounded-surface-sdk-probe.mjs';
const source=readFileSync(new URL('../entry/src/main/ets/features/rss/RssOriginalRecoverySurface.ets',import.meta.url),'utf8');
async function pending(kind='management'){
 const warm=await fixture();await seedEntry(warm);warm.options.beforeMethod='rules.mutation.apply';await assert.rejects(kind==='entry'?warm.rss.persistFavorite('s','g',10):kind==='editor'?warm.rss.createSubscription(draft(301)):warm.rss.updateSubscriptionEnabled('s',false));
 const original=JSON.parse(warm.disk());warm.retire();const f=await fixture(warm);await f.rss.recoverOriginalRss(f.current);return{f,original,projection:f.rss.originalMutationSnapshot()};
}
function surface(projection,handlers={},scope='management'){
 const sdk=boundedSurfaceSdk({allowEmptyBranchAdmission:true});
 const owner=sdk.consumer(source,boundedMembers(source),{}, {original:projection,presentationIdentity:'page-a',subscriptionId:projection.subscriptionId,guid:projection.guid,scope,...handlers});owner.aboutToAppear();owner.initialRender();
 const actions=()=>sdk.walk(owner).filter(c=>c instanceof sdk.deps.ReaderRecoveryAction);
 const action=label=>{const actor=actions().filter(c=>c.label===label).at(-1);assert.ok(actor,label);return{actor,click:sdk.nodes(actor).find(n=>n.onClick).onClick};};
 return{sdk,owner,actions,action,update(params){owner.updateStateVars({original:owner.original,presentationIdentity:owner.presentationIdentity,scope:owner.scope,subscriptionId:owner.subscriptionId,guid:owner.guid,...params});sdk.properties.flush();owner.replay();sdk.properties.flush();}};
}
let cases=0;
{
 const {f,original,projection}=await pending();let task=Promise.resolve();
 const v=surface(projection,{onReconcileOriginal:expected=>{task=f.rss.recoverOriginalRss(f.current,expected);},onContinueOriginal:expected=>{task=f.rss.recoverOriginalRss(f.current,expected,true);}});
 const oldRead=v.action('核对原操作回执'),oldContinue=v.action('继续原操作');oldRead.click();await task;assert.equal(f.writes().length,0,'actual Core exact query never applies');
 const current=f.rss.originalMutationSnapshot();v.update({original:current,presentationIdentity:'page-a',scope:'management'});
 const before=f.calls.length;oldContinue.click();oldRead.click();await task;assert.equal(f.calls.length,before,'retained actors never upgrade their immutable original');
 v.action('继续原操作').click();await task;assert.equal(f.writes().length,1);assert.equal(f.writes()[0].params.operationId,original.operationId);assert.deepEqual(f.writes()[0].params.mutation,original.mutation);cases++;
}
for(const field of ['operationId','generation','method','scope','subscriptionId','guid','presentationIdentity']){
 const {f,projection}=await pending();let attempts=0;const v=surface(projection,{onContinueOriginal:()=>attempts++});const old=v.action('继续原操作');
 const next=structuredClone(projection);if(field!=='presentationIdentity')next[field]=field==='generation'?next.generation+1:'replacement';
 v.update({original:next,presentationIdentity:field==='presentationIdentity'?'page-b':'page-a',scope:'management'});old.click();assert.equal(attempts,0,field+' cannot be borrowed by old physical action');cases++;
}
for(const state of ['busy','foreign','feed','unqualified','disappeared']){
 const {projection}=await pending();let attempts=0;const v=surface(projection,{onContinueOriginal:()=>attempts++});const old=v.action('继续原操作');
 if(state==='disappeared')v.owner.aboutToDisappear();else v.update({original:{...projection,busy:state==='busy',scope:state==='foreign'?'foreign':projection.scope,canRetryOriginal:state!=='unqualified'},presentationIdentity:'page-a',scope:state==='feed'?'feed':'management'});
 old.click();assert.equal(attempts,0,state+' has no mutation dispatch');cases++;
}
{
 const {projection}=await pending();const v=surface({...projection,confirmation:'confirmed',writeStage:'cleanup',canRetryOriginal:false});
 assert.equal(v.actions().some(a=>a.label==='继续原操作'||a.label==='继续原清理'),false,'confirmed Core with unqualified cleanup only permits exact query');cases++;
}
{
 const {projection}=await pending();let attempts=0;const mutated=source.replace('if (this.canContinue(identity)) this.onContinueOriginal(this.expected(identity));','this.onContinueOriginal(this.expected(identity));');
 const sdk=boundedSurfaceSdk({allowEmptyBranchAdmission:true});const owner=sdk.consumer(mutated,boundedMembers(mutated),{}, {original:projection,presentationIdentity:'page-a',scope:'management',onContinueOriginal:()=>attempts++});owner.aboutToAppear();owner.initialRender();
 const actor=sdk.walk(owner).filter(a=>a instanceof sdk.deps.ReaderRecoveryAction&&a.label==='继续原操作').at(-1),click=sdk.nodes(actor).find(n=>n.onClick).onClick;
 owner.aboutToDisappear();click();assert.equal(attempts,1,'negative control: removing the physical guard reproduces the retired write attempt');cases++;
}
for(const kind of ['entry','editor']){
 const {projection}=await pending(kind);const v=surface(projection,{},kind);assert.ok(v.action('继续原操作'));
 v.update({subscriptionId:'other'});assert.equal(v.actions().filter(a=>a.label==='继续原操作'&&a.actionEnabled).length,0,'other entity cannot borrow this original');
 const wrong=surface(projection,{},kind);wrong.update({guid:kind==='entry'?'other':'',subscriptionId:kind==='editor'?'other':projection.subscriptionId});
 assert.equal(wrong.actions().filter(a=>a.label==='继续原操作'&&a.actionEnabled).length,0);cases++;
}
console.log(`PASS RSS actual Core/Atomic original→decorated shared recovery→native physical event: ${cases} groups`);
