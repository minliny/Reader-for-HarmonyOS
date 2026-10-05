import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {readableAdmissionFixture,readableDeferred as deferred,readableTick as tick,readableSource as source,ReaderCoreRequestError} from './lib/bookshelf-readable-admission-probe.mjs';
import {localBookDetailSdk} from './lib/local-book-detail-sdk-probe.mjs';
import {createReaderBuilderProbe} from './lib/reader-control-builder-probe.mjs';
const {BookAcquisitionCoordinator}=await import('../entry/src/main/ets/app/BookAcquisitionCoordinator.ts');
const {BookRequestScheduler}=await import('../entry/src/main/ets/app/BookRequestScheduler.ts');
const until=async test=>{for(let i=0;i<200;i++){if(test())return;await tick();}assert.fail('readable admission did not settle');};
const ack=(id='b')=>({data:{sourceId:'s',bookId:id,created:true,addedAt:1}});
const saved=(id='b')=>({sourceId:'s',bookId:id,title:'书',author:'作者',addedAt:1,sortIndex:0});
for(const outcome of ['ack','generic-failure','duplicate','malformed']){
 const gate=deferred();const f=readableAdmissionFixture({add:()=>gate.promise});
 f.page.addDetailBook();f.page.addDetailBook();assert.equal(f.calls.filter(c=>c[0]==='add').length,1);
 assert.equal(f.snapshot().adding,true);assert.equal(f.page.shelfOperation.removalKey,'','adding never blocks removal for another book');
 if(outcome==='generic-failure')gate.reject(Error('lost ACK'));
 else if(outcome==='duplicate')gate.reject(new ReaderCoreRequestError({error:{code:'BOOK_ALREADY_ON_SHELF',message:'exists'}}));
 else gate.resolve(outcome==='malformed'?ack('other'):ack());await tick();
 const state=f.snapshot();
 if(outcome==='ack'){assert.equal(state.confirmation,'confirmed');assert.equal(f.page.detailInBookshelf,true);assert.equal(f.page.refreshes,1);assert.equal(state.adding,false);}
 else if(outcome==='duplicate'){assert.equal(state.confirmation,'rejected');assert.equal(f.page.detailInBookshelf,false);assert.equal(f.page.memberships,1);assert.match(state.message,/已加入书架/);}
 else{assert.equal(state.confirmation,'unknown');assert.equal(state.receipt,undefined);assert.equal(f.page.detailInBookshelf,false);f.page.addDetailBook();assert.equal(f.calls.filter(c=>c[0]==='add').length,1,'unknown cannot replay preparation');}
}
for(const stale of ['nav','book','mutated-book','route','unmount','unset','replacement']) for(const rejected of [false,true]){
 const gate=deferred();const f=readableAdmissionFixture({add:()=>gate.promise});f.page.addDetailBook();
 if(stale==='nav')f.page.navigationGeneration++;
 if(stale==='book')f.page.detailBook=saved('next');
 if(stale==='mutated-book')f.page.detailBook.bookId='next';
 if(stale==='route')f.page.route='settings';
 if(stale==='unmount'){f.page.shelfReceiptRetired=true;f.page.bookshelfHost.detachReadablePresentation();}
 if(stale==='unset')f.setRuntime(undefined);
 if(stale==='replacement')f.setRuntime({});
 rejected?gate.reject(Error('late failure')):gate.resolve(ack());await tick();
 assert.equal(f.page.detailInBookshelf,false);assert.equal(f.page.refreshes,0);assert.equal(f.page.notices?.length??0,0);
 const owner=f.page.bookshelfHost.readable(f.runtime);
 assert.equal(owner.find('s','b').confirmation,rejected?'unknown':'confirmed','accepted work settles in captured owner');
}
for(const read of ['missing','saved','failed','stale']){
 const add=deferred(),cancel=deferred(),lookup=deferred();const f=readableAdmissionFixture({add:()=>add.promise,cancel:()=>cancel.promise,lookup:()=>lookup.promise});
 f.page.addDetailBook();f.page.cancelDetailBookAddition();f.page.cancelDetailBookAddition();assert.equal(f.calls.filter(c=>c[0]==='cancel').length,1);
 assert.equal(f.snapshot().cancelling,true);cancel.resolve();await tick();
 assert.equal(f.calls.filter(c=>c[0]==='bookshelf.get').length,1);
 if(read==='stale')f.page.navigationGeneration++;
 if(read==='failed')lookup.reject(Error('get unavailable'));else lookup.resolve(read==='saved'?saved():null);await tick();
 const beforeAck=f.page.bookshelfHost.readable(f.runtime).find('s','b');assert.equal(beforeAck.receipt,undefined,'get cannot create add ACK');
 if(read==='saved'){assert.equal(beforeAck.membership,true);assert.equal(f.page.detailInBookshelf,true);assert.equal(beforeAck.confirmation,'none');}
 if(read==='missing')assert.equal(beforeAck.message,'已取消加入书架');
 if(read==='failed'){assert.equal(beforeAck.adding,true);assert.match(beforeAck.message,/取消状态未确认/);}
 if(read==='stale')assert.equal(f.page.detailInBookshelf,false);
 add.reject(Error('cancelled body'));await tick();
 assert.equal(f.calls.filter(c=>c[0]==='add').length,1);assert.equal(f.calls.filter(c=>c[0]==='cancel').length,1);
}
{
 const add=deferred(),queued=deferred();const f=readableAdmissionFixture({add:()=>add.promise});
 const original=f.runtime.request;let dispatched=0,guard;
 f.runtime.request=async(method,params,options)=>{
  if(method==='bookshelf.get'){guard=options.shouldCancel;await queued.promise;if(guard())throw Error('queued read retired');dispatched++;}
  return original(method,params,options);
 };
 f.page.addDetailBook();f.page.cancelDetailBookAddition();await until(()=>guard!==undefined);
 assert.equal(guard(),false);f.page.navigationGeneration++;assert.equal(guard(),true);queued.resolve();add.reject(Error('cancelled'));await tick();
 assert.equal(dispatched,0);assert.equal(f.page.detailInBookshelf,false);assert.equal(f.snapshot().membership,undefined,'withdrawn get cannot become an absent-book fact');
}
{
 const add=deferred();const f=readableAdmissionFixture({add:()=>add.promise});f.page.addDetailBook();
 const owner=f.page.bookshelfHost.readable(f.runtime);f.page.shelfReceiptRetired=true;f.page.bookshelfHost.detachReadablePresentation();
 const next=f.rebuild();assert.equal(next.page.bookshelfHost.readable(f.runtime),owner);assert.equal(next.page.detailReadableAdmission(next.page.detailBook).adding,true);
 next.page.addDetailBook();assert.equal(f.calls.filter(c=>c[0]==='add').length,1);add.resolve(ack());await tick();
 assert.equal(f.page.detailInBookshelf,false,'old UI lease stays retired');assert.equal(next.page.detailReadableAdmission(next.page.detailBook).receipt.bookId,'b');
 assert.equal(next.page.detailInBookshelf,false,'retained receipt does not bypass new detail membership read');
}
{
 const gateA=deferred(),gateB=deferred();const f=readableAdmissionFixture({add:p=>p.bookId==='b'?gateA.promise:gateB.promise});
 f.page.addDetailBook();const book=saved('other');f.page.detailBook=book;f.page.remoteReadingSession={identity:book,book};f.page.navigationGeneration++;f.page.addDetailBook();
 gateA.resolve(ack());await tick();assert.equal(f.page.detailInBookshelf,false);assert.equal(f.page.detailReadableAdmission(book).adding,true);
 gateB.resolve(ack('other'));await tick();assert.equal(f.page.detailInBookshelf,true);assert.equal(f.page.readableAdmissions.length,2);
}
// Reuse the existing Core request fixture, then execute the actual Coordinator,
// actual typed Gateway, Host field, Index intent and SDK physical button.
const preparation=readFileSync(new URL('./test-added-book-preparation.mjs',import.meta.url),'utf8');
const prefix=preparation.slice(preparation.indexOf('const book ='),preparation.indexOf('// The confirmed receipt'));
const fixture=new Function('assert','BookAcquisitionCoordinator','BookRequestScheduler','deferred','tick',prefix+'return fixture;')(assert,BookAcquisitionCoordinator,BookRequestScheduler,deferred,tick);
function detailSdk(f){
 const detailSource=source('features/bookshelf/LocalBookDetail.ets');
 class Child{constructor(owner,params,_storage,id){Object.assign(this,{owner,params,id});}updateStateVars(params){for(const [key,value]of Object.entries(params))if(key!=='onRemove'&&key!=='onCancelAdd')this.params[key]=value;}}
 const parent=createReaderBuilderProbe(source('pages/Index.ets'),['detailContent','detailSurface','externalDirectory','isCurrentDetailPresentation'],{LocalBookDetail:Child,BookDirectoryPage:Child,LOCAL_SOURCE_ID:'local'},{childSources:{LocalBookDetail:detailSource,BookDirectoryPage:source('features/bookshelf/BookDirectoryPage.ets')}}).owner;
 Object.assign(parent,f.page,{detailToc:[],remoteContentVerdict:'readable',remoteContentVerdictLabel:()=>'',readingSessionActive:false,sourceSwitchVisible:false,pendingSourceSwitch:undefined,offlineMutationActiveKey:'',directoryReturnTarget:'detail',hasUnknownShelfWrite:()=>false,
  detailReadableAdmission:book=>f.page.detailReadableAdmission(book),detailShelfAdmissionIdentity:()=>f.page.detailShelfAdmissionIdentity(),isCurrentDetailShelfAdmission:id=>f.page.isCurrentDetailShelfAdmission(id),requestDetailShelfMutation:()=>f.page.requestDetailShelfMutation(),cancelDetailBookAddition:()=>f.page.cancelDetailBookAddition(),detailBookKey:book=>f.page.detailBookKey(book)});
 parent.detailContent();const child=[...parent.children.values()][0];
 const probe=localBookDetailSdk({}, {allowEmptyBranchAdmission:true,initialParams:child.params});
 Object.assign(probe.owner,{appThemeScheme:'day',viewportWidth:390});probe.owner.actionArea();
 const actions=[...probe.owner.nodes.values()].filter(n=>n.type==='Text'&&typeof n.onClick==='function');
 assert.equal(actions.length,2);assert.ok(actions.every(n=>n.height===48&&n.borderRadius===16));
 assert.equal(actions[1].width,94);assert.deepEqual(actions.map(n=>n.fontSize),[14,12]);
 const dock=[...probe.owner.nodes.values()].find(n=>n.type==='Stack');
 assert.equal(dock.height,68);assert.equal(dock.borderRadius,24);
 return {parent,child,actor:probe.owner,hit:actions[1].onClick};
}
{
 const core=fixture(),body=deferred();core.gates.set('chapter.content:b',body);
 const runtime={bookAcquisitions:()=>core.runtime,request:(...args)=>core.runtime.request(...args)};
 const f=readableAdmissionFixture({runtime});const sdk=detailSdk(f);sdk.hit();await until(()=>core.calls.some(c=>c.method==='chapter.content'));
 assert.equal(f.snapshot().adding,true);assert.equal(core.store.shelf.has('b'),false);assert.equal(core.store.intents.get('b').reason,'add');
 body.resolve();await until(()=>f.snapshot().receipt!==undefined);
 assert.equal(f.page.detailInBookshelf,true);assert.equal(f.snapshot().receipt.created,true);
 assert.equal(core.calls.filter(c=>c.method==='bookshelf.add').length,1);assert.ok(core.store.derived.has('b:1'));assert.ok(!core.calls.some(c=>c.method.startsWith('reading.progress')));
 core.runtime.close();
}
{
 const core=fixture(),body=deferred();core.gates.set('chapter.content:b',body);
 const runtime={bookAcquisitions:()=>core.runtime,request:(...args)=>core.runtime.request(...args)};
 const f=readableAdmissionFixture({runtime});const sdk=detailSdk(f);sdk.hit();await until(()=>core.calls.some(c=>c.method==='chapter.content'));
 const oldCount=sdk.actor.observers.length; sdk.actor.updateStateVars({...sdk.child.params,adding:true});sdk.actor.replay();assert.equal(sdk.actor.observers.length,oldCount,'phase update retains both original actors');sdk.hit();
 await until(()=>f.snapshot().membership!==undefined&&!f.snapshot().cancelling);
 assert.equal(f.snapshot().membership,false);assert.equal(f.snapshot().receipt,undefined);assert.equal(f.snapshot().confirmation,'none');
 assert.equal(core.store.intents.get('b').state,'cancelled');assert.ok(core.calls.some(c=>c.method==='bookshelf.get'));
 body.resolve();await until(()=>!f.snapshot().adding);
 assert.equal(core.calls.filter(c=>c.method==='bookshelf.add').length,0);core.runtime.close();
}
{
 const gates=[];const f=readableAdmissionFixture({add:()=>{const g=deferred();gates.push(g);return g.promise;}});
 const owner=f.page.bookshelfHost.readable(f.runtime);const tasks=[];
 for(let index=0;index<17;index++)tasks.push(owner.add({sourceId:'s',bookId:'b'+index,title:'书',author:'作者'},()=>true,()=>{}));
 assert.equal(gates.length,16,'finite accepted-task capacity cannot grow without bound');assert.match(owner.find('s','b16').message,/稍后重试/);
 gates.forEach((g,index)=>g.resolve(ack('b'+index)));await Promise.all(tasks);
}
{
 const f=readableAdmissionFixture();let admitted=true;const owner=f.page.bookshelfHost.readable(f.runtime);
 owner.subscribe(()=>{admitted=false;throw Error('retired during publication');});await owner.add(saved(),()=>admitted,()=>assert.fail('retired publication'));
 assert.equal(f.calls.length,0,'withdrawn intent cannot dispatch after a synchronous publication');assert.equal(owner.find('s','b').adding,false);
}
{
 const gate=deferred();const f=readableAdmissionFixture({add:()=>gate.promise});const sdk=detailSdk(f);const old=sdk.hit;
 f.page.detailBook=saved('next');f.page.navigationGeneration++;old();assert.equal(f.calls.length,0,'old physical actor cannot add the next book');
 const originalCount=sdk.actor.observers.length;sdk.actor.updateStateVars({...sdk.child.params,admissionIdentity:f.page.detailShelfAdmissionIdentity(),book:f.page.detailBook});sdk.actor.replay();assert.equal(sdk.actor.observers.length,originalCount+1,'only the keyed secondary Text actor is created');old();assert.equal(f.calls.length,0,'V1 Prop update cannot promote immutable old button identity');
 f.page.remoteReadingSession={identity:f.page.detailBook,book:f.page.detailBook};
 const current=[...sdk.actor.nodes.values()].filter(n=>n.type==='Text'&&typeof n.onClick==='function').at(-1);current.onClick();assert.equal(f.calls.filter(c=>c[0]==='add').length,1);
 gate.resolve(ack('next'));await tick();
}
{
 const f=readableAdmissionFixture();const sdk=detailSdk(f);f.page.detailBook=saved('next');f.page.remoteReadingSession={identity:f.page.detailBook,book:f.page.detailBook};f.page.navigationGeneration++;
 f.page.isCurrentDetailShelfAdmission=()=>true;sdk.hit();await tick();assert.equal(f.calls.filter(c=>c[0]==='add').length,1,'negative control: removing captured identity guard mutates successor');
}
console.log('PASS: readable add/cancel actual Coordinator→typed Gateway→Host→Index→SDK, receipt/member distinction, exact Runtime/navigation, same-runtime reconstruction, unknown barrier and retained physical actor');
