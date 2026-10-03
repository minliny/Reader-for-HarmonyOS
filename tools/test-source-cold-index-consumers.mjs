import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire,stripTypeScriptTypes} from 'node:module';
import {fixture} from './lib/source-management-durable-probe.mjs';
import {compile,deferred,until} from './lib/rules-mutation-durable-probe.mjs';
import {createReaderBuilderProbe} from './lib/reader-control-builder-probe.mjs';
import {boundedMembers,boundedSurfaceSdk} from './lib/bounded-surface-sdk-probe.mjs';
import {readerRecoveryView} from '../entry/src/main/ets/app/ReaderRecoveryProjection.ts';
import {ReaderNativeAlertOwner} from '../entry/src/main/ets/app/ReaderNativeAlertOwner.ts';
import {readerAppColor} from '../entry/src/main/ets/features/common/ReaderThemeRegistry.ts';
const read=p=>readFileSync(new URL('../entry/src/main/ets/'+p,import.meta.url),'utf8');
const document=JSON.stringify({bookSourceUrl:'https://index-original.test',bookSourceName:'Original',enabled:true});
const id='https://index-original.test';
const loader=process.env.READER_ETS_LOADER_ROOT??'/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const syntax=createRequire(import.meta.url)(loader+'/lib/validate_ui_syntax.js');
class Child{constructor(owner,params,_storage,id){Object.assign(this,{owner,params,id});}updateStateVars(params){Object.assign(this.params,params);}}
for(const [name,path] of [['SourceManagementPage','features/source/SourceManagementPage.ets'],['SourceToolsPage','features/source/SourceToolsPage.ets']]){
 syntax.componentCollection.customComponents.add(name);syntax.propCollection.set(name,new Set([...read(path).matchAll(/@Prop(?:\s+@Watch\([^)]*\))?\s+(\w+)\s*:/g)].map(m=>m[1])));
}
// The full decorated consumer is compiled. Only its existing recovery surface
// is executed here; auxiliary controls use their actual source metadata.
for(const name of ['ReaderSelectPanel','ReaderSearchField','ReaderSelect','ReaderToggle','StatusBadge','ReaderButton','ReaderFormField','PageBackBar']){
 const text=read('features/common/'+name+'.ets');syntax.componentCollection.customComponents.add(name);
 syntax.propCollection.set(name,new Set([...text.matchAll(/@Prop(?:\s+@Watch\([^)]*\))?\s+(\w+)\s*:/g)].map(m=>m[1])));
 syntax.builderParamObjectCollection.set(name,new Set([...text.matchAll(/@BuilderParam\s+(\w+)/g)].map(m=>m[1])));
}
const methods=['sourceManagementContent','sourceManagementSurface','bindSourceManagement','retireSourceManagementPresentation','isCurrentSourceManagement','isCurrentRuntime','registerTemporaryBackBridge',
 'sourceToolsContent','sourceToolsSurface','getSourceToolsOrchestrator','isCurrentSourceToolsPresentation','requestSourceDelete','showIndexAlert'];
function hostField(index,SourceHost){const text=read('pages/Index.ets'),start=text.indexOf('  private sourceHost:'),end=text.indexOf('\n  );',start)+6;
 const expression=text.slice(text.indexOf('=',start)+1,end).trim().replace(/;$/,'');
 return new Function('SourceHost',stripTypeScriptTypes('const host='+expression+';')+'return host;').call(index,SourceHost);
}
function index(f,kind='source',instance=1){
 const probe=createReaderBuilderProbe(read('pages/Index.ets'),methods,{ReaderRuntimeOwner:f.Runtime,SourceHost:f.SourceHost,SourceToolsOrchestrator:f.SourceToolsOrchestrator,
  SourceManagementPage:Child,SourceToolsPage:Child,deviceInfo:{deviceType:'phone'},ReaderNativeAlertOwner,readerAppColor}),i=probe.owner;
 Object.assign(i,{route:kind,mountedRuntimeOwner:f.runtime,shelfReceiptRetired:false,detailShelfAdmissionMount:1,navigationGeneration:1,
  rssInstanceIdentity:instance,sourceToolsInstanceIdentity:instance,sourcePresentationIdentity:'',sourceToolsPresentationIdentity:'',sourceToolsOrchestrator:undefined,
  sourceSources:[],sourceStatusKind:'idle',sourceStatusMessage:'',sourceOperation:{action:'load',sourceId:''},settingsSnapshot:{reduceMotion:false}});
 const alerts=[];i.nativeAlertOwner=new ReaderNativeAlertOwner();i.getUIContext=()=>({showAlertDialog:options=>alerts.push(options)});
 i.sourceHost=hostField(i,f.SourceHost);
 let host,domainHost;
 if(kind==='source'){assert.equal(i.bindSourceManagement(),true);host=i.sourceHost;domainHost=f.SourceOrchestrator.forRuntime(f.runtime);}
 else {host=i.getSourceToolsOrchestrator();domainHost=host;}
 const builder=kind==='source'?'sourceManagementContent':'sourceToolsContent';let rendered=false;
 const params=()=>{if(rendered)i.replay();else{i[builder]();rendered=true;}return [...i.children.values()].filter(c=>c instanceof Child).at(-1).params;};
 return{i,host,params,alerts,open(){if(kind==='source')host.open(i.sourcePresentationIdentity);else host.open([]);},
  async settled(){if(kind==='source')await domainHost.operationChain;else await domainHost.operationTail;}};
}
function page(f,x,kind='source'){
 const sdk=boundedSurfaceSdk({allowEmptyBranchAdmission:true}),path=kind==='source'?'features/source/SourceManagementPage.ets':'features/source/SourceToolsPage.ets',text=read(path);
 const prelude=text.slice(0,text.indexOf('@Component'))+'\nexport const pageClasses={'+(kind==='source'?'SourceListDataSource,GROUP_FILTER_WIDTH,GROUP_SELECT_WIDTH':'SourceToolListDataSource,SourceCheckResultDataSource,SourceDebugLogDataSource')+'};';
 const classes=compile(path,'pageClasses',{},true,prelude),empty=compile('features/source/SourceToolsOrchestrator.ets','EMPTY_SOURCE_TOOLS_SNAPSHOT',{},true);
 const child=sdk.consumer(text,boundedMembers(text),{...classes,sourceTemporaryGeneration:0,EMPTY_SOURCE_TOOLS_SNAPSHOT:empty,readerRecoveryView,ReaderNativeAlertOwner,
  registerReaderFonts:()=>{}},x.params());
 child.aboutToAppear();const feedback=()=>{if(kind==='source')child.originalRecovery();else{child.statusCard();child.recoveryAction();}};feedback();
 const action=label=>{const actor=sdk.walk(child).filter(c=>c instanceof sdk.deps.ReaderRecoveryAction&&c.label===label).at(-1);assert.ok(actor,label);
  return{actor,click:[...actor.nodes.values()].find(n=>n.type==='Text'&&n.onClick).onClick};};
 return{child,sdk,action,nodes:()=>sdk.nodes(child),update(){child.updateStateVars(x.params());sdk.properties.flush();child.replay();feedback();sdk.properties.flush();}};
}
async function pending(moment){const f=await fixture();await f.source.importBookSourceDocument(document,f.current);f.options[moment]='rules.mutation.apply';
 await assert.rejects(f.source.updateSource(id,{enabled:false},f.current));const original=JSON.parse(f.disk());f.retire();return{f:await fixture(f),original};}
let groups=0;
for(const moment of ['beforeMethod','afterMethod']){
 const {f,original}=await pending(moment),x=index(f);x.open();await x.settled();const p=page(f,x);
 assert.equal(x.i.sourceOperation.original.blocked,true);assert.equal(f.writes().length,0);assert.ok(p.nodes().some(n=>n.create===x.i.sourceOperation.original.message));
 const label=x.i.sourceOperation.original.confirmation==='confirmed'?'继续原清理':'继续原操作',read=p.action('核对原操作回执'),next=p.action(label);
 read.click();await x.settled();assert.equal(f.writes().length,0);assert.equal(f.cleanupCalls.length,0,'pure reconciliation never runs cookie cleanup');p.update();
 next.click();await x.settled();assert.equal(f.writes().length,0,'actual retained Page props cannot upgrade prior physical recovery generation');
 p.action(label).click();p.action(label).click();await x.settled();assert.equal(f.writes().length,moment==='beforeMethod'?1:0);
 if(f.writes().length){assert.equal(f.writes()[0].params.operationId,original.operationId);assert.deepEqual(f.writes()[0].params.mutation,original.mutation);}
 assert.deepEqual(f.cleanupCalls,[id]);assert.equal(f.disk(),'');assert.equal(x.i.sourceOperation.original.blocked,false);groups++;
}
for(const retired of ['nav','mount','route','runtime','unmount']){
 const {f}=await pending('beforeMethod'),x=index(f);x.open();await x.settled();const p=page(f,x),old=p.action('继续原操作');
 if(retired==='nav')x.i.navigationGeneration++;
 if(retired==='mount')x.i.detailShelfAdmissionMount++;
 if(retired==='route')x.i.route='bookshelf';
 if(retired==='runtime')f.retire();
 if(retired==='unmount')p.child.aboutToDisappear();
 const count=f.calls.length;old.click();await x.settled();assert.equal(f.calls.length,count);assert.notEqual(f.disk(),'');groups++;
}
// Same Runtime, same navigation and both old/new Index still physically alive.
// Only the successor attach owns the delivery lease; no page getter steals it.
{
 const {f}=await pending('beforeMethod'),a=index(f,'source',1);a.open();await a.settled();const pa=page(f,a),old=pa.action('继续原操作');
 const b=index(f,'source',2);assert.equal(b.i.sourceOperation.original.operationId,a.i.sourceOperation.original.operationId,'first synchronous DTO already observes true Host binding');
 assert.equal(b.i.sourceOperation.original.blocked,true);const pb=page(f,b),count=f.calls.length;
 old.click();await a.settled();assert.equal(f.calls.length,count);assert.equal(a.i.bindSourceManagement(),false,'alive old getter cannot steal successor exact lease');
 a.i.retireSourceManagementPresentation();assert.equal(b.host.isPresentationCurrent(f.runtime,b.i.sourcePresentationIdentity),true,'late old detach does not erase successor');
 pb.action('继续原操作').click();await b.settled();assert.equal(f.writes().length,1);groups++;
}
{
 const f=await fixture();await f.source.importBookSourceDocument(document,f.current);const a=index(f,'source',1);a.open();await a.settled();
 const gate=deferred();f.options.pauseMethod='rules.mutation.apply';f.options.gate=gate;a.params().onToggleSource(id,false);
 await until(()=>f.calls.some(c=>c.method==='rules.mutation.apply'&&c.params.mutation.method==='source.update'));
 const b=index(f,'source',2);assert.deepEqual(b.i.sourceOperation,a.i.sourceOperation,'accepted operation first DTO survives sameRuntime remount before ACK');
 const count=f.writes().length;a.params().onToggleSource(id,true);assert.equal(f.writes().length,count);gate.resolve();await b.settled();
 b.open();await b.settled();assert.equal(b.i.sourceSources[0].enabled,false);assert.equal(f.writes().length,count);groups++;
}
{
 const f=await fixture();await f.source.importBookSourceDocument(document,f.current);const x=index(f);x.open();await x.settled();f.options.cookieFailure=true;
 x.params().onToggleSource(id,false);await x.settled();const p=page(f,x),writes=f.writes().length;
 assert.equal(x.i.sourceOperation.original.confirmation,'confirmed');assert.equal(x.i.sourceOperation.original.writeStage,'cleanup');
 p.action('核对原操作回执').click();await x.settled();assert.equal(f.writes().length,writes);assert.equal(x.i.sourceOperation.original.blocked,true);
 p.update();f.options.cookieFailure=false;p.action('继续原清理').click();await x.settled();assert.equal(f.writes().length,writes);assert.equal(f.disk(),'');groups++;
}
// Tools physical callbacks must carry their original exact attachment even
// while the original Index stays mounted at the same route/navigation.
{
 const {f}=await pending('beforeMethod'),a=index(f,'sourceTools',1);a.open();await a.settled();const pa=page(f,a,'tools'),old=pa.action('继续原操作'),original=a.i.sourceToolsSnapshot.original;
 const b=index(f,'sourceTools',2);assert.equal(b.host,a.host);assert.equal(b.i.sourceToolsSnapshot.original.operationId,original.operationId,'Tools successor gets original first DTO');
 const pb=page(f,b,'tools'),before=f.calls.length;old.click();await a.settled();assert.equal(f.calls.length,before);
 assert.equal(a.i.getSourceToolsOrchestrator(),b.host);assert.equal(b.host.isPresentationCurrent(b.i.sourceToolsPresentationIdentity),true,'alive old getter does not reattach');
 a.host.detachPresentation(a.i.sourceToolsPresentationIdentity);assert.equal(b.host.isPresentationCurrent(b.i.sourceToolsPresentationIdentity),true);
 pb.action('继续原操作').click();await b.settled();assert.equal(f.writes().length,1);assert.equal(f.disk(),'');groups++;
}
{
 const f=await fixture();f.options.beforeMethod='rules.mutation.apply';await assert.rejects(f.save());f.retire();
 const cold=await fixture(f),x=index(cold);x.open();await x.settled();const p=page(cold,x);
 assert.equal(x.i.sourceOperation.original.blocked,true);assert.equal(x.i.sourceOperation.original.canRetryOriginal,false);
 assert.equal(p.sdk.walk(p.child).some(c=>c instanceof p.sdk.deps.ReaderRecoveryAction&&c.label==='继续原操作'),false,'foreign rule receipt has no Source continuation');
 p.action('核对原操作回执').click();await x.settled();assert.equal(cold.writes().length,0);assert.equal(cold.cleanupCalls.length,0);groups++;
}
// Guard-removal negative control: Runtime/nav/mount/host equality alone is
// insufficient when both alive Index instances share the exact domain owner.
{
 const {f}=await pending('beforeMethod'),a=index(f,'sourceTools',1);a.open();await a.settled();
 const old=page(f,a,'tools').action('继续原操作'),b=index(f,'sourceTools',2);
 a.i.isCurrentSourceToolsPresentation=function(g,o,m,h){return !this.shelfReceiptRetired&&this.route==='sourceTools'&&
  g===this.navigationGeneration&&m===this.detailShelfAdmissionMount&&o===this.mountedRuntimeOwner&&f.Runtime.isCurrent(o)&&h===this.sourceToolsOrchestrator&&h.owns(o);};
 old.click();await b.settled();assert.equal(f.writes().length,1,'negative control demonstrates old physical action borrows successor without exact attachment guard');groups++;
}
{
 const f=await fixture();await f.source.importBookSourceDocument(document,f.current);const a=index(f,'sourceTools',1);a.open();await a.settled();a.host.setSelection([id]);
 a.params().onDeleteSelected([id]);const old=a.alerts.at(-1);assert.ok(old?.secondaryButton);
 const b=index(f,'sourceTools',2),writes=f.writes().length;old.secondaryButton.action();await b.settled();
 assert.equal(f.writes().length,writes,'old native confirmation cannot borrow successor Tools lease at same Runtime/nav');
 b.params().onDeleteSelected([id]);const live=b.alerts.at(-1);assert.ok(live?.secondaryButton);live.secondaryButton.action();await b.settled();
 assert.equal(f.writes().length,writes+1);assert.equal(b.i.sourceToolsSnapshot.sources.length,0);groups++;
}
console.log(`PASS Source cold Core/Atomic/Gateway/owner→actual Index→decorated Page/shared recovery: ${groups} groups; original identity, pure query, explicit cleanup, sameRuntime first DTO and alive-old physical guards`);
