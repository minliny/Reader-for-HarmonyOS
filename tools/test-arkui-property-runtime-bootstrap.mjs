import assert from 'node:assert/strict';
import { createArkUIPropertyRuntimeProbe } from './lib/arkui-property-runtime-probe.mjs';

const original = Object.getOwnPropertyDescriptor(globalThis, '__OBSERVED_OBJECT_NAME');
const first = createArkUIPropertyRuntimeProbe();
const second = createArkUIPropertyRuntimeProbe();
assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis, '__OBSERVED_OBJECT_NAME'), original,
  'installed SDK bootstrap must not leak into the Node process');
if (Object.hasOwn(first.runtimeGlobal, '__OBSERVED_OBJECT_NAME')) {
  const key = first.runtimeGlobal.__OBSERVED_OBJECT_NAME;
  assert.equal(typeof key, 'symbol');
  assert.notEqual(key, second.runtimeGlobal.__OBSERVED_OBJECT_NAME, 'probe metadata identities are isolated');
  class Item { constructor() { this.value = 1; } }
  for (const raw of [{ value: 1 }, [1], new Map([['a', 1]]), new Set([1]), new Item()]) {
    const observed = first.sdk.ObservedObject.createNew(raw, undefined);
    assert.equal(observed[key], raw.constructor.name, 'actual SDK proxy records its original class name');
    assert.equal(first.sdk.ObservedObject.GetRawObject(observed), raw);
    assert.equal(Object.hasOwn(raw, 'undefined'), false, 'metadata is never an ordinary undefined-named property');
  }
  const property = new first.sdk.SynchedPropertyObjectOneWayPU({ value: 1 }, undefined, 'item');
  assert.equal(property.get().value, 1);
  property.reset({ value: 2 });
  assert.equal(property.get().value, 2, 'actual SDK copy/reset remains active');
}
console.log('PASS installed SDK bootstrap, class metadata, copy/reset and per-probe global isolation');
