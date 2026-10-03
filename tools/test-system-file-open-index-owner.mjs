import assert from 'node:assert/strict';
import {systemFileIndexFixture,systemFileTick as tick,systemReaderExitSdk,systemReaderShellExitSdk,systemFileSource} from './lib/system-file-open-index-probe.mjs';
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
{
 const f=systemFileIndexFixture();await f.enqueue();f.page.searchAppForeground=false;f.mount();assert.equal(f.events.length,0);
 f.page.searchAppForeground=true;f.page.consumeSystemFileOpen();assert.deepEqual(f.events.map(e=>e[0]),['close-import','shelf','open','ack']);
 assert.deepEqual(f.events.find(e=>e[0]==='open')[1].readingPosition,f.book.readingPosition);assert.equal(f.queue.peek(),undefined);f.dispose();
}
for(const terminal of ['exit','cancel']){
 const f=systemFileIndexFixture();f.page.readingSessionActive=true;f.mount();const sdk=systemReaderExitSdk(f.page);await f.enqueue();
 assert.equal(f.events.length,0,'queued local file waits for original reader exit registration');
 sdk.onExitRequestHandler(reason=>{assert.equal(reason,'navigation');f.events.push(['exit-request']);});
 f.page.consumeSystemFileOpen();assert.deepEqual(f.events.map(e=>e[0]),['exit-request']);
 if(terminal==='exit'){sdk.onExit(f.page.currentReaderPresentationIdentity());assert.deepEqual(f.events.map(e=>e[0]),['exit-request','shelf','close-import','shelf','open','ack']);}
 else{sdk.onExitCancelled(f.page.currentReaderPresentationIdentity());assert.deepEqual(f.events.map(e=>e[0]),['exit-request','ack']);assert.equal(f.page.readingSessionActive,true);}
 assert.equal(f.queue.peek(),undefined);assert.equal(f.page.systemFileOpenNavigation.hasPendingExit(),false);f.dispose();
}
for(const terminal of ['exit','cancel']){
 const f=systemFileIndexFixture();f.page.readingSessionActive=true;f.mount();
 const sdk=systemReaderShellExitSdk(f.page),old=sdk.render();
 old.onExitRequestHandler(()=>f.events.push(['old-exit-request']));await f.enqueue();
 const original=f.page.currentReaderPresentationIdentity();f.page.readingReadyGeneration++;
 const next=sdk.render();next.onExitRequestHandler(()=>f.events.push(['new-exit-request']));
 f.page.consumeSystemFileOpen();const before=f.events.length;
 old.onExit();old.onExitCancelled();
 assert.equal(f.events.length,before,'retained old ReaderShell physical callbacks cannot consume a same-book new exit');
 assert.ok(f.queue.peek());assert.equal(f.page.systemFileOpenNavigation.hasPendingExit(),true);
 // Even direct old Index payload delivery cannot bypass its immutable tuple.
 f.page.onReaderExited(original);f.page.cancelReaderExitDestination(original);assert.equal(f.events.length,before);
 if(terminal==='exit')next.onExit();else next.onExitCancelled();
 assert.equal(f.queue.peek(),undefined);assert.equal(f.events.filter(e=>e[0]==='ack').length,1);f.dispose();
}
for(const retired of ['unset','runtime','unmount']){
 const f=systemFileIndexFixture();f.page.readingSessionActive=true;f.mount();const actor=systemReaderShellExitSdk(f.page).render();
 actor.onExitRequestHandler(()=>f.events.push(['exit-request']));await f.enqueue();const before=f.events.length;
 if(retired==='unset')f.setRuntime(undefined);
 if(retired==='runtime')f.setRuntime({});
 if(retired==='unmount')f.page.shelfReceiptRetired=true;
 actor.onExit();actor.onExitCancelled();assert.equal(f.events.length,before,'retired actual exit actor cannot navigate or ACK: '+retired);
 assert.ok(f.queue.peek());f.dispose();
}
for(const stale of ['nav','book','mutated-book','runtime','unset','unmount','reappear']){
 const f=systemFileIndexFixture(),query=deferred();f.page.readingSessionActive=true;f.page.detailBook={sourceId:'remote',bookId:'old'};
 let reads=0;f.page.resolveReaderSourceSwitchTransaction=async()=>{reads++;await query.promise;};f.page.readingExitRequest=()=>f.events.push(['exit']);f.mount();await f.enqueue();
 assert.equal(reads,1);const host=f.page.systemFileOpenNavigation;
 if(stale==='nav')f.page.navigationGeneration++;
 if(stale==='book')f.page.detailBook={sourceId:'remote',bookId:'next'};
 if(stale==='mutated-book')f.page.detailBook.bookId='next';
 if(stale==='runtime')f.setRuntime({});
 if(stale==='unset')f.setRuntime(undefined);
 if(stale==='unmount'){f.page.shelfReceiptRetired=true;host.dispose();}
 if(stale==='reappear'){host.dispose();f.page.detailShelfAdmissionMount++;f.page.resolveReaderSourceSwitchTransaction=async()=>new Promise(()=>{});f.page.mountSystemFileOpenNavigation(f.owner);}
 query.reject(Error('late journal failure'));await tick();
 if(stale==='reappear')assert.notEqual(f.page.systemFileOpenNavigation,host);
 else assert.equal(f.events.length,0,'retired check cannot exit/notify/ACK current queue: '+stale);
 assert.ok(f.queue.peek());f.dispose();
}
{
 const f=systemFileIndexFixture();f.page.readingSessionActive=true;f.page.detailBook={sourceId:'remote',bookId:'remote-book'};
 f.page.pendingSourceSwitch={transactionId:'actual-pending-fixture',targetSourceId:'remote',targetBookId:'remote-book'};f.mount();await f.enqueue();f.page.consumeSystemFileOpen();
 assert.equal(f.events.filter(e=>e[0]==='toast').length,1);assert.ok(f.queue.peek());
 f.page.pendingSourceSwitch=undefined;f.page.readingExitRequest=()=>f.events.push(['exit']);f.page.consumeSystemFileOpen();await tick();assert.equal(f.events.at(-1)[0],'exit');f.dispose();
}
{
 const f=systemFileIndexFixture();f.mount();f.page.shelfReceiptRetired=true;f.page.systemFileOpenNavigation.dispose();await f.enqueue();assert.ok(f.queue.peek());
 const next=f.make();next.mountSystemFileOpenNavigation(f.owner);assert.equal(f.queue.peek(),undefined);assert.equal(f.events.filter(e=>e[0]==='open').length,1);f.dispose();
}
{
 const f=systemFileIndexFixture();f.page.getUIContext=()=>{throw Error('toast unavailable');};f.mount();await f.enqueue({failure:{code:'readFailed',message:'读取失败'}});assert.equal(f.queue.peek(),undefined);assert.equal(f.events.filter(e=>e[0]==='ack').length,1);f.dispose();
}
{
 const f=systemFileIndexFixture();f.page.openShelfBook=()=>{throw Error('route failed after import');};f.mount();await f.enqueue();assert.ok(f.queue.peek());assert.equal(f.events.filter(e=>e[0]==='ack').length,0);
 f.page.openShelfBook=()=>f.events.push(['open']);f.page.consumeSystemFileOpen();assert.equal(f.queue.peek(),undefined);assert.equal(f.events.filter(e=>e[0]==='ack').length,1);f.dispose();
}
assert.doesNotMatch(systemFileSource('pages/Index.ets'),/private systemFileOpen(?:Checking|Checked|Applying|NoticeId|ExitId|Unsubscribe|Mounted)/,'old independent navigation owner is removed');
console.log('PASS actual bounded queue→NavigationHost→Index adapter→SDK-emitted original exit registration/cancel/exit callbacks, captured Runtime/mount/nav/book/queue, preserved progress and failed notice/route settlement. Native reader scheduling remains separate.');
