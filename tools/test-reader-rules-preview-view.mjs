import {decodeReaderDirectoryDisplayMetadata} from '../entry/src/main/ets/features/reading/application/ReaderDirectoryDisplayMetadata.ts';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
import {pureModuleProbe} from './lib/ets-pure-module-probe.mjs';
import {selectedProductionClasses,selectedProductionMethods} from './lib/selected-production-methods.mjs';
import {installedEtsCompiler} from './lib/ets-compiler-runtime.mjs';
import {createReaderBuilderProbe} from './lib/reader-control-builder-probe.mjs';
import {foundationControls} from './lib/reader-foundation-control-probe.mjs';
import {boundedSurfaceSdk,boundedMembers} from './lib/bounded-surface-sdk-probe.mjs';
import {readerEditingSdk} from './lib/reader-editing-sdk-probe.mjs';
const file=path=>new URL('../entry/src/main/ets/'+path,import.meta.url),read=path=>readFileSync(file(path),'utf8');
const nav=pureModuleProbe(read('features/reading/application/ReaderDirectoryNavigation.ts'),'ReaderDirectoryNavigation.ts',{decodeReaderDirectoryDisplayMetadata},['decodeReaderDirectoryPage','readerDirectoryScopeKey']);
const node=i=>({nodeId:`node:${i}`,depth:i===0?0:1,title:`节点${i}`,kind:'target',chapterIndex:i,hasChildren:false,expanded:false});
const proof={previewId:'preview:1',inputRevision:'input:1',rulesRevision:'rules:1',navigationRevision:'nav:1'};
const page=(offset=0,id=proof.previewId,total=1025)=>({status:'ready',sourceId:'local',bookId:'book',...proof,previewId:id,structureRevision:proof.navigationRevision,
 nodeCount:total,readableChapterCount:total,offset,nodes:Array.from({length:Math.min(256,total-offset)},(_,i)=>node(offset+i)),nextOffset:offset+256<total?offset+256:null});
function fixture(){
 const calls=[],applies=[],closed=[],owner={snapshot:()=>({generation:1,busy:false,blocked:false,confirmation:'undispatched'}),
  async run(_label,_active,action){return action(async(method,params)=>{applies.push({method,params});return{data:{...page(),navigationRevision:params.expectedPreview.navigationRevision}};},()=>{});},
  async recoverOriginal(_active,qualify){const last=applies.at(-1);qualify(last.method,last.params,page());return this.snapshot();}};
 let delay;
 const runtime={supportsCoreCapability:()=>true,async request(method,params){calls.push({method,params});
  if(method.endsWith('close.v2')){closed.push(params.previewId);return{data:{closed:true,...params}};}
  if(method.endsWith('page.v2')){if(delay)await delay;return{data:page(params.offset,params.expectedPreview.previewId)};}
  return{data:page()};}};
 const {ReaderDirectoryRulesGateway:Gateway}=pureModuleProbe(read('features/reading/application/ReaderDirectoryRulesGateway.ts'),'ReaderDirectoryRulesGateway.ts',{
  ...nav,ReaderRuntimeOwner:{isCurrent:o=>o===runtime},RulesMutationOwner:{forRuntime:()=>owner}},['ReaderDirectoryRulesGateway']);
 return{gateway:new Gateway(runtime),runtime,calls,applies,closed,owner,delay(p){delay=p;}};
}
// The cache is a named platform port. This test does not reimplement or claim
// verification of Harmony util.LRUCache eviction; Native compilation checks it.
const platformPages=new Map(),directoryPages={get:k=>platformPages.get(k),put:(k,v)=>platformPages.set(k,v),keys:()=>[...platformPages.keys()],remove:k=>platformPages.delete(k)};
const {ts,options}=installedEtsCompiler(),listSource=read('features/reading/ui/ReaderDirectoryNavigationList.ets'),tree=ts.createSourceFile('ReaderDirectoryNavigationList.ets',listSource,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,options);
const prefix=tree.statements.find(n=>n.name?.text==='directoryPagePrefix').getText(tree);
const {directoryPagePrefix}=pureModuleProbe('export '+prefix,'DirectoryPagePrefix.ets',nav,['directoryPagePrefix']);
const {ReaderDirectoryPageWindow}=selectedProductionClasses(file('features/reading/ui/ReaderDirectoryNavigationList.ets'),['ReaderDirectoryPageWindow'],{directoryPages,directoryPagePrefix});
const {ReaderDirectoryRulesPreviewDataSource:Source}=pureModuleProbe(read('features/reading/ui/ReaderDirectoryRulesPreviewDataSource.ets'),'ReaderDirectoryRulesPreviewDataSource.ets',{ReaderDirectoryPageWindow},['ReaderDirectoryRulesPreviewDataSource']);
const settle=async()=>{for(let i=0;i<10;i++)await Promise.resolve();};
const defs={gateway:'Real preview Gateway validates full range/version/order and passes same draft proof to original mutation lane; release/late responses cannot replace current preview',
 'lazy-ranges':'Actual preview DataSource shares page window, exposes 1025 indices, reloads evicted prefix, blocks failed range until exact retry and rejects old view',
 lifecycle:'Actual mounted editor draft/hide/retirement releases preview while preserving draft and original mutation owner',
 'sdk-list':'Actual SDK build gives native List one unsliced 1025-item IDataSource and emits explicit first/257th/last rows at original 120vp slot',
 'sdk-load-actors':'Actual editor reload updates emitted Preview actor and permits one current preview; former physical actor stays rejected'};
for(const id of selectContractCases(defs)){
 if(id==='gateway'){
  const f=fixture(),rules=[{pattern:'卷.*',level:0,boundary:'title'}];await f.gateway.preview('book',rules,()=>true);
  assert.equal(f.gateway.currentPreview().nodeCount,1025);assert.equal(f.calls[0].params.previewView,true);
  const tail=await f.gateway.previewPage(1024,()=>true);assert.equal(tail.nodes[0].nodeId,'node:1024');
  assert.equal(f.calls.at(-1).params.expectedPreview.previewId,proof.previewId);
  await assert.rejects(f.gateway.apply('book',[],()=>true));assert.equal(f.applies.length,0);
  await f.gateway.apply('book',rules,()=>true);assert.deepEqual(f.applies[0].params.expectedPreview,proof);
  f.gateway.releasePreview();await settle();assert.equal(f.closed.length,1);
  await f.gateway.continueOriginal('book','original',()=>true);assert.equal(f.applies.length,1,'original recovery does not require a live preview or send a new apply');
  await f.gateway.preview('book',rules,()=>true);let release;f.delay(new Promise(r=>release=r));const old=f.gateway.previewPage(256,()=>true);
  f.gateway.releasePreview();release();await assert.rejects(old,/retired/);assert.equal(f.gateway.currentPreview(),undefined);
  const bad=page(256);bad.rulesRevision='wrong';await f.gateway.preview('book',rules,()=>true);
  assert.throws(()=>f.gateway.decodePreview(bad,'book',256,f.gateway.currentPreview()),/version/);
 }
 if(id==='lazy-ranges'){
  const f=fixture();await f.gateway.preview('book',[],()=>true);const requests=[],s=new Source(offset=>requests.push(offset));
  platformPages.set('formal:0',[node(0)]);s.replace(f.gateway.currentPreview());assert.ok(platformPages.has('formal:0'),'initial empty preview scope cannot clear formal directory pages');assert.equal(s.totalCount(),1025);assert.equal(s.getData(0).node.nodeId,'node:0');
  s.getData(256);s.getData(257);s.getData(1024);await settle();assert.deepEqual(requests,[256,1024]);
  s.admit(await f.gateway.previewPage(256,()=>true));s.admit(await f.gateway.previewPage(1024,()=>true));
  assert.equal(s.getData(256).node.title,'节点256');assert.equal(s.getData(1024).node.title,'节点1024');
  const firstKey=[...platformPages.keys()].find(k=>k.includes(proof.previewId)&&k.endsWith(':0'));platformPages.delete(firstKey);s.getData(0);await settle();assert.equal(requests.at(-1),0);
  s.reject(0);s.getData(0);await settle();assert.equal(requests.filter(n=>n===0).length,1);s.retry();await settle();assert.equal(requests.filter(n=>n===0).length,2);
  s.admit(await f.gateway.previewPage(0,()=>true));assert.equal(s.getData(0).node.title,'节点0');
  const old=await f.gateway.previewPage(256,()=>true);s.clear();s.admit(old);assert.equal(s.totalCount(),0);
 }
 if(id==='lifecycle'){
  const Editor=selectedProductionMethods(file('features/reading/ui/ReaderDirectoryRules.ets'),'ReaderDirectoryRules',
   ['changed','releasePreview','onPreviewActiveChanged','aboutToDisappear']);const f=fixture();await f.gateway.preview('book',[],()=>true);
  const draft=[{id:1,pattern:'卷.*',level:'0'}],o=Object.assign(new Editor(),{gateway:f.gateway,previewSource:new Source(()=>{}),rules:draft,generation:1,presentationGeneration:1,
   mounted:true,busy:false,previewReady:true,previewCount:1025,previewReadFailed:false,feedback:{reset(){}},onRecoveryChanged(){}});
  o.changed();assert.equal(o.rules,draft);assert.equal(o.previewReady,false);assert.equal(o.previewCount,0);assert.equal(f.gateway.currentPreview(),undefined);
  o.previewActive=false;o.onPreviewActiveChanged();o.aboutToDisappear();assert.equal(o.mounted,false);assert.equal(o.rules,draft);assert.equal(o.gateway.owner(),f.owner);
 }
 if(id==='sdk-list'){
  const controls=foundationControls(),seen=[];
  const lazy={create(_id,owner,source,generate){seen.push(source);for(const index of [0,256,1024])generate(source.getData(index),index);},pop(){}};
  const f=fixture();await f.gateway.preview('book',[],()=>true);const source=new Source(()=>{});source.replace(f.gateway.currentPreview());source.admit(await f.gateway.previewPage(256,()=>true));source.admit(await f.gateway.previewPage(1024,()=>true));
  const probe=createReaderBuilderProbe(read('features/reading/ui/ReaderDirectoryRules.ets'),['build'],{...controls.dependencies,LazyForEach:lazy},controls.hooks);
  const o=Object.assign(probe.owner,{previewSource:source,previewCount:1025,previewReadFailed:false,rules:[],scheme:'day',message:'完整预览',operation:{generation:1},
   focusTargetId:'',actorIdentity:()=> 'actor',recoveryIdentity:()=> 'actor:op',recoveryView:()=>({visible:false}),canEdit:()=>false});
  o.initialRender();const nodes=[...o.nodes.values()],list=nodes.find(n=>n.type==='List');assert.equal(list.height,120);assert.equal(list.maintainVisibleContentPosition,true);
  assert.equal(seen.length,1);assert.equal(seen[0],source);assert.equal(seen[0].totalCount(),1025);
  assert.deepEqual(nodes.filter(n=>n.type==='ListItem').length,3);for(const n of [0,256,1024])assert.ok(nodes.some(item=>item.type==='Text'&&String(item.create).includes('节点'+n)));
 }
 if(id==='sdk-load-actors'){
  const f=fixture(),sdk=boundedSurfaceSdk({allowEmptyBranchAdmission:true}),controls=foundationControls();
  f.owner.recoverOriginal=async()=>f.owner.snapshot();
  const request=f.runtime.request.bind(f.runtime);
  f.runtime.request=async(method,params,...rest)=>method==='reading.directory.rules.get.v2'?
   {data:{status:'ready',rules:[]}}:request(method,params,...rest);
  for(const [name,value] of Object.entries(controls.dependencies))if(!(name in sdk.properties.sdk))sdk.deps[name]=value;
  Object.assign(sdk.childSources,controls.hooks.childSources);
  const enter=sdk.hooks.onObserverEnter;sdk.hooks.onObserverEnter=(...args)=>{enter?.(...args);controls.hooks.onObserverEnter?.(...args);};
  const source=read('features/reading/ui/ReaderDirectoryRules.ets');
  const owner=sdk.consumer(source,boundedMembers(source),{...readerEditingSdk(),
   ReaderDirectoryRulesPreviewDataSource:Source,ReaderDirectoryRulesGateway:class{constructor(){return f.gateway;}},
   ReaderRuntimeOwner:{current:()=>f.runtime,isCurrent:o=>o===f.runtime},
  },{bookId:'book',previewActive:true,interactionEnabled:true});
  sdk.properties.flush();owner.gateway=f.gateway;owner.mounted=true;owner.loaded=true;owner.initialRender();
  const flush=()=>{sdk.properties.flush();controls.properties.flush();sdk.properties.flush();};
  const preview=()=>sdk.nodes(owner).filter(n=>n.type==='Button'&&n.accessibilityText==='预览').at(-1);
  const old=preview();assert.ok(old,'actual initial Preview native Button');
  owner.loadRules();await settle();flush();assert.equal(owner.loaded,true);assert.equal(owner.busy,false);
  const current=preview();assert.equal(current.enabled,true,'real loaded editor permits preview');
  current.onClick();await settle();flush();
  assert.equal(f.calls.filter(c=>c.method==='reading.directory.rules.preview.v2').length,1,'loaded current physical Preview dispatches once');
  assert.equal(owner.previewCount,1025);assert.equal(owner.previewReady,true);
  const before=f.calls.length;old.onClick();await settle();assert.equal(f.calls.length,before,'former actor cannot preview current draft');
 }
 recordContractCasePass(id);
}
