import { resolveEtsLoaderRoot } from './lib/tool-environment.mjs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {fixture,seedEntry,draft,settle} from './lib/rss-management-durable-probe.mjs';
import {createReaderBuilderProbe} from './lib/reader-control-builder-probe.mjs';
import {boundedSurfaceSdk,boundedMembers} from './lib/bounded-surface-sdk-probe.mjs';
import {projectOperationFacts} from '../entry/src/main/ets/app/ReaderOperationFacts.ts';
import {RssPresentationProjection} from '../entry/src/main/ets/features/rss/RssPresentationProjection.ts';
import {readerRecoveryView} from '../entry/src/main/ets/app/ReaderRecoveryProjection.ts';
import {actualReaderPageShell} from './lib/reader-page-shell-runtime-probe.mjs';
const syntax=createRequire(import.meta.url)((resolveEtsLoaderRoot())+'/lib/validate_ui_syntax.js');syntax.builderParamObjectCollection.set('PageBackBar',new Set(['trailing']));syntax.builderParamObjectCollection.set('MainTabShell',new Set(['content']));
const read=p=>readFileSync(new URL('../entry/src/main/ets/'+p,import.meta.url),'utf8');
const routes={main:'rss',management:'rssSubscriptionManagement',editor:'rssSubscriptionEditor',feed:'rssSourceFeed',entry:'rssEntryDetail'};
const pages={main:'RssPage',management:'RssSubscriptionManagementPage',editor:'RssSubscriptionEditorPage',feed:'RssSourceFeedPage',entry:'RssEntryDetailPage'};
class Child{constructor(owner,params,_storage,id){Object.assign(this,{owner,params,id});}updateStateVars(params){Object.assign(this.params,params);}}
const methods=['getRssOrchestrator','retireRssPresentation','getRssEditorOrchestrator','retireRssEditorPresentation','isCurrentRssEditorPresentation',
 'isCurrentRssHostPresentation','isCurrentRssPresentation','isCurrentRoute','isCurrentRuntime','feedPresentation','rssSubscriptions','rssSubscriptionManagementItems',
 'rssPageContent','rssPageSurface','loadRss','rssFeedBinding','reconcileRssFeedOriginal',
 'rssSubscriptionManagementContent','rssSubscriptionManagementSurface','rssEditorContent','rssEditorSurface',
 'rssSourceFeedContent','rssSourceFeedSurface','rssEntryDetailContent','rssEntryDetailSurface','rssSourceBinding','rssEntryBinding',
 'applyRssSourceSnapshot','applyRssEntrySnapshot','failRssEntryOperation'];
// Compilation is immutable; the cold Core, Runtime authority, orchestrators,
// SDK instance/property cells and physical callbacks remain per-fixture. Both
// original and guard-mutant Index sources get their own actual SDK emission.
const authorities=new WeakMap(),orchestrators=new WeakMap(),editors=new WeakMap();let currentAuthority;
const runtimePort={current:()=>currentAuthority.current(),isCurrent:owner=>authorities.get(owner)?.isCurrent(owner)===true};
const rssPort={forRuntime(owner){const Type=orchestrators.get(owner);assert.ok(Type);return Type.forRuntime(owner);}};
const editorPort={forRuntime(owner,...args){const Type=editors.get(owner);assert.ok(Type);return Type.forRuntime(owner,...args);}};
const indexTypes=new Map(),pageTypes=new Map();
function index(f,kind='management',instance=1,indexSource=read('pages/Index.ets')){
 authorities.set(f.runtime,f.Runtime);orchestrators.set(f.runtime,f.Orchestrator);editors.set(f.runtime,f.Editor);currentAuthority=f.Runtime;
 let compiled=indexTypes.get(indexSource);
 if(compiled===undefined){
  const sdk=boundedSurfaceSdk({allowEmptyBranchAdmission:true});
  for(const name of Object.values(pages))sdk.childSources[name]=read('features/rss/'+name+'.ets');
  compiled=createReaderBuilderProbe(indexSource,methods,{...sdk.deps,ReaderRuntimeOwner:runtimePort,RssOrchestrator:rssPort,
   RssSubscriptionEditorOrchestrator:editorPort,projectOperationFacts,RssPresentationProjection,
   ...Object.fromEntries(Object.values(pages).map(n=>[n,Child])),isReaderProductSurfaceEnabled:()=>true,deviceInfo:{deviceType:'phone'},hilog:{error(){}}},sdk.hooks);
  indexTypes.set(indexSource,compiled);
 }
 const p=new compiled.Component(undefined,{});
 assert.notEqual(p.nodes,compiled.owner.nodes,'each cold Index owns fresh native nodes');
 Object.assign(p,{route:routes[kind],mountedRuntimeOwner:f.runtime,shelfReceiptRetired:false,detailShelfAdmissionMount:1,navigationGeneration:1,
  rssInstanceIdentity:instance,rssPresentationIdentity:'',rssEditorPresentationIdentity:'',rssPresentation:{kind:'feed',subscriptions:[],recentUnread:[]},
  rssManagementRead:projectOperationFacts({phase:'idle'}),rssEditorSnapshot:f.emptyEditor,rssSourceRead:projectOperationFacts({phase:'idle'}),rssEntryRead:projectOperationFacts({phase:'idle'}),
  selectedRssSubscription:{subscriptionId:'s',title:'Feed s'},selectedRssItem:{subscriptionId:'s',guid:'g',title:'Entry g'},selectedRssItems:[],selectedRssFavoriteState:'loading'});
 const host=p.getRssOrchestrator(),editor=kind==='editor'?p.getRssEditorOrchestrator():undefined;
 const name={main:'rssPageContent',management:'rssSubscriptionManagementContent',editor:'rssEditorContent',feed:'rssSourceFeedContent',entry:'rssEntryDetailContent'}[kind];let rendered=false;
 const params=()=>{if(rendered)p.replay();else{p[name]();rendered=true;}return [...p.children.values()].filter(c=>c instanceof Child).at(-1).params;};
 const open=()=>{if(kind==='main')p.loadRss(1);else if(kind==='management')host.open();else if(kind==='editor')editor.openCreate();else {const b=kind==='entry'?p.rssEntryBinding(1,'s','g'):p.rssSourceBinding(1,'s');
  if(kind==='entry')host.openEntry('s','g',b.emit,b.failed,b.current,b.emitOperation,b.emitRead,b.emitOriginal);
  else host.loadSourceFeed('s',b.emit,b.failed,b.current,b.emitOperation,b.emitRead,b.emitOriginal);}};
 return{p,host,editor,params,open,settled:()=>settle(host)};
}
function page(f,x,kind){
 let compiled=pageTypes.get(kind);
 if(compiled===undefined){
  const sdk=boundedSurfaceSdk({allowEmptyBranchAdmission:true}),source=read('features/rss/'+pages[kind]+'.ets'),shared=read('features/rss/RssOriginalRecoverySurface.ets');
  sdk.childSources.RssOriginalRecoverySurface=shared;
  const Surface=createReaderBuilderProbe(shared,boundedMembers(shared),sdk.deps,sdk.hooks).Component;sdk.deps.RssOriginalRecoverySurface=Surface;
  for(const n of ['ReaderButton','ReaderLabeledIconAction','ReaderToggle','ReaderFormField','PageBackBar','ReaderSearchField','StatusBadge'])sdk.childSources[n]=read('features/common/'+n+'.ets');
  sdk.childSources.MainTabShell=read('features/shell/MainTabShell.ets');
  const constants={};if(kind==='main'){
   const declaration=source.match(/^const RSS_FLOATING_HEADER_HEIGHT = ([^;]+);/m);assert.ok(declaration,'actual RSS header fallback declaration');
   constants.RSS_FLOATING_HEADER_HEIGHT=new Function('readerPageContentStartInset','TOK_SPACE_XS','return ('+declaration[1]+');')(actualReaderPageShell().readerPageContentStartInset,sdk.deps.TOK_SPACE_XS);
  }
  const template=sdk.consumer(source,boundedMembers(source),{...constants,projectOperationFacts,readerRecoveryView,EMPTY_RSS_EDITOR_SNAPSHOT:f.emptyEditor,
   RSS_DETAIL_ACTION_AREA_HEIGHT:62,Scroller:class{},registerReaderFonts(){}},x.params());
  compiled={sdk,Component:template.constructor,template};pageTypes.set(kind,compiled);
 }
 const {sdk}=compiled,child=new compiled.Component(undefined,x.params());
 assert.notEqual(child.nodes,compiled.template.nodes,'each Page owns fresh native nodes and physical callbacks');
 child.getUIContext=()=>({getFont:()=>({})});child.aboutToAppear();
 const feedback=()=>child[kind==='main'?'readFeedback':kind==='editor'?'operationRecovery':'operationFeedback']();feedback();
 const action=label=>{const a=sdk.walk(child).filter(c=>c instanceof sdk.deps.ReaderRecoveryAction&&c.label===label).at(-1);assert.ok(a,label);
  return{actor:a,click:sdk.nodes(a).find(n=>n.onClick).onClick};};
 return{sdk,child,action,update(){child.updateStateVars(x.params());sdk.properties.flush();child.replay();feedback();sdk.properties.flush();}};
}
async function pending(kind,failure='beforeMethod'){
 const f=await fixture();await seedEntry(f);f.options[failure]='rules.mutation.apply';
 if(kind==='management')await assert.rejects(f.rss.updateSubscriptionEnabled('s',false));
 if(kind==='editor')await assert.rejects(f.rss.createSubscription(draft(301)));
 if(kind==='entry'||kind==='feed'||kind==='main')await assert.rejects(f.rss.persistFavorite('s','g',10));
 const original=JSON.parse(f.disk());f.retire();return{f:await fixture(f),original};
}
let cases=0;
for(const kind of ['management','editor','entry','feed','main']){
 const {f,original}=await pending(kind),x=index(f,kind);x.open();await x.settled();const v=page(f,x,kind);
 assert.equal(f.writes().length,0,'cold opening only exact query and current read');
 const readAction=v.action('核对原操作回执');readAction.click();await x.settled();assert.equal(f.writes().length,0);v.update();
 if(kind==='feed'||kind==='main'){assert.equal(v.sdk.walk(v.child).some(c=>c instanceof v.sdk.deps.ReaderRecoveryAction&&c.label==='继续原操作'),false,'feed never borrows entry continuation');}
 else{const old=v.action('继续原操作');v.action('核对原操作回执').click();await x.settled();v.update();old.click();await x.settled();assert.equal(f.writes().length,0,'old actor immutable original generation cannot upgrade');
  v.action('继续原操作').click();v.action('继续原操作').click();await x.settled();assert.equal(f.writes().length,1);assert.equal(f.writes()[0].params.operationId,original.operationId);assert.deepEqual(f.writes()[0].params.mutation,original.mutation);}
 cases++;
}
for(const kind of ['management','editor','entry'])for(const retired of ['nav','mount','runtime','route','physical']){
 const {f}=await pending(kind),x=index(f,kind);x.open();await x.settled();const v=page(f,x,kind),old=v.action('继续原操作'),before=f.calls.length;
 if(retired==='nav')x.p.navigationGeneration++;
 if(retired==='mount')x.p.detailShelfAdmissionMount++;
 if(retired==='runtime')f.retire();
 if(retired==='route')x.p.route='bookshelf';
 if(retired==='physical')v.sdk.walk(v.child).filter(c=>c instanceof v.sdk.deps.RssOriginalRecoverySurface).forEach(c=>c.aboutToDisappear());
 old.click();await x.settled();assert.equal(f.calls.length,before,'retired physical/native callback never borrows fresh owner');cases++;
}
for(const kind of ['management','editor','entry']){
 const {f}=await pending(kind),a=index(f,kind,1);a.open();await a.settled();const va=page(f,a,kind),old=va.action('继续原操作');
 const b=index(f,kind,2);b.open();await b.settled();const vb=page(f,b,kind),before=f.calls.length;old.click();await a.settled();assert.equal(f.calls.length,before);
 a.p.getRssOrchestrator();assert.equal(b.host.isPresentationCurrent(b.p.rssPresentationIdentity),true,'old alive getter cannot steal successor');
 a.p.retireRssPresentation();assert.equal(b.host.isPresentationCurrent(b.p.rssPresentationIdentity),true,'old detach preserves new lease');
 vb.action('继续原操作').click();await b.settled();assert.equal(f.writes().length,1);cases++;
}
// A same-runtime old page can call ordinary mutation methods unless the actual
// Index physical callback checks the captured attachment. This negative control
// runs the identical production method with that one guard removed.
for(const mutated of [false,true]){
 const f=await fixture();await seedEntry(f);let source=read('pages/Index.ets');
 if(mutated){const before="if (this.isCurrentRssHostPresentation(generation, owner, mounting, host, identity, 'rssSubscriptionManagement')) host?.toggleSubscription(id, enabled);";assert.ok(source.includes(before));source=source.replace(before,'host?.toggleSubscription(id, enabled);');}
 const a=index(f,'management',1,source);a.open();await a.settled();const old=a.params().onToggle;
 const b=index(f,'management',2);b.open();await b.settled();old('s',false);await a.settled();assert.equal(f.writes().length,mutated?1:0,'actual last physical admission guard negative control');
 if(!mutated){b.params().onToggle('s',false);await b.settled();assert.equal(f.writes().length,1,'current physical callback succeeds');}cases++;
}
console.log(`PASS RSS exact original Core/Atomic→Index→five decorated Pages→one shared recovery: ${cases} groups`);
assert.equal(indexTypes.size,2,'original and guard-mutant Index are independently emitted once');
assert.equal(pageTypes.size,5,'each original decorated Page is emitted once with fresh instances per journey');
