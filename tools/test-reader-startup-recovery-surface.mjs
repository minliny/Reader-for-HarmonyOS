import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ReaderStartupContentOwner} from '../entry/src/main/ets/app/ReaderStartupContentOwner.ts';
import {createReaderBuilderProbe} from './lib/reader-control-builder-probe.mjs';
import {createArkUIPropertyRuntimeProbe} from './lib/arkui-property-runtime-probe.mjs';

const source=file=>readFileSync(new URL(`../entry/src/main/ets/${file}`,import.meta.url),'utf8');
const childSource=source('features/common/ReaderRecoveryAction.ets');
const properties=createArkUIPropertyRuntimeProbe();
const child=createReaderBuilderProbe(childSource,
  ['appThemeScheme','variant','label','generation','actionEnabled','onReconcile','build'],properties.sdk,properties.hooks);
const page=createReaderBuilderProbe(source('pages/ReaderStartupRecovery.ets'),
  ['scheme','state','owner','unsubscribe','aboutToAppear','aboutToDisappear','onBackPress','build','title','message'],
  {...properties.sdk,ReaderStartupContentOwner,ReaderRecoveryAction:child.Component},
  {...properties.hooks,childSources:{ReaderRecoveryAction:childSource},mountChildren:true});
const requests=[];let mainDone,recoveryDone,exits=0;
const owner=new ReaderStartupContentOwner(Promise.resolve(),{
  loadMain(done){requests.push('main');mainDone=done;},loadRecovery(done){requests.push('recovery');recoveryDone=done;},
  ready(){},unavailable(){},async exit(){exits++;},
});
owner.start();await new Promise(resolve=>setImmediate(resolve));mainDone(17);
page.owner.aboutToAppear();page.owner.initialRender();properties.flush();
assert.equal(page.owner.children.size,2,'the independent recovery page uses two real shared action consumers');
const nodes=()=>[...page.owner.children.values()].flatMap(actor=>[...actor.nodes.values()]);
assert.ok(nodes().every(node=>node.enabled===false),'recovery host is not interactive before its native receipt');
recoveryDone(0);properties.flush();
assert.ok(nodes().every(node=>node.enabled===true));
const retry=nodes().find(node=>node.accessibilityText==='重试');retry.onClick();retry.onClick();properties.flush();
await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(requests,['main','recovery','main']);
assert.ok(nodes().every(node=>node.enabled===false),'pending retry receives real disabled Props in retained children');
mainDone(17);recoveryDone(0);properties.flush();
const exit=nodes().find(node=>node.accessibilityText==='退出应用');exit.onClick();await new Promise(resolve=>setImmediate(resolve));assert.equal(exits,1);
page.owner.aboutToDisappear();owner.close();retry.onClick();assert.equal(requests.length,4,'retired recovery control cannot restart a WindowStage');
console.log('PASS independent startup recovery surface: actual SDK page and shared actions, native fallback receipt, retained disabled/busy projection, one retry and retired callback');
