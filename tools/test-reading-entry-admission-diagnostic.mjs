import assert from 'node:assert/strict';
import {compileHost} from './lib/reading-entry-owner-probe.mjs';
import {fixture,deferred,until,seed} from './lib/reading-entry-index-fixture.mjs';
for(const failure of [false,true]) {
 const rows=[],Host=compileHost(undefined,{hilog:{info:(...args)=>rows.push(args),warn:(...args)=>rows.push(args)}});
 const f=fixture(Host),coordinator=f.runtime.bookAcquisitions();
 if(failure)coordinator.acquireBookWithBackgroundRefresh=async()=>{throw Error('actual acquisition failed');};
 await f.host.openRemote({seed:seed(),sourceName:'Source'},f.lease);
 const log=rows.find(row=>row[2].includes('PERF search-detail-admission'));
 assert.ok(log);assert.equal(log[3],'s1');assert.equal(log[4],'book');assert.equal(log.at(-1),f.host.snapshot().scopeId);
 assert.ok(Number.isInteger(log.at(-2)));assert.ok(log.at(-2)>=0,'real elapsed time is recorded, not a pass/fail budget');
 if(failure)assert.match(log[2],/admission-failed/);else assert.equal(log[5],f.host.snapshot().session.acquisitionMode);
 f.close();
}
{
 const rows=[],gate=deferred();let entered=false;
 const Host=compileHost(undefined,{hilog:{info:(...args)=>rows.push(args),warn:(...args)=>rows.push(args)}});
 const f=fixture(Host),coordinator=f.runtime.bookAcquisitions(),original=coordinator.acquireBookWithBackgroundRefresh.bind(coordinator);
 coordinator.acquireBookWithBackgroundRefresh=async(...args)=>{entered=true;await gate.promise;return original(...args);};
 const work=f.host.openRemote({seed:seed(),sourceName:'Source'},f.lease);await until(()=>entered);
 f.host.retire();gate.resolve();await work;assert.equal(rows.length,0,'old scope admission cannot log as the successor current click');f.close();
}
{
 const Host=compileHost(undefined,{hilog:{info(){throw Error('logger failed');},warn(){throw Error('logger failed');}}});
 const f=fixture(Host);await f.host.openRemote({seed:seed(),sourceName:'Source'},f.lease);
 assert.equal(f.host.snapshot().loadingMessage,'');assert.ok(f.host.snapshot().session,'logger failure cannot change true acquired projection');f.close();
}
console.log('PASS actual SDK ReadingEntry admission diagnostics: current success/failure identity, real elapsed sample, retired scope and diagnostic failure isolation; target performance budgets remain OPEN.');
