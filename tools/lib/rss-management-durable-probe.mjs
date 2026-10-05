import {fixture as rulesFixture,compile,ReaderWriteEvidence} from './rules-mutation-durable-probe.mjs';
import {isReaderCoreTransactionPendingError} from '../../entry/vendor/core-harmony/sdk/reader_core.ts';
import {projectOperationFacts,projectCommitReadback} from '../../entry/src/main/ets/app/ReaderOperationFacts.ts';
export async function fixture(existing) {
 const f=await rulesFixture(true,existing);
 const capabilities=new Set((await f.command('core.info')).data.capabilities);
 f.runtime.supportsCoreCapability=cap=>f.options.capability!==false && capabilities.has(cap);
 const Gateway=compile('features/rss/RssGateway.ts','RssGateway',{ReaderRuntimeOwner:f.Runtime,RulesMutationOwner:f.Owner,isReaderCoreTransactionPendingError},true);
 const rss=new Gateway(f.runtime);
 const projectPersistedReceipt=compile('app/ReaderPersistedReceiptProjection.ts','projectPersistedReceipt',{projectOperationFacts,projectCommitReadback},true);
 const common={RssGateway:Gateway,ReaderRuntimeOwner:f.Runtime,ReaderWriteEvidence,projectOperationFacts,projectPersistedReceipt,isReaderCoreTransactionPendingError,hilog:{warn(){},error(){}}};
 const Route=compile('features/rss/RssRouteOperationHost.ts','RssRouteOperationHost',common,true);
 const Orchestrator=compile('features/rss/RssOrchestrator.ets','RssOrchestrator',{...common,RssRouteOperationHost:Route},true);
 const editorTypes=compile('features/rss/RssSubscriptionEditorOrchestrator.ets','*',common,true);
 const current=()=>f.Runtime.isCurrent(f.runtime);
 return {...f,rss,Gateway,Route,Orchestrator,Editor:editorTypes.RssSubscriptionEditorOrchestrator,emptyEditor:editorTypes.EMPTY_RSS_EDITOR_SNAPSHOT,current,
  recover:(expected,retry=false)=>rss.recoverOriginalRss(current,expected,retry)};
}
export {compile};
export const draft=i=>({feedUrl:`https://rss-${i}.test/feed`,title:`Feed ${i}`,enabled:true,sourceGroup:'',header:'',enabledCookieJar:false,
 ruleArticles:'',ruleNextPage:'',ruleTitle:'',rulePubDate:'',ruleDescription:'',ruleImage:'',ruleLink:'',ruleContent:''});

/** Seed article inputs through the actual existing portable apply transaction,
 * not a fake RSS row parser or a forged receipt. Core local authority survives. */
export async function seedEntry(f,id='s',guid='g') {
 await f.command('rss-source.put',{subscriptionId:id,source:{sourceUrl:`https://${id}.test/feed`,sourceName:`Feed ${id}`,enabled:true}});
 const exported=(await f.command('runtime.storage.export')).data,snapshot=JSON.parse(exported.payload);
 snapshot.cache=snapshot.cache.filter(e=>e.key!==`reader.rss.subscription.v1.entries:${id}`);
 snapshot.cache.push({key:`reader.rss.subscription.v1.entries:${id}`,payload:JSON.stringify({schemaVersion:1,subscriptionId:id,entries:[{entry:{id:guid,title:`Entry ${guid}`,link:null,summary:null,publishedAt:null},firstSeenAt:1}]})});
 const payload=JSON.stringify(snapshot);await f.command('runtime.storage.apply',{payload,manifest:{schemaVersion:snapshot.schemaVersion,exportedAt:snapshot.exportedAt,bytes:Buffer.byteLength(payload),checksum:await f.sha256Hex(payload)}});
 return{id,guid};
}
export async function settle(owner) {for(let i=0;i<8;i++){await owner.mutationChain;await new Promise(r=>setImmediate(r));}}
