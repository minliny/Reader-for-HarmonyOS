import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ReaderStartupContentOwner} from '../entry/src/main/ets/app/ReaderStartupContentOwner.ts';
import {boundedSurfaceSdk} from './lib/bounded-surface-sdk-probe.mjs';

const source=file=>readFileSync(new URL(`../entry/src/main/ets/${file}`,import.meta.url),'utf8');
const sdk=boundedSurfaceSdk();
const properties=sdk.properties;
const page={owner:sdk.consumer(source('pages/ReaderStartupRecovery.ets'),undefined,{
  ReaderStartupContentOwner,
  ReaderWindowCoordinator:{metrics:()=>({windowRect:{height:844},systemInsets:{top:48,bottom:34}})},
})};
const requests=[];let mainDone,recoveryDone,exits=0;
const owner=new ReaderStartupContentOwner(Promise.resolve(),{
  loadMain(done){requests.push('main');mainDone=done;},loadRecovery(done){requests.push('recovery');recoveryDone=done;},
  ready(){},unavailable(){},async exit(){exits++;},
});
owner.start();await new Promise(resolve=>setImmediate(resolve));mainDone(17);
page.owner.aboutToAppear();page.owner.initialRender();properties.flush();
const nodes=()=>sdk.nodes(page.owner);
assert.equal(nodes().filter(node=>node.onClick).length,0,'startup wait exposes no retry before its native receipt');
assert.ok(nodes().some(node=>node.type==='LoadingProgress'&&node.width===32),'startup wait uses actual native32 state child');
// The CPU probe does not model native branch removal. Mount the two real
// approved families independently, retaining business callbacks for fencing.
page.owner.aboutToDisappear();recoveryDone(0);
page.owner=sdk.consumer(source('pages/ReaderStartupRecovery.ets'),undefined,{
  ReaderStartupContentOwner,ReaderWindowCoordinator:{metrics:()=>({windowRect:{height:844},systemInsets:{top:48,bottom:34}})},
});page.owner.aboutToAppear();page.owner.initialRender();properties.flush();
assert.equal(nodes().filter(node=>node.onClick&&node.enabled).length,2,'native recovery receipt admits the two original actions');
const retry=nodes().find(node=>node.accessibilityText==='重试');retry.onClick();retry.onClick();properties.flush();
await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(requests,['main','recovery','main']);
assert.equal(page.owner.state.canRetry,false,'retry admission closes while the original main load is pending');
retry.onClick();assert.equal(requests.length,3,'retained old callback cannot duplicate the pending main load');
mainDone(17);recoveryDone(0);properties.flush();
const exit=nodes().find(node=>node.accessibilityText==='退出应用');exit.onClick();await new Promise(resolve=>setImmediate(resolve));assert.equal(exits,1);
page.owner.aboutToDisappear();owner.close();retry.onClick();assert.equal(requests.length,4,'retired recovery control cannot restart a WindowStage');
// A failed recovery load is a terminal fact, not an endless spinner. It carries
// canRetry=false, so busy must come from the phase, not from !canRetry.
let failedMainDone,failedRecoveryDone;
const failedOwner=new ReaderStartupContentOwner(Promise.resolve(),{
  loadMain(done){failedMainDone=done;},loadRecovery(done){failedRecoveryDone=done;},ready(){},unavailable(){},async exit(){},
});
failedOwner.start();await new Promise(resolve=>setImmediate(resolve));failedMainDone(17);
failedRecoveryDone(17);
// The probe keeps removed branches, so mount a fresh page once the terminal
// platform-unavailable fact already exists instead of asserting across a
// simulated branch removal.
const failedPage={owner:sdk.consumer(source('pages/ReaderStartupRecovery.ets'),undefined,{
  ReaderStartupContentOwner,ReaderWindowCoordinator:{metrics:()=>({windowRect:{height:844},systemInsets:{top:48,bottom:34}})},
})};
failedPage.owner.aboutToAppear();failedPage.owner.initialRender();properties.flush();
const failedNodes=sdk.nodes(failedPage.owner);
assert.equal(failedPage.owner.state.phase,'platform-unavailable');
assert.equal(failedNodes.filter(node=>node.type==='LoadingProgress').length,0,'terminal recovery failure must not keep a spinner');
assert.equal(failedNodes.filter(node=>node.onClick).length,0,'terminal recovery failure exposes no retry or exit');
failedPage.owner.aboutToDisappear();failedOwner.close();
console.log('PASS independent startup recovery surface: actual SDK page and shared actions, native32 wait/no actions, native-receipt recovery actions and terminal-failure no spinner, one retry and retired callback; native branch removal remains outside CPU proof');
