import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

export const CONTRACT_CASES = {
  "owner-interleavings": {
    "description": "Actual readable Owner/Index add/cancel/readback order, exact Runtime and reconstructed owner; fake Core ports",
    "resources": []
  },
  "detail-sdk-identity": {
    "description": "Actual Index→detail SDK immutable callbacks, metadata-first and operation barriers; no fixed geometry",
    "resources": []
  },
  "cold-manga-first-image": {
    "description": "Actual typed DTO/Coordinator/MangaAdmission→SDK first image admission with fake Core and image ports",
    "resources": []
  },
  "cold-novel-preparation": {
    "description": "Actual Coordinator/typed Gateway→SDK body preparation and cancellation, shared pure Core fixture",
    "resources": []
  }
};

async function case_owner_interleavings() {
const { default: assert } = await import('node:assert/strict');
const {readFileSync} = await import('node:fs');
const {readableAdmissionFixture,readableDeferred : deferred,readableTick : tick,readableSource : source,ReaderCoreRequestError} = await import('./lib/bookshelf-readable-admission-probe.mjs');
const {localBookDetailSdk} = await import('./lib/local-book-detail-sdk-probe.mjs');
const {createReaderBuilderProbe} = await import('./lib/reader-control-builder-probe.mjs');
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
// Cancel acknowledgement and shelf observation settle independently of the
// original add's response. Neither ordering may manufacture an add receipt or
// turn the already-confirmed cancellation back into a pending add result.
for(const order of ['cancel-first','add-error-first'])for(const membership of [false,true]){
 const add=deferred(),cancel=deferred(),lookup=deferred();
 const f=readableAdmissionFixture({add:()=>add.promise,cancel:()=>cancel.promise,lookup:()=>lookup.promise});
 f.page.addDetailBook();
 if(order==='add-error-first'){
  add.reject(Error('lost add response'));await tick();assert.equal(f.snapshot().confirmation,'unknown');
 }
 f.page.cancelDetailBookAddition();cancel.resolve();await until(()=>f.calls.some(c=>c[0]==='bookshelf.get'));
 lookup.resolve(membership?saved():null);await until(()=>!f.snapshot().cancelling);
 assert.equal(f.snapshot().confirmation,'none',`${order}: confirmed cancellation has no add acknowledgement`);
 assert.equal(f.snapshot().receipt,undefined,'a matching saved row is membership, never this add acknowledgement');
 assert.equal(f.snapshot().membership,membership);assert.equal(f.page.detailInBookshelf,membership);
 if(!membership)assert.equal(f.page.detailShelfMessage(f.page.detailBook),'已取消加入书架');
 if(order==='cancel-first'){add.reject(Error('late cancelled add response'));await tick();}
 assert.equal(f.snapshot().confirmation,'none',`${order}: late add failure cannot downgrade cancellation`);
 assert.equal(f.snapshot().adding,false);assert.equal(f.snapshot().receipt,undefined);
 assert.equal(f.snapshot().membership,membership);
 assert.equal(f.calls.filter(c=>c[0]==='add').length,1);assert.equal(f.calls.filter(c=>c[0]==='cancel').length,1);
}
for(const failure of ['cancel','readback']){
 const add=deferred();let cancelAttempts=0,readAttempts=0;
 const f=readableAdmissionFixture({add:()=>add.promise,cancel:async()=>{if(++cancelAttempts===1&&failure==='cancel')throw Error('cancel response lost');},
  lookup:async()=>{if(++readAttempts===1&&failure==='readback')throw Error('shelf read failed');return null;}});
 f.page.addDetailBook();add.reject(Error('add response lost'));await tick();
 f.page.cancelDetailBookAddition();await until(()=>!f.snapshot().cancelling);
 assert.equal(f.snapshot().confirmation,'unknown');assert.equal(f.snapshot().adding,true);
 assert.equal(f.snapshot().membership,undefined);assert.equal(f.snapshot().receipt,undefined);
 assert.match(f.snapshot().message,/取消状态未确认，请重试/);
 f.page.cancelDetailBookAddition();await until(()=>!f.snapshot().cancelling);
 assert.equal(f.snapshot().confirmation,'none');assert.equal(f.snapshot().adding,false);
 assert.equal(f.snapshot().membership,false);assert.equal(f.snapshot().receipt,undefined);
 assert.equal(f.page.detailShelfMessage(f.page.detailBook),'已取消加入书架');
 assert.equal(cancelAttempts,2);assert.equal(readAttempts,failure==='cancel'?1:2);
 assert.equal(f.calls.filter(c=>c[0]==='add').length,1,'cancel retry never replays add');
}
for(const ackOrder of ['before-cancel-read','after-cancel-read']){
 const add=deferred(),cancel=deferred();const f=readableAdmissionFixture({add:()=>add.promise,cancel:()=>cancel.promise});
 f.page.addDetailBook();f.page.cancelDetailBookAddition();
 if(ackOrder==='before-cancel-read'){add.resolve(ack());await tick();assert.equal(f.snapshot().confirmation,'confirmed');}
 cancel.resolve();await until(()=>!f.snapshot().cancelling);
 if(ackOrder==='after-cancel-read'){
  assert.equal(f.snapshot().confirmation,'none');assert.equal(f.snapshot().receipt,undefined);
  add.resolve(ack());await tick();
 }
 assert.equal(f.snapshot().confirmation,'confirmed','a real add ACK remains authoritative');
 assert.equal(f.snapshot().receipt.bookId,'b');
 assert.equal(f.snapshot().membership,ackOrder==='after-cancel-read','shelf observation remains distinct from the real add ACK');
 assert.equal(f.calls.filter(c=>c[0]==='add').length,1);
}
{
 const add=deferred(),cancel=deferred();const f=readableAdmissionFixture({add:()=>add.promise,cancel:()=>cancel.promise});
 f.page.addDetailBook();f.page.cancelDetailBookAddition();const owner=f.page.bookshelfHost.readable(f.runtime);
 f.setRuntime({});cancel.resolve();add.reject(Error('retired add response'));await tick();
 assert.equal(owner.find('s','b').confirmation,'unknown','retired cancellation cannot claim confirmation without its current read');
 assert.equal(owner.find('s','b').membership,undefined);assert.equal(f.calls.filter(c=>c[0]==='bookshelf.get').length,0);
 assert.equal(f.page.detailInBookshelf,false);assert.equal(f.page.refreshes,0);assert.equal(f.notices.length,0);
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
 if(read==='missing'||read==='saved'){
  assert.equal(f.snapshot().confirmation,'none','late body failure preserves confirmed cancellation');assert.equal(f.snapshot().receipt,undefined);
  if(read==='missing')assert.equal(f.page.detailShelfMessage(f.page.detailBook),'已取消加入书架');
 }
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

}

async function case_detail_sdk_identity() {
const { default: assert } = await import('node:assert/strict');
const {readFileSync} = await import('node:fs');
const {readableAdmissionFixture,readableDeferred : deferred,readableTick : tick,readableSource : source,ReaderCoreRequestError} = await import('./lib/bookshelf-readable-admission-probe.mjs');
const {localBookDetailSdk} = await import('./lib/local-book-detail-sdk-probe.mjs');
const {createReaderBuilderProbe} = await import('./lib/reader-control-builder-probe.mjs');
const {BookAcquisitionCoordinator}=await import('../entry/src/main/ets/app/BookAcquisitionCoordinator.ts');
const {BookRequestScheduler}=await import('../entry/src/main/ets/app/BookRequestScheduler.ts');
const until=async test=>{for(let i=0;i<200;i++){if(test())return;await tick();}assert.fail('readable admission did not settle');};
const ack=(id='b')=>({data:{sourceId:'s',bookId:id,created:true,addedAt:1}});
const saved=(id='b')=>({sourceId:'s',bookId:id,title:'书',author:'作者',addedAt:1,sortIndex:0});
const {addedBookPreparationCoreFixture}=await import('./lib/added-book-preparation-core-fixture.mjs');
const {fixture}=addedBookPreparationCoreFixture({assert,BookAcquisitionCoordinator,BookRequestScheduler,deferred,tick});
function detailSdk(f){
 const detailSource=source('features/bookshelf/LocalBookDetail.ets');
 class Child{constructor(owner,params,_storage,id){Object.assign(this,{owner,params,id});}updateStateVars(params){for(const [key,value]of Object.entries(params))if(key!=='onRemove'&&key!=='onCancelAdd')this.params[key]=value;}}
 const parent=createReaderBuilderProbe(source('pages/Index.ets'),['detailContent','detailSurface','externalDirectory','isCurrentDetailPresentation'],{LocalBookDetail:Child,BookDirectoryPage:Child,LOCAL_SOURCE_ID:'local'},{childSources:{LocalBookDetail:detailSource,BookDirectoryPage:source('features/bookshelf/BookDirectoryPage.ets')}}).owner;
 Object.assign(parent,f.page,{detailToc:[],remoteContentVerdict:'readable',remoteContentVerdictLabel:()=>'',offlineMutationActiveKey:'',directoryReturnTarget:'detail',hasUnknownShelfWrite:()=>f.page.hasUnknownShelfWrite(),
  detailReadableAdmission:book=>f.page.detailReadableAdmission(book),detailShelfMessage:book=>f.page.detailShelfMessage(book),detailShelfAdmissionIdentity:()=>f.page.detailShelfAdmissionIdentity(),isCurrentDetailShelfAdmission:id=>f.page.isCurrentDetailShelfAdmission(id),requestDetailShelfMutation:()=>f.page.requestDetailShelfMutation(),cancelDetailBookAddition:()=>f.page.cancelDetailBookAddition(),detailBookKey:book=>f.page.detailBookKey(book)});
 parent.detailContent();const child=[...parent.children.values()][0];
 const probe=localBookDetailSdk({}, {allowEmptyBranchAdmission:true,initialParams:child.params});
 Object.assign(probe.owner,{appThemeScheme:'day',viewportWidth:390});probe.owner.actionArea();
 const actions=[...probe.owner.nodes.values()].filter(n=>n.type==='Text'&&typeof n.onClick==='function');
 assert.equal(actions.length,2);
 return {parent,child,actor:probe.owner,button:actions[1],hit:actions[1].onClick};
}
// The real detail first frame can publish metadata before a catalog/session.
// Explicit admission has its own existing durable preparation owner and must
// acknowledge the physical tap without waiting for the detail IO to finish.
{
 const gate=deferred();const f=readableAdmissionFixture({add:()=>gate.promise});
 f.page.remoteReadingSession=undefined;
 const sdk=detailSdk(f);assert.equal(sdk.button.enabled,true);assert.equal(f.page.canRemoveDetailBook(f.page.detailBook),true);
 sdk.hit();assert.equal(f.snapshot().adding,true);assert.equal(f.calls.filter(c=>c[0]==='add').length,1);
 assert.equal(f.page.detailInBookshelf,false,'metadata alone never confirms an add');
 gate.resolve(ack());await tick();assert.equal(f.page.detailInBookshelf,true);assert.equal(f.snapshot().adding,false);
}
{
 const f=readableAdmissionFixture();f.page.remoteReadingSession={identity:{sourceId:'different',bookId:'other'},book:saved('other')};
 const sdk=detailSdk(f);sdk.hit();await tick();assert.equal(f.calls.filter(c=>c[0]==='add').length,0);
 assert.match(f.notices[0]?.[1]??'',/详情已变更/,'a present mismatched session cannot supply metadata or identity');
}
{
 const f=readableAdmissionFixture({book:{...saved(),sourceId:'local'}});f.page.remoteReadingSession=undefined;
 const sdk=detailSdk(f);assert.equal(sdk.button.enabled,false);assert.equal(sdk.button.create,'已移除');
 sdk.hit();f.page.addDetailBook();await tick();assert.equal(f.calls.length,0,'a removed local import cannot be recreated by remote preparation');
}
for(const rejected of [false,true]){
 const gate=deferred();const f=readableAdmissionFixture({add:()=>gate.promise});f.page.remoteReadingSession=undefined;
 const sdk=detailSdk(f);sdk.hit();assert.equal(f.snapshot().adding,true);
 f.page.detailBook=saved('successor');f.page.navigationGeneration++;sdk.hit();
 assert.equal(f.calls.filter(c=>c[0]==='add').length,1,'old metadata-only physical callback cannot mutate the successor');
 rejected?gate.reject(Error('old metadata preparation failed')):gate.resolve(ack());await tick();
 assert.equal(f.page.detailInBookshelf,false);assert.equal(f.page.refreshes,0);assert.equal(f.notices.length,0);
 assert.equal(f.page.bookshelfHost.readable(f.runtime).find('s','b').confirmation,rejected?'unknown':'confirmed');
 assert.equal(f.page.detailReadableAdmission(f.page.detailBook).key,'','old receipt remains with its original exact book');
}
for(const barrier of ['busy','unknown','reader','source-switch','offline']) {
 const f=readableAdmissionFixture();
 if(barrier==='busy')f.page.shelfOperation.busy=true;
 if(barrier==='unknown'){f.page.shelfOperationOwner=f.runtime;f.page.shelfOperation.receipt={receipt:{confirmation:'unknown'}};}
 if(barrier==='reader')f.page.readingSessionActive=true;
 if(barrier==='source-switch')f.page.sourceSwitchVisible=true;
 if(barrier==='offline')f.page.offlineOperationActive=true;
 const sdk=detailSdk(f);assert.equal(f.page.canRemoveDetailBook(f.page.detailBook),false,barrier);
 assert.equal(sdk.button.enabled,false,`${barrier}: presentation and actual operation gate agree`);
 sdk.hit();await tick();assert.equal(f.calls.filter(c=>c[0]==='add').length,0);
}
{
 const gate=deferred();const f=readableAdmissionFixture({add:()=>gate.promise});const sdk=detailSdk(f);const old=sdk.hit;
 f.page.detailBook=saved('next');f.page.navigationGeneration++;old();assert.equal(f.calls.length,0,'old physical actor cannot add the next book');
 const originalCount=sdk.actor.observers.length;sdk.actor.updateStateVars({...sdk.child.params,admissionIdentity:f.page.detailShelfAdmissionIdentity(),book:f.page.detailBook});sdk.actor.replay();
 assert.equal(sdk.actor.observers.length,originalCount+3,'only the keyed secondary action and its native busy wrapper are created');
 assert.deepEqual([...sdk.actor.nodes.values()].filter(node=>node.id>=originalCount).map(node=>node.type),['Stack','Text','If']);
 old();assert.equal(f.calls.length,0,'V1 Prop update cannot promote immutable old button identity');
 f.page.remoteReadingSession={identity:f.page.detailBook,book:f.page.detailBook};
 const current=[...sdk.actor.nodes.values()].filter(n=>n.type==='Text'&&typeof n.onClick==='function').at(-1);current.onClick();assert.equal(f.calls.filter(c=>c[0]==='add').length,1);
 gate.resolve(ack('next'));await tick();
}
{
 const f=readableAdmissionFixture();const sdk=detailSdk(f);f.page.detailBook=saved('next');f.page.remoteReadingSession={identity:f.page.detailBook,book:f.page.detailBook};f.page.navigationGeneration++;
 f.page.isCurrentDetailShelfAdmission=()=>true;sdk.hit();await tick();assert.equal(f.calls.filter(c=>c[0]==='add').length,1,'negative control: removing captured identity guard mutates successor');
}

}

async function case_cold_manga_first_image() {
const { default: assert } = await import('node:assert/strict');
const {readFileSync} = await import('node:fs');
const {readableAdmissionFixture,readableDeferred : deferred,readableTick : tick,readableSource : source,ReaderCoreRequestError} = await import('./lib/bookshelf-readable-admission-probe.mjs');
const {localBookDetailSdk} = await import('./lib/local-book-detail-sdk-probe.mjs');
const {createReaderBuilderProbe} = await import('./lib/reader-control-builder-probe.mjs');
const {BookAcquisitionCoordinator}=await import('../entry/src/main/ets/app/BookAcquisitionCoordinator.ts');
const {BookRequestScheduler}=await import('../entry/src/main/ets/app/BookRequestScheduler.ts');
const until=async test=>{for(let i=0;i<200;i++){if(test())return;await tick();}assert.fail('readable admission did not settle');};
const ack=(id='b')=>({data:{sourceId:'s',bookId:id,created:true,addedAt:1}});
const saved=(id='b')=>({sourceId:'s',bookId:id,title:'书',author:'作者',addedAt:1,sortIndex:0});
const {addedBookPreparationCoreFixture}=await import('./lib/added-book-preparation-core-fixture.mjs');
const {fixture}=addedBookPreparationCoreFixture({assert,BookAcquisitionCoordinator,BookRequestScheduler,deferred,tick});
function detailSdk(f){
 const detailSource=source('features/bookshelf/LocalBookDetail.ets');
 class Child{constructor(owner,params,_storage,id){Object.assign(this,{owner,params,id});}updateStateVars(params){for(const [key,value]of Object.entries(params))if(key!=='onRemove'&&key!=='onCancelAdd')this.params[key]=value;}}
 const parent=createReaderBuilderProbe(source('pages/Index.ets'),['detailContent','detailSurface','externalDirectory','isCurrentDetailPresentation'],{LocalBookDetail:Child,BookDirectoryPage:Child,LOCAL_SOURCE_ID:'local'},{childSources:{LocalBookDetail:detailSource,BookDirectoryPage:source('features/bookshelf/BookDirectoryPage.ets')}}).owner;
 Object.assign(parent,f.page,{detailToc:[],remoteContentVerdict:'readable',remoteContentVerdictLabel:()=>'',offlineMutationActiveKey:'',directoryReturnTarget:'detail',hasUnknownShelfWrite:()=>f.page.hasUnknownShelfWrite(),
  detailReadableAdmission:book=>f.page.detailReadableAdmission(book),detailShelfMessage:book=>f.page.detailShelfMessage(book),detailShelfAdmissionIdentity:()=>f.page.detailShelfAdmissionIdentity(),isCurrentDetailShelfAdmission:id=>f.page.isCurrentDetailShelfAdmission(id),requestDetailShelfMutation:()=>f.page.requestDetailShelfMutation(),cancelDetailBookAddition:()=>f.page.cancelDetailBookAddition(),detailBookKey:book=>f.page.detailBookKey(book)});
 parent.detailContent();const child=[...parent.children.values()][0];
 const probe=localBookDetailSdk({}, {allowEmptyBranchAdmission:true,initialParams:child.params});
 Object.assign(probe.owner,{appThemeScheme:'day',viewportWidth:390});probe.owner.actionArea();
 const actions=[...probe.owner.nodes.values()].filter(n=>n.type==='Text'&&typeof n.onClick==='function');
 assert.equal(actions.length,2);
 return {parent,child,actor:probe.owner,button:actions[1],hit:actions[1].onClick};
}
// No warm catalog exists for this comic. Run the real Core DTO decoder,
// Coordinator and MangaAdmissionGateway first-image path all the way to the
// actual physical detail action; a copied UI session cannot substitute for it.
for(const imageResult of ['ready','failed']){
 const calls=[],intents=new Map(),shelf=new Map(),released=[],imageGate=deferred();
 const comic={sourceId:'s',bookId:'b',title:'书',author:'作者',contentKind:'manga'};
 const pageId=`mp1:${'a'.repeat(64)}`;
 const manifest={chapter:{sourceId:'s',bookId:'b',chapterId:'/chapter'},sourceRuleVersion:'v1',
  manifestVersion:'manifest',decodeRevision:'identity-v1',pages:[{ordinal:0,pageId,resourceRef:`manga:${pageId}`}]};
 const execute=async(method,p,options)=>{
  calls.push({method,params:p});if(options.shouldCancel?.())throw Error('cancelled');
  if(method==='reading.preparation'){
   let intent=intents.get(p.bookId);
   if(p.action==='begin'){assert.equal(p.pendingAdd.contentKind,undefined,'Core typed pendingAdd contract has no media-kind extension');
    intent={schemaVersion:1,sourceId:'s',bookId:'b',sourceVersion:'v1',revision:1,reason:'add',state:'active',updatedAt:1,pendingAdd:p.pendingAdd};}
   else if(p.action==='cancel'||p.action==='block')intent={...intent,revision:intent.revision+1,state:p.action==='cancel'?'cancelled':'blocked',pendingAdd:p.action==='cancel'?undefined:intent.pendingAdd};
   if(intent)intents.set('b',intent);return {data:{intents:intent?[{...intent}]:[]}};
  }
  if(method==='source.list')return {data:{sources:[{sourceId:'s',enabled:true,sourceVersion:'v1',bookSource:{bookSourceType:2}}]}};
  if(method==='search-book.get')return {data:{book:null}};
  if(method==='cache.book.status')return {data:{sourceId:'s',bookId:'b',tocAvailable:false,chapters:[]}};
  if(method==='book.detail')return {data:{sourceId:'s',sourceVersion:'v1',contentKind:'manga',book:{bookId:'b',title:'书',author:'作者'},tocUrl:'b/toc',variables:{}}};
  if(method==='book.toc')return {data:{sourceId:'s',bookId:'b',sourceVersion:'v1',catalogAt:1,catalogVersion:'catalog',contextVersion:'context',catalogInstalled:true,
   continuationVariables:{},toc:[{index:0,title:'漫画章',url:'/chapter',variables:{}}]}};
  if(method==='manga.chapter.get')return {data:{manifest,chapterIndex:0,chapterTitle:'漫画章',cached:false,resources:[{resourceRef:manifest.pages[0].resourceRef,request:{url:'https://image.test/first'}}]}};
  if(method==='bookshelf.add'){
   assert.equal(p.contentKind,undefined,'Core typed bookshelf.add cannot receive unknown contentKind');assert.equal(p.requireReadable,true);assert.equal(p.mangaFirstImage.pageId,pageId);assert.equal(p.mangaFirstImage.imageRevision,'decoded');
   assert.equal(p.mangaFirstImage.sourceRuleVersion,'v1');shelf.set('b',comic);return {data:{sourceId:'s',bookId:'b',created:true,addedAt:1}};
  }
  if(method==='bookshelf.get')return {data:{book:shelf.get('b')??null}};
  if(method==='search-book.put')return {data:{book:null}};
  assert.fail(`unexpected cold manga admission RPC ${method}`);
 };
 const imageHost={async loadReadingImage(){calls.push({method:'Host.image'});await imageGate.promise;
  if(imageResult==='failed')throw Error('FIRST_IMAGE_FAILED');return {fileUri:'file://first',width:600,height:800,revision:'decoded'};},
  releaseReadingImage(uri){released.push(uri);}};
 const coordinator=new BookAcquisitionCoordinator(execute,()=>true,imageHost);
 const runtime={bookAcquisitions:()=>coordinator,request:(...args)=>coordinator.request(...args)};
 const f=readableAdmissionFixture({runtime,book:comic});f.page.remoteReadingSession=undefined;
 const sdk=detailSdk(f);sdk.hit();assert.equal(f.snapshot().adding,true);
 await until(()=>calls.some(c=>c.method==='Host.image')||f.snapshot().confirmation==='unknown');
 assert.ok(calls.some(c=>c.method==='Host.image'),JSON.stringify({snapshot:f.snapshot(),calls}));
 assert.equal(shelf.size,0,'a catalog alone does not admit a comic');assert.equal(calls.filter(c=>c.method==='bookshelf.add').length,0);
 imageGate.resolve();await until(()=>f.snapshot().receipt!==undefined||f.snapshot().confirmation==='unknown');
 assert.ok(!calls.some(c=>c.method==='chapter.content'||c.method.startsWith('reading.progress')),'cold manga never enters novel body/progress RPC');
 if(imageResult==='ready'){assert.equal(f.page.detailInBookshelf,true);assert.deepEqual(released,['file://first']);}
 else {assert.equal(f.page.detailInBookshelf,false);assert.match(f.snapshot().message,/FIRST_IMAGE_FAILED/);
  sdk.actor.updateStateVars({...sdk.child.params,adding:true});sdk.actor.replay();sdk.hit();
  await until(()=>f.snapshot().membership===false&&!f.snapshot().cancelling);assert.equal(f.snapshot().adding,false);}
 coordinator.close();
}

}

async function case_cold_novel_preparation() {
const { default: assert } = await import('node:assert/strict');
const {readFileSync} = await import('node:fs');
const {readableAdmissionFixture,readableDeferred : deferred,readableTick : tick,readableSource : source,ReaderCoreRequestError} = await import('./lib/bookshelf-readable-admission-probe.mjs');
const {localBookDetailSdk} = await import('./lib/local-book-detail-sdk-probe.mjs');
const {createReaderBuilderProbe} = await import('./lib/reader-control-builder-probe.mjs');
const {BookAcquisitionCoordinator}=await import('../entry/src/main/ets/app/BookAcquisitionCoordinator.ts');
const {BookRequestScheduler}=await import('../entry/src/main/ets/app/BookRequestScheduler.ts');
const until=async test=>{for(let i=0;i<200;i++){if(test())return;await tick();}assert.fail('readable admission did not settle');};
const ack=(id='b')=>({data:{sourceId:'s',bookId:id,created:true,addedAt:1}});
const saved=(id='b')=>({sourceId:'s',bookId:id,title:'书',author:'作者',addedAt:1,sortIndex:0});
const {addedBookPreparationCoreFixture}=await import('./lib/added-book-preparation-core-fixture.mjs');
const {fixture}=addedBookPreparationCoreFixture({assert,BookAcquisitionCoordinator,BookRequestScheduler,deferred,tick});
function detailSdk(f){
 const detailSource=source('features/bookshelf/LocalBookDetail.ets');
 class Child{constructor(owner,params,_storage,id){Object.assign(this,{owner,params,id});}updateStateVars(params){for(const [key,value]of Object.entries(params))if(key!=='onRemove'&&key!=='onCancelAdd')this.params[key]=value;}}
 const parent=createReaderBuilderProbe(source('pages/Index.ets'),['detailContent','detailSurface','externalDirectory','isCurrentDetailPresentation'],{LocalBookDetail:Child,BookDirectoryPage:Child,LOCAL_SOURCE_ID:'local'},{childSources:{LocalBookDetail:detailSource,BookDirectoryPage:source('features/bookshelf/BookDirectoryPage.ets')}}).owner;
 Object.assign(parent,f.page,{detailToc:[],remoteContentVerdict:'readable',remoteContentVerdictLabel:()=>'',offlineMutationActiveKey:'',directoryReturnTarget:'detail',hasUnknownShelfWrite:()=>f.page.hasUnknownShelfWrite(),
  detailReadableAdmission:book=>f.page.detailReadableAdmission(book),detailShelfMessage:book=>f.page.detailShelfMessage(book),detailShelfAdmissionIdentity:()=>f.page.detailShelfAdmissionIdentity(),isCurrentDetailShelfAdmission:id=>f.page.isCurrentDetailShelfAdmission(id),requestDetailShelfMutation:()=>f.page.requestDetailShelfMutation(),cancelDetailBookAddition:()=>f.page.cancelDetailBookAddition(),detailBookKey:book=>f.page.detailBookKey(book)});
 parent.detailContent();const child=[...parent.children.values()][0];
 const probe=localBookDetailSdk({}, {allowEmptyBranchAdmission:true,initialParams:child.params});
 Object.assign(probe.owner,{appThemeScheme:'day',viewportWidth:390});probe.owner.actionArea();
 const actions=[...probe.owner.nodes.values()].filter(n=>n.type==='Text'&&typeof n.onClick==='function');
 assert.equal(actions.length,2);
 return {parent,child,actor:probe.owner,button:actions[1],hit:actions[1].onClick};
}
for(const chapterResult of ['ready','cancelled','failed']){
 const core=fixture(),body=deferred();core.gates.set('chapter.content:b',body);
 if(chapterResult==='failed')core.failBodies.add('b');
 const runtime={bookAcquisitions:()=>core.runtime,request:(...args)=>core.runtime.request(...args)};
 const f=readableAdmissionFixture({runtime});f.page.remoteReadingSession=undefined;
 const sdk=detailSdk(f);sdk.hit();assert.equal(f.snapshot().adding,true,'cold metadata tap gives immediate pending feedback');
 await until(()=>core.calls.some(c=>c.method==='chapter.content'));
 assert.equal(core.store.shelf.has('b'),false,'catalog/body acquisition cannot prematurely confirm shelf membership');
 assert.equal(core.calls.filter(c=>c.method==='bookshelf.add').length,0);
 if(chapterResult==='cancelled'){
  sdk.actor.updateStateVars({...sdk.child.params,adding:true});sdk.actor.replay();sdk.hit();
  await until(()=>f.snapshot().membership===false&&!f.snapshot().cancelling);
  assert.equal(core.store.intents.get('b').state,'cancelled');assert.equal(f.snapshot().receipt,undefined);
 }
 body.resolve();await until(()=>!f.snapshot().adding || chapterResult==='failed'&&f.snapshot().confirmation==='unknown');
 if(chapterResult==='ready'){
  assert.equal(f.page.detailInBookshelf,true);assert.equal(core.calls.filter(c=>c.method==='bookshelf.add').length,1);
 }else{
  assert.equal(f.page.detailInBookshelf,false);assert.equal(core.calls.filter(c=>c.method==='bookshelf.add').length,0);
  if(chapterResult==='failed'){
   assert.match(f.snapshot().message,/403/);sdk.actor.updateStateVars({...sdk.child.params,adding:true});sdk.actor.replay();sdk.hit();
   await until(()=>f.snapshot().membership===false&&!f.snapshot().cancelling);
   assert.equal(f.snapshot().adding,false,'failed preparation remains cancellable through the same physical actor');
   assert.equal(f.snapshot().confirmation,'none','actual Core add-failure then strict cancellation clears only the unresolved add presentation');
   assert.equal(f.snapshot().receipt,undefined);assert.equal(f.page.detailShelfMessage(f.page.detailBook),'已取消加入书架');
  }
 }
 assert.ok(!core.calls.some(c=>c.method.startsWith('reading.progress')),'explicit admission preserves reading progress');core.runtime.close();
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
 assert.equal(f.snapshot().confirmation,'none','actual Core cancellation then late body rejection remains settled');
 assert.equal(f.snapshot().receipt,undefined);assert.equal(f.page.detailShelfMessage(f.page.detailBook),'已取消加入书架');
 assert.equal(core.calls.filter(c=>c.method==='bookshelf.add').length,0);core.runtime.close();
}

}

const implementations = {'owner-interleavings':case_owner_interleavings,'detail-sdk-identity':case_detail_sdk_identity,'cold-manga-first-image':case_cold_manga_first_image,'cold-novel-preparation':case_cold_novel_preparation};
for (const id of selectContractCases(CONTRACT_CASES)) {
  await implementations[id]();
  recordContractCasePass(id);
}
