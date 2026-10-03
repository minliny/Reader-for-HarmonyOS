import { readFileSync } from 'node:fs';
import { runtimeOwnerIdentityProbe } from './reader-runtime-admission-probe.mjs';
import { stripTypeScriptTypes } from 'node:module';
import { isReaderCoreTransactionPendingError, ReaderCoreRequestError } from '../../entry/vendor/core-harmony/sdk/reader_core.ts';

export const rssSource = name => readFileSync(new URL(`../../entry/src/main/ets/${name}`, import.meta.url), 'utf8');
const ordinary = source => stripTypeScriptTypes(source.replace(/^import[\s\S]*?from ['"][^'"]+['"];\n/gm, '').replace(/^export /gm, ''));
export const rssFacts = new Function(ordinary(rssSource('app/ReaderOperationFacts.ts')) + ';return {projectOperationFacts,projectCommitReadback};')();
export const rssProjection = new Function(...Object.keys(rssFacts), ordinary(rssSource('app/ReaderPersistedReceiptProjection.ts')) + ';return projectPersistedReceipt;')(...Object.values(rssFacts));
export const rssRecoveryView = new Function(ordinary(rssSource('app/ReaderRecoveryProjection.ts')) + ';return readerRecoveryView;')();
export const RssWriteEvidence = new Function(ordinary(rssSource('app/ReaderWriteEvidence.ts')) + ';return ReaderWriteEvidence;')();
let currentOwner;
export const RssRuntime = runtimeOwnerIdentityProbe(() => currentOwner);
export const replaceRssRuntime = owner => { currentOwner = owner; };
const quiet = { warn(){},error(){} };
export const RealRssGateway = new Function('ReaderRuntimeOwner','isReaderCoreTransactionPendingError', ordinary(rssSource('features/rss/RssGateway.ts')) + ';return RssGateway;')(RssRuntime,isReaderCoreTransactionPendingError);
export const RealRssRouteHost = new Function('ReaderWriteEvidence','projectPersistedReceipt','projectOperationFacts', ordinary(rssSource('features/rss/RssRouteOperationHost.ts')) + ';return RssRouteOperationHost;')(RssWriteEvidence,rssProjection,rssFacts.projectOperationFacts);
export const RealRssOrchestrator = new Function('RssGateway','ReaderRuntimeOwner','ReaderWriteEvidence','RssRouteOperationHost','hilog','isReaderCoreTransactionPendingError','projectPersistedReceipt','projectOperationFacts', ordinary(rssSource('features/rss/RssOrchestrator.ets')) + ';return RssOrchestrator;')(RealRssGateway,RssRuntime,RssWriteEvidence,RealRssRouteHost,quiet,isReaderCoreTransactionPendingError,rssProjection,rssFacts.projectOperationFacts);
const editorClasses = new Function('RssGateway','ReaderRuntimeOwner','ReaderWriteEvidence','hilog','projectPersistedReceipt','projectOperationFacts', ordinary(rssSource('features/rss/RssSubscriptionEditorOrchestrator.ets')) + ';return {RssSubscriptionEditorOrchestrator,EMPTY_RSS_EDITOR_SNAPSHOT};')(RealRssGateway,RssRuntime,RssWriteEvidence,quiet,rssProjection,rssFacts.projectOperationFacts);
export const RealRssEditor = editorClasses.RssSubscriptionEditorOrchestrator;
export const RssEmptyEditor = editorClasses.EMPTY_RSS_EDITOR_SNAPSHOT;
export const deferredRss = () => {let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve};};
export const settleRss = async owner => { for(let n=0;n<6;n++){await owner.mutationChain;await new Promise(r=>setImmediate(r));} };
export const pendingRssError = () => new ReaderCoreRequestError({protocolVersion:1,requestId:1,type:'error',error:{code:'TRANSACTION_PENDING',message:'typed gate',retryable:true,details:{transactionKind:'persistenceMutation',pendingHostOperationCount:0,retryAfterMillis:0}}});
const clone = value => value === undefined ? undefined : structuredClone(value);
export function rssRpc() {
  return { calls:[],subscriptions:[{subscriptionId:'s',feedUrl:'https://example.test/feed',title:'source',enabled:true,unreadCount:1}],
    items:[{subscriptionId:'s',guid:'g',title:'entry',read:false,firstSeenAt:1}], favorites:[],sources:new Map(),
    readFailures:new Map(),lost:new Set(),before:undefined,afterWrite:undefined,refused:new Set(),
    async request(method,params){
      this.calls.push([method,clone(params)]);if(this.before)await this.before(method,params);
      if(this.refused.delete(method))throw pendingRssError();
      const failed=this.readFailures.get(method);if(failed){this.readFailures.delete(method);throw failed;}
      const sub=this.subscriptions.find(s=>s.subscriptionId===(params.subscriptionId??'s'));
      if(method==='runtime.status')return{data:{pendingHostOperationCount:0}};
      if(method==='rss-source.list')return{data:{sources:this.subscriptions.map(subscription=>({subscription:clone(subscription),source:clone(this.sources.get(subscription.subscriptionId)??{})}))}};
      if(method==='rss.subscription.items')return{data:{subscription:clone(sub),items:clone(this.items.filter(item=>item.subscriptionId===params.subscriptionId)),count:this.items.length,unreadCount:sub.unreadCount}};
      if(method==='rss.favorite.list')return{data:{favorites:clone(this.favorites.filter(f=>f.subscriptionId===params.subscriptionId)),count:this.favorites.filter(f=>f.subscriptionId===params.subscriptionId).length}};
      let data;
      if(method==='rss.entry.read'){
        this.items.find(i=>i.subscriptionId===params.subscriptionId&&i.guid===params.guid).read=params.read;sub.unreadCount=this.items.filter(i=>!i.read).length;
        data={marked:true,subscriptionId:params.subscriptionId,guid:params.guid,read:params.read,unreadCount:sub.unreadCount};
      }else if(method==='rss.favorite.persist'){
        const favorite={subscriptionId:params.subscriptionId,guid:params.guid,feedUrl:sub.feedUrl,subscriptionTitle:sub.title,title:'entry',firstSeenAt:1,addedAt:params.addedAt};
        this.favorites.push(favorite);data={created:true,favorite:clone(favorite)};
      }else if(method==='rss.favorite.remove'){
        this.favorites=this.favorites.filter(f=>f.subscriptionId!==params.subscriptionId||f.guid!==params.guid);data={subscriptionId:params.subscriptionId,guid:params.guid,removed:true};
      }else if(method==='rss.feed.refresh')data={subscription:clone(sub),items:clone(this.items),count:this.items.length,unreadCount:sub.unreadCount,newCount:0,fetched:true,notModified:false,evaluatedAt:1};
      else if(method==='rss-source.put'){
        const created=params.subscriptionId===undefined,subscriptionId=params.subscriptionId??`created-${this.subscriptions.length}`;
        const subscription={...(this.subscriptions.find(s=>s.subscriptionId===subscriptionId)??{subscriptionId,unreadCount:0}),feedUrl:params.source.sourceUrl,title:params.source.sourceName||params.source.sourceUrl,enabled:params.source.enabled};
        this.subscriptions=this.subscriptions.filter(s=>s.subscriptionId!==subscriptionId);this.subscriptions.push(subscription);this.sources.set(subscriptionId,clone(params.source));
        data={created,source:{subscription:clone(subscription),source:clone(params.source)}};
      }else throw Error(`unexpected RSS RPC ${method}`);
      if(this.afterWrite)this.afterWrite(method,params);
      if(this.lost.delete(method))throw Error('ACK lost after native storage');
      return{data};
    },count(method){return this.calls.filter(c=>c[0]===method).length;},
  };
}
export function rssRouteFixture() {
  const runtime=rssRpc();replaceRssRuntime(runtime);
  let current=true,version=1;
  const values=[],operations=[],reads=[],failures=[];
  const owner=new RealRssOrchestrator(()=>{},()=>current,runtime);
  const binding=()=>{const expected=version;return{emit:v=>values.push(clone(v)),failed:e=>failures.push(e.message),current:()=>current&&version===expected,
    emitOperation:o=>operations.push(clone(o)),emitRead:f=>reads.push(clone(f))};};
  const invoke=(method,...args)=>{const b=binding();owner[method](...args,b.emit,b.failed,b.current,b.emitOperation,b.emitRead);return b;};
  return{runtime,owner,values,operations,reads,failures,binding,invoke,retire(){current=false;version++;},reenter(){current=true;version++;}};
}
