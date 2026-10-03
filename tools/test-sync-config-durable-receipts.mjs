import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { ReaderWriteEvidence } from '../entry/src/main/ets/app/ReaderWriteEvidence.ts';
import { syncIndexFixture as f } from './lib/sync-index-real-fixture.mjs';
const tick=()=>new Promise(r=>setImmediate(r));
const adds=()=>f.asset.calls.filter(c=>c==='add').length;
const op=x=>x.snapshot().facts.operation;
const open=async x=>{x.owner.open();await x.settle();};
const save=async x=>{x.owner.saveConfig(f.config.url,f.config.user,'','',f.config.directory);await x.settle();};
const retry=async x=>{const action=x.page().action;assert.ok(action,'actual SDK shared native recovery');action.onClick();action.onClick();await x.settle();};
const encode=value=>new TextEncoder().encode(JSON.stringify(value));
// UUID generation is delegated to the installed platform; test injection uses
// Node's standard UUID factory and never implements random generation.
const utilApi=readFileSync('/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/api/@ohos.util.d.ts','utf8');
assert.match(utilApi,/function generateRandomUUID\(entropyCache\??: boolean\): string/);
assert.match(f.source('features/sync/SyncGateway.ts'),/util\.generateRandomUUID\(true\)/);
{
 const x=f.fixture();await open(x);assert.equal(op(x),undefined,'old v2 envelope loads without inventing historic receipt');
 assert.equal(await x.store.hasSaveReceipt(randomUUID()),false,'matching legacy fields are not an exact operation receipt');
 f.asset.failAdd=true;await save(x);const unknown=op(x);assert.equal(unknown.projection.receipt.confirmation,'unknown');
 assert.ok(unknown.operationId);const durable=JSON.parse(new TextDecoder().decode(f.asset.record));
 assert.equal(durable.saveOperationId,unknown.operationId,'config and ID are the same actual atomic Asset payload');
 assert.equal(durable.config.backupPassword,f.config.backupPassword);
 await retry(x);assert.equal(op(x).projection.receipt.fact,'confirmedCurrent');assert.equal(op(x).operationId,unknown.operationId);
 assert.equal(op(x).writeGeneration,unknown.writeGeneration,'read-only confirmation preserves physical mutation generation');assert.equal(adds(),1);
 assert.doesNotMatch(JSON.stringify(x.snapshot()),/transient-secret|independent-secret/);
 assert.equal(await x.store.hasSaveReceipt(randomUUID()),false,'another ID cannot match the committed save');
 const reboot=f.fixture({preserveAsset:true});await open(reboot);
 assert.equal(op(reboot).operationId,unknown.operationId,'new process/owner rehydrates only actual committed ID');
 assert.equal(op(reboot).projection.receipt.confirmation,'confirmed');assert.equal(adds(),0,'startup never replays previous save');
}
{
 const x=f.fixture();await open(x);f.asset.beforeAdd=()=>{throw Error('dispatch rejected before commit');};await save(x);const unknown=op(x);
 assert.equal(unknown.projection.receipt.confirmation,'unknown');assert.ok(unknown.operationId);
 f.asset.beforeAdd=undefined;await retry(x);assert.equal(op(x).projection.receipt.confirmation,'unknown','matching old configuration cannot confirm uncommitted ID');
 assert.equal(adds(),1);const calls=f.asset.calls.length;x.owner.saveConfig(f.config.url,f.config.user,'','',f.config.directory);x.owner.triggerBackup();await x.settle();assert.equal(f.asset.calls.length,calls,'unresolved ID blocks replacement writes');
 // Even a later save of identical fields has a different identity.
 const laterId=randomUUID();await x.store.save(f.config,undefined,undefined,laterId);const writes=adds();await retry(x);
 assert.equal(op(x).projection.receipt.confirmation,'unknown');assert.equal(op(x).operationId,unknown.operationId);assert.equal(adds(),writes);
 const reboot=f.fixture({preserveAsset:true});await open(reboot);assert.equal(op(reboot).operationId,laterId);
 assert.notEqual(op(reboot).operationId,unknown.operationId,'restart projects the committed later operation, not an absent intent');
}
{
 const x=f.fixture();await open(x);f.asset.failAdd=true;await save(x);f.asset.failQuery=true;await retry(x);
 assert.equal(op(x).projection.receipt.confirmation,'unknown','failed exact receipt read remains unknown');assert.equal(adds(),1);
 await retry(x);assert.equal(op(x).projection.receipt.fact,'confirmedCurrent');assert.equal(adds(),1);
}
{
 const x=f.fixture();await open(x);const gate=f.pause();f.asset.beforeAdd=()=>gate.promise;
 x.owner.saveConfig(f.config.url,f.config.user,'','',f.config.directory);await tick();x.close();gate.resolve();await x.settle();
 const receipt=JSON.parse(new TextDecoder().decode(f.asset.record)).saveOperationId;
 const reboot=f.fixture({preserveAsset:true});await open(reboot);assert.equal(op(reboot).operationId,receipt);assert.equal(adds(),0,'retired delivery still allows exact committed startup read');
}
{
 const x=f.fixture();await open(x);const id=randomUUID();await x.store.save(f.config,undefined,undefined,id);
 const remove=f.asset.remove;f.asset.remove=async()=>{await remove.call(f.asset);throw Error('lost clear ACK');};const evidence=new ReaderWriteEvidence();
 await assert.rejects(x.store.clear(evidence),/cannot be cleared/);assert.equal(evidence.confirmation(),'unknown','actual dispatched clear failure retains its own unknown evidence');
 assert.equal(await x.store.hasSaveReceipt(id),false,'absence after clear cannot acknowledge an earlier save');f.asset.remove=remove;
 const next=f.fixture({preserveAsset:true});await open(next);assert.equal(op(next),undefined,'cleared config never revives an old save receipt');
 const clearEvidence=new ReaderWriteEvidence();f.asset.remove=async()=>{throw {code:f.asset.ErrorCode.NOT_FOUND};};
 await next.store.clear(clearEvidence);assert.equal(clearEvidence.confirmation(),'confirmed','NOT_FOUND confirms clear absence only');
 assert.equal(await next.store.hasSaveReceipt(id),false);f.asset.remove=remove;
 const denied=new ReaderWriteEvidence();await assert.rejects(next.store.clear(denied,()=>false),/retired/);assert.equal(denied.confirmation(),'undispatched');
 await next.store.save(f.config);assert.ok((await next.store.loadSerializedState()).saveOperationId,'clear failure does not poison subsequent explicit save queue');
}
{
 const x=f.fixture({empty:true});const id=randomUUID(),evidence=new ReaderWriteEvidence();
 f.asset.beforeAdd=()=>{throw {code:f.asset.ErrorCode.NOT_FOUND};};
 await assert.rejects(x.store.save(f.config,evidence,undefined,id),/cannot be written/);assert.equal(evidence.confirmation(),'unknown','NOT_FOUND at add is not a successful save');
 f.asset.beforeAdd=undefined;assert.equal(await x.store.hasSaveReceipt(id),false);
 const prepare=x.store.loadBookshelfViewMode;x.store.loadBookshelfViewMode=()=>{throw Error('receipt query must not migrate/flush');};
 assert.equal(await x.store.hasSaveReceipt(id),false,'exact query uses secure read only');x.store.loadBookshelfViewMode=prepare;
 await x.store.save(f.config,undefined,undefined,id);assert.equal(await x.store.hasSaveReceipt(id),true,'later explicit intent still uses original queue');
}
{
 const x=f.fixture();f.asset.record=encode({formatVersion:2,config:f.config,saveOperationId:'bad-ID'});await assert.rejects(x.store.loadSerializedState(),/identity is invalid/);
 assert.throws(()=>x.store.hasSaveReceipt(''),/identity is invalid/);assert.equal(adds(),0,'malformed metadata never triggers normalization writes');
}
console.log('PASS exact durable config receipt: actual secure atomic ID payload, lost ACK, old/matching/wrong ID rejection, pure-read native recovery, read failure, retired delivery, restart committed identity, clear unknown/NOT_FOUND qualification, migration/queue compatibility and no secret snapshot. HAP/VM/device remain OPEN.');
